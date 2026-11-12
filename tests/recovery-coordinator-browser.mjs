// Phase A browser protocol proof only. Generated assets live under ignored
// test-results; no production coordinator or service worker is imported.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd();
const assetDir = path.join(root, "test-results", "recovery-coordinator-browser");
await fs.mkdir(assetDir, { recursive: true });

const workerSource = String.raw`
const VERSION="acc-recovery-coordination-v2",LOCK="acc-recovery-document-v2",SCRIPT_PATH="/recovery-protocol-sw.js";
let pendingBridges=0,acknowledgedBridges=0,completedBridges=0,lastBridgeReply=null;
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitForClient(id){
  for(let attempt=0;attempt<40;attempt+=1){const client=id?await self.clients.get(id):null;if(client)return client;await delay(50)}
  return null;
}
async function bridgeDocumentLease(clientId,bridgeId,replyTimeout=2500){
  const client=await waitForClient(clientId);if(!client)throw new Error("recovery_bridge_client_unavailable");
  pendingBridges+=1;
  try{
    for(let attempt=0;attempt<3;attempt+=1){
      const channel=new MessageChannel();
      const reply=new Promise(resolve=>{const timer=setTimeout(()=>{channel.port1.close();resolve(null)},replyTimeout);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data)}});
      client.postMessage({kind:"acc-recovery-navigation-lease-v2",version:VERSION,bridgeId,workerScriptURL:self.location.origin+SCRIPT_PATH},[channel.port2]);
      const message=await reply;lastBridgeReply=message&&typeof message==="object"?{kind:message.kind,version:message.version,bridgeIdMatches:message.bridgeId===bridgeId,controllerScriptURL:message.controllerScriptURL}:null;
      if(message&&message.kind==="acc-recovery-navigation-lease-ready-v2"&&message.version===VERSION&&message.bridgeId===bridgeId&&message.controllerScriptURL===self.location.origin+SCRIPT_PATH){acknowledgedBridges+=1;return}
    }
    throw new Error("recovery_bridge_ack_unavailable");
  }finally{pendingBridges-=1;completedBridges+=1}
}
async function inspectClient(client){
  const requestId=crypto.randomUUID(),channel=new MessageChannel();
  const reply=new Promise(resolve=>{const timer=setTimeout(()=>{channel.port1.close();resolve(null)},350);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data)}});
  client.postMessage({kind:"acc-recovery-lease-challenge-v2",version:VERSION,requestId},[channel.port2]);
  const message=await reply;
  return Boolean(message&&message.kind==="acc-recovery-lease-status-v2"&&message.version===VERSION&&message.requestId===requestId&&message.state==="lease_ready"&&message.controllerScriptURL===self.location.origin+SCRIPT_PATH);
}
self.addEventListener("message",event=>{
  const data=event.data,port=event.ports[0];if(!data||!port||!event.source||!event.source.id)return;
  if(data.kind==="acc-recovery-window-inventory-v2"){
    event.waitUntil((async()=>{
      if(data.version!==VERSION){port.postMessage({kind:data.kind,version:VERSION,requestId:data.requestId,status:"unsupported_version"});return}
      const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
      if(!windows.some(client=>client.id===event.source.id)){port.postMessage({kind:data.kind,version:VERSION,requestId:data.requestId,status:"unknown_requester"});return}
      const others=windows.filter(client=>client.id!==event.source.id),statuses=await Promise.all(others.map(inspectClient));
      const leaseReadyOther=statuses.filter(Boolean).length;
      port.postMessage({kind:data.kind,version:VERSION,requestId:data.requestId,status:"ok",otherWindows:others.length,leaseReadyOther,legacyOther:others.length-leaseReadyOther});
    })());return;
  }
  if(data.kind==="acc-recovery-protocol-probe-v2"){
    port.postMessage({kind:"acc-recovery-protocol-ready-v2",version:VERSION,requestId:data.requestId,workerScriptURL:self.location.origin+SCRIPT_PATH});return;
  }
  if(data.kind==="acc-recovery-debug-v2")event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});port.postMessage({version:VERSION,pendingBridges,acknowledgedBridges,completedBridges,lastBridgeReply,windows:windows.length})})());
});
self.addEventListener("fetch",event=>{
  if(event.request.mode!=="navigate"||new URL(event.request.url).origin!==self.location.origin)return;
  if(!self.navigator.locks){event.respondWith(Promise.resolve(new Response("Recovery coordination unavailable",{status:503})));return}
  let resolveResponse,rejectResponse;
  const response=new Promise((resolve,reject)=>{resolveResponse=resolve;rejectResponse=reject}),bridgeId=crypto.randomUUID();
  const lease=self.navigator.locks.request(LOCK,{mode:"shared"},async()=>{
    try{resolveResponse(await fetch(event.request));const url=new URL(event.request.url);await bridgeDocumentLease(event.resultingClientId,bridgeId,url.searchParams.has("shortBridgeTimeout")?50:2500)}catch(error){rejectResponse(error);throw error}
  });
  void lease.catch(rejectResponse);
  event.respondWith(response);event.waitUntil(lease);
});
`;

const appScript = String.raw`
(()=>{
const VERSION="acc-recovery-coordination-v2",LOCK="acc-recovery-document-v2",SCRIPT_URL=location.origin+"/recovery-protocol-sw.js";
const leaseDelay=Number(new URLSearchParams(location.search).get("leaseDelay")||0);
let state="booting",sharedTask=null,sharedAcquire=null,releaseShared=null,exclusiveTask=null,releaseExclusive=null;
const writers=new Map(),transitions=[state],protocolTrace=[];
const setState=next=>{state=next;transitions.push(next);document.body.dataset.state=next};
const controller=()=>navigator.serviceWorker.controller;
function assertController(expected){const current=controller();if(!current||current!==expected||current.state!=="activated"||current.scriptURL!==SCRIPT_URL)throw new Error("recovery_controller_changed_or_unknown")}
function assertWriteAllowed(){if(state!=="lease_ready"||!releaseShared)throw new Error("recovery_write_barrier_closed")}
async function verifyControllerProtocol(){
  const expected=controller();assertController(expected);const channel=new MessageChannel(),requestId=crypto.randomUUID();
  const response=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{channel.port1.close();reject(new Error("recovery_protocol_unavailable"))},750);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data)}});
  expected.postMessage({kind:"acc-recovery-protocol-probe-v2",version:VERSION,requestId},[channel.port2]);
  const result=await response;assertController(expected);
  if(!result||result.kind!=="acc-recovery-protocol-ready-v2"||result.version!==VERSION||result.requestId!==requestId||result.workerScriptURL!==SCRIPT_URL)throw new Error("recovery_protocol_unavailable");
  return expected;
}
async function acquireShared(){
  if(!navigator.locks||!navigator.serviceWorker){setState("unsupported");throw new Error("recovery_coordination_unavailable")}
  if(releaseShared)return;
  if(sharedAcquire)return sharedAcquire;
  let acquired,rejectAcquired;const ready=new Promise((resolve,reject)=>{acquired=resolve;rejectAcquired=reject});sharedAcquire=ready;
  try{await verifyControllerProtocol()}catch(error){setState("blocked_protocol");sharedAcquire=null;throw error}
  sharedTask=navigator.locks.request(LOCK,{mode:"shared"},async lock=>{if(!lock)throw new Error("recovery_document_lease_unavailable");await new Promise(resolve=>{releaseShared=resolve;setState("lease_ready");acquired()});releaseShared=null});
  void sharedTask.catch(error=>{setState("blocked_shared");rejectAcquired(error)});
  try{await ready}finally{sharedAcquire=null}
}
async function releaseDocumentLease(){const task=sharedTask,release=releaseShared;releaseShared=null;if(release)release();if(task)await task;sharedTask=null}
async function inventory(){
  const expected=controller();assertController(expected);const channel=new MessageChannel(),requestId=crypto.randomUUID();
  const response=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{channel.port1.close();reject(new Error("recovery_inventory_unavailable"))},2500);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data)}});
  expected.postMessage({kind:"acc-recovery-window-inventory-v2",version:VERSION,requestId},[channel.port2]);
  const result=await response;assertController(expected);
  if(!result||result.kind!=="acc-recovery-window-inventory-v2"||result.version!==VERSION||result.requestId!==requestId||result.status!=="ok"||!Number.isSafeInteger(result.otherWindows)||!Number.isSafeInteger(result.leaseReadyOther)||!Number.isSafeInteger(result.legacyOther)||result.otherWindows<0||result.leaseReadyOther<0||result.legacyOther<0||result.otherWindows!==result.leaseReadyOther+result.legacyOther)throw new Error("recovery_inventory_unavailable");
  return result;
}
function beginWriter(id){assertWriteAllowed();if(writers.has(id))throw new Error("duplicate_writer_id");let finish;const promise=new Promise(resolve=>{finish=resolve});writers.set(id,{promise,finish});return id}
function finishWriter(id){const writer=writers.get(id);if(!writer)throw new Error("unknown_writer_id");writers.delete(id);writer.finish()}
async function beginSwitch(options={}){
  if(state!=="lease_ready"||!releaseShared)throw new Error("recovery_coordination_unavailable");
  setState("draining");await Promise.all([...writers.values()].map(writer=>writer.promise));
  let expected;
  try{
    expected=controller();assertController(expected);const currentInventory=await inventory();
    if(currentInventory.otherWindows!==0){setState("lease_ready");throw new Error("other_tournament_tabs_or_unknown_inventory")}
    if(options.failVersionBeforeExclusive)throw new Error("recovery_version_changed_or_unknown");
    assertController(expected);
  }catch(error){if(state==="draining")setState("blocked_shared");throw error}
  setState("preflight_complete");if(options.pauseAfterPreflightMs)await new Promise(resolve=>setTimeout(resolve,options.pauseAfterPreflightMs));
  setState("switch_pending");await releaseDocumentLease();
  let resolveAcquired,rejectAcquired;const acquired=new Promise((resolve,reject)=>{resolveAcquired=resolve;rejectAcquired=reject});
  exclusiveTask=navigator.locks.request(LOCK,{mode:"exclusive",ifAvailable:true},async lock=>{
    if(!lock){resolveAcquired(false);return}
    await new Promise(resolve=>{releaseExclusive=resolve;setState("exclusive_held");resolveAcquired(true)});releaseExclusive=null;
  });
  void exclusiveTask.catch(rejectAcquired);
  let exclusiveAcquired;
  try{exclusiveAcquired=await acquired}catch(error){exclusiveTask=null;await acquireShared();throw error}
  if(!exclusiveAcquired){await exclusiveTask;exclusiveTask=null;await acquireShared();throw new Error("other_tournament_tabs_or_unknown_inventory")}
  try{
    assertController(expected);const exclusiveInventory=await inventory();
    if(exclusiveInventory.otherWindows!==0)throw new Error("other_tournament_tabs_or_unknown_inventory");
    if(options.failAfterExclusive)throw new Error("synthetic_partial_failure");setState("switched_locked");return{status:"exclusive_held",version:VERSION};
  }
  catch(error){setState("failed_locked");throw error}
}
async function releaseExclusiveForTest(){const release=releaseExclusive,task=exclusiveTask;releaseExclusive=null;if(release)release();if(task)await task;exclusiveTask=null;setState("released_for_test")}
async function workerDebug(){const expected=controller();assertController(expected);const channel=new MessageChannel(),result=new Promise(resolve=>{channel.port1.onmessage=event=>resolve(event.data)});expected.postMessage({kind:"acc-recovery-debug-v2"},[channel.port2]);return result}
navigator.serviceWorker.addEventListener("message",event=>{
  const data=event.data,port=event.ports[0];if(!data||!port)return;
  protocolTrace.push({kind:data.kind,version:data.version,sourceScriptURL:event.source&&event.source.scriptURL,controllerScriptURL:controller()&&controller().scriptURL,sourceIdentityMatches:event.source===controller()});
  if(data.kind==="acc-recovery-navigation-lease-v2"){
    void(async()=>{const expected=controller();if(event.source!==expected||data.version!==VERSION||data.workerScriptURL!==SCRIPT_URL)return;if(leaseDelay>0)await new Promise(resolve=>setTimeout(resolve,leaseDelay));try{await acquireShared();assertController(expected);port.postMessage({kind:"acc-recovery-navigation-lease-ready-v2",version:VERSION,bridgeId:data.bridgeId,controllerScriptURL:expected.scriptURL})}catch{}})();return;
  }
  if(data.kind==="acc-recovery-lease-challenge-v2"){
    const current=controller();if(event.source!==current||data.version!==VERSION||!current||current.scriptURL!==SCRIPT_URL)return;
    port.postMessage({kind:"acc-recovery-lease-status-v2",version:VERSION,requestId:data.requestId,state,controllerScriptURL:current.scriptURL});
  }
});
window.recoveryHarness={version:VERSION,state:()=>state,transitions:()=>[...transitions],trace:()=>structuredClone(protocolTrace),acquireShared,inventory,beginWriter,finishWriter,beginSwitch,releaseExclusiveForTest,workerDebug,writeProbe:assertWriteAllowed,locks:()=>navigator.locks.query()};
if(!navigator.locks||!navigator.serviceWorker)setState("unsupported");else setTimeout(()=>{void acquireShared().catch(()=>{if(state!=="blocked_protocol"&&state!=="blocked_shared")setState("unsupported")})},leaseDelay);
})();
`;

const installHtml = `<!doctype html><meta charset="utf-8"><title>Install recovery protocol</title><body>install<script>
(async()=>{const registration=await navigator.serviceWorker.register('/recovery-protocol-sw.js',{scope:'/',updateViaCache:'none'});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));document.body.dataset.ready='true'})();
</script>`;
const appHtml = `<!doctype html><meta charset="utf-8"><title>Recovery protocol app</title><body data-state="loading"><h1>Recovery protocol app</h1><script>${appScript}</script>`;
const legacyHtml = `<!doctype html><meta charset="utf-8"><title>Legacy app</title><body><h1>Legacy window without lease protocol</h1>`;
const replacementWorker = `self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));`;

await Promise.all([
  fs.writeFile(path.join(assetDir, "recovery-protocol-sw.js"), workerSource),
  fs.writeFile(path.join(assetDir, "install.html"), installHtml),
  fs.writeFile(path.join(assetDir, "app.html"), appHtml),
  fs.writeFile(path.join(assetDir, "legacy.html"), legacyHtml),
  fs.writeFile(path.join(assetDir, "replacement-sw.js"), replacementWorker),
]);

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = pathname === "/recovery-protocol-sw.js" ? "recovery-protocol-sw.js"
    : pathname === "/replacement-sw.js" ? "replacement-sw.js"
    : pathname === "/install.html" ? "install.html"
      : pathname === "/legacy.html" ? "legacy.html" : "app.html";
  const content = await fs.readFile(path.join(assetDir, file));
  response.writeHead(200, {
    "content-type": file.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8",
    "cache-control": "no-store",
    "service-worker-allowed": "/",
  });
  response.end(content);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;
let browser;

async function install(context) {
  const page = await context.newPage();
  await page.goto(origin + "/install.html");
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  await page.close();
}
async function openApp(context, suffix = "") {
  const page = await context.newPage();
  await page.goto(origin + "/app.html" + suffix);
  await page.waitForFunction(() => window.recoveryHarness?.state() === "lease_ready");
  return page;
}

try {
  browser = await chromium.launch({ channel: "chrome", headless: true });

  {
    const context = await browser.newContext();
    await install(context);
    const page = await context.newPage();
    const navigation = page.goto(origin + "/app.html?leaseDelay=650");
    await page.waitForFunction(() => Boolean(window.recoveryHarness));
    const pending = await page.evaluate(async () => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const debug = await window.recoveryHarness.workerDebug();
        if (debug.pendingBridges === 1) return debug;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      return window.recoveryHarness.workerDebug();
    });
    assert.equal(pending.pendingBridges, 1, "worker navigation lease stays pending until document lease acknowledgement");
    await navigation;
    await page.waitForFunction(() => window.recoveryHarness.state() === "lease_ready");
    const bridged = await page.evaluate(async () => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const debug = await window.recoveryHarness.workerDebug();
        if (debug.acknowledgedBridges >= 1 && debug.pendingBridges === 0) return debug;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      return window.recoveryHarness.workerDebug();
    });
    if(bridged.acknowledgedBridges<1)console.error("BRIDGE_TRACE",JSON.stringify({worker:bridged,document:await page.evaluate(()=>window.recoveryHarness.trace())}));
    assert.ok(bridged.acknowledgedBridges >= 1);
    assert.equal(bridged.pendingBridges, 0);
    const lockState = await page.evaluate(() => window.recoveryHarness.locks());
    assert.equal(lockState.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "shared").length, 1);
    await context.close();
    console.log("PASS bridge: worker navigation lease hands off through a versioned ack and waitUntil to one document lease");
  }

  {
    const context = await browser.newContext();
    await install(context);
    const first = await openApp(context);
    const second = await openApp(context);
    let inventory = await first.evaluate(() => window.recoveryHarness.inventory());
    assert.deepEqual({ other: inventory.otherWindows, ready: inventory.leaseReadyOther, legacy: inventory.legacyOther }, { other: 1, ready: 1, legacy: 0 });
    await second.close();
    const legacy = await context.newPage();
    await legacy.goto(origin + "/legacy.html");
    const expiredBridge = await first.evaluate(async () => {
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const debug = await window.recoveryHarness.workerDebug();
        if (debug.pendingBridges === 0 && debug.completedBridges >= 1) return debug;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return window.recoveryHarness.workerDebug();
    });
    assert.equal(expiredBridge.pendingBridges, 0, "all three bridge acknowledgements timed out before inventory");
    inventory = await first.evaluate(() => window.recoveryHarness.inventory());
    assert.deepEqual({ other: inventory.otherWindows, ready: inventory.leaseReadyOther, legacy: inventory.legacyOther }, { other: 1, ready: 0, legacy: 1 });
    const rejection = await first.evaluate(() => window.recoveryHarness.beginSwitch().then(() => null, error => error.message));
    assert.equal(rejection, "other_tournament_tabs_or_unknown_inventory");
    assert.equal(await first.evaluate(() => window.recoveryHarness.state()), "lease_ready");
    await context.close();
    console.log("PASS inventory: cooperative and legacy no-lease windows are distinguished and both block switching");
  }

  {
    const context = await browser.newContext();
    await install(context);
    const page = await openApp(context);
    const switching = page.evaluate(() => window.recoveryHarness.beginSwitch({ pauseAfterPreflightMs: 600 }).then(() => null, error => error.message));
    await page.waitForFunction(() => window.recoveryHarness.state() === "preflight_complete");
    const lateLegacy = await context.newPage();
    await lateLegacy.goto(origin + "/legacy.html?shortBridgeTimeout=1");
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(await switching, "other_tournament_tabs_or_unknown_inventory");
    assert.equal(await page.evaluate(() => window.recoveryHarness.state()), "failed_locked");
    const locks = await page.evaluate(() => navigator.locks.query());
    assert.equal(locks.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "exclusive").length, 1);
    await page.evaluate(() => window.recoveryHarness.releaseExclusiveForTest());
    await context.close();
    console.log("PASS post-exclusive inventory: a legacy navigation after preflight is detected after bridge timeout while exclusive remains held");
  }

  {
    const context = await browser.newContext();
    await install(context);
    const page = await openApp(context);
    await page.evaluate(() => window.recoveryHarness.beginWriter("slow-write"));
    const switchPromise = page.evaluate(() => window.recoveryHarness.beginSwitch());
    await page.waitForFunction(() => window.recoveryHarness.state() === "draining");
    assert.equal(await page.evaluate(() => window.recoveryHarness.beginSwitch().then(() => null, error => error.message)), "recovery_coordination_unavailable");
    assert.equal(await page.evaluate(() => { try { window.recoveryHarness.beginWriter("late-write"); return "allowed"; } catch (error) { return error.message; } }), "recovery_write_barrier_closed");
    let locks = await page.evaluate(() => window.recoveryHarness.locks());
    assert.equal(locks.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "shared").length, 1);
    assert.equal(locks.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "exclusive").length, 0);
    await page.evaluate(() => window.recoveryHarness.finishWriter("slow-write"));
    assert.deepEqual(await switchPromise, { status: "exclusive_held", version: "acc-recovery-coordination-v2" });
    locks = await page.evaluate(() => window.recoveryHarness.locks());
    assert.equal(locks.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "exclusive").length, 1);
    assert.equal(await page.evaluate(() => window.recoveryHarness.state()), "switched_locked");
    await page.evaluate(() => window.recoveryHarness.releaseExclusiveForTest());
    await context.close();
    console.log("PASS drain: async writer finishes before shared release; late writers close and exclusive ownership follows");
  }

  {
    const context = await browser.newContext();
    await install(context);
    const page = await openApp(context);
    const failure = await page.evaluate(() => window.recoveryHarness.beginSwitch({ failAfterExclusive: true }).then(() => null, error => error.message));
    assert.equal(failure, "synthetic_partial_failure");
    assert.equal(await page.evaluate(() => window.recoveryHarness.state()), "failed_locked");
    assert.equal(await page.evaluate(() => { try { window.recoveryHarness.writeProbe(); return "allowed"; } catch (error) { return error.message; } }), "recovery_write_barrier_closed");
    const unavailable = await page.evaluate(() => navigator.locks.request("acc-recovery-document-v2", { mode: "shared", ifAvailable: true }, lock => lock === null));
    assert.equal(unavailable, true, "exclusive lease remains held after partial failure");
    await page.evaluate(() => window.recoveryHarness.releaseExclusiveForTest());
    await context.close();
    console.log("PASS partial failure: exclusive lease and closed writer barrier persist until explicit test cleanup");
  }

  {
    const context = await browser.newContext();
    await install(context);
    const page = await openApp(context);
    await page.evaluate(async () => {
      const prior = navigator.serviceWorker.controller;
      await navigator.serviceWorker.register("/replacement-sw.js", { scope: "/", updateViaCache: "none" });
      if (navigator.serviceWorker.controller === prior) await new Promise(resolve => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    });
    const mismatch = await page.evaluate(() => window.recoveryHarness.beginSwitch().then(() => null, error => error.message));
    assert.equal(mismatch, "recovery_controller_changed_or_unknown");
    assert.equal(await page.evaluate(() => window.recoveryHarness.state()), "blocked_shared");
    assert.equal(await page.evaluate(() => { try { window.recoveryHarness.writeProbe(); return "allowed"; } catch (error) { return error.message; } }), "recovery_write_barrier_closed");
    const locks = await page.evaluate(() => navigator.locks.query());
    assert.equal(locks.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "shared").length, 1);
    const fresh = await context.newPage();
    await fresh.goto(origin + "/app.html");
    await fresh.waitForFunction(() => window.recoveryHarness?.state() === "blocked_protocol");
    assert.equal(await fresh.evaluate(() => { try { window.recoveryHarness.writeProbe(); return "allowed"; } catch (error) { return error.message; } }), "recovery_write_barrier_closed");
    await context.close();
    console.log("PASS protocol handshake: an actual replacement controller blocks an existing document and a fresh page before writers become ready");
  }

  {
    const context = await browser.newContext();
    await install(context);
    const page = await openApp(context);
    await page.evaluate(() => {
      const request = navigator.locks.request.bind(navigator.locks);
      navigator.locks.request = (name, options, callback) => options?.mode === "exclusive" ? Promise.reject(new Error("synthetic_lock_request_rejected")) : request(name, options, callback);
    });
    const rejected = await page.evaluate(() => window.recoveryHarness.beginSwitch().then(() => null, error => error.message));
    assert.equal(rejected, "synthetic_lock_request_rejected");
    await page.waitForFunction(() => window.recoveryHarness.state() === "lease_ready");
    await context.close();
    console.log("PASS lock rejection: rejected exclusive request settles and reacquires the shared lease instead of hanging");
  }

  {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const request = navigator.locks.request.bind(navigator.locks);
      navigator.locks.request = (name, options, callback) => options?.mode === "shared" ? Promise.reject(new Error("synthetic_shared_lock_rejected")) : request(name, options, callback);
    });
    await install(context);
    const page = await context.newPage();
    await page.goto(origin + "/app.html");
    await page.waitForFunction(() => window.recoveryHarness?.state() === "blocked_shared");
    assert.equal(await page.evaluate(() => { try { window.recoveryHarness.writeProbe(); return "allowed"; } catch (error) { return error.message; } }), "recovery_write_barrier_closed");
    await context.close();
    console.log("PASS lock rejection: rejected shared request settles blocked instead of leaving readiness pending");
  }

  {
    const context = await browser.newContext();
    await context.addInitScript(() => { Object.defineProperty(navigator, "locks", { configurable: true, value: undefined }); });
    await install(context);
    const page = await context.newPage();
    await page.goto(origin + "/app.html");
    await page.waitForFunction(() => window.recoveryHarness?.state() === "unsupported");
    assert.equal(await page.evaluate(() => { try { window.recoveryHarness.writeProbe(); return "allowed"; } catch (error) { return error.message; } }), "recovery_write_barrier_closed");
    await context.close();
    console.log("PASS unsupported: missing document Web Locks fails closed before any application writer can start");
  }

  console.log("PASS recovery protocol harness: localhost only; synthetic assets; no hosted requests, credentials, or app edits");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
