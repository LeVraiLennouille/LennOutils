(function (root) {
  'use strict';

  const dep = (name, path) => (typeof require !== 'undefined' && typeof module !== 'undefined' ? require(path) : root[name]);
  const F = () => dep('FmtCore', './fmtcore.js');
  const J = () => dep('JSCore', './jscore.js');

  const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
  const RAW = new Set(['script', 'style', 'textarea']);
  const BLOCK = new Set('address article aside base blockquote body caption col colgroup dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html legend li link main menu meta nav ol p pre script section style summary table tbody td template tfoot th thead title tr ul'.split(' '));
  const ATOM = new Set(['svg', 'math']);
  const CLOSES = {
    p: new Set('address article aside blockquote details div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr main nav ol p pre section table ul'.split(' ')),
    li: new Set(['li']),
    dt: new Set(['dt', 'dd']),
    dd: new Set(['dt', 'dd']),
    td: new Set(['td', 'th', 'tr', 'tbody', 'tfoot']),
    th: new Set(['td', 'th', 'tr', 'tbody', 'tfoot']),
    tr: new Set(['tr', 'tbody', 'tfoot']),
    thead: new Set(['tbody', 'tfoot']),
    tbody: new Set(['tbody', 'tfoot']),
    option: new Set(['option', 'optgroup']),
    optgroup: new Set(['optgroup'])
  };

  function lineCol(src, pos) {
    let line = 1, last = -1;
    for (let i = 0; i < pos && i < src.length; i++) if (src[i] === '\n') { line++; last = i; }
    return { line, col: pos - last };
  }

  function parseAttrs(s) {
    const out = [];
    const re = /([^\s=\/>"']+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
    let m;
    while ((m = re.exec(s))) out.push(m[2] === undefined ? m[1] : m[1] + '=' + m[2]);
    return out;
  }

  function parse(src) {
    const n = src.length;
    const rootNode = { type: 'root', children: [] };
    const stack = [rootNode];
    const top = () => stack[stack.length - 1];
    let i = 0, text = '';
    const flush = () => {
      if (text) { top().children.push({ type: 'text', v: text }); text = ''; }
    };
    while (i < n) {
      const c = src[i];
      if (c !== '<') {
        const j = src.indexOf('<', i + 1);
        const end = j < 0 ? n : j;
        text += src.slice(i, end);
        i = end;
        continue;
      }
      if (src.startsWith('<!--', i)) {
        flush();
        const e = src.indexOf('-->', i + 4);
        const end = e < 0 ? n : e + 3;
        top().children.push({ type: 'comment', v: src.slice(i, end) });
        i = end; continue;
      }
      if (src.startsWith('<![CDATA[', i)) {
        flush();
        const e = src.indexOf(']]>', i);
        const end = e < 0 ? n : e + 3;
        top().children.push({ type: 'raw', v: src.slice(i, end) });
        i = end; continue;
      }
      if (src[i + 1] === '!' || src[i + 1] === '?') {
        flush();
        const e = src.indexOf('>', i);
        const end = e < 0 ? n : e + 1;
        top().children.push({ type: src[i + 1] === '!' ? 'doctype' : 'pi', v: src.slice(i, end).trim() });
        i = end; continue;
      }
      if (src[i + 1] === '/' && /[A-Za-z]/.test(src[i + 2] || '')) {
        flush();
        const m = /^<\/([A-Za-z][^\s>\/]*)\s*>?/.exec(src.slice(i, i + 200));
        const name = m[1].toLowerCase();
        let k = stack.length - 1;
        while (k > 0 && stack[k].lname !== name) k--;
        if (k > 0) {
          stack[k].closed = true;
          stack.length = k;
        }
        const e = src.indexOf('>', i);
        i = e < 0 ? n : e + 1;
        continue;
      }
      if (/[A-Za-z]/.test(src[i + 1] || '')) {
        flush();
        const nm = /^<([A-Za-z][^\s\/>]*)/.exec(src.slice(i, i + 200));
        const name = nm[1], lname = name.toLowerCase();
        let j = i + nm[0].length, q = null;
        const attrStart = j;
        while (j < n) {
          const d = src[j];
          if (q) { if (d === q) q = null; }
          else if (d === '"' || d === "'") q = d;
          else if (d === '>') break;
          j++;
        }
        if (j >= n) throw Object.assign(new Error('Balise « <' + name + ' » jamais fermée (ligne ' + lineCol(src, i).line + ')'), { pos: i });
        let attrSrc = src.slice(attrStart, j);
        const selfClose = /\/\s*$/.test(attrSrc) && !/=\s*[^\s"']+\/\s*$/.test(attrSrc);
        if (selfClose) attrSrc = attrSrc.replace(/\/\s*$/, '');
        const el = { type: 'el', name, lname, attrs: parseAttrs(attrSrc), selfClose, children: [], closed: false };
        while (top().type === 'el' && CLOSES[top().lname] && CLOSES[top().lname].has(lname)) { stack.pop(); }
        top().children.push(el);
        i = j + 1;
        if (VOID.has(lname) || selfClose) { el.closed = true; el.isVoid = VOID.has(lname); continue; }
        if (RAW.has(lname)) {
          const re = new RegExp('</' + lname + '\\s*>', 'i');
          const rest = src.slice(i);
          const m = re.exec(rest);
          const body = m ? rest.slice(0, m.index) : rest;
          el.raw = body;
          el.closed = !!m;
          i += body.length + (m ? m[0].length : 0);
          continue;
        }
        if (lname === 'pre') {
          let depth = 1, p = i;
          const re = /<(\/?)pre\b[^>]*>/gi;
          re.lastIndex = i;
          let m;
          while ((m = re.exec(src))) {
            if (m[1]) depth--; else depth++;
            if (!depth) { p = m.index; break; }
          }
          if (!depth) {
            el.raw = src.slice(i, p);
            el.closed = true;
            i = p + src.slice(p).indexOf('>') + 1;
          } else { el.raw = src.slice(i); i = n; }
          continue;
        }
        stack.push(el);
        continue;
      }
      text += c;
      i++;
    }
    flush();
    return rootNode;
  }

  const isRawEl = n => n.type === 'el' && n.raw !== undefined;
  const pure = n => n.type === 'text' || (n.type === 'el' && (ATOM.has(n.lname) || n.lname === 'textarea' || (!BLOCK.has(n.lname) && !isRawEl(n) && n.children.every(pure))));
  const inlineLevel = pure;
  const collapse = t => t.replace(/[ \t\r\n\f]+/g, ' ');

  function tagOpen(n, extra) {
    const a = n.attrs.length ? ' ' + n.attrs.join(' ') : '';
    return '<' + n.name + a + (n.selfClose ? ' /' : '') + '>' + (extra || '');
  }
  const tagClose = n => (n.closed && !n.isVoid && !n.selfClose ? '</' + n.name + '>' : '');

  function embedded(n, mode, o) {
    const type = (n.attrs.map(a => a.toLowerCase()).find(a => a.startsWith('type=')) || '').replace(/^type=["']?|["']$/g, '');
    const raw = n.raw;
    if (n.lname === 'textarea') return null;
    if (!raw.trim()) return '';
    try {
      if (n.lname === 'style') return mode === 'min' ? F().css.minify(raw) : F().css.format(raw, { indent: o.indent }).replace(/\n$/, '');
      if (/json/i.test(type)) return mode === 'min' ? F().json.minify(raw) : F().json.format(raw, { indent: o.indent }).replace(/\n$/, '');
      if (!type || /^(text\/javascript|application\/javascript|module|text\/ecmascript)$/i.test(type)) return mode === 'min' ? J().minify(raw) : J().beautify(raw, { indent: o.indent, baseLevel: o.level }).replace(/\n$/, '');
    } catch (e) { return null; }
    return null;
  }

  function inlineStr(n) {
    if (n.type === 'text') return collapse(n.v);
    if (n.lname === 'textarea') return tagOpen(n) + n.raw.replace(/ /g, '\u0002') + tagClose(n);
    if (n.selfClose || n.isVoid) return tagOpen(n);
    const inSvg = ATOM.has(n.lname) || n._svg;
    const textual0 = n.lname === 'text' || n.lname === 'tspan' || n.lname === 'textpath';
    const brk = inSvg && !textual0 && !n.children.some(c => c.type === 'text' && c.v.trim());
    let body = '';
    n.children.forEach((c, ci) => {
      if (brk && ci === 0) body += '\u0001';
      if (c.type === 'text') {
        const t = collapse(c.v);
        const textual = n.lname === 'text' || n.lname === 'tspan' || n.lname === 'textpath' || !inSvg;
        body += textual ? t : (t.trim() ? t : '');
      } else if (c.type === 'el') {
        if (inSvg) markSvg(c);
        body += inlineStr(c) + (brk ? '\u0001' : '');
      } else if (c.type === 'comment') body += c.v + (brk ? '\u0001' : '');
      else body += c.v;
    });
    return tagOpen(n) + body + tagClose(n);
  }
  function markSvg(c) { c._svg = true; if (c.type === 'el') c.children.forEach(x => { if (x.type === 'el') markSvg(x); }); }

  function wrapRun(run, width) {
    const words = [];
    let cur = '', inTag = false, q = null;
    for (let i = 0; i < run.length; i++) {
      const c = run[i];
      if (inTag) {
        if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') inTag = false;
        cur += c; continue;
      }
      if (c === '<' && /[A-Za-z\/!]/.test(run[i + 1] || '')) { inTag = true; cur += c; continue; }
      if (c === ' ') { words.push(cur); cur = ''; continue; }
      if (c === '\u0001') { words.push(cur); words.push('\u0001'); cur = ''; continue; }
      cur += c;
    }
    words.push(cur);
    const lines = [];
    let line = '', extra = false;
    const emit = () => { if (line) lines.push((extra ? '\u0003' : '') + line); line = ''; };
    words.forEach(w => {
      if (w === '\u0001') { emit(); extra = true; return; }
      if (w === '') return;
      if (!line) line = w;
      else if ((line + ' ' + w).length <= width) line += ' ' + w;
      else { emit(); line = w; }
    });
    emit();
    if (!lines.length) lines.push('');
    return lines;
  }

  function format(src, o) {
    o = o || {};
    const unit = o.indent === 'tab' ? '\t' : ' '.repeat(o.indent ? +o.indent : 2);
    const width = o.width || 100;
    const tree = parse(src);
    const lines = [];
    const pad = l => unit.repeat(l);

    function openLine(n, level) {
      const one = tagOpen(n);
      if (pad(level).length + one.length <= width || n.attrs.length < 2) return [pad(level) + one];
      const out = [pad(level) + '<' + n.name];
      n.attrs.forEach(a => out.push(pad(level + 1) + a));
      out[out.length - 1] += (n.selfClose ? ' /' : '') + '>';
      return out;
    }

    function runLines(buf, level) {
      let run = buf.map(inlineStr).join('');
      run = run.replace(/^ +| +$/g, '');
      if (!run) return [];
      return wrapRun(run, width - pad(level).length).map(l => (l[0] === '\u0003' ? pad(level + 1) + l.slice(1) : pad(level) + l).replace(/\u0002/g, ' '));
    }

    function children(list, level) {
      let buf = [];
      const flush = () => {
        if (!buf.length) return;
        const solo = buf.filter(b => !(b.type === 'text' && !b.v.trim()));
        if (solo.length === 1 && solo[0].type === 'el' && ATOM.has(solo[0].lname) && !solo[0].selfClose) node(solo[0], level, true);
        else runLines(buf, level).forEach(l => lines.push(l));
        buf = [];
      };
      list.forEach(c => {
        if (c.type === 'text' || (c.type === 'el' && inlineLevel(c))) { buf.push(c); return; }
        flush();
        node(c, level);
      });
      flush();
    }

    function node(n, level, expandAtom) {
      if (n.type === 'text') { const t = collapse(n.v).trim(); if (t) lines.push(pad(level) + t); return; }
      if (n.type === 'comment' || n.type === 'doctype' || n.type === 'pi' || n.type === 'raw') {
        const v = n.v.split('\n');
        lines.push(pad(level) + v[0].replace(/\s+$/, ''));
        v.slice(1).forEach(l => lines.push(l.replace(/\s+$/, '')));
        return;
      }
      if (expandAtom) markSvg(n);
      if (n.selfClose || n.isVoid) { openLine(n, level).forEach(l => lines.push(l)); return; }
      if (n.lname === 'pre') {
        const op = tagOpen(n);
        const body = n.raw + tagClose(n);
        const all = (pad(level) + op + body).split('\n');
        all.forEach(l => lines.push(l.replace(/[ \t]+$/, '')));
        return;
      }
      if (isRawEl(n)) {
        const emb = n.lname === 'textarea' ? null : embedded(n, 'fmt', { indent: o.indent, level: level + 1 });
        const op = openLine(n, level);
        if (emb === null) {
          if (n.lname === 'textarea') { lines.push(pad(level) + tagOpen(n) + n.raw + tagClose(n)); return; }
          const rawLines = n.raw.replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n');
          const ind = Math.min(...rawLines.filter(l => l.trim()).map(l => /^[ \t]*/.exec(l)[0].length));
          op.forEach(l => lines.push(l));
          if (n.raw.trim()) rawLines.forEach(l => lines.push(l.trim() ? pad(level + 1) + l.slice(isFinite(ind) ? ind : 0).replace(/\s+$/, '') : ''));
          lines.push(pad(level) + tagClose(n));
          return;
        }
        if (!emb) { lines.push(op.join('\n') + tagClose(n)); const k = lines.pop(); k.split('\n').forEach(l => lines.push(l)); return; }
        op.forEach(l => lines.push(l));
        const needPad = n.lname === 'style' || /json/i.test(n.attrs.join(' '));
        emb.split('\n').forEach(l => lines.push(l.trim() ? (needPad ? pad(level + 1) + l : l) : ''));
        lines.push(pad(level) + tagClose(n));
        return;
      }
      const kids = n.children;
      const open = openLine(n, level);
      const close = tagClose(n);
      if (!kids.length) {
        if (open.length === 1) lines.push(open[0] + close);
        else { open.forEach(l => lines.push(l)); if (close) lines[lines.length - 1] += close; }
        return;
      }
      const allInline = kids.every(k => k.type === 'text' || (k.type === 'el' && inlineLevel(k)));
      if (allInline && !expandAtom) {
        const run = kids.map(inlineStr).join('').replace(/^ +| +$/g, '');
        if (open.length === 1 && !/[\n\u0001]/.test(run) && (pad(level) + open[0].trim() + run.replace(/\u0002/g, ' ') + close).length <= width) {
          lines.push(open[0] + run.replace(/\u0002/g, ' ') + close);
          return;
        }
        open.forEach(l => lines.push(l));
        runLines(kids, level + 1).forEach(l => lines.push(l));
        if (close) lines.push(pad(level) + close);
        return;
      }
      open.forEach(l => lines.push(l));
      children(kids, level + 1);
      if (close) lines.push(pad(level) + close);
    }

    children(tree.children, 0);
    return lines.join('\n').replace(/[ \t]+$/gm, '') + '\n';
  }

  function minify(src) {
    const tree = parse(src);
    function tidy(list) {
      const out = [];
      list.forEach(c => {
        if (c.type === 'comment' && !/^<!--(\[if|!)/i.test(c.v)) return;
        const l = out[out.length - 1];
        if (c.type === 'text' && l && l.type === 'text') out[out.length - 1] = { type: 'text', v: l.v + c.v };
        else out.push(c);
      });
      return out;
    }
    function kids(list0, blockParent) {
      const list = tidy(list0);
      let out = '';
      list.forEach((c, i) => {
        if (c.type === 'text') {
          let t = collapse(c.v);
          const prev = list[i - 1], next = list[i + 1];
          const prevBlock = prev ? !(prev.type === 'text' || (prev.type === 'el' && inlineLevel(prev))) : blockParent;
          const nextBlock = next ? !(next.type === 'text' || (next.type === 'el' && inlineLevel(next))) : blockParent;
          if (prevBlock) t = t.replace(/^ /, '');
          if (nextBlock) t = t.replace(/ $/, '');
          out += t;
        } else if (c.type === 'comment') {
          if (/^<!--(\[if|!)/i.test(c.v)) out += c.v;
        } else if (c.type === 'el') out += el(c);
        else out += c.v;
      });
      return out;
    }
    function el(n) {
      if (n.selfClose || n.isVoid) return tagOpen(n);
      if (n.lname === 'pre') return tagOpen(n) + n.raw + tagClose(n);
      if (isRawEl(n)) {
        const emb = n.lname === 'textarea' ? null : embedded(n, 'min', {});
        return tagOpen(n) + (emb === null ? n.raw : emb) + tagClose(n);
      }
      return tagOpen(n) + kids(n.children, !inlineLevel(n)) + tagClose(n);
    }
    return kids(tree.children, true).trim();
  }

  const api = { parse, format, minify };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTMLCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
