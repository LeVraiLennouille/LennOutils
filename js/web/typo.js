(function () {
  'use strict';
  const { $, $$, esc, seg, bindSeg, tog, copy, mk, rng, bindRng } = Kit;

  const RATIOS = [['1.067', 'Seconde mineure — 1,067'], ['1.125', 'Seconde majeure — 1,125'], ['1.2', 'Tierce mineure — 1,2'], ['1.25', 'Tierce majeure — 1,25'], ['1.333', 'Quarte juste — 1,333'], ['1.414', 'Quarte augmentée — 1,414'], ['1.5', 'Quinte juste — 1,5'], ['1.618', 'Nombre d’or — 1,618']];
  const NAMES = { '-4': '3xs', '-3': '2xs', '-2': 'xs', '-1': 'sm', 0: 'base', 1: 'lg', 2: 'xl', 3: '2xl', 4: '3xl', 5: '4xl', 6: '5xl', 7: '6xl', 8: '7xl' };
  const trim = (n, d = 4) => { const s = (+n).toFixed(d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''); return s === '-0' ? '0' : s; };
  const rem = (px, root) => trim(px / root) + 'rem';

  function clampStr(minPx, maxPx, vMin, vMax, root) {
    const lo = Math.min(minPx, maxPx), hi = Math.max(minPx, maxPx);
    if (Math.abs(hi - lo) < 0.0001) return rem(minPx, root);
    const slope = (maxPx - minPx) / (vMax - vMin), inter = minPx - slope * vMin;
    const iv = trim(inter / root), sv = trim(slope * 100);
    const pref = (+iv === 0 ? '' : iv + 'rem ' + (slope < 0 ? '- ' : '+ ')) + (+iv === 0 ? sv : trim(Math.abs(slope * 100))) + 'vw';
    return `clamp(${rem(lo, root)}, ${pref}, ${rem(hi, root)})`;
  }
  window.TypoMath = { clampStr, trim, rem };

  const S = { base: 16, ratio: '1.25', min: 2, max: 5, fluid: false, base2: 18, ratio2: '1.333', vMin: 320, vMax: 1240, naming: 'names', fmt: 'css', vw: 800, root: 16 };

  mk('echelle', `<div class="stage-col">
    <div class="card ty-card"><div class="df-in-head"><h3 class="lr-h">Aperçu de l’échelle</h3><span class="hint" id="ty-info"></span></div>
      <div id="ty-prev" class="ty-prev"></div>
      <div class="field" id="ty-vw-f"><div class="field-row"><label for="ty-vw">Largeur de fenêtre simulée</label><span class="val" id="ty-vw-v">800 px</span></div><input type="range" id="ty-vw" min="320" max="1920" value="800"></div>
    </div>
    <div class="card ty-card"><div class="df-in-head"><h3 class="lr-h">Code</h3><button type="button" class="btn btn-ghost" id="ty-copy">Copier le code</button></div>
      ${seg('ty-fmt', [['css', 'CSS'], ['scss', 'SCSS'], ['json', 'JSON'], ['tw', 'Tailwind']], 'css')}
      <textarea class="text-input df-ta ty-code" id="ty-out" readonly spellcheck="false" wrap="off"></textarea></div></div>
    <div class="controls-col">
      <div class="card control-card"><h3>Échelle</h3>
        <div class="field"><label for="ty-base">Taille de base (px)</label><input type="number" id="ty-base" min="8" max="40" step="0.5" value="16"></div>
        <div class="field"><label for="ty-ratio">Ratio modulaire</label><select id="ty-ratio">${RATIOS.map(r => `<option value="${r[0]}"${r[0] === S.ratio ? ' selected' : ''}>${r[1]}</option>`).join('')}</select></div>
        ${rng('ty-min', 'Tailles plus petites', 0, 4, 2, ' niveaux')}
        ${rng('ty-max', 'Tailles plus grandes', 1, 8, 5, ' niveaux')}
        <div class="field"><label>Nom des variables</label>${seg('ty-naming', [['names', 'Tailles (sm, lg…)'], ['steps', 'Numéros']], 'names')}</div>
      </div>
      <div class="card control-card"><h3>Version fluide</h3>
        ${tog('ty-fluid', 'Échelle fluide avec clamp()', false)}
        <div id="ty-fl" hidden>
          <p class="hint">Les tailles ci-dessus s’appliquent aux petits écrans. Définissez celles des grands écrans :</p>
          <div class="field"><label for="ty-base2">Taille de base grand écran (px)</label><input type="number" id="ty-base2" min="8" max="48" step="0.5" value="18"></div>
          <div class="field"><label for="ty-ratio2">Ratio grand écran</label><select id="ty-ratio2">${RATIOS.map(r => `<option value="${r[0]}"${r[0] === S.ratio2 ? ' selected' : ''}>${r[1]}</option>`).join('')}</select></div>
          <div class="field"><label for="ty-vmin">Largeur d’écran minimale (px)</label><input type="number" id="ty-vmin" min="200" max="1200" step="10" value="320"></div>
          <div class="field"><label for="ty-vmax">Largeur d’écran maximale (px)</label><input type="number" id="ty-vmax" min="400" max="3000" step="10" value="1240"></div>
        </div>
      </div></div>`);

  const host = $('#view-echelle');
  const stepList = () => { const a = []; for (let i = -S.min; i <= S.max; i++) a.push(i); return a; };
  const nameOf = i => (S.naming === 'names' ? (NAMES[i] !== undefined ? NAMES[i] : 'step' + i) : 'step-' + (i < 0 ? 'neg' + -i : i));
  const varOf = i => (S.naming === 'names' ? '--text-' : '--') + nameOf(i);

  function compute() {
    return stepList().map(i => {
      const a = S.base * Math.pow(+S.ratio, i);
      const b = S.fluid ? S.base2 * Math.pow(+S.ratio2, i) : a;
      return { i, a, b, val: S.fluid ? clampStr(a, b, S.vMin, S.vMax, S.root) : rem(a, S.root), at: S.fluid ? Math.max(Math.min(a, b), Math.min(Math.max(a, b), a + ((b - a) * (S.vw - S.vMin)) / (S.vMax - S.vMin))) : a };
    });
  }

  function code(rows) {
    const key = r => (S.naming === 'names' ? nameOf(r.i) : 'step-' + (r.i < 0 ? 'neg' + -r.i : r.i));
    if (S.fmt === 'css') return ':root {\n' + rows.map(r => `  ${varOf(r.i)}: ${r.val};`).join('\n') + '\n}\n';
    if (S.fmt === 'scss') return rows.map(r => `$${(S.naming === 'names' ? 'text-' : '') + nameOf(r.i)}: ${r.val};`).join('\n') + '\n';
    if (S.fmt === 'json') return JSON.stringify(Object.fromEntries(rows.map(r => [key(r), r.val])), null, 2) + '\n';
    return 'module.exports = {\n  theme: {\n    extend: {\n      fontSize: {\n' + rows.map(r => `        '${key(r)}': '${r.val}',`).join('\n') + '\n      }\n    }\n  }\n};\n';
  }

  function render() {
    const rows = compute();
    $('#ty-fl', host).hidden = !S.fluid;
    $('#ty-vw-f', host).hidden = !S.fluid;
    $('#ty-vw-v', host).textContent = S.vw + ' px';
    $('#ty-info', host).textContent = S.fluid ? 'Rendu à ' + S.vw + ' px de large' : 'Ratio ' + S.ratio + ' · base ' + S.base + ' px';
    $('#ty-prev', host).innerHTML = rows.slice().reverse().map(r => `<div class="ty-row"><div class="ty-meta"><b>${esc(nameOf(r.i))}</b><span>${trim(r.at, 2)} px · ${trim(r.at / S.root, 3)} rem</span></div><div class="ty-sample" style="font-size:${r.at}px">Les fleurs du jardin</div></div>`).join('');
    $('#ty-out', host).value = code(rows);
    $$('#ty-fmt button', host).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.fmt));
  }

  const num = (id, key, lo, hi) => $('#' + id, host).addEventListener('input', e => { const v = parseFloat(e.target.value); if (isFinite(v) && v >= lo && v <= hi) { S[key] = v; render(); } });
  num('ty-base', 'base', 8, 40); num('ty-base2', 'base2', 8, 48); num('ty-vmin', 'vMin', 200, 1200); num('ty-vmax', 'vMax', 400, 3000);
  $('#ty-ratio', host).addEventListener('change', e => { S.ratio = e.target.value; render(); });
  $('#ty-ratio2', host).addEventListener('change', e => { S.ratio2 = e.target.value; render(); });
  bindRng('ty-min', ' niveaux', v => { S.min = v; render(); });
  bindRng('ty-max', ' niveaux', v => { S.max = v; render(); });
  bindRng('ty-vw', ' px', v => { S.vw = v; render(); });
  $('#ty-vw-v', host).textContent = S.vw + ' px';
  bindSeg('ty-naming', v => { S.naming = v; render(); });
  bindSeg('ty-fmt', v => { S.fmt = v; render(); });
  $('#ty-fluid', host).addEventListener('change', e => { S.fluid = e.target.checked; render(); });
  $('#ty-copy', host).addEventListener('click', () => copy($('#ty-out', host).value, 'Code copié'));
  render();
})();

(function () {
  'use strict';
  const { $, $$, esc, seg, bindSeg, copy, mk } = Kit;
  const { clampStr, trim } = window.TypoMath;
  const S = { root: 16, minPx: 16, maxPx: 32, vMin: 320, vMax: 1240, prop: 'font-size', unit: 'rem', vw: 800 };

  mk('clamp', `<div class="stage-col">
    <div class="card ty-card"><h3 class="lr-h">Convertisseur px et rem</h3>
      <div class="cv-row">
        <div class="field"><label for="cv-px">Pixels (px)</label><input type="number" id="cv-px" value="24" step="any"></div>
        <span class="cv-eq" aria-hidden="true">=</span>
        <div class="field"><label for="cv-rem">rem (et em)</label><input type="number" id="cv-rem" value="1.5" step="any"></div>
      </div>
      <div class="field"><label for="cv-root">Taille de la police racine (px)</label><input type="number" id="cv-root" value="16" min="1" max="64" step="any"></div>
      <div class="cv-table" id="cv-table"></div>
    </div>
    <div class="card ty-card"><h3 class="lr-h">Générateur de clamp()</h3>
      <div class="cl-grid">
        <div class="field"><label for="cl-min">Valeur minimale (px)</label><input type="number" id="cl-min" value="16" step="any"></div>
        <div class="field"><label for="cl-max">Valeur maximale (px)</label><input type="number" id="cl-max" value="32" step="any"></div>
        <div class="field"><label for="cl-vmin">À partir de la largeur (px)</label><input type="number" id="cl-vmin" value="320" step="10"></div>
        <div class="field"><label for="cl-vmax">Jusqu’à la largeur (px)</label><input type="number" id="cl-vmax" value="1240" step="10"></div>
      </div>
      <div class="field"><label for="cl-prop">Propriété CSS</label><select id="cl-prop"><option>font-size</option><option>line-height</option><option>margin-block</option><option>padding</option><option>gap</option><option>width</option><option>border-radius</option><option value="">Valeur seule</option></select></div>
      <div class="field"><label>Unité de sortie</label>${seg('cl-unit', [['rem', 'rem'], ['px', 'px']], 'rem')}</div>
      <div class="qr-msg" id="cl-msg" hidden></div>
      <pre class="cl-out" id="cl-out" tabindex="0"></pre>
      <button type="button" class="btn btn-accent" id="cl-copy">Copier le CSS</button>
      <div class="field"><div class="field-row"><label for="cl-vw">Tester à une largeur d’écran</label><span class="val" id="cl-vw-v">800 px</span></div><input type="range" id="cl-vw" min="200" max="1920" value="800"></div>
      <div class="cl-test"><div class="cl-bar"><i id="cl-bar"></i></div><p class="cl-res" id="cl-res"></p><div id="cl-sample" class="cl-sample">Aperçu à cette largeur</div></div>
    </div></div>
    <div class="controls-col"><div class="card control-card"><h3>Comment ça marche</h3>
      <p class="hint">La valeur évolue de façon linéaire entre les deux largeurs d’écran, puis reste bloquée aux extrêmes. Utiliser des rem dans la partie souple permet au zoom du navigateur de continuer à fonctionner.</p>
      <p class="hint">Astuce : évitez un maximum supérieur à 2,5 fois le minimum pour du texte, sinon le zoom à 200 % peut devenir insuffisant (critère WCAG 1.4.4).</p></div></div>`);

  const host = $('#view-clamp');
  const val = id => parseFloat($('#' + id, host).value);

  function tableRows() {
    return [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map(px => `<button type="button" class="cv-chip" data-px="${px}"><b>${px}px</b><span>${trim(px / S.root, 3)}rem</span></button>`).join('');
  }

  function convFromPx() {
    const px = val('cv-px');
    if (isFinite(px)) $('#cv-rem', host).value = trim(px / S.root, 4);
  }

  function renderClamp() {
    const msg = $('#cl-msg', host), out = $('#cl-out', host);
    const ok = [S.minPx, S.maxPx, S.vMin, S.vMax].every(isFinite) && S.vMax > S.vMin && S.minPx >= 0 && S.maxPx >= 0;
    $('#cl-vw-v', host).textContent = S.vw + ' px';
    if (!ok) {
      msg.hidden = false; msg.className = 'qr-msg is-error';
      msg.textContent = S.vMax <= S.vMin ? 'La largeur maximale doit être supérieure à la largeur minimale.' : 'Renseignez des valeurs numériques positives.';
      out.textContent = '';
      return;
    }
    let v;
    if (S.unit === 'rem') v = clampStr(S.minPx, S.maxPx, S.vMin, S.vMax, S.root);
    else {
      const lo = Math.min(S.minPx, S.maxPx), hi = Math.max(S.minPx, S.maxPx);
      const slope = (S.maxPx - S.minPx) / (S.vMax - S.vMin), inter = S.minPx - slope * S.vMin;
      v = hi === lo ? trim(lo, 2) + 'px' : `clamp(${trim(lo, 2)}px, ${trim(inter, 3)}px + ${trim(slope * 100, 4)}vw, ${trim(hi, 2)}px)`;
    }
    out.textContent = S.prop ? `${S.prop}: ${v};` : v;
    const ratio = Math.max(S.minPx, S.maxPx) / Math.max(0.0001, Math.min(S.minPx, S.maxPx));
    if (S.prop === 'font-size' && ratio > 2.5) { msg.hidden = false; msg.className = 'qr-msg is-warn'; msg.textContent = 'Le maximum dépasse 2,5 fois le minimum : le zoom à 200 % risque de ne pas agrandir assez le texte.'; } else msg.hidden = true;
    const t = Math.max(0, Math.min(1, (S.vw - S.vMin) / (S.vMax - S.vMin)));
    const cur = S.minPx + (S.maxPx - S.minPx) * t;
    $('#cl-bar', host).style.width = (Math.max(S.minPx, S.maxPx) ? (cur / Math.max(S.minPx, S.maxPx)) * 100 : 0) + '%';
    $('#cl-res', host).textContent = `À ${S.vw} px de large : ${trim(cur, 2)} px (${trim(cur / S.root, 3)} rem)`;
    $('#cl-sample', host).style.cssText = S.prop === 'font-size' ? `font-size:${cur}px` : S.prop === 'line-height' ? `line-height:${cur}px` : 'font-size:16px';
  }

  $('#cv-px', host).addEventListener('input', convFromPx);
  $('#cv-rem', host).addEventListener('input', () => { const r = val('cv-rem'); if (isFinite(r)) $('#cv-px', host).value = trim(r * S.root, 3); });
  $('#cv-root', host).addEventListener('input', () => { const r = val('cv-root'); if (isFinite(r) && r > 0) { S.root = r; $('#cv-table', host).innerHTML = tableRows(); convFromPx(); renderClamp(); } });
  $('#cv-table', host).innerHTML = tableRows();
  $('#cv-table', host).addEventListener('click', e => { const b = e.target.closest('[data-px]'); if (b) copy(trim(+b.dataset.px / S.root, 4) + 'rem', 'Copié'); });
  [['cl-min', 'minPx'], ['cl-max', 'maxPx'], ['cl-vmin', 'vMin'], ['cl-vmax', 'vMax']].forEach(([id, k]) => $('#' + id, host).addEventListener('input', e => { S[k] = parseFloat(e.target.value); renderClamp(); }));
  $('#cl-prop', host).addEventListener('change', e => { S.prop = e.target.value; renderClamp(); });
  $('#cl-vw', host).addEventListener('input', e => { S.vw = +e.target.value; renderClamp(); });
  bindSeg('cl-unit', v => { S.unit = v; renderClamp(); });
  $('#cl-copy', host).addEventListener('click', () => copy($('#cl-out', host).textContent, 'CSS copié'));
  convFromPx();
  renderClamp();
})();
