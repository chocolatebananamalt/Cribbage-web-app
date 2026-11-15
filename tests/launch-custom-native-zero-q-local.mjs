// One explicitly authorized, disposable, network-isolated local PostgreSQL fixture.
// This launcher never retains the database/container after success or failure.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync, spawn} from 'node:child_process';

const dockerExe = 'C:\\Users\\choco\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe';
const name = 'cribbage-custom-native-zero-q-20261105';
const image = 'sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const resultDir = path.resolve('test-results', `custom-native-zero-q-${stamp}`);

if (process.env.DOCKER_HOST) throw Error('DOCKER_HOST override is not permitted');
assert.equal(fs.existsSync(dockerExe), true, 'Pinned Docker Desktop CLI is unavailable');
fs.mkdirSync(resultDir, {recursive: false});

function contextHost() {
  const r = spawnSync(dockerExe, ['context', 'inspect', 'desktop-linux'], {encoding: 'utf8', timeout: 5000});
  assert.equal(r.status, 0, String(r.stderr));
  const parsed = JSON.parse(r.stdout);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].Endpoints?.docker?.Host, 'npipe:////./pipe/dockerDesktopLinuxEngine');
  return parsed[0].Endpoints.docker.Host;
}
function docker(args, allowFailure = false) {
  contextHost();
  const r = spawnSync(dockerExe, ['--context', 'desktop-linux', ...args], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  if (!allowFailure) assert.equal(r.status, 0, String(r.stderr));
  return r;
}
function isolated(meta, cid) {
  return meta.Id === cid && meta.Name === `/${name}` && meta.State?.Status === 'running'
    && meta.Config?.Labels?.['codex.fixture'] === name && meta.Image === image
    && meta.HostConfig?.NetworkMode === 'none' && Object.keys(meta.NetworkSettings?.Networks ?? {}).every(x => x === 'none')
    && Object.keys(meta.HostConfig?.PortBindings ?? {}).length === 0 && !(meta.HostConfig?.Binds?.length)
    && meta.Mounts?.length === 0 && meta.HostConfig?.Privileged === false
    && meta.HostConfig?.ReadonlyRootfs === false && meta.HostConfig?.CapDrop?.includes('ALL')
    && meta.HostConfig?.SecurityOpt?.includes('no-new-privileges');
}

for (const required of [
  'tests/run-custom-native-zero-q-isolated.mjs',
  'tests/native-playoff-finance-recipient-local-acceptance.mjs',
  'tests/native-playoff-final-awards-local-acceptance.mjs',
  'tests/operational-finance-current-qualification-local-acceptance.mjs',
  'database/proposals/event-settings-operational-activation-v1.sql',
  'database/proposals/native-event-ledger-allocation-v1.sql',
  'database/proposals/operational-event-finance-proposals-v1.sql',
  'database/proposals/playoff-series-matches-v1.sql',
  'database/proposals/playoff-series-games-v1.sql',
  'database/proposals/native-playoff-finance-recipient-source-v1.sql',
  'database/proposals/native-playoff-final-awards-v1.sql',
]) assert.equal(fs.existsSync(required), true, `Missing prepared input: ${required}`);

assert.equal(docker(['ps', '-aq', '--filter', `name=^/${name}$`]).stdout.trim(), '', 'Existing exact task container; refusing reuse');
let cid = null;
const sourcePaths=[...fs.readdirSync('database/migrations').filter(n=>{const k=Number(n.slice(0,4));return k>=237&&k<=292;}).map(n=>'database/migrations/'+n),...['custom-graduated-amounts-v3.sql','custom-payout-intent-journal-v2.sql','custom-payout-q-setup-save-v2.sql','custom-pool-setup-save-v3.sql','custom-q-accounting-bridge-v1.sql','custom-side-accounting-bridge-v1.sql','custom-combined-accounting-v10.sql'].map(n=>'database/proposals/'+n),...['launch-custom-native-zero-q-local.mjs','run-custom-native-zero-q-isolated.mjs','custom-q-draft-local-acceptance.mjs','custom-pool-draft-local-acceptance.mjs','custom-pool-legacy-install-local-acceptance.mjs','custom-q-accounting-bridge-local-acceptance.mjs','custom-side-accounting-bridge-local-acceptance.mjs','custom-combined-native-lifecycle-local-acceptance.mjs','custom-combined-native-accounting-local-acceptance.mjs','custom-combined-accounting-local-acceptance.mjs','custom-q-side-combined-accounting-v10-local-acceptance.mjs','custom-combined-source-local-acceptance.mjs','check-custom-combined-runtime.py','custom-q-draft-concurrency-plan.mjs','q-pool-membership-seed.sql','fixtures/q-v2-foundation.mjs','fixtures/q-review-foundation.mjs','fixtures/q-review-games.json','fixtures/q-setup-prize-workspace.mjs','fixtures/q-operating-source.mjs'].map(n=>'tests/'+n),'src/lib/api/custom-pool-draft-result-v3.ts','src/lib/api/custom-payout-intent-v1.ts','src/lib/results/custom-graduated-amounts-v3.ts'];
sourcePaths.push(...["event-settings-transaction-v3.sql", "event-settings-workspace-v3.sql", "event-regular-finance-draft-v1.sql", "event-settings-activation-source-v4.sql", "event-rule-context-v1.sql", "event-rule-assessment-v1.sql", "event-settings-activation-guard-v1.sql", "event-settings-finance-backstop-v1.sql", "event-settings-operational-activation-v1.sql", "event-settings-playoff-gate-v1.sql", "native-event-ledger-source-reader-v1.sql", "native-event-ledger-allocation-v1.sql", "operational-event-finance-proposals-v1.sql", "playoff-series-matches-v1.sql", "playoff-series-games-v1.sql", "native-playoff-finance-recipient-source-v1.sql", "native-playoff-final-awards-v1.sql", "operational-provider-transport-v1.sql", "operational-finance-source-adoption-v1.sql", "native-recorded-fund-review-source-v1.sql"].map(n=>'database/proposals/'+n));
const sourceManifest=sourcePaths.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));fs.writeFileSync(path.join(resultDir,'source-manifest.json'),JSON.stringify(sourceManifest,null,2));
let exitCode = 1;
const cleanup = {name, image, resultDir, removed: false, verifiedAbsentByIdAndName: false, runnerExitCode: null};
try {
  const startup = "initdb -D /tmp/native-playoff-finance-recipient-pgdata -U supabase_admin --auth=trust --no-locale --encoding=UTF8 >/tmp/native-playoff-finance-recipient-init.log 2>&1 && exec postgres -D /tmp/native-playoff-finance-recipient-pgdata -k /tmp -c listen_addresses='' -c shared_preload_libraries=pg_stat_statements";
  cid = docker(['run', '-d', '--pull=never', '--name', name, '--label', `codex.fixture=${name}`, '--network', 'none', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--user', 'postgres', '--entrypoint', '/bin/sh', image, '-c', startup]).stdout.trim();
  assert.match(cid, /^[a-f0-9]{64}$/);
  const meta = JSON.parse(docker(['inspect', cid]).stdout)[0];
  assert.equal(isolated(meta, cid), true, 'Created container isolation mismatch');
  fs.writeFileSync(path.join(resultDir, 'container.json'), JSON.stringify({containerId: cid, name, image, dockerContext: 'desktop-linux', dockerHost: contextHost(), network: 'none', mounts: 0, publishedPorts: 0, hosted: false}, null, 2));

  let ready = false;
  for (let n = 0; n < 60; n++) {
    if (docker(['exec', cid, 'pg_isready', '-h', '/tmp', '-U', 'supabase_admin'], true).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(ready, true, 'Disposable PostgreSQL did not become ready');
  const child = spawn(process.execPath, ['--experimental-strip-types', 'tests/run-custom-native-zero-q-isolated.mjs', '--isolated-container', '--container-id', cid, '--result-dir', resultDir], {stdio: 'inherit'});
  exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
} catch (error) {
  fs.writeFileSync(path.join(resultDir, 'launcher-error.txt'), `${error?.stack ?? error}\n`);
  throw error;
} finally {
  cleanup.runnerExitCode = exitCode;
  let cleanupId = cid;
  try {
    // Reconcile an uncertain docker-run outcome only by exact name, label and image.
    if (!cleanupId) {
      const found = docker(['ps', '-aq', '--filter', `name=^/${name}$`], true).stdout.trim().split(/\r?\n/).filter(Boolean);
      if (found.length === 1) {
        const candidate = JSON.parse(docker(['inspect', found[0]]).stdout)[0];
        if (candidate.Name === `/${name}` && candidate.Config?.Labels?.['codex.fixture'] === name && candidate.Image === image) cleanupId = candidate.Id;
      }
    }
    if (cleanupId) {
      try {
        const inspection = docker(['inspect', cleanupId], true);
        if (inspection.status === 0) {
          const meta = JSON.parse(inspection.stdout)[0];
          try { fs.writeFileSync(path.join(resultDir, 'final-inspect.json'), JSON.stringify(meta, null, 2)); } catch {}
          try { const logs = docker(['logs', cleanupId], true); fs.writeFileSync(path.join(resultDir, 'postgres-container.log'), logs.stdout + logs.stderr); } catch {}
          assert.equal(meta.Id, cleanupId, 'Cleanup identity changed');
          assert.equal(meta.Name, `/${name}`, 'Cleanup name changed');
          assert.equal(meta.Config?.Labels?.['codex.fixture'], name, 'Cleanup label changed');
          assert.equal(meta.Image, image, 'Cleanup image changed');
        }
      } finally {
        docker(['rm', '-f', cleanupId], true);
      }
    }
  } finally {
    const absentId = !cleanupId || docker(['ps', '-aq', '--filter', `id=${cleanupId}`]).stdout.trim() === '';
    const absentName = docker(['ps', '-aq', '--filter', `name=^/${name}$`]).stdout.trim() === '';
    cleanup.removed = absentId && absentName;
    cleanup.verifiedAbsentByIdAndName = cleanup.removed;
    try { fs.writeFileSync(path.join(resultDir, 'cleanup.json'), JSON.stringify(cleanup, null, 2)); } catch {}
    assert.equal(cleanup.removed, true, 'Exact disposable container cleanup could not be verified');
  }
}
process.exit(exitCode);
