(function () {
  'use strict';
  const { $, $$, esc, seg, bindSeg, tog, copy, mk, debounce } = Kit;

  const S = { img: '', view: 'google' };
  const cv = document.createElement('canvas').getContext('2d');
  const measure = (t, font) => { cv.font = font; return cv.measureText(t).width; };
  const ARIAL = '"Arial","Helvetica",sans-serif';

  function fitLine(text, maxPx, font) {
    if (measure(text, font) <= maxPx) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (measure(text.slice(0, mid).trimEnd() + '…', font) <= maxPx) lo = mid; else hi = mid - 1; }
    return text.slice(0, lo).trimEnd() + '…';
  }
  function wrap(text, maxPx, font, maxLines) {
    const words = text.split(/\s+/).filter(Boolean), lines = [];
    let line = '', cut = false;
    for (let i = 0; i < words.length; i++) {
      const t = line ? line + ' ' + words[i] : words[i];
      if (measure(t, font) <= maxPx) line = t;
      else {
        if (lines.length === maxLines - 1) { cut = true; line = line ? line + ' ' + words.slice(i).join(' ') : words.slice(i).join(' '); break; }
        lines.push(line); line = words[i];
      }
    }
    if (line) lines.push(cut ? fitLine(line, maxPx, font) : line);
    return lines.slice(0, maxLines);
  }

  const inp = (id, label, ph, type) => `<div class="field"><label for="${id}">${label}</label><input type="${type || 'text'}" id="${id}" placeholder="${ph || ''}" spellcheck="false" autocomplete="off"></div>`;

  mk('seo', `<div class="stage-col">
    <div class="card seo-card">
      <div class="field"><div class="field-row"><label for="seo-title">Titre de la page</label><span class="seo-count" id="seo-title-c"></span></div><input type="text" id="seo-title" placeholder="Votre titre, 60 caractères environ" autocomplete="off"><div class="cn-gauge"><i id="seo-title-g"></i></div></div>
      <div class="field"><div class="field-row"><label for="seo-desc">Description</label><span class="seo-count" id="seo-desc-c"></span></div><textarea class="text-input" id="seo-desc" rows="3" placeholder="Résumez la page en 160 caractères environ"></textarea><div class="cn-gauge"><i id="seo-desc-g"></i></div></div>
      <ul class="seo-tips" id="seo-tips"></ul>
    </div>
    <div class="card seo-card"><div class="df-in-head"><h3 class="lr-h">Aperçu</h3>${seg('seo-view', [['google', 'Google'], ['mobile', 'Mobile'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['x', 'X']], 'google')}</div>
      <div class="seo-stage" id="seo-stage"></div></div>
    <div class="card seo-card"><div class="df-in-head"><h3 class="lr-h">Balises à copier</h3><button type="button" class="btn btn-accent" id="seo-copy">Copier les balises</button></div>
      <textarea class="text-input df-ta seo-code" id="seo-code" readonly spellcheck="false" wrap="off"></textarea></div></div>
    <div class="controls-col">
      <div class="card control-card"><h3>Page</h3>
        ${inp('seo-url', 'Adresse de la page', 'https://exemple.fr/ma-page', 'url')}
        ${inp('seo-site', 'Nom du site', 'Mon site')}
        ${inp('seo-img', 'Adresse de l’image (balises)', 'https://exemple.fr/og.png', 'url')}
        <div class="field"><label>Image d’aperçu locale</label><input type="file" id="seo-file" accept="image/*" hidden><button type="button" class="btn btn-ghost btn-block" id="seo-pick">Choisir une image</button><p class="hint">Utilisée uniquement pour l’aperçu, jamais envoyée. Taille conseillée : 1200 × 630 px.</p></div>
      </div>
      <div class="card control-card"><h3>Balises</h3>
        <div class="field"><label for="seo-type">Type de contenu (og:type)</label><select id="seo-type"><option>website</option><option>article</option></select></div>
        <div class="field"><label for="seo-card">Carte X</label><select id="seo-card"><option value="summary_large_image">Grande image</option><option value="summary">Résumé</option></select></div>
        ${inp('seo-locale', 'Langue (og:locale)', 'fr_FR')}
        ${tog('seo-og', 'Inclure Open Graph', true)}
        ${tog('seo-tw', 'Inclure les balises X', true)}
      </div></div>`);

  const host = $('#view-seo');
  const v = id => $('#' + id, host).value.trim();
  $('#seo-locale', host).value = 'fr_FR';

  const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const text = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function domainOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function crumbs(u) {
    try {
      const x = new URL(u);
      const parts = x.pathname.split('/').filter(Boolean);
      return [x.origin].concat(parts.length ? [' › ' + parts.join(' › ')] : []).join('');
    } catch (e) { return u || 'https://exemple.fr'; }
  }

  function gauge(id, n, lo, hi, warn) {
    const el = $('#' + id + '-g', host);
    const pct = Math.min(100, (n / hi) * 100);
    el.style.width = pct + '%';
    el.style.background = n === 0 ? 'transparent' : n > hi || (warn && n > warn) ? 'var(--Danger)' : n < lo ? '#e0a100' : 'hsl(140,55%,42%)';
  }

  function imageHtml(cls) {
    const src = S.img || v('seo-img');
    return `<div class="seo-img ${cls}">${src ? `<img src="${attr(src)}" alt="" onerror="this.remove()">` : ''}<span>${src ? '' : 'Aucune image'}</span></div>`;
  }

  function stage() {
    const title = v('seo-title') || 'Titre de votre page', desc = v('seo-desc') || 'La description de votre page apparaîtra ici. Rédigez-la pour donner envie de cliquer.';
    const url = v('seo-url'), site = v('seo-site') || domainOf(url) || 'exemple.fr', dom = domainOf(url) || 'exemple.fr';
    const st = $('#seo-stage', host);
    if (S.view === 'google') {
      const t = fitLine(title, 600, '20px ' + ARIAL), d = wrap(desc, 640, '14px ' + ARIAL, 2).join(' ');
      st.innerHTML = `<div class="g-res"><div class="g-top"><span class="g-fav">${esc(site[0].toUpperCase())}</span><div><div class="g-site">${esc(site)}</div><div class="g-url">${esc(crumbs(url))}</div></div></div><div class="g-title">${esc(t)}</div><div class="g-desc">${esc(d)}</div></div>`;
    } else if (S.view === 'mobile') {
      const t = wrap(title, 330, '20px ' + ARIAL, 2).join(' '), d = wrap(desc, 330, '14px ' + ARIAL, 3).join(' ');
      st.innerHTML = `<div class="g-res g-mob"><div class="g-top"><span class="g-fav">${esc(site[0].toUpperCase())}</span><div><div class="g-site">${esc(site)}</div><div class="g-url">${esc(crumbs(url))}</div></div></div><div class="g-title">${esc(t)}</div><div class="g-desc">${esc(d)}</div></div>`;
    } else if (S.view === 'facebook') {
      st.innerHTML = `<div class="sc sc-fb">${imageHtml('sc-img')}<div class="sc-body"><div class="sc-dom">${esc(dom.toUpperCase())}</div><div class="sc-t">${esc(wrap(title, 460, '600 16px ' + ARIAL, 2).join(' '))}</div><div class="sc-d">${esc(wrap(desc, 460, '14px ' + ARIAL, 1).join(' '))}</div></div></div>`;
    } else if (S.view === 'linkedin') {
      st.innerHTML = `<div class="sc sc-li">${imageHtml('sc-img')}<div class="sc-body"><div class="sc-t">${esc(wrap(title, 460, '600 15px ' + ARIAL, 2).join(' '))}</div><div class="sc-dom">${esc(dom)}</div></div></div>`;
    } else {
      st.innerHTML = `<div class="sc sc-x">${imageHtml('sc-img')}<div class="sc-xdom">${esc(dom)}</div><div class="sc-t sc-xt">${esc(wrap(title, 460, '600 15px ' + ARIAL, 1).join(' '))}</div></div>`;
    }
  }

  function code() {
    const title = v('seo-title'), desc = v('seo-desc'), url = v('seo-url'), site = v('seo-site'), img = v('seo-img'), loc = v('seo-locale');
    const L = [];
    if (title) L.push(`<title>${text(title)}</title>`);
    if (desc) L.push(`<meta name="description" content="${attr(desc)}">`);
    if (url) L.push(`<link rel="canonical" href="${attr(url)}">`);
    if ($('#seo-og', host).checked) {
      L.push('', `<meta property="og:type" content="${attr(v('seo-type'))}">`);
      if (title) L.push(`<meta property="og:title" content="${attr(title)}">`);
      if (desc) L.push(`<meta property="og:description" content="${attr(desc)}">`);
      if (url) L.push(`<meta property="og:url" content="${attr(url)}">`);
      if (img) L.push(`<meta property="og:image" content="${attr(img)}">`);
      if (site) L.push(`<meta property="og:site_name" content="${attr(site)}">`);
      if (loc) L.push(`<meta property="og:locale" content="${attr(loc)}">`);
    }
    if ($('#seo-tw', host).checked) {
      L.push('', `<meta name="twitter:card" content="${attr(v('seo-card'))}">`);
      if (title) L.push(`<meta name="twitter:title" content="${attr(title)}">`);
      if (desc) L.push(`<meta name="twitter:description" content="${attr(desc)}">`);
      if (img) L.push(`<meta name="twitter:image" content="${attr(img)}">`);
    }
    return L.join('\n').replace(/^\n/, '') + '\n';
  }

  function tips() {
    const title = v('seo-title'), desc = v('seo-desc'), url = v('seo-url'), img = v('seo-img');
    const out = [];
    const tpx = title ? measure(title, '20px ' + ARIAL) : 0;
    if (!title) out.push(['warn', 'Ajoutez un titre : c’est l’élément le plus important pour le référencement.']);
    else if (title.length > 60 || tpx > 600) out.push(['bad', `Le titre fait ${title.length} caractères (≈ ${Math.round(tpx)} px) : Google le tronquera au-delà de 600 px environ.`]);
    else if (title.length < 30) out.push(['warn', 'Titre court : profitez de 50 à 60 caractères pour y placer vos mots-clés.']);
    else out.push(['ok', 'Longueur du titre adaptée.']);
    if (!desc) out.push(['warn', 'Ajoutez une description : sans elle, Google en choisira une à votre place.']);
    else if (desc.length > 160) out.push(['bad', `La description fait ${desc.length} caractères : elle sera coupée vers 155 à 160.`]);
    else if (desc.length < 70) out.push(['warn', 'Description courte : visez 120 à 160 caractères.']);
    else out.push(['ok', 'Longueur de la description adaptée.']);
    if (url && !/^https:\/\//i.test(url)) out.push(['warn', 'Utilisez une adresse en https:// pour l’URL canonique.']);
    if (!img && !S.img) out.push(['warn', 'Sans image, les partages sur les réseaux seront peu attrayants (1200 × 630 px conseillé).']);
    else if (!img && S.img) out.push(['warn', 'Pour les balises, renseignez l’adresse publique de l’image (l’image locale ne sert qu’à l’aperçu).']);
    $('#seo-tips', host).innerHTML = out.map(t => `<li class="seo-tip is-${t[0]}">${esc(t[1])}</li>`).join('');
  }

  function render() {
    const title = v('seo-title'), desc = v('seo-desc');
    $('#seo-title-c', host).textContent = title.length + ' / 60';
    $('#seo-desc-c', host).textContent = desc.length + ' / 160';
    $('#seo-title-c', host).className = 'seo-count' + (title.length > 60 ? ' is-over' : '');
    $('#seo-desc-c', host).className = 'seo-count' + (desc.length > 160 ? ' is-over' : '');
    gauge('seo-title', title.length, 30, 60);
    gauge('seo-desc', desc.length, 70, 160);
    stage();
    tips();
    $('#seo-code', host).value = code();
  }
  const upd = debounce(render, 60);
  $$('input[type="text"],input[type="url"],textarea,select,input[type="checkbox"]', host).forEach(e => { e.addEventListener('input', upd); e.addEventListener('change', upd); });
  bindSeg('seo-view', val => { S.view = val; stage(); });
  $('#seo-pick', host).addEventListener('click', () => $('#seo-file', host).click());
  $('#seo-file', host).addEventListener('change', e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f || !/^image\//.test(f.type)) return;
    const r = new FileReader();
    r.onload = () => { S.img = String(r.result); render(); };
    r.readAsDataURL(f);
  });
  $('#seo-copy', host).addEventListener('click', () => copy($('#seo-code', host).value, 'Balises copiées'));
  render();
})();
