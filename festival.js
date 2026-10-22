/* ════════════════════════════════════════════════════════════════════
   festival.js — 상호랜드 중세 축제 (임금님 최상호의 마을 행사 2탄)
     ① 마상 창시합  : 마을 동쪽 들판(x 21, z 2~26) 울타리(틸트)를 사이에 두고 붉은 기사·푸른 기사가 말을 달려 3회전.
                     창이 방패에 맞으면 나무 조각이 튀며 부러지고(+1), 가끔 한쪽이 만화처럼 낙마(+3). 전령이 승자를 알린다.
     ② 활쏘기 대회  : 출발점 동쪽 활터(사로 x 19, 과녁 x 35 · z 63/67/71). 궁수 3명이 3발씩 쏜다.
                     플레이어가 활(5)을 들고 사로(흰 줄)에 서서 쏘면 점수가 매겨진다 → 1등이면 "임금님의 금화 10닢!".
     ③ 수확 축제 모닥불(밤, 가을·겨울) : 마을 서쪽 광장(-15, 22) 모닥불 + 불티 + 불빛, 마을 사람 6명이 손잡고 빙글빙글 춤,
                     류트 가락(WebAudio, 배경음이 꺼져 있을 때만).
     ④ 오월제 메이폴(봄·여름) : 광장에 메이폴이 솟고, 6명이 리본을 들고 엇갈려 돌며 기둥을 감는다. 끝나면 꽃종이.
     ⑤ 거리 광대(아무 때나) : 플레이어 근처 선술집 길가에 저글러(공 → 곤봉) + 불 뿜는 광대, 모자에 동전이 모인다.
     ⑥ 용 출현(밤, 드물게 10~15분) : 만화 같은 용이 마을 하늘을 가로질러 포효하고, 하늘로 (해 없는) 불을 뿜고
                     상호성 쪽으로 날아간다. 마을 사람은 도망(npcs.alarm), 근위병은 외친다.
   큰 축제(①~⑤)는 한 번에 하나만. 끝나고 1~2분 쉬고 다음 것(대략 2~3분마다 무언가 벌어진다).
   폭력은 만화처럼 넘어지는 정도(피 없음). 사람은 npcs.js 배우 API(addActor 등)로 만든다(맞으면 똑같이 넘어졌다 일어남).
   가볍게: 불꽃은 Points 하나(800), 나무 조각·꽃종이·동전은 InstancedMesh 하나(140), 추가 조명은 PointLight 1개(돌려 씀).

   ── portfolio.js 연결 (village = createVillage({...}) 바로 다음, 같은 .then 안) ──

        const { createFestival } = await import('./festival.js');   // 위쪽 import 묶음(createVillage 옆)에
        ...
          festival = createFestival({
            THREE, scene, camera, npcs: n, GLTFLoader, dracoLoader: draco, pathX, groundY,
            getPlayerPos: () => activePos(),
            isOnFoot: () => player.mode === 'onfoot',
            getNight: () => night,
            getSeason: () => seasons.season,
            isMusicOn: () => document.getElementById('g-music-btn')?.getAttribute('aria-pressed') === 'true',
            isVisible: () => driveActive,
            onEvent: text => toast(text, 2600),
            getPlayerWeapon: () => (weapons ? weapons.current : 'none'),
            bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
          });
      step(dt) 안 village.update 다음 줄 (반드시 npcs.update 뒤 — 기사를 말 안장에 붙인다):
          if (festival) festival.update(dt, t);
      (let festival = null; 을 let npcs = null, events = null, village = null; 옆에 둔다)

      나무 비우기 (월드 로딩 콜백, clearTrees 줄들 옆):
          const { FESTIVAL_CLEAR } = await import('./festival.js');   // 위쪽 PONDS/CASTLE_CLEAR import 옆에
          clearTrees(gltf.scene, FESTIVAL_CLEAR.spots, FESTIVAL_CLEAR.r);

      활쏘기 과녁에 화살이 꽂히게 (weapons createWeapons 옵션 colliders 를 바꾼다, 선택이지만 추천):
          colliders: () => festival ? [...stations.map(s => s.group), ...festival.colliders()] : stations.map(s => s.group),
        → 화살이 과녁에 박히고(attach), festival 이 그 화살을 찾아 점수를 매긴다.
        이 연결이 없어도 날아가는 화살(scene 의 userData.len 객체)이 과녁 면을 지나가는 걸 보고 점수를 매긴다(화살은 통과).
        다른 모듈에서 직접 알릴 땐 festival.scoreArrow(tipPos) (사로에 서 있을 때만 점수).

   ── 옵션 ──
     THREE, scene, npcs(addActor 있는 판), pathX(z), groundY(x, z)       — 필수
     camera            불꽃 입자 크기 계산(없으면 대충)
     GLTFLoader, dracoLoader   말(models/vehicles/horse.glb) — 없으면 창시합을 건너뛴다
     getPlayerPos()    {x, z}    isOnFoot()  getNight() 0..1   getSeason() 'autumn'|'winter'|'spring'|'summer'
     isMusicOn()       배경음이 켜져 있으면 류트를 안 켜고, 효과음을 줄인다     isMuted() true 면 소리 없음
     isVisible()       false 면 새 축제를 시작하지 않는다          onEvent(text) 알림
     getPlayerWeapon() 'bow'|'crossbow'|... (기본 window.__weapons.current)
     bounds            {minX,maxX,minZ,maxZ}    debug  (기본 ?test 일 때 window.__festival)
   ── 반환 ──
     update(dt, t), dispose(), state(), trigger(name)  name = 'joust'|'archery'|'bonfire'|'maypole'|'performers'|'dragon'|'stop'
     colliders() → [활터 과녁 그룹]     scoreArrow(pos) → 점수(또는 -1)
   콘솔(?test): __festival.joust(), .archery(), .bonfire(), .maypole(), .performers(), .dragon(), .stop(), .state()
   ════════════════════════════════════════════════════════════════════ */

export const FESTIVAL_SITES = {   // 마을 소품(오두막·밭·풍차)·동물 서식지·아이들 놀이터와 겹치지 않는 빈터
  joust: { x: 27, z: 2, z0: -8, z1: 12, name: '마상 창시합장' },
  archery: { lineX: 19, tx: 35, tz: [63, 67, 71], x: 27, z: 67, name: '활터' },
  green: { x: -19, z: 47, name: '마을 광장' },
};
/* portfolio.js clearTrees(gltf.scene, FESTIVAL_CLEAR.spots, FESTIVAL_CLEAR.r) */
export const FESTIVAL_CLEAR = {
  r: 4.6,
  spots: [
    [27, -9], [27, -3], [27, 3], [27, 9], [27, 13], [22, -6], [22, 0], [22, 6], [32, -4], [32, 4], [32, 10],
    [17, 60], [17, 66], [17, 72], [22, 67], [27, 63], [27, 71], [31, 67], [35, 63], [35, 67], [35, 71],
    [-19, 47], [-15, 47], [-23, 47], [-19, 43], [-19, 51],
  ],
};

const D2R = Math.PI / 180;
const MAIN_FIRST = [45, 75], MAIN_GAP = [65, 110], DRAGON_EVERY = [600, 900];
const SITE_NEAR = 90;

export function createFestival({
  THREE, scene, camera = null, npcs, GLTFLoader = null, dracoLoader = null,
  pathX = () => 0, groundY = () => 0,
  getPlayerPos, isOnFoot = () => true, getNight = () => 0, getSeason = () => 'autumn',
  isMusicOn = () => false, isMuted = () => false,
  isVisible = () => document.body.dataset.view !== 'doc',
  onEvent = null, getPlayerWeapon = null, bounds = null,
  debug = typeof location !== 'undefined' && /[?&]test\b/.test(location.search),
} = {}) {
  const NOOP = { update() {}, dispose() {}, state: () => ({}), trigger: () => false, colliders: () => [], scoreArrow: () => -1 };
  if (!THREE || !scene || !npcs || !npcs.addActor) return NOOP;
  const V3 = THREE.Vector3, Q = THREE.Quaternion;
  const B = bounds || npcs.bounds || { minX: -42, maxX: 42, minZ: -84, maxZ: 84 };
  const rr = (a, b) => a + (b - a) * Math.random();
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const toast = t => { if (onEvent) onEvent(t); };
  const say = (n, t, life = 1.8, col = null) => { if (n && !n.off) npcs.say(n, t, life, col); };
  const weaponNow = () => { try { return getPlayerWeapon ? getPlayerWeapon() : (globalThis.__weapons ? globalThis.__weapons.current : 'none'); } catch { return 'none'; } };
  const playerPos = () => { const p = getPlayerPos ? getPlayerPos() : null; return p && Number.isFinite(p.x) ? p : null; };
  const distP = (x, z) => { const p = playerPos(); return p ? Math.hypot(x - p.x, z - p.z) : 1e9; };
  const disposables = [];
  const keep = x => { disposables.push(x); return x; };
  const roots = [];
  const addRoot = o => { scene.add(o); roots.push(o); return o; };
  const _v = new V3(), _v2 = new V3(), _v3 = new V3(), _v4 = new V3();

  function turn(n, target, dt, rate = 5) {
    const d = wrap(target - n.rot), m = rate * dt;
    n.rot += Math.abs(d) <= m ? d : Math.sign(d) * m;
  }
  function stepTo(n, tx, tz, speed, dt, face = null) {
    const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
    if (d < 0.06) { npcs.actorPlay(n, 'Idle', 0.3); if (face !== null) turn(n, face, dt); return true; }
    const sp = Math.min(speed, d / dt);
    n.x += dx / d * sp * dt; n.z += dz / d * sp * dt;
    turn(n, Math.atan2(dx, dz), dt, 6);
    if (speed > 3.2 && n.actions.Run) npcs.actorPlay(n, 'Run', 0.25, Math.max(0.6, speed / 5));
    else npcs.actorPlay(n, 'Walk', 0.3, clamp(speed / 1.3, 0.5, 2.2));
    return false;
  }
  function villagers() {
    const out = [];
    for (const o of npcs.list()) if (!o.off && !o.guard && !o.barkeeper && !o.npc.actor) out.push(o);
    return out;
  }
  /* 근처 마을 사람: 축제 쪽을 보며 환호 (1.4초마다) */
  function crowdTick(dt, ev, cx, cz, r, lines, cheer = true) {
    ev.crowdT = (ev.crowdT || 0) - dt;
    if (ev.crowdT > 0) return;
    ev.crowdT = 1.4;
    let k = 0, said = 0;
    for (const o of villagers()) {
      if (k >= 8) break;
      if (o.seated || Math.hypot(o.pos.x - cx, o.pos.z - cz) > r) continue;
      if (npcs.watch(o.npc, { x: cx, z: cz }, rr(2.5, 4), cheer)) {
        k++;
        if (lines && said < 1 && Math.random() < 0.3) { say(o.npc, pick(lines), 1.6); said++; }
      }
    }
  }
  /* (선택) npcs.js 가 gather 를 내보내면 진짜로 구경꾼이 모인다 */
  function gatherCrowd(obj, cx, cz, r, max, semi, faceRot) {
    obj.active = true; obj.x = cx; obj.z = cz; obj.phase = 0;
    if (typeof npcs.gather === 'function') { try { npcs.gather(obj, cx, cz, r, max, semi, faceRot); } catch (e) { /* 없는 판 */ } }
  }
  function dirText(x, z) {
    const p = playerPos(); if (!p) return '';
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < 18) return '바로 근처';
    const names = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];   // 북 = 성문 쪽(-z), 동 = +x
    const i = ((Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) % 8) + 8) % 8;
    return `${names[i]}쪽 약 ${Math.round(d / 5) * 5} m`;
  }

  /* ════ 소리 (WebAudio) ════ */
  let actx = null, noiseB = null;
  function audio() {
    if (isMuted()) return null;
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx.state === 'closed' ? null : actx;
  }
  function noise(ctx) {
    if (noiseB) return noiseB;
    noiseB = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseB.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseB;
  }
  function volAt(x, z, base, range) {
    const d = x == null ? 0 : distP(x, z);
    return base * Math.max(0, 1 - d / range) * (isMusicOn() ? 0.6 : 1);
  }
  /* 거른 잡음 한 번 */
  function sNoise(x, z, { base = 0.1, range = 60, dur = 0.3, type = 'bandpass', f0 = 1000, f1 = null, q = 1, attack = 0.01, delay = 0 } = {}) {
    const ctx = audio(); if (!ctx) return;
    const v = volAt(x, z, base, range); if (v < 0.004) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = noise(ctx);
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t0, Math.random() * 0.3); src.stop(t0 + dur + 0.05);
  }
  function sTone(x, z, { base = 0.1, range = 60, dur = 0.3, type = 'sine', f0 = 440, f1 = null, attack = 0.01, delay = 0, lp = 0 } = {}) {
    const ctx = audio(); if (!ctx) return;
    const v = volAt(x, z, base, range); if (v < 0.004) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let last = o;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); last = f; }
    last.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  const SND = {
    crack: (x, z) => { sNoise(x, z, { base: 0.22, range: 80, dur: 0.28, type: 'highpass', f0: 1800, q: 0.7 }); sTone(x, z, { base: 0.18, range: 80, dur: 0.2, f0: 160, f1: 55 }); },
    cheer: (x, z, big = 1) => { sNoise(x, z, { base: 0.07 * big, range: 70, dur: 1.7, f0: 900, f1: 1300, q: 0.9, attack: 0.25 }); sNoise(x, z, { base: 0.04 * big, range: 70, dur: 1.3, f0: 2200, q: 1.5, attack: 0.2, delay: 0.15 }); },
    hoof: (x, z) => sTone(x, z, { base: 0.08, range: 45, dur: 0.07, f0: 110, f1: 55 }),
    twang: (x, z) => sTone(x, z, { base: 0.07, range: 40, dur: 0.18, type: 'triangle', f0: 420, f1: 300 }),
    thunk: (x, z) => { sTone(x, z, { base: 0.1, range: 45, dur: 0.1, f0: 200, f1: 90 }); sNoise(x, z, { base: 0.05, range: 45, dur: 0.06, f0: 1500, q: 2 }); },
    whoosh: (x, z) => sNoise(x, z, { base: 0.14, range: 50, dur: 1.1, f0: 350, f1: 1800, q: 1.1, attack: 0.12 }),
    roar: () => {
      sTone(null, null, { base: 0.2, dur: 2.4, type: 'sawtooth', f0: 95, f1: 48, attack: 0.25, lp: 700 });
      sTone(null, null, { base: 0.12, dur: 2.2, type: 'square', f0: 63, f1: 40, attack: 0.3, lp: 400, delay: 0.05 });
      sNoise(null, null, { base: 0.16, dur: 2.3, type: 'lowpass', f0: 900, f1: 300, attack: 0.3 });
    },
    fanfare: (x, z) => {
      const notes = [[523, 0, 0.18], [659, 0.18, 0.18], [784, 0.36, 0.18], [1047, 0.54, 0.6]];
      for (const [f, d, l] of notes) sTone(x, z, { base: 0.06, range: 90, dur: l, type: 'sawtooth', f0: f, attack: 0.02, delay: d, lp: 2400 });
    },
    coin: (x, z) => { sTone(x, z, { base: 0.05, range: 25, dur: 0.12, type: 'square', f0: 1800, lp: 4000 }); sTone(x, z, { base: 0.04, range: 25, dur: 0.18, type: 'square', f0: 2400, delay: 0.07, lp: 4000 }); },
    crackle: (x, z) => sNoise(x, z, { base: 0.05, range: 30, dur: 0.05, type: 'highpass', f0: 2500, q: 0.5 }),
  };
  /* 류트 가락 (도리안 춤곡) — 배경음이 꺼져 있을 때만 */
  const LUTE_MEL = [[0, 1], [2, 0.5], [3, 0.5], [5, 1], [3, 0.5], [2, 0.5], [0, 1], [-2, 1], [0, 0.5], [2, 0.5], [3, 1], [2, 1], [0, 2],
    [7, 1], [5, 0.5], [3, 0.5], [5, 1], [7, 1], [9, 0.5], [7, 0.5], [5, 1], [3, 1], [2, 0.5], [0, 0.5], [2, 1], [0, 2]];
  const lute = { on: false, next: 0, i: 0, x: 0, z: 0 };
  function pluck(ctx, f, t0, v) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2.01;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t0); lp.frequency.exponentialRampToValueAtTime(700, t0 + 0.5);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(ctx.destination);
    o.start(t0); o2.start(t0); o.stop(t0 + 0.8); o2.stop(t0 + 0.8);
  }
  function luteTick() {
    if (!lute.on || isMusicOn()) return;
    const v = volAt(lute.x, lute.z, 0.06, 45); if (v < 0.004) return;
    const ctx = audio(); if (!ctx) return;
    const beat = 0.3;
    if (lute.next < ctx.currentTime) lute.next = ctx.currentTime + 0.05;
    while (lute.next < ctx.currentTime + 0.25) {
      const [semi, len] = LUTE_MEL[lute.i % LUTE_MEL.length];
      pluck(ctx, 293.66 * Math.pow(2, semi / 12), lute.next, v);
      if (lute.i % 4 === 0) pluck(ctx, 146.83, lute.next, v * 0.6);          // 낮은 D 받침
      lute.next += len * beat; lute.i++;
    }
  }

  /* ════ 불 입자 (Points 하나) ════ */
  const FX_MAX = 800;
  const fxPos = new Float32Array(FX_MAX * 3), fxCol = new Float32Array(FX_MAX * 4), fxSize = new Float32Array(FX_MAX);
  const fxVel = new Float32Array(FX_MAX * 3), fxLife = new Float32Array(FX_MAX), fxMaxL = new Float32Array(FX_MAX);
  const fxS0 = new Float32Array(FX_MAX), fxS1 = new Float32Array(FX_MAX), fxG = new Float32Array(FX_MAX), fxK = new Uint8Array(FX_MAX);
  for (let i = 0; i < FX_MAX; i++) fxPos[i * 3 + 1] = -9999;
  const fxGeo = keep(new THREE.BufferGeometry());
  const fxPosA = new THREE.BufferAttribute(fxPos, 3).setUsage(THREE.DynamicDrawUsage);
  const fxColA = new THREE.BufferAttribute(fxCol, 4).setUsage(THREE.DynamicDrawUsage);
  const fxSizeA = new THREE.BufferAttribute(fxSize, 1).setUsage(THREE.DynamicDrawUsage);
  fxGeo.setAttribute('position', fxPosA); fxGeo.setAttribute('col', fxColA); fxGeo.setAttribute('size', fxSizeA);
  const fxMat = keep(new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    vertexShader: `uniform float uScale; attribute float size; attribute vec4 col; varying vec4 vC;
      void main(){ vC = col; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uScale / max(0.2, -mv.z); }`,
    fragmentShader: `varying vec4 vC;
      void main(){ vec2 d = gl_PointCoord - 0.5; float a = clamp(1.0 - length(d) * 2.0, 0.0, 1.0); a *= a;
        gl_FragColor = vec4(vC.rgb * vC.a * a, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const fxPts = addRoot(new THREE.Points(fxGeo, fxMat));
  fxPts.frustumCulled = false; fxPts.visible = false; fxPts.renderOrder = 6;
  let fxFree = 0, fxAlive = 0;
  /* kind 1 불꽃(노랑→주황→빨강) 2 불티(깜빡) 3 반짝(흰 금) */
  function fx(kind, x, y, z, vx, vy, vz, life, s0, s1, g = -1) {
    for (let k = 0; k < FX_MAX; k++) {
      const i = (fxFree + k) % FX_MAX;
      if (fxK[i]) continue;
      fxFree = (i + 1) % FX_MAX;
      fxK[i] = kind; fxLife[i] = fxMaxL[i] = life; fxS0[i] = s0; fxS1[i] = s1; fxG[i] = g;
      fxPos[i * 3] = x; fxPos[i * 3 + 1] = y; fxPos[i * 3 + 2] = z;
      fxVel[i * 3] = vx; fxVel[i * 3 + 1] = vy; fxVel[i * 3 + 2] = vz;
      fxAlive++;
      return i;
    }
    return -1;
  }
  function fxUpdate(dt, t) {
    if (camera && camera.projectionMatrix) fxMat.uniforms.uScale.value = innerHeight * 0.5 * camera.projectionMatrix.elements[5] * Math.min(2, devicePixelRatio || 1);
    if (!fxAlive) { fxPts.visible = false; return; }
    fxPts.visible = true;
    const drag = Math.exp(-dt * 1.6);
    for (let i = 0; i < FX_MAX; i++) {
      const k = fxK[i]; if (!k) continue;
      const j = i * 3, c = i * 4;
      fxLife[i] -= dt;
      if (fxLife[i] <= 0) { fxK[i] = 0; fxAlive--; fxPos[j + 1] = -9999; fxCol[c + 3] = 0; fxSize[i] = 0; continue; }
      const a = 1 - fxLife[i] / fxMaxL[i];
      fxVel[j] *= drag; fxVel[j + 1] = fxVel[j + 1] * drag - fxG[i] * dt; fxVel[j + 2] *= drag;
      if (k === 2) { fxVel[j] += Math.sin(t * 3 + i) * dt * 0.8; fxVel[j + 2] += Math.cos(t * 2.6 + i) * dt * 0.8; }
      fxPos[j] += fxVel[j] * dt; fxPos[j + 1] += fxVel[j + 1] * dt; fxPos[j + 2] += fxVel[j + 2] * dt;
      fxSize[i] = fxS0[i] + (fxS1[i] - fxS0[i]) * a;
      if (k === 1) {
        if (a < 0.35) { const u = a / 0.35; fxCol[c] = 3 - 0.4 * u; fxCol[c + 1] = 2.3 - 1.3 * u; fxCol[c + 2] = 1.1 - 0.85 * u; }
        else { const u = (a - 0.35) / 0.65; fxCol[c] = 2.6 - 2 * u; fxCol[c + 1] = 1.0 - 0.85 * u; fxCol[c + 2] = 0.25 - 0.22 * u; }
        fxCol[c + 3] = Math.min(1, a * 10) * Math.pow(1 - a, 1.1);
      } else if (k === 2) {
        fxCol[c] = 2.8; fxCol[c + 1] = 1.2; fxCol[c + 2] = 0.3;
        fxCol[c + 3] = (1 - a) * (0.55 + 0.45 * Math.sin(t * 20 + i * 1.7));
      } else {
        fxCol[c] = 3; fxCol[c + 1] = 2.5; fxCol[c + 2] = 1.4; fxCol[c + 3] = 1 - a;
      }
    }
    fxPosA.needsUpdate = true; fxColA.needsUpdate = true; fxSizeA.needsUpdate = true;
  }

  /* ════ 조각 (나무 조각·꽃종이·동전, InstancedMesh 하나) ════ */
  const DB_MAX = 140;
  const dbMesh = addRoot(new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1, 1, 1)), keep(new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.1 })), DB_MAX));
  dbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  dbMesh.frustumCulled = false; dbMesh.castShadow = true; dbMesh.visible = false;
  const db = [];
  const _m4 = new THREE.Matrix4(), _q = new Q(), _e = new THREE.Euler(), _s = new V3(), _col = new THREE.Color();
  for (let i = 0; i < DB_MAX; i++) {
    db.push({ on: false, p: new V3(), v: new V3(), r: new V3(), av: new V3(), s: new V3(), life: 0, max: 1, flutter: 0, rest: false });
    dbMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); dbMesh.setColorAt(i, _col.set(0xffffff));
  }
  let dbFree = 0, dbAlive = 0;
  function debris(x, y, z, vx, vy, vz, sx, sy, sz, color, life = 3, flutter = 0) {
    for (let k = 0; k < DB_MAX; k++) {
      const i = (dbFree + k) % DB_MAX, d = db[i];
      if (d.on) continue;
      dbFree = (i + 1) % DB_MAX;
      d.on = true; d.p.set(x, y, z); d.v.set(vx, vy, vz); d.r.set(rr(0, 6), rr(0, 6), rr(0, 6));
      d.av.set(rr(-12, 12), rr(-12, 12), rr(-12, 12)); d.s.set(sx, sy, sz); d.life = d.max = life; d.flutter = flutter; d.rest = false;
      dbMesh.setColorAt(i, _col.set(color)); dbMesh.instanceColor.needsUpdate = true;
      dbAlive++;
      return d;
    }
    return null;
  }
  function dbUpdate(dt) {
    if (!dbAlive) { dbMesh.visible = false; return; }
    dbMesh.visible = true;
    for (let i = 0; i < DB_MAX; i++) {
      const d = db[i]; if (!d.on) continue;
      d.life -= dt;
      if (d.life <= 0) { d.on = false; dbAlive--; dbMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); continue; }
      if (!d.rest) {
        if (d.flutter) { d.v.multiplyScalar(Math.exp(-dt * 2.2)); d.v.y -= 2.2 * dt; d.v.x += Math.sin(d.life * 7 + i) * dt * 1.5; }
        else d.v.y -= 9.8 * dt;
        d.p.addScaledVector(d.v, dt);
        d.r.x += d.av.x * dt; d.r.y += d.av.y * dt; d.r.z += d.av.z * dt;
        const gy = groundY(d.p.x, d.p.z) + d.s.y * 0.5;
        if (d.p.y < gy) {
          d.p.y = gy;
          if (d.v.y < -1.5 && !d.flutter) { d.v.y *= -0.3; d.v.x *= 0.5; d.v.z *= 0.5; d.av.multiplyScalar(0.5); }
          else { d.rest = true; d.r.x = d.flutter ? 0 : Math.PI / 2 * Math.round(d.r.x / (Math.PI / 2)); d.r.z = 0; }
        }
      }
      const sc = Math.min(1, d.life / 0.6);
      _e.set(d.r.x, d.r.y, d.r.z); _q.setFromEuler(_e);
      dbMesh.setMatrixAt(i, _m4.compose(d.p, _q, _s.copy(d.s).multiplyScalar(sc)));
    }
    dbMesh.instanceMatrix.needsUpdate = true;
  }
  const CONFETTI = [0xe83a5a, 0xf5c400, 0x3a8ee8, 0x5ac85a, 0xb45ae8, 0xff8a2a, 0xffffff];
  function confetti(x, y, z, n = 40, spread = 4) {
    for (let k = 0; k < n; k++) debris(x + rr(-0.5, 0.5), y, z + rr(-0.5, 0.5), rr(-spread, spread), rr(4, 8), rr(-spread, spread), 0.09, 0.006, 0.06, pick(CONFETTI), rr(3, 5), 1);
  }

  /* ════ 추가 조명 1개 (모닥불·불 뿜기·용 불길이 돌려 쓴다) ════ */
  const light = addRoot(new THREE.PointLight(0xff8a3a, 0, 16, 2));
  light.castShadow = false;
  let lightWant = null;
  function wantLight(x, y, z, I, color = 0xff8a3a, dist = 16, decay = 2) {
    if (!lightWant || I > lightWant.I) lightWant = { x, y, z, I, color, dist, decay };
  }
  function lightApply() {
    if (!lightWant) { light.intensity = 0; return; }
    const w = lightWant;
    light.position.set(w.x, w.y, w.z); light.intensity = w.I; light.color.set(w.color); light.distance = w.dist; light.decay = w.decay;
    lightWant = null;
  }

  /* ════ 재질·텍스처 ════ */
  const M = {
    wood: keep(new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.85 })),
    darkWood: keep(new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9 })),
    straw: keep(new THREE.MeshStandardMaterial({ color: 0xd8b860, roughness: 1, flatShading: true })),
    stone: keep(new THREE.MeshStandardMaterial({ color: 0x8a847c, roughness: 0.95, flatShading: true })),
    gold: keep(new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 0.8, roughness: 0.3, emissive: 0x3a2400, emissiveIntensity: 0.5 })),
    white: keep(new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.8 })),
    steel: keep(new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.6, roughness: 0.35 })),
    char: keep(new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 1, emissive: 0xff5a10, emissiveIntensity: 0 })),
    pumpkin: keep(new THREE.MeshStandardMaterial({ color: 0xe8781e, roughness: 0.7, flatShading: true })),
    leaf: keep(new THREE.MeshStandardMaterial({ color: 0x3a8a32, roughness: 0.8, flatShading: true })),
  };
  function canvasTex(w, h, draw, repeat = null) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return keep(t);
  }
  const TEAM = [{ name: '붉은 기사', c: 0xc0202a, css: '#c0202a', hex: '#7a1010' }, { name: '푸른 기사', c: 0x2a55c8, css: '#2a55c8', hex: '#10307a' }];
  function teamTex(k) {
    return canvasTex(128, 64, (c, w, h) => {
      c.fillStyle = TEAM[k].css; c.fillRect(0, 0, w, h);
      c.fillStyle = '#e8c040'; c.fillRect(0, 0, w, 6); c.fillRect(0, h - 6, w, 6);
      c.fillStyle = '#f4f0e6';
      if (k === 0) { c.fillRect(w / 2 - 5, 10, 10, h - 20); c.fillRect(w / 2 - 18, h / 2 - 5, 36, 10); }   // 십자
      else { c.beginPath(); c.arc(w / 2, h / 2, 14, 0, Math.PI * 2); c.fill(); c.fillStyle = TEAM[k].css; c.beginPath(); c.arc(w / 2 + 6, h / 2 - 3, 12, 0, Math.PI * 2); c.fill(); }   // 초승달
      for (let x = 0; x < w; x += 16) { c.fillStyle = '#e8c040'; c.beginPath(); c.moveTo(x, h - 6); c.lineTo(x + 8, h); c.lineTo(x + 16, h - 6); c.fill(); }
    });
  }
  const teamMats = [0, 1].map(k => keep(new THREE.MeshStandardMaterial({ map: teamTex(k), side: THREE.DoubleSide, roughness: 0.85 })));
  const teamSolid = [0, 1].map(k => keep(new THREE.MeshStandardMaterial({ color: TEAM[k].c, roughness: 0.6, side: THREE.DoubleSide })));
  const stripeTex = (a, b, n = 8) => canvasTex(64, 64, (c, w, h) => {
    for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? b : a; c.fillRect(0, i * h / n, w, h / n); }
  });
  const flagGeo = keep(new THREE.PlaneGeometry(0.9, 0.6, 6, 2));
  const flags = [];
  function makeFlagPole(x, z, k, h = 4) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.04, 0.05, h, 6)), M.wood); pole.position.y = h / 2; g.add(pole);
    const knob = new THREE.Mesh(keep(new THREE.SphereGeometry(0.08, 8, 6)), M.gold); knob.position.y = h + 0.05; g.add(knob);
    const flag = new THREE.Mesh(flagGeo.clone(), teamMats[k]); flag.position.set(0.47, h - 0.4, 0); g.add(flag);
    keep(flag.geometry); flag.userData.base = Float32Array.from(flag.geometry.attributes.position.array);
    flags.push(flag);
    g.position.set(x, groundY(x, z), z);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  function waveFlags(t) {
    const p = playerPos(); if (!p) return;
    for (const f of flags) {
      if (!f.visible || !f.parent || !f.parent.visible) continue;
      f.getWorldPosition(_v); if (Math.hypot(_v.x - p.x, _v.z - p.z) > 60) continue;
      const pos = f.geometry.attributes.position, base = f.userData.base;
      for (let i = 0; i < pos.count; i++) { const u = base[i * 3] + 0.45; pos.setZ(i, Math.sin(t * 5 - u * 5 + f.id) * 0.08 * u); }
      pos.needsUpdate = true;
    }
  }

  /* ════ 배우 (npcs.addActor) ════ */
  const GEN_RE = ['noble', 'maid', 'baker', 'herbalist', 'traveler', 'monk', 'bard', 'blacksmith'];
  const gen = [];
  function actor(i) {
    if (!gen[i]) { const n = npcs.addActor(GEN_RE[i], { noAggro: true }); n.propShow = false; gen[i] = n; }
    return gen[i];
  }
  function tintCloth(n, hex) {
    for (const m of n.meshes || []) {
      if (!m.material || !/Cloth/i.test(m.material.name || '')) continue;
      m.material = keep(m.material.clone()); m.material.color.set(hex);
    }
  }
  const pendingOff = new Set();
  function release(n) { if (n) pendingOff.add(n); }
  function offTick() { for (const n of pendingOff) if (npcs.actorOff(n)) { pendingOff.delete(n); n.fest = null; } }
  /* 걸어 들어오기: 플레이어 가까이면 6 m 밖에서 나타나 걸어온다 */
  function place(n, x, z, face, walk = true) {
    pendingOff.delete(n);
    const p = playerPos();
    let sx = x, sz = z;
    if (walk && p && Math.hypot(x - p.x, z - p.z) < 45) {
      const a = Math.atan2(x - p.x, z - p.z); sx = clamp(x + Math.sin(a) * 6, B.minX + 1, B.maxX - 1); sz = clamp(z + Math.cos(a) * 6, B.minZ + 1, B.maxZ - 1);
    }
    const arrived = Math.hypot(sx - x, sz - z) < 0.1;
    npcs.actorOn(n, sx, sz, arrived ? face : Math.atan2(x - sx, z - sz));
    n.fest = { tx: x, tz: z, face, arrived, cheerT: 0 };
  }
  function walkIn(n, dt, sp = 1.6) {
    const f = n.fest; if (!f || !npcs.isActing(n)) return false;
    if (f.arrived) return true;
    if (stepTo(n, f.tx, f.tz, sp, dt)) f.arrived = true;
    return f.arrived;
  }
  /* 서서 보기 (cheerT 동안 Cheers — npcs.js 가 서 있는 배우에겐 Idle + 두 팔 번쩍 몸짓으로 바꿔 튼다) */
  function standBy(n, dt, faceTo = null) {
    if (!walkIn(n, dt)) return;
    const f = n.fest;
    if (f.cheerT > 0) { f.cheerT -= dt; npcs.actorPlay(n, 'Cheers', 0.25); }
    else npcs.actorPlay(n, 'Idle', 0.35);
    turn(n, faceTo ? Math.atan2(faceTo.x - n.x, faceTo.z - n.z) : f.face, dt, 4);
  }
  const cheer = (n, s = 2.2) => { if (n && n.fest) n.fest.cheerT = s; };

  /* ── 뼈 자세 덧씌우기 (vehicles.js 와 같은 '사람 공간' 회전). 믹서가 갱신 안 한 프레임엔 누적되지 않게 기준 자세를 기억한다 ── */
  const AX = new V3(1, 0, 0), AY = new V3(0, 1, 0), AZ = new V3(0, 0, 1);
  const _qa = new Q(), _qb = new Q(), _qc = new Q(), _qp = new Q(), _qd = new Q(), _qi = new Q(), _qr = new Q();
  function bonesOf(n) {
    if (n.festB) return n.festB;
    const b = nm => n.root.getObjectByName(nm) || n.root.getObjectByName(nm.replace('.', ''));
    return (n.festB = {
      armL: [b('UpperArm.L'), b('LowerArm.L')], armR: [b('UpperArm.R'), b('LowerArm.R')],
      legL: [b('UpperLeg.L'), b('LowerLeg.L')], legR: [b('UpperLeg.R'), b('LowerLeg.R')],
      hips: b('Hips'), head: b('Head'), handL: b('Hand.L'), handR: b('Hand.R'), spine: b('Spine'),
    });
  }
  function rotBone(n, bone, R) {
    if (!bone || !bone.parent) return;
    n.body.getWorldQuaternion(_qc);
    bone.parent.getWorldQuaternion(_qp);
    _qd.copy(_qc).multiply(R).multiply(_qi.copy(_qc).invert());
    _qr.copy(_qp).invert().multiply(_qd).multiply(_qp);
    bone.quaternion.premultiply(_qr);
  }
  function layerBase(b) {
    const u = b.userData;
    if (u.fq && b.quaternion.equals(u.fq)) b.quaternion.copy(u.bq);
    else (u.bq || (u.bq = new Q())).copy(b.quaternion);
  }
  const layerDone = b => (b.userData.fq || (b.userData.fq = new Q())).copy(b.quaternion);
  /* spec: legL/legR [허벅지(음수=앞), 벌림, 무릎], armL/armR [팔(음수=앞), 아래팔, 안쪽(음수=옆으로 들기), 아래팔 Y회전], spine [앞숙임] */
  const _list = [];
  function pose(n, spec) {
    if (!n || n.off) return;
    const Bn = bonesOf(n);
    _list.length = 0;
    for (const k of ['legL', 'legR', 'armL', 'armR']) if (spec[k] && Bn[k][0] && Bn[k][1]) _list.push(Bn[k][0], Bn[k][1]);
    if (spec.spine != null && Bn.spine) _list.push(Bn.spine);
    for (const b of _list) layerBase(b);
    if (spec.spine != null && Bn.spine) rotBone(n, Bn.spine, _qa.setFromAxisAngle(AX, spec.spine * D2R));
    for (const [k, side] of [['legL', 1], ['legR', -1]]) {
      const s = spec[k]; if (!s || !Bn[k][0]) continue;
      _qa.setFromAxisAngle(AZ, side * s[1] * D2R).multiply(_qb.setFromAxisAngle(AX, s[0] * D2R));
      rotBone(n, Bn[k][0], _qa);
      rotBone(n, Bn[k][1], _qb.setFromAxisAngle(AX, s[2] * D2R));
    }
    for (const [k, side] of [['armL', 1], ['armR', -1]]) {
      const s = spec[k]; if (!s || !Bn[k][0]) continue;
      _qa.setFromAxisAngle(AZ, -side * (s[2] || 0) * D2R).multiply(_qb.setFromAxisAngle(AX, s[0] * D2R));
      rotBone(n, Bn[k][0], _qa);
      _qa.setFromAxisAngle(AY, side * (s[3] || 0) * D2R).multiply(_qb.setFromAxisAngle(AX, (s[1] || 0) * D2R));
      rotBone(n, Bn[k][1], _qa);
    }
    for (const b of _list) layerDone(b);
  }
  const boneWorld = (n, key, out) => { const b = bonesOf(n)[key]; if (b) b.getWorldPosition(out); else out.set(n.x, n.y + 1.2, n.z); return out; };

  /* ════ 모양 만들기 ════ */
  function box(w, h, d, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
  function cyl(rt, rb, h, mat, seg = 8) { const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(rt, rb, h, seg)), mat); m.castShadow = true; return m; }

  /* ── 창 (앞부분이 부러진다) + 방패 + 투구 깃털 ── */
  function makeLance(k) {
    const g = new THREE.Group();
    const sm = keep(new THREE.MeshStandardMaterial({ map: stripeTex(TEAM[k].css, '#f4f0e6', 10), roughness: 0.6 }));
    sm.map.wrapS = sm.map.wrapT = THREE.RepeatWrapping; sm.map.repeat.set(1, 3);
    const butt = cyl(0.045, 0.05, 1.5, sm); butt.rotation.x = Math.PI / 2; butt.position.z = 0.15; g.add(butt);
    const vamp = new THREE.Mesh(keep(new THREE.ConeGeometry(0.16, 0.4, 10, 1, true)), M.steel); vamp.rotation.x = Math.PI / 2; vamp.position.z = 0.75; g.add(vamp);
    const front = new THREE.Group(); front.position.z = 0.9; g.add(front);
    const shaft = cyl(0.022, 0.045, 2.5, sm); shaft.rotation.x = Math.PI / 2; shaft.position.z = 1.25; front.add(shaft);
    const tip = new THREE.Mesh(keep(new THREE.ConeGeometry(0.03, 0.14, 6)), M.steel); tip.rotation.x = Math.PI / 2; tip.position.z = 2.55; front.add(tip);
    const tipPt = new THREE.Object3D(); tipPt.position.z = 2.5; front.add(tipPt);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return { g, front, tipPt };
  }
  const shieldGeo = (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.28, 0.32); s.lineTo(0.28, 0.32); s.lineTo(0.28, 0.02); s.quadraticCurveTo(0.26, -0.28, 0, -0.42); s.quadraticCurveTo(-0.26, -0.28, -0.28, 0.02); s.closePath();
    return keep(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 }));
  })();
  function makeShield(k) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(shieldGeo, teamSolid[k]); m.castShadow = true; g.add(m);
    const st = box(0.08, 0.62, 0.01, M.gold, 0, -0.03, 0.06); g.add(st);
    const st2 = box(0.5, 0.08, 0.01, M.gold, 0, 0.12, 0.06); g.add(st2);
    return g;
  }
  let knights = null;
  function getKnights() {
    if (knights) return knights;
    knights = [0, 1].map(k => {
      const n = npcs.addActor('guard', { noAggro: true });
      n.propShow = false;
      tintCloth(n, TEAM[k].c);
      const lance = makeLance(k);
      lance.g.position.set(-0.26, 0.32, -0.2); lance.g.rotation.set(0.04, 0.5, 0, 'YXZ');
      n.body.add(lance.g);
      const shield = makeShield(k);
      shield.position.set(0.34, 0.3, 0.12); shield.rotation.set(0, 1.0, 0.1, 'YXZ');
      n.body.add(shield);
      const head = bonesOf(n).head;
      if (head) {
        const plume = new THREE.Mesh(keep(new THREE.ConeGeometry(0.07, 0.42, 7)), teamSolid[k]);
        plume.position.set(0, 0.36, -0.06); plume.rotation.x = -0.35; plume.castShadow = true; head.add(plume);
      }
      return { n, k, lance, shield, horse: null, mounted: false, score: 0, side: k ? 1 : -1, dir: k ? -1 : 1, homeZ: 0, farZ: 0, wp: 0, ready: false, wasActing: true };
    });
    return knights;
  }
  function setLance(kn, whole) { kn.lance.front.visible = whole; }

  /* ── 말 (models/vehicles/horse.glb, 둘을 SkeletonUtils 로 복제) ── */
  let horseSrc = null, horseLoading = null, horses = null, horseFail = false;
  function loadHorse() {
    if (horseLoading) return horseLoading;
    if (!GLTFLoader) { horseFail = true; return (horseLoading = Promise.resolve(null)); }
    horseLoading = new Promise(res => {
      const L = new GLTFLoader(); if (dracoLoader) L.setDRACOLoader(dracoLoader);
      L.load('models/vehicles/horse.glb', g => { horseSrc = g; res(g); }, undefined, e => { console.warn('[festival] horse', e); horseFail = true; res(null); });
    });
    return horseLoading;
  }
  let horsesBuilding = false;
  async function buildHorses() {
    if (horses || horsesBuilding) return;
    horsesBuilding = true;
    const src = await loadHorse();
    if (!src || disposed) { horseFail = true; return; }
    let clone;
    try { ({ clone } = await import('three/addons/utils/SkeletonUtils.js')); } catch (e) { horseFail = true; return; }
    horses = [0, 1].map(k => {
      const model = clone(src.scene);
      const g = new THREE.Group(); g.add(model); addRoot(g); g.visible = false;
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
      const mixer = new THREE.AnimationMixer(model);
      const acts = ['Idle', 'Walk', 'Gallop'].map((nm, i) => {
        const c = src.animations.find(a => a.name.split('|').pop() === nm); if (!c) return null;
        const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(i === 0 ? 1 : 0); return a;
      });
      mixer.update(0);
      const seat = model.getObjectByName('seat') || model;
      /* 마의(말 옷): 양옆 천 — seat 의 자식으로 붙여 걸음에 같이 들썩 */
      g.updateMatrixWorld(true);
      for (const s of [-1, 1]) {
        const pnl = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.25, 0.62)), teamMats[k]);
        pnl.position.set(s * 0.42, 1.12, 0.02); pnl.rotation.y = s * Math.PI / 2; pnl.castShadow = true;
        seat.attach(pnl);
      }
      return { g, model, mixer, acts, w: [1, 0, 0], seat, x: 0, z: 0, rot: 0, speed: 0, hoofT: 0 };
    });
  }
  function animHorse(h, dt) {
    const sp = Math.abs(h.speed), want = sp < 0.35 ? 0 : sp < 5 ? 1 : 2, kk = Math.min(1, dt * 6);
    for (let i = 0; i < 3; i++) { h.w[i] += ((i === want ? 1 : 0) - h.w[i]) * kk; if (h.acts[i]) h.acts[i].setEffectiveWeight(h.w[i]); }
    if (h.acts[1]) h.acts[1].timeScale = clamp(sp / 2.4, 0.6, 1.8);
    if (h.acts[2]) h.acts[2].timeScale = clamp(sp / 8, 0.75, 1.4);
    h.g.position.set(h.x, groundY(h.x, h.z), h.z);
    h.g.rotation.y = h.rot;
    if (distP(h.x, h.z) < 110) h.mixer.update(dt);
    if (sp > 5) { h.hoofT -= dt; if (h.hoofT <= 0) { h.hoofT = 0.145; SND.hoof(h.x, h.z); } }
  }
  /* 말을 목표로 (가속·회전). 도착하면 true */
  function horseTo(h, tx, tz, maxSp, dt, face = null) {
    const dx = tx - h.x, dz = tz - h.z, d = Math.hypot(dx, dz);
    if (d < 0.15) {
      h.speed = Math.max(0, h.speed - 8 * dt);
      if (face !== null) { const df = wrap(face - h.rot); h.rot += clamp(df, -2.2 * dt, 2.2 * dt); return Math.abs(df) < 0.05; }
      return true;
    }
    const want = Math.atan2(dx, dz), df = wrap(want - h.rot);
    h.rot += clamp(df, -2.4 * dt, 2.4 * dt);
    const aligned = Math.cos(df);
    const target = Math.min(maxSp, d * 1.4) * Math.max(0.15, aligned);
    h.speed += clamp(target - h.speed, -7 * dt, 4 * dt);
    const st = Math.min(h.speed * dt, d);
    h.x += Math.sin(h.rot) * st; h.z += Math.cos(h.rot) * st;
    return false;
  }
  const RIDE = { legL: [-42, 28, 58], legR: [-42, 28, 58], armL: [-35, -45, 12], armR: [-30, -35, 5] };
  /* 기수를 안장에 붙인다 (npcs.update 뒤에) */
  function glue(kn) {
    const n = kn.n, h = kn.horse;
    if (!kn.mounted) return;
    if (!npcs.isActing(n)) { kn.mounted = false; return; }
    h.g.updateMatrixWorld(true);
    h.seat.getWorldPosition(_v);
    n.x = _v.x; n.z = _v.z; n.rot = h.rot;
    n.root.position.set(_v.x, _v.y, _v.z); n.root.rotation.y = h.rot;
    n.root.updateMatrixWorld(true);
    const hips = bonesOf(n).hips;
    let off = 0.98;
    if (hips) { hips.getWorldPosition(_v2); off = _v2.y - n.root.position.y; }
    n.root.position.y = _v.y + 0.07 - off; n.y = n.root.position.y;
    n.root.updateMatrixWorld(true);
    pose(n, RIDE);
  }

  /* ════ 고정 장소 소품 ════ */
  const S = FESTIVAL_SITES;
  /* ① 창시합장: 틸트(울타리) + 깃대 + 구경 벤치 */
  const JX = S.joust.x, JZ0 = S.joust.z0, JZ1 = S.joust.z1, JZM = (JZ0 + JZ1) / 2, LANE = 1.25, OUTER = 3.3;
  const joustField = (() => {
    const g = new THREE.Group();
    const clothMat = keep(new THREE.MeshStandardMaterial({ map: stripeTex('#c0202a', '#e8c040', 2), roughness: 0.9, side: THREE.DoubleSide }));
    clothMat.map.wrapS = THREE.RepeatWrapping; clothMat.map.repeat.set(1, 1);
    const L = JZ1 - JZ0, nPost = Math.round(L / 2) + 1;
    const posts = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.14, 1.25, 0.14)), M.darkWood, nPost);
    posts.castShadow = true;
    for (let i = 0; i < nPost; i++) {
      const z = JZ0 + i * L / (nPost - 1);
      posts.setMatrixAt(i, _m4.makeTranslation(JX, groundY(JX, z) + 0.6, z));
    }
    g.add(posts);
    for (let i = 0; i < nPost - 1; i++) {   // 칸마다 레일 + 천 (땅 높이를 따라)
      const za = JZ0 + i * L / (nPost - 1), zb = JZ0 + (i + 1) * L / (nPost - 1), ya = groundY(JX, za), yb = groundY(JX, zb);
      const len = Math.hypot(zb - za, yb - ya), ang = Math.atan2(yb - ya, zb - za);
      const rail = box(0.1, 0.1, len, M.wood, JX, (ya + yb) / 2 + 1.2, (za + zb) / 2); rail.rotation.x = -ang; g.add(rail);
      const cloth = new THREE.Mesh(keep(new THREE.PlaneGeometry(len, 0.75)), clothMat);
      cloth.position.set(JX, (ya + yb) / 2 + 0.72, (za + zb) / 2); cloth.rotation.set(0, Math.PI / 2, -ang, 'YXZ'); g.add(cloth);
    }
    g.add(makeFlagPole(JX, JZ0 - 0.8, 0, 4.2), makeFlagPole(JX, JZ1 + 0.8, 1, 4.2));
    g.add(makeFlagPole(JX - 6.8, JZ0 + 4, 0, 3.4), makeFlagPole(JX - 6.8, JZ1 - 4, 1, 3.4));
    for (const z of [JZM - 5, JZM + 1.5]) {   // 구경 벤치
      const y = groundY(JX - 7.6, z);
      g.add(box(0.4, 0.07, 3.6, M.wood, JX - 7.6, y + 0.45, z + 1.6), box(0.3, 0.45, 0.1, M.darkWood, JX - 7.6, y + 0.22, z + 0.1), box(0.3, 0.45, 0.1, M.darkWood, JX - 7.6, y + 0.22, z + 3.1));
    }
    g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    return addRoot(g);
  })();

  /* ② 활터: 사로(흰 줄) + 과녁 3개 */
  const LINE_X = S.archery.lineX, TX = S.archery.tx, TZ = S.archery.tz, FACE_R = 0.6, FACE_Y = 1.3;
  const ringTex = canvasTex(256, 256, (c, w) => {
    const R = w / 2, rings = [['#f4f0e6', 1], ['#222222', 0.8], ['#2a6ad8', 0.6], ['#d8202a', 0.4], ['#f5c400', 0.2]];
    for (const [col, f] of rings) { c.fillStyle = col; c.beginPath(); c.arc(R, R, R * f - 1, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2;
    for (let k = 1; k <= 10; k++) { c.beginPath(); c.arc(R, R, R * k / 10 - 1, 0, Math.PI * 2); c.stroke(); }
  });
  const targets = [];
  const archGroup = (() => {
    const g = new THREE.Group();
    const faceMat = keep(new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.9 }));
    for (const z of TZ) {
      const t = new THREE.Group();
      const y0 = groundY(TX, z);
      t.position.set(TX, y0, z); t.rotation.y = -Math.PI / 2;    // 앞면(+z 로컬) → 사로 쪽(-x)
      const boss = cyl(0.68, 0.68, 0.24, M.straw, 18); boss.rotation.x = Math.PI / 2; boss.position.set(0, FACE_Y, 0); t.add(boss);
      const face = new THREE.Mesh(keep(new THREE.CircleGeometry(FACE_R, 32)), faceMat); face.position.set(0, FACE_Y, 0.125); t.add(face);
      for (const s of [-1, 1]) { const leg = box(0.08, 2.0, 0.08, M.wood, s * 0.45, 0.9, -0.2); leg.rotation.z = s * 0.16; leg.rotation.x = 0.12; t.add(leg); }
      const back = box(0.08, 1.9, 0.08, M.wood, 0, 0.85, -0.65); back.rotation.x = -0.4; t.add(back);
      g.add(t);
      targets.push({ g: t, face, boss, z, cx: TX - 0.125, cy: y0 + FACE_Y });
    }
    /* 사로: 흰 줄 + 말뚝 + 깃발 */
    const z0 = TZ[0] - 4, z1 = TZ[TZ.length - 1] + 4;
    const ys = [z0, (z0 + z1) / 2, z1].map(z => groundY(LINE_X, z));
    const line = box(0.12, 0.04, z1 - z0, M.white, LINE_X, Math.max(...ys) + 0.02, (z0 + z1) / 2); line.castShadow = false; g.add(line);
    for (const z of [z0, z1]) g.add(makeFlagPole(LINE_X, z, z === z0 ? 0 : 1, 2.6));
    /* 화살통 받침 */
    g.add(box(0.5, 0.8, 0.3, M.darkWood, LINE_X - 1.6, groundY(LINE_X - 1.6, TZ[0] - 2.5) + 0.4, TZ[0] - 2.5));
    return addRoot(g);
  })();
  for (const tg of targets) tg.g.updateMatrixWorld(true);

  /* ③④ 광장: 돌 화덕(늘 있음) + 축제 장식(모닥불 때만) + 메이폴(오월제 때만) */
  const GX = S.green.x, GZ = S.green.z, GY = groundY(GX, GZ);
  const pit = (() => {
    const g = new THREE.Group(); g.position.set(GX, GY, GZ);
    const stones = new THREE.InstancedMesh(keep(new THREE.DodecahedronGeometry(0.22, 0)), M.stone, 12);
    stones.castShadow = true;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      _e.set(rr(0, 3), rr(0, 3), 0); _q.setFromEuler(_e);
      stones.setMatrixAt(i, _m4.compose(_v.set(Math.cos(a) * 0.95, 0.08, Math.sin(a) * 0.95), _q, _s.set(1, 0.7, 1)));
    }
    g.add(stones);
    const logs = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const lg = cyl(0.07, 0.09, 1.3, M.char, 6);
      lg.position.set(Math.cos(a) * 0.32, 0.5, Math.sin(a) * 0.32);
      g.add(lg); logs.push(lg);
    }
    addRoot(g);
    g.updateMatrixWorld(true);
    for (const lg of logs) { lg.lookAt(GX, GY + 1.2, GZ); lg.rotateX(Math.PI / 2); }
    return g;
  })();
  const harvestDecor = (() => {
    const g = new THREE.Group(); g.visible = false;
    const pg = keep(new THREE.SphereGeometry(0.28, 9, 6));
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + 0.3, r = 6.4 + (i % 2) * 0.5, x = GX + Math.cos(a) * r, z = GZ + Math.sin(a) * r;
      const p = new THREE.Mesh(pg, M.pumpkin); p.scale.set(1, 0.72, 1); p.position.set(x, groundY(x, z) + 0.2, z); p.castShadow = true; g.add(p);
      const st = cyl(0.03, 0.04, 0.12, M.leaf, 5); st.position.set(x, groundY(x, z) + 0.43, z); g.add(st);
    }
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + 0.75, x = GX + Math.cos(a) * 7.4, z = GZ + Math.sin(a) * 7.4;
      const hb = box(1.1, 0.55, 0.65, M.straw, x, groundY(x, z) + 0.28, z); hb.rotation.y = -a + Math.PI / 2; g.add(hb);
    }
    return addRoot(g);
  })();
  /* 메이폴 */
  const RIBBON_COLS = [0xe83a5a, 0xf5c400, 0x3a8ee8, 0x5ac85a, 0xb45ae8, 0xff8a2a];
  const POLE_H = 5.6, RSEG = 10;
  const maypole = (() => {
    const g = new THREE.Group(); g.position.set(GX, GY - 0.05, GZ); g.visible = false;
    const pole = cyl(0.09, 0.12, POLE_H, M.white, 10); pole.position.y = POLE_H / 2; g.add(pole);
    const wreath = new THREE.Mesh(keep(new THREE.TorusGeometry(0.42, 0.09, 6, 16)), M.leaf); wreath.rotation.x = Math.PI / 2; wreath.position.y = POLE_H - 0.35; g.add(wreath);
    const fg = keep(new THREE.SphereGeometry(0.07, 6, 4));
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const f = new THREE.Mesh(fg, keep(new THREE.MeshStandardMaterial({ color: RIBBON_COLS[i % 6], roughness: 0.6 }))); f.position.set(Math.cos(a) * 0.42, POLE_H - 0.27, Math.sin(a) * 0.42); g.add(f); }
    const crown = new THREE.Mesh(keep(new THREE.SphereGeometry(0.16, 10, 8)), M.gold); crown.position.y = POLE_H + 0.12; g.add(crown);
    /* 감긴 리본 띠 (자라면서 아래로) */
    const wrapTex = canvasTex(64, 64, (c, w, h) => {
      for (let i = 0; i < 6; i++) { c.fillStyle = '#' + RIBBON_COLS[i].toString(16).padStart(6, '0'); c.save(); c.translate(0, i * h / 6); c.transform(1, 0.35, 0, 1, 0, 0); c.fillRect(0, -h / 6, w, h / 6 + 2); c.restore(); }
      c.fillStyle = '#' + RIBBON_COLS[0].toString(16).padStart(6, '0'); c.fillRect(0, h - 4, w, 4);
    }, [1, 2]);
    const band = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.14, 0.14, 1, 12, 1, true)), keep(new THREE.MeshStandardMaterial({ map: wrapTex, roughness: 0.7 })));
    band.position.y = POLE_H - 0.6; band.scale.y = 0.01; g.add(band);
    /* 리본 6가닥 = BufferGeometry 하나 */
    const N = 6, vpr = (RSEG + 1) * 2;
    const pos = new Float32Array(N * vpr * 3), col = new Float32Array(N * vpr * 3), idx = [];
    for (let r = 0; r < N; r++) {
      _col.set(RIBBON_COLS[r]);
      for (let i = 0; i < vpr; i++) { col[(r * vpr + i) * 3] = _col.r; col[(r * vpr + i) * 3 + 1] = _col.g; col[(r * vpr + i) * 3 + 2] = _col.b; }
      for (let s = 0; s < RSEG; s++) { const a = r * vpr + s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const rg = keep(new THREE.BufferGeometry());
    rg.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    rg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    rg.setIndex(idx);
    const ribbons = new THREE.Mesh(rg, keep(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    ribbons.frustumCulled = false;
    addRoot(ribbons); ribbons.visible = false;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    addRoot(g);
    return { g, band, ribbons, pos };
  })();

  /* ── 화살·활 ── */
  const arrowGeo = {
    shaft: keep(new THREE.CylinderGeometry(0.009, 0.009, 0.78, 5).rotateX(Math.PI / 2).translate(0, 0, -0.41)),
    tip: keep(new THREE.ConeGeometry(0.022, 0.07, 5).rotateX(Math.PI / 2).translate(0, 0, -0.02)),
    fl: keep(new THREE.PlaneGeometry(0.03, 0.12).rotateX(Math.PI / 2).translate(0, 0, -0.74)),
  };
  const flMat = keep(new THREE.MeshStandardMaterial({ color: 0xf4f0e6, side: THREE.DoubleSide, roughness: 0.9 }));
  /* 원점 = 화살촉 끝, -z 쪽으로 몸통 (lookAt 하면 +z 가 날아가는 쪽) */
  function makeArrow() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(arrowGeo.shaft, M.wood), new THREE.Mesh(arrowGeo.tip, M.steel));
    const f1 = new THREE.Mesh(arrowGeo.fl, flMat); f1.position.x = 0.015; g.add(f1);
    const f2 = new THREE.Mesh(arrowGeo.fl, flMat); f2.rotation.z = Math.PI / 2; f2.position.y = 0.015; g.add(f2);
    g.userData.festArrow = true;
    return g;
  }
  const arrowGroup = addRoot(new THREE.Group());
  const arrowPool = [];
  function getArrow() {
    let a = arrowPool.find(q => !q.used);
    if (!a) { a = { obj: makeArrow(), used: false }; arrowGroup.add(a.obj); arrowPool.push(a); }
    a.used = true; a.obj.visible = true; return a;
  }
  const bowCurve = new THREE.CatmullRomCurve3([new V3(0, 0.72, -0.16), new V3(0, 0.4, -0.03), new V3(0, 0, 0), new V3(0, -0.4, -0.03), new V3(0, -0.72, -0.16)]);
  const bowGeo = keep(new THREE.TubeGeometry(bowCurve, 16, 0.018, 5));
  const strMat = keep(new THREE.LineBasicMaterial({ color: 0xeeeeee }));
  function makeBow() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bowGeo, M.darkWood));
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.72, -0.16, 0, 0, -0.16, 0, -0.72, -0.16]), 3));
    keep(sg);
    const str = new THREE.Line(sg, strMat); g.add(str);
    const nocked = makeArrow(); nocked.position.set(0, 0, 0.62); g.add(nocked);   // 화살촉이 활 앞으로
    g.visible = false; addRoot(g);
    return { g, str, nocked };
  }
  function setDraw(bow, d) {
    const p = bow.str.geometry.attributes.position; p.setZ(1, -0.16 - d * 0.55); p.needsUpdate = true;
    bow.nocked.position.z = 0.62 - d * 0.55;
  }

  /* ════ 공통 이벤트 틀 ════ */
  let disposed = false;
  let cur = null, curName = '', lastName = '', mainClock = rr(MAIN_FIRST[0], MAIN_FIRST[1]);

  /* ═══════════ ① 마상 창시합 ═══════════ */
  const J = { phase: '', t: 0, round: 0, hit: false, ks: null, herald: null, fans: [], heraldT: 0, obj: { active: false } };
  const JOUST_CHEER = ['와아!', '붉은 기사!', '푸른 기사!', '쾅!', '멋지다!', '임금님 만세!'];
  function joustNextRound() {
    J.round++;
    J.phase = 'ready'; J.t = 2.6; J.hit = false;
    for (const kn of J.ks) setLance(kn, true);
    heraldSay(J.herald, `제 ${J.round} 회전! 창을 들어라!`);
  }
  function heraldSay(n, text, life = 2.6) { say(n, text, life, '#7a1a10'); if (n && n.fest) n.fest.speakT = 1.8; }
  const joust = {
    weight: 3,
    eligible: () => !horseFail && getNight() < 0.5 && getSeason() !== 'winter' && distP(JX, JZM) < SITE_NEAR,
    start() {
      if (horseFail) return false;
      buildHorses();
      Object.assign(J, { phase: 'load', t: 0, round: 0, ks: null });
      return true;
    },
    setup() {
      const ks = getKnights();
      ks.forEach((kn, i) => {
        const h = horses[i]; kn.horse = h;
        kn.homeZ = i === 0 ? JZ0 + 1.2 : JZ1 - 1.2; kn.farZ = i === 0 ? JZ1 - 1.2 : JZ0 + 1.2;
        h.x = JX + kn.side * LANE; h.z = kn.homeZ; h.rot = kn.dir > 0 ? 0 : Math.PI; h.speed = 0; h.g.visible = true;
        kn.score = 0; kn.mounted = true; kn.ready = true; kn.wp = 0;
        pendingOff.delete(kn.n);
        npcs.actorOn(kn.n, h.x, h.z, h.rot); npcs.actorPlay(kn.n, 'Idle', 0);
        setLance(kn, true);
      });
      J.ks = ks;
      J.herald = actor(0); place(J.herald, JX - 4.6, JZM, Math.PI / 2);
      J.fans = [1, 2, 3, 4].map((i, j) => { const n = actor(i); place(n, JX - 6.3 + rr(-0.4, 0.4), JZM - 5 + j * 3.2 + rr(-0.5, 0.5), Math.PI / 2); return n; });
      gatherCrowd(J.obj, JX - 6, JZM, 3.5, 6, true, -Math.PI / 2);
      SND.fanfare(JX, JZM);
      heraldSay(J.herald, '마상 창시합을 시작하노라!', 3);
      toast(`🐎 마상 창시합! 붉은 기사 대 푸른 기사, 3회전 — ${S.joust.name} (${dirText(JX, JZM)})`);
      J.phase = 'intro'; J.t = 5;
    },
    resolve() {
      J.hit = true;
      const [a, b] = J.ks;
      const zc = (a.horse.z + b.horse.z) / 2, yc = groundY(JX, zc) + 2.2;
      let res;
      if (!a.mounted && !b.mounted) res = 'none';
      else if (!a.mounted) res = 'b'; else if (!b.mounted) res = 'a';
      else { const r = Math.random(); res = r < 0.38 ? 'both' : r < 0.6 ? 'a' : r < 0.82 ? 'b' : (Math.random() < 0.5 ? 'unA' : 'unB'); }
      const brk = kn => {
        setLance(kn, false);
        kn.lance.tipPt.getWorldPosition(_v);
        const px = Number.isFinite(_v.x) ? _v.x : JX, py = Number.isFinite(_v.y) ? _v.y : yc, pz = Number.isFinite(_v.z) ? _v.z : zc;
        for (let i = 0; i < 18; i++) debris(px + rr(-0.3, 0.3), py + rr(-0.2, 0.3), pz + rr(-0.6, 0.6), rr(-3.5, 3.5), rr(1.5, 5.5), kn.dir * rr(1, 6), 0.035, 0.035, rr(0.12, 0.4), i % 3 ? 0xd8b080 : TEAM[kn.k].c, rr(2.5, 4));
        for (let i = 0; i < 10; i++) fx(3, px, py, pz, rr(-3, 3), rr(0, 4), rr(-3, 3), rr(0.2, 0.45), 0.12, 0.02, 6);
        SND.crack(px, pz);
      };
      const unhorse = (kn, by) => {
        kn.mounted = false;
        npcs.knockDown(kn.n, { x: kn.side * 2.2, y: 3.4, z: -kn.dir * 2.4 }, 'fight');
        say(kn.n, pick(['으아아!', '아이고!', '말이여~!']), 1.8);
        void by;
      };
      let msg = '';
      if (res === 'both') { brk(a); brk(b); a.score++; b.score++; msg = '쾅! 두 창이 동시에 부러졌다!'; }
      else if (res === 'a') { brk(a); a.score++; msg = `쾅! ${TEAM[0].name}의 창이 방패에 맞아 부러졌다!`; }
      else if (res === 'b') { brk(b); b.score++; msg = `쾅! ${TEAM[1].name}의 창이 방패에 맞아 부러졌다!`; }
      else if (res === 'unA') { brk(a); a.score += 3; unhorse(b, a); msg = `${TEAM[1].name} 낙마! ${TEAM[0].name} +3`; }
      else if (res === 'unB') { brk(b); b.score += 3; unhorse(a, b); msg = `${TEAM[0].name} 낙마! ${TEAM[1].name} +3`; }
      else msg = '둘 다 말에서 떨어져 있다…!';
      SND.cheer(JX, zc, 1.3);
      for (const f of J.fans) cheer(f, 2.6);
      J.obj.phase = 2; J.cheerT = 3;
      for (const f of J.fans) if (Math.random() < 0.5) say(f, pick(JOUST_CHEER), 1.5);
      toast(`🐎 ${J.round}회전 — ${msg} (붉은 ${a.score} : 푸른 ${b.score})`);
    },
    update(dt, t) {
      if (J.phase === 'load') {
        J.t += dt;
        if (horseFail || J.t > 20) return false;
        if (horses) this.setup();
        return true;
      }
      const [a, b] = J.ks;
      for (const kn of J.ks) {
        /* 플레이어가 기사를 넘어뜨렸다 */
        const acting = npcs.isActing(kn.n);
        if (kn.mounted && !acting) { kn.mounted = false; if (J.phase === 'charge') toast(`어이쿠! ${TEAM[kn.k].name}이(가) 낙마했다 — 관중: "반칙이다!"`); }
        kn.wasActing = acting;
      }
      if (J.cheerT > 0) { J.cheerT -= dt; if (J.cheerT <= 0) J.obj.phase = 0; }
      if (J.phase === 'intro') {
        J.t -= dt;
        if (J.t <= 0) joustNextRound();
      } else if (J.phase === 'ready') {
        J.t -= dt;
        for (const kn of J.ks) { kn.horse.speed = 0; kn.horse.rot += clamp(wrap((kn.dir > 0 ? 0 : Math.PI) - kn.horse.rot), -2 * dt, 2 * dt); }
        if (J.t <= 0) { J.phase = 'charge'; heraldSay(J.herald, '돌격!', 1.6); SND.fanfare(JX, JZM); }
      } else if (J.phase === 'charge') {
        let done = 0;
        for (const kn of J.ks) {
          const h = kn.horse, rem = (kn.farZ - h.z) * kn.dir;
          if (rem <= 0.05) { h.speed = 0; done++; continue; }
          h.speed = Math.min(8.6, h.speed + 5.5 * dt);
          if (rem < 6) h.speed = Math.max(1.2, Math.min(h.speed, rem * 1.4));
          h.z += kn.dir * Math.min(h.speed * dt, rem);
          h.x += (JX + kn.side * LANE - h.x) * Math.min(1, dt * 3);
        }
        if (!J.hit && b.horse.z - a.horse.z < 2.4) this.resolve();
        if (done === 2) { J.phase = 'return'; J.t = 0; for (const kn of J.ks) { kn.wp = 0; kn.ready = false; } }
      } else if (J.phase === 'return') {
        J.t += dt;
        let ready = 0;
        for (const kn of J.ks) {
          const h = kn.horse, n = kn.n;
          if (!kn.mounted) {
            h.speed = Math.max(0, h.speed - 6 * dt);
            if (npcs.isActing(n)) {
              const mx = h.x - kn.side * 0.9, mz = h.z;
              if (stepTo(n, mx, mz, 2.6, dt) || Math.hypot(n.x - mx, n.z - mz) < 0.5 || J.t > 16) {
                kn.mounted = true; say(n, pick(['다시 간다!', '아직 안 끝났다!', '이번엔 안 진다!']), 1.8);
              }
            }
            continue;
          }
          const wps = [[JX + kn.side * OUTER, kn.farZ + kn.dir * 0.5], [JX + kn.side * OUTER, kn.homeZ - kn.dir * 1.0], [JX + kn.side * LANE, kn.homeZ]];
          if (kn.wp < 3) {
            const [wx, wz] = wps[kn.wp];
            const last = kn.wp === 2;
            if (horseTo(h, wx, wz, last ? 2.2 : 5.2, dt, last ? (kn.dir > 0 ? 0 : Math.PI) : null) || (!last && Math.hypot(h.x - wx, h.z - wz) < 1.0)) kn.wp++;
          } else { h.speed = 0; kn.ready = true; ready++; }
        }
        if (J.t > 26) {   // 너무 오래 걸리면 제자리로
          for (const kn of J.ks) { const h = kn.horse; h.x = JX + kn.side * LANE; h.z = kn.homeZ; h.rot = kn.dir > 0 ? 0 : Math.PI; h.speed = 0; if (npcs.isActing(kn.n)) kn.mounted = true; }
          ready = 2;
        }
        if (ready === 2) {
          if (J.round < 3) joustNextRound();
          else {
            J.phase = 'victory'; J.t = 8;
            const w = a.score === b.score ? null : a.score > b.score ? a : b;
            if (w) {
              heraldSay(J.herald, `승자는 ${TEAM[w.k].name}!`, 3.5);
              say(w.n, '이 승리를 최상호 전하께 바칩니다!', 3.5, TEAM[w.k].hex);
              toast(`🏆 마상 창시합 우승: ${TEAM[w.k].name}! (붉은 ${a.score} : 푸른 ${b.score}) — "이 승리를 임금님께!"`);
            } else {
              heraldSay(J.herald, '무승부! 둘 다 장하도다!', 3.5);
              toast(`🏆 마상 창시합 무승부! (${a.score} : ${b.score}) 임금님이 두 기사 모두에게 상을 내리셨다`);
            }
            SND.fanfare(JX, JZM); SND.cheer(JX, JZM, 1.5);
            for (const f of J.fans) cheer(f, 4);
            J.obj.phase = 2;
            confetti(JX - 3, groundY(JX - 3, JZM) + 2.5, JZM, 50, 3);
            J.winner = w;
          }
        }
      } else if (J.phase === 'victory') {
        J.t -= dt;
        if (J.winner && J.winner.mounted) { J.winner.n.standHop = 0; npcs.actorPlay(J.winner.n, 'Cheers', 0.3); }   // 말 위: 서서 환호 몸짓(두 팔)만, 콩콩 뛰기 없이
        if (J.t <= 0) return false;
      }
      for (const kn of J.ks) { animHorse(kn.horse, dt); glue(kn); }
      /* 전령·구경꾼 */
      const hz = J.phase === 'charge' ? (a.horse.z + b.horse.z) / 2 : JZM;
      if (J.herald) { standBy(J.herald, dt, { x: JX, z: hz }); heraldPose(J.herald, dt); }
      for (const f of J.fans) standBy(f, dt, { x: JX, z: hz });
      crowdTick(dt, J, JX - 2, JZM, 30, JOUST_CHEER);
      return true;
    },
    stop() {
      for (const kn of J.ks || []) { release(kn.n); kn.mounted = false; if (kn.horse) kn.horse.g.visible = false; }
      if (J.herald) release(J.herald);
      for (const f of J.fans) release(f);
      J.obj.active = false; J.fans = []; J.herald = null; J.phase = '';
    },
  };
  function heraldPose(n, dt) {
    if (!n.fest || !n.fest.arrived) return;
    if (n.fest.speakT > 0) { n.fest.speakT -= dt; pose(n, { armR: [-150, -20, -10] }); }
  }

  /* ═══════════ ② 활쏘기 대회 ═══════════ */
  const ARCHER_NAMES = ['로빈', '마리안', '수도사 터크'];
  const A = { phase: '', t: 0, archers: [], herald: null, fans: [], player: [], arrows: [], seen: new WeakMap(), scored: new WeakSet(), obj: { active: false } };
  const DRAW = 1.7, SHOT_GAP = 6.5, SHOTS = 3;
  const ARCH_POSE = d => ({ armL: [-88, 0, -4], armR: [-86, 0, 10, 155 * d] });
  function ringScore(r) { return r <= 0.12 ? 10 : r <= 0.24 ? 8 : r <= 0.36 ? 6 : r <= 0.48 ? 4 : r <= FACE_R ? 2 : 0; }
  const sum3 = arr => arr.slice().sort((x, y) => y - x).slice(0, 3).reduce((s, v) => s + v, 0);
  function playerAtLine() {
    const p = playerPos(); if (!p || !isOnFoot()) return false;
    return Math.abs(p.x - LINE_X) < 3.5 && p.z > TZ[0] - 6 && p.z < TZ[TZ.length - 1] + 6;
  }
  function scorePlayerHit(ti, ly, lz, pt) {
    const r = Math.hypot(ly, lz), s = ringScore(r);
    A.player.push(s);
    if (pt) { for (let i = 0; i < 8; i++) fx(3, pt.x, pt.y, pt.z, rr(-1.5, 1.5), rr(0, 2), rr(-1.5, 1.5), 0.4, 0.15, 0.02, 3); }
    SND.thunk(TX, TZ[ti]);
    const best = sum3(A.player);
    toast(s >= 10 ? `🎯 정중앙! 10점! (내 점수 ${best})` : s > 0 ? `🎯 ${s}점! (내 점수 ${best}, 좋은 3발 합)` : `과녁 가장자리… 0점 (내 점수 ${best})`);
    if (A.fans.length && s >= 8) { for (const f of A.fans) cheer(f, 2); say(A.fans[0], pick(['왕자님 최고!', '명궁이다!', '와아!']), 1.6); }
    return s;
  }
  /* 공용: tip 월드 위치로 점수 (사로에 서 있을 때만) */
  function scoreArrow(pos) {
    if (cur !== archery || (A.phase !== 'intro' && A.phase !== 'shoot') || !pos || !playerAtLine()) return -1;
    for (let i = 0; i < targets.length; i++) {
      const tg = targets[i];
      const ly = pos.y - tg.cy, lz = pos.z - tg.z;
      if (Math.abs(pos.x - tg.cx) < 0.5 && Math.hypot(ly, lz) <= FACE_R + 0.1) return scorePlayerHit(i, ly, lz, pos);
    }
    return -1;
  }
  const _fwd = new V3(), _wq = new Q();
  function scanPlayerArrows() {
    const okLine = playerAtLine();
    /* (1) weapons 의 colliders 에 과녁이 들어가 있으면 화살이 과녁 메시의 자식으로 붙는다 */
    for (let i = 0; i < targets.length; i++) {
      const tg = targets[i];
      for (const m of [tg.face, tg.boss]) for (const c of m.children) {
        if (!c.userData || !(c.userData.len > 0) || c.userData.festArrow || A.scored.has(c)) continue;
        A.scored.add(c);
        if (!okLine) continue;
        c.getWorldPosition(_v); c.getWorldQuaternion(_wq); _fwd.set(0, 0, 1).applyQuaternion(_wq);
        _v.addScaledVector(_fwd, c.userData.len - 0.12);          // 박힌 지점 (stickAt 의 반대 계산)
        scorePlayerHit(i, _v.y - tg.cy, _v.z - tg.z, _v);
      }
    }
    /* (2) 연결이 없을 때: 날아가는 화살(scene 바로 아래, userData.len)이 과녁 면(x = cx)을 지나가는지 */
    for (const o of scene.children) {
      const u = o.userData;
      if (!u || !(u.len > 0) || u.festArrow || A.scored.has(o)) continue;
      o.getWorldQuaternion(_wq); _fwd.set(0, 0, 1).applyQuaternion(_wq);
      _v.copy(o.position).addScaledVector(_fwd, u.len);              // 촉
      const prev = A.seen.get(o);
      if (!prev) { A.seen.set(o, _v.clone()); continue; }
      const fx0 = targets[0].cx;
      if (prev.x < fx0 && _v.x >= fx0) {
        const k = (fx0 - prev.x) / (_v.x - prev.x), y = prev.y + (_v.y - prev.y) * k, z = prev.z + (_v.z - prev.z) * k;
        A.scored.add(o);
        if (okLine) for (let i = 0; i < targets.length; i++) {
          const tg = targets[i];
          if (Math.hypot(y - tg.cy, z - tg.z) <= FACE_R + 0.08) { scorePlayerHit(i, y - tg.cy, z - tg.z, _v2.set(fx0, y, z)); break; }
        }
      }
      prev.copy(_v);
    }
  }
  function npcShoot(ar) {
    const tg = targets[ar.ti];
    const bow = ar.bow;
    bow.g.updateMatrixWorld(true);
    bow.nocked.getWorldPosition(_v);
    const sig = ar.skill;
    let ly = (Math.random() + Math.random() + Math.random() - 1.5) * sig * 1.4, lz = (Math.random() + Math.random() + Math.random() - 1.5) * sig * 1.4;
    const r = Math.hypot(ly, lz); if (r > 0.66) { ly *= 0.66 / r; lz *= 0.66 / r; }
    const s = ringScore(Math.hypot(ly, lz));
    const end = new V3(tg.cx + 0.03, tg.cy + ly, tg.z + lz);
    const T = _v.distanceTo(end) / 34;
    const v0 = new V3().subVectors(end, _v).divideScalar(T); v0.y += 0.5 * 9.8 * T;
    const a = getArrow();
    a.obj.position.copy(_v); a.p0 = _v.clone(); a.v0 = v0; a.T = T; a.t = 0; a.end = end; a.score = s; a.ar = ar; a.flying = true;
    SND.twang(_v.x, _v.z);
    A.arrows.push(a);
  }
  function arrowsUpdate(dt) {
    for (const a of A.arrows) {
      if (!a.flying) continue;
      a.t += dt;
      if (a.t >= a.T) {
        a.flying = false; a.obj.position.copy(a.end);
        a.ar.scores.push(a.score);
        say(a.ar.n, a.score ? `${a.score}점!` : '빗나갔다…', 1.5);
        SND.thunk(a.end.x, a.end.z);
        if (a.score >= 10) { for (const f of A.fans) cheer(f, 2); SND.cheer(a.end.x, a.end.z, 0.6); }
        continue;
      }
      const t = a.t;
      a.obj.position.set(a.p0.x + a.v0.x * t, a.p0.y + a.v0.y * t - 4.9 * t * t, a.p0.z + a.v0.z * t);
      _v.set(a.v0.x, a.v0.y - 9.8 * t, a.v0.z).add(a.obj.position);
      a.obj.lookAt(_v);
    }
  }
  const archery = {
    weight: 3,
    eligible: () => getNight() < 0.5 && distP(S.archery.x, S.archery.z) < SITE_NEAR,
    start() {
      A.phase = 'intro'; A.t = 6; A.clock = 0; A.player = []; A.seen = new WeakMap(); A.scored = new WeakSet();
      for (const a of A.arrows) { a.used = false; a.obj.visible = false; } A.arrows = [];
      const ids = [4, 3, 5];
      A.archers = ids.map((id, i) => {
        const n = actor(id);
        place(n, LINE_X - 0.4, TZ[i], Math.PI / 2);
        const old = A.bows && A.bows[i];
        const bow = old || makeBow();
        return { n, name: ARCHER_NAMES[i], ti: i, bow, skill: [0.16, 0.22, 0.3][i], scores: [], shots: 0, next: 2 + i * 1.8 + DRAW, draw: 0 };
      });
      A.bows = A.archers.map(a => a.bow);
      A.herald = actor(0); place(A.herald, LINE_X - 2.6, TZ[0] - 3.4, 0.6);
      A.fans = [1, 2].map((id, j) => { const n = actor(id); place(n, LINE_X - 4.2, TZ[0] + 1.8 + j * 4.2, Math.PI / 2); return n; });
      gatherCrowd(A.obj, LINE_X - 5, S.archery.z, 3.2, 5, true, -Math.PI / 2);
      SND.fanfare(LINE_X, S.archery.z);
      heraldSay(A.herald, '활쏘기 대회를 시작하노라!', 3);
      toast(`🏹 활쏘기 대회! ${S.archery.name} (${dirText(LINE_X, S.archery.z)}) — 활(5)을 들고 흰 사로에 서서 과녁을 맞히면 참가!`);
      return true;
    },
    update(dt, t) {
      A.t -= dt;
      if (A.phase === 'intro' && A.t <= 0) { A.phase = 'shoot'; A.t = 40; A.clock = 0; heraldSay(A.herald, '쏘아라!', 1.6); }
      if (A.phase === 'shoot') {
        A.clock += dt;
        for (const ar of A.archers) {
          if (ar.shots >= SHOTS || !npcs.isActing(ar.n) || !ar.n.fest || !ar.n.fest.arrived) { ar.draw = Math.max(0, ar.draw - dt * 3); continue; }
          const start = ar.next - DRAW;
          ar.draw = A.clock < start ? 0 : clamp((A.clock - start) / DRAW, 0, 1);
          if (A.clock >= ar.next) { npcShoot(ar); ar.shots++; ar.next += SHOT_GAP + rr(-0.6, 0.6); ar.draw = 0; }
        }
        if (A.t <= 0) {
          A.phase = 'result'; A.t = 8;
          const rows = A.archers.map(a => ({ name: a.name, s: sum3(a.scores), n: a.n }));
          if (A.player.length) rows.push({ name: '왕자님(나)', s: sum3(A.player), me: true });
          rows.sort((x, y) => y.s - x.s || (x.me ? -1 : 1));
          const top = rows[0];
          heraldSay(A.herald, `우승은 ${top.name}!`, 3.5);
          toast(`🏹 활쏘기 결과 — ${rows.map((r, i) => `${i + 1}등 ${r.name} ${r.s}점`).join(' · ')}`);
          if (top.me) {
            setTimeout(() => toast('🏆 우승! 임금님의 금화 10닢! "과연 짐의 왕자로다!"'), 1800);
            confetti(LINE_X, groundY(LINE_X, S.archery.z) + 2.5, S.archery.z, 60, 3.5);
            for (const f of A.fans) cheer(f, 4);
          } else if (A.player.length) setTimeout(() => toast('아깝다! 참가상으로 빨간 사과 한 알을 받았다 🍎'), 1800);
          else if (top.n) { say(top.n, '임금님 만세!', 2.5); npcs.actorPlay(top.n, 'Cheers', 0.3); }
          SND.fanfare(LINE_X, S.archery.z); SND.cheer(LINE_X, S.archery.z, 1.2);
          A.obj.phase = 2;
        }
      } else if (A.phase === 'result' && A.t <= 0) return false;
      if (A.phase === 'intro' || A.phase === 'shoot') scanPlayerArrows();
      arrowsUpdate(dt);
      /* 궁수 자세·활 */
      for (const ar of A.archers) {
        const n = ar.n;
        if (!walkIn(n, dt)) { ar.bow.g.visible = false; continue; }
        if (A.phase === 'result' && ar.n.fest.cheerT > 0) { ar.n.fest.cheerT -= dt; npcs.actorPlay(n, 'Cheers', 0.3); }
        else npcs.actorPlay(n, 'Idle', 0.3);
        turn(n, Math.PI / 2, dt, 4);
        n.root.rotation.y = n.rot; n.root.updateMatrixWorld(true);
        const aiming = A.phase === 'shoot' && ar.shots < SHOTS;
        if (aiming) pose(n, ARCH_POSE(ar.draw));
        ar.bow.g.visible = true;
        boneWorld(n, aiming ? 'handL' : 'handR', ar.bow.g.position);
        ar.bow.g.rotation.set(aiming ? 0 : 0.5, n.rot, 0, 'YXZ');
        setDraw(ar.bow, aiming ? ar.draw : 0);
        ar.bow.nocked.visible = aiming && ar.draw > 0.02;
      }
      if (A.herald) { standBy(A.herald, dt, { x: TX, z: S.archery.z }); heraldPose(A.herald, dt); }
      for (const f of A.fans) standBy(f, dt, { x: TX, z: S.archery.z });
      crowdTick(dt, A, LINE_X, S.archery.z, 28, ['맞혀라!', '와아!', '명중!']);
      return true;
    },
    stop() {
      for (const ar of A.archers) { release(ar.n); ar.bow.g.visible = false; }
      if (A.herald) release(A.herald);
      for (const f of A.fans) release(f);
      A.archers = []; A.fans = []; A.herald = null; A.phase = ''; A.obj.active = false;
      setTimeout(() => { if (cur !== archery) { for (const a of A.arrows) { a.used = false; a.obj.visible = false; } A.arrows = []; } }, 15000);
    },
  };

  /* ═══════════ ③ 수확 축제 모닥불 / ④ 오월제 메이폴 (광장 춤) ═══════════ */
  const D = { phase: '', t: 0, dancers: [], herald: null, fire: 0, dirSign: 1, theta: 0, segT: 0, pause: 0, warmed: false, obj: { active: false }, kind: '' };
  const HANDS = { armL: [-8, -12, -62], armR: [-8, -12, -62] };
  const RIBBON_ARM = { armL: [-155, -10, 0] };
  function danceStart(kind) {
    D.kind = kind; D.phase = 'intro'; D.t = kind === 'bonfire' ? 5 : 4.5; D.fire = 0; D.theta = 0; D.dirSign = 1; D.segT = 0; D.pause = 0; D.warmed = false; D.wrap = 0;
    const ids = kind === 'bonfire' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 0, 4, 5];
    const R = kind === 'bonfire' ? 3.5 : 4.2;
    D.dancers = ids.map((id, i) => {
      const n = actor(id), a = i / 6 * Math.PI * 2;
      place(n, GX + Math.sin(a) * R, GZ + Math.cos(a) * R, a + Math.PI);
      return { n, i, a0: a, grp: i % 2 };
    });
    D.herald = kind === 'bonfire' ? actor(0) : actor(7);
    place(D.herald, GX + 6.2, GZ - 1.5, -Math.PI / 2);
    gatherCrowd(D.obj, GX, GZ, 6.8, 6, false, 0);
    lute.on = true; lute.x = GX; lute.z = GZ; lute.i = 0;
  }
  function danceStop() {
    for (const d of D.dancers) release(d.n);
    if (D.herald) release(D.herald);
    D.dancers = []; D.herald = null; D.phase = ''; D.obj.active = false; lute.on = false;
    harvestDecor.visible = false; maypole.g.visible = false; maypole.ribbons.visible = false; pit.visible = true;
    M.char.emissiveIntensity = 0;
  }
  const bonfire = {
    weight: 4,
    eligible: () => getNight() > 0.45 && (getSeason() === 'autumn' || getSeason() === 'winter') && distP(GX, GZ) < SITE_NEAR,
    start() {
      danceStart('bonfire');
      harvestDecor.visible = true;
      const winter = getSeason() === 'winter';
      heraldSay(D.herald, winter ? '겨울 모닥불 잔치를 여노라!' : '올해도 풍년이오! 수확 축제를 여노라!', 3);
      toast(`🔥 ${winter ? '겨울 모닥불 잔치' : '수확 축제'}! ${S.green.name}에 모닥불이 타오르고 마을 사람들이 춤을 춰요 (${dirText(GX, GZ)})`);
      SND.fanfare(GX, GZ);
      return true;
    },
    update(dt, t) {
      D.t -= dt;
      const p = playerPos();
      if (D.phase === 'intro') { D.fire = Math.min(1, D.fire + dt / 3); if (D.t <= 0) { D.phase = 'dance'; D.t = 70; } }
      else if (D.phase === 'dance') { if (D.t <= 0) { D.phase = 'outro'; D.t = 5; heraldSay(D.herald, '모두 좋은 밤 되시오!', 2.5); toast('🔥 수확 축제가 끝났어요. 모닥불이 사그라듭니다'); lute.on = false; } }
      else if (D.phase === 'outro') { D.fire = Math.max(0, D.fire - dt / 4.5); if (D.t <= 0) return false; }
      /* 불 */
      const f = D.fire;
      if (f > 0.01 && distP(GX, GZ) < 120) {
        const rate = 75 * f, n = Math.floor(rate * dt + Math.random());
        for (let k = 0; k < n; k++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * 0.45;
          fx(1, GX + Math.cos(a) * r, GY + 0.25, GZ + Math.sin(a) * r, rr(-0.25, 0.25), rr(1.6, 2.6) * (0.6 + f * 0.4), rr(-0.25, 0.25), rr(0.6, 1.05), rr(0.55, 0.85) * f, 0.08, -1.2);
        }
        if (Math.random() < dt * 9 * f) fx(2, GX + rr(-0.3, 0.3), GY + 0.8, GZ + rr(-0.3, 0.3), rr(-0.5, 0.5), rr(1.5, 3), rr(-0.5, 0.5), rr(2, 3.5), 0.07, 0.03, -0.25);
        const fl = 0.8 + 0.12 * Math.sin(t * 13) + 0.08 * Math.sin(t * 31 + 1) + 0.06 * Math.random();
        wantLight(GX, GY + 1.3, GZ, 26 * f * fl, 0xff8a3a, 18, 2);
        M.char.emissiveIntensity = 1.4 * f * fl;
        if (Math.random() < dt * 6 * f) SND.crackle(GX, GZ);
      }
      /* 춤: 손잡고 원을 돈다. 9초마다 잠깐 멈춰 불을 보고 박수(Cheers) 뒤 방향을 바꾼다 */
      const dancing = D.phase === 'dance';
      if (dancing) {
        D.segT += dt;
        if (D.pause > 0) { D.pause -= dt; if (D.pause <= 0) { D.dirSign = -D.dirSign; D.segT = 0; } }
        else if (D.segT > 9) { D.pause = 2.2; SND.cheer(GX, GZ, 0.7); D.obj.phase = 2; if (D.dancers[0]) say(D.dancers[pick([0, 1, 2, 3, 4, 5])].n, pick(['풍년이다!', '임금님 만세!', '랄랄라~', '한 바퀴 더!']), 1.5); }
        else { D.theta += D.dirSign * 0.29 * dt; D.obj.phase = 0; }
      }
      for (const d of D.dancers) {
        const n = d.n;
        if (!walkIn(n, dt)) continue;
        if (!dancing) { npcs.actorPlay(n, D.phase === 'outro' ? 'Cheers' : 'Idle', 0.3); turn(n, Math.atan2(GX - n.x, GZ - n.z), dt, 4); continue; }
        const a = d.a0 + D.theta, R = 3.5;
        const tx = GX + Math.sin(a) * R, tz = GZ + Math.cos(a) * R;
        if (D.pause > 0) { npcs.actorPlay(n, 'Cheers', 0.25); turn(n, Math.atan2(GX - n.x, GZ - n.z), dt, 6); n.x += (tx - n.x) * Math.min(1, dt * 4); n.z += (tz - n.z) * Math.min(1, dt * 4); continue; }
        n.x += (tx - n.x) * Math.min(1, dt * 5); n.z += (tz - n.z) * Math.min(1, dt * 5);
        turn(n, a + D.dirSign * Math.PI / 2, dt, 6);
        npcs.actorPlay(n, 'Walk', 0.3, 0.85);
        n.root.position.set(n.x, n.y + Math.abs(Math.sin(t * 5.5 + d.i)) * 0.07, n.z); n.root.rotation.y = n.rot;
        pose(n, HANDS);
      }
      if (D.herald) { standBy(D.herald, dt, { x: GX, z: GZ }); heraldPose(D.herald, dt); }
      if (dancing) crowdTick(dt, D, GX, GZ, 26, ['풍년이다!', '따뜻하다~', '임금님 만세!']);
      /* 불 곁에 오면 군밤 (한 번) */
      if (!D.warmed && p && f > 0.5 && isOnFoot() && Math.hypot(p.x - GX, p.z - GZ) < 5) {
        D.warmed = true;
        toast('🌰 모닥불 곁은 따뜻하다… 마을 사람이 군밤을 한 줌 건넸다!');
        if (D.herald) say(D.herald, '왕자님, 군밤 드시오!', 2.2);
      }
      return true;
    },
    stop: danceStop,
  };
  /* 리본 정점 갱신 */
  const _top = new V3(), _hand = new V3(), _dir = new V3(), _side = new V3();
  function updateRibbons(prog) {
    const pos = maypole.pos, vpr = (RSEG + 1) * 2;
    const topY = GY + POLE_H - 0.5;
    for (let r = 0; r < 6; r++) {
      const d = D.dancers[r];
      if (!d) continue;
      const n = d.n;
      if (n.off) { for (let i = 0; i < vpr; i++) pos[(r * vpr + i) * 3 + 1] = -9999; continue; }
      boneWorld(n, 'handL', _hand);
      const a = Math.atan2(_hand.x - GX, _hand.z - GZ);
      _top.set(GX + Math.sin(a) * 0.16, topY - prog * 2.4, GZ + Math.cos(a) * 0.16);
      _dir.subVectors(_hand, _top);
      _side.set(_dir.z, 0, -_dir.x).normalize().multiplyScalar(0.045);
      const sag = 0.25 + _dir.length() * 0.03;
      for (let s = 0; s <= RSEG; s++) {
        const u = s / RSEG, x = _top.x + _dir.x * u, y = _top.y + _dir.y * u - sag * 4 * u * (1 - u), z = _top.z + _dir.z * u;
        const tw = Math.sin(u * 6 + r) * 0.4 + 0.6;
        const i0 = (r * vpr + s * 2) * 3;
        pos[i0] = x - _side.x * tw; pos[i0 + 1] = y; pos[i0 + 2] = z - _side.z * tw;
        pos[i0 + 3] = x + _side.x * tw; pos[i0 + 4] = y + 0.01; pos[i0 + 5] = z + _side.z * tw;
      }
    }
    maypole.ribbons.geometry.attributes.position.needsUpdate = true;
  }
  const maypoleEv = {
    weight: 4,
    eligible: () => (getSeason() === 'spring' || getSeason() === 'summer') && getNight() < 0.55 && distP(GX, GZ) < SITE_NEAR,
    start() {
      danceStart('maypole');
      maypole.g.visible = true; maypole.g.scale.set(1, 0.01, 1); maypole.band.scale.y = 0.01;
      pit.visible = false;                                   // 메이폴이 화덕 자리에 선다
      maypole.ribbons.visible = false;
      const summer = getSeason() === 'summer';
      heraldSay(D.herald, summer ? '한여름 축제다! 메이폴을 세워라!' : '오월제다! 메이폴을 세워라!', 3);
      toast(`🎀 ${summer ? '한여름 축제' : '오월제'}! ${S.green.name}에 메이폴이 서고 리본 춤이 시작돼요 (${dirText(GX, GZ)})`);
      SND.fanfare(GX, GZ);
      return true;
    },
    update(dt, t) {
      D.t -= dt;
      const rise = clamp(1 - D.t / 2.5, 0.01, 1);
      if (D.phase === 'intro') {
        maypole.g.scale.y = 1 - Math.pow(1 - rise, 3);
        if (D.t <= 0) { D.phase = 'dance'; D.t = 42; D.wrap = 0; maypole.ribbons.visible = true; heraldSay(D.herald, '돌아라, 돌아라!', 2); }
      } else if (D.phase === 'dance') {
        D.wrap = Math.min(1, D.wrap + dt / 40);
        if (D.t <= 0) {
          D.phase = 'outro'; D.t = 7;
          confetti(GX, GY + POLE_H, GZ, 70, 3.5); SND.cheer(GX, GZ, 1.4); SND.fanfare(GX, GZ);
          heraldSay(D.herald, '올해도 풍년이로다!', 3);
          toast('🎀 메이폴이 예쁘게 감겼어요! "올해도 풍년이다, 임금님 만세!"');
          D.obj.phase = 2;
        }
      } else if (D.phase === 'outro') { if (D.t <= 0) return false; }
      maypole.band.scale.y = 0.01 + D.wrap * 2.4;
      maypole.band.position.y = POLE_H - 0.5 - maypole.band.scale.y / 2;
      maypole.band.material.map.repeat.set(1, Math.max(0.2, maypole.band.scale.y * 2));
      /* 두 무리가 엇갈려 돈다: 짝수 반시계, 홀수 시계. 만날 때 한쪽은 안, 한쪽은 밖으로 */
      const dancing = D.phase === 'dance';
      const w = 0.33;
      for (const d of D.dancers) {
        const n = d.n;
        if (!walkIn(n, dt)) continue;
        if (!dancing) { npcs.actorPlay(n, D.phase === 'outro' ? 'Cheers' : 'Idle', 0.3); turn(n, Math.atan2(GX - n.x, GZ - n.z), dt, 4); if (D.phase !== 'intro') pose(n, RIBBON_ARM); continue; }
        const s = d.grp ? -1 : 1, el = 42 - D.t;
        const th = d.a0 + s * w * el;
        const R = 4.2 - D.wrap * 1.3 + s * 0.5 * Math.sin(3 * th);
        const tx = GX + Math.sin(th) * R, tz = GZ + Math.cos(th) * R;
        n.x += (tx - n.x) * Math.min(1, dt * 5); n.z += (tz - n.z) * Math.min(1, dt * 5);
        const dth = 0.05 * s, R2 = 4.2 - D.wrap * 1.3 + s * 0.5 * Math.sin(3 * (th + dth));
        turn(n, Math.atan2(GX + Math.sin(th + dth) * R2 - tx, GZ + Math.cos(th + dth) * R2 - tz), dt, 7);
        npcs.actorPlay(n, 'Walk', 0.3, 1.0);
        n.root.position.set(n.x, n.y, n.z); n.root.rotation.y = n.rot;
        pose(n, RIBBON_ARM);
      }
      if (maypole.ribbons.visible) { for (const d of D.dancers) d.n.root.updateMatrixWorld(true); updateRibbons(D.wrap); }
      if (D.herald) { standBy(D.herald, dt, { x: GX, z: GZ }); heraldPose(D.herald, dt); }
      if (dancing) crowdTick(dt, D, GX, GZ, 26, ['예쁘다!', '봄이다!', '랄랄라~', '임금님 만세!']);
      if (dancing && Math.random() < dt * 0.15 && D.dancers.length) say(pick(D.dancers).n, pick(['랄랄라~', '엇갈려!', '안으로, 밖으로!']), 1.4);
      return true;
    },
    stop: danceStop,
  };

  /* ═══════════ ⑤ 거리 광대 ═══════════ */
  const P = { phase: '', t: 0, x: 0, z: 0, side: 1, juggler: null, breather: null, coins: 0, tipped: false, cycle: 0, obj: { active: false } };
  const ballGeo = keep(new THREE.SphereGeometry(0.06, 8, 6));
  const clubGeo = keep(new THREE.CylinderGeometry(0.035, 0.015, 0.36, 6));
  const ballMats = [0xe83a3a, 0xf5c400, 0x3a8ee8].map(c => keep(new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })));
  const props5 = (() => {
    const g = new THREE.Group(); g.visible = false;
    const balls = ballMats.map(m => { const b = new THREE.Mesh(ballGeo, m); b.castShadow = true; g.add(b); return b; });
    const clubs = ballMats.map(m => { const c = new THREE.Mesh(clubGeo, m); c.castShadow = true; g.add(c); return c; });
    const hat = new THREE.Group();
    const brim = cyl(0.28, 0.28, 0.025, keep(new THREE.MeshStandardMaterial({ color: 0x5a2a6a, roughness: 0.9 })), 14);
    const crown = cyl(0.16, 0.2, 0.2, brim.material, 12); crown.position.y = -0.08;
    const coinsM = cyl(0.13, 0.13, 0.03, M.gold, 10); coinsM.position.y = -0.03; coinsM.scale.set(0.3, 1, 0.3);
    hat.add(brim, crown, coinsM); hat.rotation.x = Math.PI; hat.userData.coins = coinsM; g.add(hat);
    const torch = new THREE.Group();
    const stick = cyl(0.025, 0.03, 0.55, M.darkWood, 6); stick.position.y = 0.2; torch.add(stick);
    const head = cyl(0.05, 0.04, 0.1, M.char, 6); head.position.y = 0.5; torch.add(head);
    g.add(torch);
    addRoot(g);
    return { g, balls, clubs, hat, torch };
  })();
  const JUGGLE = { armL: [-38, -50, 6], armR: [-38, -50, 6] };
  const _loc = new V3();
  const performers = {
    weight: 2,
    eligible: () => true,
    start() {
      const p = playerPos(); if (!p) return false;
      const st = npcs.stalls || [];
      let best = null, bd = 70;
      for (const s of st) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } }
      let z, side;
      if (best) { z = clamp(best.z + 7, B.minZ + 6, B.maxZ - 6); side = Math.sign(best.x - pathX(best.z)) || 1; }
      else { z = clamp(p.z + 10, B.minZ + 6, B.maxZ - 6); side = 1; }
      P.x = pathX(z) + side * 4.4; P.z = z; P.side = side;
      const face = Math.atan2(-side, 0);
      P.juggler = actor(6); place(P.juggler, P.x, P.z - 1.3, face);
      P.breather = actor(7); place(P.breather, P.x, P.z + 1.3, face);
      P.phase = 'show'; P.t = 48; P.coins = 0; P.tipped = false; P.cycle = 0; P.coinT = 4; P.nearT = 0;
      props5.g.visible = true;
      props5.hat.position.set(P.x - side * 1.3, groundY(P.x - side * 1.3, P.z) + 0.2, P.z);
      props5.hat.userData.coins.scale.set(0.3, 1, 0.3);
      gatherCrowd(P.obj, P.x, P.z, 4, 6, true, face);
      say(P.juggler, '자, 구경들 하시오!', 2.5, '#5a2a6a');
      toast(`🤹 거리 광대 공연! 저글링과 불 뿜기 (${dirText(P.x, P.z)}) — 모자에 동전을 넣어 주세요`);
      return true;
    },
    update(dt, t) {
      P.t -= dt;
      const j = P.juggler, b = P.breather, toRoad = Math.atan2(-P.side, 0);
      if (P.t <= 0 && P.phase === 'show') {
        P.phase = 'bow'; P.t = 4;
        toast(`🤹 공연 끝! 광대들이 오늘 동전 ${P.coins}닢을 벌었어요`);
        say(j, '감사합니다~', 2); say(b, '또 오시오!', 2);
        SND.cheer(P.x, P.z, 0.9);
      }
      if (P.phase === 'bow' && P.t <= 0) return false;
      const show = P.phase === 'show';
      /* 저글러 */
      const okJ = walkIn(j, dt);
      const useClubs = P.t < 24;
      for (const m of props5.balls) m.visible = okJ && show && !useClubs;
      for (const m of props5.clubs) m.visible = okJ && show && useClubs;
      if (okJ) {
        npcs.actorPlay(j, show ? 'Idle' : 'Cheers', 0.3); turn(j, toRoad, dt, 4);
        if (show) {
          j.root.rotation.y = j.rot; j.root.updateMatrixWorld(true);
          pose(j, JUGGLE);
          const per = 1.5;
          for (let i = 0; i < 3; i++) {
            const u = ((t / per + i / 3) % 1 + 1) % 1, s = (u % 0.5) * 2, fromR = u < 0.5;
            const x0 = fromR ? -0.22 : 0.22, x1 = -x0;
            _loc.set(x0 + (x1 - x0) * s, 1.12 + 4 * 0.75 * s * (1 - s), 0.4);
            j.root.localToWorld(_loc);
            const m = useClubs ? props5.clubs[i] : props5.balls[i];
            m.position.copy(_loc);
            if (useClubs) { m.rotation.set(t * 9 + i, j.rot, 0, 'YXZ'); }
          }
        }
      }
      /* 불 뿜는 광대: 6초 주기 — 횃불 들기 → 뿜기 */
      const okB = walkIn(b, dt);
      props5.torch.visible = okB;
      if (okB) {
        turn(b, toRoad, dt, 4);
        b.root.rotation.y = b.rot; b.root.updateMatrixWorld(true);
        P.cycle += dt; const c = P.cycle % 6;
        const lift = show ? clamp((c - 1.2) / 0.8, 0, 1) * (c < 4.2 ? 1 : clamp(1 - (c - 4.2) / 0.6, 0, 1)) : 0;
        npcs.actorPlay(b, show ? 'Idle' : 'Cheers', 0.3);
        if (lift > 0) pose(b, { armR: [-40 - 70 * lift, -20, 10], spine: -12 * clamp((c - 2) / 0.4, 0, 1) * (c < 3.6 ? 1 : 0) });
        boneWorld(b, 'handR', props5.torch.position);
        props5.torch.rotation.set(0, b.rot, 0);
        props5.torch.updateMatrixWorld(true);
        _v.set(0, 0.55, 0); props5.torch.localToWorld(_v);
        if (Math.random() < 0.6) fx(1, _v.x, _v.y, _v.z, rr(-0.1, 0.1), rr(0.4, 0.8), rr(-0.1, 0.1), 0.4, 0.22, 0.05, -1);
        if (show && c >= 2.4 && c < 3.6) {
          if (P.lastBurst !== Math.floor(P.cycle / 6)) { P.lastBurst = Math.floor(P.cycle / 6); SND.whoosh(b.x, b.z); for (const o of villagers()) if (Math.hypot(o.pos.x - b.x, o.pos.z - b.z) < 14 && Math.random() < 0.3) { say(o.npc, pick(['우와!', '뜨거워!', '불이다!']), 1.3); } }
          boneWorld(b, 'head', _v2);
          const fxd = Math.sin(b.rot), fzd = Math.cos(b.rot);
          _v2.x += fxd * 0.18; _v2.z += fzd * 0.18; _v2.y += 0.02;
          for (let k = 0; k < 3; k++) fx(1, _v2.x, _v2.y, _v2.z, fxd * rr(5, 8) + rr(-0.7, 0.7), rr(1.2, 2.4), fzd * rr(5, 8) + rr(-0.7, 0.7), rr(0.45, 0.7), 0.12, 0.5, -1.5);
          wantLight(_v2.x + fxd * 1.5, _v2.y + 0.5, _v2.z + fzd * 1.5, 30, 0xff9040, 14, 2);
        }
      }
      /* 동전: 구경꾼이 가끔 던진다, 플레이어가 모자 곁에 서 있으면 한 닢 */
      if (show) {
        P.coinT -= dt;
        if (P.coinT <= 0) {
          P.coinT = rr(4, 8);
          let from = null;
          for (const o of villagers()) if (Math.hypot(o.pos.x - P.x, o.pos.z - P.z) < 14) { from = o; break; }
          if (from) { throwCoin(from.pos.x, from.pos.y + 1.3, from.pos.z); say(from.npc, pick(['옜다!', '잘한다!', '한 닢 받게!']), 1.4); }
        }
        const p = playerPos();
        if (!P.tipped && p && isOnFoot() && Math.hypot(p.x - props5.hat.position.x, p.z - props5.hat.position.z) < 2.6) {
          P.nearT += dt;
          if (P.nearT > 1.2) {
            P.tipped = true; throwCoin(p.x, groundY(p.x, p.z) + 1.3, p.z); P.coins += 4;
            toast('🪙 왕자님이 모자에 은화를 넣었다! 광대: "성은이 망극하옵니다~"');
            say(j, '왕자님 만세!', 2); SND.cheer(P.x, P.z, 0.6);
          }
        } else P.nearT = 0;
        crowdTick(dt, P, P.x, P.z, 18, ['우와!', '잘한다!', '한 번 더!']);
      }
      props5.hat.userData.coins.scale.set(0.3 + Math.min(0.7, P.coins * 0.04), 1, 0.3 + Math.min(0.7, P.coins * 0.04));
      return true;
    },
    stop() {
      release(P.juggler); release(P.breather); P.juggler = P.breather = null;
      props5.g.visible = false; P.phase = ''; P.obj.active = false;
    },
  };
  function throwCoin(x, y, z) {
    const h = props5.hat.position, T = 0.7;
    const d = debris(x, y, z, (h.x - x) / T, (h.y + 0.1 - y) / T + 4.9 * T, (h.z - z) / T, 0.07, 0.012, 0.07, 0xffc83a, T + 0.05, 0);
    if (d) d.av.set(rr(10, 18), 0, rr(-5, 5));
    P.coins++;
    setTimeout(() => SND.coin(h.x, h.z), T * 1000);
  }

  /* ═══════════ ⑥ 용 출현 (밤, 드물게) ═══════════ */
  let dragon = null;
  function buildDragon() {
    if (dragon) return dragon;
    const body = keep(new THREE.MeshStandardMaterial({ color: 0x8a1a18, roughness: 0.65, emissive: 0x2a0404, emissiveIntensity: 0.6, flatShading: true }));
    const belly = keep(new THREE.MeshStandardMaterial({ color: 0xd8a050, roughness: 0.7, emissive: 0x2a1404, emissiveIntensity: 0.5, flatShading: true }));
    const wingM = keep(new THREE.MeshStandardMaterial({ color: 0xa82a24, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x200303, emissiveIntensity: 0.6, flatShading: true }));
    const horn = keep(new THREE.MeshStandardMaterial({ color: 0xf0e6c8, roughness: 0.6 }));
    const eye = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 0.4), toneMapped: false }));
    const g = new THREE.Group(); g.visible = false;
    const sph = keep(new THREE.IcosahedronGeometry(1, 1));
    const torso = new THREE.Mesh(sph, body); torso.scale.set(1.1, 0.95, 2.5); g.add(torso);
    const bel = new THREE.Mesh(sph, belly); bel.scale.set(0.9, 0.7, 2.2); bel.position.y = -0.32; g.add(bel);
    /* 목 → 머리 */
    const neck = []; let parent = g;
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Group(); s.position.set(0, i ? 0.32 : 0.45, i ? 0.62 : 2.0); parent.add(s);
      const m = new THREE.Mesh(sph, body); m.scale.setScalar(0.62 - i * 0.05); m.scale.z *= 1.3; s.add(m);
      neck.push(s); parent = s;
    }
    const head = new THREE.Group(); head.position.set(0, 0.25, 0.7); parent.add(head);
    const skull = new THREE.Mesh(sph, body); skull.scale.set(0.55, 0.45, 0.7); head.add(skull);
    const snout = new THREE.Mesh(keep(new THREE.BoxGeometry(0.62, 0.36, 0.95)), body); snout.position.set(0, -0.04, 0.75); head.add(snout);
    const jaw = new THREE.Group(); jaw.position.set(0, -0.22, 0.25); head.add(jaw);
    const jm = new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 0.14, 1.05)), belly); jm.position.set(0, -0.04, 0.5); jaw.add(jm);
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(keep(new THREE.ConeGeometry(0.11, 0.75, 6)), horn); h.position.set(s * 0.26, 0.38, -0.3); h.rotation.x = -1.05; h.rotation.z = -s * 0.2; head.add(h);
      const e = new THREE.Mesh(keep(new THREE.SphereGeometry(0.08, 6, 4)), eye); e.position.set(s * 0.3, 0.14, 0.32); head.add(e);
    }
    const mouth = new THREE.Object3D(); mouth.position.set(0, -0.1, 1.25); head.add(mouth);
    /* 꼬리 */
    const tail = []; parent = g;
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Group(); s.position.set(0, i ? 0 : 0.05, i ? -0.85 : -2.2); parent.add(s);
      const r = 0.55 * (1 - i / 8);
      const m = new THREE.Mesh(keep(new THREE.ConeGeometry(r, 1.2, 7).rotateX(-Math.PI / 2).translate(0, 0, -0.4)), body); s.add(m);
      tail.push(s); parent = s;
    }
    const spade = new THREE.Mesh(keep(new THREE.OctahedronGeometry(0.4, 0)), body); spade.scale.set(1, 0.2, 1.3); spade.position.z = -1.0; parent.add(spade);
    /* 등 가시 */
    const spikeG = keep(new THREE.ConeGeometry(0.12, 0.45, 4));
    for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(spikeG, horn); sp.position.set(0, 0.92, 1.6 - i * 0.65); sp.rotation.x = -0.4; g.add(sp); }
    /* 다리 (접음) */
    for (const [x, z] of [[0.6, 1.3], [-0.6, 1.3], [0.6, -1.3], [-0.6, -1.3]]) { const l = new THREE.Mesh(keep(new THREE.ConeGeometry(0.2, 0.9, 6)), body); l.position.set(x, -0.75, z); l.rotation.x = 1.2; g.add(l); }
    /* 날개: 안쪽·바깥쪽 두 마디 (박쥐 날개) */
    function wingGeo(pts) {
      const pos = [];
      for (let i = 1; i < pts.length - 1; i++) pos.push(...pts[0], ...pts[i], ...pts[i + 1]);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
      return keep(geo);
    }
    const inner = wingGeo([[0, 0, 0.3], [3.4, 0.2, 0.6], [3.4, 0, -1.2], [2.4, 0, -2.3], [1.2, 0, -2.0], [0, 0, -1.4]]);
    const outer = wingGeo([[0, 0, 0], [4.4, 0, -0.4], [3.6, 0, -1.6], [2.4, 0, -2.6], [1.2, 0, -2.2], [0, 0, -1.2]]);
    const armG = keep(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 5).rotateZ(Math.PI / 2).translate(1.7, 0.05, 0.5));
    const fingerG = keep(new THREE.CylinderGeometry(0.04, 0.07, 4.4, 4).rotateZ(Math.PI / 2).translate(2.2, 0.03, -0.2));
    const wings = [];
    for (const s of [1, -1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.75, 0.55, 0.9); sh.scale.x = s; g.add(sh);
      sh.add(new THREE.Mesh(inner, wingM), new THREE.Mesh(armG, body));
      const wr = new THREE.Group(); wr.position.set(3.4, 0.2, 0.6); sh.add(wr);
      wr.add(new THREE.Mesh(outer, wingM), new THREE.Mesh(fingerG, body));
      wings.push({ sh, wr, s });
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    addRoot(g);
    dragon = { g, neck, head, jaw, mouth, tail, wings, active: false, curve: null, len: 0, s: 0, phase: 0, fireT: 0, fired: false, panicked: false, roared2: false, done: false };
    return dragon;
  }
  function triggerDragon() {
    const p = playerPos(); if (!p) return false;
    const d = buildDragon();
    if (d.active) return false;
    const gx = pathX(-80), gz = -80;
    const cz = Math.max(p.z, -40);
    const pts = [
      new V3(p.x + 120, 75, cz + 80), new V3(p.x + 40, 40, cz + 30), new V3(p.x + 4, 30, cz - 4),
      new V3((p.x + gx) / 2 - 12, 34, (cz + gz) / 2 - 6), new V3(gx + 8, 40, gz - 12), new V3(gx - 25, 58, gz - 45), new V3(gx - 80, 95, gz - 100),
    ];
    d.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    d.len = d.curve.getLength(); d.s = 0; d.speed = 17; d.active = true; d.fireT = 0; d.fired = false; d.panicked = false; d.roared2 = false;
    d.g.visible = true;
    SND.roar();
    toast('🐉 크아아앙!! 어디선가 무시무시한 울음소리가… 하늘을 보세요!');
    return true;
  }
  function dragonUpdate(dt, t) {
    const d = dragon; if (!d || !d.active) return;
    const p = playerPos();
    d.s += d.speed * dt;
    const u = Math.min(1, d.s / d.len);
    d.curve.getPointAt(u, _v); d.curve.getPointAt(Math.min(1, u + 0.004), _v2);
    d.g.position.copy(_v);
    _v3.subVectors(_v2, _v);
    if (_v3.lengthSq() > 1e-6) { d.g.lookAt(_v2); }
    /* 날갯짓 */
    d.phase += dt * (d.fireT > 0 ? 3.2 : 4.2);
    const fl = Math.sin(d.phase);
    for (const w of d.wings) { w.sh.rotation.z = w.s * (0.12 + 0.62 * fl); w.wr.rotation.z = 0.35 * Math.sin(d.phase - 0.8); }
    d.g.position.y += -fl * 0.5;
    d.tail.forEach((s, i) => { s.rotation.y = Math.sin(t * 2.2 - i * 0.6) * 0.16; s.rotation.x = Math.sin(t * 1.7 - i * 0.5) * 0.06; });
    d.neck.forEach((s, i) => { s.rotation.x = d.fireT > 0 ? -0.18 : Math.sin(t * 1.3 + i) * 0.05; s.rotation.y = Math.sin(t * 0.9 - i * 0.4) * 0.06; });
    if (p) {
      const hd = Math.hypot(_v.x - p.x, _v.z - p.z);
      /* 마을 위로 오면: 사람들 도망, 근위병 외침 */
      if (!d.panicked && hd < 55) {
        d.panicked = true;
        npcs.alarm({ x: p.x, z: p.z }, 45, 'explosion');
        let said = 0;
        for (const o of npcs.list()) {
          if (o.off) continue;
          if (o.guard && said < 3) { say(o.npc, pick(['용이다! 모두 피하라!', '활을 쏴라! …너무 높다!', '임금님을 지켜라!']), 2.4, '#7a1a10'); said++; }
          else if (!o.guard && !o.barkeeper && Math.random() < 0.25 && Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < 30) say(o.npc, pick(['용이다!!', '으아아!', '엄마야!', '숨어!']), 1.8);
        }
        toast('🐉 용이 나타났다! 마을 사람들이 혼비백산! 근위병: "모두 집으로 피하라!"');
      }
      if (!d.fired && d.panicked && hd < 26) { d.fired = true; d.fireT = 2.4; SND.roar(); }
    }
    if (d.fireT > 0) {
      d.fireT -= dt;
      d.jaw.rotation.x = 0.55;
      d.g.updateMatrixWorld(true);
      d.mouth.getWorldPosition(_v3); d.head.getWorldQuaternion(_wq);
      _fwd.set(0, 0, 1).applyQuaternion(_wq);
      for (let k = 0; k < 6; k++) fx(1, _v3.x, _v3.y, _v3.z, _fwd.x * 16 + rr(-1.5, 1.5), _fwd.y * 16 + 9 + rr(-1.5, 1.5), _fwd.z * 16 + rr(-1.5, 1.5), rr(1.0, 1.5), 0.9, 3.6, -1.5);
      wantLight(_v3.x, _v3.y, _v3.z, 900, 0xff8a30, 90, 1.4);
    } else d.jaw.rotation.x = Math.max(0, d.jaw.rotation.x - dt * 2);
    if (u >= 1) {
      d.active = false; d.g.visible = false;
      toast('🐉 용이 상호성 쪽으로 날아갔다… "임금님과 용이 차를 마시는 사이"라는 소문이 돈다');
    }
  }

  /* ════ 스케줄 ════ */
  const EVENTS = { joust, archery, bonfire, maypole: maypoleEv, performers };
  let dragonClock = rr(DRAGON_EVERY[0], DRAGON_EVERY[1]);
  function startEvent(name, force = false) {
    const e = EVENTS[name]; if (!e) return false;
    if (cur === e) return false;
    if (!force && !e.eligible()) return false;
    if (cur) stopEvent();
    if (!e.start()) return false;
    cur = e; curName = name; lastName = name;
    return true;
  }
  function stopEvent() {
    if (!cur) return;
    try { cur.stop(); } catch (e) { console.warn('[festival] stop', e); }
    cur = null; curName = '';
    mainClock = rr(MAIN_GAP[0], MAIN_GAP[1]);
  }
  function pickEvent() {
    const c = [];
    for (const [k, e] of Object.entries(EVENTS)) {
      if (k === lastName && k !== 'performers') continue;
      let ok = false; try { ok = e.eligible(); } catch { ok = false; }
      if (ok) c.push([k, e.weight]);
    }
    if (!c.length) return null;
    let s = c.reduce((a, [, w]) => a + w, 0) * Math.random();
    for (const [k, w] of c) { s -= w; if (s <= 0) return k; }
    return c[c.length - 1][0];
  }
  function trigger(name) {
    if (name === 'stop') { stopEvent(); if (dragon) { dragon.active = false; dragon.g.visible = false; } return true; }
    if (name === 'dragon') return triggerDragon();
    return startEvent(name, true);
  }

  /* ════ 매 프레임 (npcs.update 다음에) ════ */
  let lastT = 0;
  function update(dt, t) {
    if (disposed || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    t = Number.isFinite(t) ? t : (lastT + dt);
    lastT = t;
    const p = playerPos(); if (!p) return;
    offTick();
    if (cur) {
      let alive = false;
      try { alive = cur.update(dt, t); } catch (e) { console.warn('[festival]', curName, e); alive = false; }
      if (!alive) stopEvent();
      else if (cur === joust && J.phase !== 'load' && distP(JX, JZM) > 170) stopEvent();
    } else {
      mainClock -= dt;
      if (mainClock <= 0) {
        mainClock = 25;
        if (isVisible()) { const k = pickEvent(); if (k) startEvent(k); }
      }
    }
    /* 용: 밤에만, 큰 축제가 없을 때 */
    dragonClock -= dt;
    if (dragonClock <= 0) {
      if (isVisible() && getNight() > 0.55 && (!cur || cur === performers) && !(dragon && dragon.active)) { triggerDragon(); dragonClock = rr(DRAGON_EVERY[0], DRAGON_EVERY[1]); }
      else dragonClock = 20;
    }
    dragonUpdate(dt, t);
    luteTick();
    fxUpdate(dt, t);
    dbUpdate(dt);
    waveFlags(t);
    lightApply();
  }

  function dispose() {
    disposed = true;
    if (cur) { try { cur.stop(); } catch { /* */ } cur = null; }
    for (const n of pendingOff) npcs.actorOff(n);
    for (const kn of knights || []) npcs.actorOff(kn.n);
    for (const n of gen) if (n) npcs.actorOff(n);
    for (const o of roots) scene.remove(o);
    for (const d of disposables) if (d && d.dispose) d.dispose();
    if (actx) actx.close().catch(() => {});
    if (debug && globalThis.__festival) delete globalThis.__festival;
  }
  function state() {
    return {
      current: curName || null,
      phase: cur === joust ? J.phase : cur === archery ? A.phase : (cur === bonfire || cur === maypoleEv) ? D.phase : cur === performers ? P.phase : null,
      joust: J.ks ? { round: J.round, score: J.ks.map(k => k.score), mounted: J.ks.map(k => k.mounted) } : null,
      archery: A.archers.length ? { scores: A.archers.map(a => [a.name, a.scores.slice()]), player: A.player.slice() } : null,
      clocks: { next: Math.round(mainClock), dragon: Math.round(dragonClock) },
      dragon: dragon && dragon.active ? { s: Math.round(dragon.s), len: Math.round(dragon.len), fire: dragon.fireT > 0 } : null,
      fx: fxAlive, debris: dbAlive, horses: horses ? 'ready' : horseFail ? 'failed' : horsesBuilding ? 'loading' : 'idle',
    };
  }
  const colliders = () => [archGroup];
  /* 말은 미리 천천히 읽어 둔다 (창시합 시작이 빨라지게) */
  const preT = setTimeout(() => { if (!disposed) buildHorses(); }, 20000);
  disposables.push({ dispose: () => clearTimeout(preT) });

  const api = { update, dispose, state, trigger, colliders, scoreArrow, sites: FESTIVAL_SITES };
  if (debug) globalThis.__festival = {
    joust: () => trigger('joust'), archery: () => trigger('archery'), bonfire: () => trigger('bonfire'),
    maypole: () => trigger('maypole'), performers: () => trigger('performers'), dragon: () => trigger('dragon'),
    stop: () => trigger('stop'), state, scoreArrow, api,
    get J() { return J; }, get A() { return A; }, get D() { return D; }, get P() { return P; }, get dragonObj() { return dragon; },
  };
  return api;
}
