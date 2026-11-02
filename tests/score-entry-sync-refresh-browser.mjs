// Real component and RSC refresh; fictional local transports, no hosted data.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
const root=process.cwd(),dir=path.join(root,'test-results/score-sync-refresh'),origin='http://127.0.0.1:3285';
const id=n=>`62730000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const base={actorId:id(1),tournamentId:id(2),eventId:id(3),gameId:id(4),roundNumber:1,matchInstance:1,state:'pending',eventName:'TEST ONLY sync transition',ownSubmission:null,ownConfirmed:false,canConfirm:false,progressionStatus:'current',canEnter:true,player:{displayName:'Synthetic A',side:'a',tableSeat:'A-1',verificationId:'A-1'},opponent:{displayName:'Synthetic B',side:'b',tableSeat:'A-2',verificationId:'A-2'}};
await fs.mkdir(path.join(dir,'app'),{recursive:true});await fs.mkdir(path.join(dir,'public'),{recursive:true});await fs.copyFile('public/offline-score-sw.js',path.join(dir,'public/offline-score-sw.js'));
await fs.writeFile(path.join(dir,'package.json'),'{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir,'next.config.mjs'),`export default{turbopack:{root:${JSON.stringify(root)}}};`);
await fs.writeFile(path.join(dir,'app/layout.tsx'),`import '../../../src/app/globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html><body><div id="acc-recovery-frozen-shield" role="alert">This saved page is paused to protect recovery work.</div><div id="acc-recovery-live-app">{children}</div></body></html>}`);
const baseline=execFileSync('git',['show','2abf66823a6d135041edb5e093e05ca29d5e75df:src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx'],{encoding:'utf8'}).replaceAll('../../../../../','../../../src/').replace('"./judge-call-button"','"../../../src/app/tournament/[tournamentId]/game/[gameId]/judge-call-button"');
await fs.writeFile(path.join(dir,'app/baseline-client.tsx'),baseline);
await fs.writeFile(path.join(dir,'app/probe.tsx'),`"use client";import{useEffect}from'react';import*as queue from'../../../src/lib/offline-score-queue';export default function Probe(){useEffect(()=>{Object.assign(window,{fixtureQueue:queue})},[]);return null;}`);
for(const mode of ['baseline','fixed']){
 await fs.mkdir(path.join(dir,'app',mode),{recursive:true});
 const stateFile=path.join(dir,mode+'.json');await fs.writeFile(stateFile,JSON.stringify(base));
 await fs.writeFile(path.join(dir,'app',mode,'page.tsx'),`import fs from 'node:fs';import Probe from '../probe';import{RecoveryDocumentBoundary}from'../../../../src/components/recovery-document-boundary';import {LiveScoreEntry}from '${mode==='baseline'?'../baseline-client':'../../../../src/app/tournament/[tournamentId]/game/[gameId]/score-entry'}';export const dynamic='force-dynamic';export default function Page(){const context=JSON.parse(fs.readFileSync(${JSON.stringify(stateFile)},'utf8'));return <RecoveryDocumentBoundary actorId={context.actorId}><Probe/><output data-testid="server-state">{context.state}</output><LiveScoreEntry context={context}/></RecoveryDocumentBoundary>}`);
}
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',dir,'--hostname','127.0.0.1','--port','3285'],{env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let logs='',browser;child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);const checks=[];
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin+'/fixed',{signal:AbortSignal.timeout(3000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}assert.ok(ready,logs);
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [mode,width]of [['baseline',390],['fixed',390],['fixed',1440]]){
  let contextState={...base};const stateFile=path.join(dir,mode+'.json');await fs.writeFile(stateFile,JSON.stringify(contextState));
  const context=await browser.newContext({viewport:{width,height:950}});const page=await context.newPage();page.setDefaultTimeout(12000);const posts=[];let submitted;page.on('console',m=>{if(m.type()==='error')console.log('BROWSER',mode,m.text().slice(0,180));});
  await context.route('**/api/v1/**',async route=>{
   const req=route.request(),url=new URL(req.url()),body=req.postDataJSON();posts.push(url.pathname);
   if(url.pathname.endsWith('/offline-capability'))return route.fulfill({json:{status:'issued',version:1,capabilityId:body.capabilityId,deviceKeyId:body.deviceKeyId,verifiedActorId:base.actorId,sessionBindingId:'fictional-local-session',tournamentId:base.tournamentId,eventId:base.eventId,gameId:base.gameId,assignedSide:'a',submissionSlot:1,expectedGameVersion:1,capabilityExpiresAtMs:Date.now()+3600000}});
   if(url.pathname==='/api/v1/offline-score-replay'){
    submitted={id:body.submissionId,winnerSide:body.winnerSide,margin:body.margin};contextState={...base,state:'submitted',canEnter:false,ownSubmission:submitted};await fs.writeFile(stateFile,JSON.stringify(contextState));
    return route.fulfill({json:{version:1,queueId:body.queueId,clientOperationId:body.clientOperationId,kind:body.kind,gameId:body.gameId,submissionId:body.submissionId,payloadDigest:body.payloadDigest,disposition:'accepted'}});
   }
   if(url.pathname.endsWith('/confirmations')){
    contextState={...contextState,ownConfirmed:true,canConfirm:false};await fs.writeFile(stateFile,JSON.stringify(contextState));
    return route.fulfill({json:{game_id:base.gameId,status:'confirmation_pending'}});
   }
   return route.abort();
  });
  await page.goto(origin+'/'+mode);await page.getByRole('heading',{name:'Current Game Results',exact:true}).waitFor();
  // Wait for the capability using the real browser IndexedDB controller.
  await page.waitForFunction(async({actor,game})=>!!(await window.fixtureQueue?.readPreparedOfflineSubmissionCapability(actor,game)),{actor:base.actorId,game:base.gameId});
  await context.setOffline(true);await page.getByRole('button',{name:'Synthetic A won',exact:true}).click();await page.getByRole('button',{name:'2',exact:true}).click();await page.getByRole('button',{name:'0',exact:true}).click();await page.getByRole('button',{name:'Review Result',exact:true}).click();await page.getByRole('button',{name:'Submit My Independent Entry',exact:true}).click();
  console.log('OFFLINE SUBMITTED',mode,width,await page.getByRole('status').allTextContents());await page.getByRole('status').filter({hasText:'Saved Offline, Waiting to Sync'}).waitFor();assert.equal(posts.filter(p=>p==='/api/v1/offline-score-replay').length,0);
  await context.setOffline(false);await page.getByRole('button',{name:'Sync Saved Entry',exact:true}).waitFor();await page.getByRole('button',{name:'Sync Saved Entry',exact:true}).click();await page.getByRole('status').filter({hasText:/Offline entry synchronized|Required verification is still pending/}).waitFor({timeout:15000});assert.ok(submitted);await page.getByTestId('server-state').filter({hasText:'submitted'}).waitFor();
  contextState={...contextState,state:'confirmation_pending',canConfirm:true};await fs.writeFile(stateFile,JSON.stringify(contextState));
  if(mode==='baseline'){
   await page.waitForTimeout(11500);assert.equal(await page.getByRole('button',{name:'Confirm My Entry',exact:true}).count(),0);checks.push('Baseline reproduced: accepted offline score and fresh server match do not expose confirmation without manual reload');
  }else{
   await page.getByRole('button',{name:'Confirm My Entry',exact:true}).waitFor({timeout:16000});assert.equal(posts.filter(p=>p==='/api/v1/offline-score-replay').length,1);assert.equal(posts.filter(p=>p.endsWith('/confirmations')).length,0);
   await page.getByRole('button',{name:'Confirm My Entry',exact:true}).click();await page.getByRole('status').filter({hasText:'Your confirmation is saved.'}).waitFor();assert.equal(posts.filter(p=>p.endsWith('/confirmations')).length,1);
   contextState={...contextState,state:'verified',canConfirm:false,ownConfirmed:true,progressionStatus:'completed'};await fs.writeFile(stateFile,JSON.stringify(contextState));
   await page.getByRole('status').filter({hasText:'Game verified. The authoritative scorecard is updated.'}).waitFor({timeout:16000});assert.equal(await page.getByRole('button',{name:'Confirm My Entry',exact:true}).count(),0);assert.equal(posts.filter(p=>p.endsWith('/confirmations')).length,1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks.push(`Fixed ${width}: accepted offline replay, automatic confirmation, explicit own confirmation and final server verification; no duplicate POST or manual reload`);
  }
  await context.close();
 }
 await fs.writeFile('test-results/score-sync-refresh-result.json',JSON.stringify({passed:true,checks,scope:'Actual client/IndexedDB and RSC; local fictional transport, not hosted or physical outage'},null,2));console.log(JSON.stringify(checks));
}catch(error){console.error(error);throw error;}finally{await browser?.close();child.kill();await fs.writeFile('test-results/score-sync-refresh-server.log',logs);console.log('CLEANUP task-owned server stopped');}
