(function () {
  'use strict';

  const Utils = {
    bytesToSize(bytes) {
      if (!bytes && bytes !== 0) return '—';
      if (bytes === 0) return '0 o';
      const units = ['o', 'Ko', 'Mo', 'Go'];
      const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
      const val = bytes / Math.pow(1024, i);
      return (i === 0 ? val : val.toFixed(val < 10 ? 2 : 1)) + ' ' + units[i];
    },
    clamp(v, min, max) {
      return Math.min(max, Math.max(min, v));
    },
    debounce(fn, ms) {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
      };
    },
    nextFrame() {
      return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    },

    detectFormat(file) {
      const name = (file.name || '').toLowerCase();
      const type = (file.type || '').toLowerCase();
      if (type.includes('svg') || name.endsWith('.svg')) return 'svg';
      if (type.includes('png') || name.endsWith('.png')) return 'png';
      if (type.includes('webp') || name.endsWith('.webp')) return 'webp';
      if (type.includes('avif') || name.endsWith('.avif')) return 'avif';
      if (type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif')) return 'heic';
      if (type.includes('jpeg') || type.includes('jpg') || name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpg';
      return 'unknown';
    },
    mimeFor(format) {
      return {
        png: 'image/png',
        jpg: 'image/jpeg',
        webp: 'image/webp',
        avif: 'image/avif',
        svg: 'image/svg+xml'
      } [format] || 'application/octet-stream';
    },
    extFor(format) {
      return {
        jpg: 'jpg',
        png: 'png',
        webp: 'webp',
        avif: 'avif',
        svg: 'svg'
      } [format] || format;
    },
    labelFor(format) {
      return {
        jpg: 'JPG',
        png: 'PNG',
        webp: 'WEBP',
        avif: 'AVIF',
        svg: 'SVG',
        heic: 'HEIC'
      } [format] || (format || '').toUpperCase();
    },

    readFileAsText(file) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Lecture du fichier impossible.'));
        r.readAsText(file);
      });
    },

    _loadImgEl(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Ce fichier ne peut pas être décodé par votre navigateur."));
        img.src = url;
      });
    },
    parseSVGSize(svgText) {
      try {
        const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
        const svg = doc.documentElement;
        if (!svg || svg.nodeName === 'parsererror') return {
          width: null,
          height: null
        };
        let w = parseFloat(svg.getAttribute('width'));
        let h = parseFloat(svg.getAttribute('height'));
        const vb = svg.getAttribute('viewBox');
        if ((!w || !h) && vb) {
          const parts = vb.trim().split(/[\s,]+/).map(Number);
          if (parts.length === 4) {
            w = w || parts[2];
            h = h || parts[3];
          }
        }
        return {
          width: isFinite(w) && w > 0 ? w : null,
          height: isFinite(h) && h > 0 ? h : null
        };
      } catch (e) {
        return {
          width: null,
          height: null
        };
      }
    },

    /* HEIC / HEIF : décodage local (libheif, chargé uniquement à la demande) puis conversion en PNG pour le reste de l'outil. */
    _loadScript(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Le décodeur HEIC n’a pas pu être chargé.'));
        document.head.appendChild(s);
      });
    },
    async _heicToPngBlob(file) {
      if (!window.libheif) await this._loadScript('js/vendor/libheif-bundle.js');
      // la version « bundle » expose une fabrique à appeler une fois (initialise le WebAssembly intégré)
      if (!this._heif) this._heif = typeof window.libheif === 'function' ? await window.libheif() : window.libheif;
      const decoder = new this._heif.HeifDecoder();
      const imgs = decoder.decode(new Uint8Array(await file.arrayBuffer()));
      if (!imgs || !imgs.length) throw new Error('Ce fichier HEIC est illisible.');
      const im = imgs[0], w = im.get_width(), h = im.get_height();
      if (!w || !h || w * h > 120e6) throw new Error('Image HEIC trop grande ou invalide.');
      const cnv = document.createElement('canvas');
      cnv.width = w; cnv.height = h;
      const ctx = cnv.getContext('2d'), id = ctx.createImageData(w, h);
      await new Promise((res, rej) => im.display(id, out => (out ? res() : rej(new Error('Décodage HEIC impossible.')))));
      ctx.putImageData(id, 0, 0);
      const blob = await new Promise(r => cnv.toBlob(r, 'image/png'));
      cnv.width = cnv.height = 0;
      if (!blob) throw new Error('Conversion HEIC impossible.');
      return blob;
    },

    async loadImage(file) {
      let format = this.detectFormat(file);
      if (format === 'heic') {
        const png = await this._heicToPngBlob(file);
        const url = URL.createObjectURL(png);
        const img = await this._loadImgEl(url).catch(e => { URL.revokeObjectURL(url); throw e; });
        return { img, url, width: img.naturalWidth, height: img.naturalHeight, format: 'jpg', sourceFormat: 'heic', isVector: false, fileSize: file.size, fileName: file.name };
      }
      if (format === 'svg') {
        const text = await this.readFileAsText(file);
        const dims = this.parseSVGSize(text);
        const blob = new Blob([text], {
          type: 'image/svg+xml'
        });
        const url = URL.createObjectURL(blob);
        const img = await this._loadImgEl(url);
        return {
          img,
          url,
          width: Math.round(dims.width || img.naturalWidth || 300),
          height: Math.round(dims.height || img.naturalHeight || 150),
          format,
          svgText: text,
          isVector: true,
          fileSize: file.size,
          fileName: file.name
        };
      }
      const url = URL.createObjectURL(file);
      const img = await this._loadImgEl(url).catch(e => {
        URL.revokeObjectURL(url);
        throw e;
      });
      return {
        img,
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
        format,
        isVector: false,
        fileSize: file.size,
        fileName: file.name
      };
    },

    canvasFrom(imgLike, w, h) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imgLike, 0, 0, c.width, c.height);
      return c;
    },

    download(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
    downloadText(text, filename, mime) {
      this.download(new Blob([text], {
        type: mime || 'text/plain'
      }), filename);
    },

    canvasToBlob(canvas, mime, quality) {
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Export impossible dans ce format.'));
            return;
          }
          resolve(blob);
        }, mime, quality);
      });
    },

    setupDropzone(dropzoneEl, inputEl, onFile) {
      dropzoneEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzoneEl.classList.add('is-drag');
      });
      dropzoneEl.addEventListener('dragleave', () => dropzoneEl.classList.remove('is-drag'));
      dropzoneEl.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzoneEl.classList.remove('is-drag');
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) onFile(f);
      });
      inputEl.addEventListener('change', () => {
        const f = inputEl.files && inputEl.files[0];
        if (f) onFile(f);
        inputEl.value = '';
      });
    },

    showLoading(el, on) {
      el.classList.toggle('is-active', !!on);
    },

    _avifSupport: null,
    async checkAvifSupport() {
      if (this._avifSupport !== null) return this._avifSupport;
      try {
        const c = document.createElement('canvas');
        c.width = 2;
        c.height = 2;
        const blob = await this.canvasToBlob(c, 'image/avif', 0.8).catch(() => null);
        this._avifSupport = !!(blob && blob.type === 'image/avif');
      } catch (e) {
        this._avifSupport = false;
      }
      return this._avifSupport;
    },

    toast(msg) {
      let t = document.getElementById('gl-toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'gl-toast';
        t.style.cssText = 'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--Charcoal);color:#fff;padding:12px 22px;border-radius:999px;font-weight:600;font-size:13.5px;box-shadow:0 8px 24px rgba(0,0,0,.3);z-index:999;opacity:0;transition:opacity .2s;max-width:80vw;text-align:center;';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = '1';
      clearTimeout(t._h);
      t._h = setTimeout(() => {
        t.style.opacity = '0';
      }, 3400);
    },
  };

  const Engine = {};

  Engine.lanczosKernel = function (x, a) {
    if (x === 0) return 1;
    if (x <= -a || x >= a) return 0;
    const px = Math.PI * x;
    return (a * Math.sin(px) * Math.sin(px / a)) / (px * px);
  };

  Engine.resizeLanczos = function (src, srcW, srcH, dstW, dstH, a) {
    a = a || 3;
    const channels = 4;
    const xScale = srcW / dstW,
      yScale = srcH / dstH;
    const scaleForKernelX = xScale > 1 ? xScale : 1;
    const scaleForKernelY = yScale > 1 ? yScale : 1;
    const supportX = a * scaleForKernelX,
      supportY = a * scaleForKernelY;

    const temp = new Float32Array(dstW * srcH * channels);
    for (let dx = 0; dx < dstW; dx++) {
      const cx = (dx + 0.5) * xScale - 0.5;
      const left = Math.floor(cx - supportX),
        right = Math.ceil(cx + supportX);
      const weights = [];
      let wsum = 0;
      for (let sx = left; sx <= right; sx++) {
        const w = Engine.lanczosKernel((cx - sx) / scaleForKernelX, a);
        weights.push(w);
        wsum += w;
      }
      if (Math.abs(wsum) < 1e-9) wsum = 1;
      for (let sy = 0; sy < srcH; sy++) {
        let r = 0,
          g = 0,
          b = 0,
          al = 0;
        for (let k = 0; k < weights.length; k++) {
          const sx = left + k;
          const clx = sx < 0 ? 0 : sx >= srcW ? srcW - 1 : sx;
          const idx = (sy * srcW + clx) * channels,
            w = weights[k];
          r += src[idx] * w;
          g += src[idx + 1] * w;
          b += src[idx + 2] * w;
          al += src[idx + 3] * w;
        }
        const tIdx = (sy * dstW + dx) * channels;
        temp[tIdx] = r / wsum;
        temp[tIdx + 1] = g / wsum;
        temp[tIdx + 2] = b / wsum;
        temp[tIdx + 3] = al / wsum;
      }
    }
    const out = new Uint8ClampedArray(dstW * dstH * channels);
    for (let dy = 0; dy < dstH; dy++) {
      const cy = (dy + 0.5) * yScale - 0.5;
      const top = Math.floor(cy - supportY),
        bottom = Math.ceil(cy + supportY);
      const weights = [];
      let wsum = 0;
      for (let sy = top; sy <= bottom; sy++) {
        const w = Engine.lanczosKernel((cy - sy) / scaleForKernelY, a);
        weights.push(w);
        wsum += w;
      }
      if (Math.abs(wsum) < 1e-9) wsum = 1;
      for (let dx = 0; dx < dstW; dx++) {
        let r = 0,
          g = 0,
          b = 0,
          al = 0;
        for (let k = 0; k < weights.length; k++) {
          const sy = top + k;
          const cly = sy < 0 ? 0 : sy >= srcH ? srcH - 1 : sy;
          const idx = (cly * dstW + dx) * channels,
            w = weights[k];
          r += temp[idx] * w;
          g += temp[idx + 1] * w;
          b += temp[idx + 2] * w;
          al += temp[idx + 3] * w;
        }
        const oIdx = (dy * dstW + dx) * channels;
        out[oIdx] = r / wsum;
        out[oIdx + 1] = g / wsum;
        out[oIdx + 2] = b / wsum;
        out[oIdx + 3] = al / wsum;
      }
    }
    return out;
  };

  Engine.srgbToLinear = function (c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  Engine.rgbToLab = function (r, g, b) {
    const rl = Engine.srgbToLinear(r),
      gl = Engine.srgbToLinear(g),
      bl = Engine.srgbToLinear(b);
    let x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
    let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
    let z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;
    x /= 0.95047;
    y /= 1.0;
    z /= 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
    const fx = f(x),
      fy = f(y),
      fz = f(z);
    return [(116 * fy) - 16, 500 * (fx - fy), 200 * (fy - fz)];
  };
  Engine.labDistance = function (c1, c2) {
    const [L1, A1, B1] = Engine.rgbToLab(c1[0], c1[1], c1[2]);
    const [L2, A2, B2] = Engine.rgbToLab(c2[0], c2[1], c2[2]);
    return Math.sqrt((L1 - L2) ** 2 + (A1 - A2) ** 2 + (B1 - B2) ** 2);
  };

  Engine.NEIGHBOR_STEP_LIMIT = 22;
  Engine.floodFillBackground = function (data, width, height, tolerance, seeds, visitedOut) {
    const visited = visitedOut || new Uint8Array(width * height);
    const queue = [];
    let sumR = 0,
      sumG = 0,
      sumB = 0,
      cnt = 0;
    for (const [sx, sy] of seeds) {
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      const idx = sy * width + sx;
      if (!visited[idx]) {
        visited[idx] = 1;
        queue.push(idx);
        const p = idx * 4;
        sumR += data[p];
        sumG += data[p + 1];
        sumB += data[p + 2];
        cnt++;
      }
    }
    const baseColor = cnt ? [sumR / cnt, sumG / cnt, sumB / cnt] : [128, 128, 128];
    let qHead = 0;
    while (qHead < queue.length) {
      const idx = queue[qHead++];
      const x = idx % width,
        y = (idx / width) | 0;
      const pIdx = idx * 4;
      const r = data[pIdx],
        g = data[pIdx + 1],
        b = data[pIdx + 2];
      data[pIdx + 3] = 0;
      const nb = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1]
      ];
      for (const [nx, ny] of nb) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (visited[nIdx]) continue;
        const nP = nIdx * 4;
        const cand = [data[nP], data[nP + 1], data[nP + 2]];
        if (Engine.labDistance([r, g, b], cand) > Engine.NEIGHBOR_STEP_LIMIT) continue;
        if (Engine.labDistance(baseColor, cand) <= tolerance) {
          visited[nIdx] = 1;
          queue.push(nIdx);
        }
      }
    }
    return visited;
  };
  Engine.featherAlpha = function (data, width, height, radius) {
    if (radius <= 0) return;
    const alpha = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) alpha[i] = data[i * 4 + 3];
    const tmp = new Float32Array(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        let s = 0,
          c = 0;
        for (let k = -radius; k <= radius; k++) {
          const sx = Utils.clamp(x + k, 0, width - 1);
          s += alpha[y * width + sx];
          c++;
        }
        tmp[y * width + x] = s / c;
      }
    for (let x = 0; x < width; x++)
      for (let y = 0; y < height; y++) {
        let s = 0,
          c = 0;
        for (let k = -radius; k <= radius; k++) {
          const sy = Utils.clamp(y + k, 0, height - 1);
          s += tmp[sy * width + x];
          c++;
        }
        data[(y * width + x) * 4 + 3] = Math.round(s / c);
      }
  };

  Engine.boxBlurRGB = function (data, width, height, radius) {
    const out = new Float32Array(data.length);
    const tmp = new Float32Array(data.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          cnt = 0;
        for (let k = -radius; k <= radius; k++) {
          const sx = Utils.clamp(x + k, 0, width - 1);
          const idx = (y * width + sx) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          cnt++;
        }
        const oi = (y * width + x) * 4;
        tmp[oi] = r / cnt;
        tmp[oi + 1] = g / cnt;
        tmp[oi + 2] = b / cnt;
        tmp[oi + 3] = data[oi + 3];
      }
    for (let x = 0; x < width; x++)
      for (let y = 0; y < height; y++) {
        let r = 0,
          g = 0,
          b = 0,
          cnt = 0;
        for (let k = -radius; k <= radius; k++) {
          const sy = Utils.clamp(y + k, 0, height - 1);
          const idx = (sy * width + x) * 4;
          r += tmp[idx];
          g += tmp[idx + 1];
          b += tmp[idx + 2];
          cnt++;
        }
        const oi = (y * width + x) * 4;
        out[oi] = r / cnt;
        out[oi + 1] = g / cnt;
        out[oi + 2] = b / cnt;
        out[oi + 3] = data[oi + 3];
      }
    return out;
  };
  Engine.unsharpMask = function (data, width, height, amount, radius) {
    radius = radius || 1;
    const blurred = Engine.boxBlurRGB(data, width, height, radius);
    const out = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      out[i] = data[i] + amount * (data[i] - blurred[i]);
      out[i + 1] = data[i + 1] + amount * (data[i + 1] - blurred[i + 1]);
      out[i + 2] = data[i + 2] + amount * (data[i + 2] - blurred[i + 2]);
      out[i + 3] = data[i + 3];
    }
    return out;
  };

  Engine.minifySVG = function (svgText) {
    let out = svgText;
    out = out.replace(/<!--[\s\S]*?-->/g, '');
    out = out.replace(/<\?xml[^>]*\?>/g, '');
    out = out.replace(/<(metadata|sodipodi:namedview)[^>]*>[\s\S]*?<\/\1>/gi, '');
    out = out.replace(/<(metadata|sodipodi:namedview)[^>]*\/>/gi, '');
    out = out.replace(/\s(inkscape|sodipodi):[\w-]+="[^"]*"/gi, '');
    out = out.replace(/\sxmlns:(inkscape|sodipodi)="[^"]*"/gi, '');
    out = out.replace(/>\s+</g, '><');
    out = out.trim();
    out = out.replace(/[ \t\r\n]{2,}/g, ' ');
    out = out.replace(/\d+\.\d{4,}/g, (m) => {
      let s = parseFloat(m).toFixed(3);
      s = s.replace(/0+$/, '').replace(/\.$/, '');
      return s;
    });
    return out;
  };

  Engine.buildPalette = function (data, maxColors) {
    const buckets = new Map();
    const shift = 3;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 8) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const key = ((r >> shift) << 10) | ((g >> shift) << 5) | (b >> shift);
      let e = buckets.get(key);
      if (!e) {
        e = {
          count: 0,
          r: 0,
          g: 0,
          b: 0
        };
        buckets.set(key, e);
      }
      e.count++;
      e.r += r;
      e.g += g;
      e.b += b;
    }
    const arr = [...buckets.values()].map(e => ({
      r: Math.round(e.r / e.count),
      g: Math.round(e.g / e.count),
      b: Math.round(e.b / e.count),
      count: e.count
    }));
    arr.sort((a, b) => b.count - a.count);
    return arr.slice(0, maxColors);
  };
  const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];
  Engine.quantizeImage = function (data, width, height, maxColors, dither) {
    const palette = Engine.buildPalette(data, maxColors);
    if (palette.length <= 1) return palette;
    const BITS = 6,
      SHIFT = 8 - BITS,
      LEVELS = 1 << BITS;
    const lut = new Int16Array(LEVELS * LEVELS * LEVELS).fill(-1);
    const ditherStrength = 255 / (2 * Math.cbrt(maxColors));

    function nearestIdx(r, g, b) {
      let best = 0,
        bestD = Infinity;
      for (let p = 0; p < palette.length; p++) {
        const dr = r - palette[p].r,
          dg = g - palette[p].g,
          db = b - palette[p].b;
        const d = 0.9 * dr * dr + 1.5 * dg * dg + 0.6 * db * db;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      return best;
    }
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 8) continue;
        let r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        if (dither) {
          const t = (BAYER4[y & 3][x & 3] / 16 - 0.5) * ditherStrength;
          r = Utils.clamp(Math.round(r + t), 0, 255);
          g = Utils.clamp(Math.round(g + t), 0, 255);
          b = Utils.clamp(Math.round(b + t), 0, 255);
        }
        const li = (((r >> SHIFT) * LEVELS) + (g >> SHIFT)) * LEVELS + (b >> SHIFT);
        let idx = lut[li];
        if (idx === -1) {
          idx = nearestIdx(r, g, b);
          lut[li] = idx;
        }
        data[i] = palette[idx].r;
        data[i + 1] = palette[idx].g;
        data[i + 2] = palette[idx].b;
      }
    return palette;
  };

  Engine.scopeCSS = function (css, scopeSelector) {
    let i = 0;
    const n = css.length;

    function skipWs() {
      while (i < n && /\s/.test(css[i])) i++;
    }

    function captureRaw() {
      let start = i,
        depth = 1;
      while (i < n && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') {
          depth--;
          if (depth === 0) break;
        }
        i++;
      }
      return css.slice(start, i);
    }

    function parseList() {
      let result = '';
      while (i < n) {
        skipWs();
        if (i >= n) break;
        if (css[i] === '}') return result;
        if (css[i] === '@') {
          let start = i;
          while (i < n && css[i] !== '{' && css[i] !== ';') i++;
          const atHeader = css.slice(start, i).trim();
          if (i < n && css[i] === ';') {
            result += atHeader + ';';
            i++;
            continue;
          }
          if (i >= n) {
            result += atHeader;
            break;
          }
          i++;
          const m = atHeader.match(/^@([a-zA-Z-]+)/);
          const atName = m ? m[1].toLowerCase() : '';
          if (atName === 'media' || atName === 'supports') {
            const inner = parseList();
            result += atHeader + '{' + inner + '}';
            if (css[i] === '}') i++;
          } else {
            const raw = captureRaw();
            result += atHeader + '{' + raw + '}';
            if (css[i] === '}') i++;
          }
          continue;
        }
        let selStart = i;
        while (i < n && css[i] !== '{' && css[i] !== '}') i++;
        if (i >= n || css[i] === '}') {
          result += css.slice(selStart, i);
          return result;
        }
        const rawSel = css.slice(selStart, i).trim();
        i++;
        const decls = captureRaw();
        if (css[i] === '}') i++;
        if (!rawSel) continue;
        const scoped = rawSel.split(',').map(s => {
          s = s.trim();
          if (!s) return null;
          if (/^(html|body)$/i.test(s)) return scopeSelector;
          if (/^(html|body)\b/i.test(s)) return s.replace(/^(html|body)\b/i, scopeSelector);
          return scopeSelector + ' ' + s;
        }).filter(Boolean).join(', ');
        result += scoped + '{' + decls + '}';
      }
      return result;
    }
    return parseList();
  };

  window.__AtelierEngine = Engine;
  window.__AtelierUtils = Utils;

  Utils.capDimensions = function (w, h, maxPixels) {
    maxPixels = maxPixels || 30000000;
    const total = w * h;
    if (total <= maxPixels) return {
      width: Math.max(1, Math.round(w)),
      height: Math.max(1, Math.round(h)),
      capped: false
    };
    const scale = Math.sqrt(maxPixels / total);
    return {
      width: Math.max(1, Math.round(w * scale)),
      height: Math.max(1, Math.round(h * scale)),
      capped: true
    };
  };

  Utils.extForMime = function (mime) {
    const map = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'image/svg+xml': 'svg'
    };
    return map[mime] || 'png';
  };

  window.Utils = Utils;
  window.Engine = Engine;

  // Barre latérale : sur mobile, ramène l'outil courant dans la zone visible.
  document.addEventListener('DOMContentLoaded', function () {
    const cur = document.querySelector('.rail-btn[aria-current]');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
  });
})();

/* =====================================================================
   Outils PDF : helpers partagés par les fichiers js/pdf-*.js
   (chargement des librairies à la demande, lecture, rendu, sortie).
   S'appuie sur Utils ci-dessus : bytesToSize (taille) et clamp.
   ===================================================================== */
(function () {
window.PDFK=window.PDFK||{tools:[]};
const $=(s,r=document)=>r.querySelector(s),E=h=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstElementChild},esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fz=Utils.bytesToSize,clamp=Utils.clamp,base=f=>f.name.replace(/\.[^.]+$/,''),U8=async f=>new Uint8Array(await f.arrayBuffer());
const CDN='https://cdn.jsdelivr.net/npm/',WK=CDN+'pdfjs-dist@3.11.174/build/pdf.worker.min.js';
const L={pdflib:[CDN+'pdf-lib@1.17.1/dist/pdf-lib.min.js','PDFLib'],pdfjs:[CDN+'pdfjs-dist@3.11.174/build/pdf.min.js','pdfjsLib'],zip:[CDN+'jszip@3.10.1/dist/jszip.min.js','JSZip'],mam:[CDN+'mammoth@1.6.0/mammoth.browser.min.js','mammoth'],xl:[CDN+'xlsx@0.18.5/dist/xlsx.full.min.js','XLSX'],ocr:[CDN+'tesseract.js@5.1.1/dist/tesseract.min.js','Tesseract'],h2c:[CDN+'html2canvas@1.4.1/dist/html2canvas.min.js','html2canvas'],jspdf:[CDN+'jspdf@2.5.1/dist/jspdf.umd.min.js','jspdf'],pptx:[CDN+'pptxgenjs@3.12.0/dist/pptxgen.bundle.js','PptxGenJS']};
const LP={},lib=k=>LP[k]||(LP[k]=new Promise((ok,ko)=>{const[u,g]=L[k];if(window[g])return ok(window[g]);const s=document.createElement('script');s.src=u;s.onload=async()=>{try{if(k=='pdfjs')pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([await(await fetch(WK)).text()],{type:'text/javascript'}));ok(window[g])}catch(e){delete LP[k];ko(Error('Bibliothèque « '+k+' » indisponible : vérifie ta connexion.'))}};s.onerror=()=>{delete LP[k];ko(Error('Bibliothèque « '+k+' » indisponible : vérifie ta connexion.'))};document.head.append(s)}));
/* ---------- PDF : outils communs ---------- */
const ld=async f=>{const{PDFDocument:D}=await lib('pdflib');try{return await D.load(await U8(f),{updateMetadata:false})}catch(e){throw Error(/encrypt/i.test(e.message)?`« ${f.name} » est protégé : passe d’abord par « Déverrouiller PDF ».`:`« ${f.name} » est illisible ou abîmé : essaie « Réparer PDF ».`)}};
const js=async(f,pw)=>{await lib('pdfjs');try{return await pdfjsLib.getDocument({data:await U8(f),password:pw}).promise}catch(e){throw Error(e.name=='PasswordException'?'Ce PDF demande un mot de passe (absent ou incorrect).':`« ${f.name} » est illisible : essaie « Réparer PDF ».`)}};
const cvs=async(d,n,s)=>{const pg=await d.getPage(n),v=pg.getViewport({scale:s}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:x,viewport:v}).promise;return c};
const rg=(t,N)=>{const m=/^\s*(\d*)\s*(?:-\s*(\d*))?\s*$/.exec(t);if(!m||(!m[1]&&!m[2]))throw Error('Plage invalide : « '+t.trim()+' »');const a=+m[1]||1,b=m[2]===undefined?a:(+m[2]||N);if(a<1||b>N||a>b)throw Error('Plage hors du document (1–'+N+') : « '+t.trim()+' »');return Array.from({length:b-a+1},(_,i)=>a-1+i)},pg=(s,N)=>s.split(',').filter(x=>x.trim()).flatMap(t=>rg(t,N));
const out=(n,d,note,m='application/pdf')=>({n,d,note,m}),A4=[595.28,841.89];
/* géométrie « visuelle » d'une page (tient compte de /Rotate et du CropBox) */
const geo=p=>{const b=p.getCropBox(),r=((p.getRotation().angle%360)+360)%360,W=b.width,H=b.height,v=r%180?[H,W]:[W,H];return{r,vw:v[0],vh:v[1],m:(x,y)=>{const[a,c]=r==0?[x,y]:r==90?[W-y,x]:r==180?[W-x,H-y]:[y,H-x];return[b.x+a,b.y+c]}}};
const safe=(p,t,a)=>{try{p.drawText(t,a)}catch{try{p.drawText(t.replace(/[^\x20-\xff]/g,'?'),a)}catch{}}};
/* rastérise un PDF (images JPEG + texte invisible pour garder la recherche) */
const ras=async(d,{s=2,q=.8,txt=1,cover},u)=>{const o=[];for(let n=1;n<=d.numPages;n++){u&&u((n-1)/d.numPages,`Page ${n}/${d.numPages}`);const pg=await d.getPage(n),v=pg.getViewport({scale:1}),k=Math.min(s,4096/Math.max(v.width,v.height)),c=await cvs(d,n,k);(cover&&cover[n]||[]).forEach(z=>{const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(z.x*c.width,z.y*c.height,z.w*c.width,z.h*c.height)});let t=[];if(txt&&!(cover&&cover[n])){t=(await pg.getTextContent()).items.filter(i=>i.str.trim()).map(i=>{const[a,b,,,e,f]=i.transform,[x,y]=v.convertToViewportPoint(e,f);return{s:i.str,x,y,z:Math.hypot(a,b)}})}o.push({u:c.toDataURL('image/jpeg',q),w:v.width,h:v.height,t})}return o};
const asPdf=async(pp,txt=1)=>{const{PDFDocument:D,StandardFonts:S}=PDFLib,o=await D.create(),f=await o.embedFont(S.Helvetica);for(const p of pp){const g=o.addPage([p.w,p.h]);g.drawImage(await o.embedJpg(p.u),{x:0,y:0,width:p.w,height:p.h});if(txt)p.t.forEach(t=>safe(g,t.s,{x:t.x,y:p.h-t.y,size:Math.max(1,t.z),font:f,opacity:0}))}return o};
/* images */
const img=async f=>{const b=await createImageBitmap(f,{imageOrientation:'from-image'}),k=Math.min(1,2400/Math.max(b.width,b.height)),c=document.createElement('canvas');c.width=b.width*k|0;c.height=b.height*k|0;c.getContext('2d').drawImage(b,0,0,c.width,c.height);return c};
const num=s=>/^-?\d+([.,]\d+)?$/.test(s.trim())?+s.replace(',','.'):s;
const ZK=['TA','TB'];
const ZN='Dessine un rectangle sur l’aperçu pour choisir la zone.';
Object.assign(PDFK,{$,E,esc,fz,base,U8,clamp,CDN,WK,L,LP,lib,ld,js,cvs,rg,pg,out,A4,geo,safe,ras,asPdf,img,num,ZK,ZN});
})();