import fs from 'node:fs';import assert from 'node:assert/strict';import{spawnSync}from'node:child_process';import{randomUUID}from'node:crypto';
import{qSetupPrizeWorkspace}from'./fixtures/q-setup-prize-workspace.mjs';import{newEventPlayoffParametersDraftV1}from'../src/lib/playoffs/event-playoff-parameters-v1.ts';
const dir='test-results/native-mixed-pilot-scope6-20261107',state=JSON.parse(fs.readFileSync(dir+'/state.json','utf8')),actor='a1310000-0000-4000-8000-000000000001',tid='b1310000-0000-4000-8000-000000000001';
const uuid=()=>randomUUID(),quote=v=>"'"+String(v).replaceAll("'","''")+"'",json=v=>quote(JSON.stringify(v))+'::jsonb';
function sql(text){fs.appendFileSync(dir+'/acceptance-trace.sql',text+'\n');const r=spawnSync('docker',['--context','desktop-linux','exec','-i',state.containerId,'psql','-h','/tmp','-U','supabase_admin','-d',state.db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:text,encoding:'utf8',windowsHide:true,maxBuffer:16e6});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();}
const meta=JSON.parse(spawnSync('docker',['--context','desktop-linux','inspect',state.containerId],{encoding:'utf8',windowsHide:true}).stdout)[0];assert.equal(meta.Name,'/'+state.name);assert.equal(meta.HostConfig.NetworkMode,'none');assert.equal(meta.Mounts.length,0);assert.equal(meta.Config.Labels['codex.fixture'],state.name);
assert.equal(sql('select count(*)from app.tournaments'),'0');
let seed=fs.readFileSync('tests/q-pool-membership-seed.sql','utf8');seed=seed.slice(0,seed.indexOf('insert into app.ruleset_versions')).replace("'Synthetic Qualification','open','open'","'TEST ONLY Native Mixed 18','draft','closed'");sql('begin;'+seed+'commit;');
 const parse=statement=>JSON.parse(sql(statement));
 const owner=statement=>parse(`set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='authenticated';${statement}`);
 const service=statement=>parse(`set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='service_role';set request.jwt.claims='{"role":"service_role","sub":"${actor}"}';${statement}`);
 const base=owner(`select app.get_custom_q_setup_base_v2('${tid}');`).base;
 const{revisionId,version,createdAt,...payload}=structuredClone(qSetupPrizeWorkspace(actor).current);void revisionId;void version;void createdAt;
 payload.tournamentName='TEST ONLY Native Mixed 18';const event=payload.events[0];delete event.sourceStatus;event.clientRowId='e1310000-0000-4000-8000-000000000003';event.displayName='Main';event.gameCount=12;event.entryFeeCents=3000;
 event.qPools=[];event.sidePools=[];
 const setupOperation=uuid('0c71',1),setupEnvelope={kind:'setup-custom-payouts-v2',base,request:{expectedVersion:base.setupVersion,payload,idempotencyKey:setupOperation},choices:[{mainClientRowId:event.clientRowId,consolationClientRowIds:[]}],customPayouts:[]};
 const settingsEnvelope={kind:'event-settings-setup-v3',setup:setupEnvelope,eventSettings:[{eventClientRowId:event.clientRowId,mode:'configured',draft:newEventPlayoffParametersDraftV1('main')}]};
 const saved=owner(`select app.save_event_settings_draft_v3('${tid}',${json(settingsEnvelope)});`);
 assert.equal(saved.status,'event_settings_draft_saved',JSON.stringify(saved));assert.equal(saved.activationAllowed,false);assert.equal(saved.moneyMoved,false);
 assert.equal(saved.linked.result.revisionId,saved.linked.links.setupRevisionId);assert.equal(saved.linked.links.complete,true);
 const ids=parse(`select jsonb_build_object('revisionId',r.id,'setupVersion',r.version,'eventVersionId',e.id,'q1Id',(select id from app.tournament_setup_q_pool_versions where setup_revision_id=r.id and slot=1),'q2Id',(select id from app.tournament_setup_q_pool_versions where setup_revision_id=r.id and slot=2),'sideSetupId',(select id from app.tournament_setup_side_pool_versions where setup_revision_id=r.id and slot=1))from app.tournament_setup_revisions r join app.tournament_setup_event_versions e on e.setup_revision_id=r.id and e.client_row_id='${event.clientRowId}'where r.id='${saved.linked.result.revisionId}';`);
 for(const key of['revisionId','eventVersionId'])assert.match(ids[key],/^[a-f0-9-]{36}$/);assert.equal(ids.setupVersion,base.setupVersion+1);

 const activationSource=owner(`select app.get_event_settings_activation_source_v4('${tid}');`);assert.equal(activationSource.status,'source_available');assert.equal(activationSource.configuredRows.length,1);
 const configured=activationSource.configuredRows[0];assert.equal(configured.eventClientRowId,event.clientRowId);assert.equal(configured.setupEventVersionId,ids.eventVersionId);
 const contextRequest={kind:'event-rule-context-v1',operationId:uuid('0c71',2),expectedReviewId:null,setupRevisionId:activationSource.setupRevisionId,settingsSnapshotId:activationSource.settingsSnapshotId,eventClientRowId:event.clientRowId,context:{sanctioned:false,eventKind:'main',durationDays:1,originalEntrants:null},reason:'TEST ONLY unsanctioned native configured context',approvalReference:'LOCAL SYNTHETIC TEST ONLY',confirmed:true};
 const contextSaved=owner(`select app.save_event_rule_context_v1('${tid}',${json(contextRequest)});`);assert.equal(contextSaved.status,'context_recorded',JSON.stringify(contextSaved));
 const activationEnvelope={kind:'event-settings-activation-intent-v1',request:{setupRevisionId:activationSource.setupRevisionId,expectedVersion:activationSource.setupVersion,confirmed:true,idempotencyKey:uuid('0c71',3)},associationHash:activationSource.associationHash,settingsSnapshotId:activationSource.settingsSnapshotId,settingsDigest:activationSource.settingsDigest,settingsPins:[{eventClientRowId:event.clientRowId,reviewId:contextSaved.reviewId,draftDigest:contextSaved.source.draftDigest}],confirmedContext:true};
 const prepared=owner(`select app.prepare_event_settings_activation_v1('${tid}',${json(activationEnvelope)});`);assert.equal(prepared.status,'activation_intent_prepared',JSON.stringify(prepared));
 const defaultDenied=service(`select app.finalize_event_settings_operational_activation_v1('${actor}','${tid}',${json(activationEnvelope)});`);assert.equal(defaultDenied.code,'activation_runtime_acceptance_required');assert.equal(defaultDenied.operationAttempted,false);
 const originalGate=owner(`select to_jsonb(pg_get_functiondef('app.event_settings_operational_activation_enabled_v1()'::regprocedure));`);assert.match(originalGate,/select false/);
 let activation;
 try{
  sql(`create or replace function app.event_settings_operational_activation_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_event_settings_operational_acceptance',true)='approved-local-only',false)$$;alter function app.event_settings_operational_activation_enabled_v1()owner to postgres;revoke all on function app.event_settings_operational_activation_enabled_v1()from public,anon,authenticated,service_role;`);
  activation=service(`set app.fixture_event_settings_operational_acceptance='approved-local-only';select app.finalize_event_settings_operational_activation_v1('${actor}','${tid}',${json(activationEnvelope)});`);assert.equal(activation.status,'event_settings_operationally_activated',JSON.stringify(activation));assert.equal(activation.activationCount,1);assert.equal(activation.bindingCount,1);
  assert.deepEqual(service(`set app.fixture_event_settings_operational_acceptance='approved-local-only';select app.finalize_event_settings_operational_activation_v1('${actor}','${tid}',${json(activationEnvelope)});`),activation);
 }finally{
  sql(originalGate);assert.equal(owner(`select to_jsonb(app.event_settings_operational_activation_enabled_v1());`),false);assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.event_settings_operational_activation_enabled_v1()'::regprocedure));`),originalGate);
 }
 const binding=owner(`select jsonb_build_object('bindingId',b.id,'eventId',b.event_id,'activationId',b.activation_id,'setupEventVersionId',b.setup_event_version_id,'rulesetVersionId',a.ruleset_version_id)from app.event_settings_operational_bindings_v1 b join app.tournament_setup_activations a on a.id=b.activation_id where b.tournament_id='${tid}'and b.setup_event_version_id='${ids.eventVersionId}';`);
 assert.equal(binding.setupEventVersionId,ids.eventVersionId);assert.notEqual(binding.eventId,ids.eventVersionId);assert.equal(parse(`select to_jsonb(app.event_settings_finance_guard_available_v1());`),true);

fs.writeFileSync(dir+'/activation-result.json',JSON.stringify({saved,ids,contextSaved,prepared,activation,binding},null,2));console.log('NATIVE ACTIVATION AND EXACT RETRY PASSED');
