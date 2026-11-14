// Metadata-only paper directory acceptance in one exact disposable fictional container.
// No network, provider, hosted project, bind mount, published port, or real payment.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';


const argv = process.argv.slice(2);
const value = flag => argv[argv.indexOf(flag) + 1];
if (argv.length !== 5 || argv[0] !== '--isolated-container' || argv[1] !== '--container-id' || argv[3] !== '--result-dir') throw Error('Exact isolated arguments required');
const cid = value('--container-id');
if (!/^[a-f0-9]{64}$/.test(cid)) throw Error('Exact container ID required');
const resultDir = path.resolve(value('--result-dir'));
if (!resultDir.startsWith(path.resolve('test-results') + path.sep) || !fs.statSync(resultDir).isDirectory()) throw Error('Dedicated result directory required');

const dockerExe = 'C:\\Users\\choco\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe';
const name = 'cribbage-stationary-registration-20261110';
const image = 'sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
const db = 'fixture_stationary_registration_v1';
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

 const read=(q,allow=false)=>{const r=sql(q,db,allow),v=r.stdout.trim().split(/\r?\n/).at(-1);return v?JSON.parse(v):null;};
 assert.equal(read("select count(*)from auth.users where email is null or email not like '%@test.invalid'"),0);
 sql('set role postgres;'+fs.readFileSync('database/proposals/stationary-registration-v1.sql','utf8'),db);
 const actor='a1310000-0000-4000-8000-000000000001',co='a1310000-0000-4000-8000-000000000008',outsider='f9000000-0000-4000-8000-000000000099',tid='b9000000-0000-4000-8000-000000000001',link='c9000000-0000-4000-8000-000000000001',op=n=>'e9000000-0000-4000-8000-'+String(n).padStart(12,'0');
 sql(`set role postgres;insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('${tid}','${actor}','TEST ONLY Stationary Requests','open','open');insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${actor}','director'),('${tid}','${co}','co_director');insert into app.tournament_registration_links(id,tournament_id,token_hash,created_by_profile_id,enabled,max_claims,max_claims_per_hour,token_version,token_salt,token_digest,lifecycle_state,issued_at,expires_at)values('${link}','${tid}',null,'${actor}',true,100,100,2,decode(repeat('11',32),'hex'),decode(repeat('22',32),'hex'),'issued',now(),now()+interval'1 day');insert into app.tournament_registration_link_heads(tournament_id,registration_link_id,state)values('${tid}','${link}','open');`,db);
 const auth=(q,who=actor,role='authenticated',allow=false)=>sql(`set role ${role};set request.jwt.claim.role='${role}';set request.jwt.claim.sub='${who}';set request.jwt.claims='${JSON.stringify({role,sub:who})}';${q}`,db,allow),get=(q,who=actor,role='authenticated')=>{const s=auth(q,who,role).stdout.trim();return s?JSON.parse(s):null;};
 const submit=(n,want,fn='submit_registration_claim_stationary_v1')=>`select public.${fn}('${link}',decode(repeat('22',32),'hex'),'Stationary','Player${n}','stationary${n}@test.invalid','','cash','paper','${op(n)}'${fn.endsWith('stationary_v1')?','+want:''});`;
 assert.equal(read("select to_jsonb(has_function_privilege('authenticated','public.review_registration_stationary_request_v1(uuid,uuid,integer,text,text,uuid)','execute'))"),false);
 sql(`set role postgres;grant execute on function public.submit_registration_claim_stationary_v1(uuid,bytea,text,text,text,text,text,text,uuid,boolean)to service_role;grant execute on function public.get_registration_stationary_workspace_v1(uuid),public.review_registration_stationary_request_v1(uuid,uuid,integer,text,text,uuid)to authenticated;`,db);
 assert.equal(get(submit(1,true),actor,'service_role'),null);
 sql("set role postgres;create or replace function app.stationary_registration_enabled_v1()returns boolean language sql stable set search_path=''as $$select true$$;",db);
 assert.equal(get(submit(1,true),actor,'service_role')?.status,'received');assert.equal(get(submit(1,true),actor,'service_role')?.status,'received');assert.equal(get(submit(2,false),actor,'service_role')?.status,'received');
 const c1=read(`select to_jsonb(id)from app.registration_claims where tournament_id='${tid}'and client_operation_id='${op(1)}'`);
 assert.equal(read(`select count(*)from app.registration_stationary_requests_v1 where tournament_id='${tid}'`),2);
 const changed=auth(submit(1,false),actor,'service_role',true);assert.notEqual(changed.status,0);assert.equal(read(`select to_jsonb(requested)from app.registration_stationary_requests_v1 where claim_id='${c1}'`),true);
 assert.equal(get(submit(3,false,'submit_registration_claim_v4'),actor,'service_role')?.status,'received');assert.notEqual(auth(submit(3,true),actor,'service_role',true).status,0);assert.equal(read(`select count(*)from app.registration_stationary_requests_v1 where tournament_id='${tid}'`),2);
 const list=`select public.get_registration_stationary_workspace_v1('${tid}');`;assert.equal(get(list).requests.length,1);assert.equal(get(list,co).requests[0].decision,'pending');assert.equal(get(list,outsider),null);
 const review=(who,rev,decision,n,reason='Review preference only')=>get(`select public.review_registration_stationary_request_v1('${tid}','${c1}',${rev},'${decision}','${reason}','${op(n)}');`,who);
 const r=review(actor,0,'reviewed',10);assert.equal(r?.revision,1);assert.deepEqual(review(actor,0,'reviewed',10),r);assert.equal(review(actor,0,'reviewed',10,'changed intent'),null);assert.equal(review(co,0,'not_accommodated',11)?.kind,'stationary-review-superseded-v1');assert.equal(review(co,1,'not_accommodated',12)?.revision,2);assert.equal(review(outsider,2,'reviewed',13),null);
 const history=read(`select count(*)from app.registration_stationary_reviews_v1 where tournament_id='${tid}'`);assert.equal(history,2);
 const immutable=sql(`set role postgres;update app.registration_stationary_requests_v1 set requested=false where claim_id='${c1}';`,db,true);assert.notEqual(immutable.status,0);
 sql(`set role postgres;create function app.fixture_stationary_fail()returns trigger language plpgsql as $check$begin if exists(select 1 from app.registration_claims where id=new.claim_id and client_operation_id='${op(4)}')then raise exception 'TEST ONLY rollback';end if;return new;end$check$;create trigger fixture_stationary_fail before insert on app.registration_stationary_requests_v1 for each row execute function app.fixture_stationary_fail();`,db);
 assert.notEqual(auth(submit(4,true),actor,'service_role',true).status,0);assert.equal(read(`select count(*)from app.registration_claims where tournament_id='${tid}'and client_operation_id='${op(4)}'`),0);
 assert.equal(read(`select count(*)from app.initial_seating_publications where tournament_id='${tid}'`),0);
 fs.writeFileSync(path.join(resultDir,'stationary-workspace.json'),JSON.stringify(get(list),null,2));record('pass',{newClaims:3,preferences:2,legacyUnknownPreserved:true,directorReviewRevisions:2,exactRetry:true,changedRetryHeld:true,staleWriterHeld:true,outsiderDenied:true,immutableHistory:true,atomicSignupRollback:true,noSeatingAssignment:true});

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


