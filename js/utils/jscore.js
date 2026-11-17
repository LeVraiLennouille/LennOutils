(function (root) {
  'use strict';

  function lineCol(src, pos) {
    let line = 1, last = -1;
    for (let i = 0; i < pos && i < src.length; i++) if (src[i] === '\n') { line++; last = i; }
    return { line, col: pos - last };
  }

  function fail(src, pos, msg) {
    const lc = lineCol(src, pos);
    const e = new Error(msg + ' (ligne ' + lc.line + ', colonne ' + lc.col + ')');
    e.pos = pos; e.line = lc.line; e.col = lc.col;
    return e;
  }

  const PUNCT = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '**'];
  const REGEX_AFTER = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await', 'extends']);
  const ID_START = /[A-Za-z_$\u0080-\uffff\\#]/;
  const ID_PART = /[A-Za-z0-9_$\u0080-\uffff\\]/;
  const NUM = /^(?:0[xX][0-9a-fA-F_]+n?|0[bB][01_]+n?|0[oO][0-7_]+n?|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?n?)/;

  function templateEnd(src, i) {
    const n = src.length;
    let j = i + 1;
    while (j < n) {
      const c = src[j];
      if (c === '\\') j += 2;
      else if (c === '`') return j + 1;
      else if (c === '$' && src[j + 1] === '{') j = exprEnd(src, j + 2);
      else j++;
    }
    throw fail(src, i, 'Gabarit (template literal) non fermé');
  }

  function exprEnd(src, j) {
    const n = src.length;
    let depth = 1;
    while (j < n) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (!depth) return j + 1; }
      else if (c === '"' || c === "'") {
        j++;
        while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      } else if (c === '`') { j = templateEnd(src, j); continue; }
      else if (c === '/' && src[j + 1] === '/') { while (j < n && src[j] !== '\n') j++; continue; }
      else if (c === '/' && src[j + 1] === '*') { const e = src.indexOf('*/', j + 2); j = e < 0 ? n : e + 1; }
      j++;
    }
    throw fail(src, j, 'Expression ${…} non fermée');
  }

  function tokenize(src) {
    const toks = [];
    const n = src.length;
    let i = 0, nl = 0, prev = null;
    const regexOk = () => {
      if (!prev) return true;
      if (prev.t === 'p') return !(prev.v === ')' || prev.v === ']' || prev.v === '}' || prev.v === '++' || prev.v === '--');
      if (prev.t === 'id') return REGEX_AFTER.has(prev.v);
      return false;
    };
    const push = (t, v, pos) => {
      const tok = { t, v, pos, nl: nl > 0, blank: nl > 1 };
      toks.push(tok);
      nl = 0;
      if (t !== 'cm') prev = tok;
      return tok;
    };
    if (src.startsWith('#!')) { while (i < n && src[i] !== '\n') i++; push('cm', src.slice(0, i), 0).line = true; }
    while (i < n) {
      const c = src[i];
      if (c === '\n') { nl++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r' || c === '\ufeff' || c === '\u00a0' || c === '\u2028' || c === '\u2029' || c === '\f' || c === '\v') { i++; continue; }
      const s = i;
      if (c === '/' && src[i + 1] === '/') {
        while (i < n && src[i] !== '\n') i++;
        push('cm', src.slice(s, i).replace(/\r$/, ''), s).line = true;
        continue;
      }
      if (c === '/' && src[i + 1] === '*') {
        const e = src.indexOf('*/', i + 2);
        if (e < 0) throw fail(src, i, 'Commentaire /* non fermé');
        i = e + 2;
        const tk = push('cm', src.slice(s, i), s);
        tk.line = false;
        tk.multi = tk.v.includes('\n');
        continue;
      }
      if (c === '"' || c === "'") {
        i++;
        while (i < n && src[i] !== c) {
          if (src[i] === '\\') i++;
          else if (src[i] === '\n') throw fail(src, s, 'Chaîne non fermée');
          i++;
        }
        if (i >= n) throw fail(src, s, 'Chaîne non fermée');
        i++;
        push('str', src.slice(s, i), s);
        continue;
      }
      if (c === '`') { i = templateEnd(src, i); push('tpl', src.slice(s, i), s); continue; }
      if ((c >= '0' && c <= '9') || (c === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
        const m = NUM.exec(src.slice(i, i + 80));
        i += m[0].length;
        push('num', m[0], s);
        continue;
      }
      if (ID_START.test(c)) {
        i++;
        while (i < n && ID_PART.test(src[i])) i++;
        push('id', src.slice(s, i), s);
        continue;
      }
      if (c === '/' && regexOk()) {
        i++;
        let cls = false;
        while (i < n) {
          const d = src[i];
          if (d === '\n') throw fail(src, s, 'Expression régulière non fermée');
          if (d === '\\') { i += 2; continue; }
          if (d === '[') cls = true;
          else if (d === ']') cls = false;
          else if (d === '/' && !cls) break;
          i++;
        }
        if (i >= n) throw fail(src, s, 'Expression régulière non fermée');
        i++;
        while (i < n && /[A-Za-z]/.test(src[i])) i++;
        push('re', src.slice(s, i), s);
        continue;
      }
      let p = null;
      for (const q of PUNCT) {
        if (src.startsWith(q, i)) {
          if (q === '?.' && src[i + 2] >= '0' && src[i + 2] <= '9') continue;
          p = q; break;
        }
      }
      if (!p) p = c;
      i += p.length;
      push('p', p, s);
    }
    return toks;
  }

  const NOEND = new Set(['{', '(', '[', ',', ';', ':', '?', '=', '=>', '+', '-', '*', '/', '%', '&', '|', '^', '!', '~', '<', '>', '.', '?.', '...', '&&', '||', '??', '==', '===', '!=', '!==', '<=', '>=', '<<', '>>', '>>>', '**', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>=', '**=', '&&=', '||=', '??=']);
  const NOEND_KW = new Set(['else', 'do', 'try', 'finally', 'typeof', 'void', 'delete', 'new', 'in', 'of', 'instanceof', 'case', 'default', 'extends']);
  const CONT = new Set([')', ']', '}', ',', ';', '.', '?.', ':', '?', '=', '=>', '&&', '||', '??', '==', '===', '!=', '!==', '<=', '>=', '<', '>', '<<', '>>', '>>>', '*', '/', '%', '&', '|', '^', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>=', '**=', '**', '&&=', '||=', '??=', '(', '[', '+', '-']);
  const CONT_KW = new Set(['catch', 'finally', 'in', 'of', 'instanceof']);
  const RESTRICTED = new Set(['return', 'break', 'continue', 'throw', 'yield']);
  const HEAD_KW = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'function']);

  function keepNewline(p, t, headClose) {
    if (p.t === 'id' && RESTRICTED.has(p.v)) return true;
    if (p.t === 'p' && NOEND.has(p.v)) return false;
    if (p.t === 'id' && NOEND_KW.has(p.v)) return false;
    if (t.t === 'p' && CONT.has(t.v)) return false;
    if (t.t === 'tpl') return false;
    if (t.t === 'id' && CONT_KW.has(t.v)) return false;
    if (headClose && p.t === 'p' && p.v === ')' && t.t === 'p' && t.v === '{') return false;
    return true;
  }

  const isWord = c => /[A-Za-z0-9_$\\#\u0080-\uffff]/.test(c);

  function needSpace(p, t) {
    const a = p.v[p.v.length - 1], b = t.v[0];
    if (isWord(a) && isWord(b)) return true;
    if ((a === '+' && b === '+') || (a === '-' && b === '-')) return true;
    if (a === '/' && (b === '/' || b === '*')) return true;
    if (p.t === 'num' && b === '.' && /^\d+$/.test(p.v)) return true;
    if (p.t === 'p' && p.v === '<' && t.v.startsWith('!--')) return true;
    return false;
  }

  function keepComment(v) {
    return /^\/\*[!*]/.test(v) && /^\/\*!|@license|@preserve|@cc_on/.test(v);
  }

  function minify(src) {
    const toks = tokenize(src);
    let out = '', prev = null, carry = false, noSep = false;
    const parens = [];
    let headClose = false, prev2 = null;
    toks.forEach(t => {
      if (t.t === 'cm') {
        if (keepComment(t.v)) {
          if (out && !out.endsWith('\n')) out += '\n';
          out += t.v + '\n';
          prev = null; noSep = true; carry = false;
        } else carry = carry || t.nl || !!t.multi;
        return;
      }
      const nlEff = t.nl || carry;
      carry = false;
      if (prev && !noSep) {
        if (nlEff && keepNewline(prev, t, headClose)) out += '\n';
        else if (needSpace(prev, t)) out += ' ';
      }
      noSep = false;
      out += t.v;
      headClose = false;
      if (t.t === 'p' && t.v === '(') {
        parens.push(!!prev && prev.t === 'id' && (HEAD_KW.has(prev.v) || (!!prev2 && prev2.t === 'id' && prev2.v === 'function')));
      } else if (t.t === 'p' && t.v === ')') headClose = !!parens.pop();
      prev2 = prev;
      prev = t;
    });
    return out.replace(/\n+$/, '');
  }

  function indentUnit(o) {
    return o && o.indent === 'tab' ? '\t' : ' '.repeat(o && o.indent ? +o.indent : 2);
  }

  const OBJ_AFTER_KW = new Set(['return', 'typeof', 'void', 'delete', 'await', 'yield', 'in', 'of', 'instanceof', 'new', 'throw', 'default', 'import', 'export', 'const', 'let', 'var']);
  const UNARY_AFTER_KW = new Set(['return', 'typeof', 'case', 'in', 'of', 'instanceof', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'else', 'do', 'extends', 'default']);
  const SPACE_PAREN_KW = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'typeof', 'void', 'delete', 'await', 'yield', 'in', 'of', 'case', 'throw', 'else', 'do', 'function', 'async', 'instanceof', 'extends', 'default']);
  const BIN_NOSPACE = new Set(['.', '?.']);

  function beautify(src, o) {
    const unit = indentUnit(o);
    const toks = tokenize(src);
    const n = toks.length;
    const match = new Array(n).fill(-1);
    const stack = [];
    toks.forEach((t, i) => {
      if (t.t !== 'p') return;
      if (t.v === '(' || t.v === '[' || t.v === '{') stack.push(i);
      else if (t.v === ')' || t.v === ']' || t.v === '}') {
        const j = stack.pop();
        if (j === undefined) throw fail(src, t.pos, 'Fermeture « ' + t.v + ' » sans ouverture correspondante');
        const want = { '(': ')', '[': ']', '{': '}' }[toks[j].v];
        if (want !== t.v) throw fail(src, t.pos, 'Fermeture « ' + t.v + ' » inattendue : « ' + want + ' » était attendu');
        match[j] = i; match[i] = j;
      }
    });
    if (stack.length) throw fail(src, toks[stack[0]].pos, 'Ouverture « ' + toks[stack[0]].v + ' » jamais fermée');

    const sig = new Array(n).fill(-1);
    let lastSig = -1;
    toks.forEach((t, i) => { sig[i] = lastSig; if (t.t !== 'cm') lastSig = i; });

    const hasSemiTop = i => {
      for (let j = i + 1; j < match[i]; j++) {
        if (toks[j].t === 'p') {
          if (toks[j].v === ';') return true;
          if (toks[j].v === '(' || toks[j].v === '[' || toks[j].v === '{') j = match[j];
        }
      }
      return false;
    };

    const braceKind = i => {
      const pi = sig[i];
      if (pi < 0) return 'block';
      const p = toks[pi];
      let k;
      if (p.t === 'p') k = (p.v === ')' || p.v === '=>' || p.v === '{' || p.v === '}' || p.v === ';') ? 'block' : 'obj';
      else if (p.t === 'id') k = OBJ_AFTER_KW.has(p.v) ? 'obj' : 'block';
      else k = 'block';
      if (k === 'obj' && hasSemiTop(i)) k = 'block';
      return k;
    };

    const isUnaryAt = i => {
      const pi = sig[i];
      if (pi < 0) return true;
      const p = toks[pi];
      if (p.t === 'p') {
        if (p.v === ')' || p.v === ']' || p.v === '}') return false;
        if (p.v === '++' || p.v === '--') return !isPostfix(pi);
        return true;
      }
      if (p.t === 'id') return UNARY_AFTER_KW.has(p.v);
      return false;
    };

    const isPostfix = i => {
      const t = toks[i];
      const pi = sig[i];
      if (pi < 0 || t.nl) return false;
      const p = toks[pi];
      return (p.t === 'id' && !UNARY_AFTER_KW.has(p.v)) || (p.t === 'p' && (p.v === ')' || p.v === ']'));
    };

    const lines = [];
    let cur = '', atStart = true, level = 0, pendingNl = false, blankReq = false, lastKept = null;
    const frames = [{ kind: 'top', ternary: 0, expanded: true }];
    const top = () => frames[frames.length - 1];
    const flush = () => { if (cur.trim() !== '') lines.push(cur.replace(/\s+$/, '')); cur = ''; atStart = true; };
    const wantBlank = t => { if (t.blank) blankReq = true; };

    const prevTok = i => (sig[i] >= 0 ? toks[sig[i]] : null);
    const unaryOps = new Set(['!', '~', '...', '#', '@']);

    function spaceBefore(i, p, t) {
      const f = top();
      if (!p) return false;
      const pi = sig[i];
      const pUn = p.t === 'p' && (unaryOps.has(p.v) || ((p.v === '+' || p.v === '-' || p.v === '*') && isUnaryAt(pi)) || ((p.v === '++' || p.v === '--') && !isPostfix(pi)));
      if (p.t === 'p' && (p.v === '(' || p.v === '[')) return false;
      if (p.t === 'p' && p.v === '{' && f.kind === 'obj' && !f.expanded) return !(t.t === 'p' && t.v === '}');
      if (t.t === 'p') {
        if (t.v === ')' || t.v === ']') return false;
        if (t.v === ',' || t.v === ';') return false;
        if (t.v === '}' && f.kind === 'obj' && !f.expanded) return !(p.t === 'p' && p.v === '{');
        if (BIN_NOSPACE.has(t.v)) return !(p.t === 'num' && /^\d+$/.test(p.v)) ? false : true;
        if (t.v === '++' || t.v === '--') { if (isPostfix(i)) return false; }
        if (t.v === ':') return f.ternary > 0;
        if (t.v === '(') {
          if (p.t === 'id') return SPACE_PAREN_KW.has(p.v);
          if (p.t === 'p') return !(p.v === ')' || p.v === ']' || p.v === '}') && !pUn && !BIN_NOSPACE.has(p.v) ? true : false;
          return p.t !== 'str' && p.t !== 'num' && p.t !== 'tpl' ? true : false;
        }
        if (t.v === '[') {
          if (p.t === 'id') return UNARY_AFTER_KW.has(p.v);
          if (p.t === 'str' || p.t === 'tpl') return false;
          if (p.t === 'p') return !(p.v === ')' || p.v === ']') && !pUn && !BIN_NOSPACE.has(p.v);
        }
        if (t.v === '{') return !(p.t === 'p' && (p.v === '(' || p.v === '['));
        if (t.v === '*' && p.t === 'id' && (p.v === 'function' || p.v === 'yield')) return false;
        if (t.v === '#' || t.v === '@') return !pUn && !BIN_NOSPACE.has(p.v);
      }
      if (t.t === 'tpl' && (p.t === 'id' ? !UNARY_AFTER_KW.has(p.v) : (p.t === 'p' && (p.v === ')' || p.v === ']')))) return false;
      if (p.t === 'p') {
        if (BIN_NOSPACE.has(p.v)) return false;
        if (pUn) {
          if ((p.v === '+' || p.v === '-') && t.t === 'p' && t.v[0] === p.v) return true;
          return false;
        }
        if (p.v === ';' && (f.kind === 'paren') && t.t === 'p' && t.v === ';') return false;
      }
      if (needSpace(p, t) && !(p.t === 'p' || t.t === 'p')) return true;
      return true;
    }

    function openLine(t) {
      if (pendingNl) {
        flush();
        if (blankReq && lines.length) lines.push('');
      }
      pendingNl = false; blankReq = false;
      void t;
    }

    function write(i, text) {
      const t = toks[i], p = prevTok(i);
      const wasPending = pendingNl;
      openLine(t);
      if (atStart) {
        if (lastKept === 'comment-line' && !wasPending) { }
        cur = unit.repeat(Math.max(0, level)) + text;
        atStart = false;
      } else {
        if (spaceBefore(i, p, t) || (lastKept === 'bc' && true)) cur += ' ';
        cur += text;
      }
      lastKept = null;
    }

    function breakBefore(i) {
      const t = toks[i], p = prevTok(i), f = top();
      if (!p || pendingNl) return;
      if (!t.nl) return;
      if (f.kind === 'paren' || f.kind === 'arr' || (f.kind === 'obj' && !f.expanded)) return;
      if (f.kind === 'obj' && f.expanded) return;
      if (keepNewline(p, t, false)) { pendingNl = true; wantBlank(t); }
    }

    for (let i = 0; i < n; i++) {
      const t = toks[i], f = top();
      if (t.t === 'cm') {
        const p = prevTok(i);
        const onOwnLine = t.nl || !p || pendingNl;
        if (onOwnLine) { if (!atStart || pendingNl) { pendingNl = true; } wantBlank(t); }
        if (t.line || t.multi) {
          if (onOwnLine) {
            openLine(t);
            if (t.multi) {
              const ls = t.v.split('\n');
              cur = unit.repeat(Math.max(0, level)) + ls[0].trim();
              flush();
              ls.slice(1).forEach((l, k) => {
                const tr = l.trim();
                lines.push(tr.startsWith('*') ? unit.repeat(Math.max(0, level)) + ' ' + tr : unit.repeat(Math.max(0, level)) + tr);
                void k;
              });
              atStart = true;
              cur = '';
            } else { cur = unit.repeat(Math.max(0, level)) + t.v; flush(); }
            pendingNl = false;
          } else {
            if (atStart) cur = unit.repeat(Math.max(0, level)) + t.v; else cur += ' ' + t.v;
            if (t.line) { flush(); }
            else if (t.multi) { flush(); }
          }
        } else {
          if (onOwnLine) { openLine(t); cur = unit.repeat(Math.max(0, level)) + t.v; atStart = false; lastKept = 'bc'; pendingNl = false; if (toks[i + 1] && toks[i + 1].nl) { flush(); } }
          else { cur += ' ' + t.v; lastKept = null; }
        }
        continue;
      }
      breakBefore(i);
      const v = t.v;

      if (t.t === 'p' && (v === '{' || v === '(' || v === '[')) {
        const ni = i + 1, close = match[i];
        if (v === '(') {
          write(i, '(');
          frames.push({ kind: 'paren', ternary: 0, close, head: sig[i] >= 0 && toks[sig[i]].t === 'id' && toks[sig[i]].v === 'switch' });
        } else if (v === '[' || (v === '{' && braceKind(i) === 'obj')) {
          const isObj = v === '{';
          let width = 0, complex = false;
          for (let j = ni; j < close; j++) {
            width += toks[j].v.length + 1;
            if (toks[j].t === 'cm') complex = true;
            if (toks[j].t === 'p' && toks[j].v === '{' && braceKind(j) === 'block') complex = true;
          }
          const empty = close === ni;
          const expanded = !empty && (complex || width > (isObj ? 60 : 80) || (toks[ni].nl && (isObj || width > 40)));
          write(i, v);
          frames.push({ kind: isObj ? 'obj' : 'arr', ternary: 0, expanded, close });
          if (expanded) { level++; pendingNl = true; wantBlank(toks[ni]); blankReq = false; }
        } else {
          const prevT = prevTok(i);
          const head = sig[i] >= 0 && toks[sig[i]].t === 'p' && toks[sig[i]].v === ')';
          let sw = false;
          if (head) {
            const open = match[sig[i]], before = open > 0 ? sig[open] : -1;
            if (before >= 0 && toks[before].t === 'id' && toks[before].v === 'switch') sw = true;
          }
          const isDo = !!prevT && prevT.t === 'id' && prevT.v === 'do';
          write(i, '{');
          if (close === ni) {
            cur += '}';
            i = close;
            const nx = toks[i + 1];
            afterClose(i, nx, 'block', false);
            continue;
          }
          frames.push({ kind: 'block', ternary: 0, sw, inCase: false, expectColon: false, isDo, close });
          level++;
          pendingNl = true;
          wantBlank(toks[ni]); blankReq = false;
        }
        continue;
      }

      if (t.t === 'p' && (v === ')' || v === ']' || v === '}')) {
        if (v === '}' && f.kind === 'block') {
          if (f.sw && f.inCase) level--;
          level--;
          frames.pop();
          flush();
          pendingNl = false;
          cur = unit.repeat(Math.max(0, level)) + '}';
          atStart = false;
          afterClose(i, toks[i + 1], 'block', f.isDo);
          continue;
        }
        if (f.expanded) { level--; frames.pop(); flush(); pendingNl = false; cur = unit.repeat(Math.max(0, level)) + v; atStart = false; afterClose(i, toks[i + 1], f.kind, false); continue; }
        frames.pop();
        write(i, v);
        afterClose(i, toks[i + 1], f.kind, false);
        continue;
      }

      if (t.t === 'p' && v === ';') {
        write(i, ';');
        if (f.kind === 'block' || f.kind === 'top') { pendingNl = true; const nx = toks[i + 1]; if (nx) wantBlank(nx); }
        continue;
      }

      if (t.t === 'p' && v === ',') {
        write(i, ',');
        if ((f.kind === 'obj' || f.kind === 'arr') && f.expanded) { pendingNl = true; const nx = toks[i + 1]; if (nx && nx.blank) blankReq = true; }
        continue;
      }

      if (t.t === 'p' && v === '?') { write(i, '?'); f.ternary++; continue; }

      if (t.t === 'p' && v === ':') {
        if (f.ternary > 0) { write(i, ':'); f.ternary--; continue; }
        if (f.kind === 'block' && f.sw && f.expectColon) {
          write(i, ':');
          f.expectColon = false; f.inCase = true; level++; pendingNl = true;
          continue;
        }
        write(i, ':');
        continue;
      }

      if (t.t === 'id' && (v === 'case' || v === 'default') && f.kind === 'block' && f.sw && (atStart || pendingNl) && !(v === 'default' && false)) {
        if (f.inCase) { level--; f.inCase = false; }
        pendingNl = true;
        f.expectColon = true;
        write(i, v);
        continue;
      }

      write(i, v);
    }

    function afterClose(i, nx, kind, isDo) {
      const f = top();
      if (!nx) { pendingNl = true; return; }
      if (nx.t === 'cm' && !nx.nl) return;
      const cont = nx.t === 'p' && (nx.v === ')' || nx.v === ']' || nx.v === ',' || nx.v === ';' || nx.v === '.' || nx.v === '?.');
      if (kind === 'block') {
        if (cont) return;
        if (nx.t === 'id' && (nx.v === 'else' || nx.v === 'catch' || nx.v === 'finally' || (nx.v === 'while' && isDo))) return;
        if (nx.t === 'p' && (nx.v === '(' || nx.v === '[') && !nx.nl && f.kind !== 'block' && f.kind !== 'top') return;
        pendingNl = true;
        wantBlank(nx);
        return;
      }
      if (cont) return;
      if (f.kind === 'block' || f.kind === 'top') {
        if (nx.nl && keepNewline(toks[i], nx, false)) { pendingNl = true; wantBlank(nx); }
      }
    }

    flush();
    return lines.join('\n') + '\n';
  }

  const api = { tokenize, minify, beautify };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JSCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
