(function () {
  'use strict';

  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  document.addEventListener('DOMContentLoaded', function () {
    const rail = document.querySelector('.rail');
    if (!rail) return;

    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'PaletteBtn'; btn.id = 'pal-btn';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.innerHTML = '<span class="pal-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span><span class="pal-lb">Aller à…</span><kbd>' + (isMac ? '⌘ K' : 'Ctrl K') + '</kbd>';
    const firstNav = rail.querySelector('.rail-nav');
    rail.insertBefore(btn, firstNav);

    const dlg = document.createElement('dialog');
    dlg.className = 'Modal Palette'; dlg.id = 'palette'; dlg.setAttribute('aria-label', 'Aller à…');
    dlg.innerHTML = '<div class="PalHead"><input class="PalIn" type="text" id="pal-in" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" placeholder="Rechercher une section, un outil, une action…" autocomplete="off" spellcheck="false"></div>' +
      '<div class="PalList" id="pal-list" role="listbox" aria-label="Résultats"></div>' +
      '<p class="PalHint"><span><kbd>↑</kbd> <kbd>↓</kbd> pour naviguer</span><span><kbd>Entrée</kbd> pour ouvrir</span><span><kbd>Échap</kbd> pour fermer</span></p>';
    document.body.appendChild(dlg);
    const input = dlg.querySelector('#pal-in'), list = dlg.querySelector('#pal-list');
    let items = [], shown = [], active = 0;

    function collect() {
      const out = [];
      rail.querySelectorAll('.rail-btn').forEach(el => {
        const lb = el.querySelector('.lb'), label = (lb ? lb.textContent : el.textContent).trim();
        let grp = '', n = el.closest('.rail-nav');
        while (n && (n = n.previousElementSibling)) { if (n.classList.contains('rail-group')) { grp = n.textContent.trim(); break; } if (n.classList.contains('rail-nav')) { } }
        out.push({ label, group: grp || 'Navigation', kind: 'nav', current: el.hasAttribute('aria-current'), el });
      });
      rail.querySelectorAll('.rail-end button, .AuditSwitch').forEach(el => {
        if (el.id === 'rst' || el.id === 'pal-btn') return;
        const lb = el.querySelector('.nm') ? 'Mes audits' : (el.querySelector('.lb') ? el.querySelector('.lb').textContent : el.textContent);
        out.push({ label: lb.trim(), group: 'Actions', kind: 'act', el });
      });
      document.querySelectorAll('main:not([hidden]) .SiteFoot a').forEach(el => out.push({ label: el.textContent.trim(), group: 'Liens', kind: 'link', el }));
      return out.filter(i => i.label);
    }

    function score(it, toks) {
      const l = norm(it.label), g = norm(it.group);
      let s = 0;
      for (const t of toks) {
        if (l.startsWith(t)) s += 5; else if (l.split(/[\s\-—]+/).some(w => w.startsWith(t))) s += 4; else if (l.includes(t)) s += 3; else if (g.includes(t)) s += 1; else return -1;
      }
      return s;
    }
    function filter(q) {
      const toks = norm(q).split(/\s+/).filter(Boolean);
      if (!toks.length) return items.slice();
      return items.map(it => [score(it, toks), it]).filter(x => x[0] >= 0).sort((a, b) => b[0] - a[0]).map(x => x[1]);
    }

    function render() {
      shown = filter(input.value);
      if (active >= shown.length) active = Math.max(0, shown.length - 1);
      if (!shown.length) { list.innerHTML = '<p class="PalEmpty">Aucun résultat.</p>'; input.removeAttribute('aria-activedescendant'); return; }
      let html = '', last = null;
      shown.forEach((it, i) => {
        if (it.group !== last) { html += '<div class="PalGrp" role="presentation">' + esc(it.group) + '</div>'; last = it.group; }
        html += '<div class="PalItem" role="option" id="pal-o' + i + '" data-i="' + i + '" aria-selected="' + (i === active) + '"><span>' + esc(it.label) + '</span>' + (it.current ? '<small>Page actuelle</small>' : it.kind === 'link' ? '<small>Ouvre un nouvel onglet</small>' : '') + '</div>';
      });
      list.innerHTML = html;
      input.setAttribute('aria-activedescendant', 'pal-o' + active);
      const a = list.querySelector('.PalItem[aria-selected="true"]'); if (a) a.scrollIntoView({ block: 'nearest' });
    }

    function open() {
      if (dlg.open) return;
      items = collect(); active = items.findIndex(i => i.current); if (active < 0) active = 0;
      input.value = ''; render(); dlg.showModal(); input.focus();
    }
    function close() { if (dlg.open) dlg.close(); }
    function run(i) {
      const it = shown[i]; if (!it) return;
      close();
      setTimeout(() => { it.el.click(); }, 0);
    }

    btn.addEventListener('click', open);
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.open ? close() : open(); }
    });
    input.addEventListener('input', () => { active = 0; render(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, shown.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(active); }
      else if (e.key === 'Home') { e.preventDefault(); active = 0; render(); }
      else if (e.key === 'End') { e.preventDefault(); active = Math.max(0, shown.length - 1); render(); }
    });
    list.addEventListener('mousemove', e => { const o = e.target.closest('.PalItem'); if (o && +o.dataset.i !== active) { active = +o.dataset.i; list.querySelectorAll('.PalItem').forEach((n, k) => n.setAttribute('aria-selected', String(k === active))); } });
    list.addEventListener('click', e => { const o = e.target.closest('.PalItem'); if (o) run(+o.dataset.i); });
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  });
})();
