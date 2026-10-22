/* notify.js — 화면 위 가운데 알림 한 줄 묶음 (모든 모듈이 같이 쓴다)
 *
 * 여러 모듈(portfolio 메인 toast, 선술집, 낚시, 의뢰, 가게…)이 각자 다른 높이에 알림을 띄우면
 * 동시에 뜰 때 서로 겹치거나 왼쪽 위 의뢰 추적판을 덮었다. 이제는 한 기둥(column)에 쌓는다.
 *  - 위치: 위 가운데, ★ 수배판·가게 효과 칩 아래. 왼쪽 의뢰 추적판·오른쪽 작은 지도와 겹치지 않는 폭.
 *    좁은 화면(≤820px)에서는 두 줄로 접힌 위 버튼 줄과 의뢰 추적판 아래로 내린다.
 *  - 최대 3개, 새 알림이 맨 위, 오래된 것은 아래로 밀리며 사라진다.
 *  - 같은 내용이 1.5초 안에 다시 오면 새로 만들지 않고 시간만 늘린다.
 *  - 문서 보기(body[data-view="doc"])·인트로(body.intro-on) 중에는 숨긴다.
 *
 * 사용:
 *   import { notify } from './notify.js';
 *   notify('🍺 맥주 한 잔!', { ms: 2000, kind: 'parchment' });
 *   kind: 'main'(기본, 진한 남색 큰 글씨) | 'parchment'(양피지) | 'tavern'(양피지 + 말한 사람)
 *   style: { ... } 인라인 스타일 덧붙이기,  cls: '추가 클래스'
 *
 * portfolio.js 연결 (연결 담당):
 *   const { notify } = await import('./notify.js');
 *   const toast = (html, ms = 1600) => notify(html, { ms, kind: 'main' });
 */

const CSS = `
.nt-col{position:fixed;left:50%;top:104px;z-index:44;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;
  width:min(460px,calc(100vw - 580px));min-width:220px;pointer-events:none}
.nt{max-width:100%;box-sizing:border-box;text-align:center;word-break:keep-all;overflow-wrap:anywhere;opacity:0;transform:translateY(-8px) scale(.96);
  transition:opacity .25s,transform .25s}
.nt.on{opacity:1;transform:none}
.nt.out{opacity:0;transform:translateY(6px) scale(.96)}
.nt-main{padding:10px 20px;border-radius:14px;background:rgba(20,12,28,.84);color:#fff;font:800 19px/1.25 Pretendard,system-ui,sans-serif;
  letter-spacing:-.01em;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.nt-parchment,.nt-tavern{padding:9px 15px;border-radius:12px;background:rgba(250,240,214,.97);border:1.5px solid #6b4423;color:#3b2412;
  font:600 13.5px/1.35 Georgia,'Nanum Myeongjo',serif;box-shadow:0 8px 22px rgba(40,24,10,.25)}
.nt-parchment b,.nt-tavern b{color:#8a4a12}
.nt-tavern{display:flex;align-items:center;justify-content:center;gap:8px}
.nt-tavern .who{font-size:11px;font-weight:700;color:#8a5a2b;letter-spacing:.04em;white-space:nowrap}
body[data-view="doc"] .nt-col,body.intro-on .nt-col{display:none}
@media (max-width:820px){
  .nt-col{top:170px;width:calc(100vw - 24px);min-width:0}
  .nt-main{font-size:16px;padding:9px 16px}
  .nt-parchment,.nt-tavern{font-size:13px}
}
@media (prefers-reduced-motion:reduce){.nt{transition:opacity .2s}}
`;

const MAX = 3, DEDUPE_MS = 1500;

export function createNotifier(parent) {
  if (!document.getElementById('nt-css')) {
    const st = document.createElement('style'); st.id = 'nt-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const col = document.createElement('div');
  col.className = 'nt-col'; col.setAttribute('role', 'status'); col.setAttribute('aria-live', 'polite');
  (parent || document.getElementById('drive-root') || document.body).appendChild(col);

  const live = [];   // { el, key, at, timer } — 새 것이 앞

  /* 좁은 화면: 위 버튼 줄이 두 줄로 접히고 의뢰 추적판·★판이 내려오므로, 보이는 것들 바로 아래에 둔다 */
  function place() {
    if (innerWidth > 820) { col.style.top = ''; return; }
    let top = 170;
    for (const sel of ['#g-top', '.qs-track', '#g-wanted']) {
      const e = document.querySelector(sel);
      if (!e || e.hidden || getComputedStyle(e).display === 'none') continue;
      const b = e.getBoundingClientRect();
      if (b.height > 0 && b.top < 260) top = Math.max(top, b.bottom + 8);
    }
    col.style.top = Math.round(top) + 'px';
  }
  addEventListener('resize', place);

  function drop(it) {
    const i = live.indexOf(it); if (i < 0) return;
    live.splice(i, 1); clearTimeout(it.timer);
    it.el.classList.remove('on'); it.el.classList.add('out');
    setTimeout(() => it.el.remove(), 260);
  }

  function notify(html, opts = {}) {
    const ms = opts.ms ?? 2400, kind = opts.kind || 'main';
    const key = kind + '|' + html, now = performance.now();
    const dup = live.find(it => it.key === key && now - it.at < DEDUPE_MS);
    if (dup) {
      clearTimeout(dup.timer); dup.timer = setTimeout(() => drop(dup), ms);
      return dup.el;
    }
    place();
    // 이미 있는 것들의 위치 기억 (FLIP: 아래로 부드럽게 밀리게)
    const before = live.map(it => [it.el, it.el.getBoundingClientRect().top]);
    const el = document.createElement('div');
    el.className = `nt nt-${kind}` + (opts.cls ? ' ' + opts.cls : '');
    el.innerHTML = html;
    if (opts.style) Object.assign(el.style, opts.style);
    col.prepend(el);
    const it = { el, key, at: now, ms, timer: 0 };
    live.unshift(it);
    while (live.length > MAX) drop(live[live.length - 1]);
    for (const [e, top] of before) {
      const d = top - e.getBoundingClientRect().top;
      if (!d) continue;
      e.style.transition = 'none'; e.style.translate = `0 ${d}px`;
      e.getBoundingClientRect();   // 시작 위치 확정
      e.style.transition = 'opacity .25s,transform .25s,translate .25s'; e.style.translate = '0 0';
    }
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    it.timer = setTimeout(() => drop(it), ms);
    return el;
  }
  notify.clear = () => { for (const it of [...live]) drop(it); };
  notify.el = col;
  return notify;
}

let single = null;
/** 모두가 같이 쓰는 알림. 처음 부를 때 만든다. */
export function notify(html, opts) {
  if (!single) single = createNotifier();
  return single(html, opts);
}
notify.clear = () => single && single.clear();
