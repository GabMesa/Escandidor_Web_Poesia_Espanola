import {analyzeLine,adjustPoeticCount} from '../analyzer.js';
import {escapeHtml as h,poemBlocks} from './model.js';

export const ALLOWED_FONTS=['Times New Roman','Arial','Calibri','Georgia'];
export const ALLOWED_ALIGNS=['left','center','right','hemistich'];
export const ALLOWED_TITLE_ALIGNS=['inherit','left','center','right'];
export const ALLOWED_TITLE_STYLES=['bold','normal','italic','uppercase'];
export const ALLOWED_GAPS=['compact','normal','wide'];
export const ALLOWED_PAGE_LAYOUTS=['one-per-page','flow','per-sheet'];
export const ALLOWED_MULTI_LAYOUTS=['stacked','columns'];
export const ALLOWED_PAGE_BREAKS=['inherit','new','same'];

export const STANZA_GAP_MULT={compact:0.55,normal:1,wide:1.6};
export const HEMISTICH_GAP_EM={compact:1.2,normal:2,wide:3};
export const HEMISTICH_GAP_PT={compact:14,normal:24,wide:36};

export function defaultPoemStyle(){
  return {
    align:'left',
    hemistichCut:'',
    hemistichGap:'normal',
    showTitle:true,
    titleAlign:'inherit',
    titleStyle:'bold',
    showDate:false,
    indent:0,
    stanzaGap:'normal',
    columns:1,
    fitOnePage:false
  };
}

export function formatDisplayDate(value,fallbackDate=new Date()){
  const raw=String(value??'').trim();
  if(raw){
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
      const parsed=new Date(raw+'T12:00:00');
      if(!Number.isNaN(parsed.getTime())){
        return new Intl.DateTimeFormat('es-UY',{day:'numeric',month:'long',year:'numeric'}).format(parsed);
      }
    }
    return raw;
  }
  const date=fallbackDate instanceof Date?fallbackDate:new Date(fallbackDate);
  if(Number.isNaN(date.getTime()))return '';
  return new Intl.DateTimeFormat('es-UY',{day:'numeric',month:'long',year:'numeric'}).format(date);
}

export function workHeaderOptions(contest,entries=[]){
  const p=contest?.profile||{};
  const showTitle=p.cover?p.coverTitle!==false:p.showWorkTitle===true;
  const showDate=p.coverDate===true;
  const titleText=String(p.workTitle||'').trim()||(entries.length===1?entries[0]?.poem?.title||'':'Poemario');
  const dateText=showDate?formatDisplayDate(p.workDate):'';
  return {showTitle,showDate,titleText,dateText};
}

export function pageLayoutOptions(profile={}){
  const layout=ALLOWED_PAGE_LAYOUTS.includes(profile.pageLayout)
    ?profile.pageLayout
    :(profile.newPage===false?'flow':'one-per-page');
  const poemsPerPage=Math.min(12,Math.max(2,Math.round(Number(profile.poemsPerPage)||2)));
  const multiPoemLayout=ALLOWED_MULTI_LAYOUTS.includes(profile.multiPoemLayout)?profile.multiPoemLayout:'stacked';
  return {layout,poemsPerPage,multiPoemLayout};
}

export function normalizePoemStyle(raw={}){
  const base=defaultPoemStyle();
  const s=raw&&typeof raw==='object'?raw:{};
  return {
    align:ALLOWED_ALIGNS.includes(s.align)?s.align:base.align,
    hemistichCut:String(s.hemistichCut??'').trim().slice(0,24),
    hemistichGap:ALLOWED_GAPS.includes(s.hemistichGap)?s.hemistichGap:base.hemistichGap,
    showTitle:s.showTitle!==false,
    titleAlign:ALLOWED_TITLE_ALIGNS.includes(s.titleAlign)?s.titleAlign:base.titleAlign,
    titleStyle:ALLOWED_TITLE_STYLES.includes(s.titleStyle)?s.titleStyle:base.titleStyle,
    showDate:s.showDate===true,
    indent:Math.min(5,Math.max(0,Number.isFinite(Number(s.indent))?Number(s.indent):0)),
    stanzaGap:ALLOWED_GAPS.includes(s.stanzaGap)?s.stanzaGap:base.stanzaGap,
    columns:[1,2,3].includes(Number(s.columns))?Number(s.columns):1,
    fitOnePage:s.fitOnePage===true
  };
}

export function cleanPoemOverride(raw){
  if(!raw||typeof raw!=='object')return {};
  const out={};
  if(ALLOWED_FONTS.includes(raw.font))out.font=raw.font;
  if(raw.size!==''&&raw.size!==undefined&&raw.size!==null&&Number.isFinite(Number(raw.size)))out.size=Math.min(24,Math.max(8,Number(raw.size)));
  if([1,1.15,1.5,2].includes(Number(raw.lineSpacing)))out.lineSpacing=Number(raw.lineSpacing);
  if(ALLOWED_ALIGNS.includes(raw.align))out.align=raw.align;
  if(typeof raw.hemistichCut==='string'&&raw.hemistichCut.trim())out.hemistichCut=raw.hemistichCut.trim().slice(0,24);
  if(ALLOWED_GAPS.includes(raw.hemistichGap))out.hemistichGap=raw.hemistichGap;
  if(typeof raw.showTitle==='boolean')out.showTitle=raw.showTitle;
  if(ALLOWED_TITLE_ALIGNS.includes(raw.titleAlign)&&raw.titleAlign!=='inherit')out.titleAlign=raw.titleAlign;
  if(ALLOWED_TITLE_STYLES.includes(raw.titleStyle))out.titleStyle=raw.titleStyle;
  if(typeof raw.showDate==='boolean')out.showDate=raw.showDate;
  if(typeof raw.dateText==='string'&&raw.dateText.trim())out.dateText=raw.dateText.trim().slice(0,120);
  if(raw.indent!==''&&raw.indent!==undefined&&raw.indent!==null&&Number.isFinite(Number(raw.indent)))out.indent=Math.min(5,Math.max(0,Number(raw.indent)));
  if(ALLOWED_GAPS.includes(raw.stanzaGap))out.stanzaGap=raw.stanzaGap;
  if([1,2,3].includes(Number(raw.columns)))out.columns=Number(raw.columns);
  if(typeof raw.fitOnePage==='boolean')out.fitOnePage=raw.fitOnePage;
  if(ALLOWED_PAGE_BREAKS.includes(raw.pageBreak)&&raw.pageBreak!=='inherit')out.pageBreak=raw.pageBreak;
  return out;
}

export function hasPoemOverride(selection){
  return Object.keys(cleanPoemOverride(selection?.format)).length>0;
}

export function resolvePoemFormat(contest,entry){
  const p=contest?.profile||{};
  const global=normalizePoemStyle(p.poemStyle);
  const override=cleanPoemOverride(entry?.selection?.format);
  const align=override.align??global.align;
  const rawTitleAlign=override.titleAlign??global.titleAlign;
  const titleAlign=rawTitleAlign==='inherit'?(align==='hemistich'?'center':align):rawTitleAlign;
  const showDate=override.showDate??global.showDate;
  const fallbackDate=entry?.version?.savedAt?new Date(entry.version.savedAt):new Date();
  const dateText=showDate?formatDisplayDate(override.dateText||'',fallbackDate):'';
  return {
    font:override.font||p.font||'Times New Roman',
    size:override.size??(Number(p.size)||12),
    lineSpacing:override.lineSpacing??(Number(p.lineSpacing)||1.5),
    align,
    hemistichCut:override.hemistichCut??global.hemistichCut,
    hemistichGap:override.hemistichGap??global.hemistichGap,
    showTitle:override.showTitle??global.showTitle,
    titleAlign,
    titleStyle:override.titleStyle??global.titleStyle,
    showDate,
    dateText,
    indent:override.indent??global.indent,
    stanzaGap:override.stanzaGap??global.stanzaGap,
    columns:override.columns??global.columns,
    fitOnePage:override.fitOnePage??global.fitOnePage,
    pageBreak:override.pageBreak||'inherit'
  };
}

export function poemFormatBadges(contest,entry){
  const override=cleanPoemOverride(entry?.selection?.format);
  const resolved=resolvePoemFormat(contest,entry);
  const badges=[];
  if(override.pageBreak==='same')badges.push('Misma hoja');
  if(override.pageBreak==='new')badges.push('Hoja nueva');
  if(resolved.columns>1)badges.push(`${resolved.columns} columnas`);
  if(resolved.fitOnePage)badges.push('1 hoja');
  if(override.align){
    const names={left:'Izq.',center:'Centrado',right:'Der.',hemistich:'Hemistiquio'};
    badges.push(names[override.align]);
  }
  if(override.showTitle===false)badges.push('Sin título');
  if(override.showDate===true)badges.push('Con fecha');
  if(override.size)badges.push(`${override.size} pt`);
  if(override.font)badges.push(override.font);
  return badges;
}

function parseNumberList(value){
  return String(value??'').split(/[^\d]+/).map(Number).filter(n=>Number.isInteger(n)&&n>0);
}

function splitSeparatorForCesura(separator){
  const clean=String(separator||'').replace(/\//g,'');
  // Keep closing punctuation with the first hemistich and opening punctuation with the second.
  const match=clean.match(/^(\s*[\.,;:!?…»"”'\)\]]*)([\s\S]*)$/);
  const leftPunct=(match?.[1]||'').trimEnd();
  const rightPunct=(match?.[2]||'').trimStart();
  return {leftPunct,rightPunct};
}

function splitTextAtWordBoundary(line,wordMatches,boundaryIndex){
  const leftWord=wordMatches[boundaryIndex],rightWord=wordMatches[boundaryIndex+1];
  if(!leftWord||!rightWord)return null;
  const separator=line.slice(leftWord.end,rightWord.start);
  const {leftPunct,rightPunct}=splitSeparatorForCesura(separator);
  const left=(line.slice(0,leftWord.end)+leftPunct).replace(/\s*\/\s*/g,' ').trim();
  const right=(rightPunct+line.slice(rightWord.start)).replace(/\s*\/\s*/g,' ').trim();
  if(!left||!right)return null;
  return [left,right];
}

function resolveMetricBoundary(analysis,targetSyllables,activeSinalefas){
  if(!targetSyllables||targetSyllables<=0||analysis.analyses.length<2)return null;
  let cursor=0,merges=0;
  for(let index=0;index<analysis.analyses.length-1;index+=1){
    cursor+=analysis.analyses[index].syllableCount;
    const metric=adjustPoeticCount(cursor-merges,analysis.analyses[index].accentType);
    if(metric===targetSyllables)return index;
    if(activeSinalefas.has(index))merges+=1;
  }
  return null;
}

function resolveClosestBoundary(analysis,targetSyllables,activeSinalefas){
  if(analysis.analyses.length<2)return null;
  let cursor=0,merges=0,bestIndex=0,bestScore=Infinity;
  for(let index=0;index<analysis.analyses.length-1;index+=1){
    cursor+=analysis.analyses[index].syllableCount;
    const metric=adjustPoeticCount(cursor-merges,analysis.analyses[index].accentType);
    const separator=analysis.separators[index]||'';
    const hasPause=/[,;:—–…\.!?]/.test(separator);
    const distance=Math.abs(metric-targetSyllables)-(hasPause?0.45:0);
    if(distance<bestScore){bestScore=distance;bestIndex=index;}
    if(activeSinalefas.has(index))merges+=1;
  }
  return bestIndex;
}

export function splitVerseHemistichs(line,{cut='',version=null,sourceLineIndex=0,verseIndex=0}={}){
  const text=String(line??'');
  if(!text.trim())return null;
  // 1. Inline "/" explicit cesura marker takes top priority.
  if(text.includes('/')){
    const parts=text.split('/').map(part=>part.trim()).filter(Boolean);
    if(parts.length>=2)return [parts[0],parts.slice(1).join(' / ')];
  }
  const settings=version?.settings||{};
  const analysis=analyzeLine(text,{rioplatenseY:settings.rioplatenseY!==false});
  if(analysis.wordMatches.length<2)return null;

  const lineOverride=version?.lineOverrides?.[sourceLineIndex]||{};
  const forceOn=parseNumberList(lineOverride.sinalefaOn);
  const forceOff=parseNumberList(lineOverride.sinalefaOff);
  const overrides=version?.sinalefaOverrides||{};
  const activeSinalefas=new Set();
  for(const boundary of analysis.boundaries){
    const uiIndex=boundary.index+1;
    let active=boundary.candidate&&!boundary.strongPause;
    if(Object.prototype.hasOwnProperty.call(overrides,`${sourceLineIndex}:${boundary.index}`)){
      active=Boolean(overrides[`${sourceLineIndex}:${boundary.index}`])&&boundary.candidate;
    }
    if(forceOn.includes(uiIndex)&&boundary.candidate)active=true;
    if(forceOff.includes(uiIndex))active=false;
    if(active)activeSinalefas.add(boundary.index);
  }

  // 2. Explicit cut from delivery configuration or saved Escandidor configuration.
  const explicitCuts=parseNumberList(cut);
  const overrideCuts=parseNumberList(lineOverride.hemistich);
  const selectedVerses=parseNumberList(settings.hemistichVerses);
  const verseAllowed=!selectedVerses.length||selectedVerses.includes(verseIndex+1);
  const pronounced=analysis.rawCount-activeSinalefas.size;
  const naturalMetric=adjustPoeticCount(pronounced,analysis.accentType);
  const patternCuts=verseAllowed&&settings.hemistichPatterns?.[naturalMetric]
    ?(Array.isArray(settings.hemistichPatterns[naturalMetric])?settings.hemistichPatterns[naturalMetric]:[settings.hemistichPatterns[naturalMetric]])
      .flatMap(parseNumberList)
    :[];
  const splitCuts=verseAllowed?parseNumberList(settings.hemistichSplit):[];

  const candidateTargets=[...explicitCuts,...overrideCuts,...patternCuts,...splitCuts];
  for(const target of candidateTargets){
    const exact=resolveMetricBoundary(analysis,target,activeSinalefas);
    if(exact!==null){
      const split=splitTextAtWordBoundary(text,analysis.wordMatches,exact);
      if(split)return split;
    }
  }
  if(explicitCuts.length){
    const closest=resolveClosestBoundary(analysis,explicitCuts[0],activeSinalefas);
    if(closest!==null)return splitTextAtWordBoundary(text,analysis.wordMatches,closest);
  }

  // 3. Automatic poetic midpoint: exact metric half first, then natural pause/midpoint.
  const halfTarget=Math.max(1,Math.floor(naturalMetric/2));
  const exactHalf=resolveMetricBoundary(analysis,halfTarget,activeSinalefas);
  if(exactHalf!==null){
    const split=splitTextAtWordBoundary(text,analysis.wordMatches,exactHalf);
    if(split)return split;
  }
  const closest=resolveClosestBoundary(analysis,halfTarget,activeSinalefas);
  return closest!==null?splitTextAtWordBoundary(text,analysis.wordMatches,closest):null;
}

export function paperDimensionsPt(paper='A4',marginCm=2.5){
  const widthPt=paper==='Letter'?612:595.28;
  const heightPt=paper==='Letter'?792:841.89;
  const marginPt=Math.max(28,Number(marginCm||2.5)*28.3465);
  return {
    widthPt,
    heightPt,
    marginPt,
    usableWidthPt:Math.max(220,widthPt-marginPt*2),
    usableHeightPt:Math.max(300,heightPt-marginPt*2-28)
  };
}

export function groupPoemStanzas(text){
  const blocks=poemBlocks(text);
  const stanzas=[];
  let current=[],sourceLine=0,verseIndex=0;
  const flush=()=>{if(current.length){stanzas.push(current);current=[];}};
  for(const block of blocks){
    if(block.type==='blank'){
      flush();
      sourceLine+=1;
    }else if(block.type==='quote'){
      flush();
      stanzas.push([{type:'quote',lines:block.lines,sourceLine}]);
      sourceLine+=block.lines.length;
    }else{
      current.push({type:'verse',text:block.lines[0],sourceLine,verseIndex});
      sourceLine+=1;
      verseIndex+=1;
    }
  }
  flush();
  return stanzas;
}

export function estimatePoemHeightPt(entry,format,profile,{availableWidthPt,sizeOverride=null,spacingOverride=null}={}){
  const dims=paperDimensionsPt(profile?.paper,profile?.margin);
  const totalWidth=availableWidthPt||dims.usableWidthPt;
  const columns=format.columns||1;
  const colGapPt=columns===3?24:columns===2?34:0;
  const indentPt=columns===1?(format.indent||0)*28.3465:0;
  const colWidthPt=Math.max(95,(totalWidth-indentPt-colGapPt*(columns-1))/columns);
  const size=sizeOverride??format.size;
  const spacing=spacingOverride??format.lineSpacing;
  const lineHeightPt=size*spacing;
  const avgCharPt=size*0.48;
  const charsPerLine=Math.max(14,Math.floor(colWidthPt/avgCharPt));

  let headerPt=0;
  if(format.showTitle)headerPt+=lineHeightPt*1.5+10;
  if(format.showDate&&format.dateText)headerPt+=lineHeightPt*1.15+6;

  const stanzas=groupPoemStanzas(entry?.version?.poemText||'');
  const stanzaGapPt=lineHeightPt*(STANZA_GAP_MULT[format.stanzaGap]||1);
  let bodyLinesPt=0;
  stanzas.forEach((stanza,index)=>{
    if(index>0)bodyLinesPt+=stanzaGapPt;
    for(const item of stanza){
      if(item.type==='quote'){
        const lines=item.lines.reduce((n,l)=>n+Math.max(1,Math.ceil(Math.max(1,l.length)/Math.max(12,charsPerLine-6))),0);
        bodyLinesPt+=lines*lineHeightPt+lineHeightPt*0.4;
      }else{
        const wrapped=Math.max(1,Math.ceil(Math.max(1,item.text.length)/charsPerLine));
        bodyLinesPt+=wrapped*lineHeightPt;
      }
    }
  });
  // Slight balance buffer for multi-column breaks between stanzas.
  const columnHeightPt=columns>1?(bodyLinesPt/columns)*1.08+lineHeightPt*0.8:bodyLinesPt;
  return {headerPt,bodyPt:columnHeightPt,totalPt:headerPt+columnHeightPt};
}

export function computeFitAdjustment(entry,format,profile,availableHeightPt,availableWidthPt){
  if(!format.fitOnePage)return {size:format.size,lineSpacing:format.lineSpacing,fitted:false,overflows:false};
  const dims=paperDimensionsPt(profile?.paper,profile?.margin);
  const targetHeight=availableHeightPt||dims.usableHeightPt;
  const width=availableWidthPt||dims.usableWidthPt;
  const initial=estimatePoemHeightPt(entry,format,profile,{availableWidthPt:width});
  if(initial.totalPt<=targetHeight)return {size:format.size,lineSpacing:format.lineSpacing,fitted:false,overflows:false};

  let size=format.size,lineSpacing=format.lineSpacing;
  // First tighten line spacing gracefully down to 1.15, then scale font down to 7.5pt if needed.
  if(lineSpacing>1.15){
    const tightened=Math.max(1.15,Number((lineSpacing*(targetHeight/initial.totalPt)).toFixed(2)));
    const check=estimatePoemHeightPt(entry,format,profile,{availableWidthPt:width,sizeOverride:size,spacingOverride:tightened});
    if(check.totalPt<=targetHeight)return {size,lineSpacing:tightened,fitted:true,overflows:false};
    lineSpacing=1.15;
  }
  const afterSpacing=estimatePoemHeightPt(entry,format,profile,{availableWidthPt:width,sizeOverride:size,spacingOverride:lineSpacing});
  const ratio=Math.sqrt(targetHeight/Math.max(1,afterSpacing.totalPt));
  size=Math.max(7.5,Math.min(format.size,Math.floor(format.size*ratio*2)/2));
  let finalEst=estimatePoemHeightPt(entry,format,profile,{availableWidthPt:width,sizeOverride:size,spacingOverride:lineSpacing});
  while(finalEst.totalPt>targetHeight&&size>7.5){
    size=Math.max(7.5,Number((size-0.5).toFixed(1)));
    finalEst=estimatePoemHeightPt(entry,format,profile,{availableWidthPt:width,sizeOverride:size,spacingOverride:lineSpacing});
  }
  if(finalEst.totalPt>targetHeight&&lineSpacing>1.05){
    lineSpacing=1.05;
    finalEst=estimatePoemHeightPt(entry,format,profile,{availableWidthPt:width,sizeOverride:size,spacingOverride:lineSpacing});
  }
  return {size,lineSpacing,fitted:size!==format.size||lineSpacing!==format.lineSpacing,overflows:finalEst.totalPt>targetHeight};
}

export function paginateDeliveryEntries(contest,entries){
  const p=contest?.profile||{};
  const {layout,poemsPerPage,multiPoemLayout}=pageLayoutOptions(p);
  const dims=paperDimensionsPt(p.paper,p.margin);
  const workHeader=workHeaderOptions(contest,entries);
  const workHeaderReserve=!p.cover&&(workHeader.showTitle||workHeader.showDate)?((workHeader.showTitle?p.size*p.lineSpacing*2:0)+(workHeader.showDate?p.size*p.lineSpacing*1.4:0)+18):0;

  const pages=[];
  let current=null;
  let currentHeight=0;

  entries.forEach((entry,index)=>{
    const format=resolvePoemFormat(contest,entry);
    let startNewPage=index===0;
    let forcedBreak=false;
    if(index>0){
      if(format.pageBreak==='new'){startNewPage=true;forcedBreak=true;}
      else if(format.pageBreak==='same'){startNewPage=false;forcedBreak=false;}
      else if(layout==='one-per-page'){startNewPage=true;forcedBreak=true;}
      else if(layout==='per-sheet'){
        if(current.items.length>=poemsPerPage){startNewPage=true;forcedBreak=true;}
      }else{
        // Flow mode: keep poems together on a sheet until estimated height exceeds usable page height.
        const available=dims.usableHeightPt-(pages.length===1?workHeaderReserve:0);
        const est=estimatePoemHeightPt(entry,format,p).totalPt+22;
        if(current.items.length>0&&currentHeight+est>available){
          startNewPage=true;
          forcedBreak=false;
        }
      }
    }
    if(startNewPage){
      current={items:[],forcedBreak,multiPoemLayout};
      pages.push(current);
      currentHeight=pages.length===1?workHeaderReserve:0;
    }
    const item={entry,format,index};
    current.items.push(item);
    currentHeight+=estimatePoemHeightPt(entry,format,p).totalPt+22;
  });

  // Compute fit-to-one-page adjustments for each page's items.
  pages.forEach((page,pageIndex)=>{
    const isSideBySide=page.items.length>1&&page.multiPoemLayout==='columns';
    const headerReserve=pageIndex===0?workHeaderReserve:0;
    const usableHeight=Math.max(220,dims.usableHeightPt-headerReserve);
    const colWidth=isSideBySide
      ?Math.max(120,(dims.usableWidthPt-28*(page.items.length-1))/page.items.length)
      :dims.usableWidthPt;
    page.isSideBySide=isSideBySide;
    page.items.forEach(item=>{
      const shareHeight=page.items.length>1&&!isSideBySide?usableHeight/page.items.length:usableHeight;
      item.fit=computeFitAdjustment(item.entry,item.format,p,shareHeight,colWidth);
      item.effectiveSize=item.fit.size;
      item.effectiveLineSpacing=item.fit.lineSpacing;
    });
  });

  return pages;
}

export function renderPoemContentHtml(entry,format,{size,lineSpacing,quoteItalic=true,scalePx=1,showPseudonym='',forPrint=false}={}){
  const effSize=size??format.size;
  const effSpacing=lineSpacing??format.lineSpacing;
  const unit=forPrint?'pt':'px';
  const fontVal=forPrint?effSize:Number((effSize*scalePx).toFixed(2));
  const lineMin=forPrint?`${Number((effSize*effSpacing).toFixed(2))}pt`:`${Number((effSize*effSpacing*scalePx).toFixed(2))}px`;
  const gapEm=HEMISTICH_GAP_EM[format.hemistichGap]||2;
  const stanzaGap=Number((effSize*effSpacing*(STANZA_GAP_MULT[format.stanzaGap]||1)*(forPrint?1:scalePx)).toFixed(2));
  const indentStyle=format.columns===1&&format.indent>0?`padding-left:${format.indent}cm;`:'';
  const titleTransform=format.titleStyle==='uppercase'?'text-transform:uppercase;letter-spacing:0.04em;':'';
  const titleWeight=format.titleStyle==='bold'?'font-weight:700;':'font-weight:400;';
  const titleItalic=format.titleStyle==='italic'?'font-style:italic;':'';
  const headerHtml=(format.showTitle||format.showDate||showPseudonym)?`<header class="poem-head" style="text-align:${format.titleAlign};${indentStyle}">${format.showTitle?`<h2 class="poem-title" style="font-family:inherit;font-size:inherit;line-height:inherit;${titleWeight}${titleItalic}${titleTransform}">${h(entry.poem.title)}</h2>`:''}${showPseudonym?`<p class="poem-pseudonym">${h(showPseudonym)}</p>`:''}${format.showDate&&format.dateText?`<p class="poem-date">${h(format.dateText)}</p>`:''}</header>`:'';

  const stanzas=groupPoemStanzas(entry.version.poemText);
  const bodyClasses=['poem-body',`align-${format.align}`];
  if(format.columns>1)bodyClasses.push(`poem-cols-${format.columns}`);
  const bodyStyle=`text-align:${format.align==='hemistich'?'center':format.align};${indentStyle}--hemistich-gap:${gapEm}em;--stanza-gap:${stanzaGap}${unit};`;

  const stanzasHtml=stanzas.map(stanza=>{
    if(stanza.length===1&&stanza[0].type==='quote'){
      return `<blockquote class="poem-quote" style="font-style:${quoteItalic?'italic':'normal'}">${h(stanza[0].lines.join('\n'))}</blockquote>`;
    }
    const linesHtml=stanza.map(item=>{
      if(format.align==='hemistich'){
        const halves=splitVerseHemistichs(item.text,{cut:format.hemistichCut,version:entry.version,sourceLineIndex:item.sourceLine,verseIndex:item.verseIndex});
        if(halves){
          return `<div class="verse verse-hemistich" style="min-height:${lineMin}"><span class="hemistich-left">${h(halves[0])}</span><span class="hemistich-right">${h(halves[1])}</span></div>`;
        }
        return `<div class="verse verse-hemistich" style="min-height:${lineMin}"><span class="hemistich-single">${h(item.text)||'&nbsp;'}</span></div>`;
      }
      return `<div class="verse" style="min-height:${lineMin}">${h(item.text)||'&nbsp;'}</div>`;
    }).join('');
    return `<div class="stanza${stanza.length<=12?' keep-stanza':''}">${linesHtml}</div>`;
  }).join('');

  const sectionStyle=`font-family:'${h(format.font)}',serif;font-size:${fontVal}${unit};line-height:${effSpacing};`;
  return {sectionStyle,headerHtml,bodyHtml:`<div class="${bodyClasses.join(' ')}" style="${bodyStyle}">${stanzasHtml}</div>`};
}
