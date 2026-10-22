/* ════════════════════════════════════════════════════════════════════
   village.js — 상호랜드 마을 행사 (임금님 최상호를 모시는 중세 마을)
     ① 임금님 행차: 4~6분마다 임금님(금관 + 빨간 망토)이 호위병 2~4명·깃발잡이와 큰길(x = pathX(z))을 따라
        플레이어 앞쪽 약 40 m 에서 뒤쪽 약 45 m 까지 걸어간다. 깃발잡이가 "임금님 납시오!".
        12 m 안 마을 사람은 멈춰서 임금님을 보고 환호하며 "임금님 만세!" "최상호 전하!".
        플레이어가 길가(임금님 4.5 m 안)에 서 있으면 임금님이 잠깐 멈춰 덕담을 한다.
        임금님을 때리거나 던지거나 치면 → onAggro('king') (수배 ★ 올리기) + 호위병이 8초 쫓아온다
        (붙잡히면 events.js 의 npcs.onGuardCatch 와 같은 길로 출발점에 돌아간다).
     ② 밤 축제 불꽃놀이: 밤(getNight() > 0.55)이면 가끔 마을 한가운데(center) 하늘에 불꽃이 터진다.
        점(Points) 하나에 입자 1200개를 돌려 쓴다(덧셈 혼합, HDR 색이라 블룸에 잘 잡힌다). 펑 소리는 WebAudio.
        근처(30 m) 사람들은 하늘을 보고 환호한다.
     ③ 닭 소동: 2.5~4.5분마다 플레이어 근처 가판대에서 닭 5~8마리가 도망친다. 술집 주인(농부)이 "내 닭!".
        걸어서 닭에 닿으면 잡힌다(0.9 m) → 가판대 옆 우리로 돌아가고 "닭 3/6 잡았다!". 다 잡으면 보상 알림.
        닭은 플레이어를 피해 지그재그로 도망가고, 가판대에서 22 m 넘게 못 간다(맵 경계 안). 2분 지나면 제 발로 돌아간다.
     ④ 소매치기: 2~3.5분마다 후드 쓴 도둑이 근처 행인을 툭 치고 지갑을 훔쳐 달아난다("도둑이야!").
        30초 안에 때려 넘어뜨리거나(주먹·무기·잡기·차, 이 도둑은 ★가 안 오른다) 몸으로 붙잡으면 지갑을 돌려준다.
        못 잡으면 도망친다.
   폭력은 만화처럼 넘어지는 정도(피 없음). 모든 사람 모델은 npcs.js 의 "배우" API(addActor 등)로 복제한다 →
   주먹·잡기·총·차에 맞는 판정이 npcs.js 와 똑같이 동작한다. 그래서 GLTFLoader 를 따로 넘길 필요가 없다.

   ── portfolio.js 연결 (npcs 를 만든 .then 안, events = createEvents({...}) 바로 다음) ──

        const { createVillage } = await import('./village.js');   // 또는 위쪽 import 묶음에
        ...
          village = createVillage({
            THREE, scene, camera, npcs: n, pathX, groundY,
            getPlayerPos: () => activePos(),
            isOnFoot: () => player.mode === 'onfoot',
            getNight: () => night,
            isVisible: () => driveActive,                                       // 문서 뷰에선 행사를 새로 시작하지 않는다
            onEvent: text => toast(text),
            onAggro: (kind) => { if (events) events.setStars(Math.max(events.stars, 3)); },   // 임금님을 건드리면 ★3
            bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
          });
      그리고 step(dt) 안 events.update 다음 줄 (반드시 npcs.update 뒤):
        if (village) village.update(dt, t);
      (let village = null; 을 let events = null; 옆에 둔다)

   ── 옵션 ──
     THREE, scene, npcs (createNPCs 반환값, addActor 가 있는 판), pathX(z), groundY(x, z)  — 필수
     camera            (지금은 안 씀, 나중 확장용)
     getPlayerPos()    → {x, z}. 걸을 땐 사람, 탈 땐 탈것 위치
     isOnFoot()        → 닭·도둑을 몸으로 잡는 건 걸을 때만 (기본 true)
     getNight()        → 0..1 (sky.night)
     isMusicOn()       → 배경음이 켜져 있으면 불꽃 소리를 조금 줄인다
     isMuted()         → true 면 불꽃·닭 소리를 안 낸다 (기본 false)
     isVisible()       → false 면 새 행사를 시작하지 않는다(진행 중인 건 계속)
     onEvent(text)     → 알림 (toast)
     onAggro(kind, pos)→ 'king' : 임금님(또는 호위병)을 건드렸다
     bounds            → {minX,maxX,minZ,maxZ} (없으면 npcs.bounds)
     center            → 불꽃놀이 자리 {x, z} (기본 마을 연못·가판대 사이 (0, 6))
     debug             → true 면 window.__village 디버그 (기본 true)

   ── 반환 API ──
     update(dt, t), dispose()
     triggerProcession(), triggerFireworks(sec = 25), triggerChickens(si?), triggerThief()
     state → { procession, fireworks, chickens: {caught, total}, thief }
   콘솔: __village.procession(), __village.fireworks(), __village.chickens(), __village.thief(), __village.state()
   ════════════════════════════════════════════════════════════════════ */

const PROC_EVERY = [240, 360], CHICK_EVERY = [150, 270], THIEF_EVERY = [120, 210];
const PROC_SPEED = 1.35, PRAISE_R = 12, KING_TALK_R = 4.5;
const FW_NIGHT = 0.55, FW_EVERY = [70, 130], FW_SHOW = 25, FW_MAX = 1200;
const CHICK_R = 22, CHICK_CATCH = 0.9, CHICK_TIME = 120;
const THIEF_TIME = 30, THIEF_CATCH = 1.2;

const PRAISE = ['임금님 만세!', '최상호 전하!', '전하 만세!', '성은이 망극하옵니다!', '임금님이다!', '와아, 임금님!'];
const KING_NICE = ['오, 백성이여! 반갑구나!', '오늘도 좋은 하루 보내거라!', '맥주는 짐이 사겠노라!', '그대 얼굴이 밝구나!', '상호랜드에 온 걸 환영하노라!'];
const KING_HURT = ['고얀 녀석 같으니!', '어허, 무엄하도다!', '짐의 왕관이…!'];
const GUARD_ANGRY = ['무엄하다!', '감히 임금님을!', '저놈을 잡아라!'];
const HERALD = ['임금님 납시오!', '길을 비켜라!', '임금님 행차시다!'];
const FW_CHEER = ['와아!', '멋지다!', '임금님 만세!', '예쁘다!', '우와~'];
const FW_COLORS = [[1, 0.78, 0.25], [1, 0.25, 0.2], [0.3, 0.85, 1], [1, 0.35, 0.85], [0.45, 1, 0.4], [1, 1, 1], [0.7, 0.45, 1]];

export function createVillage({
  THREE, scene, camera = null, npcs, pathX = () => 0, groundY = () => 0,
  getPlayerPos, isOnFoot = () => true, getNight = () => 0,
  isMusicOn = () => false, isMuted = () => false,
  isVisible = () => document.body.dataset.view !== 'doc',
  onEvent = null, onAggro = null, bounds = null, center = null, debug = true,
  gate = null,   // castle.js villageGate(0): 있으면 행차는 늘 성문으로 들어가 사라진다
} = {}) {
  if (!npcs || !npcs.addActor) return { update() {}, dispose() {}, state: {} };
  const B = bounds || npcs.bounds || { minX: -42, maxX: 42, minZ: -84, maxZ: 84 };
  const C = center || { x: 0, z: 6 };
  const stalls = npcs.stalls || [];
  const rr = (a, b) => a + (b - a) * Math.random();
  const pickOne = a => a[Math.floor(Math.random() * a.length)];
  const clampZ = z => Math.max(B.minZ + 4, Math.min(B.maxZ - 4, z));
  const clampX = x => Math.max(B.minX + 2, Math.min(B.maxX - 2, x));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const toast = t => { if (onEvent) onEvent(t); };
  const say = (n, t, life = 1.8, col = null) => { if (n && !n.off) npcs.say(n, t, life, col); };
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function turn(n, target, dt, rate = 5) {
    const d = wrap(target - n.rot), m = rate * dt;
    n.rot += Math.abs(d) <= m ? d : Math.sign(d) * m;
  }
  /* 사람 하나를 목표로 걷게 (배우 상태일 때만) → 도착하면 true */
  function stepTo(n, tx, tz, speed, dt, face = null) {
    const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
    if (d < 0.06) {
      npcs.actorPlay(n, 'Idle', 0.3);
      if (face !== null) turn(n, face, dt);
      return true;
    }
    const sp = Math.min(speed, d / dt);
    n.x += dx / d * sp * dt; n.z += dz / d * sp * dt;
    turn(n, Math.atan2(dx, dz), dt, 6);
    if (speed > 3.2 && n.actions.Run) npcs.actorPlay(n, 'Run', 0.25, Math.max(0.6, speed / 5));
    else npcs.actorPlay(n, 'Walk', 0.3, Math.max(0.5, Math.min(2.2, speed / 1.3)));
    return false;
  }
  /* 마을 사람 목록 (배우·경비병·술집 주인 제외) */
  function villagers() {
    const out = [];
    for (const o of npcs.list()) if (!o.off && !o.guard && !o.barkeeper && !o.npc.actor) out.push(o);
    return out;
  }

  const disposables = [];
  const keep = x => { disposables.push(x); return x; };

  /* ════ 소리 (WebAudio, 처음 소리 낼 때 만든다) ════ */
  let actx = null;
  function audio() {
    if (isMuted()) return null;
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx.state === 'closed' ? null : actx;
  }
  let noiseBuf = null;
  function noise(ctx) {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function popSound(x, z, big = 1) {
    const ctx = audio(); if (!ctx) return;
    const p = getPlayerPos();
    const d = Math.hypot(x - p.x, z - p.z) + 20;
    const vol = 0.32 * big * Math.max(0, 1 - d / 140) * (isMusicOn() ? 0.55 : 1);
    if (vol < 0.01) return;
    const t0 = ctx.currentTime + d / 340;                  // 멀면 소리가 늦게 온다
    const src = ctx.createBufferSource(); src.buffer = noise(ctx);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2600, t0); f.frequency.exponentialRampToValueAtTime(300, t0 + 0.9);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t0); src.stop(t0 + 1.05);
    const o = ctx.createOscillator(), og = ctx.createGain();   // 쿵
    o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.35);
    og.gain.setValueAtTime(vol * 1.2, t0); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    o.connect(og); og.connect(ctx.destination); o.start(t0); o.stop(t0 + 0.42);
    /* 지글지글 (터진 뒤 잔불) */
    const s2 = ctx.createBufferSource(); s2.buffer = noise(ctx);
    const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 5000;
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.0001, t0 + 0.25); g2.gain.linearRampToValueAtTime(vol * 0.25, t0 + 0.4); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);
    s2.connect(hf); hf.connect(g2); g2.connect(ctx.destination); s2.start(t0 + 0.25); s2.stop(t0 + 1.2);
  }
  function whistle(x, z) {
    const ctx = audio(); if (!ctx) return;
    const p = getPlayerPos(), d = Math.hypot(x - p.x, z - p.z);
    const vol = 0.05 * Math.max(0, 1 - d / 90) * (isMusicOn() ? 0.55 : 1);
    if (vol < 0.005) return;
    const t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(700, t0); o.frequency.exponentialRampToValueAtTime(2200, t0 + 1.0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
    o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + 1.05);
  }
  function bawk(x, z) {
    const ctx = audio(); if (!ctx) return;
    const p = getPlayerPos(), d = Math.hypot(x - p.x, z - p.z);
    const vol = 0.06 * Math.max(0, 1 - d / 25);
    if (vol < 0.005) return;
    const t0 = ctx.currentTime, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(520, t0); o.frequency.exponentialRampToValueAtTime(900, t0 + 0.06); o.frequency.exponentialRampToValueAtTime(420, t0 + 0.2);
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    o.connect(f); f.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + 0.25);
  }

  /* ════ 배우 꾸미기 ════ */
  function tintCloth(n, hex, re = /Cloth/i) {
    for (const m of n.meshes) {
      if (!m.material || !re.test(m.material.name || '')) continue;
      m.material = keep(m.material.clone());
      m.material.color.set(hex);
    }
  }
  const bone = (n, nm) => n.root.getObjectByName(nm) || n.root.getObjectByName(nm.replace('.', ''));
  const goldMat = keep(new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 0.9, roughness: 0.28, emissive: 0x3a2400, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
  const jewelMat = keep(new THREE.MeshStandardMaterial({ color: 0xe0103a, roughness: 0.2, emissive: 0x500010, emissiveIntensity: 0.8 }));
  const capeMat = keep(new THREE.MeshStandardMaterial({ color: 0xb3141e, roughness: 0.75, side: THREE.DoubleSide }));
  const ermineMat = keep(new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.95 }));
  const poleMat = keep(new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 }));
  const steelMat = keep(new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.85, roughness: 0.35 }));
  function makeCrown() {
    const g = new THREE.Group();
    const band = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.115, 0.108, 0.07, 14, 1, true)), goldMat);
    g.add(band);
    const spikeG = keep(new THREE.ConeGeometry(0.03, 0.085, 4)), ballG = keep(new THREE.SphereGeometry(0.018, 6, 4)), gemG = keep(new THREE.SphereGeometry(0.02, 6, 4));
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2;
      const sp = new THREE.Mesh(spikeG, goldMat); sp.position.set(Math.sin(a) * 0.105, 0.075, Math.cos(a) * 0.105); g.add(sp);
      const bl = new THREE.Mesh(ballG, goldMat); bl.position.set(Math.sin(a) * 0.105, 0.125, Math.cos(a) * 0.105); g.add(bl);
      const gm = new THREE.Mesh(gemG, jewelMat); gm.position.set(Math.sin(a + 0.52) * 0.113, 0, Math.cos(a + 0.52) * 0.113); gm.scale.set(1, 1, 0.5); gm.lookAt(0, 0, 0); g.add(gm);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  /* 망토: 어깨에서 등 뒤로 늘어진 휘어진 판 + 흰 털 깃 */
  const capeGeo = (() => {
    const geo = new THREE.PlaneGeometry(0.56, 1.1, 6, 8);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), u = (0.55 - y) / 1.1;   // 위 0 → 아래 1
      p.setX(i, x * (0.75 + u * 0.55));                             // 아래로 퍼진다
      p.setZ(i, -Math.cos(x / 0.3) * 0.06 - u * u * 0.08);              // 등을 감싸고 아래가 뒤로 뜬다
    }
    geo.computeVertexNormals();
    return keep(geo);
  })();
  function makeCape() {
    const pivot = new THREE.Group();
    const cape = new THREE.Mesh(capeGeo, capeMat); cape.position.y = -0.55; cape.castShadow = true;
    pivot.add(cape);
    const collar = new THREE.Mesh(keep(new THREE.TorusGeometry(0.16, 0.045, 6, 14)), ermineMat);
    collar.rotation.x = Math.PI / 2; collar.position.set(0, 0.0, 0.1); collar.scale.set(1, 0.85, 1);
    pivot.add(collar);
    return pivot;
  }
  function makeSpear() {
    const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.025, 0.03, 2.3, 6)), poleMat);
    const tip = new THREE.Mesh(keep(new THREE.ConeGeometry(0.06, 0.32, 4)), steelMat); tip.position.y = 1.3;
    pole.add(tip); pole.position.set(-0.36, 0.25, 0.12); pole.castShadow = true;
    return pole;
  }
  /* 깃발: 빨간 바탕 + 금관 + '최' */
  const flagTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 160;
    const c = cv.getContext('2d');
    c.fillStyle = '#a3121c'; c.fillRect(0, 0, 128, 160);
    c.strokeStyle = '#f0c44c'; c.lineWidth = 8; c.strokeRect(6, 6, 116, 148);
    c.fillStyle = '#f0c44c';
    c.beginPath(); c.moveTo(30, 62); c.lineTo(34, 30); c.lineTo(48, 48); c.lineTo(64, 24); c.lineTo(80, 48); c.lineTo(94, 30); c.lineTo(98, 62); c.closePath(); c.fill();
    c.font = '900 56px Pretendard, "Apple SD Gothic Neo", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('최', 64, 108);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return keep(t);
  })();
  const flagGeo = keep(new THREE.PlaneGeometry(0.8, 1.0, 8, 4));
  const flagBase = Float32Array.from(flagGeo.attributes.position.array);
  const flagMat = keep(new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }));
  function makeFlagPole() {
    const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.03, 0.035, 3.2, 6)), poleMat);
    pole.position.set(-0.36, 0.7, 0.15);
    const knob = new THREE.Mesh(keep(new THREE.SphereGeometry(0.07, 8, 6)), goldMat); knob.position.y = 1.65; pole.add(knob);
    const flag = new THREE.Mesh(flagGeo, flagMat); flag.position.set(0, 1.0, -0.42); flag.rotation.y = Math.PI / 2;
    pole.add(flag); pole.castShadow = flag.castShadow = true;
    return pole;
  }
  function waveFlag(t) {
    const p = flagGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = flagBase[i * 3], u = x + 0.4;   // 깃대 쪽 0
      p.setZ(i, Math.sin(t * 5 - u * 5) * 0.09 * u);
    }
    p.needsUpdate = true;
  }

  /* 배우들은 처음 쓸 때 한 번만 만들고 재사용한다 */
  let cast = null;
  function getCast() {
    if (cast) return cast;
    /* 진짜 임금님 모델(npc-king.glb: 금관·곤룡포·흰 털 망토 포함)이 있으면 그대로 쓴다.
       파일이 없으면 여관 주인을 자주색으로 물들이고 코드로 만든 금관·망토를 씌운다(예전 방식) */
    const king = npcs.addActor('npc-king', { fallback: 'innkeeper' });
    let crown = null, cape = null;
    if (!/king/.test(king.model || '')) {
      tintCloth(king, 0x9a3fb0);                        // 자주색 곤룡포 느낌
      const head = bone(king, 'Head'), chest = bone(king, 'Chest');
      crown = makeCrown(); crown.position.set(0, 0.22, 0.005); crown.rotation.x = -0.08;
      if (head) head.add(crown);
      cape = makeCape(); cape.position.set(0, 0.2, -0.13);
      if (chest) chest.add(cape);
    }
    const guards = [];
    for (let k = 0; k < 4; k++) { const g = npcs.addActor('guard'); g.body.add(makeSpear()); guards.push(g); }
    const flag = npcs.addActor('guard');
    tintCloth(flag, 0xf0d070);                          // 깃발잡이는 노란 옷
    flag.body.add(makeFlagPole());
    const thief = npcs.addActor('traveler', { noAggro: true });
    tintCloth(thief, 0x34343c);                         // 검은 후드
    const purse = new THREE.Mesh(keep(new THREE.SphereGeometry(0.075, 8, 6)), keep(new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 })));
    purse.scale.set(1, 1.2, 1); purse.position.set(0, -0.08, 0.03); purse.visible = false;
    const hand = bone(thief, 'Hand.R'); if (hand) hand.add(purse);
    cast = { king, cape, crown, guards, flag, thief, purse };
    return cast;
  }

  /* ════ ① 임금님 행차 ════ */
  const P = { active: false, d: 1, z: 0, zEnd: 0, members: [], hitCD: 0, wasActing: true, praiseT: 0, heraldT: 0,
    talkT: 0, talked: false, chaseT: 0, caught: false, hurtSay: false, endT: 0 };
  let procClock = rr(90, 150);
  function triggerProcession() {
    if (P.active) return false;
    const c = getCast();
    const p = getPlayerPos();
    /* 플레이어 앞 40 m 에서 시작해 뒤 45 m 까지. 맵 끝이면 방향을 바꾼다 */
    let d = p.z > 0 ? 1 : -1;                          // 가운데 쪽에서 출발해 끝 쪽으로 걸어오면 길게 보인다
    let z0 = clampZ(p.z - d * 40), z1 = clampZ(p.z + d * 45);
    if (Math.abs(z1 - z0) < 50) { d = -d; z0 = clampZ(p.z - d * 40); z1 = clampZ(p.z + d * 45); }
    d = Math.sign(z1 - z0) || 1;
    if (gate) {                                   // 늘 성문 쪽으로 걸어가 안으로 들어간다
      d = gate.entry.z < 0 ? -1 : 1;
      z1 = gate.entry.z;                          // 맵 끝 너머(성문 터널 안)까지 — 자르지 않는다
      z0 = clampZ(d < 0 ? Math.max(p.z + 30, gate.z + 45) : Math.min(p.z - 30, gate.z - 45));
    }
    Object.assign(P, { active: true, d, z: z0, zEnd: z1, hitCD: 0, wasActing: true, praiseT: 1, heraldT: 0, talkT: 0, talked: false,
      chaseT: 0, caught: false, hurtSay: false, endT: 0, gateOpened: false });
    const nG = 2 + Math.floor(Math.random() * 3);
    const slotsG = [[2.6, -1.15], [2.6, 1.15], [-2.2, -1.15], [-2.2, 1.15]];
    if (nG === 3) slotsG[2] = [-2.2, 0];
    P.members = [{ n: c.king, along: 0, side: 0, role: 'king' }, { n: c.flag, along: 4.6, side: 0, role: 'flag' }];
    for (let k = 0; k < nG; k++) P.members.push({ n: c.guards[k], along: slotsG[k][0], side: slotsG[k][1], role: 'guard' });
    const rot = Math.atan2(0, d);
    for (const m of P.members) {
      const z = P.z + d * m.along;
      npcs.actorOn(m.n, pathX(z) + m.side, z, rot);
    }
    say(c.flag, '임금님 납시오!', 2.5, '#7a1a10');
    toast('임금님 행차! "임금님 납시오!" — 큰길에서 최상호 전하를 맞이하세요');
    return true;
  }
  function endProcession() {
    let all = true;
    for (const m of P.members) if (!npcs.actorOff(m.n)) all = false;
    if (all) {
      P.active = false; P.members = [];
      if (gate) { gate.close(); if (P.gateOpened) toast('임금님이 상호성으로 들어가셨습니다'); P.gateOpened = false; }
    }
    return all;
  }
  function procUpdate(dt, t, p) {
    const c = cast, king = c.king;
    const kingOk = npcs.isActing(king);
    /* 임금님이 맞았다 (서 있다가 갑자기 대본에서 벗어남) */
    if (P.hitCD > 0) P.hitCD -= dt;
    let hitNow = false;
    if (P.wasActing && !kingOk && !king.off) hitNow = true;
    for (const m of P.members) {                       // 호위병·깃발잡이를 건드려도 화낸다
      if (m.role !== 'king' && m.wasActing && !npcs.isActing(m.n) && !m.n.off && P.chaseT <= 0) hitNow = true;
      m.wasActing = npcs.isActing(m.n);
    }
    if (hitNow && P.hitCD <= 0) {
      P.hitCD = 4; P.chaseT = 8; P.caught = false; P.hurtSay = true;
      if (onAggro) onAggro('king', { x: king.x, z: king.z });
      toast('무엄하다! 임금님 행차를 건드렸어요 — 호위병이 쫓아옵니다');
      for (const m of P.members) if (m.role === 'guard') say(m.n, pickOne(GUARD_ANGRY), 2, '#7a1a10');
      let k = 0;
      for (const o of villagers()) {
        if (k >= 4 || dist2(o.pos, king) > PRAISE_R) continue;
        if (npcs.watch(o.npc, king, rr(2, 3), false)) { if (k < 2) say(o.npc, pickOne(['무엄하다!', '임금님을!', '저런!']), 1.6); k++; }
      }
    }
    P.wasActing = kingOk;
    if (kingOk && P.hurtSay) { P.hurtSay = false; say(king, pickOne(KING_HURT), 2.2, '#5a1060'); }
    if (P.chaseT > 0) P.chaseT -= dt;

    /* 길가 플레이어에게 덕담 (한 번) */
    if (kingOk && !P.talked && P.chaseT <= 0 && P.talkT <= 0 && isOnFoot() && dist2(p, king) < KING_TALK_R) {
      P.talked = true; P.talkT = 3;
      const line = pickOne(KING_NICE);
      say(king, line, 3, '#5a1060');
      toast(`임금님: "${line}"`);
    }
    const talking = P.talkT > 0;
    if (talking) P.talkT -= dt;

    /* 행렬 진행: 임금님이 서 있고, 쫓는 중·덕담 중이 아니고, 모두 대열 근처일 때만 */
    let lag = 0;
    for (const m of P.members) {
      if (!npcs.isActing(m.n)) continue;
      const z = P.z + P.d * m.along;
      lag = Math.max(lag, Math.hypot(pathX(z) + m.side - m.n.x, z - m.n.z));
    }
    let moving = kingOk && P.chaseT <= 0 && !talking && lag < 2.5;
    if (gate) {
      if (!P.gateOpened && Math.abs(P.z - gate.z) < 24) { P.gateOpened = true; gate.open(); say(c.flag, '성문을 열어라!', 2.2, '#7a1a10'); }
      if (!gate.isOpen() && (P.z + P.d * 4.6 - gate.z) * P.d > -1.5) moving = false;   // 닫힌 문 앞에서 기수가 기다린다
    }
    if (moving) P.z += P.d * PROC_SPEED * dt;
    const zh = P.z, dpx = pathX(zh + 0.5 * P.d) - pathX(zh - 0.5 * P.d);
    const heading = Math.atan2(dpx, P.d);

    for (const m of P.members) {
      const n = m.n;
      if (!npcs.isActing(n)) continue;
      if (m.role === 'guard' && P.chaseT > 0 && !P.caught) {   // 호위병 추격
        const dd = dist2(n, p);
        stepTo(n, p.x, p.z, 5.2, dt);
        if (dd < 1.0 && isOnFoot()) {
          P.caught = true; P.chaseT = 0;
          say(n, '체포한다!', 2, '#7a1a10');
          if (npcs.onGuardCatch) npcs.onGuardCatch(n);
        }
        continue;
      }
      const z = P.z + P.d * m.along;
      let x = pathX(z) + m.side;
      /* 플레이어가 대열 자리에 서 있으면 옆으로 비켜 걷는다 (사람을 뚫고 지나가지 않게) */
      const bx = x - p.x;
      if (Math.abs(z - p.z) < 1.3 && Math.abs(bx) < 1.1) x = p.x + (bx >= 0 ? 1.1 : -1.1);
      const gap = Math.hypot(x - n.x, z - n.z);
      const sp = moving ? PROC_SPEED + Math.min(2.5, Math.max(0, gap - 0.15) * 1.6) : Math.min(4, 1 + gap * 1.5);
      if (gap > 0.08) stepTo(n, x, z, sp, dt);
      else {
        n.x = x; n.z = z;
        if (moving) npcs.actorPlay(n, 'Walk', 0.3, PROC_SPEED / 1.3);
        else npcs.actorPlay(n, 'Idle', 0.3);
        turn(n, m.role === 'king' && talking ? Math.atan2(p.x - n.x, p.z - n.z) : heading, dt, 4);
      }
    }
    /* 망토 펄럭임 · 깃발 */
    if (c.cape) c.cape.rotation.x = 0.04 + (moving ? 0.06 + Math.sin(t * 5.2) * 0.04 : Math.sin(t * 1.3) * 0.02);
    if (c.flag.dist < 45) waveFlag(t);

    /* 전령 외침 */
    P.heraldT -= dt;
    if (P.heraldT <= 0) { P.heraldT = rr(5, 8); if (npcs.isActing(c.flag)) say(c.flag, pickOne(HERALD), 2.2, '#7a1a10'); }
    /* 12 m 안 마을 사람: 멈춰서 임금님을 보고 환호 */
    P.praiseT -= dt;
    if (P.praiseT <= 0 && kingOk) {
      P.praiseT = 0.8;
      let said = 0;
      for (const o of villagers()) {
        if (dist2(o.pos, king) > PRAISE_R) continue;
        if (o.seated) { if (said < 1 && Math.random() < 0.15) { say(o.npc, pickOne(PRAISE), 1.8); said++; } continue; }
        if (npcs.watch(o.npc, king, rr(3, 5), true) && said < 2 && Math.random() < 0.6) { say(o.npc, pickOne(PRAISE), 2); said++; }
      }
    }
    /* 끝 */
    if ((P.zEnd - P.z) * P.d <= 0) {
      if (P.endT === 0) P.endT = 0.01;
    }
    if (P.endT > 0 || p && Math.abs(P.z - p.z) > 120) endProcession();
  }

  /* ════ ② 불꽃놀이 ════ */
  const fwPos = new Float32Array(FW_MAX * 3), fwCol = new Float32Array(FW_MAX * 3);
  const fwV = new Float32Array(FW_MAX * 3), fwBase = new Float32Array(FW_MAX * 3), fwL = new Float32Array(FW_MAX), fwM = new Float32Array(FW_MAX);
  const fwK = new Uint8Array(FW_MAX);   // 0 없음, 1 불꽃, 2 로켓, 3 꼬리
  for (let i = 0; i < FW_MAX; i++) fwPos[i * 3 + 1] = -9999;
  const fwGeo = keep(new THREE.BufferGeometry());
  const posAttr = new THREE.BufferAttribute(fwPos, 3).setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(fwCol, 3).setUsage(THREE.DynamicDrawUsage);
  fwGeo.setAttribute('position', posAttr); fwGeo.setAttribute('color', colAttr);
  fwGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(C.x, 25, C.z), 60);
  const dotTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv); return keep(t);
  })();
  const fwMat = keep(new THREE.PointsMaterial({ size: 0.7, map: dotTex, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true }));
  fwMat.color.setScalar(2.2);                          // HDR → 블룸
  const fwPts = new THREE.Points(fwGeo, fwMat);
  fwPts.frustumCulled = false; fwPts.visible = false; fwPts.renderOrder = 5;
  scene.add(fwPts);
  let fwFree = 0, fwAlive = 0;
  function fwSpawn(kind, x, y, z, vx, vy, vz, r, g, b, life) {
    for (let k = 0; k < FW_MAX; k++) {
      const i = (fwFree + k) % FW_MAX;
      if (fwK[i]) continue;
      fwFree = (i + 1) % FW_MAX;
      fwK[i] = kind; fwL[i] = fwM[i] = life;
      fwPos[i * 3] = x; fwPos[i * 3 + 1] = y; fwPos[i * 3 + 2] = z;
      fwV[i * 3] = vx; fwV[i * 3 + 1] = vy; fwV[i * 3 + 2] = vz;
      fwBase[i * 3] = r; fwBase[i * 3 + 1] = g; fwBase[i * 3 + 2] = b;
      fwAlive++;
      return i;
    }
    return -1;
  }
  function launch() {
    const x = C.x + rr(-9, 9), z = C.z + rr(-9, 9), y = groundY(x, z);
    const col = pickOne(FW_COLORS);
    const i = fwSpawn(2, x, y + 0.5, z, rr(-1.2, 1.2), rr(19, 24), rr(-1.2, 1.2), 1, 0.85, 0.55, 3);
    if (i >= 0) fwRocketCol[i] = FW_COLORS.indexOf(col);
    whistle(x, z);
  }
  const fwRocketCol = new Int8Array(FW_MAX);
  function burst(x, y, z, ci) {
    const col = FW_COLORS[ci] || pickOne(FW_COLORS), col2 = Math.random() < 0.35 ? pickOne(FW_COLORS) : col;
    const ring = Math.random() < 0.25, N = ring ? 70 : 90 + Math.floor(Math.random() * 40), sp = rr(7, 10);
    for (let k = 0; k < N; k++) {
      let vx, vy, vz;
      if (ring) { const a = k / N * Math.PI * 2; vx = Math.cos(a); vy = Math.sin(a) * 0.35; vz = Math.sin(a); }
      else { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u); vx = s * Math.cos(a); vy = u; vz = s * Math.sin(a); }
      const v = sp * (ring ? 1 : rr(0.75, 1));
      const c = k % 3 === 0 ? col2 : col;
      fwSpawn(1, x, y, z, vx * v, vy * v + 1, vz * v, c[0], c[1], c[2], rr(1.3, 2.1));
    }
    popSound(x, z, ring ? 0.8 : 1);
    /* 근처 사람들이 하늘을 보고 환호 */
    let said = 0;
    for (const o of villagers()) {
      if (Math.hypot(o.pos.x - x, o.pos.z - z) > 30) continue;
      if (npcs.watch(o.npc, { x, z }, rr(2.5, 4), true) && said < 1 && Math.random() < 0.3) { say(o.npc, pickOne(FW_CHEER), 1.6); said++; }
    }
  }
  const FW = { show: 0, nextBurst: 0, clock: rr(8, 20), announced: false };
  function triggerFireworks(sec = FW_SHOW) {
    FW.show = sec; FW.nextBurst = 0;
    const p = getPlayerPos();
    if (Math.hypot(p.x - C.x, p.z - C.z) < 90) toast('밤 축제! 마을 하늘에 불꽃놀이가 시작됐어요');
    return true;
  }
  function fwUpdate(dt) {
    const night = getNight() || 0;
    if (FW.show > 0) {
      FW.show -= dt; FW.nextBurst -= dt;
      if (FW.nextBurst <= 0) { FW.nextBurst = rr(0.45, 1.3); launch(); if (Math.random() < 0.25) launch(); }
    } else if (night > FW_NIGHT) {
      FW.clock -= dt;
      if (FW.clock <= 0 && isVisible()) { FW.clock = rr(FW_EVERY[0], FW_EVERY[1]); triggerFireworks(); }
    } else FW.clock = Math.max(FW.clock, rr(8, 20));
    if (!fwAlive) { if (fwPts.visible) fwPts.visible = false; return; }
    fwPts.visible = true;
    const drag = Math.exp(-dt * 1.4);
    for (let i = 0; i < FW_MAX; i++) {
      const k = fwK[i];
      if (!k) continue;
      const j = i * 3;
      fwL[i] -= dt;
      if (k === 2) {                                   // 로켓: 올라가다 느려지면 터진다
        fwV[j + 1] -= 9.8 * dt;
        fwPos[j] += fwV[j] * dt; fwPos[j + 1] += fwV[j + 1] * dt; fwPos[j + 2] += fwV[j + 2] * dt;
        if (Math.random() < 0.8) fwSpawn(3, fwPos[j], fwPos[j + 1], fwPos[j + 2], rr(-0.3, 0.3), rr(-1.5, -0.5), rr(-0.3, 0.3), 1, 0.6, 0.25, 0.45);
        if (fwV[j + 1] < 3 || fwL[i] <= 0) {
          const x = fwPos[j], y = fwPos[j + 1], z = fwPos[j + 2];
          fwK[i] = 0; fwAlive--; fwPos[j + 1] = -9999; fwCol[j] = fwCol[j + 1] = fwCol[j + 2] = 0;
          burst(x, y, z, fwRocketCol[i]);
          continue;
        }
        fwCol[j] = 1.2; fwCol[j + 1] = 1; fwCol[j + 2] = 0.7;
        continue;
      }
      if (fwL[i] <= 0) { fwK[i] = 0; fwAlive--; fwPos[j + 1] = -9999; fwCol[j] = fwCol[j + 1] = fwCol[j + 2] = 0; continue; }
      fwV[j] *= drag; fwV[j + 1] = fwV[j + 1] * drag - 3.2 * dt; fwV[j + 2] *= drag;
      fwPos[j] += fwV[j] * dt; fwPos[j + 1] += fwV[j + 1] * dt; fwPos[j + 2] += fwV[j + 2] * dt;
      const u = fwL[i] / fwM[i];
      let f = u * u * (k === 1 ? 1.2 : 0.8);
      if (k === 1 && u < 0.35 && Math.random() < 0.4) f *= 0.2;   // 끝에 반짝반짝
      fwCol[j] = fwBase[j] * f; fwCol[j + 1] = fwBase[j + 1] * f; fwCol[j + 2] = fwBase[j + 2] * f;
    }
    posAttr.needsUpdate = true; colAttr.needsUpdate = true;
  }

  /* ════ ③ 닭 소동 ════ */
  const chickMats = {
    white: keep(new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 0.9, flatShading: true })),
    red: keep(new THREE.MeshStandardMaterial({ color: 0xe0302a, roughness: 0.7, flatShading: true })),
    orange: keep(new THREE.MeshStandardMaterial({ color: 0xf29a1e, roughness: 0.6, flatShading: true })),
    black: keep(new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.4 })),
    brown: keep(new THREE.MeshStandardMaterial({ color: 0xc08040, roughness: 0.9, flatShading: true })),
  };
  const cg = {
    body: keep(new THREE.IcosahedronGeometry(0.2, 1)), head: keep(new THREE.IcosahedronGeometry(0.11, 1)),
    comb: keep(new THREE.SphereGeometry(0.035, 5, 4)), beak: keep(new THREE.ConeGeometry(0.035, 0.08, 4)),
    eye: keep(new THREE.SphereGeometry(0.016, 5, 4)), wing: keep(new THREE.IcosahedronGeometry(0.12, 0)),
    tail: keep(new THREE.ConeGeometry(0.08, 0.18, 4)), leg: keep(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4)),
  };
  function makeChicken(brown) {
    const g = new THREE.Group();
    const bodyMat = brown ? chickMats.brown : chickMats.white;
    const tilt = new THREE.Group(); tilt.position.y = 0.3; g.add(tilt);
    const body = new THREE.Mesh(cg.body, bodyMat); body.scale.set(1, 0.9, 1.25); tilt.add(body);
    const tail = new THREE.Mesh(cg.tail, bodyMat); tail.position.set(0, 0.1, -0.22); tail.rotation.x = -0.9; tilt.add(tail);
    const head = new THREE.Group(); head.position.set(0, 0.17, 0.18); tilt.add(head);
    head.add(new THREE.Mesh(cg.head, bodyMat));
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(cg.comb, chickMats.red); c.position.set(0, 0.1 + (k === 1 ? 0.02 : 0), -0.03 + k * 0.035); head.add(c); }
    const beak = new THREE.Mesh(cg.beak, chickMats.orange); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.005, 0.12); head.add(beak);
    const wat = new THREE.Mesh(cg.comb, chickMats.red); wat.position.set(0, -0.06, 0.09); wat.scale.set(0.8, 1.3, 0.8); head.add(wat);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(cg.eye, chickMats.black); e.position.set(s * 0.07, 0.03, 0.07); head.add(e); }
    const wings = [];
    for (const s of [-1, 1]) {
      const pv = new THREE.Group(); pv.position.set(s * 0.17, 0.04, 0); tilt.add(pv);
      const w = new THREE.Mesh(cg.wing, bodyMat); w.scale.set(0.35, 0.8, 1.3); w.position.set(s * 0.02, -0.04, -0.02); pv.add(w);
      wings.push(pv);
    }
    const legs = [];
    for (const s of [-1, 1]) {
      const pv = new THREE.Group(); pv.position.set(s * 0.07, 0.16, 0); g.add(pv);
      const l = new THREE.Mesh(cg.leg, chickMats.orange); l.position.y = -0.08; pv.add(l);
      legs.push(pv);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(1.15);
    return { g, tilt, head, wings, legs };
  }
  const chickPool = [];
  const CH = { active: false, si: -1, total: 0, caught: 0, t: 0, farmer: null, home: { x: 0, z: 0 }, pen: { x: 0, z: 0 }, doneT: 0, list: [] };
  let chickClock = rr(60, 120);
  function farmerOf(si) {
    for (const o of npcs.list()) if (o.barkeeper && o.npc.bar === si && !o.off) return o.npc;
    return null;
  }
  function triggerChickens(si = -1) {
    if (CH.active || !stalls.length) return false;
    const p = getPlayerPos();
    if (si < 0) { let bd = 1e9; stalls.forEach((s, i) => { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; si = i; } }); }
    const s = stalls[si];
    const bar = s.bar || s;
    /* 우리(닭이 돌아가 있을 자리): 테이블 옆(부스·의자를 피해서), 길 쪽으로 조금 */
    let ux = bar.x - s.x, uz = bar.z - s.z; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    const sg = Math.sign((s.x + uz * 3.4) - pathX(s.z)) === Math.sign(s.x - pathX(s.z)) ? 1 : -1;   // 길을 건너지 않는 쪽
    CH.pen.x = s.x + uz * 3.4 * sg - ux * 0.8; CH.pen.z = s.z - ux * 3.4 * sg - uz * 0.8;
    CH.home.x = s.x; CH.home.z = s.z;
    Object.assign(CH, { active: true, si, caught: 0, t: CHICK_TIME, doneT: 0 });
    CH.total = 5 + Math.floor(Math.random() * 4);
    CH.list = [];
    for (let k = 0; k < CH.total; k++) {
      let c = chickPool[k];
      if (!c) { c = makeChicken(k % 3 === 2); scene.add(c.g); chickPool.push(c); }
      const a = Math.random() * Math.PI * 2, r = rr(1.5, 3.5);
      Object.assign(c, { x: CH.pen.x + Math.cos(a) * r, z: CH.pen.z + Math.sin(a) * r, rot: a, vx: 0, vz: 0, st: 'run', phase: Math.random() * 6,
        wanderT: 0, wanderA: a, hop: 0, peck: 0, panic: 1.5, jumpT: 0, homeX: 0, homeZ: 0, bawkT: rr(0.2, 2) });
      c.g.visible = true;
      CH.list.push(c);
    }
    CH.farmer = farmerOf(si);
    if (CH.farmer) say(CH.farmer, '내 닭!', 2.5, '#9a2a10');
    toast(`닭 소동! 닭 ${CH.total}마리가 도망쳤어요 — 걸어가서 닭에 닿으면 잡혀요`);
    return true;
  }
  function endChickens() {
    CH.active = false;
    for (const c of chickPool) c.g.visible = false;
    CH.list = [];
  }
  function chickUpdate(dt, t, p) {
    const onFoot = isOnFoot();
    CH.t -= dt;
    if (CH.doneT > 0) { CH.doneT -= dt; if (CH.doneT <= 0) { endChickens(); return; } }
    else if (CH.t <= 0) {
      toast(`닭들이 제 발로 돌아갔어요 (${CH.caught}/${CH.total})`);
      if (CH.farmer) say(CH.farmer, '휴, 돌아왔구나…', 2);
      endChickens(); return;
    }
    const pRun = Math.hypot(p.x - CH.home.x, p.z - CH.home.z) < 80;
    for (let ci = 0; ci < CH.list.length; ci++) {
      const c = CH.list[ci];
      if (c.st === 'run') {
        const dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz);
        if (d < CHICK_CATCH && onFoot) {               // 잡았다!
          c.st = 'jump'; c.jumpT = 0; CH.caught++;
          const k = CH.caught;
          bawk(c.x, c.z);
          const pa = (k / CH.total) * Math.PI * 2;
          c.homeX = CH.pen.x + Math.cos(pa) * 0.9; c.homeZ = CH.pen.z + Math.sin(pa) * 0.9;
          c.fromX = c.x; c.fromZ = c.z;
          if (k >= CH.total) {
            toast(`닭을 모두 잡았어요! (${k}/${CH.total}) 농부가 고맙다며 맥주 한 잔을 대접합니다`);
            if (CH.farmer) { say(CH.farmer, '고맙소! 임금님께 자랑하겠소!', 3, '#2a5a10'); npcs.barkeeperServe && npcs.barkeeperServe(CH.si); }
            CH.doneT = 20;
          } else {
            toast(`닭 ${k}/${CH.total} 잡았다!`);
            if (CH.farmer && Math.random() < 0.5) say(CH.farmer, pickOne(['옳지!', '잘한다!', '한 마리 더!']), 1.6);
          }
          continue;
        }
        /* 조종: 플레이어를 피해 도망(6 m 안) + 지그재그, 아니면 어슬렁·쪼기. 가판대에서 CHICK_R 밖이면 돌아온다 */
        let ax = 0, az = 0, sp = 0;
        if (d < 6 && pRun) {
          const inv = 1 / Math.max(d, 0.1);
          ax = dx * inv; az = dz * inv;
          const zig = Math.sin(t * 7 + c.phase) * 0.8; const zx = -az * zig, zz = ax * zig;
          ax += zx; az += zz;
          sp = 3.6 * (c.panic > 0 ? 1 : 0.85);
          c.panic = 1.5;
          c.bawkT -= dt; if (c.bawkT <= 0) { c.bawkT = rr(0.8, 2.2); bawk(c.x, c.z); }
        } else {
          c.panic -= dt;
          c.wanderT -= dt;
          if (c.wanderT <= 0) { c.wanderT = rr(1, 3); c.wanderA = Math.random() * Math.PI * 2; c.peck = Math.random() < 0.4 ? rr(0.8, 1.6) : 0; }
          if (c.peck > 0) { c.peck -= dt; sp = 0; }
          else { ax = Math.sin(c.wanderA); az = Math.cos(c.wanderA); sp = c.panic > 0 ? 2.2 : 0.7; }
        }
        const hx = c.x - CH.home.x, hz = c.z - CH.home.z, hd = Math.hypot(hx, hz);
        if (hd > CHICK_R - 4) { const w = Math.min(2.5, (hd - CHICK_R + 4) / 2); ax -= hx / hd * w; az -= hz / hd * w; if (!sp) sp = 1; }
        /* 맵 경계 */
        if (c.x < B.minX + 4) ax += 2; if (c.x > B.maxX - 4) ax -= 2;
        if (c.z < B.minZ + 4) az += 2; if (c.z > B.maxZ - 4) az -= 2;
        const al = Math.hypot(ax, az);
        if (al > 1e-3 && sp > 0) {
          const tvx = ax / al * sp, tvz = az / al * sp, k = Math.min(1, dt * 6);
          c.vx += (tvx - c.vx) * k; c.vz += (tvz - c.vz) * k;
        } else { c.vx *= Math.exp(-dt * 8); c.vz *= Math.exp(-dt * 8); }
        c.x = clampX(c.x + c.vx * dt); c.z = Math.max(B.minZ + 2, Math.min(B.maxZ - 2, c.z + c.vz * dt));
        const v = Math.hypot(c.vx, c.vz);
        if (v > 0.15) c.rot += wrap(Math.atan2(c.vx, c.vz) - c.rot) * Math.min(1, dt * 10);
        c.phase += dt * (4 + v * 5);
        c.hop = v > 2 ? Math.abs(Math.sin(c.phase)) * 0.08 : 0;
        const flap = v > 2 ? Math.sin(t * 30 + ci) * 0.9 + 0.6 : 0.05;
        c.wings[0].rotation.z = -flap; c.wings[1].rotation.z = flap;
        c.legs[0].rotation.x = Math.sin(c.phase * 2) * Math.min(0.8, v * 0.4); c.legs[1].rotation.x = -c.legs[0].rotation.x;
        c.tilt.rotation.x = v > 2 ? 0.25 : (c.peck > 0 ? 0.55 + Math.abs(Math.sin(t * 9 + ci)) * 0.3 : 0);
        c.head.rotation.x = c.peck > 0 ? 0.5 : 0;
      } else if (c.st === 'jump') {                     // 잡히면 폴짝 뛰었다가 우리로 날아간다
        c.jumpT += dt;
        const u = Math.min(1, c.jumpT / 1.1), e = u * u * (3 - 2 * u);
        c.x = c.fromX + (c.homeX - c.fromX) * e; c.z = c.fromZ + (c.homeZ - c.fromZ) * e;
        c.hop = Math.sin(u * Math.PI) * 2.2;
        c.rot += dt * 8;
        const fl = Math.sin(t * 34) * 1.1 + 0.4; c.wings[0].rotation.z = -fl; c.wings[1].rotation.z = fl;
        c.tilt.rotation.x = 0;
        if (u >= 1) { c.st = 'home'; c.hop = 0; c.rot = Math.atan2(CH.home.x - c.x, CH.home.z - c.z); }
      } else {                                          // 우리 안에서 콕콕
        c.wings[0].rotation.z = c.wings[1].rotation.z = -0.05;
        c.tilt.rotation.x = Math.sin(t * 2 + ci * 1.7) > 0.3 ? 0.55 + Math.abs(Math.sin(t * 9 + ci)) * 0.3 : 0;
        c.legs[0].rotation.x = c.legs[1].rotation.x = 0;
      }
      c.g.position.set(c.x, groundY(c.x, c.z) + c.hop, c.z);
      c.g.rotation.y = c.rot;
    }
  }

  /* ════ ④ 소매치기 ════ */
  const TH = { active: false, phase: '', victim: null, t: 0, dirZ: 1, side: 1, endT: 0, wasActing: true };
  let thiefClock = rr(100, 160);
  function triggerThief() {
    if (TH.active) return false;
    const p = getPlayerPos();
    const cands = villagers().filter(o => (o.state === 'WANDER' || o.state === 'PAUSE') && dist2(o.pos, p) > 6 && dist2(o.pos, p) < 28);
    if (!cands.length) return false;
    const v = pickOne(cands).npc;
    const c = getCast();
    const th = c.thief;
    const s = Math.sign(v.x - pathX(v.z)) || 1;
    const zs = clampZ(v.z + (v.z > p.z ? 7 : -7));
    npcs.actorOn(th, pathX(zs) + s * 3.6, zs, Math.atan2(v.x - pathX(zs) - s * 3.6, v.z - zs));
    c.purse.visible = false;
    Object.assign(TH, { active: true, phase: 'sneak', victim: v, t: 12, side: s, endT: 0, wasActing: true });
    return true;
  }
  function endThief() {
    if (cast && npcs.actorOff(cast.thief)) { TH.active = false; TH.victim = null; cast.purse.visible = false; }
  }
  function thiefUpdate(dt, t, p) {
    const th = cast.thief, v = TH.victim, acting = npcs.isActing(th);
    TH.t -= dt;
    const knocked = TH.wasActing && !acting;
    TH.wasActing = acting;
    if (TH.phase === 'sneak') {
      if (!acting) { TH.phase = 'leave'; TH.endT = 8; return; }   // 훔치기 전에 맞았다
      if (!v || v.off || TH.t <= 0) { TH.phase = 'leave'; TH.endT = 6; return; }
      if (stepTo(th, v.x, v.z, 2.4, dt) || dist2(th, v) < 0.9) {
        TH.phase = 'run'; TH.t = THIEF_TIME;
        cast.purse.visible = true;
        npcs.watch(v, th, 4, false);
        say(v, '도둑이야!', 3, '#c0281e');
        say(th, '헤헤!', 1.5);
        TH.dirZ = Math.sign(th.z - p.z) || 1;
        if (Math.abs(clampZ(th.z + TH.dirZ * 30) - th.z) < 15) TH.dirZ = -TH.dirZ;
        toast('소매치기다! "도둑이야!" — 30초 안에 도둑을 붙잡거나 때려 눕히세요');
      }
      return;
    }
    if (TH.phase === 'run') {
      const caughtBody = acting && isOnFoot() && dist2(th, p) < THIEF_CATCH;
      if (knocked || caughtBody) {
        TH.phase = 'caught'; TH.endT = 9;
        cast.purse.visible = false;
        if (caughtBody) { npcs.actorPlay(th, 'Idle', 0.2); say(th, '아이고, 잘못했어요!', 2.2); }
        toast('도둑을 잡았어요! 지갑을 주인에게 돌려줬습니다');
        if (v && !v.off) say(v, pickOne(['고마워요! 임금님 같은 분이시네!', '내 지갑! 정말 고마워요!']), 3, '#2a5a10');
        return;
      }
      if (!acting) return;                             // 잡혀 들려 있거나 넘어지는 중
      if (TH.t <= 0 || (dist2(th, p) > 45 && TH.t < THIEF_TIME - 10)) {
        TH.phase = 'gone';
        toast('도둑이 도망쳤어요… 다음엔 꼭 잡아요');
        endThief(); return;
      }
      /* 길가를 따라 플레이어 반대쪽으로 달린다 (12초 지나면 지친다). 끝에 닿으면 숲으로 */
      const sp = TH.t > THIEF_TIME - 12 ? 5.0 : 3.9;
      let tz = th.z + TH.dirZ * 4;
      let tx = pathX(tz) + TH.side * (3.4 + Math.sin(t * 1.7) * 0.8);
      if (tz < B.minZ + 5 || tz > B.maxZ - 5) { tz = th.z; tx = th.x + TH.side * 4; }
      tx = clampX(tx);
      if (Math.abs(tx - th.x) < 0.5 && Math.abs(tz - th.z) < 0.5) { TH.side = -TH.side; }
      stepTo(th, tx, tz, sp, dt);
      if (Math.random() < dt * 0.25) say(th, pickOne(['메롱~', '못 잡지롱!', '헤헤!']), 1.4);
      return;
    }
    if (TH.phase === 'caught' || TH.phase === 'leave') {
      TH.endT -= dt;
      if (acting) {
        if (TH.endT > 6 && TH.phase === 'caught') { npcs.actorPlay(th, 'Idle', 0.3); turn(th, Math.atan2(p.x - th.x, p.z - th.z), dt); }
        else stepTo(th, th.x + Math.sign(th.x - pathX(th.z) || 1) * 3, th.z, 1.3, dt);   // 터덜터덜 숲 쪽으로
      }
      if (TH.endT <= 0 && th.dist > 12 || TH.endT < -10) endThief();
    }
  }

  /* ════ 매 프레임 ════ */
  function update(dt, t = 0) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    const p = getPlayerPos();
    if (!p || !Number.isFinite(p.x)) return;
    const vis = isVisible();

    procClock -= dt;
    if (procClock <= 0) {
      if (!vis || P.active || !triggerProcession()) procClock = 30;
      else procClock = rr(PROC_EVERY[0], PROC_EVERY[1]);
    }
    if (P.active) procUpdate(dt, t, p);

    fwUpdate(dt);

    chickClock -= dt;
    if (chickClock <= 0) {
      const near = stalls.some(s => Math.hypot(s.x - p.x, s.z - p.z) < 40);
      if (vis && !CH.active && near && triggerChickens()) chickClock = rr(CHICK_EVERY[0], CHICK_EVERY[1]);
      else chickClock = 30;
    }
    if (CH.active) chickUpdate(dt, t, p);

    thiefClock -= dt;
    if (thiefClock <= 0) {
      if (vis && !TH.active && triggerThief()) thiefClock = rr(THIEF_EVERY[0], THIEF_EVERY[1]);
      else thiefClock = 25;
    }
    if (TH.active) thiefUpdate(dt, t, p);
  }

  function dispose() {
    if (P.active) for (const m of P.members) npcs.actorOff(m.n);
    if (cast) npcs.actorOff(cast.thief);
    P.active = TH.active = false;
    for (const c of chickPool) scene.remove(c.g);
    scene.remove(fwPts);
    for (const d of disposables) if (d && d.dispose) d.dispose();
    if (actx) actx.close().catch(() => {});
    if (debug && globalThis.__village) delete globalThis.__village;
  }

  const state = {
    get procession() { return P.active ? { z: +P.z.toFixed(1), zEnd: +P.zEnd.toFixed(1), chase: P.chaseT > 0 } : null; },
    get fireworks() { return { show: +FW.show.toFixed(1), alive: fwAlive }; },
    get chickens() { return CH.active ? { caught: CH.caught, total: CH.total, t: Math.round(CH.t) } : null; },
    get thief() { return TH.active ? { phase: TH.phase, t: Math.round(TH.t) } : null; },
    get clocks() { return { procession: Math.round(procClock), chickens: Math.round(chickClock), thief: Math.round(thiefClock), fireworks: Math.round(FW.clock) }; },
  };
  const api = { update, dispose, triggerProcession, triggerFireworks, triggerChickens, triggerThief, state,
    thiefPos: () => (TH.active && cast && cast.thief ? { x: cast.thief.x, z: cast.thief.z } : null) };   // 미니맵 빨간 점
  if (debug) globalThis.__village = {
    procession: triggerProcession, fireworks: triggerFireworks, chickens: triggerChickens, thief: triggerThief,
    state: () => JSON.parse(JSON.stringify(state)),
    get cast() { return cast; }, get chickenList() { return CH.list; },
  };
  return api;
}
