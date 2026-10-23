/* ════════════════════════════════════════════════════════════════════
   pageant.js — 상호랜드 마을 행사 3탄 (임금님 최상호의 왕국 이벤트)
     ① 왕실 연회   : 동쪽 잔디밭(20, 48)에 긴 식탁(통구이·빵·과일·금잔·촛불)이 차려지고 임금님(npc-king)이 상석에 앉는다.
                    마을 사람 7명이 긴 의자에 앉아 먹고 마시다가, 임금님이 일어나 "상호왕국을 위하여!" → 모두 일어나 건배.
                    빈자리에 다가가면 "F 연회 자리 앉기" → 알림 + 은화 5닢(getTavern().addCoins(5)).
     ② 결혼식 행렬 : 신부(흰 면사포·꽃관·부케)와 신랑(가슴 꽃)이 하객 3명과 큰길을 따라 걸어 마을 광장 꽃 아치까지 간다.
                    꽃잎이 흩날리고 종소리(WebAudio), 길가 사람들은 박수. 아치에서 수도사가 선포 → 입맞춤 → 하트.
     ③ 하늘 등불 축제(밤) : 마을 사람들이 돌다리와 개울가에 모여 "하나, 둘, 셋!" 하고 종이 등불 30~60개를 하늘로 날린다.
                    등불은 InstancedMesh 하나 + 빛무리 Points 하나(HDR 색이라 블룸이 빛을 만든다). 아이들 환호.
                    다리 근처에서 "F 등불 날리기"로 플레이어도 소원 등불을 하나 날릴 수 있다.
     ④ 투석기 시연(낮) : 동쪽 들판(28, -15, 마녀 오두막 동쪽)의 나무 투석기가 15 m 앞(37.5, -26.5) 나무 요새로 호박을 3번 던진다. 호박은 주황 조각으로 터지고
                    요새 판자가 날아간다. 투석기 옆 레버에서 "F 투석기 발사!"(행사마다 한 번) → 플레이어가 쏜다.
     ⑤ 줄다리기(낮) : 출발점 서쪽 풀밭(-30, 69)에서 빨강 4명 vs 파랑 4명. 플레이어가 한쪽 끝에서 F → 그 편에 들어가
                    F 연타(또는 안내 버튼 클릭)로 힘을 보탠다. 이긴 편은 환호, 진 편은 만화처럼 앞으로 넘어진다(knockDown 'fight', ★ 없음).
   큰 행사는 한 번에 하나만, festival.js 큰 축제와 겹치지 않는다(isBusy). 행사 중 축제가 시작되면 짧게 마무리한다.
   가볍게: 추가 조명 PointLight 1개, 등불·꽃잎·조각은 인스턴싱, 반짝이·하트는 Points 하나. 사람은 npcs.js 배우 API.

   ── portfolio.js 연결 ──
   ⓪ 위쪽 import 묶음 (festival.js import 옆):
        const { PAGEANT_CLEAR, createPageant } = await import('./pageant.js');   // 연회·결혼식·등불·투석기·줄다리기
      let 선언: let npcs = null, events = null, village = null, festival = null, pageant = null;
   ① 나무 비우기 (월드 콜백, FESTIVAL_CLEAR 줄 다음):
        clearTrees(gltf.scene, PAGEANT_CLEAR.spots, PAGEANT_CLEAR.r);              // 행사 자리
   ② 만들기 (npcs .then 안, festival = createFestival({...}) 바로 다음):
        pageant = createPageant({
          THREE, scene, camera, npcs: n, pathX, groundY,
          getPlayerPos: () => activePos(),
          isOnFoot: () => player.mode === 'onfoot',
          getNight: () => night,
          getSeason: () => seasons.season,
          isMusicOn: () => document.getElementById('g-music-btn')?.getAttribute('aria-pressed') === 'true',
          isVisible: () => driveActive,
          isBusy: () => !!(festival && festival.state().current),          // 축제(창시합·활쏘기·모닥불·메이폴·광대) 중엔 시작 안 함
          isKingBusy: () => !!(village && village.state().procession),      // 임금님 행차 중엔 연회를 안 연다(임금님이 둘이 되지 않게)
          onEvent: text => toast(text, 2600),
          getTavern: () => tavern, getKids: () => kids, castle,
          bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
        });
   ③ step(dt) 안 festival.update 다음 줄 (반드시 npcs.update 뒤):
        if (pageant) pageant.update(dt, t);
   ④ F 키 (우선순위: 대화 > 의뢰 게시판 > 행사 > 가게 > 낚시 > 탈것). quests.onF 줄 다음에:
        if (player.mode === 'onfoot' && pageant && pageant.onF(e.repeat)) { hideHint(); return; }
      (e.repeat 를 넘기면 F 를 꾹 누르고 있어도 줄다리기 연타가 자동으로 되지 않는다)
   (선택) festival 쪽에서도 겹치지 않게 하려면, 나중에 festival.js 에 isBusy 옵션이 생기면 () => !!(pageant && pageant.state().current).
         지금은 행사 중 축제가 시작되면 이쪽이 몇 초 안에 마무리한다.

   ── 옵션 ──
     THREE, scene, npcs(addActor 있는 판), pathX(z), groundY(x, z)  — 필수
     camera, getPlayerPos() {x,z}, isOnFoot(), getNight() 0..1, getSeason(), isMusicOn(), isMuted(), isVisible(),
     isBusy()  true 면 새 행사를 시작하지 않고, 진행 중인 건 마무리     isKingBusy()  true 면 연회를 열지 않는다
     onEvent(text), getTavern() → { addCoins(n) }, getKids() → { cheer(pos) }, castle (안 써도 됨), CANNON/world (안 씀)
     sitPlayer(seat) / standPlayer()  (선택) 연회 자리에 플레이어를 진짜로 앉히는 훅. seat = {x, y(바닥), z, rotY}. 없으면 서서 합석.
       tavern.js 의 sitAt/standUp 을 그대로 넘기면 된다:  sitPlayer: s => tavern.sitAt(s), standPlayer: () => tavern.standUp(),
       sitPlayer 가 false 를 돌려주면 앉지 않은 것으로 본다. 일어났는지는 getTavern().seated 로 안다(E·WASD·Esc 로 일어나면 자리를 비운다).
     bounds {minX,maxX,minZ,maxZ}   debug (기본 ?test 일 때 window.__pageant)
   ── 반환 ──
     update(dt, t), nearAction() → {kind, label} | null, onF(repeat) → bool, dispose(), state(), trigger(name)
       name = 'feast'|'wedding'|'lanterns'|'trebuchet'|'tug'|'stop'
   콘솔(?test): __pageant.feast(), .wedding(), .lanterns(), .trebuchet(), .tug(), .stop(), .state(), .go(name) (운전 중 그 자리로 순간이동)
   ════════════════════════════════════════════════════════════════════ */

const AMP = 3.08, K = 0.04285714285714286;
const px0 = z => AMP * Math.sin(-K * z);
const BRIDGE_Z = -36.4;

export const PAGEANT_SITES = {
  feast: { x: 20, z: 48, name: '동쪽 잔디밭' },
  wedding: { z0: 6, zTurn: 51, x: -15.5, z: 50, name: '마을 광장 꽃 아치' },
  lanterns: { x: px0(BRIDGE_Z), z: BRIDGE_Z, name: '돌다리' },
  trebuchet: { x: 28, z: -15, fx: 37.5, fz: -26.5, name: '동쪽 들판(마녀 오두막 동쪽)' },
  tug: { x: -30, z: 69, name: '서쪽 풀밭' },
};
/* portfolio.js clearTrees(gltf.scene, PAGEANT_CLEAR.spots, PAGEANT_CLEAR.r) — 첫 화면 전에 읽으려고 clear-spots.js 로 옮겼다 */
import { PAGEANT_CLEAR } from './clear-spots.js';
export { PAGEANT_CLEAR };

const D2R = Math.PI / 180;
const FIRST = [55, 95], GAP = [90, 150], SITE_NEAR = 100;

export function createPageant({
  THREE, scene, camera = null, npcs, pathX = px0, groundY = () => 0,
  getPlayerPos, isOnFoot = () => true, getNight = () => 0, getSeason = () => 'autumn',
  isMusicOn = () => false, isMuted = () => false,
  isVisible = () => document.body.dataset.view !== 'doc',
  isBusy = () => false, isKingBusy = () => false,
  onEvent = null, getTavern = null, getKids = null, castle = null, CANNON = null, world = null,
  sitPlayer = null, standPlayer = null, bounds = null,
  debug = typeof location !== 'undefined' && /[?&]test\b/.test(location.search),
} = {}) {
  void castle; void CANNON; void world;
  const NOOP = { update() {}, nearAction: () => null, onF: () => false, dispose() {}, state: () => ({}), trigger: () => false };
  if (!THREE || !scene || !npcs || !npcs.addActor) return NOOP;
  const V3 = THREE.Vector3, Q = THREE.Quaternion;
  const B = bounds || npcs.bounds || { minX: -42, maxX: 42, minZ: -84, maxZ: 84 };
  const rr = (a, b) => a + (b - a) * Math.random();
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const toast = t => { if (onEvent) onEvent(t); };
  const say = (n, t, life = 1.8, col = null) => { if (n && !n.off) npcs.say(n, t, life, col); };
  const playerPos = () => { const p = getPlayerPos ? getPlayerPos() : null; return p && Number.isFinite(p.x) ? p : null; };
  const distP = (x, z) => { const p = playerPos(); return p ? Math.hypot(x - p.x, z - p.z) : 1e9; };
  const kidsCheer = (x, z) => { try { const k = getKids && getKids(); if (k && k.cheer) k.cheer({ x, z }); } catch { /* */ } };
  const addCoins = n => { try { const tv = getTavern && getTavern(); if (tv && tv.addCoins) { tv.addCoins(n); return true; } } catch { /* */ } return false; };
  const disposables = [];
  const keep = x => { disposables.push(x); return x; };
  const roots = [];
  const addRoot = o => { scene.add(o); roots.push(o); return o; };
  const _v = new V3(), _v2 = new V3(), _v3 = new V3();
  let disposed = false;

  function turn(n, target, dt, rate = 5) {
    const d = wrap(target - n.rot), m = rate * dt;
    n.rot += Math.abs(d) <= m ? d : Math.sign(d) * m;
  }
  function stepTo(n, tx, tz, speed, dt, face = null, anim = true) {
    const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
    if (d < 0.06) { if (anim) npcs.actorPlay(n, 'Idle', 0.3); if (face !== null) turn(n, face, dt); return true; }
    const sp = Math.min(speed, d / dt);
    n.x += dx / d * sp * dt; n.z += dz / d * sp * dt;
    turn(n, Math.atan2(dx, dz), dt, 6);
    if (anim) npcs.actorPlay(n, 'Walk', 0.3, clamp(speed / 1.3, 0.5, 2.2));
    return false;
  }
  function villagers() {
    const out = [];
    for (const o of npcs.list()) if (!o.off && !o.guard && !o.barkeeper && !o.npc.actor) out.push(o);
    return out;
  }
  /* 근처 마을 사람: 행사 쪽을 보며 환호 */
  function crowdTick(dt, ev, cx, cz, r, lines, max = 8, every = 1.4) {
    ev.crowdT = (ev.crowdT || 0) - dt;
    if (ev.crowdT > 0) return;
    ev.crowdT = every;
    let k = 0, said = 0;
    for (const o of villagers()) {
      if (k >= max) break;
      if (o.seated || Math.hypot(o.pos.x - cx, o.pos.z - cz) > r) continue;
      if (npcs.watch(o.npc, { x: cx, z: cz }, rr(2.5, 4), true)) {
        k++;
        if (lines && said < 1 && Math.random() < 0.3) { say(o.npc, pick(lines), 1.6); said++; }
      }
    }
  }
  function dirText(x, z) {
    const p = playerPos(); if (!p) return '';
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < 18) return '바로 근처';
    const names = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
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
    cheer: (x, z, big = 1) => { sNoise(x, z, { base: 0.07 * big, range: 70, dur: 1.7, f0: 900, f1: 1300, q: 0.9, attack: 0.25 }); sNoise(x, z, { base: 0.04 * big, range: 70, dur: 1.3, f0: 2200, q: 1.5, attack: 0.2, delay: 0.15 }); },
    clap: (x, z) => { for (let i = 0; i < 6; i++) sNoise(x, z, { base: 0.05, range: 40, dur: 0.05, type: 'highpass', f0: 1800 + Math.random() * 900, q: 0.8, delay: i * 0.17 + Math.random() * 0.05 }); },
    fanfare: (x, z) => {
      const notes = [[523, 0, 0.18], [659, 0.18, 0.18], [784, 0.36, 0.18], [1047, 0.54, 0.6]];
      for (const [f, d, l] of notes) sTone(x, z, { base: 0.06, range: 90, dur: l, type: 'sawtooth', f0: f, attack: 0.02, delay: d, lp: 2400 });
    },
    /* 교회 종: 비조화 배음 */
    bell: (x, z, f = 660, delay = 0) => {
      for (const [m, a, d] of [[0.5, 0.5, 3.2], [1, 1, 2.6], [1.19, 0.45, 1.8], [1.5, 0.35, 1.6], [2, 0.3, 1.2], [2.74, 0.18, 0.9]]) sTone(x, z, { base: 0.05 * a, range: 90, dur: d, f0: f * m, attack: 0.004, delay });
    },
    chime: (x, z, f, delay = 0) => { sTone(x, z, { base: 0.045, range: 70, dur: 1.6, type: 'triangle', f0: f, attack: 0.01, delay }); sTone(x, z, { base: 0.02, range: 70, dur: 1.2, f0: f * 2.01, attack: 0.01, delay }); },
    kiss: (x, z) => { sTone(x, z, { base: 0.07, range: 30, dur: 0.16, f0: 600, f1: 1500, attack: 0.01 }); sNoise(x, z, { base: 0.04, range: 30, dur: 0.07, type: 'highpass', f0: 3000, delay: 0.1 }); },
    creak: (x, z) => sTone(x, z, { base: 0.05, range: 45, dur: 0.5, type: 'sawtooth', f0: 90, f1: 70, lp: 600, attack: 0.05 }),
    whoosh: (x, z) => sNoise(x, z, { base: 0.14, range: 60, dur: 0.9, f0: 300, f1: 1600, q: 1.1, attack: 0.1 }),
    thump: (x, z) => { sTone(x, z, { base: 0.2, range: 70, dur: 0.35, f0: 120, f1: 45 }); sNoise(x, z, { base: 0.12, range: 70, dur: 0.3, type: 'lowpass', f0: 800, f1: 200 }); },
    splat: (x, z) => { sNoise(x, z, { base: 0.18, range: 70, dur: 0.4, type: 'lowpass', f0: 1400, f1: 250, attack: 0.005 }); sTone(x, z, { base: 0.12, range: 70, dur: 0.22, f0: 180, f1: 60 }); },
    crack: (x, z) => { sNoise(x, z, { base: 0.2, range: 80, dur: 0.3, type: 'highpass', f0: 1600, q: 0.7, delay: 0.03 }); sTone(x, z, { base: 0.14, range: 80, dur: 0.25, f0: 150, f1: 50, delay: 0.03 }); },
    coin: (x, z) => { sTone(x, z, { base: 0.05, range: 25, dur: 0.12, type: 'square', f0: 1800, lp: 4000 }); sTone(x, z, { base: 0.04, range: 25, dur: 0.18, type: 'square', f0: 2400, delay: 0.07, lp: 4000 }); },
    whistle: (x, z) => sTone(x, z, { base: 0.07, range: 50, dur: 0.5, type: 'square', f0: 2200, f1: 2600, lp: 3500, attack: 0.02 }),
    grunt: (x, z) => sTone(x, z, { base: 0.04, range: 25, dur: 0.15, type: 'sawtooth', f0: 140, f1: 110, lp: 700 }),
  };

  /* ════ 반짝이·하트·촛불 (Points 하나, 모양: 0 둥근 빛 1 하트) ════ */
  const FX_MAX = 600;
  const fxPos = new Float32Array(FX_MAX * 3), fxCol = new Float32Array(FX_MAX * 4), fxSize = new Float32Array(FX_MAX), fxShape = new Float32Array(FX_MAX);
  const fxVel = new Float32Array(FX_MAX * 3), fxLife = new Float32Array(FX_MAX), fxMaxL = new Float32Array(FX_MAX);
  const fxS0 = new Float32Array(FX_MAX), fxS1 = new Float32Array(FX_MAX), fxG = new Float32Array(FX_MAX), fxK = new Uint8Array(FX_MAX);
  const fxRGB = new Float32Array(FX_MAX * 3);
  for (let i = 0; i < FX_MAX; i++) fxPos[i * 3 + 1] = -9999;
  const fxGeo = keep(new THREE.BufferGeometry());
  const fxPosA = new THREE.BufferAttribute(fxPos, 3).setUsage(THREE.DynamicDrawUsage);
  const fxColA = new THREE.BufferAttribute(fxCol, 4).setUsage(THREE.DynamicDrawUsage);
  const fxSizeA = new THREE.BufferAttribute(fxSize, 1).setUsage(THREE.DynamicDrawUsage);
  const fxShapeA = new THREE.BufferAttribute(fxShape, 1).setUsage(THREE.DynamicDrawUsage);
  fxGeo.setAttribute('position', fxPosA); fxGeo.setAttribute('col', fxColA); fxGeo.setAttribute('size', fxSizeA); fxGeo.setAttribute('shape', fxShapeA);
  const ptVS = `uniform float uScale; attribute float size; attribute vec4 col; attribute float shape; varying vec4 vC; varying float vS;
      void main(){ vC = col; vS = shape; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uScale / max(0.2, -mv.z); }`;
  const ptFS = `varying vec4 vC; varying float vS;
      void main(){ vec2 d = gl_PointCoord - 0.5; float a;
        if (vS > 0.5) { vec2 p = vec2(d.x, 0.08 - d.y) * 2.6; p.y -= sqrt(abs(p.x)) * 0.55; a = smoothstep(0.62, 0.5, length(p)); }
        else { a = clamp(1.0 - length(d) * 2.0, 0.0, 1.0); a *= a; }
        if (a < 0.01) discard;
        gl_FragColor = vec4(vC.rgb * vC.a * a, 1.0); }`;
  const fxScale = { value: 600 };
  const fxMat = keep(new THREE.ShaderMaterial({ uniforms: { uScale: fxScale }, vertexShader: ptVS, fragmentShader: ptFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const fxPts = addRoot(new THREE.Points(fxGeo, fxMat));
  fxPts.frustumCulled = false; fxPts.visible = false; fxPts.renderOrder = 6;
  let fxFree = 0, fxAlive = 0;
  /* kind 1 하트(분홍, 둥실) 2 반짝(금빛) 3 촛불 불꽃(짧게) */
  function fx(kind, x, y, z, vx, vy, vz, life, s0, s1, g = 0, rgb = null) {
    for (let k = 0; k < FX_MAX; k++) {
      const i = (fxFree + k) % FX_MAX;
      if (fxK[i]) continue;
      fxFree = (i + 1) % FX_MAX;
      fxK[i] = kind; fxLife[i] = fxMaxL[i] = life; fxS0[i] = s0; fxS1[i] = s1; fxG[i] = g;
      fxShape[i] = kind === 1 ? 1 : 0;
      const c = rgb || (kind === 1 ? [3, 0.9, 1.5] : kind === 2 ? [3, 2.4, 1.2] : [3, 1.8, 0.6]);
      fxRGB[i * 3] = c[0]; fxRGB[i * 3 + 1] = c[1]; fxRGB[i * 3 + 2] = c[2];
      fxPos[i * 3] = x; fxPos[i * 3 + 1] = y; fxPos[i * 3 + 2] = z;
      fxVel[i * 3] = vx; fxVel[i * 3 + 1] = vy; fxVel[i * 3 + 2] = vz;
      fxAlive++;
      return i;
    }
    return -1;
  }
  function fxUpdate(dt, t) {
    if (camera && camera.projectionMatrix) fxScale.value = innerHeight * 0.5 * camera.projectionMatrix.elements[5] * Math.min(2, devicePixelRatio || 1);
    if (!fxAlive) { fxPts.visible = false; return; }
    fxPts.visible = true;
    const drag = Math.exp(-dt * 1.2);
    for (let i = 0; i < FX_MAX; i++) {
      const k = fxK[i]; if (!k) continue;
      const j = i * 3, c = i * 4;
      fxLife[i] -= dt;
      if (fxLife[i] <= 0) { fxK[i] = 0; fxAlive--; fxPos[j + 1] = -9999; fxCol[c + 3] = 0; fxSize[i] = 0; continue; }
      const a = 1 - fxLife[i] / fxMaxL[i];
      fxVel[j] *= drag; fxVel[j + 1] = fxVel[j + 1] * drag - fxG[i] * dt; fxVel[j + 2] *= drag;
      if (k === 1) fxVel[j] += Math.sin(t * 3 + i) * dt * 0.6;
      fxPos[j] += fxVel[j] * dt; fxPos[j + 1] += fxVel[j + 1] * dt; fxPos[j + 2] += fxVel[j + 2] * dt;
      fxSize[i] = fxS0[i] + (fxS1[i] - fxS0[i]) * a;
      fxCol[c] = fxRGB[j]; fxCol[c + 1] = fxRGB[j + 1]; fxCol[c + 2] = fxRGB[j + 2];
      fxCol[c + 3] = k === 2 ? (1 - a) * (0.55 + 0.45 * Math.sin(t * 18 + i)) : Math.min(1, a * 8) * (1 - a);
    }
    fxPosA.needsUpdate = true; fxColA.needsUpdate = true; fxSizeA.needsUpdate = true; fxShapeA.needsUpdate = true;
  }

  /* ════ 조각 (꽃잎·호박 조각·꽃종이·나무 부스러기, InstancedMesh 하나) ════ */
  const DB_MAX = 220;
  const dbMesh = addRoot(new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1, 1, 1)), keep(new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05 })), DB_MAX));
  dbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  dbMesh.frustumCulled = false; dbMesh.castShadow = false; dbMesh.visible = false;
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
      d.av.set(rr(-10, 10), rr(-10, 10), rr(-10, 10)); d.s.set(sx, sy, sz); d.life = d.max = life; d.flutter = flutter; d.rest = false;
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
        if (d.flutter) { d.v.multiplyScalar(Math.exp(-dt * 2.2)); d.v.y -= 1.6 * dt; d.v.x += Math.sin(d.life * 6 + i) * dt * 1.4; d.v.z += Math.cos(d.life * 5 + i) * dt * 1.0; }
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
  const PETALS = [0xff9ec0, 0xffffff, 0xff6f9a, 0xffd0e0, 0xfff0a0];
  const CONFETTI = [0xe83a5a, 0xf5c400, 0x3a8ee8, 0x5ac85a, 0xb45ae8, 0xff8a2a, 0xffffff];
  function petals(x, y, z, n = 6, spread = 1.2, cols = PETALS) {
    for (let k = 0; k < n; k++) debris(x + rr(-0.4, 0.4), y, z + rr(-0.4, 0.4), rr(-spread, spread), rr(1.5, 3.5), rr(-spread, spread), 0.08, 0.005, 0.06, pick(cols), rr(3, 5), 1);
  }
  function hearts(x, y, z, n = 14) {
    for (let k = 0; k < n; k++) fx(1, x + rr(-0.3, 0.3), y + rr(-0.1, 0.3), z + rr(-0.3, 0.3), rr(-0.8, 0.8), rr(0.8, 2), rr(-0.8, 0.8), rr(2, 3.2), rr(0.25, 0.4), rr(0.35, 0.55), -0.15, Math.random() < 0.3 ? [3, 0.5, 0.6] : null);
  }

  /* ════ 추가 조명 1개 (등불·촛불이 돌려 쓴다) ════ */
  const light = addRoot(new THREE.PointLight(0xffb060, 0, 16, 2));
  light.castShadow = false;
  let lightWant = null;
  function wantLight(x, y, z, I, color = 0xffb060, dist = 16, decay = 2) { if (!lightWant || I > lightWant.I) lightWant = { x, y, z, I, color, dist, decay }; }
  function lightApply() {
    if (!lightWant) { light.intensity = 0; return; }
    const w = lightWant;
    light.position.set(w.x, w.y, w.z); light.intensity = w.I; light.color.set(w.color); light.distance = w.dist; light.decay = w.decay;
    lightWant = null;
  }

  /* ════ 재질 ════ */
  const std = (color, o = {}) => keep(new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }));
  const M = {
    wood: std(0x8a5a32, { roughness: 0.85 }), darkWood: std(0x5a3a20, { roughness: 0.9 }), lightWood: std(0xb08050, { roughness: 0.85 }),
    cloth: std(0xf2ecdc), runner: std(0xa8202a, { roughness: 0.7 }),
    gold: std(0xffc83a, { metalness: 0.8, roughness: 0.3, emissive: 0x3a2400, emissiveIntensity: 0.5 }),
    roast: std(0x8a4a1c, { roughness: 0.55 }), bone: std(0xf4ead0), bread: std(0xd09048, { roughness: 0.9 }),
    plate: std(0xd8d0c0, { roughness: 0.5 }), candle: std(0xf6f0dc),
    red: std(0xd8282a, { roughness: 0.5 }), green: std(0x6ab030, { roughness: 0.5 }), grape: std(0x6a2a8a, { roughness: 0.4 }), orangeF: std(0xf09020, { roughness: 0.5 }),
    pumpkin: std(0xe8781e, { roughness: 0.7, flatShading: true }), leaf: std(0x3a8a32, { flatShading: true }),
    rope: std(0xc8a868, { roughness: 1 }), iron: std(0x4a4a50, { metalness: 0.6, roughness: 0.5 }), stone: std(0x8a847c, { roughness: 0.95, flatShading: true }),
    white: std(0xffffff, { roughness: 0.9 }), chalk: keep(new THREE.MeshBasicMaterial({ color: 0xf4f4ee, transparent: true, opacity: 0.85, depthWrite: false })),
    veil: keep(new THREE.MeshStandardMaterial({ color: 0xfbf8f2, roughness: 0.6, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false })),
    flowerP: std(0xff7aa8), flowerW: std(0xfff6f0), flowerY: std(0xffd84a), teamR: std(0xc8202a, { roughness: 0.6 }), teamB: std(0x2a55c8, { roughness: 0.6 }),
    splat: keep(new THREE.MeshStandardMaterial({ color: 0xe8781e, roughness: 0.6, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })),
  };
  function box(w, h, d, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
  function cyl(rt, rb, h, mat, seg = 8) { const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(rt, rb, h, seg)), mat); m.castShadow = true; return m; }
  function sph(r, mat, seg = 10) { const m = new THREE.Mesh(keep(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0))), mat); m.castShadow = true; return m; }
  function placeG(g, x, z, rot = 0) { g.position.set(x, groundY(x, z), z); g.rotation.y = rot; return g; }

  /* ════ 배우 (npcs.addActor) — 행사는 한 번에 하나라 모두 돌려 쓴다 ════ */
  const CAST_RE = { king: 'npc-king', noble: 'noble', maid: 'maid', baker: 'baker', herbalist: 'herbalist', traveler: 'traveler',
    monk: 'monk', bard: 'bard', blacksmith: 'blacksmith', innkeeper: 'innkeeper' };
  const cast = {};
  function actor(key) {
    if (!cast[key]) {
      const n = npcs.addActor(CAST_RE[key] || key, { noAggro: true, fallback: key === 'king' ? 'innkeeper' : null });
      n.propShow = false; cast[key] = n;
    }
    return cast[key];
  }
  const pendingOff = new Set();
  function release(n) { if (n) { n.pg = null; pendingOff.add(n); } }
  function offTick() { for (const n of pendingOff) if (npcs.actorOff(n)) { pendingOff.delete(n); n.propShow = false; } }
  /* 걸어 들어오기: 플레이어 가까이면 7 m 밖에서 나타나 걸어온다 */
  function on(n, x, z, rot) { pendingOff.delete(n); n.propShow = false; npcs.actorOn(n, x, z, rot); n.pg = { tx: x, tz: z, face: rot, arrived: true, cheerT: 0 }; }
  function place(n, x, z, face, walk = true, from = null) {
    pendingOff.delete(n); n.propShow = false;
    const p = playerPos();
    let sx = x, sz = z;
    if (from) { sx = from.x; sz = from.z; }
    else if (walk && p && Math.hypot(x - p.x, z - p.z) < 45) {
      const a = Math.atan2(x - p.x, z - p.z); sx = clamp(x + Math.sin(a) * 7, B.minX + 1, B.maxX - 1); sz = clamp(z + Math.cos(a) * 7, B.minZ + 1, B.maxZ - 1);
    }
    const arrived = Math.hypot(sx - x, sz - z) < 0.1;
    npcs.actorOn(n, sx, sz, arrived ? face : Math.atan2(x - sx, z - sz));
    n.pg = { tx: x, tz: z, face, arrived, cheerT: 0 };
  }
  function walkIn(n, dt, sp = 1.6) {
    const f = n.pg; if (!f || !npcs.isActing(n)) return false;
    if (f.arrived) return true;
    if (stepTo(n, f.tx, f.tz, sp, dt)) f.arrived = true;
    return f.arrived;
  }
  function standBy(n, dt, faceTo = null) {
    if (!walkIn(n, dt)) return;
    const f = n.pg;
    if (f.cheerT > 0) { f.cheerT -= dt; cheerUp(n); }
    else npcs.actorPlay(n, 'Idle', 0.35);
    turn(n, faceTo ? Math.atan2(faceTo.x - n.x, faceTo.z - n.z) : f.face, dt, 4);
  }
  const cheer = (n, s = 2.2) => { if (n && n.pg) n.pg.cheerT = s; };

  /* 장신구 붙이기 (행사가 끝나면 뗀다) */
  const attached = [];
  const boneOf = (n, nm) => n.root.getObjectByName(nm) || n.root.getObjectByName(nm.replace('.', ''));
  function attach(n, boneName, obj) {
    const b = boneName ? boneOf(n, boneName) : null;
    (b || n.body).add(obj); attached.push(obj); return obj;
  }
  function detachAll() { for (const o of attached) if (o.parent) o.parent.remove(o); attached.length = 0; }

  /* ── 뼈 자세 덧씌우기 (festival.js 와 같은 방식) ── */
  const AX = new V3(1, 0, 0), AY = new V3(0, 1, 0), AZ = new V3(0, 0, 1);
  const _qa = new Q(), _qb = new Q(), _qc = new Q(), _qp = new Q(), _qd = new Q(), _qi = new Q(), _qr = new Q();
  function bonesOf(n) {
    if (n.pgB) return n.pgB;
    const b = nm => boneOf(n, nm);
    return (n.pgB = {
      armL: [b('UpperArm.L'), b('LowerArm.L')], armR: [b('UpperArm.R'), b('LowerArm.R')],
      legL: [b('UpperLeg.L'), b('LowerLeg.L')], legR: [b('UpperLeg.R'), b('LowerLeg.R')],
      head: b('Head'), spine: b('Spine'),
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
    if (u.pq && b.quaternion.equals(u.pq)) b.quaternion.copy(u.bq);
    else (u.bq || (u.bq = new Q())).copy(b.quaternion);
  }
  const layerDone = b => (b.userData.pq || (b.userData.pq = new Q())).copy(b.quaternion);
  /* spec: legL/legR [허벅지(음수=앞), 벌림, 무릎], armL/armR [팔(음수=앞), 아래팔, 안쪽(음수=옆으로), 아래팔 Y], spine [앞숙임], head [끄덕] */
  const _list = [];
  function pose(n, spec) {
    if (!n || n.off) return;
    const Bn = bonesOf(n);
    _list.length = 0;
    for (const k of ['legL', 'legR', 'armL', 'armR']) if (spec[k] && Bn[k][0] && Bn[k][1]) _list.push(Bn[k][0], Bn[k][1]);
    if (spec.spine != null && Bn.spine) _list.push(Bn.spine);
    if (spec.head != null && Bn.head) _list.push(Bn.head);
    for (const b of _list) layerBase(b);
    n.root.updateMatrixWorld(true);
    if (spec.spine != null && Bn.spine) rotBone(n, Bn.spine, _qa.setFromAxisAngle(AX, spec.spine * D2R));
    if (spec.head != null && Bn.head) rotBone(n, Bn.head, _qa.setFromAxisAngle(AX, spec.head * D2R));
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
  /* 서서 환호: Cheers 클립은 앉아서 잔을 드는 동작이라, 선 사람은 Idle + 두 팔 흔들기(또는 잔 든 팔 하나)를 덧씌운다.
     npcs.standPlay 가 있으면 그걸 쓴다 (npcs.js 의 서서 하는 몸짓: cheer = 두 팔, toast = 잔 든 오른팔) */
  function cheerUp(n, oneArm = false) {
    if (npcs.standPlay) { npcs.standPlay(n, oneArm ? 'toast' : 'cheer', 0.25); return; }
    npcs.actorPlay(n, 'Idle', 0.25);
    const w = Math.sin(lastT * 9 + (n.x + n.z) * 3) * 18;
    pose(n, oneArm ? { armR: [-150, -25, 6, 0] } : { armL: [-150 + w, -25, 12, 0], armR: [-150 - w, -25, 12, 0] });
  }
  const syncRoot = (n, dy = 0) => { n.root.position.set(n.x, n.y + dy, n.z); n.root.rotation.y = n.rot; };

  /* ════ 상호작용 안내 (F) ════ */
  const CSS = `
.pg-prompt{position:fixed;left:0;top:0;z-index:42;transform:translate(-50%,-100%);display:inline-flex;align-items:center;gap:8px;
  padding:7px 12px 7px 8px;border-radius:999px;border:1px solid rgba(107,68,35,.55);background:rgba(250,240,214,.95);
  color:#3b2412;font:600 13px/1.2 Georgia,'Nanum Myeongjo',serif;box-shadow:0 6px 18px rgba(40,24,10,.25);cursor:pointer;pointer-events:auto;user-select:none}
.pg-prompt[hidden]{display:none}
.pg-prompt kbd{font:700 11px/1 ui-monospace,monospace;background:#3b2412;color:#f6e7c4;border-radius:5px;padding:4px 6px}
.pg-prompt.red kbd{background:#a8202a}.pg-prompt.blue kbd{background:#2a4aa8}
.pg-prompt .bar{display:inline-block;width:70px;height:8px;border-radius:4px;background:linear-gradient(90deg,#c8202a 50%,#2a55c8 50%);position:relative}
.pg-prompt .bar i{position:absolute;top:-3px;width:4px;height:14px;background:#3b2412;border-radius:2px;left:50%;transform:translateX(-50%)}
body.is-touch .pg-prompt kbd{display:none}
body.intro-on .pg-prompt,body[data-view="doc"] .pg-prompt,body.talking .pg-prompt{display:none}`;
  if (!document.getElementById('pg-css')) { const st = document.createElement('style'); st.id = 'pg-css'; st.textContent = CSS; document.head.appendChild(st); }
  const promptEl = document.createElement('button');
  promptEl.type = 'button'; promptEl.className = 'pg-prompt'; promptEl.hidden = true;
  promptEl.innerHTML = '<kbd>F</kbd><span class="tx"></span>';
  (document.getElementById('drive-root') || document.body).appendChild(promptEl);
  const promptTx = promptEl.querySelector('.tx');
  promptEl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); onF(false); });
  let promptKey = '';
  function showPrompt(act) {
    if (!act || !camera) { if (!promptEl.hidden) promptEl.hidden = true; return; }
    const key = act.kind + '|' + act.label + '|' + (act.cls || '');
    if (key !== promptKey) {
      promptKey = key;
      promptEl.className = 'pg-prompt' + (act.cls ? ' ' + act.cls : '');
      promptTx.innerHTML = act.label;
    }
    if (act.kind === 'tugPull') { const bi = promptEl.querySelector('.bar i'); if (bi) bi.style.left = (50 + clamp(T.s / T.WIN, -1, 1) * 50).toFixed(1) + '%'; }
    _v.set(act.x, act.y, act.z).project(camera);
    if (_v.z > 1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) { promptEl.hidden = true; return; }
    promptEl.style.left = ((_v.x + 1) / 2 * innerWidth).toFixed(1) + 'px';
    promptEl.style.top = Math.min((1 - _v.y) / 2 * innerHeight, innerHeight - 120).toFixed(1) + 'px';
    promptEl.hidden = false;
  }

  /* ════════════════════════════ ① 왕실 연회 ════════════════════════════ */
  const FS = PAGEANT_SITES.feast;
  const FEAST_HALF = 3.6, BENCH_OFF = 0.98, TABLE_H = 0.78;
  const feastG = addRoot(new THREE.Group()); feastG.visible = false;
  const seats = [];   // {x, z, rotY, side, n, player}
  const throne = { x: FS.x + FEAST_HALF + 0.85, z: FS.z };
  const feastFood = new THREE.Group();
  const candleTips = [];
  {
    placeG(feastG, FS.x, FS.z);
    const g = feastG;
    /* 식탁: 상판 + 다리 + 식탁보 + 붉은 러너 */
    g.add(box(FEAST_HALF * 2, 0.07, 1.15, M.wood, 0, TABLE_H, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.09, TABLE_H, 0.09, M.darkWood, sx * (FEAST_HALF - 0.2), TABLE_H / 2, sz * 0.45));
    g.add(box(0.07, 0.07, 0.9, M.darkWood, -FEAST_HALF + 0.2, 0.25, 0)); g.add(box(0.07, 0.07, 0.9, M.darkWood, FEAST_HALF - 0.2, 0.25, 0));
    const cloth = box(FEAST_HALF * 2 + 0.1, 0.012, 1.25, M.cloth, 0, TABLE_H + 0.04, 0); cloth.castShadow = false; g.add(cloth);
    for (const sz of [-1, 1]) { const drape = box(FEAST_HALF * 2 + 0.1, 0.28, 0.012, M.cloth, 0, TABLE_H - 0.1, sz * 0.625); drape.castShadow = false; g.add(drape); }
    const run = box(FEAST_HALF * 2 + 0.12, 0.014, 0.42, M.runner, 0, TABLE_H + 0.048, 0); run.castShadow = false; g.add(run);
    /* 긴 의자 둘 */
    for (const sz of [-1, 1]) {
      g.add(box(FEAST_HALF * 2 - 0.2, 0.06, 0.34, M.lightWood, 0, 0.42, sz * BENCH_OFF));
      for (const sx of [-1, 0, 1]) g.add(box(0.07, 0.4, 0.28, M.darkWood, sx * (FEAST_HALF - 0.45), 0.2, sz * BENCH_OFF));
    }
    /* 임금님 의자 (높은 등받이, 금테) */
    const th = new THREE.Group(); th.position.set(FEAST_HALF + 0.85, 0, 0); g.add(th);
    th.add(box(0.6, 0.08, 0.6, M.runner, 0, 0.46, 0));
    th.add(box(0.08, 1.5, 0.66, M.darkWood, 0.32, 0.75, 0));
    th.add(box(0.06, 0.08, 0.7, M.gold, 0.34, 1.52, 0));
    const orb = sph(0.07, M.gold, 8); orb.position.set(0.34, 1.62, 0); th.add(orb);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) th.add(box(0.07, 0.46, 0.07, M.darkWood, sx * 0.26, 0.23, sz * 0.26));
    for (const sz of [-1, 1]) th.add(box(0.5, 0.05, 0.06, M.gold, 0, 0.72, sz * 0.31));
    /* 음식 */
    const Y = TABLE_H + 0.06;
    g.add(feastFood);
    const roastAt = (x) => {
      const pl = cyl(0.3, 0.26, 0.03, M.gold, 16); pl.position.set(x, Y + 0.015, 0); feastFood.add(pl);
      const r = sph(0.2, M.roast, 12); r.scale.set(1.35, 0.8, 1); r.position.set(x, Y + 0.17, 0); feastFood.add(r);
      for (const s of [-1, 1]) { const b = cyl(0.025, 0.03, 0.22, M.bone, 6); b.rotation.z = s * 1.2; b.position.set(x + s * 0.3, Y + 0.2, 0); feastFood.add(b); const kn = sph(0.04, M.bone, 6); kn.position.set(x + s * 0.4, Y + 0.25, 0); feastFood.add(kn); }
      for (let i = 0; i < 5; i++) { const a = sph(0.04, i % 2 ? M.red : M.green, 6); const ang = i / 5 * Math.PI * 2; a.position.set(x + Math.cos(ang) * 0.24, Y + 0.05, Math.sin(ang) * 0.2); feastFood.add(a); }
    };
    roastAt(-1.4); roastAt(1.6);
    /* 과일 그릇 */
    for (const x of [-2.8, 0.1, 2.9]) {
      const bowl = new THREE.Mesh(keep(new THREE.SphereGeometry(0.17, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), M.lightWood); bowl.position.set(x, Y + 0.16, 0); feastFood.add(bowl);
      const fr = [[M.red, 0.06, 0, 0], [M.green, 0.055, 0.07, 0.05], [M.orangeF, 0.06, -0.07, 0.03], [M.red, 0.055, 0.02, -0.08]];
      for (const [m, r, dx, dz] of fr) { const f = sph(r, m, 8); f.position.set(x + dx, Y + 0.08, dz); feastFood.add(f); }
      for (let i = 0; i < 7; i++) { const gp = sph(0.028, M.grape, 6); gp.position.set(x + 0.05 + (i % 3) * 0.04, Y + 0.14 - Math.floor(i / 3) * 0.03, -0.02 + (i % 2) * 0.03); feastFood.add(gp); }
    }
    /* 빵 */
    for (const [x, z] of [[-2.1, 0.2], [-0.6, -0.22], [0.8, 0.2], [2.3, -0.2], [-3.2, -0.2], [3.3, 0.18]]) {
      const b = sph(0.1, M.bread, 9); b.scale.set(1.6, 0.75, 1); b.position.set(x, Y + 0.07, z); b.rotation.y = rr(0, 3); feastFood.add(b);
    }
    /* 촛대 */
    for (const x of [-2.4, 0.9, 2.5]) {
      const st = cyl(0.03, 0.06, 0.12, M.gold, 8); st.position.set(x, Y + 0.06, 0); feastFood.add(st);
      const c = cyl(0.025, 0.025, 0.22, M.candle, 8); c.position.set(x, Y + 0.23, 0); feastFood.add(c);
      candleTips.push(new V3(x, Y + 0.37, 0));
    }
    /* 자리마다 접시·금잔 (InstancedMesh 2개) */
    const plateI = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.13, 0.11, 0.02, 14)), M.plate, 12);
    const cupI = new THREE.InstancedMesh(keep(new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.04, 0), new THREE.Vector2(0.012, 0.02), new THREE.Vector2(0.012, 0.08), new THREE.Vector2(0.045, 0.11), new THREE.Vector2(0.05, 0.17), new THREE.Vector2(0.046, 0.17)], 10)), M.gold, 12);
    let pi = 0;
    for (const sz of [-1, 1]) for (let i = 0; i < 5; i++) {
      const lx = -FEAST_HALF + 0.75 + i * 1.5;
      const seat = { lx, lz: sz * BENCH_OFF, x: 0, z: 0, rotY: sz > 0 ? Math.PI : 0, side: sz, n: null, player: false, idx: seats.length };
      seats.push(seat);
      _m4.makeTranslation(lx, Y + 0.01, sz * 0.36); plateI.setMatrixAt(pi, _m4);
      _m4.makeTranslation(lx + 0.24, Y, sz * 0.4); cupI.setMatrixAt(pi, _m4); pi++;
    }
    _m4.makeTranslation(FEAST_HALF - 0.25, Y + 0.01, 0); plateI.setMatrixAt(pi, _m4);
    _m4.makeTranslation(FEAST_HALF - 0.3, Y, 0.25); cupI.setMatrixAt(pi, _m4); pi++;
    plateI.count = cupI.count = pi;
    plateI.castShadow = cupI.castShadow = true;
    feastFood.add(plateI, cupI);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.updateMatrixWorld(true);
    for (const s of seats) { _v.set(s.lx, 0, s.lz); g.localToWorld(_v); s.x = _v.x; s.z = _v.z; }
    for (const c of candleTips) g.localToWorld(c);
  }
  const FE = { phase: '', t: 0, diners: [], king: null, toasted: false, playerSeat: null, joined: false, chatT: 0, obj: {} };
  const FEAST_LINES = ['이 통구이 맛 좀 보게!', '임금님 만세!', '포도주가 달구나~', '빵 하나 더!', '올해는 풍년이야', '이런 잔치는 처음이야!', '건배!', '냠냠…'];
  const KING_FEAST = ['많이들 드시게!', '오늘은 짐이 쏘노라!', '백성이 배부르면 짐도 배부르다!', '맛있게들 먹거라!'];
  const DINER_KEYS = ['noble', 'baker', 'blacksmith', 'maid', 'traveler', 'herbalist', 'bard'];
  const feast = {
    weight: 4,
    eligible: () => getNight() < 0.7 && !isKingBusy() && distP(FS.x, FS.z) < SITE_NEAR,
    start() {
      feastG.visible = true;
      FE.phase = 'gather'; FE.t = 10; FE.toasted = false; FE.joined = false; FE.playerSeat = null; FE.chatT = 4;
      for (const s of seats) { s.n = null; s.player = false; }
      /* 손님 7명: 앞쪽 자리부터 섞어서 */
      const order = [0, 5, 1, 6, 3, 8, 2, 7, 4, 9].slice(0, DINER_KEYS.length);
      FE.diners = DINER_KEYS.map((k, i) => {
        const n = actor(k), s = seats[order[i]];
        s.n = n;
        const ox = s.x, oz = s.z + s.side * 0.45;   // 의자 바깥에 섰다가 앉는다
        place(n, ox, oz, s.rotY);
        n.propShow = true;
        return { n, s, sat: false, sitT: 0, drinkT: rr(2, 6) };
      });
      FE.king = actor('king');
      place(FE.king, throne.x + 0.6, throne.z, -Math.PI / 2);
      FE.king.propShow = true;
      toast(`🍗 왕실 연회! 임금님 최상호께서 ${FS.name}에 잔칫상을 차리셨어요. 빈자리에 앉아 보세요 (${dirText(FS.x, FS.z)})`);
      SND.fanfare(FS.x, FS.z);
      return true;
    },
    update(dt, t) {
      FE.t -= dt;
      const P = FE;
      if (P.phase === 'gather') { if (P.t <= 0) { P.phase = 'feast'; P.t = 18; say(P.king, '자, 잔치를 시작하노라!', 2.5, '#7a1a10'); } }
      else if (P.phase === 'feast') {
        if (P.t <= 0) { P.phase = 'toast'; P.t = 7; say(P.king, '모두 잔을 들라!', 2.2, '#7a1a10'); }
      } else if (P.phase === 'toast') {
        if (!P.toasted && P.t < 4.8) {
          P.toasted = true; say(P.king, '상호왕국을 위하여!', 3, '#7a1a10');
          SND.cheer(FS.x, FS.z, 1.3); kidsCheer(FS.x, FS.z);
          setTimeout(() => { if (!disposed && FE.phase === 'toast') for (const d of FE.diners) if (Math.random() < 0.5) say(d.n, pick(['상호왕국을 위하여!', '임금님 만세!', '건배!']), 1.8); }, 700);
          for (let k = 0; k < 14; k++) fx(2, FS.x + rr(-3, 3), groundY(FS.x, FS.z) + 1.6, FS.z + rr(-1, 1), rr(-0.5, 0.5), rr(1, 2.2), rr(-0.5, 0.5), rr(1.2, 2), 0.18, 0.05, 0.5);
        }
        if (P.t <= 0) { P.phase = 'feast2'; P.t = 16; }
      } else if (P.phase === 'feast2') {
        if (P.t <= 0) { P.phase = 'outro'; P.t = 6; say(P.king, '즐거운 잔치였노라!', 2.5, '#7a1a10'); toast('🍗 왕실 연회가 끝났어요. 다들 배를 두드리며 일어납니다'); }
      } else if (P.phase === 'outro') { if (P.t <= 0) return false; }

      const standing = P.phase === 'toast' || P.phase === 'outro' || P.phase === 'gather';
      /* 손님 */
      for (const d of P.diners) {
        const n = d.n, s = d.s;
        if (!npcs.isActing(n)) continue;
        if (!walkIn(n, dt)) continue;
        const sx = s.x, sz = s.z, outZ = s.z + s.side * 0.45;
        if (!standing) {
          /* 앉기: 의자로 미끄러져 들어가 Sit */
          n.x += (sx - n.x) * Math.min(1, dt * 5); n.z += (sz - n.z) * Math.min(1, dt * 5);
          turn(n, s.rotY, dt, 6);
          d.drinkT -= dt;
          if (d.drinkT <= 0) { d.drinkT = rr(3, 7); d.drink = !d.drink; }
          if (npcs.actorSeated) npcs.actorSeated(n, true);   // 앉은 채 Drink 클립 (서 있는 몸짓으로 바뀌지 않게)
          npcs.actorPlay(n, d.drink ? 'Drink' : 'Sit', 0.4);
        } else {
          n.x += (sx - n.x) * Math.min(1, dt * 4); n.z += (outZ - n.z) * Math.min(1, dt * 4);
          turn(n, P.phase === 'toast' ? Math.atan2(throne.x - n.x, throne.z - n.z) : s.rotY, dt, 5);
          if (P.phase === 'toast' && P.toasted) cheerUp(n, true); else npcs.actorPlay(n, 'Idle', 0.3);
        }
      }
      /* 임금님: 상석에 앉았다가 건배 때 일어선다 */
      const k = P.king;
      if (k && npcs.isActing(k) && walkIn(k, dt)) {
        if (P.phase === 'feast' || P.phase === 'feast2') {
          k.x += (throne.x - k.x) * Math.min(1, dt * 5); k.z += (throne.z - k.z) * Math.min(1, dt * 5);
          turn(k, -Math.PI / 2, dt, 6);
          if (npcs.actorSeated) npcs.actorSeated(k, true);
          npcs.actorPlay(k, (t % 9) < 3 ? 'Drink' : 'Sit', 0.4);
        } else {
          k.x += (throne.x - 0.55 - k.x) * Math.min(1, dt * 4); k.z += (throne.z - k.z) * Math.min(1, dt * 4);
          turn(k, -Math.PI / 2, dt, 5);
          if (P.phase === 'toast' && P.t < 5.5) cheerUp(k, true); else npcs.actorPlay(k, 'Idle', 0.3);
        }
      }
      /* 수다 */
      if (P.phase === 'feast' || P.phase === 'feast2') {
        P.chatT -= dt;
        if (P.chatT <= 0) {
          P.chatT = rr(2.5, 4.5);
          if (Math.random() < 0.25 && k) say(k, pick(KING_FEAST), 2.2, '#7a1a10');
          else { const d = pick(P.diners); if (d) say(d.n, pick(FEAST_LINES), 1.8); }
        }
        crowdTick(dt, P, FS.x, FS.z, 16, ['맛있겠다…', '임금님 만세!', '나도 끼고 싶다!'], 4, 3);
      }
      /* 촛불 */
      if (distP(FS.x, FS.z) < 50) {
        for (const c of candleTips) if (Math.random() < dt * 8) fx(3, c.x + rr(-0.01, 0.01), c.y, c.z + rr(-0.01, 0.01), 0, rr(0.12, 0.25), 0, rr(0.25, 0.4), 0.09, 0.03, 0);
        if (getNight() > 0.35) wantLight(FS.x, groundY(FS.x, FS.z) + 1.6, FS.z, 7 * getNight(), 0xffb060, 10, 2);
      }
      /* 플레이어 자리: 진짜로 앉혔으면(sitPlayer) 일어나는 순간(getTavern().seated 가 false), 아니면 2.5 m 넘게 떠나면 비운다 */
      if (P.playerSeat) {
        const s = P.playerSeat;
        let tv = null; try { tv = getTavern && getTavern(); } catch { /* */ }
        const up = sitPlayer && tv && 'seated' in tv ? !tv.seated : distP(s.x, s.z) > 2.5;
        if (up) { s.player = false; P.playerSeat = null; }
      }
      return true;
    },
    stop() {
      for (const d of FE.diners) release(d.n);
      if (FE.king) release(FE.king);
      if (FE.playerSeat && standPlayer) { try { standPlayer(); } catch { /* */ } }
      FE.diners = []; FE.king = null; FE.phase = ''; FE.playerSeat = null;
      for (const s of seats) { s.n = null; s.player = false; }
      feastG.visible = false;
    },
    nearSeat() {
      if (cur !== feast || FE.phase === 'outro' || FE.playerSeat) return null;
      const p = playerPos(); if (!p) return null;
      let best = null, bd = 1.5;
      for (const s of seats) {
        if (s.n || s.player) continue;
        const d = Math.hypot(s.x + 0 - p.x, s.z + s.side * 0.4 - p.z);
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    },
    sit(s) {
      s.player = true; FE.playerSeat = s;
      if (sitPlayer) {
        let ok = true;
        try { ok = sitPlayer({ x: s.x, y: groundY(s.x, s.z), z: s.z, rotY: s.rotY }) !== false; } catch (e) { console.warn('[pageant] sitPlayer', e); }
        if (!ok) { s.player = false; FE.playerSeat = null; return false; }   // 앉지 못했다 (운전 중 등)
      }
      if (!FE.joined) {
        FE.joined = true;
        const got = addCoins(5);
        toast(`👑 임금님의 연회에 앉았다! 임금님: "왕자여, 어서 오너라!"${got ? ' 은화 5닢을 하사받았다' : ''}`);
        SND.coin(s.x, s.z);
      } else toast('🍗 다시 연회 자리에 앉았다. 통구이가 맛있다!');
      if (FE.king) say(FE.king, '왕자여, 어서 오너라!', 2.4, '#7a1a10');
      const nb = FE.diners.find(d => Math.abs(d.s.lx - s.lx) < 1.6 && d.s.side === s.side) || FE.diners[0];
      if (nb) setTimeout(() => { if (!disposed && nb.n.pg) say(nb.n, pick(['왕자님, 한 잔 받으시오!', '통구이 드셔 보세요!', '반갑습니다, 왕자님!']), 2); }, 900);
      return true;
    },
  };

  /* ════════════════════════════ ② 결혼식 행렬 ════════════════════════════ */
  const WS = PAGEANT_SITES.wedding;
  const archG = addRoot(new THREE.Group()); archG.visible = false;
  {
    /* 꽃 아치: 반원 + 두 기둥 + 꽃 */
    const W = 1.4, H = 2.1;
    for (const s of [-1, 1]) { const p = cyl(0.06, 0.07, H, M.lightWood, 8); p.position.set(s * W, H / 2, 0); archG.add(p); }
    const tor = new THREE.Mesh(keep(new THREE.TorusGeometry(W, 0.06, 6, 20, Math.PI)), M.lightWood); tor.position.y = H; archG.add(tor);
    const fm = [M.flowerP, M.flowerW, M.flowerY, M.flowerP, M.leaf];
    const fGeo = keep(new THREE.IcosahedronGeometry(0.09, 0));
    for (let i = 0; i <= 22; i++) {
      const a = i / 22 * Math.PI;
      const f = new THREE.Mesh(fGeo, fm[i % fm.length]); f.position.set(Math.cos(a) * W, H + Math.sin(a) * W, rr(-0.05, 0.05)); f.scale.setScalar(rr(0.8, 1.4)); archG.add(f);
    }
    for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(fGeo, fm[(i + 2) % fm.length]); f.position.set(s * W + rr(-0.06, 0.06), 0.3 + i * 0.27, rr(-0.06, 0.06)); archG.add(f); }
    archG.traverse(o => { if (o.isMesh) o.castShadow = true; });
    placeG(archG, WS.x, WS.z, Math.PI / 2);   // 아치는 동쪽(길)을 본다
  }
  function makeVeil() {
    const g = new THREE.Group();
    const v = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.12, 0.32, 0.9, 14, 1, true, Math.PI * 0.5, Math.PI)), M.veil);
    v.position.set(0, -0.27, -0.05); g.add(v);
    const crown = new THREE.Mesh(keep(new THREE.TorusGeometry(0.11, 0.02, 6, 16)), M.leaf); crown.rotation.x = Math.PI / 2; crown.position.y = 0.16; g.add(crown);
    const fGeo = keep(new THREE.IcosahedronGeometry(0.03, 0));
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const f = new THREE.Mesh(fGeo, [M.flowerP, M.flowerW, M.flowerY][i % 3]); f.position.set(Math.cos(a) * 0.11, 0.17, Math.sin(a) * 0.11); g.add(f); }
    return g;
  }
  function makeBouquet() {
    const g = new THREE.Group();
    const st = cyl(0.015, 0.03, 0.16, M.leaf, 6); st.position.y = -0.06; g.add(st);
    const fGeo = keep(new THREE.IcosahedronGeometry(0.035, 0));
    for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(fGeo, [M.flowerW, M.flowerP, M.flowerW][i % 3]); f.position.set(rr(-0.05, 0.05), 0.04 + rr(0, 0.05), rr(-0.05, 0.05)); g.add(f); }
    return g;
  }
  function makeBoutonniere() {
    const g = new THREE.Group();
    const f = sph(0.035, M.red, 8); g.add(f);
    const l = sph(0.025, M.leaf, 6); l.scale.set(1.5, 0.6, 0.6); l.position.set(-0.03, -0.03, 0); g.add(l);
    return g;
  }
  const WE = { phase: '', t: 0, c: { x: 0, z: 0 }, face: 0, route: [], wp: 0, bride: null, groom: null, guests: [], priest: null, bellT: 0, cheerT: 0, kissT: 0, obj: {} };
  const WED_CROWD = ['축하해요!', '잘 어울려요!', '행복하세요!', '신부가 정말 예뻐요!', '와아~!', '오래오래 행복하게!'];
  function weddingRoute() {
    const pts = [];
    for (let z = WS.z0; z <= WS.zTurn; z += 3) pts.push({ x: pathX(z) - 0.6, z });
    const ex = pathX(WS.zTurn) - 0.6;
    for (let x = ex - 3; x > WS.x + 1.8; x -= 3) pts.push({ x, z: WS.zTurn - (ex - x) / (ex - WS.x) * (WS.zTurn - WS.z) });
    pts.push({ x: WS.x + 1.6, z: WS.z });
    return pts;
  }
  const wedding = {
    weight: 3,
    eligible: () => getNight() < 0.4 && distP(WS.x, WS.z + -20) < SITE_NEAR,
    start() {
      WE.route = weddingRoute(); WE.wp = 1; WE.c = { x: WE.route[0].x, z: WE.route[0].z }; WE.phase = 'walk'; WE.t = 0; WE.bellT = 0; WE.cheerT = 0; WE.kissT = 0; WE.ringN = 0;
      archG.visible = true;
      const r0 = WE.route[0], r1 = WE.route[1];
      const face = Math.atan2(r1.x - r0.x, r1.z - r0.z); WE.face = face;
      WE.bride = actor('noble'); WE.groom = actor('traveler');
      on(WE.bride, r0.x + Math.cos(face) * 0.38, r0.z - Math.sin(face) * 0.38, face);
      on(WE.groom, r0.x - Math.cos(face) * 0.38, r0.z + Math.sin(face) * 0.38, face);
      const veil = makeVeil(); veil.position.set(0, 0.03, 0); attach(WE.bride, 'Head', veil);
      const bq = makeBouquet(); bq.position.set(0, 0.06, 0.04); attach(WE.bride, 'Hand.R', bq);
      const bt = makeBoutonniere(); bt.position.set(0.08, 0.1, 0.13); attach(WE.groom, 'Chest', bt);
      WE.guests = ['maid', 'baker', 'bard'].map((k, i) => {
        const n = actor(k);
        on(n, r0.x + (i - 1) * 0.8, r0.z - 1.6 - (i === 1 ? 0.6 : 0), face);
        return { n, i };
      });
      WE.priest = actor('monk');
      place(WE.priest, WS.x - 0.2, WS.z, Math.PI / 2);
      toast(`💒 결혼식 행렬! 신랑 신부가 큰길을 따라 ${WS.name}로 걸어가요. 종소리가 울립니다 (${dirText(r0.x, r0.z)})`);
      SND.bell(r0.x, r0.z, 660); SND.bell(r0.x, r0.z, 523, 0.6);
      return true;
    },
    update(dt, t) {
      const W = WE, b = W.bride, g = W.groom;
      if (!b || !g) return false;
      W.t += dt;
      const cx = W.c.x, cz = W.c.z;
      if (W.phase === 'walk') {
        /* 두 사람의 가운데(W.c)가 길을 따라 1.05 m/s 로 간다. 신부는 오른쪽, 신랑은 왼쪽 */
        const tgt = W.route[W.wp];
        const dx = tgt.x - W.c.x, dz = tgt.z - W.c.z, d = Math.hypot(dx, dz);
        if (d < 0.3) { W.wp++; if (W.wp >= W.route.length) { W.phase = 'vows'; W.t = 0; say(W.priest, '오늘 이 두 사람이 부부가 되려 하오', 3); } }
        const sp = 1.05, m = Math.min(d, sp * dt);
        if (d > 1e-4) { W.c.x += dx / d * m; W.c.z += dz / d * m; }
        W.face += wrap(Math.atan2(dx, dz) - W.face) * Math.min(1, dt * 3);
        const face = W.face, rx = Math.cos(face), rz = -Math.sin(face);
        for (const [n, side] of [[b, 1], [g, -1]]) {
          if (!npcs.isActing(n)) continue;
          const tx = W.c.x + rx * 0.38 * side, tz = W.c.z + rz * 0.38 * side;
          const dd = Math.hypot(tx - n.x, tz - n.z);
          if (dd > 0.6) stepTo(n, tx, tz, 1.6, dt);   // 맞고 일어난 뒤 따라잡기
          else { n.x = tx; n.z = tz; turn(n, face, dt, 5); npcs.actorPlay(n, 'Walk', 0.3, 0.8); }
          syncRoot(n);
          if (n === b) pose(n, { armR: [-38, -62, 8, 0] });   // 부케를 앞에 든다
        }
        for (const q of W.guests) {
          const n = q.n; if (!npcs.isActing(n)) continue;
          const back = 1.7 + (q.i === 1 ? 0.7 : 0), lat = (q.i - 1) * 0.9;
          const tx = cx - Math.sin(face) * back + rx * lat, tz = cz - Math.cos(face) * back + rz * lat;
          const dd = Math.hypot(tx - n.x, tz - n.z);
          if (dd > 0.25) stepTo(n, tx, tz, clamp(dd * 1.2, 0.6, 1.6), dt);
          else { turn(n, face, dt); if (Math.sin(lastT * 0.9 + q.i * 2) > 0.3) cheerUp(n); else npcs.actorPlay(n, 'Idle', 0.3); }
          if (Math.random() < dt * 5) petals(n.x, n.y + 1.5, n.z, 1, 0.8);
        }
        if (Math.random() < dt * 6) petals(cx + rr(-1, 1), groundY(cx, cz) + 2.4, cz + rr(-1, 1), 1, 0.5);
        W.bellT -= dt;
        if (W.bellT <= 0) { W.bellT = 6; SND.bell(cx, cz, 660); SND.bell(cx, cz, 554, 0.55); SND.bell(cx, cz, 494, 1.1); }
        W.cheerT -= dt;
        if (W.cheerT <= 0) { W.cheerT = 7; kidsCheer(cx, cz); if (distP(cx, cz) < 40) SND.clap(cx, cz); }
        crowdTick(dt, W, cx, cz, 14, WED_CROWD, 8, 1.2);
        if (Math.random() < dt * 0.35) say(pick(W.guests).n, pick(['신랑 신부 입장!', '축하합니다!', '♪ 딩동댕~']), 1.6);
      } else if (W.phase === 'vows' || W.phase === 'kiss' || W.phase === 'outro') {
        /* 아치 아래에서 마주 본다 (아치는 동쪽을 본다 → 신부는 남쪽, 신랑은 북쪽) */
        const ax = WS.x + 0.9, near = W.phase === 'kiss' ? 0.27 : 0.42;
        const pos = [[b, ax, WS.z + near, Math.PI], [g, ax, WS.z - near, 0]];
        for (const [n, x, z, f] of pos) {
          if (!npcs.isActing(n)) continue;
          if (Math.hypot(x - n.x, z - n.z) > 0.05) stepTo(n, x, z, 0.8, dt, f); else { turn(n, f, dt, 4); npcs.actorPlay(n, 'Idle', 0.3); }
          syncRoot(n);
          if (W.phase === 'kiss' && W.kissT < 2.6) pose(n, { spine: 10, head: 8, armL: [-40, -30, -10, 0], armR: [-40, -30, -10, 0] });
        }
        if (W.priest && npcs.isActing(W.priest)) standBy(W.priest, dt, { x: ax, z: WS.z });
        for (const q of W.guests) {
          const n = q.n; if (!npcs.isActing(n)) continue;
          const tx = ax + 2.2 + (q.i % 2) * 0.6, tz = WS.z + (q.i - 1) * 1.1;
          if (Math.hypot(tx - n.x, tz - n.z) > 0.1) stepTo(n, tx, tz, 1.2, dt);
          else { turn(n, Math.atan2(ax - n.x, WS.z - n.z), dt, 4); if (W.phase !== 'vows') cheerUp(n); else npcs.actorPlay(n, 'Idle', 0.3); }
        }
        if (W.phase === 'vows') {
          if (W.t > 3.5 && W.ringN === 0) { W.ringN = 1; say(W.priest, '두 사람을 부부로 선포하노라!', 3); SND.bell(ax, WS.z, 784); }
          if (W.t > 6.5) { W.phase = 'kiss'; W.kissT = 0; }
        } else if (W.phase === 'kiss') {
          W.kissT += dt;
          if (W.kissT > 0.8 && !W.kissed) {
            W.kissed = true;
            SND.kiss(ax, WS.z);
            hearts(ax, groundY(ax, WS.z) + 1.85, WS.z, 22);
            setTimeout(() => { if (!disposed && cur === wedding) { SND.cheer(ax, WS.z, 1.2); SND.bell(ax, WS.z, 660); SND.bell(ax, WS.z, 880, 0.4); SND.bell(ax, WS.z, 784, 0.8); } }, 300);
            petals(ax, groundY(ax, WS.z) + 2.8, WS.z, 40, 2.2, [...PETALS, ...CONFETTI]);
            kidsCheer(ax, WS.z);
            toast('💕 신랑 신부가 입을 맞췄어요! 모두 환호합니다. 오래오래 행복하세요!');
            for (const q of W.guests) say(q.n, pick(['와아~!', '축하해요!', '만세!']), 1.6);
          }
          if (W.kissed && Math.random() < dt * 3) hearts(ax, groundY(ax, WS.z) + 1.9, WS.z, 1);
          if (W.kissT > 5) { W.phase = 'outro'; W.t = 0; }
        } else {
          crowdTick(dt, W, ax, WS.z, 18, WED_CROWD, 6, 1.6);
          if (W.t > 8) return false;
        }
      }
      return true;
    },
    stop() {
      detachAll();
      for (const n of [WE.bride, WE.groom, WE.priest, ...WE.guests.map(q => q.n)]) release(n);
      WE.bride = WE.groom = WE.priest = null; WE.guests = []; WE.phase = ''; WE.kissed = false;
      archG.visible = false;
    },
  };

  /* ════════════════════════════ ③ 하늘 등불 축제 (밤) ════════════════════════════ */
  const LS = PAGEANT_SITES.lanterns;
  const LN_MAX = 64;
  const lnGeo = keep((() => {
    const pts = [new THREE.Vector2(0.13, 0), new THREE.Vector2(0.17, 0.12), new THREE.Vector2(0.19, 0.25), new THREE.Vector2(0.17, 0.38), new THREE.Vector2(0.13, 0.46), new THREE.Vector2(0.001, 0.47)];
    return new THREE.LatheGeometry(pts, 10);
  })());
  const lnMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: true }));
  const lnMesh = addRoot(new THREE.InstancedMesh(lnGeo, lnMat, LN_MAX));
  lnMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); lnMesh.frustumCulled = false; lnMesh.visible = false; lnMesh.castShadow = false;
  /* 빛무리 (Points, 덧셈) */
  const haloPos = new Float32Array(LN_MAX * 3), haloCol = new Float32Array(LN_MAX * 4), haloSize = new Float32Array(LN_MAX), haloShape = new Float32Array(LN_MAX);
  const haloGeo = keep(new THREE.BufferGeometry());
  const haloPosA = new THREE.BufferAttribute(haloPos, 3).setUsage(THREE.DynamicDrawUsage), haloColA = new THREE.BufferAttribute(haloCol, 4).setUsage(THREE.DynamicDrawUsage), haloSizeA = new THREE.BufferAttribute(haloSize, 1).setUsage(THREE.DynamicDrawUsage);
  haloGeo.setAttribute('position', haloPosA); haloGeo.setAttribute('col', haloColA); haloGeo.setAttribute('size', haloSizeA); haloGeo.setAttribute('shape', new THREE.BufferAttribute(haloShape, 1));
  const haloPts = addRoot(new THREE.Points(haloGeo, keep(new THREE.ShaderMaterial({ uniforms: { uScale: fxScale }, vertexShader: ptVS, fragmentShader: ptFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))));
  haloPts.frustumCulled = false; haloPts.visible = false; haloPts.renderOrder = 5;
  const lns = [];
  for (let i = 0; i < LN_MAX; i++) { lns.push({ on: false, held: null, p: new V3(), v: new V3(), age: 0, life: 50, ph: rr(0, 6), sc: 1, hue: 0 }); lnMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); lnMesh.setColorAt(i, _col.setRGB(1, 1, 1)); }
  let lnAlive = 0;
  function lantern(x, y, z, held = null, vy = rr(0.55, 0.95)) {
    for (const L of lns) {
      if (L.on) continue;
      L.on = true; L.held = held; L.p.set(x, y, z); L.v.set(rr(-0.15, 0.15), held ? 0 : vy, rr(-0.15, 0.15)); L.age = 0; L.life = rr(40, 55); L.ph = rr(0, 6); L.sc = rr(0.9, 1.15); L.hue = rr(-0.08, 0.08);
      lnAlive++;
      return L;
    }
    return null;
  }
  const WIND = new V3(0.35, 0, -0.25);
  function lnUpdate(dt, t) {
    if (!lnAlive) { lnMesh.visible = false; haloPts.visible = false; return; }
    lnMesh.visible = true; haloPts.visible = true;
    let n = 0;
    for (let i = 0; i < LN_MAX; i++) {
      const L = lns[i];
      if (!L.on) { haloCol[i * 4 + 3] = 0; haloSize[i] = 0; haloPos[i * 3 + 1] = -9999; continue; }
      L.age += dt;
      if (L.held) {
        const h = L.held;
        if (h.off) { L.held = null; L.v.set(0, 0.6, 0); }
        else L.p.set(h.x + Math.sin(h.rot) * 0.42, h.y + 1.25 + Math.sin(t * 2 + L.ph) * 0.03, h.z + Math.cos(h.rot) * 0.42);
      } else {
        L.v.y = Math.min(1.6, L.v.y + dt * 0.04);
        const wk = Math.min(1, (L.p.y - 2) / 12);
        L.p.x += (L.v.x + WIND.x * wk + Math.sin(t * 0.5 + L.ph) * 0.12) * dt;
        L.p.y += L.v.y * dt;
        L.p.z += (L.v.z + WIND.z * wk + Math.cos(t * 0.4 + L.ph) * 0.12) * dt;
      }
      const fade = L.held ? Math.min(1, L.age / 1.2) : clamp((L.life - L.age) / 6, 0, 1);
      if (!L.held && (L.age > L.life || L.p.y > 95)) { L.on = false; lnAlive--; lnMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); haloCol[i * 4 + 3] = 0; continue; }
      const fl = 0.85 + 0.15 * Math.sin(t * 9 + L.ph * 3) + 0.06 * Math.sin(t * 23 + L.ph);
      const k = fade * fl;
      _q.setFromAxisAngle(AZ, Math.sin(t * 0.8 + L.ph) * 0.08);
      lnMesh.setMatrixAt(i, _m4.compose(L.p, _q, _s.setScalar(L.sc)));
      lnMesh.setColorAt(i, _col.setRGB((2.6 + L.hue) * k + 0.05, (1.25 + L.hue) * k + 0.03, 0.42 * k + 0.02));
      haloPos[i * 3] = L.p.x; haloPos[i * 3 + 1] = L.p.y + 0.24 * L.sc; haloPos[i * 3 + 2] = L.p.z;
      haloCol[i * 4] = 2.2; haloCol[i * 4 + 1] = 1.1; haloCol[i * 4 + 2] = 0.35; haloCol[i * 4 + 3] = 0.55 * k;
      haloSize[i] = 1.25 * L.sc;
      n++;
    }
    lnMesh.instanceMatrix.needsUpdate = true; if (lnMesh.instanceColor) lnMesh.instanceColor.needsUpdate = true;
    haloPosA.needsUpdate = true; haloColA.needsUpdate = true; haloSizeA.needsUpdate = true;
    return n;
  }
  const LE = { phase: '', t: 0, folk: [], spawnLeft: 0, spawnT: 0, playerUsed: false, chimeT: 0, ci: 0, obj: {} };
  const LANTERN_SPOTS = (() => {
    const bx = LS.x, out = [];
    for (const dz of [-4.2, -1.4, 1.4, 4.2]) out.push({ x: bx + (dz < 0 ? -1.1 : 1.1) * (Math.abs(dz) > 2 ? 1 : -1), z: LS.z + dz, face: dz < 0 ? Math.PI / 2 : -Math.PI / 2 });
    for (const dx of [-7, -4.2, 6.5, 9.2]) out.push({ x: bx + dx, z: LS.z + 7.6 + Math.abs(dx) * 0.05, face: Math.PI });
    return out;
  })();
  const WISHES = ['임금님 만수무강!', '올해도 풍년!', '맥주가 늘 시원하길', '포트폴리오 대박!', '좋은 회사에 합격!', '모두 건강하길', '상호왕국 영원히!', '낚시 대어!'];
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const lanternsEv = {
    weight: 5,
    eligible: () => getNight() > 0.55 && distP(LS.x, LS.z) < SITE_NEAR,
    start() {
      LE.phase = 'gather'; LE.t = 9; LE.spawnLeft = 0; LE.playerUsed = false; LE.chimeT = 0; LE.ci = 0; LE.count = 0;
      const keys = ['maid', 'baker', 'herbalist', 'monk', 'noble', 'bard', 'traveler', 'innkeeper'];
      LE.folk = LANTERN_SPOTS.map((s, i) => { const n = actor(keys[i]); place(n, s.x, s.z, s.face); return { n, s, L: null }; });
      toast(`🏮 하늘 등불 축제! 마을 사람들이 ${LS.name}에 모여 소원 등불을 날려요 (${dirText(LS.x, LS.z)})`);
      return true;
    },
    update(dt, t) {
      LE.t -= dt;
      const gy = groundY(LS.x, LS.z);
      if (LE.phase === 'gather') {
        for (const f of LE.folk) if (!f.L && f.n.pg && f.n.pg.arrived) { f.L = lantern(f.n.x, f.n.y + 1.2, f.n.z, f.n); }
        if (LE.t <= 0) { LE.phase = 'count'; LE.t = 3.6; say(LE.folk[1].n, '하나…', 1); }
      } else if (LE.phase === 'count') {
        if (LE.t < 2.4 && LE.ci === 0) { LE.ci = 1; say(LE.folk[2].n, '둘…', 1); }
        if (LE.t < 1.2 && LE.ci === 1) { LE.ci = 2; say(LE.folk[1].n, '셋!', 1.2); }
        if (LE.t <= 0) {
          LE.phase = 'fly'; LE.t = 40; LE.spawnLeft = 30 + Math.floor(Math.random() * 22); LE.spawnT = 0;
          for (const f of LE.folk) { if (f.L) { f.L.held = null; f.L.v.set(rr(-0.1, 0.1), rr(0.5, 0.7), rr(-0.1, 0.1)); f.L = null; } cheer(f.n, 3); }
          SND.cheer(LS.x, LS.z, 1); kidsCheer(LS.x, LS.z);
          toast('🏮 "와아~!" 등불이 하나둘 밤하늘로 떠오릅니다. 다리 근처에서 F 로 소원 등불을 날려 보세요');
        }
      } else if (LE.phase === 'fly') {
        LE.spawnT -= dt;
        if (LE.spawnLeft > 0 && LE.spawnT <= 0) {
          LE.spawnT = rr(0.2, 0.55); LE.spawnLeft--;
          /* 다리 위·양쪽 개울가 어딘가에서 */
          const side = Math.random();
          let x, z;
          if (side < 0.35) { x = LS.x + rr(-1.6, 1.6); z = LS.z + rr(-6, 6); }
          else { x = LS.x + rr(-14, 14); z = LS.z + (Math.random() < 0.5 ? rr(5.5, 9) : rr(-9, -6)); }
          lantern(x, groundY(x, z) + rr(1.2, 1.6), z, null, rr(0.5, 0.9));
        }
        LE.chimeT -= dt;
        if (LE.chimeT <= 0) { LE.chimeT = rr(0.6, 1.4); SND.chime(LS.x, LS.z, pick(PENTA)); }
        if (Math.random() < dt * 0.4) { const f = pick(LE.folk); say(f.n, pick(WISHES), 2); }
        if (Math.random() < dt * 0.12) kidsCheer(LS.x, LS.z);
        crowdTick(dt, LE, LS.x, LS.z, 28, ['예쁘다…', '소원 빌어야지!', '와아~', '임금님 만세!'], 6, 2);
        if (LE.t <= 0) { LE.phase = 'outro'; LE.t = 12; toast('🏮 등불이 별처럼 멀어져 갑니다… 소원이 이루어지길!'); }
      } else if (LE.phase === 'outro') {
        if (LE.t <= 0) return false;
      }
      for (const f of LE.folk) {
        const n = f.n; if (!npcs.isActing(n)) continue;
        if (LE.phase === 'gather' || LE.phase === 'count') {
          if (!walkIn(n, dt)) continue;
          turn(n, f.s.face, dt, 4); npcs.actorPlay(n, 'Idle', 0.3);
          if (f.L) { syncRoot(n); pose(n, { armL: [-55, -40, 10, 0], armR: [-55, -40, 10, 0] }); }
        } else standBy(n, dt);
        if (LE.phase === 'fly' && n.pg && n.pg.cheerT <= 0 && Math.random() < dt * 0.3) cheer(n, 2);
      }
      if (LE.phase === 'gather' || LE.phase === 'count') wantLight(LS.x, gy + 2, LS.z, 9, 0xffa040, 14, 2);
      return true;
    },
    stop() {
      for (const f of LE.folk) { if (f.L) { f.L.held = null; f.L.v.set(0, 0.6, 0); } release(f.n); }
      LE.folk = []; LE.phase = '';
    },
    nearSpot() {
      if (cur !== lanternsEv || (LE.phase !== 'fly' && LE.phase !== 'count') || LE.playerUsed) return false;
      const p = playerPos(); if (!p) return false;
      return Math.abs(p.z - LS.z) < 11 && Math.abs(p.x - LS.x) < 16;
    },
    release() {
      const p = playerPos(); if (!p) return false;
      LE.playerUsed = true;
      lantern(p.x, groundY(p.x, p.z) + 1.5, p.z, null, 0.75);
      const w = pick(WISHES);
      toast(`🏮 소원 등불을 날렸다: "${w}"`);
      SND.chime(p.x, p.z, 1046.5); SND.chime(p.x, p.z, 1318.5, 0.2);
      kidsCheer(p.x, p.z);
      return true;
    },
  };

  /* ════════════════════════════ ④ 투석기 시연 (낮) ════════════════════════════ */
  const TS = PAGEANT_SITES.trebuchet;
  const trebG = addRoot(new THREE.Group()); trebG.visible = false;
  const TREB = { armPivot: null, slingEnd: new THREE.Object3D(), pumpkin: null, lever: null, leverPos: new V3() };
  const ARM_COCK = 0.95, ARM_FIRE = -1.35;   // 팔 각도 (rotation.z): 긴 쪽이 뒤로 내려간 장전 → 앞 위로 휘두름
  {
    const g = trebG;
    placeG(g, TS.x, TS.z, Math.atan2(TS.fx - TS.x, TS.fz - TS.z) - Math.PI / 2);   // 지역 +x 가 요새 쪽
    /* 바닥 틀 */
    for (const s of [-1, 1]) g.add(box(3.2, 0.18, 0.18, M.wood, 0, 0.09, s * 0.7));
    for (const x of [-1.4, 0, 1.4]) g.add(box(0.18, 0.16, 1.6, M.wood, x, 0.2, 0));
    /* A 자 기둥 */
    const H = 2.5;
    for (const s of [-1, 1]) {
      for (const lean of [-1, 1]) { const p = box(0.15, H + 0.3, 0.15, M.darkWood, lean * 0.55, H / 2, s * 0.62); p.rotation.z = -lean * 0.24; g.add(p); }
      const brace = box(1.5, 0.1, 0.1, M.wood, 0, 0.9, s * 0.62); g.add(brace);
    }
    const axle = cyl(0.07, 0.07, 1.5, M.iron, 8); axle.rotation.x = Math.PI / 2; axle.position.y = H; g.add(axle);
    /* 팔 (회전축) */
    const piv = new THREE.Group(); piv.position.set(0, H, 0); g.add(piv); TREB.armPivot = piv;
    const arm = box(4.4, 0.16, 0.16, M.lightWood, -0.8, 0, 0); piv.add(arm);   // 긴 쪽 -x (뒤) 3 m, 짧은 쪽 +x 1.4 m
    /* 평형추 상자 */
    const cw = new THREE.Group(); cw.position.set(1.35, 0, 0); piv.add(cw);
    const cwBox = box(0.8, 0.75, 0.75, M.darkWood, 0, -0.55, 0); cw.add(cwBox);
    for (const y of [-0.3, -0.8]) cw.add(box(0.84, 0.06, 0.79, M.iron, 0, y, 0));
    const stones = sph(0.22, M.stone, 6); stones.position.set(0, -0.15, 0); cw.add(stones);
    TREB.cw = cw;
    /* 투석 끈 끝 (긴 쪽 끝) */
    const tip = new THREE.Object3D(); tip.position.set(-3.0, 0, 0); piv.add(tip); TREB.tip = tip;
    const slingLine = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.012, 0.012, 1, 4)), M.rope); slingLine.castShadow = false; g.add(slingLine); TREB.line = slingLine;
    const pouch = sph(0.12, M.rope, 6); pouch.scale.set(1, 0.5, 1); g.add(pouch); TREB.pouch = pouch;
    /* 레버 (투석기 옆, 플레이어가 당긴다) */
    const lv = new THREE.Group(); lv.position.set(0.3, 0, 1.3); g.add(lv);
    lv.add(box(0.3, 0.3, 0.3, M.darkWood, 0, 0.15, 0));
    const handle = new THREE.Group(); handle.position.y = 0.3; lv.add(handle);
    const hs = cyl(0.03, 0.03, 0.8, M.iron, 6); hs.position.y = 0.4; handle.add(hs);
    const knob = sph(0.06, M.red, 8); knob.position.y = 0.82; handle.add(knob);
    handle.rotation.z = 0.5; TREB.lever = handle; TREB.leverG = lv;
    /* 호박 더미 */
    for (let i = 0; i < 4; i++) { const pk = sph(0.22, M.pumpkin, 8); pk.scale.y = 0.8; pk.position.set(-0.6 + (i % 2) * 0.42, 0.18 + (i > 1 ? 0.3 : 0), -1.5 + (i % 2) * 0.1); g.add(pk); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    TREB.armPivot.rotation.z = ARM_COCK;
  }
  function makePumpkin() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(keep(new THREE.SphereGeometry(0.26, 10, 7)), M.pumpkin); b.scale.y = 0.82; b.castShadow = true; g.add(b);
    const st = cyl(0.03, 0.04, 0.12, M.leaf, 5); st.position.y = 0.24; g.add(st);
    return g;
  }
  const flyPk = makePumpkin(); flyPk.visible = false; addRoot(flyPk);
  /* 나무 요새 (판자 개별 메시 → 맞으면 날아간다) */
  const fortG = addRoot(new THREE.Group()); fortG.visible = false;
  const planks = [];
  {
    placeG(fortG, TS.fx, TS.fz, Math.atan2(TS.x - TS.fx, TS.z - TS.fz));   // 지역 +z 가 투석기 쪽
    const add = (m, big = false) => { m.userData.big = big; fortG.add(m); m.userData.home = { p: m.position.clone(), q: m.quaternion.clone() }; planks.push({ m, v: new V3(), av: new V3(), fly: false, rest: false }); return m; };
    for (let i = 0; i < 11; i++) { const h = 2.2 + (i % 2) * 0.25; const lg = cyl(0.13, 0.15, h, M.wood, 7); lg.position.set(-1.5 + i * 0.3, h / 2, 0); add(lg); const pt = new THREE.Mesh(keep(new THREE.ConeGeometry(0.13, 0.25, 7)), M.wood); pt.position.set(-1.5 + i * 0.3, h + 0.12, 0); add(pt); }
    for (const y of [0.6, 1.6]) add(box(3.4, 0.14, 0.1, M.darkWood, 0, y, 0.17), true);
    /* 작은 탑 */
    for (const s of [-1, 1]) for (const zz of [-0.5, -1.4]) add(box(0.14, 3.2, 0.14, M.darkWood, s * 0.55, 1.6, zz), true);
    add(box(1.4, 0.1, 1.2, M.wood, 0, 3.2, -0.95), true);
    const flagPole = cyl(0.03, 0.03, 1.2, M.darkWood, 5); flagPole.position.set(0, 3.8, -0.95); add(flagPole, true);
    const flag = box(0.5, 0.32, 0.02, M.teamR, 0.26, 4.2, -0.95); add(flag, true);
    fortG.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  const splats = [];
  const splatGeo = keep(new THREE.CircleGeometry(0.6, 12));
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(splatGeo, M.splat); s.rotation.x = -Math.PI / 2; s.visible = false; addRoot(s); splats.push({ m: s, life: 0 }); }
  function fortReset() {
    for (const pl of planks) { const h = pl.m.userData.home; pl.m.position.copy(h.p); pl.m.quaternion.copy(h.q); pl.fly = false; pl.rest = false; }
  }
  function fortHit(wx, wy, wz, final = false) {
    const radius = final ? 3.5 : 0.75, power = final ? 0.85 : 0.55;
    fortG.updateMatrixWorld(true);
    const local = fortG.worldToLocal(_v3.set(wx, wy, wz)).clone();
    let n = 0;
    for (const pl of planks) {
      if (pl.fly || (pl.m.userData.big && !final)) continue;
      const d = Math.hypot(pl.m.position.x - local.x, (pl.m.position.y - local.y) * 0.5);
      if (d > radius + Math.random() * 0.3) continue;
      pl.fly = true; pl.rest = false; n++;
      _v.copy(pl.m.position).sub(local); _v.z = Math.min(_v.z, 0) - 1; _v.normalize();
      pl.v.set(_v.x * rr(2, 4), rr(3, 6.5), _v.z * rr(2.5, 5)).multiplyScalar(power);
      pl.av.set(rr(-6, 6), rr(-4, 4), rr(-6, 6));
    }
    return n;
  }
  function planksUpdate(dt) {
    const gl = groundY(TS.fx, TS.fz) - fortG.position.y;
    for (const pl of planks) {
      if (!pl.fly || pl.rest) continue;
      pl.v.y -= 9.8 * dt;
      pl.m.position.addScaledVector(pl.v, dt);
      pl.m.rotation.x += pl.av.x * dt; pl.m.rotation.y += pl.av.y * dt; pl.m.rotation.z += pl.av.z * dt;
      if (pl.m.position.y < gl + 0.12) {
        pl.m.position.y = gl + 0.12;
        if (pl.v.y < -2) { pl.v.y *= -0.3; pl.v.x *= 0.5; pl.v.z *= 0.5; pl.av.multiplyScalar(0.4); }
        else { pl.rest = true; pl.m.rotation.x = Math.PI / 2; pl.m.rotation.z = 0; }
      }
    }
  }
  function pumpkinSplat(x, y, z) {
    SND.splat(x, z); SND.crack(x, z);
    for (let k = 0; k < 26; k++) debris(x, y, z, rr(-4, 4), rr(2, 6), rr(-4, 4), rr(0.08, 0.2), rr(0.05, 0.12), rr(0.08, 0.18), pick([0xe8781e, 0xf09a30, 0xd8661a, 0xf6c040]), rr(2.5, 4));
    for (let k = 0; k < 10; k++) debris(x, y, z, rr(-3, 3), rr(2, 5), rr(-3, 3), 0.05, 0.02, 0.03, 0xf6eac8, rr(2, 3));
    for (let k = 0; k < 8; k++) debris(x, y, z, rr(-3, 3), rr(2, 5), rr(-3, 3), rr(0.05, 0.25), 0.03, 0.06, 0x8a5a32, rr(2, 3.5));
    const s = splats.find(q => q.life <= 0) || splats[0];
    s.m.position.set(x + rr(-0.3, 0.3), groundY(x, z) + 0.03, z + rr(-0.3, 0.3)); s.m.scale.setScalar(rr(0.8, 1.3)); s.m.visible = true; s.life = 25;
  }
  const TR = { phase: '', t: 0, shots: 0, crew: [], herald: null, playerReq: false, playerUsed: false, playerShot: false, pk: { on: false, p: new V3(), v: new V3() }, arm: ARM_COCK, armV: 0, obj: {} };
  const SHOTS = 3;
  function trebLocal(x, y, z, out) { return trebG.localToWorld(out.set(x, y, z)); }
  const trebuchet = {
    weight: 3,
    eligible: () => getNight() < 0.35 && distP(TS.x, TS.z) < SITE_NEAR,
    start() {
      trebG.visible = true; fortG.visible = true; fortReset();
      TR.phase = 'setup'; TR.t = 7; TR.shots = 0; TR.playerReq = false; TR.playerUsed = false; TR.arm = ARM_FIRE; TR.armV = 0; TR.pk.on = false; flyPk.visible = false;
      trebG.updateMatrixWorld(true);
      const crewSpots = [[-1.2, 0, -1.2], [0.9, 0, -1.1]];
      TR.crew = ['blacksmith', 'innkeeper'].map((k, i) => { const n = actor(k); const w = trebLocal(crewSpots[i][0], 0, crewSpots[i][2], new V3()); place(n, w.x, w.z, 0); return { n, w }; });
      TR.herald = actor('noble');
      const hw = trebLocal(-1.5, 0, 2.4, new V3());
      place(TR.herald, hw.x, hw.z, Math.atan2(TS.fx - hw.x, TS.fz - hw.z));
      TR.leverW = trebLocal(0.3, 0, 1.3, new V3());
      toast(`🎃 투석기 시연! ${TS.name}에서 나무 요새에 호박을 던집니다. 레버 앞에서 F 로 직접 쏠 수도 있어요 (${dirText(TS.x, TS.z)})`);
      SND.fanfare(TS.x, TS.z);
      return true;
    },
    fire(byPlayer) {
      TR.phase = 'fire'; TR.t = 0; TR.armV = 0; TR.released = false; TR.byPlayer = byPlayer;
      SND.creak(TS.x, TS.z);
      if (byPlayer) { TR.playerUsed = true; TR.playerShot = true; toast('🎃 레버를 당겼다! 투석기가 휘익—'); }
      else say(TR.herald, '발사!', 1.4, '#7a1a10');
    },
    update(dt, t) {
      TR.t -= dt;
      const R = TR;
      trebG.updateMatrixWorld(true);
      if (R.phase === 'setup') {
        R.arm += (ARM_COCK - R.arm) * Math.min(1, dt * 0.5);
        if (R.t <= 0) { R.phase = 'load'; R.t = 2; say(R.herald, '투석기를 장전하라!', 2, '#7a1a10'); }
      } else if (R.phase === 'crank') {
        R.arm += (ARM_COCK - R.arm) * Math.min(1, dt * 0.9);
        if (Math.random() < dt * 2) SND.creak(TS.x, TS.z);
        if (R.t <= 0) { R.phase = 'load'; R.t = 1.6; }
      } else if (R.phase === 'load') {
        R.arm = ARM_COCK;
        if (R.t <= 0) { R.phase = 'ready'; R.t = R.shots === 0 ? 3.5 : 2.4; if (R.shots === 0) say(R.herald, '하나, 둘…', 1.6, '#7a1a10'); }
      } else if (R.phase === 'ready') {
        if (R.playerReq) { R.playerReq = false; trebuchet.fire(true); }
        else if (R.t <= 0) trebuchet.fire(false);
      } else if (R.phase === 'fire') {
        /* 평형추가 떨어지며 팔이 휘두른다 */
        R.armV -= dt * 16; R.arm += R.armV * dt;
        if (!R.released && R.arm < -0.55) {
          R.released = true;
          TREB.tip.getWorldPosition(_v);
          R.pk.on = true; R.pk.p.copy(_v);
          /* 요새 정면 아무 데나 맞힌다 (마지막 발은 가운데) */
          const last = R.shots >= SHOTS - 1;
          const tx = TS.fx + (last ? 0 : rr(-1.2, 1.2)), tz = TS.fz + (last ? 0 : rr(-0.4, 0.4)), ty = groundY(TS.fx, TS.fz) + rr(0.9, 1.9);
          const T = 1.7; R.pk.T = T; R.pk.age = 0;
          R.pk.v.set((tx - _v.x) / T, (ty - _v.y + 0.5 * 9.8 * T * T) / T, (tz - _v.z) / T);
          flyPk.visible = true;
          SND.whoosh(TS.x, TS.z);
        }
        if (R.arm <= ARM_FIRE) { R.arm = ARM_FIRE; R.armV = 0; R.phase = 'flight'; R.t = 4; SND.thump(TS.x, TS.z); }
      } else if (R.phase === 'flight') {
        if (!R.pk.on && R.t < 2.2) {
          R.shots++;
          if (R.shots >= SHOTS && !R.playerReq) { R.phase = 'outro'; R.t = 7; say(R.herald, '요새가 무너졌다! 시연 끝!', 2.5, '#7a1a10'); toast('🎃 요새가 와르르! 투석기 시연이 끝났어요. 모두 박수!'); SND.cheer(TS.x, TS.z, 1.4); kidsCheer(TS.x, TS.z); for (const c of R.crew) cheer(c.n, 3); cheer(R.herald, 3); }
          else { R.phase = 'crank'; R.t = 4.5; say(pick(R.crew).n, '영차, 영차!', 1.5); }
        }
      } else if (R.phase === 'outro') {
        R.arm += (ARM_COCK * 0.4 - R.arm) * Math.min(1, dt * 0.5);
        if (R.t <= 0) return false;
      }
      TREB.armPivot.rotation.z = R.arm;
      /* 끈 + 주머니: 팔 끝에서 아래로 늘어진다 (발사 땐 휘날림) */
      TREB.tip.getWorldPosition(_v);
      const loaded = R.phase === 'load' || R.phase === 'ready' || (R.phase === 'fire' && !R.released);
      const hang = R.phase === 'fire' ? 0.5 : 0.9;
      _v2.copy(_v); _v2.y -= hang;
      if (R.phase === 'fire') { trebLocal(-3.0 - 0.5, 0, 0, _v3); _v2.lerp(_v3, 0.5); }
      _v2.y = Math.max(_v2.y, trebG.position.y + 0.15);
      TREB.pouch.position.copy(trebG.worldToLocal(_v3.copy(_v2)));
      const mid = _v3.copy(_v).add(_v2).multiplyScalar(0.5);
      TREB.line.position.copy(trebG.worldToLocal(mid.clone()));
      const len = _v.distanceTo(_v2);
      TREB.line.scale.set(1, Math.max(0.01, len), 1);
      _qa.setFromUnitVectors(AY, _v3.copy(_v).sub(_v2).normalize());
      trebG.getWorldQuaternion(_qb);
      TREB.line.quaternion.copy(_qb.invert().multiply(_qa));
      if (loaded) { flyPk.visible = true; flyPk.position.copy(_v2); flyPk.position.y += 0.12; }
      /* 날아가는 호박 */
      if (R.pk.on) {
        R.pk.age += dt;
        R.pk.v.y -= 9.8 * dt;
        R.pk.p.addScaledVector(R.pk.v, dt);
        flyPk.position.copy(R.pk.p); flyPk.rotation.x += dt * 5; flyPk.rotation.z += dt * 3;
        if (R.pk.age >= R.pk.T) {
          R.pk.on = false; flyPk.visible = false;
          pumpkinSplat(R.pk.p.x, R.pk.p.y, R.pk.p.z);
          const last = R.shots >= SHOTS - 1;
          const n = fortHit(R.pk.p.x, R.pk.p.y, R.pk.p.z, last);
          if (n) SND.crack(TS.fx, TS.fz);
          if (R.byPlayer) { toast('🎃 명중! 왕자님이 쏜 호박이 요새를 부쉈다! 구경꾼들: "왕자님 만세!"'); kidsCheer(TS.fx, TS.fz); }
          SND.cheer(TS.x, TS.z, 1); crowdTick(0, R, TS.x, TS.z, 30, ['맞았다!', '와하하!', '호박 폭탄이다!', '한 번 더!'], 8, 0);
        }
      } else if (!loaded && R.phase !== 'flight') flyPk.visible = false;
      /* 레버 */
      const lvWant = (R.phase === 'fire' || R.phase === 'flight') && R.byPlayer ? -0.6 : 0.5;
      TREB.lever.rotation.z += clamp(lvWant - TREB.lever.rotation.z, -dt * 3, dt * 3);
      /* 사람 */
      for (const c of R.crew) {
        const n = c.n; if (!npcs.isActing(n)) continue;
        if (!walkIn(n, dt)) continue;
        if (R.phase === 'crank') { npcs.actorPlay(n, 'Idle', 0.3); turn(n, Math.atan2(TS.x - n.x, TS.z - n.z), dt, 4); syncRoot(n, 0); pose(n, { spine: 25 + Math.sin(t * 6) * 8, armL: [-70 + Math.sin(t * 6) * 25, -20, 0, 0], armR: [-70 + Math.sin(t * 6) * 25, -20, 0, 0] }); }
        else standBy(n, dt, { x: TS.fx, z: TS.fz });
      }
      if (R.herald && npcs.isActing(R.herald)) standBy(R.herald, dt, { x: TS.fx, z: TS.fz });
      if (R.phase !== 'setup') crowdTick(dt, R, TS.x, TS.z, 26, ['투석기다!', '호박이 날아간다!', '와아!'], 6, 2.2);
      return true;
    },
    stop() {
      for (const c of TR.crew) release(c.n);
      if (TR.herald) release(TR.herald);
      TR.crew = []; TR.herald = null; TR.phase = ''; TR.pk.on = false;
      flyPk.visible = false; trebG.visible = false; fortG.visible = false;
    },
    nearLever() {
      if (cur !== trebuchet || TR.playerUsed || !TR.leverW || !['setup', 'crank', 'load', 'ready', 'flight'].includes(TR.phase)) return false;
      return distP(TR.leverW.x, TR.leverW.z) < 2.2;
    },
    pull() {
      if (TR.phase === 'ready') trebuchet.fire(true);
      else { TR.playerReq = true; TR.playerUsed = true; toast('🎃 레버를 잡았다! 장전되면 바로 발사합니다'); }
      return true;
    },
  };
  function splatsUpdate(dt) {
    for (const s of splats) if (s.life > 0) { s.life -= dt; if (s.life <= 0) s.m.visible = false; }
  }

  /* ════════════════════════════ ⑤ 줄다리기 (낮) ════════════════════════════ */
  const GS = PAGEANT_SITES.tug;
  const tugG = addRoot(new THREE.Group()); tugG.visible = false;
  const ROPE_HALF = 6;
  const T = { phase: '', t: 0, s: 0, sv: 0, WIN: 1.6, teams: [[], []], ref: null, player: -1, playerF: 0, presses: 0, surge: [0, 0], surgeT: [0, 0], winner: -1, heaveT: 0, obj: {} };
  let ropeMesh, marker, ropeSlope = 0;
  {
    const gy = groundY(GS.x, GS.z);
    const gL = groundY(GS.x - ROPE_HALF, GS.z), gR = groundY(GS.x + ROPE_HALF, GS.z);
    ropeSlope = (gR - gL) / (ROPE_HALF * 2);
    tugG.position.set(GS.x, gy, GS.z);
    ropeMesh = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.035, 0.035, ROPE_HALF * 2, 6)), M.rope); ropeMesh.rotation.z = Math.PI / 2 + Math.atan(ropeSlope); ropeMesh.position.y = 0.95 + (gL + gR) / 2 - gy; ropeMesh.castShadow = true; tugG.add(ropeMesh);
    marker = new THREE.Group(); tugG.add(marker);
    const rib = box(0.06, 0.4, 0.06, M.white, 0, 0.75, 0); marker.add(rib);
    const rib2 = box(0.18, 0.12, 0.02, M.flowerY, 0.0, 0.55, 0); marker.add(rib2);
    /* 분필 선: 가운데 + 양쪽 승리선 */
    const line = (x, w = 0.08) => { const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, 4.4)), M.chalk); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, 0); m.renderOrder = 2; tugG.add(m); };
    line(0, 0.12); line(-T.WIN); line(T.WIN);
    /* 팀 깃발 */
    for (const [sx, mat] of [[-1, M.teamR], [1, M.teamB]]) {
      const p = cyl(0.03, 0.03, 2.2, M.darkWood, 5); p.position.set(sx * (ROPE_HALF + 0.8), 1.1, -1.4); tugG.add(p);
      const f = box(0.6, 0.38, 0.02, mat, sx * (ROPE_HALF + 0.8) + 0.3, 1.95, -1.4); tugG.add(f);
    }
  }
  const PULL = { spine: -22, armL: [-72, -18, -4, 0], armR: [-72, -18, -4, 0], legL: [-28, 4, 24], legR: [12, 4, 8] };
  const tug = {
    weight: 3,
    eligible: () => getNight() < 0.35 && distP(GS.x, GS.z) < SITE_NEAR,
    start() {
      tugG.visible = true;
      T.phase = 'gather'; T.t = 10; T.s = 0; T.sv = 0; T.player = -1; T.playerF = 0; T.presses = 0; T.winner = -1; T.surge = [0, 0]; T.surgeT = [rr(1, 3), rr(1, 3)]; T.heaveT = 0; T.won = false;
      marker.position.x = 0; ropeMesh.position.x = 0;
      const keys = [['blacksmith', 'innkeeper', 'baker', 'traveler'], ['bard', 'monk', 'maid', 'herbalist']];
      T.teams = keys.map((ks, side) => ks.map((k, i) => {
        const n = actor(k);
        const off = (1.3 + i * 1.05) * (side ? 1 : -1);
        const band = new THREE.Mesh(keep(new THREE.TorusGeometry(0.1, 0.022, 5, 14)), side ? M.teamB : M.teamR); band.rotation.x = Math.PI / 2; band.position.y = 0.1; attach(n, 'Head', band);
        place(n, GS.x + off, GS.z + (i % 2 ? 0.12 : -0.12), side ? -Math.PI / 2 : Math.PI / 2);
        return { n, off, side, fallen: false };
      }));
      T.ref = actor('noble');
      place(T.ref, GS.x, GS.z - 2.1, 0);
      toast(`💪 줄다리기 대회! ${GS.name}에서 빨강 vs 파랑. 줄 끝에서 F 로 한편에 끼어 F 연타! (${dirText(GS.x, GS.z)})`);
      SND.fanfare(GS.x, GS.z);
      return true;
    },
    update(dt, t) {
      T.t -= dt;
      if (T.phase === 'gather') { if (T.t <= 0) { T.phase = 'ready'; T.t = 3; say(T.ref, '준비…', 1.5, '#7a1a10'); } }
      else if (T.phase === 'ready') { if (T.t <= 0) { T.phase = 'pull'; T.t = 45; say(T.ref, '당겨라!', 1.5, '#7a1a10'); SND.whistle(GS.x, GS.z); } }
      else if (T.phase === 'pull') {
        /* 힘: 기본 + 기세(가끔 확 당김) + 플레이어 */
        for (const k of [0, 1]) {
          T.surgeT[k] -= dt;
          if (T.surgeT[k] <= 0) { T.surgeT[k] = rr(1.5, 4); T.surge[k] = rr(0.3, 1.1); if (Math.random() < 0.5) say(pick(T.teams[k]).n, pick(['영차!', '당겨!', '힘내!', '으라차!']), 1.2); }
          T.surge[k] = Math.max(0, T.surge[k] - dt * 0.5);
        }
        T.playerF = Math.max(0, T.playerF - dt * 2.4);
        const fR = 4 + T.surge[0] + (T.player === 0 ? T.playerF : 0) + Math.sin(t * 1.3) * 0.3;
        const fB = 4 + T.surge[1] + (T.player === 1 ? T.playerF : 0) + Math.sin(t * 1.1 + 2) * 0.3;
        T.sv += ((fB - fR) * 0.22 - T.sv * 1.6) * dt;
        T.s += T.sv * dt;
        if (T.t < 15) T.s += Math.sign(T.s || 1) * dt * 0.03;   // 오래 끌면 한쪽으로 기운다
        if (Math.abs(T.s) >= T.WIN || T.t <= 0) tug.finish(T.s > 0 ? 1 : 0);
        T.heaveT -= dt; if (T.heaveT <= 0) { T.heaveT = rr(0.8, 1.4); SND.grunt(GS.x + T.s, GS.z); }
        crowdTick(dt, T, GS.x, GS.z, 22, ['빨강 이겨라!', '파랑 힘내!', '조금만 더!', '영차 영차!'], 6, 1.8);
        if (T.player >= 0 && distP(GS.x + T.s + (T.player ? 1 : -1) * 5.6, GS.z) > 4) { T.player = -1; toast('💪 줄을 놓았다…'); }
      } else if (T.phase === 'end') {
        if (T.t <= 0) return false;
      }
      const s = T.s;
      marker.position.x = s; ropeMesh.position.x = s; ropeMesh.position.y = 0.95 + (groundY(GS.x - ROPE_HALF, GS.z) + groundY(GS.x + ROPE_HALF, GS.z)) / 2 - tugG.position.y + s * ropeSlope;
      marker.position.y = ropeMesh.position.y - 0.95;
      for (const team of T.teams) for (const m of team) {
        const n = m.n; if (!npcs.isActing(n)) continue;
        const face = m.side ? -Math.PI / 2 : Math.PI / 2;
        if (T.phase === 'gather') { if (walkIn(n, dt)) { turn(n, face, dt, 4); npcs.actorPlay(n, 'Idle', 0.3); } continue; }
        if (T.phase === 'end') {
          if (m.side === T.winner) { n.x += (GS.x + m.off + s - n.x) * Math.min(1, dt * 3); syncRoot(n, Math.max(0, Math.sin(t * 7 + m.off)) * 0.12); n.standHop = 0; cheerUp(n); }
          else npcs.actorPlay(n, 'Idle', 0.3);
          continue;
        }
        if (!m.atRope) { if (stepTo(n, GS.x + m.off + s, n.z, 1.4, dt)) m.atRope = true; continue; }
        n.x += (GS.x + m.off + s - n.x) * Math.min(1, dt * 6);
        turn(n, face, dt, 6);
        npcs.actorPlay(n, 'Idle', 0.3);
        syncRoot(n);
        const j = T.phase === 'pull' ? Math.sin(t * 9 + m.off * 3) * 4 : 0;
        pose(n, { ...PULL, spine: PULL.spine + j });
      }
      if (T.ref && npcs.isActing(T.ref)) {
        standBy(T.ref, dt, { x: GS.x, z: GS.z });
        if (T.phase === 'pull' && walkIn(T.ref, dt)) { syncRoot(T.ref); pose(T.ref, { armR: [-170, -10, 0, 0] }); }
      }
      return true;
    },
    finish(w) {
      if (T.phase !== 'pull') return;
      T.phase = 'end'; T.t = 8; T.winner = w;
      const names = ['빨강', '파랑'];
      say(T.ref, `${names[w]} 승리!`, 2.5, '#7a1a10');
      SND.whistle(GS.x, GS.z); SND.cheer(GS.x, GS.z, 1.3); kidsCheer(GS.x, GS.z);
      for (const m of T.teams[1 - w]) {
        const n = m.n; if (!npcs.isActing(n)) continue;
        const dir = w === 1 ? 1 : -1;   // 이긴 쪽으로 고꾸라진다
        setTimeout(() => { if (!disposed && npcs.isActing(n)) npcs.knockDown(n, new V3(dir * rr(2, 3.2), 2.2, rr(-0.5, 0.5)), 'fight'); }, rr(0, 350));
      }
      setTimeout(() => { if (!disposed && cur === tug) for (const m of T.teams[w]) if (Math.random() < 0.6) say(m.n, pick(['이겼다!', '만세!', '우리가 최고!']), 1.6); }, 400);
      let line = `💪 ${names[w]} 편 승리! 진 편은 앞으로 꽈당!`;
      if (T.player === w) { const got = addCoins(3); line += ` 왕자님 덕분이에요${got ? ' (은화 3닢)' : ''}!`; SND.coin(GS.x, GS.z); }
      else if (T.player === 1 - w) line += ' 왕자님도 같이 넘어질 뻔…';
      toast(line);
      T.player = -1;
    },
    stop() {
      detachAll();
      for (const team of T.teams) for (const m of team) { m.atRope = false; release(m.n); }
      if (T.ref) release(T.ref);
      T.teams = [[], []]; T.ref = null; T.phase = ''; T.player = -1;
      tugG.visible = false;
    },
    nearEnd() {
      if (cur !== tug || T.player >= 0 || !(T.phase === 'gather' || T.phase === 'ready' || T.phase === 'pull')) return -1;
      const p = playerPos(); if (!p) return -1;
      for (const side of [0, 1]) { const ex = GS.x + T.s + (side ? 1 : -1) * 5.6; if (Math.hypot(p.x - ex, p.z - GS.z) < 2.4) return side; }
      return -1;
    },
    join(side) {
      T.player = side; T.presses = 0;
      toast(`💪 ${side ? '파랑' : '빨강'} 편에 들어갔다! F 를 연타해서 당기세요!`);
      say(T.teams[side][3] && T.teams[side][3].n, '왕자님이 오셨다! 힘내자!', 1.8);
      return true;
    },
    pullOnce() { T.playerF = Math.min(2.8, T.playerF + 0.45); T.presses++; if (T.presses % 6 === 0) SND.grunt(GS.x, GS.z); return true; },
  };

  /* ════ 스케줄 ════ */
  const EVENTS = { feast, wedding, lanterns: lanternsEv, trebuchet, tug };
  let cur = null, curName = '', lastName = '', clock = rr(FIRST[0], FIRST[1]), endingFast = false, forced = false;   // forced: 콘솔로 연 행사는 축제와 겹쳐도 끝까지
  function startEvent(name, force = false) {
    const e = EVENTS[name]; if (!e) return false;
    if (cur === e) return false;
    if (!force && !e.eligible()) return false;
    if (cur) stopEvent();
    if (!e.start()) return false;
    cur = e; curName = name; lastName = name; endingFast = false; forced = force;
    return true;
  }
  function stopEvent() {
    if (!cur) return;
    try { cur.stop(); } catch (e) { console.warn('[pageant] stop', e); }
    cur = null; curName = ''; endingFast = false;
    clock = rr(GAP[0], GAP[1]);
  }
  function pickEvent() {
    const c = [];
    for (const [k, e] of Object.entries(EVENTS)) {
      if (k === lastName) continue;
      let ok = false; try { ok = e.eligible(); } catch { ok = false; }
      if (ok) c.push([k, e.weight]);
    }
    if (!c.length) return null;
    let s = c.reduce((a, [, w]) => a + w, 0) * Math.random();
    for (const [k, w] of c) { s -= w; if (s <= 0) return k; }
    return c[c.length - 1][0];
  }
  function trigger(name) {
    if (name === 'stop') { stopEvent(); return true; }
    return startEvent(name, true);
  }

  /* ════ F 상호작용 ════ */
  let nearCache = null;
  function computeNear() {
    if (!cur || !isOnFoot()) return null;
    if (cur === feast) {
      const s = feast.nearSeat();
      if (s) return { kind: 'feastSeat', label: '연회 자리 앉기', x: s.x, y: groundY(s.x, s.z) + 1.3, z: s.z, seat: s };
    } else if (cur === trebuchet) {
      if (trebuchet.nearLever()) return { kind: 'lever', label: '투석기 발사!', x: TR.leverW.x, y: TR.leverW.y + 1.4, z: TR.leverW.z };
    } else if (cur === tug) {
      if (T.player >= 0 && T.phase === 'pull') { const p = playerPos(); return { kind: 'tugPull', label: '연타! 영차! <span class="bar"><i></i></span>', cls: T.player ? 'blue' : 'red', x: p.x, y: groundY(p.x, p.z) + 2.3, z: p.z }; }
      if (T.player >= 0) { const p = playerPos(); return { kind: 'tugWait', label: '곧 시작! 준비…', cls: T.player ? 'blue' : 'red', x: p.x, y: groundY(p.x, p.z) + 2.3, z: p.z }; }
      const side = tug.nearEnd();
      if (side >= 0) { const ex = GS.x + T.s + (side ? 1 : -1) * 5.6; return { kind: 'tugJoin', label: `줄다리기 ${side ? '파랑' : '빨강'} 편 참가`, cls: side ? 'blue' : 'red', side, x: ex, y: groundY(ex, GS.z) + 1.6, z: GS.z }; }
    } else if (cur === lanternsEv) {
      if (lanternsEv.nearSpot()) { const p = playerPos(); return { kind: 'lantern', label: '소원 등불 날리기', x: p.x, y: groundY(p.x, p.z) + 2.3, z: p.z }; }
    }
    return null;
  }
  function nearAction() { return nearCache ? { kind: nearCache.kind, label: nearCache.label.replace(/<[^>]+>/g, '').trim() } : null; }
  function onF(repeat = false) {
    if (disposed) return false;
    const a = computeNear();
    if (!a) return false;
    if (repeat) return true;   // 꾹 누른 F 는 삼키기만 한다
    switch (a.kind) {
      case 'feastSeat': return feast.sit(a.seat);
      case 'lever': return trebuchet.pull();
      case 'tugJoin': return tug.join(a.side);
      case 'tugPull': return tug.pullOnce();
      case 'tugWait': return true;
      case 'lantern': return lanternsEv.release();
    }
    return false;
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
    let busy = false; try { busy = !!isBusy(); } catch { busy = false; }
    if (cur) {
      let alive = false;
      try { alive = cur.update(dt, t); } catch (e) { console.warn('[pageant]', curName, e); alive = false; }
      if (!alive) stopEvent();
      else if (busy && !endingFast && !forced) { endingFast = true; endT = 4; }
      if (endingFast && cur) { endT -= dt; if (endT <= 0) stopEvent(); }
    } else {
      clock -= dt;
      if (clock <= 0) {
        clock = 20;
        if (isVisible() && !busy) { const k = pickEvent(); if (k) startEvent(k); }
      }
    }
    lnUpdate(dt, t);
    if (cur === trebuchet || planks.some(q => q.fly && !q.rest)) planksUpdate(dt);
    splatsUpdate(dt);
    fxUpdate(dt, t);
    dbUpdate(dt);
    lightApply();
    nearCache = computeNear();
    showPrompt(nearCache);
  }
  let endT = 0;

  function dispose() {
    disposed = true;
    if (cur) { try { cur.stop(); } catch { /* */ } cur = null; }
    for (const n of pendingOff) npcs.actorOff(n);
    for (const n of Object.values(cast)) npcs.actorOff(n);
    detachAll();
    for (const o of roots) scene.remove(o);
    for (const d of disposables) if (d && d.dispose) d.dispose();
    promptEl.remove();
    if (actx) actx.close().catch(() => {});
    if (debug && globalThis.__pageant) delete globalThis.__pageant;
  }
  function state() {
    const ph = cur === feast ? FE.phase : cur === wedding ? WE.phase : cur === lanternsEv ? LE.phase : cur === trebuchet ? TR.phase : cur === tug ? T.phase : null;
    return {
      current: curName || null, phase: ph, next: Math.round(clock), endingFast,
      feast: cur === feast ? { seated: seats.filter(s => s.n).length, player: !!FE.playerSeat } : null,
      wedding: cur === wedding ? { wp: WE.wp, of: WE.route.length } : null,
      lanterns: lnAlive, trebuchet: cur === trebuchet ? { shots: TR.shots, flying: planks.filter(q => q.fly).length } : null,
      tug: cur === tug ? { s: +T.s.toFixed(2), player: T.player, winner: T.winner } : null,
      fx: fxAlive, debris: dbAlive, near: nearAction(),
    };
  }

  const api = { update, nearAction, onF, dispose, state, trigger, sites: PAGEANT_SITES,
    nearSeat: () => !!(cur === feast && feast.nearSeat()), nearLever: () => !!(cur === trebuchet && trebuchet.nearLever()) };
  if (debug) globalThis.__pageant = {
    feast: () => trigger('feast'), wedding: () => trigger('wedding'), lanterns: () => trigger('lanterns'),
    trebuchet: () => trigger('trebuchet'), tug: () => trigger('tug'), stop: () => trigger('stop'), state, api,
    go(name) {
      const s = PAGEANT_SITES[name]; if (!s || !globalThis.__drive) return false;
      const at = name === 'trebuchet' ? [s.x - 4, s.z + 9] : name === 'tug' ? [s.x + 2, s.z + 9] : name === 'wedding' ? [pathX(30) + 4, 30] : name === 'lanterns' ? [s.x + 6, s.z + 14] : [s.x - 2, s.z + 9];
      globalThis.__drive.teleport(at[0], at[1], Math.atan2(s.x - at[0], s.z - at[1])); return true;
    },
    get FE() { return FE; }, get WE() { return WE; }, get LE() { return LE; }, get TR() { return TR; }, get T() { return T; },
  };
  return api;
}
