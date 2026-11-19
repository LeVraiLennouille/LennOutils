(function (root) {
  'use strict';

  const WORD = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
  const VOWELS = /[aeiouyàâäéèêëîïôöùûüÿœæ]+/g;
  const STOP = new Set('le la les de des du un une et en au aux ce ces cet cette ça ceci cela que qui quoi dont où pour par sur sous dans avec sans ne pas plus ou mais donc or ni car se sa son ses leur leurs nous vous ils elles il elle je tu on me te lui y est sont été être était étaient sera seront suis es sommes êtes ai as avons avez ont avait avaient aura auront fait faire fais très tout tous toute toutes aussi comme bien même entre vers chez cette autres autre ainsi alors donc lors puis encore déjà jamais toujours là ici ont mon ma mes ton ta tes notre nos votre vos'.split(' '));

  function syllables(w) {
    const lw = w.toLowerCase();
    if (/^\d+$/.test(lw)) return 1;
    let n = (lw.match(VOWELS) || []).length;
    if (n > 1 && /(e|es)$/.test(lw) && !/[éèêë]e?s?$/.test(lw) && !/[aeiouyàâäéèêëîïôöùûü](es?)$/.test(lw)) n--;
    return Math.max(1, n);
  }

  function fmtDuration(sec) {
    if (sec < 1) return '0 s';
    if (sec < 60) return Math.round(sec) + ' s';
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    if (m < 60) return m + ' min' + (s ? ' ' + s + ' s' : '');
    return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }

  function level(score) {
    if (score >= 90) return ['Très facile', 'Compréhensible dès 11 ans.'];
    if (score >= 80) return ['Facile', 'Lecture aisée pour le grand public.'];
    if (score >= 70) return ['Assez facile', 'Lecture fluide, style courant.'];
    if (score >= 60) return ['Standard', 'Niveau d’un article de presse.'];
    if (score >= 50) return ['Assez difficile', 'Demande de l’attention.'];
    if (score >= 30) return ['Difficile', 'Public averti, phrases ou mots longs.'];
    return ['Très difficile', 'Texte très dense ou technique.'];
  }

  function analyze(text, o) {
    o = o || {};
    const wpm = o.wpm || 230, spm = o.spm || 130;
    const words = text.match(WORD) || [];
    const nw = words.length;
    const paras = text.split(/\n\s*\n/).filter(p => p.trim()).length;
    const lines = text ? text.split(/\r\n|\r|\n/).length : 0;
    const sents = text.split(/(?<=[.!?…])["»”)\]]*\s+|\n{2,}/).filter(x => (x.match(WORD) || []).length).length;
    let syl = 0, letters = 0;
    const freq = new Map();
    words.forEach(w => {
      syl += syllables(w);
      letters += w.replace(/[^\p{L}\p{N}]/gu, '').length;
      const k = w.toLowerCase().replace(/^[ldjmtscn]['’]/, '');
      if (k.length > 2 && !STOP.has(k) && !/^\d+$/.test(k)) freq.set(k, (freq.get(k) || 0) + 1);
    });
    const unique = new Set(words.map(w => w.toLowerCase())).size;
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 8).map(([w, c]) => ({ w, c, p: nw ? (c / nw) * 100 : 0 }));
    const asl = sents ? nw / sents : 0, asw = nw ? syl / nw : 0;
    let score = null, lv = null;
    if (nw >= 5 && sents) {
      score = Math.max(0, Math.min(100, 207 - 1.015 * asl - 73.6 * asw));
      lv = level(score);
    }
    return {
      chars: text.length, charsNoSpace: text.replace(/\s/g, '').length, words: nw, unique, sentences: sents, paragraphs: paras, lines,
      avgWord: nw ? letters / nw : 0, avgSentence: asl, syllables: syl, score, level: lv,
      read: fmtDuration((nw / wpm) * 60), speak: fmtDuration((nw / spm) * 60), top
    };
  }

  const api = { analyze, syllables, fmtDuration, level };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CountCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
