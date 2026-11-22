(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const seg = (id, opts, cur) => `<div class="seg seg-block" id="${id}" role="group">${opts.map(o => `<button type="button" data-v="${o[0]}" aria-pressed="${o[0] === cur}">${o[1]}</button>`).join('')}</div>`;
  const bindSeg = (id, fn) => {
    const h = $('#' + id);
    h.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      $$('button', h).forEach(x => x.setAttribute('aria-pressed', x === b));
      fn(b.dataset.v);
    });
    return { set(v) { $$('button', h).forEach(x => x.setAttribute('aria-pressed', x.dataset.v === v)); } };
  };
  const rng = (id, label, min, max, val, unit = '') => `<div class="field"><div class="field-row"><label for="${id}">${label}</label><span class="val" id="${id}-v">${val}${unit}</span></div><input type="range" id="${id}" min="${min}" max="${max}" value="${val}"></div>`;
  const bindRng = (id, unit, fn) => {
    const el = $('#' + id);
    el.addEventListener('input', () => { $('#' + id + '-v').textContent = el.value + unit; fn(+el.value); });
    return el;
  };
  const tog = (id, label, on) => `<div class="field"><div class="field-row"><label for="${id}">${label}</label><span class="Toggle"><input type="checkbox" id="${id}"${on ? ' checked' : ''}></span></div></div>`;
  const colorField = (id, label, val) => `<div class="field"><label for="${id}-t">${label}</label><div class="color-row"><input type="color" id="${id}" value="${val}" aria-label="${label} (sélecteur)"><input type="text" id="${id}-t" value="${val.toUpperCase()}" spellcheck="false" autocomplete="off" maxlength="7"></div></div>`;
  function bindColor(id, fn) {
    const pk = $('#' + id), tx = $('#' + id + '-t');
    const ok = v => /^#[0-9a-fA-F]{6}$/.test(v);
    pk.addEventListener('input', () => { tx.value = pk.value.toUpperCase(); tx.removeAttribute('aria-invalid'); fn(pk.value); });
    tx.addEventListener('input', () => {
      let v = tx.value.trim();
      if (v && v[0] !== '#') v = '#' + v;
      if (/^#[0-9a-fA-F]{3}$/.test(v)) v = '#' + [...v.slice(1)].map(c => c + c).join('');
      if (ok(v)) { pk.value = v.toLowerCase(); tx.removeAttribute('aria-invalid'); fn(v.toLowerCase()); } else tx.setAttribute('aria-invalid', 'true');
    });
    return { set(v) { pk.value = v; tx.value = v.toUpperCase(); tx.removeAttribute('aria-invalid'); } };
  }

  function toast(msg) { if (window.Utils && Utils.toast) Utils.toast(msg); }

  function copy(t, label) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(
      () => toast((label || 'Copié') + (label ? '' : ' : ' + (t.length > 36 ? t.slice(0, 36) + '…' : t))),
      () => toast('Copie impossible : sélectionnez le texte à la main.')
    );
  }

  function download(name, data, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function readText(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error('Lecture du fichier impossible.'));
      r.readAsText(file);
    });
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  const size = n => (n < 1024 ? n + ' o' : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' Ko' : (n / 1048576).toFixed(2) + ' Mo');
  const bytes = s => new TextEncoder().encode(s).length;
  const lines = n => n + (n > 1 ? ' lignes' : ' ligne');

  async function gzipSize(text) {
    if (!window.CompressionStream) return null;
    try {
      const st = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
      return (await new Response(st).arrayBuffer()).byteLength;
    } catch (e) { return null; }
  }

  const LANGS = { html: { label: 'HTML', ext: 'html', mime: 'text/html' }, json: { label: 'JSON', ext: 'json', mime: 'application/json' }, css: { label: 'CSS', ext: 'css', mime: 'text/css' }, js: { label: 'JavaScript', ext: 'js', mime: 'text/javascript' } };

  function detect(text, name) {
    const ext = name && /\.([a-z0-9]+)$/i.exec(name);
    if (ext) {
      const e = ext[1].toLowerCase();
      if (e === 'json' || e === 'jsonc' || e === 'map') return 'json';
      if (e === 'css') return 'css';
      if (['html', 'htm', 'xhtml', 'svg'].includes(e)) return 'html';
      if (['js', 'mjs', 'cjs', 'jsx'].includes(e)) return 'js';
    }
    const t = text.trim();
    if (!t) return null;
    if (/^<(!doctype|html|head|body|div|p|span|section|main|nav|header|footer|ul|ol|table|form|a|img|h[1-6]|svg|script|style|link|meta|!--)\b/i.test(t) && /<\/[a-z]|\/>|<!doctype/i.test(t)) return 'html';
    if (/^[\[{]/.test(t)) {
      try { FmtCore.json.validate(t, { tolerant: true }); return 'json'; } catch (e) { }
    }
    if (/\b(function|const|let|var|return|class|import|export|=>|console\.|document\.|window\.)/.test(t) && !/^\s*(@[a-z-]+|[.#:\[*a-z][^{};]*)\{[^{}]*:[^{}]*;?\s*\}/i.test(t)) return 'js';
    if (/^\s*(@[a-z-]+[^{;]*[{;]|[^{};]+\{[\s\S]*\})/i.test(t) && /[a-z-]+\s*:\s*[^;{}]+[;}]/i.test(t)) return 'css';
    if (/[;{}()]/.test(t)) return 'js';
    return null;
  }

  function runFmt(lang, text, mode, o) {
    o = o || {};
    if (lang === 'html') return mode === 'min' ? HTMLCore.minify(text) : HTMLCore.format(text, o);
    if (lang === 'json') return mode === 'min' ? FmtCore.json.minify(text, o) : FmtCore.json.format(text, o);
    if (lang === 'css') return mode === 'min' ? FmtCore.css.minify(text) : FmtCore.css.format(text, o);
    if (lang === 'js') return mode === 'min' ? JSCore.minify(text) : JSCore.beautify(text, o);
    throw new Error('Langage non pris en charge');
  }

  const IC = {
    qr: '<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M17.5 20H21v-3"/>',
    diff: '<rect x="3" y="4" width="8" height="16" rx="1.6"/><rect x="13" y="4" width="8" height="16" rx="1.6"/><path d="M5.5 9h3M5.5 13h3M15.5 9h3M17 7.5v3"/>',
    lorem: '<path d="M4 6h16M4 10h11M4 14h16M4 18h9"/>',
    count: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    format: '<path d="M8 4c-2 0-3 1-3 3v2c0 1.2-.8 2-2 3 1.2 1 2 1.8 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.2.8 2 2 3-1.2 1-2 1.8-2 3v2c0 2-1 3-3 3"/>',
    dev: '<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="m6.5 9 3 3-3 3M12.5 15h5"/>',
    csv: '<path d="M4 5h16v14H4zM4 10h16M4 15h16M10 5v14"/>',
    regex: '<path d="M12 5v9M7.8 7.5l8.4 4.5M16.2 7.5 7.8 12"/><circle cx="6.5" cy="18" r="1.4"/>',
    encode: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
    grille: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    flex: '<rect x="3" y="5" width="5" height="14" rx="1"/><rect x="10" y="5" width="5" height="9" rx="1"/><rect x="17" y="5" width="4" height="12" rx="1"/>',
    web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    echelle: '<path d="M3 19 8 5l5 14M5 14h6"/><path d="M15 19l3-8 3 8M16 17h4"/>',
    clamp: '<path d="M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3"/>',
    seo: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    svg: '<path d="M5 19c6 0 4-14 14-14"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="5" r="1.5"/>',
    images: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    couleurs: '<circle cx="12" cy="12" r="9"/><path d="M12 12V3M12 12l7.8 4.5M12 12l-7.8 4.5"/>',
    pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
    utils: '<path d="M14.5 6.5a4 4 0 0 0-5.2 5.2L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.2-5.2l-2.6 2.6-2.4-.6-.6-2.4z"/>'
  };
  const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;

  const TL = [
    ['qr', 'QR code', 'Créer <em>un QR code</em>', 'Texte, lien, Wi‑Fi, e‑mail ou carte de visite : choisissez les couleurs et le style des modules, ajoutez votre logo, puis exportez en PNG ou en SVG.', 'Texte, lien, Wi‑Fi, e‑mail ou vCard, avec couleurs, logo et export PNG ou SVG.'],
    ['diff', 'Comparateur', 'Comparer <em>deux versions</em>', 'Collez deux versions d’un fichier HTML, CSS, JS, JSON ou de n’importe quel texte : les lignes et les mots modifiés sont surlignés.', 'Différences ligne par ligne et mot par mot, côte à côte ou unifiées, avec export en patch.'],
    ['format', 'Formateur', 'Formater <em>ou minifier du code</em>', 'JSON, CSS et JavaScript : une mise en forme lisible ou une version compacte, avec les erreurs de syntaxe localisées.', 'Indentation propre ou version compacte de vos JSON, CSS et JS, avec le gain de poids.'],
    ['lorem', 'Texte factice', 'Générer <em>du texte factice</em>', 'Cinq paragraphes avec leurs titres, prêts à copier pour vos maquettes : le classique « Lorem ipsum », une recette de gâteau au chocolat ou un récit de pirates.', 'Lorem ipsum classique, recette de gâteau au chocolat ou récit de pirates, en cinq paragraphes titrés.'],
    ['count', 'Compteur de texte', 'Compter <em>et mesurer la lisibilité</em>', 'Mots, caractères, phrases, temps de lecture et score de lisibilité adapté au français, avec les limites courantes (titre SEO, meta description, SMS, X).', 'Mots, caractères, temps de lecture et score de lisibilité en français, avec les limites SEO et réseaux.']
  ];

  const mk = (k, body) => {
    const t = TL.find(x => x[0] === k);
    $('#view-' + k).innerHTML = `<section class="tool-panel" aria-labelledby="h-${k}"><div class="PageHead"><span class="Eyebrow">${t[1]}</span><h1 class="MainTitle" id="h-${k}">${t[2]}</h1><p class="MainDesc">${t[3]}</p></div><div class="panel-body">${body}</div></section>`;
  };

  window.Kit = { $, $$, esc, seg, bindSeg, rng, bindRng, tog, colorField, bindColor, copy, download, readText, debounce, size, bytes, lines, gzipSize, LANGS, detect, runFmt, IC, svg, TL, mk, toast };
})();
