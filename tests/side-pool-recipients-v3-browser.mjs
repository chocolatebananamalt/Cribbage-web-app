// Headless local UI checks with fictional, intercepted v3 API responses.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { sidePoolRecipientMethodV3 } from '../src/lib/api/side-pool-recipients-v3.ts';

const root = process.cwd(), dir = path.join(root, 'test-results/side-pool-recipient-v3-browser'), origin = 'http://127.0.0.1:3270';
const id = n => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const digest = 'a'.repeat(64), tournamentId = id(1), eventId = id(3), poolId = id(4), actorId = id(2), amountPolicyId = id(5), recipientPolicyId = id(7);
const obligations = [
  { participantId: id(20), displayName: 'TEST ONLY Ranked Player', poolRank: 1, qualified: true, amountMinor: 5500, status: 'unpaid' },
  { participantId: id(21), displayName: 'TEST ONLY Nonqualifier', poolRank: 2, qualified: false, amountMinor: 2500, status: 'unpaid' },
];
const disclosureWorkspace = {
  tournamentId, eventId, poolId, policyId: amountPolicyId, recipientPolicyId: null, feeMinor: 1000, ratio: 6, recipientPolicy: null,
  qualificationId: null, sourceDigest: digest, blockers: ['recipient_policy_required', 'unsupported_payout_domain'], fundMinor: null, obligations: [], moneyMoved: false, history: [],
};
const reviewWorkspace = {
  ...disclosureWorkspace, recipientPolicyId, recipientPolicy: { id: recipientPolicyId, method: sidePoolRecipientMethodV3, amountPolicyId, disclosureReference: 'TEST ONLY posted Side Pool terms', publishedAt: '2026-10-30T00:00:00Z' },
  qualificationId: id(8), sourceDigest: 'b'.repeat(64), blockers: [], fundMinor: 8000, obligations, history: [],
};
const tieWorkspace = { ...reviewWorkspace, sourceDigest: 'c'.repeat(64), blockers: ['cash_tie_policy_unresolved'], fundMinor: 8000, obligations: [] };
const awardResponse = { status: 'side_pool_recipient_policy_frozen', policyId: id(30), poolId, moneyMoved: false };
const reviewResponse = { status: 'side_pool_recipients_reviewed_unpaid', reviewId: id(31), poolId, version: 1, sourceDigest: reviewWorkspace.sourceDigest, obligations, moneyMoved: false };

await fs.mkdir(path.join(dir, 'app', '[mode]'), { recursive: true });
await fs.mkdir(path.join(dir, 'public'), { recursive: true });
await fs.writeFile(path.join(dir, 'package.json'), '{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir, 'next.config.mjs'), `export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.copyFile(path.join(root, 'public/offline-score-sw.js'), path.join(dir, 'public/offline-score-sw.js'));
await fs.writeFile(path.join(dir, 'app', 'layout.tsx'), `import '../../../src/app/globals.css';import {RecoveryDocumentBoundary} from '../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return <html><body><RecoveryDocumentBoundary actorId="${actorId}">{children}</RecoveryDocumentBoundary></body></html>}`);
await fs.writeFile(path.join(dir, 'app', '[mode]', 'page.tsx'), `import Client from '../../../../src/app/tournament/[tournamentId]/side-pools/recipients/[eventId]/[poolId]/side-pool-recipient-v3-client';const tid=${JSON.stringify(tournamentId)},eid=${JSON.stringify(eventId)},pid=${JSON.stringify(poolId)},actor=${JSON.stringify(actorId)};const disclosure=${JSON.stringify(disclosureWorkspace)} as import('../../../../src/lib/api/side-pool-recipients-v3').SidePoolRecipientWorkspaceV3;const review=${JSON.stringify(reviewWorkspace)} as import('../../../../src/lib/api/side-pool-recipients-v3').SidePoolRecipientWorkspaceV3;const tied=${JSON.stringify(tieWorkspace)} as import('../../../../src/lib/api/side-pool-recipients-v3').SidePoolRecipientWorkspaceV3;export default async function Page({params}:{params:Promise<{mode:string}>}){const {mode}=await params;return <main className="auth-shell"><section className="auth-card"><h1>TEST ONLY Side Pool</h1><Client actorId={actor} tournamentId={tid} eventId={eid} poolId={pid} workspace={mode==='review'?review:mode==='tie'?tied:disclosure} canPublishPolicy={mode==='disclosure'}/></section></main>}`);

const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', dir, '--hostname', '127.0.0.1', '--port', '3270'], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '', browser, context, page, mode = 'success', posts = [], reconciliations = [], errors = [], checks = [], committedReview = null;
child.stdout.on('data', chunk => logs += chunk); child.stderr.on('data', chunk => logs += chunk);
const ownKey = `payment-obligation:side-pool-recipient-v3:${actorId}:${tournamentId}:${eventId}:${poolId}`;
try {
  await fs.writeFile('test-results/side-pool-recipient-v3-browser-process.json', JSON.stringify({ pid: child.pid, origin, fixture: dir }));
  let ready = false;
  for (const until = Date.now() + 180000; Date.now() < until;) {
    try { if ((await fetch(`${origin}/disclosure`, { signal: AbortSignal.timeout(20000) })).ok) { ready = true; break; } }
    catch (error) { if (['EACCES', 'EPERM'].includes(error.cause?.code)) throw error; }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert.ok(ready, 'local Side Pool recipient fixture is ready');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const go = async (route, width = 390, seed = null) => {
    await context?.close(); context = await browser.newContext({ viewport: { width, height: 950 } }); page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    if (seed) await page.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), seed);
    await page.route(/\/api\/v1\/tournaments\/[^/]+\/events\/[^/]+\/side-pools\/[^/]+\/recipients-v3(?:\/reconciliation)?$/, async routeRequest => {
      const request = routeRequest.request(), url = request.url();
      if (url.endsWith('/reconciliation')) { reconciliations.push(JSON.parse(request.postData())); return routeRequest.fulfill({ json: { authorized: true, result: mode === 'commit-abort-review' ? committedReview : null } }); }
      const body = JSON.parse(request.postData()); posts.push({ body, key: request.headers()['x-idempotency-key'], url });
      if (mode === 'abort-policy' && posts.length === 1 || mode === 'abort-review' && posts.length === 1) return routeRequest.abort();
      if (mode === 'commit-abort-review' && posts.length === 1) { committedReview = reviewResponse; return routeRequest.abort(); }
      if (mode === 'conflict') return routeRequest.fulfill({ status: 409, json: { status: 'rejected', code: 'idempotency_conflict' } });
      if (mode === 'change-retained-bytes') await page.evaluate(({ key, value }) => sessionStorage.setItem(key, value), { key: ownKey, value: '{"tampered":true}' });
      return routeRequest.fulfill({ json: body.action === 'publish_policy' ? awardResponse : reviewResponse });
    });
    await page.goto(`${origin}/${route}`); await page.getByRole('heading', { name: seed ? 'Recovery account mismatch' : 'TEST ONLY Side Pool' }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no horizontal overflow at ${width}px`);
  };

  for (const width of [390, 1440]) {
    posts = []; reconciliations = []; mode = 'abort-policy'; await go('disclosure', width);
    await page.getByLabel('Recipient policy disclosure reference').fill('TEST ONLY posted Side Pool terms');
    await page.getByRole('button', { name: 'Disclose and freeze recipient policy' }).click();
    await page.getByText(/exact retry is preserved/).waitFor();
    const first = structuredClone(posts[0]); assert.equal(first.body.action, 'publish_policy');
    assert.equal(first.body.request.amountPolicyId, amountPolicyId); assert.equal(first.body.request.method, sidePoolRecipientMethodV3); assert.equal(first.body.request.disclosed, true);
    await page.reload();
    await page.getByText(/Retry the exact saved request/).waitFor();
    assert.equal(reconciliations.length, 0, 'policy retries use the exact idempotency operation because no policy reconciliation RPC exists');
    await page.getByRole('button', { name: 'Retry exact saved request' }).click();
    await page.getByText(/policy frozen and disclosed/).waitFor();
    assert.deepEqual(posts.at(-1), first);
    assert.equal(await page.evaluate(k => sessionStorage.getItem(k), ownKey), null);
    checks.push(`prepayment disclosure and exact publish recovery at ${width}px`);

    posts = []; reconciliations = []; mode = 'abort-review'; await go('review', width);
    assert.equal(await page.getByText(/not playoff-qualified; included by the frozen paid-card policy/).count(), 1);
    await page.getByLabel('Recipient review reason').fill('TEST ONLY checked full paid-card order');
    await page.getByRole('button', { name: 'Record unpaid recipient review' }).click();
    await page.getByText(/exact retry is preserved/).waitFor();
    const reviewFirst = structuredClone(posts[0]); assert.equal(reviewFirst.body.action, 'review');
    assert.equal(reviewFirst.body.request.sourceDigest, reviewWorkspace.sourceDigest); assert.equal(reviewFirst.body.request.reviewed, true);
    await page.reload();
    await page.getByText(/No completed review receipt was found/).waitFor();
    await page.getByRole('button', { name: 'Retry exact saved request' }).click();
    await page.getByText(/Unpaid recipient review recorded/).waitFor();
    assert.deepEqual(posts.at(-1), reviewFirst);
    assert.ok(reconciliations.length >= 2); assert.ok(reconciliations.every(item => item.operationId === reviewFirst.key));
    assert.equal(await page.evaluate(k => sessionStorage.getItem(k), ownKey), null);
    assert.equal(await page.getByText(/No payment status, recipient disbursement, or combined tournament settlement is available/).count(), 1);
    checks.push(`review recovery, all-paid-card ordering and unpaid-only disclosure at ${width}px`);
  }

  posts = []; reconciliations = []; mode = 'success'; await go('tie', 390);
  assert.ok(await page.getByText(/cash tie policy unresolved/).count());
  assert.equal(await page.getByRole('button', { name: 'Record unpaid recipient review' }).isEnabled(), false);
  checks.push('unresolved monetary ties block review');

  posts = []; reconciliations = []; mode = 'change-retained-bytes'; await go('disclosure', 390);
  await page.getByLabel('Recipient policy disclosure reference').fill('TEST ONLY changed retained bytes');
  await page.getByRole('button', { name: 'Disclose and freeze recipient policy' }).click();
  await page.getByText(/could not be cleared safely/).waitFor();
  assert.equal(await page.evaluate(k => sessionStorage.getItem(k), ownKey), '{"tampered":true}');
  assert.equal(await page.getByRole('button', { name: 'Retry exact saved request' }).isDisabled(), true);
  checks.push('changed retained bytes remain intact and block subsequent writes');

  posts = []; reconciliations = []; mode = 'success'; await go('disclosure', 390);
  await page.addInitScript(key => { const remove = Storage.prototype.removeItem; Storage.prototype.removeItem = function (candidate) { if (candidate === key) throw new Error('synthetic removal failure'); return remove.call(this, candidate); }; }, ownKey);
  await page.reload(); await page.getByLabel('Recipient policy disclosure reference').fill('TEST ONLY failed removal');
  await page.getByRole('button', { name: 'Disclose and freeze recipient policy' }).click();
  await page.getByText(/could not be cleared safely/).waitFor();
  assert.ok(await page.evaluate(k => sessionStorage.getItem(k), ownKey));
  assert.equal(await page.getByRole('button', { name: 'Retry exact saved request' }).isDisabled(), true);
  checks.push('storage removal failure preserves the recovery item and blocks writes');

  posts = []; reconciliations = []; mode = 'conflict'; await go('disclosure', 390);
  await page.getByLabel('Recipient policy disclosure reference').fill('TEST ONLY initial conflict');
  await page.getByRole('button', { name: 'Disclose and freeze recipient policy' }).click();
  await page.getByText(/conflicts with another request/).waitFor();
  assert.ok(await page.evaluate(k => sessionStorage.getItem(k), ownKey));
  assert.equal(await page.getByRole('button', { name: 'Retry exact saved request' }).isDisabled(), true);
  checks.push('initial idempotency conflict blocks immediately and preserves recovery');

  posts = []; reconciliations = []; mode = 'success'; await go('locked', 390);
  assert.ok(await page.getByText(/Previously reviewed amount-only history does not choose recipients/).count());
  assert.equal(await page.getByRole('button', { name: 'Disclose and freeze recipient policy' }).isEnabled(), false);
  checks.push('old amount-only history cannot be retrofitted after elections/play');

  posts = []; reconciliations = []; committedReview = null; mode = 'commit-abort-review'; await go('review', 390);
  await page.getByLabel('Recipient review reason').fill('TEST ONLY committed before lost response');
  await page.getByRole('button', { name: 'Record unpaid recipient review' }).click();
  await page.getByText(/exact retry is preserved/).waitFor();
  await page.reload();
  await page.getByText('Unpaid recipient review confirmed.').waitFor();
  assert.equal(await page.evaluate(k => sessionStorage.getItem(k), ownKey), null);
  await page.getByLabel('Recipient review reason').fill('TEST ONLY new review attempt after recovery');
  assert.equal(await page.getByRole('button', { name: 'Record unpaid recipient review' }).isEnabled(), true, 'reconciliation releases busy state for subsequent work');
  await page.getByRole('button', { name: 'Record unpaid recipient review' }).click();
  assert.equal(posts.length, 2); assert.notEqual(posts[0].key, posts[1].key);
  checks.push('durable receipt after lost response clears recovery and unlocks next valid action');

  posts = []; reconciliations = []; mode = 'success'; await go('disclosure', 390);
  const foreignActor = id(98), foreignKey = `payment-obligation:side-pool-recipient-v3:${foreignActor}:${tournamentId}:${eventId}:${poolId}`;
  const foreign = JSON.stringify({ kind: 'side-pool-recipient-v3', actorId: foreignActor, operationId: id(90), mutation: { ...JSON.parse(JSON.stringify(reviewWorkspace)), action: 'review' } });
  await page.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), { key: foreignKey, value: foreign });
  await page.reload();
  await page.getByRole('heading', { name: 'Recovery account mismatch' }).waitFor();
  assert.equal(posts.length, 0); assert.equal(reconciliations.length, 0);
  assert.equal(await page.evaluate(k => sessionStorage.getItem(k), foreignKey), foreign);
  await page.evaluate(k => sessionStorage.removeItem(k), foreignKey);
  checks.push('another actor recovery is isolated and preserved');

  posts = []; reconciliations = []; mode = 'success'; await go('disclosure', 390, { key: ownKey, value: '{"kind":"future-policy"}' });
  assert.equal(posts.length, 0); assert.equal(reconciliations.length, 0);
  assert.equal(await page.evaluate(k => sessionStorage.getItem(k), ownKey), '{"kind":"future-policy"}');
  checks.push('malformed same-account recovery is preserved by the recovery boundary without reuse');

  assert.deepEqual(errors, []);
  await fs.writeFile('test-results/side-pool-recipient-v3-browser-result.json', JSON.stringify({ status: 'PASS', checks, posts, reconciliations, errors, limitations: 'Local headless Chrome with fictional/intercepted API responses; RPC persistence and roles require the isolated SQL acceptance run.' }, null, 2));
  console.log('PASS Side Pool recipient v3 browser checks at 390px and 1440px');
} catch (error) {
  await fs.writeFile('test-results/side-pool-recipient-v3-browser-failure.json', JSON.stringify({ error: String(error), posts, reconciliations, errors, body: await page?.locator('body').innerText().catch(() => null) }, null, 2));
  throw error;
} finally {
  await context?.close(); await browser?.close();
  if (child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('close', resolve)); }
  await fs.writeFile('test-results/side-pool-recipient-v3-browser-server.log', logs);
  assert.ok(path.resolve(dir).startsWith(path.resolve(root, 'test-results') + path.sep)); await fs.rm(dir, { recursive: true, force: true });
  console.log(`CLEANUP local fixture exited; pid ${child.pid}`);
}
