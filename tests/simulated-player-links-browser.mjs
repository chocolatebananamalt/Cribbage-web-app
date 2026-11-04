// Real production components; fresh headless sessions; intercepted local-only API.
// SQL persistence/authority/races are verified by run-simulated-links-container.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {chromium} from 'playwright-core';
import {SIMULATED_LINK_TOURNAMENT as tid} from '../src/lib/api/simulated-player-links.ts';
const root=process.cwd(),dir=path.join(root,'test-results/simulated-link-browser'),origin='http://127.0.0.1:3281';
const id=n=>`b2700000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const workspace={tournamentName:'TEST ONLY single operator',rosterEntries:[{rosterEntryId:id(1),displayName:'TEST Player B',activation:{activationId:id(2),state:'pending',expiresAt:new Date(Date.now()+1800000).toISOString()}}],pendingRequests:[{requestId:id(3),activationId:id(2),rosterEntryId:id(1),rosterDisplayName:'TEST Player B',requestedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+1800000).toISOString(),canApprove:true}]};
await fs.mkdir(path.join(dir,'app'),{recursive:true});await fs.writeFile(path.join(dir,'package.json'),'{"private":true,"type":"module"}');await fs.writeFile(path.join(dir,'next.config.mjs'),`export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.writeFile(path.join(dir,'app/layout.tsx'),`import '../../../src/app/globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html><body>{children}</body></html>}`);
for(const name of ['normal','simulation','own']){await fs.mkdir(path.join(dir,'app',name),{recursive:true});await fs.writeFile(path.join(dir,'app',name,'page.tsx'),`import Client from '../../../../src/app/tournament/[tournamentId]/account-activations/activation-workspace-client';import {SimulatedRehearsalNotice} from '../../../../src/components/simulated-rehearsal-notice';export default function Page(){return <>${name==='normal'?'':'<SimulatedRehearsalNotice/>'}<Client tournamentId="${tid}" workspace={${JSON.stringify(name==='own'?{...workspace,pendingRequests:[{...workspace.pendingRequests[0],canApprove:false}]}:workspace)}} simulated={${name!=='normal'}}/></>}`);}
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',dir,'--hostname','127.0.0.1','--port','3281'],{env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});let logs='',browser;child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);const checks=[];
try{
 let ready=false;for(let i=0;i<160;i++){try{if((await fetch(origin+'/simulation',{signal:AbortSignal.timeout(3000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,400));}assert.ok(ready,logs);
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});const writes=[];let fail=false;
  await context.route('**/api/v1/tournaments/**',async route=>{writes.push(JSON.parse(route.request().postData()));if(fail){await route.abort();return;}await new Promise(r=>setTimeout(r,150));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'approved',requestId:id(3),rosterEntryId:id(1),linkId:id(4)})});});
  const page=await context.newPage();await page.goto(origin+'/simulation');await page.getByRole('heading',{name:'Pending simulated account links'}).waitFor();
  await page.getByLabel('Simulated technical rehearsal').getByText(/One operator simulating two accounts; no independent identity witness/).waitFor();
  const button=page.getByRole('button',{name:'Record simulated match'});assert.equal(await button.isDisabled(),true);
  await page.getByLabel('Simulation comparison phrase').fill('ABCD-EFGH');assert.equal(await button.isDisabled(),true);
  await page.getByRole('checkbox').check();assert.equal(await button.isEnabled(),true);
  await button.dblclick();await page.getByRole('status').getByText('Player account activated by the tournament server.').waitFor();assert.equal(writes.length,1);assert.equal(writes[0].simulatedSingleOperator,true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.goto(origin+'/own');await page.getByRole('heading',{name:'Pending simulated account links'}).waitFor();await page.getByRole('checkbox').check();assert.equal(await page.getByRole('button',{name:'Record simulated match'}).isDisabled(),true);
  await page.goto(origin+'/normal');await page.getByRole('heading',{name:'Pending in-person confirmations'}).waitFor();assert.equal(await page.getByRole('checkbox').count(),0);await page.getByLabel('Witness phrase').fill('ABCD-EFGH');await page.getByRole('button',{name:'Approve witnessed match'}).click();await page.getByRole('status').getByText('Player account activated by the tournament server.').waitFor();assert.equal('simulatedSingleOperator' in writes[1],false);
  fail=true;await page.goto(origin+'/simulation');await page.getByLabel('Simulation comparison phrase').fill('ABCD-EFGH');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Record simulated match'}).click();await page.getByRole('status').getByText('The result is uncertain. Refresh the pending list before trying again.').waitFor();const count=writes.length;await page.reload();await page.getByRole('heading',{name:'Pending simulated account links'}).waitFor();assert.equal(writes.length,count);assert.equal(await page.getByRole('checkbox').isChecked(),false);
  checks.push({width,passed:true,cases:['truthful banner','explicit consent and phrase','single in-flight request','self-account disabled','normal witness retained','lost response reload has no automatic retry']});await context.close();
 }
 await fs.writeFile('test-results/simulated-links-browser.json',JSON.stringify({kind:'local real-component headless browser; intercepted API; SQL persistence tested separately',checks},null,2));console.log('PASS phone/desktop simulation and normal activation flows',JSON.stringify(checks));
}catch(error){console.error(error);console.error(logs);process.exitCode=1;}finally{await browser?.close();child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});console.log('CLEANUP task-owned local Next server stopped');}
