import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {isSyntheticPaperWorkspace}from'../src/lib/api/synthetic-paper-evidence.ts';
export async function verifySyntheticPaperEvidence({sql,read,fixture:f,startSession}){
 const checks=[],op=n=>`a2660000-0000-4000-8000-${String(n).padStart(12,'0')}`,json=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
 const games=read(`select jsonb_agg(to_jsonb(g)order by g.id)from app.canonical_games g where event_id='${f.eid}';`);
 const g=games[0],ordinary=games[1];
 assert.equal(read(`select public.get_synthetic_paper_evidence_v1('${f.actor}','${f.tid}');`),null);
 assert.equal(read(`select has_table_privilege('service_role','app.synthetic_paper_fixtures_v1','INSERT');`),false);
 assert.equal(read(`select has_function_privilege('service_role','app.prepare_synthetic_paper_artifact_v1(uuid,text,integer)','EXECUTE');`),false);
 assert.equal(read(`select has_function_privilege('authenticated','public.complete_synthetic_paper_game_v1(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid)','EXECUTE');`),false);
 checks.push('default-off; owner-only enrollment/artifact preparation; no browser/table grants');
 const binding=read(`select public.bind_paper_official_identity_v1('${f.actor}','${f.tid}','${op(10)}','${f.actor}','nonparticipant',null,0,'${op(11)}');`);assert.equal(binding.status,'bound');
 const legacyA={winnerSide:'a',margin:19,evidenceReference:'LOCAL legacy compatibility card A'},legacyB={...legacyA,evidenceReference:'LOCAL legacy compatibility card B'};
 const legacyCapture=`select public.complete_paper_vs_paper_game_v1('${f.actor}','${f.tid}','${f.eid}','${ordinary.id}','${op(300)}',1,${json(legacyA)},${json(legacyB)},'${op(301)}');`;
 const legacy=read(legacyCapture);assert.equal(legacy.status,'pending_review');
 sql(`insert into app.synthetic_paper_deployments_v1(project_ref,authorization_reference)values('nnhcnvksxgxnpvdqjgpg','LOCAL isolated synthetic approval');`);
 sql(`do $$begin begin insert into app.synthetic_paper_fixtures_v1(event_id,tournament_id,project_ref,authorization_reference)values('${f.eid}','${f.tid}','nnhcnvksxgxnpvdqjgpg','blocked pending legacy');raise exception'bad';exception when raise_exception then if sqlerrm<>'synthetic_fixture_not_idle'then raise;end if;end;end$$;`);
 assert.equal(read(`select public.review_paper_vs_paper_game_v1('${f.actor}','${op(300)}',1,${json(legacyA)},${json(legacyB)},'approve','${op(302)}');`).status,'approved');
 sql(`do $$begin begin
 insert into app.independent_card_corrections(id,tournament_id,event_id,canonical_game_id,correction_sequence,base_game_version,editor_profile_id,rule_case,reason)values('${op(900)}','${f.tid}','${f.eid}','${ordinary.id}',1,2,'${f.actor}','12.2c','LOCAL rollback-only clean-fixture check');
 begin insert into app.synthetic_paper_fixtures_v1(event_id,tournament_id,project_ref,authorization_reference)values('${f.eid}','${f.tid}','nnhcnvksxgxnpvdqjgpg','must reject correction history');raise exception'bad';exception when raise_exception then if sqlerrm<>'synthetic_fixture_not_idle'then raise;end if;end;
 raise exception'rollback_probe';exception when raise_exception then if sqlerrm<>'rollback_probe'then raise;end if;end;end$$;`);
 checks.push('rollback-only independent correction history prevents enrollment; no lifecycle relabeling');
 const oldReconciled=read(`select public.get_paper_game_operation_reconciliation_v1('${f.actor}','${f.tid}','complete_paper_vs_paper_game_v1','${op(300)}','${op(301)}');`);assert.deepEqual(oldReconciled.result,legacy);
 checks.push('pre-enrollment pending cases block; normal director capture lost response is recoverable under unchanged binding guards');
 sql(`insert into app.synthetic_paper_fixtures_v1(event_id,tournament_id,project_ref,authorization_reference)values('${f.eid}','${f.tid}','nnhcnvksxgxnpvdqjgpg','LOCAL isolated fixture only');`);
 sql(`do $$begin begin insert into app.synthetic_paper_deployments_v1(project_ref,authorization_reference)values('fnjkwymxpnsqvxtpronk','forbidden production');raise exception'bad';exception when check_violation then null;end;end$$;`);
 sql(`select app.prepare_synthetic_paper_artifact_v1('${g.id}','a',23);`);
 const w=read(`select public.get_synthetic_paper_evidence_v1('${f.actor}','${f.tid}');`);assert.ok(isSyntheticPaperWorkspace(w,f.tid));const a=w.artifacts[0];
 for(const side of[a.sideA,a.sideB])assert.equal(crypto.createHash('sha256').update(side.text,'utf8').digest('hex'),side.sha256);
 checks.push('immutable paired generated text and actual SHA256; exact game/participant/version binding');
 sql(`do $$begin begin update app.synthetic_paper_artifacts_v1 set margin=24 where game_id='${g.id}';raise exception'bad';exception when raise_exception then if sqlerrm='bad'then raise;end if;end;end$$;`);
 sql(`do $$begin begin insert into app.synthetic_paper_artifacts_v1(game_id,event_id,tournament_id,base_game_version,winner_side,margin,side_a_text,side_b_text)values('${games[2].id}','${f.eid}','${f.tid}',1,'a',23,'forged','forged');raise exception'bad';exception when raise_exception then if sqlerrm<>'synthetic_artifact_mismatch'then raise;end if;end;end$$;`);
 const ca={winnerSide:'a',margin:23,evidenceReference:a.sideA.reference},cb={...ca,evidenceReference:a.sideB.reference};
 const complete=(n,{actor=f.actor,tid=f.tid,eid=f.eid,gid=g.id,cid=op(100),v=1,A=ca,B=cb}={})=>`select public.complete_synthetic_paper_game_v1('${actor}','${tid}','${eid}','${gid}','${cid}',${v},${json(A)},${json(B)},'${op(n)}');`;
 const review=(n,{actor=f.actor,cid=op(100),v=1,A=ca,B=cb}={})=>`select public.review_synthetic_paper_game_v1('${actor}','${f.tid}','${cid}','approve',${v},${json(A)},${json(B)},'${op(n)}');`;
 assert.equal(read(complete(1,{tid:op(999)})).code,'invalid_request');
 assert.equal(read(complete(2,{A:{...ca,evidenceReference:'forged'}})).code,'invalid_request');
 assert.equal(read(complete(3,{v:2})).code,'invalid_request');
 assert.equal(read(complete(4,{gid:ordinary.id})).code,'invalid_request');
 checks.push('cross-fixture, forged reference, stale version and unregistered game rejected');
 const denied=read(`select public.complete_paper_vs_paper_game_v1('${f.actor}','${f.tid}','${f.eid}','${g.id}','${op(200)}',1,${json(ca)},${json(cb)},'${op(12)}');`);assert.equal(denied.status,'rejected');
 assert.equal(read(`select count(*)::integer from app.paper_game_completions where canonical_game_id='${g.id}';`),0);
 const missing=games[2];
 const missingDenied=read(`select public.complete_paper_vs_paper_game_v1('${f.actor}','${f.tid}','${f.eid}','${missing.id}','${op(203)}',1,${json(ca)},${json(cb)},'${op(204)}');`);assert.equal(missingDenied.status,'rejected');
 assert.deepEqual(read(legacyCapture),legacy);assert.equal(read(`select count(*)::integer from app.synthetic_paper_provenance_v1 where completion_id='${op(300)}';`),0);
 checks.push('ordinary writer cannot produce unlabelled capture even with missing artifact; exact historical replay preserved without relabelling');
 const captured=read(complete(20));assert.equal(captured.status,'pending_review');assert.equal(captured.authoritative,false);
 assert.deepEqual(read(complete(20)),captured);
 assert.equal(read(`select count(*)::integer from app.card_scorelines where canonical_game_id='${g.id}';`),0);
 assert.equal(read(`select count(*)::integer from app.synthetic_paper_provenance_v1;`),1);
 const reconciliation=read(`select public.get_paper_game_operation_reconciliation_v1('${f.actor}','${f.tid}','complete_paper_vs_paper_game_v1','${op(100)}','${op(20)}');`);assert.deepEqual(reconciliation.result,captured);
 assert.equal(read(review(21,{A:{...ca,margin:24}})).status,'rejected');
 const approved=read(review(22));assert.equal(approved.status,'approved');assert.deepEqual(read(review(22)),approved);
 assert.equal(read(`select count(*)::integer from app.card_scorelines where canonical_game_id='${g.id}';`),2);
 assert.equal(read(`select count(*)::integer from app.synthetic_paper_provenance_v1 where physical_original or human_review_claimed;`),0);
 assert.equal(read(`select count(*)::integer from app.synthetic_paper_provenance_v1;`),2);
 checks.push('pending capture, separate re-entry, exact replay/lost-response reconciliation and two immutable truthful provenance records');
 for(const [index,role]of[[0,'cross_checker'],[1,'co_director']]){
  const actor=op(600+index),game=games[3+index],cid=op(610+index),operation=op(620+index);
  sql(`insert into auth.users(id,email)values('${actor}','local-synthetic-${role}@test.invalid');insert into app.tournament_roles(tournament_id,profile_id,role)values('${f.tid}','${actor}','${role}');`);
  assert.equal(read(`select public.bind_paper_official_identity_v1('${f.actor}','${f.tid}','${op(630+index)}','${actor}','nonparticipant',null,0,'${op(640+index)}');`).status,'bound');
  sql(`select app.prepare_synthetic_paper_artifact_v1('${game.id}','b',34);`);
  const card=read(`select public.get_synthetic_paper_evidence_v1('${actor}','${f.tid}');`).artifacts.find(a=>a.gameId===game.id);
  const A={winnerSide:'b',margin:34,evidenceReference:card.sideA.reference},B={...A,evidenceReference:card.sideB.reference};
  const c=read(complete(620+index,{actor,gid:game.id,cid,A,B}));assert.equal(c.status,'pending_review');
  assert.deepEqual(read(`select public.get_paper_game_operation_reconciliation_v1('${actor}','${f.tid}','complete_paper_vs_paper_game_v1','${cid}','${operation}');`).result,c);
  const r=read(review(650+index,{actor,cid,A,B}));assert.equal(r.status,'approved');
  assert.deepEqual(read(`select public.get_paper_game_operation_reconciliation_v1('${actor}','${f.tid}','review_paper_vs_paper_game_v1','${cid}','${op(650+index)}');`).result,r);
  assert.equal(read(`select public.get_paper_game_operation_reconciliation_v1('${actor}','${op(999)}','complete_paper_vs_paper_game_v1','${cid}','${operation}');`).authorized,false);
  assert.equal(read(`select public.bind_paper_official_identity_v1('${f.actor}','${f.tid}','${op(660+index)}','${actor}','nonparticipant',null,1,'${op(670+index)}');`).status,'bound');
  assert.equal(read(`select public.get_paper_game_operation_reconciliation_v1('${actor}','${f.tid}','complete_paper_vs_paper_game_v1','${cid}','${operation}');`).authorized,false);
 }
 checks.push('Cross-Checker and co-director capture/re-entry/reconciliation; changed binding and cross-tournament reads denied');
 for(const table of['score_submissions','score_confirmations','card_scorelines','device_failure_recoveries','hybrid_game_cases','game_corrections','independent_card_corrections','independent_card_correction_projections']){
  sql(`do $$begin begin insert into app.${table}(canonical_game_id,event_id,tournament_id)values('${games[5].id}','${f.eid}','${f.tid}');raise exception'bad';exception when raise_exception then if sqlerrm<>'synthetic_evidence_required'then raise;end if;end;end$$;`);
 }
 sql(`do $$begin begin update app.canonical_games set state='verified',version=version+1 where id='${games[5].id}';raise exception'bad';exception when raise_exception then if sqlerrm<>'synthetic_evidence_required'then raise;end if;end;end$$;`);
 checks.push('rollback-only raw alternate scoring/recovery/hybrid/correction and canonical update probes fail closed');
 sql(`delete from app.tournament_roles where tournament_id='${f.tid}'and profile_id='${f.actor}';`);
 assert.equal(read(complete(20)).status,'rejected');assert.equal(read(review(22)).status,'rejected');
 assert.equal(read(`select public.get_synthetic_paper_evidence_v1('${f.actor}','${f.tid}');`),null);
 checks.push('revoked role cannot replay either mutation or read artifact');
 assert.equal(read(`select public.get_paper_game_operation_reconciliation_v1('${f.actor}','${f.tid}','complete_paper_vs_paper_game_v1','${op(100)}','${op(20)}');`).authorized,false);
 // Separate disposable fixture for actual opposing-session lock proof.
 const prefixes=new Map(),rename=s=>s.replace(/[a-f0-9]{8}-0000-4000-8000-/g,x=>{const p=x.slice(0,8);if(!prefixes.has(p))prefixes.set(p,(0xd2660000+prefixes.size).toString(16));return prefixes.get(p)+x.slice(8);}).replaceAll('@test.invalid','-race@test.invalid');
 const race={actor:rename(f.actor),tid:rename(f.tid),eid:rename(f.eid)};
 for(const phase of['setupSql','financeSql','seatingAttendanceSql','publishSql','startSql'])sql(rename(f[phase]));
 assert.equal(read(`select public.bind_paper_official_identity_v1('${race.actor}','${race.tid}','${op(800)}','${race.actor}','nonparticipant',null,0,'${op(801)}');`).status,'bound');
 const raceGames=read(`select jsonb_agg(to_jsonb(g)order by g.id)from app.canonical_games g where event_id='${race.eid}';`);
 const plain=n=>`select public.complete_paper_vs_paper_game_v1('${race.actor}','${race.tid}','${race.eid}','${raceGames[n].id}','${op(810+n)}',1,${json(legacyA)},${json(legacyB)},'${op(820+n)}');`;
 const enroll=`insert into app.synthetic_paper_fixtures_v1(event_id,tournament_id,project_ref,authorization_reference)values('${race.eid}','${race.tid}','nnhcnvksxgxnpvdqjgpg','LOCAL concurrent enrollment proof');`;
 async function overlap(first,second,tag){
  const a=startSession('begin;'+first+"select 'HOLDER_READY';select pg_sleep(3);commit;",tag+'-a');
  for(let n=0;!a.out().includes('HOLDER_READY');n++){assert.ok(n<250,'holder ready');await new Promise(r=>setTimeout(r,20));}
  const b=startSession('begin;'+second+'commit;',tag+'-b');let waited=false;
  for(let n=0;n<50;n++){if(read(`select exists(select 1 from pg_stat_activity where application_name='${tag}-b'and wait_event_type='Lock');`)){waited=true;break;}await new Promise(r=>setTimeout(r,20));}
  const result=await Promise.all([a.done,b.done]);assert.ok(waited,'actual opposing lock wait observed');return result;
 }
 await overlap(plain(0),`do $$begin begin ${enroll}raise exception'bad';exception when raise_exception then if sqlerrm<>'synthetic_fixture_not_idle'then raise;end if;end;end$$;`,'synthetic-ordinary-first');
 assert.equal(read(`select count(*)::integer from app.synthetic_paper_fixtures_v1 where event_id='${race.eid}';`),0);
 assert.equal(read(`select public.review_paper_vs_paper_game_v1('${race.actor}','${op(810)}',1,${json(legacyA)},${json(legacyB)},'approve','${op(830)}');`).status,'approved');
 const opposing=await overlap(enroll,plain(1),'synthetic-enrollment-first');assert.match(opposing[1],/"status": "rejected"/);
 assert.equal(read(`select count(*)::integer from app.paper_game_completions where canonical_game_id='${raceGames[1].id}';`),0);
 checks.push('actual enrollment/capture races observed waiting: ordinary-first rejects pending enrollment; enrollment-first rejects unlabelled capture');
 return{status:'PASS',checks,syntheticGameId:g.id,provenanceRecords:read(`select count(*)::integer from app.synthetic_paper_provenance_v1;`),syntheticScorelines:6,moneyMoved:false,physicalReviewTested:false,workspace:w};
}
