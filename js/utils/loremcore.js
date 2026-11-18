(function (root) {
  'use strict';

  const rngFrom = seed => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const lowerFirst = s => s.charAt(0).toLowerCase() + s.slice(1);
  const chance = (r, p) => r() < p;
  function shuffle(r, a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }
  function take(r, pool, n) {
    let out = [];
    while (out.length < n) out = out.concat(shuffle(r, pool));
    return out.slice(0, n);
  }
  function gen(r, list) {
    let t = 0;
    list.forEach(x => { t += x[0]; });
    let v = r() * t;
    for (const x of list) { v -= x[0]; if (v < 0) return x[1](r); }
    return list[list.length - 1][1](r);
  }

  const LATIN = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nunc gravida ullamcorper vestibulum ante primis faucibus orci luctus ultrices posuere cubilia curae aenean lectus sagittis mauris blandit eleifend ligula porttitor suspendisse potenti maecenas eget nibh vitae felis fermentum rhoncus libero tortor facilisis vel pharetra augue integer nec odio praesent sodales volutpat mi neque risus feugiat quisque tellus semper egestas pellentesque habitant morbi tristique senectus netus malesuada fames turpis cras mattis pulvinar dapibus leo'.split(' ');
  const LATIN_START = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

  function latinWords(r, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      let w = pick(r, LATIN);
      if (out.length && out[out.length - 1] === w) w = pick(r, LATIN);
      out.push(w);
    }
    return out;
  }

  function latinSentence(r) {
    const n = int(r, 6, 15), w = latinWords(r, n);
    let s = '';
    const commaAt = new Set();
    if (n > 8) commaAt.add(int(r, 3, 6));
    if (n > 12 && chance(r, 0.6)) commaAt.add(int(r, 8, n - 3));
    w.forEach((x, i) => { s += (i ? ' ' : '') + x + (commaAt.has(i + 1) && i < n - 1 ? ',' : ''); });
    return cap(s) + '.';
  }
  const latinTitle = r => cap(latinWords(r, int(r, 2, 4)).join(' '));
  const latinItem = r => cap(latinWords(r, int(r, 3, 6)).join(' '));

  const CAKE_STEPS = {
    preheat: ['Préchauffez le four à 180 °C (th. 6) et beurrez un moule de 22 cm de diamètre', ['', ' pendant que vous préparez la pâte', ', chaleur tournante si possible']],
    melt: ['Faites fondre le chocolat avec le beurre au bain-marie', [', en remuant de temps en temps', ' jusqu’à obtenir une texture lisse et brillante', ' à feu très doux']],
    whisk: ['Dans un saladier, fouettez les œufs avec le sucre', [' jusqu’à ce que le mélange blanchisse et double de volume', ' pendant deux bonnes minutes']],
    mix: ['Versez le chocolat fondu sur les œufs, ajoutez la pincée de sel, puis incorporez la farine tamisée', [' sans trop travailler la pâte', ' à la maryse, délicatement']],
    pour: ['Versez la pâte dans le moule', [' et lissez la surface', ', puis tapotez légèrement pour chasser les bulles d’air']],
    bake: ['Enfournez le gâteau', [' pour vingt-cinq minutes environ : le dessus doit être pris, mais le cœur encore tremblotant', ' sur la grille du milieu et surveillez la cuisson']],
    rest: ['Laissez tiédir le gâteau', [' dix minutes dans son moule avant de le démouler', ' sur une grille pour garder un dessus craquelé']]
  };
  const CAKE_EXTRAS = [
    { ing: '50 g de noisettes concassées', step: ['Parsemez la surface de noisettes concassées', [' avant d’enfourner', ' pour apporter du croquant']], after: true },
    { ing: 'Le zeste d’une orange non traitée', step: ['Ajoutez le zeste d’orange à la pâte', [' pour relever l’amertume du cacao', ' et mélangez une dernière fois']], after: false },
    { ing: '1 cuillère à café de café soluble', step: ['Diluez le café soluble dans le chocolat fondu', [' pour intensifier le goût', ' avant de l’ajouter aux œufs']], after: false }
  ];
  const CAKE_INTRO = [
    'Ce gâteau au chocolat fondant est un incontournable des goûters entre amis.',
    'Le secret réside dans la qualité du chocolat : choisissez-le avec au moins 60 % de cacao.',
    'Le cœur doit rester légèrement coulant, tandis que les bords se craquellent à la cuisson.',
    'Rien de plus simple : une poignée d’ingrédients, un saladier et quinze minutes de préparation.',
    'Servi tiède avec une boule de glace à la vanille, il ravira les gourmands.',
    'Les enfants adorent lécher le saladier, c’est presque une tradition.',
    'Conservé sous cloche, il garde tout son moelleux pendant trois jours.',
    'N’ouvrez pas le four trop tôt, au risque de voir le gâteau retomber.',
    'La vraie réussite tient à la cuisson : mieux vaut le sortir un peu trop tôt que trop tard.',
    'Un filet de crème anglaise fera de ce dessert un vrai moment de réconfort.',
    'Recette de famille transmise de génération en génération, elle ne déçoit jamais.',
    'Ici, pas de chichis : du bon chocolat, du beurre et un peu de patience.'
  ];
  const CAKE_TIPS = [
    'utilisez des œufs à température ambiante',
    'pesez les ingrédients avec précision',
    'laissez reposer la pâte cinq minutes avant la cuisson',
    'vérifiez la cuisson avec la pointe d’un couteau',
    'remplacez le sucre blanc par du sucre de canne complet',
    'faites fondre le chocolat à feu doux pour éviter qu’il ne brûle',
    'tamisez la farine pour une pâte bien lisse'
  ];
  const CAKE_MORE = [
    ['Tamisez le cacao', [' pour éviter les grumeaux', ' directement au-dessus du saladier']],
    ['Montez les blancs en neige ferme avec une pincée de sel', [', puis incorporez-les en deux fois', ' avant de les ajouter délicatement à la pâte']],
    ['Beurrez et farinez soigneusement le moule', [' pour que le gâteau se démoule facilement', ' en veillant à bien couvrir les bords']],
    ['Saupoudrez le gâteau de sucre glace', [' au moment de servir', ' à l’aide d’une petite passoire']],
    ['Servez le gâteau', [' tiède, avec une boule de glace à la vanille', ' avec un filet de crème anglaise', ' accompagné d’un café bien serré']],
    ['Coupez le chocolat en petits morceaux', [' pour qu’il fonde plus uniformément', ' avant de le déposer dans un bol']],
    ['Laissez reposer la pâte quelques minutes', [' avant de la verser dans le moule', ' le temps de beurrer le moule']]
  ];
  const cakeStep = (r, s) => s[0] + pick(r, s[1]) + '.';
  const cakeAny = r => {
    const all = Object.keys(CAKE_STEPS).map(k => CAKE_STEPS[k]).concat(CAKE_MORE);
    return cakeStep(r, pick(r, all));
  };

  const PIRATE = {
    picks: ['Hissez les voiles, moussaillons, le vent se lève !', 'Le trésor repose sous la croix rouge, à trois pas du vieux chêne.', 'Mille sabords, la carte est incomplète !', 'Le perroquet du capitaine répète tout ce qu’il entend, même les secrets.', 'Une bouteille de rhum, un sabre et une boussole détraquée, voilà tout mon bagage.', 'Quand la brume tombe, le Hollandais volant n’est jamais bien loin.', 'Ce soir, on festoie à la taverne du Crabe Boiteux.', 'Le quartier-maître compte les pièces d’or pour la troisième fois.', 'Au loin, un pavillon noir se découpe sur l’horizon.', 'Les vagues cognent la coque comme si l’océan réclamait son dû.', 'Personne ne quitte le pont avant que le butin soit partagé équitablement.', 'Même les requins hésitent à approcher de notre navire.'],
    cap: ['scrute l’horizon avec sa longue-vue', 'brandit son sabre sous la lune', 'consulte la carte au trésor une dernière fois', 'ordonne de lever l’ancre avant l’aube', 'éclate d’un rire tonitruant'],
    crew: ['chantent à tue-tête une vieille complainte', 'hissent la grand-voile en cadence', 'fouillent la cale à la recherche du rhum', 'montent la garde dans le nid-de-pie'],
    titles: ['L’île au trésor', 'La malédiction du Kraken', 'Le chant des sirènes', 'Cap sur l’inconnu', 'La taverne du Crabe Boiteux'],
    items: ['Une boussole fêlée', 'Un coffre rempli d’or', 'Trois tonneaux de rhum', 'Un perroquet bavard', 'Une carte déchirée', 'Un sabre d’abordage']
  };
  const SECTIONS = 5;
  const PARA = { min: 7, max: 10 };

  const THEMES = {
    classique: {
      label: 'Classique',
      desc: 'Le fameux « Lorem ipsum » en pseudo-latin, parfait pour tester une mise en page sans se laisser distraire par le sens.',
      start: LATIN_START,
      sentence: latinSentence,
      titles: (r, n) => Array.from({ length: n }, () => latinTitle(r))
    },
    recette: {
      label: 'Recette de cuisine',
      desc: 'Un gâteau au chocolat fondant : étapes de recette, conseils et astuces de pâtissier.',
      sentence: r => gen(r, [
        [5, r => cakeAny(r)],
        [4, r => pick(r, CAKE_INTRO)],
        [1.4, r => 'Astuce : ' + pick(r, CAKE_TIPS) + '.']
      ]),
      titles: (r, n) => take(r, ['Les ingrédients', 'La pâte', 'La cuisson', 'Le démoulage', 'Les astuces du chef', 'La dégustation', 'Les variantes'], n)
    },
    pirates: {
      label: 'Pirates',
      desc: 'Cap sur l’aventure : capitaine, trésor, rhum et perroquet bavard, pour un lorem ipsum qui sent l’embrun.',
      sentence: r => gen(r, [
        [6, r => pick(r, PIRATE.picks)],
        [2, r => 'Le capitaine ' + pick(r, PIRATE.cap) + '.'],
        [2, r => 'Les matelots ' + pick(r, PIRATE.crew) + '.']
      ]),
      titles: (r, n) => take(r, PIRATE.titles, n)
    }
  };

  function generate(o) {
    const th = THEMES[o.theme] || THEMES.classique;
    const r = rngFrom(o.seed || 1);
    const seen = new Set();
    const sentence = () => {
      let s = th.sentence(r);
      for (let i = 0; i < 10 && seen.has(s); i++) s = th.sentence(r);
      seen.add(s);
      return s;
    };
    const titles = th.titles(r, SECTIONS);
    return titles.map((title, i) => {
      const n = int(r, PARA.min, PARA.max);
      let text = Array.from({ length: n }, sentence).join(' ');
      if (i === 0 && th.start) text = th.start + ' ' + Array.from({ length: n - 1 }, sentence).join(' ');
      return { title, text };
    });
  }

  const toText = sections => sections.map(s => s.title + '\n\n' + s.text).join('\n\n') + '\n';
  const list = () => Object.keys(THEMES).map(id => ({ id, label: THEMES[id].label, desc: THEMES[id].desc }));

  const api = { generate, toText, list, rngFrom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LoremCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
