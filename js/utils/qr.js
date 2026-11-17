(function () {
  'use strict';
  const { $, $$, esc, seg, bindSeg, rng, bindRng, tog, colorField, bindColor, copy, download, mk, toast } = Kit;

  const TYPES = [['text', 'Texte / URL'], ['wifi', 'Wi‑Fi'], ['vcard', 'vCard'], ['mail', 'E‑mail']];
  const S = { type: 'text', fg: '#000000', bg: '#ffffff', transparent: false, style: 'square', margin: 4, px: 1024, ecl: 'M', logo: null, logoScale: 22, logoPad: 'round' };

  const field = (id, label, ph, type) => `<div class="field"><label for="${id}">${label}</label><input type="${type || 'text'}" id="${id}" placeholder="${ph || ''}" spellcheck="false" autocomplete="off"></div>`;

  const PANELS = {
    text: `<div class="field"><label for="qr-text">Texte ou adresse web</label><textarea class="text-input" id="qr-text" rows="4" placeholder="https://lennouille.fr" spellcheck="false"></textarea></div>`,
    wifi: `${field('qr-ssid', 'Nom du réseau (SSID)', 'MonWifi')}${field('qr-pass', 'Mot de passe', '', 'text')}<div class="field"><label for="qr-sec">Sécurité</label><select id="qr-sec"><option value="WPA">WPA / WPA2 / WPA3</option><option value="WEP">WEP</option><option value="nopass">Aucune</option></select></div>${tog('qr-hidden', 'Réseau masqué', false)}`,
    vcard: `${field('qr-fn', 'Prénom', 'Lenny')}${field('qr-ln', 'Nom', 'Gadroy')}${field('qr-org', 'Société', '')}${field('qr-tel', 'Téléphone', '+33 6 00 00 00 00', 'tel')}${field('qr-mail', 'E‑mail', 'nom@exemple.fr', 'email')}${field('qr-url', 'Site web', 'https://')}`,
    mail: `${field('qr-to', 'Destinataire', 'nom@exemple.fr', 'email')}${field('qr-subj', 'Objet', '')}<div class="field"><label for="qr-body">Message</label><textarea class="text-input" id="qr-body" rows="3"></textarea></div>`
  };

  mk('qr', `<div class="stage-col">
    <div class="card qr-stage">
      <div class="qr-box" id="qr-box"><canvas id="qr-cv" width="320" height="320" role="img" aria-label="Aperçu du QR code"></canvas></div>
      <p class="hint qr-info" id="qr-info"></p>
      <div class="qr-msg" id="qr-msg" hidden></div>
      <div class="qr-actions">
        <button type="button" class="btn btn-accent" id="qr-png">Télécharger en PNG</button>
        <button type="button" class="btn btn-ghost" id="qr-svg">Télécharger en SVG</button>
        <button type="button" class="btn btn-ghost" id="qr-copy">Copier l’image</button>
      </div>
    </div></div>
    <div class="controls-col">
      <div class="card control-card"><h3>Contenu</h3>${seg('qr-type', TYPES, 'text')}<div class="qr-panel" id="qr-panel">${PANELS.text}</div></div>
      <div class="card control-card"><h3>Apparence</h3>
        ${colorField('qr-fg', 'Couleur des modules', '#000000')}
        ${colorField('qr-bg', 'Couleur du fond', '#ffffff')}
        ${tog('qr-tr', 'Fond transparent', false)}
        <div class="field"><label>Style des modules</label>${seg('qr-style', [['square', 'Carré'], ['rounded', 'Arrondi'], ['dots', 'Points']], 'square')}<p class="hint">Testez toujours le QR code avec un téléphone avant de l’imprimer, surtout avec un style arrondi, des points ou un logo.</p></div>
        ${rng('qr-margin', 'Marge', 0, 10, 4, ' modules')}
        <div class="field"><label>Correction d’erreur</label>${seg('qr-ecl', [['L', 'L'], ['M', 'M'], ['Q', 'Q'], ['H', 'H']], 'M')}<p class="hint" id="qr-ecl-note">Niveau plus élevé : QR code plus dense, mais plus tolérant aux dégâts.</p></div>
        <div class="field"><label for="qr-px">Taille de l’export PNG</label><select id="qr-px"><option value="512">512 px</option><option value="1024" selected>1024 px</option><option value="2048">2048 px</option><option value="4096">4096 px</option></select></div>
      </div>
      <div class="card control-card"><h3>Logo</h3>
        <div class="field"><input type="file" id="qr-logo" accept="image/*" aria-label="Choisir un logo"><button type="button" class="btn btn-ghost btn-block" id="qr-logo-btn">Ajouter un logo</button></div>
        <div id="qr-logo-opts" hidden>
          ${rng('qr-lscale', 'Taille du logo', 10, 30, 22, ' %')}
          <div class="field"><label>Pastille derrière le logo</label>${seg('qr-lpad', [['round', 'Ronde'], ['square', 'Carrée'], ['none', 'Aucune']], 'round')}</div>
          <button type="button" class="btn btn-ghost btn-block" id="qr-lrm">Retirer le logo</button>
        </div>
      </div></div>`);

  const host = $('#view-qr');
  const val = id => { const e = $('#' + id, host); return e ? e.value : ''; };
  const wesc = s => s.replace(/([\\;,:"])/g, '\\$1');
  const vesc = s => s.replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n');

  function content() {
    switch (S.type) {
      case 'wifi': {
        const ssid = val('qr-ssid').trim();
        if (!ssid) return '';
        const sec = val('qr-sec'), hid = $('#qr-hidden', host).checked;
        return `WIFI:T:${sec};S:${wesc(ssid)};${sec === 'nopass' ? '' : 'P:' + wesc(val('qr-pass')) + ';'}${hid ? 'H:true;' : ''};`;
      }
      case 'vcard': {
        const fn = val('qr-fn').trim(), ln = val('qr-ln').trim(), org = val('qr-org').trim(), tel = val('qr-tel').trim(), mail = val('qr-mail').trim(), url = val('qr-url').trim();
        if (!(fn || ln || org || tel || mail || url)) return '';
        const L = ['BEGIN:VCARD', 'VERSION:3.0', `N:${vesc(ln)};${vesc(fn)};;;`, `FN:${vesc((fn + ' ' + ln).trim() || org)}`];
        if (org) L.push('ORG:' + vesc(org));
        if (tel) L.push('TEL;TYPE=CELL:' + vesc(tel));
        if (mail) L.push('EMAIL:' + vesc(mail));
        if (url) L.push('URL:' + url);
        L.push('END:VCARD');
        return L.join('\n');
      }
      case 'mail': {
        const to = val('qr-to').trim();
        if (!to) return '';
        const q = [];
        if (val('qr-subj').trim()) q.push('subject=' + encodeURIComponent(val('qr-subj').trim()));
        if (val('qr-body').trim()) q.push('body=' + encodeURIComponent(val('qr-body').trim()));
        return 'mailto:' + to + (q.length ? '?' + q.join('&') : '');
      }
      default: return val('qr-text');
    }
  }

  const cv = $('#qr-cv', host), info = $('#qr-info', host), msg = $('#qr-msg', host);
  let cur = null;

  function opts(px) {
    return { margin: S.margin, fg: S.fg, bg: S.transparent ? null : S.bg, style: S.style, px, logo: S.logo ? { href: S.logo.href, img: S.logo.img, ratio: S.logo.ratio, scale: S.logoScale / 100, pad: S.logoPad, bg: S.transparent ? '#ffffff' : S.bg } : null };
  }

  function warn(t, kind) {
    msg.hidden = !t;
    msg.className = 'qr-msg' + (kind ? ' ' + kind : '');
    msg.textContent = t || '';
  }

  function render() {
    const text = content();
    const dpr = Math.min(2, window.devicePixelRatio || 1), css = 320;
    $$('#qr-png,#qr-svg,#qr-copy', host).forEach(b => { b.disabled = true; });
    cur = null;
    const note = $('#qr-ecl-note', host);
    const eclSeg = $('#qr-ecl', host);
    $$('button', eclSeg).forEach(b => { b.disabled = !!S.logo; b.setAttribute('aria-pressed', b.dataset.v === (S.logo ? 'H' : S.ecl)); });
    note.textContent = S.logo ? 'Niveau H imposé avec un logo : il compense la zone masquée au centre.' : 'Niveau plus élevé : QR code plus dense, mais plus tolérant aux dégâts.';
    if (!text) {
      cv.width = cv.height = css * dpr;
      const g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      cv.classList.add('is-empty');
      info.textContent = 'Saisissez un contenu pour générer le QR code.';
      warn('');
      return;
    }
    cv.classList.remove('is-empty');
    let qr;
    try {
      qr = QRCore.encodeText(text, S.logo ? 'H' : S.ecl, S.logo ? 4 : 1);
    } catch (e) {
      const g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      cv.classList.add('is-empty');
      info.textContent = '';
      warn('Contenu trop long pour un QR code' + (S.logo ? ' avec logo' : '') + ' : essayez un niveau de correction plus bas, ou raccourcissez le texte (maximum ' + QRCore.maxBytes(S.logo ? 'H' : S.ecl) + ' octets).', 'is-error');
      return;
    }
    cur = qr;
    $('#qr-box', host).classList.toggle('is-transparent', S.transparent);
    QRCore.drawCanvas(qr, cv, opts(Math.round(css * dpr)));
    $$('#qr-png,#qr-svg,#qr-copy', host).forEach(b => { b.disabled = false; });
    info.textContent = `Version ${qr.version} · ${qr.size}×${qr.size} modules · correction ${qr.ecl} · ${new TextEncoder().encode(text).length} octets`;
    const fgL = QRCore.lum(S.fg), bgL = S.transparent ? 1 : QRCore.lum(S.bg);
    const ratio = S.transparent ? 21 : QRCore.contrast(S.fg, S.bg);
    if (!S.transparent && ratio < 3) warn(`Contraste très faible (${ratio.toFixed(1)}:1) : ce QR code risque de ne pas se scanner. Visez au moins 4:1.`, 'is-warn');
    else if (fgL > bgL) warn('Modules plus clairs que le fond : certains lecteurs ne savent pas lire un QR code inversé. Testez-le avant de l’imprimer.', 'is-warn');
    else if (qr.size > 65) warn('QR code très dense : prévoyez une grande taille d’impression ou raccourcissez le contenu.', 'is-warn');
    else warn('');
  }

  const again = Kit.debounce(render, 80);

  function bindPanel() {
    $$('#qr-panel input, #qr-panel textarea, #qr-panel select', host).forEach(e => { e.addEventListener('input', again); e.addEventListener('change', again); });
  }
  bindPanel();

  bindSeg('qr-type', v => { S.type = v; $('#qr-panel', host).innerHTML = PANELS[v]; bindPanel(); render(); });
  bindSeg('qr-style', v => { S.style = v; render(); });
  bindSeg('qr-ecl', v => { S.ecl = v; render(); });
  bindRng('qr-margin', ' modules', v => { S.margin = v; render(); });
  bindRng('qr-lscale', ' %', v => { S.logoScale = v; render(); });
  bindSeg('qr-lpad', v => { S.logoPad = v; render(); });
  bindColor('qr-fg', v => { S.fg = v; render(); });
  bindColor('qr-bg', v => { S.bg = v; render(); });
  $('#qr-tr', host).addEventListener('change', e => { S.transparent = e.target.checked; render(); });
  $('#qr-px', host).addEventListener('change', e => { S.px = +e.target.value; });

  const logoIn = $('#qr-logo', host);
  logoIn.hidden = true;
  $('#qr-logo-btn', host).addEventListener('click', () => logoIn.click());
  logoIn.addEventListener('change', () => {
    const f = logoIn.files[0];
    logoIn.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast('Ce fichier n’est pas une image.'); return; }
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || 100, h = img.naturalHeight || 100;
        S.logo = { href: String(r.result), img, ratio: w / h };
        $('#qr-logo-opts', host).hidden = false;
        $('#qr-logo-btn', host).textContent = 'Changer de logo';
        render();
      };
      img.onerror = () => toast('Image illisible : essayez un PNG, JPEG ou SVG.');
      img.src = String(r.result);
    };
    r.onerror = () => toast('Lecture du fichier impossible.');
    r.readAsDataURL(f);
  });
  $('#qr-lrm', host).addEventListener('click', () => {
    S.logo = null;
    $('#qr-logo-opts', host).hidden = true;
    $('#qr-logo-btn', host).textContent = 'Ajouter un logo';
    render();
  });

  function pngBlob() {
    const c = document.createElement('canvas');
    QRCore.drawCanvas(cur, c, opts(S.px));
    return new Promise(res => c.toBlob(res, 'image/png'));
  }
  const slug = () => 'qrcode-' + S.type;

  $('#qr-png', host).addEventListener('click', async () => {
    if (!cur) return;
    const b = await pngBlob();
    if (b) download(slug() + '.png', b); else toast('Export impossible : essayez une taille plus petite.');
  });
  $('#qr-svg', host).addEventListener('click', () => {
    if (!cur) return;
    download(slug() + '.svg', QRCore.toSVG(cur, opts(1024)), 'image/svg+xml');
  });
  $('#qr-copy', host).addEventListener('click', async () => {
    if (!cur) return;
    try {
      const b = await pngBlob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
      toast('Image copiée dans le presse-papiers.');
    } catch (e) { toast('Copie de l’image impossible ici : utilisez le téléchargement.'); }
  });

  render();
  window.addEventListener('hashchange', () => { if (location.hash === '#qr') render(); });
})();
