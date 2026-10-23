/* 성능 측정 도구 (?test 페이지 콘솔에서):
     const P = await import('/tools/perf-probe.js'); await P.setup();
     await P.spot(-0.8, 67, Math.PI)   // 출발점, 북쪽을 보며: 프레임 시간 + 분류별 그리기 호출/삼각형
   분류별 숫자는 renderer.renderBufferDirect 를 잠깐 감싸 센다 (본 패스 / 그림자 패스). */
let S, R;
export async function setup({ quality = 'high', time = 'day', season = 'autumn' } = {}) {
  S = window.__weapons._dbg.person.parent;
  await new Promise(r => { S.onBeforeRender = ren => { R = ren; S.onBeforeRender = () => {}; r(); }; });
  if (quality) window.__gfx.setQuality(quality);
  if (time) window.__sky.setTime(time);
  if (season) { window.__seasons.jump(season); window.__seasons.speed(0); }
  return 'ok';
}
const firstMesh = c => { let m = null; c.traverse(x => { if (!m && (x.isMesh || x.isPoints)) m = x; }); return m; };
export function cat(o) {
  let p = o; while (p.parent && p.parent !== S) p = p.parent;
  if (p.parent !== S) return 'detached';
  if (p.userData.__cat) return p.userData.__cat;
  const nm = p.name || ''; const names = [];
  p.traverse(x => { if (x.isMesh || x.isPoints) names.push((x.name || '') + '|' + (x.material && x.material.name || '')); });
  const all = names.join(' ');
  let c;
  if (/^NPC_/.test(nm)) c = 'npcs'; else if (/^animal/.test(nm)) c = 'animals'; else if (/^Kid/.test(nm)) c = 'kids';
  else if (/castle/i.test(nm)) c = 'castle'; else if (/bridge/i.test(nm)) c = 'bridge'; else if (/village_props/.test(nm)) c = 'village_props';
  else if (/quest/.test(nm)) c = 'quest-board'; else if (/AutumnWorld/.test(nm)) c = 'world.glb';
  else if (/tavern_|sign_face|booth/.test(all + nm)) c = 'tavern booths+seats'; else if (/Player_/.test(all)) c = 'player';
  else if (/RoofBar/.test(all)) c = 'car'; else if (p.isPoints) c = 'points';
  else if (p.isMesh) c = 'mesh:' + (p.name || p.geometry.type) + ':' + p.material.type; else c = 'misc groups';
  return (p.userData.__cat = c);
}
export function catProf(N = 10) {
  return new Promise(res => {
    const orig = R.renderBufferDirect, B = {}; let f = 0;
    R.renderBufferDirect = function (cam, sc, geo, mat, obj, grp) {
      if (sc === S || sc === null) {
        const k = cat(obj), e = B[k] || (B[k] = { m: 0, s: 0, mt: 0, st: 0 });
        const idx = geo.index ? geo.index.count : (geo.attributes.position ? geo.attributes.position.count : 0);
        let tri = (grp ? grp.count : Math.min(idx, geo.drawRange.count)) / 3;
        if (obj.isInstancedMesh) tri *= obj.count; if (obj.isPoints) tri = 0;
        if (sc === null) { e.s++; e.st += tri; } else { e.m++; e.mt += tri; }
      }
      return orig.apply(this, arguments);
    };
    const tick = () => {
      if (++f < N) return requestAnimationFrame(tick);
      R.renderBufferDirect = orig;
      const rows = Object.entries(B).sort((a, b) => (b[1].m + b[1].s) - (a[1].m + a[1].s));
      const tot = { m: 0, s: 0, mt: 0, st: 0 };
      for (const [, v] of rows) for (const q in tot) tot[q] += v[q] / N;
      res(`TOTAL main ${tot.m.toFixed(0)} / ${(tot.mt / 1e3).toFixed(0)}k | shadow ${tot.s.toFixed(0)} / ${(tot.st / 1e3).toFixed(0)}k\n` +
        rows.filter(([, v]) => v.m + v.s >= N).map(([k, v]) => `${k}\t${(v.m / N).toFixed(0)}\t${(v.mt / N / 1e3).toFixed(0)}k\t${(v.s / N).toFixed(0)}\t${(v.st / N / 1e3).toFixed(0)}k`).join('\n'));
    };
    requestAnimationFrame(tick);
  });
}
/* renderMs = 한 프레임에 장면 renderer.render 에 쓴 CPU 시간 (그림자 패스 포함) */
export function timeRender(N = 120) {
  return new Promise(res => {
    const orig = R.render; let acc = 0, frames = 0, last = performance.now(), cur = 0; const gaps = [];
    R.render = function (s) { const t0 = performance.now(); const r = orig.apply(this, arguments); if (s === S) cur += performance.now() - t0; return r; };
    const tick = () => {
      const now = performance.now(); gaps.push(now - last); last = now; acc += cur; cur = 0;
      if (++frames < N) return requestAnimationFrame(tick);
      R.render = orig; gaps.sort((a, b) => a - b);
      res({ renderMs: +(acc / N).toFixed(2), frameMs: +(gaps.reduce((a, b) => a + b, 0) / N).toFixed(2), p95: +gaps[Math.floor(N * 0.95)].toFixed(1) });
    };
    requestAnimationFrame(tick);
  });
}
/* portfolio.js 에 부스·의자 LOD 연결을 넣기 전 미리 보기용 (연결 후에는 부르지 말 것 — 두 번 붙는다) */
export async function simBoothLOD() {
  const THREE = await import('three'), perf = await import('/perf.js');
  let nb = 0, ns = 0, nf = 0;
  for (const c of [...S.children]) {
    let booth = null;
    for (const ch of c.children) { let sign = false; ch.traverse(o => { if (o.name && o.name.startsWith('sign_face')) sign = true; }); if (sign) booth = ch; }
    if (booth) {
      if (perf.addStaticLOD(THREE, booth, { dist: 38 })) nb++;
      for (const ch of c.children) if (ch.isGroup && ch !== booth && perf.addStaticLOD(THREE, ch, { dist: 38, keep: o => !!o.material.map })) nf++;
      continue;
    }
    if (cat(c) === 'tavern booths+seats' && c.children.length === 1 && perf.addStaticLOD(THREE, c, { dist: 30 })) ns++;
  }
  return { nb, ns, nf };
}
export async function spot(x, z, h, { time = 'day' } = {}) {
  if (time) window.__sky.setTime(time);
  window.__drive.teleport(x, z, h);
  await new Promise(r => setTimeout(r, 1500));
  const t = await timeRender(120);
  return JSON.stringify(t) + '\n' + await catProf(10);
}
