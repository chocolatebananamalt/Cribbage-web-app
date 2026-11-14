// Synthetic LOCAL actor/database tests. No physical play or independent humans claimed.
import assert from 'node:assert/strict';
import {buildMixedMockManifest}from'../src/lib/mixed-mock-plan.ts';
import {captureMixedNormalStartEvidence}from'./mixed-normal-start-evidence.mjs';
import {captureMixedQualifyingFinishEvidence}from'./mixed-qualifying-finish-evidence.mjs';
// LOCAL fixture seam only. Winners may change, but not margins, score authority
// or any eligibility/payout policy. Every writer and oracle uses the same plan.
export function applyMixedMockWinnerOverrides(raw,outcomeOverrides=[]){
 if(!Array.isArray(raw)||!Array.isArray(outcomeOverrides))throw new TypeError('Raw outcomes and explicit winner overrides must be arrays.');
 const byIndex=new Map();
 for(const value of outcomeOverrides){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='gameIndex,winnerSide'
   ||!Number.isInteger(value.gameIndex)||value.gameIndex<0||value.gameIndex>=raw.length||!['a','b'].includes(value.winnerSide)||byIndex.has(value.gameIndex))
   throw new TypeError('Winner overrides require unique valid gameIndex and winnerSide only.');
  byIndex.set(value.gameIndex,value.winnerSide);
 }
 return raw.map((g,i)=>({...g,winnerSide:byIndex.get(i)??g.winnerSide}));
}
export async function verifySyntheticMixedEighteen({q,read,startSession,fixture:f,afterEnrollment,closureDenialPattern=/synthetic_mixed_closure_not_supported/,outcomeOverrides=[]}){
 const checks=[],op=n=>`a2950000-0000-4000-8000-${String(n).padStart(12,'0')}`,j=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`;
 const normalStart=captureMixedNormalStartEvidence(read,f);
 if(typeof f.checkpoint==='function')f.checkpoint('normal-start',normalStart);
 checks.push('actual normal Start receipt/hash/audit, automatically bound sanctioning snapshot and exact replay; no synthetic Start row substitution');
 const checkerNumbers=[1,3,5],checkers=checkerNumbers.map(n=>f.uid(n));
 assert.equal(read("select has_function_privilege('authenticated','app.enroll_synthetic_mixed_fixture_v2(uuid,uuid,text,text)','EXECUTE');"),false);
 q("insert into app.synthetic_mixed_deployments_v1 values('nnhcnvksxgxnpvdqjgpg','LOCAL18 scoring protocol only');");
 assert.throws(()=>q(`select app.enroll_synthetic_mixed_fixture_v1('${f.tid}','${f.eid}','nnhcnvksxgxnpvdqjgpg','must not relabel18as17');`),/synthetic_mixed_fixture_not_idle/);
 q(`select app.enroll_synthetic_mixed_fixture_v2('${f.tid}','${f.eid}','nnhcnvksxgxnpvdqjgpg','LOCAL18 scoring protocol; no humans or money');`);
 // Optional LOCAL integration seam. Financial authority must already have been
 // established before any collection in the caller's separate constructor.
 if(afterEnrollment!==undefined){assert.equal(typeof afterEnrollment,'function');await afterEnrollment({q,read,fixture:f});}
 assert.deepEqual(read(`select jsonb_build_object('kind',protocol_kind,'participants',participant_count,'digital',digital_count,'paper',paper_count,'matches',match_count)from app.synthetic_mixed_enrollment_kinds_v2 where event_id='${f.eid}';`),
 {kind:'synthetic-mixed-18-v2',participants:18,digital:6,paper:12,matches:108});
 for(const [i,n]of checkerNumbers.entries()){
  q(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${f.tid}','${f.uid(n)}','cross_checker');${i===0?`insert into app.tournament_roles(tournament_id,profile_id,role)values('${f.tid}','${f.uid(n)}','co_director');`:''}`);
  assert.equal(read(`select public.bind_paper_official_identity_v1('${f.actor}','${f.tid}','${op(800+i)}','${f.uid(n)}','roster_entry','${f.rid(n)}',0,'${op(810+i)}');`).status,'bound');
 }
 const people=read(`select jsonb_agg(jsonb_build_object('participantId',p.id,'tournamentPlayerId',a.verification_id,'mode',r.scorecard_type,'profileId',p.profile_id)order by p.id)from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id join app.initial_seating_assignments a on a.tournament_id=p.tournament_id and a.roster_entry_id=p.roster_entry_id where p.event_id='${f.eid}';`);
 const games=read(`select jsonb_agg(jsonb_build_object('gameId',g.id,'batchNumber',r.round_number,'pairing',m.pairing,'digitalParticipantId',m.digital_participant_id,'digitalProfileId',m.digital_profile_id,
 'sideA',jsonb_build_object('participantId',g.side_a_participant_id,'currentSeat',g.side_a_table_seat_snapshot,'cardGameNumber',r.round_number),
 'sideB',jsonb_build_object('participantId',g.side_b_participant_id,'currentSeat',g.side_b_table_seat_snapshot,'cardGameNumber',r.round_number))order by r.round_number,g.side_a_table_seat_snapshot)from app.canonical_games g join app.rounds r on r.id=g.round_id join app.synthetic_mixed_games_v1 m on m.game_id=g.id where g.event_id='${f.eid}';`);
 const manifest=buildMixedMockManifest(people,games);assert.equal(manifest.matches.length,108);
 assert.equal(read(`select count(*)from app.odd_field_makeup_games_v1 where event_id='${f.eid}';`),0);
 const pairCounts={DD:0,PD:0,PP:0};for(const g of games)pairCounts[g.pairing]++;
 for(const p of people){const playerGames=games.filter(g=>[g.sideA.participantId,g.sideB.participantId].includes(p.participantId));assert.equal(new Set(playerGames.map(g=>g.sideA.participantId===p.participantId?g.sideB.participantId:g.sideA.participantId)).size,12);for(let round=1;round<=12;round++)assert.equal(playerGames.filter(g=>g.batchNumber===round).length,1);}
 checks.push('explicit18 protocol; six linked Digital/twelve unlinked Paper; current normal108 publication/start; zero byes; twelve distinct opponents and fixed first-game IDs');
 const margins=[1,30,31,60,61,90,91,121],gamePoints=new Map([[1,2],[30,2],[31,3],[60,3],[61,3],[90,3],[91,3],[121,3]]);
 const raw=applyMixedMockWinnerOverrides(games.map((g,i)=>({...g,index:i,winnerSide:i%2?'b':'a',margin:margins[i%8]})),outcomeOverrides);
 q(raw.filter(g=>g.pairing!=='DD').map(g=>`select app.prepare_synthetic_mixed_artifact_v1('${g.gameId}','${g.winnerSide}',${g.margin});`).join(''));
 const workspace=read(`select public.get_synthetic_mixed_workspace_v1('${checkers[0]}','${f.tid}');`),artifacts=new Map(workspace.artifacts.map(a=>[a.gameId,a]));
 assert.equal(artifacts.size,pairCounts.PP+pairCounts.PD);
 const expected=new Map(people.map(p=>[p.participantId,{games:0,wins:0,gamePoints:0,positiveSpreadPoints:0,negativeSpreadPoints:0}]));
 const profile=p=>people.find(x=>x.participantId===p).profileId;
 const eligible=g=>checkers.filter(c=>![profile(g.sideA.participantId),profile(g.sideB.participantId)].includes(c));
 const claim=(g,side)=>({winnerSide:g.winnerSide,margin:g.margin,evidenceReference:artifacts.get(g.gameId)[side==='a'?'sideAReference':'sideBReference']});
 const ppRequest=g=>({gameId:g.gameId,completionId:op(1000+g.index),artifactId:artifacts.get(g.gameId).artifactId,expectedGameVersion:1,sideAClaim:claim(g,'a'),sideBClaim:claim(g,'b')});
 const ppCall=(g,who=eligible(g)[0],operation=op(2000+g.index))=>`select public.capture_synthetic_mixed_paper_v1('${who}','${f.tid}','${f.eid}',${j(ppRequest(g))},'${operation}');`;
 // Two real PostgreSQL sessions: native actor/op->tournament lock order versus
 // the wrapper, then exact same wrapper operation replay under contention.
 async function overlap(firstQuery,secondQuery,who,tag){
  const first=startSession(`begin;${firstQuery}select 'HOLDER_READY';select pg_sleep(2);commit;`,who,'service_role',tag+'-holder');
  for(let i=0;i<100&&!first.out().includes('HOLDER_READY');i++)await new Promise(r=>setTimeout(r,20));
  assert.ok(first.out().includes('HOLDER_READY'),'First session reached the held transaction');
  const second=startSession(`begin;${secondQuery}commit;`,who,'service_role',tag+'-waiter');
  let blocked=false;for(let i=0;i<30;i++){const state=read(`select coalesce(bool_or(wait_event_type='Lock'),false)from pg_stat_activity where application_name='${tag}-waiter';`);if(state){blocked=true;break;}await new Promise(r=>setTimeout(r,20));}
  assert.ok(blocked,'Independent second session actually waited on a lock');
  const both=await Promise.all([first.done,second.done]);return both.map(t=>t.split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).at(-1));
 }
 const firstPP=raw.find(g=>g.batchNumber===1&&g.pairing==='PP'),firstDD=raw.find(g=>g.batchNumber===1&&g.pairing==='DD');assert.ok(firstPP&&firstDD);
 const raceActor=eligible(firstPP).find(w=>![profile(firstDD.sideA.participantId),profile(firstDD.sideB.participantId)].includes(w));assert.ok(raceActor);
 const raceOp=op(900),native=`select public.complete_paper_vs_paper_game_v1('${raceActor}','${f.tid}','${f.eid}','${firstDD.gameId}','${op(901)}',1,${j({winnerSide:'a',margin:20,evidenceReference:'LOCAL no-paper-pair probe A'})},${j({winnerSide:'a',margin:20,evidenceReference:'LOCAL no-paper-pair probe B'})},'${raceOp}');`;
 const wrongOpResults=await overlap(native,ppCall(firstPP,raceActor,raceOp),raceActor,'mixed18-native-wrapper');assert.equal(wrongOpResults[0].status,'rejected');assert.equal(wrongOpResults[1].code,'idempotency_conflict');
 const raceCapture=ppCall(firstPP,raceActor),sameOpResults=await overlap(raceCapture,raceCapture,raceActor,'mixed18-same-operation');assert.equal(sameOpResults[0].status,'pending_review');assert.deepEqual(sameOpResults[1],sameOpResults[0]);
 assert.equal(read(`select count(*)from app.paper_game_completions where canonical_game_id='${firstPP.gameId}';`),1);
 checks.push('actual two-session native/wrapper actor-op race rejects foreign receipt; same-operation wrapper race blocks then replays one capture without deadlock');
 let pdNegativeDone=false,ddNegativeDone=false;
 for(const g of raw){
  const officials=eligible(g);assert.ok(officials.length>=1);const first=officials[0],second=officials[1];
  if(g.pairing==='DD'){
   if(!ddNegativeDone){const outsider=people.find(p=>p.mode==='digital'&&![g.sideA.participantId,g.sideB.participantId].includes(p.participantId));assert.equal(read(`select public.submit_game_score('${g.gameId}','${op(30000+g.index)}',1::smallint,'${g.winnerSide}',${g.margin},'${op(31000+g.index)}');`,outsider.profileId,'authenticated').status,'rejected');ddNegativeDone=true;}
   for(const [i,s]of[g.sideA,g.sideB].entries())assert.equal(read(`select public.submit_game_score('${g.gameId}','${op(4000+g.index*2+i)}',${i+1}::smallint,'${g.winnerSide}',${g.margin},'${op(5000+g.index*2+i)}');`,profile(s.participantId),'authenticated').status,i===0?'submitted':'confirmation_pending');
   for(const [i,s]of[g.sideA,g.sideB].entries())assert.equal(read(`select public.confirm_game_score('${g.gameId}','${op(4000+g.index*2+i)}','${op(6000+g.index*2+i)}');`,profile(s.participantId),'authenticated').status,i===0?'confirmation_pending':'verified');
  }else if(g.pairing==='PP'){
   const captured=read(ppCall(g,g.gameId===firstPP.gameId?raceActor:first));assert.equal(captured.status,'pending_review');
   const req=ppRequest(g);delete req.gameId;req.decision='approve';const recorder=g.gameId===firstPP.gameId?raceActor:first,reviewer=officials.find(w=>w!==recorder)??recorder;assert.equal(read(`select public.review_synthetic_mixed_paper_v1('${reviewer}','${f.tid}','${f.eid}',${j(req)},'${op(7000+g.index)}');`).status,'approved');
  }else{
   assert.ok(second,'PD needs two nonself officials');const a=artifacts.get(g.gameId),sid=op(8000+g.index),digitalSlot=g.digitalParticipantId===g.sideA.participantId?1:2,paperSide=digitalSlot===1?'b':'a';
   const ack={gameId:g.gameId,artifactId:a.artifactId,expectedGameVersion:2,digitalSubmissionId:sid,confirmed:true};
   const attest=(request=ack,operation=op(10000+g.index))=>`select public.attest_synthetic_mixed_hybrid_v1('${f.tid}','${f.eid}',${j(request)},'${operation}');`;
   if(!pdNegativeDone){
    const badMargin=g.margin===121?120:g.margin+1;
    const badSubmit=`select public.submit_game_score('${g.gameId}','${sid}',${digitalSlot}::smallint,'${g.winnerSide}',${badMargin},'${op(32000+g.index)}');`;
    const rejected=read(badSubmit,g.digitalProfileId,'authenticated');assert.equal(rejected.code,'submission_rejected');assert.deepEqual(read(badSubmit,g.digitalProfileId,'authenticated'),rejected);
    assert.equal(read(`select public.submit_game_score('${g.gameId}','${sid}',${digitalSlot}::smallint,'${g.winnerSide==='a'?'b':'a'}',${g.margin},'${op(33000+g.index)}');`,g.digitalProfileId,'authenticated').code,'submission_rejected');
    assert.equal(read(`select count(*)from app.score_submissions where canonical_game_id='${g.gameId}';`),0);
    assert.deepEqual(read(`select jsonb_build_object('state',state,'version',version)from app.canonical_games where id='${g.gameId}';`),{state:'pending',version:1});
    assert.equal(read(`select count(*)from app.audit_events where canonical_game_id='${g.gameId}'and action='submission_rejected';`),2);
   }
   const ownSubmission=read(`select public.submit_game_score('${g.gameId}','${sid}',${digitalSlot}::smallint,'${g.winnerSide}',${g.margin},'${op(9000+g.index)}');`,g.digitalProfileId,'authenticated');assert.equal(ownSubmission.status,'submitted',JSON.stringify({game:g.index,pairing:g.pairing,digitalSlot,result:ownSubmission}));
   if(!pdNegativeDone){assert.equal(read(attest(ack,op(34000+g.index)),people.find(p=>p.mode==='digital'&&p.profileId!==g.digitalProfileId).profileId,'authenticated').status,'rejected');}
   const attested=read(attest(),g.digitalProfileId,'authenticated');assert.equal(attested.status,'synthetic_opponent_acknowledged');assert.equal(attested.authoritative,false);assert.deepEqual(read(attest(),g.digitalProfileId,'authenticated'),attested);
   const req={gameId:g.gameId,caseId:op(11000+g.index),artifactId:a.artifactId,expectedGameVersion:2,digitalSubmissionId:sid,paperClaim:claim(g,paperSide)};
   const capture=(who,request=req,operation=op(12000+g.index))=>`select public.capture_synthetic_mixed_hybrid_v1('${who}','${f.tid}','${f.eid}',${j(request)},'${operation}');`;
   if(!pdNegativeDone){
    assert.equal(read(capture(g.digitalProfileId,req,op(35000+g.index))).status,'rejected');
    assert.equal(read(capture(first,{...req,paperClaim:{...req.paperClaim,margin:g.margin===121?120:g.margin+1}},op(36000+g.index))).code,'invalid_request');
   }
   const captured=read(capture(first));assert.equal(captured.status,'pending_review');assert.deepEqual(read(capture(first)),captured);
   const review={caseId:req.caseId,artifactId:a.artifactId,expectedGameVersion:2,digitalSubmissionId:sid,digitalWinnerSide:g.winnerSide,digitalMargin:g.margin,paperClaim:req.paperClaim,decision:'approve'};
   const reviewCall=(who,request=review,operation=op(13000+g.index))=>`select public.review_synthetic_mixed_hybrid_v1('${who}','${f.tid}','${f.eid}',${j(request)},'${operation}');`;
   if(!pdNegativeDone){
    const denied=read(reviewCall(first,review,op(37000+g.index)));assert.equal(denied.status,'rejected');assert.deepEqual(read(reviewCall(first,review,op(37000+g.index))),denied);
    assert.equal(read(reviewCall(second,{...review,digitalMargin:g.margin===121?120:g.margin+1},op(38000+g.index))).status,'rejected');pdNegativeDone=true;
   }
   const approved=read(reviewCall(second));assert.equal(approved.status,'approved');assert.deepEqual(read(reviewCall(second)),approved);
  }
  for(const[side,s]of[['a',g.sideA],['b',g.sideB]]){const row=expected.get(s.participantId);row.games++;if(side===g.winnerSide){row.wins++;row.gamePoints+=gamePoints.get(g.margin);row.positiveSpreadPoints+=g.margin;}else row.negativeSpreadPoints+=g.margin;}
  if(g.index%9===8)console.log('LOCAL mixed scoring round complete',g.batchNumber,'verified',g.index+1);
 }
 const totals=read(`select jsonb_agg(to_jsonb(t))from(select participant_id,count(*) games,sum(case when is_winner then 1 else 0 end)wins,sum(game_points)game_points,sum(plus_points)positive_spread_points,sum(minus_points)negative_spread_points from app.card_scorelines where event_id='${f.eid}'group by participant_id)t;`);
 assert.equal(totals.length,18);for(const row of totals){const e=expected.get(row.participant_id);assert.deepEqual([row.games,row.wins,row.game_points,row.positive_spread_points,row.negative_spread_points],[e.games,e.wins,e.gamePoints,e.positiveSpreadPoints,e.negativeSpreadPoints]);assert.equal(row.games,12);}
 const counts=read(`select jsonb_build_object('verified',(select count(*)from app.canonical_games where event_id='${f.eid}'and state='verified'),'scorelines',(select count(*)from app.card_scorelines where event_id='${f.eid}'),'submissions',(select count(*)from app.score_submissions where event_id='${f.eid}'),'confirmations',(select count(*)from app.score_confirmations where event_id='${f.eid}'),'attestations',(select count(*)from app.synthetic_mixed_attestations_v1 where event_id='${f.eid}'),'provenance',(select count(*)from app.synthetic_mixed_provenance_v1 where event_id='${f.eid}'),'falseClaims',(select count(*)from app.synthetic_mixed_provenance_v1 where physical_original or fictional_opponent_played or independent_human_play_claimed),'gamePoints',(select sum(game_points)from app.card_scorelines where event_id='${f.eid}'),'positiveSpreadPoints',(select sum(plus_points)from app.card_scorelines where event_id='${f.eid}'),'negativeSpreadPoints',(select sum(minus_points)from app.card_scorelines where event_id='${f.eid}'));`);
 assert.deepEqual(counts,{verified:108,scorelines:216,submissions:pairCounts.DD*2+pairCounts.PD,confirmations:pairCounts.DD*2,attestations:pairCounts.PD,provenance:(pairCounts.PP+pairCounts.PD)*2,falseClaims:0,gamePoints:296,positiveSpreadPoints:6427,negativeSpreadPoints:6427});
 assert.ok(read(`select count(*)from app.paper_game_completion_reviews where reviewer_profile_id='${checkers[0]}'and reviewer_role='co_director';`)>0);
 assert.equal(read(`select count(*)from app.synthetic_mixed_artifacts_v1 a join app.synthetic_mixed_games_v1 m on m.game_id=a.game_id where m.pairing='DD';`),0);
 checks.push('all108mixedmatches verified; actual authenticated own actors; three player-bound rotating officials including co-director; PD mismatch/ownself/same-reviewer rejected; no fabricated DD artifacts or PD ordinary confirmations');
 checks.push('independent hand-checked game-point boundary table/raw-outcome oracle matches all eighteen cards: twelve games each,296 game points,+6427/-6427 spread points');
 const qualifyingFinish=captureMixedQualifyingFinishEvidence(read,f,manifest,normalStart);
 if(typeof f.checkpoint==='function')f.checkpoint('qualifying-finish',qualifyingFinish);
 checks.push('all stored PP/PD provenance binds distinct nonself capture/review actors, truthful synthetic flags, unchanged Start and fixed Tournament IDs through qualifying');
 assert.throws(()=>q(`insert into app.qualification_result_versions(tournament_id,event_id)values('${f.tid}','${f.eid}');`),closureDenialPattern);
 assert.throws(()=>q(`insert into app.roster_payment_events(tournament_id)values('${f.tid}');`),closureDenialPattern);
 checks.push('qualification/playoff/financial closure remains intentionally blocked; no payment movement or human acceptance asserted');
 return{checks,passed:checks.length,pairCounts,...counts,normalStart,qualifyingFinish,participants:18,uniquePairs:108,gamesEach:12,actualHumanSessions:false,fixtureSetup:'synthetic historical setup then current publication/start/scoring',officials:'three player-bound cross-checkers, one also co-director; setup Director is not a seventh human',qualificationOrFinancialFinalization:false,
 expectedRawStandings:[...expected].map(([participantId,r])=>({participantId,recordedGames:r.games,wins:r.wins,gamePoints:r.gamePoints,positiveSpreadPoints:r.positiveSpreadPoints,negativeSpreadPoints:r.negativeSpreadPoints,netSpreadPoints:r.positiveSpreadPoints-r.negativeSpreadPoints})),
 oracleSource:'scripted local raw outcomes and authenticated test entries; not actual human games',outcomeOverrides:outcomeOverrides.map(o=>({...o}))};
}
