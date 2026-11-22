(function (root) {
  'use strict';

  function parseDelimited(text, delimiter) {
    text = text.replace(/^\ufeff/, '');
    const delim = !delimiter || delimiter === 'auto' ? detectDelimiter(text) : delimiter;
    const rows = [];
    let row = [], cell = '', i = 0, q = false, started = false;
    const n = text.length;
    const endCell = () => { row.push(cell); cell = ''; started = false; };
    const endRow = () => { endCell(); rows.push(row); row = []; };
    while (i < n) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        cell += c; i++; continue;
      }
      if (c === '"' && !started && cell === '') { q = true; started = true; i++; continue; }
      if (c === delim) { endCell(); i++; continue; }
      if (c === '\r') { endRow(); i += text[i + 1] === '\n' ? 2 : 1; continue; }
      if (c === '\n') { endRow(); i++; continue; }
      cell += c; started = true; i++;
    }
    if (q) throw new Error('Guillemet ouvrant sans guillemet fermant : vérifiez les champs entre guillemets.');
    if (cell !== '' || row.length) endRow();
    while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
    return { rows, delimiter: delim };
  }

  function detectDelimiter(text) {
    const lines = text.replace(/^\ufeff/, '').split(/\r\n|\r|\n/).filter(l => l.trim()).slice(0, 8);
    let best = ',', score = -1;
    [',', ';', '\t', '|'].forEach(d => {
      const counts = lines.map(l => {
        let n = 0, q = false;
        for (let i = 0; i < l.length; i++) { if (l[i] === '"') q = !q; else if (l[i] === d && !q) n++; }
        return n;
      });
      if (!counts.length || counts[0] === 0) return;
      const same = counts.filter(c => c === counts[0]).length;
      const s = same * 1000 + counts[0];
      if (s > score) { score = s; best = d; }
    });
    return best;
  }

  function parseMarkdown(text) {
    const lines = text.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
    const rows = [];
    lines.forEach(l => {
      if (!/^\|/.test(l) && l.indexOf('|') < 0) throw new Error('Ce texte ne ressemble pas à un tableau Markdown.');
      if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(l)) return;
      let t = l.replace(/^\|/, '').replace(/\|$/, '');
      const cells = [];
      let cur = '';
      for (let i = 0; i < t.length; i++) {
        if (t[i] === '\\' && t[i + 1] === '|') { cur += '|'; i++; } else if (t[i] === '|') { cells.push(cur.trim()); cur = ''; } else cur += t[i];
      }
      cells.push(cur.trim());
      rows.push(cells);
    });
    return { rows };
  }

  function parseJSON(text) {
    let v;
    try { v = JSON.parse(text); } catch (e) { throw new Error('JSON invalide : ' + e.message); }
    let headers = [], rows = [];
    if (Array.isArray(v)) {
      if (v.every(x => x && typeof x === 'object' && !Array.isArray(x))) {
        const keys = [];
        v.forEach(o => Object.keys(o).forEach(k => { if (keys.indexOf(k) < 0) keys.push(k); }));
        headers = keys;
        rows = v.map(o => keys.map(k => (k in o ? o[k] : '')));
      } else if (v.every(Array.isArray)) {
        return { rows: v, json: true, arrays: true };
      } else {
        headers = ['valeur'];
        rows = v.map(x => [x]);
      }
    } else if (v && typeof v === 'object') {
      const ks = Object.keys(v);
      if (ks.length && ks.every(k => Array.isArray(v[k]))) {
        headers = ks;
        const len = Math.max(...ks.map(k => v[k].length));
        for (let i = 0; i < len; i++) rows.push(ks.map(k => (i < v[k].length ? v[k][i] : '')));
      } else { headers = ks; rows = [ks.map(k => v[k])]; }
    } else throw new Error('Le JSON doit contenir un tableau ou un objet.');
    return { rows: [headers].concat(rows), json: true };
  }

  function detectFormat(text) {
    const t = text.trim();
    if (/^[\[{]/.test(t)) return 'json';
    const lines = t.split(/\r\n|\r|\n/).filter(l => l.trim());
    if (lines.length >= 2 && /^\|.*\|$/.test(lines[0].trim()) && /^\|?\s*:?-{2,}/.test(lines[1].trim())) return 'md';
    return 'csv';
  }

  function uniqueHeaders(h) {
    const seen = {};
    return h.map((x, i) => {
      let k = String(x === null || x === undefined ? '' : x).trim() || 'col' + (i + 1);
      if (seen[k]) { seen[k]++; k = k + '_' + seen[k]; } else seen[k] = 1;
      return k;
    });
  }

  function toTable(text, o) {
    o = Object.assign({ format: 'auto', delimiter: 'auto', header: true, typed: true, emptyNull: false, trim: true, skipEmpty: true }, o || {});
    const fmt = o.format === 'auto' ? detectFormat(text) : o.format;
    let rows, delimiter = null, fromJson = false;
    if (fmt === 'json') { const r = parseJSON(text); rows = r.rows; fromJson = true; if (r.arrays) { o = Object.assign({}, o); } } else if (fmt === 'md') rows = parseMarkdown(text).rows;
    else { const r = parseDelimited(text, o.delimiter); rows = r.rows; delimiter = r.delimiter; }
    if (!rows.length) return { headers: [], rows: [], format: fmt, delimiter };
    if (o.skipEmpty) rows = rows.filter(r => r.some(c => String(c === null || c === undefined ? '' : c).trim() !== ''));
    const width = Math.max(...rows.map(r => r.length));
    rows = rows.map(r => { const x = r.slice(); while (x.length < width) x.push(''); return x; });
    let headers;
    if (o.header) { headers = uniqueHeaders(rows[0]); rows = rows.slice(1); } else headers = uniqueHeaders(new Array(width).fill(''));
    if (!fromJson) {
      rows = rows.map(r => r.map(c => {
        let s = o.trim ? String(c).trim() : String(c);
        if (s === '' && o.emptyNull) return null;
        if (o.typed) {
          if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(s) && String(parseFloat(s)) === s.replace(/^(-?)0+(\d)/, '$1$2')) return parseFloat(s);
          if (s === 'true') return true;
          if (s === 'false') return false;
          if (s === 'null') return null;
        }
        return s;
      }));
    }
    return { headers, rows, format: fmt, delimiter };
  }

  const cellStr = v => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function toCSV(t, d, header) {
    const q = s => (new RegExp('["\\n\\r' + (d === '\t' ? '\\t' : d.replace(/[\\\]^-]/g, '\\$&')) + ']|^\\s|\\s$').test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
    const lines = [];
    if (header) lines.push(t.headers.map(q).join(d));
    t.rows.forEach(r => lines.push(r.map(c => q(cellStr(c))).join(d)));
    return lines.join('\n') + '\n';
  }

  function format(t, kind, o) {
    o = Object.assign({ indent: 2, header: true, delimiter: ',', cls: '', thead: true }, o || {});
    const unit = o.indent === 'tab' ? '\t' : o.indent === 'min' ? null : ' '.repeat(+o.indent || 2);
    if (kind === 'json') {
      const data = t.rows.map(r => { const ob = {}; t.headers.forEach((h, i) => { ob[h] = r[i]; }); return ob; });
      return (unit === null ? JSON.stringify(data) : JSON.stringify(data, null, unit)) + '\n';
    }
    if (kind === 'jsonarrays') {
      const data = (o.header ? [t.headers] : []).concat(t.rows);
      return (unit === null ? JSON.stringify(data) : JSON.stringify(data, null, unit)) + '\n';
    }
    if (kind === 'csv') return toCSV(t, o.delimiter || ',', o.header);
    if (kind === 'tsv') return toCSV(t, '\t', o.header);
    if (kind === 'md') {
      const esc = s => cellStr(s).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
      const L = ['| ' + t.headers.map(esc).join(' | ') + ' |', '| ' + t.headers.map(() => '---').join(' | ') + ' |'];
      t.rows.forEach(r => L.push('| ' + r.map(esc).join(' | ') + ' |'));
      return L.join('\n') + '\n';
    }
    const u = unit === null ? '' : unit, nl = unit === null ? '' : '\n';
    const cls = o.cls ? ' class="' + String(o.cls).replace(/"/g, '&quot;') + '"' : '';
    let h = '<table' + cls + '>' + nl;
    if (o.header && t.headers.length) {
      h += u + '<thead>' + nl + u + u + '<tr>' + nl + t.headers.map(x => u + u + u + '<th scope="col">' + escHtml(x) + '</th>' + nl).join('') + u + u + '</tr>' + nl + u + '</thead>' + nl;
    }
    h += u + '<tbody>' + nl + t.rows.map(r => u + u + '<tr>' + nl + r.map(c => u + u + u + '<td>' + escHtml(cellStr(c)) + '</td>' + nl).join('') + u + u + '</tr>' + nl).join('') + u + '</tbody>' + nl + '</table>' + (unit === null ? '' : '\n');
    return h;
  }

  const api = { parseDelimited, parseMarkdown, parseJSON, detectFormat, detectDelimiter, toTable, format };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CSVCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
