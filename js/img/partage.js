(function () {
  'use strict';

  // Dépend de js/common.js (Utils).

  const FORMATS = { og: [1200, 630], square: [1080, 1080], story: [1080, 1920], wide: [1600, 900] };
  const FONTS = {
    syne: s => '800 ' + s + 'px Syne, system-ui, sans-serif',
    sans: s => '700 ' + s + 'px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    serif: s => '700 ' + s + 'px Georgia, "Times New Roman", serif',
    mono: s => '700 ' + s + 'px ui-monospace, Menlo, Consolas, monospace'
  };

  function wrap(ctx, text, maxW) {
    const lines = [];
    String(text).split('\n').forEach(par => {
      let line = '';
      par.split(/\s+/).filter(Boolean).forEach(w => {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
      });
      lines.push(line);
    });
    return lines;
  }

  const Share = {
    state: { bg: 'gradient', align: 'left', bgImg: null, logo: null },
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        canvas: $('og-canvas'), format: $('og-format'), title: $('og-title'), subtitle: $('og-subtitle'), site: $('og-site'),
        bgBtns: [...document.querySelectorAll('#og-bg-seg button')], color1: $('og-color1'), color2: $('og-color2'),
        color2Row: $('og-color2-row'), imgField: $('og-img-field'), bgFile: $('og-bg-file'), dim: $('og-dim'), dimValue: $('og-dim-value'),
        textColor: $('og-text-color'), alignBtns: [...document.querySelectorAll('#og-align-seg button')], font: $('og-font'),
        size: $('og-size'), sizeValue: $('og-size-value'), accentToggle: $('og-accent-toggle'), accentColor: $('og-accent-color'),
        logoFile: $('og-logo-file'), logoPos: $('og-logo-pos'), logoSize: $('og-logo-size'),
        fileFormat: $('og-file-format'), downloadBtn: $('og-download-btn'), resetBtn: $('og-reset-btn'),
      };
      const redraw = () => this.schedule();
      ['format', 'title', 'subtitle', 'site', 'color1', 'color2', 'dim', 'textColor', 'font', 'size', 'accentToggle', 'accentColor', 'logoPos', 'logoSize']
        .forEach(k => this.els[k].addEventListener('input', redraw));
      this.els.format.addEventListener('change', redraw);
      this.els.dim.addEventListener('input', () => { this.els.dimValue.textContent = this.els.dim.value + '%'; });
      this.els.size.addEventListener('input', () => { this.els.sizeValue.textContent = this.els.size.value + '%'; });
      this.els.bgBtns.forEach(b => b.addEventListener('click', () => {
        this.state.bg = b.dataset.bg;
        this.els.bgBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        this.els.color2Row.style.display = this.state.bg === 'gradient' ? 'flex' : 'none';
        this.els.imgField.style.display = this.state.bg === 'image' ? 'block' : 'none';
        this.schedule();
      }));
      this.els.alignBtns.forEach(b => b.addEventListener('click', () => {
        this.state.align = b.dataset.align;
        this.els.alignBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        this.schedule();
      }));
      this.els.bgFile.addEventListener('change', async () => {
        const f = this.els.bgFile.files[0]; if (!f) return;
        try { this.state.bgImg = (await Utils.loadImage(f)).img; this.schedule(); } catch (e) { Utils.toast('Image de fond illisible.'); }
      });
      this.els.logoFile.addEventListener('change', async () => {
        const f = this.els.logoFile.files[0];
        if (!f) { this.state.logo = null; this.schedule(); return; }
        try { this.state.logo = (await Utils.loadImage(f)).img; this.schedule(); } catch (e) { Utils.toast('Logo illisible.'); }
      });
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
      this.schedule();
    },
    schedule() {
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => this.render());
    },
    async render() {
      const e = this.els, st = this.state, [W, H] = FORMATS[e.format.value] || FORMATS.og;
      const f = FONTS[e.font.value] || FONTS.syne;
      try { await document.fonts.load(f(40)); } catch (err) {}
      const c = e.canvas; c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      // fond
      if (st.bg === 'gradient') {
        const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, e.color1.value); g.addColorStop(1, e.color2.value);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = e.color1.value; ctx.fillRect(0, 0, W, H);
        if (st.bg === 'image' && st.bgImg) {
          const iw = st.bgImg.naturalWidth || st.bgImg.width, ih = st.bgImg.naturalHeight || st.bgImg.height, sc = Math.max(W / iw, H / ih);
          ctx.drawImage(st.bgImg, (W - iw * sc) / 2, (H - ih * sc) / 2, iw * sc, ih * sc);
          ctx.fillStyle = 'rgba(0,0,0,' + (parseInt(e.dim.value, 10) / 100) + ')'; ctx.fillRect(0, 0, W, H);
        }
      }
      const P = Math.round(Math.min(W, H) * 0.08), maxW = W - 2 * P, center = st.align === 'center';
      const color = e.textColor.value;
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = center ? 'center' : 'left';
      const tx = center ? W / 2 : P;
      // titre : taille réglable, réduite automatiquement s'il dépasse 4 lignes
      let ts = Math.round((W >= H ? W * 0.072 : W * 0.085) * parseInt(e.size.value, 10) / 100), lines;
      const title = e.title.value.trim() || ' ';
      for (;;) { ctx.font = f(ts); lines = wrap(ctx, title, maxW); if (lines.length <= 4 || ts <= 24) break; ts = Math.round(ts * 0.94); }
      const lh = Math.round(ts * 1.12);
      const ss = Math.round(ts * 0.4); let sub = [];
      if (e.subtitle.value.trim()) { ctx.font = FONTS.sans(ss).replace('700', '500'); sub = wrap(ctx, e.subtitle.value.trim(), maxW).slice(0, 3); }
      const slh = Math.round(ss * 1.35), accentH = e.accentToggle.checked ? Math.round(ts * 0.14) + Math.round(ts * 0.4) : 0;
      const blockH = accentH + lines.length * lh + (sub.length ? Math.round(ts * 0.4) + sub.length * slh : 0);
      let y = Math.round((H - blockH) / 2) + accentH;
      if (e.accentToggle.checked) {
        ctx.fillStyle = e.accentColor.value;
        const aw = Math.round(W * 0.09), ah = Math.round(ts * 0.14), ax = center ? (W - aw) / 2 : P;
        ctx.fillRect(ax, y - accentH, aw, ah);
      }
      ctx.fillStyle = color; ctx.font = f(ts);
      lines.forEach((l, i) => ctx.fillText(l, tx, y + ts * 0.85 + i * lh));
      y += lines.length * lh + Math.round(ts * 0.4);
      if (sub.length) {
        ctx.font = FONTS.sans(ss).replace('700', '500'); ctx.globalAlpha = 0.85;
        sub.forEach((l, i) => ctx.fillText(l, tx, y + ss * 0.9 + i * slh));
        ctx.globalAlpha = 1;
      }
      // ligne du site
      const site = e.site.value.trim();
      if (site) {
        const fs = Math.max(18, Math.round(Math.min(W, H) * 0.032));
        ctx.font = FONTS.sans(fs); ctx.globalAlpha = 0.8; ctx.fillStyle = color;
        ctx.fillText(site, tx, H - P + fs * 0.1);
        ctx.globalAlpha = 1;
      }
      // logo
      if (st.logo) {
        const lw0 = st.logo.naturalWidth || st.logo.width, lh0 = st.logo.naturalHeight || st.logo.height;
        const maxH = H * 0.13 * parseInt(e.logoSize.value, 10) / 100, sc = Math.min(maxH / lh0, (W * 0.35) / lw0), w = lw0 * sc, h = lh0 * sc;
        const pos = e.logoPos.value;
        const x = pos.endsWith('right') ? W - P - w : P, yy = pos.startsWith('top') ? P : H - P - h;
        ctx.drawImage(st.logo, x, yy, w, h);
      }
    },
    async download() {
      await this.render();
      const jpg = this.els.fileFormat.value === 'jpg';
      const [W, H] = FORMATS[this.els.format.value] || FORMATS.og;
      try {
        const blob = await Utils.canvasToBlob(this.els.canvas, jpg ? 'image/jpeg' : 'image/png', 0.92);
        Utils.download(blob, 'image-partage-' + W + 'x' + H + '.' + (jpg ? 'jpg' : 'png'));
      } catch (e) { Utils.toast(e.message || 'Export impossible.'); }
    },
    reset() {
      const e = this.els;
      e.title.value = 'Titre de votre page'; e.subtitle.value = 'Une courte description qui donne envie de cliquer'; e.site.value = 'votresite.fr';
      e.format.value = 'og'; e.color1.value = '#1f3a5f'; e.color2.value = '#2f7d6d'; e.textColor.value = '#ffffff';
      e.font.value = 'syne'; e.size.value = 100; e.sizeValue.textContent = '100%'; e.dim.value = 45; e.dimValue.textContent = '45%';
      e.accentToggle.checked = true; e.accentColor.value = '#ff6b2d'; e.logoFile.value = ''; e.bgFile.value = '';
      this.state.logo = null; this.state.bgImg = null;
      e.bgBtns.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.bg === 'gradient'))); this.state.bg = 'gradient';
      e.color2Row.style.display = 'flex'; e.imgField.style.display = 'none';
      e.alignBtns.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.align === 'left'))); this.state.align = 'left';
      this.schedule();
    }
  };

  document.addEventListener('DOMContentLoaded', function () { Share.init(); });
})();
