(function (root) {
  'use strict';

  function splitLines(text) {
    if (text === '') return [];
    const l = text.split(/\r\n|\r|\n/);
    if (l.length && l[l.length - 1] === '') l.pop();
    return l;
  }

  function keyOf(line, o) {
    let k = line;
    if (o.ignoreCase) k = k.toLowerCase();
    if (o.ignoreSpace) k = k.replace(/\s+/g, ' ').trim();
    return k;
  }

  function myers(a, b, maxD) {
    const n = a.length, m = b.length, max = n + m;
    if (!max) return [];
    const off = max + 1, v = new Int32Array(2 * max + 3), trace = [];
    const cap = Math.min(max, maxD);
    let found = -1;
    for (let d = 0; d <= cap && found < 0; d++) {
      trace.push(v.slice(off - d, off + d + 2));
      for (let k = -d; k <= d; k += 2) {
        let x;
        if (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) x = v[off + k + 1];
        else x = v[off + k - 1] + 1;
        let y = x - k;
        while (x < n && y < m && a[x] === b[y]) { x++; y++; }
        v[off + k] = x;
        if (x >= n && y >= m) { found = d; break; }
      }
    }
    if (found < 0) return null;
    const ops = [];
    let x = n, y = m;
    for (let d = found; d > 0; d--) {
      const vv = trace[d], get = k => vv[k + d];
      const k = x - y;
      const down = k === -d || (k !== d && get(k - 1) < get(k + 1));
      const prevK = down ? k + 1 : k - 1;
      const px = get(prevK), py = px - prevK;
      const mx = down ? px : px + 1, my = down ? py + 1 : py;
      while (x > mx && y > my) { x--; y--; ops.push(['=', x, y]); }
      if (down) ops.push(['+', px, py]); else ops.push(['-', px, py]);
      x = px; y = py;
    }
    while (x > 0 && y > 0) { x--; y--; ops.push(['=', x, y]); }
    return ops.reverse();
  }

  function lineOps(A, B, o) {
    const ka = A.map(l => keyOf(l, o)), kb = B.map(l => keyOf(l, o));
    let s = 0;
    while (s < ka.length && s < kb.length && ka[s] === kb[s]) s++;
    let ea = ka.length, eb = kb.length;
    while (ea > s && eb > s && ka[ea - 1] === kb[eb - 1]) { ea--; eb--; }
    const ops = [];
    for (let i = 0; i < s; i++) ops.push(['=', i, i]);
    let mid = null, coarse = false;
    if (ea > s && eb > s) {
      const id = new Map();
      const conv = arr => arr.map(x => { if (!id.has(x)) id.set(x, id.size); return id.get(x); });
      mid = myers(conv(ka.slice(s, ea)), conv(kb.slice(s, eb)), 2500);
      coarse = !mid;
    }
    if (mid) mid.forEach(([t, x, y]) => ops.push([t, x + s, y + s]));
    else {
      for (let i = s; i < ea; i++) ops.push(['-', i, -1]);
      for (let j = s; j < eb; j++) ops.push(['+', -1, j]);
    }
    for (let i = ea, j = eb; i < ka.length; i++, j++) ops.push(['=', i, j]);
    return { ops, coarse };
  }

  const TOK = /[\p{L}\p{N}_$]+|\s+|[^\s\p{L}\p{N}_$]/gu;

  function inline(a, b, o) {
    const ta = a.match(TOK) || [], tb = b.match(TOK) || [];
    const norm = t => (o.ignoreCase ? t.toLowerCase() : t);
    const ka = ta.map(norm), kb = tb.map(norm);
    let s = 0;
    while (s < ka.length && s < kb.length && ka[s] === kb[s]) s++;
    let ea = ka.length, eb = kb.length;
    while (ea > s && eb > s && ka[ea - 1] === kb[eb - 1]) { ea--; eb--; }
    const n = ea - s, m = eb - s;
    const markA = new Array(ta.length).fill(false), markB = new Array(tb.length).fill(false);
    if (n && m && n * m <= 160000) {
      const w = m + 1, L = new Uint16Array((n + 1) * w);
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
        L[i * w + j] = ka[s + i] === kb[s + j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
      }
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (ka[s + i] === kb[s + j]) { i++; j++; }
        else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) markA[s + i++] = true;
        else markB[s + j++] = true;
      }
      while (i < n) markA[s + i++] = true;
      while (j < m) markB[s + j++] = true;
    } else {
      for (let i = s; i < ea; i++) markA[i] = true;
      for (let j = s; j < eb; j++) markB[j] = true;
    }
    const seg = (toks, marks) => {
      const out = [];
      toks.forEach((t, i) => {
        const last = out[out.length - 1];
        if (last && last.m === marks[i]) last.t += t;
        else out.push({ t, m: marks[i] });
      });
      return out;
    };
    return { a: seg(ta, markA), b: seg(tb, markB) };
  }

  function words(s) {
    return (s.match(TOK) || []).filter(t => /\S/.test(t));
  }

  function similar(a, b) {
    const wa = words(a), wb = words(b);
    if (!wa.length || !wb.length) return false;
    const set = new Set(wa);
    let hit = 0;
    wb.forEach(t => { if (set.has(t)) hit++; });
    return hit / Math.max(wa.length, wb.length) >= 0.4;
  }

  function similarAhead(A, B, dels, adds, p, q) {
    for (let j = q; j < Math.min(adds.length, q + 3); j++) if (similar(A[dels[p]], B[adds[j]])) return true;
    return false;
  }

  function diff(textA, textB, opts) {
    const o = Object.assign({ ignoreCase: false, ignoreSpace: false, ignoreBlank: false }, opts || {});
    const A = splitLines(textA), B = splitLines(textB);
    let ia = A.map((_, i) => i), ib = B.map((_, i) => i);
    if (o.ignoreBlank) {
      ia = ia.filter(i => A[i].trim() !== '');
      ib = ib.filter(i => B[i].trim() !== '');
    }
    const sub = lineOps(ia.map(i => A[i]), ib.map(i => B[i]), o);
    let ops = sub.ops.map(([t, x, y]) => (t === '=' ? ['=', ia[x], ib[y]] : t === '-' ? ['-', ia[x], -1] : ['+', -1, ib[y]]));
    if (o.ignoreBlank) {
      const full = [];
      let ca = 0, cb = 0;
      const flush = (ta, tb) => {
        while (ca < ta && cb < tb) full.push(['=', ca++, cb++]);
        while (ca < ta) full.push(['-', ca++, -1]);
        while (cb < tb) full.push(['+', -1, cb++]);
      };
      ops.forEach(([t, x, y]) => {
        if (t === '=') { flush(x, y); full.push(['=', x, y]); ca = x + 1; cb = y + 1; }
        else if (t === '-') { flush(x, cb); full.push(['-', x, -1]); ca = x + 1; }
        else { flush(ca, y); full.push(['+', -1, y]); cb = y + 1; }
      });
      flush(A.length, B.length);
      ops = full;
    }
    const rows = [];
    let i = 0;
    while (i < ops.length) {
      if (ops[i][0] === '=') { rows.push({ k: 'eq', a: ops[i][1], b: ops[i][2], la: A[ops[i][1]], lb: B[ops[i][2]] }); i++; continue; }
      const dels = [], adds = [];
      while (i < ops.length && ops[i][0] !== '=') {
        if (ops[i][0] === '-') dels.push(ops[i][1]); else adds.push(ops[i][2]);
        i++;
      }
      let p = 0, q = 0;
      while (p < dels.length || q < adds.length) {
        if (p < dels.length && q < adds.length && similar(A[dels[p]], B[adds[q]])) {
          const r = inline(A[dels[p]], B[adds[q]], o);
          rows.push({ k: 'chg', a: dels[p], b: adds[q], la: A[dels[p]], lb: B[adds[q]], sa: r.a, sb: r.b });
          p++; q++;
        } else if (p < dels.length && (q >= adds.length || !similarAhead(A, B, dels, adds, p, q))) {
          rows.push({ k: 'del', a: dels[p], b: -1, la: A[dels[p]], blank: o.ignoreBlank && A[dels[p]].trim() === '' });
          p++;
        } else {
          rows.push({ k: 'add', a: -1, b: adds[q], lb: B[adds[q]], blank: o.ignoreBlank && B[adds[q]].trim() === '' });
          q++;
        }
      }
    }
    const stats = { add: 0, del: 0, chg: 0, same: 0 };
    rows.forEach(r => {
      if (r.blank) return;
      if (r.k === 'add') stats.add++;
      else if (r.k === 'del') stats.del++;
      else if (r.k === 'chg') stats.chg++;
      else stats.same++;
    });
    return { rows, stats, coarse: sub.coarse, A, B, identical: stats.add + stats.del + stats.chg === 0 };
  }

  function collapse(rows, ctx, expanded) {
    if (ctx < 0) return rows.slice();
    const keep = new Array(rows.length).fill(false);
    rows.forEach((r, i) => {
      if (r.k !== 'eq' && !r.blank) for (let j = Math.max(0, i - ctx); j <= Math.min(rows.length - 1, i + ctx); j++) keep[j] = true;
    });
    const out = [];
    let i = 0;
    while (i < rows.length) {
      if (keep[i]) { out.push(rows[i]); i++; continue; }
      let j = i;
      while (j < rows.length && !keep[j]) j++;
      const id = i + ':' + j;
      if (expanded && expanded.has(id)) for (let k = i; k < j; k++) out.push(rows[k]);
      else out.push({ k: 'gap', id, count: j - i });
      i = j;
    }
    return out;
  }

  function unified(res, ctx, nameA, nameB) {
    if (res.identical) return '';
    const flat = [];
    res.rows.forEach(r => {
      if (r.k === 'eq') flat.push([' ', r.la, r.a, r.b]);
      else if (r.k === 'del') flat.push(r.blank ? [' ', r.la, r.a, -1] : ['-', r.la, r.a, -1]);
      else if (r.k === 'add') { if (!r.blank) flat.push(['+', r.lb, -1, r.b]); }
      else { flat.push(['-', r.la, r.a, -1]); flat.push(['+', r.lb, -1, r.b]); }
    });
    const preA = [0], preB = [0];
    flat.forEach(f => {
      preA.push(preA[preA.length - 1] + (f[0] !== '+' ? 1 : 0));
      preB.push(preB[preB.length - 1] + (f[0] !== '-' ? 1 : 0));
    });
    const ranges = [];
    flat.forEach((f, i) => {
      if (f[0] === ' ') return;
      const s = Math.max(0, i - ctx), e = Math.min(flat.length, i + ctx + 1);
      const last = ranges[ranges.length - 1];
      if (last && s <= last[1]) last[1] = Math.max(last[1], e);
      else ranges.push([s, e]);
    });
    const out = ['--- ' + nameA, '+++ ' + nameB];
    ranges.forEach(([s, e]) => {
      const ca = preA[e] - preA[s], cb = preB[e] - preB[s];
      out.push('@@ -' + (ca ? preA[s] + 1 : preA[s]) + ',' + ca + ' +' + (cb ? preB[s] + 1 : preB[s]) + ',' + cb + ' @@');
      for (let k = s; k < e; k++) out.push(flat[k][0] + flat[k][1]);
    });
    return out.join('\n') + '\n';
  }

  const api = { diff, collapse, unified, splitLines, myers };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DiffCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
