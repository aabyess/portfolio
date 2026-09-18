# 차 모델

현재 차: **Kenney Car Kit의 `hatchback-sports`** (CC0)

```
car.glb                  차 모델 (131KB, 텍스처 포함)
KENNEY-LICENSE.txt       원본 라이선스
```

출처: <https://kenney.nl/assets/car-kit> · 라이선스 CC0 (퍼블릭 도메인, 출처 표기 의무 없음)

`mockups/portfolio.js`의 `CAR_MODEL_URL`이 이 파일을 가리킵니다.
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
