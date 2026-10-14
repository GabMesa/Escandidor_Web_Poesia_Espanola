import test from 'node:test';
import assert from 'node:assert/strict';
import {createTag,tagCatalog,updateTagEverywhere,tagColor,setTagColor,tagStyle} from '../prototipo/tag-library.js';
test('catalog retains tags without poems and preserves existing tags when migrating',()=>{
  const data={poems:[{tags:['mar']}],localTags:{}};
  assert.equal(createTag(data,' Nueva ',data.poems),'nueva');
  assert.deepEqual(tagCatalog(data,data.poems),['mar','nueva']);assert.deepEqual(data.poems[0].tags,['mar']);
  assert.throws(()=>createTag(data,'NUEVA',data.poems));assert.throws(()=>createTag(data,'a,b',data.poems));
});
test('tag colors persist through renaming and choose legible ink for light or dark backgrounds',()=>{
  const data={tagCatalog:['mar'],poems:[]};setTagColor(data,'mar','#123456');updateTagEverywhere(data,'mar','agua');
  assert.equal(tagColor(data,'agua'),'#123456');assert.equal(data.tagColors.mar,undefined);
  assert.match(tagStyle(data,'agua'),/#ffffff/);setTagColor(data,'agua','#ffffff');assert.match(tagStyle(data,'agua'),/#161614/);
  assert.throws(()=>setTagColor(data,'agua','url(evil)'));
  assert.equal(tagColor({},'sin color'),tagColor({},'SIN COLOR'));
});
test('rename and delete propagate through poem tags, local poems and restorable copies',()=>{
  const data={tagCatalog:['mar','nueva'],poems:[{tags:['mar','nueva']}],localTags:{local:['mar']},libraryTrash:[{tags:['mar']}],libraryRecovery:[{tags:['mar']}]};
  updateTagEverywhere(data,'mar','nueva');assert.deepEqual(data.poems[0].tags,['nueva']);assert.deepEqual(data.libraryTrash[0].tags,['nueva']);
  updateTagEverywhere(data,'nueva');assert.deepEqual(data.tagCatalog,[]);assert.deepEqual(data.localTags.local,[]);assert.deepEqual(data.libraryRecovery[0].tags,[]);
});
