/* ════════════════════════════════════════════════════════════
   그래픽 — 후처리·안개·물·화질 (graphics.js)

   하는 일
     1) 후처리: 장면 → (햇살 줄기) → 빛 번짐(bloom) → 색 보정(톤매핑·시간대/계절 색감·비네트·필름 결) → FXAA
        밝은 것(등롱·횃불·반딧불·불꽃놀이·해)만 번지게 문턱을 시간대마다 바꾼다. 낮은 덜, 밤은 더.
     2) 안개: three 기본 안개 셰이더(ShaderChunk)에 '땅 가까이 짙은 안개'와 '해/달 쪽 빛 번짐'을 더한다.
        모든 재질에 자동으로 들어가고, 유니폼은 셰이더 라이브러리에 공유 객체로 넣어 매 프레임 한 번만 바꾼다.
     3) 물: 월드 개울(EX_Water)·낚시 연못(pond-water)에 물결 법선·프레넬 하늘 반사·햇빛 반짝임·물가 거품.
     4) 화질: low / mid / high. 처음 몇 초 프레임 시간을 재서 느리면 자동으로 낮춘다. 휴대폰은 low로 시작.
        상단 바(음악 버튼 옆)에 작은 '화질' 버튼 — 누르면 자동 → 높음 → 보통 → 낮음 순서. 선택은 기억한다.

     low : 후처리 없음(브라우저 기본 안티에일리어싱), 그림자 1024(두 프레임에 한 번 갱신), 픽셀 비율 ≤1.25
     mid : bloom(반 해상도)·색 보정·FXAA, 그림자 2048, 픽셀 비율 ≤1.5
     high: MSAA 4x·bloom·햇살 줄기·색 보정·필름 결, 그림자 2048, 픽셀 비율 ≤2

   portfolio.js 연결 (연결 담당)
     const { createGraphics } = await import('./graphics.js');
     const gfx = await createGraphics({ THREE, renderer, scene, camera, sun, hemi, sky,
       getNight: () => night, getSeason: () => seasons.season });
     loop(): composer.render()  →  gfx.render(dt)
     resize: composer.setSize(...)  →  gfx.setSize(innerWidth, innerHeight)
     (기존 EffectComposer/RenderPass/UnrealBloomPass/OutputPass 블록은 지운다)

   반환: { render(dt), setSize(w,h), setQuality('low'|'mid'|'high'|'auto'), dispose(), state() }
   ?test 일 때 window.__gfx = { state, setQuality, bench(frames), grade, fog }
   ════════════════════════════════════════════════════════════ */

import { createFarCull, PERF_OFF } from './perf.js';

const QUALITY = {
  low:  { pr: 1.25, post: false, shadow: 1024, bloomScale: 0,   rays: false, msaa: 0, fxaa: false, grain: 0 },
  mid:  { pr: 1.5,  post: true,  shadow: 2048, bloomScale: 0.5, rays: false, msaa: 0, fxaa: true,  grain: 0 },
  high: { pr: 2,    post: true,  shadow: 2048, bloomScale: 1,   rays: true,  msaa: 4, fxaa: false, grain: 0.022 }
};
const ORDER = ['high', 'mid', 'low'];
const LABEL = { high: '높음', mid: '보통', low: '낮음' };
const STORE = 'sangho.gfx';
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k;

/* ── 안개 셰이더 조각 ──
   유니폼 값은 'Vector4가 아닌 평범한 객체 {x,y,z,w}'라서 재질마다 복제되지 않고 모두 같은 객체를 본다
   (UniformsUtils.clone은 isVector4 같은 것만 복제한다). 그래서 매 프레임 이 객체만 바꾸면 전부 바뀐다.
   유니폼이 없는 직접 만든 ShaderMaterial(fog:true)은 0이 들어가서 원래 안개와 똑같이 보인다. */
const FOG = {
  gfxFog: { value: { x: 0, y: 0, z: 0.45, w: 0.02 } },    // x 땅안개 세기, y 기준 높이, z 높이 감쇠, w 거리 증가율
  gfxSun: { value: { x: 0, y: 1, z: 0, w: 0 } },          // xyz 해(달) 방향, w 빛 번짐 세기
  gfxSunCol: { value: { x: 1, y: 0.6, z: 0.3, w: 0 } }
};
/* 한 번만 — 모듈을 다시 불러와도(개발 중) 조각이 두 번 붙지 않게 THREE 쪽 표시를 본다 */
function installFog(THREE) {
  const SC = THREE.ShaderChunk;
  if (SC.fog_vertex.includes('vGfxRel')) {
    if (THREE.UniformsLib.fog.gfxFog) Object.assign(FOG, { gfxFog: THREE.UniformsLib.fog.gfxFog, gfxSun: THREE.UniformsLib.fog.gfxSun, gfxSunCol: THREE.UniformsLib.fog.gfxSunCol });
    return;
  }
  SC.fog_pars_vertex += '\n#ifdef USE_FOG\n varying vec3 vGfxRel; varying float vGfxY;\n#endif\n';
  /* 시야 좌표 → 세계 좌표: 카메라 기준 상대 위치(R^T·mv)와 세계 높이 */
  SC.fog_vertex += `
#ifdef USE_FOG
  vGfxRel = mvPosition.xyz * mat3( viewMatrix );
  vGfxY = vGfxRel.y - ( viewMatrix[3].xyz * mat3( viewMatrix ) ).y;
#endif
`;
  SC.fog_pars_fragment += '\n#ifdef USE_FOG\n varying vec3 vGfxRel; varying float vGfxY; uniform vec4 gfxFog; uniform vec4 gfxSun; uniform vec4 gfxSunCol;\n#endif\n';
  SC.fog_fragment = `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  float gfxD = length( vGfxRel );
  float gfxH = gfxFog.x * exp( - max( vGfxY - gfxFog.y, 0.0 ) * gfxFog.z ) * ( 1.0 - exp( - max( gfxD - 12.0, 0.0 ) * gfxFog.w ) );
  fogFactor = clamp( fogFactor + gfxH * ( 1.0 - fogFactor ), 0.0, 1.0 );
  float gfxS = pow( max( dot( vGfxRel / max( gfxD, 1e-3 ), gfxSun.xyz ), 0.0 ), 6.0 ) * gfxSun.w;
  vec3 gfxFc = mix( fogColor, gfxSunCol.rgb, clamp( gfxS, 0.0, 1.0 ) );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, gfxFc, fogFactor );
#endif
`;
  const add = u => { if (u && u.fogColor) Object.assign(u, FOG); };
  add(THREE.UniformsLib.fog);
  for (const k in THREE.ShaderLib) add(THREE.ShaderLib[k].uniforms);
}

export async function createGraphics({ THREE, renderer, scene, camera, getNight = () => 0, getSeason = () => 'autumn', sun, hemi, sky = null, quality, getPlayerPos = null }) {
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }, { FXAAShader }, { Pass, FullScreenQuad }] = await Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/ShaderPass.js'),
    import('three/addons/shaders/FXAAShader.js'),
    import('three/addons/postprocessing/Pass.js')
  ]);

  installFog(THREE);
  /* 성능 (perf.js): 안개 너머·몇 픽셀짜리 물체는 그리는 동안만 숨기고, 먼 작은 물체는 그림자를 끈다 */
  const cull = createFarCull({ THREE, scene, camera, sun, getPlayerPos });
  /* 그림자 상자: 플레이어 둘레 ±55 m → 카메라가 보는 쪽으로 SHADOW_AHEAD m 당긴 ±SHADOW_HALF m.
     뒤쪽(화면 밖) 그림자 그리기를 줄이고 같은 지도 크기로 그림자가 더 또렷해진다 */
  const SHADOW_HALF = 45, SHADOW_AHEAD = PERF_OFF ? 0 : 20;
  if (sun && sun.shadow && !PERF_OFF) {
    Object.assign(sun.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF });
    sun.shadow.camera.updateProjectionMatrix();
  }
  const camFwd = new THREE.Vector3(), sunShift = new THREE.Vector3();
  /* 이미 그려진 적 있는 재질은 새 안개 조각으로 다시 컴파일 */
  scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m.fog !== false) m.needsUpdate = true; });

  const test = new URLSearchParams(location.search).has('test');
  const mobile = matchMedia('(hover: none) and (pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 500;
  let stored = null;
  try { stored = localStorage.getItem(STORE); } catch (e) { /* 저장소가 막혀도 동작 */ }
  const qParam = new URLSearchParams(location.search).get('gfx');
  let auto = true, q = mobile ? 'low' : 'high';
  const pick = quality || qParam || stored;
  if (pick && QUALITY[pick]) { q = pick; auto = false; }

  const timeU = { value: 0 };
  const skyU = sky && sky.skyU;
  renderer.info.autoReset = false;   // 패스 여러 개를 합친 한 프레임 통계

  /* ════ 후처리 패스 ════ */
  /* 햇살 줄기 — 반의반 해상도. 밝은 하늘 픽셀을 해 쪽으로 끌어 모은다(나무가 가리면 그늘 줄이 생긴다) */
  class RaysPass extends Pass {
    constructor() {
      super();
      this.needsSwap = false;
      this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
      this.uniforms = { tDiffuse: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uOn: { value: 0 },
        uThr: { value: 0.9 }, uTint: { value: new THREE.Color(1, 0.75, 0.45) }, uAspect: { value: 1 } };
      this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
        uniforms: this.uniforms, depthTest: false, depthWrite: false,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uOn; uniform float uThr; uniform vec3 uTint; uniform float uAspect;
          varying vec2 vUv;
          void main(){
            vec2 dir = (uSun - vUv) * (0.92 / 26.0);
            vec2 p = vUv; float dec = 1.0; vec3 acc = vec3(0.0);
            for (int i = 0; i < 26; i++) {
              vec3 c = texture2D(tDiffuse, clamp(p, 0.001, 0.999)).rgb;
              float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
              acc += c * (max(l - uThr, 0.0) / max(l, 1e-3)) * dec;
              dec *= 0.955; p += dir;
            }
            vec2 q = (vUv - uSun) * vec2(uAspect, 1.0);
            float fall = 1.0 - smoothstep(0.05, 1.1, length(q));
            gl_FragColor = vec4(acc / 26.0 * uTint * fall * uOn, 1.0);
          }`
      }));
    }
    setSize(w, h) { this.rt.setSize(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4))); this.uniforms.uAspect.value = w / Math.max(1, h); }
    render(r, writeBuffer, readBuffer) {
      this.uniforms.tDiffuse.value = readBuffer.texture;
      r.setRenderTarget(this.rt);
      this.quad.render(r);
    }
    dispose() { this.rt.dispose(); this.quad.material.dispose(); this.quad.dispose(); }
  }

  /* 마무리 — 톤매핑(ACES)·sRGB·색 보정·비네트·필름 결. OutputPass 대신 */
  const GRADE = {
    tRays: { value: null }, uRays: { value: 0 }, toneMappingExposure: { value: 1 },
    uGain: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3() },
    uSat: { value: 1 }, uContrast: { value: 1 }, uVignette: { value: 0.25 }, uGrain: { value: 0 }, uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) }
  };
  class FinalPass extends Pass {
    constructor() {
      super();
      this.uniforms = Object.assign({ tDiffuse: { value: null } }, GRADE);
      this.quad = new FullScreenQuad(new THREE.RawShaderMaterial({
        uniforms: this.uniforms, depthTest: false, depthWrite: false,
        vertexShader: `precision highp float; attribute vec3 position; attribute vec2 uv; varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: `precision highp float;
          uniform sampler2D tDiffuse; uniform sampler2D tRays; uniform float uRays;
          uniform vec3 uGain; uniform vec3 uLift; uniform float uSat; uniform float uContrast;
          uniform float uVignette; uniform float uGrain; uniform float uTime; uniform vec2 uRes;
          #include <tonemapping_pars_fragment>
          #include <colorspace_pars_fragment>
          varying vec2 vUv;
          float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
          void main(){
            vec3 c = texture2D(tDiffuse, vUv).rgb;
            if (uRays > 0.0) c += texture2D(tRays, vUv).rgb * uRays;
            c = ACESFilmicToneMapping(c);
            c = sRGBTransferOETF(vec4(c, 1.0)).rgb;
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(vec3(l), c, uSat);
            c = (c - 0.5) * uContrast + 0.5;
            c = c * uGain + uLift * (1.0 - c);
            vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
            c *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(q));
            if (uGrain > 0.0) c += (h12(vUv * uRes + fract(uTime * 7.31) * 517.0) - 0.5) * uGrain * (1.2 - l);
            gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
          }`
      }));
    }
    render(r, writeBuffer, readBuffer) {
      this.uniforms.tDiffuse.value = readBuffer.texture;
      this.uniforms.toneMappingExposure.value = r.toneMappingExposure;
      r.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.quad.render(r);
    }
    dispose() { this.quad.material.dispose(); this.quad.dispose(); }
  }

  let composer = null, bloom = null, rays = null, fxaa = null, final = null;
  let W = innerWidth, H = innerHeight;
  function build() {
    if (composer) { for (const p of composer.passes) p.dispose && p.dispose(); composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); }
    composer = bloom = rays = fxaa = final = null;
    const Q = QUALITY[q];
    const pr = Math.min(devicePixelRatio || 1, Q.pr);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H);
    /* 그림자 지도 크기 */
    if (sun && sun.shadow && sun.shadow.mapSize.x !== Q.shadow) {
      sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    if (!Q.post) return;
    const rt = new THREE.WebGLRenderTarget(W * pr, H * pr, { type: THREE.HalfFloatType, samples: Q.msaa });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.addPass(new RenderPass(scene, camera));
    if (Q.rays) { rays = new RaysPass(); composer.addPass(rays); }
    bloom = new UnrealBloomPass(new THREE.Vector2(W * pr * Q.bloomScale, H * pr * Q.bloomScale), 0.35, 0.45, 1.0);
    const bSet = bloom.setSize.bind(bloom);
    bloom.setSize = (w, h) => bSet(Math.max(2, Math.round(w * Q.bloomScale)), Math.max(2, Math.round(h * Q.bloomScale)));
    composer.addPass(bloom);
    final = new FinalPass();
    GRADE.tRays.value = rays ? rays.rt.texture : null;
    composer.addPass(final);
    if (Q.fxaa) { fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa); }
    composer.setSize(W, H);
    if (fxaa) fxaa.material.uniforms.resolution.value.set(1 / (W * pr), 1 / (H * pr));
    GRADE.uRes.value.set(W * pr, H * pr);
  }

  /* ════ 물 ════ */
  const waterU = {
    uGTime: timeU,
    gHor: skyU ? skyU.hor : { value: new THREE.Color(0.8, 0.85, 0.9) },
    gMid: skyU ? skyU.mid : { value: new THREE.Color(0.5, 0.65, 0.85) },
    gTop: skyU ? skyU.top : { value: new THREE.Color(0.2, 0.35, 0.7) },
    gSunDir: skyU ? skyU.sunDir : { value: new THREE.Vector3(0, 1, 0) },
    gSunCol: skyU ? skyU.sunCol : { value: new THREE.Color(1, 1, 1) },
    gMoonDir: skyU ? skyU.moonDir : { value: new THREE.Vector3(0, -1, 0) },
    gMoonA: skyU ? skyU.moonA : { value: 0 },
    gNight: { value: 0 }
  };
  const waterMeshes = [];
  function patchWater(mesh, kind) {
    const m = mesh.material;
    if (!m || Array.isArray(m) || m.userData.gfxWater || !m.isMeshStandardMaterial || m.roughness > 0.2) return false;   // 얼음(거칠기 0.35)은 그대로
    m.userData.gfxWater = true;
    const prev = m.onBeforeCompile;
    const prevKey = m.customProgramCacheKey && m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(m, sh, r);
      Object.assign(sh.uniforms, waterU);
      sh.vertexShader = 'varying vec3 vGfxW;\n' + sh.vertexShader.replace('#include <fog_vertex>',
        '#include <fog_vertex>\n  vGfxW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = `varying vec3 vGfxW; uniform float uGTime; uniform vec3 gHor; uniform vec3 gMid; uniform vec3 gTop;
        uniform vec3 gSunDir; uniform vec3 gSunCol; uniform vec3 gMoonDir; uniform float gMoonA; uniform float gNight;\n` + sh.fragmentShader
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec2 wp = vGfxW.xz; float wt = uGTime;
          vec2 wg = vec2(cos(wp.x * 1.7 + wt * 1.3 + wp.y * 0.6), cos(wp.y * 1.9 - wt * 1.1 + wp.x * 0.4)) * 0.09
                  + vec2(cos(wp.x * 4.3 - wt * 2.3 + wp.y * 2.7), cos(wp.y * 3.9 + wt * 2.0 - wp.x * 1.9)) * 0.05
                  + vec2(cos(dot(wp, vec2(9.1, 6.3)) + wt * 3.5), cos(dot(wp, vec2(-5.7, 8.8)) - wt * 3.1)) * 0.03;
          vec3 gN = normalize(vec3(-wg.x, 1.0, -wg.y));
          normal = normalize((viewMatrix * vec4(gN, 0.0)).xyz);`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= 0.35;')
        .replace('#include <opaque_fragment>', `{
          vec3 gV = normalize(cameraPosition - vGfxW);
          float fr = 0.04 + 0.96 * pow(1.0 - max(dot(gN, gV), 0.0), 5.0);
          vec3 R = reflect(-gV, gN); R.y = abs(R.y);
          vec3 sk = mix(gHor, gMid, smoothstep(0.0, 0.25, R.y)); sk = mix(sk, gTop, smoothstep(0.25, 0.75, R.y));
          vec3 spec = gSunCol * pow(max(dot(R, gSunDir), 0.0), 220.0) * 5.0
                    + vec3(0.8, 0.86, 1.0) * gMoonA * pow(max(dot(R, gMoonDir), 0.0), 300.0) * 2.5;
          outgoingLight = mix(outgoingLight, sk, clamp(fr * 0.85, 0.0, 0.9)) + spec;
          diffuseColor.a = clamp(max(diffuseColor.a, fr * 0.95), 0.0, 1.0);
          #ifdef USE_COLOR_ALPHA
            float edge = 1.0 - smoothstep(0.36, 0.72, vColor.a);
            float fn = 0.55 + 0.45 * sin(vGfxW.x * 7.0 + uGTime * 1.4) * sin(vGfxW.z * 6.3 - uGTime * 1.1);
            float foam = edge * fn;
            outgoingLight = mix(outgoingLight, (gHor + gMid) * 0.55 + vec3(0.06), foam * 0.6);
            diffuseColor.a = max(diffuseColor.a, foam * 0.7);
          #endif
        }
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'gfx-water-' + kind + (prev ? '-p' : '') + (prevKey ? prevKey() : '');
    m.needsUpdate = true;
    return true;
  }
  let scanT = 0;
  function scanWater() {
    if (!waterMeshes.length || scanT++ % 30 === 0) {
      waterMeshes.length = 0;
      scene.traverse(o => { if (o.isMesh && (o.name === 'pond-water' || o.name.includes('Water'))) waterMeshes.push(o); });
    }
    for (const w of waterMeshes) patchWater(w, w.name === 'pond-water' ? 'pond' : 'stream');
  }

  /* ════ 매 프레임 — 시간대·계절에 따른 값 ════ */
  const sunScr = new THREE.Vector3(), camDir = new THREE.Vector3(), tv = new THREE.Vector3();
  const SEASON_SAT = { autumn: 1.03, winter: 0.92, spring: 1.03, summer: 1.03 };
  const SEASON_GAIN = { autumn: [1.03, 1.0, 0.95], winter: [0.97, 1.0, 1.05], spring: [1.0, 1.01, 0.99], summer: [1.02, 1.01, 0.97] };
  const tune = { bloomDay: 0.3, bloomNight: 0.7, thrDay: 1.1, thrNight: 1.02, rays: 0.9, haze: 1 };
  let curSeasonGain = [1, 1, 1], curSeasonSat = 1, lastSeason = '';

  function updateLook(dt) {
    const n = getNight();
    /* 황금빛 시간: 해가 낮게 떠 있을 때(뜰 때·질 때). 새벽 물안개: 해가 동쪽 낮게 있을 때 */
    let golden = 0, dawnMist = 0;
    if (skyU) {
      const sd = skyU.sunDir.value, up = Math.min(1, (skyU.sunCol.value.r + skyU.sunCol.value.g) * 1.5);
      golden = (1 - smooth(0.08, 0.42, sd.y)) * up * (1 - n);
      dawnMist = golden * smooth(0.0, 0.3, -(sd.x * -0.76 + sd.z * 0.65));   // 해 뜨는 쪽(서쪽의 반대)
    }
    const season = getSeason();
    if (season !== lastSeason) lastSeason = season;
    /* 계절 색감은 천천히 옮겨 간다 */
    const sg = SEASON_GAIN[season] || [1, 1, 1], k = Math.min(1, dt * 0.6);
    for (let i = 0; i < 3; i++) curSeasonGain[i] += (sg[i] - curSeasonGain[i]) * k;
    curSeasonSat += ((SEASON_SAT[season] || 1) - curSeasonSat) * k;

    /* 안개 */
    const winter = season === 'winter' ? 1 : 0;
    const F = FOG.gfxFog.value;
    F.x = (lerp(lerp(0.24, 0.26, golden), 0.4, n) + dawnMist * 0.3 + winter * 0.12) * tune.haze;
    F.y = 0; F.z = 0.42; F.w = 0.022;
    const S = FOG.gfxSun.value, SC = FOG.gfxSunCol.value;
    if (skyU) {
      const sunUp = skyU.sunDir.value.y > -0.05 && skyU.sunCol.value.r + skyU.sunCol.value.g > 0.01;
      const d = sunUp ? skyU.sunDir.value : skyU.moonDir.value;
      S.x = d.x; S.y = d.y; S.z = d.z;
      if (sunUp) {
        S.w = lerp(0.25, 0.6, golden);
        const c = skyU.sunCol.value; SC.x = c.r * 1.1; SC.y = c.g * 0.95; SC.z = c.b * 0.8;
      } else {
        S.w = 0.35 * skyU.moonA.value;
        SC.x = 0.16; SC.y = 0.2; SC.z = 0.32;
      }
    }

    /* 빛 번짐 */
    if (bloom) {
      bloom.strength = lerp(lerp(tune.bloomDay, 0.42, golden), tune.bloomNight, n);
      bloom.threshold = lerp(tune.thrDay, tune.thrNight, n);
      bloom.radius = lerp(0.42, 0.55, n);
    }

    /* 색 보정: 낮 = 살짝 따뜻·선명 / 노을 = 주황 / 밤 = 푸른 그림자 */
    const g = GRADE;
    const gr = lerp(lerp(1.0, 1.03, golden), 0.92, n), gg = lerp(lerp(1.0, 1.0, golden), 0.97, n), gb = lerp(lerp(0.99, 0.95, golden), 1.08, n);
    g.uGain.value.set(gr * curSeasonGain[0], gg * curSeasonGain[1], gb * curSeasonGain[2]);
    g.uLift.value.set(lerp(0.012 * golden, 0.0, n), lerp(0.006 * golden, 0.012, n), lerp(0.0, 0.04, n));
    g.uSat.value = lerp(lerp(1.06, 1.03, golden), 0.88, n) * curSeasonSat;
    g.uContrast.value = lerp(1.06, 1.03, n);
    g.uVignette.value = lerp(0.18, 0.36, n);
    g.uGrain.value = QUALITY[q].grain * (1 + n);
    g.uTime.value += dt;

    /* 햇살 줄기: 해가 화면 쪽에 있을 때만 */
    if (rays && skyU) {
      const sd = skyU.sunDir.value;
      camera.getWorldDirection(camDir);
      const facing = smooth(0.15, 0.55, camDir.dot(sd));
      const sunAmt = Math.min(1, (skyU.sunCol.value.r + skyU.sunCol.value.g) * 0.6);
      sunScr.copy(sd).multiplyScalar(300).add(camera.position).project(camera);
      rays.uniforms.uSun.value.set(sunScr.x * 0.5 + 0.5, sunScr.y * 0.5 + 0.5);
      const on = facing * sunAmt * (sunScr.z < 1 ? 1 : 0);
      rays.uniforms.uOn.value = on;
      rays.uniforms.uThr.value = lerp(1.6, 0.75, golden);
      tv.set(skyU.sunCol.value.r, skyU.sunCol.value.g, skyU.sunCol.value.b).normalize();
      rays.uniforms.uTint.value.setRGB(tv.x * 1.3, tv.y * 1.3, tv.z * 1.3);
      rays.enabled = on > 0.01;
      g.uRays.value = rays.enabled ? tune.rays * lerp(0.5, 1, golden) : 0;
    } else g.uRays.value = 0;
    waterU.gNight.value = n;
  }

  /* ════ 화질 자동 조절 ════ */
  const perf = { last: 0, acc: 0, n: 0, frames: 0, avg: 0, lastChange: 0, samples: null };
  function measure(now) {
    if (perf.last) {
      const d = now - perf.last;
      if (d < 250) {
        perf.acc += d; perf.n++;
        if (perf.samples) perf.samples.push(d);
      }
    }
    perf.last = now;
    perf.frames++;
    if (perf.n >= 90) {
      perf.avg = perf.acc / perf.n;
      perf.acc = 0; perf.n = 0;
      /* 시작 후 1.5초(로딩 끊김)는 건너뛰고, 바꾼 뒤엔 3초 기다린다. 올리지는 않는다(왔다갔다 방지) */
      /* high → mid: 42fps 아래 / mid → low: 30fps 아래 (그리기 호출이 많아 CPU가 병목일 땐 low로 가도 크게 안 빨라진다) */
      if (auto && perf.frames > 90 && now - perf.lastChange > 3000 && perf.avg > (q === 'high' ? 1000 / 42 : 1000 / 30)) {
        const i = ORDER.indexOf(q);
        if (i < ORDER.length - 1) { setQ(ORDER[i + 1], true); perf.lastChange = now; }
      }
    }
  }

  function render(dt = 1 / 60) {
    measure(performance.now());
    renderer.info.reset();
    timeU.value += dt;
    scanWater();
    updateLook(dt);
    /* low: 그림자 지도를 두 프레임에 한 번만 다시 그린다 (그림자 패스 그리기 호출이 절반) */
    if (q === 'low') { renderer.shadowMap.autoUpdate = false; if (perf.frames % 2 === 0) renderer.shadowMap.needsUpdate = true; }
    else renderer.shadowMap.autoUpdate = true;
    cull.begin(dt);
    if (sun && sun.castShadow) {   // 그림자 상자를 보는 쪽으로 (그린 뒤 되돌린다 — followSun 이 매 프레임 다시 정한다)
      camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion); camFwd.y = 0;
      if (camFwd.lengthSq() > 1e-6) camFwd.normalize();
      sunShift.copy(camFwd).multiplyScalar(SHADOW_AHEAD);
      sun.position.add(sunShift); sun.target.position.add(sunShift);
    }
    try {
      if (composer) composer.render(dt);
      else renderer.render(scene, camera);
    } finally {
      cull.end();
      if (sun && sun.castShadow) { sun.position.sub(sunShift); sun.target.position.sub(sunShift); sunShift.set(0, 0, 0); }
    }
  }

  function setSize(w, h) {
    W = w; H = h;
    renderer.setSize(w, h);
    if (composer) {
      composer.setSize(w, h);
      const pr = renderer.getPixelRatio();
      if (fxaa) fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
      GRADE.uRes.value.set(w * pr, h * pr);
    }
  }

  /* ── 작은 화질 버튼 (음악 버튼 옆) ── */
  let btn = null;
  function label() { return auto ? `화질 자동·${LABEL[q]}` : `화질 ${LABEL[q]}`; }
  function makeButton() {
    const music = document.getElementById('g-music-btn');
    if (!music || document.getElementById('g-gfx-btn')) return;
    const st = document.createElement('style');
    st.textContent = 'body.intro-on .g-gfx-btn{visibility:hidden}.g-gfx-btn{cursor:pointer;font:inherit;font-size:12px;padding:10px 12px}@media(max-width:560px){.g-gfx-btn{display:none}}';
    document.head.appendChild(st);
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'g-gfx-btn'; btn.className = 'g-btn g-gfx-btn';
    btn.title = '그래픽 화질 — 누를 때마다 자동 → 높음 → 보통 → 낮음';
    btn.textContent = label();
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const seq = ['auto', 'high', 'mid', 'low'];
      const cur = auto ? 'auto' : q;
      setQuality(seq[(seq.indexOf(cur) + 1) % seq.length]);
      btn.blur();   // 스페이스·엔터가 게임 조작으로 가게
    });
    music.after(btn);
  }

  function setQ(nq, fromAuto) {
    if (!QUALITY[nq]) return q;
    q = nq;
    if (!fromAuto) perf.lastChange = performance.now();
    build();
    if (btn) btn.textContent = label();
    return q;
  }
  function setQuality(nq) {
    if (nq === 'auto') {
      auto = true;
      try { localStorage.removeItem(STORE); } catch (e) { /* 무시 */ }
      perf.frames = 0; perf.acc = 0; perf.n = 0;
      return setQ(mobile ? 'low' : 'high');
    }
    if (!QUALITY[nq]) return `모르는 화질: ${nq} (low/mid/high/auto)`;
    auto = false;
    try { localStorage.setItem(STORE, nq); } catch (e) { /* 무시 */ }
    return setQ(nq);
  }

  function state() {
    const i = renderer.info;
    return {
      quality: q, auto, mobile, pixelRatio: renderer.getPixelRatio(),
      frameMs: +perf.avg.toFixed(2), fps: perf.avg ? Math.round(1000 / perf.avg) : 0,
      passes: composer ? composer.passes.filter(p => p.enabled).length : 0,
      calls: i.render.calls, triangles: i.render.triangles, textures: i.memory.textures, geometries: i.memory.geometries,
      cull: cull.stats(),
      shadow: sun ? sun.shadow.mapSize.x : 0, waterPatched: waterMeshes.filter(w => w.material.userData.gfxWater).length
    };
  }

  function dispose() {
    if (composer) { for (const p of composer.passes) p.dispose && p.dispose(); composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); }
    composer = null;
    renderer.shadowMap.autoUpdate = true;
    if (btn) btn.remove();
    renderer.info.autoReset = true;
  }

  build();
  makeButton();

  if (test) {
    window.__gfx = {
      state, setQuality, tune, fog: FOG, grade: GRADE, cull,
      get bloom() { return bloom; },
      /* 프레임 시간 재기: await __gfx.bench(120) */
      bench(frames = 120) {
        perf.samples = [];
        return new Promise(res => {
          const t0 = performance.now();
          const tick = () => {
            if (perf.samples.length >= frames || performance.now() - t0 > 9000) {
              const s = perf.samples.slice().sort((a, b) => a - b); perf.samples = null;
              const avg = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
              res({ quality: q, frames: s.length, avgMs: +avg.toFixed(2), p95Ms: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(2), ...state() });
            } else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      }
    };
  }

  return { render, setSize, setQuality, dispose, state, patchWater };
}
