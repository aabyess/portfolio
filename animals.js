/* ════════════════════════════════════════════════════════════════════
   animals.js — 상호랜드 동물들 (판다·곰·사슴·여우·토끼·양·멧돼지·강아지·고양이)
     models/animals/<종>.glb 9종(헤드리스 Blender, tools/blender/animals/ 로 다시 만듦)을 복제해서
     19마리를 사는 곳에 맞춰 풀어 놓는다.
       숲 가장자리(길에서 먼 곳): 사슴 3 · 여우 2 · 토끼 3 · 멧돼지 1 · 곰 1
       대나무 숲(코드로 만든 대나무 3덤불): 판다 2 — 앉아서 대나무를 오물오물
       출발점 서쪽 풀밭: 양 5마리 무리 / 가판대 근처: 강아지 1 · 고양이 1
     하는 일
       · 돌아다니기(목표점 → 조향, 경계 안, 야생 동물은 길 한가운데를 피함, 연못·개울·가판대 피함), 풀 뜯기, 쉬기, 앉기/엎드리기
       · 겁 많은 동물(토끼·사슴·여우·양·고양이)은 플레이어가 뛰어오거나 아주 가까이 오면 도망. 양은 무리 지어 같이 도망
       · 토끼는 가끔 뒷발로 서서 두리번(Stand) → 더 오면 도망
       · 강아지: 플레이어 옆에 가만히 서 있으면 30초쯤 졸졸 따라다닌다
       · 곰·판다: 가까이 가면 가끔 뒷발로 벌떡 서서 어흥 / 손 흔들기 (때리지 않는다, 만화)
       · hitAt(pos, r, force): 주먹·폭발·차에 맞으면 데굴데굴 굴러 옆으로 누워 버둥 → 별이 빙빙 → 일어나 도망 (피 없음)
     가볍게: 동물마다 AnimationMixer 하나. 45 m 밖은 0.25초마다, 85 m 밖은 동작 갱신을 멈추고 숨긴다.

   ── portfolio.js 연결 (PM 이 넣는다) ──
     ① 위쪽 let 묶음에:  let animals = null;
     ② 탈것(car/heading/speed)과 npcs 블록 아래 아무 데나 (stations 가 만들어진 뒤):
        {
          const { createAnimals } = await import('./animals.js');
          animals = createAnimals({
            THREE, scene, GLTFLoader, dracoLoader: draco, groundY, pathX,
            bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
            roadHalf: WORLD.path.half, waterY: WORLD.stream.water,
            stalls: stations.map(s => ({ x: s.group.position.x, z: s.group.position.z })),
            getPlayerPos: () => activePos(),
            getNpcs: () => npcs,
            isOnFoot: () => player.mode === 'onfoot',
            isBlocked: () => !driveActive,            // 문서 뷰에선 멈춘다
            onEvent: text => toast(text, 2200),
            getRide: () => rideInfo,                   // npcs 와 같은 객체(차로 치면 데굴데굴). npcs 의 getRide 가 매 프레임 채운다
          });
        }
     ③ step(dt) 안, npcs.update 다음 줄:   if (animals) animals.update(dt, t);
     ④ (선택) 맞히기 연결
        - 폭발: createWeapons 옵션에 onExplode: (p, r, f) => { if (animals) animals.hitAt(p, r, f); },
        - 총소리·폭탄: 기존 onNoise 안에 if (animals) animals.alarm(p);  (주변 동물이 놀라 도망)
        - 맨손 주먹: attachGrab 의 playPunch: () => { playerPunch(); if (animals) animals.punchFrom(person.position, person.rotation.y); },
        - 근접 무기(칼·도끼·망치·프라이팬)는 weapons.js 에 휘두르기 훅이 없어서, 필요하면 meleeHit 끝에
          onMelee?.(p, yaw, def.range) 같은 훅을 담당자가 추가 → animals.punchFrom(p, yaw, range, 8).
        - 탱크 포탄은 weapons.explode 를 거치므로 onExplode 로 같이 잡힌다.

   ── 옵션 ──
     THREE, scene, GLTFLoader, dracoLoader, groundY(x,z), pathX(z)            — 필수
     bounds {minX,maxX,minZ,maxZ}, roadHalf(길 반폭, 2.52), waterY(개울 수면, -0.45)
     stalls [{x,z}]   피해 갈 가판대 자리 (없으면 getNpcs().stalls)
     getPlayerPos() → {x,z}, isOnFoot(), getNpcs(), isBlocked() → true 면 멈춤
     onEvent(text)    알림 (6초에 한 번만)
     getRide()        → {x,z,heading,speed,driving,halfX,halfZ}  차에 치이기
     isPond(x,z)      물이면 true (기본: fishing.js 의 PONDS 원 + 개울)
     count            종별 마릿수 덮어쓰기 {deer: 2, ...}
     debug            ?test 면 window.__animals

   ── 반환 API ──
     update(dt, t), list(), dispose()
     hitAt(pos, radius = 3, force = 8)            반경 안 동물을 날려 보낸다 (주먹·폭발·차)
     punchFrom(pos, yaw, range = 1.7, force = 6)  pos 에서 yaw(앞 = (sin, cos)) 방향 부채꼴 안 동물을 친다
     alarm(pos, radius = 16)                      놀라서 도망
     pick(raycaster)  → { animal, distance, point } | null   (동물 몸을 감싸는 구로 판정)
     ready            Promise (모델 다 읽으면 끝남)
   콘솔(?test): __animals.list(), __animals.near(), __animals.tp('panda'), __animals.hit(), __animals.spawn('dog', x, z)
   ════════════════════════════════════════════════════════════════════ */

import { PONDS } from './fishing.js';

/* 종별 성격 — walk/run: 이동 속도(m/s), walkRef/runRef: 동작 1배속에서 발이 안 미끄러지는 속도(Blender 빌드가 계산),
   flee: 도망 시작 거리(뛰어올 때), shy: 걸어와도 도망치는 거리, r: 몸 반지름(충돌·맞기), h: 몸 중심 높이 */
const SPECIES = {
  panda:  { ko: '판다',   walk: 0.5, run: 1.9, walkRef: 0.46, runRef: 1.83, flee: 0,  shy: 0,   r: 0.55, h: 0.6,  stand: true,  sitLong: true,  mass: 1.6 },
  bear:   { ko: '곰',     walk: 0.7, run: 3.0, walkRef: 0.68, runRef: 2.7,  flee: 0,  shy: 0,   r: 0.75, h: 0.8,  stand: true,  mass: 2.2 },
  deer:   { ko: '사슴',   walk: 0.9, run: 5.5, walkRef: 1.0,  runRef: 4.0,  flee: 13, shy: 6,   r: 0.45, h: 1.0,  mass: 1.2 },
  fox:    { ko: '여우',   walk: 0.6, run: 4.5, walkRef: 0.35, runRef: 1.4,  flee: 10, shy: 4.5, r: 0.3,  h: 0.35, mass: 0.6 },
  rabbit: { ko: '토끼',   walk: 0.4, run: 3.6, walkRef: 0.16, runRef: 0.72, flee: 9,  shy: 4,   r: 0.18, h: 0.15, stand: true, mass: 0.3 },
  sheep:  { ko: '양',     walk: 0.5, run: 2.6, walkRef: 0.53, runRef: 2.12, flee: 7,  shy: 2.6, r: 0.45, h: 0.6,  mass: 1.0, flock: true },
  boar:   { ko: '멧돼지', walk: 0.6, run: 3.6, walkRef: 0.46, runRef: 1.83, flee: 5,  shy: 2.2, r: 0.42, h: 0.5,  mass: 1.3 },
  dog:    { ko: '강아지', walk: 0.8, run: 4.2, walkRef: 0.4,  runRef: 1.59, flee: 0,  shy: 0,   r: 0.28, h: 0.4,  mass: 0.7, follow: true },
  cat:    { ko: '고양이', walk: 0.45, run: 3.2, walkRef: 0.21, runRef: 0.84, flee: 6,  shy: 1.8, r: 0.18, h: 0.22, mass: 0.4 },
};

/* 사는 곳: [종, 중심 x, z, 돌아다니는 반지름, 마릿수, wild(길 피함)] */
const HABITATS = [
  ['sheep', -18, 60, 8, 5, false],
  ['rabbit', 17, 55, 7, 2, true], ['rabbit', -19, 18, 7, 1, true],
  ['deer', -27, -28, 12, 2, true], ['deer', 29, -18, 11, 1, true],
  ['fox', 25, 40, 12, 1, true], ['fox', -24, -64, 12, 1, true],
  ['boar', 30, -70, 10, 1, true],
  ['bear', -30, -8, 11, 1, true],
  ['panda', -25, 33, 6, 2, true],
  ['dog', 6.5, 30, 10, 1, false],
  ['cat', -5, 5, 7, 1, false],
];
const BAMBOO_AT = { x: -25, z: 33 };

const NEAR_MIX = 45, FAR_MIX = 85;     // 동작 갱신: 45 m 안은 매 프레임, 85 m 안은 0.25초마다, 밖은 숨김
const EVENT_GAP = 6;

export function createAnimals({
  THREE, scene, GLTFLoader, dracoLoader = null, groundY = () => 0, pathX = () => 0,
  bounds = { minX: -42, maxX: 42, minZ: -84, maxZ: 84 }, roadHalf = 2.52, waterY = -0.45,
  stalls = null, getPlayerPos = () => ({ x: 0, z: 0 }), isOnFoot = () => true, getNpcs = () => null,
  isBlocked = () => false, onEvent = null, getRide = null, isPond = null, count = null,
  debug = typeof location !== 'undefined' && /[?&]test\b/.test(location.search),
} = {}) {
  const B = bounds;
  const animals = [];
  const rr = (a, b) => a + (b - a) * Math.random();
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  let clock = 0, lastEvent = -99, disposed = false;
  const extra = [];   // 대나무 등 내가 scene 에 넣은 것

  /* ── 물·가판대·경계 ── */
  const pondHit = isPond || ((x, z) => {
    for (const p of PONDS) { const dx = x - p.x, dz = z - p.z; if (dx * dx + dz * dz < (p.r + 1.0) ** 2) return true; }
    return groundY(x, z) < waterY + 0.1;      // 개울 바닥
  });
  const stallList = () => stalls || (getNpcs() && getNpcs().stalls) || [];
  function blocked(x, z, wild) {
    if (x < B.minX + 1.5 || x > B.maxX - 1.5 || z < B.minZ + 1.5 || z > B.maxZ - 1.5) return true;
    if (pondHit(x, z)) return true;
    for (const s of stallList()) { const dx = x - s.x, dz = z - s.z; if (dx * dx + dz * dz < 12) return true; }
    if (wild && Math.abs(x - pathX(z)) < roadHalf + 1.5) return true;
    return false;
  }
  function say(text) {
    if (!onEvent || clock - lastEvent < EVENT_GAP) return;
    lastEvent = clock; onEvent(text);
  }

  /* ── 대나무 숲 (판다 집) — 줄기 1 + 잎 1 = 2 draw call ── */
  function makeBamboo() {
    const stalkG = new THREE.CylinderGeometry(0.035, 0.045, 1, 7, 6);
    { // 마디: 높이 방향으로 살짝 부풀린다
      const p = stalkG.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) + 0.5, k = 1 + 0.18 * Math.max(0, 1 - Math.abs(((y * 6) % 1) - 0.5) * 8);
        p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
      }
      stalkG.computeVertexNormals();
    }
    stalkG.translate(0, 0.5, 0);
    const leafG = new THREE.PlaneGeometry(0.07, 0.34); leafG.translate(0, 0.17, 0);
    const stalkM = new THREE.MeshStandardMaterial({ color: 0x6f9a3a, roughness: 0.6 });
    const leafM = new THREE.MeshStandardMaterial({ color: 0x5f9b35, roughness: 0.8, side: THREE.DoubleSide });
    const clumps = [[0, 0], [3.2, 2.4], [-2.6, 3.0], [1.5, -3.2]];
    const NS = 34, NL = NS * 9;
    const stalksI = new THREE.InstancedMesh(stalkG, stalkM, NS), leavesI = new THREE.InstancedMesh(leafG, leafM, NL);
    stalksI.castShadow = true; leavesI.castShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let li = 0;
    for (let i = 0; i < NS; i++) {
      const c = clumps[i % clumps.length], a = rr(0, 6.28), d = rr(0, 1.1);
      const x = BAMBOO_AT.x + c[0] + Math.cos(a) * d, z = BAMBOO_AT.z + c[1] + Math.sin(a) * d, H = rr(2.6, 4.6);
      e.set(rr(-0.08, 0.08), 0, rr(-0.08, 0.08)); q.setFromEuler(e);
      m.compose(p.set(x, groundY(x, z) - 0.05, z), q, s.set(1, H, 1)); stalksI.setMatrixAt(i, m);
      for (let k = 0; k < 9; k++) {
        const hy = H * rr(0.55, 1.0);
        e.set(rr(0.6, 1.3), rr(0, 6.28), 0, 'YXZ'); q.setFromEuler(e);
        m.compose(p.set(x, groundY(x, z) + hy, z), q, s.set(1, rr(0.8, 1.3), 1)); leavesI.setMatrixAt(li++, m);
      }
    }
    scene.add(stalksI, leavesI); extra.push(stalksI, leavesI);
  }
  makeBamboo();

  /* ── 별 빙빙 (기절) — 하나를 돌려 쓴다 ── */
  const starGeo = new THREE.OctahedronGeometry(0.07, 0);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffd84a });
  function makeStars() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(starGeo, starMat); s.position.set(Math.cos(i * 1.57) * 0.3, 0, Math.sin(i * 1.57) * 0.3); g.add(s); }
    g.visible = false; scene.add(g); extra.push(g);
    return g;
  }

  /* ── 모델 읽기 ── */
  const loader = new GLTFLoader();
  if (dracoLoader) loader.setDRACOLoader(dracoLoader);
  const kinds = [...new Set(HABITATS.map(h => h[0]))];
  const ready = (async () => {
    const { clone } = await import('three/addons/utils/SkeletonUtils.js');
    const gl = {};
    await Promise.all(kinds.map(k => loader.loadAsync(`models/animals/${k}.glb`).then(g => { gl[k] = g; })
      .catch(e => console.warn('[animals] load', k, e))));
    if (disposed) return;
    let id = 0;
    for (const [kind, hx, hz, hr, n0, wild] of HABITATS) {
      if (!gl[kind]) continue;
      const n = count && count[kind] != null ? Math.round(count[kind] * n0 / HABITATS.filter(h => h[0] === kind).reduce((s, h) => s + h[4], 0)) : n0;
      const flock = SPECIES[kind].flock ? { x: hx, z: hz, tx: hx, tz: hz, t: 0, fleeT: 0, fx: 0, fz: 0 } : null;
      for (let i = 0; i < n; i++) {
        let x = hx, z = hz;
        for (let k = 0; k < 30; k++) {
          const a = rr(0, 6.28), d = rr(0, hr * 0.7);
          x = hx + Math.cos(a) * d; z = hz + Math.sin(a) * d;
          if (!blocked(x, z, wild)) break;
        }
        animals.push(spawn(kind, x, z, { home: { x: hx, z: hz, r: hr }, wild, flock, id: id++, gltf: gl[kind], clone }));
      }
    }
    api.gltf = gl; api._clone = clone;
  })();

  function spawn(kind, x, z, { home, wild, flock = null, id = 0, gltf, clone }) {
    const sp = SPECIES[kind];
    const model = clone(gltf.scene);
    model.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
    });
    const obj = new THREE.Group(); obj.name = 'animal-' + kind;
    const tumbler = new THREE.Group();          // 데굴데굴은 이 안쪽에서 돈다 (몸 중심 기준)
    tumbler.position.y = sp.h; model.position.y = -sp.h;
    tumbler.add(model); obj.add(tumbler);
    const yaw = rr(-Math.PI, Math.PI);
    obj.position.set(x, groundY(x, z), z); obj.rotation.y = yaw;
    scene.add(obj);
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const c of gltf.animations) {
      const a = mixer.clipAction(c);
      if (c.name === 'Stand') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      actions[c.name] = a;
    }
    const a = {
      id, kind, sp, ko: sp.ko, obj, tumbler, model, mixer, actions, cur: null,
      x, z, y: obj.position.y, yaw, speed: 0, want: 0, tx: x, tz: z,
      mode: 'idle', timer: rr(0.5, 4), home, wild, flock, mixAcc: 0,
      vx: 0, vy: 0, vz: 0, air: false, spin: 0, roll: 0, rollV: 0, dizzy: 0, stars: null,
      cool: rr(0, 5), followT: 0, nearT: 0, standCool: rr(0, 6), bamboo: null,
    };
    if (kind === 'panda') a.bamboo = addBamboo(model);
    play(a, 'Idle', 0);
    a.actions.Idle && (a.actions.Idle.time = rr(0, 3));
    return a;
  }

  /* 판다 손에 대나무 (앉아서 먹을 때만 보임) */
  function addBamboo(model) {
    const bone = model.getObjectByName('FL_Lower');
    if (!bone) return null;
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x7aa443, roughness: 0.6 }));
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.22), new THREE.MeshStandardMaterial({ color: 0x5f9b35, side: THREE.DoubleSide }));
    leaf.position.set(0.03, 0.27, 0); leaf.rotation.z = -0.6;
    stick.add(leaf);
    stick.rotation.x = Math.PI / 2;            // 뼈(아래팔) 방향과 직각
    g.add(stick);
    g.position.set(0, 0.30, 0.0);              // 아래팔 끝(발) 근처
    g.visible = false;
    bone.add(g);
    return g;
  }

  function play(a, name, fade = 0.25, ts = 1) {
    const act = a.actions[name] || a.actions.Idle;
    if (!act) return;
    act.timeScale = ts;
    if (a.cur === name) return;
    const prev = a.cur && a.actions[a.cur];
    act.reset(); act.enabled = true; act.setEffectiveWeight(1);
    if (prev && fade > 0) act.crossFadeFrom(prev, fade, false); else if (prev) prev.stop();
    act.play();
    a.cur = name;
    if (a.bamboo) a.bamboo.visible = name === 'Sit';
  }

  /* ── 목표점 고르기 ── */
  function pickTarget(a, far = 1) {
    const h = a.home;
    for (let k = 0; k < 14; k++) {
      const ang = rr(0, 6.28), d = rr(h.r * 0.2, h.r) * far;
      const x = h.x + Math.cos(ang) * d, z = h.z + Math.sin(ang) * d;
      if (!blocked(x, z, a.wild)) { a.tx = x; a.tz = z; return true; }
    }
    a.tx = h.x; a.tz = h.z; return false;
  }
  function fleeFrom(a, px, pz, dur = rr(3, 5)) {
    let dx = a.x - px, dz = a.z - pz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    let best = null;
    for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
      const ang = Math.atan2(dx, dz) + off, d = 10 + rr(0, 5);
      const x = a.x + Math.sin(ang) * d, z = a.z + Math.cos(ang) * d;
      if (!blocked(x, z, false)) { best = [x, z]; break; }
    }
    if (!best) best = [a.home.x, a.home.z];
    a.tx = best[0]; a.tz = best[1];
    a.mode = 'flee'; a.timer = dur;
    if (a.flock && a.flock.fleeT <= 0) { a.flock.fleeT = dur; a.flock.fx = px; a.flock.fz = pz; }
  }

  /* ── 맞기 ── */
  function knock(a, ix, iz, up, why) {
    if (a.mode === 'tumble' && a.air) { a.vx += ix * 0.3; a.vz += iz * 0.3; return; }
    const m = a.sp.mass;
    a.vx = ix / m; a.vz = iz / m; a.vy = up / Math.sqrt(m);
    a.air = true; a.mode = 'tumble'; a.timer = 0;
    a.spin = Math.sign(Math.random() - 0.5) || 1;
    a.rollV = a.spin * rr(9, 14);
    play(a, 'Run', 0.1, 2.4);
    if (a.flock) { a.flock.fleeT = 4; a.flock.fx = a.x - ix; a.flock.fz = a.z - iz; }
    const lines = {
      bear: '곰이 데굴데굴! "어흥?!"', panda: '판다가 데굴데굴~ 공처럼 굴러가요', deer: '사슴이 휘청! 깜짝 놀랐어요',
      fox: '여우가 데굴! "캥!"', rabbit: '토끼가 콩! 하고 튀었어요', sheep: '양이 데굴데굴 "메에에~"',
      boar: '멧돼지가 꽥! 하고 굴렀어요', dog: '강아지가 깨갱! (괜찮아요)', cat: '고양이가 냐앙! 하고 날아갔어요',
    };
    say(lines[a.kind] || '동물이 데굴데굴!');
  }
  function hitAt(pos, radius = 3, force = 8) {
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return 0;
    let n = 0;
    for (const a of animals) {
      const dx = a.x - pos.x, dz = a.z - pos.z, d = Math.hypot(dx, dz);
      if (!(d <= radius + a.sp.r)) continue;
      const k = clamp(1 - d / (radius + a.sp.r), 0.25, 1), l = d || 1;
      knock(a, dx / l * force * k, dz / l * force * k, 2.5 + force * 0.45 * k, 'hit');
      n++;
    }
    // 주변은 놀라서 도망
    alarm(pos, radius * 3 + 6);
    return n;
  }
  function punchFrom(pos, yaw, range = 1.7, force = 6) {
    if (!pos) return 0;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let n = 0;
    for (const a of animals) {
      const dx = a.x - pos.x, dz = a.z - pos.z, d = Math.hypot(dx, dz);
      if (d > range + a.sp.r || d < 1e-3) continue;
      if ((dx * fx + dz * fz) / d < 0.35) continue;     // 앞쪽 약 70° 부채꼴
      knock(a, (dx / d * 0.6 + fx * 0.4) * force, (dz / d * 0.6 + fz * 0.4) * force, 3 + force * 0.25, 'punch');
      n++;
    }
    return n;
  }
  function alarm(pos, radius = 16) {
    if (!pos || !Number.isFinite(pos.x)) return;
    for (const a of animals) {
      if (a.mode === 'tumble' || a.mode === 'dizzy') continue;
      const d = Math.hypot(a.x - pos.x, a.z - pos.z);
      if (d < radius) { a.followT = 0; fleeFrom(a, pos.x, pos.z, rr(4, 6)); }
    }
  }

  /* ── 매 프레임 ── */
  const prevP = { x: NaN, z: NaN }; let pSpeed = 0;
  function update(dt, t) {
    if (!animals.length || disposed) return;
    if (isBlocked && isBlocked()) return;
    dt = Math.min(dt, 0.05); clock += dt;
    const P = getPlayerPos() || { x: 0, z: 0 };
    if (Number.isFinite(prevP.x)) {
      const v = Math.hypot(P.x - prevP.x, P.z - prevP.z) / Math.max(dt, 1e-3);
      pSpeed += (Math.min(v, 30) - pSpeed) * Math.min(1, dt * 6);
    }
    prevP.x = P.x; prevP.z = P.z;
    const onFoot = isOnFoot ? isOnFoot() : true;
    const ride = getRide ? getRide() : null;
    // 무리 정보 (양): 무리 중심
    const flocks = new Map();
    for (const a of animals) if (a.flock) {
      const f = flocks.get(a.flock) || { x: 0, z: 0, n: 0 }; f.x += a.x; f.z += a.z; f.n++; flocks.set(a.flock, f);
    }
    for (const [fl, f] of flocks) { fl.fleeT -= dt; fl.cx = f.x / f.n; fl.cz = f.z / f.n; }

    for (const a of animals) {
      const dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz);
      const sp = a.sp;
      a.timer -= dt; a.cool -= dt; a.standCool -= dt;

      /* 차에 치이기 */
      if (ride && ride.driving && Math.abs(ride.speed) > 2.5 && a.mode !== 'tumble') {
        const sx = a.x - ride.x, sz = a.z - ride.z, fx = Math.sin(ride.heading), fz = Math.cos(ride.heading);
        const lz = sx * fx + sz * fz, lx = sx * fz - sz * fx;
        if (Math.abs(lz) < (ride.halfZ || 2.1) + sp.r && Math.abs(lx) < (ride.halfX || 1) + sp.r) {
          const side = Math.sign(lx) || 1, v = Math.abs(ride.speed);
          knock(a, fx * Math.sign(ride.speed) * v * 0.8 + fz * side * 2.5, fz * Math.sign(ride.speed) * v * 0.8 - fx * side * 2.5, 3 + v * 0.35, 'car');
        }
      }

      if (a.mode === 'tumble') { tumble(a, dt); finish(a, d, dt); continue; }
      if (a.mode === 'dizzy') {
        a.roll += (Math.PI / 2 * a.spin - a.roll) * Math.min(1, dt * 6);
        if (a.stars) { a.stars.position.set(a.x, a.y + sp.h * 2.0 + 0.15, a.z); a.stars.rotation.y += dt * 5; }
        if (a.timer <= 0) {           // 일어나서 도망
          if (a.stars) { a.stars.visible = false; a.stars = null; }
          fleeFrom(a, P.x, P.z, rr(3.5, 5));
        }
        setRoll(a);
        finish(a, d, dt); continue;
      }
      if (Math.abs(a.roll) > 1e-3) { a.roll += (0 - a.roll) * Math.min(1, dt * 5); if (Math.abs(a.roll) < 0.01) a.roll = 0; setRoll(a); }

      /* 생각하기 */
      const running = pSpeed > 3.2 || (!onFoot && pSpeed > 1.5);
      if (a.mode !== 'flee' && a.mode !== 'stand') {
        if (sp.flee && d < (running ? sp.flee : sp.shy)) {
          if (a.kind === 'rabbit' && !running && a.standCool <= 0 && d > sp.shy * 0.6) { stand(a, '토끼가 귀를 쫑긋! 두리번두리번'); }
          else { a.followT = 0; fleeFrom(a, P.x, P.z); }
        } else if (a.kind === 'rabbit' && a.standCool <= 0 && d < sp.flee * 1.4 && onFoot) {
          stand(a, null);
        } else if (sp.stand && a.kind !== 'rabbit' && d < 5.5 && onFoot && a.standCool <= 0) {
          stand(a, a.kind === 'bear' ? '곰이 벌떡 일어나 "어흥~!" (겁만 줘요)' : '판다가 벌떡 서서 손을 흔들어요!');
          a.yaw = Math.atan2(-dx, -dz);
        } else if (a.flock && a.flock.fleeT > 0 && Math.hypot(a.x - a.flock.fx, a.z - a.flock.fz) < 18) {
          fleeFrom(a, a.flock.fx, a.flock.fz, rr(2.5, 4));
        } else if (sp.follow) {
          // 강아지: 가만히 선 플레이어 옆 4 m 에 2초 → 30초 따라오기
          if (a.mode !== 'follow') {
            if (d < 4 && pSpeed < 0.6 && onFoot) { a.nearT += dt; if (a.nearT > 1.5 && a.cool <= 0) { a.mode = 'follow'; a.followT = rr(25, 40); say('강아지가 꼬리를 흔들며 졸졸 따라와요!'); } }
            else a.nearT = Math.max(0, a.nearT - dt);
          }
        }
      }
      if (a.mode === 'stand') {
        a.want = 0;
        const act = a.actions.Stand;
        if (!act || !act.isRunning() || a.timer <= 0) { a.mode = 'idle'; a.timer = rr(1, 3); }
      } else if (a.mode === 'flee') {
        a.want = sp.run;
        if (a.timer <= 0 || Math.hypot(a.tx - a.x, a.tz - a.z) < 1) {
          if (sp.flee && d < sp.flee * 0.8) fleeFrom(a, P.x, P.z);
          else { a.mode = 'idle'; a.timer = rr(1, 3); a.cool = 3; if (Math.hypot(a.x - a.home.x, a.z - a.home.z) > a.home.r * 1.6) { a.home = { x: a.x, z: a.z, r: a.home.r }; } }
        }
      } else if (a.mode === 'follow') {
        a.followT -= dt;
        const off = 1.6;
        a.tx = P.x + (dx / (d || 1)) * off; a.tz = P.z + (dz / (d || 1)) * off;
        const gap = d - off;
        a.want = gap > 4 ? sp.run : gap > 0.4 ? Math.min(sp.walk * 1.6, gap * 1.2 + 0.3) : 0;
        if (a.followT <= 0 || d > 30) { a.mode = 'idle'; a.timer = 2; a.cool = 20; a.home = { x: a.x, z: a.z, r: 8 }; }
      } else if (a.mode === 'walk') {
        a.want = sp.walk;
        if (a.flock && a.flock.fleeT <= 0) { // 무리에서 너무 떨어지면 무리 쪽으로
          const fd = Math.hypot(a.x - a.flock.cx, a.z - a.flock.cz);
          if (fd > 5) { a.tx = a.flock.cx; a.tz = a.flock.cz; }
        }
        if (Math.hypot(a.tx - a.x, a.tz - a.z) < 0.6 || a.timer <= 0) rest(a);
      } else {   // idle / eat / sit
        a.want = 0;
        if (a.timer <= 0) {
          a.mode = 'walk'; a.timer = 20;
          if (a.flock) {
            if (clock - a.flock.t > 8) { a.flock.t = clock; const f = a.flock; const ang = rr(0, 6.28), dd = rr(0, a.home.r * 0.7); const x = a.home.x + Math.cos(ang) * dd, z = a.home.z + Math.sin(ang) * dd; if (!blocked(x, z, false)) { f.tx = x; f.tz = z; } }
            a.tx = a.flock.tx + rr(-2, 2); a.tz = a.flock.tz + rr(-2, 2);
            if (blocked(a.tx, a.tz, false)) pickTarget(a);
          } else pickTarget(a);
        }
      }

      steer(a, dt);
      animate(a, d, dt);
      finish(a, d, dt);
    }
    separate(dt, P);
  }

  function rest(a) {
    const k = a.kind, r = Math.random();
    if (k === 'panda') { if (r < 0.55) { a.mode = 'sit'; a.timer = rr(10, 22); } else { a.mode = 'eat'; a.timer = rr(3, 6); } }
    else if (k === 'deer' || k === 'sheep' || k === 'rabbit' || k === 'boar') {
      if (r < 0.55) { a.mode = 'eat'; a.timer = rr(3, 9); } else if (r < 0.7) { a.mode = 'sit'; a.timer = rr(8, 18); } else { a.mode = 'idle'; a.timer = rr(2, 5); }
    } else if (k === 'dog' || k === 'cat' || k === 'fox') {
      if (r < 0.3) { a.mode = 'sit'; a.timer = rr(5, 14); } else if (r < 0.55) { a.mode = 'eat'; a.timer = rr(2, 4); } else { a.mode = 'idle'; a.timer = rr(2, 5); }
    } else {
      if (r < 0.25) { a.mode = 'sit'; a.timer = rr(6, 12); } else if (r < 0.5) { a.mode = 'eat'; a.timer = rr(3, 6); } else { a.mode = 'idle'; a.timer = rr(2, 6); }
    }
  }
  function stand(a, text) {
    if (!a.actions.Stand) return;
    a.mode = 'stand'; a.timer = 3.4; a.standCool = rr(12, 20);
    play(a, 'Stand', 0.2);
    a.actions.Stand.reset().play();
    if (text) say(text);
  }

  function steer(a, dt) {
    const sp = a.sp;
    a.speed += (a.want - a.speed) * Math.min(1, dt * (a.want > a.speed ? 2.2 : 3.5));
    if (a.speed < 0.02 && a.want === 0) { a.speed = 0; return; }
    let tx = a.tx - a.x, tz = a.tz - a.z;
    const dist = Math.hypot(tx, tz);
    if (dist > 0.05) {
      const want = Math.atan2(tx, tz);
      const turn = (a.mode === 'flee' ? 5 : 2.4) * dt;
      a.yaw += clamp(wrap(want - a.yaw), -turn, turn);
    }
    if (a.mode === 'follow' && dist < 0.3) a.speed = Math.min(a.speed, 0.2);
    // 앞으로 가 보고 막혔으면 옆으로 틀기
    const look = sp.r + 0.6;
    const nx = a.x + Math.sin(a.yaw) * look, nz = a.z + Math.cos(a.yaw) * look;
    if (blocked(nx, nz, a.wild && a.mode !== 'flee' && a.mode !== 'follow')) {
      const l = Math.sin(a.yaw + 0.8), lz = Math.cos(a.yaw + 0.8);
      const leftFree = !blocked(a.x + l * look, a.z + lz * look, false);
      a.yaw += (leftFree ? 1 : -1) * 3.2 * dt;
      a.speed *= 0.9;
      if (a.mode === 'walk' && Math.random() < dt) pickTarget(a);
    }
    const step = a.speed * dt;
    const x2 = a.x + Math.sin(a.yaw) * step, z2 = a.z + Math.cos(a.yaw) * step;
    if (!blocked(x2, z2, false)) { a.x = x2; a.z = z2; }
    else a.speed *= 0.5;
  }

  function animate(a, d, dt) {
    const sp = a.sp, s = a.speed;
    if (a.mode === 'stand') return;
    if (s > 0.05) {
      if (s > (sp.walk + sp.run) * 0.4) play(a, 'Run', 0.2, clamp(s / sp.runRef, 0.7, 2.6));
      else play(a, 'Walk', 0.25, clamp(s / sp.walkRef, 0.6, 2.6));
    } else if (a.mode === 'eat') play(a, 'Eat', 0.4);
    else if (a.mode === 'sit') play(a, 'Sit', 0.5);
    else play(a, 'Idle', 0.35);
  }

  function tumble(a, dt) {
    a.x += a.vx * dt; a.z += a.vz * dt;
    const gy = groundY(a.x, a.z);
    if (a.air) {
      a.vy -= 18 * dt; a.y += a.vy * dt;
      a.roll += a.rollV * dt;
      if (a.y <= gy && a.vy < 0) {
        a.y = gy;
        if (a.vy < -3.5) { a.vy = -a.vy * 0.35; a.vx *= 0.6; a.vz *= 0.6; a.rollV *= 0.6; }   // 통! 한 번 튄다
        else { a.air = false; a.vy = 0; }
      }
    } else {
      a.y = gy;
      const f = Math.max(0, 1 - dt * 4); a.vx *= f; a.vz *= f;
      // 옆으로 누운 자세(±90°)에 가장 가까운 쪽으로 멈춘다
      const tgt = Math.round((a.roll - Math.PI / 2 * a.spin) / (Math.PI * 2)) * Math.PI * 2 + Math.PI / 2 * a.spin;
      a.roll += (tgt - a.roll) * Math.min(1, dt * 8);
      if (Math.hypot(a.vx, a.vz) < 0.4) {
        a.roll = Math.PI / 2 * a.spin; a.mode = 'dizzy'; a.timer = rr(1.6, 2.6);
        play(a, 'Run', 0.2, 2.6);    // 누워서 버둥버둥
        if (!a.stars) { a.stars = makeStars(); }
        a.stars.visible = true;
      }
    }
    // 경계·물 밖으로 나가지 않게
    if (blocked(a.x, a.z, false) && !pondHit(a.x, a.z)) {
      a.x = clamp(a.x, B.minX + 1.6, B.maxX - 1.6); a.z = clamp(a.z, B.minZ + 1.6, B.maxZ - 1.6);
    }
    if (pondHit(a.x, a.z) && !a.air) { a.vx *= -0.5; a.vz *= -0.5; }
    setRoll(a);
  }
  /* 옆으로 누우면 몸 중심을 낮춘다 (안 그러면 공중에 떠서 눕는다) */
  function setRoll(a) {
    a.tumbler.rotation.z = a.roll;
    const k = Math.abs(Math.sin(a.roll)), h = a.sp.h;
    a.tumbler.position.y = h - (h - a.sp.r * 0.8) * k;
    a.model.position.y = -h;
  }

  function separate(dt, P) {
    for (let i = 0; i < animals.length; i++) {
      const a = animals[i];
      if (a.mode === 'tumble') continue;
      // 플레이어를 밀고 지나가지 않게
      const px = a.x - P.x, pz = a.z - P.z, pd = Math.hypot(px, pz), pr = a.sp.r + 0.35;
      if (pd < pr && pd > 1e-4) { a.x += px / pd * (pr - pd); a.z += pz / pd * (pr - pd); }
      for (let j = i + 1; j < animals.length; j++) {
        const b = animals[j];
        if (b.mode === 'tumble') continue;
        const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz, rs = a.sp.r + b.sp.r;
        if (d2 < rs * rs && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (rs - d) * 0.5;
          a.x -= dx / d * push; a.z -= dz / d * push; b.x += dx / d * push; b.z += dz / d * push;
        }
      }
    }
  }

  function finish(a, d, dt) {
    if (a.mode !== 'tumble') a.y += (groundY(a.x, a.z) - a.y) * Math.min(1, dt * 12);
    a.obj.position.set(a.x, a.y, a.z);
    a.obj.rotation.y = a.yaw;
    // 동작 갱신은 거리 따라 아낀다
    const vis = d < FAR_MIX;
    a.obj.visible = vis;
    if (!vis) { a.mixAcc = 0; return; }
    a.mixAcc += dt;
    if (d < NEAR_MIX || a.mixAcc > 0.25) { a.mixer.update(a.mixAcc); a.mixAcc = 0; }
  }

  /* ── 고르기 (레이) ── */
  const _sph = new THREE.Sphere(), _hit = new THREE.Vector3();
  function pick(raycaster) {
    let best = null;
    for (const a of animals) {
      if (!a.obj.visible) continue;
      _sph.center.set(a.x, a.y + a.sp.h, a.z); _sph.radius = a.sp.r + 0.1;
      if (raycaster.ray.intersectSphere(_sph, _hit)) {
        const dist = raycaster.ray.origin.distanceTo(_hit);
        if (!best || dist < best.distance) best = { animal: a, distance: dist, point: _hit.clone() };
      }
    }
    return best;
  }

  function list() {
    return animals.map(a => ({ id: a.id, kind: a.kind, name: a.ko, x: +a.x.toFixed(2), z: +a.z.toFixed(2), mode: a.mode, clip: a.cur }));
  }

  function dispose() {
    disposed = true;
    for (const a of animals) { a.mixer.stopAllAction(); scene.remove(a.obj); }
    for (const o of extra) scene.remove(o);
    animals.length = 0;
    if (debug && globalThis.__animals === api) delete globalThis.__animals;
  }

  const api = { update, list, dispose, hitAt, punchFrom, alarm, pick, ready, animals, SPECIES };
  if (debug) {
    globalThis.__animals = Object.assign(api, {
      near: () => { const P = getPlayerPos(); return list().map(a => ({ ...a, d: +Math.hypot(a.x - P.x, a.z - P.z).toFixed(1) })).sort((p, q) => p.d - q.d); },
      tp: (kind) => { const a = animals.find(x => x.kind === kind); return a ? { x: a.x, z: a.z } : null; },
      hit: (r = 6, f = 9) => hitAt(getPlayerPos(), r, f),
      spawn: (kind, x, z) => {
        if (!api.gltf || !api.gltf[kind]) return null;
        const a = spawn(kind, x, z, { home: { x, z, r: 8 }, wild: false, id: animals.length, gltf: api.gltf[kind], clone: api._clone });
        animals.push(a); return a.id;
      },
    });
  }
  return api;
}
