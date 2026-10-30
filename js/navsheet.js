/* =====================================================================
   navsheet.js — menu mobile en feuille (fichier IDENTIQUE dans les 3 apps)
   Sous 860 px : barre fixe en haut (logo, app, section en cours, bouton menu).
   Le bouton ouvre la barre latérale (.rail) sous forme de feuille depuis le bas.
   Fermeture : croix, fond, Échap, glisser vers le bas, ou choix d'une entrée.
   ===================================================================== */
(function () {
  var mq = window.matchMedia ? matchMedia('(max-width:860px)') : { matches: false };

  document.addEventListener('DOMContentLoaded', function () {
    var rail = document.querySelector('.rail'), app = document.querySelector('.app');
    if (!rail || !app) return;
    var html = document.documentElement;
    rail.id = rail.id || 'rail';

    /* --- barre du haut --- */
    var mark = rail.querySelector('.rail-brand .mark');
    var appName = (rail.querySelector('.rail-brand .LogoTx') || {}).textContent || '';
    var top = document.createElement('header');
    top.className = 'MobileTop';
    top.innerHTML =
      '<div class="MobileTop-txt"><span class="MobileTop-app"></span><span class="MobileTop-cur"></span></div>' +
      '<button type="button" class="MobileTop-btn" aria-label="Ouvrir le menu" aria-haspopup="dialog" aria-expanded="false" aria-controls="' + rail.id + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>';
    if (mark) {
      var m = mark.cloneNode(true); m.setAttribute('alt', ''); m.setAttribute('aria-hidden', 'true');
      top.insertBefore(m, top.firstChild);
    }
    app.insertBefore(top, app.firstChild);
    var btn = top.querySelector('.MobileTop-btn');
    var appEl = top.querySelector('.MobileTop-app'), curEl = top.querySelector('.MobileTop-cur');

    function sync() {
      var c = rail.querySelector('.rail-btn[aria-current]:not([aria-current="false"]) .lb');
      curEl.textContent = c ? c.textContent.trim() : '';
      var st = document.getElementById('rail-st');
      var extra = st ? st.textContent.trim() : '';
      appEl.textContent = appName + (extra ? ' · ' + extra : '');
    }
    sync();
    new MutationObserver(sync).observe(rail, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-current'] });

    /* --- feuille : poignée, croix, fond --- */
    var head = document.createElement('div');
    head.className = 'rail-sheet-head';
    head.innerHTML =
      '<span class="grab" aria-hidden="true"></span>' +
      '<button type="button" class="rail-close" aria-label="Fermer le menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    rail.insertBefore(head, rail.firstChild);
    var closeBtn = head.querySelector('.rail-close');
    var scrim = document.createElement('div');
    scrim.className = 'rail-scrim';
    document.body.appendChild(scrim);

    var inertEls = [];
    function setInert(on) {
      if (on) {
        var skip = /^(SCRIPT|STYLE|LINK)$/;
        var els = [].filter.call(document.body.children, function (e) { return e !== app && e !== scrim && !skip.test(e.tagName); })
          .concat([].filter.call(app.children, function (e) { return e !== rail; }));
        els.forEach(function (e) { if (!e.inert) { e.inert = true; inertEls.push(e); } });
      } else {
        inertEls.forEach(function (e) { e.inert = false; });
        inertEls = [];
      }
    }
    function isOpen() { return html.classList.contains('rail-open'); }
    function open() {
      if (!mq.matches || isOpen()) return;
      html.classList.add('rail-open');
      btn.setAttribute('aria-expanded', 'true');
      rail.setAttribute('role', 'dialog'); rail.setAttribute('aria-modal', 'true'); rail.setAttribute('aria-label', 'Menu');
      setInert(true);
      closeBtn.focus({ preventScroll: true });
    }
    function close(restoreFocus) {
      if (!isOpen()) return;
      html.classList.remove('rail-open');
      btn.setAttribute('aria-expanded', 'false');
      rail.removeAttribute('role'); rail.removeAttribute('aria-modal'); rail.removeAttribute('aria-label');
      setInert(false);
      if (restoreFocus !== false) btn.focus({ preventScroll: true });
    }

    btn.addEventListener('click', open);
    closeBtn.addEventListener('click', function () { close(); });
    scrim.addEventListener('click', function () { close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) close(); });
    /* choisir une entrée (ou une action) referme la feuille, sauf le bouton de thème */
    rail.addEventListener('click', function (e) {
      if (!isOpen()) return;
      var t = e.target.closest('button,a');
      if (!t || t === closeBtn || t.id === 'theme-btn') return;
      close(false);
    }, true);
    /* glisser la poignée vers le bas */
    var y0 = null;
    head.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; }, { passive: true });
    head.addEventListener('touchmove', function (e) {
      if (y0 !== null && e.touches[0].clientY - y0 > 60) { y0 = null; close(); }
    }, { passive: true });
    head.addEventListener('touchend', function () { y0 = null; }, { passive: true });
    if (mq.addEventListener) mq.addEventListener('change', function () { if (!mq.matches) close(false); });
  });
})();
