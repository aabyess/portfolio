/* ════════════════════════════════════════════════════════════
   audio.js — 상호랜드 주변 소리 (파일 없이 WebAudio 로 전부 합성)

   층(layer)
     바람        필터 거친 잡음. 겨울·높은 카메라·폭풍에서 세진다. 돌풍처럼 출렁인다
     나뭇잎      가을엔 사각사각 (바람 돌풍을 따라감), 봄·여름은 조금, 겨울 없음
     개울        개울·돌다리 가까이에서 졸졸 (띠 필터 잡음 + 빠른 출렁임), 방향으로 패닝
     선술집      가장 가까운 가판대(+주변 사람 수)로 웅성웅성 + 잔 부딪는 소리 + 가끔 웃음. 밤에 더 크다
     귀뚜라미    밤 (겨울 없음). 두 마리가 좌우에서
     새          낮. 짹짹·휘파람·떨림 3종을 무작위로, 거리·좌우 랜덤. 겨울엔 드물다
     부엉이      밤에 가끔 "부-엉"
     개구리      밤, 연못(fishing.js PONDS) 가까이에서 개굴 (겨울엔 얼어서 없음)
     발소리      걸을 때·달릴 때 — 풀/낙엽/흙길/돌(다리)/나무(선착장)/눈
     말발굽      말·마차 (빠르면 3박 질주, 느리면 2박 속보), 마차는 바퀴 덜컹 + 발굽
     엔진        자동차·오토바이·탱크 아주 작게 (속도 따라 음 높이)

   사용자 배려
     전체 음량은 낮게(배경음 아래). 배경음(isMusicOn)이 켜져 있으면 40% 로 줄인다.
     문서 뷰(!isVisible) 또는 탭 숨김이면 완전히 조용히 + AudioContext 를 멈춘다(CPU 0).
     음악 버튼 옆에 작은 스피커 버튼(#g-amb-btn) — 끄면 localStorage 'portfolio.ambience'='off'.
     AudioContext 는 첫 pointerdown/keydown 에서 만든다 (그 전엔 아무것도 안 함, 콘솔 경고 없음).

   CPU
     계속 도는 노드는 잡음 소스 6개 + 진동자 십여 개뿐. 새·발소리 같은 짧은 소리는 일이 생길 때만
     몇 개 노드를 만들고 끝나면 끊는다. 매 프레임 할당 없음, 음량 갱신은 초당 10번.

   ── portfolio.js 연결 (연결 담당) ──
     // rides(createVehicleSwitcher) 를 만든 뒤, 루프 정의 전에
     const { createAudio } = await import('./audio.js');
     const ambience = createAudio({
       getPlayerPos: () => activePos(),
       getCamera: () => camera,
       getNight: () => night,
       getSeason: () => seasons.season,
       isMusicOn: () => document.getElementById('g-music-btn')?.getAttribute('aria-pressed') === 'true',
       isVisible: () => driveActive,
       getNpcs: () => npcs,
       getStalls: () => stations.map(s => s.group.position),
       isMoving: () => (player.mode === 'onfoot'
         ? { speed: (tavern.seated || fishing.active) ? 0 : pSpeed, mode: 'onfoot' }
         : { speed: Math.abs(speed), mode: rides.current }),
       onFoot: () => player.mode === 'onfoot',
       pathX, roadHalf: WORLD.path.half, bridge: WORLD.bridge, stream: WORLD.stream,
     });
     // step(dt) 안, npcs.update 다음 아무 곳
     ambience.update(dt, t);
   발소리·말발굽은 isMoving() 의 속도로 알아서 박자를 맞춘다. 착지 같은 특별한 순간엔
   ambience.footstep('wood') 처럼 직접 부를 수 있다 (surface 생략 = 발밑 자동).

   API: { update(dt,t), setMuted(b), setVolume(v), footstep(surface?), dispose(), state(), muted, volume }
   ?test 면 window.__audio (+ __audio._dbg.meter() / solo(name) / ctx)
   ════════════════════════════════════════════════════════════ */
import { PONDS as DEFAULT_PONDS } from './fishing.js';

const KEY = 'portfolio.ambience';
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const BIRD_SEASON = { spring: 1.3, summer: 1, autumn: 0.55, winter: 0.18 };
const ENGINE = {   // 엔진 음: 기본 Hz, 속도당 Hz, 음량
  car: [46, 3.2, 1], motorcycle: [70, 6.5, 1.1], tank: [30, 2.2, 1.3],
};
const BASE = 0.55;            // 전체 기준 음량 (배경음 아래로)
const DUCK = 0.4;             // 배경음이 켜져 있을 때
/* 층별 최대 음량 — 브라우저에서 AnalyserNode 로 RMS 를 재서 맞춘 값 (state().layers 는 0..1 비율) */
const LV = { wind: 0.19, leaves: 0.19, stream: 0.22, tavern: 0.83, crickets: 0.045, engine: 0.019, cart: 0.36 };

export function createAudio({
  getPlayerPos, getCamera = () => null, getNight = () => 0, getSeason = () => 'autumn', getWeather = () => null,
  isMusicOn = () => false, isVisible = () => true, getNpcs = () => null, getStalls = () => [],
  getPonds = () => DEFAULT_PONDS, getStream = null,
  isMoving = () => ({ speed: 0, mode: 'onfoot' }), onFoot = () => true,
  getSurface = null, pathX = null, roadHalf = 2.52, bridge = null, stream = null,
  button = true, debug = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test'),
} = {}) {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  let ctx = null, failed = !AC, master = null, noiseBuf = null, comp = null;
  let muted = false, volume = 1;
  try { muted = localStorage.getItem(KEY) === 'off'; } catch { /* 저장소가 막혀도 기본은 켜짐 */ }
  try { const v = parseFloat(localStorage.getItem(KEY + '.vol')); if (v >= 0 && v <= 1) volume = v; } catch { /* */ }

  const L = {};                // 지속 층: { level: GainNode, pan?: StereoPannerNode, v: 현재 목표(0..1) }
  const C = { birds: 0, owls: 0, frogs: 0, clinks: 0, laughs: 0, steps: 0, hooves: 0 };
  const near = { stall: Infinity, pond: Infinity, stream: Infinity, crowd: 0, surface: 'grass' };
  const timers = { bird: rnd(1, 3), owl: rnd(15, 30), frog: 1, clink: 2, laugh: 6, step: 0, hoof: 0, param: 0, crowd: 0 };
  let suspended = false, hiddenFor = 0, lastMode = 'onfoot', masterTarget = 0, soloName = null;
  let px = 0, pz = 0, rx = 1, rz = 0;   // 플레이어 위치, 카메라 오른쪽 벡터 (xz)

  /* ── 만들기 (첫 사용자 조작에서) ── */
  function init() {
    if (ctx || failed) return;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0;
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.3;
      master.connect(comp).connect(ctx.destination);
      const n = ctx.sampleRate * 2;
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      build();
    } catch (e) {
      failed = true; ctx = null;
      if (debug) console.warn('[audio] WebAudio 를 못 씀', e);
    }
  }
  const noiseSrc = () => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    s.start(0, Math.random() * 1.9); return s;
  };
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
  /* param += 깊이 × LFO */
  const lfo = (param, f, depth, type = 'sine') => { const o = osc(type, f), g = gain(depth); o.connect(g).connect(param); return o; };
  function layer(name, input, spatial) {
    const level = gain(0);
    let pan = null;
    if (spatial) { pan = ctx.createStereoPanner(); input.connect(pan).connect(level); } else input.connect(level);
    level.connect(master);
    L[name] = { level, pan, v: 0, extra: null };
    return L[name];
  }

  function build() {
    /* 바람 — 낮은 잡음, 차단 주파수가 돌풍 따라 움직인다 */
    {
      const lp = filt('lowpass', 400, 0.9);
      noiseSrc().connect(lp);
      layer('wind', lp).extra = lp;
    }
    /* 나뭇잎 — 높은 사각거림 */
    {
      const hp = filt('highpass', 2600, 0.5), pk = filt('peaking', 5200, 1); pk.gain.value = 6;
      const am = gain(0.6); lfo(am.gain, 7.7, 0.35); lfo(am.gain, 3.1, 0.25);
      noiseSrc().connect(hp).connect(pk).connect(am);
      layer('leaves', am);
    }
    /* 개울 — 두 띠 + 졸졸 출렁임 */
    {
      const src = noiseSrc(), b1 = filt('bandpass', 700, 0.9), b2 = filt('bandpass', 2400, 1.4), lo = filt('lowpass', 260, 0.7);
      const am = gain(0.65); lfo(am.gain, 6.3, 0.22); lfo(am.gain, 10.7, 0.15); lfo(am.gain, 2.3, 0.12);
      lfo(b2.frequency, 1.7, 500); lfo(b1.frequency, 0.9, 160);
      const mix = gain(1), loG = gain(0.5);
      src.connect(b1).connect(mix); src.connect(b2).connect(mix); src.connect(lo).connect(loG).connect(mix);
      mix.connect(am);
      layer('stream', am, true);
    }
    /* 선술집 웅성거림 — 잡음 + 목소리 진동자를 모음(formant) 필터 셋에 통과, 음절 박자로 출렁 */
    {
      const src = noiseSrc(), voiced = gain(0.18), breath = gain(0.6);
      const v1 = osc('sawtooth', 128), v2 = osc('sawtooth', 197), v3 = osc('sawtooth', 163);
      lfo(v1.frequency, 0.37, 22); lfo(v2.frequency, 0.53, 30); lfo(v3.frequency, 0.29, 26);
      v1.connect(voiced); v2.connect(voiced); v3.connect(voiced); src.connect(breath);
      const mixIn = gain(1); voiced.connect(mixIn); breath.connect(mixIn);
      const sum = gain(1);
      for (const [f, q, d, r, w] of [[600, 5, 180, 0.71, 1], [1250, 6, 380, 1.13, 0.7], [2600, 7, 500, 0.83, 0.35]]) {
        const b = filt('bandpass', f, q); lfo(b.frequency, r, d); lfo(b.frequency, r * 2.9, d * 0.4);
        const g = gain(w); mixIn.connect(b).connect(g).connect(sum);
      }
      const syl = gain(0.55); lfo(syl.gain, 3.7, 0.25); lfo(syl.gain, 5.3, 0.18); lfo(syl.gain, 0.6, 0.12);
      const muff = filt('lowpass', 2400, 0.6);
      sum.connect(syl).connect(muff);
      layer('tavern', muff, true);
    }
    /* 귀뚜라미 두 마리 */
    {
      const sum = gain(1);
      for (const [f, pulse, chirp, pan] of [[4650, 29, 1.7, -0.6], [4280, 33, 1.25, 0.55]]) {
        const c = osc('sine', f), g1 = gain(0.5), g2 = gain(0.5), p = ctx.createStereoPanner();
        lfo(g1.gain, pulse, 0.5, 'square'); lfo(g2.gain, chirp, 0.5, 'square');
        p.pan.value = pan;
        c.connect(g1).connect(g2).connect(p).connect(sum);
      }
      layer('crickets', sum);
    }
    /* 엔진 — 톱니 + 반 옥타브 아래 사각, 낮게 거름 */
    {
      const o1 = osc('sawtooth', 50), o2 = osc('square', 25), lp = filt('lowpass', 320, 1.2), mix = gain(1), g2 = gain(0.5);
      o1.connect(mix); o2.connect(g2).connect(mix); mix.connect(lp);
      const am = gain(0.8); const flut = lfo(am.gain, 13, 0.15);
      lp.connect(am);
      layer('engine', am).extra = { o1, o2, lp, flut };
    }
    /* 수레바퀴 덜컹 — 아주 낮은 잡음, 울퉁불퉁 출렁 */
    {
      const lp = filt('lowpass', 170, 1.5), am = gain(0.6);
      lfo(am.gain, 8.5, 0.3); lfo(am.gain, 3.3, 0.2);
      noiseSrc().connect(lp).connect(am);
      layer('cart', am);
    }
  }

  /* ── 짧은 소리 ── */
  function out(pan, delay = 0) {   // 짧은 소리용 출력: 패너 → master. 끝나면 끊을 노드 목록과 함께
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(master);
    return p;
  }
  function cleanup(src, nodes) { src.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch { /* */ } } }; }
  const t0 = (d = 0) => ctx.currentTime + 0.02 + d;

  function bird(pan, vol) {
    const o = ctx.createOscillator(), g = gain(0), p = out(pan);
    o.type = 'sine'; o.connect(g).connect(p);
    const s = t0(), f = o.frequency, a = g.gain, kind = Math.random();
    let end = s;
    if (kind < 0.42) {           // 짹짹짹
      const n = 2 + (Math.random() * 4 | 0), base = rnd(2600, 4400), dur = rnd(0.05, 0.1), gap = dur + rnd(0.03, 0.09), up = Math.random() < 0.7;
      for (let i = 0; i < n; i++) {
        const ts = s + i * gap;
        f.setValueAtTime(base * (up ? 0.85 : 1.4), ts); f.exponentialRampToValueAtTime(base * (up ? 1.45 : 0.8), ts + dur);
        a.setValueAtTime(0, ts); a.linearRampToValueAtTime(vol, ts + 0.008); a.linearRampToValueAtTime(0, ts + dur);
      }
      end = s + n * gap;
    } else if (kind < 0.72) {    // 휘-이 휘파람 두 음
      const f1 = rnd(1900, 3000), f2 = f1 * rnd(0.72, 1.3), d1 = rnd(0.18, 0.32), d2 = rnd(0.2, 0.4);
      const vib = lfo(f, rnd(6, 9), 40); vib.stop(s + d1 + d2 + 0.2);
      f.setValueAtTime(f1, s); f.setValueAtTime(f1, s + d1 * 0.8); f.exponentialRampToValueAtTime(f2, s + d1 + 0.04);
      a.setValueAtTime(0, s); a.linearRampToValueAtTime(vol * 0.8, s + 0.04); a.setValueAtTime(vol * 0.8, s + d1 - 0.04);
      a.linearRampToValueAtTime(vol * 0.25, s + d1); a.linearRampToValueAtTime(vol * 0.8, s + d1 + 0.05);
      a.setValueAtTime(vol * 0.8, s + d1 + d2 - 0.06); a.linearRampToValueAtTime(0, s + d1 + d2);
      end = s + d1 + d2;
    } else {                     // 또르르 떨림
      const dur = rnd(0.4, 0.9), base = rnd(3200, 5200), am = gain(0.5);
      g.disconnect(); o.disconnect(); o.connect(am).connect(g).connect(p);
      const tr = lfo(am.gain, rnd(20, 32), 0.5, 'square'); tr.stop(s + dur + 0.1);
      f.setValueAtTime(base, s); f.linearRampToValueAtTime(base * rnd(0.75, 1.2), s + dur);
      a.setValueAtTime(0, s); a.linearRampToValueAtTime(vol * 0.7, s + 0.05); a.setValueAtTime(vol * 0.7, s + dur - 0.1); a.linearRampToValueAtTime(0, s + dur);
      end = s + dur;
      cleanup(o, [o, am, g, p]);
    }
    o.start(s); o.stop(end + 0.05);
    if (!o.onended) cleanup(o, [o, g, p]);
    C.birds++;
  }
  function owl(pan, vol) {
    const o = ctx.createOscillator(), g = gain(0), lp = filt('lowpass', 900, 0.5), p = out(pan);
    o.type = 'triangle'; o.connect(lp).connect(g).connect(p);
    const s = t0(), f = o.frequency, a = g.gain, base = rnd(330, 400);
    // 부-  엉-엉-
    const notes = [[0, 0.32, 1], [0.62, 0.16, 0.9], [0.86, 0.5, 0.95]];
    for (const [dt, d, k] of notes) {
      f.setValueAtTime(base * k * 1.04, s + dt); f.linearRampToValueAtTime(base * k * 0.94, s + dt + d);
      a.setValueAtTime(0, s + dt); a.linearRampToValueAtTime(vol, s + dt + 0.07); a.setValueAtTime(vol, s + dt + d - 0.08); a.linearRampToValueAtTime(0, s + dt + d);
    }
    o.start(s); o.stop(s + 1.45); cleanup(o, [o, lp, g, p]); C.owls++;
  }
  function frog(pan, vol) {
    const o = ctx.createOscillator(), b = filt('bandpass', rnd(420, 700), 3), g = gain(0), p = out(pan);
    o.type = 'sawtooth'; const f0 = rnd(85, 170); o.connect(b).connect(g).connect(p);
    const s = t0(), n = 3 + (Math.random() * 6 | 0), on = rnd(0.025, 0.045), off = rnd(0.018, 0.03);
    for (let i = 0; i < n; i++) { const ts = s + i * (on + off); g.gain.setValueAtTime(vol, ts); g.gain.setValueAtTime(0, ts + on); }
    o.frequency.setValueAtTime(f0, s); o.frequency.linearRampToValueAtTime(f0 * 0.9, s + n * (on + off));
    o.start(s); o.stop(s + n * (on + off) + 0.05); cleanup(o, [o, b, g, p]); C.frogs++;
  }
  function clink(pan, vol) {
    const s = t0(), g = gain(0), p = out(pan), base = rnd(2100, 3200);
    g.connect(p);
    g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(vol, s + 0.003);
    if (Math.random() < 0.5) {   // 두 번째 잔 (살짝 뒤)
      g.gain.exponentialRampToValueAtTime(vol * 0.15, s + 0.09); g.gain.linearRampToValueAtTime(vol * 0.7, s + 0.093);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.45);
    } else g.gain.exponentialRampToValueAtTime(0.0001, s + 0.35);
    const parts = [];
    for (const k of [1, 1.47, 2.09, 2.76]) { const o = ctx.createOscillator(); o.frequency.value = base * k; const pg = gain(1 / k); o.connect(pg).connect(g); o.start(s); o.stop(s + 0.48); parts.push(o, pg); }
    cleanup(parts[0], [...parts, g, p]); C.clinks++;
  }
  function laugh(pan, vol) {
    const o = ctx.createOscillator(), b1 = filt('bandpass', rnd(750, 950), 4), b2 = filt('bandpass', 1300, 5), g = gain(0), p = out(pan), m = gain(1);
    o.type = 'sawtooth';
    o.connect(b1).connect(m); o.connect(b2).connect(m); m.connect(g).connect(p);
    const s = t0(), n = 4 + (Math.random() * 4 | 0), per = rnd(0.12, 0.17), f0 = rnd(170, 260);
    for (let i = 0; i < n; i++) {
      const ts = s + i * per, k = 1 - i / (n + 2);
      o.frequency.setValueAtTime(f0 * (1 + 0.1 * k), ts); o.frequency.linearRampToValueAtTime(f0 * 0.85 * k + f0 * 0.15, ts + per * 0.7);
      g.gain.setValueAtTime(0, ts); g.gain.linearRampToValueAtTime(vol * k, ts + 0.02); g.gain.linearRampToValueAtTime(0, ts + per * 0.65);
    }
    o.start(s); o.stop(s + n * per + 0.05); cleanup(o, [o, b1, b2, m, g, p]); C.laughs++;
  }
  /* 발소리: 표면별 잡음 조각 + (딱딱한 곳은) 낮은 쿵 */
  const STEP = {   // [필터 종류, Hz, Q, 길이, 음량, 쿵 Hz(0=없음), 바스락 조각 수]
    grass: ['bandpass', 1700, 0.6, 0.11, 1.4, 0, 1],
    leaves: ['highpass', 2300, 0.7, 0.16, 0.8, 0, 3],
    dirt: ['bandpass', 650, 1.1, 0.08, 1.1, 85, 1],
    road: ['bandpass', 1300, 1.8, 0.05, 1.1, 120, 1],
    wood: ['bandpass', 420, 2.5, 0.09, 1.2, 165, 1],
    snow: ['bandpass', 1500, 0.8, 0.22, 1.9, 0, 4],
  };
  function step(surface, vol, pan = 0, muffle = false) {
    const S = STEP[surface] || STEP.grass;
    const s = t0(), src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = filt(S[0], S[1] * rnd(0.85, 1.15), S[2]), g = gain(0), p = out(pan);
    let last = f;
    const nodes = [src, f, g, p];
    if (muffle) { const lp = filt('lowpass', 700, 0.7); f.connect(lp); last = lp; nodes.push(lp); }
    src.connect(f); last.connect(g).connect(p);
    const d = S[3] * rnd(0.85, 1.2), v = vol * S[4];
    if (S[6] > 1) {   // 사각사각 — 작은 조각 여러 개
      for (let i = 0; i < S[6]; i++) { const ts = s + (d / S[6]) * i; g.gain.setValueAtTime(v * rnd(0.4, 1), ts); g.gain.linearRampToValueAtTime(v * 0.15, ts + d / S[6] * 0.8); }
      g.gain.linearRampToValueAtTime(0, s + d);
    } else { g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(v, s + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, s + d); }
    src.start(s, Math.random() * 1.8); src.stop(s + d + 0.02);
    if (S[5] && !muffle) {
      const o = ctx.createOscillator(), og = gain(0); o.frequency.setValueAtTime(S[5] * 1.6, s); o.frequency.exponentialRampToValueAtTime(S[5], s + 0.06);
      og.gain.setValueAtTime(v * 0.9, s); og.gain.exponentialRampToValueAtTime(0.0005, s + 0.1);
      o.connect(og).connect(p); o.start(s); o.stop(s + 0.12); nodes.push(o, og);
    }
    cleanup(src, nodes);
  }
  /* 말발굽 한 번: 딱(높은 띠 잡음) + 쿵 */
  function clop(surface, vol, delay) {
    const soft = surface === 'snow' || surface === 'grass' || surface === 'leaves';
    const s = t0(delay), src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = filt('bandpass', soft ? 700 : rnd(1300, 1800), soft ? 1 : 3), g = gain(0), p = out(0);
    src.connect(f).connect(g).connect(p);
    g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(vol * (soft ? 0.7 : 1.2), s + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, s + (soft ? 0.09 : 0.05));
    src.start(s, Math.random() * 1.8); src.stop(s + 0.1);
    const o = ctx.createOscillator(), og = gain(0);
    o.frequency.setValueAtTime(soft ? 150 : 210, s); o.frequency.exponentialRampToValueAtTime(soft ? 70 : 95, s + 0.07);
    og.gain.setValueAtTime(vol * 1.1, s); og.gain.exponentialRampToValueAtTime(0.0005, s + 0.1);
    o.connect(og).connect(p); o.start(s); o.stop(s + 0.12);
    cleanup(src, [src, f, g, p]); cleanup(o, [o, og]);
    C.hooves++;
  }

  /* ── 위치 도우미 ── */
  const panTo = (x, z) => {   // 카메라 기준 좌우 (-1..1)
    const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz) || 1;
    return 0.85 * (dx * rx + dz * rz) / d;
  };
  const streamZ = x => (stream ? stream.z - stream.amp * Math.sin(stream.k * x) : 0);   // EX_Water 메시 중심선과 맞춤
  function streamDist() {
    if (getStream) { const r = getStream(px, pz); return typeof r === 'number' ? r : Infinity; }
    if (!stream) return Infinity;
    return Math.max(0, Math.abs(pz - streamZ(px)) - 2.5);
  }
  function surfaceAt(x, z, season) {
    if (getSurface) return getSurface(x, z) || 'grass';
    if (season === 'winter') {
      if (bridge && pathX && z > bridge.z0 && z < bridge.z1 && Math.abs(x - pathX(z)) < bridge.halfW) return 'road';
      return 'snow';
    }
    for (const p of getPonds() || []) if (Math.hypot(x - p.x, z - p.z) < p.r - 0.3) return 'wood';   // 물 위면 선착장
    if (pathX) {
      const off = Math.abs(x - pathX(z));
      if (bridge && z > bridge.z0 && z < bridge.z1 && off < bridge.halfW) return 'road';   // 돌다리
      if (off < roadHalf) return 'dirt';
    }
    return season === 'autumn' ? 'leaves' : 'grass';
  }

  /* ── 매 프레임 ── */
  function shouldPlay() {
    return !muted && isVisible() && !(typeof document !== 'undefined' && document.hidden);
  }
  function set(name, v) {   // 층 목표 음량 (0..1) → 실제 gain
    const l = L[name]; if (!l) return;
    l.v = v;
    const real = soloName && soloName !== name ? 0 : v * LV[name];
    l.level.gain.setTargetAtTime(real, ctx.currentTime, 0.35);
  }

  function update(dt, t = 0) {
    if (!ctx) return;
    const play = shouldPlay();
    /* 숨김이면 0 으로 내리고, 잠시 뒤 AudioContext 를 멈춰 CPU 를 쉰다 */
    masterTarget = play ? BASE * volume * (isMusicOn() ? DUCK : 1) : 0;
    master.gain.setTargetAtTime(masterTarget, ctx.currentTime, play ? 0.6 : 0.08);
    if (!play) {
      hiddenFor += dt;
      if (hiddenFor > 0.6 && !suspended && ctx.state === 'running') { suspended = true; ctx.suspend().catch(() => {}); }
      return;
    }
    hiddenFor = 0;
    if (suspended || ctx.state === 'suspended') { suspended = false; ctx.resume().catch(() => {}); }
    if (ctx.state !== 'running') return;

    const pp = getPlayerPos && getPlayerPos();
    if (!pp || !Number.isFinite(pp.x) || !Number.isFinite(pp.z)) return;
    px = pp.x; pz = pp.z;
    const cam = getCamera();
    if (cam && cam.matrixWorld) { const e = cam.matrixWorld.elements, l = Math.hypot(e[0], e[2]) || 1; rx = e[0] / l; rz = e[2] / l; }
    const night = clamp01(getNight() || 0), day = 1 - night, season = getSeason() || 'autumn', winter = season === 'winter';
    const weather = getWeather ? getWeather() : null;

    /* 발소리·말발굽 — 매 프레임 박자 계산 (숫자만) */
    const mv = isMoving() || {}, spd = Math.abs(mv.speed || 0), mode = mv.mode || 'onfoot';
    if (mode !== lastMode) { lastMode = mode; timers.step = timers.hoof = 0.05; }
    const walking = mode === 'onfoot' && onFoot();
    if (walking && spd > 0.6) {
      timers.step -= dt;
      if (timers.step <= 0) {
        timers.step = 1 / (1.2 + spd * 0.2);
        near.surface = surfaceAt(px, pz, season);
        step(near.surface, 0.07 * (0.7 + Math.min(1, spd / 9) * 0.5), (C.steps & 1) ? 0.08 : -0.08);
        C.steps++;
      }
    } else timers.step = Math.min(timers.step, 0.08);
    const hooved = mode === 'horse' || mode === 'carriage';
    if (hooved && spd > 0.8) {
      timers.hoof -= dt;
      if (timers.hoof <= 0) {
        const sf = surfaceAt(px, pz, season); near.surface = sf;
        if (spd > 8 && mode === 'horse') {   // 질주: 따-따-닥
          const cyc = Math.max(0.36, 0.62 - spd * 0.018); timers.hoof = cyc;
          clop(sf, 0.09, 0); clop(sf, 0.08, cyc * 0.17); clop(sf, 0.1, cyc * 0.33);
        } else {                             // 속보: 따각 따각
          const cyc = Math.max(0.4, 0.8 - spd * 0.04); timers.hoof = cyc;
          clop(sf, 0.08, 0); clop(sf, 0.08, cyc * 0.5);
        }
      }
    }

    /* 우연한 소리 — 타이머만 세고, 때가 되면 노드 몇 개 */
    const birdRate = day * day * (BIRD_SEASON[season] ?? 1) * (weather === 'rain' || weather === 'storm' ? 0.2 : 1);
    timers.bird -= dt * birdRate;
    if (timers.bird <= 0) {
      timers.bird = rnd(1.2, 4.5);
      const dist = rnd(6, 30);
      bird(rnd(-0.9, 0.9), 0.08 * Math.min(1, 9 / dist) * (winter ? 0.7 : 1));
    }
    if (night > 0.6) {
      timers.owl -= dt;
      if (timers.owl <= 0) { timers.owl = rnd(18, 45); owl(rnd(-0.8, 0.8), 0.07 * rnd(0.5, 1)); }
    }

    /* 거리·이웃 — 초당 2번 */
    timers.crowd -= dt;
    if (timers.crowd <= 0) {
      timers.crowd = 0.5;
      let best = Infinity, bx = 0, bz = 0;
      for (const s of getStalls() || []) { const d = Math.hypot(s.x - px, s.z - pz); if (d < best) { best = d; bx = s.x; bz = s.z; } }
      near.stall = best; near.stallX = bx; near.stallZ = bz;
      let pb = Infinity, pbx = 0, pbz = 0;
      for (const p of getPonds() || []) { const d = Math.max(0, Math.hypot(p.x - px, p.z - pz) - p.r); if (d < pb) { pb = d; pbx = p.x; pbz = p.z; } }
      near.pond = pb; near.pondX = pbx; near.pondZ = pbz;
      near.stream = streamDist();
      let cnt = 0;
      const api = getNpcs(), list = api && api.npcs;
      if (list) for (let i = 0; i < list.length; i++) { const n = list[i]; if (n && Math.abs(n.x - px) < 15 && Math.abs(n.z - pz) < 15 && (n.x - px) ** 2 + (n.z - pz) ** 2 < 225) cnt++; }
      near.crowd = Math.min(1, cnt / 8);
    }
    const tav = Math.max(clamp01(1 - (near.stall - 3) / 32) ** 2, near.crowd * 0.45) * (0.65 + 0.45 * night);
    if (tav > 0.08) {
      timers.clink -= dt * tav;
      if (timers.clink <= 0) { timers.clink = rnd(0.8, 2.6); clink(panTo(near.stallX, near.stallZ) + rnd(-0.3, 0.3), 0.024 * tav); }
      timers.laugh -= dt * tav;
      if (timers.laugh <= 0) { timers.laugh = rnd(4, 11); laugh(panTo(near.stallX, near.stallZ) + rnd(-0.4, 0.4), 0.1 * tav); }
    }
    const frogK = winter ? 0 : clamp01((night - 0.35) / 0.4) * clamp01(1 - near.pond / 28) * (season === 'autumn' ? 0.6 : 1);
    if (frogK > 0.05) {
      timers.frog -= dt * frogK;
      if (timers.frog <= 0) { timers.frog = rnd(0.25, 1.4); frog(panTo(near.pondX, near.pondZ) + rnd(-0.3, 0.3), 0.06 * frogK); }
    }

    /* 지속 층 음량 — 초당 10번 */
    timers.param -= dt;
    if (timers.param > 0) return;
    timers.param = 0.1;
    const gust = 0.5 + 0.3 * Math.sin(t * 0.21) + 0.2 * Math.sin(t * 0.53 + 1.3);
    const camY = cam ? cam.position.y : 0, high = clamp01((camY - 8) / 25);
    const storm = weather === 'storm' || weather === 'wind' ? 1 : 0;
    const wind = clamp01((0.25 + (winter ? 0.35 : 0) + high * 0.4 + storm * 0.4) * (0.55 + 0.45 * gust));
    set('wind', wind);
    if (L.wind.extra) L.wind.extra.frequency.setTargetAtTime(220 + 600 * gust * (0.6 + wind), ctx.currentTime, 0.4);
    set('leaves', 0);   // 낙엽 바스락도 모래 흔드는 소리처럼 들려서 뺐다 (사용자 요청)
    const sk = clamp01(1 - near.stream / 30) ** 2 * (winter ? 0.5 : 1);   // 겨울엔 살얼음
    set('stream', sk);
    if (L.stream.pan) L.stream.pan.pan.setTargetAtTime(panTo(px, streamZ(px)), ctx.currentTime, 0.2);
    set('tavern', clamp01(tav));
    if (L.tavern.pan) L.tavern.pan.pan.setTargetAtTime(near.stall < 4 ? 0 : panTo(near.stallX, near.stallZ) * 0.7, ctx.currentTime, 0.3);
    set('crickets', 0);   // 귀뚜라미는 셰이커처럼 들려서 뺐다 (사용자 요청)
    const eng = ENGINE[mode];
    if (eng) {
      const e = L.engine.extra, f = eng[0] + spd * eng[1];
      e.o1.frequency.setTargetAtTime(f, ctx.currentTime, 0.15); e.o2.frequency.setTargetAtTime(f / 2, ctx.currentTime, 0.15);
      e.lp.frequency.setTargetAtTime(240 + spd * 18, ctx.currentTime, 0.2);
      set('engine', (0.5 + clamp01(spd / 20) * 0.5) * eng[2]);
    } else set('engine', 0);
    set('cart', mode === 'carriage' ? clamp01(spd / 6) : mode === 'bicycle' ? clamp01(spd / 8) * 0.35 : 0);
  }

  /* ── 사용자 조작 → AudioContext 시작 ── */
  function unlock() {
    if (failed) return;
    init();
    if (ctx && ctx.state === 'suspended' && shouldPlay()) { suspended = false; ctx.resume().catch(() => {}); }
  }
  const onVis = () => {
    if (!ctx) return;
    if (document.hidden) { master.gain.setTargetAtTime(0, ctx.currentTime, 0.05); if (ctx.state === 'running') { suspended = true; ctx.suspend().catch(() => {}); } }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', onVis);
    /* 첫 화면 뒤에 늦게 만들어지므로, 그 전에 이미 클릭·키 입력이 있었다면(인트로 등) 바로 시작한다 */
    if (navigator.userActivation && navigator.userActivation.hasBeenActive) setTimeout(unlock, 0);
  }

  /* ── 음악 버튼 옆 작은 스피커 버튼 ── */
  let btn = null, styleEl = null;
  const ICON_ON = '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>';
  const ICON_OFF = '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/>';
  function renderBtn() {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(!muted));
    btn.setAttribute('aria-label', muted ? '주변 소리 꺼짐' : '주변 소리 켜짐');
    btn.querySelector('svg').innerHTML = muted ? ICON_OFF : ICON_ON;
  }
  function makeButton() {
    if (typeof document === 'undefined') return;
    const music = document.getElementById('g-music-btn');
    if (!music || document.getElementById('g-amb-btn')) return;
    styleEl = document.createElement('style');
    styleEl.textContent = '.g-amb-btn{padding-left:10px;padding-right:10px}';
    document.head.appendChild(styleEl);
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'g-amb-btn'; btn.className = 'g-btn g-music-btn g-amb-btn';
    btn.title = '주변 소리 켜기/끄기 — 새·개울·선술집·발소리';
    btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"></svg>';
    btn.addEventListener('click', e => { e.stopPropagation(); setMuted(!muted); btn.blur(); });
    music.after(btn);
    renderBtn();
  }
  if (button) makeButton();

  function setMuted(b) {
    muted = !!b;
    try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch { /* */ }
    renderBtn();
    if (!muted) unlock();
  }
  function setVolume(v) {
    volume = clamp01(+v || 0);
    try { localStorage.setItem(KEY + '.vol', String(volume)); } catch { /* */ }
  }
  /* 특별한 순간의 발소리 한 번 (surface 생략 = 발밑) */
  function footstep(surface) {
    if (!ctx || ctx.state !== 'running' || !shouldPlay()) return;
    step(surface || surfaceAt(px, pz, getSeason() || 'autumn'), 0.08);
    C.steps++;
  }
  function dispose() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      document.removeEventListener('visibilitychange', onVis);
    }
    if (btn) btn.remove(); if (styleEl) styleEl.remove(); btn = styleEl = null;
    if (ctx) ctx.close().catch(() => {});
    ctx = null; failed = true;
    if (debug && globalThis.__audio === api) delete globalThis.__audio;
  }
  const r2 = v => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
  function state() {
    const layers = {};
    for (const k in L) layers[k] = r2(L[k].v);
    return {
      ctx: ctx ? ctx.state : (failed ? 'unavailable' : 'waiting-for-gesture'),
      muted, volume, playing: shouldPlay(), musicOn: isMusicOn(), master: ctx ? r2(master.gain.value) : 0, masterTarget: r2(masterTarget),
      layers, active: Object.keys(layers).filter(k => layers[k] > 0.02),
      near: { stall: r2(near.stall), pond: r2(near.pond), stream: r2(near.stream), crowd: r2(near.crowd), surface: near.surface },
      counts: { ...C }, mode: lastMode, pos: { x: r2(px), z: r2(pz) },
    };
  }

  const api = {
    update, setMuted, setVolume, footstep, dispose, state,
    get muted() { return muted; }, get volume() { return volume; },
  };
  if (debug) {
    api._dbg = {
      get ctx() { return ctx; },
      solo(name = null) { soloName = name; timers.param = 0; },
      /* 루프를 멈춘 상태에서 한 층만 최대(v=1)로, 마스터는 BASE — 음량 맞추기용 */
      force(name) { if (!ctx) return; for (const k in L) L[k].level.gain.value = k === name ? LV[k] : 0; master.gain.value = BASE; },
      /* 출력 RMS(dBFS) — 층 음량 맞추기용 */
      meter(ms = 600) {   // ms 동안 20ms 마다 재서 평균 RMS(dBFS)·최대 피크
        if (!ctx) return Promise.resolve(null);
        const an = ctx.createAnalyser(); an.fftSize = 1024; comp.connect(an);
        const buf = new Float32Array(an.fftSize);
        let sum = 0, cnt = 0, pk = 0;
        return new Promise(res => {
          const id = setInterval(() => {
            an.getFloatTimeDomainData(buf);
            for (const v of buf) { sum += v * v; pk = Math.max(pk, Math.abs(v)); } cnt += buf.length;
          }, 20);
          setTimeout(() => {
            clearInterval(id); an.disconnect();
            res({ rmsDb: +(10 * Math.log10(sum / Math.max(1, cnt) + 1e-12)).toFixed(1), peak: +pk.toFixed(3) });
          }, ms);
        });
      },
      fire: {
        bird: () => ctx && bird(0, 0.05), owl: () => ctx && owl(0, 0.07), frog: () => ctx && frog(0, 0.06),
        clink: () => ctx && clink(0, 0.035), laugh: () => ctx && laugh(0, 0.05), clop: s => ctx && clop(s || 'dirt', 0.09, 0),
      },
    };
    globalThis.__audio = api;
  }
  return api;
}
