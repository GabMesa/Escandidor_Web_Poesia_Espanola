import {escapeHtml} from './model.js';
const xml=escapeHtml;
import {coverHtml,coverLines,coverOptions} from './cover-policy.js';
import {
  paginateDeliveryEntries,
  workHeaderOptions,
  renderPoemContentHtml,
  groupPoemStanzas,
  splitVerseHemistichs,
  STANZA_GAP_MULT,
  HEMISTICH_GAP_PT
} from './delivery-format.js';

export function downloadFile(name,content,type) {
  const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export const safeName=value=>String(value||'obra').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/,'').slice(0,120);

export function documentHtml(contest, entries, plica=false, author={}) {
  const p=contest.profile;
  const css=`@page {size:${p.paper==='Letter'?'letter':'A4'};margin:${p.margin}cm}
body{font-family:"${xml(p.font)}",serif;font-size:${p.size}pt;line-height:${p.lineSpacing};color:#000;margin:0}
h1,h2{font-size:${p.size}pt;line-height:${p.lineSpacing};margin:0}
p{white-space:pre-wrap;margin:0}
.cover{text-align:center;break-after:page;page-break-after:always;padding-top:5cm}
.cover h2{font-size:${Math.round(p.size*1.35)}pt;margin-bottom:14pt}
.cover p{margin-top:10pt}
.work-header{text-align:center;margin-bottom:18pt;padding-bottom:10pt;border-bottom:0.5pt solid #888}
.work-header .work-title{font-size:${Math.round(p.size*1.25)}pt;font-weight:700;margin-bottom:4pt}
.work-header .work-date{font-size:${Math.max(9,p.size-1)}pt;font-style:italic;color:#333}
.poem-sheet.page-break{break-before:page;page-break-before:always}
.poem-sheet.first{break-before:auto;page-break-before:auto}
.poem{margin-bottom:22pt}
.poem:last-child{margin-bottom:0}
.poem.fit-one-page{break-inside:avoid;page-break-inside:avoid}
.poem-head{margin-bottom:12pt;break-after:avoid;page-break-after:avoid}
.poem-pseudonym{margin-top:4pt}
.poem-date{margin-top:4pt;font-size:0.9em;font-style:italic;color:#333}
.stanza{margin-bottom:var(--stanza-gap,1em)}
.stanza:last-child{margin-bottom:0}
.keep-stanza{break-inside:avoid;page-break-inside:avoid}
.verse{white-space:pre-wrap;margin:0;break-inside:avoid}
.verse-hemistich{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:var(--hemistich-gap,2em);align-items:baseline}
.hemistich-left{text-align:right}
.hemistich-right{text-align:left}
.hemistich-single{grid-column:1 / -1;text-align:center}
.poem-cols-2{column-count:2;column-gap:1.2cm;column-fill:balance}
.poem-cols-3{column-count:3;column-gap:0.8cm;column-fill:balance}
.sheet-multi-cols{display:grid;grid-template-columns:repeat(var(--sheet-cols,2),minmax(0,1fr));column-gap:1.1cm;align-items:start}
.sheet-multi-cols .poem{margin-bottom:0}
blockquote,.poem-quote{margin:0.6em 0 1em 1.2cm;${p.quoteItalic?'font-style:italic;':''}break-inside:avoid;white-space:pre-wrap}
.page-note{font-size:10pt}`;

  let content;
  if(plica){
    content=`<h1>Plica · ${xml(p.workTitle||contest.name)}</h1><p>Seudónimo: ${xml(p.pseudonym)}</p><p>Obras: ${xml(entries.map(e=>e.poem.title).join('; '))}</p>${Object.entries(author).map(([label,value])=>`<p>${xml(label)}: ${xml(value)}</p>`).join('')}`;
  }else{
    const pages=paginateDeliveryEntries(contest,entries);
    const workHeader=workHeaderOptions(contest,entries);
    const showInlinePseudonym=!p.cover&&Boolean(p.pseudonym)&&coverOptions(contest).pseudonym;
    const sheetsHtml=pages.map((page,pageIndex)=>{
      const workHeaderHtml=pageIndex===0&&!p.cover&&(workHeader.showTitle||workHeader.showDate)
        ?`<header class="work-header">${workHeader.showTitle?`<h1 class="work-title">${xml(workHeader.titleText)}</h1>`:''}${workHeader.showDate&&workHeader.dateText?`<p class="work-date">${xml(workHeader.dateText)}</p>`:''}</header>`
        :'';
      const poemsHtml=page.items.map(item=>{
        const rendered=renderPoemContentHtml(item.entry,item.format,{
          size:item.effectiveSize,
          lineSpacing:item.effectiveLineSpacing,
          quoteItalic:p.quoteItalic!==false,
          showPseudonym:showInlinePseudonym?p.pseudonym:'',
          forPrint:true
        });
        return `<section class="poem${item.format.columns>1?` has-columns cols-${item.format.columns}`:''}${item.format.fitOnePage?' fit-one-page':''}" style="${rendered.sectionStyle}">${rendered.headerHtml}${rendered.bodyHtml}</section>`;
      }).join('');
      const bodyHtml=page.isSideBySide
        ?`<div class="sheet-multi-cols" style="--sheet-cols:${page.items.length}">${poemsHtml}</div>`
        :poemsHtml;
      const cls=pageIndex===0?'poem-sheet first':page.forcedBreak?'poem-sheet page-break':'poem-sheet';
      return `<div class="${cls}">${workHeaderHtml}${bodyHtml}</div>`;
    }).join('');
    content=(p.cover?coverHtml(contest,entries):'')+sheetsHtml;
  }
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
  const margin=Math.round((Number(p.margin)||2.5)*567);
  const pageWidth=p.paper==='Letter'?12240:11906;
  const pageHeight=p.paper==='Letter'?15840:16838;
  const usableWidth=Math.max(3600,pageWidth-margin*2);

  const runProps=({font=p.font,size=p.size,bold=false,italic=false,caps=false}={})=>`<w:rPr><w:rFonts w:ascii="${xml(font)}" w:hAnsi="${xml(font)}"/><w:sz w:val="${Math.round(size*2)}"/>${bold?'<w:b/>':''}${italic?'<w:i/>':''}${caps?'<w:caps/>':''}</w:rPr>`;

  const paragraph=(text,{font=p.font,size=p.size,lineSpacing=p.lineSpacing,quote=false,bold=false,italic=false,caps=false,align='left',pageBreak=false,keep=false,before=0,after=0,indentTwips=0,sectPr=''}={})=>{
    const jc=align==='center'?'<w:jc w:val="center"/>':align==='right'?'<w:jc w:val="right"/>':'';
    const leftInd=quote?850:indentTwips;
    const ind=leftInd>0?`<w:ind w:left="${leftInd}"/>`:'';
    return `<w:p><w:pPr>${pageBreak?'<w:pageBreakBefore/>':''}${keep||quote?'<w:keepNext/>':''}${ind}${jc}<w:spacing w:before="${before}" w:after="${after}" w:line="${Math.round(lineSpacing*240)}" w:lineRule="auto"/>${sectPr}</w:pPr><w:r>${runProps({font,size,bold,italic:italic||(quote&&p.quoteItalic!==false),caps})}<w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
  };

  const hemistichParagraph=(leftText,rightText,{font,size,lineSpacing,gap='normal',colWidthTwips=usableWidth,keep=false,after=0}={})=>{
    const halfGap=Math.round((HEMISTICH_GAP_PT[gap]||24)*10);
    const center=Math.round(colWidthTwips/2);
    const leftStop=Math.max(400,center-halfGap);
    const rightStop=Math.min(colWidthTwips-400,center+halfGap);
    const rPr=runProps({font,size});
    return `<w:p><w:pPr>${keep?'<w:keepNext/>':''}<w:tabs><w:tab w:val="right" w:pos="${leftStop}"/><w:tab w:val="left" w:pos="${rightStop}"/></w:tabs><w:spacing w:before="0" w:after="${after}" w:line="${Math.round(lineSpacing*240)}" w:lineRule="auto"/></w:pPr><w:r>${rPr}<w:tab/></w:r><w:r>${rPr}<w:t xml:space="preserve">${xml(leftText)}</w:t></w:r><w:r>${rPr}<w:tab/></w:r><w:r>${rPr}<w:t xml:space="preserve">${xml(rightText)}</w:t></w:r></w:p>`;
  };

  const sectPrXml=({cols=1,type=''}={})=>`<w:sectPr>${p.numbered?'<w:footerReference w:type="default" r:id="rId1"/>':''}${type?`<w:type w:val="${type}"/>`:''}<w:pgSz w:w="${pageWidth}" w:h="${pageHeight}"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="300" w:footer="300"/>${cols>1?`<w:cols w:num="${cols}" w:space="${cols===3?480:720}"/>`:'<w:cols w:space="720"/>'}</w:sectPr>`;

  const sectionBreakParagraph=opts=>`<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>${sectPrXml(opts)}</w:pPr></w:p>`;

  let content='';
  let finalCols=1;
  let finalSectionType='';

  if(plica){
    content+=paragraph('Plica · '+(p.workTitle||contest.name),{bold:true});
    content+=paragraph('Seudónimo: '+p.pseudonym);
    content+=paragraph('Obras: '+entries.map(e=>e.poem.title).join('; '));
    for(const [label,value]of Object.entries(author))content+=paragraph(label+': '+value);
  }else{
    if(p.cover){
      const options=coverOptions(contest);
      coverLines(contest,entries).forEach((line,i)=>{
        content+=paragraph(line.text,{align:options.alignment,bold:line.type==='title',italic:line.type==='date',before:i===0&&options.position==='middle'?2835:0,after:240});
      });
    }

    const pages=paginateDeliveryEntries(contest,entries);
    const workHeader=workHeaderOptions(contest,entries);
    const showInlinePseudonym=!p.cover&&Boolean(p.pseudonym)&&coverOptions(contest).pseudonym;
    let activeCols=1;
    let activeSectionType='';
    let emittedAnyBody=Boolean(p.cover);

    const switchSection=(nextCols,nextType)=>{
      if(!emittedAnyBody&&nextCols===1&&!nextType){activeCols=1;activeSectionType='';return;}
      content+=sectionBreakParagraph({cols:activeCols,type:activeSectionType});
      activeCols=nextCols;
      activeSectionType=nextType;
    };

    const emitPoemBody=(item,{pageBreak=false,colWidthTwips=usableWidth,allowMultiColSection=true}={})=>{
      const f=item.format,size=item.effectiveSize,lineSpacing=item.effectiveLineSpacing;
      const stanzaAfter=Math.round(size*lineSpacing*20*(STANZA_GAP_MULT[f.stanzaGap]||1));
      const indentTwips=f.columns===1&&f.indent>0?Math.round(f.indent*567):0;
      let out='';
      let pendingBreak=pageBreak;
      const takeBreak=()=>{const b=pendingBreak;pendingBreak=false;return b;};

      if(f.showTitle){
        const titleText=f.titleStyle==='uppercase'?item.entry.poem.title.toLocaleUpperCase('es'):item.entry.poem.title;
        out+=paragraph(titleText,{
          font:f.font,size,lineSpacing,
          bold:f.titleStyle==='bold',
          italic:f.titleStyle==='italic',
          caps:f.titleStyle==='uppercase',
          align:f.titleAlign,
          indentTwips,
          keep:true,
          pageBreak:takeBreak(),
          after:f.showDate||showInlinePseudonym?80:180
        });
      }
      if(showInlinePseudonym){
        out+=paragraph(p.pseudonym,{font:f.font,size,lineSpacing,align:f.titleAlign,indentTwips,keep:true,pageBreak:takeBreak(),after:f.showDate?80:160});
      }
      if(f.showDate&&f.dateText){
        out+=paragraph(f.dateText,{font:f.font,size:Math.max(8,size-1),lineSpacing,italic:true,align:f.titleAlign,indentTwips,keep:true,pageBreak:takeBreak(),after:180});
      }

      const bodyLines=()=>{
        let linesOut='';
        const stanzas=groupPoemStanzas(item.entry.version.poemText);
        const effColWidth=allowMultiColSection&&f.columns>1
          ?Math.max(1800,Math.floor((usableWidth-(f.columns===3?480:720)*(f.columns-1))/f.columns))
          :colWidthTwips;
        stanzas.forEach((stanza,stanzaIdx)=>{
          const isLastStanza=stanzaIdx===stanzas.length-1;
          if(stanza.length===1&&stanza[0].type==='quote'){
            stanza[0].lines.forEach((line,idx)=>{
              const lastQuote=idx===stanza[0].lines.length-1;
              linesOut+=paragraph(line,{font:f.font,size,lineSpacing,quote:true,keep:!lastQuote,pageBreak:takeBreak(),after:lastQuote?stanzaAfter:0});
            });
            return;
          }
          stanza.forEach((verse,vIdx)=>{
            const isLastLine=vIdx===stanza.length-1;
            const after=isLastLine&&!isLastStanza?stanzaAfter:0;
            const keep=!isLastLine&&stanza.length<=12;
            if(f.align==='hemistich'){
              const halves=splitVerseHemistichs(verse.text,{cut:f.hemistichCut,version:item.entry.version,sourceLineIndex:verse.sourceLine,verseIndex:verse.verseIndex});
              if(halves){
                linesOut+=hemistichParagraph(halves[0],halves[1],{font:f.font,size,lineSpacing,gap:f.hemistichGap,colWidthTwips:effColWidth,keep,after});
                return;
              }
              linesOut+=paragraph(verse.text,{font:f.font,size,lineSpacing,align:'center',keep,pageBreak:takeBreak(),after});
              return;
            }
            linesOut+=paragraph(verse.text,{font:f.font,size,lineSpacing,align:f.align,indentTwips,keep,pageBreak:takeBreak(),after});
          });
        });
        return linesOut;
      };

      if(allowMultiColSection&&f.columns>1){
        // Keep poem header in 1 column, then switch continuously to multi-column for the poem body.
        if(out){
          if(activeCols!==1)switchSection(1,'continuous');
          content+=out;
          emittedAnyBody=true;
        }
        switchSection(f.columns,pendingBreak?'nextPage':'continuous');
        pendingBreak=false;
        content+=bodyLines();
        emittedAnyBody=true;
        return '';
      }
      return out+bodyLines();
    };

    pages.forEach((page,pageIndex)=>{
      const needPageBreak=(pageIndex===0&&p.cover)||(pageIndex>0&&page.forcedBreak);
      if(pageIndex===0&&!p.cover&&(workHeader.showTitle||workHeader.showDate)){
        if(workHeader.showTitle)content+=paragraph(workHeader.titleText,{bold:true,size:Math.round(p.size*1.25),align:'center',after:workHeader.showDate?80:220});
        if(workHeader.showDate&&workHeader.dateText)content+=paragraph(workHeader.dateText,{italic:true,size:Math.max(9,p.size-1),align:'center',after:240});
        emittedAnyBody=true;
      }

      if(page.isSideBySide){
        if(activeCols!==1)switchSection(1,needPageBreak?'nextPage':'continuous');
        else if(needPageBreak){content+=paragraph('',{pageBreak:true,after:0,lineSpacing:1,size:2});emittedAnyBody=true;}
        const cellWidth=Math.floor(usableWidth/page.items.length);
        const cells=page.items.map((item,cellIdx)=>{
          const inner=emitPoemBody(item,{pageBreak:false,colWidthTwips:Math.max(1800,cellWidth-240),allowMultiColSection:false})||paragraph('');
          const padRight=cellIdx<page.items.length-1?240:0;
          const padLeft=cellIdx>0?240:0;
          return `<w:tc><w:tcPr><w:tcW w:w="${cellWidth}" w:type="dxa"/><w:tcMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:left w:w="${padLeft}" w:type="dxa"/><w:right w:w="${padRight}" w:type="dxa"/></w:tcMar></w:tcPr>${inner}</w:tc>`;
        }).join('');
        const tblBorders='<w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders>';
        content+=`<w:tbl><w:tblPr><w:tblW w:w="${usableWidth}" w:type="dxa"/>${tblBorders}</w:tblPr><w:tr>${cells}</w:tr></w:tbl>`;
        emittedAnyBody=true;
        return;
      }

      page.items.forEach((item,itemIdx)=>{
        const itemBreak=itemIdx===0?needPageBreak:false;
        if(item.format.columns===1){
          if(activeCols!==1){
            switchSection(1,itemBreak?'nextPage':'continuous');
            content+=emitPoemBody(item,{pageBreak:false,allowMultiColSection:true});
          }else{
            if(itemIdx>0&&!itemBreak)content+=paragraph('',{after:160,size:Math.max(8,p.size-2),lineSpacing:1});
            content+=emitPoemBody(item,{pageBreak:itemBreak,allowMultiColSection:true});
          }
          emittedAnyBody=true;
        }else{
          if(itemBreak&&activeCols!==1){
            switchSection(1,'nextPage');
            emitPoemBody(item,{pageBreak:false,allowMultiColSection:true});
          }else{
            emitPoemBody(item,{pageBreak:itemBreak,allowMultiColSection:true});
          }
        }
      });
    });

    finalCols=activeCols;
    finalSectionType=activeSectionType;
  }

  const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${content}${sectPrXml({cols:finalCols,type:finalSectionType})}</w:body></w:document>`;
  const footer='<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';
  return zipStore({'[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>','_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':doc,'word/footer1.xml':footer,'word/_rels/document.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>'});
}
