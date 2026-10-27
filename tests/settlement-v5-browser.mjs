// Synthetic local component acceptance only; all API writes are intercepted.
// Run: node tests/settlement-v5-browser.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const root=process.cwd(), dir=path.join(root,'test-results/settlement-v5-browser');
const workspace=JSON.parse(await fs.readFile('tests/fixtures/settlement-v5-browser-workspace.json','utf8'));
await fs.mkdir(path.join(dir,'app'),{recursive:true});
await fs.writeFile(path.join(dir,'package.json'),'{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir,'next.config.mjs'),`export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.writeFile(path.join(dir,'app/layout.tsx'),`import '../../../src/app/globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}`);
await fs.writeFile(path.join(dir,'app/page.tsx'),`import Client from '../../../src/app/tournament/[tournamentId]/events/[eventId]/settlement-v5/settlement-v5-client';export default function Page(){return <main className="auth-shell"><section className="auth-card corrections-card"><p>TEST ONLY LOCAL MOCK — no backend or account</p><Client actorId="40000000-0000-4000-8000-000000000001" tournamentId="${workspace.tournamentId}" eventId="${workspace.eventId}" workspace={${JSON.stringify(workspace)}}/></section></main>}`);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',dir,'--hostname','127.0.0.1','--port','3229'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let logs='',browser;child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
try {
 console.log('Waiting for synthetic localhost server');
 const deadline=Date.now()+20000;let ready=false;
 while(Date.now()<deadline){try{if((await fetch('http://127.0.0.1:3229',{signal:AbortSignal.timeout(1500)})).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500));}
 assert.ok(ready,'Synthetic localhost server must serve successfully');
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();let writes=[], mode='abort';
 await page.route('**/api/**',async route=>{
  if(route.request().url().endsWith('/reconciliation'))return route.fulfill({json:{authorized:true,result:null}});
  writes.push({key:route.request().headers()['x-idempotency-key'],body:route.request().postData()});
  if(mode==='abort')return route.abort();
  if(mode==='reject')return route.fulfill({status:409,json:{status:'rejected',eventId:workspace.eventId,code:'sanctioning_assessment_unfunded'}});
  return route.fulfill({json:{status:'settlement_draft_saved_v5',tournamentId:workspace.tournamentId,eventId:workspace.eventId,draftId:workspace.draft.draftId,version:4}});
 });
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:3229');
  await page.getByRole('heading',{name:'Versioned settlement review'}).waitFor();
  await page.getByRole('heading',{name:'Canonical MRP evidence'}).waitFor();
  assert.ok(await page.getByText('sanctioning assessment unfunded',{exact:false}).count());
  for(const box of await page.getByRole('checkbox').all())await box.check();
  assert.equal(await page.getByRole('button',{name:'Record reviewed manual finalization',exact:true}).isDisabled(),true,'Unfunded assessment must block even fully attested review');
  await page.screenshot({path:`test-results/settlement-v5-${width}.png`,fullPage:true});
  const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,items:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,90),width:e.getBoundingClientRect().width})).slice(0,15)}));
  console.log(JSON.stringify(overflow));assert.ok(overflow.scroll<=overflow.width+1,'No page-level horizontal overflow');
  await page.reload();await page.getByRole('heading',{name:'Versioned settlement review'}).waitFor();
 }
 assert.equal(writes.length,0,'Read-only rendering/refresh must not issue API writes');
 await page.getByRole('button',{name:'Add reviewed prize claim',exact:true}).click();
 await page.getByRole('button',{name:'Save reviewed draft',exact:true}).click();
 await page.getByText('Review the required fields before saving.',{exact:true}).waitFor();assert.equal(writes.length,0,'Invalid claim must not write');
 await page.getByLabel('Qualifier participant ID',{exact:true}).fill(workspace.draft.canonicalMrp.rows[0].participantId);
 await page.getByLabel('Claim amount (USD cents)',{exact:true}).fill('100');
 await page.getByLabel('Reviewed claim note',{exact:true}).fill('TEST ONLY explicit claim; no payout policy');
 assert.equal(await page.getByLabel('Optional prize order',{exact:true}).inputValue(),'','No third/fourth order is inferred');
 await page.getByRole('button',{name:'Save reviewed draft',exact:true}).dblclick();
 await page.getByText('The outcome is uncertain. The exact request remains saved for retry.',{exact:true}).waitFor();
 assert.equal(writes.length,1,'Double click must create one request');
 const first=writes[0];
 await page.reload();await page.getByText('No completed receipt is available yet. The exact request is retained and can be retried safely.',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Claim amount (USD cents)',{exact:true}).inputValue(),'100');
 assert.equal(await page.getByLabel('Claim amount (USD cents)',{exact:true}).isDisabled(),true,'Pending intent is locked');
 mode='reject';await page.getByRole('button',{name:'Retry exact draft request',exact:true}).click();
 await page.getByText('The operation was rejected (sanctioning_assessment_unfunded). Review the current evidence.',{exact:true}).waitFor();
 assert.deepEqual(writes[1],first,'Retry preserves exact original key/body');
 assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('settlement-v5:')).length),0,'Conclusive rejection clears only this retained operation');
 mode='success';await page.getByRole('button',{name:'Save reviewed draft',exact:true}).click();
 await page.getByText('The operation was recorded. Reloading authoritative evidence.',{exact:true}).waitFor();
 assert.notEqual(writes[2].key,first.key,'New request only after conclusive result');
 assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('settlement-v5:')).length),0);
 console.log('PASS: phone/desktop evidence+layout+refresh; unfunded review blocked; no inferred prize order; invalid claim/no write; double-click one request; interrupted reload retains/locks intent; exact retry; rejection cleanup; new-key success cleanup. All API responses mocked, no backend writes.');
}finally{await browser?.close();child.kill();await fs.writeFile('test-results/settlement-v5-browser-server.log',logs);}
