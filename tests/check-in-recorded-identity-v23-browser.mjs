import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import { createAdoptionHandlersV8 } from '../src/lib/identity-adoption-v8/handlers.ts';
import { adoptionProviderV8 } from '../src/lib/identity-adoption-v8/provider.ts';
import { identityEngineHashV5 } from '../src/lib/identity-v5/contracts.ts';
import { id, scope, profile, checkIn, catalogHash } from './fixtures/check-in-identity-v23.mjs';

const root = process.cwd(), dir = path.resolve('../browser-fixture');
fs.mkdirSync(dir, { recursive: true });
const require = createRequire(import.meta.url), { webpack } = require('next/dist/compiled/webpack/webpack');
fs.writeFileSync(path.join(dir, 'loader.cjs'), `const ts=require(${JSON.stringify(path.join(root, 'node_modules/typescript'))});module.exports=function(s){return ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText}`);
fs.writeFileSync(path.join(dir, 'auth.offline'), `const listeners=new Set();window.fixtureAuthEvent=event=>listeners.forEach(fn=>fn(event));export const createClient=()=>({auth:{onAuthStateChange:fn=>{listeners.add(fn);queueMicrotask(()=>fn('INITIAL_SESSION'));return{data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}}}}});window.fixtureSubscriptions=()=>listeners.size;`);
fs.writeFileSync(path.join(dir, 'router.offline'), `export const useRouter=()=>({refresh:()=>{window.fixtureRefreshes=(window.fixtureRefreshes??0)+1}});`);
fs.writeFileSync(path.join(dir, 'entry.offline'), `import React from'react';import{createRoot}from'react-dom/client';import Seating from'${path.join(root, 'src/app/tournament/[tournamentId]/seating/seating-client').replaceAll('\\', '/')}';const f=window.fixture;const root=createRoot(document.getElementById('root'));window.fixtureRender=props=>root.render(<Seating {...props}/>);window.fixtureRender(f.props);`);
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: 'production', context: root, target: 'web', entry: path.join(dir, 'entry.offline'), output: { path: dir, filename: 'bundle.js' },
    resolve: { modules: [path.join(root, 'node_modules'), 'node_modules'], extensions: ['.tsx', '.ts', '.js', '.offline'], alias: { '../lib/supabase/client$': path.join(dir, 'auth.offline'), 'next/navigation$': path.join(dir, 'router.offline') } },
    module: { rules: [{ test: /\.(tsx?|offline)$/, exclude: /node_modules/, use: path.join(dir, 'loader.cjs') }] }, optimization: { minimize: false } });
  compiler.run((error, stats) => compiler.close(closeError => error || closeError || stats?.hasErrors() ? reject(error ?? closeError ?? Error(stats.toString({ all: false, errors: true }))) : resolve()));
});

const controls = { mode: 'valid', access: scope, hold: false, held: [], requests: [], rpc: [], writes: [] };
async function held(count = 1) { const deadline = Date.now() + 10000; while (controls.held.length < count) { if (Date.now() > deadline) throw Error('fixture response did not reach the expected hold point'); await new Promise(resolve => setTimeout(resolve, 10)); } }
const provider = adoptionProviderV8({ rpc: async (name, args) => {
  controls.rpc.push({ name, rosterEntryId: args.p_roster_entry_id });
  if (name === 'get_legacy_adoption_capability_v8') return { error: null, data: { kind: 'legacy-adoption-capability-v8', actorId: scope.actorId, sessionId: scope.sessionId, tournamentId: scope.tournamentId, version: 8, available: true, backendHash: catalogHash, baseEngineHash: identityEngineHashV5, legacyCreationAllowed: false } };
  assert.equal(name, 'read_legacy_adoption_profile_v8', 'Review never calls a writer');
  if (controls.mode === 'null') return { error: null, data: null };
  const n = args.p_roster_entry_id === id(4) ? 4 : 5, p = profile(controls.mode === 'wrong-row' ? (n === 4 ? 5 : 4) : n);
  if (controls.mode === 'incomplete') { p.coverage = 'incomplete_reviewed'; p.player.address.street = ''; }
  return { error: null, data: p };
} }, catalogHash);
const handler = createAdoptionHandlersV8({ enabled: () => true, sameOrigin: () => true, access: async () => controls.access, provider });
let browser, server;
const result = { fixture: 'actual SeatingClient + actual read component + existing adoption handler/provider; synthetic Auth/SDK/RPC, no Next SSR/PostgREST/native database', checks: [], cleanup: {} };
try {
  server = http.createServer(async (req, res) => {
    try {
      if (req.url === '/bundle.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); res.end(fs.readFileSync(path.join(dir, 'bundle.js'))); return; }
      if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script src="/bundle.js"></script>'); return; }
      if (!req.url?.startsWith('/api/')) { res.writeHead(204); res.end(); return; }
      const match = req.url?.match(/^\/api\/v1\/tournaments\/([^/]+)\/identity-adoption-v8\/profile/);
      controls.requests.push({ method: req.method, profile: !!match });
      if (!match) { controls.writes.push({ method: req.method, path: req.url }); res.writeHead(503); res.end('{}'); return; }
      assert.equal(req.method, 'GET');
      const response = await handler(new Request('http://' + req.headers.host + req.url, { headers: req.headers }), match[1], 'profile');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (controls.hold) await new Promise(resolve => controls.held.push(resolve));
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(bytes);
    } catch { res.writeHead(503); res.end('{}'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
    const props = { actorId: scope.actorId, tournamentId: scope.tournamentId, identityScope: scope, registrationClosed: false, publication: null, checkIn };
    await context.addInitScript(({ props }) => { window.fixture = { props }; }, { props });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const rows = () => page.locator('#check-in-list > li'), review = n => rows().nth(n).getByRole('button', { name: 'Review recorded identity', exact: true });
    await page.goto(origin); await review(0).waitFor();
    assert.equal(controls.requests.length, 0, 'No automatic identity request');
    // Same legal name/address, independent stable IDs, replies deliberately reversed.
    controls.hold = true;
    await review(0).click(); await review(1).click();
    await page.waitForFunction(() => document.querySelectorAll('button:disabled').length > 0);
    await held(2);
    controls.held.pop()(); await rows().nth(1).getByRole('heading', { name: 'Alex Example Jr.', exact: true }).waitFor();
    controls.held.pop()(); await rows().nth(0).getByRole('heading', { name: 'Alex Example Sr.', exact: true }).waitFor(); controls.hold = false;
    assert.ok((await rows().nth(0).innerText()).includes('Temporary ID# 1'));
    assert.ok((await rows().nth(1).innerText()).includes('Temporary ID# 2'));
    assert.equal(await page.getByText('1 Fictional Way', { exact: false }).count(), 0);
    assert.equal(controls.writes.length, 0);
    result.checks.push({ width, case: 'explicit reads, identical legal names/address, distinct IDs/suffixes, reverse replies, no writes or private ID/address display' });
    // Null/wrong row must clear a previous display and never choose its namesake.
    for (const mode of ['null', 'wrong-row']) {
      controls.mode = mode; await review(0).click(); await rows().nth(0).getByText('Recorded identity is unavailable or needs binding review.', { exact: false }).waitFor();
      assert.equal(await rows().nth(0).getByRole('heading', { name: 'Alex Example Sr.', exact: true }).count(), 0);
      result.checks.push({ width, case: mode + ' leaves explicit unavailable, no fallback' });
    }
    controls.mode = 'incomplete'; await review(0).click(); await rows().nth(0).getByText('Address information is incomplete.', { exact: false }).waitFor();
    result.checks.push({ width, case: 'incomplete address is not represented as a complete duplicate match' });
    // Auth epoch invalidates an already-computed response; no token is used/read.
    controls.mode = 'valid'; controls.hold = true; await review(0).click();
    await held();
    await page.evaluate(() => window.fixtureAuthEvent('SIGNED_OUT')); controls.held.pop()(); controls.hold = false;
    await rows().nth(0).getByText('Sign-in changed.', { exact: false }).waitFor();
    assert.equal(await rows().nth(0).getByRole('heading', { name: 'Alex Example Sr.', exact: true }).count(), 0);
    result.checks.push({ width, case: 'Auth change drops pending response without clearing or replaying recovery' });
    // Removing gate unmounts subscribers/requests; old responses cannot restore a panel.
    controls.hold = true; await review(0).click(); await held();
    await page.evaluate(props => window.fixtureRender({ ...props, identityScope: null }), props);
    await page.getByRole('button', { name: 'Review recorded identity', exact: true }).first().waitFor({ state: 'detached' });
    controls.held.pop()(); controls.hold = false;
    assert.equal(await page.evaluate(() => window.fixtureSubscriptions()), 0);
    assert.equal(await page.getByRole('heading', { name: 'Alex Example Sr.', exact: true }).count(), 0);
    result.checks.push({ width, case: 'gate removal/unmount unsubscribes and drops delayed read' });
    await page.evaluate(props => window.fixtureRender(props), props); await review(0).waitFor();
    controls.hold = true; await review(0).click(); await held();
    await page.evaluate(({ props, actorId }) => window.fixtureRender({ ...props, actorId, identityScope: { ...props.identityScope, actorId } }), { props, actorId: id(99) });
    // A's first button is still Reading. A fresh Review button proves B committed,
    // unlike the listener count (which is two in both owners).
    await review(0).waitFor();
    assert.equal(await page.evaluate(() => window.fixtureSubscriptions()), 2);
    await page.evaluate(props => window.fixtureRender(props), props); await review(0).waitFor();
    controls.held.pop()(); controls.hold = false;
    assert.equal(await page.getByRole('heading', { name: 'Alex Example Sr.', exact: true }).count(), 0);
    result.checks.push({ width, case: 'actor context ABA remount does not accept an old owner response' });
    // Reload never recovers/guesses identity automatically and makes no writer call.
    const readsBefore = controls.requests.length; await page.reload(); await review(0).waitFor(); assert.equal(controls.requests.length, readsBefore);
    controls.access = { ...scope, sessionId: id(99) }; await review(0).click(); await rows().nth(0).getByText('Recorded identity is unavailable or needs binding review.', { exact: false }).waitFor(); controls.access = scope;
    result.checks.push({ width, case: 'reload has no auto request; foreign session rejected by existing handler' });
    assert.equal(controls.writes.length, 0); assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await context.close(); controls.requests = []; controls.rpc = [];
  }
  result.passed = true;
} catch (error) { result.passed = false; result.error = String(error.stack ?? error); throw error; }
finally {
  controls.held.forEach(resolve => resolve());
  if (browser) { await browser.close(); result.cleanup.browserClosed = true; }
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); result.cleanup.serverClosed = true; result.cleanup.listening = server.listening; }
  fs.writeFileSync(path.resolve('../BROWSER_RESULT.json'), JSON.stringify(result, null, 2));
}

