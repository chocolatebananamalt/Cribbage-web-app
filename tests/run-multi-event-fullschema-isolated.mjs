// Isolated synthetic evidence SQL runner. No hosted service access.

import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync,spawn}from'node:child_process';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-multievent-fullschema',db='fixture_multievent_fullschema';
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
 for(let n=237;n<=274;n++){
  const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);
  const bytes=fs.readFileSync('database/migrations/'+file);console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
  sql('set role postgres;'+bytes.toString('utf8'),db);
 }
 const q=query=>sql("set role postgres;set request.jwt.claim.sub='a2680000-0000-4000-8000-000000000001';set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';"+query,db).trim();
 const read=query=>{const v=q(query).split('\n').filter(Boolean).at(-1);return v===undefined?null:v==='t'?true:v==='f'?false:JSON.parse(v);};
 const startSession=(query,tag)=>{const child=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(Error(err)));});child.stdin.end(`set role postgres;set request.jwt.claim.sub='a2680000-0000-4000-8000-000000000001';set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';set application_name='${tag}';`+query);return{done,out:()=>out};};
 q(fs.readFileSync('tests/multi-event-allocation-arithmetic.sql','utf8'));
 console.log('PASS full schema migrations 0237-0274 and allocation arithmetic');
 q(fs.readFileSync('tests/multi-event-finance-fullschema.sql','utf8'));
 console.log('PASS full schema local multi-event finance source fixture');
 if(fs.existsSync('database/migrations/0275_side_pool_setup_payout_intent_v1.sql')) {
  const data=fs.readFileSync('database/migrations/0275_side_pool_setup_payout_intent_v1.sql');console.log('APPLY LOCAL 0275',crypto.createHash('sha256').update(data).digest('hex'));q(data.toString('utf8'));
 }
 if(fs.existsSync('tests/event-prize-declarations-v2.sql')&&fs.existsSync('database/migrations/0276_event_prize_declarations_v2.sql')) {
  q(fs.readFileSync('database/migrations/0276_event_prize_declarations_v2.sql','utf8'));
  q(fs.readFileSync('tests/event-prize-declarations-v2.sql','utf8'));
  console.log('PASS full schema event prize declarations v2');
 } else console.log('PENDING 0276 and/or declaration fixture not present');
 let pooledFixture;
 if(fs.existsSync('database/migrations/0277_multi_event_synthetic_pool_evidence_v1.sql')) {
  const data=fs.readFileSync('database/migrations/0277_multi_event_synthetic_pool_evidence_v1.sql');console.log('APPLY LOCAL 0277',crypto.createHash('sha256').update(data).digest('hex'));q(data.toString('utf8'));
  let fixture=fs.readFileSync('tests/multi-event-finance-fullschema.sql','utf8').split('do $$declare actor')[0];
  const poolInsert=`insert into app.tournament_setup_q_pool_versions(id,tournament_id,setup_revision_id,setup_event_version_id,slot,pool_type_code,entry_fee_cents,note) values ('b1740000-0000-4000-8000-000000000001','b2740000-0000-4000-8000-000000000001','e2740000-0000-4000-8000-000000000001','f2740000-0000-4000-8000-000000000001',1,'Graduated (1-in-4)',1000,''),('b1740000-0000-4000-8000-000000000002','b2740000-0000-4000-8000-000000000001','e2740000-0000-4000-8000-000000000001','f2740000-0000-4000-8000-000000000001',2,'Equal (Pays All Equally)',2000,'');\n`;
  const sideSetup=`select set_config('app.side_pool_setup_type_map_v1','{"d2740000-0000-4000-8000-000000000011:1":"graduated-1-in-6"}',true);insert into app.tournament_setup_side_pool_versions(id,tournament_id,setup_revision_id,setup_event_version_id,slot,pool_type_code,entry_fee_cents,note,actor_profile_id,operation_receipt_id)values('b1740000-0000-4000-8000-000000000003','b2740000-0000-4000-8000-000000000001','e2740000-0000-4000-8000-000000000001','f2740000-0000-4000-8000-000000000001',1,'TEST ONLY Side',1000,'','a2740000-0000-4000-8000-000000000001','c2740000-0000-4000-8000-000000000001');\n`;
  const sideOperational=`insert into app.event_side_pools(id,tournament_id,event_id)values('b1740000-0000-4000-8000-000000000004','b2740000-0000-4000-8000-000000000001','a2740000-0000-4000-8000-000000000011');insert into app.event_side_pool_definition_versions(id,pool_id,tournament_id,event_id,version,category_code,display_name,entry_fee_minor,active,actor_profile_id,operation_receipt_id)values('b1740000-0000-4000-8000-000000000005','b1740000-0000-4000-8000-000000000004','b2740000-0000-4000-8000-000000000001','a2740000-0000-4000-8000-000000000011',1,'10','TEST ONLY Side',1000,true,'a2740000-0000-4000-8000-000000000001','c2740000-0000-4000-8000-000000000001');insert into app.tournament_setup_side_pool_materializations(tournament_id,setup_side_pool_version_id,event_id,pool_id,operation_receipt_id)values('b2740000-0000-4000-8000-000000000001','b1740000-0000-4000-8000-000000000003','a2740000-0000-4000-8000-000000000011','b1740000-0000-4000-8000-000000000004','c2740000-0000-4000-8000-000000000001');\n`;
  if(!fixture.includes('insert into app.ruleset_versions'))throw Error('full-schema fixture anchor changed');
  fixture=fixture.replace('insert into app.ruleset_versions',poolInsert+sideSetup+'insert into app.ruleset_versions');
  fixture+=sideOperational;
  pooledFixture=fixture;
  q(fixture+fs.readFileSync('tests/multi-event-pool-fullschema-tail.sql','utf8'));
  console.log('PASS 0277 full-schema Q and typed Side disclosures/elections/single-source synthetic receipt');
 }
 if(fs.existsSync('database/migrations/0278_consolation_four_qualifier_source_v1.sql')) {
  const data=fs.readFileSync('database/migrations/0278_consolation_four_qualifier_source_v1.sql');console.log('APPLY LOCAL 0278',crypto.createHash('sha256').update(data).digest('hex'));q(data.toString('utf8'));
 }
 if(fs.existsSync('database/migrations/0279_multi_event_expense_classification_v1.sql')&&fs.existsSync('tests/multi-event-expense-classification.sql')) {
  const data=fs.readFileSync('database/migrations/0279_multi_event_expense_classification_v1.sql');console.log('APPLY LOCAL 0279',crypto.createHash('sha256').update(data).digest('hex'));q(data.toString('utf8'));
  q(fs.readFileSync('tests/multi-event-expense-classification.sql','utf8'));console.log('PASS 0279 expense classification kernel only; review RPC not yet exercised');
  if(pooledFixture&&fs.existsSync('tests/multi-event-expense-review-fullschema.sql')) {
   const tail=fs.readFileSync('tests/multi-event-pool-fullschema-tail.sql','utf8').replace(/rollback;\s*$/,'');
   q(pooledFixture+tail+fs.readFileSync('tests/multi-event-expense-review-fullschema.sql','utf8'));
   console.log('PASS 0279 synthetic classification review RPC with seeded immutable assessment; no settlement claimed');
  }
 }
 if(fs.existsSync('database/migrations/0280_event_prize_activation_binding_v2.sql')) {
  const fingerprintSql="select jsonb_build_object('functionOid',p.oid,'owner',p.proowner,'acl',p.proacl,'triggerOid',t.oid,'triggerFunction',t.tgfoid,'enabled',t.tgenabled)::text from pg_proc p join pg_trigger t on t.tgfoid=p.oid where p.oid='app.bind_prize_schedule_on_activation_v1()'::regprocedure and not t.tgisinternal";
  const before=q(fingerprintSql);
  const data=fs.readFileSync('database/migrations/0280_event_prize_activation_binding_v2.sql');console.log('APPLY LOCAL 0280',crypto.createHash('sha256').update(data).digest('hex'));q(data.toString('utf8'));
  const after=q(fingerprintSql);if(!before||before!==after)throw Error('0280 changed historical trigger/function OID, owner, ACL, or enabled state');console.log('PASS 0280 historical trigger/function OID, owner, ACL and enabled state preserved',after);
  q(fs.readFileSync('tests/event-prize-declarations-v2.sql','utf8'));console.log('PASS 0280 V1 and V2 activation fixtures');
 }
 if(fs.existsSync('database/migrations/0281_multi_event_award_preview_v1.sql')) {
  const data=fs.readFileSync('database/migrations/0281_multi_event_award_preview_v1.sql');console.log('APPLY LOCAL 0281',crypto.createHash('sha256').update(data).digest('hex'));q(data.toString('utf8'));
  q(fs.readFileSync('tests/multi-event-award-preview.sql','utf8'));console.log('PASS 0281 pure synthetic pool award kernel; full reader not yet exercised');
  if(pooledFixture&&fs.existsSync('tests/multi-event-award-preview-blocked.sql')) {
   const tail=fs.readFileSync('tests/multi-event-pool-fullschema-tail.sql','utf8').replace(/rollback;\s*$/,'');
   const review=fs.readFileSync('tests/multi-event-expense-review-fullschema.sql','utf8').replace(/rollback;\s*$/,'');
   q(pooledFixture+tail+review+fs.readFileSync('tests/multi-event-award-preview-blocked.sql','utf8'));
   console.log('PASS 0281 source-backed stale/authorization rejection; successful preview remains untested');
  }
 }
 if(fs.existsSync('database/migrations/0282_multi_event_unpaid_draft_candidate_v1.sql')) {
  const data=fs.readFileSync('database/migrations/0282_multi_event_unpaid_draft_candidate_v1.sql');console.log('APPLY LOCAL 0282',crypto.createHash('sha256').update(data).digest('hex'));q(data.toString('utf8'));
  q(fs.readFileSync('tests/multi-event-unpaid-draft-candidate.sql','utf8'));console.log('PASS 0282 candidate remains unavailable, private, and RLS-forced');
 }
 if(pooledFixture&&fs.existsSync('database/migrations/0283_simulated_finance_selector_workspace_v1.sql')) {
  const data=fs.readFileSync('database/migrations/0283_simulated_finance_selector_workspace_v1.sql');console.log('APPLY LOCAL 0283',crypto.createHash('sha256').update(data).digest('hex'));q(data.toString('utf8'));
  q(pooledFixture+fs.readFileSync('tests/simulated-finance-selector-no-final-capability-0283.sql','utf8'));
  console.log('PASS 0283 missing closure capability fails closed');
 }
 if(fs.existsSync('database/migrations/0284_synthetic_event_crosscheck_readiness_candidate_v1.sql')) {
  const data=fs.readFileSync('database/migrations/0284_synthetic_event_crosscheck_readiness_candidate_v1.sql');console.log('APPLY LOCAL 0284',crypto.createHash('sha256').update(data).digest('hex'));q(data.toString('utf8'));
  q(fs.readFileSync('tests/synthetic-event-crosscheck-readiness-candidate.sql','utf8'));console.log('PASS 0284 private candidate ACL; positive readiness not yet exercised');
 }
 if(fs.existsSync('database/migrations/0285_synthetic_crosscheck_closure_candidate_v1.sql')) {
  const data=fs.readFileSync('database/migrations/0285_synthetic_crosscheck_closure_candidate_v1.sql');console.log('APPLY LOCAL 0285',crypto.createHash('sha256').update(data).digest('hex'));q(data.toString('utf8'));
  q(fs.readFileSync('tests/synthetic-crosscheck-closure-candidate.sql','utf8'));console.log('PASS 0285 closure remains unavailable, private and RLS-forced');
  if(pooledFixture) {q(pooledFixture+fs.readFileSync('tests/synthetic-crosscheck-closure-candidate.sql','utf8'));console.log('PASS 0285 candidate source-lock and invalid-request path');}
 }
 if(pooledFixture&&fs.existsSync('database/migrations/0286_synthetic_event_paid_enrollment_v1.sql')) {
  const fingerprintSql="select jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl)::text from pg_proc p where p.oid='app.event_qr_player_is_paid_and_enrolled(uuid,uuid,uuid)'::regprocedure";
  const before=q(fingerprintSql);const data=fs.readFileSync('database/migrations/0286_synthetic_event_paid_enrollment_v1.sql');console.log('APPLY LOCAL 0286',crypto.createHash('sha256').update(data).digest('hex'));q(data.toString('utf8'));
  const after=q(fingerprintSql);if(!before||before!==after)throw Error('0286 changed paid-check OID, owner or ACL');console.log('PASS 0286 paid-check OID, owner and ACL preserved',after);
  const base=fs.readFileSync('tests/multi-event-finance-fullschema.sql','utf8');
  q(base.split('do $$declare actor')[0]+fs.readFileSync('tests/synthetic-paid-enrollment-legacy-0286.sql','utf8'));
  q(base.replace(/rollback;\s*$/,'')+fs.readFileSync('tests/synthetic-paid-enrollment-base-0286.sql','utf8'));
  const tail=fs.readFileSync('tests/multi-event-pool-fullschema-tail.sql','utf8').replace(/rollback;\s*$/,'');
  q(pooledFixture+tail+fs.readFileSync('tests/synthetic-paid-enrollment-pool-0286.sql','utf8'));
  console.log('PASS 0286 legacy comp parity, current shared base, stale sibling, pooled paid/unpaid isolation');
 }
 if(fs.existsSync('database/migrations/0287_multi_event_unpaid_final_candidate_v1.sql')) {
  const data=fs.readFileSync('database/migrations/0287_multi_event_unpaid_final_candidate_v1.sql');console.log('APPLY LOCAL 0287',crypto.createHash('sha256').update(data).digest('hex'));q(data.toString('utf8'));
  if(pooledFixture&&fs.existsSync('database/migrations/0283_simulated_finance_selector_workspace_v1.sql')) {
   q(pooledFixture+fs.readFileSync('tests/simulated-finance-selector-0283.sql','utf8'));
   q(pooledFixture+fs.readFileSync('tests/multi-event-pool-fullschema-tail.sql','utf8').replace(/rollback;\s*$/,'')+fs.readFileSync('tests/simulated-finance-selector-collected-0283.sql','utf8'));
   q(pooledFixture+fs.readFileSync('tests/multi-event-pool-fullschema-tail.sql','utf8').replace(/rollback;\s*$/,'')+fs.readFileSync('tests/multi-event-expense-review-fullschema.sql','utf8').replace(/rollback;\s*$/,'')+fs.readFileSync('tests/simulated-finance-selector-started-0283.sql','utf8'));
   console.log('PASS 0283 enrolled event-scoped selector and current receipt/start flags');
  }
 }
 if(fs.existsSync('database/migrations/0289_pinned_event_prize_activation_v2.sql')) {
  const historic=fs.readFileSync('tests/event-prize-declarations-v2.sql','utf8').replaceAll('276','290').replaceAll('declaration-director@test.invalid','historic-director@test.invalid').replaceAll('declaration-outsider@test.invalid','historic-outsider@test.invalid').replace('-- Add a newer revision',"insert into app.tournament_setup_official_versions(id,tournament_id,setup_revision_id,profile_id,role)values('e2900000-0000-4000-8000-000000000099','b2900000-0000-4000-8000-000000000001','e2900000-0000-4000-8000-000000000001','a2900000-0000-4000-8000-000000000001','director');\n-- Add a newer revision").replace(/rollback;\s*$/,'commit;');
  q(historic);
  const historicRejected=read("select public.activate_tournament_setup_v2('a2900000-0000-4000-8000-000000000001','b2900000-0000-4000-8000-000000000001','e2900000-0000-4000-8000-000000000002',2,'d2900000-0000-4000-8000-000000000098')");
  if(historicRejected?.status!=='rejected'||read("select count(*)::integer from app.operation_receipts where actor_profile_id='a2900000-0000-4000-8000-000000000001' and client_operation_id='d2900000-0000-4000-8000-000000000098' and outcome='rejected'")!==1)throw Error('historical rejected receipt missing');
  const fp="select jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl)::text from pg_proc p where p.oid='public.activate_tournament_setup_v2(uuid,uuid,uuid,integer,uuid)'::regprocedure";
  const before=q(fp);const data=fs.readFileSync('database/migrations/0289_pinned_event_prize_activation_v2.sql');console.log('APPLY LOCAL 0289',crypto.createHash('sha256').update(data).digest('hex'));q(data.toString('utf8'));const after=q(fp);if(!before||before!==after)throw Error('0289 activation OID/owner/ACL changed');console.log('PASS 0289 activation OID/owner/ACL preserved',after);
  q(`do $$declare f text;begin foreach f in array array['public.activate_tournament_setup_v2_legacy(uuid,uuid,uuid,integer,uuid)','public.activate_tournament_setup_v2_before_state_territory(uuid,uuid,uuid,integer,uuid)','public.activate_tournament_setup_v2_before_optional_contact(uuid,uuid,uuid,integer,uuid)','public.activate_tournament_setup_before_pins_0289(uuid,uuid,uuid,integer,uuid)'] loop if has_function_privilege('service_role',f,'execute') or has_function_privilege('authenticated',f,'execute') or has_function_privilege('anon',f,'execute') then raise exception 'unguarded activation helper executable: %',f;end if;end loop;end$$;`);
  console.log('PASS 0289 old activation helpers deny service, authenticated and anonymous execution');
  const fixture=fs.readFileSync('tests/event-prize-declarations-v2.sql','utf8').split('-- Optional activation-binding extension')[0];
  q(fixture+fs.readFileSync('tests/pinned-event-prize-activation-0289.sql','utf8'));console.log('PASS 0289 pinned formula, stale/missing, unpinned and exact replay guards');
  q(`begin;do $$declare r jsonb;original jsonb;begin select response_payload into original from app.operation_receipts where actor_profile_id='a2900000-0000-4000-8000-000000000001' and client_operation_id='d2900000-0000-4000-8000-000000000032';r:=public.activate_tournament_setup_v2('a2900000-0000-4000-8000-000000000001','b2900000-0000-4000-8000-000000000001','e2900000-0000-4000-8000-000000000002',2,'d2900000-0000-4000-8000-000000000032');if r is distinct from original then raise exception 'historic activation replay changed %',r;end if;update app.tournaments set registration_status='closed' where id='b2900000-0000-4000-8000-000000000001';delete from app.tournament_roles where tournament_id='b2900000-0000-4000-8000-000000000001' and profile_id='a2900000-0000-4000-8000-000000000001' and role='director';r:=public.finalize_tournament_setup_and_open_registration_v1('a2900000-0000-4000-8000-000000000001','b2900000-0000-4000-8000-000000000001','e2900000-0000-4000-8000-000000000002',2,true,'d2900000-0000-4000-8000-000000000032');if r->>'status'='tournament_setup_activated' or (select registration_status from app.tournaments where id='b2900000-0000-4000-8000-000000000001')<>'closed' then raise exception 'revoked director reopened registration %',r;end if;end$$;rollback;`);
  console.log('PASS 0289 historical exact replay and revoked-role replay rejection');
  const replayRejected=read("select public.activate_tournament_setup_v2('a2900000-0000-4000-8000-000000000001','b2900000-0000-4000-8000-000000000001','e2900000-0000-4000-8000-000000000002',2,'d2900000-0000-4000-8000-000000000098')");
  if(JSON.stringify(replayRejected)!==JSON.stringify(historicRejected)||read("select count(*)::integer from app.operation_receipts where actor_profile_id='a2900000-0000-4000-8000-000000000001' and client_operation_id='d2900000-0000-4000-8000-000000000098'")!==1||read("select count(*)::integer from app.audit_events where operation_receipt_id=(select id from app.operation_receipts where actor_profile_id='a2900000-0000-4000-8000-000000000001' and client_operation_id='d2900000-0000-4000-8000-000000000098')")!==1)throw Error('historical rejected replay changed or duplicated evidence');
  console.log('PASS 0289 historical rejected receipt exact replay');
  q(fs.readFileSync('tests/pinned-single-event-backstop-0289.sql','utf8'));console.log('PASS 0289 old single-event activation cannot bypass V2 pins');
  const declarationTest=fs.readFileSync('tests/event-prize-declarations-v2.sql','utf8');const legacyStart=declarationTest.lastIndexOf("do $$declare actor uuid:='a2760000-0000-4000-8000-000000000001';tid uuid:='b2760000-0000-4000-8000-000000000002'");
  if(legacyStart<0)throw Error('legacy activation fixture anchor changed');
  const postPatchLegacy=declarationTest.slice(legacyStart).replace(/rollback;\s*$/,'').replaceAll('276','291').replaceAll('a2910000-0000-4000-8000-000000000001','a2900000-0000-4000-8000-000000000001').replaceAll('e2910000-0000-4000-8000-000000000001','e2900000-0000-4000-8000-000000000001');
  q('begin;'+postPatchLegacy+'rollback;');console.log('PASS 0289 new V1-only declaration and activation retain legacy binding');
  const raceFixture=fixture.replaceAll('276','292').replaceAll('declaration-director@test.invalid','race-director@test.invalid').replaceAll('declaration-outsider@test.invalid','race-outsider@test.invalid').replace('-- Add a newer revision',"insert into app.tournament_setup_official_versions(id,tournament_id,setup_revision_id,profile_id,role)values('e2920000-0000-4000-8000-000000000099','b2920000-0000-4000-8000-000000000001','e2920000-0000-4000-8000-000000000001','a2920000-0000-4000-8000-000000000001','director');\n-- Add a newer revision");
  q(raceFixture+`insert into app.tournament_setup_official_versions(id,tournament_id,setup_revision_id,profile_id,role)values('e2920000-0000-4000-8000-000000000010','b2920000-0000-4000-8000-000000000001','e2920000-0000-4000-8000-000000000002','a2920000-0000-4000-8000-000000000001','director');do $$declare req jsonb;outcome jsonb;begin select jsonb_build_object('expectedVersion',version,'expectedSettingsFingerprint',app.event_prize_settings_digest_v2(app.event_prize_settings_v2(tournament_id,client_row_id)),'schedule',schedule_payload,'reason','TEST ONLY race preparation','reviewed',true)into req from app.setup_prize_schedule_versions_v2 where tournament_id='b2920000-0000-4000-8000-000000000001' and client_row_id='d2920000-0000-4000-8000-000000000012' order by version desc limit 1;outcome:=public.save_event_prize_declaration_v2('a2920000-0000-4000-8000-000000000001','b2920000-0000-4000-8000-000000000001','d2920000-0000-4000-8000-000000000012',req,'d2890000-0000-4000-8000-000000000020');if outcome->>'status'<>'event_prize_declaration_saved_v2' then raise exception 'race prep %',outcome;end if;end$$;commit;`);
  const oldPins=read("select app.current_event_prize_activation_pins_v1('b2920000-0000-4000-8000-000000000001','e2920000-0000-4000-8000-000000000002',2)");if(!Array.isArray(oldPins)||oldPins.length!==2)throw Error('race pins missing');
  const change=startSession(`begin;do $$declare req jsonb;outcome jsonb;begin select jsonb_build_object('expectedVersion',version,'expectedSettingsFingerprint',settings_fingerprint,'schedule',jsonb_set(schedule_payload,'{cohorts,0,weight}','6'),'reason','TEST ONLY concurrent revised formula','reviewed',true)into req from app.setup_prize_schedule_versions_v2 where tournament_id='b2920000-0000-4000-8000-000000000001' and client_row_id='d2920000-0000-4000-8000-000000000011' order by version desc limit 1;outcome:=public.save_event_prize_declaration_v2('a2920000-0000-4000-8000-000000000001','b2920000-0000-4000-8000-000000000001','d2920000-0000-4000-8000-000000000011',req,'d2890000-0000-4000-8000-000000000021');if outcome->>'status'<>'event_prize_declaration_saved_v2' then raise exception 'race formula %',outcome;end if;end$$;select pg_sleep(1.5);commit;`,'pin_race_writer');
  await new Promise(resolve=>setTimeout(resolve,200));
  const activate=startSession(`begin;select public.finalize_tournament_setup_pinned_v2('a2920000-0000-4000-8000-000000000001','b2920000-0000-4000-8000-000000000001','e2920000-0000-4000-8000-000000000002',2,true,'${JSON.stringify(oldPins)}'::jsonb,'d2890000-0000-4000-8000-000000000022');commit;`,'pin_race_activation');
  let observed=false;for(let n=0;n<20;n++){if(read("select exists(select 1 from pg_stat_activity where application_name='pin_race_activation' and wait_event_type='Lock')")){observed=true;break;}await new Promise(resolve=>setTimeout(resolve,50));}
  const [,activationOutput]=await Promise.all([change.done,activate.done]);const raceResult=JSON.parse(activationOutput.split('\n').find(x=>x.startsWith('{'))||'null');
  if(!observed||raceResult?.code!=='declaration_pins_changed'||read("select count(*)::integer from app.tournament_setup_activations where tournament_id='b2920000-0000-4000-8000-000000000001'")!==0)throw Error('0289 concurrent formula change did not fail closed: '+JSON.stringify(raceResult));
  console.log('PASS 0289 observed declaration/activation lock race rejects stale formula without activation');
 }
}finally{docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',db]);console.log('CLEANUP disposable full-schema database removed');}
