/* Atelier PDF — Supprimer et extraire */
(()=>{
const {$,base,ld,pg,out}=PDFK;
PDFK.tools.push(
['supprimer','org','Supprimer des pages','Retire les pages dont tu n’as pas besoin.','x',{acc:'.pdf',opts:[['p','Pages à supprimer','x','2, 4-5']],run:async([f],o)=>{const s=await ld(f),N=s.getPageCount(),del=new Set(pg(o.p,N)),keep=[...Array(N).keys()].filter(i=>!del.has(i));if(!del.size)throw Error('Indique au moins une page.');if(!keep.length)throw Error('Il ne resterait aucune page.');const{PDFDocument:D}=PDFLib,d=await D.create();(await d.copyPages(s,keep)).forEach(p=>d.addPage(p));return[out(base(f)+'-sans-pages.pdf',await d.save(),`${keep.length} page(s) conservée(s)`)]}}],
['extraire','org','Extraire des pages','Garde seulement les pages choisies, en un fichier ou une page par fichier.','ext',{acc:'.pdf',opts:[['p','Pages à extraire','x','1-3, 7'],['s','Un fichier par page','c',0]],run:async([f],o)=>{const s=await ld(f),ix=pg(o.p,s.getPageCount()),{PDFDocument:D}=PDFLib;if(!ix.length)throw Error('Indique au moins une page.');const G=o.s?ix.map(i=>[i]):[ix],r=[];for(const[k,g]of G.entries()){const d=await D.create();(await d.copyPages(s,g)).forEach(p=>d.addPage(p));r.push(out(G.length>1?`${base(f)}-p${g[0]+1}.pdf`:base(f)+'-extrait.pdf',await d.save()))}return r}}],
);
})();
