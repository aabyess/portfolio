/* ════════════════════════════════════════════════════════════════════
   minimap.js — 상호랜드 양피지 지도 (작은 미니맵 + M 키 큰 지도)
     작은 지도: 오른쪽 위(상단 바 바로 아래) 둥근 양피지 160 px. 휴대폰 폭(≤820px)에선 오른쪽 아래(세로 무기 단축 바 왼쪽, 터치 버튼 위) 112 px.
       기본은 카메라가 보는 쪽이 위(회전). 지도를 누르면 북쪽 고정 ↔ 회전 (기억한다). 아래 "M 지도" 꼬리표 = 큰 지도.
     큰 지도: M(또는 꼬리표)으로 열고 M·Esc·✕·바깥 클릭으로 닫는다. 이름표(상호성, 선술집, 의뢰 게시판, 물약 가게, 연못,
       풍차 마을, 활터, 창시합장…)와 범례, "지금 열리는 행사" 목록.
     그리기: 땅·길·시냇물·다리·연못·성·마을 소품·나무 무늬는 처음 한 번 큰 캔버스에 그려 둔다(정적 층).
       움직이는 표시(나, 세워 둔 탈것, 선술집, 행사, 의뢰 목표, 임금님, 도둑, 사람·동물 점)는 초당 약 18번만 다시 그린다.
     문서 뷰(body[data-view="doc"])·인트로(body.intro-on)·대화/낚시/가게 중(body.talking)에는 숨긴다.

   ── portfolio.js 연결 (연결 담당) ──
     ① 위쪽 let 묶음(castle, animals, quests, kids, shop 줄)에:   let minimap = null;
     ② shop 블록(createShop) 다음, rides·car 가 준비된 뒤:
        {
          const { createMinimap } = await import('./minimap.js');
          minimap = createMinimap({
            THREE, pathX, world: WORLD, camera,
            bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
            getPlayerPos: () => activePos(),
            getPlayerHeading: () => (player.mode === 'onfoot' ? pHeading : heading),
            getRidePos: () => (player.mode === 'onfoot' ? car.position : null),
            stations,
            getPonds: () => (fishing && fishing.ponds) || null,
            castle,
            vprops,
            getFestival: () => festival, getPageant: () => pageant, getShop: () => shop,
            getQuests: () => quests, getVillage: () => village,
            getNpcs: () => npcs, getAnimals: () => animals,
            isActive: () => driveActive,
          });
        }
     ③ step(dt) 맨 끝 쪽 (kids.update 다음):   if (minimap) minimap.update(dt);
     ④ keydown — panelOpen() 검사 바로 다음 줄 (게시판·가게 창이 열려 있으면 그 모듈들이 캡처 단계에서 키를 삼킨다):
          if (e.code === 'KeyM' && !e.repeat && minimap) { e.preventDefault(); minimap.toggleBig(); return; }
        (큰 지도가 열려 있을 때의 M·Esc 는 이 모듈이 캡처 단계에서 직접 받아 닫는다.)
     (선택) 퀘스트 목표 표시: quests.js 반환 api 에  target: () => (active ? safe(() => Q[active.id].target(active.d)) : null)
        를 더하면 ?test 가 아니어도 노란 별이 뜬다(지금은 __quests.target 이 있을 때만).

   ── 옵션 (모두 선택, 없으면 건너뜀) ──
     THREE, pathX(z), world(autumn-world.json), camera(카메라 방향으로 회전), bounds{minX,maxX,minZ,maxZ}
     getPlayerPos() → {x,z}, getPlayerHeading() → rad (앞 = (sin h, cos h)), getCameraYaw() → rad (camera 보다 우선)
     getRidePos() → {x,z}|null (세워 둔 탈것), stations([{pos:[x,z], name, color, style}])
     getPonds() → [{x,z,r,name}], castle(castle.js 반환값 — gates[0]), vprops(village-props 반환값 — items)
     getFestival/getPageant/getShop/getQuests/getVillage/getNpcs/getAnimals → 각 모듈 반환값
     getQuestTarget() → {x,z}|null (quests.target 대신), isActive() → false 면 그리지 않는다
   ── 반환 ──  { update(dt), toggleBig(force?), setNorthUp(bool), dispose(), get bigOpen, el }
   콘솔(?test): __minimap.toggleBig(), __minimap.setNorthUp(true), __minimap.state()
   ════════════════════════════════════════════════════════════════════ */

const TAU = Math.PI * 2;
const STORE_KEY = 'sangholand-minimap-v1';
const HZ_DRAW = 18;                    // 초당 다시 그리는 횟수
const RES = 7;                         // 정적 층: 1 m 당 픽셀
const EXT = { x0: -47, x1: 47, z0: -100, z1: 89 };   // 정적 층 범위 (성 본채가 맵 북쪽 밖까지 보이게)

/* 다른 모듈과 같은 자리 (모듈을 못 받았을 때의 기본값) */
const DEF_PONDS = [
  { name: '출발 연못', x: 10, z: 76, r: 4.6 }, { name: '마을 연못', x: 8, z: 10, r: 4.6 }, { name: '숲속 연못', x: 19, z: -54, r: 4.6 },
];
const DEF_FEST = {
  joust: { x: 27, z: 2, z0: -8, z1: 12, name: '마상 창시합장' },
  archery: { lineX: 19, tx: 35, tz: [63, 67, 71], x: 27, z: 67, name: '활터' },
  green: { x: -19, z: 47, name: '마을 광장' },
};
const DEF_PAGEANT = {
  feast: { x: 20, z: 48 }, wedding: { x: -15.5, z: 50 }, lanterns: { x: null, z: -36.4 },
  trebuchet: { x: 28, z: -15 }, tug: { x: -30, z: 69 },
};
const DEF_HUT = { x: 21, z: -24 };
const BOOTH_KO = { tudor: '튜더 선술집', norse: '바이킹 주막', bavarian: '바이에른 맥줏집', venta: '벤타 주막',
  tent: '천막 주점', flemish: '플랑드르 주점', osteria: '오스테리아' };
const HAMLET_KO = { A: '우물 마을', F: '풍차 마을', B: '분수 마을' };
const HAMLET_DEF = { A: { x: -19, z: 23 }, F: { x: 21, z: 25 }, B: { x: -14, z: -56 } };
const FEST_KO = { joust: '마상 창시합', archery: '활쏘기 대회', bonfire: '수확 모닥불', maypole: '메이폴 춤', performers: '거리 광대', dragon: '용이 나타났다!' };
const PAGE_KO = { feast: '왕실 연회', wedding: '결혼식 행렬', lanterns: '소원 등불', trebuchet: '투석기 시연', tug: '줄다리기' };
/* 성(castle.js SOLIDS 를 지도용으로 줄인 것, 성문 로컬 좌표 · -z 가 성 안쪽) */
const CASTLE_SHAPES = [
  ['r', 0, -13.5, 7.4, 5.4, 'keep'], ['r', 0, -17.2, 16.5, 1.0], ['r', -16.5, -10.15, 1.0, 7.0], ['r', 16.5, -10.15, 1.0, 7.0],
  ['r', -11.2, -1.55, 3.8, 1.15], ['r', 11.2, -1.55, 3.8, 1.15], ['r', -3.1, -3.5, 0.8, 3.5], ['r', 3.1, -3.5, 0.8, 3.5],
  ['r', -16.5, -1.55, 1.6, 1.6, 'tower'], ['r', 16.5, -1.55, 1.6, 1.6, 'tower'], ['c', -5.45, -0.55, 2.85, 0, 'tower'], ['c', 5.45, -0.55, 2.85, 0, 'tower'],
  ['r', -16.5, -17.2, 1.7, 1.7, 'tower'], ['r', 16.5, -17.2, 1.7, 1.7, 'tower'],
];

const C = {
  paper: '#ecdcb0', paperD: '#d9c38e', edge: '#c9ae74', ink: '#3b2412', inkS: '#6b4423',
  water: '#8db4b8', waterD: '#557f88', road: '#c79f63', roadD: '#8a6738', tree: '#8d9450', treeD: '#545a2a',
  roof: '#a9573a', roofD: '#5b2e1c', stone: '#b4ab98', stoneD: '#5d5446', gold: '#e9b949', goldD: '#7a5410',
};
const SERIF = `Georgia, 'AppleMyungjo', 'Nanum Myeongjo', 'Noto Serif KR', serif`;

const CSS = `
.mm-wrap{position:fixed;right:18px;top:76px;width:160px;height:184px;z-index:39;pointer-events:none;user-select:none;-webkit-user-select:none}
.mm-ring{position:absolute;left:0;top:0;width:160px;height:160px;border-radius:50%;pointer-events:auto;cursor:pointer;
  background:#ecdcb0;border:3px solid #6b4423;box-shadow:0 0 0 2px #e8cf96,0 0 0 4px #6b4423,0 8px 22px rgba(40,24,10,.38);overflow:hidden}
.mm-wrap canvas,.mm-big canvas{position:static!important;inset:auto!important;display:block}
.mm-ring canvas{width:100%!important;height:100%!important}
.mm-ring::after{content:"";position:absolute;inset:0;border-radius:50%;pointer-events:none;box-shadow:inset 0 0 14px rgba(90,55,20,.45)}
.mm-tag{position:absolute;left:50%;top:150px;transform:translateX(-50%);pointer-events:auto;cursor:pointer;
  font:700 11px/1 ${SERIF};color:#3b2412;background:linear-gradient(180deg,#fbf1d6,#e9d3a2);border:1.5px solid #6b4423;border-radius:8px;
  padding:5px 9px 4px;white-space:nowrap;box-shadow:0 3px 8px rgba(40,24,10,.3)}
.mm-tag b{font:700 10px ui-monospace,monospace;background:#6b4423;color:#fbf1d6;border-radius:3px;padding:1px 4px;margin-right:4px}
.mm-tag:hover{background:#fff6dd}
@media (max-width:820px){
  .mm-wrap{top:auto!important;bottom:88px;right:58px;width:112px;height:132px}   /* 오른쪽 끝은 세로 무기 단축 바 */
  .mm-ring{width:112px;height:112px;border-width:2px;box-shadow:0 0 0 2px #e8cf96,0 0 0 3px #6b4423,0 6px 16px rgba(40,24,10,.35)}
  .mm-tag{top:104px;font-size:10px;padding:4px 7px 3px}
}
body[data-view="doc"] .mm-wrap,body.intro-on .mm-wrap,body.talking .mm-wrap{display:none}
body[data-view="doc"] .mm-big,body.intro-on .mm-big{display:none!important}
.mm-big{position:fixed;inset:0;z-index:55;display:flex;align-items:center;justify-content:center}
.mm-big[hidden]{display:none}
.mm-dim{position:absolute;inset:0;background:rgba(30,18,8,.48);backdrop-filter:blur(2px)}
.mm-panel{position:relative;display:flex;flex-direction:column;border-radius:16px;background:linear-gradient(180deg,#fbf1d6,#efdcb2);
  border:2px solid #6b4423;outline:1px solid rgba(255,248,230,.7);outline-offset:-7px;box-shadow:0 22px 50px rgba(40,24,10,.45);color:#3b2412;
  font:13px/1.45 ${SERIF};animation:mm-pop .2s cubic-bezier(.2,1.3,.4,1);max-width:calc(100vw - 16px);max-height:calc(100vh - 16px)}
@keyframes mm-pop{from{transform:scale(.95);opacity:0}to{transform:none;opacity:1}}
.mm-hd{display:flex;align-items:center;gap:10px;padding:12px 16px 8px;border-bottom:1.5px dashed rgba(107,68,35,.4)}
.mm-hd h2{font:700 18px/1.2 ${SERIF};margin:0;letter-spacing:.02em}
.mm-hd .sub{font-size:11.5px;color:#7a5532}
.mm-hd .x{margin-left:auto;width:32px;height:32px;border-radius:50%;border:1.5px solid #6b4423;background:#fbf1d6;color:#3b2412;font:700 16px/1 ${SERIF};cursor:pointer}
.mm-hd .x:hover{background:#fff}
.mm-bd{display:flex;gap:14px;padding:12px 14px 14px;min-height:0}
.mm-mapbox{position:relative;border:2px solid #6b4423;border-radius:6px;box-shadow:inset 0 0 0 2px #e8cf96;overflow:hidden;flex:none;background:#ecdcb0}
.mm-mapbox canvas{display:block}
.mm-leg{width:200px;display:flex;flex-direction:column;gap:6px;overflow:auto;min-height:0}
.mm-leg h3{font:700 12.5px ${SERIF};margin:2px 0 0;color:#6b4423;letter-spacing:.04em}
.mm-leg ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px}
.mm-leg li{display:flex;align-items:center;gap:7px;font-size:12px}
.mm-leg li canvas{flex:none}
.mm-leg .ev li{font-weight:700;color:#8a2a12}
.mm-leg .ev .none{font-weight:400;color:#7a5532}
.mm-leg .tip{font-size:11px;color:#7a5532;margin-top:4px}
@media (max-width:640px){
  .mm-bd{flex-direction:column;gap:8px;padding:8px 10px 10px}
  .mm-leg{width:auto;max-height:118px;flex-direction:row;flex-wrap:wrap;gap:4px 10px}
  .mm-leg h3,.mm-leg .tip{display:none}
  .mm-leg ul{flex-direction:row;flex-wrap:wrap;gap:3px 10px}
  .mm-hd{padding:9px 12px 6px}.mm-hd h2{font-size:16px}
}`;

export function createMinimap(opts = {}) {
  const {
    THREE = null, pathX = () => 0, world = null, camera = null, bounds = null,
    getPlayerPos = null, getPlayerHeading = null, getCameraYaw = null, getRidePos = null,
    stations = [], getPonds = null, castle = null, vprops = null,
    getFestival = null, getPageant = null, getShop = null, getQuests = null, getVillage = null,
    getNpcs = null, getAnimals = null, getQuestTarget = null, isActive = null,
  } = opts;
  const debug = typeof location !== 'undefined' && /[?&]test\b/.test(location.search);
  const safe = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  const call = (g) => (typeof g === 'function' ? safe(g) : null);
  const fin = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.z);
  const G = globalThis;

  const grid = world && world.grid;
  const GX = grid ? (grid.nx ?? grid.n) : 0, GZ = grid ? (grid.nz ?? grid.n) : 0;
  const HX = grid ? (grid.halfX ?? grid.half) : 42, HZ = grid ? (grid.halfZ ?? grid.half) : 84;
  const B = bounds || { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ };
  const waterY = world && world.stream ? world.stream.water : -0.45;
  const roadHalf = world && world.path ? world.path.half : 2.5;
  const bridge = world && world.bridge;
  const startZ = world && world.start ? world.start.z : 67;
  /* 시냇물 물판(EX_Water)은 다리 앞뒤 띠(z -45..-28)에만 있다 — 다른 낮은 땅은 마른 골짜기 */
  const sZ = world && world.stream ? world.stream.z : -36.4;
  const WZ0 = bridge ? bridge.z0 - 1.5 : sZ - 9, WZ1 = bridge ? bridge.z1 + 1.5 : sZ + 9;
  const hAt = (x, z) => {
    if (!grid) return 0;
    const fx = Math.min(GX - 1.001, Math.max(0, (x + HX) / grid.step)), fy = Math.min(GZ - 1.001, Math.max(0, (-z + HZ) / grid.step));
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, h = (i, j) => grid.h[j * GX + i];
    return (h(ix, iy) * (1 - tx) + h(ix + 1, iy) * tx) * (1 - ty) + (h(ix, iy + 1) * (1 - tx) + h(ix + 1, iy + 1) * tx) * ty;
  };

  /* ── 저장된 설정 ── */
  let northUp = false;
  try { northUp = JSON.parse(localStorage.getItem(STORE_KEY) || '{}').northUp === true; } catch (e) { /* 없음 */ }
  const saveCfg = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ northUp })); } catch (e) { /* 없음 */ } };

  /* ── 자리 정보 ── */
  const ponds = () => { const p = call(getPonds); return Array.isArray(p) && p.length ? p : DEF_PONDS; };
  const gate = () => { const g = castle && castle.gates && castle.gates[0]; return g && Number.isFinite(g.x) ? g : { x: pathX(-80), z: -80, rotY: Math.atan(-3.08 * 0.042857 * Math.cos(0.042857 * 80)) }; };
  const festSites = () => { const f = call(getFestival); return (f && f.sites) || DEF_FEST; };
  const pageSites = () => { const p = call(getPageant); const s = (p && p.sites) || DEF_PAGEANT; return s; };
  const board = () => { const q = call(getQuests); const b = q && q.board; return fin(b) ? b : { x: pathX(57.4) - 4.6, z: 57.4 }; };
  const hut = () => { const s = call(getShop); return s && fin(s.hut) ? s.hut : DEF_HUT; };
  const vItems = () => (vprops && Array.isArray(vprops.items) ? vprops.items : []);
  const hamlets = () => {
    const acc = {};
    for (const it of vItems()) { if (!/^cottage|^windmill|^field/.test(it.kind)) continue; const a = acc[it.hamlet] || (acc[it.hamlet] = { x: 0, z: 0, n: 0 }); a.x += it.x; a.z += it.z; a.n++; }
    return Object.keys(HAMLET_KO).map(k => {
      const a = acc[k];
      let p = a && a.n ? { x: a.x / a.n, z: a.z / a.n } : HAMLET_DEF[k];
      if (k === 'F') { const wm = vItems().find(i => i.kind === 'windmill'); if (wm) p = { x: wm.x, z: wm.z + 4.5 }; }
      if (k === 'B') p = HAMLET_DEF.B;   // 길 양쪽으로 갈라져 있어 서쪽 광장(분수)에 이름을 단다
      return { k, name: HAMLET_KO[k], ...p };
    });
  };
  const stPos = (s) => (s && s.pos ? { x: s.pos[0], z: s.pos[1] } : s && s.group ? { x: s.group.position.x, z: s.group.position.z } : s);

  /* ════════ 정적 층 ════════ */
  const SW = Math.round((EXT.x1 - EXT.x0) * RES), SH = Math.round((EXT.z1 - EXT.z0) * RES);
  const stat = document.createElement('canvas'); stat.width = SW; stat.height = SH;
  const sx = (x) => (x - EXT.x0) * RES, sy = (z) => (z - EXT.z0) * RES;
  let rng = 1;
  const rand = () => { rng = (rng * 16807) % 2147483647; return (rng - 1) / 2147483646; };
  let statItems = -1;

  function exclusion(x, z) {
    if (Math.abs(x - pathX(z)) < roadHalf + 2.2) return true;
    if (grid && z > WZ0 - 1 && z < WZ1 + 1 && hAt(x, z) < waterY + 0.18) return true;
    for (const p of ponds()) if (Math.hypot(x - p.x, z - p.z) < p.r + 2.4) return true;
    for (const s of stations) { const p = stPos(s); if (p && Math.hypot(x - p.x, z - p.z) < 7.5) return true; }
    for (const it of vItems()) if (Math.hypot(x - it.x, z - it.z) < (it.r || 2) + 1.4) return true;
    const F = DEF_FEST;
    if (x > 18 && x < 36 && z > F.joust.z0 - 4 && z < F.joust.z1 + 4) return true;
    if (x > 14 && x < 39 && z > 58 && z < 75) return true;
    const circles = [[F.green.x, F.green.z, 7], [20, 48, 8.5], [-30, 69, 8], [-15.5, 50, 4], [DEF_HUT.x, DEF_HUT.z, 6.5], [-18, 60, 7.5], [-25, 33, 4.5],
      [28, -15, 5], [33, -21, 5], [37.5, -26.5, 4], [pathX(57.4) - 4.6, 57.4, 3.5]];
    for (const c of circles) if (Math.hypot(x - c[0], z - c[1]) < c[2]) return true;
    const g = gate(); if (z < g.z + 4 && Math.abs(x - g.x) < 22) return true;
    if (Math.abs(z - startZ) < 9 && Math.abs(x - pathX(z)) < 18) return true;   // 출발점 앞 공터(표지판·장난감 블록)
    return false;
  }

  function drawStatic() {
    const g = stat.getContext('2d');
    statItems = vItems().length;
    rng = 7919;
    /* 바탕: 맵 밖은 짙은 양피지 + 빗금 */
    g.fillStyle = C.paperD; g.fillRect(0, 0, SW, SH);
    g.save(); g.strokeStyle = 'rgba(107,68,35,.16)'; g.lineWidth = 1.2;
    for (let d = -SH; d < SW + SH; d += 9) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d + SH, SH); g.stroke(); }
    g.restore();
    /* 땅: 높이 음영 + 물 (격자 그대로 작은 그림 → 부드럽게 늘린다) */
    if (grid) {
      const tc = document.createElement('canvas'); tc.width = GX; tc.height = GZ;
      const tg = tc.getContext('2d'), img = tg.createImageData(GX, GZ), d = img.data;
      const H = (i, j) => grid.h[Math.min(GZ - 1, Math.max(0, j)) * GX + Math.min(GX - 1, Math.max(0, i))];
      for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) {
        const h = H(i, j), o = ((GZ - 1 - j) * GX + i) * 4;   // 격자 j=0 이 z=+HZ (지도 아래쪽)
        let r, gg, b;
        const zr = HZ - j * grid.step;
        if (h < waterY + 0.04 && zr > WZ0 && zr < WZ1) { const k = Math.max(0, Math.min(1, (waterY + 0.04 - h) / 0.5)); r = 141 - 40 * k; gg = 180 - 34 * k; b = 184 - 22 * k; }
        else {
          const sl = (H(i + 1, j) - H(i - 1, j)) * 0.9 - (H(i, j + 1) - H(i, j - 1)) * 0.9;   // 북서쪽에서 빛
          const m = grid.mask ? grid.mask[j * GX + i] : 1;
          const lit = Math.max(-1, Math.min(1, -sl * 1.6)) * 18 + Math.max(-1, Math.min(1, h)) * 6;
          r = 236 + lit - m * 10; gg = 220 + lit - m * 2; b = 176 + lit - m * 28;
        }
        d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
      }
      tg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(tc, sx(-HX), sy(-HZ), 2 * HX * RES, 2 * HZ * RES);
    } else { g.fillStyle = C.paper; g.fillRect(sx(-HX), sy(-HZ), 2 * HX * RES, 2 * HZ * RES); }
    /* 맵 경계 테두리 (점선) */
    g.save(); g.strokeStyle = 'rgba(107,68,35,.55)'; g.lineWidth = 2.5; g.setLineDash([10, 6]);
    g.strokeRect(sx(B.minX), sy(B.minZ), (B.maxX - B.minX) * RES, (B.maxZ - B.minZ) * RES); g.restore();
    /* 나무 무늬 */
    const trees = [];
    for (let z = EXT.z0 + 1; z < EXT.z1; z += 2.4) for (let x = EXT.x0 + 1; x < EXT.x1; x += 2.4) {
      const tx = x + (rand() - 0.5) * 2.0, tz = z + (rand() - 0.5) * 2.0, r = 0.9 + rand() * 0.5, keep = rand();
      const inside = tx > B.minX && tx < B.maxX && tz > B.minZ && tz < B.maxZ;
      if (inside ? (keep > 0.62 || exclusion(tx, tz)) : (keep > 0.5 || (tz < gate().z + 2 && Math.abs(tx - gate().x) < 21))) continue;
      trees.push([tx, tz, r, inside]);
    }
    trees.sort((a, b) => a[1] - b[1]);
    for (const [tx, tz, r, inside] of trees) {
      const X = sx(tx), Y = sy(tz), R = r * RES;
      g.fillStyle = 'rgba(70,50,20,.18)'; g.beginPath(); g.ellipse(X + R * 0.25, Y + R * 0.55, R * 0.9, R * 0.45, 0, 0, TAU); g.fill();
      g.fillStyle = inside ? C.tree : '#9c9a5e'; g.strokeStyle = inside ? C.treeD : '#6e6a3c'; g.lineWidth = 1.3;
      g.beginPath(); g.arc(X, Y, R, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,250,220,.25)'; g.beginPath(); g.arc(X - R * 0.3, Y - R * 0.3, R * 0.38, 0, TAU); g.fill();
    }
    /* 연못 */
    for (const p of ponds()) {
      const X = sx(p.x), Y = sy(p.z), R = p.r * RES;
      g.fillStyle = '#7a6a3e'; g.beginPath(); g.arc(X, Y, R + 4, 0, TAU); g.fill();
      g.fillStyle = C.water; g.strokeStyle = C.waterD; g.lineWidth = 2.5;
      g.beginPath();
      for (let a = 0; a <= TAU + 0.01; a += TAU / 36) { const rr = R * (1 + Math.sin(a * 3 + p.x) * 0.05); g.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr); }
      g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.4;
      for (const k of [0.35, 0.62]) { g.beginPath(); g.arc(X, Y, R * k, -2.4, -1.1); g.stroke(); }
    }
    /* 길 */
    const g0 = gate();
    const roadPath = () => { g.beginPath(); for (let z = g0.z + 1; z <= HZ + 0.5; z += 0.5) { const X = sx(pathX(z)), Y = sy(z); z === g0.z + 1 ? g.moveTo(X, Y) : g.lineTo(X, Y); } };
    g.lineCap = 'round'; g.lineJoin = 'round';
    roadPath(); g.strokeStyle = C.roadD; g.lineWidth = (roadHalf * 2 + 0.5) * RES; g.stroke();
    roadPath(); g.strokeStyle = C.road; g.lineWidth = roadHalf * 2 * RES - 3; g.stroke();
    roadPath(); g.strokeStyle = 'rgba(138,103,56,.45)'; g.lineWidth = 1.5; g.setLineDash([6, 9]); g.stroke(); g.setLineDash([]);
    /* 다리 */
    if (bridge) {
      const hw = (bridge.halfW || 2.5) + 0.4;
      g.beginPath();
      for (let z = bridge.z0; z <= bridge.z1 + 0.01; z += 0.5) g.lineTo(sx(pathX(z) - hw), sy(z));
      for (let z = bridge.z1; z >= bridge.z0 - 0.01; z -= 0.5) g.lineTo(sx(pathX(z) + hw), sy(z));
      g.closePath(); g.fillStyle = C.stone; g.fill(); g.strokeStyle = C.stoneD; g.lineWidth = 2.2; g.stroke();
      g.strokeStyle = 'rgba(93,84,70,.45)'; g.lineWidth = 1;
      for (let z = bridge.z0 + 1; z < bridge.z1; z += 1.2) { g.beginPath(); g.moveTo(sx(pathX(z) - hw + 0.3), sy(z)); g.lineTo(sx(pathX(z) + hw - 0.3), sy(z)); g.stroke(); }
    }
    /* 성 */
    {
      const c = Math.cos(g0.rotY || 0), s = Math.sin(g0.rotY || 0);
      const W = (lx, lz) => [sx(g0.x + c * lx + s * lz), sy(g0.z - s * lx + c * lz)];
      const poly = (pts) => { g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); };
      g.fillStyle = 'rgba(180,170,150,.55)'; poly([W(-16.5, -1), W(16.5, -1), W(16.5, -17.2), W(-16.5, -17.2)]); g.fill();   // 안뜰
      for (const sh of CASTLE_SHAPES) {
        g.fillStyle = sh[5] === 'keep' ? '#8f8676' : sh[5] === 'tower' ? '#a0978a' : C.stone; g.strokeStyle = C.stoneD; g.lineWidth = 2;
        if (sh[0] === 'r') { const [, x, z, hx, hz] = sh; poly([W(x - hx, z - hz), W(x + hx, z - hz), W(x + hx, z + hz), W(x - hx, z + hz)]); }
        else { const [X, Y] = W(sh[1], sh[2]); g.beginPath(); g.arc(X, Y, sh[3] * RES, 0, TAU); }
        g.fill(); g.stroke();
        if (sh[5] === 'tower' || sh[5] === 'keep') {   // 지붕 깃발
          const [X, Y] = W(sh[1], sh[2]);
          g.strokeStyle = C.ink; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X, Y); g.lineTo(X, Y - 12); g.stroke();
          g.fillStyle = '#b8322a'; g.beginPath(); g.moveTo(X, Y - 12); g.lineTo(X + 9, Y - 9); g.lineTo(X, Y - 6); g.fill();
        }
      }
      g.fillStyle = '#6a4424'; poly([W(-2.3, -0.4), W(2.3, -0.4), W(2.3, -1.6), W(-2.3, -1.6)]); g.fill();   // 문
    }
    /* 마을 소품 */
    for (const it of vItems()) {
      const f = it.f || {}, rot = it.rot || 0, c = Math.cos(rot), s = Math.sin(rot);
      const W = (lx, lz) => [sx(it.x + c * lx + s * lz), sy(it.z - s * lx + c * lz)];
      const rect = (cx, cz, hx, hz) => { g.beginPath(); [W(cx - hx, cz - hz), W(cx + hx, cz - hz), W(cx + hx, cz + hz), W(cx - hx, cz + hz)].forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); };
      const k = it.kind;
      if (/^cottage/.test(k) && f.box) {
        const [cx, cz, hx, hz] = f.box;
        g.fillStyle = 'rgba(60,40,20,.22)'; rect(cx + 0.5, cz + 0.6, hx, hz); g.fill();
        g.fillStyle = C.roof; g.strokeStyle = C.roofD; g.lineWidth = 2; rect(cx, cz, hx, hz); g.fill(); g.stroke();
        g.beginPath(); const [a1, b1] = W(cx - hx, cz), [a2, b2] = W(cx + hx, cz); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke();
        g.fillStyle = 'rgba(255,230,190,.25)'; rect(cx, cz - hz / 2, hx, hz / 2); g.fill();
      } else if (/^field/.test(k) && f.rect) {
        const [hx, hz] = f.rect, wheat = k === 'field_wheat';
        g.fillStyle = wheat ? '#dcbf63' : '#9aab5a'; g.strokeStyle = '#7a5a2c'; g.lineWidth = 1.6; rect(0, 0, hx, hz); g.fill(); g.stroke();
        g.strokeStyle = wheat ? 'rgba(150,110,30,.55)' : 'rgba(70,90,30,.55)'; g.lineWidth = 1.1;
        for (let lx = -hx + 0.7; lx < hx; lx += 0.9) { g.beginPath(); const [a1, b1] = W(lx, -hz + 0.2), [a2, b2] = W(lx, hz - 0.2); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
      } else if (k === 'windmill') {
        const X = sx(it.x), Y = sy(it.z);
        g.fillStyle = '#d9c9a5'; g.strokeStyle = C.inkS; g.lineWidth = 2; g.beginPath(); g.arc(X, Y, 2.6 * RES, 0, TAU); g.fill(); g.stroke();
        g.strokeStyle = '#5a3a1c'; g.lineWidth = 3;
        for (let a = 0.4; a < TAU; a += Math.PI / 2) { g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * 4.4 * RES, Y + Math.sin(a) * 4.4 * RES); g.stroke(); }
        g.fillStyle = C.roof; g.beginPath(); g.arc(X, Y, 1.1 * RES, 0, TAU); g.fill();
      } else if (k === 'well' || k === 'fountain') {
        const X = sx(it.x), Y = sy(it.z), R = (k === 'well' ? 1.2 : 2.4) * RES;
        g.fillStyle = C.stone; g.strokeStyle = C.stoneD; g.lineWidth = 2; g.beginPath(); g.arc(X, Y, R, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = C.water; g.beginPath(); g.arc(X, Y, R * 0.62, 0, TAU); g.fill();
      } else if (k === 'haystack') {
        g.fillStyle = '#d9b450'; g.strokeStyle = '#8a6a22'; g.lineWidth = 1.4; g.beginPath(); g.arc(sx(it.x), sy(it.z), 1.4 * RES, 0, TAU); g.fill(); g.stroke();
      } else if (f.box) {
        const [cx, cz, hx, hz] = f.box;
        g.fillStyle = k === 'bales' ? '#d6b45a' : '#8a5a30'; g.strokeStyle = '#4e2f18'; g.lineWidth = 1.2; rect(cx, cz, hx, hz); g.fill(); g.stroke();
      }
    }
    /* 축제 시설 바닥 (창시합장 울타리, 활터 사대, 광장) */
    {
      const F = festSites();
      const j = F.joust || DEF_FEST.joust;
      g.fillStyle = 'rgba(200,170,110,.55)'; g.strokeStyle = '#7a5a2c'; g.lineWidth = 2; g.setLineDash([5, 4]);
      g.fillRect(sx(j.x - 6), sy(j.z0 - 1), 12 * RES, (j.z1 - j.z0 + 2) * RES); g.strokeRect(sx(j.x - 6), sy(j.z0 - 1), 12 * RES, (j.z1 - j.z0 + 2) * RES);
      g.setLineDash([]); g.strokeStyle = '#6a4424'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx(j.x), sy(j.z0)); g.lineTo(sx(j.x), sy(j.z1)); g.stroke();   // 가운데 칸막이
      const a = F.archery || DEF_FEST.archery;
      g.fillStyle = 'rgba(200,170,110,.45)'; g.fillRect(sx(a.lineX), sy(a.tz[0] - 3), (a.tx - a.lineX + 2) * RES, (a.tz[a.tz.length - 1] - a.tz[0] + 6) * RES);
      g.strokeStyle = '#6a4424'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(sx(a.lineX), sy(a.tz[0] - 3)); g.lineTo(sx(a.lineX), sy(a.tz[a.tz.length - 1] + 3)); g.stroke();
      for (const tz of a.tz) {   // 과녁
        const X = sx(a.tx), Y = sy(tz);
        for (const [r, col] of [[1.1, '#f4ead0'], [0.75, '#b8322a'], [0.4, '#f4ead0'], [0.18, '#e9b949']]) { g.fillStyle = col; g.beginPath(); g.arc(X, Y, r * RES, 0, TAU); g.fill(); }
        g.strokeStyle = C.ink; g.lineWidth = 1; g.beginPath(); g.arc(X, Y, 1.1 * RES, 0, TAU); g.stroke();
      }
      const gr = F.green || DEF_FEST.green;
      g.fillStyle = 'rgba(205,180,120,.6)'; g.strokeStyle = 'rgba(122,90,44,.6)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(sx(gr.x), sy(gr.z), 5 * RES, 0, TAU); g.fill(); g.stroke();
    }
    /* 종이 결 */
    g.save();
    for (let i = 0; i < 5200; i++) { g.fillStyle = rand() < 0.5 ? 'rgba(90,60,20,.05)' : 'rgba(255,250,230,.07)'; g.fillRect(rand() * SW, rand() * SH, 2 + rand() * 3, 1 + rand() * 2); }
    g.restore();
  }

  /* ════════ DOM ════════ */
  if (!document.getElementById('mm-style')) {
    const st = document.createElement('style'); st.id = 'mm-style'; st.textContent = CSS; document.head.appendChild(st);
  }
  const wrap = document.createElement('div'); wrap.className = 'mm-wrap';
  const ring = document.createElement('div'); ring.className = 'mm-ring'; ring.setAttribute('role', 'img'); ring.title = '지도 — 누르면 북쪽 고정 / 회전';
  const cv = document.createElement('canvas'); ring.appendChild(cv);
  const tag = document.createElement('button'); tag.type = 'button'; tag.className = 'mm-tag'; tag.innerHTML = '<b>M</b>큰 지도';
  wrap.append(ring, tag);
  const host = document.getElementById('drive-root') || document.body;
  host.appendChild(wrap);

  const big = document.createElement('div'); big.className = 'mm-big'; big.hidden = true;
  big.innerHTML = `<div class="mm-dim"></div><div class="mm-panel" role="dialog" aria-label="상호랜드 지도">
    <div class="mm-hd"><div><h2>상호랜드 지도</h2><div class="sub">임금님 최상호의 마을 · 위가 북쪽(성)</div></div><button class="x" type="button" aria-label="닫기">✕</button></div>
    <div class="mm-bd"><div class="mm-mapbox"><canvas></canvas></div><div class="mm-leg"></div></div></div>`;
  host.appendChild(big);
  const bigCv = big.querySelector('.mm-mapbox canvas'), legEl = big.querySelector('.mm-leg'), mapBox = big.querySelector('.mm-mapbox');

  /* ── 아이콘 ── */
  function badge(g, x, y, r, fill, stroke = C.ink) {
    g.fillStyle = fill; g.strokeStyle = stroke; g.lineWidth = Math.max(1, r * 0.22);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
  }
  const ICON = {
    tavern(g, x, y, s, col = '#c0763a') {
      badge(g, x, y, s, col);
      g.fillStyle = '#fbf1d6'; g.strokeStyle = '#fbf1d6'; g.lineWidth = s * 0.16;
      g.fillRect(x - s * 0.42, y - s * 0.38, s * 0.6, s * 0.8);
      g.beginPath(); g.arc(x + s * 0.24, y + s * 0.02, s * 0.24, -1.2, 1.2); g.stroke();
      g.fillStyle = col; g.fillRect(x - s * 0.3, y - s * 0.18, s * 0.36, s * 0.5);
    },
    crown(g, x, y, s) {
      g.fillStyle = C.gold; g.strokeStyle = C.goldD; g.lineWidth = Math.max(1, s * 0.16); g.lineJoin = 'round';
      g.beginPath(); g.moveTo(x - s, y + s * 0.6); g.lineTo(x - s, y - s * 0.4); g.lineTo(x - s * 0.5, y + s * 0.05); g.lineTo(x, y - s * 0.75);
      g.lineTo(x + s * 0.5, y + s * 0.05); g.lineTo(x + s, y - s * 0.4); g.lineTo(x + s, y + s * 0.6); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#b8322a'; g.beginPath(); g.arc(x, y + s * 0.2, s * 0.18, 0, TAU); g.fill();
    },
    star(g, x, y, s, fill = '#ffd34d') {
      g.fillStyle = fill; g.strokeStyle = '#6b3d06'; g.lineWidth = Math.max(1, s * 0.18); g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.45 : s; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.closePath(); g.fill(); g.stroke();
    },
    flag(g, x, y, s, col = '#b8322a') {
      g.strokeStyle = C.ink; g.lineWidth = Math.max(1.2, s * 0.18);
      g.beginPath(); g.moveTo(x - s * 0.5, y + s); g.lineTo(x - s * 0.5, y - s); g.stroke();
      g.fillStyle = col; g.beginPath(); g.moveTo(x - s * 0.5, y - s); g.lineTo(x + s, y - s * 0.55); g.lineTo(x - s * 0.5, y - s * 0.05); g.closePath(); g.fill();
      g.strokeStyle = C.ink; g.lineWidth = 1; g.stroke();
    },
    potion(g, x, y, s) {
      badge(g, x, y, s, '#4d6b3a');
      g.fillStyle = '#8ef06a'; g.beginPath(); g.arc(x, y + s * 0.18, s * 0.42, 0, TAU); g.fill();
      g.fillRect(x - s * 0.14, y - s * 0.55, s * 0.28, s * 0.45);
      g.fillStyle = '#fbf1d6'; g.fillRect(x - s * 0.22, y - s * 0.66, s * 0.44, s * 0.14);
    },
    cart(g, x, y, s) {
      badge(g, x, y, s, '#7a4a8a');
      g.fillStyle = '#fbf1d6'; g.fillRect(x - s * 0.55, y - s * 0.4, s * 1.1, s * 0.55);
      g.beginPath(); g.arc(x - s * 0.3, y + s * 0.3, s * 0.2, 0, TAU); g.arc(x + s * 0.3, y + s * 0.3, s * 0.2, 0, TAU); g.fill();
    },
    board(g, x, y, s) {
      g.fillStyle = '#8a5a30'; g.strokeStyle = '#3b2412'; g.lineWidth = Math.max(1, s * 0.18);
      g.fillRect(x - s * 0.9, y - s * 0.7, s * 1.8, s * 1.1); g.strokeRect(x - s * 0.9, y - s * 0.7, s * 1.8, s * 1.1);
      g.fillStyle = '#fbf1d6'; g.fillRect(x - s * 0.6, y - s * 0.45, s * 0.5, s * 0.6); g.fillRect(x + s * 0.1, y - s * 0.45, s * 0.5, s * 0.6);
      g.fillStyle = '#3b2412'; g.fillRect(x - s * 0.75, y + s * 0.4, s * 0.18, s * 0.6); g.fillRect(x + s * 0.57, y + s * 0.4, s * 0.18, s * 0.6);
    },
    ride(g, x, y, s) {
      badge(g, x, y, s, '#2f6f7a', '#123438');
      g.strokeStyle = '#fbf1d6'; g.lineWidth = Math.max(1, s * 0.18);
      g.beginPath(); g.arc(x, y, s * 0.5, 0, TAU); g.stroke();
      for (let a = 0; a < Math.PI; a += Math.PI / 3) { g.beginPath(); g.moveTo(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5); g.lineTo(x - Math.cos(a) * s * 0.5, y - Math.sin(a) * s * 0.5); g.stroke(); }
    },
    thief(g, x, y, s) {
      badge(g, x, y, s, '#d0281e', '#5a0c06');
      g.fillStyle = '#fff'; g.font = `900 ${Math.round(s * 1.3)}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', x, y + s * 0.08);
    },
    pond(g, x, y, s) {
      badge(g, x, y, s, C.water, C.waterD);
      g.fillStyle = '#2f5560'; g.beginPath(); g.ellipse(x - s * 0.1, y, s * 0.42, s * 0.24, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(x + s * 0.25, y); g.lineTo(x + s * 0.6, y - s * 0.25); g.lineTo(x + s * 0.6, y + s * 0.25); g.fill();
    },
    castle(g, x, y, s) {
      g.fillStyle = C.stone; g.strokeStyle = C.stoneD; g.lineWidth = Math.max(1, s * 0.16);
      g.beginPath(); g.moveTo(x - s, y + s * 0.8); g.lineTo(x - s, y - s * 0.6); g.lineTo(x - s * 0.6, y - s * 0.6); g.lineTo(x - s * 0.6, y - s * 0.2);
      g.lineTo(x + s * 0.6, y - s * 0.2); g.lineTo(x + s * 0.6, y - s * 0.6); g.lineTo(x + s, y - s * 0.6); g.lineTo(x + s, y + s * 0.8); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#6a4424'; g.beginPath(); g.arc(x, y + s * 0.45, s * 0.3, Math.PI, 0); g.lineTo(x + s * 0.3, y + s * 0.8); g.lineTo(x - s * 0.3, y + s * 0.8); g.fill();
    },
    house(g, x, y, s) {
      g.fillStyle = C.roof; g.strokeStyle = C.roofD; g.lineWidth = Math.max(1, s * 0.16);
      g.beginPath(); g.moveTo(x - s, y); g.lineTo(x, y - s); g.lineTo(x + s, y); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e8d6ae'; g.fillRect(x - s * 0.7, y, s * 1.4, s * 0.8); g.strokeRect(x - s * 0.7, y, s * 1.4, s * 0.8);
    },
    player(g, x, y, s, ang) {
      g.save(); g.translate(x, y); g.rotate(ang);
      g.fillStyle = 'rgba(30,60,140,.22)'; g.beginPath(); g.arc(0, 0, s * 1.5, 0, TAU); g.fill();
      g.fillStyle = '#2f5fd0'; g.strokeStyle = '#fff3c4'; g.lineWidth = Math.max(1.5, s * 0.26); g.lineJoin = 'round';
      g.beginPath(); g.moveTo(0, -s * 1.15); g.lineTo(s * 0.8, s * 0.8); g.lineTo(0, s * 0.38); g.lineTo(-s * 0.8, s * 0.8); g.closePath(); g.stroke(); g.fill();
      g.restore();
    },
    npc(g, x, y, s) { badge(g, x, y, s, '#f4e6c4', '#5b3a1c'); },
    animal(g, x, y, s) { badge(g, x, y, s, '#a5763c', '#4e2f18'); },
    kid(g, x, y, s) { badge(g, x, y, s, '#ef9fb5', '#7a2a40'); },
    dragon(g, x, y, s) {
      badge(g, x, y, s, '#3d2a52', '#160c22');
      g.fillStyle = '#ff7a2a'; g.beginPath(); g.moveTo(x, y - s * 0.6); g.quadraticCurveTo(x + s * 0.6, y, x, y + s * 0.6); g.quadraticCurveTo(x - s * 0.6, y, x, y - s * 0.6); g.fill();
    },
  };

  /* ════════ 움직이는 표시 모으기 ════════ */
  const icons = [];   // {kind, x, z, s, pr(우선순위), label, pulse, col, edge}
  const events = [];  // 지금 열리는 행사 이름
  let pPos = { x: 0, z: 0 }, pHead = Math.PI, viewYaw = Math.PI;
  const camDir = THREE ? new THREE.Vector3() : null;

  function collect() {
    icons.length = 0; events.length = 0;
    const pp = call(getPlayerPos); if (fin(pp)) pPos = { x: pp.x, z: pp.z };
    const h = call(getPlayerHeading); if (Number.isFinite(h)) pHead = h;
    let yaw = call(getCameraYaw);
    if (!Number.isFinite(yaw) && camera && camDir && camera.getWorldDirection) { camera.getWorldDirection(camDir); if (Math.hypot(camDir.x, camDir.z) > 1e-3) yaw = Math.atan2(camDir.x, camDir.z); }
    viewYaw = Number.isFinite(yaw) ? yaw : pHead;

    /* 사람·동물 점 (맨 아래) */
    const n = call(getNpcs);
    if (n && typeof n.list === 'function') {
      const L = safe(() => n.list(), []) || [];
      for (const o of L) { if (o.off || !o.pos) continue; icons.push({ kind: o.guard ? 'guard' : 'npc', x: o.pos.x, z: o.pos.z, s: 1, pr: 0, angry: o.angry }); }
    }
    const an = call(getAnimals);
    if (an) {
      const A = Array.isArray(an.animals) ? an.animals : (typeof an.list === 'function' ? safe(() => an.list(), []) : []);
      for (const a of A || []) if (Number.isFinite(a.x)) icons.push({ kind: 'animal', x: a.x, z: a.z, s: 1, pr: 0 });
    }
    /* 고정 장소 */
    const g0 = gate(); icons.push({ kind: 'castle', x: g0.x, z: g0.z - 6, s: 1.25, pr: 2, label: '상호성', big: true });
    for (const s of stations) {
      const p = stPos(s); if (!fin(p)) continue;
      icons.push({ kind: 'tavern', x: p.x, z: p.z, s: 1.05, pr: 2, col: s.color || '#c0763a', label: s.name || '선술집', sub: BOOTH_KO[s.style] || (s.ai ? 'AI 구역' : '') });
    }
    const bd = board(); icons.push({ kind: 'board', x: bd.x, z: bd.z, s: 0.9, pr: 2, label: '의뢰 게시판' });
    const ht = hut(); icons.push({ kind: 'potion', x: ht.x, z: ht.z, s: 0.95, pr: 2, label: '물약 가게', sub: '약초 마녀' });
    for (const p of ponds()) icons.push({ kind: 'pondL', x: p.x, z: p.z, s: 0, pr: 1, label: p.name || '연못' });
    for (const hm of hamlets()) icons.push({ kind: 'hamletL', x: hm.x, z: hm.z, s: 0, pr: 1.5, label: hm.name });
    const F = festSites();
    icons.push({ kind: 'siteL', x: (F.joust || DEF_FEST.joust).x, z: (F.joust || DEF_FEST.joust).z, s: 0, pr: 1, label: (F.joust && F.joust.name) || '마상 창시합장' });
    icons.push({ kind: 'siteL', x: (F.archery || DEF_FEST.archery).x, z: (F.archery || DEF_FEST.archery).z - 6, s: 0, pr: 1, label: (F.archery && F.archery.name) || '활터' });
    icons.push({ kind: 'siteL', x: (F.green || DEF_FEST.green).x, z: (F.green || DEF_FEST.green).z + 6.5, s: 0, pr: 1, label: (F.green && F.green.name) || '마을 광장' });
    if (bridge) icons.push({ kind: 'siteL', x: pathX((bridge.z0 + bridge.z1) / 2) + 7.5, z: (bridge.z0 + bridge.z1) / 2 + 3.2, s: 0, pr: 1, label: '돌다리 · 시냇물', small: true });
    icons.push({ kind: 'siteL', x: pathX(startZ), z: startZ + 6, s: 0, pr: 1, label: '출발점', small: true });
    icons.push({ kind: 'siteL', x: -18, z: 60, s: 0, pr: 1, label: '양 떼 풀밭', small: true });

    /* 상인 */
    const sh = call(getShop);
    const m = sh && safe(() => sh.merchant);
    if (m && m.here && fin(m)) icons.push({ kind: 'cart', x: m.x, z: m.z, s: 0.95, pr: 3, label: '떠돌이 상인', pulse: 0.5 });

    /* 축제 */
    const fe = call(getFestival);
    const fst = fe && typeof fe.state === 'function' ? safe(() => fe.state()) : null;
    if (fst && fst.current) {
      const cur = fst.current; let at = null;
      if (cur === 'joust') at = F.joust || DEF_FEST.joust;
      else if (cur === 'archery') at = F.archery || DEF_FEST.archery;
      else if (cur === 'bonfire' || cur === 'maypole') at = F.green || DEF_FEST.green;
      else if (cur === 'performers') { const P = (fe.P) || (G.__festival && G.__festival.P); if (P && fin(P) && (P.x || P.z)) at = P; }
      if (at) icons.push({ kind: 'event', x: at.x, z: at.z, s: 1.05, pr: 4, label: FEST_KO[cur] || cur, pulse: 1, col: '#b8322a', edge: true });
      events.push(FEST_KO[cur] || cur);
    }
    if (fst && fst.dragon) {
      const D = (fe.dragonObj) || (G.__festival && G.__festival.dragonObj);
      if (D && D.g && D.g.visible) icons.push({ kind: 'dragon', x: D.g.position.x, z: D.g.position.z, s: 1.1, pr: 5, label: '용', pulse: 1, edge: true });
      events.push(FEST_KO.dragon);
    }
    /* 행렬·연회 */
    const pg = call(getPageant);
    const pst = pg && typeof pg.state === 'function' ? safe(() => pg.state()) : null;
    if (pst && pst.current) {
      const cur = pst.current, PS = pageSites();
      let at = PS[cur] ? { x: PS[cur].x, z: PS[cur].z } : null;
      if (at && at.x == null) at.x = pathX(at.z);
      if (cur === 'wedding') { const WE = pg.WE || (G.__pageant && G.__pageant.WE); if (WE && WE.c && fin(WE.c) && (WE.c.x || WE.c.z)) at = WE.c; }
      if (fin(at)) icons.push({ kind: 'event', x: at.x, z: at.z, s: 1.05, pr: 4, label: PAGE_KO[cur] || cur, pulse: 1, col: '#7a3a9a', edge: true });
      if (cur === 'feast') { const FE = pg.FE || (G.__pageant && G.__pageant.FE); const k = FE && FE.king; if (k && fin(k)) icons.push({ kind: 'crown', x: k.x, z: k.z, s: 1.0, pr: 5, label: '임금님', pulse: 0.6 }); }
      events.push(PAGE_KO[cur] || cur);
    }
    /* 마을: 임금님 행차, 도둑 */
    const v = call(getVillage);
    const vs = v && v.state;
    const proc = vs && safe(() => vs.procession);
    if (proc && Number.isFinite(proc.z)) { icons.push({ kind: 'crown', x: pathX(proc.z), z: proc.z, s: 1.1, pr: 5, label: '임금님 행차', pulse: 1, edge: true }); events.push('임금님 행차'); }
    const th = vs && safe(() => vs.thief);
    if (th) {
      let tp = (typeof v.thiefPos === 'function') ? safe(() => v.thiefPos()) : null;
      if (!fin(tp)) { const cast = v.cast || (G.__village && G.__village.cast); tp = cast && cast.thief; }
      if (fin(tp)) icons.push({ kind: 'thief', x: tp.x, z: tp.z, s: 0.85, pr: 5, label: '소매치기!', pulse: 1, edge: true });
      events.push('도둑이야! (소매치기)');
    }
    const ch = vs && safe(() => vs.chickens);
    if (ch) events.push(`닭 소동 ${ch.caught}/${ch.total}`);
    const fw = vs && safe(() => vs.fireworks);
    if (fw && fw.show > 0) events.push('밤 불꽃놀이');
    /* 의뢰 목표 */
    let qt = call(getQuestTarget);
    if (!fin(qt)) { const q = call(getQuests); if (q && typeof q.target === 'function') qt = safe(() => q.target()); }
    if (fin(qt)) icons.push({ kind: 'quest', x: qt.x, z: qt.z, s: 1.0, pr: 6, label: '의뢰 목표', pulse: 0.8, edge: true });
    /* 세워 둔 탈것 */
    const rp = call(getRidePos);
    if (fin(rp) && Math.hypot(rp.x - pPos.x, rp.z - pPos.z) > 1.2) icons.push({ kind: 'ride', x: rp.x, z: rp.z, s: 0.8, pr: 3, label: '내 탈것', edge: true });
    icons.sort((a, b) => a.pr - b.pr);
  }

  function drawIcon(g, ic, X, Y, k, time) {
    const s = ic.s * k;
    if (ic.pulse) {
      const ph = (time * 1.4) % 1;
      g.strokeStyle = ic.kind === 'quest' ? 'rgba(255,200,40,' : ic.kind === 'thief' ? 'rgba(210,40,30,' : 'rgba(184,50,42,';
      g.strokeStyle += (0.8 * (1 - ph)).toFixed(2) + ')'; g.lineWidth = 2;
      g.beginPath(); g.arc(X, Y, s * (1.1 + ph * 1.6), 0, TAU); g.stroke();
    }
    switch (ic.kind) {
      case 'npc': ICON.npc(g, X, Y, 1.9 * k / 6 + 0.9, ic.angry); if (ic.angry) { g.fillStyle = '#d0281e'; g.beginPath(); g.arc(X, Y, 1.2, 0, TAU); g.fill(); } break;
      case 'guard': badge(g, X, Y, 1.9 * k / 6 + 1, '#3a4f8a', '#121a33'); break;
      case 'animal': ICON.animal(g, X, Y, 1.5 * k / 6 + 0.7); break;
      case 'tavern': ICON.tavern(g, X, Y, s, ic.col); break;
      case 'castle': ICON.castle(g, X, Y, s); break;
      case 'board': ICON.board(g, X, Y, s); break;
      case 'potion': ICON.potion(g, X, Y, s); break;
      case 'cart': ICON.cart(g, X, Y, s); break;
      case 'event': ICON.flag(g, X, Y, s, ic.col); break;
      case 'crown': ICON.crown(g, X, Y, s); break;
      case 'thief': ICON.thief(g, X, Y, s); break;
      case 'quest': ICON.star(g, X, Y, s * 1.1); break;
      case 'ride': ICON.ride(g, X, Y, s); break;
      case 'dragon': ICON.dragon(g, X, Y, s); break;
      default: break;
    }
  }

  /* ════════ 작은 지도 ════════ */
  let mmSize = 0, dpr = 1, time = 0, acc = 1;
  function sizeMini() {
    const r = ring.getBoundingClientRect();
    const sz = Math.round(r.width);
    if (!sz) return;   // 아직 숨겨져 있다 (인트로·문서 뷰) — 보일 때 다시 잰다
    dpr = Math.min(2, window.devicePixelRatio || 1);
    if (sz !== mmSize || cv.width !== Math.round(sz * dpr)) { mmSize = sz; cv.width = cv.height = Math.round(sz * dpr); }
    /* 넓은 화면: 상단 바(줄바꿈 포함) 바로 아래 */
    if (!matchMedia('(max-width:820px)').matches) {
      const top = document.getElementById('g-top');
      const b = top ? top.getBoundingClientRect().bottom : 62;
      wrap.style.top = Math.max(70, Math.round(b + 4)) + 'px';
    } else wrap.style.top = '';
  }

  function drawMini() {
    const g = cv.getContext('2d');
    const W = cv.width, R = W / 2;
    const viewR = mmSize < 140 ? 30 : 34;                 // 반지름 m
    const k = R / viewR;                                  // px/m (장치 픽셀)
    const a = northUp ? 0 : viewYaw - Math.PI;            // 카메라 앞 방향이 위로
    const ca = Math.cos(a), sa = Math.sin(a);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, W);
    g.fillStyle = C.paperD; g.fillRect(0, 0, W, W);
    g.save();
    g.translate(R, R); g.rotate(a); g.scale(k / RES, k / RES); g.translate(-sx(pPos.x), -sy(pPos.z));
    g.imageSmoothingEnabled = true;
    g.drawImage(stat, 0, 0);
    g.restore();
    const toS = (x, z) => { const dx = (x - pPos.x) * k, dz = (z - pPos.z) * k; return [R + dx * ca - dz * sa, R + dx * sa + dz * ca]; };
    const ik = W / 160 * 6.2;                             // 아이콘 크기 단위 (장치 px)
    const rim = R - ik * 1.3;
    for (const ic of icons) {
      if (!ic.s && ic.kind !== 'npc' && ic.kind !== 'guard' && ic.kind !== 'animal') continue;   // 이름표 전용은 작은 지도에서 안 그림
      let [X, Y] = toS(ic.x, ic.z);
      const dx = X - R, dy = Y - R, d = Math.hypot(dx, dy);
      let edge = false;
      if (d > rim) { if (!ic.edge) continue; X = R + dx / d * rim; Y = R + dy / d * rim; edge = true; }
      if (edge) { g.globalAlpha = 0.9; drawIcon(g, { ...ic, pulse: 0, s: ic.s * 0.8 }, X, Y, ik, time); g.globalAlpha = 1; }
      else drawIcon(g, ic, X, Y, ik, time);
    }
    /* 나 */
    ICON.player(g, R, R, ik * 0.95, Math.PI - pHead + a);
    /* 북쪽 표시 */
    const nAng = a - Math.PI / 2;   // 지도 위 북쪽(-z) 방향
    const NX = R + Math.cos(nAng) * (R - ik * 1.25), NY = R + Math.sin(nAng) * (R - ik * 1.25);
    g.fillStyle = '#fbf1d6'; g.strokeStyle = C.inkS; g.lineWidth = Math.max(1, ik * 0.2);
    g.beginPath(); g.arc(NX, NY, ik * 1.05, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#8a2a12'; g.font = `700 ${Math.round(ik * 1.2)}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('북', NX, NY + ik * 0.05);
    if (northUp) {   // 고정 모드 표시
      g.fillStyle = 'rgba(59,36,18,.7)'; g.font = `700 ${Math.round(ik * 0.95)}px ${SERIF}`;
      g.fillText('북쪽 고정', R, W - ik * 1.6);
    }
  }

  /* ════════ 큰 지도 ════════ */
  let bigOpen = false, bigK = 1, bigW = 0, bigH = 0;
  const LEGEND = [
    ['player', '나'], ['ride', '세워 둔 탈것'], ['tavern', '선술집 (프로젝트)'], ['board', '의뢰 게시판'], ['potion', '물약 가게'],
    ['cart', '떠돌이 상인 (올 때만)'], ['castle', '상호성 성문'], ['pond', '연못 (낚시)'], ['house', '오두막 마을'],
    ['event', '지금 열리는 행사'], ['crown', '임금님'], ['thief', '소매치기'], ['quest', '의뢰 목표'],
    ['npc', '마을 사람'], ['guard', '경비병'], ['animal', '동물'],
  ];
  function legendIcon(kind) {
    const c = document.createElement('canvas'); const D = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = 20 * D; c.style.width = c.style.height = '20px';
    const g = c.getContext('2d'); g.scale(D, D);
    const s = 7;
    if (kind === 'player') ICON.player(g, 10, 10, 6, 0);
    else if (kind === 'pond') ICON.pond(g, 10, 10, s);
    else if (kind === 'house') ICON.house(g, 10, 11, s);
    else if (kind === 'npc') ICON.npc(g, 10, 10, 3);
    else if (kind === 'guard') badge(g, 10, 10, 3.2, '#3a4f8a', '#121a33');
    else if (kind === 'animal') ICON.animal(g, 10, 10, 2.8);
    else drawIcon(g, { kind, s: 1, col: kind === 'tavern' ? '#c0763a' : kind === 'event' ? '#b8322a' : undefined }, 10, 10, s, 0);
    return c;
  }
  function buildLegend() {
    legEl.innerHTML = '';
    const h1 = document.createElement('h3'); h1.textContent = '지금 열리는 행사'; legEl.appendChild(h1);
    const ev = document.createElement('ul'); ev.className = 'ev'; legEl.appendChild(ev);
    const h2 = document.createElement('h3'); h2.textContent = '범례'; legEl.appendChild(h2);
    const ul = document.createElement('ul');
    for (const [k, t] of LEGEND) { const li = document.createElement('li'); li.appendChild(legendIcon(k)); li.appendChild(document.createTextNode(t)); ul.appendChild(li); }
    legEl.appendChild(ul);
    const tip = document.createElement('div'); tip.className = 'tip'; tip.textContent = 'M · Esc 로 닫기. 작은 지도를 누르면 북쪽 고정/회전을 바꿉니다.'; legEl.appendChild(tip);
    return ev;
  }
  const evEl = buildLegend();
  let evKey = '';
  function renderEvents() {
    const key = events.join('|');
    if (key === evKey) return;
    evKey = key; evEl.innerHTML = '';
    if (!events.length) { const li = document.createElement('li'); li.className = 'none'; li.textContent = '조용한 마을이에요'; evEl.appendChild(li); return; }
    for (const e of events) { const li = document.createElement('li'); li.textContent = '⚑ ' + e; evEl.appendChild(li); }
  }
  function sizeBig() {
    const mobile = matchMedia('(max-width:640px)').matches;
    const headH = mobile ? 52 : 60, legW = mobile ? 0 : 214, legH = mobile ? 126 : 0, pad = mobile ? 20 + 8 : 28 + 8;
    const availH = window.innerHeight - 16 - headH - legH - pad - 4;
    const availW = window.innerWidth - 16 - legW - (mobile ? 20 : 28) - 4;
    const ratio = (B.maxZ - B.minZ + 8) / (B.maxX - B.minX + 6);   // 맵 + 성 일부
    let w = Math.min(availW, availH / ratio), h = w * ratio;
    w = Math.max(160, Math.floor(w)); h = Math.floor(w * ratio);
    bigW = w; bigH = h;
    const D = Math.min(2, window.devicePixelRatio || 1);
    bigCv.width = Math.round(w * D); bigCv.height = Math.round(h * D);
    bigCv.style.width = w + 'px'; bigCv.style.height = h + 'px';
    mapBox.style.width = w + 'px'; mapBox.style.height = h + 'px';
    legEl.style.maxHeight = mobile ? '' : h + 'px';
  }
  function drawBig() {
    const g = bigCv.getContext('2d');
    const D = bigCv.width / bigW;
    const x0 = B.minX - 3, z0 = B.minZ - 8;   // 성 본채가 조금 보이게
    bigK = bigW / (B.maxX - B.minX + 6);
    const toB = (x, z) => [(x - x0) * bigK, (z - z0) * bigK];
    g.setTransform(D, 0, 0, D, 0, 0);
    g.clearRect(0, 0, bigW, bigH);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(stat, sx(x0), sy(z0), (bigW / bigK) * RES, (bigH / bigK) * RES, 0, 0, bigW, bigH);
    const ik = Math.max(4.2, Math.min(7, bigK * 1.6));
    for (const ic of icons) {
      if (!ic.s && ic.kind !== 'npc' && ic.kind !== 'guard' && ic.kind !== 'animal') continue;
      const [X, Y] = toB(ic.x, ic.z);
      if (X < -10 || Y < -10 || X > bigW + 10 || Y > bigH + 10) continue;
      drawIcon(g, ic, X, Y, ik, time);
    }
    const [PX, PY] = toB(pPos.x, pPos.z);
    ICON.player(g, PX, PY, ik * 1.6, Math.PI - pHead);
    /* 이름표 (겹치면 건너뜀, 중요도 높은 것부터) */
    const boxes = [];
    const lab = icons.filter(i => i.label && i.kind !== 'npc' && i.kind !== 'guard' && i.kind !== 'animal').sort((a, b) => (b.pr - a.pr) || ((b.big ? 1 : 0) - (a.big ? 1 : 0)));
    const fs = Math.round(Math.max(10.5, Math.min(13, bigK * 3.2)));
    for (const ic of lab) {
      const [X, Y] = toB(ic.x, ic.z);
      const isText = !ic.s;
      const f = ic.big ? `700 ${fs + 3}px ${SERIF}` : isText ? `${ic.small ? '600' : '700'} ${ic.small ? fs - 1 : fs + 1}px ${SERIF}` : `700 ${fs}px ${SERIF}`;
      g.font = f;
      const text = ic.label, tw = g.measureText(text).width, th = fs + 3;
      const sub = ic.sub && !isText ? ic.sub : '';
      let sw = 0; if (sub) { g.font = `500 ${fs - 2}px ${SERIF}`; sw = g.measureText(sub).width; g.font = f; }
      const bw = Math.max(tw, sw), bh = th + (sub ? fs : 0);
      const off = isText ? 0 : ic.s * ik + 4;
      const cands = isText ? [[X - bw / 2, Y - bh / 2]] : [[X + off, Y - bh / 2], [X - off - bw, Y - bh / 2], [X - bw / 2, Y - off - bh], [X - bw / 2, Y + off]];
      let pos = null;
      for (const [lx, ly] of cands) {
        if (lx < 2 || ly < 2 || lx + bw > bigW - 2 || ly + bh > bigH - 2) continue;
        if (boxes.some(b => lx < b[0] + b[2] && lx + bw > b[0] && ly < b[1] + b[3] && ly + bh > b[1])) continue;
        pos = [lx, ly]; break;
      }
      if (!pos) continue;
      boxes.push([pos[0] - 2, pos[1] - 1, bw + 4, bh + 2]);
      g.textAlign = 'left'; g.textBaseline = 'top'; g.lineJoin = 'round';
      g.lineWidth = 3.5; g.strokeStyle = 'rgba(251,241,214,.92)';
      const col = ic.kind === 'event' || ic.kind === 'thief' ? '#8a2a12' : ic.kind === 'quest' ? '#7a4a00' : isText ? '#5a3a1c' : C.ink;
      g.fillStyle = col;
      if (isText && !ic.small) { g.font = f; }
      g.strokeText(text, pos[0] + (bw - tw) / 2 * (isText ? 1 : 0), pos[1]); g.fillText(text, pos[0] + (bw - tw) / 2 * (isText ? 1 : 0), pos[1]);
      if (sub) { g.font = `500 ${fs - 2}px ${SERIF}`; g.fillStyle = '#7a5532'; g.strokeText(sub, pos[0], pos[1] + th - 1); g.fillText(sub, pos[0], pos[1] + th - 1); }
    }
    /* 나침반 */
    const cx = bigW - 26, cy = 30;
    g.fillStyle = 'rgba(251,241,214,.9)'; g.strokeStyle = C.inkS; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 17, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#8a2a12'; g.beginPath(); g.moveTo(cx, cy - 14); g.lineTo(cx + 5, cy); g.lineTo(cx - 5, cy); g.fill();
    g.fillStyle = C.inkS; g.beginPath(); g.moveTo(cx, cy + 14); g.lineTo(cx + 5, cy); g.lineTo(cx - 5, cy); g.fill();
    g.fillStyle = C.ink; g.font = `700 10px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('북', cx, cy - 23 < 4 ? cy + 23 : cy - 23);
  }

  function toggleBig(force) {
    const want = typeof force === 'boolean' ? force : !bigOpen;
    if (want === bigOpen) return bigOpen;
    if (want && document.body.dataset.view === 'doc') return false;
    if (want && document.body.classList.contains('talking')) return false;   // 대화·낚시·가게 중엔 안 연다 (Esc가 둘 다 닫던 문제)
    bigOpen = want; big.hidden = !want;
    if (want) { sizeBig(); collect(); renderEvents(); drawBig(); }
    return bigOpen;
  }
  function setNorthUp(v) { northUp = !!v; saveCfg(); acc = 1; return northUp; }

  /* ── 입력 ── */
  ring.addEventListener('click', () => setNorthUp(!northUp));
  tag.addEventListener('click', () => toggleBig(true));
  big.querySelector('.mm-dim').addEventListener('click', () => toggleBig(false));
  big.querySelector('.x').addEventListener('click', () => toggleBig(false));
  const onKey = (e) => {
    if (!bigOpen) return;
    if (e.code === 'Escape' || (e.code === 'KeyM' && !e.repeat)) { e.preventDefault(); e.stopImmediatePropagation(); toggleBig(false); return; }
    if (e.code === 'Tab' || e.code === 'Enter') return;   // 닫기 버튼 키보드 조작은 그대로
    e.stopPropagation();   // 지도가 열린 동안 걷기·무기·F(탈것) 키를 먹는다 (의뢰 게시판 창과 같은 방식)
  };
  addEventListener('keydown', onKey, true);
  const onResize = () => { sizeMini(); if (bigOpen) { sizeBig(); drawBig(); } acc = 1; };
  addEventListener('resize', onResize);

  drawStatic();
  sizeMini();
  const lateSize = setTimeout(sizeMini, 1500);   // 상단 바 버튼(탈것·화질)이 늦게 붙는다

  let itemCheck = 0, disposed = false;
  function update(dt = 0.016) {
    if (disposed) return;
    time += dt; acc += dt;
    if (acc < 1 / HZ_DRAW) return;
    acc = 0;
    const view = document.body.dataset.view;
    if (view === 'doc' || document.body.classList.contains('intro-on') || (typeof isActive === 'function' && !safe(isActive, true))) {
      if (bigOpen) toggleBig(false);
      return;
    }
    itemCheck += 1 / HZ_DRAW;
    if (itemCheck > 2) { itemCheck = 0; if (vItems().length !== statItems) drawStatic(); }
    collect();
    if (getComputedStyle(wrap).display !== 'none') { if (!mmSize) sizeMini(); if (mmSize) drawMini(); }
    if (bigOpen) { renderEvents(); drawBig(); }
  }

  function dispose() {
    disposed = true; clearTimeout(lateSize);
    removeEventListener('keydown', onKey, true); removeEventListener('resize', onResize);
    wrap.remove(); big.remove();
    if (debug && G.__minimap === api) delete G.__minimap;
  }

  const api = {
    update, toggleBig, setNorthUp, dispose, el: wrap,
    get bigOpen() { return bigOpen; }, get northUp() { return northUp; },
  };
  if (debug) {
    G.__minimap = Object.assign(api, {
      redrawStatic: drawStatic,
      state: () => ({ northUp, bigOpen, size: mmSize, player: { x: +pPos.x.toFixed(1), z: +pPos.z.toFixed(1) }, yaw: +viewYaw.toFixed(2),
        icons: icons.reduce((o, i) => ((o[i.kind] = (o[i.kind] || 0) + 1), o), {}), events: events.slice(), vpropsItems: statItems }),
      staticCanvas: stat,
    });
  }
  return api;
}
