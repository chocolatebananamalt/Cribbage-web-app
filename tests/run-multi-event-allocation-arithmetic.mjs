// Exact task-owned, network-disabled PostgreSQL fixture. Never connects to hosted data.
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const name='cribbage-multievent-allocation-arithmetic';
const image='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
function docker(args, input, allowed=false) {
 const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:'utf8',maxBuffer:16*1024*1024});
 if (r.status!==0&&!allowed) throw Error(r.stderr||r.stdout||'docker failed');
 return r;
}
assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]).stdout.trim(),'','existing task fixture must be inspected');
assert.equal(JSON.parse(docker(['image','inspect',image]).stdout)[0].Id,image);
let id;
try {
 const command="initdb -D /tmp/arithmetic-pg -U supabase_admin --auth=trust --no-locale --encoding=UTF8 >/tmp/arithmetic-init.log 2>&1 && exec postgres -D /tmp/arithmetic-pg -k /tmp -c listen_addresses=''";
 id=docker(['run','-d','--pull=never','--name',name,'--label',`codex.fixture=${name}`,'--network','none','--cap-drop=ALL','--security-opt=no-new-privileges','--user','postgres','--entrypoint','/bin/sh',image,'-c',command]).stdout.trim();
 assert.match(id,/^[a-f0-9]{64}$/);
 const m=JSON.parse(docker(['inspect',id]).stdout)[0];
 assert.equal(m.Config.Labels['codex.fixture'],name); assert.equal(m.Image,image); assert.equal(m.HostConfig.NetworkMode,'none'); assert.equal(m.HostConfig.Privileged,false); assert.equal(m.Mounts.length,0); assert.equal(Object.keys(m.HostConfig.PortBindings??{}).length,0);
 let ready=false;
 for(let n=0;n<60;n++){if(docker(['exec',id,'pg_isready','-h','/tmp','-U','supabase_admin'],undefined,true).status===0){ready=true;break;} await new Promise(r=>setTimeout(r,500));}
 assert.ok(ready,'Postgres not ready');
 const q=(sql)=>docker(['exec','-i',id,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],sql);
 q(`create schema app; create schema extensions; create extension pgcrypto with schema extensions;
 create role anon nologin; create role authenticated nologin; create role service_role nologin;
 create table app.profiles(id uuid primary key);
 create table app.tournaments(id uuid primary key,status text not null);
 create table app.tournament_roles(tournament_id uuid,profile_id uuid,role text);
 create table app.tournament_roster_entries(id uuid,tournament_id uuid,unique(id,tournament_id));
 create table app.operation_receipts(id uuid primary key,tournament_id uuid,actor_profile_id uuid,operation_type text,target_id uuid,request_hash text,client_operation_id uuid,outcome text,response_payload jsonb,applied_at timestamptz,unique(id,tournament_id),unique(actor_profile_id,client_operation_id));
 create table app.audit_events(tournament_id uuid,actor_profile_id uuid,operation_receipt_id uuid,entity_type text,entity_id uuid,action text,after_state jsonb);
 create table app.events(id uuid,tournament_id uuid,operational_state text,unique(id,tournament_id));
 create table app.tournament_setup_event_versions(id uuid primary key,tournament_id uuid,entry_fee_cents integer);
 create table app.tournament_setup_activations(id uuid,tournament_id uuid,event_id uuid,setup_event_version_id uuid);
 create table app.tournament_setup_q_pool_versions(id uuid,tournament_id uuid,setup_event_version_id uuid,pool_type_code text,entry_fee_cents integer);
 create table app.tournament_setup_side_pool_versions(id uuid,tournament_id uuid,setup_event_version_id uuid,payout_type text);
 create table app.event_side_pool_definition_versions(id uuid,pool_id uuid,tournament_id uuid,event_id uuid,version integer,active boolean,entry_fee_minor integer);
 create table app.tournament_setup_side_pool_materializations(pool_id uuid,tournament_id uuid,event_id uuid,setup_side_pool_version_id uuid);
 create table app.q_pool_policies_v1(tournament_id uuid,pool_version_id uuid);
 create table app.q_operating_policies_v2(tournament_id uuid,pool_version_id uuid);
 create table app.q_pool_membership_versions_v1(tournament_id uuid);
 create table app.event_side_pool_policy_versions(tournament_id uuid,pool_id uuid);
 create table app.side_pool_graduated_policies_v2(tournament_id uuid,pool_id uuid);
 create table app.side_pool_recipient_policies_v3(tournament_id uuid);
 create table app.event_side_pools(tournament_id uuid,event_id uuid);
 create table app.event_participants(id uuid,tournament_id uuid,event_id uuid,roster_entry_id uuid,status text,unique(id,event_id,tournament_id));
 create table app.event_play_starts(tournament_id uuid,event_id uuid);
 create table app.synthetic_paper_deployments_v1(project_ref text primary key);
 create table app.synthetic_paper_fixtures_v1(tournament_id uuid,event_id uuid,project_ref text references app.synthetic_paper_deployments_v1);
 create function app.reject_immutable_history() returns trigger language plpgsql as $$begin raise exception 'immutable';end$$;
 ${['roster_payment_events','tournament_expense_events','q_pool_allocation_versions_v1','prize_accounting_drafts_v8','prize_accounting_finals_v8','prize_accounting_drafts_v9','prize_accounting_finals_v9','standard_singles_settlement_drafts','standard_singles_settlement_final_versions','event_settlement_drafts_v5','event_settlement_finals_v2','q_accounting_drafts_v6','q_accounting_finals_v6','no_q_accounting_drafts_v7','no_q_accounting_finals_v7','event_side_pool_payout_versions','event_side_pool_team_payout_versions','event_side_pool_reconciliations','event_side_pool_payout_reviews','event_side_pool_payout_review_versions','side_pool_amount_reviews_v2','side_pool_recipient_reviews_v3','q_obligation_reviews_v1','q_obligation_reviews_v2'].map(n=>`create table app.${n}(tournament_id uuid);`).join('\n')}
 create table app.event_side_pool_election_versions(tournament_id uuid,amount_received_minor integer);
 create table app.event_side_pool_team_election_versions(tournament_id uuid,amount_received_minor integer);`);
 q(fs.readFileSync('database/migrations/0274_multi_event_allocation_arithmetic_v1.sql','utf8'));
 q(fs.readFileSync('tests/multi-event-allocation-arithmetic.sql','utf8'));
 q(fs.readFileSync('tests/multi-event-finance-groundwork.sql','utf8'));
 q(fs.readFileSync('database/migrations/0277_multi_event_synthetic_pool_evidence_v1.sql','utf8'));
 q(fs.readFileSync('tests/multi-event-synthetic-pools.sql','utf8'));
 // Two simultaneous distinct operations against the same participant/event:
 // the tournament lock must admit exactly one base-entry source.
 q(`update app.events set operational_state='active' where id='d0000000-0000-4000-8000-000000000002';
 insert into app.tournament_roster_entries values ('c0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001');
 insert into app.event_participants values ('a2000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','registered');`);
 const request=JSON.stringify({kind:'receipt',rosterEntryId:'c0000000-0000-4000-8000-000000000002',amountMinor:5000,allocations:[{eventId:'d0000000-0000-4000-8000-000000000001',amountMinor:5000}],reason:'TEST ONLY SYNTHETIC: race',reviewed:true});
 const statement=op=>`select public.record_multi_event_finance_source_v1('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','${request}'::jsonb,'${op}');`;
 const first=spawn('docker',['--context','desktop-linux','exec','-i',id,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
 let out='',err='';first.stdout.on('data',x=>out+=x);first.stderr.on('data',x=>err+=x);
 const done=new Promise((resolve,reject)=>{first.on('error',reject);first.on('close',code=>code===0?resolve():reject(Error(err)));});
 first.stdin.end(`set application_name='multi_event_finance_race'; set request.jwt.claim.role='service_role'; begin; ${statement('f0000000-0000-4000-8000-000000000010')} select pg_sleep(2); commit;`);
 let locked=false;for(let n=0;n<100;n++){if(q("select count(*) from pg_stat_activity where application_name='multi_event_finance_race' and wait_event='PgSleep';").stdout.trim()==='1'){locked=true;break;}await new Promise(r=>setTimeout(r,25));}
 assert.ok(locked,'first transaction did not reach locked state');
 const second=q(`set request.jwt.claim.role='service_role'; ${statement('f0000000-0000-4000-8000-000000000011')}`).stdout.trim();
 await done;
 assert.equal(JSON.parse(out.split('\n').find(x=>x.startsWith('{'))).status,'multi_event_source_recorded');
 assert.equal(JSON.parse(second.split('\n').find(x=>x.startsWith('{'))).code,'base_already_recorded');
 assert.equal(q("select count(*) from app.multi_event_finance_sources_v1 where roster_entry_id='c0000000-0000-4000-8000-000000000002';").stdout.trim(),'1');
 console.log('PASS concurrent source writes serialized with one accepted base receipt');
 // Competing mode activation and legacy money insert must serialize in either
 // order; one domain wins and the other rejects instead of mixing ledgers.
 const actor='a0000000-0000-4000-8000-000000000001';
 for(const suffix of ['3','4'])q(`insert into app.tournaments values ('b0000000-0000-4000-8000-00000000000${suffix}','open'); insert into app.tournament_roles values ('b0000000-0000-4000-8000-00000000000${suffix}','${actor}','director'); insert into app.events values ('d0000000-0000-4000-8000-00000000000${suffix}','b0000000-0000-4000-8000-00000000000${suffix}','active'); insert into app.synthetic_paper_fixtures_v1 values ('b0000000-0000-4000-8000-00000000000${suffix}','d0000000-0000-4000-8000-00000000000${suffix}','nnhcnvksxgxnpvdqjgpg');`);
 async function race(label,firstSql,secondSql){
  const p=spawn('docker',['--context','desktop-linux','exec','-i',id,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',x=>stdout+=x);p.stderr.on('data',x=>stderr+=x);const finished=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',code=>code===0?resolve():reject(Error(stderr)));});
  p.stdin.end(`set application_name='${label}';set request.jwt.claim.role='service_role';begin;${firstSql};select pg_sleep(2);commit;`);
  let found=false;for(let n=0;n<100;n++){if(q(`select count(*) from pg_stat_activity where application_name='${label}' and wait_event='PgSleep';`).stdout.trim()==='1'){found=true;break;}await new Promise(r=>setTimeout(r,25));}assert.ok(found,`${label} did not lock`);
  const other=docker(['exec','-i',id,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],`set request.jwt.claim.role='service_role';${secondSql};`,true);await finished;return {stdout,other};
 }
 const modeFirst=await race('mode_first',`select public.activate_multi_event_finance_v1('${actor}','b0000000-0000-4000-8000-000000000003','simulation','f0000000-0000-4000-8000-000000000030')`,"insert into app.roster_payment_events values('b0000000-0000-4000-8000-000000000003')");
 assert.match(modeFirst.stdout,/multi_event_finance_activated/);assert.notEqual(modeFirst.other.status,0);assert.match(modeFirst.other.stderr,/multi_event_finance_mode_active/);
 const oldFirst=await race('old_first',"insert into app.roster_payment_events values('b0000000-0000-4000-8000-000000000004')",`select public.activate_multi_event_finance_v1('${actor}','b0000000-0000-4000-8000-000000000004','simulation','f0000000-0000-4000-8000-000000000040')`);
 assert.equal(oldFirst.other.status,0);assert.match(oldFirst.other.stdout,/legacy_finance_present/);
 console.log('PASS activation versus legacy receipt race in both transaction orders');
 console.log('PASS isolated arithmetic conservation, rejection cases, and private ACLs');
} finally {
 if(id){const m=JSON.parse(docker(['inspect',id]).stdout)[0];assert.equal(m.Id,id);assert.equal(m.Config.Labels['codex.fixture'],name);assert.equal(m.Image,image);docker(['rm','-f',id]);assert.equal(docker(['ps','-aq','--filter',`id=${id}`]).stdout.trim(),'');console.log('CLEANUP exact task-owned container removed');}
}
