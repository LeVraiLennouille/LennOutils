/* =====================================================================
   extracteur.js — couleurs dominantes d'une image, couleurs déclarées d'un SVG
   Dépend de js/color/colors-core.js
   ===================================================================== */
(function () {
  'use strict';
  const { $, $$, cl, R, lin, gam, toHex, hsl, fromHsl, hsv, fromHsv, cmyk, fromCmyk, oklab, fromOklab, oklch, fromOklch, ratio, dE, ink, parse, FMT, B, setBase, pub, getLast, css, copy, sw, swRow, cf, rng, bindRng, dz, seg, bindSeg, load, IC, svg, TL, mk, MX, mat, sim, TY } = Colors;
    mk('extracteur', `<div class="stage-col">${dz('ex', 'PNG, JPG, SVG, WEBP, AVIF ou HEIC')}<div class="stage checkerboard" id="ex-stage"><canvas id="ex-cv" class="stage-media" aria-label="Image : cliquez pour prélever une couleur"></canvas></div><div class="card" id="ex-res" hidden></div></div>
      <div class="controls-col"><div class="card control-card"><h3>Extraction</h3><div id="ex-mode-w" hidden><div class="field"><label>Source des couleurs</label>${seg('ex-mode', [['px', 'Dominantes (rendu)'], ['svg', 'Déclarées (SVG)']], 'px')}</div></div>${rng('ex-n', 'Nombre de couleurs', 2, 12, 6)}
      <p class="hint">Cliquez sur l’image pour prélever une couleur précise.</p><button type="button" class="btn btn-accent btn-block" id="ex-exp" hidden>Copier en variables CSS</button><div style="height:8px"></div><button type="button" class="btn btn-ghost btn-block" id="ex-reset" hidden>Changer d’image</button></div></div>`);
    let info = null, big = null, small = null, mode = 'px', cols = [], picks = [];
    const D2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
    function kmeans(d, k) {
      /* Les pixels sont d'abord regroupés en cases OKLab (pondérées) : les nuances rares des contours n'ouvrent pas de groupe. */
      const bk = new Map(); let tot = 0;
      for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3] > 127) { const o = oklab({ r: d.data[i], g: d.data[i + 1], b: d.data[i + 2] }), key = Math.round(o.L / .05) + ',' + Math.round(o.a / .05) + ',' + Math.round(o.b / .05); let e = bk.get(key); if (!e) bk.set(key, e = [0, 0, 0, 0]); e[0] += o.L; e[1] += o.a; e[2] += o.b; e[3]++; tot++; }
      if (!tot) return []; let P = [...bk.values()].map(e => [e[0] / e[3], e[1] / e[3], e[2] / e[3], e[3]]).filter(p => p[3] >= Math.max(2, tot * .003));
      if (!P.length) P = [...bk.values()].map(e => [e[0] / e[3], e[1] / e[3], e[2] / e[3], e[3]]);
      P.sort((x, y) => y[3] - x[3]); const C = [P[0].slice(0, 3)];
      while (C.length < Math.min(k, P.length)) { let bi = 0, bd = -1; P.forEach((p, i) => { const m = Math.min(...C.map(c => D2(p, c))) * Math.sqrt(p[3]); if (m > bd) { bd = m; bi = i; } }); C.push(P[bi].slice(0, 3)); }
      let n = [];
      for (let it = 0; it < 10; it++) { const s = C.map(() => [0, 0, 0, 0]); P.forEach(p => { let bi = 0, bd = 9; C.forEach((c, i) => { const d = D2(p, c); if (d < bd) { bd = d; bi = i; } }); const a = s[bi]; a[0] += p[0] * p[3]; a[1] += p[1] * p[3]; a[2] += p[2] * p[3]; a[3] += p[3]; }); n = s.map(a => a[3]); s.forEach((a, i) => { if (a[3]) C[i] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; }); }
      const sum = n.reduce((x, y) => x + y, 0) || 1; return C.map((c, i) => ({ c: fromOklab(c[0], c[1], c[2]), share: n[i] / sum })).filter(x => x.share > 0).sort((x, y) => y.share - x.share);
    }
    function svgCols(t) {
      t = t.replace(/url\([^)]*\)/gi, '').replace(/\b(?:id|href|xlink:href)\s*=\s*["'][^"']*["']/gi, ''); const cnt = {}, add = s => { const c = parse(s); if (c) { const h = toHex(c); cnt[h] = (cnt[h] || 0) + 1; } };
      (t.match(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/gi) || []).forEach(add);
      t.replace(/(?:fill|stroke|stop-color|flood-color|color)\s*[:=]\s*["']?\s*([a-z]+)/gi, (m, n) => { if (!/^(none|currentcolor|transparent|inherit|url|initial|unset)$/i.test(n)) add(n); return m; });
      return Object.entries(cnt).sort((x, y) => y[1] - x[1]).map(e => ({ c: parse(e[0]), n: e[1] }));
    }
    function render() {
      const n = +$('#ex-n').value; let html = '';
      if (mode === 'svg') { const l = svgCols(info.svgText); cols = l.slice(0, n).map(x => x.c); html = `<h3 class="sec">Couleurs déclarées dans le SVG</h3>` + (l.length ? swRow(cols) + `<p class="hint">${l.length} couleur${l.length > 1 ? 's' : ''} distincte${l.length > 1 ? 's' : ''}${l.length > n ? ', les ' + n + ' plus utilisées affichées' : ''}. Les dégradés et styles externes ne sont pas toujours détectés.</p>` : '<p class="hint">Aucune couleur déclarée trouvée (le SVG utilise peut-être des styles externes).</p>'); }
      else { const r = kmeans(small, n); cols = r.map(x => x.c); html = `<h3 class="sec">Couleurs dominantes</h3>${swRow(cols)}<p class="hint">Parts : ${r.map(x => Math.round(x.share * 100) + ' %').join(' · ')}</p>`; }
      if (picks.length) html += `<h3 class="sec">Prélevées</h3>${swRow(picks)}`;
      $('#ex-res').hidden = false; $('#ex-res').innerHTML = html; $('#ex-exp').hidden = !cols.length; pub(cols.concat(picks));
    }
    Utils.setupDropzone($('#ex-dz'), $('#ex-dz input'), async f => {
      info = await load(f); if (!info) return; const k = Math.min(1, 640 / Math.max(info.width, info.height)), cv = $('#ex-cv');
      big = Utils.canvasFrom(info.img, info.width * k, info.height * k); cv.width = big.width; cv.height = big.height; cv.getContext('2d').drawImage(big, 0, 0);
      const s = Math.min(1, 160 / Math.max(big.width, big.height)); small = Utils.canvasFrom(big, big.width * s, big.height * s); small = small.getContext('2d').getImageData(0, 0, small.width, small.height);
      picks = []; mode = info.svgText ? 'svg' : 'px'; $('#ex-mode-w').hidden = !info.svgText; $$('#ex-mode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === mode));
      $('#ex-dz').hidden = true; $('#ex-stage').classList.add('is-active'); $('#ex-reset').hidden = false; render();
    });
    $('#ex-cv').addEventListener('click', e => { const cv = e.target, r = cv.getBoundingClientRect(), d = cv.getContext('2d').getImageData(Math.floor((e.clientX - r.left) * cv.width / r.width), Math.floor((e.clientY - r.top) * cv.height / r.height), 1, 1).data; if (d[3] < 128) return; picks.push({ r: d[0], g: d[1], b: d[2] }); if (picks.length > 8) picks.shift(); render(); });
    bindSeg('ex-mode', v => { mode = v; render(); }); bindRng('ex-n', '', () => info && render());
    $('#ex-exp').onclick = () => copy(css(cols));
    $('#ex-reset').onclick = () => { info = null; picks = []; $('#ex-dz').hidden = false; $('#ex-stage').classList.remove('is-active'); $('#ex-res').hidden = true; $('#ex-reset').hidden = true; $('#ex-exp').hidden = true; };
})();
