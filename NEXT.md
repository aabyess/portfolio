# 다음에 할 일

새 세션에서 이어서 작업할 때 이 파일부터 읽으면 됩니다.
마지막 갱신: 2026-09-19

---

## 지금 상태 한 줄 요약

3D 드라이브 포트폴리오가 동작하고 루트 배포 구조까지 끝났습니다.
**남은 건 캐릭터 모델 교체, 도로 텍스처, 그리고 내용 채우기(이력서·게임)입니다.**

## 브랜치 배치

| 브랜치 | 커밋 | 워크트리 위치 | 용도 |
|---|---|---|---|
| `main` | `bc1ba6a` | `~/GitHub/portfolio` | **원본 구버전. 아직 아무것도 머지 안 됨** |
| `worktree-portfolio-ui-polish` | `d38b1a8` | `~/GitHub/portfolio/.claude/worktrees/portfolio-ui-polish` | 기획(Claude). `docs/`만 수정 |
| `codex-impl` | `ea5abbd` | `~/GitHub/portfolio-codex` | 구현(Codex). 코드 수정 |

셋 다 원격에 푸시되어 있습니다. **실제 사이트는 여전히 `main`의 구버전을 보여줍니다.**
되돌리고 싶으면 그냥 머지 안 하면 됩니다.

### 역할 분담 (테스트 중인 방식)

- **Claude Code = 기획.** `docs/specs/`에 스펙을 쓰고 코드는 건드리지 않음
- **Codex = 구현.** 스펙을 받아 코드 작성, 완료 조건을 직접 검증
- Codex가 스펙 받아가는 법: `git merge worktree-portfolio-ui-polish`
- 기획이 `docs/`만 만지므로 두 브랜치가 충돌하지 않음

스펙 01(루트 승격)은 이 방식으로 완료됐고 결과가 정확했습니다.

## 로컬 띄우기

```bash
cd ~/GitHub/portfolio-codex && python3 -m http.server 8788   # 구현 결과
# http://127.0.0.1:8788/
```

기획 브랜치 쪽을 보려면 `.claude/worktrees/portfolio-ui-polish`에서 8777 포트.
(그쪽은 아직 `mockups/g-portfolio.html` 경로입니다)

---

## 할 일 — 우선순위 순

### 1. 캐릭터 모델 교체 ⬅ 가장 시급

지금 캐릭터는 **박스로 조립한 임시 모델**입니다. 딱 봐도 임시라 티가 납니다.

**Blender 연결이 필요합니다.** Blender에서 `N` → `MCP for Blender` 탭 →
`Connect to Claude` 를 눌러야 붙습니다. (애드온 이름이 "BlenderMCP"가 아니라
**"MCP for Blender"** 입니다. 이미 설치·활성화되어 있습니다)

작업 내용: Kenney 캐릭터 팩은 FBX로만 제공되고 애니메이션이 별도 파일이라
Blender에서 하나의 glb로 합쳐야 합니다.

```
characterMedium.fbx  +  idle.fbx / run.fbx / jump.fbx  →  models/character.glb
```

1. 모델 FBX 임포트 (아마추어 + 메시)
2. 애니메이션 FBX를 각각 임포트 → 각자 액션을 들고 들어옴
3. 액션을 본체 아마추어의 NLA 트랙에 넣고, 임시 아마추어는 삭제
4. `Skins/` PNG를 머티리얼 베이스 컬러에 연결 (스케이터 남/여, 캐주얼, 사이보그 4종)
5. glTF Binary(.glb) 내보내기, Animation 모드 **Actions**

**에셋 다시 받기** (임시 폴더에 받아뒀던 건 세션 종료로 날아갑니다):

```
https://kenney.nl/media/pages/assets/animated-characters-protagonists/608191acc4-1774773108/kenney_animated-characters-protagonists.zip
```

코드는 이미 준비돼 있습니다. `portfolio.js`의 `CHAR_MODEL_URL`을
`'models/character.glb'`로 바꾸면 교체되고, 애니메이션 이름은 `idle` / `run`을
자동으로 찾습니다. (`Armature|Run` 같은 접두사는 떼고 소문자로 매칭)

> 분담: **Blender MCP는 Claude 쪽에만 연결됩니다.** 에셋 생성은 Claude가 하고,
> 코드 통합은 스펙으로 넘겨 Codex가 하는 게 맞습니다.

### 2. 도로 텍스처 (스펙 미작성)

도로가 단색 평면이라 밋밋합니다. **Blender는 부적합합니다** — 모델로 만들면
길이가 고정돼서 `BOUND` 상수로 도로를 늘리는 게 불가능해집니다.
아스팔트 노멀·러프니스 텍스처를 입히는 방향이 맞습니다.

Codex가 Blender 없이 바로 할 수 있는 작업입니다. 스펙만 쓰면 됩니다.

### 3. 이력서 PDF — **사용자 입력 대기**

`index.html`에 자리만 잡혀 있습니다: `<a href="#" data-todo="resume">`
PDF 파일을 주시면 연결합니다.

### 4. Playground 게임 정보 — **사용자 입력 대기**

`portfolio.js`의 `PLAY` 배열 첫 항목이 임시 내용입니다.
**제목 / 장르 / 사용 엔진 / 스크린샷**이 필요합니다.

### 5. main 머지 + GitHub Pages

결과가 만족스러우면 `codex-impl` → `main` 머지.
Pages 설정은 저장소 설정이라 사람이 해야 합니다.
머지하는 순간부터 실제 사이트가 바뀝니다.

### 6. 남은 자잘한 것

- **모바일 실기기 미검증.** 터치 버튼은 붙였지만 실제 폰에서 확인 안 했습니다.
  저사양 기기 성능도 미확인
- favicon 없음 (콘솔에 404 하나 남음)
- 가로등 모델 개선 — 우선순위 낮음. 멀리서 실루엣으로만 보여 티가 안 납니다
- 자동차 색 변경 — 지금 Kenney 초록색. 바꾸려면 Blender에서 UV를 팔레트의
  다른 칸으로 옮기면 됩니다

---

## 반드시 알아둬야 할 함정

작업하다 실제로 겪은 것들입니다. 모르면 같은 데서 또 막힙니다.

**좌표계** — 전방 벡터가 `(sin h, cos h)`라서 **카메라가 +Z를 바라봅니다.**
따라서 **화면상 오른쪽은 월드 −X**입니다. 좌우 입력 부호를 직관대로 쓰면
A/D가 반대로 움직입니다. 한 번 겪은 버그입니다.

**브라우저 캐시** — `portfolio.js`를 고친 뒤 그냥 새로고침하면 **이전 버전이
그대로 돕니다.** HTML에만 캐시 무효화 파라미터를 붙여도 소용없습니다.
반드시 `Cmd+Shift+R`로 강제 새로고침하세요. 두 번 당했습니다.

**백그라운드 탭** — 탭이 앞에 없으면 브라우저가 `requestAnimationFrame`을
완전히 멈춥니다. 차가 안 움직인다고 코드를 의심하기 전에 탭이 활성인지 보세요.
그래서 `?test=1`로 `window.__drive` 훅을 만들어뒀습니다:

```js
__drive.step(1/60)          // 한 프레임 진행
__drive.keys.fwd = true     // 입력
__drive.teleport(x, z, h)   // 위치 지정
__drive.mode()              // 'driving' | 'onfoot'
__drive.carInfo()           // 차 모델 적용 상태
```

**Kenney glb의 외부 텍스처** — zip에서 꺼낸 `.glb`는 텍스처를 안에 담지 않고
`Textures/colormap.png`를 상대 경로로 참조합니다. glb만 복사하면 **모델이
새하얗게** 나옵니다. Blender로 한 번 왕복시켜 embed하면 해결됩니다.
(현재 `models/car.glb`가 그렇게 처리된 상태입니다)

**스펙에 줄 번호를 적을 때** — 반드시 실제 파일을 열어 확인하세요.
기억으로 쓰면 틀립니다. 실제로 한 번 틀린 스펙을 냈다가 잡았습니다.

---

## 참고 링크

- 차 모델 원본 (Kenney Car Kit, CC0, 50종):
  `https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip`
- 디자인 레퍼런스: <https://bruno-simon.com/> (Three.js + Cannon.js + Blender)
- 버려진 시안 6종: `mockups/` 폴더 — 왜 지금 디자인이 됐는지의 기록
