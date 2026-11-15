// Execute only through the reviewed no-network/no-port/no-mount container gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { prepareV5LegacyCentAcceptance, verifyV5LegacyCentAcceptance } from './v5-legacy-cent-sql-acceptance.mjs';
import { captureLegacySatelliteTeam, verifyLegacySatelliteTeam } from './legacy-satellite-team-sql-acceptance.mjs';

assert.equal(process.argv.length, 5);
assert.equal(process.argv[2], '--isolated-container');
assert.equal(process.argv[3], '--container-id');
assert.match(process.argv[4], /^[a-f0-9]{64}$/);
const name = 'cribbage-qaccounting-local', db = 'fixture_v5_legacy_cent';
const image = 'sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function docker(args, input) {
  const result = spawnSync('docker', ['--context', 'desktop-linux', ...args], { input, encoding: Buffer.isBuffer(input) ? undefined : 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw Error(String(result.stderr));
  return String(result.stdout);
}
const meta = JSON.parse(docker(['inspect', name]))[0];
assert.equal(meta.Id, process.argv[4]);
assert.equal(meta.State.Status, 'running');
assert.equal(meta.Config.Labels['codex.fixture'], name);
assert.equal(meta.Image, image);
assert.equal(meta.HostConfig.NetworkMode, 'none');
assert.equal(meta.HostConfig.Privileged, false);
assert.equal(meta.Mounts.length, 0);
assert.equal(Object.keys(meta.HostConfig.PortBindings ?? {}).length, 0);
assert.ok(!meta.HostConfig.Binds?.length);
const raw = (query, database = 'postgres') => docker(['exec', '-i', name, 'psql', '-h', '/tmp', '-X', '-qAt', '-U', 'supabase_admin', '-d', database, '-v', 'ON_ERROR_STOP=1'], query).trim();
const sql = query => raw(`set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claims='{"role":"service_role"}';` + query, db);
const baseline = fs.readFileSync('../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump');
assert.equal(sha(baseline), 'e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc');
assert.equal(raw(`select count(*) from pg_database where datname='${db}';`), '0', 'Existing DB requires inspection; never reset');
const toc = docker(['exec', '-i', name, 'pg_restore', '--list'], baseline);
const owners = toc.split('\n').filter(line => !line.startsWith(';')).map(line => line.trim().split(/\s+/).at(-1)).filter(owner => owner?.startsWith('supabase_') || ['postgres', 'pgbouncer'].includes(owner));
for (const owner of new Set([...owners, 'anon', 'authenticated', 'service_role', 'authenticator', 'dashboard_user', 'pgbouncer'])) {
  assert.match(owner, /^(?:postgres|pgbouncer|anon|authenticated|service_role|authenticator|dashboard_user|supabase_[a-z_]+)$/);
  raw(`do $$begin if not exists(select 1 from pg_roles where rolname='${owner}')then create role ${owner} ${owner === 'postgres' ? 'superuser' : 'nologin'};end if;end$$;`);
}
docker(['exec', name, 'createdb', '-h', '/tmp', '-U', 'supabase_admin', '-O', 'postgres', '--template=template0', db]);
const migrations = [];
function migrate(n) {
  const file = fs.readdirSync('database/migrations').find(item => item.startsWith(String(n).padStart(4, '0') + '_'));
  assert.ok(file, 'Missing migration ' + n);
  const bytes = fs.readFileSync('database/migrations/' + file);
  const evidence = { file, bytes: bytes.length, sha256: sha(bytes) };
  console.log('APPLY LOCAL', evidence.file, evidence.bytes, evidence.sha256);
  sql(bytes.toString('utf8'));
  migrations.push(evidence);
}
try {
  docker(['exec', '-i', name, 'pg_restore', '-h', '/tmp', '--exit-on-error', '-U', 'supabase_admin', '-d', db], baseline);
  for (let n = 237; n <= 259; n++) migrate(n);
  // Repair the pre-existing generated-column transfer defect before constructing
  // genuine accepted replacement history. Then enable0260's denomination guard.
  // This deliberately tests historical replay and current guards independently.
  migrate(263);
  const prepared = prepareV5LegacyCentAcceptance(sql, { database: db });
  const satelliteTeamCapture = captureLegacySatelliteTeam(sql);
  console.log('PASS historical satellite/team cent sources captured before0260');
  for (const n of [260, 261, 262]) migrate(n);
  const acceptance = verifyV5LegacyCentAcceptance(sql, prepared);
  const satelliteTeam = verifyLegacySatelliteTeam(sql, satelliteTeamCapture);
  fs.writeFileSync('test-results/v5-legacy-cent-sql-result.json', JSON.stringify({ status: 'PASS', postgresVersion: raw('select version();', db), containerId: meta.Id, isolation: { image, network: 'none', ports: 0, mounts: 0, privileged: false }, baselineSha256: sha(baseline), migrations, acceptance, satelliteTeam }, null, 2));
  console.log('PASS V5 genuine historical cent replay and durable fresh draft/final rejection');
  console.log('PASS satellite historical replay/cent rollback and team historical replacement replay/new cent-copy replacement rollback');
} finally {
  docker(['exec', name, 'dropdb', '-h', '/tmp', '-U', 'supabase_admin', '--if-exists', db]);
  assert.equal(raw(`select count(*) from pg_database where datname='${db}';`), '0');
  console.log('CLEANUP exact V5 disposable database removed; absence verified');
}
