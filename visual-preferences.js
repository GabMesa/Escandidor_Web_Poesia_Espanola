export function visualPreferences(value={}) {
  value=value&&typeof value==='object'?value:{};
  return {color:/^#[\da-f]{6}$/i.test(value.color)?value.color:'#536907',
    scope:['workshop','all'].includes(value.scope)?value.scope:'poem',
    newPoems:value.newPoems===true,since:typeof value.since==='string'?value.since:''};
}
export function visualColor(preferences,{surface='editor',savedColor='',createdAt=''}={}) {
  const p=visualPreferences(preferences);
  if(p.scope==='all'||(p.scope==='workshop'&&surface!=='editor'))return p.color;
  if(p.newPoems&&p.since&&Number.isFinite(Date.parse(createdAt))&&Date.parse(createdAt)>=Date.parse(p.since))return p.color;
  return savedColor;
}
export function colorInk(hex) {
  const rgb=hex.replace('#','').match(/../g).map(v=>{const n=parseInt(v,16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#000000':'#FFFFFF';
}
