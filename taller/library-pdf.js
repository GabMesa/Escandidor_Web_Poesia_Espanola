import {downloadFile,safeName} from './document-export.js';
import {poemBlocks} from './model.js';
let modulePromise;
export async function downloadLibraryPdf(entries){
  if(!entries.length)return;
  modulePromise??=import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm').catch(error=>{modulePromise=undefined;throw error;});
  const module=await modulePromise,JsPDF=module.jsPDF||module.default?.jsPDF||module.default;
  const pdf=new JsPDF({unit:'pt',format:'a4'}),margin=54,usableWidth=pdf.internal.pageSize.getWidth()-margin*2,bottom=pdf.internal.pageSize.getHeight()-margin;
  const counts=new Map();for(const e of entries)counts.set(e.poem.id,(counts.get(e.poem.id)||0)+1);
  for(const [index,{poem,version}] of entries.entries()){
    if(index)pdf.addPage();let y=margin;
    pdf.setFont('Helvetica','bold');pdf.setFontSize(16);
    const title=pdf.splitTextToSize(poem.title,usableWidth);pdf.text(title,margin,y);y+=title.length*20+12;
    pdf.setFont('Helvetica','normal');pdf.setFontSize(12);
    if(counts.get(poem.id)>1){pdf.text(String(version.label||`Versión ${version.versionNumber||1}`),margin,y);y+=24;}
    for(const block of poemBlocks(version.poemText||'')){
      const quote=block.type==='quote',indent=quote?24:0;pdf.setFont('Helvetica',quote?'italic':'normal');if(quote)y+=12;
      for(const line of block.lines){const lines=pdf.splitTextToSize(line,usableWidth-indent);
        for(const wrapped of lines.length?lines:['']){if(y>bottom){pdf.addPage();y=margin;}pdf.text(wrapped,margin+indent,y);y+=16;}
      }
      if(quote)y+=12;
    }
  }
  downloadFile(safeName(entries.length===1?entries[0].poem.title:'seleccion')+'.pdf',new Blob([pdf.output('arraybuffer')],{type:'application/pdf'}));
}
