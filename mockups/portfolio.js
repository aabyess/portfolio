/* ════════════════════════════════════════════════════════════
   최상호 포트폴리오 — 게임 뷰 / 문서 뷰 공용 스크립트

   프로젝트 내용은 아래 PROJECTS 한 곳에만 적는다.
   문서 카드도, 3D 게시판과 상세 패널도 전부 여기서 그려진다.
   ════════════════════════════════════════════════════════════ */

const PROJECTS = [
  {
    id: 'trade', no: '01', color: '#e8734a', featured: true,
    name: 'Trade-Cmarket',
    full: 'Trade-Cmarket — 한국·인도네시아 B2B 무역 견적·계약 플랫폼',
    period: '2026.07 — 2026.08', role: '인턴 · 1인 개발',
    one: '발주 공고부터 견적·낙찰·계약·실시간 채팅까지 거래 플로우 전체를 바이어·셀러 양면으로 <b>혼자 기획·설계·구현</b>했습니다.',
    short: 'B2B 거래 플로우 전체를 1인으로 구현. 이중 권한 구조를 설계하고, 프론트·백엔드를 함께 추적해 강제 로그아웃 버그를 잡았습니다.',
    pts: [
      'Supabase RLS와 서비스롤 API로 <b>이중 권한 구조</b>를 설계해, RLS를 우회하는 경로에도 소유권·상태 전이 검증을 직접 붙였습니다. 완료된 계약 되돌리기, 마감 공고 견적 제출 같은 조작을 차단했습니다.',
      '3개 국어 서비스에서 번역본을 원문·감지언어와 함께 저장하고 생성은 서버로만 강제해, <b>클라이언트발 번역 위조</b>를 막았습니다.',
      '간헐적 강제 로그아웃의 원인이 <b>미들웨어의 리다이렉트 쿠키 누락</b>임을 프론트와 백엔드를 함께 추적해 찾아내고, 헬퍼로 재발을 막았습니다.',
      '채팅 읽음 처리가 행마다 이벤트를 발생시켜 전체 이력을 다시 불러오던 문제를, 수신 페이로드를 <b>캐시에 직접 반영</b>하도록 바꿔 해결했습니다.',
      'Gemini 구조화 출력으로 공고·견적 초안을 생성하고 발주서 PDF·이미지를 멀티모달로 추출했습니다. 모델 과부하 시 폴백 체인으로 무중단 처리했습니다.',
      '전 API 라우트 보안 감사를 수행해 저장형 XSS 살균, 무인증 번역 프록시 차단, 업로드 MIME·용량 검증을 일괄 적용했습니다.'
    ],
    stack: ['Next.js 15', 'TypeScript', 'Supabase', 'TanStack Query', 'Zustand', 'next-intl', 'Gemini API', 'Vercel'],
    img: '../images/trade-cmarket.png',
    live: 'https://mitrapay.vercel.app/', repo: 'https://github.com/cmarketplace/Trade-Cmarket',
    pos: [0, -46]
  },
  {
    id: 'nolleo', no: '02', color: '#3fa7d6', featured: true,
    name: '놀러온나',
    full: '놀러온나 — 부산 특화 예산 맞춤 여행 플랫폼',
    period: '2026.05 — 2026.10', role: '5인 팀 · 프론트 전담',
    one: '한국관광공사 TourAPI 기반 여행 플랫폼에서 <b>서비스 전 페이지의 프론트엔드를 혼자</b> 설계·구현했습니다. (프론트 1, 백엔드 3, PM 1)',
    short: '부산 여행 플랫폼의 전 페이지 프론트엔드를 1인 담당. 조용히 누락되던 데이터 632개를 찾아냈습니다.',
    pts: [
      '장소 매핑 상한이 3,000개로 하드코딩돼 <b>실데이터 3,632개 중 632개가 누락</b>되던 버그를 발견했습니다. 상한을 올리고 37회 순차 요청을 8개 단위 병렬로 바꿔 초기 로딩도 함께 개선했습니다.',
      '부산 16개 구 혼잡도 지도를 Kakao Maps SDK로 구현하고, 원형 마커를 <b>실제 행정구역 경계 폴리곤</b>으로 교체해 구 클릭부터 상세 모달까지 이어지는 탐색 흐름을 설계했습니다.',
      'AI가 생성한 코스를 사용자가 직접 다듬도록 순서 변경·제외·드래그 정렬·예산 게이지를 붙인 <b>편집 흐름</b>을 구현했습니다.',
      '카카오 SDK 스크립트 로드 전에 지도를 초기화해 발생하던 레이스 컨디션을, 스크립트 태그를 재확인한 뒤 load 이벤트를 붙이는 폴백으로 해결했습니다.',
      '모바일에서 카드 드래그가 목록 스크롤을 막던 문제를, 화면 크기를 감지해 데스크톱·모바일 드래그 방식을 분리하는 방식으로 해결했습니다.',
      '스팟 검색을 지역명·카테고리·무료 여부·초성까지 인식하는 통합 검색으로 확장하고, 결과에 맞춰 지도 범위가 자동 재조정되도록 했습니다.'
    ],
    stack: ['Next.js', 'TypeScript', 'TailwindCSS v4', 'TanStack Query', 'Zustand', 'Kakao Maps SDK', 'Motion', 'Vitest'],
    video: '../images/nolleo-onna.mp4',
    live: 'https://dev.nolleo-onna.site/', repo: 'https://github.com/nolleo-onna/nolleo-onna-frontend',
    pos: [42, -20]
  },
  {
    id: 'reboot', no: '03', color: '#7d6ad6',
    name: 'RE:BOOT',
    full: 'RE:BOOT — 번아웃·자기관리 모임 커뮤니티',
    period: '2026.02 — 2026.04', role: '부트캠프 팀 프로젝트',
    one: '관심사 기반으로 모임을 탐색·참여·개설하는 커뮤니티 플랫폼에서 자유게시판 영역 전체를 담당했습니다.',
    short: '자유게시판 전체 CRUD를 담당하고, <b>조회수가 3씩 오르던</b> 중복 호출 버그를 잡고 캐시 키를 중앙화했습니다.',
    pts: [
      '좋아요를 누르면 <b>조회수가 3씩 오르던 버그</b>를 발견해, API가 3중 호출되던 원인을 찾아 중복 요청을 제거했습니다.',
      'queryKey를 파일마다 문자열로 관리하던 방식을 <b>객체로 중앙화</b>해 캐시 불일치와 중복 호출을 없앴습니다.',
      '좋아요 반응이 서버 응답 후에야 반영되어 생기던 지연을 <b>Optimistic Update</b>로 해결했습니다.',
      '섹션마다 빈 상태·에러가 달라 섹션별 ErrorBoundary를 적용해, 일부 API가 실패해도 페이지 전체가 멈추지 않게 했습니다.'
    ],
    stack: ['Next.js', 'TypeScript', 'React Query', 'Zustand', 'Storybook', 'Jest'],
    img: '../images/reboot.png',
    live: 'https://reboot-codeit.vercel.app/', repo: 'https://github.com/aabyess/Reboot',
    pos: [30, 36]
  },
  {
    id: 'mate', no: '04', color: '#31a88a',
    name: 'Myeonjeop-Mate',
    full: 'Myeonjeop-Mate — AI 기반 면접 준비 플랫폼',
    period: '2025.11 — 2025.12', role: '개인 프로젝트 · 1인 개발',
    one: '이력서를 분석해 맞춤 면접 질문과 답변 피드백을 제공하는 서비스를 기획부터 API 연동까지 혼자 만들었습니다.',
    short: '이력서를 분석해 맞춤 면접 질문과 피드백을 주는 서비스. OpenAI 연동부터 파일 텍스트 추출, 사용량 제한까지 1인 개발했습니다.',
    pts: [
      'PDF·Word 이력서에서 텍스트를 추출해 프롬프트로 구조화하고, <b>맞춤 면접 질문을 자동 생성</b>했습니다.',
      'AI 피드백 응답을 JSON으로 파싱해 구조·내용·키워드·개선 예시 항목별로 즉시 렌더링했습니다.',
      'API 호출 비용을 줄이려고 <b>사용자당 일일 요청 제한</b> 로직을 직접 구현했습니다.'
    ],
    stack: ['React', 'OpenAI API', 'PDF.js', 'Mammoth'],
    img: '../images/interview.png',
    repo: 'https://github.com/aabyess/myeonjeop-mate',
    pos: [-30, 36]
  },
  {
    id: 'ignis', no: '05', color: '#d95f8b',
    name: 'IGNIS',
    full: 'IGNIS — 사회공헌 플랫폼',
    period: '2025.03 — 2025.10', role: '팀 프로젝트',
    one: '기부·펀딩·봉사 활동을 연결하는 온라인 사회공헌 플랫폼입니다.',
    short: '기부·펀딩·봉사를 연결하는 플랫폼. 결제 후 <b>서버 금액과 대조해 승인</b>하는 흐름을 설계해 위변조를 막았습니다.',
    pts: [
      'PortOne 결제를 연동하면서, 결제 완료 후 <b>서버 금액과 대조해 승인</b>하는 흐름을 직접 설계해 위변조를 막았습니다.',
      '홈에서 기부·펀딩·봉사를 통합 조회하고 각 도메인에서 참여·등록까지 이어지는 사용자 플로우를 구현했습니다.',
      '등록 폼에서 필수 항목 누락 시 유효성 메시지를 표시해 사용자 실수를 줄였습니다.'
    ],
    stack: ['React', 'Vite', 'React Router', 'Ant Design'],
    img: '../images/ignis.png',
    repo: 'https://github.com/aabyess/Ignis.git',
    pos: [-46, -14]
  },
  {
    id: 'lol', no: '06', color: '#e0a32e',
    name: 'LOL Face Matcher',
    full: 'LOL Face Matcher — 얼굴 인식 챔피언 매칭',
    period: '2025.03 — 2025.06', role: '개인 프로젝트',
    one: '얼굴 사진을 인식해 닮은 League of Legends 챔피언을 찾아주는 머신러닝 웹 서비스입니다.',
    short: '얼굴을 인식해 닮은 챔피언을 찾아주는 서비스. 모델을 바꿔 <b>임베딩 성공률 100%</b>를 달성했습니다.',
    pts: [
      'dlib 기반 모델에서 <b>DeepFace(ArcFace)로 전환</b>해 챔피언 이미지 170장 기준 임베딩 성공률 100%를 달성했습니다.',
      '성별을 고려한 코사인 유사도 알고리즘으로 닮은꼴 매칭을 구현했습니다.',
      'FastAPI와 React 사이 CORS 문제를 파악해 해결하고, 업로드·추천 REST API와 DB 구조를 설계했습니다.'
    ],
    stack: ['React', 'FastAPI', 'Python', 'DeepFace', 'MySQL'],
    img: '../images/lol.png',
    repo: 'https://github.com/aabyess/lol-face-matcher2',
    pos: [-8, 54]
  }
];

const SKILLS = [
  { t: 'Frontend', items: [['Next.js', 1], ['React', 1], ['TypeScript', 1], ['TailwindCSS', 1], ['TanStack Query', 1], ['Zustand', 1], ['Motion', 0], ['Storybook', 0], ['Ant Design', 0]] },
  { t: 'Backend · Data', items: [['Supabase', 1], ['PostgreSQL / RLS', 1], ['REST API 설계', 1], ['FastAPI', 0], ['Python', 0], ['MySQL', 0]] },
  { t: '연동 · 외부 API', items: [['Gemini API', 1], ['OpenAI API', 1], ['Kakao Maps SDK', 1], ['next-intl', 1], ['DeepL', 0], ['PortOne 결제', 0]] },
  { t: '테스트 · 배포', items: [['Vitest', 0], ['Jest', 0], ['Vercel', 0], ['Git / GitHub', 0]] }
];

const PLAY = [
  { icon: '🎮', on: true, status: '개발 중', name: '게임 프로젝트 (제목 미정)', stack: ['Godot', 'GDScript'],
    desc: 'AI 에이전트를 기획·리서치·구현 역할로 나눠 협업하며 만들고 있는 게임. 혼자서 어디까지 완성할 수 있는지 실험 중입니다.' },
  { icon: '🚗', on: true, status: '라이브', name: '이 포트폴리오', stack: ['Three.js', 'Vanilla JS'],
    desc: '빌드 도구 없이 HTML 하나로 만든 사이트. 3D 월드와 문서 페이지가 같은 데이터에서 그려집니다.' },
  { icon: '🧩', on: false, status: '준비 중', name: '다음에 만들 것', stack: ['TBD'],
    desc: '여기에 들어갈 내용을 알려주시면 채워 넣겠습니다.' }
];

const media = p => p.video
  ? `<video src="${p.video}" autoplay loop muted playsinline></video>`
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

  document.getElementById('d-featured').innerHTML = PROJECTS.filter(p => p.featured).map(p => `
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

  document.getElementById('d-compact').innerHTML = PROJECTS.filter(p => !p.featured).map(p => `
    <div class="pcx">
      <div class="pcx-t"><span class="pcx-n">${p.name}</span><span class="pcx-p">${p.period}</span></div>
      <p class="pcx-d">${p.short}</p>
      <div class="stk">${p.stack.map(s => `<span>${s}</span>`).join('')}</div>
      <div class="lk">${links(p)}</div>
    </div>`).join('');

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
    initDrive();
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
const CAR_MODEL_URL = '../models/car.glb';

/* 바퀴 노드 이름. 앞에 있는 이름부터 찾는다.
   Blender에서 직접 만들 땐 wheel_fl 같은 이름을 쓰면 되고,
   Kenney 킷처럼 다른 규칙으로 된 모델도 그대로 인식된다. */
const WHEEL_SPEC = [
  { front: true,  names: ['wheel_fl', 'wheel-front-left',  'wheel_front_left'] },
  { front: true,  names: ['wheel_fr', 'wheel-front-right', 'wheel_front_right'] },
  { front: false, names: ['wheel_rl', 'wheel-back-left',   'wheel_rear_left'] },
  { front: false, names: ['wheel_rr', 'wheel-back-right',  'wheel_rear_right'] }
];

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

  const SKY = 0xcfe3ef, WORLD_R = 96, CAR_LEN = 4.2, PAD_R = 7.5;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 70, 210);

  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.5, 400);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('drive-root').appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xdbeaf5, 0xcfc6b2, 2.1));
  const sun = new THREE.DirectionalLight(0xfff4e2, 2.4);
  sun.position.set(48, 70, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 220 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  /* ── 바닥 ── */
  const gTex = (() => {
    const s = 512, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g = cv.getContext('2d');
    g.fillStyle = '#e9e2d2'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(29,42,51,.055)'; g.lineWidth = 2;
    for (let i = 0; i <= s; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(26, 26);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  })();

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD_R + 34, 72),
    new THREE.MeshStandardMaterial({ map: gTex, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const fence = new THREE.Mesh(
    new THREE.TorusGeometry(WORLD_R + 3, 0.5, 8, 90),
    new THREE.MeshStandardMaterial({ color: 0xc8bfa9, roughness: .9 })
  );
  fence.rotation.x = -Math.PI / 2;
  fence.position.y = 0.9;
  fence.castShadow = true;
  scene.add(fence);

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

  /* 중앙 안내는 바닥에 새긴다. 공중에 띄우면 주행 시야를 정면으로 가린다. */
  const centerPad = new THREE.Mesh(
    new THREE.CylinderGeometry(10.5, 10.5, 0.16, 48),
    new THREE.MeshStandardMaterial({ color: 0xf6f1e4, roughness: 1 })
  );
  centerPad.position.y = 0.08;
  centerPad.receiveShadow = true;
  scene.add(centerPad);

  {
    const S = 1024, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.translate(S / 2, S / 2);
    g.textAlign = 'center';
    g.fillStyle = '#2b3840';
    g.font = '800 140px Pretendard, system-ui, sans-serif';
    g.fillText('최상호', 0, -160);
    g.fillStyle = '#8b959c';
    g.font = '600 52px Pretendard, system-ui, sans-serif';
    g.fillText('FULL-STACK DEVELOPER', 0, -78);
    g.strokeStyle = 'rgba(232,115,74,.9)'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(-200, -26); g.lineTo(200, -26); g.stroke();
    g.fillStyle = '#5b6d79';
    g.font = '500 54px Pretendard, system-ui, sans-serif';
    g.fillText('차를 몰고', 0, 66);
    g.fillText('프로젝트에 가까이 가보세요', 0, 138);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    /* rotation.x=-90°면 캔버스 위쪽이 -Z를 향한다. 차가 -Z로 출발하므로 바로 읽힌다. */
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = 0.17;
    scene.add(plate);
  }

  /* ── 프로젝트 스테이션 ── */
  const manager = new THREE.LoadingManager();
  const texLoader = new THREE.TextureLoader(manager);
  const stations = [];

  for (const p of PROJECTS) {
    const g = new THREE.Group();
    g.position.set(p.pos[0], 0, p.pos[1]);
    const col = new THREE.Color(p.color);

    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(PAD_R, PAD_R, 0.22, 44),
      new THREE.MeshStandardMaterial({ color: col, roughness: .85 })
    );
    pad.position.y = 0.11; pad.receiveShadow = true;
    g.add(pad);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(PAD_R + 0.5, 0.16, 8, 56),
      new THREE.MeshStandardMaterial({ color: col, roughness: .6 })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.3;
    g.add(ring);

    const boardW = 9.4, boardH = 5.9;
    const postMat = new THREE.MeshStandardMaterial({ color: 0xb9b09c, roughness: .9 });
    for (const dx of [-3.4, 3.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.6, 10), postMat);
      post.position.set(dx, 2.3, 0); post.castShadow = true;
      g.add(post);
    }

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(boardW + 0.5, boardH + 0.5, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xfbf7ee, roughness: .9 })
    );
    frame.position.set(0, 4.6 + boardH / 2 - 0.4, 0);
    frame.castShadow = true;
    g.add(frame);

    const screenMat = new THREE.MeshBasicMaterial({ color: 0xdfe6ea });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(boardW, boardH), screenMat);
    screen.position.set(0, frame.position.y, 0.17);
    g.add(screen);

    if (p.img) {
      texLoader.load(p.img, t => {
        t.colorSpace = THREE.SRGBColorSpace;
        screenMat.map = t; screenMat.color.set(0xffffff); screenMat.needsUpdate = true;
      });
    } else if (p.video) {
      const v = document.createElement('video');
      Object.assign(v, { src: p.video, loop: true, muted: true, playsInline: true, autoplay: true });
      v.play().catch(() => {});
      const vt = new THREE.VideoTexture(v);
      vt.colorSpace = THREE.SRGBColorSpace;
      screenMat.map = vt; screenMat.color.set(0xffffff); screenMat.needsUpdate = true;
    }

    const label = labelSprite(p.name, p.role, p.color);
    label.position.set(0, frame.position.y + boardH / 2 + 2.1, 0);
    g.add(label);

    scene.add(g);
    stations.push({ ...p, group: g, ring, label, labelY: label.position.y, phase: Math.random() * Math.PI * 2 });
  }

  /* ── 배경 ── */
  {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0xa98e6f, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x8fb87a, roughness: 1 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xc3bdae, roughness: 1 });
    const trunkGeo = new THREE.CylinderGeometry(0.34, 0.44, 2.2, 8);
    const leafGeo = new THREE.ConeGeometry(1.9, 4.2, 9);
    const rockGeo = new THREE.DodecahedronGeometry(1.1, 0);

    let placed = 0, tries = 0;
    while (placed < 64 && tries < 900) {
      tries++;
      const a = Math.random() * Math.PI * 2;
      const r = 24 + Math.random() * (WORLD_R - 26);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x, z) < 22) continue;                                     // 중앙 광장 비우기
      if (!stations.every(s => Math.hypot(x - s.pos[0], z - s.pos[1]) > PAD_R + 9)) continue;

      if (Math.random() < 0.72) {
        const t = new THREE.Group();
        const tr = new THREE.Mesh(trunkGeo, trunkMat); tr.position.y = 1.1; tr.castShadow = true;
        const lf = new THREE.Mesh(leafGeo, leafMat); lf.position.y = 3.9; lf.castShadow = true;
        t.add(tr, lf);
        t.scale.setScalar(0.7 + Math.random() * 0.55);
        t.position.set(x, 0, z);
        t.rotation.y = Math.random() * Math.PI;
        scene.add(t);
      } else {
        const rk = new THREE.Mesh(rockGeo, rockMat);
        rk.position.set(x, 0.5, z);
        rk.rotation.set(Math.random(), Math.random(), Math.random());
        rk.scale.setScalar(0.6 + Math.random() * 0.9);
        rk.castShadow = true; rk.receiveShadow = true;
        scene.add(rk);
      }
      placed++;
    }
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
    const k = KEYMAP[e.code];
    if (k) { keys[k] = true; e.preventDefault(); hideHint(); }
    if (e.code === 'Escape') closePanel();
  });
  addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });

  if (matchMedia('(hover: none) and (pointer: coarse)').matches) document.body.classList.add('is-touch');
  document.querySelectorAll('.tkey').forEach(el => {
    const k = el.dataset.k;
    const on = e => { e.preventDefault(); keys[k] = true; hideHint(); };
    const off = e => { e.preventDefault(); keys[k] = false; };
    el.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, off));
  });

  /* ── 주행 ── */
  const MAX_FWD = 26, MAX_REV = 11, ACCEL = 19, BRAKE = 38, DRAG = 7.5, TURN = 1.75;
  let speed = 0, heading = Math.PI, steer = 0;
  car.position.set(0, 0, 14);

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

    const d = Math.hypot(car.position.x, car.position.z);
    if (d > WORLD_R) {
      const k = WORLD_R / d;
      car.position.x *= k; car.position.z *= k;
      speed *= 0.3;
    }
    car.rotation.y = heading;

    for (const w of parts.wheels) {
      if (w.front) w.steerNode.rotation.y = steer * 0.42;
      w.spinNode.rotation.x += speed * dt / w.r;
    }
    const tilt = -steer * grip * 0.055;
    for (const m of parts.tilt) m.rotation.z = tilt;
  }

  /* ── 패널 ── */
  const panel = document.getElementById('g-panel');
  const pnNo = panel.querySelector('.no');
  const pnBd = panel.querySelector('.bd');
  const foundL = document.getElementById('g-found-l');
  const foundN = document.getElementById('g-found-n');

  let current = null, dismissed = null;
  const visited = new Set();

  function closePanel() {
    panel.classList.remove('open');
    dismissed = current;
    current = null;
  }
  panel.querySelector('.x').addEventListener('click', closePanel);

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
    panel.classList.add('open');
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
  const ENTER_R = PAD_R + 2.5, LEAVE_R = PAD_R + 9;
  function proximity() {
    let near = null, nearD = Infinity;
    for (const s of stations) {
      const d = Math.hypot(car.position.x - s.pos[0], car.position.z - s.pos[1]);
      if (d < nearD) { nearD = d; near = s; }
    }
    if (!near) return;
    if (dismissed && (dismissed !== near.id || nearD > LEAVE_R)) dismissed = null;
    if (nearD < ENTER_R && current !== near.id && dismissed !== near.id) openPanel(near);
  }

  /* ── 카메라 ── */
  const camPos = new THREE.Vector3(0, 12, 34);
  const camLook = new THREE.Vector3();
  camera.position.copy(camPos);

  function updateCamera(dt) {
    const k = 1 - Math.pow(0.0016, dt);
    camPos.lerp(new THREE.Vector3(
      car.position.x - Math.sin(heading) * 13.5, 6.6, car.position.z - Math.cos(heading) * 13.5
    ), k);
    camera.position.copy(camPos);
    camLook.lerp(new THREE.Vector3(
      car.position.x + Math.sin(heading) * 6, 1.6, car.position.z + Math.cos(heading) * 6
    ), k);
    camera.lookAt(camLook);
  }

  /* ── 루프 ── */
  const clock = new THREE.Clock();
  let t = 0;

  function step(dt) {
    t += dt;
    drive(dt);
    updateCamera(dt);
    proximity();
    for (const s of stations) {
      /* 차가 아니라 카메라를 향하게 한다. 차가 패드 한가운데면 방향이 0으로 붕괴해
         게시판 뒷면이 보인다. 카메라는 늘 뒤쪽에 있어 각도가 안정적이다. */
      const ang = Math.atan2(camera.position.x - s.pos[0], camera.position.z - s.pos[1]);
      s.group.rotation.y += (ang - s.group.rotation.y) * Math.min(1, dt * 2.4);
      const d = Math.hypot(car.position.x - s.pos[0], car.position.z - s.pos[1]);
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
      step, keys, stations,
      pos: () => ({ x: +car.position.x.toFixed(2), z: +car.position.z.toFixed(2) }),
      teleport(x, z, h = 0) { car.position.set(x, 0, z); heading = h; speed = 0; },
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
