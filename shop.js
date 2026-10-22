/* ════════════════════════════════════════════════════════════════════
   shop.js — 상호랜드 가게 두 곳
     ① 약초 마녀의 물약 가게 (숲속, 동쪽 길에서 약 18 m 안쪽 — HUT)
        삐뚤빼뚤한 오두막, 초록 거품이 부글부글 끓는 가마솥(김), 알록달록 물약 선반, 뾰족 모자를 쓴 마녀(npc-herbalist + 모자).
        물약(은화) — 마시면 30~45초 동안 효과, 화면 위쪽에 남은 시간 칩
          거인 물약  ×2.2 로 커진다(부드럽게), 카메라가 물러나고 쿵쿵 발걸음 흔들림, 마을 사람들 "거인이다!"
          꼬마 물약  ×0.45, 삐약삐약 말풍선, 카메라가 가까이
          바람 물약  걷기·달리기 ×1.8, 발밑 흙먼지
          깃털 물약  몸이 가벼워 걸으면 깡총깡총 뛰고, 서 있으면 둥실 뜬다(키 충돌 없음 — Space 는 '보기·열기'라 안 쓴다)
          투명 물약  반투명, 경비병이 놓친다(수배 ★ 0), 사람들이 "방금 뭐가 지나갔지?"
          술 깨는 물약  즉시 술이 깬다 (tavern.setDrunk(0))
          황금 물약  (떠돌이 상인만, 희귀) 닿는 사람마다 반짝반짝 + 은화 +1 (최대 8)
     ② 떠돌이 상인 마차 — 몇 분마다 길가 네 곳 중 한 곳에 약 3분 동안 선다("떠돌이 상인이 왔어요!").
        carriage.glb(말 포함, Idle) + 줄무늬 차양 진열대 + 상인(npc-traveler + 깃털 모자).
        치장품 — 깃털 모자·왕관(임금님 흉내)·기사 투구·마녀 모자·꽃 화관(머리 Head 뼈에 붙는다), 망토 염색 6색
        (player_Cloth 텍스처의 빨간 망토 픽셀만 다시 칠한다), 애완 오리(졸졸 따라온다), 황금 물약.
        산 물건과 착용 상태는 localStorage 'sangholand-shop-v1' 에 남는다.
     창: 양피지 창(quests.js 와 같은 모양, 모바일 대응). F·Esc·✕ 로 닫는다. 가까이 가면 "F 가게 보기".
     은화: 선술집 지갑(tavern.coins / addCoins) → 없으면 의뢰 게시판 지갑(quests.addCoins 가 있으면) → 없으면 이 모듈 지갑.

   ── portfolio.js 연결 (PM 이 넣는다) ──
     ① 위쪽 let 묶음(castle, animals, quests, kids 줄)에:  let shop = null;
        같은 자리 FESTIVAL_CLEAR import 옆에:      const { SHOP_CLEAR } = await import('./shop.js');
        월드 콜백 clearTrees(... FESTIVAL_CLEAR ...) 다음 줄:  clearTrees(gltf.scene, SHOP_CLEAR.spots, SHOP_CLEAR.r);   // 마녀 오두막·상인 자리
     ② quests 블록 바로 아래:
        {
          const { createShop } = await import('./shop.js');
          shop = createShop({
            THREE, scene, camera, person, GLTFLoader, dracoLoader: draco, groundY, pathX,
            getPlayerPos: () => activePos(),
            isOnFoot: () => player.mode === 'onfoot',
            isBlocked: () => !driveActive || panelOpen() || !!(dialogue && dialogue.active) || !!(fishing && fishing.active) || tavern.seated || !!(quests && quests.open),
            getTavern: () => tavern, getQuests: () => quests, getNpcs: () => npcs, getEvents: () => events,
            blocks: (x, z, r) => vprops.blocks(x, z, r),
            onOpen() { for (const k in keys) keys[k] = false; pSpeed = 0; speed = 0; if (weapons) weapons.holster(); },
          });
        }
     ③ walk() — 속도 배율 (거인·꼬마·바람):
          const top = (keys.boost ? RUN_SPEED : WALK_SPEED) * (shop ? shop.effects.speedMul() : 1);
        그리고 걷기 동작 고르는 두 줄은 배율을 나눈 속도로 (발이 덜 미끄러지게):
          const ps = pSpeed / (shop ? shop.effects.speedMul() : 1);
          playClip(ps < 0.3 ? 'idle' : ps < WALK_SPEED + 1 ? 'walk' : 'run');
          if (charAction) charAction.timeScale = ps < 0.3 ? 1 : ps < WALK_SPEED + 1 ? Math.max(0.5, ps / WALK_SPEED) : ps / RUN_SPEED * 1.1;
        충돌 (quests.pushOut 줄 옆):  if (shop && shop.pushOut(person.position, 0.35)) pSpeed *= 0.5;
        drive() 충돌 (선택):          if (shop && shop.pushOut(car.position, 1.4)) speed *= 0.5;
     ④ step(dt) — 반드시 카메라 갱신 뒤( weapons.update(dt, weaponsIn); 다음 줄 ):
          if (shop) shop.update(dt, t);
        (크기 person.scale·반투명·카메라 당기기/밀기·발걸음 흔들림은 이 모듈이 직접 한다. 카메라는 그 프레임에
         portfolio 가 정한 위치를 플레이어 발 기준으로 shop.effects.camMul() 배 늘리거나 줄인다 — 방향은 그대로.
         직접 하고 싶으면 createShop 옵션 applyCamera:false / applyScale:false / applyAlpha:false 로 끄고
         updateCamera 의 back·up 에 shop.effects.camMul() 을 곱하고 person.scale.setScalar(shop.effects.scale()) 를 부른다.)
     ⑤ F 키 (우선순위: 대화 > 의뢰 게시판 > 가게 > 낚시 > 탈것). keydown 의 KeyF 블록:
          if (player.mode === 'onfoot' && quests && quests.onF()) { hideHint(); return; }
          if (player.mode === 'onfoot' && shop && shop.onF()) { hideHint(); return; }
          if (player.mode === 'onfoot' && fishing && fishing.onF()) return;
          toggleVehicle(); hideHint();
        (창이 열려 있을 때의 F·Esc 는 이 모듈이 캡처 단계에서 받아 닫는다.)
     ⑥ 창이 열려 있으면 주먹·무기·앉기를 막는다 — 각 isBlocked 에 || (shop && shop.open)
     ⑦ (선택) 대화·낚시 중 숨김처럼 body.talking 에 넣으려면 busy 에 || (shop && shop.open)

   ── 옵션 ──
     THREE, scene, camera, person, GLTFLoader, dracoLoader, groundY(x,z), pathX(z), getPlayerPos() → {x,z}   — 필수
     isOnFoot(), isBlocked(), getTavern(), getQuests(), getNpcs(), getEvents(), blocks(x,z,r) → bool (상인 자리 고르기)
     onOpen(), onClose(), onEvent(type, info): 'buy'|'drink'|'expire'|'merchant'|'merchant-leave'|'open'|'close'
     isMuted() → true 면 효과음 끔.  applyScale/applyAlpha/applyCamera (기본 true)
     merchantEvery [초, 초] (기본 [150, 240]), merchantStay (기본 180), firstMerchant (기본 70초 뒤)

   ── 반환 API ──
     update(dt, t), nearShop() → 'witch'|'merchant'|null, onF() → bool, pushOut(pos, r) → bool,
     effects: { scale(), speedMul(), camMul(), alpha(), invisible(), hop(), active() → [{id, left}] },
     wardrobe: { owned(), hat(getter), cape(getter), duck(getter), wear(id), takeOff(), setCape(color), toggleDuck(on?) },
     drink(id), openShop(kind), closeShop(), open(getter), merchant(getter: {here, x, z, left, name}), hut, dispose()
   콘솔(?test): __shop.give(50), __shop.summon(i?), __shop.leave(), __shop.drink('giant'), __shop.wear('hat_crown'),
               __shop.state(), __shop.goWitch() / __shop.goMerchant() (걷는 중 순간이동)
   ════════════════════════════════════════════════════════════════════ */

const STORE_KEY = 'sangholand-shop-v1';
const AMP = 3.08, K = 0.04285714285714286;          // portfolio.js pathX 와 같은 길 곡선
const px0 = z => AMP * Math.sin(-K * z);

/* 마녀 오두막 — 동쪽 숲, 앞면이 길(-x) 쪽. 사슴 서식지(29,-18)와 시냇물(z≈-36) 사이 빈 숲 */
const HUT = { x: 21, z: -24, rotY: -Math.PI / 2 };
/* 상인 마차 자리 — 길 중심에서 6 m 옆, 마차는 길과 나란히 (side +1 = +x 쪽) */
const MERCHANT_SPOTS = [
  { z: 18, side: 1, name: '마을 연못 북쪽 길가' },
  { z: -2, side: 1, name: '창시합장 가는 길가' },
  { z: -20, side: -1, name: '시냇물 다리 남쪽 길가' },
  { z: -70, side: -1, name: '성문 앞 길가' },
].map(s => ({ ...s, x: +(px0(s.z) + s.side * 6.2).toFixed(2) }));

/* 나무 비우기 자리 (portfolio.js clearTrees) */
export const SHOP_CLEAR = {
  r: 4.2,
  spots: [
    [HUT.x, HUT.z], [HUT.x - 3, HUT.z - 2.5], [HUT.x - 3, HUT.z + 2.5], [HUT.x + 2.5, HUT.z], [HUT.x - 5.5, HUT.z],
    ...MERCHANT_SPOTS.flatMap(s => [[s.x + s.side * 1.4, s.z - 2.6], [s.x + s.side * 1.4, s.z + 2.6], [s.x - s.side * 0.9, s.z]]),
  ],
};

const POTIONS = {
  giant:   { name: '거인 물약', icon: '🍄', color: '#d0402c', price: 8, dur: 40, desc: '쑥쑥! 몸이 두 배 넘게 커져요. 쿵쿵 걸으면 마을이 들썩.' },
  tiny:    { name: '꼬마 물약', icon: '🐭', color: '#e88bd0', price: 6, dur: 40, desc: '쪼그라들어 손바닥만 해져요. 목소리도 삐약삐약.' },
  wind:    { name: '바람 물약', icon: '🌪️', color: '#6fd3e8', price: 5, dur: 45, desc: '발에 바람이 붙어요. 걷기·달리기가 거의 두 배!' },
  feather: { name: '깃털 물약', icon: '🪶', color: '#f4f1e6', price: 6, dur: 35, desc: '몸이 깃털처럼 가벼워져 깡총깡총, 서 있으면 둥실.' },
  ghost:   { name: '투명 물약', icon: '👻', color: '#b9c7ff', price: 10, dur: 30, desc: '몸이 흐릿해져요. 경비병도 당신을 못 찾아요.' },
  sober:   { name: '술 깨는 물약', icon: '🍵', color: '#8fd16a', price: 2, dur: 0, desc: '쓰디쓴 약초차. 한 모금이면 정신이 번쩍!' },
  gold:    { name: '황금 물약', icon: '✨', color: '#ffd34a', price: 25, dur: 30, rare: true, desc: '떠돌이 상인의 희귀품. 닿는 사람마다 반짝반짝, 은화가 툭!' },
};
const WITCH_POTIONS = ['giant', 'tiny', 'wind', 'feather', 'ghost', 'sober'];

const HATS = {
  hat_feather: { name: '깃털 모자', icon: '🪶', price: 12, desc: '초록 사냥꾼 모자에 빨간 깃털 하나.' },
  hat_crown:   { name: '왕관', icon: '👑', price: 30, desc: '임금님 흉내! (진짜 임금님께는 비밀)' },
  hat_helmet:  { name: '기사 투구', icon: '🪖', price: 20, desc: '반짝이는 강철 투구와 빨간 깃 장식.' },
  hat_witch:   { name: '마녀 모자', icon: '🧙', price: 15, desc: '끝이 꼬부라진 보라 띠 뾰족 모자.' },
  hat_flowers: { name: '꽃 화관', icon: '🌸', price: 10, desc: '들꽃을 엮은 봄 화관.' },
};
const CAPES = {
  red:    { name: '왕실 빨강', hex: '#a02c30', price: 0 },
  green:  { name: '숲 초록', hex: '#2f7a3a', price: 6 },
  purple: { name: '마녀 보라', hex: '#6a3a9a', price: 6 },
  black:  { name: '밤 검정', hex: '#26232b', price: 6 },
  gold:   { name: '황금', hex: '#d9a521', price: 6 },
  pink:   { name: '벚꽃 분홍', hex: '#e27aa8', price: 6 },
  white:  { name: '눈 하양', hex: '#e9e6df', price: 6 },
};
const DUCK = { id: 'duck', name: '애완 오리', icon: '🦆', price: 18, desc: '어디든 졸졸 따라오는 노란 오리. 꽥!' };

const WITCH_HELLO = [
  '히히히… 어서 오렴! 오늘 솥은 특히 잘 끓는단다.',
  '임금님도 몰래 거인 물약을 사 가셨지. 쉿!',
  '바람 물약 마시고 성문까지 30초 컷, 어떠냐?',
  '꼬마 물약은 오리랑 친구 되기 딱 좋아.',
  '투명 물약? 경비병 아저씨들한텐 비밀이란다~',
];
const MERCHANT_HELLO = [
  '먼 동쪽 나라에서 온 물건들이오! 오늘만 이 값!',
  '왕관 하나 써 보시오. 임금님 흉내엔 이만한 게 없지.',
  '오리는 덤… 아니, 덤은 아니오. 18닢이오.',
  '망토 색이 지겨우시오? 염색약 있소이다!',
];
const GIANT_LINES = ['거인이다!', '으악, 밟지 마세요!', '임금님보다 크다!', '하늘이 가려졌어!', '저, 저게 뭐야?!'];
const TINY_NPC = ['어머, 귀여워라!', '꼬마 기사님이네!', '어디서 삐약 소리가…?', '밟을 뻔했잖아!'];
const TINY_SELF = ['삐약!', '나 여기 있어요!', '삑삑!', '크게 말하는 중!'];
const GHOST_LINES = ['방금 뭐가 지나갔지?', '…바람인가?', '오싹하네…', '누구 있어요?'];

const CSS = `
.sh-prompt{position:fixed;left:0;top:0;z-index:42;transform:translate(-50%,-100%);display:inline-flex;align-items:center;gap:8px;
  padding:7px 12px 7px 8px;border-radius:999px;border:1px solid rgba(107,68,35,.55);background:rgba(250,240,214,.95);
  color:#3b2412;font:600 13px/1.2 Georgia,'Nanum Myeongjo',serif;box-shadow:0 6px 18px rgba(40,24,10,.25);cursor:pointer;pointer-events:auto}
.sh-prompt[hidden],.sh-panel[hidden],.sh-dim[hidden],.sh-fx[hidden]{display:none}
.sh-prompt kbd{font:700 11px/1 ui-monospace,monospace;background:#3b2412;color:#f6e7c4;border-radius:5px;padding:4px 6px}
body.is-touch .sh-prompt kbd{display:none}
.sh-dim{position:fixed;inset:0;z-index:51;background:rgba(30,18,8,.28);touch-action:none}
.sh-panel{position:fixed;left:50%;top:50%;z-index:52;transform:translate(-50%,-50%);width:min(580px,calc(100vw - 24px));max-height:min(86vh,740px);
  display:flex;flex-direction:column;border-radius:16px;background:linear-gradient(180deg,#fbf1d6,#efdcb2);border:2px solid #6b4423;
  outline:1px solid rgba(255,248,230,.7);outline-offset:-7px;box-shadow:0 22px 50px rgba(40,24,10,.42);color:#3b2412;
  font:14px/1.45 Georgia,'Nanum Myeongjo',serif;animation:sh-pop .22s cubic-bezier(.2,1.3,.4,1)}
.sh-panel.witch{background:linear-gradient(180deg,#f3ecd9,#dfe3c4)}
@keyframes sh-pop{from{transform:translate(-50%,-46%) scale(.95);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
.sh-panel .hd{display:flex;align-items:center;gap:10px;padding:16px 18px 8px;border-bottom:1.5px dashed rgba(107,68,35,.4);flex-wrap:wrap}
.sh-panel .hd h2{margin:0;font-size:20px;font-weight:800;letter-spacing:-.01em}
.sh-panel .hd .coin{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700}
.sh-panel .hd .coin i{width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,#c9ccd2 45%,#8a8f98);box-shadow:0 0 0 1px #6c7078}
.sh-panel .hd .x{border:1px solid #6b4423;background:transparent;color:#3b2412;border-radius:8px;width:32px;height:32px;font:700 16px/1 Georgia,serif;cursor:pointer}
.sh-panel .say{width:100%;font-size:13px;font-style:italic;opacity:.85;margin-top:2px;word-break:keep-all}
.sh-panel .bd{overflow:auto;padding:12px 16px 14px;display:grid;grid-template-columns:1fr 1fr;gap:9px;-webkit-overflow-scrolling:touch}
.sh-panel .bd h3{grid-column:1/-1;margin:6px 0 0;font-size:13px;letter-spacing:.05em;opacity:.8}
.sh-card{position:relative;padding:10px 11px 10px 48px;border-radius:12px;background:rgba(255,250,236,.75);border:1.5px solid rgba(107,68,35,.35);display:flex;flex-direction:column}
.sh-card.on{border-color:#b5651d;background:#fff6dc;box-shadow:0 0 0 3px rgba(181,101,29,.18)}
.sh-card.rare{border-color:#c9a227;background:linear-gradient(180deg,#fff8dc,#fbe9b0)}
.sh-card .ic{position:absolute;left:10px;top:10px;width:30px;height:30px;font-size:24px;line-height:30px;text-align:center}
.sh-card .bt{position:absolute;left:12px;top:10px;width:24px;height:32px;border-radius:6px 6px 10px 10px;box-shadow:inset -4px -4px 0 rgba(0,0,0,.18),inset 3px 3px 0 rgba(255,255,255,.45),0 0 0 1.5px #3b2412}
.sh-card .bt::before{content:'';position:absolute;left:7px;top:-7px;width:10px;height:8px;background:#8a5a32;border-radius:2px;box-shadow:0 0 0 1.5px #3b2412}
.sh-card .tt{font-weight:800;font-size:15px}
.sh-card .ds{font-size:12.5px;margin-top:2px;word-break:keep-all;overflow-wrap:anywhere;flex:1}
.sh-card .ft{display:flex;align-items:center;gap:6px;margin-top:7px;flex-wrap:wrap}
.sh-card .tm{font-size:11.5px;opacity:.75}
.sh-card button{margin-left:auto;border:1.5px solid #6b4423;background:#6b4423;color:#fbefd2;border-radius:9px;padding:6px 11px;font:700 12.5px Georgia,'Nanum Myeongjo',serif;cursor:pointer;white-space:nowrap}
.sh-card button.off{background:transparent;color:#6b4423}
.sh-card button:disabled{opacity:.4;cursor:default}
.sh-capes{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px}
.sh-capes button{display:inline-flex;align-items:center;gap:6px;border:1.5px solid rgba(107,68,35,.45);background:rgba(255,250,236,.7);color:#3b2412;border-radius:999px;padding:5px 10px 5px 6px;font:600 12px Georgia,'Nanum Myeongjo',serif;cursor:pointer}
.sh-capes button i{width:18px;height:18px;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.35)}
.sh-capes button.on{border-color:#b5651d;background:#fff6dc;box-shadow:0 0 0 3px rgba(181,101,29,.2)}
.sh-panel .fo{padding:8px 16px 12px;font-size:11.5px;opacity:.7;text-align:center}
body.is-touch .sh-panel .fo{display:none}
.sh-fx{position:fixed;left:50%;top:70px;z-index:39;transform:translateX(-50%);display:flex;gap:6px;flex-wrap:wrap;justify-content:center;pointer-events:none;max-width:calc(100vw - 24px)}
.sh-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 6px;border-radius:999px;background:rgba(250,240,214,.94);border:1.5px solid #6b4423;
  color:#3b2412;font:700 12px/1 Georgia,'Nanum Myeongjo',serif;box-shadow:0 4px 12px rgba(40,24,10,.2);position:relative;overflow:hidden}
.sh-chip .ic{font-size:15px}
.sh-chip .bar{position:absolute;left:0;bottom:0;height:3px;background:var(--c,#b5651d)}
.sh-chip.low{animation:sh-blink .5s steps(2) infinite}
@keyframes sh-blink{50%{opacity:.55}}
.sh-toast{position:fixed;left:50%;top:164px;z-index:44;transform:translate(-50%,-8px);opacity:0;transition:opacity .25s,transform .25s;
  padding:9px 15px;border-radius:12px;background:rgba(250,240,214,.97);border:1.5px solid #6b4423;color:#3b2412;max-width:calc(100vw - 32px);
  font:600 13.5px Georgia,'Nanum Myeongjo',serif;box-shadow:0 8px 22px rgba(40,24,10,.25);pointer-events:none;text-align:center;word-break:keep-all}
.sh-toast.on{opacity:1;transform:translate(-50%,0)}
.sh-toast b{color:#8a4a12}
body.intro-on .sh-prompt,body.intro-on .sh-fx,body[data-view="doc"] .sh-prompt,body[data-view="doc"] .sh-fx,
body[data-view="doc"] .sh-toast,body.talking .sh-prompt{display:none}
@media (max-width:560px){.sh-panel .bd{grid-template-columns:1fr}.sh-panel .hd h2{font-size:17px}.sh-fx{top:64px}}
`;

export function createShop({
  THREE, scene, camera, person, GLTFLoader, dracoLoader = null, groundY = () => 0, pathX = px0,
  getPlayerPos, isOnFoot = () => true, isBlocked = () => false,
  getTavern = () => null, getQuests = () => null, getNpcs = () => null, getEvents = () => null,
  blocks = null, onOpen = null, onClose = null, onEvent = null, isMuted = () => false,
  applyScale = true, applyAlpha = true, applyCamera = true,
  merchantEvery = [150, 240], merchantStay = 180, firstMerchant = 70,
  debug = new URLSearchParams(location.search).has('test'),
} = {}) {
  const V3 = THREE.Vector3;
  const rr = (a, b) => a + (b - a) * Math.random();
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const safe = f => { try { return f(); } catch { return null; } };
  const emit = (type, info) => { if (onEvent) safe(() => onEvent(type, info)); };
  const _v = new V3(), _v2 = new V3(), _m = new THREE.Matrix4();
  let disposed = false;

  /* ── 저장 ── */
  let save = { owned: [], hat: null, cape: 'red', duck: false, purse: 0 };
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (s && typeof s === 'object') save = Object.assign(save, s); } catch { /* 새로 */ }
  if (!Array.isArray(save.owned)) save.owned = [];
  if (!CAPES[save.cape]) save.cape = 'red';
  const persist = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(save)); } catch { /* 괜찮다 */ } };
  const owns = id => save.owned.includes(id) || (id.startsWith('cape_') && CAPES[id.slice(5)] && CAPES[id.slice(5)].price === 0);

  /* ── 은화 ── */
  function coins() {
    const tv = safe(getTavern);
    if (tv && typeof tv.addCoins === 'function') return tv.coins | 0;
    const q = safe(getQuests);
    if (q && typeof q.addCoins === 'function') return q.coins | 0;
    return save.purse | 0;
  }
  function addCoins(n) {
    const tv = safe(getTavern);
    if (tv && typeof tv.addCoins === 'function') { safe(() => tv.addCoins(n)); return; }
    const q = safe(getQuests);
    if (q && typeof q.addCoins === 'function') { safe(() => q.addCoins(n)); return; }
    save.purse = (save.purse | 0) + n; persist();
  }
  function spend(price) {
    if (price <= 0) return true;
    if (coins() < price) return false;
    addCoins(-price); return true;
  }

  /* ── DOM ── */
  if (!document.getElementById('sh-style')) {
    const st = document.createElement('style'); st.id = 'sh-style'; st.textContent = CSS; document.head.appendChild(st);
  }
  const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; document.body.appendChild(e); return e; };
  const promptEl = el('button', 'sh-prompt', '<kbd>F</kbd><span>가게 보기</span>'); promptEl.type = 'button'; promptEl.hidden = true;
  const dim = el('div', 'sh-dim'); dim.hidden = true;
  const panel = el('div', 'sh-panel'); panel.hidden = true; panel.setAttribute('role', 'dialog');
  const fxBar = el('div', 'sh-fx'); fxBar.hidden = true; fxBar.setAttribute('aria-live', 'polite');
  const toastEl = el('div', 'sh-toast');
  let toastT = 0;
  function toast(html, sec = 2.8) { toastEl.innerHTML = html; toastEl.classList.add('on'); toastT = sec; }

  /* ── 소리 ── */
  let actx = null;
  function ac() {
    if (isMuted()) return null;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch { return null; }
  }
  function tone(f0, f1, dur, type = 'sine', vol = 0.08, delay = 0) {
    const a = ac(); if (!a) return;
    try {
      const t0 = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    } catch { /* 소리 없이 */ }
  }
  const sfx = {
    coin() { [1319, 1760, 2093].forEach((f, i) => tone(f, f * 0.98, 0.18, 'triangle', 0.06, i * 0.06)); },
    bad() { tone(330, 220, 0.25, 'square', 0.04); tone(247, 180, 0.3, 'square', 0.035, 0.12); },
    glug() { for (let i = 0; i < 4; i++) tone(420 - i * 50, 180 - i * 20, 0.12, 'sine', 0.09, i * 0.13); },
    magic() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.05, 0.45 + i * 0.07)); },
    thud(k = 1) { tone(90, 38, 0.32, 'sine', 0.16 * k); tone(160, 60, 0.12, 'triangle', 0.05 * k); },
    squeak() { tone(1800, 2600, 0.08, 'square', 0.03); tone(2400, 1700, 0.09, 'square', 0.025, 0.09); },
    quack() { tone(520, 300, 0.11, 'sawtooth', 0.045); tone(480, 280, 0.12, 'sawtooth', 0.04, 0.14); },
    pop() { tone(700, 1400, 0.06, 'sine', 0.025); },
    sparkle() { [2093, 2637, 3136].forEach((f, i) => tone(f, f, 0.12, 'sine', 0.03, i * 0.05)); },
    horn() { tone(392, 392, 0.25, 'triangle', 0.06); tone(523, 523, 0.4, 'triangle', 0.06, 0.25); },
  };

  /* ── 공용 재질 ── */
  const owned = [];
  const own = o => { owned.push(o); return o; };
  const std = (color, o = {}) => own(new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }));
  const M = {
    wood: std(0x6e4a2c, { roughness: 0.9 }), woodD: std(0x3f2817, { roughness: 0.92 }), plaster: std(0xb9ab8c, { roughness: 0.95 }),
    stone: std(0x77736c, { roughness: 0.95 }), roof: std(0x4a3a5c, { roughness: 0.85 }), roofD: std(0x342843, { roughness: 0.9 }),
    iron: std(0x1e1d22, { roughness: 0.45, metalness: 0.7 }), glowWin: std(0xffe9a0, { emissive: 0xffc860, emissiveIntensity: 0.9, roughness: 0.6 }),
    brew: own(new THREE.MeshBasicMaterial({ color: 0x5dff6a })), fire: own(new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9, depthWrite: false })),
    green: std(0x3d7a2e), red: std(0xc0281e), white: std(0xf3efe2), gold: std(0xe0b030, { metalness: 0.85, roughness: 0.28 }),
    steel: std(0xb8bec6, { metalness: 0.9, roughness: 0.3 }), black: std(0x18161c), witchHat: std(0x2a1f3d, { roughness: 0.85 }),
    band: std(0x7d3fb8, { roughness: 0.6 }), cloth1: std(0xb3332b, { roughness: 0.9, side: THREE.DoubleSide }), cloth2: std(0xf1e4c4, { roughness: 0.9, side: THREE.DoubleSide }),
    duck: std(0xffd23a, { roughness: 0.6 }), beak: std(0xff8a1e, { roughness: 0.5 }), eye: std(0x111111, { roughness: 0.2 }),
    mush: std(0xd8322a, { roughness: 0.6 }), stem: std(0xf0e6cf), pumpkin: std(0xe0761e, { roughness: 0.7 }), herb: std(0x6f8a3a),
    velvet: std(0x8a1f2a, { roughness: 0.95 }), gemR: std(0xe0203a, { roughness: 0.15, emissive: 0x500010 }), gemB: std(0x2a5ae0, { roughness: 0.15, emissive: 0x0a1a50 }),
  };
  const G = {
    box: own(new THREE.BoxGeometry(1, 1, 1)), sph: own(new THREE.SphereGeometry(1, 16, 12)), sphLo: own(new THREE.SphereGeometry(1, 10, 7)),
    cyl: own(new THREE.CylinderGeometry(1, 1, 1, 14)), cone: own(new THREE.ConeGeometry(1, 1, 14)), cone4: own(new THREE.ConeGeometry(1, 1, 4)),
  };
  function mesh(geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, shadow = true) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
    m.castShadow = shadow; m.receiveShadow = shadow; parent.add(m); return m;
  }

  /* ── 파티클 (한 종류당 draw call 1) ── */
  function makeParticles(n, additive) {
    const geo = own(new THREE.BufferGeometry());
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
    const aP = new THREE.BufferAttribute(pos, 3), aC = new THREE.BufferAttribute(col, 3), aS = new THREE.BufferAttribute(size, 1), aA = new THREE.BufferAttribute(alpha, 1);
    for (const a of [aP, aC, aS, aA]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', aP); geo.setAttribute('aColor', aC); geo.setAttribute('aSize', aS); geo.setAttribute('aAlpha', aA);
    const mat = own(new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale; varying float vA; varying vec3 vC;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(0.2, -mv.z); vA = aAlpha; vC = aColor; }`,
      fragmentShader: `varying float vA; varying vec3 vC;
        void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
          float a = smoothstep(0.5, ${additive ? '0.0' : '0.2'}, r) * vA; gl_FragColor = vec4(vC * ${additive ? '(1.0 + 1.5 * smoothstep(0.25, 0.0, r))' : '1.0'}, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 6; scene.add(pts);
    const P = Array.from({ length: n }, () => ({ life: 0 }));
    let head = 0, alive = 0, dirty = true;
    const c = new THREE.Color();
    function emit(x, y, z, o = {}) {
      const p = P[head]; head = (head + 1) % n;
      p.x = x; p.y = y; p.z = z; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
      p.max = p.life = o.life || 1; p.s0 = o.s0 ?? 0.2; p.s1 = o.s1 ?? p.s0; p.a0 = o.a ?? 1;
      p.g = o.g || 0; p.drag = o.drag || 0; p.fadeIn = o.fadeIn || 0;
      c.set(o.color ?? 0xffffff); p.r = c.r; p.gg = c.g; p.b = c.b;
    }
    function update(dt) {
      mat.uniforms.uScale.value = innerHeight * Math.min(2, devicePixelRatio || 1) * 0.5 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      alive = 0;
      for (let i = 0; i < n; i++) {
        const p = P[i];
        if (p.life > 0) {
          p.life -= dt; alive++;
          const k = Math.max(0, 1 - p.drag * dt);
          p.vx *= k; p.vy = p.vy * k - p.g * dt; p.vz *= k;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          const u = 1 - Math.max(0, p.life) / p.max;
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
          col[i * 3] = p.r; col[i * 3 + 1] = p.gg; col[i * 3 + 2] = p.b;
          size[i] = p.s0 + (p.s1 - p.s0) * u;
          alpha[i] = p.a0 * Math.min(1, p.fadeIn ? u / p.fadeIn : 1) * (1 - u * u);
          if (p.life <= 0) { size[i] = 0; alpha[i] = 0; }
          dirty = true;
        }
      }
      if (dirty) { aP.needsUpdate = aC.needsUpdate = aS.needsUpdate = aA.needsUpdate = true; dirty = alive > 0; }
      pts.visible = alive > 0;
    }
    return { emit, update, pts };
  }
  const soft = makeParticles(260, false);     // 김·먼지·연기
  const glow = makeParticles(220, true);      // 거품 빛·반짝이·마법 가루

  /* ── 머리 맞춤: 스킨의 바인드 자세로 Head 뼈 기준 모자 자리를 구한다 (지금 동작과 상관없이 정확) ── */
  function headFit(root) {
    const skinned = [];
    root.traverse(o => { if (o.isSkinnedMesh && o.skeleton) skinned.push(o); });
    if (!skinned.length) return null;
    const bone = skinned[0].skeleton.bones.find(b => b.name === 'Head');
    if (!bone) return null;
    const box = new THREE.Box3(), v = new V3();
    let Binv = null;
    for (const m of skinned) {
      const bi = m.skeleton.bones.indexOf(bone); if (bi < 0) continue;
      if (!Binv) Binv = m.skeleton.boneInverses[bi].clone();
      const g = m.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
      if (!P || !SI || !SW) continue;
      for (let i = 0; i < P.count; i++) {
        let w = 0;
        if (SI.getX(i) === bi) w += SW.getX(i); if (SI.getY(i) === bi) w += SW.getY(i);
        if (SI.getZ(i) === bi) w += SW.getZ(i); if (SI.getW(i) === bi) w += SW.getW(i);
        if (w < 0.6) continue;
        v.fromBufferAttribute(P, i).applyMatrix4(m.bindMatrix); box.expandByPoint(v);
      }
    }
    if (!Binv || box.isEmpty()) return null;
    return { bone, box, Binv };
  }
  /* obj: 머리 폭 1 기준으로 만든 모형 (원점 = 정수리 가운데, +y 위, +z 앞) */
  function putOnHead(fit, obj, { down = 0, fwd = 0, size = 1 } = {}) {
    const b = fit.box, w = (b.max.x - b.min.x) * size;
    const hw = b.max.x - b.min.x;
    _m.compose(_v.set((b.min.x + b.max.x) / 2, b.max.y - down * hw, (b.min.z + b.max.z) / 2 + fwd * hw), new THREE.Quaternion(), _v2.set(w, w, w));
    const local = fit.Binv.clone().multiply(_m);
    local.decompose(obj.position, obj.quaternion, obj.scale);
    fit.bone.add(obj);
    return obj;
  }

  /* ── 모자 모형 (머리 폭 = 1) ── */
  function buildHat(id) {
    const g = new THREE.Group(); g.name = id;
    if (id === 'hat_feather') {
      mesh(G.sph, M.green, g, 0, -0.08, -0.04, 0.6, 0.42, 0.78, -0.25, 0, 0);
      mesh(G.cyl, M.green, g, 0, -0.26, -0.02, 0.66, 0.06, 0.78, -0.12, 0, 0);
      mesh(G.cone4, M.green, g, 0, 0.12, -0.38, 0.12, 0.55, 0.12, -1.25, 0, 0);
      mesh(G.sph, M.red, g, 0.42, 0.18, -0.22, 0.07, 0.62, 0.17, -0.85, 0, -0.35);
      mesh(G.box, M.gold, g, 0.4, -0.1, 0.05, 0.05, 0.1, 0.1);
    } else if (id === 'hat_crown') {
      const band = own(new THREE.CylinderGeometry(0.58, 0.54, 0.3, 20, 1, true));
      mesh(band, own(M.gold.clone()), g, 0, -0.12, 0).material.side = THREE.DoubleSide;
      mesh(G.sph, M.velvet, g, 0, -0.05, 0, 0.53, 0.32, 0.53);
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2, x = Math.sin(a) * 0.57, z = Math.cos(a) * 0.57;
        mesh(G.cone4, M.gold, g, x, 0.12, z, 0.08, 0.22, 0.08, 0, a + Math.PI / 4, 0);
        mesh(G.sphLo, M.gold, g, x, 0.25, z, 0.04, 0.04, 0.04);
        mesh(G.sphLo, i % 2 ? M.gemB : M.gemR, g, Math.sin(a) * 0.6, -0.12, Math.cos(a) * 0.6, 0.06, 0.06, 0.04, 0, a, 0);
      }
      mesh(G.sphLo, M.gold, g, 0, 0.17, 0, 0.07, 0.07, 0.07);
    } else if (id === 'hat_helmet') {
      mesh(G.cyl, M.steel, g, 0, -0.42, 0.02, 0.66, 0.78, 0.7);
      mesh(G.sph, M.steel, g, 0, -0.04, 0.02, 0.66, 0.36, 0.7);
      mesh(G.box, M.black, g, 0, -0.42, 0.7, 0.8, 0.07, 0.04);
      mesh(G.box, M.steel, g, 0, -0.55, 0.72, 0.09, 0.42, 0.04);
      mesh(G.box, M.gold, g, 0, -0.03, 0.02, 0.06, 0.06, 1.42);
      mesh(G.sph, M.red, g, 0, 0.26, -0.16, 0.12, 0.3, 0.5, 0.5, 0, 0);
    } else if (id === 'hat_witch') {
      mesh(G.cyl, M.witchHat, g, 0, -0.16, 0, 1.15, 0.035, 1.15);
      mesh(own(new THREE.CylinderGeometry(0.38, 0.56, 0.5, 18)), M.witchHat, g, 0, 0.08, 0);
      mesh(own(new THREE.CylinderGeometry(0.565, 0.565, 0.12, 18)), M.band, g, 0, -0.08, 0);
      mesh(G.box, M.gold, g, 0, -0.08, 0.56, 0.16, 0.13, 0.04);
      const t1 = new THREE.Group(); t1.position.set(0, 0.32, 0); t1.rotation.x = -0.35; g.add(t1);
      mesh(own(new THREE.CylinderGeometry(0.2, 0.38, 0.45, 16)), M.witchHat, t1, 0, 0.2, 0);
      const t2 = new THREE.Group(); t2.position.set(0, 0.42, 0); t2.rotation.x = -0.6; t1.add(t2);
      mesh(own(new THREE.ConeGeometry(0.2, 0.45, 14)), M.witchHat, t2, 0, 0.2, 0);
    } else if (id === 'hat_flowers') {
      mesh(own(new THREE.TorusGeometry(0.5, 0.045, 6, 24)), M.herb, g, 0, -0.16, 0, 1, 1, 1, Math.PI / 2, 0, 0);
      const cols = [0xf28cb8, 0xffffff, 0xffd84a, 0x8fb8ff, 0xff7a6a];
      for (let i = 0; i < 11; i++) {
        const a = i / 11 * Math.PI * 2, x = Math.sin(a) * 0.5, z = Math.cos(a) * 0.5;
        const fm = std(cols[i % cols.length], { roughness: 0.6 });
        for (let k = 0; k < 5; k++) { const b = k / 5 * Math.PI * 2; mesh(G.sphLo, fm, g, x + Math.cos(b) * 0.06, -0.12, z + Math.sin(b) * 0.06, 0.055, 0.03, 0.055, 0, 0, 0, false); }
        mesh(G.sphLo, M.gold, g, x, -0.1, z, 0.035, 0.03, 0.035, 0, 0, 0, false);
      }
    }
    return g;
  }
  const HAT_FIT = {
    hat_feather: { down: 0.12 }, hat_crown: { down: 0.06 }, hat_helmet: { down: 0.02, size: 1.0 },
    hat_witch: { down: 0.06 }, hat_flowers: { down: 0.04 },
  };

  /* ── 오리 모형 ── */
  function buildDuck() {
    const g = new THREE.Group(); g.name = 'pet-duck';
    const body = new THREE.Group(); g.add(body);
    mesh(G.sph, M.duck, body, 0, 0.15, 0, 0.15, 0.12, 0.2);
    mesh(G.cone, M.duck, body, 0, 0.2, -0.2, 0.06, 0.12, 0.06, -1.9, 0, 0);
    const head = new THREE.Group(); head.position.set(0, 0.32, 0.13); body.add(head);
    mesh(G.sph, M.duck, head, 0, 0, 0, 0.09, 0.09, 0.09);
    mesh(G.box, M.beak, head, 0, -0.015, 0.1, 0.07, 0.025, 0.08);
    mesh(G.sphLo, M.eye, head, 0.05, 0.025, 0.065, 0.015, 0.015, 0.015, 0, 0, 0, false);
    mesh(G.sphLo, M.eye, head, -0.05, 0.025, 0.065, 0.015, 0.015, 0.015, 0, 0, 0, false);
    const wL = mesh(G.sph, M.duck, body, 0.14, 0.17, -0.02, 0.03, 0.08, 0.14);
    const wR = mesh(G.sph, M.duck, body, -0.14, 0.17, -0.02, 0.03, 0.08, 0.14);
    mesh(G.box, M.beak, g, 0.05, 0.02, 0.03, 0.05, 0.03, 0.08); mesh(G.box, M.beak, g, -0.05, 0.02, 0.03, 0.05, 0.03, 0.08);
    g.userData = { body, head, wL, wR };
    return g;
  }

  /* ── 말풍선 스프라이트 (플레이어·마녀·상인) ── */
  function makeBubble() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const tex = own(new THREE.CanvasTexture(cv)); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = own(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
    const sp = new THREE.Sprite(mat); sp.visible = false; sp.renderOrder = 20; sp.scale.set(2.4, 0.6, 1); scene.add(sp);
    const b = { sp, t: 0, text: '' };
    b.say = (text, life = 1.8, color = '#3b2412') => {
      const c = cv.getContext('2d'); c.clearRect(0, 0, 512, 128);
      c.font = '700 44px Georgia, "Nanum Myeongjo", serif';
      const w = Math.min(500, c.measureText(text).width + 56), x0 = (512 - w) / 2;
      c.fillStyle = 'rgba(250,240,214,.96)'; c.strokeStyle = '#6b4423'; c.lineWidth = 5;
      c.beginPath(); c.roundRect(x0, 8, w, 84, 40); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(246, 90); c.lineTo(256, 118); c.lineTo(270, 90); c.closePath(); c.fill();
      c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 52);
      tex.needsUpdate = true; b.t = life; b.text = text; sp.visible = true;
    };
    b.update = (dt, x, y, z, s = 1) => {
      if (b.t <= 0) { sp.visible = false; return; }
      b.t -= dt; sp.position.set(x, y, z); sp.scale.set(2.4 * s, 0.6 * s, 1);
      sp.material.opacity = Math.min(1, b.t * 4);
    };
    return b;
  }
  const meBubble = makeBubble(), witchBubble = makeBubble(), merchBubble = makeBubble();

  /* ════════ ① 마녀 오두막 ════════ */
  const hutG = new THREE.Group(); hutG.name = 'witch-hut';
  const HY = groundY(HUT.x, HUT.z);
  hutG.position.set(HUT.x, HY, HUT.z); hutG.rotation.y = HUT.rotY;
  scene.add(hutG);
  const hc = Math.cos(HUT.rotY), hs = Math.sin(HUT.rotY);
  const hutW = (lx, lz) => ({ x: HUT.x + hc * lx + hs * lz, z: HUT.z - hs * lx + hc * lz });   // 오두막 로컬 → 월드
  const WITCH_L = { x: -0.5, z: 2.35 }, CAUL_L = { x: 1.55, z: 2.7 }, SHELF_L = { x: -2.35, z: 2.0 }, COUNTER_L = { x: -0.5, z: 3.05 };
  const witchW = hutW(WITCH_L.x, WITCH_L.z), caulW = hutW(CAUL_L.x, CAUL_L.z);
  const lift = (lx, lz) => { const p = hutW(lx, lz); return groundY(p.x, p.z) - HY; };   // 경사 보정
  let caulLiquid = null, fireMeshes = [], chimneyTop = new V3(), bottleMesh = null;
  {
    /* 주춧돌 + 비뚤어진 벽 */
    mesh(G.box, M.stone, hutG, 0, -0.25, 0, 3.9, 0.9, 3.5);
    const walls = new THREE.Group(); walls.rotation.z = 0.035; walls.rotation.y = 0.04; hutG.add(walls);
    mesh(G.box, M.plaster, walls, 0, 1.3, 0, 3.4, 2.4, 3.0);
    for (const x of [-1.68, 1.68]) for (const z of [-1.48, 1.48]) mesh(G.box, M.woodD, walls, x, 1.3, z, 0.16, 2.5, 0.16);
    mesh(G.box, M.woodD, walls, 0, 2.48, 1.5, 3.5, 0.14, 0.12); mesh(G.box, M.woodD, walls, 0, 0.18, 1.52, 3.5, 0.14, 0.1);
    mesh(G.box, M.woodD, walls, -1.1, 1.3, 1.52, 0.1, 2.3, 0.08, 0, 0, 0.5); mesh(G.box, M.woodD, walls, 1.15, 1.3, 1.52, 0.1, 2.3, 0.08, 0, 0, -0.45);
    /* 문 (아치) */
    mesh(G.box, M.wood, walls, 0.05, 0.85, 1.53, 0.9, 1.5, 0.08);
    mesh(own(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16, 1, false, 0, Math.PI)), M.wood, walls, 0.05, 1.6, 1.53, 1, 1, 1, Math.PI / 2, 0, Math.PI / 2);
    mesh(G.sphLo, M.gold, walls, 0.35, 0.9, 1.6, 0.05, 0.05, 0.05);
    /* 창 (불빛) */
    for (const x of [-1.05, 1.05]) {
      mesh(G.box, M.glowWin, walls, x, 1.55, 1.52, 0.55, 0.55, 0.05, 0, 0, x > 0 ? 0.08 : -0.06, false);
      mesh(G.box, M.woodD, walls, x, 1.55, 1.56, 0.6, 0.06, 0.04); mesh(G.box, M.woodD, walls, x, 1.55, 1.56, 0.06, 0.6, 0.04);
    }
    mesh(G.box, M.glowWin, walls, 1.71, 1.5, -0.3, 0.05, 0.5, 0.45, 0, 0, 0, false);
    /* 꼬부라진 지붕 */
    const roof = new THREE.Group(); roof.position.set(0, 2.5, 0); roof.rotation.set(0.05, 0.3, -0.06); walls.add(roof);
    mesh(own(new THREE.ConeGeometry(2.75, 1.7, 9)), M.roof, roof, 0, 0.75, 0);
    const r2 = new THREE.Group(); r2.position.set(0, 1.5, 0); r2.rotation.set(0.25, 0, 0.2); roof.add(r2);
    mesh(own(new THREE.ConeGeometry(1.0, 1.3, 8)), M.roofD, r2, 0, 0.55, 0);
    const r3 = new THREE.Group(); r3.position.set(0, 1.15, 0); r3.rotation.set(0.45, 0, 0.35); r2.add(r3);
    mesh(own(new THREE.ConeGeometry(0.36, 0.9, 7)), M.roof, r3, 0, 0.4, 0);
    mesh(G.sphLo, M.gold, r3, 0, 0.88, 0, 0.09, 0.09, 0.09);
    /* 굴뚝 */
    const ch = mesh(G.box, M.stone, walls, -1.0, 3.5, -0.8, 0.5, 1.6, 0.5, 0, 0.2, 0.12);
    mesh(G.box, M.stone, ch, 0, 0.55, 0, 1.25, 0.12, 1.25);
    hutG.updateMatrixWorld(true); ch.localToWorld(chimneyTop.set(0, 0.7, 0));
    /* 간판: 물약병 */
    const sign = new THREE.Group(); sign.position.set(2.2, 2.25, 1.25); hutG.add(sign);
    mesh(G.box, M.woodD, sign, 0, 0.1, 0, 0.95, 0.06, 0.06);
    mesh(G.box, M.woodD, sign, -0.25, -0.05, 0, 0.03, 0.3, 0.03); mesh(G.box, M.woodD, sign, 0.25, -0.05, 0, 0.03, 0.3, 0.03);
    {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const c = cv.getContext('2d');
      c.fillStyle = '#7a5230'; c.fillRect(0, 0, 256, 160); c.strokeStyle = '#3f2817'; c.lineWidth = 10; c.strokeRect(5, 5, 246, 150);
      c.fillStyle = '#62d96b'; c.beginPath(); c.arc(70, 92, 34, 0, Math.PI * 2); c.fill(); c.fillRect(58, 30, 24, 34);
      c.fillStyle = '#c99060'; c.fillRect(54, 22, 32, 14);
      c.fillStyle = '#fbe9c0'; c.font = '800 50px Georgia, "Nanum Myeongjo", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('물약', 172, 84);
      const tex = own(new THREE.CanvasTexture(cv)); tex.colorSpace = THREE.SRGBColorSpace;
      const pm = std(0xffffff, { map: tex });
      const board = new THREE.Group(); board.position.set(0, -0.2, 0); sign.add(board);
      mesh(G.box, [M.wood, M.wood, M.wood, M.wood, pm, pm], board, 0, -0.25, 0, 0.8, 0.5, 0.06);
      board.userData.swing = true; sign.userData.board = board;
    }
    hutG.userData.sign = sign;

    /* 가마솥 */
    const cg = new THREE.Group(); cg.position.set(CAUL_L.x, lift(CAUL_L.x, CAUL_L.z), CAUL_L.z); hutG.add(cg);
    mesh(own(new THREE.SphereGeometry(0.6, 18, 12, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.68)), M.iron, cg, 0, 0.62, 0).material.side = THREE.DoubleSide;
    mesh(own(new THREE.TorusGeometry(0.52, 0.06, 8, 22)), M.iron, cg, 0, 0.92, 0, 1, 1, 1, Math.PI / 2, 0, 0);
    caulLiquid = mesh(own(new THREE.CircleGeometry(0.5, 22)), M.brew, cg, 0, 0.86, 0, 1, 1, 1, -Math.PI / 2, 0, 0, false);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; mesh(G.cyl, M.iron, cg, Math.sin(a) * 0.42, 0.12, Math.cos(a) * 0.42, 0.05, 0.3, 0.05, 0, 0, 0); }
    for (let i = 0; i < 4; i++) mesh(G.cyl, M.woodD, cg, 0, 0.08, 0, 0.07, 0.8, 0.07, Math.PI / 2, i * 0.8, 0);
    for (let i = 0; i < 3; i++) fireMeshes.push(mesh(G.cone, M.fire, cg, (i - 1) * 0.15, 0.25, (i % 2) * 0.1 - 0.05, 0.12, 0.35, 0.12, 0, 0, 0, false));
    mesh(G.cyl, M.wood, cg, 0.25, 1.05, 0.1, 0.03, 0.9, 0.03, 0.2, 0, -0.5);   // 젓개

    /* 물약 선반 (병은 instanced 한 번) */
    const sh = new THREE.Group(); sh.position.set(SHELF_L.x, lift(SHELF_L.x, SHELF_L.z), SHELF_L.z); sh.rotation.y = 0.25; hutG.add(sh);
    for (const x of [-0.75, 0.75]) mesh(G.box, M.woodD, sh, x, 0.85, 0, 0.08, 1.7, 0.4);
    for (const y of [0.3, 0.85, 1.4]) mesh(G.box, M.wood, sh, 0, y, 0, 1.6, 0.06, 0.42);
    mesh(G.box, M.wood, sh, 0, 0.85, -0.19, 1.6, 1.7, 0.04);
    const ctr = new THREE.Group(); ctr.position.set(COUNTER_L.x, lift(COUNTER_L.x, COUNTER_L.z), COUNTER_L.z); hutG.add(ctr);
    mesh(G.box, M.wood, ctr, 0, 0.82, 0, 1.7, 0.08, 0.6); mesh(G.box, M.woodD, ctr, 0, 0.4, 0, 1.55, 0.8, 0.5);
    const bottleGeo = own(new THREE.LatheGeometry([
      new THREE.Vector2(0, 0), new THREE.Vector2(0.075, 0.005), new THREE.Vector2(0.09, 0.06), new THREE.Vector2(0.085, 0.13),
      new THREE.Vector2(0.03, 0.18), new THREE.Vector2(0.028, 0.24), new THREE.Vector2(0.035, 0.25), new THREE.Vector2(0, 0.26)], 10));
    const bottleMat = std(0xffffff, { roughness: 0.15, metalness: 0.05, emissive: 0x222222 });
    const spots = [];
    for (const y of [0.33, 0.88, 1.43]) for (let i = 0; i < 7; i++) spots.push([sh, -0.62 + i * 0.205 + rr(-0.02, 0.02), y, rr(-0.06, 0.06), rr(0.8, 1.3)]);
    for (let i = 0; i < 6; i++) spots.push([ctr, -0.7 + i * 0.28, 0.86, rr(-0.12, 0.12), rr(0.9, 1.5)]);
    bottleMesh = new THREE.InstancedMesh(bottleGeo, bottleMat, spots.length); bottleMesh.castShadow = true;
    const pal = Object.values(POTIONS).map(p => p.color).concat(['#7a3fd8', '#ff9a2a', '#3ae0a0']);
    hutG.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(hutG.matrixWorld).invert(), q = new THREE.Quaternion(), s = new V3();
    spots.forEach(([par, x, y, z, k], i) => {
      par.localToWorld(_v.set(x, y, z));
      _m.compose(_v.applyMatrix4(inv), q, s.set(k, k * rr(0.85, 1.25), k));
      bottleMesh.setMatrixAt(i, _m); bottleMesh.setColorAt(i, new THREE.Color(pick(pal)));
    });
    hutG.add(bottleMesh);
    /* 소품: 약초 다발, 호박, 버섯 고리 */
    for (let i = 0; i < 4; i++) mesh(G.cone, M.herb, hutG, -1.4 + i * 0.35, 2.25, 1.75, 0.08, 0.3, 0.08, Math.PI, 0, 0);
    for (const [x, z, k] of [[2.4, 1.2, 0.32], [2.75, 1.7, 0.24], [-1.4, 3.6, 0.2]]) {
      const pm = mesh(G.sph, M.pumpkin, hutG, x, lift(x, z) + k * 0.7, z, k, k * 0.75, k);
      mesh(G.cyl, M.herb, pm, 0, 1.0, 0, 0.1, 0.4, 0.1);
    }
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2, x = 3.1 + Math.cos(a) * 1.1, z = -1.2 + Math.sin(a) * 1.1, k = rr(0.7, 1.2), y = lift(x, z);
      mesh(G.cyl, M.stem, hutG, x, y + 0.08 * k, z, 0.035 * k, 0.16 * k, 0.035 * k);
      mesh(own(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), M.mush, hutG, x, y + 0.15 * k, z, k, k * 0.8, k);
    }
  }

  /* ════════ ② 떠돌이 상인 ════════ */
  const merchG = new THREE.Group(); merchG.name = 'merchant'; merchG.visible = false; scene.add(merchG);
  const merch = { here: false, spot: null, left: 0, next: firstMerchant, x: 0, z: 0, rot: 0, pending: false };
  const WAGON_X = 1.4, STALL_X = -0.9, MERCH_X = -0.05;   // 그룹 로컬 x (그룹 원점 = 길 중심에서 6.2 m)
  const STAND_L = { x: 0, z: 0 };          // 진열대 (그룹 로컬)
  const MERCH_L = { x: 0, z: 0 };
  let merchMixer = null, wagonMixer = null, merchLabel = null, merchModel = null;
  {
    /* 길 쪽(로컬 -x)에 줄무늬 차양 진열대, 그 뒤에 상인, 맨 바깥(로컬 +x)에 마차. 로컬 +z = 마차 앞(말) */
    const stall = new THREE.Group(); stall.position.set(STALL_X, 0, 0.2); merchG.add(stall);
    STAND_L.x = STALL_X; STAND_L.z = 0.2;
    mesh(G.box, M.wood, stall, -0.1, 0.8, 0, 0.7, 0.07, 2.2); mesh(G.box, M.woodD, stall, -0.1, 0.4, 0, 0.6, 0.8, 2.0);
    for (const z of [-1.15, 1.15]) { mesh(G.cyl, M.woodD, stall, -0.6, 1.1, z, 0.05, 2.2, 0.05); mesh(G.cyl, M.woodD, stall, 1.1, 1.35, z, 0.05, 2.7, 0.05); }
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const c = cv.getContext('2d');
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f1e4c4' : '#b3332b'; c.fillRect(i * 32, 0, 32, 32); }
    const stripe = own(new THREE.CanvasTexture(cv)); stripe.colorSpace = THREE.SRGBColorSpace;
    const awn = std(0xffffff, { map: stripe, roughness: 0.9 });
    mesh(G.box, awn, stall, 0.25, 2.45, 0, 2.0, 0.03, 2.6, 0, 0, 0.25);
    for (let i = 0; i < 6; i++) mesh(G.cone, i % 2 ? M.cloth2 : M.cloth1, stall, -0.72, 2.12, -1.08 + i * 0.43, 0.2, 0.22, 0.04, Math.PI, Math.PI / 2, 0, false);
    /* 진열된 모자 (작은 받침 위, 손님 쪽을 본다) */
    Object.keys(HATS).forEach((id, i) => {
      const z = -0.85 + i * 0.4;
      mesh(G.cyl, M.woodD, stall, -0.1, 0.95, z, 0.03, 0.22, 0.03);
      const h = buildHat(id); h.scale.setScalar(0.24); h.position.set(-0.1, 1.12, z); h.rotation.y = -Math.PI / 2; stall.add(h);
    });
    const duck = buildDuck(); duck.scale.setScalar(0.8); duck.position.set(-0.15, 0.84, 1.0); duck.rotation.y = -Math.PI / 2; stall.add(duck);
    MERCH_L.x = MERCH_X; MERCH_L.z = 0.2;
    /* 이름표 */
    const lc = document.createElement('canvas'); lc.width = 512; lc.height = 128; const l = lc.getContext('2d');
    l.fillStyle = 'rgba(59,36,18,.88)'; l.beginPath(); l.roundRect(8, 14, 496, 100, 50); l.fill();
    l.fillStyle = '#ffe2a8'; l.font = '800 52px Georgia, "Nanum Myeongjo", serif'; l.textAlign = 'center'; l.textBaseline = 'middle'; l.fillText('🛒 떠돌이 상인', 256, 66);
    const lt = own(new THREE.CanvasTexture(lc)); lt.colorSpace = THREE.SRGBColorSpace;
    merchLabel = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: lt, transparent: true, depthWrite: false, fog: false })));
    merchLabel.scale.set(3.2, 0.8, 1); merchLabel.position.set(0.4, 4.2, 0); merchG.add(merchLabel);
  }

  /* ── 모델 불러오기 (비동기) ── */
  let witchMixer = null, witchModel = null, witchActs = {}, merchActs = {};
  (async () => {
    try {
      const { clone: skClone } = await import('three/addons/utils/SkeletonUtils.js');
      const loader = new GLTFLoader(); if (dracoLoader) loader.setDRACOLoader(dracoLoader);
      const S = 1.95 / 1.8;
      const npc = async (file, parent, hatId, hatSize, scale) => {
        const g = await loader.loadAsync(file); if (disposed) return null;
        const model = skClone(g.scene); model.scale.setScalar(S * scale);
        model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        parent.add(model);
        const fit = headFit(model);
        if (fit && hatId) putOnHead(fit, buildHat(hatId), { ...HAT_FIT[hatId], size: hatSize });
        const mixer = new THREE.AnimationMixer(model), acts = {};
        for (const c of g.animations) acts[c.name.split('|').pop().toLowerCase()] = mixer.clipAction(c);
        if (acts.idle) acts.idle.play();
        return { model, mixer, acts };
      };
      const witchHolder = new THREE.Group(); witchHolder.position.set(WITCH_L.x, lift(WITCH_L.x, WITCH_L.z), WITCH_L.z); hutG.add(witchHolder);
      const w = await npc('models/npc/npc-herbalist.glb', witchHolder, 'hat_witch', 1.35, 0.95);
      if (w) { witchModel = witchHolder; witchMixer = w.mixer; witchActs = w.acts; }
      const mh = new THREE.Group(); mh.position.set(MERCH_L.x, 0, MERCH_L.z); mh.rotation.y = -Math.PI / 2; merchG.add(mh);
      const m = await npc('models/npc/npc-traveler.glb', mh, 'hat_feather', 1.15, 1.0);
      if (m) { merchModel = mh; merchMixer = m.mixer; merchActs = m.acts; }
      const cg = await loader.loadAsync('models/vehicles/carriage.glb'); if (disposed) return;
      const wagon = cg.scene; wagon.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      wagon.position.x = WAGON_X; merchG.add(wagon);
      if (cg.animations.length) {
        wagonMixer = new THREE.AnimationMixer(wagon);
        const idle = cg.animations.find(c => /idle$/i.test(c.name)) || cg.animations[0];
        wagonMixer.clipAction(idle).play();
      }
    } catch (err) { console.warn('[shop] 모델 불러오기 실패', err); }
  })();

  /* ════════ 플레이어 꾸미기 ════════ */
  let playerFit = null, playerModel = null, hatObj = null, clothMat = null, clothOrig = null, capeCanvas = null, capeMask = null, capeTex = null, capeBase = null;
  function findPlayer() {
    if (playerFit) return true;
    let sk = null; person.traverse(o => { if (!sk && o.isSkinnedMesh) sk = o; });
    if (!sk) return false;
    let mdl = sk; while (mdl.parent && mdl.parent !== person) mdl = mdl.parent;
    playerModel = mdl; playerFit = headFit(mdl);
    person.traverse(o => { if (o.isMesh && o.material && /cloth/i.test(o.material.name || '')) clothMat = o.material; });
    if (clothMat) clothOrig = clothMat.map;
    applyWardrobe();
    return !!playerFit;
  }
  function applyWardrobe() {
    if (!playerFit) return;
    if (hatObj) { hatObj.parent && hatObj.parent.remove(hatObj); hatObj = null; }
    if (save.hat && HATS[save.hat]) {
      hatObj = putOnHead(playerFit, buildHat(save.hat), HAT_FIT[save.hat]);
      hatObj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material = own(o.material.clone()); } });   // 투명 물약이 가게 진열품까지 흐리게 하지 않게
    }
    paintCape(save.cape);
    alphaDirty = true;
  }
  /* 망토: player_Cloth 텍스처에서 빨간 망토 픽셀만 골라 다시 칠한다 (튜닉 파랑·바지 갈색은 그대로) */
  function paintCape(color) {
    if (!clothMat || !clothOrig || !clothOrig.image) return;
    if (color === 'red' || !CAPES[color]) { if (clothMat.map !== clothOrig) { clothMat.map = clothOrig; clothMat.needsUpdate = true; } return; }
    try {
      if (!capeCanvas) {
        const img = clothOrig.image, w = img.width, h = img.height;
        capeCanvas = document.createElement('canvas'); capeCanvas.width = w; capeCanvas.height = h;
        const c = capeCanvas.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0);
        capeBase = c.getImageData(0, 0, w, h);
        const d = capeBase.data, idx = [];
        for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (r > 38 && r > g * 1.7 && r > b * 1.6) idx.push(i); }
        capeMask = new Uint32Array(idx);
        capeTex = own(clothOrig.clone()); capeTex.source = new THREE.Source(capeCanvas);   // image 세터는 원본과 공유하는 source 를 바꾸므로 새 Source
      }
      const out = new ImageData(new Uint8ClampedArray(capeBase.data), capeBase.width, capeBase.height), d = out.data;
      const tc = new THREE.Color(CAPES[color].hex), tr = tc.r * 255, tg = tc.g * 255, tb = tc.b * 255;
      /* sRGB 그대로: 원래 빨강 밝기(기준 160)에 비례해 새 색을 곱한다. 밝은 색은 조금 덜 밝힌다 */
      for (let k = 0; k < capeMask.length; k++) {
        const i = capeMask[k], l = Math.min(1.6, d[i] / 160);
        d[i] = Math.min(255, tr * l); d[i + 1] = Math.min(255, tg * l); d[i + 2] = Math.min(255, tb * l);
      }
      capeCanvas.getContext('2d').putImageData(out, 0, 0);
      capeTex.needsUpdate = true;
      clothMat.map = capeTex; clothMat.needsUpdate = true;
    } catch (err) { console.warn('[shop] 망토 염색 실패', err); }
  }

  /* 애완 오리 */
  const duck = buildDuck(); duck.visible = false; scene.add(duck);
  const D = { x: 0, z: 0, y: 0, rot: 0, phase: 0, quackT: rr(4, 9), placed: false };

  const wardrobe = {
    owned: () => save.owned.slice(),
    get hat() { return save.hat; }, get cape() { return save.cape; }, get duck() { return !!save.duck; },
    wear(id) { if (!HATS[id] || !owns(id)) return false; save.hat = save.hat === id ? null : id; persist(); applyWardrobe(); renderPanel(); return true; },
    takeOff() { save.hat = null; persist(); applyWardrobe(); renderPanel(); },
    setCape(color) { if (!CAPES[color] || !owns('cape_' + color)) return false; save.cape = color; persist(); paintCape(color); renderPanel(); return true; },
    toggleDuck(on) { if (!owns('duck')) return false; save.duck = on == null ? !save.duck : !!on; D.placed = false; persist(); renderPanel(); return true; },
  };

  /* ════════ 물약 효과 ════════ */
  const fx = {};                      // id → { left, dur }
  let curS = 1, scaleApplied = false, camM = 1, curA = 1, alphaDirty = false, hopOff = 0, lastSetY = NaN, hopPhase = 0;
  let shakeT = 0, shakeK = 0, stepDist = 0, sayCD = 0, ghostT = 0, goldTouched = new Set(), goldCoins = 0, dustT = 0, featherT = 0, tinyT = 0;
  const matState = new Map();         // 반투명 전 원래 값
  const lastP = new V3(); let pSpd = 0, haveLast = false;

  function drink(id) {
    const p = POTIONS[id]; if (!p) return false;
    sfx.glug(); sfx.magic();
    const P = person.position;
    for (let i = 0; i < 26; i++) glow.emit(P.x + rr(-0.4, 0.4) * curS, P.y + rr(0.3, 1.9) * curS, P.z + rr(-0.4, 0.4) * curS,
      { vx: rr(-0.6, 0.6), vy: rr(0.4, 1.6), vz: rr(-0.6, 0.6), life: rr(0.7, 1.3), s0: 0.16, s1: 0.03, color: p.color, drag: 1 });
    if (id === 'sober') {
      const tv = safe(getTavern);
      if (tv && typeof tv.setDrunk === 'function') safe(() => tv.setDrunk(0));
      toast('🍵 <b>술 깨는 물약</b> — 정신이 번쩍! 세상이 똑바로 보여요');
      emit('drink', { id }); return true;
    }
    if (id === 'giant') delete fx.tiny;
    if (id === 'tiny') delete fx.giant;
    fx[id] = { left: p.dur, dur: p.dur };
    if (id === 'gold') { goldTouched = new Set(); goldCoins = 0; }
    const msg = {
      giant: '🍄 <b>거인 물약</b>! 쑥쑥 커져요… 쿵! 쿵!', tiny: '🐭 <b>꼬마 물약</b>! 삐약~ 세상이 엄청 커졌어요',
      wind: '🌪️ <b>바람 물약</b>! 발에 바람이 붙었어요 (Shift 로 더 빨리)', feather: '🪶 <b>깃털 물약</b>! 걸으면 깡총깡총, 서 있으면 둥실',
      ghost: '👻 <b>투명 물약</b>! 아무도 당신을 못 봐요 (경비병도!)', gold: '✨ <b>황금 물약</b>! 사람들에게 닿아 보세요 — 반짝반짝!',
    }[id];
    toast(msg + ` <span style="opacity:.7">(${p.dur}초)</span>`, 3.2);
    if (id === 'tiny') { meBubble.say(pick(TINY_SELF), 1.6, '#c0408a'); sfx.squeak(); }
    emit('drink', { id }); renderFx(true);
    return true;
  }
  function expire(id) {
    delete fx[id];
    const p = POTIONS[id];
    toast(`${p.icon} ${p.name} 효과가 끝났어요`, 2);
    if (id === 'giant' || id === 'tiny') sfx.pop();
    emit('expire', { id }); renderFx(true);
  }
  const effects = {
    scale: () => curS,
    speedMul: () => (safe(isOnFoot) ? (fx.wind ? 1.8 : 1) * (fx.giant ? 1.6 : fx.tiny ? 0.62 : 1) : 1),
    camMul: () => camM,
    alpha: () => curA,
    invisible: () => !!fx.ghost,
    hop: () => hopOff,
    active: () => Object.keys(fx).map(id => ({ id, left: +fx[id].left.toFixed(1) })),
  };

  /* 효과 칩 (위쪽 가운데) */
  let fxKey = '';
  function renderFx(force) {
    const ids = Object.keys(fx);
    const showM = merch.here;
    const key = ids.join(',') + (showM ? '|m' : '');
    if (force || key !== fxKey) {
      fxKey = key;
      fxBar.innerHTML = ids.map(id => `<span class="sh-chip" data-id="${id}" style="--c:${POTIONS[id].color}"><span class="ic">${POTIONS[id].icon}</span><span>${POTIONS[id].name.replace(' 물약', '')}</span><b class="s"></b><i class="bar"></i></span>`).join('')
        + (showM ? '<span class="sh-chip" data-id="merchant" style="--c:#b5651d"><span class="ic">🛒</span><span>상인</span><b class="s"></b><i class="bar"></i></span>' : '');
    }
    fxBar.hidden = !ids.length && !showM;
    for (const ch of fxBar.children) {
      const id = ch.dataset.id;
      const left = id === 'merchant' ? merch.left : fx[id] ? fx[id].left : 0, dur = id === 'merchant' ? merchantStay : fx[id] ? fx[id].dur : 1;
      const s = ch.querySelector('.s'), txt = id === 'merchant' ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : `${Math.ceil(left)}초`;
      if (s.textContent !== txt) s.textContent = txt;
      ch.querySelector('.bar').style.width = (clamp01(left / dur) * 100).toFixed(1) + '%';
      ch.classList.toggle('low', id !== 'merchant' && left < 5);
    }
  }

  /* 반투명: 플레이어(모자 포함)의 재질 투명도 */
  function setAlpha(a) {
    const fade = a < 0.999;
    person.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (fade) {
          if (!matState.has(m)) matState.set(m, { t: m.transparent, o: m.opacity, d: m.depthWrite });
          if (!m.transparent) { m.transparent = true; m.needsUpdate = true; }
          m.opacity = matState.get(m).o * a; m.depthWrite = a > 0.9;
        }
      }
      if (fade) { if (o.userData.shShadow === undefined) o.userData.shShadow = o.castShadow; o.castShadow = a > 0.6 && o.userData.shShadow; }
      else if (o.userData.shShadow !== undefined) { o.castShadow = o.userData.shShadow; delete o.userData.shShadow; }
    });
    if (!fade) {
      for (const [m, s] of matState) { m.transparent = s.t; m.opacity = s.o; m.depthWrite = s.d; m.needsUpdate = true; }
      matState.clear();
    }
  }

  /* ════════ 상인 등장·퇴장 ════════ */
  function spotOk(s) {
    if (!blocks) return true;
    for (const dz of [-2.6, 0, 2.6]) if (safe(() => blocks(s.x + s.side * 1.4, s.z + dz, 1.0))) return false;
    if (safe(() => blocks(s.x - s.side * 1.0, s.z, 1.2))) return false;
    return true;
  }
  function placeMerchant(i) {
    const P = safe(getPlayerPos) || { x: 0, z: 0 };
    let cands = MERCHANT_SPOTS.map((s, k) => ({ s, k })).filter(c => spotOk(c.s));
    if (!cands.length) cands = MERCHANT_SPOTS.map((s, k) => ({ s, k }));
    let c = Number.isInteger(i) && MERCHANT_SPOTS[i] ? { s: MERCHANT_SPOTS[i], k: i } : null;
    if (!c) {
      const far = cands.filter(q => Math.hypot(q.s.x - P.x, q.s.z - P.z) > 14 && q.k !== merch.lastK);
      c = pick(far.length ? far : cands);
    }
    const s = c.s; merch.lastK = c.k; merch.spot = s;
    /* 길 방향을 따라 나란히. 로컬 +x(진열대)가 길 바깥쪽 */
    const dxdz = -AMP * K * Math.cos(-K * s.z), ang = Math.atan(dxdz);   // 길이 +z 쪽으로 기우는 각
    merch.rot = s.side > 0 ? ang : ang + Math.PI;
    merch.x = s.x; merch.z = s.z;
    merchG.position.set(s.x, groundY(s.x, s.z), s.z); merchG.rotation.y = merch.rot;
    merchG.visible = true; merch.here = true; merch.left = merchantStay;
    for (let n = 0; n < 30; n++) soft.emit(s.x + rr(-2, 2), groundY(s.x, s.z) + rr(0.1, 1.2), s.z + rr(-3, 3), { vy: rr(0.3, 1), vx: rr(-1, 1), vz: rr(-1, 1), life: rr(1, 1.8), s0: 0.6, s1: 1.4, a: 0.35, color: 0xd9c9a8, drag: 1.5 });
    toast(`🛒 <b>떠돌이 상인이 왔어요!</b><br>${s.name}에 약 ${Math.round(merchantStay / 60)}분 동안 머물러요`, 4.5);
    sfx.horn(); emit('merchant', { x: s.x, z: s.z, name: s.name }); renderFx(true);
  }
  function removeMerchant(quiet) {
    if (!merch.here) return;
    if (shopOpen === 'merchant') { merch.pending = true; return; }
    merch.here = false; merch.pending = false; merchG.visible = false; merch.next = rr(merchantEvery[0], merchantEvery[1]);
    if (!quiet) toast('🛒 떠돌이 상인이 떠났어요… 몇 분 뒤 다른 길가에 또 올 거예요', 3);
    emit('merchant-leave', {}); renderFx(true);
  }

  /* ════════ 충돌 ════════ */
  const colliders = [];
  {
    const add = (lx, lz, hx, hz, rot = 0) => colliders.push({ owner: 'hut', lx, lz, hx, hz, rot });
    add(0, 0, 1.95, 1.75); add(CAUL_L.x, CAUL_L.z, 0.6, 0.6); add(SHELF_L.x, SHELF_L.z, 0.85, 0.25, 0.25); add(COUNTER_L.x, COUNTER_L.z, 0.85, 0.3);
  }
  function pushBox(pos, r, cx, cz, rot, hx, hz) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const dx = pos.x - cx, dz = pos.z - cz;
    const lx = c * dx - s * dz, lz = s * dx + c * dz;          // 월드 → 로컬 (rotation.y = rot 의 역)
    const ex = hx + r, ez = hz + r;
    if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) return false;
    let nx = lx, nz = lz;
    if (ex - Math.abs(lx) < ez - Math.abs(lz)) nx = Math.sign(lx || 1) * ex; else nz = Math.sign(lz || 1) * ez;
    pos.x = cx + c * nx + s * nz; pos.z = cz - s * nx + c * nz;
    return true;
  }
  function pushOut(pos, r = 0.35) {
    if (disposed || !pos) return false;
    let hit = false;
    if (Math.abs(pos.x - HUT.x) < 9 && Math.abs(pos.z - HUT.z) < 9) {
      for (const k of colliders) {
        const w = hutW(k.lx, k.lz);
        if (pushBox(pos, r, w.x, w.z, HUT.rotY + k.rot, k.hx, k.hz)) hit = true;
      }
    }
    if (merch.here && Math.abs(pos.x - merch.x) < 9 && Math.abs(pos.z - merch.z) < 9) {
      const c = Math.cos(merch.rot), s = Math.sin(merch.rot);
      const w = (lx, lz) => ({ x: merch.x + c * lx + s * lz, z: merch.z - s * lx + c * lz });
      const a = w(WAGON_X, 0.3), b = w(STAND_L.x - 0.1, STAND_L.z);
      if (pushBox(pos, r, a.x, a.z, merch.rot, 1.0, 3.3)) hit = true;
      if (pushBox(pos, r, b.x, b.z, merch.rot, 0.4, 1.15)) hit = true;
    }
    return hit;
  }

  /* ════════ 가게 창 ════════ */
  let shopOpen = null, hello = '';
  function cardPotion(id) {
    const p = POTIONS[id], on = !!fx[id];
    return `<div class="sh-card${on ? ' on' : ''}${p.rare ? ' rare' : ''}"><span class="bt" style="background:${p.color}" aria-hidden="true"></span>
      <div class="tt">${p.icon} ${p.name}</div><div class="ds">${p.desc}</div>
      <div class="ft"><span class="tm">${p.dur ? (on ? `효과 중 ${Math.ceil(fx[id].left)}초` : p.dur + '초') : '즉시'}</span>
      <button type="button" data-buy="${id}">은화 ${p.price} · 마시기</button></div></div>`;
  }
  function cardItem(id, def, kind) {
    const have = owns(id), worn = kind === 'hat' ? save.hat === id : !!save.duck;
    const btn = have ? `<button type="button" class="${worn ? 'off' : ''}" data-wear="${id}">${worn ? (kind === 'hat' ? '벗기' : '집에 두기') : (kind === 'hat' ? '쓰기' : '데리고 다니기')}</button>`
      : `<button type="button" data-buy="${id}">은화 ${def.price} · 사기</button>`;
    return `<div class="sh-card${worn ? ' on' : ''}"><span class="ic" aria-hidden="true">${def.icon}</span>
      <div class="tt">${def.name}</div><div class="ds">${def.desc}</div><div class="ft">${have ? '<span class="tm">가지고 있음</span>' : ''}${btn}</div></div>`;
  }
  function capeRow() {
    return `<div class="sh-capes">${Object.entries(CAPES).map(([k, c]) => {
      const have = owns('cape_' + k);
      return `<button type="button" class="${save.cape === k ? 'on' : ''}" data-cape="${k}"><i style="background:${c.hex}"></i>${c.name}${have ? '' : ` · ${c.price}`}</button>`;
    }).join('')}</div>`;
  }
  function wardrobeSection() {
    const hats = Object.keys(HATS).filter(owns);
    const anyCape = Object.keys(CAPES).some(k => CAPES[k].price > 0 && owns('cape_' + k));
    if (!hats.length && !owns('duck') && !anyCape) return '';
    return `<h3>내 옷장</h3>${hats.map(id => cardItem(id, HATS[id], 'hat')).join('')}${owns('duck') ? cardItem('duck', DUCK, 'duck') : ''}
      ${anyCape ? `<h3>망토 색</h3>${capeRow()}` : ''}`;
  }
  function renderPanel() {
    if (!shopOpen) return;
    const witch = shopOpen === 'witch';
    panel.className = 'sh-panel' + (witch ? ' witch' : '');
    panel.setAttribute('aria-label', witch ? '약초 마녀의 물약 가게' : '떠돌이 상인 마차');
    let body;
    if (witch) body = `<h3>물약 (마시면 바로 효과)</h3>${WITCH_POTIONS.map(cardPotion).join('')}${wardrobeSection()}`;
    else {
      body = `<h3>모자</h3>${Object.keys(HATS).map(id => cardItem(id, HATS[id], 'hat')).join('')}
        <h3>망토 염색 (한 번 사면 언제든 바꾸기)</h3>${capeRow()}
        <h3>동물 친구 · 희귀품</h3>${cardItem('duck', DUCK, 'duck')}${cardPotion('gold')}`;
    }
    const left = merch.left;
    const html = `<div class="hd"><h2>${witch ? '🧪 약초 마녀의 물약 가게' : '🛒 떠돌이 상인 마차'}</h2>
        <span class="coin"><i aria-hidden="true"></i>은화 <b>${coins()}</b>닢</span><button type="button" class="x" aria-label="닫기">✕</button>
        <div class="say">${witch ? '🧙 마녀' : '🧔 상인'}: “${hello}”${witch ? '' : ` <span style="opacity:.7">(${Math.floor(left / 60)}분 ${Math.floor(left % 60)}초 뒤 떠남)</span>`}</div></div>
      <div class="bd">${body}</div><div class="fo">F · Esc 닫기</div>`;
    if (html !== lastHtml) { const sc = panel.querySelector('.bd'), top = sc ? sc.scrollTop : 0; panel.innerHTML = html; lastHtml = html; const nb = panel.querySelector('.bd'); if (nb) nb.scrollTop = top; }
  }
  let lastHtml = '';
  function buy(id) {
    const isPotion = !!POTIONS[id];
    const def = POTIONS[id] || HATS[id] || (id === 'duck' ? DUCK : null) || (id.startsWith('cape_') ? CAPES[id.slice(5)] : null);
    if (!def) return;
    if (!isPotion && owns(id)) return;
    if (!spend(def.price)) {
      toast(`은화가 모자라요 (필요 ${def.price}닢 · 가진 것 ${coins()}닢)<br><span style="opacity:.75">의뢰 게시판에서 일하면 은화를 받아요</span>`); sfx.bad();
      (shopOpen === 'witch' ? witchBubble : merchBubble).say('은화가 모자라구나~', 1.6);
      renderPanel(); return;
    }
    sfx.coin();
    const actsNow = shopOpen === 'witch' ? witchActs : merchActs;
    if (actsNow.cheers && actsNow.idle) { const a = actsNow.cheers; a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; a.fadeIn(0.2).play(); actsNow.idle.fadeOut(0.2); cheerT = Math.min(2.4, a.getClip().duration); cheerActs = actsNow; }
    emit('buy', { id, price: def.price });
    if (isPotion) { closeShop(); setTimeout(() => { if (!disposed) drink(id); }, 250); return; }
    save.owned.push(id); persist();
    if (HATS[id]) { save.hat = id; persist(); applyWardrobe(); toast(`${def.icon} <b>${def.name}</b>을(를) 샀어요! 바로 써 봤어요`); }
    else if (id === 'duck') { save.duck = true; D.placed = false; persist(); toast('🦆 <b>애완 오리</b>가 생겼어요! 꽥!'); sfx.quack(); }
    else { const k = id.slice(5); save.cape = k; persist(); paintCape(k); toast(`망토를 <b>${CAPES[k].name}</b>(으)로 물들였어요`); }
    renderPanel();
  }
  let cheerT = 0, cheerActs = null;
  panel.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('x')) { closeShop(); return; }
    if (b.dataset.buy) { buy(b.dataset.buy); return; }
    if (b.dataset.wear) { const id = b.dataset.wear; if (id === 'duck') wardrobe.toggleDuck(); else wardrobe.wear(id); sfx.pop(); return; }
    if (b.dataset.cape) {
      const k = b.dataset.cape;
      if (owns('cape_' + k)) wardrobe.setCape(k); else buy('cape_' + k);
    }
  });
  dim.addEventListener('pointerdown', e => { e.preventDefault(); closeShop(); });
  promptEl.addEventListener('click', e => { e.preventDefault(); const k = nearShop(); if (k) openShop(k); });

  function openShop(kind) {
    if (disposed || shopOpen) return false;
    if (kind === 'merchant' && !merch.here) return false;
    shopOpen = kind; lastHtml = ''; hello = pick(kind === 'witch' ? WITCH_HELLO : MERCHANT_HELLO);
    panel.hidden = false; dim.hidden = false; promptEl.hidden = true;
    renderPanel();
    (kind === 'witch' ? witchBubble : merchBubble).say(kind === 'witch' ? '히히, 어서 오렴!' : '어서 오시오!', 1.6);
    if (onOpen) safe(onOpen);
    emit('open', { kind });
    return true;
  }
  function closeShop() {
    if (!shopOpen) return false;
    shopOpen = null; panel.hidden = true; dim.hidden = true;
    if (onClose) safe(onClose);
    emit('close', {});
    if (merch.pending) removeMerchant();
    return true;
  }
  function onKeyDown(e) {
    if (!shopOpen) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'Escape' || e.code === 'KeyF') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) closeShop(); return; }
    if (e.code === 'Tab' || e.code === 'Enter' || e.code === 'Space') return;
    e.stopPropagation();
  }
  addEventListener('keydown', onKeyDown, true);

  /* ── F ── */
  const SHOP_R = 3.0;
  function nearShop() {
    if (disposed || shopOpen) return null;
    if (!safe(isOnFoot) || safe(isBlocked)) return null;
    const p = safe(getPlayerPos); if (!p) return null;
    if (Math.hypot(p.x - witchW.x, p.z - witchW.z) < SHOP_R + 0.3) return 'witch';
    if (merch.here) {
      const c = Math.cos(merch.rot), s = Math.sin(merch.rot);
      const mx = merch.x + c * MERCH_L.x + s * MERCH_L.z, mz = merch.z - s * MERCH_L.x + c * MERCH_L.z;
      const sx = merch.x + c * STAND_L.x + s * STAND_L.z, sz = merch.z - s * STAND_L.x + c * STAND_L.z;
      if (Math.hypot(p.x - mx, p.z - mz) < SHOP_R + 0.5 || Math.hypot(p.x - sx, p.z - sz) < SHOP_R) return 'merchant';
    }
    return null;
  }
  function onF() {
    if (shopOpen) { closeShop(); return true; }
    const k = nearShop();
    if (k) { openShop(k); return true; }
    return false;
  }

  /* ════════ 매 프레임 ════════ */
  function project(x, y, z, elm) {
    _v.set(x, y, z).project(camera);
    if (_v.z > 1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) { elm.hidden = true; return; }
    elm.style.left = ((_v.x + 1) / 2 * innerWidth).toFixed(1) + 'px';
    elm.style.top = ((1 - _v.y) / 2 * innerHeight).toFixed(1) + 'px';
    elm.hidden = false;
  }
  function nearbyNpcs(P, R) {
    const n = safe(getNpcs); if (!n || !n.list) return [];
    const L = safe(() => n.list()) || [], out = [];
    for (const e of L) { if (!e || !e.pos || e.off) continue; const d = Math.hypot(e.pos.x - P.x, e.pos.z - P.z); if (d < R) out.push({ e, d }); }
    return out.sort((a, b) => a.d - b.d);
  }
  const npcSay = (e, text, life = 1.8, color) => { const n = safe(getNpcs); if (n && n.say) safe(() => n.say(e.npc, text, life, color)); };
  let fxTick = 0;

  function update(dt, t = performance.now() / 1000) {
    if (disposed) return;
    dt = Math.min(dt || 0, 0.1);
    const onFoot = !!safe(isOnFoot);
    findPlayer();

    /* 0) 지난 프레임 둥실 높이가 남아 있으면(걷기가 안 돌았으면) 뺀다 */
    if (hopOff && Math.abs(person.position.y - lastSetY) < 1e-6) person.position.y -= hopOff;
    hopOff = 0;

    const P = person.position;
    if (haveLast) {
      const s = Math.hypot(P.x - lastP.x, P.z - lastP.z) / Math.max(dt, 1e-3);
      if (s < 60) pSpd += (s - pSpd) * Math.min(1, dt * 10);
    }
    lastP.copy(P); haveLast = true;

    /* 1) 효과 시간 */
    for (const id of Object.keys(fx)) { fx[id].left -= dt; if (fx[id].left <= 0) expire(id); }

    /* 2) 크기 */
    const tgtS = !onFoot ? 1 : fx.giant ? 2.2 : fx.tiny ? 0.45 : 1;
    const prevS = curS;
    curS = onFoot ? curS + (tgtS - curS) * Math.min(1, dt * 2.6) : 1;
    if (Math.abs(curS - tgtS) < 0.002) curS = tgtS;
    const growing = Math.abs(curS - prevS) / Math.max(dt, 1e-3);
    const boing = 1 + Math.sin(t * 22) * Math.min(0.07, growing * 0.05);
    if (applyScale) {
      if (Math.abs(curS - 1) > 1e-3 || scaleApplied) { person.scale.setScalar(curS * boing); scaleApplied = Math.abs(curS - 1) > 1e-3; if (!scaleApplied) person.scale.setScalar(1); }
    }

    /* 3) 카메라: 이번 프레임 카메라를 발 기준으로 늘이고/줄인다 (방향은 그대로) */
    const free = onFoot && !safe(isBlocked);
    const tgtM = free ? Math.pow(curS, 0.8) : 1;
    camM += (tgtM - camM) * Math.min(1, dt * 2.6);
    if (Math.abs(camM - tgtM) < 0.002) camM = tgtM;
    if (applyCamera && Math.abs(camM - 1) > 1e-3) {
      camera.position.sub(P).multiplyScalar(camM).add(P);
      camera.position.y = Math.max(camera.position.y, groundY(camera.position.x, camera.position.z) + 0.25);
    }

    /* 4) 거인 발걸음 */
    if (fx.giant && onFoot && pSpd > 0.8) {
      stepDist += pSpd * dt;
      if (stepDist > 1.25 * curS) {
        stepDist = 0; shakeT = 0.22; shakeK = Math.min(1, curS / 2.2);
        sfx.thud(shakeK);
        for (let i = 0; i < 10; i++) { const a = rr(0, Math.PI * 2); soft.emit(P.x + Math.cos(a) * 0.5, P.y + 0.1, P.z + Math.sin(a) * 0.5, { vx: Math.cos(a) * 2.2, vz: Math.sin(a) * 2.2, vy: 0.5, life: 0.8, s0: 0.5, s1: 1.3, a: 0.4, color: 0xb9a37e, drag: 3 }); }
        if (sayCD <= 0) {
          const near = nearbyNpcs(P, 14);
          if (near.length) { npcSay(pick(near.slice(0, 3)).e, pick(GIANT_LINES), 1.9, '#c0281e'); sayCD = 2.6; }
          const n = safe(getNpcs);
          if (near.length && Math.random() < 0.25 && n && n.alarm) safe(() => n.alarm({ x: P.x, y: 0, z: P.z }, 7, 'shot'));
        }
      }
    }
    if (shakeT > 0 && applyCamera) {
      shakeT -= dt; const k = Math.max(0, shakeT / 0.22) * shakeK;
      camera.position.y += Math.sin(t * 70) * 0.12 * k; camera.position.x += Math.sin(t * 53) * 0.06 * k;
    }
    sayCD -= dt;

    /* 5) 꼬마 */
    if (fx.tiny && onFoot) {
      tinyT -= dt;
      if (tinyT <= 0) {
        tinyT = rr(3.5, 6);
        const near = nearbyNpcs(P, 8);
        if (near.length && Math.random() < 0.6) npcSay(near[0].e, pick(TINY_NPC), 1.8);
        else if (pSpd > 0.5 || Math.random() < 0.4) { meBubble.say(pick(TINY_SELF), 1.4, '#c0408a'); sfx.squeak(); }
      }
    }

    /* 6) 바람 흙먼지 */
    if (fx.wind && onFoot && pSpd > 2) {
      dustT -= dt;
      while (dustT <= 0) {
        dustT += 0.035;
        soft.emit(P.x + rr(-0.25, 0.25) * curS, P.y + 0.12 + hopOff, P.z + rr(-0.25, 0.25) * curS, { vx: rr(-0.5, 0.5), vy: rr(0.3, 0.9), vz: rr(-0.5, 0.5), life: rr(0.5, 0.9), s0: 0.25 * curS, s1: 0.8 * curS, a: 0.35, color: 0xcbb68e, drag: 2.5 });
      }
      if (Math.random() < dt * 8) glow.emit(P.x + rr(-0.6, 0.6), P.y + rr(0.4, 1.6) * curS, P.z + rr(-0.6, 0.6), { vy: 0.2, life: 0.4, s0: 0.07, s1: 0.0, color: 0xbff4ff, a: 0.8 });
    }

    /* 7) 깃털: 걸으면 깡총, 서 있으면 둥실 */
    if (fx.feather && onFoot) {
      if (pSpd > 0.8) { hopPhase += pSpd * dt * 0.85; hopOff = Math.abs(Math.sin(hopPhase)) * 0.85 * Math.min(1.6, curS); }
      else hopOff = (0.22 + Math.sin(t * 2.1) * 0.08) * curS;
      featherT -= dt;
      if (featherT <= 0) { featherT = rr(0.25, 0.6); soft.emit(P.x + rr(-0.4, 0.4), P.y + hopOff + rr(0.5, 1.5) * curS, P.z + rr(-0.4, 0.4), { vx: rr(-0.3, 0.3), vy: -0.25, vz: rr(-0.3, 0.3), life: 2, s0: 0.12, s1: 0.1, a: 0.9, color: 0xffffff, drag: 0.5 }); }
    }
    if (hopOff) { P.y += hopOff; lastSetY = P.y; }

    /* 8) 투명 */
    const tgtA = fx.ghost ? 0.25 : 1;
    const prevA = curA;
    curA += (tgtA - curA) * Math.min(1, dt * 3); if (Math.abs(curA - tgtA) < 0.01) curA = tgtA;
    if (applyAlpha && (curA !== prevA || alphaDirty || (curA < 1 && (fxTick % 30) === 0))) { setAlpha(curA); alphaDirty = false; }
    if (fx.ghost) {
      ghostT -= dt;
      if (ghostT <= 0) {
        ghostT = 1;
        const ev = safe(getEvents); if (ev && typeof ev.setStars === 'function' && ev.stars > 0) safe(() => ev.setStars(0));
        if (onFoot && Math.random() < 0.3) { const near = nearbyNpcs(P, 4); if (near.length) npcSay(near[0].e, pick(GHOST_LINES), 1.8, '#4a5a8a'); }
      }
      if (Math.random() < dt * 6) glow.emit(P.x + rr(-0.4, 0.4) * curS, P.y + rr(0.2, 1.8) * curS, P.z + rr(-0.4, 0.4) * curS, { vy: 0.4, life: 0.9, s0: 0.1, s1: 0, color: 0x9fb4ff, a: 0.6 });
    }

    /* 9) 황금 */
    if (fx.gold) {
      if (Math.random() < dt * 14) glow.emit(P.x + rr(-0.5, 0.5) * curS, P.y + rr(0.1, 2) * curS, P.z + rr(-0.5, 0.5) * curS, { vy: rr(0.2, 0.8), life: rr(0.5, 1), s0: 0.12, s1: 0, color: 0xffd34a });
      if (onFoot) for (const { e } of nearbyNpcs(P, 1.4 * Math.max(1, curS))) {
        if (goldTouched.has(e.npc)) continue;
        goldTouched.add(e.npc);
        for (let i = 0; i < 24; i++) glow.emit(e.pos.x + rr(-0.4, 0.4), (e.pos.y || 0) + rr(0.2, 2), e.pos.z + rr(-0.4, 0.4), { vx: rr(-1, 1), vy: rr(0.5, 2), vz: rr(-1, 1), life: rr(0.8, 1.5), s0: 0.15, s1: 0, color: pick([0xffd34a, 0xfff2a8, 0xffffff]), drag: 1.2 });
        npcSay(e, '반짝반짝!', 1.6, '#b8860b'); sfx.sparkle();
        if (goldCoins < 8) { goldCoins++; addCoins(1); toast(`✨ 반짝! 은화 +1 <span style="opacity:.7">(${goldCoins}/8)</span>`, 1.4); }
      }
    }

    /* 10) 마녀 오두막 애니메이션 */
    const dW = Math.hypot(P.x - witchW.x, P.z - witchW.z);
    const nearHut = Math.hypot(P.x - HUT.x, P.z - HUT.z) < 60;
    if (nearHut) {
      if (witchMixer) witchMixer.update(dt);
      if (witchModel) {
        const want = dW < 9 ? Math.atan2(P.x - witchW.x, P.z - witchW.z) - HUT.rotY : 0.25;
        let d = want - witchModel.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        witchModel.rotation.y += d * Math.min(1, dt * 3);
      }
      if (caulLiquid) { const k = 0.75 + Math.sin(t * 3.1) * 0.15; M.brew.color.setRGB(0.25 * k, 1.0 * k, 0.32 * k); caulLiquid.position.y = 0.86 + Math.sin(t * 5) * 0.01; }
      fireMeshes.forEach((f, i) => { f.scale.y = 0.3 + Math.abs(Math.sin(t * (9 + i * 2.3) + i)) * 0.18; f.rotation.y = t * (2 + i); });
      const sign = hutG.userData.sign; if (sign && sign.userData.board) sign.userData.board.rotation.x = Math.sin(t * 1.3) * 0.08;
      if (dW < 45) {
        const cy = HY + lift(CAUL_L.x, CAUL_L.z) + 0.9;
        if (Math.random() < dt * 9) glow.emit(caulW.x + rr(-0.35, 0.35), cy, caulW.z + rr(-0.35, 0.35), { vy: rr(0.25, 0.6), life: rr(0.5, 0.9), s0: rr(0.08, 0.16), s1: 0.22, color: 0x5dff6a, a: 0.9 });
        if (Math.random() < dt * 5) soft.emit(caulW.x + rr(-0.3, 0.3), cy + 0.1, caulW.z + rr(-0.3, 0.3), { vx: rr(-0.15, 0.15), vy: rr(0.6, 1), vz: rr(-0.15, 0.15), life: rr(1.6, 2.6), s0: 0.35, s1: 1.4, a: 0.28, color: 0xdaf5dc, drag: 0.4, fadeIn: 0.2 });
        if (Math.random() < dt * 2.2) soft.emit(chimneyTop.x + rr(-0.1, 0.1), chimneyTop.y, chimneyTop.z + rr(-0.1, 0.1), { vx: rr(-0.2, 0.3), vy: rr(0.6, 0.9), vz: rr(-0.2, 0.2), life: rr(2.5, 3.5), s0: 0.4, s1: 1.8, a: 0.3, color: 0xb9a8d0, drag: 0.2, fadeIn: 0.15 });
      }
    }

    /* 11) 상인 */
    if (merch.here) {
      merch.left -= dt;
      if (merch.left <= 0) removeMerchant();
      const dM = Math.hypot(P.x - merch.x, P.z - merch.z);
      if (dM < 70) {
        if (merchMixer) merchMixer.update(dt);
        if (wagonMixer) wagonMixer.update(dt);
        if (merchLabel) merchLabel.position.y = 4.2 + Math.sin(t * 2) * 0.12;
        if (merchModel) {
          const c = Math.cos(merch.rot), s = Math.sin(merch.rot);
          const mx = merch.x + c * MERCH_L.x + s * MERCH_L.z, mz = merch.z - s * MERCH_L.x + c * MERCH_L.z;
          const want = dM < 10 ? Math.atan2(P.x - mx, P.z - mz) - merch.rot : -Math.PI / 2;
          let d = want - merchModel.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
          merchModel.rotation.y += d * Math.min(1, dt * 3);
        }
      }
    } else if (merch.next > 0) {
      merch.next -= dt;
      if (merch.next <= 0) placeMerchant();
    }
    if (cheerT > 0) { cheerT -= dt; if (cheerT <= 0 && cheerActs && cheerActs.idle) { cheerActs.idle.reset().fadeIn(0.3).play(); cheerActs.cheers.fadeOut(0.3); } }

    /* 12) 오리 */
    const duckOn = !!save.duck && owns('duck');
    if (duckOn && onFoot && person.visible) {
      const back = 1.1 * Math.max(0.6, curS), h = person.rotation.y;
      const tx = P.x - Math.sin(h) * back + Math.cos(h) * 0.5, tz = P.z - Math.cos(h) * back - Math.sin(h) * 0.5;
      if (!D.placed || Math.hypot(D.x - P.x, D.z - P.z) > 25) { D.x = tx; D.z = tz; D.placed = true; }
      const dx = tx - D.x, dz = tz - D.z, dist = Math.hypot(dx, dz);
      const sp = dist > 0.25 ? Math.min(dist * 3, 3.2 + pSpd) : 0;
      if (dist > 0.01) { D.x += dx / dist * sp * dt; D.z += dz / dist * sp * dt; }
      const face = sp > 0.2 ? Math.atan2(dx, dz) : Math.atan2(P.x - D.x, P.z - D.z);
      let dr = face - D.rot; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); D.rot += dr * Math.min(1, dt * 8);
      D.phase += dt * (sp > 0.2 ? 14 : 2);
      const u = duck.userData;
      duck.position.set(D.x, groundY(D.x, D.z) + (sp > 0.2 ? Math.abs(Math.sin(D.phase)) * 0.05 : 0), D.z);
      duck.rotation.y = D.rot; u.body.rotation.z = sp > 0.2 ? Math.sin(D.phase) * 0.18 : 0;
      u.head.rotation.x = Math.sin(t * 2.3) * 0.12; u.wL.rotation.z = u.wR.rotation.z = 0;
      D.quackT -= dt;
      if (D.quackT <= 0) { D.quackT = rr(6, 14); if (Math.hypot(camera.position.x - D.x, camera.position.z - D.z) < 25) { sfx.quack(); u.wL.rotation.z = -0.6; u.wR.rotation.z = 0.6; } }
      duck.visible = true;
    } else { duck.visible = false; if (!onFoot) D.placed = false; }

    /* 13) 안내 (F 가게 보기) */
    const k = nearShop();
    if (k === 'witch') project(witchW.x, HY + 2.55, witchW.z, promptEl);
    else if (k === 'merchant') { const c = Math.cos(merch.rot), s = Math.sin(merch.rot); project(merch.x + c * MERCH_L.x + s * MERCH_L.z, groundY(merch.x, merch.z) + 2.5, merch.z - s * MERCH_L.x + c * MERCH_L.z, promptEl); }
    else if (!promptEl.hidden) promptEl.hidden = true;

    /* 14) 말풍선·파티클·칩 */
    meBubble.update(dt, P.x, P.y + 2.15 * curS + 0.2, P.z, Math.max(0.6, Math.min(1.3, curS)));
    witchBubble.update(dt, witchW.x, HY + 2.6, witchW.z);
    { const c = Math.cos(merch.rot), s = Math.sin(merch.rot); merchBubble.update(dt, merch.x + c * MERCH_L.x + s * MERCH_L.z, groundY(merch.x, merch.z) + 2.6, merch.z - s * MERCH_L.x + c * MERCH_L.z); }
    soft.update(dt); glow.update(dt);
    fxTick++;
    if (Object.keys(fx).length || merch.here || !fxBar.hidden) renderFx(false);
    if (shopOpen && fxTick % 30 === 0) renderPanel();
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('on'); }
  }

  function dispose() {
    disposed = true; closeShop();
    removeEventListener('keydown', onKeyDown, true);
    if (hopOff && Math.abs(person.position.y - lastSetY) < 1e-6) person.position.y -= hopOff;
    if (scaleApplied) person.scale.setScalar(1);
    setAlpha(1);
    if (hatObj && hatObj.parent) hatObj.parent.remove(hatObj);
    if (clothMat && clothOrig) { clothMat.map = clothOrig; clothMat.needsUpdate = true; }
    for (const o of [hutG, merchG, duck, soft.pts, glow.pts, meBubble.sp, witchBubble.sp, merchBubble.sp]) scene.remove(o);
    for (const o of owned) safe(() => o.dispose());
    for (const e of [promptEl, dim, panel, fxBar, toastEl]) e.remove();
    if (actx) safe(() => actx.close());
    if (globalThis.__shop === api) delete globalThis.__shop;
  }

  const api = {
    update, nearShop, onF, pushOut, effects, wardrobe, drink, openShop, closeShop, dispose,
    get open() { return !!shopOpen; },
    get merchant() { return { here: merch.here, x: merch.x, z: merch.z, left: +merch.left.toFixed(1), next: +merch.next.toFixed(1), name: merch.spot ? merch.spot.name : '' }; },
    hut: { x: HUT.x, z: HUT.z, witch: witchW }, spots: MERCHANT_SPOTS,
  };
  if (debug) {
    const tp = (x, z, h) => { const d = globalThis.__drive; if (d && d.teleport) d.teleport(x, z, h); else { person.position.set(x, groundY(x, z), z); } };
    globalThis.__shop = Object.assign(api, {
      give: (n = 50) => { addCoins(n); renderPanel(); return coins(); },
      coins,
      merchant_: () => merch,
      summon: i => { if (merch.here) { if (shopOpen === 'merchant') closeShop(); merch.pending = false; removeMerchant(true); } placeMerchant(i); return api.merchant; },
      leave: () => removeMerchant(),
      wear: id => { if (!owns(id)) { save.owned.push(id); } return HATS[id] ? wardrobe.wear(id) : id === 'duck' ? wardrobe.toggleDuck(true) : wardrobe.setCape(id.replace('cape_', '')); },
      state: () => ({ coins: coins(), fx: effects.active(), scale: +curS.toFixed(3), camM: +camM.toFixed(3), alpha: +curA.toFixed(2), save: JSON.parse(JSON.stringify(save)), merchant: api.merchant, open: shopOpen, playerFit: !!playerFit, capeMask: capeMask ? capeMask.length : 0 }),
      goWitch: () => { const p = hutW(WITCH_L.x, WITCH_L.z + 2.4); tp(p.x, p.z, HUT.rotY + Math.PI); },
      goMerchant: () => { if (!merch.here) placeMerchant(); const c = Math.cos(merch.rot), s = Math.sin(merch.rot); const lx = STAND_L.x - 2.2, lz = STAND_L.z; tp(merch.x + c * lx + s * lz, merch.z - s * lx + c * lz, Math.atan2(c, -s)); },
      reset: () => { save = { owned: [], hat: null, cape: 'red', duck: false, purse: 0 }; persist(); applyWardrobe(); renderPanel(); },
    });
  }
  return api;
}
