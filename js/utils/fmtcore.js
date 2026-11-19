(function (root) {
  'use strict';

  function lineCol(src, pos) {
    let line = 1, last = -1;
    for (let i = 0; i < pos && i < src.length; i++) if (src[i] === '\n') { line++; last = i; }
    return { line, col: pos - last };
  }

  function JErr(src, pos, msg) {
    const lc = lineCol(src, pos);
    const e = new Error(msg + ' (ligne ' + lc.line + ', colonne ' + lc.col + ')');
    e.pos = pos; e.line = lc.line; e.col = lc.col; e.plain = msg;
    return e;
  }

  function jsonParse(src, tolerant) {
    let i = 0;
    const n = src.length;
    const ws = () => {
      for (;;) {
        while (i < n && /[ \t\r\n\ufeff]/.test(src[i])) i++;
        if (tolerant && src[i] === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
        if (tolerant && src[i] === '/' && src[i + 1] === '*') {
          const e = src.indexOf('*/', i + 2);
          if (e < 0) throw JErr(src, i, 'Commentaire non fermé');
          i = e + 2; continue;
        }
        break;
      }
    };
    const found = () => (i >= n ? 'fin du contenu' : '« ' + (src[i] === '\n' ? '\\n' : src[i]) + ' »');
    const fail = exp => { throw JErr(src, i, 'Caractère inattendu : ' + found() + (exp ? ', attendu : ' + exp : '')); };
    const str = () => {
      const s = i;
      i++;
      while (i < n && src[i] !== '"') {
        const c = src[i];
        if (c === '\\') {
          const d = src[i + 1];
          if (d === 'u') {
            if (!/^[0-9a-fA-F]{4}$/.test(src.slice(i + 2, i + 6))) throw JErr(src, i, 'Séquence \\u invalide dans la chaîne');
            i += 6;
          } else if (d && '"\\/bfnrt'.includes(d)) i += 2;
          else throw JErr(src, i, 'Séquence d’échappement invalide : \\' + (d || ''));
        } else if (c < ' ') throw JErr(src, i, 'Retour à la ligne ou caractère de contrôle non échappé dans une chaîne');
        else i++;
      }
      if (i >= n) throw JErr(src, s, 'Chaîne non fermée');
      i++;
      return src.slice(s, i);
    };
    const NUM = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    const val = depth => {
      if (depth > 400) throw JErr(src, i, 'Imbrication trop profonde');
      ws();
      const c = src[i];
      if (c === '{') {
        i++;
        const e = [];
        ws();
        if (src[i] === '}') { i++; return { t: 'o', e }; }
        for (;;) {
          ws();
          if (src[i] !== '"') {
            if (tolerant && src[i] === '}' && e.length) { i++; return { t: 'o', e }; }
            if (src[i] === '}' && e.length) throw JErr(src, i, 'Virgule en trop avant « } »');
            fail('une clé entre guillemets');
          }
          const k = str();
          ws();
          if (src[i] !== ':') fail('« : »');
          i++;
          const v = val(depth + 1);
          e.push({ k, v });
          ws();
          if (src[i] === ',') { i++; continue; }
          if (src[i] === '}') { i++; return { t: 'o', e }; }
          fail('« , » ou « } »');
        }
      }
      if (c === '[') {
        i++;
        const e = [];
        ws();
        if (src[i] === ']') { i++; return { t: 'a', e }; }
        for (;;) {
          ws();
          if (src[i] === ']' && e.length) {
            if (tolerant) { i++; return { t: 'a', e }; }
            throw JErr(src, i, 'Virgule en trop avant « ] »');
          }
          e.push(val(depth + 1));
          ws();
          if (src[i] === ',') { i++; continue; }
          if (src[i] === ']') { i++; return { t: 'a', e }; }
          fail('« , » ou « ] »');
        }
      }
      if (c === '"') return { t: 's', raw: str() };
      for (const w of ['true', 'false', 'null']) {
        if (src.startsWith(w, i) && !/[A-Za-z0-9_]/.test(src[i + w.length] || '')) { i += w.length; return { t: 'l', raw: w }; }
      }
      if (c === '-' || (c >= '0' && c <= '9')) {
        NUM.lastIndex = i;
        const m = NUM.exec(src);
        if (!m) throw JErr(src, i, 'Nombre invalide');
        i += m[0].length;
        if (/[0-9.eE]/.test(src[i] || '')) throw JErr(src, i, 'Nombre invalide');
        return { t: 'n', raw: m[0] };
      }
      if (i >= n) throw JErr(src, i, 'Fin inattendue du contenu : une valeur est attendue');
      fail('une valeur JSON');
    };
    ws();
    if (i >= n) throw JErr(src, 0, 'Aucun contenu à analyser');
    const root = val(0);
    ws();
    if (i < n) throw JErr(src, i, 'Contenu inattendu après la valeur : ' + found());
    return root;
  }

  function keyText(raw) {
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }

  function sortNode(node) {
    if (node.t === 'o') {
      node.e.forEach(x => sortNode(x.v));
      node.e = node.e.map((x, i) => [x, i, keyText(x.k)]).sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : a[1] - b[1])).map(x => x[0]);
    } else if (node.t === 'a') node.e.forEach(sortNode);
  }

  function jsonOut(node, unit, level) {
    if (node.t === 's' || node.t === 'n' || node.t === 'l') return node.raw;
    const pretty = unit !== null;
    const open = node.t === 'o' ? '{' : '[', close = node.t === 'o' ? '}' : ']';
    if (!node.e.length) return open + close;
    const pad = pretty ? '\n' + unit.repeat(level + 1) : '', end = pretty ? '\n' + unit.repeat(level) : '';
    const items = node.e.map(x => (node.t === 'o' ? x.k + (pretty ? ': ' : ':') + jsonOut(x.v, unit, level + 1) : jsonOut(x, unit, level + 1)));
    return open + pad + items.join(',' + pad) + end + close;
  }

  function indentUnit(o) {
    return o && o.indent === 'tab' ? '\t' : ' '.repeat(o && o.indent ? +o.indent : 2);
  }

  const json = {
    format(src, o) {
      o = o || {};
      const node = jsonParse(src, !!o.tolerant);
      if (o.sortKeys) sortNode(node);
      return jsonOut(node, indentUnit(o), 0) + '\n';
    },
    minify(src, o) {
      o = o || {};
      const node = jsonParse(src, !!o.tolerant);
      if (o.sortKeys) sortNode(node);
      return jsonOut(node, null, 0);
    },
    validate(src, o) { jsonParse(src, !!(o && o.tolerant)); return true; }
  };

  function CErr(src, pos, msg) {
    const lc = lineCol(src, pos);
    const e = new Error(msg + ' (ligne ' + lc.line + ', colonne ' + lc.col + ')');
    e.pos = pos; e.line = lc.line; e.col = lc.col;
    return e;
  }

  function cssParse(src) {
    let i = 0;
    const n = src.length;
    const skipWs = () => { while (i < n && /\s/.test(src[i])) i++; };
    function stmt() {
      let depth = 0, out = '';
      while (i < n) {
        const c = src[i];
        if (c === '/' && src[i + 1] === '*') {
          const e = src.indexOf('*/', i + 2), end = e < 0 ? n : e + 2;
          out += src.slice(i, end); i = end; continue;
        }
        if (c === '"' || c === "'") {
          const s = i; i++;
          while (i < n && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') i++; i++; }
          if (src[i] === c) i++;
          out += src.slice(s, i); continue;
        }
        if ((c === 'u' || c === 'U') && /^url\(\s*[^'"\s)]/i.test(src.slice(i, i + 40))) {
          const e = src.indexOf(')', i);
          const end = e < 0 ? n : e + 1;
          out += src.slice(i, end); i = end; continue;
        }
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
        else if (depth === 0 && (c === ';' || c === '{' || c === '}')) return { text: out, term: c };
        out += c; i++;
      }
      return { text: out, term: null };
    }
    function block(top, openAt) {
      const kids = [];
      for (;;) {
        skipWs();
        if (i >= n) {
          if (!top) throw CErr(src, openAt, 'Accolade « { » jamais fermée');
          return kids;
        }
        if (src[i] === '}') {
          if (top) throw CErr(src, i, 'Accolade fermante « } » sans ouvrante');
          i++;
          return kids;
        }
        if (src[i] === '/' && src[i + 1] === '*') {
          const e = src.indexOf('*/', i + 2), end = e < 0 ? n : e + 2;
          kids.push({ t: 'c', text: src.slice(i, end) });
          i = end; continue;
        }
        if (src[i] === ';') { i++; continue; }
        const at = i, st = stmt();
        if (st.term === '{' && /^--[^\s:]*\s*:/.test(st.text.trim())) {
          let depth = 0, q = null;
          const s0 = i;
          for (; i < n; i++) {
            const c = src[i];
            if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
            if (c === '"' || c === "'") { q = c; continue; }
            if (c === '{') depth++;
            if (c === '}') { depth--; if (depth === 0) { i++; break; } }
          }
          const text = (st.text + src.slice(s0, i)).trim();
          skipWs();
          if (src[i] === ';') i++;
          kids.push({ t: 'd', text });
        } else if (st.term === '{') {
          i++;
          kids.push({ t: 'r', pre: st.text.trim(), kids: block(false, at) });
        } else {
          if (st.term === ';') i++;
          const text = st.text.trim();
          if (text) kids.push({ t: 'd', text });
        }
      }
    }
    return block(true, 0);
  }

  function scan(text) {
    const parts = [];
    let i = 0;
    const n = text.length;
    while (i < n) {
      const c = text[i];
      if (/\s/.test(c)) {
        while (i < n && /\s/.test(text[i])) i++;
        parts.push({ k: 'ws' });
        continue;
      }
      if (c === '/' && text[i + 1] === '*') {
        const e = text.indexOf('*/', i + 2), end = e < 0 ? n : e + 2;
        parts.push({ k: 'cm', v: text.slice(i, end) }); i = end; continue;
      }
      if (c === '"' || c === "'") {
        const s = i; i++;
        while (i < n && text[i] !== c) { if (text[i] === '\\') i++; i++; }
        i++;
        parts.push({ k: 'raw', v: text.slice(s, i) }); continue;
      }
      if ((c === 'u' || c === 'U') && /^url\(\s*[^'"\s)]/i.test(text.slice(i, i + 40))) {
        const e = text.indexOf(')', i), end = e < 0 ? n : e + 1;
        parts.push({ k: 'raw', v: text.slice(i, end).replace(/^(url\()\s+/i, '$1').replace(/\s+\)$/, ')') }); i = end; continue;
      }
      parts.push({ k: 'ch', v: c });
      i++;
    }
    return parts;
  }

  function normCss(text, ctx, mode, keepComments) {
    const parts = scan(text);
    let out = '', pending = false, depth = 0, hold = false;
    const min = mode === 'min';
    const last = () => out[out.length - 1];
    const emit = (s, isRaw) => {
      if (hold) { pending = false; hold = false; }
      if (pending && out) {
        const l = last(), c = s[0];
        let space = true;
        if (min) {
          if (',('.includes(l) || ',)'.includes(c) && !isRaw) space = false;
          if (ctx === 'val' && c === '!') space = false;
          if (ctx === 'sel' && depth === 0 && ('>+~'.includes(l) || '>+~'.includes(c))) space = false;
          if (ctx === 'sel' && '>+~'.includes(l) && depth > 0) space = true;
          if (ctx === 'at' && (l === ':' || c === ':')) space = false;
        } else {
          if ('('.includes(l) || (c === ')' && !isRaw) || (c === ',' && !isRaw)) space = false;
          if (ctx === 'at' && c === ':') space = false;
        }
        if (space) out += ' ';
      }
      pending = false;
      out += s;
    };
    parts.forEach((p, idx) => {
      if (p.k === 'ws') { pending = true; return; }
      if (p.k === 'cm') {
        if (!min && keepComments) emit(p.v, true);
        else if (min && /^\/\*!/.test(p.v)) emit(p.v, true);
        else pending = pending || false;
        return;
      }
      if (p.k === 'raw') { emit(p.v, true); return; }
      const c = p.v;
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
      if (!min && c === ',') {
        out = out.replace(/\s+$/, '');
        out += ',';
        pending = true;
        return;
      }
      if (ctx === 'at' && c === ':' && depth > 0) {
        out = out.replace(/\s+$/, '');
        out += min ? ':' : ': ';
        pending = false;
        hold = !min;
        return;
      }
      if (!min && ctx === 'sel' && depth === 0 && '>+~'.includes(c)) {
        out = out.replace(/\s+$/, '');
        out += ' ' + c + ' ';
        pending = false;
        hold = true;
        return;
      }
      emit(c, false);
      void idx;
    });
    out = out.trim();
    if (ctx === 'val') {
      out = out.replace(/\s*!\s*important\s*$/i, min ? '!important' : ' !important');
    }
    return out;
  }

  function splitTop(text, ch) {
    const out = [];
    let depth = 0, cur = '', q = null;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { cur += c; if (c === '\\') { cur += text[++i] || ''; } else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (c === ch && depth <= 0) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  }

  function colonAt(text) {
    let depth = 0, q = null;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (c === ':' && depth === 0) return i;
    }
    return -1;
  }

  function stripComments(t) {
    return scan(t).map(p => (p.k === 'ws' ? ' ' : p.k === 'cm' ? '' : p.v)).join('');
  }

  function declOut(text, mode, keep) {
    if (text[0] === '@') return normCss(text, 'at', mode, keep);
    const c = colonAt(stripComments(text));
    if (c < 0) return normCss(text, 'val', mode, keep);
    const clean = keep ? text : stripComments(text);
    const ci = colonAt(clean);
    const prop = clean.slice(0, ci).trim().replace(/\s+/g, ' ');
    const rest = clean.slice(ci + 1);
    const value = prop.startsWith('--')
      ? scan(rest).map(p => (p.k === 'ws' ? ' ' : p.v)).join('').trim()
      : normCss(rest, 'val', mode, keep);
    return mode === 'min' ? prop + ':' + value : prop + ': ' + value;
  }

  function cssMinify(src) {
    const tree = cssParse(src);
    const emit = (kids, top) => {
      const out = [];
      kids.forEach(k => {
        if (k.t === 'c') { if (/^\/\*!/.test(k.text)) out.push({ t: 'c', s: k.text }); return; }
        if (k.t === 'd') { out.push({ t: 'd', s: declOut(k.text, 'min', false) }); return; }
        const pre = k.pre[0] === '@' ? normCss(k.pre, 'at', 'min') : splitTop(stripComments(k.pre), ',').map(s => normCss(s, 'sel', 'min')).join(',');
        const inner = emit(k.kids, false);
        if (!inner && k.pre[0] !== '@') return;
        out.push({ t: 'r', s: pre + '{' + inner + '}' });
      });
      let s = '';
      out.forEach((o, idx) => {
        if (idx > 0 && out[idx - 1].t === 'd') s += ';';
        s += o.s;
      });
      if (top && out.length && out[out.length - 1].t === 'd') s += ';';
      return s;
    };
    return emit(tree, true);
  }

  function cssFormat(src, o) {
    const unit = indentUnit(o);
    const tree = cssParse(src);
    const lines = [];
    const emit = (kids, level) => {
      const pad = unit.repeat(level);
      kids.forEach((k, idx) => {
        const prev = kids[idx - 1];
        if (k.t === 'c') {
          if (prev && ((level === 0 && prev.t !== 'c') || prev.t === 'r')) lines.push('');
          lines.push(k.text.split('\n').map((l, j) => (j === 0 ? pad + l.trim() : l.replace(/\s+$/, ''))).join('\n'));
          return;
        }
        if (k.t === 'd') {
          lines.push(pad + declOut(k.text, 'fmt', true) + ';');
          return;
        }
        if (prev && (prev.t === 'r' || level === 0 || (prev.t === 'd' && k.t === 'r'))) lines.push('');
        let pre;
        if (k.pre[0] === '@') pre = normCss(k.pre, 'at', 'fmt', true);
        else pre = splitTop(k.pre, ',').map(s => normCss(s, 'sel', 'fmt', true)).join(',\n' + pad);
        if (!k.kids.length) { lines.push(pad + pre + ' {}'); return; }
        lines.push(pad + pre + ' {');
        emit(k.kids, level + 1);
        lines.push(pad + '}');
      });
    };
    emit(tree, 0);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n') + (lines.length ? '\n' : '');
  }

  const css = { format: cssFormat, minify: cssMinify };

  const api = { json, css, lineCol };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FmtCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
