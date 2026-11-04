import assert from 'node:assert/strict';
import {quote,uuid} from './fixtures/q-review-foundation.mjs';
const json=x=>quote(JSON.stringify(x))+'::jsonb';
export function prepareSideRecipientV3({sql,fixture:f}){
 const read=q=>JSON.parse(sql(q).split('\n').filter(Boolean).at(-1));
 const pool=uuid('c264',1),tiePool=uuid('c264',2),racePool=uuid('c264',3),operation=n=>uuid('b264',n);
 const add=p=>read(`select public.add_event_side_pool_v1('${f.actor}','${f.tid}','${f.eid}','${p}','TEST ONLY','TEST ONLY recipient source ${p}',1000,'${operation(p===pool?1:p===tiePool?2:3)}');`);
 for(const p of[pool,tiePool,racePool])assert.equal(add(p).status,'side_pool_added');
 for(const [i,p]of[pool,tiePool,racePool].entries()){
  const def=read(`select to_jsonb(id)from app.event_side_pool_definition_versions where pool_id='${p}'order by version desc limit 1;`);
  const policy=read(`select public.save_side_pool_graduated_policy_v2('${f.actor}','${f.tid}','${f.eid}','${p}',${json({method:'graduated-acc-weighted-largest-remainder-5usd-v2',ratio:6,definitionVersionId:def,disclosureReference:'TEST ONLY disclosed amount formula',disclosed:true})},'${operation(10+i)}');`);
  assert.equal(policy.status,'side_pool_graduated_policy_frozen');
  const request={amountPolicyId:policy.policyId,method:'paid-qualifying-cards-no-cutoff-v3',disclosureReference:'TEST ONLY paid entrants ranked by qualifying cards regardless playoff cutoff; unresolved ties blocked',disclosed:true};
  const q=`select public.publish_side_pool_recipient_policy_v3('${f.actor}','${f.tid}','${f.eid}','${p}',${json(request)},'${operation(20+i)}');`;
  const result=read(q);assert.equal(result.status,'side_pool_recipient_policy_frozen');assert.deepEqual(read(q),result);
 }
 // Qualifying result will match the prepared fixture, but election is saved before play.
 const elected=[f.pid(6)],tied=[f.pid(3),f.pid(4)];
 for(const [i,p]of[pool,tiePool,racePool].entries())for(const [j,participant]of(i===1?tied:elected).entries()){
  const policy=read(`select to_jsonb(id)from app.side_pool_graduated_policies_v2 where pool_id='${p}';`);
  const req={policyId:policy,participantId:participant,electionId:uuid('e264',i*10+j+1),expectedVersion:0,elected:true,receivedMinor:1000,paymentMethod:'cash',paymentReference:'TEST ONLY simulated separate Side receipt',reason:'TEST ONLY exact disclosed policy acknowledgment'};
  const result=read(`select public.save_side_pool_graduated_election_v2('${f.actor}','${f.tid}','${f.eid}','${p}',${json(req)},'${operation(30+i*10+j)}');`);assert.equal(result.status,'side_pool_election_saved_v2');
 }
 return{pool,tiePool,racePool,operation};
}
export async function verifySideRecipientV3({sql,fixture:f,state,startSession}){
 const read=q=>JSON.parse(sql(q).split('\n').filter(Boolean).at(-1));const {pool,tiePool,racePool,operation}=state;
 const workspace=()=>read(`select public.get_side_pool_recipient_workspace_v3('${f.actor}','${f.tid}','${f.eid}','${pool}');`);
 const w=workspace();assert.deepEqual(w.blockers,[]);assert.equal(w.obligations.length,1);assert.equal(w.obligations[0].participantId,f.pid(6));assert.equal(w.obligations[0].qualified,false);assert.equal(w.obligations[0].amountMinor,1000);
 const tie=read(`select public.get_side_pool_recipient_workspace_v3('${f.actor}','${f.tid}','${f.eid}','${tiePool}');`);assert.ok(tie.blockers.includes('cash_tie_policy_unresolved'));assert.deepEqual(tie.obligations,[]);
 const request={expectedVersion:0,sourceDigest:w.sourceDigest,reason:'TEST ONLY reviewed exact unpaid recipients',reviewed:true};
 const call=op=>`select public.record_side_pool_recipient_review_v3('${f.actor}','${f.tid}','${f.eid}','${pool}',${json(request)},'${op}');`;
 const saved=read(call(operation(60)));assert.equal(saved.status,'side_pool_recipients_reviewed_unpaid');assert.equal(saved.moneyMoved,false);assert.deepEqual(read(call(operation(60))),saved);
 assert.equal(read(call(operation(61))).status,'rejected');assert.equal(sql(`select count(*)from app.side_pool_recipient_reviews_v3 where pool_id='${pool}';`),'1');
 const reconcile=read(`select public.get_side_pool_recipient_reconciliation_v3('${f.actor}','${f.tid}','${f.eid}','${pool}',${json(request)},'${operation(60)}');`);assert.deepEqual(reconcile.result,saved);
 assert.equal(sql(`set request.jwt.claim.role='authenticated';select public.get_side_pool_recipient_workspace_v3('${f.actor}','${f.tid}','${f.eid}','${pool}')is null;`),'t');
 assert.equal(sql(`set request.jwt.claim.role='service_role';select public.get_side_pool_recipient_workspace_v3('${f.uid(1)}','${f.tid}','${f.eid}','${pool}')is null;`),'t');
 assert.equal(sql(`select count(*)from app.event_side_pool_payout_versions where tournament_id='${f.tid}';`),'0');
 assert.equal(sql(`select public.get_side_pool_recipient_workspace_v3('${f.actor}','${f.tid}','${uuid('c264',999)}','${pool}')is null;`),'t');
 assert.equal(sql(`select bool_and(c.relrowsecurity and c.relforcerowsecurity and pg_get_userbyid(c.relowner)='postgres'and not has_table_privilege('authenticated',c.oid,'SELECT')and not has_table_privilege('service_role',c.oid,'INSERT'))from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app'and c.relname in('side_pool_recipient_reviews_v3','side_pool_recipient_policies_v3');`),'t');
 assert.equal(sql(`select bool_and(p.prosecdef and p.proconfig=array['search_path=""'] and pg_get_userbyid(p.proowner)='postgres'and has_function_privilege('service_role',p.oid,'EXECUTE')and not has_function_privilege('authenticated',p.oid,'EXECUTE')and not has_function_privilege('anon',p.oid,'EXECUTE'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('publish_side_pool_recipient_policy_v3','record_side_pool_recipient_review_v3','get_side_pool_recipient_workspace_v3','get_side_pool_recipient_reconciliation_v3');`),'t');
 sql(`begin;delete from app.tournament_roles where tournament_id='${f.tid}'and profile_id='${f.actor}';do $test$begin if public.record_side_pool_recipient_review_v3('${f.actor}','${f.tid}','${f.eid}','${pool}',${json(request)},'${operation(60)}')is not null then raise exception'revoked replay leaked';end if;end$test$;rollback;`);
 // Supported post-qualification dispute guard is preserved. This does NOT
 // claim an available post-finalization correction workflow.
 sql(`begin;do $test$declare r jsonb;begin r:=public.open_event_dispute_v1('${f.actor}','${f.tid}','${f.eid}',(select id from app.canonical_games where event_id='${f.eid}'limit 1),'${operation(70)}','TEST ONLY open source dispute','${operation(71)}');if r->>'code'<>'qualification_finalized'then raise exception'postqualification dispute guard failed %',r;end if;end$test$;rollback;`);
 // Explicit administrator-local tamper probe, rollback only: test defensive
 // stale-snapshot detection, not a supported app correction or historical edit.
 sql(`begin;update app.events set operational_state='retired'where id='${f.eid}';do $test$begin if app.qualification_resolution_snapshot_current_v1((select id from app.qualification_result_versions where event_id='${f.eid}'order by version desc limit 1))is distinct from false then raise exception'stale snapshot accepted';end if;end$test$;rollback;`);
 assert.equal(workspace().sourceDigest,w.sourceDigest);assert.equal(workspace().history[0].current,true);

 const co=f.uid(1);sql(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${f.tid}','${co}','co_director');`);
 const rw=read(`select public.get_side_pool_recipient_workspace_v3('${f.actor}','${f.tid}','${f.eid}','${racePool}');`);
 const rr={...request,sourceDigest:rw.sourceDigest};
 const raceCall=(actor,op)=>`begin;set request.jwt.claim.role='service_role';select public.record_side_pool_recipient_review_v3('${actor}','${f.tid}','${f.eid}','${racePool}',${json(rr)},'${op}');commit;`;
 const a=startSession(raceCall(f.actor,operation(80))),b=startSession(raceCall(co,operation(81)));
 const outcomes=await Promise.all([a.done,b.done]);const statuses=outcomes.map(x=>JSON.parse(x.split('\n').filter(l=>l.startsWith('{')).at(-1)).status).sort();assert.deepEqual(statuses,['rejected','side_pool_recipients_reviewed_unpaid']);
 assert.equal(sql(`select count(*)from app.side_pool_recipient_reviews_v3 where pool_id='${racePool}';`),'1');
 return{status:'passed',recipientNonqualifier:f.pid(6),fundMinor:1000,unpaidReviewId:saved.reviewId,tieBlocked:true,replay:true,differentOperationDuplicateBlocked:true,unpaidOnly:true};
}
