// Fresh isolated UI contexts, fictional intercepted endpoints; not SQL/auth-provider acceptance.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import{spawn}from'node:child_process';import{chromium}from'playwright-core';
import{tid,eid,player,capturer,reviewer,gid,ppgid,id,capability,own,games,official,receipt}from'./fixtures/mixed-rehearsal-workspace.mjs';
const playerGames=[...games,{...games[0],gameId:id(60),gameNumber:2,opponentName:'Fictional Paper C',opponentVerificationId:'A-3',opponentTableSeat:'A-3'}];
const root=process.cwd(),dir=path.join(root,'test-results/mixed-rehearsal-browser'),origin='http://127.0.0.1:3331';
await fs.mkdir(path.join(dir,'app'),{recursive:true});await fs.mkdir(path.join(dir,'public'),{recursive:true});await fs.copyFile('public/offline-score-sw.js',path.join(dir,'public/offline-score-sw.js'));await fs.writeFile(path.join(dir,'package.json'),'{"private":true,"type":"module"}');await fs.writeFile(path.join(dir,'next.config.mjs'),`export default{turbopack:{root:${JSON.stringify(root)}}};`);await fs.writeFile(path.join(dir,'app/layout.tsx'),`import '../../../src/app/globals.css';export default function Layout({children}:{children:React.ReactNode}){return<html><body>{children}</body></html>}`);
for(const[name,actor]of[['player',player],['capture',capturer],['review',reviewer]]){await fs.mkdir(path.join(dir,'app',name),{recursive:true});await fs.writeFile(path.join(dir,'app',name,'page.tsx'),`import Client from'../../../../src/components/mixed-rehearsal-client';import{RecoveryDocumentBoundary}from'../../../../src/components/recovery-document-boundary';export default function Page(){return<RecoveryDocumentBoundary actorId="${actor}"><main className="auth-shell"><section className="auth-card corrections-card"><h1>LOCAL TEST ONLY</h1><Client actorId="${actor}" tournamentId="${tid}" eventId="${eid}" games={${JSON.stringify(actor===player?playerGames:[])}} initialGameId={${JSON.stringify(actor===player?gid:undefined)}}/></section></main></RecoveryDocumentBoundary>}`);}
await fs.mkdir(path.join(dir,'app','scope'),{recursive:true});
await fs.writeFile(path.join(dir,'app','scope','page.tsx'),`"use client";import{useState}from'react';import Client from'../../../../src/components/mixed-rehearsal-client';import{RecoveryDocumentBoundary}from'../../../../src/components/recovery-document-boundary';export default function Page(){const[event,setEvent]=useState('${eid}');return<RecoveryDocumentBoundary actorId="${player}"><button onClick={()=>setEvent('${id(70)}')}>Change event context</button><Client actorId="${player}" tournamentId="${tid}" eventId={event} games={(${JSON.stringify(games)} as const).map(g=>({...g,eventId:event}))}/></RecoveryDocumentBoundary>}`);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',dir,'--hostname','127.0.0.1','--port','3331'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});let logs='',browser,activePage;child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);const checks=[];
try{let ready=false;for(let until=Date.now()+120000;Date.now()<until;){try{if((await fetch(origin)).status<500){ready=true;break}}catch(e){if(['EACCES','EPERM'].includes(e.cause?.code))throw e}await new Promise(r=>setTimeout(r,250))}assert.ok(ready);browser=await chromium.launch({channel:'chrome',headless:true});
for(const width of[320,390,1440]){
 const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();activePage=page;const entry=own(),posts=[];let loseResponse=true,conflict=false;
 await page.route('**/api/**',async route=>{const u=new URL(route.request().url());if(u.pathname.endsWith('/synthetic-mixed-capability'))return route.fulfill({json:capability(player)});if(u.pathname.endsWith('/synthetic-mixed-games/'+gid)){if(route.request().method()==='GET')return route.fulfill({json:entry});const body=route.request().postDataJSON();posts.push(body);if(conflict)return route.fulfill({status:409,json:receipt(player,gid,'own-ack',body,{status:'rejected',code:'idempotency_conflict'})});entry.acknowledged=true;if(loseResponse){loseResponse=false;return route.abort()}return route.fulfill({json:receipt(player,gid,'own-ack',body,{status:'synthetic_opponent_acknowledged',attestationId:id(40),artifactId:entry.artifactId,gameId:gid,digitalSubmissionId:entry.digitalSubmissionId,gameVersion:body.expectedGameVersion,authoritative:false})})}return route.fulfill({status:404,json:{}})});
 await page.goto(origin+'/player');await page.getByText('Your own saved entry matches the scripted result.',{exact:true}).waitFor();const ack=page.getByRole('button',{name:'Record My Fictional-Opponent Acknowledgment'});assert.equal(await ack.isDisabled(),true);await page.getByRole('checkbox').check();await ack.click();await page.getByText('The outcome could not be confirmed.',{exact:false}).waitFor();assert.equal(posts.length,1);await page.reload();const retry=page.getByRole('button',{name:'Retry Exact Request'});await retry.waitFor();await retry.click();await page.getByText('Your fictional-opponent acknowledgment is recorded.',{exact:false}).waitFor();assert.deepEqual(posts[0],posts[1]);assert.equal(await page.getByText('Game verified through the rehearsal review.',{exact:false}).count(),0);assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).some(k=>k.startsWith('synthetic-mixed-operation:'))),false);
 for(const zoom of[100,200]){await page.evaluate(v=>document.documentElement.style.fontSize=v+'%',zoom);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(dir,`player-${width}-${zoom}.png`),fullPage:true})}
 // A recognized identity conflict must remain exact and cannot offer a new attempt.
 entry.acknowledged=false;conflict=true;await page.reload();await page.getByRole('checkbox').check();await ack.click();await page.getByText('Operation identity conflicts',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Check latest status and resolve rejected attempt'}).count(),0);await page.reload();await retry.waitFor();assert.equal(await page.getByRole('button',{name:'Record My Fictional-Opponent Acknowledgment'}).isDisabled(),true);await context.close();checks.push(`${width}px ownack lostresponse/reload/exactretry nonauthoritative and conflict retained`);
 for(const pairing of['PP','PD'])for(const step of['capture','review']){
  const who=step==='capture'?capturer:reviewer,c=await browser.newContext({viewport:{width,height:1000}}),p=await c.newPage();activePage=p;let ws=official(who,step,pairing);const writes=[];
  await p.route('**/api/**',route=>{const u=new URL(route.request().url());if(u.pathname.endsWith('/synthetic-mixed-capability'))return route.fulfill({json:capability(who,true)});if(u.pathname.endsWith('/synthetic-mixed-official'))return route.fulfill({json:ws});if(u.pathname.includes('/synthetic-mixed-official/')){const body=route.request().postDataJSON();writes.push(body);const game=pairing==='PP'?ppgid:gid,phase=(pairing==='PP'?'paper':'hybrid')+'-'+step,r=body.request,claim=pairing==='PP'?r.sideAClaim:r.paperClaim,target=pairing==='PP'?{completionId:r.completionId}:{caseId:r.caseId};const result=step==='capture'?{status:'pending_review',...target,...(pairing==='PP'?{tournamentId:tid,eventId:eid,evidenceCount:2}:{digitalSubmissionId:r.digitalSubmissionId}),gameId:game,gameVersion:r.expectedGameVersion,winnerSide:claim.winnerSide,margin:claim.margin,authoritative:false}:{status:'approved',decision:'approve',...target,gameId:game,gameVersion:r.expectedGameVersion+1,authoritative:true,scorelinesCreated:true};ws={...ws,paperCandidates:[],paperReviewCases:[],hybridCandidates:[],hybridReviewCases:[]};return route.fulfill({json:receipt(who,game,phase,body,result)})}return route.fulfill({status:404,json:{}})});
  await p.goto(origin+'/'+step);const article=p.locator('.mixed-rehearsal-game');await article.waitFor();for(const zoom of[100,200]){await p.evaluate(scale=>{document.documentElement.style.fontSize='100%';const nodes=[...document.querySelectorAll('.mixed-rehearsal *')];nodes.forEach(n=>n.style.fontSize='');const baseline=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));if(scale===200)nodes.forEach((n,i)=>n.style.fontSize=baseline[i]*2+'px');},zoom);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await article.screenshot({path:path.join(dir,`${pairing}-${step}-form-${width}-${zoom}.png`)});}await p.evaluate(()=>document.querySelectorAll('.mixed-rehearsal *').forEach(n=>n.style.fontSize=''));assert.equal(await article.locator('select').first().inputValue(),'');assert.equal(await article.locator('input[inputmode=numeric]').first().inputValue(),'');await article.getByText('Read generated fictional evidence',{exact:true}).click();assert.ok((await article.locator('pre').innerText()).includes('"physicalOriginal":false'));
  if(pairing==='PD'&&step==='review')await article.getByLabel("Re-Enter Digital Submission ID",{exact:true}).fill(id(11));for(const input of await article.locator('select').all())await input.selectOption('a');for(const input of await article.locator('input[inputmode=numeric]').all())await input.fill('20');await article.getByRole('checkbox').check();await article.getByRole('button',{name:step==='capture'?'Save Rehearsal Capture':'Record Rehearsal Review'}).click();await p.getByText(step==='capture'?'Capture saved. Review is still required; the game is not verified.':'Game verified through the rehearsal review. The scorecard is updated.',{exact:true}).waitFor();assert.equal(writes.length,1);if(step==='review')assert.equal(writes[0].request.decision,'approve');
  for(const zoom of[100,200]){await p.evaluate(v=>document.documentElement.style.fontSize=v+'%',zoom);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(dir,`${pairing}-${step}-${width}-${zoom}.png`),fullPage:true})}await c.close();checks.push(`${width}px ${pairing} ${step} blank independent inputs/scoped truthful status`);
 }
}
// Player selection must invalidate the previous script before any fresh read completes.
for(const width of [320,390,1440]) {
 const c=await browser.newContext({viewport:{width,height:1000}}),p=await c.newPage();activePage=p;
 let hold=false,release,observed,revoked=false,posts=0;
 const waiting=new Promise(r=>release=r),seen=new Promise(r=>observed=r);
 await p.route('**/api/**',async route=>{
  const u=new URL(route.request().url());
  if(route.request().method()==='POST'){posts++;return route.fulfill({status:500,json:{}})}
  if(u.pathname.endsWith('/synthetic-mixed-capability')){if(hold){observed();await waiting;}return route.fulfill({json:{...capability(player),isDigitalParticipant:!revoked}})}
  if(u.pathname.endsWith('/'+id(60)))return route.fulfill({json:{...own(),gameId:id(60),artifactId:id(61),digitalSubmissionId:id(62),scriptedWinnerSide:'b',scriptedSpreadPoints:45,digitalWinnerSide:'b',digitalMargin:45}});
  return route.fulfill({json:own()});
 });
 await p.goto(origin+'/player');await p.getByText('Your own saved entry matches the scripted result.',{exact:true}).waitFor();
 await p.getByRole('checkbox').check();hold=true;
 await p.getByRole('combobox',{name:/^Assigned Game/}).selectOption(id(60));await seen;
 assert.equal(await p.getByRole('button',{name:'Record My Fictional-Opponent Acknowledgment'}).count(),0);
 assert.equal(await p.getByText('WON',{exact:false}).count(),0);assert.equal(posts,0);
 release();await p.getByText('LOST',{exact:false}).waitFor();
 assert.equal(await p.getByRole('button',{name:'Record My Fictional-Opponent Acknowledgment'}).isDisabled(),true);
 assert.equal(await p.getByRole('checkbox').isChecked(),false);
 assert.equal(await p.getByRole('combobox',{name:/^Assigned Game/}).inputValue(),id(60));
 revoked=true;hold=false;await p.getByRole('button',{name:'Refresh rehearsal status',exact:true}).click();
 await p.waitForFunction(()=>!document.querySelector('[aria-label="Your rehearsal games"]'));
 assert.equal(await p.getByRole('button',{name:'Record My Fictional-Opponent Acknowledgment'}).count(),0);
 assert.equal(posts,0);await p.screenshot({path:path.join(dir,`player-role-revoked-${width}.png`),fullPage:true});
 await c.close();checks.push(`${width}px game switch clears old script and consent while read delayed; revoked participant cannot acknowledge; zero writes`);
}
// React may reuse the same client across event props. Never reuse another scope's readiness/evidence/retry.
{
 const c=await browser.newContext({viewport:{width:390,height:1000}}),p=await c.newPage();activePage=p;
 let release,observed,posts=0;
 const waiting=new Promise(r=>release=r),seen=new Promise(r=>observed=r);
 await p.route('**/api/**',async route=>{
  const u=new URL(route.request().url()),changed=u.pathname.includes('/events/'+id(70)+'/');
  if(route.request().method()==='POST'){posts++;return route.abort();}
  if(u.pathname.endsWith('/synthetic-mixed-capability')){if(changed){observed();await waiting;}return route.fulfill({json:{...capability(player),eventId:changed?id(70):eid}})}
  return route.fulfill({json:{...own(),eventId:changed?id(70):eid}});
 });
 await p.goto(origin+'/scope');await p.getByRole('checkbox').check();
 await p.getByRole('button',{name:'Record My Fictional-Opponent Acknowledgment'}).click();
 await p.getByRole('button',{name:'Retry Exact Request'}).waitFor();assert.equal(posts,1);
 await p.getByRole('button',{name:'Change event context'}).click();await seen;
 assert.equal(await p.getByRole('button',{name:'Retry Exact Request'}).count(),0);
 assert.equal(await p.getByRole('button',{name:'Record My Fictional-Opponent Acknowledgment'}).count(),0);
 assert.equal(posts,1);release();await p.getByText('Your own saved entry matches the scripted result.',{exact:true}).waitFor();
 assert.equal(await p.getByRole('checkbox').isChecked(),false);
 assert.equal(await p.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('synthetic-mixed-operation:')).length),1);
 await c.close();checks.push('reused event props hide stale capability, evidence and exact retry; original unknown request preserved with zero cross-event writes');
}
// A late response must not clear old pending bytes or supersede the new event's read.
for(const outcome of ['accepted','network-failure']) {
 const c=await browser.newContext({viewport:{width:390,height:1000}}),p=await c.newPage();activePage=p;
 let release,observed,posts=0;const waiting=new Promise(r=>release=r),seen=new Promise(r=>observed=r);
 await p.route('**/api/**',async route=>{
  const u=new URL(route.request().url()),changed=u.pathname.includes('/events/'+id(70)+'/');
  if(route.request().method()==='POST'){
   posts++;const body=route.request().postDataJSON();observed();await waiting;
   return outcome==='network-failure'?route.abort():route.fulfill({json:receipt(player,gid,'own-ack',body,{status:'synthetic_opponent_acknowledged',attestationId:id(40),artifactId:id(10),gameId:gid,digitalSubmissionId:id(11),gameVersion:2,authoritative:false})});
  }
  if(u.pathname.endsWith('/synthetic-mixed-capability'))return route.fulfill({json:{...capability(player),eventId:changed?id(70):eid}});
  return route.fulfill({json:{...own(),eventId:changed?id(70):eid,scriptedSpreadPoints:changed?45:20,digitalMargin:changed?45:20}});
 });
 await p.goto(origin+'/scope');await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Record My Fictional-Opponent Acknowledgment'}).click();await seen;
 await p.getByRole('button',{name:'Change event context'}).click();await p.getByText('+45 Spread Points',{exact:false}).waitFor();
 const before=await p.evaluate(()=>Object.fromEntries(Object.entries(sessionStorage).filter(([k])=>k.startsWith('synthetic-mixed-operation:'))));
 release();await p.waitForFunction(()=>{const x=document.querySelector('[aria-label="Your fictional-opponent acknowledgment"] input');return x&&!x.disabled;});
 assert.deepEqual(await p.evaluate(()=>Object.fromEntries(Object.entries(sessionStorage).filter(([k])=>k.startsWith('synthetic-mixed-operation:')))),before);
 assert.equal(await p.getByText('Your fictional-opponent acknowledgment is recorded.',{exact:false}).count(),0);
 assert.equal(await p.getByText('The outcome could not be confirmed.',{exact:false}).count(),0);
 assert.equal(await p.getByText('+45 Spread Points',{exact:false}).count(),1);assert.equal(posts,1);
 await c.close();checks.push(`late old-event ${outcome} preserves exact pending bytes, fresh event workspace and status`);
}
// Reviewer regressions: freshest official capability, exact retained-game readback, and late response ownership.
for(const field of ['officialIdentityConfirmed','sourceCurrent','tournamentOpen','eventStarted']){
 const c=await browser.newContext({viewport:{width:390,height:1000}}),p=await c.newPage();activePage=p;const ws=official(capturer,'capture','PP');ws.capability[field]=false;
 await p.route('**/api/**',r=>r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/synthetic-mixed-capability')?capability(capturer,true):ws}));await p.goto(origin+'/capture');const article=p.locator('.mixed-rehearsal-game');await article.waitFor();assert.equal(await article.locator('select').first().isDisabled(),true);assert.equal(await article.getByRole('button',{name:'Save Rehearsal Capture'}).isDisabled(),true);await c.close();checks.push(`projected ${field}=false overrides earlier capability for all new official actions`);
}
{
 const c=await browser.newContext({viewport:{width:390,height:1000}});await c.addCookies([{name:'acc_recovery_owner_v1',value:player,url:origin,sameSite:'Lax'}]);const other=id(99),body={artifactId:id(10),expectedGameVersion:2,digitalSubmissionId:id(11),confirmed:true,idempotencyKey:id(98)},pending={protocol:'synthetic-mixed-ui-v1',actorId:player,tournamentId:tid,eventId:eid,gameId:other,phase:'own-ack',artifactId:id(10),expectedGameVersion:2,idempotencyKey:id(98),request:body},key=`synthetic-mixed-operation:${player}:${tid}:${eid}:${other}:own-ack`,serialized=JSON.stringify(pending);await c.addInitScript(({key,serialized})=>{if(!sessionStorage.getItem(key))sessionStorage.setItem(key,serialized)},{key,serialized});const p=await c.newPage();activePage=p;let otherReady=false;
 await p.route('**/api/**',r=>{const u=new URL(r.request().url());if(u.pathname.endsWith('/synthetic-mixed-capability'))return r.fulfill({json:capability(player)});if(r.request().method()==='POST')return r.fulfill({status:409,json:receipt(player,other,'own-ack',body,{status:'rejected',code:'own_submission_required'})});if(u.pathname.endsWith('/'+other))return otherReady?r.fulfill({json:{...own(),gameId:other}}):r.fulfill({status:503,json:{error:'operation_unavailable'}});return r.fulfill({json:own()})});
 await p.goto(origin+'/player');await p.getByRole('button',{name:'Retry Exact Request'}).click();const reset=p.getByRole('button',{name:'Check latest status and resolve rejected attempt'});await reset.click();await p.getByText('Fresh status or recovery could not be verified.',{exact:false}).waitFor();assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),key),serialized);otherReady=true;await reset.click();await p.getByText('The rejected attempt is resolved',{exact:false}).waitFor();assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),key),null);await c.close();checks.push('retained game B cannot be cleared by selected game A readback; B503 preserves bytes, Bfresh permits known rejection resolution');
}
{
 const c=await browser.newContext({viewport:{width:390,height:1000}}),p=await c.newPage();activePage=p;let release,notify;const waiting=new Promise(r=>release=r),seen=new Promise(r=>notify=r);let posted;
 await p.route('**/api/**',async r=>{const u=new URL(r.request().url());if(u.pathname.endsWith('/synthetic-mixed-capability'))return r.fulfill({json:capability(player)});if(r.request().method()==='GET')return r.fulfill({json:own()});posted=r.request().postDataJSON();notify();await waiting;return r.fulfill({json:receipt(player,gid,'own-ack',posted,{status:'synthetic_opponent_acknowledged',attestationId:id(40),artifactId:id(10),gameId:gid,digitalSubmissionId:id(11),gameVersion:2,authoritative:false})})});
 await p.goto(origin+'/player');await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Record My Fictional-Opponent Acknowledgment'}).click();await seen;const key=`synthetic-mixed-operation:${player}:${tid}:${eid}:${gid}:own-ack`,newer=await p.evaluate(({key,operation})=>{const v=JSON.parse(sessionStorage.getItem(key));v.idempotencyKey=operation;v.request.idempotencyKey=operation;const next=JSON.stringify(v);sessionStorage.setItem(key,next);return next},{key,operation:id(97)});release();await p.getByText('The outcome could not be confirmed.',{exact:false}).waitFor();assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),key),newer);assert.equal(await p.getByText('Your fictional-opponent acknowledgment is recorded.',{exact:false}).count(),0);await c.close();checks.push('late accepted response cannot clear or claim success for a newer retained operation');
}
await fs.writeFile(path.join(dir,'result.json'),JSON.stringify({passed:true,checks,hostedReads:false,hostedWrites:false,actualDatabase:false,actualAuthenticationProvider:false},null,2));console.log(JSON.stringify({passed:true,checks}));
}catch(error){if(activePage){await activePage.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});await fs.writeFile(path.join(dir,'failure.json'),JSON.stringify({error:String(error),body:await activePage.locator('body').innerText().catch(()=>''),url:activePage.url()},null,2))}throw error}
finally{await browser?.close();child.kill();await fs.writeFile(path.join(dir,'server.log'),logs)}
