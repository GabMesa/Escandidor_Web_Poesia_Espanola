// Explicit sizing also works in browsers without CSS field-sizing support.
export function autoSizePoemInput(input) {
  const view=input.ownerDocument.defaultView;
  let frame=0,lastWidth=-1;
  function measure(){
    frame=0;
    if(!input.getBoundingClientRect().width)return;
    const style=view.getComputedStyle(input),number=value=>parseFloat(value)||0;
    input.style.height='auto';
    const padding=number(style.paddingTop)+number(style.paddingBottom);
    const borders=number(style.borderTopWidth)+number(style.borderBottomWidth);
    const height=Math.ceil(input.scrollHeight+(style.boxSizing==='border-box'?borders:-padding))+1;
    input.style.height=height+'px';
  }
  function schedule(){view.cancelAnimationFrame(frame);frame=view.requestAnimationFrame(measure);}
  input.addEventListener('input',schedule);
  view.addEventListener('resize',schedule);
  new view.ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width!==lastWidth){lastWidth=width;schedule();}}).observe(input);
  new view.MutationObserver(schedule).observe(input.ownerDocument.documentElement,{attributes:true,attributeFilter:['style','class']});
  input.ownerDocument.fonts?.ready.then(schedule);
  input.ownerDocument.fonts?.addEventListener('loadingdone',schedule);
  schedule();
  return schedule;
}
