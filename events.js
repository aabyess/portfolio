/* ════════════════════════════════════════════════════════════════════
   events.js — GTA 처럼 굴러가는 마을 사건들 (npcs.js 위에서 돈다)
     ① 수배 ★ (1~5): 소란을 피우면 별이 오르고, ★2부터 경비병이 쫓아온다. 붙잡히면 onPlayerCaught().
     ② 술집 싸움: 2~4분마다 손님 둘이 앉아 있는 가판대에서 둘이 일어나 주먹다짐(약 15초), 구경꾼이 모여 환호.
     ③ 음유시인 공연: 가끔 음유시인이 가판대 앞에서 류트를 연주(작은 WebAudio 멜로디), 관객이 반원으로 모였다 끝에 건배.

   ── portfolio.js 연결 (npcs 를 만든 .then 안에서) ──

        const { createEvents } = await import('./events.js');   // 또는 위쪽에서 미리 import
        ...
        }).then(n => {
          npcs = n;
          attachGrab(n, { ... });                               // (이미 있는 것)
          events = createEvents({
            THREE, npcs: n, camera, pathX,
            getPlayerPos: () => activePos(),
            isMusicOn: () => document.getElementById('g-music-btn')?.getAttribute('aria-pressed') === 'true',   // 배경음이 켜져 있으면 류트를 안 낸다
            isVisible: () => driveActive,                      // 문서 뷰에선 ★ 표시를 숨긴다
            onPlayerCaught: () => { ... },                     // 플레이어 넘어뜨리고 출발점으로 + toast('경비병에게 붙잡혔습니다!')
            onEvent: text => toast(text),                      // "○○ 선술집에서 싸움이 났어요!" 등
            stallNames: stations.map(s => s.name),             // 싸움 알림에 쓸 가판대 이름 (stalls 순서와 같다. 없으면 "3번")
          });
        });
      그리고 step(dt) 안 npcs.update 다음 줄:
        if (events) events.update(dt, t);
      (let events = null; 을 let npcs = null; 옆에 둔다)

   ── 무기·탱크 모듈이 부르는 것 ──
        events.notify('shot', pos)        // 사람 근처(15 m)에서 총을 쏘면 +1
        events.notify('explosion', pos)   // +3
        events.notify('weapon', pos)      // 무기로 사람을 맞혔을 때 +2 (npcs.knockDown(...,'shot') 을 부르면 자동으로 +2 되므로 보통 불필요)
      주먹(+1), 넘어뜨리기(+2), 던지기(+2), 차로 치기(+2) 는 npcs.js 가 알아서 알려 준다.

   ── 그 밖의 API ──
        events.stars                 현재 별 수 (0~5)
        events.setStars(n)           디버그/치트
        events.triggerFight(si?)     당장 싸움 (가판대 번호, 없으면 아무 데나)
        events.triggerBard(si?)      당장 공연
        events.dispose()
      콘솔: __events.stars, __events.setStars(3), __events.fight(), __events.bard()
   ════════════════════════════════════════════════════════════════════ */

const AGG = { punch: 1, knockdown: 2, weapon: 2, shot: 1, explosion: 3, car: 2, throw: 2 };
const STAR_AT = [1, 4, 8, 13, 20];       // 점수 → 별 1~5
const GUARDS_BY_STAR = [0, 0, 2, 3, 4, 4];
const HIDE_R = 30, DECAY_T = 20;         // 경비병 모두에게서 30 m 밖에 20초 있으면 별 하나 내려간다
const FIGHT_EVERY = [120, 240], BARD_EVERY = [90, 180];
const LUTE_R = 28, LUTE_VOL = 0.11;

export function createEvents({
  THREE, npcs, camera = null, pathX = z => 0,
  getPlayerPos, isDriving = () => false, isMusicOn = () => false, isVisible = () => document.body.dataset.view !== 'doc',
  onPlayerCaught = null, onEvent = null, stallNames = null,
  parent = null, debug = true,
} = {}) {
  if (!npcs || !npcs.spawnGuard) return { update() {}, notify() {}, dispose() {}, stars: 0 };
  const rr = (a, b) => a + (b - a) * Math.random();

  /* ── 수배 ── */
  let score = 0, stars = 0, hiddenT = 0, spawnT = 0, caughtCD = 0;
  const starsOf = sc => { let k = 0; while (k < 5 && sc >= STAR_AT[k]) k++; return k; };
  function add(pts) {
    if (!pts || caughtCD > 0) return;
    score += pts;
    const ns = starsOf(score);
    if (ns > stars) { stars = ns; flash(); }
    hiddenT = 0;
  }
  npcs.onAggression = kind => add(AGG[kind] || 0);
  npcs.onGuardCatch = () => {
    if (caughtCD > 0) return;
    caughtCD = 3;
    score = 0; stars = 0; hiddenT = 0;
    npcs.setGuardChase(false);
    if (onPlayerCaught) onPlayerCaught();
  };
  npcs.onNpcEvent = (kind) => {
    if (kind === 'bard' && onEvent) onEvent('음유시인이 노래를 시작했어요');
  };

  /* ── ★ 표시 (위 가운데, 나무판 + 금별) ── */
  const hud = document.createElement('div');
  hud.id = 'g-wanted';
  Object.assign(hud.style, {
    position: 'fixed', left: '50%', top: '12px', transform: 'translateX(-50%)', zIndex: 45, pointerEvents: 'none',
    padding: '5px 14px 6px', borderRadius: '10px', display: 'none', whiteSpace: 'nowrap',
    background: 'linear-gradient(#5a3a22, #3b2414)', border: '2px solid #c9a24a',
    boxShadow: '0 4px 14px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,220,150,.25)',
    font: '700 22px/1 "Times New Roman", Georgia, serif', letterSpacing: '3px', color: '#5b4630',
    transition: 'transform .18s',
  });
  const starEls = [];
  for (let i = 0; i < 5; i++) {
    const sp = document.createElement('span');
    sp.textContent = '★';
    hud.appendChild(sp); starEls.push(sp);
  }
  (parent || document.getElementById('drive-root') || document.body).appendChild(hud);
  let shownStars = -1, shownVis = null;
  function renderHud() {
    const vis = stars > 0 && isVisible();
    if (vis !== shownVis) { hud.style.display = vis ? 'block' : 'none'; shownVis = vis; }
    if (stars === shownStars) return;
    shownStars = stars;
    for (let i = 0; i < 5; i++) {
      const on = i < stars;
      starEls[i].style.color = on ? '#ffd257' : '#6b5238';
      starEls[i].style.textShadow = on ? '0 0 6px rgba(255,190,60,.8), 0 1px 0 #7a4a10' : 'none';
    }
  }
  let flashT = 0;
  function flash() { flashT = 0.35; hud.style.transform = 'translateX(-50%) scale(1.18)'; }

  /* ── 경비병 소환 위치: 카메라 뒤쪽 길 위, 플레이어에서 26~34 m ── */
  const fwd = camera ? new THREE.Vector3() : null;
  function spawnOne(p) {
    let fx = 0, fz = 1;
    if (camera) { camera.getWorldDirection(fwd); const l = Math.hypot(fwd.x, fwd.z) || 1; fx = fwd.x / l; fz = fwd.z / l; }
    const b = npcs.bounds;
    for (let tries = 0; tries < 6; tries++) {
      const sgn = (tries % 2 ? -1 : 1) * Math.sign(fz || 1);   // 카메라가 보는 쪽 반대(뒤) 먼저
      let z = p.z - sgn * rr(26, 34);
      z = Math.max(b.minZ + 3, Math.min(b.maxZ - 3, z));
      const x = pathX(z) + (Math.random() < 0.5 ? -1 : 1) * rr(1, 3);
      const dx = x - p.x, dz = z - p.z;
      if (camera && (dx * fx + dz * fz) > 0 && tries < 4) continue;   // 화면 앞이면 다른 쪽
      return npcs.spawnGuard(x, z, Math.atan2(-dx, -dz));
    }
    return null;
  }

  /* ── 술집 싸움 · 공연 일정 ── */
  let fightClock = rr(FIGHT_EVERY[0], FIGHT_EVERY[1]), bardClock = rr(BARD_EVERY[0], BARD_EVERY[1]);
  const nameOf = si => (stallNames && stallNames[si]) || `${si + 1}번`;
  function triggerFight(si = -1) {
    const k = npcs.startFight(si);
    if (k >= 0 && onEvent) onEvent(`${nameOf(k)} 선술집에서 싸움이 났어요!`);
    return k;
  }
  function triggerBard(si = -1) { return npcs.startBard(si); }

  /* ── 류트 (WebAudio 로 그때그때 튕긴다. 음 하나당 노드 몇 개 — 프레임마다가 아니라 음마다) ── */
  let ctx = null, master = null, panner = null, nextNote = 0, noteI = 0, resuming = false;
  const D4 = 293.66;
  /* D 도리안 선율 (반음 수, 길이 박) — 중세풍 */
  const MEL = [[0, 1], [3, 1], [5, 1], [7, 2], [5, 1], [3, 1], [5, 1], [0, 2], [-2, 1], [0, 1], [3, 1], [5, 2],
    [7, 1], [10, 1], [7, 1], [5, 1], [3, 1], [5, 1], [0, 3]];
  const BEAT = 0.26;
  function ensureAudio() {
    if (ctx) return ctx.state !== 'closed';
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0;
      panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) { master.connect(panner); panner.connect(ctx.destination); } else master.connect(ctx.destination);
    } catch { ctx = null; return false; }
    return true;
  }
  function pluck(freq, when, dur) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = 'triangle'; o1.frequency.value = freq;
    o2.type = 'square'; o2.frequency.value = freq * 2.003;
    const g2 = ctx.createGain(); g2.gain.value = 0.12;
    f.type = 'lowpass'; f.frequency.setValueAtTime(3200, when); f.frequency.exponentialRampToValueAtTime(700, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.9, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(master);
    o1.start(when); o2.start(when); o1.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
  }
  function luteUpdate(p) {
    const b = npcs.bard;
    const want = b.active && b.playing && !isMusicOn() && isVisible();
    if (!want) { if (master) master.gain.value = 0; nextNote = 0; return; }
    const bn = b.n, d = Math.hypot(bn.x - p.x, bn.z - p.z);
    const vol = LUTE_VOL * Math.max(0, 1 - d / LUTE_R);
    if (vol <= 0.001) { if (master) master.gain.value = 0; nextNote = 0; return; }
    if (!ensureAudio()) return;
    if (ctx.state === 'suspended' && !resuming) { resuming = true; ctx.resume().catch(() => {}).finally(() => { resuming = false; }); }
    master.gain.value = vol;
    if (panner && camera) {
      camera.getWorldDirection(fwd);
      /* 카메라 오른쪽 = (−fz, fx) */
      const rx = -fwd.z, rz = fwd.x, rl = Math.hypot(rx, rz) || 1, dx = bn.x - camera.position.x, dz = bn.z - camera.position.z, dl = Math.hypot(dx, dz) || 1;
      panner.pan.value = Math.max(-0.8, Math.min(0.8, (dx * rx + dz * rz) / (rl * dl)));
    }
    const now = ctx.currentTime;
    if (nextNote < now) nextNote = now + 0.05;
    while (nextNote < now + 0.2) {
      const [semi, beats] = MEL[noteI % MEL.length];
      const f = D4 * Math.pow(2, semi / 12);
      pluck(f, nextNote, Math.min(1.2, beats * BEAT * 2.2));
      if (beats >= 2) pluck(f / 2, nextNote, beats * BEAT * 2);   // 긴 음엔 낮은 줄도
      nextNote += beats * BEAT; noteI++;
    }
  }

  /* ── 매 프레임 ── */
  function update(dt) {
    if (!(dt > 0)) return;
    const p = getPlayerPos();
    if (caughtCD > 0) caughtCD -= dt;

    /* 경비병 수 맞추기 */
    const want = GUARDS_BY_STAR[stars];
    npcs.setGuardChase(want > 0 && caughtCD <= 0);
    const gi = npcs.guardInfo();
    if (want > gi.count && caughtCD <= 0) {
      spawnT -= dt;
      if (spawnT <= 0) { spawnT = 1.5; spawnOne(p); }
    }
    /* 숨기: 경비병 모두에게서 30 m 밖이면 시간이 쌓이고, 20초마다 별 하나 */
    if (stars > 0) {
      if (gi.count === 0 || gi.nearest > HIDE_R) hiddenT += dt; else hiddenT = 0;
      if (hiddenT >= DECAY_T) {
        hiddenT = 0; stars--;
        score = stars > 0 ? STAR_AT[stars - 1] : 0;
      }
    }
    if (flashT > 0) { flashT -= dt; if (flashT <= 0) hud.style.transform = 'translateX(-50%)'; }
    renderHud();

    /* 일정 */
    fightClock -= dt;
    if (fightClock <= 0) { fightClock = triggerFight() >= 0 ? rr(FIGHT_EVERY[0], FIGHT_EVERY[1]) : 20; }
    bardClock -= dt;
    if (bardClock <= 0) { bardClock = triggerBard() >= 0 ? rr(BARD_EVERY[0], BARD_EVERY[1]) : 25; }

    luteUpdate(p);
  }

  /* 무기·폭발 알림 (사람 근처일 때만 점수) */
  function notify(kind, pos) {
    if (kind === 'shot' || kind === 'explosion') {
      const r = kind === 'explosion' ? 32 : 15;
      const L = npcs.list();
      let near = false;
      for (const o of L) if (!o.off && !o.guard && Math.hypot(o.pos.x - pos.x, o.pos.z - pos.z) < r) { near = true; break; }
      if (!near) return;
    }
    add(AGG[kind] || 0);
  }

  function setStars(n) {
    stars = Math.max(0, Math.min(5, n | 0));
    score = stars > 0 ? STAR_AT[stars - 1] : 0; hiddenT = 0;
  }
  function dispose() {
    hud.remove();
    npcs.onAggression = npcs.onGuardCatch = npcs.onNpcEvent = null;
    if (ctx) ctx.close().catch(() => {});
    if (debug && globalThis.__events) delete globalThis.__events;
  }

  const api = {
    update, notify, setStars, triggerFight, triggerBard, dispose,
    get stars() { return stars; }, get score() { return score; },
  };
  if (debug) globalThis.__events = {
    get stars() { return stars; }, setStars, fight: triggerFight, bard: triggerBard,
    add: k => add(AGG[k] || 0),
    audio: () => ({ state: ctx ? ctx.state : 'none', notes: noteI, gain: master ? +master.gain.value.toFixed(3) : 0 }),
  };
  return api;
}
