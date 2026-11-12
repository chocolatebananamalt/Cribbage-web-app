// Isolated synthetic evidence SQL runner. No hosted service access.
import {makeSeventeenMainFixture} from './fixtures/seventeen-main-foundation.mjs';
import {startingSeatAlignedOddFieldFixture} from './fixtures/odd-field-makeup.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync,spawn}from'node:child_process';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-starting-seats-local';let db='fixture_starting_seats';const mainDb=db;const createdDbs=[db];
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
 for(let n=237;n<=270;n++){
  const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);
  const bytes=fs.readFileSync('database/migrations/'+file);console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
  sql('set role postgres;'+bytes.toString('utf8'),db);
 }
 const q=query=>sql("set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';"+query,db).trim();
 const read=query=>{const v=q(query).split('\n').filter(Boolean).at(-1);return v===undefined?null:v==='t'?true:v==='f'?false:JSON.parse(v);};

 const f=makeSeventeenMainFixture({withQ:false});
 // Modern prerequisite: declare the current prize policy BEFORE fixture activation.
 const activation=f.setupSql.match(/insert into app\.tournament_setup_activations[\s\S]+?;/)?.[0];
 assert.ok(activation,'fixture activation found');
 f.setupSql=f.setupSql.replace(activation,'').replace('director-selected-five-qualifier-prize-schedule-v2','regular-prize-cohort-5usd-v3').replace('floor_each_weighted_share_then_assign_remainder_to_champion','automatic-five-dollar-cohort-v3');
 f.setupSql=f.setupSql.replace(/commit;$/,activation+'commit;');
 const freshDb='fixture_starting_seats_new';sql(`create database ${freshDb} with template ${mainDb} owner postgres`);createdDbs.push(freshDb);
 q(f.setupSql);q(f.financeSql);q(f.seatingAttendanceSql);q(f.publishSql);q(f.startSql);
 const fingerprint=()=>read(`select jsonb_build_object('games',(select md5(string_agg(to_jsonb(g)::text,'' order by id))from app.canonical_games g),'publications',(select md5(string_agg(to_jsonb(p)::text,'' order by id))from app.event_schedule_publications p),'starts',(select md5(string_agg(to_jsonb(p)::text,'' order by id))from app.event_play_starts p))`);
 const originalStandard=q("select pg_get_functiondef('app.publish_director_reviewed_event_schedule_core_v1(uuid,uuid,uuid,jsonb,uuid)'::regprocedure)");
 const prior=fingerprint();const migration=fs.readFileSync('database/migrations/0271_initial_game_starting_seats.sql','utf8');q(migration);
 q(f.publishSql);assert.equal(read(`select app.odd_field_makeup_schedule_current_v1('${f.eid}')`),true);assert.deepEqual(fingerprint(),prior);console.log('PASS legacy started publication exact replay/currentness and historical fingerprints');
 const oldDefinition=q("select pg_get_functiondef('app.derive_odd_field_makeup_plan_v1(uuid,uuid,jsonb,jsonb)'::regprocedure)");
 db=freshDb;q(migration);q(f.setupSql);q(f.financeSql);q(f.seatingAttendanceSql);
 const call=(request,op='00000000-0000-4000-8000-000000000271',actor=f.actor,t=f.tid)=>read(`select public.publish_odd_field_makeup_schedule_v1('${actor}','${t}','${f.eid}','${JSON.stringify(request).replaceAll("'","''")}'::jsonb,'${op}')`);
 for(const [i,bad]of[{},'invalid',null].entries())assert.equal(call({...f.request,regularMatches:bad},'00000000-0000-4000-8000-'+String(280+i).padStart(12,'0')).code,'invalid_schedule');
 assert.equal(call(f.request).code,'invalid_schedule');assert.equal(read(`select count(*)from app.canonical_games where event_id='${f.eid}'`),0);
 assert.equal(call(f.request).code,'invalid_schedule');
 const aligned=startingSeatAlignedOddFieldFixture(),request={...f.request,regularMatches:aligned.regularMatches};
 assert.equal(call(request,'00000000-0000-4000-8000-000000000272',f.uid(1)).code,'not_director');
 assert.equal(call(request,'00000000-0000-4000-8000-000000000273',f.actor,'00000000-0000-4000-8000-000000000999').code,'tournament_unavailable');
 const result=call(request,'00000000-0000-4000-8000-000000000274');assert.equal(result.status,'odd_field_schedule_published');assert.deepEqual(call(request,'00000000-0000-4000-8000-000000000274'),result);
 assert.equal(read(`select count(*)from app.canonical_games where event_id='${f.eid}'`),102);
 assert.equal(read(`select app.odd_field_makeup_schedule_current_v1('${f.eid}')`),true);
 const own=read(`select set_config('request.jwt.claim.sub','${f.uid(1)}',false);select public.get_my_assigned_games_v1('${f.tid}')`);assert.ok(own.games.length);assert.ok(own.games.every(g=>typeof g.playerName==='string'&&g.playerName.length>0));
 assert.equal(q("select pg_get_functiondef('app.derive_odd_field_makeup_plan_v1(uuid,uuid,jsonb,jsonb)'::regprocedure)"),oldDefinition);
 console.log('PASS fresh odd mismatch rejection/no games; rejection replay; unauthorized/cross-event; valid sitout/later return; accepted replay/102 games');
 let standard=fs.readFileSync('tests/event-schedule-publication.sql','utf8').replace('entry_fee_cents, muggins_status','entry_fee_cents, muggins_status, free_entry').replace("'standard_singles', 2, 0, 'unset'","'standard_singles', 2, 0, 'unset', true");
 const extra=`do $probe$declare r jsonb;begin r:=public.publish_director_reviewed_event_schedule_v1('a1140000-0000-4000-8000-000000000001','b1140000-0000-4000-8000-000000000001','11140000-0000-4000-8000-000000000001','[{"gameNumber":1,"sideAVerificationId":"A-1","sideBVerificationId":"A-2","sideATableSeat":"A-2","sideBTableSeat":"A-1"},{"gameNumber":1,"sideAVerificationId":"A-3","sideBVerificationId":"A-4","sideATableSeat":"A-3","sideBTableSeat":"A-4"},{"gameNumber":2,"sideAVerificationId":"A-1","sideBVerificationId":"A-4","sideATableSeat":"A-1","sideBTableSeat":"A-4"},{"gameNumber":2,"sideAVerificationId":"A-2","sideBVerificationId":"A-3","sideATableSeat":"A-2","sideBTableSeat":"A-3"}]'::jsonb,true,'51140000-0000-4000-8000-000000000271');if r->>'code' is distinct from 'invalid_schedule' then raise exception 'new mismatch not blocked %',r;end if;end$probe$;\n`;
 standard=standard.replace("insert into schedule_test_results(label, result)\nselect 'published'",extra+"insert into schedule_test_results(label, result)\nselect 'published'");standard=standard.slice(0,standard.indexOf('-- Resolve the generated game'));
 standard+=`do $checks$declare r record;begin for r in select *from schedule_test_results loop if r.label='published' then if r.result->>'status' is distinct from 'event_schedule_published' then raise exception 'valid standard publication %',r.result;end if;elsif r.result->>'status' is distinct from 'rejected' then raise exception 'invalid standard input % %',r.label,r.result;end if;end loop;end$checks$;rollback;`;q(standard);
 console.log('PASS standard even publisher new starting mismatch, authorization, scope and valid seats');
 const patchedStandard=q("select pg_get_functiondef('app.publish_director_reviewed_event_schedule_core_v1(uuid,uuid,uuid,jsonb,uuid)'::regprocedure)");
 let historical=fs.readFileSync('tests/event-schedule-publication.sql','utf8').replace('entry_fee_cents, muggins_status','entry_fee_cents, muggins_status, free_entry').replace("'standard_singles', 2, 0, 'unset'","'standard_singles', 2, 0, 'unset', true");
 historical=historical.slice(0,historical.indexOf('-- Resolve the generated game'));
 const publishedAt=historical.lastIndexOf('insert into schedule_test_results(label, result)');
 let legacyPublish=historical.slice(publishedAt).replace("'sideATableSeat','A-1','sideBTableSeat','A-2'","'sideATableSeat','A-2','sideBTableSeat','A-1'");
 historical=historical.slice(0,publishedAt)+legacyPublish;
 historical=historical.replace('begin;', ()=> 'begin;'+originalStandard+';');
 historical+=`reset role;create temporary table before_legacy_replay as select md5(jsonb_agg(to_jsonb(g)order by id)::text) fingerprint from app.canonical_games g;${patchedStandard};set local role service_role;`+legacyPublish.replace("select 'published'","select 'legacy_replay'");
 historical+=`reset role;do $legacy$begin if(select result from schedule_test_results where label='published')is distinct from(select result from schedule_test_results where label='legacy_replay')or(select result->>'status'from schedule_test_results where label='published')is distinct from'event_schedule_published'then raise exception 'historical standard replay changed';end if;if(select fingerprint from before_legacy_replay)is distinct from(select md5(jsonb_agg(to_jsonb(g)order by id)::text)from app.canonical_games g)then raise exception 'historical standard games changed';end if;end$legacy$;rollback;`;q(historical);
 console.log('PASS historical standard mismatched initial seats exact replay and canonical-game fingerprints unchanged');
 const grants=read("select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='app'and p.proname='publish_director_reviewed_event_schedule_core_v1'and has_function_privilege('authenticated',p.oid,'EXECUTE'))or(n.nspname='public'and p.proname='publish_odd_field_makeup_schedule_v1'and has_function_privilege('authenticated',p.oid,'EXECUTE'))");assert.equal(grants,0);
 fs.writeFileSync('test-results/starting-seats-sql-result.json',JSON.stringify({passed:true,legacyPreserved:true,standardHistoricalMismatchReplay:true,acceptedReplay:true,oddSitoutAndReturn:true,standardAndOddEnforced:true,humanGrants:grants},null,2));

}finally{for(const cleanupDb of createdDbs)docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',cleanupDb]);console.log('CLEANUP disposable synthetic evidence database removed');}
