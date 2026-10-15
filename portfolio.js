/* ════════════════════════════════════════════════════════════
   최상호 포트폴리오 — 게임 뷰 / 문서 뷰 공용 스크립트

   프로젝트 내용은 아래 PROJECTS 한 곳에만 적는다.
   문서 카드도, 3D 게시판과 상세 패널도 전부 여기서 그려진다.
   ════════════════════════════════════════════════════════════ */

const PROJECTS = [
  {
    id: 'nolleo', no: '01', color: '#3fa7d6',
    name: '놀러온나',
    full: '놀러온나 — 부산 특화 예산 맞춤 여행 플랫폼',
    period: '2026.05 — 2026.10', role: '5인 팀 · 프론트 전담',
    one: '한국관광공사 TourAPI 기반 여행 플랫폼에서 <b>서비스 전 페이지의 프론트엔드를 혼자</b> 설계·구현했습니다. (프론트 1, 백엔드 3, PM 1)',
    pts: [
      '장소 매핑 상한이 3,000개로 하드코딩돼 <b>실데이터 3,632개 중 632개가 누락</b>되던 버그를 발견했습니다. 상한을 올리고 37회 순차 요청을 8개 단위 병렬로 바꿔 초기 로딩도 함께 개선했습니다.',
      '부산 16개 구 혼잡도 지도를 Kakao Maps SDK로 구현하고, 원형 마커를 <b>실제 행정구역 경계 폴리곤</b>으로 교체해 구 클릭부터 상세 모달까지 이어지는 탐색 흐름을 설계했습니다.',
      'AI가 생성한 코스를 사용자가 직접 다듬도록 순서 변경·제외·드래그 정렬·예산 게이지를 붙인 <b>편집 흐름</b>을 구현했습니다.',
      '카카오 SDK 스크립트 로드 전에 지도를 초기화해 발생하던 레이스 컨디션을, 스크립트 태그를 재확인한 뒤 load 이벤트를 붙이는 폴백으로 해결했습니다.',
      '모바일에서 카드 드래그가 목록 스크롤을 막던 문제를, 화면 크기를 감지해 데스크톱·모바일 드래그 방식을 분리하는 방식으로 해결했습니다.',
      '스팟 검색을 지역명·카테고리·무료 여부·초성까지 인식하는 통합 검색으로 확장하고, 결과에 맞춰 지도 범위가 자동 재조정되도록 했습니다.'
    ],
    stack: ['Next.js', 'TypeScript', 'TailwindCSS v4', 'TanStack Query', 'Zustand', 'Kakao Maps SDK', 'Motion', 'Vitest'],
    img: 'images/nolleo-onna.png',
    live: 'https://www.nolleo-onna.site/', repo: 'https://github.com/nolleo-onna/nolleo-onna-frontend',
    pos: [-17, -16]
  },
  {
    id: 'trade', no: '02', color: '#e8734a',
    name: 'Trade-Cmarket',
    full: 'Trade-Cmarket — 한국·인도네시아 B2B 무역 견적·계약 플랫폼',
    period: '2026.07 — 2026.08', role: '인턴 · 1인 개발',
    one: '발주 공고부터 견적·낙찰·계약·실시간 채팅까지 거래 플로우 전체를 바이어·셀러 양면으로 <b>혼자 기획·설계·구현</b>했습니다.',
    pts: [
      'Supabase RLS와 서비스롤 API로 <b>이중 권한 구조</b>를 설계해, RLS를 우회하는 경로에도 소유권·상태 전이 검증을 직접 붙였습니다. 완료된 계약 되돌리기, 마감 공고 견적 제출 같은 조작을 차단했습니다.',
      '3개 국어 서비스에서 번역본을 원문·감지언어와 함께 저장하고 생성은 서버로만 강제해, <b>클라이언트발 번역 위조</b>를 막았습니다.',
      '간헐적 강제 로그아웃의 원인이 <b>미들웨어의 리다이렉트 쿠키 누락</b>임을 프론트와 백엔드를 함께 추적해 찾아내고, 헬퍼로 재발을 막았습니다.',
      '채팅 읽음 처리가 행마다 이벤트를 발생시켜 전체 이력을 다시 불러오던 문제를, 수신 페이로드를 <b>캐시에 직접 반영</b>하도록 바꿔 해결했습니다.',
      'Gemini 구조화 출력으로 공고·견적 초안을 생성하고 발주서 PDF·이미지를 멀티모달로 추출했습니다. 모델 과부하 시 폴백 체인으로 무중단 처리했습니다.',
      '전 API 라우트 보안 감사를 수행해 저장형 XSS 살균, 무인증 번역 프록시 차단, 업로드 MIME·용량 검증을 일괄 적용했습니다.'
    ],
    stack: ['Next.js 15', 'TypeScript', 'Supabase', 'TanStack Query', 'Zustand', 'next-intl', 'Gemini API', 'Vercel'],
    img: 'images/trade-cmarket.png',
    live: 'https://cmarket-hazel.vercel.app/', repo: 'https://github.com/aabyess/cmarket',
    pos: [17, -38]
  },
  {
    id: 'reboot', no: '03', color: '#7d6ad6',
    name: 'RE:BOOT',
    full: 'RE:BOOT — 번아웃·자기관리 모임 커뮤니티',
    period: '2026.02 — 2026.04', role: '부트캠프 팀 프로젝트',
    one: '관심사 기반으로 모임을 탐색·참여·개설하는 커뮤니티 플랫폼에서 자유게시판 영역 전체를 담당했습니다.',
    pts: [
      '좋아요를 누르면 <b>조회수가 3씩 오르던 버그</b>를 발견해, API가 3중 호출되던 원인을 찾아 중복 요청을 제거했습니다.',
      'queryKey를 파일마다 문자열로 관리하던 방식을 <b>객체로 중앙화</b>해 캐시 불일치와 중복 호출을 없앴습니다.',
      '좋아요 반응이 서버 응답 후에야 반영되어 생기던 지연을 <b>Optimistic Update</b>로 해결했습니다.',
      '섹션마다 빈 상태·에러가 달라 섹션별 ErrorBoundary를 적용해, 일부 API가 실패해도 페이지 전체가 멈추지 않게 했습니다.'
    ],
    stack: ['Next.js', 'TypeScript', 'React Query', 'Zustand', 'Storybook', 'Jest'],
    img: 'images/reboot.png',
    live: 'https://reboot-codeit.vercel.app/', repo: 'https://github.com/aabyess/Reboot',
    pos: [-17, -60]
  },
  {
    id: 'mate', no: '04', color: '#31a88a',
    name: 'Myeonjeop-Mate',
    full: 'Myeonjeop-Mate — AI 기반 면접 준비 플랫폼',
    period: '2025.11 — 2025.12', role: '개인 프로젝트 · 1인 개발',
    one: '이력서를 분석해 맞춤 면접 질문과 답변 피드백을 제공하는 서비스를 기획부터 API 연동까지 혼자 만들었습니다.',
    pts: [
      'PDF·Word 이력서에서 텍스트를 추출해 프롬프트로 구조화하고, <b>맞춤 면접 질문을 자동 생성</b>했습니다.',
      'AI 피드백 응답을 JSON으로 파싱해 구조·내용·키워드·개선 예시 항목별로 즉시 렌더링했습니다.',
      'API 호출 비용을 줄이려고 <b>사용자당 일일 요청 제한</b> 로직을 직접 구현했습니다.'
    ],
    stack: ['React', 'OpenAI API', 'PDF.js', 'Mammoth'],
    img: 'images/interview.png',
    repo: 'https://github.com/aabyess/myeonjeop-mate',
    pos: [17, -82]
  },
  {
    id: 'ignis', no: '05', color: '#d95f8b',
    name: 'IGNIS',
    full: 'IGNIS — 사회공헌 플랫폼',
    period: '2025.03 — 2025.10', role: '팀 프로젝트',
    one: '기부·펀딩·봉사 활동을 연결하는 온라인 사회공헌 플랫폼입니다.',
    pts: [
      'PortOne 결제를 연동하면서, 결제 완료 후 <b>서버 금액과 대조해 승인</b>하는 흐름을 직접 설계해 위변조를 막았습니다.',
      '홈에서 기부·펀딩·봉사를 통합 조회하고 각 도메인에서 참여·등록까지 이어지는 사용자 플로우를 구현했습니다.',
      '등록 폼에서 필수 항목 누락 시 유효성 메시지를 표시해 사용자 실수를 줄였습니다.'
    ],
    stack: ['React', 'Vite', 'React Router', 'Ant Design'],
    img: 'images/ignis.png',
    repo: 'https://github.com/aabyess/Ignis.git',
    pos: [-17, -104]
  },
  {
    id: 'lol', no: '06', color: '#e0a32e',
    name: 'LOL Face Matcher',
    full: 'LOL Face Matcher — 얼굴 인식 챔피언 매칭',
    period: '2025.03 — 2025.06', role: '개인 프로젝트',
    one: '얼굴 사진을 인식해 닮은 League of Legends 챔피언을 찾아주는 머신러닝 웹 서비스입니다.',
    pts: [
      'dlib 기반 모델에서 <b>DeepFace(ArcFace)로 전환</b>해 챔피언 이미지 170장 기준 임베딩 성공률 100%를 달성했습니다.',
      '성별을 고려한 코사인 유사도 알고리즘으로 닮은꼴 매칭을 구현했습니다.',
      'FastAPI와 React 사이 CORS 문제를 파악해 해결하고, 업로드·추천 REST API와 DB 구조를 설계했습니다.'
    ],
    stack: ['React', 'FastAPI', 'Python', 'DeepFace', 'MySQL'],
    img: 'images/lol.png',
    repo: 'https://github.com/aabyess/lol-face-matcher2',
    pos: [17, -126]
  }
];

const SKILLS = [
  { t: 'Frontend', items: [['Next.js', 1], ['React', 1], ['TypeScript', 1], ['TailwindCSS', 1], ['TanStack Query', 1], ['Zustand', 1], ['Three.js', 1], ['Motion', 0], ['Storybook', 0], ['Ant Design', 0]] },
  { t: 'Backend · Data', items: [['Supabase', 1], ['PostgreSQL / RLS', 1], ['REST API 설계', 1], ['FastAPI', 0], ['Python', 0], ['MySQL', 0]] },
  { t: '연동 · 외부 API', items: [['Gemini API', 1], ['OpenAI API', 1], ['Kakao Maps SDK', 1], ['next-intl', 1], ['DeepL', 0], ['PortOne 결제', 0]] },
  { t: '테스트 · 배포', items: [['Vitest', 0], ['Jest', 0], ['Vercel', 0], ['Git / GitHub', 0]] }
];

const PLAY = [
  { icon: '🎮', on: true, status: '개발 중', name: 'GuilRandomDefense', stack: ['Unity 6', 'C#', 'URP', 'NavMesh', 'ScriptableObject'],
    desc: '워크래프트3 유즈맵 "원랜디"에서 영감을 받은 3D 랜덤 디펜스. 유닛 뽑기·조합, 웨이브, 난이도, 사이드 보스, 저장까지 구현했고 유닛·스킬·웨이브는 ScriptableObject 데이터로 정의해 밸런싱합니다. AI 에이전트를 PM·리서치·구현 역할로 나눠 협업합니다.' },
  { icon: '🎤', on: true, status: '개발 중', name: 'AI 커버곡', stack: ['Python', 'FastAPI', 'PyTorch', 'Demucs', 'RVC', 'Redis RQ', 'Next.js'],
    desc: '원곡에서 Demucs로 보컬을 분리하고 RVC로 다른 목소리로 바꿔 커버곡을 만드는 서비스. 유튜브 URL 수집(도메인 제한으로 SSRF 방지), 작업 큐 기반 변환 파이프라인, 결과물의 AI 생성 표시까지 구성했습니다.' },
  { icon: '🪰', on: true, status: '실험 중', name: 'FlyKing — 초파리 뇌 × Blender 몸', stack: ['Python', 'Blender', 'Brian2'],
    desc: '초파리 전뇌 커넥톰 시뮬레이션(Shiu et al. 2024, 공개 모델)을 직접 만든 Blender 초파리 몸(뼈 61개, NeuroMechFly 규격)에 연결하려는 개인 프로젝트. 몸 생성·리깅 스크립트와 걷기·몸단장 클립까지 만들었고, 뇌 신호를 관절 움직임으로 옮기는 단계를 준비 중입니다.' },
  { icon: '🤝', on: true, status: '개발 중', name: 'RentMate', stack: ['Next.js 16', 'React 19', 'TypeScript', 'Supabase', 'TanStack Query', 'TossPayments'],
    desc: '시간제 동행·운동 메이트 매칭 플랫폼. 예약·결제·실시간 채팅·후기·신고·관리자를 도메인별로 나눠 설계하고, 성인인증·채팅 로그 보관 같은 법적 요구사항을 기능 설계에 반영했습니다.' },
  { icon: '🚗', on: true, status: '라이브', name: '이 포트폴리오', stack: ['Three.js', 'Vanilla JS'],
    desc: '빌드 도구 없이 HTML·JS만으로 만든 사이트. 3D 월드와 문서 페이지가 같은 데이터에서 그려집니다.' }
];

const media = p => p.video
  ? `<video src="${p.video}"${p.poster ? ` poster="${p.poster}"` : ''} autoplay loop muted playsinline preload="metadata"></video>`
  : `<img src="${p.img}" alt="${p.name} 화면" loading="lazy" decoding="async" />`;

const links = p => `
  ${p.live ? `<a class="live" href="${p.live}" target="_blank" rel="noopener">라이브 ↗</a>` : ''}
  ${p.repo ? `<a href="${p.repo}" target="_blank" rel="noopener">GitHub</a>` : ''}`;

/* ════════════════════════════════════════════════════════════
   문서 뷰 렌더링
   ════════════════════════════════════════════════════════════ */
const VISIBLE_PTS = 3;   // 나머지는 "더 보기"로 접는다

function renderDoc() {
  document.getElementById('d-sk').innerHTML = SKILLS.map((g, i) => `
    <div class="sk-g">
      <div class="sk-t"><i>${String(i + 1).padStart(2, '0')}</i> ${g.t}</div>
      <ul class="sk-l">${g.items.map(([n, key]) => `<li class="${key ? 'k' : ''}">${n}</li>`).join('')}</ul>
    </div>`).join('');

  document.getElementById('d-projects').innerHTML = PROJECTS.map(p => `
    <article class="pj">
      <div class="pj-top">
        <span class="pj-no">${p.no}</span>
        <span class="pj-role">${p.role}</span>
        <span class="pj-per">${p.period}</span>
      </div>
      <div class="pj-hd">
        <h3 class="pj-n">${p.full}</h3>
        <p class="pj-one">${p.one}</p>
      </div>
      <div class="pj-grid">
        <div class="pj-txt">
          <ul class="pts" data-pts>
            ${p.pts.map((t, i) => `<li class="${i >= VISIBLE_PTS ? 'hide' : ''}">${t}</li>`).join('')}
          </ul>
          <div class="stk">${p.stack.map(s => `<span>${s}</span>`).join('')}</div>
          <div class="lk">${links(p)}</div>
        </div>
        <div class="pj-shot">${media(p)}</div>
      </div>
    </article>`).join('');

  document.getElementById('d-pg').innerHTML = PLAY.map(p => `
    <div class="pgc">
      <div class="pgc-t"><div class="pgc-i">${p.icon}</div><div class="pgc-s ${p.on ? 'on' : ''}">${p.status}</div></div>
      <div class="pgc-n">${p.name}</div>
      <p class="pgc-d">${p.desc}</p>
      <div class="stk">${p.stack.map(s => `<span>${s}</span>`).join('')}</div>
    </div>`).join('');

  /* 접힌 불릿 토글 */
  document.querySelectorAll('#doc-root [data-pts]').forEach(ul => {
    const hidden = ul.querySelectorAll('li.hide');
    if (!hidden.length) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'more';
    btn.setAttribute('aria-expanded', 'false');
    const label = () => `+ 상세 내용 ${hidden.length}개 더 보기`;
    btn.textContent = label();
    ul.insertAdjacentElement('afterend', btn);
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      hidden.forEach(li => li.classList.toggle('hide', open));
      btn.setAttribute('aria-expanded', String(!open));
      btn.textContent = open ? label() : '− 접기';
    });
  });
}
renderDoc();

/* ════════════════════════════════════════════════════════════
   뷰 전환

   기본은 게임. 문서 섹션을 가리키는 해시(#doc, #top, #d-*)면 문서로 연다.
   덕분에 "...#doc" 링크를 채용 담당자에게 바로 보낼 수 있다.
   ════════════════════════════════════════════════════════════ */
const DOC_HASH = /^#(doc|top|d-)/;
const viewFromHash = () => (DOC_HASH.test(location.hash) ? 'doc' : 'drive');

let driveActive = false;

function setView(v, { updateHash = true } = {}) {
  document.body.dataset.view = v;
  driveActive = v === 'drive';

  if (updateHash) {
    if (v === 'doc') {
      if (!DOC_HASH.test(location.hash)) location.hash = '#doc';
    } else {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  if (v === 'drive') {
    /* 3D 초기화가 어떤 이유로든 실패하면 로딩 화면에 갇히지 않고 문서 뷰로 넘긴다 */
    initDrive().catch(err => {
      console.error('3D 초기화 실패:', err);
      const load = document.getElementById('g-load');
      if (load) {
        load.innerHTML = '<div class="n">3D 화면을 불러오지 못했습니다</div>' +
                         '<div class="s">문서 뷰로 대신 보여드리겠습니다.</div>';
      }
      setTimeout(() => setView('doc'), 1600);
    });
  } else {
    /* 게임에서 넘어올 땐 맨 위부터 읽게 한다 (앵커로 들어온 경우는 그대로 둔다) */
    if (location.hash === '#doc') scrollTo(0, 0);
  }
}

document.querySelectorAll('.swap').forEach(b =>
  b.addEventListener('click', () => setView(b.dataset.go))
);
addEventListener('hashchange', () => setView(viewFromHash(), { updateHash: false }));

/* ════════════════════════════════════════════════════════════
   게임 뷰 — 처음 열릴 때 한 번만 초기화한다.
   문서로 바로 들어온 사람은 three.js를 아예 내려받지 않는다.
   ════════════════════════════════════════════════════════════ */

/* 차 모델. null로 두면 박스로 조립한 기본 차가 쓰인다.
   현재 모델은 Kenney Car Kit(CC0)의 hatchback-sports. models/README.md 참고. */
const CAR_MODEL_URL = 'models/car-red.glb';   // Blender에서 빨간 도장·헤드라이트·루프랙으로 다듬은 차

/* 바퀴 노드 이름. 앞에 있는 이름부터 찾는다.
   Blender에서 직접 만들 땐 wheel_fl 같은 이름을 쓰면 되고,
   Kenney 킷처럼 다른 규칙으로 된 모델도 그대로 인식된다. */
const WHEEL_SPEC = [
  { front: true,  names: ['wheel_fl', 'wheel-front-left',  'wheel_front_left'] },
  { front: true,  names: ['wheel_fr', 'wheel-front-right', 'wheel_front_right'] },
  { front: false, names: ['wheel_rl', 'wheel-back-left',   'wheel_rear_left'] },
  { front: false, names: ['wheel_rr', 'wheel-back-right',  'wheel_rear_right'] }
];

/* 캐릭터 모델. null이면 박스로 조립한 기본 캐릭터를 쓴다.
   리깅된 .glb를 넣으면 애니메이션(idle/run)을 자동으로 찾아 쓴다. */
const CHAR_MODEL_URL = null;
const CHAR_HEIGHT = 1.95;   // 월드 기준 키. glb도 여기에 맞춰 크기를 맞춘다.

let driveReady = false;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

async function initDrive() {
  if (driveReady) return;
  driveReady = true;

  const load = document.getElementById('g-load');

  if (!hasWebGL()) {
    load.innerHTML = `<div class="n">3D를 표시할 수 없는 환경입니다</div>
      <div class="s">문서 뷰로 대신 보여드리겠습니다.</div>`;
    setTimeout(() => setView('doc'), 1400);
    return;
  }

  await document.fonts.ready;   // 캔버스에 한글을 굽기 전에 웹폰트를 기다린다

  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

  /* ── 월드 크기 ──
     원형 광장에서 직선 고속도로로 바꿨다. 차는 (0,14)에서 -Z를 향해 출발하고
     게시판이 도로 좌우에 번갈아 선다. 경계는 원이 아니라 사각형이다. */
  const CAR_LEN = 4.2, PAD_R = 7.5;
  const ROAD_HALF = 9;                                   // 포장도로 반폭
  const BOUND = { x: 39, zMin: -39, zMax: 39 };          // 가을 숲 월드(84×84) 안

  const NEON_PINK = 0xff3d9a, NEON_CYAN = 0x2de2ff, SUN_WARM = 0xff8c42;

  const scene = new THREE.Scene();
  /* 안개 색을 노을의 지평선 색에 맞춰야 멀리가 하늘로 자연스럽게 녹는다 */

  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.5, 500);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;    // 네온이 하얗게 타지 않게
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('drive-root').appendChild(renderer.domElement);

  /* ════ 가을 숲 월드 ════
     Blender에서 만든 장면을 glb로 내보내 쓰고, 지형 높이·풀 자리·가판대 좌표는 JSON으로 받는다.
     웹에서 버거운 풀·낙엽·바람은 여기서 가볍게 다시 만든다. */
  const WORLD = await (await fetch('models/autumn-world.json')).json();
  const GRID = WORLD.grid;
  const pathX = z => WORLD.path.amp * Math.sin(-WORLD.path.k * z);
  /* Blender 격자(위가 +Y)를 웹 좌표(-Z가 앞)로 읽는다 */
  function heightAt(x, z) {
    const n = GRID.n;
    const fx = Math.min(n - 1.001, Math.max(0, (x + GRID.half) / GRID.step));
    const fy = Math.min(n - 1.001, Math.max(0, (-z + GRID.half) / GRID.step));
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const h = (i, j) => GRID.h[j * n + i];
    return (h(ix, iy) * (1 - tx) + h(ix + 1, iy) * tx) * (1 - ty) + (h(ix, iy + 1) * (1 - tx) + h(ix + 1, iy + 1) * tx) * ty;
  }
  function bridgeY(x, z) {
    const B = WORLD.bridge;
    if (z < B.z0 || z > B.z1 || Math.abs(x - pathX(z)) > B.halfW) return null;
    return B.top + B.arch * Math.sin(Math.PI * (z - B.z0) / (B.z1 - B.z0));
  }
  /* 차·캐릭터가 밟는 높이. 다리 위면 다리, 아니면 지형 */
  function groundY(x, z) {
    const b = bridgeY(x, z);
    if (b !== null) return b;
    const onPath = Math.abs(x - pathX(z)) < WORLD.path.half;
    return Math.max(heightAt(x, z), onPath ? 0.04 : -9, WORLD.stream.water - 0.25);
  }

  const timeU = { value: 0 };   // 바람·물결 셰이더 공용 시간

  /* ── 하늘 · 안개 ── */
  scene.fog = new THREE.Fog(0x6a3a6e, 38, 120);
  {
    const cv = document.createElement('canvas');
    cv.width = 8; cv.height = 256;
    const g = cv.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.00, '#2a1745');
    grad.addColorStop(0.45, '#5b2f6e');
    grad.addColorStop(0.70, '#9e4d78');
    grad.addColorStop(0.86, '#e07a6a');
    grad.addColorStop(1.00, '#ffb27a');
    g.fillStyle = grad; g.fillRect(0, 0, 8, 256);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(320, 32, 20),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
    ));
  }

  /* ── 조명 — 낮게 깔린 노을 해 ── */
  scene.add(new THREE.HemisphereLight(0xffc29a, 0x3a2050, 1.25));
  const sun = new THREE.DirectionalLight(0xffa868, 2.6);
  sun.position.set(-34, 38, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 160 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9a7cff, 0.55);
  fill.position.set(40, 20, -30);
  scene.add(fill);

  /* 월드 바깥 바닥 — 지형 가장자리가 허공에 뜨지 않게 */
  {
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ color: 0x6e3412, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.6; outer.receiveShadow = true;
    scene.add(outer);
  }

  /* 셰이더에 바람을 끼워 넣는다. 높이(h)가 클수록 많이 흔들린다 */
  function addWind(mat, code) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = timeU;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + code);
    };
  }

  /* ── Blender 월드 glb ── */
  const worldManager = new THREE.LoadingManager();
  new GLTFLoader(worldManager).load('models/autumn-world.glb', gltf => {
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        m.flatShading = true; m.needsUpdate = true;
        if (o.name.includes('Leaves')) {
          addWind(m, `float lw = sin(uTime*1.3 + position.x*0.45 + position.z*0.3) + 0.5*sin(uTime*2.3 + position.x*1.1);
            transformed += vec3(0.07, 0.025, 0.05) * lw * smoothstep(1.5, 4.5, position.y);`);
        }
        if (o.name.includes('Water')) {
          m.transparent = true; m.opacity = 0.9; m.roughness = 0.08;
          m.emissive = new THREE.Color(0x4a2fb0); m.emissiveIntensity = 0.45;
          addWind(m, `transformed.y += 0.05*sin(uTime*2.0 + position.x*1.6 + position.z*0.9);`);
        }
      }
      if (o.name.includes('Water')) o.castShadow = false;
    });
    scene.add(gltf.scene);
  });

  /* ── 풀 — 인스턴스 하나로 수만 장, 셰이더로 바람에 눕는다 ── */
  {
    const blade = new THREE.BufferGeometry();
    const w = 0.06, hgt = 0.5;
    blade.setAttribute('position', new THREE.Float32BufferAttribute([
      -w, 0, 0,  w, 0, 0,  0, hgt, 0,
      0, 0, -w,  0, 0, w,  0, hgt, 0], 3));
    blade.computeVertexNormals();
    const gm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85, side: THREE.DoubleSide });
    addWind(gm, `vec4 gw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float gs = sin(uTime*1.8 + gw.x*0.35 + gw.z*0.25)*0.6 + sin(uTime*3.1 + gw.x*0.9 - gw.z*0.4)*0.25 + 0.25;
      transformed.x += gs * position.y * 0.55; transformed.z += gs * position.y * 0.2;`);
    const cols = [0xd99a4e, 0xc77a3a, 0xe8b868, 0xb0683a].map(c => new THREE.Color(c));
    const spots = [];
    const n = GRID.n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (GRID.mask[j * n + i] < 0.6) continue;
      for (let k = 0; k < 2; k++) spots.push([-GRID.half + (i + Math.random() - .5) * GRID.step, GRID.half - (j + Math.random() - .5) * GRID.step]);
    }
    const grass = new THREE.InstancedMesh(blade, gm, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    spots.forEach(([x, z], i) => {
      e.set((Math.random() - .5) * 0.5, Math.random() * Math.PI, (Math.random() - .5) * 0.5);
      const k = 0.55 + Math.random() * 0.6;
      m4.compose(ps.set(x, heightAt(x, z), z), q.setFromEuler(e), sc.set(k, k, k));
      grass.setMatrixAt(i, m4);
      grass.setColorAt(i, cols[i % 4]);
    });
    grass.receiveShadow = true;
    scene.add(grass);
  }

  /* ── 날리는 낙엽 ── */
  const fallingLeaves = (() => {
    const N = 260;
    const geo = new THREE.PlaneGeometry(0.22, 0.16);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .7 }), N);
    const cols = [0xe0461c, 0xff9a2e, 0xb3264d, 0xffc04d].map(c => new THREE.Color(c));
    const st = [];
    for (let i = 0; i < N; i++) {
      st.push({ x: (Math.random() - .5) * 80, y: Math.random() * 10, z: (Math.random() - .5) * 80,
        vy: 0.6 + Math.random() * 0.8, ph: Math.random() * 6.3, sp: 1 + Math.random() * 2 });
      mesh.setColorAt(i, cols[i % 4]);
    }
    scene.add(mesh);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    return (dt, t, cx, cz) => {
      st.forEach((l, i) => {
        l.y -= l.vy * dt;
        l.x += (2.2 + Math.sin(t * 0.7 + l.ph) * 1.2) * dt;
        l.z += Math.cos(t * 0.9 + l.ph) * 0.8 * dt;
        if (l.y < heightAt(l.x, l.z) || Math.abs(l.x - cx) > 40 || Math.abs(l.z - cz) > 40) {
          l.x = cx + (Math.random() - .7) * 60; l.z = cz + (Math.random() - .5) * 60; l.y = 6 + Math.random() * 6;
        }
        e.set(t * l.sp + l.ph, t * l.sp * 0.7, l.ph);
        m4.compose(p.set(l.x, l.y, l.z), q.setFromEuler(e), one);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
  })();

  /* 사각형 경계 안으로 되돌린다. 부딪혔으면 true. */
  function clampToBounds(pos) {
    let hit = false;
    if (pos.x < -BOUND.x) { pos.x = -BOUND.x; hit = true; }
    else if (pos.x > BOUND.x) { pos.x = BOUND.x; hit = true; }
    if (pos.z < BOUND.zMin) { pos.z = BOUND.zMin; hit = true; }
    else if (pos.z > BOUND.zMax) { pos.z = BOUND.zMax; hit = true; }
    return hit;
  }

  /* ── 자동차 ── */
  const car = new THREE.Group();
  scene.add(car);

  let parts = { wheels: [], tilt: [] };

  const stockCar = new THREE.Group();
  {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe8734a, roughness: .45, metalness: .1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b3840, roughness: .6 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fc6d9, roughness: .2, metalness: .3 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.8, CAR_LEN), bodyMat);
    chassis.position.y = 0.95; chassis.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.78, 2.1), bodyMat);
    cabin.position.set(0, 1.68, -0.18); cabin.castShadow = true;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.56, 2.16), glassMat);
    windshield.position.set(0, 1.72, -0.18);
    stockCar.add(chassis, cabin, windshield);

    const wheelGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.44, 18);
    for (const [x, z, front] of [[-1.16, 1.32, true], [1.16, 1.32, true], [-1.16, -1.36, false], [1.16, -1.36, false]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.58, z);
      const w = new THREE.Mesh(wheelGeo, darkMat);
      w.rotation.z = Math.PI / 2; w.castShadow = true;
      pivot.add(w);
      stockCar.add(pivot);
      parts.wheels.push({ steerNode: pivot, spinNode: w, front, r: 0.58 });
    }
    parts.tilt = [chassis, cabin, windshield];
  }
  car.add(stockCar);

  if (CAR_MODEL_URL) new GLTFLoader().load(CAR_MODEL_URL, gltf => {
    const model = gltf.scene;
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    if (size.z > 0.0001) model.scale.setScalar(CAR_LEN / size.z);
    const box = new THREE.Box3().setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box.min.y;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    const wheels = [];
    for (const spec of WHEEL_SPEC) {
      let node = null;
      for (const n of spec.names) { node = model.getObjectByName(n); if (node) break; }
      if (!node) continue;
      node.rotation.order = 'YXZ';          // 조향(Y)을 먼저, 구르기(X)를 나중에
      const r = new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3()).y / 2;
      wheels.push({ steerNode: node, spinNode: node, front: spec.front, r: r > 0.05 ? r : 0.58 });
    }
    car.remove(stockCar);
    car.add(model);
    parts = { wheels, tilt: [model] };
  }, undefined, () => { /* 없으면 기본 차 유지 */ });

  /* ── 캐릭터 ──
     차와 같은 방식. CHAR_MODEL_URL에 애니메이션이 든 .glb를 주면 교체되고,
     없으면 아래 박스로 조립한 기본 캐릭터가 절차적으로 움직인다. */
  const person = new THREE.Group();
  person.visible = false;          // 차에서 시작하므로 처음엔 숨김
  scene.add(person);

  const limbs = {};
  {
    const skin = new THREE.MeshStandardMaterial({ color: 0xf0bc95, roughness: .85 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x3fa7d6, roughness: .8 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x3b4a57, roughness: .85 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: .8 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: .9 });

    const box = (w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      return m;
    };
    person.add(
      box(0.62, 0.72, 0.34, shirt, 0, 1.12, 0),   // 몸통
      box(0.46, 0.46, 0.44, skin, 0, 1.71, 0),    // 머리
      box(0.50, 0.16, 0.48, hair, 0, 1.93, 0)     // 머리카락
    );

    /* 팔다리는 어깨·골반을 회전축으로 삼아야 자연스럽게 흔들린다 */
    const limb = (w, h, d, mat, x, y, footMat) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.y = -h / 2;
      m.castShadow = true;
      pivot.add(m);
      if (footMat) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, 0.16, d * 1.5), footMat);
        f.position.set(0, -h + 0.02, 0.06);
        f.castShadow = true;
        pivot.add(f);
      }
      person.add(pivot);
      return pivot;
    };

    limbs.armL = limb(0.18, 0.62, 0.2, skin, 0.4, 1.42);
    limbs.armR = limb(0.18, 0.62, 0.2, skin, -0.4, 1.42);
    limbs.legL = limb(0.24, 0.76, 0.26, pants, 0.16, 0.78, shoe);
    limbs.legR = limb(0.24, 0.76, 0.26, pants, -0.16, 0.78, shoe);
  }

  /* 리깅된 glb를 쓸 때의 애니메이션 믹서 */
  let charMixer = null, charAction = null;
  const charClips = {};

  if (CHAR_MODEL_URL) new GLTFLoader().load(CHAR_MODEL_URL, gltf => {
    const model = gltf.scene;
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    if (size.y > 0.0001) model.scale.setScalar(CHAR_HEIGHT / size.y);
    const b = new THREE.Box3().setFromObject(model);
    const c = b.getCenter(new THREE.Vector3());
    model.position.x -= c.x; model.position.z -= c.z; model.position.y -= b.min.y;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    for (const child of [...person.children]) person.remove(child);
    person.add(model);
    limbs.armL = limbs.armR = limbs.legL = limbs.legR = null;

    charMixer = new THREE.AnimationMixer(model);
    /* "Armature|Run" 같은 접두사를 떼고 소문자 키로 정리 */
    for (const clip of gltf.animations) charClips[clip.name.split('|').pop().toLowerCase()] = clip;
  }, undefined, () => { /* 없으면 기본 캐릭터 유지 */ });

  /* ── 텍스트 ── */
  function labelSprite(text, sub, color) {
    const W = 640, H = 200, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,.94)';
    const r = 26;
    g.beginPath();
    g.moveTo(r, 8); g.lineTo(W - r, 8); g.quadraticCurveTo(W - 8, 8, W - 8, 8 + r);
    g.lineTo(W - 8, H - 8 - r); g.quadraticCurveTo(W - 8, H - 8, W - 8 - r, H - 8);
    g.lineTo(r, H - 8); g.quadraticCurveTo(8, H - 8, 8, H - 8 - r);
    g.lineTo(8, 8 + r); g.quadraticCurveTo(8, 8, r, 8);
    g.closePath(); g.fill();
    g.fillStyle = color; g.fillRect(8, H - 20, W - 16, 12);
    g.textAlign = 'center';
    g.fillStyle = '#1d2a33';
    g.font = '700 58px Pretendard, system-ui, sans-serif';
    g.fillText(text, W / 2, 84);
    g.fillStyle = '#5b6d79';
    g.font = '500 32px Pretendard, system-ui, sans-serif';
    g.fillText(sub, W / 2, 132);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    sp.scale.set(9.6, 3, 1);
    return sp;
  }


  /* ── 장난감 이름 블록 ──
     차로 들이받으면 장난감처럼 무너진다. 물리는 cannon-es로 계산하고, 차와 캐릭터는
     물리에 끌려가지 않는 '키네마틱' 몸체로 넣어 블록만 밀어낸다. R로 다시 쌓는다. */
  const CANNON = await import('cannon-es');
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -24, 0) });
  world.allowSleep = true;
  world.defaultContactMaterial.friction = 0.42;
  world.defaultContactMaterial.restitution = 0.12;
  {
    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(ground);
  }
  const carBody = new CANNON.Body({ type: CANNON.Body.KINEMATIC, shape: new CANNON.Box(new CANNON.Vec3(1.05, 0.75, 2.15)) });
  const personBody = new CANNON.Body({ type: CANNON.Body.KINEMATIC, shape: new CANNON.Sphere(0.55) });
  /* 멈춰 있던 차가 '잠들면' 충돌 계산에서 빠져 블록을 그냥 통과한다 */
  carBody.allowSleep = false; personBody.allowSleep = false;
  world.addBody(carBody); world.addBody(personBody);

  const toyBlocks = [];
  const { RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js');
  const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
  const tint = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#fff8ee'), k).getHexString();
  /* 블록 앞면 타일: 밝은 둥근 패널 위에 블록 색 글자, 아래로 짙은 그림자를 깔아 도톰해 보이게 */
  function tileTexture(ch, color) {
    const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const r = 70, m = 26;
    c.beginPath(); c.roundRect(m, m, S - m * 2, S - m * 2, r);
    c.fillStyle = tint(color, 0.82); c.fill();
    c.lineWidth = 10; c.strokeStyle = tint(color, 0.55); c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `900 ${ch.length > 1 ? 230 : 330}px Pretendard, system-ui, sans-serif`;
    c.fillStyle = shade(color, 0.55); c.fillText(ch, S / 2 + 10, S / 2 + 30);   // 입체 그림자
    c.fillStyle = color; c.fillText(ch, S / 2, S / 2 + 18);
    c.fillStyle = 'rgba(255,255,255,.35)';                                        // 위쪽 반사광
    c.beginPath(); c.roundRect(m + 30, m + 22, S - (m + 30) * 2, 34, 17); c.fill();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  function toyBlock(ch, w, h, d, x, y, z, color, mass) {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 4, Math.min(w, h, d) * 0.16),
      new THREE.MeshPhysicalMaterial({ color, roughness: .38, clearcoat: .7, clearcoatRoughness: .25 })
    );
    mesh.castShadow = true; mesh.receiveShadow = true;
    /* 앞·뒤에 타일을 붙인다 (뒤에서 봐도 글자가 보이게) */
    const tile = new THREE.MeshStandardMaterial({ map: tileTexture(ch, color), transparent: true, roughness: .5 });
    for (const side of [1, -1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, h * 0.86), tile);
      pl.position.z = side * (d / 2 + 0.004);
      if (side < 0) pl.rotation.y = Math.PI;
      mesh.add(pl);
    }
    scene.add(mesh);
    const body = new CANNON.Body({ mass, shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
      linearDamping: 0.08, angularDamping: 0.12, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.6 });
    body.position.set(x, y, z);
    world.addBody(body);
    const b = { mesh, body, home: new CANNON.Vec3(x, y, z) };
    toyBlocks.push(b);
    mesh.position.set(x, y, z);
    return b;
  }
  /* 출발점 바로 앞 숲길 위 */
  const NAME_Z = WORLD.start.z - 7, ROW_Z = WORLD.start.z - 4.6;
  const NAME = [['최', '#ff6b3d'], ['상', '#1fa59c'], ['호', '#e8466e']];
  NAME.forEach(([ch, c], i) => toyBlock(ch, 2.1, 2.1, 1.05, pathX(NAME_Z) + (i - 1) * 2.35, 1.05, NAME_Z, c, 3));
  const SMALL = ['#f4a53c', '#3a9fc4', '#e8466e', '#2bb38f', '#8a6ad8'];
  /* 작은 큐브 한 줄: FULLSTACK · DEV (가운데 한 칸 띄움) */
  [...'FULLSTACK DEV'].forEach((ch, i) => { if (ch !== ' ') toyBlock(ch, 0.74, 0.74, 0.74, pathX(ROW_Z) + (i - 6) * 0.8, 0.37, ROW_Z, SMALL[i % 5], 0.6); });

  function restackBlocks() {
    /* 차나 캐릭터가 블록 자리에 서 있으면 다시 쌓는 순간 블록이 튕겨 나간다. 출발점으로 옮긴다 */
    const inArea = p => Math.abs(p.x - pathX(NAME_Z)) < 6.5 && p.z > NAME_Z - 2.5 && p.z < ROW_Z + 2.5;
    const sz = WORLD.start.z;
    if (inArea(car.position)) { car.position.set(pathX(sz), groundY(pathX(sz), sz), sz); heading = Math.PI; speed = 0; prevCar.copy(car.position); }
    if (person.visible && inArea(person.position)) person.position.set(pathX(sz) + 3, person.position.y, sz - 1);
    for (const b of toyBlocks) {
      b.body.position.copy(b.home);
      b.body.quaternion.set(0, 0, 0, 1);
      b.body.velocity.setZero(); b.body.angularVelocity.setZero();
      b.body.wakeUp();
    }
  }
  const prevCar = new THREE.Vector3();
  function physicsStep(dt) {
    /* 키네마틱 몸체는 속도를 넣어줘야 부딪힌 블록에 힘이 제대로 전달된다 */
    carBody.velocity.set((car.position.x - prevCar.x) / dt, 0, (car.position.z - prevCar.z) / dt);
    prevCar.copy(car.position);
    carBody.position.set(car.position.x, car.position.y + 0.85, car.position.z);
    carBody.quaternion.setFromEuler(0, car.rotation.y, 0);
    if (person.visible) personBody.position.set(person.position.x, person.position.y + 0.9, person.position.z);
    else personBody.position.set(0, -50, 0);
    world.step(1 / 60, dt, 3);
    for (const b of toyBlocks) {
      if (b.body.position.y < -20) { b.body.position.copy(b.home); b.body.velocity.setZero(); }
      b.mesh.position.copy(b.body.position);
      b.mesh.quaternion.copy(b.body.quaternion);
    }
  }

  /* ── 프로젝트 스테이션 ── */
  const manager = new THREE.LoadingManager();
  const texLoader = new THREE.TextureLoader(manager);
  const stations = [];

  /* 가판대 자리는 Blender에서 세운 6곳 (최신 프로젝트가 출발점에서 가장 가깝다) */
  PROJECTS.forEach((p, i) => { const st = WORLD.stalls[i]; if (st) p.pos = [st.x, st.z]; });
  for (const p of PROJECTS) {
    const g = new THREE.Group();
    g.position.set(p.pos[0], Math.max(0, heightAt(p.pos[0], p.pos[1])), p.pos[1]);
    g.scale.setScalar(0.62);   // 숲 길 폭에 맞춘 크기
    const col = new THREE.Color(p.color);

    /* ── 노점상 손수레 ──
       가판대는 도로를 정면으로 보고 고정된다. 간판(face)만 따로 카메라를 향해 돈다. */
    g.rotation.y = Math.atan2(pathX(p.pos[1]) - p.pos[0], 0.0001);   // 길 쪽을 본다
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a4a26, roughness: .85 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x4a2817, roughness: .9 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xfff1d8, roughness: .7 });
    const paint = new THREE.MeshStandardMaterial({ color: col, roughness: .55 });
    const add = (geo, mat, x, y, z, parent = g) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    };

    /* 바닥에 깔린 색 원 — 가까이 가면 살짝 숨 쉬듯 커진다 */
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(PAD_R - 0.6, PAD_R, 48),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .55, fog: false })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
    g.add(ring);

    /* 수레 몸통 + 색 띠 + 상판 */
    add(new THREE.BoxGeometry(7, 1.5, 2.2), wood, 0, 1.05, 0);
    add(new THREE.BoxGeometry(7.04, 0.45, 2.24), paint, 0, 1.25, 0);
    add(new THREE.BoxGeometry(7.6, 0.18, 2.7), woodDark, 0, 1.88, 0.1);
    /* 바퀴 두 개 */
    for (const dx of [-2.6, 2.6]) {
      const wh = add(new THREE.CylinderGeometry(0.62, 0.62, 0.25, 16), woodDark, dx, 0.62, 1.2);
      wh.rotation.x = Math.PI / 2;
    }
    /* 기둥 네 개 */
    for (const dx of [-3.4, 3.4]) for (const dz of [-0.9, 1.1]) add(new THREE.BoxGeometry(0.16, 2.6, 0.16), wood, dx, 3.1, dz);
    /* 줄무늬 차양 — 앞으로 기울어진 판 여러 장 */
    for (let i = 0; i < 9; i++) {
      const a = add(new THREE.BoxGeometry(0.86, 0.08, 3.2), i % 2 ? cream : paint, -3.45 + i * 0.86, 4.55, 0.4);
      a.rotation.x = 0.22;
    }
    /* 차양 끝 물결 장식 */
    for (let i = 0; i < 9; i++) {
      const f = add(new THREE.ConeGeometry(0.43, 0.42, 3), i % 2 ? cream : paint, -3.45 + i * 0.86, 4.08, 2.0);
      f.rotation.set(Math.PI, Math.PI / 6, 0);
    }
    /* 전구 줄 */
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, fog: false });
    for (let i = 0; i < 11; i++) {
      const x = -3.5 + i * 0.7;
      add(new THREE.SphereGeometry(0.11, 8, 6), bulbMat, x, 3.86 - Math.sin(i / 10 * Math.PI) * 0.22, 2.15);
    }
    /* 상판 위 소품 — 상자와 번호판 */
    add(new THREE.BoxGeometry(0.9, 0.7, 0.8), wood, -2.4, 2.32, 0.3).rotation.y = 0.3;
    add(new THREE.BoxGeometry(0.7, 0.55, 0.7), paint, -1.55, 2.25, 0.5).rotation.y = -0.2;
    add(new THREE.BoxGeometry(1.1, 0.8, 0.9), wood, 4.3, 0.4, 1.6).rotation.y = 0.5;
    add(new THREE.BoxGeometry(0.8, 0.6, 0.7), paint, 4.6, 1.1, 1.5).rotation.y = 0.2;

    /* 따뜻한 가판대 불빛 */
    const glow = new THREE.PointLight(0xffb070, 14, 18, 2);
    glow.position.set(0, 3.6, 1.6);
    g.add(glow);

    /* 간판은 수레 뒤에 서서 카메라를 향해 돈다 */
    const face = new THREE.Group();
    face.position.set(0, 0, -2.6);
    g.add(face);
    const boardW = 9.4, boardH = 5.9;
    for (const dx of [-3.4, 3.4]) add(new THREE.BoxGeometry(0.28, 5.2, 0.28), woodDark, dx, 2.6, -0.2, face);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(boardW + 0.7, boardH + 0.7, 0.3),
      woodDark
    );
    frame.position.set(0, 5.1 + boardH / 2, 0);
    frame.castShadow = true;
    face.add(frame);
    /* 간판 테두리는 프로젝트 색 페인트 */
    const edge = new THREE.Mesh(new THREE.BoxGeometry(boardW + 1.1, boardH + 1.1, 0.16), paint);
    edge.position.set(0, frame.position.y, -0.1);
    face.add(edge);

    const screenMat = new THREE.MeshBasicMaterial({ color: 0xdfe6ea });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(boardW, boardH), screenMat);
    screen.position.set(0, frame.position.y, 0.17);
    face.add(screen);

    /* 정지 이미지를 먼저 붙인다. 영상만 쓰면 재생 시작 전까지 게시판이 검게 남고,
       자동재생이 막힌 환경(절전 모드 등)에서는 영원히 검은 판이 된다. */
    const still = p.img || p.poster;
    if (still) {
      texLoader.load(still, t => {
        t.colorSpace = THREE.SRGBColorSpace;
        /* 그 사이 영상이 이미 올라왔으면 덮어쓰지 않는다 */
        if (screenMat.userData.video) return;
        screenMat.map = t; screenMat.color.set(0xffffff); screenMat.needsUpdate = true;
      });
    }

    if (p.video) {
      const v = document.createElement('video');
      Object.assign(v, { src: p.video, loop: true, muted: true, playsInline: true, autoplay: true });
      /* 실제로 재생이 시작된 뒤에 교체한다 */
      v.addEventListener('playing', () => {
        const vt = new THREE.VideoTexture(v);
        vt.colorSpace = THREE.SRGBColorSpace;
        screenMat.map = vt;
        screenMat.color.set(0xffffff);
        screenMat.needsUpdate = true;
        screenMat.userData.video = v;
      }, { once: true });
      v.play().catch(() => { /* 자동재생이 막히면 정지 이미지로 남는다 */ });
    }

    const label = labelSprite(p.name, p.role, p.color);
    label.position.set(0, frame.position.y + boardH / 2 + 2.1, 0);
    face.add(label);

    scene.add(g);
    stations.push({ ...p, group: g, face, ring, label, labelY: label.position.y, phase: Math.random() * Math.PI * 2 });
  }

  /* ── 조작 ── */
  const keys = Object.create(null);
  const KEYMAP = {
    ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'brake'
  };
  const hint = document.getElementById('g-hint');
  let hintHidden = false;
  const hideHint = () => { if (!hintHidden) { hintHidden = true; hint.classList.add('hide'); } };

  addEventListener('keydown', e => {
    if (!driveActive) return;                 // 문서 뷰에서는 키를 가로채지 않는다
    /* 프로젝트 창이 떠 있으면 Space·Esc로 닫기만 하고 운전 입력은 받지 않는다 */
    if (panelOpen()) {
      if (e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); closePanel(); }
      return;
    }
    /* 게시판 근처에서 Space는 브레이크가 아니라 "프로젝트 보기" */
    if (e.code === 'Space' && promptFor) { e.preventDefault(); openPanel(promptFor); hideHint(); return; }
    if (e.code === 'KeyR') { e.preventDefault(); restackBlocks(); return; }
    const k = KEYMAP[e.code];
    if (k) { keys[k] = true; e.preventDefault(); hideHint(); }
    if (e.code === 'KeyF') { e.preventDefault(); toggleVehicle(); hideHint(); }
    if (e.code === 'Escape') closePanel();
  });
  addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });

  if (matchMedia('(hover: none) and (pointer: coarse)').matches) document.body.classList.add('is-touch');
  document.querySelectorAll('.tkey[data-k]').forEach(el => {
    const k = el.dataset.k;
    const on = e => { e.preventDefault(); keys[k] = true; hideHint(); };
    const off = e => { e.preventDefault(); keys[k] = false; };
    el.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, off));
  });
  /* 승하차는 눌렀다 떼는 동작이 아니라 한 번의 명령이다 */
  document.querySelectorAll('.tkey[data-act="toggle"]').forEach(el => {
    el.addEventListener('pointerdown', e => { e.preventDefault(); toggleVehicle(); hideHint(); });
  });

  /* ── 주행 ── */
  const MAX_FWD = 15, MAX_REV = 7, ACCEL = 12, BRAKE = 30, DRAG = 6, TURN = 1.9;
  let speed = 0, heading = Math.PI, steer = 0;
  const START_Z = WORLD.start.z;
  car.position.set(pathX(START_Z), 0, START_Z);

  function drive(dt) {
    const want = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    steer += (want - steer) * Math.min(1, dt * 9);

    if (keys.fwd) speed += ACCEL * dt;
    else if (keys.back) speed -= ACCEL * dt;
    else {
      const d = DRAG * dt;
      speed = Math.abs(speed) <= d ? 0 : speed - Math.sign(speed) * d;
    }
    if (keys.brake) {
      const d = BRAKE * dt;
      speed = Math.abs(speed) <= d ? 0 : speed - Math.sign(speed) * d;
    }
    speed = Math.max(-MAX_REV, Math.min(MAX_FWD, speed));

    const grip = Math.min(1, Math.abs(speed) / 5);
    heading += steer * TURN * dt * grip * Math.sign(speed || 1);

    car.position.x += Math.sin(heading) * speed * dt;
    car.position.z += Math.cos(heading) * speed * dt;

    if (clampToBounds(car.position)) speed *= 0.3;
    car.position.y += (groundY(car.position.x, car.position.z) - car.position.y) * Math.min(1, dt * 12);
    car.rotation.y = heading;

    for (const w of parts.wheels) {
      if (w.front) w.steerNode.rotation.y = steer * 0.42;
      w.spinNode.rotation.x += speed * dt / w.r;
    }
    const tilt = -steer * grip * 0.055;
    for (const m of parts.tilt) m.rotation.z = tilt;
  }

  /* ── 도보 ──
     차에서 내려 뛰어다니는 모드. 방향키는 카메라 기준으로 해석하고
     캐릭터는 가려는 방향으로 부드럽게 돌아선다 (3인칭 게임의 일반적인 방식). */
  const RUN_SPEED = 11, RUN_ACCEL = 46, RUN_DRAG = 34, TURN_SNAP = 11;
  let pHeading = Math.PI, pSpeed = 0, camYaw = Math.PI, bob = 0;

  /* 각도는 -π~π를 넘나들어서 그냥 보간하면 한 바퀴 돌아버린다 */
  const angLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, t);

  function walk(dt) {
    const f = (keys.fwd ? 1 : 0) - (keys.back ? 1 : 0);
    const r = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

    let dx = 0, dz = 0;
    if (f || r) {
      /* 카메라가 보는 방향이 앞.
         이 월드는 전방이 (sin h, cos h)이라 카메라가 +Z를 바라본다.
         그래서 화면상 오른쪽은 월드 -X이고, 오른쪽 축은 camYaw"-"90°다.
         (+90°로 두면 A/D가 반대로 움직인다) */
      dx = Math.sin(camYaw) * f + Math.sin(camYaw - Math.PI / 2) * r;
      dz = Math.cos(camYaw) * f + Math.cos(camYaw - Math.PI / 2) * r;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      pHeading = angLerp(pHeading, Math.atan2(dx, dz), dt * TURN_SNAP);
      pSpeed = Math.min(RUN_SPEED, pSpeed + RUN_ACCEL * dt);
    } else {
      pSpeed = Math.max(0, pSpeed - RUN_DRAG * dt);
    }

    person.position.x += Math.sin(pHeading) * pSpeed * dt;
    person.position.z += Math.cos(pHeading) * pSpeed * dt;

    if (clampToBounds(person.position)) pSpeed = 0;
    person.rotation.y = pHeading;

    /* 달리는 동안만 카메라가 진행 방향으로 따라 돈다 */
    if (pSpeed > 0.3) camYaw = angLerp(camYaw, pHeading, dt * 2.2);

    const moving = pSpeed / RUN_SPEED;
    if (charMixer) {
      playClip(moving > 0.05 ? 'run' : 'idle');
      charMixer.update(dt);
    } else {
      /* 기본 캐릭터는 팔다리를 직접 흔든다 */
      bob += dt * (4 + moving * 9);
      const swing = Math.sin(bob) * 0.85 * moving;
      limbs.legL.rotation.x = swing;
      limbs.legR.rotation.x = -swing;
      limbs.armL.rotation.x = -swing * 0.75;
      limbs.armR.rotation.x = swing * 0.75;
      person.position.y = groundY(person.position.x, person.position.z) + Math.abs(Math.sin(bob)) * 0.06 * moving;
    }
  }

  /* glb 캐릭터용 — 같은 클립이면 다시 시작하지 않고 부드럽게 교차시킨다 */
  function playClip(name) {
    const clip = charClips[name] || charClips[name === 'run' ? 'walk' : 'idle'];
    if (!clip || !charMixer) return;
    if (charAction && charAction.getClip() === clip) return;
    const next = charMixer.clipAction(clip);
    next.reset().fadeIn(0.18).play();
    if (charAction) charAction.fadeOut(0.18);
    charAction = next;
  }

  /* ── 승하차 ── */
  const ENTER_CAR_R = 5.5;
  const player = { mode: 'driving' };

  function nearCar() {
    return Math.hypot(person.position.x - car.position.x, person.position.z - car.position.z) < ENTER_CAR_R;
  }

  function toggleVehicle() {
    if (player.mode === 'driving') {
      /* 차 옆(운전석 쪽)에 내려놓는다 */
      const side = heading + Math.PI / 2;
      person.position.set(
        car.position.x + Math.sin(side) * 2.6,
        0,
        car.position.z + Math.cos(side) * 2.6
      );
      pHeading = camYaw = side;
      pSpeed = 0; speed = 0;
      person.visible = true;
      player.mode = 'onfoot';
    } else {
      if (!nearCar()) return false;     // 차에서 멀면 못 탄다
      person.visible = false;
      heading = pHeading;
      camYaw = pHeading;
      player.mode = 'driving';
    }
    updateHint();
    return true;
  }

  /* ── 안내 문구 ── */
  function updateHint() {
    const driving = player.mode === 'driving';
    hint.innerHTML = `
      <div class="keys"><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span></div>
      <span>${driving ? '운전해서 프로젝트에 가까이 가보세요' : '뛰어서 돌아다닐 수 있습니다'}</span>
      <div class="keys"><span class="key">Space</span></div>
      <span>자세히 보기</span>
      <div class="keys"><span class="key">R</span></div>
      <span>블록 다시 쌓기</span>
      <div class="keys"><span class="key">F</span></div>
      <span>${driving ? '내려서 걷기' : '차 타기'}</span>`;
  }
  updateHint();

  /* ── 패널 ── */
  const panel = document.getElementById('g-panel');
  const pnNo = panel.querySelector('.no');
  const pnBd = panel.querySelector('.bd');
  const foundL = document.getElementById('g-found-l');
  const foundN = document.getElementById('g-found-n');

  let current = null, promptFor = null;
  const visited = new Set();
  const dim = document.getElementById('g-dim');
  const prompt = document.getElementById('g-prompt');
  const promptName = prompt.querySelector('.nm');
  const panelOpen = () => panel.classList.contains('open');

  function closePanel() {
    panel.classList.remove('open');
    dim.classList.remove('on');
    current = null;
  }
  panel.querySelector('.x').addEventListener('click', closePanel);
  dim.addEventListener('click', closePanel);
  prompt.addEventListener('click', () => { if (promptFor) openPanel(promptFor); });

  /* ── 패널 너비 조절 ──
     왼쪽 가장자리를 드래그하거나, 손잡이에 초점을 두고 좌우 방향키로 조절한다.
     글이 길어 답답하면 늘리고 게시판을 더 보고 싶으면 줄인다.
     너비는 기억해 뒀다가 다음에 열 때도 그대로 쓴다. */
  const PW_DEFAULT = 440, PW_MIN = 320, PW_CAP = 960, PW_KEY = 'portfolio.panelWidth';
  const grip = panel.querySelector('.grip');
  /* 지금 화면에서 허용되는 최대 너비. 화면의 70%를 넘으면 게시판이 가려져
     주행 화면이 의미를 잃는다. CSS의 70vw 제한과 같은 값이어야 한다. */
  const pwMax = () => Math.max(PW_MIN, Math.min(innerWidth * 0.7, PW_CAP));
  const shown = () => Math.round(panel.getBoundingClientRect().width);   // 실제로 보이는 너비

  /* pw는 "사용자가 정한 값"이다. 로드할 때 현재 창 크기로 깎지 않는다.
     작은 창에서 열었다고 저장값이 덮어써지면 창을 키워도 복원되지 않기 때문이다.
     화면에 보이는 너비의 제한은 CSS(min(..., 70vw))가 맡는다. */
  let pw = PW_DEFAULT;
  try {
    const saved = parseInt(localStorage.getItem(PW_KEY), 10);
    if (saved) pw = Math.max(PW_MIN, Math.min(PW_CAP, saved));
  } catch { /* 저장소가 막힌 환경이면 기본값으로 */ }

  function syncAria() {
    grip.setAttribute('aria-valuemin', PW_MIN);
    grip.setAttribute('aria-valuemax', Math.round(pwMax()));
    grip.setAttribute('aria-valuenow', shown());
  }
  function applyPw() {
    panel.style.setProperty('--pw', pw + 'px');
    syncAria();
  }
  /* 사용자가 직접 조절할 때만 현재 화면 기준으로 범위를 제한하고 저장한다 */
  function setPw(w, save) {
    pw = Math.round(Math.max(PW_MIN, Math.min(pwMax(), w)));
    applyPw();
    if (save) { try { localStorage.setItem(PW_KEY, String(pw)); } catch { /* 무시 */ } }
  }
  applyPw();

  let dragging = false, dragX0 = 0, dragW0 = 0;
  grip.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    dragX0 = e.clientX;
    dragW0 = panel.getBoundingClientRect().width;
    try { grip.setPointerCapture(e.pointerId); } catch { /* 캡처 실패해도 진행 */ }
    document.body.classList.add('resizing');
  });
  grip.addEventListener('pointermove', e => {
    /* 패널이 오른쪽에 붙어 있으므로 왼쪽으로 끌수록(clientX 감소) 넓어진다 */
    if (dragging) setPw(dragW0 + (dragX0 - e.clientX));
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('resizing');
    setPw(pw, true);
  };
  grip.addEventListener('pointerup', endDrag);
  grip.addEventListener('pointercancel', endDrag);

  grip.addEventListener('keydown', e => {
    const step = e.shiftKey ? 96 : 24;
    const next =
      e.key === 'ArrowLeft' ? shown() + step :
      e.key === 'ArrowRight' ? shown() - step :
      e.key === 'Home' ? PW_MIN :
      e.key === 'End' ? pwMax() : null;
    if (next === null) return;
    e.preventDefault();
    /* 방향키는 원래 주행 입력이라 전역 핸들러까지 올라가면 조절하는 동안 차가 조향된다 */
    e.stopPropagation();
    setPw(next, true);
  });
  grip.addEventListener('dblclick', () => setPw(PW_DEFAULT, true));   // 기본 너비로 되돌리기
  /* 창이 바뀌어도 pw는 건드리지 않고 접근성 값만 갱신한다 */
  addEventListener('resize', syncAria);

  function openPanel(p) {
    current = p.id;
    panel.style.setProperty('--c', p.color);
    pnNo.textContent = p.no;
    pnBd.innerHTML = `
      <div class="shot">${media(p)}</div>
      <div class="meta"><span class="per">${p.period}</span><span class="role">${p.role}</span></div>
      <div class="n">${p.full}</div>
      <p class="one">${p.one}</p>
      <ul>${p.pts.map(t => `<li>${t}</li>`).join('')}</ul>
      <div class="stk">${p.stack.map(s => `<span>${s}</span>`).join('')}</div>
      <div class="lk">${links(p)}</div>`;
    /* .shot 안의 미디어가 카드 크기를 채우도록 */
    const m = pnBd.querySelector('.shot > *');
    if (m) { m.className = 'shot'; pnBd.querySelector('.shot').replaceWith(m); }
    pnBd.scrollTop = 0;   // 다른 프로젝트로 넘어왔을 때 이전 스크롤 위치가 남지 않게
    /* 창을 여는 순간 차·캐릭터를 세운다. 누르고 있던 키가 남아 창 뒤에서 계속 달리지 않게 */
    for (const k in keys) keys[k] = false;
    speed = 0; pSpeed = 0;
    prompt.hidden = true;
    panel.classList.add('open');
    dim.classList.add('on');
    if (!visited.has(p.id)) { visited.add(p.id); renderFound(); }
  }

  function renderFound() {
    foundL.innerHTML = PROJECTS.map(p =>
      `<div class="g-fi ${visited.has(p.id) ? 'on' : ''}" style="--c:${p.color}">
         <span class="dot"></span>${visited.has(p.id) ? p.name : '? ? ?'}
       </div>`).join('');
    foundN.textContent = `${visited.size} / ${PROJECTS.length}`;
  }
  renderFound();

  /* 한 번 열린 패널은 자동으로 닫지 않는다. 전속력이면 구역 통과가 1초도 안 걸려서
     자동으로 닫으면 읽을 틈 없이 사라진다. */
  /* 게시판은 도로 중앙에서 17유닛 떨어져 있다. 판정을 패드 언저리로 잡으면
     직진만 해서는 아무것도 열리지 않고 매번 길 밖으로 빠져야 한다.
     고속도로 광고판처럼 지나가면서 차례로 뜨도록 도로 폭을 덮는 거리로 잡는다. */
  const ENTER_R = 9, LEAVE_R = 13;   // 길 위로 지나가면 안내가 뜨는 거리

  /* 지금 조종 중인 쪽(차 또는 캐릭터)의 위치 */
  const activePos = () => (player.mode === 'onfoot' ? person.position : car.position);

  function proximity() {
    const me = activePos();
    let near = null, nearD = Infinity;
    for (const s of stations) {
      const d = Math.hypot(me.x - s.pos[0], me.z - s.pos[1]);
      if (d < nearD) { nearD = d; near = s; }
    }
    /* 자동으로 열지 않는다. 가까이 오면 게시판 위에 "Space" 안내만 띄운다 */
    promptFor = near && nearD < ENTER_R ? near : null;
    if (!promptFor || panelOpen()) { prompt.hidden = true; return; }
    if (prompt.hidden || prompt.dataset.id !== promptFor.id) {
      prompt.dataset.id = promptFor.id;
      prompt.style.setProperty('--c', promptFor.color);
      promptName.textContent = promptFor.name;
      prompt.hidden = false;
    }
    /* 게시판 이름표 바로 위 화면 좌표에 붙인다 */
    promptFor.label.getWorldPosition(promptPt);
    promptPt.y += 1.6;
    promptPt.project(camera);
    const x = (promptPt.x * 0.5 + 0.5) * innerWidth, y = (-promptPt.y * 0.5 + 0.5) * innerHeight;
    const onScreen = promptPt.z < 1 && x > 90 && x < innerWidth - 90 && y > 70;
    prompt.style.left = (onScreen ? x : innerWidth / 2) + 'px';
    prompt.style.top = (onScreen ? Math.min(y, innerHeight - 120) : innerHeight - 110) + 'px';
  }
  const promptPt = new THREE.Vector3();

  /* ── 카메라 ──
     차일 땐 멀찍이 높게, 도보일 땐 가깝고 낮게 따라붙는다. */
  const camPos = new THREE.Vector3(0, 12, 34);
  const camLook = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  camera.position.copy(camPos);

  const CAM = {
    driving: { back: 10.5, up: 5.4, ahead: 5, lookY: 1.4, ease: 0.0016 },
    onfoot:  { back: 7.2,  up: 3.9, ahead: 3, lookY: 1.3, ease: 0.0006 }
  };

  function updateCamera(dt) {
    const onFoot = player.mode === 'onfoot';
    const c = onFoot ? CAM.onfoot : CAM.driving;
    const p = onFoot ? person.position : car.position;
    const h = onFoot ? camYaw : heading;
    const k = 1 - Math.pow(c.ease, dt);

    camTarget.set(p.x - Math.sin(h) * c.back, p.y + c.up, p.z - Math.cos(h) * c.back);
    camPos.lerp(camTarget, k);
    camera.position.copy(camPos);

    camTarget.set(p.x + Math.sin(h) * c.ahead, p.y + c.lookY, p.z + Math.cos(h) * c.ahead);
    camLook.lerp(camTarget, k);
    camera.lookAt(camLook);
  }

  /* ── 루프 ── */
  const clock = new THREE.Clock();
  let t = 0;

  function step(dt) {
    t += dt;
    if (player.mode === 'driving') drive(dt);
    else walk(dt);
    physicsStep(dt);
    timeU.value = t;
    fallingLeaves(dt, t, activePos().x, activePos().z);
    updateCamera(dt);
    proximity();

    const me = activePos();
    for (const s of stations) {
      /* 캐릭터나 차가 아니라 카메라를 향하게 한다. 패드 한가운데에 서면 방향이
         0으로 붕괴해 게시판 뒷면이 보인다. 카메라는 늘 뒤쪽이라 각도가 안정적이다. */
      /* 수레는 고정, 간판만 카메라 쪽으로 돈다 (수레 자체 회전을 빼서 지역 각도로 바꾼다) */
      let ang = Math.atan2(camera.position.x - s.pos[0], camera.position.z - s.pos[1]) - s.group.rotation.y;
      ang = Math.atan2(Math.sin(ang), Math.cos(ang));
      ang = Math.max(-1.2, Math.min(1.2, ang));   // 뒤돌아 수레를 등지지 않게 제한
      s.face.rotation.y += (ang - s.face.rotation.y) * Math.min(1, dt * 2.4);
      const d = Math.hypot(me.x - s.pos[0], me.z - s.pos[1]);
      const pulse = d < ENTER_R + 6 ? 1 + Math.sin(t * 4) * 0.035 : 1;
      s.ring.scale.set(pulse, pulse, 1);
      s.label.position.y = s.labelY + Math.sin(t * 1.3 + s.phase) * 0.18;
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);   // 탭 복귀 시 delta 폭주 방지
    if (!driveActive) return;                      // 문서 뷰일 땐 그리지 않는다
    step(dt);
    renderer.render(scene, camera);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  /* ── 로딩 ── */
  const bar = load.querySelector('.bar i'), pctEl = load.querySelector('.p');
  manager.onProgress = (url, done, total) => {
    const v = Math.round(done / total * 100);
    bar.style.width = v + '%'; pctEl.textContent = v + '%';
  };
  let started = false;
  function start() {
    if (started) return;
    started = true;
    bar.style.width = '100%'; pctEl.textContent = '100%';
    setTimeout(() => load.classList.add('done'), 260);
    loop();
  }
  manager.onLoad = start;
  setTimeout(start, 4000);   // 이미지가 안 와도 월드는 띄운다

  if (new URLSearchParams(location.search).has('test')) {
    window.__drive = {
      step, keys, stations, toyBlocks: () => toyBlocks.map(b => ({ x: +b.body.position.x.toFixed(2), y: +b.body.position.y.toFixed(2), z: +b.body.position.z.toFixed(2) })), restackBlocks,
      pos: () => ({ x: +activePos().x.toFixed(2), z: +activePos().z.toFixed(2) }),
      teleport(x, z, h = 0) {
        const p = activePos();
        p.set(x, p.y, z);
        if (player.mode === 'onfoot') { pHeading = camYaw = h; pSpeed = 0; }
        else { heading = h; speed = 0; }
      },
      mode: () => player.mode,
      toggleVehicle,
      carPos: () => ({ x: +car.position.x.toFixed(2), z: +car.position.z.toFixed(2) }),
      personVisible: () => person.visible,
      carInfo: () => ({
        usingModel: !car.children.includes(stockCar),
        wheels: parts.wheels.length,
        wheelRadius: parts.wheels.map(w => +w.r.toFixed(3)),
        size: (() => {
          const s = new THREE.Box3().setFromObject(car).getSize(new THREE.Vector3());
          return { w: +s.x.toFixed(2), h: +s.y.toFixed(2), len: +s.z.toFixed(2) };
        })()
      })
    };
  }
}

/* 시작 */
setView(viewFromHash(), { updateHash: false });
