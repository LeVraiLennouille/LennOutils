(function () {
  'use strict';
  const { $, $$, esc, tog, copy, debounce, mk } = Kit;

  const FLAGS = [['g', 'Global (g)', true], ['i', 'Insensible à la casse (i)', false], ['m', 'Multiligne (m)', false], ['s', 'Le point inclut les retours (s)', false], ['u', 'Unicode (u)', false]];

  mk('regex', `<div class="stage-col">
    <div class="card rx-card">
      <label for="rx-pat">Expression régulière</label>
      <div class="rx-bar"><span class="rx-sl">/</span><input type="text" id="rx-pat" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="ex. \\b(\\w+)@exemple\\.fr\\b"><span class="rx-sl">/</span><span class="rx-fl" id="rx-fl">g</span></div>
      <div class="qr-msg is-error" id="rx-err" hidden></div>
    </div>
    <div class="card rx-card">
      <div class="df-in-head"><label for="rx-text">Texte à tester</label><span class="hint" id="rx-count"></span></div>
      <textarea class="text-input df-ta rx-ta" id="rx-text" spellcheck="false" wrap="soft" placeholder="Collez ou saisissez le texte à analyser"></textarea>
    </div>
    <div class="card rx-card"><div class="df-in-head"><h3 class="lr-h">Correspondances surlignées</h3></div><div class="rx-hl" id="rx-hl" tabindex="0"></div></div>
    <div class="card rx-card"><div class="df-in-head"><h3 class="lr-h">Détail des correspondances</h3></div><div class="rx-list" id="rx-list"></div></div>
    <div class="card rx-card"><div class="df-in-head"><label for="rx-rep">Remplacement</label><span class="hint">$1, $2, $&amp;, $&lt;nom&gt;</span></div>
      <input type="text" id="rx-rep" spellcheck="false" autocomplete="off" placeholder="Texte de remplacement (facultatif)">
      <textarea class="text-input df-ta rx-ta" id="rx-res" readonly spellcheck="false" wrap="soft" placeholder="Le résultat du remplacement s’affiche ici"></textarea></div>
    <div class="card rx-card"><div class="df-in-head"><h3 class="lr-h">Explication</h3></div><div class="rx-ex" id="rx-ex"></div></div></div>
    <div class="controls-col">
      <div class="card control-card"><h3>Drapeaux</h3>${FLAGS.map(f => tog('rx-f-' + f[0], f[1], f[2])).join('')}</div>
      <div class="card control-card"><h3>Modèles courants</h3><div class="rx-presets" id="rx-presets">${RegexCore.PRESETS.map(p => `<button type="button" data-id="${p.id}">${esc(p.label)}</button>`).join('')}</div></div>
      <div class="card control-card"><h3>Copier</h3><div class="df-btns">
        <button type="button" class="btn btn-ghost btn-block" id="rx-c1">Littéral JavaScript</button>
        <button type="button" class="btn btn-ghost btn-block" id="rx-c2">new RegExp(…)</button>
        <button type="button" class="btn btn-ghost btn-block" id="rx-clear">Tout effacer</button>
      </div></div></div>`);

  const host = $('#view-regex');
  const PAT = $('#rx-pat', host), TXT = $('#rx-text', host);
  const flags = () => FLAGS.filter(f => $('#rx-f-' + f[0], host).checked).map(f => f[0]).join('');
  let worker = null, seq = 0;

  const SRC = `const exec=${RegexCore.execCore.toString()};self.onmessage=e=>{try{self.postMessage({id:e.data.id,ok:true,r:exec(e.data)})}catch(x){self.postMessage({id:e.data.id,ok:false,error:String(x.message||x)})}};`;
  function startWorker() {
    try { worker = new Worker(URL.createObjectURL(new Blob([SRC], { type: 'application/javascript' }))); } catch (e) { worker = null; }
  }
  function execute(opts) {
    return new Promise((resolve, reject) => {
      if (!worker) startWorker();
      if (!worker) { try { resolve(RegexCore.execCore(opts)); } catch (e) { reject(e); } return; }
      const id = ++seq;
      const timer = setTimeout(() => { worker.terminate(); worker = null; reject(new Error('timeout')); }, 1500);
      worker.onmessage = e => { if (e.data.id !== id) return; clearTimeout(timer); e.data.ok ? resolve(e.data.r) : reject(new Error(e.data.error)); };
      worker.postMessage(Object.assign({ id }, opts));
    });
  }

  function highlight(text, matches) {
    let out = '', pos = 0;
    matches.forEach((m, i) => {
      if (m.index < pos) return;
      out += esc(text.slice(pos, m.index));
      out += `<mark class="rx-m${i % 2}">${m.text === '' ? '<span class="rx-empty">∅</span>' : esc(text.slice(m.index, m.end))}</mark>`;
      pos = m.end;
    });
    return out + esc(text.slice(pos));
  }

  function explainHtml(src, fl) {
    const items = RegexCore.explain(src, fl);
    return items.length ? items.map(x => `<div class="rx-ex-row" style="--d:${x.depth}"><code>${esc(x.t)}</code><span>${esc(x.d)}</span></div>`).join('') : '<p class="hint">Saisissez une expression pour obtenir son explication.</p>';
  }

  async function run() {
    const pat = PAT.value, fl = flags(), text = TXT.value;
    $('#rx-fl', host).textContent = fl;
    $('#rx-count', host).textContent = text ? text.length + ' caractères' : '';
    const err = $('#rx-err', host);
    err.hidden = true;
    $('#rx-ex', host).innerHTML = explainHtml(pat, fl);
    if (!pat) { $('#rx-hl', host).innerHTML = '<p class="hint">Les correspondances apparaîtront ici.</p>'; $('#rx-list', host).innerHTML = ''; $('#rx-res', host).value = ''; return; }
    try { new RegExp(pat, fl); } catch (e) { err.hidden = false; err.textContent = 'Expression invalide : ' + e.message.replace(/^Invalid regular expression:\s*/, ''); $('#rx-hl', host).innerHTML = esc(text); $('#rx-list', host).innerHTML = ''; $('#rx-res', host).value = ''; return; }
    const rep = $('#rx-rep', host).value;
    let r;
    try { r = await execute({ pattern: pat, flags: fl, text, replacement: rep === '' ? null : rep, limit: 500 }); }
    catch (e) {
      err.hidden = false;
      err.textContent = e.message === 'timeout' ? 'Expression trop lente à évaluer sur ce texte (risque de retour sur trace catastrophique). Simplifiez-la ou raccourcissez le texte.' : e.message;
      return;
    }
    $('#rx-hl', host).innerHTML = text ? highlight(text, r.matches) : '<p class="hint">Saisissez un texte à tester.</p>';
    const n = r.matches.length;
    $('#rx-list', host).innerHTML = n
      ? `<p class="hint">${n}${r.truncated ? '+' : ''} correspondance${n > 1 ? 's' : ''}${r.truncated ? ' (limitées à 500)' : ''}</p>` + r.matches.slice(0, 200).map((m, i) => {
        const g = m.groups.map((x, k) => `<li><b>$${k + 1}</b> <code>${x === undefined ? 'non participé' : esc(x === '' ? '(vide)' : x)}</code></li>`).join('');
        const nm = m.named ? Object.keys(m.named).map(k => `<li><b>${esc(k)}</b> <code>${m.named[k] === undefined ? 'non participé' : esc(m.named[k])}</code></li>`).join('') : '';
        return `<div class="rx-match"><div class="rx-mh"><b>#${i + 1}</b><span>position ${m.index} à ${m.end}</span></div><code class="rx-mt">${m.text === '' ? '(chaîne vide)' : esc(m.text)}</code>${g || nm ? `<ul>${g}${nm}</ul>` : ''}</div>`;
      }).join('')
      : '<p class="hint">Aucune correspondance.</p>';
    $('#rx-res', host).value = r.replaced === null ? '' : r.replaced;
  }

  const go = debounce(run, 120);
  [PAT, TXT, $('#rx-rep', host)].forEach(e => e.addEventListener('input', go));
  $$('input[type="checkbox"]', host).forEach(e => e.addEventListener('change', run));
  $('#rx-presets', host).addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const p = RegexCore.PRESETS.find(x => x.id === b.dataset.id);
    PAT.value = p.p;
    FLAGS.forEach(f => { $('#rx-f-' + f[0], host).checked = p.f.indexOf(f[0]) >= 0; });
    TXT.value = p.s;
    run();
  });
  $('#rx-c1', host).addEventListener('click', () => { if (PAT.value) copy('/' + PAT.value.replace(/\//g, '\\/') + '/' + flags(), 'Littéral copié'); });
  $('#rx-c2', host).addEventListener('click', () => { if (PAT.value) copy('new RegExp(' + JSON.stringify(PAT.value) + ', "' + flags() + '")', 'Code copié'); });
  $('#rx-clear', host).addEventListener('click', () => { PAT.value = ''; TXT.value = ''; $('#rx-rep', host).value = ''; run(); PAT.focus(); });
  run();
})();
