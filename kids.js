/* ════════════════════════════════════════════════════════════════════
   kids.js — 상호랜드 마을 아이들 (7명: 남 2·여 2 모델 + 색만 바꾼 3명)
     models/npc/npc-kid-{tom,finn,ella,mina}.glb  (어른과 같은 뼈 18개·동작 10개 + Wave, 키 1.22~1.36 m)
     tools/blender/kids/ 로 다시 만든다.

   하는 일 (모두 귀엽고 착하게 — 아이들은 절대 맞지 않는다)
     · 술래잡기: 두 무리(4명·3명)가 놀이터에서 술래를 정해 쫓고 도망. 잡히면 "잡았다!" / "꺄르르" 하고 술래가 바뀐다.
     · 오리 새끼 줄: 플레이어가 걸어서(천천히) 가까이 2초쯤 있으면 근처 아이들이 한 줄로 졸졸 따라온다(30초쯤).
       따라오는 중에 주먹을 휘두르면(punch()) 아이들이 허공에 "얍! 슉슉!" 섀도복싱을 따라 한다.
     · cheer(pos): 낚시 성공·드롭킥 때 PM 이 부르면 근처 아이들이 손을 흔들며 펄쩍펄쩍 "우와~!"
     · 동물 쫓기: getAnimals() 가 강아지·고양이·닭·양·토끼 위치를 주면 가끔 우르르 달려가 "멍멍아~" 하고 깔깔.
     · 겨울: 눈싸움 (작은 눈덩이가 포물선으로 날아가 퍽! 하얀 가루). 가끔 플레이어에게도 하나 (화면에 눈 자국, 해 없음).
     · 밤(getNight() > 0.6): 손 흔들고 맵 가장자리로 걸어가 사라진다 → 아침(< 0.35)에 다시 놀러 온다.
     · 맞지 않는다: 주먹(punch())이 가까우면 옆으로 폴짝 "메롱~", 달려들면 비키고, 차가 오면 미리 옆으로 뛰어 비킨다.
       npcs.list() 에 들어가지 않으므로 주먹·발차기·무기·폭발 대상이 아니다. 넘어지는 동작도 쓰지 않는다.
     · 가볍게: 아이 7명, 45 m 밖은 애니메이션 갱신을 건너뛰고, 90 m 밖은 숨긴다. update 안에서 할당 없음.

   ── portfolio.js 연결 (PM 이 넣는다) ──
     ① 위쪽 let 묶음에:  let kids = null;
     ② animals 블록 아래 (stations, animals 가 만들어진 뒤):
        {
          const { createKids } = await import('./kids.js');
          createKids({
            THREE, scene, GLTFLoader, dracoLoader: draco, groundY, pathX,
            bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
            stalls: stations.map(s => ({ x: s.group.position.x, z: s.group.position.z })),
            getPlayerPos: () => activePos(),
            isOnFoot: () => player.mode === 'onfoot',
            getNight: () => night,
            getSeason: () => seasons.season,
            getNpcs: () => npcs,
            getAnimals: () => animals,                  // animals.list() 를 읽기만 한다 (배열을 줘도 된다)
            onEvent: text => toast(text, 2200),
          }).then(k => { kids = k; }).catch(e => console.warn('[kids]', e));
        }
     ③ step(dt) 안, animals.update 다음 줄:   if (kids) kids.update(dt, t);
     ④ 반응 연결 (선택, 한 줄씩):
        - 맨손 주먹: attachGrab 의 playPunch 안에  if (kids) kids.punch();
          (따라오는 아이들이 섀도복싱, 가까운 아이는 폴짝 비키며 "메롱~")
        - 드롭킥: playerPunch() 에서 i === 3 일 때  if (kids) kids.cheer(person.position);
        - 물고기 낚았을 때: fishing.js 에 잡힘 콜백이 생기면 그 안에서  if (kids) kids.cheer(person.position);
     콘솔(?test): __kids.list(), __kids.cheer(), __kids.tag(), __kids.snow(true), __kids.follow(), __kids.home()

   옵션: playAreas: [{x, z, r}] 로 놀이터를 직접 줄 수 있다 (기본: 가판대 두 곳 옆 길 바깥 6.5 m).
   ════════════════════════════════════════════════════════════════════ */
import { shareSkeleton, skinBoundsAll, skinLOD } from './perf.js';


const KID_MODELS = [
  { file: 'models/npc/npc-kid-tom.glb', name: '톰' },
  { file: 'models/npc/npc-kid-finn.glb', name: '핀' },
  { file: 'models/npc/npc-kid-ella.glb', name: '엘라' },
  { file: 'models/npc/npc-kid-mina.glb', name: '미나' },
];
/* 같은 모델 재사용 아이: [모델 번호, 이름, 옷 색 hue] */
const EXTRA = [[0, '토리', 0.58], [3, '보미', 0.30], [1, '단이', 0.95]];
const DRACO_CDN = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const NO_TINT = /Skin|Eye|Hair|Leather|Gold|Metal/i;

const WALK_V = 1.05, RUN_V = 3.1;         // 클립 1배속일 때 걸음/달리기 속도 (아이 보폭)
const FAR_ANIM = 45, FAR_HIDE = 90, BUBBLE_DIST = 34;
const FOLLOW_NEAR = 4.5, FOLLOW_TIME = 32, FOLLOW_GAP = 1.05;

const LINES = {
  tagged: ['잡았다!', '너 술래~!', '터치!'],
  giggle: ['꺄르르', '히히히', '으악 잡혔다~', '꺄아~'],
  itStart: ['하나 둘 셋!', '간다~!', '거기 서!'],
  flee: ['메롱~', '못 잡지롱~', '꺄아~!'],
  follow: ['나도 갈래!', '임금님 따라가자~', '줄 서! 줄!', '오리 행진~'],
  followEnd: ['재밌었다!', '또 놀아 주세요~', '안녕~!'],
  tooFast: ['너무 빨라요~', '헥헥… 기다려요~'],
  box: ['얍!', '슉슉!', '하앗!', '받아라~ (허공)'],
  dodge: ['메롱~', '안 맞지롱~', '헤헤 못 맞혀요~'],
  car: ['으악 빵빵!', '메롱~ 안 치이지롱', '피해라~!'],
  cheer: ['우와~!', '멋져요!', '임금님 최고!', '한 번 더!', '대단해요!'],
  animal: { dog: '멍멍아~!', cat: '야옹아 이리 와~', chicken: '꼬꼬야 기다려!', sheep: '양이다~ 복슬복슬!', rabbit: '토끼야~ 깡총!' },
  animalGiggle: ['깔깔깔', '잡을 수 있어!', '귀여워~'],
  snowThrow: ['받아라!', '눈덩이 공격~', '에잇!'],
  snowHit: ['으앗 차가워!', '맞았다~ 히히', '복수다!'],
  snowPlayer: ['임금님도 받아라~!', '헤헤 맞았지롱'],
  wave: ['안녕하세요!', '임금님이다!', '같이 놀아요~'],
  home: ['엄마가 부른다~', '내일 또 놀자!', '잘 자~'],
  morning: ['놀자~!', '아침이다!'],
};

export async function createKids({
  THREE, scene, GLTFLoader, DRACOLoader = null, dracoLoader = null, dracoPath = DRACO_CDN,
  groundY = () => 0, pathX = () => 0, bounds = { minX: -42, maxX: 42, minZ: -84, maxZ: 84 },
  getPlayerPos = null, isOnFoot = () => true, getNight = () => 0, getSeason = () => 'autumn',
  getNpcs = null, getAnimals = null, say: sayCb = null, onEvent = null, stalls = [], playAreas = null,
  count = 7, debug = null,
}) {
  const { clone: skeletonClone } = await import('three/addons/utils/SkeletonUtils.js');
  let draco = dracoLoader, ownDraco = false;
  if (!draco) {
    const DL = DRACOLoader || (await import('three/addons/loaders/DRACOLoader.js')).DRACOLoader;
    draco = new DL(); draco.setDecoderPath(dracoPath); ownDraco = true;
  }
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const srcs = (await Promise.all(KID_MODELS.map(m => loader.loadAsync(m.file).catch(() => { console.warn('[kids] 모델 없음:', m.file); return null; }))));
  if (ownDraco) draco.dispose();
  if (!srcs.some(Boolean)) return { update() {}, list: () => [], dispose() {}, cheer() {}, punch() {} };

  const rnd = Math.random, rr = (a, b) => a + (b - a) * rnd();
  const pick = a => a[Math.floor(rnd() * a.length)];
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ── 놀이터 두 곳 ── */
  const areas = [];
  if (playAreas && playAreas.length) for (const a of playAreas) areas.push({ x: a.x, z: a.z, r: a.r || 6 });
  else {
    const ss = stalls.slice().sort((a, b) => Math.abs(a.z) - Math.abs(b.z));
    for (const s of ss) {
      if (areas.length >= 2) break;
      const side = Math.sign(s.x - pathX(s.z)) || 1;
      const a = { x: clamp(s.x + side * 6.5, bounds.minX + 8, bounds.maxX - 8), z: s.z + 4, r: 5.5 };
      if (areas.every(b => Math.hypot(b.x - a.x, b.z - a.z) > 14)) areas.push(a);
    }
    while (areas.length < 2) { const z = areas.length ? -24 : 6; areas.push({ x: pathX(z) + 9, z, r: 5.5 }); }
  }

  /* ── 말풍선 (캔버스 스프라이트 4개 풀) ── */
  const bubbles = [];
  for (let k = 0; k < 4; k++) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 72;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false });
    const sp = new THREE.Sprite(mat); sp.scale.set(1.3, 0.37, 1); sp.renderOrder = 20; sp.visible = false;
    scene.add(sp);
    bubbles.push({ sp, ctx: cv.getContext('2d'), tex, mat, k: null, t: 0 });
  }
  function drawBubble(b, text) {
    const c = b.ctx;
    c.clearRect(0, 0, 256, 72);
    c.font = '800 30px Pretendard, system-ui, sans-serif';
    const tw = c.measureText(text).width;
    if (tw > 210) c.font = `800 ${Math.max(16, Math.floor(30 * 210 / tw))}px Pretendard, system-ui, sans-serif`;
    const w = Math.min(244, Math.min(tw, 210) + 34), x0 = 128 - w / 2;
    c.fillStyle = 'rgba(255,253,236,0.97)'; c.strokeStyle = 'rgba(60,40,90,0.85)'; c.lineWidth = 4;
    c.beginPath();
    c.moveTo(x0 + 16, 4); c.lineTo(x0 + w - 16, 4); c.quadraticCurveTo(x0 + w - 2, 4, x0 + w - 2, 20);
    c.lineTo(x0 + w - 2, 38); c.quadraticCurveTo(x0 + w - 2, 54, x0 + w - 16, 54);
    c.lineTo(140, 54); c.lineTo(128, 68); c.lineTo(118, 54);
    c.lineTo(x0 + 16, 54); c.quadraticCurveTo(x0 + 2, 54, x0 + 2, 38);
    c.lineTo(x0 + 2, 20); c.quadraticCurveTo(x0 + 2, 4, x0 + 16, 4);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#3a2350'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 128, 30);
    b.tex.needsUpdate = true;
  }
  function say(k, text, life = 1.5) {
    if (!k.shown || k.dist > BUBBLE_DIST) return;
    if (sayCb) { try { sayCb(k, text, life); } catch (e) { /* 무시 */ } }
    let b = k.bubble;
    if (!b) {
      for (const q of bubbles) { if (!q.k) { b = q; break; } if (!b || q.t < b.t) b = q; }
      if (b.k) b.k.bubble = null;
      b.k = k; k.bubble = b;
    }
    drawBubble(b, text);
    b.t = life; b.sp.visible = true; b.mat.opacity = 1;
  }
  function updateBubbles(dt) {
    for (const b of bubbles) {
      const k = b.k;
      if (!k) continue;
      b.t -= dt;
      if (b.t <= 0 || !k.shown) { b.sp.visible = false; k.bubble = null; b.k = null; continue; }
      b.sp.position.set(k.x, k.y + k.hop + 1.72 * k.h, k.z);
      b.mat.opacity = Math.min(1, b.t / 0.3) * k.alpha;
    }
  }

  /* ── 아이 만들기 ── */
  const kids = [];
  const tint = new THREE.Color();
  function makeKid(mi, name, hue, idx) {
    const src = srcs[mi] || srcs.find(Boolean);
    const model = skeletonClone(src.scene);
    const meshes = [], mats = [];
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      meshes.push(o);
      const one = m => {
        const c = m.clone(); mats.push(c);
        if (hue != null && !NO_TINT.test(m.name)) {
          tint.setHSL(hue, 0.55, 0.62);
          c.color.multiply(tint).multiplyScalar(1.5);
        }
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
    });
    skinBoundsAll(THREE, model, 1.6);   // 성능: 모델 전체 경계 구 → 화면 밖이면 안 그린다 (예전엔 frustumCulled=false 로 늘 그렸다)
    shareSkeleton(model);   // 성능: 부위마다 따로 있던 뼈대를 하나로 (perf.js)
    const lod = skinLOD(THREE, model, { far: 22 });   // 22 m 넘으면 부위 5개 대신 정점색 한 덩어리
    const root = new THREE.Group(); root.name = 'Kid_' + name;
    root.add(model);
    scene.add(root);
    const bone = nm => model.getObjectByName(nm) || model.getObjectByName(nm.replace('.', ''));
    const bones = { armL: bone('UpperArm.L'), armR: bone('UpperArm.R'), foreL: bone('LowerArm.L'), foreR: bone('LowerArm.R'), spine: bone('Spine') };
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const clip of src.animations) {
      const nm = clip.name.split('|').pop();
      const a = mixer.clipAction(clip);
      if (nm === 'GetUp' || nm === 'Fall') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      actions[nm] = a;
    }
    /* 키 (모델 단위 → 화면 높이 비율, 말풍선 높이용) */
    const box = new THREE.Box3().setFromObject(model);
    const h = Math.max(1.0, box.max.y - box.min.y) / 1.3;
    return {
      idx, name, root, model, mixer, actions, cur: null, curName: '', meshes, mats, bones, h, lod,
      x: 0, z: 0, y: 0, rot: 0, vx: 0, vz: 0, speed: 0, hop: 0, hopV: 0,
      group: null, mode: 'play', it: false, immune: 0, frozen: 0, tx: 0, tz: 0, retarget: 0,
      dodgeT: 0, dodgeX: 0, dodgeZ: 0, sayCD: rr(0, 3), boxT: 0, boxN: 0, throwT: rr(1, 3), throwArm: 0,
      cheerT: 0, cx: 0, cz: 0, waveT: 0, alpha: 1, shown: true, dist: 0, mixAcc: 0, bubble: null, slot: 0, homeX: 0, homeZ: 0,
      waveCD: rr(4, 10), animalT: 0,
    };
  }
  let idx = 0;
  for (let i = 0; i < KID_MODELS.length && idx < count; i++) if (srcs[i]) kids.push(makeKid(i, KID_MODELS[i].name, null, idx++));
  for (const [mi, nm, hue] of EXTRA) { if (idx >= count) break; kids.push(makeKid(mi, nm, hue, idx++)); }

  /* 무리 나누기: 0번 놀이터 4명, 1번 놀이터 나머지 */
  const groups = areas.slice(0, 2).map((a, gi) => ({ gi, area: a, kids: [], mode: 'tag', modeT: rr(25, 40), it: null, animal: null, lastIt: null }));
  kids.forEach((k, i) => {
    const g = groups[i < 4 ? 0 : 1] || groups[0];
    k.group = g; g.kids.push(k);
    const a = g.area, an = rnd() * Math.PI * 2, r = rr(1, a.r * 0.8);
    k.x = a.x + Math.cos(an) * r; k.z = a.z + Math.sin(an) * r; k.y = groundY(k.x, k.z);
    k.rot = rnd() * Math.PI * 2;
    k.tx = k.x; k.tz = k.z;
  });
  for (const g of groups) if (g.kids.length) { g.it = g.kids[0]; g.it.it = true; }

  function play(k, name, fade = 0.2) {
    const a = k.actions[name] || k.actions.Idle;
    if (!a || k.cur === a) return;
    a.reset(); a.setEffectiveTimeScale(1); a.setEffectiveWeight(1); a.fadeIn(fade); a.play();
    if (k.cur) k.cur.fadeOut(fade);
    k.cur = a; k.curName = name;
  }
  function setAlpha(k, a) {
    if (a === k.alpha) return;
    const tr = a < 0.999;
    for (const m of k.mats) { if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = a; }
    k.alpha = a;
  }

  /* ── 눈덩이 (겨울) ── */
  const snowGeo = new THREE.SphereGeometry(0.07, 8, 6);
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.9 });
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
  const balls = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(snowGeo, snowMat); m.visible = false; m.castShadow = true; scene.add(m);
    const puff = new THREE.Group();
    for (let j = 0; j < 6; j++) { const p = new THREE.Mesh(snowGeo, puffMat); puff.add(p); }
    puff.visible = false; scene.add(puff);
    balls.push({ m, puff, on: false, t: 0, vx: 0, vy: 0, vz: 0, from: null, target: null, atPlayer: false, puffT: 0 });
  }
  function throwBall(k, tx, ty, tz, target, atPlayer) {
    const b = balls.find(q => !q.on && q.puffT <= 0);
    if (!b) return;
    const sx = k.x + Math.sin(k.rot) * 0.2, sy = k.y + 1.25 * k.h, sz = k.z + Math.cos(k.rot) * 0.2;
    const dx = tx - sx, dz = tz - sz, d = Math.hypot(dx, dz), T = clamp(d / 9, 0.45, 1.1);
    b.m.position.set(sx, sy, sz);
    b.vx = dx / T; b.vz = dz / T; b.vy = (ty - sy) / T + 0.5 * 12 * T;
    b.on = true; b.t = 0; b.from = k; b.target = target; b.atPlayer = atPlayer; b.m.visible = true;
  }
  function splat(b) {
    b.on = false; b.m.visible = false; b.puffT = 0.6;
    b.puff.position.copy(b.m.position); b.puff.visible = true;
    b.puff.children.forEach((p, j) => { p.position.set(0, 0, 0); p.userData.v = [(rnd() - 0.5) * 2.2, rnd() * 1.6 + 0.4, (rnd() - 0.5) * 2.2]; p.scale.setScalar(0.6); });
  }
  function updateBalls(dt, P) {
    for (const b of balls) {
      if (b.on) {
        b.t += dt; b.vy -= 12 * dt;
        const p = b.m.position;
        p.x += b.vx * dt; p.y += b.vy * dt; p.z += b.vz * dt;
        let hit = false;
        if (b.target && Math.hypot(p.x - b.target.x, p.z - b.target.z) < 0.35 && p.y < b.target.y + 1.4 * b.target.h && p.y > b.target.y + 0.3) {
          hit = true;
          const t = b.target;
          if (t.sayCD <= 0) { say(t, pick(LINES.snowHit), 1.3); t.sayCD = 2; }
          t.hopV = 2.2;
        } else if (b.atPlayer && P && Math.hypot(p.x - P.x, p.z - P.z) < 0.5 && p.y < P.y + 1.9) {
          hit = true;
          if (isOnFoot()) screenSplat();
          if (b.from && b.from.sayCD <= 0) { say(b.from, pick(LINES.snowPlayer), 1.6); b.from.sayCD = 2; }
        }
        if (hit || p.y < groundY(p.x, p.z) + 0.05 || b.t > 3) splat(b);
      } else if (b.puffT > 0) {
        b.puffT -= dt;
        const u = 1 - b.puffT / 0.6;
        puffMat.opacity = 0.9 * (1 - u);
        for (const c of b.puff.children) { const v = c.userData.v; c.position.set(v[0] * u * 0.35, v[1] * u * 0.3, v[2] * u * 0.35); c.scale.setScalar(0.6 + u * 0.8); }
        if (b.puffT <= 0) b.puff.visible = false;
      }
    }
  }
  /* 화면 눈 자국 (작은 DOM, 클릭 막지 않음) */
  let splatEl = null, splatTimer = 0;
  function screenSplat() {
    if (typeof document === 'undefined') return;
    if (!splatEl) {
      splatEl = document.createElement('div');
      splatEl.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:40;opacity:0;transition:opacity .6s';
      splatEl.innerHTML = '<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0">'
        + '<g fill="rgba(250,252,255,0.92)"><circle cx="31" cy="38" r="9"/><circle cx="38" cy="33" r="5"/><circle cx="24" cy="44" r="4"/><circle cx="36" cy="46" r="3.5"/>'
        + '<circle cx="27" cy="30" r="2.5"/><circle cx="42" cy="41" r="2"/><circle cx="20" cy="36" r="1.8"/></g></svg>';
      document.body.appendChild(splatEl);
    }
    clearTimeout(splatTimer);
    splatEl.style.transition = 'opacity .08s'; splatEl.style.opacity = '1';
    splatTimer = setTimeout(() => { if (splatEl) { splatEl.style.transition = 'opacity 1.2s'; splatEl.style.opacity = '0'; } }, 900);
  }

  /* ── 플레이어 추적 (속도·흔적) ── */
  const trail = [];   // 플레이어 발자취 (오리 줄용) — 0.35 m 마다 기록, 최대 40
  for (let i = 0; i < 40; i++) trail.push({ x: 0, z: 0 });
  let trailN = 0, trailHead = 0, lastPX = NaN, lastPZ = NaN, pvx = 0, pvz = 0, pSpeed = 0, slowNear = 0;
  let followers = [], followT = 0, fastT = 0;
  const _P = { x: 0, y: 0, z: 0 };

  function trailAt(dist) {   // 발자취를 따라 플레이어에서 dist m 뒤 지점
    let acc = 0, px = _P.x, pz = _P.z;
    for (let i = 0; i < trailN; i++) {
      const q = trail[(trailHead - i + 40) % 40];
      const d = Math.hypot(q.x - px, q.z - pz);
      if (acc + d >= dist) { const u = (dist - acc) / (d || 1); return [px + (q.x - px) * u, pz + (q.z - pz) * u]; }
      acc += d; px = q.x; pz = q.z;
    }
    return [px, pz];
  }

  function startFollow() {
    const near = kids.filter(k => k.mode === 'play' && k.shown && k.dist < 12).sort((a, b) => a.dist - b.dist).slice(0, 4);
    if (near.length < 1) return;
    followers = near; followT = FOLLOW_TIME; fastT = 0;
    near.forEach((k, i) => { k.mode = 'follow'; k.slot = i; if (k.it) { k.it = false; } });
    for (const g of groups) if (g.it && g.it.mode === 'follow') { g.it = null; }
    say(near[0], pick(LINES.follow), 2.0);
    if (near[1]) setTimeout(() => near[1] && say(near[1], pick(LINES.follow), 1.8), 700);
    if (onEvent) onEvent('아이들이 오리 새끼처럼 졸졸 따라와요!');
  }
  function endFollow(fast) {
    for (const k of followers) { k.mode = 'play'; k.boxT = 0; }
    if (followers.length) say(followers[0], pick(fast ? LINES.tooFast : LINES.followEnd), 1.8);
    followers = []; followT = 0; slowNear = -12;   // 잠깐은 다시 안 따라온다
  }

  /* ── 행동 목표 정하기 ── */
  function areaOf(k) { return k.group.area; }
  function pickTagTarget(g) {
    const live = g.kids.filter(k => k.mode === 'play' && k.shown);
    if (!g.it || g.it.mode !== 'play' || !g.it.shown) {
      g.it = live[Math.floor(rnd() * live.length)] || null;
      for (const k of g.kids) k.it = k === g.it;
    }
    return live;
  }
  function friendlyAnimal(g) {
    let src = getAnimals ? getAnimals() : null;
    if (!src) return null;
    const arr = Array.isArray(src) ? src : (typeof src.list === 'function' ? src.list() : null);
    if (!arr) return null;
    let best = null, bd = 22;
    for (const a of arr) {
      const kind = a.kind || a.type;
      if (!LINES.animal[kind] || a.x == null) continue;
      const d = Math.hypot(a.x - g.area.x, a.z - g.area.z);
      if (d < bd) { bd = d; best = a; }
    }
    return best ? { kind: best.kind || best.type, id: best.id, x: best.x, z: best.z, ref: best } : null;
  }
  function animalPos(g) {   // 쫓는 동안 최신 위치 (list() 는 새 객체를 주므로 id 로 다시 찾는다, 0.5초마다)
    const an = g.animal;
    if (!an || an.refresh > 0) return;
    an.refresh = 0.5;
    const src = getAnimals ? getAnimals() : null;
    const arr = Array.isArray(src) ? src : (src && typeof src.list === 'function' ? src.list() : null);
    if (!arr) return;
    for (const a of arr) if ((a.id != null && a.id === an.id) || a === an.ref) { an.x = a.x; an.z = a.z; return; }
  }
  function nextGroupMode(g) {
    const winter = getSeason && getSeason() === 'winter';
    const r = rnd();
    if (winter && r < 0.55) { g.mode = 'snow'; g.modeT = rr(18, 30); }
    else if (r < 0.75) {
      const an = friendlyAnimal(g);
      if (an) { g.mode = 'animal'; g.animal = an; an.refresh = 0; g.modeT = rr(7, 11); const k0 = g.kids.find(k => k.mode === 'play'); if (k0) say(k0, LINES.animal[an.kind], 1.8); }
      else { g.mode = 'tag'; g.modeT = rr(25, 40); }
    } else if (r < 0.85) { g.mode = 'rest'; g.modeT = rr(5, 8); }
    else { g.mode = 'tag'; g.modeT = rr(25, 40); }
    if (g.mode === 'tag') { pickTagTarget(g); if (g.it) say(g.it, pick(LINES.itStart), 1.4); }
    else for (const k of g.kids) k.it = false;
  }

  /* 플레이어나 차가 다가오면 비키기 — 아이들은 절대 맞지 않는다 */
  function dodgeFrom(k, fromX, fromZ, dirX, dirZ, dist, line) {
    let sx = -dirZ, sz = dirX;                         // 오는 방향의 옆
    if ((k.x - fromX) * sx + (k.z - fromZ) * sz < 0) { sx = -sx; sz = -sz; }
    k.dodgeX = sx * dist; k.dodgeZ = sz * dist; k.dodgeT = 0.35;
    k.hopV = Math.max(k.hopV, 2.6);
    k.rot = Math.atan2(fromX - k.x, fromZ - k.z);
    if (k.sayCD <= 0) { say(k, pick(line), 1.3); k.sayCD = 2.5; }
  }

  /* ── 밤 ── */
  let homeState = 'day';   // day → leaving → away → coming → day
  let forceHome = 0;
  function goHome() {
    homeState = 'leaving';
    for (const k of kids) {
      if (k.mode === 'follow') endFollow(false);
      k.mode = 'home'; k.it = false;
      const left = k.x - bounds.minX < bounds.maxX - k.x;
      k.homeX = left ? bounds.minX - 2 : bounds.maxX + 2; k.homeZ = k.z + rr(-6, 6);
      if (rnd() < 0.5) say(k, pick(LINES.home), 1.8);
    }
  }
  function comeBack() {
    homeState = 'coming';
    for (const k of kids) {
      const a = areaOf(k);
      const left = a.x - bounds.minX < bounds.maxX - a.x;
      k.x = clamp(a.x + (left ? -14 : 14), bounds.minX + 1, bounds.maxX - 1); k.z = a.z + rr(-4, 4);
      k.y = groundY(k.x, k.z);
      k.mode = 'return'; k.shown = true; k.root.visible = true; setAlpha(k, 0.01);
    }
  }

  /* ════ update ════ */
  const tmp = new THREE.Vector3();
  let time = 0;
  function update(dt, t) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1); time += dt;
    const P0 = getPlayerPos ? getPlayerPos() : null;
    if (P0) { _P.x = P0.x; _P.y = P0.y; _P.z = P0.z; }
    const onFoot = isOnFoot ? !!isOnFoot() : true;

    /* 플레이어 속도·발자취 */
    if (Number.isFinite(lastPX)) {
      const ivx = (_P.x - lastPX) / dt, ivz = (_P.z - lastPZ) / dt;
      if (Math.hypot(ivx, ivz) < 60) { pvx += (ivx - pvx) * Math.min(1, dt * 8); pvz += (ivz - pvz) * Math.min(1, dt * 8); }
    }
    lastPX = _P.x; lastPZ = _P.z; pSpeed = Math.hypot(pvx, pvz);
    const tq = trail[trailHead];
    if (trailN === 0 || Math.hypot(_P.x - tq.x, _P.z - tq.z) > 0.35) {
      trailHead = (trailHead + 1) % 40; trail[trailHead].x = _P.x; trail[trailHead].z = _P.z; trailN = Math.min(40, trailN + 1);
    }

    /* 밤/아침 */
    const night = getNight ? getNight() : 0;
    if (homeState === 'day' && (night > 0.6 || forceHome > 0)) goHome();
    else if (homeState === 'away' && night < 0.35 && forceHome <= 0) comeBack();
    if (forceHome > 0) forceHome -= dt;

    /* 오리 줄 시작/끝 */
    if (homeState === 'day') {
      if (!followers.length) {
        let near = false;
        for (const k of kids) if (k.mode === 'play' && k.shown && k.dist < FOLLOW_NEAR) { near = true; break; }
        if (onFoot && near && pSpeed > 0.25 && pSpeed < 3.2) slowNear += dt;
        else if (slowNear > 0) slowNear = Math.max(0, slowNear - dt * 0.5); else slowNear = Math.min(0, slowNear + dt);
        if (slowNear > 1.8) { slowNear = 0; startFollow(); }
      } else {
        followT -= dt;
        fastT = (!onFoot || pSpeed > 5.2) ? fastT + dt : Math.max(0, fastT - dt);
        const lead = followers[0];
        if (followT <= 0 || fastT > 1.2 || (lead && lead.dist > 22)) endFollow(fastT > 1.2 || !onFoot);
      }
    }

    /* 무리 모드 */
    for (const g of groups) {
      g.modeT -= dt;
      if (g.animal) { g.animal.refresh -= dt; animalPos(g); }
      if (g.modeT <= 0) nextGroupMode(g);
      if (g.mode === 'tag') pickTagTarget(g);
    }

    /* 플레이어/차 위협 계산 (비키기) */
    const threatV = pSpeed;
    const tdx = threatV > 0.1 ? pvx / threatV : 0, tdz = threatV > 0.1 ? pvz / threatV : 0;

    for (const k of kids) {
      k.dist = Math.hypot(k.x - _P.x, k.z - _P.z);
      if (k.sayCD > 0) k.sayCD -= dt;
      if (!k.shown) continue;
      let wantX = k.x, wantZ = k.z, v = 0, clip = 'Idle', face = null;

      /* 차·달려드는 플레이어 → 미리 옆으로 */
      if (k.dodgeT <= 0) {
        const rx = k.x - _P.x, rz = k.z - _P.z;
        const ahead = rx * tdx + rz * tdz, lat = Math.abs(rx * tdz - rz * tdx);
        if (!onFoot && threatV > 2 && ahead > -1 && ahead < 3 + threatV * 0.9 && lat < 2.6) dodgeFrom(k, _P.x, _P.z, tdx, tdz, 3.4 - lat * 0.5, LINES.car);
        else if (onFoot && threatV > 3.5 && ahead > 0 && ahead < 1.6 && lat < 0.8 && k.mode !== 'follow') dodgeFrom(k, _P.x, _P.z, tdx, tdz, 1.4, LINES.dodge);
      }

      const g = k.group, a = g.area;
      if (k.mode === 'follow') {
        const [fx, fz] = trailAt(1.4 + k.slot * FOLLOW_GAP);
        wantX = fx; wantZ = fz;
        const d = Math.hypot(fx - k.x, fz - k.z);
        v = d > 0.25 ? clamp(d * 1.6, 0.6, d > 3 ? 3.2 : 1.8) : 0;
        if (v === 0) face = Math.atan2(_P.x - k.x, _P.z - k.z);
      } else if (k.mode === 'home') {
        wantX = k.homeX; wantZ = k.homeZ; v = 1.15;
        const dEdge = Math.min(k.x - bounds.minX, bounds.maxX - k.x);
        if (dEdge < 6 || Math.hypot(k.x - k.homeX, k.z - k.homeZ) < 4) setAlpha(k, Math.max(0, k.alpha - dt * 0.6));
        if (k.alpha <= 0.01 || Math.hypot(k.x - k.homeX, k.z - k.homeZ) < 1) { k.shown = false; k.root.visible = false; if (k.bubble) k.bubble.t = 0; }
      } else if (k.mode === 'return') {
        wantX = a.x; wantZ = a.z; v = 1.6;
        setAlpha(k, Math.min(1, k.alpha + dt * 0.8));
        if (Math.hypot(k.x - a.x, k.z - a.z) < a.r * 0.8) { k.mode = 'play'; setAlpha(k, 1); if (rnd() < 0.4) say(k, pick(LINES.morning), 1.5); }
      } else if (k.cheerT > 0 && k.mode === 'play') {
        face = Math.atan2(k.cx - k.x, k.cz - k.z); clip = 'Wave';
      } else if (g.mode === 'tag') {
        if (k.frozen > 0) { k.frozen -= dt; clip = k.it ? 'Idle' : 'Idle'; }
        else if (k.it) {
          /* 술래: 가장 가까운 (방금 술래였던 아이 빼고) 아이를 쫓는다 */
          let best = null, bd = 1e9;
          for (const o of g.kids) {
            if (o === k || o.mode !== 'play' || !o.shown || (o === g.lastIt && k.immune > 0)) continue;
            const d = Math.hypot(o.x - k.x, o.z - k.z);
            if (d < bd) { bd = d; best = o; }
          }
          if (k.immune > 0) k.immune -= dt;
          if (best) {
            wantX = best.x; wantZ = best.z; v = 3.0;
            if (bd < 0.55) {
              say(k, pick(LINES.tagged), 1.2); say(best, pick(LINES.giggle), 1.4);
              k.it = false; best.it = true; g.lastIt = k; g.it = best; best.frozen = 1.3; best.immune = 2.5;
              k.hopV = 2.4; best.hopV = 1.8;
            }
          }
        } else {
          /* 도망: 술래 반대쪽, 놀이터 밖으로 나가면 안쪽으로 */
          const it = g.it;
          let fx = 0, fz = 0;
          if (it && it.shown) {
            const dx = k.x - it.x, dz = k.z - it.z, d = Math.hypot(dx, dz) || 1;
            if (d < 4.5) { fx = dx / d; fz = dz / d; v = d < 2.2 ? 2.9 : 2.0; if (d < 1.6 && k.sayCD <= 0 && rnd() < 0.02) { say(k, pick(LINES.flee), 1.2); k.sayCD = 3; } }
          }
          const cx = a.x - k.x, cz = a.z - k.z, cd = Math.hypot(cx, cz);
          if (cd > a.r * 0.6) { const w = (cd - a.r * 0.6) / (a.r * 0.4); fx += cx / cd * w * 1.6; fz += cz / cd * w * 1.6; v = Math.max(v, 1.8); }
          if (v === 0) {   // 술래가 멀면 깡총깡총 서성이기
            k.retarget -= dt;
            if (k.retarget <= 0) { k.retarget = rr(1.5, 3); const an = rnd() * Math.PI * 2, r = rnd() * a.r * 0.6; k.tx = a.x + Math.cos(an) * r; k.tz = a.z + Math.sin(an) * r; }
            const d = Math.hypot(k.tx - k.x, k.tz - k.z);
            if (d > 0.4) { fx = (k.tx - k.x) / d; fz = (k.tz - k.z) / d; v = 1.0; }
          }
          wantX = k.x + fx * 2; wantZ = k.z + fz * 2;
        }
      } else if (g.mode === 'animal' && g.animal) {
        const an = g.animal, dx = an.x - k.x, dz = an.z - k.z, d = Math.hypot(dx, dz);
        const stop = 1.3 + (k.idx % 3) * 0.5;
        if (d > stop) { wantX = an.x - dx / d * stop; wantZ = an.z - dz / d * stop; v = d > 4 ? 2.8 : 1.4; }
        else { face = Math.atan2(dx, dz); clip = (k.idx + Math.floor(time)) % 4 === 0 ? 'Wave' : 'Idle'; if (k.sayCD <= 0 && rnd() < 0.01) { say(k, pick(LINES.animalGiggle), 1.2); k.sayCD = 3; } }
        if (d > 30) g.modeT = 0;   // 너무 멀리 가면 그만
      } else if (g.mode === 'snow') {
        /* 눈싸움: 원 위의 자기 자리에서 서로 던진다 */
        const n = g.kids.length, i = g.kids.indexOf(k);
        const an = (i / n) * Math.PI * 2 + 0.4, r = Math.min(3.6, a.r * 0.7);
        const sx = a.x + Math.cos(an) * r, sz = a.z + Math.sin(an) * r;
        const d = Math.hypot(sx - k.x, sz - k.z);
        if (d > 0.4) { wantX = sx; wantZ = sz; v = d > 2 ? 2.4 : 1.2; }
        else {
          k.throwT -= dt;
          let tgt = null;
          if (k.throwT <= 0.5 && !k.snowTgt) {
            if (onFoot && k.dist < 11 && rnd() < 0.18) k.snowTgt = 'player';
            else { const o = g.kids[(i + 1 + Math.floor(rnd() * (n - 1))) % n]; k.snowTgt = o !== k && o.shown ? o : null; }
          }
          tgt = k.snowTgt;
          if (tgt === 'player') face = Math.atan2(_P.x - k.x, _P.z - k.z);
          else if (tgt) face = Math.atan2(tgt.x - k.x, tgt.z - k.z);
          if (k.throwT <= 0) {
            if (tgt === 'player') { throwBall(k, _P.x, _P.y + 1.4, _P.z, null, true); }
            else if (tgt) { throwBall(k, tgt.x, tgt.y + 0.9 * tgt.h, tgt.z, tgt, false); if (rnd() < 0.3 && k.sayCD <= 0) { say(k, pick(LINES.snowThrow), 1.1); k.sayCD = 2; } }
            k.throwArm = 0.45; k.throwT = rr(1.6, 3.2); k.snowTgt = null;
          }
        }
      } else {   // rest: 서서 숨 고르기 / 플레이어에게 손 흔들기
        face = k.dist < 9 ? Math.atan2(_P.x - k.x, _P.z - k.z) : null;
      }

      /* 플레이어가 가까이 서 있으면 손 흔들기 (가끔) */
      if (k.mode === 'play' && homeState === 'day' && v === 0 && k.dist < 7 && k.dist > 2) {
        k.waveCD -= dt;
        if (k.waveCD <= 0) { k.waveCD = rr(10, 20); k.waveT = 2.2; if (k.sayCD <= 0) { say(k, pick(LINES.wave), 1.6); k.sayCD = 3; } }
      }
      if (k.waveT > 0) { k.waveT -= dt; if (v === 0) { clip = 'Wave'; face = Math.atan2(_P.x - k.x, _P.z - k.z); } }
      if (k.cheerT > 0) { k.cheerT -= dt; if (rnd() < dt * 2.2 && k.hop <= 0.001) k.hopV = 2.4; }

      /* 이동 */
      let mx = 0, mz = 0;
      if (v > 0) {
        const dx = wantX - k.x, dz = wantZ - k.z, d = Math.hypot(dx, dz);
        if (d > 0.05) {
          const step = Math.min(d, v * dt);
          mx = dx / d * step; mz = dz / d * step;
          const tr = Math.atan2(dx, dz), dr = wrap(tr - k.rot), m = 9 * dt;
          k.rot += Math.abs(dr) < m ? dr : Math.sign(dr) * m;
        }
      } else if (face != null) {
        const dr = wrap(face - k.rot), m = 6 * dt;
        k.rot += Math.abs(dr) < m ? dr : Math.sign(dr) * m;
      }
      /* 서로 겹치지 않게 */
      for (const o of kids) {
        if (o === k || !o.shown) continue;
        const dx = k.x - o.x, dz = k.z - o.z, d2 = dx * dx + dz * dz;
        if (d2 < 0.36 && d2 > 1e-6) { const d = Math.sqrt(d2), p = (0.6 - d) * 0.5; mx += dx / d * p; mz += dz / d * p; }
      }
      /* 걸어 다니는 플레이어 몸도 피한다 (따라오는 아이 포함) */
      if (onFoot && k.dist < 0.75 && k.dist > 1e-3) { const p = 0.75 - k.dist; mx += (k.x - _P.x) / k.dist * p; mz += (k.z - _P.z) / k.dist * p; }
      if (k.dodgeT > 0) { const u = Math.min(dt, k.dodgeT) / 0.35; mx += k.dodgeX * u; mz += k.dodgeZ * u; k.dodgeT -= dt; clip = 'Run'; v = Math.max(v, 3); }
      k.x += mx; k.z += mz;
      if (k.mode !== 'home') { k.x = clamp(k.x, bounds.minX + 0.5, bounds.maxX - 0.5); k.z = clamp(k.z, bounds.minZ + 0.5, bounds.maxZ - 0.5); }
      if (!Number.isFinite(k.x) || !Number.isFinite(k.z)) { k.x = a.x; k.z = a.z; }
      k.y = groundY(k.x, k.z);
      k.speed = Math.hypot(mx, mz) / dt;

      /* 폴짝 */
      if (k.hopV > 0 || k.hop > 0) { k.hop += k.hopV * dt; k.hopV -= 12 * dt; if (k.hop <= 0) { k.hop = 0; k.hopV = 0; } }

      /* 동작 고르기 */
      if (clip !== 'Wave' || v > 0) {
        if (k.speed > 1.9) clip = 'Run';
        else if (k.speed > 0.25) clip = 'Walk';
        else if (clip !== 'Wave') clip = 'Idle';
      }
      play(k, clip);
      if (k.cur) {
        if (clip === 'Run') k.cur.timeScale = clamp(k.speed / RUN_V, 0.7, 1.4);
        else if (clip === 'Walk') k.cur.timeScale = clamp(k.speed / WALK_V, 0.6, 1.6);
        else k.cur.timeScale = 1;
      }

      k.root.position.set(k.x, k.y + k.hop, k.z);
      k.root.rotation.y = k.rot;
      k.root.visible = k.shown && k.dist < FAR_HIDE;
      if (k.lod) k.lod.update(k.alpha < 0.999 ? 0 : k.dist);   // 집에 가며 흐려질 땐 원래 메시 (LOD 재질은 공용이라 못 흐린다)
      if (k.dist < FAR_ANIM) {
        k.mixer.update(dt + k.mixAcc); k.mixAcc = 0;
        /* 코드 몸짓 (믹서가 모든 뼈에 키를 넣으므로 매 프레임 덮어써진다 — 누적 없음) */
        const b = k.bones;
        if (k.boxT > 0) {   // 섀도복싱: 양 주먹을 번갈아 앞으로
          k.boxT -= dt;
          const ph = (0.7 - k.boxT) * 9 + k.idx, eL = Math.max(0, Math.sin(ph)), eR = Math.max(0, -Math.sin(ph));
          if (b.armL) { b.armL.rotation.x -= 1.15 + eL * 0.35; b.armL.rotation.z += 0.3; }
          if (b.foreL) b.foreL.rotation.x -= 1.5 * (1 - eL);
          if (b.armR) { b.armR.rotation.x -= 1.15 + eR * 0.35; b.armR.rotation.z -= 0.3; }
          if (b.foreR) b.foreR.rotation.x -= 1.5 * (1 - eR);
        }
        if (k.throwArm > 0) {   // 눈덩이 던지기: 오른팔을 뒤에서 앞으로
          k.throwArm -= dt;
          const u = 1 - k.throwArm / 0.45;
          if (b.armR) b.armR.rotation.x -= u < 0.4 ? 2.4 * (u / 0.4) : 2.4 - 1.8 * ((u - 0.4) / 0.6);
          if (b.foreR) b.foreR.rotation.x -= 0.8 * Math.sin(Math.PI * u);
        }
      } else k.mixAcc = Math.min(k.mixAcc + dt, 1);
    }

    if (homeState === 'leaving' && kids.every(k => !k.shown)) homeState = 'away';
    if (homeState === 'coming' && kids.every(k => k.mode === 'play')) homeState = 'day';

    updateBalls(dt, _P);
    updateBubbles(dt);
  }

  /* ── PM 이 부르는 것 ── */
  function cheer(pos) {
    const px = pos ? pos.x : _P.x, pz = pos ? pos.z : _P.z;
    let n = 0;
    for (const k of kids) {
      if (!k.shown || (k.mode !== 'play' && k.mode !== 'follow')) continue;
      if (Math.hypot(k.x - px, k.z - pz) > 28) continue;
      k.cheerT = rr(2.2, 3.2); k.cx = px; k.cz = pz; k.hopV = 2.6;
      if (n++ < 2) say(k, pick(LINES.cheer), 1.8);
    }
    return n;
  }
  function punch() {
    let n = 0;
    for (const k of kids) {
      if (!k.shown) continue;
      if (k.mode === 'follow') {
        k.boxT = 0.7;
        if (n++ === 0 && k.sayCD <= 0) { say(k, pick(LINES.box), 1.0); k.sayCD = 1.5; }
      }
      if (k.dist < 2.3) {   // 가까우면 폴짝 비키며 메롱~ (맞지 않는다)
        const P = _P, dx = k.x - P.x, dz = k.z - P.z, d = Math.hypot(dx, dz) || 1;
        dodgeFrom(k, P.x, P.z, dx / d, dz / d, 1.3, LINES.dodge);
        k.dodgeX += dx / d * 0.8; k.dodgeZ += dz / d * 0.8;
      }
    }
    return n;
  }
  function list() {
    return kids.map(k => ({ name: k.name, x: +k.x.toFixed(2), z: +k.z.toFixed(2), mode: k.mode, group: k.group.gi, groupMode: k.group.mode, it: k.it, clip: k.curName, shown: k.shown, d: +k.dist.toFixed(1) }));
  }
  function dispose() {
    for (const k of kids) { scene.remove(k.root); k.mixer.stopAllAction(); for (const m of k.mats) m.dispose(); }
    for (const b of bubbles) { scene.remove(b.sp); b.tex.dispose(); b.mat.dispose(); }
    for (const b of balls) { scene.remove(b.m); scene.remove(b.puff); }
    snowGeo.dispose(); snowMat.dispose(); puffMat.dispose();
    if (splatEl) { splatEl.remove(); splatEl = null; }
  }

  const api = {
    update, list, dispose, cheer, punch, kids, areas,
    /* 디버그 */
    tag: () => groups.forEach(g => { g.mode = 'tag'; g.modeT = 40; pickTagTarget(g); }),
    snow: (on = true) => groups.forEach(g => { g.mode = on ? 'snow' : 'tag'; g.modeT = 40; }),
    animal: () => groups.map(g => { g.modeT = 0; const an = friendlyAnimal(g); if (an) { g.mode = 'animal'; g.animal = an; an.refresh = 0; g.modeT = 10; } return an && an.kind; }),
    follow: () => startFollow(),
    home: (sec = 20) => { forceHome = sec; },
    splat: () => screenSplat(),
  };
  const isTest = debug != null ? debug : (typeof location !== 'undefined' && new URLSearchParams(location.search).has('test'));
  if (isTest && typeof window !== 'undefined') window.__kids = api;
  return api;
}
