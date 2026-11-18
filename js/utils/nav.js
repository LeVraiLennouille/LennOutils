(function () {
  'use strict';
  const { $, $$, svg, TL } = Kit;
  $('#rail-nav').insertAdjacentHTML('afterend', `<p class="rail-group">Utilitaires</p><ul class="rail-nav">${TL.map(t => `<li><a class="rail-btn" title="${t[1]}" href="#${t[0]}"><span class="ic">${svg(t[0])}</span><span class="lb">${t[1]}</span></a></li>`).join('')}</ul>
    <p class="rail-group">Atelier</p><ul class="rail-nav"><li><a class="rail-btn" title="Outils image" href="img.html"><span class="ic">${svg('images')}</span><span class="lb">Images</span></a></li><li><a class="rail-btn" title="Outils couleur" href="colors.html"><span class="ic">${svg('couleurs')}</span><span class="lb">Couleurs</span></a></li><li><a class="rail-btn" title="Outils PDF" href="pdf.html"><span class="ic">${svg('pdf')}</span><span class="lb">PDF</span></a></li><li><a class="rail-btn" data-here title="Utilitaires" href="utils.html"><span class="ic">${svg('utils')}</span><span class="lb">Utilitaires</span></a></li></ul>`);
  $('#view-accueil').innerHTML = `<header class="PageHead home-head"><img class="home-mark" src="assets/icon.svg" alt="Atelier" width="60" height="60"><p class="Eyebrow">Accueil</p><h1 class="MainTitle">Quatre utilitaires pour <em>créer, comparer et formater.</em></h1><p class="MainDesc">Générer un QR code à vos couleurs, produire du texte factice sur mesure, comparer deux versions d’un fichier de code, formater ou minifier du JSON, du CSS et du JavaScript : tout se passe dans votre navigateur, sans envoi de fichier.</p></header>
    <ul class="tool-grid" aria-label="Choix de l'outil">${TL.map((t, i) => `<li><a class="tool-card" href="#${t[0]}"><span class="tool-card-top"><span class="tool-ic">${svg(t[0])}</span><span class="tool-num mono">0${i + 1}</span></span><h2>${t[1]}</h2><p>${t[4]}</p><span class="tool-go">Ouvrir l'outil <span aria-hidden="true">→</span></span></a></li>`).join('')}</ul>
    <footer class="SiteFoot"><a href="https://lennouille.fr/" target="_blank" rel="noopener">lennouille.fr</a><nav aria-label="Autres outils Lennouille"><a href="img.html">Outils image</a><a href="colors.html">Outils couleur</a><a href="pdf.html">Outils PDF</a><a href="https://audits.lennouille.fr/" target="_blank" rel="noopener">Auditeur</a><a href="https://simu.lennouille.fr/" target="_blank" rel="noopener">Simulateur</a></nav></footer>`;
  const HOME = 'accueil', views = {}, links = $$('.rail .rail-btn[href^="#"]');
  let shown = null;
  $$('[data-view]').forEach(m => { views[m.dataset.view] = m; });
  const TITLES = { accueil: 'Atelier — utilitaires' };
  TL.forEach(t => { TITLES[t[0]] = t[1] + ' — Atelier'; });
  const wanted = () => {
    let k = '';
    try { k = decodeURIComponent(location.hash.slice(1)).toLowerCase(); } catch (e) { }
    return Object.prototype.hasOwnProperty.call(views, k) ? k : HOME;
  };
  function show(k, moved) {
    if (k === shown) return;
    shown = k;
    Object.keys(views).forEach(n => { views[n].hidden = n !== k; });
    document.body.classList.toggle('home-body', k === HOME);
    links.forEach(a => (a.getAttribute('href') === '#' + k ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    document.title = TITLES[k];
    if (moved) {
      window.scrollTo(0, 0);
      const h = views[k].querySelector('h1');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }
  window.addEventListener('hashchange', () => show(wanted(), true));
  show(wanted(), false);
})();
