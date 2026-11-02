(function () {
  'use strict';

  // Dépend de js/common.js (Utils) et js/batch.js (Batch.zip).

  const SIZES = [16, 32, 48, 180, 192, 512];

  function roundRectPath(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  }

  /* Fichier .ico contenant des PNG (pris en charge par tous les navigateurs actuels). */
  function buildIco(items) {
    const n = items.length, head = new DataView(new ArrayBuffer(6 + 16 * n));
    head.setUint16(2, 1, true); head.setUint16(4, n, true);
    let off = 6 + 16 * n;
    items.forEach((it, i) => {
      const o = 6 + 16 * i, s = it.size >= 256 ? 0 : it.size;
      head.setUint8(o, s); head.setUint8(o + 1, s);
      head.setUint16(o + 4, 1, true); head.setUint16(o + 6, 32, true);
      head.setUint32(o + 8, it.bytes.length, true); head.setUint32(o + 12, off, true);
      off += it.bytes.length;
    });
    return new Blob([head.buffer, ...items.map(it => it.bytes)], { type: 'image/x-icon' });
  }

  const Favicon = {
    state: { data: null, shape: 'rounded' },
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('fv-dropzone'), input: $('fv-file-input'), stage: $('fv-stage'), grid: $('fv-grid'),
        shapeBtns: [...document.querySelectorAll('#fv-shape-seg button')],
        padding: $('fv-padding-slider'), paddingValue: $('fv-padding-value'),
        bgToggle: $('fv-bg-toggle'), bgColor: $('fv-bg-color'), bgRow: $('fv-bg-row'),
        code: $('fv-code'), copyBtn: $('fv-copy-btn'),
        downloadBtn: $('fv-download-btn'), resetBtn: $('fv-reset-btn'),
      };
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      this.els.shapeBtns.forEach(b => b.addEventListener('click', () => {
        this.state.shape = b.dataset.shape;
        this.els.shapeBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        this.render();
      }));
      this.els.padding.addEventListener('input', () => {
        this.els.paddingValue.textContent = this.els.padding.value + '%';
        this.render();
      });
      this.els.bgToggle.addEventListener('change', () => {
        this.els.bgRow.style.display = this.els.bgToggle.checked ? 'flex' : 'none';
        this.render();
      });
      this.els.bgColor.addEventListener('input', () => this.render());
      this.els.copyBtn.addEventListener('click', () => this.copy());
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        this.state.data = data;
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        this.render();
        this.els.downloadBtn.disabled = false;
      } catch (e) {
        Utils.toast(e.message || 'Impossible de charger ce fichier.');
      }
    },
    icon(size) {
      const d = this.state.data, c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d'), shape = this.state.shape;
      ctx.save();
      ctx.beginPath();
      if (shape === 'circle') ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      else if (shape === 'rounded') roundRectPath(ctx, 0, 0, size, size, size * 0.22);
      else ctx.rect(0, 0, size, size);
      ctx.closePath(); ctx.clip();
      if (this.els.bgToggle.checked) { ctx.fillStyle = this.els.bgColor.value; ctx.fillRect(0, 0, size, size); }
      const pad = size * parseInt(this.els.padding.value, 10) / 100, box = size - 2 * pad;
      const sc = Math.min(box / d.width, box / d.height), w = d.width * sc, h = d.height * sc;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(d.img, (size - w) / 2, (size - h) / 2, w, h);
      ctx.restore();
      return c;
    },
    snippet() {
      const svg = this.state.data && this.state.data.format === 'svg';
      return [
        svg ? '<link rel="icon" href="/favicon.svg" type="image/svg+xml">' : null,
        '<link rel="icon" href="/favicon.ico" sizes="48x48">',
        '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
        '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<link rel="manifest" href="/site.webmanifest">'
      ].filter(Boolean).join('\n');
    },
    render() {
      if (!this.state.data) return;
      const g = this.els.grid; g.innerHTML = '';
      SIZES.forEach(s => {
        const c = this.icon(s), fig = document.createElement('figure');
        fig.className = 'fv-item';
        c.style.width = (s <= 48 ? Math.max(48, s * 2) : 96) + 'px';
        c.style.height = c.style.width;
        c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Aperçu ' + s + ' × ' + s);
        const cap = document.createElement('figcaption'); cap.textContent = s + ' × ' + s;
        fig.append(c, cap); g.appendChild(fig);
      });
      this.els.code.textContent = this.snippet();
    },
    async copy() {
      try { await navigator.clipboard.writeText(this.els.code.textContent); Utils.toast('Code copié.'); }
      catch (e) { Utils.toast('Copie impossible : sélectionnez le code à la main.'); }
    },
    async download() {
      if (!this.state.data) return;
      this.els.downloadBtn.disabled = true;
      try {
        const png = {};
        for (const s of SIZES) png[s] = new Uint8Array(await (await Utils.canvasToBlob(this.icon(s), 'image/png')).arrayBuffer());
        const files = [
          { name: 'favicon.ico', blob: buildIco([16, 32, 48].map(s => ({ size: s, bytes: png[s] }))) },
          { name: 'favicon-16x16.png', data: png[16] }, { name: 'favicon-32x32.png', data: png[32] },
          { name: 'favicon-48x48.png', data: png[48] }, { name: 'apple-touch-icon.png', data: png[180] },
          { name: 'android-chrome-192x192.png', data: png[192] }, { name: 'android-chrome-512x512.png', data: png[512] },
          { name: 'site.webmanifest', data: new TextEncoder().encode(JSON.stringify({
            name: '', short_name: '',
            icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }, { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }],
            theme_color: '#ffffff', background_color: '#ffffff', display: 'standalone'
          }, null, 2)) },
          { name: 'code-a-copier.html', data: new TextEncoder().encode(this.snippet() + '\n') }
        ];
        if (this.state.data.format === 'svg') files.push({ name: 'favicon.svg', data: new TextEncoder().encode(this.state.data.svgText) });
        // les entrées « blob » (ICO) sont converties en octets pour l'archive
        for (const f of files) if (f.blob && !f.data) f.data = new Uint8Array(await f.blob.arrayBuffer());
        Utils.download(await Batch.zip(files), 'favicons.zip');
      } catch (e) {
        Utils.toast(e.message || 'La génération a échoué.');
      } finally {
        this.els.downloadBtn.disabled = false;
      }
    },
    reset() {
      this.state.data = null;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.grid.innerHTML = '';
      this.els.downloadBtn.disabled = true;
    }
  };

  document.addEventListener('DOMContentLoaded', function () { Favicon.init(); });
})();
