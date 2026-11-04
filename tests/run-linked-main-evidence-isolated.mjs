import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync,spawn}from'node:child_process';
import {mainSeed,consolationSeed,actor as realActor,tid as realTid,main as realMain,cons as realCons} from './fixtures/consolation-qualification-0278.mjs';
import {twentyPlayerMultiPoolPlan} from './fixtures/twenty-player-multi-pool-plan.mjs';
import {consolationPlan,scoreStructuredPaperGames} from './fixtures/structured-multi-event-lifecycle.mjs';
import {publishAndStartStructuredEvent} from './fixtures/structured-multi-event-schedule-start.mjs';
import {verifySourceSetRace} from './fixtures/structured-multi-event-source-race.mjs';
import {projectAccountingWorkspace,isAccountingWorkspace} from '../src/lib/api/multi-event-accounting-workspace.ts';
import {acceptedAccountingAction,isAccountingAction} from '../src/lib/api/multi-event-accounting-action.ts';
import {isTournamentResultEventSummary} from '../src/lib/api/result-event-summary.ts';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-linked-main-evidence',db='fixture_linked_main_evidence';
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
 for(let n=237;n<=289;n++){
 const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);sql('set role postgres;'+fs.readFileSync('database/migrations/'+file,'utf8'),db);
 }
 console.log('PASS restored empty baseline and applied0237-0289 locally');
 sql('set role postgres;'+fs.readFileSync('database/proposals/setup-event-links-v1.sql','utf8'),db);
 sql('set role postgres;'+fs.readFileSync('database/proposals/setup-event-links-activation-v1.sql','utf8'),db);
 sql('set role postgres;'+fs.readFileSync('database/proposals/linked-main-playoff-evidence-v1.sql','utf8'),db);
 sql('set role postgres;'+fs.readFileSync('tests/linked-main-playoff-evidence-v1.sql','utf8'),db);
 for(const path of ['database/proposals/setup-event-links-v1.sql','database/proposals/setup-event-links-activation-v1.sql','database/proposals/linked-main-playoff-evidence-v1.sql'])console.log('PROPOSAL SHA256',path,crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'));
 console.log('PASS linked setup save/activation and playoff candidates applied');
 const actor='a2900000-0000-4000-8000-000000000001',tid='b2900000-0000-4000-8000-000000000001';
 const literal=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`;
 const q=(query,who=actor,role='authenticated')=>sql(`set role ${role};set request.jwt.claim.sub='${who}';set request.jwt.claim.role='${role}';set request.jwt.claims='{"role":"${role}","sub":"${who}"}';`+query,db).trim();
 const read=(query,who=actor,role='authenticated')=>{const raw=q(query,who,role).split('\n').filter(Boolean).at(-1);return raw===undefined?null:JSON.parse(raw)};
 sql(`set role postgres;insert into auth.users(id,email)values('${actor}','director@test.invalid');insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('${tid}','${actor}','TEST ONLY links','draft','closed');insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${actor}','director');`,db);
 const {qSetupPrizeWorkspace}=await import('./fixtures/q-setup-prize-workspace.mjs');const ws=qSetupPrizeWorkspace(actor);const {revisionId,version,createdAt,...base}=ws.current;
 base.events=Array.from({length:4},(_,i)=>({...structuredClone(base.events[0]),clientRowId:`c2900000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,eventKind:i%2===0?'main':'consolation',displayName:`TEST ONLY ${i%2===0?'Main':'Consolation'} ${Math.floor(i/2)+1}`,gameCount:i%2===0?12:8,sourceStatus:undefined,entryFeeCents:0,freeEntry:true}));
 for(const e of base.events)delete e.sourceStatus;
 const choices=[{mainClientRowId:base.events[0].clientRowId,consolationClientRowIds:[base.events[1].clientRowId]},{mainClientRowId:base.events[2].clientRowId,consolationClientRowIds:[base.events[3].clientRowId]}];
 base.events=[base.events[2],base.events[3],base.events[0],base.events[1]]; // canonical grouped order retains explicit parents
 const envelope={kind:'setup-event-links-v1',request:{expectedVersion:0,payload:base,idempotencyKey:'d2900000-0000-4000-8000-000000000001'},choices};
 const saved=read(`select public.save_linked_tournament_setup_v1('${tid}',${literal(envelope)});`);if(saved?.status!=='linked_setup_saved')throw Error('Linked save '+JSON.stringify(saved));
 const {isLinkedSetupSaveResult}=await import('../src/lib/api/setup-event-links.ts');if(!isLinkedSetupSaveResult(saved,envelope))throw Error('Linked SQL response failed codec '+JSON.stringify(saved));
 const replay=read(`select public.save_linked_tournament_setup_v1('${tid}',${literal(envelope)});`);if(JSON.stringify(replay)!==JSON.stringify(saved))throw Error('Replay changed response');
 const head=read(`select public.get_setup_event_links_v1('${tid}');`);if(head?.current?.complete!==true)throw Error('Incomplete graph');
 const modified=structuredClone(envelope);modified.choices[0].consolationClientRowIds=[];const conflict=read(`select public.save_linked_tournament_setup_v1('${tid}',${literal(modified)});`);if(conflict?.code!=='idempotency_conflict')throw Error('Changed graph reused operation');
 const counts=read(`select jsonb_build_object('revisions',(select count(*)from app.tournament_setup_revisions where tournament_id='${tid}'),'events',(select count(*)from app.tournament_setup_event_versions where tournament_id='${tid}'),'edges',(select count(*)from app.setup_event_link_edges_v1 where tournament_id='${tid}'));`,actor,'postgres');
 if(counts.revisions!==1||counts.events!==4||counts.edges!==2)throw Error('Counts '+JSON.stringify(counts));
 console.log('PASS twoMain/twoConsolation atomic save, exact replay, changed graph rejection, SQL→codec');
 const oldAttempt=read(`select public.activate_tournament_setup_v2('${actor}','${tid}','${saved.result.revisionId}',1,'d2900000-0000-4000-8000-000000000002');`,actor,'service_role');if(oldAttempt?.code!=='association_pin_required')throw Error('Old activation bypass '+JSON.stringify(oldAttempt));
 const activationRequest={setupRevisionId:saved.result.revisionId,expectedVersion:1,confirmed:true,idempotencyKey:'d2900000-0000-4000-8000-000000000003'};
 const activationEnvelope={request:activationRequest,associationHash:saved.links.associationHash};
 const activated=read(`select public.finalize_linked_tournament_setup_v1('${actor}','${tid}',${literal(activationEnvelope)});`,actor,'service_role');if(activated?.status!=='linked_setup_activated')throw Error('Linked activation '+JSON.stringify(activated));
 const {isLinkedSetupActivationResult}=await import('../src/lib/api/setup-event-links.ts');if(!isLinkedSetupActivationResult(activated,activationRequest,saved.links.associationHash))throw Error('Activation SQL response failed codec');
 const activatedReplay=read(`select public.finalize_linked_tournament_setup_v1('${actor}','${tid}',${literal(activationEnvelope)});`,actor,'service_role');if(JSON.stringify(activatedReplay)!==JSON.stringify(activated))throw Error('Activation replay changed');
 const bindings=read(`select jsonb_agg(jsonb_build_object('child',c.name,'main',m.name)order by c.name)from app.consolation_main_event_bindings_v1 b join app.events c on c.id=b.consolation_event_id join app.events m on m.id=b.main_event_id where b.tournament_id='${tid}';`,actor,'postgres');
 if(bindings.length!==2||bindings[0].main!=='TEST ONLY Main 1'||bindings[1].main!=='TEST ONLY Main 2')throw Error('Wrong parent bindings '+JSON.stringify(bindings));
 console.log('PASS canonical activation explicit parents, old activation blocked, exact activation replay, SQL→codec');
 const multiPairFinal=read(`set request.jwt.claim.role='service_role';select app.multi_event_joint_final_candidate_workspace_v1('${actor}','${tid}');`,actor,'postgres');
 if(multiPairFinal?.status!=='blocked'||multiPairFinal?.code!=='unsupported_event_set'||multiPairFinal?.moneyMoved!==false)throw Error('Multi-pair financial finality not blocked '+JSON.stringify(multiPairFinal));
 console.log('PASS existing joint financial final guard blocks two-Main/two-Consolation event set');
 const rejectionRaw=sql('set role postgres;'+fs.readFileSync('tests/linked-main-playoff-lifecycle-v1.sql','utf8'),db);
 const rejectionRows=rejectionRaw.split('\n').filter(x=>x.startsWith('{')).map(x=>JSON.parse(x));
 const {isPlayoffV4Result}=await import('../src/lib/api/playoff-outcome-v4.ts');const {isRejectedPlayoffOutcome}=await import('../src/lib/api/playoff-outcome.ts');const {isRejectedPlayoffPlacement}=await import('../src/lib/api/playoff-placement.ts');const {isRejectedEventStart}=await import('../src/lib/api/event-schedule.ts');
 const v3Reject=rejectionRows.find(x=>x.type==='record_standard_singles_playoff_outcomes_v3')?.value;
 const v4Reject=rejectionRows.find(x=>x.type==='playoff_outcomes_v4')?.value,legacyReject=rejectionRows.find(x=>x.type==='record_standard_singles_playoff_placements_v2')?.value,startReject=rejectionRows.find(x=>x.type==='event_start')?.value;
 if(!v3Reject||!isRejectedPlayoffOutcome(v3Reject,v3Reject.eventId)||!v4Reject||!isPlayoffV4Result(v4Reject,tid,v4Reject.eventId)||!legacyReject||!isRejectedPlayoffPlacement(legacyReject,legacyReject.eventId)||!startReject||!isRejectedEventStart(startReject))throw Error('Actual rejection failed strict TypeScript codec '+rejectionRaw);
 console.log('PASS actual V3, V4, legacy placement and pending Start rejections match TypeScript codecs');
 console.log('PASS synthetic linked main evidence lifecycle');
 // Existing 0278 fixture constructs synthetic scorelines and finalizes Main
 // qualification with the real currentness function (no validation stub).
 q(mainSeed(),actor,'postgres');
 const codecRaw=q(`begin;set local request.jwt.claim.role='service_role';create temp table linked_codec_results(data jsonb);do $$
 declare a uuid:='${realActor}';t uuid:='${realTid}';m uuid:='${realMain}';c uuid:=extensions.gen_random_uuid();revision uuid;ms uuid;cs uuid:=extensions.gen_random_uuid();rules uuid:=extensions.gen_random_uuid();rec uuid;saveop uuid:=extensions.gen_random_uuid();actop uuid:=extensions.gen_random_uuid();lv uuid:=extensions.gen_random_uuid();av uuid:=extensions.gen_random_uuid();qid uuid;ids uuid[];rosters uuid[];response jsonb;req jsonb;op uuid;
 begin
  select setup_revision_id,setup_event_version_id into revision,ms from app.tournament_setup_activations where tournament_id=t and event_id=m;
  insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at) values(rules,t,'TEST ONLY rules','standard_singles','TEST ONLY source','2025-01-01',now());select id into rec from app.operation_receipts where tournament_id=t order by applied_at limit 1;
  insert into app.tournament_setup_event_versions(id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,timezone_name,style_code,format_code,game_count,entry_fee_cents,muggins_status) values(cs,t,revision,extensions.gen_random_uuid(),2,'consolation','TEST ONLY child',clock_timestamp(),'UTC','Standard','standard_singles',8,1000,'unset');
  insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method) values(c,t,rules,'TEST ONLY child','consolation','standard_singles','digital');
  insert into app.tournament_setup_activations(tournament_id,setup_revision_id,setup_event_version_id,ruleset_version_id,event_id,actor_profile_id,operation_receipt_id) values(t,revision,cs,rules,c,a,rec);
  insert into app.setup_event_link_save_reservations_v1(actor_id,operation_id,tournament_id,expected_version,request_hash,request_payload) values(a,saveop,t,0,repeat('a',64),'{}');
  insert into app.setup_event_link_versions_v1(id,tournament_id,setup_revision_id,setup_version,actor_id,operation_id,association_hash,choices,complete,save_response) values(lv,t,revision,1,a,saveop,repeat('a',64),'[]',true,'{}');
  insert into app.setup_event_link_activation_reservations_v1(actor_id,operation_id,tournament_id,setup_revision_id,expected_version,link_version_id,association_hash,request_hash,request_payload) values(a,actop,t,revision,1,lv,repeat('a',64),repeat('b',64),'{}');
  insert into app.setup_event_link_activation_versions_v1(id,tournament_id,setup_revision_id,actor_id,operation_id,operation_receipt_id,link_version_id,association_hash,activation_response) values(av,t,revision,a,actop,rec,lv,repeat('a',64),'{}');
  insert into app.consolation_main_event_bindings_v1(tournament_id,consolation_event_id,main_event_id,activation_link_version_id,main_setup_event_version_id,consolation_setup_event_version_id) values(t,c,m,av,ms,cs);
  select id into qid from app.qualification_result_versions where event_id=m order by version desc limit 1;
  if not app.qualification_resolution_snapshot_current_v1(qid) or not app.linked_main_series_domain_v1(t,m,qid) then raise exception 'unstubbed current qualification unavailable';end if;
  select array_agg(r.participant_id order by r.ranking_ordinal),array_agg(p.roster_entry_id order by r.ranking_ordinal) into ids,rosters from app.qualification_result_rows r join app.event_participants p on p.id=r.participant_id where r.result_version_id=qid;
  if app.linked_consy_eligibility_v1(t,c,rosters[6])->>'source'<>'nonqualifier' or app.linked_consy_eligibility_v1(t,c,rosters[5])->>'status'<>'pending' then raise exception 'unstubbed eligibility failed';end if;
  op:=extensions.gen_random_uuid();req:=jsonb_build_object('qualificationId',qid,'slot',1,'expectedVersion',0,'winnerId',ids[4],'resultType','played','sourceNote','TEST ONLY synthetic','synthetic',true,'reviewed',true);response:=public.record_linked_main_series_v1(a,t,m,req,op);
  if response->>'status'<>'recorded' or app.linked_consy_eligibility_v1(t,c,rosters[5])->>'source'<>'played_loss' then raise exception 'unstubbed played loss failed %',response;end if;
  insert into linked_codec_results values(jsonb_build_object('actor',a,'tid',t,'eid',m,'request',req,'operation',op,'receipt',response,'workspace',public.get_linked_main_series_workspace_v1(a,t,m)));
  op:=extensions.gen_random_uuid();req:=jsonb_build_object('qualificationId',qid,'slot',2,'expectedVersion',0,'winnerId',ids[1],'resultType','played','sourceNote','TEST ONLY later round','synthetic',false,'reviewed',true);response:=public.record_linked_main_series_v1(a,t,m,req,op);
  if response->>'provenance'<>'director_declared_synthetic' then raise exception 'synthetic ancestor not carried';end if;
  insert into linked_codec_results values(jsonb_build_object('actor',a,'tid',t,'eid',m,'request',req,'operation',op,'receipt',response,'workspace',public.get_linked_main_series_workspace_v1(a,t,m)));
 end$$;select data::text from linked_codec_results;rollback;`,actor,'postgres');
 const codec=await import('../src/lib/api/linked-main-series.ts');const codecRows=codecRaw.split('\n').filter(x=>x.startsWith('{')).map(x=>JSON.parse(x));
 if(codecRows.length!==2)throw Error('Missing actual SQL codec results '+codecRaw);
 for(const r of codecRows)if(!codec.isSeriesRequest(r.request)||!codec.isSeriesReceipt(r.receipt,r.actor,r.tid,r.eid,r.request,r.operation)||!codec.isSeriesWorkspace(r.workspace,r.eid)||!codec.receiptMatchesWorkspace(r.workspace,r.receipt,r.request))throw Error('SQL series response rejected by TypeScript codec '+JSON.stringify(r));
 console.log('PASS actual SQL workspace and acknowledgments match TypeScript codecs including synthetic ancestor');
 console.log('PASS unstubbed current Main qualification, nonqualifier, qualifier pending, and synthetic early played loss');
 // Reuse the 0278 synthetic scored Consolation fixture. Bind before its
 // start and exercise the actual eligibility snapshot trigger;
 // one admitted entrant is a reviewed first-round Main loser.
 const nonqual=read(`select jsonb_agg(to_jsonb(x) order by ranking_ordinal) from (select r.ranking_ordinal,p.profile_id,p.roster_entry_id from app.qualification_result_rows r join app.event_participants p on p.id=r.participant_id where r.event_id='${realMain}' and r.qualification_status<>'qualified' order by r.ranking_ordinal limit 14)x;`,actor,'postgres');
 if(nonqual?.length!==14)throw Error('Expected 14 fixture nonqualifiers');
 const earlyQualifier=read(`select to_jsonb(x) from (select r.ranking_ordinal,p.profile_id,p.roster_entry_id from app.qualification_result_rows r join app.event_participants p on p.id=r.participant_id where r.event_id='${realMain}' and r.qualification_status='qualified' order by r.ranking_ordinal offset 4 limit 1)x;`,actor,'postgres');
 const admissionSetup=`do $$declare a uuid:='${realActor}';t uuid:='${realTid}';m uuid:='${realMain}';c uuid:='${realCons}';revision uuid;ms uuid;cs uuid;rec uuid;saveop uuid:=extensions.gen_random_uuid();actop uuid:=extensions.gen_random_uuid();lv uuid:=extensions.gen_random_uuid();av uuid:=extensions.gen_random_uuid();mq uuid;ids uuid[];r jsonb;begin
  select setup_revision_id,setup_event_version_id into revision,ms from app.tournament_setup_activations where tournament_id=t and event_id=m;select setup_event_version_id into cs from app.tournament_setup_activations where tournament_id=t and event_id=c;select id into rec from app.operation_receipts where tournament_id=t order by applied_at limit 1;
  insert into app.setup_event_link_save_reservations_v1(actor_id,operation_id,tournament_id,expected_version,request_hash,request_payload) values(a,saveop,t,0,repeat('a',64),'{}');
  insert into app.setup_event_link_versions_v1(id,tournament_id,setup_revision_id,setup_version,actor_id,operation_id,association_hash,choices,complete,save_response) values(lv,t,revision,1,a,saveop,repeat('a',64),'[]',true,'{}');
  insert into app.setup_event_link_activation_reservations_v1(actor_id,operation_id,tournament_id,setup_revision_id,expected_version,link_version_id,association_hash,request_hash,request_payload) values(a,actop,t,revision,1,lv,repeat('a',64),repeat('b',64),'{}');
  insert into app.setup_event_link_activation_versions_v1(id,tournament_id,setup_revision_id,actor_id,operation_id,operation_receipt_id,link_version_id,association_hash,activation_response) values(av,t,revision,a,actop,rec,lv,repeat('a',64),'{}');
  insert into app.consolation_main_event_bindings_v1(tournament_id,consolation_event_id,main_event_id,activation_link_version_id,main_setup_event_version_id,consolation_setup_event_version_id) values(t,c,m,av,ms,cs);
  select id into mq from app.qualification_result_versions where event_id=m order by version desc limit 1;select array_agg(participant_id order by ranking_ordinal) into ids from app.qualification_result_rows where result_version_id=mq and qualification_status='qualified';
  r:=public.record_linked_main_series_v1(a,t,m,jsonb_build_object('qualificationId',mq,'slot',1,'expectedVersion',0,'winnerId',ids[4],'resultType','played','sourceNote','TEST ONLY pre-Start loss','synthetic',true,'reviewed',true),extensions.gen_random_uuid());if r->>'status'<>'recorded' then raise exception 'pre-Start loss unavailable %',r;end if;
 end$$;`;
 // Preserve an unlinked V1 outcome and replay it after an explicit binding is
 // attached in the same rollback-only fixture transaction.
 const bindingOnly=admissionSetup.slice(0,admissionSetup.indexOf('  select id into mq from'))+' end$$;';
 const legacySeed=consolationSeed(nonqual,8,true).replace(/commit;\s*$/,'');
 q(legacySeed+`do $$declare a uuid:='${realActor}';t uuid:='${realTid}';c uuid:='${realCons}';cq uuid;ids uuid[];src text;d jsonb;series jsonb;artifact uuid;sha text;req jsonb;op uuid:=extensions.gen_random_uuid();r jsonb;w jsonb;begin
  select id into cq from app.qualification_result_versions where event_id=c order by version desc limit 1;src:=app.consolation_four_qualifier_source_v1(t,c,cq);if src is null then raise exception 'legacy source unavailable';end if;
  select array_agg(participant_id order by ranking_ordinal) into ids from app.qualification_result_rows where result_version_id=cq and qualification_status='qualified';
  d:=jsonb_build_array(jsonb_build_object('winnerId',ids[1],'loserId',ids[4]),jsonb_build_object('winnerId',ids[2],'loserId',ids[3]),jsonb_build_object('winnerId',ids[1],'loserId',ids[2]));
  artifact:=app.prepare_synthetic_consolation_playoff_v1(a,t,c,cq,0,d);select sha256 into sha from app.synthetic_event_artifacts_v1 where id=artifact;
  select jsonb_agg(x||jsonb_build_object('evidenceNote','SYNTHETIC-EVENT-v1:'||artifact||':'||sha||':'||n)order by n) into series from jsonb_array_elements(d) with ordinality e(x,n);
  req:=jsonb_build_object('qualificationResultVersionId',cq,'expectedVersion',0,'sourceDigest',src,'series',series,'reason','TEST ONLY SYNTHETIC: simulated series; no physical play or human review','reviewed',true,'physicalPlayAttested',false,'artifactId',artifact);
  r:=public.record_consolation_playoff_outcomes_v1(a,t,c,req,op);if r->>'status'<>'consolation_playoff_recorded_v1' then raise exception 'legacy write failed %',r;end if;
  w:=public.get_consolation_playoff_workspace_v1(a,t,c);if w->'result'->>'current'<>'true' then raise exception 'legacy current failed';end if;
  perform set_config('test.linked_legacy_op',op::text,true);perform set_config('test.linked_legacy_req',req::text,true);perform set_config('test.linked_legacy_response',r::text,true);
 end$$;`+bindingOnly+`do $$declare a uuid:='${realActor}';t uuid:='${realTid}';c uuid:='${realCons}';req jsonb:=current_setting('test.linked_legacy_req')::jsonb;op uuid:=current_setting('test.linked_legacy_op')::uuid;r jsonb:=current_setting('test.linked_legacy_response')::jsonb;w jsonb;begin
  if public.record_consolation_playoff_outcomes_v1(a,t,c,req,op)<>r then raise exception 'linked historical V1 exact replay changed';end if;
  w:=public.get_consolation_playoff_workspace_v1(a,t,c);if w->'result'->>'current'<>'true' then raise exception 'linked historical V1 currentness changed %',w;end if;
  if exists(select 1 from app.linked_consy_playoff_source_tags_v2 where result_id=(r->>'resultId')::uuid) then raise exception 'legacy row retagged';end if;
 end$$;rollback;`,actor,'postgres');
 console.log('PASS unlinked V1 historical source, linked currentness and exact receipt replay');
 const seeded=consolationSeed([earlyQualifier,...nonqual.slice(0,13)],8,true);
 if(!seeded.includes('insert into app.event_play_starts('))throw Error('Start injection anchor changed');
 q(seeded.replace('insert into app.event_play_starts(',()=>admissionSetup+'insert into app.event_play_starts('),actor,'postgres');
 q(`begin;set local request.jwt.claim.role='service_role';do $$
 declare a uuid:='${realActor}';t uuid:='${realTid}';m uuid:='${realMain}';c uuid:='${realCons}';revision uuid;ms uuid;cs uuid;rec uuid;saveop uuid:=extensions.gen_random_uuid();actop uuid:=extensions.gen_random_uuid();lv uuid:=extensions.gen_random_uuid();av uuid:=extensions.gen_random_uuid();mq uuid;cq uuid;st uuid;ids uuid[];decisions jsonb;series jsonb;artifact uuid;artifact_hash text;source text;req jsonb;result jsonb;op uuid:=extensions.gen_random_uuid();workspace jsonb;
 begin
  select id into mq from app.qualification_result_versions where event_id=m order by version desc limit 1;select id into cq from app.qualification_result_versions where event_id=c order by version desc limit 1;select id into st from app.event_play_starts where event_id=c;
  if (select count(*) from app.linked_consy_start_eligibility_v1 where start_id=st)<>14 or not exists(select 1 from app.linked_consy_start_eligibility_v1 where start_id=st and source_kind='played_loss' and director_declared_synthetic) then raise exception 'trigger admission snapshot missing';end if;
  source:=app.linked_consolation_four_qualifier_source_v2(t,c,cq);if source is null then raise exception 'linked V2 source unavailable';end if;
  select array_agg(participant_id order by ranking_ordinal) into ids from app.qualification_result_rows where result_version_id=mq and qualification_status='qualified';
  result:=public.record_linked_main_series_v1(a,t,m,jsonb_build_object('qualificationId',mq,'slot',3,'expectedVersion',0,'winnerId',ids[2],'resultType','played','sourceNote','TEST ONLY later Main result','synthetic',true,'reviewed',true),extensions.gen_random_uuid());
  if result->>'status'<>'recorded' or app.linked_consolation_four_qualifier_source_v2(t,c,cq)<>source then raise exception 'later Main result changed V2 admission source %',result;end if;
  select array_agg(participant_id order by ranking_ordinal) into ids from app.qualification_result_rows where result_version_id=cq and qualification_status='qualified';
  decisions:=jsonb_build_array(jsonb_build_object('winnerId',ids[1],'loserId',ids[4]),jsonb_build_object('winnerId',ids[2],'loserId',ids[3]),jsonb_build_object('winnerId',ids[1],'loserId',ids[2]));
  artifact:=app.prepare_synthetic_linked_consolation_playoff_v2(a,t,c,cq,0,decisions);select sha256 into artifact_hash from app.synthetic_event_artifacts_v1 where id=artifact;
  select jsonb_agg(x||jsonb_build_object('evidenceNote','SYNTHETIC-EVENT-v1:'||artifact||':'||artifact_hash||':'||n) order by n) into series from jsonb_array_elements(decisions) with ordinality e(x,n);
  req:=jsonb_build_object('qualificationResultVersionId',cq,'expectedVersion',0,'sourceDigest',source,'series',series,'reason','TEST ONLY SYNTHETIC: simulated series; no physical play or human review','reviewed',true,'physicalPlayAttested',false,'artifactId',artifact);
  result:=public.record_consolation_playoff_outcomes_v1(a,t,c,req,op);if result->>'status'<>'consolation_playoff_recorded_v1' then raise exception 'linked V2 writer %',result;end if;
  if public.record_consolation_playoff_outcomes_v1(a,t,c,req,op)<>result then raise exception 'linked V2 replay changed';end if;
  if not exists(select 1 from app.linked_consy_playoff_source_tags_v2 where result_id=(result->>'resultId')::uuid) then raise exception 'V2 tag absent';end if;
  workspace:=public.get_consolation_playoff_workspace_v1(a,t,c);if workspace->'result'->>'current'<>'true' or workspace->>'sourceDigest'<>source then raise exception 'linked V2 workspace %',workspace;end if;
 end$$;rollback;`,actor,'postgres');
 console.log('PASS linked V2 source, synthetic artifact, writer, tag, exact replay and workspace');
 // Held-lock proof: Start must wait for the Main qualification lock before
 // taking the tournament row, while the writer-side lock holder can take it.
 const raceMain=q(`select main_event_id from app.consolation_main_event_bindings_v1 where tournament_id='${tid}' order by main_event_id limit 1;`,actor,'postgres');
 const raceChild=q(`select consolation_event_id from app.consolation_main_event_bindings_v1 where tournament_id='${tid}' and main_event_id='${raceMain}' limit 1;`,actor,'postgres');
 function session(app){const x=spawn('docker',['--context','desktop-linux','exec','-i','-e',`PGAPPNAME=${app}`,name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1']);let out='',err='';x.stdout.on('data',d=>out+=d);x.stderr.on('data',d=>err+=d);const done=new Promise((resolve,reject)=>{x.on('error',reject);x.on('close',c=>c===0?resolve():reject(Error(err)))});return {x,done,get out(){return out},get err(){return err}};}
 async function until(fn,msg){const stop=Date.now()+10000;while(!fn()){if(Date.now()>stop)throw Error(msg);await new Promise(r=>setTimeout(r,50));}}
 const holder=session('linked_evidence_lock_holder'), starter=session('linked_evidence_start_waiter');
 holder.x.stdin.write(`begin;set role postgres;select pg_advisory_xact_lock(hashtextextended('qualification-finalization:${raceMain}',0));select 'HOLDER_READY';\n`);
 await until(()=>holder.out.includes('HOLDER_READY'),'qualification lock barrier unavailable');
 starter.x.stdin.write(`set role postgres;set request.jwt.claim.role='service_role';select public.start_event_play_v1('${actor}','${tid}','${raceChild}','00000000-0000-4000-8000-000000000001',repeat('a',64),2,8,true,'d2900000-0000-4000-8000-000000000099');select 'START_DONE';\n`);
 let waiting=false;const untilWait=Date.now()+7000;while(Date.now()<untilWait&&!waiting){waiting=q("select exists(select 1 from pg_stat_activity where application_name='linked_evidence_start_waiter' and wait_event='advisory');",actor,'postgres')==='t';if(!waiting)await new Promise(r=>setTimeout(r,50));}
 if(!waiting){holder.x.stdin.end('rollback;');starter.x.stdin.end();await Promise.allSettled([holder.done,starter.done]);throw Error('Start did not wait on Main qualification lock');}
 holder.x.stdin.write(`select id from app.tournaments where id='${tid}' for update;select 'TOURNAMENT_ACQUIRED';\n`);
 await until(()=>holder.out.includes('TOURNAMENT_ACQUIRED'),'Start locked tournament before Main qualification');
 holder.x.stdin.end('rollback;');await holder.done;starter.x.stdin.end();await starter.done;
 if(!starter.out.includes('START_DONE'))throw Error('Start failed to resume '+starter.err);
 console.log('PASS Start waits for Main qualification before tournament row; holder obtains tournament without deadlock');
 console.log('FIXTURE_RESULT_JSON '+JSON.stringify({stage:'linked_activation',counts,bindings,hash:saved.links.associationHash}));
}finally{sql('select 1');}
















