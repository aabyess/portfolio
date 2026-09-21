# SPEC 02 — 프로젝트 순서 변경 및 내용 수정

| | |
|---|---|
| 상태 | 구현 대기 |
| 담당 | 구현: Codex / 기획: Claude Code |
| 선행 조건 | 스펙 01 완료 (`portfolio.js`가 루트에 있어야 함) |
| 예상 난이도 | 낮음 (데이터만 수정, 렌더링 코드 무변경) |

## 목적

사용자 요청으로 프로젝트 순서와 내용을 고친다.
전부 `portfolio.js`의 `PROJECTS` 배열만 건드리는 작업이다.

`PROJECTS`가 문서 카드·3D 게시판·상세 패널·발견 목록의 **단일 출처**라서,
데이터만 고치면 네 곳에 동시에 반영된다. **각 화면을 따로 수정하지 마라.**

> **작업 순서 주의** — 아래 1번이 배열 요소를 통째로 옮기기 때문에 줄 번호가
> 전부 바뀐다. 그래서 2번부터는 줄 번호 대신 **프로젝트 `id`로 위치를 지정**한다.
> 1번을 먼저 하고, 나머지는 `id`를 보고 찾아라.

## 작업

### 1. 놀러온나를 1순위로, Trade-Cmarket을 2순위로

현재 `PROJECTS` 배열의 첫 두 항목이 `trade` → `nolleo` 순서다.
이걸 뒤집어 `nolleo` → `trade`로 만든다.

**배열 요소를 통째로 옮기는 것만으로는 부족하다.** 두 필드를 같이 바꿔야 한다.

| 필드 | 왜 같이 바꿔야 하나 |
|---|---|
| `no` | 화면에 찍히는 번호다. 안 바꾸면 1번째 카드에 `02`가 적힌다 |
| `pos` | 고속도로 위 좌표다. 안 바꾸면 **목록은 놀러온나가 먼저인데 도로에서는 Trade-Cmarket을 먼저 지나간다** |

최종 상태:

| 순서 | id | `no` | `pos` | 도로에서 |
|---|---|---|---|---|
| 1번째 | `nolleo` | `'01'` | `[-17, -16]` | 출발선에서 가장 가까움, 왼쪽 |
| 2번째 | `trade` | `'02'` | `[17, -38]` | 두 번째, 오른쪽 |

나머지 4개(`reboot`, `mate`, `ignis`, `lol`)는 **순서·번호·좌표 전부 그대로 둔다.**

`color`는 프로젝트 고유값이므로 **따라 옮긴다.** 놀러온나는 파란색(`#3fa7d6`),
Trade-Cmarket은 주황색(`#e8734a`)을 그대로 유지한다. 색은 교환하지 마라.

### 2. 놀러온나 스크린샷 교체 (영상 → 이미지)

기존 `nolleo-onna.mp4`는 **구버전 디자인**을 담고 있다. 서비스가 새로
디자인돼서 그대로 두면 존재하지 않는 옛날 화면을 보여주게 된다.

새 캡처는 기획 브랜치에 이미 들어가 있다. 병합하면 따라온다.

- `images/nolleo-onna.jpg` — 1280×800 (16:10), 90KB, 현재 라이브 화면

`id: 'nolleo'` 항목에서 `video`와 `poster` 두 줄을 지우고 `img` 한 줄로 바꾼다.

```diff
-    video: 'images/nolleo-onna.mp4',
-    poster: 'images/nolleo-onna.jpg',   // 영상이 재생되기 전까지 보여줄 정지 이미지
+    img: 'images/nolleo-onna.jpg',
```

`poster`는 영상 전용 속성이라 `img`로 바꾸면 의미가 없다. 같이 지워라.

이제 아무도 참조하지 않는 영상 파일을 삭제한다. (478KB 절약)

```
git rm images/nolleo-onna.mp4
```

삭제 전 `grep -rn "nolleo-onna.mp4"`로 `mockups/` 밖에 참조가 없는지 확인해라.
`mockups/`의 버려진 시안들이 이 파일을 참조하지만 기록용이라 깨져도 무방하다.

### 3. 놀러온나 라이브 주소 갱신

`dev.nolleo-onna.site`를 가리키고 있는데 운영 주소는 `www.nolleo-onna.site`다.
`id: 'nolleo'` 항목에서:

```diff
-    live: 'https://dev.nolleo-onna.site/',
+    live: 'https://www.nolleo-onna.site/',
```

### 4. Trade-Cmarket 라이브 버튼 제거

사용자 요청. 라이브 링크를 노출하지 않는다.
`id: 'trade'` 항목에서 `live` 항목만 지운다. **`repo`는 남긴다.**

```diff
-    live: 'https://mitrapay.vercel.app/', repo: 'https://github.com/cmarketplace/Trade-Cmarket',
+    repo: 'https://github.com/cmarketplace/Trade-Cmarket',
```

`links()` 헬퍼가 `p.live ? ... : ''`로 되어 있어서 필드만 지우면 문서 뷰와
3D 패널 양쪽에서 버튼이 사라진다. **렌더링 코드를 고치지 마라.**

## 제약

- **`PROJECTS` 배열 외에는 건드리지 마라.** `media()`, `links()`, `renderDoc()`,
  스테이션 생성 로직 전부 그대로 둔다. 데이터만 바꿔도 전부 따라온다.
- 다른 프로젝트의 `live`는 손대지 마라. RE:BOOT는 라이브 버튼을 유지한다.
- 프로젝트 본문(`pts`, `one`, `short`, `stack`)은 수정 대상이 아니다.

## 완료 조건

```
cd ~/GitHub/portfolio-codex && python3 -m http.server 8788
# http://127.0.0.1:8788/
```

**순서**

- [ ] 문서 뷰 프로젝트 섹션에서 **놀러온나가 첫 번째**, Trade-Cmarket이 두 번째
- [ ] 놀러온나 카드 번호가 `01`, Trade-Cmarket이 `02`
- [ ] 출발선에서 직진했을 때 **놀러온나 게시판을 먼저** 지나간다
- [ ] 좌하단 발견 목록도 놀러온나가 맨 위
- [ ] 03~06번(RE:BOOT, Myeonjeop-Mate, IGNIS, LOL)은 순서·번호 그대로

**내용**

- [ ] 놀러온나 게시판에 **새 디자인 스크린샷**이 보인다
      (파란 배경 + "부산 여행, 온나한테 물어보세요")
- [ ] 놀러온나 패널·문서 카드에도 같은 새 이미지
- [ ] 놀러온나 라이브 버튼이 `www.nolleo-onna.site`로 연결
- [ ] Trade-Cmarket에 **라이브 버튼이 없고** GitHub만 있다 (3D·문서 양쪽)
- [ ] RE:BOOT는 라이브 버튼 유지
- [ ] 놀러온나 패드·게시판 테두리가 **파란색**, Trade-Cmarket이 **주황색** (색 유지 확인)
- [ ] 콘솔에 404 없음 (`favicon.ico` 제외)
- [ ] `images/nolleo-onna.mp4` 삭제됨

## 참고 — 하지 않기로 한 것

영상을 새로 녹화하는 것도 방법이지만 이번엔 정지 이미지로 간다.
나중에 새 디자인으로 녹화하면 `img`를 `video`+`poster`로 되돌리면 된다.
코드는 양쪽을 모두 지원한다.

**녹화하실 땐 방해금지 모드를 켜세요.** 기존 영상에는 "Unity Hub 3.21.0"
데스크톱 알림이 통째로 녹화돼 있어서 잘라내야 했다.
