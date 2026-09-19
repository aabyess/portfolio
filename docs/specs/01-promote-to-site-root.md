# SPEC 01 — 새 포트폴리오를 실제 사이트로 승격

| | |
|---|---|
| 상태 | 구현 대기 |
| 담당 | 구현: Codex / 기획: Claude Code |
| 선행 조건 | 없음 |
| 예상 난이도 | 낮음 (파일 이동 + 경로 8곳 수정) |

## 목적

지금 저장소 루트의 `index.html`은 **구버전 사이트**다. 새로 만든 포트폴리오는
`mockups/` 안에 시안처럼 들어 있어서, 저장소 주소로 접속하면 옛날 사이트가 뜬다.

새 포트폴리오를 루트로 올려서 **실제 배포되는 사이트로 만든다.**

이게 끝나야 이력서에 주소를 적거나, 채용 담당자에게 `#doc` 링크를 보내거나,
GitHub Pages로 서빙하는 게 가능해진다.

## 현재 상태

```
index.html                    구버전 사이트 (45KB, 단일 파일)
images/                       스크린샷·영상
models/                       car.glb, README, 라이선스
mockups/
  g-portfolio.html            ← 새 포트폴리오 (HTML 셸 + CSS)
  portfolio.js                ← 새 포트폴리오 (데이터 + 로직)
  a-editor.html ~ f-drive.html  버려진 시안 6개
  README.md                   시안 기록
```

## 목표 상태

```
index.html                    ← g-portfolio.html 내용
portfolio.js                  ← mockups/portfolio.js
images/                       그대로
models/                       그대로
mockups/                      시안 6개 + README (기록용으로 남긴다)
docs/specs/                   이 문서들
```

## 작업

### 1. 파일 이동

이력이 따라가도록 **`git mv`를 써라.** 복사 후 삭제하지 마라.

```
git mv mockups/g-portfolio.html index.html      # 구버전을 덮어쓴다
git mv mockups/portfolio.js portfolio.js
```

구버전 `index.html`은 사라지지만 커밋 `bc1ba6a`에 남아 있으므로 복구 가능하다.
따로 백업 파일을 만들지 마라.

### 2. 경로 수정

`portfolio.js`가 한 단계 위로 올라가므로 `../` 접두사를 **전부 제거**한다.
해당 줄은 아래 8곳이 전부다 (이동 전 기준 줄 번호).

| 줄 | 현재 | 변경 후 |
|---|---|---|
| 25 | `'../images/trade-cmarket.png'` | `'images/trade-cmarket.png'` |
| 45 | `'../images/nolleo-onna.mp4'` | `'images/nolleo-onna.mp4'` |
| 46 | `'../images/nolleo-onna.jpg'` | `'images/nolleo-onna.jpg'` |
| 64 | `'../images/reboot.png'` | `'images/reboot.png'` |
| 81 | `'../images/interview.png'` | `'images/interview.png'` |
| 98 | `'../images/ignis.png'` | `'images/ignis.png'` |
| 115 | `'../images/lol.png'` | `'images/lol.png'` |
| 269 | `CAR_MODEL_URL = '../models/car.glb'` | `'models/car.glb'` |

`CHAR_MODEL_URL`은 `null`이고 주석에도 경로 예시가 없으므로 **손댈 것이 없다.**

`index.html`의 `<script type="module" src="./portfolio.js">`는 **그대로 둔다.**
둘 다 루트로 올라가므로 경로가 유지된다.

### 3. 문서 갱신

`models/README.md` — 3곳:

| 줄 | 현재 | 변경 후 |
|---|---|---|
| 12 | `` `mockups/portfolio.js`의 `CAR_MODEL_URL` `` | `` `portfolio.js`의 `CAR_MODEL_URL` `` |
| 92 | `` `mockups/portfolio.js`의 `CHAR_MODEL_URL` `` | `` `portfolio.js`의 `CHAR_MODEL_URL` `` |
| 95 | `const CHAR_MODEL_URL = '../models/character.glb';` | `const CHAR_MODEL_URL = 'models/character.glb';` |

(72번·78번 줄은 이미 `portfolio.js`로만 적혀 있으니 건드리지 마라)

`mockups/README.md` — 맨 위에 한 줄 추가: 최종본은 루트의 `index.html`이며
이 폴더는 버려진 시안 기록용이라는 것.

## 제약 — 반드시 지킬 것

### 절대 경로를 쓰지 마라

`/images/...` 처럼 앞에 슬래시를 붙이면 **GitHub Pages에서 깨진다.**
이 저장소는 `aabyess/portfolio`라 Pages로 서빙되면 주소가
`aabyess.github.io/portfolio/`가 되고, 루트 기준 절대 경로는 도메인 최상단을
가리켜 404가 난다.

반드시 `images/...`, `models/...` 같은 **상대 경로**를 써라.
그래야 루트 배포와 하위 경로 배포 양쪽에서 다 동작한다.

### 시안 파일을 옮기거나 지우지 마라

`mockups/a-editor.html` ~ `f-drive.html`은 `../images/`를 참조하고 있어서
폴더를 옮기면 이미지가 깨진다. 지금 위치에 그대로 두면 계속 열람 가능하다.
디자인 검토 과정 기록이라 남겨둘 가치가 있다.

### 기능을 바꾸지 마라

이번 작업은 **위치 이동과 경로 수정뿐이다.** 리팩터링, 파일 분할,
CSS 정리, 코드 개선을 같이 하지 마라. 문제가 생겼을 때 이동 때문인지
개선 때문인지 구분할 수 없게 된다.

개선하고 싶은 게 보이면 적어뒀다가 따로 제안해라.

## 완료 조건

로컬 서버를 **저장소 루트에서** 띄우고 확인한다.

```
python3 -m http.server 8777
# http://127.0.0.1:8777/
```

아래를 전부 확인한 뒤 완료라고 말해라.

- [ ] `http://127.0.0.1:8777/` 로 접속하면 새 포트폴리오(노을 고속도로)가 뜬다
- [ ] 브라우저 콘솔에 에러·404가 없다
- [ ] 게시판 6개에 스크린샷이 모두 보인다 (검은 판이 없어야 한다)
- [ ] 놀러온나 게시판에 영상이 재생된다
- [ ] 차가 초록색 Kenney 모델이다 (박스로 조립한 기본 차가 아니어야 한다)
      → `?test=1` 로 열어 `__drive.carInfo().usingModel === true` 확인
- [ ] 좌상단 "문서로 보기" → 문서 뷰 전환, 주소가 `#doc`가 된다
- [ ] 문서 뷰에서 프로젝트 이미지가 모두 보인다
- [ ] `http://127.0.0.1:8777/#doc` 로 새로 접속하면 문서 뷰로 바로 열린다
- [ ] 출발선에서 직진만 해서 프로젝트 6개가 순서대로 열리고 `6 / 6`이 된다
- [ ] `mockups/a-editor.html` 등 기존 시안이 여전히 열리고 이미지가 보인다

## 이 스펙에서 다루지 않는 것

아래는 별도 스펙으로 처리한다. **이번 작업에 섞지 마라.**

- 이력서 PDF 연결 (`index.html`의 `data-todo="resume"` 자리표시자)
- 캐릭터 모델 교체 (Blender에서 Kenney 캐릭터 병합)
- Playground의 게임 정보 채우기
- GitHub Pages 설정 자체 (저장소 설정이라 사람이 해야 한다)

## 질문이 있으면

구현 중 스펙이 애매하면 추측하지 말고 **어느 항목의 무엇이 불명확한지**
구체적으로 물어봐라.
