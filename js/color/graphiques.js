/* =====================================================================
   graphiques.js — palettes catégorielles, séquentielles, divergentes
   Dépend de js/color/colors-core.js
   ===================================================================== */
(function () {
  'use strict';
  const { $, $$, cl, R, lin, gam, toHex, hsl, fromHsl, hsv, fromHsv, cmyk, fromCmyk, oklab, fromOklab, oklch, fromOklch, ratio, dE, ink, parse, FMT, B, setBase, pub, getLast, css, copy, sw, swRow, cf, rng, bindRng, dz, seg, bindSeg, load, IC, svg, TL, mk, MX, mat, sim, TY } = Colors;
    mk('graphiques', `<div class="stage-col"><div id="gr-sw"></div><div class="card gr-prev"><svg id="gr-bars" viewBox="0 0 360 150" role="img" aria-label="Aperçu en barres"></svg><svg id="gr-pie" viewBox="0 0 120 120" role="img" aria-label="Aperçu en anneau"></svg></div>
      <div class="stat-strip" id="gr-stats"></div><p class="hint">Écart ΔE (OKLab) minimal entre deux nuances, pour chaque vision. En dessous de 8, deux couleurs risquent d’être confondues : repère indicatif, à compléter par des étiquettes ou des motifs.</p></div>
      <div class="controls-col"><div class="card control-card"><h3>Palette</h3>${seg('gr-t', [['cat', 'Catégories'], ['seq', 'Séquentielle'], ['div', 'Divergente']], 'cat')}<div style="height:16px"></div><div data-cf="a"></div><div data-cf="b" id="gr-b" hidden></div>${rng('gr-n', 'Nombre de couleurs', 3, 12, 6)}
      <button type="button" class="btn btn-accent btn-block" id="gr-exp">Copier en variables CSS</button></div></div>`);
    const host = $('#view-graphiques'); let a = B.c, o = oklch(a), b = fromOklch(o.L, o.C, o.h + 180, true), type = 'cat', cols = [];
    function gen(n) {
      const p = oklch(a), q = oklch(b);
      return Array.from({ length: n }, (_, i) => { const t = n > 1 ? i / (n - 1) : 0; let L, C, h;
        if (type === 'cat') { h = p.h + i * 360 / n; L = i % 2 ? .62 : .74; C = .13; }
        else if (type === 'seq') { L = .95 - .65 * t; C = Math.max(.03, p.C) * (.4 + .6 * Math.sin(Math.PI * (.12 + .76 * t))); h = p.h; }
        else { const u = t * 2 - 1, k = Math.abs(u); L = .93 - .55 * k; C = Math.max(.05, u < 0 ? p.C : q.C) * k + .01; h = u < 0 ? p.h : q.h; }
        return fromOklch(L, C, h, true); });
    }
    function render() {
      const n = +$('#gr-n').value; cols = gen(n); pub(cols); $('#gr-sw').innerHTML = swRow(cols);
      const w = 340 / n; $('#gr-bars').innerHTML = cols.map((c, i) => { const h = 30 + ((i * 47 + 23) % 100); return `<rect x="${10 + i * w}" y="${140 - h}" width="${w - 6}" height="${h}" rx="3" fill="${toHex(c)}"/>`; }).join('');
      const len = 2 * Math.PI * 40 / n; $('#gr-pie').innerHTML = cols.map((c, i) => `<circle cx="60" cy="60" r="40" fill="none" stroke="${toHex(c)}" stroke-width="22" stroke-dasharray="${len} ${len * (n - 1)}" stroke-dashoffset="${-i * len}" transform="rotate(-90 60 60)"/>`).join('');
      $('#gr-stats').innerHTML = TY.slice(0, 4).map(t => { const s = cols.map(c => sim(c, t[0], 1)); let m = 99; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) m = Math.min(m, dE(s[i], s[j])); return `<div class="stat"><span class="k">${t[1]}</span><span class="v mono ${m < 8 ? 'warn' : 'accent'}">${R(m, 1)}</span></div>`; }).join('');
    }
    const Fa = cf($('[data-cf=a]', host), type === 'div' ? 'Couleur 1' : 'Couleur de base', a, c => { a = c; setBase(c, upd); render(); });
    const Fb = cf($('[data-cf=b]', host), 'Couleur 2 (divergente)', b, c => { b = c; render(); });
    const upd = c => { a = c; Fa.set(c); render(); }; B.subs.push(upd);
    bindSeg('gr-t', v => { type = v; $('#gr-b').hidden = v !== 'div'; render(); }); bindRng('gr-n', '', render); $('#gr-exp').onclick = () => copy(css(cols)); render();
})();
