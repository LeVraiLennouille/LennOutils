(function () {
  'use strict';
  const { $, $$, esc, mk, readText, debounce, toast } = Kit;

  const LIMITS = [['Titre SEO', 60], ['Meta description', 160], ['SMS (1 message)', 160], ['Publication X', 280], ['Légende Instagram', 2200]];
  const SAMPLE = 'Le petit atelier du bout de la rue ouvre ses portes chaque matin à huit heures. On y répare des vélos, des montres et parfois des souvenirs.\n\nLes clients y viennent pour un conseil, un café ou simplement pour regarder travailler les artisans. Ici, personne ne se presse : chaque objet mérite du temps et de l’attention.\n\nEt si vous passiez nous voir samedi ?';

  mk('count', `<div class="stage-col">
    <div class="card fm-pane">
      <div class="df-in-head"><label for="cn-in">Votre texte</label><span class="df-in-tools"><button type="button" class="Ghost" id="cn-open">Ouvrir un fichier</button></span></div>
      <textarea class="text-input df-ta fm-ta cn-ta" id="cn-in" spellcheck="false" placeholder="Saisissez ou collez votre texte ici"></textarea>
      <input type="file" id="cn-file" accept=".txt,.md,.html,.htm,.csv,text/*" hidden>
    </div>
    <div class="card cn-card"><h3>Statistiques</h3><div class="cn-grid" id="cn-grid"></div></div>
    <div class="card cn-card"><h3>Lisibilité</h3><div id="cn-read"></div></div>
    <div class="card cn-card"><h3>Mots les plus fréquents</h3><div id="cn-top"></div></div></div>
    <div class="controls-col">
      <div class="card control-card"><h3>Limites courantes</h3><div id="cn-limits" class="cn-limits"></div></div>
      <div class="card control-card"><h3>Actions</h3><div class="df-btns">
        <button type="button" class="btn btn-ghost btn-block" id="cn-sample">Charger un exemple</button>
        <button type="button" class="btn btn-ghost btn-block" id="cn-clear">Tout effacer</button>
      </div></div></div>`);

  const host = $('#view-count');
  const IN = $('#cn-in', host);
  const num = n => n.toLocaleString('fr-FR');
  const dec = n => n.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  function render() {
    const t = IN.value;
    const a = CountCore.analyze(t);
    const cells = [
      ['Mots', num(a.words)], ['Caractères', num(a.chars)], ['Sans les espaces', num(a.charsNoSpace)], ['Phrases', num(a.sentences)], ['Paragraphes', num(a.paragraphs)], ['Lignes', num(a.lines)],
      ['Lecture', a.read], ['À voix haute', a.speak], ['Mots uniques', num(a.unique)], ['Mot moyen', dec(a.avgWord) + ' lettres'], ['Phrase moyenne', dec(a.avgSentence) + ' mots'], ['Syllabes (estim.)', num(a.syllables)]
    ];
    $('#cn-grid', host).innerHTML = cells.map(c => `<div class="cn-stat"><span>${c[0]}</span><b>${esc(c[1])}</b></div>`).join('');
    const rd = $('#cn-read', host);
    if (a.score === null) rd.innerHTML = '<p class="hint">Saisissez au moins une phrase de cinq mots pour obtenir un score.</p>';
    else {
      const sc = Math.round(a.score), hue = Math.round((sc / 100) * 120);
      rd.innerHTML = `<div class="cn-score"><b>${sc}</b><span>/ 100</span><div><strong>${esc(a.level[0])}</strong><small>${esc(a.level[1])}</small></div></div><div class="cn-gauge" role="img" aria-label="Score de lisibilité ${sc} sur 100"><i style="width:${sc}%;background:hsl(${hue},60%,45%)"></i></div><p class="hint">Indice de Kandel et Moles (formule de Flesch adaptée au français). Le nombre de syllabes est estimé : le score est indicatif. Visez 60 ou plus pour le web grand public.</p>`;
    }
    $('#cn-top', host).innerHTML = a.top.length
      ? a.top.map(x => `<div class="cn-bar"><span>${esc(x.w)}</span><i style="--w:${Math.min(100, x.p * 8)}%"></i><b>${x.c} · ${dec(x.p)} %</b></div>`).join('')
      : '<p class="hint">Aucun mot significatif pour le moment.</p>';
    $('#cn-limits', host).innerHTML = LIMITS.map(([l, max]) => {
      const n = a.chars, over = n > max, pct = Math.min(100, (n / max) * 100);
      return `<div class="cn-lim${over ? ' is-over' : n > max * 0.9 ? ' is-near' : ''}"><div><span>${l}</span><b>${num(n)} / ${num(max)}</b></div><div class="cn-gauge"><i style="width:${pct}%"></i></div></div>`;
    }).join('');
  }

  IN.addEventListener('input', debounce(render, 80));
  $('#cn-open', host).addEventListener('click', () => $('#cn-file', host).click());
  $('#cn-file', host).addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast('Fichier trop volumineux (8 Mo maximum).'); return; }
    try { IN.value = await readText(f); render(); } catch (er) { toast(er.message); }
  });
  $('#cn-sample', host).addEventListener('click', () => { IN.value = SAMPLE; render(); });
  $('#cn-clear', host).addEventListener('click', () => { IN.value = ''; render(); IN.focus(); });
  render();
})();
