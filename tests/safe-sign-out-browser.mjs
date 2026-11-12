// Real production component, disposable localhost origin, mocked sign-out HTTP.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const root=process.cwd(),dir=path.join(root,'test-results/safe-sign-out-browser');
await fs.mkdir(path.join(dir,'app/sign-in'),{recursive:true});
await fs.writeFile(path.join(dir,'package.json'),'{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir,'next.config.mjs'),`export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.mkdir(path.join(dir,'public'),{recursive:true});await fs.copyFile('public/offline-score-sw.js',path.join(dir,'public/offline-score-sw.js'));
await fs.writeFile(path.join(dir,'app/layout.tsx'),`import '../../../src/app/globals.css';import {RecoveryDocumentBoundary} from '../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return <html><body><RecoveryDocumentBoundary actorId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa">{children}</RecoveryDocumentBoundary></body></html>}`);
await fs.writeFile(path.join(dir,'app/page.tsx'),`import {SharedDeviceSignOut} from '../../../src/components/shared-device-sign-out';export default function Page(){return <main><h1>Disposable switch regression</h1><SharedDeviceSignOut/></main>}`);
await fs.writeFile(path.join(dir,'app/sign-in/page.tsx'),`export default function Page(){return <h1>Mock sign-in destination</h1>}`);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',dir,'--hostname','127.0.0.1','--port','3235'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let logs='',browser;child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
const origin='http://127.0.0.1:3235';
async function createContext(options){const context=await browser.newContext(options);await context.route('**/auth/sign-out-state',r=>r.fulfill({status:200,json:{status:'signed_out'}}));return context}
try {
  let ready=false;for(let until=Date.now()+45000;Date.now()<until;){try{if((await fetch(origin,{signal:AbortSignal.timeout(1500)})).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,300));}assert.ok(ready,'localhost ready');
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const width of [390,1440]) {
    const context=await createContext({viewport:{width,height:1000}});const page=await context.newPage();let posts=0;
    await page.route('**/auth/sign-out',async r=>{posts++;await new Promise(resolve=>setTimeout(resolve,100));await r.fulfill({status:200,json:{status:'signed_out'}})});
    await page.goto(origin);const clear=page.getByRole('button',{name:'Clear safe app data and sign out',exact:true});await clear.waitFor();
    await clear.dblclick();await page.getByRole('heading',{name:'Mock sign-in destination'}).waitFor();assert.equal(posts,1);
    await context.close();console.log(`PASS ${width}px: double action signs out once only`);
  }
  {
    const context=await createContext();const page=await context.newPage(),holder=await context.newPage();let posts=0;
    await page.route('**/auth/sign-out',async r=>{posts++;await r.fulfill({status:200,json:{status:'signed_out'}})});
    await page.goto(origin);await page.getByRole('button',{name:'Clear safe app data and sign out',exact:true}).waitFor();await holder.goto(origin);
    await holder.evaluate(async()=>{window.held=await new Promise((resolve,reject)=>{const r=indexedDB.open('acc-offline-score-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});});
    await holder.getByRole('heading',{name:'Disposable switch regression'}).waitFor();
    await page.getByRole('button',{name:'Clear safe app data and sign out',exact:true}).click();await page.locator('.shared-device-sign-out [role=alert]').waitFor();
    assert.equal(posts,0);assert.ok(await holder.evaluate(()=>window.held.objectStoreNames.length)>0);
    await holder.close();
    await page.waitForFunction(async()=>{const locks=await navigator.locks.query();return locks.held.filter(x=>x.name==='acc-recovery-document-v2').length===1});
    await page.waitForFunction(async()=>{const result=await new Promise(resolve=>{const c=new MessageChannel(),requestId=crypto.randomUUID();c.port1.onmessage=e=>{c.port1.close();resolve(e.data)};navigator.serviceWorker.controller.postMessage({kind:'acc-recovery-window-inventory-v2',version:'acc-recovery-coordination-v2',requestId},[c.port2])});return result.status==='ok'&&result.otherWindows===0},{},{timeout:10000});
    await page.getByRole('button',{name:'Clear safe app data and sign out',exact:true}).click();await page.getByRole('heading',{name:'Mock sign-in destination'}).waitFor({timeout:15000}).catch(async e=>{console.log('SWITCH_RETRY_DIAGNOSTIC',await page.locator('body').innerText(),await context.serviceWorkers()[0].evaluate(async()=> (await self.clients.matchAll({type:'window',includeUncontrolled:true})).map(c=>({id:c.id,path:new URL(c.url).pathname,frameType:c.frameType}))));throw e});assert.equal(posts,1);
    await context.close();console.log('PASS actual component: other tab blocks before deletion; explicit retry after close signs out once');
  }
  for(const failure of ['cache','storage','cookie','server','interrupted','recovery','malformed','state']) {
    const context=await createContext();const page=await context.newPage();let posts=0;

    await context.addInitScript(()=>{document.cookie='acc_recovery_owner_v1=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa; Path=/; SameSite=Lax'});
    if(failure==='recovery')await context.addInitScript(()=>{const key='payment-operation:synthetic-test';sessionStorage.setItem(key,'synthetic retained work');});
    await page.route('**/auth/sign-out',async r=>{posts++;if(failure==='interrupted')return r.abort();if(failure==='malformed')return r.fulfill({status:200,json:{}});if(failure==='state')return r.fulfill({status:200,json:{status:'signed_out'}});await r.fulfill({status:503,json:{error:'sign_out_unavailable'}})});
    await page.goto(origin);await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
    if(failure==='state')await page.route('**/auth/sign-out-state',r=>r.fulfill({status:200,json:{status:'unconfirmed'}}));
    if(failure==='storage')await page.evaluate(()=>{const original=indexedDB.deleteDatabase.bind(indexedDB);indexedDB.deleteDatabase=name=>{const request=original(name);request.addEventListener('success',()=>Object.defineProperty(Storage.prototype,'length',{configurable:true,get(){throw new DOMException('fictional storage failure','SecurityError')}}));return request}});
    if(failure==='cookie')await page.evaluate(()=>{const descriptor=Object.getOwnPropertyDescriptor(Document.prototype,'cookie');Object.defineProperty(document,'cookie',{configurable:true,get(){return descriptor.get.call(document)},set(value){if(!String(value).includes('Max-Age=0'))descriptor.set.call(document,value)}})});
    if(failure==='cache')await page.evaluate(()=>{caches.keys=async()=>{throw new DOMException('synthetic','SecurityError')}});
    if(failure==='recovery'){await page.getByText('1 retry record is',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Clear safe app data and sign out',exact:true}).count(),0);assert.equal(await page.evaluate(()=>sessionStorage.getItem('payment-operation:synthetic-test')),'synthetic retained work');}
    else {await page.getByRole('button',{name:'Clear safe app data and sign out',exact:true}).click();await page.locator('.shared-device-sign-out [role=alert]').filter({hasText:failure==='cache'?'Offline page-cache clearing failed':['storage','cookie'].includes(failure)?'Retry-record clearing failed':'server sign-out could not be confirmed'}).waitFor();}
    assert.equal(posts,['cache','storage','cookie','recovery'].includes(failure)?0:1);if(failure!=='recovery')assert.equal(await page.evaluate(async()=>(await navigator.locks.query()).held.filter(lock=>lock.name==='acc-recovery-document-v2'&&lock.mode==='exclusive').length),1);await context.close();console.log(`PASS actual component: ${failure} fails closed with exact stage, no extra POST`);
  }
  {
    const context=await createContext();const page=await context.newPage();let posts=0,checks=0;
    await page.route('**/auth/sign-out',async r=>{posts++;await r.abort()});
    await page.route('**/auth/sign-out-state',async r=>{checks++;await r.fulfill({status:200,json:{status:'signed_out'}})});
    await page.goto(origin);await page.getByRole('button',{name:'Clear safe app data and sign out',exact:true}).click();await page.locator('.shared-device-sign-out [role=alert]').waitFor();
    await page.getByRole('button',{name:'Clear safe app data and sign out',exact:true}).click();await page.getByRole('heading',{name:'Mock sign-in destination'}).waitFor();assert.equal(posts,1);assert.equal(checks,1);await context.close();console.log('PASS uncertain sign-out retry reconciles instead of repeating mutation');
  }
  {
    const context=await createContext();const page=await context.newPage();let posts=0;
    await context.addInitScript(()=>{document.cookie='acc_recovery_owner_v1=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa; Path=/; SameSite=Lax';sessionStorage.setItem('payment-operation:fixture','fictional retained bytes')});
    await page.route('**/auth/sign-out',async r=>{posts++;await r.fulfill({status:200,json:{status:'signed_out'}})});
    await page.goto(origin);await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('heading',{name:'Mock sign-in destination'}).waitFor();assert.equal(posts,1);assert.equal(await page.evaluate(()=>sessionStorage.getItem('payment-operation:fixture')),'fictional retained bytes');await context.close();console.log('PASS ordinary same-account sign-out preserves retained recovery bytes');
  }
  console.log('PASS: component browser regression; mock HTTP only, no hosted requests or credentials.');
} finally {await browser?.close();child.kill();await fs.writeFile('test-results/safe-sign-out-browser-server.log',logs);}
