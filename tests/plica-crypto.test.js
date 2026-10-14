import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {encryptPlica,decryptPlica,validatePlicaKey} from '../plica-crypto.js';
import {plicaSensitiveFields,mergePlicaProfiles} from '../plica-policy.js';
const secret=Buffer.alloc(32,7).toString('base64'); // Fixture only; never a production key.
const plica={fullName:'María Prueba',identityDocument:'TEST-123',email:'test@example.test',includeAi:true,aiStatement:'Declaración de prueba',signatureDate:'2026-10-13'};
test('sensitive profile roundtrip excludes clear fields and randomizes encryption',async()=>{
  const a=await encryptPlica(plica,secret,1,webcrypto),b=await encryptPlica(plica,secret,1,webcrypto);
  assert.notEqual(a,b);assert.doesNotMatch(a,/María|TEST-123|example/);
  assert.deepEqual(await decryptPlica(a,secret,1,webcrypto),plicaSensitiveFields(plica));
});
test('ciphertext rejects wrong owner, wrong key and tampering',async()=>{
  const a=await encryptPlica(plica,secret,1,webcrypto);
  await assert.rejects(decryptPlica(a,secret,2,webcrypto));
  await assert.rejects(decryptPlica(a,Buffer.alloc(32,8).toString('base64'),1,webcrypto));
  for(const field of ['iv','ciphertext','version']){
    const changed=JSON.parse(a);changed[field]=field==='version'?2:(changed[field][0]==='A'?'B':'A')+changed[field].slice(1);
    await assert.rejects(decryptPlica(JSON.stringify(changed),secret,1,webcrypto));
  }
  assert.throws(()=>validatePlicaKey(''));assert.throws(()=>validatePlicaKey(Buffer.alloc(16).toString('base64')));
});
test('migration preserves latest choices and fills missing personal fields from older contests',()=>{
  const p=mergePlicaProfiles([{fullName:'Actual',aiStatement:'Nueva',includeAi:true},{fullName:'Anterior',email:'test@example.test',aiStatement:'Vieja'}]);
  assert.equal(p.fullName,'Actual');assert.equal(p.email,'test@example.test');assert.equal(p.aiStatement,'Nueva');assert.equal(p.includeAi,true);
});
