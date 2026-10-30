// LOCAL disposable Q accounting only. No hosted DB or disbursement.
import fs from 'node:fs';import assert from 'node:assert/strict';import {spawnSync,spawn}from'node:child_process';
import {foundationV2}from'./fixtures/q-v2-foundation.mjs';import{actor as originalActor,tid as originalTid,eid as originalEid,uuid,quote}from'./fixtures/q-review-foundation.mjs';
const container=process.env.Q_BRIDGE_CONTAINER??'cribbage-qaccounting-local',database=process.env.Q_BRIDGE_DATABASE??'fixture_qaccounting';
if(container!=='cribbage-qaccounting-local'||database!=='fixture_qaccounting')throw Error('Exact disposable Q accounting target required');
const args=['--context','desktop-linux','exec','-i',container,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1'];
const prefix="set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';\n";
function sql(q){const r=spawnSync('docker',args,{input:prefix+q,encoding:'utf8',maxBuffer:32*1024*1024});if(r.status!==0)throw Error(r.stderr+'\n'+r.stdout);return r.stdout.trim();}
function start(q){const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);const done=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',c=>c?reject(Error(err)):resolve(out.trim()));});p.stdin.end(prefix+q);return{done,out:()=>out};}
async function until(check){for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,40));}throw Error('Expected concurrency overlap not observed');}
const namespace=s=>s.replaceAll('1310000','1510000').replaceAll('2430000','2530000').replaceAll('2450000','2550000').replaceAll('@test.invalid','-v6@test.invalid');
const actor=namespace(originalActor),tid=namespace(originalTid),eid=namespace(originalEid),pid=n=>namespace(uuid('f243',n));
let seed=namespace(foundationV2({structuredSchedule:true,pool1People:Array.from({length:16},(_,i)=>i+1),pool1Fee:1000,pool1Type:'Graduated (1-in-6)'}));
sql(seed+'begin;set constraints all immediate;commit;');
const checks=[];const ws=()=>JSON.parse(sql(`select public.get_q_accounting_workspace_v6('${actor}','${tid}','${eid}');`));
let w=ws();assert.ok(w.blockers.includes('q_review_required'));assert.equal(w.automaticPayment,false);
const qws=JSON.parse(sql(`select public.get_q_obligation_review_workspace_v2('${actor}','${tid}');`));assert.deepEqual(qws.blockers,[]);
const qrequest={expectedVersion:0,sourceDigest:qws.sourceDigest,reason:'TEST ONLY v6 bound Q review',reviewed:true};
const qrecord=JSON.parse(sql(`select public.record_q_obligation_review_v2('${actor}','${tid}',${quote(JSON.stringify(qrequest))},'${uuid('b249',1)}');`));assert.equal(qrecord.status,'q_obligations_recorded_v2');
// Real classified expense RPCs, with synthetic local auth context; never payments.
for(const [i,amount,name]of[[1,4800,'sanctioning'],[2,9600,'meals'],[3,4800,'hall_rental'],[4,2400,'cards']]){
 const r=JSON.parse(sql(`select set_config('request.jwt.claim.sub','${actor}',false);select public.record_tournament_expense('${tid}',${amount},'USD','TEST ONLY ${name}','${uuid('c249',i)}');`).split('\n').at(-1));assert.equal(r.status,'expense_recorded');
}
// Cross-checker is a fictional nonplayer, never the director/player. The role is
// direct synthetic foundation; identity confirmation and closure use actual RPCs.
const checker=namespace('a1310000-0000-4000-8000-000000000007');
sql(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${checker}','cross_checker');`);
const binding=JSON.parse(sql(`select public.bind_paper_official_identity_v1('${actor}','${tid}','${uuid('d249',1)}','${checker}','nonparticipant',null,0,'${uuid('d249',2)}');`));assert.equal(binding.status,'bound');
// Assessment snapshot uses the real generated event-play start as its FK.
sql(`insert into app.event_sanctioning_fee_snapshots(id,tournament_id,event_id,event_play_start_id,event_kind,rate_cents,eligible_participant_count,total_cents,rate_source,setup_revision_id)select '${uuid('e249',2)}','${tid}','${eid}',(select id from app.event_play_starts where event_id='${eid}'),'main',300,16,4800,'setup','${namespace('e1310000-0000-4000-8000-000000000001')}'where not exists(select 1 from app.event_sanctioning_fee_snapshots where event_id='${eid}');`);
assert.equal(sql(`select app.settlement_assessment_v5('${eid}');`),'4800');
const qid=sql(`select id from app.qualification_result_versions where event_id='${eid}';`);
const series=[{winnerId:pid(2),loserId:pid(3),evidenceNote:'TEST ONLY simulated semifinal 1'},{winnerId:pid(1),loserId:pid(4),evidenceNote:'TEST ONLY simulated semifinal 2'},{winnerId:pid(2),loserId:pid(1),evidenceNote:'TEST ONLY simulated final'}];
const playoffs=JSON.parse(sql(`select public.record_standard_singles_playoff_outcomes_v3('${actor}','${tid}','${eid}','${qid}',0,${quote(JSON.stringify(series))},'${uuid('f249',1)}');`));assert.equal(playoffs.status,'playoff_outcomes_recorded');
w=ws();assert.deepEqual(w.blockers,[]);assert.equal(w.facts.baseIncomeMinor,48000);assert.equal(w.facts.qIncomeMinor,17000);assert.equal(w.facts.receiptTotalMinor,65000);assert.equal(w.facts.expenseTotalMinor,21600);assert.equal(w.facts.regularAwardMinor,26400);assert.equal(w.facts.minimumReturnMinor,40800);
assert.deepEqual(w.regularSchedule.awards.map(a=>a.totalAwardMinor),[9600,7200,4800,4800]);assert.equal(Object.hasOwn(w.regularSchedule,'ledgerBasis'),false);
assert.deepEqual(w.qReview.obligations.flatMap(p=>p.rows.map(r=>r.amountMinor)),[8000,5000,3000,1000]);
checks.push('real pre-collection schedule, sixteen full base/Q receipts, classified expense evidence, canonical playoffs; base480/Q170/receipts650/expenses216/regular264 partition');
const classes=w.facts.expenseEvidence.map(e=>({expenseEventId:e.expenseEventId,category:e.description.replace('TEST ONLY ',''),evidenceReference:'TEST ONLY synthetic invoice'}));
const request={expectedVersion:0,sourceDigest:w.sourceDigest,qReviewId:w.qReview.id,scheduleVersionId:w.regularSchedule.scheduleVersionId,reason:'TEST ONLY reviewed canonical accounting',expenseClassifications:classes,reviewed:true};
const modern=JSON.parse(sql(`set request.jwt.claim.role='';set request.jwt.claims='{"role":"service_role"}';select public.get_q_accounting_workspace_v6('${actor}','${tid}','${eid}');`));assert.equal(modern.sourceDigest,w.sourceDigest);
for(const role of['authenticated','anon',null])sql(`set request.jwt.claim.role='';set request.jwt.claims=${quote(JSON.stringify(role?{role}:{}))};do $$begin if public.get_q_accounting_workspace_v6('${actor}','${tid}','${eid}')is not null or public.save_q_accounting_draft_v6('${actor}','${tid}','${eid}',${quote(JSON.stringify(request))},'${uuid('b249',99)}')is not null or public.reconcile_q_accounting_v6('${actor}','${tid}','${eid}','${uuid('b249',99)}',${quote(JSON.stringify(request))},'draft')is not null then raise exception 'non-service claim accepted';end if;end$$;`);
checks.push('modern JSON-only service claim accepted; missing/anon/authenticated backend claims deny workspace, write and reconciliation');
const call=(r,op,who=actor,event=eid,tournament=tid)=>JSON.parse(sql(`select public.save_q_accounting_draft_v6('${who}','${tournament}','${event}',${quote(JSON.stringify(r))},'${op}');`)||'null');
assert.equal(call(request,uuid('b249',2),checker).code,'not_director');
assert.equal(sql(`select coalesce(public.get_q_accounting_workspace_v6('${actor}','${tid}','${uuid('d249',99)}')::text,'NULL');`),'NULL');
assert.equal(call(request,uuid('b249',22),actor,uuid('d249',99)).code,'source_blocked');
assert.equal(call({...request,expenseClassifications:classes.map(c=>({...c,category:'unknown'}))},uuid('b249',3)).code,'invalid_expense_classification');
assert.equal(call({...request,expenseClassifications:'not an array'},uuid('b249',23)).code,'invalid_expense_classification');
assert.equal(call({...request,expenseClassifications:classes.map(c=>c.category==='meals'?{...c,category:'supplies'}:c)},uuid('b249',24)).code,'insufficient_participant_return');
const missing=classes.filter(c=>c.category!=='sanctioning');assert.equal(call({...request,expenseClassifications:missing},uuid('b249',4)).code,'invalid_expense_classification');
assert.equal(call({...request,qReviewId:uuid('d249',99)},uuid('b249',5)).code,'q_review_required');
assert.equal(call({...request,sourceDigest:'0'.repeat(64)},uuid('b249',6)).code,'source_changed');
assert.equal(call({...request,prizeClaims:[]},uuid('b249',7)).code,'invalid_request');
const oldRequest={source:{kind:'playoff_outcome_v3',resultId:playoffs.resultId,qualificationResultVersionId:qid},expectedVersion:0,prizeClaims:w.regularSchedule.awards.map(a=>({participantId:a.participantId,amountMinor:a.totalAwardMinor,prizeOrder:null,note:'TEST ONLY no duplicate manual liability'})),eventIncomeMinor:48000,eventExpenseMinor:21600,retainedBalanceMinor:0,officialSourceReference:'TEST ONLY existing disclosed regular schedule',sanctioningExpenseEventId:classes.find(c=>c.category==='sanctioning').expenseEventId,scheduleVersionId:w.regularSchedule.scheduleVersionId};
const oldAttempt=()=>JSON.parse(sql(`select public.save_event_settlement_draft_v5('${actor}','${tid}','${eid}',${quote(JSON.stringify(oldRequest))},'${uuid('b249',30)}');`));
const hold=start(`begin;select pg_advisory_xact_lock(hashtextextended('settlement-domain:${eid}',0));select 'HELD';select pg_sleep(4);commit;`);await until(()=>hold.out().includes('HELD'));
const draftOps=[uuid('b249',8),uuid('b249',18)];const attempts=draftOps.map((op,i)=>start(`set application_name='q-v6-draft-${i}';select public.save_q_accounting_draft_v6('${actor}','${tid}','${eid}',${quote(JSON.stringify(request))},'${op}');`));
const oldConcurrent=start(`set application_name='q-v6-old-draft';select public.save_event_settlement_draft_v5('${actor}','${tid}','${eid}',${quote(JSON.stringify(oldRequest))},'${uuid('b249',30)}');`);
await until(()=>sql("select count(*)from pg_stat_activity where application_name in('q-v6-draft-0','q-v6-draft-1','q-v6-old-draft')and wait_event_type='Lock';")==='3');await hold.done;
const draftResponses=(await Promise.all(attempts.map(r=>r.done))).map(JSON.parse);assert.equal(draftResponses.filter(r=>r.status==='q_accounting_draft_saved_v6').length,1);assert.equal(draftResponses.filter(r=>r.code==='stale_version').length,1);
const oldRaceResponse=JSON.parse(await oldConcurrent.done);assert.equal(oldRaceResponse.code,'settlement_domain_conflict');assert.equal(sql(`select count(*)from app.event_settlement_drafts_v5 where event_id='${eid}';`),'0');
checks.push('observed three overlapping old/new draft connections waiting on event domain/standard/qualification locks: one v6 accepted, one stale, old v5 structured conflict and zero old liability rows');
const savedIndex=draftResponses.findIndex(r=>r.status==='q_accounting_draft_saved_v6'),recorded=draftResponses[savedIndex],savedOp=draftOps[savedIndex];
assert.deepEqual(call(request,savedOp),recorded);assert.equal(call({...request,reason:'changed'},savedOp).code,'idempotency_conflict');
assert.equal(call(request,uuid('b249',9)).code,'stale_version');assert.equal(call({...request,expectedVersion:1},uuid('b249',10)).code,'already_drafted');
w=ws();assert.equal(w.draft.current,true);assert.equal(w.draft.facts.participantReturnMinor,40800);assert.equal(w.draft.facts.benefitExpenseMinor,14400);assert.equal(w.draft.facts.operatingExpenseMinor,7200);
assert.equal(sql(`select count(*)from app.q_accounting_drafts_v6 where event_id='${eid}';`),'1');assert.equal(sql(`select count(*)from app.audit_events where tournament_id='${tid}' and action='q_accounting_v6_draft_unpaid';`),'1');
const rec=JSON.parse(sql(`select public.reconcile_q_accounting_v6('${actor}','${tid}','${eid}','${savedOp}',${quote(JSON.stringify(request))},'draft');`));assert.deepEqual(rec.result,recorded);
assert.equal(JSON.parse(sql(`select public.reconcile_q_accounting_v6('${actor}','${tid}','${eid}','${savedOp}',${quote(JSON.stringify({...request,reason:'changed'}))},'draft');`)).result.code,'idempotency_conflict');
const oldRejected=oldAttempt();assert.equal(oldRejected.code,'settlement_domain_conflict');assert.deepEqual(oldAttempt(),oldRejected);assert.equal(sql(`select count(*)from app.event_settlement_drafts_v5 where event_id='${eid}';`),'0');assert.equal(sql(`select count(*)from app.standard_singles_settlement_drafts where event_id='${eid}';`),'0');
checks.push('base-only85% independently enforced despite cash balance; malformed classes/cross-event denied; old v5 manual draft returns stable domain rejection and creates no duplicate liabilities');
checks.push('server-only exact immutable draft, source/review/expense tamper rejection, one draft/audit, identical and conflicting replay, different-key duplicate blocking, exact lost-response reconciliation');
const finalReq={draftId:recorded.draftId,draftVersion:1,expectedVersion:0,reason:'TEST ONLY finalized accounting remains unpaid',reviewed:true};
const final=(r,n)=>JSON.parse(sql(`select public.finalize_q_accounting_v6('${actor}','${tid}','${eid}',${quote(JSON.stringify(r))},'${uuid('c249',n)}');`));
assert.equal(final(finalReq,10).code,'crosscheck_incomplete');
const closure=JSON.parse(sql(`select public.finalize_cross_checking_v1('${actor}','${tid}','${uuid('d249',3)}');`));assert.equal(closure.status,'cross_checking_finalized');
const finalHold=start(`begin;select pg_advisory_xact_lock(hashtextextended('qualification-finalization:${eid}',0));select 'HELD';select pg_sleep(4);commit;`);await until(()=>finalHold.out().includes('HELD'));
const finalOps=[uuid('c249',11),uuid('c249',12)],finalRuns=finalOps.map((op,i)=>start(`set application_name='q-v6-final-${i}';select public.finalize_q_accounting_v6('${actor}','${tid}','${eid}',${quote(JSON.stringify(finalReq))},'${op}');`));
await until(()=>sql("select count(*)from pg_stat_activity where application_name in('q-v6-final-0','q-v6-final-1')and wait_event_type='Lock';")==='2');await finalHold.done;
const finalResponses=(await Promise.all(finalRuns.map(r=>r.done))).map(JSON.parse);assert.equal(finalResponses.filter(r=>r.status==='q_accounting_finalized_unpaid_v6').length,1);assert.equal(finalResponses.filter(r=>r.code==='already_finalized').length,1);
const finalIndex=finalResponses.findIndex(r=>r.status==='q_accounting_finalized_unpaid_v6'),finalized=finalResponses[finalIndex];assert.deepEqual(JSON.parse(sql(`select public.finalize_q_accounting_v6('${actor}','${tid}','${eid}',${quote(JSON.stringify(finalReq))},'${finalOps[finalIndex]}');`)),finalized);
assert.equal(final(finalReq,13).code,'already_finalized');assert.equal(call({...request,expectedVersion:1},uuid('b249',11)).code,'already_finalized');
w=ws();assert.equal(w.finalization.status,'unpaid');assert.equal(w.finalization.current,true);assert.equal(w.currentFinalVersion,1);
assert.equal(sql(`select count(*)from app.q_accounting_finals_v6 where event_id='${eid}';`),'1');assert.equal(sql(`select bool_and(status='unpaid')from app.q_accounting_drafts_v6 where event_id='${eid}';`),'t');
sql(`begin;do $$begin begin update app.q_accounting_finals_v6 set reason='changed'where event_id='${eid}';raise exception 'mutation allowed';exception when raise_exception then if sqlerrm='mutation allowed'then raise;end if;end;end$$;rollback;`);
checks.push('closure gate, once-only final accounting with all liabilities unpaid, no automatic money movement, immutable final history and exact final replay');
assert.equal(sql(`select count(*)from information_schema.role_table_grants where table_schema='app'and table_name in('q_accounting_drafts_v6','q_accounting_finals_v6')and grantee in('anon','authenticated','service_role');`),'0');
assert.equal(sql(`select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('get_q_accounting_workspace_v6','save_q_accounting_draft_v6','finalize_q_accounting_v6','reconcile_q_accounting_v6')and(has_function_privilege('anon',p.oid,'EXECUTE')or has_function_privilege('authenticated',p.oid,'EXECUTE'));`),'0');
// Store actual SQL responses before revocation for root's strict TypeScript bridge.
fs.writeFileSync('test-results/q-accounting-v6-api-contract.json',JSON.stringify({workspace:w,draftRequest:request,draftResult:recorded,finalRequest:finalReq,finalResult:finalized,reconciliation:rec},null,2));
// A supported source correction may stale immutable final history, but cannot
// create a second liability review or another final without a future reopen.
const correction=JSON.parse(sql(`select public.save_q_pool_membership_v1('${actor}','${tid}',(select request||jsonb_build_object('expectedVersion',version,'correction',true,'reason','TEST ONLY post-final same-value source correction')from app.q_pool_allocation_versions_v1 where tournament_id='${tid}'order by recorded_at,id limit 1),'${uuid('f249',20)}');`));assert.equal(correction.status,'q_pool_saved');
const changedReview=JSON.parse(sql(`select public.get_q_obligation_review_workspace_v2('${actor}','${tid}');`));assert.equal(changedReview.current,false);
const blockedReview=JSON.parse(sql(`select public.record_q_obligation_review_v2('${actor}','${tid}',${quote(JSON.stringify({...qrequest,expectedVersion:1,sourceDigest:changedReview.sourceDigest,reason:'TEST ONLY no reopen authorized'}))},'${uuid('f249',21)}');`));assert.equal(blockedReview.code,'settlement_finalized');
assert.equal(sql(`select count(*)from app.q_obligation_reviews_v2 where event_id='${eid}';`),'1');assert.equal(ws().finalization.current,false);
checks.push('same-value funding correction stales immutable final, post-final new Q review blocked, no second liability or automatic reopen');
sql(`delete from app.tournament_roles where tournament_id='${tid}'and profile_id='${actor}'and role='director';`);
assert.equal(call(request,savedOp).code,'not_director');assert.equal(sql(`select coalesce(public.reconcile_q_accounting_v6('${actor}','${tid}','${eid}','${savedOp}',${quote(JSON.stringify(request))},'draft')::text,'NULL');`),'NULL');
checks.push('private forced-RLS/service-only boundaries and revoked-director queued replay/reconciliation blocked');
sql('begin;set constraints all immediate;commit;');fs.writeFileSync('test-results/q-accounting-v6-sql-result.json',JSON.stringify({status:'passed',checks,tid,eid},null,2));console.log(JSON.stringify({status:'PASS',checks}));
