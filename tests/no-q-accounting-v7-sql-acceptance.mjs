// LOCAL ONLY. Consumes a supported no-Q seventeen-player finalized-qualification
// fixture with actual digital submissions/confirmations and a current v4 result.
import assert from 'node:assert/strict';
const quote=s=>`'${String(s).replaceAll("'","''")}'`;

export async function verifyNoQAccountingV7({sql,actor,tid,eid,checker,race}) {
 const op=n=>`${eid.slice(0,8)}-0254-4000-8000-${String(n).padStart(12,'0')}`;
 let groups=0;const pass=name=>{groups++;console.log('PASS no-Q-accounting-v7 '+name);};
 const read=()=>JSON.parse(sql(`select public.get_no_q_accounting_workspace_v7('${actor}','${tid}','${eid}');`));
 const call=(request,key,who=actor,event=eid)=>JSON.parse(sql(`select public.save_no_q_accounting_draft_v7('${who}','${tid}','${event}',${quote(JSON.stringify(request))},'${key}');`)||'null');
 const reconcile=(request,key,who=actor)=>JSON.parse(sql(`select public.reconcile_no_q_accounting_v7('${who}','${tid}','${eid}','${key}',${quote(JSON.stringify(request))},'draft');`)||'null');
 for(const table of ['tournament_setup_q_pool_versions','tournament_setup_side_pool_versions','q_pool_membership_versions_v1','q_obligation_reviews_v1','q_obligation_reviews_v2'])assert.equal(sql(`select count(*)from app.${table} where tournament_id='${tid}';`),'0',table+' must stay absent');
 assert.equal(sql(`select count(*)from app.canonical_games where event_id='${eid}'and state='verified';`),'102');
 assert.equal(sql(`select count(*)from app.roster_payment_events where tournament_id='${tid}'and event_type='received';`),'17');
 assert.equal(sql(`select sum(amount_minor)from app.roster_payment_events where tournament_id='${tid}'and event_type='received';`),'51000');
 for(const[i,amount,name]of[[1,5100,'sanctioning'],[2,10200,'meals'],[3,5100,'hall_rental'],[4,2550,'cards']]){
  const r=JSON.parse(sql(`select set_config('request.jwt.claim.sub','${actor}',false);select public.record_tournament_expense('${tid}',${amount},'USD','TEST ONLY ${name}','${op(i)}');`).split('\n').at(-1));assert.equal(r.status,'expense_recorded');
 }
 let w=read();assert.deepEqual(w.blockers,[]);assert.equal(Object.hasOwn(w,'qReview'),false);assert.equal(w.facts.qIncomeMinor,0);
 assert.equal(w.facts.baseIncomeMinor,51000);assert.equal(w.facts.receiptTotalMinor,51000);assert.equal(w.facts.expenseTotalMinor,22950);assert.equal(w.facts.regularAwardMinor,28050);assert.equal(w.facts.minimumReturnMinor,43350);
 assert.deepEqual(w.regularSchedule.awards.map(a=>a.totalAwardMinor),[9351,7012,4675,4675,2337]);assert.equal(w.automaticPayment,false);
 const classes=w.facts.expenseEvidence.map(e=>({expenseEventId:e.expenseEventId,category:e.description.replace('TEST ONLY ',''),evidenceReference:'TEST ONLY local synthetic invoice'}));
 const request={expectedVersion:0,sourceDigest:w.sourceDigest,scheduleVersionId:w.regularSchedule.scheduleVersionId,reason:'TEST ONLY reviewed base-only unpaid accounting',expenseClassifications:classes,reviewed:true};
 pass('seventeen full base receipts; zero pool/review fabrication; 510=229.50 costs+280.50 regular awards with exact five-band cents');
 for(const[i,change]of[r=>{r.qReviewId=op(99);},r=>{r.paid=true;},r=>{r.prizeClaims=[];},r=>{r.reviewed=false;},r=>{r.expenseClassifications[0].category='unknown';},r=>{r.sourceDigest='f'.repeat(64);}].entries()){
  const r=structuredClone(request);change(r);assert.equal(call(r,op(100+i)).status,'rejected');
 }
 const low=structuredClone(request);low.expenseClassifications.find(c=>c.category==='meals').category='supplies';assert.equal(call(low,op(110)).code,'insufficient_participant_return');
 assert.equal(sql(`select count(*)from app.no_q_accounting_drafts_v7 where event_id='${eid}';`),'0');
 const outsider=checker??actor.slice(0,-12)+'000000000007';assert.equal(call(request,op(120),outsider).code,'not_director');assert.equal(reconcile(request,op(120),outsider),null);
 assert.equal(call(request,op(121),actor,op(999)).code,'source_blocked');
 for(const role of['authenticated','anon',null]){
  const out=sql(`set request.jwt.claim.role='';set request.jwt.claims=${quote(JSON.stringify(role?{role}:{}))};select public.get_no_q_accounting_workspace_v7('${actor}','${tid}','${eid}')is null and public.save_no_q_accounting_draft_v7('${actor}','${tid}','${eid}',${quote(JSON.stringify(request))},'${op(122)}')is null;`);assert.equal(out,'t');
 }
 pass('strict requests, no client payment/claim overrides, base-only85% independent of cash balance, cross-event/actor/JWT boundaries');
 let recorded,recordOp;
 if(race){
  const ops=[op(200),op(201)],results=await race(ops.map(key=>`select public.save_no_q_accounting_draft_v7('${actor}','${tid}','${eid}',${quote(JSON.stringify(request))},'${key}');`),eid,'save_no_q_accounting_draft_v7');
  assert.equal(results.filter(r=>r.status==='no_q_accounting_draft_saved_v7').length,1);assert.equal(results.filter(r=>r.code==='stale_version').length,1);
  const index=results.findIndex(r=>r.status==='no_q_accounting_draft_saved_v7');recorded=results[index];recordOp=ops[index];pass('observed overlapping no-Q draft saves: one immutable draft, one stale rejection');
 }else{recordOp=op(200);recorded=call(request,recordOp);assert.equal(recorded.status,'no_q_accounting_draft_saved_v7');}
 assert.deepEqual(call(request,recordOp),recorded);assert.deepEqual(reconcile(request,recordOp),{authorized:true,result:recorded});
 assert.equal(call({...request,reason:'changed exact request'},recordOp).code,'idempotency_conflict');assert.equal(reconcile({...request,reason:'changed exact request'},recordOp).result.code,'idempotency_conflict');
 assert.equal(call(request,op(202)).code,'stale_version');assert.equal(sql(`select count(*)from app.no_q_accounting_drafts_v7 where event_id='${eid}';`),'1');
 w=read();assert.equal(w.draft.facts.participantReturnMinor,43350);assert.equal(w.draft.facts.benefitExpenseMinor,15300);assert.equal(w.draft.facts.operatingExpenseMinor,7650);assert.equal(w.draft.current,true);
 const member=JSON.parse(sql(`select public.list_prize_award_summaries_v1('${outsider}','${tid}');`)||'null');
 if(member!==null){assert.ok(member.every(s=>!Object.hasOwn(s,'facts')&&!Object.hasOwn(s,'sourceDigest')));}
 const summary=JSON.parse(sql(`select public.list_prize_award_summaries_v1('${actor}','${tid}');`));const published=summary.find(s=>s.eventId===eid);assert.equal(published.status,'unpaid');assert.equal(published.finalized,false);
 assert.deepEqual(Object.keys(published).sort(),['awards','eventId','finalized','scheduleVersion','status']);assert.ok(published.awards.every(a=>Object.keys(a).sort().join(',')==='amountMinor,bandEnd,bandStart,displayName'));
 assert.equal(sql(`select public.list_prize_award_summaries_v1('${op(999)}','${tid}')is null;`),'t');
 assert.deepEqual(JSON.parse(sql(`select app.list_prize_award_summaries_pre_no_q_v7('${actor}','${tid}');`)),[],'Prior legacy/v6 producer remains an unchanged empty envelope for this fresh no-Q fixture');
 const oldReq={source:w.draft.facts.source,expectedVersion:0,prizeClaims:[],eventIncomeMinor:51000,eventExpenseMinor:22950,retainedBalanceMinor:0,sanctioningExpenseEventId:null,officialSourceReference:'TEST ONLY'};
 assert.equal(JSON.parse(sql(`select public.save_event_settlement_draft_v5('${actor}','${tid}','${eid}',${quote(JSON.stringify(oldReq))},'${op(203)}');`)).code,'settlement_domain_conflict');
 assert.equal(JSON.parse(sql(`select public.save_q_accounting_draft_v6('${actor}','${tid}','${eid}',${quote(JSON.stringify({...request,qReviewId:op(998)}))},'${op(204)}');`)).code,'legacy_settlement_preserved');
 sql(`begin;delete from app.tournament_roles where tournament_id='${tid}'and profile_id='${actor}'and role='director';do $$begin if public.save_no_q_accounting_draft_v7('${actor}','${tid}','${eid}',${quote(JSON.stringify(request))},'${recordOp}')->>'code'is distinct from'not_director'or public.reconcile_no_q_accounting_v7('${actor}','${tid}','${eid}','${recordOp}',${quote(JSON.stringify(request))},'draft')is not null then raise exception 'revoked actor replay accepted';end if;end$$;rollback;`);
 pass('immutable current draft, exact retained retry/reconciliation, duplicate-key protection, no legacy/v6 second liabilities, revoked replay blocked');
 const finalRequest={draftId:recorded.draftId,draftVersion:1,expectedVersion:0,reason:'TEST ONLY final accounting remains unpaid; no transfer',reviewed:true};
 const final=(key)=>JSON.parse(sql(`select public.finalize_no_q_accounting_v7('${actor}','${tid}','${eid}',${quote(JSON.stringify(finalRequest))},'${key}');`));
 for(const[i,draftVersion]of['1',1.5,0,-1,257,Number.MAX_SAFE_INTEGER].entries()){
  const bad={...finalRequest,draftVersion};
  const result=JSON.parse(sql(`select public.finalize_no_q_accounting_v7('${actor}','${tid}','${eid}',${quote(JSON.stringify(bad))},'${op(320+i)}');`));
  assert.equal(result.code,'invalid_request','Final draftVersion must be a JSON number and whole bounded1..256');
  assert.deepEqual(JSON.parse(sql(`select public.reconcile_no_q_accounting_v7('${actor}','${tid}','${eid}','${op(320+i)}',${quote(JSON.stringify(bad))},'final');`)),{authorized:true,result});
 }
 assert.equal(sql(`select count(*)from app.no_q_accounting_finals_v7 where event_id='${eid}';`),'0');
 pass('final draftVersion requires JSON integer1..256; malformed final requests retain exact rejected receipts');
 if(sql(`select exists(select 1 from app.cross_check_finalizations where tournament_id='${tid}');`)==='f'){
  assert.equal(final(op(300)).code,'crosscheck_incomplete');
  if(checker){
   sql(`insert into app.tournament_roles(tournament_id,profile_id,role)select '${tid}','${checker}','cross_checker'where not exists(select 1 from app.tournament_roles where tournament_id='${tid}'and profile_id='${checker}'and role='cross_checker');`);
   if(sql(`select count(*)from app.paper_official_identity_bindings where tournament_id='${tid}'and official_profile_id='${checker}';`)==='0'){
    const binding=JSON.parse(sql(`select public.bind_paper_official_identity_v1('${actor}','${tid}','${op(301)}','${checker}','nonparticipant',null,0,'${op(302)}');`));assert.equal(binding.status,'bound');
   }
  }
  const closure=JSON.parse(sql(`select public.finalize_cross_checking_v1('${actor}','${tid}','${op(303)}');`));assert.equal(closure.status,'cross_checking_finalized');
 }
 let finalResult,finalOp;
 if(race){const ops=[op(310),op(311)],results=await race(ops.map(key=>`select public.finalize_no_q_accounting_v7('${actor}','${tid}','${eid}',${quote(JSON.stringify(finalRequest))},'${key}');`),eid,'finalize_no_q_accounting_v7');assert.equal(results.filter(r=>r.status==='no_q_accounting_finalized_unpaid_v7').length,1);assert.equal(results.filter(r=>r.code==='already_finalized').length,1);const index=results.findIndex(r=>r.status==='no_q_accounting_finalized_unpaid_v7');finalResult=results[index];finalOp=ops[index];pass('observed overlapping final saves: one unpaid final and one controlled duplicate rejection');}
 else{finalOp=op(310);finalResult=final(finalOp);assert.equal(finalResult.status,'no_q_accounting_finalized_unpaid_v7');}
 assert.deepEqual(final(finalOp),finalResult);assert.equal(final(op(312)).code,'already_finalized');w=read();assert.equal(w.finalization.status,'unpaid');assert.equal(w.finalization.current,true);
 assert.deepEqual(JSON.parse(sql(`select public.reconcile_no_q_accounting_v7('${actor}','${tid}','${eid}','${finalOp}',${quote(JSON.stringify(finalRequest))},'final');`)),{authorized:true,result:finalResult});
 assert.equal(JSON.parse(sql(`select public.reconcile_no_q_accounting_v7('${actor}','${tid}','${eid}','${finalOp}',${quote(JSON.stringify({...finalRequest,draftVersion:'1'}))},'final');`)).result.code,'idempotency_conflict');
 assert.equal(sql(`select count(*)from app.no_q_accounting_finals_v7 where event_id='${eid}';`),'1');
 sql(`begin;do $$begin begin update app.no_q_accounting_drafts_v7 set source_digest=repeat('0',64)where event_id='${eid}';raise exception 'immutable update accepted';exception when raise_exception then if sqlerrm='immutable update accepted'then raise;end if;end;end$$;rollback;`);
 const finalBefore=sql(`select to_jsonb(f)from app.no_q_accounting_finals_v7 f where event_id='${eid}';`);
 const stale=JSON.parse(sql(`begin;select set_config('request.jwt.claim.sub','${actor}',true);select public.record_tournament_expense('${tid}',1,'USD','TEST ONLY rollback stale-source probe','${op(400)}');select jsonb_build_object('current',public.get_no_q_accounting_workspace_v7('${actor}','${tid}','${eid}')->'finalization'->'current','summaries',public.list_prize_award_summaries_v1('${actor}','${tid}'));rollback;`).split('\n').filter(Boolean).at(-1));assert.equal(stale.current,false);assert.deepEqual(stale.summaries,[]);
 assert.equal(sql(`select to_jsonb(f)from app.no_q_accounting_finals_v7 f where event_id='${eid}';`),finalBefore);
 assert.equal(read().finalization.current,true);
 for(const table of['q_obligation_reviews_v1','q_obligation_reviews_v2','q_accounting_drafts_v6','event_settlement_drafts_v5'])assert.equal(sql(`select count(*)from app.${table} where tournament_id='${tid}';`),'0');
 pass('complete closure, persisted unpaid final, immutable/stale-source guards and zero fabricated pool reviews or competing accounting');
 return{groups,workspace:read(),draftRequest:request,draftResult:recorded,finalRequest,finalResult};
}
