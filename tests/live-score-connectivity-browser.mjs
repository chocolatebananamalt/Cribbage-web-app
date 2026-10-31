// Actual LiveScoreEntry/IndexedDB/service worker; fictional transports only.
// This is not server authorization, physical-device or real-human proof.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {spawn,spawnSync}from'node:child_process';import{chromium}from'playwright-core';
const root=process.cwd(),dir=path.join(root,'test-results/live-score-connectivity'),origin='http://127.0.0.1:3258';
const id=n=>`60000000-0000-4000-8000-${String(n).padStart(12,'0')}`,actor=id(1),tid=id(2),eid=id(3),game=id(4);
const gamePath=`/tournament/${tid}/game/${game}`;
const base={actorId:actor,tournamentId:tid,eventId:eid,gameId:game,roundNumber:1,matchInstance:1,state:'pending',eventName:'TEST ONLY simulated connectivity',ownSubmission:null,ownConfirmed:false,canConfirm:false,progressionStatus:'current',canEnter:true,player:{displayName:'Synthetic A',side:'a',tableSeat:'A-1',verificationId:'A-1'},opponent:{displayName:'Synthetic B',side:'b',tableSeat:'A-2',verificationId:'A-2'}};
await fs.mkdir(path.join(dir,'app',gamePath),{recursive:true});await fs.mkdir(path.join(dir,'app/confirm'),{recursive:true});await fs.mkdir(path.join(dir,'public'),{recursive:true});
await fs.writeFile(path.join(dir,'package.json'),'{"private":true,"type":"module"}');await fs.writeFile(path.join(dir,'next.config.mjs'),`export default{turbopack:{root:${JSON.stringify(root)}}};`);
await fs.writeFile(path.join(dir,'tsconfig.json'),JSON.stringify({extends:'../../tsconfig.json',compilerOptions:{incremental:false},include:['next-env.d.ts','app/**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']}));
await fs.copyFile('public/offline-score-sw.js',path.join(dir,'public/offline-score-sw.js'));
await fs.writeFile(path.join(dir,'app/layout.tsx'),`import '../../../src/app/globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html><body><div id="acc-recovery-frozen-shield" role="alert">This saved page is paused to protect recovery work.</div><div id="acc-recovery-live-app">{children}</div></body></html>}`);
const client=prefix=>`"use client";import{useEffect}from'react';import{LiveScoreEntry}from'${prefix}src/app/tournament/[tournamentId]/game/[gameId]/score-entry';import*as queue from'${prefix}src/lib/offline-score-queue';import*as binding from'${prefix}src/lib/offline-score-page-binding';export default function Client({context}:{context:import('${prefix}src/lib/games/assigned-game-context-decision').AssignedGameContext}){useEffect(()=>{Object.assign(window,{fixtureQueue:queue,fixtureBinding:binding})},[]);return <LiveScoreEntry context={context}/>}`;
const component=(prefix,context)=>`import{RecoveryDocumentBoundary}from'${prefix}src/components/recovery-document-boundary';import{assignedOfflinePageMetadata}from'${prefix}src/lib/offline-score-page-binding';import Client from'./score-client';const context:import('${prefix}src/lib/games/assigned-game-context-decision').AssignedGameContext=${JSON.stringify(context)};export const dynamic='force-dynamic';export function generateMetadata(){return assignedOfflinePageMetadata(context);}export default function Page(){return <RecoveryDocumentBoundary actorId="${actor}"><div data-offline-score-binding="${actor}:${game}"><Client context={context}/></div></RecoveryDocumentBoundary>}`;
await fs.writeFile(path.join(dir,'app',gamePath,'score-client.tsx'),client('../../../../../../../'));
await fs.writeFile(path.join(dir,'app/confirm/score-client.tsx'),client('../../../../'));
await fs.writeFile(path.join(dir,'app',gamePath,'page.tsx'),component('../../../../../../../',base));
await fs.writeFile(path.join(dir,'app/confirm/page.tsx'),component('../../../../',{...base,ownSubmission:{id:id(9),winnerSide:'a',margin:15},canEnter:false,canConfirm:true,state:'confirmation_pending'}));
// Default to the production asset graph: development HMR chunks are not a
// supported cached-page acceptance target. Explicit0 is diagnostic only.
const production=process.env.SCORE_CONNECTIVITY_PRODUCTION!=='0';
if(production){const built=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build',dir],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},encoding:'utf8',maxBuffer:16*1024*1024});await fs.writeFile('test-results/live-score-connectivity-fixture-build.log',built.stdout+built.stderr);assert.equal(built.status,0,'Production fixture build');}
const child=spawn(process.execPath,['node_modules/next/dist/bin/next',production?'start':'dev',dir,'--hostname','127.0.0.1','--port','3258'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let logs='',browser,page;const checks=[],requests=[],failures=[];child.stdout.on('data',v=>logs+=v);child.stderr.on('data',v=>logs+=v);
await fs.writeFile('test-results/live-score-connectivity-process.json',JSON.stringify({pid:child.pid,origin}));
const status=text=>page.getByRole('status').filter({hasText:text});
const receipt=(intent,disposition='accepted')=>({version:1,queueId:intent.queueId,clientOperationId:intent.clientOperationId,kind:intent.kind,gameId:intent.gameId,submissionId:intent.submissionId,payloadDigest:intent.payloadDigest,disposition});
try{
 let ready=false;for(const until=Date.now()+120000;Date.now()<until;){try{if((await fetch(origin+gamePath,{signal:AbortSignal.timeout(10000)})).ok){ready=true;break;}}catch(e){if(['EACCES','EPERM'].includes(e.cause?.code))throw e;}await new Promise(r=>setTimeout(r,300));}assert.ok(ready,'Local score fixture readiness');
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of[390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}});page=await context.newPage();page.on('requestfailed',r=>failures.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText}));let mode='503';const attempts=[],applied=new Set();
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(url.origin!==origin)return route.abort();
   if(url.pathname.endsWith('/offline-capability')){const body=req.postDataJSON();requests.push({path:url.pathname,kind:'capability'});return route.fulfill({json:{status:'issued',version:1,capabilityId:body.capabilityId,deviceKeyId:body.deviceKeyId,verifiedActorId:actor,sessionBindingId:'fictional-local-session',tournamentId:tid,eventId:eid,gameId:game,assignedSide:'a',submissionSlot:1,expectedGameVersion:1,capabilityExpiresAtMs:Date.now()+3600000}});}
   if(url.pathname==='/api/v1/offline-score-replay'){
    const intent=req.postDataJSON();attempts.push(intent);requests.push({path:url.pathname,kind:'replay',operation:intent.clientOperationId});
    if(mode==='503')return route.fulfill({status:503,json:{error:'synthetic_unavailable'}});
    if(mode==='mismatch')return route.fulfill({json:{...receipt(intent),payloadDigest:'0'.repeat(64)}});
    if(mode==='401')return route.fulfill({status:401,json:{error:'synthetic_expired_session'}});
    if(mode==='lost'){applied.add(intent.clientOperationId);return route.abort();}
    if(mode==='conflict')return route.fulfill({status:409,json:receipt(intent,'conflict')});
    applied.add(intent.clientOperationId);return route.fulfill({json:receipt(intent)});
   }
   if(url.pathname.endsWith('/confirmations')){requests.push({path:url.pathname,kind:'confirmation'});return route.abort();}
   return route.continue();
  });
  await page.goto(origin+gamePath);await page.waitForFunction(()=>window.fixtureQueue);await status('Offline Ready').waitFor({timeout:30000});
  const markerChecks=await page.evaluate(({actor,game})=>{
   const check=window.fixtureBinding.hasAssignedOfflinePageBinding,value=`${actor}:${game}`,meta=`<meta name="acc-offline-score-binding" content="${value}">`;
   return [check(`<html><head>${meta}</head><body>Waiting</body></html>`,actor,game),check(`<html><body>Waiting${meta}</body></html>`,actor,game),!check(`<script>${JSON.stringify({'data-offline-score-binding':value})}</script>`,actor,game),!check(meta+meta,actor,game),!check(meta,actor,'60000000-0000-4000-8000-000000000099'),!check(meta,'60000000-0000-4000-8000-000000000099',game),!check(meta+`<div data-offline-score-binding="wrong"></div>`,actor,game)];
  },{actor,game});assert.ok(markerChecks.every(Boolean));
  checks.push(`protected metadata parser ${width}: streamed/body marker accepted; escaped text, duplicate, wrong actor/game and conflicting marker block`);
  await context.setOffline(true);await page.getByRole('button',{name:'Synthetic A won',exact:true}).click();await page.getByRole('button',{name:'1',exact:true}).click();await page.getByRole('button',{name:'5',exact:true}).click();await page.getByRole('button',{name:'Review Result',exact:true}).click();await page.getByRole('button',{name:'Submit My Independent Entry',exact:true}).click();await status('Saved Offline, Waiting to Sync').waitFor();
  const saved=await page.evaluate(async({actor,game})=>window.fixtureQueue.readOfflineSubmission(actor,game),{actor,game});assert.equal(saved.intent.margin,15);assert.equal(saved.intent.winnerSide,'a');assert.equal(attempts.length,0);
  await status('1 offline score entry is').waitFor();assert.equal(await page.getByRole('button',{name:'Clear safe app data and sign out',exact:true}).count(),0);
  checks.push(`actual digital offline save ${width}: durable signed intent, no send/verification and pending work blocks switch`);
  await page.reload();await status('Saved Offline, Waiting to Sync').waitFor({timeout:30000});await page.waitForFunction(()=>window.fixtureQueue);
  assert.deepEqual(await page.evaluate(async({actor,game})=>window.fixtureQueue.readOfflineSubmission(actor,game),{actor,game}),saved);
  checks.push(`actual worker cached offline reload ${width}: actor-bound page and exact queue preserved`);
  await context.setOffline(false);await page.getByRole('button',{name:'Sync Saved Entry',exact:true}).waitFor();await page.getByRole('button',{name:'Sync Saved Entry',exact:true}).click();await status('Tap Sync Saved Entry to try again').waitFor();
  mode='mismatch';await page.getByRole('button',{name:'Sync Saved Entry',exact:true}).click();await status('sync response was incomplete').waitFor();
  assert.deepEqual(await page.evaluate(async({actor,game})=>window.fixtureQueue.readOfflineSubmission(actor,game),{actor,game}),saved);
  mode='401';await page.getByRole('button',{name:'Sync Saved Entry',exact:true}).click();await status('Sign in as the same player').waitFor();
  checks.push(`503/inexact receipt/expired session ${width}: original pending intent retained, never verified`);
  mode='lost';await page.getByRole('button',{name:'Sync Saved Entry',exact:true}).click();await status('Tap Sync Saved Entry to try again').waitFor();
  mode='success';await page.getByRole('button',{name:'Sync Saved Entry',exact:true}).evaluate(b=>{b.click();b.click();});await status('Offline entry synchronized').waitFor();
  assert.equal(applied.size,1);assert.ok(attempts.length>=4);assert.ok(attempts.every(r=>JSON.stringify(r)===JSON.stringify(saved.intent)));
  assert.equal(await page.evaluate(async({actor,game})=>await window.fixtureQueue.readOfflineSubmission(actor,game)??null,{actor,game}),null);
  assert.equal(await status('Game verified. The authoritative scorecard is updated.').count(),0);
  await page.getByRole('button',{name:'Clear safe app data and sign out',exact:true}).waitFor({timeout:5000});
  checks.push(`lost successful response/exact repeated retry ${width}: one simulated application, exact terminal receipt clears own queue; no local verification claim`);
  await page.screenshot({path:`test-results/live-score-connectivity-${width}.png`,fullPage:true});await context.close();
 }
 // Confirmation is intentionally online-only in the current controller.
 const context=await browser.newContext();page=await context.newPage();await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());await page.goto(origin+'/confirm');await page.getByRole('button',{name:'Confirm My Entry',exact:true}).waitFor();await context.setOffline(true);await page.getByRole('button',{name:'Confirm My Entry',exact:true}).click();await status('Reconnect before confirming').waitFor();checks.push('offline confirmation explicitly blocks: no locally invented matching challenge or verified result');await context.close();
 await fs.writeFile('test-results/live-score-connectivity-result.json',JSON.stringify({status:'PASS',checks,requests,limitation:'Real client/IndexedDB/worker with mocked capability/replay; not server authorization, signature verification, two humans, physical outage, mobile engine or hosted data.'},null,2));
 console.log(JSON.stringify({status:'PASS',groups:checks.length,checks},null,2));
}catch(e){if(page){await fs.writeFile('test-results/live-score-connectivity-failure.txt',await page.locator('body').innerText().catch(()=>''));const html=await page.evaluate(async()=>await(await fetch(location.href,{cache:'no-store'})).text()).catch(()=>null);if(html)await fs.writeFile('test-results/live-score-connectivity-fetched.html',html);await fs.writeFile('test-results/live-score-connectivity-diagnostic.json',JSON.stringify({requests,literalBinding:html?.includes(`data-offline-score-binding="${actor}:${game}"`),markerExcerpt:html?.slice(Math.max(0,html.indexOf('data-offline-score-binding')-40),html.indexOf('data-offline-score-binding')+180),storage:await page.evaluate(async({actor,game})=>({secure:isSecureContext,worker:'serviceWorker'in navigator,controller:navigator.serviceWorker.controller?.scriptURL,capability:await window.fixtureQueue?.readPreparedOfflineSubmissionCapability(actor,game),caches:await caches.keys()}),{actor,game}).catch(error=>({error:error.message}))},null,2));await page.screenshot({path:'test-results/live-score-connectivity-failure.png',fullPage:true}).catch(()=>{});}throw e;}
finally{await browser?.close();child.kill();await fs.writeFile('test-results/live-score-connectivity-server.log',logs);}
