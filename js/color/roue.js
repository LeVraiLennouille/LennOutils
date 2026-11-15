/* =====================================================================
   roue.js — roue, anneau de luminosité et sept harmonies
   Dépend de js/color/colors-core.js
   ===================================================================== */
(function () {
  'use strict';
  const { $, $$, cl, R, lin, gam, toHex, hsl, fromHsl, hsv, fromHsv, cmyk, fromCmyk, oklab, fromOklab, oklch, fromOklch, ratio, dE, ink, parse, FMT, B, setBase, pub, getLast, css, copy, sw, swRow, cf, rng, bindRng, dz, seg, bindSeg, load, IC, svg, TL, mk, MX, mat, sim, TY } = Colors;
    const H = { analogue: ['Analogues', [-30, 0, 30]], complementaire: ['Complémentaires', [0, 180]], double: ['Double complémentaire partagée', [0, 30, 180, 210]], rectangle: ['Rectangle', [0, 60, 180, 240]], partagee: ['Complémentaire partagée', [0, 150, 210]], tetradique: ['Tétradique (carré)', [0, 90, 180, 270]], triadique: ['Triadique', [0, 120, 240]] };
    mk('roue', `<div class="stage-col"><div class="card wh-card"><canvas id="wh" width="360" height="360" aria-label="Roue chromatique : glissez pour choisir la teinte et la saturation, l’anneau règle la luminosité"></canvas></div><h3 class="sec">Toutes les harmonies</h3><div class="wh-all" id="wh-all"></div></div>
      <div class="controls-col"><div class="card control-card"><h3>Couleur</h3><div data-cf></div>
      <div class="field"><label for="wh-h">Harmonie</label><select id="wh-h">${Object.keys(H).map(k => `<option value="${k}">${H[k][0]}</option>`).join('')}</select></div>
      <div class="wh-stack" id="wh-stack"></div>
      <div class="toolbar-row"><button type="button" class="btn btn-ghost" id="wh-rnd">Palette aléatoire</button><button type="button" class="btn btn-accent" id="wh-exp">Copier en CSS</button></div></div></div>`);
    const host = $('#view-roue'), cv = $('#wh'), g = cv.getContext('2d'), S = 360, M = 180, RW = 150, RR = 172;
    let st = hsl(B.c), F, wl = -1, wimg;
    const cur = () => fromHsl(st.h, st.s, st.l), hs = () => H[$('#wh-h').value][1];
    const pal = (offs, c) => { const x = hsl(c || cur()); return offs.map(o => fromHsl(x.h + o, x.s, x.l)); };
    function wheel() {
      if (wl !== st.l) { wimg = g.createImageData(S, S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = x - M, dy = y - M, d = Math.hypot(dx, dy); if (d > RW) continue; const c = fromHsl(Math.atan2(dx, -dy) * 180 / Math.PI, d / RW, st.l), i = 4 * (y * S + x); wimg.data.set([c.r, c.g, c.b, 255], i); } wl = st.l; }
      g.putImageData(wimg, 0, 0);
      const gr = g.createLinearGradient(0, 8, 0, 352); gr.addColorStop(0, '#000'); gr.addColorStop(.5, toHex(fromHsl(st.h, st.s, .5))); gr.addColorStop(1, '#fff');
      g.lineWidth = 10; g.strokeStyle = gr; g.beginPath(); g.arc(M, M, RR, 0, 7); g.stroke();
      const dot = (x, y, r, w) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.lineWidth = w; g.strokeStyle = '#fff'; g.stroke(); g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(x, y, r + w / 2, 0, 7); g.stroke(); };
      hs().forEach(o => { if (o === 0) return; const a = (st.h + o) * Math.PI / 180; dot(M + st.s * RW * Math.sin(a), M - st.s * RW * Math.cos(a), 6, 2); });
      const a = st.h * Math.PI / 180; dot(M + st.s * RW * Math.sin(a), M - st.s * RW * Math.cos(a), 10, 3);
      const ry = 8 + st.l * 344; dot(M + Math.sqrt(Math.max(0, RR * RR - (ry - M) ** 2)), ry, 8, 3);
    }
    function render(skipF) {
      const c = cur(); if (!skipF) F.set(c); wheel();
      const l = pal(hs()); $('#wh-stack').innerHTML = l.map((x, i) => sw(x, hs()[i] === 0 ? '● ' : '')).join(''); pub(l);
      $('#wh-all').innerHTML = Object.keys(H).map(k => `<div><div class="toolbar-row"><b>${H[k][0]}</b><button type="button" class="btn-text" data-css="${k}">Copier en CSS</button></div>${swRow(pal(H[k][1]))}</div>`).join('');
    }
    F = cf($('[data-cf]', host), 'Couleur HEX', B.c, c => { st = hsl(c); setBase(c, upd); render(true); });
    const upd = c => { st = hsl(c); render(); }; B.subs.push(upd);
    const drag = e => {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * S / r.width, y = (e.clientY - r.top) * S / r.height;
      if (drag.ring) st.l = cl((y - 8) / 344, 0, 1); else { const dx = x - M, dy = y - M; st.h = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360; st.s = cl(Math.hypot(dx, dy) / RW, 0, 1); }
      setBase(cur(), upd); render();
    };
    cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); drag.ring = Math.hypot((e.clientX - r.left) * S / r.width - M, (e.clientY - r.top) * S / r.height - M) > RW + 6; cv.setPointerCapture(e.pointerId); drag.on = true; drag(e); });
    cv.addEventListener('pointermove', e => { if (drag.on) drag(e); });
    cv.addEventListener('pointerup', () => { drag.on = false; });
    $('#wh-h').onchange = () => render(true);
    $('#wh-rnd').onclick = () => { st = { h: Math.random() * 360, s: .45 + Math.random() * .45, l: .4 + Math.random() * .25 }; $('#wh-h').selectedIndex = Math.floor(Math.random() * 7); setBase(cur(), upd); render(); };
    $('#wh-exp').onclick = () => copy(css(pal(hs())));
    host.addEventListener('click', e => { const b = e.target.closest('[data-css]'); if (b) copy(css(pal(H[b.dataset.css][1]))); });
    drag.on = false; render();
})();
