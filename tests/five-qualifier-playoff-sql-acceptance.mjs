// LOCAL ONLY. Consumes a real, supported finalized qualification fixture from
// the17-player orchestration; never inserts immutable result/score rows here.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';

const quote=s=>`'${String(s).replaceAll("'","''")}'`;
const op=n=>`a2510000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
export async function verifyFiveQualifierPlayoffV4({sql,actor,tid,eid,race}) {
 let groups=0;const pass=name=>{groups++;console.log('PASS five-playoff-v4 '+name);};
 const read=()=>JSON.parse(sql(`select public.get_standard_singles_playoff_outcome_workspace_v4('${actor}','${tid}','${eid}');`));
 const before=sql(`select jsonb_build_object('qualification',(select jsonb_agg(to_jsonb(q)order by version)from app.qualification_result_versions q where event_id='${eid}'),'rows',(select jsonb_agg(to_jsonb(r)order by ranking_ordinal)from app.qualification_result_rows r where event_id='${eid}'),'scores',(select jsonb_agg(to_jsonb(s)order by line_id)from app.current_effective_scorelines('${tid}','${eid}')s));`);
 let ws=read();assert.equal(ws.bracketKind,'five_qualifier_three_byes_v4');assert.equal(ws.canRecord,true);assert.equal(ws.currentVersion,0);assert.equal(ws.qualifiers.length,5);
 assert.deepEqual(ws.qualifiers.map(q=>q.qualificationRank),[1,2,3,4,5]);assert.deepEqual(ws.qualifiers.map(q=>q.byeWins),[1,1,1,0,0]);
 const ids=ws.qualifiers.map(q=>q.participantId),series=[
  {winnerId:ids[3],loserId:ids[4],evidenceNote:'TEST ONLY simulated4v5 series'},
  {winnerId:ids[0],loserId:ids[3],evidenceNote:'TEST ONLY simulated seed1 semifinal'},
  {winnerId:ids[1],loserId:ids[2],evidenceNote:'TEST ONLY simulated seed3v2 semifinal'},
  {winnerId:ids[0],loserId:ids[1],evidenceNote:'TEST ONLY simulated final'}];
 const request={qualificationResultVersionId:ws.qualificationResultVersionId,expectedVersion:0,sourceDigest:ws.sourceDigest,series,reason:'TEST ONLY reviewed synthetic five-player bracket; no actual games or payments',reviewed:true};
 const write=(r,key)=>JSON.parse(sql(`select public.record_standard_singles_playoff_outcomes_v4('${actor}','${tid}','${eid}',${quote(JSON.stringify(r))},'${key}');`));
 const reconcile=(r,key)=>JSON.parse(sql(`select public.get_standard_singles_playoff_outcome_reconciliation_v4('${actor}','${tid}','${eid}','${key}',${quote(JSON.stringify(r))});`));
 for(const [i,mutate]of[
  r=>{r.series[0].winnerId=ids[0];},r=>{r.series.push({...r.series[0]});},r=>{r.series[0].byeWins=1;},
  r=>{r.series[2].winnerId=ids[0];},r=>{r.series[1].loserId=ids[4];},r=>{r.series[0].evidenceNote='';},
  r=>{r.expectedVersion=-1;},r=>{r.reviewed=false;},r=>{r.reason='';},r=>{r.extraMoneyMinor=1;},
 ].entries()){
  const bad=structuredClone(request);mutate(bad);const result=write(bad,op(100+i));assert.equal(result.status,'rejected');assert.ok(['invalid_request','invalid_series'].includes(result.code));
 }
 assert.equal(sql(`select count(*)from app.playoff_outcome_versions_v4 where event_id='${eid}';`),'0');pass('strict four-series shape, exact source pairs, no submitted bye/win/money fields');
 const initial=write(request,op(1));assert.equal(initial.status,'playoff_outcomes_recorded_v4');assert.equal(initial.version,1);
 ws=read();assert.equal(ws.result.current,true);assert.equal(ws.result.series.length,4);assert.equal(ws.result.outcomes.length,5);
 assert.deepEqual(ws.result.outcomes.map(r=>r.playedMatchWins),[2,1,0,1,0]);assert.deepEqual(ws.result.outcomes.map(r=>r.byeWins),[1,1,1,0,0]);
 assert.deepEqual(ws.result.outcomes.map(r=>r.playoffMrp),[70,42,21,21,7]);
 assert.deepEqual(ws.result.outcomes.map(r=>[r.bandStart,r.bandEnd]),[[1,1],[2,2],[3,4],[3,4],[5,5]]);
 assert.deepEqual(ws.result.outcomes.map(r=>r.eliminatedInRound),[null,3,2,2,1]);
 for(const r of ws.result.outcomes){const q=ws.qualifiers.find(q=>q.participantId===r.participantId);assert.equal(r.qualifyingMrp,q.qualificationRank<=3?5*(q.gamePoints-13):5);assert.equal(r.totalMrp,r.qualifyingMrp+r.playoffMrp);}
 pass('five actual qualifiers, three evidenced byes,70/42/21/21/7 playoff MRP and1/2/3–4/5 bands');
 assert.deepEqual(write(request,op(1)),initial);assert.deepEqual(reconcile(request,op(1)),{authorized:true,result:initial});
 assert.equal(write({...request,reason:request.reason+' changed'},op(1)).code,'idempotency_conflict');
 assert.equal(reconcile({...request,reason:request.reason+' changed'},op(1)).result.code,'idempotency_conflict');
 assert.equal(write({...request,expectedVersion:1},op(2)).code,'already_recorded');assert.equal(write(request,op(3)).code,'stale_version');
 assert.equal(sql(`select count(*)from app.playoff_outcome_versions_v4 where event_id='${eid}';`),'1');
 assert.equal(sql(`select count(*)from app.operation_receipts where tournament_id='${tid}'and operation_type='playoff_outcomes_v4'and outcome='accepted';`),'1');
 assert.equal(sql(`select count(*)from app.audit_events where tournament_id='${tid}'and action='playoff_outcomes_v4_recorded';`),'1');
 pass('exact replay/lost-response reconciliation, full payload conflicts and different-key same-source duplicate prevention');
 const source={kind:'playoff_outcome_v4',resultId:initial.resultId,qualificationResultVersionId:request.qualificationResultVersionId};
 const mrp=JSON.parse(sql(`select app.canonical_settlement_mrp_v5('${tid}','${eid}',${quote(JSON.stringify(source))});`));assert.equal(mrp.status,'available');assert.deepEqual(mrp.rows.map(r=>r.playoffMrp),[70,42,21,21,7]);
 const lowerSeries=[{...series[0],winnerId:ids[4],loserId:ids[3]},{...series[1],winnerId:ids[4],loserId:ids[0]},{...series[2],winnerId:ids[2],loserId:ids[1]},{...series[3],winnerId:ids[4],loserId:ids[2]}];
 const lower=JSON.parse(sql(`select app.derive_five_qualifier_playoff_v4('${request.qualificationResultVersionId}',${quote(JSON.stringify(lowerSeries))});`));assert.equal(lower[4].playedMatchWins,3);assert.equal(lower[4].byeWins,0);assert.equal(lower[4].playoffMrp,70);assert.equal(lower[0].playedMatchWins,0);assert.equal(lower[0].byeWins,1);assert.equal(lower[0].playoffMrp,21);
 assert.equal(sql(`select app.settlement_source_current_v5('${tid}','${eid}',${quote(JSON.stringify(source))});`),'t');
 const changedSource={...source,resultId:op(990)};assert.equal(sql(`select app.settlement_source_current_v5('${tid}','${eid}',${quote(JSON.stringify(changedSource))});`),'f');
 pass('tagged v4 canonical source and MRP dispatch; fabricated/cross-result source fails closed');
 sql(`begin;update app.events set name=name||' TEST ONLY fingerprint check'where id='${eid}';do $$begin
 if app.settlement_source_current_v5('${tid}','${eid}',${quote(JSON.stringify(source))})then raise exception 'stale source still current';end if;
 if app.canonical_settlement_mrp_v5('${tid}','${eid}',${quote(JSON.stringify(source))})->>'status'<>'blocked'then raise exception 'stale source MRP accepted';end if;
 end$$;rollback;`);
 assert.equal(read().result.current,true);assert.equal(write({...request,sourceDigest:'0'.repeat(64),expectedVersion:1},op(4)).code,'source_changed');
 pass('current fingerprint mutation invalidates applicability without deleting history; stale digest rejected');
 sql(`begin;set request.jwt.claim.role='authenticated';set request.jwt.claims='{"role":"authenticated"}';do $$begin
 if public.get_standard_singles_playoff_outcome_workspace_v4('${actor}','${tid}','${eid}')is not null then raise exception 'human JWT read';end if;
 if public.record_standard_singles_playoff_outcomes_v4('${actor}','${tid}','${eid}',${quote(JSON.stringify(request))},'${op(5)}')is not null then raise exception 'human JWT write';end if;
 end$$;rollback;
 begin;delete from app.tournament_roles where tournament_id='${tid}'and profile_id='${actor}'and role in('director','co_director');do $$begin
 if public.record_standard_singles_playoff_outcomes_v4('${actor}','${tid}','${eid}',${quote(JSON.stringify(request))},'${op(1)}')->>'code'<>'not_director'then raise exception 'revoked replay';end if;
 if public.get_standard_singles_playoff_outcome_reconciliation_v4('${actor}','${tid}','${eid}','${op(1)}',${quote(JSON.stringify(request))})is not null then raise exception 'revoked reconcile';end if;end$$;rollback;`);
 assert.equal(JSON.parse(sql(`select public.record_standard_singles_playoff_outcomes_v4('${actor}','${op(998)}','${eid}',${quote(JSON.stringify(request))},'${op(6)}');`)).code,'tournament_unavailable');
 assert.equal(sql(`select public.get_standard_singles_playoff_outcome_workspace_v4('${op(997)}','${tid}','${eid}')is null;`),'t');
 assert.equal(sql(`select bool_and(not has_table_privilege(r,'app.playoff_outcome_versions_v4','INSERT,UPDATE,DELETE,SELECT'))from unnest(array['anon','authenticated','service_role'])r;`),'t');
 assert.equal(sql(`select bool_and(c.relrowsecurity and c.relforcerowsecurity)from pg_class c where c.oid='app.playoff_outcome_versions_v4'::regclass;`),'t');
 assert.equal(sql(`select bool_and(not has_function_privilege(r,'public.record_standard_singles_playoff_outcomes_v4(uuid,uuid,uuid,jsonb,uuid)','EXECUTE'))from unnest(array['anon','authenticated'])r;`),'t');
 pass('service-only grants/JWT boundary, current actor role before replay/reconcile, cross-tournament and forced RLS');
 if(race){
  const first=structuredClone(request),second=structuredClone(request);first.expectedVersion=1;second.expectedVersion=1;
  [first.series[3].winnerId,first.series[3].loserId]=[ids[1],ids[0]];first.reason='TEST ONLY concurrent alternative final';
  second.series[3].evidenceNote+=' rechecked';second.reason='TEST ONLY concurrent rechecked evidence';
  const results=await race([
   `select public.record_standard_singles_playoff_outcomes_v4('${actor}','${tid}','${eid}',${quote(JSON.stringify(first))},'${op(7)}');`,
   `select public.record_standard_singles_playoff_outcomes_v4('${actor}','${tid}','${eid}',${quote(JSON.stringify(second))},'${op(8)}');`
  ],eid);
  assert.equal(results.filter(r=>r.status==='playoff_outcomes_recorded_v4').length,1);assert.equal(results.filter(r=>r.code==='stale_version').length,1);
  assert.equal(read().currentVersion,2);assert.equal(sql(`select count(*)from app.playoff_outcome_versions_v4 where event_id='${eid}';`),'2');
  const restored=write({...request,expectedVersion:2,reason:'TEST ONLY final reviewed evidence after concurrent negative test'},op(9));assert.equal(restored.status,'playoff_outcomes_recorded_v4');assert.equal(restored.version,3);
  assert.equal(sql(`select app.settlement_source_current_v5('${tid}','${eid}',${quote(JSON.stringify(source))});`),'f');
  pass('observed overlapping opposing decisions: one new version, one stale; reasoned supersession preserves old source/history');
 }
 const after=sql(`select jsonb_build_object('qualification',(select jsonb_agg(to_jsonb(q)order by version)from app.qualification_result_versions q where event_id='${eid}'),'rows',(select jsonb_agg(to_jsonb(r)order by ranking_ordinal)from app.qualification_result_rows r where event_id='${eid}'),'scores',(select jsonb_agg(to_jsonb(s)order by line_id)from app.current_effective_scorelines('${tid}','${eid}')s));`);
 assert.equal(sha(after),sha(before));pass('original verified qualifying scores, totals, raw ranks and immutable qualification snapshots unchanged');
 ws=read();return {groups,workspace:ws,request,initial,snapshotSha256:sha(before),currentSource:{kind:'playoff_outcome_v4',resultId:ws.result.resultId,qualificationResultVersionId:ws.qualificationResultVersionId}};
}

// Narrow adapter for the root's exact disposable container; no server lifecycle
// or production connection is performed by this module.
export function fivePlayoffLocalSqlAdapter(container='cribbage-qaccounting-local',database='fixture_qaccounting'){
 if(container!=='cribbage-qaccounting-local'||database!=='fixture_qaccounting')throw Error('Exact disposable fixture only');
 const args=['--context','desktop-linux','exec','-i',container,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1'];
 const prefix=`set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claims='{"role":"service_role"}';`;
 const sql=q=>{const r=spawnSync('docker',args,{input:prefix+q,encoding:'utf8',maxBuffer:32*1024*1024});if(r.status!==0)throw Error(r.stderr+'\n'+r.stdout);return r.stdout.trim();};
 const race=async(statements,eventId,writerName='record_standard_singles_playoff_outcomes_v4')=>{
  if(!['record_standard_singles_playoff_outcomes_v4','save_q_accounting_draft_v6','finalize_q_accounting_v6','save_no_q_accounting_draft_v7','finalize_no_q_accounting_v7','save_q_operating_policy_v3','record_q_obligation_review_v2'].includes(writerName))throw Error('Explicit reviewed race writer required');
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(eventId))throw Error('Explicit fixture event UUID required');
  const run=q=>new Promise((resolve,reject)=>{const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code===0?resolve(out.trim()):reject(Error(err)));p.stdin.end(prefix+q);});
  // An explicit transaction holds the exact shared event mutex until both
  // independent writers are visibly waiting. No timing-only concurrency claim.
  let release;const holder=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let held='',errors='',released=false;
  const policyRace=['save_q_operating_policy_v3','record_q_obligation_review_v2'].includes(writerName);
  const lockPrefix=policyRace?'qualification-finalization':'standard-singles-post-event';
  const raceTag=`fixture-race-${eventId}`;
  holder.stdout.on('data',d=>held+=d);holder.stderr.on('data',d=>errors+=d);holder.stdin.write(prefix+`begin;select pg_advisory_xact_lock(hashtextextended('${lockPrefix}:${eventId}',0));select 'HELD';\n`);
  const holderDone=new Promise((resolve,reject)=>{holder.on('error',reject);holder.on('close',c=>c===0?resolve():reject(Error(errors)));});
  release=()=>{if(!released){released=true;holder.stdin.end('commit;\n');}};
  try{
   const until=Date.now()+10000;while(!held.includes('HELD')){if(Date.now()>until)throw Error('Lock holder readiness timeout');await new Promise(r=>setTimeout(r,30));}
   const pending=statements.map(s=>run(`set application_name='${raceTag}';`+s));let observed=false;
   while(Date.now()<until){const waiting=Number(sql(`select count(*)from pg_stat_activity where datname='${database}'and application_name='${raceTag}'and pid<>pg_backend_pid()and wait_event_type='Lock'and query like '%${writerName}%';`));if(waiting>=2){observed=true;break;}await new Promise(r=>setTimeout(r,30));}
   assert.ok(observed,'Both writer requests were not observed overlapping');release();await holderDone;
   return(await Promise.all(pending)).map(s=>JSON.parse(s.split('\n').filter(Boolean).at(-1)));
  }catch(e){release();await holderDone.catch(()=>{});throw e;}
 };
 return {sql,race};
}
