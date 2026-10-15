import test from 'node:test';
import assert from 'node:assert/strict';
import {visualColor,visualPreferences,colorInk} from '../visual-preferences.js';
test('visual override scopes preserve the saved poem color and exclude the editor when requested',()=>{
 const preferences={color:'#205EA6',scope:'workshop'},context={savedColor:'#A02F6F'};
 assert.equal(visualColor(preferences,{...context,surface:'editor'}),'#A02F6F');
 assert.equal(visualColor(preferences,{...context,surface:'workshop'}),'#205EA6');
 assert.equal(visualColor({...preferences,scope:'all'},context),'#205EA6');
 assert.deepEqual(context,{savedColor:'#A02F6F'});
 assert.equal(visualColor({scope:'poem'},context),'#A02F6F');
});
test('new-poem colors apply only to poems created after enabling the preference',()=>{
 const p={color:'#205EA6',scope:'poem',newPoems:true,since:'2026-10-15T12:00:00Z'};
 assert.equal(visualColor(p,{savedColor:'#A02F6F',createdAt:'2026-10-14'}),'#A02F6F');
 assert.equal(visualColor(p,{savedColor:'#A02F6F',createdAt:'2026-10-16'}),'#205EA6');
 assert.equal(visualColor({...p,newPoems:false},{savedColor:'#A02F6F',createdAt:'2026-10-16'}),'#A02F6F');
});
test('invalid colors are normalized and action text remains legible for pale and dark colors',()=>{
 assert.equal(visualPreferences({color:'invalid'}).color,'#536907');
 assert.equal(colorInk('#FFFFFF'),'#000000');assert.equal(colorInk('#100F0F'),'#FFFFFF');
});
