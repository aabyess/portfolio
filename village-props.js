/* ════════════════════════════════════════════════════════════
   마을 소품 — 오두막 마을 두 곳, 우물·분수, 풍차, 밭, 울타리, 가로등, 굴뚝 연기 (village-props.js)
   ────────────────────────────────────────────────────────────
   모델: models/props/vp-kit.glb (tools/blender/village_props/build_kit.py, 소품 19종 · 약 27.6k 삼각형 · 1 MB, Draco)
     오두막 4종(cottage_a 초가 하프팀버 · b 돌집 슬레이트 · c 2층 돌+목조 · d 작은 초가 돌집), windmill(+windmill_blades),
     well, fountain, haystack, bales, fence(2.4 m 한 칸), cart, barrels, woodpile, scarecrow, field_wheat, field_veg,
     lamp, signpost, noticeboard. 재질은 이름으로 공유(vp_plaster, vp_thatch …)해서 마을 하나 = 재질 수만큼의 draw call.
   배치:
     마을 A (서쪽, z 9..34)  오두막 4채 + 우물 + 가로등, 수레·통·장작더미·건초
     밭   (동쪽, z 15..35)  밀밭(볏단) + 채소밭(호박·양배추) + 허수아비 + 풍차(날개가 돈다) + 울타리
     마을 B (서쪽, z -46..-66) 오두막 3채 + 분수 광장 + 게시판 + 밀밭, 동쪽에 오두막 1채 + 수레
     길가 가로등 9개(약 18 m 간격, 다리 위는 다리 등불이 있어서 뺀다)
   충돌 피하기: 연못(fishing.js PONDS), 성문(castle.js CASTLE_CLEAR), 다리·시냇물, 선술집 7곳, 장난감 블록, 표지판, 연락처,
     판다 대숲은 기본으로 피한다. PM 이 avoid:[{x,z,r}] 로 더 넘기면(의뢰 게시판 등) 그 자리 소품은 옆으로 비키거나 빠진다.

   ── portfolio.js 연결 방법 (PM용) ──────────────────────────────
   ⓪ 만들기 — 월드 glb 로딩(worldLoader.load) 위, draco 를 만든 바로 뒤. 배치는 동기라 treesToClear 를 바로 쓸 수 있다.
        const { createVillageProps } = await import('./village-props.js');
        const vprops = createVillageProps({
          THREE, scene, GLTFLoader, dracoLoader: draco, groundY, heightAt, pathX, roadHalf: WORLD.path.half,
          CANNON, world, getNight: () => night, seasons,
          avoid: [],   // 예: 의뢰 게시판 { x, z, r: 2.5 }
        });
      (CANNON·world 가 그 아래에서 만들어지면 그 뒤로 옮기거나 CANNON/world 를 빼고 나중에 vprops.addBodies(CANNON, world))
   ① 나무 비우기 — 월드 콜백의 clearTrees(... CASTLE_CLEAR ...) 줄 다음에:
        for (const g of vprops.clearGroups) clearTrees(gltf.scene, g.spots, g.r);   // 반지름별로 묶어 몇 번만 돈다
   ② (선택) 밭·집 안에 풀이 솟지 않게 — 풀 spots 를 만드는 루프에서:
        if (vprops.noGrass(x, z)) continue;      // 또는 풀을 만든 뒤 vprops.trimGrass(grass)
   ③ step(dt) 안 (castle.update 근처):  vprops.update(dt, t);
   ④ 걷기·운전 충돌 — castle.pushOut 줄 옆에:
        walk():  if (vprops.pushOut(person.position, 0.35)) pSpeed *= 0.5;
        drive(): if (vprops.pushOut(car.position, 1.4)) speed *= 0.5;
      NPC·동물 길찾기에는 vprops.blocks(x, z, r) 를 쓸 수 있다.
   콘솔(?test): __vprops.stats, __vprops.items, __vprops.go('A'|'F'|'B') — 운전 중이면 그 마을로 순간이동

   ── 반환 API ──
     group, ready(Promise), items([{kind, x, z, rot, y}]), skipped, treesToClear([{x,z,r}]), clearGroups([{r, spots:[[x,z]]}])
     update(dt, t), pushOut(pos, r) → 밀어냈으면 true, blocks(x, z, r = 0), noGrass(x, z), trimGrass(instancedMesh)
     colliders([{x, z, rot, hx, hz, h} | {x, z, r, h}]), addBodies(CANNON, world), stats, dispose()
   ════════════════════════════════════════════════════════════ */
import { PONDS } from './fishing.js';
import { CASTLE_CLEAR } from './castle.js';

const AMP = 3.08, K = 0.04285714285714286;
const px0 = z => AMP * Math.sin(-K * z);

/* 선술집 7곳 (models/autumn-world.json stalls + AI 가판대) · 출발점 주변 · 판다 대숲 */
const STALLS = [[-9.89, 44.8], [4.13, 28.0], [-7.37, 2.8], [8.42, -11.2], [-4.92, -56.0], [7.07, -72.8], [4.2, 42]];
const START_Z = 67.2;
function defaultAvoid() {
  const a = [];
  for (const [x, z] of STALLS) a.push({ x, z, r: 5.2, why: 'stall' });
  for (const p of PONDS) a.push({ x: p.x, z: p.z, r: p.r + 2.4, why: 'pond' });
  for (const [x, z] of CASTLE_CLEAR.spots) a.push({ x, z, r: 6.5, why: 'castle' });
  const nameZ = START_Z - 12;
  a.push({ x: px0(nameZ) + 15, z: nameZ + 1.2, r: 7, why: 'toy blocks' });
  a.push({ x: px0(START_Z - 6) - 3.6, z: START_Z - 6, r: 2.6, why: 'kingdom sign' });
  for (let i = 0; i < 3; i++) { const z = START_Z - 0.5 - i * 4.6; a.push({ x: px0(z) + 6.6 + i * 0.6, z, r: 2.6, why: 'contact' }); }
  a.push({ x: px0(START_Z), z: START_Z, r: 4, why: 'start' });
  a.push({ x: -25, z: 33, r: 5, why: 'bamboo' });
  return a;
}

/* 소품별 발자국 (glTF 로컬: x 폭, z 깊이, +z = 앞)
   box: [cx, cz, hx, hz] 충돌 상자 · r: 원 · h: 물리 높이 · clear: 나무 비우는 반지름 · base: 'max'(집: 발자국 중 가장 높은 땅) | 'center' */
const FOOT = {
  cottage_a: { box: [0.25, 0, 3.85, 2.55], h: 4.5, clear: 7.0, base: 'max', grass: true },
  cottage_b: { box: [0.8, 0, 4.0, 2.45], h: 3.8, clear: 6.8, base: 'max', grass: true },
  cottage_c: { box: [0, 0, 3.05, 2.5], h: 6.5, clear: 6.5, base: 'max', grass: true },
  cottage_d: { box: [0, 0, 2.75, 2.25], h: 3.8, clear: 5.8, base: 'max', grass: true },
  windmill: { r: 2.8, h: 11, clear: 8.5, base: 'max', grass: true },
  well: { r: 1.2, h: 1.0, clear: 3.0, base: 'max' },
  fountain: { r: 2.4, h: 0.8, clear: 4.5, base: 'max', grass: true },
  haystack: { r: 1.5, h: 2.4, clear: 2.8 },
  bales: { box: [0.4, 0, 1.05, 0.65], h: 0.9, clear: 2.4 },
  cart: { box: [0, 0.7, 0.95, 1.9], h: 1.1, clear: 3.0 },
  barrels: { box: [0, -0.3, 1.25, 0.95], h: 1.5, clear: 2.4 },
  woodpile: { box: [0, 0.5, 1.3, 0.85], h: 1.0, clear: 2.6 },
  scarecrow: { r: 0.25, h: 2.4, clear: 1.5 },
  field_wheat: { rect: [5.0, 3.5], clear: 7.5, conform: true, grass: true },
  field_veg: { rect: [4.5, 3.0], clear: 6.8, conform: true, grass: true },
  lamp: { r: 0.25, h: 3.3, clear: 1.6, base: 'center' },
  signpost: { r: 0.22, h: 2.6, clear: 1.6 },
  noticeboard: { box: [0, 0, 1.0, 0.25], h: 2.4, clear: 2.0 },
};

/* 배치표. face: [x, z] 를 바라봄 · road: 길을 바라봄 · rot: 직접(라디안, +z 가 앞) */
const LAYOUT = [
  // ── 마을 A (서쪽) ──
  { kind: 'cottage_a', x: -14.5, z: 33.5, road: true, jit: 0.1, hamlet: 'A' },
  { kind: 'cottage_c', x: -13.0, z: 21.0, road: true, jit: -0.06, hamlet: 'A' },
  { kind: 'cottage_b', x: -24.5, z: 24.0, face: [-15, 25], hamlet: 'A' },
  { kind: 'cottage_d', x: -21.5, z: 13.5, face: [-15, 19.5], hamlet: 'A' },
  { kind: 'well', x: -18.0, z: 28.0, rot: 0.4, hamlet: 'A' },
  { kind: 'lamp', x: -15.4, z: 26.6, face: [-18, 28], hamlet: 'A', light: true },
  { kind: 'barrels', x: -10.8, z: 27.6, road: true, hamlet: 'A' },
  { kind: 'woodpile', x: -28.6, z: 22.0, rot: Math.PI / 2, hamlet: 'A' },
  { kind: 'haystack', x: -28.0, z: 15.0, hamlet: 'A' },
  { kind: 'bales', x: -25.5, z: 9.0, rot: 0.5, hamlet: 'A' },
  { kind: 'cart', x: -9.4, z: 14.6, face: [-6, 20], hamlet: 'A' },
  { kind: 'signpost', x: -6.7, z: 10.0, road: true, hamlet: 'A' },
  // ── 밭 (동쪽) ──
  { kind: 'field_wheat', x: 17.0, z: 20.5, rot: 0.08, hamlet: 'F', fence: ['s', 'e', 'w*'] },
  { kind: 'field_veg', x: 16.5, z: 31.5, rot: -0.05, hamlet: 'F', fence: ['w*', 'n'] },
  { kind: 'windmill', x: 26.0, z: 26.5, road: true, jit: 0.25, hamlet: 'F' },
  { kind: 'scarecrow', x: 18.9, z: 20.6, road: true, jit: 0.3, hamlet: 'F' },
  { kind: 'haystack', x: 23.0, z: 14.8, hamlet: 'F' },
  { kind: 'bales', x: 23.6, z: 33.6, rot: -0.4, hamlet: 'F' },
  { kind: 'cart', x: 21.6, z: 25.4, face: [14, 26.5], hamlet: 'F' },
  // ── 마을 B (서쪽) ──
  { kind: 'cottage_b', x: -13.5, z: -49.0, road: true, jit: 0.05, hamlet: 'B' },
  { kind: 'cottage_a', x: -15.0, z: -61.5, road: true, jit: -0.08, hamlet: 'B' },
  { kind: 'cottage_d', x: -24.0, z: -55.0, face: [-12, -55], hamlet: 'B' },
  { kind: 'fountain', x: -12.6, z: -55.3, rot: 0, hamlet: 'B' },
  { kind: 'lamp', x: -10.0, z: -52.4, face: [-12.6, -55.3], hamlet: 'B', light: true },
  { kind: 'noticeboard', x: -17.6, z: -55.2, face: [-12.6, -55.3], hamlet: 'B' },
  { kind: 'woodpile', x: -27.6, z: -51.0, rot: Math.PI / 2, hamlet: 'B' },
  { kind: 'barrels', x: -10.6, z: -64.0, road: true, hamlet: 'B' },
  { kind: 'haystack', x: -25.5, z: -63.0, hamlet: 'B' },
  { kind: 'bales', x: -20.5, z: -66.2, rot: 0.9, hamlet: 'B' },
  { kind: 'field_wheat', x: -24.5, z: -46.4, rot: 0.04, hamlet: 'B', fence: ['n', 'w'] },
  // ── 마을 B (동쪽) ──
  { kind: 'cottage_c', x: 12.5, z: -61.5, road: true, jit: 0.06, hamlet: 'B' },
  { kind: 'cart', x: 9.4, z: -56.2, road: true, jit: 0.7, hamlet: 'B' },
  { kind: 'barrels', x: 9.2, z: -66.6, road: true, hamlet: 'B' },
  { kind: 'woodpile', x: 16.9, z: -64.6, rot: -Math.PI / 2, hamlet: 'B' },
  { kind: 'signpost', x: 6.7, z: -47.8, road: true, hamlet: 'B' },
];
const ROAD_LAMPS = [72, 54, 36, 18, 0, -18, -54, -72];   // 다리(z -46..-27) 구간은 다리 등불이 있다

export function createVillageProps({
  THREE, scene, GLTFLoader, dracoLoader = null, groundY = () => 0, heightAt = null, pathX = null, roadHalf = 2.52,
  CANNON = null, world = null, getNight = () => 0, seasons = null, avoid = [], camera = null,
  url = 'models/props/vp-kit.glb', lights = 2,
} = {}) {
  const PX = pathX || px0;
  const H = (x, z) => (heightAt ? heightAt(x, z) : groundY(x, z));
  const group = new THREE.Group(); group.name = 'village_props';
  scene.add(group);
  const AV = [...defaultAvoid(), ...avoid.map(a => ({ ...a, why: a.why || 'pm' }))];

  /* ── 배치 (동기) ── */
  const footR = f => f.r ?? (f.box ? Math.hypot(f.box[2], f.box[3]) * 0.8 : Math.hypot(...f.rect) * 0.9);
  const inBridgeOrStream = (x, z, r) => (z > -46 - r && z < -27 + r && Math.abs(x - PX(z)) < 7 + r) || (z > -41 - r * 0.5 && z < -31.5 + r * 0.5);
  const roadClear = (x, z, r) => { for (let dz = -r; dz <= r; dz += Math.max(0.5, r / 3)) if (Math.abs(x - PX(z + dz)) < roadHalf + 0.6 + r * 0.75) return false; return true; };
  const hit = (x, z, r) => AV.find(a => Math.hypot(x - a.x, z - a.z) < a.r + r);
  const items = [], skipped = [];
  const taken = [];   // 이미 놓인 소품끼리도 겹치지 않게
  function place(spec) {
    const f = FOOT[spec.kind]; const r = footR(f);
    let { x, z } = spec;
    for (let tries = 0; tries < 4; tries++) {
      const a = hit(x, z, r);
      if (!a) break;
      const d = Math.hypot(x - a.x, z - a.z) || 1, push = a.r + r - d + 0.4;
      x += (x - a.x) / d * push; z += (z - a.z) / d * push;
    }
    let rot = spec.rot ?? 0;
    if (spec.road) { const rx = PX(z); rot = Math.atan2(rx - x, 0); }
    if (spec.face) rot = Math.atan2(spec.face[0] - x, spec.face[1] - z);
    rot += spec.jit || 0;
    const it = { ...spec, x, z, rot, r, f };
    const lamp = spec.kind === 'lamp' && spec.roadLamp;
    if (hit(x, z, r) || inBridgeOrStream(x, z, r) || (!lamp && !roadClear(x, z, r)) || Math.abs(x) > 40 || Math.abs(z) > 82 ||
        taken.some(t => (f.rect && !t.f.rect) ? overlaps(it, t.x, t.z, t.r * 0.9) : overlaps(t, x, z, r))) {
      skipped.push({ kind: spec.kind, x: spec.x, z: spec.z, why: hit(x, z, r)?.why || 'space' }); return null;
    }
    it.y = baseY(it);
    items.push(it); taken.push(it);
    return it;
  }
  function overlaps(t, x, z, r) {
    if (t.f.rect) {   // 밭은 직사각형으로 본다. 허수아비처럼 아주 작은 건 밭 안에 둘 수 있다
      if (r < 0.5) return false;
      const dx = x - t.x, dz = z - t.z, c = Math.cos(t.rot), s = Math.sin(t.rot);
      return Math.abs(c * dx - s * dz) < t.f.rect[0] + r - 0.3 && Math.abs(s * dx + c * dz) < t.f.rect[1] + r - 0.3;
    }
    return Math.hypot(x - t.x, z - t.z) < t.r * 0.9 + r - 0.3;
  }
  function footPts(it, grow = 0) {
    const f = it.f, c = Math.cos(it.rot), s = Math.sin(it.rot);
    const W = (lx, lz) => [it.x + c * lx + s * lz, it.z - s * lx + c * lz];
    if (f.box) { const [cx, cz, hx, hz] = f.box; return [W(cx, cz), W(cx - hx - grow, cz - hz - grow), W(cx + hx + grow, cz - hz - grow), W(cx + hx + grow, cz + hz + grow), W(cx - hx - grow, cz + hz + grow)]; }
    if (f.rect) { const [hx, hz] = f.rect; return [W(0, 0), W(-hx, -hz), W(hx, -hz), W(hx, hz), W(-hx, hz)]; }
    const R = (f.r || 0.3) + grow; return [[it.x, it.z], [it.x + R, it.z], [it.x - R, it.z], [it.x, it.z + R], [it.x, it.z - R]];
  }
  function baseY(it) {
    const pts = footPts(it);
    if (it.f.base === 'max') return Math.max(...pts.map(([x, z]) => H(x, z))) - 0.06;
    if (it.f.base === 'center' || it.f.conform) return H(it.x, it.z);
    return Math.min(...pts.map(([x, z]) => H(x, z))) + 0.02;
  }
  for (const s of LAYOUT) place(s);
  ROAD_LAMPS.forEach((z, i) => {
    const pref = i % 2 ? -1 : 1;
    for (const side of [pref, -pref]) {
      const x = PX(z) + side * (roadHalf + 1.1), n = skipped.length;
      if (place({ kind: 'lamp', x, z, rot: side > 0 ? -Math.PI / 2 : Math.PI / 2, roadLamp: true, hamlet: 'R', light: false })) break;
      if (side === pref) skipped.length = n;   // 반대쪽에 놓을 수 있으면 첫 시도 실패는 기록하지 않는다
    }
  });

  /* 울타리: 밭 가장자리 (s/n/e/w, '*' 는 가운데 문 틈) */
  const fences = [];
  for (const it of items) {
    if (!it.fence) continue;
    const [hx, hz] = it.f.rect.map(v => v + 0.6), c = Math.cos(it.rot), s = Math.sin(it.rot);
    const W = (lx, lz) => [it.x + c * lx + s * lz, it.z - s * lx + c * lz];
    const sides = { s: [[-hx, hz], [hx, hz]], n: [[hx, -hz], [-hx, -hz]], e: [[hx, hz], [hx, -hz]], w: [[-hx, -hz], [-hx, hz]] };
    for (const code of it.fence) {
      const [a, b] = sides[code[0]], gap = code.includes('*');
      const A = W(...a), B = W(...b);
      if (!gap) fences.push([A, B]);
      else {
        const m1 = 0.5 - 1.3 / Math.hypot(B[0] - A[0], B[1] - A[1]), m2 = 1 - m1;
        const L = t => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
        fences.push([A, L(m1)], [L(m2), B]);
      }
    }
  }
  const fenceSegs = [];
  for (const [A, B] of fences) {
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.max(1, Math.round(len / 2.4)), sx = len / (n * 2.4);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const x0 = A[0] + (B[0] - A[0]) * t0, z0 = A[1] + (B[1] - A[1]) * t0, x1 = A[0] + (B[0] - A[0]) * t1, z1 = A[1] + (B[1] - A[1]) * t1;
      const y0 = H(x0, z0), y1 = H(x1, z1);
      fenceSegs.push({ x0, z0, y0, rotY: Math.atan2(-(z1 - z0), x1 - x0), pitch: Math.atan2(y1 - y0, len / n), sx });
    }
  }

  /* 충돌체 · 나무 비우기 · 풀 막기 */
  const colliders = [];
  for (const it of items) {
    const f = it.f;
    if (f.box) {
      const [cx, cz, hx, hz] = f.box, c = Math.cos(it.rot), s = Math.sin(it.rot);
      colliders.push({ kind: it.kind, x: it.x + c * cx + s * cz, z: it.z - s * cx + c * cz, rot: it.rot, hx, hz, y: it.y, h: f.h });
    } else if (f.r) colliders.push({ kind: it.kind, x: it.x, z: it.z, r: f.r, y: it.y, h: f.h });
  }
  const treesToClear = items.map(it => ({ x: +it.x.toFixed(2), z: +it.z.toFixed(2), r: it.f.clear }));
  for (const it of items) if (it.f.rect) {   // 밭은 넓어서 모서리도 비운다
    for (const [x, z] of footPts(it).slice(1)) treesToClear.push({ x: +x.toFixed(2), z: +z.toFixed(2), r: 3.5 });
  }
  const clearGroups = [];
  for (const t of treesToClear) {
    const r = Math.round(t.r * 2) / 2; let g = clearGroups.find(g => g.r === r);
    if (!g) clearGroups.push(g = { r, spots: [] });
    g.spots.push([t.x, t.z]);
  }
  const grassZones = items.filter(it => it.f.grass).map(it => {
    const f = it.f; const [cx, cz, hx, hz] = f.box ? f.box : f.rect ? [0, 0, f.rect[0] + 0.3, f.rect[1] + 0.3] : [0, 0, f.r + 0.3, f.r + 0.3];
    return { x: it.x, z: it.z, rot: it.rot, cx, cz, hx: hx + (f.box ? 0.3 : 0), hz: hz + (f.box ? 0.3 : 0) };
  });
  function noGrass(x, z) {
    for (const g of grassZones) {
      const dx = x - g.x, dz = z - g.z; if (dx * dx + dz * dz > 120) continue;
      const c = Math.cos(g.rot), s = Math.sin(g.rot), lx = c * dx - s * dz - g.cx, lz = s * dx + c * dz - g.cz;
      if (Math.abs(lx) < g.hx && Math.abs(lz) < g.hz) return true;
    }
    return false;
  }
  function trimGrass(mesh) {
    if (!mesh?.isInstancedMesh) return 0;
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0); let n = 0;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m4); p.setFromMatrixPosition(m4);
      if (noGrass(p.x, p.z)) { mesh.setMatrixAt(i, zero); n++; }
    }
    mesh.instanceMatrix.needsUpdate = true;
    return n;
  }

  /* ── 충돌 ── */
  function local(c, x, z) { const dx = x - c.x, dz = z - c.z, co = Math.cos(c.rot), s = Math.sin(c.rot); return [co * dx - s * dz, s * dx + co * dz]; }
  function blocks(x, z, r = 0) {
    for (const c of colliders) {
      if (c.r != null) { if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true; continue; }
      const [lx, lz] = local(c, x, z);
      if (Math.abs(lx) < c.hx + r && Math.abs(lz) < c.hz + r) return true;
    }
    return false;
  }
  function pushOut(pos, r) {
    let pushed = false;
    for (const c of colliders) {
      const dx0 = pos.x - c.x, dz0 = pos.z - c.z;
      if (dx0 * dx0 + dz0 * dz0 > 60) continue;
      if (c.r != null) {
        const d = Math.hypot(dx0, dz0), R = c.r + r;
        if (d < R) { const k = d > 1e-4 ? (R - d) / d : 0; pos.x += dx0 * k + (d > 1e-4 ? 0 : R); pos.z += dz0 * k; pushed = true; }
        continue;
      }
      const [lx, lz] = local(c, pos.x, pos.z);
      const qx = Math.max(-c.hx, Math.min(c.hx, lx)), qz = Math.max(-c.hz, Math.min(c.hz, lz));
      let ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz), nx, nz;
      if (d > 1e-5) { if (d >= r) continue; nx = ox / d * (r - d); nz = oz / d * (r - d); }
      else {   // 상자 안: 가장 가까운 면으로
        const ex = c.hx - Math.abs(lx), ez = c.hz - Math.abs(lz);
        if (ex < ez) { nx = Math.sign(lx || 1) * (ex + r); nz = 0; } else { nx = 0; nz = Math.sign(lz || 1) * (ez + r); }
      }
      const co = Math.cos(c.rot), s = Math.sin(c.rot);
      pos.x += co * nx + s * nz; pos.z += -s * nx + co * nz; pushed = true;
    }
    return pushed;
  }
  const bodies = [];
  function addBodies(CN, W) {
    if (!CN || !W || bodies.length) return;
    for (const c of colliders) {
      if (c.h < 0.5) continue;
      const shape = c.r != null ? new CN.Cylinder(c.r, c.r, c.h, 10) : new CN.Box(new CN.Vec3(c.hx, c.h / 2, c.hz));
      const b = new CN.Body({ mass: 0, type: CN.Body.STATIC, shape });
      b.position.set(c.x, c.y + c.h / 2, c.z);
      if (c.rot) b.quaternion.setFromAxisAngle(new CN.Vec3(0, 1, 0), c.rot);
      W.addBody(b); bodies.push(b);
    }
  }
  addBodies(CANNON, world);

  /* ── 모델 로딩 · 합치기 ── */
  const glowMats = [], disposables = [], blades = [];
  let smoke = null, smokeMat = null;
  const pLights = [];
  const stats = { items: items.length, skipped: skipped.length, fences: fenceSegs.length, meshes: 0, drawCalls: 0, tris: 0, loaded: false };
  const loader = new GLTFLoader();
  if (dracoLoader) loader.setDRACOLoader(dracoLoader);
  let disposed = false;
  const ready = new Promise(resolve => {
    loader.load(url, async gltf => {
      if (disposed) return resolve(null);
      try {
        const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
        build(gltf, mergeGeometries);
      } catch (e) { console.warn('[village-props] build failed', e); }
      resolve(api);
    }, undefined, err => { console.warn('[village-props] load failed', err); resolve(null); });
  });

  function build(gltf, mergeGeometries) {
    const root = gltf.scene; root.updateMatrixWorld(true);
    const mats = new Map();
    const shareMat = m => {
      if (!mats.has(m.name)) {
        mats.set(m.name, m);
        if (m.map) m.map.anisotropy = 4;
        if (m.name === 'vp_glow') {
          m.color.setRGB(0.22, 0.16, 0.10); m.emissive.setRGB(1.0, 0.6, 0.26); m.emissiveIntensity = 0.4; m.toneMapped = true;
          glowMats.push(m);
        } else if (m.name === 'vp_water') {
          m.transparent = true; m.opacity = 0.82; m.color.setRGB(0.16, 0.30, 0.34); m.roughness = 0.05; m.metalness = 0.1;
        } else if (seasons?.addSnow) {
          const roof = /thatch|shingle|slate/.test(m.name);
          try { seasons.addSnow(m, roof ? 'roof' : 'prop', roof ? 0.12 : 0); } catch (e) { /* 눈 셰이더는 선택 */ }
        }
      }
      return mats.get(m.name);
    };
    /* 소품별 부품: { geo, mat, rel } (뿌리 기준), 날개·연기·불빛 자리 */
    const kits = {};
    const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
    for (const node of root.children) {
      if (!node.name.startsWith('vp_')) continue;
      const kind = node.name.slice(3);
      const kit = kits[kind] = { parts: [], blades: null, smoke: [], light: [] };
      inv.copy(node.matrixWorld).invert();
      node.traverse(o => {
        let p = o, inBlade = null;
        while (p && p !== node) { if (p.name === 'windmill_blades') inBlade = p; p = p.parent; }
        if (o.name.startsWith('smoke') || o.name.startsWith('light')) {
          const v = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(inv);
          kit[o.name.startsWith('smoke') ? 'smoke' : 'light'].push(v);
        }
        if (!o.isMesh) return;
        if (inBlade) {
          kit.blades ||= { rel: new THREE.Matrix4().multiplyMatrices(inv, inBlade.matrixWorld), parts: [] };
          const bi = new THREE.Matrix4().copy(inBlade.matrixWorld).invert();
          kit.blades.parts.push({ geo: o.geometry, mat: shareMat(o.material), rel: new THREE.Matrix4().multiplyMatrices(bi, o.matrixWorld) });
          return;
        }
        rel.multiplyMatrices(inv, o.matrixWorld);
        kit.parts.push({ geo: o.geometry, mat: shareMat(o.material), rel: rel.clone() });
      });
    }

    const itemMat = it => new THREE.Matrix4().compose(new THREE.Vector3(it.x, it.y, it.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot), new THREE.Vector3(1, 1, 1));
    const clean = (g, conformIt) => {
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.index) { const n = g.attributes.position.count, idx = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
      if (conformIt) {   // 밭: 꼭짓점마다 땅 높이를 따라간다
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + H(p.getX(i), p.getZ(i)) - conformIt.y);
      }
      return g;
    };

    /* 1) 정적 소품: 마을(hamlet)별 · 재질별로 한 메시로 합친다 (가로등은 아래 instancing) */
    const buckets = new Map();
    const m4 = new THREE.Matrix4();
    for (const it of items) {
      const kit = kits[it.kind]; if (!kit) continue;
      const M = itemMat(it);
      if (it.kind !== 'lamp') for (const part of kit.parts) {
        const g = part.geo.clone(); m4.multiplyMatrices(M, part.rel); g.applyMatrix4(m4);
        const key = it.hamlet + '|' + part.mat.name;
        if (!buckets.has(key)) buckets.set(key, { mat: part.mat, geos: [] });
        buckets.get(key).geos.push(clean(g, it.f.conform ? it : null));
      }
      /* 굴뚝 연기 · 문 등불 위치 */
      for (const v of kit.smoke) it.smokeAt = [...(it.smokeAt || []), v.clone().applyMatrix4(M)];
      for (const v of kit.light) it.lightAt = [...(it.lightAt || []), v.clone().applyMatrix4(M)];
      /* 풍차 날개 */
      if (kit.blades) {
        const pivot = new THREE.Group(); pivot.name = 'windmill_blades';
        new THREE.Matrix4().multiplyMatrices(M, kit.blades.rel).decompose(pivot.position, pivot.quaternion, pivot.scale);
        for (const part of kit.blades.parts) {
          const mesh = new THREE.Mesh(part.geo, part.mat);
          part.rel.decompose(mesh.position, mesh.quaternion, mesh.scale);
          mesh.castShadow = true; mesh.receiveShadow = true;
          pivot.add(mesh);
        }
        pivot.rotation.z = Math.random() * 6;
        pivot.userData.spin = pivot.quaternion.clone();
        group.add(pivot); blades.push(pivot);
      }
    }
    for (const [key, b] of buckets) {
      const merged = mergeGeometries(b.geos, false);
      b.geos.forEach(g => g.dispose());
      if (!merged) { console.warn('[village-props] merge failed', key); continue; }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.name = 'vp_' + key.replace('|', '_');
      const glowy = b.mat.name === 'vp_glow' || b.mat.name === 'vp_water';
      mesh.castShadow = !glowy; mesh.receiveShadow = !glowy || b.mat.name === 'vp_water';
      group.add(mesh); disposables.push(merged);
    }

    /* 2) 가로등 · 울타리: InstancedMesh */
    const lamps = items.filter(it => it.kind === 'lamp');
    const instance = (kit, mats4, name) => {
      if (!kit || !mats4.length) return;
      for (const part of kit.parts) {
        const im = new THREE.InstancedMesh(part.geo, part.mat, mats4.length);
        mats4.forEach((M, i) => im.setMatrixAt(i, m4.multiplyMatrices(M, part.rel)));
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere?.();
        im.name = name; im.castShadow = part.mat.name !== 'vp_glow'; im.receiveShadow = true;
        group.add(im);
      }
    };
    instance(kits.lamp, lamps.map(itemMat), 'vp_lamps');
    const up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(0, 0, 1);
    instance(kits.fence, fenceSegs.map(s => {
      const q = new THREE.Quaternion().setFromAxisAngle(up, s.rotY).multiply(new THREE.Quaternion().setFromAxisAngle(fwd, s.pitch));
      return new THREE.Matrix4().compose(new THREE.Vector3(s.x0, s.y0, s.z0), q, new THREE.Vector3(s.sx, 1, 1));
    }), 'vp_fences');

    /* 3) 굴뚝 연기 — 셰이더에서 움직이는 점 스프라이트 (CPU 일 없음) */
    const chim = items.flatMap(it => it.smokeAt || []);
    if (chim.length) {
      const PER = 16, n = chim.length * PER;
      const pos = new Float32Array(n * 3), seed = new Float32Array(n), rnd = new Float32Array(n * 3);
      chim.forEach((c, ci) => { for (let k = 0; k < PER; k++) { const i = ci * PER + k; pos.set([c.x, c.y, c.z], i * 3); seed[i] = k / PER + Math.random() * 0.03; rnd.set([Math.random(), Math.random(), Math.random()], i * 3); } });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 3));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 400);
      smokeMat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
          uTime: { value: 0 }, uScale: { value: 800 }, uWind: { value: new THREE.Vector2(0.55, -0.25) },
          uColor: { value: new THREE.Color(0.78, 0.75, 0.72) }, uAlpha: { value: 0.5 },
        }]),
        vertexShader: `uniform float uTime; uniform float uScale; uniform vec2 uWind; attribute float aSeed; attribute vec3 aRnd; varying float vA; varying float vShade;
          #include <fog_pars_vertex>
          void main() {
            float t = fract(uTime / 7.5 + aSeed);
            vec3 p = position;
            p.y += t * 5.8;
            p.xz += uWind * t * t * 5.0 + (aRnd.xz - 0.5) * (0.15 + t * 1.8);
            p.x += sin(uTime * 0.6 + aSeed * 23.0) * 0.3 * t;
            vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = mix(0.45, 2.8, t) * (0.8 + aRnd.y * 0.4) * uScale / max(0.5, -mvPosition.z);
            vA = smoothstep(0.0, 0.1, t) * (1.0 - t);
            vShade = 0.85 + aRnd.z * 0.25;
            #include <fog_vertex>
          }`,
        fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying float vA; varying float vShade;
          #include <fog_pars_fragment>
          void main() {
            vec2 c = gl_PointCoord - 0.5; float d = length(c);
            if (d > 0.5) discard;
            float a = smoothstep(0.5, 0.05, d) * vA * uAlpha;
            gl_FragColor = vec4(uColor * vShade, a);
            #include <fog_fragment>
          }`,
        transparent: true, depthWrite: false, fog: true,
      });
      smoke = new THREE.Points(g, smokeMat); smoke.name = 'vp_chimney_smoke'; smoke.frustumCulled = false; smoke.renderOrder = 2;
      group.add(smoke); disposables.push(g);
    }

    /* 4) 진짜 불빛은 최대 2개 (마을 광장 등불). 낮에는 세기 0 — 개수를 바꾸면 셰이더를 다시 짜므로 켜고 끄지 않는다 */
    for (const it of items.filter(i => i.light).slice(0, lights)) {
      const at = (it.lightAt && it.lightAt[0]) || new THREE.Vector3(it.x, it.y + 2.6, it.z);
      const L = new THREE.PointLight(0xffa850, 0, 16, 1.6);
      L.position.copy(at).add(new THREE.Vector3(0, -0.15, 0));
      group.add(L); pLights.push(L);
    }

    group.traverse(o => {
      if (o.isMesh || o.isPoints) { stats.drawCalls++; stats.meshes++; }
      if (o.isMesh) {
        const idx = o.geometry.index, n = idx ? idx.count / 3 : o.geometry.attributes.position.count / 3;
        stats.tris += Math.round(n * (o.isInstancedMesh ? o.count : 1));
      }
    });
    stats.loaded = true;
    applyNight(getNight());
  }

  /* ── 매 프레임 ── */
  let lastNight = -1;
  function applyNight(k) {
    for (const m of glowMats) m.emissiveIntensity = 0.35 + 3.4 * k;
    for (const L of pLights) L.intensity = 14 * k;
    if (smokeMat) {
      smokeMat.uniforms.uColor.value.setRGB(0.78 - 0.5 * k, 0.75 - 0.48 * k, 0.72 - 0.42 * k);
      smokeMat.uniforms.uAlpha.value = 0.5 - 0.2 * k;
    }
  }
  function update(dt, t) {
    const k = Math.max(0, Math.min(1, getNight() || 0));
    if (Math.abs(k - lastNight) > 0.01) { applyNight(k); lastNight = k; }
    for (const b of blades) b.rotateZ(dt * 0.55);
    if (smokeMat) {
      smokeMat.uniforms.uTime.value = t ?? (smokeMat.uniforms.uTime.value + dt);
      const fov = camera?.fov ?? 50;
      smokeMat.uniforms.uScale.value = innerHeight * Math.min(2, devicePixelRatio || 1) / (2 * Math.tan(fov * Math.PI / 360));
    }
  }

  function dispose() {
    disposed = true;
    scene.remove(group);
    for (const g of disposables) g.dispose();
    group.traverse(o => { if (o.isInstancedMesh) o.dispose?.(); });
    const seen = new Set();
    group.traverse(o => {
      if (!o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (seen.has(m)) continue; seen.add(m);
        for (const key of ['map', 'normalMap', 'roughnessMap', 'emissiveMap', 'metalnessMap']) m[key]?.dispose();
        m.dispose();
      }
      if (o.geometry && !disposables.includes(o.geometry)) o.geometry.dispose();
    });
    if (world) for (const b of bodies) world.removeBody(b);
    bodies.length = 0;
  }

  const api = {
    group, ready, items, skipped, treesToClear, clearGroups, colliders, stats,
    update, pushOut, blocks, noGrass, trimGrass, addBodies, dispose,
  };
  if (typeof location !== 'undefined' && /[?&]test\b/.test(location.search)) {
    const HAM = { A: [-8, 26, -Math.PI / 2], F: [9, 24, Math.PI / 2], B: [-6, -52, -Math.PI / 2] };
    window.__vprops = Object.assign(api, {
      go(h = 'A') { const p = HAM[h]; if (p && window.__drive?.teleport) window.__drive.teleport(p[0], p[1], p[2]); return p; },
      list: () => items.map(i => `${i.hamlet} ${i.kind} (${i.x.toFixed(1)}, ${i.z.toFixed(1)}) rot ${i.rot.toFixed(2)} y ${i.y.toFixed(2)}`),
    });
  }
  return api;
}
