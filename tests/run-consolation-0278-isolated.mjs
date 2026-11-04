// Isolated synthetic evidence SQL runner. No hosted service access.

import {mainSeed,consolationSeed,actor,tid,main,cons} from './fixtures/consolation-qualification-0278.mjs';
import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync,spawn}from'node:child_process';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-consolation-0278',db='fixture_consolation_0278';
function docker(args,input){const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:Buffer.isBuffer(input)?undefined:'utf8',maxBuffer:64*1024*1024});if(r.status!==0)throw Error(String(r.stderr));return String(r.stdout);}
const meta=JSON.parse(docker(['inspect',name]))[0];
if(meta.Id!==process.argv[4]||meta.State.Status!=='running'||meta.Config.Labels['codex.fixture']!==name||meta.Image!=='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706'||meta.HostConfig.NetworkMode!=='none'||Object.keys(meta.HostConfig.PortBindings??{}).length||meta.HostConfig.Binds?.length||meta.Mounts.length||meta.HostConfig.Privileged)throw Error('Disposable isolation mismatch');
const sql=(q,d='postgres')=>docker(['exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',d,'-v','ON_ERROR_STOP=1'],q);
const baseline=fs.readFileSync('../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump');if(crypto.createHash('sha256').update(baseline).digest('hex')!=='e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc')throw Error('Baseline mismatch');
if(sql(`select count(*)from pg_database where datname='${db}'`).trim()!=='0')throw Error('Existing database; inspect before reset');
const toc=docker(['exec','-i',name,'pg_restore','--list'],baseline);
const owners=[...new Set(toc.split('\n').filter(l=>!l.startsWith(';')).map(l=>l.trim().split(/\s+/).at(-1)).filter(x=>x?.startsWith('supabase_')||['postgres','pgbouncer'].includes(x)))];
for(const owner of [...new Set([...owners,'anon','authenticated','service_role','authenticator','dashboard_user','pgbouncer'])]){if(!/^(?:postgres|pgbouncer|anon|authenticated|service_role|authenticator|dashboard_user|supabase_[a-z_]+)$/.test(owner))throw Error('Invalid role');sql(`do $$begin if not exists(select 1 from pg_roles where rolname='${owner}')then create role ${owner} ${owner==='postgres'?'superuser':'nologin'};end if;end$$;`);}
docker(['exec',name,'createdb','-h','/tmp','-U','supabase_admin','-O','postgres','--template=template0',db]);
try{
 docker(['exec','-i',name,'pg_restore','-h','/tmp','--exit-on-error','-U','supabase_admin','-d',db],baseline);
 for(let n=237;n<=277;n++){
  const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);
  const bytes=fs.readFileSync('database/migrations/'+file);console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
  sql('set role postgres;'+bytes.toString('utf8'),db);
 }
 const q=query=>sql("set role postgres;set request.jwt.claim.sub='a2680000-0000-4000-8000-000000000001';set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';"+query,db).trim();
 const read=query=>{const v=q(query).split('\n').filter(Boolean).at(-1);return v===undefined?null:v==='t'?true:v==='f'?false:JSON.parse(v);};
 const startSession=(query,tag)=>{const child=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(Error(err)));});child.stdin.end(`set role postgres;set request.jwt.claim.sub='a2680000-0000-4000-8000-000000000001';set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';set application_name='${tag}';`+query);return{done,out:()=>out};};
 console.log('Seeding Main 20-player synthetic canonical fixture');
 q(mainSeed());
 console.log('Main result:',q(`select row_to_json(q) from app.qualification_result_versions q where event_id='${main}';`));
 console.log('Main current:',q(`select app.qualification_resolution_snapshot_current_v1(id) from app.qualification_result_versions where event_id='${main}';`));
 const entrants=read(`select jsonb_agg(to_jsonb(x) order by ranking_ordinal) from (select r.ranking_ordinal,p.profile_id,p.roster_entry_id from app.qualification_result_rows r join app.event_participants p on p.id=r.participant_id where r.event_id='${main}' and r.qualification_status<>'qualified' order by r.ranking_ordinal limit 14)x;`);
 if(entrants?.length!==14)throw Error('Expected 14 of 15 Main nonqualifiers');
 q(fs.readFileSync('database/migrations/0278_consolation_four_qualifier_source_v1.sql','utf8'));
 const mainQualifier=read(`select to_jsonb(x) from (select p.profile_id,p.roster_entry_id from app.qualification_result_rows r join app.event_participants p on p.id=r.participant_id where r.event_id='${main}' and r.qualification_status='qualified' order by r.ranking_ordinal limit 1)x;`);
 const ineligible=[mainQualifier,...entrants.slice(1)];
 const invalidSeed=consolationSeed(ineligible).replace(/commit;\s*$/,'');
 q(invalidSeed+`do $$declare qid uuid;begin select id into qid from app.qualification_result_versions where event_id='${cons}';if qid is null or not app.qualification_resolution_snapshot_current_v1(qid) then raise exception 'ineligible fixture not current';end if;if app.consolation_four_qualifier_source_v1('${tid}','${cons}',qid) is not null then raise exception 'current Main qualifier accepted';end if;end$$;rollback;`);
 const missing=structuredClone(entrants);missing[0].roster_entry_id=null;
 const missingSeed=consolationSeed(missing).replace('set role postgres;',`set role postgres;update app.profiles set display_name='TEST ONLY missing roster' where id='${missing[0].profile_id}';`).replace(/commit;\s*$/,'');
 q(missingSeed+`do $$declare qid uuid;begin select id into qid from app.qualification_result_versions where event_id='${cons}';if qid is null or not app.qualification_resolution_snapshot_current_v1(qid) then raise exception 'missing roster fixture not current';end if;if app.consolation_four_qualifier_source_v1('${tid}','${cons}',qid) is not null then raise exception 'missing roster accepted';end if;end$$;rollback;`);
 q(consolationSeed(entrants.slice(0,12)).replace(/commit;\s*$/,'')+`do $$declare x app.qualification_result_versions%rowtype;begin select * into x from app.qualification_result_versions where event_id='${cons}';if x.id is null or x.qualifier_count<>3 or not app.qualification_resolution_snapshot_current_v1(x.id) then raise exception '12-player fixture not current';end if;if app.consolation_four_qualifier_source_v1('${tid}','${cons}',x.id) is not null then raise exception 'three-qualifier field accepted';end if;end$$;rollback;`);
 q(consolationSeed(entrants).replace(/commit;\s*$/,'')+`do $$declare qid uuid;ids uuid[];s jsonb;req jsonb;r jsonb;begin select id into qid from app.qualification_result_versions where event_id='${cons}';select array_agg(participant_id order by ranking_ordinal) into ids from app.qualification_result_rows where result_version_id=qid and qualification_status='qualified';s:=jsonb_build_array(jsonb_build_object('winnerId',ids[1],'loserId',ids[4],'evidenceNote','TEST ONLY'),jsonb_build_object('winnerId',ids[2],'loserId',ids[3],'evidenceNote','TEST ONLY'),jsonb_build_object('winnerId',ids[1],'loserId',ids[2],'evidenceNote','TEST ONLY'));req:=jsonb_build_object('qualificationResultVersionId',qid,'expectedVersion',0,'sourceDigest',app.consolation_four_qualifier_source_v1('${tid}','${cons}',qid),'series',s,'reason','TEST ONLY no physical attestation','reviewed',true,'physicalPlayAttested',false,'artifactId',null);r:=public.record_consolation_playoff_outcomes_v1('${actor}','${tid}','${cons}',req,'d2780000-0000-4000-8000-000000000089');if r->>'code'<>'physical_attestation_required' then raise exception 'ordinary path failed to require physical attestation %',r;end if;end$$;rollback;`);
 for(const [games,threshold] of [[7,9],[9,12],[10,13]]) {
  const alternate=consolationSeed(entrants,games).replace(/commit;\s*$/,'');
  q(alternate+`do $$declare qid uuid;ids uuid[];s jsonb;o jsonb;begin select id into qid from app.qualification_result_versions where event_id='${cons}';
   if qid is null or app.consolation_four_qualifier_source_v1('${tid}','${cons}',qid) is null then raise exception '${games}-game source missing';end if;
   select array_agg(participant_id order by ranking_ordinal) into ids from app.qualification_result_rows where result_version_id=qid and qualification_status='qualified';
   s:=jsonb_build_array(jsonb_build_object('winnerId',ids[1],'loserId',ids[4],'evidenceNote','TEST ONLY'),jsonb_build_object('winnerId',ids[2],'loserId',ids[3],'evidenceNote','TEST ONLY'),jsonb_build_object('winnerId',ids[1],'loserId',ids[2],'evidenceNote','TEST ONLY'));
   o:=app.derive_consolation_four_qualifier_v1(qid,s);if o is null or exists(select 1 from jsonb_array_elements(o) with ordinality x(v,n) join app.qualification_result_rows r on r.result_version_id=qid and r.ranking_ordinal=x.n where (v->>'qualifyingMrp')::integer<>case when x.n<=2 then 3*(r.game_points-${threshold}+1) else 3 end)then raise exception '${games}-game qualifying MRP mismatch';end if;end$$;rollback;`);
 }
 q(consolationSeed(entrants,8,true));
 console.log('Consolation result:',q(`select row_to_json(q) from app.qualification_result_versions q where event_id='${cons}';`));
 console.log('Consolation current:',q(`select app.qualification_resolution_snapshot_current_v1(id) from app.qualification_result_versions where event_id='${cons}';`));
 const fixture=read(`select jsonb_build_object('qid',id,'count',qualifier_count,'current',app.qualification_resolution_snapshot_current_v1(id),'digest',app.consolation_four_qualifier_source_v1('${tid}','${cons}',id)) from app.qualification_result_versions where event_id='${cons}';`);
 if(!fixture||fixture.count!==4||!fixture.current||!/^\w{64}$/.test(fixture.digest||''))throw Error('Current dual-event source unavailable '+JSON.stringify(fixture));
 const workspace=read(`select public.get_consolation_playoff_workspace_v1('${actor}','${tid}','${cons}');`);
 if(!workspace?.canRecord||workspace.sourceDigest!==fixture.digest||workspace.qualifiers.length!==4||workspace.currentVersion!==0)throw Error('Source workspace unavailable');
 if(read(`select public.get_consolation_playoff_workspace_v1('a1310000-0000-4000-8000-000000000007','${tid}','${cons}');`)!==null)throw Error('Outsider workspace disclosed');
 const history=()=>q(`select encode(extensions.digest(convert_to(jsonb_build_object('q',(select jsonb_agg(to_jsonb(x) order by id) from app.qualification_result_versions x where tournament_id='${tid}'),'r',(select jsonb_agg(to_jsonb(x) order by result_version_id,ranking_ordinal) from app.qualification_result_rows x where tournament_id='${tid}'),'scores',(select jsonb_agg(to_jsonb(x) order by id) from app.card_scorelines x where tournament_id='${tid}'))::text,'utf8'),'sha256'),'hex');`);
 const historyBefore=history();
 const qualifiers=read(`select jsonb_agg(participant_id order by ranking_ordinal) from app.qualification_result_rows where result_version_id='${fixture.qid}' and qualification_status='qualified';`);
 const series=[{winnerId:qualifiers[0],loserId:qualifiers[3],evidenceNote:'TEST ONLY synthetic semifinal'}, {winnerId:qualifiers[1],loserId:qualifiers[2],evidenceNote:'TEST ONLY synthetic semifinal'}, {winnerId:qualifiers[0],loserId:qualifiers[1],evidenceNote:'TEST ONLY synthetic final'}];
 const literal=s=>`'${JSON.stringify(s).replaceAll("'","''")}'::jsonb`;
 const result=read(`select app.derive_consolation_four_qualifier_v1('${fixture.qid}',${literal(series)});`);
 if(result?.length!==4||JSON.stringify(result.map(x=>x.playoffMrp))!==JSON.stringify([24,12,4,4])||JSON.stringify(result.slice(2).map(x=>[x.bandStart,x.bandEnd]))!==JSON.stringify([[3,4],[3,4]]))throw Error('Wrong source-derived bracket/MRP '+JSON.stringify(result));
 const bad=structuredClone(series);bad[2].winnerId=qualifiers[2];
 if(read(`select app.derive_consolation_four_qualifier_v1('${fixture.qid}',${literal(bad)});`)!==null)throw Error('Bad final accepted');
 if(read(`select app.consolation_four_qualifier_source_v1('${tid}','${main}','${fixture.qid}');`)!==null)throw Error('Cross-event source accepted');
 if(q(`select has_function_privilege('service_role','app.consolation_four_qualifier_source_v1(uuid,uuid,uuid)','execute');`)!=='f')throw Error('Private source exposed');
 q(`begin;update app.events set name=name||' TEST ONLY changed' where id='${main}';do $$begin if app.consolation_four_qualifier_source_v1('${tid}','${cons}','${fixture.qid}')='${fixture.digest}' then raise exception 'stale main source unchanged';end if;end$$;rollback;`);
 q(`begin;update app.events set name=name||' TEST ONLY changed' where id='${cons}';do $$begin if app.consolation_four_qualifier_source_v1('${tid}','${cons}','${fixture.qid}')='${fixture.digest}' then raise exception 'stale consolation source unchanged';end if;end$$;rollback;`);
 if(read(`select app.derive_consolation_four_qualifier_v1('${fixture.qid}',${literal([...series,{...series[0]}])});`)!==null)throw Error('Extra series accepted');
 if(q(`select count(*) from app.playoff_outcome_versions_v3 where tournament_id='${tid}';`)!=='0'||q(`select count(*) from app.playoff_outcome_versions_v4 where tournament_id='${tid}';`)!=='0')throw Error('Historical playoff table changed');
 if(history()!==historyBefore)throw Error('Qualification or scores changed during source derivation');
 const decision=series.map(({winnerId,loserId})=>({winnerId,loserId}));
 const artifactId=read(`select to_jsonb(app.prepare_synthetic_consolation_playoff_v1('${actor}','${tid}','${cons}','${fixture.qid}',0,${literal(decision)}));`);
 const artifact=read(`select to_jsonb(x) from (select id,sha256 from app.synthetic_event_artifacts_v1 where id='${artifactId}')x;`);
 // The owner-only preparation call creates the evidence, not a physical-play claim.
 if(!artifact?.id)throw Error('Synthetic artifact unavailable');
 const ref=`SYNTHETIC-EVENT-v1:${artifact.id}:${artifact.sha256}`;
 const req={qualificationResultVersionId:fixture.qid,expectedVersion:0,sourceDigest:fixture.digest,series:decision.map((x,i)=>({...x,evidenceNote:`${ref}:${i+1}`})),reason:'TEST ONLY SYNTHETIC: simulated series; no physical play or human review',reviewed:true,physicalPlayAttested:false,artifactId:artifact.id};
 const write=(r,op,who=actor)=>read(`select public.record_consolation_playoff_outcomes_v1('${who}','${tid}','${cons}',${literal(r)},'${op}');`);
 const op=n=>`d2780000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 if(write({...req,artifactId:null},op(10)).code!=='synthetic_evidence_required')throw Error('Unbound synthetic claim accepted');
 if(write({...req,physicalPlayAttested:true},op(11)).code!=='synthetic_evidence_required')throw Error('Synthetic physical-play claim accepted');
 if(write({...req,reviewed:false},op(12)).code!=='invalid_request')throw Error('Unreviewed request accepted');
 const mainQ=read(`select to_jsonb(id) from app.qualification_result_versions where event_id='${main}';`);
 if(write({...req,qualificationResultVersionId:mainQ},op(20)).code!=='qualification_unavailable')throw Error('Cross-event qualification accepted');
 const wrongArtifact=structuredClone(req);wrongArtifact.series[0].evidenceNote='TEST ONLY wrong artifact';
 if(write(wrongArtifact,op(19)).code!=='synthetic_evidence_mismatch')throw Error('Artifact mismatch accepted');
 if(q(`select count(*) from app.audit_events where tournament_id='${tid}' and action='consolation_playoff_rejected_v1' and after_state->>'code'='synthetic_evidence_mismatch';`)!=='1')throw Error('Artifact rejection missing audit');
 const invalid=structuredClone(req);invalid.series[2].winnerId=qualifiers[2];
 if(write(invalid,op(13)).code!=='invalid_series')throw Error('Invalid bracket accepted');
 if(write(req,op(14),'a1310000-0000-4000-8000-000000000007').code!=='not_director')throw Error('Outsider accepted');
 if(q(`select has_function_privilege('authenticated','public.record_consolation_playoff_outcomes_v1(uuid,uuid,uuid,jsonb,uuid)','execute');`)!=='f'||q(`select has_function_privilege('service_role','app.prepare_synthetic_consolation_playoff_v1(uuid,uuid,uuid,uuid,integer,jsonb)','execute');`)!=='f')throw Error('Evidence preparation or writer grants widened');
 q(`begin;update app.events set name=name||' TEST ONLY changed' where id='${main}';do $$declare r jsonb;begin r:=public.record_consolation_playoff_outcomes_v1('${actor}','${tid}','${cons}',${literal(req)},'${op(15)}');if r->>'code'<>'source_changed' then raise exception 'stale Main accepted %',r;end if;end$$;rollback;`);
 q(`begin;insert into app.prize_accounting_drafts_v8(id,tournament_id,event_id,version,source_digest,request_payload,rounding,awards,source_manifest,actor_id,operation_receipt_id)values('${op(90)}','${tid}','${cons}',1,repeat('1',64),'{}','{}','[]','{}','${actor}','c1310000-0000-4000-8000-000000000001');do $$declare r jsonb;begin r:=public.record_consolation_playoff_outcomes_v1('${actor}','${tid}','${cons}',${literal(req)},'${op(91)}');if r->>'code'<>'playoff_domain_conflict'then raise exception 'existing draft did not block %',r;end if;end$$;rollback;`);
 // Financial-first ordering: hold tournament, let writer hold post-event and
 // wait on tournament, then prove the financial trigger does not wait on it.
 const financial=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1']);
 let finOut='',finErr='';financial.stdout.on('data',x=>finOut+=x);financial.stderr.on('data',x=>finErr+=x);
 const finDone=new Promise((resolve,reject)=>{financial.on('error',reject);financial.on('close',code=>code===0?resolve(finOut):reject(Error(finErr)));});
 financial.stdin.write(`begin;set role postgres;set local statement_timeout='15s';select 1 from app.tournaments where id='${tid}' for update;select 'FIN_TOUR_HELD';\n`);
 let until=Date.now()+7000;while(!finOut.includes('FIN_TOUR_HELD')){if(Date.now()>until){financial.kill();throw Error('Financial barrier unavailable '+finErr);}await new Promise(r=>setTimeout(r,50));}
 const staleReq={...req,sourceDigest:'0'.repeat(64)};
 const financialFirst=startSession(`select public.record_consolation_playoff_outcomes_v1('${actor}','${tid}','${cons}',${literal(staleReq)},'${op(29)}');`,'consolation_fin_first');
 let observed=false;until=Date.now()+7000;
 while(Date.now()<until){if(q("select count(*) from pg_stat_activity where application_name='consolation_fin_first' and wait_event='transactionid';")==='1'){observed=true;break;}await new Promise(r=>setTimeout(r,50));}
 if(!observed){financial.stdin.end('rollback;');await finDone;await financialFirst.done;throw Error('Writer did not wait on financial tournament lock');}
 financial.stdin.write(`insert into app.prize_accounting_drafts_v8(id,tournament_id,event_id,version,source_digest,request_payload,rounding,awards,source_manifest,actor_id,operation_receipt_id)values('${op(92)}','${tid}','${cons}',1,repeat('1',64),'{}','{}','[]','{}','${actor}','c1310000-0000-4000-8000-000000000001');select 'FIN_DRAFT_STAGED';\n`);
 let draftStaged=false;until=Date.now()+7000;
 try {while(Date.now()<until){if(finOut.includes('FIN_DRAFT_STAGED')){draftStaged=true;break;}await new Promise(r=>setTimeout(r,50));}}
 finally {financial.stdin.end('rollback;');}
 await finDone;const financialFirstOut=await financialFirst.done;
 if(!draftStaged||!financialFirstOut.includes('source_changed'))throw Error('Financial-first serialization failed '+finOut+' '+financialFirstOut);
 // A real Main dispute attempt holds the Main qualification advisory key while
 // the Consy writer starts. Finalized Main rejects the dispute; the writer must
 // wait on that key and then commit, with no game/tournament lock cycle.
 const checker='a1310000-0000-4000-8000-000000000007';
 q(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${checker}','cross_checker');`);
 const barrier=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1']);
 let barrierOut='',barrierErr='';barrier.stdout.on('data',x=>barrierOut+=x);barrier.stderr.on('data',x=>barrierErr+=x);
 const barrierDone=new Promise((resolve,reject)=>{barrier.on('error',reject);barrier.on('close',code=>code===0?resolve(barrierOut):reject(Error(barrierErr)));});
 barrier.stdin.write(`begin;set role postgres;set local request.jwt.claim.role='service_role';set local statement_timeout='15s';select pg_advisory_xact_lock(hashtextextended('qualification-finalization:${main}',0));
 select public.configure_rule12_correction_policy_v1('${actor}','${tid}',true,1::smallint,(select max(version)from app.correction_policy_versions where tournament_id='${tid}'),'${op(82)}');
 select public.create_rule12_correction_v2('${checker}',(select id from app.canonical_games where event_id='${main}' order by id limit 1),'${op(83)}',1,0,'12.2a','{"outcome":"win","margin":20,"column":"plus","apparentQualifier":true}','{"outcome":"loss","margin":10,"column":"minus","apparentQualifier":false}',false,null,'TEST ONLY post-final correction race','${op(84)}');
 select public.open_event_dispute_v1('${actor}','${tid}','${main}',(select id from app.canonical_games where event_id='${main}' order by id limit 1),'${op(80)}','TEST ONLY post-final dispute race','${op(81)}');select 'BARRIER_READY';\n`);
 until=Date.now()+7000;while(!barrierOut.includes('BARRIER_READY')){if(Date.now()>until){barrier.kill();throw Error('Main dispute barrier unavailable '+barrierErr);}await new Promise(r=>setTimeout(r,50));}
 if(!barrierOut.includes('qualification_finalized')||!barrierOut.includes('fixture_not_applicable')){barrier.stdin.end('rollback;');await barrierDone;throw Error('Post-final Main correction/dispute was not rejected '+barrierOut);}
 const pending=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1']);
 let pendingOut='',pendingErr='';pending.stdout.on('data',x=>pendingOut+=x);pending.stderr.on('data',x=>pendingErr+=x);
 const pendingDone=new Promise((resolve,reject)=>{pending.on('error',reject);pending.on('close',code=>code===0?resolve(pendingOut):reject(Error(pendingErr)));});
 pending.stdin.write(`begin;set role postgres;set local request.jwt.claim.role='service_role';set local statement_timeout='15s';set local application_name='consolation_main_race';select public.record_consolation_playoff_outcomes_v1('${actor}','${tid}','${cons}',${literal(req)},'${op(16)}');select 'WRITER_STAGED';\n`);
 observed=false;until=Date.now()+7000;
 try {while(Date.now()<until){if(q("select count(*) from pg_stat_activity where application_name='consolation_main_race' and wait_event='advisory';")==='1'){observed=true;break;}await new Promise(r=>setTimeout(r,50));}}
 finally {barrier.stdin.end('commit;');}
 await barrierDone;
 if(!observed)throw Error('Consolation writer did not wait for Main qualification lock');
 until=Date.now()+7000;while(!pendingOut.includes('WRITER_STAGED')){if(Date.now()>until){pending.stdin.end('rollback;');await pendingDone;throw Error('Consolation writer did not stage '+pendingErr);}await new Promise(r=>setTimeout(r,50));}
 const financialSecond=startSession(`do $$begin begin insert into app.prize_accounting_drafts_v8(tournament_id,event_id)values('${tid}','${cons}');raise exception 'unblocked financial draft';exception when raise_exception then if sqlerrm<>'playoff_domain_conflict'then raise;end if;end;end$$;select 'FIN_BLOCKED';`,'consolation_fin_second');
 observed=false;until=Date.now()+7000;
 try {while(Date.now()<until){if(q("select count(*) from pg_stat_activity where application_name='consolation_fin_second' and wait_event='transactionid';")==='1'){observed=true;break;}await new Promise(r=>setTimeout(r,50));}}
 finally {pending.stdin.end('commit;');}
 const raceOut=await pendingDone;const financialSecondOut=await financialSecond.done;
 if(!observed||!financialSecondOut.includes('FIN_BLOCKED'))throw Error('Writer-first financial conflict race failed '+financialSecondOut);
 const accepted=JSON.parse(raceOut.trim().split('\n').findLast(x=>x.startsWith('{')));
 if(accepted?.status!=='consolation_playoff_recorded_v1')throw Error('Synthetic writer rejected after Main dispute race '+JSON.stringify(accepted));
 if(JSON.stringify(write(req,op(16)))!==JSON.stringify(accepted))throw Error('Exact retry changed response');
 const reconciliation=read(`select public.get_consolation_playoff_reconciliation_v1('${actor}','${tid}','${cons}','${op(16)}',${literal(req)});`);
 if(JSON.stringify(reconciliation?.result)!==JSON.stringify(accepted))throw Error('Reconciliation differs from accepted response');
 const afterWorkspace=read(`select public.get_consolation_playoff_workspace_v1('${actor}','${tid}','${cons}');`);
 if(!afterWorkspace?.result?.current||afterWorkspace.result.resultId!==accepted.resultId||afterWorkspace.result.physicalPlayAttested!==false)throw Error('Current synthetic result not reflected in workspace');
 if(write({...req,reason:req.reason+' changed'},op(16)).code!=='idempotency_conflict')throw Error('Changed retry accepted');
 if(write(req,op(17)).code!=='stale_version')throw Error('Stale writer accepted');
 if(write({...req,expectedVersion:1},op(18)).code!=='already_recorded')throw Error('Duplicate accepted');
 const evidence=read(`select jsonb_build_object('resultCount',(select count(*)from app.consolation_playoff_outcome_versions_v1 where event_id='${cons}'),'provenanceCount',(select count(*)from app.synthetic_event_provenance_v1 where entity_table='consolation_playoff_outcome_versions_v1' and entity_id='${accepted.resultId}' and artifact_id='${artifact.id}' and not physical_play and not human_review_claimed and not money_moved and not actual_money_received),'acceptedAuditCount',(select count(*)from app.audit_events where entity_id='${accepted.resultId}' and action='consolation_playoff_recorded_v1'));`);
 if(evidence.resultCount!==1||evidence.provenanceCount!==1||evidence.acceptedAuditCount!==1)throw Error('Outcome/provenance/audit missing '+JSON.stringify(evidence));
 for(const table of ['standard_singles_settlement_drafts','standard_singles_settlement_final_versions','event_settlement_drafts_v5','event_settlement_finals_v2','q_accounting_drafts_v6','q_accounting_finals_v6','no_q_accounting_drafts_v7','no_q_accounting_finals_v7','prize_accounting_drafts_v8','prize_accounting_finals_v8','prize_accounting_drafts_v9','prize_accounting_finals_v9']){
  q(`do $$begin begin execute 'insert into app.${table}(tournament_id,event_id) values (''${tid}'',''${cons}'')';raise exception 'unblocked accounting domain ${table}';exception when raise_exception then if sqlerrm<>'playoff_domain_conflict'then raise;end if;end;end$$;`);
 }
 const corrected=structuredClone(decision);corrected[2]={winnerId:qualifiers[1],loserId:qualifiers[0]};
 const nextArtifactId=read(`select to_jsonb(app.prepare_synthetic_consolation_playoff_v1('${actor}','${tid}','${cons}','${fixture.qid}',1,${literal(corrected)}));`);
 const nextArtifact=read(`select to_jsonb(x) from (select id,sha256 from app.synthetic_event_artifacts_v1 where id='${nextArtifactId}')x;`);
 const nextRef=`SYNTHETIC-EVENT-v1:${nextArtifact.id}:${nextArtifact.sha256}`;
 const nextReq={...req,expectedVersion:1,artifactId:nextArtifact.id,series:corrected.map((x,i)=>({...x,evidenceNote:`${nextRef}:${i+1}`}))};
 const gate=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1']);
 let gateOut='',gateErr='';gate.stdout.on('data',x=>gateOut+=x);gate.stderr.on('data',x=>gateErr+=x);
 const gateDone=new Promise((resolve,reject)=>{gate.on('error',reject);gate.on('close',code=>code===0?resolve(gateOut):reject(Error(gateErr)));});
 gate.stdin.write(`begin;set role postgres;set local statement_timeout='15s';select pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:${cons}',0));select 'GATE_READY';\n`);
 until=Date.now()+7000;while(!gateOut.includes('GATE_READY')){if(Date.now()>until){gate.kill();throw Error('Writer barrier unavailable '+gateErr);}await new Promise(r=>setTimeout(r,50));}
 const a=startSession(`select public.record_consolation_playoff_outcomes_v1('${actor}','${tid}','${cons}',${literal(nextReq)},'${op(31)}');`,'consolation_writer_a');
 const b=startSession(`select public.record_consolation_playoff_outcomes_v1('${actor}','${tid}','${cons}',${literal(nextReq)},'${op(32)}');`,'consolation_writer_b');
 observed=false;until=Date.now()+7000;
 try {while(Date.now()<until){if(q("select count(*) from pg_stat_activity where application_name in ('consolation_writer_a','consolation_writer_b') and wait_event='advisory';")==='2'){observed=true;break;}await new Promise(r=>setTimeout(r,50));}}
 finally {gate.stdin.end('commit;');}
 await gateDone;const raced=(await Promise.all([a.done,b.done])).map(out=>JSON.parse(out.trim().split('\n').findLast(x=>x.startsWith('{'))));
 if(!observed||raced.filter(x=>x.status==='consolation_playoff_recorded_v1').length!==1||raced.filter(x=>x.code==='stale_version').length!==1)throw Error('Competing writer race failed '+JSON.stringify(raced));
 const raceCounts=read(`select jsonb_build_object('versions',(select count(*) from app.consolation_playoff_outcome_versions_v1 where event_id='${cons}'),'superseding',(select count(*) from app.consolation_playoff_outcome_versions_v1 where event_id='${cons}' and version=2 and supersedes_id='${accepted.resultId}'),'provenance',(select count(*) from app.synthetic_event_provenance_v1 where entity_table='consolation_playoff_outcome_versions_v1' and event_id='${cons}'));`);
 if(raceCounts.versions!==2||raceCounts.superseding!==1||raceCounts.provenance!==2)throw Error('Competing version conservation failed '+JSON.stringify(raceCounts));
 if(history()!==historyBefore)throw Error('Qualification or scores changed during outcome recording');
 console.log('PASS synthetic artifact pinning, false physical/human provenance, writer role, idempotency, stale/duplicate rejection and audit');
 console.log('PASS current dual qualification, opt-out, seeded bracket, same-round MRP, private access, cross-event and stale Main fingerprint');
}finally{docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',db]);console.log('CLEANUP disposable full-schema database removed');}
