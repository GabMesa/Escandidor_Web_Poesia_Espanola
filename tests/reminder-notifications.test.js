import test from 'node:test';
import assert from 'node:assert/strict';
import {createReminderNotifications,notificationCandidates} from '../prototipo/reminder-notifications.js';
const now=new Date(2026,9,13,12);
const contest={id:'real',name:'Premio de prueba',deadline:'2026-10-15',status:'preparing',reminders:[7,2],demo:false};
test('browser notices respect selected days, distinguish expected results and skip examples',()=>{
  assert.equal(notificationCandidates([contest],now).length,1);
  assert.equal(notificationCandidates([{...contest,reminders:[7]}],now).length,0);
  assert.equal(notificationCandidates([{...contest,demo:true}],now).length,0);
  assert.equal(notificationCandidates([{...contest,deadline:'2026-10-01'}],now).length,0);
  assert.equal(notificationCandidates([{...contest,status:'sent',resultsDate:'2026-10-15'}],now)[0].kind,'results');
  assert.equal(notificationCandidates([{...contest,status:'sent',resultsUrl:'https://example.test/results'}],now)[0].kind,'published');
});
function fixture(permission='default'){
  let asks=0;const delivered=[],data=new Map(),opened=[];
  class FakeNotification{
    static permission=permission;
    static async requestPermission(){asks++;FakeNotification.permission='granted';return 'granted';}
    constructor(title,options){this.title=title;this.options=options;delivered.push(this);}
    close(){this.closed=true;}
  }
  const options={getContests:()=>[contest],NotificationImpl:FakeNotification,now:()=>now,page:null,storage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},onOpen:id=>opened.push(id)};
  return {service:createReminderNotifications(options),options,delivered,opened,get asks(){return asks;}};
}
test('permission is requested only on activation and notices deduplicate across reloads',async()=>{
  const f=fixture();f.service.check();assert.equal(f.asks,0);assert.equal(f.delivered.length,0);
  await f.service.enable();assert.equal(f.asks,1);assert.equal(f.delivered.length,1);
  f.service.check();createReminderNotifications(f.options).check();assert.equal(f.delivered.length,1);
  f.delivered[0].onclick();assert.deepEqual(f.opened,['real']);assert.equal(f.delivered[0].closed,true);
  f.service.disable();assert.equal(f.service.status().enabled,false);
});
test('denied permissions and unavailable browsers keep in-app reminders without sending',async()=>{
  const f=fixture('denied');await f.service.enable();f.service.check();assert.equal(f.asks,0);assert.equal(f.delivered.length,0);assert.equal(f.service.status().available,false);
  const unavailable=createReminderNotifications({NotificationImpl:null,storage:null,getContests:()=>[contest]});
  assert.equal(unavailable.status().available,false);await unavailable.enable();unavailable.check();
});

test('competitions outside the agenda suppress deadlines and both result notices',()=>{
  for(const fields of [{},{status:'sent',resultsDate:'2026-10-15'},{status:'sent',resultsUrl:'https://example.test/results'},{deadline:'2026-10-12'}]){
    const candidate={...contest,...fields,agendaEnabled:false};
    assert.deepEqual(notificationCandidates([candidate],now),[]);
    candidate.agendaEnabled=true;
    assert.equal(notificationCandidates([candidate],now).length,1);
  }
});
