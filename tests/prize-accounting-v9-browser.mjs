// Isolated headless browser proof using portable, fictional test fixtures.
// No user Chrome profile, CDP, hosted service, payment or disbursement.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { isPrizeAccountingWorkspaceV9 } from '../src/lib/api/prize-accounting-v9.ts';
import { qSide, qSideFinal, sideOnly, makeUnfundedUpwardFixture, makePendingSideReviewFixture, v9FixtureProvenance } from './fixtures/prize-accounting-v9-workspace.mjs';

const root = process.cwd(), dir = path.join(root, 'test-results/prize-accounting-v9-browser'), origin = 'http://127.0.0.1:3270';
const actor = 'b5710000-0000-4000-8000-000000000099';
const mutable = w => ({ ...structuredClone(w), finalization: null, currentFinalVersion: 0 });
const unfunded = makeUnfundedUpwardFixture();
const preReview = makePendingSideReviewFixture();
const screens = { qSide: mutable(qSide), sideOnly: mutable(sideOnly), upUnfunded: unfunded, preReview };
for (const w of Object.values(screens)) assert.ok(isPrizeAccountingWorkspaceV9(w, w.tournamentId, w.eventId));
assert.match(v9FixtureProvenance, /TEST ONLY.*synthetic.*not.*SQL dump/);
await fs.mkdir(path.join(dir, 'app'), { recursive: true });
await fs.mkdir(path.join(dir, 'public'), { recursive: true });
await fs.writeFile(path.join(dir, 'package.json'), '{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir, 'next.config.mjs'), `export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.copyFile('public/offline-score-sw.js', path.join(dir, 'public/offline-score-sw.js'));
await fs.writeFile(path.join(dir, 'app/layout.tsx'), `import '../../../src/app/globals.css';import{RecoveryDocumentBoundary}from'../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return <html><body><RecoveryDocumentBoundary actorId="${actor}">{children}</RecoveryDocumentBoundary></body></html>}`);
for (const [name, workspace] of Object.entries(screens)) {
  await fs.mkdir(path.join(dir, 'app', name), { recursive: true });
  await fs.writeFile(path.join(dir, 'app', name, 'page.tsx'), `import Client from'../../../../src/app/tournament/[tournamentId]/events/[eventId]/prize-accounting-v9/accounting-client';const workspace=${JSON.stringify(workspace)} as import('../../../../src/lib/api/prize-accounting-v9').PrizeAccountingWorkspaceV9;export default function Page(){return <main className="auth-shell"><section className="auth-card corrections-card"><h1>TEST ONLY combined accounting</h1><Client actorId="${actor}" tournamentId="${workspace.tournamentId}" eventId="${workspace.eventId}" initialWorkspace={workspace}/></section></main>}`);
}
const candidates = [process.env.PRIZE_V9_HEADLESS_EXECUTABLE, ...[process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).map(base => path.join(base, 'Google/Chrome/Application/chrome.exe'))].filter(Boolean);
let executablePath;
for (const candidate of candidates) if ((await fs.stat(candidate).catch(() => null))?.isFile()) { executablePath = candidate; break; }
const requirements = { origin, port: 3270, headless: true, executablePath: executablePath ?? null, isolatedTemporaryProfile: true, fixture: 'tests/fixtures/prize-accounting-v9-workspace.mjs', fixtureProvenance: v9FixtureProvenance };
await fs.writeFile('test-results/prize-accounting-v9-browser-requirements.json', JSON.stringify(requirements, null, 2));
if (process.argv.includes('--prepare-only')) { console.log(JSON.stringify(requirements)); process.exit(0); }
assert.ok(executablePath, 'No installed headless browser was found. No install or user browser fallback is attempted.');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', dir, '--hostname', '127.0.0.1', '--port', '3270'], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '', browser, context, page; child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
const checks = [], unexpected = [], requestWrites = [];
const pendingKey = `payment-obligation:prize-accounting-v9:${actor}:${qSide.tournamentId}:${qSide.eventId}`;
try {
  let ready = false;
  for (let i = 0; i < 70; i++) { try { const r = await fetch(origin + '/qSide'); if (r.ok) { ready = true; break; } } catch (e) { if (['EACCES', 'EPERM'].includes(e.cause?.code)) throw e; } await new Promise(r => setTimeout(r, 300)); }
  assert.ok(ready, 'local v9 Next server readiness');
  browser = await chromium.launch({ headless: true, executablePath });
  for (const [screen, width] of [['qSide', 390], ['sideOnly', 1440]]) {
    const workspace = screens[screen];
    context = await browser.newContext({ viewport: { width, height: 1000 } }); page = await context.newPage();
    const state = { result: null, finalized: screen === 'qSide' ? qSideFinal : sideOnly };
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin !== origin) { unexpected.push(url.origin); return route.abort(); }
      if (!url.pathname.startsWith('/api/')) return route.continue();
      assert.ok(url.pathname.includes('/prize-accounting-v9'));
      if (req.method() === 'GET') return route.fulfill({ json: state.finalized });
      if (url.pathname.endsWith('/reconciliation')) {
        const body = JSON.parse(req.postData() ?? '{}');
        assert.equal(body.action, 'final');
        return route.fulfill({ json: { authorized: true, result: state.result } });
      }
      assert.ok(url.pathname.endsWith('/finalize'));
      const body = JSON.parse(req.postData() ?? '{}');
      assert.deepEqual(Object.keys(body).sort(), ['draftId', 'draftVersion', 'expectedFundingVersion', 'expectedVersion', 'reason', 'reviewed']);
      assert.equal(body.reviewed, true); assert.equal(body.expectedVersion, 0); assert.equal(body.expectedFundingVersion, 0);
      assert.match(req.headers()['x-idempotency-key'], /^[a-f0-9-]{36}$/);
      requestWrites.push(body);
      state.result = { status: 'prize_accounting_finalized_unpaid_v9', finalizationId: qSideFinal.finalization.id, draftId: workspace.draft.id, eventId: workspace.eventId, version: 1, sourceDigest: workspace.sourceDigest };
      await fs.writeFile('test-results/prize-accounting-v9-browser-interrupted.json', JSON.stringify({ action: 'final', exactBody: body, note: 'Synthetic browser route stored the matching server receipt then dropped the response.' }, null, 2));
      return route.abort();
    });
    await page.goto(origin + '/' + screen);
    await page.getByRole('heading', { name: 'Unpaid regular and Side Pool accounting' }).waitFor();
    await page.getByRole('heading', { name: 'Graduated Side Pool obligations - unpaid' }).waitFor();
    const sideRows = await page.locator('ol li').allTextContents();
    assert.equal(sideRows.length, 3);
    assert.match(sideRows[0], /\$85\.00/);
    assert.match(sideRows[1], /\$55\.00/);
    assert.match(sideRows[2], /\$30\.00/);
    if (screen === 'qSide') {
      await page.getByText('TEST ONLY Q Graduated: $160.00 award obligations', { exact: false }).waitFor();
      for (const amount of ['$80.00 - unpaid', '$55.00 - unpaid', '$25.00 - unpaid']) await page.getByText(amount, { exact: false }).waitFor();
      await page.getByText('$10.00 refund obligations', { exact: false }).waitFor();
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `no horizontal clipping at ${width}px`);
    assert.equal(await page.getByRole('button', { name: /pay|disburse/i }).count(), 0);
    if (screen === 'sideOnly') {
      assert.equal(workspace.qReview, null); assert.equal(workspace.facts.qIncomeMinor, 0);
      checks.push(`Side-only, Q=0 unpaid obligations render without horizontal overflow at ${width}px`);
    } else {
      await page.getByLabel('Accounting review reason', { exact: true }).fill('TEST ONLY unpaid combined final');
      await page.getByRole('checkbox', { name: /Finalize unpaid accounting using/ }).check();
      const button = page.getByRole('button', { name: 'Finalize unpaid accounting', exact: true });
      assert.equal(await button.isEnabled(), true);
      await button.click();
      await page.getByRole('status').filter({ hasText: 'Recording could not be confirmed' }).waitFor();
      assert.ok(await page.evaluate(k => sessionStorage.getItem(k), pendingKey));
      state.finalized = qSideFinal;
      await page.reload();
      await page.getByRole('status').filter({ hasText: 'Unpaid accounting finalized' }).waitFor();
      assert.equal(await page.evaluate(k => sessionStorage.getItem(k), pendingKey), null);
      assert.equal(requestWrites.length, 1);
      assert.match(await page.locator('body').innerText(), /Nobody was marked paid/);
      checks.push(`Q+Side final receipt survives lost response and reconciles once at ${width}px`);
    }
    await context.close();
  }
  for (const [screen, width] of [['upUnfunded', 1440], ['preReview', 390]]) {
    const workspace = screens[screen]; context = await browser.newContext({ viewport: { width, height: 1000 } }); page = await context.newPage();
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin !== origin) { unexpected.push(url.origin); return route.abort(); }
      if (!url.pathname.startsWith('/api/')) return route.continue();
      return route.fulfill({ json: workspace });
    });
    await page.goto(origin + '/' + screen);
    await page.getByRole('heading', { name: 'Unpaid regular and Side Pool accounting' }).waitFor();
    if (screen === 'upUnfunded') {
      await page.getByRole('alert').filter({ hasText: 'rounding cover remains unfunded' }).waitFor();
      await page.getByLabel('Contribution received (USD $)', { exact: true }).waitFor();
      await page.getByLabel('Contribution evidence reference', { exact: true }).waitFor();
      await page.getByText('Maximum remaining cover: $4.50.', { exact: false }).waitFor();
      await page.getByLabel('Accounting review reason', { exact: true }).fill('TEST ONLY upward draft remains unpaid pending cover');
      await page.getByRole('checkbox', { name: /Finalize unpaid accounting using/ }).check();
      assert.equal(await page.getByRole('button', { name: 'Finalize unpaid accounting', exact: true }).isDisabled(), true);
      checks.push('upward $4.50 unpaid draft remains readable and exposes its funding evidence form at 1440px');
    } else {
      await page.getByRole('heading', { name: 'Side Pool recipient review required' }).waitFor();
      await page.getByText(/no recipient amounts are asserted/).waitFor();
      await page.getByRole('link', { name: 'Open this Side Pool recipient review' }).waitFor();
      checks.push('pending Side review renders prerequisite guidance without fabricated zero obligations at 390px');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await context.close();
  }
  assert.deepEqual(unexpected, []);
  await fs.writeFile('test-results/prize-accounting-v9-browser-result.json', JSON.stringify({ status: 'PASS', checks, groups: checks.length, interceptedWrites: requestWrites.length, requirements, limitation: 'Portable TEST ONLY workspaces rendered with intercepted browser requests; not live SQL, authenticated persistence, money movement or actual disbursement.' }, null, 2));
  console.log(JSON.stringify({ status: 'PASS', checks }, null, 2));
} catch (error) {
  if (page && !page.isClosed()) { await fs.writeFile('test-results/prize-accounting-v9-browser-failure.txt', await page.locator('body').innerText().catch(() => '')); await page.screenshot({ path: 'test-results/prize-accounting-v9-browser-failure.png', fullPage: true }).catch(() => {}); }
  throw error;
} finally {
  await browser?.close(); child.kill(); await fs.writeFile('test-results/prize-accounting-v9-browser-server.log', logs);
}
