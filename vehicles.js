/* ════════════════════════════════════════════════════════════
   탈것 바꾸기 — 자동차 · 말 · 마차 · 오토바이 · 자전거
   ────────────────────────────────────────────────────────────
   기존 차 루트(car Group) 안에서 '겉모습'만 갈아 끼운다. 그래서 주행·물리·카메라·
   승하차(F) 코드는 그대로 동작하고, 탈것마다 다른 값(속도·회전·카메라·충돌 상자)만
   params(id)로 받아서 portfolio.js 쪽 변수에 넣어 주면 된다.

   모델은 models/vehicles/*.glb (실제 미터, Draco 압축). 차(4.2 m)와 캐릭터(키 1.95 m)도
   실제 크기에 가까워서 탈것은 scale 1 그대로 쓴다 (CAR_LEN 맞춤 안 함).
   처음 고를 때 한 번만 내려받고 이후엔 캐시를 쓴다. 다 받기 전까지는 지금 탈것을 보여 준다.

   ── portfolio.js 연결 방법 (PM용) ──────────────────────────────

   1) 맨 위 import 근처 (initDrive 밖이어도 되고, initDrive 안에서 동적 import 해도 된다)
        import { createVehicleSwitcher, mountVehicleButton, applyBodyShape } from './vehicles.js';

   2) const 를 let 으로 바꿔야 하는 것 (탈것마다 값이 바뀜)
        const MAX_FWD = 10, MAX_REV = 5, ACCEL = 9, BRAKE = 30, DRAG = 6, TURN = 1.9;
          →  let MAX_FWD = 10, MAX_REV = 5, ACCEL = 9, TURN = 1.9;
             const BRAKE = 30, DRAG = 6;
        const ENTER_CAR_R = 5.5;   →  let ENTER_CAR_R = 5.5;      (마차는 길어서 더 멀리서 탈 수 있게)
      CAM 은 const 그대로 둬도 된다 (객체 속성만 바꾼다: Object.assign(CAM.driving, p.cam)).
      carBody 도 const 그대로 (모양만 applyBodyShape 로 바꾼다).

   3) 생성 위치: 헤드라이트 for 루프(nightGlow.heads.push(hl)) "다음", 그리고 carBody·CAM·
      MAX_FWD 선언 "다음"이면 어디든. (예: '── 주행 ──' 블록 바로 아래, drive() 정의 전)
        const rides = await createVehicleSwitcher({
          THREE, GLTFLoader, dracoLoader: draco,     // 월드 로더용 draco 를 그대로 넘긴다
          carGroup: car, person, scene,
          personClips: () => charClips,              // 앉은 자세 기준(idle 첫 프레임). charClips 는 비동기로 채워지므로 함수로
          onChange(id, p) {
            MAX_FWD = p.maxFwd; MAX_REV = p.maxRev; ACCEL = p.accel; TURN = p.turn;
            ENTER_CAR_R = p.enterR;
            Object.assign(CAM.driving, p.cam);
            applyBodyShape(carBody, p);              // cannon 상자 크기·오프셋
            speed = Math.min(speed, p.maxFwd);
          }
        });
        mountVehicleButton({ container: document.getElementById('g-top'), switcher: rides });
      (V 키 = 다음 탈것. mountVehicleButton 이 직접 묶는다. 문서 뷰·인트로·프로젝트 창이
       열려 있을 땐 무시한다. KEYMAP 의 WASD/방향키/Space/Shift/R/H/F 와 겹치지 않음.)

   4) 메인 루프 step(dt) 안, 주행/도보 처리 바로 다음 줄에:
        if (player.mode === 'driving') drive(dt);
        else walk(dt);
        rideIn.speed = speed; rideIn.steer = steer; rideIn.boosting = !!keys.boost;
        rideIn.moving = !!(keys.fwd || keys.back); rideIn.driving = player.mode === 'driving';
        rides.update(dt, rideIn);
      그리고 step 밖에 한 번만:  const rideIn = { speed: 0, steer: 0, moving: false, boosting: false, driving: true };
      (매 프레임 객체를 새로 만들지 않도록 재사용)

   그 밖에 알아 둘 것
   - 차 이외의 탈것을 타면 캐릭터가 안장/좌석(seat)에 앉아 보인다(person.visible = true).
     그래서 physicsStep 의 personBody 도 탄 사람 자리로 따라온다 — 의도된 동작.
   - 헤드라이트 SpotLight 2개(car 의 자식)는 숨기지 않고 탈것마다 위치·색만 바꿔 재활용한다
     (조명 개수가 바뀌면 셰이더가 다시 컴파일돼 끊김이 생기므로). nightGlow 가 intensity 를
     계속 덮어써도 문제없다 — 밝기는 color 로 조절한다.
   - F 로 내리면(driving=false) 다리·발 뼈와 기울기를 원래대로 돌려놓는다.
   ════════════════════════════════════════════════════════════ */

import { buildTankPlaceholder, createTankFX, createTankAudio, TANK_BALLISTICS } from './tankfx.js';

const D2R = Math.PI / 180;

/* 탈것별 주행값. portfolio.js 의 원래 차 값이 'car'.
   half = cannon 상자 반치수 [x, y, z], bodyY = 상자 중심 높이(차 원점 기준), bodyZ = 앞뒤 오프셋.
   cam = CAM.driving 에 덮어쓸 값. enterR = 타기 거리. */
const PARAMS = {
  car: {
    maxFwd: 10, maxRev: 5, accel: 9, turn: 1.9, enterR: 5.5,
    cam: { back: 10.5, up: 5.4, ahead: 5, lookY: 1.4 },
    half: [1.05, 0.75, 2.15], bodyY: 0.85, bodyZ: 0
  },
  horse: {
    maxFwd: 9, maxRev: 2.5, accel: 7, turn: 2.6, enterR: 4,
    cam: { back: 7.6, up: 4.1, ahead: 4, lookY: 1.8 },
    half: [0.38, 0.85, 1.22], bodyY: 0.9, bodyZ: 0.05
  },
  carriage: {
    maxFwd: 6.5, maxRev: 2, accel: 4.5, turn: 1.25, enterR: 6.5,
    cam: { back: 13.5, up: 6.6, ahead: 5, lookY: 1.7 },
    half: [0.95, 1.05, 3.15], bodyY: 1.05, bodyZ: 0
  },
  motorcycle: {
    maxFwd: 14, maxRev: 3, accel: 12, turn: 2.2, enterR: 4,
    cam: { back: 7.6, up: 3.7, ahead: 5, lookY: 1.2 },
    half: [0.45, 0.6, 1.08], bodyY: 0.6, bodyZ: 0
  },
  bicycle: {
    maxFwd: 6, maxRev: 1.5, accel: 5, turn: 2.4, enterR: 3.5,
    cam: { back: 6.6, up: 3.3, ahead: 4, lookY: 1.2 },
    half: [0.3, 0.55, 0.9], bodyY: 0.55, bodyZ: 0
  },
  /* 탱크: 느리고 묵직. pivot = 제자리 선회(정지 상태에서도 좌우로 돈다, portfolio.js drive() 참고).
     mass = 장난감 블록을 미는 힘 배율 (vehicles.js 가 직접 블록 속도를 더한다) */
  tank: {
    maxFwd: 6, maxRev: 3, accel: 3, turn: 1.0, enterR: 6.5, pivot: true, mass: 3,
    cam: { back: 15, up: 7.6, ahead: 6, lookY: 1.9 },
    half: [1.45, 1.2, 3.0], bodyY: 1.2, bodyZ: 0
  }
};

/* 아이콘 (24×24, 선 아이콘) */
const ICONS = {
  car: '<path d="M3 16.5v-3.8l2.2-4.9A2 2 0 0 1 7 6.5h10a2 2 0 0 1 1.8 1.3l2.2 4.9v3.8"/><path d="M3 13h18"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>',
  horse: '<path d="M8 21v-4.5L5.5 14 4 15.5 2.5 13l3.5-5 4-1.5L12 3l1.5 2.5L17 6l3.5 4.5L19 12l-2.5-1.5L15 13v8"/><path d="M14 6.2l-1 2.3"/>',
  carriage: '<path d="M2.5 15h12V9.5a3.5 3.5 0 0 0-3.5-3.5H6A3.5 3.5 0 0 0 2.5 9.5z"/><path d="M14.5 12.5H18l3.5 3.5"/><circle cx="5.5" cy="18" r="2.5"/><circle cx="12" cy="18" r="2.5"/>',
  motorcycle: '<circle cx="5" cy="16.5" r="3"/><circle cx="19" cy="16.5" r="3"/><path d="M5 16.5l4-5h5l2.3 2.5H19"/><path d="M19 16.5l-3.3-8H13"/><path d="M8 11.5 7 9H4.5"/>',
  bicycle: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9.5h6l3.5 7"/><path d="M9 9.5l3 7H5.5"/><path d="M15 9.5 14 7h-2"/><path d="M8 7.5h2.5"/>',
  tank: '<rect x="2.5" y="14" width="19" height="5.5" rx="2.75"/><circle cx="6.5" cy="16.75" r=".9"/><circle cx="12" cy="16.75" r=".9"/><circle cx="17.5" cy="16.75" r=".9"/><path d="M5 14l1.5-3h10l1.5 3"/><path d="M8.5 11V8.5h6V11"/><path d="M14.5 9.5h7"/>'
};

export const VEHICLES = [
  { id: 'car',        name: '자동차',   sub: '빠르고 무난',  url: null },
  { id: 'horse',      name: '말',       sub: '날렵한 방향 전환', url: 'horse.glb' },
  { id: 'carriage',   name: '마차',     sub: '느리고 넓게',  url: 'carriage.glb' },
  { id: 'motorcycle', name: '오토바이', sub: '가장 빠름',    url: 'motorcycle.glb' },
  { id: 'bicycle',    name: '자전거',   sub: '느긋한 산책',  url: 'bicycle.glb' },
  { id: 'tank',       name: '탱크',     sub: '느리지만 무적, 포탑 사격', url: 'tank.glb' }
];
const BY_ID = Object.fromEntries(VEHICLES.map(v => [v.id, v]));

/* 탄 사람 자세 (사람 기준 각도, 도). thigh 음수 = 다리를 앞으로, spread = 벌림,
   knee 양수 = 무릎 굽힘, arm/fore 음수 = 팔을 앞으로. lift = 엉덩이 뼈를 seat 위로 띄우는 높이 */
const POSE = {
  horse:      { thigh: -42, spread: 28, knee: 58, arm: -22, fore: -48, inward: 10, lift: 0.07, hipZ: 0 },
  carriage:   { thigh: -84, spread: 9,  knee: 86, arm: -24, fore: -50, inward: 8,  lift: 0.09, hipZ: 0.05 },
  motorcycle: { thigh: -70, spread: 15, knee: 88, arm: -42, fore: -14, inward: 12, lift: 0.06, hipZ: 0 },
  bicycle:    { thigh: -58, spread: 6,  knee: 62, arm: -40, fore: -14, inward: 10, lift: 0.06, hipZ: 0, pedal: true },
  /* 전차장: 해치에 서서 허리부터 위만 보인다. 다리는 뼈를 접어(scale≈0) 포탑 밖으로 삐져나오지 않게 숨긴다 */
  tank:       { thigh: 0,   spread: 3,  knee: 4,  arm: -12, fore: -62, inward: -8, lift: 0,    hipZ: 0, hideLegs: true }
};

/* 탱크 조작값 */
const TANK = {
  reload: 2.5,          // 재장전 (초)
  yawRate: 1.5,         // 포탑 최대 선회 속도 (rad/s)
  yawAccel: 7,          // 포탑 선회 가속 (rad/s²)
  pitchRate: 0.7,       // 포신 고각 속도 (rad/s)
  pitchMin: -0.1, pitchMax: 0.34,
  aimTol: 0.07,         // 이만큼 맞춰지면 바로 쏜다 (아니면 맞춰질 때까지 최대 0.9초 기다렸다 쏜다)
  recoil: 0.5,          // 포신 후퇴 (m)
  trackDir: 1           // glb 궤도 텍스처가 거꾸로 흐르면 -1
};

/* cannon 상자 크기를 탈것에 맞춘다. portfolio.js 는 상자 중심을 car.y + 0.85 에 두므로
   그 차이와 앞뒤 오프셋을 shapeOffsets 로 준다. */
export function applyBodyShape(body, p) {
  const shape = body && body.shapes && body.shapes[0];
  if (!shape || !shape.halfExtents) return;
  shape.halfExtents.set(p.half[0], p.half[1], p.half[2]);
  if (shape.updateConvexPolyhedronRepresentation) shape.updateConvexPolyhedronRepresentation();
  if (shape.updateBoundingSphereRadius) shape.updateBoundingSphereRadius();
  if (body.shapeOffsets && body.shapeOffsets[0]) body.shapeOffsets[0].set(0, p.bodyY - 0.85, p.bodyZ || 0);
  if (body.updateBoundingRadius) body.updateBoundingRadius();
  body.aabbNeedsUpdate = true;
}

export async function createVehicleSwitcher({
  THREE, GLTFLoader, dracoLoader, carGroup, person, personMixer, personClips, scene,
  onChange, baseUrl = 'models/vehicles/',
  /* ── 탱크용 (없으면 포탑 조준·사격만 빠지고 나머지는 동작) ── */
  camera = null,          // 마우스 조준 광선
  domElement = null,      // renderer.domElement — 여기에만 포인터 리스너를 단다
  groundY = null,         // (x, z) => 땅 높이. 조준점·포탄 착탄·그을음 자국
  getNpcs = null,         // () => npcs (createNPCs 결과, 비동기라 함수로)
  toyBlocks = null,       // portfolio.js 의 toyBlocks 배열 (블록·의자 { body })
  isBlocked = null,       // () => true 면 사격 안 함 (기본: 인트로·문서 뷰·프로젝트 창)
  explode = null          // (pos, radius, force) => void — weapons.js 의 폭발로 바꿔 끼울 때
}) {
  void personMixer; void scene;   // 인터페이스 호환용 (지금은 쓰지 않음)

  let draco = dracoLoader;
  if (!draco) {
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
    draco = new DRACOLoader();
    draco.setDecoderPath(`https://cdn.jsdelivr.net/npm/three@0.${THREE.REVISION}.0/examples/jsm/libs/draco/gltf/`);
  }
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  /* 탈것 모델을 담는 그릇. car 의 자식이라 위치·방향·경사 기울기를 그대로 따라간다.
     오토바이·자전거 기울기(roll)는 이 그릇에만 준다. */
  const holder = new THREE.Group();
  holder.name = 'ride-holder';
  holder.rotation.order = 'YXZ';
  carGroup.add(holder);

  /* ── 세워 둔 탈것 위 화살표 — 내려서 걸을 때만 보인다 ──
     나무·안개에 가려도 찾을 수 있게 깊이 검사와 안개를 끄고 맨 나중에 그린다. */
  const MARK_H = { car: 2.7, horse: 3.1, carriage: 3.5, motorcycle: 2.4, bicycle: 2.3, tank: 4.0 };
  const marker = new THREE.Group();
  {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 4), mat);
    head.rotation.x = Math.PI;                       // 아래를 가리킨다
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), mat);
    tail.position.y = 0.6;
    marker.add(head, tail);
    marker.traverse(o => { o.renderOrder = 999; });
  }
  marker.visible = false;
  carGroup.add(marker);
  let markT = 0;
  function updateMarker(dt, driving) {
    marker.visible = !driving;
    if (driving) return;
    markT += dt;
    marker.position.y = (MARK_H[current] ?? 2.7) + Math.sin(markT * 3) * 0.18;
    marker.rotation.y = markT * 1.6;
  }

  /* ── 헤드라이트 재활용 ── */
  let spots = [];
  const spotOrig = [];
  function scanSpots() {
    spots = carGroup.children.filter(o => o.isSpotLight);
    spotOrig.length = 0;
    for (const s of spots) spotOrig.push({
      pos: s.position.clone(), tgt: s.target.position.clone(), angle: s.angle, penumbra: s.penumbra,
      distance: s.distance, color: s.color.clone()
    });
  }
  scanSpots();

  function applyLights(cfg) {
    if (!spots.length) scanSpots();
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i], o = spotOrig[i];
      if (!cfg) {   // 자동차 = 원래대로
        s.position.copy(o.pos); s.target.position.copy(o.tgt);
        s.angle = o.angle; s.penumbra = o.penumbra; s.distance = o.distance; s.color.copy(o.color);
        continue;
      }
      const side = spots.length > 1 ? (i === 0 ? -1 : 1) : 0;
      s.position.set(cfg.pos.x + side * cfg.spread, cfg.pos.y, cfg.pos.z);
      s.target.position.set(cfg.pos.x + (cfg.tgtX || 0) + side * cfg.spread * 3, cfg.tgtY, cfg.pos.z + cfg.tgtZ);
      s.angle = cfg.angle; s.penumbra = cfg.penumbra; s.distance = cfg.distance;
      s.color.setHex(cfg.color).multiplyScalar(cfg.scale);
    }
  }

  /* ── 원래 차 메시 숨기기 ── 차 glb 는 비동기로 나중에 들어오므로 매 프레임 확인한다 */
  function syncCarVisibility(showCar) {
    const ch = carGroup.children;
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i];
      if (c === holder || c === marker || c.isLight) continue;   // 화살표는 updateMarker가 따로 켜고 끈다
      c.visible = showCar;
    }
  }

  /* ── 모델 불러오기 ── */
  const cache = Object.create(null);
  const loading = Object.create(null);
  const _box = new THREE.Box3(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

  function meshByMaterial(root, re) {
    let hit = null;
    root.traverse(o => { if (!hit && o.isMesh && o.material && re.test(o.material.name || '')) hit = o; });
    return hit;
  }
  function centerOf(obj, out) {
    _box.setFromObject(obj);
    return _box.getCenter(out);
  }
  function wheelRadius(node, fallback) {
    const r = _box.setFromObject(node).getSize(_v).y / 2;
    return r > 0.05 ? r : fallback;
  }

  function prepare(id, gltf) {
    const model = gltf.scene;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    model.updateMatrixWorld(true);
    const r = { id, model, seat: model.getObjectByName('seat'), mixer: null, acts: null, w: [1, 0, 0],
      wheels: [], steer: null, pedals: null, pedalAng: 0, lean: 0, light: null, lantern: null };

    if (gltf.animations.length) {
      r.mixer = new THREE.AnimationMixer(model);
      const find = n => gltf.animations.find(c => c.name.toLowerCase().endsWith(n));
      r.acts = ['idle', 'walk', 'gallop'].map(n => {
        const clip = find(n);
        if (!clip) return null;
        const a = r.mixer.clipAction(clip);
        a.play(); a.setEffectiveWeight(n === 'idle' ? 1 : 0);
        return a;
      });
    }

    if (id === 'carriage') {
      for (const [n, front, fb] of [['wheel_fl', true, 0.48], ['wheel_fr', true, 0.48], ['wheel_rl', false, 0.64], ['wheel_rr', false, 0.64]]) {
        const node = model.getObjectByName(n);
        if (!node) continue;
        node.rotation.order = 'YXZ';
        r.wheels.push({ node, front, r: wheelRadius(node, fb) });
      }
      const lamp = meshByMaterial(model, /lantern_glow/i);
      const p = lamp ? centerOf(lamp, new THREE.Vector3()) : new THREE.Vector3(0.7, 1.9, 0.1);
      // 바로 앞이 말 엉덩이라 정면으로 비추면 말만 주황색으로 탄다 → 바깥쪽 바닥을 비춘다
      r.light = { pos: p, spread: 0.02, tgtX: Math.sign(p.x || 1) * 2.2, tgtY: 0, tgtZ: 1.5, angle: Math.PI / 3, penumbra: 1, distance: 14, color: 0xffa64d, scale: 0.2 };
    }

    if (id === 'motorcycle' || id === 'bicycle') {
      r.steer = model.getObjectByName('steer');
      r.pedals = model.getObjectByName('pedals');
      const fb = id === 'bicycle' ? 0.35 : 0.33;
      for (const [n, front] of [['wheel_front', true], ['wheel_rear', false]]) {
        const node = model.getObjectByName(n);
        if (node) r.wheels.push({ node, front, r: wheelRadius(node, fb), noSteer: true });
      }
      const lamp = meshByMaterial(model, /lamp_glass/i);
      const p = lamp ? centerOf(lamp, new THREE.Vector3()) : new THREE.Vector3(0, 1, 0.8);
      r.light = id === 'motorcycle'
        ? { pos: p, spread: 0.06, tgtY: 0, tgtZ: 12, angle: Math.PI / 8, penumbra: 0.55, distance: 24, color: 0xffe2b0, scale: 0.6 }
        : { pos: p, spread: 0.02, tgtY: 0, tgtZ: 8, angle: Math.PI / 7, penumbra: 0.7, distance: 13, color: 0xffd9a0, scale: 0.22 };
    }

    if (id === 'horse') {
      /* 말에는 등불이 없어서 안장 옆에 작은 랜턴을 단다 (seat 의 자식 → 걸음에 같이 흔들림) */
      const lantern = new THREE.Group();
      const metal = new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 0.6, metalness: 0.4 });
      const glow = new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xffa040, emissiveIntensity: 1.6, roughness: 0.4 });
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.07, 6), metal); cap.position.y = 0.1;
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.13, 6), glow);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.025, 6), metal); base.position.y = -0.075;
      lantern.add(cap, glass, base);
      if (r.seat) {
        r.seat.add(lantern);
        r.seat.updateMatrixWorld(true);
        // seat 의 로컬 축이 뼈 기준이라 월드 기준 오프셋을 로컬로 바꿔서 둔다
        r.seat.getWorldPosition(_v);
        _v2.set(0.34, -0.32, 0.25).add(_v);
        r.seat.worldToLocal(_v2);
        lantern.position.copy(_v2);
        r.seat.getWorldQuaternion(lantern.quaternion).invert();
      }
      r.lantern = lantern;
      r.light = { pos: new THREE.Vector3(0.34, 1.25, 0.3), spread: 0.02, tgtY: 0, tgtZ: 4, angle: Math.PI / 2.5, penumbra: 1, distance: 12, color: 0xffa64d, scale: 0.22 };
    }

    if (id === 'tank') prepareTank(r, model);

    model.visible = false;
    holder.add(model);
    return r;
  }

  /* ════════════ 탱크 ════════════ */
  /* 궤도 재질의 텍스처를 복제해(좌우 따로 흐르게) 스크롤 축과 1 m 당 오프셋을 구한다 */
  function setupTrack(model, re) {
    const mesh = meshByMaterial(model, re);
    if (!mesh) return null;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const uv = mesh.geometry.getAttribute('uv');
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    if (uv) for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    const axis = (u1 - u0) >= (v1 - v0) ? 'x' : 'y';
    const span = axis === 'x' ? u1 - u0 : v1 - v0;
    const size = _box.setFromObject(mesh).getSize(_v);
    const loop = Math.max(1, 2 * Math.max(0, size.z - size.y) + Math.PI * size.y);   // 궤도 한 바퀴 길이 (근사)
    const texs = [];
    for (const m of mats) {
      if (!re.test(m.name || '')) continue;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
        if (!m[k]) continue;
        const t = m[k].clone();
        if (axis === 'x') t.wrapS = THREE.RepeatWrapping; else t.wrapT = THREE.RepeatWrapping;
        t.needsUpdate = true;
        m[k] = t; texs.push(t);
      }
    }
    const rep = texs.length ? texs[0].repeat[axis] : 1;
    return { texs, axis, perM: span * rep / loop * TANK.trackDir };
  }

  function prepareTank(r, model) {
    const get = n => model.getObjectByName(n);
    r.tank = true;
    r.turret = get('turret'); r.barrel = get('barrel'); r.muzzle = get('muzzle'); r.antenna = get('antenna');
    r.turretBase = r.turret ? r.turret.rotation.y : 0;
    r.barrelBase = r.barrel ? r.barrel.rotation.x : 0;
    r.barrelRest = r.barrel ? r.barrel.position.clone() : new THREE.Vector3();
    r.yaw = 0; r.yawV = 0; r.pitch = 0; r.recoil = 0;
    r.rock = 0; r.rockV = 0; r.ant = 0; r.antV = 0; r.accSm = 0; r.lastSp = 0; r.prevH = null;
    r.trackL = setupTrack(model, /track_l/i);
    r.trackR = setupTrack(model, /track_r/i);
    r.wheelsL = []; r.wheelsR = [];
    for (const [arr, side] of [[r.wheelsL, 'l'], [r.wheelsR, 'r']]) {
      for (let i = 0; i < 12; i++) { const n = get(`wheel_${side}${i}`); if (!n) break; arr.push({ node: n, r: wheelRadius(n, 0.34) }); }
      for (const nm of ['sprocket_', 'idler_']) { const n = get(nm + side); if (n) arr.push({ node: n, r: wheelRadius(n, 0.33) }); }
    }
    /* 전조등 두 개 = 차 헤드라이트 재활용 */
    const lamp = meshByMaterial(model, /lamp_glass/i);
    const p = lamp ? centerOf(lamp, new THREE.Vector3()) : new THREE.Vector3(1.05, 1.32, 2.5);
    r.light = { pos: new THREE.Vector3(0, p.y, p.z), spread: Math.max(0.3, Math.abs(p.x)), tgtY: 0, tgtZ: 14, angle: Math.PI / 6.5, penumbra: 0.6, distance: 26, color: 0xffe6b8, scale: 0.55 };
    ensureFx();
  }

  /* 효과·소리 — 처음 탱크를 고를 때 한 번 만든다. 폭발은 다른 모듈도 api.explode 로 쓸 수 있다 */
  let fx = null;
  const tankAudio = createTankAudio();
  function ensureFx() {
    if (!fx) fx = createTankFX({ THREE, scene: scene || carGroup.parent, groundY, getNpcs, toyBlocks, explode, audio: tankAudio });
    return fx;
  }

  /* ── 조준: 마우스 → 땅 위 한 점 ── */
  const aim = { has: false, ndc: new THREE.Vector2(), x: 0, y: 0, point: new THREE.Vector3(), valid: false, pending: 0, reload: 0, readyCued: true };
  const raycaster = new THREE.Raycaster();
  const _mz = new THREE.Vector3(), _bw = new THREE.Vector3(), _dir = new THREE.Vector3(), _vel = new THREE.Vector3(), _qt = new THREE.Quaternion();
  const gyAt = (x, z) => (groundY ? groundY(x, z) : carGroup.position.y);
  function groundHit(ray, out) {
    const o = ray.origin, d = ray.direction;
    let tPrev = 0, t = 0.5;
    if (o.y + d.y * 0 <= gyAt(o.x, o.z)) return false;
    while (t < 180) {
      const y = o.y + d.y * t, g = gyAt(o.x + d.x * t, o.z + d.z * t);
      if (y <= g) {   // 지나쳤다 → 이분 탐색
        let a = tPrev, b = t;
        for (let k = 0; k < 10; k++) {
          const m = (a + b) * 0.5;
          if (o.y + d.y * m <= gyAt(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m;
        }
        out.set(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b);
        return true;
      }
      tPrev = t;
      t += 0.4 + t * 0.04;
    }
    return false;
  }
  function blocked() {
    if (isBlocked && isBlocked()) return true;
    const b = document.body;
    return b.classList.contains('intro-on') || b.dataset.view === 'doc' || !!document.querySelector('#g-panel.open');
  }
  const canShoot = () => current === 'tank' && wasDriving && !!cache.tank && !destroyed && !blocked();

  function setNdc(e) {
    const rc = domElement.getBoundingClientRect();
    aim.ndc.set((e.clientX - rc.left) / rc.width * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    aim.x = e.clientX; aim.y = e.clientY; aim.has = true;
    reticle.move();
  }
  function onPtrMove(e) { if (e.pointerType === 'mouse' || e.buttons) setNdc(e); }
  function onPtrDown(e) {
    if (current === 'tank') tankAudio.unlock();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!canShoot()) return;
    setNdc(e);
    if (aim.reload > 0) { reticle.deny(); return; }
    aim.pending = 0.9;   // 포탑이 겨누는 대로 쏜다 (이미 맞춰져 있으면 이번 프레임에)
  }
  const onKeyUnlock = () => { if (current === 'tank') tankAudio.unlock(); };
  if (domElement) {
    domElement.addEventListener('pointermove', onPtrMove);
    domElement.addEventListener('pointerdown', onPtrDown);
  }
  addEventListener('keydown', onKeyUnlock);

  /* 조준 십자선 + 장전 고리 (커서 자리에 붙는다) */
  const reticle = (() => {
    let el = null, ring = null, label = null, shown = false, lastStep = -1, hintT = 0;
    const C = 2 * Math.PI * 15;
    function make() {
      if (el) return;
      if (!document.getElementById('g-tank-css')) {
        const st = document.createElement('style'); st.id = 'g-tank-css';
        st.textContent = `
.g-tank-ret{position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:30;display:none}
.g-tank-ret svg{position:absolute;left:-22px;top:-22px;overflow:visible;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}
.g-tank-ret .bg{stroke:rgba(255,255,255,.28)}
.g-tank-ret .pr{stroke:#ffc94d;transition:stroke .15s}
.g-tank-ret.ready .pr{stroke:#fff}
.g-tank-ret.deny svg{animation:g-tank-deny .25s}
@keyframes g-tank-deny{25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
.g-tank-ret .lb{position:absolute;left:0;top:26px;transform:translateX(-50%);white-space:nowrap;font:600 11px/1.2 system-ui,sans-serif;
  color:#fff;background:rgba(20,24,28,.55);padding:3px 7px;border-radius:6px;opacity:0;transition:opacity .2s}
.g-tank-ret .lb.on{opacity:1}
body.tank-aim canvas{cursor:none!important}`;
        document.head.appendChild(st);
      }
      el = document.createElement('div');
      el.className = 'g-tank-ret ready';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = `<svg width="44" height="44" viewBox="-22 -22 44 44" fill="none" stroke-width="2.4" stroke-linecap="round">
        <circle class="bg" r="15"/><circle class="pr" r="15" transform="rotate(-90)" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="0"/>
        <path stroke="#fff" stroke-width="1.8" d="M-9 0h-5M9 0h5M0-9v-5M0 9v5"/><circle r="1.6" fill="#fff" stroke="none"/></svg>
        <span class="lb"></span>`;
      ring = el.querySelector('.pr'); label = el.querySelector('.lb');
      document.body.appendChild(el);
    }
    return {
      move() { if (el && aim.has) el.style.transform = `translate(${aim.x}px,${aim.y}px)`; },
      show(on) {
        if (on === shown) return;
        shown = on;
        if (on) { make(); hintT = 5; label.textContent = '클릭: 포 발사'; label.classList.add('on'); this.move(); }
        if (el) el.style.display = on && aim.has ? 'block' : 'none';
        document.body.classList.toggle('tank-aim', on);
      },
      tick(dt) {
        if (!shown || !el) return;
        if (aim.has && el.style.display === 'none') { el.style.display = 'block'; this.move(); }
        if (hintT > 0) { hintT -= dt; if (hintT <= 0) label.classList.remove('on'); }
        const k = aim.reload > 0 ? 1 - aim.reload / TANK.reload : 1;
        const step = Math.round(k * 48);
        if (step !== lastStep) {
          lastStep = step;
          ring.setAttribute('stroke-dashoffset', (C * (1 - step / 48)).toFixed(2));
          el.classList.toggle('ready', step >= 48);
        }
      },
      deny() {
        if (!el) return;
        el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny');
        label.textContent = '장전 중…'; label.classList.add('on'); hintT = 0.9;
      },
      dispose() { if (el) el.remove(); document.body.classList.remove('tank-aim'); }
    };
  })();

  function fireNow(r) {
    if (!r.muzzle && !r.barrel) return;
    const f = ensureFx();
    r.barrel.updateWorldMatrix(true, true);
    r.barrel.getWorldPosition(_bw);
    if (r.muzzle) {
      r.muzzle.getWorldPosition(_mz);
      _dir.copy(_mz).sub(_bw).normalize();
    } else {
      r.barrel.getWorldQuaternion(_qt);
      _dir.set(0, 0, 1).applyQuaternion(_qt);
      _mz.copy(_bw).addScaledVector(_dir, 3.5);
    }
    const h = carGroup.rotation.y, sp = r.lastSp;
    _vel.set(Math.sin(h) * sp, 0, Math.cos(h) * sp);
    f.fire(_mz, _dir, _vel);
    r.recoil = TANK.recoil;
    r.rockV -= 0.9;            // 포 쏜 쪽이 들린다 (아래 animateTank 에서 포탑 방향으로 나눔)
    r.antV += 6;
    aim.reload = TANK.reload; aim.readyCued = false;
  }

  function aimTank(r, dt, driving) {
    if (!r.turret) return;
    let wantYaw = r.yaw, wantPitch = r.pitch;
    if (driving && camera && aim.has) {
      raycaster.setFromCamera(aim.ndc, camera);
      aim.valid = groundHit(raycaster.ray, aim.point);
      if (!aim.valid) {   // 하늘을 가리키면 그 방향 먼 곳
        const d = raycaster.ray.direction, hl = Math.hypot(d.x, d.z) || 1;
        aim.point.set(carGroup.position.x + d.x / hl * 90, carGroup.position.y + 1, carGroup.position.z + d.z / hl * 90);
      }
      /* 포탑 yaw: 차체 기준 각도 */
      const par = r.turret.parent;
      par.updateWorldMatrix(true, false);
      _v.copy(aim.point); par.worldToLocal(_v);
      wantYaw = Math.atan2(_v.x - r.turret.position.x, _v.z - r.turret.position.z);
      /* 포신 고각: 탄도 공식 (포구 높이 기준) → 차체 경사만큼 빼서 포탑 기준으로 */
      if (r.muzzle) r.muzzle.getWorldPosition(_mz); else r.turret.getWorldPosition(_mz);
      const dx = aim.point.x - _mz.x, dz = aim.point.z - _mz.z, dh = aim.point.y - _mz.y;
      const d = Math.max(1, Math.hypot(dx, dz)), V = TANK_BALLISTICS.speed, G = TANK_BALLISTICS.g, V2 = V * V;
      const disc = V2 * V2 - G * (G * d * d + 2 * dh * V2);
      const theta = disc < 0 ? Math.PI / 4 : Math.atan((V2 - Math.sqrt(disc)) / (G * d));
      r.turret.getWorldQuaternion(_qt);
      _v2.set(0, 0, 1).applyQuaternion(_qt);
      wantPitch = Math.max(TANK.pitchMin, Math.min(TANK.pitchMax, theta - Math.asin(Math.max(-1, Math.min(1, _v2.y)))));
    }
    /* 선회: 가속 제한 + 최고 속도 제한 */
    const diff = Math.atan2(Math.sin(wantYaw - r.yaw), Math.cos(wantYaw - r.yaw));
    const wantV = Math.max(-TANK.yawRate, Math.min(TANK.yawRate, diff * 6));
    const dv = TANK.yawAccel * dt;
    r.yawV += Math.max(-dv, Math.min(dv, wantV - r.yawV));
    r.yaw += r.yawV * dt;
    r.yaw = Math.atan2(Math.sin(r.yaw), Math.cos(r.yaw));
    const pd = wantPitch - r.pitch, pm = TANK.pitchRate * dt;
    r.pitch += Math.max(-pm, Math.min(pm, pd));
    r.turret.rotation.y = r.turretBase + r.yaw;
    if (r.barrel) {
      r.barrel.rotation.x = r.barrelBase - r.pitch;
      /* 후퇴: 포신 축을 따라 뒤로 (빨리 밀렸다가 0.5초에 걸쳐 복귀) */
      if (r.recoil > 0) r.recoil = Math.max(0, r.recoil - dt * (0.25 + r.recoil * 2.2));
      r.barrel.position.set(r.barrelRest.x, r.barrelRest.y - Math.sin(r.pitch) * r.recoil, r.barrelRest.z - Math.cos(r.pitch) * r.recoil);
    }
    /* 사격 대기 → 맞춰지면(또는 0.9초 지나면) 발사 */
    if (aim.reload > 0) {
      aim.reload -= dt;
      if (aim.reload <= 0) { aim.reload = 0; if (!aim.readyCued) { aim.readyCued = true; tankAudio.reloaded(); } }
    }
    if (aim.pending > 0) {
      aim.pending -= dt;
      if (!canShoot()) aim.pending = 0;
      else if (aim.reload <= 0 && ((Math.abs(diff) < TANK.aimTol && Math.abs(pd) < 0.05) || aim.pending <= 0)) { aim.pending = 0; fireNow(r); }
    }
  }

  function animateTank(r, dt, inp, driving) {
    const sp = driving ? (inp.speed || 0) : 0;
    /* 실제 회전 속도(제자리 선회 포함)는 heading 변화로 잰다 */
    const h = carGroup.rotation.y;
    let w = 0;
    if (r.prevH !== null && dt > 0) w = Math.atan2(Math.sin(h - r.prevH), Math.cos(h - r.prevH)) / dt;
    r.prevH = h;
    const half = 1.2;   // 궤도 중심 간 반폭
    const vL = sp - w * half, vR = sp + w * half;
    if (r.trackL) for (const t of r.trackL.texs) t.offset[r.trackL.axis] += vL * dt * r.trackL.perM;
    if (r.trackR) for (const t of r.trackR.texs) t.offset[r.trackR.axis] += vR * dt * r.trackR.perM;
    for (const wh of r.wheelsL) wh.node.rotation.x += vL * dt / wh.r;
    for (const wh of r.wheelsR) wh.node.rotation.x += vR * dt / wh.r;

    aimTank(r, dt, driving);

    /* 차체 흔들림: 가속하면 코가 들리고, 쏘면 포 쪽이 들썩 (감쇠 스프링) */
    r.accSm += (((sp - r.lastSp) / Math.max(dt, 1e-4)) - r.accSm) * Math.min(1, dt * 5);
    r.lastSp = sp;
    const target = -r.accSm * 0.012;
    r.rockV += ((target - r.rock) * 60 - r.rockV * 7) * dt;
    r.rock += r.rockV * dt;
    const rough = Math.abs(sp) > 0.2 ? Math.sin(performance.now() * 0.021) * 0.0025 * Math.min(1, Math.abs(sp) / 3) : 0;   // 궤도 덜컹
    holder.rotation.x = r.rock * Math.cos(r.yaw) + rough;
    holder.rotation.z = -r.rock * Math.sin(r.yaw);
    if (r.antenna) {
      r.antV += ((r.accSm * 0.03 - r.ant) * 40 - r.antV * 2.5) * dt;
      r.ant += r.antV * dt;
      r.antenna.rotation.x = Math.max(-0.5, Math.min(0.5, r.ant));
    }

    /* 장난감 블록·의자를 세게 민다 (키네마틱 상자 충돌만으로는 살짝 밀리는 정도라) */
    if (toyBlocks && driving && (Math.abs(sp) > 0.4 || Math.abs(w) > 0.25)) {
      const p = PARAMS.tank, cx = carGroup.position.x, cz = carGroup.position.z, cy = carGroup.position.y;
      const fs = Math.sin(h), fc = Math.cos(h);
      for (let i = 0; i < toyBlocks.length; i++) {
        const b = toyBlocks[i].body;
        if (!b || !(b.mass > 0)) continue;
        const dx = b.position.x - cx, dz = b.position.z - cz;
        if (b.position.y > cy + 2.6) continue;
        const fwd = dx * fs + dz * fc, side = dx * fc - dz * fs;
        if (Math.abs(fwd) > p.half[2] + 0.45 || Math.abs(side) > p.half[0] + 0.45) continue;
        /* 그 자리의 차체 속도 = 직진 + 회전 */
        let pvx = fs * sp + w * dz, pvz = fc * sp - w * dx;
        const pl = Math.hypot(pvx, pvz);
        if (pl < 0.3) continue;
        pvx /= pl; pvz /= pl;
        const want = pl * 1.6 + 1.2;
        const along = b.velocity.x * pvx + b.velocity.z * pvz;
        if (along >= want) continue;
        const k = Math.min(1, p.mass / Math.max(0.3, b.mass));
        const add = (want - along) * k;
        b.velocity.x += pvx * add; b.velocity.z += pvz * add;
        b.velocity.y += 1.2 * k;
        b.angularVelocity.x += (Math.random() - 0.5) * 3; b.angularVelocity.z += (Math.random() - 0.5) * 3;
        if (b.wakeUp) b.wakeUp();
      }
    }

    /* 엔진 소리: 움직일 때만, 낮고 작게 */
    const mv = Math.abs(sp) + Math.abs(w) * 1.5;
    tankAudio.engine(driving && mv > 0.15 ? Math.min(1, 0.45 + mv / 6 * 0.55) : 0, mv);
  }

  function load(id) {
    if (cache[id]) return Promise.resolve(cache[id]);
    if (loading[id]) return loading[id];
    const v = BY_ID[id];
    loading[id] = new Promise((res, rej) => loader.load(baseUrl + v.url, g => {
      cache[id] = prepare(id, g);
      res(cache[id]);
    }, undefined, e => {
      /* tank.glb 가 아직 없으면 같은 부품 이름의 절차적 탱크로 대신한다 */
      if (id === 'tank') { cache[id] = prepare(id, { scene: buildTankPlaceholder(THREE), animations: [] }); res(cache[id]); }
      else rej(e);
    })).finally(() => { delete loading[id]; });
    return loading[id];
  }

  /* ── 탄 사람 ── */
  const rider = {
    rig: null, searchT: 0, mounted: false, hip: new THREE.Vector3(0, 0.9, 0),
    saved: [], footRest: null
  };
  const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qd = new THREE.Quaternion(), _qi = new THREE.Quaternion();
  const _qPerson = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
  const _seatW = new THREE.Vector3(), _off = new THREE.Vector3();
  const AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1);

  function boneOf(model, name) {
    return model.getObjectByName(name) || model.getObjectByName(name.replace(/\./g, ''));
  }
  function findRig() {
    let skinned = null;
    person.traverse(o => { if (!skinned && o.isSkinnedMesh) skinned = o; });
    if (!skinned) return null;
    let model = skinned; while (model.parent && model.parent !== person) model = model.parent;
    const b = n => boneOf(model, n);
    const rig = {
      model, hips: b('Hips'),
      legL: [b('UpperLeg.L'), b('LowerLeg.L'), b('LowerLeg.L_end'), b('Foot.L')],
      legR: [b('UpperLeg.R'), b('LowerLeg.R'), b('LowerLeg.R_end'), b('Foot.R')],
      armL: [b('UpperArm.L'), b('LowerArm.L')],
      armR: [b('UpperArm.R'), b('LowerArm.R')],
      base: null
    };
    if (!rig.hips || !rig.legL[0] || !rig.legR[0]) return null;
    rig.touched = [...rig.legL, ...rig.legR, ...rig.armL, ...rig.armR].filter(Boolean);
    // 발 뼈는 다리 사슬이 아니라 Root 의 자식(IK)이라 직접 옮겨야 한다. 처음 본 자세를 기준으로 쓴다
    rider.footRest = [rig.legL[3], rig.legR[3]].map(f => f && f.quaternion.clone());
    return rig;
  }
  /* idle 클립 첫 프레임을 앉은 자세의 바탕으로 쓴다 (없으면 탈 때의 자세를 그대로 바탕으로) */
  function buildBase(rig) {
    let clips = typeof personClips === 'function' ? personClips() : personClips;
    let idle = null;
    if (clips) {
      const list = Array.isArray(clips) ? clips : Object.values(clips);
      idle = (!Array.isArray(clips) && clips.idle) || list.find(c => /(^|\|)idle$/i.test(c.name));
    }
    const base = [];
    for (const bone of [...rig.legL.slice(0, 2), ...rig.legR.slice(0, 2), ...rig.armL, ...rig.armR]) {
      if (!bone) continue;
      const q = bone.quaternion.clone();
      const tr = idle && idle.tracks.find(t => t.name === bone.name + '.quaternion');
      if (tr) q.fromArray(tr.values, 0);
      base.push({ bone, q });
    }
    return base;
  }

  function mount(r) {
    const rig = rider.rig;
    rider.saved.length = 0;
    if (rig) {
      if (!rig.base) rig.base = buildBase(rig);
      for (const b of rig.touched) rider.saved.push({ b, p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() });
      for (const e of rig.base) e.bone.quaternion.copy(e.q);
      person.position.set(0, 0, 0); person.quaternion.identity();
      person.updateMatrixWorld(true);
      rig.hips.getWorldPosition(rider.hip);
    } else rider.hip.set(0, 0.9, 0);
    rider.mounted = true;
    rider.forRide = r.id;
    person.visible = true;
  }
  function unmount(keepVisible) {
    if (!rider.mounted) return;
    for (const s of rider.saved) { s.b.position.copy(s.p); s.b.quaternion.copy(s.q); if (s.s) s.b.scale.copy(s.s); }
    rider.saved.length = 0;
    // 기울기만 지우고 진행 방향(yaw)은 남긴다. (Euler 가 (π, y, π) 로 풀려 있을 수 있어 벡터로 다시 구한다)
    _v.set(0, 0, 1).applyQuaternion(person.quaternion);
    person.rotation.set(0, Math.atan2(_v.x, _v.z), 0);
    rider.mounted = false;
    if (!keepVisible) person.visible = false;
  }

  /* 사람 공간 회전 R 을 뼈에 적용: q' = Pw⁻¹ · (Sw · R · Sw⁻¹) · Pw · q  (Sw = 사람 월드 회전) */
  function rotBone(bone, rLocal) {
    if (!bone) return;
    bone.parent.getWorldQuaternion(_qp);
    _qd.copy(_qPerson).multiply(rLocal).multiply(_qi.copy(_qPerson).invert());
    _q.copy(_qp).invert().multiply(_qd).multiply(_qp);
    bone.quaternion.premultiply(_q);
  }
  function legPose(leg, side, thigh, spread, knee) {
    _qa.setFromAxisAngle(AZ, side * spread * D2R);
    _qb.setFromAxisAngle(AX, thigh * D2R);
    rotBone(leg[0], _qa.multiply(_qb));
    rotBone(leg[1], _qb.setFromAxisAngle(AX, knee * D2R));
  }
  function armPose(arm, side, a, fore, inward) {
    _qa.setFromAxisAngle(AZ, -side * inward * D2R);
    _qb.setFromAxisAngle(AX, a * D2R);
    rotBone(arm[0], _qa.multiply(_qb));
    rotBone(arm[1], _qb.setFromAxisAngle(AX, fore * D2R));
  }
  function placeFoot(leg, i) {
    const end = leg[2], foot = leg[3];
    if (!end || !foot) return;
    end.getWorldPosition(_v);
    foot.parent.worldToLocal(_v);
    foot.position.copy(_v);
    if (rider.footRest[i]) foot.quaternion.copy(rider.footRest[i]);
  }

  function updateRider(r) {
    const rig = rider.rig, pose = POSE[r.id];
    const seat = r.seat || r.model;
    seat.updateWorldMatrix(true, false);
    seat.getWorldPosition(_seatW);
    (r.tank && r.turret ? r.turret : r.model).getWorldQuaternion(_qPerson);   // 전차장은 포탑을 따라 돈다
    person.quaternion.copy(_qPerson);

    if (rig) {
      for (const e of rig.base) e.bone.quaternion.copy(e.q);
      let tL = pose.thigh, tR = pose.thigh, kL = pose.knee, kR = pose.knee;
      if (pose.pedal) {   // 페달 각도에 맞춰 두 다리를 엇갈려 움직인다
        const s = Math.sin(r.pedalAng), c = Math.cos(r.pedalAng);
        tL += s * 16; kL += c * 22; tR -= s * 16; kR -= c * 22;
      }
      legPose(rig.legL, 1, tL, pose.spread, kL);
      legPose(rig.legR, -1, tR, pose.spread, kR);
      armPose(rig.armL, 1, pose.arm, pose.fore, pose.inward);
      armPose(rig.armR, -1, pose.arm, pose.fore, pose.inward);
      if (pose.hideLegs) for (const b of [rig.legL[0], rig.legR[0], rig.legL[3], rig.legR[3]]) if (b) b.scale.setScalar(0.001);
    }
    // 엉덩이 뼈가 seat(+lift) 에 오도록 사람 원점을 옮긴다
    _off.set(0, pose.lift, pose.hipZ).sub(rider.hip).applyQuaternion(_qPerson);
    person.position.copy(_seatW).add(_off);
    if (rig) {
      person.updateMatrixWorld(true);
      placeFoot(rig.legL, 0); placeFoot(rig.legR, 1);
    }
  }

  /* ── 탈것 애니메이션 ── */
  const GAIT = { horse: [0.35, 5.2], carriage: [0.3, 4.2] };   // [걷기 시작, 구보 시작]
  function animate(r, dt, inp, driving) {
    if (r.tank) { animateTank(r, dt, inp, driving); return; }
    const sp = inp.speed || 0, as = Math.abs(sp), st = inp.steer || 0;
    if (r.mixer && r.acts) {
      const g = GAIT[r.id] || GAIT.horse;
      const want = as < g[0] ? 0 : as < g[1] ? 1 : 2;
      const k = Math.min(1, dt * 6);
      for (let i = 0; i < 3; i++) {
        r.w[i] += ((i === want ? 1 : 0) - r.w[i]) * k;
        if (r.acts[i]) r.acts[i].setEffectiveWeight(r.w[i]);
      }
      if (r.acts[1]) r.acts[1].timeScale = Math.max(0.6, Math.min(1.7, as / 2.4)) * (sp < 0 ? -1 : 1);
      if (r.acts[2]) r.acts[2].timeScale = Math.max(0.75, Math.min(1.5, as / 8));
      r.mixer.update(dt);
    }
    for (let i = 0; i < r.wheels.length; i++) {
      const w = r.wheels[i];
      if (w.front && !w.noSteer) w.node.rotation.y = st * 0.3;
      w.node.rotation.x += sp * dt / w.r;
    }
    if (r.steer) r.steer.rotation.y = st * 0.45;
    if (r.pedals && sp > 0.05) { r.pedalAng += sp * dt / 0.35 / 2.4; r.pedals.rotation.x = r.pedalAng; }
    const maxLean = r.id === 'motorcycle' ? 0.34 : r.id === 'bicycle' ? 0.2 : r.id === 'horse' ? 0.06 : 0;
    const target = -st * Math.min(1, as / 6) * maxLean;
    r.lean += (target - r.lean) * Math.min(1, dt * 5);
    holder.rotation.z = r.lean;
  }

  /* ── 선택 ── */
  let current = 'car', wanted = 'car', destroyed = false;
  const api = {
    get current() { return current; },
    get pending() { return wanted !== current ? wanted : null; },
    list: VEHICLES,
    params: id => PARAMS[id || current],
    listeners: new Set(),
    async select(id) {
      if (!BY_ID[id] || destroyed) return current;
      wanted = id;
      emit('loading');
      if (id !== 'car') {
        try { await load(id); }
        catch (e) { console.warn('[vehicles] 불러오기 실패:', id, e); if (wanted === id) wanted = current; emit('error'); return current; }
      }
      if (wanted !== id || destroyed) return current;   // 그새 다른 걸 골랐다
      activate(id);
      return current;
    },
    next() {
      const i = VEHICLES.findIndex(v => v.id === wanted);
      return api.select(VEHICLES[(i + 1) % VEHICLES.length].id);
    },
    update,
    preload(ids = VEHICLES.map(v => v.id)) { for (const id of ids) if (BY_ID[id].url) load(id).catch(() => {}); },
    /* ── 탱크 ── */
    /** 메인 루프에서 updateCamera(dt) 바로 다음에 부른다 — 포격·폭발 카메라 흔들림 */
    postCamera(cam = camera) { if (fx) fx.applyShake(cam); },
    /** 탱크를 몰고 있어 왼쪽 클릭이 사격으로 쓰이는 중 (손님 잡기·주먹은 이때 막는다) */
    ownsPointer: () => current === 'tank' && wasDriving && !destroyed,
    /** 폭발 효과·충격 (다른 무기도 쓸 수 있다). pos = {x,y,z} */
    explode(pos, radius = 6, force = 1) { ensureFx().explode(pos, radius, force); },
    /** 테스트용: 지금 조준점으로 쏜다 (장전 중이면 false) */
    fire() { const r = cache.tank; if (!r || current !== 'tank' || aim.reload > 0) return false; fireNow(r); return true; },
    /** 테스트용: 화면 좌표(ndc -1..1)로 조준 */
    aimAt(nx, ny) { aim.ndc.set(nx, ny); aim.has = true; },
    get tankState() { const r = cache.tank; return r ? { yaw: r.yaw, pitch: r.pitch, reload: aim.reload, aim: aim.point, valid: aim.valid } : null; },
    dispose() {
      destroyed = true;
      if (domElement) { domElement.removeEventListener('pointermove', onPtrMove); domElement.removeEventListener('pointerdown', onPtrDown); }
      removeEventListener('keydown', onKeyUnlock);
      reticle.dispose();
      if (fx) fx.dispose(); else tankAudio.dispose();
      unmount(false);
      syncCarVisibility(true);
      applyLights(null);
      carGroup.remove(holder);
      for (const id in cache) cache[id].mixer && cache[id].mixer.stopAllAction();
      api.listeners.clear();
    }
  };
  function emit(state) { for (const f of api.listeners) f(state, api); }

  let wasDriving = true;
  function activate(id) {
    const prev = cache[current];
    if (prev) prev.model.visible = false;
    if (rider.mounted) unmount(id !== 'car' ? true : false);
    current = id;
    const r = cache[id];
    holder.rotation.z = 0; holder.rotation.x = 0;
    if (r) { r.model.visible = true; r.lean = 0; if (r.tank) r.prevH = null; }
    if (id === 'tank') tankAudio.unlock();
    aim.pending = 0;
    syncCarVisibility(id === 'car');
    applyLights(r ? r.light : null);
    if (id === 'car' && wasDriving) person.visible = false;
    if (onChange) onChange(id, PARAMS[id]);
    emit('change');
  }

  function update(dt, inp) {
    if (destroyed) return;
    const driving = !inp || inp.driving !== false;
    updateMarker(dt, driving);
    const r = current !== 'car' ? cache[current] : null;
    syncCarVisibility(!r);
    if (fx) fx.update(dt, camera);   // 탈것을 바꿔도 터지던 폭발은 끝까지
    const tankOn = !!(r && r.tank && driving);
    reticle.show(tankOn && !blocked());
    reticle.tick(dt);
    if (!tankOn && r !== cache.tank && cache.tank) tankAudio.engine(0, 0);

    if (!r) {
      if (rider.mounted) unmount(!driving);
      wasDriving = driving;
      return;
    }
    animate(r, dt, inp || api._zero, driving);

    if (!rider.rig) {
      rider.searchT -= dt;
      if (rider.searchT <= 0) { rider.searchT = 0.5; rider.rig = findRig(); if (rider.rig && rider.mounted) { unmount(true); } }
    }
    if (driving) {
      if (!rider.mounted || rider.forRide !== r.id) { if (rider.mounted) unmount(true); mount(r); }
      updateRider(r);
    } else if (rider.mounted) {
      unmount(true);   // F 로 내림 → portfolio.js 가 이미 person 을 옆에 세워 두었다
    }
    wasDriving = driving;
  }
  api._zero = { speed: 0, steer: 0, moving: false, boosting: false, driving: true };

  return api;
}

/* ════════════════════════════════════════════════════════════
   상단 버튼 + 메뉴.  #g-top 의 .sp(오른쪽 정렬 여백) 바로 뒤에 들어간다.
   ════════════════════════════════════════════════════════════ */
const CSS = `
.g-ride{position:relative;pointer-events:auto;display:inline-flex}
body.intro-on .g-ride{visibility:hidden}
.g-ride-btn{display:inline-flex;align-items:center;gap:7px;cursor:pointer;font:inherit}
.g-ride-btn svg{flex-shrink:0}
.g-ride-btn .cv{opacity:.55;transition:transform .15s}
.g-ride-btn[aria-expanded="true"] .cv{transform:rotate(180deg)}
.g-ride-btn.busy .ic{animation:g-ride-bob .7s ease-in-out infinite alternate}
@keyframes g-ride-bob{to{transform:translateY(-2px)}}
.g-ride-menu{position:absolute;top:calc(100% + 8px);right:0;min-width:208px;margin:0;padding:6px;list-style:none;
  background:var(--panel,rgba(255,255,255,.9));backdrop-filter:blur(12px);border:1px solid var(--line,rgba(29,42,51,.12));
  border-radius:13px;box-shadow:0 12px 32px rgba(29,42,51,.18);z-index:45}
.g-ride-menu[hidden]{display:none}
.g-ride-menu .hd{font-size:10.5px;font-weight:700;letter-spacing:.08em;color:var(--muted,#5b6d79);padding:6px 10px 4px}
.g-ride-menu button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:9px;
  background:none;font:inherit;font-size:13px;color:var(--ink,#1d2a33);cursor:pointer;text-align:left}
.g-ride-menu button:hover,.g-ride-menu button:focus-visible{background:rgba(232,115,74,.12);outline:none}
.g-ride-menu button[aria-checked="true"]{background:rgba(232,115,74,.16);font-weight:700}
.g-ride-menu button .tx{display:flex;flex-direction:column;line-height:1.25}
.g-ride-menu button .sb{font-size:11px;font-weight:500;color:var(--muted,#5b6d79)}
.g-ride-menu button .ck{margin-left:auto;opacity:0;color:#e8734a}
.g-ride-menu button[aria-checked="true"] .ck{opacity:1}
.g-ride-menu .ft{font-size:11px;color:var(--muted,#5b6d79);padding:6px 10px 3px;border-top:1px solid var(--line,rgba(29,42,51,.1));margin-top:4px}
.g-ride-menu kbd{font-family:var(--mono,monospace);font-size:10.5px;border:1px solid var(--line,rgba(29,42,51,.2));border-radius:4px;padding:0 4px}
@media (max-width:640px){.g-ride-btn .nm{display:none}}
`;
const svg = (id, s = 16) =>
  `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>`;

export function mountVehicleButton({ container, switcher, isActive, bindKey = 'KeyV' }) {
  if (!document.getElementById('g-ride-css')) {
    const st = document.createElement('style'); st.id = 'g-ride-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const wrap = document.createElement('div');
  wrap.className = 'g-ride';
  const menuId = 'g-ride-menu';
  wrap.innerHTML = `
    <button class="g-btn g-ride-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="${menuId}"
      title="탈것 바꾸기 (V)"><span class="ic-w"></span><span class="nm"></span>
      <svg class="cv" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <div class="g-ride-menu" id="${menuId}" role="menu" aria-label="탈것 고르기" hidden>
      <div class="hd" aria-hidden="true">탈것 고르기</div>
      ${switcher.list.map(v => `<button type="button" role="menuitemradio" aria-checked="false" data-id="${v.id}" tabindex="-1">
        ${svg(v.id, 20)}<span class="tx"><span>${v.name}</span><span class="sb">${v.sub}</span></span>
        <svg class="ck" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17l9-10"/></svg></button>`).join('')}
      <div class="ft" aria-hidden="true"><kbd>V</kbd> 다음 탈것</div>
    </div>`;
  const btn = wrap.querySelector('.g-ride-btn');
  const menu = wrap.querySelector('.g-ride-menu');
  const items = [...menu.querySelectorAll('[role="menuitemradio"]')];
  const sp = container.querySelector('.sp');
  if (sp) sp.after(wrap); else container.appendChild(wrap);

  const nameOf = id => (switcher.list.find(v => v.id === id) || {}).name;
  function render() {
    const shown = switcher.pending || switcher.current;
    btn.querySelector('.ic-w').innerHTML = svg(shown, 16);
    btn.querySelector('.nm').textContent = nameOf(shown) + (switcher.pending ? ' …' : '');
    btn.classList.toggle('busy', !!switcher.pending);
    btn.setAttribute('aria-label', `탈것: ${nameOf(switcher.current)}${switcher.pending ? `, ${nameOf(switcher.pending)} 불러오는 중` : ''}. 바꾸기 (V)`);
    for (const it of items) it.setAttribute('aria-checked', String(it.dataset.id === shown));
  }
  switcher.listeners.add(render);
  render();

  const isOpen = () => !menu.hidden;
  function open(focusCurrent) {
    menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
    if (focusCurrent) (items.find(i => i.getAttribute('aria-checked') === 'true') || items[0]).focus();
  }
  function close(refocus) {
    if (!isOpen()) return;
    menu.hidden = true; btn.setAttribute('aria-expanded', 'false');
    if (refocus) btn.focus();
  }
  btn.addEventListener('click', e => {
    if (isOpen()) close(false); else open(e.detail === 0);   // 키보드로 열면 현재 항목에 초점
    if (e.detail > 0) btn.blur();                            // 마우스로 눌렀으면 Space(브레이크)가 버튼을 다시 누르지 않게
  });
  btn.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); open(true); }
    else if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();   // 운전 키(Space=브레이크)로 새지 않게
    else if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(true); }
  });
  menu.addEventListener('keydown', e => {
    e.stopPropagation();   // 메뉴 안의 방향키·Space 는 운전에 쓰지 않는다
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close(false);
  });
  menu.addEventListener('click', e => {
    const it = e.target.closest('[role="menuitemradio"]');
    if (!it) return;
    switcher.select(it.dataset.id);
    close(e.detail === 0);
    if (e.detail > 0) btn.blur();
  });
  const onDocDown = e => { if (isOpen() && !wrap.contains(e.target)) close(false); };
  document.addEventListener('pointerdown', onDocDown);

  const active = isActive || (() =>
    !document.body.classList.contains('intro-on') &&
    document.body.dataset.view !== 'doc' &&
    !document.querySelector('#g-panel.open') &&
    container.getClientRects().length > 0);
  const onKey = e => {
    if (e.code !== bindKey || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (!active()) return;
    e.preventDefault();
    switcher.next();
  };
  addEventListener('keydown', onKey);

  return {
    el: wrap, open, close,
    dispose() {
      removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDocDown);
      switcher.listeners.delete(render);
      wrap.remove();
    }
  };
}
