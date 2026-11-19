(function () {
  'use strict';
  const { $, $$, esc, seg, bindSeg, tog, rng, bindRng, copy, download, readText, mk, size, bytes, gzipSize, debounce, toast } = Kit;

  const SAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->
<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://www.w3.org/2000/svg" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="120.00000mm" height="80.00000mm" viewBox="0 0 120 80" version="1.1" id="svg8" inkscape:version="0.92.4" sodipodi:docname="exemple.svg">
  <title id="title1">Logo exemple</title>
  <defs id="defs2">
    <linearGradient id="grad1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF6B2D" /><stop offset="1.000000" stop-color="rgb(217, 83, 26)" /></linearGradient>
  </defs>
  <sodipodi:namedview id="base" pagecolor="#ffffff" inkscape:zoom="1.0" />
  <metadata id="metadata5"><rdf:RDF><cc:Work rdf:about=""><dc:format>image/svg+xml</dc:format></cc:Work></rdf:RDF></metadata>
  <g id="layer1" inkscape:label="Calque 1" inkscape:groupmode="layer"><g id="g20">
    <rect id="rect10" style="fill:url(#grad1);fill-opacity:1;stroke:#000000;stroke-width:0.26458333" width="100.123456" height="60.987654" x="10.000001" y="9.999999" ry="8.0000001" />
    <path id="path12" d="m 40.123456,30.654321 c 10.111111,-5.222222 20.333333,-5.222222 30.444444,0 l 5.5,10.5 -10.25,10.25 z" style="fill:#ffffff;stroke:none" inkscape:connector-curvature="0" />
    <circle id="circle14" cx="30.000000" cy="55.000000" r="6.000000" fill="white" />
  </g></g>
</svg>`;

  mk('svg', `<div class="stage-col">
    <div class="card fm-pane">
      <div class="df-in-head"><label for="sv-in">Code SVG d’origine</label><span class="df-in-tools"><span class="hint" id="sv-in-n"></span><button type="button" class="Ghost" id="sv-open">Ouvrir un fichier</button></span></div>
      <textarea class="text-input df-ta fm-ta" id="sv-in" spellcheck="false" autocomplete="off" wrap="off" placeholder="Collez ici le code d’un fichier SVG, ou déposez un fichier .svg"></textarea>
      <input type="file" id="sv-file" accept=".svg,image/svg+xml" hidden>
      <div class="qr-msg is-error" id="sv-err" hidden></div>
    </div>
    <div class="card sv-res" id="sv-res" hidden>
      <div class="df-in-head"><h3 class="lr-h">Avant et après</h3>${seg('sv-bg', [['chk', 'Damier'], ['light', 'Clair'], ['dark', 'Sombre']], 'chk')}</div>
      <div class="sv-compare"><figure><div class="sv-box" id="sv-box-a"></div><figcaption id="sv-cap-a"></figcaption></figure><figure><div class="sv-box" id="sv-box-b"></div><figcaption id="sv-cap-b"></figcaption></figure></div>
      <div class="sv-stats" id="sv-stats"></div>
      <div class="df-in-head"><label for="sv-out">SVG optimisé</label></div>
      <textarea class="text-input df-ta fm-ta sv-out" id="sv-out" readonly spellcheck="false" wrap="soft"></textarea>
    </div></div>
    <div class="controls-col">
      <div class="card control-card"><h3>Nettoyage</h3>
        ${tog('sv-meta', 'Supprimer commentaires et données d’éditeur', true)}
        ${tog('sv-title', 'Conserver titre et description (accessibilité)', true)}
        ${tog('sv-ids', 'Supprimer les identifiants inutiles', true)}
        ${tog('sv-groups', 'Fusionner les groupes inutiles', true)}
        ${tog('sv-styles', 'Compacter les styles', true)}
        ${tog('sv-resp', 'Rendre responsive (retirer width et height)', false)}
      </div>
      <div class="card control-card"><h3>Compression</h3>
        ${tog('sv-num', 'Arrondir les nombres', true)}
        ${rng('sv-prec', 'Précision', 0, 6, 3, ' décimales')}
        ${tog('sv-paths', 'Minifier les tracés', true)}
        ${tog('sv-col', 'Raccourcir les couleurs', true)}
        <p class="hint">Avec 3 décimales, la différence de rendu est invisible dans la quasi-totalité des cas. Vérifiez toujours l’aperçu après compression.</p>
      </div>
      <div class="card control-card"><h3>Actions</h3><div class="df-btns">
        <button type="button" class="btn btn-accent btn-block" id="sv-copy" disabled>Copier le SVG</button>
        <button type="button" class="btn btn-ghost btn-block" id="sv-dl" disabled>Télécharger</button>
        <button type="button" class="btn btn-ghost btn-block" id="sv-sample">Charger un exemple</button>
        <button type="button" class="btn btn-ghost btn-block" id="sv-clear">Tout effacer</button>
      </div></div></div>`);

  const host = $('#view-svg');
  const IN = $('#sv-in', host), OUT = $('#sv-out', host), ERR = $('#sv-err', host);
  let name = 'image', token = 0;

  const opts = () => ({ comments: $('#sv-meta', host).checked, metadata: $('#sv-meta', host).checked, keepTitle: $('#sv-title', host).checked, ids: $('#sv-ids', host).checked, groups: $('#sv-groups', host).checked, styles: $('#sv-styles', host).checked, responsive: $('#sv-resp', host).checked, numbers: $('#sv-num', host).checked, precision: +$('#sv-prec', host).value, paths: $('#sv-paths', host).checked, colors: $('#sv-col', host).checked });
  const url = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  const load = s => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('rendu')); i.src = url(s); });
  const pixels = async s => {
    const i = await load(s), c = document.createElement('canvas');
    c.width = c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 200, 200);
    g.drawImage(i, 0, 0, 200, 200);
    return g.getImageData(0, 0, 200, 200).data;
  };

  async function compare(a, b, mytoken) {
    let msg = '';
    try {
      const [pa, pb] = await Promise.all([pixels(a), pixels(b)]);
      let sum = 0;
      for (let i = 0; i < pa.length; i++) sum += Math.abs(pa[i] - pb[i]);
      const pct = (sum / pa.length / 255) * 100;
      msg = pct < 0.05 ? 'Rendu identique à l’œil nu' : pct < 0.5 ? 'Écart de rendu minime (' + pct.toFixed(2).replace('.', ',') + ' %)' : 'Écart de rendu de ' + pct.toFixed(1).replace('.', ',') + ' % : augmentez la précision ou vérifiez l’aperçu';
      if (mytoken === token) $('#sv-diff', host).className = 'df-pill sv-diff' + (pct >= 0.5 ? ' is-warn' : '');
    } catch (e) { msg = 'Comparaison visuelle indisponible pour ce fichier'; }
    if (mytoken === token && $('#sv-diff', host)) $('#sv-diff', host).textContent = msg;
  }

  async function run() {
    const src = IN.value;
    $('#sv-in-n', host).textContent = src ? size(bytes(src)) : '';
    ERR.hidden = true;
    const dis = d => ['sv-copy', 'sv-dl'].forEach(id => { $('#' + id, host).disabled = d; });
    if (!src.trim()) { $('#sv-res', host).hidden = true; dis(true); return; }
    let out;
    try { out = SVGCore.optimize(src, opts()); } catch (e) { ERR.hidden = false; ERR.textContent = e.message; $('#sv-res', host).hidden = true; dis(true); return; }
    const my = ++token;
    OUT.value = out;
    $('#sv-res', host).hidden = false;
    dis(false);
    const a = bytes(src), b = bytes(out), pct = a ? Math.round((1 - b / a) * 100) : 0;
    $('#sv-box-a', host).innerHTML = `<img alt="SVG d’origine" src="${url(src)}">`;
    $('#sv-box-b', host).innerHTML = `<img alt="SVG optimisé" src="${url(out)}">`;
    $('#sv-cap-a', host).textContent = 'Original · ' + size(a);
    $('#sv-cap-b', host).textContent = 'Optimisé · ' + size(b);
    $('#sv-stats', host).innerHTML = `<span class="df-pill ${b < a ? 'add' : ''}">${b < a ? '−' + pct + ' %' : b > a ? '+' + -pct + ' %' : 'Aucun gain'}</span><span class="df-pill" id="sv-gz"></span><span class="df-pill" id="sv-diff">Comparaison du rendu…</span>`;
    gzipSize(out).then(g => { if (g !== null && my === token) { const el = $('#sv-gz', host); if (el) el.textContent = '≈ ' + size(g) + ' en gzip'; } });
    compare(src, out, my);
  }
  const go = debounce(run, 200);
  IN.addEventListener('input', () => { name = 'image'; go(); });
  $$('input[type="checkbox"]', host).forEach(e => e.addEventListener('change', run));
  bindRng('sv-prec', ' décimales', () => go());
  bindSeg('sv-bg', v => { const r = $('#sv-res', host); r.classList.remove('bg-chk', 'bg-light', 'bg-dark'); r.classList.add('bg-' + v); });
  $('#sv-res', host).classList.add('bg-chk');

  async function openFile(f) {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast('Fichier trop volumineux (8 Mo maximum).'); return; }
    try { IN.value = await readText(f); name = f.name.replace(/\.svg$/i, ''); run(); } catch (e) { toast(e.message); }
  }
  $('#sv-open', host).addEventListener('click', () => $('#sv-file', host).click());
  $('#sv-file', host).addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; openFile(f); });
  IN.addEventListener('dragover', e => e.preventDefault());
  IN.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) { e.preventDefault(); openFile(f); } });
  $('#sv-copy', host).addEventListener('click', () => copy(OUT.value, 'SVG copié'));
  $('#sv-dl', host).addEventListener('click', () => download(name + '.min.svg', OUT.value, 'image/svg+xml;charset=utf-8'));
  $('#sv-sample', host).addEventListener('click', () => { IN.value = SAMPLE; name = 'exemple'; run(); });
  $('#sv-clear', host).addEventListener('click', () => { IN.value = ''; run(); IN.focus(); });
  run();
})();
