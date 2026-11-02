(function () {
  'use strict';

  // Dépend de js/common.js (Utils, Engine) et js/batch.js (Batch).
  // JPEG, PNG et WebP : les métadonnées sont retirées sans ré-encoder l'image (aucune perte).
  // SVG : nettoyage du balisage d'éditeur. Autres formats : ré-encodage (les métadonnées ne sont pas conservées).

  const ascii = (u8, o, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(u8[o + i]); return s; };

  /* ---------- Lecture EXIF (TIFF) ---------- */
  function parseTiff(buf, start) {
    try {
      const dv = new DataView(buf), len = buf.byteLength;
      if (len < start + 8) return null;
      const bo = dv.getUint16(start);
      if (bo !== 0x4949 && bo !== 0x4D4D) return null;
      const le = bo === 0x4949;
      if (dv.getUint16(start + 2, le) !== 42) return null;
      const g16 = o => dv.getUint16(start + o, le), g32 = o => dv.getUint32(start + o, le);
      const tsz = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
      const readIFD = off => {
        const res = {};
        if (start + off + 2 > len) return res;
        const n = Math.min(g16(off), 200);
        for (let i = 0; i < n; i++) {
          const e = off + 2 + i * 12;
          if (start + e + 12 > len) break;
          const tag = g16(e), type = g16(e + 2), cnt = g32(e + 4), sz = (tsz[type] || 1) * cnt;
          const vo = sz <= 4 ? e + 8 : g32(e + 8);
          if (sz > 4096 || start + vo + sz > len) continue;
          let val;
          if (type === 2) { let s = ''; for (let k = 0; k < cnt - 1; k++) { const c = dv.getUint8(start + vo + k); if (c) s += String.fromCharCode(c); } val = s.trim(); }
          else if (type === 3) val = cnt === 1 ? g16(vo) : Array.from({ length: cnt }, (_, k) => g16(vo + k * 2));
          else if (type === 4) val = g32(vo);
          else if (type === 5) val = Array.from({ length: cnt }, (_, k) => g32(vo + k * 8) / (g32(vo + k * 8 + 4) || 1));
          else continue;
          res[tag] = val;
        }
        return res;
      };
      const a = readIFD(g32(4));
      return { a, e: a[0x8769] != null ? readIFD(a[0x8769]) : {}, g: a[0x8825] != null ? readIFD(a[0x8825]) : {} };
    } catch (e) { return null; }
  }

  const fmtDate = s => { const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/.exec(s || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] + ':' + m[5] : s; };
  const dms = (v, ref) => { if (!Array.isArray(v) || v.length < 3) return null; const d = v[0] + v[1] / 60 + v[2] / 3600; return d.toFixed(5) + '° ' + (ref || ''); };

  function summarize(t) {
    const r = [];
    if (!t) return r;
    const mk = [t.a[0x010F], t.a[0x0110]].filter(Boolean).join(' ');
    if (mk) r.push({ k: 'Appareil', v: mk });
    if (t.e[0xA434]) r.push({ k: 'Objectif', v: t.e[0xA434] });
    const d = t.e[0x9003] || t.a[0x0132];
    if (d) r.push({ k: 'Date de prise de vue', v: fmtDate(d) });
    if (t.a[0x0131]) r.push({ k: 'Logiciel', v: t.a[0x0131] });
    if (t.a[0x013B]) r.push({ k: 'Auteur', v: t.a[0x013B] });
    if (t.a[0x8298]) r.push({ k: 'Copyright', v: t.a[0x8298] });
    const la = dms(t.g[2], t.g[1]), lo = dms(t.g[4], t.g[3]);
    if (la && lo) r.push({ k: 'Position GPS', v: la + ', ' + lo, warn: true });
    return r;
  }

  /* ---------- JPEG ---------- */
  function stripJpeg(u8, opt) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (u8.length < 4 || dv.getUint16(0) !== 0xFFD8) throw new Error('JPEG invalide');
    const keep = [u8.subarray(0, 2)], other = new Set();
    let p = 2, tiff = null;
    while (p + 4 <= u8.length) {
      if (u8[p] !== 0xFF) break;
      const m = u8[p + 1];
      if (m === 0xFF) { p++; continue; }
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { keep.push(u8.subarray(p, p + 2)); p += 2; continue; }
      if (m === 0xDA) { keep.push(u8.subarray(p)); p = u8.length; break; }
      const len = dv.getUint16(p + 2), seg = u8.subarray(p, p + 2 + len);
      let drop = false;
      if (m === 0xE1) {
        drop = true;
        if (ascii(seg, 4, 4) === 'Exif') tiff = parseTiff(seg.buffer.slice(seg.byteOffset + 10, seg.byteOffset + 2 + len), 0);
        else if (ascii(seg, 4, 28).indexOf('ns.adobe.com/xap') >= 0) other.add('XMP');
        else other.add('Données APP1');
      } else if (m === 0xED) { drop = true; other.add('IPTC / Photoshop'); }
      else if (m === 0xFE) { drop = true; other.add('Commentaire'); }
      else if (m === 0xE2) { if (!(opt.keepIcc && ascii(seg, 4, 11) === 'ICC_PROFILE')) { drop = true; other.add(ascii(seg, 4, 11) === 'ICC_PROFILE' ? 'Profil colorimétrique' : 'Données APP2'); } }
      else if (m >= 0xE3 && m <= 0xEF && m !== 0xEE) { drop = true; other.add('Données APP' + (m - 0xE0)); }
      if (!drop) keep.push(seg);
      p += 2 + len;
    }
    const orient = tiff && tiff.a[0x0112];
    if (opt.keepOrientation && orient > 1) {
      const ex = new Uint8Array([0xFF, 0xE1, 0, 34, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4D, 0x4D, 0, 0x2A, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orient & 255, 0, 0, 0, 0, 0, 0]);
      const at = keep[1] && keep[1][0] === 0xFF && keep[1][1] === 0xE0 ? 2 : 1;
      keep.splice(at, 0, ex);
    }
    const report = summarize(tiff);
    if (orient > 1 && opt.keepOrientation) report.push({ k: 'Orientation', v: 'conservée pour un affichage correct', keep: true });
    other.forEach(k => report.push({ k: 'Autres', v: k }));
    return { blob: new Blob(keep, { type: 'image/jpeg' }), report };
  }

  /* ---------- PNG ---------- */
  function stripPng(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (ascii(u8, 1, 3) !== 'PNG') throw new Error('PNG invalide');
    const keep = [u8.subarray(0, 8)], other = new Set();
    let p = 8, tiff = null;
    while (p + 12 <= u8.length) {
      const len = dv.getUint32(p), type = ascii(u8, p + 4, 4), total = 12 + len;
      if (p + total > u8.length) { keep.push(u8.subarray(p)); break; }
      const chunk = u8.subarray(p, p + total);
      if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
        let k = 0; while (k < Math.min(len, 80) && u8[p + 8 + k]) k++;
        const key = ascii(u8, p + 8, k);
        other.add(key === 'XML:com.adobe.xmp' ? 'XMP' : 'Texte : ' + key);
      } else if (type === 'eXIf') {
        tiff = parseTiff(chunk.buffer.slice(chunk.byteOffset + 8, chunk.byteOffset + 8 + len), 0);
      } else if (type === 'tIME') { other.add('Date de modification'); }
      else keep.push(chunk);
      p += total;
      if (type === 'IEND') break;
    }
    const report = summarize(tiff);
    other.forEach(k => report.push({ k: 'Autres', v: k }));
    return { blob: new Blob(keep, { type: 'image/png' }), report };
  }

  /* ---------- WebP ---------- */
  function stripWebp(u8) {
    if (ascii(u8, 0, 4) !== 'RIFF' || ascii(u8, 8, 4) !== 'WEBP') throw new Error('WebP invalide');
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), chunks = [], other = new Set();
    let p = 12, tiff = null, size = 4;
    while (p + 8 <= u8.length) {
      const id = ascii(u8, p, 4), len = dv.getUint32(p + 4, true), pad = len + (len & 1), end = Math.min(u8.length, p + 8 + pad);
      let c = u8.subarray(p, end);
      if (id === 'EXIF') {
        const off = ascii(u8, p + 8, 4) === 'Exif' ? 6 : 0;
        tiff = parseTiff(u8.buffer.slice(u8.byteOffset + p + 8 + off, u8.byteOffset + p + 8 + len), 0);
        p = end; continue;
      }
      if (id === 'XMP ') { other.add('XMP'); p = end; continue; }
      if (id === 'VP8X') { c = c.slice(); c[8] &= ~0x0C; }
      chunks.push(c); size += c.length; p = end;
    }
    const head = new DataView(new ArrayBuffer(12));
    new Uint8Array(head.buffer).set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    head.setUint32(4, size, true);
    const report = summarize(tiff);
    other.forEach(k => report.push({ k: 'Autres', v: k }));
    return { blob: new Blob([head.buffer, ...chunks], { type: 'image/webp' }), report };
  }

  const Meta = {
    state: { items: [] },
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('md-dropzone'), input: $('md-file-input'), stage: $('md-stage'), list: $('md-list'),
        loading: $('md-loading'), keepOrient: $('md-orient-toggle'), keepIcc: $('md-icc-toggle'),
        downloadBtn: $('md-download-btn'), resetBtn: $('md-reset-btn'),
      };
      Utils.setupDropzone(this.els.dropzone, this.els.input, () => {});
      // setupDropzone gère le dépôt ; on récupère la liste complète via Batch.queue
      const origQueue = Batch.setQueue.bind(Batch);
      Batch.setQueue = files => { origQueue(files); if (files.length) this.run(files); };
      this.els.keepOrient.addEventListener('change', () => this.rerun());
      this.els.keepIcc.addEventListener('change', () => this.rerun());
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
    },
    rerun() { if (Batch.queue.length) this.run(Batch.queue.slice()); },
    async processFile(file) {
      const format = Utils.detectFormat(file), base = (file.name || 'image').replace(/\.[a-z0-9]+$/i, '');
      const opt = { keepOrientation: this.els.keepOrient.checked, keepIcc: this.els.keepIcc.checked };
      if (format === 'svg') {
        const text = await Utils.readFileAsText(file);
        const report = [];
        if (/<metadata[\s>]/i.test(text)) report.push({ k: 'Autres', v: 'Métadonnées RDF' });
        if (/(inkscape|sodipodi|illustrator|sketch)/i.test(text)) report.push({ k: 'Logiciel', v: 'Balisage d’éditeur' });
        if (/<!--/.test(text)) report.push({ k: 'Autres', v: 'Commentaires' });
        return { name: base + '-sans-metadonnees.svg', blob: new Blob([Engine.minifySVG(text)], { type: 'image/svg+xml' }), report, format };
      }
      const u8 = new Uint8Array(await file.arrayBuffer());
      let out = null;
      if (format === 'jpg') out = stripJpeg(u8, opt);
      else if (format === 'png') out = stripPng(u8);
      else if (format === 'webp') out = stripWebp(u8);
      if (out) return { name: base + '-sans-metadonnees.' + Utils.extFor(format), blob: out.blob, report: out.report, format };
      // autres formats : ré-encodage via le canvas (métadonnées non conservées)
      const data = await Utils.loadImage(file);
      const c = Utils.canvasFrom(data.img, data.width, data.height);
      let blob = await Utils.canvasToBlob(c, 'image/webp', 0.95);
      if (blob.type !== 'image/webp') blob = await Utils.canvasToBlob(c, 'image/png');
      return { name: base + '-sans-metadonnees.' + Utils.extForMime(blob.type), blob, format,
        report: [{ k: 'Autres', v: 'Image ré-encodée : métadonnées retirées, légère perte possible' }] };
    },
    async run(files) {
      this.els.dropzone.style.display = 'none';
      this.els.stage.classList.add('is-active');
      Utils.showLoading(this.els.loading, true);
      await Utils.nextFrame();
      const items = [];
      for (const f of files) {
        try { const r = await this.processFile(f); r.before = f.size; r.source = f.name; items.push(r); }
        catch (e) { items.push({ source: f.name, error: e.message || 'Fichier illisible' }); }
      }
      this.state.items = items;
      this.renderList();
      this.els.downloadBtn.disabled = !items.some(i => i.blob);
      this.els.downloadBtn.textContent = items.filter(i => i.blob).length > 1 ? 'Tout télécharger (.zip)' : 'Télécharger';
      Utils.showLoading(this.els.loading, false);
    },
    renderList() {
      const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      this.els.list.innerHTML = this.state.items.map(it => {
        if (it.error) return '<li class="md-item"><div class="md-head"><b>' + esc(it.source) + '</b></div><p class="md-err">' + esc(it.error) + '</p></li>';
        const found = it.report.filter(r => !r.keep);
        const tags = it.report.map(r => '<li class="md-tag' + (r.warn ? ' warn' : '') + (r.keep ? ' keep' : '') + '"><span>' + esc(r.k) + '</span> ' + esc(r.v) + '</li>').join('');
        return '<li class="md-item"><div class="md-head"><b>' + esc(it.source) + '</b><span class="mono">' + Utils.bytesToSize(it.before) + ' → ' + Utils.bytesToSize(it.blob.size) + '</span></div>' +
          (found.length ? '<p class="md-sub">Retiré :</p><ul class="md-tags">' + tags + '</ul>' : '<p class="md-clean">Aucune métadonnée à retirer dans ce fichier.</p>') + '</li>';
      }).join('');
    },
    async download() {
      const ok = this.state.items.filter(i => i.blob);
      if (!ok.length) return;
      if (ok.length === 1) { Utils.download(ok[0].blob, ok[0].name); return; }
      const names = new Set(), files = ok.map(i => {
        let n = i.name, k = 2;
        while (names.has(n.toLowerCase())) n = i.name.replace(/(\.[^.]+)$/, '-' + (k++) + '$1');
        names.add(n.toLowerCase()); return { name: n, blob: i.blob };
      });
      Utils.download(await Batch.zip(files), 'atelier-sans-metadonnees-' + new Date().toISOString().slice(0, 10) + '.zip');
    },
    reset() {
      this.state.items = [];
      Batch.queue = [];
      this.els.list.innerHTML = '';
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.downloadBtn.disabled = true;
    }
  };

  document.addEventListener('DOMContentLoaded', function () { Meta.init(); });
})();
