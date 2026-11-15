/* Atelier PDF — Compresser */
(()=>{
const {$,fz,base,ld,js,out,ras,asPdf}=PDFK;
PDFK.tools.push(
['compresser','opt','Compresser PDF','Réduit le poids du fichier.','zip',{acc:'.pdf',opts:[['lv','Niveau','s','1.5|.7',[['0','Sans perte (structure seule)'],['2|.85','Léger (qualité haute)'],['1.5|.7','Recommandé'],['1|.5','Fort (poids minimal)']]],['t','Garder le texte sélectionnable','c',1]],note:'Les niveaux avec perte transforment chaque page en image : le texte n’est plus vectoriel.',run:async([f],o,u)=>{let b;if(o.lv=='0')b=await(await ld(f)).save({useObjectStreams:true});else{const[s,q]=o.lv.split('|').map(Number);b=await(await asPdf(await ras(await js(f),{s,q,txt:o.t},u),o.t)).save()}return[out(base(f)+'-compresse.pdf',b,b.length<f.size?`${fz(f.size)} → ${fz(b.length)}`:'Pas de gain : le fichier est déjà optimisé')]}}],
);
})();
