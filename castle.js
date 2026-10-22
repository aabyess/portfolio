/* ════════════════════════════════════════════════════════════
   성문 — 큰길 북쪽 끝(z ≈ -80)의 "상호성" 성문. 임금님 행차가 여기로 들어간다.
   ────────────────────────────────────────────────────────────
   모델: models/props/castle-gate.glb (tools/blender/castle/build_gate.py, 약 6k 삼각형, 265 KB)
     둥근 탑 2개(원뿔 슬레이트 지붕·깃발) + 아치 통로(폭 4.6 m, 높이 5.3 m) + 내리닫이 쇠창살(portcullis)
     + 나무 겹문(gate_door_l / gate_door_r) + 양옆 성벽·모서리 탑 + 뒤쪽 본성(keep). 횃불 2개.
     간판 "상호성", 탑의 왕실 현수막, 깃발(왕관 + '최')은 여기서 캔버스로 그린다.
   열기: 쇠창살이 올라가고 문 두 짝이 안쪽으로 열린다(약 2초). 닫기는 반대.
   통로 안은 반투명 검은 막 4장 + 끝의 검은 막 → 걸어 들어가면 점점 어두워지다 사라진다("성 안으로").

   ── portfolio.js 연결 방법 (PM용) ──────────────────────────────
   ⓪ 나무 비우기 — worldLoader.load(...) 위에서 한 번:
        const { CASTLE_CLEAR } = await import('./castle.js');
      월드 콜백의 clearTrees(... PONDS ...) 줄 다음에:
        clearTrees(gltf.scene, CASTLE_CLEAR.spots, CASTLE_CLEAR.r);   // 성벽 자리 나무를 뺀다

   ① fishing 블록 근처(draco·world·CANNON 이 준비된 뒤):
        let castle = null;
        {
          const { createCastle } = await import('./castle.js');
          castle = createCastle({ THREE, scene, GLTFLoader, dracoLoader: draco, groundY, pathX,
                                  CANNON, world, getNight: () => night });
        }
   ② step(dt) 안 (village.update 근처):  if (castle) castle.update(dt, t);
   ③ 걷기·운전 충돌 — fishing.pushOut 줄 옆에:
        walk():  if (castle && castle.pushOut(person.position, 0.35)) pSpeed *= 0.5;
        drive(): if (castle && castle.pushOut(car.position, 1.4)) speed *= 0.5;
      (NPC 길찾기에도 castle.blocks(x, z) 를 쓸 수 있다. 문이 닫혀 있으면 통로도 막힌다.)
   ④ village 에 넘기기 — createVillage({... , gate: castle.villageGate(0) })  (village.js 쪽 변경은 PM 메모 참고)
   콘솔: __castle.open(), __castle.close(), __castle.state

   ── 반환 API ──
     group, gates(배열: {x, z, rotY, open 0..1}), ready(Promise)
     openGate(i = 0), closeGate(i = 0), isOpen(i = 0) → 다 열렸으면 true
     gateEntry(i = 0, depth = 7.3) → {x, z}  통로 끝 바로 뒤(검은 막 너머). 행렬이 여기까지 걸어가면 사라진 것처럼 보인다
     gateFront(i = 0, dist = 6) → {x, z}  문 앞 길 위
     blocks(x, z, r = 0) / pushOut(pos, r) → 성벽·탑·(닫힌) 문 충돌
     villageGate(i = 0) → { x, z, entry, front, open(), close(), isOpen() }  village.js 용
     colliders → [{ x, z, y, hx, hy, hz, rotY, door }]  (CANNON 을 안 넘기면 PM이 직접 박스를 만들 때 쓴다)
     update(dt, t), dispose()
   ════════════════════════════════════════════════════════════ */
import { addStaticLOD } from './perf.js';


/* 길: portfolio.js 의 pathX = 3.08·sin(-0.04286·z) 와 같은 값 (월드 JSON path.amp / path.k) */
const AMP = 3.08, K = 0.04285714285714286;
const px0 = z => AMP * Math.sin(-K * z);
const pxd = z => -AMP * K * Math.cos(-K * z);           // dx/dz
const GZ = -80;                                          // 성문 앞면(아치 바깥 면) z

/* rotY: 통로가 길 방향을 따라가게 살짝 돌린다 (로컬 -Z 가 성 안쪽) */
export const GATES = [{ id: 'north', name: '상호성', x: +px0(GZ).toFixed(3), z: GZ, rotY: +Math.atan(pxd(GZ)).toFixed(4) }];

/* 나무 비우기 자리: 성 앞면을 따라 (로컬 x -16..16, z 0..-4). 성 뒤쪽은 맵(z -84) 밖이라 나무가 없다 */
export const CASTLE_CLEAR = {
  r: 5.5,
  spots: GATES.flatMap(g => [-15, -10, -5, 0, 5, 10, 15].map(lx => {
    const c = Math.cos(g.rotY), s = Math.sin(g.rotY), lz = -2;
    return [+(g.x + c * lx + s * lz).toFixed(2), +(g.z - s * lx + c * lz).toFixed(2)];
  })),
};

/* 충돌 모양 (로컬 좌표, 미터). rect: 중심 x,z · 반폭 hx,hz · 높이 h / circ: 중심 · 반지름 r */
const SOLIDS = [
  { t: 'rect', x: -3.1, z: -3.5, hx: 0.8, hz: 3.5, h: 9.6 },     // 성문채 좌우 (통로 벽)
  { t: 'rect', x: 3.1, z: -3.5, hx: 0.8, hz: 3.5, h: 9.6 },
  { t: 'circ', x: -5.45, z: -0.55, r: 2.85, h: 11.6 },            // 둥근 탑 (밑동 포함)
  { t: 'circ', x: 5.45, z: -0.55, r: 2.85, h: 11.6 },
  { t: 'rect', x: -11.2, z: -1.55, hx: 3.8, hz: 1.15, h: 7.4 },   // 성벽
  { t: 'rect', x: 11.2, z: -1.55, hx: 3.8, hz: 1.15, h: 7.4 },
  { t: 'rect', x: -16.5, z: -1.55, hx: 1.6, hz: 1.6, h: 9.4 },    // 모서리 탑
  { t: 'rect', x: 16.5, z: -1.55, hx: 1.6, hz: 1.6, h: 9.4 },
  { t: 'rect', x: -16.5, z: -10.15, hx: 1.0, hz: 7.0, h: 6 },     // 옆 성벽 (맵 밖)
  { t: 'rect', x: 16.5, z: -10.15, hx: 1.0, hz: 7.0, h: 6 },
  { t: 'rect', x: 0, z: -17.2, hx: 16.5, hz: 1.0, h: 6 },         // 뒷벽
  { t: 'rect', x: 0, z: -13.5, hx: 7.4, hz: 5.4, h: 15 },          // 본성
  { t: 'rect', x: 0, z: -1.0, hx: 2.35, hz: 0.65, h: 5.3, door: true },   // 닫힌 문 + 쇠창살
];

const OPEN_TIME = 2.0, DOOR_ANG = 100 * Math.PI / 180, PORT_LIFT = 5.5;
const AH = 2.3, SPR = 3.0;                               // 아치 반폭 · 아치가 시작하는 높이 (모델과 같다)

export function createCastle({ THREE, scene, GLTFLoader, dracoLoader = null, groundY = () => 0, pathX = null,
  CANNON = null, world = null, addCollider = null, getNight = () => 0, url = 'models/props/castle-gate.glb', debug = true }) {

  const group = new THREE.Group(); group.name = 'castle';
  scene.add(group);
  const disposables = [];
  const keep = x => (disposables.push(x), x);
  const fontFam = "'Pretendard Variable', Pretendard, system-ui, sans-serif";

  /* ── 성문 자리 (pathX 를 받으면 그걸로 다시 맞춘다) ── */
  const gates = GATES.map(g => {
    let x = g.x, rotY = g.rotY;
    if (pathX) { x = pathX(g.z); rotY = Math.atan((pathX(g.z + 0.5) - pathX(g.z - 0.5))); }
    const root = new THREE.Group();
    root.position.set(x, groundY(x, g.z), g.z); root.rotation.y = rotY;
    group.add(root);
    return { id: g.id, x, z: g.z, rotY, root, c: Math.cos(rotY), s: Math.sin(rotY),
      open: 0, target: 0, parts: null, flags: [], flames: [], light: null, bodies: [], doorBody: null, doorIn: false };
  });
  const toWorld = (g, lx, lz) => ({ x: g.x + g.c * lx + g.s * lz, z: g.z - g.s * lx + g.c * lz });
  const toLocal = (g, x, z) => { const dx = x - g.x, dz = z - g.z; return { x: g.c * dx - g.s * dz, z: g.s * dx + g.c * dz }; };

  /* ── 캔버스 그림: 왕관 · 간판 · 현수막 · 깃발 ── */
  function crown(g, cx, cy, w, fill = '#f2c14e', line = '#7a4a10') {
    const h = w * 0.62;
    g.save(); g.translate(cx, cy);
    g.beginPath();
    g.moveTo(-w / 2, h / 2); g.lineTo(-w / 2, -h * 0.15); g.lineTo(-w * 0.27, h * 0.12); g.lineTo(0, -h / 2);
    g.lineTo(w * 0.27, h * 0.12); g.lineTo(w / 2, -h * 0.15); g.lineTo(w / 2, h / 2); g.closePath();
    g.fillStyle = fill; g.fill(); g.lineWidth = Math.max(2, w * 0.04); g.strokeStyle = line; g.stroke();
    for (const [x, y] of [[-w / 2, -h * 0.15], [0, -h / 2], [w / 2, -h * 0.15]]) {
      g.beginPath(); g.arc(x, y - w * 0.05, w * 0.07, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    g.fillStyle = '#c0283a'; g.beginPath(); g.arc(0, h * 0.28, w * 0.07, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function tex(cv) { const t = keep(new THREE.CanvasTexture(cv)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = false; return t; }   // glTF UV 는 위아래가 뒤집혀 있다
  function signTexture() {
    const W = 1024, H = 272, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#7a1420'); grd.addColorStop(1, '#4e0b14');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#e9b84a'; g.lineWidth = 12; g.strokeRect(14, 14, W - 28, H - 28);
    g.lineWidth = 3; g.strokeRect(32, 32, W - 64, H - 64);
    crown(g, 140, H / 2 + 6, 120); crown(g, W - 140, H / 2 + 6, 120);
    g.font = `900 150px ${fontFam}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = '#3a0a0c'; g.strokeText('상호성', W / 2, H / 2 + 8);
    const gold = g.createLinearGradient(0, 60, 0, H - 60); gold.addColorStop(0, '#fff0b0'); gold.addColorStop(0.5, '#f2c14e'); gold.addColorStop(1, '#b8801e');
    g.fillStyle = gold; g.fillText('상호성', W / 2, H / 2 + 8);
    return tex(cv);
  }
  function bannerTexture() {
    const W = 256, H = 592, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#a3121f'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#7d0c17'; for (let x = 0; x < W; x += 32) g.fillRect(x, 0, 10, H);   // 천 주름
    g.strokeStyle = '#f2c14e'; g.lineWidth = 10; g.strokeRect(14, 10, W - 28, H * 0.86 - 10);
    crown(g, W / 2, 130, 150);
    g.font = `900 150px ${fontFam}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = '#4a0810'; g.strokeText('최', W / 2, 320);
    g.fillStyle = '#f2c14e'; g.fillText('최', W / 2, 320);
    g.fillStyle = '#f2c14e'; g.fillRect(40, 430, W - 80, 8);
    return tex(cv);
  }
  function flagTexture() {
    const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#b3141f'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f2c14e'; g.fillRect(0, 0, W, 16); g.fillRect(0, H - 16, W, 16);
    crown(g, 120, H / 2, 120);
    g.font = `900 140px ${fontFam}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = '#4a0810'; g.strokeText('최', 290, H / 2 + 6);
    g.fillStyle = '#f2c14e'; g.fillText('최', 290, H / 2 + 6);
    return tex(cv);
  }

  /* ── 통로 안 어둠: 아치 모양 막. 앞 4장은 반투명, 끝 1장은 불투명 ── */
  const archShape = (() => {
    const s = new THREE.Shape(), a = AH - 0.03;
    s.moveTo(-a, -0.05); s.lineTo(a, -0.05); s.lineTo(a, SPR);
    s.absarc(0, SPR, a, 0, Math.PI, false); s.lineTo(-a, -0.05);
    return s;
  })();
  const archGeo = keep(new THREE.ShapeGeometry(archShape, 12));
  const veilMat = keep(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
  const endMat = keep(new THREE.MeshBasicMaterial({ color: 0x050403, side: THREE.DoubleSide }));
  const signMat = keep(new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.7, metalness: 0.05 }));
  const bannerMat = keep(new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.9, side: THREE.DoubleSide }));
  const flagMat = keep(new THREE.MeshStandardMaterial({ map: flagTexture(), roughness: 0.9, side: THREE.DoubleSide }));

  for (const g of gates) {
    [-2.4, -3.6, -4.8, -6.0].forEach(z => {
      const m = new THREE.Mesh(archGeo, veilMat); m.position.z = z; m.renderOrder = 2; g.root.add(m);
    });
    const end = new THREE.Mesh(archGeo, endMat); end.position.z = -7.0; g.root.add(end);
    /* 횃불 빛: 밤에 아치 앞을 비춘다 (그림자 없음) */
    const L = new THREE.PointLight(0xff9a40, 0, 16, 2); L.position.set(0, 3.8, 1.2); g.root.add(L); g.light = L;
  }

  /* ── 충돌: CANNON 정적 박스 (넘겨 주면) + 2D 밀어내기 ── */
  const colliders = [];
  for (const g of gates) for (const S of SOLIDS) {
    const hx = S.t === 'rect' ? S.hx : S.r * 0.86, hz = S.t === 'rect' ? S.hz : S.r * 0.86;
    const w = toWorld(g, S.x, S.z), y = g.root.position.y + S.h / 2;
    const col = { x: w.x, z: w.z, y, hx, hy: S.h / 2, hz, rotY: g.rotY, door: !!S.door, gate: g.id };
    colliders.push(col);
    if (CANNON && world) {
      const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(hx, S.h / 2, hz)) });
      body.position.set(w.x, y, w.z); body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), g.rotY);
      if (S.door) { g.doorBody = body; world.addBody(body); g.doorIn = true; }
      else { world.addBody(body); g.bodies.push(body); }
    } else if (addCollider && !S.door) {
      addCollider(col);
    }
  }
  function solidActive(g, S) { return !S.door || g.open < 0.92; }
  /* 로컬 점 p 가 모양 S 를 r 만큼 침범하면 밀어낼 벡터(로컬)를 돌려준다 */
  function pen(S, lx, lz, r) {
    if (S.t === 'circ') {
      const dx = lx - S.x, dz = lz - S.z, d = Math.hypot(dx, dz), R = S.r + r;
      if (d >= R) return null;
      if (d < 1e-4) return { x: R, z: 0 };
      return { x: dx / d * (R - d), z: dz / d * (R - d) };
    }
    const dx = lx - S.x, dz = lz - S.z;
    const ox = S.hx + r - Math.abs(dx), oz = S.hz + r - Math.abs(dz);
    if (ox <= 0 || oz <= 0) return null;
    /* 모서리 둥글게: 두 축 모두 박스 밖이면 원 거리로 */
    const ex = Math.abs(dx) - S.hx, ez = Math.abs(dz) - S.hz;
    if (ex > 0 && ez > 0) {
      const d = Math.hypot(ex, ez); if (d >= r) return null;
      const k = (r - d) / d; return { x: Math.sign(dx) * ex * k, z: Math.sign(dz) * ez * k };
    }
    return ox < oz ? { x: Math.sign(dx || 1) * ox, z: 0 } : { x: 0, z: Math.sign(dz || 1) * oz };
  }
  function blocks(x, z, r = 0) {
    for (const g of gates) {
      if (Math.abs(x - g.x) > 30 || Math.abs(z - g.z) > 30) continue;
      const l = toLocal(g, x, z);
      for (const S of SOLIDS) if (solidActive(g, S) && pen(S, l.x, l.z, r)) return true;
    }
    return false;
  }
  function pushOut(pos, r = 0.35) {
    let hit = false;
    for (const g of gates) {
      if (Math.abs(pos.x - g.x) > 30 || Math.abs(pos.z - g.z) > 30) continue;
      for (let it = 0; it < 2; it++) {
        const l = toLocal(g, pos.x, pos.z);
        let moved = false;
        for (const S of SOLIDS) {
          if (!solidActive(g, S)) continue;
          const p = pen(S, l.x, l.z, r);
          if (!p) continue;
          l.x += p.x; l.z += p.z; moved = true;
        }
        if (!moved) break;
        const w = toWorld(g, l.x, l.z); pos.x = w.x; pos.z = w.z; hit = true;
      }
    }
    return hit;
  }

  /* ── 모델 불러오기 ── */
  const loader = new GLTFLoader();
  if (dracoLoader) loader.setDRACOLoader(dracoLoader);
  const ready = new Promise(res => loader.load(url, gltf => {
    for (const g of gates) {
      const sc = gates.length > 1 && g !== gates[0] ? gltf.scene.clone(true) : gltf.scene;
      sc.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        const nm = (o.name + ' ' + (o.parent ? o.parent.name : ''));
        if (/gate_sign/.test(nm)) o.material = signMat;
        else if (/banner_[lr]/.test(nm)) { o.material = bannerMat; o.castShadow = false; }
        else if (/flag_/.test(nm)) {
          o.material = flagMat; o.castShadow = false;
          const pa = o.geometry.attributes.position;
          o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox;
          g.flags.push({ mesh: o, base: Float32Array.from(pa.array), x0: bb.min.x, w: Math.max(0.1, bb.max.x - bb.min.x), ph: Math.random() * 6 });
        } else if (/torch_flame/.test(nm)) {
          o.castShadow = false; o.material = o.material.clone(); keep(o.material);
          g.flames.push({ mesh: o, ph: Math.random() * 6 });
        }
      });
      const get = n => sc.getObjectByName(n);
      g.parts = { l: get('gate_door_l'), r: get('gate_door_r'), port: get('portcullis') };
      if (g.parts.port) g.parts.portY = g.parts.port.position.y;
      g.root.add(sc);
      applyOpen(g);
      /* 성능: 멀면 정점색 한 덩어리로 (움직이는 문·쇠창살·깃발·횃불·간판은 그대로) */
      addStaticLOD(THREE, sc, { dist: 50, keep: o => { for (let p = o; p && p !== sc; p = p.parent) if (/gate_door|portcullis|flag_|banner_|torch_flame|gate_sign/.test(p.name)) return true; return false; } });
    }
    res(true);
  }, undefined, err => { console.warn('[castle] 모델을 못 불러왔어요', err); res(false); }));

  /* ── 열기 · 닫기 ── */
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  function applyOpen(g) {
    const P = g.parts; if (!P) return;
    const port = ease(clamp01(g.open / 0.6));            // 쇠창살이 먼저 올라가고
    const door = ease(clamp01((g.open - 0.3) / 0.7));    // 문이 뒤따라 열린다
    if (P.port) P.port.position.y = P.portY + PORT_LIFT * port;
    if (P.l) P.l.rotation.y = DOOR_ANG * door;           // 왼쪽 문: 안쪽(-Z)으로
    if (P.r) P.r.rotation.y = -DOOR_ANG * door;
  }
  const G = i => gates[i] || gates[0];
  function openGate(i = 0) { G(i).target = 1; }
  function closeGate(i = 0) { G(i).target = 0; }
  function isOpen(i = 0) { return G(i).open >= 0.999; }
  function gateEntry(i = 0, depth = 7.3) { const g = G(i); return toWorld(g, 0, -depth); }
  function gateFront(i = 0, dist = 6) { const g = G(i); return toWorld(g, 0, dist); }
  function villageGate(i = 0) {
    const g = G(i);
    return { x: g.x, z: g.z, entry: gateEntry(i), front: gateFront(i),
      open: () => openGate(i), close: () => closeGate(i), isOpen: () => isOpen(i) };
  }

  function update(dt, t = performance.now() / 1000) {
    dt = Math.min(dt, 0.1);
    const night = getNight() || 0;
    for (const g of gates) {
      if (g.open !== g.target) {
        const s = dt / OPEN_TIME;
        g.open = g.target > g.open ? Math.min(g.target, g.open + s) : Math.max(g.target, g.open - s);
        applyOpen(g);
        if (g.doorBody && world) {
          const want = g.open < 0.92;
          if (want !== g.doorIn) { if (want) world.addBody(g.doorBody); else world.removeBody(g.doorBody); g.doorIn = want; }
        }
      }
      /* 깃발 펄럭임 (깃대 쪽은 고정, 끝으로 갈수록 크게) */
      for (const f of g.flags) {
        const pa = f.mesh.geometry.attributes.position, a = pa.array, b = f.base;
        for (let k = 0; k < pa.count; k++) {
          const u = (b[k * 3] - f.x0) / f.w;
          a[k * 3 + 2] = b[k * 3 + 2] + Math.sin(t * 4.2 + u * 4.5 + f.ph) * 0.16 * u;
          a[k * 3 + 1] = b[k * 3 + 1] + Math.sin(t * 3.1 + u * 3 + f.ph) * 0.04 * u;
        }
        pa.needsUpdate = true;
      }
      /* 횃불 일렁임 + 밤에 빛 */
      const fl = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
      for (const f of g.flames) {
        const k = 0.9 + 0.12 * Math.sin(t * 11 + f.ph) + 0.06 * Math.sin(t * 23 + f.ph);
        f.mesh.scale.set(1, k, 1);
        if (f.mesh.material.emissiveIntensity !== undefined) f.mesh.material.emissiveIntensity = (0.8 + 1.6 * night) * k;
      }
      if (g.light) g.light.intensity = (1 + 24 * night) * fl;
    }
  }

  function dispose() {
    scene.remove(group);
    for (const g of gates) {
      if (world) { for (const b of g.bodies) world.removeBody(b); if (g.doorBody && g.doorIn) world.removeBody(g.doorBody); }
    }
    group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
    for (const d of disposables) d.dispose && d.dispose();
    if (debug && typeof window !== 'undefined' && window.__castle === api) delete window.__castle;
  }

  const api = {
    group, gates, ready, colliders,
    openGate, closeGate, isOpen, gateEntry, gateFront, villageGate,
    blocks, pushOut, update, dispose,
  };
  if (debug && typeof window !== 'undefined') {
    window.__castle = {
      open: (i = 0) => openGate(i), close: (i = 0) => closeGate(i),
      get state() { return gates.map(g => ({ id: g.id, x: +g.x.toFixed(2), z: g.z, open: +g.open.toFixed(2) })); },
      api,
    };
  }
  return api;
}
