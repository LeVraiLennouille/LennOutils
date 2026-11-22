(function () {
  'use strict';
  const { $, $$, esc, seg, bindSeg, tog, rng, bindRng, copy, mk, toast } = Kit;

  const COLORS = ['#ff6b2d', '#3c8cff', '#2fb36a', '#b06bff', '#e0a100', '#ef476f', '#14b8a6', '#8d6e63'];
  const S = { cols: 'repeat(4, 1fr)', rows: 'repeat(3, 1fr)', cg: 16, rg: 16, ji: 'stretch', ai: 'stretch', span: false, tab: 'css', items: [], next: 0, C: 4, R: 3 };

  mk('grille', `<div class="stage-col">
    <div class="card gr-card"><div class="df-in-head"><h3 class="lr-h">Aperçu de la grille</h3><span class="hint">Faites glisser sur les cases vides pour créer un élément</span></div>
      <div class="gr-stage"><div class="gr-grid" id="gr-grid"></div></div>
    </div>
    <div class="card gr-card"><div class="df-in-head"><h3 class="lr-h">Éléments</h3><button type="button" class="btn btn-ghost" id="gr-add">Ajouter un élément</button></div><div id="gr-items" class="gr-items"></div></div>
    <div class="card gr-card"><div class="df-in-head"><h3 class="lr-h">Code</h3><div class="df-in-tools">${seg('gr-tab', [['css', 'CSS'], ['html', 'HTML']], 'css')}<button type="button" class="btn btn-accent" id="gr-copy">Copier</button></div></div>
      <textarea class="text-input df-ta gr-code" id="gr-out" readonly spellcheck="false" wrap="off"></textarea></div></div>
    <div class="controls-col">
      <div class="card control-card"><h3>Structure</h3>
        <div class="gr-two"><div class="field"><label for="gr-nc">Colonnes</label><input type="number" id="gr-nc" min="1" max="12" value="4"></div><div class="field"><label for="gr-nr">Lignes</label><input type="number" id="gr-nr" min="1" max="12" value="3"></div></div>
        <div class="field"><label for="gr-tc">grid-template-columns</label><input type="text" id="gr-tc" value="repeat(4, 1fr)" spellcheck="false" autocomplete="off"></div>
        <div class="field"><label for="gr-tr">grid-template-rows</label><input type="text" id="gr-tr" value="repeat(3, 1fr)" spellcheck="false" autocomplete="off"></div>
        <div class="qr-msg is-error" id="gr-err" hidden></div>
        ${rng('gr-cg', 'Espace entre colonnes', 0, 64, 16, ' px')}
        ${rng('gr-rg', 'Espace entre lignes', 0, 64, 16, ' px')}
      </div>
      <div class="card control-card"><h3>Alignement</h3>
        <div class="field"><label for="gr-ji">justify-items</label><select id="gr-ji"><option>stretch</option><option>start</option><option>center</option><option>end</option></select></div>
        <div class="field"><label for="gr-ai">align-items</label><select id="gr-ai"><option>stretch</option><option>start</option><option>center</option><option>end</option></select></div>
        ${tog('gr-span', 'Écrire avec span (1 / span 2)', false)}
      </div>
      <div class="card control-card"><h3>Actions</h3><div class="df-btns">
        <button type="button" class="btn btn-ghost btn-block" id="gr-example">Exemple de mise en page</button>
        <button type="button" class="btn btn-ghost btn-block" id="gr-clear">Supprimer les éléments</button></div></div></div>`);

  const host = $('#view-grille');
  const grid = $('#gr-grid', host);
  const color = i => COLORS[i % COLORS.length];
  const letter = n => { let s = ''; n++; while (n > 0) { s = String.fromCharCode(97 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); } return s; };

  function tracks(tpl) {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;width:' + Math.max(300, grid.clientWidth) + 'px;height:300px;display:grid;grid-template-columns:' + tpl;
    document.body.appendChild(probe);
    const n = Math.max(1, getComputedStyle(probe).gridTemplateColumns.split(' ').filter(x => x && x !== 'none').length);
    probe.remove();
    return n;
  }

  function counts() {
    const w = Math.max(300, grid.clientWidth);
    const c = document.createElement('div');
    c.style.cssText = 'position:absolute;visibility:hidden;width:' + w + 'px;height:360px;display:grid;grid-template-columns:' + S.cols + ';grid-template-rows:' + S.rows + ';gap:' + S.rg + 'px ' + S.cg + 'px';
    document.body.appendChild(c);
    const cs = getComputedStyle(c);
    const nc = Math.max(1, cs.gridTemplateColumns.split(' ').filter(x => x && x !== 'none').length);
    const nr = Math.max(1, cs.gridTemplateRows.split(' ').filter(x => x && x !== 'none').length);
    c.remove();
    return [nc, nr];
  }

  function clampItems() {
    S.items.forEach(it => {
      it.c1 = Math.max(1, Math.min(S.C, it.c1)); it.c2 = Math.max(it.c1 + 1, Math.min(S.C + 1, it.c2));
      it.r1 = Math.max(1, Math.min(S.R, it.r1)); it.r2 = Math.max(it.r1 + 1, Math.min(S.R + 1, it.r2));
    });
  }

  function paint() {
    [S.C, S.R] = counts();
    clampItems();
    $('#gr-nc', host).value = S.C; $('#gr-nr', host).value = S.R;
    grid.style.cssText = `display:grid;grid-template-columns:${S.cols};grid-template-rows:${S.rows};gap:${S.rg}px ${S.cg}px;justify-items:${S.ji};align-items:${S.ai}`;
    let h = '';
    for (let r = 1; r <= S.R; r++) for (let c = 1; c <= S.C; c++) h += `<div class="gr-cell" data-r="${r}" data-c="${c}" style="grid-column:${c};grid-row:${r}"></div>`;
    S.items.forEach((it, i) => { h += `<div class="gr-item" data-id="${it.id}" style="grid-column:${it.c1}/${it.c2};grid-row:${it.r1}/${it.r2};--c:${color(it.id)}"><b>${esc(it.name.toUpperCase())}</b></div>`; });
    grid.innerHTML = h;
    $('#gr-items', host).innerHTML = S.items.length ? S.items.map(it => `<div class="gr-row" data-id="${it.id}"><span class="gr-sw" style="background:${color(it.id)}"></span><input type="text" class="gr-nm" value="${esc(it.name)}" aria-label="Nom de l’élément" maxlength="24" spellcheck="false"><label>Colonnes <input type="number" data-k="c1" min="1" max="${S.C}" value="${it.c1}"> à <input type="number" data-k="c2" min="1" max="${S.C}" value="${it.c2 - 1}"></label><label>Lignes <input type="number" data-k="r1" min="1" max="${S.R}" value="${it.r1}"> à <input type="number" data-k="r2" min="1" max="${S.R}" value="${it.r2 - 1}"></label><button type="button" class="Ghost" data-del>Supprimer</button></div>`).join('') : '<p class="hint">Aucun élément : faites glisser sur la grille ou cliquez sur « Ajouter un élément ».</p>';
    code();
  }

  const cls = n => '.item-' + n;
  const pos = (a, b, span) => (span ? `${a} / span ${b - a}` : `${a} / ${b}`);

  function code() {
    let out;
    if (S.tab === 'css') {
      const L = ['.grid {', '  display: grid;', `  grid-template-columns: ${S.cols};`, `  grid-template-rows: ${S.rows};`, S.cg === S.rg ? `  gap: ${S.cg}px;` : `  gap: ${S.rg}px ${S.cg}px;`];
      if (S.ji !== 'stretch') L.push(`  justify-items: ${S.ji};`);
      if (S.ai !== 'stretch') L.push(`  align-items: ${S.ai};`);
      L.push('}');
      S.items.forEach(it => L.push('', cls(it.name) + ' {', `  grid-column: ${pos(it.c1, it.c2, S.span)};`, `  grid-row: ${pos(it.r1, it.r2, S.span)};`, '}'));
      out = L.join('\n') + '\n';
    } else out = '<div class="grid">\n' + S.items.map(it => `  <div class="item-${it.name}">${esc(it.name.toUpperCase())}</div>`).join('\n') + (S.items.length ? '\n' : '') + '</div>\n';
    $('#gr-out', host).value = out;
  }

  function uniqueName(base) {
    let n = base || 'item', k = 2;
    const taken = nm => S.items.some(i => i.name === nm);
    let cand = n;
    while (taken(cand)) cand = n + '-' + k++;
    return cand;
  }
  function addItem(c1, c2, r1, r2) {
    const id = S.next++;
    S.items.push({ id, name: uniqueName(letter(id)), c1, c2, r1, r2 });
  }
  function firstFree() {
    for (let r = 1; r <= S.R; r++) for (let c = 1; c <= S.C; c++) if (!S.items.some(i => c >= i.c1 && c < i.c2 && r >= i.r1 && r < i.r2)) return [c, r];
    return [1, 1];
  }

  let drag = null;
  grid.addEventListener('pointerdown', e => {
    const cell = e.target.closest('.gr-cell');
    if (!cell || e.button > 0) return;
    drag = { c: +cell.dataset.c, r: +cell.dataset.r, c2: +cell.dataset.c, r2: +cell.dataset.r };
    grid.setPointerCapture(e.pointerId);
    mark();
    e.preventDefault();
  });
  function mark() {
    const [a, b, c, d] = [Math.min(drag.c, drag.c2), Math.max(drag.c, drag.c2), Math.min(drag.r, drag.r2), Math.max(drag.r, drag.r2)];
    $$('.gr-cell', grid).forEach(x => x.classList.toggle('is-sel', +x.dataset.c >= a && +x.dataset.c <= b && +x.dataset.r >= c && +x.dataset.r <= d));
  }
  grid.addEventListener('pointermove', e => {
    if (!drag) return;
    const el = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList && x.classList.contains('gr-cell'));
    if (el) { drag.c2 = +el.dataset.c; drag.r2 = +el.dataset.r; mark(); }
  });
  const end = e => {
    if (!drag) return;
    addItem(Math.min(drag.c, drag.c2), Math.max(drag.c, drag.c2) + 1, Math.min(drag.r, drag.r2), Math.max(drag.r, drag.r2) + 1);
    drag = null;
    paint();
  };
  grid.addEventListener('pointerup', end);
  grid.addEventListener('pointercancel', () => { drag = null; $$('.gr-cell.is-sel', grid).forEach(x => x.classList.remove('is-sel')); });

  $('#gr-items', host).addEventListener('input', e => {
    const row = e.target.closest('.gr-row');
    if (!row) return;
    const it = S.items.find(x => x.id === +row.dataset.id);
    if (e.target.classList.contains('gr-nm')) {
      const v = e.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
      if (v && !S.items.some(x => x !== it && x.name === v)) { it.name = v; code(); $('.gr-item[data-id="' + it.id + '"] b', grid).textContent = v.toUpperCase(); }
      return;
    }
    const k = e.target.dataset.k, v = parseInt(e.target.value, 10);
    if (!k || !isFinite(v)) return;
    if (k === 'c1') it.c1 = v; else if (k === 'c2') it.c2 = v + 1; else if (k === 'r1') it.r1 = v; else it.r2 = v + 1;
    if (it.c2 <= it.c1 && (k === 'c1' || k === 'c2')) { if (k === 'c1') it.c2 = it.c1 + 1; else it.c1 = it.c2 - 1; }
    if (it.r2 <= it.r1 && (k === 'r1' || k === 'r2')) { if (k === 'r1') it.r2 = it.r1 + 1; else it.r1 = it.r2 - 1; }
    clampItems();
    const g = $('.gr-item[data-id="' + it.id + '"]', grid);
    g.style.gridColumn = it.c1 + '/' + it.c2; g.style.gridRow = it.r1 + '/' + it.r2;
    code();
  });
  $('#gr-items', host).addEventListener('click', e => {
    if (!e.target.closest('[data-del]')) return;
    const id = +e.target.closest('.gr-row').dataset.id;
    S.items = S.items.filter(x => x.id !== id);
    paint();
  });

  function validate(id, prop, key) {
    const v = $('#' + id, host).value.trim();
    const err = $('#gr-err', host);
    if (!v || !CSS.supports(prop, v)) { err.hidden = false; err.textContent = 'Modèle invalide pour ' + prop + ' : ' + (v || '(vide)') + '.'; return false; }
    err.hidden = true;
    S[key] = v;
    return true;
  }
  $('#gr-tc', host).addEventListener('input', () => { if (validate('gr-tc', 'grid-template-columns', 'cols')) paint(); });
  $('#gr-tr', host).addEventListener('input', () => { if (validate('gr-tr', 'grid-template-rows', 'rows')) paint(); });
  $('#gr-nc', host).addEventListener('input', e => { const n = Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)); S.cols = `repeat(${n}, 1fr)`; $('#gr-tc', host).value = S.cols; paint(); });
  $('#gr-nr', host).addEventListener('input', e => { const n = Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)); S.rows = `repeat(${n}, 1fr)`; $('#gr-tr', host).value = S.rows; paint(); });
  bindRng('gr-cg', ' px', v => { S.cg = v; paint(); });
  bindRng('gr-rg', ' px', v => { S.rg = v; paint(); });
  $('#gr-ji', host).addEventListener('change', e => { S.ji = e.target.value; paint(); });
  $('#gr-ai', host).addEventListener('change', e => { S.ai = e.target.value; paint(); });
  $('#gr-span', host).addEventListener('change', e => { S.span = e.target.checked; code(); });
  bindSeg('gr-tab', v => { S.tab = v; code(); });
  $('#gr-add', host).addEventListener('click', () => { const [c, r] = firstFree(); addItem(c, c + 1, r, r + 1); paint(); });
  $('#gr-clear', host).addEventListener('click', () => { S.items = []; paint(); });
  $('#gr-copy', host).addEventListener('click', () => copy($('#gr-out', host).value, 'Code copié'));
  function example() {
    S.cols = 'repeat(4, 1fr)'; S.rows = 'repeat(3, 1fr)'; S.items = []; S.next = 0;
    $('#gr-tc', host).value = S.cols; $('#gr-tr', host).value = S.rows; $('#gr-err', host).hidden = true;
    addItem(1, 5, 1, 2); S.items[0].name = 'header';
    addItem(1, 2, 2, 4); S.items[1].name = 'sidebar';
    addItem(2, 5, 2, 3); S.items[2].name = 'main';
    addItem(2, 5, 3, 4); S.items[3].name = 'footer';
    paint();
  }
  $('#gr-example', host).addEventListener('click', example);
  example();
  window.addEventListener('resize', () => { if (!host.hidden) paint(); });
  window.addEventListener('hashchange', () => { if (location.hash === '#grille') paint(); });
})();
