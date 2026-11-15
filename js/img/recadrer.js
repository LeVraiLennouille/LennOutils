(function () {
  'use strict';

  // Dépend de js/common.js (Utils, Engine).

  const CropRotate = {
    state: {
      data: null,
      rotation: 0,
      flipH: false,
      flipV: false,
      aspect: null,
      crop: {
        x: 0,
        y: 0,
        w: 0,
        h: 0
      }
    },
    drag: null,
    working: null,
    displayScale: 1,
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('cr-dropzone'),
        input: $('cr-file-input'),
        stage: $('cr-stage'),
        loading: $('cr-loading'),
        cropStage: $('cr-crop-stage'),
        image: $('cr-image'),
        cropBox: $('cr-crop-box'),
        stats: $('cr-stats'),
        statSel: $('cr-stat-sel'),
        statRot: $('cr-stat-rot'),
        rotateSlider: $('cr-rotate-slider'),
        rotateValue: $('cr-rotate-value'),
        rotateLeft90: $('cr-rotate-left90'),
        rotateRight90: $('cr-rotate-right90'),
        flipHBtn: $('cr-flip-h'),
        flipVBtn: $('cr-flip-v'),
        aspectRow: $('cr-aspect-row'),
        resetCropBtn: $('cr-reset-crop-btn'),
        svgNote: $('cr-svg-note'),
        downloadBtn: $('cr-download-btn'),
        resetBtn: $('cr-reset-btn'),
      };
      this.handles = Array.prototype.slice.call(this.els.cropBox.querySelectorAll('.crop-handle'));
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      this.els.rotateSlider.addEventListener('input', () => {
        this.state.rotation = parseInt(this.els.rotateSlider.value, 10);
        this.els.rotateValue.textContent = this.state.rotation + '°';
        this.els.statRot.textContent = this.state.rotation + '°';
      });
      this.els.rotateSlider.addEventListener('change', () => this.renderWorking(true));
      this.els.rotateLeft90.addEventListener('click', () => this.nudgeRotation(-90));
      this.els.rotateRight90.addEventListener('click', () => this.nudgeRotation(90));
      this.els.flipHBtn.addEventListener('click', () => {
        this.state.flipH = !this.state.flipH;
        this.renderWorking(false);
      });
      this.els.flipVBtn.addEventListener('click', () => {
        this.state.flipV = !this.state.flipV;
        this.renderWorking(false);
      });
      Array.prototype.slice.call(this.els.aspectRow.querySelectorAll('.aspect-chip')).forEach(chip => {
        chip.addEventListener('click', () => {
          Array.prototype.slice.call(this.els.aspectRow.querySelectorAll('.aspect-chip')).forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
          const r = chip.dataset.ratio;
          this.state.aspect = r === 'free' ? null : this._parseRatio(r);
          this.resetCropRect();
          this.renderCropBox();
        });
      });
      this.els.resetCropBtn.addEventListener('click', () => {
        this.resetCropRect();
        this.renderCropBox();
      });
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
      this.els.cropBox.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('crop-handle')) return;
        e.preventDefault();
        this.startDrag('move', e);
      });
      this.handles.forEach(h => h.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.startDrag(h.dataset.h, e);
      }));
      window.addEventListener('pointermove', (e) => this.onDrag(e));
      window.addEventListener('pointerup', () => this.endDrag());
    },
    _parseRatio(r) {
      const parts = r.split(':').map(Number);
      return parts[0] / parts[1];
    },
    nudgeRotation(delta) {
      let r = this.state.rotation + delta;
      if (r > 180) r -= 360;
      if (r < -180) r += 360;
      this.state.rotation = r;
      this.els.rotateSlider.value = r;
      this.els.rotateValue.textContent = r + '°';
      this.els.statRot.textContent = r + '°';
      this.renderWorking(true);
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        if (data.isVector) {
          const targetW = Math.max(data.width, 900);
          const targetH = Math.max(1, Math.round(targetW * (data.height / data.width)));
          const raster = Utils.canvasFrom(data.img, targetW, targetH);
          data.img = raster;
          data.width = targetW;
          data.height = targetH;
          this.els.svgNote.style.display = 'flex';
        } else {
          this.els.svgNote.style.display = 'none';
        }
        this.state.data = data;
        this.state.rotation = 0;
        this.state.flipH = false;
        this.state.flipV = false;
        this.state.aspect = null;
        this.els.rotateSlider.value = 0;
        this.els.rotateValue.textContent = '0°';
        this.els.statRot.textContent = '0°';
        Array.prototype.slice.call(this.els.aspectRow.querySelectorAll('.aspect-chip')).forEach(c => c.setAttribute('aria-pressed', String(c.dataset.ratio === 'free')));
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        this.els.stats.style.display = 'flex';
        await this.renderWorking(true);
      } catch (e) {
        Utils.toast(e.message || "Impossible de charger ce fichier.");
      }
    },
    async renderWorking(resetCrop) {
      const data = this.state.data;
      if (!data) return;
      Utils.showLoading(this.els.loading, true);
      await Utils.nextFrame();
      try {
        const deg = this.state.rotation;
        const isExact90 = (deg % 90 === 0);
        const canvas = isExact90 ?
          this._rotateExact(data.img, data.width, data.height, ((deg % 360) + 360) % 360, this.state.flipH, this.state.flipV) :
          this._rotateFree(data.img, data.width, data.height, deg, this.state.flipH, this.state.flipV);
        this.working = canvas;
        const blob = await Utils.canvasToBlob(canvas, 'image/png');
        const url = URL.createObjectURL(blob);
        const oldUrl = this.els.image.src;
        await new Promise(resolve => {
          this.els.image.onload = resolve;
          this.els.image.src = url;
        });
        if (oldUrl && oldUrl.indexOf('blob:') === 0) URL.revokeObjectURL(oldUrl);
        this.displayScale = this.els.image.clientWidth / canvas.width;
        if (resetCrop || !this.state.crop.w) this.resetCropRect();
        this.renderCropBox();
        this.els.downloadBtn.disabled = false;
      } finally {
        Utils.showLoading(this.els.loading, false);
      }
    },
    _rotateExact(img, w, h, deg, flipH, flipV) {
      const swapped = (deg === 90 || deg === 270);
      const cw = swapped ? h : w,
        ch = swapped ? w : h;
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.translate(cw / 2, ch / 2);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.rotate(deg * Math.PI / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      return canvas;
    },
    _rotateFree(img, w, h, deg, flipH, flipV) {
      const rad = deg * Math.PI / 180;
      const cos = Math.abs(Math.cos(rad)),
        sin = Math.abs(Math.sin(rad));
      const cw = Math.ceil(w * cos + h * sin),
        ch = Math.ceil(w * sin + h * cos);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(cw / 2, ch / 2);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.rotate(rad);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      return canvas;
    },
    resetCropRect() {
      if (!this.working) return;
      let w = this.working.width,
        h = this.working.height;
      if (this.state.aspect) {
        const targetRatio = this.state.aspect;
        if (w / h > targetRatio) w = h * targetRatio;
        else h = w / targetRatio;
      }
      this.state.crop = {
        x: (this.working.width - w) / 2,
        y: (this.working.height - h) / 2,
        w,
        h
      };
    },
    renderCropBox() {
      const c = this.state.crop,
        s = this.displayScale;
      this.els.cropBox.style.left = (c.x * s) + 'px';
      this.els.cropBox.style.top = (c.y * s) + 'px';
      this.els.cropBox.style.width = (c.w * s) + 'px';
      this.els.cropBox.style.height = (c.h * s) + 'px';
      this.els.statSel.textContent = Math.round(c.w) + ' × ' + Math.round(c.h);
    },
    startDrag(handle, e) {
      this.drag = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startCrop: Object.assign({}, this.state.crop)
      };
    },
    onDrag(e) {
      if (!this.drag || !this.working) return;
      const s = this.displayScale || 1;
      const dx = (e.clientX - this.drag.startX) / s,
        dy = (e.clientY - this.drag.startY) / s;
      const start = this.drag.startCrop;
      const W = this.working.width,
        H = this.working.height;
      const ratio = this.state.aspect;
      const hgrip = this.drag.handle;
      let x, y, w, h;
      if (hgrip === 'move') {
        w = start.w;
        h = start.h;
        x = Utils.clamp(start.x + dx, 0, W - w);
        y = Utils.clamp(start.y + dy, 0, H - h);
      } else if (!ratio) {
        let nx = start.x,
          ny = start.y,
          nx2 = start.x + start.w,
          ny2 = start.y + start.h;
        if (hgrip.indexOf('w') !== -1) nx = Utils.clamp(start.x + dx, 0, nx2 - 20);
        if (hgrip.indexOf('e') !== -1) nx2 = Utils.clamp(start.x + start.w + dx, nx + 20, W);
        if (hgrip.indexOf('n') !== -1) ny = Utils.clamp(start.y + dy, 0, ny2 - 20);
        if (hgrip.indexOf('s') !== -1) ny2 = Utils.clamp(start.y + start.h + dy, ny + 20, H);
        x = nx;
        y = ny;
        w = nx2 - nx;
        h = ny2 - ny;
      } else if (hgrip === 'n' || hgrip === 's') {
        let ny = start.y,
          ny2 = start.y + start.h;
        if (hgrip === 'n') ny = Utils.clamp(start.y + dy, 0, ny2 - 20);
        else ny2 = Utils.clamp(start.y + start.h + dy, ny + 20, H);
        h = ny2 - ny;
        w = h * ratio;
        if (w > W) {
          w = W;
          h = w / ratio;
        }
        const cx = start.x + start.w / 2;
        x = Utils.clamp(cx - w / 2, 0, W - w);
        y = ny;
      } else if (hgrip === 'e' || hgrip === 'w') {
        let nx = start.x,
          nx2 = start.x + start.w;
        if (hgrip === 'w') nx = Utils.clamp(start.x + dx, 0, nx2 - 20);
        else nx2 = Utils.clamp(start.x + start.w + dx, nx + 20, W);
        w = nx2 - nx;
        h = w / ratio;
        if (h > H) {
          h = H;
          w = h * ratio;
        }
        const cy = start.y + start.h / 2;
        y = Utils.clamp(cy - h / 2, 0, H - h);
        x = nx;
      } else {
        let fx, fy, signX, signY, dsx, dsy;
        if (hgrip === 'nw') {
          fx = start.x + start.w;
          fy = start.y + start.h;
          signX = -1;
          signY = -1;
          dsx = start.x;
          dsy = start.y;
        } else if (hgrip === 'ne') {
          fx = start.x;
          fy = start.y + start.h;
          signX = 1;
          signY = -1;
          dsx = start.x + start.w;
          dsy = start.y;
        } else if (hgrip === 'sw') {
          fx = start.x + start.w;
          fy = start.y;
          signX = -1;
          signY = 1;
          dsx = start.x;
          dsy = start.y + start.h;
        } else {
          fx = start.x;
          fy = start.y;
          signX = 1;
          signY = 1;
          dsx = start.x + start.w;
          dsy = start.y + start.h;
        }
        const mx = dsx + dx;
        let newW = Math.max(20, Math.abs(mx - fx));
        const maxWByX = signX > 0 ? (W - fx) : fx;
        newW = Math.min(newW, Math.max(20, maxWByX));
        let newH = newW / ratio;
        const maxHByY = signY > 0 ? (H - fy) : fy;
        if (newH > maxHByY) {
          newH = Math.max(20, maxHByY);
          newW = newH * ratio;
        }
        const draggedX = fx + signX * newW,
          draggedY = fy + signY * newH;
        x = Math.min(fx, draggedX);
        y = Math.min(fy, draggedY);
        w = newW;
        h = newH;
      }
      this.state.crop = {
        x,
        y,
        w: Math.max(10, w),
        h: Math.max(10, h)
      };
      this.renderCropBox();
    },
    endDrag() {
      this.drag = null;
    },
    async download() {
      if (!this.working) return;
      const c = this.state.crop;
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(c.w));
      out.height = Math.max(1, Math.round(c.h));
      out.getContext('2d').drawImage(this.working, c.x, c.y, c.w, c.h, 0, 0, out.width, out.height);
      const blob = await Utils.canvasToBlob(out, 'image/png');
      const base = (this.state.data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      Utils.download(blob, base + '-recadre.png');
    },
    reset() {
      this.state.data = null;
      this.working = null;
      this.state.rotation = 0;
      this.state.flipH = false;
      this.state.flipV = false;
      this.state.aspect = null;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.stats.style.display = 'none';
      this.els.downloadBtn.disabled = true;
      this.els.rotateSlider.value = 0;
      this.els.rotateValue.textContent = '0°';
      this.els.image.src = '';
      Array.prototype.slice.call(this.els.aspectRow.querySelectorAll('.aspect-chip')).forEach(c => c.setAttribute('aria-pressed', String(c.dataset.ratio === 'free')));
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    CropRotate.init();
  });
})();
