// Disposable local browser diagnosis only. Never connects to Supabase/Vercel.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import ts from 'typescript';
import { chromium } from 'playwright-core';

const queueSource = await fs.readFile('src/lib/offline-score-queue.ts', 'utf8');
const cacheSource = await fs.readFile('src/lib/offline-score-page-cache.ts', 'utf8');
const clearSource = queueSource.match(/export function clearOfflineScoreStorage\([^\n]*\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(clearSource, 'Extract exact production clear function');
const compiled = ts.transpileModule(`${cacheSource.replace(/^import .*$/gm, "")}\n// This low-level deletion test does not invoke cache preparation writers.\nconst trackAppRecoveryWrite=async operation=>operation();\nconst databaseName='acc-offline-score-v1';\nlet offlineClearInFlight=null;\n${clearSource}\nwindow.clearOfflineScoreStorage=clearOfflineScoreStorage;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const server = http.createServer((req, res) => {
  assert.ok(req.url === '/' || req.url === '/clear.js' || req.url === '/favicon.ico');
  res.setHeader('Content-Type', req.url === '/clear.js' ? 'text/javascript' : 'text/html');
  res.end(req.url === '/clear.js' ? compiled : '<!doctype html><title>Disposable sign-out diagnosis</title><script type="module" src="/clear.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const holder = await context.newPage(); const worker = await context.newPage();
  await holder.goto(origin); await worker.goto(origin);
  await worker.waitForFunction(() => typeof window.clearOfflineScoreStorage === 'function');
  await holder.evaluate(async () => {
    window.held = await new Promise((resolve, reject) => {
      const r = indexedDB.open('acc-offline-score-v1', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('queue');
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  });
  await worker.evaluate(() => {
    window.stages=[];window.finished=false;
    window.first=window.clearOfflineScoreStorage(s=>window.stages.push(s));
    window.second=window.clearOfflineScoreStorage();
    window.same=window.first===window.second;
    window.first.then(()=>window.finished=true);
  });
  await worker.waitForFunction(()=>window.stages.includes('offline-database-blocked'));
  assert.deepEqual(await worker.evaluate(()=>({same:window.same,finished:window.finished})),{same:true,finished:false});
  await holder.evaluate(() => window.held.close());
  await worker.waitForFunction(()=>window.finished);
  assert.deepEqual(await worker.evaluate(()=>window.stages),['offline-database','offline-database-blocked','offline-cache']);
  console.log('PASS: real blocked deletion remains pending, duplicate calls share one promise, late completion advances once.');

  const cacheFailure = await worker.evaluate(async () => {
    const original = caches.keys.bind(caches);
    caches.keys = async () => { throw new DOMException('Synthetic cache denial', 'SecurityError'); };
    let outcome;
    try { await window.clearOfflineScoreStorage(); outcome = 'unexpected success'; }
    catch (e) { outcome = e.name; }
    finally { caches.keys = original; }
    return outcome;
  });
  assert.equal(cacheFailure, 'SecurityError');
  console.log('PASS: cache enumeration can fail after IndexedDB deletion, before sessionStorage clearing or server sign-out.');

  const settledError = await worker.evaluate(async () => {
    const original=indexedDB.deleteDatabase.bind(indexedDB);
    const stages=[];let request;
    indexedDB.deleteDatabase=()=>{request={};queueMicrotask(()=>{request.onblocked();queueMicrotask(()=>request.onerror());});return request;};
    try { await window.clearOfflineScoreStorage(s=>stages.push(s)); throw Error('unexpected success'); }
    catch(e) { return {stages,error:e.message}; }
    finally { indexedDB.deleteDatabase=original; }
  });
  assert.deepEqual(settledError,{stages:['offline-database','offline-database-blocked','offline-database'],error:'offline_storage_unavailable'});
  await worker.evaluate(()=>window.clearOfflineScoreStorage());
  console.log('PASS: injected blocked-then-error settles as database failure, and a subsequent settled retry succeeds.');
  console.log('LIMIT: local reproduction establishes possible causes, not the actual hosted cause; no hosted storage/session touched.');
  await context.close();
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
