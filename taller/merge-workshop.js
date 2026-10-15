// Rebase only local changes onto the current server revision.
export function mergeWorkshop(base, local, remote) {
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  if(equal(local,base))return structuredClone(remote);
  if(equal(remote,base)||equal(local,remote))return structuredClone(local);
  if(Array.isArray(local)&&Array.isArray(remote)&&Array.isArray(base)){
    const keyed=[...base,...local,...remote].every(v=>v&&typeof v==='object'&&typeof v.id==='string');
    if(keyed){
      const b=new Map(base.map(v=>[v.id,v])),l=new Map(local.map(v=>[v.id,v])),r=new Map(remote.map(v=>[v.id,v]));
      return [...new Set([...r.keys(),...l.keys()])].map(id=>mergeWorkshop(b.get(id),l.get(id),r.get(id))).filter(v=>v!==undefined);
    }
    if([...base,...local,...remote].every(v=>typeof v==='string'))return [...new Set([...remote.filter(v=>!base.includes(v)||local.includes(v)),...local.filter(v=>!base.includes(v))])];
    return structuredClone(local);
  }
  if(local&&remote&&typeof local==='object'&&typeof remote==='object'&&!Array.isArray(local)&&!Array.isArray(remote)){
    return Object.fromEntries([...new Set([...Object.keys(remote),...Object.keys(local)])].map(key=>[key,mergeWorkshop(base?.[key],local[key],remote[key])]).filter(([,v])=>v!==undefined));
  }
  return structuredClone(local);
}
