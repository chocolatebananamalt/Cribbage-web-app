// Local browser coverage for the new Side Pool director UI; APIs are fictional/intercepted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { calculateGraduatedPoolAmountsV2, graduatedPoolAmountsVersionV2 } from '../src/lib/results/graduated-pool-amounts-v2.ts';

const root = process.cwd(), dir = path.join(root, 'test-results/side-pool-graduated-v2-browser'), origin = 'http://127.0.0.1:3276';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const digest = 'a'.repeat(64), awards = calculateGraduatedPoolAmountsV2({ paidCount: 16, feeMinor: 1000, ratio: 6 });
const participantId = id(50), poolId = id(20), eventId = id(10), tournamentId = id(1), policyId = id(30), actorId = id(999);
const mkPool = ({ policy = null, started = false, history = [], entries = [], canPublish = true } = {}) => ({
  definitionId: id(15), eventId, poolId, name: 'Test Side Pool', feeMinor: 1000, policy, paidCount: entries.filter(item => item.elected && item.receivedMinor === item.dueMinor).length,
  entries, sourceDigest: digest, blockers: policy && entries.length === 16 ? [] : policy ? ['funding_unresolved'] : ['disclosed_policy_required'],
  calculation: policy && entries.length === 16 ? awards : null, history, participants: [{ participantId, displayName: 'Fictional Player' }], started, canPublish, moneyMoved: false,
});
const disclosurePool = mkPool({ canPublish: true });
const reviewEntries = Array.from({ length: 16 }, (_, index) => ({ participantId: id(50 + index), electionId: id(100 + index), version: 1, elected: true, dueMinor: 1000, receivedMinor: 1000 }));
const policy = { id: policyId, method: graduatedPoolAmountsVersionV2, ratio: 6, disclosureReference: 'TEST ONLY posted tournament rules', publishedAt: '2026-10-30T10:00:00Z' };
const staleHistory = [{ id: id(200), version: 1, sourceDigest: 'b'.repeat(64), current: false, reason: 'TEST ONLY prior amount review', calculation: awards, status: 'unpaid_amount_schedule', recordedAt: '2026-10-30T10:10:00Z' }];
const reviewPool = mkPool({ policy, started: true, canPublish: false, entries: reviewEntries, history: staleHistory });
const workspace = pool => ({ tournamentId, pools: [pool], moneyMoved: false, recipientSelection: 'not_assigned' });
await fs.mkdir(path.join(dir, 'app', '[mode]'), { recursive: true }); await fs.mkdir(path.join(dir, 'public'), { recursive: true });
await fs.writeFile(path.join(dir, 'package.json'), '{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir, 'next.config.mjs'), `export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.copyFile(path.join(root, 'public/offline-score-sw.js'), path.join(dir, 'public/offline-score-sw.js'));
await fs.writeFile(path.join(dir, 'app', 'layout.tsx'), `import '../../../src/app/globals.css';import {RecoveryDocumentBoundary} from '../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return <html><body><RecoveryDocumentBoundary actorId="${actorId}">{children}</RecoveryDocumentBoundary></body></html>}`);
await fs.writeFile(path.join(dir, 'app', '[mode]', 'page.tsx'), `import Client from '../../../../src/app/tournament/[tournamentId]/side-pools/graduated-side-pools-v2';const tid=${JSON.stringify(tournamentId)};const actor=${JSON.stringify(actorId)};const disclosure=${JSON.stringify(workspace(disclosurePool))} as import('../../../../src/lib/api/side-pool-graduated-v2').SideGraduatedWorkspaceV2;const review=${JSON.stringify(workspace(reviewPool))} as import('../../../../src/lib/api/side-pool-graduated-v2').SideGraduatedWorkspaceV2;export default async function Page({params}:{params:Promise<{mode:string}>}){const {mode}=await params;return <main className="auth-shell"><section className="auth-card"><h1>Fictional Side Pool</h1><Client actorId={actor} tournamentId={tid} workspace={mode==='review'?review:disclosure}/></section></main>}`);
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', dir, '--hostname', '127.0.0.1', '--port', '3276'], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '', browser, context, page, mode = 'first-abort', posts = [], reconciliations = [], errors = [], checks = [];
child.stdout.on('data', chunk => logs += chunk); child.stderr.on('data', chunk => logs += chunk);
const receipt = { status: 'side_pool_graduated_policy_frozen', policyId, poolId, moneyMoved: false };
try {
  await fs.writeFile('test-results/side-pool-graduated-v2-browser-process.json', JSON.stringify({ pid: child.pid, origin, fixture: dir }));
  let ready = false;
  for (const until = Date.now() + 180000; Date.now() < until;) { try { if ((await fetch(`${origin}/publish`, { signal: AbortSignal.timeout(20000) })).ok) { ready = true; break; } } catch (error) { if (['EACCES', 'EPERM'].includes(error.cause?.code)) throw error; } await new Promise(resolve => setTimeout(resolve, 300)); }
  assert.ok(ready, 'local Side Pool fixture is ready');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const go = async (route, width = 390, storageSeed = null) => {
    await context?.close(); context = await browser.newContext({ viewport: { width, height: 1000 } }); page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    if (storageSeed) await page.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), storageSeed);
    await page.route(/\/api\/v1\/tournaments\/[^/]+\/side-pool-graduated-v2(?:\/reconciliation)?$/, async r => {
      const request = r.request(), url = request.url();
      if (url.endsWith('/reconciliation')) { reconciliations.push(JSON.parse(request.postData())); return r.fulfill({ json: { authorized: true, result: null } }); }
      const body = JSON.parse(request.postData()); posts.push({ body, key: request.headers()['x-idempotency-key'], url });
      if (mode === 'first-abort' && posts.length === 1) return r.abort();
      if (mode === 'conflict') return r.fulfill({ status: 409, json: { status: 'rejected', code: 'idempotency_conflict' } });
      if (mode === 'change-retained-bytes') {
        await page.evaluate(({ key, value }) => sessionStorage.setItem(key, value), { key: `payment-obligation:side-pool-graduated-v2:${actorId}:${tournamentId}:${poolId}`, value: '{"tampered":true}' });
        mode = 'success';
      }
      return r.fulfill({ json: body.action === 'policy' ? receipt : { status: 'side_pool_amounts_reviewed_unpaid', reviewId: id(250), poolId, version: 2, sourceDigest: digest, moneyMoved: false } });
    });
    await page.goto(`${origin}/${route}`); await page.getByRole('heading', { name: storageSeed ? 'Recovery account mismatch' : 'Test Side Pool' }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no horizontal overflow at ${width}px`);
  };
  for (const width of [390, 1440]) {
    posts = []; reconciliations = []; mode = 'first-abort'; await go('publish', width);
    await page.getByLabel('Disclosure reference').fill('TEST ONLY posted tournament rules');
    await page.getByRole('button', { name: 'Disclose and freeze graduated policy' }).click();
    await page.getByRole('status').filter({ hasText: 'unresolved' }).waitFor();
    const first = structuredClone(posts[0]); assert.equal(first.body.action, 'policy'); assert.equal(first.body.request.method, graduatedPoolAmountsVersionV2); assert.equal(first.body.request.disclosed, true); assert.equal(first.body.request.disclosureReference, 'TEST ONLY posted tournament rules');
    await page.reload();
    await page.getByRole('status').filter({ hasText: 'No completed receipt was found' }).waitFor();
    await page.getByRole('button', { name: 'Retry exact Side Pool request' }).click();
    await page.getByRole('status').filter({ hasText: 'saved and audited' }).waitFor();
    assert.deepEqual(posts.at(-1), first); assert.deepEqual(reconciliations.at(-1), { operationId: first.key, mutation: first.body });
    assert.equal(await page.evaluate(k => sessionStorage.getItem(k), `payment-obligation:side-pool-graduated-v2:${actorId}:${tournamentId}:${poolId}`), null);
    mode = 'success'; await go('review', width);
    await page.getByText('16 fully paid entrants; pot $160.00; ratio 1 in 6.', { exact: true }).waitFor();
    assert.deepEqual(await page.locator('[aria-label="Unpaid rank amount schedule"] li').allTextContents(), ['$80.00', '$55.00', '$25.00'].map((amount, index) => `Rank ${index + 1}: ${amount}`));
    await page.getByText('Amount review history').click();
    await page.getByText(/Version 1 · stale · unpaid_amount_schedule/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Record collection' }).count(), 0);
    await page.getByRole('button', { name: 'Review unpaid rank amounts' }).click();
    await page.getByRole('status').filter({ hasText: 'saved and audited' }).waitFor();
    const reviewWrite = posts.at(-1); assert.equal(reviewWrite.body.action, 'review'); assert.equal(reviewWrite.body.request.expectedVersion, 1); assert.equal(reviewWrite.body.request.sourceDigest, digest); assert.equal(reviewWrite.body.request.reviewed, true);
    assert.equal(await page.getByRole('list', { name: 'Unpaid rank amount schedule' }).getByText('Fictional Player').count(), 0);
  }
  checks.push('disclosure publication before collection', 'interrupted exact request recovery at 390 and 1440', 'fully paid entrant count and conserved unpaid rank amounts at 390 and 1440', 'stale review history remains visible', 'amount review binds current source digest and version', 'no horizontal overflow and no recipient ranking');
  posts = []; reconciliations = []; mode = 'success'; await go('publish', 390); await page.getByLabel('Disclosure reference').fill('TEST ONLY retained bytes check'); mode = 'change-retained-bytes'; await page.getByRole('button', { name: 'Disclose and freeze graduated policy' }).click();
  await page.getByRole('status').filter({ hasText: 'could not be cleared safely' }).waitFor(); const ownKey = `payment-obligation:side-pool-graduated-v2:${actorId}:${tournamentId}:${poolId}`; assert.equal(await page.evaluate(k => sessionStorage.getItem(k), ownKey), '{"tampered":true}'); assert.ok(await page.getByRole('button', { name: 'Retry exact Side Pool request' }).isDisabled());
  checks.push('changed retained bytes are preserved and block retry after receipt');
  posts = []; reconciliations = []; mode = 'success'; await go('publish', 390); await page.addInitScript((key) => { const remove = Storage.prototype.removeItem; Storage.prototype.removeItem = function (candidate) { if (candidate === key) throw new Error('synthetic removal failure'); return remove.call(this, candidate); }; }, ownKey); await page.reload(); await page.getByRole('heading', { name: 'Test Side Pool' }).waitFor(); await page.getByLabel('Disclosure reference').fill('TEST ONLY removal failure'); await page.getByRole('button', { name: 'Disclose and freeze graduated policy' }).click();
  await page.getByRole('status').filter({ hasText: 'could not be cleared safely' }).waitFor(); const retainedAfterRemoveFailure = await page.evaluate(k => sessionStorage.getItem(k), ownKey); assert.ok(retainedAfterRemoveFailure); assert.ok(await page.getByRole('button', { name: 'Retry exact Side Pool request' }).isDisabled());
  checks.push('storage removal failure preserves exact request and blocks retry');
  posts = []; reconciliations = []; mode = 'success'; await go('publish', 390); await page.getByLabel('Disclosure reference').fill('TEST ONLY identity conflict'); mode = 'conflict'; await page.getByRole('button', { name: 'Disclose and freeze graduated policy' }).click();
  await page.getByRole('status').filter({ hasText: 'saved operation conflicts' }).waitFor(); const conflictRaw = await page.evaluate(k => sessionStorage.getItem(k), ownKey); assert.ok(conflictRaw); assert.ok(await page.getByRole('button', { name: 'Retry exact Side Pool request' }).isDisabled()); assert.equal(posts.length, 1); assert.equal(reconciliations.length, 0);
  checks.push('initial idempotency conflict blocks and preserves recovery immediately');
  const foreignActor = id(998), foreignKey = `payment-obligation:side-pool-graduated-v2:${foreignActor}:${tournamentId}:${poolId}`;
  const foreignRecord = JSON.stringify({ kind: 'side-pool-graduated-v2', actorId: foreignActor, operationId: id(300), mutation: { eventId, poolId, action: 'policy', request: { method: graduatedPoolAmountsVersionV2, ratio: 6, definitionVersionId: id(15), disclosureReference: 'TEST ONLY foreign actor', disclosed: true } } });
  posts = []; reconciliations = []; await go('publish', 390, { key: foreignKey, value: foreignRecord });
  await page.getByRole('heading', { name: 'Recovery account mismatch' }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Retry exact Side Pool request' }).count(), 0); assert.equal(reconciliations.length, 0); assert.equal(posts.length, 0); assert.equal(await page.evaluate(k => sessionStorage.getItem(k), foreignKey), foreignRecord);
  checks.push('foreign actor recovery triggers account mismatch and is preserved without reuse');
  const malformed = '{"kind":"future-policy"}';
  posts = []; reconciliations = []; await go('publish', 390, { key: ownKey, value: malformed });
  await page.getByRole('heading', { name: 'Recovery account mismatch' }).waitFor(); assert.equal(reconciliations.length, 0); assert.equal(posts.length, 0); assert.equal(await page.evaluate(k => sessionStorage.getItem(k), ownKey), malformed);
  checks.push('malformed same-actor recovery is preserved by the recovery boundary without writes');
  assert.deepEqual(errors, []);
  await fs.writeFile('test-results/side-pool-graduated-v2-browser-result.json', JSON.stringify({ status: 'PASS', checks, posts, reconciliations, errors, limitations: 'Local Chrome with fictional/intercepted API responses; SQL persistence and access are covered by migration acceptance checks.' }, null, 2));
  console.log('PASS Side Pool graduated v2 browser checks at 390px and 1440px');
} catch (error) {
  await fs.writeFile('test-results/side-pool-graduated-v2-browser-failure.json', JSON.stringify({ error: String(error), posts, reconciliations, errors, body: await page?.locator('body').innerText().catch(() => null) }, null, 2)); throw error;
} finally {
  await context?.close(); await browser?.close(); if (child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('close', resolve)); }
  await fs.writeFile('test-results/side-pool-graduated-v2-browser-server.log', logs);
  assert.ok(path.resolve(dir).startsWith(path.resolve(root, 'test-results') + path.sep)); await fs.rm(dir, { recursive: true, force: true });
  console.log(`CLEANUP local fixture exited; pid ${child.pid}`);
}
