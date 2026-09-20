# SPEC 02 — 프로젝트 내용 수정 3건

| | |
|---|---|
| 상태 | 구현 대기 |
| 담당 | 구현: Codex / 기획: Claude Code |
| 선행 조건 | 스펙 01 완료 (`portfolio.js`가 루트에 있어야 함) |
| 예상 난이도 | 낮음 (데이터 4줄 + 파일 삭제 1개) |

## 목적

사용자 요청으로 프로젝트 내용 3건을 고친다. 전부 `portfolio.js`의
`PROJECTS` 배열만 건드리는 작업이다. 렌더링 코드는 손대지 않는다.

`PROJECTS`가 문서 뷰·3D 게시판·상세 패널의 단일 출처라서, 데이터만 고치면
**세 곳에 동시에 반영된다.** 각 화면을 따로 수정하지 마라.

## 작업

### 1. Trade-Cmarket 라이브 버튼 제거

사용자 요청. 라이브 링크를 노출하지 않는다.

**26번 줄**에서 `live` 항목만 지운다. `repo`는 남긴다.

```diff
-    live: 'https://mitrapay.vercel.app/', repo: 'https://github.com/cmarketplace/Trade-Cmarket',
+    repo: 'https://github.com/cmarketplace/Trade-Cmarket',
```

`links()` 헬퍼가 `p.live ? ... : ''` 로 되어 있어서 필드만 지우면
문서 뷰와 3D 패널 양쪽에서 버튼이 사라진다. **렌더링 코드를 고치지 마라.**

### 2. 놀러온나 스크린샷 교체 (영상 → 이미지)

기존 `nolleo-onna.mp4`는 **구버전 디자인**을 담고 있다. 실제 서비스가
새 디자인으로 바뀌어서 그대로 두면 옛날 화면을 보여주게 된다.

새 캡처 이미지는 기획 브랜치에서 이미 교체해뒀다. 병합하면 따라온다.

- `images/nolleo-onna.jpg` — 1280×800 (16:10), 90KB, 현재 라이브 화면

**45~46번 줄**을 아래처럼 바꾼다. `video`와 `poster`를 지우고 `img` 하나로.

```diff
-    video: 'images/nolleo-onna.mp4',
-    poster: 'images/nolleo-onna.jpg',   // 영상이 재생되기 전까지 보여줄 정지 이미지
+    img: 'images/nolleo-onna.jpg',
```

`poster`는 영상 전용 속성이라 `img`로 바꾸면 의미가 없어진다. 같이 지워라.

이제 아무도 참조하지 않는 영상 파일을 삭제한다. (478KB 절약)

```
git rm images/nolleo-onna.mp4
```

삭제 전 `grep -rn "nolleo-onna.mp4"`로 `mockups/` 밖에 참조가 없는지 확인해라.
`mockups/` 안의 버려진 시안들은 이 파일을 참조하지만, 그건 기록용이라
이미지가 깨져도 무방하다.

### 3. 놀러온나 라이브 주소 갱신

현재 `dev.nolleo-onna.site`를 가리키는데, 운영 주소는
`www.nolleo-onna.site`다. **47번 줄**을 바꾼다.

```diff
-    live: 'https://dev.nolleo-onna.site/', repo: 'https://github.com/nolleo-onna/nolleo-onna-frontend',
+    live: 'https://www.nolleo-onna.site/', repo: 'https://github.com/nolleo-onna/nolleo-onna-frontend',
```

## 제약

- **`PROJECTS` 배열 외에는 건드리지 마라.** `media()`, `links()` 헬퍼나
  렌더링 로직은 그대로 둔다. 데이터만 바꿔도 전부 반영된다.
- 다른 프로젝트의 `live` 필드는 손대지 마라. RE:BOOT는 그대로 유지한다.

## 완료 조건

```
cd ~/GitHub/portfolio-codex && python3 -m http.server 8788
# http://127.0.0.1:8788/
```

- [ ] Trade-Cmarket 패널에 **"라이브" 버튼이 없고** GitHub 버튼만 있다
      (3D 게시판 패널과 문서 뷰 양쪽 모두 확인)
- [ ] 놀러온나 게시판에 **새 디자인 스크린샷**이 보인다
      (파란 배경에 "부산 여행, 온나한테 물어보세요" 문구)
- [ ] 놀러온나 패널·문서 카드에도 같은 새 이미지가 보인다
- [ ] 놀러온나 "라이브" 버튼이 `www.nolleo-onna.site`로 연결된다
- [ ] RE:BOOT는 라이브 버튼이 그대로 있다
- [ ] 콘솔에 404가 없다 (`favicon.ico` 제외)
- [ ] `images/nolleo-onna.mp4`가 삭제됐다

## 참고 — 하지 않기로 한 것

영상을 새로 녹화해서 넣는 것도 방법이지만, 이번에는 정지 이미지로 간다.
나중에 새 디자인으로 화면 녹화를 하면 `img`를 다시 `video`+`poster`로
되돌리면 된다. 코드는 양쪽을 모두 지원한다.

**녹화하실 때 방해금지 모드를 켜세요.** 기존 영상에는 "Unity Hub 3.21.0"
데스크톱 알림이 통째로 녹화돼 있어서 잘라내야 했다.
