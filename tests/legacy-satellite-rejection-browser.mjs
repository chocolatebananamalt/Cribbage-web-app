import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
const root=process.cwd(),dir=path.join(root,'test-results/legacy-satellite-rejection-browser'),origin='http://127.0.0.1:3278';
const id=n=>`a6780000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const placement={placement:1,entrantId:id(3),displayName:'TEST ONLY entrant',prizeMinor:501,qPoolMinor:0,sidePoolMinor:0,crossCheckEvidence:[{type:'synthetic',ref:'TEST ONLY'}]};
const workspace={tournamentName:'TEST ONLY',events:[{eventId:id(2),name:'TEST ONLY Satellite',format:'standard_singles',scoringMethod:'paper',participants:[{participantId:id(3),displayName:'TEST ONLY entrant'}],current:{packageId:id(4),versionId:id(5),version:1,status:'draft',placements:[placement],specialHands:[],directorNotes:'TEST ONLY original cent award',crossCheckComplete:false,mrpStatus:'Not applicable—Satellite event',qualificationEffect:'none',retentionUntil:'2028-01-01',approvedBy:null,approvedAt:'2026-10-30T00:00:00Z'}}]};
await fs.mkdir(path.join(dir,'app'),{recursive:true});
await fs.writeFile(path.join(dir,'package.json'),'{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir,'next.config.mjs'),`export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.writeFile(path.join(dir,'app/layout.tsx'),`import '../../../src/app/globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html><body>{children}</body></html>}`);
await fs.writeFile(path.join(dir,'app/page.tsx'),`import Client from '../../../src/app/tournament/[tournamentId]/satellite-results/satellite-results-client';export default function Page(){return <main><Client tournamentId="${id(1)}" workspace={${JSON.stringify(workspace)}} canManage={true}/></main>}`);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',dir,'--hostname','127.0.0.1','--port','3278'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let logs='',browser,context,page,mode='reject',posts=[];const checks=[],responses=[],consoleErrors=[];
child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
try{
 let ready=false;for(const until=Date.now()+180000;Date.now()<until;){try{if((await fetch(origin,{signal:AbortSignal.timeout(20000)})).ok){ready=true;break;}}catch(e){if(['EACCES','EPERM'].includes(e.cause?.code))throw e;}await new Promise(r=>setTimeout(r,300));}assert.ok(ready);
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of [390,1440]){
  context=await browser.newContext({viewport:{width,height:1000}});page=await context.newPage();const errors=[];page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('pageerror',e=>errors.push(e.message));page.on('response',async r=>{if(r.url().endsWith('/satellite-results'))responses.push({status:r.status(),body:await r.json().catch(()=>null)});});
  await page.route('**/api/v1/tournaments/*/satellite-results',async r=>{const request=JSON.parse(r.request().postData());posts.push(request);if(mode==='reject')return r.fulfill({status:409,json:{status:'rejected',code:'whole_five_awards_required'}});if(mode==='unavailable')return r.fulfill({status:503,json:{error:'operation_unavailable'}});return r.fulfill({status:200,json:{status:'satellite_results_saved',eventId:request.eventId,packageId:request.packageId,versionId:request.versionId,version:request.expectedVersion+1,mrpStatus:'Not applicable—Satellite event',qualificationEffect:'none'}});});
  await page.goto(origin);await page.getByRole('heading',{name:'Add Cashing Placement'}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  mode='reject';await page.getByRole('button',{name:'Save Draft',exact:true}).click();await page.getByRole('status').filter({hasText:'Prize awards must be in $5 increments. The request was not recorded.'}).waitFor();assert.equal(await page.getByRole('status').filter({hasText:'saved with immutable'}).count(),0);
  assert.equal(posts.at(-1).placements[0].prizeMinor,501);await page.getByText(/prize \$5\.01/).waitFor();
  mode='unavailable';await page.getByRole('button',{name:'Save Draft',exact:true}).click();await page.getByRole('status').filter({hasText:'The result operation is unresolved. Refresh before retrying.'}).waitFor();
  await page.reload();await page.getByRole('heading',{name:'Add Cashing Placement'}).waitFor();
  mode='replay';await page.getByRole('button',{name:'Save Draft',exact:true}).click();await page.getByRole('status').filter({hasText:'saved with immutable version 2'}).waitFor();assert.deepEqual(errors,[]);
  checks.push({width,exactRejection:true,noSavedClaimOnRejection:true,otherFailureUnresolved:true,legacyDisplayedCentAmountUnchanged:true,acceptedResponse:true,noOverflow:true});await context.close();context=null;
 }
 await fs.writeFile('test-results/legacy-satellite-rejection-browser-result.json',JSON.stringify({status:'PASS',checks,posts:posts.length,limitations:'Fictional mocked API verifies client response handling; exact accepted operation replay/persistence is covered separately by real SQL.'},null,2));console.log('PASS satellite rejection browser 390/1440');
}catch(error){await fs.writeFile('test-results/legacy-satellite-rejection-browser-failure.json',JSON.stringify({error:String(error),mode,posts,responses,consoleErrors,body:await page?.locator('body').innerText().catch(()=>null)},null,2));throw error;}finally{
 await context?.close();await browser?.close();if(child.exitCode===null){child.kill();await new Promise(r=>child.once('close',r));}
 await fs.writeFile('test-results/legacy-satellite-rejection-browser-server.log',logs);
 assert.ok(path.resolve(dir).startsWith(path.resolve(root,'test-results')+path.sep));await fs.rm(dir,{recursive:true,force:true});
 await fs.writeFile('test-results/legacy-satellite-rejection-browser-cleanup.json',JSON.stringify({pid:child.pid,exitCode:child.exitCode,signal:child.signalCode,fixtureRemoved:true}));console.log('CLEANUP satellite fixture removed');
}
