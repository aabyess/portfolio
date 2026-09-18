# 차 모델

현재 차: **Kenney Car Kit의 `hatchback-sports`** (CC0)

```
car.glb                  차 모델 (193KB)
Textures/colormap.png    car.glb이 참조하는 팔레트 텍스처 (12KB)
KENNEY-LICENSE.txt       원본 라이선스
```

출처: <https://kenney.nl/assets/car-kit> · 라이선스 CC0 (퍼블릭 도메인, 출처 표기 의무 없음)

`mockups/portfolio.js`의 `CAR_MODEL_URL`이 이 파일을 가리킵니다.
`null`로 바꾸면 박스로 조립한 기본 차로 돌아갑니다.

## ⚠️ 텍스처 파일을 같이 옮겨야 합니다

Kenney의 glb는 텍스처를 파일 안에 넣지 않고 **`Textures/colormap.png`를 상대 경로로 참조**합니다.
`car.glb`만 복사하면 차가 **새하얗게** 나옵니다. (콘솔에
`THREE.GLTFLoader: Couldn't load texture Textures/colormap.png` 가 찍힙니다)

Car Kit의 다른 차로 바꿀 때도 `Textures/` 폴더를 그대로 두면 됩니다.
전부 같은 팔레트 텍스처 하나를 공유합니다.

## 다른 차로 바꾸기

Car Kit 안에 50개가 들어 있습니다. 받은 zip에서 원하는 `.glb`를 `car.glb`로 복사만 하면 끝입니다.

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
