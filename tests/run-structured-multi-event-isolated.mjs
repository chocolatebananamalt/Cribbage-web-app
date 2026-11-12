import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync,spawn}from'node:child_process';
import {twentyPlayerMultiPoolPlan} from './fixtures/twenty-player-multi-pool-plan.mjs';
import {consolationPlan,scoreStructuredPaperGames} from './fixtures/structured-multi-event-lifecycle.mjs';
import {publishAndStartStructuredEvent} from './fixtures/structured-multi-event-schedule-start.mjs';
import {verifySourceSetRace} from './fixtures/structured-multi-event-source-race.mjs';
import {projectAccountingWorkspace,isAccountingWorkspace} from '../src/lib/api/multi-event-accounting-workspace.ts';
import {acceptedAccountingAction,isAccountingAction} from '../src/lib/api/multi-event-accounting-action.ts';
import {isTournamentResultEventSummary} from '../src/lib/api/result-event-summary.ts';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-structured-multievent',db='fixture_structured_multievent';
const publicMode=process.env.STRUCTURED_LIFECYCLE_PUBLIC==='1';
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
 const legacyFingerprint=`select coalesce(jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'config',p.proconfig) order by p.oid),'[]')::text from pg_proc p where p.oid=any(array['public.activate_tournament_setup_v2(uuid,uuid,uuid,integer,uuid)'::regprocedure,'app.event_qr_player_is_paid_and_enrolled(uuid,uuid,uuid)'::regprocedure,'public.finalize_cross_checking_v1(uuid,uuid,uuid)'::regprocedure,'public.get_synthetic_paper_evidence_v1(uuid,uuid)'::regprocedure]);`;
 let beforeLegacy;
 for(let n=237;n<=289;n++){
  if(n===288&&!publicMode){console.log('SKIP LOCAL 0288 pending public enablement');continue;}
  const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);
  const bytes=fs.readFileSync('database/migrations/'+file);const hash=crypto.createHash('sha256').update(bytes).digest('hex');const pins={281:'1e20b92909826052fa254f5a6c4683b47d2de716efa34816ea1f0616b2142d5b',282:'81281e6cb8f82c2a2f502a7433a323150232bf130ba0b833e891f846e0a2a5f4',283:'d12586d441f088fddb43a30736720d7928124591a495e35bc9adc04a1ec63807',286:'5ab17b099a2d4b96d732cc2aa2d87166f033c5e64f13c55ed0ba94295e6ca21a',287:'452e829088d885d445f40bf513783133381e6044a0b541abe266fb0bf6af0fa3',288:'64968a9fb60ceb79c4ef702c7ca58f13791d4b5b645270cd0e4b426d6608f6b7',289:'28c438d5e2ddc96e9eca9a99ab78a6102a25f4965bc289e0ef634fab90052dfb'};if(pins[n]&&hash!==pins[n])throw Error(`${n} changed since local verification`);console.log('APPLY LOCAL',file,bytes.length,hash);
  sql('set role postgres;'+bytes.toString('utf8'),db);
  if(n===273)beforeLegacy=sql(legacyFingerprint,db).trim();
 }
 const afterLegacy=sql(legacyFingerprint,db).trim();if(!beforeLegacy||beforeLegacy!==afterLegacy)throw Error('Historical function OID, owner, ACL or security config changed');
 console.log('PASS historical function OID, owner, ACL and security configuration preserved',afterLegacy);

 const q=query=>sql("set role postgres;set request.jwt.claim.sub='a2760000-0000-4000-8000-000000000001';set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';"+query,db).trim();
 const read=query=>{const v=q(query).split('\n').filter(Boolean).at(-1);return v===undefined?null:v==='t'?true:v==='f'?false:JSON.parse(v);};
 const startSession=(query,tag)=>{const child=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(Error(err)));});child.stdin.end(`set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claims='{"role":"service_role"}';set application_name='${tag}';`+query);return{done};};
 const actor='a2760000-0000-4000-8000-000000000001', tid='b2760000-0000-4000-8000-000000000001';
 const api={readiness:publicMode?'public.get_synthetic_event_crosscheck_readiness_v1':'app.synthetic_event_crosscheck_readiness_candidate_v1',closure:publicMode?'public.close_synthetic_event_crosscheck_v1':'app.close_synthetic_event_crosscheck_candidate_v1',draft:publicMode?'public.save_multi_event_unpaid_draft_v1':'app.write_multi_event_unpaid_draft_candidate_v1',workspace:publicMode?'public.get_multi_event_joint_final_workspace_v1':'app.multi_event_joint_final_candidate_workspace_v1',finalize:publicMode?'public.finalize_multi_event_unpaid_v1':'app.write_multi_event_joint_final_candidate_v1',history:publicMode?'public.get_multi_event_joint_final_v1':'app.get_multi_event_joint_final_candidate_v1'};
 const literal=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`;
 const setupOp='d2760000-0000-4000-8000-000000000001';
 q(`insert into auth.users(id,email)values('${actor}','director@test.invalid'),('a2760000-0000-4000-8000-000000000002','checker@test.invalid'),('a2760000-0000-4000-8000-000000000003','codirector@test.invalid');insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('${tid}','${actor}','TEST ONLY structured lifecycle','draft','closed');insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${actor}','director'),('${tid}','a2760000-0000-4000-8000-000000000003','co_director');`);
 const event=(n)=>({clientRowId:`d2760000-0000-4000-8000-${String(10+n).padStart(12,'0')}`,eventKind:n===1?'main':'consolation',displayName:n===1?'Main':'Consolation',startsAt:n===1?'2027-02-03T09:00':'2027-02-04T09:00',timezone:'Pacific/Honolulu',styleCode:'Standard',formatCode:'standard_singles',gameCount:n===1?12:8,entryFeeCents:n===1?5000:1000,freeEntry:false,feeIncludesNote:'',payoutNote:'',qualificationNote:'',eligibilityNote:'',mugginsStatus:'unset',qPools:[{poolTypeCode:'Graduated (1-in-4)',entryFeeCents:1000,note:''},{poolTypeCode:'Equal (Pays All Equally)',entryFeeCents:2000,note:''}],sidePools:n===1?[{poolTypeCode:'TEST ONLY Side 1',entryFeeCents:1000,note:'',payoutType:'graduated-1-in-4'},{poolTypeCode:'TEST ONLY Side 2',entryFeeCents:2000,note:'',payoutType:'graduated-1-in-6'}]:[]});
 const setupEvents=[event(1),event(2)];
 const base={tournamentName:'TEST ONLY structured lifecycle',city:'Honolulu',venue:'TEST ONLY Hall — 1 Test Lane · 96801',venueName:'TEST ONLY Hall',venueStreet:'1 Test Lane',venuePostalCode:'96801',stateTerritory:'Hawaii',startsAt:'2027-02-03T09:00',endsAt:'2027-02-04T23:59',timezone:'Pacific/Honolulu',tournamentDirectorPublicName:'Test Director',tournamentDirectorFirstName:'Test',tournamentDirectorLastName:'Director',tournamentContactPhone:'',tournamentContactEmail:'',tournamentMailingAddress:'',mainSanctioningFeeRateCents:300,consolationSanctioningFeeRateCents:100,mainSanctioningFeeOverrideReason:'',mainSanctioningFeeOverrideReference:'',consolationSanctioningFeeOverrideReason:'',consolationSanctioningFeeOverrideReference:'',officials:[{profileId:actor,role:'director'}],events:setupEvents.map(({sidePools,...e})=>e)};
 const bound=read(`select public.bind_side_pool_setup_request_v1('${actor}','${tid}','${setupOp}','setup',${literal({expectedVersion:0,payload:{...base,events:setupEvents},idempotencyKey:setupOp})});`);if(bound?.status!=='bound')throw Error('Setup bind '+JSON.stringify(bound));
 const saved=read(`select public.save_tournament_setup_version('${tid}',0,${literal(base)},'${setupOp}');`);if(saved?.status!=='setup_draft_saved')throw Error('Setup save '+JSON.stringify(saved));
 const revision=saved.revisionId;
 const configured=read(`select public.configure_tournament_setup_side_pools_v1('${actor}','${tid}','${revision}',${literal(setupEvents)});`);if(configured?.status!=='setup_side_pools_configured')throw Error('Side setup '+JSON.stringify(configured));
 const setupReceipt=read(`select to_jsonb(operation_receipt_id) from app.tournament_setup_revisions where id='${revision}';`);
 const schedule=count=>({kind:'regular-prize-cohort-5usd-v3',amountBasis:'total_award',expectedQualifierCount:count,sourceReference:'TEST ONLY reviewed synthetic formula',roundingRule:'automatic-five-dollar-cohort-v3',cohorts:[{bandStart:1,bandEnd:1,weight:4},{bandStart:2,bandEnd:2,weight:3},{bandStart:3,bandEnd:4,weight:2},...(count===5?[{bandStart:5,bandEnd:5,weight:1}]:[])]});
 for(const [row,count,n] of [['d2760000-0000-4000-8000-000000000011',5,21],['d2760000-0000-4000-8000-000000000012',4,22]]){
  const digest=read(`select to_jsonb(app.event_prize_settings_digest_v2(app.event_prize_settings_v2('${tid}','${row}')));`);
  const req={expectedVersion:0,expectedSettingsFingerprint:digest,schedule:schedule(count),reviewed:true,reason:'TEST ONLY synthetic event formula'};
  const result=read(`select public.save_event_prize_declaration_v2('${actor}','${tid}','${row}',${literal(req)},'d2760000-0000-4000-8000-${String(n).padStart(12,'0')}');`);
  if(result?.status!=='event_prize_declaration_saved_v2')throw Error('Declaration '+JSON.stringify(result));
 }
 const pins=read(`select app.current_event_prize_activation_pins_v1('${tid}','${revision}',1);`);
 if(!Array.isArray(pins)||pins.length!==2)throw Error('Missing reviewed declaration pins');
 const activation=read(`select public.finalize_tournament_setup_pinned_v2('${actor}','${tid}','${revision}',1,true,${literal(pins)},'d2760000-0000-4000-8000-000000000032');`);
 if(activation?.status!=='tournament_setup_activated')throw Error('Activation '+JSON.stringify(activation));
 if(read(`select count(*)::integer from app.event_prize_schedule_bindings_v2 where tournament_id='${tid}';`)!==2)throw Error('Missing V2 event bindings');
 const materialized=read(`select public.materialize_tournament_setup_side_pools_v1('${actor}','${tid}','${revision}');`);if(materialized?.status!=='setup_side_pools_materialized')throw Error('Side materialization '+JSON.stringify(materialized));
 console.log('PASS fresh two-event declarations and activation', JSON.stringify(activation));
 const main=activation.events.find(e=>e.eventType==='main').eventId, cons=activation.events.find(e=>e.eventType==='consolation').eventId;
 const id=(prefix,n)=>`${prefix}0000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 q(`insert into app.synthetic_paper_deployments_v1(project_ref,authorization_reference)values('nnhcnvksxgxnpvdqjgpg','TEST ONLY isolated synthetic lifecycle');
 insert into app.synthetic_paper_fixtures_v1(event_id,tournament_id,project_ref,authorization_reference)values
 ('${main}','${tid}','nnhcnvksxgxnpvdqjgpg','TEST ONLY isolated synthetic Main'),('${cons}','${tid}','nnhcnvksxgxnpvdqjgpg','TEST ONLY isolated synthetic Consolation');
 insert into auth.users(id,email) select ('a5760000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'fictional-'||n||'@test.invalid' from generate_series(1,20)n;
 insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id)
 select ('a4760000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${tid}','director_manual','TEST ONLY Player '||n,'test only player '||n,'paper','${actor}','${setupReceipt}' from generate_series(1,20)n;
 insert into app.event_participants(id,tournament_id,event_id,profile_id,roster_entry_id,table_seat,status)
 select ('a6760000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${tid}','${main}',('a5760000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('a4760000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,chr(65+(n-1)/4)||'-'||(((n-1)%4)+1),'registered' from generate_series(1,20)n;`);
 const mode=read(`select public.activate_multi_event_finance_v1('${actor}','${tid}','simulation','${id('d376',1)}');`);
 if(mode?.status!=='multi_event_finance_activated')throw Error('Finance mode '+JSON.stringify(mode));
 const disclose=(eid,specs,tag)=>specs.map((spec,i)=>{
  const request={...spec,disclosureReference:'TEST ONLY SYNTHETIC: disclosure before elections',disclosed:true};
  const policy=read(`select public.publish_multi_event_pool_disclosure_v1('${actor}','${tid}','${eid}',${literal(request)},'${id(tag,10+i)}');`);
  if(policy?.status!=='synthetic_pool_policy_disclosed')throw Error('Pool disclosure '+JSON.stringify(policy));return policy.policyId;
 });
 const qDefinitions=eid=>read(`select jsonb_agg(to_jsonb(q.id) order by q.slot) from app.tournament_setup_q_pool_versions q join app.tournament_setup_activations a on a.setup_event_version_id=q.setup_event_version_id where a.event_id='${eid}';`);
 const mainQ=qDefinitions(main),consQ=qDefinitions(cons);
 const sideDefs=read(`select jsonb_agg(to_jsonb(d.id) order by s.slot) from app.tournament_setup_side_pool_materializations m join app.tournament_setup_side_pool_versions s on s.id=m.setup_side_pool_version_id join app.event_side_pool_definition_versions d on d.pool_id=m.pool_id where m.event_id='${main}';`);
 if(mainQ?.length!==2||consQ?.length!==2||sideDefs?.length!==2)throw Error('Missing configured pool definitions');
 const graduated='graduated-acc-weighted-largest-remainder-5usd-v2',equal='equal-paid-playoff-qualifiers-v2';
 const policies=disclose(main,[{kind:'q',poolDefinitionId:mainQ[0],method:graduated,ratio:4},{kind:'q',poolDefinitionId:mainQ[1],method:equal,ratio:null},{kind:'side',poolDefinitionId:sideDefs[0],method:graduated,ratio:4},{kind:'side',poolDefinitionId:sideDefs[1],method:graduated,ratio:6}],'d376');
 const plan=twentyPlayerMultiPoolPlan();
 const paid=new Set(plan.paidIds.map(s=>Number(s.slice(-2))));
 let finance='';
 for(let n=1;n<=20;n++){
  const participant=id('a676',n),roster=id('a476',n);
  finance+=`do $$declare r jsonb;e1 uuid;e2 uuid;e3 uuid;e4 uuid;req jsonb;begin
   r:=public.record_multi_event_simulated_pool_election_v1('${actor}','${tid}','${main}',${literal({policyId:policies[0],participantId:participant,expectedVersion:0,elected:paid.has(n),reason:'TEST ONLY SYNTHETIC: Q1 election',reviewed:true})},'${id('d376',100+n*10)}');if r->>'status'<>'synthetic_pool_election_recorded'then raise exception 'Q1 %',r;end if;e1:=(r->>'electionId')::uuid;
   r:=public.record_multi_event_simulated_pool_election_v1('${actor}','${tid}','${main}',${literal({policyId:policies[1],participantId:participant,expectedVersion:0,elected:true,reason:'TEST ONLY SYNTHETIC: Q2 election',reviewed:true})},'${id('d376',101+n*10)}');if r->>'status'<>'synthetic_pool_election_recorded'then raise exception 'Q2 %',r;end if;e2:=(r->>'electionId')::uuid;
   r:=public.record_multi_event_simulated_pool_election_v1('${actor}','${tid}','${main}',${literal({policyId:policies[2],participantId:participant,expectedVersion:0,elected:true,reason:'TEST ONLY SYNTHETIC: Side 1 election',reviewed:true})},'${id('d376',102+n*10)}');if r->>'status'<>'synthetic_pool_election_recorded'then raise exception 'Side 1 %',r;end if;e3:=(r->>'electionId')::uuid;
   r:=public.record_multi_event_simulated_pool_election_v1('${actor}','${tid}','${main}',${literal({policyId:policies[3],participantId:participant,expectedVersion:0,elected:true,reason:'TEST ONLY SYNTHETIC: Side 2 election',reviewed:true})},'${id('d376',103+n*10)}');if r->>'status'<>'synthetic_pool_election_recorded'then raise exception 'Side 2 %',r;end if;e4:=(r->>'electionId')::uuid;
   req:=jsonb_build_object('rosterEntryId','${roster}','amountMinor',${paid.has(n)?11000:10000},'events',jsonb_build_array(jsonb_build_object('eventId','${main}','baseMinor',5000,'q',${paid.has(n)?`jsonb_build_array(jsonb_build_object('policyId','${policies[0]}','electionId',e1,'amountMinor',1000),jsonb_build_object('policyId','${policies[1]}','electionId',e2,'amountMinor',2000))`:`jsonb_build_array(jsonb_build_object('policyId','${policies[1]}','electionId',e2,'amountMinor',2000))`},'side',jsonb_build_array(jsonb_build_object('policyId','${policies[2]}','electionId',e3,'amountMinor',1000),jsonb_build_object('policyId','${policies[3]}','electionId',e4,'amountMinor',2000)))),'reason','TEST ONLY SYNTHETIC: fictional payment','reviewed',true);
   r:=public.record_multi_event_synthetic_pool_receipt_v1('${actor}','${tid}',req,'${id('d376',104+n*10)}');if r->>'status'<>'synthetic_pool_receipt_recorded'then raise exception 'receipt %',r;end if;end$$;`;
 }
 q(finance);
 if(read(`select count(*)::integer from app.multi_event_pool_receipts_v1 where tournament_id='${tid}';`)!==20)throw Error('Missing synthetic receipts');
 console.log('PASS pristine simulation finance: 20 synthetic Main receipts, Q1 16, Q2 and both Side 20 elections');
 const requireStatus=(result,status)=>{if(result?.status!==status)throw Error(`${status}: ${JSON.stringify(result)}`);return result;};
 const assertArtifact=a=>{if(!a||crypto.createHash('sha256').update(a.text).digest('hex')!==a.sha256||a.reference!==`SYNTHETIC-EVENT-v1:${a.artifactId}:${a.sha256}`)throw Error('Synthetic event artifact hash mismatch');return a;};
 const closeAndQualify=(eventId,tag)=>{
  const artifactId=read(`select to_jsonb(app.prepare_synthetic_event_artifact_v1('${actor}','${tid}','${eventId}','close','{}'::jsonb));`);
  const context=read(`select public.get_synthetic_event_context_v1('${actor}','${tid}');`);
  const artifact=assertArtifact(context.artifacts.find(a=>a.artifactId===artifactId));
  const expected=eventId===main?120:56;
  if(artifact.payload.verifiedGames!==expected||artifact.payload.structuredSyntheticGames!==expected||artifact.payload.legacyVerifiedGamesWithoutStructuredProof!==0)throw Error('Incomplete structured scoring '+JSON.stringify(artifact.payload));
  const close=read(`select public.close_synthetic_event_v1('${actor}','${tid}','${eventId}','${artifactId}','TEST ONLY SYNTHETIC: ${artifact.reference} simulated counts',true,'${id('d476',tag)}');`);
  requireStatus(close,'event_play_closed');
  const qualified=read(`select public.finalize_standard_singles_qualification_v1('${actor}','${tid}','${eventId}','${id('d476',tag+1)}');`);
  requireStatus(qualified,'qualification_finalized');
  const state=read(`select jsonb_build_object('id',id,'count',qualifier_count,'current',app.qualification_resolution_snapshot_current_v1(id)) from app.qualification_result_versions where event_id='${eventId}' order by version desc limit 1;`);
  if(!state?.current)throw Error('Qualification snapshot stale '+JSON.stringify(state));return state;
 };
 const enrollConsolation=()=>{
  const rows=read(`select jsonb_agg(to_jsonb(x) order by x.ranking_ordinal) from (select r.ranking_ordinal,p.profile_id,p.roster_entry_id from app.qualification_result_rows r join app.event_participants p on p.id=r.participant_id where r.event_id='${main}' and r.qualification_status<>'qualified' and p.roster_entry_id<>'${id('a476',4)}' order by r.ranking_ordinal)x;`);
  if(rows?.length!==14)throw Error('Expected fourteen eligible Consolation entries');
  let statements='';
  rows.forEach((row,i)=>{
   const n=Number(row.roster_entry_id.slice(-12)),participant=id('a776',n);
   statements+=`insert into app.event_participants(id,tournament_id,event_id,profile_id,roster_entry_id,table_seat,status)values('${participant}','${tid}','${cons}','${row.profile_id}','${row.roster_entry_id}',chr(65+(${n}-1)/4)||'-'||(((${n}-1)%4)+1),'registered');`;
  });
  q(statements);
  const consPolicies=disclose(cons,[{kind:'q',poolDefinitionId:consQ[0],method:graduated,ratio:4},{kind:'q',poolDefinitionId:consQ[1],method:equal,ratio:null}],'d576');
  for(const row of rows){
   const n=Number(row.roster_entry_id.slice(-12)),participant=id('a776',n);
   q(`do $$declare r jsonb;e1 uuid;e2 uuid;req jsonb;begin
    r:=public.record_multi_event_simulated_pool_election_v1('${actor}','${tid}','${cons}',${literal({policyId:consPolicies[0],participantId:participant,expectedVersion:0,elected:true,reason:'TEST ONLY SYNTHETIC: Consolation Q1 election',reviewed:true})},'${id('d576',100+n*3)}');if r->>'status'<>'synthetic_pool_election_recorded'then raise exception 'Consolation Q1 %',r;end if;e1:=(r->>'electionId')::uuid;
    r:=public.record_multi_event_simulated_pool_election_v1('${actor}','${tid}','${cons}',${literal({policyId:consPolicies[1],participantId:participant,expectedVersion:0,elected:true,reason:'TEST ONLY SYNTHETIC: Consolation Q2 election',reviewed:true})},'${id('d576',101+n*3)}');if r->>'status'<>'synthetic_pool_election_recorded'then raise exception 'Consolation Q2 %',r;end if;e2:=(r->>'electionId')::uuid;
    req:=jsonb_build_object('rosterEntryId','${row.roster_entry_id}','amountMinor',4000,'events',jsonb_build_array(jsonb_build_object('eventId','${cons}','baseMinor',1000,'q',jsonb_build_array(jsonb_build_object('policyId','${consPolicies[0]}','electionId',e1,'amountMinor',1000),jsonb_build_object('policyId','${consPolicies[1]}','electionId',e2,'amountMinor',2000)),'side','[]'::jsonb)),'reason','TEST ONLY SYNTHETIC: fictional Consolation payment','reviewed',true);
    r:=public.record_multi_event_synthetic_pool_receipt_v1('${actor}','${tid}',req,'${id('d576',102+n*3)}');if r->>'status'<>'synthetic_pool_receipt_recorded'then raise exception 'Consolation receipt %',r;end if;end$$;`);
  }
  return rows.map(row=>{const n=Number(row.roster_entry_id.slice(-12));return {participantId:id('a776',n),rosterEntryId:row.roster_entry_id,verificationId:`${String.fromCharCode(65+Math.floor((n-1)/4))}-${(n-1)%4+1}`};});
 };
 const finishMainPlayoffs=()=>{
  const workspace=read(`select public.get_standard_singles_playoff_outcome_workspace_v4('${actor}','${tid}','${main}');`);
  const seeds=workspace?.qualifiers?.map(x=>x.participantId);
  if(seeds?.length!==5)throw Error('Main playoff workspace '+JSON.stringify(workspace));
  const series=[[seeds[3],seeds[4]],[seeds[3],seeds[0]],[seeds[2],seeds[1]],[seeds[2],seeds[3]]].map(([winnerId,loserId])=>({winnerId,loserId}));
  const aid=read(`select to_jsonb(app.prepare_synthetic_event_artifact_v1('${actor}','${tid}','${main}','playoff',${literal(series)}));`);
  const artifact=assertArtifact(read(`select public.get_synthetic_event_context_v1('${actor}','${tid}');`).artifacts.find(x=>x.artifactId===aid));
  const req={...artifact.payload,series:series.map((s,i)=>({...s,evidenceNote:`${artifact.reference}:${i+1}`})),reason:'TEST ONLY SYNTHETIC: simulated playoff, no physical play',reviewed:true};
  const out=read(`select public.record_synthetic_playoff_v1('${actor}','${tid}','${main}','${aid}',${literal(req)},'${id('d476',20)}');`);
  requireStatus(out,'playoff_outcomes_recorded_v4');
 };
 const finishConsolationPlayoffs=qid=>{
  const w=read(`select public.get_consolation_playoff_workspace_v1('${actor}','${tid}','${cons}');`);
  const seeds=w?.qualifiers?.map(x=>x.participantId);
  if(!w?.canRecord||seeds?.length!==4)throw Error('Consolation playoff workspace '+JSON.stringify(w));
  const series=[[seeds[0],seeds[3]],[seeds[1],seeds[2]],[seeds[1],seeds[0]]].map(([winnerId,loserId])=>({winnerId,loserId}));
  const aid=read(`select to_jsonb(app.prepare_synthetic_consolation_playoff_v1('${actor}','${tid}','${cons}','${qid}',0,${literal(series)}));`);
  const a=assertArtifact(read(`select public.get_synthetic_event_context_v1('${actor}','${tid}');`).artifacts.find(x=>x.artifactId===aid));
  const ref=a.reference;
  const req={qualificationResultVersionId:qid,expectedVersion:0,sourceDigest:w.sourceDigest,series:series.map((s,i)=>({...s,evidenceNote:`${ref}:${i+1}`})),reason:'TEST ONLY SYNTHETIC: simulated series, no physical play',reviewed:true,physicalPlayAttested:false,artifactId:aid};
  requireStatus(read(`select public.record_consolation_playoff_outcomes_v1('${actor}','${tid}','${cons}',${literal(req)},'${id('d476',21)}');`),'consolation_playoff_recorded_v1');
 };
 const classifyExpenses=()=>{
  // A real normal start may have created these; otherwise seed the documented
  // immutable assessment foundation using its actual start identity and field.
  for(const [eid,kind,rate,count] of [[main,'main',300,20],[cons,'consolation',100,14]])q(`insert into app.event_sanctioning_fee_snapshots(tournament_id,event_id,event_play_start_id,event_kind,rate_cents,eligible_participant_count,total_cents,rate_source,setup_revision_id)
   select '${tid}','${eid}',id,'${kind}',${rate},${count},${rate*count},'setup','${revision}' from app.event_play_starts where event_id='${eid}' and not exists(select 1 from app.event_sanctioning_fee_snapshots where event_id='${eid}');`);
  const expense={kind:'expense',rosterEntryId:null,amountMinor:7400,allocations:[{eventId:main,amountMinor:6000},{eventId:cons,amountMinor:1400}],reason:'TEST ONLY SYNTHETIC: fictional sanction assessments',reviewed:true};
  requireStatus(read(`select public.record_multi_event_finance_source_v1('${actor}','${tid}',${literal(expense)},'${id('d476',30)}');`),'multi_event_source_recorded');
  for(const [eid,n,amount] of [[main,31,6000],[cons,32,1400]]){
   const source=read(`select public.get_multi_event_synthetic_event_sources_v1('${actor}','${tid}','${eid}');`);
   const classes=source.expenseEvidence.map(x=>({sourceId:x.id,category:'sanctioning',amountMinor:x.amountMinor}));
   const req={expectedVersion:0,sourceDigest:source.sourceDigest,classifications:classes,reason:'TEST ONLY SYNTHETIC: classified assessment',reviewed:true};
   const result=read(`select public.review_multi_event_expenses_v1('${actor}','${tid}','${eid}',${literal(req)},'${id('d476',n)}');`);
   requireStatus(result,'synthetic_expenses_classified');
   if(Number(result.facts?.sanctioningMinor)!==amount)throw Error('Wrong assessment '+JSON.stringify(result));
  }
 };
 const verifyPreviews=()=>{
  const results=[];
  for(const [eid,base,q,side,total] of [[main,100000,56000,60000,6000],[cons,14000,42000,0,1400]]){
   const w=read(`select public.get_multi_event_award_preview_v1('${actor}','${tid}','${eid}');`);
   if(w?.status!=='preview'||w.baseIncomeMinor!==base||w.qIncomeMinor!==q||w.sideIncomeMinor!==side||w.expenseMinor!==total||w.moneyMoved!==false)throw Error('Award preview '+JSON.stringify(w));
   if(!/^[a-f0-9]{64}$/.test(w.sourceDigest))throw Error('Invalid preview source hash');
   const financial=read(`select public.get_multi_event_synthetic_event_sources_v1('${actor}','${tid}','${eid}');`);
   if(!/^[a-f0-9]{64}$/.test(w.financialSourceDigest||'')||w.financialSourceDigest!==financial.sourceDigest)throw Error('Preview financial source digest mismatch');
   const poolCheck=(kind,fund,amounts,memberIds)=>{const p=w.pools.find(x=>x.kind===kind&&x.calculation?.fundMinor===fund);if(!p||p.sourceComponents.length!==memberIds.length||JSON.stringify(p.calculation.awards.map(x=>x.amountMinor))!==JSON.stringify(amounts)||p.calculation.awards.reduce((s,x)=>s+x.amountMinor,0)!==fund)throw Error('Wrong pool '+JSON.stringify({kind,fund,p}));const sourceMembers=p.sourceComponents.map(c=>financial.sources.find(s=>s.receiptId===c.receiptId)?.rosterEntryId).sort();if(JSON.stringify(sourceMembers)!==JSON.stringify([...memberIds].sort()))throw Error('Wrong pool members or event source '+JSON.stringify({kind,fund,sourceMembers}));return p;};
   if(eid===main){
    const everyone=mainParticipants.map(x=>x.rosterEntryId),q1=everyone.filter(x=>paid.has(Number(x.slice(-12))));
    const graduated=poolCheck('q',16000,[6500,5000,3000,1500],q1).calculation;
    const expected=plan.qAwards.map(a=>id('a676',Number(a.participantId.slice(-2))));
    if(JSON.stringify(graduated.awards.map(x=>x.participantId))!==JSON.stringify(expected))throw Error('Q card-rank recipients differ from planned backfill');
    poolCheck('q',40000,[8000,8000,8000,8000,8000],everyone);
    poolCheck('side',20000,[6500,5500,4000,2500,1500],everyone);
    poolCheck('side',40000,[16000,12000,8000,4000],everyone);
    if(w.pools.length!==4)throw Error('Unexpected Main pool scope');
   }else{
    const everyone=consParticipants.map(x=>x.rosterEntryId);
    poolCheck('q',14000,[5500,4000,3000,1500],everyone);
    poolCheck('q',28000,[7000,7000,7000,7000],everyone);
    if(w.pools.length!==2)throw Error('Unexpected Consolation pool scope');
   }
   results.push(w);
  }
  return results;
 };
 const checker='a2760000-0000-4000-8000-000000000002';
 const mainParticipants=Array.from({length:20},(_,i)=>({participantId:id('a676',i+1),rosterEntryId:id('a476',i+1),verificationId:`${String.fromCharCode(65+Math.floor(i/4))}-${i%4+1}`}));
 const scorePublished=(eventId,matches,tag)=>{
  const games=read(`select jsonb_agg(jsonb_build_object('id',g.id,'round',r.round_number,'a',g.side_a_participant_id,'b',g.side_b_participant_id))from app.canonical_games g join app.rounds r on r.id=g.round_id where g.event_id='${eventId}';`);
  const prepared=matches.map(m=>{const g=games.find(x=>x.round===m.gameNumber&&x.a===m.a&&x.b===m.b);if(!g)throw Error('Scheduled game missing '+JSON.stringify(m));return {gameId:g.id,winnerSide:m.winnerSide,margin:m.margin};});
  scoreStructuredPaperGames({sql:q,read,actor,checker,tournamentId:tid,eventId,matches:prepared,operationId:(kind,i)=>id(tag,({completion:1000,capture:2000,review:3000})[kind]+i)});
 };
 const mainMatches=plan.matches.map(m=>{const a=Number(m.a.slice(-2)),b=Number(m.b.slice(-2));return {...m,a:id('a676',a),b:id('a676',b),winnerSide:m.winner===m.a?'a':'b',margin:m.spreadPoints};});
 publishAndStartStructuredEvent({sql:q,read,actor,tournamentId:tid,eventId:main,participants:mainParticipants,matches:mainMatches,gameCount:12,operationId:(kind,i=0)=>id('d676',({seating:1,open:10,roster:30,registration:60,checkin:100,close:200,publish:300,start:301,bind:302,bindingId:303})[kind]+i),checkerProfileId:checker,initialSeating:true});
 scorePublished(main,mainMatches,'d776');
 if(closeAndQualify(main,1).count!==5)throw Error('Expected five Main qualifiers');
 finishMainPlayoffs();
 console.log('PASS 120 generated paired Main cards, synthetic capture/review, current five-player qualification and Main playoff');
 console.log('STAGE_JSON '+JSON.stringify({stage:'main_qualification_playoff',eventId:main,verifiedGames:120,qualifiers:5}));
 const consParticipants=enrollConsolation();
 const byNumber=n=>consParticipants.find(p=>p.rosterEntryId===id('a476',n)).participantId;
 const consRounds=consolationPlan(consParticipants.map(p=>p.participantId),[[6,8],[9,10],[11,12],[13,14],[15,16],[17,18],[19,20]].map(pair=>pair.map(byNumber)));
 const byParticipant=new Map(consParticipants.map(p=>[p.participantId,p]));
 const consMatches=consRounds.map((m,i)=>{const a=byParticipant.get(m.a),b=byParticipant.get(m.b),seat=i%7,table=String.fromCharCode(65+Math.floor(seat/2)),first=m.round===1;return {...m,gameNumber:m.round,sideAVerificationId:a.verificationId,sideBVerificationId:b.verificationId,sideATableSeat:first?a.verificationId:`${table}-${seat%2*2+1}`,sideBTableSeat:first?b.verificationId:`${table}-${seat%2*2+2}`};});
 publishAndStartStructuredEvent({sql:q,read,actor,tournamentId:tid,eventId:cons,participants:consParticipants,matches:consMatches,gameCount:8,operationId:(kind,i=0)=>id('d876',({seating:1,open:10,checkin:100,close:200,publish:300,start:301,bind:302})[kind]+i),checkerProfileId:checker,initialSeating:false});
 scorePublished(cons,consMatches,'d976');
 const cq=closeAndQualify(cons,5);if(cq.count!==4)throw Error('Expected four Consolation qualifiers');
 finishConsolationPlayoffs(cq.id);
 if(read(`select count(*)::integer from app.multi_event_pool_receipts_v1 where tournament_id='${tid}';`)!==34)throw Error('Missing event-specific pooled receipts');
 console.log('PASS 56 generated paired Consolation cards, synthetic capture/review, current four-player qualification and Consolation playoff');
 console.log('STAGE_JSON '+JSON.stringify({stage:'consolation_qualification_playoff',eventId:cons,verifiedGames:56,qualifiers:4}));
 classifyExpenses();const previews=verifyPreviews();
 for(const eid of [main,cons]){const selector=read(`select public.get_simulated_finance_selector_workspace_v1('${actor}','${tid}','${eid}');`);if(selector?.status!=='available'||selector.financialClosed!==false||selector.moneyMoved!==false)throw Error('Pre-final selector '+JSON.stringify(selector));}
 if(read(`select public.get_multi_event_award_preview_v1('a2760000-0000-4000-8000-000000009999','${tid}','${main}');`)!==null)throw Error('Outsider preview exposed');
 const replay=read(`select public.activate_multi_event_finance_v1('${actor}','${tid}','simulation','${id('d376',1)}');`);
 if(JSON.stringify(replay)!==JSON.stringify(mode))throw Error('Accepted finance mode replay changed');
 const stale=read(`begin;update app.events set name=name||' TEST ONLY changed' where id='${main}';select public.get_multi_event_award_preview_v1('${actor}','${tid}','${cons}');rollback;`);
 if(stale?.status==='preview')throw Error('Changed Main source left Consolation preview current');
 if(read(`select count(*)::integer from app.synthetic_event_provenance_v1 where tournament_id='${tid}' and (actual_money_received or physical_play or human_review_claimed or money_moved);`)!==0)throw Error('Untruthful synthetic provenance');
 if(read(`select count(*)::integer from app.roster_payment_events where tournament_id='${tid}';`)!==0)throw Error('Legacy receipt unexpectedly created');
 console.log('PASS actual dual-event 0281 previews and Q backfill; TEST ONLY no cash or human play');
 console.log('STAGE_JSON '+JSON.stringify({stage:'six_pool_previews',previews}));
 q(`do $$declare g app.canonical_games%rowtype;begin select * into g from app.canonical_games where event_id='${main}' order by id limit 1;
  begin insert into app.game_corrections(id,tournament_id,event_id,canonical_game_id,correction_sequence,base_game_version,editor_profile_id,previous_winner_side,previous_margin,corrected_winner_side,corrected_margin)
  values('${id('d476',49)}','${tid}','${main}',g.id,1,g.version,'${actor}',g.winner_side,g.margin,case when g.winner_side='a'then'b'else'a'end,g.margin);
  raise exception 'unproven_correction_accepted';exception when raise_exception then if sqlerrm<>'synthetic_evidence_required'then raise;end if;end;end$$;`);
 // A scoped open dispute in a rolled-back adversarial transaction blocks only
 // the affected event. It carries no score or physical-play assertion.
 q(`begin;do $$declare gid uuid;receipt uuid:='${setupReceipt}';r jsonb;begin
  select id into gid from app.canonical_games where event_id='${cons}' order by id limit 1;
  insert into app.event_disputes(id,tournament_id,event_id,canonical_game_id,opened_by_profile_id,summary,open_operation_receipt_id)values('${id('d476',50)}','${tid}','${cons}',gid,'${actor}','TEST ONLY synthetic scoped dispute',receipt);
  insert into app.event_dispute_state_events(dispute_id,tournament_id,event_id,canonical_game_id,transition_sequence,state,actor_profile_id,actor_role,operation_receipt_id)values('${id('d476',50)}','${tid}','${cons}',gid,1,'open','${actor}','director',receipt);
  r:=${api.readiness}('${actor}','${tid}','${cons}');if r->>'code'<>'open_review_work'then raise exception 'Consolation dispute not blocked %',r;end if;
  r:=${api.readiness}('${actor}','${tid}','${main}');if r->>'status'<>'candidate_ready'then raise exception 'Unrelated Main blocked %',r;end if;
 end$$;rollback;`);
 const closureResults=[];
 for(const [eid,n] of [[main,60],[cons,70]]){
  const ready=read(`select ${api.readiness}('${actor}','${tid}','${eid}');`);
  requireStatus(ready,'candidate_ready');
  const req={sourceDigest:ready.sourceDigest,reason:'TEST ONLY SYNTHETIC: source-bound software cross-check closure',reviewed:true};
  const call=(request,op,who=actor)=>`select ${api.closure}('${who}','${tid}','${eid}',${literal(request)},'${op}');`;
  if(read(call({...req,sourceDigest:'0'.repeat(64)},id('d476',n))).code!=='source_changed')throw Error('Stale closure accepted');
  if(read(call(req,id('d476',n+1),checker)).code!=='not_director')throw Error('Cross-checker closure authority widened');
  // A held event advisory forces two independent PostgreSQL sessions to race.
  const gate=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
  let gateOut='',gateErr='';gate.stdout.on('data',x=>gateOut+=x);gate.stderr.on('data',x=>gateErr+=x);
  const gateDone=new Promise((resolve,reject)=>{gate.on('error',reject);gate.on('close',code=>code===0?resolve():reject(Error(gateErr)));});
  gate.stdin.write(`begin;select pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:${eid}',0));select 'GATE_READY';\n`);
  let until=Date.now()+10000;while(!gateOut.includes('GATE_READY')){if(Date.now()>until){gate.kill();throw Error('Closure barrier unavailable');}await new Promise(r=>setTimeout(r,50));}
  const first=startSession(call(req,id('d476',n+2)),'fixture_closure_a');
  const second=startSession(call(req,id('d476',n+3)),'fixture_closure_b');
  let waiting=false;until=Date.now()+10000;
  try{while(Date.now()<until){if(q("select count(*) from pg_stat_activity where application_name in ('fixture_closure_a','fixture_closure_b') and wait_event_type='Lock';")==='2'){waiting=true;break;}await new Promise(r=>setTimeout(r,50));}}
  finally{gate.stdin.end('commit;');}
  await gateDone;
  const outcomes=(await Promise.all([first.done,second.done])).map(x=>JSON.parse(x.trim().split('\n').findLast(y=>y.startsWith('{'))));
  if(!waiting||outcomes.filter(x=>x.status==='synthetic_event_crosscheck_closed').length!==1||outcomes.filter(x=>x.code==='crosscheck_already_closed').length!==1)throw Error('Closure race failed '+JSON.stringify(outcomes));
  const accepted=outcomes.find(x=>x.status==='synthetic_event_crosscheck_closed');
  const winningOp=outcomes[0]===accepted?id('d476',n+2):id('d476',n+3);
  if(publicMode){const action={action:'crosscheck',operationId:winningOp,eventId:eid,request:req};if(!isAccountingAction(action)||!acceptedAccountingAction(accepted,action,tid))throw Error('Actual closure acknowledgement rejected by API codec '+JSON.stringify(accepted));}
  if(JSON.stringify(read(call(req,winningOp)))!==JSON.stringify(accepted))throw Error('Closure replay changed');
  if(read(call({...req,reason:req.reason+' changed'},winningOp)).code!=='idempotency_conflict')throw Error('Changed closure replay accepted');
  closureResults.push(accepted);
 }
 console.log('PASS both private source-bound cross-check closure candidates, scoped dispute, stale/role/replay and serialized competing writers');
 console.log('STAGE_JSON '+JSON.stringify({stage:'private_crosscheck_closures',closures:closureResults}));
 const draftResults=[];
 for(const [eid,n] of [[main,80],[cons,90]]){
  const preview=read(`select public.get_multi_event_award_preview_v1('${actor}','${tid}','${eid}');`);
  const req={expectedVersion:0,sourceDigest:preview.sourceDigest,reason:'TEST ONLY SYNTHETIC: reviewed unpaid draft candidate',reviewed:true};
  const call=(request,op,who=actor)=>`select ${api.draft}('${who}','${tid}','${eid}',${literal(request)},'${op}');`;
  if(read(call({...req,sourceDigest:'0'.repeat(64)},id('d476',n))).code!=='source_changed')throw Error('Stale draft accepted');
  if(read(call(req,id('d476',n+1),checker)).code!=='not_director')throw Error('Cross-checker draft authority widened');
  const gate=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
  let gateOut='',gateErr='';gate.stdout.on('data',x=>gateOut+=x);gate.stderr.on('data',x=>gateErr+=x);
  const gateDone=new Promise((resolve,reject)=>{gate.on('error',reject);gate.on('close',code=>code===0?resolve():reject(Error(gateErr)));});
  gate.stdin.write(`begin;select 1 from app.tournaments where id='${tid}' for update;select 'GATE_READY';\n`);
  let until=Date.now()+10000;while(!gateOut.includes('GATE_READY')){if(Date.now()>until){gate.kill();throw Error('Draft barrier unavailable');}await new Promise(r=>setTimeout(r,50));}
  const first=startSession(call(req,id('d476',n+2)),'fixture_draft_a'),second=startSession(call(req,id('d476',n+3)),'fixture_draft_b');
  let waiting=false;until=Date.now()+10000;
  try{while(Date.now()<until){if(q("select count(*) from pg_stat_activity where application_name in ('fixture_draft_a','fixture_draft_b') and wait_event_type='Lock';")==='2'){waiting=true;break;}await new Promise(r=>setTimeout(r,50));}}
  finally{gate.stdin.end('commit;');}
  await gateDone;
  const outcomes=(await Promise.all([first.done,second.done])).map(x=>JSON.parse(x.trim().split('\n').findLast(y=>y.startsWith('{'))));
  if(!waiting||outcomes.filter(x=>x.status==='synthetic_unpaid_draft_saved').length!==1||outcomes.filter(x=>x.code==='stale_version').length!==1)throw Error('Draft race failed '+JSON.stringify(outcomes));
  const draft=outcomes.find(x=>x.status==='synthetic_unpaid_draft_saved'),winningOp=outcomes[0]===draft?id('d476',n+2):id('d476',n+3);
  if(publicMode){const action={action:'draft',operationId:winningOp,eventId:eid,request:req};if(!isAccountingAction(action)||!acceptedAccountingAction(draft,action,tid))throw Error('Actual draft acknowledgement rejected by API codec '+JSON.stringify(draft));}
  if(JSON.stringify(read(call(req,winningOp)))!==JSON.stringify(draft))throw Error('Draft replay changed');
  if(read(call({...req,reason:req.reason+' changed'},winningOp)).code!=='idempotency_conflict')throw Error('Changed draft replay accepted');
  draftResults.push(draft);
  if(eid===main){const incomplete=read(`select ${api.workspace}('${actor}','${tid}');`);if(incomplete?.status!=='blocked'||incomplete.code!=='draft_or_closure_required')throw Error('Joint final allowed before Consolation draft '+JSON.stringify(incomplete));}
 }
 console.log('PASS both private unpaid draft candidates, current 0281 sources, stale/role/replay and serialized competing writers');
 console.log('STAGE_JSON '+JSON.stringify({stage:'private_unpaid_drafts',drafts:draftResults}));
 const joint=read(`select ${api.workspace}('${actor}','${tid}');`);
 requireStatus(joint,'candidate_ready');if(joint.manifest?.events?.length!==2)throw Error('Incomplete joint manifest');
 const checkAccountingProjection=(finalValue,expectedFinal)=>{
  const summary=read(`select public.get_tournament_result_events_v1('${actor}','${tid}');`);
  if(!isTournamentResultEventSummary(summary)||summary.tournamentId!==tid)throw Error('Actual result-event summary rejected by API codec '+JSON.stringify(summary));
  const names=Object.fromEntries(summary.events.map(e=>[e.eventId,e.name]));
  const currentJoint=read(`select ${api.workspace}('${actor}','${tid}');`);
  for(const eid of [main,cons]){const event=read(`select public.get_multi_event_unpaid_event_workspace_v1('${actor}','${tid}','${eid}');`);const projected=projectAccountingWorkspace(event,currentJoint,finalValue,tid,eid,names);if(!isAccountingWorkspace(projected,tid,eid)||Boolean(projected.final)!==expectedFinal||projected.joint.ready===expectedFinal)throw Error('Actual SQL accounting workspace rejected by API codec '+JSON.stringify({eid,event,currentJoint,finalValue,projected}));}
 };
 if(publicMode){checkAccountingProjection(read(`select ${api.history}('${actor}','${tid}');`),false);console.log('PASS actual SQL pre-final workspaces and names through API codec for both events');}
 for(const [eid,i] of [[main,0],[cons,1]]){const x=joint.manifest.events.find(e=>e.eventId===eid);if(!x||x.draftId!==draftResults[i].draftId||x.closureId!==closureResults[i].closureId||x.preview.sourceDigest!==previews[i].sourceDigest)throw Error('Joint source mismatch '+JSON.stringify(x));}
 const finalReq={jointDigest:joint.jointDigest,reason:'TEST ONLY SYNTHETIC: joint unpaid final candidate',reviewed:true};
 const finalCall=(request,op,who=actor)=>`select ${api.finalize}('${who}','${tid}',${literal(request)},'${op}');`;
 if(read(finalCall({...finalReq,jointDigest:'0'.repeat(64)},id('d476',100))).code!=='source_changed')throw Error('Stale joint final accepted');
 if(read(finalCall(finalReq,id('d476',101),checker)).code!=='not_director')throw Error('Cross-checker final authority widened');
 if(read(finalCall(finalReq,id('d476',106),'a2760000-0000-4000-8000-000000000003')).code!=='not_director')throw Error('Co-director final authority widened');
 if(publicMode){
  const grant=read(`select to_jsonb(has_function_privilege('authenticated','public.finalize_multi_event_unpaid_v1(uuid,uuid,jsonb,uuid)','execute'));`);if(grant!==false)throw Error('Authenticated final write grant exposed');
  q(`begin;set local role authenticated;do $$begin begin perform public.finalize_multi_event_unpaid_v1('${actor}','${tid}',${literal(finalReq)},'${id('d476',107)}');raise exception 'authenticated_write_accepted';exception when insufficient_privilege then null;end;end$$;rollback;`);
  const other=read(`select ${api.readiness}('${actor}','${tid}','a2760000-0000-4000-8000-000000009999');`);if(other?.code!=='synthetic_fixture_required')throw Error('Wrong-event readiness accepted '+JSON.stringify(other));
 }
 // A source writer holding the joint key must not deadlock against finalization.
 const sourceGate=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
 let sourceOut='',sourceErr='';sourceGate.stdout.on('data',x=>sourceOut+=x);sourceGate.stderr.on('data',x=>sourceErr+=x);
 const sourceDone=new Promise((resolve,reject)=>{sourceGate.on('error',reject);sourceGate.on('close',code=>code===0?resolve():reject(Error(sourceErr)));});
 sourceGate.stdin.write(`begin;set application_name='fixture_source_first';select pg_advisory_xact_lock(hashtextextended('multi-event-joint-source:${tid}',0));select 'SOURCE_READY';\n`);
 let sourceUntil=Date.now()+10000;while(!sourceOut.includes('SOURCE_READY')){if(Date.now()>sourceUntil){sourceGate.kill();throw Error('Source barrier unavailable');}await new Promise(r=>setTimeout(r,50));}
 const postGate=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
 let postOut='',postErr='';postGate.stdout.on('data',x=>postOut+=x);postGate.stderr.on('data',x=>postErr+=x);
 const postDone=new Promise((resolve,reject)=>{postGate.on('error',reject);postGate.on('close',code=>code===0?resolve():reject(Error(postErr)));});
 postGate.stdin.write(`begin;select pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:${[main,cons].sort()[0]}',0));select 'POST_READY';\n`);
 sourceUntil=Date.now()+10000;while(!postOut.includes('POST_READY')){if(Date.now()>sourceUntil){postGate.kill();sourceGate.kill();throw Error('Post-event barrier unavailable');}await new Promise(r=>setTimeout(r,50));}
 const busy=startSession(`set statement_timeout='15s';${finalCall(finalReq,id('d476',104))}`,'fixture_final_source_busy');
 let observed=false;sourceUntil=Date.now()+5000;while(Date.now()<sourceUntil){if(q("select count(*) from pg_stat_activity where application_name='fixture_final_source_busy' and wait_event_type='Lock';")==='1'){observed=true;break;}await new Promise(r=>setTimeout(r,50));}
 sourceGate.stdin.write(`select pg_advisory_xact_lock(hashtextextended('qualification-finalization:${[main,cons].sort()[0]}',0));select 'SOURCE_QUALIFIED';\n`);
 let sourceWaiting=false;sourceUntil=Date.now()+5000;while(Date.now()<sourceUntil){if(q("select count(*) from pg_stat_activity where application_name='fixture_source_first' and wait_event_type='Lock';")==='1'){sourceWaiting=true;break;}await new Promise(r=>setTimeout(r,50));}
 postGate.stdin.end('commit;');await postDone;
 let busyResult;try{busyResult=JSON.parse((await busy.done).trim().split('\n').findLast(y=>y.startsWith('{')));sourceUntil=Date.now()+5000;while(!sourceOut.includes('SOURCE_QUALIFIED')&&Date.now()<sourceUntil)await new Promise(r=>setTimeout(r,50));}finally{sourceGate.stdin.end('rollback;');await sourceDone;}
 if(!observed||!sourceWaiting||!sourceOut.includes('SOURCE_QUALIFIED')||busyResult.code!=='joint_finalization_in_progress')throw Error('Source-first lock order failed '+JSON.stringify(busyResult));
 const roleGate=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
 let roleOut='',roleErr='';roleGate.stdout.on('data',x=>roleOut+=x);roleGate.stderr.on('data',x=>roleErr+=x);
 const roleDone=new Promise((resolve,reject)=>{roleGate.on('error',reject);roleGate.on('close',code=>code===0?resolve():reject(Error(roleErr)));});
 roleGate.stdin.write(`begin;delete from app.tournament_roles where tournament_id='${tid}' and profile_id='${checker}' and role='cross_checker';select 'ROLE_HELD';\n`);
 let roleUntil=Date.now()+10000;while(!roleOut.includes('ROLE_HELD')){if(Date.now()>roleUntil){roleGate.kill();throw Error('Role barrier unavailable');}await new Promise(r=>setTimeout(r,50));}
 let roleResult;try{roleResult=read(`set statement_timeout='5s';${finalCall(finalReq,id('d476',105))}`);}finally{roleGate.stdin.end('rollback;');await roleDone;}
 if(roleResult?.code!=='joint_finalization_in_progress')throw Error('Role-revocation-first final not blocked promptly '+JSON.stringify(roleResult));
 const finalGate=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
 let finalOut='',finalErr='';finalGate.stdout.on('data',x=>finalOut+=x);finalGate.stderr.on('data',x=>finalErr+=x);
 const finalGateDone=new Promise((resolve,reject)=>{finalGate.on('error',reject);finalGate.on('close',code=>code===0?resolve():reject(Error(finalErr)));});
 finalGate.stdin.write(`begin;select pg_advisory_xact_lock(hashtextextended('qualification-finalization:${[main,cons].sort()[0]}',0));select 'GATE_READY';\n`);
 let finalUntil=Date.now()+10000;while(!finalOut.includes('GATE_READY')){if(Date.now()>finalUntil){finalGate.kill();throw Error('Final barrier unavailable');}await new Promise(r=>setTimeout(r,50));}
 const finalA=startSession(finalCall(finalReq,id('d476',102)),'fixture_final_a'),finalB=startSession(finalCall(finalReq,id('d476',103)),'fixture_final_b');
 let finalWaiting=false;finalUntil=Date.now()+10000;
 try{while(Date.now()<finalUntil){if(q("select count(*) from pg_stat_activity where application_name in ('fixture_final_a','fixture_final_b') and wait_event_type='Lock';")==='2'){finalWaiting=true;break;}await new Promise(r=>setTimeout(r,50));}}
 finally{finalGate.stdin.end('commit;');}
 await finalGateDone;
 const finalOutcomes=(await Promise.all([finalA.done,finalB.done])).map(x=>JSON.parse(x.trim().split('\n').findLast(y=>y.startsWith('{'))));
 if(!finalWaiting||finalOutcomes.filter(x=>x.status==='synthetic_joint_unpaid_finalized').length!==1||finalOutcomes.filter(x=>x.code==='already_finalized').length!==1)throw Error('Joint final race '+JSON.stringify(finalOutcomes));
 const final=finalOutcomes.find(x=>x.status==='synthetic_joint_unpaid_finalized'),finalOp=finalOutcomes[0]===final?id('d476',102):id('d476',103);
 if(publicMode){const action={action:'finalize',operationId:finalOp,request:finalReq};if(!isAccountingAction(action)||!acceptedAccountingAction(final,action,tid))throw Error('Actual final acknowledgement rejected by API codec '+JSON.stringify(final));}
 if(JSON.stringify(read(finalCall(finalReq,finalOp)))!==JSON.stringify(final))throw Error('Joint final replay changed');
 if(read(finalCall({...finalReq,reason:finalReq.reason+' changed'},finalOp)).code!=='idempotency_conflict')throw Error('Changed final replay accepted');
 const persisted=read(`select jsonb_build_object('joint',(select count(*) from app.multi_event_joint_finals_v1 where tournament_id='${tid}'),'events',(select jsonb_agg(jsonb_build_object('eventId',event_id,'draftId',draft_id,'closureId',closure_id,'sourceDigest',source_digest,'closureDigest',closure_digest,'snapshot',financial_snapshot,'moneyMoved',money_moved,'humanReviewClaimed',human_review_claimed) order by event_id) from app.multi_event_unpaid_finals_v1 where tournament_id='${tid}'));`);
 if(persisted.joint!==1||persisted.events?.length!==2||persisted.events.some(x=>x.moneyMoved||x.humanReviewClaimed))throw Error('Joint final rows missing or misleading');
 for(const x of persisted.events){const source=joint.manifest.events.find(e=>e.eventId===x.eventId);if(JSON.stringify(x.snapshot)!==JSON.stringify(source)||x.draftId!==source.draftId||x.closureId!==source.closureId)throw Error('Persisted final snapshot mismatch');}
 q(`do $$begin begin update app.events set name=name||' changed' where id='${main}';raise exception 'source_mutation_accepted';exception when raise_exception then if sqlerrm<>'joint_financially_closed'then raise;end if;end;end$$;`);
 const finalHistory=read(`select ${api.history}('${actor}','${tid}');`);
 if(publicMode){checkAccountingProjection(finalHistory,true);console.log('PASS actual SQL final workspaces and all three acknowledgements through API codecs');}
 for(const eid of [main,cons]){const selector=read(`select public.get_simulated_finance_selector_workspace_v1('${actor}','${tid}','${eid}');`);if(selector?.status!=='available'||selector.financialClosed!==true||selector.moneyMoved!==false)throw Error('Post-final selector '+JSON.stringify(selector));}
 q(`delete from app.tournament_roles where tournament_id='${tid}' and profile_id='${checker}' and role='cross_checker';`);
 const secondHistory=read(`select ${api.history}('a2760000-0000-4000-8000-000000000003','${tid}');`);
 if(JSON.stringify(finalHistory)!==JSON.stringify(secondHistory)||finalHistory?.status!=='synthetic_joint_unpaid_finalized')throw Error('Role revocation changed or hid immutable final history');
 const sourceSetRace=await verifySourceSetRace({q,read,startSession,name,db,actor,base,setupEvents,literal,schedule,id,publicMode});
 console.log('PASS private atomic joint unpaid final, two event snapshots, stale/role/replay, source freeze and competing writers');
 console.log('FIXTURE_RESULT_JSON '+JSON.stringify({kind:'TEST ONLY SYNTHETIC: local structured lifecycle',mode:publicMode?'service-mediated public wrappers':'private owner candidates',events:[{eventId:main,verifiedGames:120,qualifiers:5,preview:previews[0],closure:closureResults[0],draft:draftResults[0]},{eventId:cons,verifiedGames:56,qualifiers:4,preview:previews[1],closure:closureResults[1],draft:draftResults[1]}],jointFinal:final,persisted,sourceSetRace,checks:['card SHA-256','current qualification and source-bound playoffs','Q and Side membership and amount conservation','scoped open dispute','unproven correction rejected','outsider denied','stale sources rejected','closure draft and final replay','competing closure draft and final races','joint source freeze','no legacy receipts','no physical, human or money claim'],unverified:['1-of-2 pending correction state cannot be created through supported synthetic path','independent final review',...(!publicMode?['public wrappers']:[])],moneyMoved:false,physicalPlayClaimed:false,humanReviewClaimed:false}));
}finally{docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',db]);console.log('CLEANUP disposable full-schema database removed');}







