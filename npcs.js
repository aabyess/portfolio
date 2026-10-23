/* ════════════════════════════════════════════════════════════════════
   npcs.js — 중세 선술집 손님들 (숲길을 거닐다 포장마차 의자에 앉아 술을 마신다)

   ── portfolio.js 연결 방법 (이 세 군데만 손대면 된다) ──

   ① 모듈 상단 (const THREE = await import('three'); 근처, 또는 파일 맨 위 정적 import):
        import { createNPCs, stallsFromStations } from './npcs.js';
      (portfolio.js 가 동적 import 를 쓰므로 이렇게 해도 된다)
        const { createNPCs, stallsFromStations } = await import('./npcs.js');

   ② "선술집 앞 빨간 플라스틱 의자와 둥근 테이블" 블록이 끝난 직후
      (for (const st of stations) { ... place(stool, ...) } } 의 닫는 중괄호 바로 아래):

        // 중세 손님들 — 로딩을 막지 않게 await 하지 않는다
        let npcs = null;
        createNPCs({
          THREE, scene, GLTFLoader,
          dracoLoader: draco,                         // 월드 glb 에서 쓰던 DRACOLoader 재사용
          groundY, pathX,
          stalls: stallsFromStations(stations, { THREE, toyBlocks }),
          bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
          roadHalf: WORLD.path.half,
          bridge: WORLD.bridge,                       // 다리 구간에선 개울에 빠지지 않게 길 안쪽으로 걷는다
          getPlayerPos: () => activePos(),            // update 때만 부른다 (TDZ 걱정 없음)
          getNight: () => night,                      // 밤엔 더 오래, 더 자주 앉는다
        }).then(n => { npcs = n; }).catch(e => console.warn('[npcs]', e));

   ③ step(dt) 안, proximity(); 다음 줄쯤:
        if (npcs) npcs.update(dt, t);

   stallsFromStations 는 위 의자 블록과 똑같은 수치(테이블 지역좌표 (0, 4.6), 의자 반지름 1.75,
   45°+90°k, 그룹 배율 0.62)로 의자 월드 좌표를 다시 계산하고, toyBlocks 를 넘기면 같은 자리의
   의자 메시를 찾아 연결한다 → 차로 의자를 쓰러뜨리면 앉아 있던 손님이 일어나 떠나고,
   R 로 다시 세우면 그 자리에 또 앉는다. (의자 수치를 바꾸면 아래 STOOL_* 상수도 같이 바꿀 것)

   NPC 는 물리 바디가 없다(키네마틱). 차는 그냥 통과하지만, 손님이 플레이어 3 m 안에서는
   멈춰 길 바깥쪽으로 비켜선다.
   모델은 NPC_MODELS(남 6·여 4) 중 실제로 있는 파일만 불러와 1명씩 세운다 (count 로 더 늘릴 수 있음).
   늘 65% 이상이 길 양쪽을 따라 걷고(속도 1.1~1.5 m/s), 나머지가 포장마차에서 마신다.

   ── 잡아 던지기 미니게임 (attachGrab) ──
   왼쪽 마우스로 손님을 0.2초 이상 꾹 누르면 잡힌다(누른 채 손님 위로 끌어가도 잡힌다). 짧게 클릭하면 주먹(아래).
   터치는 손님을 0.35초 길게 누르면 잡힌다. 잡힌 손님은 버둥거리며 커서를 따라오고(플레이어 10 m 안,
   땅에서 약 2.3 m 높이), 버튼을 떼면 마지막 0.1초 동안 움직인 방향·속도로 날아간다 →
   튕기고 구르다 누워 1초 쉬고 → 일어나서(GetUp) 다시 걷는다. Struggle/GetUp 클립이 없으면 코드로 흉내 낸다.

   ④ 위 ②의 .then(n => { npcs = n; }) 을 아래처럼 바꾼다:
        }).then(n => {
          npcs = n;
          attachGrab(n, {
            THREE, camera, domElement: renderer.domElement,
            getPlayerPos: () => activePos(), groundY,
            isBlocked: () => !driveActive || panel.classList.contains('open'),
          });
        }).catch(e => console.warn('[npcs]', e));
      그리고 import 를 { createNPCs, stallsFromStations, attachGrab } 로 늘린다.
      (panel 은 아래쪽 "패널" 블록의 const 지만 isBlocked 는 포인터 이벤트 때만 불리므로 TDZ 걱정 없다.)
      잡기 갱신은 npcs.update 안에서 같이 돌기 때문에 ③ 외에 따로 부를 것은 없다.

   ── 차로 치면 넘어지고 화낸다 (getRide) ──
   ⑤ ②의 createNPCs({...}) 옵션에 getRide 를 더한다. 매 프레임 불리므로 같은 객체를 재사용한다:
        const rideInfo = { x: 0, z: 0, heading: 0, halfX: 1, halfZ: 2.1, speed: 0, driving: false };
        ...
          getRide: () => {
            rideInfo.x = car.position.x; rideInfo.z = car.position.z;
            rideInfo.heading = heading;              // 앞 방향 = (sin heading, cos heading)
            rideInfo.speed = speed;                  // 부호 있는 m/s (후진이면 음수)
            rideInfo.driving = player.mode === 'driving';
            rideInfo.halfX = <지금 탈것의 반폭>; rideInfo.halfZ = <지금 탈것의 반길이>;   // 차: 약 1.0 / 2.1
            return rideInfo;
          },
      |speed| > 2 m/s 로 차 테두리(+0.35 m)에 닿으면 넘어진다(앉아 마시던 손님 포함, 의자 예약 해제).
      Fall 클립이 있으면 그걸로, 없으면 뒤로 공중제비 → 1초 누움 → GetUp → 화내기 중 하나:
        40% 발 동동(Stomp, 플레이어를 보며 3초) / 30% 바닥 데굴데굴(3초, 일어나기 전) / 30% 쫓아오기
        (Run 또는 Walk 2.3배, 5 m/s, 2 m 안이면 주먹 흔들기, 8초 또는 25 m 넘게 멀어지면 포기).
      머리 위에 빨간 핏대 표시가 뜬다. 같은 손님은 1.5초 동안 다시 안 치인다(쫓아오는 중엔 또 치인다).
      디버그: 콘솔에서 __npcs.list(), __npcs.hit(3), __npcs.punch(3)  (createNPCs 옵션 debug:false 로 끔)

   ── 주먹 (GTA 처럼 때리기) ──
   걸어 다닐 때 왼쪽 클릭을 짧게(0.2초 안에 떼기) 하면 주먹. 클릭한 손님이 1.6 m 안이면 그 손님,
   아니면 플레이어 앞쪽 1.6 m 안의 가장 가까운 손님이 맞는다. 처음 맞으면 휘청(0.6초) 후 화내고
   (쫓아오기 65% / 발 동동 35%), 3초 안에 또 맞거나 앉아 있으면 넘어진다(→ 데굴데굴/쫓기 비율 높음).
   꾹 누르기(0.2초 이상)는 그대로 잡기. 차를 타고 있을 땐 주먹이 안 나간다.
   ④의 attachGrab 옵션에 다음을 더한다:
        isOnFoot: () => player.mode === 'onfoot',
        getPlayerFacing: () => person.rotation.y,      // 걷는 캐릭터가 보는 각도 (앞 = (sin, cos))
        playPunch: hit => { ... },                   // 플레이어 주먹 동작 재생 (hit = 맞은 손님 또는 null)
      (또는 npcs.onPlayerPunch = hit => {...} 로 걸어도 된다 — 둘 다 불린다.)

   ── 다른 모듈(선술집·권총)이 쓰는 공용 API ── (createNPCs 가 돌려준 객체 npcs 의 메서드)
     npcs.pick(raycaster, range = Infinity) → npc | null
         스킨 메시 대신 몸통 구 3개로 판정. 플레이어에서 range 밖은 무시. 잡힌/날아가는 손님 제외.
     npcs.knockDown(npc, impulse, cause) → bool
         impulse: THREE.Vector3 (월드 m/s, 위쪽 y 는 최소 1.5), cause: 'car' | 'punch' | 'shot' | 'throw'.
         의자 예약을 풀고 넘어뜨린다 → 누움 → 일어나서 원인별 화내기 비율로 반응.
     npcs.list() → [{ i, npc, model, gender, pos: Vector3, state: 'WANDER'|..., seated, angry }]
         같은 배열·객체를 재사용한다(읽기 전용, 매번 갱신). 보관하려면 복사할 것.
     npcs.freeSeatNear(pos, r = 2) → seat | null    pos({x,z}) 에서 r 안의 빈(쓰러지지 않은) 의자
     npcs.reserveSeat(seat, owner) → bool            owner 는 아무 객체(예: player). 손님은 그 의자를 안 쓴다
     npcs.releaseSeat(seat) → bool                   reserveSeat 로 잡은 자리를 푼다(손님 자리는 못 푼다)
         seat 은 { x, z, y(바닥), rotY(테이블을 보는 각도), stall } — 앉을 때 y + 0.42 가 의자 윗면.
     npcs.alarm(pos, radius = 0, kind = 'shot') → 놀란 인원 수
         kind: 'shot'(기본 반경 15 m) | 'bomb'(24) | 'explosion'(32). radius 를 주면 그 값.
         반경 안 손님은 비명 말풍선 → 술잔 놓고(앉아 있으면 벌떡) pos 반대쪽으로 6~10초 뛰어 도망.
         다시 울리면 계속 도망. 넘어져 있던 손님은 일어나자마자 도망. 술집 주인도 도망갔다 카운터로 복귀.
     npcs.barkeeperServe(stallIndex) → bool    그 가판대 주인이 플레이어 쪽을 보고 잔을 내밀며 "여기 있어요!"
     npcs.say(npc, text, life = 1.6)          머리 위 말풍선 (풀 8개, 35 m 밖은 생략)
     (events.js 가 쓰는 것) spawnGuard(x, z, rot) / setGuardChase(on) / guardInfo() → {count, nearest}
       startFight(si = -1) → 가판대 번호 | -1, endFight(), startBard(si = -1) → 가판대 번호 | -1, endBard(),
       fight / bard 상태 객체, 콜백 onAggression(kind, npc) / onGuardCatch(guard) / onNpcEvent(kind, npc).
       경비병(guard 모델 + 미늘창)은 최대 4명을 재사용하고, 멀어지면 숨긴다(list() 의 off = true).

   ── 거리의 삶 (자동) ──
     구경꾼: 누가 맞거나 넘어지거나 던져지면 12 m 안 걷던 손님 최대 3명이 멈춰서 2초간 웃거나(Cheers) 항의(Stomp).
     수다: 가끔 길가에서 2~3명이 모여 8~15초 이야기("…" 말풍선, 고개·손짓). 동시에 최대 2무리.
     술집 주인: 가판대마다 1명(innkeeper/maid/baker 복제)이 수레 뒤(BAR_LOCAL_X/Z)에 서서 카운터를 닦고
       손님/플레이어 쪽을 본다. 배회·의자에서 빠지고, 잡거나 때릴 수 있으며 일어나면 카운터로 돌아간다.
       (createNPCs 옵션 barkeepers:false 로 끔)
     인원: count 옵션(예: 25). 처음 10명은 원래 색, 그 뒤 복제는 옷 색·키(0.95~1.05)를 조금씩 바꾼다.
     성능: 35 m 밖 애니메이션 0.15초 간격, 30 m 밖 그림자 끔, 스킨 메시 경계 구 고정, 말풍선 8개 재사용.
       25명 + 주인 7명 기준 update 한 번 약 0.1~0.2 ms (테스트 페이지).
     사회생활 [social] (자동, 연결 코드 필요 없음):
       술자리 — 같은 테이블이 다 같이 건배("건배!"/"상호왕국을 위하여!"), 세 잔 마시면 "한 잔 더!" → 주인이 걸어와 잔을 준다.
       취기 n.drunk 0..1 — 마실수록 오르고 4~5분이면 깬다. 취객은 갈지자로 휘청이며 걷고 "딸꾹!"·♪ 노래, 가끔 넘어진다.
       말다툼 → 주먹다짐 — 취객끼리 부딪치거나 시비 → 4마디 말싸움(ARGUE) → 취한 만큼 확률로 FIGHT(맷집 게이지).
         한쪽이 넘어지면 승자 환호, 오래가면 주인·순찰 경비병이 말린다(BREAKUP). 45% 는 뒤에 화해 포옹(HUG).
         손님끼리 생긴 일(cause 'brawl'·'trip')은 수배 ★ 를 올리지 않는다.
       팔씨름(ARM) · 춤(DANCE, 음유시인 연주 중·밤 술집 앞, 짝지어 빙글빙글) · 커플 산책 · 지나가며 인사 ·
       임금님 행차에 절(watch) · 밤엔 의자에서 잠(Z z z) · 아침 하품.
       디버그: __npcs.toast(si) brawl(skip) argue() armwrestle(si) dance(k) drunk(i,v) trip(i) couple() sleep(si) hug() social()
      캔버스(renderer.domElement)에만 리스너를 달고 stopPropagation 을 하지 않으므로 window 의
      pointerdown(음악 첫 제스처)은 그대로 받는다. 버튼·패널 같은 UI 위에서는 캔버스가 이벤트를 받지 않는다.
   ════════════════════════════════════════════════════════════════════ */
import { shareSkeleton, flatSkinnedLOD } from './perf.js';   // 성능: 부위끼리 뼈대 공유 + 먼 거리 한 덩어리 LOD


/* 10명 (남 6, 여 4). 없는 파일은 경고만 남기고 건너뛴다 */
export const NPC_MODELS = [
  { file: 'models/npc/npc-innkeeper.glb', gender: 'm' },
  { file: 'models/npc/npc-traveler.glb',  gender: 'm' },
  { file: 'models/npc/npc-guard.glb',     gender: 'm' },
  { file: 'models/npc/npc-blacksmith.glb', gender: 'm' },
  { file: 'models/npc/npc-bard.glb',      gender: 'm' },
  { file: 'models/npc/npc-monk.glb',      gender: 'm' },
  { file: 'models/npc/npc-maid.glb',      gender: 'f' },
  { file: 'models/npc/npc-baker.glb',     gender: 'f' },
  { file: 'models/npc/npc-noble.glb',     gender: 'f' },
  { file: 'models/npc/npc-herbalist.glb', gender: 'f' },
];
/* 배우 전용 모델 (서빙 아가씨·임금님). 거리 손님·술집 주인·경비병 풀에는 절대 안 섞이고 addActor 로만 쓴다.
   없으면 addActor(re, { fallback }) 의 대체 모델을 쓴다. */
export const ACTOR_MODELS = [
  { file: 'models/npc/npc-barmaid.glb', gender: 'f' },
  { file: 'models/npc/npc-king.glb',    gender: 'm' },
];
const DRACO_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/';

/* portfolio.js 의자 블록과 같은 값 */
const STOOL_TABLE_Z = 4.6, STOOL_RING = 1.75, STOOL_H = 0.42, STOOL_BASE_Y = 0.01;

const MODEL_H = 1.8, CHAR_H = 1.95, S = CHAR_H / MODEL_H;
const HIP_SIT = 0.42;            // Sit 포즈 엉덩이 높이 (모델 단위)
const WALK_SPEED = 1.3;          // m/s (Walk 클립 기준 속도; NPC마다 1.1~1.5)
const SEATED_MAX = 0.35;         // 동시에 앉아 있는 비율 상한 → 65% 이상은 늘 걷는다
const TURN_RATE = 4.0;           // rad/s
const FADE = 0.35;               // 크로스페이드
const RING_R = 1.75;             // 테이블 둘레를 도는 반지름 (의자 바깥, 수레 앞)
const TABLE_AVOID_R = 1.9;       // 배회 중 테이블 원 밖으로 밀어내는 반지름
const SIDE_STEP = 0.55;          // 의자 옆으로 다가서는 거리
const FRONT_STEP = 0.22;         // 앉기 직전 의자 앞(테이블 쪽)에 서는 거리
const SIT_TIME = 0.6;            // 앉기/일어서기 보간 시간
const PLAYER_R = 1.6, PLAYER_R_OUT = 2.2;   // 부딪힐 만큼 가까울 때만 비켜 간다 (멈추거나 쳐다보지 않음)
const CLIP_LEN = { Idle: 3, Walk: 1, Sit: 4, Drink: 3, Cheers: 1.5 };
/* 서서 하는 몸짓 (play 가 Cheers/Drink 를 서 있는 사람에게 틀 때, 또는 cheerStanding) */
const STAND = { cheer: 1, drink: 2, offer: 3, laugh: 4, toast: 5 };
const STAND_FADE = 0.3;

const ST = { WANDER: 0, PAUSE: 1, TO_SEAT: 2, SIT_DOWN: 3, SEATED: 4, STAND_UP: 5, LEAVE: 6,
  HELD: 7, FLYING: 8, LYING: 9, GETUP: 10, STOMP: 11, ROLL: 12, CHASE: 13, STAGGER: 14,
  FLEE: 15, WATCH: 16, CHAT: 17, BAR: 18, SERVE: 19, BAR_RETURN: 20,
  GUARD: 21, GUARD_LEAVE: 22, FIGHT: 23, GATHER: 24, BARD_GO: 25, BARD_PLAY: 26, OFF: 27,
  ACTOR: 28 /* village.js 배우: 바깥에서 조종 */,
  /* 사회생활 (social) — 대화(F) 불가 상태 */
  ARGUE: 29 /* 취객 말다툼 */, ARM: 30 /* 팔씨름 (의자에 앉은 채) */, DANCE: 31 /* 춤 */, HUG: 32 /* 화해 포옹 */,
  BREAKUP: 33 /* 술집 주인·경비병이 싸움 말리러 감 */ };

/* 이벤트 (events.js 와 같이 쓴다) */
const GUARD_MAX = 4, GUARD_SPEED = 5.5, GUARD_CATCH_R = 1.0, GUARD_GONE_R = 45;
const FIGHT_TIME = 15, GATHER_R = 22, BARD_TIME = 24;
const GUARD_SHOUT = ['거기 서라!', '멈춰라!', '꼼짝 마!', '잡아라!'];
const FIGHT_START = ['뭐라고?!', '한판 붙자!', '너 이리 와!'];
const FIGHT_HIT = ['받아라!', '이얍!', '어딜!'];
const FIGHT_CROWD = ['때려!', '한 방 더!', '싸움이다!', '와아!'];

/* 거리의 삶 */
const ALARM_R = { shot: 15, bomb: 24, explosion: 32 };   // 소동 종류별 기본 반경 (m)
const FLEE_SPEED = 4.5;
const WATCH_R = 12;              // 이 안에서 누가 맞으면 구경꾼이 반응
const BUBBLE_MAX = 12, BUBBLE_DIST = 35;
const BAR_LOCAL_X = 0, BAR_LOCAL_Z = -2.2;   // 술집 주인 자리 (가판대 그룹 지역좌표, 수레 뒤). 부스 glb 가 오면 여기만 바꾼다
const MIX_FAR = 35;              // 이보다 먼 손님은 애니메이션을 0.15초마다만 갱신
const SHADOW_FAR = 30;           // 이보다 먼 손님은 그림자를 끈다
const LOD_FAR = 24;              // 이보다 먼 손님은 부위 8개 대신 정점색 한 덩어리(그리기 호출 1개)로 그린다 (perf.js)
const SCREAMS = ['으악!', '살려줘!', '도망쳐!', '꺄악!'];
const LAUGHS = ['하하!', '푸하하!', '꼴좋다!', '어이쿠~'];
/* 맷집: 맞으면 휘청만 하다가 쌓인 데미지가 POISE 를 넘으면 넘어진다. 4초 안 맞으면 초당 HEAL 씩 회복 */
const POISE = 100, HEAL = 20, HEAL_DELAY = 4;
const HIT_DMG = { punch: 18, kick: 40, dropkick: 70, sword: 30, axe: 40, hammer: 75, pan: 25, flail: 45, shot: 45, arrow: 40, bolt: 50, javelin: 60, weapon: 35 };
const NPC_CAUSE = new Set(['fight', 'brawl', 'trip']);   // 손님끼리 일어난 일 — 플레이어 탓이 아니다 (수배 ★ 없음)
const KNOCK_NOW = new Set(['car', 'explosion', 'throw', 'fight', 'rocket', 'shell']);   // 이건 바로 넘어진다
const RIDE_LAUGHS = ['하하하하!', '나이스!', '푸하하하!', '크하하 날아갔다!', '나이스 샷!', '스트라이크!', '배꼽 빠지겠네!', '저거 봐 저거!', '와하하하!', '10점 만점!'];   // 탈것에 치이면 구경꾼이 박장대소
const PROTESTS = ['이봐!', '괜찮아?', '그만해!', '무슨 짓이야!'];
const CHATS = ['그래서 말이야', '정말?', '하하', '음…', '그렇지!', '들었어?'];
/* 옷 색 바꾸기에서 빼는 재질 (피부·눈·머리·수염·잔·금속) */
const NO_TINT = /Skin|Eye|Hair|Beard|Mug|Foam|Steel|Metal|Wood|Gold|Emblem/i;
const isLying = st => st === ST.LYING || st === ST.GETUP || st === ST.ROLL;

/* 차에 치였을 때 */
const HIT_MIN_SPEED = 2;         // 이 속도(m/s) 이상으로 부딪혀야 넘어진다
const HIT_PAD = 0.35;            // 사람 몸 반지름 — 차 테두리에 더한다
const HIT_COOLDOWN = 1.5;
const PUNCH_R = 1.6, PUNCH_COMBO = 3, STAGGER_TIME = 0.6;
/* 화내기 비율 [발 동동, 데굴데굴, 쫓아오기] — 원인별 */
const REACT_W = { car: [0.4, 0.3, 0.3], throw: [0.4, 0.3, 0.3], punch: [0.25, 0.2, 0.55], shot: [0.3, 0.4, 0.3] };
const STOMP_TIME = 3, ROLL_TIME = 3, CHASE_TIME = 8, CHASE_SPEED = 5, CHASE_GIVEUP = 25;

/* 잡기·던지기 */
const COM = 0.95;                // 몸 회전 중심(대략 무게중심) 높이
const GRAB_H = 1.7;              // 잡는 지점(목덜미) 높이
const GRAVITY = 16;              // 살짝 무겁게 — 붕 뜨지 않게
const LIE_Y = 0.2;               // 누웠을 때 몸 중심 높이 (대체 동작)
const THROW_MAX = 14, THROW_UP = 2.5;
const HIST = 8;                  // 던지기 속도 계산용 최근 위치 기록 개수

/* ── 스테이션 → stalls 배열 ── */
export function stallsFromStations(stations, { THREE, toyBlocks = null } = {}) {
  const v = new THREE.Vector3();
  const out = [];
  for (const st of stations) {
    const g = st.group;
    g.updateMatrixWorld(true);
    g.localToWorld(v.set(0, 0, STOOL_TABLE_Z));
    const stall = { x: v.x, z: v.z, rotY: g.rotation.y, seats: [] };
    g.localToWorld(v.set(BAR_LOCAL_X, 0, BAR_LOCAL_Z));
    stall.bar = { x: v.x, z: v.z, rotY: g.rotation.y };
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      g.localToWorld(v.set(Math.cos(a) * STOOL_RING, 0, STOOL_TABLE_Z + Math.sin(a) * STOOL_RING));
      const seat = { x: v.x, z: v.z, y: STOOL_BASE_Y, rotY: Math.atan2(stall.x - v.x, stall.z - v.z), mesh: null };
      if (toyBlocks) {
        for (const b of toyBlocks) {
          const h = b.home;
          if (h && Math.abs(h.x - v.x) < 0.05 && Math.abs(h.z - v.z) < 0.05) {
            seat.mesh = b.mesh; seat.y = h.y - STOOL_H / 2; break;
          }
        }
      }
      stall.seats.push(seat);
    }
    out.push(stall);
  }
  return out;
}

/* ── 메인 ── */
export async function createNPCs({
  THREE, scene, GLTFLoader, DRACOLoader = null, dracoLoader = null, dracoPath = DRACO_CDN,
  groundY, pathX, stalls = [], bounds = { minX: -42, maxX: 42, minZ: -84, maxZ: 84 },
  getPlayerPos = null, getNight = null, getRide = null, roadHalf = 2.52, bridge = null,
  debug = true, barkeepers = true,
  obstacles = null /* (pos{x,z}, r) => 밀어냈으면 true. 가로등·우물·집 같은 소품을 걷는 손님이 뚫지 않게 (setObstacles 로도) */,
  count = 0 /* 0 = 불러온 모델 수만큼 1명씩 */, models = NPC_MODELS, actorModels = ACTOR_MODELS, seed = 0,
}) {
  const { clone: skeletonClone } = await import('three/addons/utils/SkeletonUtils.js');

  /* Draco 디코더: 넘겨받은 인스턴스 > 넘겨받은 클래스 > 직접 import */
  let draco = dracoLoader, ownDraco = false;
  if (!draco) {
    const DL = DRACOLoader || (await import('three/addons/loaders/DRACOLoader.js')).DRACOLoader;
    draco = new DL(); draco.setDecoderPath(dracoPath); ownDraco = true;
  }
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const loadAll = (list, warn) => Promise.all(list.map(m => loader.loadAsync(m.file).then(g => { g.gender = m.gender; g.file = m.file; return g; }).catch(() => {
    if (warn) console.warn('[npcs] 모델 없음, 건너뜀:', m.file); else console.info('[npcs] 배우 모델 없음 → 대체 모델 사용:', m.file);
    return null;
  })));
  /* sources = 거리 손님·술집 주인·경비병 풀, actorSources = 배우 전용(서빙 아가씨·임금님) — 따로 둔다 */
  const [srcAll, actAll] = await Promise.all([loadAll(models, true), loadAll(actorModels || [], false)]);
  const sources = srcAll.filter(Boolean), actorSources = actAll.filter(Boolean);
  if (!count) count = sources.length;
  if (ownDraco) draco.dispose();
  if (!sources.length) return { update() {}, dispose() {}, count: 0 };

  /* 간단한 시드 난수 (seed=0 이면 Math.random) */
  let rs = seed >>> 0;
  const rnd = seed ? () => ((rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296) : Math.random;
  const rr = (a, b) => a + (b - a) * rnd();

  /* stalls 정리: seat.rotY 없으면 테이블을 보게, owner 슬롯 추가 */
  for (const s of stalls) {
    s.occupied = 0;
    for (const seat of s.seats) {
      if (seat.rotY === undefined) seat.rotY = Math.atan2(s.x - seat.x, s.z - seat.z);
      if (seat.y === undefined) seat.y = groundY(seat.x, seat.z);
      seat.owner = null;
      seat.stall = s;
      seat.ang = Math.atan2(seat.z - s.z, seat.x - s.x);
      seat.r = Math.hypot(seat.x - s.x, seat.z - s.z);
      seat.hx = seat.mesh ? seat.mesh.position.x : seat.x;
      seat.hz = seat.mesh ? seat.mesh.position.z : seat.z;
    }
  }

  const zMin = bounds.minZ + 4, zMax = bounds.maxZ - 4;
  const sideOff0 = z => (bridge && z > bridge.z0 - 1.5 && z < bridge.z1 + 1.5) ? Math.min(1.7, bridge.halfW - 0.7) : roadHalf + 0.75;
  const sideOff = (z, n) => sideOff0(z) + (n ? n.lane : 0);
  const clampX = x => Math.max(bounds.minX + 1, Math.min(bounds.maxX - 1, x));

  /* 화난 표시 (빨간 핏대 + 느낌표) — 이미지 파일 없이 캔버스로 */
  const angerTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    c.lineCap = 'round'; c.lineWidth = 16;
    c.strokeStyle = '#ffffff';
    for (const pass of [0, 1]) {
      c.strokeStyle = pass ? '#e8221b' : '#ffffff'; c.lineWidth = pass ? 11 : 19;
      for (let q = 0; q < 4; q++) {
        const a = q * Math.PI / 2 + Math.PI / 4, cx = 64 + Math.cos(a) * 30, cy = 64 + Math.sin(a) * 30;
        c.beginPath(); c.arc(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, 26, a + Math.PI - 0.75, a + Math.PI + 0.75); c.stroke();
      }
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const angerMat = new THREE.SpriteMaterial({ map: angerTex, transparent: true, depthWrite: false, fog: false });

  /* ── NPC 생성 ── */
  const npcs = [];
  const tint = new THREE.Color();
  const lodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
  const lodBase = new Map();
  function makeLod(hi) {
    try { return hi.length > 1 ? flatSkinnedLOD(THREE, hi, lodMat, lodBase) : null; }
    catch (e) { console.warn('[npcs] LOD', e); return null; }
  }
  /* 먼 거리 LOD 켜고 끄기. 배우 옷 색을 나중에 바꿨으면(재질이 바뀜) 켤 때 정점색을 다시 굽는다 */
  function setLod(n, on) {
    n.lodOn = on;
    if (on && n.hi.some((m, k) => m.material !== n.lodMats[k])) {
      const nl = makeLod(n.hi);
      if (nl) { n.lod.parent.remove(n.lod); n.lod = nl; n.lodMats = n.hi.map(m => m.material); }
    }
    for (let k = 0; k < n.hi.length; k++) n.hi[k].visible = !on;
    n.lod.visible = on;
    n.lod.castShadow = on && n.shadow;
  }
  function makeNPC(src, i, vary) {
    const root = new THREE.Group();
    root.name = 'NPC_' + i;
    const model = skeletonClone(src.scene);
    const sc = vary ? rr(0.95, 1.05) : 1;
    model.scale.setScalar(S * sc);
    /* 같은 모델이 또 나오면 옷 색을 살짝 바꾼다 (재질 복제 + 색 곱하기. 정점색 모델은 color 가 곱해진다) */
    const hue = rnd(), val = rr(0.72, 1.0);
    const meshes = [], mats = [];
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      /* 스킨 메시 컬링용 경계 구 (모델 단위, 앉기·눕기·팔 들기까지 덮게 넉넉히) */
      o.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.6);
      meshes.push(o);
      if (!vary) return;
      const one = m => {
        if (!m || NO_TINT.test(m.name)) return m;
        const c = m.clone(); mats.push(c);
        tint.setHSL((hue + rnd() * 0.08) % 1, rr(0.25, 0.45), 0.5 + val * 0.35);
        c.color.multiply(tint).multiplyScalar(1.15);
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
    });
    /* 성능: 부위(메시)마다 따로 있던 뼈대를 하나로 → 뼈 행렬 갱신 8번 → 1번. 먼 거리용 한 덩어리 LOD */
    shareSkeleton(model);
    const hi = meshes.filter(m => m.isSkinnedMesh);
    const lod = makeLod(hi);
    /* root(발밑) → body(무게중심, 던질 때 여기서 구른다) → model */
    const body = new THREE.Group();
    body.position.y = COM;
    model.position.y = -COM;
    body.add(model);
    root.add(body);
    const bone = nm => model.getObjectByName(nm) || model.getObjectByName(nm.replace('.', ''));
    const anger = new THREE.Sprite(angerMat);
    anger.scale.setScalar(0.45); anger.position.y = 2.3; anger.visible = false;
    root.add(anger);
    const bones = { armL: bone('UpperArm.L'), armR: bone('UpperArm.R'), legL: bone('UpperLeg.L'), legR: bone('UpperLeg.R'), foreL: bone('LowerArm.L'), foreR: bone('LowerArm.R'), head: bone('Head'), chest: bone('Chest'), spine: bone('Spine') };
    const propBone = bone('Prop.R');   // 손에 든 잔 (클립이 scale 로 보이기/숨기기) — 배우는 propShow 로 덮어쓴다
    /* 코드로 덧붙이는 몸짓은 클립에 키가 없는 뼈에선 누적되므로, 믹서 갱신 전에 기본 자세로 되돌린다 */
    const boneRest = [];
    for (const k in bones) if (bones[k]) boneRest.push(bones[k], bones[k].quaternion.clone());
    scene.add(root);
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const clip of src.animations) {
      const name = clip.name.split('|').pop();
      const a = mixer.clipAction(clip);
      if (name === 'GetUp' || name === 'Fall') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      else a.setLoop(THREE.LoopRepeat, Infinity);
      actions[name] = a;
    }
    const path = [];
    for (let k = 0; k < 10; k++) path.push({ x: 0, z: 0 });
    return {
      root, mixer, actions, cur: null, curName: '',
      x: 0, z: 0, y: 0, rot: 0,
      gender: src.gender, model: src.file.split('/').pop().replace('.glb', ''), speed: rr(1.1, 1.5), lane: rr(-0.45, 0.45),
      state: ST.WANDER, timer: 0, side: rnd() < 0.5 ? -1 : 1, dir: rnd() < 0.5 ? -1 : 1,
      legLeft: rr(8, 30), seat: null, lastStall: null, stallCooldown: 0,
      path, pathN: 0, pathI: 0,
      fromX: 0, fromZ: 0, fromY: 0,
      seatedLeft: 0, animTimer: 0, cheerIn: -1,
      yielding: false, yieldT: 0,
      mixAcc: 0, dist: 0,
      body, bones, idx: i,
      hx: 0, hy: 0, hz: 0, tx: 0, ty: 0, tz: 0, hvx: 0, hvz: 0,   // 잡힌 지점·목표·속도
      bx: 0, bz: 0, bvx: 0, bvz: 0,                               // 매달린 진자 각도
      cx: 0, cy: 0, cz: 0, vx: 0, vy: 0, vz: 0, spinX: 0, spinZ: 0, // 날아가는 몸 중심
      rx0: 0, rz0: 0, rxT: 0, rzT: 0, cy0: 0, clk: 0, hk: 0, mixed: false,
      punchT: -9, sx: 0, sz: 0,
      anger, react: 0, rolled: false, knockClip: false, hitCD: 0, close: false,
      hist: Array.from({ length: HIST }, () => ({ x: 0, y: 0, z: 0, t: -1 })),
      sc, meshes, mats, shadow: true, bubble: null, boneRest, procDirty: false,
      standK: 0, standOn: false, standS: -9, standUntil: 0, standHop: 1, actSit: false,   // 서서 환호·마시기 덧씌우기 (standLayer)
      hi, lod, lodOn: false, lodMats: hi.map(m => m.material),
      guard: false, off: false, fight: null, foe: null, punchAnim: 0, gatherC: null, gx: 0, gz: 0, fx: 0, fz: 0,
      bar: -1, panicT: 0, panicX: 0, panicZ: 0, watchKind: 0, watchV: null, chatG: null, arrived: false, wiping: false, talkT: 0,
      propBone, propShow: null /* null = 클립대로, true/false = 잔 보이기/숨기기 (배우) */, carry: 0 /* 0..1 쟁반 들기 자세 */, bow: 0 /* 0..1 인사 */,
      /* 사회생활 */
      drunk: 0 /* 0..1 취기 */, cups: 0, greetCD: rr(0, 20), bumpCD: 0, lead: null /* 같이 걷는 앞사람 */, pal: null /* 따라오는 사람 */, palT: 0,
      sleeping: false, wantSleep: false, yawnT: 0, nodT: 0, swayed: false, dSay: '', dSayT: 0, dSayC: null,
      socG: null, dPal: null, dAng0: 0, pcx: 0, pcz: 0, serveTo: null, hugO: null,
    };
  }
  for (let i = 0; i < count; i++) npcs.push(makeNPC(sources[i % sources.length], i, i >= sources.length));
  const nWalkers = npcs.length;   // 이 뒤에 붙는 술집 주인은 배회·의자 계산에서 뺀다

  const api = {};   // 돌려줄 객체 (콜백 onAggression / onGuardCatch / onNpcEvent 를 events.js 가 단다)

  /* ── 헬퍼 (update 에서 할당 없이 쓰도록 클로저 밖 스크래치 없이 숫자만 다룬다) ── */
  let now = 0;   // 내부 시계 (주먹 연타 판정 · 서서 하는 몸짓 섞기)
  const smooth = k => k * k * (3 - 2 * k);
  /* Cheers·Drink 클립은 '앉아서' 잔을 드는 동작이다. 서 있는 사람에게 그대로 틀면 허공에 앉은 것처럼 보이므로
     앉아 있지 않으면 Idle 을 틀고 standLayer 가 팔을 덧씌운다 (curName 은 요청한 이름 그대로 둔다).
     kind 를 주면 그 몸짓으로 (STAND.cheer/drink/offer/laugh/toast) */
  function play(n, name, fade = FADE, kind = 0) {
    const req = name;
    let sk = 0;
    if (name === 'Cheers' || name === 'Drink') {
      if (!sitsNow(n)) { sk = kind || (name === 'Cheers' ? STAND.cheer : STAND.drink); name = 'Idle'; }
    } else if (n.actor && name !== 'Fall' && name !== 'GetUp') n.actSit = name === 'Sit';
    setStand(n, sk, name);
    const a = n.actions[name];
    if (!a) return;
    n.curName = req;
    if (n.cur === a) return;
    a.reset();
    a.setEffectiveTimeScale(1);
    a.setEffectiveWeight(1);
    a.fadeIn(fade);
    a.play();
    if (n.cur) n.cur.fadeOut(fade);
    n.cur = a;
  }
  /* 지금 앉아 있나: 의자(SIT_DOWN·SEATED·팔씨름) 또는 배우가 Sit 을 튼 뒤 (actorSeated 로 덮어쓸 수 있다) */
  function sitsNow(n) {
    return n.state === ST.SEATED || n.state === ST.SIT_DOWN || n.state === ST.ARM || (n.state === ST.STAND_UP && !!n.seat)
      || (n.state === ST.ACTOR && n.actSit);
  }
  /* 서서 하는 몸짓 켜기/끄기 (0.3초에 걸쳐 섞는다). 다른 클립(걷기·넘어짐)을 틀면 강제 시간(cheerStanding)도 끝난다 */
  function standW(n) {
    const k = Math.min(1, Math.max(0, (now - n.standS) / STAND_FADE));
    return smooth(n.standOn ? k : 1 - k);
  }
  function setStand(n, kind, clip) {
    if (!kind) {
      if (now < n.standUntil && clip === 'Idle') return;   // cheerStanding 시간 동안은 Idle 요청이 와도 유지
      n.standUntil = 0;
      if (n.standOn) { const w = standW(n); n.standOn = false; n.standS = now - (1 - w) * STAND_FADE; }
      return;
    }
    if (n.standOn && n.standK === kind) return;
    const w = n.standK === kind ? standW(n) : 0;
    n.standK = kind; n.standOn = true; n.standS = now - w * STAND_FADE;
    n.standPh = rnd() * 6;
  }
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function turnTo(n, target, dt) {
    const d = wrap(target - n.rot);
    const m = TURN_RATE * dt;
    n.rot += Math.abs(d) <= m ? d : Math.sign(d) * m;
    return Math.abs(d);
  }
  function seatBroken(seat) {
    const m = seat.mesh;
    if (!m) return false;
    const q = m.quaternion;
    const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
    return upY < 0.85 || Math.abs(m.position.x - seat.hx) > 0.3 || Math.abs(m.position.z - seat.hz) > 0.3;
  }
  function releaseSeat(n) {
    if (n.seat) { n.seat.owner = null; n.seat.stall.occupied--; n.seat = null; }
    n.sleeping = false; n.wantSleep = false;
  }
  function reserve(n, seat) {
    seat.owner = n; seat.stall.occupied++; n.seat = seat;
  }
  /* 테이블 둘레 원 위의 점 */
  function ringPt(p, s, ang, r) { p.x = s.x + Math.cos(ang) * r; p.z = s.z + Math.sin(ang) * r; }

  /* 현재 위치 → 테이블 둘레 → 의자 옆 → 의자 앞 */
  function planToSeat(n, seat) {
    const s = seat.stall;
    const tx = -Math.sin(seat.ang), tz = Math.cos(seat.ang);       // 원의 접선
    const myAng = Math.atan2(n.z - s.z, n.x - s.x);
    const sgn = wrap(myAng - seat.ang) >= 0 ? 1 : -1;              // 내가 있는 쪽 옆으로 다가간다
    const sideX = seat.x + tx * SIDE_STEP * sgn, sideZ = seat.z + tz * SIDE_STEP * sgn;
    const sideAng = Math.atan2(sideZ - s.z, sideX - s.x);
    let k = 0;
    const span = wrap(sideAng - myAng);
    const steps = Math.max(1, Math.ceil(Math.abs(span) / 0.8));
    for (let j = 0; j <= steps; j++) ringPt(n.path[k++], s, myAng + span * j / steps, RING_R);
    n.path[k].x = sideX; n.path[k].z = sideZ; k++;
    n.path[k].x = seat.x + Math.cos(seat.ang) * -FRONT_STEP; n.path[k].z = seat.z + Math.sin(seat.ang) * -FRONT_STEP; k++;
    n.pathN = k; n.pathI = 0;
  }
  /* 의자 앞 → 의자 옆 → 둘레를 돌아 길 쪽으로 */
  function planLeave(n, seat) {
    const s = seat.stall;
    const tx = -Math.sin(seat.ang), tz = Math.cos(seat.ang);
    const roadX = pathX(s.z);
    const outAng = Math.atan2(0, roadX - s.x);                      // 길 쪽 방향
    const sgn = wrap(outAng - seat.ang) >= 0 ? 1 : -1;
    const sideX = seat.x + tx * SIDE_STEP * sgn, sideZ = seat.z + tz * SIDE_STEP * sgn;
    const sideAng = Math.atan2(sideZ - s.z, sideX - s.x);
    let k = 0;
    n.path[k].x = sideX; n.path[k].z = sideZ; k++;
    const span = wrap(outAng - sideAng);
    const steps = Math.max(1, Math.ceil(Math.abs(span) / 0.8));
    for (let j = 0; j <= steps; j++) ringPt(n.path[k++], s, sideAng + span * j / steps, RING_R);
    n.pathN = k; n.pathI = 0;
    n.side = Math.sign(s.x - roadX) || 1;                            // 가판대가 있는 쪽 길가로 돌아간다
  }

  function pickSeat(n, night) {
    let best = null, bd = 1e9;
    for (const s of stalls) {
      if (s === n.lastStall && n.stallCooldown > 0) continue;
      const dz = Math.abs(s.z - n.z);
      if (dz > 40) continue;
      for (const seat of s.seats) {
        if (seat.owner || seatBroken(seat)) continue;
        /* 이미 누가 앉은 가판대를 조금 더 좋아한다 (같이 마시려고) */
        const d = Math.hypot(seat.x - n.x, seat.z - n.z) - s.occupied * 6 - night * 4 + rnd() * 6;
        if (d < bd) { bd = d; best = seat; }
      }
    }
    return best;
  }

  function startWanderLeg(n) {
    n.state = ST.WANDER;
    n.legLeft = rr(18, 55);
    if (n.z < zMin + 6) n.dir = 1; else if (n.z > zMax - 6) n.dir = -1;
    else if (rnd() < 0.3) n.dir = -n.dir;
  }

  function beginSitDown(n) {
    n.state = ST.SIT_DOWN; n.timer = 0;
    n.fromX = n.x; n.fromZ = n.z; n.fromY = n.y;
    play(n, 'Sit', 0.45);
  }

  function seatY(seat, n) { return seat.y + STOOL_H - HIP_SIT * S * (n ? n.sc : 1); }

  function onSeated(n, night) {
    n.state = ST.SEATED;
    n.seatedLeft = rr(14, 30) * (1 + night * 0.6);
    n.animTimer = rr(1.5, 3);
    if (n.wantSleep) { n.wantSleep = false; n.sleeping = true; n.animTimer = rr(1, 2.5); n.cheerIn = -1; play(n, 'Sit', 0.5); return; }   // [social] 밤잠
    /* 같은 테이블 손님들과 건배 */
    let others = 0;
    for (const o of npcs) {
      if (o !== n && o.state === ST.SEATED && o.seat && o.seat.stall === n.seat.stall) { o.cheerIn = rr(0.2, 0.9); others++; }
    }
    n.cheerIn = others ? 1.0 : -1;
  }

  function placeAtSeat(n, seat) {
    reserve(n, seat);
    n.x = seat.x; n.z = seat.z; n.y = seatY(seat, n); n.rot = seat.rotY;
    n.state = ST.SEATED;
    n.seatedLeft = rr(5, 30);
    n.animTimer = rr(0.5, 3);
    n.cheerIn = -1;
    play(n, rnd() < 0.5 ? 'Drink' : 'Sit', 0);
  }

  /* ── 초기 배치: 일부는 앉아서, 나머지는 길가에 흩어서 ── */
  {
    const freeSeats = [];
    for (const s of stalls) for (const seat of s.seats) if (!seatBroken(seat)) freeSeats.push(seat);
    const nSeated = Math.min(freeSeats.length, Math.round(npcs.length * 0.3));
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (i < nSeated) {
        const j = Math.floor(rnd() * freeSeats.length);
        placeAtSeat(n, freeSeats.splice(j, 1)[0]);
      } else {
        n.z = rr(zMin, zMax);
        n.x = clampX(pathX(n.z) + n.side * sideOff(n.z, n));
        n.y = groundY(n.x, n.z);
        n.rot = n.dir > 0 ? 0 : Math.PI;
        if (rnd() < 0.3) { n.state = ST.PAUSE; n.timer = rr(1, 4); play(n, 'Idle', 0); }
        else { startWanderLeg(n); play(n, 'Walk', 0); }
      }
      if (n.cur) n.cur.time = rnd() * (CLIP_LEN[n.curName] || 1);
      n.root.position.set(n.x, n.y, n.z);
      n.root.rotation.y = n.rot;
    }
  }

  /* ── 술집 주인: 가판대마다 한 명, 수레 뒤 카운터에 선다 ── */
  if (barkeepers) {
    const barSrc = sources.filter(q => /innkeeper|maid|baker/.test(q.file));
    const pool = barSrc.length ? barSrc : sources;
    stalls.forEach((st, si) => {
      if (!st.bar) return;
      const n = makeNPC(pool[si % pool.length], npcs.length, true);
      n.bar = si;
      n.x = st.bar.x; n.z = st.bar.z; n.y = groundY(n.x, n.z); n.rot = st.bar.rotY;
      n.state = ST.BAR; n.timer = rr(1, 4); n.wiping = rnd() < 0.5;
      play(n, 'Idle', 0);
      n.cur.time = rnd() * CLIP_LEN.Idle;
      n.root.position.set(n.x, n.y, n.z); n.root.rotation.y = n.rot;
      npcs.push(n);
    });
  }

  /* 걷기 한 걸음: 목표점을 향해 돌고 앞으로 간다. 도착하면 true */
  function walkToward(n, tx, tz, dt, arriveR) {
    const dx = tx - n.x, dz = tz - n.z;
    const d = Math.hypot(dx, dz);
    if (d < arriveR) return true;
    const err = turnTo(n, Math.atan2(dx, dz), dt);
    const k = err > 1.2 ? 0.15 : Math.cos(err * 0.8);   // 크게 돌 땐 제자리에서 돈다
    const step = Math.min(d, n.speed * k * dt);
    n.x += Math.sin(n.rot) * step;
    n.z += Math.cos(n.rot) * step;
    return false;
  }

  /* 테이블 원 밖으로 밀어내기 (배회 중) */
  function pushFromTables(n) {
    for (const s of stalls) {
      const dx = n.x - s.x, dz = n.z - s.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < TABLE_AVOID_R * TABLE_AVOID_R && d2 > 1e-6) {
        const d = Math.sqrt(d2), k = TABLE_AVOID_R / d;
        n.x = s.x + dx * k; n.z = s.z + dz * k;
      }
    }
  }

  const walking = st => st === ST.WANDER || st === ST.TO_SEAT || st === ST.LEAVE;
  const OBST_NEAR = 60, NPC_OBST_R = 0.32, obPos = { x: 0, z: 0 };
  const setObstacles = fn => { obstacles = typeof fn === 'function' ? fn : null; };

  /* ── 매 프레임 ── */
  function update(dt, t) {
    if (!(dt > 0)) return;
    now += dt;
    if (ctrl) ctrl.update(dt);
    const ride = getRide ? getRide() : null;
    const rideOn = !!(ride && ride.driving && Math.abs(ride.speed) > HIT_MIN_SPEED);
    const rs = rideOn ? Math.sin(ride.heading) : 0, rc = rideOn ? Math.cos(ride.heading) : 1;
    const night = getNight ? getNight() : 0;
    const p = getPlayerPos ? getPlayerPos() : null;
    const px = p ? p.x : 1e9, pz = p ? p.z : 1e9;

    /* 앉았거나 앉으러 가는 인원 (동시 착석 상한용) */
    let seatedNow = 0, sleepersNow = 0;
    for (let i = 0; i < npcs.length; i++) if (npcs[i].seat) { seatedNow++; if (npcs[i].sleeping || npcs[i].wantSleep) sleepersNow++; }

    /* 걷는 손님끼리 겹치지 않게 (10명 → 45쌍): 0.75 m 안이면 밀어내고,
       2.5 m 안에서 서로 마주 보고 오면 각자 오른쪽으로 비켜 걷는다 */
    for (let i = 0; i < npcs.length; i++) {
      const a = npcs[i];
      if (!walking(a.state) && a.state !== ST.PAUSE) continue;
      for (let j = i + 1; j < npcs.length; j++) {
        const b = npcs[j];
        if (!walking(b.state) && b.state !== ST.PAUSE) continue;
        const dz = b.z - a.z;
        if (dz > 2.5 || dz < -2.5) continue;      // 길 방향으로 멀면 바로 넘긴다 (30명이면 435쌍, 대부분 여기서 끝)
        const dx = b.x - a.x, d2 = dx * dx + dz * dz;
        if (d2 < 0.5625 && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (0.75 - d) * 0.5 / d;
          a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push;
          /* [social] 취객끼리 부딪치면 말다툼 */
          if (a.state === ST.WANDER && b.state === ST.WANDER && a.drunk + b.drunk > 0.7 && a.bumpCD <= 0 && b.bumpCD <= 0 && a.lead !== b && b.lead !== a) bump(a, b);
        } else if (d2 < 6.25 && a.state === ST.WANDER && b.state === ST.WANDER) {
          const fax = Math.sin(a.rot), faz = Math.cos(a.rot), fbx = Math.sin(b.rot), fbz = Math.cos(b.rot);
          if (fax * fbx + faz * fbz < -0.5 && fax * dx + faz * dz > 0) {   // 마주 보고 다가오는 중
            if (a.greetCD <= 0 && b.greetCD <= 0 && a.dist < BUBBLE_DIST) greet(a, b, night);   // [social] 지나가며 인사
            const k = 0.5 * dt;
            a.x += faz * k; a.z -= fax * k;   // 각자 진행 방향 오른쪽으로
            b.x += fbz * k; b.z -= fbx * k;
          }
        }
      }
    }

    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (n.off) continue;
      if (!Number.isFinite(n.x) || !Number.isFinite(n.z) || !Number.isFinite(n.y)) recoverNpc(n);
      if (n.dmg > 0 && now - n.hitAt > HEAL_DELAY) {   // 맷집 회복
        n.dmg = Math.max(0, n.dmg - HEAL * dt);
        if (n.hpBar) { if (n.dmg <= 0) n.hpBar.g.visible = false; else showHp(n); }
      }
      if (n.stallCooldown > 0) n.stallCooldown -= dt;
      if (n.panicT > 0) n.panicT -= dt;
      if (n.talkT > 0) n.talkT -= dt;
      const pdx = n.x - px, pdz = n.z - pz;
      n.dist = Math.hypot(pdx, pdz);
      const sh = n.dist < SHADOW_FAR;
      if (sh !== n.shadow) { n.shadow = sh; for (let k = 0; k < n.meshes.length; k++) n.meshes[k].castShadow = sh; if (n.lod) n.lod.castShadow = sh && n.lodOn; }
      if (n.lod && (n.lodOn ? n.dist < LOD_FAR - 2 : n.dist > LOD_FAR)) setLod(n, !n.lodOn);

      /* ── 차에 치였나 (차 테두리 직사각형 + 몸 반지름) ── */
      if (n.hitCD > 0) n.hitCD -= dt;
      else if (rideOn && n.state !== ST.HELD && n.state !== ST.FLYING) {
        const dx = n.x - ride.x, dz = n.z - ride.z;
        const fwd = dx * rs + dz * rc, side = dx * rc - dz * rs;
        if (Math.abs(fwd) < ride.halfZ + HIT_PAD && Math.abs(side) < ride.halfX + HIT_PAD) {
          const sg = ride.speed >= 0 ? 1 : -1;
          /* 차가 가는 방향으로, 옆에 맞았으면 옆으로도 조금 */
          let kx = rs * sg + rc * Math.sign(side) * 0.35, kz = rc * sg - rs * Math.sign(side) * 0.35;
          const kl = Math.hypot(kx, kz) || 1;
          knock(n, kx / kl, kz / kl, Math.abs(ride.speed));
        }
      }

      if (n.state >= ST.HELD) {
        n.yielding = false;
        if (n.swayed) { n.swayed = false; if (n.state !== ST.HELD && n.state !== ST.FLYING && n.state !== ST.STAGGER && !isLying(n.state)) n.body.rotation.x = n.body.rotation.z = 0; }
        updateGrabbed(n, dt, t, px, pz);
        stepMixer(n, dt);
        if (n.mixed) {
          if ((n.state === ST.HELD || n.state === ST.ROLL) && !n.actions.Struggle) flail(n, t);
          else if ((n.state === ST.STOMP || (n.state === ST.CHASE && n.close) || (n.state === ST.WATCH && n.watchKind === 1)) && !n.actions.Stomp) stompPose(n, t);
          else if (n.state === ST.BAR && n.wiping) wipePose(n, t);
          else if (n.state === ST.CHAT && n.arrived) chatPose(n, t);
          else if (n.state === ST.FIGHT && n.arrived) jabPose(n, t);
          else if (n.state === ST.BARD_PLAY && bard.phase === 1) strumPose(n, t);
          else if (n.state === ST.ACTOR && (n.carry > 0 || n.bow > 0)) actorPose(n);
          else if (n.state === ST.ARM) armPose(n, t);                                         // [social]
          else if (n.state === ST.DANCE && n.arrived) dancePose(n, t, 1);
          else if (n.state === ST.GATHER && n.arrived && n.gatherC === bard && bard.phase === 1) dancePose(n, t, 0.45);
          else if (n.state === ST.WATCH && n.watchKind === 3) actorPose(n);                  // 임금님께 절
          else if (n.state === ST.HUG && n.arrived) hugPose(n);
          if (n.standK) standLayer(n, t);
          if (n.propBone && n.propShow !== null) n.propBone.scale.setScalar(n.propShow && n.state === ST.ACTOR ? 1 : 0.001);
        }
        if (n.anger.visible) {
          n.anger.scale.setScalar(0.42 + Math.abs(Math.sin(t * 9)) * 0.12);
          n.anger.position.y = n.state === ST.ROLL ? 1.15 : 2.3;
        }
        continue;
      }

      /* ── 플레이어 비켜서기 ── */
      if (walking(n.state) || n.state === ST.PAUSE) {
        if (!n.yielding && n.dist < PLAYER_R) { n.yielding = true; n.yieldT = 0; }
        if (n.yielding) {
          if (n.dist > PLAYER_R_OUT) { n.yieldT += dt; if (n.yieldT > 0.5) n.yielding = false; }
          else n.yieldT = 0;
        }
      } else n.yielding = false;

      if (n.yielding && n.dist < PLAYER_R) {
        /* 멈추지 않고 자기 갈 길을 걸으면서 플레이어에게서 살짝 비켜 간다 (길 가운데로는 피하지 않는다) */
        const inv = 1 / Math.max(n.dist, 0.01);
        let ax = pdx * inv, az = pdz * inv;
        const roadSide = Math.sign(n.x - pathX(n.z)) || n.side;
        if (ax * roadSide < 0) ax = roadSide * Math.max(0.6, Math.abs(az));
        const k = 1.1 * dt * (PLAYER_R - n.dist) / PLAYER_R + 0.6 * dt;
        n.x = clampX(n.x + ax * k); n.z += az * k;
      }
      {
        switch (n.state) {
          case ST.WANDER: {
            if (n.lead && followLead(n, dt)) break;   // [social] 커플 산책: 앞사람 옆에서 나란히
            play(n, 'Walk');
            /* 앞쪽 4 m 길가 지점을 목표로 걷는다 */
            let tz = n.z + n.dir * 4;
            if (tz < zMin || tz > zMax) { n.dir = -n.dir; tz = n.z + n.dir * 4; }
            let tx = clampX(pathX(tz) + n.side * sideOff(tz, n));
            for (const s of stalls) {   // 목표점이 테이블 원 안이면 바깥으로
              const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
              if (d < TABLE_AVOID_R + 0.4 && d > 1e-4) { const k = (TABLE_AVOID_R + 0.4) / d; tx = s.x + dx * k; tz = s.z + dz * k; }
            }
            if (n.drunk > 0.25) tx = clampX(tx + Math.sin(now * 1.3 + n.idx * 1.7) * (n.drunk - 0.15) * 1.4);   // [social] 갈지자 걸음
            const before = n.z;
            walkToward(n, tx, tz, dt, 0.05);
            pushFromTables(n);
            n.legLeft -= Math.abs(n.z - before);
            if (n.legLeft <= 0) {
              const wantSit = rnd() < 0.35 + night * 0.3 && seatedNow < Math.max(1, Math.floor(nWalkers * (SEATED_MAX + night * 0.1)));
              const seat = wantSit ? pickSeat(n, night) : null;
              if (seat) {
                reserve(n, seat); planToSeat(n, seat); n.state = ST.TO_SEAT;
                if (night > 0.65 && sleepersNow < SLEEP_MAX && rnd() < 0.25 + n.drunk * 0.4) { n.wantSleep = true; sleepersNow++; }   // [social] 의자에서 잔다
              }
              else if (rnd() < 0.25) { n.state = ST.PAUSE; n.timer = rr(1.5, 4); }
              else {
                /* 플레이어가 멀면 가끔 길을 건너 반대편으로 */
                if (n.dist > 18 && rnd() < 0.35) n.side = -n.side;
                startWanderLeg(n);
              }
            }
            break;
          }
          case ST.PAUSE: {
            play(n, 'Idle');
            n.timer -= dt;
            if (n.timer <= 0) startWanderLeg(n);
            break;
          }
          case ST.TO_SEAT: {
            play(n, 'Walk');
            if (seatBroken(n.seat)) { releaseSeat(n); startWanderLeg(n); break; }
            const q = n.path[n.pathI];
            const last = n.pathI === n.pathN - 1;
            if (walkToward(n, q.x, q.z, dt, last ? 0.06 : 0.25)) {
              if (last) {
                /* 테이블 쪽을 다 본 뒤 앉는다 */
                if (turnTo(n, n.seat.rotY, dt) < 0.08) beginSitDown(n);
                else play(n, 'Idle');
              } else n.pathI++;
            }
            break;
          }
          case ST.SIT_DOWN: {
            n.timer += dt;
            const k = Math.min(1, n.timer / SIT_TIME), e = k * k * (3 - 2 * k);
            const seat = n.seat;
            n.x = n.fromX + (seat.x - n.fromX) * e;
            n.z = n.fromZ + (seat.z - n.fromZ) * e;
            n.y = n.fromY + (seatY(seat, n) - n.fromY) * e;
            turnTo(n, seat.rotY, dt);
            if (seatBroken(seat)) { n.state = ST.STAND_UP; n.timer = 0; n.fromX = n.x; n.fromZ = n.z; n.fromY = n.y; play(n, 'Idle'); break; }
            if (k >= 1) onSeated(n, night);
            break;
          }
          case ST.SEATED: {
            const seat = n.seat;
            if (n.sleeping) {   // [social] 꾸벅꾸벅 — 아침(밤 < 0.35)이 되거나 의자가 쓰러지면 하품하며 깬다
              n.cheerIn = -1;
              n.drunk = Math.max(0, n.drunk - dt * 0.01);
              if (seatBroken(seat) || night < 0.35) {
                n.sleeping = false; n.seatedLeft = 0; n.animTimer = rr(1.5, 2.5); n.yawnT = 2;
                say(n, pickOne(YAWN), 1.8);
              } else {
                play(n, 'Sit', 0.5);
                n.animTimer -= dt;
                if (n.animTimer <= 0) { n.animTimer = rr(3.5, 6); say(n, rnd() < 0.8 ? 'Z z z…' : pickOne(SLEEP_TALK), 2.2, '#4a5a8a'); }
                break;
              }
            }
            n.seatedLeft -= dt;
            if (seatBroken(seat)) { n.seatedLeft = 0; n.animTimer = 0; n.cheerIn = -1; }   // 의자가 쓰러지면 바로 일어난다
            if (n.cheerIn >= 0) {
              n.cheerIn -= dt;
              if (n.cheerIn < 0) { play(n, 'Cheers'); n.animTimer = CLIP_LEN.Cheers - FADE * 0.5; }
            }
            n.animTimer -= dt;
            if (n.animTimer <= 0) {
              if (n.seatedLeft <= 0) {
                n.state = ST.STAND_UP; n.timer = 0;
                n.fromX = n.x; n.fromZ = n.z; n.fromY = n.y;
                play(n, 'Idle', 0.45);
                break;
              }
              /* Sit ↔ Drink 번갈아 */
              if (n.curName === 'Drink') { play(n, 'Sit'); n.animTimer = rr(2, 5); }
              else {
                play(n, 'Drink'); n.animTimer = CLIP_LEN.Drink * (rnd() < 0.3 ? 2 : 1) - 0.05;
                n.drunk = Math.min(1, n.drunk + 0.035 * (1 + night * 0.5));   // [social] 마실수록 취한다
                if (++n.cups >= 3 && n.seatedLeft > 6) requestRefill(n);
              }
            }
            break;
          }
          case ST.STAND_UP: {
            n.timer += dt;
            const seat = n.seat;
            const k = Math.min(1, n.timer / SIT_TIME), e = k * k * (3 - 2 * k);
            const fx = seat.x - Math.cos(seat.ang) * FRONT_STEP, fz = seat.z - Math.sin(seat.ang) * FRONT_STEP;
            n.x = n.fromX + (fx - n.fromX) * e;
            n.z = n.fromZ + (fz - n.fromZ) * e;
            n.y = n.fromY + (groundY(fx, fz) - n.fromY) * e;
            if (k >= 1) {
              n.lastStall = seat.stall; n.stallCooldown = 25;
              planLeave(n, seat);
              releaseSeat(n);
              n.state = ST.LEAVE;
            }
            break;
          }
          case ST.LEAVE: {
            play(n, 'Walk');
            const q = n.path[n.pathI];
            if (walkToward(n, q.x, q.z, dt, 0.25)) {
              if (++n.pathI >= n.pathN) {
                n.dir = rnd() < 0.5 ? -1 : 1;
                startWanderLeg(n);
              }
            }
            break;
          }
        }
      }

      /* [social] 취객은 몸을 좌우로 휘청인다 */
      if (n.drunk > 0.25 && (walking(n.state) || n.state === ST.PAUSE)) {
        const d = n.drunk;
        n.body.rotation.z = Math.sin(now * 2.4 + n.idx) * 0.12 * d; n.body.rotation.x = Math.sin(now * 1.6 + n.idx * 2) * 0.05 * d;
        n.swayed = true;
      } else if (n.swayed) { n.swayed = false; n.body.rotation.x = n.body.rotation.z = 0; }

      /* 소품 충돌 (가로등·우물·집·성벽…): 플레이어 근처(OBST_NEAR m)에서 걷는 손님만, 한 프레임에 한 번 */
      if (obstacles && n.dist < OBST_NEAR && (walking(n.state) || n.state === ST.PAUSE)) {
        obPos.x = n.x; obPos.z = n.z;
        let hit = false;
        try { hit = obstacles(obPos, NPC_OBST_R); } catch (e) { hit = false; }
        if (hit && Number.isFinite(obPos.x) && Number.isFinite(obPos.z)) { n.x = obPos.x; n.z = obPos.z; }
        n.obT = hit ? (n.obT || 0) + dt : 0;
        if (n.obT > 3 && n.state === ST.WANDER && !n.lead) { n.obT = 0; n.dir = -n.dir; }   // 3초 넘게 막히면 돌아선다
      }

      /* 높이: 앉는 중/앉아 있을 땐 보간값, 아니면 지형 */
      if (n.state !== ST.SIT_DOWN && n.state !== ST.SEATED && n.state !== ST.STAND_UP) {
        n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
      }
      n.root.position.set(n.x, n.y, n.z);
      n.root.rotation.y = n.rot;

      /* 걷기 애니메이션 속도는 실제 이동과 맞춘다 */
      if (n.curName === 'Walk' && n.cur) n.cur.setEffectiveTimeScale((n.lead ? n.lead.speed : n.speed) / WALK_SPEED);
      stepMixer(n, dt);
      if (n.mixed && (n.sleeping || n.yawnT > 0 || n.nodT > 0)) socialPose(n, t);
      if (n.mixed && n.standK) standLayer(n, t);
    }
    chatScheduler(dt, px, pz);
    socialUpdate(dt, night);
    updateBubbles(dt);
    if (fight.active) {
      fight.t -= dt;
      if (fight.t <= 0 || (fight.a.fight !== fight && fight.b.fight !== fight)) endFight();
    }
    if (bard.active) {
      const bs = bard.n.state;
      if (bs !== ST.BARD_GO && bs !== ST.BARD_PLAY) endBard();
      else if (bs === ST.BARD_GO && (bard.t -= dt) < -40) endBard();
    }
  }

  /* 먼 손님은 애니메이션을 드문드문 갱신 */
  function stepMixer(n, dt) {
    n.mixed = false;
    if (n.procDirty && (n.dist <= MIX_FAR || n.mixAcc + dt >= 0.15)) {
      const br = n.boneRest;
      for (let k = 0; k < br.length; k += 2) br[k].quaternion.copy(br[k + 1]);
      n.procDirty = false;
    }
    if (n.dist > MIX_FAR) {
      n.mixAcc += dt;
      if (n.mixAcc >= 0.15) { n.mixer.update(n.mixAcc); n.mixAcc = 0; n.mixed = true; }
    } else {
      n.mixer.update(dt + n.mixAcc); n.mixAcc = 0; n.mixed = true;
    }
  }

  /* ════ 잡기 · 던지기 ════ */
  let ctrl = null;
  const nearAngle = (from, target) => target + Math.PI * 2 * Math.round((from - target) / (Math.PI * 2));

  /* Struggle 클립이 없을 때: Idle 위에 팔다리를 휘젓는다 (믹서가 매 프레임 뼈를 덮어쓰므로 누적되지 않는다) */
  function flail(n, t) {
    n.procDirty = true;
    const b = n.bones, ph = n.idx * 1.7;
    if (b.armL) { b.armL.rotation.z += 1.1 + Math.sin(t * 13 + ph) * 0.7; b.armL.rotation.x += Math.sin(t * 9 + ph) * 0.6; }
    if (b.armR) { b.armR.rotation.z -= 1.1 + Math.sin(t * 12 + ph + 1) * 0.7; b.armR.rotation.x += Math.sin(t * 10 + ph + 2) * 0.6; }
    if (b.foreL) b.foreL.rotation.x += Math.sin(t * 15 + ph) * 0.5;
    if (b.foreR) b.foreR.rotation.x += Math.sin(t * 14 + ph) * 0.5;
    if (b.legL) b.legL.rotation.x += Math.sin(t * 11 + ph) * 0.75;
    if (b.legR) b.legR.rotation.x += Math.sin(t * 11 + ph + Math.PI) * 0.75;
  }

  /* Stomp 클립이 없을 때: 발을 번갈아 구르고 오른 주먹을 흔든다 */
  function stompPose(n, t) {
    n.procDirty = true;
    const b = n.bones, w = t * 10 + n.idx;
    if (b.legL) b.legL.rotation.x -= Math.max(0, Math.sin(w)) * 0.9;
    if (b.legR) b.legR.rotation.x -= Math.max(0, -Math.sin(w)) * 0.9;
    if (b.armR) { b.armR.rotation.z -= 2.3; b.armR.rotation.x += Math.sin(t * 18) * 0.35; }
    if (b.foreR) b.foreR.rotation.x += 0.9 + Math.sin(t * 18) * 0.5;
  }

  function setAnger(n, on) { n.anger.visible = on; }

  /* 차에 치였다: 밀리지 않고 넘어진다 */
  function pickReact(cause) {
    const w = REACT_W[cause] || REACT_W.car, r = rnd();
    return r < w[0] ? ST.STOMP : r < w[0] + w[1] ? ST.ROLL : ST.CHASE;
  }
  function knock(n, dx, dz, sp, cause = 'car') {
    const k = Math.min(9, 2 + sp * 0.55);
    knockVel(n, dx * k, 2.5 + Math.min(4, sp * 0.25), dz * k, cause);
  }
  /* 넘어뜨리기 (월드 m/s 속도). 밀리는 게 아니라 뒤로 넘어간다 */
  function knockVel(n, vx, vy, vz, cause = 'car') {
    if (n.state === ST.HELD) return;
    if (!Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz)) return;   // 깨진 힘은 무시
    releaseSeat(n);
    n.yielding = false; n.cheerIn = -1; n.hitCD = HIT_COOLDOWN;
    n.dmg = 0; if (n.hpBar) n.hpBar.g.visible = false;   // 넘어지면 맷집이 다시 찬다
    n.vx = vx; n.vz = vz; n.vy = Math.max(1.5, vy);
    const sp = Math.hypot(vx, vz), dx = sp > 1e-3 ? vx / sp : -Math.sin(n.rot), dz = sp > 1e-3 ? vz / sp : -Math.cos(n.rot);
    if (!isLying(n.state)) n.body.rotation.set(0, 0, 0);
    n.cx = n.x; n.cy = n.y + COM; n.cz = n.z;
    n.rot = Math.atan2(-dx, -dz);            // 친 쪽을 보고 서 있다가 뒤로 넘어간다
    if (n.actions.Fall) {
      n.knockClip = true; n.spinX = 0; n.spinZ = 0;
      n.body.rotation.set(0, 0, 0);
      play(n, 'Fall', 0.12);
    } else {
      n.knockClip = false;
      n.spinX = -(4 + Math.min(6, sp * 0.7)); n.spinZ = rr(-1, 1);   // 뒤로 공중제비
      play(n, n.actions.Struggle ? 'Struggle' : 'Idle', 0.12);         // 술잔은 놓친다
    }
    const npcOnly = NPC_CAUSE.has(cause);   // [social] 손님끼리 싸움·취해서 넘어짐 → 화내지 않고 수배 점수도 없다
    n.react = npcOnly || n.guard || n.actor ? 0 : pickReact(cause);   // [village] 배우는 화내지 않는다
    n.rolled = false;
    if (!npcOnly) emit(cause === 'punch' ? 'knockdown' : cause === 'shot' ? 'weapon' : cause, n);
    setAnger(n, false);
    n.state = ST.FLYING;
    bystanders(n, cause);
  }

  /* 휘청: 한 대 맞고 뒤로 젖혀졌다 돌아온 뒤 화낸다 */
  function stagger(n, dx, dz, cause = 'punch') {
    n.yielding = false; n.cheerIn = -1; n.hitCD = 0.3;
    if (!isLying(n.state)) n.body.rotation.set(0, 0, 0);
    n.rot = Math.atan2(-dx, -dz);
    n.sx = dx * 2.2; n.sz = dz * 2.2;        // 뒤로 밀려나는 속도 (금방 줄어든다)
    n.state = ST.STAGGER; n.timer = 0;
    play(n, 'Idle', 0.1);
    const r = rnd();
    n.react = cause === 'fight' || n.guard || n.actor ? 0 : r < 0.65 ? ST.CHASE : ST.STOMP;   // 주먹엔 쫓아올 확률이 높다
    setAnger(n, true);
    bystanders(n);
    if (cause !== 'fight') emit('punch', n);
  }
  /* ── 맷집 게이지: 머리 위 작은 체력 바 (맞은 뒤 몇 초만 보인다) ── */
  const barBgMat = new THREE.SpriteMaterial({ color: 0x1a1410, transparent: true, opacity: 0.75, depthTest: false });
  function hpBar(n) {
    if (n.hpBar) return n.hpBar;
    const bg = new THREE.Sprite(barBgMat); bg.scale.set(0.62, 0.075, 1);
    const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x6cd06c, transparent: true, depthTest: false }));
    fill.scale.set(0.58, 0.05, 1);
    const g = new THREE.Group(); g.add(bg, fill); g.position.y = 2.2; g.renderOrder = 10; bg.renderOrder = 10; fill.renderOrder = 11;
    g.visible = false;
    n.root.add(g);
    return (n.hpBar = { g, bg, fill });
  }
  function showHp(n) {
    const b = hpBar(n), f = Math.max(0.02, 1 - n.dmg / POISE);
    b.fill.scale.x = 0.58 * f;
    b.fill.center.set(1 / (2 * f), 0.5);                  // 왼쪽 끝을 배경 바 왼쪽 끝에 맞춘다
    b.fill.material.color.setHSL(0.33 * f, 0.7, 0.5);    // 초록 → 노랑 → 빨강
    b.g.visible = true; b.g.position.y = isLying(n.state) ? 0.9 : 2.2;
  }
  /* 맞기: 데미지를 쌓고, 맷집을 넘거나(또는 앉아 있거나 누워 있으면) 넘어진다. 아니면 휘청 */
  function takeHit(n, dmg, vx, vy, vz, cause) {
    if (!n || n.off || n.state === ST.HELD) return false;
    if (KNOCK_NOW.has(cause) || n.seat || isLying(n.state) || n.state === ST.SIT_DOWN || n.state === ST.FLYING) {
      knockVel(n, vx, vy, vz, cause);
      return true;
    }
    n.dmg = (n.dmg || 0) + dmg; n.hitAt = now;
    if (n.dmg >= POISE) { knockVel(n, vx, vy, vz, cause); return true; }
    const l = Math.hypot(vx, vz) || 1;
    stagger(n, vx / l, vz / l, NPC_CAUSE.has(cause) ? 'fight' : 'punch');
    if (cause === 'shot' || cause === 'arrow' || cause === 'bolt') emit('weapon', n);   // 총·활에 맞으면 넘어지지 않아도 큰 사건
    showHp(n);
    return true;
  }
  /* 주먹: 클릭한 손님이 1.6 m 안이면 그 손님, 아니면 앞쪽 1.6 m 안의 가장 가까운 손님 */
  function punch(facing, clicked) {
    const p = getPlayerPos ? getPlayerPos() : null;
    if (!p) return null;
    const fx = facing == null ? 0 : Math.sin(facing), fz = facing == null ? 0 : Math.cos(facing);
    const ok = n => n && !n.off && n.state !== ST.HELD && n.state !== ST.FLYING;
    let target = null;
    if (ok(clicked) && Math.hypot(clicked.x - p.x, clicked.z - p.z) < PUNCH_R) target = clicked;
    else {
      let bd = PUNCH_R;
      for (const n of npcs) {
        if (!ok(n)) continue;
        const dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz);
        if (d >= bd || d < 1e-3) continue;
        if (facing != null && (dx * fx + dz * fz) / d < 0.35) continue;   // 앞쪽만
        bd = d; target = n;
      }
    }
    if (!target) return null;
    let dx = target.x - p.x, dz = target.z - p.z;
    const l = Math.hypot(dx, dz);
    if (l > 1e-3) { dx /= l; dz /= l; } else { dx = fx; dz = fz; }
    target.punchT = now;
    /* 맷집이 남아 있으면 휘청, 다 닳으면(또는 앉아 있거나 누워 있으면) 넘어진다 */
    takeHit(target, HIT_DMG.punch, dx * 3.2, 2.2, dz * 3.2, 'punch');
    return target;
  }

  /* ── 외부 공용 API ── */
  const listOut = [];
  const stNames = Object.keys(ST);
  function list() {
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      let o = listOut[i];
      if (!o) o = listOut[i] = { i, npc: n, model: n.model, gender: n.gender, barkeeper: n.bar >= 0, guard: n.guard, off: false, pos: new THREE.Vector3(), state: '', seated: false, angry: false };
      o.pos.set(n.x, n.y, n.z); o.off = n.off; o.state = stNames[n.state]; o.seated = n.state === ST.SEATED; o.angry = n.anger.visible;
    }
    listOut.length = npcs.length;
    return listOut;
  }
  function pickRay(raycaster, range = Infinity) {
    return pick(raycaster.ray || raycaster, getPlayerPos ? getPlayerPos() : null, range, 1);
  }
  /* dmg 를 주면 그만큼, 없으면 무기 종류(HIT_DMG)만큼 깎는다. 폭발·차·던지기는 바로 넘어진다 */
  function knockDown(n, impulse, cause = 'shot', dmg) {
    if (!n || n.off || n.state === ST.HELD || !impulse) return false;
    if (!Number.isFinite(impulse.x) || !Number.isFinite(impulse.y) || !Number.isFinite(impulse.z)) return false;
    return takeHit(n, dmg != null ? dmg : (HIT_DMG[cause] || HIT_DMG.weapon), impulse.x, impulse.y, impulse.z, cause);
  }
  function freeSeatNear(pos, r = 2) {
    let best = null, bd = r;
    for (const s of stalls) for (const seat of s.seats) {
      if (seat.owner || seatBroken(seat)) continue;
      const d = Math.hypot(seat.x - pos.x, seat.z - pos.z);
      if (d < bd) { bd = d; best = seat; }
    }
    return best;
  }
  function reserveSeatAPI(seat, owner) {
    if (!seat || seat.owner || !owner) return false;
    seat.owner = owner; seat.stall.occupied++;
    return true;
  }
  function releaseSeatAPI(seat) {
    if (!seat || !seat.owner) return false;
    if (npcs.includes(seat.owner)) return false;   // 손님 자리는 손님이 일어날 때 풀린다
    seat.owner = null; seat.stall.occupied--;
    return true;
  }

  function grab(n) {
    if (n.state === ST.HELD || n.state === ST.FLYING) return false;
    releaseSeat(n);
    n.cheerIn = -1; n.yielding = false;
    /* 지금 목덜미 위치에서 시작 (누워 있으면 몸 중심 근처) */
    n.hx = n.tx = n.x; n.hz = n.tz = n.z;
    n.react = 0; n.knockClip = false; setAnger(n, false); n.chatG = null; n.watchV = null;
    if (n.state === ST.ROLL) n.body.rotation.y = 0;
    say(n, pickOne(SCREAMS), 1.2, '#c0281e');
    n.hy = n.ty = isLying(n.state) ? n.y + COM : n.y + (n.state === ST.SEATED ? GRAB_H - 0.45 : GRAB_H);
    n.hvx = n.hvz = 0; n.bx = n.bz = n.bvx = n.bvz = 0;
    n.clk = 0; n.hk = 0;
    for (const h of n.hist) h.t = -1;
    n.state = ST.HELD;
    play(n, n.actions.Struggle ? 'Struggle' : 'Idle', 0.25);
    return true;
  }
  function setTarget(n, x, y, z) { n.tx = x; n.ty = y; n.tz = z; }
  function release(n, drop = false) {
    if (n.state !== ST.HELD) return;
    /* 최근 0.1초 동안 움직인 속도 */
    let vx = 0, vy = 0, vz = 0;
    if (!drop) {
      const now = n.hist[(n.hk + HIST - 1) % HIST];
      let old = null;
      for (let k = 2; k <= HIST; k++) {
        const h = n.hist[(n.hk + HIST - k) % HIST];
        if (h.t < 0) break;
        old = h;
        if (now.t - h.t >= 0.1) break;
      }
      if (old && now.t - old.t > 1e-3) {
        const it = 1 / (now.t - old.t);
        vx = (now.x - old.x) * it; vy = (now.y - old.y) * it; vz = (now.z - old.z) * it;
      }
      const hs = Math.hypot(vx, vz);
      if (hs > THROW_MAX) { vx *= THROW_MAX / hs; vz *= THROW_MAX / hs; }
      vy = Math.max(-6, Math.min(10, vy)) + THROW_UP;
    }
    n.vx = vx; n.vy = vy; n.vz = vz;
    n.cx = n.x; n.cy = n.y + COM; n.cz = n.z;    // 몸 중심 = 회전 중심
    const hs = Math.hypot(vx, vz);
    if (hs > 0.8) n.rot = Math.atan2(vx, vz);      // 날아가는 쪽으로 앞구르기
    n.body.rotation.set(0, 0, 0);
    n.spinX = Math.min(11, hs * 0.9) + (hs > 0.8 ? 1.5 : 0);
    n.spinZ = rr(-1.5, 1.5) * (hs > 0.8 ? 1 : 0.3);
    n.react = 0; n.knockClip = false;
    n.state = ST.FLYING;
    if (!drop) { bystanders(n); emit('throw', n); }
  }
  function startLying(n, fromClip = false) {
    n.state = ST.LYING; n.timer = 0;
    const clip = !!n.actions.GetUp;
    /* GetUp 클립의 누운 자세는 발이 원점, 몸통은 등 뒤(−Z)로 0.93 m. 코드로 눕힌 몸(가운데가 원점)에서
       넘어갈 땐 발 위치를 앞(+Z)으로 옮겨 몸이 제자리에 있게 한다 */
    if (clip && !fromClip) { const off = 0.93 * S * n.sc; n.fx = n.cx + Math.sin(n.rot) * off; n.fz = n.cz + Math.cos(n.rot) * off; }
    else { n.fx = n.cx; n.fz = n.cz; }
    /* GetUp 클립은 누운 자세에서 시작하므로 몸은 똑바로 세우고 클립에 맡긴다. 없으면 직접 눕힌다(등을 대고) */
    n.rxT = nearAngle(n.body.rotation.x, clip ? 0 : -Math.PI / 2);
    n.rzT = nearAngle(n.body.rotation.z, 0);
    n.rx0 = n.body.rotation.x; n.rz0 = n.body.rotation.z;
    n.cy0 = n.cy;
    if (clip) { play(n, 'GetUp', 0.3); n.cur.setEffectiveTimeScale(0); }
    else play(n, 'Idle', 0.3);
  }
  function finishGetUp(n) {
    n.body.rotation.set(0, 0, 0);
    n.x = n.fx; n.z = n.fz; n.y = groundY(n.x, n.z);
    const react = n.react;
    n.react = 0;
    if (n.panicT > 1) { startFlee(n, false); return; }   // 소동 중이면 화낼 틈 없이 도망
    if (react === ST.STOMP) {
      n.state = ST.STOMP; n.timer = STOMP_TIME; setAnger(n, true);
      play(n, n.actions.Stomp ? 'Stomp' : 'Idle', 0.3);
    } else if (react === ST.CHASE) {
      n.state = ST.CHASE; n.timer = CHASE_TIME; n.close = false; setAnger(n, true);
    } else toIdle(n);
  }
  function endAnger(n) { toIdle(n); }
  /* 위치가 깨진(NaN) 사람은 길가로 되돌려 다시 걷게 한다 */
  function recoverNpc(n) {
    releaseSeat(n);
    n.vx = n.vy = n.vz = 0; n.react = 0; n.panicT = 0; n.yielding = false;
    n.body.rotation.set(0, 0, 0);
    setAnger(n, false);
    if (n.actor) { n.state = ST.ACTOR; n.y = groundY(n.x = Number.isFinite(n.x) ? n.x : 0, n.z = Number.isFinite(n.z) ? n.z : 0); play(n, 'Idle', 0.2); }   // [village]
    else if (n.bar != null && stalls[n.bar] && stalls[n.bar].bar) {
      const b = stalls[n.bar].bar;
      n.x = b.x; n.z = b.z; n.rot = b.rotY; n.y = groundY(n.x, n.z);
      n.state = ST.BAR; n.timer = rr(1, 4); play(n, 'Idle', 0.2);
    } else {
      n.z = rr(zMin, zMax);
      n.x = clampX(pathX(n.z) + n.side * sideOff(n.z, n));
      n.y = groundY(n.x, n.z);
      n.rot = n.dir > 0 ? 0 : Math.PI;
      startWanderLeg(n); play(n, 'Walk', 0.2);
    }
    n.fx = n.x; n.fz = n.z; n.cy = n.y;
  }

  /* ════ 거리의 삶: 말풍선 · 소동 · 구경꾼 · 수다 · 술집 주인 ════ */

  /* ── 말풍선 (풀 8개, 각자 캔버스 하나 — 글자를 바꿀 때만 다시 그린다) ── */
  const bubbles = [];
  for (let k = 0; k < BUBBLE_MAX; k++) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 72;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(1.6, 0.45, 1); sp.renderOrder = 20; sp.visible = false;
    scene.add(sp);
    bubbles.push({ sp, cv, ctx: cv.getContext('2d'), tex, mat, n: null, t: 0 });
  }
  function drawBubble(b, text, color) {
    const c = b.ctx;
    c.clearRect(0, 0, 256, 72);
    c.font = '800 30px Pretendard, system-ui, sans-serif';
    const tw = c.measureText(text).width;
    if (tw > 210) c.font = `800 ${Math.max(16, Math.floor(30 * 210 / tw))}px Pretendard, system-ui, sans-serif`;   // 긴 대사는 글자를 줄인다
    const w = Math.min(244, Math.min(tw, 210) + 34), x0 = 128 - w / 2;
    c.fillStyle = 'rgba(255,250,240,0.96)'; c.strokeStyle = 'rgba(40,24,16,0.85)'; c.lineWidth = 4;
    c.beginPath();
    c.moveTo(x0 + 16, 4); c.lineTo(x0 + w - 16, 4); c.quadraticCurveTo(x0 + w - 2, 4, x0 + w - 2, 20);
    c.lineTo(x0 + w - 2, 38); c.quadraticCurveTo(x0 + w - 2, 54, x0 + w - 16, 54);
    c.lineTo(140, 54); c.lineTo(128, 68); c.lineTo(118, 54);              // 꼬리
    c.lineTo(x0 + 16, 54); c.quadraticCurveTo(x0 + 2, 54, x0 + 2, 38);
    c.lineTo(x0 + 2, 20); c.quadraticCurveTo(x0 + 2, 4, x0 + 16, 4);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = color || '#2a1a10'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 128, 30);
    b.tex.needsUpdate = true;
  }
  function say(n, text, life = 1.6, color = null) {
    if (n.dist > BUBBLE_DIST) return;              // 멀리서는 안 보이니 그리지 않는다
    let b = n.bubble;
    if (!b) {
      let best = null;
      for (const q of bubbles) { if (!q.n) { best = q; break; } if (!best || q.t < best.t) best = q; }
      b = best;
      if (b.n) b.n.bubble = null;
      b.n = n; n.bubble = b;
    }
    drawBubble(b, text, color);
    b.t = life; b.sp.visible = true; b.mat.opacity = 1;
  }
  function updateBubbles(dt) {
    for (const b of bubbles) {
      const n = b.n;
      if (!n) continue;
      b.t -= dt;
      if (b.t <= 0 || n.dist > BUBBLE_DIST + 5) { b.sp.visible = false; n.bubble = null; b.n = null; continue; }
      const lying = isLying(n.state) || n.state === ST.FLYING;
      const h = lying ? 1.1 : n.state === ST.SEATED || n.state === ST.SIT_DOWN ? 2.15 : (n.bubbleH || 2.6);   // bubbleH: 배우가 낮춰 달 때 (서빙 아가씨)
      b.sp.position.set(n.x, n.y + h + (n.anger.visible ? 0.3 : 0), n.z);
      b.mat.opacity = Math.min(1, b.t / 0.3);
    }
  }
  const pickOne = arr => arr[Math.floor(rnd() * arr.length)];

  /* 어느 상태에서든 평소로 돌아갈 때 (술집 주인은 카운터로, 겁먹은 손님은 계속 도망) */
  function toIdle(n) {
    setAnger(n, false);
    n.body.rotation.set(0, 0, 0);
    if (n.actor) { n.state = ST.ACTOR; play(n, 'Idle', 0.3); return; }   // [village] 배우는 대본으로 돌아간다
    if (n.guard) { n.state = guardWant ? ST.GUARD : ST.GUARD_LEAVE; play(n, guardWant ? 'Run' : 'Walk', 0.3); return; }
    if (n.fight && n.fight.active) { n.state = ST.FIGHT; n.arrived = true; setAnger(n, true); play(n, 'Idle', 0.3); return; }
    if (n.panicT > 1) { startFlee(n, false); return; }
    if (n.bar >= 0) { n.state = ST.BAR_RETURN; play(n, 'Walk', 0.3); return; }
    n.state = ST.PAUSE; n.timer = rr(0.6, 1.4);
    play(n, 'Idle', 0.4);
  }

  /* ── 소동 (총·폭탄·폭발) → 비명 지르고 반대쪽으로 도망 ── */
  function startFlee(n, scream) {
    releaseSeat(n);
    n.body.rotation.set(0, 0, 0);
    setAnger(n, false);
    n.react = 0; n.yielding = false; n.chatG = null; n.cheerIn = -1;
    n.state = ST.FLEE;
    play(n, n.actions.Run ? 'Run' : 'Walk', 0.2);
    if (scream && rnd() < 0.6) say(n, pickOne(SCREAMS), 1.4, '#c0281e');
  }
  function alarm(pos, radius = 0, kind = 'shot') {
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return 0;
    const r = radius || ALARM_R[kind] || ALARM_R.shot;
    let n0 = 0;
    for (const n of npcs) {
      if (n.guard || n.actor || n.off || !(Math.hypot(n.x - pos.x, n.z - pos.z) <= r)) continue;   // 경비병은 도망가지 않는다
      n.panicX = pos.x; n.panicZ = pos.z;
      n.panicT = Math.max(n.panicT, rr(6, 10));
      n0++;
      const st = n.state;
      if (st === ST.HELD || st === ST.FLYING || isLying(st)) continue;   // 일어나면 도망간다
      if (st === ST.FLEE) { if (rnd() < 0.15) say(n, pickOne(SCREAMS), 1.2, '#c0281e'); continue; }
      startFlee(n, true);
    }
    return n0;
  }

  /* ── 구경꾼: 누가 맞거나 넘어지면 근처 사람이 멈춰서 웃거나 항의한다 ── */
  function bystanders(victim, cause) {
    if (cause === 'car') { rideLaugh(victim); return; }
    let k = 0;
    for (const n of npcs) {
      if (k >= 3) break;
      if (n === victim || n.bar >= 0 || (n.state !== ST.WANDER && n.state !== ST.PAUSE)) continue;
      if (Math.hypot(n.x - victim.x, n.z - victim.z) > WATCH_R || rnd() > 0.65) continue;
      n.state = ST.WATCH; n.timer = rr(1.8, 2.4); n.watchV = victim; n.yielding = false;
      n.watchKind = rnd() < 0.55 ? 0 : 1;
      play(n, n.watchKind === 0 ? 'Cheers' : (n.actions.Stomp ? 'Stomp' : 'Idle'), 0.25);
      if (k < 2) say(n, pickOne(n.watchKind === 0 ? LAUGHS : PROTESTS), 1.8);
      k++;
    }
  }

  /* ── 박장대소: 탈것에 치이면 16 m 안 사람들이 배를 잡고 웃는다 (걷던 사람은 멈춰서, 앉은 사람은 말풍선만) ── */
  function rideLaugh(victim) {
    let k = 0, b = 0;
    for (const n of npcs) {
      if (k >= 5) break;
      if (n === victim || n.off || n.guard || n.actor || n.bar >= 0) continue;
      if (!(Math.hypot(n.x - victim.x, n.z - victim.z) <= 16)) continue;
      if (n.state === ST.WANDER || n.state === ST.PAUSE || n.state === ST.CHAT || n.state === ST.WATCH) {
        if (rnd() > 0.85) continue;
        n.state = ST.WATCH; n.timer = rr(2.2, 3.2); n.watchV = victim; n.yielding = false; n.watchKind = 2;
        n.laughPh = rnd() * 6;
        play(n, 'Cheers', 0.2, STAND.laugh);   // 서 있으니 배를 잡고 웃는 몸짓
      } else if (n.state === ST.SEATED) {
        if (rnd() > 0.6) continue;
      } else continue;
      if (b < 3) { setTimeout(() => { if (!n.off && !isLying(n.state)) say(n, pickOne(RIDE_LAUGHS), 1.9, '#b8860b'); }, 120 + b * 260); b++; }
      k++;
    }
  }

  /* ── 수다: 길가에서 2~3명이 모여 잠깐 이야기한다 (동시에 최대 2무리) ── */
  const groups = [];
  for (let k = 0; k < 2; k++) groups.push({ active: false, m: [null, null, null], mN: 0, t: 0, talk: 0, cx: 0, cz: 0 });
  let chatClock = rr(3, 6);
  function chatScheduler(dt, px, pz) {
    chatClock -= dt;
    if (chatClock <= 0) {
      chatClock = rr(3, 6);
      let g = null;
      for (const q of groups) if (!q.active) { g = q; break; }
      const a = npcs[Math.floor(rnd() * nWalkers)];
      if (g && a && a.state === ST.WANDER && !a.yielding) {   // 플레이어 근처가 아니라 맵 어디서든 모인다
        g.mN = 0; g.m[g.mN++] = a;
        const want = rnd() < 0.5 ? 2 : 1;
        for (let i = 0; i < nWalkers && g.mN <= want; i++) {
          const b = npcs[i];
          if (b !== a && b.state === ST.WANDER && !b.yielding && Math.hypot(b.x - a.x, b.z - a.z) < 7) g.m[g.mN++] = b;
        }
        if (g.mN >= 2) {
          let cx = 0, cz = 0;
          for (let i = 0; i < g.mN; i++) { cx += g.m[i].x; cz += g.m[i].z; }
          cx /= g.mN; cz /= g.mN;
          /* 길 한가운데는 피하고 길가로 */
          const rx = pathX(cz), side = Math.sign(cx - rx) || a.side;
          if (Math.abs(cx - rx) < roadHalf + 1) cx = rx + side * (roadHalf + 1.3);
          for (const s of stalls) {
            const dx = cx - s.x, dz = cz - s.z, d = Math.hypot(dx, dz);
            if (d < 3 && d > 1e-3) { cx = s.x + dx / d * 3; cz = s.z + dz / d * 3; }
          }
          cx = clampX(cx);
          g.cx = cx; g.cz = cz; g.t = rr(8, 15) + 3; g.talk = 1.5; g.active = true;
          const a0 = rnd() * Math.PI * 2;
          for (let i = 0; i < g.mN; i++) {
            const n = g.m[i], an = a0 + i * Math.PI * 2 / g.mN;
            n.state = ST.CHAT; n.chatG = g; n.arrived = false;
            n.fromX = cx + Math.cos(an) * 0.75; n.fromZ = cz + Math.sin(an) * 0.75;   // 설 자리
            play(n, 'Walk', 0.3);
          }
        }
      }
    }
    for (const g of groups) {
      if (!g.active) continue;
      g.t -= dt; g.talk -= dt;
      let live = 0;
      for (let i = 0; i < g.mN; i++) if (g.m[i].state === ST.CHAT && g.m[i].chatG === g) live++;
      if (g.t <= 0 || live < 2) {
        for (let i = 0; i < g.mN; i++) {
          const n = g.m[i];
          if (n.state === ST.CHAT && n.chatG === g) { n.chatG = null; startWanderLeg(n); play(n, 'Walk', 0.4); }
          g.m[i] = null;
        }
        g.active = false; g.mN = 0;
        continue;
      }
      if (g.talk <= 0) {
        g.talk = rr(1.8, 3.2);
        const n = g.m[Math.floor(rnd() * g.mN)];
        if (n.state === ST.CHAT && n.arrived) { say(n, rnd() < 0.6 ? '…' : pickOne(CHATS), 1.6); n.talkT = 1.6; }
      }
    }
  }
  /* 수다 몸짓: 고개를 끄덕·돌리고 말할 땐 손을 든다 */
  function chatPose(n, t) {
    n.procDirty = true;
    const b = n.bones, ph = n.idx * 2.3;
    if (b.head) { b.head.rotation.y += Math.sin(t * 0.9 + ph) * 0.3; b.head.rotation.x += Math.sin(t * 2.1 + ph) * 0.08; }
    if (n.talkT > 0) {
      if (b.armR) b.armR.rotation.z -= 0.55 + Math.sin(t * 4 + ph) * 0.3;
      if (b.foreR) b.foreR.rotation.x += 0.6 + Math.sin(t * 5 + ph) * 0.3;
    }
  }
  /* [tavern] 배우 몸짓: carry = 오른손에 잔을 들고 앞으로 받쳐 든다, bow = 살짝 무릎 굽혀 인사 */
  function actorPose(n) {
    n.procDirty = true;
    const b = n.bones, c = n.carry, w = n.bow;
    if (c > 0) {
      if (b.armR) { b.armR.rotation.x -= 0.32 * c; b.armR.rotation.z += 0.12 * c; }
      if (b.foreR) b.foreR.rotation.x -= 1.35 * c;
    }
    if (w > 0) {
      if (b.spine) b.spine.rotation.x += 0.22 * w;
      if (b.chest) b.chest.rotation.x += 0.18 * w;
      if (b.head) b.head.rotation.x += 0.25 * w;
      if (b.legL) b.legL.rotation.x += 0.12 * w;
      if (b.armL) b.armL.rotation.x -= 0.25 * w;
    }
  }
  /* 술집 주인 몸짓: 오른손으로 카운터를 닦는다 */
  function wipePose(n, t) {
    n.procDirty = true;
    const b = n.bones;
    if (b.armR) { b.armR.rotation.x -= 0.9; b.armR.rotation.z += Math.sin(t * 5 + n.idx) * 0.3; }
    if (b.foreR) b.foreR.rotation.x += 0.7 + Math.cos(t * 5 + n.idx) * 0.3;
    if (b.head) b.head.rotation.x += 0.25;
  }

  /* 술집 주인이 맥주를 내준다 (tavern.js 가 부른다) */
  function barkeeperServe(si) {
    for (const n of npcs) {
      if (n.bar !== si) continue;
      if (n.state !== ST.BAR && n.state !== ST.BAR_RETURN && n.state !== ST.SERVE) return false;
      n.state = ST.SERVE; n.timer = 1.6; n.serveTo = null;
      play(n, 'Cheers', 0.2, STAND.offer);       // 잔을 들어 내미는 동작 (서 있으니 앞으로 내민다)
      say(n, '여기 있어요!', 1.8);
      return true;
    }
    return false;
  }

  /* ════ GTA 식 이벤트용 (events.js 가 부른다): 경비병 · 술집 싸움 · 음유시인 ════ */
  const emit = (kind, n) => { if (n && n.noAggro) return; if (api.onAggression) api.onAggression(kind, n); };
  const isDriving = () => { const r = getRide ? getRide() : null; return !!(r && r.driving); };

  /* ── 경비병 (풀 4명, 필요할 때만 만든다) ── */
  const guardSrc = sources.find(q => /guard/.test(q.file)) || sources[0];
  const guards = [];
  let guardWant = false;
  const spearMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.8 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.35, metalness: 0.7 });
  const spearGeo = new THREE.CylinderGeometry(0.025, 0.03, 2.3, 6);
  const bladeGeo = new THREE.ConeGeometry(0.07, 0.38, 4);
  const axeGeo = new THREE.BoxGeometry(0.02, 0.18, 0.26);
  function spawnGuard(x, z, rot = 0) {
    let n = guards.find(g => g.off);
    if (!n) {
      if (guards.length >= GUARD_MAX) return null;
      n = makeNPC(guardSrc, npcs.length, false);
      n.guard = true;
      /* 미늘창 자리표시: 몸(body)에 붙여서 넘어지면 같이 넘어진다. 오른손 옆에 세워 든다 */
      const pole = new THREE.Mesh(spearGeo, spearMat); pole.position.set(-0.36, 0.25, 0.12);
      const tip = new THREE.Mesh(bladeGeo, bladeMat); tip.position.y = 1.33;
      const axe = new THREE.Mesh(axeGeo, bladeMat); axe.position.set(0, 1.0, 0.12);
      pole.add(tip, axe); pole.castShadow = tip.castShadow = true;
      n.body.add(pole); n.meshes.push(pole);
      guards.push(n); npcs.push(n);
    }
    n.off = false; n.root.visible = true;
    n.x = x; n.z = z; n.y = groundY(x, z); n.rot = rot; n.body.rotation.set(0, 0, 0);
    n.state = guardWant ? ST.GUARD : ST.GUARD_LEAVE; n.timer = rr(0.5, 2);
    n.react = 0; n.panicT = 0; setAnger(n, false);
    play(n, guardWant ? 'Run' : 'Walk', 0);
    n.root.position.set(n.x, n.y, n.z); n.root.rotation.y = n.rot;
    return n;
  }
  function setGuardChase(on) {
    guardWant = on;
    for (const g of guards) {
      if (g.off) continue;
      if (on && g.state === ST.GUARD_LEAVE) { g.state = ST.GUARD; play(g, 'Run', 0.3); }
      else if (!on && g.state === ST.GUARD) { g.state = ST.GUARD_LEAVE; play(g, 'Walk', 0.3); }
    }
  }
  function guardInfo() {   // { count, nearest } — 할당 없이 숫자만
    let c = 0, nd = 1e9;
    for (const g of guards) if (!g.off) { c++; if (g.dist < nd) nd = g.dist; }
    guardStat.count = c; guardStat.nearest = nd;
    return guardStat;
  }
  const guardStat = { count: 0, nearest: 1e9 };

  /* ── 술집 싸움 (한 번에 하나) ── */
  const fight = { active: false, isFight: true, a: null, b: null, t: 0, cx: 0, cz: 0, si: -1, cheer: 0 };
  function startFight(si = -1) {
    if (fight.active) return -1;
    /* 앉은 손님이 둘 이상인 가판대 */
    let pick = -1, tries = 0;
    while (tries++ < 12) {
      const k = si >= 0 ? si : Math.floor(rnd() * stalls.length);
      let c = 0;
      for (const seat of stalls[k].seats) if (seat.owner && npcs.includes(seat.owner) && seat.owner.state === ST.SEATED) c++;
      if (c >= 2) { pick = k; break; }
      if (si >= 0) break;
    }
    if (pick < 0) return -1;
    const s = stalls[pick];
    let a = null, b = null;
    for (const seat of s.seats) {
      const o = seat.owner;
      if (o && npcs.includes(o) && o.state === ST.SEATED) { if (!a) a = o; else if (!b) b = o; }
    }
    /* 테이블에서 길 쪽으로 조금 나온 자리에서 붙는다 */
    let ux = s.x - (s.bar ? s.bar.x : s.x), uz = s.z - (s.bar ? s.bar.z : s.z - 1);
    const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    fight.cx = s.x + ux * 2.7; fight.cz = s.z + uz * 2.7;
    fight.active = true; fight.a = a; fight.b = b; fight.t = FIGHT_TIME; fight.si = pick; fight.cheer = 1;
    for (const [n, foe, sg] of [[a, b, 1], [b, a, -1]]) {
      releaseSeat(n);
      n.fight = fight; n.foe = foe; n.state = ST.FIGHT; n.timer = rr(1, 2);
      n.fromX = fight.cx - uz * 0.55 * sg; n.fromZ = fight.cz + ux * 0.55 * sg;   // 서로 마주 볼 자리
      n.arrived = false; setAnger(n, true);
      play(n, 'Walk', 0.3);
    }
    say(a, pickOne(FIGHT_START), 1.8);
    gather(fight, fight.cx, fight.cz, 2.8, 5, false);
    return pick;
  }
  function endFight() {
    if (!fight.active) return;
    fight.active = false;
    for (const n of [fight.a, fight.b]) if (n && n.fight === fight) { n.fight = null; n.foe = null; if (n.state === ST.FIGHT) toIdle(n); }
  }
  /* 싸움 주먹: 상대를 휘청이게 하거나(70%) 넘어뜨린다 */
  function fightHit(n, foe) {
    let dx = foe.x - n.x, dz = foe.z - n.z;
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    n.punchAnim = 0.28;
    if (n.fight && n.fight.brawl) {   // [social] 취객 주먹다짐: 맷집 게이지가 닳다가 넘어진다
      takeHit(foe, rr(16, 30), dx * 3, 2, dz * 3, 'brawl');
      if (rnd() < 0.35) say(n, pickOne(FIGHT_HIT), 1.3);
      return;
    }
    if (rnd() < 0.3) knockVel(foe, dx * 3, 2, dz * 3, 'fight');
    else stagger(foe, dx, dz, 'fight');
    if (rnd() < 0.35) say(n, pickOne(FIGHT_HIT), 1.3);
  }
  /* 싸움 자세: 두 주먹을 들고, 칠 때 오른손을 뻗는다 */
  function jabPose(n, t) {
    n.procDirty = true;
    const b = n.bones, bob = Math.sin(t * 6 + n.idx) * 0.08;
    if (b.armL) { b.armL.rotation.x -= 1.1 + bob; b.armL.rotation.z += 0.35; }
    if (b.foreL) b.foreL.rotation.x -= 1.5;
    const ext = n.punchAnim > 0 ? Math.sin((0.28 - n.punchAnim) / 0.28 * Math.PI) : 0;
    if (b.armR) { b.armR.rotation.x -= 1.1 - bob + ext * 0.45; b.armR.rotation.z -= 0.35; }
    if (b.foreR) b.foreR.rotation.x -= 1.5 * (1 - ext);
  }

  /* ── 구경꾼 모으기 (싸움·공연 둘레에 반원/원으로 선다) ── */
  function gather(obj, cx, cz, r, max, semi, faceRot = 0) {
    let k = 0;
    const slots = Math.min(max, 6);
    for (let i = 0; i < nWalkers && k < slots; i++) {
      const n = npcs[i];
      if (n.state !== ST.WANDER && n.state !== ST.PAUSE) continue;
      if (n === bard.n || Math.hypot(n.x - cx, n.z - cz) > GATHER_R) continue;
      const an = semi ? faceRot + (k / Math.max(1, slots - 1) - 0.5) * 2.1 : (k / slots) * Math.PI * 2 + rnd() * 0.3;
      /* semi: faceRot 방향(공연자가 보는 쪽)으로 펼친 반원 */
      n.fromX = cx + Math.sin(an) * r; n.fromZ = cz + Math.cos(an) * r;
      n.state = ST.GATHER; n.gatherC = obj; n.arrived = false; n.gx = cx; n.gz = cz;
      play(n, 'Walk', 0.3);
      k++;
    }
    return k;
  }

  /* ── 음유시인 공연 ── */
  const bard = { active: false, n: null, si: -1, x: 0, z: 0, face: 0, t: 0, phase: 0, playing: false };
  function startBard(si = -1) {
    if (bard.active) return -1;
    const n = npcs.find(q => q.bar < 0 && !q.guard && /bard/.test(q.model) && (q.state === ST.WANDER || q.state === ST.PAUSE));
    if (!n) return -1;
    /* 가장 가까운 가판대(또는 지정) 앞, 길 쪽 */
    let k = si;
    if (k < 0) { let bd = 1e9; stalls.forEach((s, i) => { const d = Math.hypot(s.x - n.x, s.z - n.z); if (d < bd) { bd = d; k = i; } }); }
    const s = stalls[k];
    let ux = s.x - (s.bar ? s.bar.x : s.x), uz = s.z - (s.bar ? s.bar.z : s.z - 1);
    const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    bard.active = true; bard.n = n; bard.si = k; bard.phase = 0; bard.playing = false; bard.t = 0;
    bard.x = s.x + ux * 3.4; bard.z = s.z + uz * 3.4; bard.face = Math.atan2(ux, uz);
    n.state = ST.BARD_GO; n.fromX = bard.x; n.fromZ = bard.z; n.chatG = null;
    play(n, 'Walk', 0.3);
    return k;
  }
  function endBard() {
    if (!bard.active) return;
    bard.active = false; bard.playing = false;
    const n = bard.n; bard.n = null;
    if (n && (n.state === ST.BARD_GO || n.state === ST.BARD_PLAY)) toIdle(n);
  }
  /* 류트 치는 몸짓: 왼손은 목을 잡고, 오른손으로 줄을 튕긴다 */
  function strumPose(n, t) {
    n.procDirty = true;
    const b = n.bones;
    if (b.armL) { b.armL.rotation.x -= 0.9; b.armL.rotation.z += 0.5; }
    if (b.foreL) b.foreL.rotation.x -= 0.9;
    if (b.armR) { b.armR.rotation.x -= 0.45; b.armR.rotation.z -= 0.25; }
    if (b.foreR) b.foreR.rotation.x -= 1.0 + Math.sin(t * 11) * 0.28;
    if (b.head) { b.head.rotation.x += 0.12; b.head.rotation.y += Math.sin(t * 1.3) * 0.2; }
  }

  /* ════ [social] 사회생활: 술자리 건배 · 취기 · 말다툼 → 주먹다짐 · 화해 · 팔씨름 · 춤 · 커플 산책 · 인사 · 밤잠 ════
     전부 타이머로 돌고, 사람 고르기(O(n))는 몇 초에 한 번만 한다. 매 프레임은 손님당 숫자 몇 개만 갱신.
     동시에: 취객 싸움 ≤ 2, 말다툼 ≤ 2, 건배 ≤ 3, 춤판 ≤ 2, 팔씨름 1, 커플 ≤ 3, 의자에서 자는 사람 ≤ SLEEP_MAX.
     손님끼리 생긴 일(brawl·trip)은 수배 ★ 를 올리지 않는다 (emit 은 플레이어 행동에만). */
  const SLEEP_MAX = 4, COUPLE_MAX = 3;
  const TOASTS = ['건배!', '상호왕국을 위하여!', '임금님을 위하여!', '위하여!', '쭉 들이켜!'];
  const SONGS = ['♪ 라랄라~', '♪ 술이 좋아~', '♫ 상호왕국 만세~', '♪ 둥가둥가~', '♫ 오늘 밤은 안 자~'];
  const INSULTS = ['내 술 쏟았잖아!', '뭐라고 이 양배추야!', '눈을 어디 두고 다녀?', '이 감자 같은 놈!', '너 방금 밀었지?', '이 순무 머리야!', '어디서 굴러온 당근이야!'];
  const REPLIES = ['뭐야?!', '네가 먼저 부딪쳤잖아!', '이 양파 같은 게!', '한번 해보자는 거냐?', '누가 양배추래!'];
  const PARTING = ['흥! 오늘은 봐준다', '에잇, 관두자', '취했구먼…', '흥!'];
  const MAKEUP = ['미안하네 친구…', '내가 취했었나 봐', '우린 친구잖아!', '내가 한 잔 살게!'];
  const WIN = ['내가 이겼다!', '하하 약골이구먼!', '어림없지!'];
  const LOSE = ['으으 분하다!', '다시 해!', '반칙이야!'];
  const ARM_CROWD = ['힘내!', '버텨!', '조금만 더!', '우와!', '넘겨라!'];
  const GREET_DAY = ['좋은 아침!', '안녕하시오!', '날씨 좋네!', '잘 지내나?'];
  const GREET_NIGHT = ['좋은 밤 되게', '조심히 들어가!', '밤이 깊었네'];
  const REFILL = ['한 잔 더!', '여기 한 잔 더요!', '술이 비었네!'];
  const SERVE_LINES = ['여기 있소!', '천천히 드시오!', '자, 한 잔!'];
  const BREAK_UP = ['그만! 그만들 해!', '여기서 싸우면 안 돼!', '둘 다 진정해!'];
  const TRIP = ['어이쿠!', '으앗!', '어어어…'];
  const YAWN = ['하아암~', '잘 잤다~', '으으 머리야…'];
  const SLEEP_TALK = ['음냐음냐…', '한 잔만 더…', '임금님 만세… 쿨'];
  const DANCE_LINES = ['♪ 얼씨구!', '♫ 좋다!', '♪ 랄랄라~', '빙글빙글~'];
  const BUMP = ['어이쿠, 미안!', '조심 좀 하게!', '어이쿠!'];
  const WALK_TALK = ['같이 걷세!', '어디 가는 길이오?', '같이 가요~'];

  stalls.forEach((s, i) => { s.idx = i; s.toastCD = rr(2, 8); s.toastT = 0; });
  const barBy = [];
  for (const n of npcs) if (n.bar >= 0) barBy[n.bar] = n;
  /* 처음부터 몇 명은 얼큰하게 취해 있다 */
  for (let i = 0; i < nWalkers; i++) { const n = npcs[i]; n.drunk = n.seat ? rr(0, 0.35) : rnd() < 0.22 ? rr(0.35, 0.8) : 0; }

  const freeWalker = n => !!n && !n.off && n.bar < 0 && !n.guard && !n.actor && (n.state === ST.WANDER || n.state === ST.PAUSE)
    && !n.yielding && n.dist > 2.8 && !n.lead && !n.pal;   // 2.8 m 밖: 플레이어와 대화(F 2.2 m) 중인 사람은 안 데려간다
  const isDown = n => n.state === ST.FLYING || n.state === ST.HELD || isLying(n.state);
  const isNpc = o => !!o && o.mixer !== undefined && o.body !== undefined;
  function sayLater(n, text, delay, color = null) { n.dSay = text; n.dSayT = delay; n.dSayC = color; }
  const tmpSeated = [];
  function seatedAt(s) {
    tmpSeated.length = 0;
    for (const seat of s.seats) { const o = seat.owner; if (isNpc(o) && o.state === ST.SEATED && !o.sleeping) tmpSeated.push(o); }
    return tmpSeated;
  }
  /* 가판대 앞(길 쪽) d m 지점 */
  const frontPt = { x: 0, z: 0, face: 0 };
  function stallFront(s, d) {
    let ux = s.x - (s.bar ? s.bar.x : s.x), uz = s.z - (s.bar ? s.bar.z : s.z - 1);
    const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    frontPt.x = clampX(s.x + ux * d); frontPt.z = Math.max(zMin, Math.min(zMax, s.z + uz * d)); frontPt.face = Math.atan2(ux, uz);
    return frontPt;
  }
  function nearestStall(x, z, maxD = 1e9, filter = null) {
    let best = null, bd = maxD;
    for (const s of stalls) { if (filter && !filter(s)) continue; const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  function walkAt(n, x, z, dt, r, sp) { const s0 = n.speed; n.speed = sp; const ok = walkToward(n, x, z, dt, r); n.speed = s0; return ok; }
  const groundSnap = (n, dt) => { n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12); };

  /* ── 1. 술자리: 같은 테이블이 다 같이 건배, 잔이 비면 주인을 부른다 ── */
  function toast(si) {
    const s = stalls[si];
    if (!s) return false;
    let live = 0; for (const q of stalls) if (q.toastT > 0) live++;
    const m = seatedAt(s);
    if (m.length < 2 || live >= 3) return false;
    s.toastCD = rr(14, 26); s.toastT = 3;
    const lead = m[Math.floor(rnd() * m.length)];
    say(lead, pickOne(TOASTS), 1.8, '#8a4a10');
    for (let k = 0; k < m.length; k++) {
      const o = m[k];
      o.cheerIn = 0.35 + k * 0.05;                 // 거의 동시에 잔을 든다
      o.drunk = Math.min(1, o.drunk + 0.06);
      if (o !== lead) sayLater(o, rnd() < 0.7 ? '건배!' : pickOne(TOASTS), 0.55 + rnd() * 0.4, '#8a4a10');
    }
    return true;
  }
  function requestRefill(n) {
    n.cups = 0;
    const s = n.seat && n.seat.stall, bk = s ? barBy[s.idx] : null;
    if (!bk || bk.off || bk.state !== ST.BAR || bk.dist < 3) return false;   // 플레이어가 주인 앞에 있으면(주문·대화) 방해 안 한다
    say(n, pickOne(REFILL), 1.6);
    bk.state = ST.SERVE; bk.serveTo = n; bk.arrived = false; bk.timer = 14; bk.wiping = false;
    play(bk, 'Walk', 0.3);
    return true;
  }
  function serveWalk(n, dt) {
    const c = n.serveTo;
    n.timer -= dt;
    if (!n.arrived) {
      if ((c.state !== ST.SEATED && c.state !== ST.ARM) || n.timer <= 0) { n.serveTo = null; n.state = ST.BAR_RETURN; play(n, 'Walk', 0.3); }
      else {
        play(n, 'Walk', 0.3);
        if (walkToward(n, c.x, c.z, dt, 1.05)) {
          n.arrived = true; n.timer = 1.8;
          play(n, 'Cheers', 0.2, STAND.offer); say(n, pickOne(SERVE_LINES), 1.6);
          sayLater(c, '고맙소!', 0.9); c.cups = 0;
        }
        pushFromTables(n);
      }
    } else {
      turnTo(n, Math.atan2(c.x - n.x, c.z - n.z), dt);
      if (n.timer <= 0) { n.serveTo = null; n.state = ST.BAR_RETURN; play(n, 'Walk', 0.3); }
    }
    groundSnap(n, dt);
  }
  /* 취해서 발이 꼬여 넘어진다 (구경꾼은 웃는다, 화내지 않음) */
  function trip(n) {
    say(n, pickOne(TRIP), 1.4);
    n.drunk = Math.max(0, n.drunk - 0.08);
    breakPair(n);
    knockVel(n, Math.sin(n.rot) * 2.4, 2.2, Math.cos(n.rot) * 2.4, 'trip');
  }

  /* ── 2. 말다툼 → 주먹다짐 → (말리기) → 가끔 화해 ── */
  const argues = [0, 1].map(() => ({ active: false, a: null, b: null, k: 0, next: 0, force: false, t: 0, spk: null, spkT: 0 }));
  const brawls = [0, 1].map(() => ({ active: false, isFight: true, brawl: true, a: null, b: null, t: 0, cx: 0, cz: 0, si: -1, cheer: 0,
    over: 0, winner: null, breaker: null, hugA: null, hugB: null, hugT: 0 }));
  function bump(a, b) {
    a.bumpCD = b.bumpCD = rr(15, 25);
    if (a.dist < 2.8 || b.dist < 2.8 || rnd() > 0.75 || !startArgue(a, b)) say(a, pickOne(BUMP), 1.4);
  }
  function startArgue(a, b, force = false) {
    const g = argues.find(q => !q.active);
    if (!g || a === b) return false;
    g.active = true; g.a = a; g.b = b; g.k = 0; g.next = 0.4; g.force = force; g.t = 25; g.spk = null; g.spkT = 0;
    for (const n of [a, b]) {
      breakPair(n); releaseSeat(n);
      n.state = ST.ARGUE; n.socG = g; n.arrived = false; n.yielding = false; n.chatG = null; n.bumpCD = 25;
      play(n, 'Walk', 0.3);
    }
    return true;
  }
  function endArgue(g, part) {
    g.active = false;
    const da = rnd() < 0.5 ? -1 : 1;
    for (const n of [g.a, g.b]) {
      if (!n || n.socG !== g) continue;
      n.socG = null;
      if (n.state !== ST.ARGUE) continue;
      setAnger(n, false);
      n.dir = n === g.a ? da : -da;   // 서로 반대쪽으로 걸어간다
      startWanderLeg(n); play(n, 'Walk', 0.4);
      if (part && n === g.b) sayLater(n, pickOne(PARTING), 0.3);
    }
  }
  function startBrawl(a, b, f) {
    f.active = true; f.a = a; f.b = b; f.t = rr(14, 18); f.over = 0; f.winner = null; f.breaker = null; f.hugT = 0; f.hugA = f.hugB = null;
    const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
    let ux = b.x - a.x, uz = b.z - a.z;
    const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    f.cx = cx; f.cz = cz;
    for (const [n, foe, sg] of [[a, b, -1], [b, a, 1]]) {
      n.socG = null; releaseSeat(n); breakPair(n);
      n.fight = f; n.foe = foe; n.state = ST.FIGHT; n.timer = rr(0.6, 1.5);
      n.fromX = cx + ux * 0.55 * sg; n.fromZ = cz + uz * 0.55 * sg;
      n.arrived = false; setAnger(n, true); play(n, 'Walk', 0.3);
    }
    say(a, pickOne(FIGHT_START), 1.6, '#a0281e');
    gather(f, cx, cz, 2.8, 4, false);
    return true;
  }
  function endBrawl(f) {
    f.active = false;
    for (const n of [f.a, f.b]) {
      if (!n || n.fight !== f) continue;
      n.fight = null; n.foe = null;
      n.drunk = Math.max(0, n.drunk - 0.25);   // 한바탕 하고 나면 술이 좀 깬다
      if (n.state === ST.FIGHT) toIdle(n);
    }
    if (rnd() < 0.45) { f.hugA = f.a; f.hugB = f.b; f.hugT = rr(3, 4.5); }   // 넘어진 쪽이 일어날 즈음
  }
  function callBreaker(f) {
    let best = null, bd = 30;
    for (const g of guards) {   // 순찰 중(떠나는) 경비병이 가까우면 경비병이
      if (g.off || g.state !== ST.GUARD_LEAVE) continue;
      const d = Math.hypot(g.x - f.cx, g.z - f.cz); if (d < bd) { bd = d; best = g; }
    }
    if (!best) for (const k of barBy) {   // 아니면 가까운 술집 주인이
      if (!k || k.off || (k.state !== ST.BAR && k.state !== ST.BAR_RETURN) || k.dist < 3) continue;
      const d = Math.hypot(k.x - f.cx, k.z - f.cz); if (d < bd) { bd = d; best = k; }
    }
    if (!best) return null;
    best.state = ST.BREAKUP; best.socG = f; best.arrived = false; best.timer = 15; best.wiping = false;
    play(best, best.actions.Run ? 'Run' : 'Walk', 0.3);
    say(best, '거기 무슨 일이야!', 1.6, '#7a1a10');
    return best;
  }
  function tryHug(a, b) {
    const ok = n => n && !n.off && (n.state === ST.WANDER || n.state === ST.PAUSE) && n.dist > 2.8;
    if (!ok(a) || !ok(b) || Math.hypot(a.x - b.x, a.z - b.z) > 10) return false;
    for (const [n, o] of [[a, b], [b, a]]) { breakPair(n); n.state = ST.HUG; n.hugO = o; n.arrived = false; n.timer = 2.6; play(n, 'Walk', 0.3); }
    sayLater(a, pickOne(MAKEUP), 0.8, '#2f6f3a'); sayLater(b, pickOne(MAKEUP), 2.4, '#2f6f3a');
    return true;
  }

  /* ── 3. 팔씨름 (테이블 건너편끼리) ── */
  const arm = { active: false, loud: true, crowd: ARM_CROWD, a: null, b: null, s: null, t: 0, phase: 0, x: 0, z: 0, winner: null, loser: null };
  function armPair(s) {
    const ok = o => isNpc(o) && o.state === ST.SEATED && !o.sleeping && o.dist > 2.8;
    for (let k = 0; k < 2; k++) {   // 마주 보는 자리(k, k+2) 먼저
      const a = s.seats[k] && s.seats[k].owner, b = s.seats[k + 2] && s.seats[k + 2].owner;
      if (ok(a) && ok(b)) return [a, b];
    }
    const m = seatedAt(s).filter(ok);
    return m.length >= 2 ? [m[0], m[1]] : null;
  }
  function startArm(si = -1, force = false) {
    if (arm.active) return -1;
    let s = null, pr = null;
    if (si >= 0) { s = stalls[si]; pr = s && armPair(s); }
    else for (const k of stalls.map((q, i) => i).sort(() => rnd() - 0.5)) { pr = armPair(stalls[k]); if (pr) { s = stalls[k]; break; } }
    if (!pr && force) {   // 디버그: 플레이어 가까운 가판대 마주 보는 의자에 손님 둘을 앉힌다
      const p = getPlayerPos ? getPlayerPos() : { x: 0, z: 0 };
      s = si >= 0 ? stalls[si] : nearestStall(p.x, p.z);
      if (s && fillSeats(s, [0, 2])) pr = armPair(s);
    }
    if (!pr) return -1;
    const [a, b] = pr;
    arm.active = true; arm.a = a; arm.b = b; arm.s = s; arm.t = rr(4, 7); arm.phase = 1; arm.x = s.x; arm.z = s.z; arm.winner = arm.loser = null;
    for (const n of pr) { n.state = ST.ARM; n.socG = arm; n.cheerIn = -1; play(n, 'Sit', 0.3); }
    say(a, '팔씨름 한판 어때?', 1.8); sayLater(b, '좋지! 덤벼!', 1.3);
    for (const o of seatedAt(s)) { o.cheerIn = rr(0.5, 1.5); sayLater(o, pickOne(ARM_CROWD), rr(2, 4)); }
    gather(arm, s.x, s.z, 3.3, 3, false);
    return s.idx;
  }
  function backToSeat(n) {
    n.body.rotation.set(0, 0, 0); n.socG = null;
    const seat = n.seat;
    if (!seat || seatBroken(seat)) { releaseSeat(n); toIdle(n); return; }
    n.x = seat.x; n.z = seat.z; n.y = seatY(seat, n); n.rot = seat.rotY;
    n.state = ST.SEATED; n.animTimer = rr(1, 2.5); n.cheerIn = -1;
    play(n, 'Sit', 0.35);
  }
  function endArm() {
    arm.active = false;
    for (const n of [arm.a, arm.b]) if (n && n.state === ST.ARM && n.socG === arm) backToSeat(n);
  }
  /* 디버그용: 가판대 s 의 의자 idx 들에 빈자리면 근처 손님을 바로 앉힌다 */
  function fillSeats(s, idxs) {
    for (const k of idxs) {
      const seat = s.seats[k];
      if (!seat || seatBroken(seat)) return false;
      if (seat.owner) { if (isNpc(seat.owner) && seat.owner.state === ST.SEATED) continue; return false; }
      let best = null, bd = 1e9;
      for (let i = 0; i < nWalkers; i++) {
        const n = npcs[i];
        if (!freeWalker(n)) continue;
        const d = Math.hypot(n.x - s.x, n.z - s.z); if (d < bd) { bd = d; best = n; }
      }
      if (!best) return false;
      placeAtSeat(best, seat);
      best.drunk = Math.max(best.drunk, 0.3);
      best.root.position.set(best.x, best.y, best.z); best.root.rotation.y = best.rot;
    }
    return true;
  }

  /* ── 4. 춤: 음유시인이 연주하면 그 앞에서, 밤엔 술집 앞에서 짝지어 빙글빙글 ── */
  const dances = [0, 1].map(() => ({ active: false, cx: 0, cz: 0, t: 0, clock: 0, m: [], bard: false }));
  function startDance(cx, cz, maxN = 4, dur = 20, isBard = false, recruitR = 26) {
    const g = dances.find(q => !q.active);
    if (!g || !Number.isFinite(cx) || !Number.isFinite(cz)) return 0;
    g.m.length = 0;
    for (let i = 0; i < nWalkers && g.m.length < maxN; i++) {
      const n = npcs[i];
      if (freeWalker(n) && n !== bard.n && Math.hypot(n.x - cx, n.z - cz) < recruitR) g.m.push(n);
    }
    if (g.m.length < 2) { g.m.length = 0; return 0; }
    g.active = true; g.cx = cx; g.cz = cz; g.t = dur; g.clock = 0; g.bard = isBard;
    const slots = Math.ceil(g.m.length / 2);
    for (let k = 0; k < g.m.length; k++) {
      const n = g.m[k], an = (k >> 1) / slots * Math.PI * 2 + 0.4, R = slots > 1 ? 1.7 : 0;
      const partner = (k ^ 1) < g.m.length ? g.m[k ^ 1] : null;
      n.pcx = cx + Math.cos(an) * R; n.pcz = cz + Math.sin(an) * R;
      n.dPal = partner; n.dAng0 = (k & 1) ? Math.PI : 0;
      n.fromX = n.pcx + (partner ? Math.cos(n.dAng0) * 0.55 : 0); n.fromZ = n.pcz + (partner ? Math.sin(n.dAng0) * 0.55 : 0);
      breakPair(n);
      n.state = ST.DANCE; n.socG = g; n.arrived = false; n.timer = rr(0.5, 2); n.chatG = null;
      play(n, 'Walk', 0.3);
    }
    return g.m.length;
  }
  function endDance(g) {
    g.active = false;
    for (const n of g.m) {
      if (n.socG !== g) continue;
      n.socG = null; n.dPal = null;
      if (n.state === ST.DANCE) toIdle(n);
    }
    g.m.length = 0;
  }

  /* ── 5. 커플 산책 · 인사 ── */
  function breakPair(n) {
    if (n.lead) { n.lead.pal = null; n.lead = null; }
    if (n.pal) { n.pal.lead = null; n.pal = null; }
  }
  function startCouple() {
    let pairs = 0;
    for (let i = 0; i < nWalkers; i++) if (npcs[i].lead) pairs++;
    if (pairs >= COUPLE_MAX) return false;
    const a = npcs[Math.floor(rnd() * nWalkers)];
    if (!freeWalker(a) || a.state !== ST.WANDER) return false;
    let best = null, bd = 9;
    for (let i = 0; i < nWalkers; i++) {
      const b = npcs[i];
      if (b === a || !freeWalker(b)) continue;
      const d = Math.hypot(b.x - a.x, b.z - a.z); if (d < bd) { bd = d; best = b; }
    }
    if (!best) return false;
    best.lead = a; a.pal = best; best.palT = rr(18, 35);
    best.state = ST.WANDER; best.side = a.side; best.dir = a.dir; best.legLeft = 99;
    play(best, 'Walk', 0.3);
    sayLater(best, pickOne(WALK_TALK), 0.3);
    return true;
  }
  /* 앞사람의 길가 바깥쪽 옆 0.8 m 에서 나란히 걷는다. 다루었으면 true */
  function followLead(n, dt) {
    const L = n.lead;
    n.palT -= dt;
    if (L.off || (L.state !== ST.WANDER && L.state !== ST.PAUSE) || n.palT <= 0) { breakPair(n); startWanderLeg(n); return false; }
    if (L.state === ST.PAUSE) {   // 앞사람이 멈추면 같이 서서 본다
      play(n, 'Idle', 0.3);
      turnTo(n, Math.atan2(L.x - n.x, L.z - n.z), dt);
      return true;
    }
    play(n, 'Walk');
    const fx = Math.sin(L.rot), fz = Math.cos(L.rot);
    const roadS = Math.sign(L.x - pathX(L.z)) || L.side;
    let ox = fz, oz = -fx;
    if (ox * roadS < 0) { ox = -ox; oz = -oz; }
    const tx = clampX(L.x + ox * 0.8 + fx * 0.3), tz = L.z + oz * 0.8 + fz * 0.3;
    const d = Math.hypot(tx - n.x, tz - n.z);
    if (d > 0.15) walkAt(n, tx, tz, dt, 0.05, Math.max(0.4, Math.min(2.6, L.speed + (d - 0.3) * 1.5)));
    else turnTo(n, L.rot, dt);
    pushFromTables(n);
    n.dir = L.dir; n.side = L.side;
    if (rnd() < dt * 0.06) say(rnd() < 0.5 ? n : L, rnd() < 0.5 ? '…' : pickOne(CHATS), 1.5);
    return true;
  }
  function greet(a, b, night) {
    a.greetCD = rr(25, 50); b.greetCD = rr(25, 50);
    const pool = night > 0.5 ? GREET_NIGHT : GREET_DAY;
    say(a, pickOne(pool), 1.6); sayLater(b, pickOne(pool), 0.7);
    a.nodT = b.nodT = 0.9;
  }

  /* ── 6. 사회생활 상태 (updateGrabbed 에서 부른다) ── */
  function socialState(n, dt, t) {
    switch (n.state) {
      case ST.ARGUE: {
        const g = n.socG, o = g && g.active ? (g.a === n ? g.b : g.a) : null;
        if (!o) { n.socG = null; toIdle(n); break; }
        const dx = o.x - n.x, dz = o.z - n.z, d = Math.hypot(dx, dz);
        if (!n.arrived) {
          if (d < 1.3) { n.arrived = true; play(n, 'Idle', 0.3); }
          else { play(n, 'Walk', 0.3); walkToward(n, o.x, o.z, dt, 1.2); }
        } else {
          turnTo(n, Math.atan2(dx, dz), dt * 1.5);
          if (d > 1.9) n.arrived = false;
          play(n, g.spk === n && g.spkT > 0 && n.actions.Stomp ? 'Stomp' : 'Idle', 0.25);
        }
        groundSnap(n, dt);
        break;
      }
      case ST.ARM: {
        const g = n.socG, seat = n.seat;
        if (!g || !g.active || !seat) { backToSeat(n); break; }
        if (g.phase === 2 && g.loser === n) {   // 진 쪽은 벌떡 일어나 발을 구른다
          const fx = seat.x - Math.cos(seat.ang) * 0.4, fz = seat.z - Math.sin(seat.ang) * 0.4, k = Math.min(1, dt * 6);
          n.x += (fx - n.x) * k; n.z += (fz - n.z) * k; n.y += (groundY(fx, fz) - n.y) * k;
          n.body.rotation.x = 0;
          play(n, n.actions.Stomp ? 'Stomp' : 'Idle', 0.25);
        } else {
          n.x = seat.x; n.z = seat.z; n.y = seatY(seat, n);
          n.body.rotation.x = g.phase === 1 ? 0.22 : 0;   // 테이블 쪽으로 몸을 숙인다
        }
        turnTo(n, seat.rotY, dt);
        break;
      }
      case ST.DANCE: {
        const g = n.socG;
        if (!g || !g.active || !g.m.includes(n)) { n.socG = null; n.dPal = null; toIdle(n); break; }
        if (!n.arrived) {
          play(n, 'Walk', 0.3);                                   // 신나서 종종걸음
          if (n.cur) n.cur.setEffectiveTimeScale(1.7);
          if (walkAt(n, n.fromX, n.fromZ, dt, 0.15, 2.2)) { n.arrived = true; play(n, 'Idle', 0.3); }
          pushFromTables(n);
          groundSnap(n, dt);
          break;
        }
        const p = n.dPal;
        if (p && p.state === ST.DANCE && p.socG === g && p.arrived) {   // 짝과 마주 보고 빙글빙글
          const a = n.dAng0 + g.clock * 1.5, k = Math.min(1, dt * 6);
          n.x += (n.pcx + Math.cos(a) * 0.55 - n.x) * k; n.z += (n.pcz + Math.sin(a) * 0.55 - n.z) * k;
          turnTo(n, Math.atan2(n.pcx - n.x, n.pcz - n.z), dt * 3);
        } else turnTo(n, Math.atan2(g.cx - n.x, g.cz - n.z), dt);
        n.timer -= dt;
        if (n.timer <= 0) {
          if (n.curName === 'Cheers') { play(n, 'Idle', 0.3); n.timer = rr(2, 3.5); }
          else { play(n, 'Cheers', 0.3); n.timer = CLIP_LEN.Cheers; }
        }
        if (rnd() < dt * 0.05) say(n, pickOne(DANCE_LINES), 1.4, '#7a3a8a');
        n.y = groundY(n.x, n.z) + Math.abs(Math.sin(g.clock * 7 + n.idx)) * 0.07;
        break;
      }
      case ST.HUG: {
        const o = n.hugO;
        if (!o || o.state !== ST.HUG || o.hugO !== n) { n.hugO = null; toIdle(n); break; }
        const dx = o.x - n.x, dz = o.z - n.z, d = Math.hypot(dx, dz);
        if (!n.arrived) {
          if (d < 0.85) { n.arrived = true; play(n, 'Idle', 0.3); }   // 팔은 hugPose 가 감싼다
          else { play(n, 'Walk', 0.3); walkToward(n, o.x, o.z, dt, 0.8); }
          n.timer -= dt * 0.25;   // 너무 오래 못 만나면 포기
          if (n.timer <= 0) { n.hugO = null; o.hugO = null; startWanderLeg(n); play(n, 'Walk', 0.4); }
        } else {
          turnTo(n, Math.atan2(dx, dz), dt * 2);
          n.timer -= dt;
          if (n.timer <= 0) { n.hugO = null; startWanderLeg(n); play(n, 'Walk', 0.4); }
        }
        groundSnap(n, dt);
        break;
      }
      case ST.BREAKUP: {
        const f = n.socG;
        if (n.arrived) {
          n.timer -= dt;
          if (f) turnTo(n, Math.atan2(f.cx - n.x, f.cz - n.z), dt);
          if (n.timer <= 0) { n.socG = null; toIdle(n); }
        } else if (!f || !f.active || f.breaker !== n || (n.timer -= dt) <= 0) { n.socG = null; toIdle(n); }
        else {
          const cx = (f.a.x + f.b.x) / 2, cz = (f.a.z + f.b.z) / 2;
          play(n, n.actions.Run ? 'Run' : 'Walk', 0.3);
          if (!n.actions.Run && n.cur) n.cur.setEffectiveTimeScale(2);
          walkAt(n, cx, cz, dt, 1.6, 3.4);
          pushFromTables(n);
          if (Math.hypot(cx - n.x, cz - n.z) < 1.7) {
            n.arrived = true; n.timer = 2.6;
            play(n, n.actions.Stomp ? 'Stomp' : 'Idle', 0.25);
            say(n, pickOne(BREAK_UP), 2, '#7a1a10');
            f.over = 2.4; f.winner = null;
            sayLater(f.a, '쳇…', 0.9);
          }
        }
        groundSnap(n, dt);
        break;
      }
    }
  }

  /* 몸짓 */
  function armPose(n, t) {
    n.procDirty = true;
    const b = n.bones, g = n.socG;
    if (!g || g.phase !== 1) return;
    const sh = Math.sin(t * 13 + n.idx) * 0.07, push = Math.sin(t * 0.9 + n.idx) * 0.15;
    if (b.armR) { b.armR.rotation.x -= 1.25 + push; b.armR.rotation.z += 0.15; }
    if (b.foreR) b.foreR.rotation.x -= 0.9 + sh;
    if (b.armL) b.armL.rotation.x -= 0.5;
    if (b.chest) b.chest.rotation.z += sh * 0.6;
    if (b.head) b.head.rotation.x += 0.12;
  }
  function dancePose(n, t, amp) {
    n.procDirty = true;
    const b = n.bones, w = t * 7 + n.idx * 1.3;
    if (b.spine) b.spine.rotation.z += Math.sin(w * 0.5) * 0.14 * amp;
    if (b.head) b.head.rotation.y += Math.sin(w * 0.5 + 1) * 0.25 * amp;
    if (n.curName !== 'Cheers') {   // 건배 클립이 아닐 땐 두 팔을 들고 흔든다
      if (b.armL) b.armL.rotation.z += (0.9 + Math.sin(w) * 0.35) * amp;
      if (b.armR) b.armR.rotation.z -= (0.9 + Math.sin(w + 1) * 0.35) * amp;
    }
    if (b.legL) b.legL.rotation.x -= Math.max(0, Math.sin(w)) * 0.45 * amp;
    if (b.legR) b.legR.rotation.x -= Math.max(0, -Math.sin(w)) * 0.45 * amp;
  }
  function hugPose(n) {
    n.procDirty = true;
    const b = n.bones;
    if (b.armL) { b.armL.rotation.x -= 1.1; b.armL.rotation.z -= 0.3; }
    if (b.armR) { b.armR.rotation.x -= 1.1; b.armR.rotation.z += 0.3; }
  }
  /* 보통 상태용: 졸기 · 기지개 · 인사 끄덕 */
  function socialPose(n, t) {
    n.procDirty = true;
    const b = n.bones;
    if (n.state === ST.SEATED && n.sleeping) {
      if (b.head) b.head.rotation.x += 0.55 + Math.sin(t * 1.3 + n.idx) * 0.06;
      if (b.chest) b.chest.rotation.x += 0.2;
    } else if (n.yawnT > 0) {
      const k = Math.min(1, n.yawnT, 2.4 - n.yawnT);   // 기지개: 두 팔을 쭉
      if (b.armL) b.armL.rotation.z += 2.2 * Math.max(0, k);
      if (b.armR) b.armR.rotation.z -= 2.2 * Math.max(0, k);
      if (b.head) b.head.rotation.x -= 0.3 * Math.max(0, k);
    } else if (n.nodT > 0 && b.head) b.head.rotation.x += Math.sin((0.9 - n.nodT) / 0.9 * Math.PI) * 0.35;
  }

  /* 서서 하는 몸짓 (Idle 위에 덧씌운다, 섞임 w 0..1) — Cheers/Drink 클립이 앉은 자세라서.
     cheer 두 팔 번쩍 흔들며 콩콩 · drink 오른손 잔을 입으로 · offer 잔을 앞으로 내민다 · laugh 배를 잡고 · toast 오른손 잔을 높이
     뼈 축이 모델마다 제각각이라 몸(body) 공간 축으로 돌린다 (pageant.js·festival.js 의 pose 와 같은 방식, 같은 각도 표기):
     팔 [위팔(음수=앞으로 듦), 아래팔(음수=굽힘), 안쪽(음수=옆으로)], spine [앞숙임], head [끄덕(음수=올려다봄)] — 단위 도 */
  const SAX = new THREE.Vector3(1, 0, 0), SAZ = new THREE.Vector3(0, 0, 1);
  const _sq = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
  function rotBody(n, bone, R) {
    if (!bone || !bone.parent) return;
    const qc = _sq[2], qp = _sq[3], qd = _sq[4], qi = _sq[5];
    n.body.getWorldQuaternion(qc);
    bone.parent.getWorldQuaternion(qp);
    qd.copy(qc).multiply(R).multiply(qi.copy(qc).invert());
    qi.copy(qp).invert().multiply(qd).multiply(qp);
    bone.quaternion.premultiply(qi);
  }
  const D2R_ = Math.PI / 180;
  function armBody(n, side, up, fore, inward, w) {
    const b = n.bones, ua = side > 0 ? b.armL : b.armR, la = side > 0 ? b.foreL : b.foreR;
    const qa = _sq[0], qb = _sq[1];
    qa.setFromAxisAngle(SAZ, -side * inward * w * D2R_).multiply(qb.setFromAxisAngle(SAX, up * w * D2R_));
    rotBody(n, ua, qa);
    rotBody(n, la, qa.setFromAxisAngle(SAX, fore * w * D2R_));
  }
  function bendBody(n, bone, deg) { if (bone && deg) rotBody(n, bone, _sq[0].setFromAxisAngle(SAX, deg * D2R_)); }
  function standLayer(n, t) {
    if (n.standUntil && now >= n.standUntil) { n.standUntil = 0; setStand(n, 0, ''); }
    const w = standW(n);
    if (w <= 0) {
      if (!n.standOn) { n.standK = 0; n.body.position.y = COM; }
      return;
    }
    n.procDirty = true;
    const b = n.bones, ph = n.standPh, k = n.standK;
    n.root.updateMatrixWorld(true);
    let hop = 0;
    if (k === STAND.cheer) {
      const wa = Math.sin(t * 9 + ph) * 16;
      bendBody(n, b.chest, -5 * w); bendBody(n, b.head, -12 * w);
      armBody(n, 1, -150 + wa, -25 - wa * 0.6, 14, w);
      armBody(n, -1, -150 - wa, -25 + wa * 0.6, 14, w);
      hop = Math.max(0, Math.sin(t * 7 + ph)) * 0.07 * n.standHop;
    } else if (k === STAND.drink) {
      const u = ((t + ph) % 3.4) / 3.4, sip = u < 0.15 ? 0 : u < 0.3 ? smooth((u - 0.15) / 0.15) : u < 0.55 ? 1 : u < 0.7 ? smooth(1 - (u - 0.55) / 0.15) : 0;
      bendBody(n, b.head, -16 * sip * w);
      armBody(n, -1, -25 - sip * 30, -95 - sip * 35, 8 + sip * 22, w);
    } else if (k === STAND.offer) {
      armBody(n, -1, -70, -20, 6, w);
      bendBody(n, b.head, 6 * w);
    } else if (k === STAND.laugh) {
      armBody(n, 1, -20, -85, 28, w); armBody(n, -1, -20, -85, 28, w);
      bendBody(n, b.head, -10 * w);
    } else if (k === STAND.toast) {
      armBody(n, -1, -150, -25, 6, w);
      bendBody(n, b.head, -8 * w);
    }
    n.body.position.y = COM + hop * w;
  }

  /* ── 매 프레임 (update 끝에서 한 번) ── */
  let toastClock = rr(4, 8), coupleClock = rr(5, 10), provokeClock = rr(10, 18), armClock = rr(30, 50), danceClock = rr(20, 40);
  let nightMode = false, bardDanced = false, bardRetry = 0;
  function socialUpdate(dt, night) {
    const isNight = night > 0.5;
    /* 손님마다: 늦은 말풍선 · 쿨다운 · 취기(딸꾹·노래·비틀·넘어짐·술 깨기) */
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (n.off) continue;
      if (n.dSayT > 0 && (n.dSayT -= dt) <= 0 && !isDown(n)) say(n, n.dSay, 1.6, n.dSayC);
      if (i >= nWalkers) continue;
      if (n.greetCD > 0) n.greetCD -= dt;
      if (n.bumpCD > 0) n.bumpCD -= dt;
      if (n.yawnT > 0) n.yawnT -= dt;
      if (n.nodT > 0) n.nodT -= dt;
      if (n.lead && n.state !== ST.WANDER) breakPair(n);
      if (n.drunk <= 0) continue;
      const st = n.state;
      if (st !== ST.SEATED && st !== ST.ARM) n.drunk = Math.max(0, n.drunk - dt * 0.0035);   // 4~5분이면 깬다
      if (n.drunk > 0.3 && !n.bubble && n.dist < BUBBLE_DIST && (st === ST.WANDER || st === ST.PAUSE || st === ST.SEATED)) {
        if (rnd() < dt * 0.07 * n.drunk) say(n, '딸꾹!', 1.1);
        else if (rnd() < dt * (isNight ? 0.07 : 0.025) * n.drunk) say(n, pickOne(SONGS), 2, '#7a3a8a');
      }
      if (st === ST.WANDER && n.drunk > 0.5 && !n.lead && n.dist < 60 && rnd() < dt * 0.012 * n.drunk) trip(n);
    }

    /* 건배 (밤엔 더 자주, 더 시끄럽게) */
    for (const s of stalls) { if (s.toastCD > 0) s.toastCD -= dt; if (s.toastT > 0) s.toastT -= dt; }
    if ((toastClock -= dt * (isNight ? 1.7 : 1)) <= 0) {
      toastClock = rr(4, 8);
      const s = stalls[Math.floor(rnd() * stalls.length)];
      if (s && s.toastCD <= 0) toast(s.idx);
    }
    /* 커플 산책 */
    if ((coupleClock -= dt) <= 0) { coupleClock = rr(6, 12); startCouple(); }
    /* 취객 시비: 가까운 행인에게 다가가 말다툼 */
    if ((provokeClock -= dt) <= 0) {
      provokeClock = rr(10, 18);
      const a = npcs[Math.floor(rnd() * nWalkers)];
      if (freeWalker(a) && a.drunk > 0.45 && a.bumpCD <= 0) {
        for (let i = 0; i < nWalkers; i++) {
          const b = npcs[i];
          if (b !== a && freeWalker(b) && b.bumpCD <= 0 && Math.hypot(b.x - a.x, b.z - a.z) < 6) { startArgue(a, b); break; }
        }
      }
    }
    /* 말다툼 진행: 서로 4마디 → 취한 만큼 주먹다짐으로 번진다 */
    for (const g of argues) {
      if (!g.active) continue;
      const a = g.a, b = g.b;
      if (a.state !== ST.ARGUE || b.state !== ST.ARGUE || a.socG !== g || b.socG !== g || (g.t -= dt) <= 0) { endArgue(g, false); continue; }
      if (!a.arrived || !b.arrived) continue;
      g.spkT -= dt; g.next -= dt;
      if (g.next > 0) continue;
      if (g.k < 4) {
        const sp = g.k % 2 ? b : a;
        g.spk = sp; g.spkT = 1.1; g.next = 1.35;
        say(sp, pickOne(g.k % 2 ? REPLIES : INSULTS), 1.5, '#a0281e');
        setAnger(sp, true);
        g.k++;
      } else {
        const f = brawls.find(q => !q.active && q.hugT <= 0);
        if (f && rnd() < (g.force ? 1 : 0.3 + (a.drunk + b.drunk) * 0.3)) { g.active = false; startBrawl(a, b, f); }
        else endArgue(g, true);
      }
    }
    /* 주먹다짐 진행: 한쪽이 넘어지면 끝 / 오래가면 술집 주인·경비병이 말린다 / 끝나고 가끔 화해 */
    for (const f of brawls) {
      if (!f.active) { if (f.hugT > 0 && (f.hugT -= dt) <= 0) tryHug(f.hugA, f.hugB); continue; }
      f.t -= dt;
      if (f.over > 0) { if ((f.over -= dt) <= 0) endBrawl(f); continue; }
      const a = f.a, b = f.b;
      if (a.fight !== f || b.fight !== f || a.off || b.off) { endBrawl(f); continue; }
      const ad = isDown(a), bd = isDown(b);
      if (ad !== bd) {
        f.winner = ad ? b : a; f.over = 3.2;
        say(f.winner, pickOne(WIN), 2, '#8a4a10');
        sayLater(ad ? a : b, pickOne(LOSE), 1.6);
      } else if (ad && bd) f.over = 2;
      else if (f.t <= 0 && !f.breaker) {
        f.breaker = callBreaker(f);
        if (!f.breaker) { f.over = 1.5; say(a, pickOne(PARTING), 1.6); }
      } else if (f.t < -15) endBrawl(f);
    }
    /* 팔씨름 */
    if (arm.active) {
      const a = arm.a, b = arm.b;
      if (a.state !== ST.ARM || b.state !== ST.ARM) endArm();
      else if ((arm.t -= dt) <= 0) {
        if (arm.phase === 1) {
          arm.phase = 2; arm.t = 2.8;
          const w = rnd() < 0.5 + (b.drunk - a.drunk) * 0.4 ? a : b, l = w === a ? b : a;   // 덜 취한 쪽이 조금 유리
          arm.winner = w; arm.loser = l;
          play(w, 'Cheers', 0.2); say(w, pickOne(WIN), 2, '#8a4a10'); sayLater(l, pickOne(LOSE), 0.6);
          w.drunk = Math.min(1, w.drunk + 0.05);
        } else endArm();
      }
    } else if ((armClock -= dt) <= 0) { armClock = rr(35, 60); startArm(); }
    /* 춤: 음유시인 연주 중이면 그 앞에서, 밤이면 가끔 플레이어 가까운 술집 앞에서 */
    for (const g of dances) {
      if (!g.active) continue;
      g.clock += dt; g.t -= dt;
      let live = 0;
      for (const m of g.m) if (m.state === ST.DANCE && m.socG === g) live++;
      if (g.t <= 0 || live === 0 || (g.bard && !bard.playing)) endDance(g);
    }
    if (bard.active && bard.playing && !bardDanced) {   // 구경꾼으로 다 뽑혀 갔으면 3초마다 다시 모아 본다
      if ((bardRetry -= dt) <= 0) {
        bardRetry = 3;
        bardDanced = startDance(clampX(bard.x + Math.sin(bard.face) * 5.5), bard.z + Math.cos(bard.face) * 5.5, 4, bard.t + 1, true, 40) > 0;
      }
    } else if (!bard.active) { bardDanced = false; bardRetry = 0; }
    if ((danceClock -= dt) <= 0) {
      danceClock = rr(35, 60);
      const p = getPlayerPos ? getPlayerPos() : null;
      if (night > 0.6 && p) {
        const s = nearestStall(p.x, p.z, 45, q => q.occupied > 0);
        if (s) { const fp = stallFront(s, 4.6); if (startDance(fp.x, fp.z, 4, rr(16, 24))) toast(s.idx); }
      }
    }
    /* 아침: 밤새 놀던 사람들이 하품하며 기지개 */
    if (night > 0.55) nightMode = true;
    else if (nightMode && night < 0.35) {
      nightMode = false;
      let k = 0;
      for (let i = 0; i < nWalkers && k < 5; i++) {
        const n = npcs[i];
        if (!freeWalker(n) || n.dist > BUBBLE_DIST || rnd() < 0.5) continue;
        n.state = ST.PAUSE; n.timer = 2.8; play(n, 'Idle', 0.3); n.yawnT = 2.4;
        sayLater(n, pickOne(YAWN), rnd() * 1.2);
        k++;
      }
    }
  }

  /* 디버그·다른 모듈용 */
  function nearPlayerWalker(exclude = null, from = null, minD = 3) {
    const p = from || (getPlayerPos ? getPlayerPos() : null);
    if (!p) return null;
    let best = null, bd = 1e9;
    for (let i = 0; i < nWalkers; i++) {
      const n = npcs[i];
      if (n === exclude || !freeWalker(n) || n.dist < minD) continue;
      const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  const social = {
    toast(si = -1) {
      const p = getPlayerPos ? getPlayerPos() : { x: 0, z: 0 };
      const s = si >= 0 ? stalls[si] : nearestStall(p.x, p.z);
      if (!s) return false;
      if (seatedAt(s).length < 2) fillSeats(s, [0, 1, 2]);
      s.toastT = 0;
      return toast(s.idx);
    },
    brawl(skipArgue = false) {   // 플레이어 근처 두 사람을 취하게 해 시비 → 싸움
      const a = nearPlayerWalker();
      const b = a && nearPlayerWalker(a, a, 0);
      if (!a || !b) return false;
      if (Math.hypot(b.x - a.x, b.z - a.z) > 8) { b.x = a.x + Math.sin(a.rot) * 1.4; b.z = a.z + Math.cos(a.rot) * 1.4; b.y = groundY(b.x, b.z); }
      a.drunk = b.drunk = 0.85;
      if (skipArgue) { const f = brawls.find(q => !q.active); return f ? startBrawl(a, b, f) : false; }
      return startArgue(a, b, true);
    },
    argue() { const a = nearPlayerWalker(), b = a && nearPlayerWalker(a, a, 0); return !!(a && b) && startArgue(a, b); },
    armwrestle(si = -1) { return startArm(si, true); },
    dance(n = 4) {
      const p = getPlayerPos ? getPlayerPos() : { x: 0, z: 0 };
      const s = nearestStall(p.x, p.z);
      const fp = s ? stallFront(s, 4.6) : { x: p.x + 4, z: p.z };
      return startDance(fp.x, fp.z, n, 20);
    },
    drunk(i, v = 0.9) { const n = npcs[i]; if (!n) return false; n.drunk = Math.max(0, Math.min(1, v)); return n.drunk; },
    trip(i) { const n = npcs[i]; if (!n || n.state !== ST.WANDER) return false; trip(n); return true; },
    couple() { for (let k = 0; k < 20; k++) if (startCouple()) return true; return false; },
    sleep(si = -1) {   // 가까운 가판대 빈 의자에 한 명을 재운다 (낮이면 금방 깬다)
      const p = getPlayerPos ? getPlayerPos() : { x: 0, z: 0 };
      const s = si >= 0 ? stalls[si] : nearestStall(p.x, p.z, 1e9, q => q.seats.some(st => !st.owner && !seatBroken(st)));
      if (!s) return false;
      const k = s.seats.findIndex(st => !st.owner && !seatBroken(st));
      if (k < 0 || !fillSeats(s, [k])) return false;
      const n = s.seats[k].owner;
      n.sleeping = true; n.animTimer = 0.5; n.cheerIn = -1; play(n, 'Sit', 0.3);
      return n.idx;
    },
    status() {
      return {
        drunk: npcs.slice(0, nWalkers).filter(n => n.drunk > 0.3).length,
        sleeping: npcs.filter(n => n.sleeping).length,
        couples: npcs.filter(n => n.lead).length,
        argues: argues.filter(g => g.active).length,
        brawls: brawls.filter(f => f.active).length,
        arm: arm.active, dances: dances.filter(g => g.active).length,
      };
    },
  };

  function updateGrabbed(n, dt, t, px, pz) {
    const body = n.body;
    if (n.state === ST.HELD) {
      const k = 1 - Math.exp(-dt * 14);
      const ox = n.hx, oz = n.hz;
      n.hx += (n.tx - n.hx) * k; n.hy += (n.ty - n.hy) * k; n.hz += (n.tz - n.hz) * k;
      const vx = (n.hx - ox) / dt, vz = (n.hz - oz) / dt;
      const ax = Math.max(-20, Math.min(20, (vx - n.hvx) / dt)), az = Math.max(-20, Math.min(20, (vz - n.hvz) / dt));
      n.hvx = vx; n.hvz = vz;
      /* 기록 (던지기 속도용) */
      n.clk += dt;
      const h = n.hist[n.hk]; h.x = n.hx; h.y = n.hy; h.z = n.hz; h.t = n.clk;
      n.hk = (n.hk + 1) % HIST;
      /* 목덜미에 매달린 진자: 움직이면 몸이 뒤로 처졌다 흔들린다 + 버둥거림 */
      const L = GRAB_H - COM, w2 = 9.8 / L;
      n.bvx += (-w2 * n.bx - 3 * n.bvx - ax / L * 0.3) * dt;
      n.bvz += (-w2 * n.bz - 3 * n.bvz - az / L * 0.3) * dt;
      n.bx = Math.max(-0.6, Math.min(0.6, n.bx + n.bvx * dt + Math.sin(t * 7 + n.idx) * 0.15 * dt));
      n.bz = Math.max(-0.6, Math.min(0.6, n.bz + n.bvz * dt + Math.cos(t * 6 + n.idx) * 0.15 * dt));
      if (Math.abs(n.bx) === 0.6) n.bvx = 0;
      if (Math.abs(n.bz) === 0.6) n.bvz = 0;
      /* 몸의 위쪽 방향(월드) → 지역 오일러 */
      const ux = -Math.sin(n.bx), uz = -Math.sin(n.bz), uy = Math.sqrt(Math.max(0, 1 - ux * ux - uz * uz));
      n.rot += Math.sin(t * 0.8 + n.idx) * 0.4 * dt;
      const c = Math.cos(n.rot), s = Math.sin(n.rot);
      const lx = ux * c - uz * s, lz = ux * s + uz * c;
      const rz = -Math.asin(Math.max(-1, Math.min(1, lx)));
      body.rotation.set(Math.asin(Math.max(-1, Math.min(1, lz / Math.max(0.2, Math.cos(rz))))), 0, rz);
      /* 목덜미가 커서 지점에 오도록 발밑(root) 위치를 역산 */
      n.x = n.hx - ux * L; n.y = n.hy - uy * L - COM; n.z = n.hz - uz * L;
    } else if (n.state === ST.FLYING) {
      n.vy -= GRAVITY * dt;
      n.cx += n.vx * dt; n.cy += n.vy * dt; n.cz += n.vz * dt;
      if (n.cx < bounds.minX + 1) { n.cx = bounds.minX + 1; n.vx = Math.abs(n.vx) * 0.4; }
      if (n.cx > bounds.maxX - 1) { n.cx = bounds.maxX - 1; n.vx = -Math.abs(n.vx) * 0.4; }
      if (n.cz < bounds.minZ + 1) { n.cz = bounds.minZ + 1; n.vz = Math.abs(n.vz) * 0.4; }
      if (n.cz > bounds.maxZ - 1) { n.cz = bounds.maxZ - 1; n.vz = -Math.abs(n.vz) * 0.4; }
      const g = groundY(n.cx, n.cz) + (n.knockClip ? COM : 0.3);   // Fall 클립 중엔 발이 땅에
      if (n.cy <= g) {
        n.cy = g;
        if (n.vy < -3) {            // 쿵 — 튕긴다
          n.vy = -n.vy * 0.35; n.vx *= 0.7; n.vz *= 0.7;
          n.spinX *= 0.6; n.spinZ *= 0.5;
        } else {                    // 땅에서 구르다 멈춘다
          n.vy = 0;
          const sp = Math.hypot(n.vx, n.vz), ns = Math.max(0, sp - 7 * dt);
          if (sp > 1e-4) { n.vx *= ns / sp; n.vz *= ns / sp; }
          if (!n.knockClip) { n.spinX = (n.spinX < 0 ? -ns : ns) / 0.3; n.spinZ *= Math.exp(-dt * 6); }
          const fa = n.actions.Fall;
          if (ns < 0.35 && (!n.knockClip || !fa.isRunning() || fa.time >= fa.getClip().duration - 0.03)) { const fc = n.knockClip; n.knockClip = false; startLying(n, fc); }
        }
      }
      body.rotation.x += n.spinX * dt;
      body.rotation.z += n.spinZ * dt;
      n.x = n.cx; n.y = n.cy - COM; n.z = n.cz;
    } else if (n.state === ST.LYING) {
      n.timer += dt;
      const e = smooth(Math.min(1, n.timer / 0.35));
      body.rotation.x = n.rx0 + (n.rxT - n.rx0) * e;
      body.rotation.z = n.rz0 + (n.rzT - n.rz0) * e;
      const g = groundY(n.cx, n.cz);
      n.cy = n.cy0 + ((n.actions.GetUp ? g + COM : g + LIE_Y) - n.cy0) * e;
      n.x = n.cx + (n.fx - n.cx) * e; n.y = n.cy - COM; n.z = n.cz + (n.fz - n.cz) * e;
      if (n.timer > 1.2 && n.react === ST.ROLL && !n.rolled) {
        /* 데굴데굴: 등을 대고 누워 긴 축으로 좌우로 구른다 */
        n.rolled = true; n.state = ST.ROLL; n.timer = 0;
        /* 클립으로 누워 있었으면(발이 원점) 몸 가운데로 옮겨서 구른다 */
        n.fx = n.x; n.fz = n.z;
        if (n.actions.GetUp) { const off = 0.93 * S * n.sc; n.cx = n.x - Math.sin(n.rot) * off; n.cz = n.z - Math.cos(n.rot) * off; }
        else { n.cx = n.x; n.cz = n.z; }
        n.rx0 = wrap(body.rotation.x); n.rz0 = wrap(body.rotation.z); n.cy0 = n.cy;
        play(n, n.actions.Struggle ? 'Struggle' : 'Idle', 0.3);
        setAnger(n, true);
      } else if (n.timer > 1.2) {
        n.state = ST.GETUP; n.timer = 0;
        /* 구르며 쌓인 바퀴 수를 버린다 (안 그러면 일어나며 여러 바퀴 돈다) */
        body.rotation.x = wrap(body.rotation.x); body.rotation.z = wrap(body.rotation.z);
        n.rxT = body.rotation.x;
        if (n.actions.GetUp) n.cur.setEffectiveTimeScale(1);
      }
    } else if (n.state === ST.ROLL) {
      n.timer += dt;
      const e = smooth(Math.min(1, n.timer / 0.3));
      const fade = Math.min(1, (ROLL_TIME - n.timer) / 0.4);          // 끝날 때 반듯하게
      const th = Math.sin(n.timer * 5.5) * 1.7 * Math.max(0, fade) * e;
      body.rotation.x = n.rx0 + (-Math.PI / 2 - n.rx0) * e;
      body.rotation.z = n.rz0 * (1 - e);
      body.rotation.y = th;
      const g = groundY(n.cx, n.cz);
      n.cy = n.cy0 + (g + LIE_Y - n.cy0) * e;
      const lat = th * 0.28, c = Math.cos(n.rot), sn = Math.sin(n.rot);   // 구르는 만큼 옆으로
      n.x = n.fx + (n.cx - n.fx) * e + c * lat; n.z = n.fz + (n.cz - n.fz) * e - sn * lat; n.y = n.cy - COM;
      if (n.timer >= ROLL_TIME) {
        body.rotation.y = 0;
        n.react = 0;
        startLying(n);
        n.timer = 0.85;                       // 잠깐만 더 누워 있다가 일어난다
        setAnger(n, true);
      }
    } else if (n.state === ST.STAGGER) {
      n.timer += dt;
      const k = Math.exp(-dt * 6);
      n.sx *= k; n.sz *= k;
      n.x = Math.max(bounds.minX + 1, Math.min(bounds.maxX - 1, n.x + n.sx * dt));
      n.z = Math.max(bounds.minZ + 1, Math.min(bounds.maxZ - 1, n.z + n.sz * dt));
      n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
      /* 뒤로 젖혀졌다가 흔들리며 돌아온다 */
      const u = n.timer / STAGGER_TIME;
      body.rotation.x = -0.5 * Math.exp(-u * 3) * Math.cos(u * 9);
      body.rotation.z = 0.15 * Math.sin(u * 13) * (1 - u);
      if (n.timer >= STAGGER_TIME) {
        body.rotation.set(0, 0, 0);
        n.cx = n.fx = n.x; n.cz = n.fz = n.z;   // finishGetUp 이 fx/fz 로 옮기므로 지금 자리로 (안 그러면 지난번 누웠던 곳으로 순간이동)
        finishGetUp(n);                          // react(쫓기/발 동동)로 넘어간다
      }
    } else if (n.state === ST.STOMP) {
      n.timer -= dt;
      turnTo(n, Math.atan2(px - n.x, pz - n.z), dt);
      const g = groundY(n.x, n.z);
      n.y = n.actions.Stomp ? g : g + Math.abs(Math.sin(t * 10 + n.idx)) * 0.05;
      if (n.timer <= 0) endAnger(n);
    } else if (n.state === ST.CHASE) {
      n.timer -= dt;
      const dx = px - n.x, dz = pz - n.z, d = Math.hypot(dx, dz);
      if (n.timer <= 0 || d > CHASE_GIVEUP) { endAnger(n); }
      else {
        const err = turnTo(n, Math.atan2(dx, dz), dt * 1.6);
        if (d > 2) {
          n.close = false;
          if (n.actions.Run) play(n, 'Run', 0.25);
          else { play(n, 'Walk', 0.25); n.cur.setEffectiveTimeScale(2.3); }
          const step = Math.min(d - 1.6, CHASE_SPEED * (err > 1.2 ? 0.2 : Math.cos(err * 0.8)) * dt);
          n.x = Math.max(bounds.minX + 1, Math.min(bounds.maxX - 1, n.x + Math.sin(n.rot) * step));
          n.z = Math.max(bounds.minZ + 1, Math.min(bounds.maxZ - 1, n.z + Math.cos(n.rot) * step));
        } else {
          n.close = true;                      // 코앞에서 주먹을 흔든다
          play(n, n.actions.Stomp ? 'Stomp' : 'Idle', 0.25);
        }
        n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
      }
    } else if (n.state === ST.FLEE) {
      if (n.panicT <= 0) { toIdle(n); }
      else {
        let dx = n.x - n.panicX, dz = n.z - n.panicZ, d = Math.hypot(dx, dz);
        if (d < 1e-3) { dx = Math.sin(n.rot); dz = Math.cos(n.rot); d = 1; }
        const err = turnTo(n, Math.atan2(dx, dz), dt * 2);
        if (!n.actions.Run && n.cur) n.cur.setEffectiveTimeScale(2.3);
        const step = FLEE_SPEED * (err > 1.2 ? 0.25 : Math.cos(err * 0.8)) * dt;
        n.x = clampX(n.x + Math.sin(n.rot) * step);
        n.z = Math.max(bounds.minZ + 1, Math.min(bounds.maxZ - 1, n.z + Math.cos(n.rot) * step));
        pushFromTables(n);
        n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
      }
    } else if (n.state === ST.WATCH) {
      n.timer -= dt;
      const v = n.watchV;
      if (v) turnTo(n, Math.atan2(v.x - n.x, v.z - n.z), dt);
      n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
      if (n.watchKind === 2) {
        /* 박장대소: 배를 잡고 앞뒤로 들썩, 가끔 뒤로 젖힌다 */
        n.laughPh += dt * 15;
        n.body.rotation.x = 0.16 + Math.sin(n.laughPh) * 0.1 - Math.max(0, Math.sin(n.laughPh * 0.23)) * 0.28;
        n.body.rotation.z = Math.sin(n.laughPh * 0.5) * 0.04;
      }
      if (n.watchKind === 3) n.bow = Math.min(1, n.bow + dt * 3);   // [social] 임금님께 고개 숙여 절
      if (n.timer <= 0) { n.watchV = null; n.bow = 0; toIdle(n); }
    } else if (n.state === ST.CHAT) {
      const g = n.chatG;
      if (!g) { startWanderLeg(n); }
      else if (!n.arrived) {
        if (walkToward(n, n.fromX, n.fromZ, dt, 0.12)) { n.arrived = true; play(n, 'Idle', 0.4); }
      } else turnTo(n, Math.atan2(g.cx - n.x, g.cz - n.z), dt);
      n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
    } else if (n.state === ST.SERVE && n.serveTo) {   // [social] 앉은 손님에게 술을 갖다준다
      serveWalk(n, dt);
    } else if (n.state >= ST.ARGUE) {                   // [social] 말다툼·팔씨름·춤·포옹·싸움 말리기
      socialState(n, dt, t);
    } else if (n.state === ST.BAR || n.state === ST.SERVE) {
      const s = stalls[n.bar], bp = s.bar;
      n.x += (bp.x - n.x) * Math.min(1, dt * 4); n.z += (bp.z - n.z) * Math.min(1, dt * 4);
      n.y = groundY(n.x, n.z);
      /* 플레이어가 가까우면 플레이어를, 아니면 앉은 손님 쪽(=길 쪽)을 본다 */
      let face = bp.rotY;
      if (n.state === ST.SERVE) face = Math.atan2(px - n.x, pz - n.z);   // 주문받을 때만 플레이어를 본다. 평소엔 손님 쪽
      else if (s.occupied > 0) face = Math.atan2(s.x - n.x, s.z - n.z);
      turnTo(n, face, dt * 0.7);
      n.timer -= dt;
      if (n.state === ST.SERVE) {
        n.wiping = false;
        if (n.timer <= 0) { n.state = ST.BAR; n.timer = rr(3, 5); play(n, 'Idle', 0.4); }
      } else if (n.timer <= 0) {
        n.wiping = !n.wiping;
        n.timer = n.wiping ? rr(4, 6) : rr(2.5, 4);
      }
    } else if (n.state === ST.BAR_RETURN) {
      const bp = stalls[n.bar].bar;
      if (walkToward(n, bp.x, bp.z, dt, 0.15)) { n.state = ST.BAR; n.timer = rr(2, 4); n.wiping = false; play(n, 'Idle', 0.4); }
      n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
    } else if (n.state === ST.GUARD) {
      const dx = px - n.x, dz = pz - n.z, d = Math.hypot(dx, dz);
      const err = turnTo(n, Math.atan2(dx, dz), dt * 1.8);
      play(n, 'Run', 0.25);
      const step = Math.min(Math.max(0, d - 0.6), GUARD_SPEED * (err > 1.2 ? 0.25 : Math.cos(err * 0.8)) * dt);
      n.x = clampX(n.x + Math.sin(n.rot) * step);
      n.z = Math.max(bounds.minZ + 1, Math.min(bounds.maxZ - 1, n.z + Math.cos(n.rot) * step));
      pushFromTables(n);
      n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
      n.timer -= dt;
      if (n.timer <= 0) { n.timer = rr(3, 6); if (d < 25) say(n, pickOne(GUARD_SHOUT), 1.5, '#7a1a10'); }
      if (d < GUARD_CATCH_R && !isDriving()) {
        say(n, '체포한다!', 2, '#7a1a10');
        if (api.onGuardCatch) api.onGuardCatch(n);
      }
    } else if (n.state === ST.GUARD_LEAVE) {
      const dx = n.x - px, dz = n.z - pz;
      turnTo(n, Math.atan2(dx, dz), dt);
      play(n, 'Walk', 0.3);
      const step = 1.4 * dt;
      n.x = clampX(n.x + Math.sin(n.rot) * step);
      n.z = Math.max(bounds.minZ + 1, Math.min(bounds.maxZ - 1, n.z + Math.cos(n.rot) * step));
      n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
      if (n.dist > GUARD_GONE_R) {
        n.off = true; n.root.visible = false; n.state = ST.OFF;
        if (n.bubble) { n.bubble.sp.visible = false; n.bubble.n = null; n.bubble = null; }
      }
    } else if (n.state === ST.FIGHT) {
      const f = n.fight, foe = n.foe;
      if (!f || !f.active || !foe) { n.fight = null; n.foe = null; toIdle(n); }
      else {
        if (n.punchAnim > 0) n.punchAnim -= dt;
        const dx = foe.x - n.x, dz = foe.z - n.z, d = Math.hypot(dx, dz);
        if (!n.arrived) {
          if (walkToward(n, n.fromX, n.fromZ, dt, 0.15)) { n.arrived = true; play(n, 'Idle', 0.3); }
        } else {
          turnTo(n, Math.atan2(dx, dz), dt * 1.5);
          const foeUp = foe.state === ST.FIGHT && foe.arrived;
          if (!foeUp) play(n, f.winner === n ? 'Cheers' : 'Stomp', 0.3);   // 상대가 쓰러지면 약 올린다 (취객 싸움 승자는 환호)
          else {
            play(n, 'Idle', 0.3);
            /* 1 m 거리를 유지하며 들썩인다 */
            const want = d - 1.0, step = Math.max(-0.8 * dt, Math.min(1.2 * dt, want));
            if (Math.abs(want) > 0.12 && d > 1e-3) { n.x += dx / d * step; n.z += dz / d * step; }
            n.timer -= dt;
            if (!f.over && n.timer <= 0 && d < 1.4) { n.timer = rr(1.2, 2.6); fightHit(n, foe); }
          }
        }
        n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
      }
    } else if (n.state === ST.GATHER) {
      const g = n.gatherC;
      if (!g || !g.active) { n.gatherC = null; toIdle(n); }
      else {
        if (!n.arrived) {
          if (walkToward(n, n.fromX, n.fromZ, dt, 0.2)) { n.arrived = true; play(n, 'Idle', 0.3); n.timer = rr(0.5, 2); }
        } else {
          /* 싸움이면 계속 환호, 공연이면 조용히 듣다가 끝에 건배 */
          const cx = g.isFight ? (g.a.x + g.b.x) / 2 : g.x, cz = g.isFight ? (g.a.z + g.b.z) / 2 : g.z;
          turnTo(n, Math.atan2(cx - n.x, cz - n.z), dt);
          if (g.isFight || g.loud) {   // 싸움·팔씨름은 계속 환호
            play(n, 'Cheers', 0.3);
            n.timer -= dt;
            if (n.timer <= 0) { n.timer = rr(2.5, 5); if (rnd() < 0.4) say(n, pickOne(g.crowd || FIGHT_CROWD), 1.4); }
          } else play(n, g.phase === 2 ? 'Cheers' : 'Idle', 0.3);
        }
        n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
      }
    } else if (n.state === ST.BARD_GO) {
      if (!bard.active || bard.n !== n) toIdle(n);
      else if (walkToward(n, bard.x, bard.z, dt, 0.15)) {
        if (turnTo(n, bard.face, dt) < 0.1) {
          n.state = ST.BARD_PLAY; bard.phase = 1; bard.playing = true; bard.t = BARD_TIME;
          play(n, 'Idle', 0.3);
          gather(bard, bard.x, bard.z, 2.8, 3 + Math.floor(rnd() * 4), true, bard.face);
          say(n, '♪ 들어보시오~', 2);
          if (api.onNpcEvent) api.onNpcEvent('bard', n);
        } else play(n, 'Idle', 0.3);
      }
      n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
    } else if (n.state === ST.BARD_PLAY) {
      if (!bard.active || bard.n !== n) toIdle(n);
      else {
        bard.t -= dt;
        turnTo(n, bard.face, dt);
        if (bard.phase === 1 && bard.t <= 0) {         // 연주 끝 → 인사, 관객 건배
          bard.phase = 2; bard.playing = false; bard.t = 2.5;
          play(n, 'Cheers', 0.3); say(n, '감사합니다!', 1.8);
        } else if (bard.phase === 2 && bard.t <= 0) endBard();
        if (bard.phase === 1 && rnd() < dt * 0.12) say(n, '♪ ♫', 1.4);
      }
      n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
    } else if (n.state === ST.ACTOR) {   // [village] 위치·방향은 village.js 가 정한다. 높이만 땅에 맞춘다
      n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
    } else if (n.state === ST.GETUP) {
      n.timer += dt;
      const g = groundY(n.cx, n.cz);
      const a = n.actions.GetUp;
      if (a) {
        n.y = g;
        if (n.timer > 0.1 && (!a.isRunning() || a.time >= a.getClip().duration - 0.02)) finishGetUp(n);
      } else {
        /* 대체: 등을 대고 누운 몸을 1초 동안 일으켜 세운다 */
        const e = smooth(Math.min(1, n.timer / 1.0));
        body.rotation.x = n.rxT * (1 - e);
        body.rotation.z = 0;
        n.cy = g + LIE_Y + (COM - LIE_Y) * e;
        n.y = n.cy - COM;
        if (e >= 1) finishGetUp(n);
      }
    }
    n.root.position.set(n.x, n.y, n.z);
    n.root.rotation.y = n.rot;
  }

  /* 화면 광선에 맞은 손님 (스킨 메시 대신 구 3개로 몸을 근사) */
  function pick(ray, pp, range, radScale = 1) {
    const o = ray.origin, d = ray.direction;
    let best = null, bt = 1e9;
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (n.off || n.state === ST.HELD || n.state === ST.FLYING) continue;
      if (pp && Math.hypot(n.x - pp.x, n.z - pp.z) > range) continue;
      const lying = isLying(n.state), seated = n.state === ST.SEATED || n.state === ST.SIT_DOWN;
      for (let k = 0; k < (lying ? 1 : 3); k++) {
        const cy = n.y + (lying ? COM : seated ? 0.35 + k * 0.45 : 0.45 + k * 0.52);
        const r = (lying ? 0.75 : 0.4) * radScale;
        const vx = n.x - o.x, vy = cy - o.y, vz = n.z - o.z;
        const tca = vx * d.x + vy * d.y + vz * d.z;
        if (tca <= 0) continue;
        const d2 = vx * vx + vy * vy + vz * vz - tca * tca;
        if (d2 < r * r && tca < bt) { bt = tca; best = n; }
      }
    }
    return best;
  }

  /* ── [village] 배우 (village.js 의 임금님·호위병·깃발잡이·소매치기) ──
     addActor(re, { noAggro, fallback }) → n : 파일 이름이 re 와 맞는 모델을 복제해 숨긴 채 만든다(웬만하면 한 번만 만들고 재사용).
       ACTOR_MODELS(npc-barmaid·npc-king)는 여기서만 쓰인다. 그 파일이 없으면 fallback 정규식 모델. n.model 로 무엇이 됐는지 안다.
       n.propShow(true/false/null) : 손의 잔 보이기 덮어쓰기, n.carry / n.bow (0..1) : 잔 받쳐 들기·인사 몸짓 (tavern.js 서빙 아가씨)
     actorOn(n, x, z, rot) / actorOff(n) : 보이기·숨기기. ACTOR 상태에선 npcs.js 가 움직이지 않으니 n.x/n.z/n.rot 를 직접 쓴다.
     actorPlay(n, clip, fade, timeScale) : 클립 재생. isActing(n) : 맞거나 잡혀 넘어져 있지 않고 대본대로 움직이는 중인가.
     맞거나 치이면 평소처럼 넘어졌다 일어나 ACTOR 로 돌아온다(화내기·쫓기 없음). noAggro 면 수배 점수(onAggression)를 안 보낸다.
     watch(n, target, dur, cheer) : 걷거나 서 있는 손님을 dur 초 동안 target({x,z}) 쪽을 보며 환호(Cheers) 또는 발 동동하게 한다. */
  function addActor(re, { noAggro = false, fallback = null } = {}) {
    const rx = new RegExp(re), fx = fallback ? new RegExp(fallback) : null;
    /* 배우 전용 모델(actorSources) 먼저, 없으면 일반 모델, 그래도 없으면 fallback, 마지막엔 첫 모델 */
    const src = actorSources.find(q => rx.test(q.file)) || sources.find(q => rx.test(q.file))
      || (fx && sources.find(q => fx.test(q.file))) || sources[0];
    const n = makeNPC(src, npcs.length, false);
    n.actor = true; n.noAggro = noAggro;
    n.off = true; n.root.visible = false; n.state = ST.OFF;
    npcs.push(n);
    return n;
  }
  function actorOn(n, x, z, rot = 0) {
    if (!n || !n.actor) return;
    n.off = false; n.root.visible = true; n.state = ST.ACTOR;
    n.x = x; n.z = z; n.y = groundY(x, z); n.rot = rot;
    n.body.rotation.set(0, 0, 0); n.react = 0; n.panicT = 0; setAnger(n, false);
    n.root.position.set(n.x, n.y, n.z); n.root.rotation.y = rot;
    n.actSit = false; n.standOn = false; n.standK = 0; n.standUntil = 0; n.standHop = 1; n.body.position.y = COM;
    play(n, 'Idle', 0);
  }
  function actorOff(n) {
    if (!n || !n.actor) return false;
    if (n.state === ST.HELD && ctrl && ctrl.held === n) return false;   // 잡혀 있으면 놓을 때까지 둔다 → false (나중에 다시 부른다)
    n.off = true; n.root.visible = false; n.state = ST.OFF;
    if (n.bubble) { n.bubble.sp.visible = false; n.bubble.n = null; n.bubble = null; }
    return true;
  }
  function actorPlay(n, name, fade = FADE, ts = 1) { play(n, name, fade); if (n.cur && n.curName === name) n.cur.setEffectiveTimeScale(ts); }
  const isActing = n => !!n && n.state === ST.ACTOR;
  /* 서서 하는 몸짓 API.
     standPlay(n, kind = 'cheer', fade) : 매 프레임 불러도 되는 actorPlay 대용 (kind: cheer|drink|offer|laugh|toast). 앉아 있으면 원래 클립.
     cheerStanding(n, dur = 2, kind = 'cheer') : dur 초 동안만. 걷던 손님은 멈춰 서서(WATCH), 배우는 그 사이 Idle 요청이 와도 유지.
     actorSeated(n, on) : 배우가 앉아 있다/서 있다를 직접 알려 준다 (Sit 클립을 틀면 자동으로 앉은 것으로 본다) */
  function standPlay(n, kind = 'cheer', fade = 0.25) {
    if (!n) return;
    const k = STAND[kind] || STAND.cheer;
    play(n, k === STAND.drink ? 'Drink' : 'Cheers', fade, k);
  }
  function cheerStanding(n, dur = 2, kind = 'cheer') {
    if (!n || n.off) return false;
    if (n.state === ST.WANDER || n.state === ST.PAUSE) { if (!watch(n, null, dur, true)) return false; }
    else if (n.state !== ST.ACTOR && n.state !== ST.WATCH && n.state !== ST.GATHER) return false;
    if (sitsNow(n)) { play(n, 'Cheers', 0.25); return true; }
    play(n, 'Idle', 0.25);
    n.standUntil = 0; setStand(n, STAND[kind] || STAND.cheer, 'Idle');
    n.standUntil = now + dur;
    return true;
  }
  function actorSeated(n, on) { if (n) n.actSit = !!on; }
  function watch(n, target, dur = 2, cheer = true) {
    if (!n || n.off || n.actor || n.guard || n.bar >= 0 || (n.state !== ST.WANDER && n.state !== ST.PAUSE)) return false;
    n.state = ST.WATCH; n.timer = dur; n.watchV = target; n.yielding = false; n.watchKind = cheer ? 0 : 1;
    breakPair(n);
    /* [social] 임금님 행차엔 절반쯤은 환호 대신 고개 숙여 절한다 */
    if (cheer && target && target.actor && /king/.test(target.model || '') && rnd() < 0.55) { n.watchKind = 3; n.bow = 0; play(n, 'Idle', 0.25); return true; }
    play(n, cheer ? 'Cheers' : (n.actions.Stomp ? 'Stomp' : 'Idle'), 0.25);
    return true;
  }

  function dispose() {
    if (ctrl) { ctrl.dispose(); ctrl = null; }
    for (const n of npcs) {
      releaseSeat(n);
      n.mixer.stopAllAction();
      n.mixer.uncacheRoot(n.mixer.getRoot());
      for (const m of n.mats) m.dispose();
      scene.remove(n.root);
    }
    npcs.length = 0;
    angerTex.dispose(); angerMat.dispose();
    spearMat.dispose(); bladeMat.dispose(); spearGeo.dispose(); bladeGeo.dispose(); axeGeo.dispose();
    for (const b of bubbles) { scene.remove(b.sp); b.tex.dispose(); b.mat.dispose(); }
    if (debug && globalThis.__npcs) delete globalThis.__npcs;
    if (debug && globalThis.__npcsApi === api) delete globalThis.__npcsApi;   // [village]
    /* 클론은 지오메트리·재질을 원본과 공유한다 → 원본에서 한 번만 해제 */
    for (const src of sources.concat(actorSources)) {
      src.scene.traverse(o => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }
      });
    }
  }

  /* 디버그용: 지금 걷는 비율 */
  const walkingRatio = () => npcs.filter(n => n.bar < 0 && !n.guard && walking(n.state) && !n.yielding).length / Math.max(1, nWalkers);
  /* 디버그: __npcs.hit(i) 로 i번 손님을 차에 친 것처럼 넘어뜨린다 */
  if (debug) {
    const names = Object.keys(ST);
    globalThis.__npcsApi = api;   // [village] 테스트 페이지에서 진짜 API 를 쓰려고
    globalThis.__npcs = {
      hit(i = 0, speed = 8) {
        const n = npcs[i]; if (!n) return false;
        const p = getPlayerPos ? getPlayerPos() : null;
        let dx = p ? n.x - p.x : 0, dz = p ? n.z - p.z : 1;
        const l = Math.hypot(dx, dz) || 1;
        knock(n, dx / l, dz / l, speed);
        return true;
      },
      list() {
        return npcs.map((n, i) => ({ i, model: n.model, gender: n.gender, state: names[n.state], clip: n.curName,
          x: +n.x.toFixed(2), z: +n.z.toFixed(2), seated: !!n.seat, angry: n.anger.visible }));
      },
      alarm(x, z, kind = 'shot', radius = 0) { return alarm({ x, z }, radius, kind); },
      serve(si = 0) { return barkeeperServe(si); },
      fight(si = -1) { return startFight(si); },
      bard(si = -1) { return startBard(si); },
      guard(dx = 8) { const p = getPlayerPos(); setGuardChase(true); return spawnGuard(p.x + dx, p.z + 6); },
      punch(i) {   // i번 손님을 플레이어가 친 것처럼 (거리 무시)
        const n = npcs[i]; if (!n) return false;
        const p = getPlayerPos ? getPlayerPos() : null;
        let dx = p ? n.x - p.x : 0, dz = p ? n.z - p.z : 1;
        const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        n.punchT = now;
        takeHit(n, HIT_DMG.punch, dx * 3.2, 2.2, dz * 3.2, 'punch');
        return true;
      },
      /* [social] 사회생활 장면 바로 띄우기 */
      toast: si => social.toast(si),            // 가까운(또는 si) 가판대 건배 (모자라면 손님을 앉힌다)
      brawl: skip => social.brawl(skip),        // 근처 두 사람 시비 → 주먹다짐 (skip=true 면 말다툼 생략)
      argue: () => social.argue(),
      armwrestle: si => social.armwrestle(si),
      dance: k => social.dance(k),
      drunk: (i, v) => social.drunk(i, v),      // i번 취기 0..1
      trip: i => social.trip(i),
      couple: () => social.couple(),
      sleep: si => social.sleep(si),
      hug: () => {
        const a = nearPlayerWalker(), b = a && nearPlayerWalker(a, a, 0);
        if (!a || !b) return false;
        if (Math.hypot(b.x - a.x, b.z - a.z) > 8) { b.x = a.x + Math.sin(a.rot) * 2; b.z = a.z + Math.cos(a.rot) * 2; b.y = groundY(b.x, b.z); }
        return tryHug(a, b);
      },
      social: () => social.status(),
    };
  }

  return Object.assign(api, { update, dispose, count: npcs.length, npcs, walkingRatio, stalls, bounds,
    setObstacles,                                              // (pos, r) => bool — 소품 충돌 (portfolio.js 에서 vprops/castle/shop pushOut 연결)
    spawnGuard, setGuardChase, guardInfo, startFight, endFight, startBard, endBard,
    get fight() { return fight; }, get bard() { return bard; },
    pick: pickRay, knockDown, list, freeSeatNear, reserveSeat: reserveSeatAPI, releaseSeat: releaseSeatAPI,
    alarm, barkeeperServe, say,
    addActor, actorOn, actorOff, actorPlay, isActing, watch,   // [village]
    standPlay, cheerStanding, actorSeated,                     // 서서 환호·마시기 (Cheers/Drink 클립은 앉은 자세)
    danceAt: (x, z, n = 5, dur = 20) => startDance(x, z, n, dur, false, 22),   // 플레이어가 춤추면 근처 사람들이 따라 춘다
    social,                                                    // [social] toast/brawl/argue/armwrestle/dance/drunk/trip/couple/status
    onPlayerPunch: null,
    _grab: { pick, grab, setTarget, release, punch, setCtrl: c => { ctrl = c; } } });
}

/* ════ 마우스/터치: 짧게 클릭 = 주먹(걸어 다닐 때), 꾹 누르기 = 잡기, 떼기 = 던지기 ════
   npcs: createNPCs 의 반환값. 갱신은 npcs.update 안에서 같이 돈다. */
export function attachGrab(npcs, {
  THREE, camera, domElement, getPlayerPos, groundY,
  isBlocked = null,
  isOnFoot = null,        // () => 걸어 다니는 중인가 (주먹은 걸을 때만)
  getPlayerFacing = null, // () => 플레이어가 보는 방향 각도 (앞 = (sin, cos))
  playPunch = null,       // (맞은 npc | null) => 플레이어 주먹 동작 재생 (PM 쪽)
  holdHeight = 2.3,       // 잡고 있을 때 목덜미 높이 (플레이어 발밑 기준)
  maxDist = 10,           // 플레이어에서 이 거리 밖으로는 못 끌고 간다
  grabRange = 18,         // 이 거리 안의 손님만 잡힌다
  holdDelay = 200,        // 이 시간(ms) 이상 누르면 잡기, 그 전에 떼면 주먹
  touchDelay = 350,       // 터치 길게 누르기 (ms)
} = {}) {
  const api = npcs && npcs._grab;
  if (!api) return { dispose() {}, get held() { return null; } };

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pressed = false, pressId = -1, pressType = '', pressT = 0, downX = 0, downY = 0, moved = false;
  let held = null, hovering = false, downNpc = null;

  const blocked = () => {
    if (isBlocked && isBlocked()) return true;
    if (document.body.dataset.view === 'doc') return true;
    const pn = document.getElementById('g-panel');
    return !!(pn && pn.classList.contains('open'));
  };
  const setCursor = c => { if (domElement.style.cursor !== c) domElement.style.cursor = c; };
  const setNDC = e => {
    const r = domElement.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  const pick = (rad = 1) => {
    raycaster.setFromCamera(ndc, camera);
    return api.pick(raycaster.ray, getPlayerPos ? getPlayerPos() : null, grabRange, rad);
  };
  function doGrab(n) {
    if (!api.grab(n)) return;
    held = n;
    try { domElement.setPointerCapture(pressId); } catch { /* 없어도 진행 */ }
    setCursor('grabbing');
  }
  function letGo(drop) {
    if (held) { api.release(held, drop); held = null; }
    try { if (pressId >= 0 && domElement.hasPointerCapture && domElement.hasPointerCapture(pressId)) domElement.releasePointerCapture(pressId); } catch { /* 무시 */ }
    setCursor(hovering ? 'grab' : '');
  }
  function endPress() { pressed = false; pressId = -1; downNpc = null; }

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (pressed || blocked()) return;
    setNDC(e);
    pressed = true; pressId = e.pointerId; pressType = e.pointerType; moved = false;
    pressT = performance.now(); downX = e.clientX; downY = e.clientY;
    downNpc = pick(pressType === 'mouse' ? 1 : 1.6);
    if (downNpc && pressType === 'mouse') e.preventDefault();   // 드래그 선택 방지
  }
  function onMove(e) {
    if (pressed && e.pointerId !== pressId) return;
    setNDC(e);
    if (held) return;
    if (pressed) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 14) moved = true;
    } else if (e.pointerType === 'mouse') {
      hovering = !blocked() && !!pick();
      setCursor(hovering ? 'grab' : '');
    }
  }
  function onUp(e) {
    if (!pressed || e.pointerId !== pressId) return;
    if (held) letGo(e.type === 'pointercancel');
    else if (e.type === 'pointerup' && !blocked() && performance.now() - pressT < (pressType === 'mouse' ? holdDelay : touchDelay)
      && (pressType === 'mouse' || !moved) && (!isOnFoot || isOnFoot())) {
      /* 짧은 클릭 = 주먹 */
      const hit = api.punch(getPlayerFacing ? getPlayerFacing() : null, downNpc);
      if (playPunch) playPunch(hit);
      if (npcs.onPlayerPunch) npcs.onPlayerPunch(hit);
    }
    endPress();
  }
  function onLeave() { if (!pressed && hovering) { hovering = false; setCursor(''); } }
  function onBlur() { if (pressed) { letGo(true); endPress(); } }

  domElement.addEventListener('pointerdown', onDown);
  domElement.addEventListener('pointermove', onMove);
  domElement.addEventListener('pointerup', onUp);
  domElement.addEventListener('pointercancel', onUp);
  domElement.addEventListener('pointerleave', onLeave);
  addEventListener('blur', onBlur);
  const prevTouchAction = domElement.style.touchAction;
  domElement.style.touchAction = 'none';   // 길게 눌러 끄는 동안 브라우저가 스크롤·확대로 가로채지 않게

  const ctrl = {
    get held() { return held; },
    update() {
      if (!held) {
        /* 꾹 누르고 있으면 잡는다 (누른 채 손님 위로 끌어가도 잡힌다) */
        if (pressed && !blocked()) {
          const touch = pressType !== 'mouse';
          if (performance.now() - pressT >= (touch ? touchDelay : holdDelay) && !(touch && moved)) {
            const n = pick(touch ? 1.6 : 1) || (touch ? null : downNpc);
            if (n && (n === downNpc || !touch)) doGrab(n);
          }
        }
        return;
      }
      if (blocked()) { letGo(true); endPress(); return; }
      /* 커서 광선을 플레이어 근처 높이의 수평면에 투영 */
      raycaster.setFromCamera(ndc, camera);
      const o = raycaster.ray.origin, d = raycaster.ray.direction;
      const p = getPlayerPos ? getPlayerPos() : o;
      const h = groundY(p.x, p.z) + holdHeight;
      let x, z;
      const t = d.y < -0.02 ? (h - o.y) / d.y : -1;
      if (t > 0) { x = o.x + d.x * t; z = o.z + d.z * t; }
      else {      // 수평선 위를 가리키면 그 방향으로 최대 거리
        const hl = Math.hypot(d.x, d.z) || 1;
        x = p.x + d.x / hl * maxDist; z = p.z + d.z / hl * maxDist;
      }
      const dx = x - p.x, dz = z - p.z, dl = Math.hypot(dx, dz);
      if (dl > maxDist) { x = p.x + dx / dl * maxDist; z = p.z + dz / dl * maxDist; }
      api.setTarget(held, x, Math.max(h, groundY(x, z) + holdHeight - 0.3), z);
    },
    dispose() {
      onBlur();
      domElement.removeEventListener('pointerdown', onDown);
      domElement.removeEventListener('pointermove', onMove);
      domElement.removeEventListener('pointerup', onUp);
      domElement.removeEventListener('pointercancel', onUp);
      domElement.removeEventListener('pointerleave', onLeave);
      removeEventListener('blur', onBlur);
      domElement.style.touchAction = prevTouchAction;
      setCursor('');
      api.setCtrl(null);
    },
  };
  api.setCtrl(ctrl);
  return ctrl;
}
