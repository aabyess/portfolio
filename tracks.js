/* ════════════════════════════════════════════════════════════
   눈 위 발자국 · 바퀴 자국 — 눈이 쌓여 있을 때(uSnow) 지나간 자리가 눌린다

   한 InstancedMesh 안에 납작한 사각형을 깔아 두고 고리처럼 돌려 쓴다(가장 오래된 것부터 재활용).
   무늬는 시작할 때 캔버스로 그린 2×2 아틀라스 하나 — 발자국 · 말발굽 · 넓은 바퀴 · 가는 바퀴.
   색을 칠하지 않고 밑에 있는 눈 색에 곱해서(곱하기 블렌딩) 어두워지게 한다.
   그래서 노을이든 밤이든 눈 밝기를 그대로 따라가고, 안개 속에선 같이 흐려진다.

   자국은 FULL초 동안 또렷하다가 FADE초쯤이면 새로 내린 눈에 덮여 사라진다.
   눈이 녹으면(uSnow↓) 남은 자국도 같이 옅어진다.

   탈것별 자국
     걷기      왼발·오른발 번갈아. 빨리 뛰면 보폭이 넓어진다
     자동차    뒷바퀴 두 줄
     말        네 발굽 (평보 4박자, 구보는 보폭이 길고 앞발·뒷발이 짝지어 찍힌다)
     마차      말발굽 + 바퀴 두 줄 (모델 기준 좌우 1.58 m)
     오토바이  바퀴 한 줄,  자전거  가는 바퀴 한 줄
   마을 사람(npcs)도 발자국을 남기지만 따로 떼어 둔 칸(NPC_N)만 쓴다.
   ════════════════════════════════════════════════════════════ */

const PLAYER_N = 1700, NPC_N = 500, N = PLAYER_N + NPC_N;
const FULL = 6, FADE = 22;              // 초
const MIN_SNOW = 0.1;                   // 이보다 눈이 적으면 새 자국을 만들지 않는다
const NPC_R = 45;                       // 플레이어에게서 이만큼 안의 마을 사람만

/* 아틀라스 칸 번호 */
const FOOT = 0, HOOF = 1, TYRE = 2, THIN = 3;

/* 탈것별 바퀴 자국 [좌우 x, 앞뒤 z, 폭, 칸] — 모델 원점 기준(앞이 +z) */
const WHEELS = {
  car: [[1.16, -1.36, 0.38, TYRE], [-1.16, -1.36, 0.38, TYRE]],
  carriage: [[0.79, -2.38, 0.14, THIN], [-0.79, -2.38, 0.14, THIN]],
  motorcycle: [[0, -0.7, 0.2, TYRE]],
  bicycle: [[0, -0.52, 0.09, THIN]],
  horse: []
};
/* 말발굽 [x, z] 순서: 왼뒤 · 왼앞 · 오른뒤 · 오른앞. 마차는 말이 앞(+z)에 있다 */
const HOOVES = {
  horse: { pts: [[0.12, -0.62], [0.12, 0.33], [-0.12, -0.62], [-0.12, 0.33]] },
  carriage: { pts: [[0.13, 1.2], [0.13, 2.12], [-0.13, 1.2], [-0.13, 2.12]] }
};
/* 발굽이 찍히는 박자(보폭 안에서의 위치). 평보는 4박자, 구보는 뒷발 둘·앞발 둘이 짝지어 */
const WALK_PH = [0, 0.25, 0.5, 0.75], GALLOP_PH = [0, 0.55, 0.1, 0.65];
const GALLOP_AT = { horse: 5.2, carriage: 4.2 };   // vehicles.js GAIT 와 같은 값

function makeAtlas() {
  const S = 256, H = S / 2, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.filter = 'blur(2px)';               // 가장자리를 부드럽게 (지원 안 하는 브라우저는 그냥 또렷하게)
  g.fillStyle = '#fff';
  /* 캔버스는 위가 v=1 → 칸 안에서 위쪽이 진행 방향(앞) */
  const cell = (i, draw) => { g.save(); g.translate((i % 2) * H, (i >> 1) * H); draw(); g.restore(); };
  /* 0 발자국: 앞꿈치 + 뒤꿈치 (오른발 모양, 왼발은 x를 뒤집어 쓴다) */
  cell(FOOT, () => {
    g.globalAlpha = 0.95;
    g.beginPath(); g.ellipse(H * 0.53, H * 0.34, H * 0.2, H * 0.27, 0.12, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(H * 0.47, H * 0.76, H * 0.15, H * 0.16, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.6;
    g.fillRect(H * 0.42, H * 0.52, H * 0.14, H * 0.14);
  });
  /* 1 말발굽: 편자(U자) 테두리를 진하게, 안쪽은 옅게 */
  cell(HOOF, () => {
    g.globalAlpha = 0.45;
    g.beginPath(); g.ellipse(H / 2, H * 0.48, H * 0.3, H * 0.34, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1; g.strokeStyle = '#fff'; g.lineWidth = H * 0.11;
    g.beginPath(); g.ellipse(H / 2, H * 0.48, H * 0.27, H * 0.31, 0, Math.PI * 0.82, Math.PI * 2.18); g.stroke();
  });
  /* 2 넓은 바퀴: 바탕 + 가로 홈(트레드). 위아래가 이어지게 같은 간격으로 */
  cell(TYRE, () => {
    g.globalAlpha = 0.55; g.fillRect(H * 0.1, -4, H * 0.8, H + 8);
    g.globalAlpha = 1;
    for (let k = 0; k < 4; k++) {
      const y = k * H / 4 + H / 16;
      g.fillRect(H * 0.12, y, H * 0.32, H / 12);
      g.fillRect(H * 0.56, y + H / 8, H * 0.32, H / 12);
    }
  });
  /* 3 가는 바퀴: 매끈한 홈 */
  cell(THIN, () => { g.globalAlpha = 0.85; g.fillRect(H * 0.22, -4, H * 0.56, H + 8); });
  return cv;
}

export function createTracks({ THREE, scene, uSnow, groundY, heightAt, canMark }) {
  /* ── 메시 ── */
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(Math.PI / 2);             // 바닥에 눕히고 v(위쪽)가 +z(앞)를 향하게
  const info = new Float32Array(N * 3); // 칸, 생긴 시각, 진하기
  for (let i = 0; i < N; i++) info[i * 3 + 1] = -1e4;
  const infoAttr = new THREE.InstancedBufferAttribute(info, 3);
  infoAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aInfo', infoAttr);

  const tex = new THREE.CanvasTexture(makeAtlas());
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  const uni = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uSnow: { value: 0 }, uTex: { value: null },
    uTint: { value: new THREE.Color(0.38, 0.42, 0.52) }   // 눌린 눈 — 파르스름한 회색
  }]);
  uni.uTex.value = tex;
  uni.uSnow = uSnow;                    // seasons.js 의 쌓인 눈 유니폼을 그대로 공유

  const mat = new THREE.ShaderMaterial({
    uniforms: uni, fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    /* 곱하기 블렌딩: 결과 = 자국색 × 밑에 그려진 눈 색 */
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
    vertexShader: `uniform float uTime; uniform float uSnow; attribute vec3 aInfo;
      varying vec2 vUv; varying float vA; varying float vFogDepth;
      void main(){
        float age = uTime - aInfo.y;
        vA = aInfo.z * smoothstep(0.0, 0.15, age) * (1.0 - smoothstep(${FULL.toFixed(1)}, ${FADE.toFixed(1)}, age))
           * smoothstep(0.05, 0.45, uSnow);
        float c = aInfo.x;
        vUv = vec2(mod(c, 2.0), 1.0 - floor(c / 2.0)) * 0.5 + (uv * 0.94 + 0.03) * 0.5;   // 2×2 아틀라스 칸 (캔버스 윗줄 = v 위쪽)
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vFogDepth = -mv.z;
        gl_Position = vA < 0.004 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;   // 다 덮인 자국은 그리지 않는다
      }`,
    fragmentShader: `uniform sampler2D uTex; uniform vec3 uTint; uniform float fogNear; uniform float fogFar;
      varying vec2 vUv; varying float vA; varying float vFogDepth;
      void main(){
        float s = min(1.0, texture2D(uTex, vUv).r * vA * 1.15);
        if (s < 0.01) discard;
        vec3 col = mix(vec3(1.0), uTint, s);
        col = mix(col, vec3(1.0), smoothstep(fogNear, fogFar, vFogDepth));   // 안개 속에선 효과가 사라진다
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < N; i++) mesh.setMatrixAt(i, zero);
  scene.add(mesh);

  /* ── 자국 하나 찍기 (할당 없이) ── */
  let time = 0, nextP = 0, nextN = 0, dirtyLo = N, dirtyHi = -1;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), p = new THREE.Vector3(),
    sc = new THREE.Vector3(), nrm = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function stamp(npc, x, z, yaw, w, len, cell, strength) {
    if (!canMark(x, z)) return;
    const i = npc ? PLAYER_N + nextN : nextP;
    if (npc) nextN = (nextN + 1) % NPC_N; else nextP = (nextP + 1) % PLAYER_N;
    /* 지형 기울기를 따라 눕힌다 */
    const e = 0.3;
    nrm.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
    q.setFromUnitVectors(UP, nrm).multiply(qy.setFromAxisAngle(UP, yaw));
    m4.compose(p.set(x, groundY(x, z) + 0.035, z), q, sc.set(w, 1, len));
    mesh.setMatrixAt(i, m4);
    info[i * 3] = cell; info[i * 3 + 1] = time; info[i * 3 + 2] = strength;
    if (i < dirtyLo) dirtyLo = i;
    if (i > dirtyHi) dirtyHi = i;
  }

  /* ── 걷는 사람 하나 (플레이어·마을 사람 공용) ── */
  const walker = () => ({ x: 0, z: 0, acc: 0, foot: 1, ok: false });
  function stepWalker(wk, npc, x, z, dt, scale) {
    if (!wk.ok) { wk.x = x; wk.z = z; wk.ok = true; return; }
    const dx = x - wk.x, dz = z - wk.z, d = Math.hypot(dx, dz);
    if (d > 3) { wk.x = x; wk.z = z; return; }           // 순간이동 · 승하차
    if (d < 1e-4) return;
    wk.acc += d; wk.x = x; wk.z = z;
    const v = d / Math.max(dt, 1e-3);
    const half = Math.min(0.75, 0.32 + v * 0.07) * scale; // 반 보폭: 걸으면 짧게, 뛰면 길게
    if (wk.acc < half) return;
    wk.acc = 0;
    wk.foot = -wk.foot;
    const yaw = Math.atan2(dx, dz), sx = Math.cos(yaw) * 0.13 * wk.foot, sz = -Math.sin(yaw) * 0.13 * wk.foot;
    stamp(npc, x + sx, z + sz, yaw, 0.2 * wk.foot * scale, 0.4 * scale, FOOT, npc ? 0.8 : 0.9);   // 실제보다 조금 크게 — 멀리서도 읽히게
  }

  /* ── 바퀴 한 줄: 일정 거리마다 지난 점에서 지금 점까지 한 조각 ── */
  const wheelState = Array.from({ length: 2 }, () => ({ x: 0, z: 0, ok: false }));
  function stepWheel(ws, x, z, w, cell, speedAbs) {
    if (!ws.ok) { ws.x = x; ws.z = z; ws.ok = true; return; }
    const dx = x - ws.x, dz = z - ws.z, d = Math.hypot(dx, dz);
    if (d > 3) { ws.x = x; ws.z = z; return; }
    const seg = Math.max(0.35, speedAbs * 0.05);
    if (d < seg) return;
    stamp(false, (x + ws.x) / 2, (z + ws.z) / 2, Math.atan2(dx, dz), w, d + 0.06, cell, 0.9);
    ws.x = x; ws.z = z;
  }

  /* ── 말발굽: 지나온 거리 D 를 보폭으로 나눈 박자마다 그 발굽 자리에 찍는다 ── */
  const hoof = { D: 0, last: [0, 0, 0, 0], ok: false, x: 0, z: 0 };
  function stepHooves(set, gallopAt, x, z, h, speedAbs) {
    if (!hoof.ok) { hoof.x = x; hoof.z = z; hoof.ok = true; hoof.D = 0; hoof.last.fill(0); return; }
    const d = Math.hypot(x - hoof.x, z - hoof.z);
    hoof.x = x; hoof.z = z;
    if (d > 3 || d < 1e-4) return;
    hoof.D += d;
    const gallop = speedAbs >= gallopAt, S = gallop ? 3.2 : 1.6, ph = gallop ? GALLOP_PH : WALK_PH;
    const c = Math.cos(h), s = Math.sin(h);
    for (let k = 0; k < 4; k++) {
      const beat = Math.floor(hoof.D / S + ph[k]);
      if (beat === hoof.last[k]) continue;
      hoof.last[k] = beat;
      const [lx, lz] = set.pts[k];
      stamp(false, x + lx * c + lz * s, z - lx * s + lz * c, h, 0.21, 0.23, HOOF, 0.9);
    }
  }

  /* ── 매 프레임 ── */
  const me = walker(), npcWalkers = [];
  let lastRide = '', lastMode = '';
  const resetRide = () => { for (const w of wheelState) w.ok = false; hoof.ok = false; me.ok = false; };

  /* inp: { mode, ride, heading, speed, car(Vector3), person(Vector3) } — portfolio.js 가 재사용하는 객체 */
  function update(dt, inp, npcs) {
    time += dt;
    uni.uTime.value = time;
    if (inp.ride !== lastRide || inp.mode !== lastMode) { lastRide = inp.ride; lastMode = inp.mode; resetRide(); }
    const snowy = uSnow.value > MIN_SNOW;
    if (snowy) {
      if (inp.mode === 'onfoot') stepWalker(me, false, inp.person.x, inp.person.z, dt, 1);
      else {
        const h = inp.heading, c = Math.cos(h), s = Math.sin(h), sp = Math.abs(inp.speed);
        const wl = WHEELS[inp.ride] || WHEELS.car;
        for (let k = 0; k < wl.length; k++) {
          const [lx, lz, w, cell] = wl[k];
          stepWheel(wheelState[k], inp.car.x + lx * c + lz * s, inp.car.z - lx * s + lz * c, w, cell, sp);
        }
        const hv = HOOVES[inp.ride];
        if (hv) stepHooves(hv, GALLOP_AT[inp.ride], inp.car.x, inp.car.z, h, sp);
      }
      if (npcs) {
        const px = inp.mode === 'onfoot' ? inp.person.x : inp.car.x, pz = inp.mode === 'onfoot' ? inp.person.z : inp.car.z;
        for (let i = 0; i < npcs.length; i++) {
          const n = npcs[i];
          const wk = npcWalkers[i] || (npcWalkers[i] = walker());
          if (!n.root || !n.root.visible || Math.abs(n.x - px) > NPC_R || Math.abs(n.z - pz) > NPC_R) { wk.ok = false; continue; }
          stepWalker(wk, true, n.x, n.z, dt, 0.95);
        }
      }
    } else { me.ok = false; resetRide(); for (const w of npcWalkers) w.ok = false; }

    if (dirtyHi >= 0) {
      const im = mesh.instanceMatrix;
      /* 바뀐 칸만 올린다. 렌더러가 올린 뒤 범위를 비우므로 여기서 지우지 않는다
         (그리기 전에 step 이 여러 번 돌면 앞 범위가 사라진다) */
      if (im.addUpdateRange) {
        im.addUpdateRange(dirtyLo * 16, (dirtyHi - dirtyLo + 1) * 16);
        infoAttr.addUpdateRange(dirtyLo * 3, (dirtyHi - dirtyLo + 1) * 3);
      }
      im.needsUpdate = true; infoAttr.needsUpdate = true;
      dirtyLo = N; dirtyHi = -1;
    }
  }

  function clear() {
    for (let i = 0; i < N; i++) info[i * 3 + 1] = -1e4;
    infoAttr.clearUpdateRanges?.();
    infoAttr.needsUpdate = true;
    nextP = nextN = 0;
  }
  /* 아직 보이는(덮이지 않은) 자국 수 */
  function count() {
    let c = 0;
    for (let i = 0; i < N; i++) if (time - info[i * 3 + 1] < FADE) c++;
    return c;
  }

  /* PM 확인용 — __tracks.count, __tracks.clear() */
  window.__tracks = { get count() { return count(); }, clear, get pool() { return N; }, mesh };

  return { update, clear, count, mesh };
}
