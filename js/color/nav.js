(function () {
  'use strict';
  const { $, $$, svg, TL } = Colors;
  $('#rail-nav').insertAdjacentHTML('afterend', `<p class="rail-group">Outils couleur</p><ul class="rail-nav">${TL.map(t => `<li><a class="rail-btn" title="${t[1]}" href="#${t[0]}"><span class="ic">${svg(t[0])}</span><span class="lb">${t[1]}</span></a></li>`).join('')}</ul>
    <p class="rail-group">Atelier</p><ul class="rail-nav"><li><a class="rail-btn" title="Outils image" href="img.html"><span class="ic">${svg('images')}</span><span class="lb">Images</span></a></li><li><a class="rail-btn" data-here title="Outils couleur" href="colors.html"><span class="ic">${svg('roue')}</span><span class="lb">Couleurs</span></a></li></ul>`);
  $('#view-accueil').innerHTML = `<header class="PageHead home-head"><img class="home-mark" src="assets/icon.svg" alt="Atelier" width="60" height="60"><p class="Eyebrow">Accueil</p><h1 class="MainTitle">Sept outils pour <em>travailler vos couleurs.</em></h1><p class="MainDesc">Convertir, contrôler un contraste, mélanger, composer des harmonies, simuler le daltonisme, créer des palettes de données ou en extraire d’une image : tout se passe dans votre navigateur.</p></header>
    <ul class="tool-grid" aria-label="Choix de l'outil">${TL.map((t, i) => `<li><a class="tool-card" href="#${t[0]}"><span class="tool-card-top"><span class="tool-ic">${svg(t[0])}</span><span class="tool-num mono">0${i + 1}</span></span><h2>${t[1]}</h2><p>${t[4]}</p><span class="tool-go">Ouvrir l'outil <span aria-hidden="true">→</span></span></a></li>`).join('')}</ul>
    <footer class="SiteFoot"><a href="https://lennouille.fr/" target="_blank" rel="noopener">lennouille.fr</a><nav aria-label="Autres outils Lennouille"><a href="img.html">Outils image</a><a href="https://audits.lennouille.fr/" target="_blank" rel="noopener">Auditeur</a><a href="https://simu.lennouille.fr/" target="_blank" rel="noopener">Simulateur</a></nav></footer>`;
  const HOME = 'accueil', views = {}, links = $$('.rail .rail-btn'); let shown = null;
  $$('[data-view]').forEach(m => { views[m.dataset.view] = m; });
  const TITLES = { accueil: 'Atelier — outils couleur' }; TL.forEach(t => { TITLES[t[0]] = t[1] + ' — Atelier'; });
  const wanted = () => { let k = ''; try { k = decodeURIComponent(location.hash.slice(1)).toLowerCase(); } catch (e) {} return Object.prototype.hasOwnProperty.call(views, k) ? k : HOME; };
  function show(k, moved) {
    if (k === shown) return; shown = k;
    Object.keys(views).forEach(n => { views[n].hidden = n !== k; }); document.body.classList.toggle('home-body', k === HOME);
    links.forEach(a => a.getAttribute('href') === '#' + k ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    document.title = TITLES[k]; if (window.Batch && Batch.activate) Batch.activate(k);
    if (moved) { window.scrollTo(0, 0); const h = views[k].querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
  }
  window.addEventListener('hashchange', () => show(wanted(), true)); show(wanted(), false);
})();
