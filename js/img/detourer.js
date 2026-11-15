(function () {
  'use strict';

  // Dépend de js/common.js (Utils, Engine).

  const RemoveBG = {
    state: {
      data: null,
      mode: 'auto',
      brushMode: 'erase'
    },
    canvas: null,
    ctx: null,
    _original: null,
    undoSnapshot: null,
    isPainting: false,
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('bg-dropzone'),
        input: $('bg-file-input'),
        stage: $('bg-stage'),
        loading: $('bg-loading'),
        canvas: $('bg-canvas'),
        brushCursor: $('bg-brush-cursor'),
        stats: $('bg-stats'),
        statMode: $('bg-stat-mode'),
        statTol: $('bg-stat-tol'),
        statDims: $('bg-stat-dims'),
        svgNote: $('bg-svg-note'),
        modeSeg: $('bg-mode-seg'),
        modeHint: $('bg-mode-hint'),
        toleranceSlider: $('bg-tolerance-slider'),
        toleranceValue: $('bg-tolerance-value'),
        featherSlider: $('bg-feather-slider'),
        featherValue: $('bg-feather-value'),
        restoreBtn: $('bg-restore-btn'),
        brushSeg: $('bg-brush-seg'),
        brushSize: $('bg-brush-size'),
        brushSizeValue: $('bg-brush-size-value'),
        undoBtn: $('bg-undo-btn'),
        exportFormat: $('bg-export-format'),
        matteRow: $('bg-matte-row'),
        matteColor: $('bg-matte-color'),
        downloadBtn: $('bg-download-btn'),
        resetBtn: $('bg-reset-btn'),
      };
      this.canvas = this.els.canvas;
      this.ctx = this.canvas.getContext('2d', {
        willReadFrequently: true
      });
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      Array.prototype.slice.call(this.els.modeSeg.querySelectorAll('button')).forEach(btn => {
        btn.addEventListener('click', () => {
          Array.prototype.slice.call(this.els.modeSeg.querySelectorAll('button')).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
          this.state.mode = btn.dataset.mode;
          this.els.statMode.textContent = this.state.mode === 'auto' ? 'Auto' : 'Points manuels';
          this.els.modeHint.textContent = this.state.mode === 'auto' ?
            "Détecte le fond depuis les bords de l'image. Ajustez, puis relâchez le curseur." :
            "Cliquez sur une zone de fond dans l'aperçu pour la retirer à partir de ce point.";
        });
      });
      this.els.toleranceSlider.addEventListener('input', () => {
        this.els.toleranceValue.textContent = this.els.toleranceSlider.value;
        this.els.statTol.textContent = this.els.toleranceSlider.value;
      });
      this.els.toleranceSlider.addEventListener('change', () => {
        if (this.state.mode === 'auto') this.runAutoDetect();
      });
      this.els.featherSlider.addEventListener('input', () => {
        this.els.featherValue.textContent = this.els.featherSlider.value;
      });
      this.els.featherSlider.addEventListener('change', () => {
        if (this.state.mode === 'auto') this.runAutoDetect();
      });
      this.els.restoreBtn.addEventListener('click', () => this.restoreOriginal());
      Array.prototype.slice.call(this.els.brushSeg.querySelectorAll('button')).forEach(btn => {
        btn.addEventListener('click', () => {
          Array.prototype.slice.call(this.els.brushSeg.querySelectorAll('button')).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
          this.state.brushMode = btn.dataset.brush;
        });
      });
      this.els.brushSize.addEventListener('input', () => {
        this.els.brushSizeValue.textContent = this.els.brushSize.value + ' px';
      });
      this.els.undoBtn.addEventListener('click', () => this.undo());
      this.els.exportFormat.addEventListener('change', () => {
        this.els.matteRow.style.display = this.els.exportFormat.value === 'jpg' ? 'flex' : 'none';
      });
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
      this.setupCanvasPointer();
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        let img = data.img,
          w = data.width,
          h = data.height;
        if (data.isVector) {
          const targetW = Math.max(w, 800);
          const targetH = Math.max(1, Math.round(targetW * (h / w)));
          img = Utils.canvasFrom(img, targetW, targetH);
          w = targetW;
          h = targetH;
          this.els.svgNote.style.display = 'flex';
        } else {
          this.els.svgNote.style.display = 'none';
        }
        this.state.data = Object.assign({}, data, {
          img,
          width: w,
          height: h
        });
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx.drawImage(img, 0, 0, w, h);
        this._original = this.ctx.getImageData(0, 0, w, h);
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        this.els.stats.style.display = 'flex';
        this.els.statDims.textContent = w + ' × ' + h;
        this.undoSnapshot = null;
        this.els.undoBtn.disabled = true;
        await Utils.nextFrame();
        await this.runAutoDetect();
      } catch (e) {
        Utils.toast(e.message || "Impossible de charger ce fichier.");
      }
    },
    saveUndo() {
      this.undoSnapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.els.undoBtn.disabled = false;
    },
    undo() {
      if (!this.undoSnapshot) return;
      this.ctx.putImageData(this.undoSnapshot, 0, 0);
      this.undoSnapshot = null;
      this.els.undoBtn.disabled = true;
      this.els.downloadBtn.disabled = false;
    },
    restoreOriginal() {
      if (!this._original) return;
      this.saveUndo();
      this.ctx.putImageData(this._original, 0, 0);
      this.els.downloadBtn.disabled = false;
    },
    async runAutoDetect() {
      if (!this.state.data) return;
      this.saveUndo();
      Utils.showLoading(this.els.loading, true);
      await Utils.nextFrame();
      try {
        const w = this.canvas.width,
          h = this.canvas.height;
        this.ctx.putImageData(this._original, 0, 0);
        const imgData = this.ctx.getImageData(0, 0, w, h);
        const tol = parseInt(this.els.toleranceSlider.value, 10);
        const seeds = [];
        for (let x = 0; x < w; x++) {
          seeds.push([x, 0]);
          seeds.push([x, h - 1]);
        }
        for (let y = 0; y < h; y++) {
          seeds.push([0, y]);
          seeds.push([w - 1, y]);
        }
        Engine.floodFillBackground(imgData.data, w, h, tol, seeds);
        const feather = parseInt(this.els.featherSlider.value, 10);
        if (feather > 0) Engine.featherAlpha(imgData.data, w, h, feather);
        this.ctx.putImageData(imgData, 0, 0);
        this.els.downloadBtn.disabled = false;
      } finally {
        Utils.showLoading(this.els.loading, false);
      }
    },
    setupCanvasPointer() {
      const toImageCoords = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width,
          sy = this.canvas.height / rect.height;
        return {
          x: (e.clientX - rect.left) * sx,
          y: (e.clientY - rect.top) * sy,
          cssX: e.clientX - rect.left,
          cssY: e.clientY - rect.top,
          cssScale: rect.width / this.canvas.width
        };
      };
      this.canvas.addEventListener('pointermove', (e) => {
        if (!this.state.data) return;
        const p = toImageCoords(e);
        const size = parseInt(this.els.brushSize.value, 10);
        this.els.brushCursor.style.display = 'block';
        this.els.brushCursor.style.width = this.els.brushCursor.style.height = (size * p.cssScale) + 'px';
        this.els.brushCursor.style.left = p.cssX + 'px';
        this.els.brushCursor.style.top = p.cssY + 'px';
        if (this.isPainting) this.paintAt(p.x, p.y);
      });
      this.canvas.addEventListener('pointerleave', () => {
        this.els.brushCursor.style.display = 'none';
      });
      this.canvas.addEventListener('pointerdown', (e) => {
        if (!this.state.data) return;
        const p = toImageCoords(e);
        if (this.state.mode === 'manual') {
          this.saveUndo();
          const w = this.canvas.width,
            h = this.canvas.height;
          const imgData = this.ctx.getImageData(0, 0, w, h);
          Engine.floodFillBackground(imgData.data, w, h, parseInt(this.els.toleranceSlider.value, 10), [
            [Math.round(p.x), Math.round(p.y)]
          ]);
          const feather = parseInt(this.els.featherSlider.value, 10);
          if (feather > 0) Engine.featherAlpha(imgData.data, w, h, feather);
          this.ctx.putImageData(imgData, 0, 0);
          this.els.downloadBtn.disabled = false;
        } else {
          this.isPainting = true;
          this.saveUndo();
          this.paintAt(p.x, p.y);
        }
      });
      window.addEventListener('pointerup', () => {
        this.isPainting = false;
      });
    },
    paintAt(x, y) {
      const w = this.canvas.width,
        h = this.canvas.height;
      const size = parseInt(this.els.brushSize.value, 10);
      const r = size / 2;
      const rx0 = Utils.clamp(Math.floor(x - r - 1), 0, w - 1),
        ry0 = Utils.clamp(Math.floor(y - r - 1), 0, h - 1);
      const rx1 = Utils.clamp(Math.ceil(x + r + 1), 0, w),
        ry1 = Utils.clamp(Math.ceil(y + r + 1), 0, h);
      const rw = Math.max(1, rx1 - rx0),
        rh = Math.max(1, ry1 - ry0);
      const imgData = this.ctx.getImageData(rx0, ry0, rw, rh);
      const erase = this.state.brushMode === 'erase';
      const orig = this._original.data;
      for (let yy = 0; yy < rh; yy++) {
        for (let xx = 0; xx < rw; xx++) {
          const gx = rx0 + xx,
            gy = ry0 + yy;
          const d = Math.hypot(gx - x, gy - y);
          if (d <= r) {
            const i = (yy * rw + xx) * 4;
            const edge = Math.max(0.6, r - 1.2);
            if (erase) {
              const a = d <= edge ? 0 : Utils.clamp((d - edge) / 1.2, 0, 1) * 255;
              imgData.data[i + 3] = Math.min(imgData.data[i + 3], a);
            } else {
              const gi = (gy * w + gx) * 4;
              const targetA = orig[gi + 3];
              const blend = d <= edge ? 1 : Utils.clamp((r - d) / 1.2, 0, 1);
              imgData.data[i] = orig[gi];
              imgData.data[i + 1] = orig[gi + 1];
              imgData.data[i + 2] = orig[gi + 2];
              imgData.data[i + 3] = Math.max(imgData.data[i + 3], targetA * blend);
            }
          }
        }
      }
      this.ctx.putImageData(imgData, rx0, ry0);
      this.els.downloadBtn.disabled = false;
    },
    async download() {
      if (!this.state.data) return;
      const w = this.canvas.width,
        h = this.canvas.height;
      const format = this.els.exportFormat.value;
      let outCanvas = this.canvas;
      if (format === 'jpg') {
        const flat = document.createElement('canvas');
        flat.width = w;
        flat.height = h;
        const fctx = flat.getContext('2d');
        fctx.fillStyle = this.els.matteColor.value;
        fctx.fillRect(0, 0, w, h);
        fctx.drawImage(this.canvas, 0, 0);
        outCanvas = flat;
      }
      const mime = Utils.mimeFor(format);
      const blob = await Utils.canvasToBlob(outCanvas, mime, format === 'jpg' ? 0.92 : undefined);
      const base = (this.state.data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      Utils.download(blob, base + '-detoure.' + Utils.extForMime(blob.type));
    },
    reset() {
      this.state.data = null;
      this._original = null;
      this.undoSnapshot = null;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.stats.style.display = 'none';
      this.els.downloadBtn.disabled = true;
      this.els.undoBtn.disabled = true;
      this.els.svgNote.style.display = 'none';
      if (this.canvas.width && this.canvas.height) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    RemoveBG.init();
  });
})();
