import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeWorkshop} from '../taller/merge-workshop.js';
test('concurrent device preferences retain changes to different poems',()=>{
 const base={preferences:{poemColors:{a:'#111111'}}};
 const local={preferences:{poemColors:{a:'#222222'}}};
 const remote={preferences:{poemColors:{a:'#111111',b:'#333333'}}};
 assert.deepEqual(mergeWorkshop(base,local,remote),{preferences:{poemColors:{a:'#222222',b:'#333333'}}});
});
test('contest changes preserve remote additions and local deletions',()=>{
 const base={contests:[{id:'a',name:'A'},{id:'b',name:'B'}]};
 const local={contests:[{id:'a',name:'Editado'}]};
 const remote={contests:[...base.contests,{id:'c',name:'C'}]};
 assert.deepEqual(mergeWorkshop(base,local,remote),{contests:[{id:'a',name:'Editado'},{id:'c',name:'C'}]});
});
