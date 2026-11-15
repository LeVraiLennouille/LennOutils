(function () {
  'use strict';

  // Dépend de js/common.js (Utils, Engine).

  const Enhance = {
    state: {
      data: null,
      scale: 2
    },
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('en-dropzone'),
        input: $('en-file-input'),
        stage: $('en-stage'),
        loading: $('en-loading'),
        compare: $('en-compare'),
        before: $('en-preview-before'),
        overlay: $('en-overlay'),
        after: $('en-preview-after'),
        divider: $('en-divider'),
        svgNote: $('en-svg-note'),
        stats: $('en-stats'),
        statBefore: $('en-stat-before'),
        statAfter: $('en-stat-after'),
        statSize: $('en-stat-size'),
        scaleSeg: $('en-scale-seg'),
        sharpSlider: $('en-sharpness-slider'),
        sharpValue: $('en-sharpness-value'),
        denoiseToggle: $('en-denoise-toggle'),
        downloadBtn: $('en-download-btn'),
        resetBtn: $('en-reset-btn'),
      };
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      Array.prototype.slice.call(this.els.scaleSeg.querySelectorAll('button')).forEach(btn => {
        btn.addEventListener('click', () => {
          Array.prototype.slice.call(this.els.scaleSeg.querySelectorAll('button')).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
          this.state.scale = parseFloat(btn.dataset.scale);
          this.process();
        });
      });
      this.els.sharpSlider.addEventListener('input', () => {
        this.els.sharpValue.textContent = this.els.sharpSlider.value + '%';
      });
      this.els.sharpSlider.addEventListener('change', () => this.process());
      this.els.denoiseToggle.addEventListener('change', () => this.process());
      this.setupCompareDrag();
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
    },
    setupCompareDrag() {
      let dragging = false;
      const move = (clientX) => {
        const rect = this.els.compare.getBoundingClientRect();
        let pct = ((clientX - rect.left) / rect.width) * 100;
        pct = Utils.clamp(pct, 0, 100);
        this.els.divider.style.left = pct + '%';
        this.els.overlay.style.clipPath = 'inset(0 0 0 ' + pct + '%)';
      };
      this.els.divider.addEventListener('pointerdown', (e) => {
        dragging = true;
        e.preventDefault();
        e.stopPropagation();
      });
      this.els.compare.addEventListener('pointerdown', (e) => {
        dragging = true;
        move(e.clientX);
      });
      window.addEventListener('pointermove', (e) => {
        if (dragging) move(e.clientX);
      });
      window.addEventListener('pointerup', () => {
        dragging = false;
      });
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        this.state.data = data;
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        if (data.format === 'svg') {
          this.els.svgNote.style.display = 'flex';
          this.els.compare.style.display = 'none';
          this.els.stats.style.display = 'none';
          this.els.downloadBtn.disabled = true;
          return;
        }
        this.els.svgNote.style.display = 'none';
        this.els.compare.style.display = 'block';
        this.els.stats.style.display = 'flex';
        this.els.statBefore.textContent = data.width + ' × ' + data.height;
        this.els.before.src = data.url;
        this.els.divider.style.left = '50%';
        this.els.overlay.style.clipPath = 'inset(0 0 0 50%)';
        await this.process();
      } catch (e) {
        Utils.toast(e.message || "Impossible de charger ce fichier.");
      }
    },
    async process() {
      const data = this.state.data;
      if (!data || data.format === 'svg') return;
      Utils.showLoading(this.els.loading, true);
      await Utils.nextFrame();
      try {
        const capped = Utils.capDimensions(data.width * this.state.scale, data.height * this.state.scale);
        if (capped.capped) Utils.toast('Agrandissement limité à ~30 mégapixels pour rester fluide dans le navigateur.');
        const newW = capped.width,
          newH = capped.height;
        const srcCanvas = Utils.canvasFrom(data.img, data.width, data.height);
        let srcImgData = srcCanvas.getContext('2d').getImageData(0, 0, data.width, data.height);
        let srcPixels = srcImgData.data;
        if (this.els.denoiseToggle.checked) {
          srcPixels = new Uint8ClampedArray(Engine.boxBlurRGB(srcPixels, data.width, data.height, 1));
        }
        let outData = Engine.resizeLanczos(srcPixels, data.width, data.height, newW, newH);
        const sharpAmount = parseInt(this.els.sharpSlider.value, 10) / 100;
        if (sharpAmount > 0) outData = Engine.unsharpMask(outData, newW, newH, sharpAmount * 1.15, 1);
        const outCanvas = document.createElement('canvas');
        outCanvas.width = newW;
        outCanvas.height = newH;
        outCanvas.getContext('2d').putImageData(new ImageData(outData, newW, newH), 0, 0);
        const mime = Utils.mimeFor(data.format);
        const blob = await Utils.canvasToBlob(outCanvas, mime, 0.92);
        this._resultBlob = blob;
        this._resultExt = Utils.extFor(data.format);
        this.els.after.src = URL.createObjectURL(blob);
        this.els.statAfter.textContent = newW + ' × ' + newH;
        this.els.statSize.textContent = Utils.bytesToSize(blob.size);
        this.els.downloadBtn.disabled = false;
      } catch (e) {
        Utils.toast(e.message || "L'amélioration a échoué.");
      } finally {
        Utils.showLoading(this.els.loading, false);
      }
    },
    download() {
      if (!this._resultBlob) return;
      const base = (this.state.data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      Utils.download(this._resultBlob, base + '-ameliore.' + this._resultExt);
    },
    reset() {
      this.state.data = null;
      this._resultBlob = null;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.compare.style.display = 'none';
      this.els.svgNote.style.display = 'none';
      this.els.stats.style.display = 'none';
      this.els.downloadBtn.disabled = true;
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    Enhance.init();
  });
})();
