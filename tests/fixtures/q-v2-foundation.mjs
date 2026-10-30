// Supported LOCAL synthetic setup/election/receipt/allocation/96-game foundation.
import assert from 'node:assert/strict';
import {foundation,actor,tid,uuid,quote}from'./q-review-foundation.mjs';
export function foundationV2(options={}){
 const {structuredSchedule=false,...rest}=options;
 const graduated=rest.pool1Type==='Graduated (1-in-6)';
 let seed=foundation(rest);
 for(let i=1;i<=2;i++){
  const old={poolVersionId:uuid('c243',i),method:'equal-paid-qualifiers-v1',disclosureReference:'TEST ONLY reviewed policy '+i,disclosed:true};
  const next={action:'publish',poolVersionId:uuid('c243',i),method:i===1&&graduated?'graduated-paid-card-rank-v2':'equal-paid-playoff-qualifiers-v2',ratio:i===1&&graduated?6:null,scheduleId:i===1&&graduated?'friend-q-p2-10-6-v1':null,disclosureReference:old.disclosureReference,disclosed:true};
  assert.ok(seed.includes(quote(JSON.stringify(old))));seed=seed.replace(quote(JSON.stringify(old)),quote(JSON.stringify(next)));
 }
 seed=seed.replaceAll('public.publish_q_pool_policy_v1','public.save_q_operating_policy_v2').replaceAll('app.q_pool_policies_v1','app.q_operating_policies_v2');
 // Actual UI starts play in a later transaction than elections and receipts.
 // now() is transaction-start time; do not backdate started_at or weaken the
 // prePlayElected check by putting the whole rehearsal in one transaction.
 seed=seed.replace('insert into app.initial_seating_publications','commit;begin;set role postgres;\ninsert into app.initial_seating_publications');
 if(structuredSchedule){
  const schedule={kind:'director-selected-prize-schedule-v1',amountBasis:'total_award',expectedQualifierCount:4,sourceReference:'TEST ONLY reviewed 4:3:2:2 director schedule',roundingRule:'floor_each_weighted_share_then_assign_remainder_to_champion',cohorts:[{bandStart:1,bandEnd:1,weight:4},{bandStart:2,bandEnd:2,weight:3},{bandStart:3,bandEnd:4,weight:2}]};
  const request={expectedVersion:0,schedule,reviewed:true,reason:'TEST ONLY initial pre-collection schedule'};
  const insert=`do $schedule$declare saved jsonb;begin saved:=public.save_setup_prize_schedule_v1('${actor}','${tid}','e1310000-0000-4000-8000-000000000003',${quote(JSON.stringify(request))},'${uuid('e249',1)}');if saved->>'status'is distinct from'prize_schedule_saved_v1'then raise exception'pre-collection schedule failed %',saved;end if;end$schedule$;\n`;
  assert.ok(seed.includes('insert into app.ruleset_versions'));seed=seed.replace('insert into app.ruleset_versions',insert+'insert into app.ruleset_versions');
 }
 return seed;
}
