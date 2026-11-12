import test from 'node:test';
import assert from 'node:assert/strict';
import {isRejectedPlayoffOutcome} from '../src/lib/api/playoff-outcome.ts';
import {isPlayoffV4Result} from '../src/lib/api/playoff-outcome-v4.ts';
import {isRejectedPlayoffPlacement} from '../src/lib/api/playoff-placement.ts';
import {isRejectedEventStart} from '../src/lib/api/event-schedule.ts';
const tid='10000000-0000-4000-8000-000000000001',eid='10000000-0000-4000-8000-000000000002';
test('only explicit linked domain rejections cross existing strict result boundaries',()=>{
 const value={status:'rejected',eventId:eid,code:'linked_series_correction_conflict'};
 assert.equal(isRejectedPlayoffOutcome(value,eid),true);
 assert.equal(isPlayoffV4Result(value,tid,eid),true);
 assert.equal(isRejectedPlayoffPlacement(value,eid),true);
 for(const check of [x=>isRejectedPlayoffOutcome(x,eid),x=>isPlayoffV4Result(x,tid,eid),x=>isRejectedPlayoffPlacement(x,eid)]){
  assert.equal(check({...value,eventId:tid}),false);assert.equal(check({...value,code:'unknown_link_error'}),false);assert.equal(check({...value,extra:true}),false);
 }
 assert.equal(isRejectedEventStart({status:'rejected',code:'linked_consy_eligibility_pending'}),true);
 assert.equal(isRejectedEventStart({status:'rejected',code:'unknown_link_error'}),false);
 assert.equal(isRejectedEventStart({status:'rejected',code:'linked_consy_eligibility_pending',extra:true}),false);
});
