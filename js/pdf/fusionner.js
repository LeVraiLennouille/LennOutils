/* Atelier PDF — Fusionner des PDF */
(()=>{
const {lib,ld,out}=PDFK;
PDFK.tools.push(
['fusionner','org','Fusionner PDF','Assemble plusieurs PDF en un seul document, dans l’ordre voulu.','merge',{acc:'.pdf',multi:1,min:2,run:async(fs)=>{const{PDFDocument:D}=await lib('pdflib'),o=await D.create();for(const f of fs){const s=await ld(f);(await o.copyPages(s,s.getPageIndices())).forEach(p=>o.addPage(p))}return[out('fusion.pdf',await o.save())]}}],
);
})();
