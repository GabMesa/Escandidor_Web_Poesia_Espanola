import {applicationState} from '../application-state.js';
if(window.parent!==window && new URLSearchParams(location.search).get('taller')==='1'){
  document.documentElement.classList.add('in-workshop');
  document.documentElement.dataset.theme='light';
  const send=(type,detail={})=>parent.postMessage({type,...detail},location.origin);
  let resizeFrame=0;
  const refresh=()=>{
    const style=getComputedStyle(document.documentElement);
    send('workshop:theme',{color:document.body.classList.contains('has-poem-theme')?style.getPropertyValue('--poem-color').trim():'',ink:style.getPropertyValue('--poem-on-color').trim(),surface:style.getPropertyValue('--color-surface').trim()});
    cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{
      const shell=document.querySelector('.app-shell');
      if(shell&&shell.getBoundingClientRect().width)send('workshop:resize',{height:Math.ceil(shell.getBoundingClientRect().height)+2});
    });
  };
  const ready=()=>{send('workshop:ready');refresh();};
  const observe=()=>{const shell=document.querySelector('.app-shell');if(shell)new ResizeObserver(refresh).observe(shell);new MutationObserver(refresh).observe(document.documentElement,{attributes:true,attributeFilter:['style']});new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['class']});};
  if(document.readyState!=='loading')observe();else window.addEventListener('DOMContentLoaded',observe,{once:true});
  window.addEventListener('resize',refresh);
  function setView(){document.documentElement.classList.remove('workshop-files');refresh();}
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent)return;
    if(event.data?.type==='workshop:hello'){ready();return;}
    const message=event.data;if(message?.type==='workshop:view'){setView(message.view);return;}
    if(message?.type==='workshop:library-command'){
      if(['import','font'].includes(message.command?.action))applicationState.runtime.workshopSourceId='';
      window.dispatchEvent(new CustomEvent('workshop:library-command',{detail:{command:message.command,respond:result=>send('workshop:library-result',{requestId:message.requestId,...result})}}));return;
    }
    if(message?.type!=='workshop:open')return;
    let prepared=false;
    window.dispatchEvent(new CustomEvent('workshop:library-command',{detail:{command:{action:'prepare-open'},respond:result=>{prepared=result.ok;if(!result.ok)send('workshop:error',{message:result.error});}}}));
    if(!prepared)return;
    setView('editor');applicationState.runtime.workshopSourceId=message.sourceId||'';
    if(message.poemKey){
      window.dispatchEvent(new CustomEvent('workshop:library-command',{detail:{command:{action:'open-version',poemKey:message.poemKey,versionId:message.versionId},respond:result=>{if(result.ok)send('workshop:editor');else send('workshop:error',{message:result.error});}}}));
    }else{
      document.querySelector('#newPoemTop').click();
      applicationState.runtime.workshopSourceId=message.sourceId||'';
      if(message.title){const title=document.querySelector('#poemTitle');title.value=message.title;title.dispatchEvent(new Event('input',{bubbles:true}));const text=document.querySelector('#poemInput');text.value=message.text||'';text.dispatchEvent(new Event('input',{bubbles:true}));}
      if(/^#[\da-f]{6}$/i.test(message.color||'')){document.documentElement.style.setProperty('--poem-color',message.color);document.body.classList.add('has-poem-theme');}
      if(message.font){const font=document.querySelector('.poem-font-selector:not(#defaultPoemFont)');font.value=message.font;font.dispatchEvent(new Event('change',{bubbles:true}));}
    }
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(['newPoemTop','newPoemManager'].includes(button?.id))applicationState.runtime.workshopSourceId='';
    if(button && ['load-poem','load-version'].includes(button.dataset.action))setTimeout(()=>{setView('editor');send('workshop:editor');},0);
    if(button?.id==='newPoemManager')setTimeout(()=>{setView('editor');send('workshop:editor');},0);
  });
  window.addEventListener('escandidor:poem-saved',event=>send('workshop:saved',{poemKey:event.detail.poemKey,title:event.detail.title,sourceId:applicationState.runtime.workshopSourceId||''}));
  for(const name of ['escandidor:poem-deleted','escandidor:trash-restored','escandidor:versions-compressed','escandidor:trash-emptied','escandidor:library-changed'])window.addEventListener(name,()=>send('workshop:library-changed'));
  document.addEventListener('click',event=>{const dialog=event.target;if(!(dialog instanceof HTMLDialogElement))return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
  if(document.readyState!=='loading')ready();else window.addEventListener('DOMContentLoaded',ready,{once:true});
}
