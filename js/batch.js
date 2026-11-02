/* =====================================================================
   batch.js — glisser-déposer multiple, collage (Ctrl + V) et traitement par lot
   Dépend de js/common.js (Utils). À charger après common.js, avant les scripts d'outils.
   - Utils.setupDropzone accepte plusieurs fichiers si l'input a l'attribut « multiple »
     et reconnaît le collage d'images depuis le presse-papiers.
   - Batch.attach(outil, { run, suffix }) ajoute « Tout télécharger (.zip) » : les réglages
     en cours sont appliqués à chaque image, puis l'archive est téléchargée.
   - Batch.zip(fichiers) crée une archive ZIP (sans compression) côté navigateur.
   ===================================================================== */
(function () {
  'use strict';

  const IMG = /^image\//, EXT = /\.(png|jpe?g|webp|avif|svg|heic|heif)$/i;
  const isImg = f => IMG.test(f.type || '') || EXT.test(f.name || '');
  const stamp = () => new Date().toISOString().slice(0, 10);

  /* ---------- ZIP (méthode « stored ») ---------- */
  const CRC_T = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

  async function zip(files) {
    const enc = new TextEncoder(), parts = [], cen = [];
    let off = 0, csize = 0;
    const d = new Date();
    const dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
    const dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
    for (const f of files) {
      const data = f.data || new Uint8Array(await f.blob.arrayBuffer());
      const name = enc.encode(f.name), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      cen.push(ch.buffer, name);
      csize += 46 + name.length; off += 30 + name.length + data.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...cen, end.buffer], { type: 'application/zip' });
  }

  /* ---------- Zone de dépôt : plusieurs fichiers + collage ---------- */
  const Batch = {
    queue: [],
    tool: null,
    zip,
    isImg,

    setQueue(files) { this.queue = files; this.refresh(); },

    refresh() {
      const t = this.tool; if (!t || !t._batch) return;
      const n = this.queue.length;
      t._batch.bar.hidden = n < 2;
      t._batch.bar.querySelector('b').textContent = n + ' images';
    },

    attach(tool, opt) {
      opt = Object.assign({ run: 'process', suffix: 'lot' }, opt);
      const bar = document.createElement('div');
      bar.className = 'BatchBar'; bar.hidden = true;
      bar.innerHTML = '<p class="BatchInfo"><b></b> chargées. Les réglages s’appliquent à toutes les images.</p>' +
        '<button type="button" class="btn btn-accent btn-block bt-zip">Tout télécharger (.zip)</button>' +
        '<div class="BatchProg" hidden><div class="bar"><i></i></div><span></span></div>';
      const btn = tool.els.downloadBtn;
      btn.parentNode.insertBefore(bar, btn);
      tool._batch = { bar, opt };
      bar.querySelector('.bt-zip').addEventListener('click', () => this.run(tool));
      const reset = tool.reset.bind(tool);
      tool.reset = () => { this.setQueue([]); reset(); };
      this.tool = tool;
    },

    async run(tool) {
      const { bar, opt } = tool._batch, files = this.queue.slice();
      if (files.length < 2) return;
      const prog = bar.querySelector('.BatchProg'), fill = prog.querySelector('i'), lab = prog.querySelector('span'), btn = bar.querySelector('.bt-zip');
      const orig = Utils.download, first = tool.state.data, out = [], names = new Set(), fails = [];
      btn.disabled = true; prog.hidden = false; tool.state.batch = true;
      try {
        for (let i = 0; i < files.length; i++) {
          lab.textContent = 'Traitement ' + (i + 1) + ' / ' + files.length + '…';
          fill.style.width = (i / files.length * 100) + '%';
          let data = null;
          try {
            data = await Utils.loadImage(files[i]);
            tool.state.data = data; tool._resultBlob = null;
            await tool[opt.run]();
            let cap = null;
            Utils.download = (blob, name) => { cap = { blob, name }; };
            await tool.download();
            Utils.download = orig;
            if (!cap) throw new Error('vide');
            let n = cap.name, k = 2;
            while (names.has(n.toLowerCase())) n = cap.name.replace(/(\.[^.]+)$/, '-' + (k++) + '$1');
            names.add(n.toLowerCase());
            out.push({ name: n, blob: cap.blob });
          } catch (e) {
            Utils.download = orig; fails.push(files[i].name);
          } finally {
            if (data && data !== first && data.url) URL.revokeObjectURL(data.url);
          }
        }
        if (!out.length) throw new Error('Aucune image n’a pu être traitée.');
        lab.textContent = 'Création de l’archive…';
        const z = await zip(out);
        Utils.download(z, 'atelier-' + opt.suffix + '-' + stamp() + '.zip');
        Utils.toast(out.length + ' image' + (out.length > 1 ? 's' : '') + ' dans l’archive' + (fails.length ? ' · ' + fails.length + ' échec(s)' : ''));
      } catch (e) {
        Utils.toast(e.message || 'Le traitement par lot a échoué.');
      } finally {
        Utils.download = orig; tool.state.batch = false; tool.state.data = first;
        try { await tool[opt.run](); } catch (e) {}
        fill.style.width = '100%';
        setTimeout(() => { prog.hidden = true; }, 900);
        btn.disabled = false;
      }
    }
  };

  Utils.setupDropzone = function (dropzoneEl, inputEl, onFile) {
    const multiple = inputEl.hasAttribute('multiple');
    const handle = list => {
      let files = [...list].filter(isImg);
      if (!files.length) { Utils.toast('Ce fichier n’est pas une image prise en charge.'); return; }
      if (!multiple) files = files.slice(0, 1);
      Batch.setQueue(files);
      onFile(files[0]);
    };
    const sub = dropzoneEl.querySelector('.dz-sub');
    if (sub && !sub.dataset.hint) {
      sub.dataset.hint = '1';
      sub.textContent += (multiple ? ' · plusieurs images possibles' : '') + ' · Ctrl + V pour coller';
    }
    dropzoneEl.addEventListener('dragover', e => { e.preventDefault(); dropzoneEl.classList.add('is-drag'); });
    dropzoneEl.addEventListener('dragleave', () => dropzoneEl.classList.remove('is-drag'));
    dropzoneEl.addEventListener('drop', e => {
      e.preventDefault(); dropzoneEl.classList.remove('is-drag');
      if (e.dataTransfer.files && e.dataTransfer.files.length) handle(e.dataTransfer.files);
    });
    inputEl.addEventListener('change', () => {
      const list = [...inputEl.files]; inputEl.value = '';
      if (list.length) handle(list);
    });
    document.addEventListener('paste', e => {
      const fs = [...((e.clipboardData && e.clipboardData.files) || [])].filter(isImg);
      if (!fs.length) return;
      e.preventDefault(); handle(fs);
    });
  };

  window.Batch = Batch;
})();
