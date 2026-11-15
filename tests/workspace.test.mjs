import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
test('standard verification runs the complete clean-clone safety suite', () => {
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
  assert.match(scripts.verify, /pnpm audit --prod --audit-level=high/);
  assert.match(scripts.verify, /pnpm lint/);
  assert.match(scripts.verify, /pnpm test/);
  assert.match(scripts.verify, /pnpm build/);
  assert.match(scripts.verify, /tests\/workspace\.test\.mjs/);
  assert.equal(scripts['verify:all'], 'pnpm verify');
  const workflow = readFileSync('.github/workflows/verify.yml', 'utf8');
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(workflow, /- run: pnpm verify/);
  assert.match(workflow, /concurrency:\s+group: verify-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}\s+cancel-in-progress: true/s);
});
test('the normal application test command cannot silently omit a test file', () => {
  const testCommand = JSON.parse(readFileSync('package.json', 'utf8')).scripts.test;
  assert.equal(testCommand, 'node tests/run-application-tests.mjs');
  const runner = readFileSync('tests/run-application-tests.mjs', 'utf8');
  assert.match(runner, /endsWith\("\.test\.mjs"\)/);
  assert.match(runner, /"workspace\.test\.mjs", "handoff\.test\.mjs"/);
  assert.match(runner, /--conditions=react-server/);
  assert.match(runner, /--experimental-strip-types/);
  assert.match(runner, /--test/);
});
test('entry documents require verification and real guidance', () => {
  for (const f of ['START_HERE.md','AGENTS.md']) {
    const text = readFileSync(f, 'utf8');
    assert.match(text, /pnpm verify/);
    assert.match(text, /docs\/quality\/VERIFICATION.md/);
  }
  for (const f of ['docs/quality/VERIFICATION.md','docs/operations/LAUNCH_PLAN.md','docs/operations/MODEL_ROUTING.md','docs/recovery/inventory.json']) assert.ok(existsSync(f), f);
  const routing = readFileSync('docs/operations/MODEL_ROUTING.md', 'utf8');
  assert.match(routing, /balanced lead, economical workers, stronger independent review/i);
  assert.match(routing, /Never use `gpt-6-astra`/);
  assert.match(routing, /`gpt-5\.6-sol` with `high` reasoning/);
  assert.match(routing, /Model strength never substitutes for evidence/i);
});
test('entry and launch guidance cannot regress to a pre-production status', () => {
  const readme = readFileSync('README.md', 'utf8');
  const start = readFileSync('START_HERE.md', 'utf8');
  const launch = readFileSync('docs/operations/LAUNCH_PLAN.md', 'utf8');
  for (const text of [readme, start, launch]) {
    assert.match(text, /https:\/\/cribbage-web-app\.vercel\.app\//);
    assert.doesNotMatch(text, /No application is currently deployed/i);
    assert.doesNotMatch(text, /complete tournament workflow has not yet been implemented/i);
  }
  assert.match(start, /OCTOBER_PILOT_REHEARSAL\.md/);
  assert.match(launch, /migrations through 0162/i);
  assert.match(launch, /No missing API, database, hosting connection/i);
});
test('project instructions preserve solve-first corrections across tasks', () => {
  const agents = readFileSync('AGENTS.md', 'utf8');
  const start = readFileSync('START_HERE.md', 'utf8');
  const memoryPath = 'docs/operations/DURABLE_PROJECT_MEMORY.md';
  const memory = readFileSync(memoryPath, 'utf8');
  assert.match(agents, /solve-first protocol/i);
  assert.match(agents, /at\s+least one concrete attempt/i);
  assert.match(agents, /When the owner corrects/i);
  assert.match(agents, /DURABLE_PROJECT_MEMORY\.md/);
  assert.match(start, /DURABLE_PROJECT_MEMORY\.md/);
  assert.match(memory, /Source-versus-work ledger/);
  assert.match(memory, /cached Rulebook and reviewed ACC resources are the starting sources/i);
  assert.match(memory, /Offline score entry and failed-device reconstruction are mandatory/i);
});
test('private handoff is ignored by Git', () => {
  for (const p of ['imports/acc-handoff-2026-09-05/test.txt','docs/private/test.txt','docs/design/references/test.jpg','prototypes/pilot-v1.3/test.html']) {
    assert.equal(spawnSync('git', ['check-ignore','--no-index','-q',p]).status,0,p);
  }
});
test('local handoff verification', {skip: !existsSync('imports/acc-handoff-2026-09-05/FILE_SHA256_MANIFEST.txt') && 'Private handoff unavailable; run verify:handoff after import'}, () => {
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const r=spawnSync(process.execPath,['--test','tests/handoff.test.mjs'],{encoding:'utf8',env});
  console.log(r.stdout);assert.equal(r.status,0,r.stderr+r.stdout);
});

test('no interactive route is build-time prerendered under the nonce-only CSP', () => {
  // Runs here because `pnpm verify` executes this file AFTER `pnpm build`, so
  // the manifest is the real build output rather than a source heuristic. The
  // source-level checks live in tests/interactive-pages-are-not-prerendered.test.mjs;
  // this one catches a page that becomes prerenderable for some other reason.
  const manifestPath = '.next/prerender-manifest.json';
  assert.ok(existsSync(manifestPath),
    'run pnpm build before this file; pnpm verify already orders it that way');
  const routes = Object.keys(JSON.parse(readFileSync(manifestPath, 'utf8')).routes ?? {});
  // Next requires these three to be statically renderable and none of them
  // carries an interactive control, so a dead script tag costs nothing there.
  const allowed = new Set(['/_global-error', '/_not-found', '/icon.svg']);
  const offenders = routes.filter((r) => !allowed.has(r));
  assert.deepEqual(offenders, [],
    'these routes are prerendered, so their scripts ship without the per-request nonce '
    + `and strict-dynamic blocks every one, leaving the page unhydrated:\n${offenders.join('\n')}`);
});
