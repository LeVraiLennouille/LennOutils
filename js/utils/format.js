(function () {
  'use strict';
  const { $, $$, esc, seg, bindSeg, tog, copy, download, readText, debounce, size, bytes, lines, gzipSize, LANGS, detect, runFmt, mk, toast } = Kit;

  const SAMPLES = {
    html: '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Accueil</title><style>.btn{color:#fff;background:#ff6b2d}</style></head><body><main><h1>Bonjour</h1><p>Un <strong>texte</strong> avec un <a href="#">lien</a>.</p><ul><li>Un</li><li>Deux</li></ul><button class="btn" type="button">Envoyer</button></main><script>document.querySelector(".btn").addEventListener("click",()=>console.log("ok"))</script></body></html>',
    json: '{"nom":"Lennouille","outils":["images","couleurs","pdf"],"actif":true,"version":1.0,"auteur":{"prenom":"Lenny","site":"https://lennouille.fr"}}',
    css: '.btn{color:#fff;background:#ff6b2d;padding:8px 16px}.btn:hover,.btn:focus-visible{background:#d9531a}@media (min-width:600px){.btn{padding:12px 24px}}',
    js: 'function somme(a,b){if(typeof a!=="number"||typeof b!=="number"){throw new TypeError("Nombres attendus")}return a+b}const liste=[1,2,3].map(x=>somme(x,1));console.log(liste)'
  };

  mk('format', `<div class="stage-col">
    <div class="card fm-pane">
      <div class="df-in-head"><label for="fm-in">Code d’entrée</label><span class="df-in-tools"><span class="hint" id="fm-in-n"></span><button type="button" class="Ghost" id="fm-open">Ouvrir un fichier</button></span></div>
      <textarea class="text-input df-ta fm-ta" id="fm-in" spellcheck="false" autocomplete="off" autocapitalize="off" wrap="off" placeholder="Collez ici du HTML, du CSS, du JavaScript ou du JSON"></textarea>
      <input type="file" id="fm-file" hidden>
      <div class="qr-msg is-error" id="fm-err" hidden></div>
    </div>
    <div class="card fm-pane">
      <div class="df-in-head"><label for="fm-out">Résultat</label><span class="df-in-tools"><span class="hint" id="fm-out-n"></span></span></div>
      <textarea class="text-input df-ta fm-ta" id="fm-out" readonly spellcheck="false" wrap="off" placeholder="Le résultat s’affiche ici"></textarea>
      <p class="hint fm-stat" id="fm-stat"></p>
    </div></div>
    <div class="controls-col">
      <div class="card control-card"><h3>Langage</h3>${seg('fm-lang', [['auto', 'Auto'], ['html', 'HTML'], ['css', 'CSS'], ['js', 'JS'], ['json', 'JSON']], 'auto')}<p class="hint" id="fm-detected"></p></div>
      <div class="card control-card"><h3>Action</h3>${seg('fm-mode', [['fmt', 'Formater'], ['min', 'Minifier']], 'fmt')}
        <div class="field fm-indent"><label for="fm-indent">Indentation</label><select id="fm-indent"><option value="2" selected>2 espaces</option><option value="4">4 espaces</option><option value="tab">Tabulation</option></select></div>
        <div id="fm-json-opts">${tog('fm-sort', 'Trier les clés (JSON)', false)}${tog('fm-tol', 'Accepter commentaires et virgules finales (JSON)', false)}</div>
        <p class="hint" id="fm-min-note" hidden>La minification supprime les commentaires et les espaces inutiles sans renommer vos variables : le comportement du code reste identique.</p>
      </div>
      <div class="card control-card"><h3>Résultat</h3><div class="df-btns">
        <button type="button" class="btn btn-accent btn-block" id="fm-copy" disabled>Copier le résultat</button>
        <button type="button" class="btn btn-ghost btn-block" id="fm-dl" disabled>Télécharger</button>
        <button type="button" class="btn btn-ghost btn-block" id="fm-use" disabled>Utiliser comme entrée</button>
        <button type="button" class="btn btn-ghost btn-block" id="fm-sample">Charger un exemple</button>
        <button type="button" class="btn btn-ghost btn-block" id="fm-clear">Tout effacer</button>
      </div></div></div>`);

  const host = $('#view-format');
  const IN = $('#fm-in', host), OUT = $('#fm-out', host), ERR = $('#fm-err', host);
  const S = { lang: 'auto', mode: 'fmt', file: '' };
  let lastLang = null, gzToken = 0;

  function showError(e) {
    ERR.hidden = false;
    ERR.innerHTML = `<span>${esc(e.message)}</span>${typeof e.pos === 'number' ? ' <button type="button" class="Ghost" id="fm-goto">Aller à l’erreur</button>' : ''}`;
    const g = $('#fm-goto', host);
    if (g) g.onclick = () => { IN.focus(); IN.setSelectionRange(e.pos, Math.min(IN.value.length, e.pos + 1)); };
  }

  function run() {
    const text = IN.value;
    $('#fm-in-n', host).textContent = text ? lines(DiffLines(text)) + ' · ' + size(bytes(text)) : '';
    $('#fm-json-opts', host).hidden = false;
    const min = S.mode === 'min';
    $('#fm-indent', host).disabled = min;
    $('#fm-min-note', host).hidden = !min;
    ERR.hidden = true;
    const dis = v => { ['fm-copy', 'fm-dl', 'fm-use'].forEach(id => { $('#' + id, host).disabled = v; }); };
    if (!text.trim()) { OUT.value = ''; $('#fm-out-n', host).textContent = ''; $('#fm-stat', host).textContent = ''; $('#fm-detected', host).textContent = ''; dis(true); lastLang = null; return; }
    const lang = S.lang === 'auto' ? detect(text, S.file) : S.lang;
    lastLang = lang;
    $('#fm-detected', host).textContent = S.lang === 'auto' ? (lang ? 'Détecté : ' + LANGS[lang].label : 'Langage non reconnu : choisissez-le ci-dessus.') : '';
    if (!lang) { OUT.value = ''; $('#fm-out-n', host).textContent = ''; $('#fm-stat', host).textContent = ''; dis(true); return; }
    $('#fm-json-opts', host).hidden = lang !== 'json';
    let result;
    try {
      result = runFmt(lang, text, S.mode, { indent: $('#fm-indent', host).value, sortKeys: $('#fm-sort', host).checked, tolerant: $('#fm-tol', host).checked });
    } catch (e) {
      OUT.value = '';
      $('#fm-out-n', host).textContent = '';
      $('#fm-stat', host).textContent = '';
      showError(e);
      dis(true);
      return;
    }
    OUT.value = result;
    $('#fm-out-n', host).textContent = lines(DiffLines(result)) + ' · ' + size(bytes(result));
    dis(false);
    const a = bytes(text), b = bytes(result), pct = a ? Math.round((1 - b / a) * 100) : 0;
    const base = `${size(a)} → ${size(b)}` + (b < a ? ` (−${pct} %)` : b > a ? ` (+${-pct} %)` : '');
    $('#fm-stat', host).textContent = base;
    const tok = ++gzToken;
    gzipSize(result).then(g => { if (g !== null && tok === gzToken) $('#fm-stat', host).textContent = base + ' · environ ' + size(g) + ' en gzip'; });
  }
  function DiffLines(t) { return DiffCore.splitLines(t).length; }

  const go = debounce(run, 180);
  IN.addEventListener('input', () => { S.file = ''; go(); });
  ['fm-indent', 'fm-sort', 'fm-tol'].forEach(id => $('#' + id, host).addEventListener('change', run));
  bindSeg('fm-lang', v => { S.lang = v; run(); });
  bindSeg('fm-mode', v => { S.mode = v; run(); });

  $('#fm-open', host).addEventListener('click', () => $('#fm-file', host).click());
  $('#fm-file', host).addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast('Fichier trop volumineux (8 Mo maximum).'); return; }
    try {
      const t = await readText(f);
      if (t.includes('\u0000')) { toast('Ce fichier semble binaire.'); return; }
      IN.value = t; S.file = f.name; run();
    } catch (er) { toast(er.message); }
  });
  IN.addEventListener('dragover', e => e.preventDefault());
  IN.addEventListener('drop', async e => {
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault();
    try { IN.value = await readText(f); S.file = f.name; run(); } catch (er) { toast(er.message); }
  });

  $('#fm-copy', host).addEventListener('click', () => copy(OUT.value, 'Résultat copié'));
  $('#fm-dl', host).addEventListener('click', () => {
    const l = LANGS[lastLang || 'js'];
    const name = (S.file ? S.file.replace(/\.[^.]+$/, '') : 'resultat') + (S.mode === 'min' ? '.min.' : '.') + l.ext;
    download(name, OUT.value, l.mime + ';charset=utf-8');
  });
  $('#fm-use', host).addEventListener('click', () => { IN.value = OUT.value; run(); });
  $('#fm-sample', host).addEventListener('click', () => {
    const k = S.lang === 'auto' ? 'html' : S.lang;
    IN.value = SAMPLES[k]; S.file = ''; run();
  });
  $('#fm-clear', host).addEventListener('click', () => { IN.value = ''; S.file = ''; run(); IN.focus(); });
  run();
})();
