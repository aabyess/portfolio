# 탈것 모델 (vehicles)

Blender에서 직접 만든 로우폴리 탈것입니다. `car-red.glb`(Kenney Car Kit)와 같은 화풍 —
텍스처 없이 단색 머티리얼만 씁니다. 원본은 `models/src/<이름>.blend`.

공통 규칙 (차와 동일)

- 앞쪽 = Blender **-Y** = glTF **+Z**, 위 = +Y(glTF)
- 원점 = 바닥 높이, 차체 중앙. 단위는 실제 미터
- 바퀴 오브젝트는 **원점이 바퀴 중심**, 회전 없음, 굴림 축 = 로컬 **X**
- 빈 오브젝트(Empty) **`seat`** = 탄 사람의 엉덩이 위치
- **Draco 압축**입니다. 차 로더처럼 `new GLTFLoader()`만 쓰면 못 읽습니다.
  월드 로더처럼 `loader.setDRACOLoader(draco)`를 꼭 붙이세요.

| 파일 | 용량 | 삼각형 | 실제 길이 (폭 × 높이) |
|---|---|---|---|
| `horse.glb` | 58 KB | 약 700 | 2.48 m (0.61 × 2.2, 등 높이 약 1.5~1.6) |
| `carriage.glb` | 88 KB | 약 3,500 | 6.27 m (1.86 × 2.2) |
| `motorcycle.glb` | 33 KB | 약 2,200 | 2.16 m (0.97 × 1.2) |
| `bicycle.glb` | 32 KB | 약 2,000 | 1.80 m (0.62 × 1.07) |

## horse.glb — 말타기

밤색 말 + 안장·고삐. 리깅된 SkinnedMesh(`horse`) + 아마추어(`horse_rig`).

- 뼈: `root` › `body` › `neck` › `head`, `tail`, 다리 `leg_{fl,fr,rl,rr}_{up,low}`
- 애니메이션(24fps, 루프, 제자리 — 루트 모션 없음)
  - `Idle` 2.0 s · `Walk` 1.2 s · `Gallop` 0.58 s
- `seat` 는 `body` 뼈의 자식 → 걸음에 맞춰 같이 들썩입니다. (휴지 자세 위치 y=1.59)

## carriage.glb — 마차

말 한 마리 + 덮개 달린 나무 짐마차. 말은 위와 같은 리그(마구 버전, 안장 없음).

- 바퀴: `wheel_fl` `wheel_fr` (반지름 0.48) / `wheel_rl` `wheel_rr` (반지름 0.64) — 차와 같은 이름이라 그대로 굴러갑니다
- 차체: `carriage_body` (고정)
- 애니메이션 `Idle` `Walk` `Gallop` — 말만 움직입니다
- `seat` = 마부석 (높이 1.5 m), 정적

## motorcycle.glb — 오토바이

클래식 바이크, 갈색 가죽 안장·새들백.

- `wheel_front`, `wheel_rear` (반지름 0.33)
- `steer` = 핸들·포크·헤드램프·앞 펜더. 원점이 조향축 위(높이 0.95), 수직축(glTF Y)으로 돌리면 됩니다
- **`wheel_front`는 `steer`의 자식** → 핸들만 돌리면 앞바퀴도 같이 꺾입니다. 굴림은 `wheel_front.rotation.x`
- `seat` 높이 1.07 m

## bicycle.glb — 자전거

옛날식 숙녀용 자전거, 짙은 초록 프레임 + 앞 바구니.

- `wheel_front`, `wheel_rear` (반지름 0.35), `wheel_front`는 `steer`의 자식
- `steer` = 핸들·포크·바구니·램프·앞 펜더 (원점 = 조향축, 높이 0.84)
- `pedals` = 크랭크·체인링·페달. 원점이 크랭크 축, 로컬 X로 돌리면 됩니다
- `seat` 높이 1.05 m

## 코드에 붙일 때 참고

- 차 로더는 `CAR_LEN / size.z` 로 크기를 맞춥니다. 이 파일들은 실제 미터라
  탈것마다 `CAR_LEN` 대신 길이를 따로 주거나 `scale = 1`로 두는 편이 자연스럽습니다.
- 오토바이·자전거 바퀴 이름은 `WHEEL_SPEC`에 없습니다 (`wheel_front` / `wheel_rear`).
- 말 액션은 `AnimationMixer`로 `Idle/Walk/Gallop`을 이름 그대로 찾으면 됩니다.
