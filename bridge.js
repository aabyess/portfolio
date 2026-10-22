/* 시냇물 돌다리 — models/props/bridge.glb (tools/blender/bridge/build_bridge.py)
   세 칸 아치 돌다리: 물가르개 교각, 쐐기돌, 난간·갓돌, 끝 기둥 위 쇠등불 4개, 화분·담쟁이, 길가 작은 사당.
   다리 위 길(자갈) 높이는 portfolio.js bridgeY와 같은 곡선이다:
     top + arch * sin(π (z - z0) / (z1 - z0))   (models/autumn-world.json의 bridge 값)
   다리는 길(pathX)을 따라 살짝 휘어 있고, 원점은 다리 가운데(pathX(zc), 0, zc)에 있다.

   연결 (portfolio.js, 월드 glb 로딩 근처):
     const { createBridge } = await import('./bridge.js');
     const bridge = createBridge({ THREE, scene, GLTFLoader, dracoLoader: draco, pathX, bridgeData: WORLD.bridge });
     // worldLoader.load('models/autumn-world.glb', gltf => { ... bridge.hideOld(gltf.scene); ... })
     // (선택) 밤에 등불 밝게: bridge.setLampGlow(k)   k = 0(낮)..1(밤)
*/
import { addStaticLOD } from './perf.js';


export function createBridge({ THREE, scene, GLTFLoader, dracoLoader, world = null, pathX, bridgeData = null, url = 'models/props/bridge.glb' }) {
  const B = bridgeData ?? { z0: -43.68, z1: -29.12 };
  const zc = (B.z0 + B.z1) / 2;
  const group = new THREE.Group();
  group.name = 'stone_bridge';
  group.position.set(pathX(zc), 0, zc);
  scene.add(group);

  const lampMats = [];
  let glow = 0.4, disposed = false, loaded = null;

  function hideOld(worldScene) {
    const old = worldScene?.getObjectByName('EX_Bridge');
    if (old) old.visible = false;
  }
  if (world) hideOld(world);

  function applyGlow() {
    for (const m of lampMats) m.emissiveIntensity = 1.2 + 3.3 * glow;
  }

  const loader = new GLTFLoader();
  if (dracoLoader) loader.setDRACOLoader(dracoLoader);   // glb는 Draco 압축
  loader.load(url, gltf => {
    if (disposed) return;
    loaded = gltf.scene;
    loaded.traverse(o => {
      if (!o.isMesh) return;
      const plants = o.name.startsWith('bridge_plants');
      const glass = o.name.startsWith('bridge_lamp_glass');
      o.castShadow = !plants && !glass;
      o.receiveShadow = !glass;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.emissive && (m.name.startsWith('br_lamp_glass') || m.name.startsWith('br_candle_flame'))) lampMats.push(m);
      }
    });
    applyGlow();
    group.add(loaded);
    addStaticLOD(THREE, loaded, { dist: 45 });   // 성능: 멀면 부위 20여 개 대신 정점색 한 덩어리 (등불 유리·불꽃은 그대로)
  }, undefined, err => console.warn('[bridge] load failed', err));

  return {
    group,
    hideOld,
    setLampGlow(k) { glow = Math.max(0, Math.min(1, k)); applyGlow(); },
    dispose() {
      disposed = true;
      scene.remove(group);
      group.traverse(o => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) m[k]?.dispose();
          m.dispose();
        }
      });
    },
  };
}
