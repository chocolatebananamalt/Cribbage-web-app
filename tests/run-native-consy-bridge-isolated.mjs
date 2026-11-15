// Current qualification + private native playoff recipient-source runner for one exact disposable local container.
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
const name = 'cribbage-native-consy-bridge-20261110';
const image = 'sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
const db = 'fixture_native_consy_bridge_v1';
const baselinePath = '../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump';
const baselineHash = 'e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc';
const trace = [];
const record = (phase, data = {}) => { const row = {at: new Date().toISOString(), phase, ...data}; trace.push(row); fs.writeFileSync(path.join(resultDir, 'trace.json'), JSON.stringify(trace, null, 2)); console.log('OPERATIONAL_FINANCE_FIXTURE', phase, JSON.stringify(data)); };

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
  assert.equal(sql("select (select count(*)from auth.users)::text||'|'||(select count(*)from app.tournaments)::text", db).stdout.trim(), '0|0');
  for (let n = 237; n <= 292; n++) {
    const file = fs.readdirSync('database/migrations').find(x => x.startsWith(`${String(n).padStart(4, '0')}_`));
    if (!file) throw Error(`Missing migration ${n}`);
    const bytes = fs.readFileSync(path.join('database/migrations', file));
    record('migration', {file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')});
    sql(`set role postgres;${bytes}`, db);
  }
  const proposals = [
    'custom-graduated-amounts-v3.sql', 'custom-payout-intent-journal-v2.sql', 'custom-payout-q-setup-save-v2.sql',
    'event-settings-transaction-v3.sql', 'event-settings-workspace-v3.sql', 'event-regular-finance-draft-v1.sql',
    'event-settings-activation-source-v4.sql', 'event-rule-context-v1.sql', 'event-rule-assessment-v1.sql',
    'event-settings-activation-guard-v1.sql', 'event-settings-finance-backstop-v1.sql',
    'event-settings-operational-activation-v1.sql', 'event-settings-playoff-gate-v1.sql',
    'native-event-ledger-source-reader-v1.sql', 'native-event-ledger-allocation-v1.sql',
    'operational-event-finance-proposals-v1.sql', 'playoff-series-matches-v1.sql',
    'playoff-series-games-v1.sql', 'native-playoff-finance-recipient-source-v1.sql',
    'native-playoff-final-awards-v1.sql',
    'operational-provider-transport-v1.sql', 'operational-finance-source-adoption-v1.sql', 'native-recorded-fund-review-source-v1.sql', 'native-linked-consolation-digital-loss-v1.sql',
  ];
  for (const file of proposals) {
    const bytes = fs.readFileSync(path.join('database/proposals', file));
    record('proposal', {file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')});
    sql(`set role postgres;${bytes}`, db);
  }
  assert.equal(sql("select current_database()||'|'||(inet_server_addr()is null)::text", db).stdout.trim(), `${db}|true`);
  record('installed', {database: db, proposalCount: proposals.length});


  const check=sql("select app.linked_consy_native_losses_enabled_v1()::text",db).stdout.trim();
  assert.equal(check,'false');
  assert.equal(sql("select count(*) from pg_tables where schemaname='app' and tablename in ('linked_consy_native_admissions_v1','linked_consy_native_admission_witnesses_v1') and rowsecurity",db).stdout.trim(),'2');
  for(const role of ['anon','authenticated','service_role']) {
    assert.equal(sql(`select has_table_privilege('${role}','app.linked_consy_native_admissions_v1','SELECT')::text`,db).stdout.trim(),'false');
    assert.equal(sql(`select has_function_privilege('${role}','app.linked_consy_native_loss_source_v1(uuid,uuid,uuid)','EXECUTE')::text`,db).stdout.trim(),'false');
  }
  assert.equal(sql("select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app'and p.proname in ('linked_consy_eligibility_v1','linked_consolation_four_qualifier_source_v2','event_settings_playoff_source_v1')and coalesce(p.proconfig,'{}'::text[])@>array['TimeZone=UTC']",db).stdout.trim(),'0','Compatibility wrappers must preserve caller timezone');
  assert.equal(sql("select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app'and p.proname in ('linked_consy_native_loss_source_v1','linked_consy_native_admission_proof_v1','native_consy_legacy_four_source_utc_v1','native_consy_legacy_playoff_source_utc_v1')and p.proconfig@>array['TimeZone=UTC']",db).stdout.trim(),'4','Native timestamp proof must be UTC');
  record('pass',{installation:true,defaultClosed:true,unprivilegedAccess:false,populatedFlow:false,moneyMoved:false});
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

