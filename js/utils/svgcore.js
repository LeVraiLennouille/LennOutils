(function (root) {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';
  const EDITOR_NS = ['inkscape', 'sodipodi', 'sketch', 'serif', 'i', 'a', 'x', 'ns_ai', 'adobe', 'cc', 'dc', 'rdf', 'xmp', 'xapGImg', 'tiff', 'illustrator', 'graph', 'vectornator', 'figma'];
  const NUM_ATTRS = new Set(['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'x2', 'y1', 'y2', 'fx', 'fy', 'stroke-width', 'stroke-miterlimit', 'opacity', 'fill-opacity', 'stroke-opacity', 'offset', 'stroke-dasharray', 'stroke-dashoffset', 'points', 'viewBox', 'font-size', 'dx', 'dy', 'stop-opacity', 'flood-opacity']);
  const COLOR_ATTRS = new Set(['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color']);
  const STYLE_NUM = new Set(['stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity', 'font-size', 'stroke-miterlimit', 'stroke-dashoffset', 'stroke-dasharray', 'flood-opacity']);
  const RESOURCES = new Set(['clipPath', 'mask', 'filter', 'linearGradient', 'radialGradient', 'pattern', 'marker', 'symbol']);
  const TEXTISH = new Set(['text', 'tspan', 'textPath', 'style', 'script', 'title', 'desc', 'pre', 'foreignObject']);

  const TO_NAME = { '#f00': 'red', '#d2b48c': 'tan', '#f0ffff': 'azure', '#f5f5dc': 'beige', '#ffe4c4': 'bisque', '#a52a2a': 'brown', '#ff7f50': 'coral', '#dc143c': 'crimson', '#ffd700': 'gold', '#808080': 'gray', '#008000': 'green', '#4b0082': 'indigo', '#fffff0': 'ivory', '#f0e68c': 'khaki', '#faf0e6': 'linen', '#800000': 'maroon', '#000080': 'navy', '#808000': 'olive', '#ffa500': 'orange', '#da70d6': 'orchid', '#cd853f': 'peru', '#ffc0cb': 'pink', '#dda0dd': 'plum', '#800080': 'purple', '#fa8072': 'salmon', '#a0522d': 'sienna', '#c0c0c0': 'silver', '#fffafa': 'snow', '#ff6347': 'tomato', '#ee82ee': 'violet', '#f5deb3': 'wheat', '#008080': 'teal' };
  const TO_HEX = { black: '#000', white: '#fff', blue: '#00f', yellow: '#ff0', lime: '#0f0', cyan: '#0ff', aqua: '#0ff', magenta: '#f0f', fuchsia: '#f0f' };

  function fmtNum(x, p) {
    if (!isFinite(x)) return '0';
    let s = x.toFixed(p);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0' || s === '') s = '0';
    return s.replace(/^(-?)0\./, '$1.');
  }

  const NUMRE = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;

  function parsePath(d) {
    const out = [];
    const cnt = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
    let i = 0;
    const n = d.length;
    const skip = () => { while (i < n && /[\s,]/.test(d[i])) i++; };
    const readNum = () => {
      skip();
      NUMRE.lastIndex = i;
      const m = NUMRE.exec(d);
      if (!m) throw new Error('Données de tracé invalides');
      i += m[0].length;
      return parseFloat(m[0]);
    };
    const readFlag = () => {
      skip();
      const c = d[i];
      if (c !== '0' && c !== '1') throw new Error('Données de tracé invalides');
      i++;
      return +c;
    };
    let cmd = null;
    skip();
    while (i < n) {
      skip();
      if (i >= n) break;
      const c = d[i];
      if (/[A-Za-z]/.test(c)) {
        if (!cnt.hasOwnProperty(c.toUpperCase())) throw new Error('Commande de tracé inconnue : ' + c);
        cmd = c; i++;
        if (c === 'z' || c === 'Z') { out.push({ c, a: [] }); continue; }
      } else if (!cmd) throw new Error('Données de tracé invalides');
      const U = cmd.toUpperCase();
      if (U === 'Z') throw new Error('Données de tracé invalides');
      const a = [];
      if (U === 'A') {
        a.push(readNum(), readNum(), readNum(), readFlag(), readFlag(), readNum(), readNum());
      } else for (let k = 0; k < cnt[U]; k++) a.push(readNum());
      out.push({ c: cmd, a });
      if (cmd === 'M') cmd = 'L'; else if (cmd === 'm') cmd = 'l';
      skip();
    }
    return out;
  }

  function optimizePath(d, p) {
    const segs = parsePath(d);
    let cx = 0, cy = 0, rx = 0, ry = 0, sx = 0, sy = 0, srx = 0, sry = 0;
    const r = v => +v.toFixed(p);
    const out = [];
    let prev = null;
    segs.forEach(sg => {
      const c = sg.c, U = c.toUpperCase(), rel = c !== U, a = sg.a, o = [];
      const abs = (v, base) => (rel ? base + v : v);
      if (U === 'Z') {
        cx = sx; cy = sy; rx = srx; ry = sry;
      } else if (U === 'H') {
        const X = abs(a[0], cx), Rx = r(X);
        o.push(rel ? r(Rx - rx) : Rx);
        cx = X; rx = Rx;
      } else if (U === 'V') {
        const Y = abs(a[0], cy), Ry = r(Y);
        o.push(rel ? r(Ry - ry) : Ry);
        cy = Y; ry = Ry;
      } else if (U === 'A') {
        o.push(r(a[0]), r(a[1]), r(a[2]), a[3], a[4]);
        const X = abs(a[5], cx), Y = abs(a[6], cy), Rx = r(X), Ry = r(Y);
        o.push(rel ? r(Rx - rx) : Rx, rel ? r(Ry - ry) : Ry);
        cx = X; cy = Y; rx = Rx; ry = Ry;
      } else {
        const bx = cx, by = cy, brx = rx, bry = ry;
        let ex = cx, ey = cy, erx = rx, ery = ry;
        for (let k = 0; k < a.length; k += 2) {
          const X = abs(a[k], bx), Y = abs(a[k + 1], by), Rx = r(X), Ry = r(Y);
          o.push(rel ? r(Rx - brx) : Rx, rel ? r(Ry - bry) : Ry);
          ex = X; ey = Y; erx = Rx; ery = Ry;
        }
        cx = ex; cy = ey; rx = erx; ry = ery;
        if (U === 'M') { sx = cx; sy = cy; srx = rx; sry = ry; }
      }
      out.push({ c, o });
      prev = sg;
    });
    void prev;
    let s = '', last = null, lastStr = '';
    out.forEach(seg => {
      const same = last && last.c === seg.c && seg.c !== 'M' && seg.c !== 'm' && seg.c !== 'z' && seg.c !== 'Z';
      let part = same ? '' : seg.c;
      seg.o.forEach((v, idx) => {
        const t = fmtNum(v, 8);
        const needSep = (idx > 0 || same) ? !(t[0] === '-') && !(t[0] === '.' && /\./.test(lastStr)) : false;
        if (idx === 0 && !same) part += t;
        else part += (needSep ? ' ' : '') + t;
        lastStr = t;
      });
      s += part;
      last = seg;
      if (!seg.o.length) lastStr = '';
    });
    return s;
  }

  function roundNumbers(str, p) {
    return str.replace(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g, m => fmtNum(parseFloat(m), p));
  }

  function shortColor(v) {
    let c = v.trim();
    const l = c.toLowerCase();
    let m = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(l);
    if (m) c = '#' + [m[1], m[2], m[3]].map(x => ('0' + Math.min(255, +x).toString(16)).slice(-2)).join('');
    else c = l;
    if (/^#[0-9a-f]{6}$/.test(c)) {
      if (c[1] === c[2] && c[3] === c[4] && c[5] === c[6]) c = '#' + c[1] + c[3] + c[5];
      else if (TO_NAME[c]) c = TO_NAME[c];
    }
    if (TO_HEX[c]) c = TO_HEX[c];
    if (TO_NAME[c]) c = TO_NAME[c];
    return /^#[0-9a-f]{3,8}$/.test(c) || /^[a-z]+$/.test(c) ? c : v.trim();
  }

  function cleanStyle(s, o) {
    const decl = s.split(';').map(x => x.trim()).filter(Boolean).map(x => {
      const i = x.indexOf(':');
      if (i < 0) return x;
      const k = x.slice(0, i).trim(), v = x.slice(i + 1).trim().replace(/\s+/g, ' ');
      if (o.colors && COLOR_ATTRS.has(k)) return k + ':' + shortColor(v);
      if (o.numbers && STYLE_NUM.has(k)) return k + ':' + roundNumbers(v, o.P);
      return k + ':' + v;
    });
    return decl.join(';');
  }

  function isEditorNode(n) {
    const pre = n.prefix || (n.nodeName.indexOf(':') > 0 ? n.nodeName.split(':')[0] : '');
    return pre && EDITOR_NS.indexOf(pre) >= 0;
  }

  function optimize(src, opts) {
    const o = Object.assign({ comments: true, metadata: true, keepTitle: true, ids: true, groups: true, numbers: true, precision: 3, paths: true, colors: true, responsive: false, styles: true }, opts || {});
    const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
    const err = doc.getElementsByTagName('parsererror')[0];
    if (err) {
      const t = (err.textContent || '').replace(/Below is a rendering[\s\S]*$/, '').trim();
      const m = /line (\d+) at column (\d+):?\s*([\s\S]*)/i.exec(t);
      throw new Error('SVG invalide' + (m ? ' (ligne ' + m[1] + ', colonne ' + m[2] + ') : ' + m[3].trim().slice(0, 120) : ' : ' + t.slice(0, 140)));
    }
    const svg = doc.documentElement;
    if (!svg || svg.localName !== 'svg') throw new Error('Ce contenu n’est pas un fichier SVG (balise <svg> racine introuvable).');
    const P = Math.max(0, Math.min(8, o.precision | 0));

    const walkAll = (n, fn) => { [...n.childNodes].forEach(c => { fn(c); if (c.parentNode === n && c.nodeType === 1) walkAll(c, fn); }); };

    if (o.comments) walkAll(svg, n => { if (n.nodeType === 8 || n.nodeType === 7) n.remove(); });
    if (o.metadata) {
      walkAll(svg, n => {
        if (n.nodeType !== 1) return;
        if (n.localName === 'metadata' || isEditorNode(n)) n.remove();
      });
      const strip = el => {
        [...el.attributes].forEach(a => {
          const pre = a.prefix || (a.name.indexOf(':') > 0 ? a.name.split(':')[0] : '');
          if ((pre && EDITOR_NS.indexOf(pre) >= 0) || a.name === 'data-name' || (a.name.indexOf('xmlns:') === 0 && EDITOR_NS.indexOf(a.name.slice(6)) >= 0)) el.removeAttribute(a.name);
        });
      };
      strip(svg);
      walkAll(svg, n => { if (n.nodeType === 1) strip(n); });
      ['version', 'baseProfile', 'enable-background'].forEach(a => svg.removeAttribute(a));
      if (svg.getAttribute('x') === '0') svg.removeAttribute('x');
      if (svg.getAttribute('y') === '0') svg.removeAttribute('y');
    }
    if (!o.keepTitle) walkAll(svg, n => { if (n.nodeType === 1 && (n.localName === 'title' || n.localName === 'desc')) n.remove(); });

    const hasText = !!svg.getElementsByTagName('text').length;
    if (!hasText) svg.removeAttribute('xml:space');

    const styleText = [...svg.getElementsByTagName('style'), ...svg.getElementsByTagName('script')].map(e => e.textContent).join('\n');
    if (o.ids && !svg.getElementsByTagName('script').length) {
      const refs = new Set();
      const collect = s => { (s.match(/url\(\s*['"]?#([^)'"\s]+)/g) || []).forEach(m => refs.add(m.replace(/url\(\s*['"]?#/, ''))); };
      walkAll(svg, n => {
        if (n.nodeType !== 1) return;
        [...n.attributes].forEach(a => {
          collect(a.value);
          if ((a.localName === 'href') && a.value[0] === '#') refs.add(a.value.slice(1));
          const m = /^([^.\s]+)\.(begin|end)/.exec(a.value);
          if ((a.name === 'begin' || a.name === 'end') && m) refs.add(m[1]);
          if (a.name === 'aria-labelledby' || a.name === 'aria-describedby') a.value.split(/\s+/).forEach(x => refs.add(x));
          if (a.name === 'for' || a.name === 'clip-path' || a.name === 'mask') collect(a.value);
        });
      });
      collect(styleText);
      const all = [svg, ...svg.getElementsByTagName('*')];
      all.forEach(el => {
        const id = el.getAttribute('id');
        if (id && !refs.has(id) && styleText.indexOf('#' + id) < 0) el.removeAttribute('id');
      });
      [...svg.getElementsByTagName('*')].forEach(el => {
        if (RESOURCES.has(el.localName) && !el.hasAttribute('id') && !new RegExp('\\b' + el.localName + '\\b').test(styleText)) el.remove();
      });
    }

    if (o.groups) {
      let changed = true;
      while (changed) {
        changed = false;
        [...svg.getElementsByTagName('g')].forEach(g => {
          if (!g.parentNode) return;
          if (!g.attributes.length) {
            if (!g.firstChild && g.childNodes.length === 0) { g.remove(); changed = true; return; }
            while (g.firstChild) g.parentNode.insertBefore(g.firstChild, g);
            g.remove(); changed = true;
          } else if (!g.childNodes.length && !g.hasAttribute('id')) { g.remove(); changed = true; }
        });
        [...svg.getElementsByTagName('defs')].forEach(d => { if (!d.children.length && !d.textContent.trim()) { d.remove(); changed = true; } });
      }
    }

    const all = [svg, ...svg.getElementsByTagName('*')];
    all.forEach(el => {
      [...el.attributes].forEach(a => {
        const name = a.name;
        let v = a.value;
        if (name === 'd' && o.paths) {
          try { el.setAttribute('d', optimizePath(v, P)); } catch (e) { el.setAttribute('d', v.replace(/\s+/g, ' ').trim()); }
          return;
        }
        if (name === 'd') return;
        if (name === 'style' && o.styles) { const c = cleanStyle(v, Object.assign({ P }, o)); if (c) el.setAttribute('style', c); else el.removeAttribute('style'); return; }
        if (o.numbers && NUM_ATTRS.has(name)) {
          const pp = name === 'viewBox' ? Math.max(P, 2) : P;
          v = roundNumbers(v, pp).replace(/\s+/g, ' ').trim();
          el.setAttribute(name, v);
          return;
        }
        if (o.numbers && name === 'transform') { el.setAttribute(name, roundNumbers(v, Math.min(8, P + 2)).replace(/\s+/g, ' ').trim()); return; }
        if (o.colors && COLOR_ATTRS.has(name)) { el.setAttribute(name, shortColor(v)); return; }
        if (o.styles && /\s{2,}|^\s|\s$/.test(v) && name !== 'xml:space' && !/^(class|aria-label|alt|title)$/.test(name)) el.setAttribute(name, v.replace(/\s+/g, ' ').trim());
      });
    });

    if (o.styles) {
      [...svg.getElementsByTagName('style')].forEach(st => {
        let t = st.textContent;
        try { if (root.FmtCore) t = root.FmtCore.css.minify(t); else t = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim(); } catch (e) { t = t.trim(); }
        while (st.firstChild) st.firstChild.remove();
        st.appendChild(doc.createTextNode(t));
      });
    }

    const clean = n => {
      [...n.childNodes].forEach(c => {
        if (c.nodeType === 3) {
          const keep = TEXTISH.has(n.localName) || n.getAttribute && n.getAttribute('xml:space') === 'preserve';
          if (!keep && !c.nodeValue.trim()) c.remove();
          else if (!keep) c.nodeValue = c.nodeValue.trim();
          else if (n.localName !== 'style' && n.localName !== 'script') c.nodeValue = c.nodeValue.replace(/\s+/g, ' ');
        } else if (c.nodeType === 1) clean(c);
      });
    };
    clean(svg);

    if (o.responsive && svg.hasAttribute('viewBox')) { svg.removeAttribute('width'); svg.removeAttribute('height'); }

    let out = new XMLSerializer().serializeToString(svg);
    if (!/xlink:/.test(out.replace(/xmlns:xlink="[^"]*"/, ''))) out = out.replace(/\sxmlns:xlink="[^"]*"/, '');
    if (out.indexOf('<svg:') < 0 && out.indexOf('</svg:') < 0) out = out.replace(/\sxmlns:svg="[^"]*"/, '');
    out = out.replace(/\s+xmlns:[a-z]+="[^"]*"(?=[^>]*>)/g, m => (EDITOR_NS.some(ns => m.indexOf('xmlns:' + ns + '=') >= 0) && o.metadata ? '' : m));
    return out.trim();
  }

  const api = { optimize, optimizePath, parsePath, fmtNum, shortColor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SVGCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
