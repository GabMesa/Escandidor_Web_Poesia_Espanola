import {normalizeTag,escapeHtml as h} from './model.js';
const palette=['#3d7164','#3d6790','#8b4b73','#8a6424','#65538a','#9a463d','#577038','#6c645a'];
export function tagColor(data,value){const tag=normalizeTag(value),saved=data.tagColors?.[tag];if(/^#[\da-f]{6}$/i.test(saved||''))return saved;let hash=0;for(const c of tag)hash=(Math.imul(hash,31)+c.codePointAt(0))>>>0;const used=new Set(Object.values(data.tagColors||{}));return palette.map((_,i)=>palette[(hash+i)%palette.length]).find(c=>!used.has(c))||palette[hash%palette.length];}
export function setTagColor(data,value,color){if(!/^#[\da-f]{6}$/i.test(color||''))throw Error('Color de etiqueta inválido.');data.tagColors??={};data.tagColors[normalizeTag(value)]=color.toLowerCase();}
export function ensureTagColors(data,poems=[]){const used=new Set(Object.values(data.tagColors||{}).map(c=>String(c).toLowerCase()));for(const tag of tagCatalog(data,poems))if(!/^#[\da-f]{6}$/i.test(data.tagColors?.[tag]||'')){const color=palette.find(c=>!used.has(c))||tagColor(data,tag);setTagColor(data,tag,color);used.add(color);}}
export function tagStyle(data,tag){const color=tagColor(data,tag),channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4),luminance=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;return `--tag-color:${color};--tag-ink:${luminance>.179?'#161614':'#ffffff'}`;}
export function tagMarkup(data,tag){return `<span class="tag user-tag" data-tag-name="${h(tag)}" style="${tagStyle(data,tag)}">${h(tag)}</span>`;}
export function tagCatalog(data,poems=[]){return [...new Set([...(data.tagCatalog||[]),...poems.flatMap(p=>p.tags||[])].map(normalizeTag).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));}
export function createTag(data,value,poems=[],color){
  const tag=normalizeTag(value);if(!tag||tag.includes(',')||tag.length>60)throw Error('Escribí una etiqueta de hasta 60 caracteres, sin comas.');
  const catalog=tagCatalog(data,poems);if(catalog.includes(tag))throw Error('Esa etiqueta ya existe.');if(color)setTagColor(data,tag,color);data.tagCatalog=[...catalog,tag];return tag;
}
export function updateTagEverywhere(data,old,next=null){
  const replace=tags=>[...new Set((tags||[]).flatMap(t=>t===old?(next?[next]:[]):[t]))];
  data.tagCatalog=replace(data.tagCatalog);
  if(data.tagColors?.[old]){if(next&&!data.tagColors[next])data.tagColors[next]=data.tagColors[old];if(next!==old)delete data.tagColors[old];}
  for(const poem of data.poems||[])poem.tags=replace(poem.tags);
  for(const key of Object.keys(data.localTags||{}))data.localTags[key]=replace(data.localTags[key]);
  for(const group of [...(data.libraryTrash||[]),...(data.libraryRecovery||[])])group.tags=replace(group.tags);
}
