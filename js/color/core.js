/* =====================================================================
   colors-core.js — socle commun des outils couleur (colors.html)
   Maths couleur (sRGB, HSL, HSV, CMYK, OKLab/OKLCH), analyse de saisie,
   couleur de base partagée entre les outils, composants d'interface et
   simulation de la vision des couleurs. Expose window.Colors.
   Dépend de js/common.js (Utils).
   ===================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const cl = (v, a, b) => Math.min(b, Math.max(a, v)), R = (v, d = 0) => +(+v).toFixed(d);

  /* ---------- Maths couleur : sRGB 0-255, OKLab (B. Ottosson) ---------- */
  const lin = v => (v /= 255) <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  const gam = v => 255 * (v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055);
  const toHex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(cl(v, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase();
  function hsl(c) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2; let h = 0;
    if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return { h, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
  }
  function fromHsl(h, s, l) {
    h = ((h % 360) + 360) % 360; const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
  }
  const hsv = c => { const mx = Math.max(c.r, c.g, c.b) / 255, mn = Math.min(c.r, c.g, c.b) / 255; return { h: hsl(c).h, s: mx ? (mx - mn) / mx : 0, v: mx }; };
  function fromHsv(h, s, v) { const l = v * (1 - s / 2); return fromHsl(h, l && l < 1 ? (v - l) / Math.min(l, 1 - l) : 0, l); }
  function cmyk(c) { const r = c.r / 255, g = c.g / 255, b = c.b / 255, k = 1 - Math.max(r, g, b); return k >= 1 ? { c: 0, m: 0, y: 0, k: 1 } : { c: (1 - r - k) / (1 - k), m: (1 - g - k) / (1 - k), y: (1 - b - k) / (1 - k), k }; }
  const fromCmyk = (c, m, y, k) => ({ r: 255 * (1 - c) * (1 - k), g: 255 * (1 - m) * (1 - k), b: 255 * (1 - y) * (1 - k) });
  function oklab(c) {
    const r = lin(c.r), g = lin(c.g), b = lin(c.b), l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
    return { L: .2104542553 * l + .793617785 * m - .0040720468 * s, a: 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, b: .0259040371 * l + .7827717662 * m - .808675766 * s };
  }
  function fromOklab(L, a, b) {
    const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
    return { r: gam(4.0767416621 * l - 3.3077115913 * m + .2309699292 * s), g: gam(-1.2684380046 * l + 2.6097574011 * m - .3413193965 * s), b: gam(-.0041960863 * l - .7034186147 * m + 1.707614701 * s) };
  }
  const oklch = c => { const o = oklab(c), C = Math.hypot(o.a, o.b); return { L: o.L, C, h: C < .0004 ? 0 : (Math.atan2(o.b, o.a) * 180 / Math.PI + 360) % 360 }; };
  const inGamut = c => [c.r, c.g, c.b].every(v => v >= -.5 && v <= 255.5);
  function fromOklch(L, C, h, fit) {
    const q = C => { const t = h * Math.PI / 180; return fromOklab(L, C * Math.cos(t), C * Math.sin(t)); }; let c = q(C);
    if (fit && !inGamut(c)) { let lo = 0, hi = C; for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; inGamut(q(m)) ? lo = m : hi = m; } c = q(lo); }
    return c;
  }
  const lum = c => .2126 * lin(c.r) + .7152 * lin(c.g) + .0722 * lin(c.b);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const dE = (a, b) => { const x = oklab(a), y = oklab(b); return 100 * Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b); };
  const ink = c => ratio(c, { r: 0, g: 0, b: 0 }) > ratio(c, { r: 255, g: 255, b: 255 }) ? '#000' : '#fff';

  const ctx0 = document.createElement('canvas').getContext('2d');
  function parse(s) {
    s = String(s || '').trim().toLowerCase(); if (!s) return null;
    let m = s.match(/^#?([0-9a-f]+)$/);
    if (m && [3, 4, 6, 8].includes(m[1].length)) { let h = m[1]; if (h.length < 5) h = [...h].map(x => x + x).join(''); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }; }
    if (/^[a-z]+$/.test(s)) { ctx0.fillStyle = '#010203'; ctx0.fillStyle = s; const v = ctx0.fillStyle; return v === '#010203' ? null : parse(v); }
    m = s.match(/^([a-z]+)?\s*\(?([^()]*)\)?$/); if (!m) return null;
    const fn = m[1] || 'rgb', n = m[2].split(/[\s,\/]+/).filter(Boolean).map(t => ({ v: parseFloat(t), p: /%$/.test(t) }));
    if (n.length < 3 || n.some(x => isNaN(x.v))) return null;
    const [a, b, c, d] = n, ch = x => x.p ? x.v * 2.55 : x.v, pc = x => cl(x.v / 100, 0, 1), ok = x => x.p || x.v > 1 ? x.v / 100 : x.v;
    switch (fn) {
      case 'rgb': case 'rgba': return { r: cl(ch(a), 0, 255), g: cl(ch(b), 0, 255), b: cl(ch(c), 0, 255) };
      case 'hsl': case 'hsla': return fromHsl(a.v, pc(b), pc(c));
      case 'hsv': return fromHsv(a.v, pc(b), pc(c));
      case 'cmyk': return n.length < 4 ? null : fromCmyk(pc(a), pc(b), pc(c), pc(d));
      case 'oklch': return fromOklch(ok(a), b.v, c.v, true);
      case 'oklab': return fromOklab(ok(a), b.v, c.v);
    }
    return null;
  }
  const FMT = {
    hex: toHex,
    rgb: c => `rgb(${[c.r, c.g, c.b].map(v => Math.round(cl(v, 0, 255))).join(', ')})`,
    hsl: c => { const x = hsl(c); return `hsl(${R(x.h)}, ${R(x.s * 100)}%, ${R(x.l * 100)}%)`; },
    hsv: c => { const x = hsv(c); return `hsv(${R(x.h)}, ${R(x.s * 100)}%, ${R(x.v * 100)}%)`; },
    cmyk: c => { const x = cmyk(c); return `cmyk(${['c', 'm', 'y', 'k'].map(k => R(x[k] * 100) + '%').join(', ')})`; },
    oklch: c => { const x = oklch(c); return `oklch(${R(x.L * 100, 1)}% ${R(x.C, 3)} ${R(x.h, 1)})`; }
  };

  /* ---------- Utilitaires d'interface ---------- */
  const store = { get() { try { return localStorage.getItem('lenn.colors.base'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem('lenn.colors.base', v); } catch (e) {} } };
  const B = { c: parse(store.get()) || parse('#47A490'), subs: [] };
  const setBase = (c, src) => { B.c = c; store.set(toHex(c)); B.subs.forEach(f => f !== src && f(c)); };
  let last = null; const pub = l => { last = l.map(toHex); }, getLast = () => last;
  const css = l => ':root {\n' + l.map((c, i) => `  --color-${i + 1}: ${toHex(c)};`).join('\n') + '\n}';
  function copy(t) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => Utils.toast('Copié : ' + (t.length > 36 ? t.slice(0, 36) + '…' : t)), () => Utils.toast('Copie impossible : sélectionnez le texte à la main.'));
  }
  document.addEventListener('click', e => { const t = e.target.closest('[data-copy]'); if (t) copy(t.dataset.copy); });
  const sw = (c, pre = '') => { const h = toHex(c); return `<button type="button" class="sw" style="background:${h};color:${ink(c)}" data-copy="${h}" title="Copier ${h}"><span>${pre}${h.slice(1)}</span></button>`; };
  const swRow = l => `<div class="sw-row">${l.map(c => sw(c)).join('')}</div>`;
  function cf(host, label, val, onChange) {
    host.innerHTML = `<div class="field"><label>${label}</label><div class="color-row"><input type="color" aria-label="${label} (sélecteur)"><input type="text" spellcheck="false" autocomplete="off" aria-label="${label}"></div></div>`;
    const [pk, tx] = $$('input', host);
    const api = { get: () => parse(tx.value), set(c) { c = typeof c === 'string' ? parse(c) : c; tx.value = toHex(c); pk.value = toHex(c).toLowerCase(); tx.removeAttribute('aria-invalid'); } };
    tx.addEventListener('input', () => { const c = parse(tx.value); if (c) { pk.value = toHex(c).toLowerCase(); tx.removeAttribute('aria-invalid'); onChange(c); } else tx.setAttribute('aria-invalid', 'true'); });
    pk.addEventListener('input', () => { const c = parse(pk.value); tx.value = toHex(c); tx.removeAttribute('aria-invalid'); onChange(c); });
    api.set(val); return api;
  }
  const rng = (id, label, min, max, val, unit = '') => `<div class="field"><div class="field-row"><label for="${id}">${label}</label><span class="val" id="${id}-v">${val}${unit}</span></div><input type="range" id="${id}" min="${min}" max="${max}" value="${val}"></div>`;
  const bindRng = (id, unit, fn) => { const el = $('#' + id); el.addEventListener('input', () => { $('#' + id + '-v').textContent = el.value + unit; fn(+el.value); }); return el; };
  const dz = (id, sub) => `<div class="dropzone" id="${id}-dz"><div class="dz-inner"><svg class="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M12 4l-4 4M12 4l4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg><div class="dz-title">Glissez une image ou <b>parcourez vos fichiers</b></div><div class="dz-sub">${sub}</div></div><input type="file" id="${id}-in" accept=".png,.jpg,.jpeg,.svg,.webp,.avif,.heic,.heif,image/*" aria-label="Choisir une image"></div>`;
  const seg = (id, opts, cur) => `<div class="seg seg-block" id="${id}" role="group">${opts.map(o => `<button type="button" data-v="${o[0]}" aria-pressed="${o[0] === cur}">${o[1]}</button>`).join('')}</div>`;
  const bindSeg = (id, fn) => { const h = $('#' + id); h.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', h).forEach(x => x.setAttribute('aria-pressed', x === b)); fn(b.dataset.v); }); };
  const load = async (f) => { try { return await Utils.loadImage(f); } catch (e) { Utils.toast(e.message); return null; } };

  /* ---------- Liste des outils ---------- */
  const IC = {
    convertisseur: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    contraste: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    melange: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
    roue: '<circle cx="12" cy="12" r="9"/><path d="M12 12V3M12 12l7.8 4.5M12 12l-7.8 4.5"/>',
    daltonisme: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    graphiques: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    extracteur: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    images: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'
  };
  const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
  const TL = [
    ['convertisseur', 'Convertisseur', 'Convertir <em>une couleur</em>', 'Collez ou saisissez une couleur dans n’importe quel format (HEX, RGB, HSL, HSV, CMYK, OKLCH ou nom CSS) : tous les autres se mettent à jour.', 'Passez de HEX à RGB, HSL, HSV, CMYK ou OKLCH, et collez n’importe quel format.'],
    ['contraste', 'Contraste', 'Vérifier <em>un contraste</em>', 'Ratio WCAG entre un texte et son fond, niveaux AA et AAA, avec une correction proposée du premier plan.', 'Ratio WCAG, niveaux AA et AAA, et correction proposée du premier plan.'],
    ['melange', 'Mélangeur', 'Mélanger <em>deux couleurs</em>', 'Créez une suite de nuances entre deux couleurs, avec le choix de l’espace de mélange et du point d’équilibre.', 'Nuances intermédiaires entre deux couleurs, en sRGB, OKLab ou OKLCH.'],
    ['roue', 'Roue et harmonies', 'Roue chromatique <em>et harmonies</em>', 'Déplacez le point sur la roue, réglez la luminosité sur l’anneau : les harmonies se calculent à partir de la teinte.', 'Analogues, complémentaires, triades, tétrades : toutes les harmonies d’une couleur.'],
    ['daltonisme', 'Daltonisme', 'Simuler <em>le daltonisme</em>', 'Voyez vos couleurs et vos images comme les perçoivent les différents types de daltonisme (modèle de Machado, 2009).', 'Couleurs et images vues avec protanopie, deutéranopie, tritanopie ou achromatopsie.'],
    ['graphiques', 'Graphiques', 'Couleurs <em>pour graphiques</em>', 'Palettes catégorielles, séquentielles ou divergentes à partir d’une couleur, avec aperçu et écart minimal entre nuances.', 'Palettes de données avec aperçu et contrôle des confusions pour les daltoniens.'],
    ['extracteur', 'Extracteur de palette', 'Extraire <em>une palette</em>', 'Récupérez les couleurs dominantes d’une image, ou les couleurs réellement déclarées dans un fichier SVG.', 'Couleurs dominantes d’une image, ou couleurs déclarées d’un SVG.']
  ];
  const mk = (k, body) => { const t = TL.find(x => x[0] === k); $('#view-' + k).innerHTML = `<section class="tool-panel" aria-labelledby="h-${k}"><div class="PageHead"><span class="Eyebrow">${t[1]}</span><h1 class="MainTitle" id="h-${k}">${t[2]}</h1><p class="MainDesc">${t[3]}</p></div><div class="panel-body">${body}</div></section>`; };

  /* ---------- Daltonisme : matrices de Machado et al. (2009), sévérité 1,0, appliquées en RGB linéaire ---------- */
  const MX = { prot: [.152286, 1.052583, -.204868, .114503, .786281, .099216, -.003882, -.048116, 1.051998], deut: [.367322, .860646, -.227968, .280085, .672501, .047413, -.01182, .04294, .968881], trit: [1.255528, -.076749, -.178779, -.078411, .930809, .147602, .004733, .691367, .3039], achro: [.2126, .7152, .0722, .2126, .7152, .0722, .2126, .7152, .0722] };
  const mat = (t, s) => MX[t].map((v, i) => v * s + (i % 4 === 0 ? 1 - s : 0)); // interpolation linéaire depuis l'identité (approximation des sévérités intermédiaires)
  function sim(c, t, s) { if (t === 'n') return c; const m = mat(t, s), r = lin(c.r), g = lin(c.g), b = lin(c.b); return { r: gam(cl(m[0] * r + m[1] * g + m[2] * b, 0, 1)), g: gam(cl(m[3] * r + m[4] * g + m[5] * b, 0, 1)), b: gam(cl(m[6] * r + m[7] * g + m[8] * b, 0, 1)) }; }
  const TY = [['n', 'Vision normale'], ['prot', 'Protanopie'], ['deut', 'Deutéranopie'], ['trit', 'Tritanopie'], ['achro', 'Achromatopsie']];
  window.Colors = { $, $$, cl, R, lin, gam, toHex, hsl, fromHsl, hsv, fromHsv, cmyk, fromCmyk, oklab, fromOklab, oklch, fromOklch, ratio, dE, ink, parse, FMT, B, setBase, pub, getLast, css, copy, sw, swRow, cf, rng, bindRng, dz, seg, bindSeg, load, IC, svg, TL, mk, MX, mat, sim, TY };
})();
