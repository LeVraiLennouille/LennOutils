/* =====================================================================
   daltonisme.js — couleurs et images vues avec les différents types de daltonisme
   Dépend de js/color/colors-core.js
   ===================================================================== */
(function () {
  'use strict';
  const { $, $$, cl, R, lin, gam, toHex, hsl, fromHsl, hsv, fromHsv, cmyk, fromCmyk, oklab, fromOklab, oklch, fromOklch, ratio, dE, ink, parse, FMT, B, setBase, pub, getLast, css, copy, sw, swRow, cf, rng, bindRng, dz, seg, bindSeg, load, IC, svg, TL, mk, MX, mat, sim, TY } = Colors;
    mk('daltonisme', `<div class="stage-col"><div class="card"><h3 class="sec">Palette</h3><div class="da-head">${TY.map(t => `<span>${t[1]}</span>`).join('')}</div><div id="da-pal"></div></div>
      <div class="card"><h3 class="sec">Image</h3>${dz('da', 'PNG, JPG, SVG, WEBP, AVIF ou HEIC')}<div class="da-imgs" id="da-imgs" hidden></div></div></div>
      <div class="controls-col"><div class="card control-card"><h3>Réglages</h3><div class="field"><label for="da-txt">Couleurs (HEX, RGB, HSL…)</label><textarea id="da-txt" class="text-input" spellcheck="false"></textarea></div>
      <button type="button" class="btn btn-ghost btn-block" id="da-last">Reprendre la dernière palette</button>
      <div style="height:16px"></div>${rng('da-sev', 'Sévérité', 10, 100, 100, ' %')}<p class="hint">100 % = absence complète du type de cônes. Plus bas : forme partielle (anomalie). Valeurs intermédiaires approchées par interpolation.</p>
      <button type="button" class="btn btn-ghost btn-block" id="da-reset" hidden>Changer d’image</button></div></div>`);
    const host = $('#view-daltonisme'); let cols = [], src = null, sev = 1; $('#da-txt').value = toHex(B.c) + ', #E6A23C, #C0392B, #2F5D8A';
    const list = s => s.split(/[\n;]|,(?![^()]*\))/).map(parse).filter(Boolean);
    function pal() { cols = list($('#da-txt').value); $('#da-pal').innerHTML = cols.map(c => `<div class="da-row">${TY.map(t => sw(sim(c, t[0], sev))).join('')}</div>`).join('') || '<p class="hint">Aucune couleur valide.</p>'; }
    function imgs() {
      if (!src) return; $('#da-imgs').innerHTML = TY.map(t => `<figure><canvas data-t="${t[0]}"></canvas><figcaption>${t[1]}</figcaption></figure>`).join('');
      $$('#da-imgs canvas').forEach(cv => { cv.width = src.width; cv.height = src.height; const x = cv.getContext('2d'), d = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height), t = cv.dataset.t;
        if (t !== 'n') { const m = mat(t, sev), L = LUT, a = d.data; for (let i = 0; i < a.length; i += 4) { const r = L[a[i]], g = L[a[i + 1]], b = L[a[i + 2]]; a[i] = gam(cl(m[0] * r + m[1] * g + m[2] * b, 0, 1)); a[i + 1] = gam(cl(m[3] * r + m[4] * g + m[5] * b, 0, 1)); a[i + 2] = gam(cl(m[6] * r + m[7] * g + m[8] * b, 0, 1)); } }
        x.putImageData(d, 0, 0); });
    }
    const LUT = Array.from({ length: 256 }, (_, i) => lin(i));
    $('#da-txt').addEventListener('input', pal); $('#da-last').onclick = () => { const last = getLast(); if (last) { $('#da-txt').value = last.join(', '); pal(); } else Utils.toast('Aucune palette générée pour le moment.'); };
    bindRng('da-sev', ' %', v => { sev = v / 100; pal(); imgs(); });
    Utils.setupDropzone($('#da-dz'), $('#da-in'), async f => {
      const info = await load(f); if (!info) return; const k = Math.min(1, 420 / Math.max(info.width, info.height)), c = Utils.canvasFrom(info.img, info.width * k, info.height * k);
      src = c.getContext('2d').getImageData(0, 0, c.width, c.height); $('#da-dz').hidden = true; $('#da-imgs').hidden = false; $('#da-reset').hidden = false; imgs();
    });
    $('#da-reset').onclick = () => { src = null; $('#da-dz').hidden = false; $('#da-imgs').hidden = true; $('#da-reset').hidden = true; };
    pal();
})();
