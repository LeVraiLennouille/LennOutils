(function () {
  'use strict';

  // Dépend de js/common.js (Utils, Engine).

  const Watermark = {
    state: {
      data: null,
      mode: 'text',
      tile: false,
      posPct: {
        x: 0.5,
        y: 0.5
      }
    },
    PRESETS: {
      tl: {
        x: .12,
        y: .12
      },
      tc: {
        x: .5,
        y: .12
      },
      tr: {
        x: .88,
        y: .12
      },
      cl: {
        x: .12,
        y: .5
      },
      cc: {
        x: .5,
        y: .5
      },
      cr: {
        x: .88,
        y: .5
      },
      bl: {
        x: .12,
        y: .88
      },
      bc: {
        x: .5,
        y: .88
      },
      br: {
        x: .88,
        y: .88
      }
    },
    _logoImg: null,
    _logoDataUrl: null,
    _fontsReady: {},
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('wm-dropzone'),
        input: $('wm-file-input'),
        stage: $('wm-stage'),
        loading: $('wm-loading'),
        canvas: $('wm-canvas'),
        textHandle: $('wm-text-handle'),
        svgBadge: $('wm-svg-badge'),
        modeSeg: $('wm-mode-seg'),
        textField: $('wm-text-field'),
        fontField: $('wm-font-field'),
        logoField: $('wm-logo-field'),
        textInput: $('wm-text-input'),
        fontSelect: $('wm-font-select'),
        logoInput: $('wm-logo-input'),
        sizeSlider: $('wm-size-slider'),
        sizeValue: $('wm-size-value'),
        colorField: $('wm-color-field'),
        colorInput: $('wm-color-input'),
        colorHex: $('wm-color-hex'),
        opacitySlider: $('wm-opacity-slider'),
        opacityValue: $('wm-opacity-value'),
        rotationSlider: $('wm-rotation-slider'),
        rotationValue: $('wm-rotation-value'),
        strokeToggle: $('wm-stroke-toggle'),
        shadowToggle: $('wm-shadow-toggle'),
        tileToggle: $('wm-tile-toggle'),
        positionBlock: $('wm-position-block'),
        posGrid: $('wm-pos-grid'),
        densityField: $('wm-density-field'),
        densitySlider: $('wm-density-slider'),
        densityValue: $('wm-density-value'),
        downloadBtn: $('wm-download-btn'),
        resetBtn: $('wm-reset-btn'),
      };
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      Array.prototype.slice.call(this.els.modeSeg.querySelectorAll('button')).forEach(btn => {
        btn.addEventListener('click', () => {
          Array.prototype.slice.call(this.els.modeSeg.querySelectorAll('button')).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
          this.state.mode = btn.dataset.wmmode;
          this.els.textField.style.display = this.state.mode === 'text' ? 'block' : 'none';
          this.els.fontField.style.display = this.state.mode === 'text' ? 'block' : 'none';
          this.els.colorField.style.display = this.state.mode === 'text' ? 'block' : 'none';
          this.els.logoField.style.display = this.state.mode === 'image' ? 'block' : 'none';
          this.render();
        });
      });
      this.els.textInput.addEventListener('input', Utils.debounce(() => this.render(), 60));
      this.els.fontSelect.addEventListener('change', () => this.render());
      this.els.logoInput.addEventListener('change', () => this.onLogoFile());
      this.els.sizeSlider.addEventListener('input', () => {
        this.els.sizeValue.textContent = this.els.sizeSlider.value + '%';
        this.render();
      });
      this.els.colorInput.addEventListener('input', () => {
        this.els.colorHex.textContent = this.els.colorInput.value.toUpperCase();
        this.render();
      });
      this.els.opacitySlider.addEventListener('input', () => {
        this.els.opacityValue.textContent = this.els.opacitySlider.value + '%';
        this.render();
      });
      this.els.rotationSlider.addEventListener('input', () => {
        this.els.rotationValue.textContent = this.els.rotationSlider.value + '°';
        this.render();
      });
      this.els.strokeToggle.addEventListener('change', () => this.render());
      this.els.shadowToggle.addEventListener('change', () => this.render());
      this.els.tileToggle.addEventListener('change', () => {
        this.state.tile = this.els.tileToggle.checked;
        this.els.positionBlock.style.display = this.state.tile ? 'none' : 'block';
        this.els.densityField.style.display = this.state.tile ? 'block' : 'none';
        this.render();
      });
      this.els.densitySlider.addEventListener('input', () => {
        this.els.densityValue.textContent = this.els.densitySlider.value;
        this.render();
      });
      Array.prototype.slice.call(this.els.posGrid.querySelectorAll('.pos-btn')).forEach(btn => {
        btn.addEventListener('click', () => {
          Array.prototype.slice.call(this.els.posGrid.querySelectorAll('.pos-btn')).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
          this.state.posPct = Object.assign({}, this.PRESETS[btn.dataset.pos]);
          this.render();
        });
      });
      this.setupDragHandle();
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
    },
    setupDragHandle() {
      let dragging = false;
      this.els.textHandle.addEventListener('pointerdown', (e) => {
        if (this.state.tile) return;
        dragging = true;
        this.els.textHandle.classList.add('is-dragging');
        e.preventDefault();
      });
      window.addEventListener('pointermove', (e) => {
        if (!dragging || !this.state.data) return;
        const rect = this.els.canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width,
          py = (e.clientY - rect.top) / rect.height;
        this.state.posPct = {
          x: Utils.clamp(px, 0, 1),
          y: Utils.clamp(py, 0, 1)
        };
        Array.prototype.slice.call(this.els.posGrid.querySelectorAll('.pos-btn')).forEach(b => b.setAttribute('aria-pressed', 'false'));
        this.render();
      });
      window.addEventListener('pointerup', () => {
        dragging = false;
        this.els.textHandle.classList.remove('is-dragging');
      });
    },
    async onLogoFile() {
      const f = this.els.logoInput.files[0];
      if (!f) return;
      try {
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(new Error('Lecture du logo impossible.'));
          r.readAsDataURL(f);
        });
        this._logoDataUrl = dataUrl;
        this._logoImg = await Utils._loadImgEl(dataUrl);
        this.render();
      } catch (e) {
        Utils.toast(e.message);
      }
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        this.state.data = data;
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        this.els.svgBadge.style.display = data.format === 'svg' ? 'flex' : 'none';
        await this.render();
      } catch (e) {
        Utils.toast(e.message || "Impossible de charger ce fichier.");
      }
    },
    async ensureFontLoaded(fontStack, fontSize) {
      if (this._fontsReady[fontStack]) return;
      if (document.fonts && document.fonts.load) {
        try {
          await document.fonts.load(Math.round(fontSize || 32) + 'px ' + fontStack);
        } catch (e) {}
      }
      this._fontsReady[fontStack] = true;
    },
    drawTextAt(ctx, text, cx, cy, fontSize, fontStack, color, rotationDeg, stroke, shadow) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotationDeg * Math.PI / 180);
      ctx.font = '600 ' + fontSize + 'px ' + fontStack;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (shadow) {
        ctx.shadowColor = 'rgba(0,0,0,.4)';
        ctx.shadowBlur = fontSize * 0.1;
        ctx.shadowOffsetY = fontSize * 0.035;
      }
      if (stroke) {
        ctx.lineWidth = Math.max(1, fontSize * 0.045);
        ctx.strokeStyle = 'rgba(0,0,0,.6)';
        ctx.strokeText(text, 0, 0);
      }
      ctx.fillStyle = color;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    },
    drawImageAt(ctx, img, cx, cy, w, h, rotationDeg, shadow) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotationDeg * Math.PI / 180);
      if (shadow) {
        ctx.shadowColor = 'rgba(0,0,0,.4)';
        ctx.shadowBlur = w * 0.05;
        ctx.shadowOffsetY = w * 0.02;
      }
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    },
    async render() {
      const data = this.state.data;
      if (!data) return;
      const canvas = this.els.canvas;
      canvas.width = data.width;
      canvas.height = data.height;
      const ctx = canvas.getContext('2d');

      const opacity = parseInt(this.els.opacitySlider.value, 10) / 100;
      const rotation = parseInt(this.els.rotationSlider.value, 10);
      const sizePct = parseInt(this.els.sizeSlider.value, 10) / 100;
      const stroke = this.els.strokeToggle.checked,
        shadow = this.els.shadowToggle.checked;
      const color = this.els.colorInput.value;
      const text = this.els.textInput.value || '';
      const fontStack = this.els.fontSelect.selectedOptions[0].dataset.stack;
      const fontSize = Math.max(6, data.width * sizePct);
      if (this.state.mode === 'text') await this.ensureFontLoaded(fontStack, fontSize);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(data.img, 0, 0, data.width, data.height);
      ctx.save();
      ctx.globalAlpha = opacity;
      if (this.state.tile) {
        const density = parseInt(this.els.densitySlider.value, 10);
        const stepX = data.width / (density + 1),
          stepY = data.height / (density + 1);
        const margin = Math.max(stepX, stepY);
        for (let gy = -margin; gy < data.height + margin; gy += stepY) {
          for (let gx = -margin; gx < data.width + margin; gx += stepX) {
            if (this.state.mode === 'text') this.drawTextAt(ctx, text, gx, gy, fontSize, fontStack, color, rotation, stroke, false);
            else if (this._logoImg) {
              const lw = data.width * sizePct * 2,
                lh = lw * (this._logoImg.naturalHeight / this._logoImg.naturalWidth);
              this.drawImageAt(ctx, this._logoImg, gx, gy, lw, lh, rotation, false);
            }
          }
        }
      } else {
        const cx = this.state.posPct.x * data.width,
          cy = this.state.posPct.y * data.height;
        if (this.state.mode === 'text') this.drawTextAt(ctx, text, cx, cy, fontSize, fontStack, color, rotation, stroke, shadow);
        else if (this._logoImg) {
          const lw = data.width * sizePct * 2,
            lh = lw * (this._logoImg.naturalHeight / this._logoImg.naturalWidth);
          this.drawImageAt(ctx, this._logoImg, cx, cy, lw, lh, rotation, shadow);
        }
      }
      ctx.restore();
      this.positionHandle();
      this.els.downloadBtn.disabled = false;
    },
    positionHandle() {
      const data = this.state.data;
      if (!data || this.state.tile) {
        this.els.textHandle.style.display = 'none';
        return;
      }
      this.els.textHandle.style.display = 'block';
      const rect = this.els.canvas.getBoundingClientRect();
      const x = this.state.posPct.x * rect.width,
        y = this.state.posPct.y * rect.height;
      const sizePct = parseInt(this.els.sizeSlider.value, 10) / 100;
      const fontSizeCss = data.width * sizePct * (rect.width / data.width || 1);
      const text = this.els.textInput.value || ' ';
      const rotation = parseInt(this.els.rotationSlider.value, 10);
      this.els.textHandle.style.left = x + 'px';
      this.els.textHandle.style.top = y + 'px';
      this.els.textHandle.style.width = Math.max(50, text.length * fontSizeCss * 0.55) + 'px';
      this.els.textHandle.style.height = (fontSizeCss * 1.3) + 'px';
      this.els.textHandle.style.transform = 'translate(-50%,-50%) rotate(' + rotation + 'deg)';
    },
    buildWatermarkedSVG() {
      const data = this.state.data;
      const doc = new DOMParser().parseFromString(data.svgText, 'image/svg+xml');
      const svg = doc.documentElement;
      if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 ' + data.width + ' ' + data.height);
      const vb = svg.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number);
      const vbX = vb[0],
        vbY = vb[1],
        vbW = vb[2],
        vbH = vb[3];
      const sizePct = parseInt(this.els.sizeSlider.value, 10) / 100;
      const fontSize = vbW * sizePct;
      const color = this.els.colorInput.value;
      const opacity = parseInt(this.els.opacitySlider.value, 10) / 100;
      const rotation = parseInt(this.els.rotationSlider.value, 10);
      const fontStack = this.els.fontSelect.selectedOptions[0].dataset.stack;
      const text = this.els.textInput.value || '';
      const ns = 'http://www.w3.org/2000/svg';
      const g = doc.createElementNS(ns, 'g');
      g.setAttribute('data-atelier-watermark', '1');

      const makeText = (cx, cy) => {
        const t = doc.createElementNS(ns, 'text');
        t.setAttribute('x', cx.toFixed(2));
        t.setAttribute('y', cy.toFixed(2));
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('dominant-baseline', 'middle');
        t.setAttribute('font-family', fontStack);
        t.setAttribute('font-size', fontSize.toFixed(2));
        t.setAttribute('font-weight', '600');
        t.setAttribute('fill', color);
        t.setAttribute('fill-opacity', opacity.toFixed(2));
        if (rotation) t.setAttribute('transform', 'rotate(' + rotation + ' ' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ')');
        t.textContent = text;
        return t;
      };
      const makeImage = (cx, cy) => {
        const ratio = this._logoImg ? (this._logoImg.naturalHeight / this._logoImg.naturalWidth) : 1;
        const w = vbW * sizePct * 2,
          h = w * ratio;
        const im = doc.createElementNS(ns, 'image');
        im.setAttribute('x', (cx - w / 2).toFixed(2));
        im.setAttribute('y', (cy - h / 2).toFixed(2));
        im.setAttribute('width', w.toFixed(2));
        im.setAttribute('height', h.toFixed(2));
        im.setAttribute('opacity', opacity.toFixed(2));
        im.setAttribute('href', this._logoDataUrl || '');
        if (rotation) im.setAttribute('transform', 'rotate(' + rotation + ' ' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ')');
        return im;
      };
      const makeAt = (cx, cy) => this.state.mode === 'text' ? makeText(cx, cy) : makeImage(cx, cy);

      if (this.state.tile) {
        const density = parseInt(this.els.densitySlider.value, 10);
        const stepX = vbW / (density + 1),
          stepY = vbH / (density + 1);
        const margin = Math.max(stepX, stepY);
        for (let gy = vbY - margin; gy < vbY + vbH + margin; gy += stepY)
          for (let gx = vbX - margin; gx < vbX + vbW + margin; gx += stepX)
            g.appendChild(makeAt(gx, gy));
      } else {
        const cx = vbX + this.state.posPct.x * vbW,
          cy = vbY + this.state.posPct.y * vbH;
        g.appendChild(makeAt(cx, cy));
      }
      svg.appendChild(g);
      return new XMLSerializer().serializeToString(svg);
    },
    async download() {
      const data = this.state.data;
      if (!data) return;
      const base = (data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      if (data.format === 'svg') {
        const svgText = this.buildWatermarkedSVG();
        Utils.downloadText(svgText, base + '-filigrane.svg', 'image/svg+xml');
      } else {
        const blob = await Utils.canvasToBlob(this.els.canvas, Utils.mimeFor(data.format), 0.92);
        Utils.download(blob, base + '-filigrane.' + Utils.extFor(data.format));
      }
    },
    reset() {
      this.state.data = null;
      this._logoImg = null;
      this._logoDataUrl = null;
      this.state.posPct = {
        x: .5,
        y: .5
      };
      this.state.tile = false;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.downloadBtn.disabled = true;
      this.els.svgBadge.style.display = 'none';
      this.els.textHandle.style.display = 'none';
      this.els.tileToggle.checked = false;
      this.els.positionBlock.style.display = 'block';
      this.els.densityField.style.display = 'none';
      Array.prototype.slice.call(this.els.posGrid.querySelectorAll('.pos-btn')).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pos === 'cc')));
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    Watermark.init();
    if (window.Batch) Batch.attach(Watermark, { run: 'render', suffix: 'filigrane' });
  });
})();
