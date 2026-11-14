// Metadata-only paper directory acceptance in one exact disposable fictional container.
// No network, provider, hosted project, bind mount, published port, or real payment.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import{readPaperDirectoryV1}from'../src/lib/seating/native-mixed-paper-directory-v1.ts';

const argv = process.argv.slice(2);
const value = flag => argv[argv.indexOf(flag) + 1];
if (argv.length !== 5 || argv[0] !== '--isolated-container' || argv[1] !== '--container-id' || argv[3] !== '--result-dir') throw Error('Exact isolated arguments required');
const cid = value('--container-id');
if (!/^[a-f0-9]{64}$/.test(cid)) throw Error('Exact container ID required');
const resultDir = path.resolve(value('--result-dir'));
if (!resultDir.startsWith(path.resolve('test-results') + path.sep) || !fs.statSync(resultDir).isDirectory()) throw Error('Dedicated result directory required');

const dockerExe = 'C:\\Users\\choco\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe';
const name = 'cribbage-paper-directory-20261110';
const image = 'sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
const db = 'fixture_paper_directory_v1';
const baselinePath = 'test-results/native-mixed-pool-results-20261109/runtime-evidence/fictional-checkpoints/completed.dump';
const baselineHash = 'ed064b5d0c37389228a8a42d40ce33b896555173776b1eefe2af4bab7385813c';
const trace = [];
const record = (phase, data = {}) => { const row = {at: new Date().toISOString(), phase, ...data}; trace.push(row); fs.writeFileSync(path.join(resultDir, 'trace.json'), JSON.stringify(trace, null, 2)); console.log('PAPER_DIRECTORY_FIXTURE', phase, JSON.stringify(data)); };

if (process.env.DOCKER_HOST) throw Error('DOCKER_HOST override is not permitted');
function requireLocalContext() {
  const r = spawnSync(dockerExe, ['context', 'inspect', 'desktop-linux'], {encoding: 'utf8', timeout: 5000});
  if (r.status !== 0) throw Error('Cannot verify Docker context');
  const c = JSON.parse(r.stdout);
  if (c.length !== 1 || c[0].Endpoints?.docker?.Host !== 'npipe:////./pipe/dockerDesktopLinuxEngine') throw Error('Exact local Docker Desktop npipe required');
}
function docker(args, input, allowFailure = false) {
  requireLocalContext();
  const r = spawnSync(dockerExe, ['--context', 'desktop-linux', ...args], {input, encoding: Buffer.isBuffer(input) ? undefined : 'utf8', maxBuffer: 64 * 1024 * 1024});
  if (!allowFailure && r.status !== 0) throw Error(String(r.stderr));
  return r;
}
function assertIsolation(meta) {
  assert.equal(meta.Id, cid); assert.equal(meta.Name, `/${name}`); assert.equal(meta.State?.Status, 'running');
  assert.equal(meta.Config?.Labels?.['codex.fixture'], name); assert.equal(meta.Image, image);
  assert.equal(meta.HostConfig?.NetworkMode, 'none'); assert.deepEqual(Object.keys(meta.NetworkSettings?.Networks ?? {}), ['none']);
  assert.equal(Object.keys(meta.HostConfig?.PortBindings ?? {}).length, 0); assert.equal(meta.HostConfig?.Binds?.length ?? 0, 0);
  assert.equal(meta.Mounts?.length, 0); assert.equal(meta.HostConfig?.Privileged, false); assert.ok(meta.HostConfig?.CapDrop?.includes('ALL'));
}
assertIsolation(JSON.parse(docker(['inspect', cid]).stdout)[0]);
const sql = (query, database = 'postgres', allowFailure = false) => docker(['exec', '-i', cid, 'psql', '-h', '/tmp', '-X', '-qAt', '-U', 'supabase_admin', '-d', database, '-v', 'ON_ERROR_STOP=1'], query, allowFailure);
const baseline = fs.readFileSync(baselinePath);
assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'), baselineHash);
assert.equal(sql(`select count(*)from pg_database where datname='${db}'`).stdout.trim(), '0', 'Fixture DB already exists');
const toc = docker(['exec', '-i', cid, 'pg_restore', '--list'], baseline).stdout.toString();
const owners = [...new Set(toc.split('\n').filter(line => !line.startsWith(';')).map(line => line.trim().split(/\s+/).at(-1)).filter(x => x?.startsWith('supabase_') || ['postgres', 'pgbouncer'].includes(x)))];
for (const owner of [...new Set([...owners, 'anon', 'authenticated', 'service_role', 'authenticator', 'dashboard_user', 'pgbouncer'])]) {
  if (!/^(?:postgres|pgbouncer|anon|authenticated|service_role|authenticator|dashboard_user|supabase_[a-z_]+)$/.test(owner)) throw Error('Unexpected baseline owner');
  sql(`do $$begin if not exists(select 1 from pg_roles where rolname='${owner}')then create role ${owner} ${owner === 'postgres' ? 'superuser' : 'nologin'};end if;end$$;`);
}
docker(['exec', cid, 'createdb', '-h', '/tmp', '-U', 'supabase_admin', '-O', 'postgres', '--template=template0', db]);
try {
  docker(['exec', '-i', cid, 'pg_restore', '-h', '/tmp', '--exit-on-error', '-U', 'supabase_admin', '-d', db], baseline);

  const read=query=>{const v=sql(query,db).stdout.trim().split(/\r?\n/).at(-1);return v?JSON.parse(v):null;};
  assert.equal(read("select count(*)from auth.users where email is null or email not like '%@test.invalid'"),0);
  const original=read("select jsonb_object_agg(n,md5(v))from(select 'games'as n,coalesce(jsonb_agg(to_jsonb(x)order by id)::text,'null')as v from app.canonical_games x union all select 'evidence',coalesce(jsonb_agg(to_jsonb(x)order by id)::text,'null')from app.native_mixed_game_evidence_v1 x union all select 'starts',coalesce(jsonb_agg(to_jsonb(x)order by id)::text,'null')from app.native_mixed_simulation_starts_v1 x)q");
  sql('set role postgres;'+fs.readFileSync('database/proposals/native-mixed-paper-directory-v1.sql','utf8'),db);
  assert.equal(read("select to_jsonb(has_function_privilege('authenticated','public.get_native_mixed_paper_directory_v1(uuid,uuid,uuid)','execute'))"),false);
  const start=read('select to_jsonb(x)from app.native_mixed_simulation_starts_v1 x limit 1');
  const tid=start.tournament_id,eid=start.event_id,sid=start.id;
  const officials=read("select jsonb_agg(jsonb_build_object('actor',b.official_profile_id,'session',s.id))from app.paper_official_identity_bindings b join auth.sessions s on s.user_id=b.official_profile_id where b.tournament_id='"+tid+"'");
  assert(officials?.length);fs.writeFileSync(path.join(resultDir,'fixture-scope.json'),JSON.stringify({tid,eid,sid,officials},null,2));
  const who=officials[0];
  const q=(body,actor=who.actor,session=who.session,role='authenticated',allow=false)=>sql(`set role ${role};set request.jwt.claim.role='authenticated';set request.jwt.claim.sub='${actor}';set request.jwt.claims='${JSON.stringify({role:'authenticated',sub:actor,session_id:session})}';${body}`,db,allow);
  const get=(actor=who.actor,session=who.session)=>{const r=q(`select public.get_native_mixed_paper_directory_v1('${tid}','${eid}','${sid}');`,actor,session);return r.stdout.trim()?JSON.parse(r.stdout.trim()):null;};
  sql('set role postgres;grant execute on function public.get_native_mixed_paper_directory_v1(uuid,uuid,uuid)to authenticated;',db);
  assert.equal(get(),null,'default-off');
  const gates=['native_mixed_latest_prize_admission_enabled_v1','native_mixed_admission_enabled_v1','native_mixed_funding_enabled_v1','native_mixed_attendance_enabled_v1','native_mixed_attendance_consent_transport_enabled_v1','native_mixed_simulation_publication_enabled_v1','native_mixed_simulation_start_enabled_v1','native_mixed_simulation_start_recovery_enabled_v1','native_mixed_game_writer_enabled_v1','native_mixed_game_transport_enabled_v1','native_mixed_game_recovery_enabled_v1','native_mixed_paper_directory_enabled_v1'];
  sql('set role postgres;'+gates.map(n=>`create or replace function app.${n}()returns boolean language sql immutable set search_path=''as $$select true$$;`).join(''),db);
  const root=read(`set role postgres;select app.native_mixed_game_root_current_v1('${sid}','${tid}','${eid}');`);assert(root,'current genuine fixture root required');
  let checked=0;
  for(const o of officials){const v=get(o.actor,o.session);assert(v,'authorized official directory');const parsed=readPaperDirectoryV1(v,{actorId:o.actor,sessionId:o.session,tournamentId:tid,eventId:eid,startId:sid});assert(parsed,'strict metadata decoder');
   const expected=read(`select coalesce(jsonb_agg(g.id order by g.id),'[]')from app.canonical_games g join app.event_participants a on a.id=g.side_a_participant_id join app.event_participants b on b.id=g.side_b_participant_id join app.tournament_roster_entries ra on ra.id=a.roster_entry_id join app.tournament_roster_entries rb on rb.id=b.roster_entry_id where g.event_id='${eid}'and(ra.scorecard_type='paper'or rb.scorecard_type='paper')and a.profile_id is distinct from '${o.actor}'::uuid and b.profile_id is distinct from '${o.actor}'::uuid and app.paper_official_is_independent('${o.actor}','${tid}',g.id)`);assert.deepEqual(v.games.map(g=>g.gameId).sort(),expected.sort());assert(v.games.length>0);checked++;
   if(checked===1)fs.writeFileSync(path.join(resultDir,'directory.json'),JSON.stringify(v,null,2));
  }
  assert.equal(get(who.actor,'f0000000-0000-4000-8000-000000000099'),null,'invalid session');
  assert.equal(q(`select public.get_native_mixed_paper_directory_v1('${tid}','${eid}','f0000000-0000-4000-8000-000000000099');`).stdout.trim(),'','foreign Start');
  sql(`begin;set role postgres;delete from app.tournament_roles where tournament_id='${tid}'and profile_id='${who.actor}';set request.jwt.claim.role='authenticated';set request.jwt.claim.sub='${who.actor}';set request.jwt.claims='${JSON.stringify({role:'authenticated',sub:who.actor,session_id:who.session})}';do $check$begin if app.get_native_mixed_paper_directory_v1('${tid}','${eid}','${sid}')is not null then raise exception 'role revocation exposed directory';end if;end$check$;rollback;`,db);
  const after=read("select jsonb_object_agg(n,md5(v))from(select 'games'as n,coalesce(jsonb_agg(to_jsonb(x)order by id)::text,'null')as v from app.canonical_games x union all select 'evidence',coalesce(jsonb_agg(to_jsonb(x)order by id)::text,'null')from app.native_mixed_game_evidence_v1 x union all select 'starts',coalesce(jsonb_agg(to_jsonb(x)order by id)::text,'null')from app.native_mixed_simulation_starts_v1 x)q");assert.deepEqual(after,original);
  record('pass',{officialsChecked:checked,defaultOff:true,invalidSessionHeld:true,foreignStartHeld:true,roleRevocationHeld:true,gameEvidenceAndStartUnchanged:true});

} catch (error) {
  fs.writeFileSync(path.join(resultDir, 'runner-error.txt'), `${error?.stack ?? error}\n`);
  record('failure', {message: String(error?.message ?? error)});
  throw error;
} finally {
  try {
    const exists = sql(`select count(*)from pg_database where datname='${db}'`).stdout.trim() === '1';
    if (exists) {
      try {
        const counts = sql(`select jsonb_build_object('users',(select count(*)from auth.users),'tournaments',(select count(*)from app.tournaments),'operationalBindings',(select count(*)from app.event_settings_operational_bindings_v1),'nativeAllocations',(select count(*)from app.native_ledger_allocation_revisions_v1));`, db, true);
        fs.writeFileSync(path.join(resultDir, 'final-db-counts.txt'), counts.stdout.toString() + counts.stderr.toString());
      } catch {}
      finally { docker(['exec', cid, 'dropdb', '-h', '/tmp', '-U', 'supabase_admin', '--if-exists', db]); }
    }
    assert.equal(sql(`select count(*)from pg_database where datname='${db}'`).stdout.trim(), '0');
    record('database_removed', {database: db, verifiedAbsent: true});
  } catch (cleanupError) {
    fs.writeFileSync(path.join(resultDir, 'database-cleanup-error.txt'), `${cleanupError?.stack ?? cleanupError}\n`);
    throw cleanupError;
  }
}


