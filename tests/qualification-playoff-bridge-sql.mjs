// Staged LOCAL reproduction/repair proof. Root applies0250 BETWEEN --before/--after.
import fs from'node:fs';import assert from'node:assert/strict';import crypto from'node:crypto';import{spawnSync,spawn}from'node:child_process';
import{foundationV2}from'./fixtures/q-v2-foundation.mjs';import{seed as shortSeed}from'./fixtures/qualification-tie-foundation.mjs';import{actor as oldActor,tid as oldTid,eid as oldEid,uuid,quote}from'./fixtures/q-review-foundation.mjs';
const stage=process.argv[2];if(!['--before','--after'].includes(stage))throw Error('Explicit staged --before/--after required');
const name=process.env.Q_BRIDGE_CONTAINER??'cribbage-qaccounting-local',db=process.env.Q_BRIDGE_DATABASE??'fixture_qaccounting';if(name!=='cribbage-qaccounting-local'||db!=='fixture_qaccounting')throw Error('Exact isolated fixture required');
const args=['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],prefix=`set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claims='{"role":"service_role"}';\n`;
const sql=q=>{const r=spawnSync('docker',args,{input:prefix+q,encoding:'utf8',maxBuffer:32*1024*1024});if(r.status!==0)throw Error(r.stderr+'\n'+r.stdout);return r.stdout.trim();};
const ns=s=>s.replaceAll('1310000','2810000').replaceAll('2430000','2830000').replaceAll('2450000','2850000').replaceAll('@test.invalid','-qualification-bridge@test.invalid');
const actor=ns(oldActor),tid=ns(oldTid),eid=ns(oldEid),pid=n=>ns(uuid('f243',n));
const series=[{winnerId:pid(2),loserId:pid(3),evidenceNote:'TEST ONLY simulated semifinal1'},{winnerId:pid(1),loserId:pid(4),evidenceNote:'TEST ONLY simulated semifinal2'},{winnerId:pid(2),loserId:pid(1),evidenceNote:'TEST ONLY simulated final'}];
const snapshot=()=>sql(`select jsonb_build_object('scores',(select jsonb_agg(to_jsonb(l)order by line_id)from app.current_effective_scorelines('${tid}','${eid}')l),'rows',(select jsonb_agg(to_jsonb(r)order by ranking_ordinal)from app.qualification_result_rows r where event_id='${eid}'),'versions',(select jsonb_agg(to_jsonb(q)order by version)from app.qualification_result_versions q where event_id='${eid}'))::text;`);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
if(stage==='--before'){
 const games=JSON.parse(fs.readFileSync('tests/fixtures/q-review-games.json','utf8')).matches.map(x=>({...x}));games[games.findIndex(x=>x.winner===1)].margin+=11;
 let s=ns(foundationV2({structuredSchedule:true,games}));s=s.replace(/select public\.finalize_standard_singles_qualification_v1\([^;]+;/,'');sql(s);
 const w=JSON.parse(sql(`select public.get_qualification_tie_workspace_v1('${actor}','${tid}','${eid}');`));assert.equal(w.groups.length,1);assert.equal(w.groups[0].method,'one_game_playoff');
 const r={expectedSourceFingerprint:w.sourceFingerprint,participantIds:w.groups[0].candidateIds,winnerId:pid(2),method:'one_game_playoff',reason:'TEST ONLY synthetic separately played tie winner',evidenceReference:'TEST ONLY simulated tiebreak, no qualifying score'};
 assert.equal(JSON.parse(sql(`select public.save_qualification_tie_resolution_v1('${actor}','${tid}','${eid}',${quote(JSON.stringify(r))},'${uuid('a250',1)}');`)).status,'qualification_tie_recorded');
 assert.equal(JSON.parse(sql(`select public.finalize_standard_singles_qualification_v1('${actor}','${tid}','${eid}','${uuid('a250',2)}');`)).status,'qualification_finalized');
 const qid=sql(`select id from app.qualification_result_versions where event_id='${eid}';`);
 assert.equal(sql(`select coalesce(app.derive_four_player_playoff_v3('${qid}',${quote(JSON.stringify(series))})::text,'NULL');`),'NULL');
 const blocked=JSON.parse(sql(`select public.record_standard_singles_playoff_outcomes_v3('${actor}','${tid}','${eid}','${qid}',0,${quote(JSON.stringify(series))},'${uuid('a250',3)}');`));assert.equal(blocked.code,'qualification_unavailable');
 const numeric=JSON.parse(sql(`select jsonb_agg(jsonb_build_object('id',participant_id,'rank',ranking_ordinal,'numericRank',numeric_rank,'tied',tied,'gamePoints',game_points)order by ranking_ordinal)from app.qualification_result_rows where result_version_id='${qid}'and qualification_status='qualified';`));assert.equal(numeric[0].numericRank,1);assert.equal(numeric[1].numericRank,1);assert.equal(numeric[1].rank,2);assert.equal(numeric[1].tied,false);
 fs.writeFileSync('test-results/qualification-playoff-bridge-before.json',JSON.stringify({tid,eid,qid,snapshotSha256:sha(snapshot()),blocked,numeric},null,2));console.log('PASS reproduced: valid resolved qualification preserves raw rank1/1, but old v3 writer rejects qualification_unavailable');
 process.exit(0);
}
const before=JSON.parse(fs.readFileSync('test-results/qualification-playoff-bridge-before.json','utf8'));assert.equal(before.tid,tid);assert.equal(before.snapshotSha256,sha(snapshot()));
assert.equal(sql(`select app.qualification_resolution_snapshot_current_v1('${before.qid}');`),'t');
assert.equal(sql(`select app.qualification_resolution_snapshot_current_v1('${uuid('a250',999)}');`),'f');
const derived=JSON.parse(sql(`select app.derive_four_player_playoff_v3('${before.qid}',${quote(JSON.stringify(series))});`));assert.equal(derived.length,4);
const outcome=JSON.parse(sql(`select public.record_standard_singles_playoff_outcomes_v3('${actor}','${tid}','${eid}','${before.qid}',0,${quote(JSON.stringify(series))},'${uuid('a250',4)}');`));assert.equal(outcome.status,'playoff_outcomes_recorded');
const source={kind:'playoff_outcome_v3',resultId:outcome.resultId,qualificationResultVersionId:before.qid};
const mrp=JSON.parse(sql(`select app.canonical_settlement_mrp_v5('${tid}','${eid}',${quote(JSON.stringify(source))});`));assert.equal(mrp.status,'available');assert.deepEqual(mrp.rows.map(r=>r.totalMrp),[97,76,12,12]);
const qws=JSON.parse(sql(`select public.get_q_obligation_review_workspace_v2('${actor}','${tid}');`));assert.deepEqual(qws.blockers,[]);
const qr=JSON.parse(sql(`select public.record_q_obligation_review_v2('${actor}','${tid}',${quote(JSON.stringify({expectedVersion:0,sourceDigest:qws.sourceDigest,reason:'TEST ONLY tied qualification equal Q review',reviewed:true}))},'${uuid('a250',5)}');`));assert.equal(qr.status,'q_obligations_recorded_v2');
for(const[i,amount,label]of[[1,4800,'sanctioning'],[2,9600,'meals'],[3,4800,'hall_rental'],[4,2400,'cards']]){
 const r=JSON.parse(sql(`select set_config('request.jwt.claim.sub','${actor}',false);select public.record_tournament_expense('${tid}',${amount},'USD','TEST ONLY ${label}','${uuid('b250',i)}');`).split('\n').at(-1));assert.equal(r.status,'expense_recorded');
}
sql(`insert into app.event_sanctioning_fee_snapshots(id,tournament_id,event_id,event_play_start_id,event_kind,rate_cents,eligible_participant_count,total_cents,rate_source,setup_revision_id)select '${uuid('b250',10)}','${tid}','${eid}',(select id from app.event_play_starts where event_id='${eid}'),'main',300,16,4800,'setup','${ns('e1310000-0000-4000-8000-000000000001')}'where not exists(select 1 from app.event_sanctioning_fee_snapshots where event_id='${eid}');`);
const accounting=JSON.parse(sql(`select public.get_q_accounting_workspace_v6('${actor}','${tid}','${eid}');`));assert.deepEqual(accounting.blockers,[]);assert.equal(accounting.facts.baseIncomeMinor,48000);assert.equal(accounting.facts.qIncomeMinor,3000);assert.equal(accounting.facts.canonicalMrp.status,'available');
assert.equal(before.snapshotSha256,sha(snapshot()),'bridge changed original qualification/scores/history');
const qualification=JSON.parse(sql(`select public.get_standard_singles_qualification_result_v1('${actor}','${tid}','${eid}');`));
const playoffWorkspace=JSON.parse(sql(`select public.get_standard_singles_playoff_outcome_workspace_v3('${actor}','${tid}','${eid}');`));
fs.writeFileSync('test-results/qualification-playoff-bridge-api-contract.json',JSON.stringify({qualification,playoffWorkspace,canonicalMrp:mrp,accountingWorkspace:accounting},null,2));
// Post-final Rule12 mutation is intentionally frozen. Prove that guard instead
// of inventing a post-final correction record to test fingerprint changes.
const checker=ns('a1310000-0000-4000-8000-000000000007');
sql(`begin;insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${checker}','cross_checker');do $$declare r jsonb;begin
 r:=public.configure_rule12_correction_policy_v1('${actor}','${tid}',true,1::smallint,(select max(version)from app.correction_policy_versions where tournament_id='${tid}'),'${uuid('c250',1)}');if r->>'status'is distinct from'configured'then raise exception 'policy %',r;end if;
 r:=public.create_rule12_correction_v2('${checker}','${ns(uuid('6245',1))}','${uuid('c250',2)}',1,0,'12.2a','{"outcome":"win","margin":20,"column":"plus","apparentQualifier":true}','{"outcome":"loss","margin":10,"column":"minus","apparentQualifier":false}',false,null,'TEST ONLY post-final correction guard','${uuid('c250',3)}');if r->>'status'is distinct from'rejected'or r->>'code'is distinct from'fixture_not_applicable'then raise exception 'post-final correction guard %',r;end if;
 if exists(select 1 from app.independent_card_corrections where id='${uuid('c250',2)}')then raise exception 'post-final correction inserted';end if;
 if not app.qualification_resolution_snapshot_current_v1('${before.qid}')then raise exception 'rejected mutation changed valid source';end if;
 end$$;set constraints all immediate;rollback;`);
assert.equal(sql(`select app.qualification_resolution_snapshot_current_v1('${before.qid}');`),'t');
assert.equal(before.snapshotSha256,sha(snapshot()));
sql(`begin;do $$declare r jsonb;begin
 r:=public.open_event_dispute_v1('${actor}','${tid}','${eid}','${ns(uuid('6245',1))}','${uuid('c250',10)}','TEST ONLY post-final dispute, original scores preserved','${uuid('c250',11)}');if r->>'status'is distinct from'rejected'or r->>'code'is distinct from'qualification_finalized'then raise exception 'post-final dispute guard %',r;end if;
 if exists(select 1 from app.event_disputes where id='${uuid('c250',10)}')then raise exception 'post-final dispute inserted';end if;
 if not app.qualification_resolution_snapshot_current_v1('${before.qid}')then raise exception 'rejected dispute changed valid source';end if;
 end$$;set constraints all immediate;rollback;`);
assert.equal(before.snapshotSha256,sha(snapshot()));
// Actual cutoff tie, using only synthetic match outcomes and valid margin inputs.
// All qualifying rows have numeric_rank=ordinal; only the NONqualifier exposes
// the resolved raw rank mismatch, so this exercises the global source guard.
const cutNs=s=>s.replaceAll('1310000','3010000').replaceAll('2430000','3030000').replaceAll('2450000','3050000').replaceAll('@test.invalid','-cutoff-bridge@test.invalid');
const cutGames=JSON.parse(fs.readFileSync('tests/fixtures/q-review-games.json','utf8')).matches.map(x=>({...x}));
const loss=cutGames.find(g=>g.winner===3&&![1,2,4,5].includes(g.a===3?g.b:g.a));assert.ok(loss);loss.winner=loss.a===3?loss.b:loss.a;
const gain=cutGames.find(g=>[g.a,g.b].includes(5)&&[g.a,g.b].includes(2)&&g.winner===2);assert.ok(gain);gain.winner=5;
for(const g of cutGames)if([3,5].includes(g.a)||[3,5].includes(g.b))g.margin=10;
const totals=Array.from({length:16},(_,i)=>({id:i+1,wins:0,plus:0,minus:0}));for(const g of cutGames){totals[g.winner-1].wins++;totals[g.winner-1].plus+=g.margin;totals[(g.winner===g.a?g.b:g.a)-1].minus+=g.margin;}
const tied=totals.filter((p,i)=>totals.some((q,j)=>i!==j&&p.wins===q.wins&&p.plus===q.plus&&p.minus===q.minus));assert.deepEqual(tied.map(t=>t.id),[3,5]);assert.ok(tied.every(t=>t.wins===10&&t.plus===100&&t.minus===20));
const cutActor=cutNs(oldActor),cutTid=cutNs(oldTid),cutEid=cutNs(oldEid),cp=n=>cutNs(uuid('f243',n));
let cutSeed=cutNs(foundationV2({structuredSchedule:true,games:cutGames})).replace(/select public\.finalize_standard_singles_qualification_v1\([^;]+;/,'');sql(cutSeed);
const cutW=JSON.parse(sql(`select public.get_qualification_tie_workspace_v1('${cutActor}','${cutTid}','${cutEid}');`));assert.equal(cutW.groups.length,1);assert.equal(cutW.groups[0].numericRank,4);assert.equal(cutW.groups[0].affectsQualificationCut,true);assert.equal(cutW.groups[0].method,'one_game_playoff');
const cutReq={expectedSourceFingerprint:cutW.sourceFingerprint,participantIds:cutW.groups[0].candidateIds,winnerId:cp(5),method:'one_game_playoff',reason:'TEST ONLY actual synthetic cutoff winner5',evidenceReference:'TEST ONLY separately simulated tiebreak, no card points'};
assert.equal(JSON.parse(sql(`select public.save_qualification_tie_resolution_v1('${cutActor}','${cutTid}','${cutEid}',${quote(JSON.stringify(cutReq))},'${uuid('e250',1)}');`)).status,'qualification_tie_recorded');
assert.equal(JSON.parse(sql(`select public.finalize_standard_singles_qualification_v1('${cutActor}','${cutTid}','${cutEid}','${uuid('e250',2)}');`)).status,'qualification_finalized');
const cutQ=sql(`select id from app.qualification_result_versions where event_id='${cutEid}';`);
assert.equal(sql(`select count(*)from app.qualification_result_rows where result_version_id='${cutQ}'and qualification_status='qualified'and numeric_rank<>ranking_ordinal;`),'0');
assert.equal(sql(`select ranking_ordinal||':'||numeric_rank||':'||qualification_status from app.qualification_result_rows where result_version_id='${cutQ}'and participant_id='${cp(5)}';`),'4:4:qualified');
assert.equal(sql(`select ranking_ordinal||':'||numeric_rank||':'||qualification_status from app.qualification_result_rows where result_version_id='${cutQ}'and participant_id='${cp(3)}';`),'5:4:high_non_qualifier');
const cutSeries=[{winnerId:cp(5),loserId:cp(1),evidenceNote:'TEST ONLY cutoff semifinal1'},{winnerId:cp(4),loserId:cp(2),evidenceNote:'TEST ONLY cutoff semifinal2'},{winnerId:cp(5),loserId:cp(4),evidenceNote:'TEST ONLY cutoff final'}];
const cutOutcome=JSON.parse(sql(`select public.record_standard_singles_playoff_outcomes_v3('${cutActor}','${cutTid}','${cutEid}','${cutQ}',0,${quote(JSON.stringify(cutSeries))},'${uuid('e250',3)}');`));assert.equal(cutOutcome.status,'playoff_outcomes_recorded');
const cutSource={kind:'playoff_outcome_v3',resultId:cutOutcome.resultId,qualificationResultVersionId:cutQ};
const cutMrp=JSON.parse(sql(`select app.canonical_settlement_mrp_v5('${cutTid}','${cutEid}',${quote(JSON.stringify(cutSource))});`));assert.equal(cutMrp.status,'available');
const cutSnapshot=()=>sql(`select jsonb_build_object('scores',(select jsonb_agg(to_jsonb(l)order by line_id)from app.current_effective_scorelines('${cutTid}','${cutEid}')l),'rows',(select jsonb_agg(to_jsonb(r)order by ranking_ordinal)from app.qualification_result_rows r where result_version_id='${cutQ}'))::text;`),cutBefore=sha(cutSnapshot());
// This rollback-only MUTABLE event-name edit tests the source fingerprint. It
// is not a score correction, director UI authorization, or immutable-row edit.
sql(`begin;update app.events set name=name||' TEST ONLY reader fingerprint rename'where id='${cutEid}'and tournament_id='${cutTid}';do $$begin
 if app.qualification_resolution_snapshot_current_v1('${cutQ}')then raise exception 'changed event fingerprint retained cutoff applicability';end if;
 if app.derive_four_player_playoff_v3('${cutQ}',${quote(JSON.stringify(cutSeries))})is not null then raise exception 'global cutoff stale source bypass';end if;
 if app.canonical_settlement_mrp_v5('${cutTid}','${cutEid}',${quote(JSON.stringify(cutSource))})->>'status'is distinct from'blocked'then raise exception 'global cutoff stale MRP bypass';end if;
 end$$;set constraints all immediate;rollback;`);
assert.equal(cutBefore,sha(cutSnapshot()));assert.equal(sql(`select app.qualification_resolution_snapshot_current_v1('${cutQ}');`),'t');
const contract=JSON.parse(fs.readFileSync('test-results/qualification-playoff-bridge-api-contract.json','utf8'));contract.cutoffQualification=JSON.parse(sql(`select public.get_standard_singles_qualification_result_v1('${cutActor}','${cutTid}','${cutEid}');`));contract.cutoffCanonicalMrp=cutMrp;fs.writeFileSync('test-results/qualification-playoff-bridge-api-contract.json',JSON.stringify(contract,null,2));
// Small four-player fixture proves a finalizer which started BEFORE the last
// resolution committed stamps its accepted snapshot AFTER that resolution.
const clockNs=s=>s.replaceAll('1310000','2910000').replaceAll('2430000','2930000').replaceAll('2470000','2970000').replaceAll('@test.invalid','-clock@test.invalid');
const ca=clockNs(oldActor),ct=clockNs(oldTid),ce=clockNs(oldEid);sql('begin;'+clockNs(shortSeed('manual'))+'commit;');
const cw=JSON.parse(sql(`select public.get_qualification_tie_workspace_v1('${ca}','${ct}','${ce}');`));assert.equal(cw.groups.length,2);
const clockReq=g=>({expectedSourceFingerprint:cw.sourceFingerprint,participantIds:g.candidateIds,winnerId:g.candidateIds[0],method:'one_game_playoff',reason:'TEST ONLY clock-order synthetic winner',evidenceReference:'TEST ONLY no qualifying score added'});
assert.equal(JSON.parse(sql(`select public.save_qualification_tie_resolution_v1('${ca}','${ct}','${ce}',${quote(JSON.stringify(clockReq(cw.groups[1])))},'${uuid('d250',1)}');`)).status,'qualification_tie_recorded');
function start(q){const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);const done=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',c=>c?reject(Error(err)):resolve(out.trim()));});p.stdin.end(prefix+q);return{done,out:()=>out};}
async function until(check){for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,40));}throw Error('Clock overlap not observed');}
const held=start(`begin;select pg_advisory_xact_lock(hashtextextended('qualification-finalization:${ce}',0));select'HELD';select pg_sleep(6);commit;`);await until(()=>held.out().includes('HELD'));
const save=start(`set application_name='qualification-clock-resolution';select public.save_qualification_tie_resolution_v1('${ca}','${ct}','${ce}',${quote(JSON.stringify(clockReq(cw.groups[0])))},'${uuid('d250',2)}');`);
await until(()=>sql("select count(*)from pg_stat_activity where application_name='qualification-clock-resolution'and wait_event_type='Lock';")==='1');
const finalize=start(`set application_name='qualification-clock-finalizer';select public.finalize_standard_singles_qualification_v1('${ca}','${ct}','${ce}','${uuid('d250',3)}');`);
await until(()=>sql("select count(*)from pg_stat_activity where application_name in('qualification-clock-resolution','qualification-clock-finalizer')and wait_event_type='Lock';")==='2');await held.done;
assert.equal(JSON.parse(await save.done).status,'qualification_tie_recorded');assert.equal(JSON.parse(await finalize.done).status,'qualification_finalized');
assert.equal(sql(`select q.finalized_at>=(select max(recorded_at)from app.qualification_tie_resolutions_v1 where event_id=q.event_id)from app.qualification_result_versions q where q.event_id='${ce}';`),'t');
sql('begin;set constraints all immediate;commit;');
const checks=['pre0250 actual blocked v3 writer reproduced; no score/rawnumeric/history rewritten','source-bound resolved ordinal accepted by actual v3 writer and canonical MRP; old unsupported legacy branch retained','equal Q obligations and canonical v6 source accept resolved qualification with exact unchanged score snapshot','post-final Rule12 and dispute mutations rejected by existing guards without changing history; prequalification dispute blocking remains separate prior proof','actual cutoff winner ordinal4/numeric4 and nonqualifier ordinal5/numeric4 works; mutable event-name fingerprint change blocks globally without changing scores/immutable rows','observed resolution-first/finalizer-waiting overlap stamps accepted qualification after resolution'];
fs.writeFileSync('test-results/qualification-playoff-bridge-result.json',JSON.stringify({status:'passed',checks,snapshotBefore:before.snapshotSha256,snapshotAfter:sha(snapshot())},null,2));console.log(JSON.stringify({status:'PASS',checks}));
