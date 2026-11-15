(function () {
  'use strict';

  // Dépend de js/common.js (Utils, Engine).

  const Resize = {
    state: {
      data: null,
      mode: 'percent',
      lockAspect: true
    },
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('rs-dropzone'),
        input: $('rs-file-input'),
        stage: $('rs-stage'),
        loading: $('rs-loading'),
        preview: $('rs-preview'),
        stats: $('rs-stats'),
        statBefore: $('rs-stat-before'),
        statAfter: $('rs-stat-after'),
        statSize: $('rs-stat-size'),
        controlsRaster: $('rs-controls-raster'),
        modePercentBtn: $('rs-mode-percent-btn'),
        modePixelBtn: $('rs-mode-pixel-btn'),
        percentBlock: $('rs-percent-block'),
        percentSlider: $('rs-percent-slider'),
        percentValue: $('rs-percent-value'),
        pixelBlock: $('rs-pixel-block'),
        widthInput: $('rs-width-input'),
        heightInput: $('rs-height-input'),
        lockBtn: $('rs-lock-btn'),
        controlsSvg: $('rs-controls-svg'),
        svgPercent: $('rs-svg-percent'),
        svgPercentValue: $('rs-svg-percent-value'),
        presetSelect: $('rs-preset-select'),
        fitBlock: $('rs-fit-block'),
        fitSelect: $('rs-fit-select'),
        presetHint: $('rs-preset-hint'),
        downloadBtn: $('rs-download-btn'),
        resetBtn: $('rs-reset-btn'),
      };
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      this.els.presetSelect.addEventListener('change', () => this.onPreset());
      this.els.fitSelect.addEventListener('change', () => this.process());
      this.els.modePercentBtn.addEventListener('click', () => this.setMode('percent'));
      this.els.modePixelBtn.addEventListener('click', () => this.setMode('pixel'));
      this.els.percentSlider.addEventListener('input', () => {
        this.els.percentValue.textContent = this.els.percentSlider.value + '%';
      });
      this.els.percentSlider.addEventListener('change', () => this.process());
      this.els.widthInput.addEventListener('input', () => this.onWidthInput());
      this.els.heightInput.addEventListener('input', () => this.onHeightInput());
      this.els.widthInput.addEventListener('change', () => this.process());
      this.els.heightInput.addEventListener('change', () => this.process());
      this.els.lockBtn.addEventListener('click', () => {
        this.state.lockAspect = !this.state.lockAspect;
        this.els.lockBtn.setAttribute('aria-pressed', String(this.state.lockAspect));
      });
      this.els.svgPercent.addEventListener('input', () => {
        this.els.svgPercentValue.textContent = this.els.svgPercent.value + '%';
      });
      this.els.svgPercent.addEventListener('change', () => this.process());
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
    },
    onPreset() {
      const v = this.els.presetSelect.value;
      if (!v) { this.setMode('percent'); return; }
      const [w, h] = v.split('x').map(Number);
      this.state.preset = { w, h };
      this.state.mode = 'preset';
      this.els.modePercentBtn.setAttribute('aria-pressed', 'false');
      this.els.modePixelBtn.setAttribute('aria-pressed', 'false');
      this.els.percentBlock.style.display = 'none';
      this.els.pixelBlock.style.display = 'none';
      this.els.fitBlock.style.display = 'block';
      this.els.presetHint.textContent = 'Sortie : ' + w + ' × ' + h + ' px';
      if (this.state.data) this.process();
    },
    setMode(mode) {
      this.state.mode = mode;
      this.els.presetSelect.value = '';
      this.els.fitBlock.style.display = 'none';
      this.els.modePercentBtn.setAttribute('aria-pressed', String(mode === 'percent'));
      this.els.modePixelBtn.setAttribute('aria-pressed', String(mode === 'pixel'));
      this.els.percentBlock.style.display = mode === 'percent' ? 'block' : 'none';
      this.els.pixelBlock.style.display = mode === 'pixel' ? 'block' : 'none';
      if (this.state.data) this.process();
    },
    onWidthInput() {
      if (!this.state.data) return;
      const w = parseInt(this.els.widthInput.value, 10);
      if (this.state.lockAspect && w > 0) this.els.heightInput.value = Math.round(w * (this.state.data.height / this.state.data.width));
    },
    onHeightInput() {
      if (!this.state.data) return;
      const h = parseInt(this.els.heightInput.value, 10);
      if (this.state.lockAspect && h > 0) this.els.widthInput.value = Math.round(h * (this.state.data.width / this.state.data.height));
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        this.state.data = data;
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        this.els.stats.style.display = 'flex';
        const isSvg = data.format === 'svg';
        this.els.controlsRaster.style.display = isSvg ? 'none' : 'block';
        this.els.controlsSvg.style.display = isSvg ? 'block' : 'none';
        this.els.widthInput.value = data.width;
        this.els.heightInput.value = data.height;
        this.els.statBefore.textContent = data.width + ' × ' + data.height;
        this.els.percentSlider.value = 100;
        this.els.percentValue.textContent = '100%';
        this.els.svgPercent.value = 100;
        this.els.svgPercentValue.textContent = '100%';
        this.state.mode = 'percent';
        this.els.presetSelect.value = '';
        this.els.fitBlock.style.display = 'none';
        this.els.modePercentBtn.setAttribute('aria-pressed', 'true');
        this.els.modePixelBtn.setAttribute('aria-pressed', 'false');
        this.els.percentBlock.style.display = 'block';
        this.els.pixelBlock.style.display = 'none';
        await this.process();
      } catch (e) {
        Utils.toast(e.message || 'Impossible de charger ce fichier.');
      }
    },
    async process() {
      const data = this.state.data;
      if (!data) return;
      Utils.showLoading(this.els.loading, true);
      await Utils.nextFrame();
      try {
        if (data.format === 'svg') {
          const pct = parseInt(this.els.svgPercent.value, 10) / 100;
          const newW = Math.max(1, Math.round(data.width * pct)),
            newH = Math.max(1, Math.round(data.height * pct));
          const doc = new DOMParser().parseFromString(data.svgText, 'image/svg+xml');
          const svg = doc.documentElement;
          if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 ' + data.width + ' ' + data.height);
          svg.setAttribute('width', String(newW));
          svg.setAttribute('height', String(newH));
          const serialized = new XMLSerializer().serializeToString(svg);
          this._resultBlob = new Blob([serialized], {
            type: 'image/svg+xml'
          });
          this._resultExt = 'svg';
          this.els.preview.src = URL.createObjectURL(this._resultBlob);
          this.els.statAfter.textContent = newW + ' × ' + newH;
          this.els.statSize.textContent = Utils.bytesToSize(this._resultBlob.size);
        } else {
          let outCanvas, newW, newH;
          if (this.state.mode === 'preset') {
            const P = this.state.preset, fit = this.els.fitSelect.value;
            newW = P.w; newH = P.h;
            const sc = fit === 'cover' ? Math.max(P.w / data.width, P.h / data.height) : Math.min(P.w / data.width, P.h / data.height);
            let cw = data.width, ch = data.height, sx = 0, sy = 0, rw = P.w, rh = P.h, dx = 0, dy = 0;
            if (fit === 'cover') {
              cw = Math.min(data.width, Math.round(P.w / sc)); ch = Math.min(data.height, Math.round(P.h / sc));
              sx = Math.round((data.width - cw) / 2); sy = Math.round((data.height - ch) / 2);
            } else if (fit === 'contain') {
              rw = Math.max(1, Math.round(data.width * sc)); rh = Math.max(1, Math.round(data.height * sc));
              dx = Math.round((P.w - rw) / 2); dy = Math.round((P.h - rh) / 2);
            }
            const srcCanvas = document.createElement('canvas');
            srcCanvas.width = cw; srcCanvas.height = ch;
            srcCanvas.getContext('2d').drawImage(data.img, sx, sy, cw, ch, 0, 0, cw, ch);
            const srcImgData = srcCanvas.getContext('2d').getImageData(0, 0, cw, ch);
            const outData = Engine.resizeLanczos(srcImgData.data, cw, ch, rw, rh);
            const part = document.createElement('canvas');
            part.width = rw; part.height = rh;
            part.getContext('2d').putImageData(new ImageData(outData, rw, rh), 0, 0);
            outCanvas = document.createElement('canvas');
            outCanvas.width = newW; outCanvas.height = newH;
            const octx = outCanvas.getContext('2d');
            if (fit === 'contain' && data.format === 'jpg') { octx.fillStyle = '#fff'; octx.fillRect(0, 0, newW, newH); }
            octx.drawImage(part, dx, dy);
          } else {
            let targetW, targetH;
            if (this.state.mode === 'percent') {
              const pct = parseInt(this.els.percentSlider.value, 10) / 100;
              targetW = data.width * pct;
              targetH = data.height * pct;
            } else {
              targetW = parseInt(this.els.widthInput.value, 10) || data.width;
              targetH = parseInt(this.els.heightInput.value, 10) || data.height;
              if (this.state.batch && this.state.lockAspect) targetH = targetW * (data.height / data.width);
            }
            const capped = Utils.capDimensions(targetW, targetH);
            if (capped.capped) Utils.toast('Dimensions limitées à ~30 mégapixels pour rester fluide dans le navigateur.');
            newW = capped.width;
            newH = capped.height;
            const srcCanvas = Utils.canvasFrom(data.img, data.width, data.height);
            const srcImgData = srcCanvas.getContext('2d').getImageData(0, 0, data.width, data.height);
            const outData = Engine.resizeLanczos(srcImgData.data, data.width, data.height, newW, newH);
            outCanvas = document.createElement('canvas');
            outCanvas.width = newW;
            outCanvas.height = newH;
            outCanvas.getContext('2d').putImageData(new ImageData(outData, newW, newH), 0, 0);
          }
          const mime = Utils.mimeFor(data.format);
          const blob = await Utils.canvasToBlob(outCanvas, mime, 0.92);
          this._resultBlob = blob;
          this._resultExt = Utils.extFor(data.format);
          this.els.preview.src = URL.createObjectURL(blob);
          this.els.statAfter.textContent = newW + ' × ' + newH;
          this.els.statSize.textContent = Utils.bytesToSize(blob.size);
        }
        this.els.downloadBtn.disabled = false;
      } catch (e) {
        Utils.toast(e.message || 'Le redimensionnement a échoué.');
      } finally {
        Utils.showLoading(this.els.loading, false);
      }
    },
    download() {
      if (!this._resultBlob) return;
      const base = (this.state.data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      Utils.download(this._resultBlob, base + '-redimensionne.' + this._resultExt);
    },
    reset() {
      this.state.data = null;
      this._resultBlob = null;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.stats.style.display = 'none';
      this.els.downloadBtn.disabled = true;
      this.els.preview.src = '';
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    Resize.init();
    if (window.Batch) Batch.attach(Resize, { run: 'process', suffix: 'redimensionne' });
  });
})();
