/* ════════════════════════════════════════════════════════════
   탱크 부속 — vehicles.js 가 'tank' 를 고를 때만 쓴다
   ────────────────────────────────────────────────────────────
   1) buildTankPlaceholder(THREE)
      models/vehicles/tank.glb 가 아직 없을 때 쓰는 절차적 탱크. 부품 이름이 glb 와 같다:
        hull · turret(포탑, 원점=포탑 링) › barrel(포신, 로컬 X 로 고각) › muzzle(Empty)
        track_l / track_r (재질 Track_L / Track_R, 텍스처 오프셋을 흘려 궤도를 굴린다)
        wheel_l0..5 / wheel_r0..5, sprocket_l / sprocket_r (로컬 X 로 회전), seat(Empty, 전차장 엉덩이)
      앞 = +Z, 위 = +Y, 원점 = 바닥 높이·차체 중앙, 실제 미터 (다른 탈것 glb 와 같은 규칙).

   2) createTankFX({ THREE, scene, groundY, getNpcs, toyBlocks, explode })
      포탄(중력 받는 투사체) · 포구 화염/연기 · 착탄 폭발(섬광·불덩이·연기 기둥·파편·충격파 고리·
      그을음 자국 30초) · 방사형 충격(손님 6 m 안 넘어짐, 장난감 블록·의자 날아감) · 카메라 흔들림 ·
      WebAudio 합성음(발사·폭발·장전 완료·엔진 웅웅).
      매 프레임 할당 0: 입자·파편·고리·자국·포탄은 모두 미리 만든 풀을 돌려 쓴다.

   폭발을 다른 모듈(weapons.js)과 나눠 쓰려면
     - 이 모듈의 fx.explode(pos, radius, force) 를 그대로 불러도 되고
     - createTankFX 에 explode(pos, radius, force) 를 넘기면 착탄 때 로컬 폭발 대신 그걸 부른다.
   ════════════════════════════════════════════════════════════ */

/* ── 공통: 캔버스 텍스처 ── */
function canvasTex(THREE, w, h, draw, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/* 결정적 난수 (매번 같은 모양) */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* ════════════════════════════════════════════════════════════
   1) 절차적 탱크
   ════════════════════════════════════════════════════════════ */
export const TANK_DIMS = {
  trackX: 1.2, trackW: 0.52, trackT: 0.06,
  wheelR: 0.34, wheelZ: [-2.05, -1.23, -0.41, 0.41, 1.23, 2.05],
  sprocket: { z: -2.72, y: 0.66, r: 0.33 }, idler: { z: 2.72, y: 0.66, r: 0.3 },
  turretY: 1.56, turretZ: -0.25
};

/* 둘레 원들을 감싸는 볼록 궤도 리본. (z, y) 평면에서 반시계로 돈다 → u 는 바닥에서 +Z 쪽으로 증가 */
function trackGeometry(THREE, circles, x0, width, thick) {
  const pts = [];
  for (const c of circles) for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2;
    pts.push([c.z + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r]);
  }
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));   // 반시계

  /* 같은 간격으로 다시 찍는다 */
  let per = 0; const segL = [];
  for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); segL.push(l); per += l; }
  /* 바닥 한가운데에서 시작 (이음매가 덜 보이게) */
  const N = 220, pitch = per / Math.round(per / 0.155);
  const samp = [];
  let si = 0, acc = 0;
  for (let k = 0; k < N; k++) {
    const d = k / N * per;
    while (acc + segL[si] < d) { acc += segL[si]; si = (si + 1) % hull.length; }
    const a = hull[si], b = hull[(si + 1) % hull.length], t = (d - acc) / (segL[si] || 1);
    samp.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, d]);
  }
  const nrm = samp.map((p, i) => {
    const a = samp[(i - 1 + N) % N], b = samp[(i + 1) % N];
    const dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy) || 1;
    return [dy / l, -dz / l];   // 반시계 → 바깥쪽
  });
  const pos = [], uv = [], idx = [];
  const xs = [x0 + width / 2, x0 - width / 2];
  /* 띠 4장: 바깥면 · 안쪽면 · 양옆 */
  const strip = (fa, fb, va, vb, flip) => {
    const base = pos.length / 3;
    for (let k = 0; k <= N; k++) {
      const i = k % N, p = samp[i], n = nrm[i], u = (k === N ? per : p[2]) / pitch;
      const A = fa(p, n), B = fb(p, n);
      pos.push(A[0], A[1], A[2], B[0], B[1], B[2]);
      uv.push(u, va, u, vb);
    }
    for (let k = 0; k < N; k++) {
      const a = base + k * 2, b = a + 1, c = a + 2, d = a + 3;
      if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  };
  const P = (x, p, n, o) => [x, p[1] + n[1] * o, p[0] + n[0] * o];
  strip((p, n) => P(xs[0], p, n, thick), (p, n) => P(xs[1], p, n, thick), 0, 1, false);       // 바깥 (발굽면)
  strip((p, n) => P(xs[0], p, n, 0), (p, n) => P(xs[1], p, n, 0), 0, 1, true);                // 안쪽
  strip((p, n) => P(xs[0], p, n, 0), (p, n) => P(xs[0], p, n, thick), 0.02, 0.06, false);     // 왼옆
  strip((p, n) => P(xs[1], p, n, 0), (p, n) => P(xs[1], p, n, thick), 0.02, 0.06, true);      // 오른옆
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildTankPlaceholder(THREE) {
  const D = TANK_DIMS;
  const root = new THREE.Group(); root.name = 'tank';

  /* 재질 */
  const camo = canvasTex(THREE, 256, 256, (c, w, h) => {
    const r = rng(7);
    c.fillStyle = '#8a9460'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { const v = r(); c.fillStyle = `rgba(${v < .5 ? '30,34,18' : '120,128,84'},${0.04 + r() * 0.06})`; c.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6); }
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(40,36,24,${0.05 + r() * 0.08})`; c.fillRect(r() * w, r() * h * 0.2 + h * 0.8, 1 + r() * 2, 8 + r() * 30); }   // 흙탕 줄
  });
  camo.wrapS = camo.wrapT = THREE.RepeatWrapping;
  const olive = new THREE.MeshStandardMaterial({ name: 'Tank_Paint', color: 0xffffff, map: camo, roughness: 0.72, metalness: 0.1 });
  const oliveDk = new THREE.MeshStandardMaterial({ name: 'Tank_PaintDark', color: 0xc4c8b0, map: camo, roughness: 0.8, metalness: 0.1 });
  const vision = new THREE.MeshStandardMaterial({ name: 'Tank_Vision', color: 0x4a6a78, roughness: 0.15, metalness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ name: 'Tank_Steel', color: 0x55534d, roughness: 0.5, metalness: 0.45 });
  const rubber = new THREE.MeshStandardMaterial({ name: 'Tank_Rubber', color: 0x1c1b1a, roughness: 0.92, metalness: 0 });
  const glass = new THREE.MeshStandardMaterial({ name: 'Lamp_Glass', color: 0xfff2cc, emissive: 0xffd890, emissiveIntensity: 0.6, roughness: 0.2 });
  const treadTex = canvasTex(THREE, 128, 64, (c, w, h) => {
    c.fillStyle = '#2a2925'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#46433c'; c.fillRect(8, 0, 48, h);               // 링크 판
    c.fillStyle = '#5b5850'; c.fillRect(22, 2, 16, h - 4);          // 그라우저(돌기)
    c.fillStyle = '#1a1917'; c.fillRect(60, 0, 6, h);               // 이음새
    c.fillStyle = '#3a3833'; c.fillRect(72, 0, 48, h);
    c.fillStyle = '#4e4b44'; c.fillRect(86, 2, 16, h - 4);
    c.fillStyle = '#18171a'; c.fillRect(124, 0, 4, h);
    c.fillStyle = '#6a665c'; for (const y of [h * 0.18, h * 0.82]) { c.fillRect(30, y - 2, 4, 4); c.fillRect(94, y - 2, 4, 4); }   // 핀
  });
  treadTex.wrapS = THREE.RepeatWrapping; treadTex.wrapT = THREE.ClampToEdgeWrapping;
  treadTex.repeat.set(0.5, 1);   // 128px 텍스처에 링크 2개 → 링크 하나 = pitch

  const mesh = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); if (name) m.name = name; m.castShadow = true; m.receiveShadow = true; return m; };
  const ext = (shape, depth, bevel = 0.04) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  /* (z, y) 옆모습을 X 로 밀어낸 덩어리. shape.x = -z 로 넣고 rotateY(π/2) → (e, y, z) */
  const sideBlock = (pts, halfW, bevel = 0.04) => {
    const s = new THREE.Shape(); pts.forEach(([z, y], i) => i ? s.lineTo(-z, y) : s.moveTo(-z, y));
    const g = ext(s, halfW * 2 - bevel * 2, bevel); g.rotateY(Math.PI / 2); g.translate(-halfW + bevel, 0, 0);
    return g;
  };

  /* ── 차체 ── */
  const hull = new THREE.Group(); hull.name = 'hull'; root.add(hull);
  hull.add(mesh(sideBlock([[-2.82, 1.12], [-2.82, 0.58], [-2.45, 0.36], [2.3, 0.36], [2.98, 0.78], [2.98, 1.12]], 0.92), oliveDk, 'hull_lower'));
  hull.add(mesh(sideBlock([[-2.98, 1.08], [-2.98, 1.46], [-2.8, 1.56], [1.3, 1.56], [3.02, 1.14], [3.02, 1.08]], 1.46, 0.05), olive, 'hull_upper'));
  /* 흙받이 앞뒤 끝 */
  for (const sx of [-1, 1]) {
    const f = mesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), olive); f.position.set(sx * D.trackX, 1.07, 3.15); f.rotation.x = 0.35; hull.add(f);
    const b = mesh(new THREE.BoxGeometry(0.5, 0.04, 0.3), olive); b.position.set(sx * D.trackX, 1.1, -3.08); hull.add(b);
    /* 공구함·예비 궤도 */
    const box = mesh(new THREE.BoxGeometry(0.36, 0.22, 1.1), oliveDk); box.position.set(sx * 1.22, 1.67, -1.6); hull.add(box);
    const lamp = mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.1, 12), steel); lamp.rotation.x = Math.PI / 2; lamp.position.set(sx * 1.05, 1.32, 2.42); hull.add(lamp);
    const lg = mesh(new THREE.CircleGeometry(0.07, 12), glass); lg.position.set(sx * 1.05, 1.32, 2.48); hull.add(lg);
    const ex = mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.35, 10), steel); ex.rotation.x = Math.PI / 2; ex.position.set(sx * 0.6, 1.25, -3.08); hull.add(ex);
    const hook = mesh(new THREE.TorusGeometry(0.09, 0.03, 6, 10), steel); hook.position.set(sx * 0.62, 0.72, 3.0); hook.rotation.y = Math.PI / 2; hull.add(hook);
  }
  /* 앞 경사판 위 예비 궤도 링크 */
  const spareMat = new THREE.MeshStandardMaterial({ name: 'Tank_Spare', map: treadTex.clone(), roughness: 0.8, metalness: 0.4 });
  spareMat.map.repeat.set(1.5, 1);
  const spare = mesh(new THREE.BoxGeometry(1.5, 0.05, 0.5), spareMat); spare.position.set(0, 1.42, 2.15); spare.rotation.x = 0.24; hull.add(spare);
  /* 운전수 해치·잠망경 */
  const dh = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 16), oliveDk); dh.position.set(-0.45, 1.6, 1.05); hull.add(dh);
  const per1 = mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1), steel); per1.position.set(-0.45, 1.62, 1.35); hull.add(per1);
  /* 엔진 덮개 그릴 */
  for (let i = 0; i < 6; i++) { const g = mesh(new THREE.BoxGeometry(1.6, 0.025, 0.06), steel); g.position.set(0, 1.575, -2.0 - i * 0.13); hull.add(g); }
  /* 측면 스커트 (궤도 윗부분을 살짝 가린다) */
  for (const sx of [-1, 1]) {
    const sk = mesh(new THREE.BoxGeometry(0.04, 0.32, 5.2), olive); sk.position.set(sx * 1.47, 0.95, -0.05); hull.add(sk);
    for (let i = 0; i < 5; i++) { const ln = mesh(new THREE.BoxGeometry(0.045, 0.3, 0.02), oliveDk); ln.position.set(sx * 1.475, 0.95, -2.4 + i * 1.05 + 0.5); hull.add(ln); }
  }

  /* ── 궤도 ── */
  const circles = [
    ...D.wheelZ.map(z => ({ z, y: D.wheelR + D.trackT, r: D.wheelR })),
    { z: D.sprocket.z, y: D.sprocket.y, r: D.sprocket.r }, { z: D.idler.z, y: D.idler.y, r: D.idler.r }
  ];
  for (const [side, sx] of [['l', 1], ['r', -1]]) {
    const mat = new THREE.MeshStandardMaterial({ name: side === 'l' ? 'Track_L' : 'Track_R', map: treadTex.clone(), roughness: 0.85, metalness: 0.45, side: THREE.DoubleSide });
    mat.map.needsUpdate = true;
    root.add(mesh(trackGeometry(THREE, circles, sx * D.trackX, D.trackW, D.trackT), mat, 'track_' + side));

    /* 보기륜: 가운데 홈 있는 두 겹 바퀴 + 허브 볼트 */
    const tire = new THREE.CylinderGeometry(D.wheelR, D.wheelR, 0.17, 24); tire.rotateZ(Math.PI / 2);
    const disc = new THREE.CylinderGeometry(D.wheelR * 0.78, D.wheelR * 0.78, 0.19, 20); disc.rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.09, 0.09, 0.24, 8); hub.rotateZ(Math.PI / 2);
    const bolt = new THREE.BoxGeometry(0.22, 0.035, 0.035);
    D.wheelZ.forEach((z, i) => {
      const w = new THREE.Group(); w.name = `wheel_${side}${i}`;
      w.position.set(sx * D.trackX, D.wheelR + D.trackT, z);
      for (const o of [-0.11, 0.11]) {
        const t = mesh(tire, rubber); t.position.x = o; w.add(t);
        const d = mesh(disc, olive); d.position.x = o; w.add(d);
      }
      w.add(mesh(hub, steel));
      for (let k = 0; k < 5; k++) { const b = mesh(bolt, steel); const a = k / 5 * Math.PI * 2; b.position.set(0.02 * sx, Math.cos(a) * 0.17, Math.sin(a) * 0.17); w.add(b); }
      root.add(w);
    });
    /* 기동륜(뒤, 톱니) · 유동륜(앞) */
    const sp = new THREE.Group(); sp.name = 'sprocket_' + side;
    sp.position.set(sx * D.trackX, D.sprocket.y, D.sprocket.z);
    const sg = new THREE.CylinderGeometry(D.sprocket.r - 0.04, D.sprocket.r - 0.04, 0.36, 18); sg.rotateZ(Math.PI / 2);
    sp.add(mesh(sg, steel));
    const tooth = new THREE.BoxGeometry(0.34, 0.07, 0.09);
    for (let k = 0; k < 12; k++) { const t = mesh(tooth, steel); const a = k / 12 * Math.PI * 2; t.position.set(0, Math.cos(a) * (D.sprocket.r - 0.02), Math.sin(a) * (D.sprocket.r - 0.02)); t.rotation.x = -a; sp.add(t); }
    const cap = mesh(hub, olive); cap.scale.set(1.7, 1.7, 1.7); sp.add(cap);
    root.add(sp);
    const id = new THREE.Group(); id.name = 'idler_' + side;
    id.position.set(sx * D.trackX, D.idler.y, D.idler.z);
    const ig = new THREE.CylinderGeometry(D.idler.r, D.idler.r, 0.34, 20); ig.rotateZ(Math.PI / 2);
    id.add(mesh(ig, steel));
    for (let k = 0; k < 4; k++) { const b = mesh(bolt, olive); const a = k / 4 * Math.PI * 2; b.position.set(0, Math.cos(a) * 0.15, Math.sin(a) * 0.15); id.add(b); }
    root.add(id);
    /* 상부 지지 롤러 */
    for (const z of [-1.4, 0, 1.4]) { const rg = new THREE.CylinderGeometry(0.075, 0.075, 0.3, 10); rg.rotateZ(Math.PI / 2); const rr = mesh(rg, steel); rr.position.set(sx * D.trackX, 0.9, z); root.add(rr); }
  }

  /* ── 포탑 ── */
  const turret = new THREE.Group(); turret.name = 'turret';
  turret.position.set(0, D.turretY, D.turretZ);
  root.add(turret);
  {
    const s = new THREE.Shape();
    [[-0.52, 1.2], [0.52, 1.2], [1.05, 0.58], [1.12, -0.85], [0.86, -1.45], [-0.86, -1.45], [-1.12, -0.85], [-1.05, 0.58]]
      .forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z));
    const g = ext(s, 0.42, 0.09); g.rotateX(-Math.PI / 2); g.translate(0, 0.09, 0);
    turret.add(mesh(g, olive, 'turret_body'));
    const ring = new THREE.CylinderGeometry(0.98, 1.02, 0.12, 28);
    const rm = mesh(ring, oliveDk); rm.position.y = 0.02; turret.add(rm);
    /* 뒤 짐바구니 */
    const basket = mesh(new THREE.BoxGeometry(1.7, 0.3, 0.45), oliveDk); basket.position.set(0, 0.36, -1.72); turret.add(basket);
    const roll = mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.5, 10), new THREE.MeshStandardMaterial({ color: 0x6b6044, roughness: 0.95 }));
    roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.62, -1.72); turret.add(roll);
    /* 연막탄 발사기 */
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
      const c = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), steel);
      c.rotation.x = -1.0; c.rotation.z = sx * 0.4; c.position.set(sx * (0.9 + k * 0.07), 0.45, 0.55 - k * 0.12); turret.add(c);
    }
    /* 전차장 큐폴라(열린 해치) — seat 이 여기 있다 */
    const cup = mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.24, 18, 1, true), oliveDk); cup.position.set(0.42, 0.62, -0.45); turret.add(cup);
    const rim = mesh(new THREE.TorusGeometry(0.35, 0.035, 6, 20), steel); rim.rotation.x = Math.PI / 2; rim.position.set(0.42, 0.74, -0.45); turret.add(rim);
    const lid = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.05, 18), olive); lid.rotation.x = Math.PI / 2 - 0.25; lid.position.set(0.42, 1.02, -0.86); turret.add(lid);
    for (let k = 0; k < 5; k++) { const v = mesh(new THREE.BoxGeometry(0.1, 0.06, 0.06), vision); const a = k / 5 * Math.PI * 1.4 - 0.7; v.position.set(0.42 + Math.sin(a) * 0.35, 0.66, -0.45 + Math.cos(a) * 0.35); v.rotation.y = a; turret.add(v); }
    /* 탄약수 해치(닫힘) · 기관총 */
    const lh = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16), oliveDk); lh.position.set(-0.42, 0.55, -0.3); turret.add(lh);
    const mg = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), steel); mg.rotation.x = Math.PI / 2; mg.position.set(-0.42, 0.72, 0.1); turret.add(mg);
    const mgb = mesh(new THREE.BoxGeometry(0.12, 0.14, 0.4), steel); mgb.position.set(-0.42, 0.7, -0.25); turret.add(mgb);
    /* 안테나 (vehicles.js 가 가속에 맞춰 흔든다) */
    const ant = new THREE.Group(); ant.name = 'antenna'; ant.position.set(-0.75, 0.55, -1.15);
    const ab = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8), steel); ant.add(ab);
    const aw = mesh(new THREE.CylinderGeometry(0.008, 0.014, 2.3, 5), steel); aw.position.y = 1.15; ant.add(aw);
    turret.add(ant);
    /* 전차장 엉덩이 자리: 큐폴라 테두리보다 조금 아래 → 허리부터 위만 보인다 */
    const seat = new THREE.Object3D(); seat.name = 'seat'; seat.position.set(0.42, 0.52, -0.45); turret.add(seat);
  }

  /* ── 포신 ── */
  const barrel = new THREE.Group(); barrel.name = 'barrel';
  barrel.position.set(0, 0.3, 1.12);
  turret.add(barrel);
  {
    const mant = mesh(new THREE.BoxGeometry(0.86, 0.46, 0.4), olive); mant.position.z = 0.08; barrel.add(mant);
    const sl = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.4, 14), oliveDk); sl.rotation.x = Math.PI / 2; sl.position.z = 0.42; barrel.add(sl);
    const tube = mesh(new THREE.CylinderGeometry(0.075, 0.09, 3.3, 14), oliveDk); tube.rotation.x = Math.PI / 2; tube.position.z = 0.55 + 1.65; barrel.add(tube);
    const fume = mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.5, 14), olive); fume.rotation.x = Math.PI / 2; fume.position.z = 2.15; barrel.add(fume);
    const brake = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.32, 10), steel); brake.rotation.x = Math.PI / 2; brake.position.z = 3.95; barrel.add(brake);
    const muzzle = new THREE.Object3D(); muzzle.name = 'muzzle'; muzzle.position.z = 4.12; barrel.add(muzzle);
  }
  return root;
}

/* ════════════════════════════════════════════════════════════
   2) 효과 · 소리
   ════════════════════════════════════════════════════════════ */
const SHELL_SPEED = 46, SHELL_G = 14;   // 탄도: 보이는 포물선이 나오게 실제보다 느리고 중력은 세게
export const TANK_BALLISTICS = { speed: SHELL_SPEED, g: SHELL_G };

/* 화면 정렬 사각형 입자 (InstancedBufferGeometry, 크기 제한 없음).
   연기 색은 sRGB 감각으로 넣고 셰이더에서 제곱해 선형으로 바꾼다 (불은 HDR 값 그대로) */
function makeParticles(THREE, cap, tex, additive) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  const off = new Float32Array(cap * 3), col = new Float32Array(cap * 3), misc = new Float32Array(cap * 3);
  const aOff = new THREE.InstancedBufferAttribute(off, 3), aCol = new THREE.InstancedBufferAttribute(col, 3), aMisc = new THREE.InstancedBufferAttribute(misc, 3);
  for (const a of [aOff, aCol, aMisc]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aOff', aOff); geo.setAttribute('aCol', aCol); geo.setAttribute('aMisc', aMisc);
  geo.instanceCount = 0;
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uShade: { value: 1 } }]);
  uniforms.map = { value: tex };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `
      attribute vec3 aOff; attribute vec3 aCol; attribute vec3 aMisc;
      varying vec2 vUv; varying vec3 vCol; varying float vA;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv; vCol = aCol; vA = aMisc.y;
        vec4 mvPosition = modelViewMatrix * vec4(aOff, 1.0);
        float c = cos(aMisc.z), s = sin(aMisc.z);
        mvPosition.xy += vec2(c * position.x - s * position.y, s * position.x + c * position.y) * aMisc.x;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float uShade;
      varying vec2 vUv; varying vec3 vCol; varying float vA;
      #include <fog_pars_fragment>
      void main() {
        vec4 t = texture2D(map, vUv);
        ${additive ? 'gl_FragColor = vec4(vCol * t.rgb, t.a * vA);' : 'gl_FragColor = vec4(vCol * vCol * mix(0.55, 1.0, t.r) * uShade, t.a * vA);'}
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        ${additive ? '' : '#include <fog_fragment>'}
      }`
  });
  const pts = new THREE.Mesh(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = additive ? 6 : 5;
  /* 시뮬레이션 상태 (평면 배열) */
  const S = {
    mesh: pts, mat, cap, n: 0, aOff, aCol, aMisc, off, col, misc,
    p: new Float32Array(cap * 3), v: new Float32Array(cap * 3),
    age: new Float32Array(cap), life: new Float32Array(cap), s0: new Float32Array(cap), s1: new Float32Array(cap),
    a0: new Float32Array(cap), c0: new Float32Array(cap * 3), c1: new Float32Array(cap * 3),
    drag: new Float32Array(cap), grav: new Float32Array(cap), rot: new Float32Array(cap), rotV: new Float32Array(cap),
    fadeIn: new Float32Array(cap)
  };
  return S;
}
function pSpawn(S, x, y, z, vx, vy, vz, life, s0, s1, a0, r0, g0, b0, r1, g1, b1, drag, grav, fadeIn) {
  let i = S.n;
  if (i >= S.cap) i = (Math.random() * S.cap) | 0;   // 꽉 차면 아무거나 덮어쓴다
  else S.n++;
  const i3 = i * 3;
  S.p[i3] = x; S.p[i3 + 1] = y; S.p[i3 + 2] = z;
  S.v[i3] = vx; S.v[i3 + 1] = vy; S.v[i3 + 2] = vz;
  S.age[i] = 0; S.life[i] = life; S.s0[i] = s0; S.s1[i] = s1; S.a0[i] = a0;
  S.c0[i3] = r0; S.c0[i3 + 1] = g0; S.c0[i3 + 2] = b0;
  S.c1[i3] = r1; S.c1[i3 + 1] = g1; S.c1[i3 + 2] = b1;
  S.drag[i] = drag; S.grav[i] = grav; S.rot[i] = Math.random() * 6.283; S.rotV[i] = (Math.random() - 0.5) * 1.2;
  S.fadeIn[i] = fadeIn;
}
function pCopy(S, d, s) {
  const d3 = d * 3, s3 = s * 3;
  for (let k = 0; k < 3; k++) { S.p[d3 + k] = S.p[s3 + k]; S.v[d3 + k] = S.v[s3 + k]; S.c0[d3 + k] = S.c0[s3 + k]; S.c1[d3 + k] = S.c1[s3 + k]; }
  S.age[d] = S.age[s]; S.life[d] = S.life[s]; S.s0[d] = S.s0[s]; S.s1[d] = S.s1[s]; S.a0[d] = S.a0[s];
  S.drag[d] = S.drag[s]; S.grav[d] = S.grav[s]; S.rot[d] = S.rot[s]; S.rotV[d] = S.rotV[s]; S.fadeIn[d] = S.fadeIn[s];
}
function pUpdate(S, dt, groundY) {
  let i = 0;
  while (i < S.n) {
    S.age[i] += dt;
    if (S.age[i] >= S.life[i]) { S.n--; if (i !== S.n) pCopy(S, i, S.n); continue; }
    const i3 = i * 3, dr = Math.exp(-S.drag[i] * dt);
    S.v[i3] *= dr; S.v[i3 + 1] = S.v[i3 + 1] * dr - S.grav[i] * dt; S.v[i3 + 2] *= dr;
    S.p[i3] += S.v[i3] * dt; S.p[i3 + 1] += S.v[i3 + 1] * dt; S.p[i3 + 2] += S.v[i3 + 2] * dt;
    if (S.grav[i] > 0 && groundY) {   // 무거운 입자(불꽃·흙)는 땅에서 멈춘다
      const gy = groundY(S.p[i3], S.p[i3 + 2]) + 0.05;
      if (S.p[i3 + 1] < gy) { S.p[i3 + 1] = gy; S.v[i3 + 1] *= -0.25; S.v[i3] *= 0.5; S.v[i3 + 2] *= 0.5; }
    }
    S.rot[i] += S.rotV[i] * dt;
    const t = S.age[i] / S.life[i];
    S.off[i3] = S.p[i3]; S.off[i3 + 1] = S.p[i3 + 1]; S.off[i3 + 2] = S.p[i3 + 2];
    const e = 1 - (1 - t) * (1 - t);   // 크기는 빨리 커졌다가 천천히
    S.misc[i3] = S.s0[i] + (S.s1[i] - S.s0[i]) * e;
    const fi = S.fadeIn[i] > 0 ? Math.min(1, S.age[i] / S.fadeIn[i]) : 1;
    S.misc[i3 + 1] = S.a0[i] * fi * (1 - t) * (1 - t * 0.5);
    S.misc[i3 + 2] = S.rot[i];
    S.col[i3] = S.c0[i3] + (S.c1[i3] - S.c0[i3]) * t;
    S.col[i3 + 1] = S.c0[i3 + 1] + (S.c1[i3 + 1] - S.c0[i3 + 1]) * t;
    S.col[i3 + 2] = S.c0[i3 + 2] + (S.c1[i3 + 2] - S.c0[i3 + 2]) * t;
    i++;
  }
  S.mesh.geometry.instanceCount = S.n;
  S.mesh.visible = S.n > 0;
  if (S.n) { S.aOff.needsUpdate = true; S.aCol.needsUpdate = true; S.aMisc.needsUpdate = true; }
}

export function createTankFX({ THREE, scene, groundY = null, getNpcs = null, toyBlocks = null, explode = null, audio = null }) {
  const gy = (x, z) => (groundY ? groundY(x, z) : 0);
  const R = Math.random;

  /* 텍스처 */
  const puff = canvasTex(THREE, 128, 128, (c, w) => {
    const r = rng(3);
    for (let i = 0; i < 14; i++) {   // 뭉게뭉게 겹친 원
      const x = w / 2 + (r() - 0.5) * w * 0.34, y = w / 2 + (r() - 0.5) * w * 0.34, rad = w * (0.16 + r() * 0.16);
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      const v = 200 + (r() * 55) | 0;
      g.addColorStop(0, `rgba(${v},${v},${v},0.55)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      c.fillStyle = g; c.fillRect(0, 0, w, w);
    }
  }, false);
  const glow = canvasTex(THREE, 64, 64, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
  }, false);
  const flameTex = canvasTex(THREE, 64, 128, (c, w, h) => {   // 포구 화염 (아래=포구, 위로 뾰족)
    const g = c.createRadialGradient(w / 2, h * 0.85, 0, w / 2, h * 0.7, h * 0.7);
    g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.3, 'rgba(255,200,90,.9)'); g.addColorStop(1, 'rgba(255,90,20,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(w / 2, 0); c.quadraticCurveTo(w, h * 0.7, w / 2, h); c.quadraticCurveTo(0, h * 0.7, w / 2, 0); c.fill();
  }, false);
  const scorchTex = canvasTex(THREE, 256, 256, (c, w) => {
    const r = rng(11);
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.92)'); g.addColorStop(0.45, 'rgba(10,8,6,0.75)'); g.addColorStop(0.8, 'rgba(20,16,12,0.25)'); g.addColorStop(1, 'rgba(20,16,12,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineCap = 'round';   // 사방으로 튄 그을음 줄
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, l0 = w * 0.18, l1 = w * (0.3 + r() * 0.18);
      c.lineWidth = 2 + r() * 6; c.beginPath();
      c.moveTo(w / 2 + Math.cos(a) * l0, w / 2 + Math.sin(a) * l0); c.lineTo(w / 2 + Math.cos(a) * l1, w / 2 + Math.sin(a) * l1); c.stroke();
    }
  }, false);
  const ringTex = canvasTex(THREE, 128, 128, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, w * 0.3, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
  }, false);

  const smoke = makeParticles(THREE, 900, puff, false);
  const fire = makeParticles(THREE, 500, glow, true);
  scene.add(smoke.mesh, fire.mesh);

  /* 연기 밝기: 씬의 반구광·방향광 세기로 낮/밤을 짐작한다 (밤에 회색 연기가 빛나 보이지 않게) */
  const ambLights = [];
  scene.traverse(o => { if (o.isHemisphereLight || o.isAmbientLight || (o.isDirectionalLight)) ambLights.push(o); });
  function shadeLevel() {
    let s = 0;
    for (let i = 0; i < ambLights.length; i++) { const l = ambLights[i]; s += l.intensity * (l.isDirectionalLight ? 0.5 : 1); }
    return ambLights.length ? Math.max(0.28, Math.min(1.05, s / 1.7)) : 1;
  }

  /* 파편 (흙덩이·돌) */
  const DEB = 140;
  const debMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x4a3c2c, roughness: 0.95 }), DEB);
  debMesh.castShadow = true; debMesh.frustumCulled = false; debMesh.count = 0;
  debMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(debMesh);
  const deb = { n: 0, p: new Float32Array(DEB * 3), v: new Float32Array(DEB * 3), r: new Float32Array(DEB * 3), w: new Float32Array(DEB * 3), s: new Float32Array(DEB), age: new Float32Array(DEB), rest: new Uint8Array(DEB) };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _sc = new THREE.Vector3(), _p = new THREE.Vector3();

  /* 충격파 고리 · 그을음 자국 · 섬광 구 */
  const rings = [], scorches = [], flashes = [];
  const ringGeo = new THREE.PlaneGeometry(1, 1); ringGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: ringTex, color: 0xffd8a8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    m.visible = false; m.renderOrder = 4; scene.add(m); rings.push({ m, t: 1 });
  }
  const scGeo = new THREE.PlaneGeometry(1, 1); scGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(scGeo, new THREE.MeshLambertMaterial({ map: scorchTex, color: 0xffffff, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    m.visible = false; m.receiveShadow = true; m.renderOrder = 1; scene.add(m); scorches.push({ m, t: 1e9, k: 0 });
  }
  let scorchNext = 0;
  const flashGeo = new THREE.SphereGeometry(1, 16, 12);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.75, 0.4).multiplyScalar(4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    m.visible = false; m.renderOrder = 7; scene.add(m); flashes.push({ m, t: 1 });
  }

  /* 포구 화염 — 십자 평면 2장 + 정면 원 */
  const muzzleFlash = new THREE.Group();
  {
    const fm = new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide, color: new THREE.Color(1, 0.85, 0.6).multiplyScalar(3), fog: false });
    const pg = new THREE.PlaneGeometry(0.9, 2.2); pg.rotateX(Math.PI / 2); pg.translate(0, 0, 1.0);   // 포구에서 +Z 로 뻗는다
    const a = new THREE.Mesh(pg, fm), b = new THREE.Mesh(pg, fm); b.rotation.z = Math.PI / 2;
    const dm = new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color(1, 0.8, 0.5).multiplyScalar(4), fog: false });
    const d = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), dm); d.position.z = 0.2;
    muzzleFlash.add(a, b, d);
    muzzleFlash.traverse(o => { o.renderOrder = 8; });
    muzzleFlash.visible = false;
    scene.add(muzzleFlash);
  }
  let flashT = 1, flashDisc = muzzleFlash.children[2];

  /* 포탄 (최대 4발 동시) */
  const shells = [];
  {
    const body = new THREE.CylinderGeometry(0.06, 0.06, 0.38, 10); body.rotateX(Math.PI / 2);
    const tip = new THREE.ConeGeometry(0.06, 0.16, 10); tip.rotateX(Math.PI / 2); tip.translate(0, 0, 0.27);
    const sm = new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.6, roughness: 0.35 });
    const tr = new THREE.PlaneGeometry(0.26, 2.2); tr.rotateX(Math.PI / 2); tr.translate(0, 0, -1.0);
    const tm = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(1, 0.6, 0.25).multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide, fog: false });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(body, sm), new THREE.Mesh(tip, sm));
      const a = new THREE.Mesh(tr, tm), b = new THREE.Mesh(tr, tm); b.rotation.z = Math.PI / 2;
      g.add(a, b);
      g.visible = false; scene.add(g);
      shells.push({ g, alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, trail: 0 });
    }
  }

  /* 카메라 흔들림 */
  const shake = { amp: 0, t: 0, off: new THREE.Vector3(), roll: 0 };
  let listener = null;   // 소리 거리 계산용 (카메라 위치)

  /* ── 소리 ── */
  if (!audio) audio = createTankAudio();

  /* ── 폭발 ── */
  const _imp = new THREE.Vector3(), _ep = new THREE.Vector3();
  function addShake(a) { shake.amp = Math.min(1.6, shake.amp + a); }

  function localExplode(pos, radius = 6, force = 1) {
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return;
    const x = pos.x, z = pos.z, y0 = gy(x, z), y = Number.isFinite(pos.y) ? Math.max(pos.y, y0) : y0;
    const shade = shadeLevel();
    /* 섬광 구 */
    for (const f of flashes) if (f.t >= 1) { f.t = 0; f.m.position.set(x, y + 0.6, z); f.m.visible = true; break; }
    /* 불덩이 */
    for (let i = 0; i < 46; i++) {
      const a = R() * 6.283, el = R() * 1.2, sp = 2 + R() * 7;
      pSpawn(fire, x + (R() - 0.5) * 0.8, y + 0.4 + R() * 0.8, z + (R() - 0.5) * 0.8,
        Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp + 2.5, Math.sin(a) * Math.cos(el) * sp,
        0.35 + R() * 0.45, 0.7 + R() * 0.6, 1.9 + R() * 1.4, 1,
        4.0, 2.4, 0.9, 1.6, 0.35, 0.08, 3.2, -1.5, 0.02);
    }
    /* 불똥 */
    for (let i = 0; i < 40; i++) {
      const a = R() * 6.283, sp = 6 + R() * 12;
      pSpawn(fire, x, y + 0.5, z, Math.cos(a) * sp * 0.7, 5 + R() * 10, Math.sin(a) * sp * 0.7,
        0.7 + R() * 0.9, 0.12, 0.05, 1, 4, 2.6, 1.1, 2.2, 0.6, 0.1, 0.6, 14, 0);
    }
    /* 연기 기둥 (검은 연기가 위로 솟으며 퍼진다) */
    for (let i = 0; i < 42; i++) {
      const a = R() * 6.283, rr = R() * 1.2, up = 1.5 + R() * 5;
      const c0 = (0.1 + R() * 0.06) * shade, c1 = (0.32 + R() * 0.1) * shade;
      pSpawn(smoke, x + Math.cos(a) * rr, y + 0.6 + R() * 1.5, z + Math.sin(a) * rr,
        Math.cos(a) * (1 + R() * 2), up, Math.sin(a) * (1 + R() * 2),
        3.5 + R() * 3.5, 1.4 + R(), 4.5 + R() * 3.5, 0.85,
        c0, c0 * 0.95, c0 * 0.9, c1, c1, c1 * 0.97, 0.9, -0.35, 0.15);
    }
    /* 땅을 따라 퍼지는 흙먼지 고리 */
    for (let i = 0; i < 30; i++) {
      const a = i / 30 * 6.283 + R() * 0.2, sp = 7 + R() * 5;
      const c = 0.42 * shade;
      pSpawn(smoke, x + Math.cos(a) * 0.8, y + 0.3, z + Math.sin(a) * 0.8, Math.cos(a) * sp, 0.4 + R(), Math.sin(a) * sp,
        1.8 + R() * 1.4, 0.8, 2.6 + R() * 1.4, 0.7, c, c * 0.88, c * 0.7, c * 1.1, c, c * 0.85, 2.2, -0.1, 0.05);
    }
    /* 파편 */
    for (let i = 0; i < 26; i++) {
      let k = deb.n < DEB ? deb.n++ : (R() * DEB) | 0;
      const k3 = k * 3, a = R() * 6.283, sp = 3 + R() * 8;
      deb.p[k3] = x + (R() - 0.5) * 0.6; deb.p[k3 + 1] = y + 0.3; deb.p[k3 + 2] = z + (R() - 0.5) * 0.6;
      deb.v[k3] = Math.cos(a) * sp; deb.v[k3 + 1] = 5 + R() * 9; deb.v[k3 + 2] = Math.sin(a) * sp;
      deb.r[k3] = R() * 6; deb.r[k3 + 1] = R() * 6; deb.r[k3 + 2] = R() * 6;
      deb.w[k3] = (R() - 0.5) * 18; deb.w[k3 + 1] = (R() - 0.5) * 18; deb.w[k3 + 2] = (R() - 0.5) * 18;
      deb.s[k] = 0.05 + R() * 0.12; deb.age[k] = 0; deb.rest[k] = 0;
    }
    /* 충격파 고리 */
    for (const r of rings) if (r.t >= 1) { r.t = 0; r.m.position.set(x, y0 + 0.15, z); r.m.visible = true; break; }
    /* 그을음 자국 — 경사에 맞춰 눕힌다 */
    {
      const s = scorches[scorchNext]; scorchNext = (scorchNext + 1) % scorches.length;
      const e = 0.6, hx = gy(x + e, z) - gy(x - e, z), hz = gy(x, z + e) - gy(x, z - e);
      _p.set(-hx, 2 * e, -hz).normalize();
      _q.setFromUnitVectors(_sc.set(0, 1, 0), _p);
      s.m.quaternion.copy(_q);
      s.m.rotateY(R() * 6.283);
      const size = 3.6 + R() * 1.4;
      s.m.scale.set(size, 1, size);
      s.m.position.set(x, y0 + 0.03, z);
      s.t = 0; s.m.visible = true; s.m.material.opacity = 0.95;
    }
    /* 손님 넘어뜨리기 */
    const api = getNpcs ? getNpcs() : null;
    if (api && api.list && api.knockDown) {
      const list = api.list();
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        const dx = o.pos.x - x, dz = o.pos.z - z, dy = o.pos.y - y0;
        const d = Math.sqrt(dx * dx + dz * dz + dy * dy * 0.5);
        if (!(d <= radius)) continue;
        const k = 1 - d / radius, h = Math.hypot(dx, dz) || 1;
        _imp.set(dx / h * (3 + 8 * k) * force, (3.5 + 6 * k) * force, dz / h * (3 + 8 * k) * force);
        api.knockDown(o.npc, _imp, 'explosion');
      }
    }
    /* 장난감 블록·의자 */
    if (toyBlocks) {
      for (let i = 0; i < toyBlocks.length; i++) {
        const b = toyBlocks[i].body;
        if (!b || !(b.mass > 0)) continue;
        const dx = b.position.x - x, dy = b.position.y - y0, dz = b.position.z - z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const rr = radius * 1.25;
        if (d > rr) continue;
        const k = 1 - d / rr, inv = 1 / (d || 1);
        const dv = Math.min(16, 26 * k * force / Math.sqrt(b.mass));
        b.velocity.x += dx * inv * dv; b.velocity.z += dz * inv * dv;
        b.velocity.y += dv * 0.7 + 2 * k;
        b.angularVelocity.x += (R() - 0.5) * 14 * k; b.angularVelocity.y += (R() - 0.5) * 8 * k; b.angularVelocity.z += (R() - 0.5) * 14 * k;
        if (b.wakeUp) b.wakeUp();
      }
    }
    /* 흔들림 · 소리 (거리에 따라) */
    const ld = listener ? Math.hypot(listener.x - x, listener.y - y, listener.z - z) : 15;
    addShake(1.3 * Math.max(0, 1 - ld / 55) * force);
    audio.explosion(ld);
  }
  const doExplode = (p, r, f) => (explode ? explode(p, r, f) : localExplode(p, r, f));

  /* ── 발사 ── */
  function fire_(muzzlePos, dir, inheritVel) {
    let s = null;
    for (const sh of shells) if (!sh.alive) { s = sh; break; }
    if (!s) { s = shells[0]; }
    s.alive = true; s.t = 0; s.trail = 0;
    s.p.copy(muzzlePos);
    s.v.copy(dir).multiplyScalar(SHELL_SPEED);
    if (inheritVel) s.v.add(inheritVel);
    s.g.position.copy(s.p); s.g.visible = true;
    /* 포구 화염 */
    flashT = 0; muzzleFlash.visible = true;
    muzzleFlash.position.copy(muzzlePos);
    _p.copy(muzzlePos).add(dir);
    muzzleFlash.lookAt(_p);
    muzzleFlash.scale.setScalar(0.9 + R() * 0.4);
    flashDisc.rotation.z = R() * 6.283;
    const shade = shadeLevel();
    const mx = muzzlePos.x, my = muzzlePos.y, mz = muzzlePos.z;
    /* 앞으로 뿜는 불 */
    for (let i = 0; i < 14; i++) {
      const sp = 6 + R() * 14;
      pSpawn(fire, mx, my, mz, dir.x * sp + (R() - 0.5) * 2, dir.y * sp + (R() - 0.5) * 2, dir.z * sp + (R() - 0.5) * 2,
        0.12 + R() * 0.12, 0.4, 1.1 + R() * 0.6, 1, 4, 2.8, 1.2, 1.8, 0.5, 0.1, 6, 0, 0);
    }
    /* 포구 연기: 앞으로 + 포구 제퇴기 양옆으로 */
    for (let i = 0; i < 26; i++) {
      const side = i % 3 === 0 ? 0 : (i % 3 === 1 ? 1 : -1);
      const sp = side ? 3 + R() * 4 : 5 + R() * 9;
      const px = side ? dir.z * side : dir.x, pz = side ? -dir.x * side : dir.z;
      const c = (0.5 + R() * 0.12) * shade;
      pSpawn(smoke, mx, my, mz, px * sp + (R() - 0.5), (side ? 0 : dir.y * sp) + R() * 0.8, pz * sp + (R() - 0.5),
        1.6 + R() * 1.8, 0.4, 2.2 + R() * 1.6, 0.6, c, c, c * 0.98, c * 1.05, c * 1.05, c, 2.4, -0.25, 0.04);
    }
    /* 포 아래 땅의 먼지가 확 퍼진다 */
    const gx = mx - dir.x * 1.5, gz = mz - dir.z * 1.5, g0 = gy(gx, gz);
    for (let i = 0; i < 18; i++) {
      const a = R() * 6.283, sp = 3 + R() * 4, c = 0.48 * shade;
      pSpawn(smoke, gx + Math.cos(a) * 1.5, g0 + 0.25, gz + Math.sin(a) * 1.5, Math.cos(a) * sp + dir.x * 3, 0.3, Math.sin(a) * sp + dir.z * 3,
        1.4 + R(), 0.7, 2.2, 0.45, c, c * 0.9, c * 0.75, c, c * 0.92, c * 0.8, 2.5, -0.05, 0.05);
    }
    addShake(0.35);
    audio.fire();
  }

  /* ── 매 프레임 ── */
  const SHELL_HIT_R2 = 0.8 * 0.8;
  function hitTest(p) {
    if (toyBlocks) for (let i = 0; i < toyBlocks.length; i++) {
      const b = toyBlocks[i].body; if (!b) continue;
      const dx = b.position.x - p.x, dy = b.position.y - p.y, dz = b.position.z - p.z;
      if (dx * dx + dy * dy + dz * dz < 1.1) return true;
    }
    const api = getNpcs ? getNpcs() : null;
    if (api && api.list) {
      const list = api.list();
      for (let i = 0; i < list.length; i++) {
        const o = list[i].pos, dx = o.x - p.x, dz = o.z - p.z, dy = p.y - o.y;
        if (dy > -0.2 && dy < 2.0 && dx * dx + dz * dz < SHELL_HIT_R2) return true;
      }
    }
    return false;
  }

  function update(dt, cam) {
    if (cam) listener = cam.position;
    const shadeK = shadeLevel();
    smoke.mat.uniforms.uShade.value = 0.75 + 0.25 * shadeK;   // 이미 만든 연기 색에도 조금 반영

    /* 포탄 */
    for (const s of shells) {
      if (!s.alive) continue;
      s.t += dt;
      const sub = 3, h = dt / sub;
      let boom = false;
      for (let k = 0; k < sub && !boom; k++) {
        s.v.y -= SHELL_G * h;
        s.p.addScaledVector(s.v, h);
        const g = gy(s.p.x, s.p.z);
        if (s.p.y <= g) { s.p.y = g; boom = true; }
        else if (s.t > 0.06 && hitTest(s.p)) boom = true;
      }
      if (s.t > 5) boom = true;
      s.g.position.copy(s.p);
      _p.copy(s.p).add(s.v);
      s.g.lookAt(_p);
      /* 연기 꼬리 */
      s.trail += dt;
      while (s.trail > 0.012) {
        s.trail -= 0.012;
        const c = 0.7 * shadeK;
        pSpawn(smoke, s.p.x - s.v.x * s.trail, s.p.y - s.v.y * s.trail, s.p.z - s.v.z * s.trail, (R() - 0.5) * 0.3, 0.2, (R() - 0.5) * 0.3,
          0.7 + R() * 0.5, 0.18, 0.7, 0.35, c, c, c, c, c, c, 1.5, -0.2, 0.02);
      }
      if (boom) {
        s.alive = false; s.g.visible = false;
        _ep.copy(s.p);
        doExplode(_ep, 6, 1);
      }
    }

    /* 포구 화염 */
    if (muzzleFlash.visible) {
      flashT += dt;
      const k = 1 - flashT / 0.075;
      if (k <= 0) muzzleFlash.visible = false;
      else muzzleFlash.scale.setScalar((0.8 + (1 - k) * 0.6));
    }
    /* 섬광 구 */
    for (const f of flashes) {
      if (f.t >= 1) continue;
      f.t += dt / 0.22;
      if (f.t >= 1) { f.m.visible = false; continue; }
      f.m.scale.setScalar(1.0 + f.t * 3.0);
      f.m.material.opacity = (1 - f.t) * (1 - f.t);
    }
    /* 충격파 고리 */
    for (const r of rings) {
      if (r.t >= 1) continue;
      r.t += dt / 0.55;
      if (r.t >= 1) { r.m.visible = false; continue; }
      const s = 1 + Math.sqrt(r.t) * 22;
      r.m.scale.set(s, 1, s);
      r.m.material.opacity = (1 - r.t) * 0.8;
    }
    /* 그을음: 25초 그대로 → 5초에 걸쳐 사라짐 */
    for (const s of scorches) {
      if (!s.m.visible) continue;
      s.t += dt;
      if (s.t > 30) { s.m.visible = false; continue; }
      s.m.material.opacity = 0.95 * Math.min(1, (30 - s.t) / 5);
    }
    /* 입자 */
    pUpdate(smoke, dt, null);
    pUpdate(fire, dt, groundY ? gy : null);
    /* 파편 */
    let i = 0;
    while (i < deb.n) {
      deb.age[i] += dt;
      if (deb.age[i] > 4) {   // 다 쉬면 지운다 (마지막 것을 이 자리로)
        deb.n--;
        if (i !== deb.n) {
          const a = i * 3, b = deb.n * 3;
          for (let k = 0; k < 3; k++) { deb.p[a + k] = deb.p[b + k]; deb.v[a + k] = deb.v[b + k]; deb.r[a + k] = deb.r[b + k]; deb.w[a + k] = deb.w[b + k]; }
          deb.s[i] = deb.s[deb.n]; deb.age[i] = deb.age[deb.n]; deb.rest[i] = deb.rest[deb.n];
        }
        continue;
      }
      const i3 = i * 3;
      if (!deb.rest[i]) {
        deb.v[i3 + 1] -= 18 * dt;
        deb.p[i3] += deb.v[i3] * dt; deb.p[i3 + 1] += deb.v[i3 + 1] * dt; deb.p[i3 + 2] += deb.v[i3 + 2] * dt;
        deb.r[i3] += deb.w[i3] * dt; deb.r[i3 + 1] += deb.w[i3 + 1] * dt; deb.r[i3 + 2] += deb.w[i3 + 2] * dt;
        const g = gy(deb.p[i3], deb.p[i3 + 2]) + deb.s[i] * 0.6;
        if (deb.p[i3 + 1] < g) {
          deb.p[i3 + 1] = g;
          if (deb.v[i3 + 1] < -3) { deb.v[i3 + 1] *= -0.3; deb.v[i3] *= 0.5; deb.v[i3 + 2] *= 0.5; deb.w[i3] *= 0.5; deb.w[i3 + 2] *= 0.5; }
          else deb.rest[i] = 1;
        }
      }
      const fade = deb.age[i] > 3 ? 1 - (deb.age[i] - 3) : 1;
      _e.set(deb.r[i3], deb.r[i3 + 1], deb.r[i3 + 2]);
      _q.setFromEuler(_e);
      const s = deb.s[i] * fade;
      _sc.set(s, s * 0.75, s);
      _p.set(deb.p[i3], deb.p[i3 + 1], deb.p[i3 + 2]);
      _m.compose(_p, _q, _sc);
      debMesh.setMatrixAt(i, _m);
      i++;
    }
    debMesh.count = deb.n;
    if (deb.n) debMesh.instanceMatrix.needsUpdate = true;

    /* 흔들림 감쇠 */
    shake.t += dt;
    shake.amp *= Math.exp(-dt * 5);
    if (shake.amp < 0.002) shake.amp = 0;
    const a = shake.amp * shake.amp * 0.5;
    shake.off.set(
      (Math.sin(shake.t * 47) + Math.sin(shake.t * 83) * 0.5) * a,
      (Math.sin(shake.t * 59 + 1) + Math.sin(shake.t * 97) * 0.5) * a,
      (Math.sin(shake.t * 41 + 2) * 0.6) * a);
    shake.roll = Math.sin(shake.t * 37) * a * 0.04;
  }

  function applyShake(camera) {
    if (!camera || shake.amp <= 0) return;
    camera.position.add(shake.off);
    camera.rotateZ(shake.roll);
  }

  return {
    fire: fire_, update, applyShake, explode: localExplode, audio,
    get busy() { return smoke.n + fire.n + deb.n > 0; },
    dispose() {
      for (const o of [smoke.mesh, fire.mesh, debMesh, muzzleFlash, ...rings.map(r => r.m), ...scorches.map(s => s.m), ...flashes.map(f => f.m), ...shells.map(s => s.g)]) scene.remove(o);
      audio.dispose();
    }
  };
}

/* ════════════════════════════════════════════════════════════
   소리 — 전부 WebAudio 로 합성 (파일 없음)
   AudioContext 는 사용자 제스처(클릭·키) 안에서 unlock() 으로 만든다.
   ════════════════════════════════════════════════════════════ */
export function createTankAudio() {
  let ctx = null, master = null, noise = null, verbIn = null;
  let eng = null;   // 엔진 노드
  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch { return false; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0.55;
    master.connect(comp); comp.connect(ctx.destination);
    /* 흰 소음 2초 */
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    /* 간단한 메아리: 피드백 지연 + 저역 통과 */
    verbIn = ctx.createGain(); verbIn.gain.value = 0.32;
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.13;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    verbIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(master);
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }
  const ok = () => ctx && ctx.state === 'running';

  function boom(t0, { vol, lpFrom, lpTo, dur, sub, subFrom, subTo, crack }) {
    const src = ctx.createBufferSource(); src.buffer = noise; src.playbackRate.value = 0.8 + Math.random() * 0.3;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(lpFrom, t0); lp.frequency.exponentialRampToValueAtTime(lpTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t0 + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(lp); lp.connect(g); g.connect(master); g.connect(verbIn);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
    /* 낮은 쿵 */
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(subFrom, t0); o.frequency.exponentialRampToValueAtTime(subTo, t0 + sub);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(vol * 1.4, t0 + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t0 + sub);
    o.connect(og); og.connect(master);
    o.start(t0); o.stop(t0 + sub + 0.05);
    if (crack) {   // 날카로운 첫 '빵'
      const c = ctx.createBufferSource(); c.buffer = noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(crack, t0); cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      c.connect(hp); hp.connect(cg); cg.connect(master); cg.connect(verbIn);
      c.start(t0, Math.random()); c.stop(t0 + 0.12);
    }
  }

  return {
    unlock,
    get ready() { return ok(); },
    fire() {
      if (!ok()) return;
      boom(ctx.currentTime, { vol: 0.9, lpFrom: 5200, lpTo: 140, dur: 1.4, sub: 0.55, subFrom: 120, subTo: 32, crack: 0.7 });
    },
    explosion(dist = 15) {
      if (!ok()) return;
      const k = Math.max(0.12, Math.min(1, 14 / Math.max(6, dist)));
      const t0 = ctx.currentTime + Math.min(0.25, dist / 343);   // 멀면 소리가 조금 늦게
      boom(t0, { vol: 0.95 * k, lpFrom: 2600 * (0.5 + k * 0.5), lpTo: 90, dur: 2.3, sub: 0.9, subFrom: 85, subTo: 24, crack: 0.25 * k });
      /* 흙·파편 떨어지는 바스락 */
      const src = ctx.createBufferSource(); src.buffer = noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + 0.35); g.gain.linearRampToValueAtTime(0.08 * k, t0 + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.9);
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(t0 + 0.35, Math.random()); src.stop(t0 + 2);
    },
    reloaded() {   // 장전 완료 '철컥'
      if (!ok()) return;
      const t0 = ctx.currentTime;
      for (const [dt, f] of [[0, 900], [0.09, 620]]) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.12, t0 + dt + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.07);
        o.connect(bp); bp.connect(g); g.connect(master);
        o.start(t0 + dt); o.stop(t0 + dt + 0.09);
      }
    },
    /* 엔진: 매 프레임 목표값만 바꾼다. 업데이트가 멈추면(문서 뷰 등) 0.4초 뒤 스스로 꺼진다 */
    engine(level, speedAbs) {
      if (!ok()) return;
      if (!eng) {
        const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 34;
        const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 51.5;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 2;
        const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
        const nlp = ctx.createBiquadFilter(); nlp.type = 'bandpass'; nlp.frequency.value = 520; nlp.Q.value = 1.2;
        const clank = ctx.createGain(); clank.gain.value = 0;
        const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 6;   // 궤도 덜컥덜컥
        const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
        lfo.connect(lfoG); lfoG.connect(clank.gain);
        const g = ctx.createGain(); g.gain.value = 0;
        o1.connect(lp); o2.connect(lp); lp.connect(g);
        n.connect(nlp); nlp.connect(clank); clank.connect(g);
        g.connect(master);
        o1.start(); o2.start(); n.start(); lfo.start();
        eng = { o1, o2, lp, g, lfo, clank };
      }
      const t = ctx.currentTime;
      const f = 32 + speedAbs * 5.5;
      eng.o1.frequency.setTargetAtTime(f, t, 0.15);
      eng.o2.frequency.setTargetAtTime(f * 1.51, t, 0.15);
      eng.lp.frequency.setTargetAtTime(150 + speedAbs * 45, t, 0.2);
      eng.lfo.frequency.setTargetAtTime(2 + speedAbs * 2.2, t, 0.2);
      eng.clank.gain.setTargetAtTime(Math.min(0.35, speedAbs * 0.06) * level, t, 0.2);
      eng.g.gain.cancelScheduledValues(t);
      eng.g.gain.setTargetAtTime(0.14 * level, t, 0.18);
      eng.g.gain.setTargetAtTime(0, t + 0.4, 0.15);   // 다음 프레임이 안 오면 꺼짐
    },
    dispose() { if (ctx) { ctx.close().catch(() => {}); ctx = null; eng = null; } }
  };
}
