const target=new URLSearchParams(location.search).get('target');
const allowed=['http://localhost:8794','http://127.0.0.1:8794'];
const status=document.querySelector('#status');
const alternate=new URL(location.href);alternate.hostname=location.hostname==='localhost'?'127.0.0.1':'localhost';document.querySelector('#alternate').href=alternate.href;
document.querySelector('#transfer').onclick=async()=>{
 if(!window.opener||!allowed.includes(target)){status.textContent='Abrí esta pantalla desde tu taller local.';return;}
 try{
  const memory=JSON.parse(localStorage.getItem('escandador.poemMemory.v1')||'{"schemaVersion":2,"poems":{}}'),data=JSON.parse(localStorage.getItem('escandador.contestsPrototype.v1')||'{"poems":[],"contests":[],"localTags":{}}');
  const aliases=Object.fromEntries((data.poems||[]).filter(p=>p.linkedLocalId).map(p=>[p.id,p.linkedLocalId]));
  const localTags={...data.localTags};for(const p of data.poems||[])if(p.linkedLocalId)localTags[p.linkedLocalId]=p.tags||[];
  const colors=JSON.parse(localStorage.getItem('escandador.poemColors.v1')||'{}'),poemColors={};for(const [key,versions] of Object.entries(memory.poems||{})){const color=colors[versions[0]?.poemTitle||key];if(/^#[\da-f]{6}$/i.test(color||''))poemColors['local:'+key]=color;}
  const contests=(data.contests||[]).filter(c=>!c.demo).map(c=>({...c,selections:c.selections.map(s=>({...s,poemId:aliases[s.poemId]||s.poemId})).filter(s=>s.poemId.startsWith('local:'))}));
  let plica=null;if(document.querySelector('#include-plica').checked){const r=await fetch('/api/plicas');const result=await r.json();if(!r.ok)throw Error(result.error);plica=result.plica;}
  window.opener.postMessage({type:'workshop:migration',memory,data:{schemaVersion:1,poems:[],contests,localTags,tagCatalog:data.tagCatalog||[],tagColors:data.tagColors||{},preferences:{poemColors}},plica},target);
  status.textContent='Datos enviados al taller. Revisá allí la confirmación.';
 }catch(error){status.textContent=error.message;}
};
