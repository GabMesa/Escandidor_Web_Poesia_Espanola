export const PLICA_FIELDS = ['fullName','identityDocument','postalAddress','email','phone','biography','aiStatement','signatureName','signatureDate'];
export const SENSITIVE_PLICA_FIELDS = ['fullName','identityDocument','postalAddress','email','phone','biography','signatureName'];
export function plicaSensitiveFields(input){const p=normalizePlica(input);return Object.fromEntries(SENSITIVE_PLICA_FIELDS.map(key=>[key,p[key]]));}
export function mergePlicaProfiles(profiles){
  const latest=normalizePlica(profiles[0]||{});
  for(const input of profiles.slice(1)){const p=normalizePlica(input);for(const key of SENSITIVE_PLICA_FIELDS)if(!latest[key])latest[key]=p[key];}
  return latest;
}
export const PLICA_LABELS = {fullName:'Nombre completo',identityDocument:'Documento de identidad',postalAddress:'Dirección postal',email:'Correo electrónico',phone:'Teléfono',biography:'Reseña biobibliográfica',aiStatement:'Declaración sobre inteligencia artificial',signatureName:'Nombre para la firma',signatureDate:'Fecha de la declaración'};
export const DEFAULT_AI_STATEMENT = 'Declaro que los poemas presentados son de mi autoría y que en su composición no se ha utilizado generación textual mediante inteligencia artificial.';
export function normalizePlica(input={}){
  if(!input || typeof input!=='object'||Array.isArray(input))throw Error('Datos de plica inválidos.');
  const result={};for(const key of PLICA_FIELDS){if(input[key]!==undefined&&typeof input[key]!=='string')throw Error('Campo de plica inválido: '+key);result[key]=(input[key]||'').trim();if(result[key].length>(['biography','aiStatement'].includes(key)?6000:600))throw Error('Campo demasiado largo: '+key);}
  if(input.includeAi!==undefined&&typeof input.includeAi!=='boolean')throw Error('La opción de declaración debe ser verdadera o falsa.');
  result.includeAi=input.includeAi===true;
  if(result.signatureDate&&!/^\d{4}-\d{2}-\d{2}$/.test(result.signatureDate))throw Error('Fecha de declaración inválida.');
  if(result.signatureDate){const date=new Date(result.signatureDate+'T12:00:00Z');if(!Number.isFinite(date.getTime())||!date.toISOString().startsWith(result.signatureDate))throw Error('Fecha de declaración inválida.');}
  if(result.includeAi&&!result.aiStatement)throw Error('Completá la declaración de IA para incluirla.');
  return result;
}
export function plicaExportFields(input){const p=normalizePlica(input),out={};for(const key of PLICA_FIELDS){if(key==='aiStatement'&&!p.includeAi)continue;if(p[key])out[PLICA_LABELS[key]]=p[key];}return out;}
export function contestKey(value){const key=String(value||'').trim();if(!key||key.length>200||/[\x00-\x1f]/.test(key))throw Error('Identificador de concurso inválido.');return key;}
