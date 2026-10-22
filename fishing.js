/* ════════════════════════════════════════════════════════════
   낚시 — 마을 곳곳의 연못에서 물고기를 낚는다
   ────────────────────────────────────────────────────────────
   연못 3곳(PONDS). 물가(물 가장자리 2.5 m 안)나 나무 선착장 앞에서 "F 낚시하기" 가 뜬다.
   F → 물을 보고 서서(선착장이면 끝까지 걸어 나가서) 낚싯대를 던진다.
   찌가 톡톡 건드려지다가 쑥 잠기며 "!" 가 뜨면 0.8초 안에 F / Space / 클릭 → 챔질.
   그다음 짧은 손맛 게임: Space 나 마우스를 누르고 있으면 초록 칸이 올라간다. 물고기를 칸 안에 두면 게이지가 찬다.
   다 차면 낚았다! 카드에 그림·이름·크기(cm)·희귀도가 뜨고 도감(localStorage)에 남는다.
   Space / 클릭 → 다시 던지기. F / Esc / WASD → 그만하기.
   겨울(getSeason() === 'winter')에는 연못이 얼어서 얼음 구멍을 뚫고 '얼음낚시'를 한다(빙어가 나온다).

   그리기: 연못 3곳을 합쳐 물 1 · 둑 1 · 돌 1 · 갈대 1 · 연잎 1 · 연꽃 1 · 선착장 1 = 7 draw call.
   물 높이는 연못 안 지형의 70% 높이로 자동으로 정한다. 지형이 물보다 높은 곳은 지형이 물을 가려 물가가
   자연스러운 등고선이 되고, 낮은 쪽 가장자리는 흙둑+돌이 막는다.

   ── portfolio.js 연결 방법 (PM용) ──────────────────────────────
   ⓪ 연못 자리 나무 비우기 — worldLoader.load(...) 위에서 한 번:
        const { PONDS } = await import('./fishing.js');
      그리고 월드 콜백의 clearTrees(...) 줄 다음에:
        clearTrees(gltf.scene, PONDS.map(p => [p.x, p.z]), 6.2);   // 연못 안·둑 위 나무를 뺀다

   ① tavern 블록 아래(weapons 블록 아래도 OK):
        let fishing = null;   // npcs/weapons 의 isBlocked 가 먼저 참조하면 위에서 미리 선언
        {
          const { createFishing } = await import('./fishing.js');
          fishing = createFishing({
            THREE, scene, camera, person, groundY,
            personClips: () => charClips,
            domElement: renderer.domElement,
            getSeason: () => seasons.season,                     // 'winter' 이면 얼음낚시
            isBlocked: () => !driveActive || panelOpen() || tavern.seated,
            onStart() { pSpeed = 0; if (weapons) weapons.holster(); },
            onStop(h) { pHeading = camYaw = h; pSpeed = 0; },    // 그만두면 물을 등지지 않고 물 쪽을 본 채 선다
          });
        }
        const fishIn = { onFoot: false, keys: null };   // 매 프레임 재사용

   ② step(dt) 맨 위 분기:
        if (player.mode === 'driving') drive(dt);
        else if (!tavern.seated && !fishing.active) walk(dt);
        ...tavern.update(...) 다음 줄:
        fishIn.onFoot = player.mode === 'onfoot'; fishIn.keys = keys;
        fishing.update(dt, fishIn);

   ③ 카메라 — tavern 의 취기 흔들림이 맨 위에 얹히도록 tavern 안쪽 fallback 으로 넣는다:
        tavern.cameraStep(camera, dt, d => fishing.cameraStep(camera, d, updateCamera));

   ④ 걷기 충돌 — walk(dt) 안 `if (clampToBounds(person.position)) pSpeed = 0;` 다음 줄:
        if (fishing.pushOut(person.position, 0.35)) pSpeed *= 0.5;   // 물·선착장으로 못 들어간다
      (선택) 차도 막으려면 drive() 의 clampToBounds 다음에: fishing.pushOut(car.position, 1.4)
      (선택) NPC 길찾기에도 fishing.blocks(x, z) 를 쓸 수 있다.

   ⑤ F 키 — keydown 의 `if (e.code === 'KeyF') { ... toggleVehicle(); }` 를 이렇게:
        if (e.code === 'KeyF') {
          e.preventDefault(); hideHint();
          // (NPC 대화가 F 를 쓰면 그 분기를 여기 먼저 둔다)
          if (player.mode === 'onfoot' && fishing.onF()) return;   // 낚시 시작/챔질/그만
          toggleVehicle();
        }
      Space·Esc·클릭은 낚시 중에만 이 모듈이 직접 받는다(Space 는 캡처 단계에서 먹어서 '프로젝트 보기'와 안 겹친다).

   ⑥ 낚시 중 클릭이 주먹·잡기·무기로 새지 않게:
        npcs 의 isBlocked 에 `|| (fishing && fishing.active)`,
        weapons 의 canUse 에 `&& !(fishing && fishing.active)`,
        tavern 의 isBlocked 에 `|| (fishing && fishing.active)`.

   ⑦ (선택) physicsStep 사람 몸체: 낚시 중엔 선착장 위(물 위)에 서 있으니 그대로 둬도 된다.
   ⑧ (선택) updateHint() 에: <span class="key">F</span> 낚시(연못 옆)

   디버그(?test): window.__fishing = fishing → __fishing.ponds, __fishing.log(), __fishing.debugBite()
   ════════════════════════════════════════════════════════════ */

import { createPoser } from './tavern.js';

const D2R = Math.PI / 180;

/* 연못 자리 — 길·가판대·연락처 표지판·바위를 피하고, 지형이 둥글게 오목한 곳.
   dock = 선착장이 물로 뻗는 방향의 반대(물가 쪽) 각도(라디안, x=cos, z=sin). 모두 길(서쪽) 쪽을 본다. */
export const PONDS = [
  { id: 'start',  name: '출발 연못', x: 10, z: 76,  r: 4.6, dock: Math.PI + 0.25 },
  { id: 'village', name: '마을 연못', x: 8,  z: 10,  r: 4.6, dock: Math.PI - 0.2 },
  { id: 'forest', name: '숲속 연못', x: 19, z: -54, r: 4.6, dock: Math.PI + 0.1 },
];

/* 물고기 — w: 뽑힐 비율, cm: 크기 범위, diff: 손맛 게임 난이도(0~1) */
export const SPECIES = [
  { id: 'crucian', name: '붕어',     rare: 'common', w: 30, cm: [12, 28], diff: 0.22, body: '#8d7c48', belly: '#e3d6a0', fin: '#6b5b32', shape: 'deep' },
  { id: 'chub',    name: '피라미',   rare: 'common', w: 22, cm: [8, 15],  diff: 0.30, body: '#a9b8c2', belly: '#f2f5f7', fin: '#e58a8a', shape: 'slim', stripe: '#d98aa0' },
  { id: 'carp',    name: '잉어',     rare: 'normal', w: 14, cm: [30, 70], diff: 0.45, body: '#a37a3a', belly: '#e8cf93', fin: '#7d5a2a', shape: 'deep', whisker: true },
  { id: 'trout',   name: '송어',     rare: 'normal', w: 10, cm: [25, 55], diff: 0.55, body: '#7f9270', belly: '#f0e3d0', fin: '#6a7a5a', shape: 'slim', stripe: '#e88b8b', spots: '#3d4a33' },
  { id: 'catfish', name: '메기',     rare: 'normal', w: 8,  cm: [30, 80], diff: 0.50, body: '#4b4f4a', belly: '#bfb9a6', fin: '#3a3d39', shape: 'cat', whisker: true },
  { id: 'eel',     name: '장어',     rare: 'rare',   w: 6,  cm: [40, 90], diff: 0.70, body: '#3f4a3a', belly: '#c9c08a', fin: '#2f382c', shape: 'eel' },
  { id: 'snakehead', name: '가물치', rare: 'rare',   w: 5,  cm: [40, 80], diff: 0.72, body: '#5a5233', belly: '#cfc49a', fin: '#463f26', shape: 'slim', spots: '#2b2716' },
  { id: 'goldcarp', name: '황금잉어', rare: 'epic',  w: 2.5, cm: [40, 75], diff: 0.80, body: '#f0b52c', belly: '#ffe38a', fin: '#e08a1a', shape: 'deep', whisker: true },
  { id: 'smelt',   name: '빙어',     rare: 'common', w: 0,  winterW: 34, cm: [6, 12], diff: 0.25, body: '#c5d6de', belly: '#f4f8fa', fin: '#b0c4cc', shape: 'slim', stripe: '#9fb6c2' },
  { id: 'boot',    name: '낡은 장화', rare: 'junk',  w: 8,  cm: null, diff: 0.08, body: '#5b3b22', shape: 'boot' },
  { id: 'crown',   name: '임금님의 왕관', rare: 'legend', w: 0.4, cm: null, diff: 0.85, body: '#f2c230', shape: 'crown' },
];
const RARE = {
  junk:   { label: '잡동사니', color: '#7a6a58' },
  common: { label: '흔함', color: '#5f7d4a' },
  normal: { label: '보통', color: '#3f6f8f' },
  rare:   { label: '희귀', color: '#7a4fa8' },
  epic:   { label: '아주 희귀', color: '#c27a12' },
  legend: { label: '전설', color: '#b3262e' },
};
const FLAVOR = {
  boot: '누가 연못에 장화를 버렸담… 왼쪽 한 짝이다.',
  crown: '최상호 임금님이 잃어버린 왕관! 내일 궁에 돌려드리자.',
  goldcarp: '비늘이 햇빛에 반짝인다. 오늘 운수 대통!',
  smelt: '얼음 구멍에서 올라온 반짝이는 빙어.',
  eel: '미끌미끌… 놓칠 뻔했다.',
};

const STORE_KEY = 'sh-fishing-v1';
const SHORE_R = 2.5, DOCK_R = 3.2, BITE_WIN = 0.8;
const ROD_LEN = 2.3, GRIP_AT = 0.32;

/* 받침 글자가 있으면 '을', 없으면 '를' */
const objJosa = w => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? '을' : '를'; };
const smooth = t => t * t * (3 - 2 * t);
const clamp01 = t => Math.max(0, Math.min(1, t));

const CSS = `
.fs-prompt{position:fixed;left:0;top:0;z-index:42;transform:translate(-50%,-100%);display:inline-flex;align-items:center;gap:8px;
  padding:7px 12px 7px 8px;border-radius:999px;border:1px solid rgba(107,68,35,.55);background:rgba(250,240,214,.94);
  color:#3b2412;font:600 13px/1.2 Georgia,'Nanum Myeongjo',serif;box-shadow:0 6px 18px rgba(40,24,10,.25);cursor:pointer;pointer-events:auto}
.fs-prompt[hidden],.fs-hud[hidden],.fs-reel[hidden],.fs-bang[hidden]{display:none}
.fs-prompt small{font-size:11px;opacity:.7;font-weight:500}
.fs-prompt kbd,.fs-hud kbd,.fs-reel kbd{font:700 11px/1 ui-monospace,monospace;background:#3b2412;color:#f6e7c4;border-radius:5px;padding:4px 6px}
.fs-hud{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:41;display:flex;flex-direction:column;align-items:center;gap:6px;
  padding:9px 14px 9px;border-radius:12px;background:linear-gradient(180deg,#f7ebcd,#efdcb2);border:2px solid #6b4423;
  box-shadow:0 10px 26px rgba(40,24,10,.28);color:#3b2412;font:14px/1.35 Georgia,'Nanum Myeongjo',serif;max-width:calc(100vw - 32px)}
.fs-hud .st{font-weight:700;font-size:14.5px;text-align:center}
.fs-hud .ks{display:flex;align-items:center;gap:10px;font-size:12px;flex-wrap:wrap;justify-content:center}
.fs-hud .ks span{display:inline-flex;align-items:center;gap:5px}
.fs-hud .ks .dex{opacity:.8}
.fs-hud button{border:1px solid #6b4423;background:transparent;color:#3b2412;border-radius:7px;padding:4px 9px;font:700 12px Georgia,'Nanum Myeongjo',serif;cursor:pointer}
.fs-hud button.main{background:#6b4423;color:#fbefd2}
.fs-bang{position:fixed;left:0;top:0;z-index:43;transform:translate(-50%,-110%);pointer-events:none;
  font:900 34px/1 Georgia,serif;color:#fff3c4;-webkit-text-stroke:2px #8a2a12;text-shadow:0 3px 0 #8a2a12,0 6px 14px rgba(0,0,0,.35);
  animation:fs-pop .18s ease-out}
@keyframes fs-pop{from{transform:translate(-50%,-80%) scale(.4)}to{transform:translate(-50%,-110%) scale(1)}}
.fs-reel{position:fixed;right:calc(50% - 250px);top:50%;transform:translateY(-55%);z-index:42;display:flex;gap:8px;align-items:stretch;
  padding:10px;border-radius:12px;background:linear-gradient(180deg,#f7ebcd,#efdcb2);border:2px solid #6b4423;box-shadow:0 12px 30px rgba(40,24,10,.32);
  user-select:none;-webkit-user-select:none;touch-action:none}
.fs-reel .tr{position:relative;width:40px;height:230px;border-radius:8px;background:linear-gradient(180deg,#5f8ea0,#2c4f63);border:2px solid #3b2412;overflow:hidden}
.fs-reel .zn{position:absolute;left:2px;right:2px;bottom:0;border-radius:5px;background:rgba(140,220,110,.55);border:2px solid #d7ffb8;box-sizing:border-box}
.fs-reel .zn.on{background:rgba(160,240,120,.78)}
.fs-reel .fi{position:absolute;left:50%;width:30px;height:18px;margin:-9px 0 0 -15px}
.fs-reel .pg{position:relative;width:12px;height:230px;border-radius:6px;background:#3b2412;overflow:hidden;border:2px solid #3b2412}
.fs-reel .pg i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,#f6d36a,#e0892a)}
.fs-reel .lb{writing-mode:vertical-rl;font:600 12px Georgia,'Nanum Myeongjo',serif;color:#3b2412;opacity:.8;text-align:center}
.fs-card{position:fixed;left:50%;top:72px;z-index:44;transform:translate(-50%,-14px) scale(.96);opacity:0;pointer-events:none;
  transition:opacity .25s,transform .25s;width:min(330px,calc(100vw - 32px));padding:12px 14px 12px;border-radius:14px;
  background:linear-gradient(180deg,#fbf1d6,#efdcb2);border:2px solid #6b4423;outline:1px solid rgba(255,248,230,.7);outline-offset:-6px;
  box-shadow:0 18px 40px rgba(40,24,10,.35);color:#3b2412;font:14px/1.4 Georgia,'Nanum Myeongjo',serif;text-align:center}
.fs-card.on{opacity:1;transform:translate(-50%,0) scale(1)}
.fs-card canvas{display:block;position:static!important;inset:auto!important;margin:2px auto 4px;width:220px;height:110px}
.fs-card .tt{font-weight:800;font-size:17px}
.fs-card .sz{font-size:13px;margin-top:2px}
.fs-card .rr{display:inline-block;margin-top:6px;padding:2px 9px;border-radius:999px;color:#fff;font-size:11.5px;font-weight:700;letter-spacing:.03em}
.fs-card .nw{display:inline-block;margin-left:6px;font-size:11.5px;font-weight:800;color:#b3262e}
.fs-card .fl{margin-top:6px;font-size:12px;opacity:.78}
.fs-card .ct{margin-top:6px;font-size:11.5px;opacity:.7}
.fs-toast{position:fixed;left:50%;top:84px;z-index:43;transform:translate(-50%,-8px);opacity:0;transition:opacity .25s,transform .25s;
  padding:9px 14px;border-radius:12px;background:rgba(250,240,214,.96);border:1.5px solid #6b4423;color:#3b2412;
  font:600 13.5px Georgia,'Nanum Myeongjo',serif;box-shadow:0 8px 22px rgba(40,24,10,.25);pointer-events:none;white-space:nowrap}
.fs-toast.on{opacity:1;transform:translate(-50%,0)}
body.intro-on .fs-prompt,body.intro-on .fs-hud,body.intro-on .fs-reel,body[data-view="doc"] .fs-prompt,body[data-view="doc"] .fs-hud,
body[data-view="doc"] .fs-reel,body[data-view="doc"] .fs-card,body[data-view="doc"] .fs-bang{display:none!important}
@media (max-width:640px){.fs-hud{bottom:150px}.fs-reel{right:16px}}
`;

/* ════════ 카드 그림 (캔버스) ════════ */
function drawCatch(cv, sp) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  // 물결 배경
  g.fillStyle = 'rgba(95,142,160,.16)'; g.beginPath(); g.ellipse(W / 2, H * 0.62, W * 0.46, H * 0.32, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = 3; g.strokeStyle = '#3b2412'; g.lineJoin = 'round'; g.lineCap = 'round';
  const s = W / 220;
  g.save(); g.translate(W / 2, H / 2); g.scale(s, s);
  if (sp.shape === 'boot') {
    g.fillStyle = sp.body;
    g.beginPath(); g.moveTo(-22, -40); g.lineTo(12, -40); g.lineTo(14, 14); g.quadraticCurveTo(50, 16, 56, 30); g.lineTo(56, 40);
    g.lineTo(-26, 40); g.lineTo(-24, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#3a2414'; g.fillRect(-26, 34, 82, 7); g.strokeRect(-26, 34, 82, 7);
    g.strokeStyle = '#8a6a48'; g.lineWidth = 2; g.beginPath(); g.moveTo(-20, -30); g.lineTo(9, -30); g.stroke();
    g.fillStyle = '#6fa0b0'; g.beginPath(); g.arc(30, 22, 3, 0, 7); g.arc(-8, -10, 2.5, 0, 7); g.fill();   // 물방울
  } else if (sp.shape === 'crown') {
    g.fillStyle = sp.body;
    g.beginPath(); g.moveTo(-52, 28); g.lineTo(-58, -26); g.lineTo(-28, 0); g.lineTo(0, -38); g.lineTo(28, 0); g.lineTo(58, -26); g.lineTo(52, 28); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = '#d99a1a'; g.fillRect(-52, 20, 104, 14); g.strokeRect(-52, 20, 104, 14);
    [[-58, -26, '#3f7fd0'], [0, -38, '#d0333f'], [58, -26, '#2f9a5a']].forEach(([x, y, c]) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.stroke(); });
    g.fillStyle = '#d0333f'; g.beginPath(); g.arc(0, 27, 5, 0, 7); g.fill();
    g.strokeStyle = '#fff6c8'; g.lineWidth = 2; g.beginPath(); g.moveTo(-40, 6); g.lineTo(-30, 14); g.stroke();
  } else if (sp.shape === 'eel') {
    g.fillStyle = sp.body;
    g.beginPath();
    for (let i = 0; i <= 20; i++) { const x = -86 + i * 8.6, y = Math.sin(i * 0.55) * 12; i ? g.lineTo(x, y - 9 + i * 0.15) : g.moveTo(x, y - 9); }
    for (let i = 20; i >= 0; i--) { const x = -86 + i * 8.6, y = Math.sin(i * 0.55) * 12; g.lineTo(x, y + 9 - i * 0.15); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(80, Math.sin(20 * 0.55) * 12 - 3, 3.5, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(81, Math.sin(20 * 0.55) * 12 - 3, 1.8, 0, 7); g.fill();
  } else {
    const deep = sp.shape === 'deep', cat = sp.shape === 'cat';
    const L = 72, Hh = deep ? 32 : cat ? 22 : 22;
    // 꼬리
    g.fillStyle = sp.fin;
    g.beginPath(); g.moveTo(-L + 8, 0); g.lineTo(-L - 26, -24); g.quadraticCurveTo(-L - 16, 0, -L - 26, 24); g.closePath(); g.fill(); g.stroke();
    // 등지느러미
    g.beginPath(); g.moveTo(-18, -Hh + 4); g.quadraticCurveTo(0, -Hh - 20, 22, -Hh + 6); g.closePath(); g.fill(); g.stroke();
    // 몸
    const gr = g.createLinearGradient(0, -Hh, 0, Hh); gr.addColorStop(0, sp.body); gr.addColorStop(0.62, sp.body); gr.addColorStop(1, sp.belly);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(-L + 6, 0);
    g.bezierCurveTo(-L + 20, -Hh * 1.15, L * 0.55, -Hh * 1.1, L, cat ? -2 : 2);
    g.bezierCurveTo(L * 0.55, Hh * 1.1, -L + 20, Hh * 1.05, -L + 6, 0);
    g.fill(); g.stroke();
    if (sp.stripe) { g.strokeStyle = sp.stripe; g.lineWidth = 5; g.globalAlpha = 0.8; g.beginPath(); g.moveTo(-L + 18, 2); g.quadraticCurveTo(0, -2, L - 12, 1); g.stroke(); g.globalAlpha = 1; g.strokeStyle = '#3b2412'; g.lineWidth = 3; }
    if (sp.spots) { g.fillStyle = sp.spots; for (let i = 0; i < 12; i++) { const x = -48 + (i * 37 % 96), y = -Hh * 0.55 + ((i * 13) % 9) * 1.6; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); } }
    // 비늘 무늬
    if (deep) { g.strokeStyle = 'rgba(59,36,18,.28)'; g.lineWidth = 1.5; for (let x = -40; x < 40; x += 11) for (let y = -14; y < 14; y += 10) { g.beginPath(); g.arc(x, y, 6, -1.2, 1.2); g.stroke(); } g.strokeStyle = '#3b2412'; g.lineWidth = 3; }
    // 아가미 · 가슴지느러미
    g.beginPath(); g.moveTo(L * 0.55, -Hh * 0.6); g.quadraticCurveTo(L * 0.42, 0, L * 0.55, Hh * 0.6); g.stroke();
    g.fillStyle = sp.fin; g.beginPath(); g.moveTo(L * 0.35, Hh * 0.35); g.quadraticCurveTo(L * 0.15, Hh * 0.9, L * 0.05, Hh * 0.55); g.closePath(); g.fill(); g.stroke();
    // 눈
    g.fillStyle = '#fff'; g.beginPath(); g.arc(L * 0.74, -Hh * 0.28, 6, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#111'; g.beginPath(); g.arc(L * 0.76, -Hh * 0.28, 2.8, 0, 7); g.fill();
    if (sp.whisker) { g.lineWidth = 2; g.beginPath(); g.moveTo(L - 2, 4); g.quadraticCurveTo(L + 14, 10, L + 18, 24); g.moveTo(L - 4, 6); g.quadraticCurveTo(L + 4, 18, L + 2, 30); g.stroke(); }
    if (sp.id === 'goldcarp') { g.fillStyle = '#fffbe0'; [[-30, -26], [44, -36], [10, 30]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 2, y - 2); g.lineTo(x + 7, y); g.lineTo(x + 2, y + 2); g.lineTo(x, y + 7); g.lineTo(x - 2, y + 2); g.lineTo(x - 7, y); g.lineTo(x - 2, y - 2); g.closePath(); g.fill(); }); }
  }
  g.restore();
}
const FISH_ICON = '<svg viewBox="0 0 30 18" width="30" height="18" aria-hidden="true"><path d="M3 9 L0 2 L0 16 Z" fill="#f2c14e" stroke="#3b2412" stroke-width="1.4" stroke-linejoin="round"/><ellipse cx="15" cy="9" rx="12" ry="6.5" fill="#f2c14e" stroke="#3b2412" stroke-width="1.6"/><circle cx="22" cy="7.5" r="1.6" fill="#3b2412"/></svg>';

export function createFishing({
  THREE, scene, camera, person, personClips, groundY, domElement,
  getSeason = () => 'autumn', isBlocked, onStart, onStop, ponds: pondDefs = PONDS, hideGrass = true,
}) {
  const V = THREE.Vector3;
  const poser = createPoser({ THREE, person, personClips });
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const blocked = () => (isBlocked ? !!isBlocked() : false);
  const _v = new V(), _v2 = new V(), _v3 = new V(), _tgt = new V(), _pole = new V(), _d = new V(), _q = new THREE.Quaternion();
  const UP = new V(0, 1, 0);

  /* ════════ 연못 데이터 ════════ */
  const ponds = pondDefs.map(d => {
    const p = { ...d, cx: d.x, cz: d.z };
    // 물 높이: 연못 안 지형의 70% 높이
    const hs = [];
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
      const u = i / 8 * p.r, w = j / 8 * p.r;
      if (u * u + w * w <= p.r * p.r) hs.push(groundY(p.x + u, p.z + w));
    }
    hs.sort((a, b) => a - b);
    p.level = d.level ?? hs[Math.floor(hs.length * 0.7)];
    p.minH = hs[0];
    // 선착장: 물가(지형이 물 위로 올라오는 곳)를 찾아 그 바깥 0.6 m 에서 물 쪽으로 2.6 m
    p.dx = Math.cos(d.dock); p.dz = Math.sin(d.dock);
    let shore = p.r;
    for (let r = 0.5; r <= p.r; r += 0.1) if (groundY(p.x + p.dx * r, p.z + p.dz * r) >= p.level) { shore = r; break; }
    p.dockOut = shore + 0.6;                 // 물가 쪽 끝 (중심에서 거리)
    p.dockIn = Math.max(0.9, shore - 2.2);  // 물 쪽 끝
    p.dockW = 1.1;
    p.deckY = p.level + 0.2;
    p.dockEnd = new V(p.x + p.dx * (p.dockIn + 0.45), p.deckY, p.z + p.dz * (p.dockIn + 0.45));
    p.dockBase = new V(p.x + p.dx * (p.dockOut + 0.5), 0, p.z + p.dz * (p.dockOut + 0.5));
    p.dockBase.y = groundY(p.dockBase.x, p.dockBase.z);
    return p;
  });

  const wetAt = (p, x, z, pad = 0) => {
    const d = Math.hypot(x - p.x, z - p.z);
    return d < p.r + pad && groundY(x, z) < p.level + 0.02;
  };
  const inDock = (p, x, z, pad = 0) => {
    const rx = x - p.x, rz = z - p.z;
    const a = rx * p.dx + rz * p.dz, b = -rx * p.dz + rz * p.dx;
    return a > p.dockIn - 0.2 - pad && a < p.dockOut + pad && Math.abs(b) < p.dockW / 2 + pad;
  };
  function blocks(x, z) {
    for (const p of ponds) {
      if (Math.abs(x - p.x) > p.r + 1 || Math.abs(z - p.z) > p.r + 1) continue;
      if (inDock(p, x, z) || wetAt(p, x, z, 0.25)) return true;
    }
    return false;
  }
  /* 중심에서 바깥으로 밀어낸다. 반지름 rad 만큼 몸 앞쪽(중심 쪽)도 막는다 */
  function pushOut(pos, rad = 0.35) {
    let hit = false;
    for (const p of ponds) {
      const rx = pos.x - p.x, rz = pos.z - p.z, d = Math.hypot(rx, rz);
      if (d > p.r + rad + 1.4 || d < 1e-4) continue;
      const ux = rx / d, uz = rz / d;
      const bad = r => { const q = Math.max(0, r - rad); const x = p.x + ux * q, z = p.z + uz * q; return inDock(p, x, z) || wetAt(p, x, z, 0.25); };
      if (!bad(d)) continue;
      let r = d; while (r < p.r + rad + 1.6 && bad(r)) r += 0.05;
      pos.x = p.x + ux * r; pos.z = p.z + uz * r; hit = true;
    }
    return hit;
  }
  /* 연못 물가 정보: 사람이 서는 물가 점·물까지 거리 */
  function shoreInfo(p, x, z) {
    const rx = x - p.x, rz = z - p.z, d = Math.hypot(rx, rz);
    if (d < 1e-4) return null;
    const ux = rx / d, uz = rz / d;
    let edge = 0;
    for (let r = Math.min(d, p.r + 0.3); r > 0.3; r -= 0.1) if (wetAt(p, p.x + ux * r, p.z + uz * r)) { edge = r; break; }
    if (!edge) return null;
    return { dist: d - edge, ux, uz, edge };
  }

  /* ════════ 그리기 ════════ */
  const SEG = 56, RINGS = 9;
  const wob = (p, a) => 1 + 0.07 * Math.sin(2 * a + p.x) + 0.04 * Math.sin(3 * a + p.z);
  const group = new THREE.Group(); group.name = 'fishing-ponds';
  scene.add(group);

  // ── 물 (연못 3곳 한 메시) ──
  const waterColA = [], iceColA = [], posA = [], idxA = [];
  const deepC = new THREE.Color(0x173a52), shallowC = new THREE.Color(0x4f8f96), iceDeep = new THREE.Color(0xbfd8e6), iceSh = new THREE.Color(0xe8f2f7);
  const _c = new THREE.Color();
  for (const p of ponds) {
    const base = posA.length / 3;
    posA.push(p.x, p.level, p.z);
    { const dep = p.level - groundY(p.x, p.z); _c.copy(shallowC).lerp(deepC, clamp01(dep / 0.45)); waterColA.push(_c.r, _c.g, _c.b, 0.95); _c.copy(iceSh).lerp(iceDeep, clamp01(dep / 0.45)); iceColA.push(_c.r, _c.g, _c.b, 1); }
    for (let k = 1; k <= RINGS; k++) for (let s = 0; s < SEG; s++) {
      const a = s / SEG * Math.PI * 2, rr = p.r * (k / RINGS) * (k === RINGS ? wob(p, a) : 1 + (wob(p, a) - 1) * k / RINGS);
      const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr;
      posA.push(x, p.level, z);
      const dep = p.level - groundY(x, z);
      const al = k === RINGS ? 0 : clamp01((dep + 0.04) / 0.12);
      _c.copy(shallowC).lerp(deepC, clamp01(dep / 0.45)); waterColA.push(_c.r, _c.g, _c.b, 0.35 + 0.6 * al);
      _c.copy(iceSh).lerp(iceDeep, clamp01(dep / 0.45)); iceColA.push(_c.r, _c.g, _c.b, k === RINGS ? 0.6 : 1);
    }
    for (let s = 0; s < SEG; s++) idxA.push(base, base + 1 + (s + 1) % SEG, base + 1 + s);
    for (let k = 1; k < RINGS; k++) for (let s = 0; s < SEG; s++) {
      const a = base + 1 + (k - 1) * SEG + s, b = base + 1 + (k - 1) * SEG + (s + 1) % SEG, c = a + SEG, e = b + SEG;
      idxA.push(a, b, c, b, e, c);
    }
  }
  const waterGeo = new THREE.BufferGeometry();
  waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3));
  const waterColAttr = new THREE.Float32BufferAttribute(waterColA, 4);
  waterGeo.setAttribute('color', waterColAttr);
  waterGeo.setIndex(idxA); waterGeo.computeVertexNormals();
  const waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.1, metalness: 0.05,
    emissive: new THREE.Color(0x10283a), emissiveIntensity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const iceMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.35, metalness: 0.0,
    emissive: new THREE.Color(0x2a3a4a), emissiveIntensity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const water = new THREE.Mesh(waterGeo, waterMat); water.receiveShadow = true; water.renderOrder = 1; water.name = 'pond-water';
  group.add(water);

  // ── 흙둑: 물 가장자리를 지형까지 덮는 띠 (지형이 높은 쪽은 땅에 묻힌다) ──
  {
    const pos = [], col = [], idx = [];
    const mud = new THREE.Color(0x5a4128), mud2 = new THREE.Color(0x6d5236);
    for (const p of ponds) {
      const base = pos.length / 3;
      for (let s = 0; s < SEG; s++) {
        const a = s / SEG * Math.PI * 2, rr = p.r * wob(p, a), ca = Math.cos(a), sa = Math.sin(a);
        const pts = [[rr - 0.35, p.level - 0.03], [rr + 0.05, p.level + 0.07], [rr + 0.55, null]];
        for (const [r, y] of pts) {
          const x = p.x + ca * r, z = p.z + sa * r;
          pos.push(x, y ?? Math.min(groundY(x, z), p.level) - 0.06, z);
          _c.copy(mud).lerp(mud2, (Math.sin(s * 1.7) + 1) / 2); col.push(_c.r, _c.g, _c.b);
        }
      }
      for (let s = 0; s < SEG; s++) for (let j = 0; j < 2; j++) {
        const a = base + s * 3 + j, b = base + ((s + 1) % SEG) * 3 + j;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const bank = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }));
    bank.receiveShadow = true; bank.name = 'pond-bank';
    group.add(bank);
    group.userData.bankMat = bank.material;
  }

  const rand = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const m4 = new THREE.Matrix4(), _e = new THREE.Euler(), _s = new V();
  function instanced(geo, mat, list, name, shadow = true) {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    list.forEach((it, i) => {
      _q.setFromEuler(_e.set(it.rx || 0, it.ry || 0, it.rz || 0));
      m.setMatrixAt(i, m4.compose(_v.set(it.x, it.y, it.z), _q, _s.set(it.sx, it.sy ?? it.sx, it.sz ?? it.sx)));
      if (it.c) m.setColorAt(i, _c.set(it.c));
    });
    m.count = list.length; m.castShadow = shadow; m.receiveShadow = true; m.name = name;
    group.add(m); return m;
  }

  // ── 돌: 둑이 드러난 쪽은 촘촘히, 나머지는 드문드문 ──
  {
    const list = [];
    for (const p of ponds) for (let s = 0; s < 70; s++) {
      const a = s / 70 * Math.PI * 2 + rand() * 0.05, rr = p.r * wob(p, a) + 0.15 + rand() * 0.3;
      const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr;
      if (inDock(p, x, z, 0.5)) continue;
      const exposed = groundY(x, z) < p.level + 0.05;
      if (!exposed && rand() > 0.28) continue;
      const k = exposed ? 0.16 + rand() * 0.14 : 0.12 + rand() * 0.18;
      list.push({ x, y: Math.max(groundY(x, z), exposed ? p.level - 0.04 : -9) + k * 0.25, z, sx: k * 1.3, sy: k * 0.8, sz: k, ry: rand() * 6, rx: rand() * 0.4,
        c: [0x8a8478, 0x9b958a, 0x77736b, 0xa59f92][s % 4] });
    }
    const geo = new THREE.DodecahedronGeometry(1, 0);
    instanced(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), list, 'pond-stones');
  }

  // ── 갈대 (잎 3장 + 부들 이삭, 한 지오메트리) ──
  const mergeColored = parts => {
    const pos = [], nor = [], col = [];
    for (const [g, color] of parts) {
      const ng = g.index ? g.toNonIndexed() : g; ng.computeVertexNormals();
      const pa = ng.attributes.position, na = ng.attributes.normal; _c.set(color);
      for (let i = 0; i < pa.count; i++) { pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); nor.push(na.getX(i), na.getY(i), na.getZ(i)); col.push(_c.r, _c.g, _c.b); }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  };
  {
    const blade = (h, lean, rot) => { const g = new THREE.ConeGeometry(0.035, h, 3, 1); g.translate(0, h / 2, 0); g.rotateZ(lean); g.rotateY(rot); return g; };
    const head = new THREE.CylinderGeometry(0.045, 0.045, 0.22, 6); head.translate(0.0, 1.12, 0);
    const stem = new THREE.CylinderGeometry(0.012, 0.016, 1.3, 4); stem.translate(0, 0.65, 0);
    const reedGeo = mergeColored([[blade(1.0, 0.12, 0), 0x6f8a3a], [blade(0.85, -0.18, 1.9), 0x7d9842], [blade(0.7, 0.2, 4.1), 0x5f7a32], [stem, 0x7a7a3a], [head, 0x6a3f1e]]);
    const list = [];
    for (const p of ponds) for (let c = 0; c < 9; c++) {
      const a0 = rand() * Math.PI * 2;
      for (let k = 0; k < 6; k++) {
        const a = a0 + (rand() - 0.5) * 0.35, rr = p.r * wob(p, a) * (0.86 + rand() * 0.2);
        let x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr;
        // 실제 물가(지형이 물 높이에 닿는 곳) 쪽으로 당긴다
        for (let r = rr; r > 0.5; r -= 0.15) { const xx = p.x + Math.cos(a) * r, zz = p.z + Math.sin(a) * r; if (groundY(xx, zz) < p.level) { x = xx; z = zz; break; } }
        if (inDock(p, x, z, 0.4)) continue;
        const s = 0.75 + rand() * 0.55;
        list.push({ x, y: Math.min(groundY(x, z), p.level) - 0.05, z, sx: s, ry: rand() * 6, rz: (rand() - 0.5) * 0.15, c: 0xffffff });
      }
    }
    const reeds = instanced(reedGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), list, 'pond-reeds');
    group.userData.reeds = reeds;
  }

  // ── 연잎 · 연꽃 ──
  let lilies, flowers;
  {
    const pad = new THREE.CircleGeometry(0.32, 12, 0.35, Math.PI * 2 - 0.5); pad.rotateX(-Math.PI / 2);
    const list = [], fl = [];
    for (const p of ponds) for (let i = 0; i < 16; i++) {
      const a = rand() * Math.PI * 2, rr = (0.35 + rand() * 0.55) * p.r;
      const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr;
      if (p.level - groundY(x, z) < 0.08 || inDock(p, x, z, 0.6)) continue;
      // 선착장 앞 낚시 자리는 비워 둔다
      if (Math.hypot(x - p.dockEnd.x, z - p.dockEnd.z) < 1.8) continue;
      const s = 0.7 + rand() * 0.7;
      list.push({ x, y: p.level + 0.012, z, sx: s, ry: rand() * 6, c: [0x4f7d2e, 0x5f8f36, 0x46702a][i % 3] });
      if (rand() < 0.35) fl.push({ x: x + 0.05, y: p.level + 0.06, z: z + 0.04, sx: 0.09 * s + 0.04, ry: rand() * 6, c: rand() < 0.5 ? 0xf3b6c8 : 0xfbf3e8 });
    }
    lilies = instanced(pad, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }), list, 'pond-lilies', false);
    const petal = new THREE.ConeGeometry(1, 1.1, 6, 1, true); petal.rotateX(Math.PI);  petal.translate(0, 0.55, 0);
    flowers = instanced(petal, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0x3a1a22, emissiveIntensity: 0.3, side: THREE.DoubleSide }), fl, 'pond-flowers', false);
  }

  // ── 선착장 (판자 + 기둥, 한 메시) ──
  {
    const parts = [];
    for (const p of ponds) {
      const len = p.dockOut - p.dockIn, n = Math.max(6, Math.round(len / 0.24));
      const yaw = Math.atan2(p.dx, p.dz);          // 로컬 +Z 가 물가 쪽
      const place = (g, a, b, y) => { g.rotateY(yaw); g.translate(p.x + p.dx * a - p.dz * b, y, p.z + p.dz * a + p.dx * b); return g; };
      for (let i = 0; i < n; i++) {
        const a = p.dockIn + (i + 0.5) * len / n;
        const pl = new THREE.BoxGeometry(p.dockW + (i % 3 - 1) * 0.04, 0.06, len / n - 0.03);
        parts.push([place(pl, a, (i % 2 ? 0.02 : -0.02), p.deckY - 0.03), [0x8a5a32, 0x7a4e2a, 0x946338][i % 3]]);
      }
      for (const a of [p.dockIn + 0.12, (p.dockIn + p.dockOut) / 2, p.dockOut - 0.15]) for (const b of [-1, 1]) {
        const gy = Math.min(groundY(p.x + p.dx * a - p.dz * b * 0.5, p.z + p.dz * a + p.dx * b * 0.5), p.level);
        const h = p.deckY + 0.12 - (gy - 0.25);
        const post = new THREE.CylinderGeometry(0.07, 0.08, h, 6);
        parts.push([place(post, a, b * (p.dockW / 2 - 0.02), gy - 0.25 + h / 2), 0x4f3420]);
      }
      // 물가 쪽 끝에 낮은 계단 한 칸
      const step = new THREE.BoxGeometry(p.dockW * 0.9, 0.08, 0.35);
      parts.push([place(step, p.dockOut + 0.25, 0, (p.deckY + groundY(p.dockBase.x, p.dockBase.z)) / 2), 0x7a4e2a]);
      // 앉을 나무 통
      const bucket = new THREE.CylinderGeometry(0.16, 0.13, 0.26, 8);
      parts.push([place(bucket, p.dockIn + 0.9, p.dockW / 2 - 0.22, p.deckY + 0.13), 0x6b4a2a]);
    }
    const dock = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
    dock.castShadow = dock.receiveShadow = true; dock.name = 'pond-docks';
    group.add(dock);
  }

  /* 연못 안 풀(InstancedMesh) 을 숨긴다 — 물 위로 풀이 삐죽 나오지 않게 */
  if (hideGrass) {
    scene.traverse(o => {
      if (!o.isInstancedMesh || o.count < 3000 || o.parent === group) return;
      let n = 0; const e = o.instanceMatrix.array;
      for (let i = 0; i < o.count; i++) {
        const x = e[i * 16 + 12], z = e[i * 16 + 14];
        for (const p of ponds) {
          if (Math.abs(x - p.x) > p.r + 0.7 || Math.abs(z - p.z) > p.r + 0.7) continue;
          if (wetAt(p, x, z, 0.5) || inDock(p, x, z, 0.2)) { for (let k = 0; k < 16; k++) e[i * 16 + k] = 0; n++; break; }
        }
      }
      if (n) o.instanceMatrix.needsUpdate = true;
    });
  }

  /* ════════ 낚싯대 · 찌 · 줄 · 물결 ════════ */
  const rod = new THREE.Mesh(mergeColored([
    [new THREE.CylinderGeometry(0.007, 0.02, ROD_LEN - 0.4, 6).translate(0, 0.4 + (ROD_LEN - 0.4) / 2, 0), 0x6a4426],
    [new THREE.CylinderGeometry(0.028, 0.03, 0.42, 8).translate(0, 0.2, 0), 0xc89a62],
    [new THREE.CylinderGeometry(0.05, 0.05, 0.035, 10).rotateZ(Math.PI / 2).translate(-0.045, 0.45, 0), 0x3a2a1a],
    [new THREE.TorusGeometry(0.018, 0.005, 4, 8).translate(0, ROD_LEN - 0.02, 0), 0xd9d2c2],
    [new THREE.TorusGeometry(0.022, 0.005, 4, 8).translate(0, ROD_LEN * 0.6, 0), 0xd9d2c2],
  ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true }));
  rod.castShadow = true; rod.visible = false; rod.name = 'fishing-rod';
  scene.add(rod);

  const bobber = new THREE.Mesh(mergeColored([
    [new THREE.SphereGeometry(0.055, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xe0322a],
    [new THREE.SphereGeometry(0.055, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xf6f1e4],
    [new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4).translate(0, 0.08, 0), 0xe0322a],
  ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: 0x401010, emissiveIntensity: 0.4 }));
  bobber.visible = false; bobber.name = 'fishing-bobber';
  scene.add(bobber);

  const LINE_N = 18;
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_N * 3), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.75 }));
  line.frustumCulled = false; line.visible = false;
  scene.add(line);

  const hole = new THREE.Group();
  {
    const dark = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0e2a3c, roughness: 0.1, polygonOffset: true, polygonOffsetFactor: -4 }));
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 18).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4 }));
    hole.add(dark, rim); hole.visible = false;
    scene.add(hole);
  }

  const rippleGeo = new THREE.RingGeometry(0.86, 1, 28).rotateX(-Math.PI / 2);
  const ripples = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; m.renderOrder = 2; m.userData = { t: 0, life: 1, max: 1 };
    scene.add(m); return m;
  });
  let rippleI = 0;
  function ripple(x, y, z, size = 0.6, life = 1.1) {
    const m = ripples[rippleI++ % ripples.length];
    m.position.set(x, y + 0.015, z); m.visible = true;
    m.userData.t = 0; m.userData.life = life; m.userData.max = size;
    m.scale.setScalar(0.05);
  }
  function updateRipples(dt) {
    for (const m of ripples) {
      if (!m.visible) continue;
      const u = m.userData; u.t += dt;
      const k = u.t / u.life;
      if (k >= 1) { m.visible = false; continue; }
      m.scale.setScalar(0.05 + u.max * smooth(k));
      m.material.opacity = 0.55 * (1 - k);
    }
  }

  /* 낚은 물고기 3D (줄 끝에 매달려 파닥파닥) */
  let caughtMesh = null;
  function buildCaught(sp, cm) {
    if (caughtMesh) { scene.remove(caughtMesh); caughtMesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    const g = new THREE.Group();
    const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: sp.id === 'goldcarp' || sp.id === 'crown' ? 0.5 : 0.05, flatShading: true });
    if (sp.shape === 'boot') {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.32, 8), mat(sp.body)); leg.position.y = -0.18;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.26), mat(sp.body)); foot.position.set(0, -0.36, 0.06);
      g.add(leg, foot);
    } else if (sp.shape === 'crown') {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.13, 0.12, 10, 1, true), mat(sp.body)); band.material.side = THREE.DoubleSide; band.position.y = -0.14;
      g.add(band);
      for (let i = 0; i < 5; i++) {
        const sp2 = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 4), mat(sp.body));
        const a = i / 5 * Math.PI * 2; sp2.position.set(Math.cos(a) * 0.13, -0.04, Math.sin(a) * 0.13); g.add(sp2);
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.02), mat([0xd0333f, 0x3f7fd0, 0x2f9a5a][i % 3])); gem.position.set(Math.cos(a) * 0.142, -0.14, Math.sin(a) * 0.142); g.add(gem);
      }
    } else {
      const L = Math.max(0.16, Math.min(0.62, cm / 100 * 1.15));   // 작은 물고기는 살짝 크게
      const eel = sp.shape === 'eel';
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat(sp.body));
      body.scale.set(eel ? 0.05 : sp.shape === 'deep' ? L * 0.2 : L * 0.13, L / 2, eel ? 0.045 : L * 0.08);
      body.position.y = -L / 2;
      const tail = new THREE.Mesh(new THREE.ConeGeometry(L * 0.16, L * 0.22, 3), mat(sp.fin || sp.body));
      tail.scale.z = 0.25; tail.position.y = -L - L * 0.05; tail.rotation.x = Math.PI;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.012, L * 0.035), 6, 4), mat(0x111111));
      eye.position.set(L * 0.06, -L * 0.12, L * 0.06);
      const eye2 = eye.clone(); eye2.position.z *= -1;
      g.add(body, tail, eye, eye2);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(g); caughtMesh = g;
  }

  /* ════════ DOM ════════ */
  if (!document.getElementById('fs-css')) {
    const st = document.createElement('style'); st.id = 'fs-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const root = document.getElementById('drive-root') || document.body;
  const promptEl = document.createElement('button');
  promptEl.type = 'button'; promptEl.className = 'fs-prompt'; promptEl.hidden = true;
  const hud = document.createElement('div'); hud.className = 'fs-hud'; hud.hidden = true; hud.setAttribute('role', 'status');
  hud.innerHTML = `<div class="st" aria-live="polite"></div><div class="ks">
    <span><kbd>Space</kbd>/클릭 <b class="ac">던지기</b></span><span><kbd>F</kbd>/<kbd>Esc</kbd> 그만</span><span class="dex"></span>
    <button type="button" class="main cast">던지기</button><button type="button" class="quit">그만하기</button></div>`;
  const bang = document.createElement('div'); bang.className = 'fs-bang'; bang.hidden = true; bang.textContent = '!';
  const reel = document.createElement('div'); reel.className = 'fs-reel'; reel.hidden = true;
  reel.innerHTML = `<div class="tr"><div class="zn"></div><div class="fi">${FISH_ICON}</div></div><div class="pg"><i></i></div><div class="lb">Space · 클릭을 누르고 있으면 올라가요</div>`;
  const card = document.createElement('div'); card.className = 'fs-card'; card.setAttribute('role', 'status'); card.setAttribute('aria-live', 'polite');
  card.innerHTML = '<canvas width="440" height="220"></canvas><div class="tt"></div><div class="sz"></div><div><span class="rr"></span><span class="nw"></span></div><div class="fl"></div><div class="ct"></div>';
  const toast = document.createElement('div'); toast.className = 'fs-toast';
  root.append(promptEl, hud, bang, reel, card, toast);
  const hudSt = hud.querySelector('.st'), hudAc = hud.querySelector('.ac'), hudDex = hud.querySelector('.dex');
  const castBtn = hud.querySelector('.cast'), quitBtn = hud.querySelector('.quit');
  const zoneEl = reel.querySelector('.zn'), fishEl = reel.querySelector('.fi'), progEl = reel.querySelector('.pg i');
  const cardCv = card.querySelector('canvas');

  let toastT = 0;
  function say(msg, ms = 1600) {
    toast.textContent = msg; toast.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('on'), ms);
  }

  /* ════════ 도감 (localStorage) ════════ */
  let book = {};
  try { book = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch { book = {}; }
  const saveBook = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(book)); } catch { /* 저장 못 해도 게임은 된다 */ } };
  const dexCount = () => SPECIES.filter(s => book[s.id] && book[s.id].n > 0).length;
  let sessionCount = 0;
  const renderDex = () => { hudDex.textContent = `도감 ${dexCount()}/${SPECIES.length} · 오늘 ${sessionCount}마리`; };

  /* ════════ 상태 ════════ */
  const S = {
    phase: 'none', t: 0, pond: null, frozen: false,
    stand: new V(), from: new V(), yaw: 0, fromYaw: 0, onDock: false,
    target: new V(), castFrom: new V(), waitFor: 0, nibbles: 0, nibT: 0,
    sp: null, cm: 0, hold: false, reelZ: 0.1, reelV: 0, fishY: 0.5, fishV: 0, fishGoal: 0.5, fishT: 0, prog: 0.35,
    camInit: false, camPos: new V(), camLook: new V(), shake: 0, cardT: 0, candidate: null, lastOnFoot: false,
    jumpT: 3, actionDown: false,
  };
  const frozenNow = () => getSeason() === 'winter';

  function applySeason() {
    const fz = frozenNow();
    if (fz === S.frozen && water.userData.inited) return;
    water.userData.inited = true; S.frozen = fz;
    water.material = fz ? iceMat : waterMat;
    waterColAttr.array.set(fz ? iceColA : waterColA); waterColAttr.needsUpdate = true;
    lilies.visible = flowers.visible = !fz;
    group.userData.bankMat.color.set(fz ? 0xc9ccd4 : 0xffffff);
  }

  /* 사람이 서 있을 곳 찾기 */
  function findSpot(pos) {
    let best = null;
    for (const p of ponds) {
      const dd = Math.hypot(pos.x - p.dockBase.x, pos.z - p.dockBase.z);
      if (dd < DOCK_R && (!best || dd < best.score)) best = { pond: p, dock: true, score: dd };
      const sh = shoreInfo(p, pos.x, pos.z);
      if (sh && sh.dist < SHORE_R && sh.dist > -0.5) {
        const score = sh.dist + 0.8;   // 선착장이 조금 더 우선
        if (!best || score < best.score) best = { pond: p, dock: false, score, sh };
      }
    }
    return best;
  }

  function start(spot = S.candidate) {
    if (S.phase !== 'none' || !spot) return false;
    applySeason();
    const p = spot.pond;
    S.pond = p; S.onDock = spot.dock;
    S.from.copy(person.position); S.fromYaw = person.rotation.y;
    if (spot.dock) {
      S.stand.copy(p.dockEnd);
      S.yaw = Math.atan2(-p.dx, -p.dz);            // 물 쪽(중심 방향)
    } else {
      const sh = spot.sh;
      const r = sh.edge + 0.55;
      S.stand.set(p.x + sh.ux * r, 0, p.z + sh.uz * r);
      S.stand.y = groundY(S.stand.x, S.stand.z);
      S.yaw = Math.atan2(-sh.ux, -sh.uz);
    }
    // 던질 곳: 바라보는 방향으로 물이 이어지는 가장 먼 곳 (최대 4.2 m)
    const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
    let far = 0;
    for (let d = 0.8; d <= 4.6; d += 0.1) {
      const x = S.stand.x + fx * d, z = S.stand.z + fz * d;
      if (wetAt(p, x, z) && p.level - groundY(x, z) > 0.06 && Math.hypot(x - p.x, z - p.z) < p.r * 0.92) far = d; else if (far) break;
    }
    if (far < 1.2) { S.target.set(p.x, p.level, p.z); } else S.target.set(S.stand.x + fx * (far - 0.35), p.level, S.stand.z + fz * (far - 0.35));
    S.camInit = false;
    setPhase('enter');
    promptEl.hidden = true; hud.hidden = false; renderDex();
    rod.visible = true;
    if (onStart) onStart();
    poser.ensure(1);
    if (poser.rig) poser.save();
    return true;
  }
  function stop() {
    if (S.phase === 'none' || S.phase === 'leave') return;
    endReel();
    bobber.visible = line.visible = hole.visible = false; bang.hidden = true;
    if (caughtMesh) caughtMesh.visible = false;
    card.classList.remove('on');
    setPhase('leave');
  }
  function finish() {
    rod.visible = false; hud.hidden = true; reel.hidden = true; bang.hidden = true;
    if (poser.rig) poser.restore();
    const back = S.onDock ? S.pond.dockBase : S.stand;
    person.position.set(back.x, groundY(back.x, back.z), back.z);
    const h = S.yaw;
    S.phase = 'none'; S.pond = null;
    if (onStop) onStop(S.onDock ? h + Math.PI : h);   // 선착장에서 나오면 뭍을 본다
  }
  function setPhase(ph) {
    S.phase = ph; S.t = 0;
    const lab = {
      enter: '자리 잡는 중…', cast: S.frozen ? '얼음 구멍에 낚싯줄을 내린다' : '휘익— 던졌다!', wait: S.frozen ? '얼음낚시: 찌를 지켜보자' : '찌를 지켜보자…',
      nibble: '톡… 톡… 뭔가 건드린다!', bite: '지금이야! F · Space · 클릭!', reel: '당겨라! Space · 클릭을 누르고 있으면 올라가요',
      catch: '낚았다!', ready: '다시 던지려면 Space · 클릭', leave: '',
    }[ph];
    if (lab !== undefined) hudSt.textContent = lab;
    hudAc.textContent = ph === 'reel' ? '누르고 있기' : ph === 'bite' || ph === 'nibble' || ph === 'wait' ? '챔질' : '던지기';
    castBtn.textContent = ph === 'reel' ? '당기기' : ph === 'bite' || ph === 'nibble' || ph === 'wait' ? '챔질' : '던지기';
  }

  function cast() {
    if (!S.pond) return;
    bobber.visible = true; line.visible = true;
    if (caughtMesh) caughtMesh.visible = false;
    card.classList.remove('on');
    hole.visible = false;
    setPhase('cast');
  }
  function pickSpecies() {
    const winter = S.frozen;
    const list = SPECIES.map(s => ({ s, w: winter ? (s.winterW ?? s.w * (s.id === 'boot' ? 0.4 : 0.45)) : s.w }));
    let tot = 0; for (const e of list) tot += e.w;
    let r = Math.random() * tot;
    for (const e of list) { r -= e.w; if (r <= 0) return e.s; }
    return list[0].s;
  }
  function hook() {
    S.sp = pickSpecies();
    const [a, b] = S.sp.cm || [0, 0];
    S.cm = S.sp.cm ? Math.round(a + (b - a) * Math.pow(Math.random(), 1.6)) : 0;   // 큰 놈은 드물다
    bang.hidden = true;
    S.prog = 0.3; S.reelZ = 0.05; S.reelV = 0; S.fishY = 0.3 + Math.random() * 0.4; S.fishV = 0; S.fishGoal = S.fishY; S.fishT = 0;
    reel.hidden = false;
    S.shake = 0.4;
    ripple(bobber.position.x, S.pond.level, bobber.position.z, 0.9, 0.7);
    setPhase('reel');
  }
  function endReel() { reel.hidden = true; S.hold = false; }

  function landCatch() {
    endReel();
    const sp = S.sp;
    const e = book[sp.id] || { n: 0, best: 0 };
    const first = e.n === 0, best = sp.cm && S.cm > (e.best || 0);
    e.n++; if (sp.cm) e.best = Math.max(e.best || 0, S.cm);
    book[sp.id] = e; saveBook(); sessionCount++;
    // 카드
    drawCatch(cardCv, sp);
    card.querySelector('.tt').textContent = `${sp.name}${objJosa(sp.name)} 낚았다!`;
    card.querySelector('.sz').textContent = sp.cm ? `${S.cm}cm` + (e.best && !best ? ` · 최고 기록 ${e.best}cm` : '') : (sp.id === 'crown' ? '반짝반짝 · 값을 매길 수 없음' : '크기 — 신발 사이즈 270');
    const rr = card.querySelector('.rr'); rr.textContent = RARE[sp.rare].label; rr.style.background = RARE[sp.rare].color;
    card.querySelector('.nw').textContent = first ? '도감 새로 등록!' : best ? '새 기록!' : '';
    card.querySelector('.fl').textContent = FLAVOR[sp.id] || (S.cm >= (sp.cm ? sp.cm[0] + (sp.cm[1] - sp.cm[0]) * 0.75 : 1e9) ? '꽤 큰 놈이다!' : '손맛 좋다!');
    card.querySelector('.ct').textContent = `도감 ${dexCount()}/${SPECIES.length} · 오늘 ${sessionCount}마리`;
    card.classList.add('on'); S.cardT = 3.6;
    renderDex();
    buildCaught(sp, S.cm);
    ripple(bobber.position.x, S.pond.level, bobber.position.z, 1.1, 0.9);
    bobber.visible = false;
    setPhase('catch');
  }
  function lose(msg) {
    endReel(); bang.hidden = true;
    say(msg, 1800);
    bobber.visible = false;
    setPhase('ready');
    hudSt.textContent = '다시 던지려면 Space · 클릭';
  }

  /* 행동 키 (Space · 클릭 · F) */
  function action() {
    switch (S.phase) {
      case 'ready': cast(); return true;
      case 'catch': if (S.t > 0.5) { cast(); } return true;
      case 'wait': lose('찌가 아직 조용한데… 다시 던지자.'); return true;
      case 'nibble': lose('너무 빨랐다! 물고기가 놀라서 도망갔다.'); return true;
      case 'bite': hook(); return true;
      default: return false;
    }
  }
  function onF() {
    if (S.phase === 'none') {
      if (!S.candidate || !S.lastOnFoot || blocked()) return false;
      return start(S.candidate);
    }
    if (S.phase === 'bite') { hook(); return true; }
    if (S.phase === 'reel' || S.phase === 'enter' || S.phase === 'leave') return true;
    stop(); return true;
  }

  const typing = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  const onKeyDown = e => {
    if (S.phase === 'none' || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (e.code === 'Space') {
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) { S.hold = true; action(); }
    } else if (e.code === 'Escape') { if (S.phase !== 'reel') stop(); }
  };
  const onKeyUp = e => { if (e.code === 'Space') S.hold = false; };
  addEventListener('keydown', onKeyDown, true);
  addEventListener('keyup', onKeyUp, true);
  const pdTarget = domElement || window;
  const onPointerDown = e => {
    if (S.phase === 'none' || e.button > 0) return;
    if (!domElement && e.target && e.target.closest && e.target.closest('button,a,.fs-hud,.fs-card,input')) return;
    S.hold = true; action();
  };
  const onPointerUp = () => { S.hold = false; };
  pdTarget.addEventListener('pointerdown', onPointerDown);
  reel.addEventListener('pointerdown', e => { e.preventDefault(); S.hold = true; });
  addEventListener('pointerup', onPointerUp); addEventListener('pointercancel', onPointerUp);
  addEventListener('blur', onPointerUp);
  promptEl.addEventListener('click', e => { if (S.candidate) start(S.candidate); if (e.detail > 0) promptEl.blur(); });
  castBtn.addEventListener('click', e => { if (S.phase === 'reel') return; action(); if (e.detail > 0) castBtn.blur(); });
  castBtn.addEventListener('pointerdown', e => { if (S.phase === 'reel') { e.preventDefault(); S.hold = true; } });
  quitBtn.addEventListener('click', e => { if (S.phase !== 'reel') stop(); if (e.detail > 0) quitBtn.blur(); });
  card.addEventListener('click', () => card.classList.remove('on'));

  /* ════════ 자세 · 낚싯대 ════════ */
  const rodDir = new V(), rodButt = new V(), rodTip = new V(), grip = new V();
  function rodPose(dt) {
    // 낚싯대 각도(사람 공간): pitch 위로, yaw 왼쪽 +
    let pitch = 34, yaw = 0, lift = 0;
    const t = S.t;
    switch (S.phase) {
      case 'enter': pitch = 20 + 14 * smooth(clamp01(t / 0.6)); break;
      case 'cast': {
        if (t < 0.32) { pitch = 34 + 80 * smooth(t / 0.32); lift = 0.18 * smooth(t / 0.32); }
        else if (t < 0.5) { const k = smooth((t - 0.32) / 0.18); pitch = 114 - 100 * k; lift = 0.18 * (1 - k); }
        else pitch = 14 + 20 * smooth(clamp01((t - 0.5) / 0.6));
        break;
      }
      case 'wait': pitch = 34 + Math.sin(performance.now() / 900) * 1.5; break;
      case 'nibble': pitch = 32 + (S.nibT > 0 ? -2 : 0); break;
      case 'bite': pitch = 26; break;
      case 'reel': {
        const pull = S.hold ? 1 : 0;
        pitch = 52 + pull * 14 + Math.sin(performance.now() / 70) * (2 + S.shake * 6);
        yaw = (S.fishY - 0.5) * -22 + Math.sin(performance.now() / 300) * 4;
        lift = 0.06 + pull * 0.06;
        break;
      }
      case 'catch': pitch = 62 + 6 * Math.sin(Math.min(1, t / 0.4) * Math.PI); lift = 0.12; yaw = -38 * smooth(clamp01(t / 0.6)); break;   // 카메라 쪽(오른쪽)으로 들어 보인다
      case 'ready': pitch = 40; break;
      case 'leave': pitch = 34 - 20 * smooth(clamp01(t / 0.5)); break;
    }
    // 사람 공간 방향 (+X 왼쪽, +Z 앞)
    const cp = Math.cos(pitch * D2R);
    poser.dir(rodDir, Math.sin(yaw * D2R) * cp, Math.sin(pitch * D2R), Math.cos(yaw * D2R) * cp).normalize();
    const r = poser.rig;
    if (r) poser.rel(grip, r.hips, -0.13, 0.14 + lift, 0.3);
    else poser.pt(grip, -0.2, 1.0 + lift, 0.3);
    rodButt.copy(grip).addScaledVector(rodDir, -GRIP_AT);
    rodTip.copy(rodButt).addScaledVector(rodDir, ROD_LEN);
    // 줄이 당기면 끝이 살짝 휜다 → 끝을 아래로
    if (S.phase === 'reel') rodTip.y -= 0.12 + (S.hold ? 0.08 : 0);
    rod.position.copy(rodButt);
    _d.subVectors(rodTip, rodButt).normalize();
    rod.quaternion.setFromUnitVectors(UP, _d);
    void dt;
  }
  function poseBody() {
    const r = poser.rig;
    if (!r) return;
    poser.baseIdle();
    poser.rotXYZ(r.chest, S.phase === 'reel' ? -6 : 6, S.phase === 'reel' ? (S.fishY - 0.5) * -10 : 0, 0);
    // 오른손: 손잡이 / 왼손: 손잡이 뒤쪽 끝
    _tgt.copy(grip);
    poser.rel(_pole, r.armR[0], -0.6, -0.8, -0.2);
    poser.ik(-1, _tgt, _pole);
    _tgt.copy(grip).addScaledVector(rodDir, -0.22); poser.dir(_v3, 0.05, 0, 0); _tgt.add(_v3);
    poser.rel(_pole, r.armL[0], 0.6, -0.8, -0.2);
    poser.ik(1, _tgt, _pole);
  }

  /* 줄: 낚싯대 끝 → 찌(또는 물고기), 느슨하면 아래로 처진다 */
  function updateLine(end, slack) {
    const a = line.geometry.attributes.position;
    const dist = rodTip.distanceTo(end);
    for (let i = 0; i < LINE_N; i++) {
      const s = i / (LINE_N - 1);
      _v.lerpVectors(rodTip, end, s);
      _v.y -= Math.sin(Math.PI * s) * dist * 0.18 * slack;
      a.setXYZ(i, _v.x, _v.y, _v.z);
    }
    a.needsUpdate = true;
  }

  /* ════════ 매 프레임 ════════ */
  const _proj = new V();
  function screenAt(el, p, dy = 0) {
    _proj.copy(p); _proj.y += dy; _proj.project(camera);
    const vis = _proj.z < 1 && Math.abs(_proj.x) < 1.2 && Math.abs(_proj.y) < 1.2;
    el.hidden = !vis;
    if (vis) { el.style.left = ((_proj.x * 0.5 + 0.5) * innerWidth) + 'px'; el.style.top = ((-_proj.y * 0.5 + 0.5) * innerHeight) + 'px'; }
  }

  function update(dt, inp) {
    dt = Math.min(dt, 0.1);
    const onFoot = !inp || inp.onFoot !== false;
    S.lastOnFoot = onFoot;
    poser.ensure(dt);
    applySeason();
    updateRipples(dt);

    // 물고기가 가끔 수면에서 튀어 물결 (가까운 연못만, 얼지 않았을 때)
    S.jumpT -= dt;
    if (S.jumpT <= 0) {
      S.jumpT = 2.5 + Math.random() * 4;
      if (!S.frozen) {
        const me = person.position;
        const p = ponds.find(p => Math.hypot(me.x - p.x, me.z - p.z) < 28);
        if (p) for (let k = 0; k < 6; k++) {
          const a = Math.random() * 6.28, rr = Math.random() * p.r * 0.8, x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr;
          if (p.level - groundY(x, z) > 0.1) { ripple(x, p.level, z, 0.5 + Math.random() * 0.4, 1.3); break; }
        }
      }
    }

    if (S.phase === 'none') {
      const show = onFoot && person.visible && !blocked();
      S.candidate = show ? findSpot(person.position) : null;
      if (S.candidate) {
        const p = S.candidate.pond;
        promptEl.innerHTML = `<kbd>F</kbd><span>${frozenNow() ? '얼음낚시' : '낚시하기'}</span><small>${p.name}</small>`;
        _v.copy(person.position); _v.y += 2.1;
        screenAt(promptEl, _v);
      } else promptEl.hidden = true;
      return;
    }

    if (!onFoot) { stop(); finish(); return; }
    S.t += dt;
    S.shake = Math.max(0, S.shake - dt * 1.5);

    // 걸으려고 하면 그만둔다
    if (inp && inp.keys && S.t > 0.4 && S.phase !== 'reel' && S.phase !== 'enter' && S.phase !== 'leave') {
      const k = inp.keys; if (k.fwd || k.back || k.left || k.right) stop();
    }

    // ── 위치 ──
    if (S.phase === 'enter') {
      const e = smooth(clamp01(S.t / 0.7));
      person.position.lerpVectors(S.from, S.stand, e);
      if (S.onDock) person.position.y = Math.max(groundY(person.position.x, person.position.z), S.stand.y * e + S.from.y * (1 - e));
      person.position.y += Math.abs(Math.sin(S.t * 14)) * 0.04 * (1 - e);
      person.rotation.set(0, S.fromYaw + Math.atan2(Math.sin(S.yaw - S.fromYaw), Math.cos(S.yaw - S.fromYaw)) * e, 0);
      if (S.t >= 0.7) cast();
    } else if (S.phase === 'leave') {
      const back = S.onDock ? S.pond.dockBase : S.stand;
      const e = smooth(clamp01(S.t / 0.5));
      person.position.lerpVectors(S.stand, back, e);
      if (S.onDock) person.position.y = S.stand.y + (groundY(back.x, back.z) - S.stand.y) * e;
    } else {
      person.position.copy(S.stand);
      person.rotation.set(0, S.yaw, 0);
    }
    person.updateMatrixWorld();
    poser.frame();
    rodPose(dt);
    poseBody();
    if (poser.rig) { person.updateMatrixWorld(true); poser.placeFeet && poser.placeFeet(); }

    const p = S.pond, L = p.level;
    // ── 단계별 ──
    switch (S.phase) {
      case 'cast': {
        if (S.t < 0.45) { bobber.position.copy(rodTip); updateLine(bobber.position, 0); }
        else {
          if (S.t - dt < 0.45) S.castFrom.copy(rodTip);
          const k = clamp01((S.t - 0.45) / 0.65);
          bobber.position.lerpVectors(S.castFrom, S.target, k);
          bobber.position.y = S.castFrom.y + (L + 0.02 - S.castFrom.y) * k + Math.sin(Math.PI * k) * 1.4;
          updateLine(bobber.position, 0.15);
          if (k >= 1) {
            bobber.position.set(S.target.x, L + 0.02, S.target.z);
            if (S.frozen) { hole.visible = true; hole.position.set(S.target.x, L + 0.004, S.target.z); }
            ripple(S.target.x, L, S.target.z, 0.7, 1.0);
            S.waitFor = 2 + Math.random() * 5 + (S.frozen ? 1 : 0); S.nibbles = 1 + (Math.random() * 3 | 0);
            setPhase('wait');
          }
        }
        break;
      }
      case 'wait': case 'nibble': case 'bite': {
        const bob = Math.sin(S.t * 2.4) * 0.008;
        let y = L + 0.02 + bob, x = S.target.x, z = S.target.z;
        if (S.phase === 'wait' && S.t >= S.waitFor) { setPhase('nibble'); S.nibT = 0; }
        if (S.phase === 'nibble') {
          // 톡 톡 (짧게 살짝 잠겼다 올라온다)
          const period = 0.42, k = S.t % period;
          if (k < 0.12) y -= Math.sin(k / 0.12 * Math.PI) * 0.035;
          if (k < dt * 1.5 && S.t > 0.05) ripple(x, L, z, 0.25, 0.6);
          S.nibT = k < 0.12 ? 1 : 0;
          if (S.t >= S.nibbles * period + 0.2) { setPhase('bite'); bang.hidden = false; ripple(x, L, z, 0.6, 0.7); S.shake = 0.15; }
        }
        if (S.phase === 'bite') {
          y = L + 0.02 - 0.09 * smooth(clamp01(S.t / 0.12)) + Math.sin(S.t * 30) * 0.01;
          x += Math.sin(S.t * 9) * 0.04;
          screenAt(bang, bobber.position, 0.35);
          if (S.t > BITE_WIN) lose('놓쳤다… 미끼만 먹고 도망갔다.');
        }
        bobber.position.set(x, y, z);
        updateLine(bobber.position, 1);
        break;
      }
      case 'reel': stepReel(dt); break;
      case 'catch': {
        // 물고기를 들어 올려 낚싯대 끝에 매단다
        const k = smooth(clamp01(S.t / 0.5));
        if (caughtMesh) {
          caughtMesh.visible = true;
          _v.set(rodTip.x, rodTip.y - 0.55, rodTip.z);
          _v2.copy(S.target); _v2.y = L;
          caughtMesh.position.lerpVectors(_v2, _v, k);
          caughtMesh.rotation.set(Math.sin(S.t * 13) * 0.35 * (1 - Math.min(1, S.t / 2.5)), S.t * 1.2, Math.sin(S.t * 9) * 0.25);
          updateLine(caughtMesh.position, 0);
        }
        S.cardT -= dt;
        if (S.cardT <= 0 && card.classList.contains('on')) card.classList.remove('on');
        if (S.t > 2.6) { if (caughtMesh) caughtMesh.visible = false; line.visible = false; setPhase('ready'); }
        break;
      }
      case 'ready': line.visible = false; break;
      case 'leave': if (S.t >= 0.5) finish(); break;
    }
    if (S.phase !== 'bite') bang.hidden = true;
  }

  /* 손맛 게임 */
  function stepReel(dt) {
    const sp = S.sp, diff = sp.diff;
    const zoneH = 0.34 - diff * 0.12;
    // 초록 칸: 누르면 위로, 떼면 아래로
    S.reelV += (S.hold ? 2.9 : -2.4) * dt;
    S.reelV *= Math.pow(0.35, dt);
    S.reelZ += S.reelV * dt;
    if (S.reelZ < 0) { S.reelZ = 0; S.reelV = Math.abs(S.reelV) * 0.3; }
    if (S.reelZ > 1 - zoneH) { S.reelZ = 1 - zoneH; S.reelV = -Math.abs(S.reelV) * 0.3; }
    // 물고기: 가끔 새 목표로 휙
    S.fishT -= dt;
    if (S.fishT <= 0) {
      S.fishT = 0.35 + Math.random() * (1.3 - diff * 0.8);
      const jump = 0.2 + diff * 0.6;
      S.fishGoal = clamp01(S.fishY + (Math.random() * 2 - 1) * jump);
    }
    const acc = (S.fishGoal - S.fishY) * (6 + diff * 18) - S.fishV * (4 - diff * 1.5);
    S.fishV += acc * dt; S.fishY = clamp01(S.fishY + S.fishV * dt);
    const inZone = S.fishY >= S.reelZ - 0.02 && S.fishY <= S.reelZ + zoneH + 0.02;
    S.prog += (inZone ? 0.36 - diff * 0.08 : -(0.2 + diff * 0.1)) * dt;
    if (S.sp.id === 'boot') S.prog += 0.12 * dt;
    // 화면
    zoneEl.style.height = (zoneH * 100) + '%';
    zoneEl.style.bottom = (S.reelZ * 100) + '%';
    zoneEl.classList.toggle('on', inZone);
    fishEl.style.top = ((1 - S.fishY) * 100) + '%';
    fishEl.style.transform = `rotate(${Math.max(-30, Math.min(30, -S.fishV * 30))}deg)`;
    progEl.style.height = (clamp01(S.prog) * 100) + '%';
    // 물속 찌(물고기)가 이리저리
    const p = S.pond, L = p.level;
    const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), rx = -fz, rz = fx;
    const pullIn = clamp01(S.prog) * 0.5;
    bobber.position.set(
      S.target.x - fx * pullIn + rx * (S.fishY - 0.5) * 1.4,
      L - 0.02 + Math.sin(S.t * 18) * 0.015,
      S.target.z - fz * pullIn + rz * (S.fishY - 0.5) * 1.4);
    if (!S.frozen && Math.random() < dt * 5) ripple(bobber.position.x, L, bobber.position.z, 0.35 + Math.random() * 0.3, 0.6);
    updateLine(bobber.position, 0.02);
    if (S.prog >= 1) landCatch();
    else if (S.prog <= 0) lose(S.sp.rare === 'legend' ? '무언가 반짝이는 게 도망갔다…!' : '줄이 풀렸다! 물고기가 도망갔다.');
  }

  /* 카메라: 사람 오른쪽 뒤 높이에서 찌 쪽을 내려다본다 */
  function cameraStep(cam, dt, fallback) {
    const active = S.phase !== 'none' && S.pond && !(S.phase === 'leave' && S.t > 0.35);
    if (!active) { S.camInit = false; if (fallback) fallback(dt); return false; }
    const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), rx = -fz, rz = fx;
    const st = S.stand, L = S.pond.level;
    const reeling = S.phase === 'reel';
    _v.set(st.x - fx * 3.3 + rx * 1.25, Math.max(st.y, L) + 2.1, st.z - fz * 3.3 + rz * 1.25);
    _v2.set(st.x + fx * 3.0, L + 0.5, st.z + fz * 3.0);
    if (reeling || S.phase === 'wait' || S.phase === 'nibble' || S.phase === 'bite') _v2.lerp(_v3.set(S.target.x, L + 0.3, S.target.z), 0.35);
    if (S.phase === 'catch') _v2.lerp(_v3.set(rodTip.x, rodTip.y - 0.5, rodTip.z), 0.45);
    if (!S.camInit) { S.camPos.copy(cam.position); cam.getWorldDirection(_v3); S.camLook.copy(cam.position).addScaledVector(_v3, 6); S.camInit = true; }
    const k = 1 - Math.exp(-dt * 3.2);
    S.camPos.lerp(_v, k); S.camLook.lerp(_v2, k);
    cam.position.copy(S.camPos);
    if (S.shake > 0 && !reduceMQ.matches) { cam.position.x += (Math.random() - 0.5) * S.shake * 0.08; cam.position.y += (Math.random() - 0.5) * S.shake * 0.06; }
    cam.lookAt(S.camLook);
    return true;
  }

  return {
    get active() { return S.phase !== 'none'; },
    get phase() { return S.phase; },
    get frozen() { return S.frozen; },
    get candidate() { return S.candidate; },
    ponds, group,
    nearSpot() { return !!S.candidate; },
    onF, start, stop, update, cameraStep, blocks, pushOut,
    log() { return JSON.parse(JSON.stringify(book)); },
    resetLog() { book = {}; saveBook(); renderDex(); },
    /* 디버그: 기다리지 않고 바로 입질 */
    debugBite() { if (S.phase === 'wait' || S.phase === 'ready' || S.phase === 'catch') { if (S.phase !== 'wait') { cast(); S.t = 2; } S.waitFor = 0; } },
    debugCatch(id) { const sp = SPECIES.find(s => s.id === id); if (!sp || !S.pond) return false; S.sp = sp; S.cm = sp.cm ? sp.cm[1] : 0; landCatch(); return true; },
    dispose() {
      if (S.phase !== 'none') { stop(); finish(); }
      removeEventListener('keydown', onKeyDown, true); removeEventListener('keyup', onKeyUp, true);
      pdTarget.removeEventListener('pointerdown', onPointerDown);
      removeEventListener('pointerup', onPointerUp); removeEventListener('pointercancel', onPointerUp); removeEventListener('blur', onPointerUp);
      promptEl.remove(); hud.remove(); bang.remove(); reel.remove(); card.remove(); toast.remove();
      for (const o of [group, rod, bobber, line, hole, ...ripples]) scene.remove(o);
      if (caughtMesh) scene.remove(caughtMesh);
    },
  };
}
