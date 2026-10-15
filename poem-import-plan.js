import {parsePoemsFromMarkdown} from './poem-markdown-import.js';
import {poemValidationError,samePoemContent,poemTitleKey} from './poem-policy.js';
import {sortPoemVersions} from './poem-exports.js';
export const importTitleKey=poemTitleKey;

export function previewPoemImport(markdown,poems){
  return parsePoemsFromMarkdown(markdown).map((entry,index)=>{
    const matches=poems.filter(p=>p.local!==false&&importTitleKey(p.title)===importTitleKey(entry.title));
    return {...entry,index,matches,targetKey:matches[0]?.sourceKey||null};
  });
}

export function appendPoemImport(memory,entry,{createKey,createVersion}){
  const error=poemValidationError(entry.title,entry.text);if(error)throw Error(error);
  let key=entry.targetKey;
  // Recheck the current library for every entry, including titles repeated in
  // this very file or added after the preview was opened.
  if(!key)key=Object.keys(memory.poems).find(k=>memory.poems[k]?.length&&importTitleKey(memory.poems[k].find(v=>v.poemTitle)?.poemTitle||k)===importTitleKey(entry.title));
  if(key&&(!Array.isArray(memory.poems[key])||!memory.poems[key].length))throw Error('El poema elegido ya no está disponible. Revisá la importación.');
  const versions=key?memory.poems[key]:[];
  const title=versions[0]?.poemTitle||entry.title;
  if(key&&importTitleKey(title)!==importTitleKey(entry.title))throw Error('Cambió el título del poema elegido. Revisá la importación.');
  const latest=sortPoemVersions(versions).at(-1);
  const identical=versions.find(v=>samePoemContent(v.poemText,entry.text));
  if(identical)return {poemKey:key,title,version:identical,changed:false};
  if(!key){do{key=createKey();}while(memory.poems[key]);}
  const nextNumber=versions.reduce((n,v)=>Math.max(n,Number(v.versionNumber)||0),0)+1;
  const version=createVersion({title,text:entry.text,latest,versionNumber:nextNumber});
  memory.poems[key]=[...versions,version];
  return {poemKey:key,title,version,changed:true};
}
