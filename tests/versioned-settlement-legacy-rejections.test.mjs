import test from 'node:test';
import assert from 'node:assert/strict';
import {isRejectedPlayoffPlacement} from '../src/lib/api/playoff-placement.ts';
import {isRejectedSettlementDraft} from '../src/lib/api/settlement-draft.ts';
import {isRejectedManualSettlementFinalization} from '../src/lib/api/settlement-finalization.ts';
const eventId='10000000-0000-4000-8000-000000000001';
test('legacy codecs recognize authoritative per-event domain rejections for safe receipt recovery',()=>{
 for(const [validate,code]of [[isRejectedPlayoffPlacement,'playoff_write_domain_conflict'],[isRejectedSettlementDraft,'settlement_domain_conflict'],[isRejectedManualSettlementFinalization,'settlement_domain_conflict']]){
  const result={status:'rejected',code,eventId};assert.equal(validate(result,eventId),true);
  assert.equal(validate({...result,eventId:'10000000-0000-4000-8000-000000000002'},eventId),false);
  assert.equal(validate({...result,untrusted:true},eventId),false);
  assert.equal(validate({...result,code:'unknown_failure'},eventId),false);
 }
});
