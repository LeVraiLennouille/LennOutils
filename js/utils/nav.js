(function () {
  'use strict';
  const { $, $$, svg, TL, PAGE } = Kit;
  const SIBLINGS = [['Images', 'img.html', 'images', 'Outils image'], ['Couleurs', 'colors.html', 'couleurs', 'Outils couleur'], ['PDF', 'pdf.html', 'pdf', 'Outils PDF'], ['Utilitaires', 'utils.html', 'utils', 'Utilitaires'], ['Web', 'web.html', 'web', 'Web et design']];
  $('#rail-nav').insertAdjacentHTML('afterend', `<p class="rail-group">${PAGE.group}</p><ul class="rail-nav">${TL.map(t => `<li><a class="rail-btn" title="${t[1]}" href="#${t[0]}"><span class="ic">${svg(t[0])}</span><span class="lb">${t[1]}</span></a></li>`).join('')}</ul>
    <p class="rail-group">Atelier</p><ul class="rail-nav">${SIBLINGS.map(s => `<li><a class="rail-btn"${s[1] === PAGE.here ? ' data-here' : ''} title="${s[3]}" href="${s[1]}"><span class="ic">${svg(s[2])}</span><span class="lb">${s[0]}</span></a></li>`).join('')}</ul>`);
  $('#view-accueil').innerHTML = `<header class="PageHead home-head"><img class="home-mark" src="assets/icon.svg" alt="Atelier" width="60" height="60"><p class="Eyebrow">Accueil</p><h1 class="MainTitle">${PAGE.homeTitle}</h1><p class="MainDesc">${PAGE.homeDesc}</p></header>
    <ul class="tool-grid" aria-label="Choix de l'outil">${TL.map((t, i) => `<li><a class="tool-card" href="#${t[0]}"><span class="tool-card-top"><span class="tool-ic">${svg(t[0])}</span><span class="tool-num mono">0${i + 1}</span></span><h2>${t[1]}</h2><p>${t[4]}</p><span class="tool-go">Ouvrir l'outil <span aria-hidden="true">→</span></span></a></li>`).join('')}</ul>
    <footer class="SiteFoot"><a href="https://lennouille.fr/" target="_blank" rel="noopener">lennouille.fr</a><nav aria-label="Autres outils Lennouille">${SIBLINGS.filter(s => s[1] !== PAGE.here).map(s => `<a href="${s[1]}">${s[3]}</a>`).join('')}<a href="https://audits.lennouille.fr/" target="_blank" rel="noopener">Auditeur</a><a href="https://simu.lennouille.fr/" target="_blank" rel="noopener">Simulateur</a></nav></footer>`;
  const HOME = 'accueil', views = {}, links = $$('.rail .rail-btn[href^="#"]');
  let shown = null;
  $$('[data-view]').forEach(m => { views[m.dataset.view] = m; });
  const TITLES = { accueil: PAGE.title };
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
