/* ════════════════════════════════════════════════════════════
   dialogue.js — 마을 사람과 대화하기 (동물의 숲 풍 말풍선)
   ────────────────────────────────────────────────────────────
   여기는 "상호랜드". 임금님 최상호를 모시는 중세 마을이다. 마을 사람들은 따뜻하게 인사하고
   임금님 자랑을 한다(길을 닦고, 선술집을 짓고, AI 마법을 부리고, 세금 없는 맥주의 날까지).

   걸어 다닐 때 대화할 수 있는 마을 사람이 2.2 m 안, 대략 앞쪽에 있으면 머리 위에 "F 대화하기"가 뜬다
   (터치 화면은 그 표시를 누른다). F → 대화 시작:
     - 카메라가 두 사람 옆 비스듬한 곳으로 부드럽게 옮겨 간다(두 얼굴이 다 보이게).
     - 마을 사람은 그 자리에 멈춰 플레이어를 본다(앉아 있는 손님은 앉은 채로, 술집 주인은 카운터에서).
     - 아래쪽에 크림색 말풍선 + 이름표, 글자가 한 자씩 나오고(작은 '뽁뽁' 소리), 다 나오면 ▼ 가 깜빡인다.
     - F / Space / Enter / 클릭 → 다음(글자가 나오는 중이면 먼저 끝까지 보여 준다). 마지막 줄에서 누르면 닫힌다.
     - 가끔 대답 고르기 두 개(←/→ 또는 1/2 로 고르고 F·Space·Enter, 또는 클릭).
     - Esc → 바로 닫기. 같은 사람은 같은 이야기를 두 번 연속 하지 않는다.
   대화 중에는 키 입력을 이 모듈이 먼저(캡처 단계) 받아 삼키므로 F 가 탈것 타기로 새지 않는다.
   화면 전체에 투명한 막을 깔아 캔버스 클릭(주먹·잡기·무기)도 막는다.

   npcs.js 는 고치지 않는다. 대신 이 모듈의 update 를 npcs.update 다음에 불러서,
   대화 상대의 상태를 PAUSE(가만히 서서 Idle)로 되돌리고 위치·방향을 매 프레임 덮어쓴다.
   대화 상대가 맞거나 잡히거나 도망가면(HELD/FLYING/LYING/FLEE …) 대화는 바로 끝난다.

   ── portfolio.js 연결 방법 (PM용) ──────────────────────────────
   ① tavern 블록(createTavern) 바로 아래:
        const { createDialogue } = await import('./dialogue.js');
        const dialogue = createDialogue({
          THREE, camera, person,
          getNpcs: () => npcs,                                  // createNPCs 가 돌려준 객체 (아직 null 이어도 된다)
          isOnFoot: () => player.mode === 'onfoot' && !tavern.seated,
          isBlocked: () => !driveActive || panelOpen(),
          onStart() { for (const k in keys) keys[k] = false; pSpeed = 0; if (weapons) weapons.holster(); },
          faceTo(h) { pHeading = h; pSpeed = 0; },             // 대화 중 플레이어가 상대를 보게 (매 프레임 불린다)
          onEnd() { camYaw = pHeading; },                        // 끝나면 카메라가 플레이어 뒤로 돌아간다
        });
      (F 키는 이 모듈이 캡처 단계에서 직접 처리한다 — 후보가 있으면 대화를 시작하고 키를 삼키므로
       기존 KeyF(탈것 타기) 줄은 그대로 둬도 된다. 직접 처리하고 싶으면 keydown 맨 앞에
         if (e.code === 'KeyF' && player.mode === 'onfoot' && dialogue.nearest()) { e.preventDefault(); dialogue.tryTalk(); return; }
       를 넣어도 같다.)

   ② step(dt) 의 걷기 줄 — 대화 중에는 움직이지 않게(걷기는 계속 불러야 Idle 동작·방향이 갱신된다):
        if (dialogue.active) keys.fwd = keys.back = keys.left = keys.right = keys.boost = false;
        if (player.mode === 'driving') drive(dt);
        else if (!tavern.seated) walk(dt);

   ③ step(dt) 의 카메라 줄을 이렇게 바꾼다 (대화 카메라 → 선술집 카메라 → 기본 카메라 순):
        tavern.cameraStep(camera, dt, d => dialogue.cameraStep(camera, d, updateCamera));

   ④ step(dt) 의 if (npcs) npcs.update(dt, t); 바로 다음 줄:
        dialogue.update(dt);                                     // 반드시 npcs.update 뒤 (상대를 멈춰 세운다)

   ⑤ 대화 중 걷기·무기·주먹·잡기·앉기를 막는다 — 각 모듈 isBlocked 에 || dialogue.active 를 더한다:
        attachGrab(... isBlocked: () => !driveActive || panel.classList.contains('open') || (dialogue && dialogue.active) ...)
        createWeapons(... isBlocked: () => !driveActive || panelOpen() || dialogue.active ...)
        createTavern(... isBlocked: () => !driveActive || panelOpen() || dialogue.active ...)
      (dialogue 가 tavern 보다 뒤에 만들어지면 화살표 함수 안에서만 읽으므로 TDZ 걱정 없다.
       weapons/attachGrab 이 먼저 만들어지면 let dialogue = null; 로 앞에 선언하고 null 검사.)

   ⑥ (선택) 안내 문구 updateHint() 에: <span class="key">F</span> 대화

   반환: { update(dt), cameraStep(cam, dt, fallback) → bool, nearest() → npc|null, tryTalk(npc?) → bool,
           close(), active(getter), talking(getter: 지금 대화 상대 npc), dispose() }
   옵션: isMuted: () => bool (뽁뽁 소리 끄기), getPlayerPos: () => {x,y,z} (기본 person.position)
   ════════════════════════════════════════════════════════════ */

/* npcs.js 의 ST 와 같은 값 (PAUSE 로 되돌려 가만히 세운다) — npcs.js ST 표가 바뀌면 여기도 */
const ST_PAUSE = 1;

const TALK_R = 2.2;           // 이 안이면 "F 대화하기"
const KEEP_R = 2.6;           // 이미 잡힌 후보는 여기까지 유지 (깜빡임 방지)
const CPS = 30;               // 글자/초
const CAM_BLEND = 0.7;        // 대화가 끝나고 원래 카메라로 돌아가는 시간

/* 대화할 수 있는 상태 (npcs.list() 의 state 이름) */
const OK_STATES = new Set(['WANDER', 'PAUSE', 'SEATED', 'BAR', 'SERVE', 'WATCH', 'CHAT']);
/* 대화 중 이 상태가 되면 대화를 끝낸다 */
const ABORT_STATES = new Set(['HELD', 'FLYING', 'LYING', 'GETUP', 'STOMP', 'ROLL', 'CHASE', 'STAGGER', 'FLEE',
  'FIGHT', 'GUARD', 'GUARD_LEAVE', 'BARD_GO', 'BARD_PLAY', 'OFF', 'SIT_DOWN', 'STAND_UP']);

/* ── 직업별 이름·이름표 색 (models/npc/npc-*.glb) — 같은 모델 복제는 idx 로 다른 이름 ── */
const PROF = {
  'npc-blacksmith': { job: '대장장이', names: ['한스', '볼프', '군나르'], color: '#b4532a', pool: 'blacksmith' },
  'npc-baker':      { job: '빵집', names: ['마르타', '로자', '엘제'], color: '#d08a2e', pool: 'baker' },
  'npc-innkeeper':  { job: '여관 주인', names: ['오토', '브루노', '베른트'], color: '#8a5a2b', pool: 'innkeeper' },
  'npc-guard':      { job: '경비병', names: ['군터', '라이너', '디트리히'], color: '#3d5a80', pool: 'guard' },
  'npc-herbalist':  { job: '약초꾼', names: ['헤이즐', '리나', '마고'], color: '#4f8a3c', pool: 'herbalist' },
  'npc-maid':       { job: '하녀', names: ['클라라', '안나', '그레타'], color: '#c0607a', pool: 'maid' },
  'npc-noble':      { job: '귀부인', names: ['이자벨라', '비올레타', '엘레오노라'], color: '#7b4fa0', pool: 'noble' },
  'npc-bard':       { job: '음유시인', names: ['피핀', '줄리오', '로렌초'], color: '#2f8f8a', pool: 'bard' },
  'npc-monk':       { job: '수도사', names: ['안셀름', '베네딕트', '토마스'], color: '#6b6250', pool: 'monk' },
  'npc-traveler':   { job: '나그네', names: ['루카스', '페르난도', '마테오'], color: '#5a7d4a', pool: 'traveler' },
};
const PROF_DEFAULT = { job: '마을 사람', names: ['한나', '요한', '프리다'], color: '#8a6a4a', pool: null };

/* ── 대사 ──
   한 대화 = 줄 배열. 줄은 문자열이거나 { t, choices: [a, b], replies: [ra, rb] } (고르면 답 한 줄 뒤 끝) */
const POOLS = {
  generic: [
    ['안녕하세요, 나그네님! 상호랜드에 오신 걸 환영해요.',
     '이 길 보이시죠? 임금님 최상호께서 손수 닦으신 길이랍니다.',
     '덕분에 수레가 하나도 안 덜컹거려요. 임금님 만세!'],
    ['들었어요? 임금님이 말하는 마법 상자를 만드셨대요!',
     '물어보면 뭐든 척척 대답한대요. AI라나 뭐라나…',
     '저는 오늘 저녁 메뉴를 물어볼 거예요. 헤헤.'],
    ['오늘 날씨 참 좋죠?',
     '임금님이 날씨까지 정하신다는 소문이 있어요.',
     '…물론 소문이지만요. 헤헤.'],
    ['어라? 어디서 많이 뵌 얼굴인데…',
     { t: '혹시 임금님 닮았다는 말 자주 들으세요?',
       choices: ['사실 내가 임금이오', '그런 말 자주 들어요'],
       replies: ['에이~ 임금님은 지금쯤 성에서 AI 마법을 부리고 계실걸요!', '역시! 멋진 분들은 다 닮았나 봐요.'] }],
    ['길 따라 쭉 가면 선술집이 줄줄이 있어요.',
     '전부 임금님이 지으셨대요. 지붕 모양이 다 달라요!',
     '급하면 Shift를 눌러 보세요. 휘익~ 빨라진답니다.'],
  ],
  blacksmith: [
    ['어서 오시오! 망치 소리가 좀 시끄럽지?',
     '임금님께서 "좋은 도구가 좋은 작품을 만든다" 하셨거든.',
     '그래서 오늘도 쾅! 쾅! 열심히 두드리는 중이라오.'],
    ['이 칼날 좀 보시오. 반짝반짝하지?',
     '임금님 코드처럼 군더더기 없이 벼렸다오.',
     { t: '하나 장만하겠소?', choices: ['임금님 만세!', '구경만 할게요'],
       replies: ['하하! 그 말 한마디면 오늘 장사는 충분하오.', '그러시오. 구경은 공짜라오!'] }],
  ],
  baker: [
    ['갓 구운 빵 냄새 나죠?',
     '임금님이 제일 좋아하시는 건 소보로빵이래요.',
     '비밀인데… 저는 매일 하나씩 성에 몰래 보내요. 쉿!'],
    ['새벽부터 반죽했더니 팔이 뻐근해요.',
     '그래도 임금님이 길을 닦아 주셔서 배달이 금방이에요.',
     '빵이 식기 전에 도착한다니까요!'],
  ],
  innkeeper: [
    ['어서 오세요! 한 잔 하실래요?',
     '오늘은 임금님이 정하신 "세금 없는 맥주의 날"이에요!',
     '의자 가까이 가서 E를 누르면 바로 내어 드릴게요.'],
    ['우리 집 맥주는 상호랜드 최고예요.',
     '임금님도 몰래 오셔서 한 잔 하고 가신다는 소문이…',
     { t: '혹시 보신 적 있어요?', choices: ['임금님 만세!', '글쎄요?'],
       replies: ['하하, 건배! 임금님을 위하여!', '저도 아직 못 봤어요. 변장을 잘하시나 봐요.'] }],
  ],
  guard: [
    ['멈추시오! …아, 그냥 지나가는 분이군.',
     '나는 임금님의 충직한 경비병이오.',
     '길에서 너무 빨리 달리면 안 되오. Shift 가속은… 적당히!'],
    ['요즘 마을이 참 평화롭소.',
     '임금님이 길도 넓히고 가로등도 놓으셨으니까.',
     '덕분에 나는 하품만… 아, 못 들은 걸로 하시오.'],
  ],
  herbalist: [
    ['이 약초는 머리를 맑게 해 줘요.',
     '임금님이 밤새 AI를 만드신다길래 한 봉지 챙겨 드렸죠.',
     '그 덕에 마을에 신기한 게 잔뜩 생겼잖아요!'],
    ['숲에서 반딧불이 보셨어요?',
     '임금님이 밤길 무섭지 말라고 풀어 주셨대요.',
     '…저는 그렇게 믿기로 했어요.'],
  ],
  maid: [
    ['어머, 안녕하세요!',
     '성을 청소하다 보면 임금님 책상 위에 쪽지가 가득해요.',
     '"버그 고치기", "더 멋지게"… 정말 부지런하시죠?'],
    ['임금님은 차를 아주 좋아하세요.',
     '근데 생각에 빠지시면 다 식을 때까지 안 드세요.',
     '그래서 저는 하루에 세 번 데워 드린답니다.'],
  ],
  noble: [
    ['어머, 귀한 손님이시네요.',
     '길가 게시판들 보셨어요? 임금님이 만드신 작품들이 걸려 있답니다.',
     '가까이 가서 Space를 눌러 보세요. 깜짝 놀라실 거예요.'],
    ['왕궁 무도회에 가 봤는데요,',
     '임금님 춤 솜씨는… 음, 코딩 솜씨가 훨씬 낫더라고요.',
     '어머, 이건 비밀이에요! 호호.'],
  ],
  bard: [
    ['♪ 상호랜드의 임금님은~ 길도 닦고 술집도 짓네~ ♪',
     { t: '어때요, 제 신곡이에요!', choices: ['임금님 만세!', '음… 그렇군요'],
       replies: ['역시 귀가 밝으시군요! 2절도 기대해 주세요.', '흑, 아직 연습 중이라고요…'] }],
    ['노래 소재가 떨어질 틈이 없어요.',
     '임금님이 날마다 새로운 걸 만드시거든요.',
     '오늘은 "말하는 마법 상자의 노래"를 쓰는 중이랍니다.'],
  ],
  monk: [
    ['평안하시길.',
     '임금님께선 "꾸준함이 최고의 마법"이라 하셨지요.',
     '그래서 저도 날마다 한 줄씩 정성껏 경전을 옮겨 적습니다.'],
  ],
  traveler: [
    ['저는 먼 나라에서 왔어요.',
     '상호랜드 소문 듣고 왔는데, 정말 길이 넓고 사람들이 친절하네요!',
     '임금님을 꼭 한 번 뵙고 싶어요. 어디 계신지 아세요?'],
  ],
};

let styleDone = false;
function injectStyle() {
  if (styleDone) return; styleDone = true;
  const css = `
#dl-prompt{position:fixed;left:0;top:0;z-index:42;transform:translate(-50%,-100%);display:flex;align-items:center;gap:9px;
  padding:9px 15px 9px 9px;border-radius:999px;background:rgba(20,14,30,.82);color:#fff;
  border:1px solid color-mix(in srgb,var(--c,#e8734a) 70%,transparent);box-shadow:0 8px 24px rgba(0,0,0,.35);
  font:600 13.5px/1 var(--sans,system-ui);cursor:pointer;white-space:nowrap;user-select:none;-webkit-user-select:none}
#dl-prompt[hidden]{display:none}
#dl-prompt .k{font-family:var(--mono,ui-monospace,monospace);font-size:11.5px;font-weight:700;color:#0f2e42;background:#fff;
  border-radius:7px;padding:6px 10px;border-bottom:3px solid #c9ced3}
#dl-prompt .nm{opacity:.75;font-weight:500}
body.is-touch #dl-prompt .k{display:none}
#dl-catch{position:fixed;inset:0;z-index:52;background:transparent;touch-action:none}
#dl-catch[hidden],#dl-box[hidden]{display:none}
#dl-box{position:fixed;left:50%;bottom:calc(26px + env(safe-area-inset-bottom,0px));z-index:53;
  width:min(640px,calc(100% - 32px));transform:translateX(-50%);font-family:var(--sans,system-ui);
  animation:dl-pop .28s cubic-bezier(.2,1.4,.4,1)}
#dl-box .ball{position:relative;background:#fff8e6;color:#4a3524;border-radius:34px;padding:30px 30px 26px;min-height:118px;
  box-shadow:0 10px 30px rgba(40,24,10,.32),inset 0 -5px 0 rgba(180,140,90,.16);border:3px solid #f0dfbf;cursor:pointer}
#dl-box .tag{position:absolute;left:26px;top:-17px;padding:7px 18px 8px;border-radius:999px;background:var(--c,#8a6a4a);color:#fff;
  font-weight:800;font-size:15px;letter-spacing:-.01em;transform:rotate(-3deg);box-shadow:0 4px 0 rgba(0,0,0,.14)}
#dl-box .tag small{font-weight:600;opacity:.85;font-size:12px;margin-right:6px}
#dl-box .txt{font-size:17.5px;font-weight:600;line-height:1.65;letter-spacing:-.01em;min-height:2.2em;word-break:keep-all;overflow-wrap:anywhere}
#dl-box .more{position:absolute;right:28px;bottom:12px;color:var(--c,#8a6a4a);font-size:15px;animation:dl-bob .9s ease-in-out infinite}
#dl-box .more[hidden]{display:none}
#dl-box .ch{display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}
#dl-box .ch[hidden]{display:none}
#dl-box .ch button{font:700 15px/1 var(--sans,system-ui);padding:11px 18px;border-radius:999px;border:3px solid #f0dfbf;
  background:#fffdf6;color:#4a3524;box-shadow:0 3px 0 rgba(180,140,90,.3);transition:transform .12s}
#dl-box .ch button.on{border-color:var(--c,#8a6a4a);background:var(--c,#8a6a4a);color:#fff;transform:translateY(-2px)}
#dl-box .ch button.on::before{content:'▶ ';font-size:11px}
@keyframes dl-pop{from{opacity:0;transform:translateX(-50%) translateY(16px) scale(.96)}to{opacity:1;transform:translateX(-50%)}}
@keyframes dl-bob{0%,100%{transform:translateY(0);opacity:1}50%{transform:translateY(4px);opacity:.45}}
@media (max-width:520px){#dl-box .ball{padding:26px 20px 22px;border-radius:26px;min-height:104px}#dl-box .txt{font-size:16px}
  #dl-box .tag{left:18px;font-size:14px}}
@media (prefers-reduced-motion:reduce){#dl-box,#dl-box .more{animation:none}}`;
  const s = document.createElement('style');
  s.id = 'dl-style'; s.textContent = css;
  document.head.appendChild(s);
}

export function createDialogue({
  THREE, camera, person,
  getNpcs = () => null,
  getPlayerPos = null,
  isOnFoot = () => true,
  isBlocked = () => false,
  isMuted = () => false,
  onStart = null, onEnd = null, faceTo = null,
}) {
  injectStyle();
  const V = THREE.Vector3;
  const _v = new V(), _look = new V(), _fbPos = new V(), _fbLook = new V(), _dir = new V();

  /* ── DOM ── */
  const prompt = document.createElement('div');
  prompt.id = 'dl-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<span class="k">F</span><span class="lb">대화하기</span><span class="nm"></span>';
  const pNm = prompt.querySelector('.nm');
  const catcher = document.createElement('div');
  catcher.id = 'dl-catch'; catcher.hidden = true;
  const box = document.createElement('div');
  box.id = 'dl-box'; box.hidden = true;
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-live', 'polite');
  box.innerHTML = '<div class="ball"><div class="tag"><small></small><span></span></div><div class="txt"></div>' +
    '<div class="ch" hidden><button type="button"></button><button type="button"></button></div><div class="more" hidden>▼</div></div>';
  const tagJob = box.querySelector('.tag small'), tagName = box.querySelector('.tag span');
  const txtEl = box.querySelector('.txt'), moreEl = box.querySelector('.more'), chEl = box.querySelector('.ch');
  const chBtns = [...chEl.querySelectorAll('button')];
  document.body.append(prompt, catcher, box);

  /* ── 상태 ── */
  const S = {
    cand: null, candInfo: null,      // 후보 npc, 그 list() 항목
    npc: null, info: null, kind: '', // 대화 상대, 'walk' | 'seated' | 'bar'
    hx: 0, hz: 0,                    // 상대를 붙잡아 둘 자리
    lines: null, li: 0, line: null, shown: 0, typing: false, acc: 0, blipN: 0,
    choosing: false, sel: 0, pendingReply: null,
    prof: PROF_DEFAULT, name: '',
    camPos: new V(), camLook: new V(), tPos: new V(), tLook: new V(), camInit: false,
    blendT: 0,                        // 끝난 뒤 되돌아가는 남은 시간
    pHead: 0,
  };
  const lastConvo = new WeakMap();    // npc → 마지막 대화 (연속 반복 방지)

  const playerPos = () => (getPlayerPos ? getPlayerPos() : person.position);
  const profOf = n => PROF[n && n.model] || PROF_DEFAULT;
  const nameOf = (n, p) => p.names[((n && n.idx) || 0) % p.names.length];

  /* ── 후보 고르기 ── */
  function listNpcs() {
    const api = getNpcs();
    return api && typeof api.list === 'function' ? api.list() : null;
  }
  function eligible(o) {
    return o && o.npc && !o.off && !o.guard && OK_STATES.has(o.state) && !o.angry;
  }
  function findCandidate() {
    if (S.npc || !isOnFoot() || isBlocked() || !person.visible) return null;
    const L = listNpcs(); if (!L) return null;
    const p = playerPos();
    const fx = Math.sin(person.rotation.y), fz = Math.cos(person.rotation.y);
    let best = null, bestScore = Infinity, bestInfo = null;
    for (const o of L) {
      if (!eligible(o)) continue;
      const dx = o.pos.x - p.x, dz = o.pos.z - p.z, d = Math.hypot(dx, dz);
      const keep = o.npc === S.cand;
      if (d > (keep ? KEEP_R : TALK_R)) continue;
      const dot = d > 1e-3 ? (dx * fx + dz * fz) / d : 1;
      if (dot < (keep ? 0.05 : 0.3) && d > 1.0) continue;       // 대략 앞쪽 (아주 가까우면 방향 무시)
      const score = d - dot * 0.6 - (keep ? 0.3 : 0);
      if (score < bestScore) { bestScore = score; best = o.npc; bestInfo = o; }
    }
    S.candInfo = bestInfo;
    return best;
  }

  /* ── 소리 (아주 작은 '뽁') ── */
  let ac = null;
  function blip(pitchBase) {
    if (isMuted()) return;
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(pitchBase * (0.85 + Math.random() * 0.35), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.045, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      o.connect(g).connect(ac.destination);
      o.start(t); o.stop(t + 0.07);
    } catch (e) { /* 소리는 없어도 된다 */ }
  }

  /* ── 대화 진행 ── */
  function pickConvo(n, prof) {
    const own = (prof.pool && POOLS[prof.pool]) || [];
    const all = own.concat(own, POOLS.generic);   // 직업 대사가 두 배로 잘 나온다
    const last = lastConvo.get(n);
    let c = all[Math.floor(Math.random() * all.length)];
    for (let k = 0; k < 6 && c === last && all.length > 1; k++) c = all[Math.floor(Math.random() * all.length)];
    lastConvo.set(n, c);
    return c;
  }
  function showLine(line) {
    S.line = typeof line === 'string' ? { t: line } : line;
    S.shown = 0; S.acc = 0; S.typing = true; S.blipN = 0;
    S.choosing = false;
    txtEl.textContent = '';
    moreEl.hidden = true; chEl.hidden = true;
  }
  function finishTyping() {
    S.typing = false; S.shown = S.line.t.length;
    txtEl.textContent = S.line.t;
    if (S.line.choices) {
      S.choosing = true; S.sel = 0;
      chBtns.forEach((b, i) => { b.textContent = S.line.choices[i] || ''; b.classList.toggle('on', i === 0); });
      chEl.hidden = false; moreEl.hidden = true;
    } else moreEl.hidden = false;
  }
  function choose(i) {
    if (!S.choosing) return;
    const r = S.line.replies && S.line.replies[i];
    S.choosing = false; chEl.hidden = true;
    if (r) { S.lines = [r]; S.li = 0; showLine(r); }
    else advance(true);
  }
  function advance(skipChoice = false) {
    if (!S.npc) return;
    if (S.typing) { finishTyping(); return; }
    if (S.choosing && !skipChoice) { choose(S.sel); return; }
    S.li++;
    if (S.li >= S.lines.length) { close(); return; }
    showLine(S.lines[S.li]);
  }

  function tryTalk(target) {
    const n = target || S.cand;
    if (!n || S.npc || isBlocked() || !isOnFoot()) return false;
    const L = listNpcs(); if (!L) return false;
    const info = L.find(o => o.npc === n);
    if (!eligible(info)) return false;
    S.npc = n; S.info = info;
    S.kind = info.seated ? 'seated' : info.barkeeper ? 'bar' : 'walk';
    S.hx = n.x; S.hz = n.z;
    S.prof = profOf(n); S.name = nameOf(n, S.prof);
    if (info.barkeeper) S.prof = Object.assign({}, S.prof, { job: '주점 주인', pool: 'innkeeper' });
    box.style.setProperty('--c', S.prof.color);
    tagJob.textContent = S.prof.job; tagName.textContent = S.name;
    S.lines = pickConvo(n, S.prof); S.li = 0;
    const p = playerPos();
    S.pHead = Math.atan2(n.x - p.x, n.z - p.z);
    S.camInit = false; S.blendT = 0;
    setFrame();
    prompt.hidden = true; S.cand = null;
    catcher.hidden = false; box.hidden = false;
    showLine(S.lines[0]);
    if (onStart) onStart(n);
    return true;
  }

  function close() {
    if (!S.npc) return;
    const n = S.npc;
    if (S.kind === 'walk' && n.state === ST_PAUSE) n.timer = 0.4 + Math.random() * 0.6;   // 잠깐 있다가 다시 걷는다
    S.npc = null; S.info = null; S.choosing = false; S.typing = false;
    box.hidden = true; catcher.hidden = true;
    S.blendT = CAM_BLEND;
    if (onEnd) onEnd(n);
  }

  /* 대화 카메라 자리: 두 사람 옆, 플레이어 쪽으로 조금 물러난 비스듬한 곳 */
  function setFrame() {
    const n = S.npc, p = playerPos();
    let dx = n.x - p.x, dz = n.z - p.z;
    const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const mx = (n.x + p.x) / 2, mz = (n.z + p.z) / 2;
    let px = dz, pz = -dx;                                   // 옆 방향
    if ((camera.position.x - mx) * px + (camera.position.z - mz) * pz < 0) { px = -px; pz = -pz; }   // 지금 카메라가 있는 쪽
    const side = 2.3 + d * 0.35;
    S.tPos.set(mx + px * side - dx * 1.6, p.y + 1.7, mz + pz * side - dz * 1.6);
    const ny = S.kind === 'seated' ? 1.1 : 1.45;
    S.tLook.set(mx + dx * 0.25, p.y + (ny + 1.45) / 2 - 0.05, mz + dz * 0.25);
  }

  /* ── 매 프레임 (npcs.update 다음) ── */
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function update(dt) {
    if (!(dt > 0)) dt = 0;
    if (S.npc) {
      const n = S.npc;
      const L = listNpcs();
      const info = L && L.find(o => o.npc === n);
      if (!info || info.off || ABORT_STATES.has(info.state) || !isOnFoot() || isBlocked()) { close(); return; }
      const p = playerPos();
      const want = Math.atan2(p.x - n.x, p.z - n.z);
      if (S.kind === 'walk') {
        /* 가만히 세우고(PAUSE + Idle), 자리·방향을 덮어쓴다 */
        n.state = ST_PAUSE; n.timer = 5; n.yielding = false;
        n.x = S.hx; n.z = S.hz;
        n.rot = wrap(n.rot + wrap(want - n.rot) * Math.min(1, dt * 6));
        n.root.position.set(n.x, n.y, n.z);
        n.root.rotation.y = n.rot;
      } else if (S.kind === 'bar') {
        n.wiping = false;
        n.rot = wrap(n.rot + wrap(want - n.rot) * Math.min(1, dt * 6));
        n.root.rotation.y = n.rot;
      } else if (S.kind === 'seated') {
        if (n.seatedLeft != null && n.seatedLeft < 3) n.seatedLeft = 3;   // 대화 중엔 일어나지 않게
      }
      /* 플레이어도 상대를 본다 */
      S.pHead = Math.atan2(n.x - p.x, n.z - p.z);
      if (faceTo) faceTo(S.pHead);
      else person.rotation.y = S.pHead;

      /* 글자 하나씩 */
      if (S.typing) {
        S.acc += dt * CPS;
        const t = S.line.t;
        let changed = false;
        while (S.acc >= 1 && S.shown < t.length) {
          S.acc -= 1; S.shown++; changed = true;
          const ch = t[S.shown - 1];
          if (ch !== ' ' && ch !== '.' && ch !== '…' && (S.blipN++ % 2 === 0)) blip(n.gender === 'f' ? 620 : 380);
        }
        if (changed) txtEl.textContent = t.slice(0, S.shown);
        if (S.shown >= t.length) finishTyping();
      }
      return;
    }

    /* 후보 + "F 대화하기" */
    const c = findCandidate();
    S.cand = c;
    if (!c) { prompt.hidden = true; return; }
    const info = S.candInfo;
    const h = info.seated ? 2.0 : 2.45;
    _v.set(c.x, c.y + h, c.z).project(camera);
    if (_v.z > 1 || _v.z < -1) { prompt.hidden = true; return; }
    const pf = profOf(c);
    const nm = (info.barkeeper ? '주점 주인' : pf.job) + ' ' + nameOf(c, pf);
    if (pNm.textContent !== nm) pNm.textContent = nm;
    prompt.style.setProperty('--c', pf.color);
    prompt.style.left = ((_v.x * 0.5 + 0.5) * innerWidth).toFixed(1) + 'px';
    prompt.style.top = ((-_v.y * 0.5 + 0.5) * innerHeight).toFixed(1) + 'px';
    prompt.hidden = false;
  }

  /* ── 카메라 (tavern.cameraStep 과 같은 방식: 대화 중이 아니면 fallback) ── */
  function cameraStep(cam, dt, fallback) {
    if (S.npc) {
      if (!S.camInit) {
        S.camPos.copy(cam.position);
        cam.getWorldDirection(_dir); S.camLook.copy(cam.position).addScaledVector(_dir, 6);
        S.camInit = true;
      }
      const k = 1 - Math.exp(-dt * 3.5);
      S.camPos.lerp(S.tPos, k); S.camLook.lerp(S.tLook, k);
      cam.position.copy(S.camPos); cam.lookAt(S.camLook);
      return true;
    }
    if (S.blendT > 0 && S.camInit) {
      /* 원래 카메라가 갈 자리를 구해 놓고, 거기로 부드럽게 넘어간다 */
      if (fallback) fallback(dt);
      _fbPos.copy(cam.position);
      cam.getWorldDirection(_dir); _fbLook.copy(cam.position).addScaledVector(_dir, 6);
      S.blendT = Math.max(0, S.blendT - dt);
      const e = 1 - S.blendT / CAM_BLEND, s = e * e * (3 - 2 * e);
      _v.copy(S.camPos).lerp(_fbPos, s); _look.copy(S.camLook).lerp(_fbLook, s);
      cam.position.copy(_v); cam.lookAt(_look);
      if (S.blendT === 0) S.camInit = false;
      return true;
    }
    if (fallback) fallback(dt);
    return false;
  }

  /* ── 입력 (캡처 단계에서 먼저 받는다) ── */
  function onKey(e) {
    if (S.npc) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      const c = e.code;
      if (c === 'Escape') { close(); return; }
      if (S.choosing) {
        if (c === 'ArrowLeft' || c === 'KeyA' || c === 'Digit1') { S.sel = 0; if (c === 'Digit1') { choose(0); return; } }
        else if (c === 'ArrowRight' || c === 'KeyD' || c === 'Digit2') { S.sel = 1; if (c === 'Digit2') { choose(1); return; } }
        chBtns.forEach((b, i) => b.classList.toggle('on', i === S.sel));
      }
      if (c === 'KeyF' || c === 'Space' || c === 'Enter' || c === 'NumpadEnter') advance();
      return;
    }
    if (e.code === 'KeyF' && !e.repeat && S.cand && !prompt.hidden) {
      if (tryTalk()) { e.preventDefault(); e.stopImmediatePropagation(); }
    }
  }
  const onCatch = e => { e.preventDefault(); e.stopPropagation(); advance(); };
  const onBall = e => { e.stopPropagation(); if (!S.choosing) advance(); };
  const onPrompt = e => { e.preventDefault(); e.stopPropagation(); tryTalk(); };
  const chHandlers = chBtns.map((b, i) => {
    const h = e => { e.stopPropagation(); S.sel = i; choose(i); };
    b.addEventListener('click', h);
    return h;
  });
  addEventListener('keydown', onKey, true);
  catcher.addEventListener('pointerdown', onCatch);
  box.querySelector('.ball').addEventListener('click', onBall);
  prompt.addEventListener('pointerdown', onPrompt);

  function dispose() {
    close();
    removeEventListener('keydown', onKey, true);
    catcher.removeEventListener('pointerdown', onCatch);
    chBtns.forEach((b, i) => b.removeEventListener('click', chHandlers[i]));
    prompt.remove(); catcher.remove(); box.remove();
    if (ac) { try { ac.close(); } catch (e) { /* 무시 */ } ac = null; }
  }

  return {
    update, cameraStep, tryTalk, close, dispose,
    nearest: () => (S.npc ? null : S.cand),
    get active() { return !!S.npc; },
    get talking() { return S.npc; },
  };
}
