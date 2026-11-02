(function () {
  'use strict';

  // Dépend de js/common.js (Utils, Engine).

  const Convert = {
    state: {
      data: null
    },
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('cv-dropzone'),
        input: $('cv-file-input'),
        stage: $('cv-stage'),
        loading: $('cv-loading'),
        preview: $('cv-preview'),
        stats: $('cv-stats'),
        statFrom: $('cv-stat-from'),
        statTo: $('cv-stat-to'),
        statSize: $('cv-stat-size'),
        formatSelect: $('cv-format-select'),
        optAvif: $('cv-opt-avif'),
        qualityRow: $('cv-quality-row'),
        qualitySlider: $('cv-quality-slider'),
        qualityValue: $('cv-quality-value'),
        svgScaleRow: $('cv-svg-scale-row'),
        svgWidth: $('cv-svg-width'),
        notice: $('cv-notice'),
        downloadBtn: $('cv-download-btn'),
        resetBtn: $('cv-reset-btn'),
      };
      Utils.checkAvifSupport().then(supported => {
        if (!supported) {
          this.els.optAvif.disabled = true;
          this.els.optAvif.textContent = 'AVIF — indisponible sur ce navigateur';
        }
      });
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      this.els.formatSelect.addEventListener('change', () => {
        this.updateFormatUI();
        this.process();
      });
      this.els.qualitySlider.addEventListener('input', () => {
        this.els.qualityValue.textContent = this.els.qualitySlider.value + '%';
      });
      this.els.qualitySlider.addEventListener('change', () => this.process());
      this.els.svgWidth.addEventListener('change', () => this.process());
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
    },
    updateFormatUI() {
      const fmt = this.els.formatSelect.value;
      this.els.qualityRow.style.display = (fmt === 'jpg' || fmt === 'webp' || fmt === 'avif') ? 'block' : 'none';
      const isSvgSource = this.state.data && this.state.data.format === 'svg';
      this.els.svgScaleRow.style.display = (isSvgSource && fmt !== 'svg') ? 'block' : 'none';
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        this.state.data = data;
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        this.els.stats.style.display = 'flex';
        this.els.statFrom.textContent = Utils.labelFor(data.format);
        if (data.isVector) this.els.svgWidth.value = data.width;
        this.updateFormatUI();
        await this.process();
      } catch (e) {
        Utils.toast(e.message || "Impossible de charger ce fichier.");
      }
    },
    async process() {
      const data = this.state.data;
      if (!data) return;
      const targetFormat = this.els.formatSelect.value;
      this.els.notice.style.display = 'none';
      Utils.showLoading(this.els.loading, true);
      await Utils.nextFrame();
      try {
        if (targetFormat === 'svg') {
          let outText;
          if (data.format === 'svg') {
            outText = Engine.minifySVG(data.svgText);
          } else {
            const canvas = Utils.canvasFrom(data.img, data.width, data.height);
            const dataUrl = canvas.toDataURL('image/png');
            outText = '<svg xmlns="http://www.w3.org/2000/svg" width="' + data.width + '" height="' + data.height + '" viewBox="0 0 ' + data.width + ' ' + data.height + '"><image width="' + data.width + '" height="' + data.height + '" href="' + dataUrl + '"/></svg>';
            this.els.notice.style.display = 'flex';
            this.els.notice.textContent = "Ce SVG encapsule l'image en base64 : ce n'est pas une vectorisation par tracé, mais un conteneur vectoriel valide et portable.";
          }
          this._resultBlob = new Blob([outText], {
            type: 'image/svg+xml'
          });
          this._resultExt = 'svg';
        } else {
          let sourceCanvas;
          if (data.format === 'svg') {
            const targetW = Math.max(16, parseInt(this.els.svgWidth.value, 10) || data.width);
            const targetH = Math.max(1, Math.round(targetW * (data.height / data.width)));
            sourceCanvas = Utils.canvasFrom(data.img, targetW, targetH);
          } else {
            sourceCanvas = Utils.canvasFrom(data.img, data.width, data.height);
          }
          const mime = Utils.mimeFor(targetFormat);
          const quality = parseInt(this.els.qualitySlider.value, 10) / 100;
          const blob = await Utils.canvasToBlob(sourceCanvas, mime, quality);
          if (blob.type !== mime) {
            this.els.notice.style.display = 'flex';
            this.els.notice.textContent = "Votre navigateur ne prend pas en charge l'export " + Utils.labelFor(targetFormat) + " : image renvoyée en " + Utils.labelFor(Utils.extForMime(blob.type)) + " à la place.";
          }
          this._resultBlob = blob;
          this._resultExt = Utils.extForMime(blob.type);
        }
        this.els.preview.src = URL.createObjectURL(this._resultBlob);
        this.els.statTo.textContent = Utils.labelFor(this._resultExt);
        this.els.statSize.textContent = Utils.bytesToSize(this._resultBlob.size);
        this.els.downloadBtn.disabled = false;
      } catch (e) {
        Utils.toast(e.message || "La conversion a échoué.");
      } finally {
        Utils.showLoading(this.els.loading, false);
      }
    },
    download() {
      if (!this._resultBlob) return;
      const base = (this.state.data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      Utils.download(this._resultBlob, base + '-converti.' + this._resultExt);
    },
    reset() {
      this.state.data = null;
      this._resultBlob = null;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.stats.style.display = 'none';
      this.els.downloadBtn.disabled = true;
      this.els.preview.src = '';
      this.els.notice.style.display = 'none';
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    Convert.init();
    if (window.Batch) Batch.attach(Convert, { run: 'process', suffix: 'converti' });
  });
})();
