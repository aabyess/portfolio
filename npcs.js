/* ════════════════════════════════════════════════════════════════════
   npcs.js — 중세 선술집 손님들 (숲길을 거닐다 포장마차 의자에 앉아 술을 마신다)

   ── portfolio.js 연결 방법 (이 세 군데만 손대면 된다) ──

   ① 모듈 상단 (const THREE = await import('three'); 근처, 또는 파일 맨 위 정적 import):
        import { createNPCs, stallsFromStations } from './npcs.js';
      (portfolio.js 가 동적 import 를 쓰므로 이렇게 해도 된다)
        const { createNPCs, stallsFromStations } = await import('./npcs.js');

   ② "선술집 앞 빨간 플라스틱 의자와 둥근 테이블" 블록이 끝난 직후
      (for (const st of stations) { ... place(stool, ...) } } 의 닫는 중괄호 바로 아래):

        // 중세 손님들 — 로딩을 막지 않게 await 하지 않는다
        let npcs = null;
        createNPCs({
          THREE, scene, GLTFLoader,
          dracoLoader: draco,                         // 월드 glb 에서 쓰던 DRACOLoader 재사용
          groundY, pathX,
          stalls: stallsFromStations(stations, { THREE, toyBlocks }),
          bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
          roadHalf: WORLD.path.half,
          bridge: WORLD.bridge,                       // 다리 구간에선 개울에 빠지지 않게 길 안쪽으로 걷는다
          getPlayerPos: () => activePos(),            // update 때만 부른다 (TDZ 걱정 없음)
          getNight: () => night,                      // 밤엔 더 오래, 더 자주 앉는다
        }).then(n => { npcs = n; }).catch(e => console.warn('[npcs]', e));

   ③ step(dt) 안, proximity(); 다음 줄쯤:
        if (npcs) npcs.update(dt, t);

   stallsFromStations 는 위 의자 블록과 똑같은 수치(테이블 지역좌표 (0, 4.6), 의자 반지름 1.75,
   45°+90°k, 그룹 배율 0.62)로 의자 월드 좌표를 다시 계산하고, toyBlocks 를 넘기면 같은 자리의
   의자 메시를 찾아 연결한다 → 차로 의자를 쓰러뜨리면 앉아 있던 손님이 일어나 떠나고,
   R 로 다시 세우면 그 자리에 또 앉는다. (의자 수치를 바꾸면 아래 STOOL_* 상수도 같이 바꿀 것)

   NPC 는 물리 바디가 없다(키네마틱). 차는 그냥 통과하지만, 손님이 플레이어 3 m 안에서는
   멈춰 길 바깥쪽으로 비켜선다.
   모델은 NPC_MODELS(남 6·여 4) 중 실제로 있는 파일만 불러와 1명씩 세운다 (count 로 더 늘릴 수 있음).
   늘 65% 이상이 길 양쪽을 따라 걷고(속도 1.1~1.5 m/s), 나머지가 포장마차에서 마신다.
   ════════════════════════════════════════════════════════════════════ */

/* 10명 (남 6, 여 4). 없는 파일은 경고만 남기고 건너뛴다 */
export const NPC_MODELS = [
  { file: 'models/npc/npc-innkeeper.glb', gender: 'm' },
  { file: 'models/npc/npc-traveler.glb',  gender: 'm' },
  { file: 'models/npc/npc-guard.glb',     gender: 'm' },
  { file: 'models/npc/npc-blacksmith.glb', gender: 'm' },
  { file: 'models/npc/npc-bard.glb',      gender: 'm' },
  { file: 'models/npc/npc-monk.glb',      gender: 'm' },
  { file: 'models/npc/npc-maid.glb',      gender: 'f' },
  { file: 'models/npc/npc-baker.glb',     gender: 'f' },
  { file: 'models/npc/npc-noble.glb',     gender: 'f' },
  { file: 'models/npc/npc-herbalist.glb', gender: 'f' },
];
const DRACO_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/';

/* portfolio.js 의자 블록과 같은 값 */
const STOOL_TABLE_Z = 4.6, STOOL_RING = 1.75, STOOL_H = 0.42, STOOL_BASE_Y = 0.01;

const MODEL_H = 1.8, CHAR_H = 1.95, S = CHAR_H / MODEL_H;
const HIP_SIT = 0.42;            // Sit 포즈 엉덩이 높이 (모델 단위)
const WALK_SPEED = 1.3;          // m/s (Walk 클립 기준 속도; NPC마다 1.1~1.5)
const SEATED_MAX = 0.35;         // 동시에 앉아 있는 비율 상한 → 65% 이상은 늘 걷는다
const TURN_RATE = 4.0;           // rad/s
const FADE = 0.35;               // 크로스페이드
const RING_R = 1.75;             // 테이블 둘레를 도는 반지름 (의자 바깥, 수레 앞)
const TABLE_AVOID_R = 1.9;       // 배회 중 테이블 원 밖으로 밀어내는 반지름
const SIDE_STEP = 0.55;          // 의자 옆으로 다가서는 거리
const FRONT_STEP = 0.22;         // 앉기 직전 의자 앞(테이블 쪽)에 서는 거리
const SIT_TIME = 0.6;            // 앉기/일어서기 보간 시간
const PLAYER_R = 3.0, PLAYER_R_OUT = 3.6;
const CLIP_LEN = { Idle: 3, Walk: 1, Sit: 4, Drink: 3, Cheers: 1.5 };

const ST = { WANDER: 0, PAUSE: 1, TO_SEAT: 2, SIT_DOWN: 3, SEATED: 4, STAND_UP: 5, LEAVE: 6 };

/* ── 스테이션 → stalls 배열 ── */
export function stallsFromStations(stations, { THREE, toyBlocks = null } = {}) {
  const v = new THREE.Vector3();
  const out = [];
  for (const st of stations) {
    const g = st.group;
    g.updateMatrixWorld(true);
    g.localToWorld(v.set(0, 0, STOOL_TABLE_Z));
    const stall = { x: v.x, z: v.z, rotY: g.rotation.y, seats: [] };
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      g.localToWorld(v.set(Math.cos(a) * STOOL_RING, 0, STOOL_TABLE_Z + Math.sin(a) * STOOL_RING));
      const seat = { x: v.x, z: v.z, y: STOOL_BASE_Y, rotY: Math.atan2(stall.x - v.x, stall.z - v.z), mesh: null };
      if (toyBlocks) {
        for (const b of toyBlocks) {
          const h = b.home;
          if (h && Math.abs(h.x - v.x) < 0.05 && Math.abs(h.z - v.z) < 0.05) {
            seat.mesh = b.mesh; seat.y = h.y - STOOL_H / 2; break;
          }
        }
      }
      stall.seats.push(seat);
    }
    out.push(stall);
  }
  return out;
}

/* ── 메인 ── */
export async function createNPCs({
  THREE, scene, GLTFLoader, DRACOLoader = null, dracoLoader = null, dracoPath = DRACO_CDN,
  groundY, pathX, stalls = [], bounds = { minX: -42, maxX: 42, minZ: -84, maxZ: 84 },
  getPlayerPos = null, getNight = null, roadHalf = 2.52, bridge = null,
  count = 0 /* 0 = 불러온 모델 수만큼 1명씩 */, models = NPC_MODELS, seed = 0,
}) {
  const { clone: skeletonClone } = await import('three/addons/utils/SkeletonUtils.js');

  /* Draco 디코더: 넘겨받은 인스턴스 > 넘겨받은 클래스 > 직접 import */
  let draco = dracoLoader, ownDraco = false;
  if (!draco) {
    const DL = DRACOLoader || (await import('three/addons/loaders/DRACOLoader.js')).DRACOLoader;
    draco = new DL(); draco.setDecoderPath(dracoPath); ownDraco = true;
  }
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const sources = (await Promise.all(models.map(m => loader.loadAsync(m.file).then(g => { g.gender = m.gender; g.file = m.file; return g; }).catch(() => {
    console.warn('[npcs] 모델 없음, 건너뜀:', m.file); return null;
  })))).filter(Boolean);
  if (!count) count = sources.length;
  if (ownDraco) draco.dispose();
  if (!sources.length) return { update() {}, dispose() {}, count: 0 };

  /* 간단한 시드 난수 (seed=0 이면 Math.random) */
  let rs = seed >>> 0;
  const rnd = seed ? () => ((rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296) : Math.random;
  const rr = (a, b) => a + (b - a) * rnd();

  /* stalls 정리: seat.rotY 없으면 테이블을 보게, owner 슬롯 추가 */
  for (const s of stalls) {
    s.occupied = 0;
    for (const seat of s.seats) {
      if (seat.rotY === undefined) seat.rotY = Math.atan2(s.x - seat.x, s.z - seat.z);
      if (seat.y === undefined) seat.y = groundY(seat.x, seat.z);
      seat.owner = null;
      seat.stall = s;
      seat.ang = Math.atan2(seat.z - s.z, seat.x - s.x);
      seat.r = Math.hypot(seat.x - s.x, seat.z - s.z);
      seat.hx = seat.mesh ? seat.mesh.position.x : seat.x;
      seat.hz = seat.mesh ? seat.mesh.position.z : seat.z;
    }
  }

  const zMin = bounds.minZ + 4, zMax = bounds.maxZ - 4;
  const sideOff0 = z => (bridge && z > bridge.z0 - 1.5 && z < bridge.z1 + 1.5) ? Math.min(1.7, bridge.halfW - 0.7) : roadHalf + 0.75;
  const sideOff = (z, n) => sideOff0(z) + (n ? n.lane : 0);
  const clampX = x => Math.max(bounds.minX + 1, Math.min(bounds.maxX - 1, x));

  /* ── NPC 생성 ── */
  const npcs = [];
  for (let i = 0; i < count; i++) {
    const src = sources[i % sources.length];
    const root = new THREE.Group();
    root.name = 'NPC_' + i;
    const model = skeletonClone(src.scene);
    model.scale.setScalar(S);
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    root.add(model);
    scene.add(root);
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const clip of src.animations) {
      const name = clip.name.split('|').pop();
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      actions[name] = a;
    }
    const path = [];
    for (let k = 0; k < 10; k++) path.push({ x: 0, z: 0 });
    npcs.push({
      root, mixer, actions, cur: null, curName: '',
      x: 0, z: 0, y: 0, rot: 0,
      gender: src.gender, speed: rr(1.1, 1.5), lane: rr(-0.45, 0.45),
      state: ST.WANDER, timer: 0, side: rnd() < 0.5 ? -1 : 1, dir: rnd() < 0.5 ? -1 : 1,
      legLeft: rr(8, 30), seat: null, lastStall: null, stallCooldown: 0,
      path, pathN: 0, pathI: 0,
      fromX: 0, fromZ: 0, fromY: 0,
      seatedLeft: 0, animTimer: 0, cheerIn: -1,
      yielding: false, yieldT: 0,
      mixAcc: 0, dist: 0,
    });
  }

  /* ── 헬퍼 (update 에서 할당 없이 쓰도록 클로저 밖 스크래치 없이 숫자만 다룬다) ── */
  function play(n, name, fade = FADE) {
    const a = n.actions[name];
    if (!a || n.cur === a) return;
    a.reset();
    a.setEffectiveTimeScale(1);
    a.setEffectiveWeight(1);
    a.fadeIn(fade);
    a.play();
    if (n.cur) n.cur.fadeOut(fade);
    n.cur = a; n.curName = name;
  }
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function turnTo(n, target, dt) {
    const d = wrap(target - n.rot);
    const m = TURN_RATE * dt;
    n.rot += Math.abs(d) <= m ? d : Math.sign(d) * m;
    return Math.abs(d);
  }
  function seatBroken(seat) {
    const m = seat.mesh;
    if (!m) return false;
    const q = m.quaternion;
    const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
    return upY < 0.85 || Math.abs(m.position.x - seat.hx) > 0.3 || Math.abs(m.position.z - seat.hz) > 0.3;
  }
  function releaseSeat(n) {
    if (n.seat) { n.seat.owner = null; n.seat.stall.occupied--; n.seat = null; }
  }
  function reserve(n, seat) {
    seat.owner = n; seat.stall.occupied++; n.seat = seat;
  }
  /* 테이블 둘레 원 위의 점 */
  function ringPt(p, s, ang, r) { p.x = s.x + Math.cos(ang) * r; p.z = s.z + Math.sin(ang) * r; }

  /* 현재 위치 → 테이블 둘레 → 의자 옆 → 의자 앞 */
  function planToSeat(n, seat) {
    const s = seat.stall;
    const tx = -Math.sin(seat.ang), tz = Math.cos(seat.ang);       // 원의 접선
    const myAng = Math.atan2(n.z - s.z, n.x - s.x);
    const sgn = wrap(myAng - seat.ang) >= 0 ? 1 : -1;              // 내가 있는 쪽 옆으로 다가간다
    const sideX = seat.x + tx * SIDE_STEP * sgn, sideZ = seat.z + tz * SIDE_STEP * sgn;
    const sideAng = Math.atan2(sideZ - s.z, sideX - s.x);
    let k = 0;
    const span = wrap(sideAng - myAng);
    const steps = Math.max(1, Math.ceil(Math.abs(span) / 0.8));
    for (let j = 0; j <= steps; j++) ringPt(n.path[k++], s, myAng + span * j / steps, RING_R);
    n.path[k].x = sideX; n.path[k].z = sideZ; k++;
    n.path[k].x = seat.x + Math.cos(seat.ang) * -FRONT_STEP; n.path[k].z = seat.z + Math.sin(seat.ang) * -FRONT_STEP; k++;
    n.pathN = k; n.pathI = 0;
  }
  /* 의자 앞 → 의자 옆 → 둘레를 돌아 길 쪽으로 */
  function planLeave(n, seat) {
    const s = seat.stall;
    const tx = -Math.sin(seat.ang), tz = Math.cos(seat.ang);
    const roadX = pathX(s.z);
    const outAng = Math.atan2(0, roadX - s.x);                      // 길 쪽 방향
    const sgn = wrap(outAng - seat.ang) >= 0 ? 1 : -1;
    const sideX = seat.x + tx * SIDE_STEP * sgn, sideZ = seat.z + tz * SIDE_STEP * sgn;
    const sideAng = Math.atan2(sideZ - s.z, sideX - s.x);
    let k = 0;
    n.path[k].x = sideX; n.path[k].z = sideZ; k++;
    const span = wrap(outAng - sideAng);
    const steps = Math.max(1, Math.ceil(Math.abs(span) / 0.8));
    for (let j = 0; j <= steps; j++) ringPt(n.path[k++], s, sideAng + span * j / steps, RING_R);
    n.pathN = k; n.pathI = 0;
    n.side = Math.sign(s.x - roadX) || 1;                            // 가판대가 있는 쪽 길가로 돌아간다
  }

  function pickSeat(n, night) {
    let best = null, bd = 1e9;
    for (const s of stalls) {
      if (s === n.lastStall && n.stallCooldown > 0) continue;
      const dz = Math.abs(s.z - n.z);
      if (dz > 40) continue;
      for (const seat of s.seats) {
        if (seat.owner || seatBroken(seat)) continue;
        /* 이미 누가 앉은 가판대를 조금 더 좋아한다 (같이 마시려고) */
        const d = Math.hypot(seat.x - n.x, seat.z - n.z) - s.occupied * 6 - night * 4 + rnd() * 6;
        if (d < bd) { bd = d; best = seat; }
      }
    }
    return best;
  }

  function startWanderLeg(n) {
    n.state = ST.WANDER;
    n.legLeft = rr(18, 55);
    if (n.z < zMin + 6) n.dir = 1; else if (n.z > zMax - 6) n.dir = -1;
    else if (rnd() < 0.3) n.dir = -n.dir;
  }

  function beginSitDown(n) {
    n.state = ST.SIT_DOWN; n.timer = 0;
    n.fromX = n.x; n.fromZ = n.z; n.fromY = n.y;
    play(n, 'Sit', 0.45);
  }

  function seatY(seat) { return seat.y + STOOL_H - HIP_SIT * S; }

  function onSeated(n, night) {
    n.state = ST.SEATED;
    n.seatedLeft = rr(14, 30) * (1 + night * 0.6);
    n.animTimer = rr(1.5, 3);
    /* 같은 테이블 손님들과 건배 */
    let others = 0;
    for (const o of npcs) {
      if (o !== n && o.state === ST.SEATED && o.seat && o.seat.stall === n.seat.stall) { o.cheerIn = rr(0.2, 0.9); others++; }
    }
    n.cheerIn = others ? 1.0 : -1;
  }

  function placeAtSeat(n, seat) {
    reserve(n, seat);
    n.x = seat.x; n.z = seat.z; n.y = seatY(seat); n.rot = seat.rotY;
    n.state = ST.SEATED;
    n.seatedLeft = rr(5, 30);
    n.animTimer = rr(0.5, 3);
    n.cheerIn = -1;
    play(n, rnd() < 0.5 ? 'Drink' : 'Sit', 0);
  }

  /* ── 초기 배치: 일부는 앉아서, 나머지는 길가에 흩어서 ── */
  {
    const freeSeats = [];
    for (const s of stalls) for (const seat of s.seats) if (!seatBroken(seat)) freeSeats.push(seat);
    const nSeated = Math.min(freeSeats.length, Math.round(npcs.length * 0.3));
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (i < nSeated) {
        const j = Math.floor(rnd() * freeSeats.length);
        placeAtSeat(n, freeSeats.splice(j, 1)[0]);
      } else {
        n.z = rr(zMin, zMax);
        n.x = clampX(pathX(n.z) + n.side * sideOff(n.z, n));
        n.y = groundY(n.x, n.z);
        n.rot = n.dir > 0 ? 0 : Math.PI;
        if (rnd() < 0.3) { n.state = ST.PAUSE; n.timer = rr(1, 4); play(n, 'Idle', 0); }
        else { startWanderLeg(n); play(n, 'Walk', 0); }
      }
      if (n.cur) n.cur.time = rnd() * (CLIP_LEN[n.curName] || 1);
      n.root.position.set(n.x, n.y, n.z);
      n.root.rotation.y = n.rot;
    }
  }

  /* 걷기 한 걸음: 목표점을 향해 돌고 앞으로 간다. 도착하면 true */
  function walkToward(n, tx, tz, dt, arriveR) {
    const dx = tx - n.x, dz = tz - n.z;
    const d = Math.hypot(dx, dz);
    if (d < arriveR) return true;
    const err = turnTo(n, Math.atan2(dx, dz), dt);
    const k = err > 1.2 ? 0.15 : Math.cos(err * 0.8);   // 크게 돌 땐 제자리에서 돈다
    const step = Math.min(d, n.speed * k * dt);
    n.x += Math.sin(n.rot) * step;
    n.z += Math.cos(n.rot) * step;
    return false;
  }

  /* 테이블 원 밖으로 밀어내기 (배회 중) */
  function pushFromTables(n) {
    for (const s of stalls) {
      const dx = n.x - s.x, dz = n.z - s.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < TABLE_AVOID_R * TABLE_AVOID_R && d2 > 1e-6) {
        const d = Math.sqrt(d2), k = TABLE_AVOID_R / d;
        n.x = s.x + dx * k; n.z = s.z + dz * k;
      }
    }
  }

  const walking = st => st === ST.WANDER || st === ST.TO_SEAT || st === ST.LEAVE;

  /* ── 매 프레임 ── */
  function update(dt, t) {
    if (!(dt > 0)) return;
    const night = getNight ? getNight() : 0;
    const p = getPlayerPos ? getPlayerPos() : null;
    const px = p ? p.x : 1e9, pz = p ? p.z : 1e9;

    /* 앉았거나 앉으러 가는 인원 (동시 착석 상한용) */
    let seatedNow = 0;
    for (let i = 0; i < npcs.length; i++) if (npcs[i].seat) seatedNow++;

    /* 걷는 손님끼리 겹치지 않게 (10명 → 45쌍): 0.75 m 안이면 밀어내고,
       2.5 m 안에서 서로 마주 보고 오면 각자 오른쪽으로 비켜 걷는다 */
    for (let i = 0; i < npcs.length; i++) {
      const a = npcs[i];
      if (!walking(a.state) && a.state !== ST.PAUSE) continue;
      for (let j = i + 1; j < npcs.length; j++) {
        const b = npcs[j];
        if (!walking(b.state) && b.state !== ST.PAUSE) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
        if (d2 < 0.5625 && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (0.75 - d) * 0.5 / d;
          a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push;
        } else if (d2 < 6.25 && a.state === ST.WANDER && b.state === ST.WANDER) {
          const fax = Math.sin(a.rot), faz = Math.cos(a.rot), fbx = Math.sin(b.rot), fbz = Math.cos(b.rot);
          if (fax * fbx + faz * fbz < -0.5 && fax * dx + faz * dz > 0) {   // 마주 보고 다가오는 중
            const k = 0.5 * dt;
            a.x += faz * k; a.z -= fax * k;   // 각자 진행 방향 오른쪽으로
            b.x += fbz * k; b.z -= fbx * k;
          }
        }
      }
    }

    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (n.stallCooldown > 0) n.stallCooldown -= dt;
      const pdx = n.x - px, pdz = n.z - pz;
      n.dist = Math.hypot(pdx, pdz);

      /* ── 플레이어 비켜서기 ── */
      if (walking(n.state) || n.state === ST.PAUSE) {
        if (!n.yielding && n.dist < PLAYER_R) { n.yielding = true; n.yieldT = 0; }
        if (n.yielding) {
          if (n.dist > PLAYER_R_OUT) { n.yieldT += dt; if (n.yieldT > 0.5) n.yielding = false; }
          else n.yieldT = 0;
        }
      } else n.yielding = false;

      if (n.yielding) {
        /* 플레이어를 바라보고 길 바깥쪽으로 옆걸음 */
        turnTo(n, Math.atan2(-pdx, -pdz), dt);
        if (n.dist < PLAYER_R) {
          const inv = 1 / Math.max(n.dist, 0.01);
          let ax = pdx * inv, az = pdz * inv;
          const roadSide = Math.sign(n.x - pathX(n.z)) || n.side;
          if (ax * roadSide < 0) ax = roadSide * Math.max(0.6, Math.abs(az));   // 길 가운데로는 피하지 않는다
          const k = 1.1 * dt * (PLAYER_R - n.dist) / PLAYER_R + 0.6 * dt;
          n.x = clampX(n.x + ax * k); n.z += az * k;
        }
        play(n, 'Idle');
      } else {
        switch (n.state) {
          case ST.WANDER: {
            play(n, 'Walk');
            /* 앞쪽 4 m 길가 지점을 목표로 걷는다 */
            let tz = n.z + n.dir * 4;
            if (tz < zMin || tz > zMax) { n.dir = -n.dir; tz = n.z + n.dir * 4; }
            let tx = clampX(pathX(tz) + n.side * sideOff(tz, n));
            for (const s of stalls) {   // 목표점이 테이블 원 안이면 바깥으로
              const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
              if (d < TABLE_AVOID_R + 0.4 && d > 1e-4) { const k = (TABLE_AVOID_R + 0.4) / d; tx = s.x + dx * k; tz = s.z + dz * k; }
            }
            const before = n.z;
            walkToward(n, tx, tz, dt, 0.05);
            pushFromTables(n);
            n.legLeft -= Math.abs(n.z - before);
            if (n.legLeft <= 0) {
              const wantSit = rnd() < 0.35 + night * 0.3 && seatedNow < Math.max(1, Math.floor(npcs.length * (SEATED_MAX + night * 0.1)));
              const seat = wantSit ? pickSeat(n, night) : null;
              if (seat) { reserve(n, seat); planToSeat(n, seat); n.state = ST.TO_SEAT; }
              else if (rnd() < 0.25) { n.state = ST.PAUSE; n.timer = rr(1.5, 4); }
              else {
                /* 플레이어가 멀면 가끔 길을 건너 반대편으로 */
                if (n.dist > 18 && rnd() < 0.35) n.side = -n.side;
                startWanderLeg(n);
              }
            }
            break;
          }
          case ST.PAUSE: {
            play(n, 'Idle');
            n.timer -= dt;
            if (n.timer <= 0) startWanderLeg(n);
            break;
          }
          case ST.TO_SEAT: {
            play(n, 'Walk');
            if (seatBroken(n.seat)) { releaseSeat(n); startWanderLeg(n); break; }
            const q = n.path[n.pathI];
            const last = n.pathI === n.pathN - 1;
            if (walkToward(n, q.x, q.z, dt, last ? 0.06 : 0.25)) {
              if (last) {
                /* 테이블 쪽을 다 본 뒤 앉는다 */
                if (turnTo(n, n.seat.rotY, dt) < 0.08) beginSitDown(n);
                else play(n, 'Idle');
              } else n.pathI++;
            }
            break;
          }
          case ST.SIT_DOWN: {
            n.timer += dt;
            const k = Math.min(1, n.timer / SIT_TIME), e = k * k * (3 - 2 * k);
            const seat = n.seat;
            n.x = n.fromX + (seat.x - n.fromX) * e;
            n.z = n.fromZ + (seat.z - n.fromZ) * e;
            n.y = n.fromY + (seatY(seat) - n.fromY) * e;
            turnTo(n, seat.rotY, dt);
            if (seatBroken(seat)) { n.state = ST.STAND_UP; n.timer = 0; n.fromX = n.x; n.fromZ = n.z; n.fromY = n.y; play(n, 'Idle'); break; }
            if (k >= 1) onSeated(n, night);
            break;
          }
          case ST.SEATED: {
            const seat = n.seat;
            n.seatedLeft -= dt;
            if (seatBroken(seat)) { n.seatedLeft = 0; n.animTimer = 0; n.cheerIn = -1; }   // 의자가 쓰러지면 바로 일어난다
            if (n.cheerIn >= 0) {
              n.cheerIn -= dt;
              if (n.cheerIn < 0) { play(n, 'Cheers'); n.animTimer = CLIP_LEN.Cheers - FADE * 0.5; }
            }
            n.animTimer -= dt;
            if (n.animTimer <= 0) {
              if (n.seatedLeft <= 0) {
                n.state = ST.STAND_UP; n.timer = 0;
                n.fromX = n.x; n.fromZ = n.z; n.fromY = n.y;
                play(n, 'Idle', 0.45);
                break;
              }
              /* Sit ↔ Drink 번갈아 */
              if (n.curName === 'Drink') { play(n, 'Sit'); n.animTimer = rr(2, 5); }
              else { play(n, 'Drink'); n.animTimer = CLIP_LEN.Drink * (rnd() < 0.3 ? 2 : 1) - 0.05; }
            }
            break;
          }
          case ST.STAND_UP: {
            n.timer += dt;
            const seat = n.seat;
            const k = Math.min(1, n.timer / SIT_TIME), e = k * k * (3 - 2 * k);
            const fx = seat.x - Math.cos(seat.ang) * FRONT_STEP, fz = seat.z - Math.sin(seat.ang) * FRONT_STEP;
            n.x = n.fromX + (fx - n.fromX) * e;
            n.z = n.fromZ + (fz - n.fromZ) * e;
            n.y = n.fromY + (groundY(fx, fz) - n.fromY) * e;
            if (k >= 1) {
              n.lastStall = seat.stall; n.stallCooldown = 25;
              planLeave(n, seat);
              releaseSeat(n);
              n.state = ST.LEAVE;
            }
            break;
          }
          case ST.LEAVE: {
            play(n, 'Walk');
            const q = n.path[n.pathI];
            if (walkToward(n, q.x, q.z, dt, 0.25)) {
              if (++n.pathI >= n.pathN) {
                n.dir = rnd() < 0.5 ? -1 : 1;
                startWanderLeg(n);
              }
            }
            break;
          }
        }
      }

      /* 높이: 앉는 중/앉아 있을 땐 보간값, 아니면 지형 */
      if (n.state !== ST.SIT_DOWN && n.state !== ST.SEATED && n.state !== ST.STAND_UP) {
        n.y += (groundY(n.x, n.z) - n.y) * Math.min(1, dt * 12);
      }
      n.root.position.set(n.x, n.y, n.z);
      n.root.rotation.y = n.rot;

      /* 걷기 애니메이션 속도는 실제 이동과 맞추고, 먼 손님은 애니메이션을 드문드문 갱신 */
      if (n.curName === 'Walk' && n.cur) n.cur.setEffectiveTimeScale(n.speed / WALK_SPEED);
      if (n.dist > 55) {
        n.mixAcc += dt;
        if (n.mixAcc >= 0.15) { n.mixer.update(n.mixAcc); n.mixAcc = 0; }
      } else {
        if (n.mixAcc) { dt += n.mixAcc; n.mixAcc = 0; }
        n.mixer.update(dt);
      }
    }
  }

  function dispose() {
    for (const n of npcs) {
      releaseSeat(n);
      n.mixer.stopAllAction();
      n.mixer.uncacheRoot(n.mixer.getRoot());
      scene.remove(n.root);
    }
    npcs.length = 0;
    /* 클론은 지오메트리·재질을 원본과 공유한다 → 원본에서 한 번만 해제 */
    for (const src of sources) {
      src.scene.traverse(o => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }
      });
    }
  }

    /* 디버그용: 지금 걷는 비율 */
  const walkingRatio = () => npcs.filter(n => walking(n.state) && !n.yielding).length / Math.max(1, npcs.length);
  return { update, dispose, count: npcs.length, npcs, walkingRatio };
}
