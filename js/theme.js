/* =====================================================================
   theme.js — bascule clair / sombre (fichier IDENTIQUE dans les 3 apps)
   - Sans choix enregistré : suit le thème du système.
   - Au clic : enregistre le choix (localStorage « lenn.theme »).
   - Le bouton est ajouté en bas de la barre latérale (.rail-end).
   ===================================================================== */
(function () {
  var KEY = 'lenn.theme', root = document.documentElement;
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  var current = function () { return saved || (mq && mq.matches ? 'dark' : 'light'); };

  function apply() {
    root.setAttribute('data-theme', current());
    var btn = document.getElementById('theme-btn');
    if (!btn) return;
    var label = current() === 'dark' ? 'Mode clair' : 'Mode sombre';
    btn.querySelector('.lb').textContent = label;
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }
  apply();
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (!saved) apply(); });

  document.addEventListener('DOMContentLoaded', function () {
    var rail = document.querySelector('.rail');
    if (!rail || document.getElementById('theme-btn')) return;
    var end = rail.querySelector('.rail-end');
    if (!end) { end = document.createElement('div'); end.className = 'rail-end'; rail.appendChild(end); }
    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'theme-btn'; btn.className = 'Ghost ThemeBtn';
    btn.innerHTML =
      '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
      '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
      '<span class="lb"></span>';
    btn.addEventListener('click', function () {
      saved = current() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, saved); } catch (e) {}
      apply();
    });
    end.appendChild(btn);
    apply();
  });
})();
