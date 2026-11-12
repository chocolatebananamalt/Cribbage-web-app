// Real disposable SQL workflow only. Every liability remains unpaid.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isQAccountingWorkspace} from '../src/lib/api/q-accounting-v6.ts';
import {quote} from './fixtures/q-review-foundation.mjs';
export async function verifySeventeenAccounting({sql,race,fixture:f,balanced=false}) {
 const {actor,tid,eid}=f;const checks=[];
 const scopedUuid=(prefix,n)=>`${prefix}${eid.slice(0,4)}-${eid.slice(4,8)}-4000-8000-${String(n).padStart(12,'0')}`;
 const json=q=>JSON.parse(sql(q).split('\n').filter(Boolean).at(-1));
 const read=()=>json(`select public.get_q_accounting_workspace_v6('${actor}','${tid}','${eid}');`);
 assert.equal(sql(`select count(*)from app.canonical_games where event_id='${eid}';`),'102');
 const standings=json(`select jsonb_agg(jsonb_build_object('participantId',participant_id,'verifiedGames',verified_games,'gamePoints',game_points,'gamesWon',games_won,'positiveSpreadPoints',plus_points,'netSpreadPoints',net_spread_points)order by ranking_ordinal)from app.qualification_result_rows where event_id='${eid}';`);
 assert.deepEqual(standings.map(r=>r.participantId),f.expected.map(r=>r.participantId));
 for(const [i,r]of standings.entries()){const x=f.expected[i];assert.equal(r.verifiedGames,12);assert.equal(r.gamePoints,x.gamePoints);assert.equal(r.gamesWon,x.gamesWon);assert.equal(r.positiveSpreadPoints,x.plusPoints);assert.equal(r.netSpreadPoints,x.plusPoints-x.minusPoints);}
 checks.push('102 actual verified matches and twelve results per each of17 players; independently recomputed standings match');
 for(const [n,amount,category]of[[1,5100,'sanctioning'],[2,10200,'meals'],[3,5100,'hall_rental'],[4,2550,'cards']]){
  const r=json(`select set_config('request.jwt.claim.sub','${actor}',false);select public.record_tournament_expense('${tid}',${amount},'USD','TEST ONLY ${category}','${scopedUuid('a253',n)}');`);assert.equal(r.status,'expense_recorded');
 }
 assert.equal(sql(`select app.settlement_assessment_v5('${eid}');`),'5100');
 let q=json(`select public.get_q_obligation_review_workspace_v2('${actor}','${tid}');`);assert.deepEqual(q.blockers,[]);
 assert.deepEqual(q.preview.map(p=>p.fundMinor),[balanced?16000:2500,1000]);
 const request={expectedVersion:0,sourceDigest:q.sourceDigest,reason:'Local fictional five-qualifier equal Q awards and unpaid nonqualifier refund',reviewed:true};
 const reviewCall=(r,op)=>`select public.record_q_obligation_review_v2('${actor}','${tid}',${quote(JSON.stringify(r))},'${op}');`;
 let qr,reviewOp=scopedUuid('b253',1);
 if(balanced){
  const ops=[reviewOp,scopedUuid('b253',2)],results=await race(ops.map(op=>reviewCall(request,op)),eid,'record_q_obligation_review_v2');
  const accepted=results.findIndex(r=>r.status==='q_obligations_recorded_v2');assert.notEqual(accepted,-1);assert.equal(results.filter(r=>r.code==='stale_version').length,1);qr=results[accepted];reviewOp=ops[accepted];
  checks.push('observed overlapping different-operation unpaid reviews: one version, one stale rejection');
 }else qr=json(reviewCall(request,reviewOp));
 assert.equal(qr.status,'q_obligations_recorded_v2');assert.deepEqual(json(reviewCall(request,reviewOp)),qr);
 assert.equal(json(reviewCall({...request,expectedVersion:1},scopedUuid('b253',3))).code,'already_reviewed');
 assert.equal(sql(`select count(*)from app.q_obligation_reviews_v2 where event_id='${eid}';`),'1');
 if(balanced){
  sql(`begin;do $change$declare r jsonb;w jsonb;begin
   r:=public.save_q_pool_membership_v1('${actor}','${tid}',(select request||jsonb_build_object('expectedVersion',version,'correction',true,'reason','TEST ONLY same-money source revision')from app.q_pool_allocation_versions_v1 where tournament_id='${tid}'order by recorded_at,id limit 1),'${scopedUuid('b253',4)}');
   if r->>'status'<>'q_pool_saved'then raise exception 'correction rejected %',r;end if;
   w:=public.get_q_obligation_review_workspace_v2('${actor}','${tid}');if w->>'current'<>'false'then raise exception 'review remained current';end if;
   r:=public.record_q_obligation_review_v2('${actor}','${tid}',${quote(JSON.stringify({...request,expectedVersion:1}))},'${scopedUuid('b253',5)}');if r->>'code'<>'source_changed'then raise exception 'stale review accepted %',r;end if;
  end$change$;rollback;`);
  checks.push('same-money allocation revision invalidates new-policy review and rejects stale digest; rollback preserves original immutable history');
 }
 let w=read();assert.ok(isQAccountingWorkspace(w,tid,eid));assert.deepEqual(w.blockers,[]);
 assert.equal(w.facts.baseIncomeMinor,51000);assert.equal(w.facts.qIncomeMinor,balanced?17000:3500);assert.equal(w.facts.receiptTotalMinor,balanced?68000:54500);
 assert.equal(w.facts.expenseTotalMinor,22950);assert.equal(w.facts.regularAwardMinor,28050);assert.equal(w.facts.minimumReturnMinor,43350);
 assert.deepEqual(w.regularSchedule.awards.map(a=>a.totalAwardMinor),[9351,7012,4675,4675,2337]);
 assert.deepEqual(w.facts.canonicalMrp.rows.map(r=>r.totalMrp),[125,97,66,26,12]);
 assert.deepEqual(w.qReview.obligations.map(p=>[p.kind,p.fundMinor,p.rows.map(r=>r.amountMinor)]),balanced?[['award',16000,[8000,5500,2500]],['refund',1000,[1000]]]:[['award',2500,[500,500,500,500,500]],['refund',1000,[1000]]]);
 checks.push(`base510/Q${balanced?'170/receipts680':'35/receipts545'} partition;229.50expenses+280.50regular awards;433.50 base-only85%; explicit bye MRP125/97/66/26/12`);
 const classes=w.facts.expenseEvidence.map(e=>({expenseEventId:e.expenseEventId,category:e.description.replace('TEST ONLY ',''),evidenceReference:'Local synthetic expense evidence'}));
 const draftRequest={expectedVersion:0,sourceDigest:w.sourceDigest,qReviewId:w.qReview.id,scheduleVersionId:w.regularSchedule.scheduleVersionId,reason:'Local reviewed five-qualifier accounting remains unpaid',expenseClassifications:classes,reviewed:true};
 const draftOp=scopedUuid('c253',1),save=(r,op)=>json(`select public.save_q_accounting_draft_v6('${actor}','${tid}','${eid}',${quote(JSON.stringify(r))},'${op}');`);
 const draft=save(draftRequest,draftOp);assert.equal(draft.status,'q_accounting_draft_saved_v6');assert.deepEqual(save(draftRequest,draftOp),draft);
 assert.equal(save(draftRequest,scopedUuid('c253',2)).code,'stale_version');assert.equal(sql(`select count(*)from app.q_accounting_drafts_v6 where event_id='${eid}';`),'1');
 let summary=json(`select public.list_prize_award_summaries_v1('${f.uid(1)}','${tid}');`);assert.equal(summary.length,1);assert.equal(summary[0].status,'unpaid');assert.equal(summary[0].finalized,false);assert.equal(summary[0].awards.length,5);
 assert.equal(sql(`select coalesce(public.list_prize_award_summaries_v1('${scopedUuid('a521',7)}','${tid}')::text,'NULL');`),'NULL');
 checks.push('one immutable source-bound unpaid draft, exact replay and duplicate protection; member/printable five awards explicit unpaid, unrelated outsider denied');
 assert.deepEqual(Object.keys(summary[0]).sort(),['awards','eventId','finalized','scheduleVersion','status']);
 assert.ok(summary[0].awards.every(a=>Object.keys(a).sort().join(',')==='amountMinor,bandEnd,bandStart,displayName'));
 const publicResolution=json(`select public.get_event_prize_schedule_resolution_v1('${actor}','${tid}','${eid}',(select jsonb_build_object('kind','playoff_outcome_v4','resultId',id,'qualificationResultVersionId',qualification_result_version_id)from app.playoff_outcome_versions_v4 where event_id='${eid}'order by version desc limit 1));`);
 assert.equal(publicResolution.status,'available');assert.equal(publicResolution.awards.length,5);

 // Identity/role foundation is explicitly fictional, while binding and closure
 // still use their supported authorization and independent-account checks.
 const checker=actor.slice(0,-12)+'000000000007';
 sql(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${checker}','cross_checker');`);
 const binding=json(`select public.bind_paper_official_identity_v1('${actor}','${tid}','${scopedUuid('d253',1)}','${checker}','nonparticipant',null,0,'${scopedUuid('d253',2)}');`);assert.equal(binding.status,'bound');
 const finReq={draftId:draft.draftId,draftVersion:1,expectedVersion:0,reason:'Local final unpaid accounting, no disbursement',reviewed:true};
 const finOp=scopedUuid('e253',1),final=()=>json(`select public.finalize_q_accounting_v6('${actor}','${tid}','${eid}',${quote(JSON.stringify(finReq))},'${finOp}');`);
 assert.equal(final().code,'crosscheck_incomplete');
 const closure=json(`select public.finalize_cross_checking_v1('${actor}','${tid}','${scopedUuid('d253',3)}');`);assert.equal(closure.status,'cross_checking_finalized');
 // Rejected operation keys are immutable: use a fresh key after prerequisites.
 const fin2Op=scopedUuid('e253',2);const finalStatements=[fin2Op,scopedUuid('e253',3)].map(op=>`select public.finalize_q_accounting_v6('${actor}','${tid}','${eid}',${quote(JSON.stringify(finReq))},'${op}');`);
 const results=await race(finalStatements,eid,'finalize_q_accounting_v6');
 assert.equal(results.filter(r=>r.status==='q_accounting_finalized_unpaid_v6').length,1);assert.equal(results.filter(r=>r.code==='already_finalized').length,1);
 const acceptedIndex=results.findIndex(r=>r.status==='q_accounting_finalized_unpaid_v6'),acceptedOp=acceptedIndex===0?fin2Op:scopedUuid('e253',3);const finalResult=results[acceptedIndex];
 assert.deepEqual(json(`select public.finalize_q_accounting_v6('${actor}','${tid}','${eid}',${quote(JSON.stringify(finReq))},'${acceptedOp}');`),finalResult);
 assert.equal(sql(`select count(*)from app.q_accounting_finals_v6 where event_id='${eid}';`),'1');w=read();assert.equal(w.finalization.status,'unpaid');assert.equal(w.finalization.current,true);assert.ok(isQAccountingWorkspace(w,tid,eid));
 summary=json(`select public.list_prize_award_summaries_v1('${f.uid(1)}','${tid}');`);assert.equal(summary[0].finalized,true);assert.equal(summary[0].status,'unpaid');
 checks.push('independent nonplayer binding and closure gate, once-only unpaid finalization, refreshed member awards and exact final replay');
 sql(`begin;do $stale$declare r jsonb;s jsonb;begin
 r:=public.save_q_pool_membership_v1('${actor}','${tid}',(select request||jsonb_build_object('expectedVersion',version,'correction',true,'reason','Local rollback-only stale source test')from app.q_pool_allocation_versions_v1 where tournament_id='${tid}'order by recorded_at,id limit 1),'${scopedUuid('f253',1)}');
 if r->>'status'<>'q_pool_saved'then raise exception 'stale correction failed %',r;end if;
 s:=public.list_prize_award_summaries_v1('${f.uid(1)}','${tid}');if s<>'[]'::jsonb then raise exception 'stale member awards remain visible %',s;end if;
 if public.get_q_accounting_workspace_v6('${actor}','${tid}','${eid}')->'finalization'->>'current'<>'false'then raise exception 'stale final still current';end if;
 end$stale$;rollback;`);
 assert.equal(read().finalization.current,true);
 checks.push('source correction hides stale unpaid member summary without deleting history; rollback restores exact current final');

 fs.writeFileSync('test-results/seventeen-accounting-api-contract.json',JSON.stringify({workspace:w,draftRequest,draftResult:draft,finalRequest:finReq,finalResult,summary},null,2));
 return checks;
}
