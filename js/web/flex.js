(function () {
  'use strict';
  const { $, $$, esc, seg, bindSeg, tog, rng, bindRng, copy, mk } = Kit;

  const COLORS = ['#ff6b2d', '#3c8cff', '#2fb36a', '#b06bff', '#e0a100', '#ef476f', '#14b8a6', '#8d6e63', '#6c7a89', '#c2410c', '#1d4ed8', '#15803d'];
  const DEF = { grow: 0, shrink: 1, basis: 'auto', self: 'auto', order: 0, w: '', h: '' };
  const mkItem = (o) => Object.assign({}, DEF, o || {});
  const S = { dir: 'row', wrap: 'nowrap', jc: 'flex-start', ai: 'stretch', ac: 'normal', gap: 16, height: 260, all: false, tab: 'css', sel: 0, items: [mkItem(), mkItem(), mkItem()] };

  const PRESETS = [
    ['Centrer', () => ({ dir: 'row', wrap: 'nowrap', jc: 'center', ai: 'center', ac: 'normal', gap: 16, items: [mkItem({ w: '120px', h: '80px' })] })],
    ['Barre de navigation', () => ({ dir: 'row', wrap: 'nowrap', jc: 'space-between', ai: 'center', ac: 'normal', gap: 16, items: [mkItem(), mkItem(), mkItem(), mkItem()] })],
    ['Colonne centrée', () => ({ dir: 'column', wrap: 'nowrap', jc: 'center', ai: 'center', ac: 'normal', gap: 12, items: [mkItem({ w: '140px', h: '50px' }), mkItem({ w: '140px', h: '50px' }), mkItem({ w: '140px', h: '50px' })] })],
    ['Cartes qui s’enroulent', () => ({ dir: 'row', wrap: 'wrap', jc: 'flex-start', ai: 'stretch', ac: 'normal', gap: 16, items: Array.from({ length: 6 }, () => mkItem({ grow: 1, basis: '30%' })) })],
    ['Contenu qui s’étire', () => ({ dir: 'row', wrap: 'nowrap', jc: 'flex-start', ai: 'stretch', ac: 'normal', gap: 16, items: [mkItem({ basis: '160px' }), mkItem({ grow: 1 }), mkItem({ basis: '100px' })] })]
  ];

  mk('flex', `<div class="stage-col">
    <div class="card gr-card"><div class="df-in-head"><h3 class="lr-h">Aperçu du conteneur</h3><span class="hint">Cliquez sur un élément pour modifier ses propriétés</span></div>
      <div class="fx-stage"><div class="fx-box" id="fx-box"></div></div>
      <div class="fx-chips" id="fx-chips"></div></div>
    <div class="card gr-card"><div class="df-in-head"><h3 class="lr-h" id="fx-sel-t">Élément sélectionné</h3><div class="df-in-tools"><button type="button" class="btn btn-ghost" id="fx-add">Ajouter</button><button type="button" class="btn btn-ghost" id="fx-del">Supprimer</button></div></div>
      <div class="fx-props" id="fx-props"></div></div>
    <div class="card gr-card"><div class="df-in-head"><h3 class="lr-h">Code</h3><div class="df-in-tools">${seg('fx-tab', [['css', 'CSS'], ['html', 'HTML']], 'css')}<button type="button" class="btn btn-accent" id="fx-copy">Copier</button></div></div>
      <textarea class="text-input df-ta gr-code" id="fx-out" readonly spellcheck="false" wrap="off"></textarea></div></div>
    <div class="controls-col">
      <div class="card control-card"><h3>Conteneur</h3>
        <div class="field"><label for="fx-dir">flex-direction</label><select id="fx-dir"><option>row</option><option>row-reverse</option><option>column</option><option>column-reverse</option></select></div>
        <div class="field"><label for="fx-wrap">flex-wrap</label><select id="fx-wrap"><option>nowrap</option><option>wrap</option><option>wrap-reverse</option></select></div>
        <div class="field"><label for="fx-jc">justify-content</label><select id="fx-jc"><option>flex-start</option><option>flex-end</option><option>center</option><option>space-between</option><option>space-around</option><option>space-evenly</option></select></div>
        <div class="field"><label for="fx-ai">align-items</label><select id="fx-ai"><option>stretch</option><option>flex-start</option><option>flex-end</option><option>center</option><option>baseline</option></select></div>
        <div class="field" id="fx-ac-f"><label for="fx-ac">align-content</label><select id="fx-ac"><option>normal</option><option>flex-start</option><option>flex-end</option><option>center</option><option>space-between</option><option>space-around</option><option>stretch</option></select></div>
        ${rng('fx-gap', 'gap', 0, 64, 16, ' px')}
        ${rng('fx-h', 'Hauteur de l’aperçu', 120, 520, 260, ' px')}
        ${tog('fx-all', 'Afficher toutes les propriétés', false)}
      </div>
      <div class="card control-card"><h3>Modèles</h3><div class="rx-presets" id="fx-presets">${PRESETS.map((p, i) => `<button type="button" data-i="${i}">${esc(p[0])}</button>`).join('')}</div></div></div>`);

  const host = $('#view-flex');
  const box = $('#fx-box', host);
  const color = i => COLORS[i % COLORS.length];

  function isDefault(it) { return it.grow === 0 && it.shrink === 1 && it.basis === 'auto'; }

  function paint() {
    box.style.cssText = `display:flex;flex-direction:${S.dir};flex-wrap:${S.wrap};justify-content:${S.jc};align-items:${S.ai};align-content:${S.ac};gap:${S.gap}px;height:${S.height}px`;
    box.innerHTML = S.items.map((it, i) => `<div class="fx-item${i === S.sel ? ' is-sel' : ''}" data-i="${i}" style="--c:${color(i)};flex:${it.grow} ${it.shrink} ${it.basis};align-self:${it.self};order:${it.order};${it.w ? 'width:' + it.w + ';' : ''}${it.h ? 'height:' + it.h + ';' : ''}">${i + 1}</div>`).join('');
    $('#fx-chips', host).innerHTML = S.items.map((_, i) => `<button type="button" class="fx-chip${i === S.sel ? ' is-sel' : ''}" data-i="${i}" style="--c:${color(i)}">${i + 1}</button>`).join('');
    const it = S.items[S.sel];
    $('#fx-ac-f', host).hidden = S.wrap === 'nowrap';
    $('#fx-del', host).disabled = S.items.length <= 1;
    $('#fx-sel-t', host).textContent = it ? 'Élément ' + (S.sel + 1) : 'Élément';
    $('#fx-props', host).innerHTML = it ? `<div class="field"><label for="fp-grow">flex-grow</label><input type="number" id="fp-grow" data-k="grow" min="0" step="1" value="${it.grow}"></div><div class="field"><label for="fp-shrink">flex-shrink</label><input type="number" id="fp-shrink" data-k="shrink" min="0" step="1" value="${it.shrink}"></div><div class="field"><label for="fp-basis">flex-basis</label><input type="text" id="fp-basis" data-k="basis" value="${esc(it.basis)}" spellcheck="false" placeholder="auto, 200px, 30%"></div><div class="field"><label for="fp-self">align-self</label><select id="fp-self" data-k="self">${['auto', 'flex-start', 'flex-end', 'center', 'baseline', 'stretch'].map(v => `<option${v === it.self ? ' selected' : ''}>${v}</option>`).join('')}</select></div><div class="field"><label for="fp-order">order</label><input type="number" id="fp-order" data-k="order" step="1" value="${it.order}"></div><div class="field"><label for="fp-w">width</label><input type="text" id="fp-w" data-k="w" value="${esc(it.w)}" spellcheck="false" placeholder="auto"></div><div class="field"><label for="fp-h">height</label><input type="text" id="fp-h" data-k="h" value="${esc(it.h)}" spellcheck="false" placeholder="auto"></div>` : '';
    code();
  }

  function code() {
    if (S.tab === 'html') {
      $('#fx-out', host).value = '<div class="container">\n' + S.items.map((_, i) => `  <div class="item-${i + 1}">${i + 1}</div>`).join('\n') + '\n</div>\n';
      return;
    }
    const L = ['.container {', '  display: flex;'];
    const add = (p, v, d) => { if (S.all || v !== d) L.push(`  ${p}: ${v};`); };
    add('flex-direction', S.dir, 'row'); add('flex-wrap', S.wrap, 'nowrap'); add('justify-content', S.jc, 'flex-start'); add('align-items', S.ai, 'stretch');
    if (S.wrap !== 'nowrap') add('align-content', S.ac, 'normal');
    if (S.all || S.gap) L.push(`  gap: ${S.gap}px;`);
    L.push('}');
    S.items.forEach((it, i) => {
      const P = [];
      if (S.all || !isDefault(it)) P.push(`  flex: ${it.grow} ${it.shrink} ${it.basis};`);
      if (S.all || it.self !== 'auto') P.push(`  align-self: ${it.self};`);
      if (S.all || it.order !== 0) P.push(`  order: ${it.order};`);
      if (it.w) P.push(`  width: ${it.w};`);
      if (it.h) P.push(`  height: ${it.h};`);
      if (P.length) L.push('', `.item-${i + 1} {`, ...P, '}');
    });
    $('#fx-out', host).value = L.join('\n') + '\n';
  }

  function load(cfg) {
    Object.assign(S, cfg, { sel: 0 });
    ['dir', 'wrap', 'jc', 'ai', 'ac'].forEach(k => { $('#fx-' + k, host).value = S[k]; });
    $('#fx-gap', host).value = S.gap; $('#fx-gap-v', host).textContent = S.gap + ' px';
    paint();
  }

  ['dir', 'wrap', 'jc', 'ai', 'ac'].forEach(k => $('#fx-' + k, host).addEventListener('change', e => { S[k] = e.target.value; paint(); }));
  bindRng('fx-gap', ' px', v => { S.gap = v; paint(); });
  bindRng('fx-h', ' px', v => { S.height = v; paint(); });
  $('#fx-all', host).addEventListener('change', e => { S.all = e.target.checked; code(); });
  bindSeg('fx-tab', v => { S.tab = v; code(); });
  const pick = e => { const t = e.target.closest('[data-i]'); if (t && !t.closest('#fx-presets')) { S.sel = +t.dataset.i; paint(); } };
  box.addEventListener('click', pick);
  $('#fx-chips', host).addEventListener('click', pick);
  $('#fx-props', host).addEventListener('input', e => {
    const k = e.target.dataset.k, it = S.items[S.sel];
    if (!k || !it) return;
    let v = e.target.value;
    if (k === 'grow' || k === 'shrink' || k === 'order') { v = parseFloat(v); if (!isFinite(v)) return; }
    else if (k === 'basis') { v = v.trim() || 'auto'; if (!CSS.supports('flex-basis', v)) return; }
    else if (k === 'w' || k === 'h') { v = v.trim(); if (v && !CSS.supports(k === 'w' ? 'width' : 'height', v)) return; }
    it[k] = v;
    const el = $('.fx-item[data-i="' + S.sel + '"]', box);
    el.style.cssText = `--c:${color(S.sel)};flex:${it.grow} ${it.shrink} ${it.basis};align-self:${it.self};order:${it.order};${it.w ? 'width:' + it.w + ';' : ''}${it.h ? 'height:' + it.h + ';' : ''}`;
    code();
  });
  $('#fx-add', host).addEventListener('click', () => { if (S.items.length >= 12) return; S.items.push(mkItem()); S.sel = S.items.length - 1; paint(); });
  $('#fx-del', host).addEventListener('click', () => { if (S.items.length <= 1) return; S.items.splice(S.sel, 1); S.sel = Math.min(S.sel, S.items.length - 1); paint(); });
  $('#fx-presets', host).addEventListener('click', e => { const b = e.target.closest('button'); if (b) load(PRESETS[+b.dataset.i][1]()); });
  $('#fx-copy', host).addEventListener('click', () => copy($('#fx-out', host).value, 'Code copié'));
  load({});
})();
