/* =====================================================================
   convertisseur.js — HEX / RGB / HSL / HSV / CMYK / OKLCH
   Dépend de js/color/colors-core.js
   ===================================================================== */
(function () {
  'use strict';
  const { $, $$, cl, R, lin, gam, toHex, hsl, fromHsl, hsv, fromHsv, cmyk, fromCmyk, oklab, fromOklab, oklch, fromOklch, ratio, dE, ink, parse, FMT, B, setBase, pub, getLast, css, copy, sw, swRow, cf, rng, bindRng, dz, seg, bindSeg, load, IC, svg, TL, mk, MX, mat, sim, TY } = Colors;
    const N = { hex: 'HEX', rgb: 'RGB', hsl: 'HSL', hsv: 'HSV', cmyk: 'CMYK', oklch: 'OKLCH' };
    mk('convertisseur', `<div class="stage-col"><div class="card cv-rows">${Object.keys(N).map(f => `<div class="cv-row"><label for="cv-${f}">${N[f]}</label><input id="cv-${f}" data-f="${f}" spellcheck="false" autocomplete="off"><button type="button" class="Ghost" data-cp="${f}">Copier</button></div>`).join('')}</div>
      <p class="hint" id="cv-note">CMYK : conversion mathématique, sans profil ICC ; une impression réelle peut différer.</p></div>
      <div class="controls-col"><div class="card control-card"><h3>Couleur</h3><div data-cf></div><div class="cv-prev" id="cv-prev"></div><button type="button" class="btn btn-ghost btn-block" id="cv-eye" hidden>Pipette (écran)</button></div></div>`);
    const host = $('#view-convertisseur'); let F;
    const show = (c, skip) => {
      Object.keys(N).forEach(f => { const i = $('#cv-' + f); if (i !== skip) { i.value = FMT[f](c); i.removeAttribute('aria-invalid'); } });
      $('#cv-prev').style.background = toHex(c); F.set(c);
    };
    F = cf($('[data-cf]', host), 'Sélecteur', B.c, c => { show(c); setBase(c, upd); });
    const upd = c => show(c); B.subs.push(upd); show(B.c);
    $$('.cv-row input', host).forEach(i => i.addEventListener('input', () => {
      const v = i.value.trim(), f = i.dataset.f, c = parse(f === 'hex' || v.includes('(') || /[a-z]/i.test(v) ? v : f + '(' + v + ')');
      if (c) { show(c, i); setBase(c, upd); } else i.setAttribute('aria-invalid', 'true');
    }));
    host.addEventListener('click', e => { const b = e.target.closest('[data-cp]'); if (b) copy($('#cv-' + b.dataset.cp).value); });
    if (window.EyeDropper) { const b = $('#cv-eye'); b.hidden = false; b.onclick = () => new EyeDropper().open().then(r => { const c = parse(r.sRGBHex); show(c); setBase(c, upd); }).catch(() => {}); }
})();
