(function () {
  'use strict';
  const { $, $$, esc, copy, mk } = Kit;

  const THEMES = LoremCore.list();
  const S = { theme: 'classique', seed: (Date.now() ^ (Math.random() * 4294967296)) >>> 0 };
  let sections = [];

  mk('lorem', `<div class="stage-col">
    <div class="card fm-pane">
      <div class="df-in-head"><h2 class="lr-h">Aperçu</h2><span class="hint" id="lr-stat"></span></div>
      <div class="lr-preview" id="lr-preview" tabindex="0" role="region" aria-label="Aperçu du texte généré"></div>
    </div></div>
    <div class="controls-col">
      <div class="card control-card"><h3>Thème</h3>
        <div class="lr-themes" id="lr-themes" role="group" aria-label="Thème">${THEMES.map(t => `<button type="button" data-v="${t.id}" aria-pressed="${t.id === S.theme}">${esc(t.label)}</button>`).join('')}</div>
        <p class="hint" id="lr-desc"></p>
      </div>
      <div class="card control-card"><h3>Actions</h3><div class="df-btns">
        <button type="button" class="btn btn-accent btn-block" id="lr-new">Régénérer</button>
        <button type="button" class="btn btn-ghost btn-block" id="lr-copy">Copier le texte</button>
      </div></div></div>`);

  const host = $('#view-lorem');
  const prev = $('#lr-preview', host);

  function render() {
    const t = THEMES.find(x => x.id === S.theme);
    sections = LoremCore.generate({ theme: S.theme, seed: S.seed });
    prev.innerHTML = sections.map(s => `<h2>${esc(s.title)}</h2><p>${esc(s.text)}</p>`).join('');
    const text = LoremCore.toText(sections);
    const words = (text.match(/[\p{L}\p{N}’'-]+/gu) || []).length;
    $('#lr-stat', host).textContent = words + ' mots';
    $('#lr-desc', host).textContent = t.desc;
    $$('#lr-themes button', host).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.theme));
  }

  $('#lr-themes', host).addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    S.theme = b.dataset.v;
    render();
  });
  $('#lr-new', host).addEventListener('click', () => {
    S.seed = (Date.now() ^ (Math.random() * 4294967296)) >>> 0;
    render();
  });
  $('#lr-copy', host).addEventListener('click', () => copy(LoremCore.toText(sections), 'Texte copié'));
  render();
})();
