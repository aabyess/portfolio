/* ════════════════════════════════════════════════════════════
   하루 — 새벽 → 한낮 → 노을 → 밤 → 다시 새벽 (DAY초에 한 바퀴)

   하늘 색·안개·햇빛·달빛·별을 시각(phase 0~1)의 열쇠 장면(KEYS) 사이로 부드럽게 섞는다.
   해는 동쪽에서 떠서 높이 올랐다가 서쪽으로 지고, 밤에는 같은 빛(DirectionalLight)이 달빛이 된다.
   계절(seasons.js)은 이 값 위에 곱해서 덧칠한다. 그래서 step()에서 이 update 다음에 seasons.update.

   계절은 240초, 하루는 210초라 매번 조금씩 어긋나서 계절마다 낮도 밤도 돌아온다.
   portfolio.js 가 부르는 것
     createSky({ THREE, scene, renderer, hemi, sun, fill, sunOffset })
       → { update(dt), skyU, night, phase, flash, setTime(name), timeName }
   하늘 돔에는 흐르는 구름(skyU.cloud = 덮인 정도, seasons.js가 계절마다 바꾼다)·달무리·반짝이는 별(구름에 가려진다)이 있다.
   ?test 일 때 window.__sky (setTime 등).
   sunOffset: 그림자 상자가 플레이어를 따라가는 followSun 이 쓰는 벡터 — 여기서 방향만 바꾼다.
   ════════════════════════════════════════════════════════════ */

export const DAY = 210;
/* 이름 → 시각. ?time=... 과 __seasons.time(...) 이 쓴다 */
export const TIMES = { dawn: 0.02, morning: 0.12, day: 0.28, noon: 0.31, evening: 0.52, dusk: 0.6, night: 0.78 };
const SUNSET = 0.62;          // 해가 지는 시각 (0 = 해 뜸)

/* 하늘 구름과 별 가림에 같이 쓰는 값 잡음 */
const NOISE = `float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }`;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createSky({ THREE, scene, renderer, hemi, sun, fill, sunOffset }) {
  const C = h => new THREE.Color(h);
  /* 열쇠 장면: p = 시각, sky = [위, 가운데, 지평선], fog = 안개 [색, near, far],
     hemi = [하늘빛 색, 세기], sun = [색, 세기], fill = 달빛 보조광 세기, exp = 노출, stars */
  const K = (p, top, mid, hor, fog, near, far, hemiC, hemiI, sunC, sunI, fillI, exp, stars) =>
    ({ p, top: C(top), mid: C(mid), hor: C(hor), fog: C(fog), near, far, hemiC: C(hemiC), hemiI, sunC: C(sunC), sunI, fillI, exp, stars });
  const KEYS = [
    K(0.00, 0x23305e, 0xb06a86, 0xff9a6a, 0x9a7486, 22, 88,  0xffc0a0, 0.62, 0xff8a50, 0.9, 0.3,  1.08, 0.15),  // 새벽 — 분홍·주황
    K(0.08, 0x3a67b8, 0x86a8d8, 0xf2c8a8, 0xb8bccb, 26, 110, 0xf2eaff, 0.85, 0xffd2a0, 1.9, 0.22, 1.0,  0),     // 아침
    K(0.16, 0x2a6ad0, 0x6aa6ea, 0xcfe6f7, 0xb4cee6, 32, 150, 0xe8f2ff, 1.0,  0xfff2dc, 2.6, 0.18, 0.95, 0),     // 한낮 — 파란 하늘, 흰 햇빛
    K(0.42, 0x2a66c8, 0x6aa2e4, 0xd2e4f2, 0xb8cce0, 32, 150, 0xeef2ff, 1.0,  0xfff0d8, 2.5, 0.18, 0.95, 0),
    K(0.53, 0x2d3e86, 0xc0785e, 0xffb060, 0xb88262, 28, 120, 0xffd0a0, 0.85, 0xffa050, 2.0, 0.25, 1.02, 0),     // 황금빛 저녁
    K(0.61, 0x0e0a22, 0x4f2546, 0xe0844a, 0x2a1a33, 26, 100, 0xffb48a, 0.7,  0xff9050, 1.2, 0.45, 1.1,  0.2),   // 노을 (원래 장면)
    K(0.70, 0x03040e, 0x0c1430, 0x2a2048, 0x0b0d1c, 22, 90,  0x8a98d8, 0.34, 0x9fb4ff, 0.0, 0.6,  1.0,  0.9),   // 밤
    K(0.92, 0x03040e, 0x0c1430, 0x2a2048, 0x0b0d1c, 22, 90,  0x8a98d8, 0.32, 0x9fb4ff, 0.0, 0.6,  1.0,  0.9),
    K(1.00, 0x23305e, 0xb06a86, 0xff9a6a, 0x9a7486, 22, 88,  0xffc0a0, 0.62, 0xff8a50, 0.9, 0.3,  1.08, 0.15)
  ];

  /* ── 하늘 돔: 색 띠 + 해 원반·햇무리 + 달 + 번개 번쩍 ── */
  const skyU = {
    top: { value: KEYS[0].top.clone() }, mid: { value: KEYS[0].mid.clone() }, hor: { value: KEYS[0].hor.clone() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() },
    moonDir: { value: new THREE.Vector3(0, -1, 0) }, moonA: { value: 0 }, flash: { value: 0 },
    /* 구름: time 흐름, cloud 덮인 정도(0~1, seasons.js가 계절마다 바꾼다), night 밤 정도 */
    time: { value: 0 }, cloud: { value: 0.45 }, night: { value: 0 }
  };
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol;
      uniform vec3 moonDir; uniform float moonA; uniform float flash; uniform float time; uniform float cloud; uniform float night;
      varying vec3 vP;
      ${NOISE}
      void main(){
        vec3 d = normalize(vP);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.6, h));
        float sd = max(dot(d, sunDir), 0.0);
        float sunUp = clamp(sunDir.y * 6.0 + 0.3, 0.0, 1.0);
        c += sunCol * (smoothstep(0.9988, 0.9993, sd) * 5.0 + pow(sd, 14.0) * 0.32 + pow(sd, 3.0) * 0.08 * (1.0 - h));   // 해 원반 + 햇무리 + 넓은 노을 번짐
        float md = max(dot(d, moonDir), 0.0);
        vec3 moonC = vec3(0.86, 0.9, 1.0);
        /* 달: 원반(살짝 얼룩) + 가까운 달무리 + 넓은 푸른 빛 */
        float disk = smoothstep(0.99955, 0.9998, md);
        float spots = 0.85 + 0.15 * vn(d.xz * 900.0);
        c += moonC * moonA * (disk * 1.7 * spots + pow(md, 260.0) * 0.35 + pow(md, 40.0) * 0.08 + pow(md, 6.0) * 0.025);
        /* 구름 — 하늘 돔을 평면으로 펴서 흐르는 fbm. 해 쪽 가장자리는 해 색으로 물든다 */
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.18) * 1.6 + vec2(time * 0.012, time * 0.004);
          float n = fbm(uv) * 0.75 + fbm(uv * 2.7 - vec2(time * 0.02, 0.0)) * 0.25;
          float cov = smoothstep(0.62 - cloud * 0.32, 0.92 - cloud * 0.2, n) * smoothstep(0.0, 0.16, d.y);
          vec3 lit = mix(vec3(1.0, 0.97, 0.94), sunCol * 1.1 + vec3(0.25), clamp(1.0 - sunDir.y * 2.5, 0.0, 1.0));
          vec3 cc = mix(mix(hor, mid, 0.5) * 0.7 + vec3(0.04), lit, sunUp * 0.85);
          cc += sunCol * pow(sd, 6.0) * 0.6;                                      // 해 가까운 구름 가장자리가 빛난다
          cc = mix(cc, vec3(0.05, 0.06, 0.1) + moonC * moonA * 0.06 + pow(md, 8.0) * moonA * 0.18, night);   // 밤 구름 — 어둡고 달 쪽만 은빛
          c = mix(c, cc, cov * 0.88);
        }
        c += flash * vec3(0.65, 0.7, 0.85) * (0.4 + 0.6 * h);
        gl_FragColor = vec4(c, 1.0);
      }`
  })));

  /* 별 — 밤에만. 크기·색이 조금씩 다르고 반짝인다 (구름보다 뒤: 하늘 돔 다음에 그린다) */
  const starU = { op: { value: 0 }, time: skyU.time, cloud: skyU.cloud };
  const stars = (() => {
    const N = 1400, a = new Float32Array(N * 3), r = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(0.12 + Math.random() * 0.88);
      a.set([Math.sin(ph) * Math.cos(th) * 300, Math.cos(ph) * 300, Math.sin(ph) * Math.sin(th) * 300], i * 3);
      r[i * 2] = Math.random(); r[i * 2 + 1] = Math.pow(Math.random(), 3.0);   // 무늬 씨앗, 밝기(밝은 별은 드물게)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    g.setAttribute('aR', new THREE.BufferAttribute(r, 2));
    const m = new THREE.ShaderMaterial({ uniforms: starU, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float time; uniform float cloud; attribute vec2 aR; varying float vA; varying vec3 vC;
        ${NOISE}
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          float tw = 0.65 + 0.35 * sin(time * (1.5 + aR.x * 3.0) + aR.x * 60.0);
          vec3 d = normalize(position);
          vec2 uv = d.xz / (d.y + 0.18) * 1.6 + vec2(time * 0.012, time * 0.004);
          float n = fbm(uv) * 0.75 + fbm(uv * 2.7 - vec2(time * 0.02, 0.0)) * 0.25;
          float cov = smoothstep(0.62 - cloud * 0.32, 0.92 - cloud * 0.2, n);   // 구름(하늘 셰이더와 같은 식)에 가린 별은 숨긴다
          vA = (0.35 + 0.65 * aR.y) * tw * smoothstep(0.05, 0.25, d.y) * (1.0 - cov * 0.95);
          vC = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), fract(aR.x * 7.13));
          gl_PointSize = 1.4 + aR.y * 2.6;
        }`,
      fragmentShader: `uniform float op; varying float vA; varying vec3 vC;
        void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vA * op; if (a < 0.01) discard; gl_FragColor = vec4(vC * a * 1.6, a); }`
    });
    const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -1;
    scene.add(p);
    return m;
  })();

  /* 해·달이 지나는 길: 동쪽(E)에서 떠서 남쪽으로 기울어 지나 서쪽으로. 원래 노을 해 자리(-40,16,34)가 서쪽 */
  const W = new THREE.Vector3(-0.76, 0, 0.65).normalize(), S = new THREE.Vector3(0.65, 0, 0.76).normalize();
  const arc = (out, a, maxEl) => {   // a: 0(뜸) → π(짐)
    const el = Math.sin(a) * maxEl, hz = Math.cos(el);
    return out.copy(W).multiplyScalar(-Math.cos(a) * hz).addScaledVector(S, Math.sin(a) * hz * 0.35).setY(Math.sin(el)).normalize();
  };
  const sunV = new THREE.Vector3(), moonV = new THREE.Vector3();

  let phase = TIMES.evening;   // 처음엔 늦은 오후 — 곧 노을, 밤, 그리고 낮
  const q = new URLSearchParams(location.search).get('time');
  if (q && q in TIMES) phase = TIMES[q];
  const state = { night: 0, phase, flash: 0, timeName: '' };

  function update(dt) {
    phase = (phase + dt / DAY) % 1;
    state.phase = phase;
    let i = 0;
    while (i < KEYS.length - 2 && phase >= KEYS[i + 1].p) i++;
    const A = KEYS[i], B = KEYS[i + 1], k = smooth(A.p, B.p, phase);
    skyU.top.value.copy(A.top).lerp(B.top, k);
    skyU.mid.value.copy(A.mid).lerp(B.mid, k);
    skyU.hor.value.copy(A.hor).lerp(B.hor, k);
    scene.fog.color.copy(A.fog).lerp(B.fog, k);
    scene.fog.near = A.near + (B.near - A.near) * k;
    scene.fog.far = A.far + (B.far - A.far) * k;
    hemi.color.copy(A.hemiC).lerp(B.hemiC, k);
    hemi.intensity = A.hemiI + (B.hemiI - A.hemiI) * k;
    fill.intensity = A.fillI + (B.fillI - A.fillI) * k;
    renderer.toneMappingExposure = A.exp + (B.exp - A.exp) * k;
    starU.op.value = A.stars + (B.stars - A.stars) * k;
    skyU.time.value += dt;

    /* 해와 달 */
    const day = phase < SUNSET + 0.02 || phase > 0.985;
    const pa = phase > 0.985 ? phase - 1 : phase;
    arc(sunV, Math.min(Math.PI, Math.max(0, (pa + 0.01) / (SUNSET + 0.01) * Math.PI)), 1.05);
    arc(moonV, Math.min(Math.PI, Math.max(0, (phase - SUNSET - 0.03) / (0.985 - SUNSET - 0.03) * Math.PI)), 0.95);
    skyU.sunDir.value.copy(sunV);
    skyU.moonDir.value.copy(moonV);
    const sunUp = smooth(-0.02, 0.1, sunV.y), moonUp = smooth(-0.02, 0.12, moonV.y) * (day ? 0 : 1);
    skyU.sunCol.value.copy(A.sunC).lerp(B.sunC, k).multiplyScalar(sunUp);
    skyU.moonA.value = moonUp;
    /* 빛 하나를 해/달로 돌려 쓴다 (그림자도 같이) — 지평선에서 둘 다 0일 때 바꿔서 튀지 않는다 */
    if (sunV.y > -0.02 && day) {
      sun.color.copy(A.sunC).lerp(B.sunC, k);
      sun.intensity = (A.sunI + (B.sunI - A.sunI) * k) * sunUp;
      sunOffset.copy(sunV).multiplyScalar(50);
    } else {
      sun.color.setRGB(0.62, 0.7, 1.0);
      sun.intensity = 0.42 * moonUp;
      sunOffset.copy(moonV).multiplyScalar(50);
    }
    if (sunOffset.y < 6) sunOffset.y = 6;   // 그림자가 끝없이 길어지지 않게
    state.night = smooth(0.58, 0.7, phase) * (1 - smooth(0.93, 1.0, phase));
    skyU.night.value = state.night;
    state.flash = skyU.flash.value;
  }

  function setTime(name) {
    if (typeof name === 'number') { phase = ((name % 1) + 1) % 1; return phase; }
    if (!(name in TIMES)) return `모르는 시각: ${name} (${Object.keys(TIMES).join('/')})`;
    phase = TIMES[name]; return name;
  }
  const api = {
    update, skyU, stars, setTime,
    get night() { return state.night; },
    get phase() { return phase; },
    set flash(v) { skyU.flash.value = v; },
    get flash() { return skyU.flash.value; },
    get timeName() {
      return phase < 0.06 || phase > 0.97 ? 'dawn' : phase < 0.5 ? 'day' : phase < 0.63 ? 'dusk' : 'night';
    }
  };
  /* 확인용 — 콘솔에서 __sky.setTime('dusk'), __sky.phase */
  if (new URLSearchParams(location.search).has('test')) window.__sky = api;
  return api;
}
