/* Atelier PDF — helpers communs (chargement des libs, lecture, rendu, sortie) */
(()=>{
window.PDFK={tools:[]};
const $=(s,r=document)=>r.querySelector(s),E=h=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstElementChild},esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fz=b=>b<1024?b+' o':b<1048576?(b/1024).toFixed(1)+' Ko':(b/1048576).toFixed(1)+' Mo',base=f=>f.name.replace(/\.[^.]+$/,''),U8=async f=>new Uint8Array(await f.arrayBuffer()),clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const CDN='https://cdn.jsdelivr.net/npm/',WK=CDN+'pdfjs-dist@3.11.174/build/pdf.worker.min.js';
const L={pdflib:[CDN+'pdf-lib@1.17.1/dist/pdf-lib.min.js','PDFLib'],pdfjs:[CDN+'pdfjs-dist@3.11.174/build/pdf.min.js','pdfjsLib'],zip:[CDN+'jszip@3.10.1/dist/jszip.min.js','JSZip'],mam:[CDN+'mammoth@1.6.0/mammoth.browser.min.js','mammoth'],xl:[CDN+'xlsx@0.18.5/dist/xlsx.full.min.js','XLSX'],ocr:[CDN+'tesseract.js@5.1.1/dist/tesseract.min.js','Tesseract'],h2c:[CDN+'html2canvas@1.4.1/dist/html2canvas.min.js','html2canvas'],jspdf:[CDN+'jspdf@2.5.1/dist/jspdf.umd.min.js','jspdf'],pptx:[CDN+'pptxgenjs@3.12.0/dist/pptxgen.bundle.js','PptxGenJS']};
const LP={},lib=k=>LP[k]||(LP[k]=new Promise((ok,ko)=>{const[u,g]=L[k];if(window[g])return ok(window[g]);const s=document.createElement('script');s.src=u;s.onload=async()=>{try{if(k=='pdfjs')pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([await(await fetch(WK)).text()],{type:'text/javascript'}));ok(window[g])}catch(e){delete LP[k];ko(Error('Bibliothèque « '+k+' » indisponible : vérifie ta connexion.'))}};s.onerror=()=>{delete LP[k];ko(Error('Bibliothèque « '+k+' » indisponible : vérifie ta connexion.'))};document.head.append(s)}));
/* ---------- PDF : outils communs ---------- */
const ld=async f=>{const{PDFDocument:D}=await lib('pdflib');try{return await D.load(await U8(f),{updateMetadata:false})}catch(e){throw Error(/encrypt/i.test(e.message)?`« ${f.name} » est protégé : passe d’abord par « Déverrouiller PDF ».`:`« ${f.name} » est illisible ou abîmé : essaie « Réparer PDF ».`)}};
const js=async(f,pw)=>{await lib('pdfjs');try{return await pdfjsLib.getDocument({data:await U8(f),password:pw}).promise}catch(e){throw Error(e.name=='PasswordException'?'Ce PDF demande un mot de passe (absent ou incorrect).':`« ${f.name} » est illisible : essaie « Réparer PDF ».`)}};
const cvs=async(d,n,s)=>{const pg=await d.getPage(n),v=pg.getViewport({scale:s}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:x,viewport:v}).promise;return c};
const rg=(t,N)=>{const m=/^\s*(\d*)\s*(?:-\s*(\d*))?\s*$/.exec(t);if(!m||(!m[1]&&!m[2]))throw Error('Plage invalide : « '+t.trim()+' »');const a=+m[1]||1,b=m[2]===undefined?a:(+m[2]||N);if(a<1||b>N||a>b)throw Error('Plage hors du document (1–'+N+') : « '+t.trim()+' »');return Array.from({length:b-a+1},(_,i)=>a-1+i)},pg=(s,N)=>s.split(',').filter(x=>x.trim()).flatMap(t=>rg(t,N));
const out=(n,d,note,m='application/pdf')=>({n,d,note,m}),A4=[595.28,841.89];
/* géométrie « visuelle » d'une page (tient compte de /Rotate et du CropBox) */
const geo=p=>{const b=p.getCropBox(),r=((p.getRotation().angle%360)+360)%360,W=b.width,H=b.height,v=r%180?[H,W]:[W,H];return{r,vw:v[0],vh:v[1],m:(x,y)=>{const[a,c]=r==0?[x,y]:r==90?[W-y,x]:r==180?[W-x,H-y]:[y,H-x];return[b.x+a,b.y+c]}}};
const safe=(p,t,a)=>{try{p.drawText(t,a)}catch{try{p.drawText(t.replace(/[^\x20-\xff]/g,'?'),a)}catch{}}};
/* rastérise un PDF (images JPEG + texte invisible pour garder la recherche) */
const ras=async(d,{s=2,q=.8,txt=1,cover},u)=>{const o=[];for(let n=1;n<=d.numPages;n++){u&&u((n-1)/d.numPages,`Page ${n}/${d.numPages}`);const pg=await d.getPage(n),v=pg.getViewport({scale:1}),k=Math.min(s,4096/Math.max(v.width,v.height)),c=await cvs(d,n,k);(cover&&cover[n]||[]).forEach(z=>{const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(z.x*c.width,z.y*c.height,z.w*c.width,z.h*c.height)});let t=[];if(txt&&!(cover&&cover[n])){t=(await pg.getTextContent()).items.filter(i=>i.str.trim()).map(i=>{const[a,b,,,e,f]=i.transform,[x,y]=v.convertToViewportPoint(e,f);return{s:i.str,x,y,z:Math.hypot(a,b)}})}o.push({u:c.toDataURL('image/jpeg',q),w:v.width,h:v.height,t})}return o};
const asPdf=async(pp,txt=1)=>{const{PDFDocument:D,StandardFonts:S}=PDFLib,o=await D.create(),f=await o.embedFont(S.Helvetica);for(const p of pp){const g=o.addPage([p.w,p.h]);g.drawImage(await o.embedJpg(p.u),{x:0,y:0,width:p.w,height:p.h});if(txt)p.t.forEach(t=>safe(g,t.s,{x:t.x,y:p.h-t.y,size:Math.max(1,t.z),font:f,opacity:0}))}return o};
/* images */
const img=async f=>{const b=await createImageBitmap(f,{imageOrientation:'from-image'}),k=Math.min(1,2400/Math.max(b.width,b.height)),c=document.createElement('canvas');c.width=b.width*k|0;c.height=b.height*k|0;c.getContext('2d').drawImage(b,0,0,c.width,c.height);return c};
const num=s=>/^-?\d+([.,]\d+)?$/.test(s.trim())?+s.replace(',','.'):s;
const ZK=['TA','TB'];
const ZN='Dessine un rectangle sur l’aperçu pour choisir la zone.';
Object.assign(PDFK,{$,E,esc,fz,base,U8,clamp,CDN,WK,L,LP,lib,ld,js,cvs,rg,pg,out,A4,geo,safe,ras,asPdf,img,num,ZK,ZN});
})();
