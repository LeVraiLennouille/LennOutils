(function () {
  'use strict';
  const { $, $$, cl, R, lin, gam, toHex, hsl, fromHsl, hsv, fromHsv, cmyk, fromCmyk, oklab, fromOklab, oklch, fromOklch, ratio, dE, ink, parse, FMT, B, setBase, pub, getLast, css, copy, sw, swRow, cf, rng, bindRng, dz, seg, bindSeg, load, IC, svg, TL, mk, MX, mat, sim, TY } = Colors;
    mk('melange', `<div class="stage-col"><div id="mx-out"></div></div>
      <div class="controls-col"><div class="card control-card"><h3>Couleurs</h3><div data-cf="a"></div><div data-cf="b"></div>
      <div class="field"><label for="mx-sp">Espace de mélange</label><select id="mx-sp"><option value="srgb">sRGB (classique)</option><option value="oklab">OKLab (perceptuel)</option><option value="oklch">OKLCH (teinte conservée)</option></select></div>
      ${rng('mx-bal', 'Équilibre', 5, 95, 50, ' %')}${rng('mx-n', 'Nuances intermédiaires', 1, 18, 9)}
      <button type="button" class="btn btn-accent btn-block" id="mx-exp">Copier en variables CSS</button></div></div>`);
    const host = $('#view-melange'); let a = B.c, b = parse('#000000'), list = [];
    const mix = (x, y, t, sp) => {
      if (sp === 'srgb') return { r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t };
      if (sp === 'oklab') { const p = oklab(x), q = oklab(y); return fromOklab(p.L + (q.L - p.L) * t, p.a + (q.a - p.a) * t, p.b + (q.b - p.b) * t); }
      const p = oklch(x), q = oklch(y), dh = ((q.h - p.h + 540) % 360) - 180; return fromOklch(p.L + (q.L - p.L) * t, p.C + (q.C - p.C) * t, p.h + dh * t, true);
    };
    function render() {
      const n = +$('#mx-n').value + 2, bal = +$('#mx-bal').value / 100, e = Math.log(bal) / Math.log(.5), sp = $('#mx-sp').value;
      list = Array.from({ length: n }, (_, i) => mix(a, b, Math.pow(i / (n - 1), e), sp)); list[0] = a; list[n - 1] = b;
      $('#mx-out').innerHTML = `<h3 class="sec">Palette</h3>${swRow(list)}`; pub(list);
    }
    const Fa = cf($('[data-cf=a]', host), 'Couleur 1', a, c => { a = c; setBase(c, upd); render(); });
    const Fb = cf($('[data-cf=b]', host), 'Couleur 2', b, c => { b = c; render(); });
    const upd = c => { a = c; Fa.set(c); render(); }; B.subs.push(upd);
    bindRng('mx-bal', ' %', render); bindRng('mx-n', '', render); $('#mx-sp').onchange = render; $('#mx-exp').onclick = () => copy(css(list)); render();
})();
