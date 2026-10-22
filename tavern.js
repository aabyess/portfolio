/* ════════════════════════════════════════════════════════════
   선술집 — 의자에 앉아 술을 시키고 마신다
   ────────────────────────────────────────────────────────────
   걸어서 빈 의자 1.2 m 안에 가면 "E 앉기" 가 뜬다. E → 의자로 다가가 앉는다.
   앉아 있는 동안 오른쪽 아래 주문판에서 술을 고른다(1~4 키 또는 클릭).
   잠시 뒤 오른손에 나무 잔이 생기고, E 를 길게 누르거나 "마시기" 로 한 모금씩 마신다(3모금 = 한 잔).
   세 잔 넘게 마시면 화면이 살짝 흔들리는 '취기'가 오고 천천히 깬다
   (prefers-reduced-motion 이면 흔들림 없이 가장자리만 살짝 붉어진다).
   E 짧게 / WASD / Esc → 일어난다.

   person.glb 에는 앉기 클립이 없어서 vehicles.js 의 탄 사람처럼 뼈를 직접 굽힌다.
   그 '자세 잡기' 도구(createPoser)를 여기서 export 하고 weapons.js 도 같이 쓴다.

   ── portfolio.js 연결 방법 (PM용) ──────────────────────────────
   ① 탈것 바꾸기(createVehicleSwitcher) 블록 바로 아래:
        const { createTavern } = await import('./tavern.js');
        const tavern = createTavern({
          THREE, scene, camera, person,
          personClips: () => charClips,
          getNpcs: () => npcs,                                   // freeSeatNear/reserveSeat/releaseSeat 가 있으면 그걸 쓴다
          stalls: stallsFromStations(stations, { THREE, toyBlocks }),   // npcs API 가 없을 때만 쓰는 대체 의자 목록
          isBlocked: () => !driveActive || panelOpen(),
          onSit() { pSpeed = 0; if (weapons) weapons.holster(); },
          onStand(h) { pHeading = camYaw = h; pSpeed = 0; },    // 일어난 뒤 바라보는 방향
        });
      (stallsFromStations 는 npcs.js 에서 import: 위 npcs 블록의 import 에 이미 있다면 그 이름을 쓰면 된다.
       npcs 블록 안의 const 라 밖에서 안 보이면 const { stallsFromStations } = await import('./npcs.js'); 한 줄 추가)

   ② step(dt) 맨 위 주행/도보 분기:
        if (player.mode === 'driving') drive(dt);
        else if (!tavern.seated) walk(dt);                      // 앉아 있으면 걷기·믹서를 멈춘다
        tavernIn.onFoot = player.mode === 'onfoot'; tavernIn.keys = keys;
        tavern.update(dt, tavernIn);
      step 밖에 한 번: const tavernIn = { onFoot: false, keys: null };

   ③ step(dt) 의 updateCamera(dt); 를 이렇게 바꾼다:
        tavern.cameraStep(camera, dt, updateCamera);            // 앉으면 어깨 너머 카메라, 취하면 살짝 흔들림

   ④ physicsStep 의 사람 몸체 줄 — 앉은 사람 구(반지름 0.55)가 의자·테이블을 밀어내지 않게:
        if (person.visible && !tavern.seated) personBody.position.set(...);
        else personBody.position.set(0, -50, 0);

   ⑤ (선택) 안내 문구 updateHint() 에: <span class="key">E</span> 앉기 · 마시기

   키: E(앉기/일어나기, 길게 = 마시기), 1~4(주문), Esc(일어나기). KEYMAP 과 겹치지 않는다.
   ════════════════════════════════════════════════════════════ */

const D2R = Math.PI / 180;
export const PLAYER_OWNER = { isPlayer: true, name: 'player' };

/* ════════ 자세 잡기 도구 (person.glb 리그) ════════
   - 사람 공간: 앞 = +Z, 위 = +Y, 캐릭터의 왼쪽 = +X (side: 왼쪽 +1 / 오른쪽 -1)
   - 발 뼈(Foot.L/R)는 다리 사슬이 아니라 Root 의 자식(IK)이라 placeFeet() 로 따로 옮긴다 */
export function createPoser({ THREE, person, personClips }) {
  const V = THREE.Vector3, Q = THREE.Quaternion;
  const _q = new Q(), _qp = new Q(), _qd = new Q(), _qi = new Q(), _qa = new Q(), _qb = new Q(), _qw = new Q();
  const _v = new V(), _v2 = new V(), _v3 = new V(), _v4 = new V(), _v5 = new V();
  const AX = new V(1, 0, 0), AZ = new V(0, 0, 1);
  const P = { rig: null, personQ: new Q(), searchT: 0, saved: [], footRest: null };

  const boneOf = (m, n) => m.getObjectByName(n) || m.getObjectByName(n.replace(/\./g, ''));
  function find() {
    let sk = null;
    person.traverse(o => { if (!sk && o.isSkinnedMesh) sk = o; });
    if (!sk) return null;
    let model = sk; while (model.parent && model.parent !== person) model = model.parent;
    const b = n => boneOf(model, n);
    const r = {
      model, hips: b('Hips'), chest: b('Chest'), head: b('Head'),
      legL: [b('UpperLeg.L'), b('LowerLeg.L'), b('LowerLeg.L_end'), b('Foot.L')],
      legR: [b('UpperLeg.R'), b('LowerLeg.R'), b('LowerLeg.R_end'), b('Foot.R')],
      armL: [b('UpperArm.L'), b('LowerArm.L'), b('Wrist.L')],
      armR: [b('UpperArm.R'), b('LowerArm.R'), b('Wrist.R')],
    };
    if (!r.hips || !r.armR[0] || !r.armR[2] || !r.legL[0]) return null;
    r.touched = [...r.legL, ...r.legR, ...r.armL, ...r.armR, r.chest].filter(Boolean);
    // 뼈가 뻗는 방향 = 자식의 로컬 위치
    r.axUpL = r.armL[1].position.clone().normalize(); r.axLoL = r.armL[2].position.clone().normalize();
    r.axUpR = r.armR[1].position.clone().normalize(); r.axLoR = r.armR[2].position.clone().normalize();
    model.updateMatrixWorld(true);
    const d = (a, c) => a.getWorldPosition(_v).distanceTo(c.getWorldPosition(_v2));
    r.lenUp = d(r.armR[0], r.armR[1]); r.lenLo = d(r.armR[1], r.armR[2]);
    P.footRest = [r.legL[3], r.legR[3]].map(f => f && f.quaternion.clone());
    return r;
  }
  P.ensure = (dt = 0) => {
    if (P.rig) return P.rig;
    P.searchT -= dt;
    if (P.searchT <= 0) { P.searchT = 0.5; P.rig = find(); }
    return P.rig;
  };
  /* 매 프레임 자세 잡기 전에 한 번 — 사람의 월드 회전을 기억 */
  P.frame = () => { person.updateWorldMatrix(true, false); person.getWorldQuaternion(P.personQ); };

  P.save = () => {
    const r = P.rig; P.saved.length = 0;
    if (r) for (const b of r.touched) P.saved.push({ b, p: b.position.clone(), q: b.quaternion.clone() });
  };
  P.restore = () => { for (const s of P.saved) { s.b.position.copy(s.p); s.b.quaternion.copy(s.q); } P.saved.length = 0; };

  /* idle 클립 첫 프레임 (다리·팔). 없으면 지금 자세 */
  let base = null;
  P.baseIdle = () => {
    const r = P.rig; if (!r) return;
    if (!base) {
      const clips = typeof personClips === 'function' ? personClips() : personClips;
      let idle = null;
      if (clips) {
        const list = Array.isArray(clips) ? clips : Object.values(clips);
        idle = (!Array.isArray(clips) && clips.idle) || list.find(c => /(^|\|)idle$/i.test(c.name));
      }
      base = [];
      for (const bone of [r.legL[0], r.legL[1], r.legR[0], r.legR[1], r.armL[0], r.armL[1], r.armR[0], r.armR[1], r.chest]) {
        if (!bone) continue;
        const q = bone.quaternion.clone();
        const tr = idle && idle.tracks.find(t => t.name === bone.name + '.quaternion');
        if (tr) q.fromArray(tr.values, 0);
        base.push({ bone, q });
      }
    }
    for (const e of base) e.bone.quaternion.copy(e.q);
  };

  /* 사람 공간 회전 rLocal 을 뼈에: q' = Pw⁻¹ · (S·R·S⁻¹) · Pw · q */
  P.rot = (bone, rLocal) => {
    if (!bone) return;
    bone.parent.getWorldQuaternion(_qp);
    _qd.copy(P.personQ).multiply(rLocal).multiply(_qi.copy(P.personQ).invert());
    _q.copy(_qp).invert().multiply(_qd).multiply(_qp);
    bone.quaternion.premultiply(_q);
  };
  P.rotXYZ = (bone, x, y, z) => {   // 사람 공간 오일러(도) — 상체 비틀기 등
    _qw.setFromEuler(_eul.set(x * D2R, y * D2R, z * D2R, 'YXZ'));
    P.rot(bone, _qw);
  };
  const _eul = new THREE.Euler();
  P.leg = (side, thigh, spread, knee) => {
    const leg = side > 0 ? P.rig.legL : P.rig.legR;
    _qa.setFromAxisAngle(AZ, side * spread * D2R); _qb.setFromAxisAngle(AX, thigh * D2R);
    P.rot(leg[0], _qa.multiply(_qb));
    P.rot(leg[1], _qb.setFromAxisAngle(AX, knee * D2R));
  };
  /* 뼈의 뻗는 축(axisLocal)이 월드 점 target 을 향하게 */
  P.aim = (bone, axisLocal, target) => {
    bone.getWorldQuaternion(_qa);
    bone.getWorldPosition(_v);
    _v2.copy(axisLocal).applyQuaternion(_qa);
    _v3.subVectors(target, _v);
    if (_v3.lengthSq() < 1e-8) return;
    _v3.normalize();
    _qb.setFromUnitVectors(_v2, _v3);
    bone.parent.getWorldQuaternion(_qp);
    _q.copy(_qp).invert().multiply(_qb).multiply(_qp);
    bone.quaternion.premultiply(_q);
  };
  /* 두 뼈 IK: 손목이 target 에, 팔꿈치는 pole 쪽으로 */
  P.ik = (side, target, pole) => {
    const r = P.rig, arm = side > 0 ? r.armL : r.armR;
    const axU = side > 0 ? r.axUpL : r.axUpR, axL = side > 0 ? r.axLoL : r.axLoR;
    const L1 = r.lenUp, L2 = r.lenLo;
    arm[0].getWorldPosition(_v4);                       // 어깨
    _v5.subVectors(target, _v4);
    let d = _v5.length();
    if (d < 1e-4) return;
    _v5.divideScalar(d);
    d = Math.min(d, (L1 + L2) * 0.999);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    _v.subVectors(pole, _v4);                           // pole 을 팔 방향에 수직으로
    _v.addScaledVector(_v5, -_v.dot(_v5));
    if (_v.lengthSq() < 1e-8) _v.set(0, -1, 0);
    _v.normalize();
    _elbow.copy(_v4).addScaledVector(_v5, a).addScaledVector(_v, h);
    _hand.copy(_v4).addScaledVector(_v5, d);
    P.aim(arm[0], axU, _elbow);
    P.aim(arm[1], axL, _hand);
  };
  const _elbow = new V(), _hand = new V();
  P.placeFeet = () => {
    const r = P.rig;
    [r.legL, r.legR].forEach((leg, i) => {
      const end = leg[2], foot = leg[3];
      if (!end || !foot) return;
      end.getWorldPosition(_v); foot.parent.worldToLocal(_v); foot.position.copy(_v);
      if (P.footRest[i]) foot.quaternion.copy(P.footRest[i]);
    });
  };
  /* 사람 공간 점/방향 → 월드 */
  P.pt = (out, x, y, z) => person.localToWorld(out.set(x, y, z));
  P.dir = (out, x, y, z) => out.set(x, y, z).applyQuaternion(P.personQ);
  /* 기준 뼈 위치 + 사람 공간 오프셋 */
  P.rel = (out, bone, x, y, z) => { bone.getWorldPosition(out); return out.add(_v3.set(x, y, z).applyQuaternion(P.personQ)); };
  return P;
}

/* ════════ 술 ════════ */
export const DRINKS = [
  { id: 'ale',   name: '에일 맥주', desc: '호박빛, 쌉싸름하게', price: 3, liquid: 0xc8862a, foam: 0xfff1d0 },
  { id: 'stout', name: '흑맥주',    desc: '진하고 구수하게',   price: 4, liquid: 0x2a1608, foam: 0xe6cfa8 },
  { id: 'mead',  name: '꿀술(미드)', desc: '달콤한 꿀 향',     price: 6, liquid: 0xe3a62c, foam: 0xf7df92 },
  { id: 'cider', name: '사과주',    desc: '새콤한 사과 향',    price: 2, liquid: 0xe9cc6a, foam: 0xfffbe8 },
];
const START_COINS = 20, SIP_COUNT = 3, SIT_R = 1.2;
const SIP_TIME = 1.7, SERVE_DELAY = 1.6, HOLD_E = 0.25;
const DRUNK_AT = 3, SOBER_RATE = 1 / 45;          // 3잔부터 취기, 45초에 한 잔씩 깬다

export const HUD_HINT = 'E 앉기 · 1~4 주문 · E 길게 마시기';

const CSS = `
.tv-prompt{position:fixed;left:0;top:0;z-index:42;transform:translate(-50%,-100%);display:inline-flex;align-items:center;gap:8px;
  padding:7px 12px 7px 8px;border-radius:999px;border:1px solid rgba(107,68,35,.55);background:rgba(250,240,214,.94);
  color:#3b2412;font:600 13px/1.2 Georgia,'Nanum Myeongjo',serif;box-shadow:0 6px 18px rgba(40,24,10,.25);cursor:pointer;pointer-events:auto}
.tv-prompt[hidden]{display:none}
.tv-prompt kbd,.tv-panel kbd{font:700 11px/1 ui-monospace,monospace;background:#3b2412;color:#f6e7c4;border-radius:5px;padding:4px 6px}
.tv-panel{position:fixed;right:18px;bottom:96px;z-index:41;width:min(272px,calc(100vw - 32px));padding:12px 12px 10px;border-radius:12px;
  background:linear-gradient(180deg,#f7ebcd,#efdcb2);border:2px solid #6b4423;outline:1px solid rgba(255,248,230,.6);outline-offset:-5px;
  box-shadow:0 14px 34px rgba(40,24,10,.32);color:#3b2412;font:14px/1.35 Georgia,'Nanum Myeongjo',serif}
.tv-panel[hidden]{display:none}
.tv-panel .hd{display:flex;align-items:center;gap:7px;margin:0 2px 8px;font-weight:700;font-size:15px;letter-spacing:-.01em}
.tv-panel .coin{margin-left:auto;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px}
.tv-panel .coin i{width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,#c9ccd2 45%,#8a8f98);box-shadow:0 0 0 1px #6c7078}
.tv-panel .list{display:flex;flex-direction:column;gap:4px}
.tv-panel .it{display:flex;align-items:center;gap:9px;width:100%;padding:7px 8px;border:1px solid rgba(107,68,35,.25);border-radius:8px;
  background:rgba(255,250,236,.65);font:inherit;color:inherit;text-align:left;cursor:pointer}
.tv-panel .it:hover:not(:disabled),.tv-panel .it:focus-visible{background:#fff6dc;border-color:#6b4423;outline:none}
.tv-panel .it:disabled{opacity:.5;cursor:default}
.tv-panel .it .sw{width:14px;height:20px;border-radius:3px 3px 4px 4px;border:1.5px solid #5a3a1c;flex-shrink:0}
.tv-panel .it .tx{display:flex;flex-direction:column;min-width:0}
.tv-panel .it .nm{font-weight:700;font-size:13.5px}
.tv-panel .it .ds{font-size:11.5px;opacity:.72}
.tv-panel .it .pr{margin-left:auto;font-size:12px;font-weight:700;white-space:nowrap}
.tv-panel .st{margin:8px 2px 6px;font-size:12.5px;min-height:1.35em}
.tv-panel .sips{display:inline-flex;gap:3px;vertical-align:-2px;margin-left:4px}
.tv-panel .sips b{width:9px;height:9px;border-radius:50%;background:#c8862a;border:1px solid #5a3a1c}
.tv-panel .sips b.e{background:transparent}
.tv-panel .act{display:flex;gap:6px}
.tv-panel .act button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 6px;border-radius:8px;
  border:1px solid #6b4423;background:#6b4423;color:#fbefd2;font:700 13px Georgia,'Nanum Myeongjo',serif;cursor:pointer}
.tv-panel .act button.ghost{background:transparent;color:#3b2412}
.tv-panel .act button:disabled{opacity:.45;cursor:default}
.tv-panel .act kbd{background:rgba(255,240,210,.22);color:inherit}
.tv-panel .act .ghost kbd{background:#3b2412;color:#f6e7c4}
.tv-panel .dr{margin:8px 2px 0;font-size:11.5px;display:flex;align-items:center;gap:6px;opacity:.85}
.tv-panel .dr span{display:inline-flex;gap:2px}
.tv-panel .dr span b{width:8px;height:8px;border-radius:50%;border:1px solid #7a2e1d}
.tv-panel .dr span b.on{background:#b5452b}
.tv-toast{position:fixed;left:50%;top:84px;z-index:43;transform:translate(-50%,-8px);opacity:0;transition:opacity .25s,transform .25s;
  display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:12px;background:rgba(250,240,214,.96);border:1.5px solid #6b4423;
  color:#3b2412;font:600 13.5px Georgia,'Nanum Myeongjo',serif;box-shadow:0 8px 22px rgba(40,24,10,.25);pointer-events:none;white-space:nowrap}
.tv-toast.on{opacity:1;transform:translate(-50%,0)}
.tv-toast .who{font-size:11px;font-weight:700;color:#8a5a2b;letter-spacing:.04em}
.tv-haze{position:fixed;inset:0;z-index:30;pointer-events:none;opacity:0;
  background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(150,70,30,.30) 100%)}
body.intro-on .tv-prompt,body.intro-on .tv-panel,body[data-view="doc"] .tv-prompt,body[data-view="doc"] .tv-panel,
body[data-view="doc"] .tv-haze{display:none!important}
@media (max-width:640px){.tv-panel{bottom:150px}}
`;
const TANKARD_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h10v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M15 10h2.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H15"/><path d="M5 7c0-2 1.5-3 3-3 .8-1 2-1.4 3-1 1.5-.5 3 .5 3.5 1.8C15.6 5 16 6 15 7"/><path d="M8.5 11v6M11.5 11v6"/></svg>';
const LINES_ORDER = ['주문 받았어요!', '금방 내올게요~', '시원하게 한 잔 갑니다!', '좋은 선택이에요!'];
const LINES_DEBT = ['외상 장부에 달아둘게요~', '은화가 모자라네요… 이번만이에요!'];

export function createTavern({
  THREE, scene, camera, person, personClips, getNpcs, stalls = [], isBlocked, onSit, onStand, onOrder,
  sway = true,
}) {
  void scene;
  const V = THREE.Vector3;
  const poser = createPoser({ THREE, person, personClips });
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');

  /* 대체 의자 목록 정리 (npcs API 가 없을 때) */
  for (const s of stalls) for (const seat of s.seats) {
    if (!seat.stall) seat.stall = s;
    if (seat.owner === undefined) seat.owner = null;
  }

  /* ── DOM ── */
  if (!document.getElementById('tv-css')) {
    const st = document.createElement('style'); st.id = 'tv-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const root = document.getElementById('drive-root') || document.body;
  const promptEl = document.createElement('button');
  promptEl.type = 'button'; promptEl.className = 'tv-prompt'; promptEl.hidden = true;
  promptEl.innerHTML = '<kbd>E</kbd><span>앉기</span>';
  const panel = document.createElement('div');
  panel.className = 'tv-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '선술집 주문');
  panel.innerHTML = `
    <div class="hd">${TANKARD_SVG}<span>오늘의 술</span><span class="coin"><i aria-hidden="true"></i>은화 <b class="cn">${START_COINS}</b>닢</span></div>
    <div class="list">${DRINKS.map((d, i) => `<button type="button" class="it" data-id="${d.id}">
      <kbd>${i + 1}</kbd><span class="sw" style="background:#${d.liquid.toString(16).padStart(6, '0')}" aria-hidden="true"></span>
      <span class="tx"><span class="nm">${d.name}</span><span class="ds">${d.desc}</span></span><span class="pr">${d.price} 은화</span></button>`).join('')}</div>
    <div class="st" aria-live="polite"></div>
    <div class="act"><button type="button" class="drink">마시기 <kbd>E 길게</kbd></button><button type="button" class="ghost up">일어나기 <kbd>E</kbd></button></div>
    <div class="dr" aria-label="취기"><span>취기</span><span class="dots">${'<b></b>'.repeat(5)}</span></div>`;
  const toast = document.createElement('div'); toast.className = 'tv-toast'; toast.setAttribute('role', 'status');
  const haze = document.createElement('div'); haze.className = 'tv-haze';
  root.append(promptEl, panel, toast, haze);
  const stEl = panel.querySelector('.st'), coinEl = panel.querySelector('.cn');
  const drinkBtn = panel.querySelector('.drink'), upBtn = panel.querySelector('.up');
  const items = [...panel.querySelectorAll('.it')];
  const dots = [...panel.querySelectorAll('.dots b')];

  let toastTimer = 0;
  function say(text, who = '주모', ms = 1800) {
    toast.innerHTML = `<span class="who">${who}</span><span>${text}</span>`;
    toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), ms);
  }

  /* ── 소리 (짧은 합성음: 잔 내려놓기 '쿵', 꿀꺽) ── */
  let ac = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function clunk() {
    const a = audio(); if (!a) return;
    const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.2);
  }
  function gulp() {
    const a = audio(); if (!a) return;
    const t = a.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = a.createOscillator(), g = a.createGain(), t0 = t + i * 0.26;
      o.type = 'sine'; o.frequency.setValueAtTime(330, t0); o.frequency.exponentialRampToValueAtTime(140, t0 + 0.12);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
      o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + 0.16);
    }
  }

  /* ── 나무 잔 ── */
  const mug = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4b28, roughness: 0.8 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3d3a36, roughness: 0.45, metalness: 0.6 });
  const liqMat = new THREE.MeshStandardMaterial({ color: 0xc8862a, roughness: 0.3 });
  const foamMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, roughness: 0.9 });
  {
    const H = 0.15, R = 0.058;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.92, H, 12, 1, true), wood);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(R * 0.92, 12), wood); bottom.rotation.x = Math.PI / 2; bottom.position.y = -H / 2;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.86, R * 0.8, H * 0.96, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x4a2c16, roughness: 0.9, side: THREE.BackSide }));
    for (const y of [-H * 0.32, H * 0.32]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, 0.006, 6, 18), iron);
      band.rotation.x = Math.PI / 2; band.position.y = y; mug.add(band);
    }
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.011, 6, 12, Math.PI), wood);
    handle.rotation.z = -Math.PI / 2; handle.position.set(-R - 0.002, 0, 0);   // 손잡이는 -X(오른손 쪽)
    const liquid = new THREE.Mesh(new THREE.CircleGeometry(R * 0.85, 14), liqMat); liquid.rotation.x = -Math.PI / 2;
    const foam = new THREE.Mesh(new THREE.CircleGeometry(R * 0.86, 14), foamMat); foam.rotation.x = -Math.PI / 2;
    mug.userData = { liquid, foam, H };
    mug.add(body, bottom, inner, handle, liquid, foam);
    mug.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }
  mug.visible = false;
  mug.rotation.order = 'YXZ';
  scene.add(mug);
  function setFill(f) {   // 0..1
    const { liquid, foam, H } = mug.userData;
    liquid.visible = foam.visible = f > 0.02;
    liquid.position.y = -H / 2 + H * 0.92 * f;
    foam.position.y = liquid.position.y + 0.004;
  }

  /* ── 상태 ── */
  const S = {
    seat: null, phase: 'none', t: 0,           // none | sitting | seated | standing
    from: new V(), fromYaw: 0, seatedAt: 0,
    drink: null, serveT: 0, sips: 0, sipT: -1, sipped: false,
    coins: START_COINS, drinks: 0, drunk: 0,
    eDown: false, eT: 0, eUsed: false, candidate: null,
    camPos: new V(), camLook: new V(), camInit: false,
  };
  const _v = new V(), _v2 = new V(), _v3 = new V(), _pole = new V(), _tgt = new V(), _seatPos = new V();
  const _q = new THREE.Quaternion();
  const smooth = x => x * x * (3 - 2 * x);

  const blocked = () =>
    (isBlocked && isBlocked()) || document.body.classList.contains('intro-on') || document.body.dataset.view === 'doc';

  function seatBroken(seat) {
    const m = seat.mesh; if (!m) return false;
    _v.set(0, 1, 0).applyQuaternion(m.quaternion);
    return _v.y < 0.85 || (seat.hx !== undefined && (Math.abs(m.position.x - seat.hx) > 0.3 || Math.abs(m.position.z - seat.hz) > 0.3));
  }
  function seatXZ(seat, out) { return seat.mesh ? out.set(seat.mesh.position.x, 0, seat.mesh.position.z) : out.set(seat.x, 0, seat.z); }
  function seatTop(seat) { return seat.mesh ? seat.mesh.position.y + 0.21 : (seat.y || 0) + 0.42; }

  function findSeat(pos) {
    const api = getNpcs && getNpcs();
    if (api && api.freeSeatNear) return api.freeSeatNear(pos, SIT_R) || null;
    let best = null, bd = SIT_R;
    for (const s of stalls) for (const seat of s.seats) {
      if (seat.owner || seatBroken(seat)) continue;
      seatXZ(seat, _v);
      const d = Math.hypot(_v.x - pos.x, _v.z - pos.z);
      if (d < bd) { bd = d; best = seat; }
    }
    return best;
  }
  function reserve(seat) {
    const api = getNpcs && getNpcs();
    if (api && api.reserveSeat) return api.reserveSeat(seat, PLAYER_OWNER) !== false;
    if (seat.owner) return false;
    seat.owner = PLAYER_OWNER; return true;
  }
  function release(seat) {
    const api = getNpcs && getNpcs();
    if (api && api.releaseSeat) api.releaseSeat(seat);
    else if (seat.owner === PLAYER_OWNER) seat.owner = null;
  }

  /* 의자 앉는 방향: seat.rotY(테이블을 본다). 없으면 테이블 쪽 */
  function seatYaw(seat) {
    if (seat.rotY !== undefined) return seat.rotY;
    const s = seat.stall; return s ? Math.atan2(s.x - seat.x, s.z - seat.z) : 0;
  }

  function sit(seat) {
    if (!seat || S.phase !== 'none' || !reserve(seat)) return false;
    poser.ensure();
    S.seat = seat; S.phase = 'sitting'; S.t = 0;
    S.from.copy(person.position); S.fromYaw = person.rotation.y;
    S.camInit = false;
    if (poser.rig) { poser.save(); measureHip(); }
    promptEl.hidden = true;
    if (onSit) onSit(seat);
    renderPanel();
    panel.hidden = false;
    return true;
  }
  const hipLocal = new V(0, 0.95, 0);
  function measureHip() {
    const p0 = _v3.copy(person.position), q0 = _q.copy(person.quaternion);
    person.position.set(0, 0, 0); person.quaternion.identity(); person.updateMatrixWorld(true);
    poser.frame(); poser.baseIdle(); person.updateMatrixWorld(true);
    poser.rig.hips.getWorldPosition(hipLocal);
    person.position.copy(p0); person.quaternion.copy(q0);
  }
  function standUp() {
    if (S.phase !== 'seated' && S.phase !== 'sitting') return;
    S.phase = 'standing'; S.t = 0; S.sipT = -1;
    // 의자 바깥쪽(테이블 반대편)으로 일어선다, 테이블을 본 채로
    const yaw = seatYaw(S.seat); seatXZ(S.seat, _seatPos);
    S.from.set(_seatPos.x - Math.sin(yaw) * 0.6, S.from.y, _seatPos.z - Math.cos(yaw) * 0.6);
    S.fromYaw = yaw;
    panel.hidden = true;
  }
  function finishStand() {
    const seat = S.seat, yaw = seatYaw(seat);
    if (poser.rig) poser.restore();
    // 의자 바깥쪽(테이블 반대편)에 세운다
    seatXZ(seat, _seatPos);
    person.position.set(_seatPos.x - Math.sin(yaw) * 0.6, S.from.y, _seatPos.z - Math.cos(yaw) * 0.6);
    person.rotation.set(0, yaw, 0);
    release(seat);
    S.seat = null; S.phase = 'none';
    mug.visible = false;
    if (S.drink && S.drink.phase === 'wait') S.drink = null;   // 아직 안 나온 술은 취소
    if (onStand) onStand(yaw);
  }

  function order(id) {
    if (S.phase !== 'seated' && S.phase !== 'sitting') return false;
    if (S.drink) { say('먼저 잔부터 비우세요~'); return false; }
    const d = DRINKS.find(x => x.id === id); if (!d) return false;
    let line;
    if (S.coins >= d.price) { S.coins -= d.price; line = LINES_ORDER[(Math.random() * LINES_ORDER.length) | 0]; }
    else line = LINES_DEBT[(Math.random() * LINES_DEBT.length) | 0];
    S.drink = { def: d, phase: 'wait' }; S.serveT = SERVE_DELAY;
    say(`${line} <b>${d.name}</b>`);
    if (onOrder) onOrder(d);
    renderPanel();
    return true;
  }
  function serve() {
    const d = S.drink.def;
    S.drink.phase = 'hold'; S.sips = SIP_COUNT;
    liqMat.color.setHex(d.liquid); foamMat.color.setHex(d.foam);
    setFill(1); mug.visible = true; mug.scale.setScalar(0.01);
    clunk();
    // 그 가판대 주인이 잔을 내민다 (npcs.barkeeperServe)
    const api = getNpcs && getNpcs();
    if (api && api.barkeeperServe && api.stalls && S.seat) { const si = api.stalls.indexOf(S.seat.stall); if (si >= 0) api.barkeeperServe(si); }
    say(`여기 있어요, ${d.name} 한 잔!`);
    renderPanel();
  }
  function sip() {
    if (!S.drink || S.drink.phase !== 'hold' || S.sipT >= 0 || S.phase !== 'seated') return false;
    S.sipT = 0; S.sipped = false;
    return true;
  }

  function renderPanel() {
    coinEl.textContent = S.coins;
    const holding = S.drink && S.drink.phase === 'hold';
    const waiting = S.drink && S.drink.phase === 'wait';
    for (const it of items) it.disabled = !!S.drink;
    drinkBtn.disabled = !holding;
    if (waiting) stEl.textContent = `${S.drink.def.name} 나오는 중…`;
    else if (holding) stEl.innerHTML = `${S.drink.def.name} <span class="sips">${'<b></b>'.repeat(S.sips)}${'<b class="e"></b>'.repeat(SIP_COUNT - S.sips)}</span>`;
    else stEl.textContent = S.drinks ? `${S.drinks}잔째… 한 잔 더?` : '무엇을 드릴까요?';
    const lv = Math.min(5, Math.ceil(S.drunk - 1e-6));
    dots.forEach((b, i) => b.classList.toggle('on', i < lv));
  }

  /* ── 입력 ── */
  promptEl.addEventListener('click', e => { if (S.candidate) sit(S.candidate); if (e.detail > 0) promptEl.blur(); });
  panel.addEventListener('click', e => {
    const it = e.target.closest('.it');
    if (it) order(it.dataset.id);
    else if (e.target.closest('.drink')) sip();
    else if (e.target.closest('.up')) standUp();
    const b = e.target.closest('button'); if (b && e.detail > 0) b.blur();   // Space(브레이크)가 버튼을 다시 누르지 않게
  });
  panel.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); });
  const onKeyDown = e => {
    if (e.ctrlKey || e.metaKey || e.altKey || blocked()) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.code === 'KeyE') {
      e.preventDefault();
      if (e.repeat) return;
      if (S.phase === 'none') { if (S.candidate) sit(S.candidate); return; }
      if (S.phase === 'seated') { S.eDown = true; S.eT = 0; S.eUsed = false; }
      return;
    }
    if (S.phase === 'seated' || S.phase === 'sitting') {
      const n = /^Digit([1-4])$/.exec(e.code) || /^Numpad([1-4])$/.exec(e.code);
      if (n) { e.preventDefault(); order(DRINKS[+n[1] - 1].id); return; }
      if (e.code === 'Escape') standUp();
    }
  };
  const onKeyUp = e => {
    if (e.code !== 'KeyE' || !S.eDown) return;
    S.eDown = false;
    if (!S.eUsed && S.phase === 'seated') standUp();     // 짧게 = 일어나기
  };
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);

  /* ── 자세 ── */
  function poseSeated(sipAmt) {
    const r = poser.rig;
    poser.baseIdle();
    poser.leg(1, -86, 9, 88);
    poser.leg(-1, -84, 7, 86);
    poser.rotXYZ(r.chest, 6 + sipAmt * -14, 0, 0);       // 마실 땐 고개·가슴을 살짝 젖힌다
    // 왼손: 무릎 위
    poser.rel(_tgt, r.hips, 0.13, 0.06, 0.34);
    poser.rel(_pole, r.armL[0], 0.5, -0.8, -0.5);
    poser.ik(1, _tgt, _pole);
    // 오른손: 무릎 위 → (잔이 있으면) 테이블 위로 → 입으로
    const holding = mug.visible;
    if (holding) {
      poser.rel(_v, r.hips, -0.16, 0.24, 0.4);
      poser.rel(_v2, r.head, -0.05, -0.03, 0.19);
      _tgt.lerpVectors(_v, _v2, sipAmt);
    } else poser.rel(_tgt, r.hips, -0.13, 0.06, 0.34);
    poser.rel(_pole, r.armR[0], -0.6, -0.8, -0.3 - sipAmt * 0.3);
    poser.ik(-1, _tgt, _pole);
  }
  function placeMug(sipAmt, dt) {
    const r = poser.rig;
    if (!r) return;
    r.armR[2].getWorldPosition(_v);               // 손목
    r.armR[1].getWorldPosition(_v2);              // 팔꿈치
    _v3.subVectors(_v, _v2).normalize();          // 아래팔 방향
    _v.addScaledVector(_v3, 0.06);                // 손바닥 근처
    poser.dir(_v2, 0.075, 0.0, 0);                // 잔 몸통은 손 안쪽(왼쪽)에
    mug.position.copy(_v).add(_v2);
    mug.rotation.set(-sipAmt * 1.25, person.rotation.y, 0);
    const s = mug.scale.x; if (s < 1) mug.scale.setScalar(Math.min(1, s + dt * 5));
  }

  /* ── 매 프레임 ── */
  function update(dt, inp) {
    const onFoot = !inp || inp.onFoot !== false;
    poser.ensure(dt);

    // 취기는 천천히 깬다
    if (S.drunk > 0) { S.drunk = Math.max(0, S.drunk - SOBER_RATE * dt); }

    if (S.phase === 'none') {
      mug.visible = false;
      const show = onFoot && !blocked() && person.visible;
      S.candidate = show ? findSeat(person.position) : null;
      if (S.candidate) {
        seatXZ(S.candidate, _v); _v.y = seatTop(S.candidate) + 1.25;
        _v.project(camera);
        const vis = _v.z < 1;
        promptEl.hidden = !vis;
        if (vis) { promptEl.style.left = ((_v.x * 0.5 + 0.5) * innerWidth) + 'px'; promptEl.style.top = ((-_v.y * 0.5 + 0.5) * innerHeight) + 'px'; }
      } else promptEl.hidden = true;
      return;
    }

    const seat = S.seat;
    if (!onFoot) { finishStand(); return; }                                  // 다른 코드가 차에 태웠다
    if ((S.phase === 'seated' || S.phase === 'sitting') && seatBroken(seat)) { say('어이쿠!', '나', 1200); standUp(); }
    if (S.phase === 'seated' && S.t > 0.4 && inp && inp.keys) {
      const k = inp.keys; if (k.fwd || k.back || k.left || k.right) standUp();
    }
    S.t += dt;

    // E 길게 = 한 모금
    if (S.eDown) { S.eT += dt; if (S.eT >= HOLD_E && !S.eUsed) { S.eUsed = true; if (!sip()) say('잔이 비었어요. 한 잔 더 시킬까요?', '주모', 1400); } }

    // 술 나오기
    if (S.drink && S.drink.phase === 'wait') { S.serveT -= dt; if (S.serveT <= 0) serve(); }

    // 한 모금 애니메이션: 올림(0.5) · 머금기(0.6) · 내림(0.6)
    let sipAmt = 0;
    if (S.sipT >= 0) {
      S.sipT += dt;
      const t = S.sipT;
      sipAmt = t < 0.5 ? smooth(t / 0.5) : t < 1.1 ? 1 : smooth(Math.max(0, 1 - (t - 1.1) / 0.6));
      if (!S.sipped && t >= 0.75) {
        S.sipped = true; S.sips--; gulp();
        setFill(S.sips / SIP_COUNT);
        renderPanel();
      }
      if (t >= SIP_TIME) {
        S.sipT = -1;
        if (S.sips <= 0) {     // 한 잔 끝
          S.drinks++; S.drunk += 1; S.drink = null;
          setTimeout(() => { if (!S.drink) mug.visible = false; }, 700);
          say(S.drunk >= DRUNK_AT + 1 ? '어휴, 얼굴이 빨개지셨네요~' : '캬~ 한 잔 더?', '주모', 1600);
          renderPanel();
        }
      }
    }

    // 위치·자세
    const yaw = seatYaw(seat);
    seatXZ(seat, _seatPos);
    const top = seatTop(seat);
    let e = 1;
    if (S.phase === 'sitting') { e = smooth(Math.min(1, S.t / 0.45)); if (S.t >= 0.45) { S.phase = 'seated'; S.t = 0; } }
    if (S.phase === 'standing') { e = 1 - smooth(Math.min(1, S.t / 0.35)); }

    person.rotation.set(0, S.fromYaw + Math.atan2(Math.sin(yaw - S.fromYaw), Math.cos(yaw - S.fromYaw)) * e, 0);
    person.updateMatrixWorld();
    poser.frame();
    if (poser.rig) poseSeated(sipAmt);
    // 엉덩이 뼈가 의자 위(+0.1)에 오게
    _v.set(0, 0.1, 0).sub(hipLocal).applyQuaternion(poser.personQ);
    _v2.set(_seatPos.x, top, _seatPos.z).add(_v);
    person.position.lerpVectors(S.from, _v2, e);
    if (poser.rig) { person.updateMatrixWorld(true); poser.placeFeet(); }
    if (mug.visible) placeMug(sipAmt, dt);

    if (S.phase === 'standing' && S.t >= 0.35) finishStand();
  }

  /* 카메라: 앉으면 어깨 너머로 테이블을 본다. 취기 흔들림은 언제나 위에 얹는다 */
  let swayT = 0;
  function cameraStep(cam, dt, fallback) {
    const active = S.phase === 'sitting' || S.phase === 'seated' || (S.phase === 'standing' && S.t < 0.3);
    if (active && S.seat) {
      const yaw = seatYaw(S.seat), fx = Math.sin(yaw), fz = Math.cos(yaw), top = seatTop(S.seat);
      seatXZ(S.seat, _seatPos);
      // 오른쪽 뒤 비스듬히(뒤 1.5 m, 옆 1.5 m) — 옆얼굴·잔·테이블이 한 화면에
      const rx = -Math.cos(yaw), rz = Math.sin(yaw);
      _v.set(_seatPos.x - fx * 1.5 + rx * 1.5, top + 1.45, _seatPos.z - fz * 1.5 + rz * 1.5);
      _v2.set(_seatPos.x + fx * 0.8, top + 0.55, _seatPos.z + fz * 0.8);
      if (!S.camInit) { S.camPos.copy(cam.position); cam.getWorldDirection(_v3); S.camLook.copy(cam.position).addScaledVector(_v3, 6); S.camInit = true; }
      const k = 1 - Math.exp(-dt * 4);
      S.camPos.lerp(_v, k); S.camLook.lerp(_v2, k);
      cam.position.copy(S.camPos); cam.lookAt(S.camLook);
    } else if (fallback) fallback(dt);

    // 취기
    const a = Math.max(0, Math.min(1, (S.drunk - (DRUNK_AT - 1)) / 3));
    haze.style.opacity = (a * 0.9).toFixed(3);
    if (a > 0 && sway && !reduceMQ.matches) {
      swayT += dt;
      cam.rotateZ(Math.sin(swayT * 0.9) * 0.035 * a);
      cam.rotateX(Math.sin(swayT * 0.53 + 1) * 0.012 * a);
      cam.position.x += Math.sin(swayT * 0.61) * 0.07 * a;
      cam.position.z += Math.cos(swayT * 0.47) * 0.05 * a;
    }
    return active;
  }

  return {
    get seated() { return S.phase !== 'none'; },
    get phase() { return S.phase; },
    get drinks() { return S.drinks; },
    get drunk() { return S.drunk; },
    get coins() { return S.coins; },
    get holding() { return !!(S.drink && S.drink.phase === 'hold'); },
    get candidate() { return S.candidate; },
    update, cameraStep, order, sip, standUp, poser,
    sitNearest() { const s = findSeat(person.position); return s ? sit(s) : false; },
    setSway(on) { sway = !!on; },
    setDrunk(v) { S.drunk = Math.max(0, v); renderPanel(); },
    dispose() {
      if (S.seat) finishStand();
      removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp);
      promptEl.remove(); panel.remove(); toast.remove(); haze.remove();
      scene.remove(mug);
    }
  };
}
