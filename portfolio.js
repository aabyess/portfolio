/* ════════════════════════════════════════════════════════════
   최상호 포트폴리오 — 게임 뷰 / 문서 뷰 공용 스크립트

   프로젝트 내용은 아래 PROJECTS 한 곳에만 적는다.
   문서 카드도, 3D 게시판과 상세 패널도 전부 여기서 그려진다.
   ════════════════════════════════════════════════════════════ */

/* 프로젝트 데이터
   one   : 어떤 프로젝트인지 (2~3줄)
   mine  : 내가 맡은 일
   pts   : 해결한 문제 (핵심만) — trouble 이 있으면 카드로 대신 보여 준다
   trouble: 트러블슈팅 카드 [{ t: 제목, p: 문제, c: 원인, f: 해결 }]
   security: 보안 점검 (목록)
   gallery: 여러 장. 첫 장이 대표 이미지이고 게임 속 간판에도 쓰인다. */
const PROJECTS = [
  {
    id: 'nolleo', no: '01', color: '#3fa7d6',
    name: '놀러온나',
    full: '놀러온나 — 부산 특화 예산 맞춤 여행 플랫폼',
    period: '2026.05 — 2026.10', role: '팀 프로젝트 · 프론트엔드 전담',
    one: '부산 여행자를 위한 <b>예산 맞춤 여행 플래너</b>입니다. 한국관광공사 TourAPI의 부산 관광지·숙박·음식점 데이터를 바탕으로, AI 여행 메이트 <b>온나</b>에게 묻거나 조건을 골라 예산에 맞는 코스를 만들고, 스팟 지도에서 3,632곳을 둘러보고, 동네 커뮤니티 <b>한끗</b>에서 꿀팁·후기·행사 정보를 나눕니다. 릴리스 1.4부터 1.22까지 꾸준히 배포하며 운영했습니다.',
    mine: [
      '<b>서비스 전 페이지의 프론트엔드를 1인으로</b> 설계·구현했습니다. 홈·스팟·코스·한끗·마이페이지의 화면 구조, 상태 관리, API 연동을 모두 맡았습니다.',
      '<b>스팟 혼잡도 지도</b>: 부산 16개 구·군 행정경계(KOSTAT)를 Douglas-Peucker로 단순화한 32KB GeoJSON을 만들어 원형 마커를 실제 경계 폴리곤으로 바꿨습니다. 멀티폴리곤(사하구 등)을 지원하고 경계 로드에 실패하면 원형 마커로 돌아가며, 같은 경계로 스팟 지도에 구별 스팟 수를 채움 농도로 보여 줍니다. 구를 누르면 붐비는 곳 TOP 5와 여유 스팟 패널을 거쳐 상세 모달까지 이어집니다.',
      '<b>코스 만들기와 편집</b>: AI가 만든 코스를 순서 변경·제외·드래그 정렬·예산 게이지로 다듬는 편집 흐름, 폼으로 코스를 만드는 API 연동과 장소·행사 검색, 생성 중 진행률 링·단계 체크리스트 화면을 만들었습니다. 링크 공유와 홈 인기 코스 올리기를 나누고, 공유된 코스 전체보기와 검색도 붙였습니다.',
      '<b>온나 채팅</b>: iMessage처럼 다듬은 채팅 모달이 누른 버튼 자리에서 커져 나오게 했고, 홈 히어로를 채팅 우선 구조로 바꿨습니다.',
      '<b>한끗 커뮤니티</b>: 사진 히어로·포스터 핫이슈로 페이지를 개편하고, 글쓰기·마이페이지 화면과 행사 상세(포스터 히어로·요금표·오시는 길)를 만들었습니다. 실제 행사·관광지 정보로 큐레이션 글 11개를 써서 모든 동네를 채웠습니다.',
      '<b>스마트 검색</b>: 동네 사전 21곳, 카테고리 동의어 40여 개, 초성(ㅎㅇㄷ → 해운대), 공백 무시 정규화, 일치 부분 하이라이트를 지원하는 통합 검색을 만들고, 검색 결과에 맞춰 지도 범위가 자동으로 맞춰지게 했습니다.',
      '<b>코스 공유</b>: 공개 링크와 홈 공개를 나누고, 공유 코스 좋아요·전체보기·검색과 카카오맵 길찾기 연결을 붙였습니다.',
      '<b>품질·배포</b>: Vitest 단위 테스트 19개 파일과 Storybook을 갖추고, 세션 만료(401) 때 로그인을 유도했습니다. 연속 푸시 때 컨테이너 이름 충돌로 실패하던 GitHub Actions 배포에 concurrency 가드를 추가하고 develop → main 릴리즈 흐름을 운영했습니다.',
      '<b>인터랙션</b>: three.js 파도 배경, 떠 있는 유리 캡슐 헤더, 시간대·날씨에 따라 바뀌는 하늘 카드, 누른 채 끌면 기울어지는 행사 포스터, 부산행 탑승권 모양의 로그인 모달을 만들었습니다.'
    ],
    pts: [
      '장소 매핑 테이블의 안전 상한이 3,000개로 하드코딩돼 <b>실데이터 3,632곳 중 632곳이 누락</b>되던 버그를 찾았습니다. 상한을 올리고 37회 순차 요청을 8개씩 병렬로 바꿔 초기 로딩도 함께 줄였습니다.',
      '카카오 SDK 스크립트가 로드되기 전에 지도를 초기화하던 <b>레이스 컨디션</b>을, 스크립트 태그가 나타날 때까지 다시 확인한 뒤 load 이벤트를 붙이는 폴백으로 해결했습니다.',
      '모바일 코스 편집에서 카드 전체 드래그가 목록 스크롤을 막던 문제를, <b>matchMedia + useSyncExternalStore</b>로 화면 크기를 감지해 데스크톱·모바일 드래그 방식을 나눠 해결했습니다.',
      '장소 이름에 슬래시(/)가 들어가면 카카오맵 길찾기 링크가 <b>404 페이지로 가던 문제</b>를 고쳤습니다.',
      '스팟 목록 검색창에 한 글자만 쳐도 <b>입력이 끊기던 문제</b>를 고쳤습니다.',
      '코스 생성이 실패하면 <b>서버 원문 에러 메시지가 화면에 그대로 노출</b>되던 것을 사용자용 안내로 바꿨습니다.'
    ],
    trouble: [
      { t: '장소 632곳이 매핑에서 누락', p: '일부 마커 모달에서 찜 상태가 표시되지 않음', c: '장소 ID 매핑 훅의 상한이 30페이지(3,000개)로 하드코딩돼 실데이터 3,632곳 중 뒤쪽 632곳이 빠짐', f: '첫 응답의 totalPages 기준으로 상한을 올리고, 37회 순차 요청을 8개 단위 <code>Promise.all</code> 병렬 요청으로 바꿔 초기 로딩까지 단축' },
      { t: '검색창에 한 글자 칠 때마다 입력이 끊김', p: '타이핑 중 포커스가 풀리고 한글 조합이 깨짐', c: '글자마다 새 쿼리 키 → <code>isLoading</code> → 사이드바 전체가 스켈레톤으로 바뀌며 input이 언마운트됨', f: '300ms 디바운스 훅 + <code>keepPreviousData</code>로 이전 결과를 유지하고, 전체 스켈레톤은 첫 로딩에만 표시. fetch를 1.5초 늦춰 재현·검증' },
      { t: '"카페" 검색 결과 0건', p: '있는 카테고리인데 검색 결과가 비어 있음', c: '받아온 페이지 안에서만 클라이언트 필터링했는데 맛집·카페(3,104건)가 뒤쪽 페이지에 몰려 있었고, 결과가 0건이면 무한스크롤 sentinel도 렌더되지 않아 다음 페이지를 못 받음', f: '지역·카테고리·키워드를 서버 파라미터 필터로 바꾸고, sentinel을 목록 밖으로 빼 <code>rootMargin 200px</code>로 미리 로드' },
      { t: '카카오 지도가 가끔 영영 뜨지 않음', p: '새로고침 타이밍에 따라 지도가 초기화되지 않음', c: 'dynamic import로 지도 마운트가 늦어지며, SDK <code>&lt;script&gt;</code> 태그가 DOM에 들어오기 전에 감지를 시도하는 레이스 컨디션', f: '코스·혼잡도·스팟 지도 3곳에 태그가 나타날 때까지 다시 확인한 뒤 load 이벤트를 붙이는 폴백을 적용하고, 코스 지도의 폴링은 이벤트 방식으로 교체' },
      { t: '모바일에서 스크롤하려다 코스 순서가 바뀜', p: '터치 기기에서 카드 위를 스크롤하면 드래그로 인식됨', c: '카드 전체가 드래그 영역이라 스크롤 제스처와 충돌', f: '<code>matchMedia</code> + <code>useSyncExternalStore</code>로 화면 크기를 구독해 1024px 미만에선 그립 핸들로만 드래그, 데스크톱은 카드 전체 드래그 유지' },
      { t: '코스 결과 페이지 무한 로딩', p: '생성이 끝났는데도 결과 화면이 계속 로딩 상태', c: '빈 배열 응답을 \'아직 생성 중\'으로 오인해 폴링이 멈추지 않음', f: '최대 60초 타임아웃과 실패 안내를 추가하고, 음식점·카페는 전용 모달로 나눠 상세 처리 정리' },
    ],
    stack: ['Next.js 15', 'TypeScript', 'Tailwind CSS v4', 'TanStack Query', 'Zustand', 'Kakao Maps SDK', 'Three.js', 'Motion', 'Vitest'],
    img: 'images/nolleo-onna.webp',
    gallery: [
      { src: 'images/nolleo-onna.webp', cap: '홈 — AI 여행 메이트 온나에게 코스 물어보기' },
      { src: 'images/nolleo-spot.webp', cap: '스팟 — 부산 16개 구 혼잡도 지도와 3,632곳 스팟 목록' },
      { src: 'images/nolleo-course.webp', cap: '코스 — 내가 만든 코스 모아보기' },
      { src: 'images/nolleo-hankkut.webp', cap: '한끗 — 동네별 꿀팁·후기 커뮤니티' }
    ],
    live: 'https://www.nolleo-onna.site/', repo: 'https://github.com/nolleo-onna/nolleo-onna-frontend',
    pos: [-17, -16]
  },
  {
    id: 'trade', no: '02', color: '#e8734a',
    name: 'Trade-Cmarket',
    full: 'Trade-Cmarket — 한국·인도네시아 B2B 무역 견적·계약 플랫폼',
    period: '2026.07 — 2026.08', role: '인턴 · 1인 개발',
    one: '인도네시아 발주기관(바이어)이 견적을 요청하면 한국 공급기업(셀러)이 견적을 보내고, <b>낙찰·계약·입금 확인·수령 확인·실시간 채팅</b>까지 한곳에서 진행하는 B2B 조달 플랫폼(MitraPay)입니다. 사무용품·연구장비·산업기계·화학약품을 다루고, 한국어·인도네시아어·영어로 화면뿐 아니라 사용자가 쓴 글까지 자동 번역합니다. 인보이스·송금 영수증, 물품 수령 확인(BAST), 상호 리뷰까지 거래 전 과정을 다루며, 바이어·셀러·운영자 3개 역할을 한 달간 400여 커밋, API 라우트 45개, DB 마이그레이션 34개로 만들었습니다. Vercel과 Supabase(싱가포르)로 배포했습니다.',
    mine: [
      '인턴 기간 동안 <b>기획·설계·구현을 1인으로</b> 맡아, 바이어와 셀러 양쪽 화면과 API, DB를 모두 만들었습니다.',
      '<b>거래 흐름 전체</b>: 견적 요청 → 견적 제출 → 낙찰 → 계약 → 수령 확인·영수증 업로드까지 상태가 이어지는 구조를 설계하고, Supabase Realtime으로 실시간 채팅과 알림을 붙였습니다.',
      '<b>3개 국어 번역 파이프라인</b>: next-intl로 한·인니·영 라우팅을 구성하고, 공고·견적·채팅·알림·기업정보 테이블에 <code>source_lang</code> + <code>translations(jsonb)</code>를 두어 저장할 때 서버에서 DeepL로 나머지 언어를 미리 번역해, 보는 사람의 UI 언어로 돌려줍니다. 기존 데이터도 소급 번역했습니다.',
      '<b>거래 문서 자동화</b>: @react-pdf/renderer로 견적서·인보이스 PDF를 만들어 서명 URL로 주고 채팅 안에 썸네일로 첨부했으며, 낙찰 시점에 인보이스 번호를 확정합니다. Edge Function + Cron으로 환율을 갱신해 견적 비교표를 IDR 기준으로 환산합니다.',
      '<b>사업자 인증·요금제·운영</b>: 국세청 진위확인 API 즉시 인증과 서류 업로드 → 운영자 승인 큐, Free/Pro/Max 요금제(무료는 채팅 번역 월 50건 서버 집계), 공지·자료실·1:1 문의·회원 관리 운영자 화면, Storybook 스토리 30개를 만들었습니다.',
      '<b>권한</b>: Supabase RLS로 행 접근을 막고, RLS를 우회하는 서비스롤 API에는 소유권·상태 전이 화이트리스트 검증을 직접 붙인 이중 권한 구조를 만들었습니다.',
      '<b>AI 기능</b>: Gemini 구조화 출력(responseSchema)으로 견적 요청·견적 초안을 만들고, 발주서 PDF·이미지에서 정보를 뽑습니다. 모델이 과부하(503)면 다른 모델로 넘기는 폴백 체인으로 끊기지 않게 했습니다.',
      '<b>대시보드</b>: 바이어·셀러 대시보드에 할 일 위젯(날짜별 아젠다 뷰, 지난 항목 숨기기), 관심 받은 견적, 기업 홈페이지 만들기 위젯과 위젯 편집 기능을 만들었습니다.',
      '<b>업무 편의 기능</b>: 공고 복제·재등록, 완료된 계약에서 다시 발주하기, 필터 프리셋 저장(5개 화면), 결제내역·계약목록 CSV 내보내기, 토스트 알림 시스템을 만들었습니다.',
      '<b>랜딩과 운영</b>: 견적 발송부터 계약 완료까지 양방향 자동 번역으로 재생되는 채팅 데모와 "거래의 여정" 섹션을 만들고, Supabase 자동 일시중지를 막는 Vercel Cron을 붙였습니다. 죽은 코드를 정리하고 README에 시스템 아키텍처를 문서로 남겼습니다.'
    ],
    pts: [
      '간헐적 강제 로그아웃의 원인이 <b>미들웨어의 리다이렉트 쿠키 누락</b>임을 프론트와 백엔드를 함께 추적해 찾아내고, 헬퍼로 재발을 막았습니다.',
      '채팅 읽음 처리가 행마다 UPDATE 이벤트를 일으켜 <b>전체 이력 refetch가 폭주</b>하던 문제를, Realtime 페이로드를 setQueryData로 캐시에 바로 반영하도록 바꿔 해결했습니다.',
      'RLS를 우회하는 서비스롤 경로에서 <b>완료된 계약을 되돌리거나 마감된 공고에 견적을 내는 조작</b>이 가능하던 것을 상태 전이 검증으로 막았습니다.',
      '번역을 클라이언트가 만들면 위조할 수 있어, <b>번역 생성을 서버로만 강제</b>하고 원문과 함께 저장했습니다.',
      '전체 API 라우트 보안 점검으로 <b>저장형 XSS 살균, 무인증 번역 프록시 차단, 파일 업로드 MIME·용량 검증</b>을 일괄 적용했습니다.',
      '랜딩 히어로의 채팅 데모가 <b>페이지 전체를 강제로 스크롤</b>시키던 버그를 고쳤습니다.'
    ],
    trouble: [
      { t: '사용자가 간헐적으로 강제 로그아웃됨', p: '재현 패턴 없이 가끔 세션이 끊김', c: '미들웨어의 <code>getUser()</code>가 토큰을 갱신하면 새 쿠키가 응답에 실려야 하는데, <code>NextResponse.redirect()</code>가 이를 싣지 않아 브라우저엔 이미 소비된 refresh token만 남음', f: '모든 리다이렉트에 갱신된 쿠키를 복사하는 <code>buildRedirect()</code> 헬퍼로 통일해 재발 방지' },
      { t: '채팅 refetch 폭주와 목록 과다 로딩', p: '메시지·읽음 이벤트마다 전체 이력을 다시 받고, 채팅방 목록이 모든 방의 전체 메시지를 내려받음', c: 'Realtime 이벤트(읽음 UPDATE 포함)를 받을 때마다 쿼리를 무효화하는 구조', f: 'INSERT는 append, UPDATE는 해당 행만 교체하도록 캐시에 직접 반영. 방 요약 RPC와 <code>(quote_id, created_at desc)</code> 인덱스, 최초 50개 페이지네이션과 행 단위 memo, 구독 직후 1회 동기화로 유실 메시지 보완' },
      { t: '공개된 타사 정보로 사업자 인증 통과 가능', p: '남의 사업자번호로도 내 회사가 인증될 수 있는 보안 허점', c: '국세청 API는 번호가 실제로 있는지만 확인할 뿐 요청자 소유인지는 확인하지 않음', f: '가입 때 등록한 본인 사업자번호와 대조한 뒤에만 API를 호출하고, 다르면 400을 돌려주며 입력란을 읽기 전용으로 처리' },
      { t: 'AI 초안 생성이 과부하 때 500 에러', p: 'Gemini 수요 폭증(503) 때 사용자에겐 알 수 없는 서버 오류로 보임', c: '단일 모델 호출에 실패 처리 분기가 없었음', f: '예비 모델로 차례대로 폴백하고, 전부 과부하일 때만 429로 재시도 안내. 계정에서 404가 나던 모델은 폴백 목록에서 교체' },
      { t: '계약 취소 후 같은 견적 재낙찰 불가', p: '취소된 계약이 있는 견적을 다시 확정하면 DB 제약 위반', c: '<code>contracts.quote_id</code> 전체에 유니크 제약이 걸려 취소 이력과 충돌', f: '<code>status &lt;&gt; \'cancelled\'</code> 조건의 부분 유니크 인덱스로 바꿔 취소 이력은 남기면서 재낙찰 허용' },
      { t: '백그라운드 탭에서도 \'읽음\' 처리됨', p: '창을 보지 않아도 상대에게 읽음으로 표시되고, 빠르게 다시 들어오면 안내 메시지가 중복 생성됨', c: '탭 가시성과 무관하게 읽음 API를 호출하고, 동시에 들어오면 insert가 두 번 실행', f: '<code>visibilityState</code>가 visible일 때만 읽음 처리하고 탭 복귀 때 밀린 읽음을 반영, 진행 중인 Promise를 공유해 중복 insert 방지' },
    ],
    security: [
      '공고 HTML을 sanitize-html로 살균해 <b>저장형 XSS</b>를 막고, 인가 판단을 검증되지 않은 <code>getSession()</code>에서 <code>getUser()</code>로 교체했습니다.',
      '인증 없이 열려 있던 <b>번역 API</b>를 로그인 필수·길이 제한으로 막고, 채팅 번역 전에 참여자를 검증해 DeepL 쿼터 남용을 차단했습니다.',
      '<b>파일 업로드</b> MIME allowlist·5MB 제한, 계약 상태 변경 화이트리스트, 견적 번역 서버 생성으로 클라이언트 위조를 막았습니다.',
    ],
    stack: ['Next.js 15', 'React 19', 'TypeScript', 'Supabase', 'TanStack Query', 'Zustand', 'next-intl', 'DeepL API', 'Gemini API', 'Vercel'],
    img: 'images/trade-cmarket.webp',
    gallery: [
      { src: 'images/trade-cmarket.webp', cap: 'MitraPay 대시보드' },
      { src: 'images/trade-dashboard.webp', cap: '바이어 대시보드 — 거래 요약과 할 일' },
      { src: 'images/trade-quote.webp', cap: '견적요청 등록 — 템플릿과 AI 초안 작성' },
      { src: 'images/trade-contract.webp', cap: '계약 관리 — 수령 확인·영수증 업로드' }
    ],
    live: 'https://cmarket-hazel.vercel.app/', repo: 'https://github.com/aabyess/cmarket',
    pos: [17, -38]
  },
  {
    id: 'reboot', no: '03', color: '#7d6ad6',
    name: 'RE:BOOT',
    full: 'RE:BOOT — 번아웃·자기관리 모임 커뮤니티',
    period: '2026.02 — 2026.04', role: '부트캠프 팀 프로젝트 · 커넥트(자유게시판) 담당',
    one: '"지친 일상 속, 에너지를 다시 움직일 최적의 모임을 만나다"를 내건 <b>커뮤니티형 모임 플랫폼</b>입니다. 지역·날짜·카테고리로 모임을 찾아 찜하고 참여하고, 직접 개설·관리하며, 리뷰와 자유게시판 <b>커넥트</b>로 소통합니다. 모든 페이지를 모바일·태블릿·데스크톱 반응형으로 만든 부트캠프 팀 프로젝트입니다.',
    mine: [
      '<b>커넥트(자유게시판) 전체</b>를 맡았습니다. 게시글 목록·검색·정렬, 작성·상세·수정·삭제, 상세 조회수, 상단 배너와 인기 게시물 카드까지 구현했습니다.',
      '<b>댓글</b>: 작성·수정·삭제와 좋아요, 이미지 첨부와 첨부 유효성 검사, 댓글 작성자 프로필 모달을 만들었습니다.',
      '<b>공용 컴포넌트</b>: 팀이 같이 쓰는 필터 드롭다운, 검색창 지우기 버튼, 유저 모달, 토스트를 만들고 다듬었습니다.',
      '<b>안정성</b>: 섹션별 ErrorBoundary와 라우트 에러 핸들러를 붙여 일부 API가 실패해도 페이지가 멈추지 않게 하고, 페이지 메타데이터를 넣었습니다.',
      '<b>데이터 구조</b>: 파일마다 문자열로 쓰던 React Query queryKey를 객체로 모아 관리하도록 리팩터링하고, API 응답을 화면 데이터로 바꾸는 매퍼에 테스트를 붙였습니다.'
    ],
    pts: [
      '좋아요를 누르면 <b>조회수가 3씩 오르던 버그</b>를 발견해, API가 세 번 호출되던 원인을 찾아 중복 요청을 없앴습니다.',
      '좋아요가 서버 응답 뒤에 반영돼 <b>0.5초 지연</b>이 느껴지던 문제를 Optimistic Update로 바로 반응하게 했습니다.',
      '페이지네이션에서 <b>데이터를 받기 전에 스크롤이 먼저 실행</b>되던 문제를 shouldScroll 상태와 useEffect로 순서를 제어해 해결했습니다.',
      'queryKey가 파일마다 달라 생기던 <b>캐시 불일치와 중복 호출</b>을 키 중앙화로 없앴습니다.',
      '필터 드롭다운의 <b>포커스 문제</b>를 트리거에 forwardRef를 적용하고 MenuButton 렌더링 방식을 바꿔 해결했습니다.'
    ],
    stack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'TanStack Query', 'Zustand', 'React Hook Form', 'Zod', 'MSW', 'Storybook', 'Jest'],
    img: 'images/reboot.webp',
    gallery: [
      { src: 'images/reboot.webp', cap: 'RE:BOOT 메인' },
      { src: 'images/reboot-connect.webp', cap: '커넥트(자유게시판) — 직접 맡은 영역' },
      { src: 'images/reboot-meetup.webp', cap: '모임 찾기 — 카테고리·지역·날짜 필터' }
    ],
    live: 'https://reboot-codeit.vercel.app/', repo: 'https://github.com/aabyess/Reboot',
    pos: [-17, -60]
  },
  {
    id: 'mate', no: '04', color: '#31a88a',
    name: 'Myeonjeop-Mate',
    full: 'Myeonjeop-Mate — AI 기반 면접 준비 플랫폼',
    period: '2025.11 — 2025.12', role: '개인 프로젝트 · 1인 개발',
    one: 'PDF나 Word 이력서를 올리면 AI가 내용을 분석해 <b>기술 면접 질문을 자동으로 만들고</b>, 답변을 쓰면 구조·내용·기술 키워드·종합 평가·개선 예시로 피드백을 주는 면접 준비 서비스입니다. 다른 사람과 면접 답변을 나누는 커뮤니티도 있습니다.',
    mine: [
      '기획부터 화면, OpenAI API 연동까지 <b>1인으로</b> 만들었습니다.',
      '<b>이력서 분석</b>: PDF.js와 Mammoth로 PDF·Word(.docx)에서 텍스트를 뽑아 프롬프트로 구조화하고, 이력서에 맞는 기술 면접 질문 3개를 생성합니다.',
      '<b>답변 피드백</b>: 질문별 카드형 답변 입력 화면을 만들고, AI 피드백을 JSON으로 받아 구조·내용·키워드·종합 평가·개선 예시 항목별로 바로 보여줍니다.',
      '<b>커뮤니티</b>: 면접 답변을 공유하고 서로 피드백하는 게시글 작성·조회·댓글 기능을 만들었습니다.',
      'Ant Design으로 화면을 일관되게 구성했습니다.'
    ],
    pts: [
      'API 호출 비용이 늘어나는 걸 막으려고 <b>사용자당 하루 요청을 50회로 제한</b>하는 사용량 제어 로직을 직접 구현했습니다.'
    ],
    stack: ['React (Vite)', 'TypeScript', 'Ant Design', 'OpenAI API', 'PDF.js', 'Mammoth'],
    img: 'images/interview.webp',
    gallery: [
      { video: 'images/interview.mp4', poster: 'images/interview.webp', cap: '이력서 업로드부터 질문 생성·피드백까지 시연' },
      { src: 'images/interview.webp', cap: '맞춤 면접 질문 화면' }
    ],
    repo: 'https://github.com/aabyess/myeonjeop-mate',
    pos: [17, -82]
  },
  {
    id: 'ignis', no: '05', color: '#d95f8b',
    name: 'IGNIS',
    full: 'IGNIS — 사회공헌 플랫폼',
    period: '2025.03 — 2025.10', role: '팀 프로젝트 · 프론트엔드 중심',
    one: '기부·펀딩·봉사를 한곳에 모은 <b>사회적 가치 실현 플랫폼</b>입니다. 기부 현황을 실시간으로 보고, 리워드를 고르는 크라우드펀딩에 참여하고, 봉사 활동을 신청하며, 공지사항·자유게시판으로 소통합니다. 관리자는 프로젝트를 승인·거부합니다.',
    mine: [
      '<b>로그인과 회원</b>: 구글·카카오 소셜 로그인, 회원가입, 아이디 중복 확인, 이메일 인증, 비밀번호 재설정을 만들었습니다.',
      '<b>기부·펀딩·봉사</b>: 각 도메인의 생성·리스트·상세·참여 페이지를 만들고, 홈에서 셋을 한 번에 보고 참여·등록까지 이어지는 흐름을 설계했습니다. 상세 페이지 스티키 사이드바, 긴급 배너, 기부 장소 카카오맵 연결을 붙였습니다.',
      '<b>결제</b>: PortOne(KG이니시스)으로 기부·펀딩 결제 페이지를 만들고, 결제 후 서버 금액과 대조해 승인하는 흐름을 직접 설계했습니다.',
      '<b>커뮤니티</b>: 공지사항·자유게시판, 댓글·대댓글, 조회수·좋아요를 만들었습니다.',
      '마이페이지와 관리자 헤더를 만들고, 백엔드 마이페이지 컨트롤러 중복 정리와 보안 설정 수정도 함께 했습니다.'
    ],
    pts: [
      '결제 완료 후 백엔드에 금액 검증을 요청해 <b>서버 금액과 대조한 뒤 승인</b>하도록 바꿔 결제 위변조를 막았습니다.',
      '펀딩 결제 후 리다이렉트, 결제 처리, 이메일 인증에서 나던 버그를 하나씩 잡아 <b>기부·펀딩 결제 전 구간을 정상화</b>했습니다.',
      '이미지 경로 문제로 <b>기부·봉사 이미지가 안 뜨던 오류</b>를 고쳤습니다.'
    ],
    stack: ['React', 'Vite', 'React Router', 'Ant Design', 'Spring Boot', 'MySQL', 'PortOne'],
    img: 'images/ignis.webp',
    gallery: [
      { src: 'images/ignis.webp', cap: 'IGNIS 메인' },
      { src: 'images/ignis_home.webp', cap: '홈 — 기부·펀딩·봉사 통합 조회' }
    ],
    repo: 'https://github.com/aabyess/Ignis.git',
    pos: [-17, -104]
  },
  {
    id: 'lol', no: '06', color: '#e0a32e',
    name: 'LOL Face Matcher',
    full: 'LOL Face Matcher — 얼굴 인식 챔피언 매칭',
    period: '2025.03 — 2025.06', role: '개인 프로젝트',
    one: '얼굴 사진을 올리면 AI가 얼굴 특징을 분석해 <b>가장 닮은 League of Legends 챔피언 Top 5</b>를 유사도(%)와 함께 찾아주는 웹 서비스입니다. 챔피언의 역할·포지션·태그·대표 대사도 같이 보여주고, 결과를 카카오톡·인스타그램으로 공유할 수 있습니다.',
    mine: [
      '모델 선택부터 백엔드·프론트까지 <b>1인으로</b> 만들었습니다.',
      '<b>매칭</b>: DeepFace(ArcFace)로 얼굴 특징 벡터를 뽑고, 성별을 고려한 코사인 유사도로 닮은꼴 챔피언을 고르는 알고리즘을 만들었습니다.',
      '<b>백엔드</b>: FastAPI로 얼굴 업로드·특징 저장·추천 REST API와 DB 구조를 설계했습니다.',
      '<b>프론트</b>: 사진 업로드 화면, 결과 대기 로딩, Top 5 결과 카드, 다시 테스트하기, 결과 공유 버튼을 만들었습니다. 배경 영상, 반투명 카드, Framer Motion 카드 전환, Ant Design Row/Col 반응형으로 모바일까지 맞췄습니다.'
    ],
    pts: [
      'dlib 기반 face_recognition 모델을 <b>DeepFace(ArcFace)로 바꿔</b> 챔피언 이미지 약 170장 모두 임베딩에 성공했습니다.',
      'FastAPI와 React 사이 <b>CORS 문제</b>를 원인부터 짚어 해결했습니다.'
    ],
    stack: ['React (Vite)', 'Ant Design', 'Framer Motion', 'FastAPI', 'Python', 'DeepFace', 'MySQL'],
    img: 'images/lol.webp',
    repo: 'https://github.com/aabyess/lol-face-matcher2',
    pos: [17, -126]
  },
  /* ai: true 인 프로젝트는 문서 뷰에서 "AI 활용" 구역에 따로 놓이고,
     게임에서는 가판대 6곳이 아니라 다리 앞 AI 구역(pos)에 선다. */
  {
    id: 'gurandi', no: 'AI', color: '#8b6cff', ai: true,
    name: '구랜디',
    full: '구랜디 (GuRandi) — AI 에이전트 팀으로 만든 3D 랜덤 디펜스',
    period: '2026.08 — 진행 중 (베타 0.3.24)', role: '취미 프로젝트 · AI 에이전트 팀 운영',
    one: '워크래프트3 유즈맵 「원피스 랜덤 디펜스」를 <b>Unity 6로 옮긴 최대 4인 협동 랜덤 디펜스</b>입니다. 위습을 뽑기 포탈에 보내 무작위 유닛을 얻고, 재료를 모아 13단계 상위 등급으로 조합합니다. <b>기획·지시·검증·배포 판단은 제가 하고, 구현은 Claude Code 에이전트 4명으로 꾸린 팀</b>이 맡았습니다. 유닛 240여 기, 스킬 950여 개, 난이도 6종, 스토리 보스를 갖췄고 친구들에게 맥·윈도우 베타를 30여 회 배포했습니다.',
    mine: [
      '<b>AI 팀 설계</b>: 세션 4개를 PM(Opus)·게임 규칙·UI·3D 모델(Sonnet)로 나눴습니다. PM이 일을 나누고 리뷰·병합·push를 맡고, 지시와 보고는 「[PM → 역할]」 「[역할 → PM]」 형식으로 고정했습니다. 스크립트 한 줄로 팀원 셋을 새로 띄웁니다.',
      '<b>하루 단위 인수인계</b>: 세션이 끝날 때 PM이 NEXT_SESSION.md에 끝난 일·막힌 일·제 답을 기다리는 일을 정리하고, 다음 날 새 PM이 한 줄 지시로 그대로 이어받게 했습니다. 제 결정과 반복된 실수는 한 사실당 파일 하나로 메모리 140여 개에 쌓았습니다.',
      '<b>AI가 스스로 확인하는 환경</b>: AI가 파일에 명령을 쓰면 Unity 에디터가 플레이·클릭·자동 플레이·캡처를 실행하고 결과를 돌려주는 <b>에디터 브리지</b>, 에디터 없이 C# 컴파일 오류만 뽑는 검사, 깨진 프리팹·누락 에셋을 빌드 전에 막는 배포 관문을 먼저 만들었습니다.',
      '<b>원본 데이터 디코더</b>: 원작 맵 파일(w3x)의 유닛·능력 데이터(w3u·w3a)와 트리거(JASS)를 직접 읽어 수치를 옮기게 했습니다.',
      '<b>요금제 안에서 운영</b>: 월 $100 요금제로 4세션을 돌리려고 판단·리뷰는 Opus, 반복 구현은 Sonnet으로 나눴고, 대화가 길어지면 PM이 스스로 인수인계를 쓰고 새 세션으로 교체합니다.'
    ],
    pts: [
      'AI가 도구 출력의 이름표만 보고 「고쳤습니다」라고 한 <b>틀린 완료 보고 4건</b>을 잡고, 보고는 실행 캡처·테스트·원본 수치를 근거로만 하도록 규칙을 세웠습니다.',
      '이전 세션이 쓴 조사 문서의 수치를 사실로 믿고 밸런스를 맞춘 문제를 찾아, <b>원본 디코드 값만 근거로 240여 기를 다시 대조해 80여 기를 바로잡았습니다.</b>',
      '여러 세션이 한 저장소에 동시에 커밋하며 변경이 섞이던 문제를 <b>경로 지정 커밋과 git worktree 분리</b>로 해결했습니다.',
      '컨텍스트가 압축되면 확정된 결정을 잊던 문제를 결정은 메모리, 진행 상태는 NEXT_SESSION.md로 나눠 남기는 방식으로 막았습니다.'
    ],
    stats: [['3,331', '커밋 (AI 공동 작성 2,893)'], ['9.4만 줄', 'C# (런타임 + 에디터 도구)'], ['4명', 'Claude Code 에이전트'], ['30여 회', '친구 대상 베타 배포']],
    stack: ['Unity 6 (URP)', 'C#', 'Photon Fusion', 'Claude Code', 'Opus · Sonnet', 'Blender MCP', 'Python'],
    img: 'images/gurandi-combat_skill_effect.webp',
    gallery: [
      { video: 'images/gurandi-flow.mp4', poster: 'images/gurandi-flow.webp', cap: '위습 → 뽑기 → 조합 흐름 (AI 에이전트가 자동 플레이로 녹화)' },
      { src: 'images/gurandi-combat_skill_effect.webp', cap: '스킬 전투' },
      { src: 'images/gurandi-boss_round.webp', cap: '보스 라운드' },
      { src: 'images/gurandi-combine_table.webp', cap: '조합표 — 유닛 240여 기' },
      { src: 'images/gurandi-title_menu.webp', cap: '타이틀 · 혼자 하기 / 같이 하기' }
    ],
    repo: 'https://github.com/aabyess/GuRandi-AI-Dev',
    pos: [4.2, 42]   // AI 구역을 맨 앞으로: 첫 가판대(놀러온나, 길 왼쪽)의 길 건너편. 연락처 표지판 줄(z 48~67)보다 아래
  }
];

/* AI를 어떻게 쓰는지 — 문서 뷰 "AI 활용" 구역의 작은 카드들.
   how: 'dev' 는 AI와 함께 개발한 것, 'feat' 은 AI를 기능으로 넣은 것 */
const AI_USE = [
  { how: 'dev', icon: '🚗', name: '이 포트폴리오', tools: ['Claude Code', 'Blender MCP', 'Headless Chrome'],
    desc: '가을 숲 월드는 Claude Code가 Blender MCP로 지형·나무·가판대 자리를 만들고, 웹 코드는 같은 세션이 작성했습니다. 고칠 때마다 헤드리스 Chrome으로 화면을 찍어 AI가 결과를 직접 보고 확인한 뒤 PR로 올리게 했습니다.' },
  { how: 'dev', icon: '🪰', name: 'FlyKing — 초파리 뇌 × Blender 몸', tools: ['Claude Code', 'Blender', 'Python', 'Brian2'],
    desc: '초파리 전뇌 커넥톰 시뮬레이션(Shiu et al. 2024, 공개 모델)을 Blender로 만든 초파리 몸(뼈 61개, NeuroMechFly 규격)에 연결하는 실험입니다. 몸 생성·리깅 스크립트와 걷기·몸단장 클립까지 AI와 함께 만들었습니다.' },
  { how: 'feat', icon: '🌊', name: '놀러온나 — AI 여행 메이트 온나', tools: ['LLM 채팅', 'React'],
    desc: '부산 여행자가 AI 메이트 온나에게 물어 예산 맞춤 코스를 받는 서비스입니다. 채팅 우선 홈, 누른 자리에서 커지는 채팅 모달, AI가 만든 코스를 순서 변경·제외·예산 게이지로 다듬는 편집 흐름을 만들었습니다.' },
  { how: 'feat', icon: '🎙️', name: 'Myeonjeop-Mate — AI 모의면접', tools: ['OpenAI API', 'PDF.js'],
    desc: '이력서를 올리면 OpenAI API가 맞춤 면접 질문을 만들고 답변에 피드백을 줍니다. API 비용을 막으려고 사용자당 하루 50회 사용량 제한을 직접 구현했습니다.' },
  { how: 'feat', icon: '🧑‍🎤', name: 'LOL Face Matcher — 얼굴 인식', tools: ['DeepFace (ArcFace)', 'FastAPI'],
    desc: 'DeepFace(ArcFace)로 얼굴 특징 벡터를 뽑아 성별을 고려한 코사인 유사도로 닮은 챔피언 Top 5를 찾습니다. dlib 모델에서 바꿔 챔피언 이미지 약 170장을 모두 임베딩했습니다.' },
  { how: 'feat', icon: '🎤', name: 'AI 커버곡', tools: ['PyTorch', 'Demucs', 'RVC', 'Redis RQ'],
    desc: 'Demucs로 원곡의 보컬을 분리하고 RVC로 다른 목소리로 바꿔 커버곡을 만드는 서비스입니다. 작업 큐 기반 변환 파이프라인과 결과물의 AI 생성 표시까지 구성했습니다.' }
];

const SKILLS = [
  { t: 'Frontend', items: [['Next.js', 1], ['React', 1], ['TypeScript', 1], ['TailwindCSS', 1], ['TanStack Query', 1], ['Zustand', 1], ['Three.js', 1], ['Motion', 0], ['Storybook', 0], ['Ant Design', 0]] },
  { t: 'Backend · Data', items: [['Supabase', 1], ['PostgreSQL / RLS', 1], ['REST API 설계', 1], ['FastAPI', 0], ['Python', 0], ['MySQL', 0]] },
  { t: '연동 · 외부 API', items: [['Gemini API', 1], ['OpenAI API', 1], ['Kakao Maps SDK', 1], ['next-intl', 1], ['DeepL', 0], ['PortOne 결제', 0]] },
  { t: '테스트 · 배포', items: [['Vitest', 0], ['Jest', 0], ['Vercel', 0], ['Git / GitHub', 0]] }
];

const PLAY = [
  { icon: '🤝', on: true, status: '개발 중', name: 'RentMate', stack: ['Next.js 16', 'React 19', 'TypeScript', 'Supabase', 'TanStack Query', 'TossPayments'],
    desc: '시간제 동행·운동 메이트 매칭 플랫폼. 예약·결제·실시간 채팅·후기·신고·관리자를 도메인별로 나눠 설계하고, 성인인증·채팅 로그 보관 같은 법적 요구사항을 기능 설계에 반영했습니다.' }
];

const links = p => `
  ${p.live ? `<a class="live" href="${p.live}" target="_blank" rel="noopener">라이브 ↗</a>` : ''}
  ${p.repo ? `<a href="${p.repo}" target="_blank" rel="noopener">GitHub</a>` : ''}`;

/* ── 이미지 여러 장 ──
   큰 화면 + 좌우 버튼 + 장수 + 캡션 + 썸네일 줄. 게임 창과 문서 뷰가 같이 쓴다. */
const galleryOf = p => p.gallery || [p.video ? { video: p.video, poster: p.poster } : { src: p.img }];
const slideHTML = (g, alt) => g.video
  ? `<video src="${g.video}"${g.poster ? ` poster="${g.poster}"` : ''} autoplay loop muted playsinline preload="metadata"></video>`
  : `<img src="${g.src}" alt="${alt}" loading="lazy" decoding="async" />`;
function galleryHTML(p) {
  const gs = galleryOf(p), many = gs.length > 1;
  return `<div class="gal" data-gal="${p.id}" style="--c:${p.color}">
    <div class="gal-main">${slideHTML(gs[0], gs[0].cap || p.name + ' 화면')}
      ${many ? `<button type="button" class="gal-nav prev" aria-label="이전 이미지">‹</button>
      <button type="button" class="gal-nav next" aria-label="다음 이미지">›</button>
      <span class="gal-count">1 / ${gs.length}</span>` : ''}
    </div>
    ${gs[0].cap ? `<p class="gal-cap">${gs[0].cap}</p>` : ''}
    ${many ? `<div class="gal-thumbs">${gs.map((g, i) => `<button type="button" class="gal-th${i ? '' : ' on'}" data-i="${i}" aria-label="${g.cap || (i + 1) + '번째 이미지'}">
        <img src="${g.poster || g.src}" alt="" loading="lazy" />${g.video ? '<span class="play">▶</span>' : ''}</button>`).join('')}</div>` : ''}
  </div>`;
}
/* 갤러리를 살린다. 돌려주는 go(±1)로 키보드에서도 넘길 수 있다. */
function bindGallery(root, p) {
  const el = root.querySelector(`[data-gal="${p.id}"]`);
  if (!el) return () => {};
  const gs = galleryOf(p);
  let i = 0;
  const show = n => {
    i = (n + gs.length) % gs.length;
    el.querySelector('.gal-main > img, .gal-main > video').outerHTML = slideHTML(gs[i], gs[i].cap || p.name + ' 화면');
    const cap = el.querySelector('.gal-cap'); if (cap) cap.textContent = gs[i].cap || '';
    const cnt = el.querySelector('.gal-count'); if (cnt) cnt.textContent = `${i + 1} / ${gs.length}`;
    el.querySelectorAll('.gal-th').forEach((b, k) => b.classList.toggle('on', k === i));
    el.querySelector('.gal-th.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  el.querySelector('.prev')?.addEventListener('click', () => show(i - 1));
  el.querySelector('.next')?.addEventListener('click', () => show(i + 1));
  el.querySelectorAll('.gal-th').forEach(b => b.addEventListener('click', () => show(+b.dataset.i)));
  return d => { if (gs.length > 1) show(i + d); };
}
/* 소개 아래 "맡은 일", "해결한 문제" */
/* fold: 문서 뷰에서는 앞의 몇 개만 보이고 나머지는 "더 보기"로 접는다 */
const listBlock = (title, items, cls = '', fold = 0) => items && items.length
  ? `<div class="sec"><div class="sec-t">${title}</div><ul class="${cls}"${fold ? ' data-pts' : ''}>${items.map((t, i) => `<li class="${fold && i >= fold ? 'hide' : ''}">${t}</li>`).join('')}</ul></div>` : '';

/* 트러블슈팅: 문제 / 원인 / 해결 카드 */
const troubleBlock = p => p.trouble && p.trouble.length
  ? `<div class="sec"><div class="sec-t">트러블슈팅</div><div class="tr-grid">${p.trouble.map(x => `
      <div class="tr"><div class="tr-t">${x.t}</div><dl>
        <dt>문제</dt><dd>${x.p}</dd><dt>원인</dt><dd>${x.c}</dd><dt class="fix">해결</dt><dd>${x.f}</dd>
      </dl></div>`).join('')}</div></div>`
  : listBlock('해결한 문제', p.pts, 'pts', p.__fold || 0);

/* ════════════════════════════════════════════════════════════
   배경음악 — 유튜브 공식 플레이어(IFrame API)로 재생한다.
   인트로부터 바로 재생을 시도하고, 브라우저가 소리 자동 재생을 막으면
   첫 클릭/키 입력(인트로 중 포함)에 다시 튼다.
   끄면 멈추고 카드도 숨긴다. 문서 뷰로 가면 멈추고 게임으로 돌아오면 다시 튼다.
   ════════════════════════════════════════════════════════════ */
function createMusic() {
  const KEY = 'portfolio.music', VIDEO = 'FysE1sMun5s';
  const btn = document.getElementById('g-music-btn'), card = document.getElementById('g-music');
  if (!btn || !card) return null;
  let want = true;
  try { want = localStorage.getItem(KEY) !== 'off'; } catch { /* 저장소가 막혀도 기본은 켜짐 */ }
  let player = null, ready = false, started = true;   // 조작을 기다리지 않고 바로 재생을 시도한다

  const api = () => {
    if (document.getElementById('yt-iframe-api')) return;
    window.onYouTubeIframeAPIReady = () => {
      player = new YT.Player('g-music-player', {
        width: 200, height: 200, videoId: VIDEO,
        playerVars: { controls: 0, start: 7, loop: 1, playlist: VIDEO, playsinline: 1, rel: 0, modestbranding: 1 },
        events: { onReady: () => {
          ready = true; player.setVolume(35); sync();
          if (navigator.userActivation?.hasBeenActive) start();   // 인트로 중에 이미 클릭·키 입력이 있었다면 바로 튼다
        } }
      });
    };
    const sc = document.createElement('script');
    sc.id = 'yt-iframe-api'; sc.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(sc);
  };

  function sync() {
    const inGame = document.body.dataset.view === 'drive';
    const on = want && started && inGame;
    card.classList.toggle('off', !on);
    btn.setAttribute('aria-pressed', String(want));
    btn.querySelector('span').textContent = want ? '음악 켜짐' : '음악 꺼짐';
    if (!ready) return;
    if (on) player.playVideo(); else player.pauseVideo();
  }
  /* 자동 재생이 막혔다면 사용자의 첫 조작 순간에 다시 튼다.
     유튜브 플레이어는 첫 조작의 playVideo()를 무시할 때가 있어서 0.8초 뒤 확인하고 최대 3번까지 다시 부른다 */
  let retry = 0;
  const canPlay = () => want && ready && document.body.dataset.view === 'drive';
  const playing = () => player.getPlayerState() === YT.PlayerState.PLAYING;
  function start() {
    if (!canPlay() || playing()) return;
    clearTimeout(retry);
    let tries = 0;
    const attempt = () => {
      if (!canPlay() || playing()) return;
      player.playVideo();
      if (++tries < 3) retry = setTimeout(attempt, 800);
    };
    attempt();
  }
  btn.addEventListener('click', e => {
    e.stopPropagation();
    want = !want;
    try { localStorage.setItem(KEY, want ? 'on' : 'off'); } catch { /* 무시 */ }
    if (want) started = true;
    sync();
  });
  addEventListener('pointerdown', start);
  addEventListener('keydown', start);
  addEventListener('portfolio:intro-gesture', start);   // 인트로는 키 입력을 가로채므로 따로 알려 준다
  api();
  return { sync };
}

/* ════════════════════════════════════════════════════════════
   문서 뷰 렌더링
   ════════════════════════════════════════════════════════════ */
const VISIBLE_PTS = 4;   // 나머지는 "더 보기"로 접는다

function renderDoc() {
  document.getElementById('d-sk').innerHTML = SKILLS.map((g, i) => `
    <div class="sk-g">
      <div class="sk-t"><i>${String(i + 1).padStart(2, '0')}</i> ${g.t}</div>
      <ul class="sk-l">${g.items.map(([n, key]) => `<li class="${key ? 'k' : ''}">${n}</li>`).join('')}</ul>
    </div>`).join('');

  const pjCard = p => `
    <article class="pj">
      <div class="pj-top">
        <span class="pj-no">${p.no}</span>
        <span class="pj-role">${p.role}</span>
        <span class="pj-per">${p.period}</span>
      </div>
      <div class="pj-hd">
        <h3 class="pj-n">${p.full}</h3>
        <p class="pj-one">${p.one}</p>
        ${p.stats ? `<dl class="pj-stats">${p.stats.map(([n, t]) => `<div><dt>${n}</dt><dd>${t}</dd></div>`).join('')}</dl>` : ''}
      </div>
      <div class="pj-grid">
        <div class="pj-txt">
          ${listBlock('맡은 일', p.mine, 'pts', VISIBLE_PTS)}
          ${troubleBlock({ ...p, __fold: VISIBLE_PTS })}
          ${listBlock('보안 점검', p.security, 'pts')}
          <div class="stk">${p.stack.map(s => `<span>${s}</span>`).join('')}</div>
          <div class="lk">${links(p)}</div>
        </div>
        <div class="pj-shot">${galleryHTML(p)}</div>
      </div>
    </article>`;
  document.getElementById('d-projects').innerHTML = PROJECTS.filter(p => !p.ai).map(pjCard).join('');
  const aiCard = c => `
    <div class="pgc">
      <div class="pgc-t"><div class="pgc-i">${c.icon}</div></div>
      <div class="pgc-n">${c.name}</div>
      <p class="pgc-d">${c.desc}</p>
      <div class="stk">${c.tools.map(s => `<span>${s}</span>`).join('')}</div>
    </div>`;
  document.getElementById('d-ai').innerHTML = `
    <div class="pl">${PROJECTS.filter(p => p.ai).map(pjCard).join('')}</div>
    <h3 class="ai-h">AI와 함께 개발한 것</h3>
    <div class="pg">${AI_USE.filter(c => c.how === 'dev').map(aiCard).join('')}</div>
    <h3 class="ai-h">AI를 기능으로 넣은 것</h3>
    <div class="pg">${AI_USE.filter(c => c.how === 'feat').map(aiCard).join('')}</div>`;

  document.getElementById('d-pg').innerHTML = PLAY.map(p => `
    <div class="pgc">
      <div class="pgc-t"><div class="pgc-i">${p.icon}</div><div class="pgc-s ${p.on ? 'on' : ''}">${p.status}</div></div>
      <div class="pgc-n">${p.name}</div>
      <p class="pgc-d">${p.desc}</p>
      <div class="stk">${p.stack.map(s => `<span>${s}</span>`).join('')}</div>
    </div>`).join('');

  PROJECTS.forEach(p => bindGallery(document.getElementById(p.ai ? 'd-ai' : 'd-projects'), p));

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
let music = null;   // 아래 createMusic()이 채운다. setView가 화면을 바꿀 때 음악도 같이 켜고 끈다

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

  if (music) music.sync();

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
const CHAR_MODEL_URL = 'models/player.glb';   // 상호랜드 왕자 (tools/blender/player, 뼈·동작은 Quaternius person.glb 그대로)
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

  /* 아래에서 차례로 await import 하는 모듈들을 지금 한꺼번에 받기 시작한다.
     import() 는 같은 주소면 같은 약속을 돌려주므로, 뒤의 await import 는 이미 받은(받는 중인) 것을 그대로 쓴다.
     (하나씩 줄 서서 받으면 요청마다 왕복 시간이 쌓여 인터넷에서 몇 초씩 늦어진다) */
  for (const u of [
    'three',
    'three/addons/loaders/GLTFLoader.js',
    'three/addons/loaders/DRACOLoader.js',
    'three/addons/geometries/RoundedBoxGeometry.js',
    'cannon-es',
    './animals.js',
    './audio.js',
    './bridge.js',
    './castle.js',
    './dialogue.js',
    './events.js',
    './festival.js',
    './fishing.js',
    './graphics.js',
    './kids.js',
    './minimap.js',
    './npcs.js',
    './pageant.js',
    './perf.js',
    './quests.js',
    './seasons.js',
    './shop.js',
    './sky.js',
    './tavern.js',
    './tracks.js',
    './vehicles.js',
    './village-props.js',
    './village.js',
    './weapons.js',
  ]) import(u).catch(() => {});

  await document.fonts.ready;   // 캔버스에 한글을 굽기 전에 웹폰트를 기다린다

  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

  /* ── 월드 크기 ──
     원형 광장에서 직선 고속도로로 바꿨다. 차는 (0,14)에서 -Z를 향해 출발하고
     게시판이 도로 좌우에 번갈아 선다. 경계는 원이 아니라 사각형이다. */
  const CAR_LEN = 4.2, PAD_R = 7.5;
  const ROAD_HALF = 9;                                   // 포장도로 반폭
  const BOUND = { x: 39, zMin: -81, zMax: 81 };          // 가을 숲 월드(84×168) 안

  const NEON_PINK = 0xff3d9a, NEON_CYAN = 0x2de2ff, SUN_WARM = 0xff8c42;

  const scene = new THREE.Scene();
  /* 안개 색을 노을의 지평선 색에 맞춰야 멀리가 하늘로 자연스럽게 녹는다 */

  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.5, 500);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;    // 네온이 하얗게 타지 않게
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('drive-root').appendChild(renderer.domElement);

  /* ════ 가을 숲 월드 ════
     Blender에서 만든 장면을 glb로 내보내 쓰고, 지형 높이·풀 자리·가판대 좌표는 JSON으로 받는다.
     웹에서 버거운 풀·낙엽·바람은 여기서 가볍게 다시 만든다. */
  const WORLD = await (await fetch('models/autumn-world.json')).json();
  const GRID = WORLD.grid;
  /* 월드는 길 방향(z)으로 더 길다. 예전 정사각형 JSON(n, half)도 그대로 읽는다 */
  const GX = GRID.nx ?? GRID.n, GZ = GRID.nz ?? GRID.n;
  const HX = GRID.halfX ?? GRID.half, HZ = GRID.halfZ ?? GRID.half;
  const pathX = z => WORLD.path.amp * Math.sin(-WORLD.path.k * z);
  /* Blender 격자(위가 +Y)를 웹 좌표(-Z가 앞)로 읽는다 */
  function heightAt(x, z) {
    const fx = Math.min(GX - 1.001, Math.max(0, (x + HX) / GRID.step));
    const fy = Math.min(GZ - 1.001, Math.max(0, (-z + HZ) / GRID.step));
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const h = (i, j) => GRID.h[j * GX + i];
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

  /* ── 하늘 · 안개 · 하루 (sky.js) ──
     약 3분 30초에 하루: 새벽 → 한낮 → 황금빛 저녁 → 노을 → 밤. 하늘 돔·별·해·달·안개·빛을 sky.js가 맡는다.
     계절(seasons.js)이 그 위에 덧칠하므로 step()에서 updateDayNight 다음에 seasons.update. */
  scene.fog = new THREE.Fog(0x2a1a33, 26, 100);

  /* ── 조명 ── */
  const hemi = new THREE.HemisphereLight(0xffb48a, 0x1a1030, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9050, 1.35);   // 낮엔 해, 밤엔 달 (sky.js가 방향·색을 바꾼다)
  /* 월드가 길어서 그림자 상자를 플레이어 주변에만 두고 따라다니게 한다 (아래 followSun). 방향은 sky.js가 매 프레임 정한다 */
  const SUN_OFFSET = new THREE.Vector3(-40, 16, 34);
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 160 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const followSun = (x, z) => { sun.target.position.set(x, 0, z); sun.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z); };
  const fill = new THREE.DirectionalLight(0x7088ff, 0.45);   // 푸른 보조광
  fill.position.set(40, 20, -30);
  scene.add(fill);

  const { createSky } = await import('./sky.js');
  const sky = createSky({ THREE, scene, renderer, hemi, sun, fill, sunOffset: SUN_OFFSET });
  const skyU = sky.skyU;

  /* 선술집 불빛과 차 헤드라이트는 밤이 깊을수록 밝아진다 (아래에서 채운다) */
  const nightGlow = { lights: [], lanterns: [], bulbs: [], heads: [] };
  let night = 0;
  function updateDayNight(dt) {
    sky.update(dt);
    night = sky.night;
    const k = night;
    for (const l of nightGlow.lights) l.intensity = 4 + 22 * k;
    for (const m of nightGlow.lanterns) m.emissiveIntensity = 0.6 + 1.5 * k;
    for (const m of nightGlow.bulbs) m.color.setHex(0xffd98a).multiplyScalar(0.8 + 1.2 * k);
    for (const h of nightGlow.heads) h.intensity = 6 + 34 * k;   // 밤에도 앞 블록이 하얗게 날아가지 않을 만큼만
  }

  /* ── 계절 (seasons.js) ──
     약 1분마다 가을 → 겨울 → 봄 → 여름. 낮밤 위에 덧칠하므로 step()에서 updateDayNight 바로 다음에 부른다 */
  const { createSeasons } = await import('./seasons.js');
  const seasons = createSeasons({ THREE, scene, renderer, hemi, sun, skyU, sky, badge: document.getElementById('g-season') });

  /* 월드 바깥 바닥 — 지형 가장자리가 허공에 뜨지 않게 */
  {
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ color: 0x6e3412, roughness: 1 }));
    seasons.addGround(outer.material);   // 계절: 바깥 바닥 색과 눈
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

  /* ── 나무 비우기 ──
     Blender에서 나무가 줄기(EX_Trunks)·잎(EX_Leaves) 메시 하나로 합쳐져 나와서 한 그루씩 지울 수 없다.
     가판대 6곳 밖에 세운 구역(AI 구역)은 그 자리 나무를 여기서 지운다.
     땅에 닿은 줄기 정점을 모아 그루터기 위치를 찾고, 반경 r 안의 그루터기에 가장 가까운
     삼각형(줄기·가지·잎)을 통째로 접어 없앤다. 반경 밖 나무는 잎이 반쯤 잘리지 않게 그대로 둔다. */
  function clearTrees(root, spots, r) {
    if (!spots.length) return;
    root.updateMatrixWorld(true);
    const trunks = [], leaves = [];
    root.traverse(o => { if (!o.isMesh || !o.geometry.index) return; if (o.name.includes('Leaves')) leaves.push(o); else if (o.name.includes('Trunks')) trunks.push(o); });
    if (!trunks.length) return;
    const v = new THREE.Vector3(), near = (x, z, R) => spots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < R);
    /* 그루터기: 땅 가까운 줄기 정점을 1유닛 안끼리 묶는다 */
    const stumps = [];
    for (const t of trunks) for (let i = 0, tp = t.geometry.attributes.position; i < tp.count; i++) {
      v.fromBufferAttribute(tp, i).applyMatrix4(t.matrixWorld);
      if (!near(v.x, v.z, r + 8) || v.y - heightAt(v.x, v.z) > 0.6) continue;
      const s = stumps.find(s => Math.hypot(s.x - v.x, s.z - v.z) < 1.0);
      if (s) { s.x = (s.x * s.n + v.x) / (s.n + 1); s.z = (s.z * s.n + v.z) / (s.n + 1); s.n++; }
      else stumps.push({ x: v.x, z: v.z, n: 1 });
    }
    for (const s of stumps) s.kill = near(s.x, s.z, r);
    if (!stumps.some(s => s.kill)) return;
    for (const m of [...trunks, ...leaves]) {
      const pos = m.geometry.attributes.position, idx = m.geometry.index, c = new THREE.Vector3();
      for (let f = 0; f < idx.count; f += 3) {
        c.set(0, 0, 0);
        for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(pos, idx.getX(f + k)));
        c.multiplyScalar(1 / 3).applyMatrix4(m.matrixWorld);
        if (!near(c.x, c.z, r + 6)) continue;
        let best = null, bd = 6;
        for (const s of stumps) { const d = Math.hypot(s.x - c.x, s.z - c.z); if (d < bd) { bd = d; best = s; } }
        if (best && best.kill) { idx.setX(f, 0); idx.setX(f + 1, 0); idx.setX(f + 2, 0); }
      }
      idx.needsUpdate = true;
    }
  }

  /* ── Blender 월드 glb ── */
  const worldManager = new THREE.LoadingManager();
  /* 월드 glb는 Draco로 압축돼 있다(7.9MB → 1.1MB). 디코더는 three와 같은 버전의 CDN에서 받는다 */
  const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
  /* ── 마을 소품: 오두막 마을 두 곳·밭과 풍차·우물·분수·가로등·굴뚝 연기 (village-props.js) ── */
  const { createVillageProps } = await import('./village-props.js');
  const vprops = createVillageProps({ THREE, scene, GLTFLoader, dracoLoader: draco, groundY, heightAt, pathX,
    roadHalf: WORLD.path.half, getNight: () => night, seasons, camera,
    avoid: [{ x: pathX(57.4) - 4.6, z: 57.4, r: 2.5 }] });   // 의뢰 게시판 자리
  const worldLoader = new GLTFLoader(worldManager);
  worldLoader.setDRACOLoader(draco);
  /* 장난감 블록·상호왕국 표지판 자리 (나무를 치우려고 월드 로딩 전에 정한다) */
  const NAME_Z = WORLD.start.z - 12, ROW_Z = WORLD.start.z - 9.6, BLOCK_X = pathX(NAME_Z) + 15;
  /* 상호랜드 표지판은 의뢰 게시판(quests.js 기본 자리: 길 왼쪽 z 57.4, 같은 방향) 바로 옆, 출발점 쪽에 나란히 선다 */
  const KINGDOM_SIGN = (() => {
    const bz = 57.4, bx = pathX(bz) - 4.6, rot = Math.PI / 2 - 0.45, gap = 3.5;   // quests.js 게시판 값과 같게
    return { x: bx - Math.cos(rot) * gap, z: bz + Math.sin(rot) * gap, rot };
  })();
  const { PONDS } = await import('./fishing.js');   // 연못 자리의 나무는 치운다
  const { CASTLE_CLEAR } = await import('./castle.js');   // 성문·성벽 자리의 나무도
  const { FESTIVAL_CLEAR, createFestival } = await import('./festival.js');   // 창시합장·활터·마을 광장
  const { SHOP_CLEAR, createShop } = await import('./shop.js');                // 물약 가게·상인 자리
  const { PAGEANT_CLEAR, createPageant } = await import('./pageant.js');       // 연회·결혼식·등불·투석기·줄다리기 자리
  let castle = null, animals = null, quests = null, kids = null, shop = null, minimap = null;   // 아래에서 만든다 (걷기·운전 충돌, 행차가 먼저 참조)
  /* 개울 위 돌다리 (bridge.js) — 월드의 옛 나무다리(EX_Bridge)는 숨긴다. 높이 곡선은 bridgeY 그대로 */
  const { createBridge } = await import('./bridge.js');
  const bridge = createBridge({ THREE, scene, GLTFLoader, dracoLoader: draco, pathX, bridgeData: WORLD.bridge });
  worldLoader.load('models/autumn-world.glb', gltf => {
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
    seasons.attachWorld(gltf.scene);   // 계절: 잎·땅·길 색과 눈 쌓임 (addWind 다음에 붙여야 둘 다 산다)
    scene.add(gltf.scene);
    bridge.hideOld(gltf.scene);
    clearTrees(gltf.scene, PROJECTS.filter(p => p.ai).map(p => p.pos), 7.5);
    clearTrees(gltf.scene, PONDS.map(p => [p.x, p.z]), 6.2);
    clearTrees(gltf.scene, [[BLOCK_X, (NAME_Z + ROW_Z) / 2]], 6);       // 장난감 블록 자리
    clearTrees(gltf.scene, [[KINGDOM_SIGN.x, KINGDOM_SIGN.z]], 2.6);   // 상호랜드 표지판
    clearTrees(gltf.scene, CASTLE_CLEAR.spots, CASTLE_CLEAR.r);         // 북쪽 성문
    for (const g of vprops.clearGroups) clearTrees(gltf.scene, g.spots, g.r);   // 오두막·밭·풍차
    clearTrees(gltf.scene, FESTIVAL_CLEAR.spots, FESTIVAL_CLEAR.r);              // 축제 자리
    clearTrees(gltf.scene, SHOP_CLEAR.spots, SHOP_CLEAR.r);                      // 물약 가게·상인
    clearTrees(gltf.scene, PAGEANT_CLEAR.spots, PAGEANT_CLEAR.r);                // 연회장·투석기·줄다리기
  });

  /* ── 풀 — 브루노 시몽 숲처럼 짧고 뾰족한 풀을 촘촘히 ──
     차나 사람이 지나간 자리는 눕고, 몇 초에 걸쳐 다시 일어난다.
     밟힌 정도는 월드를 덮는 128×128 텍스처(trail)에 적고 셰이더가 읽는다. */
  const TRAIL_N = 128, TRAIL_NZ = Math.round(TRAIL_N * HZ / HX);   // 칸이 정사각형이 되게 z쪽을 늘린다
  const trailData = new Uint8Array(TRAIL_N * TRAIL_NZ * 4);
  const trailTex = new THREE.DataTexture(trailData, TRAIL_N, TRAIL_NZ, THREE.RGBAFormat);
  trailTex.magFilter = trailTex.minFilter = THREE.LinearFilter;
  trailTex.needsUpdate = true;
  const trailCells = (x, z) => [Math.round((x + HX) / (HX * 2) * (TRAIL_N - 1)), Math.round((z + HZ) / (HZ * 2) * (TRAIL_NZ - 1))];
  let trailAcc = 0;
  /* 매 프레임: 전체를 조금씩 회복시키고(다시 자람), 지나가는 자리를 눕힌다 */
  function updateTrail(dt, stamps) {
    trailAcc += dt * 46;                   // 1초에 46만큼 회복 → 꽉 눌린 풀이 약 5.5초면 다시 선다
    const dec = Math.floor(trailAcc); trailAcc -= dec;
    if (dec) for (let i = 0; i < trailData.length; i += 4) { const v = trailData[i]; if (v) trailData[i] = v > dec ? v - dec : 0; }
    for (const [x, z, r] of stamps) {
      const [cx, cz] = trailCells(x, z), rc = Math.ceil(r / (HX * 2) * TRAIL_N);
      for (let j = cz - rc; j <= cz + rc; j++) for (let i = cx - rc; i <= cx + rc; i++) {
        if (i < 0 || j < 0 || i >= TRAIL_N || j >= TRAIL_NZ) continue;
        const d = Math.hypot(i - cx, j - cz) / rc;
        if (d > 1) continue;
        const k = (j * TRAIL_N + i) * 4, v = Math.round(255 * Math.min(1, (1 - d) * 1.6));
        if (v > trailData[k]) trailData[k] = v;
      }
    }
    trailTex.needsUpdate = true;
  }
  {
    const H = 0.42, W = 0.035;
    const pos = [], idx = [];
    for (let b = 0; b < 4; b++) {                           // 한 포기 = 뾰족한 풀잎 4장
      const a = b * Math.PI / 2 + 0.4 + (b % 2) * 0.3;
      const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
      const base = pos.length / 3, h = H * (0.8 + (b % 3) * 0.15);
      pos.push(dx * 0.03 - px * W, 0, dz * 0.03 - pz * W, dx * 0.03 + px * W, 0, dz * 0.03 + pz * W,
               dx * 0.07 - px * W * 0.55, h * 0.5, dz * 0.07 - pz * W * 0.55, dx * 0.07 + px * W * 0.55, h * 0.5, dz * 0.07 + pz * W * 0.55,
               dx * 0.13, h, dz * 0.13);
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
    }
    const tuft = new THREE.BufferGeometry();
    tuft.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tuft.setIndex(idx);
    tuft.computeVertexNormals();

    const gm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85, side: THREE.DoubleSide });
    gm.onBeforeCompile = sh => {
      sh.uniforms.uTime = timeU;
      sh.uniforms.uTrail = { value: trailTex };
      sh.uniforms.uHalf = { value: new THREE.Vector2(HX, HZ) };
      /* 계절: 풀 색(dry/lush)과 쌓인 눈(uSnow)은 seasons.js가 매 프레임 바꾼다 */
      Object.assign(sh.uniforms, seasons.uniforms);
      sh.vertexShader = 'uniform float uTime; uniform sampler2D uTrail; uniform vec2 uHalf; uniform float uSnow;\nvarying float vH; varying float vPatch; varying float vPress;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 gw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vH = clamp(position.y / ${H.toFixed(2)}, 0.0, 1.0);
        /* 위치별 얼룩 — 큰 사인 무늬 두 개를 겹쳐 색이 은은하게 달라지게 */
        vPatch = 0.5 + 0.25 * sin(gw.x * 0.21 + sin(gw.z * 0.17) * 2.0) + 0.25 * sin(gw.z * 0.13 - gw.x * 0.07);
        float press = texture2D(uTrail, (gw.xz + uHalf) / (uHalf * 2.0)).r;
        vPress = press;
        transformed.y *= 1.0 - press * 0.82;                       // 밟히면 눕는다
        transformed.y *= 1.0 - uSnow * 0.5;                        // 눈에 묻혀 짧아진다
        float gs = sin(uTime*1.7 + gw.x*0.33 + gw.z*0.27)*0.55 + sin(uTime*2.9 + gw.x*0.8 - gw.z*0.45)*0.2 + 0.3;
        float bw = vH * vH * (1.0 - press);
        transformed.x += gs * bw * 0.22; transformed.z += gs * bw * 0.09;`);
      sh.fragmentShader = 'uniform vec3 uDry; uniform vec3 uLush; uniform float uSnow;\nvarying float vH; varying float vPatch; varying float vPress;\n' + sh.fragmentShader.replace('#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb *= mix(uDry, uLush, vPatch) * 1.35;
        diffuseColor.rgb *= mix(0.38, 1.12, vH) * (1.0 - vPress * 0.1);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.97), uSnow * (0.35 + 0.6 * vH));   // 눈이 쌓이면 하얗게`);
    };
    const spots = [];
    for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) {
      if (GRID.mask[j * GX + i] < 0.6) continue;
      const cnt = 3 + (Math.random() < 0.5 ? 1 : 0);
      for (let k = 0; k < cnt; k++) {
        const gx = -HX + (i + Math.random() - .5) * GRID.step, gz = HZ - (j + Math.random() - .5) * GRID.step;
        if (vprops.noGrass(gx, gz)) continue;   // 집·밭 안에는 풀을 심지 않는다
        spots.push([gx, gz]);
      }
    }
    const grass = new THREE.InstancedMesh(tuft, gm, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    const tint = new THREE.Color();
    spots.forEach(([x, z], i) => {
      e.set((Math.random() - .5) * 0.2, Math.random() * Math.PI * 2, (Math.random() - .5) * 0.2);
      const k = 0.75 + Math.random() * 0.55;
      m4.compose(ps.set(x, heightAt(x, z), z), q.setFromEuler(e), sc.set(k, k * (0.85 + Math.random() * 0.4), k));
      grass.setMatrixAt(i, m4);
      grass.setColorAt(i, tint.setScalar(0.88 + Math.random() * 0.24));
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
    seasons.attachLeaves(mesh);   // 계절: 겨울엔 그치고 봄엔 분홍 꽃잎으로 (보이는 개수 mesh.count를 seasons가 정한다)
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
    /* 스킨 메시는 본 변형까지 반영한 실제 정점으로 재야 크기가 맞는다 (precise) */
    model.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(model, true).getSize(new THREE.Vector3());
    if (size.y > 0.0001) model.scale.setScalar(CHAR_HEIGHT / size.y);
    model.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(model, true);
    const c = b.getCenter(new THREE.Vector3());
    model.position.x -= c.x; model.position.z -= c.z; model.position.y -= b.min.y;
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      /* 양면 재질이면 안쪽 면이 겹쳐 캐릭터가 시커멓게 보인다 → 앞면만 (망토는 안감이 따로 있어 괜찮다) */
      for (const m of [].concat(o.material)) if (m.side === THREE.DoubleSide) m.side = THREE.FrontSide;
    });

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
  vprops.addBodies(CANNON, world);   // 오두막·풍차·우물 등 고정 몸체
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
  /* 출발점 앞 길 오른쪽 풀밭 (길은 비워 두고, 연락처 조형물 너머에서 보이게) */
  const NAME = [['최', '#ff6b3d'], ['상', '#1fa59c'], ['호', '#e8466e']];
  NAME.forEach(([ch, c], i) => toyBlock(ch, 2.1, 2.1, 1.05, BLOCK_X + (i - 1) * 2.35, 1.05, NAME_Z, c, 3));
  const SMALL = ['#f4a53c', '#3a9fc4', '#e8466e', '#2bb38f', '#8a6ad8'];
  /* 작은 큐브 한 줄: AI · ENGINEER (가운데 한 칸 띄움, 글자 수에 맞춰 가운데 정렬) */
  const ROW_TEXT = 'AI ENGINEER', ROW_MID = (ROW_TEXT.length - 1) / 2;
  [...ROW_TEXT].forEach((ch, i) => { if (ch !== ' ') toyBlock(ch, 0.74, 0.74, 0.74, BLOCK_X + (i - ROW_MID) * 0.8, 0.37, ROW_Z, SMALL[i % 5], 0.6); });

  /* ── 길 왼쪽 나무 표지판 "상호랜드" (의뢰 게시판과 나란히) ── */
  {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: .85 });
    for (const sx of [-1.15, 1.15]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.9, 8), wood);
      post.position.set(sx, 1.45, 0); post.castShadow = true; g.add(post);
    }
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 420;
    const c = cv.getContext('2d');
    const grd = c.createLinearGradient(0, 0, 0, 420); grd.addColorStop(0, '#b07a45'); grd.addColorStop(1, '#8a5a2e');
    c.fillStyle = grd; c.fillRect(0, 0, 1024, 420);
    c.strokeStyle = 'rgba(60,32,14,.35)'; c.lineWidth = 3;                       // 나뭇결
    for (let y = 18; y < 420; y += 26) { c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(300, y + 8, 700, y - 8, 1024, y + 4); c.stroke(); }
    c.strokeStyle = '#4a2a14'; c.lineWidth = 18; c.strokeRect(9, 9, 1006, 402);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '900 168px Pretendard, system-ui, sans-serif';
    c.fillStyle = 'rgba(40,20,8,.55)'; c.fillText('상호랜드', 518, 172);
    c.fillStyle = '#ffe2a8'; c.fillText('상호랜드', 512, 164);
    c.font = '700 50px Pretendard, system-ui, sans-serif'; c.fillStyle = '#fff1d0';
    c.fillText('♔ 임금님 최상호의 나라에 오신 걸 환영합니다', 512, 318);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.2, 0.12),
      [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: tex, roughness: .8 }), new THREE.MeshStandardMaterial({ map: tex, roughness: .8 })]);
    board.position.y = 2.15; board.castShadow = true; g.add(board);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.42), wood);   // 작은 처마
    roof.position.y = 2.82; roof.castShadow = true; g.add(roof);
    g.position.set(KINGDOM_SIGN.x, Math.max(0, heightAt(KINGDOM_SIGN.x, KINGDOM_SIGN.z)), KINGDOM_SIGN.z);
    g.rotation.y = KINGDOM_SIGN.rot;                                              // 게시판과 같은 쪽(길·출발점)을 본다
    scene.add(g);
    const sb = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1.35, 1.4, 0.15)) });
    sb.position.set(g.position.x, g.position.y + 1.4, g.position.z);
    sb.quaternion.setFromEuler(0, g.rotation.y, 0);
    world.addBody(sb);
  }

  function restackBlocks() {
    /* 차나 캐릭터가 블록 자리에 서 있으면 다시 쌓는 순간 블록이 튕겨 나간다. 출발점으로 옮긴다 */
    const inArea = p => toyBlocks.some(b => Math.hypot(p.x - b.home.x, p.z - b.home.z) < 2.8);
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
    if (person.visible && !(tavern && tavern.seated)) personBody.position.set(person.position.x, person.position.y + 0.9, person.position.z);   // 앉은 사람은 의자·테이블을 밀지 않게
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
  /* 남은 로딩 수를 센다 — 월드 구성이 끝났을 때 이미 다 받았으면 바로 시작하려고 (onLoad 가 그보다 먼저 지나가 버리는 경우) */
  let mgrPending = 0;
  { const s0 = manager.itemStart.bind(manager), e0 = manager.itemEnd.bind(manager);
    manager.itemStart = u => { mgrPending++; s0(u); };
    manager.itemEnd = u => { mgrPending = Math.max(0, mgrPending - 1); e0(u); }; }
  const texLoader = new THREE.TextureLoader(manager);
  const stations = [];

  /* 가판대 자리는 Blender에서 세운 6곳 (최신 프로젝트가 출발점에서 가장 가깝다) */
  PROJECTS.forEach((p, i) => { const st = WORLD.stalls[i]; if (st) p.pos = [st.x, st.z]; });

  /* ── 중세 선술집 부스 7종 + 나무 의자·테이블 (models/props, README 참고) ──
     부스 파일은 스테이션 그룹 단위(0.62배)라 그룹에 그대로 넣는다. 출발점에서 가까운 순서대로
     tudor → norse → bavarian → venta → tent → flemish → osteria. 의자는 부스 분위기에 맞춰 고른다. */
  const BOOTH_ORDER = ['tudor', 'norse', 'bavarian', 'venta', 'tent', 'flemish', 'osteria'];
  const BOOTH_TOP = { tudor: 6.3, bavarian: 7.0, norse: 6.6, osteria: 5.1, venta: 5.1, flemish: 7.1, tent: 7.1 };   // 그룹 단위 꼭대기
  const SEAT_OF = { norse: 'stool-log', venta: 'stool-barrel', flemish: 'stool-barrel' };   // 나머지는 stool
  const { addStaticLOD } = await import('./perf.js');   // 멀리 있는 정적 묶음을 한 덩어리로 (그리기 호출 줄이기)
  const props = {};
  {
    const pl = new GLTFLoader(); pl.setDRACOLoader(draco);
    const get = name => new Promise(res => pl.load(`models/props/tavern-${name}.glb`, g => res(g.scene), undefined, () => res(null)));
    const names = [...BOOTH_ORDER, 'stool', 'stool-barrel', 'stool-log', 'table'];
    (await Promise.all(names.map(get))).forEach((sc, i) => { props[names[i]] = sc; });
  }
  /* 길을 따라 출발점(z가 큰 쪽)에서 가까운 순서 → 부스 종류 */
  const boothOf = new Map([...PROJECTS].sort((a, b) => b.pos[1] - a.pos[1]).map((p, i) => [p, BOOTH_ORDER[i % BOOTH_ORDER.length]]));
  /* 이름판(sign_face)에 프로젝트 이름을 따뜻한 페인트 글씨로 */
  function paintSign(mesh, p) {
    mesh.geometry.computeBoundingBox();
    const bs = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
    const aspect = Math.max(1, (bs.x || 1) / (bs.y || bs.z || 1));
    const H = 128, W = Math.min(1024, Math.round(H * aspect)), cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#6b4024'); grd.addColorStop(1, '#4a2a17');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.18; g.strokeStyle = '#2a170c';
    for (let y = 8; y < H; y += 11) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + 4, W * 0.7, y - 4, W, y + 2); g.stroke(); }   // 나뭇결
    g.globalAlpha = 1;
    g.strokeStyle = p.color; g.lineWidth = 6; g.strokeRect(6, 6, W - 12, H - 12);
    let fs = 70; g.font = `800 ${fs}px Pretendard, system-ui, sans-serif`;
    while (g.measureText(p.name).width > W - 40 && fs > 28) { fs -= 4; g.font = `800 ${fs}px Pretendard, system-ui, sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = '#2a170c'; g.strokeText(p.name, W / 2, H / 2 + 3);
    g.fillStyle = '#f6e2b8'; g.fillText(p.name, W / 2, H / 2 + 3);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    mesh.material = mesh.material.clone();
    mesh.material.map = t; mesh.material.color.set(0xffffff); mesh.material.needsUpdate = true;
  }

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

    /* 선술집 부스 — 같은 역할의 손수레·차양·전구·상자는 부스 안에 다 들어 있다 */
    const style = boothOf.get(p);
    const booth = props[style] ? props[style].clone() : null;
    if (booth) {
      booth.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = true;
        const mn = o.material && o.material.name || '';
        if (/^(Lantern|Flame|Firebox)_Glow/.test(mn)) {
          if (!o.material.userData.glow) { o.material.userData.glow = true; nightGlow.lanterns.push(o.material); }
          o.castShadow = false;
        }
        if (o.name.startsWith('sign_face') || /^Sign_Face/.test(mn)) paintSign(o, p);
      });
      g.add(booth);
      addStaticLOD(THREE, booth, { dist: 38, keep: o => /_Glow|^Sign_Face/.test(o.material.name || '') || o.name.startsWith('sign_face') });   // perf.js: 멀면 한 덩어리
    }

    /* 따뜻한 가판대 불빛 */
    const glow = new THREE.PointLight(0xff9a4a, 12, 20, 2);
    nightGlow.lights.push(glow);
    glow.position.set(0, 3.0, 2.2);   // 부스 처마 아래
    g.add(glow);

    /* 간판은 수레 뒤에 서서 카메라를 향해 돈다 */
    const face = new THREE.Group();
    face.position.set(0, Math.max(0, (BOOTH_TOP[style] || 0) - 4.6), -2.6);   // 높은 지붕이 간판 아래를 가리지 않게 올린다
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


    /* ── AI 구역 ── 간판 위에 떠서 도는 빛나는 결정, 길가에 "AI 활용 구역" 푯말 */
    let crystal = null;
    if (p.ai) {
      crystal = add(new THREE.OctahedronGeometry(1.1, 0),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4, roughness: .25, metalness: .1, flatShading: true }),
        boardW / 2 + 1.6, frame.position.y + boardH / 2 - 0.4, 0.4, face);
      crystal.castShadow = false;
      const cg = new THREE.PointLight(p.color, 10, 16, 2);
      cg.position.copy(crystal.position);
      face.add(cg);

      const scv = document.createElement('canvas'); scv.width = 512; scv.height = 160;
      const sc = scv.getContext('2d');
      sc.fillStyle = '#5a3420'; sc.fillRect(0, 0, 512, 160);
      sc.fillStyle = '#3a2214'; sc.fillRect(0, 0, 512, 10); sc.fillRect(0, 150, 512, 10);
      sc.fillStyle = p.color; sc.fillRect(26, 34, 92, 92);
      sc.fillStyle = '#fff'; sc.font = '900 48px sans-serif'; sc.textAlign = 'center'; sc.textBaseline = 'middle';
      sc.fillText('AI', 72, 82);
      sc.fillStyle = '#fff3df'; sc.font = '800 52px sans-serif'; sc.textAlign = 'left';
      sc.fillText('AI 활용 구역', 140, 84);
      const stex = new THREE.CanvasTexture(scv); stex.colorSpace = THREE.SRGBColorSpace;
      /* 수레 앞, 길 가장자리에 서서 오는 차를 본다 */
      const sign = new THREE.Group();
      sign.position.set(5.6, 0, 6.5);
      sign.rotation.y = -0.7;
      g.add(sign);
      add(new THREE.BoxGeometry(0.22, 3.4, 0.22), woodDark, 0, 1.7, 0, sign);
      const board = add(new THREE.BoxGeometry(5.2, 1.62, 0.16), new THREE.MeshBasicMaterial({ map: stex }), 0, 3.2, 0.14, sign);
      board.material = [woodDark, woodDark, woodDark, woodDark, board.material, woodDark];
    }

    scene.add(g);
    stations.push({ ...p, style, group: g, face, ring, label, crystal, labelY: label.position.y, phase: Math.random() * Math.PI * 2 });
    addStaticLOD(THREE, face, { dist: 38, keep: o => !!o.material.map || o === crystal || o.parent === crystal });   // 간판 기둥·틀·지붕만 합침 (그림 판은 그대로)
  }

  /* ── 선술집 앞 나무 의자와 둥근 테이블 (models/props) ──
     차로 부딪히면 넘어지고 R로 다시 세운다 (장난감 블록과 같은 목록에 넣는다).
     GLB 원점은 바닥이고 코드는 메시를 물리 몸체 중심(높이 절반)에 두므로 빈 그룹에 감싸 내린다.
     모델이 없으면 예전 원기둥으로. 자리·높이는 그대로라 npcs.js STOOL_* 는 안 바꿔도 된다 */
  {
    const stoolMat = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: .8 });
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: .7 });
    const wrapProp = (name, h) => {
      if (!props[name]) return null;
      const holder = new THREE.Group(), m = props[name].clone();   // clone 은 지오메트리·재질을 함께 쓴다
      m.position.y = -h / 2;
      m.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
      holder.add(m);
      addStaticLOD(THREE, holder, { dist: 30 });   // 의자·테이블: 멀면 한 덩어리 (holder 째 물리로 움직여도 됨)
      return holder;
    };
    const v = new THREE.Vector3();
    for (const st of stations) {
      st.group.updateMatrixWorld(true);
      const place = (mesh, shape, lx, lz, h, mass) => {
        st.group.localToWorld(v.set(lx, 0, lz));
        const y = h / 2 + 0.01;
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
        const body = new CANNON.Body({ mass, shape, linearDamping: 0.1, angularDamping: 0.15, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.6 });
        body.position.set(v.x, y, v.z);
        world.addBody(body);
        mesh.position.set(v.x, y, v.z);
        toyBlocks.push({ mesh, body, home: new CANNON.Vec3(v.x, y, v.z) });
      };
      /* 그룹이 0.62배라 크기는 월드 기준으로 바로 잡는다 */
      const tH = 0.7, tR = 0.62;
      let table = wrapProp('table', tH);
      if (!table) {
      table = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(tR, tR, 0.07, 18), tableMat); top.position.y = tH / 2 - 0.035;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, tH, 8), tableMat);
      top.castShadow = leg.castShadow = true;
      table.add(top, leg);
      }
      place(table, new CANNON.Cylinder(tR, tR, tH, 10), 0, 4.6, tH, 1.2);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        const stool = wrapProp(SEAT_OF[st.style] || 'stool', 0.42) || new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.42, 12), stoolMat);
        place(stool, new CANNON.Cylinder(0.2, 0.17, 0.42, 10), Math.cos(a) * 1.75, 4.6 + Math.sin(a) * 1.75, 0.42, 0.35);
      }
    }
  }

  /* ── 중세 손님들 — 숲길을 거닐다 포장마차 의자에 앉아 술을 마신다 (npcs.js) ──
     로딩을 막지 않게 기다리지 않는다. 의자 수치를 바꾸면 npcs.js의 STOOL_* 도 같이 바꿀 것 */
  /* ── 북쪽 길 끝 성문 "상호성" (castle.js) — 임금님 행차가 이리로 들어간다. 성벽은 물리 상자로 막는다 ── */
  {
    const { createCastle } = await import('./castle.js');
    castle = createCastle({ THREE, scene, GLTFLoader, dracoLoader: draco, groundY, pathX, CANNON, world, getNight: () => night });
  }
  /* 마을 소품·성벽·가게 건물 — 걷는 손님·아이·동물이 뚫고 지나가지 않게 밀어낸다 */
  const propObstacles = (p, r) => { let h = vprops.pushOut(p, r); if (castle && castle.pushOut(p, r)) h = true; if (shop && shop.pushOut(p, r)) h = true; return h; };
  let npcs = null, events = null, village = null, festival = null, pageant = null;
  let ridesRef = null;   // 탈것 바꾸기(rides)는 아래에서 만든다 — getRide 는 매 프레임 update 안에서만 불린다
  /* 차로 치면 넘어지고 화낸다 — 지금 탈것의 위치·방향·속도·크기. 같은 객체를 재사용한다 */
  const rideInfo = { x: 0, z: 0, heading: 0, halfX: 1.05, halfZ: 2.15, speed: 0, driving: false };
  {
    const { createNPCs, stallsFromStations, attachGrab } = await import('./npcs.js');
    const { createEvents } = await import('./events.js');
    const { createVillage } = await import('./village.js');
    createNPCs({
      THREE, scene, GLTFLoader,
      dracoLoader: draco,
      groundY, pathX,
      stalls: stallsFromStations(stations, { THREE, toyBlocks }),
      bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
      roadHalf: WORLD.path.half,
      bridge: WORLD.bridge,
      getPlayerPos: () => activePos(),
      getNight: () => night,
      count: 25,   // 모델을 돌려 써서 25명이 돌아다닌다
      obstacles: propObstacles,
      getRide: () => {
        rideInfo.x = car.position.x; rideInfo.z = car.position.z;
        rideInfo.heading = heading;              // 앞 방향 = (sin heading, cos heading)
        rideInfo.speed = speed;                  // 부호 있는 m/s (후진이면 음수)
        rideInfo.driving = player.mode === 'driving';
        if (ridesRef) { const p = ridesRef.params(ridesRef.current); rideInfo.halfX = p.half[0]; rideInfo.halfZ = p.half[2]; }
        return rideInfo;
      },
    }).then(n => {
      npcs = n;
      /* 걸어 다닐 때 손님을 짧게 클릭 = 주먹, 꾹 누르기 = 잡아서 던지기 */
      attachGrab(n, {
        THREE, camera, domElement: renderer.domElement,
        getPlayerPos: () => activePos(), groundY,
        isBlocked: () => !driveActive || panel.classList.contains('open') || !!(weapons && weapons.armed) || !!(tavern && tavern.seated) || !!(dialogue && dialogue.active) || !!(fishing && fishing.active) || !!(quests && quests.open) || !!(shop && shop.open) || attackBusy(),   // 무기를 들면 클릭은 공격
        isOnFoot: () => player.mode === 'onfoot',
        getPlayerFacing: () => person.rotation.y,
        playPunch: () => { playerPunch(); if (animals) animals.punchFrom(person.position, person.rotation.y); if (kids) kids.punch(); },
      });
      /* 수배 ★·경비병·술집 싸움·음유시인 (events.js) */
      events = createEvents({
        THREE, npcs: n, camera, pathX,
        getPlayerPos: () => activePos(),
        isDriving: () => player.mode === 'driving',
        isMusicOn: () => document.getElementById('g-music-btn')?.getAttribute('aria-pressed') === 'true',
        isVisible: () => driveActive,
        onPlayerCaught: () => {
          /* 붙잡히면 그 자리에서 꾸중만 듣는다 (무기는 압수 = 집어넣기) */
          if (weapons) weapons.holster();
          pSpeed = 0;
          const SCOLD = ['이번만 봐주겠다! 임금님 마을에서 소란은 금물이다!', '어허! 무기를 함부로 쓰면 못쓴다!', '한 번만 더 그러면 성 감옥행이다!', '임금님께서 슬퍼하신다. 착하게 지내거라!'];
          /* 꾸중 끝에 임금님(최상호) 연락처를 하나 알려 준다 */
          const CONTACT = [
            '할 말이 있으면 임금님께 직접 서신을 보내라 ✉ maeguming0000@gmail.com',
            '임금님의 업적이 궁금하면 왕실 기록소로 가 보거라 → github.com/aabyess',
            '억울하면 임금님께 전갈을 넣어라 ☎ 010-3322-7250',
          ];
          const pick = a => a[Math.floor(Math.random() * a.length)];
          toast(`🛡️ 근위병: "${pick(SCOLD)}"<div style="font:500 14px system-ui;opacity:.85;margin-top:6px">${pick(CONTACT)}</div>`, 4200);
        },
        onEvent: text => toast(text, 2400),
        stallNames: stations.map(s => s.name),
      });
      /* 임금님 행차·밤 불꽃놀이·닭 소동·소매치기 (village.js) */
      village = createVillage({
        THREE, scene, camera, npcs: n, pathX, groundY,
        getPlayerPos: () => activePos(),
        isOnFoot: () => player.mode === 'onfoot',
        getNight: () => night,
        isMusicOn: () => document.getElementById('g-music-btn')?.getAttribute('aria-pressed') === 'true',
        isVisible: () => driveActive,
        onEvent: text => toast(text, 2400),
        onAggro: () => toast('🛡️ 근위병: "감히 임금님께! 다음엔 정말 혼난다!"', 2400),   // 임금님을 쳐도 꾸중만
        bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
        gate: castle ? castle.villageGate(0) : null,   // 행차는 북쪽 성문으로 들어간다
        isKingBusy: () => !!(pageant && pageant.state().current === 'feast'),   // 연회 중엔 행차 없음 (임금님은 한 분)
      });
      /* 중세 축제: 마상 창시합·활쏘기 대회·수확 모닥불·메이폴·거리 광대·밤하늘 용 (festival.js) */
      festival = createFestival({
        THREE, scene, camera, npcs: n, GLTFLoader, dracoLoader: draco, pathX, groundY,
        getPlayerPos: () => activePos(),
        isOnFoot: () => player.mode === 'onfoot',
        getNight: () => night,
        getSeason: () => seasons.season,
        isMusicOn: () => document.getElementById('g-music-btn')?.getAttribute('aria-pressed') === 'true',
        isVisible: () => driveActive,
        onEvent: text => toast(text, 2600),
        getPlayerWeapon: () => (weapons ? weapons.current : 'none'),
        isBusy: () => !!(pageant && pageant.state().current),   // 연회·결혼식 등과 겹치지 않게
        bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
      });
      /* 왕실 연회·결혼식 행렬·하늘 등불·투석기 시연·줄다리기 (pageant.js) — 축제·행차와 겹치지 않는다 */
      pageant = createPageant({
        THREE, scene, camera, npcs: n, pathX, groundY,
        getPlayerPos: () => activePos(),
        isOnFoot: () => player.mode === 'onfoot',
        getNight: () => night,
        getSeason: () => seasons.season,
        isMusicOn: () => document.getElementById('g-music-btn')?.getAttribute('aria-pressed') === 'true',
        isVisible: () => driveActive,
        isBusy: () => !!(festival && festival.state().current),
        isKingBusy: () => !!(village && village.state().procession),
        onEvent: text => toast(text, 2600),
        getTavern: () => tavern, getKids: () => kids, castle,
        sitPlayer: s => (tavern ? tavern.sitAt(s) : false),   // 연회 자리에 실제로 앉는다 (선술집과 같은 자세·카메라)
        standPlayer: () => { if (tavern) tavern.standUp(); },
        bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
      });
    }).catch(e => console.warn('[npcs]', e));
  }

  /* ── 돌아다니는 동물 19마리: 판다·곰·사슴·여우·토끼·양·멧돼지·강아지·고양이 (animals.js) ── */
  {
    const { createAnimals } = await import('./animals.js');
    animals = createAnimals({
      obstacles: propObstacles,
      THREE, scene, GLTFLoader, dracoLoader: draco, groundY, pathX,
      bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
      roadHalf: WORLD.path.half, waterY: WORLD.stream.water,
      stalls: stations.map(s => ({ x: s.group.position.x, z: s.group.position.z })),
      getPlayerPos: () => activePos(), getNpcs: () => npcs,
      isOnFoot: () => player.mode === 'onfoot',
      isBlocked: () => !driveActive,
      onEvent: text => toast(text, 2200),
      getRide: () => rideInfo,   // 차로 치면 데굴데굴 (npcs 의 getRide 가 매 프레임 채운다)
    });
  }

  /* ── 아이들 7명: 술래잡기·오리 줄 따라오기·동물 쫓기·겨울 눈싸움, 밤엔 집으로 (kids.js). 맞지 않고 피한다 ── */
  {
    const { createKids } = await import('./kids.js');
    createKids({ THREE, scene, GLTFLoader, dracoLoader: draco, groundY, pathX, obstacles: propObstacles,
      bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
      stalls: stations.map(s => ({ x: s.group.position.x, z: s.group.position.z })),
      getPlayerPos: () => activePos(), isOnFoot: () => player.mode === 'onfoot',
      getNight: () => night, getSeason: () => seasons.season, getNpcs: () => npcs,
      getAnimals: () => animals, onEvent: text => toast(text, 2200),
    }).then(k => { kids = k; }).catch(e => console.warn('[kids]', e));
  }

  /* ── 반딧불 — 선술집 근처에 많이, 숲에는 드문드문 ── */
  const fireflies = (() => {
    const N = 150, pts = [];
    for (let i = 0; i < N; i++) {
      const st = stations[i % stations.length];
      const near = i < 96;
      const x = near ? st.pos[0] + (Math.random() - .5) * 9 : (Math.random() - .5) * 76;
      const z = near ? st.pos[1] + (Math.random() - .5) * 9 : (Math.random() - .5) * 76;
      pts.push({ x, z, y: 0.6 + Math.random() * 2.2, ph: Math.random() * 6.3, sp: 0.5 + Math.random() });
    }
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd98a).multiplyScalar(3), toneMapped: false, fog: false }), N);
    scene.add(mesh);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    return t => {
      pts.forEach((f, i) => {
        const blink = 0.55 + 0.45 * Math.sin(t * 3 * f.sp + f.ph);
        p.set(f.x + Math.sin(t * 0.4 * f.sp + f.ph) * 0.8, heightAt(f.x, f.z) + f.y + Math.sin(t * 0.9 + f.ph) * 0.3, f.z + Math.cos(t * 0.35 * f.sp + f.ph) * 0.8);
        m4.compose(p, q, sc.setScalar(blink));
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
  })();

  /* ── 알림 — 모든 모듈이 같은 알림 기둥(notify.js)을 쓴다 (겹치지 않게 위에서부터 쌓인다).
     기다리지 않고 불러오고, 불러오기 전에 온 알림은 모아 뒀다가 보여 준다 ── */
  let notifyFn = null;
  const pendingToasts = [];
  import('./notify.js').then(m => { notifyFn = m.notify; for (const [h, ms] of pendingToasts.splice(0)) notifyFn(h, { ms, kind: 'main' }); });
  const toast = (html, ms = 1600) => { if (notifyFn) notifyFn(html, { ms, kind: 'main' }); else pendingToasts.push([html, ms]); };
  /* ── 차 디테일: 헤드라이트, 흙먼지, 경적 ── */
  for (const sx of [-0.62, 0.62]) {
    const hl = new THREE.SpotLight(0xffe2b0, 12, 26, Math.PI / 7, 0.6, 1.6);
    hl.position.set(sx, 0.85, 2.0);
    hl.target.position.set(sx * 1.4, 0, 12);
    car.add(hl, hl.target);
    nightGlow.heads.push(hl);
  }
  const dust = (() => {
    const N = 70, mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 0),
      new THREE.MeshStandardMaterial({ color: 0xc89a6a, roughness: 1, transparent: true, opacity: .55, depthWrite: false }), N);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const P = Array.from({ length: N }, () => ({ life: 0 }));
    let next = 0, acc = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    return dt => {
      const fast = Math.abs(speed) > 5 && player.mode === 'driving';
      acc += fast ? dt * Math.abs(speed) * 1.4 : 0;
      while (acc > 1) {
        acc -= 1;
        const p = P[next]; next = (next + 1) % N;
        const back = -1.6 * Math.sign(speed), side = (Math.random() < .5 ? -1 : 1) * 0.8;
        const fx = Math.sin(heading), fz = Math.cos(heading);
        Object.assign(p, { life: 1, x: car.position.x + fx * back + fz * side, y: car.position.y + 0.2, z: car.position.z + fz * back - fx * side,
          vx: (Math.random() - .5) * 0.8, vy: 0.6 + Math.random() * 0.6, vz: (Math.random() - .5) * 0.8, s: 0.6 + Math.random() * 0.6 });
      }
      P.forEach((p, i) => {
        if (p.life > 0) { p.life -= dt * 1.2; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
        const k = Math.max(0, p.life);
        m4.compose(v.set(p.x || 0, p.y || -50, p.z || 0), q, sc.setScalar(k > 0 ? p.s * (1.6 - k) : 0.0001));
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
  })();
  let audio = null;
  function honk() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audio.currentTime, g = audio.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
      g.connect(audio.destination);
      for (const f of [415, 523]) { const o = audio.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + 0.45); }
    } catch { /* 소리를 못 내는 환경이면 조용히 넘어간다 */ }
  }

  /* ── 연락처 조형물 — 출발점 옆에 GitHub·메일·전화. 다가가서 Space를 누르면 열린다 (브루노 시몽 사이트에서 따왔다) ── */
  const RoundedBoxC = RoundedBoxGeometry;
  /* 클립보드에 복사하고 알림. 복사가 막힌 환경이면 값을 크게 보여줘서 직접 적을 수 있게 한다 */
  function copyText(text, msg) {
    const done = () => toast(`${msg}<div style="font:500 14px system-ui;opacity:.8;margin-top:4px">${text}</div>`, 2000);
    const fail = () => toast(text, 3000);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fail); else fail();
  }
  const CONTACTS = [
    { id: 'c-github', kind: 'link', name: 'GitHub', sub: 'github.com/aabyess', color: '#2b3137', glyph: 'GitHub', verb: '열기',
      act: () => window.open('https://github.com/aabyess', '_blank', 'noopener') },
    { id: 'c-mail', kind: 'link', name: '이메일', sub: 'maeguming0000@gmail.com', color: '#d94a38', glyph: '✉', verb: '주소 복사',
      act: () => copyText('maeguming0000@gmail.com', '메일 주소를 복사했어요') },
    { id: 'c-phone', kind: 'link', name: '전화', sub: '010-3322-7250', color: '#2a9d76', glyph: '☎', verb: '번호 복사',
      act: () => {
        if (document.body.classList.contains('is-touch')) { location.href = 'tel:01033227250'; return; }
        copyText('010-3322-7250', '전화번호를 복사했어요');
      } }
  ];
  const contacts = [];
  CONTACTS.forEach((c, i) => {
    const z = WORLD.start.z - 0.5 - i * 4.6, x = pathX(z) + 6.6 + i * 0.6;
    const g = new THREE.Group();
    g.position.set(x, Math.max(0, heightAt(x, z)), z);
    g.rotation.y = -0.75;                                       // 길과 출발점 쪽을 본다
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.5), new THREE.MeshStandardMaterial({ color: 0x4a2817, roughness: .9 }));
    ped.position.y = 0.35; ped.castShadow = ped.receiveShadow = true;
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const cx = cv.getContext('2d');
    cx.fillStyle = c.color; cx.fillRect(0, 0, 256, 256);
    cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.font = c.glyph.length > 2 ? '800 58px Pretendard, system-ui, sans-serif' : '150px system-ui, sans-serif';
    cx.fillText(c.glyph, 128, 136);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const side = new THREE.MeshPhysicalMaterial({ color: c.color, roughness: .35, clearcoat: .6 });
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: .4 });
    const icon = new THREE.Mesh(new RoundedBoxC(1.6, 1.6, 0.45, 4, 0.18), side);
    for (const sd of [1, -1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.36), face);
      pl.position.z = sd * 0.23; if (sd < 0) pl.rotation.y = Math.PI;
      icon.add(pl);
    }
    icon.position.y = 1.75; icon.castShadow = true;
    const label = labelSprite(c.name, c.sub, c.color);
    label.scale.multiplyScalar(0.3); label.position.y = 3.05;
    label.visible = false;   // 흰 이름표는 숨긴다. Space 안내 위치를 잡는 기준점으로만 쓴다
    g.add(ped, icon, label);
    scene.add(g);
    contacts.push({ ...c, pos: [x, z], group: g, icon, label, phase: i * 1.7 });
  });

  /* ── 조작 ── */
  const keys = Object.create(null);
  const KEYMAP = {
    ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'brake',
    ShiftLeft: 'boost', ShiftRight: 'boost'
  };
  const hint = document.getElementById('g-hint');
  let hintHidden = false;
  const hideHint = () => { if (!hintHidden) { hintHidden = true; hint.classList.add('hide'); } };

  addEventListener('keydown', e => {
    if (!driveActive) return;                 // 문서 뷰에서는 키를 가로채지 않는다
    /* 프로젝트 창이 떠 있으면 Space·Esc로 닫기만 하고 운전 입력은 받지 않는다 */
    if (panelOpen()) {
      if (e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); closePanel(); }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); galGo(e.code === 'ArrowLeft' ? -1 : 1); }
      return;
    }
    if (e.code === 'KeyM' && !e.repeat && minimap) { e.preventDefault(); minimap.toggleBig(); return; }   // 큰 지도
    if (e.code === 'KeyB' && !e.repeat && player.mode === 'onfoot') { e.preventDefault(); toggleDance(); return; }   // 춤
    /* 게시판 근처에서 Space는 브레이크가 아니라 "프로젝트 보기" */
    if (e.code === 'Space' && promptFor) { e.preventDefault(); activate(promptFor); hideHint(); return; }
    if (e.code === 'KeyR') { e.preventDefault(); restackBlocks(); return; }
    if (e.code === 'KeyH' && !e.repeat) { e.preventDefault(); honk(); return; }
    const k = KEYMAP[e.code];
    if (k) { keys[k] = true; e.preventDefault(); hideHint(); }
    if (e.code === 'KeyF') {   // F: 대화(dialogue.js 가 먼저 가로챈다) > 의뢰 게시판 > 낚시 > 탈것
      e.preventDefault();
      if (player.mode === 'onfoot' && quests && quests.onF()) { hideHint(); return; }
      if (player.mode === 'onfoot' && pageant && pageant.onF(e.repeat)) { hideHint(); return; }   // 연회 자리·소원 등불·투석기·줄다리기
      if (player.mode === 'onfoot' && shop && shop.onF()) { hideHint(); return; }
      if (player.mode === 'onfoot' && fishing && fishing.onF()) return;
      toggleVehicle(); hideHint();
    }
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
  let MAX_FWD = 10, MAX_REV = 5, ACCEL = 9, TURN = 1.9;   // 탈것을 바꾸면 vehicles.js의 params로 바뀐다
  const BRAKE = 30, DRAG = 6;
  let speed = 0, heading = Math.PI, steer = 0;
  const START_Z = WORLD.start.z;
  car.position.set(pathX(START_Z), 0, START_Z);

  function drive(dt) {
    const want = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    steer += (want - steer) * Math.min(1, dt * 9);

    const boost = keys.boost && player.mode === 'driving';
    if (keys.fwd) speed += ACCEL * (boost ? 1.7 : 1) * dt;
    else if (keys.back) speed -= ACCEL * dt;
    else {
      const d = DRAG * dt;
      speed = Math.abs(speed) <= d ? 0 : speed - Math.sign(speed) * d;
    }
    if (keys.brake) {
      const d = BRAKE * dt;
      speed = Math.abs(speed) <= d ? 0 : speed - Math.sign(speed) * d;
    }
    speed = Math.max(-MAX_REV, Math.min(boost ? MAX_FWD * 1.6 : MAX_FWD, speed));
    if (!boost && speed > MAX_FWD) speed = Math.max(MAX_FWD, speed - BRAKE * 0.5 * dt);

    const grip = Math.min(1, Math.abs(speed) / 5);
    heading += steer * TURN * dt * grip * Math.sign(speed || 1);

    car.position.x += Math.sin(heading) * speed * dt;
    car.position.z += Math.cos(heading) * speed * dt;

    if (clampToBounds(car.position)) speed *= 0.3;
    if (fishing && fishing.pushOut(car.position, 1.4)) speed *= 0.5;   // 연못에 빠지지 않게
    if (castle && castle.pushOut(car.position, 1.4)) speed *= 0.5;     // 성벽
    if (vprops.pushOut(car.position, 1.4)) speed *= 0.5;               // 오두막·우물
    if (shop && shop.pushOut(car.position, 1.4)) speed *= 0.5;
    car.position.y += (groundY(car.position.x, car.position.z) - car.position.y) * Math.min(1, dt * 12);
    car.rotation.order = 'YXZ';
    car.rotation.y = heading;
    /* 경사를 따라 앞뒤로 기운다 (언덕·다리) */
    {
      const fx = Math.sin(heading), fz = Math.cos(heading);
      const hf = groundY(car.position.x + fx * 1.4, car.position.z + fz * 1.4), hb = groundY(car.position.x - fx * 1.4, car.position.z - fz * 1.4);
      car.rotation.x += (-Math.atan2(hf - hb, 2.8) - car.rotation.x) * Math.min(1, dt * 10);
    }

    for (const w of parts.wheels) {
      if (w.front) w.steerNode.rotation.y = steer * 0.42;
      w.spinNode.rotation.x += speed * dt / w.r;
    }
    const tilt = -steer * grip * 0.055;
    /* 서스펜션 — 가속하면 뒤로 앉고, 브레이크면 앞으로 쏠린다 */
    accSm += (((speed - lastSpeed) / Math.max(dt, 1e-4)) - accSm) * Math.min(1, dt * 6);
    lastSpeed = speed;
    const pitch = Math.max(-0.07, Math.min(0.07, -accSm * 0.0045));
    for (const m of parts.tilt) { m.rotation.z = tilt; m.rotation.x = pitch; }
  }
  let accSm = 0, lastSpeed = 0;

  /* ── 도보 ──
     차에서 내려 뛰어다니는 모드. 방향키는 카메라 기준으로 해석하고
     캐릭터는 가려는 방향으로 부드럽게 돌아선다 (3인칭 게임의 일반적인 방식). */
  /* 기본은 걷고 Shift를 누르면 뛴다 */
  const WALK_SPEED = 4.2, RUN_SPEED = 9, RUN_ACCEL = 30, RUN_DRAG = 26, TURN_SNAP = 11;
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
      const top = (keys.boost ? RUN_SPEED : WALK_SPEED) * (shop ? shop.effects.speedMul() : 1);   // 바람 물약
      pSpeed = pSpeed > top ? Math.max(top, pSpeed - RUN_DRAG * dt) : Math.min(top, pSpeed + RUN_ACCEL * dt);
    } else {
      pSpeed = Math.max(0, pSpeed - RUN_DRAG * dt);
    }

    person.position.x += Math.sin(pHeading) * pSpeed * dt;
    person.position.z += Math.cos(pHeading) * pSpeed * dt;

    if (clampToBounds(person.position)) pSpeed = 0;
    if (fishing && fishing.pushOut(person.position, 0.35)) pSpeed *= 0.5;
    if (castle && castle.pushOut(person.position, 0.35)) pSpeed *= 0.5;
    if (vprops.pushOut(person.position, 0.35)) pSpeed *= 0.5;
    if (quests && quests.pushOut(person.position, 0.35)) pSpeed *= 0.5;
    if (shop && shop.pushOut(person.position, 0.35)) pSpeed *= 0.5;
    person.rotation.y = pHeading;

    /* 달리는 동안만 카메라가 진행 방향으로 따라 돈다 */
    if (pSpeed > 0.3) camYaw = angLerp(camYaw, pHeading, dt * 2.2);

    const moving = pSpeed / RUN_SPEED;
    if (charMixer) {
      /* 걸음·달리기 클립 속도를 실제 이동 속도에 맞춰 발이 미끄러지지 않게 한다 */
      const ps = pSpeed / (shop ? shop.effects.speedMul() : 1);   // 물약으로 빨라져도 걸음 클립은 원래 속도 기준
      playClip(ps < 0.3 ? 'idle' : ps < WALK_SPEED + 1 ? 'walk' : 'run');
      if (charAction) charAction.timeScale = ps < 0.3 ? 1 : ps < WALK_SPEED + 1 ? Math.max(0.5, ps / WALK_SPEED) : ps / RUN_SPEED * 1.1;
      charMixer.update(dt);
      person.position.y = groundY(person.position.x, person.position.z);
    } else {
      /* 기본 캐릭터는 팔다리를 직접 흔든다 */
      bob += dt * (4 + moving * 9);
      const swing = Math.sin(bob) * 0.85 * moving;
      limbs.legL.rotation.x = swing;
      limbs.legR.rotation.x = -swing;
      limbs.armL.rotation.x = -swing * 0.75;
      limbs.armR.rotation.x = swing * 0.75;
      if (punchT > 0) { punchT -= dt; limbs.armR.rotation.x = -1.55 * Math.sin(Math.PI * (1 - punchT / 0.3)); }   // 주먹 잽
      person.position.y = groundY(person.position.x, person.position.z) + Math.abs(Math.sin(bob)) * 0.06 * moving;
    }
  }

  /* glb 캐릭터용 — 같은 클립이면 다시 시작하지 않고 부드럽게 교차시킨다 */
  function playClip(name) {
    const clip = charClips[name] || charClips[name === 'run' ? 'walk' : name === 'walk' ? 'run' : 'idle'];
    if (!clip || !charMixer) return;
    if (charAction && charAction.getClip() === clip) return;
    const next = charMixer.clipAction(clip);
    next.reset().fadeIn(0.18).play();
    if (charAction) charAction.fadeOut(0.18);
    charAction = next;
  }

  /* ── 맨손 콤보 — 클릭할 때마다 왼손 잽 → 오른손 스트레이트 → 오른발 차기 → 드롭킥 ──
     앞 기술이 끝나고 0.6초 안에 다시 누르면 다음 기술로 이어진다. 달리면서(Shift) 누르면 바로 드롭킥.
     주먹은 상체 트랙만 떼어 걸음 위에 겹치고(다리는 계속 걷는다), 발차기·드롭킥은 그 자리에서 온몸으로 한다.
     첫 타격(휘청·넘어짐)은 npcs.js attachGrab 의 punch() 가 클릭 순간에 하고, 발차기·드롭킥은 발이 닿는 순간 더 세게 날린다.
     기본 박스 캐릭터는 오른팔을 직접 앞으로 뻗는다(walk 안에서 punchT로). */
  let punchT = 0;
  const UPPER = /^(Abdomen|Torso|Chest|Neck|Head|Shoulder|UpperArm|LowerArm|Wrist|Index|Middle|Ring|Pinky|Thumb)/;
  const MOVES = [
    { name: '왼손 잽',      clip: 'punch_left',  speed: 1.9, upper: true },
    { name: '오른손 스트레이트', clip: 'punch_right', speed: 1.8, upper: true },
    { name: '발차기',       clip: 'kick_right',  speed: 1.45, hitAt: 0.42, reach: 2.0, power: 6.5, up: 3, dmg: 40 },
    { name: '드롭킥',       clip: 'kick_right',  drop: true, dur: 1.15, hitAt: 0.3, reach: 2.4, power: 10, up: 4, dmg: 70 },
  ];
  const moveActs = {};
  const atk = { move: null, t: 0, dur: 0, hit: false, step: 0, win: 0, act: null, timer: 0 };
  const _imp = new THREE.Vector3();
  function moveAction(m) {
    const key = m.clip + (m.upper ? ':up' : ':full');
    if (moveActs[key]) return moveActs[key];
    const src = charClips[m.clip];
    if (!src) return null;
    const clip = src.clone();
    if (m.upper) clip.tracks = clip.tracks.filter(t => UPPER.test(t.name.split('.')[0]));
    const a = charMixer.clipAction(clip);
    a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
    return (moveActs[key] = a);
  }
  /* 발차기·드롭킥 중엔 걷기를 멈춘다. 기술 앞부분에선 다음 클릭을 받지 않는다(연타로 기술이 씹히지 않게) */
  const legMove = () => !!(atk.move && !atk.move.upper);
  const attackBusy = () => !!(atk.move && atk.t < atk.dur * (atk.move.drop ? 0.85 : 0.55));
  function playerPunch() {
    if (player.mode !== 'onfoot') return;
    if (!charMixer) { punchT = 0.3; return; }
    let i = atk.win > 0 ? atk.step : 0;
    if (pSpeed > WALK_SPEED + 0.8) i = 3;          // 달리다가 → 드롭킥
    const m = MOVES[i], a = moveAction(m);
    if (!a) return;
    atk.step = (i + 1) % MOVES.length;
    if (atk.act && atk.act !== a) atk.act.fadeOut(0.08);
    clearTimeout(atk.timer);
    a.stop().reset();
    a.timeScale = m.drop ? 1.6 : m.speed;
    a.weight = m.upper ? 3 : 8;                    // 주먹은 걸음 상체보다 강하게(3:1), 발차기는 거의 온몸
    a.fadeIn(0.06).play();
    atk.act = a; atk.move = m; atk.t = 0; atk.hit = false;
    atk.dur = m.drop ? m.dur : a.getClip().duration / m.speed;
    atk.win = atk.dur + 0.6;
    if (m.drop) { atk.dropH = pHeading; if (kids) kids.cheer(person.position); }   // 드롭킥엔 아이들이 환호
    if (!m.drop) atk.timer = setTimeout(() => a.fadeOut(0.12), Math.max(0, atk.dur - 0.12) * 1000);
    if (!m.upper) pSpeed = m.drop ? pSpeed : 0;
  }
  /* 발이 닿는 순간: 앞쪽 reach m 안 사람들을 세게 날린다 */
  function legHit(m) {
    if (!npcs) return;
    const fx = Math.sin(pHeading), fz = Math.cos(pHeading), px = person.position.x, pz = person.position.z;
    for (const o of npcs.list()) {
      const n = o.npc;
      if (o.off || o.state === 'HELD') continue;
      const dx = n.x - px, dz = n.z - pz, d = Math.hypot(dx, dz);
      if (!(d < m.reach) || d < 1e-3 || (dx * fx + dz * fz) / d < 0.3) continue;
      _imp.set((dx / d * 0.4 + fx * 0.6) * m.power, m.up, (dz / d * 0.4 + fz * 0.6) * m.power);
      npcs.knockDown(n, _imp, 'punch', m.dmg);   // 맷집을 깎는다 (다 닳으면 넘어진다)
    }
  }
  /* ── 춤 (B) — 4박자마다 동작이 바뀐다: 팔 흔들기 → 디스코 → 말춤 → 빙글 돌기. 움직이면 멈춘다.
     클립이 없어서 대기(idle) 위에 팔·몸통 뼈를 돌려 얹는다. 근처 손님들이 따라 추고 아이들이 환호한다 ── */
  const dance = { on: false, t: 0, h: 0, bones: null };
  /* 뼈 축이 뼈마다 달라서, 캐릭터 기준 방향(앞·왼쪽)으로 돌린다: 부모 좌표로 바꾼 축으로 회전을 앞에 곱한다 */
  const _dq = new THREE.Quaternion(), _dp = new THREE.Quaternion(), _dax = new THREE.Vector3();
  const _dFwd = new THREE.Vector3(), _dLeft = new THREE.Vector3();
  function rotWorld(bone, axis, ang) {
    if (!bone || !ang) return;
    bone.parent.getWorldQuaternion(_dp).invert();
    _dq.setFromAxisAngle(_dax.copy(axis).applyQuaternion(_dp), ang);
    bone.quaternion.premultiply(_dq);
    bone.updateMatrixWorld(true);
  }
  function danceBones() {
    if (dance.bones) return dance.bones;
    const b = n => person.getObjectByName(n);
    return (dance.bones = { ua: [b('UpperArmL'), b('UpperArmR')], la: [b('LowerArmL'), b('LowerArmR')], chest: b('Chest'), hips: b('Hips'), head: b('Head') });
  }
  function toggleDance(on = !dance.on) {
    if (on && (player.mode !== 'onfoot' || tavern.seated || fishing.active || (dialogue && dialogue.active))) return;
    dance.on = on; dance.t = 0; dance.h = pHeading;
    if (on) {
      pSpeed = 0;
      if (weapons) weapons.holster();
      if (npcs && npcs.danceAt) npcs.danceAt(person.position.x, person.position.z, 5, 22);
      if (kids) kids.cheer(person.position);
      toast('💃 춤판이 벌어졌어요! (움직이면 멈춰요)', 1800);
    } else person.rotation.y = pHeading;
  }
  function danceStep(dt) {
    if (!dance.on) return false;
    if (player.mode !== 'onfoot' || keys.fwd || keys.back || keys.left || keys.right) { toggleDance(false); return false; }
    dance.t += dt;
    const B = danceBones(), beat = dance.t * 2.2;                           // 약 132 BPM
    const s = Math.sin(beat * Math.PI), bounce = Math.abs(s), move = Math.floor(dance.t / 3.6) % 4;
    if (charMixer) { playClip('idle'); charMixer.update(dt); }
    let yaw = dance.h;
    const arm = (i, up, fore = 0, fwd = 0) => {                               // i: 0 왼팔 1 오른팔 / up: 옆으로 들기, fore: 팔꿈치 굽히기, fwd: 앞으로 뻗기
      rotWorld(B.ua[i], _dFwd, up * (i === 0 ? 1 : -1));
      rotWorld(B.ua[i], _dLeft, -fwd);
      rotWorld(B.la[i], _dLeft, -fore);
    };
    yaw += move === 0 ? s * 0.15 : move === 1 ? 0.3 : move === 2 ? Math.sin(beat * Math.PI * 0.5) * 0.25 : ((dance.t % 3.6) / 3.6) * Math.PI * 2;
    person.rotation.y = yaw;
    person.updateMatrixWorld(true);
    _dFwd.set(Math.sin(yaw), 0, Math.cos(yaw)); _dLeft.set(Math.cos(yaw), 0, -Math.sin(yaw));
    if (move === 0) {          // 팔 흔들기: 두 팔 번쩍, 좌우로 흔들
      arm(0, 2.6 + s * 0.3, 0.3); arm(1, 2.6 - s * 0.3, 0.3);
      rotWorld(B.chest, _dFwd, s * 0.12);
    } else if (move === 1) {   // 디스코: 오른손 하늘 찌르기 ↔ 허리에 왼손
      arm(1, s > 0 ? 2.7 : 0.5, 0.1); arm(0, 0.5, 1.6);
      rotWorld(B.hips, THREE.Object3D.DEFAULT_UP, s * 0.25);
    } else if (move === 2) {   // 말춤: 두 손 모아 앞으로, 통통 뛰기
      arm(0, 0.2, 1.2, 1.1); arm(1, 0.2, 1.2, 1.1);
      rotWorld(B.chest, _dLeft, 0.15);
    } else {                   // 빙글 돌기: 한 바퀴 돌며 팔 벌리기
      arm(0, 1.5, 0.2); arm(1, 1.5, 0.2);
    }
    rotWorld(B.head, _dFwd, Math.sin(beat * Math.PI * 0.5) * 0.12);
    person.position.y = groundY(person.position.x, person.position.z) + bounce * (move === 2 ? 0.14 : 0.06);
    return true;
  }
  if (new URLSearchParams(location.search).has('test')) window.__dance = { toggle: toggleDance, state: () => ({ ...dance, bones: undefined }), set t(v) { dance.t = v; } };

  function attackStep(dt) {
    if (atk.win > 0) atk.win -= dt;
    const m = atk.move;
    if (!m) return;
    atk.t += dt;
    const u = Math.min(1, atk.t / atk.dur);
    if (!m.upper && !atk.hit && u >= m.hitAt) { atk.hit = true; legHit(m); }
    if (m.drop) {
      /* 드롭킥: 뛰어올라 몸을 뒤로 눕히며 두 발로 차고, 등으로 떨어졌다가 일어난다 */
      const a = atk.act;
      if (a && a.time > a.getClip().duration * 0.45) a.paused = true;   // 다리를 뻗은 순간에서 멈춘다
      const air = THREE.MathUtils.clamp((u - 0.06) / 0.46, 0, 1);
      const lean = u < 0.22 ? u / 0.22 : u < 0.62 ? 1 : Math.max(0, 1 - (u - 0.62) / 0.33);
      if (air > 0 && air < 1) {
        person.position.x += Math.sin(atk.dropH) * 6.5 * dt;
        person.position.z += Math.cos(atk.dropH) * 6.5 * dt;
        clampToBounds(person.position);
        if (fishing) fishing.pushOut(person.position, 0.35);
      }
      person.rotation.order = 'YXZ';
      person.rotation.y = pHeading = atk.dropH;
      person.rotation.x = -1.3 * (lean * lean * (3 - 2 * lean));
      person.position.y = groundY(person.position.x, person.position.z) + Math.sin(Math.PI * air) * 0.8 + lean * 0.12;
      pSpeed = 0;
    }
    if (!m.upper) {
      charMixer.update(dt);   // walk() 를 건너뛰는 동안 애니메이션은 여기서 돌린다
      if (!m.drop) person.position.y = groundY(person.position.x, person.position.z);
    }
    if (atk.t >= atk.dur) {
      if (m.drop) { person.rotation.x = 0; if (atk.act) { atk.act.paused = false; atk.act.fadeOut(0.15); } }
      else if (!m.upper && atk.act) atk.act.fadeOut(0.15);
      atk.move = null;
    }
  }

  /* ── 승하차 ── */
  let ENTER_CAR_R = 5.5;   // 마차처럼 긴 탈것은 더 멀리서 탄다 (vehicles.js params)
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
      <span>${driving ? '운전' : '걷기'}</span>
      <div class="keys"><span class="key">Space</span></div><span>보기·열기</span>
      ${driving ? '<div class="keys"><span class="key">Shift</span></div><span>부스트</span><div class="keys"><span class="key">H</span></div><span>경적</span>' : '<div class="keys"><span class="key">Shift</span></div><span>달리기</span>'}
      <div class="keys"><span class="key">R</span></div><span>다시 쌓기</span>
      <div class="keys"><span class="key">F</span></div><span>${driving ? '내리기' : '타기'}</span>
      ${driving
        ? '<div class="keys"><span class="key">V</span></div><span>탈것 바꾸기</span><span>· 탱크는 클릭 포격</span>'
        : '<div class="keys"><span class="key">`</span></div><span>주먹</span><div class="keys"><span class="key">1~0 - =</span></div><span>무기</span><div class="keys"><span class="key">E</span></div><span>앉기</span><div class="keys"><span class="key">M</span></div><span>지도</span><div class="keys"><span class="key">B</span></div><span>춤</span><span>· 클릭 공격(연타 콤보) · 꾹 눌러 잡기</span>'}`;
  }
  updateHint();

  /* ── 패널 ── */
  const panel = document.getElementById('g-panel');
  const pnNo = panel.querySelector('.no');
  const pnBd = panel.querySelector('.bd');
  const foundL = document.getElementById('g-found-l');
  const foundN = document.getElementById('g-found-n');

  let current = null, promptFor = null, galGo = () => {};
  const visited = new Set();
  const dim = document.getElementById('g-dim');
  const prompt = document.getElementById('g-prompt');
  const promptName = prompt.querySelector('.nm');
  const promptVerb = prompt.querySelector('.space + span');
  const activate = p => { if (p.kind === 'link') p.act(); else openPanel(p); };
  const panelOpen = () => panel.classList.contains('open');

  function closePanel() {
    panel.classList.remove('open');
    dim.classList.remove('on');
    current = null;
  }
  panel.querySelector('.x').addEventListener('click', closePanel);
  dim.addEventListener('click', closePanel);
  prompt.addEventListener('click', () => { if (promptFor) activate(promptFor); });

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
    if (quests) quests.notify('project', p.id);
    panel.style.setProperty('--c', p.color);
    pnNo.textContent = p.no;
    pnBd.innerHTML = `
      ${galleryHTML(p)}
      <div class="meta"><span class="per">${p.period}</span><span class="role">${p.role}</span></div>
      <div class="n">${p.full}</div>
      <p class="one">${p.one}</p>
      ${listBlock('맡은 일', p.mine)}
      ${troubleBlock(p)}
      ${listBlock('보안 점검', p.security)}
      <div class="stk">${p.stack.map(s => `<span>${s}</span>`).join('')}</div>
      <div class="lk">${links(p)}</div>`;
    galGo = bindGallery(pnBd, p);
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
      if (d < ENTER_R && d < nearD) { nearD = d; near = s; }
    }
    /* 연락처 조형물은 더 가까이 가야 뜬다. 가판대보다 가까우면 조형물이 우선 */
    for (const c of contacts) {
      const d = Math.hypot(me.x - c.pos[0], me.z - c.pos[1]);
      if (d < 4.2 && d < nearD) { nearD = d; near = c; }
    }
    /* 자동으로 열지 않는다. 가까이 오면 위에 "Space" 안내만 띄운다 */
    promptFor = near;
    if (!promptFor || panelOpen()) { prompt.hidden = true; return; }
    if (prompt.hidden || prompt.dataset.id !== promptFor.id) {
      prompt.dataset.id = promptFor.id;
      prompt.style.setProperty('--c', promptFor.color);
      promptName.textContent = promptFor.name;
      promptVerb.textContent = promptFor.kind === 'link' ? promptFor.verb : '프로젝트 보기';
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

  /* ── 탈것 바꾸기 — 자동차 · 말 · 마차 · 오토바이 · 자전거 (vehicles.js) ──
     차 루트 안에서 겉모습만 갈아 끼우고, 속도·회전·카메라·충돌 상자 값만 여기로 넘겨받는다.
     위쪽 바의 버튼이나 V 키로 고른다. 모델은 처음 고를 때 내려받는다. */
  const { createVehicleSwitcher, mountVehicleButton, applyBodyShape } = await import('./vehicles.js');
  let weapons = null, tavern = null, dialogue = null, fishing = null;   // 아래에서 만든다. 탈것(탱크 폭발)·물리·잡기가 먼저 참조하므로 미리 선언
  const rides = await createVehicleSwitcher({
    THREE, GLTFLoader, dracoLoader: draco,
    carGroup: car, person, scene,
    personClips: () => charClips,
    /* 탱크: 마우스로 포탑 조준, 클릭으로 포격. 폭발은 무기 모듈의 것을 같이 쓴다 */
    camera, domElement: renderer.domElement, groundY,
    getNpcs: () => npcs, toyBlocks,
    isBlocked: () => !driveActive || panelOpen(),
    explode: (pos, r, f) => { if (weapons) weapons.explode(pos, r, f); if (events) events.notify('explosion', pos); if (animals) animals.hitAt(pos, r, f); },
    onChange(id, p) {
      MAX_FWD = p.maxFwd; MAX_REV = p.maxRev; ACCEL = p.accel; TURN = p.turn;
      ENTER_CAR_R = p.enterR;
      Object.assign(CAM.driving, p.cam);
      applyBodyShape(carBody, p);
      speed = Math.min(speed, p.maxFwd);
    }
  });
  mountVehicleButton({ container: document.getElementById('g-top'), switcher: rides });
  ridesRef = rides;   // 손님 충돌(getRide)이 지금 탈것 크기를 읽는다
  const rideIn = { speed: 0, steer: 0, moving: false, boosting: false, driving: true };   // 매 프레임 재사용

  /* ── 눈 위 발자국 · 바퀴 자국 (tracks.js) ──
     눈이 쌓였을 때만 찍히고 20초쯤 지나면 새 눈에 덮인다. 다리 위와 물 위에는 남기지 않는다 */
  const { createTracks } = await import('./tracks.js');
  const tracks = createTracks({
    THREE, scene, uSnow: seasons.uniforms.uSnow, groundY, heightAt,
    canMark: (x, z) => bridgeY(x, z) === null && heightAt(x, z) > WORLD.stream.water - 0.05
  });
  const trackIn = { mode: 'driving', ride: 'car', heading: 0, speed: 0, car: car.position, person: person.position };   // 매 프레임 재사용

  /* ── 선술집 — 빈 의자 옆에서 E로 앉고, 주문판에서 술을 시켜 마신다 (tavern.js) ── */
  {
    const { createTavern } = await import('./tavern.js');
    const { stallsFromStations } = await import('./npcs.js');
    tavern = createTavern({
      THREE, scene, camera, person,
      personClips: () => charClips,
      getNpcs: () => npcs,
      stalls: stallsFromStations(stations, { THREE, toyBlocks }),
      isBlocked: () => !driveActive || panelOpen() || !!(dialogue && dialogue.active) || !!(fishing && fishing.active) || !!(quests && quests.open) || !!(shop && shop.open),
      onSit() { pSpeed = 0; if (weapons) weapons.holster(); },
      onStand(h) { pHeading = camYaw = h; pSpeed = 0; },
    });
  }
  const tavernIn = { onFoot: false, keys: null };   // 매 프레임 재사용

  /* ── 연못 낚시 — 물가·선착장에서 "F 낚시하기", 겨울엔 얼음낚시 (fishing.js) ── */
  {
    const { createFishing } = await import('./fishing.js');
    fishing = createFishing({
      THREE, scene, camera, person, groundY,
      personClips: () => charClips,
      domElement: renderer.domElement,
      getSeason: () => seasons.season,
      isBlocked: () => !driveActive || panelOpen() || tavern.seated || !!(dialogue && dialogue.active),
      onStart() { pSpeed = 0; if (weapons) weapons.holster(); },
      onStop(h) { pHeading = camYaw = h; pSpeed = 0; },
    });
    if (new URLSearchParams(location.search).has('test')) window.__fishing = fishing;
  }
  const fishIn = { onFoot: false, keys: null };

  /* ── 무기 10종 — 걸을 때 1~9·0으로 고르고 클릭으로 공격 (weapons.js). 피 없이 넘어지기만 한다 ── */
  {
    const { createWeapons } = await import('./weapons.js');
    weapons = createWeapons({
      THREE, scene, camera, person, GLTFLoader, dracoLoader: draco,
      domElement: renderer.domElement,
      personClips: () => charClips,
      getNpcs: () => npcs,
      toyBlocks, groundY,
      colliders: () => festival ? [...stations.map(s => s.group), ...festival.colliders()] : stations.map(s => s.group),   // 활터 과녁에 화살이 꽂힌다
      isBlocked: () => !driveActive || panelOpen() || !!(dialogue && dialogue.active) || !!(quests && quests.open) || !!(shop && shop.open),
      onExplode: (p, r, f) => { if (animals) animals.hitAt(p, r, f); },   // 폭탄·바주카·박격포에 동물도 데굴데굴
      onNoise: (k, p) => { if (animals) animals.alarm(p); },              // 총소리에 동물이 도망
      canUse: () => player.mode === 'onfoot' && !tavern.seated && !(fishing && fishing.active),
    });
  }
  const weaponsIn = { onFoot: false };   // 매 프레임 재사용

  /* ── 마을 사람과 대화 — 가까이 가면 "F 대화하기", 동물의 숲처럼 아래 말풍선 (dialogue.js) ── */
  {
    const { createDialogue } = await import('./dialogue.js');
    dialogue = createDialogue({
      THREE, camera, person,
      getNpcs: () => npcs,
      isOnFoot: () => player.mode === 'onfoot' && !tavern.seated && !fishing.active,
      isBlocked: () => !driveActive || panelOpen() || !!(quests && quests.open) || !!(shop && shop.open) || !!(minimap && minimap.bigOpen),
      onStart() { for (const k in keys) keys[k] = false; pSpeed = 0; if (weapons) weapons.holster(); },
      faceTo(h) { pHeading = h; pSpeed = 0; },
      onEnd() { camYaw = pHeading; },
      getSeason: () => seasons.season,   // 계절·밤 전용 대사
      getNight: () => night,
    });
  }

  /* ── 의뢰 게시판과 퀘스트 11종 (quests.js) — 출발점 왼쪽 길가. 보상 은화는 선술집 지갑으로 ── */
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
      castleGate: castle,
      onOpen() { for (const k in keys) keys[k] = false; pSpeed = 0; speed = 0; if (weapons) weapons.holster(); },
    });
  }

  /* ── 약초 마녀의 물약 가게(동쪽 숲 21,-24)와 떠돌이 상인 마차 — 물약·모자·망토 염색·애완 오리 (shop.js) ── */
  shop = createShop({
    THREE, scene, camera, person, GLTFLoader, dracoLoader: draco, groundY, pathX,
    getPlayerPos: () => activePos(),
    isOnFoot: () => player.mode === 'onfoot',
    isBlocked: () => !driveActive || panelOpen() || !!(dialogue && dialogue.active) || !!(fishing && fishing.active) || tavern.seated || !!(quests && quests.open),
    getTavern: () => tavern, getQuests: () => quests, getNpcs: () => npcs, getEvents: () => events,
    blocks: (x, z, r) => vprops.blocks(x, z, r),
    onOpen() { for (const k in keys) keys[k] = false; pSpeed = 0; speed = 0; if (weapons) weapons.holster(); },
  });

  /* ── 미니맵(오른쪽 위, 클릭 = 북쪽 고정) + M 큰 지도 — 행사·퀘스트·상인 표시 (minimap.js) ── */
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
      castle, vprops,
      getFestival: () => festival, getPageant: () => pageant, getShop: () => shop,
      getQuests: () => quests, getVillage: () => village,
      getNpcs: () => npcs, getAnimals: () => animals,
      isActive: () => driveActive,
    });
  }

  /* ── 배경 소리: 바람·낙엽·개울·선술집 웅성거림·새·귀뚜라미·부엉이·개구리·발소리 (audio.js, 전부 합성음) ── */
  const { createAudio } = await import('./audio.js');
  const ambience = createAudio({
    getPlayerPos: () => activePos(),
    getCamera: () => camera,
    getNight: () => night,
    getSeason: () => seasons.season,
    isMusicOn: () => document.getElementById('g-music-btn')?.getAttribute('aria-pressed') === 'true',
    isVisible: () => driveActive,
    getNpcs: () => npcs,
    getStalls: () => stations.map(s => s.group.position),
    isMoving: () => (player.mode === 'onfoot'
      ? { speed: (tavern.seated || fishing.active) ? 0 : pSpeed, mode: 'onfoot' }
      : { speed: Math.abs(speed), mode: rides.current }),
    onFoot: () => player.mode === 'onfoot',
    pathX, roadHalf: WORLD.path.half, bridge: WORLD.bridge, stream: WORLD.stream,
  });

  /* 오른쪽 마우스를 누르고 있는 동안 어깨 너머로 살짝 줌 (떼면 돌아온다) */
  let zoomHeld = false, zoomK = 0;
  const baseFov = camera.fov;
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
  renderer.domElement.addEventListener('pointerdown', e => { if (e.button === 2 && driveActive) zoomHeld = true; });
  window.addEventListener('pointerup', e => { if (e.button === 2) zoomHeld = false; });
  window.addEventListener('blur', () => { zoomHeld = false; });

  function updateCamera(dt) {
    const onFoot = player.mode === 'onfoot';
    const c = onFoot ? CAM.onfoot : CAM.driving;
    const p = onFoot ? person.position : car.position;
    const h = onFoot ? camYaw : heading;
    const k = 1 - Math.pow(c.ease, dt);
    zoomK += ((zoomHeld ? 1 : 0) - zoomK) * Math.min(1, dt * 9);
    const fov = baseFov - 14 * zoomK;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const back = c.back * (1 - 0.45 * zoomK), side = (onFoot ? 0.75 : 0) * zoomK;   // 오른쪽 어깨 너머 = (-cos h, sin h)

    camTarget.set(p.x - Math.sin(h) * back - Math.cos(h) * side, p.y + c.up * (1 - 0.3 * zoomK), p.z - Math.cos(h) * back + Math.sin(h) * side);
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
    else if (!tavern.seated && !fishing.active) {
      if (dialogue.active) keys.fwd = keys.back = keys.left = keys.right = keys.boost = false;
      if (!danceStep(dt) && !legMove()) walk(dt);   // 춤·발차기·드롭킥 중엔 제자리 (애니메이션은 각자 돌린다)
    }   // 의자에 앉아 있거나 낚시 중이면 걷기를 멈춘다
    attackStep(dt);
    tavernIn.onFoot = player.mode === 'onfoot'; tavernIn.keys = keys;
    tavern.update(dt, tavernIn);
    fishIn.onFoot = player.mode === 'onfoot'; fishIn.keys = keys;
    fishing.update(dt, fishIn);
    rideIn.speed = speed; rideIn.steer = steer; rideIn.boosting = !!keys.boost;
    rideIn.moving = !!(keys.fwd || keys.back); rideIn.driving = player.mode === 'driving';
    rides.update(dt, rideIn);   // 말 걸음·바퀴·핸들·탄 사람 자세
    physicsStep(dt);
    {
      /* 차 바퀴 자리와 차체, 걷는 사람 발 아래를 눕힌다 */
      const stamps = [];
      if (Math.abs(speed) > 0.3 || player.mode === 'driving') {
        const fx = Math.sin(heading), fz = Math.cos(heading);
        for (const [f, sd] of [[1.3, 0.85], [1.3, -0.85], [-1.3, 0.85], [-1.3, -0.85]])
          stamps.push([car.position.x + fx * f + fz * sd, car.position.z + fz * f - fx * sd, 0.9]);
      }
      if (person.visible) stamps.push([person.position.x, person.position.z, 0.7]);
      updateTrail(dt, stamps);
    }
    timeU.value = t;
    updateDayNight(dt);   // 하루 (sky.js)
    seasons.update(dt, activePos());   // 계절 — 낮밤 색 위에 덧칠하므로 updateDayNight 다음
    fireflies(t);
    for (const c of contacts) { c.icon.position.y = 1.75 + Math.sin(t * 1.4 + c.phase) * 0.12; c.icon.rotation.y = Math.sin(t * 0.6 + c.phase) * 0.35; }
    dust(dt);
    fallingLeaves(dt, t, activePos().x, activePos().z);
    followSun(activePos().x, activePos().z);
    tavern.cameraStep(camera, dt, d => dialogue.cameraStep(camera, d, d2 => fishing.cameraStep(camera, d2, updateCamera)));   // 앉으면 어깨 너머 카메라, 취하면 살짝 흔들림
    weaponsIn.onFoot = player.mode === 'onfoot';
    weapons.update(dt, weaponsIn);                 // 무기 자세·투사체·효과·카메라 흔들림 (카메라 갱신 다음)
    if (shop) shop.update(dt, t);                  // 물약 효과(크기·투명·카메라) — 카메라 갱신 다음
    proximity();
    if (npcs) npcs.update(dt, t);
    if (events) events.update(dt, t);
    if (village) village.update(dt, t);
    if (festival) festival.update(dt, t);
    if (pageant) pageant.update(dt, t);
    ambience.update(dt, t);
    if (castle) castle.update(dt, t);
    vprops.update(dt, t);
    if (animals) animals.update(dt, t);
    if (quests) quests.update(dt, t);
    if (kids) kids.update(dt, t);
    if (minimap) minimap.update(dt);
    bridge.setLampGlow(night);
    if (dialogue) dialogue.update(dt);   // npcs.update 다음 (말 상대를 세워 둔다)
    {
      const busy = !!((dialogue && dialogue.active) || (fishing && fishing.active) || (shop && shop.open));   // 대화·낚시 중엔 단축 바·안내를 숨긴다
      if (document.body.classList.contains('talking') !== busy) document.body.classList.toggle('talking', busy);
    }
    trackIn.mode = player.mode; trackIn.ride = rides.current; trackIn.heading = heading; trackIn.speed = speed;
    tracks.update(dt, trackIn, npcs && npcs.npcs);   // 눈 위 자국 — 사람·탈것·마을 사람

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
      if (s.crystal) { s.crystal.rotation.y = t * 0.9; s.crystal.position.y = s.labelY - 2.5 + Math.sin(t * 1.6) * 0.3; }
    }
  }

  /* ── 그래픽 (graphics.js) — 빛 번짐·색 보정·땅안개·물·햇살 줄기, 화질 자동 조절 (음악 버튼 옆 "화질") ── */
  const { createGraphics } = await import('./graphics.js');
  const gfx = await createGraphics({ THREE, renderer, scene, camera, sun, hemi, sky, getPlayerPos: () => activePos(),
    getNight: () => night, getSeason: () => seasons.season });

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);   // 탭 복귀 시 delta 폭주 방지
    if (!driveActive) return;                      // 문서 뷰일 땐 그리지 않는다
    step(dt);
    gfx.render(dt);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    gfx.setSize(innerWidth, innerHeight);
  });

  /* ── 로딩 ── */
  const bar = load.querySelector('.bar i'), pctEl = load.querySelector('.p');
  manager.onProgress = (url, done, total) => {
    const v = Math.round(done / total * 100);
    bar.style.width = v + '%'; pctEl.textContent = v + '%';
  };
  let started = false;
  performance.mark('drive-built');   // 로딩 시간 재기: 월드 구성 끝 (콘솔 performance.getEntriesByType('mark'))
  function start() {
    if (started) return;
    started = true;
    performance.mark('world-ready');   // 로딩 화면이 걷히고 첫 프레임
    bar.style.width = '100%'; pctEl.textContent = '100%';
    setTimeout(() => load.classList.add('done'), 260);
    loop();
  }
  manager.onLoad = start;
  if (mgrPending === 0) start();   // 이미 다 받았으면 기다리지 않는다 (예전엔 여기서 4초를 헛기다렸다)
  setTimeout(start, 4000);         // 이미지가 안 와도 월드는 띄운다

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
music = createMusic();
setView(viewFromHash(), { updateHash: false });
