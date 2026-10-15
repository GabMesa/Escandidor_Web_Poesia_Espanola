import { samePoemContent } from './poem-policy.js';

function compareAge(left, right) {
  if(Number.isInteger(left.serverVersion)&&Number.isInteger(right.serverVersion))return left.serverVersion-right.serverVersion;
  const a = Date.parse(left.savedAt);
  const b = Date.parse(right.savedAt);
  if (Number.isFinite(a) && Number.isFinite(b) && a !== b) return a - b;
  return (Number(left.versionNumber) || 0) - (Number(right.versionNumber) || 0);
}

function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));
  return value;
}
function configuration(version){
  const source=version.settings||{};
  const settings={poemFont:'atkinson',poeticForm:'custom',syllablePattern:'',stressPatterns:{},hemistichPatterns:{},hemistichSplit:'',hemistichVerses:'',assonanceRange:5,rhymeMode:'asonante',rhymeScheme:'',repeatRhymeScheme:false,rhymeSchemeSharedRhymes:!source.repeatRhymeScheme,distinguishSZInRhyme:false,rioplatenseY:true,...source};
  for(const key of ['syllablePattern','hemistichSplit','hemistichVerses','assonanceRange'])settings[key]=String(settings[key]);
  const sinalefaOverrides=version.sinalefaOverrides??settings.sinalefaOverrides??{};
  const lineOverrides=version.lineOverrides??settings.lineOverrides??{};
  delete settings.sinalefaOverrides;delete settings.lineOverrides;
  return JSON.stringify(canonical({settings,sinalefaOverrides,lineOverrides}));
}
export function poemVersionState(version){
  return JSON.stringify([String(version.poemText??'').replace(/\r\n?/g,'\n').trimEnd(),configuration(version)]);
}

export function compressPoemVersions(versions,{protectedVersionIds=[]}={}) {
  const ordered = [...versions];
  // Saved histories are chronological. Only legacy histories need reordering.
  if (ordered.some((entry, index) => index > 0 && compareAge(ordered[index - 1], entry) > 0)) ordered.sort(compareAge);
  const successors=new Map(),seen=new Map(),configs=ordered.map(configuration);
  // Repeated synchronization can interleave entire copies of a history. Keep
  // the newest copy of each exact text/configuration, wherever it occurs.
  for(let index=0;index<ordered.length;index++){
    const key=JSON.stringify([String(ordered[index].poemText??'').replace(/\r\n?/g,'\n').trimEnd(),configs[index]]);
    if(seen.has(key))successors.set(seen.get(key),index);
    seen.set(key,index);
  }
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const previous = ordered[index - 1];
    // Compare adjacent ORIGINAL versions, never scan earlier surviving versions.
    if (previous && configs[index]===configs[index-1]&&(samePoemContent(current.poemText, previous.poemText)
      || String(current.poemText ?? '').includes(String(previous.poemText ?? '')))) {
      successors.set(index-1,index);
    }
  }
  const protectedIds=new Set(protectedVersionIds.map(String));
  for(let index=0;index<ordered.length;index++)if(protectedIds.has(String(ordered[index].id)))successors.delete(index);
  const retained=ordered.filter((_,index)=>!successors.has(index)),removed=ordered.filter((_,index)=>successors.has(index));
  const replacements=[];
  const resolved=new Map();
  for(let index=ordered.length-1;index>=0;index--)if(successors.has(index))resolved.set(index,resolved.get(successors.get(index))??successors.get(index));
  for(const index of successors.keys()){
    const target=resolved.get(index);
    replacements.push({removed:ordered[index],retained:ordered[target]});
  }
  return { retained, removed, replacements };
}
