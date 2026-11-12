// Real disposable backend, fictional identities/receipts/outcomes only.
import assert from 'node:assert/strict';import crypto from'node:crypto';
import{makeSeventeenMainFixture}from'./fixtures/seventeen-main-foundation.mjs';
import{makeAccWeightedMainFixture}from'./fixtures/acc-weighted-main-foundation.mjs';
import{preparePrizeAccountingFixtureV8}from'./prize-accounting-v8-sql-acceptance.mjs';
import{seed as tieSeed,actor as tieActor,tid as tieTid,eid as tieEid}from'./fixtures/qualification-tie-foundation.mjs';
import{isSyntheticEventContext}from'../src/lib/api/synthetic-event-evidence.ts';
export async function verifySyntheticEventFlow({sql,read,startSession}){
 const checks=[],results=[],json=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
 const assertStatus=(value,status)=>assert.equal(value?.status,status,JSON.stringify(value));
 const rejected=(value)=>assert.equal(value?.status,'rejected',JSON.stringify(value));
 const expectGuard=(query,pattern)=>{let failed=false;try{const value=read(query);rejected(value);failed=true;}catch(e){assert.match(String(e),pattern);failed=true;}assert.ok(failed);};
 const race=async(tid,first,second,label)=>{
  const a=startSession(`begin;${first}select pg_sleep(1);commit;`,'synthetic_a_'+label);
  await new Promise(r=>setTimeout(r,100));const b=startSession(`begin;${second}commit;`,'synthetic_b_'+label);
  let observed=false;for(let n=0;n<15;n++){if(read(`select exists(select 1 from pg_stat_activity where application_name='synthetic_b_${label}'and wait_event_type='Lock');`)){observed=true;break;}await new Promise(r=>setTimeout(r,40));}
  const out=await Promise.all([a.done,b.done]);assert.ok(observed,'actual lock observed '+label);return out.map(x=>JSON.parse(x.split('\n').filter(x=>x.startsWith('{')).at(-1)));
 };
 const snapshot=(table,where)=>read(`select to_jsonb(md5(coalesce(jsonb_agg(to_jsonb(x)order by id)::text,'')))from app.${table} x where ${where};`);
 sql("insert into app.synthetic_paper_deployments_v1(project_ref,authorization_reference)values('nnhcnvksxgxnpvdqjgpg','LOCAL explicitly authorized fictional event lifecycle');");
 for(const withQ of[false,true]){
  const f=preparePrizeAccountingFixtureV8(withQ?makeAccWeightedMainFixture():makeSeventeenMainFixture({withQ:false,topSeedTie:true}));
  const tag=withQ?'c267':'d267',op=n=>`${tag}0000-0000-4000-8000-${String(n).padStart(12,'0')}`,checker=f.actor.slice(0,-12)+'000000000007';
  f.setupSql=f.setupSql.replaceAll("'digital','"+f.actor+"'","'paper','"+f.actor+"'");
  if(withQ){
   const escaped=f.pool(2).replaceAll('-','\\-');f.setupSql=f.setupSql.replace(new RegExp(",\\s*\\('"+escaped+"'[^;]+;"),';');assert.ok(!f.setupSql.includes(f.pool(2)),'single graduated Q only');
  }
  sql(f.setupSql);
  sql(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${f.tid}','${checker}','cross_checker');`);
  assertStatus(read(`select public.bind_paper_official_identity_v1('${f.actor}','${f.tid}','${op(1)}','${checker}','nonparticipant',null,0,'${op(2)}');`),'bound');
  const enroll=()=>sql(`insert into app.synthetic_paper_fixtures_v1(event_id,tournament_id,project_ref,authorization_reference)values('${f.eid}','${f.tid}','nnhcnvksxgxnpvdqjgpg','LOCAL approved ${withQ?'Q Side':'No Q legacy15'} rehearsal');`);
  const expenseRows=[[5100,'sanctioning'],[10900,'meals'],[4400,'hall_rental'],[2550,'cards']];
  const expenses=()=>{for(let i=0;i<expenseRows.length;i++){const[amount,category]=expenseRows[i];assertStatus(read(`select set_config('request.jwt.claim.sub','${f.actor}',false);select public.record_tournament_expense('${f.tid}',${amount},'USD','${withQ?'TEST ONLY SYNTHETIC:':'TEST ONLY'} ${category}','${op(20+i)}');`),'expense_recorded');}};
  let sidePool=null;
  if(withQ){
   enroll();
   const policy={...f.policyRequest,method:'graduated-acc-weighted-largest-remainder-5usd-v2',scheduleId:'graduated-acc-weighted-largest-remainder-5usd-v2',disclosureReference:'TEST ONLY SYNTHETIC: configured and disclosed before fictional elections/payments'};
   assertStatus(read(`select public.save_q_operating_policy_v4('${f.actor}','${f.tid}',${json(policy)},'${op(3)}');`),'q_policy_published');
   let finance=`begin;set request.jwt.claim.sub='${f.actor}';set request.jwt.claims='{"role":"service_role","sub":"${f.actor}"}';`;
   for(let n=1;n<=17;n++){
    const membership={action:'membership',rosterEntryId:f.rid(n),expectedVersion:0,correction:false,reason:'TEST ONLY SYNTHETIC: fictional explicit election',pools:[{poolVersionId:f.pool(1),elected:true,consentReference:null}]};
    const memberExpr=json(membership).replace('"consentReference":null',`"consentReference":null`);
    finance+=`do $$declare r jsonb;req jsonb:=${memberExpr};begin req:=jsonb_set(req,'{pools,0,consentReference}',to_jsonb('Q policy '||(select id from app.q_operating_policies_v2 where pool_version_id='${f.pool(1)}')::text||': TEST ONLY SYNTHETIC: fictional acknowledgment'));r:=public.save_q_pool_membership_v1('${f.actor}','${f.tid}',req,'${op(100+n)}');if r->>'status'<>'q_pool_saved'then raise exception'membership %',r;end if;end$$;`;
    finance+=`do $$declare r jsonb;begin r:=public.set_roster_payment_obligation_v1('${f.tid}','${f.rid(n)}',0,4000,'TEST ONLY SYNTHETIC: base30 Q10','${op(200+n)}');if r->>'status'<>'payment_obligation_saved'then raise exception'owed %',r;end if;r:=public.record_manual_roster_payment('${f.tid}','${f.rid(n)}',0,4000,'USD','cash',now(),'TEST ONLY SYNTHETIC: no actual cash/check received','${op(300+n)}');if r->>'status'<>'payment_recorded'then raise exception'receipt %',r;end if;r:=public.save_q_pool_membership_v1('${f.actor}','${f.tid}',jsonb_build_object('action','allocation','rosterEntryId','${f.rid(n)}','expectedVersion',0,'correction',false,'reason','TEST ONLY SYNTHETIC: separate base/Q allocation','membershipVersionId',(select id from app.q_pool_membership_versions_v1 where roster_entry_id='${f.rid(n)}'),'receiptId',(select id from app.roster_payment_events where roster_entry_id='${f.rid(n)}'),'obligationVersion',1,'baseMinor',3000,'pools',jsonb_build_array(jsonb_build_object('poolVersionId','${f.pool(1)}','amountMinor',1000))),'${op(400+n)}');if r->>'status'<>'q_pool_saved'then raise exception'allocation %',r;end if;end$$;`;
   }sql(finance+'commit;');expenses();
   sidePool=op(500);assertStatus(read(`select public.add_event_side_pool_v1('${f.actor}','${f.tid}','${f.eid}','${sidePool}','TEST ONLY','TEST ONLY SYNTHETIC: graduated Side',1000,'${op(501)}');`),'side_pool_added');
   const def=read(`select to_jsonb(id)from app.event_side_pool_definition_versions where pool_id='${sidePool}'order by version desc limit 1;`);
   const amountPolicy=read(`select public.save_side_pool_graduated_policy_v2('${f.actor}','${f.tid}','${f.eid}','${sidePool}',${json({method:'graduated-acc-weighted-largest-remainder-5usd-v2',ratio:6,definitionVersionId:def,disclosureReference:'TEST ONLY SYNTHETIC: disclosed amount formula',disclosed:true})},'${op(502)}');`);assertStatus(amountPolicy,'side_pool_graduated_policy_frozen');
   assertStatus(read(`select public.publish_side_pool_recipient_policy_v3('${f.actor}','${f.tid}','${f.eid}','${sidePool}',${json({amountPolicyId:amountPolicy.policyId,method:'paid-qualifying-cards-no-cutoff-v3',disclosureReference:'TEST ONLY SYNTHETIC: paid qualifying cards independent of playoff cutoff',disclosed:true})},'${op(503)}');`),'side_pool_recipient_policy_frozen');
   for(let n=1;n<=17;n++)assertStatus(read(`select public.save_side_pool_graduated_election_v2('${f.actor}','${f.tid}','${f.eid}','${sidePool}',${json({policyId:amountPolicy.policyId,participantId:f.pid(n),electionId:op(600+n),expectedVersion:0,elected:true,receivedMinor:1000,paymentMethod:'cash',paymentReference:'TEST ONLY SYNTHETIC: no actual Side cash',reason:'TEST ONLY SYNTHETIC: fictional exact disclosure acknowledgment'})},'${op(700+n)}');`),'side_pool_election_saved_v2');

 assert.equal(read(`select count(*)::integer from app.synthetic_event_provenance_v1 where tournament_id='${f.tid}'and entity_table='roster_payment_events';`),17);
  }else{sql(f.financeSql);expenses();}
  for(const phase of['seatingAttendanceSql','publishSql','startSql'])sql(f[phase]);
  const games=read(`select jsonb_agg(jsonb_build_object('id',g.id,'round',r.round_number,'a',g.side_a_participant_id,'b',g.side_b_participant_id)order by g.id)from app.canonical_games g join app.rounds r on r.id=g.round_id where g.event_id='${f.eid}';`);
  const plans=f.matches.map(m=>{const g=games.find(g=>g.round===m.gameNumber&&g.a===f.pid(m.a)&&g.b===f.pid(m.b));assert.ok(g,'exact scheduled match');return{...m,gameId:g.id,winnerSide:m.winner===m.a?'a':'b'};});
  const legacy=withQ?[]:plans.slice(0,15),structured=plans.slice(legacy.length);
  const complete=(p,index,synthetic,A,B)=>`public.${synthetic?'complete_synthetic_paper_game_v1':'complete_paper_vs_paper_game_v1'}('${checker}','${f.tid}','${f.eid}','${p.gameId}','${op(1000+index)}',1,${json(A)},${json(B)},'${op(2000+index)}')`;
  const review=(p,index,synthetic,A,B)=>synthetic?`public.review_synthetic_paper_game_v1('${checker}','${f.tid}','${op(1000+index)}','approve',1,${json(A)},${json(B)},'${op(3000+index)}')`:`public.review_paper_vs_paper_game_v1('${checker}','${op(1000+index)}',1,${json(A)},${json(B)},'approve','${op(3000+index)}')`;
  for(let i=0;i<legacy.length;i++){const p=legacy[i],A={winnerSide:p.winnerSide,margin:p.margin,evidenceReference:`LOCAL prior compatibility card A ${i}`},B={...A,evidenceReference:`LOCAL prior compatibility card B ${i}`};assertStatus(read('select '+complete(p,i,false,A,B)+';'),'pending_review');assertStatus(read('select '+review(p,i,false,A,B)+';'),'approved');}
  const legacyIds=legacy.map(p=>p.gameId),legacyWhere=`canonical_game_id=any(${json(legacyIds)}::jsonb::text[])`;
  const oldIdentity=legacy.length?sql(`select jsonb_build_object('games',(select jsonb_agg(to_jsonb(x)order by id)from app.canonical_games x where id in(${legacyIds.map(x=>"'"+x+"'").join(',')})),'captures',(select jsonb_agg(to_jsonb(x)order by id)from app.paper_game_completions x where canonical_game_id in(${legacyIds.map(x=>"'"+x+"'").join(',')})),'reviews',(select jsonb_agg(to_jsonb(x)order by id)from app.paper_game_completion_reviews x where canonical_game_id in(${legacyIds.map(x=>"'"+x+"'").join(',')})));`):null;
  const oldLedger={payments:snapshot('roster_payment_events',`tournament_id='${f.tid}'`),expenses:snapshot('tournament_expense_events',`tournament_id='${f.tid}'`)};
  if(!withQ)enroll();
  let prepare='';for(const p of structured)prepare+=`select app.prepare_synthetic_paper_artifact_v1('${p.gameId}','${p.winnerSide}',${p.margin});`;sql(prepare);
  const paper=read(`select public.get_synthetic_paper_evidence_v1('${checker}','${f.tid}');`);let batch='';
  for(let n=0;n<structured.length;n++){
   const p=structured[n],index=n+legacy.length,a=paper.artifacts.find(a=>a.gameId===p.gameId);assert.ok(a);
   const parse=card=>{assert.equal(crypto.createHash('sha256').update(card.text).digest('hex'),card.sha256);return{winnerSide:/Winner side: ([ab])\n/.exec(card.text)[1],margin:Number(/Spread points: (\d+)\n/.exec(card.text)[1]),evidenceReference:card.reference};};
   const A=parse(a.sideA),B=parse(a.sideB);assert.deepEqual([A.winnerSide,A.margin],[B.winnerSide,B.margin]);
   batch+=`do $$declare r jsonb;begin r:=${complete(p,index,true,A,B)};if r->>'status'<>'pending_review'then raise exception'synthetic capture %',r;end if;r:=${review(p,index,true,parse(a.sideA),parse(a.sideB))};if r->>'status'<>'approved'then raise exception'synthetic review %',r;end if;end$$;`;
  }sql(batch);
  assert.equal(read(`select count(*)::integer from app.canonical_games where event_id='${f.eid}'and state='verified';`),102);
  assert.equal(read(`select count(*)::integer from app.synthetic_paper_provenance_v1 where event_id='${f.eid}'and phase='review';`),structured.length);
  console.log('PASS LOCAL',withQ?'Q Side':'No Q',102,'verified games; new structured',structured.length,'legacy unchanged',legacy.length);
  // BEFORE guards run before foreign-key enforcement. Every adversarial fixture
  // edit is enclosed in a rolled-back exception subtransaction.
  sql(`do $$declare r app.roster_payment_events%rowtype;begin
   select * into r from app.roster_payment_events where tournament_id='${f.tid}'limit 1;
   begin r.id:='${op(3900)}';r.roster_entry_id:='${checker}';insert into app.roster_payment_events select(r).*;raise exception 'guard_not_rejected';exception when others then if sqlerrm<>'synthetic_financial_roster_scope'then raise;end if;end;
   begin
    update app.events set operational_state='retired'where id='${f.eid}';
    insert into app.events select(jsonb_populate_record(null::app.events,to_jsonb(e)||jsonb_build_object('id','${op(3899)}','name','LOCAL ordinary sibling','operational_state','active'))).* from app.events e where id='${f.eid}';
    r.roster_entry_id:='${f.rid(1)}';r.receipt_note:='TEST ONLY SYNTHETIC: inactive enrolled scope';insert into app.roster_payment_events select(r).*;raise exception 'guard_not_rejected';
   exception when others then if sqlerrm<>'synthetic_financial_scope_ambiguous'then raise;end if;end;
   begin r.roster_entry_id:='${f.rid(1)}';r.receipt_note:='misleading actual cash';insert into app.roster_payment_events select(r).*;raise exception 'guard_not_rejected';exception when others then if sqlerrm<>'synthetic_financial_memo_required'then raise;end if;end;
  end$$;`);
  sql(`begin;set request.jwt.claim.sub='${f.actor}';set request.jwt.claims='{"role":"service_role","sub":"${f.actor}"}';
   create function pg_temp.fail_synthetic_annotation()returns trigger language plpgsql as $$begin raise exception'test_annotation_failure';end$$;
   create trigger test_atomic_annotation before insert on app.synthetic_event_provenance_v1 for each row execute function pg_temp.fail_synthetic_annotation();
   do $$declare before_count bigint;begin select count(*)into before_count from app.tournament_expense_events where tournament_id='${f.tid}';
    begin perform public.record_tournament_expense('${f.tid}',100,'USD','TEST ONLY SYNTHETIC: atomic failure test','${op(3890)}');exception when others then if sqlerrm<>'test_annotation_failure'then raise;end if;end;
    if(select count(*)from app.tournament_expense_events where tournament_id='${f.tid}')<>before_count or exists(select 1 from app.operation_receipts where client_operation_id='${op(3890)}'and outcome='accepted')then raise exception'annotation_failed_not_atomic';end if;
   end$$;rollback;`);
  const context=()=>read(`select public.get_synthetic_event_context_v1('${f.actor}','${f.tid}');`);assert.ok(isSyntheticEventContext(context(),f.tid));
  const prep=(kind,decision)=>read(`select to_jsonb(app.prepare_synthetic_event_artifact_v1('${f.actor}','${f.tid}','${f.eid}','${kind}',${json(decision)}));`);
  const artifact=id=>context().artifacts.find(a=>a.artifactId===id);
  const close=artifact(prep('close',{}));assert.equal(close.payload.verifiedGames,102);assert.equal(close.payload.structuredSyntheticGames,structured.length);assert.equal(close.payload.legacyVerifiedGamesWithoutStructuredProof,legacy.length);
  const closeReason='TEST ONLY SYNTHETIC: '+close.reference+' verified software counts';
  const closeCall=key=>`select public.close_synthetic_event_v1('${f.actor}','${f.tid}','${f.eid}','${close.artifactId}','${closeReason}',true,'${key}');`;
  expectGuard(`select public.close_event_play_v1('${f.actor}','${f.tid}','${f.eid}','ordinary physical assertion',true,'${op(3990)}');`,/synthetic_event_evidence_required/);
  const closeRace=await race(f.tid,closeCall(op(4000)),closeCall(op(4001)),withQ?'qclose':'nclose');
  const closed=closeRace[0];assertStatus(closed,'event_play_closed');assertStatus(closeRace[1],'already_closed');assert.deepEqual(read(closeCall(op(4000))),closed);
  assert.equal(read(`select public.close_synthetic_event_v1('${f.actor}','${f.tid}','${f.eid}','${close.artifactId}','${closeReason} altered',true,'${op(4000)}');`).code,'idempotency_conflict');

  const scoreBefore=sql(`select md5(jsonb_agg(to_jsonb(x)order by line_id)::text)from app.current_effective_scorelines('${f.tid}','${f.eid}')x;`);
  let tieReplay=null;
  if(!withQ){
   const ties=read(`select public.get_qualification_tie_workspace_v1('${f.actor}','${f.tid}','${f.eid}');`),g=ties.groups.find(g=>g.method==='one_game_playoff');assert.ok(g,'planned manual qualification tie');
   const tie=artifact(prep('qualification_tie',{participantIds:g.candidateIds,winnerId:f.pid(1),method:'one_game_playoff'}));
   const request={...tie.payload,reason:'TEST ONLY SYNTHETIC: simulated tiebreak outcome, no played physical game',evidenceReference:tie.reference};
   const call=(aid,req,key,actor=f.actor)=>`select public.save_synthetic_qualification_tie_v1('${actor}','${f.tid}','${f.eid}',${aid?"'"+aid+"'":'null'},${json(req)},'${key}');`;
   rejected(read(call(op(9999),request,op(4090))));rejected(read(call(tie.artifactId,{...request,winnerId:op(9998)},op(4091))));rejected(read(call(tie.artifactId,request,op(4092),checker)));
   expectGuard(`select public.save_qualification_tie_resolution_v1('${f.actor}','${f.tid}','${f.eid}',${json(request)},'${op(4093)}');`,/synthetic_event_evidence_required/);
   const opposing=artifact(prep('qualification_tie',{participantIds:g.candidateIds,winnerId:g.candidateIds.find(x=>x!==f.pid(1)),method:'one_game_playoff'}));
   const opposingRequest={...opposing.payload,reason:request.reason,evidenceReference:opposing.reference};
   const tieRace=await race(f.tid,call(tie.artifactId,request,op(4100)),call(opposing.artifactId,opposingRequest,op(4101)),'tie');
   const result=tieRace[0];assertStatus(result,'qualification_tie_recorded');rejected(tieRace[1]);
   assert.equal(read(call(tie.artifactId,{...request,reason:request.reason+' changed'},op(4100))).code,'idempotency_conflict');

   tieReplay={artifact:tie,request,result};assert.equal(sql(`select md5(jsonb_agg(to_jsonb(x)order by line_id)::text)from app.current_effective_scorelines('${f.tid}','${f.eid}')x;`),scoreBefore);
  }
  sql(f.finalizeSql);
  const playoffW=read(`select public.get_standard_singles_playoff_outcome_workspace_v4('${f.actor}','${f.tid}','${f.eid}');`),ids=playoffW.qualifiers.map(q=>q.participantId),series=[[ids[3],ids[4]],[ids[0],ids[3]],[ids[1],ids[2]],[ids[0],ids[1]]].map(([winnerId,loserId])=>({winnerId,loserId}));
  const playoff=artifact(prep('playoff',series)),playoffReq={...playoff.payload,series:series.map((s,i)=>({...s,evidenceNote:playoff.reference+':'+(i+1)})),reason:'TEST ONLY SYNTHETIC: four simulated series; no physical matches',reviewed:true};
  expectGuard(`select to_jsonb(app.prepare_synthetic_event_artifact_v1('${f.actor}','${f.tid}','${f.eid}','playoff',${json(series.map((x,i)=>i===0?{...x,loserId:x.winnerId}:x))}));`,/synthetic_decision_invalid/);
  expectGuard(`select public.record_standard_singles_playoff_outcomes_v4('${f.actor}','${f.tid}','${f.eid}',${json(playoffReq)},'${op(4190)}');`,/synthetic_event_evidence_required/);
  const played=read(`select public.record_synthetic_playoff_v1('${f.actor}','${f.tid}','${f.eid}','${playoff.artifactId}',${json(playoffReq)},'${op(4200)}');`);assertStatus(played,'playoff_outcomes_recorded_v4');
  assert.deepEqual(read(`select public.record_synthetic_playoff_v1('${f.actor}','${f.tid}','${f.eid}','${playoff.artifactId}',${json(playoffReq)},'${op(4200)}');`),played);
  if(withQ){
   const q=read(`select public.get_q_obligation_review_workspace_v2('${f.actor}','${f.tid}');`);assert.deepEqual(q.blockers,[]);assert.equal(q.preview.length,1);assert.deepEqual(q.preview[0].rows.map(r=>r.amountMinor),[8500,5500,3000]);
   assertStatus(read(`select public.record_q_obligation_review_v2('${f.actor}','${f.tid}',${json({expectedVersion:0,sourceDigest:q.sourceDigest,reason:'TEST ONLY SYNTHETIC: current simulated Q obligations remain unpaid',reviewed:true})},'${op(4300)}');`),'q_obligations_recorded_v2');
   const s=read(`select public.get_side_pool_recipient_workspace_v3('${f.actor}','${f.tid}','${f.eid}','${sidePool}');`);assert.deepEqual(s.blockers,[]);assert.deepEqual(s.obligations.map(r=>r.amountMinor),[8500,5500,3000]);
   assertStatus(read(`select public.record_side_pool_recipient_review_v3('${f.actor}','${f.tid}','${f.eid}','${sidePool}',${json({expectedVersion:0,sourceDigest:s.sourceDigest,reason:'TEST ONLY SYNTHETIC: current simulated Side obligations remain unpaid',reviewed:true})},'${op(4301)}');`),'side_pool_recipients_reviewed_unpaid');
  }
  const version=withQ?'v9':'v8',work=()=>read(`select public.get_prize_accounting_workspace_${version}('${f.actor}','${f.tid}','${f.eid}');`),w=work();assert.deepEqual(w.blockers,[],JSON.stringify(w));
  const classes=w.facts.expenseEvidence.map(e=>({expenseEventId:e.expenseEventId,category:expenseRows.find(([,c])=>e.description.endsWith(c))[1],evidenceReference:'TEST ONLY SYNTHETIC: classified simulated ledger evidence'}));
  const draftReq={expectedVersion:0,sourceDigest:w.sourceDigest,expenseClassifications:classes,reason:'TEST ONLY SYNTHETIC: reviewed simulated ledger; nobody paid',reviewed:true};
  const draft=read(`select public.save_prize_accounting_draft_${version}('${f.actor}','${f.tid}','${f.eid}',${json(draftReq)},'${op(4400)}');`);assertStatus(draft,'prize_accounting_draft_saved_'+version);
  assertStatus(read(`select public.finalize_cross_checking_v1('${f.actor}','${f.tid}','${op(4500)}');`),'cross_checking_finalized');
  const up=read(`select app.calculate_regular_prize_rounding_v3(${json({grossBaseIncomeMinor:51000,expenseTotalMinor:22950,benefitExpenseMinor:15300,expectedQualifierCount:5,cohorts:w.regularRule.rule.cohorts})});`);
  assert.equal(up.roundedBudgetMinor,28500);assert.equal(up.requiredFundingMinor,450);
  assert.equal(read(`select app.prize_rounding_funding_${version}('${f.tid}','${f.eid}',450);`).shortfallMinor,450);
  expectGuard(`insert into app.prize_rounding_funding_events_${version} select(jsonb_populate_record(null::app.prize_rounding_funding_events_${version},${json({tournament_id:f.tid,event_id:f.eid})})).*;`,/synthetic_actual_funding_unsupported/);
  assert.equal(read(`select count(*)::integer from app.prize_rounding_funding_events_${version} where tournament_id='${f.tid}';`),0);
  const finalReq={expectedVersion:0,draftId:draft.draftId,draftVersion:1,expectedFundingVersion:0,reason:'TEST ONLY SYNTHETIC: unpaid software accounting only',reviewed:true};
  const final=read(`select public.finalize_prize_accounting_${version}('${f.actor}','${f.tid}','${f.eid}',${json(finalReq)},'${op(4600)}');`);assertStatus(final,'prize_accounting_finalized_unpaid_'+version);
  assert.deepEqual(read(`select public.finalize_prize_accounting_${version}('${f.actor}','${f.tid}','${f.eid}',${json(finalReq)},'${op(4600)}');`),final);
  assert.deepEqual(read(closeCall(op(4000))),closed,'accepted close replay after qualification/accounting');
  if(tieReplay)assert.deepEqual(read(`select public.save_synthetic_qualification_tie_v1('${f.actor}','${f.tid}','${f.eid}','${tieReplay.artifact.artifactId}',${json(tieReplay.request)},'${op(4100)}');`),tieReplay.result,'accepted tie replay after final qualification');
  rejected(read(`begin;delete from app.tournament_roles where tournament_id='${f.tid}'and profile_id='${f.actor}';${closeCall(op(4000))}rollback;`));
  assert.equal(read(`select public.close_synthetic_event_v1('${f.actor}','${f.tid}','${f.eid}','${playoff.artifactId}','${closeReason}',true,'${op(4000)}');`).code,'idempotency_conflict');
  const fw=work();assert.equal(fw.finalization.status,'unpaid');assert.equal(fw.draft.rounding.originalBudgetMinor,28050);assert.equal(fw.draft.rounding.roundedBudgetMinor,28000);assert.equal(fw.draft.rounding.benefitExpenseMinor,16000);assert.equal(fw.draft.rounding.participantReturnMinor,44000);assert.equal(fw.draft.rounding.restrictedBalanceMinor,50);assert.deepEqual(fw.draft.awards.map(a=>a.totalAwardMinor),[9500,7000,4500,4500,2500]);
  assert.equal(fw.facts.receiptTotalMinor,withQ?85000:51000);assert.equal(fw.facts.receiptTotalMinor,fw.facts.expenseTotalMinor+28000+(withQ?34000:0)+50);
  assert.equal(snapshot('roster_payment_events',`tournament_id='${f.tid}'`),oldLedger.payments);assert.equal(snapshot('tournament_expense_events',`tournament_id='${f.tid}'`),oldLedger.expenses);
  if(legacy.length){const current=sql(`select jsonb_build_object('games',(select jsonb_agg(to_jsonb(x)order by id)from app.canonical_games x where id in(${legacyIds.map(x=>"'"+x+"'").join(',')})),'captures',(select jsonb_agg(to_jsonb(x)order by id)from app.paper_game_completions x where canonical_game_id in(${legacyIds.map(x=>"'"+x+"'").join(',')})),'reviews',(select jsonb_agg(to_jsonb(x)order by id)from app.paper_game_completion_reviews x where canonical_game_id in(${legacyIds.map(x=>"'"+x+"'").join(',')})));`);assert.equal(current,oldIdentity);assert.equal(read(`select count(*)::integer from app.synthetic_paper_provenance_v1 where game_id in(${legacyIds.map(x=>"'"+x+"'").join(',')});`),0);}
  assert.equal(read(`select count(*)::integer from app.synthetic_event_provenance_v1 where actual_money_received or physical_play or human_review_claimed or money_moved;`),0);
  checks.push(`${withQ?'Q17+Side17':'NoQ15legacy+87new'}:102 scores, source-bound simulated close/${withQ?'no monetary ties':'manual qualification tie'},5qualifiers/4series/3byes, unpaid ${version}, oldledger unchanged`);
  results.push({kind:withQ?'Q+Side':'NoQ',tournamentId:f.tid,eventId:f.eid,verifiedGames:102,legacyUnclassifiedGames:legacy.length,structuredSyntheticGames:structured.length,receiptsMinor:fw.facts.receiptTotalMinor,regularAwardsMinor:fw.draft.awards.map(a=>a.totalAwardMinor),qAwardsMinor:withQ?[8500,5500,3000]:[],sideAwardsMinor:withQ?[8500,5500,3000]:[],restrictedMinor:50,finalizationId:final.finalizationId,moneyMoved:false});
 }
 // Small direct synthetic baseline tests canonical H2H evidence, never a
 // claim of physical play. Digital/player assertions are not seeded.
 const digitalRoster=`insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id)values('02670000-0000-4000-8000-000000009030','${tieTid}','director_manual','LOCAL digital baseline','local digital baseline','digital','${tieActor}','c1310000-0000-4000-8000-000000000001');`;
 const seed=tieSeed('h2h').replace('insert into app.initial_seating_publications',digitalRoster+'insert into app.initial_seating_publications');sql('begin;'+seed+'commit;');
 sql(`set request.jwt.claim.sub='${tieActor}';set request.jwt.claims='{"role":"service_role","sub":"${tieActor}"}';do $$declare r jsonb;e app.tournament_expense_events%rowtype;begin
  r:=public.record_tournament_expense('${tieTid}',100,'USD','LOCAL ordinary non-enrolled expense','02670000-0000-4000-8000-000000009010');if r->>'status'<>'expense_recorded'then raise exception'ordinary expense %',r;end if;
  select*into e from app.tournament_expense_events where tournament_id='${tieTid}';
  r:=public.void_tournament_expense('${tieTid}',e.expense_id,1,e.id,'LOCAL ordinary correction','02670000-0000-4000-8000-000000009011');if r->>'status'<>'expense_voided'then raise exception'ordinary expense void %',r;end if;
  r:=public.set_roster_payment_obligation_v1('${tieTid}','d2430000-0000-4000-8000-000000000001',0,3000,'LOCAL base entry','02670000-0000-4000-8000-000000009012');if r->>'status'<>'payment_obligation_saved'then raise exception'ordinary owed %',r;end if;
  r:=public.record_manual_roster_payment('${tieTid}','d2430000-0000-4000-8000-000000000001',0,3000,'USD','cash',now(),'LOCAL ordinary receipt','02670000-0000-4000-8000-000000009013');if r->>'status'<>'payment_recorded'then raise exception'ordinary receipt %',r;end if;
  r:=public.void_manual_roster_payment('${tieTid}','d2430000-0000-4000-8000-000000000001',1,(r->>'paymentEventId')::uuid,'LOCAL ordinary correction','02670000-0000-4000-8000-000000009014');if r->>'status'<>'payment_voided'then raise exception'ordinary receipt void %',r;end if;
 end$$;`);
 sql(`insert into app.initial_seating_assignments(publication_id,tournament_id,roster_entry_id,initial_table_seat)select s.id,p.tournament_id,p.roster_entry_id,p.table_seat from app.event_participants p join app.initial_seating_publications s on s.tournament_id=p.tournament_id where p.event_id='${tieEid}';`);
 sql(`do $$declare ev app.events%rowtype;p app.event_participants%rowtype;begin
  select*into ev from app.events where id='${tieEid}';ev.id:='02670000-0000-4000-8000-000000009031';ev.name:='LOCAL identity guard probe';
  select*into p from app.event_participants where id='f2430000-0000-4000-8000-000000000001';p.id:='02670000-0000-4000-8000-000000009032';p.event_id:=ev.id;
  begin insert into app.events select(ev).*;p.roster_entry_id:=null;insert into app.event_participants select(p).*;insert into app.synthetic_paper_fixtures_v1(event_id,tournament_id,project_ref,authorization_reference)values(ev.id,'${tieTid}','nnhcnvksxgxnpvdqjgpg','LOCAL must reject missing roster');raise exception'guard_not_rejected';exception when others then if sqlerrm<>'synthetic_fixture_not_idle'then raise;end if;end;
  begin insert into app.events select(ev).*;p.roster_entry_id:='02670000-0000-4000-8000-000000009030';insert into app.event_participants select(p).*;insert into app.synthetic_paper_fixtures_v1(event_id,tournament_id,project_ref,authorization_reference)values(ev.id,'${tieTid}','nnhcnvksxgxnpvdqjgpg','LOCAL must reject nonpaper');raise exception'guard_not_rejected';exception when others then if sqlerrm<>'synthetic_fixture_not_idle'then raise;end if;end;
 end$$;`);

 const tw=read(`select public.get_qualification_tie_workspace_v1('${tieActor}','${tieTid}','${tieEid}');`);assert.equal(tw.groups[0].method,'head_to_head');
 const oldReq={expectedSourceFingerprint:tw.sourceFingerprint,participantIds:tw.groups[0].candidateIds,winnerId:tw.groups[0].headToHeadWinnerId,method:'head_to_head',reason:'LOCAL prior synthetic baseline',evidenceReference:'LOCAL old evidence'};
 const enrollTie=`insert into app.synthetic_paper_fixtures_v1(event_id,tournament_id,project_ref,authorization_reference)values('${tieEid}','${tieTid}','nnhcnvksxgxnpvdqjgpg','LOCAL H2H acceptance');`;
 const oldResult=read(`begin;select public.save_qualification_tie_resolution_v1('${tieActor}','${tieTid}','${tieEid}',${json(oldReq)},'02670000-0000-4000-8000-000000009001');${enrollTie}select public.save_synthetic_qualification_tie_v1('${tieActor}','${tieTid}','${tieEid}',null,${json(oldReq)},'02670000-0000-4000-8000-000000009001');rollback;`);assertStatus(oldResult,'qualification_tie_recorded');
 const legacyCloseReason='LOCAL pre-enrollment generated fixture closure';
 const legacyClosed=read(`select public.close_event_play_v1('${tieActor}','${tieTid}','${tieEid}','${legacyCloseReason}',true,'02670000-0000-4000-8000-000000009020');`);assertStatus(legacyClosed,'event_play_closed');
 sql(enrollTie);
 assert.deepEqual(read(`select public.close_synthetic_event_v1('${tieActor}','${tieTid}','${tieEid}',null,'${legacyCloseReason}',true,'02670000-0000-4000-8000-000000009020');`),legacyClosed);
sql(`do $$declare r app.roster_payment_events%rowtype;begin select*into r from app.roster_payment_events where event_type='received'limit 1;if not found then raise exception'test_receipt_fixture_missing';end if;r.tournament_id:='${tieTid}';r.id:='02670000-0000-4000-8000-000000009033';r.roster_entry_id:='02670000-0000-4000-8000-000000009030';r.receipt_note:='TEST ONLY SYNTHETIC: outside enrolled Main';begin insert into app.roster_payment_events select(r).*;raise exception'guard_not_rejected';exception when others then if sqlerrm<>'synthetic_financial_roster_scope'then raise;end if;end;end$$;`);
 assert.equal(read(`select count(*)::integer from app.synthetic_event_provenance_v1 where tournament_id='${tieTid}';`),0);
 const h2hId=read(`select to_jsonb(app.prepare_synthetic_event_artifact_v1('${tieActor}','${tieTid}','${tieEid}','qualification_tie',${json({participantIds:oldReq.participantIds,winnerId:oldReq.winnerId,method:'head_to_head'})}));`);
 const h=read(`select public.get_synthetic_event_context_v1('${tieActor}','${tieTid}');`).artifacts.find(a=>a.artifactId===h2hId),hreq={...h.payload,reason:'TEST ONLY SYNTHETIC: server-derived synthetic qualifying evidence',evidenceReference:h.reference};
 expectGuard(`select to_jsonb(app.prepare_synthetic_event_artifact_v1('${tieActor}','${tieTid}','${tieEid}','qualification_tie',${json({participantIds:oldReq.participantIds,winnerId:oldReq.participantIds.find(x=>x!==oldReq.winnerId),method:'head_to_head'})}));`,/synthetic_decision_invalid/);
 assertStatus(read(`select public.save_synthetic_qualification_tie_v1('${tieActor}','${tieTid}','${tieEid}','${h2hId}',${json(hreq)},'02670000-0000-4000-8000-000000009002');`),'qualification_tie_recorded');
 checks.push('Canonical H2H winner required; altered winner rejected; old accepted tie/close POSTs replay through null-artifact wrappers without provenance backfill; normal unenrolled receipt and expense voids still work');
 assert.equal(read(`select count(*)::integer from information_schema.role_table_grants where table_schema='app'and table_name in('synthetic_event_artifacts_v1','synthetic_event_provenance_v1')and grantee in('anon','authenticated','service_role');`),0);
 assert.equal(read(`select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('get_synthetic_event_context_v1','save_synthetic_qualification_tie_v1','record_synthetic_playoff_v1','close_synthetic_event_v1')and p.prosecdef and pg_get_userbyid(p.proowner)='postgres'and p.proconfig @> array['search_path=""']and has_function_privilege('service_role',p.oid,'execute')and not has_function_privilege('anon',p.oid,'execute')and not has_function_privilege('authenticated',p.oid,'execute');`),4);
 checks.push('Actual concurrent close and opposing tie writers serialized; raw physical paths, forged payloads/artifacts, wrong roles and changed replay rejected; revoked role cannot read prior accepted wrapper result');
 return{status:'PASS',checks,fixtures:results,physicalHumanAcceptance:false,hostedWrites:false};
}
