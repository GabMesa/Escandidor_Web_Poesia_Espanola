export const COLOR_PICKER_PALETTE = [
  // Flexoki: pastel, light, medium, vivid, deep, and neutral shades.
  '#F89A8A', '#F9AE77', '#ECCB60', '#BEC97E', '#87D3C3', '#92BFDB', '#C4B9E0', '#F4A4C2',
  '#E8705F', '#EC8B49', '#DFB431', '#A0AF54', '#5ABDAC', '#66A0C8', '#A699D0', '#E47DA8',
  '#D14D41', '#DA702C', '#D0A215', '#879A39', '#3AA99F', '#4385BE', '#8B7EC8', '#CE5D97',
  '#AF3029', '#9D4310', '#664D01', '#536907', '#1C6C66', '#205EA6', '#5E409D', '#A02F6F',
  '#6C201C', '#71320D', '#503D02', '#3D4C07', '#164F4A', '#163B66', '#3C2A62', '#641F46',
  '#E6E4D9', '#CECDC3', '#B7B5AC', '#9F9D96', '#6F6E69', '#575653', '#403E3C', '#100F0F'
];
export const COLOR_INTENSITIES = {
  soft: { surface: 12, strong: 20, highlight: 12, border: 60 },
  medium: { surface: 20, strong: 28, highlight: 22, border: 75 },
  strong: { surface: 28, strong: 36, highlight: 32, border: 90 }
};
export function showPoemColorPicker({title='Elegir color',current='#205EA6',onAccept,onDefault,showDefaultAction=false},doc=document){
  let selected=/^#[\da-f]{6}$/i.test(current)?current:'#205EA6';
  const dialog=doc.createElement('dialog');dialog.className='shared-color-picker';
  if(!doc.getElementById('shared-color-picker-style')){const style=doc.createElement('style');style.id='shared-color-picker-style';style.textContent=`.shared-color-picker{width:min(480px,calc(100vw - 40px));box-sizing:border-box;border:1px solid var(--line,#ddd);border-radius:10px;padding:24px;background:var(--surface,#faf8f2);color:var(--text,#292b27);font:14px system-ui}.shared-color-picker::backdrop{background:#0005}.shared-color-picker h3{margin:0 0 18px;font:24px Georgia}.shared-color-picker .swatches{display:grid;grid-template-columns:repeat(8,1fr);gap:7px;margin-bottom:18px}.shared-color-picker .swatches button{padding:0;min-height:32px;height:32px;border:1px solid #0002;border-radius:5px;cursor:pointer}.shared-color-picker .swatches button[aria-selected=true]{outline:2px solid var(--text,#292b27);outline-offset:2px}.shared-color-picker label{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0}.shared-color-picker .sample{padding:16px;border:1px solid;border-radius:5px}.shared-color-picker .picker-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}.shared-color-picker input[type=color]{width:45px;height:35px}`;doc.head.append(style);}
  dialog.innerHTML='<h3></h3><div class="swatches" role="listbox" aria-label="Paleta de colores"></div><label>Personalizado<input type="color" aria-label="Color personalizado"></label><output></output><label>Intensidad del fondo<select><option value="soft">Suave</option><option value="medium">Media</option><option value="strong">Intensa · menos transparente</option></select></label><p>Se aplica a los fondos de todos los poemas y rimas.</p><div class="sample">Así se verá el fondo con este color.</div><div class="picker-actions"><button type="button" data-picker="cancel">Cancelar</button><button type="button" data-picker="default">Por defecto</button><button type="button" data-picker="accept" class="primary">Aceptar</button></div>';
  dialog.querySelector('h3').textContent=title;const input=dialog.querySelector('input'),intensity=dialog.querySelector('select');
  try{intensity.value=doc.defaultView.localStorage.getItem('escandador.colorIntensity.v1')||'soft';}catch{}
  if(!COLOR_INTENSITIES[intensity.value])intensity.value='soft';
  const update=()=>{input.value=selected;dialog.querySelector('output').textContent=selected.toUpperCase();const sample=dialog.querySelector('.sample'),level=COLOR_INTENSITIES[intensity.value];sample.style.background=`color-mix(in srgb, ${selected} ${level.highlight}%, var(--surface,#faf8f2))`;sample.style.borderColor=selected;dialog.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.color.toLowerCase()===selected.toLowerCase())));};
  for(const color of COLOR_PICKER_PALETTE){const b=doc.createElement('button');b.type='button';b.dataset.color=color;b.style.background=color;b.setAttribute('role','option');b.setAttribute('aria-label',color);b.title=color;b.onclick=()=>{selected=color;update();};dialog.querySelector('.swatches').append(b);}
  input.oninput=()=>{selected=input.value;update();};intensity.onchange=update;
  dialog.querySelector('[data-picker=default]').hidden=!showDefaultAction;
  const close=()=>dialog.close();dialog.querySelector('[data-picker=cancel]').onclick=close;
  dialog.querySelector('[data-picker=default]').onclick=()=>{close();onDefault?.();};
  dialog.querySelector('[data-picker=accept]').onclick=()=>{const level=intensity.value;try{doc.defaultView.localStorage.setItem('escandador.colorIntensity.v1',level);}catch{}doc.defaultView.dispatchEvent(new CustomEvent('poem-color-intensity',{detail:level}));close();onAccept?.(selected,level);};
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});doc.body.append(dialog);update();dialog.showModal();
}
