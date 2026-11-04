// Local-only UI acceptance for the synthetic event evidence branch. API writes
// are intercepted by Playwright; no account, hosted service, or real data is used.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { workspace as playoff, series, actor, tid, eid, digest, qid } from './fixtures/five-playoff-workspace.mjs';
import { makePrizeAccountingV8Fixture } from './fixtures/prize-accounting-v8-workspace.mjs';
import { sideOnly } from './fixtures/prize-accounting-v9-workspace.mjs';

const root = process.cwd(), dir = path.join(root, 'test-results/synthetic-event-ui-browser'), origin = 'http://127.0.0.1:3273';
const aid = 'b2510000-0000-4000-8000-000000000099', ref = `SYNTHETIC-EVENT-v1:${aid}:${'a'.repeat(64)}`;
const artifact = (kind, sourceDigest, payload) => ({ artifactId: aid, eventId: eid, kind, sourceDigest, payload, sha256: 'a'.repeat(64), reference: ref, text: 'SYNTHETIC EVENT EVIDENCE\nNo physical outcome or personal consent is claimed.\n' });
const context = (artifacts) => ({ tournamentId: tid, projectRef: 'nnhcnvksxgxnpvdqjgpg', eventIds: [eid], artifacts, actualMoneyReceived: false, physicalPlay: false, humanReviewClaimed: false });
const playoffArtifact = artifact('playoff', digest, { qualificationResultVersionId: qid, expectedVersion: 0, sourceDigest: digest, series });
const tiePair = [series[0].winnerId, series[0].loserId];
const tieSource = { tournamentId: tid, eventId: eid, sourceFingerprint: digest, finalized: false, blockers: [], groups: [{ candidateIds: tiePair, numericRank: 2, affectsQualificationCut: true, method: 'one_game_playoff', headToHeadGameId: null, headToHeadWinnerId: null, resolution: null }] };
const closeWorkspace = { tournamentName: 'TEST fixture', tournamentStatus: 'in_progress', events: [{ eventId: eid, name: 'TEST event', format: 'singles', scoringMethod: 'paper', playState: 'in_progress', started: true, teamEvent: false, pauseState: 'open', pausedAt: null, pauseAction: null, pauseReason: null, pauseActor: null, closeState: 'open', closedAt: null, closeAction: null, closeReason: null, closeActor: null, canReopen: true, readiness: { scheduledGames: 102, resolvedGames: 102, unresolvedGames: 0 } }] };
const tieContext = context([artifact('qualification_tie', digest, { participantIds: tiePair, method: 'one_game_playoff', winnerId: tiePair[0] })]);
const staleTieContext = context([artifact('qualification_tie', 'b'.repeat(64), { participantIds: tiePair, method: 'one_game_playoff', winnerId: tiePair[0] })]);
const closeContext = context([artifact('close', digest, { verifiedSimulatedGames: 102 })]);
const v8 = makePrizeAccountingV8Fixture({ down: true }).withDraft;
const paymentEntry = { rosterEntryId: 'b2510000-0000-4000-8000-000000000098', displayName: 'TEST entrant', plannedPaymentMethod: 'cash', paymentVersion: 0, paymentState: 'unrecorded', currentReceiptEventId: null, history: [] };

await fs.mkdir(path.join(dir, 'app'), { recursive: true }); await fs.mkdir(path.join(dir, 'public'), { recursive: true });
await fs.writeFile(path.join(dir, 'package.json'), '{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir, 'next.config.mjs'), `export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.copyFile(path.join(root, 'public/offline-score-sw.js'), path.join(dir, 'public/offline-score-sw.js'));
await fs.writeFile(path.join(dir, 'app/layout.tsx'), `// @ts-nocheck\nimport '../../../src/app/globals.css';import {RecoveryDocumentBoundary}from'../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return <html><body><RecoveryDocumentBoundary actorId="${actor}">{children}</RecoveryDocumentBoundary></body></html>}`);
const sibling='b2510000-0000-4000-8000-000000000088';
const pages = {
  playoff: `import Client from '../../../../src/app/tournament/[tournamentId]/events/[eventId]/playoff-v4/playoff-client';const workspace=${JSON.stringify(playoff)};const ctx=${JSON.stringify(context([playoffArtifact]))};export default function Page(){return <Client actorId="${actor}" tournamentId="${tid}" eventId="${eid}" initialWorkspace={workspace} syntheticContext={ctx}/>}`,
  tie: `import Client from '../../../../src/app/tournament/[tournamentId]/results/qualification-ties-client';const source=${JSON.stringify(tieSource)};const ctx=${JSON.stringify(tieContext)};export default function Page(){return <Client actorId="${actor}" tournamentId="${tid}" eventId="${eid}" source={source} candidates={${JSON.stringify(tiePair.map((id, i) => ({ id, displayName: `TEST tie ${i + 1}` })))}} syntheticContext={ctx}/>}`,
  tieMissing: `import Client from '../../../../src/app/tournament/[tournamentId]/results/qualification-ties-client';const source=${JSON.stringify(tieSource)};const ctx=${JSON.stringify(context([]))};export default function Page(){return <Client actorId="${actor}" tournamentId="${tid}" eventId="${eid}" source={source} candidates={${JSON.stringify(tiePair.map((id, i) => ({ id, displayName: `TEST tie ${i + 1}` })))}} syntheticContext={ctx}/>}`,
  tieStale: `import Client from '../../../../src/app/tournament/[tournamentId]/results/qualification-ties-client';const source=${JSON.stringify(tieSource)};const ctx=${JSON.stringify(staleTieContext)};export default function Page(){return <Client actorId="${actor}" tournamentId="${tid}" eventId="${eid}" source={source} candidates={${JSON.stringify(tiePair.map((id, i) => ({ id, displayName: `TEST tie ${i + 1}` })))}} syntheticContext={ctx}/>}`,
  close: `import Client from '../../../../src/app/tournament/[tournamentId]/event-control/event-control-client';const workspace=${JSON.stringify(closeWorkspace)};const ctx=${JSON.stringify(closeContext)};export default function Page(){return <Client actorId="${actor}" tournamentId="${tid}" workspace={workspace} syntheticContext={ctx}/>}`,
  accountingV8: `import Client from '../../../../src/app/tournament/[tournamentId]/events/[eventId]/prize-accounting-v8/accounting-client';const workspace=${JSON.stringify(v8)};const ctx=${JSON.stringify(context([]))};export default function Page(){return <Client actorId="${actor}" tournamentId="${tid}" eventId="${eid}" initialWorkspace={workspace} syntheticContext={ctx}/>}`,
  accountingV9: `import Client from '../../../../src/app/tournament/[tournamentId]/events/[eventId]/prize-accounting-v9/accounting-client';const workspace=${JSON.stringify(sideOnly)};const ctx=${JSON.stringify(context([]))};export default function Page(){return <Client actorId="${actor}" tournamentId="${tid}" eventId="${eid}" initialWorkspace={workspace} syntheticContext={ctx}/>}`,
  tieH2h: `import Client from '../../../../src/app/tournament/[tournamentId]/results/qualification-ties-client';const source=${JSON.stringify({...tieSource,groups:[{...tieSource.groups[0],method:'head_to_head',headToHeadWinnerId:tiePair[0],headToHeadGameId:aid}]})};const ctx=${JSON.stringify(context([artifact('qualification_tie',digest,{participantIds:tiePair,method:'head_to_head',winnerId:tiePair[0]})]))};export default function Page(){return <Client actorId="${actor}" tournamentId="${tid}" eventId="${eid}" source={source} candidates={[]} syntheticContext={ctx}/>}`,
  closeSibling: `import Client from '../../../../src/app/tournament/[tournamentId]/event-control/event-control-client';const workspace=${JSON.stringify({...closeWorkspace,events:[...closeWorkspace.events,{...closeWorkspace.events[0],eventId:sibling,name:'Ordinary sibling'}]})};const ctx=${JSON.stringify(closeContext)};export default function Page(){return <Client actorId="${actor}" tournamentId="${tid}" workspace={workspace} syntheticContext={ctx}/>}`,
  tieSibling: `import Client from '../../../../src/app/tournament/[tournamentId]/results/qualification-ties-client';const source=${JSON.stringify(tieSource)};const ctx=${JSON.stringify({...tieContext,eventIds:[sibling]})};export default function Page(){return <Client actorId="${actor}" tournamentId="${tid}" eventId="${eid}" source={source} candidates={[]} syntheticContext={ctx}/>}`,
  expenseOrdinary: `import Client from '../../../../src/app/tournament/[tournamentId]/payments/expense-client';export default function Page(){return <Client actorId="${actor}" tournamentId="${tid}" activeExpenseTotalMinor={0} expenses={[]}/>}`,
  expenseSynthetic: `import Client from '../../../../src/app/tournament/[tournamentId]/payments/expense-client';export default function Page(){return <Client actorId="${actor}" tournamentId="${tid}" activeExpenseTotalMinor={0} expenses={[]} syntheticMode/>}`,
  payment: `import Client from '../../../../src/app/tournament/[tournamentId]/payments/payment-client';export default function Page(){return <Client actorId="${actor}" tournamentId="${tid}" rosterEntries={[${JSON.stringify(paymentEntry)}]} acceptedMethods={['cash']} syntheticMode/>}`,
};
for (const [name, content] of Object.entries(pages)) { await fs.mkdir(path.join(dir, 'app', name), { recursive: true }); await fs.writeFile(path.join(dir, 'app', name, 'page.tsx'), '// @ts-nocheck\n'+content); }
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', dir, '--hostname', '127.0.0.1', '--port', '3273'], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '', browser; child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
const writes = []; let recoverClose = false, closeReplyStatus=200, closeReply={status:'event_play_closed',eventId:eid,closeState:'closed',scheduledGames:102,resolvedGames:102,unresolvedGames:0};
try {
  let ready = false; for (let i = 0; i < 180; i++) { try { if ((await fetch(origin + '/playoff')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 500)); } assert.ok(ready, `local readiness failed\n${logs}`);
  browser = await chromium.launch({ channel: 'chrome', headless: true }); const harness = await browser.newContext();
  await harness.route('**/api/v1/tournaments/**', async route => { const req = route.request(), body = JSON.parse(req.postData() ?? '{}'); writes.push({ path: new URL(req.url()).pathname, body }); if(recoverClose && req.url().endsWith('/play-close')) await route.fulfill({status:closeReplyStatus,contentType:'application/json',body:JSON.stringify(closeReply)}); else await route.abort(); });
  for (const width of [390, 1440]) {
    const page = await harness.newPage(); await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + '/playoff'); await page.getByRole('heading', { name: 'Five-qualifier playoff' }).waitFor();
    assert.equal(await page.getByRole('group', { name: 'Review four simulated series' }).count(), 1); assert.equal(await page.locator('ol li').filter({ hasText: 'first-round bye' }).count(), 3);
    const picks = [series[0], series[1], series[2], series[3]]; for (let i = 0; i < 4; i++) await page.getByRole('combobox', { name: `Winner of series ${i + 1}`, exact: true }).selectOption(picks[i].winnerId);
    await page.getByLabel('Playoff review reason', { exact: true }).fill('Synthetic rehearsal'); await page.getByRole('checkbox', { name: /simulated results/ }).check();
    assert.ok(await page.getByRole('button', { name: 'Record five-qualifier playoff', exact: true }).isEnabled()); await page.getByRole('button', { name: 'Record five-qualifier playoff', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1); assert.ok(await page.getByText(/no physical games were played/i).count());
    await page.close();
  }
  const playoffWrites = writes.filter(x => x.path.endsWith('/playoff-v4')); assert.equal(playoffWrites.length, 2);
  for (const write of playoffWrites) { assert.ok(write.body.reason.startsWith(`TEST ONLY SYNTHETIC: ${ref}`)); assert.deepEqual(write.body.series.map(row => row.evidenceNote), [1, 2, 3, 4].map(i => `${ref}:${i}`)); }
  const tie = await harness.newPage(); await tie.goto(origin + '/tie'); await tie.getByRole('heading', { name: 'Qualification tie review' }).waitFor();
  assert.equal(await tie.getByLabel(/Simulated one-game playoff winner/).isEnabled(), true); assert.equal(await tie.getByLabel('Resolution reason').count(), 0);
  await tie.getByLabel(/Simulated one-game playoff winner/).selectOption(tiePair[0]); await tie.getByRole('checkbox', { name: /no physical game was played/i }).check(); const tieWrite = tie.waitForRequest(req => req.url().endsWith('/qualification-ties')); await tie.getByRole('button', { name: 'Record qualification tie resolution' }).click(); const tieRequest = JSON.parse((await tieWrite).postData());
  assert.ok(tieRequest.reason.startsWith('TEST ONLY SYNTHETIC:') && tieRequest.evidenceReference === ref);
  for (const route of ['tieMissing', 'tieStale']) { const p = await harness.newPage(); await p.goto(origin + '/' + route); await p.getByRole('heading', { name: 'Qualification tie review' }).waitFor(); assert.equal(await p.getByLabel(/one-game playoff winner/i).isEnabled(), false); await p.close(); }
  const h2h=await harness.newPage();await h2h.goto(origin+'/tieH2h');await h2h.getByText(/The server found one qualifying-round head-to-head game/).waitFor();assert.equal(await h2h.getByRole('combobox').count(),0);await h2h.getByRole('checkbox',{name:/simulated outcome/}).check();await h2h.getByRole('button',{name:'Record qualification tie resolution'}).click();assert.equal(writes.filter(x=>x.path.endsWith('/qualification-ties')).at(-1).body.method,'head_to_head');
  const close = await harness.newPage(); await close.goto(origin + '/close'); await close.getByRole('heading', { name: 'Every event right now' }).waitFor(); await close.getByLabel(/Reason/).fill('Software verified simulated results'); await close.getByLabel(/I confirm the server verified simulated games are complete/i).check(); await close.getByRole('button', { name: 'Close Event', exact: true }).click(); await close.getByRole('button', { name: 'Yes, close this event' }).click();
  assert.ok(writes.some(x => x.path.endsWith('/play-close') && x.body.reason.startsWith(`TEST ONLY SYNTHETIC: ${ref}`) && x.body.confirmed === true), JSON.stringify(writes)); assert.equal(await close.getByText(/I have checked every table/).count(), 0);
  const originalClose=writes.find(x=>x.path.endsWith('/play-close')).body;
  await close.getByRole('button',{name:'Recover exact synthetic close'}).waitFor();
  await close.reload();await close.getByRole('button',{name:'Recover exact synthetic close'}).waitFor();recoverClose=true;
  const acceptedClose={...closeReply};
  for(const [body,http]of[[{...acceptedClose,eventId:sibling},200],[{status:'event_play_reopened',eventId:eid,closeState:'open'},200],[acceptedClose,500]]){
    closeReply=body;closeReplyStatus=http;await close.getByRole('button',{name:'Recover exact synthetic close'}).click();await close.getByText('Closure outcome remains uncertain or conflicted. The exact request is retained.').waitFor();
    assert.equal(await close.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.includes('synthetic-close')).length),1);
  }
  closeReply=acceptedClose;closeReplyStatus=200;
  await close.getByRole('button',{name:'Recover exact synthetic close'}).click();await close.getByText('Simulated event closure confirmed. No physical table check is claimed.').waitFor();
  assert.deepEqual(writes.filter(x=>x.path.endsWith('/play-close')).at(-1).body,originalClose);assert.equal(await close.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.includes('synthetic-close')).length),0);
  const mixed=await harness.newPage();await mixed.goto(origin+'/closeSibling');await mixed.getByRole('combobox').selectOption(sibling);
  assert.equal(await mixed.getByLabel('I have checked every table and play is finished for this event.').count(),1);assert.equal(await mixed.getByLabel('I have checked every table and play is finished for this event.').isEnabled(),false);await mixed.getByLabel(/Reason/).fill('Ordinary event reason');assert.equal(await mixed.getByLabel('I have checked every table and play is finished for this event.').isEnabled(),true);
  const ordinaryTie=await harness.newPage();await ordinaryTie.goto(origin+'/tieSibling');await ordinaryTie.getByLabel('Resolution reason').waitFor();assert.equal(await ordinaryTie.getByText(/no physical game was played/i).count(),0);
  for (const route of ['accountingV8', 'accountingV9']) { const p = await harness.newPage(); await p.goto(origin + '/' + route); await p.getByRole('heading', { name: /Unpaid/ }).waitFor(); assert.equal(await p.getByRole('button', { name: 'Record received-cover evidence' }).isDisabled(), true); assert.equal(await p.getByRole('button', { name: 'Record funding correction' }).isDisabled(), true); await p.close(); }
  const payment = await harness.newPage(); await payment.goto(origin + '/payment'); await payment.getByRole('heading', { name: 'TEST entrant' }).waitFor(); await payment.getByLabel('Amount in USD').fill('5.00'); await payment.getByRole('button', { name: 'Record simulated receipt evidence' }).click(); assert.ok(writes.some(x => x.path.endsWith('/payments/record') && x.body.note.startsWith('TEST ONLY SYNTHETIC:')));
  assert.ok(await payment.getByText(/no cash or check is claimed as actually received/i).count());
  for(const simulated of[false,true]){
    const p=await harness.newPage();await p.goto(origin+(simulated?'/expenseSynthetic':'/expenseOrdinary'));
    await p.getByLabel(simulated?'Expense detail after required synthetic label':'Description',{exact:true}).fill('LOCAL supplies');await p.getByLabel('Amount in USD',{exact:true}).fill('5.00');
    await p.getByRole('button',{name:simulated?'Add simulated expense':'Add Expense',exact:true}).click();
    const sent=writes.filter(x=>x.path.endsWith('/expenses/record')).at(-1);assert.equal(sent.body.description,simulated?'TEST ONLY SYNTHETIC: LOCAL supplies':'LOCAL supplies');
    assert.equal(await p.getByText(/no actual purchase or disbursement is claimed/i).count(),simulated?1:0);await p.close();
  }
  console.log(JSON.stringify({ status: 'PASS', server: origin, checks: ['qualification tie simulated winner/source-bound artifact; missing and stale evidence blocks', 'four simulated playoff series retain three separate byes; artifacts and no-physical-play label', 'event close cites evidence; lost response survives reload with exact same-operation recovery; ordinary sibling retains physical confirmation', 'v8/v9 actual funding and void actions blocked', 'ordinary expense label/payload preserved; simulated expense and payment use truthful labels/required prefix', 'playoff responsive at 390/1440'] }, null, 2));
} catch (error) { console.error(error); if (logs) console.error(logs); process.exitCode = 1; } finally { await browser?.close(); child.kill('SIGTERM'); const generatedApp=path.resolve(dir,'app');if(generatedApp!==path.resolve(root,'test-results/synthetic-event-ui-browser/app'))throw Error('Unexpected cleanup path');await fs.rm(generatedApp,{recursive:true,force:true}); }
