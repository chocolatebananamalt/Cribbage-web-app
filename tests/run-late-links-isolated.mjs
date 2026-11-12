// Isolated synthetic evidence SQL runner. No hosted service access.
import {makeSeventeenMainFixture} from './fixtures/seventeen-main-foundation.mjs';
import {startingSeatAlignedOddFieldFixture} from './fixtures/odd-field-makeup.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync,spawn}from'node:child_process';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-late-links-local';let db='fixture_late_links';const mainDb=db;const createdDbs=[db];
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
 for(let n=237;n<=272;n++){
  const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);
  const bytes=fs.readFileSync('database/migrations/'+file);console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
  sql('set role postgres;'+bytes.toString('utf8'),db);
 }
 const q=query=>sql("set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';"+query,db).trim();
 const read=query=>{const v=q(query).split('\n').filter(Boolean).at(-1);return v===undefined?null:v==='t'?true:v==='f'?false:JSON.parse(v);};


 const f=makeSeventeenMainFixture({withQ:false});
 const activation=f.setupSql.match(/insert into app\.tournament_setup_activations[\s\S]+?;/)?.[0];assert.ok(activation);
 f.setupSql=f.setupSql.replace(activation,'').replace('director-selected-five-qualifier-prize-schedule-v2','regular-prize-cohort-5usd-v3').replace('floor_each_weighted_share_then_assign_remainder_to_champion','automatic-five-dollar-cohort-v3');
 f.setupSql=f.setupSql.replace(/commit;$/,activation+'commit;').replace(/insert into app\.roster_account_links[\s\S]+?;/g,'');
 f.setupSql=f.setupSql.replaceAll("('a2540000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid",'null');
 q(f.setupSql);
 q(`delete from app.event_participants where id='${f.pid(5)}';insert into app.roster_account_links(tournament_id,roster_entry_id,profile_id,actor_profile_id,operation_receipt_id)values('${f.tid}','${f.rid(5)}','${f.uid(5)}','${f.actor}',(select id from app.operation_receipts where tournament_id='${f.tid}'limit 1));`);
 q(`insert into app.roster_check_in_events(tournament_id,roster_entry_id,version,check_in_state,reason,actor_profile_id,operation_receipt_id)values('${f.tid}','${f.rid(5)}',1,'checked_in','LOCAL technical check-in','${f.actor}',(select id from app.operation_receipts where tournament_id='${f.tid}'limit 1));`);
 assert.equal(read(`select public.enroll_roster_entries_in_event_v3('${f.actor}','${f.tid}','${f.eid}','["${f.rid(5)}"]','02730000-0000-4000-8000-000000000070')`).status,'event_participants_enrolled');
 assert.equal(read(`select profile_id='${f.uid(5)}'from app.event_participants where event_id='${f.eid}'and roster_entry_id='${f.rid(5)}'`),true);
 console.log('PASS normal link-before-enrollment snapshots the existing authorized account');
 q(f.financeSql);q(f.seatingAttendanceSql);
 const aligned=startingSeatAlignedOddFieldFixture();const req={...f.request,regularMatches:aligned.regularMatches};
 assert.equal(read(`select public.publish_odd_field_makeup_schedule_v1('${f.actor}','${f.tid}','${f.eid}','${JSON.stringify(req).replaceAll("'","''")}'::jsonb,'02730000-0000-4000-8000-000000000001')`).status,'odd_field_schedule_published');q(f.startSql);
 const link=n=>`insert into app.roster_account_links(tournament_id,roster_entry_id,profile_id,actor_profile_id,operation_receipt_id)values('${f.tid}','${f.rid(n)}','${f.uid(n)}','${f.actor}',(select id from app.operation_receipts where tournament_id='${f.tid}' limit 1));`;
 q(link(1)+link(2)+link(6)+link(7));
 assert.equal(read(`select count(*)from app.event_participants where event_id='${f.eid}' and id in('${f.pid(1)}','${f.pid(2)}')and profile_id is not null`),0);
 console.log('PASS reproduced enrollment-before-activation: links exist but no game account assignments');
 const fingerprint=()=>read(`select jsonb_build_object('games',(select md5(string_agg(to_jsonb(g)::text,''order by id))from app.canonical_games g),'seats',(select md5(string_agg(to_jsonb(s)::text,''order by id))from app.initial_seating_assignments s),'starts',(select md5(string_agg(to_jsonb(s)::text,''order by id))from app.event_play_starts s),'digest',app.event_participant_snapshot_digest_v1('${f.eid}'))`);
 const before=fingerprint();q(fs.readFileSync('database/migrations/0273_late_roster_account_binding.sql','utf8'));assert.deepEqual(fingerprint(),before);
 const reconcile=(n,op,actor=f.actor)=>read(`select public.reconcile_roster_event_account_v1('${actor}','${f.tid}',(select id from app.roster_account_links where roster_entry_id='${f.rid(n)}'),'02730000-0000-4000-8000-${String(op).padStart(12,'0')}')`);
 assert.equal(reconcile(1,2,f.uid(1)).code,'not_director');
 const first=reconcile(1,3);assert.equal(first.boundCount,1);assert.deepEqual(reconcile(1,3),first);assert.equal(reconcile(2,3).code,'idempotency_conflict');assert.equal(reconcile(1,4).boundCount,0);assert.equal(reconcile(2,5).boundCount,1);
 assert.deepEqual(fingerprint(),before);assert.equal(read(`select app.event_participant_snapshot_digest_v1('${f.eid}')=(select participant_snapshot_digest from app.event_play_starts where event_id='${f.eid}')`),true);
 assert.equal(read(`select count(*)from app.event_account_bindings_v1`),2);
 assert.throws(()=>q(`update app.event_account_bindings_v1 set profile_id='${f.uid(3)}'`),/immutable/);
 assert.throws(()=>q(`update app.event_participants set profile_id='${f.uid(4)}'where id='${f.pid(1)}'`),/immutable/);
 q(link(3));assert.equal(read(`select profile_id='${f.uid(3)}'from app.event_participants where id='${f.pid(3)}'`),true);
 assert.equal(read(`select bool_and(not has_function_privilege('authenticated',p.oid,'execute')and not has_function_privilege('anon',p.oid,'execute'))from pg_proc p where proname='reconcile_roster_event_account_v1'`),true);

 const startSession=(query,tag)=>{const child=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(Error(err)));});child.stdin.end(`set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claims='{"role":"service_role"}';set application_name='${tag}';`+query);return{done};};
 const raceCall=op=>`select public.reconcile_roster_event_account_v1('${f.actor}','${f.tid}',(select id from app.roster_account_links where roster_entry_id='${f.rid(6)}'),'02730000-0000-4000-8000-${String(op).padStart(12,'0')}');`;
 const races=await Promise.all([startSession(raceCall(51),'late-bind-a').done,startSession(raceCall(52),'late-bind-b').done]);
 assert.deepEqual(races.map(x=>JSON.parse(x.trim().split('\n').at(-1)).boundCount).sort(),[0,1]);
 assert.equal(read(`select count(*)from app.event_account_bindings_v1 where participant_id='${f.pid(6)}'`),1);
 console.log('PASS concurrent reconciliation yields one binding/audit and a consistent no-op');
 console.log('PASS exact existing-link repair, replay, conflicting operation, unauthorized/direct rewrite rejection, automatic late binding, immutable starts/seats/games and service-only grants');
 const game=read(`select to_json(id)from app.canonical_games where event_id='${f.eid}'and side_a_participant_id='${f.pid(1)}'and side_b_participant_id='${f.pid(2)}'limit 1`);
 const asPlayer=(n,query)=>q(`set request.jwt.claim.role='authenticated';set request.jwt.claim.sub='${f.uid(n)}';set request.jwt.claims='{"role":"authenticated","sub":"${f.uid(n)}"}';`+query);


 for(const kind of ['forfeit','excluded']){
  const record=kind==='forfeit'?`insert into app.operational_game_forfeits(id,tournament_id,event_id,canonical_game_id,winner_participant_id,departing_participant_id,rule_case,director_reason,actor_profile_id,operation_receipt_id)values('02730000-0000-4000-8000-000000000060','${f.tid}','${f.eid}','${game}','${f.pid(1)}','${f.pid(2)}','early_departure_current_game','LOCAL TEST','${f.actor}',(select id from app.operation_receipts where tournament_id='${f.tid}'limit 1));`:
  `insert into app.event_excluded_extra_game_records(id,tournament_id,event_id,participant_a_id,participant_b_id,winner_participant_id,margin,cross_check_evidence,reason,actor_profile_id,operation_receipt_id)values('02730000-0000-4000-8000-000000000061','${f.tid}','${f.eid}','${f.pid(1)}','${f.pid(2)}','${f.pid(1)}',10,'[{},{}]','LOCAL TEST','${f.actor}',(select id from app.operation_receipts where tournament_id='${f.tid}'limit 1));`;
  q(`begin;${record}do $proof$declare r jsonb;begin r:=public.reconcile_roster_event_account_v1('${f.actor}','${f.tid}',(select id from app.roster_account_links where roster_entry_id='${f.rid(7)}'),'02730000-0000-4000-8000-000000000062');if r->>'status'<>'binding_review_required' then raise exception 'evidence not blocked %',r;end if;end$proof$;rollback;`);
 }
 console.log('PASS forfeit and cross-checked excluded extra-game evidence block assignment without canonical state changes');
 const indexCoverage=read(`select bool_and(exists(select 1 from pg_index idx where idx.indrelid=c.conrelid and idx.indisvalid and idx.indpred is null and idx.indexprs is null and (idx.indkey::smallint[])[0]=c.conkey[1]))from pg_constraint c where c.conrelid='app.event_account_bindings_v1'::regclass and c.contype='f'`);assert.equal(indexCoverage,true);
 console.log('PASS all binding-table foreign keys have a supporting leading-column index');
 const pendingWorkspace=read(`select public.get_roster_account_activation_workspace_v1('${f.actor}','${f.tid}')`);assert.ok(pendingWorkspace.eventBindingIssues.some(i=>i.participantId===f.pid(7)));
 assert.equal(read(`select has_function_privilege('authenticated','public.link_roster_entry_to_account(uuid,uuid,uuid,uuid)','execute')or has_function_privilege('authenticated','public.link_roster_entry_to_account_v2(uuid,uuid,uuid,uuid)','execute')`),false);
 const firstScore=`begin;set request.jwt.claim.role='authenticated';set request.jwt.claim.sub='${f.uid(1)}';set request.jwt.claims='{"role":"authenticated","sub":"${f.uid(1)}"}';select public.submit_game_score('${game}','02730000-0000-4000-8000-000000000011',1::smallint,'a',10,'02730000-0000-4000-8000-000000000021');select pg_sleep(2);commit;`;
 const scoring=startSession(firstScore,'late-score-lock');let sleeping=false;
 for(let i=0;i<80;i++){if(read(`select exists(select 1 from pg_stat_activity where application_name='late-score-lock'and wait_event='PgSleep')`)){sleeping=true;break;}await new Promise(r=>setTimeout(r,20));}assert.ok(sleeping);
 const pendingBind=startSession(`select public.reconcile_roster_event_account_v1('${f.actor}','${f.tid}',(select id from app.roster_account_links where roster_entry_id='${f.rid(7)}'),'02730000-0000-4000-8000-000000000053');`,'late-bind-score-race');
 await scoring.done;const blockedRace=JSON.parse((await pendingBind.done).trim().split('\n').at(-1));assert.equal(blockedRace.blockedCount,1);
 assert.equal(read(`select profile_id is null from app.event_participants where id='${f.pid(7)}'`),true);
 assert.equal(JSON.parse(asPlayer(2,`select public.submit_game_score('${game}','02730000-0000-4000-8000-000000000012',2::smallint,'a',10,'02730000-0000-4000-8000-000000000022')`).split('\n').at(-1)).status,'confirmation_pending');
 console.log('PASS concurrent score-versus-binding waits on game then rejects evidence-bearing event');
 for(const n of[1,2]){const r=JSON.parse(asPlayer(n,`select public.confirm_game_score('${game}','02730000-0000-4000-8000-${String(10+n).padStart(12,'0')}','02730000-0000-4000-8000-${String(30+n).padStart(12,'0')}')`).split('\n').at(-1));assert.equal(r.status,n===1?'confirmation_pending':'verified');}
 q(link(4));assert.equal(read(`select profile_id is null from app.event_participants where id='${f.pid(4)}'`),true);assert.equal(reconcile(4,40).status,'binding_review_required');
 console.log('PASS repaired independent digital submissions/two confirmations; scored-event later link remains approved but assignment blocked');
 fs.writeFileSync('test-results/late-links-sql-result.json',JSON.stringify({passed:true,before,after:fingerprint(),game,tests:'reproduce/repair/replay/roles/conflict/history/automatic/normal digital verification/scored rejection'}));
}finally{for(const cleanupDb of createdDbs)docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',cleanupDb]);console.log('CLEANUP disposable late-link database removed');}
