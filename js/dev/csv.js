(function () {
  'use strict';
  const { $, $$, esc, seg, bindSeg, tog, copy, download, readText, debounce, mk, toast, size, bytes } = Kit;

  const SAMPLE = 'Produit;Prix;En stock;Catégorie\nLampe de bureau Aurore;49,90;true;Éclairage\n"Enceinte nomade ""Vibe""";89;true;Audio\nPlaid en laine Cocon;120;false;Maison\n';
  const KINDS = [['json', 'JSON'], ['jsonarrays', 'JSON (tableaux)'], ['csv', 'CSV'], ['tsv', 'TSV'], ['html', 'HTML'], ['md', 'Markdown']];
  const EXT = { json: ['json', 'application/json'], jsonarrays: ['json', 'application/json'], csv: ['csv', 'text/csv'], tsv: ['tsv', 'text/tab-separated-values'], html: ['html', 'text/html'], md: ['md', 'text/markdown'] };
  const S = { kind: 'json' };

  mk('csv', `<div class="stage-col">
    <div class="card fm-pane">
      <div class="df-in-head"><label for="cs-in">Données d’entrée</label><span class="df-in-tools"><span class="hint" id="cs-in-n"></span><button type="button" class="Ghost" id="cs-open">Ouvrir un fichier</button></span></div>
      <textarea class="text-input df-ta fm-ta" id="cs-in" spellcheck="false" autocomplete="off" wrap="off" placeholder="Collez ici un CSV, un tableau copié depuis Excel, un JSON ou un tableau Markdown"></textarea>
      <input type="file" id="cs-file" accept=".csv,.tsv,.txt,.json,.md,text/*" hidden>
      <div class="qr-msg is-error" id="cs-err" hidden></div>
    </div>
    <div class="card fm-pane">
      <div class="df-in-head"><label for="cs-out">Résultat</label><span class="df-in-tools"><span class="hint" id="cs-out-n"></span></span></div>
      ${seg('cs-kind', KINDS, 'json')}
      <textarea class="text-input df-ta fm-ta" id="cs-out" readonly spellcheck="false" wrap="off"></textarea>
    </div>
    <div class="card fm-pane"><div class="df-in-head"><h3 class="lr-h">Aperçu du tableau</h3><span class="hint" id="cs-prev-n"></span></div><div class="cs-prev" id="cs-prev"></div></div></div>
    <div class="controls-col">
      <div class="card control-card"><h3>Lecture</h3>
        <div class="field"><label for="cs-fmt">Format d’entrée</label><select id="cs-fmt"><option value="auto">Automatique</option><option value="csv">CSV / TSV</option><option value="json">JSON</option><option value="md">Tableau Markdown</option></select></div>
        <div class="field"><label for="cs-delim">Séparateur</label><select id="cs-delim"><option value="auto">Automatique</option><option value=",">Virgule</option><option value=";">Point-virgule</option><option value="\t">Tabulation</option><option value="|">Barre verticale</option></select><p class="hint" id="cs-det"></p></div>
        ${tog('cs-head', 'La première ligne contient les en-têtes', true)}
        ${tog('cs-typed', 'Convertir nombres et booléens', true)}
        ${tog('cs-null', 'Cellules vides en null (JSON)', false)}
        ${tog('cs-trim', 'Supprimer les espaces autour des valeurs', true)}
      </div>
      <div class="card control-card"><h3>Sortie</h3>
        <div class="field"><label for="cs-indent">Indentation (JSON, HTML)</label><select id="cs-indent"><option value="2" selected>2 espaces</option><option value="4">4 espaces</option><option value="tab">Tabulation</option><option value="min">Compact</option></select></div>
        <div class="field"><label for="cs-odelim">Séparateur du CSV produit</label><select id="cs-odelim"><option value=",">Virgule</option><option value=";">Point-virgule</option><option value="\t">Tabulation</option></select></div>
        <div class="field"><label for="cs-cls">Classe du tableau HTML</label><input type="text" id="cs-cls" placeholder="ex. table" autocomplete="off" spellcheck="false"></div>
      </div>
      <div class="card control-card"><h3>Actions</h3><div class="df-btns">
        <button type="button" class="btn btn-accent btn-block" id="cs-copy" disabled>Copier le résultat</button>
        <button type="button" class="btn btn-ghost btn-block" id="cs-dl" disabled>Télécharger</button>
        <button type="button" class="btn btn-ghost btn-block" id="cs-sample">Charger un exemple</button>
        <button type="button" class="btn btn-ghost btn-block" id="cs-clear">Tout effacer</button>
      </div></div></div>`);

  const host = $('#view-csv');
  const IN = $('#cs-in', host), OUT = $('#cs-out', host), ERR = $('#cs-err', host);
  let fname = 'donnees';
  const FMT = { csv: 'CSV', json: 'JSON', md: 'Markdown' };

  function run() {
    const src = IN.value;
    $('#cs-in-n', host).textContent = src ? size(bytes(src)) : '';
    ERR.hidden = true;
    const dis = d => ['cs-copy', 'cs-dl'].forEach(id => { $('#' + id, host).disabled = d; });
    if (!src.trim()) { OUT.value = ''; $('#cs-out-n', host).textContent = ''; $('#cs-prev', host).innerHTML = ''; $('#cs-prev-n', host).textContent = ''; $('#cs-det', host).textContent = ''; dis(true); return; }
    let t;
    try {
      t = CSVCore.toTable(src, { format: $('#cs-fmt', host).value, delimiter: $('#cs-delim', host).value, header: $('#cs-head', host).checked, typed: $('#cs-typed', host).checked, emptyNull: $('#cs-null', host).checked, trim: $('#cs-trim', host).checked });
    } catch (e) { ERR.hidden = false; ERR.textContent = e.message; OUT.value = ''; dis(true); return; }
    $('#cs-det', host).textContent = 'Détecté : ' + FMT[t.format] + (t.delimiter ? ' (séparateur ' + ({ ',': 'virgule', ';': 'point-virgule', '\t': 'tabulation', '|': 'barre verticale' }[t.delimiter]) + ')' : '');
    const cs = $('#cs-cls', host).value.trim();
    const res = CSVCore.format(t, S.kind, { indent: $('#cs-indent', host).value, header: $('#cs-head', host).checked, delimiter: $('#cs-odelim', host).value, cls: cs });
    OUT.value = res;
    $('#cs-out-n', host).textContent = t.rows.length + (t.rows.length > 1 ? ' lignes' : ' ligne') + ' · ' + t.headers.length + (t.headers.length > 1 ? ' colonnes' : ' colonne') + ' · ' + size(bytes(res));
    dis(false);
    const MAX = 100;
    $('#cs-prev', host).innerHTML = `<table class="cs-tbl"><thead><tr>${t.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.slice(0, MAX).map(r => `<tr>${r.map(c => `<td class="${typeof c === 'number' ? 'is-num' : ''}">${esc(c === null ? '' : typeof c === 'object' ? JSON.stringify(c) : String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $('#cs-prev-n', host).textContent = t.rows.length > MAX ? 'Les ' + MAX + ' premières lignes sur ' + t.rows.length : '';
  }

  const go = debounce(run, 150);
  IN.addEventListener('input', () => { fname = 'donnees'; go(); });
  $$('select,input[type="checkbox"],input[type="text"]', host).forEach(e => { if (e !== IN) { e.addEventListener('change', run); e.addEventListener('input', go); } });
  bindSeg('cs-kind', v => { S.kind = v; run(); });
  $('#cs-open', host).addEventListener('click', () => $('#cs-file', host).click());
  $('#cs-file', host).addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast('Fichier trop volumineux (8 Mo maximum).'); return; }
    try { IN.value = await readText(f); fname = f.name.replace(/\.[^.]+$/, ''); run(); } catch (er) { toast(er.message); }
  });
  IN.addEventListener('dragover', e => e.preventDefault());
  IN.addEventListener('drop', async e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (!f) return; e.preventDefault(); try { IN.value = await readText(f); fname = f.name.replace(/\.[^.]+$/, ''); run(); } catch (er) { toast(er.message); } });
  $('#cs-copy', host).addEventListener('click', () => copy(OUT.value, 'Résultat copié'));
  $('#cs-dl', host).addEventListener('click', () => { const x = EXT[S.kind]; download(fname + '.' + x[0], OUT.value, x[1] + ';charset=utf-8'); });
  $('#cs-sample', host).addEventListener('click', () => { IN.value = SAMPLE; run(); });
  $('#cs-clear', host).addEventListener('click', () => { IN.value = ''; run(); IN.focus(); });
  run();
})();
