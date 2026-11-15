// One explicitly authorized, disposable, network-isolated local PostgreSQL fixture.
// This launcher never retains the database/container after success or failure.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync, spawn} from 'node:child_process';

const dockerExe = 'C:\\Users\\choco\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe';
const name = 'cribbage-normal-satellite-20261110';
const image = 'sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const resultDir = path.resolve('test-results', `normal-satellite-${stamp}`);

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
  'tests/run-normal-satellite-isolated.mjs',
  'tests/operational-finance-source-adoption-local-acceptance.mjs',
  'tests/operational-provider-local-acceptance.mjs',
  'tests/native-playoff-finance-recipient-local-acceptance.mjs',
  'tests/native-playoff-final-awards-sanctioned-race-local-acceptance.mjs',
  'tests/operational-finance-current-qualification-sanctioned-local-acceptance.mjs',
  'database/proposals/event-settings-operational-activation-v1.sql',
  'database/proposals/native-event-ledger-allocation-v1.sql',
  'database/proposals/operational-event-finance-proposals-v1.sql',
  'database/proposals/playoff-series-matches-v1.sql',
  'database/proposals/playoff-series-games-v1.sql',
  'database/proposals/native-playoff-finance-recipient-source-v1.sql',
  'database/proposals/native-playoff-final-awards-v1.sql',
  'database/proposals/operational-provider-transport-v1.sql',
  'database/proposals/operational-finance-source-adoption-v1.sql',
]) assert.equal(fs.existsSync(required), true, `Missing prepared input: ${required}`);

assert.equal(docker(['ps', '-aq', '--filter', `name=^/${name}$`]).stdout.trim(), '', 'Existing exact task container; refusing reuse');
let cid = null;
let exitCode = 1;
const cleanup = {name, image, resultDir, removed: false, verifiedAbsentByIdAndName: false, runnerExitCode: null};
try {
  const startup = "initdb -D /tmp/operational-finance-adoption-pgdata -U supabase_admin --auth=trust --no-locale --encoding=UTF8 >/tmp/operational-finance-adoption-init.log 2>&1 && exec postgres -D /tmp/operational-finance-adoption-pgdata -k /tmp -c listen_addresses='' -c shared_preload_libraries=pg_stat_statements";
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
  const child = spawn(process.execPath, ['--conditions=react-server', '--experimental-strip-types', 'tests/run-normal-satellite-isolated.mjs', '--isolated-container', '--container-id', cid, '--result-dir', resultDir], {stdio: 'inherit'});
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
