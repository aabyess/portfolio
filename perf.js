/* ════════════════════════════════════════════════════════════
   성능 도우미 (perf.js) — 그리기 호출(draw call)을 줄인다

   1) createFarCull: 그리기 직전에만 잠깐 숨겼다가 그린 뒤 그대로 되돌린다 (모듈이 정한 visible 은 건드리지 않음)
        · 안개 끝(scene.fog.far)보다 카메라 깊이가 먼 물체 — 어차피 안개 색 한 덩어리라 숨겨도 똑같다
        · 화면에서 몇 픽셀도 안 되는 작은 물체(반지름/깊이 < SMALL_K)
        · 시야 밖이고 그림자(빛 방향으로 땅까지)도 시야에 닿지 않는 물체 — 그림자 패스 그리기 호출이 크게 준다
      그리고 작은 물체는 플레이어에게서 멀면 그림자를 끈다 (상태가 바뀔 때만 castShadow 를 바꾼다).
      NPC 는 npcs.js 가 그림자를 직접 끄고 켜므로 그림자 규칙에서 뺀다.
      graphics.js 의 render() 가 부른다: cull.begin() → composer.render() → cull.end()

   2) shareSkeleton(root): glTF 는 부위(메시)마다 뼈대 객체를 따로 만든다 → 뼈 행렬 계산·텍스처 업로드가
      부위 수만큼 반복된다. 뼈 목록이 같으면 첫 메시의 뼈대 하나를 같이 쓴다. (npcs/kids/animals)

   3) skinBounds(mesh, k): 스킨 메시 컬링용 경계 구 (지오메트리 경계 구 × k). frustumCulled=false 대신.

   4) flatSkinnedLOD(meshes, material): 부위 여러 개(텍스처 각각)를 정점색 한 덩어리로 합친 먼 거리용
      스킨 메시를 만든다 (텍스처를 정점 UV 자리에서 읽어 정점색으로 굽는다 → 그리기 호출 1개).
      skinLOD(동물·아이)·npcs.js 는 이것을 만들 때가 아니라 쉬는 틈에 하나씩 굽는다.

   5) createWarmup: 첫 화면 뒤에 장면에 붙는 물체의 셰이더(그림자용 포함)·텍스처를 몇 프레임에 나눠 준비한 다음 보여 주고,
      나중에 붙을 점광원 자리를 미리 잡아 둔다 (점광원 수가 바뀌면 모든 셰이더를 다시 짠다).
      Object3D.prototype.add 를 감싸 "새로 붙은 것"을 안다. graphics.js 가 만들고 render() 앞뒤로 begin/end 를 부른다.
   ════════════════════════════════════════════════════════════ */

/* 비교용: 주소에 ?noperf 를 붙이면 이 파일의 최적화를 모두 끈다 (예전 그대로 그리기) */
export const PERF_OFF = typeof location !== 'undefined' && new URLSearchParams(location.search).has('noperf');

const SMALL_R = 1.2;        // 이보다 작은 물체만 '너무 작으면 숨김' 규칙
const SMALL_K = 0.0045;     // 반지름/깊이 < 이것 → 화면에서 약 4px 이하
const BIG_R = 26;           // 이보다 큰 그룹은 자식 단위로 나눠 본다
const NEVER_R = 70;         // 이보다 큰 단위(땅·하늘·풀)는 숨기지 않는다
const SH_SMALL_R = 2.5, SH_SMALL_FAR = 34;   // 작은 물체: 플레이어에게서 34 m 넘으면 그림자 끔
const SH_MID_R = 8, SH_MID_FAR = 52;         // 중간 물체(부스·오두막): 52 m
const SH_LEN = 60;                           // 시야 밖 물체의 그림자 줄기 최대 길이 (m)

/* 정적 LOD 목록 (addStaticLOD 가 채우고 createFarCull 이 그릴 때마다 본다) — 모듈 전역이라 만드는 순서와 상관없다 */
const LODS = [];

export function createFarCull({ THREE, scene, camera, sun = null, getPlayerPos = null, exclude = null }) {
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sp = new THREE.Sphere(), ld = new THREE.Vector3();
  const units = [];
  const hidden = [];
  const box = new THREE.Box3(), sph = new THREE.Sphere(), v = new THREE.Vector3();
  const camPos = new THREE.Vector3(), fwd = new THREE.Vector3(), guess = new THREE.Vector3();
  let lastCount = -1, scanT = 0, enabled = !PERF_OFF;
  const st = { units: 0, hidden: 0, noShadow: 0, lodFar: 0, lods: LODS.length };

  function hasBad(o) {   // 셰이더로 움직이는 것·인스턴스·점 구름은 경계를 믿을 수 없다 → 숨기지 않는다
    let bad = false;
    o.traverse(x => {
      if (bad) return;
      if (x.isInstancedMesh || x.isPoints || x.isLine || x.isLight) bad = true;
      else if ((x.isMesh || x.isSprite) && x.frustumCulled === false && !x.isSkinnedMesh) bad = true;
    });
    return bad;
  }
  /* 경계: 메시마다 경계 구(스킨 메시는 직접 정한 boundingSphere, 없으면 바인드 자세)를 월드로 옮겨 합친다.
     Box3.setFromObject 는 스킨 메시 정점을 전부 변형해 느리다 */
  const s2 = new THREE.Sphere(), b2 = new THREE.Box3();
  function bounds(o) {
    box.makeEmpty();
    o.updateWorldMatrix(true, true);
    o.traverse(x => {
      if (!(x.isMesh || x.isSprite) || !x.geometry) return;
      const g = x.geometry;
      if (x.isSkinnedMesh && x.boundingSphere) s2.copy(x.boundingSphere);
      else { if (!g.boundingSphere) g.computeBoundingSphere(); if (!g.boundingSphere) return; s2.copy(g.boundingSphere); }
      s2.applyMatrix4(x.matrixWorld);
      if (!Number.isFinite(s2.radius)) return;
      box.union(s2.getBoundingBox(b2));
    });
  }
  function addUnit(o, depth) {
    if (o.isLight || o.isCamera) return;
    if (exclude && exclude(o)) return;
    bounds(o);
    if (box.isEmpty()) return;
    box.getBoundingSphere(sph);
    if (!Number.isFinite(sph.radius)) return;
    if (sph.radius > BIG_R && depth < 2 && o.children.length > 1 && !o.isSkinnedMesh) {
      for (const c of o.children) addUnit(c, depth + 1);
      return;
    }
    if (sph.radius > NEVER_R) return;
    if (hasBad(o)) return;
    v.setFromMatrixPosition(o.matrixWorld);
    const off = sph.center.clone().sub(v);
    const r = sph.radius + Math.min(off.length(), 3) * 0.5 + 0.3;
    /* 그림자 규칙 대상: NPC(자체 처리)는 빼고, 작거나 중간 크기인 것만 */
    const shFar = /^NPC_/.test(o.name) ? 0 : r < SH_SMALL_R ? SH_SMALL_FAR : r < SH_MID_R ? SH_MID_FAR : 0;
    let meshes = null;
    if (shFar) { meshes = []; o.traverse(x => { if (x.isMesh) { if (x.userData.__cs0 === undefined) x.userData.__cs0 = x.castShadow; meshes.push(x); } }); }
    const old = o.userData.__perfUnit;
    const unit = { o, off, r, shFar, meshes, shOn: old ? old.shOn : true, top: o.parent === scene };
    /* 열거 안 되는 속성으로 둔다: Object3D.clone() 이 userData 를 JSON 으로 복사하는데, 순환 참조(unit.o)가 있으면
       "Converting circular structure to JSON" 으로 터진다 (선술집 앉기 → 바텐더 잔 복제에서 발생) */
    Object.defineProperty(o.userData, '__perfUnit', { value: unit, writable: true, configurable: true, enumerable: false });
    units.push(unit);
  }
  function scan() {
    const prev = units.splice(0);
    for (const o of scene.children) addUnit(o, 0);   // addUnit 이 예전 단위의 그림자 상태를 이어받는다
    for (const u of prev) {
      if (u.o.userData.__perfUnit !== u) continue;     // 새 단위로 바뀌었음
      delete u.o.userData.__perfUnit;                  // 목록에서 빠졌다 → 그림자를 되돌린다
      if (u.meshes && !u.shOn) for (const m of u.meshes) m.castShadow = m.userData.__cs0;
    }
    lastCount = scene.children.length;
    st.units = units.length; st.lods = LODS.length;
  }

  function begin(dt = 0.016) {
    if (!enabled) return;
    scanT -= dt;
    if (scene.children.length !== lastCount || scanT <= 0) { scan(); scanT = 4; }
    camera.updateMatrixWorld();
    camPos.setFromMatrixPosition(camera.matrixWorld);
    fwd.set(0, 0, -1).transformDirection(camera.matrixWorld);
    const far = scene.fog && scene.fog.far ? scene.fog.far : Infinity;
    /* 플레이어 자리 (없으면 카메라 8 m 앞 땅 — 3인칭 카메라는 늘 플레이어 뒤에 있다) */
    const pp = getPlayerPos ? getPlayerPos() : guess.set(camPos.x + fwd.x * 8, 0, camPos.z + fwd.z * 8);
    /* 카메라 시야(절두체)와 빛 방향 — 시야 밖 물체 중 그림자도 시야에 안 닿는 것은 그림자 패스에서도 뺀다 */
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    let useSh = false;
    if (sun && sun.castShadow) { ld.subVectors(sun.target.position, sun.position).normalize(); useSh = ld.y < -0.05; }
    let ns = 0, nsc = 0;
    for (let i = 0; i < units.length; i++) {
      const u = units[i], o = u.o;
      if (u.top) { v.copy(o.position); } else { v.setFromMatrixPosition(o.matrixWorld); }
      const cx = v.x + u.off.x, cy = v.y + u.off.y, cz = v.z + u.off.z;
      /* 그림자: 플레이어에게서 멀면 끈다 (2 m 여유를 둬 경계에서 깜빡이지 않게) */
      if (u.shFar) {
        const d = Math.hypot(cx - pp.x, cz - pp.z) - u.r;
        const want = u.shOn ? d < u.shFar + 2 : d < u.shFar;
        if (want !== u.shOn) {
          u.shOn = want;
          for (const m of u.meshes) m.castShadow = want ? m.userData.__cs0 : false;
        }
        if (!u.shOn) ns++;
      }
      if (!o.visible) continue;
      const depth = (cx - camPos.x) * fwd.x + (cy - camPos.y) * fwd.y + (cz - camPos.z) * fwd.z;
      if (depth - u.r > far || (u.r < SMALL_R && depth > 8 && u.r < depth * SMALL_K)) {
        o.visible = false; hidden.push(o); continue;
      }
      if (!useSh) continue;
      sp.center.set(cx, cy, cz); sp.radius = u.r;
      if (frustum.intersectsSphere(sp)) continue;
      /* 시야 밖: 땅에 닿을 때까지의 그림자 줄기를 4토막으로 검사 (길이 최대 SH_LEN) */
      const len = Math.min(SH_LEN, Math.max(0, (cy + u.r) / -ld.y));
      let seen = false;
      for (let k = 1; k <= 4 && !seen; k++) {
        const f = len * k / 4;
        sp.center.set(cx + ld.x * f, cy + ld.y * f, cz + ld.z * f); sp.radius = u.r + len / 8;
        seen = frustum.intersectsSphere(sp);
      }
      if (!seen) { o.visible = false; hidden.push(o); nsc++; }
    }
    /* 정적 LOD: 카메라에서 멀면 그리는 동안만 부위들을 숨기고 한 덩어리를 보인다 */
    let nl = 0;
    for (let i = 0; i < LODS.length; i++) {
      const L = LODS[i];
      if (!L.root.parent) continue;
      v.setFromMatrixPosition(L.root.matrixWorld);
      const d = Math.hypot(v.x - camPos.x, v.y - camPos.y, v.z - camPos.z);
      L.far = L.far ? d > L.dist - 3 : d > L.dist;
      if (!L.far) continue;
      for (let k = 0; k < L.hi.length; k++) { const m = L.hi[k]; if (m.visible) { m.visible = false; lodHidden.push(m); } }
      L.lo.visible = true; lodShown.push(L.lo); nl++;
    }
    st.hidden = hidden.length; st.noShadow = ns; st.lodFar = nl; st.offscreen = nsc;
  }
  const lodHidden = [], lodShown = [];
  function end() {
    for (let i = 0; i < hidden.length; i++) hidden[i].visible = true;
    hidden.length = 0;
    for (let i = 0; i < lodHidden.length; i++) lodHidden[i].visible = true;
    for (let i = 0; i < lodShown.length; i++) lodShown[i].visible = false;
    lodHidden.length = lodShown.length = 0;
  }
  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) { end(); for (const u of units) if (u.meshes && !u.shOn) { u.shOn = true; for (const m of u.meshes) m.castShadow = m.userData.__cs0; } }
  }
  return { begin, end, scan, setEnabled, get enabled() { return enabled; }, stats: () => ({ ...st }) };
}

/* 같은 뼈 목록을 쓰는 스킨 메시들이 뼈대(Skeleton) 하나를 같이 쓰게 한다. 바꾼 메시 수를 돌려준다 */
export function shareSkeleton(root) {
  if (PERF_OFF) return 0;
  let first = null, n = 0;
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    if (!first) { first = o.skeleton; return; }
    const s = o.skeleton;
    if (s === first || s.bones.length !== first.bones.length) return;
    for (let i = 0; i < s.bones.length; i++) {
      if (s.bones[i] !== first.bones[i] || !s.boneInverses[i].equals(first.boneInverses[i])) return;
    }
    o.skeleton = first; n++;
  });
  return n;
}

/* 스킨 메시 경계 구: 지오메트리 경계 구를 k배 (넘어지기·팔 뻗기까지 덮게) */
export function skinBounds(THREE, mesh, k = 1.6) {
  if (PERF_OFF) { mesh.frustumCulled = false; return null; }
  const g = mesh.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  const s = g.boundingSphere.clone();
  s.radius *= k;
  mesh.boundingSphere = s;
  mesh.frustumCulled = true;
  return s;
}

/* 모델 전체에 경계 구 하나: 부위들의 지오메트리 경계 구를 합쳐 k배 (눈처럼 작은 부위도 몸 전체 구를 쓴다).
   부위들이 같은 지역 공간에 있다고 본다 (glTF 스킨 메시 형제들) */
export function skinBoundsAll(THREE, root, k = 1.5, pad = 0.3) {
  const ms = [];
  root.traverse(o => { if (o.isSkinnedMesh) ms.push(o); });
  if (!ms.length) return null;
  if (PERF_OFF) { for (const m of ms) m.frustumCulled = false; return null; }
  const box = new THREE.Box3(), b = new THREE.Box3();
  for (const m of ms) { const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); box.union(g.boundingSphere.getBoundingBox(b)); }
  const s = box.getBoundingSphere(new THREE.Sphere());
  s.radius = s.radius * k + pad;
  for (const m of ms) { m.boundingSphere = s.clone(); m.frustumCulled = true; }
  return s;
}

/* ── 먼 거리용 한 덩어리 스킨 메시 ── */
const texCache = new WeakMap();
function texPixels(tex) {
  if (!tex || !tex.image) return null;
  if (texCache.has(tex)) return texCache.get(tex);
  let out = null;
  try {
    const img = tex.image, S = 128;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, S, S);
    out = { S, d: g.getImageData(0, 0, S, S).data, flipY: tex.flipY };
  } catch (e) { out = null; }
  texCache.set(tex, out);
  return out;
}
/* sRGB 0..255 → 선형 0..1 */
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

/* meshes: 같은 뼈대·같은 bindMatrix 를 쓰는 스킨 메시들 (부위). 위치·법선·스킨 속성만 쓰고 색은 굽는다.
   baseCache(Map, 선택): 같은 모델(지오메트리 묶음)끼리 위치·법선·스킨 속성과 인덱스를 공유 */
export function flatSkinnedLOD(THREE, meshes, material, baseCache = null) {
  if (PERF_OFF) return null;
  const list = meshes.filter(m => m.isSkinnedMesh && m.geometry.attributes.position && m.geometry.attributes.skinIndex);
  if (!list.length) return null;
  const key = list.map(m => m.geometry.uuid).join('|');
  let base = baseCache && baseCache.get(key);
  if (!base) {
    let nv = 0, ni = 0;
    for (const m of list) { const g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const m of list) {
      const g = m.geometry, a = g.attributes, c = a.position.count;
      for (let i = 0; i < c; i++) {
        pos[(vo + i) * 3] = a.position.getX(i); pos[(vo + i) * 3 + 1] = a.position.getY(i); pos[(vo + i) * 3 + 2] = a.position.getZ(i);
        if (a.normal) { nor[(vo + i) * 3] = a.normal.getX(i); nor[(vo + i) * 3 + 1] = a.normal.getY(i); nor[(vo + i) * 3 + 2] = a.normal.getZ(i); }
        si[(vo + i) * 4] = a.skinIndex.getX(i); si[(vo + i) * 4 + 1] = a.skinIndex.getY(i); si[(vo + i) * 4 + 2] = a.skinIndex.getZ(i); si[(vo + i) * 4 + 3] = a.skinIndex.getW(i);
        sw[(vo + i) * 4] = a.skinWeight.getX(i); sw[(vo + i) * 4 + 1] = a.skinWeight.getY(i); sw[(vo + i) * 4 + 2] = a.skinWeight.getZ(i); sw[(vo + i) * 4 + 3] = a.skinWeight.getW(i);
      }
      if (g.index) { const ix = g.index; for (let i = 0; i < ix.count; i++) idx[io++] = ix.getX(i) + vo; }
      else for (let i = 0; i < c; i++) idx[io++] = i + vo;
      vo += c;
    }
    base = {
      pos: new THREE.BufferAttribute(pos, 3), nor: new THREE.BufferAttribute(nor, 3),
      si: new THREE.BufferAttribute(si, 4), sw: new THREE.BufferAttribute(sw, 4), idx: new THREE.BufferAttribute(idx, 1), nv
    };
    if (baseCache) baseCache.set(key, base);
  }
  /* 정점색 = 재질 색 × 텍스처(정점 UV 자리) — 메시마다 색이 다르므로(옷 색 바꾸기) 정점색만 새로 만든다 */
  const col = new Float32Array(base.nv * 3);
  let vo = 0;
  for (const m of list) {
    const g = m.geometry, c = g.attributes.position.count, uv = g.attributes.uv;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    const mc = mat && mat.color ? mat.color : { r: 1, g: 1, b: 1 };
    const px = mat && mat.map && uv ? texPixels(mat.map) : null;
    for (let i = 0; i < c; i++) {
      let r = 1, gg = 1, b = 1;
      if (px) {
        let u = uv.getX(i), w = uv.getY(i);
        u -= Math.floor(u); w -= Math.floor(w);
        if (px.flipY) w = 1 - w;
        const x = Math.min(px.S - 1, (u * px.S) | 0), y = Math.min(px.S - 1, (w * px.S) | 0), o = (y * px.S + x) * 4;
        r = LIN[px.d[o]]; gg = LIN[px.d[o + 1]]; b = LIN[px.d[o + 2]];
      }
      col[(vo + i) * 3] = r * mc.r; col[(vo + i) * 3 + 1] = gg * mc.g; col[(vo + i) * 3 + 2] = b * mc.b;
    }
    vo += c;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', base.pos); geo.setAttribute('normal', base.nor);
  geo.setAttribute('skinIndex', base.si); geo.setAttribute('skinWeight', base.sw);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(base.idx);
  const first = list[0];
  const lod = new THREE.SkinnedMesh(geo, material);
  lod.name = (first.name || 'mesh') + '_lod';
  lod.position.copy(first.position); lod.quaternion.copy(first.quaternion); lod.scale.copy(first.scale);
  first.parent.add(lod);
  lod.bind(first.skeleton, first.bindMatrix);
  if (first.boundingSphere) lod.boundingSphere = first.boundingSphere.clone();
  lod.castShadow = false; lod.receiveShadow = true;
  lod.visible = false;
  return lod;
}

/* ── 정적 물체 먼 거리 LOD (부스·오두막·성·의자처럼 안 움직이는 부위 묶음) ──
   root 아래 메시들(keep 이 true 인 것·투명·발광·스킨 메시는 그대로 둠)을 정점색 한 덩어리로 합친 메시를 root 에 붙인다.
   카메라에서 dist m 넘으면 그리는 동안만 부위들 대신 한 덩어리를 그린다 (createFarCull 이 처리).
   root 를 기준으로 굽기 때문에 root 째 움직이는(물리로 넘어지는 의자) 것도 된다. 부위끼리는 움직이면 안 된다.
   같은 지오메트리·재질 묶음(clone 한 의자 등)은 합친 지오메트리를 같이 쓴다. */
const staticCache = new Map();
const staticMats = new Map();
export function addStaticLOD(THREE, root, { dist = 40, keep = null, roughness = 0.85 } = {}) {
  if (PERF_OFF) return null;
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const hi = [], parts = [];
  root.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.position) return;
    if (o.userData.__lodLo) return;
    const mat = Array.isArray(o.material) ? null : o.material;
    if (!mat || mat.transparent || (keep && keep(o))) return;
    if (mat.map && mat.map.isCanvasTexture) return;   // 글씨 쓴 간판은 그대로 (멀리서도 읽히게)
    if (/glow|flame|candle|lamp_glass|fire/i.test(mat.name || '')) return;   // 밤에 켜지는 불빛 재질 (낮엔 발광 0 일 수 있다)
    if (mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.05 && mat.emissiveIntensity > 0) return;
    if (mat.emissiveMap) return;
    hi.push(o); parts.push(o);
  });
  if (hi.length < 2) return null;
  const key = parts.map(o => o.geometry.uuid + ':' + o.material.uuid + ':' + o.material.color.getHexString()).join('|') + '|' +
    parts.map(o => new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld).elements.map(e => e.toFixed(3)).join(',')).join(';');
  let geo = staticCache.get(key);
  let dbl = parts.some(o => o.material.side === THREE.DoubleSide);
  if (!geo) {
    let nv = 0, ni = 0;
    for (const o of parts) { const g = o.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    const m4 = new THREE.Matrix4(), n3 = new THREE.Matrix3(), p = new THREE.Vector3(), n = new THREE.Vector3();
    let vo = 0, io = 0;
    for (const o of parts) {
      const g = o.geometry, a = g.attributes, c = a.position.count, uv = a.uv;
      m4.multiplyMatrices(inv, o.matrixWorld); n3.getNormalMatrix(m4);
      const mat = o.material, mc = mat.color || { r: 1, g: 1, b: 1 };
      const px = mat.map && uv ? texPixels(mat.map) : null;
      const vc = mat.vertexColors && a.color ? a.color : null;
      for (let i = 0; i < c; i++) {
        p.fromBufferAttribute(a.position, i).applyMatrix4(m4);
        pos[(vo + i) * 3] = p.x; pos[(vo + i) * 3 + 1] = p.y; pos[(vo + i) * 3 + 2] = p.z;
        if (a.normal) { n.fromBufferAttribute(a.normal, i).applyMatrix3(n3).normalize(); nor[(vo + i) * 3] = n.x; nor[(vo + i) * 3 + 1] = n.y; nor[(vo + i) * 3 + 2] = n.z; }
        let r = 1, gg = 1, b = 1;
        if (px) {
          let u = uv.getX(i), w = uv.getY(i);
          u -= Math.floor(u); w -= Math.floor(w);
          if (px.flipY) w = 1 - w;
          const x = Math.min(px.S - 1, (u * px.S) | 0), y = Math.min(px.S - 1, (w * px.S) | 0), q = (y * px.S + x) * 4;
          r = LIN[px.d[q]]; gg = LIN[px.d[q + 1]]; b = LIN[px.d[q + 2]];
        }
        if (vc) { r *= vc.getX(i); gg *= vc.getY(i); b *= vc.getZ(i); }
        col[(vo + i) * 3] = r * mc.r; col[(vo + i) * 3 + 1] = gg * mc.g; col[(vo + i) * 3 + 2] = b * mc.b;
      }
      if (g.index) { const ix = g.index; for (let i = 0; i < ix.count; i++) idx[io++] = ix.getX(i) + vo; }
      else for (let i = 0; i < c; i++) idx[io++] = i + vo;
      vo += c;
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    staticCache.set(key, geo);
  }
  const mk = (dbl ? 'd' : 's') + roughness;
  let mat = staticMats.get(mk);
  if (!mat) { mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0, side: dbl ? THREE.DoubleSide : THREE.FrontSide }); staticMats.set(mk, mat); }
  const lo = new THREE.Mesh(geo, mat);
  lo.name = (root.name || 'static') + '_lod';
  lo.userData.__lodLo = true;
  lo.castShadow = hi.some(o => o.castShadow); lo.receiveShadow = true;
  lo.visible = false;
  root.add(lo);
  const L = { root, hi, lo, dist, far: false };
  LODS.push(L);
  return L;
}
/* root 를 지우기 전에 부르면 목록에서 뺀다 (안 불러도 root 가 장면에서 빠지면 건너뛴다) */
export function removeStaticLOD(L) { const i = LODS.indexOf(L); if (i >= 0) LODS.splice(i, 1); if (L && L.lo.parent) L.lo.parent.remove(L.lo); }

/* ── 스킨 캐릭터(동물·아이)용 간단 LOD 묶음 ──
   const L = skinLOD(THREE, model);  매 프레임: L.update(거리)  → far 넘으면 한 덩어리, 2 m 여유
   한 덩어리는 만들 때 굽지 않고 쉬는 틈(requestIdleCallback)에 하나씩 굽는다 — 동물·아이를 한꺼번에 만들 때
   프레임이 길어지지 않게. 굽기 전에 멀어지면 그 자리에서 굽는다 */
let skinLodMat = null;
const skinLodBase = new Map();
const lodQueue = [];
let lodIdle = false;
function bakeIdle() {
  if (lodIdle || !lodQueue.length) return;
  lodIdle = true;
  const run = () => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 600 }) : setTimeout(go, 40));
  const go = () => {
    const L = lodQueue.shift();
    if (L) L.bake();
    if (lodQueue.length) run(); else lodIdle = false;
  };
  run();
}
export function skinLOD(THREE, root, { far = 22 } = {}) {
  if (PERF_OFF) return null;
  const hi = [];
  root.traverse(o => { if (o.isSkinnedMesh) hi.push(o); });
  if (hi.length < 2) return null;
  if (!skinLodMat) skinLodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
  const L = {
    hi, lod: null, on: false, far, failed: false,
    bake() {
      if (L.lod || L.failed) return L.lod;
      try { L.lod = flatSkinnedLOD(THREE, hi, skinLodMat, skinLodBase); } catch (e) { console.warn('[perf] skinLOD', e); }
      if (!L.lod) L.failed = true;
      return L.lod;
    },
    update(d) {
      const want = L.on ? d > far - 2 : d > far;
      if (want === L.on) return;
      if (want && !L.bake()) return;   // 못 구우면 원래 메시 그대로
      L.on = want;
      for (let k = 0; k < hi.length; k++) hi[k].visible = !want;
      L.lod.visible = want;
      L.lod.castShadow = want && hi[0].castShadow;
    }
  };
  lodQueue.push(L);
  bakeIdle();
  return L;
}

/* ── 5) createWarmup: 첫 화면 뒤에 붙는 물체를 "준비된 다음에" 보여 준다 (나타나는 순간 화면이 멈추지 않게) ──
   첫 화면 뒤에 성·손님·동물 등이 장면에 붙으면, 처음 그리는 프레임에서 셰이더 수십 개를 컴파일하고 텍스처를 올리느라
   0.2~0.5초씩 멈췄다. 그래서
     · Object3D.add 를 살짝 감싸 "새로 붙은 것"을 기록하고(arm() 뒤부터), 그리기 직전에(begin) 그 안의 재질 중
       프로그램이 아직 없는 것만 renderer.compile 로 몇 개씩(프레임당 budgetMs) 준비시킨다.
       KHR_parallel_shader_compile 이 있으면 컴파일은 GPU 쪽에서 따로 돌고, 다 됐는지는 막히지 않고 물어볼 수 있다.
     · 준비가 끝날 때까지 그 메시들은 그리는 동안만 잠깐 숨긴다 (모듈이 정한 visible 은 건드리지 않음 — end() 에서 되돌린다).
     · 셰이더가 다 되면 텍스처를 프레임마다 조금씩 올린(initTexture) 뒤 보여 준다.
     · 점광원 개수가 바뀌면 three 는 장면의 모든 셰이더를 다시 짠다. 그래서 나중에 붙을 점광원 수(reserveLights)만큼
       세기 0 인 자리표시 빛을 처음부터 두고, 진짜 점광원이 붙을 때마다 하나씩 뺀다 → 개수가 끝까지 같다.
   graphics.js 의 render() 가 부른다: warm.begin() → cull.begin() → 그리기 → cull.end() → warm.end() */
let WARM_HOOK = null;
export function createWarmup({ THREE, renderer, scene, camera, getTarget = () => null, getShadowTarget = () => null, reserveLights = 0, budgetMs = 5 }) {
  const props = renderer.properties;
  const proto = THREE.Object3D.prototype;
  if (!proto.__warmAdd0) {
    const add0 = proto.add;
    proto.__warmAdd0 = add0;
    proto.add = function (...objs) {
      const r = add0.apply(this, objs);
      if (WARM_HOOK) for (let i = 0; i < objs.length; i++) WARM_HOOK(objs[i]);
      return r;
    };
  }
  const recent = [];
  /* 자리표시 점광원 — 아주 멀리, 세기 0, 거리 1 */
  const reserve = [];
  if (!PERF_OFF) for (let i = 0; i < reserveLights; i++) {
    const L = new THREE.PointLight(0x000000, 0, 1, 2);
    L.name = 'warm_reserve_light'; L.userData.__reserve = true; L.position.set(0, -900, 0);
    scene.add(L); reserve.push(L);
  }
  /* renderer.compile(obj, camera, targetScene) 은 부를 때마다 targetScene 전체를 훑어 빛을 모은다.
     빛 목록만 돌려주는 대리 장면을 넘겨 그 비용을 없앤다 (안개·환경맵은 원래 장면 것을 그대로 본다).
     그림자 패스는 안개 없는 장면으로 그리므로 fog=null 인 대리 장면을 따로 둔다 */
  const lights = [];
  const litScene = Object.create(scene);
  litScene.traverseVisible = cb => { for (let i = 0; i < lights.length; i++) cb(lights[i]); };
  const shadowScene = Object.create(litScene);
  shadowScene.fog = null;
  function gatherLights() {
    lights.length = 0;
    scene.traverseVisible(o => { if (o.isLight) lights.push(o); });
  }

  const counted = new WeakSet();   // 이미 센 진짜 점광원
  const variants = new WeakMap();  // 재질 → 준비한 변형(인스턴싱·스킨 등) 집합
  const queued = new WeakSet();    // 이미 훑은 메시
  const jobs = [];                 // { meshes, progs:Set, tex:[], t0, pending, progOk }
  const compileQ = [];             // { o, job, shadow, mats, v }
  const held = new Set();
  const hidden = [];
  const st = { jobs: 0, held: 0, compiled: 0, shadow: 0, textures: 0, lightsLeft: reserve.length };

  /* 같은 재질이라도 메시 종류(인스턴싱·스킨·모프)·지오메트리 속성에 따라 프로그램이 다르다 */
  function variantOf(x) {
    const g = x.geometry, a = g ? g.attributes : {};
    return (x.isInstancedMesh ? (x.instanceColor ? 'ic' : 'i') : '') + (x.isSkinnedMesh ? 's' : '') +
      (g && g.morphAttributes && (g.morphAttributes.position || g.morphAttributes.normal || g.morphAttributes.color) ? 'm' : '') +
      (x.isPoints ? 'p' : x.isLine ? 'l' : x.isSprite ? 'S' : '') +
      (a.tangent ? 't' : '') + (a.uv1 ? '1' : '') + (a.color && a.color.itemSize === 4 ? 'a' : '');
  }
  function hasVariant(m, v) { const s = variants.get(m); return !!s && s.has(v); }
  function addVariant(m, v) { let s = variants.get(m); if (!s) variants.set(m, s = new Set()); s.add(v); }

  /* 그림자 지도용 깊이 재질 — three(WebGLShadowMap)가 고르는 것과 성질이 같으면 같은 프로그램을 쓴다 */
  const SHADOW_SIDE = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };
  const depthMats = new Map();
  function depthFor(m) {
    const side = m.shadowSide !== null && m.shadowSide !== undefined ? m.shadowSide : SHADOW_SIDE[m.side];
    const disp = !!(m.displacementMap && m.displacementScale !== 0);
    const k = `${!!m.map}|${!!m.alphaMap}|${m.alphaTest > 0}|${side}|${disp}`;
    let d = depthMats.get(k);
    if (!d) {
      d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      d.map = m.map || null; d.alphaMap = m.alphaMap || null; d.alphaTest = m.alphaTest; d.side = side;
      if (disp) { d.displacementMap = m.displacementMap; d.displacementScale = m.displacementScale; }
      depthMats.set(k, d);
    }
    return d;
  }

  function visibleChain(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
  function texReady(t) {
    if (!t.image || t.isRenderTargetTexture || t.isVideoTexture || t.version === 0) return true;
    const tp = props.get(t);
    return tp.__webglInit === true && tp.__version === t.version;
  }
  function texOf(m, out) {
    for (const k in m) { const v = m[k]; if (v && v.isTexture && !texReady(v)) out.push(v); }
    if (m.uniforms) for (const k in m.uniforms) { const u = m.uniforms[k]; const v = u && u.value; if (v && v.isTexture && !texReady(v)) out.push(v); }
  }
  function scan(o, job) {
    o.traverse(x => {
      if (x.isPointLight && !x.userData.__reserve && !counted.has(x) && visibleChain(x)) {
        counted.add(x);
        const p = reserve.pop();
        if (p) { p.removeFromParent(); st.lightsLeft = reserve.length; }
      }
      if (!x.material || !(x.isMesh || x.isPoints || x.isLine || x.isSprite) || queued.has(x)) return;
      queued.add(x);
      const nt = job.tex.length, v = variantOf(x);
      /* 스킨 메시의 뼈 텍스처도 미리 만들어 올린다 (처음 그릴 때 만들면 그 프레임이 길어진다) */
      if (x.isSkinnedMesh && x.skeleton) {
        if (!x.skeleton.boneTexture) x.skeleton.computeBoneTexture();
        if (x.skeleton.boneTexture && !texReady(x.skeleton.boneTexture)) job.tex.push(x.skeleton.boneTexture);
      }
      const ms = Array.isArray(x.material) ? x.material : [x.material];
      const need = [];
      for (const m of ms) {
        if (!m) continue;
        texOf(m, job.tex);   // 이미 그려진 재질이라도 텍스처가 새것일 수 있다 (옷 색 바꾸기 등)
        if (x.isMesh && x.castShadow) {   // 그림자용 프로그램
          const d = depthFor(m);
          if (!hasVariant(d, v)) {
            addVariant(d, v);
            const proxy = Object.create(x);   // 스킨·인스턴스·지오메트리는 원래 메시 것, 재질만 깊이 재질
            proxy.material = d;
            compileQ.push({ o: proxy, job, shadow: true, mats: [d], v });
          }
        }
        if (!hasVariant(m, v)) need.push(m);
      }
      if (need.length) compileQ.push({ o: x, job, shadow: false, mats: need, v });
      if (need.length || job.tex.length > nt) job.meshes.push(x);
    });
  }
  function collect() {
    if (!recent.length) return;
    const list = recent.splice(0);
    const set = new Set(list);
    const job = { meshes: [], progs: new Set(), tex: [], t0: performance.now(), pending: 0, progOk: false };
    const q0 = compileQ.length;
    for (const o of list) {
      /* 장면에 붙어 있고, 같은 묶음에 조상이 없을 때만 (조상 쪽에서 통째로 훑는다) */
      let p = o.parent, under = false, inScene = false;
      for (; p; p = p.parent) { if (set.has(p)) { under = true; break; } if (p === scene) { inScene = true; break; } }
      if (under || !inScene) continue;
      scan(o, job);
    }
    job.pending = compileQ.length - q0;
    if (!job.meshes.length && !job.pending) return;
    jobs.push(job);
    /* 점광원을 품은 메시는 숨기지 않는다 (숨기면 빛 개수가 바뀌어 모든 셰이더를 다시 짠다) */
    for (const m of job.meshes) if (!(m.children.length && m.getObjectByProperty('isLight', true))) held.add(m);
  }
  let one = null;
  const duck = { traverse(cb) { cb(one); }, traverseVisible() {} };
  function compileSome(t0) {
    if (!compileQ.length) return;
    gatherLights();
    const prev = renderer.getRenderTarget();
    try {
      while (compileQ.length && performance.now() - t0 < budgetMs) {
        const it = compileQ.shift();
        it.job.pending--;
        if (!it.shadow && it.mats.every(m => hasVariant(m, it.v))) continue;   // 앞에서 같은 재질·변형을 이미 준비함
        let tg;
        if (it.shadow) { tg = getShadowTarget() || getTarget(); if (!tg) continue; }   // 그림자 패스는 그림자 지도(렌더 타깃)에 그린다
        else tg = getTarget();   // 후처리를 쓰면 장면은 렌더 타깃에 그린다 → 톤매핑·색공간 정의가 달라진다
        renderer.setRenderTarget(tg);
        one = it.o;
        /* 재질 하나만 바꿔 넣은 대리 메시로 컴파일 (배열 재질 메시는 준비할 재질만) */
        if (!it.shadow && Array.isArray(it.o.material)) {
          for (const m of it.mats) { one = Object.create(it.o); one.material = m; renderer.compile(duck, camera, litScene); const p = props.get(m).currentProgram; if (p) it.job.progs.add(p); addVariant(m, it.v); }
        } else {
          renderer.compile(duck, camera, it.shadow ? shadowScene : litScene);
          for (const m of it.mats) { const p = props.get(m).currentProgram; if (p) it.job.progs.add(p); addVariant(m, it.v); }
        }
        if (it.shadow) st.shadow++; else st.compiled++;
      }
    } catch (e) { console.warn('[warmup]', e); compileQ.length = 0; for (const j of jobs) j.pending = 0; }
    one = null;
    renderer.setRenderTarget(prev);
  }
  function progsReady(job) {
    if (job.progOk) return true;
    if (job.pending > 0) return false;
    for (const p of job.progs) if (!p.isReady()) return false;
    return (job.progOk = true);
  }
  function step(t0) {
    /* 텍스처는 컴파일 중인 셰이더가 하나도 없을 때만 올린다 — GPU 쪽이 컴파일로 바쁠 때 올리면
       1024 텍스처 하나에 20~50 ms 씩 막혔다 (한가할 때는 1 ms) */
    let allOk = !compileQ.length;
    for (const job of jobs) if (!progsReady(job)) allOk = false;
    for (let j = 0; j < jobs.length; j++) {
      const job = jobs[j];
      const old = performance.now() - job.t0 > 5000;   // 어떤 이유로든 5초 넘게 걸리면 그냥 보여 준다
      if (!old) {
        if (!job.progOk || !allOk) continue;
        while (job.tex.length && performance.now() - t0 < budgetMs) {
          const t = job.tex.pop();
          if (texReady(t)) continue;
          try { renderer.initTexture(t); st.textures++; } catch (e) { /* 무시 */ }
        }
        if (job.tex.length) continue;
      }
      for (const m of job.meshes) held.delete(m);
      jobs.splice(j--, 1);
    }
    st.jobs = jobs.length; st.held = held.size;
  }

  /* 숨어 있거나 멀어서 아직 한 번도 안 그려진 물체(다른 탈것·무기·먼 마을)의 텍스처를 한가할 때 미리 올린다.
     안 그러면 처음 보이는 순간(탈것 바꾸기·멀리 이동) 그 프레임에 몰아서 올리느라 끊긴다 */
  const idleTex = [];
  function preloadTextures() {
    const seen = new Set();
    scene.traverse(o => {
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : null;
      if (ms) for (const m of ms) if (m) { const out = []; texOf(m, out); for (const t of out) if (!seen.has(t)) { seen.add(t); idleTex.push(t); } }
    });
    st.idleTex = idleTex.length;
  }
  function begin() {
    if (!WARM_HOOK) return;
    const t0 = performance.now();
    collect();
    compileSome(t0);
    step(t0);
    if (idleTex.length && !jobs.length && !compileQ.length) {   // 한 프레임에 하나씩, 할 일이 없을 때만
      const t = idleTex.pop();
      if (!texReady(t)) try { renderer.initTexture(t); st.textures++; } catch (e) { /* 무시 */ }
    }
    for (const m of held) if (m.visible) { m.visible = false; hidden.push(m); }
  }
  function end() {
    for (let i = 0; i < hidden.length; i++) hidden[i].visible = true;
    hidden.length = 0;
  }
  /* 첫 화면이 뜬 다음부터 기록한다 (그 전 것은 처음 compileAll 이 한꺼번에 준비한다) */
  function arm() { if (!PERF_OFF) WARM_HOOK = o => { if (recent.length > 20000) recent.length = 0; recent.push(o); }; }   // 문서 뷰처럼 안 그리는 동안 끝없이 쌓이지 않게
  /* 처음 화면용: 장면 전체를 (렌더 타깃 기준으로) 비동기 컴파일 */
  function compileAll() {
    if (!renderer.compileAsync) return Promise.resolve();
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(getTarget());
    try { return renderer.compileAsync(scene, camera); } finally { renderer.setRenderTarget(prev); }
  }
  return { begin, end, arm, compileAll, preloadTextures, stats: () => ({ ...st, idleLeft: idleTex.length }) };
}
