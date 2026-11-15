(function () {
  'use strict';

  // Dépend de js/common.js (Utils, Engine).

  const Compress = {
    state: {
      data: null
    },
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('cp-dropzone'),
        input: $('cp-file-input'),
        stage: $('cp-stage'),
        loading: $('cp-loading'),
        preview: $('cp-preview'),
        stats: $('cp-stats'),
        statBefore: $('cp-stat-before'),
        statAfter: $('cp-stat-after'),
        statGain: $('cp-stat-gain'),
        statDims: $('cp-stat-dims'),
        controlsRaster: $('cp-controls-raster'),
        quality: $('cp-quality-slider'),
        qualityValue: $('cp-quality-value'),
        pngField: $('cp-png-field'),
        quantizeToggle: $('cp-quantize-toggle'),
        colorsSelect: $('cp-colors-select'),
        controlsSvg: $('cp-controls-svg'),
        downloadBtn: $('cp-download-btn'),
        resetBtn: $('cp-reset-btn'),
      };
      this.els.qualityField = this.els.quality.closest('.field');
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      this.els.quality.addEventListener('input', () => {
        this.els.qualityValue.textContent = this.els.quality.value + '%';
      });
      this.els.quality.addEventListener('change', () => this.process());
      this.els.quantizeToggle.addEventListener('change', () => {
        this.els.colorsSelect.disabled = !this.els.quantizeToggle.checked;
        this.process();
      });
      this.els.colorsSelect.addEventListener('change', () => this.process());
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
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
        this.els.pngField.style.display = (!isSvg && data.format === 'png') ? 'block' : 'none';
        this.els.qualityField.style.display = (!isSvg && data.format !== 'png') ? 'block' : 'none';
        this.els.quantizeToggle.checked = false;
        this.els.colorsSelect.disabled = true;
        this.els.statBefore.textContent = Utils.bytesToSize(data.fileSize);
        this.els.statDims.textContent = data.width + ' × ' + data.height;
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
          const minified = Engine.minifySVG(data.svgText);
          this._resultBlob = new Blob([minified], {
            type: 'image/svg+xml'
          });
          this._resultExt = 'svg';
        } else {
          const canvas = Utils.canvasFrom(data.img, data.width, data.height);
          const ctx = canvas.getContext('2d');
          const mime = Utils.mimeFor(data.format);
          const quality = parseInt(this.els.quality.value, 10) / 100;
          if (data.format === 'png' && this.els.quantizeToggle.checked) {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            Engine.quantizeImage(imgData.data, canvas.width, canvas.height, parseInt(this.els.colorsSelect.value, 10), true);
            ctx.putImageData(imgData, 0, 0);
          }
          const blob = await Utils.canvasToBlob(canvas, mime, quality);
          if (blob.type !== mime) throw new Error("Votre navigateur ne peut pas ré-encoder ce format ici.");
          this._resultBlob = blob;
          this._resultExt = Utils.extFor(data.format);
        }
        this.els.preview.src = URL.createObjectURL(this._resultBlob);
        this.els.statAfter.textContent = Utils.bytesToSize(this._resultBlob.size);
        const gain = data.fileSize ? Math.round((1 - this._resultBlob.size / data.fileSize) * 100) : 0;
        this.els.statGain.textContent = (gain > 0 ? '-' : gain < 0 ? '+' : '') + Math.abs(gain) + '%';
        this.els.downloadBtn.disabled = false;
      } catch (e) {
        Utils.toast(e.message || 'La compression a échoué.');
      } finally {
        Utils.showLoading(this.els.loading, false);
      }
    },
    download() {
      if (!this._resultBlob) return;
      const base = (this.state.data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      Utils.download(this._resultBlob, base + '-compresse.' + this._resultExt);
    },
    reset() {
      this.state.data = null;
      this._resultBlob = null;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.stats.style.display = 'none';
      this.els.downloadBtn.disabled = true;
      this.els.preview.src = '';
      this.els.quantizeToggle.checked = false;
      this.els.colorsSelect.disabled = true;
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    Compress.init();
    if (window.Batch) Batch.attach(Compress, { run: 'process', suffix: 'compresse' });
  });
})();
