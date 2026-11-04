// LOCAL ONLY. The parent runner owns the reviewed isolated database/container.
// This module uses only its supplied SQL adapter and fictional fixture identities.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {quote}from'./fixtures/q-review-foundation.mjs';
import {isPrizeAccountingWorkspaceV8,isPrizeAccountingResultV8,prizeAccountingResultMatchesV8}from'../src/lib/api/prize-accounting-v8.ts';

/** Call BEFORE setup/finance. Never amend an already collected event's policy. */
export function preparePrizeAccountingFixtureV8(f){
 const oldKind='"kind":"director-selected-five-qualifier-prize-schedule-v2"',oldRounding='"roundingRule":"floor_each_weighted_share_then_assign_remainder_to_champion"';
 assert.equal(f.setupSql.split(oldKind).length-1,1,'Expected one precollection regular schedule');
 assert.equal(f.setupSql.split(oldRounding).length-1,1,'Expected one precollection rounding rule');
 return{...f,setupSql:f.setupSql.replace(oldKind,'"kind":"regular-prize-cohort-5usd-v3"').replace(oldRounding,'"roundingRule":"automatic-five-dollar-cohort-v3"')};
}

/** Prerequisites: fresh V3 policy fixture through supported qualification and
 * reviewed v4 playoff outcomes; no accounting drafts/finals, expenses or Q review.
 * down=false: original280.50 ->285,benefit153,explicit450cover.
 * down=true: original280.50 ->280,benefit156,restricted50,no funding.
 * SQL actor/setup baselines remain explicitly synthetic, not real human review.
 */
export async function verifyPrizeAccountingV8({sql,race,fixture:f,down=false}){
 const{actor,tid,eid}=f,checks=[];
 const op=n=>`e257${eid.slice(0,4)}-${eid.slice(4,8)}-4000-8000-${String(n).padStart(12,'0')}`;
 const json=q=>JSON.parse(sql(q).split('\n').filter(Boolean).at(-1)||'null');
 const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
 const callSql=(action,r,key,who=actor,tournament=tid,event=eid)=>`select public.${{draft:'save_prize_accounting_draft_v8',funding:'record_prize_rounding_funding_v8',void_funding:'void_prize_rounding_funding_v8',final:'finalize_prize_accounting_v8'}[action]}('${who}','${tournament}','${event}',${quote(JSON.stringify(r))},'${key}');`;
 const call=(...args)=>json(callSql(...args));
 const reconcile=(action,r,key,who=actor,event=eid)=>json(`select public.reconcile_prize_accounting_v8('${who}','${tid}','${event}','${key}','${action}',${quote(JSON.stringify(r))});`);
 const read=()=>json(`select public.get_prize_accounting_workspace_v8('${actor}','${tid}','${eid}');`);
 const financialAndScoreIdentity=()=>sql(`select jsonb_build_object('payments',(select jsonb_agg(to_jsonb(x)order by id)from app.roster_payment_events x where tournament_id='${tid}'),'owed',(select jsonb_agg(to_jsonb(x)order by id)from app.roster_payment_obligation_versions x where tournament_id='${tid}'),'allocations',(select jsonb_agg(to_jsonb(x)order by id)from app.q_pool_allocation_versions_v1 x where tournament_id='${tid}'),'qualification',(select jsonb_agg(to_jsonb(x)order by id)from app.qualification_result_versions x where event_id='${eid}'),'qualificationRows',(select jsonb_agg(to_jsonb(x)order by ranking_ordinal)from app.qualification_result_rows x where event_id='${eid}'),'scores',(select jsonb_agg(to_jsonb(x)order by line_id)from app.current_effective_scorelines('${tid}','${eid}')x));`);
 assert.equal(sql(`select count(*)from app.canonical_games where event_id='${eid}';`),'102');
 assert.equal(sql(`select count(*)from app.prize_accounting_drafts_v8 where event_id='${eid}';`),'0');
 assert.equal(sql(`select count(*)from app.tournament_expense_events where tournament_id='${tid}';`),'0');
 const originalIdentity=financialAndScoreIdentity();
 const expenses=[[1,5100,'sanctioning'],[2,down?10500:10200,'meals'],[3,down?4800:5100,'hall_rental'],[4,2550,'cards']];
 for(const[n,amount,category]of expenses){const r=json(`select set_config('request.jwt.claim.sub','${actor}',false);select public.record_tournament_expense('${tid}',${amount},'USD','TEST ONLY ${category}','${op(n)}');`);assert.equal(r.status,'expense_recorded');}
 const hasQ=sql(`select exists(select 1 from app.tournament_setup_q_pool_versions where tournament_id='${tid}');`)==='t';
 if(hasQ){
  const q=json(`select public.get_q_obligation_review_workspace_v2('${actor}','${tid}');`);assert.deepEqual(q.blockers,[],JSON.stringify(q));assert.equal(q.currentVersion,0);
  const request={expectedVersion:0,sourceDigest:q.sourceDigest,reason:'TEST ONLY current Q liabilities remain separate from regular rounding',reviewed:true};
  assert.equal(json(`select public.record_q_obligation_review_v2('${actor}','${tid}',${quote(JSON.stringify(request))},'${op(10)}');`).status,'q_obligations_recorded_v2');
  if(f.policyRequest){assert.deepEqual(q.preview.map(p=>p.fundMinor),[16000,1000]);assert.deepEqual(q.preview[0].rows.map(r=>r.amountMinor),[8000,5500,2500]);}
 }else assert.equal(sql(`select count(*)from app.q_obligation_reviews_v2 where tournament_id='${tid}';`),'0');
 let w=read();assert.ok(isPrizeAccountingWorkspaceV8(w,tid,eid),JSON.stringify(w));assert.deepEqual(w.blockers,[]);assert.equal(w.facts.regularAwardMinor,28050);assert.equal(w.facts.expenseTotalMinor,22950);assert.equal(w.regularRule.rule.kind,'regular-prize-cohort-5usd-v3');
 const classes=w.facts.expenseEvidence.map(e=>({expenseEventId:e.expenseEventId,category:e.description.replace('TEST ONLY ',''),evidenceReference:'TEST ONLY source-supported synthetic expense classification'}));
 const draftRequest={expectedVersion:0,sourceDigest:w.sourceDigest,expenseClassifications:classes,reason:'TEST ONLY standing whole-five regular awards; liabilities unpaid',reviewed:true};
 assert.equal(call('draft',{...draftRequest,awards:[28500]},op(11)).code,'invalid_request');
 assert.equal(call('draft',{...draftRequest,sourceDigest:'b'.repeat(64)},op(12)).code,'source_changed');
 let draft,draftOp=op(13);
 if(race){const keys=[draftOp,op(14)],results=await race(keys.map(key=>callSql('draft',draftRequest,key)),eid,'save_prize_accounting_draft_v8');const accepted=results.findIndex(r=>r.status==='prize_accounting_draft_saved_v8');assert.notEqual(accepted,-1);assert.equal(results.filter(r=>r.code==='stale_version').length,1);draft=results[accepted];draftOp=keys[accepted];checks.push('observed overlapping different-operation drafts: one version and one stale receipt');}
 else draft=call('draft',draftRequest,draftOp);
 assert.equal(draft.status,'prize_accounting_draft_saved_v8');assert.ok(isPrizeAccountingResultV8(draft,eid)&&prizeAccountingResultMatchesV8(draft,'draft',draftRequest));
 assert.deepEqual(call('draft',draftRequest,draftOp),draft);assert.deepEqual(reconcile('draft',draftRequest,draftOp),{authorized:true,result:draft});
 assert.equal(call('draft',{...draftRequest,reason:'TEST ONLY altered retained reason'},draftOp).code,'idempotency_conflict');
 assert.equal(reconcile('draft',{...draftRequest,reason:'TEST ONLY altered retained reason'},draftOp).result.code,'idempotency_conflict');
 assert.equal(call('draft',{...draftRequest,expectedVersion:1},op(15)).code,'already_drafted');
 w=read();assert.ok(isPrizeAccountingWorkspaceV8(w,tid,eid),JSON.stringify(w));assert.equal(w.currentDraftVersion,1);assert.equal(w.draft.current,true);
 assert.equal(w.draft.rounding.originalBudgetMinor,28050);assert.equal(w.draft.rounding.roundedBudgetMinor,down?28000:28500);assert.equal(w.draft.rounding.adjustmentMinor,down?-50:450);assert.equal(w.draft.rounding.requiredFundingMinor,down?0:450);assert.equal(w.draft.rounding.restrictedBalanceMinor,down?50:0);assert.equal(w.draft.rounding.benefitExpenseMinor,down?15600:15300);assert.equal(w.draft.rounding.participantReturnMinor,down?43600:43800);
 assert.equal(w.draft.awards.reduce((n,a)=>n+a.totalAwardMinor,0),down?28000:28500);assert.ok(w.draft.awards.every(a=>a.totalAwardMinor>=500&&a.totalAwardMinor%500===0));assert.equal(w.draft.awards[2].totalAwardMinor,w.draft.awards[3].totalAwardMinor);
 checks.push(`${hasQ?'separate Q':'genuine no-Q'}:original280.50 ->${down?'280/restricted0.50':'285/unfunded4.50'};same-round awards equal,85% independent,all awards500multiples`);
 const oldWorkspace=json(`select public.${hasQ?'get_q_accounting_workspace_v6':'get_no_q_accounting_workspace_v7'}('${actor}','${tid}','${eid}');`);
 const oldRequest={expectedVersion:0,sourceDigest:oldWorkspace.sourceDigest,scheduleVersionId:w.regularRule.scheduleVersionId,reason:'TEST ONLY old writer must not bypass standing rounding policy',expenseClassifications:classes,reviewed:true,...(hasQ?{qReviewId:w.qReview.id}:{})};
 const oldAttempt=json(`select public.${hasQ?'save_q_accounting_draft_v6':'save_no_q_accounting_draft_v7'}('${actor}','${tid}','${eid}',${quote(JSON.stringify(oldRequest))},'${op(16)}');`);
 assert.equal(oldAttempt.status,'rejected');
 assert.equal(sql(`select(select count(*)from app.q_accounting_drafts_v6 where event_id='${eid}')+(select count(*)from app.no_q_accounting_drafts_v7 where event_id='${eid}');`),'0');
 checks.push('old v6/v7 writer cannot bypass the new standing rounding policy or create duplicate regular liabilities');
 const finalRequest=()=>({expectedVersion:0,draftId:draft.draftId,draftVersion:1,expectedFundingVersion:read().funding.version,reason:'TEST ONLY final unpaid accounting; no transfer or payout',reviewed:true});
 if(!down)assert.equal(call('final',finalRequest(),op(20)).code,'funding_shortfall');
 const fundingRequest=(amount,version)=>({expectedVersion:version,sourceDigest:w.sourceDigest,draftId:draft.draftId,amountMinor:amount,receivedAt:'2026-10-29T00:00:00.000Z',evidenceReference:'TEST ONLY fictional contribution evidence; no real receipt or money',reason:'TEST ONLY explicit received-cover evidence',reviewed:true});
 assert.equal(call('funding',fundingRequest(down?1:451,0),op(21)).code,'amount_exceeds_shortfall');
 if(!down){
  const first=fundingRequest(200,0),firstResult=call('funding',first,op(22));assert.equal(firstResult.status,'prize_rounding_funding_recorded_v8');assert.equal(firstResult.eventType,'received');assert.equal(firstResult.amountMinor,200);assert.deepEqual(call('funding',first,op(22)),firstResult);assert.deepEqual(reconcile('funding',first,op(22)),{authorized:true,result:firstResult});
  assert.equal(call('funding',first,op(23)).code,'stale_version');assert.equal(read().funding.shortfallMinor,250);
  const second=call('funding',fundingRequest(250,1),op(24));assert.equal(second.status,'prize_rounding_funding_recorded_v8');assert.equal(read().funding.receivedMinor,450);
  const voidRequest={expectedVersion:2,sourceDigest:w.sourceDigest,draftId:draft.draftId,voidsId:firstResult.fundingId,reason:'TEST ONLY correct erroneous200 record; not a refund',reviewed:true};
  const voided=call('void_funding',voidRequest,op(25));assert.equal(voided.status,'prize_rounding_funding_recorded_v8');assert.equal(voided.eventType,'voided');assert.equal(voided.amountMinor,200);assert.deepEqual(call('void_funding',voidRequest,op(25)),voided);assert.equal(read().funding.shortfallMinor,200);
  assert.equal(call('void_funding',{...voidRequest,expectedVersion:3},op(26)).code,'funding_already_voided');
  assert.equal(call('funding',fundingRequest(200,3),op(27)).status,'prize_rounding_funding_recorded_v8');
  w=read();assert.equal(w.funding.version,4);assert.equal(w.funding.receivedMinor,450);assert.equal(w.funding.records.length,4);assert.equal(w.funding.shortfallMinor,0);assert.ok(isPrizeAccountingWorkspaceV8(w,tid,eid));
  assert.equal(call('final',{...finalRequest(),expectedFundingVersion:0},op(28)).code,'stale_version');
  assert.equal(call('final',{...finalRequest(),expectedFundingVersion:0},op(20)).code,'funding_shortfall','A retained rejected operation replays its original result after funding arrives');
  assert.equal(call('final',{...finalRequest(),expectedFundingVersion:0,reason:'TEST ONLY changed retained final reason'},op(20)).code,'idempotency_conflict');
  checks.push('explicit partial/full cover records, exact replay, version duplicates and reasoned positive-amount void/replacement; no automatic contribution/refund');
 }else{assert.equal(read().funding.version,0);assert.equal(read().funding.records.length,0);checks.push('down rounding leaves50cent restricted event hold without fabricated cover/expense/benefit/profit');}
 // A rollback-only real expense append changes current core while preserving
 // actual received funding/history. Old draft/funding/final requests must block.
 const sourceBefore=read().sourceDigest,fundingBefore=read().funding.receivedMinor;
 sql(`begin;do $stale$declare r jsonb;ws jsonb;begin
 perform set_config('request.jwt.claim.sub','${actor}',true);
 r:=public.record_tournament_expense('${tid}',25,'USD','TEST ONLY rollback source change','${op(30)}');if r->>'status'<>'expense_recorded'then raise exception'change failed %',r;end if;
 ws:=public.get_prize_accounting_workspace_v8('${actor}','${tid}','${eid}');if ws->'draft'->>'current'<>'false'or ws->>'sourceDigest'='${sourceBefore}'or(ws->'funding'->>'receivedMinor')::bigint<>${fundingBefore} then raise exception'source/funding changed incorrectly %',ws;end if;
 r:=public.save_prize_accounting_draft_v8('${actor}','${tid}','${eid}',${quote(JSON.stringify({...draftRequest,expectedVersion:1}))},'${op(31)}');if r->>'code'<>'source_changed'then raise exception'stale draft accepted %',r;end if;
 r:=public.finalize_prize_accounting_v8('${actor}','${tid}','${eid}',${quote(JSON.stringify(finalRequest()))},'${op(32)}');if r->>'code'<>'source_changed'then raise exception'stale final accepted %',r;end if;
 end$stale$;rollback;`);
 assert.equal(read().sourceDigest,sourceBefore);assert.equal(read().draft.current,true);checks.push('real source change invalidates draft and rejects stale source/final; received funds remain visible, rollback restores exact history');
 // Current roles/JWT are rechecked even for an otherwise accepted replay.
 assert.equal(json(`select public.get_prize_accounting_workspace_v8('${op(90)}','${tid}','${eid}');`),null);assert.equal(call('draft',draftRequest,op(91),op(90)).code,'not_director');
 assert.equal(json(`select public.get_prize_accounting_workspace_v8('${actor}','${tid}','${op(92)}');`),null);assert.equal(call('draft',draftRequest,op(93),actor,tid,op(92)).code,'source_blocked');
 assert.equal(reconcile('draft',draftRequest,draftOp,op(90)),null);assert.equal(reconcile('draft',draftRequest,draftOp,actor,op(92)),null);
 sql(`begin;delete from app.tournament_roles where tournament_id='${tid}'and profile_id='${actor}'and role='director';do $role$declare r jsonb;begin r:=public.save_prize_accounting_draft_v8('${actor}','${tid}','${eid}',${quote(JSON.stringify(draftRequest))},'${draftOp}');if r->>'code'<>'not_director'or public.reconcile_prize_accounting_v8('${actor}','${tid}','${eid}','${draftOp}','draft',${quote(JSON.stringify(draftRequest))})is not null then raise exception'revoked replay admitted';end if;end$role$;rollback;`);
 for(const role of['anon','authenticated'])assert.equal(sql(`set request.jwt.claim.role='';set request.jwt.claims='{"role":"${role}"}';select public.save_prize_accounting_draft_v8('${actor}','${tid}','${eid}',${quote(JSON.stringify(draftRequest))},'${op(94)}')is null and public.get_prize_accounting_workspace_v8('${actor}','${tid}','${eid}')is null;`),'t');
 assert.equal(sql(`select count(*)from information_schema.role_table_grants where table_schema='app'and table_name in('prize_accounting_drafts_v8','prize_rounding_funding_events_v8','prize_accounting_finals_v8')and grantee in('anon','authenticated','service_role');`),'0');
 assert.equal(sql(`select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('get_prize_accounting_workspace_v8','save_prize_accounting_draft_v8','record_prize_rounding_funding_v8','void_prize_rounding_funding_v8','finalize_prize_accounting_v8','reconcile_prize_accounting_v8')and p.prosecdef and pg_get_userbyid(p.proowner)='postgres'and p.proconfig @> array['search_path=""']and has_function_privilege('service_role',p.oid,'EXECUTE')and not has_function_privilege('anon',p.oid,'EXECUTE')and not has_function_privilege('authenticated',p.oid,'EXECUTE');`),'6');
 checks.push('service-only six RPCs, private table DML revoked, owners/search paths and current-role/JWT/cross-event reconciliation boundaries');
 const beforeClosure=finalRequest();assert.equal(call('final',beforeClosure,op(40)).code,'crosscheck_incomplete');
 const checker=actor.slice(0,-12)+'000000000007';
 sql(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${checker}','cross_checker');`);
 const binding=json(`select public.bind_paper_official_identity_v1('${actor}','${tid}','${op(41)}','${checker}','nonparticipant',null,0,'${op(42)}');`);assert.equal(binding.status,'bound');
 assert.equal(json(`select public.finalize_cross_checking_v1('${actor}','${tid}','${op(43)}');`).status,'cross_checking_finalized');
 const finalReq=finalRequest();let final,finalOp=op(44);
 if(race){const keys=[finalOp,op(45)],results=await race(keys.map(key=>callSql('final',finalReq,key)),eid,'finalize_prize_accounting_v8');const accepted=results.findIndex(r=>r.status==='prize_accounting_finalized_unpaid_v8');assert.notEqual(accepted,-1);assert.equal(results.filter(r=>r.code==='already_finalized').length,1);final=results[accepted];finalOp=keys[accepted];checks.push('observed overlapping unpaid finals: one immutable final, one already-finalized receipt');}
 else final=call('final',finalReq,finalOp);
 assert.equal(final.status,'prize_accounting_finalized_unpaid_v8');assert.deepEqual(call('final',finalReq,finalOp),final);assert.deepEqual(reconcile('final',finalReq,finalOp),{authorized:true,result:final});assert.equal(call('final',finalReq,op(46)).code,'already_finalized');
 w=read();assert.ok(isPrizeAccountingWorkspaceV8(w,tid,eid),JSON.stringify(w));assert.equal(w.finalization.current,true);assert.equal(w.finalization.status,'unpaid');assert.equal(w.finalization.restrictedBalanceMinor,down?50:0);assert.equal(w.finalization.fundingReceivedMinor,down?0:450);assert.equal(w.finalization.fundingVersion,down?0:4);
 assert.equal(sql(`select count(*)from app.prize_accounting_finals_v8 where event_id='${eid}';`),'1');assert.equal(sql(`select count(*)from app.prize_accounting_drafts_v8 where event_id='${eid}';`),'1');
 assert.equal(financialAndScoreIdentity(),originalIdentity,'Rounding accounting changed original entry/Q ledger, allocations or qualifying evidence');
 assert.equal(w.facts.receiptTotalMinor+w.funding.receivedMinor,w.facts.expenseTotalMinor+w.draft.rounding.roundedBudgetMinor+w.facts.qIncomeMinor+w.draft.rounding.restrictedBalanceMinor);
 assert.equal(sql(`select count(*)from app.audit_events where tournament_id='${tid}'and action='prize_accounting_v8_final_unpaid';`),'1');
 sql(`begin;do $immutable$begin begin update app.prize_accounting_drafts_v8 set request_payload='{}'where event_id='${eid}';raise exception'update unexpectedly accepted';exception when raise_exception then if sqlerrm='update unexpectedly accepted'then raise;end if;end;end$immutable$;rollback;`);
 checks.push('one refreshed unpaid final, exact source/funding snapshot, full cash conservation and85%return; original scores/entry/Q ledger byte-identical; immutable draft rejects update');
 return{status:'PASS',down,hasQ,checks,workspace:w,draftRequest,draftResult:draft,finalRequest:finalReq,finalResult:final,originalIdentitySha256:sha(originalIdentity),limitation:'Real local SQL RPCs with explicitly fictional setup/identity/score evidence; no real money, physical independent-human review or hosted state.'};
}
