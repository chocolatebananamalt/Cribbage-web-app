// LOCAL ONLY. Root owns the reviewed disposable database/container lifecycle.
import assert from 'node:assert/strict';
import {calculateAccWeightedPool,accWeightedPoolVersion} from '../src/lib/results/acc-weighted-pool.ts';
import {qChartSchedules} from '../src/lib/results/q-chart-catalog.ts';
const quote=s=>`'${String(s).replaceAll("'","''")}'`;
const id=n=>`a2550000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function workspace(fee,n,ratio=6,method=accWeightedPoolVersion,scheduleId=accWeightedPoolVersion){
 const pool=id(1),policy=id(2),ids=Array.from({length:n},(_,i)=>id(10+i));
 return{blockers:[],policies:[{id:policy,poolVersionId:pool,method,ratio:method.startsWith('equal')?null:ratio,scheduleId:method.startsWith('equal')?null:scheduleId}],cuts:[],cards:ids.map((participantId,i)=>({participantId,gamePoints:2,gamesWon:1,plusPoints:n-i,qualified:i<4,qualificationRank:i<4?i+1:null})),membership:{supported:true,pools:[{poolVersionId:pool,name:'TEST ONLY pool',feeMinor:fee}],entries:ids.map(participantId=>({participantId,displayName:'TEST ONLY '+participantId,receivedMinor:fee,allocationCurrent:true,pools:[{poolVersionId:pool,elected:true,prePlayElected:true,paidEntryEligible:true,amountAllocatedMinor:fee,consentReference:'Q policy '+policy+': TEST ONLY exact policy acknowledgment'}]}))}};
}
export function verifyAccWeightedSqlCalculator(sql){
 let groups=0;const pass=name=>{groups++;console.log('PASS ACC-weighted SQL '+name);};
 let count=0;
 for(const feeMinor of[1000,2000,5000])for(const ratio of[4,6]){
  const inputs=Array.from({length:256},(_,i)=>({paidCount:i+1,feeMinor,ratio}));
  const results=JSON.parse(sql(`select jsonb_agg(app.calculate_acc_weighted_pool_v1(value)order by ord)from jsonb_array_elements(${quote(JSON.stringify(inputs))}::jsonb)with ordinality as cases(value,ord);`));
  assert.equal(results.length,256);for(const[i,input]of inputs.entries()){assert.deepEqual(results[i],calculateAccWeightedPool(input),JSON.stringify(input));count++;}
 }
 assert.equal(count,1536);pass('all1536 supported amount cases match BigInt output, exact reduced fractions, branch, recipient count, every cent and ordering');
 const malformed=[null,{},[],{paidCount:'16',feeMinor:1000,ratio:6},{paidCount:1.5,feeMinor:1000,ratio:6},{paidCount:0,feeMinor:1000,ratio:6},{paidCount:257,feeMinor:1000,ratio:6},{paidCount:1,feeMinor:500,ratio:6},{paidCount:1,feeMinor:1000,ratio:5},{paidCount:1,feeMinor:1000,ratio:6,extra:true}];
 const rejected=JSON.parse(sql(`select jsonb_agg(app.calculate_acc_weighted_pool_v1(value)order by ord)from jsonb_array_elements(${quote(JSON.stringify(malformed))}::jsonb)with ordinality as cases(value,ord);`));
 for(const[i,input]of malformed.entries())assert.deepEqual(rejected[i],calculateAccWeightedPool(input));
 assert.deepEqual(JSON.parse(sql(`select app.calculate_acc_weighted_pool_v1('{"paidCount":59,"feeMinor":1000,"ratio":4}');`)).awardsMinor,[7000,6500,6000,5500,5000,5000,4500,4000,3500,3000,2500,2000,2000,1500,1000]);
 assert.deepEqual(JSON.parse(sql(`select app.calculate_acc_weighted_pool_v1('{"paidCount":1,"feeMinor":1000,"ratio":6}');`)).awardsMinor,[1000]);
 pass('invalid types/domain/extras block;59-entry590-dollar pot and one-recipient whole-pot goldens');
 const cells=qChartSchedules.flatMap(s=>s.cells),oldInputs=cells.map(c=>workspace(c.feeMinor,c.paidCount,c.ratio,'graduated-paid-card-rank-v2',c.scheduleId));
 const old=JSON.parse(sql(`select jsonb_agg(jsonb_build_object('current',app.calculate_q_obligations_v2(value),'prior',app.calculate_q_obligations_pre_acc_v3(value))order by ord)from jsonb_array_elements(${quote(JSON.stringify(oldInputs))}::jsonb)with ordinality as cases(value,ord);`));
 assert.equal(old.length,320);for(const[i,c]of cells.entries()){assert.deepEqual(old[i].current,old[i].prior);assert.deepEqual(old[i].current.obligations[0].rows.map(r=>r.amountMinor),c.awardsMinor);}
 const calc=w=>JSON.parse(sql(`select app.calculate_q_obligations_v2(${quote(JSON.stringify(w))}::jsonb);`));
 assert.deepEqual(calc(workspace(1000,16)).obligations[0].rows.map(r=>r.amountMinor),[8000,5500,2500]);
 const down=workspace(1000,16);down.membership.entries=down.membership.entries.slice(3);const rankDown=calc(down);assert.deepEqual(rankDown.obligations[0].rows.map(r=>r.participantId),[id(13),id(14),id(15)]);assert.deepEqual(rankDown.obligations[0].rows.map(r=>r.amountMinor),[6500,4500,2000]);assert.equal(rankDown.obligations[0].rows[1].qualificationRank,null);
 pass('320 old chart outputs are identical to the preserved calculator; new16/13paid rank-down differs only by disclosed amount policy');
 const equal=workspace(1000,1,6,'equal-paid-playoff-qualifiers-v2',null);equal.cards[0].qualified=false;equal.cards[0].qualificationRank=null;assert.deepEqual(calc(equal),JSON.parse(sql(`select app.calculate_q_obligations_pre_acc_v3(${quote(JSON.stringify(equal))}::jsonb);`)));
 const mixed=workspace(1000,16),secondPool=id(3),secondPolicy=id(4),last=mixed.membership.entries.at(-1);
 mixed.membership.pools.push({poolVersionId:secondPool,name:'TEST ONLY unchanged equal refund',feeMinor:1000});mixed.policies.push({id:secondPolicy,poolVersionId:secondPool,method:'equal-paid-playoff-qualifiers-v2',ratio:null,scheduleId:null});
 for(const e of mixed.membership.entries){const elected=e===last;if(elected)e.receivedMinor+=1000;e.pools.push({poolVersionId:secondPool,elected,prePlayElected:elected,paidEntryEligible:elected,amountAllocatedMinor:elected?1000:0,consentReference:elected?'Q policy '+secondPolicy+': TEST ONLY exact policy acknowledgment':''});}
 const mixedResult=calc(mixed);assert.deepEqual(mixedResult.blockers,[]);assert.deepEqual(mixedResult.obligations[0].rows.map(r=>r.amountMinor),[8000,5500,2500]);assert.equal(mixedResult.obligations[1].kind,'refund');assert.deepEqual(mixedResult.obligations[1].rows.map(r=>r.amountMinor),[1000]);
 const oldOnly=structuredClone(mixed);oldOnly.membership.pools=oldOnly.membership.pools.slice(1);oldOnly.policies=oldOnly.policies.slice(1);assert.deepEqual(mixedResult.obligations[1],JSON.parse(sql(`select app.calculate_q_obligations_pre_acc_v3(${quote(JSON.stringify(oldOnly))}::jsonb);`)).obligations[0]);
 pass('mixed new/legacy-equal pools conserve independently; equal no-qualifier refund obligation stays byte-identical');
 const tied=workspace(1000,16);Object.assign(tied.cards[1],{gamePoints:tied.cards[0].gamePoints,gamesWon:tied.cards[0].gamesWon,plusPoints:tied.cards[0].plusPoints});tied.cuts=[{participantIdsLowFirst:[tied.cards[1].participantId,tied.cards[0].participantId],reason:'Old cut cannot choose cash ranking',recordedBy:id(99)}];assert.deepEqual(calc(tied).blockers,['q_cash_tie_unresolved']);
 for(const mutate of[w=>w.membership.entries[0].allocationCurrent=false,w=>w.membership.entries[0].pools[0].amountAllocatedMinor=500,w=>w.membership.entries[0].pools[0].consentReference='wrong policy',w=>w.membership.entries[0].pools[0].prePlayElected=false]){const w=workspace(1000,16);mutate(w);assert.deepEqual(calc(w).blockers,['funding_unresolved']);}
 const empty=workspace(1000,1);empty.membership.entries[0].pools[0].elected=false;empty.membership.entries[0].pools[0].amountAllocatedMinor=0;empty.membership.entries[0].receivedMinor=0;assert.deepEqual(calc(empty).blockers,['unsupported_payout_domain']);assert.deepEqual(calc(workspace(500,16)).blockers,['unsupported_payout_domain']);
 pass('numerical cash ties block despite cut evidence; partial/stale funding, wrong acknowledgment, late entry and unsupported domain fail closed');
 return{groups,supportedAmountCases:count,legacyChartCases:320};
}

// Root supplies the actual new policy operation after supported prepayment
// publication, then completes real scoring/review/canonical accounting itself.
export function verifyAccWeightedPolicyReplayV3({sql,actor,tid,poolVersionId,request,operationId}){
 const call=(r,key=operationId,who=actor)=>JSON.parse(sql(`select public.save_q_operating_policy_v3('${who}','${tid}',${quote(JSON.stringify(r))},'${key}');`)||'null');
 const reconcile=(r,key=operationId,who=actor)=>JSON.parse(sql(`select public.get_q_operating_reconciliation_v3('${who}','${tid}','${key}',${quote(JSON.stringify(r))});`)||'null');
 const before=sql(`select to_jsonb(p)from app.q_operating_policies_v2 p where pool_version_id='${poolVersionId}';`);const saved=call(request);assert.equal(saved.status,'q_policy_published');assert.equal(saved.poolVersionId,poolVersionId);assert.deepEqual(reconcile(request),{authorized:true,result:saved});
 assert.deepEqual(call(request),saved);assert.equal(call({...request,disclosureReference:'changed retained disclosure'}).code,'idempotency_conflict');assert.equal(reconcile({...request,disclosureReference:'changed retained disclosure'}).result.code,'idempotency_conflict');
 assert.equal(sql(`select to_jsonb(p)from app.q_operating_policies_v2 p where pool_version_id='${poolVersionId}';`),before);assert.equal(sql(`select count(*)from app.q_operating_policies_v2 where pool_version_id='${poolVersionId}';`),'1');
 for(const role of['authenticated','anon',null])assert.equal(sql(`set request.jwt.claim.role='';set request.jwt.claims=${quote(JSON.stringify(role?{role}:{}))};select public.save_q_operating_policy_v3('${actor}','${tid}',${quote(JSON.stringify(request))},'${id(800)}')is null and public.get_q_operating_reconciliation_v3('${actor}','${tid}','${operationId}',${quote(JSON.stringify(request))})is null;`),'t');
 sql(`begin;delete from app.tournament_roles where tournament_id='${tid}'and profile_id='${actor}'and role='director';do $$begin if public.save_q_operating_policy_v3('${actor}','${tid}',${quote(JSON.stringify(request))},'${operationId}')is not null or public.get_q_operating_reconciliation_v3('${actor}','${tid}','${operationId}',${quote(JSON.stringify(request))})is not null then raise exception 'revoked policy actor accepted';end if;end$$;rollback;`);
 assert.equal(sql(`select count(*)from app.operation_receipts where actor_profile_id='${actor}'and client_operation_id='${operationId}'and operation_type='q_operating_v3';`),'1');
 console.log('PASS new ACC policy exact retry/full-request reconciliation/conflict/current-role/JWT boundary; one immutable policy and one original operation');
 return{policyId:saved.policyId,groups:1};
}

// Invoke after committed setup but before the intended policy publication.
// Only rejected requests are recorded; the intended policy remains unpublished.
export function verifyAccWeightedPolicyPrepublishV3({sql,actor,tid,poolVersionId,request}){
 assert.equal(sql(`select count(*)from app.q_operating_policies_v2 where pool_version_id='${poolVersionId}';`),'0');
 const call=(r,key,who=actor)=>JSON.parse(sql(`select public.save_q_operating_policy_v3('${who}','${tid}',${quote(JSON.stringify(r))},'${key}');`)||'null');
 const cases=[
  [{...request,method:'graduated-paid-card-rank-v2'},'invalid_request'],
  [{...request,scheduleId:'friend-q-p2-10-6-v1'},'invalid_request'],
  [{...request,ratio:'6'},'invalid_request'],
  [{...request,ratio:5},'invalid_request'],
  [{...request,disclosed:false},'invalid_request'],
  [{...request,disclosureReference:' leading whitespace'},'invalid_request'],
  [{...request,disclosureReference:''},'invalid_request'],
  [{...request,amountMinor:1000},'invalid_request'],
  [{...request,action:'cut'},'invalid_request'],
  [{...request,poolVersionId:id(999)},'pool_version_mismatch'],
  [{...request,ratio:request.ratio===6?4:6},'setup_method_conflict'],
 ];
 for(const[i,[bad,code]]of cases.entries()){const result=call(bad,id(900+i));assert.equal(result.code,code);assert.deepEqual(JSON.parse(sql(`select public.get_q_operating_reconciliation_v3('${actor}','${tid}','${id(900+i)}',${quote(JSON.stringify(bad))});`)),{authorized:true,result});}
 const old=JSON.parse(sql(`select public.save_q_operating_policy_v2('${actor}','${tid}',${quote(JSON.stringify(request))},'${id(920)}');`));assert.equal(old.code,'invalid_request','Old v2 writer must not admit the new method');
 assert.equal(call(request,id(921),id(998)),null);
 assert.equal(sql(`select count(*)from app.q_operating_policies_v2 where pool_version_id='${poolVersionId}';`),'0');
 console.log('PASS new policy exact shape/domain/disclosure/actor negatives, exact rejected receipts, and strict old-v2 method boundary before publication');
 return{groups:1};
}
