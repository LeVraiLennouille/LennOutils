(function () {
  'use strict';
  const { $, $$, esc, seg, bindSeg, tog, copy, download, readText, debounce, mk, toast, detect, runFmt, lines } = Kit;

  const SAMPLE_A = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Accueil</title>
  <style>
    .btn { color: #333; padding: 8px 16px; }
  </style>
</head>
<body>
  <button class="btn" id="go">Envoyer</button>
  <script>
    document.getElementById('go').addEventListener('click', function () {
      console.log('envoyé');
    });
  </script>
</body>
</html>
`;
  const SAMPLE_B = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Accueil</title>
  <style>
    .btn { color: #111; padding: 8px 16px; border-radius: 8px; }
  </style>
</head>
<body>
  <button class="btn" id="go" type="button">Envoyer</button>
  <script>
    document.getElementById('go').addEventListener('click', () => {
      console.log('envoyé');
    });
  </script>
</body>
</html>
`;

  const box = (id, label, ph) => `<div class="df-in"><div class="df-in-head"><label for="${id}">${label}</label><span class="df-in-tools"><span class="hint" id="${id}-n"></span><button type="button" class="Ghost" data-load="${id}">Ouvrir un fichier</button></span></div><textarea class="text-input df-ta" id="${id}" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="${ph}" wrap="off"></textarea><input type="file" id="${id}-f" hidden></div>`;

  mk('diff', `<div class="stage-col">
    <div class="card df-inputs">${box('df-a', 'Version A (originale)', 'Collez ici le texte ou le code d’origine')}${box('df-b', 'Version B (modifiée)', 'Collez ici la nouvelle version')}</div>
    <div class="card df-result" id="df-result" hidden>
      <div class="df-bar"><div class="df-stats" id="df-stats"></div></div>
      <div class="df-out" id="df-out" tabindex="0" role="region" aria-label="Différences"></div>
    </div></div>
    <div class="controls-col">
      <div class="card control-card"><h3>Affichage</h3>
        ${seg('df-view', [['side', 'Côte à côte'], ['uni', 'Unifié']], 'side')}
        <div class="field df-ctx"><label for="df-ctx">Lignes de contexte</label><select id="df-ctx"><option value="3" selected>3 lignes</option><option value="1">1 ligne</option><option value="5">5 lignes</option><option value="10">10 lignes</option><option value="-1">Tout afficher</option></select></div>
      </div>
      <div class="card control-card"><h3>Comparaison</h3>
        ${tog('df-ws', 'Ignorer les espaces et l’indentation', false)}
        ${tog('df-case', 'Ignorer la casse', false)}
        ${tog('df-blank', 'Ignorer les lignes vides', false)}
        <div class="field"><label for="df-fmt">Mettre en forme avant de comparer</label><select id="df-fmt"><option value="none">Non (texte brut)</option><option value="auto">Automatique</option><option value="json">JSON</option><option value="css">CSS</option><option value="js">JavaScript</option></select><p class="hint" id="df-fmt-note">Utile pour comparer deux fichiers minifiés ou indentés différemment. HTML : comparaison brute.</p></div>
      </div>
      <div class="card control-card"><h3>Actions</h3>
        <div class="df-btns">
          <button type="button" class="btn btn-ghost btn-block" id="df-swap">Échanger A et B</button>
          <button type="button" class="btn btn-ghost btn-block" id="df-sample">Charger un exemple</button>
          <button type="button" class="btn btn-accent btn-block" id="df-copy" disabled>Copier le patch</button>
          <button type="button" class="btn btn-ghost btn-block" id="df-dl" disabled>Télécharger le .diff</button>
          <button type="button" class="btn btn-ghost btn-block" id="df-clear">Tout effacer</button>
        </div>
      </div></div>`);

  const host = $('#view-diff');
  const A = $('#df-a', host), B = $('#df-b', host), out = $('#df-out', host), res = $('#df-result', host), stats = $('#df-stats', host);
  let view = 'side', last = null, expanded = new Set(), names = { a: 'a', b: 'b' };
  const MAXROWS = 4000;

  function prep(text, which) {
    const mode = $('#df-fmt', host).value;
    if (mode === 'none' || !text.trim()) return { text };
    const lang = mode === 'auto' ? detect(text, names[which] !== which ? names[which] : '') : mode;
    if (!lang) return { text };
    try { return { text: runFmt(lang, text, 'fmt', { indent: 2, tolerant: lang === 'json' }), lang }; }
    catch (e) { return { text, error: (which === 'a' ? 'A' : 'B') + ' : ' + e.message }; }
  }

  const indent = t => {
    const m = /^[ \t]+/.exec(t);
    return m ? [`<span class="df-ind">${esc(m[0])}</span>`, t.slice(m[0].length)] : ['', t];
  };
  const plain = t => { const [a, b] = indent(t); return a + esc(b); };
  const segs = (list, cls) => {
    let lead = '';
    const first = list[0];
    const work = list.map(x => Object.assign({}, x));
    if (first) { const [a, b] = indent(first.t); lead = a; work[0].t = b; }
    return lead + work.filter(x => x.t !== '').map(x => (x.m ? `<mark class="${cls}">${esc(x.t)}</mark>` : esc(x.t))).join('');
  };
  const cell = (n, html, cls) => `<div class="df-n">${n === '' || n < 0 ? '' : n + 1}</div><div class="df-c ${cls}">${html === '' ? '&nbsp;' : html}</div>`;

  function sideRow(r) {
    if (r.k === 'gap') return `<button type="button" class="df-gap" data-gap="${r.id}">⋯ ${r.count} ligne${r.count > 1 ? 's' : ''} identique${r.count > 1 ? 's' : ''} — afficher</button>`;
    if (r.k === 'eq') return `<div class="df-r">${cell(r.a, plain(r.la), '')}${cell(r.b, plain(r.lb), '')}</div>`;
    if (r.k === 'chg') return `<div class="df-r">${cell(r.a, segs(r.sa, 'df-m-del'), 'del')}${cell(r.b, segs(r.sb, 'df-m-add'), 'add')}</div>`;
    if (r.k === 'del') return `<div class="df-r">${cell(r.a, plain(r.la), r.blank ? 'blank' : 'del')}${cell(-1, '', 'empty')}</div>`;
    return `<div class="df-r">${cell(-1, '', 'empty')}${cell(r.b, plain(r.lb), r.blank ? 'blank' : 'add')}</div>`;
  }

  const uni = (a, b, sign, html, cls) => `<div class="df-r u"><div class="df-n">${a < 0 ? '' : a + 1}</div><div class="df-n">${b < 0 ? '' : b + 1}</div><div class="df-s ${cls}">${sign}</div><div class="df-c ${cls}">${html === '' ? '&nbsp;' : html}</div></div>`;

  function uniRows(r) {
    if (r.k === 'gap') return `<button type="button" class="df-gap" data-gap="${r.id}">⋯ ${r.count} ligne${r.count > 1 ? 's' : ''} identique${r.count > 1 ? 's' : ''} — afficher</button>`;
    if (r.k === 'eq') return uni(r.a, r.b, ' ', plain(r.la), '');
    if (r.k === 'chg') return uni(r.a, -1, '−', segs(r.sa, 'df-m-del'), 'del') + uni(-1, r.b, '+', segs(r.sb, 'df-m-add'), 'add');
    if (r.k === 'del') return uni(r.a, -1, '−', plain(r.la), r.blank ? 'blank' : 'del');
    return uni(-1, r.b, '+', plain(r.lb), r.blank ? 'blank' : 'add');
  }

  function paint() {
    if (!last) return;
    const ctx = +$('#df-ctx', host).value;
    const rows = DiffCore.collapse(last.rows, ctx, expanded);
    let html = '', cut = false;
    const f = view === 'side' ? sideRow : uniRows;
    for (let i = 0; i < rows.length; i++) {
      if (i >= MAXROWS) { cut = true; break; }
      html += f(rows[i]);
    }
    if (cut) html += `<p class="df-cut">Affichage limité aux ${MAXROWS} premières lignes : réduisez le contexte ou comparez des extraits. Le patch exporté contient tout.</p>`;
    out.className = 'df-out ' + (view === 'side' ? 'is-side' : 'is-uni');
    out.innerHTML = html;
  }

  function update() {
    const ta = A.value, tb = B.value;
    $('#df-a-n', host).textContent = ta ? lines(DiffCore.splitLines(ta).length) : '';
    $('#df-b-n', host).textContent = tb ? lines(DiffCore.splitLines(tb).length) : '';
    const note = $('#df-fmt-note', host);
    if (!ta && !tb) { res.hidden = true; last = null; $('#df-copy', host).disabled = true; $('#df-dl', host).disabled = true; return; }
    const pa = prep(ta, 'a'), pb = prep(tb, 'b');
    const errs = [pa.error, pb.error].filter(Boolean);
    if (errs.length) note.textContent = 'Mise en forme impossible, comparaison du texte brut — ' + errs.join(' · ');
    else if ($('#df-fmt', host).value !== 'none') {
      const l = [pa.lang, pb.lang].filter(Boolean);
      note.textContent = l.length ? 'Mis en forme avant comparaison (' + [...new Set(l)].join(', ') + '). HTML : comparaison brute.' : 'Aucun langage reconnu : comparaison du texte brut.';
    } else note.textContent = 'Utile pour comparer deux fichiers minifiés ou indentés différemment. HTML : comparaison brute.';
    last = DiffCore.diff(pa.text, pb.text, { ignoreSpace: $('#df-ws', host).checked, ignoreCase: $('#df-case', host).checked, ignoreBlank: $('#df-blank', host).checked });
    expanded = new Set();
    res.hidden = false;
    const s = last.stats;
    stats.innerHTML = last.identical
      ? `<span class="df-pill same">Les deux versions sont identiques${$('#df-ws', host).checked || $('#df-case', host).checked || $('#df-blank', host).checked ? ' (avec les options choisies)' : ''}</span>`
      : `<span class="df-pill add">+${s.add + s.chg} ajoutée${s.add + s.chg > 1 ? 's' : ''}</span><span class="df-pill del">−${s.del + s.chg} supprimée${s.del + s.chg > 1 ? 's' : ''}</span>${s.chg ? `<span class="df-pill chg">${s.chg} modifiée${s.chg > 1 ? 's' : ''}</span>` : ''}<span class="df-pill">${s.same} inchangée${s.same > 1 ? 's' : ''}</span>${last.coarse ? '<span class="df-pill warn">Textes très différents : comparaison simplifiée</span>' : ''}`;
    $('#df-copy', host).disabled = last.identical;
    $('#df-dl', host).disabled = last.identical;
    paint();
  }
  const upd = debounce(update, 200);
  [A, B].forEach(t => t.addEventListener('input', () => { names[t === A ? 'a' : 'b'] = t === A ? 'a' : 'b'; upd(); }));
  ['df-ws', 'df-case', 'df-blank', 'df-fmt'].forEach(id => $('#' + id, host).addEventListener('change', update));
  $('#df-ctx', host).addEventListener('change', () => { expanded = new Set(); paint(); });
  bindSeg('df-view', v => { view = v; paint(); });

  out.addEventListener('click', e => {
    const g = e.target.closest('[data-gap]');
    if (!g) return;
    expanded.add(g.dataset.gap);
    paint();
  });

  $$('[data-load]', host).forEach(b => b.addEventListener('click', () => $('#' + b.dataset.load + '-f', host).click()));
  ['df-a', 'df-b'].forEach(id => {
    const fi = $('#' + id + '-f', host);
    fi.addEventListener('change', async () => {
      const f = fi.files[0];
      fi.value = '';
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) { toast('Fichier trop volumineux (8 Mo maximum).'); return; }
      try {
        const t = await readText(f);
        if (t.includes('\u0000')) { toast('Ce fichier semble binaire : il ne peut pas être comparé.'); return; }
        $('#' + id, host).value = t;
        names[id === 'df-a' ? 'a' : 'b'] = f.name;
        update();
      } catch (e) { toast(e.message); }
    });
  });

  [A, B].forEach(t => {
    t.addEventListener('dragover', e => { e.preventDefault(); });
    t.addEventListener('drop', async e => {
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      try { t.value = await readText(f); names[t === A ? 'a' : 'b'] = f.name; update(); } catch (er) { toast(er.message); }
    });
  });

  $('#df-swap', host).addEventListener('click', () => {
    const v = A.value; A.value = B.value; B.value = v;
    const n = names.a; names.a = names.b; names.b = n;
    update();
  });
  $('#df-sample', host).addEventListener('click', () => { A.value = SAMPLE_A; B.value = SAMPLE_B; update(); });
  $('#df-clear', host).addEventListener('click', () => { A.value = ''; B.value = ''; names = { a: 'a', b: 'b' }; update(); A.focus(); });

  const patch = () => DiffCore.unified(last, 3, names.a === 'a' ? 'a/version-a' : names.a, names.b === 'b' ? 'b/version-b' : names.b);
  $('#df-copy', host).addEventListener('click', () => { if (last && !last.identical) copy(patch(), 'Patch copié'); });
  $('#df-dl', host).addEventListener('click', () => { if (last && !last.identical) download('differences.diff', patch(), 'text/x-diff;charset=utf-8'); });
})();
