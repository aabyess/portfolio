/* ════════════════════════════════════════════════════════════
   glb 공용 캐시 (gltf-cache.js) — 같은 파일을 여러 모듈이 따로 내려받지 않게
   주소 → 불러오기 약속(Promise<gltf>)을 기억한다. 받은 gltf 는 여럿이 같이 쓰므로
   쓰는 쪽은 원본을 바로 장면에 넣지 말고 SkeletonUtils.clone 으로 복제해서 쓴다.
   (gltf 객체에 속성을 덧붙이지도 않는다 — 필요하면 { ...gltf, 추가 } 로 감싼다)
   쓰는 곳: npcs.js(손님 모델), shop.js(마녀 = npc-herbalist, 상인 = npc-traveler)
   ════════════════════════════════════════════════════════════ */
const cache = new Map();

/* loader: Draco 가 붙은 GLTFLoader 인스턴스. 실패하면 캐시에서 지워 다음에 다시 시도할 수 있게 한다 */
export function loadGLTFShared(loader, url) {
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url);
    cache.set(url, p);
    p.catch(() => { if (cache.get(url) === p) cache.delete(url); });
  }
  return p;
}
