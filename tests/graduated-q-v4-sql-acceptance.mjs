// Root owns the disposable database. No connection/lifecycle or hosted access.
import assert from 'node:assert/strict';
import {calculateGraduatedPoolAmountsV2,graduatedPoolAmountsVersionV2}from'../src/lib/results/graduated-pool-amounts-v2.ts';
import {operatingSource,id}from'./fixtures/q-operating-source.mjs';
const quote=s=>`'${String(s).replaceAll("'","''")}'`;
export function verifyGraduatedQAmountsV4(sql){
 const cases=[];for(const paidCount of[1,2,16,59,89,90,9999,10000])for(const ratio of[2,4,6,7,100])for(const feeMinor of[500,1500,100000000])cases.push({paidCount,feeMinor,ratio});
 const actual=JSON.parse(sql(`select jsonb_agg(app.calculate_graduated_pool_amounts_v2(value)order by ord)from jsonb_array_elements(${quote(JSON.stringify(cases))}::jsonb)with ordinality as x(value,ord);`));
 for(const[i,c]of cases.entries())assert.deepEqual(actual[i],calculateGraduatedPoolAmountsV2(c));
 const s=operatingSource(16,500);Object.assign(s.policies[0],{method:graduatedPoolAmountsVersionV2,ratio:6,scheduleId:graduatedPoolAmountsVersionV2});
 const calc=w=>JSON.parse(sql(`select app.calculate_q_obligations_v2(${quote(JSON.stringify(w))}::jsonb);`));
 const q=calc(s);assert.deepEqual(q.blockers,[]);assert.deepEqual(q.obligations[0].rows.map(r=>r.amountMinor),[4000,2500,1500]);assert.equal(q.obligations[0].fundMinor,8000);assert.equal(q.obligations[0].status,'unpaid');
 const old=operatingSource(16,1000,'graduated-paid-card-rank-v2');assert.deepEqual(calc(old),JSON.parse(sql(`select app.calculate_q_obligations_pre_graduated_v4(${quote(JSON.stringify(old))}::jsonb);`)));
 const stale=structuredClone(s);stale.membership.entries[0].allocationCurrent=false;assert.deepEqual(calc(stale).blockers,['funding_unresolved']);
 const late=structuredClone(s);late.membership.entries[0].pools[0].prePlayElected=false;assert.deepEqual(calc(late).blockers,['funding_unresolved']);
 const tie=structuredClone(s);tie.cards[1]={...tie.cards[0],participantId:id(101),qualificationRank:2};assert.deepEqual(calc(tie).blockers,['q_cash_tie_unresolved']);
 assert.equal(sql(`select bool_and(not has_function_privilege(r,p.oid,'EXECUTE'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['anon','authenticated'])r where n.nspname='public'and p.proname in('save_q_operating_policy_v4','get_q_operating_reconciliation_v4');`),'t');
 assert.equal(sql(`select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('save_q_operating_policy_v4','get_q_operating_reconciliation_v4')and p.prosecdef and p.proconfig @> array['search_path=""']and pg_get_userbyid(p.proowner)='postgres'and has_function_privilege('service_role',p.oid,'EXECUTE');`),'2');
 console.log('PASS shared graduated SQL/TS240cases, $5Q80pot exactunpaidamounts, olddispatch, stale/late/tie blocks andservice-onlyRPCs');return{amountCases:cases.length};
}
export function verifyGraduatedQPolicyV4({sql,actor,tid,poolVersionId,operationId,ratio=6}){
 const request={action:'publish',poolVersionId,method:graduatedPoolAmountsVersionV2,ratio,scheduleId:graduatedPoolAmountsVersionV2,disclosureReference:'TEST ONLY exact shared graduated amount method; eligibility and monetary score ties separate; no money movement',disclosed:true};
 const call=(r=request,op=operationId,who=actor)=>JSON.parse(sql(`select public.save_q_operating_policy_v4('${who}','${tid}',${quote(JSON.stringify(r))},'${op}');`)||'null');
 const result=call();assert.equal(result.status,'q_policy_published');assert.equal(result.poolVersionId,poolVersionId);assert.deepEqual(call(),result);
 assert.equal(call({...request,disclosureReference:'different'}).code,'idempotency_conflict');
 assert.deepEqual(JSON.parse(sql(`select public.get_q_operating_reconciliation_v4('${actor}','${tid}','${operationId}',${quote(JSON.stringify(request))});`)),{authorized:true,result});
 assert.equal(JSON.parse(sql(`select public.save_q_operating_policy_v3('${actor}','${tid}',${quote(JSON.stringify(request))},'${id(899)}');`)).code,'invalid_request');
 assert.equal(sql(`select count(*)from app.q_operating_policies_v2 where pool_version_id='${poolVersionId}';`),'1');
 assert.equal(sql(`select count(*)from app.operation_receipts where actor_profile_id='${actor}'and client_operation_id='${operationId}'and operation_type='q_operating_v4';`),'1');
 sql(`begin;delete from app.tournament_roles where tournament_id='${tid}'and profile_id='${actor}'and role='director';do $$begin if public.save_q_operating_policy_v4('${actor}','${tid}',${quote(JSON.stringify(request))},'${operationId}')is not null then raise exception 'revoked actor replayed';end if;end$$;rollback;`);
 console.log('PASS new sharedQactualpublication/replay/fullrequestconflict/reconciliation/oldwriterreject/currentrole/onepolicy');return{request,result};
}
