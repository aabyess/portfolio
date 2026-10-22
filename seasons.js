/* ════════════════════════════════════════════════════════════
   계절 순환 — 가을 → 겨울 → 봄 → 여름 → 다시 가을

   한 계절은 SEG초(60초). 각 계절 마지막 BLEND초(18초) 동안 다음 계절로 천천히 섞인다.
   시간축 u(0~240초)를 하나 두고 색·눈·낙엽을 전부 u의 함수로 정한다.
   그래서 jump()로 건너뛰어도 상태가 어긋나지 않는다.

     u   0 ─ 42  가을 그대로         42 ─ 60  겨울로 (낙엽이 줄고 눈이 날리기 시작)
     u  60 ─102  겨울 (눈이 굵어지며 쌓인다)  102 ─120  봄으로 (눈이 그치고 녹는다)
     u 120 ─162  봄 (연두·분홍 꽃잎)  162 ─180  여름으로
     u 180 ─222  여름 (짙은 초록)      222 ─240  가을로 (낙엽이 다시 떨어진다)

   portfolio.js는 아래 몇 군데만 부른다.
     addSnow(mat, kind)   셰이더에 눈 쌓임을 끼워 넣는다 (위를 보는 면이 하얘진다)
     attachWorld(root)    Blender 월드 glb — 잎·땅·길 색을 계절마다 바꾼다
     attachLeaves(mesh)   날리는 낙엽 — 겨울엔 사라지고 봄엔 꽃잎이 된다
     update(dt, pos)      매 프레임. 낮밤(updateDayNight) 다음에 불러야 그 위에 덧칠된다
   ════════════════════════════════════════════════════════════ */

export const SEASON_NAMES = ['autumn', 'winter', 'spring', 'summer'];
const LABEL = { autumn: '가을', winter: '겨울', spring: '봄', summer: '여름' };
const ICON = { autumn: '🍂', winter: '❄️', spring: '🌸', summer: '☀️' };
const SEG = 60, BLEND = 18, CYCLE = SEG * 4;
/* jump()로 건너뛸 자리 — 그 계절이 한창일 때 */
const JUMP = { autumn: 20, winter: 92, spring: 140, summer: 200 };

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createSeasons({ THREE, scene, renderer, hemi, sun, skyU, badge }) {
  const C = h => new THREE.Color(h);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 공용 유니폼 ── */
  const uSnow = { value: 0 };                                   // 쌓인 눈 0~1
  const uDry = { value: new THREE.Vector3(0.86, 0.55, 0.22) };  // 풀 색 (portfolio.js 풀 셰이더가 읽는다)
  const uLush = { value: new THREE.Vector3(0.62, 0.52, 0.18) };

  /* ── 계절별 색 ──
     leaf: 잎 재질 5개(M_Leaf0~4). 가을은 glb 원래 색을 그대로 쓴다(null).
     봄은 3·4번을 분홍 꽃으로. 겨울은 바랜 갈색 — 그 위에 눈이 덮인다. */
  const V = (r, g, b) => new THREE.Vector3(r, g, b);
  const P = {
    autumn: { leaf: null, terrain: null, path: null, outer: C(0x6e3412),
      dry: V(0.86, 0.55, 0.22), lush: V(0.62, 0.52, 0.18),
      hemi: C(0xffb48a), hemiK: 1, ground: C(0x1a1030), sun: C(0xff9050), sunK: 1, exp: 1,
      fog: C(0xffffff), sky: C(0xffffff), far: 100 },
    winter: { leaf: [0x6a5e54, 0x5e534b, 0x7a6e62, 0x6f6660, 0x5a5250].map(C), terrain: C(0x9a8a78), path: C(0xa89a8c), outer: C(0x8f8a86),
      dry: V(0.62, 0.56, 0.44), lush: V(0.55, 0.52, 0.42),
      hemi: C(0xd2dcff), hemiK: 1.08, ground: C(0x50586a), sun: C(0xffd2b8), sunK: 0.85, exp: 1.0,
      fog: C(0xc8d6ff), sky: C(0xc4d2ff), far: 78 },
    spring: { leaf: [0x9fd86a, 0xbfe57e, 0x86c95c, 0xf6a9c8, 0xffc6da].map(C), terrain: C(0x86b54e), path: C(0xc49a6c), outer: C(0x5d8a35),
      dry: V(0.58, 0.86, 0.34), lush: V(0.42, 0.76, 0.26),
      hemi: C(0xffe8c8), hemiK: 1.1, ground: C(0x233018), sun: C(0xffb878), sunK: 1.05, exp: 1.03,
      fog: C(0xf2ffe8), sky: C(0xf0f6ff), far: 100 },
    summer: { leaf: [0x2f7a32, 0x3f8f3a, 0x256b2c, 0x4a9a3e, 0x357f35].map(C), terrain: C(0x5a9a3c), path: C(0xb88e60), outer: C(0x3e6e28),
      dry: V(0.30, 0.64, 0.18), lush: V(0.21, 0.52, 0.14),
      hemi: C(0xfff2b8), hemiK: 1.22, ground: C(0x1c2a12), sun: C(0xffc468), sunK: 1.2, exp: 1.06,
      fog: C(0xfff6e0), sky: C(0xfff4e4), far: 110 }
  };
  const ORDER = SEASON_NAMES.map(n => P[n]);

  /* ── 눈 쌓임 셰이더 ──
     세계 좌표 법선의 y(위를 보는 정도)가 문턱을 넘는 면만 하얘진다. uSnow가 오를수록 문턱이 내려가
     평평한 땅부터 덮이고 비탈·잎 윗면으로 번진다. 얼룩 무늬로 가장자리가 고르지 않게. */
  const SNOW_RGB = 'vec3(0.86, 0.9, 0.97)';
  function addSnow(mat, kind = 'ground', bias = 0) {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(mat, sh, r);                         // addWind 같은 기존 패치를 먼저
      sh.uniforms.uSnow = uSnow;
      sh.vertexShader = 'varying vec3 vSnowW;\n' + sh.vertexShader.replace('#include <fog_vertex>',
        '#include <fog_vertex>\n  vSnowW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float uSnow; varying vec3 vSnowW;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 sN = inverseTransformDirection(normal, viewMatrix);
          float sn = 0.5 + 0.3 * sin(vSnowW.x * 1.9 + sin(vSnowW.z * 1.4) * 1.6) + 0.2 * sin(vSnowW.z * 3.1 - vSnowW.x * 0.7);
          float thr = 1.05 - uSnow * ${(0.95 + bias).toFixed(2)};
          float cov = smoothstep(thr - 0.08, thr + 0.08, sN.y * (0.7 + 0.3 * sn)) * smoothstep(0.0, 0.06, uSnow);
          diffuseColor.rgb = mix(diffuseColor.rgb, ${SNOW_RGB}, cov);
        }`);
    };
    /* 같은 onBeforeCompile 문자열끼리는 셰이더 프로그램을 공유하므로 종류별로 키를 나눈다 */
    mat.customProgramCacheKey = () => 'snow-' + kind + (prev ? '-w' : '');
    mat.needsUpdate = true;
  }

  /* ── 월드 재질 ── */
  const leafMats = [], leafOrig = [];   // [i] = 그 번호 잎 재질 목록 / 가을 원래 색
  const terrainMats = [], pathMats = [], waterMats = [], groundMats = [];
  let terrainOrig = null, pathOrig = null;
  function attachWorld(root) {
    const seen = new Set();
    root.traverse(o => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (seen.has(m)) continue;
        seen.add(m);
        const lm = /M_Leaf(\d)/.exec(m.name);
        if (lm) {
          const i = +lm[1];
          (leafMats[i] ||= []).push(m);
          leafOrig[i] ||= m.color.clone();
          addSnow(m, 'leaf', 0.15);                           // 잎은 조금 더 쉽게 덮인다
        } else if (m.name.startsWith('M_Grass')) {
          terrainMats.push(m); terrainOrig ||= m.color.clone(); addSnow(m, 'terrain', 0.05);
        } else if (m.name.startsWith('M_Path')) {
          pathMats.push(m); pathOrig ||= m.color.clone(); addSnow(m, 'path', 0.05);
        } else if (o.name.includes('Water')) {
          waterMats.push({ m, color: m.color.clone(), emissive: m.emissive.clone() });
        } else {
          addSnow(m, m.name.replace(/\W.*$/, ''));            // 바위·다리·소품·줄기 윗면
        }
      }
    });
  }
  /* 월드 바깥 바닥 같은 단색 바닥 */
  function addGround(mat) { groundMats.push(mat); addSnow(mat, 'outer'); }

  /* ── 날리는 낙엽 / 봄 꽃잎 ── */
  let leafMesh = null, leafN = 0, leafMode = 'leaf';
  const leafCols = [0xe0461c, 0xff9a2e, 0xb3264d, 0xffc04d].map(C);
  const petalCols = [0xffc6da, 0xf6a9c8, 0xffe4ee, 0xf28fb6].map(C);
  function attachLeaves(mesh) { leafMesh = mesh; leafN = mesh.count; }
  function recolorLeaves(cols) {
    for (let i = 0; i < leafN; i++) leafMesh.setColorAt(i, cols[i % cols.length]);
    leafMesh.instanceColor.needsUpdate = true;
    /* 꽃잎은 그늘에서 갈색으로 죽어 보여서 은은하게 분홍빛을 낸다 */
    leafMesh.material.emissive?.setHex(cols === petalCols ? 0x3a1a26 : 0x000000);
  }

  /* ── 눈 내리기 ──
     플레이어 주변 상자(BX×BY×BX) 안에 눈송이를 깔고, 위치는 셰이더가 mod로 감아 돌린다.
     CPU는 매 프레임 유니폼 몇 개만 바꾼다. aRnd < uAmt인 송이만 보여서 양이 점점 늘어난다. */
  const FLAKES = 1800, BX = 56, BY = 18;
  const snowU = { uTime: { value: 0 }, uAmt: { value: 0 }, uCenter: { value: new THREE.Vector3() },
    uViewH: { value: 800 }, uBright: { value: 1 } };
  {
    const pos = new Float32Array(FLAKES * 3), rnd = new Float32Array(FLAKES);
    for (let i = 0; i < FLAKES; i++) {
      pos[i * 3] = Math.random() * BX; pos[i * 3 + 1] = Math.random() * BY; pos[i * 3 + 2] = Math.random() * BX;
      rnd[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
    const flakes = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: snowU, transparent: true, depthWrite: false, fog: false,
      vertexShader: `uniform float uTime; uniform float uAmt; uniform vec3 uCenter; uniform float uViewH;
        attribute float aRnd; varying float vA;
        void main(){
          vec3 p = position;
          p.y = mod(p.y - uTime * (1.0 + aRnd * 0.9), ${BY.toFixed(1)});
          p.x += sin(uTime * 0.7 + aRnd * 40.0) * 0.5 + uTime * 0.6;     // 바람에 살짝 밀린다
          p.z += cos(uTime * 0.5 + aRnd * 23.0) * 0.4;
          p.xz = mod(p.xz - uCenter.xz + ${(BX / 2).toFixed(1)}, ${BX.toFixed(1)}) - ${(BX / 2).toFixed(1)} + uCenter.xz;
          p.y += uCenter.y - 3.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float on = step(aRnd, uAmt);
          float r = length(p.xz - uCenter.xz);
          vA = on * (1.0 - smoothstep(${(BX * 0.3).toFixed(1)}, ${(BX * 0.5).toFixed(1)}, r)) * smoothstep(0.0, 1.5, p.y - uCenter.y + 3.0);
          gl_PointSize = on * min(26.0, (0.05 + aRnd * 0.04) * projectionMatrix[1][1] * uViewH * 0.5 / max(0.5, -mv.z));
        }`,
      fragmentShader: `uniform float uBright; varying float vA;
        void main(){
          float a = smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5)) * vA * 0.9;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vec3(0.9, 0.93, 1.0) * uBright, a);
        }`
    }));
    flakes.frustumCulled = false;
    flakes.renderOrder = 2;
    scene.add(flakes);
  }

  /* ── 상단 계절 배지 ── */
  const badgeIcon = badge?.querySelector('.i'), badgeText = badge?.querySelector('.t');
  let shownLabel = '', badgeAcc = 1;

  /* ── 상태 ── */
  let u = 0, mult = 1, flakeT = 0;
  const q = new URLSearchParams(location.search).get('season');
  if (q && q in JUMP) u = JUMP[q];
  const state = { season: 'autumn', progress: 0, snow: 0, snowfall: 0, leaves: 1, u: 0 };

  /* 매 프레임 쓰는 임시값 — 새로 만들지 않는다 */
  const tc = new THREE.Color(), tc2 = new THREE.Color(), base = C(0xffffff);
  const lerpC = (out, a, b, k) => out.copy(a).lerp(b, k);

  function update(dt, pos) {
    u = (u + dt * mult) % CYCLE;
    if (u < 0) u += CYCLE;
    const idx = Math.floor(u / SEG) % 4, local = u - idx * SEG;
    const b = smooth(SEG - BLEND, SEG, local);
    const A = ORDER[idx], B = ORDER[(idx + 1) % 4];

    /* 눈: 겨울 초입부터 내리고(45~80초 동안 점점 굵게) 봄 섞일 때 그친다. 쌓인 눈은 조금 늦게 따라온다 */
    const snowfall = smooth(45, 80, u) * (1 - smooth(100, 116, u));
    const snow = smooth(52, 100, u) * (1 - smooth(110, 134, u));
    /* 낙엽: 가을에만. 겨울로 넘어가며 줄고, 여름 끝에 다시. 봄엔 분홍 꽃잎이 드문드문 */
    const leaves = Math.max(1 - smooth(40, 62, u), smooth(222, 240, u));
    const petals = smooth(126, 140, u) * (1 - smooth(168, 184, u)) * 0.45;

    uSnow.value = snow;
    uDry.value.copy(A.dry).lerp(B.dry, b);
    uLush.value.copy(A.lush).lerp(B.lush, b);

    /* 잎·땅·길 색 */
    for (let i = 0; i < leafMats.length; i++) {
      const list = leafMats[i];
      if (!list) continue;
      const ca = A.leaf ? A.leaf[i] : leafOrig[i], cb = B.leaf ? B.leaf[i] : leafOrig[i];
      lerpC(tc, ca, cb, b);
      for (const m of list) m.color.copy(tc);
    }
    if (terrainOrig) { lerpC(tc, A.terrain || terrainOrig, B.terrain || terrainOrig, b); for (const m of terrainMats) m.color.copy(tc); }
    if (pathOrig) { lerpC(tc, A.path || pathOrig, B.path || pathOrig, b); for (const m of pathMats) m.color.copy(tc); }
    lerpC(tc, A.outer, B.outer, b);
    for (const m of groundMats) m.color.copy(tc);
    /* 물: 눈이 쌓일수록 살짝 얼음빛 */
    for (const w of waterMats) {
      w.m.color.copy(w.color).lerp(tc2.setRGB(0.62, 0.78, 0.9), snow * 0.55);
      w.m.emissive.copy(w.emissive).lerp(tc2.setRGB(0.25, 0.4, 0.6), snow * 0.5);
    }

    /* 빛·안개·하늘 — updateDayNight가 방금 정한 값에 곱한다 */
    hemi.color.copy(A.hemi).lerp(B.hemi, b);
    hemi.groundColor.copy(A.ground).lerp(B.ground, b);
    hemi.intensity *= A.hemiK + (B.hemiK - A.hemiK) * b;
    sun.color.copy(A.sun).lerp(B.sun, b);
    sun.intensity *= A.sunK + (B.sunK - A.sunK) * b;
    renderer.toneMappingExposure *= A.exp + (B.exp - A.exp) * b;
    scene.fog.color.multiply(lerpC(tc, A.fog, B.fog, b));
    scene.fog.far = A.far + (B.far - A.far) * b;
    lerpC(tc, A.sky, B.sky, b);
    skyU.hor.value.multiply(tc);
    skyU.mid.value.multiply(tc2.copy(base).lerp(tc, 0.5));

    /* 눈송이 */
    flakeT += dt * (reduced ? 0.5 : 1);
    snowU.uTime.value = flakeT;
    snowU.uAmt.value = snowfall;
    snowU.uCenter.value.set(pos.x, pos.y, pos.z);
    snowU.uViewH.value = renderer.domElement.height;
    snowU.uBright.value = Math.min(1.1, Math.max(0.35, hemi.intensity / 0.75));

    /* 낙엽 ↔ 꽃잎: 둘 다 0에 가까운 겨울·여름 사이에 색을 바꿔서 바뀌는 순간이 안 보이게 */
    if (leafMesh) {
      const mode = u >= 110 && u < 200 ? 'petal' : 'leaf';
      if (mode !== leafMode) { leafMode = mode; recolorLeaves(mode === 'petal' ? petalCols : leafCols); }
      const n = Math.round(leafN * Math.max(leaves, petals));
      leafMesh.count = n;
      leafMesh.visible = n > 0;
    }

    /* 상태와 배지 */
    const label = SEASON_NAMES[Math.floor((u + BLEND / 2) / SEG) % 4];
    state.season = label;
    state.progress = local / SEG;
    state.snow = snow; state.snowfall = snowfall; state.leaves = leaves; state.u = u;
    if (badge) {
      if (label !== shownLabel) {
        shownLabel = label;
        badgeIcon.textContent = ICON[label]; badgeText.textContent = LABEL[label];
        badge.dataset.season = label;
        badge.title = `지금 계절: ${LABEL[label]} — 1분마다 계절이 바뀝니다`;
      }
      badgeAcc += dt;
      if (badgeAcc > 0.25) { badgeAcc = 0; badge.style.setProperty('--p', state.progress.toFixed(3)); }
    }
  }

  /* PM 확인용 — 콘솔에서 __seasons.jump('winter'), __seasons.speed(5) */
  window.__seasons = {
    jump(name) { if (name in JUMP) u = JUMP[name]; return name in JUMP ? name : `모르는 계절: ${name} (${SEASON_NAMES.join('/')})`; },
    speed(m = 1) { mult = +m; return mult; },
    get state() { return { ...state, label: shownLabel }; }
  };

  return {
    update, addSnow, addGround, attachWorld, attachLeaves,
    uniforms: { uSnow, uDry, uLush },
    get season() { return state.season; },
    get progress() { return state.progress; }
  };
}
