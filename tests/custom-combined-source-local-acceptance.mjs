// Injected disposable database only; creates no sporting/financial records.
import assert from 'node:assert/strict';
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
export function verifyCombinedNoRefundProjectionV10(sql){
 const scope={kind:'custom-side-no-refund-scope-v10',sidePools:[{ratio:5}],blockers:[]};
 const base={eventId:'a0000000-0000-4000-8000-000000000001',manifest:{source:'synthetic-projection-only'},obligations:[{kind:'award',fundMinor:1000,rows:[{amountMinor:1000}]}],blockers:[]};
 const project=(value=base,binding=scope)=>{const raw=sql(`select app.project_combined_q_no_refunds_v10(${literal(value)},${literal(binding)});`);return raw?JSON.parse(raw):null;};
 const before=sql('select count(*)from app.q_obligation_reviews_v2;');
 const accepted=project();assert.deepEqual(accepted.blockers,[]);assert.deepEqual(accepted.obligations,base.obligations);
 assert.equal(accepted.manifest.refundPolicy,'no-pool-refunds-v1');
 const refund=project({...base,obligations:[{kind:'refund',rows:[{amountMinor:1000}]}]});
 assert.deepEqual(refund.blockers,['q_no_eligible_recipients']);assert.equal(refund.obligations,null);
 const invalid=project({...base,obligations:[{kind:'refnud'}]});assert.deepEqual(invalid.blockers,['source_blocked']);assert.equal(invalid.obligations,null);
 const missing=project({...base,obligations:null});assert.deepEqual(missing.blockers,['source_blocked']);assert.equal(missing.obligations,null);
 const stale=project(base,{...scope,blockers:['custom_side_intent_required']});assert.deepEqual(stale.blockers,['custom_side_intent_required']);assert.equal(stale.obligations,null);
 const changed=project(base,{...scope,sidePools:[{ratio:7}]});assert.notEqual(changed.sourceDigest,accepted.sourceDigest);
 assert.equal(project(base,null),null);assert.equal(project(null),null);
 assert.equal(sql('select count(*)from app.q_obligation_reviews_v2;'),before);
 return{accepted,refund,invalid,missing,stale,changed,createdReviews:false,scope:'private projection only; full writer negatives tested separately'};
}
