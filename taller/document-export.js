import {poemBlocks,escapeHtml,countLines} from './model.js';
const xml=escapeHtml;
import {coverHtml,coverLines,coverOptions} from './cover-policy.js';
export function downloadFile(name,content,type) {
  const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export const safeName=value=>String(value||'obra').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/,'').slice(0,120);
export function documentHtml(contest, entries, plica=false, author={}) {
  const p=contest.profile;
  const css=`@page {size:${p.paper==='Letter'?'letter':'A4'};margin:${p.margin}cm} body{font-family:"${p.font}",serif;font-size:${p.size}pt;line-height:${p.lineSpacing};color:#000} h1,h2{font-size:${p.size}pt;line-height:${p.lineSpacing}} .cover{text-align:center;break-after:page;padding-top:5cm} .poem{${p.newPage?'break-before:page;':''}} .poem.first{break-before:auto} .line{white-space:pre-wrap;min-height:${p.size*p.lineSpacing}pt} blockquote{margin:1em 0 1.5em 1.5cm;${p.quoteItalic?'font-style:italic;':''}break-inside:avoid;white-space:pre-wrap} .page-note{font-size:10pt} p{white-space:pre-wrap}`;
  let content;
  if(plica){content=`<h1>Plica · ${xml(p.workTitle||contest.name)}</h1><p>Seudónimo: ${xml(p.pseudonym)}</p><p>Obras: ${xml(entries.map(e=>e.poem.title).join('; '))}</p>${Object.entries(author).map(([label,value])=>`<p>${xml(label)}: ${xml(value)}</p>`).join('')}`;}
  else content=(p.cover?coverHtml(contest,entries):'')+entries.map((e,i)=>`<section class="poem ${i===0?'first':''}"><h2>${xml(e.poem.title)}</h2>${!p.cover&&p.pseudonym&&coverOptions(contest).pseudonym?`<p>${xml(p.pseudonym)}</p>`:''}${poemBlocks(e.version.poemText).map(b=>b.type==='quote'?`<blockquote>${xml(b.lines.join('\n'))}</blockquote>`:`<div class="line">${xml(b.lines[0])||'&nbsp;'}</div>`).join('')}</section>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${xml(plica?'PLICA '+p.pseudonym:p.workTitle||'Obra')}</title><style>${css}</style></head><body>${content}</body></html>`;
}
export function printDocument(contest,entries,plica=false,author={}) {
  const win=window.open('','_blank');if(!win)throw Error('Permití abrir la ventana de impresión.');
  win.document.open();win.document.write(documentHtml(contest,entries,plica,author));win.document.close();
  // document.close can complete before an onload handler is attached.
  // Wait for font layout explicitly, then open printing without relying on that event.
  Promise.resolve(win.document.fonts?.ready).then(()=>setTimeout(()=>{if(!win.closed){win.focus();win.print();}},150));
  // Browser print dialog controls PDF pagination, print headers and page numbering.
}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
export function zipStore(files) {
  const encoder=new TextEncoder(),locals=[],centrals=[];let offset=0;
  const header=size=>{const b=new Uint8Array(size);return {b,v:new DataView(b.buffer)};};
  for(const [name,content] of Object.entries(files)){
    const filename=encoder.encode(name),data=encoder.encode(content),crc=crc32(data),local=header(30+filename.length);
    local.v.setUint32(0,0x04034b50,true);local.v.setUint16(4,20,true);local.v.setUint16(6,0x800,true);local.v.setUint32(14,crc,true);local.v.setUint32(18,data.length,true);local.v.setUint32(22,data.length,true);local.v.setUint16(26,filename.length,true);local.b.set(filename,30);locals.push(local.b,data);
    const central=header(46+filename.length);central.v.setUint32(0,0x02014b50,true);central.v.setUint16(4,20,true);central.v.setUint16(6,20,true);central.v.setUint16(8,0x800,true);central.v.setUint32(16,crc,true);central.v.setUint32(20,data.length,true);central.v.setUint32(24,data.length,true);central.v.setUint16(28,filename.length,true);central.v.setUint32(42,offset,true);central.b.set(filename,46);centrals.push(central.b);offset+=local.b.length+data.length;
  }
  const size=centrals.reduce((n,b)=>n+b.length,0),end=header(22);end.v.setUint32(0,0x06054b50,true);end.v.setUint16(8,centrals.length,true);end.v.setUint16(10,centrals.length,true);end.v.setUint32(12,size,true);end.v.setUint32(16,offset,true);
  return new Blob([...locals,...centrals,end.b],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
export function buildDocx(contest,entries,plica=false,author={}) {
  const p=contest.profile;
  const paragraph=(text,{quote=false,bold=false,center=false,pageBreak=false,keep=false,before=0,after=0}={})=>`<w:p><w:pPr>${pageBreak?'<w:pageBreakBefore/>':''}${keep?'<w:keepNext/>':''}${quote?'<w:ind w:left="850"/><w:keepNext/>':''}${center?'<w:jc w:val="center"/>':''}<w:spacing w:before="${before}" w:after="${after}" w:line="${Math.round(p.lineSpacing*240)}" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="${xml(p.font)}" w:hAnsi="${xml(p.font)}"/><w:sz w:val="${Math.round(p.size*2)}"/>${bold?'<w:b/>':''}${quote&&p.quoteItalic?'<w:i/>':''}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
  let content='';
  if(plica){content+=paragraph('Plica · '+(p.workTitle||contest.name),{bold:true});content+=paragraph('Seudónimo: '+p.pseudonym);content+=paragraph('Obras: '+entries.map(e=>e.poem.title).join('; '));for(const [label,value]of Object.entries(author))content+=paragraph(label+': '+value);}
  else {
    if(p.cover){const options=coverOptions(contest);coverLines(contest,entries).forEach((line,i)=>{content+=paragraph(line.text,{center:options.alignment==='center',bold:line.type==='title',before:i===0&&options.position==='middle'?2835:0,after:240});});}
    entries.forEach((e,i)=>{content+=paragraph(e.poem.title,{bold:true,keep:true,pageBreak:(i===0&&p.cover)||(i>0&&p.newPage)});if(!p.cover&&p.pseudonym&&coverOptions(contest).pseudonym)content+=paragraph(p.pseudonym);for(const b of poemBlocks(e.version.poemText)){if(b.type==='quote'){b.lines.forEach((line,index)=>{content+=paragraph(line,{quote:true,keep:index<b.lines.length-1});});content+=paragraph('');}else content+=paragraph(b.lines[0]);}});
  }
  const margin=Math.round(p.margin*567),width=p.paper==='Letter'?12240:11906,height=p.paper==='Letter'?15840:16838;
  const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${content}<w:sectPr>${p.numbered?'<w:footerReference w:type="default" r:id="rId1"/>':''}<w:pgSz w:w="${width}" w:h="${height}"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="300" w:footer="300"/></w:sectPr></w:body></w:document>`;
  const footer='<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';
  return zipStore({'[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>','_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':doc,'word/footer1.xml':footer,'word/_rels/document.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>'});
}
