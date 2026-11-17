(function (root) {
  'use strict';

  const ECC = {
    L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  };
  const BLOCKS = {
    L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  };
  const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  const bit = (x, i) => ((x >>> i) & 1) !== 0;

  function rawModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }

  function dataCodewords(ver, ecl) {
    return Math.floor(rawModules(ver) / 8) - ECC[ecl][ver] * BLOCKS[ecl][ver];
  }

  function alignPositions(ver) {
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2, size = ver * 4 + 17;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    const r = [6];
    for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p);
    return r;
  }

  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsDivisor(deg) {
    const r = new Array(deg).fill(0);
    r[deg - 1] = 1;
    let w = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < deg; j++) {
        r[j] = gfMul(r[j], w);
        if (j + 1 < deg) r[j] ^= r[j + 1];
      }
      w = gfMul(w, 2);
    }
    return r;
  }

  function rsRemainder(data, div) {
    const r = div.map(() => 0);
    for (const b of data) {
      const f = b ^ r.shift();
      r.push(0);
      div.forEach((c, i) => { r[i] ^= gfMul(c, f); });
    }
    return r;
  }

  function capacityBytes(ver, ecl) {
    const cc = ver < 10 ? 8 : 16;
    return Math.min(Math.floor((dataCodewords(ver, ecl) * 8 - 4 - cc) / 8), cc === 8 ? 255 : 65535);
  }

  function maxBytes(ecl) { return capacityBytes(40, ecl); }

  function buildData(bytes, ver, ecl) {
    const cc = ver < 10 ? 8 : 16, bits = [];
    const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(4, 4);
    put(bytes.length, cc);
    bytes.forEach(b => put(b, 8));
    const cap = dataCodewords(ver, ecl) * 8;
    put(0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    const out = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      out.push(v);
    }
    for (let pad = 0xec; out.length < cap / 8; pad ^= 0xec ^ 0x11) out.push(pad);
    return out;
  }

  function interleave(data, ver, ecl) {
    const nb = BLOCKS[ecl][ver], el = ECC[ecl][ver];
    const raw = Math.floor(rawModules(ver) / 8);
    const short = nb - (raw % nb), shortLen = Math.floor(raw / nb);
    const div = rsDivisor(el), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - el + (i < short ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, div);
      if (i < short) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const out = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((b, j) => { if (i !== shortLen - el || j >= short) out.push(b[i]); });
    }
    return out;
  }

  function encode(bytes, ecl, minVer) {
    ecl = ECC[ecl] ? ecl : 'M';
    let ver = Math.max(1, minVer || 1);
    for (;; ver++) {
      if (ver > 40) throw new Error('too-long');
      if (bytes.length <= capacityBytes(ver, ecl)) break;
    }
    const size = ver * 4 + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };

    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    });
    const ap = alignPositions(ver), n = ap.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }

    const drawFormat = mask => {
      const data = (FORMAT_BITS[ecl] << 3) | mask;
      let rem = data;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((data << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, bit(bits, i));
      set(8, 7, bit(bits, 6)); set(8, 8, bit(bits, 7)); set(7, 8, bit(bits, 8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(bits, i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(bits, i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(bits, i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const c = bit(bits, i), a = size - 11 + (i % 3), b = Math.floor(i / 3);
        set(a, b, c); set(b, a, c);
      }
    }

    const cw = interleave(buildData(bytes, ver, ecl), ver, ecl);
    let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
        if (!fn[y][x] && k < cw.length * 8) { m[y][x] = bit(cw[k >>> 3], 7 - (k & 7)); k++; }
      }
    }

    const maskFn = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x, y) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
    ];
    const applyMask = mask => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[mask](x, y)) m[y][x] = !m[y][x];
    };

    const penalty = () => {
      let p = 0, dark = 0;
      const line = get => {
        let run = 1, prev = get(0), hist = [];
        for (let i = 1; i <= size; i++) {
          const c = i < size ? get(i) : null;
          if (c === prev) run++;
          else { hist.push(run); if (run >= 5) p += 3 + run - 5; run = 1; prev = c; }
        }
        let s = '';
        for (let i = 0; i < size; i++) s += get(i) ? '1' : '0';
        const re = /(?=(10111010000|00001011101))/g;
        while (re.exec(s)) { p += 40; re.lastIndex++; }
      };
      for (let y = 0; y < size; y++) line(i => m[y][i]);
      for (let x = 0; x < size; x++) line(i => m[i][x]);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (m[y][x]) dark++;
        if (x < size - 1 && y < size - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
      }
      const total = size * size;
      p += 10 * (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1);
      return p;
    };

    let best = 0, bestP = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      applyMask(mask);
      drawFormat(mask);
      const p = penalty();
      if (p < bestP) { bestP = p; best = mask; }
      applyMask(mask);
    }
    applyMask(best);
    drawFormat(best);
    return { size, version: ver, mask: best, ecl, modules: m, isFunction: fn };
  }

  function encodeText(text, ecl, minVer) {
    return encode(Array.from(new TextEncoder().encode(text)), ecl, minVer);
  }

  function finderAt(size, x, y) {
    return (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  }

  function logoBox(qr, logo) {
    if (!logo) return null;
    const s = qr.size * logo.scale, pad = logo.pad === 'none' ? 0 : 1;
    const c = qr.size / 2, half = s / 2 + pad;
    return { x0: c - half, y0: c - half, x1: c + half, y1: c + half, s, c, pad };
  }

  function shapes(qr, style) {
    const out = [], size = qr.size;
    const lb = qr._box || null;
    const round = style === 'rounded' ? 0.28 : 0;
    const fr = style === 'square' ? 0 : 1.2;
    [[0, 0], [size - 7, 0], [0, size - 7]].forEach(([x, y]) => {
      out.push({ t: 'ring', x, y, s: 7, rx: fr });
      out.push({ t: 'r', x: x + 2, y: y + 2, w: 3, h: 3, rx: style === 'square' ? 0 : 0.7 });
    });
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!qr.modules[y][x] || finderAt(size, x, y)) continue;
      if (lb && x + 1 > lb.x0 && x < lb.x1 && y + 1 > lb.y0 && y < lb.y1) continue;
      if (style === 'dots') out.push({ t: 'c', cx: x + 0.5, cy: y + 0.5, r: 0.5 });
      else out.push({ t: 'r', x, y, w: 1, h: 1, rx: round });
    }
    return out;
  }

  function f(n) { return +n.toFixed(3); }

  function rrPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    if (!r) return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
    return `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}v${f(h - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}h${f(-(w - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}v${f(-(h - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}z`;
  }

  function circlePath(cx, cy, r) {
    return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0z`;
  }

  function pathOf(list, off) {
    return list.map(s => {
      if (s.t === 'c') return circlePath(s.cx + off, s.cy + off, s.r);
      if (s.t === 'r') return rrPath(s.x + off, s.y + off, s.w, s.h, s.rx);
      return rrPath(s.x + off, s.y + off, s.s, s.s, s.rx) + rrPath(s.x + off + 1, s.y + off + 1, s.s - 2, s.s - 2, Math.max(0, s.rx - 1));
    }).join('');
  }

  function prepare(qr, opts) {
    const o = Object.assign({ margin: 4, fg: '#000000', bg: '#ffffff', style: 'square', logo: null }, opts || {});
    qr._box = logoBox(qr, o.logo);
    const list = shapes(qr, o.style);
    const total = qr.size + o.margin * 2;
    return { o, list, total, box: qr._box };
  }

  function toSVG(qr, opts) {
    const { o, list, total, box } = prepare(qr, opts);
    const px = o.px || total * 10, off = o.margin;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}" shape-rendering="geometricPrecision">`;
    if (o.bg) s += `<rect width="${total}" height="${total}" fill="${o.bg}"/>`;
    s += `<path fill="${o.fg}" fill-rule="evenodd" d="${pathOf(list, off)}"/>`;
    if (box && o.logo) {
      const L = o.logo, x = box.x0 + off, y = box.y0 + off, w = box.x1 - box.x0;
      if (L.pad !== 'none') {
        const plate = L.bg || o.bg || '#ffffff';
        if (L.pad === 'round') s += `<circle cx="${f(box.c + off)}" cy="${f(box.c + off)}" r="${f(w / 2)}" fill="${plate}"/>`;
        else s += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(w)}" rx="${f(Math.min(1.2, w / 6))}" fill="${plate}"/>`;
      }
      const iw = box.s, ix = box.c + off - iw / 2, ih = L.ratio ? iw / L.ratio : iw, iy = box.c + off - ih / 2;
      s += `<image x="${f(ix)}" y="${f(iy)}" width="${f(iw)}" height="${f(ih)}" preserveAspectRatio="xMidYMid meet" href="${L.href}" xlink:href="${L.href}"/>`;
    }
    return s + '</svg>';
  }

  function drawCanvas(qr, canvas, opts) {
    const { o, list, total, box } = prepare(qr, opts);
    const px = o.px || 512, k = px / total, off = o.margin;
    canvas.width = px; canvas.height = px;
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, px, px);
    if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, px, px); }
    g.save();
    g.scale(k, k);
    g.fillStyle = o.fg;
    const p = new Path2D(pathOf(list, off));
    g.fill(p, 'evenodd');
    if (box && o.logo) {
      const L = o.logo, x = box.x0 + off, y = box.y0 + off, w = box.x1 - box.x0;
      if (L.pad !== 'none') {
        g.fillStyle = L.bg || o.bg || '#ffffff';
        g.beginPath();
        if (L.pad === 'round') g.arc(box.c + off, box.c + off, w / 2, 0, Math.PI * 2);
        else g.roundRect ? g.roundRect(x, y, w, w, Math.min(1.2, w / 6)) : g.rect(x, y, w, w);
        g.fill();
      }
      if (L.img) {
        const iw = box.s, ih = L.ratio ? iw / L.ratio : iw;
        g.drawImage(L.img, box.c + off - iw / 2, box.c + off - ih / 2, iw, ih);
      }
    }
    g.restore();
    return canvas;
  }

  function lum(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 1;
    const v = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }

  function contrast(a, b) {
    const x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  const api = { encode, encodeText, toSVG, drawCanvas, maxBytes, capacityBytes, dataCodewords, contrast, lum, ECC, BLOCKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QRCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
