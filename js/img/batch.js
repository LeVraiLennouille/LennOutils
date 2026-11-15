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
  const crcUpdate = (c, u8) => { for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return c; };
  const crc32 = u8 => (crcUpdate(0xFFFFFFFF, u8) ^ 0xFFFFFFFF) >>> 0;
  /* CRC d'un Blob lu par morceaux de 4 Mo : le fichier n'est jamais chargé en entier dans la mémoire de la page. */
  async function crcBlob(blob) {
    let c = 0xFFFFFFFF;
    for (let o = 0; o < blob.size; o += 4194304) c = crcUpdate(c, new Uint8Array(await blob.slice(o, o + 4194304).arrayBuffer()));
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* Écrivain ZIP vers n'importe quel objet { write(chunk), close() } (fichier sur disque ou simple tableau). */
  function zipSink(w) {
    const enc = new TextEncoder(), cen = [];
    let off = 0, csize = 0, count = 0;
    const d = new Date();
    const dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
    const dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
    return {
      get count() { return count; },
      async add(name, data) {
        const nb = enc.encode(name), isBlob = data instanceof Blob;
        const size = isBlob ? data.size : data.length, crc = isBlob ? await crcBlob(data) : crc32(data);
        const lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
        lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true);
        lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, nb.length, true); lh.setUint16(28, 0, true);
        await w.write(lh.buffer); await w.write(nb); await w.write(data);
        const ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
        ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true);
        ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
        cen.push(ch.buffer, nb);
        csize += 46 + nb.length; off += 30 + nb.length + size; count++;
      },
      async finish() {
        for (const part of cen) await w.write(part);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true); end.setUint16(8, count, true); end.setUint16(10, count, true);
        end.setUint32(12, csize, true); end.setUint32(16, off, true);
        await w.write(end.buffer);
        await w.close();
      }
    };
  }

  /* Archive en mémoire : les Blob sont référencés (pas recopiés), seul l'en-tête est créé. */
  async function zip(files) {
    const parts = [], sink = zipSink({ write: async chunk => { parts.push(chunk); }, close: async () => {} });
    for (const f of files) await sink.add(f.name, f.data || f.blob);
    await sink.finish();
    return new Blob(parts, { type: 'application/zip' });
  }

  /* ---------- Zone de dépôt : plusieurs fichiers + collage ---------- */
  const MB = 1048576;
  const Batch = {
    queue: [],
    tool: null,
    tools: {},     // vue (data-view) -> outil rattaché
    queues: {},    // vue -> file d'attente mémorisée quand on change d'outil
    current: null, // vue affichée (définie par le routeur de img.html)
    zip,
    zipSink,
    isImg,
    VOLUME_BYTES: 200 * MB,   // sans écriture directe sur disque : une archive est téléchargée tous les ~200 Mo

    /* Ouvre un fichier de sortie quand le navigateur sait écrire directement sur le disque (Chrome, Edge) ; sinon null. */
    async openSink(name) {
      if (!window.showSaveFilePicker) return null;
      try {
        const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Archive ZIP', accept: { 'application/zip': ['.zip'] } }] });
        return await h.createWritable();
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        return null;
      }
    },

    /* Page unique : appelé à chaque changement de vue. Chaque outil garde sa propre file d'images. */
    activate(key) {
      if (this.current) this.queues[this.current] = this.queue;
      this.current = key;
      this.queue = this.queues[key] || [];
      this.tool = this.tools[key] || null;
      this.refresh();
    },

    setQueue(files) { this.queue = files; this.refresh(); },

    refresh() {
      const t = this.tool; if (!t || !t._batch) return;
      const n = this.queue.length;
      t._batch.bar.hidden = n < 2;
      const total = this.queue.reduce((a, f) => a + (f.size || 0), 0);
      t._batch.bar.querySelector('b').textContent = n + ' images (' + (total / MB).toFixed(total > 10 * MB ? 0 : 1).replace('.', ',') + ' Mo)';
    },

    attach(tool, opt) {
      opt = Object.assign({ run: 'process', suffix: 'lot' }, opt);
      const bar = document.createElement('div');
      bar.className = 'BatchBar'; bar.hidden = true;
      bar.innerHTML = '<p class="BatchInfo"><b></b> chargées. Les réglages s’appliquent à toutes les images. L’archive est écrite au fil de l’eau (ou découpée en parties d’environ 200 Mo selon le navigateur).</p>' +
        '<button type="button" class="btn btn-accent btn-block bt-zip">Tout télécharger (.zip)</button>' +
        '<div class="BatchProg" hidden><div class="bar"><i></i></div><span></span></div>';
      const btn = tool.els.downloadBtn;
      btn.parentNode.insertBefore(bar, btn);
      tool._batch = { bar, opt };
      bar.querySelector('.bt-zip').addEventListener('click', () => this.run(tool));
      const reset = tool.reset.bind(tool);
      tool.reset = () => { this.setQueue([]); reset(); };
      const view = tool.els.dropzone && tool.els.dropzone.closest('[data-view]');
      const key = view ? view.dataset.view : null;
      if (key) this.tools[key] = tool;
      if (!key || !this.current || key === this.current) this.tool = tool;
    },

    async run(tool) {
      const { bar, opt } = tool._batch, files = this.queue.slice();
      if (files.length < 2) return;
      const prog = bar.querySelector('.BatchProg'), fill = prog.querySelector('i'), lab = prog.querySelector('span'), btn = bar.querySelector('.bt-zip');
      const base = 'atelier-' + opt.suffix + '-' + stamp();
      // 1) sortie directe sur disque si possible (à demander tout de suite : le clic doit être récent)
      let sink = null, writable = null;
      try { writable = await this.openSink(base + '.zip'); } catch (e) { return; }  // annulé par l'utilisateur
      if (writable) sink = zipSink(writable);
      const orig = Utils.download, first = tool.state.data, names = new Set(), fails = [];
      let pending = [], pendingBytes = 0, volumes = 0, done = 0;
      const flush = async last => {
        if (!pending.length) return;
        volumes++;
        const z = await zip(pending);
        Utils.download(z, base + (volumes > 1 || !last ? '-partie-' + volumes : '') + '.zip');
        pending = []; pendingBytes = 0;
      };
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
            if (sink) { await sink.add(n, cap.blob); }
            else {
              pending.push({ name: n, blob: cap.blob }); pendingBytes += cap.blob.size;
              if (pendingBytes >= this.VOLUME_BYTES && i < files.length - 1) await flush(false);
            }
            done++;
          } catch (e) {
            Utils.download = orig; fails.push(files[i].name);
          } finally {
            if (data && data !== first && data.url) URL.revokeObjectURL(data.url);
            data = null;
          }
          await new Promise(r => setTimeout(r, 0));   // laisse respirer la page et le ramasse-miettes
        }
        if (!done) throw new Error('Aucune image n’a pu être traitée.');
        lab.textContent = 'Création de l’archive…';
        if (sink) await sink.finish(); else await flush(true);
        Utils.toast(done + ' image' + (done > 1 ? 's' : '') + ' dans l’archive' + (volumes > 1 ? ' (' + volumes + ' parties)' : '') + (fails.length ? ' · ' + fails.length + ' échec(s)' : ''));
      } catch (e) {
        if (writable && sink) { try { await writable.abort(); } catch (x) {} }
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
      onFile(files[0], files);
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
      const view = dropzoneEl.closest('[data-view]');
      if (view && view.hidden) return;   // page unique : seul l'outil affiché réagit au collage
      const fs = [...((e.clipboardData && e.clipboardData.files) || [])].filter(isImg);
      if (!fs.length) return;
      e.preventDefault(); handle(fs);
    });
  };

  window.Batch = Batch;
})();
