# 디자인 시안

세 가지 방향을 같은 콘텐츠로 비교할 수 있게 만든 시안입니다.
각 파일을 브라우저로 열면 바로 확인할 수 있습니다.

| 파일 | 방향 | 성격 |
|---|---|---|
| `a-editor.html` | 코드 에디터 | 탭 바 내비게이션, YAML 프론트매터, JSON 연락처, VS Code 상태 바 |
| `b-tui.html` | 터미널 TUI | 사이드바 파일트리, ASCII 아트, 스캔라인, 키바인드 상태 바 |
| `c-neon.html` | 네온 / 게임 | 그라디언트 메시, 글래스 카드, 프로젝트별 네온 컬러 |

## 세 시안의 공통 사항

- 다크 기본 / 풀스택 중심 문구 / Trade-Cmarket을 첫 프로젝트로 배치
- 신규 **Playground** 섹션 (취미 게임 개발)
- Pretendard를 jsDelivr에서 로드 (기존 `index.html`은 Google Fonts에서 요청하고
  있는데 Google Fonts는 Pretendard를 호스팅하지 않아 실제로는 시스템 폰트로 폴백됨)
- 프로젝트 이미지 좌우 교차 배치 + 스티키 프레임
- `prefers-reduced-motion` 대응, `:focus-visible` 포커스 링

## 아직 채워야 할 것

Playground 섹션의 게임 카드는 실제 정보가 없어 임시 내용입니다.
제목 / 장르 / 사용 엔진 / 스크린샷이 있으면 채워 넣어야 합니다.

## 로컬에서 보기

```
python3 -m http.server 8777
# http://127.0.0.1:8777/mockups/a-editor.html
```
