/* ════════════════════════════════════════════════════════════
   최상호 포트폴리오 — 게임 뷰 / 문서 뷰 공용 스크립트

   프로젝트 내용은 아래 PROJECTS 한 곳에만 적는다.
   문서 카드도, 3D 게시판과 상세 패널도 전부 여기서 그려진다.
   ════════════════════════════════════════════════════════════ */

/* 프로젝트 데이터
   one   : 어떤 프로젝트인지 (2~3줄)
   mine  : 내가 맡은 일
   pts   : 해결한 문제 (핵심만)
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
      '<b>스팟 혼잡도 지도</b>: Kakao Maps로 부산 16개 구 지도를 만들고 원형 마커를 실제 행정구역 경계 폴리곤으로 바꿨습니다. 구를 누르면 붐비는 곳 TOP 5와 여유 스팟 패널을 거쳐 상세 모달까지 이어지고, 혼잡도 색은 그날 부산 안에서 비교한 초록~빨강으로 표시합니다. 목록에서 장소를 고르면 지도가 그곳으로 이동하며 마커가 흔들립니다.',
      '<b>코스 만들기와 편집</b>: AI가 만든 코스를 순서 변경·제외·드래그 정렬·예산 게이지로 다듬는 편집 흐름, 폼으로 코스를 만드는 API 연동과 장소·행사 검색, 생성 중 진행률 링·단계 체크리스트 화면을 만들었습니다. 링크 공유와 홈 인기 코스 올리기를 나누고, 공유된 코스 전체보기와 검색도 붙였습니다.',
      '<b>온나 채팅</b>: iMessage처럼 다듬은 채팅 모달이 누른 버튼 자리에서 커져 나오게 했고, 홈 히어로를 채팅 우선 구조로 바꿨습니다.',
      '<b>한끗 커뮤니티</b>: 사진 히어로·포스터 핫이슈로 페이지를 개편하고, 글쓰기·마이페이지 화면과 행사 상세(포스터 히어로·요금표·오시는 길)를 만들었습니다. 실제 행사·관광지 정보로 큐레이션 글 11개를 써서 모든 동네를 채웠습니다.',
      '<b>통합 검색</b>: 지역명·카테고리·무료 여부·초성까지 알아듣고, 검색·필터 결과에 맞춰 지도 범위가 자동으로 맞춰지게 했습니다.',
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
    stack: ['Next.js 15', 'TypeScript', 'Tailwind CSS v4', 'TanStack Query', 'Zustand', 'Kakao Maps SDK', 'Three.js', 'Motion', 'Vitest'],
    img: 'images/nolleo-onna.png',
    gallery: [
      { src: 'images/nolleo-onna.png', cap: '홈 — AI 여행 메이트 온나에게 코스 물어보기' },
      { src: 'images/nolleo-spot.jpg', cap: '스팟 — 부산 16개 구 혼잡도 지도와 3,632곳 스팟 목록' },
      { src: 'images/nolleo-course.jpg', cap: '코스 — 내가 만든 코스 모아보기' },
      { src: 'images/nolleo-hankkut.jpg', cap: '한끗 — 동네별 꿀팁·후기 커뮤니티' }
    ],
    live: 'https://www.nolleo-onna.site/', repo: 'https://github.com/nolleo-onna/nolleo-onna-frontend',
    pos: [-17, -16]
  },
  {
    id: 'trade', no: '02', color: '#e8734a',
    name: 'Trade-Cmarket',
    full: 'Trade-Cmarket — 한국·인도네시아 B2B 무역 견적·계약 플랫폼',
    period: '2026.07 — 2026.08', role: '인턴 · 1인 개발',
    one: '인도네시아 발주기관(바이어)이 견적을 요청하면 한국 공급기업(셀러)이 견적을 보내고, <b>낙찰·계약·입금 확인·수령 확인·실시간 채팅</b>까지 한곳에서 진행하는 B2B 조달 플랫폼(MitraPay)입니다. 사무용품·연구장비·산업기계·화학약품을 다루고, 한국어·인도네시아어·영어로 화면뿐 아니라 사용자가 쓴 글까지 자동 번역합니다. Vercel과 Supabase(싱가포르)로 배포했습니다.',
    mine: [
      '인턴 기간 동안 <b>기획·설계·구현을 1인으로</b> 맡아, 바이어와 셀러 양쪽 화면과 API, DB를 모두 만들었습니다.',
      '<b>거래 흐름 전체</b>: 견적 요청 → 견적 제출 → 낙찰 → 계약 → 수령 확인·영수증 업로드까지 상태가 이어지는 구조를 설계하고, Supabase Realtime으로 실시간 채팅과 알림을 붙였습니다.',
      '<b>다국어</b>: next-intl로 UI를 3개 국어로 만들고, 사용자 콘텐츠는 원문·감지 언어·번역본(jsonb)을 함께 저장해 번역 생성은 서버(DeepL)에서만 하도록 필드 단위 번역 파이프라인을 설계했습니다.',
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
    stack: ['Next.js 15', 'React 19', 'TypeScript', 'Supabase', 'TanStack Query', 'Zustand', 'next-intl', 'DeepL API', 'Gemini API', 'Vercel'],
    img: 'images/trade-cmarket.png',
    gallery: [
      { src: 'images/trade-cmarket.png', cap: 'MitraPay 대시보드' },
      { src: 'images/trade-dashboard.jpg', cap: '바이어 대시보드 — 거래 요약과 할 일' },
      { src: 'images/trade-quote.jpg', cap: '견적요청 등록 — 템플릿과 AI 초안 작성' },
      { src: 'images/trade-contract.jpg', cap: '계약 관리 — 수령 확인·영수증 업로드' }
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
    img: 'images/reboot.png',
    gallery: [
      { src: 'images/reboot.png', cap: 'RE:BOOT 메인' },
      { src: 'images/reboot-connect.jpg', cap: '커넥트(자유게시판) — 직접 맡은 영역' },
      { src: 'images/reboot-meetup.jpg', cap: '모임 찾기 — 카테고리·지역·날짜 필터' }
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
    img: 'images/interview.png',
    gallery: [
      { video: 'images/interview.mp4', poster: 'images/interview.png', cap: '이력서 업로드부터 질문 생성·피드백까지 시연' },
      { src: 'images/interview.png', cap: '맞춤 면접 질문 화면' }
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
    img: 'images/ignis.png',
    gallery: [
      { src: 'images/ignis.png', cap: 'IGNIS 메인' },
      { src: 'images/ignis_home.png', cap: '홈 — 기부·펀딩·봉사 통합 조회' }
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
          ${listBlock('맡은 일', p.mine, 'pts', VISIBLE_PTS)}
          ${listBlock('해결한 문제', p.pts, 'pts', VISIBLE_PTS)}
          <div class="stk">${p.stack.map(s => `<span>${s}</span>`).join('')}</div>
          <div class="lk">${links(p)}</div>
        </div>
        <div class="pj-shot">${galleryHTML(p)}</div>
      </div>
    </article>`).join('');

  document.getElementById('d-pg').innerHTML = PLAY.map(p => `
    <div class="pgc">
      <div class="pgc-t"><div class="pgc-i">${p.icon}</div><div class="pgc-s ${p.on ? 'on' : ''}">${p.status}</div></div>
      <div class="pgc-n">${p.name}</div>
      <p class="pgc-d">${p.desc}</p>
      <div class="stk">${p.stack.map(s => `<span>${s}</span>`).join('')}</div>
    </div>`).join('');

  PROJECTS.forEach(p => bindGallery(document.getElementById('d-projects'), p));

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
  renderer.toneMappingExposure = 1.1;
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

  /* ── 하늘 · 안개 · 시간 흐름 ──
     약 2분 30초에 한 바퀴: 저녁 → 깊은 밤 → 다시 저녁. night(0~1)에 맞춰 하늘·안개·빛을 섞는다. */
  scene.fog = new THREE.Fog(0x2a1a33, 26, 100);
  const C = h => new THREE.Color(h);
  const DUSK  = { top: C(0x0e0a22), mid: C(0x4f2546), hor: C(0xe0844a), fog: C(0x2a1a33), hemi: 0.7,  sun: 1.35, fill: 0.45, exp: 1.1 };
  const NIGHT = { top: C(0x03040e), mid: C(0x0c1430), hor: C(0x2a2048), fog: C(0x0b0d1c), hemi: 0.32, sun: 0.0,  fill: 0.6,  exp: 1.0 };
  const skyU = { top: { value: DUSK.top.clone() }, mid: { value: DUSK.mid.clone() }, hor: { value: DUSK.hor.clone() } };
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP;
      void main(){ float h = clamp(vP.y, 0.0, 1.0);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.6, h));
        gl_FragColor = vec4(c, 1.0); }`
  })));
  /* 밤에만 보이는 별 */
  const stars = (() => {
    const N = 900, a = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(0.15 + Math.random() * 0.85);
      a.set([Math.sin(ph) * Math.cos(th) * 300, Math.cos(ph) * 300, Math.sin(ph) * Math.sin(th) * 300], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const m = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    scene.add(new THREE.Points(g, m));
    return m;
  })();

  /* ── 조명 ── */
  const hemi = new THREE.HemisphereLight(0xffb48a, 0x1a1030, DUSK.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9050, DUSK.sun);   // 지평선에 걸린 마지막 햇빛
  sun.position.set(-40, 16, 34);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 160 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7088ff, DUSK.fill);   // 푸른 달빛
  fill.position.set(40, 20, -30);
  scene.add(fill);

  /* 선술집 불빛과 차 헤드라이트는 밤이 깊을수록 밝아진다 (아래에서 채운다) */
  const nightGlow = { lights: [], lanterns: [], bulbs: [], heads: [] };
  const DAY_PERIOD = 150;
  let night = 0;
  function updateDayNight(t) {
    night = 0.5 - 0.5 * Math.cos(t / DAY_PERIOD * Math.PI * 2);
    const k = night;
    skyU.top.value.copy(DUSK.top).lerp(NIGHT.top, k);
    skyU.mid.value.copy(DUSK.mid).lerp(NIGHT.mid, k);
    skyU.hor.value.copy(DUSK.hor).lerp(NIGHT.hor, k);
    scene.fog.color.copy(DUSK.fog).lerp(NIGHT.fog, k);
    hemi.intensity = DUSK.hemi + (NIGHT.hemi - DUSK.hemi) * k;
    sun.intensity = DUSK.sun + (NIGHT.sun - DUSK.sun) * k;
    fill.intensity = DUSK.fill + (NIGHT.fill - DUSK.fill) * k;
    renderer.toneMappingExposure = DUSK.exp + (NIGHT.exp - DUSK.exp) * k;
    stars.opacity = Math.max(0, (k - 0.35) / 0.65) * 0.9;
    for (const l of nightGlow.lights) l.intensity = 12 + 14 * k;
    for (const m of nightGlow.lanterns) m.emissiveIntensity = 1.1 + 1.0 * k;
    for (const m of nightGlow.bulbs) m.color.setHex(0xffd98a).multiplyScalar(1.1 + 0.9 * k);
    for (const h of nightGlow.heads) h.intensity = 30 + 120 * k;
  }

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
  /* 월드 glb는 Draco로 압축돼 있다(7.9MB → 1.1MB). 디코더는 three와 같은 버전의 CDN에서 받는다 */
  const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
  const worldLoader = new GLTFLoader(worldManager);
  worldLoader.setDRACOLoader(draco);
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
    scene.add(gltf.scene);
  });

  /* ── 풀 — 브루노 시몽 숲처럼 짧고 뾰족한 풀을 촘촘히 ──
     차나 사람이 지나간 자리는 눕고, 몇 초에 걸쳐 다시 일어난다.
     밟힌 정도는 월드를 덮는 128×128 텍스처(trail)에 적고 셰이더가 읽는다. */
  const TRAIL_N = 128;
  const trailData = new Uint8Array(TRAIL_N * TRAIL_N * 4);
  const trailTex = new THREE.DataTexture(trailData, TRAIL_N, TRAIL_N, THREE.RGBAFormat);
  trailTex.magFilter = trailTex.minFilter = THREE.LinearFilter;
  trailTex.needsUpdate = true;
  const trailCells = (x, z) => [Math.round((x + GRID.half) / (GRID.half * 2) * (TRAIL_N - 1)), Math.round((z + GRID.half) / (GRID.half * 2) * (TRAIL_N - 1))];
  let trailAcc = 0;
  /* 매 프레임: 전체를 조금씩 회복시키고(다시 자람), 지나가는 자리를 눕힌다 */
  function updateTrail(dt, stamps) {
    trailAcc += dt * 46;                   // 1초에 46만큼 회복 → 꽉 눌린 풀이 약 5.5초면 다시 선다
    const dec = Math.floor(trailAcc); trailAcc -= dec;
    if (dec) for (let i = 0; i < trailData.length; i += 4) { const v = trailData[i]; if (v) trailData[i] = v > dec ? v - dec : 0; }
    for (const [x, z, r] of stamps) {
      const [cx, cz] = trailCells(x, z), rc = Math.ceil(r / (GRID.half * 2) * TRAIL_N);
      for (let j = cz - rc; j <= cz + rc; j++) for (let i = cx - rc; i <= cx + rc; i++) {
        if (i < 0 || j < 0 || i >= TRAIL_N || j >= TRAIL_N) continue;
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
      sh.uniforms.uHalf = { value: GRID.half };
      sh.vertexShader = 'uniform float uTime; uniform sampler2D uTrail; uniform float uHalf;\nvarying float vH; varying float vPatch; varying float vPress;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 gw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vH = clamp(position.y / ${H.toFixed(2)}, 0.0, 1.0);
        /* 위치별 얼룩 — 큰 사인 무늬 두 개를 겹쳐 색이 은은하게 달라지게 */
        vPatch = 0.5 + 0.25 * sin(gw.x * 0.21 + sin(gw.z * 0.17) * 2.0) + 0.25 * sin(gw.z * 0.13 - gw.x * 0.07);
        float press = texture2D(uTrail, (gw.xz + uHalf) / (uHalf * 2.0)).r;
        vPress = press;
        transformed.y *= 1.0 - press * 0.82;                       // 밟히면 눕는다
        float gs = sin(uTime*1.7 + gw.x*0.33 + gw.z*0.27)*0.55 + sin(uTime*2.9 + gw.x*0.8 - gw.z*0.45)*0.2 + 0.3;
        float bw = vH * vH * (1.0 - press);
        transformed.x += gs * bw * 0.22; transformed.z += gs * bw * 0.09;`);
      sh.fragmentShader = 'varying float vH; varying float vPatch; varying float vPress;\n' + sh.fragmentShader.replace('#include <color_fragment>',
        `#include <color_fragment>
        vec3 dry = vec3(0.86, 0.55, 0.22), lush = vec3(0.62, 0.52, 0.18);
        diffuseColor.rgb *= mix(dry, lush, vPatch) * 1.35;
        diffuseColor.rgb *= mix(0.38, 1.12, vH) * (1.0 - vPress * 0.1);`);
    };
    const spots = [];
    const n = GRID.n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (GRID.mask[j * n + i] < 0.6) continue;
      const cnt = 3 + (Math.random() < 0.5 ? 1 : 0);
      for (let k = 0; k < cnt; k++) spots.push([-GRID.half + (i + Math.random() - .5) * GRID.step, GRID.half - (j + Math.random() - .5) * GRID.step]);
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
    const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd98a).multiplyScalar(1.1), fog: false, toneMapped: false });
    nightGlow.bulbs.push(bulbMat);
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
    const glow = new THREE.PointLight(0xff9a4a, 12, 20, 2);
    nightGlow.lights.push(glow);
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


    /* ── 선술집 꾸밈 ── 빨간 등롱, 酒 깃발, 항아리. 의자·테이블은 물리 몸체라 아래에서 따로 놓는다 */
    {
      const lanternMat = new THREE.MeshStandardMaterial({ color: 0xc8261c, emissive: 0xff4a1e, emissiveIntensity: 1.1, roughness: .6 });
      nightGlow.lanterns.push(lanternMat);
      const capMat = new THREE.MeshStandardMaterial({ color: 0x1b1210, roughness: .8 });
      for (const x of [-2.6, 0, 2.6]) {
        add(new THREE.CylinderGeometry(0.34, 0.34, 0.62, 14), lanternMat, x, 3.25, 2.05).castShadow = false;
        add(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), capMat, x, 3.6, 2.05);
        add(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), capMat, x, 2.9, 2.05);
        add(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4), capMat, x, 3.87, 2.05);
      }
      /* 酒 깃발 — 수레 옆 장대 */
      add(new THREE.BoxGeometry(0.14, 5.2, 0.14), woodDark, -4.7, 2.6, 1.0);
      const fcv = document.createElement('canvas'); fcv.width = 128; fcv.height = 256;
      const fc = fcv.getContext('2d');
      fc.fillStyle = '#f3e7d0'; fc.fillRect(0, 0, 128, 256);
      fc.fillStyle = '#b3241a'; fc.fillRect(0, 0, 128, 14); fc.fillRect(0, 242, 128, 14);
      fc.fillStyle = '#1d1512'; fc.font = '900 92px serif'; fc.textAlign = 'center'; fc.textBaseline = 'middle';
      fc.fillText('酒', 64, 128);
      const ftex = new THREE.CanvasTexture(fcv); ftex.colorSpace = THREE.SRGBColorSpace;
      const flag = add(new THREE.PlaneGeometry(1.0, 2.0), new THREE.MeshStandardMaterial({ map: ftex, side: THREE.DoubleSide, roughness: .9 }), -4.15, 4.0, 1.0);
      flag.userData.flag = true;
      /* 막걸리 항아리 */
      const jarPts = [[0, 0], [0.42, 0.04], [0.62, 0.45], [0.58, 0.85], [0.36, 1.1], [0.38, 1.18], [0, 1.18]].map(([r, y]) => new THREE.Vector2(r, y));
      const jarMat = new THREE.MeshStandardMaterial({ color: 0x5a2e1a, roughness: .35 });
      add(new THREE.LatheGeometry(jarPts, 16), jarMat, 4.4, 0, -0.6);
      add(new THREE.LatheGeometry(jarPts, 16), jarMat, 5.1, 0, 0.2).scale.setScalar(0.7);
      /* 상판 위 술병과 사발 */
      const bottle = new THREE.MeshStandardMaterial({ color: 0x2f9a58, emissive: 0x1f6a3a, emissiveIntensity: .5, roughness: .15, transparent: true, opacity: .9 });
      const bowl = new THREE.MeshStandardMaterial({ color: 0xf1e6cf, roughness: .5 });
      for (const [x, z] of [[0.6, 0.3], [1.0, 0.6], [1.35, 0.2]]) add(new THREE.CylinderGeometry(0.1, 0.12, 0.5, 10), bottle, x, 2.22, z);
      for (const [x, z] of [[-0.4, 0.7], [0.1, 0.9]]) add(new THREE.CylinderGeometry(0.22, 0.13, 0.14, 12), bowl, x, 2.04, z);
    }

    scene.add(g);
    stations.push({ ...p, group: g, face, ring, label, labelY: label.position.y, phase: Math.random() * Math.PI * 2 });
  }

  /* ── 선술집 앞 빨간 플라스틱 의자와 둥근 테이블 ──
     차로 부딪히면 넘어지고 R로 다시 세운다 (장난감 블록과 같은 목록에 넣는다) */
  {
    const stoolMat = new THREE.MeshStandardMaterial({ color: 0xc8312b, roughness: .45 });
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: .7 });
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
      const table = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(tR, tR, 0.07, 18), tableMat); top.position.y = tH / 2 - 0.035;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, tH, 8), tableMat);
      top.castShadow = leg.castShadow = true;
      table.add(top, leg);
      place(table, new CANNON.Cylinder(tR, tR, tH, 10), 0, 4.6, tH, 1.2);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.42, 12), stoolMat);
        place(stool, new CANNON.Cylinder(0.2, 0.17, 0.42, 10), Math.cos(a) * 1.75, 4.6 + Math.sin(a) * 1.75, 0.42, 0.35);
      }
    }
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

  /* ── 화면 가운데 잠깐 뜨는 알림 ── */
  const toast = (() => {
    const el = document.createElement('div');
    el.id = 'g-toast';
    Object.assign(el.style, { position: 'fixed', left: '50%', top: '18%', transform: 'translate(-50%,-50%) scale(.9)', zIndex: 44,
      padding: '12px 22px', borderRadius: '14px', background: 'rgba(20,12,28,.82)', color: '#fff', font: '800 22px/1.2 Pretendard, system-ui, sans-serif',
      letterSpacing: '-.01em', boxShadow: '0 10px 30px rgba(0,0,0,.35)', opacity: '0', transition: 'opacity .25s, transform .25s', pointerEvents: 'none', textAlign: 'center' });
    document.getElementById('drive-root').appendChild(el);
    let timer = 0;
    return (html, ms = 1600) => {
      el.innerHTML = html; el.style.opacity = '1'; el.style.transform = 'translate(-50%,-50%) scale(1)';
      clearTimeout(timer); timer = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translate(-50%,-50%) scale(.9)'; }, ms);
    };
  })();
  /* ── 차 디테일: 헤드라이트, 흙먼지, 경적 ── */
  for (const sx of [-0.62, 0.62]) {
    const hl = new THREE.SpotLight(0xffe2b0, 30, 32, Math.PI / 7, 0.55, 1.6);
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
    /* 게시판 근처에서 Space는 브레이크가 아니라 "프로젝트 보기" */
    if (e.code === 'Space' && promptFor) { e.preventDefault(); activate(promptFor); hideHint(); return; }
    if (e.code === 'KeyR') { e.preventDefault(); restackBlocks(); return; }
    if (e.code === 'KeyH' && !e.repeat) { e.preventDefault(); honk(); return; }
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
      <span>${driving ? '운전' : '걷기'}</span>
      <div class="keys"><span class="key">Space</span></div><span>보기·열기</span>
      ${driving ? '<div class="keys"><span class="key">Shift</span></div><span>부스트</span><div class="keys"><span class="key">H</span></div><span>경적</span>' : ''}
      <div class="keys"><span class="key">R</span></div><span>다시 쌓기</span>
      <div class="keys"><span class="key">F</span></div><span>${driving ? '내리기' : '타기'}</span>`;
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
    panel.style.setProperty('--c', p.color);
    pnNo.textContent = p.no;
    pnBd.innerHTML = `
      ${galleryHTML(p)}
      <div class="meta"><span class="per">${p.period}</span><span class="role">${p.role}</span></div>
      <div class="n">${p.full}</div>
      <p class="one">${p.one}</p>
      ${listBlock('맡은 일', p.mine)}
      ${listBlock('해결한 문제', p.pts)}
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
    updateDayNight(t);
    fireflies(t);
    for (const c of contacts) { c.icon.position.y = 1.75 + Math.sin(t * 1.4 + c.phase) * 0.12; c.icon.rotation.y = Math.sin(t * 0.6 + c.phase) * 0.35; }
    dust(dt);
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

  /* ── 빛 번짐 — 등롱·전구·반딧불처럼 밝은 것만 은은하게 번진다 ── */
  const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
  const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
  const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
  const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.5, 1.0));
  composer.addPass(new OutputPass());

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);   // 탭 복귀 시 delta 폭주 방지
    if (!driveActive) return;                      // 문서 뷰일 땐 그리지 않는다
    step(dt);
    composer.render();
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
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
