// Separate LOCAL fixture. Historical chart/equal fixtures are never rewritten.
import assert from 'node:assert/strict';
import {makeSeventeenMainFixture} from './seventeen-main-foundation.mjs';
import {quote,uuid} from './q-review-foundation.mjs';
export function makeAccWeightedMainFixture() {
 const original=makeSeventeenMainFixture();
 const ns=s=>s.replaceAll('5210000','5710000').replaceAll('5230000','5730000').replaceAll('2520000','2580000').replaceAll('@test.invalid','-balanced@test.invalid');
 const f={...original,actor:ns(original.actor),tid:ns(original.tid),eid:ns(original.eid),pid:n=>ns(original.pid(n)),rid:n=>ns(original.rid(n)),uid:n=>ns(original.uid(n)),pool:n=>ns(original.pool(n)),expected:original.expected.map(r=>({...r,participantId:ns(r.participantId)}))};
 for(const key of ['setupSql','seatingAttendanceSql','publishSql','startSql','scoreSql','finalizeSql'])f[key]=ns(original[key]);
 const anchor="do $fixture$declare r jsonb;begin r:=public.save_q_operating_policy_v2(";
 const at=f.setupSql.indexOf(anchor);assert.ok(at>0,'Known prepolicy foundation boundary');
 f.setupSql=f.setupSql.slice(0,at)+'commit;';
 assert.ok(f.setupSql.includes("'Equal (Pays All Equally)',500"));
 f.setupSql=f.setupSql.replace("'Equal (Pays All Equally)',500","'Graduated (1-in-6)',1000");
 f.policyRequest={action:'publish',poolVersionId:f.pool(1),method:'acc-weighted-largest-remainder-5usd-v1',ratio:6,scheduleId:'acc-weighted-largest-remainder-5usd-v1',disclosureReference:'TEST ONLY ACC raw weights with app-owned exact largest-remainder $5 rounding; higher-place remainder tie, fee floor, no ACC endorsement',disclosed:true};
 f.policyOperationId=uuid('b258',2);
 const service=`set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claim.sub='${f.actor}';set request.jwt.claims='{"role":"service_role","sub":"${f.actor}"}';`;
 const check=(expression,status,label)=>`do $test$declare r jsonb;begin r:=${expression};if r->>'status'is distinct from'${status}'then raise exception '${label} %',r;end if;end$test$;`;
 const equal={action:'publish',poolVersionId:f.pool(2),method:'equal-paid-playoff-qualifiers-v2',ratio:null,scheduleId:null,disclosureReference:'TEST ONLY unchanged equal qualifier / no-qualifier refund policy',disclosed:true};
 f.publishPoliciesSql=`begin;${service}${check(`public.save_q_operating_policy_v3('${f.actor}','${f.tid}',${quote(JSON.stringify(f.policyRequest))},'${f.policyOperationId}')`,'q_policy_published','balanced policy')}${check(`public.save_q_operating_policy_v2('${f.actor}','${f.tid}',${quote(JSON.stringify(equal))},'${uuid('b258',3)}')`,'q_policy_published','equal policy')}commit;`;
 let finance=`begin;${service}`;
 for(let n=1;n<=17;n++) {
  const pools=[1,2].map(i=>`jsonb_build_object('poolVersionId','${f.pool(i)}','elected',${i===1?n<=16:n===17},'consentReference',case when ${i===1?n<=16:n===17} then 'Q policy '||(select id from app.q_operating_policies_v2 where pool_version_id='${f.pool(i)}')::text||': TEST ONLY exact selected policy acknowledgment' else '' end)`);
  finance+=check(`public.save_q_pool_membership_v1('${f.actor}','${f.tid}',jsonb_build_object('action','membership','rosterEntryId','${f.rid(n)}','expectedVersion',0,'correction',false,'reason','TEST ONLY explicit version-bound membership','pools',jsonb_build_array(${pools.join(',')})),'${uuid('c258',n)}')`,'q_pool_saved','membership');
  finance+=check(`public.set_roster_payment_obligation_v1('${f.tid}','${f.rid(n)}',0,4000,'TEST ONLY synthetic base and named Q fee','${uuid('d258',n)}')`,'payment_obligation_saved','owed');
  finance+=check(`public.record_manual_roster_payment('${f.tid}','${f.rid(n)}',0,4000,'USD','cash',now(),'TEST ONLY synthetic receipt; no actual money','${uuid('e258',n)}')`,'payment_recorded','receipt');
  finance+=check(`public.save_q_pool_membership_v1('${f.actor}','${f.tid}',jsonb_build_object('action','allocation','rosterEntryId','${f.rid(n)}','expectedVersion',0,'correction',false,'reason','TEST ONLY separate base/Q allocations','membershipVersionId',(select id from app.q_pool_membership_versions_v1 where roster_entry_id='${f.rid(n)}'),'receiptId',(select id from app.roster_payment_events where roster_entry_id='${f.rid(n)}'),'obligationVersion',1,'baseMinor',3000,'pools',jsonb_build_array(jsonb_build_object('poolVersionId','${f.pool(1)}','amountMinor',${n<=16?1000:0}),jsonb_build_object('poolVersionId','${f.pool(2)}','amountMinor',${n===17?1000:0}))),'${uuid('f258',n)}')`,'q_pool_saved','allocation');
 }
 f.financeSql=finance+'commit;';
 return f;
}
