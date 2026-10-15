# 차 모델

현재 차: **Kenney Car Kit의 `hatchback-sports`** (CC0)

```
car.glb                  차 모델 (131KB, 텍스처 포함)
KENNEY-LICENSE.txt       원본 라이선스
```

출처: <https://kenney.nl/assets/car-kit> · 라이선스 CC0 (퍼블릭 도메인, 출처 표기 의무 없음)

`portfolio.js`의 `CAR_MODEL_URL`이 이 파일을 가리킵니다.
`null`로 바꾸면 박스로 조립한 기본 차로 돌아갑니다.

현재 `car.glb`는 **텍스처를 파일 안에 포함**하고 있어서 이 파일 하나만 있으면 됩니다.
(Blender로 한 번 왕복시켜 embed한 결과물입니다. 덤으로 197KB → 131KB로 줄었습니다)

## ⚠️ Kenney zip에서 직접 꺼내 쓸 때 주의

**원본 zip의 glb는 텍스처가 들어있지 않습니다.** `Textures/colormap.png`를 상대 경로로
참조만 합니다. 그래서 zip에서 `.glb`만 꺼내 오면 차가 **새하얗게** 나옵니다.
콘솔에 이런 에러가 찍힙니다:

```
THREE.GLTFLoader: Couldn't load texture Textures/colormap.png
```

해결은 둘 중 하나입니다.

1. **`Textures/` 폴더를 `car.glb` 옆에 같이 두기** — 가장 간단합니다.
   Car Kit의 차들은 전부 같은 팔레트 텍스처 하나를 공유하므로 폴더 하나면 전부 커버됩니다.
2. **Blender로 열었다가 다시 내보내기** — 텍스처가 파일 안에 묻혀서 파일 하나로 끝납니다.
   지금 `car.glb`가 이 방식입니다. (아래 "Blender 내보내기 설정" 참고)

## 다른 차로 바꾸기

Car Kit 안에 50개가 들어 있습니다. 받은 zip에서 원하는 `.glb`를 `car.glb`로 복사하고,
위의 텍스처 주의사항만 처리하면 됩니다.

- 승용차 — `sedan`, `sedan-sports`, `hatchback-sports`, `taxi`, `police`
- SUV·밴 — `suv`, `suv-luxury`, `van`, `delivery`
- 카트 — `kart-oobi`, `kart-oodi`, `kart-ooli`, `kart-oopi`, `kart-oozi`
- 큰 차 — `truck`, `firetruck`, `ambulance`, `garbage-truck`, `tractor`

## 직접 만든 모델 쓰기 (Blender)

`File > Export > glTF 2.0 (.glb/.gltf)`, Format은 **glTF Binary (.glb)**.
텍스처를 쓴다면 내보내기 설정에서 이미지를 **같이 묻어서(embed)** 내보내는 쪽이 안전합니다.

### 지켜야 할 것 두 가지

**1. 차 앞코가 -Y 축을 향하게**

Blender에서 앞코를 -Y로 두고 내보내면 glTF에서 +Z가 됩니다. 코드가 기대하는 방향입니다.
(Kenney 모델도 같은 규칙이라 그대로 붙습니다) 반대로 나오면 차가 뒤로 달리는 것처럼 보입니다.

**2. 바퀴 오브젝트 이름**

바퀴를 분리하고 아래 이름 중 하나로 지으면 조향과 구르는 회전이 자동으로 붙습니다.

| 위치 | 직접 만들 때 | Kenney 킷 규칙 |
|---|---|---|
| 왼쪽 앞 | `wheel_fl` | `wheel-front-left` |
| 오른쪽 앞 | `wheel_fr` | `wheel-front-right` |
| 왼쪽 뒤 | `wheel_rl` | `wheel-back-left` |
| 오른쪽 뒤 | `wheel_rr` | `wheel-back-right` |

- **바퀴의 오브젝트 원점(Origin)을 바퀴 한가운데**에 두세요.
  (`Object > Set Origin > Origin to Geometry`) 원점이 엉뚱하면 바퀴가 궤도를 그리며 돕니다.
- 이름이 다르거나 바퀴를 합쳐서 내보내면 차체만 움직입니다. 주행 자체는 정상입니다.

새 규칙을 추가하려면 `portfolio.js`의 `WHEEL_SPEC`에 이름을 넣으면 됩니다.

## 크기는 안 맞춰도 됩니다

불러올 때 **차 길이를 기준으로 자동으로 크기를 맞추고**, 좌우·앞뒤 중심을 잡고,
바퀴가 바닥에 닿도록 높이를 내립니다. 몇 미터로 만들든 상관없습니다.
기준값은 `portfolio.js`의 `CAR_LEN` (기본 4.2).

## 용량

포트폴리오는 첫 로딩 속도가 중요합니다. **2MB 이하**를 권합니다.
현재 차 + 텍스처는 합쳐서 약 205KB입니다.

---

# 캐릭터 모델

차에서 내려 뛰어다니는 캐릭터입니다. 현재는 **박스로 조립한 기본 캐릭터**가
팔다리를 흔드는 방식으로 움직입니다. 별도 모델 파일이 없어도 동작합니다.

리깅된 `.glb`로 교체하려면 `portfolio.js`의 `CHAR_MODEL_URL`에 경로를 넣으면 됩니다.

```js
const CHAR_MODEL_URL = 'models/character.glb';
const CHAR_HEIGHT = 1.95;   // 월드 기준 키. 모델 크기는 여기에 맞춰 자동 조정된다.
```

## 애니메이션 이름

glb 안의 애니메이션 클립에서 `Armature|Run` 같은 접두사를 떼고 **소문자**로 찾습니다.
아래 이름이 있으면 자동으로 연결됩니다.

| 상태 | 찾는 이름 | 없을 때 |
|---|---|---|
| 서 있을 때 | `idle` | 애니메이션 없이 정지 |
| 뛸 때 | `run` | `walk`로 대체 |

## 쓸 만한 CC0 에셋

- **Kenney — Animated Characters** <https://kenney.nl/assets/animated-characters-protagonists>
  스케이터·캐주얼 복장. **지금 차와 화풍이 같습니다.** 단, FBX로만 제공되고
  애니메이션이 별도 파일(`idle.fbx` / `run.fbx` / `jump.fbx`)이라 Blender에서
  하나의 glb로 합쳐야 합니다.
- **Quaternius** <https://quaternius.com> — glb에 애니메이션이 이미 들어 있어 바로 쓸 수 있지만,
  판타지 계열이 많아 이 월드와는 덜 어울립니다.

## Blender에서 FBX 애니메이션 합치기

1. `Model/characterMedium.fbx` 임포트 (아마추어 + 메시)
2. `Animations/idle.fbx`, `run.fbx` 를 각각 임포트 → 각자 액션을 가지고 들어옵니다
3. 그 액션들을 본체 아마추어의 NLA 트랙에 넣고, 임시로 들어온 아마추어는 삭제
4. `Skins/` 폴더의 PNG를 머티리얼 베이스 컬러에 연결
5. glTF Binary(.glb)로 내보내기 — Animation 모드를 **Actions**로 두면 전부 포함됩니다
