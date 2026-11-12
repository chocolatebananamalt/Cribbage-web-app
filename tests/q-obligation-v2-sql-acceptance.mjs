// LOCAL disposable fixture only. Root orchestrator owns container lifecycle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn,spawnSync}from'node:child_process';
import {foundation,actor,tid,eid,uuid,quote}from'./fixtures/q-review-foundation.mjs';
import {foundationV2}from'./fixtures/q-v2-foundation.mjs';
import {qChartSchedules}from'../src/lib/results/q-chart-catalog.ts';
const container=process.env.QV2_CONTAINER??'cribbage-qaccounting-local',database=process.env.QV2_DATABASE??'fixture_qaccounting';
if(!/^cribbage-[a-z0-9-]+-local$/.test(container)||!/^fixture_[a-z0-9_]+$/.test(database))throw Error('Explicit local fixture target required');
const args=['--context','desktop-linux','exec','-i',container,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1'];
const prefix="set role postgres;set request.jwt.claim.role='service_role';\n";
const sql=q=>{const r=spawnSync('docker',args,{input:prefix+q,encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw Error(r.stderr+'\n'+r.stdout);return r.stdout.trim();};
const checks=[];const catalog=qChartSchedules.flatMap(s=>s.cells);
const makeWorkspace=(fee,count,ratio=6,scheduleId='friend-q-p2-10-6-v1',method='graduated-paid-card-rank-v2')=>{
 const ids=Array.from({length:count},(_,i)=>uuid('f248',i+1)),pool=uuid('c248',1),policy=uuid('c248',2);
 return{tournamentId:tid,sourceDigest:'a'.repeat(64),blockers:[],policies:[{id:policy,poolVersionId:pool,method,ratio:method.startsWith('equal')?null:ratio,scheduleId:method.startsWith('equal')?null:scheduleId}],cuts:[],cards:ids.map((id,i)=>({participantId:id,gamePoints:2*(count-i),gamesWon:count-i,plusPoints:count-i,qualified:i<4,qualificationRank:i<4?i+1:null})),membership:{supported:true,pools:[{poolVersionId:pool,name:'TEST ONLY pool',feeMinor:fee}],entries:ids.map(id=>({participantId:id,displayName:'TEST ONLY '+id,receivedMinor:fee,allocationCurrent:true,pools:[{poolVersionId:pool,elected:true,prePlayElected:true,paidEntryEligible:true,amountAllocatedMinor:fee,consentReference:'Q policy '+policy+': TEST ONLY disclosed acknowledgment'}]}))}};
};
const calculate=w=>JSON.parse(sql(`select app.calculate_q_obligations_v2(${quote(JSON.stringify(w))}::jsonb);`));
assert.equal(JSON.parse(sql('select app.q_chart_catalog_v2();')).length,320);
const chartWorkspaces=catalog.map(cell=>makeWorkspace(cell.feeMinor,cell.paidCount,cell.ratio,cell.scheduleId));
const chartResults=JSON.parse(sql(`select jsonb_agg(app.calculate_q_obligations_v2(value)order by ord)from jsonb_array_elements(${quote(JSON.stringify(chartWorkspaces))}::jsonb)with ordinality as cases(value,ord);`));
assert.equal(chartResults.length,320);
for(const[i,cell]of catalog.entries()){const r=chartResults[i];assert.deepEqual(r.blockers,[],`chart ${cell.scheduleId}/${cell.paidCount}`);assert.deepEqual(r.obligations[0].rows.map(x=>x.amountMinor),cell.awardsMinor);assert.equal(r.obligations[0].fundMinor,cell.feeMinor*cell.paidCount);}
checks.push('all 320 exact database chart lookups match reviewed TypeScript catalog, recipient count and full pot conservation');
assert.deepEqual(calculate(makeWorkspace(1000,16)).obligations[0].rows.map(r=>r.amountMinor),[8000,5000,3000]);
const rankDown=makeWorkspace(1000,16);rankDown.membership.entries=rankDown.membership.entries.slice(3);rankDown.membership.pools[0].feeMinor=1000;
const rd=calculate(rankDown);assert.deepEqual(rd.obligations[0].rows.map(r=>r.participantId),[uuid('f248',4),uuid('f248',5),uuid('f248',6)]);assert.deepEqual(rd.obligations[0].rows.map(r=>r.amountMinor),[6500,4000,2500]);assert.equal(rd.obligations[0].rows[1].qualificationRank,null);
const equal=makeWorkspace(500,4,6,null,'equal-paid-playoff-qualifiers-v2');equal.cards[3].qualified=false;equal.cards[3].qualificationRank=null;
assert.deepEqual(calculate(equal).obligations[0].rows.map(r=>r.amountMinor),[667,667,666]);
const refund=makeWorkspace(1000,2,6,null,'equal-paid-playoff-qualifiers-v2');refund.cards.forEach(c=>{c.qualified=false;c.qualificationRank=null;});assert.equal(calculate(refund).obligations[0].kind,'refund');assert.deepEqual(calculate(refund).obligations[0].rows.map(r=>r.amountMinor),[1000,1000]);
const tied=makeWorkspace(1000,16);Object.assign(tied.cards[1],{gamePoints:tied.cards[0].gamePoints,gamesWon:tied.cards[0].gamesWon,plusPoints:tied.cards[0].plusPoints});tied.cuts=[{participantIdsLowFirst:[tied.cards[1].participantId,tied.cards[0].participantId],recordedBy:actor,reason:'TEST ONLY old cut'}];assert.deepEqual(calculate(tied).blockers,['q_cash_tie_unresolved']);
const stale=makeWorkspace(1000,16);stale.membership.entries[0].allocationCurrent=false;assert.deepEqual(calculate(stale).blockers,['funding_unresolved']);
const partial=makeWorkspace(1000,16);partial.membership.entries[0].pools[0].amountAllocatedMinor=500;assert.deepEqual(calculate(partial).blockers,['funding_unresolved']);
assert.deepEqual(calculate(makeWorkspace(1000,4)).blockers,['chart_review_required']);
checks.push('graduated16 and rank-down13 goldens, equal odd cents, no-qualified contributor refunds, old cuts blocked, partial/stale funding and out-of-chart blocking');

// Real supported policy/election/receipt/allocation and complete verified-game foundation.
const seed=foundationV2({pool1People:Array.from({length:16},(_,i)=>i+1),pool1Fee:1000,pool1Type:'Graduated (1-in-6)'});
sql(seed);sql('set constraints all immediate;');
const workspace=(who=actor)=>JSON.parse(sql(`select public.get_q_obligation_review_workspace_v2('${who}','${tid}');`)||'null');
let w=workspace();assert.deepEqual(w?.blockers,[],JSON.stringify(w));assert.equal(w.currentVersion,0);assert.deepEqual(w.preview[0].rows.map(r=>r.amountMinor),[8000,5000,3000]);assert.equal(w.preview[1].kind,'refund');
const request={expectedVersion:0,sourceDigest:w.sourceDigest,reason:'TEST ONLY exact unpaid Q v2 review',reviewed:true};
const call=(r,op,who=actor,tournament=tid)=>`public.record_q_obligation_review_v2('${who}','${tournament}',${quote(JSON.stringify(r))},'${op}')`;
const money=()=>sql(`select jsonb_build_object('receipts',(select jsonb_agg(to_jsonb(x)order by id)from app.roster_payment_events x where tournament_id='${tid}'),'allocations',(select jsonb_agg(to_jsonb(x)order by id)from app.q_pool_allocation_versions_v1 x where tournament_id='${tid}'))::text;`);
const before=money();
function start(q){const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);const done=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',code=>code?reject(Error(err)):resolve(out.trim()));});p.stdin.end(prefix+q);return{done,out:()=>out};}
async function until(check){for(let i=0;i<80;i++){if(check())return;await new Promise(r=>setTimeout(r,50));}throw Error('Real request overlap not observed');}
const held=start(`begin;select pg_advisory_xact_lock(hashtextextended('qualification-finalization:${eid}',0));select'HELD';select pg_sleep(4);commit;`);await until(()=>held.out().includes('HELD'));
const ops=[uuid('e248',1),uuid('e248',2)];const writers=ops.map((op,i)=>start(`set application_name='q-v2-review-${i}';select ${call(request,op)};`));
await until(()=>sql("select count(*)from pg_stat_activity where application_name in('q-v2-review-0','q-v2-review-1')and wait_event_type='Lock';")==='2');await held.done;
const results=(await Promise.all(writers.map(r=>r.done))).map(JSON.parse);assert.equal(results.filter(r=>r.status==='q_obligations_recorded_v2').length,1);assert.equal(results.filter(r=>r.code==='stale_version').length,1);
const acceptedIndex=results.findIndex(r=>r.status==='q_obligations_recorded_v2'),result=results[acceptedIndex],op=ops[acceptedIndex];
assert.deepEqual(JSON.parse(sql('select '+call(request,op)+';')),result);assert.equal(JSON.parse(sql('select '+call({...request,reason:'changed'},op)+';')).code,'idempotency_conflict');
assert.equal(JSON.parse(sql('select '+call({...request,expectedVersion:1},uuid('e248',3))+';')).code,'already_reviewed');
assert.equal(sql(`select count(*)from app.q_obligation_reviews_v2 where event_id='${eid}';`),'1');assert.equal(sql(`select count(*)from app.audit_events where tournament_id='${tid}'and action='q_obligations_v2_recorded_unpaid';`),'1');
w=workspace();assert.equal(w.current,true);assert.equal(w.history.length,1);assert.deepEqual(w.history[0].obligations,w.preview);assert.equal(w.history[0].status,'unpaid');assert.equal(money(),before);
const persistedAmounts=w.history[0].obligations.flatMap(p=>p.rows.map(r=>r.amountMinor));assert.deepEqual(persistedAmounts.slice().sort((a,b)=>a-b),[1000,3000,5000,8000]);assert.equal(persistedAmounts.reduce((n,v)=>n+v,0),17000);
assert.equal(sql(`select count(*)from app.q_obligation_reviews_v2 where tournament_id='${tid}'and status<>'unpaid';`),'0');
const otherTid=uuid('b248',99);assert.equal(sql('select coalesce('+call(request,uuid('e248',80),actor,otherTid)+'::text,\'NULL\');'),'NULL');
assert.equal(sql(`select coalesce(public.get_q_obligation_review_workspace_v2('${actor}','${otherTid}')::text,'NULL');`),'NULL');
sql(`begin;do $$begin begin insert into app.q_obligation_reviews_v1(tournament_id,event_id,version,source_digest,source_manifest,obligations,status,reason,actor_id,operation_receipt_id)select tournament_id,event_id,1,source_digest,source_manifest,obligations,status,'TEST ONLY forbidden v1 domain',actor_id,operation_receipt_id from app.q_obligation_reviews_v2 where event_id='${eid}';raise exception'domain insert unexpectedly accepted';exception when raise_exception then if sqlerrm is distinct from'q_review_domain_conflict'then raise;end if;end;end$$;rollback;`);
checks.push('real 16-player policies/funding/qualification: observed concurrent requests, one immutable unpaid review/audit, exact replay and same-source different-key duplicate rejection, unchanged funding');
const reconcile=r=>JSON.parse(sql(`select public.get_q_obligation_review_reconciliation_v2('${actor}','${tid}','${op}',${quote(JSON.stringify(r))});`));
assert.deepEqual(reconcile(request).result,result);assert.equal(reconcile({...request,reason:'different attestation'}).result.code,'idempotency_conflict');
sql(`begin;do $$declare w jsonb;r jsonb;begin
perform set_config('request.jwt.claim.role','',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);
w:=public.get_q_obligation_review_workspace_v2('${actor}','${tid}');if w->>'current'is distinct from'true'then raise exception'JSON-only service context denied';end if;
r:=${call(request,op)};if r is distinct from ${quote(JSON.stringify(result))}::jsonb then raise exception'JSON-only exact replay denied';end if;
r:=public.get_q_obligation_review_reconciliation_v2('${actor}','${tid}','${op}',${quote(JSON.stringify(request))});if r->'result'is distinct from ${quote(JSON.stringify(result))}::jsonb then raise exception'JSON-only reconciliation denied';end if;
perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
if public.get_q_obligation_review_workspace_v2('${actor}','${tid}')is not null or ${call(request,op)}is not null or public.get_q_obligation_review_reconciliation_v2('${actor}','${tid}','${op}',${quote(JSON.stringify(request))})is not null then raise exception'wrong service context accepted';end if;
perform set_config('request.jwt.claims','',true);
if public.get_q_obligation_review_workspace_v2('${actor}','${tid}')is not null or ${call(request,op)}is not null or public.get_q_obligation_review_reconciliation_v2('${actor}','${tid}','${op}',${quote(JSON.stringify(request))})is not null then raise exception'missing service context accepted';end if;
end$$;rollback;`);
checks.push('modern JSON-only service claims accepted; missing and human-role contexts denied on all three RPCs');
assert.equal(workspace('a1310000-0000-4000-8000-000000000006'),null);assert.equal(sql('select coalesce('+call(request,uuid('e248',4),'a1310000-0000-4000-8000-000000000006')+'::text,\'NULL\');'),'NULL');
assert.equal(sql(`select count(*)from information_schema.role_table_grants where table_schema='app'and table_name='q_obligation_reviews_v2'and grantee in('anon','authenticated','service_role');`),'0');
assert.equal(sql(`select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('get_q_obligation_review_workspace_v2','record_q_obligation_review_v2','get_q_obligation_review_reconciliation_v2')and(has_function_privilege('authenticated',p.oid,'EXECUTE')or has_function_privilege('anon',p.oid,'EXECUTE'));`),'0');
sql(`begin;do $$begin begin update app.q_obligation_reviews_v2 set reason='bad'where event_id='${eid}';raise exception'not immutable';exception when raise_exception then if sqlerrm='not immutable'then raise;end if;end;end$$;rollback;`);
checks.push('full retained request reconciliation, unauthorized reader/writer, private table/RPC ACLs and immutable history');
sql(`begin;select set_config('request.jwt.claim.sub','${actor}',true),set_config('request.jwt.claim.role','authenticated',true);do $$declare pay app.roster_payment_events%rowtype;r jsonb;before_row jsonb;begin
select*into pay from app.roster_payment_events where tournament_id='${tid}'and roster_entry_id='${uuid('d243',1)}'order by version desc limit 1;
select to_jsonb(x)into before_row from app.q_obligation_reviews_v2 x where event_id='${eid}';
r:=public.void_manual_roster_payment('${tid}','${uuid('d243',1)}',pay.version,pay.id,'TEST ONLY receipt void invalidation','${uuid('e248',82)}');if r->>'status'is distinct from'payment_voided'then raise exception'void failed %',r;end if;
perform set_config('request.jwt.claim.role','service_role',true);r:=public.get_q_obligation_review_workspace_v2('${actor}','${tid}');if r->>'current'is distinct from'false'or not(r->'blockers'? 'funding_unresolved')then raise exception'void source remained current %',r;end if;
perform set_config('request.jwt.claim.role','authenticated',true);r:=public.record_manual_roster_payment('${tid}','${uuid('d243',1)}',pay.version+1,4000,'USD','cash',now(),'TEST ONLY replacement receipt no money','${uuid('e248',83)}');if r->>'status'is distinct from'payment_recorded'then raise exception'replacement failed %',r;end if;
perform set_config('request.jwt.claim.role','service_role',true);r:=public.get_q_obligation_review_workspace_v2('${actor}','${tid}');if r->>'current'is distinct from'false'or not(r->'blockers'? 'funding_unresolved')then raise exception'replacement source remained current %',r;end if;
if(select to_jsonb(x)from app.q_obligation_reviews_v2 x where event_id='${eid}')is distinct from before_row then raise exception'history changed after receipt revisions';end if;
end$$;set constraints all immediate;rollback;`);
assert.equal(workspace().current,true);assert.equal(money(),before);
checks.push('real void/replacement receipts invalidate eligibility/current review without mutating unpaid history; rollback restores original funding');
// Identical reasoned allocation correction changes source even when dollars do not.
const correction=JSON.parse(sql(`select public.save_q_pool_membership_v1('${actor}','${tid}',(select request||jsonb_build_object('expectedVersion',1,'correction',true,'reason','TEST ONLY reasoned source revision')from app.q_pool_allocation_versions_v1 where tournament_id='${tid}'order by roster_entry_id limit 1),'${uuid('e248',5)}');`));
assert.equal(correction.status,'q_pool_saved');const changed=workspace();assert.equal(changed.current,false);assert.notEqual(changed.sourceDigest,w.sourceDigest);assert.equal(JSON.parse(sql('select '+call({...request,expectedVersion:1},uuid('e248',6))+';')).code,'source_changed');
const superseding={...request,expectedVersion:1,sourceDigest:changed.sourceDigest,reason:'TEST ONLY reasoned supersession'};assert.equal(JSON.parse(sql('select '+call(superseding,uuid('e248',7))+';')).status,'q_obligations_recorded_v2');assert.equal(workspace().history.length,2);assert.equal(workspace().history[0].supersedesId,result.reviewId);
checks.push('same-money funding correction invalidates currentness, stale source rejected and reasoned supersession appends history');
fs.writeFileSync('test-results/q-obligation-v2-backend-contract.json',JSON.stringify(workspace(),null,2));
// Preserve an independently seeded historical v1 tenant; never reinterpret it.
const oldActor=actor.replace('1310000','1610000'),oldTid=tid.replace('1310000','1610000'),oldEid=eid.replace('1310000','1610000');
const oldFoundation=foundation().replaceAll('1310000','1610000').replaceAll('2430000','2630000').replaceAll('2450000','2650000').replaceAll('@test.invalid','-legacy-domain@test.invalid');
sql(oldFoundation);const oldWorkspace=JSON.parse(sql(`select public.get_q_obligation_review_workspace_v1('${oldActor}','${oldTid}');`));assert.deepEqual(oldWorkspace.blockers,[]);
const oldRequest={expectedVersion:0,sourceDigest:oldWorkspace.sourceDigest,reason:'TEST ONLY preserved historical v1 review',reviewed:true};
assert.equal(JSON.parse(sql(`select public.record_q_obligation_review_v1('${oldActor}','${oldTid}',${quote(JSON.stringify(oldRequest))},'${uuid('e248',90)}');`)).status,'q_obligations_recorded');
const legacyBefore=sql(`select to_jsonb(r)::text from app.q_obligation_reviews_v1 r where event_id='${oldEid}';`);
const preserved=JSON.parse(sql(`select public.get_q_obligation_review_workspace_v2('${oldActor}','${oldTid}');`));assert.ok(preserved.blockers.includes('legacy_review_preserved'));
assert.equal(JSON.parse(sql('select '+call({...request,sourceDigest:preserved.sourceDigest},uuid('e248',91),oldActor,oldTid)+';')).code,'source_blocked');
sql(`begin;do $$begin begin insert into app.q_obligation_reviews_v2(tournament_id,event_id,version,source_digest,source_manifest,obligations,status,reason,actor_id,operation_receipt_id)select tournament_id,event_id,1,source_digest,source_manifest,obligations,status,'TEST ONLY forbidden v2 domain',actor_id,operation_receipt_id from app.q_obligation_reviews_v1 where event_id='${oldEid}';raise exception'domain insert unexpectedly accepted';exception when raise_exception then if sqlerrm is distinct from'q_review_domain_conflict'then raise;end if;end;end$$;rollback;`);
assert.equal(sql(`select to_jsonb(r)::text from app.q_obligation_reviews_v1 r where event_id='${oldEid}';`),legacyBefore);assert.equal(sql(`select count(*)from app.q_obligation_reviews_v2 where event_id='${oldEid}';`),'0');
checks.push('v1/v2 domain exclusion both directions, preserved historical v1 review byte-identical and no duplicate active liability');
// Observe a supported receipt writer and unpaid review competing for the same
// tournament row. Either serialization is valid; a stale review is never current.
const raceActor=actor.replace('1310000','1710000'),raceTid=tid.replace('1310000','1710000'),raceEid=eid.replace('1310000','1710000'),raceRoster=uuid('d273',1);
sql(foundationV2().replaceAll('1310000','1710000').replaceAll('2430000','2730000').replaceAll('2450000','2750000').replaceAll('@test.invalid','-receipt-race@test.invalid'));
const raceWorkspace=()=>JSON.parse(sql(`select public.get_q_obligation_review_workspace_v2('${raceActor}','${raceTid}');`));
const raceW=raceWorkspace();assert.deepEqual(raceW.blockers,[]);assert.equal(raceW.currentVersion,0);
const raceRequest={expectedVersion:0,sourceDigest:raceW.sourceDigest,reason:'TEST ONLY observed receipt/review overlap',reviewed:true};
const racePayment=JSON.parse(sql(`select jsonb_build_object('id',id,'version',version)from app.roster_payment_events where tournament_id='${raceTid}'and roster_entry_id='${raceRoster}'order by version desc limit 1;`));
const heldTournament=start(`begin;select id from app.tournaments where id='${raceTid}'for update;select'HELD';select pg_sleep(4);commit;`);await until(()=>heldTournament.out().includes('HELD'));
const reviewRace=start(`set application_name='q-v2-receipt-review';select ${call(raceRequest,uuid('e248',100),raceActor,raceTid)};`);
const voidRace=start(`set application_name='q-v2-receipt-void';begin;set local request.jwt.claim.sub='${raceActor}';set local request.jwt.claim.role='authenticated';select public.void_manual_roster_payment('${raceTid}','${raceRoster}',${racePayment.version},'${racePayment.id}','TEST ONLY observed concurrent void','${uuid('e248',101)}');commit;`);
await until(()=>sql("select count(*)from pg_stat_activity where application_name in('q-v2-receipt-review','q-v2-receipt-void')and wait_event_type='Lock';")==='2');await heldTournament.done;
const[reviewRaceResult,voidRaceResult]=(await Promise.all([reviewRace.done,voidRace.done])).map(JSON.parse);assert.equal(voidRaceResult.status,'payment_voided');
const raceAfter=raceWorkspace();assert.equal(raceAfter.current,false);assert.ok(raceAfter.blockers.includes('funding_unresolved'));
const acceptedReview=reviewRaceResult.status==='q_obligations_recorded_v2';if(!acceptedReview)assert.ok(['source_blocked','source_changed'].includes(reviewRaceResult.code),JSON.stringify(reviewRaceResult));
assert.notEqual(raceAfter.sourceDigest,raceW.sourceDigest);if(acceptedReview){assert.equal(raceAfter.history[0].sourceDigest,raceW.sourceDigest);assert.deepEqual(raceAfter.history[0].obligations,raceW.preview);}
assert.equal(Number(sql(`select count(*)from app.q_obligation_reviews_v2 where event_id='${raceEid}';`)),acceptedReview?1:0);
assert.equal(Number(sql(`select count(*)from app.audit_events where tournament_id='${raceTid}'and action='q_obligations_v2_recorded_unpaid';`)),acceptedReview?1:0);
assert.equal(sql(`select count(*)from app.roster_payment_events where tournament_id='${raceTid}'and roster_entry_id='${raceRoster}';`),'2');
assert.equal(sql(`select count(*)from app.q_obligation_reviews_v2 where event_id='${raceEid}'and status<>'unpaid';`),'0');
checks.push('observed supported receipt void/review overlap: both connections wait on tournament lock, serialization rejects or immediately stales review, once-only unpaid history/audit and one void');
sql(`delete from app.tournament_roles where tournament_id='${tid}'and profile_id='${actor}'and role='director';`);assert.equal(workspace(),null);assert.equal(sql('select coalesce('+call(request,op)+'::text,\'NULL\');'),'NULL');assert.equal(sql(`select coalesce(public.get_q_obligation_review_reconciliation_v2('${actor}','${tid}','${op}',${quote(JSON.stringify(request))})::text,'NULL');`),'NULL');
checks.push('revoked queued replay and reconciliation denied');
fs.writeFileSync('test-results/q-obligation-v2-sql-result.json',JSON.stringify({status:'PASS',checks,results},null,2));console.log(JSON.stringify({status:'PASS',checks}));
