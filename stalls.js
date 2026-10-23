/* ════════════════════════════════════════════════════════════
   선술집 자리 (stalls.js) — 작은 모듈
   스테이션(가판대) → 테이블·의자 4개·술집 주인 카운터 자리. npcs.js 와 tavern.js 연결(portfolio.js)이 같이 쓴다.
   npcs.js(큰 파일)는 첫 화면 뒤에 늦게 불러오므로 선술집(E 앉기)이 먼저 쓸 수 있게 여기로 뗐다.
   npcs.js 가 그대로 다시 내보낸다 (import { stallsFromStations } from './npcs.js' 도 된다).
   ════════════════════════════════════════════════════════════ */

/* portfolio.js 의자 블록과 같은 값 */
export const STOOL_TABLE_Z = 4.6, STOOL_RING = 1.75, STOOL_H = 0.42, STOOL_BASE_Y = 0.01;
export const BAR_LOCAL_X = 0, BAR_LOCAL_Z = 0.3;    // 술집 주인 자리 기본값 (가판대 그룹 지역좌표, 앞 +Z = 길 쪽)
/* 부스 종류별 술집 주인 자리 (가판대 그룹 지역좌표 = 부스 glb 좌표, 그룹 크기 0.62 적용 전).
   부스 glb 를 헤드리스 Blender 로 위에서 훑어(벽·카운터에서 0.22 m 떨어진 빈 바닥, 지붕 아래) 고른
   카운터 바로 뒤·건물 안 자리. 부스 모양이 바뀌면 다시 잰다 */
export const BAR_SPOT = {   // y = 부스 바닥판 높이 (없으면 0 = 가판대 그룹 바닥)
  tudor: { x: 0, z: 0.35, y: 0.186 }, norse: { x: 0, z: 0.6 }, bavarian: { x: 0, z: 0.45, y: 0.323 }, venta: { x: 0.4, z: 0 },
  tent: { x: 0, z: 0.45 }, flemish: { x: -2.0, z: 0 }, osteria: { x: -0.5, z: -0.45, y: 0.194 },
};

/* ── 스테이션 → stalls 배열 ── */
export function stallsFromStations(stations, { THREE, toyBlocks = null } = {}) {
  const v = new THREE.Vector3();
  const out = [];
  for (const st of stations) {
    const g = st.group;
    g.updateMatrixWorld(true);
    g.localToWorld(v.set(0, 0, STOOL_TABLE_Z));
    const stall = { x: v.x, z: v.z, rotY: g.rotation.y, seats: [] };
    const bs = BAR_SPOT[st.style] || { x: BAR_LOCAL_X, z: BAR_LOCAL_Z };
    g.localToWorld(v.set(bs.x, bs.y || 0, bs.z));
    stall.bar = { x: v.x, z: v.z, y: v.y, rotY: Math.atan2(stall.x - v.x, stall.z - v.z) };   // 카운터 너머 테이블(의자) 쪽을 본다
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      g.localToWorld(v.set(Math.cos(a) * STOOL_RING, 0, STOOL_TABLE_Z + Math.sin(a) * STOOL_RING));
      const seat = { x: v.x, z: v.z, y: STOOL_BASE_Y, rotY: Math.atan2(stall.x - v.x, stall.z - v.z), mesh: null };
      if (toyBlocks) {
        for (const b of toyBlocks) {
          const h = b.home;
          if (h && Math.abs(h.x - v.x) < 0.05 && Math.abs(h.z - v.z) < 0.05) {
            seat.mesh = b.mesh; seat.y = h.y - STOOL_H / 2; break;
          }
        }
      }
      stall.seats.push(seat);
    }
    out.push(stall);
  }
  return out;
}

