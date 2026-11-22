(function (root) {
  'use strict';

  function execCore(o) {
    const flags = o.flags || '';
    const global = flags.indexOf('g') >= 0;
    const re = new RegExp(o.pattern, flags.indexOf('g') >= 0 || flags.indexOf('y') >= 0 ? flags : flags);
    const limit = o.limit || 500;
    const matches = [];
    let truncated = false;
    if (!global && flags.indexOf('y') < 0) {
      const m = re.exec(o.text);
      if (m) matches.push({ index: m.index, end: m.index + m[0].length, text: m[0], groups: m.slice(1), named: m.groups ? Object.assign({}, m.groups) : null });
    } else {
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(o.text)) !== null) {
        matches.push({ index: m.index, end: m.index + m[0].length, text: m[0], groups: m.slice(1), named: m.groups ? Object.assign({}, m.groups) : null });
        if (m[0] === '') re.lastIndex++;
        if (matches.length >= limit) { truncated = true; break; }
        if (!global) break;
      }
    }
    let replaced = null;
    if (o.replacement !== null && o.replacement !== undefined) replaced = o.text.replace(new RegExp(o.pattern, flags), o.replacement);
    return { matches, truncated, replaced };
  }

  const CLASS_NAMES = { d: 'un chiffre', D: 'un caractère qui n’est pas un chiffre', w: 'une lettre sans accent, un chiffre ou _', W: 'un caractère qui n’est ni lettre sans accent, ni chiffre, ni _', s: 'un espace blanc (espace, tabulation, retour à la ligne)', S: 'un caractère qui n’est pas un espace blanc' };

  function describeEscape(e, rest) {
    const c = e[1];
    if (CLASS_NAMES[c]) return { t: e, d: 'Correspond à ' + CLASS_NAMES[c] + '.', len: 2 };
    if (c === 'b') return { t: e, d: 'Limite de mot (entre un caractère de mot et un autre).', len: 2 };
    if (c === 'B') return { t: e, d: 'Position qui n’est pas une limite de mot.', len: 2 };
    if (c === 'n') return { t: e, d: 'Un retour à la ligne.', len: 2 };
    if (c === 'r') return { t: e, d: 'Un retour chariot.', len: 2 };
    if (c === 't') return { t: e, d: 'Une tabulation.', len: 2 };
    if (c === '0') return { t: e, d: 'Le caractère nul.', len: 2 };
    if (/[1-9]/.test(c)) { const m = /^\\(\d+)/.exec(rest); return { t: m[0], d: 'Même texte que celui capturé par le groupe n°' + m[1] + '.', len: m[0].length }; }
    if (c === 'k') { const m = /^\\k<([^>]+)>/.exec(rest); if (m) return { t: m[0], d: 'Même texte que celui capturé par le groupe nommé « ' + m[1] + ' ».', len: m[0].length }; }
    if (c === 'x') { const m = /^\\x([0-9a-fA-F]{2})/.exec(rest); if (m) return { t: m[0], d: 'Le caractère de code hexadécimal ' + m[1] + '.', len: 4 }; }
    if (c === 'u') { const m = /^\\u(?:\{([0-9a-fA-F]+)\}|([0-9a-fA-F]{4}))/.exec(rest); if (m) return { t: m[0], d: 'Le caractère Unicode U+' + (m[1] || m[2]).toUpperCase() + '.', len: m[0].length }; }
    if (c === 'p' || c === 'P') { const m = /^\\[pP]\{([^}]+)\}/.exec(rest); if (m) return { t: m[0], d: (c === 'p' ? 'Un caractère de la propriété Unicode « ' : 'Un caractère qui n’est pas de la propriété Unicode « ') + m[1] + ' ».', len: m[0].length }; }
    return { t: e, d: 'Le caractère « ' + c + ' » pris littéralement.', len: 2 };
  }

  function quantDesc(q) {
    const lazy = /\?$/.test(q) && q.length > 1;
    const b = lazy ? q.slice(0, -1) : q;
    let d;
    if (b === '*') d = 'Répété 0 fois ou plus';
    else if (b === '+') d = 'Répété 1 fois ou plus';
    else if (b === '?') d = 'Facultatif (0 ou 1 fois)';
    else {
      const m = /^\{(\d+)(,(\d*))?\}$/.exec(b);
      if (!m) return 'Quantificateur';
      if (m[2] === undefined) return 'Répété exactement ' + m[1] + ' fois.';
      else if (m[3] === '') d = 'Répété ' + m[1] + ' fois ou plus';
      else d = 'Répété de ' + m[1] + ' à ' + m[3] + ' fois';
    }
    return d + (lazy ? ' (le moins possible)' : ' (le plus possible)') + '.';
  }

  function explain(src, flags) {
    const out = [];
    let i = 0, depth = 0, cap = 0;
    const n = src.length;
    const push = (t, d, dep) => out.push({ t, d, depth: dep === undefined ? depth : dep });
    let lit = '';
    const flush = () => {
      if (lit) { push(lit, lit.length === 1 ? 'Le caractère « ' + lit + ' ».' : 'Le texte « ' + lit + ' ».'); lit = ''; }
    };
    while (i < n) {
      const c = src[i], rest = src.slice(i);
      if (c === '\\') {
        flush();
        const r = describeEscape(rest.slice(0, 2), rest);
        push(r.t, r.d); i += r.len; continue;
      }
      if (c === '[') {
        flush();
        let j = i + 1;
        if (src[j] === '^') j++;
        if (src[j] === ']') j++;
        while (j < n && src[j] !== ']') { if (src[j] === '\\') j++; j++; }
        const body = src.slice(i + 1, j), neg = body[0] === '^', inner = neg ? body.slice(1) : body;
        const parts = [];
        for (let k = 0; k < inner.length;) {
          let a;
          if (inner[k] === '\\') {
            const r = describeEscape(inner.slice(k, k + 2), inner.slice(k));
            a = r.t; k += r.len;
            if (/^\\[dDwWsS]$/.test(a)) { parts.push(a + ' (' + CLASS_NAMES[a[1]] + ')'); continue; }
            a = a.length === 2 && !/[a-zA-Z0-9]/.test(a[1]) ? a[1] : a;
          } else { a = inner[k]; k++; }
          if (inner[k] === '-' && k + 1 < inner.length) {
            let b = inner[k + 1];
            if (b === '\\') { b = inner[k + 2]; k += 3; } else k += 2;
            parts.push(a + '–' + b);
          } else parts.push(a);
        }
        push(src.slice(i, j + 1), (neg ? 'Un caractère qui n’est PAS parmi : ' : 'Un caractère parmi : ') + parts.join(', ') + '.');
        i = j + 1; continue;
      }
      if (c === '(') {
        flush();
        let m;
        if ((m = /^\(\?<([A-Za-z_$][\w$]*)>/.exec(rest))) { cap++; push(m[0], 'Début du groupe capturant nommé « ' + m[1] + ' » (n°' + cap + ').'); i += m[0].length; }
        else if (rest.startsWith('(?:')) { push('(?:', 'Début d’un groupe non capturant.'); i += 3; }
        else if (rest.startsWith('(?=')) { push('(?=', 'Début d’une anticipation positive : ce qui suit doit correspondre, sans le consommer.'); i += 3; }
        else if (rest.startsWith('(?!')) { push('(?!', 'Début d’une anticipation négative : ce qui suit ne doit pas correspondre.'); i += 3; }
        else if (rest.startsWith('(?<=')) { push('(?<=', 'Début d’une rétrospection positive : ce qui précède doit correspondre.'); i += 4; }
        else if (rest.startsWith('(?<!')) { push('(?<!', 'Début d’une rétrospection négative : ce qui précède ne doit pas correspondre.'); i += 4; }
        else { cap++; push('(', 'Début du groupe capturant n°' + cap + '.'); i++; }
        depth++; continue;
      }
      if (c === ')') { flush(); depth = Math.max(0, depth - 1); push(')', 'Fin du groupe.'); i++; continue; }
      if (c === '|') { flush(); push('|', 'OU : l’une ou l’autre des alternatives.'); i++; continue; }
      if (c === '^') { flush(); push('^', flags && flags.indexOf('m') >= 0 ? 'Début de ligne.' : 'Début du texte.'); i++; continue; }
      if (c === '$') { flush(); push('$', flags && flags.indexOf('m') >= 0 ? 'Fin de ligne.' : 'Fin du texte.'); i++; continue; }
      if (c === '.') { flush(); push('.', flags && flags.indexOf('s') >= 0 ? 'N’importe quel caractère, retour à la ligne compris.' : 'N’importe quel caractère, sauf un retour à la ligne.'); i++; continue; }
      let q = /^(?:[*+?]|\{\d+(?:,\d*)?\})\??/.exec(rest);
      if (q) {
        if (lit.length > 1) { const last = lit.slice(-1); lit = lit.slice(0, -1); flush(); lit = last; }
        flush();
        push(q[0], quantDesc(q[0])); i += q[0].length; continue;
      }
      lit += c; i++;
    }
    flush();
    return out;
  }

  const PRESETS = [
    { id: 'email', label: 'Adresse e-mail', p: '[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+', f: 'g', s: 'Contact : jean.dupont@exemple.fr ou support+aide@mon-site.com.\nPas une adresse : jean@ ou @exemple.' },
    { id: 'url', label: 'Adresse web', p: 'https?:\\/\\/[^\\s/$.?#].[^\\s]*', f: 'gi', s: 'Visitez https://lennouille.fr/outils?x=1 ou http://exemple.com/page#haut pour en savoir plus.' },
    { id: 'date', label: 'Date JJ/MM/AAAA', p: '\\b(0?[1-9]|[12]\\d|3[01])\\/(0?[1-9]|1[0-2])\\/(\\d{4})\\b', f: 'g', s: 'Rendez-vous le 05/03/2026, puis le 31/12/2026. Date invalide : 32/13/2026.' },
    { id: 'tel', label: 'Téléphone français', p: '(?:\\+33|0)[1-9](?:[ .-]?\\d{2}){4}', f: 'g', s: 'Appelez le 06 12 34 56 78, le 01.23.45.67.89 ou le +33 7 98 76 54 32.' },
    { id: 'cp', label: 'Code postal français', p: '\\b(?:0[1-9]|[1-8]\\d|9[0-5]|2[AB])\\d{3}\\b', f: 'g', s: '86000 Poitiers, 75001 Paris, 20000 Ajaccio, 99999 inexistant.' },
    { id: 'hex', label: 'Couleur hexadécimale', p: '#(?:[0-9a-fA-F]{3}){1,2}\\b', f: 'g', s: 'color: #ff6b2d; background: #FFF; border: 1px solid #1a1a1a; invalide: #12345' },
    { id: 'ip', label: 'Adresse IPv4', p: '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b', f: 'g', s: 'Serveur 192.168.0.1, passerelle 10.0.0.254, invalide 256.1.1.1.' },
    { id: 'dup', label: 'Mots répétés', p: '\\b(\\w+)\\s+\\1\\b', f: 'gi', s: 'Il faut faut vérifier que que les mots ne soient pas répétés.' },
    { id: 'tag', label: 'Balises HTML', p: '<\\/?[a-z][a-z0-9-]*(?:\\s[^>]*)?>', f: 'gi', s: '<p class="intro">Un <strong>texte</strong> avec un <a href="#">lien</a>.<br></p>' }
  ];

  const api = { execCore, explain, PRESETS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RegexCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
