/* ════════════════════════════════════════════════════════════════════
   quests.js — 의뢰 게시판 (상호랜드 퀘스트)
     출발점 근처 길 왼쪽에 나무 "의뢰 게시판"이 서 있다. 걸어서 다가가면 "F 의뢰 보기".
     열면 양피지 창에 의뢰 3개(무작위). 하나를 수락하면 왼쪽 위 추적 창에 목표·진행·거리와 방향 화살표가 뜨고,
     목표물 위에는 노란 화살표(탈것 화살표와 같은 모양, 주황)가 뜬다. 끝내면 은화와 칭호를 받고 그 자리에 새 의뢰가 붙는다.

     의뢰 11종
       sheep   길 잃은 양 찾기   멀리 떨어진 아기 양(코드로 만든 모형)을 찾아 가까이 가면 졸졸 따라온다 → 양 떼(-18, 60)까지 데려가기
       beer    맥주 배달          가판대에서 맥주잔을 받아 목마른 마을 사람에게. 뛰거나 탈것을 타면 맥주가 쏟아진다(쏟음 게이지)
       chicken 닭 잡기            village.js 닭 소동을 일으키고(이미 있으면 그대로) 닭 3마리 잡기
       fish    물고기 납품        낚시로 2마리 (fishing.log() 합계를 읽는다)
       crown   잃어버린 왕관      어딘가 숨은 임금님 왕관을 "뜨거워요/차가워요"로 찾아서 게시판에 돌려놓기
       thief   소매치기 잡기      village.js 소매치기를 불러내서 잡기 (도망치면 다시 나타난다)
       talk    마을 사람 5명과 대화 (서로 다른 사람)
       project 프로젝트 게시판 3곳 둘러보기 (가판대 프로젝트 창 열기)
       race    성문까지 달리기     게시판에서 3·2·1 출발 → 걸어서(뛰어서) 30초 안에 북쪽 성문 앞까지. 탈것은 반칙
       ride    탈것 시승          서로 다른 탈것 3종으로 20 m 씩 달리기 (V 키로 바꾸기)
       king    임금님 배웅        임금님 행차에 다가가 인사하기 (행차가 없으면 불러낸다)
     한 번에 하나만 진행. 처음 끝낸 종류마다 칭호(닭 몰이꾼 등), 누적 횟수 칭호(상호왕국 명예 기사 등).
     진행(은화·칭호·완료 수·게시판 의뢰)은 localStorage 'sangholand-quests-v1' 에 남는다(진행 중인 의뢰는 새로고침하면 다시 게시판으로).

   ── portfolio.js 연결 (PM 이 넣는다) ──
     ① 위쪽 let 묶음에: let quests = null;
     ② village·animals·fishing·tavern·dialogue·castle·rides 를 다 만든 뒤 (npcs 는 나중에 와도 된다 — get 함수로 읽는다):
        {
          const { createQuests } = await import('./quests.js');
          quests = createQuests({
            THREE, scene, camera, pathX, groundY,
            getPlayerPos: () => activePos(),
            isOnFoot: () => player.mode === 'onfoot',
            isBlocked: () => !driveActive || panelOpen() || !!(dialogue && dialogue.active) || !!(fishing && fishing.active) || tavern.seated,
            getAnimals: () => animals, getVillage: () => village, getFishing: () => fishing,
            getTavern: () => tavern, getNpcs: () => npcs, getDialogue: () => dialogue,
            getRide: () => (player.mode === 'driving' ? rides.current : null),
            castleGate: castle,                                   // castle.js 반환값(또는 castle.villageGate(0))
            onOpen() { for (const k in keys) keys[k] = false; pSpeed = 0; speed = 0; if (weapons) weapons.holster(); },
          });
        }
     ③ step(dt) 안, if (animals) animals.update(dt, t); 다음 줄:   if (quests) quests.update(dt, t);
     ④ F 키 (우선순위: 대화 > 의뢰 게시판 > 낚시 > 탈것). keydown 의 KeyF 줄을:
        if (e.code === 'KeyF') { e.preventDefault();
          if (player.mode === 'onfoot' && quests && quests.onF()) { hideHint(); return; }
          if (player.mode === 'onfoot' && fishing && fishing.onF()) return;
          toggleVehicle(); hideHint(); }
        (대화는 dialogue.js 가 캡처 단계에서 먼저 가져가므로 자동으로 맨 앞이다. 게시판이 열려 있을 때의 F·Esc 는
         이 모듈이 캡처 단계에서 직접 받아 닫는다.)
     ⑤ 게시판 창이 열려 있으면 주먹·무기·앉기를 막는다 — 각 isBlocked 에 || (quests && quests.open)
        (창 뒤에 투명 막을 깔아 캔버스 클릭은 이미 막는다. 키 입력도 창이 열려 있는 동안 이 모듈이 삼킨다.)
     ⑥ 사건 알림 (없어도 되는 것은 polling 으로도 잡는다):
        - 프로젝트: openPanel(p) 안 맨 끝에   if (quests) quests.notify('project', p.id);
        - 대화: getDialogue 를 넘겼으면 필요 없음. 아니면 dialogue onStart(n) 안에  if (quests) quests.notify('talk', n);
        - 탈것: getRide 를 넘겼으면 필요 없음. 아니면 rides onChange(id) 와 toggleVehicle 뒤에 quests.notify('ride', id)
        - 닭/도둑/물고기: getVillage·getFishing 을 넘겼으면 필요 없음 (없을 때만 notify('chicken'|'thief'|'fish') 로 센다)
     ⑦ (선택) 걷기 충돌 — walk() 의 castle.pushOut 줄 옆에:  if (quests) quests.pushOut(person.position, 0.35);
     ⑧ (선택) 은화를 선술집과 같이 쓰려면 tavern.js 반환 객체에 addCoins(n) { S.coins += n; renderPanel(); } 를 더한다
        (있으면 보상이 선술집 지갑으로 들어간다. 없으면 이 모듈 지갑(저장됨)에 쌓인다).

   ── 옵션 ──
     THREE, scene, camera, pathX(z), groundY(x, z), getPlayerPos() → {x, z}          — 필수
     isOnFoot(), isBlocked() → true 면 게시판 안내·열기를 안 한다
     getAnimals/getVillage/getFishing/getTavern/getNpcs/getDialogue → 각 모듈 (없거나 null 이면 그 의뢰는 안 나온다/다른 방법)
     getRide() → 지금 타고 있는 탈것 id ('car'|'horse'|…) | null
     castleGate  castle 반환값 | villageGate 객체 | {x, z} (기본: 길 위 z = -76)
     onOpen(), onClose()     게시판 창 열고 닫을 때
     onEvent(type, info)     'accept' | 'complete' | 'abandon' | 'badge' (소리·통계용, 토스트는 이 모듈이 직접 띄운다)
     board {x, z, rotY}      게시판 자리 덮어쓰기 (기본: 길 왼쪽 z = 57.4)
     isMuted() → true 면 효과음 끔

   ── 반환 API ──
     update(dt, t), nearBoard() → bool, onF() → bool(처리했으면 true), notify(kind, data),
     state() → { coins, active, offers, done, badges, total }, open(getter), coins(getter),
     openBoard(), closeBoard(), pushOut(pos, r), dispose()
   콘솔(?test): __quests.state(), __quests.start('beer'), __quests.finish(), __quests.target(), __quests.openBoard()
   ════════════════════════════════════════════════════════════════════ */

const STORE_KEY = 'sangholand-quests-v1';
const BOARD_R = 2.8;           // 이 거리 안이면 "F 의뢰 보기"
const FLOCK_HOME = { x: -18, z: 60 };
const RIDE_KO = { car: '자동차', horse: '말', carriage: '마차', motorcycle: '오토바이', bicycle: '자전거', tank: '탱크' };

/* 칭호 — 의뢰 종류별 첫 완료 + 누적 */
const MILESTONES = [
  [1, '새내기 모험가'], [3, '상호왕국 명예 기사'], [6, '왕실 해결사'], [10, '임금님의 오른팔'], [20, '상호랜드의 전설'],
];

const DEFS = {
  sheep:   { title: '길 잃은 양 찾기', who: '양치기 할아범', desc: '아기 양 한 마리가 무리에서 떨어져 멀리 가 버렸다네. 찾아서 양 떼 있는 풀밭(출발점 서쪽)까지 데려다주게.', reward: 12, badge: '양치기 소년', icon: '🐑' },
  beer:    { title: '맥주 배달', who: '선술집 주인', desc: '가판대에서 맥주잔을 받아 목마른 손님에게 갖다줘요. 뛰면 넘쳐요! 천천히 걸어서.', reward: 8, badge: '거품 지킴이', icon: '🍺' },
  chicken: { title: '닭 잡기', who: '농부 아낙', desc: '우리 닭들이 또 우리를 뛰쳐나갔어요! 세 마리만 잡아 주세요. 몸으로 부딪히면 잡혀요.', reward: 10, badge: '닭 몰이꾼', icon: '🐔' },
  fish:    { title: '물고기 납품', who: '왕실 요리사', desc: '오늘 저녁 임금님 수라상에 올릴 생선이 모자라오. 연못에서 두 마리만 낚아 주시오.', reward: 10, badge: '강태공', icon: '🐟' },
  crown:   { title: '임금님의 잃어버린 왕관', who: '시종장', desc: '전하께서 산책하다 왕관을 떨어뜨리셨소! 어딘가 풀숲에 있을 텐데… 가까워지면 "뜨거워요"라고 알려 주겠소. 찾으면 이 게시판으로 가져오시오.', reward: 20, badge: '왕관 수호자', icon: '👑' },
  thief:   { title: '소매치기 잡기', who: '마을 경비대장', desc: '요즘 후드 쓴 소매치기가 설친다. 곧 또 나타날 거다. "도둑이야!" 소리가 들리면 쫓아가서 붙잡거나 넘어뜨려라.', reward: 15, badge: '포도대장', icon: '🦹' },
  talk:    { title: '마을 사람 5명과 대화', who: '촌장', desc: '새로 온 사람이로구먼. 마을 사람들과 인사 좀 나누게. 서로 다른 다섯 명과 이야기해 보게.', reward: 6, badge: '마을 마당발', icon: '💬' },
  project: { title: '프로젝트 게시판 둘러보기', who: '왕실 서기', desc: '임금님께서 손수 만드신 작품들이 가판대마다 걸려 있소. 세 곳에서 프로젝트를 열어 보시오(Space).', reward: 8, badge: '견문 넓은 여행자', icon: '📜' },
  race:    { title: '성문까지 달리기', who: '전령', desc: '전령 시험이다! 게시판에서 출발해 30초 안에 북쪽 성문 앞까지 뛰어라(Shift). 탈것은 반칙!', reward: 15, badge: '번개 발', icon: '🏃' },
  ride:    { title: '탈것 시승', who: '마구간지기', desc: '새 탈것들이 들어왔어요. 서로 다른 탈것 세 가지를 타고 조금씩 달려 보세요(V 키로 바꾸기).', reward: 8, badge: '탈것 박사', icon: '🐎' },
  king:    { title: '임금님 배웅', who: '깃발잡이', desc: '임금님 행차가 곧 지나가신다! 길가로 가서 전하께 인사를 올려라.', reward: 6, badge: '충성스러운 백성', icon: '🤴' },
};
const ALL_IDS = Object.keys(DEFS);

const CSS = `
.qs-prompt{position:fixed;left:0;top:0;z-index:42;transform:translate(-50%,-100%);display:inline-flex;align-items:center;gap:8px;
  padding:7px 12px 7px 8px;border-radius:999px;border:1px solid rgba(107,68,35,.55);background:rgba(250,240,214,.95);
  color:#3b2412;font:600 13px/1.2 Georgia,'Nanum Myeongjo',serif;box-shadow:0 6px 18px rgba(40,24,10,.25);cursor:pointer;pointer-events:auto}
.qs-prompt[hidden],.qs-track[hidden],.qs-panel[hidden],.qs-dim[hidden],.qs-big[hidden]{display:none}
.qs-prompt kbd{font:700 11px/1 ui-monospace,monospace;background:#3b2412;color:#f6e7c4;border-radius:5px;padding:4px 6px}
body.is-touch .qs-prompt kbd{display:none}
.qs-dim{position:fixed;inset:0;z-index:51;background:rgba(30,18,8,.28);touch-action:none}
.qs-panel{position:fixed;left:50%;top:50%;z-index:52;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 24px));max-height:min(86vh,720px);
  display:flex;flex-direction:column;border-radius:16px;background:linear-gradient(180deg,#fbf1d6,#efdcb2);border:2px solid #6b4423;
  outline:1px solid rgba(255,248,230,.7);outline-offset:-7px;box-shadow:0 22px 50px rgba(40,24,10,.42);color:#3b2412;
  font:14px/1.45 Georgia,'Nanum Myeongjo',serif;animation:qs-pop .22s cubic-bezier(.2,1.3,.4,1)}
@keyframes qs-pop{from{transform:translate(-50%,-46%) scale(.95);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
.qs-panel .hd{display:flex;align-items:center;gap:10px;padding:16px 18px 10px;border-bottom:1.5px dashed rgba(107,68,35,.4)}
.qs-panel .hd h2{margin:0;font-size:20px;font-weight:800;letter-spacing:-.01em}
.qs-panel .hd .coin{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700}
.qs-panel .hd .coin i,.qs-track .coin i{width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,#c9ccd2 45%,#8a8f98);box-shadow:0 0 0 1px #6c7078}
.qs-panel .hd .x{border:1px solid #6b4423;background:transparent;color:#3b2412;border-radius:8px;width:32px;height:32px;font:700 16px/1 Georgia,serif;cursor:pointer}
.qs-panel .bd{overflow:auto;padding:12px 16px 14px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch}
.qs-card{position:relative;padding:11px 13px 11px 52px;border-radius:12px;background:rgba(255,250,236,.75);border:1.5px solid rgba(107,68,35,.35)}
.qs-card.on{border-color:#b5651d;background:#fff6dc;box-shadow:0 0 0 3px rgba(181,101,29,.18)}
.qs-card .ic{position:absolute;left:12px;top:12px;font-size:26px;line-height:1}
.qs-card .tt{font-weight:800;font-size:15.5px}
.qs-card .who{font-size:11.5px;opacity:.7;margin-left:6px;font-weight:600}
.qs-card .ds{font-size:13px;margin-top:3px;word-break:keep-all;overflow-wrap:anywhere}
.qs-card .ft{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
.qs-card .rw{font-size:12px;font-weight:700;background:#3b2412;color:#f6e7c4;border-radius:999px;padding:3px 10px}
.qs-card .bg{font-size:11.5px;opacity:.75}
.qs-card .bg.got{opacity:.5;text-decoration:line-through}
.qs-card button{margin-left:auto;border:1.5px solid #6b4423;background:#6b4423;color:#fbefd2;border-radius:9px;padding:7px 14px;font:700 13px Georgia,'Nanum Myeongjo',serif;cursor:pointer}
.qs-card button.ab{background:transparent;color:#8a2a12;border-color:#8a2a12}
.qs-card button:disabled{opacity:.4;cursor:default}
.qs-panel h3{margin:6px 0 0;font-size:13px;letter-spacing:.05em;opacity:.8}
.qs-badges{display:flex;flex-wrap:wrap;gap:6px}
.qs-badges span{font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid rgba(107,68,35,.45);background:rgba(255,250,236,.6)}
.qs-badges span.got{background:#b5651d;border-color:#8a4a12;color:#fff6dc;font-weight:700}
.qs-panel .fo{padding:8px 16px 12px;font-size:11.5px;opacity:.7;text-align:center}
body.is-touch .qs-panel .fo{display:none}
.qs-track{position:fixed;left:18px;top:76px;z-index:39;width:min(250px,calc(100vw - 36px));padding:9px 12px 10px;border-radius:12px;
  background:linear-gradient(180deg,rgba(251,241,214,.95),rgba(239,220,178,.95));border:1.5px solid #6b4423;box-shadow:0 8px 22px rgba(40,24,10,.22);
  color:#3b2412;font:13px/1.4 Georgia,'Nanum Myeongjo',serif;pointer-events:none}
.qs-track .tp{display:flex;align-items:center;gap:6px;font-weight:800;font-size:13.5px}
.qs-track .tp .ic{font-size:15px}
.qs-track .ar{margin-left:auto;display:inline-flex;align-items:center;gap:4px;font:700 11.5px ui-monospace,monospace;opacity:.85}
.qs-track .ar b{display:inline-block;width:14px;height:14px;line-height:14px;text-align:center;font-size:13px;color:#b5651d;transform-origin:50% 50%}
.qs-track .ob{margin-top:3px;font-size:12.5px;word-break:keep-all}
.qs-track .ob.hot{color:#b3262e;font-weight:700}.qs-track .ob.cold{color:#2c5f86;font-weight:700}
.qs-track .br{margin-top:6px;height:6px;border-radius:99px;background:rgba(59,36,18,.18);overflow:hidden}
.qs-track .br i{display:block;height:100%;width:0;background:linear-gradient(90deg,#f6d36a,#e0892a);border-radius:99px;transition:width .2s}
.qs-track .br.sp i{background:linear-gradient(90deg,#f3c35a,#c0281e)}
.qs-track .br[hidden]{display:none}
.qs-toast{position:fixed;left:50%;top:124px;z-index:44;transform:translate(-50%,-8px);opacity:0;transition:opacity .25s,transform .25s;
  padding:9px 15px;border-radius:12px;background:rgba(250,240,214,.97);border:1.5px solid #6b4423;color:#3b2412;max-width:calc(100vw - 32px);
  font:600 13.5px Georgia,'Nanum Myeongjo',serif;box-shadow:0 8px 22px rgba(40,24,10,.25);pointer-events:none;text-align:center;word-break:keep-all}
.qs-toast.on{opacity:1;transform:translate(-50%,0)}
.qs-toast b{color:#8a4a12}
.qs-big{position:fixed;left:50%;top:38%;z-index:44;transform:translate(-50%,-50%);pointer-events:none;
  font:900 64px/1 Georgia,serif;color:#fff3c4;-webkit-text-stroke:2px #8a2a12;text-shadow:0 4px 0 #8a2a12,0 8px 18px rgba(0,0,0,.35)}
body.intro-on .qs-prompt,body.intro-on .qs-track,body[data-view="doc"] .qs-prompt,body[data-view="doc"] .qs-track,
body[data-view="doc"] .qs-toast,body.talking .qs-prompt{display:none}
@media (max-width:640px){.qs-track{left:12px;font-size:12px}.qs-panel .hd h2{font-size:18px}.qs-card{padding-left:46px}.qs-card .ic{font-size:22px}}
`;

export function createQuests({
  THREE, scene, camera, pathX = () => 0, groundY = () => 0,
  getPlayerPos, isOnFoot = () => true, isBlocked = () => false, onEvent = null,
  getAnimals = () => null, getVillage = () => null, getFishing = () => null, getTavern = () => null,
  getNpcs = () => null, getDialogue = () => null, getRide = null, castleGate = null,
  onOpen = null, onClose = null, board: boardOpt = null, isMuted = () => false,
  bounds = { minX: -42, maxX: 42, minZ: -84, maxZ: 84 },
  debug = new URLSearchParams(location.search).has('test'),
} = {}) {
  const V = THREE.Vector3;
  const rr = (a, b) => a + (b - a) * Math.random();
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const safe = f => { try { return f(); } catch { return null; } };
  const emit = (type, info) => { if (onEvent) safe(() => onEvent(type, info)); };

  /* ── 저장 ── */
  let save = { coins: 0, done: {}, badges: [], offers: [], total: 0 };
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (s && typeof s === 'object') save = Object.assign(save, s); } catch { /* 새로 시작 */ }
  if (!Array.isArray(save.badges)) save.badges = [];
  if (!Array.isArray(save.offers)) save.offers = [];
  if (!save.done || typeof save.done !== 'object') save.done = {};
  const persist = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(save)); } catch { /* 저장 못 해도 게임은 된다 */ } };

  /* ── DOM ── */
  if (!document.getElementById('qs-style')) {
    const st = document.createElement('style'); st.id = 'qs-style'; st.textContent = CSS; document.head.appendChild(st);
  }
  const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; document.body.appendChild(e); return e; };
  const promptEl = el('button', 'qs-prompt', '<kbd>F</kbd><span>의뢰 보기</span>'); promptEl.type = 'button'; promptEl.hidden = true;
  const dim = el('div', 'qs-dim'); dim.hidden = true;
  const panel = el('div', 'qs-panel'); panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '의뢰 게시판');
  const track = el('div', 'qs-track', `<div class="tp"><span class="ic"></span><span class="tt"></span><span class="ar"><b>▲</b><span class="ds"></span></span></div>
    <div class="ob"></div><div class="br"><i></i></div>`); track.hidden = true;
  track.setAttribute('role', 'status'); track.setAttribute('aria-live', 'polite');
  const tIc = track.querySelector('.ic'), tTt = track.querySelector('.tt'), tAr = track.querySelector('.ar'), tArB = tAr.querySelector('b'),
    tDs = tAr.querySelector('.ds'), tOb = track.querySelector('.ob'), tBr = track.querySelector('.br'), tBrI = tBr.querySelector('i');
  const toastEl = el('div', 'qs-toast');
  const big = el('div', 'qs-big'); big.hidden = true;
  let toastT = 0, bigT = 0;
  function toast(html, sec = 2.6) { toastEl.innerHTML = html; toastEl.classList.add('on'); toastT = sec; }
  function bigText(s, sec = 0.8) { big.textContent = s; big.hidden = false; bigT = sec; big.style.animation = 'none'; void big.offsetWidth; big.style.animation = 'qs-pop .25s ease-out'; }

  /* ── 소리 (짧은 딩동) ── */
  let actx = null;
  function chime(kind = 'ok') {
    if (isMuted()) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const notes = kind === 'done' ? [523, 659, 784, 1047] : kind === 'bad' ? [330, 247] : [659, 880];
      const t0 = actx.currentTime;
      notes.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0 + i * 0.09); g.gain.linearRampToValueAtTime(0.09, t0 + i * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.09 + 0.35);
        o.connect(g).connect(actx.destination); o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 0.4);
      });
    } catch { /* 소리 없이 */ }
  }

  /* ── 게시판 모형 ── */
  const BZ = boardOpt && Number.isFinite(boardOpt.z) ? boardOpt.z : 57.4;
  const BX = boardOpt && Number.isFinite(boardOpt.x) ? boardOpt.x : pathX(BZ) - 4.6;
  const BROT = boardOpt && Number.isFinite(boardOpt.rotY) ? boardOpt.rotY : Math.PI / 2 - 0.45;   // 앞면이 길(+x)과 출발점(+z) 쪽
  const BFX = Math.sin(BROT), BFZ = Math.cos(BROT);
  const BOARD = { x: BX, z: BZ, y: groundY(BX, BZ), fx: BFX, fz: BFZ };
  const owned = [];   // 치울 것(geometry/material/texture)
  const own = o => { owned.push(o); return o; };
  const boardG = new THREE.Group(); boardG.name = 'quest-board';
  boardG.position.set(BX, BOARD.y, BZ); boardG.rotation.y = BROT;
  {
    const wood = own(new THREE.MeshStandardMaterial({ color: 0x7a4e2c, roughness: 0.85 }));
    const woodD = own(new THREE.MeshStandardMaterial({ color: 0x4e2f18, roughness: 0.9 }));
    const box = (w, h, d, m, x, y, z, ry = 0, rz = 0) => {
      const ms = new THREE.Mesh(own(new THREE.BoxGeometry(w, h, d)), m); ms.position.set(x, y, z); ms.rotation.set(0, ry, rz);
      ms.castShadow = true; ms.receiveShadow = true; boardG.add(ms); return ms;
    };
    box(0.16, 2.7, 0.16, woodD, -1.15, 1.35, 0); box(0.16, 2.7, 0.16, woodD, 1.15, 1.35, 0);
    /* 판자 (나뭇결 + 양피지 쪽지 그림) */
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 320;
    const c = cv.getContext('2d');
    c.fillStyle = '#8a5a32'; c.fillRect(0, 0, 512, 320);
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#7d5029' : '#93613a'; c.fillRect(0, i * 53, 512, 51); c.fillStyle = 'rgba(40,20,8,.45)'; c.fillRect(0, i * 53 + 51, 512, 2); }
    c.strokeStyle = 'rgba(50,25,8,.25)'; c.lineWidth = 1.2;
    for (let i = 0; i < 40; i++) { const y = Math.random() * 320; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(170, y + rr(-6, 6), 340, y + rr(-6, 6), 512, y + rr(-4, 4)); c.stroke(); }
    const notes = [[40, 40, 130, 150, -0.06], [190, 30, 135, 120, 0.04], [345, 50, 130, 160, -0.03], [210, 170, 120, 120, 0.07], [60, 205, 110, 95, 0.05]];
    for (const [x, y, w, h, a] of notes) {
      c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(a);
      c.fillStyle = '#f3e3bd'; c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = 'rgba(120,80,30,.18)'; c.fillRect(-w / 2, h / 2 - 10, w, 10);
      c.fillStyle = '#5a3a1a'; c.font = '700 22px Georgia,serif'; c.textAlign = 'center'; c.fillText('의뢰', 0, -h / 2 + 32);
      c.fillStyle = 'rgba(70,45,20,.55)'; for (let k = 0; k < 4; k++) c.fillRect(-w / 2 + 14, -h / 2 + 48 + k * 16, w - 28 - (k === 3 ? 30 : 0), 4);
      c.fillStyle = '#b3262e'; c.beginPath(); c.arc(0, -h / 2 + 8, 6, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    const tex = own(new THREE.CanvasTexture(cv)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const face = own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    const pb = box(2.3, 1.45, 0.1, wood, 0, 1.55, 0);
    pb.material = [wood, wood, wood, wood, face, wood];
    box(2.46, 0.1, 0.16, woodD, 0, 2.31, 0.02); box(2.46, 0.1, 0.16, woodD, 0, 0.8, 0.02);
    /* 지붕 */
    box(2.8, 0.07, 0.62, woodD, 0, 2.62, -0.2, 0, 0).rotation.x = 0.5;
    box(2.8, 0.07, 0.62, woodD, 0, 2.62, 0.2, 0, 0).rotation.x = -0.5;
    /* 머리 간판 "의뢰 게시판" */
    const sv = document.createElement('canvas'); sv.width = 512; sv.height = 112;
    const s = sv.getContext('2d');
    s.fillStyle = '#3a2214'; s.fillRect(0, 0, 512, 112); s.fillStyle = '#5a3420'; s.fillRect(6, 6, 500, 100);
    s.font = '800 64px Georgia,serif'; s.textAlign = 'center'; s.textBaseline = 'middle';
    s.fillStyle = 'rgba(0,0,0,.45)'; s.fillText('의뢰 게시판', 260, 62); s.fillStyle = '#ffe2a8'; s.fillText('의뢰 게시판', 256, 58);
    const stex = own(new THREE.CanvasTexture(sv)); stex.colorSpace = THREE.SRGBColorSpace;
    const sm = box(1.7, 0.38, 0.07, woodD, 0, 2.08, 0.07);
    sm.material = [woodD, woodD, woodD, woodD, own(new THREE.MeshStandardMaterial({ map: stex, roughness: 0.85 })), woodD];
  }
  /* 위에 떠서 도는 "!" (의뢰가 있다는 표시) */
  const bang = (() => {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const c = cv.getContext('2d');
    c.font = '900 110px Georgia,serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 12; c.strokeStyle = '#7a3a08'; c.strokeText('!', 64, 70); c.fillStyle = '#ffd34a'; c.fillText('!', 64, 70);
    const tx = own(new THREE.CanvasTexture(cv)); tx.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, toneMapped: false })));
    sp.scale.set(0.8, 0.8, 1); sp.position.set(0, 3.35, 0); boardG.add(sp); return sp;
  })();
  scene.add(boardG);

  /* ── 목표 위 화살표 (vehicles.js 화살표와 같은 모양, 주황) ── */
  const marker = new THREE.Group();
  {
    const mat = own(new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
    const head = new THREE.Mesh(own(new THREE.ConeGeometry(0.42, 0.7, 4)), mat); head.rotation.x = Math.PI;
    const tail = new THREE.Mesh(own(new THREE.BoxGeometry(0.22, 0.5, 0.22)), mat); tail.position.y = 0.6;
    marker.add(head, tail); marker.traverse(o => { o.renderOrder = 999; });
  }
  marker.visible = false; scene.add(marker);

  /* ── 아기 양 (코드 모형) ── */
  let lamb = null;
  function makeLamb() {
    const g = new THREE.Group(); g.name = 'quest-lamb';
    const wool = own(new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 1 }));
    const skin = own(new THREE.MeshStandardMaterial({ color: 0x3a2c26, roughness: 0.8 }));
    const sph = own(new THREE.SphereGeometry(1, 12, 9));
    const body = new THREE.Group(); body.position.y = 0.5; g.add(body);
    const add = (geo, m, x, y, z, sx, sy, sz, parent = body) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; parent.add(o); return o; };
    add(sph, wool, 0, 0, 0, 0.32, 0.27, 0.42);
    for (const [x, y, z] of [[0.15, 0.14, 0.15], [-0.15, 0.14, 0.12], [0, 0.2, -0.12], [0.18, 0.05, -0.22], [-0.17, 0.06, -0.2], [0, 0.17, 0.3]]) add(sph, wool, x, y, z, 0.17, 0.15, 0.17);
    const head = new THREE.Group(); head.position.set(0, 0.17, 0.4); body.add(head);
    add(sph, skin, 0, 0, 0.06, 0.13, 0.13, 0.17, head);
    add(sph, wool, 0, 0.1, -0.02, 0.13, 0.08, 0.12, head);
    add(sph, skin, 0.14, 0.02, -0.02, 0.09, 0.035, 0.05, head).rotation.z = -0.4;
    add(sph, skin, -0.14, 0.02, -0.02, 0.09, 0.035, 0.05, head).rotation.z = 0.4;
    const eyeM = own(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    add(sph, eyeM, 0.065, 0.04, 0.17, 0.025, 0.025, 0.02, head); add(sph, eyeM, -0.065, 0.04, 0.17, 0.025, 0.025, 0.02, head);
    const legGeo = own(new THREE.CylinderGeometry(0.045, 0.04, 0.36, 6)); legGeo.translate(0, -0.18, 0);
    const legs = [];
    for (const [x, z] of [[0.14, 0.2], [-0.14, 0.2], [0.14, -0.22], [-0.14, -0.22]]) {
      const l = new THREE.Mesh(legGeo, skin); l.position.set(x, 0.33, z); l.castShadow = true; g.add(l); legs.push(l);
    }
    scene.add(g);
    return { g, body, head, legs, x: 0, z: 0, yaw: 0, speed: 0, phase: 0, baa: 0, hop: 0, fade: 0 };
  }
  function placeLamb(x, z) { if (!lamb) lamb = makeLamb(); lamb.x = x; lamb.z = z; lamb.g.visible = true; lamb.g.scale.setScalar(1); lamb.fade = 0; lamb.speed = 0; }
  function stepLamb(dt, tx, tz, maxSp) {
    const L = lamb, dx = tx - L.x, dz = tz - L.z, d = Math.hypot(dx, dz);
    const want = d > 0.25 ? Math.min(maxSp, d * 1.6) : 0;
    L.speed += (want - L.speed) * Math.min(1, dt * 5);
    if (d > 0.05 && L.speed > 0.05) {
      const yaw = Math.atan2(dx, dz); let dy = yaw - L.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      L.yaw += dy * Math.min(1, dt * 7);
      const s = Math.min(d, L.speed * dt); L.x += dx / d * s; L.z += dz / d * s;
    }
    animLamb(dt);
  }
  function animLamb(dt) {
    const L = lamb; L.phase += dt * (2 + L.speed * 4.5);
    const sw = Math.sin(L.phase) * Math.min(0.6, L.speed * 0.25);
    L.legs[0].rotation.x = L.legs[3].rotation.x = sw; L.legs[1].rotation.x = L.legs[2].rotation.x = -sw;
    L.hop = Math.max(0, L.hop - dt);
    const hy = L.hop > 0 ? Math.sin((1 - L.hop / 0.5) * Math.PI) * 0.35 : 0;
    L.body.position.y = 0.5 + Math.abs(Math.sin(L.phase)) * Math.min(0.05, L.speed * 0.02);
    L.head.rotation.x = L.speed < 0.1 ? Math.sin(L.phase * 0.4) * 0.15 + 0.15 : 0;
    L.g.position.set(L.x, groundY(L.x, L.z) + hy, L.z); L.g.rotation.y = L.yaw;
  }

  /* ── 왕관 (코드 모형) ── */
  let crown = null;
  function makeCrown() {
    const g = new THREE.Group(); g.name = 'quest-crown';
    const gold = own(new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 0.85, roughness: 0.28, emissive: 0x6a3a00, emissiveIntensity: 0.6 }));
    const gem = own(new THREE.MeshStandardMaterial({ color: 0xd0182a, metalness: 0.2, roughness: 0.2, emissive: 0x5a0008, emissiveIntensity: 0.8 }));
    const band = new THREE.Mesh(own(new THREE.CylinderGeometry(0.22, 0.2, 0.14, 18, 1, true)), gold); band.material.side = THREE.DoubleSide; band.castShadow = true; g.add(band);
    const spike = own(new THREE.ConeGeometry(0.05, 0.16, 6)), ball = own(new THREE.SphereGeometry(0.03, 8, 6)), gemG = own(new THREE.SphereGeometry(0.035, 8, 6));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const s = new THREE.Mesh(spike, gold); s.position.set(Math.sin(a) * 0.2, 0.14, Math.cos(a) * 0.2); g.add(s);
      const b = new THREE.Mesh(ball, gold); b.position.set(Math.sin(a) * 0.2, 0.235, Math.cos(a) * 0.2); g.add(b);
      const m = new THREE.Mesh(gemG, gem); m.position.set(Math.sin(a + 0.52) * 0.215, 0, Math.cos(a + 0.52) * 0.215); g.add(m);
    }
    scene.add(g);
    return g;
  }

  /* ── 맥주잔 (손에 든 것처럼 가슴 앞) ── */
  let mug = null;
  function makeMug() {
    const g = new THREE.Group(); g.name = 'quest-mug';
    const wood = own(new THREE.MeshStandardMaterial({ color: 0x8a5a2c, roughness: 0.7 }));
    const foamM = own(new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 1 }));
    const body = new THREE.Mesh(own(new THREE.CylinderGeometry(0.09, 0.1, 0.2, 12)), wood); body.castShadow = true; g.add(body);
    const foam = new THREE.Mesh(own(new THREE.SphereGeometry(0.095, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), foamM); foam.position.y = 0.095; foam.scale.y = 0.6; g.add(foam);
    const handle = new THREE.Mesh(own(new THREE.TorusGeometry(0.06, 0.016, 6, 12, Math.PI)), wood); handle.position.set(0.1, 0, 0); handle.rotation.z = -Math.PI / 2; g.add(handle);
    g.userData.foam = foam;
    scene.add(g); return g;
  }

  /* ── 위치 도우미 ── */
  const ponds = () => { const f = getFishing(); return (f && f.ponds) || [{ x: 10, z: 76, r: 4.6 }, { x: 8, z: 10, r: 4.6 }, { x: 19, z: -54, r: 4.6 }]; };
  function stalls() { const n = getNpcs(); return (n && n.stalls) || []; }
  function okSpot(x, z) {
    if (x < bounds.minX + 4 || x > bounds.maxX - 4 || z < bounds.minZ + 10 || z > bounds.maxZ - 6) return false;
    if (Math.abs(x - pathX(z)) < 4.5) return false;                         // 길 위는 너무 쉽다
    if (Math.abs(z + 36.4) < 8) return false;                               // 개울
    for (const p of ponds()) if (Math.hypot(x - p.x, z - p.z) < (p.r || 4.6) + 3) return false;
    for (const s of stalls()) if (Math.hypot(x - s.x, z - s.z) < 7) return false;
    if (z < -66 && Math.abs(x - pathX(z)) < 20) return false;               // 성벽 근처
    const gy = groundY(x, z); if (!Number.isFinite(gy) || gy < -0.2) return false;
    return true;
  }
  function farSpot(from, minD, maxD = 999) {
    for (let k = 0; k < 200; k++) {
      const x = rr(bounds.minX + 5, bounds.maxX - 5), z = rr(bounds.minZ + 12, bounds.maxZ - 8);
      const d = Math.hypot(x - from.x, z - from.z);
      if (d >= minD && d <= maxD && okSpot(x, z)) return { x, z };
    }
    return { x: -28, z: 20 };
  }
  function gateTarget() {
    const g = castleGate;
    const r = safe(() => {
      if (!g) return null;
      if (typeof g.gateFront === 'function') return g.gateFront(0, 6);
      if (typeof g.villageGate === 'function') return g.villageGate(0).front;
      if (g.front) return g.front;
      if (Number.isFinite(g.x)) return { x: g.x, z: g.z };
      return null;
    });
    return r && Number.isFinite(r.x) ? r : { x: pathX(-76), z: -76 };
  }
  function npcEntries() { const n = getNpcs(); return (n && typeof n.list === 'function') ? (safe(() => n.list()) || []) : []; }
  function entryOf(npc) { for (const e of npcEntries()) if (e.npc === npc) return e; return null; }
  function npcSay(npc, text, life = 2.2) { const n = getNpcs(); if (n && n.say && npc) safe(() => n.say(npc, text, life)); }
  const LYING = new Set(['FLYING', 'LYING', 'GETUP', 'HELD', 'ROLL', 'STAGGER', 'OFF', 'ACTOR', 'FLEE']);

  /* ── 상태 ── */
  let active = null;          // { id, def, d: {...} }
  let panelOpen = false, disposed = false, lastP = null, pSpeed = 0, near = false, rideNotified = null;
  let fishPoll = 0;
  const P = new V();
  const _v = new V();

  /* ── 의뢰 판 채우기 ── */
  function available(id) {
    const vg = getVillage();
    if (id === 'chicken') return !!(vg && vg.triggerChickens) && stalls().length > 0;
    if (id === 'thief') return !!(vg && vg.triggerThief);
    if (id === 'king') return !!(vg && vg.triggerProcession);
    if (id === 'beer') return stalls().length > 0 && npcEntries().length > 3;
    if (id === 'talk') return npcEntries().length >= 5;
    if (id === 'project') return stalls().length >= 3;
    if (id === 'fish') return !!getFishing();
    return true;
  }
  function refill() {
    save.offers = save.offers.filter(id => DEFS[id]);
    let guard = 0;
    while (save.offers.length < 3 && guard++ < 40) {
      const pool = ALL_IDS.filter(id => !save.offers.includes(id) && (guard > 25 || available(id)));
      const fresh = pool.filter(id => !save.done[id]);                    // 아직 안 해 본 것 먼저 (반반)
      const id = pick(fresh.length && Math.random() < 0.6 ? fresh : pool);
      if (!id) break;
      save.offers.push(id);
    }
    persist();
  }
  refill();

  /* ── 의뢰별 동작 ──
     start(d) → 준비, tick(d, dt) → 'done' | 실패 문자열 | undefined, target(d) → {x, z, h} | null, hud(d) → { ob, prog(0..1)|null, cls } */
  const Q = {
    sheep: {
      start(d) {
        const s = farSpot(FLOCK_HOME, 45, 110);
        placeLamb(s.x, s.z); d.phase = 'find'; d.baaT = 2;
      },
      tick(d, dt) {
        const L = lamb, dist = Math.hypot(P.x - L.x, P.z - L.z);
        const home = flockCenter();
        if (d.phase === 'find') {
          animLamb(dt);
          L.baa -= dt;
          if (dist < 3.2 && isOnFoot()) { d.phase = 'lead'; L.hop = 0.5; toast('🐑 "메에~" 아기 양이 졸졸 따라와요! 양 떼에게 데려가세요'); chime(); }
        } else if (d.phase === 'lead') {
          if (dist > 28 || !isOnFoot()) { d.phase = 'find'; toast('아기 양이 겁먹고 멈췄어요. 다시 가서 데려가요 (탈것은 무서워해요)'); return; }
          const off = 1.7, ux = (L.x - P.x) / (dist || 1), uz = (L.z - P.z) / (dist || 1);
          stepLamb(dt, P.x + ux * off, P.z + uz * off, dist > 6 ? 7.5 : 4.6);
          if (Math.hypot(L.x - home.x, L.z - home.z) < 7) { L.hop = 0.5; return 'done'; }
        }
      },
      target(d) { return d.phase === 'find' ? { x: lamb.x, z: lamb.z, h: 1.6 } : { ...flockCenter(), h: 2.4 }; },
      hud(d) {
        if (d.phase === 'find') return { ob: '멀리 떨어진 아기 양을 찾아 가까이 가세요' };
        const h = flockCenter(), dd = Math.hypot(lamb.x - h.x, lamb.z - h.z);
        return { ob: `양 떼 풀밭까지 데려가기 (남은 ${Math.max(0, dd - 7).toFixed(0)} m)` };
      },
      end(d, ok) { if (!lamb) return; if (ok) lamb.fade = 2.2; else lamb.g.visible = false; },
    },
    beer: {
      start(d) {
        const st = stalls(); const near3 = st.map((s, i) => ({ s, i, dd: Math.hypot(s.x - P.x, s.z - P.z) })).sort((a, b) => a.dd - b.dd).slice(0, 2);
        const c = pick(near3); d.si = c.i; d.stall = { x: c.s.x, z: c.s.z }; d.phase = 'pickup'; d.spill = 0;
      },
      tick(d, dt) {
        if (d.phase === 'pickup') {
          if (Math.hypot(P.x - d.stall.x, P.z - d.stall.z) < 3.4 && isOnFoot()) {
            const n = getNpcs(); if (n && n.barkeeperServe) safe(() => n.barkeeperServe(d.si));
            d.who = chooseThirsty(d.stall); d.phase = 'carry'; d.spill = 0; d.sayT = 0.5;
            if (!d.who) return '목마른 손님이 안 보여요';
            if (!mug) mug = makeMug(); mug.visible = true;
            toast('🍺 맥주잔을 받았어요! 머리 위 화살표의 손님에게 — <b>뛰지 말고 천천히</b>'); chime();
          }
          if (mug) mug.visible = false;
          return;
        }
        /* 들고 가기 */
        const e = entryOf(d.who);
        if (!e || e.off) { d.who = chooseThirsty(P); if (!d.who) return '손님이 사라졌어요'; return; }
        const tp = e.pos;
        if (!isOnFoot()) d.spill += 70 * dt;
        else if (pSpeed > 5) d.spill += (pSpeed - 4.6) * 11 * dt;
        if (d.spill >= 100) { d.phase = 'pickup'; d.spill = 0; if (mug) mug.visible = false; toast('😱 맥주를 다 쏟았어요! 가판대에서 다시 받아 오세요'); chime('bad'); return; }
        d.sayT -= dt;
        if (d.sayT <= 0) { d.sayT = rr(5, 8); npcSay(d.who, pick(['맥주… 목말라요…', '여기요~ 맥주!', '아직인가요?', '목이 타요~'])); }
        if (mug) {
          if (lastDir.lengthSq() < 1e-4) lastDir.set(0, 0, 1);
          mug.position.set(P.x + lastDir.x * 0.42, groundY(P.x, P.z) + (isOnFoot() ? 1.12 : 2.0), P.z + lastDir.z * 0.42);
          mug.rotation.z = Math.sin(performance.now() / 120) * Math.min(0.5, d.spill / 160 + Math.max(0, pSpeed - 4.6) * 0.04);
          mug.userData.foam.visible = d.spill < 60;
        }
        if (Math.hypot(P.x - tp.x, P.z - tp.z) < 2 && isOnFoot()) {
          npcSay(d.who, pick(['캬~ 고마워요!', '이 맛이야!', '임금님 만세! 건배!']), 2.6);
          d.tip = d.spill < 10 ? 4 : d.spill < 40 ? 2 : 0;
          return 'done';
        }
      },
      target(d) {
        if (d.phase === 'pickup') return { x: d.stall.x, z: d.stall.z, h: 3.4 };
        const e = entryOf(d.who); return e ? { x: e.pos.x, z: e.pos.z, h: 2.6 } : null;
      },
      hud(d) {
        if (d.phase === 'pickup') return { ob: '가판대에서 맥주잔 받기' };
        return { ob: d.spill > 60 ? '넘쳐요! 천천히 걸어요' : '목마른 손님에게 배달 (쏟음 게이지)', prog: d.spill / 100, cls: 'sp' };
      },
      end() { if (mug) mug.visible = false; },
    },
    chicken: {
      start(d) { d.need = 3; d.n = 0; d.base = null; d.retry = 0.3; d.seen = false; },
      tick(d, dt) {
        const vg = getVillage(); if (!vg) return;
        const c = vg.state && vg.state.chickens;
        if (c) {
          if (d.base === null) { d.base = c.caught; d.home = nearestStall(P); }
          if (c.caught > d.base) { d.n += c.caught - d.base; d.base = c.caught; if (d.n < d.need) toast(`🐔 닭 ${d.n}/${d.need}`, 1.4); }
          d.seen = true;
        } else {
          d.base = null;
          d.retry -= dt;
          if (d.retry <= 0) {
            d.retry = 4;
            if (d.seen) toast('닭들이 또 뛰쳐나왔어요!');
            d.home = nearestStall(P);
            safe(() => vg.triggerChickens());
          }
        }
        if (d.n >= d.need) return 'done';
      },
      target(d) { return d.home ? { x: d.home.x, z: d.home.z, h: 3.4 } : null; },
      hud(d) { return { ob: `도망친 닭 잡기 ${d.n}/${d.need} (닭에 몸으로 부딪히기)`, prog: d.n / d.need }; },
    },
    fish: {
      start(d) { d.need = 2; d.n = 0; d.base = fishTotal(); },
      tick(d) {
        if (getFishing()) { const tot = fishTotal(); if (tot !== null && d.base !== null && tot > d.base) { d.n += tot - d.base; d.base = tot; } else if (d.base === null) d.base = tot; }
        if (d.n >= d.need) return 'done';
      },
      target() { const f = getFishing(); if (f && f.active) return null; let b = null, bd = 1e9; for (const p of ponds()) { const dd = Math.hypot(p.x - P.x, p.z - P.z); if (dd < bd) { bd = dd; b = p; } } return b ? { x: b.x, z: b.z, h: 2.2 } : null; },
      hud(d) { return { ob: `연못에서 물고기 낚기 ${d.n}/${d.need} (물가에서 F)`, prog: d.n / d.need }; },
    },
    crown: {
      start(d) {
        const s = farSpot(BOARD, 35, 100); d.x = s.x; d.z = s.z; d.phase = 'find'; d.lastBand = '';
        if (!crown) crown = makeCrown();
        crown.visible = true; crown.scale.setScalar(1);
      },
      tick(d, dt, t) {
        if (d.phase === 'find') {
          crown.position.set(d.x, groundY(d.x, d.z) + 0.12 + Math.sin(t * 2) * 0.03, d.z); crown.rotation.set(0.25, t * 0.8, 0.1);
          const dist = Math.hypot(P.x - d.x, P.z - d.z);
          if (dist < 1.8 && isOnFoot()) { d.phase = 'return'; toast('👑 왕관을 찾았어요! 의뢰 게시판으로 가져가세요'); chime(); }
          else if (dist < 1.8) d.needFoot = true;
        } else {
          const gy = groundY(P.x, P.z);
          crown.position.set(P.x, gy + (isOnFoot() ? 2.15 : 2.9), P.z); crown.rotation.set(0, t * 0.6, 0);   // 머리 위에 (잠깐 써 보기)
          if (Math.hypot(P.x - BOARD.x, P.z - BOARD.z) < 3.4) return 'done';
        }
      },
      target(d) { return d.phase === 'return' ? { x: BOARD.x, z: BOARD.z, h: 3.9 } : null; },   // 찾을 땐 화살표 없이 뜨거워요/차가워요
      hud(d) {
        if (d.phase === 'return') return { ob: '왕관을 의뢰 게시판에 돌려놓기' };
        const dist = Math.hypot(P.x - d.x, P.z - d.z);
        const [txt, cls] = dist < 5 ? ['🔥🔥 바로 근처! 발밑을 살펴요', 'hot'] : dist < 12 ? ['🔥 뜨거워요!', 'hot'] : dist < 24 ? ['따뜻해요', 'hot'] : dist < 40 ? ['미지근해요…', ''] : dist < 60 ? ['❄ 차가워요', 'cold'] : ['❄❄ 꽁꽁 얼었어요', 'cold'];
        return { ob: `${txt}${d.needFoot ? ' (내려서 주워요)' : ''}`, cls, prog: clamp01(1 - dist / 80) };
      },
      end() { if (crown) crown.visible = false; },
    },
    thief: {
      start(d) { d.wait = 2.5; d.seen = false; d.phase = ''; },
      tick(d, dt) {
        const vg = getVillage(); if (!vg) return;
        const th = vg.state && vg.state.thief;
        if (th) {
          d.seen = true; d.phase = th.phase; d.t = th.t;
          if (th.phase === 'caught') return 'done';
        } else {
          if (d.seen) { d.seen = false; d.wait = 10; toast('도둑이 도망쳤어요… 곧 또 나타날 거예요'); }
          d.wait -= dt;
          if (d.wait <= 0) { d.wait = 3; safe(() => vg.triggerThief()); }
          d.phase = '';
        }
      },
      target() { return null; },
      hud(d) {
        if (d.phase === 'run') return { ob: `도둑이야! 붙잡거나 넘어뜨리기 (${d.t}초)`, cls: 'hot', prog: clamp01((d.t || 0) / 30) };
        if (d.phase) return { ob: '후드 쓴 수상한 사람을 지켜봐요…' };
        return { ob: '마을 사람 많은 곳에서 "도둑이야!"를 기다리기' };
      },
    },
    talk: {
      start(d) { d.need = 5; d.set = new Set(); d.cur = null; d.tgt = null; d.tgtT = 0; },
      tick(d, dt) {
        const dg = getDialogue();
        const who = dg ? safe(() => dg.talking) : null;
        if (who && who !== d.cur) countTalk(d, who);
        d.cur = who || null;
        d.tgtT -= dt;
        if (d.tgtT <= 0) {
          d.tgtT = 1;
          let b = null, bd = 1e9;
          for (const e of npcEntries()) { if (e.off || e.guard || d.set.has(e.npc) || LYING.has(e.state)) continue; const dd = Math.hypot(e.pos.x - P.x, e.pos.z - P.z); if (dd < bd) { bd = dd; b = e; } }
          d.tgt = b;
        }
        if (d.set.size >= d.need) return 'done';
      },
      target(d) { const dg = getDialogue(); if (dg && dg.active) return null; return d.tgt ? { x: d.tgt.pos.x, z: d.tgt.pos.z, h: 2.5 } : null; },
      hud(d) { return { ob: `마을 사람과 대화하기 ${d.set.size}/${d.need} (가까이 가서 F)`, prog: d.set.size / d.need }; },
    },
    project: {
      start(d) { d.need = 3; d.ids = new Set(); d.st = new Set(); },
      tick(d) { if (d.ids.size >= d.need) return 'done'; },
      target(d) {
        let b = null, bd = 1e9;
        stalls().forEach((s, i) => { if (d.st.has(i)) return; const dd = Math.hypot(s.x - P.x, s.z - P.z); if (dd < bd) { bd = dd; b = s; } });
        return b ? { x: b.x, z: b.z, h: 5.5 } : null;
      },
      hud(d) { return { ob: `프로젝트 가판대 둘러보기 ${d.ids.size}/${d.need} (가까이에서 Space)`, prog: d.ids.size / d.need }; },
    },
    race: {
      start(d) { d.phase = 'goto'; d.limit = 30; d.t = 0; d.cd = 0; d.best = save.raceBest || null; },
      tick(d, dt) {
        const atBoard = Math.hypot(P.x - BOARD.x, P.z - BOARD.z) < 5;
        if (d.phase === 'goto') {
          if (atBoard && isOnFoot() && !panelOpen) { d.phase = 'count'; d.cd = 3.2; d.shown = 4; }
        } else if (d.phase === 'count') {
          if (!atBoard || !isOnFoot()) { d.phase = 'goto'; toast('출발선(게시판)에서 기다려요'); return; }
          d.cd -= dt;
          const k = Math.ceil(d.cd);
          if (k !== d.shown) { d.shown = k; if (k > 0) { bigText(String(k)); chime(); } }
          if (d.cd <= 0) { d.phase = 'run'; d.t = 0; bigText('출발!', 0.9); chime('done'); }
        } else if (d.phase === 'run') {
          d.t += dt;
          if (!isOnFoot()) { d.phase = 'goto'; toast('탈것은 반칙이에요! 게시판에서 다시 출발'); chime('bad'); return; }
          if (d.t > d.limit) { d.phase = 'goto'; toast(`시간 초과! (${d.limit}초) 게시판에서 다시 도전`); chime('bad'); return; }
          const g = gateTarget();
          if (Math.hypot(P.x - g.x, P.z - g.z) < 7) {
            d.time = d.t;
            if (!save.raceBest || d.t < save.raceBest) save.raceBest = +d.t.toFixed(2);
            return 'done';
          }
        }
      },
      target(d) { if (d.phase === 'goto') return { x: BOARD.x, z: BOARD.z, h: 3.9 }; const g = gateTarget(); return { x: g.x, z: g.z, h: 6 }; },
      hud(d) {
        if (d.phase === 'goto') return { ob: '게시판 앞에 서면 3·2·1 출발' + (save.raceBest ? ` (최고 ${save.raceBest.toFixed(1)}초)` : '') };
        if (d.phase === 'count') return { ob: '준비…' };
        const left = d.limit - d.t;
        return { ob: `북쪽 성문까지! 남은 ${left.toFixed(1)}초 (Shift 달리기)`, prog: clamp01(left / d.limit), cls: left < 8 ? 'sp' : '' };
      },
    },
    ride: {
      start(d) { d.need = 3; d.dist = {}; d.got = new Set(); d.last = null; },
      tick(d) {
        const id = getRide ? safe(() => getRide()) : (!isOnFoot() ? rideNotified : null);
        if (!id) { d.last = null; return; }
        if (d.last && d.lastId === id) {
          const step = Math.hypot(P.x - d.last.x, P.z - d.last.z);
          if (step < 5) d.dist[id] = (d.dist[id] || 0) + step;
        }
        d.last = { x: P.x, z: P.z }; d.lastId = id;
        if (!d.got.has(id) && (d.dist[id] || 0) >= 20) {
          d.got.add(id);
          if (d.got.size < d.need) { toast(`${RIDE_KO[id] || id} 시승 완료! (${d.got.size}/${d.need}) — V 키로 다른 탈것`); chime(); }
        }
        if (d.got.size >= d.need) return 'done';
      },
      target() { return null; },
      hud(d) {
        const id = getRide ? safe(() => getRide()) : (!isOnFoot() ? rideNotified : null);
        const cur = id && !d.got.has(id) ? ` · ${RIDE_KO[id] || id} ${Math.min(20, d.dist[id] || 0).toFixed(0)}/20 m` : '';
        return { ob: `서로 다른 탈것 ${d.got.size}/${d.need}${cur}${isOnFoot() ? ' (F 타기, V 바꾸기)' : ''}`, prog: d.got.size / d.need };
      },
    },
    king: {
      start(d) { d.wait = 0.5; d.seen = false; },
      tick(d, dt) {
        const vg = getVillage(); if (!vg) return;
        const pr = vg.state && vg.state.procession;
        if (pr) {
          d.seen = true; d.kz = pr.z; d.kx = pathX(pr.z);
          if (Math.hypot(P.x - d.kx, P.z - d.kz) < 5.5) { toast('🤴 "오, 백성이여! 반갑구나!"'); return 'done'; }
        } else {
          if (d.seen) { d.seen = false; d.wait = 6; toast('행차가 지나갔어요… 곧 다시 오신대요'); }
          d.wait -= dt;
          if (d.wait <= 0) { d.wait = 5; if (safe(() => vg.triggerProcession())) toast('"임금님 납시오!" 행차가 시작됐어요'); }
          d.kz = null;
        }
      },
      target(d) { return d.kz != null ? { x: d.kx, z: d.kz, h: 4.2 } : null; },
      hud(d) { return { ob: d.kz != null ? '임금님께 다가가 인사하기 (5 m 안)' : '행차를 기다리는 중…' }; },
    },
  };

  function flockCenter() {
    const an = getAnimals();
    const L = an && typeof an.list === 'function' ? safe(() => an.list()) : null;
    if (L) { let x = 0, z = 0, n = 0; for (const a of L) if (a.kind === 'sheep') { x += a.x; z += a.z; n++; } if (n) return { x: x / n, z: z / n }; }
    return { ...FLOCK_HOME };
  }
  function nearestStall(p) { let b = null, bd = 1e9; for (const s of stalls()) { const dd = Math.hypot(s.x - p.x, s.z - p.z); if (dd < bd) { bd = dd; b = s; } } return b ? { x: b.x, z: b.z } : null; }
  function chooseThirsty(from) {
    const es = npcEntries().filter(e => !e.off && !e.barkeeper && !e.guard && !LYING.has(e.state));
    const mid = es.filter(e => { const dd = Math.hypot(e.pos.x - from.x, e.pos.z - from.z); return dd > 10 && dd < 40; });
    const c = pick(mid.length ? mid : es);
    return c ? c.npc : null;
  }
  function fishTotal() {
    const f = getFishing(); if (!f || typeof f.log !== 'function') return null;
    const L = safe(() => f.log()); if (!L) return null;
    let n = 0; for (const k in L) n += (L[k] && L[k].n) || 0; return n;
  }
  function countTalk(d, npc) {
    if (!npc || d.set.has(npc)) return;
    d.set.add(npc);
    if (d.set.size < d.need) toast(`💬 대화 ${d.set.size}/${d.need}`, 1.4);
  }

  /* ── 수락 · 포기 · 완료 ── */
  function accept(id) {
    if (!DEFS[id] || !Q[id]) return false;
    if (active) end(false, true);
    active = { id, def: DEFS[id], d: {}, t: 0 };
    const d = active.d;
    safe(() => Q[id].start(d));
    toast(`${DEFS[id].icon} 의뢰 수락: <b>${DEFS[id].title}</b>`); chime();
    emit('accept', { id });
    renderPanel(); renderTrack(true);
    return true;
  }
  function end(ok, silent = false) {
    if (!active) return;
    const { id, def, d } = active;
    safe(() => Q[id].end && Q[id].end(d, ok));
    active = null;
    marker.visible = false;
    if (ok) {
      let reward = def.reward + (d.tip || 0);
      if (id === 'race' && d.time) reward += Math.max(0, Math.round((d.limit - d.time) / 3));
      addCoins(reward);
      save.done[id] = (save.done[id] || 0) + 1;
      save.total = (save.total || 0) + 1;
      save.offers = save.offers.filter(x => x !== id);
      const newBadges = [];
      if (!save.badges.includes(def.badge)) { save.badges.push(def.badge); newBadges.push(def.badge); }
      for (const [n, name] of MILESTONES) if (save.total >= n && !save.badges.includes(name)) { save.badges.push(name); newBadges.push(name); }
      refill();
      const extra = id === 'race' && d.time ? ` (${d.time.toFixed(1)}초)` : id === 'beer' && d.tip ? ' + 팁' : '';
      toast(`${def.icon} <b>${def.title}</b> 완료!${extra}<br>은화 +${reward}` + (newBadges.length ? `<br>🏅 칭호 「${newBadges.join('」「')}」` : ''), 4.2);
      chime('done');
      emit('complete', { id, reward, badges: newBadges });
      for (const b of newBadges) emit('badge', { name: b });
    } else if (!silent) {
      toast(`의뢰 포기: ${def.title}`); emit('abandon', { id });
    }
    persist(); renderPanel(); renderTrack(true);
  }
  function addCoins(n) {
    const tv = getTavern();
    if (tv && typeof tv.addCoins === 'function') { safe(() => tv.addCoins(n)); }
    else save.coins = (save.coins || 0) + n;
  }
  function coins() { const tv = getTavern(); return tv && typeof tv.addCoins === 'function' ? (tv.coins | 0) : (save.coins | 0); }

  /* ── 게시판 창 ── */
  function renderPanel() {
    if (!panelOpen) return;
    const ids = save.offers.slice();
    if (active && !ids.includes(active.id)) ids.unshift(active.id);
    const cards = ids.map(id => {
      const q = DEFS[id], on = active && active.id === id;
      const got = save.badges.includes(q.badge);
      return `<div class="qs-card${on ? ' on' : ''}"><span class="ic" aria-hidden="true">${q.icon}</span>
        <div><span class="tt">${q.title}</span><span class="who">— ${q.who}</span></div>
        <div class="ds">${q.desc}</div>
        <div class="ft"><span class="rw">은화 ${q.reward}</span><span class="bg${got ? ' got' : ''}">칭호 「${q.badge}」</span>
          ${on ? `<button type="button" class="ab" data-ab="${id}">포기</button>` : `<button type="button" data-ac="${id}"${active ? ' title="진행 중인 의뢰는 포기된다"' : ''}>${active ? '이걸로 바꾸기' : '수락'}</button>`}</div></div>`;
    }).join('');
    const allBadges = [...ALL_IDS.map(id => DEFS[id].badge), ...MILESTONES.map(m => m[1])];
    const badges = allBadges.map(b => save.badges.includes(b) ? `<span class="got">${b}</span>` : '<span>? ? ?</span>').join('');
    panel.innerHTML = `<div class="hd"><h2>📜 의뢰 게시판</h2><span class="coin"><i aria-hidden="true"></i>은화 <b>${coins()}</b>닢</span>
        <button type="button" class="x" aria-label="닫기">✕</button></div>
      <div class="bd">${cards}
        <h3>칭호 ${save.badges.length}/${allBadges.length} · 완료 ${save.total || 0}회</h3><div class="qs-badges">${badges}</div></div>
      <div class="fo">F · Esc 닫기</div>`;
  }
  panel.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('x')) { closeBoard(); return; }
    if (b.dataset.ac) { accept(b.dataset.ac); closeBoard(); return; }
    if (b.dataset.ab) { end(false); return; }
  });
  dim.addEventListener('pointerdown', e => { e.preventDefault(); closeBoard(); });
  promptEl.addEventListener('click', e => { e.preventDefault(); openBoard(); });

  function openBoard() {
    if (panelOpen || disposed) return false;
    panelOpen = true; refill();
    panel.hidden = false; dim.hidden = false; promptEl.hidden = true;
    renderPanel();
    if (onOpen) safe(onOpen);
    return true;
  }
  function closeBoard() {
    if (!panelOpen) return false;
    panelOpen = false; panel.hidden = true; dim.hidden = true;
    if (onClose) safe(onClose);
    return true;
  }
  function onKeyDown(e) {
    if (!panelOpen) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'Escape' || e.code === 'KeyF') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) closeBoard(); return; }
    if (e.code === 'Tab' || e.code === 'Enter' || e.code === 'Space') return;   // 버튼 키보드 조작은 그대로
    e.stopPropagation();   // 창이 열린 동안 걷기·무기 키를 먹는다
  }
  addEventListener('keydown', onKeyDown, true);

  /* ── 추적 창 ── */
  let trackKey = '', topCheckT = 0;
  function renderTrack(force) {
    if (!active) { if (!track.hidden) track.hidden = true; trackKey = ''; return; }
    const h = safe(() => Q[active.id].hud(active.d)) || { ob: '' };
    const key = active.id + '|' + h.ob + '|' + (h.cls || '');
    if (force || key !== trackKey) {
      trackKey = key;
      tIc.textContent = active.def.icon; tTt.textContent = active.def.title;
      tOb.textContent = h.ob; tOb.className = 'ob' + (h.cls === 'hot' || h.cls === 'cold' ? ' ' + h.cls : '');
    }
    tBr.hidden = h.prog == null;
    if (h.prog != null) { tBrI.style.width = (clamp01(h.prog) * 100).toFixed(1) + '%'; tBr.classList.toggle('sp', h.cls === 'sp'); }
    if (track.hidden) track.hidden = false;
  }

  /* ── 충돌 (선택) ── */
  function pushOut(pos, r = 0.35) {
    const lx = (pos.x - BOARD.x) * Math.cos(BROT) - (pos.z - BOARD.z) * Math.sin(BROT);
    const lz = (pos.x - BOARD.x) * Math.sin(BROT) + (pos.z - BOARD.z) * Math.cos(BROT);
    const hx = 1.25 + r, hz = 0.12 + r;
    if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) return false;
    const nz = (lz >= 0 ? hz : -hz);
    const wx = BOARD.x + lx * Math.cos(BROT) + nz * Math.sin(BROT);
    const wz = BOARD.z - lx * Math.sin(BROT) + nz * Math.cos(BROT);
    pos.x = wx; pos.z = wz; return true;
  }

  /* ── F 처리 ── */
  function nearBoard() {
    if (disposed || panelOpen) return false;
    if (!isOnFoot() || safe(isBlocked)) return false;
    const p = getPlayerPos(); if (!p) return false;
    return Math.hypot(p.x - BOARD.x, p.z - BOARD.z) < BOARD_R;
  }
  function onF() {
    if (panelOpen) { closeBoard(); return true; }
    if (nearBoard()) { openBoard(); return true; }
    return false;
  }

  /* ── 사건 알림 ── */
  function notify(kind, data) {
    if (kind === 'ride') rideNotified = data || null;
    if (!active) return;
    const { id, d } = active;
    if (kind === 'talk' && id === 'talk') countTalk(d, data || {});
    else if (kind === 'project' && id === 'project') {
      const key = data == null ? 'p' + d.ids.size : String(data);
      if (!d.ids.has(key)) {
        d.ids.add(key);
        let bi = -1, bd = 1e9; stalls().forEach((s, i) => { const dd = Math.hypot(s.x - P.x, s.z - P.z); if (dd < bd) { bd = dd; bi = i; } });
        if (bi >= 0) d.st.add(bi);
        if (d.ids.size < d.need) toast(`📜 프로젝트 ${d.ids.size}/${d.need}`, 1.4);
      }
    } else if (kind === 'chicken' && id === 'chicken' && !getVillage()) d.n++;
    else if (kind === 'fish' && id === 'fish' && !getFishing()) d.n++;
    else if (kind === 'thief' && id === 'thief' && !getVillage()) d.forceDone = true;
  }

  /* ── 매 프레임 ── */
  const lastDir = new V(0, 0, 1);
  function project(x, y, z, elm) {
    _v.set(x, y, z).project(camera);
    if (_v.z > 1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) { elm.hidden = true; return; }
    elm.style.left = ((_v.x + 1) / 2 * innerWidth).toFixed(1) + 'px';
    elm.style.top = ((1 - _v.y) / 2 * innerHeight).toFixed(1) + 'px';
    elm.hidden = false;
  }
  function update(dt, t = performance.now() / 1000) {
    if (disposed) return;
    dt = Math.min(dt || 0, 0.1);
    const p = getPlayerPos(); if (!p || !Number.isFinite(p.x)) return;
    P.set(p.x, 0, p.z);
    if (lastP) {
      const dx = P.x - lastP.x, dz = P.z - lastP.z, s = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
      if (s < 60) pSpeed += (s - pSpeed) * Math.min(1, dt * 8);
      if (s > 0.3 && s < 60) { lastDir.set(dx, 0, dz).normalize(); }
    } else lastP = new V();
    lastP.copy(P);

    /* 게시판 표시 */
    bang.position.y = 3.35 + Math.sin(t * 2.2) * 0.12;
    bang.visible = !active || active.id === 'crown' && active.d.phase === 'return';
    near = nearBoard();
    if (near) project(BOARD.x, BOARD.y + 2.95, BOARD.z, promptEl); else if (!promptEl.hidden) promptEl.hidden = true;

    /* 아기 양 퇴장 */
    if (lamb && lamb.fade > 0) {
      lamb.fade -= dt; const h = flockCenter(); stepLamb(dt, h.x, h.z, 1.5);
      if (lamb.fade < 0.6) lamb.g.scale.setScalar(Math.max(0.01, lamb.fade / 0.6));
      if (lamb.fade <= 0) lamb.g.visible = false;
    }

    /* 진행 중 의뢰 */
    if (active) {
      active.t += dt;
      const q = Q[active.id];
      let r;
      try { r = q.tick(active.d, dt, t); } catch (err) { console.warn('[quests]', active.id, err); r = undefined; }
      if (active && active.d.forceDone) r = 'done';
      if (r === 'done') end(true);
      else if (typeof r === 'string') { toast(r + ' — 의뢰를 다시 받아 주세요'); end(false, true); }
    }
    if (active) {
      const tg = safe(() => Q[active.id].target(active.d));
      if (tg && Number.isFinite(tg.x)) {
        marker.visible = true;
        marker.position.set(tg.x, groundY(tg.x, tg.z) + (tg.h || 2.6) + Math.sin(t * 3) * 0.18, tg.z);
        marker.rotation.y = t * 1.6;
        const dx = tg.x - P.x, dz = tg.z - P.z, dist = Math.hypot(dx, dz);
        camera.getWorldDirection(_v); const fl = Math.hypot(_v.x, _v.z) || 1, fx = _v.x / fl, fz = _v.z / fl;
        const ang = Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz);
        tArB.style.transform = `rotate(${ang.toFixed(3)}rad)`;
        tDs.textContent = dist < 1000 ? dist.toFixed(0) + ' m' : '';
        tAr.style.visibility = 'visible';
      } else { marker.visible = false; tAr.style.visibility = 'hidden'; }
    }
    renderTrack(false);

    /* 추적 창 자리: 위쪽 바 아래 (바가 줄바꿈되면 같이 내려간다) */
    topCheckT -= dt;
    if (topCheckT <= 0 && !track.hidden) {
      topCheckT = 1;
      const top = document.getElementById('g-top');
      let y = 76;
      if (top) { let b = 0; for (const c of top.children) { const r = c.getBoundingClientRect(); if (r.height && r.left < 300) b = Math.max(b, r.bottom); } if (b) y = Math.round(b + 10); }
      track.style.top = y + 'px';
    }

    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('on'); }
    if (bigT > 0) { bigT -= dt; if (bigT <= 0) big.hidden = true; }
  }

  function state() {
    return {
      coins: coins(), total: save.total || 0, offers: save.offers.slice(), badges: save.badges.slice(), done: { ...save.done },
      active: active ? { id: active.id, title: active.def.title, t: +active.t.toFixed(1), hud: safe(() => Q[active.id].hud(active.d)) } : null,
      open: panelOpen, board: { x: +BOARD.x.toFixed(2), z: +BOARD.z.toFixed(2) },
    };
  }

  function dispose() {
    disposed = true; closeBoard();
    removeEventListener('keydown', onKeyDown, true);
    if (active) safe(() => Q[active.id].end && Q[active.id].end(active.d, false));
    for (const o of [boardG, marker, lamb && lamb.g, crown, mug]) if (o) scene.remove(o);
    for (const o of owned) safe(() => o.dispose());
    for (const e of [promptEl, dim, panel, track, toastEl, big]) e.remove();
    if (actx) safe(() => actx.close());
    if (globalThis.__quests === api) delete globalThis.__quests;
  }

  const api = {
    update, nearBoard, onF, notify, state, dispose, openBoard, closeBoard, pushOut,
    get open() { return panelOpen; },
    get coins() { return coins(); },
    get active() { return active ? active.id : null; },
    board: BOARD, ids: ALL_IDS,
    target: () => (active ? safe(() => Q[active.id].target(active.d)) : null),   // 미니맵 퀘스트 별
  };
  if (debug) {
    globalThis.__quests = Object.assign(api, {
      start: id => accept(id),
      finish: () => { if (active) { end(true); return true; } return false; },
      abandon: () => end(false),
      target: () => (active ? safe(() => Q[active.id].target(active.d)) : null),
      data: () => (active ? active.d : null),
      reset: () => { save = { coins: 0, done: {}, badges: [], offers: [], total: 0 }; refill(); renderPanel(); },
    });
  }
  return api;
}
