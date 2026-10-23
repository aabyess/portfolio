/* ════════════════════════════════════════════════════════════
   나무 비우기 자리 (clear-spots.js) — 아주 작은 데이터 모듈
   월드 glb 가 도착하면 portfolio.js 가 clearTrees() 로 이 자리의 나무를 지운다.
   성·축제·가게·행사 모듈(castle/festival/shop/pageant)은 첫 화면이 뜬 뒤에 늦게 불러오므로,
   나무 자리만 여기로 떼어 첫 화면 전에 가볍게 읽는다. 각 모듈은 여기서 가져다 그대로 다시 내보낸다
   (castle.js GATES·CASTLE_CLEAR, festival.js FESTIVAL_CLEAR, shop.js HUT·MERCHANT_SPOTS·SHOP_CLEAR, pageant.js PAGEANT_CLEAR).
   ════════════════════════════════════════════════════════════ */

/* 길: portfolio.js 의 pathX = 3.08·sin(-0.04286·z) 와 같은 값 (월드 JSON path.amp / path.k) */
const AMP = 3.08, K = 0.04285714285714286;
const px0 = z => AMP * Math.sin(-K * z);
const pxd = z => -AMP * K * Math.cos(-K * z);           // dx/dz

/* ── 성문 (castle.js) ── */
const GZ = -80;                                          // 성문 앞면(아치 바깥 면) z
/* rotY: 통로가 길 방향을 따라가게 살짝 돌린다 (로컬 -Z 가 성 안쪽) */
export const GATES = [{ id: 'north', name: '상호성', x: +px0(GZ).toFixed(3), z: GZ, rotY: +Math.atan(pxd(GZ)).toFixed(4) }];
/* 나무 비우기 자리: 성 앞면을 따라 (로컬 x -16..16, z 0..-4). 성 뒤쪽은 맵(z -84) 밖이라 나무가 없다 */
export const CASTLE_CLEAR = {
  r: 5.5,
  spots: GATES.flatMap(g => [-15, -10, -5, 0, 5, 10, 15].map(lx => {
    const c = Math.cos(g.rotY), s = Math.sin(g.rotY), lz = -2;
    return [+(g.x + c * lx + s * lz).toFixed(2), +(g.z - s * lx + c * lz).toFixed(2)];
  })),
};

/* ── 축제 (festival.js) ── */
export const FESTIVAL_CLEAR = {
  r: 4.6,
  spots: [
    [27, -9], [27, -3], [27, 3], [27, 9], [27, 13], [22, -6], [22, 0], [22, 6], [32, -4], [32, 4], [32, 10],
    [17, 60], [17, 66], [17, 72], [22, 67], [27, 63], [27, 71], [31, 67], [35, 63], [35, 67], [35, 71],
    [-19, 47], [-15, 47], [-23, 47], [-19, 43], [-19, 51],
  ],
};

/* ── 물약 가게·떠돌이 상인 (shop.js) ── */
/* 마녀 오두막 — 동쪽 숲, 앞면이 길(-x) 쪽. 사슴 서식지(29,-18)와 시냇물(z≈-36) 사이 빈 숲 */
export const HUT = { x: 21, z: -24, rotY: -Math.PI / 2 };
/* 상인 마차 자리 — 길 중심에서 6 m 옆, 마차는 길과 나란히 (side +1 = +x 쪽) */
export const MERCHANT_SPOTS = [
  { z: 18, side: 1, name: '마을 연못 북쪽 길가' },
  { z: -2, side: 1, name: '창시합장 가는 길가' },
  { z: -20, side: -1, name: '시냇물 다리 남쪽 길가' },
  { z: -70, side: -1, name: '성문 앞 길가' },
].map(s => ({ ...s, x: +(px0(s.z) + s.side * 6.2).toFixed(2) }));
export const SHOP_CLEAR = {
  r: 4.2,
  spots: [
    [HUT.x, HUT.z], [HUT.x - 3, HUT.z - 2.5], [HUT.x - 3, HUT.z + 2.5], [HUT.x + 2.5, HUT.z], [HUT.x - 5.5, HUT.z],
    ...MERCHANT_SPOTS.flatMap(s => [[s.x + s.side * 1.4, s.z - 2.6], [s.x + s.side * 1.4, s.z + 2.6], [s.x - s.side * 0.9, s.z]]),
  ],
};

/* ── 연회·결혼식·등불·투석기·줄다리기 (pageant.js) ── */
export const PAGEANT_CLEAR = {
  r: 4.2,
  spots: [
    [15, 48], [18.5, 48], [22, 48], [25.5, 48], [20, 44.5], [20, 51.5],
    [-15.5, 50], [-12, 51],
    [28, -15], [25.5, -13.5], [30.5, -16], [31, -19.5], [34, -22.5], [37.5, -26.5], [37.5, -23], [35, -28],
    [-36, 69], [-33, 69], [-30, 69], [-27, 69], [-24, 69], [-30, 66], [-30, 72],
  ],
};
