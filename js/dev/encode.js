(function () {
  'use strict';
  const { $, $$, esc, seg, bindSeg, tog, copy, debounce, mk, toast, size } = Kit;

  const MODES = [['b64', 'Base64'], ['url', 'URL'], ['html', 'Entités HTML'], ['jwt', 'JWT'], ['hash', 'Hash']];
  const S = { mode: 'b64', dir: 'enc' };

  mk('encode', `<div class="stage-col">
    <div class="card en-card">
      ${seg('en-mode', MODES, 'b64')}
      <div class="field" id="en-dir-f"><label>Sens</label>${seg('en-dir', [['enc', 'Encoder'], ['dec', 'Décoder']], 'enc')}</div>
      <div class="field"><div class="df-in-head"><label for="en-in" id="en-in-l">Texte</label><span class="df-in-tools"><span class="hint" id="en-in-n"></span><button type="button" class="Ghost" id="en-file-b">Utiliser un fichier</button></span></div>
        <textarea class="text-input df-ta en-ta" id="en-in" spellcheck="false" wrap="soft" placeholder="Saisissez ou collez ici"></textarea><input type="file" id="en-file" hidden></div>
      <div class="qr-msg is-error" id="en-err" hidden></div>
      <div class="field" id="en-secret-f" hidden><label for="en-secret">Secret HMAC (pour vérifier une signature HS256, HS384 ou HS512)</label><input type="text" id="en-secret" spellcheck="false" autocomplete="off" placeholder="Votre secret"></div>
    </div>
    <div class="card en-card" id="en-res-card"><div class="df-in-head"><h3 class="lr-h" id="en-res-t">Résultat</h3><button type="button" class="btn btn-ghost" id="en-copy">Copier</button></div><div id="en-res"></div></div></div>
    <div class="controls-col">
      <div class="card control-card" id="en-opts"><h3>Options</h3><div id="en-opts-b"></div></div>
      <div class="card control-card"><h3>Actions</h3><div class="df-btns">
        <button type="button" class="btn btn-ghost btn-block" id="en-swap">Utiliser le résultat comme entrée</button>
        <button type="button" class="btn btn-ghost btn-block" id="en-sample">Charger un exemple</button>
        <button type="button" class="btn btn-ghost btn-block" id="en-clear">Tout effacer</button></div></div>
      <div class="card control-card"><h3>Confidentialité</h3><p class="hint">Tout est calculé dans votre navigateur. Rien n’est envoyé, y compris vos jetons et vos secrets.</p></div></div>`);

  const host = $('#view-encode');
  const IN = $('#en-in', host), ERR = $('#en-err', host), RES = $('#en-res', host);
  let outText = '', fileData = null, token = 0;

  const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
  const toB64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(s); };
  const fromB64 = s => { const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; };
  const b64url = s => s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  const SAMPLES = { b64: 'Bonjour, voici un texte accentué : é à ç — 你好', url: 'https://exemple.fr/recherche?q=café crème&page=2&tri=prix asc#résultats', html: '<a href="/page?x=1&y=2">Café "crème" & chocolat</a>', jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkplYW4gRHVwb250IiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjQxMDI0NDQ4MDB9.xZvVPwtubHnu_w_mfwJ4YjmIB3_1nsr8t3YdK5iKeRw', hash: 'Bonjour le monde' };

  function optsHtml() {
    const m = S.mode;
    if (m === 'b64') return tog('en-safe', 'Variante URL (- et _, sans =)', false) + '<p class="hint">Le texte est converti en UTF-8 avant l’encodage, donc les accents sont conservés.</p>';
    if (m === 'url') return `<div class="field"><label for="en-umode">Type d’encodage</label><select id="en-umode"><option value="comp">Composant (encodeURIComponent)</option><option value="full">Adresse complète (encodeURI)</option></select></div>` + tog('en-plus', 'Décoder + comme un espace (formulaires)', false);
    if (m === 'html') return tog('en-ascii', 'Encoder aussi les caractères non ASCII', false);
    if (m === 'hash') return tog('en-upper', 'Majuscules', false);
    return '<p class="hint">La signature n’est vérifiable ici que pour les algorithmes HS256, HS384 et HS512. Ne faites jamais confiance à un jeton sans vérification côté serveur.</p>';
  }

  function setMode(m) {
    S.mode = m;
    $('#en-dir-f', host).hidden = m === 'jwt' || m === 'hash';
    $('#en-secret-f', host).hidden = m !== 'jwt';
    $('#en-file-b', host).hidden = !(m === 'b64' || m === 'hash');
    $('#en-opts-b', host).innerHTML = optsHtml();
    $$('#en-opts-b input,#en-opts-b select', host).forEach(e => { e.addEventListener('change', run); e.addEventListener('input', run); });
    $('#en-in-l', host).textContent = m === 'jwt' ? 'Jeton JWT' : m === 'url' ? 'Adresse ou texte' : 'Texte';
    fileData = null;
    run();
  }

  function setErr(t) { ERR.hidden = !t; ERR.textContent = t || ''; }
  const card = (rows) => '<dl class="en-dl">' + rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('') + '</dl>';

  async function run() {
    const my = ++token;
    const txt = IN.value;
    $('#en-in-n', host).textContent = fileData ? 'Fichier : ' + fileData.name + ' (' + size(fileData.bytes.length) + ')' : txt ? txt.length + ' caractères' : '';
    setErr('');
    $('#en-res-t', host).textContent = 'Résultat';
    outText = '';
    const m = S.mode;
    try {
      if (m === 'b64') {
        let r;
        if (S.dir === 'enc') {
          r = toB64(fileData ? fileData.bytes : enc.encode(txt));
          if ($('#en-safe', host).checked) r = r.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        } else {
          if (!txt.trim()) r = '';
          else {
            const clean = b64url(txt.trim().replace(/\s+/g, '').replace(/^data:[^,]*,/, ''));
            if (!/^[A-Za-z0-9+/]*={0,3}$/.test(clean)) throw new Error('Ce texte n’est pas du Base64 valide.');
            const bytes = fromB64(clean);
            try { r = dec.decode(bytes); } catch (e) { r = new TextDecoder().decode(bytes); setErr('Les octets décodés ne forment pas un texte UTF-8 valide : le résultat peut être illisible (fichier binaire ?).'); }
          }
        }
        outText = r;
        RES.innerHTML = `<textarea class="text-input df-ta en-ta" readonly wrap="soft">${esc(r)}</textarea>`;
        $('#en-res-t', host).textContent = S.dir === 'enc' ? 'Base64' : 'Texte décodé';
      } else if (m === 'url') {
        let r;
        if (S.dir === 'enc') r = $('#en-umode', host).value === 'full' ? encodeURI(txt) : encodeURIComponent(txt);
        else { const t = $('#en-plus', host).checked ? txt.replace(/\+/g, ' ') : txt; try { r = decodeURIComponent(t); } catch (e) { throw new Error('Séquence % invalide : impossible de décoder.'); } }
        outText = r;
        let extra = '';
        try {
          const u = new URL(S.dir === 'enc' ? txt : r);
          const params = [...u.searchParams.entries()];
          extra = `<h4 class="en-h">Analyse de l’adresse</h4>` + card([['Protocole', esc(u.protocol)], ['Hôte', esc(u.hostname)], ['Port', esc(u.port || '(par défaut)')], ['Chemin', esc(decodeURIComponent(u.pathname))], ['Ancre', esc(u.hash ? decodeURIComponent(u.hash) : '(aucune)')]].concat(params.map(([k, v]) => ['Paramètre ' + k, esc(v)])));
        } catch (e) { }
        RES.innerHTML = `<textarea class="text-input df-ta en-ta" readonly wrap="soft">${esc(r)}</textarea>` + extra;
      } else if (m === 'html') {
        let r;
        if (S.dir === 'enc') {
          r = txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
          if ($('#en-ascii', host).checked) r = r.replace(/[^\x00-\x7f]/gu, c => '&#x' + c.codePointAt(0).toString(16).toUpperCase() + ';');
        } else r = new DOMParser().parseFromString(txt, 'text/html').documentElement.textContent.replace(/^\s*/, m2 => (txt.match(/^\s*/) ? txt.match(/^\s*/)[0] : m2));
        outText = r;
        RES.innerHTML = `<textarea class="text-input df-ta en-ta" readonly wrap="soft">${esc(r)}</textarea>`;
      } else if (m === 'hash') {
        const data = fileData ? fileData.bytes : enc.encode(txt);
        const up = $('#en-upper', host).checked;
        const algos = [['SHA-1', 'SHA-1'], ['SHA-256', 'SHA-256'], ['SHA-384', 'SHA-384'], ['SHA-512', 'SHA-512']];
        const res = await Promise.all(algos.map(a => crypto.subtle.digest(a[1], data)));
        if (my !== token) return;
        const hs = res.map((b, i) => [algos[i][0], up ? hex(b).toUpperCase() : hex(b)]);
        outText = hs.map(h => h[0] + ': ' + h[1]).join('\n');
        RES.innerHTML = hs.map(h => `<div class="en-hash"><span>${h[0]}</span><code>${h[1]}</code><button type="button" class="Ghost" data-h="${h[1]}">Copier</button></div>`).join('') + `<div class="field"><label for="en-cmp">Comparer avec une empreinte connue</label><input type="text" id="en-cmp" spellcheck="false" autocomplete="off" placeholder="Collez l’empreinte attendue"><p class="hint" id="en-cmp-r"></p></div><p class="hint">MD5 n’est pas proposé : il n’existe pas dans le navigateur et n’est plus sûr pour la sécurité.</p>`;
        const cmp = $('#en-cmp', host);
        cmp.addEventListener('input', () => { const v = cmp.value.trim().toLowerCase(); const hit = hs.find(h => h[1].toLowerCase() === v); $('#en-cmp-r', host).textContent = !v ? '' : hit ? '✓ Identique à ' + hit[0] : '✗ Aucune empreinte ne correspond'; });
      } else {
        const t = txt.trim();
        if (!t) { RES.innerHTML = '<p class="hint">Collez un jeton JWT (trois parties séparées par des points).</p>'; return; }
        const parts = t.split('.');
        if (parts.length !== 3) throw new Error('Un JWT contient trois parties séparées par des points : en-tête, contenu et signature.');
        const j = p => { try { return JSON.parse(dec.decode(fromB64(b64url(p)))); } catch (e) { throw new Error('Partie illisible : ce n’est pas du Base64url contenant du JSON.'); } };
        const header = j(parts[0]), payload = j(parts[1]);
        const now = Date.now() / 1000;
        const dates = ['exp', 'nbf', 'iat'].filter(k => typeof payload[k] === 'number').map(k => {
          const d = new Date(payload[k] * 1000);
          const lbl = { exp: 'Expiration (exp)', nbf: 'Valide à partir de (nbf)', iat: 'Émis le (iat)' }[k];
          let st = '';
          if (k === 'exp') st = payload.exp < now ? ' <b class="en-bad">expiré</b>' : ' <b class="en-ok">valide</b>';
          if (k === 'nbf' && payload.nbf > now) st = ' <b class="en-bad">pas encore valide</b>';
          return [lbl, esc(d.toLocaleString('fr-FR')) + st];
        });
        let sig = '<span class="hint">Signature non vérifiée.</span>';
        const alg = header.alg;
        if (alg === 'none') sig = '<b class="en-bad">Algorithme « none » : le jeton n’est pas signé, ne lui faites pas confiance.</b>';
        else if (/^HS(256|384|512)$/.test(alg || '')) {
          const secret = $('#en-secret', host).value;
          if (secret) {
            const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-' + alg.slice(2) }, false, ['sign']);
            const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(parts[0] + '.' + parts[1])));
            let ok = '';
            mac.forEach(b => { ok += String.fromCharCode(b); });
            const expected = btoa(ok).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            sig = expected === parts[2] ? '<b class="en-ok">Signature valide avec ce secret</b>' : '<b class="en-bad">Signature invalide avec ce secret</b>';
          } else sig = '<span class="hint">Saisissez le secret pour vérifier la signature ' + esc(alg) + '.</span>';
        } else sig = '<span class="hint">Algorithme ' + esc(String(alg)) + ' : vérification impossible ici (clé publique requise).</span>';
        if (my !== token) return;
        outText = JSON.stringify({ header, payload }, null, 2);
        RES.innerHTML = `<h4 class="en-h">En-tête</h4><pre class="en-pre">${esc(JSON.stringify(header, null, 2))}</pre><h4 class="en-h">Contenu (payload)</h4><pre class="en-pre">${esc(JSON.stringify(payload, null, 2))}</pre>` + (dates.length ? '<h4 class="en-h">Dates</h4>' + card(dates) : '') + `<h4 class="en-h">Signature</h4><p>${sig}</p>`;
      }
    } catch (e) { setErr(e.message); RES.innerHTML = ''; }
  }

  const go = debounce(run, 100);
  IN.addEventListener('input', () => { fileData = null; go(); });
  $('#en-secret', host).addEventListener('input', go);
  bindSeg('en-mode', v => { setMode(v); });
  bindSeg('en-dir', v => { S.dir = v; run(); });
  $('#en-file-b', host).addEventListener('click', () => $('#en-file', host).click());
  $('#en-file', host).addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast('Fichier trop volumineux (20 Mo maximum).'); return; }
    fileData = { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) };
    IN.value = '';
    run();
  });
  RES.addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (b) copy(b.dataset.h, 'Empreinte copiée'); });
  $('#en-copy', host).addEventListener('click', () => { if (outText) copy(outText, 'Résultat copié'); });
  $('#en-swap', host).addEventListener('click', () => { if (!outText || S.mode === 'jwt' || S.mode === 'hash') return; IN.value = outText; fileData = null; S.dir = S.dir === 'enc' ? 'dec' : 'enc'; $$('#en-dir button', host).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.dir)); run(); });
  $('#en-sample', host).addEventListener('click', () => { IN.value = SAMPLES[S.mode]; fileData = null; if (S.mode === 'jwt') $('#en-secret', host).value = 'secret'; if (S.mode === 'html' || S.mode === 'url') { S.dir = 'enc'; $$('#en-dir button', host).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'enc')); } run(); });
  $('#en-clear', host).addEventListener('click', () => { IN.value = ''; fileData = null; run(); IN.focus(); });
  setMode('b64');
})();
