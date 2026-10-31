// Read-only rendering of an ACTUAL disposable SQL response. No browser POST,
// hosted service, new fixture, credential, or live database connection is used.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { isNoQAccountingWorkspace } from '../src/lib/api/no-q-accounting-v7.ts';
import { makeSeventeenMainFixture } from './fixtures/seventeen-main-foundation.mjs';
const root=process.cwd(),artifact='test-results/no-q-seventeen-main-sql-result.json',bytes=await fs.readFile(artifact),evidence=JSON.parse(bytes.toString('utf8'));
assert.equal(evidence.status,'PASS');const workspace=evidence.accounting.workspace,fixture=makeSeventeenMainFixture({withQ:false});
assert.equal(workspace.tournamentId,fixture.tid);assert.equal(workspace.eventId,fixture.eid);
assert.equal(isNoQAccountingWorkspace(workspace,fixture.tid,fixture.eid),true);assert.equal(workspace.finalization.status,'unpaid');assert.equal(workspace.finalization.current,true);
assert.equal(workspace.facts.baseIncomeMinor,51000);assert.equal(workspace.facts.expenseTotalMinor,22950);assert.equal(workspace.facts.regularAwardMinor,28050);assert.equal(workspace.facts.minimumReturnMinor,43350);assert.equal(workspace.draft.facts.participantReturnMinor,43350);
assert.deepEqual(workspace.regularSchedule.awards.map(a=>a.totalAwardMinor).sort((a,b)=>b-a),[9351,7012,4675,4675,2337]);
const dir=path.join(root,'test-results/no-q-accounting-v7-real-sql-browser'),origin='http://127.0.0.1:3255';
await fs.mkdir(path.join(dir,'app','review'),{recursive:true});await fs.mkdir(path.join(dir,'public'),{recursive:true});
await fs.writeFile(path.join(dir,'package.json'),'{"private":true,"type":"module"}');await fs.writeFile(path.join(dir,'next.config.mjs'),`export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.writeFile('test-results/no-q-accounting-v7-real-sql-browser-workspace.json',JSON.stringify(workspace,null,2));
await fs.copyFile('public/offline-score-sw.js',path.join(dir,'public/offline-score-sw.js'));
await fs.writeFile(path.join(dir,'app/layout.tsx'),`import '../../../src/app/globals.css';import {RecoveryDocumentBoundary}from'../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return <html><body><RecoveryDocumentBoundary actorId="${fixture.actor}">{children}</RecoveryDocumentBoundary></body></html>}`);
await fs.writeFile(path.join(dir,'app/review/page.tsx'),`import Client from'../../../../src/app/tournament/[tournamentId]/events/[eventId]/no-q-accounting-v7/accounting-client';const workspace=${JSON.stringify(workspace)} as import('../../../../src/lib/api/no-q-accounting-v7').NoQAccountingWorkspace;export default function Page(){return <main className="auth-shell"><section className="auth-card corrections-card"><h1>TEST ONLY actual local SQL response</h1><Client actorId="${fixture.actor}" tournamentId="${fixture.tid}" eventId="${fixture.eid}" initialWorkspace={workspace}/></section></main>}`);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',dir,'--hostname','127.0.0.1','--port','3255'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let logs='',browser,page;const checks=[],requests=[],attemptedWrites=[];child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
await fs.writeFile('test-results/no-q-accounting-v7-real-sql-browser-process.json',JSON.stringify({pid:child.pid,origin}));
try{
 let ready=false;for(let until=Date.now()+180000;Date.now()<until;){try{if((await fetch(origin+'/review',{signal:AbortSignal.timeout(20000)})).ok){ready=true;break;}}catch(e){if(['EACCES','EPERM'].includes(e.cause?.code))throw e;}await new Promise(r=>setTimeout(r,300));}assert.ok(ready,'local read-only test page readiness');
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of[390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}});page=await context.newPage();page.on('request',req=>{if(!['GET','HEAD','OPTIONS'].includes(req.method()))attemptedWrites.push({method:req.method(),url:req.url()});});
  await page.route('**/*',route=>route.request().url().startsWith(origin)||/^(data:|blob:)/.test(route.request().url())?route.continue():route.abort());
  await page.route('**/api/v1/tournaments/**/no-q-accounting-v7**',async route=>{
   const req=route.request();requests.push({method:req.method(),url:req.url()});
   if(req.method()!=='GET')return route.abort();
   return route.fulfill({json:workspace});
  });
  await page.goto(origin+'/review');await page.getByRole('heading',{name:'Unpaid accounting review',exact:true}).waitFor();await page.getByRole('status').filter({hasText:'Review current unpaid accounting sources.'}).waitFor();
  await page.getByRole('button',{name:'Refresh accounting sources',exact:true}).click();await page.getByRole('status').filter({hasText:'Current accounting sources refreshed.'}).waitFor();
  assert.equal(await page.getByText('$510.00',{exact:true}).count(),2);await page.getByText('$229.50',{exact:true}).waitFor();await page.getByText('$280.50',{exact:true}).waitFor();assert.equal(await page.getByText('$433.50',{exact:true}).count(),2);
  assert.equal(await page.getByText(/\$93\.51.*finishing band 1/).count(),1);assert.equal(await page.getByText(/\$70\.12.*finishing band 2/).count(),1);assert.equal(await page.getByText(/\$46\.75.*finishing band 3[-–]4/).count(),2);assert.equal(await page.getByText(/\$23\.37.*finishing band 5/).count(),1);
  await page.getByText(/^Accounting finalized.*unpaid\.$/).waitFor();assert.ok(await page.getByRole('button',{name:'Record unpaid accounting draft',exact:true}).isDisabled());assert.ok(await page.getByRole('button',{name:'Finalize unpaid accounting',exact:true}).isDisabled());
  assert.equal(await page.getByRole('heading',{name:'Reviewed Q obligations - unpaid'}).count(),0);assert.doesNotMatch(await page.locator('body').innerText(),/USD cents|US cents/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`test-results/no-q-accounting-v7-real-sql-${width}.png`,fullPage:true});checks.push(`actual SQL v7 response -> strict DTO -> read-only React/GET refresh ${width}: exact85% boundary,5 dollar awards,unpaid final,zero writes`);await context.close();
 }
 assert.equal(requests.length,2);assert.ok(requests.every(r=>r.method==='GET'));assert.equal(attemptedWrites.length,0);
 const result={status:'PASS',inputArtifact:artifact,inputArtifactSha256:crypto.createHash('sha256').update(bytes).digest('hex'),workspaceSha256:crypto.createHash('sha256').update(JSON.stringify(workspace)).digest('hex'),sourceDigest:workspace.sourceDigest,checks,getRequests:requests.length,postRequests:attemptedWrites.length,inputWorkspaceSnapshot:'test-results/no-q-accounting-v7-real-sql-browser-workspace.json',limitation:'Actual disposable SQL response rendered through strict app DTO and intercepted local GET; not a live authenticated browser-to-database connection.'};
 await fs.writeFile('test-results/no-q-accounting-v7-real-sql-browser-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(e){if(page){await fs.writeFile('test-results/no-q-accounting-v7-real-sql-browser-failure.txt',await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:'test-results/no-q-accounting-v7-real-sql-browser-failure.png',fullPage:true}).catch(()=>{});}throw e;}
finally{await browser?.close();child.kill();await fs.writeFile('test-results/no-q-accounting-v7-real-sql-browser-server.log',logs);}
