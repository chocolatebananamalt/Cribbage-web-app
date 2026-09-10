import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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
});
test('the normal application test command cannot silently omit a test file', () => {
  const testCommand = JSON.parse(readFileSync('package.json', 'utf8')).scripts.test;
  const expected = readdirSync('tests')
    .filter((name) => name.endsWith('.test.mjs') && !['workspace.test.mjs', 'handoff.test.mjs'].includes(name));
  for (const name of expected) assert.match(testCommand, new RegExp(`tests/${name.replaceAll('.', '\\.')}`), name);
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
