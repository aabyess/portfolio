/* ════════════════════════════════════════════════════════════
   무기 12종 — 칼 · 도끼 · 망치 · 총 · 활 · 석궁 · 철퇴 · 투창 · 폭탄 · 프라이팬 · 바주카(-) · 박격포(=)
   ────────────────────────────────────────────────────────────
   걸어 다닐 때만 쓴다(운전 중엔 단축 바도 숨는다). 1~9, 0, -, = 로 고르고(같은 키 다시 = 집어넣기), 휠로 바꾸고,
   바주카: 클릭 = 조준 방향으로 로켓 → 닿으면 explode(5, 14). 박격포: 멈춰 서면 땅에 내려놓고(쪼그려 앉기),
   땅 위 목표 고리(8~35 m)로 클릭 = 높은 포물선 포탄 → 휘파람 소리 → explode(7, 16).
   손 쥐기: grip() 이 손목을 돌려 손바닥이 자루를 감싸게 하고 손가락 뼈(Index1~4R 등)를 말아 주먹을 쥔다.
   디버그(debug=true): __weapons.inspect(각도, 거리, 높이) = 사람 주위 고정 카메라 + 조준점 고정, inspect(null) = 끄기.
   G = 집어넣기/다시 꺼내기, 왼쪽 클릭 = 공격. 맨손(none)일 땐 npcs.js 의 잡기/때리기가 그대로 동작한다.
   피·상처 표현은 없다 — 맞으면 하얀 '퍽' 연기와 노란 불꽃, 넘어짐, 별 빙글빙글.

   팔·상체 자세는 tavern.js 의 createPoser(뼈 직접 굽히기 + 두 뼈 IK)로 매 프레임
   걷기 애니메이션 '위에' 덮어쓴다. 그래서 weapons.update 는 walk(dt) 다음에 불러야 한다.
   모델은 models/weapons/<id>.glb 가 있으면 쓰고, 없으면 코드로 만든 대체 모델을 쓴다.
   glb 규칙(대체 모델과 같음): 원점 = 손으로 쥐는 곳, +Y = 자루를 따라 머리/날 쪽,
   +Z = 날(공격면)/총구/쏘는 방향. 활은 +Y = 위 날개, +Z = 쏘는 방향. 다르면 GLB_FIX 만 고친다.

   ── portfolio.js 연결 방법 (PM용) ──────────────────────────────
   ① tavern 블록 다음 (camera, person, toyBlocks, groundY, draco 가 다 있는 곳):
        const { createWeapons, HUD_HINT: WEAPON_HINT } = await import('./weapons.js');
        const weapons = createWeapons({
          THREE, scene, camera, person, GLTFLoader, dracoLoader: draco,
          domElement: renderer.domElement,
          personClips: () => charClips,
          getNpcs: () => npcs,                       // npcs.knockDown(n, impulse, cause) 등을 쓴다 (아래 참고)
          toyBlocks,                                 // { mesh, body } — 맞으면 cannon 몸체에 속도를 더한다
          groundY,
          colliders: () => stations.map(s => s.group),   // 화살·투창이 박히는 물체 (수레·간판). 나무 메시를 더 넣어도 된다
          isBlocked: () => !driveActive || panelOpen(),
          canUse: () => player.mode === 'onfoot' && !tavern.seated,
        });
      tavern 의 onSit 에서 weapons.holster() 를 부르므로 tavern 보다 뒤에 만들어도 된다(onSit 은 나중에 불림).
      단, tavern 을 const 로 먼저 선언했다면 onSit 안의 weapons 는 TDZ 를 피하려고 let weapons = null; 로 미리 선언해 둘 것.

   ② step(dt) 에서 카메라 갱신(tavern.cameraStep 또는 updateCamera) "다음" 줄:
        weaponsIn.onFoot = player.mode === 'onfoot';
        weapons.update(dt, weaponsIn);              // 자세·무기·투사체·효과·카메라 흔들림
      step 밖에 한 번: const weaponsIn = { onFoot: false };
      (walk(dt) 보다 뒤, 렌더 전이면 된다. 카메라 흔들림을 얹으므로 카메라 갱신 뒤가 좋다)

   ③ npcs 잡기(attachGrab)의 isBlocked 에 무기를 더한다:
        isBlocked: () => !driveActive || panel.classList.contains('open') || weapons.armed,

   ④ 안내 문구: WEAPON_HINT = "1~0·-·= 무기 · 휠 바꾸기 · 클릭 공격 · G 집어넣기"

   ── npcs.js API (있으면 쓰고, 없으면 대체 동작) ──
     npcs.npcs                 : 배열, 각 n 에 x, y, z (발 위치), rot, off
     npcs.knockDown(n, imp, cause)   imp = THREE.Vector3 (m/s), cause = 'sword'|'axe'|'hammer'|'shot'|'arrow'|
                                     'bolt'|'flail'|'javelin'|'explosion'|'pan'  → 넘어지고 일어남
     npcs.alarm(pos, 0, kind)  총('shot')·폭탄 투척('bomb')·폭발('explosion') 때 부른다 → 손님들이 도망
     npcs.stagger(n, dx, dz, cause)  (아직 export 안 됨 — npcs.js 내부 stagger 를 그대로 내보내 주면 칼 첫 타가 휘청이 된다.
                                     없으면 살짝 밀기만)
     npcs.spin(n, turns, sec)  (선택) 프라이팬 — 없으면 n.rot 을 직접 돌린 뒤 knockDown
     ※ npcs.js 의 emit 은 cause 'shot' 만 'weapon' 으로 바꾼다. 다른 무기 cause 도 수배(events)에 잡히게 하려면
       npcs.js 쪽에서 모르는 cause 를 'weapon' 으로 묶거나, 아래 onHit 옵션에서 events.notify('weapon', ...) 를 부른다.
     createWeapons 옵션 onNoise(kind, pos) / onHit(npc, cause) — 수배(events.notify) 연결용:
        onNoise: (k, p) => { if (events) events.notify(k === 'bomb' ? 'shot' : k, p); },

   ── 다른 모듈용: weapons.explode(pos, radius = 5, force = 12) ──
     pos 는 {x,y,z}(THREE.Vector3 등). 반경 안 손님은 바깥으로 날아가 넘어지고(knockDown 'explosion'),
     장난감 블록·의자는 튕겨 나가며, 섬광·불덩이·연기·충격파 고리·카메라 흔들림·'쾅' 소리가 난다.
     탱크 포탄 등: weapons.explode(hitPoint, 4, 10)
   ════════════════════════════════════════════════════════════ */
import { createPoser } from './tavern.js';

const D2R = Math.PI / 180;
export const HUD_HINT = '` 주먹 · 1~0·-·= 무기 · 휠 바꾸기 · 클릭 공격 · G 집어넣기';

export const WEAPONS = [
  { id: 'sword',    key: '1', name: '칼' },
  { id: 'axe',      key: '2', name: '도끼' },
  { id: 'hammer',   key: '3', name: '망치' },
  { id: 'pistol',   key: '4', name: '총' },
  { id: 'bow',      key: '5', name: '활' },
  { id: 'crossbow', key: '6', name: '석궁' },
  { id: 'flail',    key: '7', name: '철퇴' },
  { id: 'javelin',  key: '8', name: '투창' },
  { id: 'bomb',     key: '9', name: '폭탄' },
  { id: 'pan',      key: '0', name: '프라이팬' },
  { id: 'bazooka',  key: '-', name: '바주카' },
  { id: 'mortar',   key: '=', name: '박격포' },
];
const KEY_CODE = { Minus: '-', NumpadSubtract: '-', Equal: '=', NumpadAdd: '=' };
const FIST = { id: 'none', key: '`', name: '주먹' };   // 단축 바 맨 앞 칸: 무기를 내려놓고 맨손(주먹·잡기)으로
const BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));
const RANGED = { pistol: 1, bow: 1, crossbow: 1, bazooka: 1 };   // 늘 조준 방향을 본다
/* 바주카: 모델 원점 = 오른손 권총 손잡이, 통 축은 원점 위 tubeY, +Z 앞 */
const BAZ = { reload: 1.4, speed: 30, range: 70, radius: 5, force: 14, tubeY: 0.11, len: 1.15 };
/* 박격포: 모델 원점 = 바닥판 가운데, 통은 앞으로 30° 기울어 있다 */
const MORTAR = { reload: 3.2, min: 8, max: 35, radius: 7, force: 16, tilt: 30, tube: 0.95, drop: 0.32 };
/* glb 가 대체 모델과 규칙이 다를 때 고칠 곳 (라디안·미터) */
/* tools/blender/weapons 의 glb 는 Blender 에서 '자루 = +Y, 앞 = +Z' 로 만들었는데 glTF 내보내기(Y-up)가
   Blender +Y → glTF -Z, Blender +Z → glTF +Y 로 바꾼다. 그래서 X 축으로 +90° 돌려 규칙(+Y 자루, +Z 앞)에 맞춘다.
   화살(arrow.glb)은 처음부터 glTF +Z 로 만들어서 그대로. */
const R90 = [Math.PI / 2, 0, 0];
const GLB_FIX = {
  sword: { rot: R90 }, axe: { rot: R90 }, hammer: { rot: R90 }, pistol: { rot: R90 }, bow: { rot: R90 },
  arrow: {},
  /* tools/blender/weapons/extra_weapons.py — 대체 모델과 같은 좌표로 만들어서 muzzle·tips·anchor·fuse·front·rear·hold 를 그대로 쓴다.
     따로 쓰는 부품(빈 이름으로 찾음): crossbow 'bolt', flail 'ball'·'link', bazooka 'rocket', mortar 'shell' */
  crossbow: { rot: R90 }, flail: { rot: R90 }, javelin: { rot: R90 }, bomb: { rot: R90 }, pan: { rot: R90 },
  bazooka: { rot: R90 }, mortar: { rot: R90 },
};
const HAS_GLB = new Set(Object.keys(GLB_FIX));   // 파일이 있는 것만 불러온다 (없는 파일 404 를 콘솔에 남기지 않게)

/* 근접 공격 키프레임 (사람 공간: 앞 +Z, 위 +Y, 캐릭터 왼쪽 +X → 오른쪽은 x 음수)
   hand = 오른손 목표, blade = 자루→날 방향, tw = 가슴 비틀기(+왼쪽), pt = 가슴 숙이기(+앞) */
const K = (t, hand, blade, tw = 0, pt = 0) => ({ t, hand, blade, tw, pt });
const MELEE = {
  sword: { dur: 0.36, hitAt: 0.5, trail: [0.3, 0.72], len: 0.84, two: false, range: 1.9, cone: 100, sound: 'whoosh',
    keys: [K(0, [-0.28, 1.0, 0.30], [-0.12, 0.72, 0.68]), K(0.25, [-0.46, 1.5, 0.02], [-0.45, 0.8, -0.4], -25, -4),
      K(0.55, [0.22, 1.08, 0.55], [0.9, 0.05, 0.45], 25, 8), K(0.8, [0.32, 0.95, 0.32], [0.8, -0.35, -0.1], 30, 6),
      K(1, [-0.28, 1.0, 0.30], [-0.12, 0.72, 0.68])] },
  axe: { dur: 1.0, hitAt: 0.86, trail: [0.72, 0.92], len: 0.66, two: true, range: 1.8, cone: 70, sound: 'whooshHeavy',
    keys: [K(0, [-0.26, 1.0, 0.3], [0, 0.85, 0.5]), K(0.55, [-0.12, 1.95, -0.04], [0, 0.35, -0.95], 0, -12),
      K(0.72, [-0.12, 2.0, -0.1], [0, 0.2, -1], 0, -14), K(0.86, [-0.1, 0.82, 0.62], [0, -0.55, 0.85], 0, 20),
      K(1, [-0.26, 1.0, 0.3], [0, 0.85, 0.5])] },
  hammer: { dur: 0.82, hitAt: 0.56, trail: [0.38, 0.74], len: 0.82, two: true, range: 2.2, cone: 140, sound: 'whooshHeavy',
    keys: [K(0, [-0.24, 1.28, 0.2], [0.05, 0.7, -0.7]), K(0.35, [-0.56, 1.2, -0.2], [-0.85, 0.3, -0.4], -45),
      K(0.62, [0.45, 1.15, 0.45], [0.8, 0.1, 0.6], 45, 6), K(0.8, [0.5, 1.12, 0.12], [0.7, 0.2, -0.6], 55),
      K(1, [-0.24, 1.28, 0.2], [0.05, 0.7, -0.7])] },
  pan: { dur: 0.46, hitAt: 0.56, trail: [0.35, 0.68], len: 0.42, two: false, range: 1.7, cone: 90, sound: 'whoosh',
    keys: [K(0, [-0.28, 1.02, 0.3], [0.05, 0.6, 0.8]), K(0.3, [-0.5, 1.38, -0.05], [-0.5, 0.75, -0.3], -30),
      K(0.6, [0.12, 1.38, 0.55], [0.4, 0.7, 0.55], 20, 6), K(1, [-0.28, 1.02, 0.3], [0.05, 0.6, 0.8])] },
};
const HOLD = {   // 근접 무기가 아닌 것의 평소 손 위치
  flail:   K(0, [-0.3, 1.0, 0.32], [0.05, 0.8, 0.5]),
  javelin: K(0, [-0.3, 1.0, 0.25], [0, 0.95, 0.3]),
  bomb:    K(0, [-0.3, 1.05, 0.34], [0, 1, 0.2]),
};
const BOMB_THROW = { dur: 0.5, rel: 0.62,
  keys: [K(0, [-0.3, 1.05, 0.34], [0, 1, 0.2]), K(0.4, [-0.36, 1.72, -0.28], [0, 0.6, -0.8], -20, -8),
    K(0.65, [-0.2, 1.5, 0.55], [0, 0.4, 0.9], 15, 10), K(1, [-0.3, 1.05, 0.34], [0, 1, 0.2])] };

export function createWeapons({
  THREE, scene, camera, person, personClips, domElement = null, getNpcs = null, toyBlocks = [],
  groundY = () => 0, colliders = null, GLTFLoader = null, dracoLoader = null, baseUrl = 'models/weapons/',
  isBlocked = null, canUse = null, onImpulse = null, onExplode = null, onNoise = null, onHit = null, debug = true,
}) {
  const V = THREE.Vector3, Q = THREE.Quaternion;
  const poser = createPoser({ THREE, person, personClips });
  const _v = new V(), _v2 = new V(), _v3 = new V(), _v4 = new V(), _v5 = new V(), _v6 = new V();
  const _hand = new V(), _blade = new V(), _edge = new V(), _pole = new V(), _tgt = new V(), _tgt2 = new V();
  const _m = new THREE.Matrix4(), _q = new Q(), _bx = new V(), _by = new V(), _bz = new V();
  const UP = new V(0, 1, 0);
  const smooth = x => x * x * (3 - 2 * x);
  const angLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, t);
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ════ 재질·대체 모델 ════ */
  const M = {
    steel: new THREE.MeshStandardMaterial({ color: 0xc4cad2, roughness: 0.28, metalness: 0.85 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x3b3c40, roughness: 0.5, metalness: 0.7 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.75 }),
    woodL: new THREE.MeshStandardMaterial({ color: 0xb08356, roughness: 0.7 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x4e3020, roughness: 0.85 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.8 }),
    red: new THREE.MeshStandardMaterial({ color: 0xb03a2e, roughness: 0.7 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.8, side: THREE.DoubleSide }),
    bomb: new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.45, metalness: 0.35 }),
    rope: new THREE.MeshStandardMaterial({ color: 0xcdb48a, roughness: 0.9 }),
    olive: new THREE.MeshStandardMaterial({ color: 0x5d6b3a, roughness: 0.62, metalness: 0.15 }),
    oliveD: new THREE.MeshStandardMaterial({ color: 0x3e4826, roughness: 0.6, metalness: 0.2 }),
    black: new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.55, metalness: 0.3 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xe8b43a, roughness: 0.6 }),
    redP: new THREE.MeshStandardMaterial({ color: 0xc8402e, roughness: 0.55 }),
  };
  const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
  const cyl = (r1, r2, h, m, x = 0, y = 0, z = 0, seg = 10) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); return o; };
  const alongZ = o => { o.rotation.x = Math.PI / 2; return o; };
  /* p0 → p1 막대 */
  const rod = (p0, p1, r, m, seg = 8) => {
    const a = new V(...p0), b = new V(...p1), o = cyl(r, r, a.distanceTo(b), m, 0, 0, 0, seg);
    o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new V(0, 1, 0), b.sub(a).normalize()); return o;
  };
  const tube = (pts, r, m) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new V(...p))), 24, r, 6), m);

  function makeArrow(len = 0.75, bolt = false) {
    const g = new THREE.Group();
    g.add(alongZ(cyl(0.005, 0.005, len, bolt ? M.wood : M.woodL, 0, 0, len / 2, 5)));
    const head = alongZ(new THREE.Mesh(new THREE.ConeGeometry(bolt ? 0.014 : 0.011, 0.055, 6), M.iron)); head.position.z = len + 0.02; g.add(head);
    for (let i = 0; i < 3; i++) {   // 깃 3장 — 화살대를 품은 평면
      const f = new THREE.Mesh(new THREE.PlaneGeometry(bolt ? 0.06 : 0.1, 0.028), i ? M.white : M.red);
      f.rotation.y = Math.PI / 2; f.position.set(0, 0.016, bolt ? 0.045 : 0.075);
      const piv = new THREE.Group(); piv.rotation.z = i * Math.PI * 2 / 3;
      piv.add(f); g.add(piv);
    }
    g.userData.len = len + 0.05;
    return g;
  }
  const MAKERS = {
    sword() {
      const g = new THREE.Group();
      g.add(cyl(0.017, 0.017, 0.15, M.leather), new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), M.brass));
      g.children[1].position.y = -0.09;
      g.add(box(0.035, 0.026, 0.22, M.brass, 0, 0.085, 0));
      g.add(box(0.008, 0.72, 0.046, M.steel, 0, 0.46, 0));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.033, 0.09, 4), M.steel); tip.scale.set(0.25, 1, 1); tip.position.y = 0.865; g.add(tip);
      g.add(box(0.01, 0.6, 0.012, M.iron, 0, 0.42, 0));   // 홈(fuller)
      return g;
    },
    axe() {
      const g = new THREE.Group();
      g.add(cyl(0.019, 0.022, 0.78, M.wood, 0, 0.28, 0));
      g.add(box(0.04, 0.1, 0.12, M.iron, 0, 0.6, 0.03));
      const bit = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.014, 16, 1, false, -0.7, 1.4), M.steel);
      bit.rotation.z = Math.PI / 2; bit.position.set(0, 0.6, 0.02); g.add(bit);
      g.add(box(0.03, 0.05, 0.05, M.iron, 0, 0.6, -0.06));
      return g;
    },
    hammer() {
      const g = new THREE.Group();
      g.add(cyl(0.021, 0.024, 0.92, M.wood, 0, 0.34, 0));
      g.add(box(0.17, 0.17, 0.32, M.iron, 0, 0.8, 0));
      for (const z of [-0.12, 0.12]) g.add(box(0.18, 0.18, 0.03, M.brass, 0, 0.8, z));
      g.add(cyl(0.025, 0.025, 0.12, M.leather, 0, -0.02, 0));
      return g;
    },
    pistol() {
      const g = new THREE.Group();
      g.add(alongZ(cyl(0.014, 0.016, 0.3, M.iron, 0, 0.05, 0.17)));
      g.add(box(0.036, 0.034, 0.25, M.wood, 0, 0.026, 0.12));
      const grip = box(0.034, 0.13, 0.05, M.wood, 0, -0.045, -0.035); grip.rotation.x = -0.45; g.add(grip);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), M.brass); cap.position.set(0, -0.1, -0.07); cap.scale.set(0.9, 0.8, 1); g.add(cap);
      g.add(box(0.006, 0.032, 0.075, M.iron, -0.021, 0.05, 0.02));
      const cock = box(0.008, 0.04, 0.012, M.iron, -0.022, 0.085, -0.005); cock.rotation.x = -0.5; g.add(cock);
      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 5, 10, Math.PI), M.brass);
      guard.rotation.set(0, Math.PI / 2, Math.PI); guard.position.set(0, 0.008, 0.02); g.add(guard);
      g.add(alongZ(cyl(0.004, 0.004, 0.24, M.woodL, 0, 0.004, 0.17, 5)));
      g.userData.muzzle = new V(0, 0.05, 0.33);
      g.userData.gripAxis = new V(0, 0.9, 0.43).normalize();   // 손잡이는 아래-뒤로 기운다
      return g;
    },
    bow() {
      const g = new THREE.Group();
      const limb = tube([[0, -0.66, -0.17], [0, -0.36, -0.05], [0, 0, 0], [0, 0.36, -0.05], [0, 0.66, -0.17]], 0.012, M.wood);
      g.add(limb, cyl(0.017, 0.017, 0.12, M.leather));
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
      const str = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: 0xeee6d0 })); str.frustumCulled = false;
      g.add(str); g.userData.string = str; g.userData.tips = [new V(0, 0.66, -0.17), new V(0, -0.66, -0.17)];
      return g;
    },
    crossbow() {
      const g = new THREE.Group();
      g.add(box(0.05, 0.06, 0.62, M.wood, 0, 0, 0.1));
      const butt = box(0.05, 0.1, 0.14, M.wood, 0, -0.03, -0.18); butt.rotation.x = 0.25; g.add(butt);
      g.add(tube([[-0.33, 0.02, 0.3], [-0.17, 0.02, 0.37], [0, 0.02, 0.39], [0.17, 0.02, 0.37], [0.33, 0.02, 0.3]], 0.012, M.iron));
      const stir = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 5, 12), M.iron); stir.position.set(0, 0.0, 0.45); stir.rotation.x = Math.PI / 2; g.add(stir);
      g.add(box(0.012, 0.05, 0.02, M.iron, 0, -0.045, 0.0));
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
      const str = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: 0xeee6d0 })); str.frustumCulled = false;
      g.add(str); g.userData.string = str; g.userData.tips = [new V(-0.33, 0.02, 0.3), new V(0.33, 0.02, 0.3)];
      const bolt = makeArrow(0.36, true); bolt.position.set(0, 0.045, 0.02); g.add(bolt); g.userData.bolt = bolt;
      g.userData.muzzle = new V(0, 0.045, 0.42);
      return g;
    },
    flail() {
      const g = new THREE.Group();
      g.add(cyl(0.02, 0.024, 0.42, M.wood, 0, 0.12, 0));
      g.add(cyl(0.026, 0.026, 0.04, M.iron, 0, 0.34, 0));
      g.add(cyl(0.025, 0.025, 0.1, M.leather, 0, -0.04, 0));
      g.userData.anchor = new V(0, 0.36, 0);
      return g;
    },
    javelin() {
      const g = new THREE.Group();
      g.add(alongZ(cyl(0.012, 0.013, 1.8, M.woodL, 0, 0, 0.15, 7)));
      const head = alongZ(new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.2, 4), M.steel)); head.position.z = 1.14; head.scale.set(1, 1, 0.35); g.add(head);
      g.add(alongZ(cyl(0.017, 0.017, 0.18, M.leather)));
      g.userData.len = 1.25;
      return g;
    },
    bomb() {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), M.bomb));
      g.add(cyl(0.028, 0.03, 0.03, M.brass, 0, 0.085, 0));
      const fuse = tube([[0, 0.09, 0], [0.01, 0.12, 0.01], [0.03, 0.15, 0.0]], 0.006, M.rope); g.add(fuse);
      g.userData.fuse = new V(0.03, 0.155, 0);
      return g;
    },
    bazooka() {   // 만화풍 바주카 — 원점 = 오른손 권총 손잡이
      const g = new THREE.Group(), T = BAZ.tubeY;
      g.add(alongZ(cyl(0.064, 0.064, BAZ.len, M.olive, 0, T, 0.08, 16)));
      g.add(alongZ(cyl(0.08, 0.072, 0.09, M.oliveD, 0, T, 0.08 + BAZ.len / 2 - 0.02, 16)));      // 앞 테
      g.add(alongZ(cyl(0.066, 0.092, 0.16, M.oliveD, 0, T, 0.08 - BAZ.len / 2 - 0.05, 16)));    // 뒤 나팔
      g.add(alongZ(cyl(0.067, 0.067, 0.05, M.yellow, 0, T, 0.45, 16)));                          // 노란 띠
      g.add(alongZ(cyl(0.067, 0.067, 0.03, M.redP, 0, T, 0.5, 16)));
      g.add(box(0.1, 0.04, 0.2, M.leather, 0, T - 0.07, -0.22));                                 // 어깨 받침
      const grip = box(0.036, 0.12, 0.052, M.black, 0, -0.005, -0.01); grip.rotation.x = 0.22; g.add(grip);
      g.add(box(0.03, 0.03, 0.12, M.black, 0, T - 0.07, 0.02));
      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.005, 5, 10, Math.PI), M.black);
      guard.rotation.set(0, Math.PI / 2, Math.PI); guard.position.set(0, 0.03, 0.04); g.add(guard);
      g.add(cyl(0.02, 0.022, 0.12, M.black, 0, -0.005, 0.3));                                    // 앞 손잡이
      g.add(box(0.03, 0.03, 0.05, M.black, 0, T - 0.07, 0.3));
      g.add(box(0.02, 0.06, 0.03, M.black, 0.075, T + 0.03, 0.22));                              // 조준기 (왼쪽)
      g.add(box(0.012, 0.02, 0.02, M.black, 0.075, T + 0.07, 0.22));
      const rocket = new THREE.Group();                                                          // 장전된 탄두 (앞에 살짝 보인다)
      const nose = alongZ(new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 14), M.redP)); nose.position.z = 0.08; rocket.add(nose);
      rocket.add(alongZ(cyl(0.055, 0.055, 0.04, M.oliveD, 0, 0, -0.01, 14)));
      rocket.position.set(0, T, 0.08 + BAZ.len / 2 + 0.02); g.add(rocket);
      g.userData.rocket = rocket;
      g.userData.muzzle = new V(0, T, 0.08 + BAZ.len / 2 + 0.03);
      g.userData.rear = new V(0, T, 0.08 - BAZ.len / 2 - 0.12);
      g.userData.front = new V(0, 0.0, 0.3);
      return g;
    },
    mortar() {   // 만화풍 박격포 — 원점 = 바닥판 가운데, +Y = 통(앞으로 30° 기운 상태에서), +Z = 앞
      const g = new THREE.Group(), tl = MORTAR.tilt * D2R, L = MORTAR.tube;
      const plate = cyl(0.21, 0.23, 0.035, M.oliveD, 0, 0, 0, 18); plate.rotation.x = -tl; g.add(plate);
      const rib = box(0.4, 0.03, 0.05, M.olive, 0, 0.02, 0); rib.rotation.x = -tl; g.add(rib);
      g.add(cyl(0.05, 0.058, L, M.olive, 0, L / 2 + 0.02, 0, 16));
      g.add(cyl(0.068, 0.068, 0.06, M.oliveD, 0, L - 0.0, 0, 16));                                // 포구 테
      g.add(cyl(0.062, 0.062, 0.05, M.yellow, 0, L * 0.72, 0, 16));
      const blk = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), M.black); blk.rotation.x = -Math.PI / 2; blk.position.y = L + 0.031; g.add(blk);
      g.add(box(0.12, 0.05, 0.08, M.oliveD, 0, L * 0.6, 0.03));                                   // 받침 고리
      // 두 다리 (바닥 앞쪽으로 — 30° 기울기에 맞춘 로컬 좌표)
      const fy = 0.45 * Math.sin(tl), fz = 0.45 * Math.cos(tl);
      for (const sx of [-1, 1]) {
        g.add(rod([sx * 0.03, L * 0.6, 0.05], [sx * 0.22, fy, fz], 0.013, M.iron));
        const foot = box(0.05, 0.015, 0.06, M.iron, sx * 0.22, fy, fz); foot.rotation.x = -tl; g.add(foot);
      }
      g.add(rod([-0.03, L * 0.6 - 0.1, 0.07], [0.03, L * 0.6 - 0.1, 0.07], 0.01, M.iron));
      g.add(rod([0, L * 0.6 - 0.1, 0.07], [0, L * 0.6 - 0.02, 0.18], 0.008, M.iron));             // 높이 조절 손잡이
      g.userData.muzzle = new V(0, L + 0.04, 0);
      g.userData.hold = new V(0, L * 0.78, 0);           // 왼손이 잡는 곳
      return g;
    },
    pan() {
      const g = new THREE.Group();
      g.add(cyl(0.013, 0.016, 0.3, M.iron, 0, 0.08, 0));
      g.add(cyl(0.018, 0.018, 0.12, M.wood, 0, -0.03, 0));
      const dish = alongZ(cyl(0.15, 0.13, 0.035, M.iron, 0, 0.38, 0, 18)); g.add(dish);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.008, 6, 22), M.iron); rim.position.set(0, 0.38, 0.016); g.add(rim);
      return g;
    },
  };
  /* 무기 모델 (손에 든 것) */
  const models = {};
  const holder = new THREE.Group(); holder.name = 'weapon-in-hand'; scene.add(holder);
  function prepModel(g) { g.traverse(o => { if (o.isMesh) { o.castShadow = true; } }); g.visible = false; holder.add(g); return g; }
  for (const w of WEAPONS) models[w.id] = prepModel(MAKERS[w.id]());
  let nocked = prepModel(makeArrow()); // 활에 걸린 화살 (arrow.glb 가 오면 바뀐다)
  const loader = GLTFLoader ? new GLTFLoader() : null;
  if (loader && dracoLoader) loader.setDRACOLoader(dracoLoader);
  const tried = {};
  /* glb 안의 따로 쓰는 부품을 떼어 R90 을 씌운 묶음으로 돌려준다 (원점·방향은 extra_weapons.py 머리말 참고) */
  const _eR90 = new THREE.Euler(...R90);
  function takePart(m, name) {
    const n = m.getObjectByName(name); if (!n || !n.parent) return null;
    n.parent.remove(n);
    const p = n.position.clone().applyEuler(_eR90);   // glTF 좌표 → 모델 좌표
    n.position.set(0, 0, 0);
    const inner = new THREE.Group(); inner.rotation.set(...R90); inner.add(n);
    const w = new THREE.Group(); w.name = name; w.add(inner); w.position.copy(p);
    w.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return w;
  }
  /* 미리 만든 묶음(ROCKET·SHELL·flailBall 등)의 모양만 부품으로 바꾼다 — 참조는 그대로 */
  function swapShape(group, part) {
    while (group.children.length) group.remove(group.children[0]);
    const c = part.clone(true); c.position.set(0, 0, 0); group.add(c);
  }
  function tryGlb(id) {
    if (!loader || tried[id] || !HAS_GLB.has(id)) return;
    tried[id] = true;
    loader.load(baseUrl + id + '.glb', gltf => {
      const fix = GLB_FIX[id] || {};
      const g = new THREE.Group(), m = gltf.scene;
      if (fix.rot) m.rotation.set(...fix.rot); if (fix.pos) m.position.set(...fix.pos); if (fix.scale) m.scale.setScalar(fix.scale);
      g.add(m);
      if (id === 'arrow') {   // 활에 거는 화살 + 날아가는 화살(복제) 모양
        g.userData.len = nocked.userData.len;
        const vis = nocked.visible; holder.remove(nocked); nocked = prepModel(g); nocked.visible = vis;
        return;
      }
      // 활 glb 의 시위(뼈대로 당기는 메시)는 숨기고 코드 시위(선)를 쓴다 — 당김 정도를 코드가 그린다
      if (id === 'bow') m.traverse(o => { if (o.isMesh && /string/i.test(o.name)) o.visible = false; });
      const old = models[id];
      for (const k of ['muzzle', 'anchor', 'fuse', 'len', 'tips', 'rear', 'front', 'hold']) if (old.userData[k] !== undefined) g.userData[k] = old.userData[k];
      if (id === 'crossbow') {   // 장전된 볼트 = 쏘면 복제돼 날아간다 (+Z 앞, 원점 = 꼬리)
        const bolt = takePart(m, 'bolt');
        if (bolt) { bolt.userData.len = 0.41; g.add(bolt); g.userData.bolt = bolt; }
      }
      if (id === 'flail') {      // 사슬 끝 공 + 사슬 고리 (선 대신 고리를 늘어놓는다)
        const b = takePart(m, 'ball'), l = takePart(m, 'link');
        if (b) swapShape(flailBall, b);
        if (l) setChainLinks(l);
      }
      if (id === 'bazooka') {    // 통 앞에 보이는 탄두 + 날아가는 로켓 모양
        const rk = takePart(m, 'rocket');
        if (rk) { g.add(rk); g.userData.rocket = rk; swapShape(ROCKET, rk); }
      }
      if (id === 'mortar') {     // 오른손에 든 포탄 + 날아가는 포탄 모양
        const sh = takePart(m, 'shell');
        if (sh) { swapShape(SHELL, sh); swapShape(shellHand, sh); }
      }
      if (id === 'pistol') {   // glb 총은 '손잡이 = +Y' 라 총열이 기울어 있다 → 총열(muzzle 빈 객체의 +Z)이 +Z 가 되게 X 축으로 돌린다
        const mz = m.getObjectByName('muzzle');
        g.userData.gripAxis = new V(0, 1, 0);
        if (mz) {
          g.updateMatrixWorld(true);
          const mp = mz.getWorldPosition(new V()), fw = new V(0, 0, 1).applyQuaternion(mz.getWorldQuaternion(new Q()));
          const corr = new Q().setFromAxisAngle(new V(1, 0, 0), Math.atan2(fw.y, fw.z));
          g.remove(m); const c = new THREE.Group(); c.quaternion.copy(corr); c.add(m); g.add(c);
          g.userData.muzzle = mp.applyQuaternion(corr);
          g.userData.gripAxis.applyQuaternion(corr);
        }
      }
      // 활·석궁 시위와 석궁 볼트는 대체 모델 것을 계속 쓴다 (glb 에 없으면)
      if (old.userData.string) { g.add(old.userData.string); g.userData.string = old.userData.string; }
      if (old.userData.bolt && !g.userData.bolt) { g.add(old.userData.bolt); g.userData.bolt = old.userData.bolt; }
      holder.remove(old); models[id] = prepModel(g);
    }, undefined, () => { /* 없으면 대체 모델 */ });
  }

  /* ════ 효과 ════ */
  function radialTex(inner, outer, size = 64) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, inner); gr.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.5)')); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const puffTex = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  const starTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.translate(32, 32); g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 27, a = i * Math.PI / 5 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fillStyle = '#ffd84a'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#a8701a'; g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const PN = 140, parts = [];
  for (let i = 0; i < PN; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false }));
    sp.visible = false; sp.renderOrder = 5; scene.add(sp);
    parts.push({ sp, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s0: 0.1, s1: 0.3, a0: 1, grav: 0, drag: 0 });
  }
  let pIdx = 0;
  function puff(x, y, z, vx, vy, vz, color, s0, s1, life, a0 = 0.8, add = false, grav = 0, drag = 1.5) {
    const p = parts[pIdx]; pIdx = (pIdx + 1) % PN;
    p.sp.position.set(x, y, z); p.vx = vx; p.vy = vy; p.vz = vz; p.life = 0; p.max = life;
    p.s0 = s0; p.s1 = s1; p.a0 = a0; p.grav = grav; p.drag = drag;
    const m = p.sp.material; m.color.setHex(color); m.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.opacity = a0; p.sp.scale.setScalar(s0); p.sp.visible = true; p.sp.material.rotation = Math.random() * 6.28;
  }
  function sparks(x, y, z, n, color = 0xffc14a, spd = 4) {
    for (let i = 0; i < n; i++) puff(x, y, z, rand(-1, 1) * spd, rand(0.3, 1.4) * spd, rand(-1, 1) * spd, color, 0.06, 0.02, rand(0.25, 0.5), 1, true, 12, 0.5);
  }
  function smoke(x, y, z, n, color = 0xd8d4cc, size = 0.5, spread = 0.6, up = 0.6, life = 1.6) {
    for (let i = 0; i < n; i++) puff(x + rand(-0.1, 0.1), y + rand(-0.1, 0.1), z + rand(-0.1, 0.1),
      rand(-1, 1) * spread, rand(0.2, 1) * up, rand(-1, 1) * spread, color, size * 0.4, size * rand(1.4, 2.2), life * rand(0.7, 1.2), 0.55, false, -0.3, 1.8);
  }
  function stepParts(dt) {
    for (const p of parts) {
      if (!p.sp.visible) continue;
      p.life += dt;
      const k = p.life / p.max;
      if (k >= 1) { p.sp.visible = false; continue; }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.grav * dt;
      p.sp.position.x += p.vx * dt; p.sp.position.y += p.vy * dt; p.sp.position.z += p.vz * dt;
      const gy = groundY(p.sp.position.x, p.sp.position.z);
      if (p.sp.position.y < gy + 0.02) { p.sp.position.y = gy + 0.02; p.vy = Math.abs(p.vy) * 0.3; }
      p.sp.scale.setScalar(p.s0 + (p.s1 - p.s0) * (1 - (1 - k) * (1 - k)));
      p.sp.material.opacity = p.a0 * (1 - k) * (k < 0.08 ? k / 0.08 : 1);
    }
  }
  /* 섬광 조명 — 장면의 조명 개수를 바꾸지 않게 처음부터 넣어 두고 밝기만 바꾼다 */
  const flashLight = new THREE.PointLight(0xffb060, 0, 14, 2); scene.add(flashLight);
  let flashI = 0;
  function flash(x, y, z, i) { flashLight.position.set(x, y, z); flashI = Math.max(flashI, i); }
  /* 충격파 고리 */
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    r.rotation.x = -Math.PI / 2; r.visible = false; scene.add(r); rings.push({ r, t: 0, max: 0.6, size: 5 });
  }
  let ringIdx = 0;
  function shockRing(x, y, z, size, life = 0.55, color = 0xfff0d0) {
    const R = rings[ringIdx]; ringIdx = (ringIdx + 1) % rings.length;
    R.r.position.set(x, y + 0.05, z); R.t = 0; R.max = life; R.size = size; R.r.visible = true; R.r.material.color.setHex(color);
  }
  /* 휘두르기 자국 (얇은 리본) */
  const TN = 22;
  const trailPos = new Float32Array(TN * 2 * 3), trailCol = new Float32Array(TN * 2 * 4), trailT = new Float32Array(TN).fill(-9);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 4).setUsage(THREE.DynamicDrawUsage));
  { const idx = []; for (let i = 0; i < TN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx); }
  const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  trail.frustumCulled = false; scene.add(trail);
  let trailCount = 0, clock = 0;
  function trailPush(base, tip) {
    trailPos.copyWithin(6, 0, (TN - 1) * 6); trailT.copyWithin(1, 0, TN - 1);
    trailPos[0] = base.x; trailPos[1] = base.y; trailPos[2] = base.z; trailPos[3] = tip.x; trailPos[4] = tip.y; trailPos[5] = tip.z;
    trailT[0] = clock; trailCount = Math.min(TN, trailCount + 1);
  }
  function trailUpdate() {
    for (let i = 0; i < TN; i++) {
      const age = clock - trailT[i], a = i < trailCount ? Math.max(0, 1 - age / 0.2) * (1 - i / TN) : 0;
      const o = i * 8;
      trailCol[o] = trailCol[o + 4] = 1; trailCol[o + 1] = trailCol[o + 5] = 0.95; trailCol[o + 2] = trailCol[o + 6] = 0.85;
      trailCol[o + 3] = a * 0.08; trailCol[o + 7] = a * 0.55;
    }
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
  }
  /* 별 (프라이팬) */
  const stars = [];
  for (let i = 0; i < 12; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false })); s.scale.setScalar(0.22); s.visible = false; scene.add(s); stars.push(s); }
  const dizzy = [];   // { n, t, rot0, spun }

  /* ════ 소리 (WebAudio 합성, 파일 없음) ════ */
  let ac = null, master = null, noiseBuf = null, echo = null;
  function audio() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 6;
      master = ac.createGain(); master.gain.value = 0.7; master.connect(comp).connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // 숲 메아리
      const dl = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter();
      dl.delayTime.value = 0.22; fb.gain.value = 0.28; lp.type = 'lowpass'; lp.frequency.value = 1400;
      dl.connect(lp).connect(fb).connect(dl); lp.connect(master); echo = ac.createGain(); echo.gain.value = 0.5; echo.connect(dl);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function noise(t, dur, type, f0, f1, peak, a = 0.005, q = 1, toEcho = false) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); env(g, t, a, peak, dur);
    s.connect(f).connect(g).connect(master); if (toEcho) g.connect(echo);
    s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
    return g;
  }
  function tone(t, type, f0, f1, dur, peak, a = 0.004, toEcho = false) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    env(g, t, a, peak, dur); o.connect(g).connect(master); if (toEcho) g.connect(echo);
    o.start(t); o.stop(t + a + dur + 0.05);
  }
  const SND = {
    whoosh(k = 1) { const a = audio(); if (!a) return; const t = a.currentTime; noise(t, 0.22, 'bandpass', 500, 2400 * k, 0.35, 0.06, 2.2); },
    whooshHeavy() { const a = audio(); if (!a) return; const t = a.currentTime; noise(t, 0.34, 'bandpass', 260, 1100, 0.45, 0.09, 1.6); },
    thud(k = 1) { const a = audio(); if (!a) return; const t = a.currentTime; tone(t, 'sine', 140 * k, 45, 0.22, 0.7); noise(t, 0.12, 'lowpass', 900, 200, 0.4); },
    knock() { const a = audio(); if (!a) return; const t = a.currentTime; tone(t, 'triangle', 420, 180, 0.09, 0.35); noise(t, 0.05, 'bandpass', 1800, 900, 0.25, 0.002, 3); },
    clank() { const a = audio(); if (!a) return; const t = a.currentTime; tone(t, 'square', 880, 760, 0.12, 0.12); noise(t, 0.08, 'highpass', 3000, 2000, 0.25); },
    bang() {
      const a = audio(); if (!a) return; const t = a.currentTime;
      noise(t, 0.05, 'highpass', 4000, 2500, 0.9, 0.001);
      noise(t, 0.7, 'lowpass', 2400, 160, 1.0, 0.002, 0.7, true);
      tone(t, 'sine', 130, 38, 0.3, 0.9, 0.002);
    },
    tick() { const a = audio(); if (!a) return; const t = a.currentTime; noise(t, 0.03, 'highpass', 5000, 4000, 0.35, 0.001); noise(t, 0.12, 'bandpass', 1200, 600, 0.15, 0.004); },
    click(dt = 0) { const a = audio(); if (!a) return; const t = a.currentTime + dt; noise(t, 0.025, 'bandpass', 3200, 2200, 0.3, 0.001, 4); tone(t, 'square', 1700, 900, 0.02, 0.05); },
    twang() { const a = audio(); if (!a) return; const t = a.currentTime; tone(t, 'sawtooth', 120, 92, 0.32, 0.25, 0.002); tone(t, 'triangle', 240, 180, 0.2, 0.15, 0.002); noise(t, 0.12, 'bandpass', 1400, 400, 0.3, 0.002, 2); },
    thunk() { const a = audio(); if (!a) return; const t = a.currentTime; tone(t, 'sawtooth', 190, 120, 0.16, 0.25, 0.001); noise(t, 0.06, 'bandpass', 2500, 900, 0.4, 0.001, 2); tone(t, 'sine', 90, 50, 0.1, 0.4); },
    stick() { const a = audio(); if (!a) return; const t = a.currentTime; tone(t, 'triangle', 260, 140, 0.07, 0.3, 0.001); noise(t, 0.04, 'bandpass', 2200, 1000, 0.2, 0.001, 3); },
    boom() {
      const a = audio(); if (!a) return; const t = a.currentTime;
      noise(t, 1.6, 'lowpass', 1600, 60, 1.0, 0.004, 0.6, true);
      tone(t, 'sine', 70, 24, 1.1, 1.0, 0.004);
      noise(t + 0.02, 0.5, 'highpass', 2500, 800, 0.4, 0.002);
      for (let i = 0; i < 6; i++) noise(t + 0.1 + Math.random() * 0.5, 0.05, 'bandpass', 2000 + Math.random() * 2000, 800, 0.15, 0.001, 3);
    },
    ding() {   // 프라이팬 "땡~"
      const a = audio(); if (!a) return; const t = a.currentTime;
      for (const [f, p, d] of [[523, 0.35, 1.4], [1311, 0.18, 1.0], [2093, 0.12, 0.8], [2967, 0.08, 0.6], [784, 0.12, 1.2]]) tone(t, 'sine', f, f * 0.995, d, p, 0.002);
      noise(t, 0.04, 'highpass', 6000, 4000, 0.25, 0.001);
    },
    rocket() {   // 바주카 '푸슝'
      const a = audio(); if (!a) return; const t = a.currentTime;
      noise(t, 0.08, 'highpass', 3000, 1500, 0.7, 0.001);
      noise(t, 0.9, 'bandpass', 900, 2600, 0.6, 0.01, 1.2, true);
      tone(t, 'sine', 110, 40, 0.3, 0.8, 0.002);
    },
    thump() {    // 박격포 '퉁'
      const a = audio(); if (!a) return; const t = a.currentTime;
      tone(t, 'sine', 95, 38, 0.35, 1.0, 0.002); noise(t, 0.4, 'lowpass', 1200, 120, 0.8, 0.002, 0.7, true);
      tone(t, 'triangle', 300, 160, 0.08, 0.2, 0.001);
    },
    whistle(dur = 1.2) {   // 떨어지는 포탄 '휘이이~'
      const a = audio(); if (!a) return; const t = a.currentTime;
      tone(t, 'sine', 2100, 650, dur, 0.13, 0.15); tone(t, 'sine', 2160, 670, dur, 0.05, 0.15);
    },
    hiss: null,
  };
  function startHiss() {
    const a = audio(); if (!a) return null;
    const s = a.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
    const g = a.createGain(); g.gain.value = 0.06;
    s.connect(f).connect(g).connect(master); s.start();
    return { stop() { try { g.gain.setTargetAtTime(0, a.currentTime, 0.02); s.stop(a.currentTime + 0.1); } catch { /* 이미 멈춤 */ } } };
  }

  /* ════ 손님·블록 ════ */
  const EMPTY = [];
  const api = () => (getNpcs ? getNpcs() : null);
  const npcList = () => { const a = api(); return (a && a.npcs) || EMPTY; };
  /* (소리 합성 함수 noise 와 이름이 겹쳐 소리가 다 안 나던 문제 → alarmNoise 로 분리) */
  function alarmNoise(kind, pos) {   // 총소리·폭발 → 손님들이 도망 (npcs.alarm), 수배 등은 onNoise 로
    const a = api(); if (a && a.alarm) a.alarm(pos, 0, kind);
    if (onNoise) onNoise(kind, pos);
  }
  function knock(n, imp, cause) {
    const a = api(); if (!a) return;
    const v = new V(imp.x, imp.y, imp.z);
    if (onHit) onHit(n, cause);
    if (a.knockDown) { a.knockDown(n, v, cause); return; }
    const g = a._grab;
    if (g && g.grab(n)) {
      g.release(n, true);
      n.vx = v.x; n.vy = v.y; n.vz = v.z;
      const hs = Math.hypot(v.x, v.z);
      if (hs > 0.5) n.rot = Math.atan2(-v.x, -v.z);
      n.spinX = -Math.min(10, 2 + hs * 0.6);
    }
  }
  function stagger(n, imp) {
    const a = api(); if (!a) return;
    if (onHit) onHit(n, 'sword');
    const l = Math.hypot(imp.x, imp.z) || 1;
    if (a.stagger) { a.stagger(n, imp.x / l, imp.z / l, 'sword'); return; }
    n.x += imp.x * 0.06; n.z += imp.z * 0.06;
  }
  const blockMeshes = [];
  const blockOf = new Map();
  function refreshBlocks() {
    blockMeshes.length = 0; blockOf.clear();
    for (const b of toyBlocks) if (b && b.mesh) { blockMeshes.push(b.mesh); blockOf.set(b.mesh, b); }
  }
  refreshBlocks();
  function pushBlock(b, vx, vy, vz, spin = 2) {
    if (onImpulse) { onImpulse(b, vx, vy, vz); return; }
    const body = b.body; if (!body) return;
    const k = 1 / Math.max(0.4, Math.sqrt(body.mass || 1));
    body.velocity.x += vx * k; body.velocity.y += vy * k; body.velocity.z += vz * k;
    body.angularVelocity.x += rand(-spin, spin); body.angularVelocity.y += rand(-spin, spin); body.angularVelocity.z += rand(-spin, spin);
    if (body.wakeUp) body.wakeUp();
  }
  const hitCount = new Map();

  /* ════ 조준 ════ */
  const raycaster = new THREE.Raycaster(); raycaster.camera = camera;   // 물체 목록에 Sprite(간판 글씨 등)가 있으면 camera 가 필요하다
  const ndc = new THREE.Vector2(0, 0);
  let mouseX = innerWidth / 2, mouseY = innerHeight / 2, mouseIn = false;
  const aim = { point: new V(), npc: null, block: null, dist: 0, normal: new V(0, 1, 0), kind: 'none' };
  const _hits = [];
  function npcRayT(o, d, maxT) {
    let best = null, bt = maxT;
    for (const n of npcList()) {
      if (n.off) continue;
      for (let k = 0; k < 3; k++) {
        const cx = n.x, cy = n.y + 0.45 + k * 0.52, cz = n.z;
        const vx = cx - o.x, vy = cy - o.y, vz = cz - o.z;
        const tca = vx * d.x + vy * d.y + vz * d.z;
        if (tca <= 0 || tca > bt) continue;
        const d2 = vx * vx + vy * vy + vz * vz - tca * tca;
        if (d2 < 0.16) { bt = tca; best = n; }
      }
    }
    return best ? { n: best, t: bt } : null;
  }
  function groundT(o, d, maxT) {
    let prev = 0, step = 0.5;
    if (o.y - groundY(o.x, o.z) < 0) return 0;
    for (let t = step; t <= maxT; t += step) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y < groundY(x, z)) {
        let lo = prev, hi = t;
        for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (o.y + d.y * m < groundY(o.x + d.x * m, o.z + d.z * m)) hi = m; else lo = m; }
        return hi;
      }
      prev = t; if (t > 12) step = 1;
    }
    return -1;
  }
  function castRay(o, d, maxT, withColliders, out) {
    out.npc = null; out.block = null; out.obj = null; out.kind = 'none';
    let t = maxT;
    const gt = groundT(o, d, maxT); if (gt >= 0) { t = gt; out.kind = 'ground'; out.normal.set(0, 1, 0); }
    raycaster.set(o, d); raycaster.near = 0; raycaster.far = t;
    _hits.length = 0; raycaster.intersectObjects(blockMeshes, false, _hits);
    if (_hits.length) { t = _hits[0].distance; out.kind = 'block'; out.block = blockOf.get(_hits[0].object); out.obj = _hits[0].object; }
    if (withColliders && colliders) {
      const list = typeof colliders === 'function' ? colliders() : colliders;
      raycaster.far = t; _hits.length = 0; raycaster.intersectObjects(list, true, _hits);
      if (_hits.length) { t = _hits[0].distance; out.kind = 'collider'; out.block = null; out.obj = _hits[0].object; }
    }
    const nh = npcRayT(o, d, t);
    if (nh) { t = nh.t; out.kind = 'npc'; out.npc = nh.n; out.block = null; }
    out.dist = t; out.point.copy(o).addScaledVector(d, t);
    return out;
  }
  let inspectAim = null;
  function updateAim() {
    if (inspectAim) { aim.point.copy(inspectAim); aim.kind = 'ground'; aim.npc = null; aim.dist = inspectAim.distanceTo(camera.position); return; }
    if (domElement) { const r = domElement.getBoundingClientRect(); ndc.set((mouseX - r.left) / r.width * 2 - 1, -((mouseY - r.top) / r.height) * 2 + 1); }
    raycaster.setFromCamera(ndc, camera);
    _v6.copy(raycaster.ray.direction); _v5.copy(raycaster.ray.origin);
    castRay(_v5, _v6, 90, false, aim);
  }
  /* 포물선: from 에서 to 로 speed 로 던질 때의 속도 (낮은 각). 닿지 않으면 45°로 */
  function ballistic(from, to, speed, g, out) {
    const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y, h = Math.hypot(dx, dz) || 1e-3;
    const s2 = speed * speed, disc = s2 * s2 - g * (g * h * h + 2 * dy * s2);
    const ang = disc >= 0 ? Math.atan((s2 - Math.sqrt(disc)) / (g * h)) : Math.PI / 4;
    out.set(dx / h * Math.cos(ang) * speed, Math.sin(ang) * speed, dz / h * Math.cos(ang) * speed);
    return out;
  }

  /* ════ 투사체 ════ */
  const proj = [];   // { obj, kind, vel, state, t, life, mats, fuse, hiss, g }
  const MAX_PROJ = 36;
  function cloneMats(o) {
    const mats = [];
    o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; mats.push(m.material); } });
    return mats;
  }
  function spawnProj(kind, src, pos, vel, opts = {}) {
    if (proj.length >= MAX_PROJ) killProj(proj.findIndex(p => p.state !== 'fly' && p.kind !== 'bomb'));
    const obj = src.clone(true);
    obj.visible = true; obj.position.copy(pos);
    obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(obj);
    const p = { obj, kind, vel: vel.clone(), state: 'fly', t: 0, life: 20, mats: cloneMats(obj), g: opts.g ?? 9.8,
      fuse: opts.fuse ?? 0, hiss: null, spin: opts.spin ?? 0, len: src.userData.len || 0.3, prev: pos.clone() };
    if (kind === 'bomb') p.hiss = startHiss();
    if (vel.lengthSq() > 0.01 && kind !== 'bomb') obj.lookAt(_v.copy(pos).add(vel));
    proj.push(p);
    return p;
  }
  function killProj(i) {
    if (i < 0) return;
    const p = proj[i];
    if (p.hiss) p.hiss.stop();
    if (p.obj.parent) p.obj.parent.remove(p.obj);
    for (const m of p.mats) m.dispose();
    proj.splice(i, 1);
  }
  function segSphere(p0, p1, cx, cy, cz, r) {   // 선분-구 충돌 → 0..1 또는 -1
    const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
    const fx = p0.x - cx, fy = p0.y - cy, fz = p0.z - cz;
    const a = dx * dx + dy * dy + dz * dz, b = 2 * (fx * dx + fy * dy + fz * dz), c = fx * fx + fy * fy + fz * fz - r * r;
    if (c < 0) return 0;
    const disc = b * b - 4 * a * c; if (disc < 0 || a < 1e-9) return -1;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : -1;
  }
  const segHit = { point: new V(), normal: new V(), npc: null, block: null, obj: null, kind: 'none', dist: 0 };
  function stepProj(dt) {
    for (let i = proj.length - 1; i >= 0; i--) {
      const p = proj[i];
      p.t += dt;
      if (p.state === 'stuck' || p.state === 'rest') {
        if (p.kind === 'bomb') { /* 바닥에서 도화선이 탄다 */ }
        else {
          p.life -= dt;
          if (p.life < 1) for (const m of p.mats) m.opacity = Math.max(0, p.life);
          if (p.life <= 0) { killProj(i); continue; }
        }
      }
      if (p.kind === 'bomb') {
        p.fuse -= dt;
        const f = p.obj.userData.fuse || models.bomb.userData.fuse;
        _v.copy(f).applyQuaternion(p.obj.quaternion).add(p.obj.position);
        if (Math.random() < 0.8) puff(_v.x, _v.y, _v.z, rand(-0.6, 0.6), rand(0.5, 1.5), rand(-0.6, 0.6), 0xffb43a, 0.05, 0.015, 0.3, 1, true, 4, 0.6);
        if (p.fuse <= 0) { explode(p.obj.position, 5, 12); killProj(i); continue; }
      }
      if (p.state !== 'fly' && p.state !== 'drop') continue;

      p.prev.copy(p.obj.position);
      p.vel.y -= p.g * dt;
      p.obj.position.addScaledVector(p.vel, dt);
      if (p.kind === 'bomb') { p.obj.rotation.x += p.spin * dt; p.obj.rotation.z += p.spin * 0.6 * dt; }
      else if (p.state === 'fly') p.obj.lookAt(_v.copy(p.obj.position).add(p.vel));
      else { p.obj.rotation.x += 8 * dt; }

      // 앞 끝(촉) 위치로 충돌 검사
      const tipOff = p.kind === 'bomb' ? 0 : (p.state === 'fly' ? p.len : 0);
      _v2.copy(p.vel).normalize();
      _v3.copy(p.prev).addScaledVector(_v2, tipOff); _v4.copy(p.obj.position).addScaledVector(_v2, tipOff);
      const segLen = _v3.distanceTo(_v4);
      if (segLen < 1e-5) continue;

      // 손님
      if (p.state === 'fly') {
        let hitN = null, hitT = 2;
        for (const n of npcList()) {
          if (n.off) continue;
          for (let k = 0; k < 3; k++) {
            const t = segSphere(_v3, _v4, n.x, n.y + 0.45 + k * 0.52, n.z, p.kind === 'bomb' ? 0.45 : 0.38);
            if (t >= 0 && t < hitT) { hitT = t; hitN = n; }
          }
        }
        if (hitN) {
          const sp = p.vel.length();
          if (p.kind === 'bomb') { p.vel.multiplyScalar(-0.25); p.vel.y = 1.5; SND.knock(); continue; }
          knock(hitN, { x: p.vel.x / sp * Math.min(7, sp * 0.25), y: 2.5, z: p.vel.z / sp * Math.min(7, sp * 0.25) }, p.kind);
          _v.copy(_v3).lerp(_v4, hitT);
          puff(_v.x, _v.y, _v.z, 0, 0.3, 0, 0xffffff, 0.2, 0.7, 0.35, 0.9); sparks(_v.x, _v.y, _v.z, 8);
          SND.thud(1.2); shake(0.06);
          // 사람에게 박히지 않는다 → 튕겨 떨어진다
          p.state = 'drop'; p.vel.set(-p.vel.x * 0.12, 2.2, -p.vel.z * 0.12); p.g = 9.8; p.life = 4;
          continue;
        }
      }
      // 블록·물체·땅
      raycaster.set(_v3, _v2); raycaster.near = 0; raycaster.far = segLen;
      _hits.length = 0; raycaster.intersectObjects(blockMeshes, false, _hits);
      let hitObj = null, hitPt = null, hitBlock = null;
      if (_hits.length) { hitObj = _hits[0].object; hitPt = _hits[0].point; hitBlock = blockOf.get(hitObj); }
      if (!hitObj && colliders && p.state === 'fly') {
        const list = typeof colliders === 'function' ? colliders() : colliders;
        _hits.length = 0; raycaster.intersectObjects(list, true, _hits);
        if (_hits.length) { hitObj = _hits[0].object; hitPt = _hits[0].point; }
      }
      const gy = groundY(_v4.x, _v4.z);
      if (!hitObj && _v4.y < gy) {
        // 땅
        if (p.kind === 'bomb' || p.state === 'drop') {
          p.obj.position.y = groundY(p.obj.position.x, p.obj.position.z) + (p.kind === 'bomb' ? 0.085 : 0.02);
          if (Math.abs(p.vel.y) > 1.2) { p.vel.y = -p.vel.y * 0.35; p.vel.x *= 0.6; p.vel.z *= 0.6; if (p.kind === 'bomb') SND.knock(); }
          else { p.vel.set(0, 0, 0); p.g = 0; p.state = 'rest'; if (p.kind !== 'bomb') { p.life = Math.min(p.life, 3); p.obj.rotation.x = Math.PI / 2; } }
          continue;
        }
        let lo = 0, hi = 1;
        for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2; _v.copy(_v3).lerp(_v4, m); if (_v.y < groundY(_v.x, _v.z)) hi = m; else lo = m; }
        _v.copy(_v3).lerp(_v4, hi);
        stickAt(p, _v, _v2, null);
        smoke(_v.x, _v.y, _v.z, 3, 0x9a7b55, 0.25, 0.4, 0.3, 0.8);
        continue;
      }
      if (hitObj) {
        if (p.kind === 'bomb' || p.state === 'drop') {
          if (hitBlock) pushBlock(hitBlock, p.vel.x * 0.3, 1, p.vel.z * 0.3);
          p.obj.position.copy(p.prev); p.vel.multiplyScalar(-0.3); SND.knock();
          continue;
        }
        if (hitBlock) pushBlock(hitBlock, p.vel.x * 0.12, 0.8, p.vel.z * 0.12, 3);
        stickAt(p, hitPt, _v2, hitObj);
        sparks(hitPt.x, hitPt.y, hitPt.z, 4, 0xe8c48a, 2);
        continue;
      }
    }
  }
  function stickAt(p, tipPoint, dir, obj) {
    p.state = 'stuck'; p.life = 20;
    // 촉이 0.12~0.2 m 박히게
    const depth = p.kind === 'javelin' ? 0.22 : 0.12;
    p.obj.position.copy(tipPoint).addScaledVector(dir, depth - p.len);
    p.obj.lookAt(_v5.copy(p.obj.position).add(dir));
    if (obj) obj.attach(p.obj);   // 움직이는 블록이면 같이 움직인다
    SND.stick();
  }

  /* ════ 폭발 ════ */
  let lastBoom = null;
  function explode(pos, radius = 5, force = 12) {
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return;   // NaN 위치면 모든 사람이 맞는다
    const x = pos.x, y = Number.isFinite(pos.y) ? pos.y : groundY(pos.x, pos.z), z = pos.z;
    lastBoom = { x, y, z, t: clock, r: radius };
    for (const n of npcList()) {
      if (n.off) continue;
      const dx = n.x - x, dz = n.z - z, d = Math.hypot(dx, dz);
      if (!(d <= radius)) continue;
      const k = 1 - d / radius, l = d || 1;
      knock(n, { x: dx / l * force * (0.35 + 0.65 * k), y: 3 + 6 * k, z: dz / l * force * (0.35 + 0.65 * k) }, 'explosion');
    }
    for (const b of toyBlocks) {
      if (!b || !b.body) continue;
      const bp = b.body.position, dx = bp.x - x, dz = bp.z - z, d = Math.hypot(dx, dz, bp.y - y);
      if (d > radius * 1.2) continue;
      const k = 1 - d / (radius * 1.2), l = Math.hypot(dx, dz) || 1;
      pushBlock(b, dx / l * force * k, (4 + 8 * k) * Math.min(1, force / 10), dz / l * force * k, 8 * k);
    }
    const gy = groundY(x, z);
    puff(x, y + 0.3, z, 0, 0, 0, 0xfff2c0, 1.2, radius * 0.9, 0.18, 1, true);
    for (let i = 0; i < 12; i++) puff(x + rand(-0.4, 0.4), y + rand(0, 0.6), z + rand(-0.4, 0.4), rand(-3, 3), rand(1, 5), rand(-3, 3),
      i % 2 ? 0xff8a2a : 0xffc14a, 0.5, rand(1.5, 2.6), rand(0.35, 0.6), 0.95, true, -1, 3);
    for (let i = 0; i < 16; i++) puff(x + rand(-1, 1), y + rand(0.3, 1.5), z + rand(-1, 1), rand(-2, 2), rand(1, 3.5), rand(-2, 2),
      i % 3 ? 0x4a4440 : 0x7a7068, 0.8, rand(2.2, 3.6), rand(2.0, 3.4), 0.6, false, -0.4, 1.2);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; puff(x + Math.cos(a) * 0.6, gy + 0.2, z + Math.sin(a) * 0.6, Math.cos(a) * 7, 0.6, Math.sin(a) * 7, 0xa88a62, 0.4, 1.5, 1.0, 0.6, false, 0, 2.5); }
    sparks(x, y + 0.3, z, 26, 0xffcf5a, 9);
    shockRing(x, gy, z, radius * 1.3, 0.55);
    flash(x, y + 1, z, 90);
    const pd = person.position.distanceTo(_v.set(x, y, z));
    shake(Math.max(0.12, 0.6 * (1 - pd / 25)));
    SND.boom();
    alarmNoise('explosion', pos);
    if (onExplode) onExplode(pos, radius, force);
  }

  /* ════ 상태 ════ */
  const S = {
    cur: 'none', last: 'sword', attackT: -1, attackYaw: 0, hitDone: false, queued: false,
    yaw: 0, yawActive: false, cool: 0, reload: 0, loaded: true, pendingShot: -1,
    draw: 0, drawing: false, charge: 0, charging: false, spinT: -1, spinAng: 0, slamT: -1, slamFrom: new V(),
    throwT: -1, thrown: false, recoil: 0, shake: 0, shakeT: 0, wasActive: false, hidden: false,
  };
  const ball = { pos: new V(), prev: new V(), init: false };
  const flailBall = (() => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), M.iron));
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 5), M.steel);
      const phi = Math.acos(1 - 2 * (i + 0.5) / 10), th = i * 2.4;
      c.position.setFromSphericalCoords(0.09, phi, th);
      c.lookAt(_v.copy(c.position).multiplyScalar(2)); c.rotateX(Math.PI / 2);
      g.add(c);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.visible = false; scene.add(g); return g;
  })();
  const chainGeo = new THREE.BufferGeometry(); chainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  const chain = new THREE.Line(chainGeo, new THREE.LineBasicMaterial({ color: 0x55575c })); chain.frustumCulled = false; chain.visible = false; scene.add(chain);
  const CHAIN_L = 0.55;
  /* flail.glb 의 'link' 가 오면 선 대신 쇠고리 14개를 늘어놓는다 (chain 의 자식 → chain.visible 하나로 같이 켜고 끈다) */
  const CHAIN_N = 14, chainLinks = [];
  function setChainLinks(part) {
    for (let i = 0; i < CHAIN_N; i++) { const c = part.clone(true); c.position.set(0, 0, 0); chain.add(c); chainLinks.push(c); }
    chain.material.visible = false;
  }
  const _cq = new Q(), _cq2 = new Q(), _cd = new V();
  function updateChainLinks(a0, sagOn) {   // a0 = 사슬 시작(손잡이 고리), ball.pos = 끝
    if (!chainLinks.length) return;
    _cd.subVectors(ball.pos, a0); const l = _cd.length(); if (!(l > 1e-4)) return;
    _cd.multiplyScalar(1 / l);
    _cq.setFromUnitVectors(UP, _cd);
    for (let i = 0; i < CHAIN_N; i++) {
      const f = (i + 0.5) / CHAIN_N, c = chainLinks[i];
      c.position.lerpVectors(a0, ball.pos, f); c.position.y -= sagOn ? Math.sin(f * Math.PI) * 0.05 : 0;
      c.quaternion.copy(_cq);
      if (i & 1) c.quaternion.multiply(_cq2.setFromAxisAngle(UP, Math.PI / 2));   // 고리를 번갈아 90° 비튼다
    }
  }

  function shake(a) { S.shake = Math.max(S.shake, a); }
  const active = () => {
    if (canUse && !canUse()) return false;
    if (isBlocked && isBlocked()) return false;
    return !document.body.classList.contains('intro-on') && document.body.dataset.view !== 'doc' && !document.querySelector('#g-panel.open');
  };

  function resetActions() {
    S.attackT = -1; S.queued = false; S.drawing = false; S.draw = 0; S.charging = false; S.charge = 0;
    S.spinT = -1; S.slamT = -1; S.throwT = -1; S.pendingShot = -1;
    mortarS.fireT = -1; S.thrown = false;
  }
  function select(id) {
    if (id !== 'none' && !BY_ID[id]) return;
    if (id === S.cur) id = 'none';
    resetActions();
    if (S.cur !== 'none') S.last = S.cur;
    S.cur = id;
    for (const k in models) models[k].visible = false;
    nocked.visible = false; flailBall.visible = false; chain.visible = false; ball.init = false;
    shellHand.visible = false; mortarS.dep = 0; mortarS.moveT = 0.3; mortarS.lastX = NaN;
    if (id !== 'none') { tryGlb(id); if (id === 'bow') tryGlb('arrow'); SND.click(); }
    S.loaded = true; S.reload = 0; S.cool = 0;
    if (domElement) domElement.classList.toggle('wp-armed', id !== 'none');
    renderHud();
  }
  function holster() { if (S.cur !== 'none') select('none'); }
  function cycle(dir) {   // 휠: 주먹 → 칼 → … → 박격포 → 주먹
    const ids = ['none', ...WEAPONS.map(w => w.id)];
    const i = Math.max(0, ids.indexOf(S.cur));
    const id = ids[(i + dir + ids.length) % ids.length];
    if (id === 'none') holster(); else select(id);
  }

  /* ── 입력 ── */
  function onDown() {
    const w = S.cur;
    if (w === 'none') return;
    audio();
    if (MELEE[w]) { if (S.attackT < 0) startAttack(); else S.queued = true; }
    else if (w === 'pistol') { if (S.loaded && S.pendingShot < 0) { S.pendingShot = 0.07; SND.tick(); panFlash(); } else if (!S.loaded) SND.click(); }
    else if (w === 'bow') { if (S.cool <= 0) { S.drawing = true; S.draw = 0; } }
    else if (w === 'crossbow') { if (S.loaded) fireBolt(); else SND.click(); }
    else if (w === 'flail') { if (S.slamT < 0) { S.spinT = 0; S.spinAng = S.yaw; } }
    else if (w === 'javelin') { if (S.cool <= 0 && S.throwT < 0) { S.charging = true; S.charge = 0; } }
    else if (w === 'bomb') { if (S.cool <= 0 && S.throwT < 0) { S.throwT = 0; S.thrown = false; S.attackYaw = aimYaw(); SND.whoosh(0.8); } }
    else if (w === 'bazooka') { if (S.loaded) fireRocket(); else SND.click(); }
    else if (w === 'mortar') {   // 내려놓은 상태 + 장전돼 있을 때만. 클릭한 순간의 목표를 기억한다
      if (S.loaded && mortarS.fireT < 0 && mortarS.dep > 0.9) { mortarS.fireT = 0; S.thrown = false; mLock.copy(mortarTarget(mTarget)); SND.click(); }
      else SND.click();
    }
  }
  function onUp() {
    const w = S.cur;
    if (w === 'bow' && S.drawing) { S.drawing = false; if (S.draw > 0.12) fireArrow(); S.draw = 0; }
    if (w === 'flail' && S.spinT >= 0) { const spun = S.spinT; S.spinT = -1; if (spun > 0.25) { S.slamT = 0; S.attackYaw = aimYaw(); S.hitDone = false; S.slamFrom.copy(ball.pos); } }
    if (w === 'javelin' && S.charging) { S.charging = false; S.throwT = 0; S.thrown = false; S.attackYaw = aimYaw(); SND.whooshHeavy(); }
  }
  const onPointerDown = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (S.cur === 'none' || !active()) return;
    mouseX = e.clientX; mouseY = e.clientY;
    e.preventDefault();
    onDown();
  };
  const onPointerUp = e => { if (e.pointerType === 'mouse' && e.button !== 0) return; onUp(); };
  const onMove = e => { mouseX = e.clientX; mouseY = e.clientY; mouseIn = true; };
  const onLeave = () => { mouseIn = false; };
  const onWheel = e => { if (!active() || Math.abs(e.deltaY) < 4) return; cycle(e.deltaY > 0 ? 1 : -1); };
  const onKey = e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (!active()) return;
    const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code), k = m ? m[1] : KEY_CODE[e.code];
    if (k) { const w = WEAPONS.find(x => x.key === k); if (w) { e.preventDefault(); select(w.id); } return; }

    if (e.code === 'Backquote') { e.preventDefault(); holster(); return; }
    if (e.code === 'KeyG') { e.preventDefault(); if (S.cur === 'none') select(S.last); else holster(); }
  };
  if (domElement) {
    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointermove', onMove);
    domElement.addEventListener('pointerleave', onLeave);
    domElement.addEventListener('wheel', onWheel, { passive: true });
  }
  addEventListener('pointerup', onPointerUp);
  addEventListener('pointercancel', onPointerUp);
  addEventListener('keydown', onKey);
  const onBlurWin = () => onUp();
  addEventListener('blur', onBlurWin);

  function aimYaw() { const p = person.position; return Math.atan2(aim.point.x - p.x, aim.point.z - p.z); }
  function startAttack() { S.attackT = 0; S.hitDone = false; S.queued = false; S.attackYaw = aimYaw(); trailCount = 0; SND[MELEE[S.cur].sound](); }

  /* ── 사격 ── */
  function muzzleWorld(id, out) { const m = models[id]; return out.copy(m.userData.muzzle || _v.set(0, 0, 0.3)).applyMatrix4(m.matrixWorld); }
  function panFlash() {
    const m = models.pistol; _v.set(-0.03, 0.08, 0.0).applyMatrix4(m.matrixWorld);
    puff(_v.x, _v.y, _v.z, 0, 0.4, 0, 0xffd27a, 0.05, 0.18, 0.12, 1, true);
    smoke(_v.x, _v.y, _v.z, 2, 0xe0dcd4, 0.12, 0.15, 0.4, 1.0);
  }
  function firePistol() {
    S.loaded = false; S.reload = 1.2; S.recoil = 1;
    muzzleWorld('pistol', _v4);
    // 화면 광선으로 맞힌다 (물체 포함)
    raycaster.setFromCamera(ndc, camera);
    _v5.copy(raycaster.ray.origin); _v6.copy(raycaster.ray.direction);
    castRay(_v5, _v6, 70, true, segHit);
    _v2.subVectors(segHit.point, _v4).normalize();
    puff(_v4.x, _v4.y, _v4.z, 0, 0, 0, 0xffe1a0, 0.12, 0.42, 0.07, 1, true);
    puff(_v4.x + _v2.x * 0.12, _v4.y + _v2.y * 0.12, _v4.z + _v2.z * 0.12, _v2.x, _v2.y, _v2.z, 0xff9a3a, 0.08, 0.3, 0.06, 1, true);
    for (let i = 0; i < 7; i++) puff(_v4.x, _v4.y, _v4.z, _v2.x * rand(1, 4) + rand(-0.3, 0.3), _v2.y * rand(1, 4) + rand(0.1, 0.5), _v2.z * rand(1, 4) + rand(-0.3, 0.3),
      0xe6e2da, 0.1, rand(0.5, 0.9), rand(1.2, 2.2), 0.55, false, -0.2, 2.5);
    flash(_v4.x, _v4.y, _v4.z, 40);
    SND.bang(); shake(0.14);
    alarmNoise('shot', _v4);
    hitEffect(segHit, _v2, 'shot', 9);
  }
  function hitEffect(h, dir, cause, power) {
    const p = h.point;
    if (h.kind === 'npc') {
      knock(h.npc, { x: dir.x * power * 0.6, y: 2.5, z: dir.z * power * 0.6 }, cause);
      puff(p.x, p.y, p.z, 0, 0.3, 0, 0xffffff, 0.2, 0.8, 0.35, 0.9); sparks(p.x, p.y, p.z, 10);
      SND.thud(1.3);
    } else if (h.kind === 'block') {
      pushBlock(h.block, dir.x * power * 0.5, 2, dir.z * power * 0.5, 4);
      sparks(p.x, p.y, p.z, 8, 0xe8c48a, 3); smoke(p.x, p.y, p.z, 2, 0xc8a878, 0.2, 0.4, 0.3, 0.7);
      SND.knock();
    } else if (h.kind === 'ground' || h.kind === 'collider') {
      smoke(p.x, p.y + 0.05, p.z, 5, 0xa88a62, 0.3, 0.6, 1.0, 1.0);
      sparks(p.x, p.y + 0.05, p.z, 5, 0xd9b27a, 2.5);
    }
  }
  function fireArrow() {
    const spd = 14 + 34 * S.draw;
    _v4.copy(nocked.position).addScaledVector(_v.set(0, 0, 1).applyQuaternion(nocked.quaternion), 0.2);
    ballistic(_v4, aim.point, spd, 9.8, _v2);
    if (aim.dist < 3) _v2.subVectors(aim.point, _v4).normalize().multiplyScalar(spd);
    spawnProj('arrow', nocked, nocked.position, _v2, { g: 9.8 });
    nocked.visible = false; S.cool = 0.45; SND.twang(); shake(0.03);
  }
  function fireBolt() {
    const m = models.crossbow;
    muzzleWorld('crossbow', _v4);
    _v2.subVectors(aim.point, _v4); if (_v2.lengthSq() < 0.01) _v2.set(0, 0, 1).applyQuaternion(m.quaternion);
    _v2.normalize().multiplyScalar(60);
    if (m.userData.bolt) { m.userData.bolt.updateWorldMatrix(true, false); m.userData.bolt.getWorldPosition(_v5); spawnProj('bolt', m.userData.bolt, _v5, _v2, { g: 2 }); m.userData.bolt.visible = false; }
    S.loaded = false; S.reload = 1.5; S.recoil = 0.7; SND.thunk(); shake(0.05);
  }

  /* ════ 바주카 · 박격포 (탄은 따로 굴린다 — 맞으면 바로 폭발) ════ */
  const ROCKET = (() => {
    const g = new THREE.Group();
    g.add(alongZ(cyl(0.04, 0.04, 0.32, M.olive, 0, 0, -0.04, 12)));
    const nose = alongZ(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 12), M.redP)); nose.position.z = 0.2; g.add(nose);
    for (let i = 0; i < 4; i++) { const f = box(0.006, 0.07, 0.08, M.oliveD, 0, 0.045, -0.18); const pv = new THREE.Group(); pv.rotation.z = i * Math.PI / 2; pv.add(f); g.add(pv); }
    return g;
  })();
  const SHELL = (() => {   // 박격포탄: 머리 = +Y
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), M.olive); body.scale.set(1, 2.1, 1); g.add(body);
    g.add(cyl(0.051, 0.051, 0.025, M.yellow, 0, 0.03, 0, 12));
    g.add(cyl(0.012, 0.02, 0.09, M.oliveD, 0, -0.13, 0, 8));
    for (let i = 0; i < 4; i++) { const f = box(0.005, 0.06, 0.05, M.oliveD, 0, -0.15, 0.025); const pv = new THREE.Group(); pv.rotation.y = i * Math.PI / 2; pv.add(f); g.add(pv); }
    return g;
  })();
  const shellHand = prepModel(SHELL.clone(true));   // 박격포 쏘기 전 오른손에 든 포탄
  const ord = [];   // 날아가는 로켓·포탄 { obj, kind, vel, g, t, max, dist, whistled, T, prev }
  const _yAx = new V(0, 1, 0);
  function spawnOrd(kind, pos, vel, opt = {}) {
    if (!Number.isFinite(pos.x + pos.y + pos.z + vel.x + vel.y + vel.z)) return null;
    const obj = (kind === 'rocket' ? ROCKET : SHELL).clone(true);
    obj.position.copy(pos); obj.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(obj);
    const o = { obj, kind, vel: vel.clone(), g: opt.g ?? 9.8, t: 0, max: opt.max ?? 8, dist: 0, whistled: false, T: opt.T ?? 2, prev: pos.clone() };
    orientOrd(o); ord.push(o); return o;
  }
  const _od = new V();
  function orientOrd(o) {
    _od.copy(o.vel); if (_od.lengthSq() < 1e-6) return; _od.normalize();
    if (o.kind === 'rocket') o.obj.lookAt(_v.copy(o.obj.position).add(_od));
    else o.obj.quaternion.setFromUnitVectors(_yAx, _od);
  }
  function killOrd(i) { const o = ord[i]; if (o.obj.parent) o.obj.parent.remove(o.obj); ord.splice(i, 1); }
  function boomOrd(i, at) {
    const o = ord[i];
    const R_ = o.kind === 'rocket' ? BAZ.radius : MORTAR.radius, F = o.kind === 'rocket' ? BAZ.force : MORTAR.force;
    if (Number.isFinite(at.x + at.y + at.z)) {
      explode(at, R_, F);
      if (o.kind === 'shell') {   // 큰 폭발: 흙먼지 한 겹 더
        for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; puff(at.x + Math.cos(a), at.y + 0.3, at.z + Math.sin(a), Math.cos(a) * 9, rand(2, 5), Math.sin(a) * 9, 0x8a6d4a, 0.6, 2.4, 1.4, 0.6, false, 2, 2); }
        shockRing(at.x, at.y, at.z, R_ * 1.5, 0.8, 0xffe2b0);
      }
    }
    killOrd(i);
  }
  const _sp = new V(), _sd = new V();
  function stepOrd(dt) {
    for (let i = ord.length - 1; i >= 0; i--) {
      const o = ord[i];
      o.t += dt;
      o.prev.copy(o.obj.position);
      o.vel.y -= o.g * dt;
      o.obj.position.addScaledVector(o.vel, dt);
      orientOrd(o);
      const P = o.obj.position;
      if (!Number.isFinite(P.x + P.y + P.z)) { killOrd(i); continue; }
      if (o.kind === 'rocket') {   // 연기 꼬리 + 불꽃
        _v.copy(o.vel).normalize();
        puff(P.x - _v.x * 0.3, P.y - _v.y * 0.3, P.z - _v.z * 0.3, rand(-0.3, 0.3), rand(0, 0.4), rand(-0.3, 0.3), 0xd8d4cc, 0.12, rand(0.5, 0.8), rand(0.8, 1.3), 0.55, false, -0.2, 2);
        puff(P.x - _v.x * 0.25, P.y - _v.y * 0.25, P.z - _v.z * 0.25, 0, 0, 0, 0xffa040, 0.14, 0.05, 0.1, 1, true);
        o.dist += o.vel.length() * dt;
      } else if (!o.whistled && o.vel.y < 0) { o.whistled = true; SND.whistle(Math.max(0.4, o.T - o.t)); }
      // 충돌: 사람 · 블록 · 물체 → 땅
      _sd.subVectors(P, o.prev); const segLen = _sd.length();
      if (segLen > 1e-5) {
        let hitT = 2;
        for (const n of npcList()) {
          if (n.off) continue;
          for (let k = 0; k < 3; k++) { const t = segSphere(o.prev, P, n.x, n.y + 0.45 + k * 0.52, n.z, 0.45); if (t >= 0 && t < hitT) hitT = t; }
        }
        _sd.divideScalar(segLen);
        raycaster.set(o.prev, _sd); raycaster.near = 0; raycaster.far = segLen;
        _hits.length = 0; raycaster.intersectObjects(blockMeshes, false, _hits);
        if (colliders) { const list = typeof colliders === 'function' ? colliders() : colliders; raycaster.intersectObjects(list, true, _hits); }
        for (const h of _hits) { const t = h.distance / segLen; if (t < hitT) hitT = t; }
        if (hitT <= 1) { _sp.copy(o.prev).lerp(P, hitT); boomOrd(i, _sp); continue; }
      }
      if (P.y <= groundY(P.x, P.z)) {
        let lo = 0, hi = 1;
        for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2; _sp.copy(o.prev).lerp(P, m); if (_sp.y < groundY(_sp.x, _sp.z)) hi = m; else lo = m; }
        _sp.copy(o.prev).lerp(P, hi); _sp.y = groundY(_sp.x, _sp.z) + 0.1;
        boomOrd(i, _sp); continue;
      }
      if ((o.kind === 'rocket' && o.dist > BAZ.range) || o.t > o.max) { _sp.copy(P); boomOrd(i, _sp); continue; }
    }
  }
  function fireRocket() {
    const m = models.bazooka;
    muzzleWorld('bazooka', _o1);
    _o2.set(0, 0, 1).applyQuaternion(m.quaternion);              // 통이 향한 방향
    _o3.subVectors(aim.point, _o1);
    if (aim.dist < 2.5 || _o3.lengthSq() < 0.5) _o3.copy(_o2); else _o3.normalize();
    if (_o3.dot(_o2) < 0.7) _o3.copy(_o2);                        // 통이 가리키는 쪽에서 크게 벗어나지 않게
    if (!Number.isFinite(_o3.x + _o3.y + _o3.z)) return;
    spawnOrd('rocket', _o1.addScaledVector(_o3, 0.1), _v.copy(_o3).multiplyScalar(BAZ.speed), { g: 1.2, max: 5 });
    // 뒤 폭풍(연기)·섬광 — 피 없이 연기만
    _o4.copy(m.userData.rear).applyMatrix4(m.matrixWorld);
    for (let k = 0; k < 10; k++) puff(_o4.x, _o4.y, _o4.z, -_o2.x * rand(2, 6) + rand(-0.6, 0.6), rand(0, 1.2), -_o2.z * rand(2, 6) + rand(-0.6, 0.6), 0xe6e2da, 0.2, rand(0.8, 1.4), rand(1.2, 2.2), 0.6, false, -0.2, 2.2);
    puff(_o4.x, _o4.y, _o4.z, -_o2.x * 2, 0, -_o2.z * 2, 0xffb060, 0.2, 0.7, 0.12, 1, true);
    _v.copy(m.userData.muzzle).applyMatrix4(m.matrixWorld);
    puff(_v.x, _v.y, _v.z, 0, 0, 0, 0xffe1a0, 0.15, 0.6, 0.08, 1, true);
    flash(_v.x, _v.y, _v.z, 50);
    S.loaded = false; S.reload = BAZ.reload; S.recoil = 1;
    SND.rocket(); shake(0.16);
    alarmNoise('shot', _v);
  }
  /* 박격포 목표: 조준점을 땅 위 8~35 m 로 자른다. 하늘을 보면 같은 방향 최대 거리. 언제나 유한한 값 */
  const mortarS = { moveT: 0.3, dep: 0, lastX: NaN, lastZ: NaN, fireT: -1, inRange: true };
  const mTarget = new V(), mLock = new V();
  function mortarTarget(out) {
    const p = person.position, fy = person.rotation.y;
    let x = aim.point.x, z = aim.point.z;
    if (aim.kind === 'none' || !Number.isFinite(x) || !Number.isFinite(z)) {
      raycaster.setFromCamera(ndc, camera);
      const d = raycaster.ray.direction, h = Math.hypot(d.x, d.z);
      if (h > 1e-4 && Number.isFinite(h)) { x = p.x + d.x / h * MORTAR.max; z = p.z + d.z / h * MORTAR.max; }
      else { x = p.x + Math.sin(fy) * MORTAR.max; z = p.z + Math.cos(fy) * MORTAR.max; }
    }
    let dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (!(d > 0.05) || !Number.isFinite(d)) { dx = Math.sin(fy); dz = Math.cos(fy); d = 1; }
    mortarS.inRange = d >= MORTAR.min && d <= MORTAR.max;
    const c = Math.min(MORTAR.max, Math.max(MORTAR.min, d));
    x = p.x + dx / d * c; z = p.z + dz / d * c;
    out.set(x, groundY(x, z), z);
    if (!Number.isFinite(out.x + out.y + out.z)) out.set(p.x + Math.sin(fy) * 15, p.y, p.z + Math.cos(fy) * 15);
    return out;
  }
  const tgtRing = (() => {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    const mat2 = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const a = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40), mat); a.rotation.x = -Math.PI / 2; g.add(a);
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), mat); b.rotation.x = -Math.PI / 2; g.add(b);
    const c = new THREE.Mesh(new THREE.RingGeometry(MORTAR.radius - 0.12, MORTAR.radius, 64), mat2); c.rotation.x = -Math.PI / 2; g.add(c);
    for (let k = 0; k < 4; k++) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.5), mat); t.rotation.x = -Math.PI / 2; t.rotation.z = k * Math.PI / 2;
      t.position.set(Math.sin(k * Math.PI / 2) * 1.25, 0, Math.cos(k * Math.PI / 2) * 1.25); g.add(t);
    }
    g.traverse(o => { o.renderOrder = 6; });
    g.visible = false; g.userData.mat = mat; g.userData.mat2 = mat2; scene.add(g); return g;
  })();
  function fireShell() {
    const m = models.mortar;
    _o1.copy(m.userData.muzzle).applyMatrix4(m.matrixWorld);
    const tg = mLock, dx = tg.x - _o1.x, dz = tg.z - _o1.z, d = Math.hypot(dx, dz);
    const T = 1.4 + d * 0.045, g = 9.8;
    _o2.set(dx / T, (tg.y - _o1.y + 0.5 * g * T * T) / T, dz / T);
    spawnOrd('shell', _o1, _o2, { g, T, max: T + 3 });
    smoke(_o1.x, _o1.y, _o1.z, 8, 0xe0dcd4, 0.4, 0.5, 1.4, 1.8);
    puff(_o1.x, _o1.y + 0.1, _o1.z, 0, 1, 0, 0xffd27a, 0.15, 0.6, 0.1, 1, true);
    flash(_o1.x, _o1.y, _o1.z, 35);
    S.loaded = false; S.reload = MORTAR.reload;
    SND.thump(); shake(0.12);
    alarmNoise('shot', _o1);
  }
  const legLen = () => {
    const r = poser.rig; if (!r || !r.legL[2]) return [0.42, 0.42];
    if (!r._legLen) {
      const a = r.legL[0].getWorldPosition(new V()), b = r.legL[1].getWorldPosition(new V()), c = r.legL[2].getWorldPosition(new V());
      r._legLen = [a.distanceTo(b), b.distanceTo(c)];
    }
    return r._legLen;
  };
  /* 쪼그려 앉기 높이 h (m) 만큼 사람 모델(뼈대 묶음)만 내린다. 매 프레임 crouch(0) 으로 되돌린 뒤 다시 건다 */
  function crouch(h) {
    const r = poser.rig; if (!r || !r.model) return;
    const md = r.model; if (md.userData.baseY === undefined) { if (!h) return; md.userData.baseY = md.position.y; }
    md.position.y = md.userData.baseY - h / (person.scale.y || 1);
  }
  function poseMortar(dt) {
    const r = poser.rig, m = models.mortar, p = person.position;
    // 움직이면 들고 다니고, 멈추면 땅에 내려놓는다
    const sp = Number.isFinite(mortarS.lastX) ? Math.hypot(p.x - mortarS.lastX, p.z - mortarS.lastZ) / Math.max(dt, 1e-3) : 0;
    mortarS.lastX = p.x; mortarS.lastZ = p.z;
    if (sp > 0.5 && mortarS.fireT < 0) mortarS.moveT = 0.25; else mortarS.moveT -= dt;
    const want = mortarS.moveT <= 0;
    mortarS.dep = Math.max(0, Math.min(1, mortarS.dep + (want ? dt / 0.4 : -dt / 0.25)));
    const e = smooth(mortarS.dep);
    mortarTarget(mTarget);
    const fy = person.rotation.y; _o1.set(Math.sin(fy), 0, Math.cos(fy));   // 몸이 바라보는 쪽
    // 쪼그려 앉기: 엉덩이를 낮추고 무릎을 굽힌다 (발은 땅에)
    const th = 52 * e, kn = 100 * e;
    if (r && e > 0.001) {
      const [lt, ls] = legLen();
      crouch(lt * (1 - Math.cos(th * D2R)) + ls * (1 - Math.cos((kn - th) * D2R)));   // person 위치는 물리 몸체와 묶여 있어 건드리지 않고 모델만 내린다
      person.updateMatrixWorld(true);
      poser.leg(1, -th - 6 * e, 6, kn + 4 * e); poser.leg(-1, -th + 6 * e, 6, kn - 10 * e);
      if (r.chest) poser.rotXYZ(r.chest, 32 * e, 0, 0);
      person.updateMatrixWorld(true); poser.placeFeet();
    }
    // 박격포 놓기: 내려놓은 자리(앞 0.5 m 땅) ↔ 든 자세(허리 앞) 사이를 섞는다
    const tl = MORTAR.tilt * D2R;
    _o2.set(p.x + _o1.x * 0.42 + _o1.z * 0.22, 0, p.z + _o1.z * 0.42 - _o1.x * 0.22); _o2.y = groundY(_o2.x, _o2.z) + 0.02;   // 앞 0.42 m, 왼쪽 0.22 m
    _o3.copy(_o1).multiplyScalar(Math.sin(tl)).addScaledVector(UP, Math.cos(tl));                 // 내려놓은 통 방향
    poser.pt(_v, -0.08, 0.78, 0.3);                                                                // 든 자리
    _v2.copy(_o1).multiplyScalar(0.85).addScaledVector(UP, 0.5).normalize();
    _v.lerp(_o2, e); _v3.copy(_v2).lerp(_o3, e).normalize();
    _o4.copy(_o1).addScaledVector(UP, -0.3 * e);
    placeModel(m, _v, _v3, _o4);
    _o3.copy(_v3);   // 통 축 (월드)
    // 왼손: 통 윗부분을 쥔다
    _tgt2.copy(m.userData.hold).applyMatrix4(m.matrixWorld);
    if (r) { poser.rel(_pole, r.armL[0], 0.6, -0.8, -0.2); ikGrip(1, _tgt2, _pole, _o3, _o1, _v6); }
    // 오른손: 장전돼 있고 내려놓았으면 포탄을 포구 위에 들고 있다가, 클릭하면 떨어뜨린다
    _o2.copy(m.userData.muzzle).applyMatrix4(m.matrixWorld);
    let drop = 0;
    if (mortarS.fireT >= 0) {
      mortarS.fireT += dt;
      drop = Math.min(1, mortarS.fireT / MORTAR.drop);
      if (!S.thrown && drop >= 1) { S.thrown = true; fireShell(); }
      if (mortarS.fireT > MORTAR.drop + 0.45) mortarS.fireT = -1;
    }
    const holding = (S.loaded && e > 0.6 && mortarS.fireT < 0) || (mortarS.fireT >= 0 && !S.thrown);
    if (holding) {
      _tgt.copy(_o2).addScaledVector(UP, 0.26 - 0.2 * smooth(drop)).addScaledVector(_o1, -0.1);
      if (r) { poser.rel(_pole, r.armR[0], -0.7, -0.8, -0.3); ikGrip(-1, _tgt, _pole, UP, _o1, _hand, 0.75); }
      placeModel(shellHand, _hand, UP, _o1);
    } else {
      shellHand.visible = false;
      _tgt.copy(_v).addScaledVector(_o3, 0.25 + 0.15 * (1 - e));
      if (r) { poser.rel(_pole, r.armR[0], -0.7, -0.8, -0.3); ikGrip(-1, _tgt, _pole, _o3, _o1, _hand); }
    }
    if (mortarS.fireT < 0) S.thrown = false;
  }

  /* ════ 자세·무기 배치 ════ */
  function keyPose(keys, u, outHand, outBlade, out) {
    let i = 0; while (i < keys.length - 2 && u > keys[i + 1].t) i++;
    const a = keys[i], b = keys[i + 1], f = smooth(Math.max(0, Math.min(1, (u - a.t) / Math.max(1e-4, b.t - a.t))));
    outHand.set(a.hand[0] + (b.hand[0] - a.hand[0]) * f, a.hand[1] + (b.hand[1] - a.hand[1]) * f, a.hand[2] + (b.hand[2] - a.hand[2]) * f);
    outBlade.set(a.blade[0] + (b.blade[0] - a.blade[0]) * f, a.blade[1] + (b.blade[1] - a.blade[1]) * f, a.blade[2] + (b.blade[2] - a.blade[2]) * f).normalize();
    out.tw = a.tw + (b.tw - a.tw) * f; out.pt = a.pt + (b.pt - a.pt) * f;
  }
  const kp = { tw: 0, pt: 0 };
  /* 손 위치·날 방향(사람 공간)으로 팔 IK + 무기 배치 */
  function poseMelee(handP, bladeP, tw, pt, two, model, len) {
    const r = poser.rig;
    if (r) {
      if (r.chest && (tw || pt)) poser.rotXYZ(r.chest, pt, tw, 0);
      poser.pt(_tgt, handP.x, handP.y, handP.z);
      poser.rel(_pole, r.armR[0], -0.8, -0.7, -0.4);
      poser.ik(-1, _tgt, _pole);
      poser.dir(_blade, bladeP.x, bladeP.y, bladeP.z);
    } else { poser.pt(_tgt, handP.x, handP.y, handP.z); poser.dir(_blade, bladeP.x, bladeP.y, bladeP.z); }
    // 공격면 방향 = 사람 앞쪽을 날에 수직으로
    poser.dir(_edge, 0, 0, 1); _edge.addScaledVector(_blade, -_edge.dot(_blade));
    if (_edge.lengthSq() < 1e-4) poser.dir(_edge, 0, 1, 0);
    _edge.normalize();
    grip(-1, _blade, _edge, _hand, model === models.bomb ? 0.55 : 1);
    placeModel(model, _hand, _blade, _edge);
    if (two && r) {   // 왼손은 오른손 바로 아래 자루를 같이 쥔다
      _tgt2.copy(_hand).addScaledVector(_blade, -0.1);
      poser.rel(_pole, r.armL[0], 0.8, -0.7, -0.4);
      ikGrip(1, _tgt2, _pole, _blade, _edge, _v3);
    }
    if (len && S.attackT >= 0) {
      const M_ = MELEE[S.cur];
      const u = S.attackT / M_.dur;
      if (u >= M_.trail[0] && u <= M_.trail[1]) { _v.copy(_hand).addScaledVector(_blade, len * 0.35); _v2.copy(_hand).addScaledVector(_blade, len); trailPush(_v, _v2); }
    }
  }
  const _hw = new V();
  function handWorld(out) {
    const r = poser.rig;
    if (!r) return out.copy(_tgt);
    r.armR[2].getWorldPosition(out); r.armR[1].getWorldPosition(_hw);
    _hw.subVectors(out, _hw).normalize();
    return out.addScaledVector(_hw, 0.075);
  }
  function handWorldL(out) {
    const r = poser.rig;
    if (!r) return out.copy(_tgt2);
    r.armL[2].getWorldPosition(out); r.armL[1].getWorldPosition(_hw);
    _hw.subVectors(out, _hw).normalize();
    return out.addScaledVector(_hw, 0.075);
  }
  /* ════ 손으로 쥐기 ════
     IK 는 손목 '위치'만 맞춘다. 여기서 손목을 돌려 손바닥이 자루를 감싸게 하고 손가락을 말아 주먹을 쥔다.
     axis  = 자루 방향(새끼손가락 → 검지 쪽으로 빠져나가는 쪽, 칼이면 날 쪽)
     front = 손가락 뼈(손등 마디)가 향할 방향 (칼·도끼면 날의 앞, 총이면 총구 쪽)
     → 손바닥 가운데(자루가 지나는 점)를 out 에 돌려준다. 손가락 뼈 이름은 person.glb(Quaternius) 그대로. */
  const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
  let hands = null;
  function handRig() {
    if (hands) return hands;
    const r = poser.rig; if (!r) return null;
    const b = n => r.model.getObjectByName(n) || r.model.getObjectByName(n.replace(/([LR])$/, '.$1'));
    const mk = (side, wrist) => {
      const S_ = side > 0 ? 'L' : 'R';
      const f = FINGERS.map(n => [1, 2, 3, 4].map(k => b(n + k + S_)).filter(Boolean));   // 1 = 손바닥 뼈(손목에서 시작), 2~4 = 마디
      const th = [1, 2, 3].map(k => b('Thumb' + k + S_)).filter(Boolean);
      if (!wrist || f.some(c => c.length < 4)) return null;
      const all = [wrist, ...f.flat(), ...th];
      return { side, wrist, f, th, rest: all.map(o => [o, o.quaternion.clone()]), nSign: 0 };
    };
    hands = { R: mk(-1, r.armR[2]), L: mk(1, r.armL[2]) };
    return hands;
  }
  const _g = new V(), _f = new V(), _n = new V(), _a = new V(), _k = new V(), _w = new V(), _t1 = new V();
  const _mA = new THREE.Matrix4(), _mB = new THREE.Matrix4(), _qA = new Q(), _qB = new Q(), _qP = new Q();
  const wp = (o, out) => o.getWorldPosition(out);
  function handFrame(H) {   // 지금 손의 축: _g(새끼→검지), _f(손목→가운데 손가락), _n(손바닥 쪽)
    wp(H.f[0][1], _g); wp(H.f[3][1], _t1); _g.sub(_t1);   // 검지·새끼 첫 마디(손가락 뿌리)
    wp(H.f[1][1], _f); wp(H.wrist, _w); _f.sub(_w);
    _g.addScaledVector(_f, -_g.dot(_f) / Math.max(1e-8, _f.lengthSq())).normalize(); _f.normalize();
    _n.crossVectors(_g, _f);
    if (!H.nSign) {   // 손바닥 쪽 부호: 엄지 끝이 있는 쪽 (한 번만 정한다 — 쉬는 자세에서)
      wp(H.th[H.th.length - 1], _t1).sub(_w);
      H.nSign = _t1.dot(_n) >= 0 ? 1 : -1;
    }
    _n.multiplyScalar(H.nSign);
  }
  /* 손목을 world 회전 R 만큼 더 돌린다 */
  function rotWorld(bone, q) {
    if (!(Math.abs(q.lengthSq() - 1) < 1e-3)) { gripBad++; return; }   // 망가진 회전은 버린다 (한 번 0 이 되면 계속 0)
    bone.parent.getWorldQuaternion(_qP);
    _qB.copy(_qP).invert().multiply(q).multiply(_qP);
    bone.quaternion.premultiply(_qB); bone.updateMatrixWorld(true);
  }
  /* palm = true 이면 front 대신 '손바닥이 향할 방향'으로 받는다 (석궁 앞 손: 손바닥 위로 등) */
  function grip(side, axis, front, out, curl = 1, palm = false) {
    const thumb = curl;
    const hr = handRig(); const H = hr && (side > 0 ? hr.L : hr.R);
    if (!H) return side > 0 ? handWorldL(out) : handWorld(out);
    for (const [o, q] of H.rest) o.quaternion.copy(q);           // 손가락은 매번 쉬는 자세에서 시작
    H.wrist.updateMatrixWorld(true);
    handFrame(H);
    // 지금 (g, f, n) → 목표 (axis, front⊥, n') 로 손목 회전
    _a.copy(axis).normalize();
    if (palm) _k.crossVectors(front, _a).multiplyScalar(H.nSign);   // 손바닥 n = nSign·(axis × f) → f = nSign·(palm × axis)
    else _k.copy(front);
    _k.addScaledVector(_a, -_k.dot(_a)); if (_k.lengthSq() < 1e-6) _k.set(0, 1, 0); _k.normalize();
    _mA.makeBasis(_g, _f, _t1.crossVectors(_g, _f));
    _mB.makeBasis(_a, _k, _w.crossVectors(_a, _k));
    _qA.setFromRotationMatrix(_mB.multiply(_mA.transpose()));      // R = B · Aᵀ
    rotWorld(H.wrist, _qA);
    handFrame(H);
    // 손가락 말기: 손가락 방향을 손바닥 쪽으로 (축 = f × n)
    if (curl > 0) {
      _t1.crossVectors(_f, _n).normalize();
      const ang = [62, 88, 58];
      for (const chain of H.f) for (let j = 0; j < 3; j++) { _qA.setFromAxisAngle(_t1, ang[j] * D2R * curl); rotWorld(chain[j + 1], _qA); }
      if (thumb > 0 && H.th.length >= 2) {   // 엄지는 자루 위로 덮는다
        _qA.setFromAxisAngle(_t1, 25 * D2R * thumb); rotWorld(H.th[0], _qA);
        for (let j = 1; j < H.th.length; j++) { _qA.setFromAxisAngle(_t1, 35 * D2R * thumb); rotWorld(H.th[j], _qA); }
      }
    }
    // 손바닥 가운데 = 손가락 첫 마디 줄과 손목 사이, 손바닥 쪽으로 조금
    wp(H.f[1][1], _k); wp(H.f[2][1], _t1); _k.add(_t1).multiplyScalar(0.5);
    const hl = _k.distanceTo(_w);
    return out.copy(_w).lerp(_k, 0.86).addScaledVector(_n, hl * GRIP_PALM);
  }
  let GRIP_PALM = 0.38, gripBad = 0;
  /* 손바닥 점(grip)이 target 에 오도록 손목 IK 를 한 번 보정 */
  function ikGrip(side, target, pole, axis, front, out, curl = 1, palm = false) {
    poser.ik(side, target, pole);
    grip(side, axis, front, out, curl, palm);
    _tgt2b.copy(target).multiplyScalar(2).sub(out);   // 손목 목표를 (target - grip) 만큼 옮긴다
    poser.ik(side, _tgt2b, pole);
    return grip(side, axis, front, out, curl, palm);
  }
  const _tgt2b = new V();

  /* y = 주축(자루→날 / 위), z = 앞(공격면 / 총구) */
  function placeModel(model, pos, yAxis, zAxis) {
    _by.copy(yAxis).normalize();
    _bz.copy(zAxis).addScaledVector(_by, -zAxis.dot(_by)).normalize();
    _bx.crossVectors(_by, _bz);
    _m.makeBasis(_bx, _by, _bz);
    model.quaternion.setFromRotationMatrix(_m);
    model.position.copy(pos);
    model.visible = true;
    model.updateMatrixWorld(true);
  }

  /* 모델 로컬 방향 v 가 (yAxis, zAxis) 로 놓였을 때의 월드 방향 */
  const _bq = new Q(), _o1 = new V(), _o2 = new V(), _o3 = new V(), _o4 = new V();
  function basisDir(yAxis, zAxis, v, out) {
    _by.copy(yAxis).normalize(); _bz.copy(zAxis).addScaledVector(_by, -zAxis.dot(_by)).normalize(); _bx.crossVectors(_by, _bz);
    _m.makeBasis(_bx, _by, _bz); _bq.setFromRotationMatrix(_m);
    return out.copy(v).applyQuaternion(_bq);
  }
  function poseAim(dt) {
    const r = poser.rig, id = S.cur, m = models[id];
    _v6.subVectors(aim.point, person.position); _v6.y = 0;
    // 조준 방향 (어깨 → 조준점)
    const sh = r ? r.armR[0].getWorldPosition(_v5) : poser.pt(_v5, -0.2, 1.5, 0);
    _v4.subVectors(aim.point, sh);
    if (_v4.lengthSq() < 0.25) poser.dir(_v4, 0, 0, 1);
    _v4.normalize();
    const reach = r ? (r.lenUp + r.lenLo) : 0.6;
    S.recoil = Math.max(0, S.recoil - dt * 6);
    if (id === 'pistol') {   // 팔을 쭉 뻗어 조준, 손잡이를 주먹으로 감싼다 (검지 쪽이 총구)
      const reloadK = S.loaded ? 0 : Math.sin(Math.min(1, 1 - S.reload / 1.2) * Math.PI);   // 장전 중엔 총을 내린다
      _tgt.copy(sh).addScaledVector(_v4, reach * (0.9 - reloadK * 0.3));
      _tgt.y += S.recoil * 0.08 - reloadK * 0.35;
      if (r) { poser.rel(_pole, r.armR[0], -0.4, -1, -0.2); poser.ik(-1, _tgt, _pole); }
      _v.copy(_v4); _v.y += S.recoil * 0.5 - reloadK * 0.9; _v.normalize();
      _v2.copy(UP).addScaledVector(_v, -UP.dot(_v));
      basisDir(_v2, _v, m.userData.gripAxis || UP, _o1);
      grip(-1, _o1, _v, _hand);
      placeModel(m, _hand, _v2, _v);
    } else if (id === 'bow') {   // 왼손이 활 손잡이를 쥐고 팔을 뻗는다, 오른손은 시위를 당긴다
      const shL = r ? r.armL[0].getWorldPosition(_v3) : poser.pt(_v3, 0.2, 1.5, 0);
      _v4.subVectors(aim.point, shL).normalize();
      _tgt2.copy(shL).addScaledVector(_v4, reach * 0.93);
      _v2.copy(UP).addScaledVector(_v4, -UP.dot(_v4)).normalize();
      _v2.addScaledVector(_o1.crossVectors(_v4, _v2), 0.18).normalize();   // 살짝 눕힌다
      if (r) poser.rel(_pole, r.armL[0], 0.3, -1, -0.3);
      if (r) poser.ik(1, _tgt2, _pole);
      grip(1, _v2, _v4, _v);   // 활 손잡이 = 왼손 손바닥
      placeModel(m, _v, _v2, _v4);
      // 시위·화살
      const pull = 0.14 + 0.5 * S.draw;
      _tgt.copy(_v).addScaledVector(_v4, -pull - 0.12);
      if (r) { poser.rel(_pole, r.armR[0], -0.9, -0.3, -0.6); poser.ik(-1, _tgt, _pole); }
      grip(-1, _v2, _v4, _o2, 0.55);   // 시위를 손가락으로 건다
      updateString(m, -0.17 - (S.drawing ? 0.5 * S.draw : 0));
      if (S.cool <= 0) {
        _v5.copy(_v).addScaledVector(_v4, -0.17 - (S.drawing ? 0.5 * S.draw : 0));
        placeModel(nocked, _v5, _v2, _v4);
      } else nocked.visible = false;
    } else if (id === 'crossbow') {   // 개머리를 어깨에, 오른손은 방아쇠 손목, 왼손은 앞 몸통 아래를 받친다
      const reloadK = S.loaded ? 0 : Math.sin(Math.min(1, 1 - S.reload / 1.5) * Math.PI);
      _tgt.copy(sh).addScaledVector(_v4, 0.22); _tgt.y -= 0.0 + reloadK * 0.3;
      poser.dir(_v, -0.05, 0, 0); _tgt.add(_v);
      if (r) { poser.rel(_pole, r.armR[0], -0.6, -1, -0.6); poser.ik(-1, _tgt, _pole); }
      _v.copy(_v4); _v.y += S.recoil * 0.4 - reloadK * 0.8; _v.normalize();
      _v2.copy(UP).addScaledVector(_v, -UP.dot(_v));
      _o1.copy(_v2).addScaledVector(_v, 0.35).normalize();
      grip(-1, _o1, _v, _hand);
      placeModel(m, _o2.copy(_hand).addScaledVector(_v2, 0.035), _v2, _v);
      _tgt2.set(0, -0.045, 0.3).applyMatrix4(m.matrixWorld);
      if (r) { poser.rel(_pole, r.armL[0], 0.5, -1, -0.2); ikGrip(1, _tgt2, _pole, _v, _v2, _o3, 0.8, true); }
      updateString(m, S.loaded ? 0.0 : 0.3 + 0.05 * reloadK);
      if (m.userData.bolt) m.userData.bolt.visible = S.loaded;
    } else if (id === 'bazooka') {   // 오른 어깨에 통을 얹고, 오른손 권총 손잡이·왼손 앞 손잡이
      const reloadK = S.loaded ? 0 : Math.sin(Math.min(1, 1 - S.reload / BAZ.reload) * Math.PI);
      _v.copy(_v4); _v.y += S.recoil * 0.25 - reloadK * 0.25; _v.normalize();
      _v2.copy(UP).addScaledVector(_v, -UP.dot(_v)).normalize();
      // 통의 어깨 받침(로컬 z=-0.22)이 어깨 위에 오게
      poser.dir(_o1, -0.05, 0, 0);
      _o2.copy(sh).add(_o1).addScaledVector(_v2, 0.085 + BAZ.tubeY * 0).addScaledVector(_v, -S.recoil * 0.06);
      _o3.copy(_o2).addScaledVector(_v, 0.22).addScaledVector(_v2, -BAZ.tubeY);   // 모델 원점 = 오른손 손잡이
      placeModel(m, _o3, _v2, _v);
      _tgt.copy(_o3);
      if (r) { poser.rel(_pole, r.armR[0], -0.5, -1, -0.3); ikGrip(-1, _tgt, _pole, _o4.copy(_v2).addScaledVector(_v, 0.25).normalize(), _v, _hand); }
      _tgt2.copy(m.userData.front).applyMatrix4(m.matrixWorld);
      if (r) { poser.rel(_pole, r.armL[0], 0.4, -1, -0.1); ikGrip(1, _tgt2, _pole, _o4.copy(_v2).addScaledVector(_v, 0.2).normalize(), _v, _o1); }
      if (m.userData.rocket) m.userData.rocket.visible = S.loaded || reloadK > 0.6;
    }
  }
  function updateString(m, nockZ) {
    const s = m.userData.string; if (!s) return;
    const a = s.geometry.attributes.position.array, t = m.userData.tips;
    a[0] = t[0].x; a[1] = t[0].y; a[2] = t[0].z;
    a[3] = 0; a[4] = m === models.crossbow ? 0.03 : 0; a[5] = nockZ;
    a[6] = t[1].x; a[7] = t[1].y; a[8] = t[1].z;
    s.geometry.attributes.position.needsUpdate = true;
  }

  function poseThrowables(dt) {
    const id = S.cur, m = models[id];
    if (id === 'javelin') {
      S.charge = S.charging ? Math.min(1, S.charge + dt / 0.8) : S.charge;
      let hp, bl;
      if (S.charging) {   // 머리 위로 들어 뒤로 당긴다
        _v.set(-0.3, 1.72, -0.05 - 0.25 * S.charge); hp = _v;
        aimDirPerson(_v2, 0.12 + S.charge * 0.06); bl = _v2;
      } else if (S.throwT >= 0) {
        const u = Math.min(1, S.throwT / 0.4);
        _v.set(-0.3 + 0.12 * u, 1.72 - 0.3 * u, -0.3 + 0.85 * smooth(u)); hp = _v;
        aimDirPerson(_v2, 0.15 - 0.4 * u); bl = _v2;
        if (!S.thrown && u >= 0.45) {
          S.thrown = true;
          const spd = 10 + 20 * Math.max(0.25, S.charge);
          ballistic(_hand, aim.point, spd, 9.8, _v3);
          if (aim.dist < 3) poser.dir(_v3, 0, 0.2, 1).normalize().multiplyScalar(spd);
          spawnProj('javelin', m, _v4.copy(_hand).addScaledVector(_v3.clone().normalize(), -0.2), _v3, { g: 9.8 });
          S.cool = 0.9; S.charge = 0;
        }
        if (S.throwT > 0.6) S.throwT = -1;
      } else { hp = _v.fromArray(HOLD.javelin.hand); bl = _v2.fromArray(HOLD.javelin.blade).normalize(); }
      // 투창은 +Z 가 촉 → '날 방향'을 +Z 로 쓴다
      poseHandOnly(hp);
      poser.dir(_blade, bl.x, bl.y, bl.z);
      _edge.copy(UP).addScaledVector(_blade, -UP.dot(_blade));
      // 던질 땐 머리 위에서 손바닥을 위로(창대가 손바닥에 얹힌다), 들고 다닐 땐 지팡이처럼 손등이 앞
      if (S.charging || S.throwT >= 0) grip(-1, _blade, UP, _hand, 1, true);
      else grip(-1, _blade, poser.dir(_o1, 0, 0, 1), _hand);
      if (S.cool > 0 && S.throwT < 0) m.visible = false;
      else placeModel(m, _hand, _edge, _blade);
      if (S.thrown && S.throwT >= 0) m.visible = false;
    } else if (id === 'bomb') {
      if (S.throwT >= 0) {
        const u = Math.min(1, S.throwT / BOMB_THROW.dur);
        keyPose(BOMB_THROW.keys, u, _v, _v2, kp);
        poseMelee(_v, _v2, kp.tw, kp.pt, false, m, 0);
        if (!S.thrown && u >= BOMB_THROW.rel) {
          S.thrown = true;   // _hand = poseMelee 가 잡은 손바닥 점
          const d = Math.min(18, Math.hypot(aim.point.x - _hand.x, aim.point.z - _hand.z));
          const T = Math.max(0.55, Math.min(1.3, d / 11));
          _v3.subVectors(aim.point, _hand);
          if (d >= 17.9) { const s = 18 / Math.hypot(_v3.x, _v3.z); _v3.x *= s; _v3.z *= s; }
          _v3.set(_v3.x / T, (_v3.y + 0.5 * 9.8 * T * T) / T, _v3.z / T);
          spawnProj('bomb', m, _hand, _v3, { g: 9.8, fuse: 2.5, spin: rand(4, 8) });
          alarmNoise('bomb', aim.point);   // 도화선 보고 도망
          S.cool = 1.2;
        }
        if (u >= 1) S.throwT = -1;
        if (S.thrown) m.visible = false;
      } else {
        keyPose([HOLD.bomb, HOLD.bomb], 0, _v, _v2, kp);
        poseMelee(_v, _v2, 0, 0, false, m, 0);
        if (S.cool > 0) m.visible = false;
        else { // 손에 든 폭탄 도화선 불꽃
          const f = m.userData.fuse; _v.copy(f).applyMatrix4(m.matrixWorld);
          if (Math.random() < 0.25) puff(_v.x, _v.y, _v.z, rand(-0.3, 0.3), rand(0.3, 0.8), rand(-0.3, 0.3), 0xffb43a, 0.035, 0.01, 0.2, 0.9, true, 3, 0.6);
        }
      }
    }
  }
  /* 조준 방향(사람 공간) + 위로 lift */
  function aimDirPerson(out, lift) {
    _v3.subVectors(aim.point, person.position); _v3.y = 0;
    const inv = _q.copy(poser.personQ).invert();
    _v3.applyQuaternion(inv);
    const h = Math.hypot(_v3.x, _v3.z) || 1;
    return out.set(_v3.x / h, lift, _v3.z / h).normalize();
  }
  function poseHandOnly(hp) {
    const r = poser.rig;
    poser.pt(_tgt, hp.x, hp.y, hp.z);
    if (r) { poser.rel(_pole, r.armR[0], -0.8, -0.6, -0.5); poser.ik(-1, _tgt, _pole); }
  }

  function poseFlail(dt) {
    const m = models.flail;
    let hp;
    if (S.spinT >= 0) {
      S.spinT += dt;
      const w = Math.min(14, 4 + S.spinT * 10);
      const prevA = S.spinAng; S.spinAng += w * dt;
      if (Math.floor(prevA / (Math.PI * 2)) !== Math.floor(S.spinAng / (Math.PI * 2))) SND.whoosh(0.7 + Math.min(1, S.spinT));
      _v.set(-0.12 + Math.cos(S.spinAng) * 0.06, 1.92, 0.08 + Math.sin(S.spinAng) * 0.06); hp = _v;
      poseHandOnly(hp);
      _blade.copy(UP); poser.dir(_edge, 0, 0, 1);
      grip(-1, _blade, _edge, _hand);
      placeModel(m, _hand, _blade, _edge);
      _v2.copy(m.userData.anchor).applyMatrix4(m.matrixWorld);
      ball.pos.set(_v2.x + Math.cos(S.spinAng) * 0.85, _v2.y + 0.12, _v2.z + Math.sin(S.spinAng) * 0.85);
      ball.prev.copy(ball.pos);
    } else if (S.slamT >= 0) {
      S.slamT += dt;
      const u = Math.min(1, S.slamT / 0.45);
      _v.set(-0.15, 1.9 - 1.0 * smooth(u), 0.1 + 0.5 * smooth(u)); hp = _v;
      poseHandOnly(hp);
      poser.dir(_blade, 0, 1 - 1.4 * smooth(u), 0.4 + 0.6 * u); poser.dir(_edge, 0, 0, 1);
      _blade.normalize(); grip(-1, _blade, _edge, _hand);

      placeModel(m, _hand, _blade, _edge);
      // 공은 머리 위 → 앞 땅으로 포물선
      const yaw = S.attackYaw, px = person.position.x + Math.sin(yaw) * 1.9, pz = person.position.z + Math.cos(yaw) * 1.9;
      _v3.set(px, groundY(px, pz) + 0.09, pz);
      const k = smooth(Math.min(1, u / 0.6));
      _v4.copy(S.slamFrom).lerp(_v3, k); _v4.y += Math.sin(k * Math.PI) * 0.8;
      ball.pos.copy(_v4); ball.prev.copy(_v4);
      if (!S.hitDone && u >= 0.6) { S.hitDone = true; areaHit(_v3, 2.2, 7, 'flail'); }
      if (u >= 1) { S.slamT = -1; }
    } else {
      keyPose([HOLD.flail, HOLD.flail], 0, _v, _v2, kp);
      poseMelee(_v, _v2, 0, 0, false, m, 0);
    }
    // 사슬 끝 공 (진자)
    _v2.copy(m.userData.anchor).applyMatrix4(m.matrixWorld);
    if (!ball.init) { ball.pos.copy(_v2).y -= CHAIN_L; ball.prev.copy(ball.pos); ball.init = true; }
    if (S.spinT < 0 && S.slamT < 0) {
      _v.subVectors(ball.pos, ball.prev).multiplyScalar(0.985);
      ball.prev.copy(ball.pos); ball.pos.add(_v); ball.pos.y -= 9.8 * dt * dt;
      _v.subVectors(ball.pos, _v2); const l = _v.length() || 1;
      ball.pos.copy(_v2).addScaledVector(_v, CHAIN_L / l);
      const gy = groundY(ball.pos.x, ball.pos.z) + 0.09; if (ball.pos.y < gy) ball.pos.y = gy;
    }
    flailBall.position.copy(ball.pos); flailBall.visible = true;
    flailBall.rotation.y += dt * 3;
    const a = chainGeo.attributes.position.array;
    for (let i = 0; i < 8; i++) {
      const f = i / 7;
      const sag = S.spinT >= 0 ? 0 : Math.sin(f * Math.PI) * 0.05;
      a[i * 3] = _v2.x + (ball.pos.x - _v2.x) * f; a[i * 3 + 1] = _v2.y + (ball.pos.y - _v2.y) * f - sag; a[i * 3 + 2] = _v2.z + (ball.pos.z - _v2.z) * f;
    }
    chainGeo.attributes.position.needsUpdate = true; chain.visible = true;
    updateChainLinks(_v2, S.spinT < 0);
  }

  /* ── 근접 판정 ── */
  function meleeHit() {
    const w = S.cur, def = MELEE[w], p = person.position, yaw = S.attackYaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), half = def.cone / 2 * D2R;
    let any = false;
    for (const n of npcList()) {
      if (n.off) continue;
      const dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz);
      if (d > def.range || d < 1e-3) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d)));
      if (ang > half) continue;
      any = true;
      const ux = dx / d, uz = dz / d;
      if (w === 'sword') {
        const now = clock, h = hitCount.get(n);
        const c = h && now - h.t < 4 ? h.c + 1 : 1;
        hitCount.set(n, { c, t: now });
        if (c >= 2) { knock(n, { x: ux * 5, y: 2.5, z: uz * 5 }, 'sword'); hitCount.delete(n); }
        else stagger(n, { x: ux * 3, y: 0, z: uz * 3 });
      } else if (w === 'axe') knock(n, { x: ux * 6, y: 3, z: uz * 6 }, 'axe');
      else if (w === 'hammer') knock(n, { x: ux * 11, y: 5.5, z: uz * 11 }, 'hammer');
      else if (w === 'pan') panHit(n, ux, uz);
      _v.set(n.x, n.y + 1.35, n.z);
      puff(_v.x, _v.y, _v.z, 0, 0.2, 0, 0xffffff, 0.2, 0.75, 0.3, 0.9);
      sparks(_v.x, _v.y, _v.z, w === 'pan' ? 6 : 10, w === 'pan' ? 0xfff6c0 : 0xffc14a);
    }
    for (const b of toyBlocks) {
      if (!b || !b.body) continue;
      const bp = b.body.position, dx = bp.x - p.x, dz = bp.z - p.z, d = Math.hypot(dx, dz);
      if (d > def.range + 0.3 || d < 1e-3) continue;
      if (Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d))) > half) continue;
      const k = w === 'hammer' ? 9 : w === 'axe' ? 6 : 4;
      pushBlock(b, dx / d * k, k * 0.4, dz / d * k, k * 0.6);
      sparks(bp.x, bp.y, bp.z, 4, 0xe8c48a, 2);
      any = true;
    }
    if (any) {
      if (w === 'pan') SND.ding(); else if (w === 'hammer' || w === 'axe') SND.thud(w === 'hammer' ? 0.8 : 1); else SND.knock();
      shake(w === 'hammer' ? 0.22 : w === 'axe' ? 0.16 : 0.07);
    }
  }
  function panHit(n, ux, uz) {
    const a = api();
    if (a && a.spin) { a.spin(n, 2, 0.6); setTimeout(() => knock(n, { x: ux * 2, y: 1.5, z: uz * 2 }, 'pan'), 600); dizzy.push({ n, t: 0, own: false, rot0: 0 }); }
    else dizzy.push({ n, t: 0, own: true, rot0: n.rot || 0, ux, uz, fell: false });
  }
  function stepDizzy(dt) {
    let si = 0;
    for (let i = dizzy.length - 1; i >= 0; i--) {
      const d = dizzy[i]; d.t += dt;
      if (d.own && d.t < 0.6) { d.n.rot = d.rot0 + Math.PI * 4 * smooth(d.t / 0.6); if (d.n.root) d.n.root.rotation.y = d.n.rot; }
      if (d.own && !d.fell && d.t >= 0.6) { d.fell = true; knock(d.n, { x: d.ux * 2, y: 1.5, z: d.uz * 2 }, 'pan'); }
      if (d.t > 2.4) { dizzy.splice(i, 1); continue; }
      // 머리 위 별 3개
      const h = d.t < 0.6 ? 2.1 : 2.1 - Math.min(1, (d.t - 0.6) / 0.5) * 1.6;
      const x = d.n.root ? d.n.root.position.x : d.n.x, z = d.n.root ? d.n.root.position.z : d.n.z, y = d.n.y + h;
      for (let k = 0; k < 3 && si < stars.length; k++, si++) {
        const a = d.t * 6 + k * Math.PI * 2 / 3, s = stars[si];
        s.position.set(x + Math.cos(a) * 0.35, y + Math.sin(a * 2) * 0.05, z + Math.sin(a) * 0.35);
        s.material.opacity = Math.min(1, (2.4 - d.t) * 2); s.material.rotation = a; s.visible = true;
      }
    }
    for (; si < stars.length; si++) stars[si].visible = false;
  }
  function areaHit(center, radius, force, cause) {
    if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.z)) return;
    for (const n of npcList()) {
      if (n.off) continue;
      const dx = n.x - center.x, dz = n.z - center.z, d = Math.hypot(dx, dz);
      if (!(d <= radius)) continue;
      const l = d || 1, k = 1 - d / radius * 0.5;
      knock(n, { x: dx / l * force * k, y: 3.5, z: dz / l * force * k }, cause);
    }
    for (const b of toyBlocks) {
      if (!b || !b.body) continue;
      const bp = b.body.position, dx = bp.x - center.x, dz = bp.z - center.z, d = Math.hypot(dx, dz);
      if (d > radius + 0.3) continue;
      const l = d || 1; pushBlock(b, dx / l * force * 0.8, force * 0.6, dz / l * force * 0.8, 5);
    }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; puff(center.x, center.y + 0.1, center.z, Math.cos(a) * 4, 0.5, Math.sin(a) * 4, 0xa88a62, 0.3, 1.0, 0.8, 0.6, false, 0, 3); }
    sparks(center.x, center.y + 0.1, center.z, 10, 0xffc14a, 4);
    shockRing(center.x, center.y, center.z, radius * 1.2, 0.4, 0xe8d2a8);
    SND.thud(0.7); shake(0.25);
  }

  /* ════ HUD ════ */
  const ICON = {
    none: '<path d="M7 11V7.5a1.5 1.5 0 0 1 3 0V10"/><path d="M10 9.5V6.5a1.5 1.5 0 0 1 3 0V10"/><path d="M13 9.5V7a1.5 1.5 0 0 1 3 0v3"/><path d="M16 9.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1.5A5.5 5.5 0 0 1 6 14.5V12a1.5 1.5 0 0 1 3 0"/>',
    sword: '<path d="M14.5 3.5 20.5 3.5 20.5 9.5 9 21 6.5 18.5"/><path d="M4 14l6 6M3.5 20.5l2-2"/>',
    axe: '<path d="M14 6 5 21"/><path d="M12.5 3.5c3 0 6.5 2 8 6l-5 2-4-4z"/>',
    hammer: '<path d="M13 9 4 21"/><path d="M10.5 5.5l5-3 6 6-3 5z"/>',
    pistol: '<path d="M3 8h15l2 2v2H11l-1 3H7l-1 5H3l1.5-7L3 11z"/><path d="M10 12v2"/>',
    bow: '<path d="M6 3c8 3 11 9 15 15"/><path d="M6 3v15h15"/><path d="M3 21 15 9"/><path d="M15 9h3V6"/>',
    crossbow: '<path d="M4 6c5-3 11-3 16 0"/><path d="M4 6l8 5 8-5"/><path d="M12 4v17"/><path d="M10 18h4"/>',
    flail: '<path d="M4 20l5-5"/><path d="M9 15c1-2 2-4 4-5"/><circle cx="16.5" cy="7.5" r="3.5"/><path d="M16.5 2.5v1.5M21.5 7.5H20M19.8 4.2l-1 1"/>',
    javelin: '<path d="M3 21 18 6"/><path d="M15 3h6v6l-3-1-2-2z"/><path d="M5 17l2 2"/>',
    bomb: '<circle cx="10" cy="14" r="7"/><path d="M14.5 9.5 17 7"/><path d="M17 7c1-1 2-1 3 0M19 3v2M22 5h-2"/>',
    pan: '<circle cx="9" cy="10" r="6"/><path d="M13.5 14 21 21.5"/>',
    bazooka: '<path d="M2 10.5h17l3-1.5v6l-3-1.5H2z"/><path d="M8 13.5v4h2.5l1-4M14 13.5v3"/><path d="M12 7.5h2v3"/>',
    mortar: '<path d="M9 4l5 1.5-4 12-4-1.4z"/><path d="M5 20h10"/><path d="M8.5 17.5 6 20M12 11l5 9"/><circle cx="18.5" cy="4.5" r="1.6"/>',
  };
  const CSS = `
.wp-armed{cursor:none!important}
.wp-bar{position:fixed;right:18px;bottom:18px;z-index:40;display:flex;gap:4px;padding:5px;border-radius:12px;
  background:linear-gradient(180deg,rgba(58,38,22,.88),rgba(38,24,14,.9));border:1px solid #9c7444;box-shadow:0 8px 24px rgba(20,12,6,.35);
  font:12px Georgia,'Nanum Myeongjo',serif;pointer-events:auto}
.wp-bar button{position:relative;width:46px;height:52px;border-radius:8px;border:1px solid rgba(214,180,120,.28);background:rgba(255,240,210,.05);
  color:#e9d8b4;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:0;font:inherit;overflow:hidden}
.wp-bar button:hover{background:rgba(255,240,210,.12)}
.wp-bar button[aria-pressed="true"]{border-color:#f0c66e;background:rgba(240,198,110,.2);color:#fff3d2;box-shadow:inset 0 0 0 1px rgba(240,198,110,.5)}
.wp-bar .k{position:absolute;top:2px;left:4px;font:700 9.5px ui-monospace,monospace;opacity:.6}
.wp-bar .n{font-size:10.5px;line-height:1;white-space:nowrap}
.wp-bar .pr{position:absolute;left:0;bottom:0;height:2px;background:#f0c66e;width:0}
.wp-cross{position:fixed;left:0;top:0;z-index:44;width:46px;height:46px;margin:-23px 0 0 -23px;pointer-events:none;display:none}
.wp-cross.on{display:block}
.wp-cross svg{overflow:visible}
.wp-cross .rg{transition:stroke .1s}
.wp-cross.hot .rg,.wp-cross.hot .tk{stroke:#ff5a3c}
.wp-bar[hidden]{display:none!important}
body.intro-on .wp-bar,body[data-view="doc"] .wp-bar,body.intro-on .wp-cross,body[data-view="doc"] .wp-cross{display:none!important}
@media (max-width:820px){.wp-bar .n{display:none}.wp-bar button{width:34px;height:38px}.wp-bar{bottom:auto;top:64px;right:8px;flex-direction:column}}
`;
  if (!document.getElementById('wp-css')) { const st = document.createElement('style'); st.id = 'wp-css'; st.textContent = CSS; document.head.appendChild(st); }
  const uiRoot = document.getElementById('drive-root') || document.body;
  const bar = document.createElement('div'); bar.className = 'wp-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', '무기');
  bar.innerHTML = [FIST, ...WEAPONS].map(w => `<button type="button" data-id="${w.id}" aria-pressed="false" title="${w.name} (${w.key})"><span class="k">${w.key}</span>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[w.id]}</svg>
    <span class="n">${w.name}</span><i class="pr"></i></button>`).join('');
  const cross = document.createElement('div'); cross.className = 'wp-cross';
  cross.innerHTML = `<svg width="46" height="46" viewBox="-23 -23 46 46" aria-hidden="true">
    <circle r="15" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="3"/>
    <circle class="rg" r="15" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="94.25" stroke-dashoffset="0" transform="rotate(-90)"/>
    <g class="tk" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M0 -21v4M0 17v4M-21 0h4M17 0h4"/></g>
    <circle r="1.8" fill="#fff" stroke="rgba(0,0,0,.5)" stroke-width=".8"/></svg>`;
  uiRoot.append(bar, cross);
  const ringEl = cross.querySelector('.rg');
  const btns = [...bar.querySelectorAll('button')];
  bar.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.id === 'none') holster(); else select(b.dataset.id); if (e.detail > 0) b.blur(); });
  function renderHud() { for (const b of btns) b.setAttribute('aria-pressed', String(b.dataset.id === S.cur)); }
  renderHud();
  function hudFrame(on) {
    const showCross = on && S.cur !== 'none' && mouseIn;
    cross.classList.toggle('on', showCross);
    if (!showCross) return;
    cross.style.transform = `translate(${mouseX}px,${mouseY}px)`;
    let prog = 1;   // 1 = 가득
    const w = S.cur;
    if (w === 'pistol' && !S.loaded) prog = 1 - S.reload / 1.2;
    else if (w === 'crossbow' && !S.loaded) prog = 1 - S.reload / 1.5;
    else if (w === 'bow') prog = S.drawing ? S.draw : S.cool > 0 ? 0 : 1;
    else if (w === 'javelin') prog = S.charging ? S.charge : S.cool > 0 ? 0 : 1;
    else if (w === 'flail') prog = S.spinT >= 0 ? Math.min(1, S.spinT / 0.8) : 1;
    else if (w === 'bomb') prog = S.cool > 0 ? 1 - S.cool / 1.2 : 1;
    else if (w === 'bazooka') prog = S.loaded ? 1 : 1 - S.reload / BAZ.reload;
    else if (w === 'mortar') prog = S.loaded ? mortarS.dep : 1 - S.reload / MORTAR.reload;
    ringEl.style.strokeDashoffset = (94.25 * (1 - prog)).toFixed(1);
    cross.classList.toggle('hot', aim.kind === 'npc');
    const cur = btns.find(b => b.dataset.id === w);
    if (cur) cur.querySelector('.pr').style.width = (prog * 100).toFixed(0) + '%';
  }

  /* ════ 매 프레임 ════ */
  function update(dt, inp) {
    clock += dt;
    const onFoot = !inp || inp.onFoot !== false;
    const ok = onFoot && active() && person.visible;
    poser.ensure(dt);
    crouch(0);
    stepParts(dt); stepProj(dt); stepOrd(dt); stepDizzy(dt);
    tgtRing.visible = false;
    if (bar.hidden !== !onFoot) bar.hidden = !onFoot;   // 운전 중엔 단축 바를 숨긴다
    flashI *= Math.exp(-dt * 18); flashLight.intensity = flashI < 0.05 ? 0 : flashI;
    for (const R of rings) {
      if (!R.r.visible) continue;
      R.t += dt; const k = R.t / R.max;
      if (k >= 1) { R.r.visible = false; continue; }
      R.r.scale.setScalar(0.3 + R.size * (1 - (1 - k) * (1 - k))); R.r.material.opacity = 0.7 * (1 - k);
    }
    trailUpdate();

    const showWeapon = onFoot && person.visible && S.cur !== 'none';
    holder.visible = showWeapon; flailBall.visible = showWeapon && S.cur === 'flail'; chain.visible = flailBall.visible;
    if (!showWeapon) { if (S.wasActive) resetActions(); S.wasActive = false; S.yawActive = false; hudFrame(false); applyShake(dt); debugCam(); return; }
    S.wasActive = true;
    if (!ok) resetActions();

    // 타이머
    if (S.cool > 0) S.cool -= dt;
    if (!S.loaded) { S.reload -= dt; if (S.reload <= 0) { S.loaded = true; SND.click(); } }
    if (S.cur === 'pistol' && !S.loaded) {
      const p = 1 - S.reload / 1.2;
      if (p > 0.3 && p < 0.32) SND.click(); if (p > 0.75 && p < 0.77) SND.click();
    }
    if (S.pendingShot >= 0) { S.pendingShot -= dt; if (S.pendingShot < 0) firePistol(); }
    if (S.drawing) S.draw = Math.min(1, S.draw + dt);

    updateAim();

    // 몸 방향
    const w = S.cur;
    const mortarAim = w === 'mortar' && (mortarS.moveT <= 0 || mortarS.fireT >= 0);
    const facingAim = RANGED[w] || mortarAim || S.attackT >= 0 || S.charging || S.throwT >= 0 || S.spinT >= 0 || S.slamT >= 0;
    if (facingAim) {
      let target = (S.attackT >= 0 || S.slamT >= 0 || (S.throwT >= 0 && w === 'bomb')) ? S.attackYaw : aimYaw();
      if (w === 'bow') target -= 55 * D2R;           // 왼쪽 어깨를 과녁 쪽으로
      else if (w === 'crossbow') target -= 15 * D2R;
      else if (w === 'bazooka') target -= 22 * D2R;   // 왼쪽 어깨를 앞으로 — 왼손이 앞 손잡이에 닿게
      else if (w === 'mortar') { const p = person.position, t = mortarS.fireT >= 0 ? mLock : mTarget; target = Math.atan2(t.x - p.x, t.z - p.z); }
      if (!S.yawActive) { S.yaw = person.rotation.y; S.yawActive = true; }
      S.yaw = angLerp(S.yaw, target, dt * 14);
      person.rotation.y = S.yaw;
    } else S.yawActive = false;
    person.updateMatrixWorld();
    poser.frame();

    if (MELEE[w]) {
      const def = MELEE[w];
      if (S.attackT >= 0) {
        S.attackT += dt;
        const u = Math.min(1, S.attackT / def.dur);
        if (!S.hitDone && u >= def.hitAt) { S.hitDone = true; meleeHit(); }
        keyPose(def.keys, u, _v, _v2, kp);
        if (u >= 1) { S.attackT = -1; if (S.queued) startAttack(); }
      } else keyPose(def.keys, 0, _v, _v2, kp);
      poseMelee(_v, _v2, kp.tw, kp.pt, def.two, models[w], def.len);
    } else if (RANGED[w]) poseAim(dt);
    else if (w === 'flail') poseFlail(dt);
    else if (w === 'mortar') {
      poseMortar(dt);
      if (ok && mortarS.dep > 0.5) {   // 땅 위 목표 고리 (사거리 밖이면 붉게, 끝에 붙는다)
        const t = mortarS.fireT >= 0 ? mLock : mTarget;
        tgtRing.position.set(t.x, t.y + 0.06, t.z);
        const far = Math.max(1, Math.hypot(t.x - person.position.x, t.z - person.position.z) / 14);   // 멀면 크게 (비스듬히 보여서 얇아진다)
        tgtRing.children.forEach((c, k) => { if (k === 2) return; c.userData.p0 ??= c.position.clone(); c.scale.setScalar(far); c.position.copy(c.userData.p0).multiplyScalar(far); });
        tgtRing.scale.setScalar(1 + Math.sin(clock * 6) * 0.06);
        tgtRing.userData.mat.color.setHex(mortarS.inRange ? 0xffa02a : 0xff3a2a);
        tgtRing.userData.mat.opacity = S.loaded ? 0.9 : 0.4;
        tgtRing.visible = true;
      }
    }
    else poseThrowables(dt);
    if (S.throwT >= 0 && w === 'javelin') S.throwT += dt;
    if (S.throwT >= 0 && w === 'bomb') S.throwT += dt;
    if (w !== 'bow') nocked.visible = false;
    if (w !== 'mortar') shellHand.visible = false;

    hudFrame(ok);
    applyShake(dt);
    debugCam();
  }
  /* 디버그: __weapons.inspect(yawDeg, dist, height) — 카메라를 사람 주위 고정 위치로 (자세 확인용). inspect(null) = 끄기 */
  let inspectCam = null;
  function debugCam() {
    if (!inspectCam) return;
    const [yd, dist, h] = inspectCam, p = person.position, a = person.rotation.y + yd * D2R;
    camera.position.set(p.x + Math.sin(a) * dist, p.y + h, p.z + Math.cos(a) * dist);
    camera.lookAt(p.x, p.y + 1.15, p.z);
  }
  function applyShake(dt) {
    if (S.shake < 0.002) return;
    S.shakeT += dt;
    const a = S.shake, t = S.shakeT;
    camera.position.x += (Math.sin(t * 71) + Math.sin(t * 43)) * 0.5 * a * 0.6;
    camera.position.y += (Math.sin(t * 59 + 1) + Math.sin(t * 37)) * 0.5 * a * 0.6;
    camera.rotateZ(Math.sin(t * 53) * a * 0.04);
    S.shake *= Math.exp(-dt * 9);
  }

  const out = {
    get current() { return S.cur; },
    get armed() { return S.cur !== 'none'; },
    get aim() { return aim; },
    list: WEAPONS,
    select, holster, cycle, update, explode, refreshBlocks,
    isBlocked: () => S.cur !== 'none',
    inspect(yawDeg = 0, dist = 2.2, h = 1.4, aimDist = 12) {   // 디버그: 조준점을 사람 앞 aimDist m 땅에 고정
      inspectCam = yawDeg === null ? null : [yawDeg, dist, h];
      if (!inspectCam) { inspectAim = null; return; }
      const p = person.position, a = person.rotation.y;
      if (inspectAim) return;   // 한 번 정한 조준점은 끌 때까지 그대로
      inspectAim = new V(p.x + Math.sin(a) * aimDist, 0, p.z + Math.cos(a) * aimDist); inspectAim.y = groundY(inspectAim.x, inspectAim.z);
    },
    dispose() {
      if (domElement) {
        domElement.removeEventListener('pointerdown', onPointerDown); domElement.removeEventListener('pointermove', onMove);
        domElement.removeEventListener('pointerleave', onLeave); domElement.removeEventListener('wheel', onWheel);
        domElement.classList.remove('wp-armed');
      }
      removeEventListener('pointerup', onPointerUp); removeEventListener('pointercancel', onPointerUp);
      removeEventListener('keydown', onKey); removeEventListener('blur', onBlurWin);
      while (proj.length) killProj(proj.length - 1);
      for (const o of [holder, flailBall, chain, trail, flashLight, ...rings.map(r => r.r), ...parts.map(p => p.sp), ...stars]) scene.remove(o);
      bar.remove(); cross.remove();
    },
  };
  if (debug) { globalThis.__weapons = out; out._dbg = { poser, person, models, S, camera, handRig: () => handRig(), get gripBad() { return gripBad; }, setAim: (x, z) => { inspectAim = x === null ? null : new V(x, groundY(x, z), z); }, get ordCount() { return ord.length; }, get lastBoom() { return lastBoom; }, fire: () => { const w = S.cur; if (w === "bazooka" || w === "mortar") onDown(); }, tune: o => { if (o.palm !== undefined) GRIP_PALM = o.palm; } }; }
  return out;
}
