// LOCAL synthetic actor/database proof. No actual receipts, humans or payments.
import assert from 'node:assert/strict';
import {eighteenFixture}from'./eighteen-qualifying-local-acceptance.mjs';
import {verifySyntheticMixedEighteen}from'./synthetic-mixed-18-acceptance.mjs';
import {preparePrizeAccountingFixtureV8}from'./prize-accounting-v8-sql-acceptance.mjs';
export const mixedMainFinanceOp=n=>`a2960000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const j=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`;
export function mixedMainFinanceFixture(){
 const f=preparePrizeAccountingFixtureV8(eighteenFixture()),digital=[1,2,3,5,7,9],keep=new Set(digital.map(n=>f.rid(n)));
 f.setupSql=f.setupSql.replace("'Synthetic Qualification'","'TEST ONLY Mixed Main Finance'").replace(`'digital','${f.actor}'`,`case when n in(${digital})then'digital'else'paper'end,'${f.actor}'`);
 const profileExpr=`('${f.uid(1).slice(0,24)}'||lpad(n::text,12,'0'))::uuid`;
 assert.ok(f.setupSql.includes(profileExpr));f.setupSql=f.setupSql.replace(profileExpr,`case when n in(${digital})then ${profileExpr} else null end`);
 f.setupSql=f.setupSql.replace(/insert into app\.roster_account_links[\s\S]*?;/g,s=>[...keep].some(id=>s.includes(id))?s:'');
 const anchor='insert into app.ruleset_versions';assert.ok(f.setupSql.includes(anchor));
 const qrow=`insert into app.tournament_setup_q_pool_versions(id,tournament_id,setup_revision_id,setup_event_version_id,slot,pool_type_code,entry_fee_cents)select '${f.pool(1)}','${f.tid}',e.setup_revision_id,e.id,1,'Graduated (1-in-4)',1000 from app.tournament_setup_event_versions e where e.tournament_id='${f.tid}'and e.event_kind='main';`;
 f.setupSql=f.setupSql.replace(anchor,qrow+anchor);
 // These are predetermined LOCAL test outcomes, not predictions of human play.
 f.outcomeOverrides=[11,13,15].map(gameIndex=>({gameIndex,winnerSide:'a'}));
 const overrideIndices=new Set(f.outcomeOverrides.map(x=>x.gameIndex));
 const margins=[1,30,31,60,61,90,91,121];const expected=Array.from({length:18},(_,i)=>({number:i+1,participantId:f.pid(i+1),tournamentId:f.seat(i+1),gamePoints:0,wins:0,positive:0,negative:0}));
 for(const[i,g]of f.matches.entries()){
  const a=expected.find(x=>x.tournamentId===g.sideAVerificationId),b=expected.find(x=>x.tournamentId===g.sideBVerificationId),winner=overrideIndices.has(i)?a:i%2?b:a,loser=winner===a?b:a,margin=margins[i%8];
  winner.gamePoints+=margin>30?3:2;winner.wins++;winner.positive+=margin;loser.negative+=margin;
 }
 expected.sort((a,b)=>b.gamePoints-a.gamePoints||b.wins-a.wins||(b.positive-b.negative)-(a.positive-a.negative)||b.positive-a.positive);
 assert.deepEqual(expected.slice(0,6).map(x=>x.number),[5,9,13,2,6,16]);
 assert.equal(new Set(expected.filter(x=>![5,9].includes(x.number)).map(x=>[x.gamePoints,x.wins,x.positive].join(':'))).size,16,'all paid Q ranking keys distinct; unresolved cash-tie guard remains unchanged');
 f.expectedFinance=expected;f.qExcluded=new Set([5,9]);f.sidePool=mixedMainFinanceOp(1);
 return f;
}
export async function prepareMixedMainFinance({q,read,fixture:f}){
 const op=mixedMainFinanceOp,checks=[];
 assert.equal(read(`select app.prize_accounting_source_v9('${f.actor}','${f.tid}','${f.eid}') is not distinct from app.prize_accounting_source_before_mixed_main_v1('${f.actor}','${f.tid}','${f.eid}');`),true,'unenrolled source delegates unchanged to preserved native V9');
 const policy={action:'publish',poolVersionId:f.pool(1),method:'graduated-acc-weighted-largest-remainder-5usd-v2',ratio:4,scheduleId:'graduated-acc-weighted-largest-remainder-5usd-v2',disclosureReference:'TEST ONLY SYNTHETIC: reviewed app-owned exact fund conservation, not real payout approval',disclosed:true};
 assert.equal(read(`select public.save_q_operating_policy_v4('${f.actor}','${f.tid}',${j(policy)},'${op(2)}');`).status,'q_policy_published');
 assert.equal(read(`select public.add_event_side_pool_v1('${f.actor}','${f.tid}','${f.eid}','${f.sidePool}','TEST ONLY','TEST ONLY SYNTHETIC: Side',1000,'${op(3)}');`).status,'side_pool_added');
 const definition=read(`select to_jsonb(id)from app.event_side_pool_definition_versions where pool_id='${f.sidePool}'order by version desc limit 1;`);
 const amount=read(`select public.save_side_pool_graduated_policy_v2('${f.actor}','${f.tid}','${f.eid}','${f.sidePool}',${j({method:'graduated-acc-weighted-largest-remainder-5usd-v2',ratio:6,definitionVersionId:definition,disclosureReference:'TEST ONLY SYNTHETIC: app-owned conserved $5 awards',disclosed:true})},'${op(4)}');`);assert.equal(amount.status,'side_pool_graduated_policy_frozen');
 assert.equal(read(`select public.publish_side_pool_recipient_policy_v3('${f.actor}','${f.tid}','${f.eid}','${f.sidePool}',${j({amountPolicyId:amount.policyId,method:'paid-qualifying-cards-no-cutoff-v3',disclosureReference:'TEST ONLY SYNTHETIC: paid qualifying cards, not playoff cutoff',disclosed:true})},'${op(5)}');`).status,'side_pool_recipient_policy_frozen');
 q("insert into app.synthetic_mixed_deployments_v1 values('nnhcnvksxgxnpvdqjgpg','LOCAL mixed simulation only');");
 assert.throws(()=>q(`begin;select public.set_roster_payment_obligation_v1('${f.tid}','${f.rid(1)}',0,3000,'TEST ONLY SYNTHETIC: preexisting-record refusal probe','${op(8)}');select app.enroll_synthetic_mixed_finance_v1('${f.tid}','${f.eid}','nnhcnvksxgxnpvdqjgpg','must not adopt preexisting monetary evidence');commit;`),/mixed_finance_precollection_required/);
 assert.equal(read(`select count(*)from app.roster_payment_obligation_versions where tournament_id='${f.tid}';`),0);
 q(`select app.enroll_synthetic_mixed_finance_v1('${f.tid}','${f.eid}','nnhcnvksxgxnpvdqjgpg','LOCAL owner-approved simulated receipts/awards only');`);
 assert.equal(read("select has_function_privilege('service_role','app.enroll_synthetic_mixed_finance_v1(uuid,uuid,text,text)','EXECUTE');"),false);
 assert.equal(read("select has_function_privilege('authenticated','public.record_synthetic_mixed_receipt_v1(uuid,uuid,uuid,jsonb,uuid)','EXECUTE');"),false);
 const invoke=(name,req,n)=>read(`set role service_role;select public.${name}('${f.actor}','${f.tid}','${f.eid}',${j(req)},'${op(n)}');`);
 assert.throws(()=>q(`set role authenticated;select public.record_synthetic_mixed_expense_v1('${f.actor}','${f.tid}','${f.eid}','{}','${op(6)}');`),/permission denied/);
 assert.equal(read(`set role service_role;select public.record_synthetic_mixed_expense_v1('${f.uid(1)}','${f.tid}','${f.eid}','{}','${op(7)}');`),null);
 assert.throws(()=>q(`set role service_role;select app.enroll_synthetic_mixed_finance_v1('${f.tid}','${f.eid}','nnhcnvksxgxnpvdqjgpg','forbidden service re-enrollment');`),/permission denied/);
 assert.equal(read(`select public.record_manual_roster_payment('${f.tid}','${f.rid(1)}',0,4000,'USD','cash',now(),'TEST ONLY SYNTHETIC: premature direct receipt','${op(9)}');`).status,'rejected');
 const receivedAt=read('select to_jsonb(clock_timestamp());');
 for(let n=1;n<=18;n++){
  const elected=!f.qExcluded.has(n),reason='TEST ONLY SYNTHETIC: explicit fixture election; no actual consent or cash claimed';
  const consent=elected?`Q policy ${read(`select to_jsonb(id)from app.q_operating_policies_v2 where pool_version_id='${f.pool(1)}';`)}: TEST ONLY SYNTHETIC: fixture acknowledgment`:'';
  const membership={action:'membership',rosterEntryId:f.rid(n),expectedVersion:0,correction:false,reason,pools:[{poolVersionId:f.pool(1),elected,consentReference:consent}]};
  assert.equal(invoke('save_synthetic_mixed_q_membership_v1',membership,100+n).status,'q_pool_saved');
  assert.equal(invoke('record_synthetic_mixed_obligation_v1',{rosterEntryId:f.rid(n),expectedVersion:0,amountMinor:elected?4000:3000,reason},200+n).status,'payment_obligation_saved');
  if(n===1)assert.equal(read(`select public.record_manual_roster_payment('${f.tid}','${f.rid(1)}',0,4000,'USD','cash',now(),'TEST ONLY SYNTHETIC: direct bypass after obligation','${op(10)}');` ).code,'payment_recording_rejected');
  const receiptReq={rosterEntryId:f.rid(n),expectedVersion:0,amountMinor:elected?4000:3000,currency:'USD',paymentMethod:'cash',receivedAt,reason};
  const receipt=invoke('record_synthetic_mixed_receipt_v1',receiptReq,300+n);assert.equal(receipt.status,'payment_recorded',JSON.stringify(receipt));assert.deepEqual(invoke('record_synthetic_mixed_receipt_v1',receiptReq,300+n),receipt);
  const allocation={action:'allocation',rosterEntryId:f.rid(n),expectedVersion:0,correction:false,reason,
   membershipVersionId:read(`select to_jsonb(id)from app.q_pool_membership_versions_v1 where roster_entry_id='${f.rid(n)}'order by version desc limit 1;`),
   receiptId:read(`select to_jsonb(id)from app.roster_payment_events where roster_entry_id='${f.rid(n)}';`),obligationVersion:1,baseMinor:3000,pools:[{poolVersionId:f.pool(1),amountMinor:elected?1000:0}]};
  assert.equal(invoke('save_synthetic_mixed_q_membership_v1',allocation,400+n).status,'q_pool_saved');
  const side={poolId:f.sidePool,policyId:amount.policyId,participantId:f.pid(n),electionId:op(500+n),expectedVersion:0,elected:true,receivedMinor:1000,paymentMethod:'cash',paymentReference:'TEST ONLY SYNTHETIC: no actual cash received',reason};
  assert.equal(invoke('save_synthetic_mixed_side_election_v1',side,600+n).status,'side_pool_election_saved_v2');
 }
 const expense={amountMinor:5400,reason:'TEST ONLY SYNTHETIC: sanctioning'};
 // Fault injection is transaction-local in this disposable database. A native
 // accepted expense without mandatory provenance must roll back everything.
 assert.throws(()=>q(`begin;alter table app.tournament_expense_events disable trigger mixed_main_provenance_tournament_expense_events;select public.record_synthetic_mixed_expense_v1('${f.actor}','${f.tid}','${f.eid}',${j(expense)},'${op(700)}');commit;`),/mixed_main_provenance_atomicity_required/);
 assert.equal(read(`select count(*)from app.operation_receipts where actor_profile_id='${f.actor}'and client_operation_id='${op(700)}';`),0);
 assert.equal(read(`select count(*)from app.synthetic_mixed_main_requests_v1 where actor_id='${f.actor}'and operation_id='${op(700)}';`),0);
 assert.equal(invoke('record_synthetic_mixed_expense_v1',expense,700).status,'expense_recorded');
 const counts=read(`select jsonb_build_object('baseQReceipts',(select sum(amount_minor)from app.roster_payment_events where tournament_id='${f.tid}'and event_type='received'),'provenance',(select count(*)from app.synthetic_mixed_main_provenance_v1 where tournament_id='${f.tid}'),'falseClaims',(select count(*)from app.synthetic_mixed_main_provenance_v1 where tournament_id='${f.tid}'and(actual_money_received or money_moved or fictional_paper_play_claimed or independent_human_play_certified)));`);
 assert.equal(counts.baseQReceipts,70000);assert.equal(counts.falseClaims,0);
 checks.push('precollection scope precedes all18 simulated receipts/obligations/elections and one simulated expense; every new financial row annotated atomically; direct bypass denied');
 return{checks,invoke};
}

export async function verifyMixedMainFinance({q,read,startSession,fixture:f,cachedDraft}){
 const op=mixedMainFinanceOp,checks=[];
 const prepared=await prepareMixedMainFinance({q,read,fixture:f});checks.push(...prepared.checks);
 console.log('LOCAL mixed finance collection and atomic provenance checks complete');
 const expenseReq={amountMinor:5400,reason:'TEST ONLY SYNTHETIC: sanctioning'};
 const expenseSql=`select public.record_synthetic_mixed_expense_v1('${f.actor}','${f.tid}','${f.eid}',${j(expenseReq)},'${op(700)}');`;
 const sourceDriftSql=`insert into app.roster_entry_lifecycle_events(tournament_id,roster_entry_id,version,event_type,reason_code,note,actor_profile_id,operation_receipt_id)select '${f.tid}','${f.rid(1)}',1,'withdrawn','administrative_correction','LOCAL SOURCE DRIFT FAULT INJECTION; transaction always rolled back','${f.actor}',id from app.operation_receipts where actor_profile_id='${f.actor}'and client_operation_id='${op(700)}';`;
 const rejectedExpense={...expenseReq,amountMinor:-1};
 const rejected=prepared.invoke('record_synthetic_mixed_expense_v1',rejectedExpense,711);
 assert.equal(rejected.status,'rejected');
 assert.deepEqual(prepared.invoke('record_synthetic_mixed_expense_v1',rejectedExpense,711),rejected);
 assert.deepEqual(read(`begin;${sourceDriftSql}select public.record_synthetic_mixed_expense_v1('${f.actor}','${f.tid}','${f.eid}',${j(rejectedExpense)},'${op(711)}');rollback;`),rejected);
 // Exact owned replay remains available after source drift; a fresh operation
 // cannot use the changed roster. Both temporary changes roll back locally.
 const replay=prepared.invoke('record_synthetic_mixed_expense_v1',expenseReq,700);
 assert.deepEqual(read(`begin;${sourceDriftSql}${expenseSql}rollback;`),replay);
 assert.throws(()=>q(`begin;${sourceDriftSql}select public.record_synthetic_mixed_expense_v1('${f.actor}','${f.tid}','${f.eid}',${j(expenseReq)},'${op(710)}');commit;`),/mixed_finance_source_changed/);
 assert.equal(prepared.invoke('record_synthetic_mixed_expense_v1',{...expenseReq,amountMinor:5500},700).code,'idempotency_conflict');
 const holder=startSession(`begin;${expenseSql}select 'HOLDER_READY';select pg_sleep(2);commit;`,f.actor,'service_role','mixed-finance-holder');
 for(let n=0;n<100&&!holder.out().includes('HOLDER_READY');n++)await new Promise(resolve=>setTimeout(resolve,20));
 assert.ok(holder.out().includes('HOLDER_READY'));
 const waiter=startSession(`begin;${expenseSql}commit;`,f.actor,'service_role','mixed-finance-waiter');
 let blocked=false;for(let n=0;n<30;n++){if(read("select coalesce(bool_or(wait_event_type='Lock'),false)from pg_stat_activity where application_name='mixed-finance-waiter';")){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,20));}
 assert.ok(blocked);const results=await Promise.all([holder.done,waiter.done]);
 for(const result of results)assert.deepEqual(JSON.parse(result.split('\n').filter(line=>line.startsWith('{')).at(-1)),replay);
 assert.equal(read(`select count(*)from app.tournament_expense_events where tournament_id='${f.tid}';`),1);
 checks.push('actual service-role collection; owned replay before current-source checks; fresh source drift rejected; conflicting replay rejected; two PostgreSQL sessions serialize one expense receipt');
 console.log('LOCAL mixed finance role/source/replay/concurrency checks complete');
 for(const key of['seatingAttendanceSql','publishSql','startSql'])q(f[key]);
 // The ordinary scoring verifier adds only the scoring registry; this fixture
 // already has a separate finance registry. Avoid inserting its deployment twice.
 const scoringQ=(query,...args)=>q(query.startsWith('insert into app.synthetic_mixed_deployments_v1')?'select 1;':query,...args);
 const scoring=await verifySyntheticMixedEighteen({q:scoringQ,read,startSession,fixture:f,outcomeOverrides:f.outcomeOverrides,afterEnrollment:()=>q(`select app.bind_synthetic_mixed_finance_v1('${f.tid}','${f.eid}');`),closureDenialPattern:/mixed_main_context_required/});
 assert.deepEqual(scoring.expectedRawStandings,[...f.expectedFinance].sort((a,b)=>a.participantId.localeCompare(b.participantId)).map(x=>({participantId:x.participantId,recordedGames:12,wins:x.wins,gamePoints:x.gamePoints,positiveSpreadPoints:x.positive,negativeSpreadPoints:x.negative,netSpreadPoints:x.positive-x.negative})));
 checks.push('current complete108 mixed source: genuine actor-bound DD protocol, explicit PD synthetic acknowledgement, PP provenance, 216 reciprocal scorelines');
 const proof=read(`select app.synthetic_mixed_complete_source_v1('${f.tid}','${f.eid}');`);assert.ok(proof?.sourceDigest);
 assert.throws(()=>q(`insert into app.operational_game_forfeits(id,tournament_id,event_id,canonical_game_id,winner_participant_id,departing_participant_id,rule_case,director_reason,actor_profile_id,operation_receipt_id)select '${op(790)}',g.tournament_id,g.event_id,g.id,g.side_a_participant_id,g.side_b_participant_id,'early_departure_current_game','LOCAL unsupported-forfeit refusal probe','${f.actor}',r.id from app.canonical_games g cross join app.operation_receipts r where g.event_id='${f.eid}'and r.actor_profile_id='${f.actor}'and r.client_operation_id='${op(700)}'order by g.id limit 1;`),/mixed_main_context_required/);
 const artifact=kind=>read(`select to_jsonb(app.prepare_synthetic_mixed_main_artifact_v1('${f.actor}','${f.tid}','${f.eid}','${kind}','{}'));`);
 const close=artifact('close');const closeCall=()=>read(`select public.close_synthetic_mixed_main_v1('${f.actor}','${f.tid}','${f.eid}','${close}','${op(800)}');`);assert.equal(closeCall().status,'event_play_closed');assert.deepEqual(closeCall(),closeCall());
 const qualification=artifact('qualification');assert.equal(read(`select public.qualify_synthetic_mixed_main_v1('${f.actor}','${f.tid}','${f.eid}','${qualification}','${op(801)}');`).status,'qualification_finalized');
 const qualified=read(`select jsonb_agg(participant_id order by ranking_ordinal)from app.qualification_result_rows where event_id='${f.eid}'and qualification_status='qualified';`);
 assert.deepEqual(qualified,f.expectedFinance.slice(0,5).map(x=>x.participantId));
 const [a,b,c,d,e]=qualified,decision=[{winnerId:d,loserId:e},{winnerId:a,loserId:d},{winnerId:b,loserId:c},{winnerId:a,loserId:b}];
 const playoff=read(`select to_jsonb(app.prepare_synthetic_mixed_main_artifact_v1('${f.actor}','${f.tid}','${f.eid}','playoff',${j(decision)}));`);
 const pa=read(`select jsonb_build_object('id',id,'sha256',sha256,'payload',payload)from app.synthetic_mixed_main_artifacts_v1 where id='${playoff}';`);
 const req={...pa.payload,reason:'TEST ONLY SYNTHETIC: generated local playoff, no match physically played',reviewed:true,series:decision.map((s,i)=>({...s,evidenceNote:`SYNTHETIC-MIXED-MAIN-v1:${playoff}:${pa.sha256}:${i+1}`}))};
 const playoffs=read(`select public.record_synthetic_mixed_playoff_v1('${f.actor}','${f.tid}','${f.eid}','${playoff}',${j(req)},'${op(802)}');`);assert.equal(playoffs.status,'playoff_outcomes_recorded_v4');
 const qw=read(`select public.get_q_obligation_review_workspace_v2('${f.actor}','${f.tid}');`);assert.deepEqual(qw.blockers,[]);
 const qr={expectedVersion:0,sourceDigest:qw.sourceDigest,reason:'TEST ONLY SYNTHETIC: sixteen paid, three paid qualifiers plus highest paid nonqualifier',reviewed:true};
 assert.equal(prepared.invoke('review_synthetic_mixed_q_v1',qr,803).status,'q_obligations_recorded_v2');
 const qAwards=read(`select obligations from app.q_obligation_reviews_v2 where tournament_id='${f.tid}'order by version desc limit 1;`)[0].rows;
 assert.deepEqual(qAwards.map(x=>x.participantId),[13,2,6,16].map(n=>f.pid(n)),'three paid qualifiers plus highest paid nonqualifier');
 assert.deepEqual(qAwards.map(x=>x.amountMinor),[6500,5000,3000,1500]);
 assert.ok(qAwards.every(x=>![f.pid(5),f.pid(9)].includes(x.participantId)),'qualifiers who did not enter receive no Q award');
 const sw=read(`select public.get_side_pool_recipient_workspace_v3('${f.actor}','${f.tid}','${f.eid}','${f.sidePool}');`);assert.deepEqual(sw.blockers,[]);
 const sr={poolId:f.sidePool,expectedVersion:0,sourceDigest:sw.sourceDigest,reason:'TEST ONLY SYNTHETIC: reviewed paid qualifying scorecards',reviewed:true};
 assert.equal(prepared.invoke('review_synthetic_mixed_side_v1',sr,804).status,'side_pool_recipients_reviewed_unpaid');
 const sideAwards=read(`select obligations from app.side_pool_recipient_reviews_v3 where pool_id='${f.sidePool}'order by version desc limit 1;`);
 assert.deepEqual(sideAwards.map(x=>x.participantId),[5,9,13].map(n=>f.pid(n)));assert.deepEqual(sideAwards.map(x=>x.amountMinor),[9000,6000,3000]);
 const accounting=()=>read(`select public.get_prize_accounting_workspace_v9('${f.actor}','${f.tid}','${f.eid}');`);
 const aw=accounting();assert.deepEqual(aw.blockers,[],JSON.stringify(aw.blockers));
 assert.deepEqual([aw.facts.baseIncomeMinor,aw.facts.qIncomeMinor,aw.facts.sideIncomeMinor,aw.facts.receiptTotalMinor,aw.facts.expenseTotalMinor],[54000,16000,18000,88000,5400]);
 const classes=aw.facts.expenseEvidence.map(x=>({expenseEventId:x.expenseEventId,category:'sanctioning',evidenceReference:'TEST ONLY SYNTHETIC: explicit18×$3 assessment'}));
 const draftReq={expectedVersion:0,sourceDigest:aw.sourceDigest,expenseClassifications:classes,reason:'TEST ONLY SYNTHETIC: unpaid local accounting, no funds moved',reviewed:true};
 const draft=cachedDraft?await cachedDraft(draftReq):prepared.invoke('draft_synthetic_mixed_main_v1',draftReq,805);assert.equal(draft.status,'prize_accounting_draft_saved_v9');
 const post=accounting();assert.equal(post.sourceDigest,aw.sourceDigest,'output provenance must not stale its own input');assert.equal(post.draft.rounding.requiredFundingMinor,0);
 const cc=artifact('cross_check');assert.equal(read(`select public.crosscheck_synthetic_mixed_main_v1('${f.actor}','${f.tid}','${f.eid}','${cc}','${op(806)}');`).status,'cross_checking_finalized');
 assert.equal(accounting().sourceDigest,aw.sourceDigest,'crosscheck output annotation excluded from financial input');
 const finalReq={expectedVersion:0,draftId:draft.draftId,draftVersion:1,expectedFundingVersion:0,reason:'TEST ONLY SYNTHETIC: UNPAID final only; no payout/transfer',reviewed:true};
 const final=prepared.invoke('finalize_synthetic_mixed_main_v1',finalReq,807);assert.equal(final.status,'prize_accounting_finalized_unpaid_v9');assert.deepEqual(prepared.invoke('finalize_synthetic_mixed_main_v1',finalReq,807),final);
 const done=accounting();assert.equal(done.finalization.status,'unpaid');assert.equal(done.finalization.current,true);
 const regular=done.draft.awards.reduce((n,x)=>n+x.totalAwardMinor,0),qfund=16000,sidefund=18000,expense=5400,restricted=done.finalization.restrictedBalanceMinor;
 assert.equal(regular+qfund+sidefund+expense+restricted,88000);assert.equal(regular,48500);assert.equal(restricted,100);
 assert.equal(read(`select count(*)from app.synthetic_mixed_main_provenance_v1 where tournament_id='${f.tid}'and(actual_money_received or money_moved or fictional_paper_play_claimed or independent_human_play_certified);`),0);
 checks.push('source-bound mixed close/qualification/five-qualifier simulated playoffs/Q+Side reviews/crosscheck/UNPAID V9 final; no output-source self-staling');
 checks.push('simulated $880 incoming equals $54 expenses+$485 regular awards+$160 Q awards+$180 Side awards+$1 restricted balance; zero actual payments');
 assert.throws(()=>q(`begin;${sourceDriftSql}commit;`),/mixed_main_final_source_frozen/);
 checks.push('final source immutable; exact final receipt replay retained');
 return{checks,passed:checks.length,scoring,simulatedIncomingMinor:88000,regularAwardsMinor:regular,qAwardsMinor:qfund,sideAwardsMinor:sidefund,expensesMinor:expense,restrictedBalanceMinor:restricted,status:'unpaid',actualMoneyReceived:false,moneyMoved:false,actualHumanSessions:false};
}
