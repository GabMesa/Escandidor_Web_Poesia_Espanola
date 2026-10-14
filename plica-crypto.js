import {normalizePlica,plicaSensitiveFields,SENSITIVE_PLICA_FIELDS} from './plica-policy.js';
export class PlicaCryptoError extends Error {}
const encoder=new TextEncoder();
function fromBase64(value){try{if(typeof value!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error();return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}catch{throw new PlicaCryptoError('Configuración de cifrado inválida.');}}
function toBase64(bytes){return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));}
export function validatePlicaKey(value){const bytes=fromBase64(value);if(bytes.length!==32||toBase64(bytes)!==value)throw new PlicaCryptoError('La clave de cifrado debe tener 256 bits.');return bytes;}
function context(owner){if(!String(owner||''))throw new PlicaCryptoError('Falta el propietario del perfil.');return encoder.encode(JSON.stringify(['mesa-de-poesia','plica-profile',1,String(owner)]));}
async function key(value,crypto){if(!crypto?.subtle)throw new PlicaCryptoError('El cifrado no está disponible.');return crypto.subtle.importKey('raw',validatePlicaKey(value),'AES-GCM',false,['encrypt','decrypt']);}
export async function encryptPlica(plica,secret,owner,crypto=globalThis.crypto){
  const material=await key(secret,crypto),iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:context(owner),tagLength:128},material,encoder.encode(JSON.stringify(plicaSensitiveFields(plica))));
  return JSON.stringify({version:1,iv:toBase64(iv),ciphertext:toBase64(new Uint8Array(ciphertext))});
}
export async function decryptPlica(payload,secret,owner,crypto=globalThis.crypto){
  const material=await key(secret,crypto);
  try{
    const envelope=JSON.parse(payload);if(envelope.version!==1||typeof envelope.ciphertext!=='string'||envelope.ciphertext.length>50000)throw Error();
    const iv=fromBase64(envelope.iv),ciphertext=fromBase64(envelope.ciphertext);if(iv.length!==12||ciphertext.length<16)throw Error();
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:context(owner),tagLength:128},material,ciphertext);
    const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!SENSITIVE_PLICA_FIELDS.includes(k)))throw Error();
    return plicaSensitiveFields(normalizePlica(value));
  }catch{throw new PlicaCryptoError('No se pudo verificar o descifrar la plica.');}
}
