/* =====================================================================
   contraste.js — ratio WCAG, niveaux AA / AAA, correction du premier plan
   Dépend de js/color/colors-core.js
   ===================================================================== */
(function () {
  'use strict';
  const { $, $$, cl, R, lin, gam, toHex, hsl, fromHsl, hsv, fromHsv, cmyk, fromCmyk, oklab, fromOklab, oklch, fromOklch, ratio, dE, ink, parse, FMT, B, setBase, pub, getLast, css, copy, sw, swRow, cf, rng, bindRng, dz, seg, bindSeg, load, IC, svg, TL, mk, MX, mat, sim, TY } = Colors;
    mk('contraste', `<div class="stage-col"><div class="ct-score" id="ct-score" aria-live="polite"><b id="ct-ratio"></b><span>:1</span></div>
      <div class="card ct-card"><table class="ct-table"><thead><tr><th>Élément</th><th>AA</th><th>AAA</th></tr></thead><tbody id="ct-body"></tbody></table><div id="ct-fix" class="ct-fix"></div></div></div>
      <div class="controls-col"><div class="card control-card"><h3>Premier plan</h3><div data-cf="fg"></div>${rng('ct-lf', 'Luminosité', 0, 100, 50, ' %')}
      <h3 style="margin-top:20px">Arrière-plan</h3><div data-cf="bg"></div>${rng('ct-lb', 'Luminosité', 0, 100, 100, ' %')}
      <button type="button" class="btn btn-ghost btn-block" id="ct-swap">Inverser</button></div></div>`);
    const host = $('#view-contraste'); let fg = B.c, bg = parse('#FFFFFF'), Ff, Fb;
    const fix = (f, b, t) => { const h = hsl(f); let best = null, bd = 9; for (let l = 0; l <= 100; l++) { const c = fromHsl(h.h, h.s, l / 100); if (ratio(c, b) >= t) { const d = Math.abs(l / 100 - h.l); if (d < bd) { bd = d; best = c; } } } return best; };
    function render() {
      const r = ratio(fg, bg), sc = $('#ct-score');
      sc.style.background = toHex(bg); sc.style.color = toHex(fg);
      $('#ct-ratio').textContent = (Math.floor(r * 100) / 100).toFixed(2);
      const rows = [['Petit texte', 4.5, 7], ['Grand texte', 3, 4.5], ['Élément d’interface', 3, 3]];
      $('#ct-body').innerHTML = rows.map(x => `<tr><th scope="row">${x[0]}</th>${[x[1], x[2]].map(t => `<td class="${r >= t ? 'ok' : 'ko'}">${r >= t ? '✓ Réussi' : '✕ Échec'} <small>${t}:1</small></td>`).join('')}</tr>`).join('');
      $('#ct-fix').innerHTML = [4.5, 7].filter(t => r < t).map(t => { const c = fix(fg, bg, t); return c ? `<button type="button" class="Ghost" data-fix="${toHex(c)}">Corriger le premier plan en ${toHex(c)} (${t === 4.5 ? 'AA' : 'AAA'})</button>` : `<p class="hint">Aucun premier plan de même teinte n’atteint ${t}:1 sur ce fond.</p>`; }).join('');
      $('#ct-lf').value = Math.round(hsl(fg).l * 100); $('#ct-lf-v').textContent = $('#ct-lf').value + ' %';
      $('#ct-lb').value = Math.round(hsl(bg).l * 100); $('#ct-lb-v').textContent = $('#ct-lb').value + ' %';
    }
    Ff = cf($('[data-cf=fg]', host), 'Couleur HEX', fg, c => { fg = c; setBase(c, upd); render(); });
    Fb = cf($('[data-cf=bg]', host), 'Couleur HEX', bg, c => { bg = c; render(); });
    const upd = c => { fg = c; Ff.set(c); render(); }; B.subs.push(upd);
    const light = (get, set, F, base) => bindRng(get, ' %', v => { const x = hsl(base()); const c = fromHsl(x.h, x.s, v / 100); set(c); F.set(c); if (set === setFg) setBase(c, upd); const el = $('#' + get); const keep = el.value; render(); el.value = keep; $('#' + get + '-v').textContent = keep + ' %'; });
    const setFg = c => { fg = c; }, setBg = c => { bg = c; };
    light('ct-lf', setFg, Ff, () => fg); light('ct-lb', setBg, Fb, () => bg);
    $('#ct-swap').onclick = () => { [fg, bg] = [bg, fg]; Ff.set(fg); Fb.set(bg); setBase(fg, upd); render(); };
    host.addEventListener('click', e => { const b = e.target.closest('[data-fix]'); if (b) { fg = parse(b.dataset.fix); Ff.set(fg); setBase(fg, upd); render(); } });
    render();
})();
