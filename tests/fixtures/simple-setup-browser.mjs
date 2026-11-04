import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {qSetupPrizeWorkspace} from './q-setup-prize-workspace.mjs';

export async function runSimpleSetupBrowser(mode){
 const root=process.cwd(),dir=path.join(root,`test-results/setup-simple-${mode}`),port=mode==='activation'?3327:mode==='guided'?3325:3323,origin=`http://127.0.0.1:${port}`;
 const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,actor=id(1);
 await fs.mkdir(path.join(dir,'app'),{recursive:true});await fs.mkdir(path.join(dir,'public'),{recursive:true});
 await fs.copyFile('public/offline-score-sw.js',path.join(dir,'public/offline-score-sw.js'));
 await fs.writeFile(path.join(dir,'package.json'),'{"private":true,"type":"module"}');
 await fs.writeFile(path.join(dir,'next.config.mjs'),`export default {turbopack:{root:${JSON.stringify(root)}}};`);
 await fs.writeFile(path.join(dir,'app/layout.tsx'),`import '../../../src/app/globals.css';import{RecoveryDocumentBoundary}from'../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return <html><body><RecoveryDocumentBoundary actorId="${actor}">{children}</RecoveryDocumentBoundary></body></html>}`);
 await fs.writeFile(path.join(dir,'app/page.tsx'),`import Client from '../../../src/app/tournament/[tournamentId]/setup/setup-client';export default function Page(){return <main className="auth-shell"><section className="auth-card corrections-card setup-card"><Client actorId="${actor}" tournamentId="${actor}"/></section></main>}`);
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',dir,'--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
 let logs='',browser,activePage;const pageErrors=[];child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);const checks=[];
 try{
  let ready=false;for(const end=Date.now()+120000;Date.now()<end;){try{if((await fetch(origin,{signal:AbortSignal.timeout(10000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,logs);
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const width of [320,390,1440]){
   const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),ws=qSetupPrizeWorkspace(actor);activePage=page;page.on('pageerror',error=>pageErrors.push(String(error)));
   const main={...ws.current.events[0],clientRowId:id(2),displayName:'Saved Main',gameCount:12,entryFeeCents:0,freeEntry:true};
   ws.current.events=mode==='guided'?[]:[main,{...main,clientRowId:id(3),eventKind:'consolation',displayName:'Saved Consolation',gameCount:8},{...main,clientRowId:id(4),eventKind:'satellite',displayName:'Saved Satellite',gameCount:3}];ws.history[0].eventCount=ws.current.events.length;
   const links={available:true,protocol:'setup-event-links-v1',current:mode==='guided'?{protocol:'setup-event-links-v1',setupRevisionId:ws.current.revisionId,setupVersion:1,choices:[],complete:true,associationHash:'a'.repeat(64)}:null};
   const activationKey=`tournament-activation:${actor}:${actor}`,activationEnvelope={kind:'tournament-activation-linked-v1',request:{setupRevisionId:ws.current.revisionId,expectedVersion:1,confirmed:true,idempotencyKey:id(99)},associationHash:'a'.repeat(64)};
   if(mode==='activation'){
    await context.addCookies([{name:'acc_recovery_owner_v1',value:actor,url:origin,sameSite:'Lax'}]);
    await context.addInitScript(({key,value})=>{if(sessionStorage.getItem(key)===null)sessionStorage.setItem(key,value);},{key:activationKey,value:JSON.stringify(activationEnvelope)});
   }
   const requests=[],receipts=new Map();let badReadbacks=0;
   await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
   await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(req.method()==='GET'){
     if(url.pathname.endsWith('/setup/linked')){const value=structuredClone(links);if(badReadbacks&&value.current){value.current.associationHash='c'.repeat(64);badReadbacks--;}return route.fulfill({json:value});}
     if(url.pathname.endsWith('/setup/activation'))return route.fulfill({json:{status:'not_activated'}});
     if(url.pathname.endsWith('/setup'))return route.fulfill({json:{workspace:ws,officialChoices:{directorProfileId:actor,directorDisplayName:'Fictional Director',coDirectorProfileIds:[]},sidePoolTypesReady:true}});
     return route.fulfill({status:503,json:{}});
    }
    const raw=req.postData();requests.push(raw);
    if(mode==='activation'){assert.ok(url.pathname.endsWith('/setup/linked/activation'),'Only exact activation retry may write');assert.deepEqual(JSON.parse(raw),{request:activationEnvelope.request,associationHash:activationEnvelope.associationHash});return route.fulfill({status:requests.length===1?503:200,json:{status:'unknown'}});}
    assert.ok(url.pathname.endsWith('/setup/linked'),'No unrelated write route');
    if(mode==='recovery'&&requests.length===1)return route.fulfill({status:503,json:{error:'unavailable'}});
    const body=JSON.parse(raw),key=body.request.idempotencyKey;let response=receipts.get(key);
    if(!response){const version=body.request.expectedVersion+1,revisionId=id(20+version),events=body.request.payload.events;
     const result={status:'setup_draft_saved',revisionId,version,eventCount:events.length,...Object.fromEntries(['operationalEventsCreated','rulesetApproved','seatingUpdated','financeUpdated','resultsUpdated','payoutsCalculated','qualifiersCalculated','accSubmissionCreated'].map(k=>[k,false]))};
     links.current={protocol:'setup-event-links-v1',setupRevisionId:revisionId,setupVersion:version,choices:body.choices,complete:true,associationHash:'b'.repeat(64)};
     ws.current={...body.request.payload,revisionId,version,createdAt:'2027-01-02T00:00:00.000Z',events:events.map(e=>({...e,sourceStatus:'director_configured_unverified'}))};ws.history.unshift({version,createdAt:ws.current.createdAt,eventCount:events.length});
     response={status:'linked_setup_saved',result,links:structuredClone(links.current)};receipts.set(key,response);
    }
    if(mode==='recovery'&&requests.length===2)badReadbacks=2;
    return route.fulfill({json:response});
   });
   await page.goto(origin);await page.getByRole('heading',{name:'Tournament Events',exact:true}).waitFor();
   if(mode==='activation'){
    const assertLocked=async()=>{assert.equal(await page.getByRole('textbox',{name:'Tournament name',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('textbox',{name:'Event name',exact:true}).first().isDisabled(),true);assert.equal(await page.getByLabel('No',{exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Save All Events Draft',exact:true}).isDisabled(),true);for(const button of await page.getByRole('button',{name:/^(Remove event|Add Satellite Event)$/}).all())assert.equal(await button.isDisabled(),true);};
    await page.getByText('A previous finalization could not be confirmed. Retry the exact request.',{exact:true}).waitFor();await assertLocked();
    const retry=page.getByRole('button',{name:'Retry Finalize & Open Registration',exact:true}),retained=await page.evaluate(key=>sessionStorage.getItem(key),activationKey);assert.equal(await retry.isEnabled(),true);
    for(let attempt=0;attempt<2;attempt++){await retry.click();await page.getByText('Finalization is unresolved. Retry the exact request when the connection is available.',{exact:true}).waitFor();await assertLocked();assert.equal(await retry.isEnabled(),true);assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),activationKey),retained);}
    assert.equal(requests.length,2);assert.equal(requests[0],requests[1]);assert.equal(await page.getByRole('textbox',{name:'Event name',exact:true}).count(),3);
    await page.evaluate(key=>sessionStorage.setItem(key,'unrecognized activation request'),activationKey);await page.reload();await page.getByText('Saved finalization recovery needs review. Keep the original request intact.',{exact:true}).waitFor();await assertLocked();assert.equal(await page.getByRole('button',{name:'Retry Finalize & Open Registration',exact:true}).count(),0);assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),activationKey),'unrecognized activation request');
    await page.screenshot({path:path.join(dir,`locked-${width}.png`),fullPage:true});checks.push({mode,width,passed:true,requests:requests.length});await context.close();continue;
   }
   if(mode==='guided'){
    assert.equal(await page.getByRole('button',{name:'Add Satellite Event',exact:true}).count(),0);
    await page.getByRole('button',{name:'Add Main Event',exact:true}).click();
    const question=page.getByRole('group',{name:'Does Main Event have a Consolation Event?',exact:true});
    await question.getByLabel('Yes',{exact:true}).check();await page.getByRole('group',{name:'Consolation Event 2',exact:true}).waitFor();
    assert.equal(await page.getByRole('textbox',{name:'Event name',exact:true}).count(),2);
    await question.getByLabel('Yes',{exact:true}).check();assert.equal(await page.getByRole('textbox',{name:'Event name',exact:true}).count(),2);
    assert.equal(await page.getByRole('button',{name:/Unlink|Add Consolation for/}).count(),0);
    for(const zoom of [100,200]){await page.evaluate(n=>document.documentElement.style.fontSize=n+'%',zoom);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(dir,`yes-${width}-${zoom}.png`),fullPage:true});}await page.evaluate(()=>document.documentElement.style.fontSize='100%');
    await question.evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(dir,`yes-focus-${width}.png`)});
    await question.getByLabel('No',{exact:true}).click();const dialog=page.getByRole('alertdialog',{name:'Confirm no Consolation Event'});await dialog.waitFor();
    for(const zoom of [100,200]){await page.evaluate(n=>document.documentElement.style.fontSize=n+'%',zoom);assert.ok(await dialog.evaluate(node=>node.getBoundingClientRect().width<=innerWidth));await page.screenshot({path:path.join(dir,`no-confirm-${width}-${zoom}.png`),fullPage:true});await page.screenshot({path:path.join(dir,`no-confirm-focus-${width}-${zoom}.png`)});}await page.evaluate(()=>document.documentElement.style.fontSize='100%');
    assert.equal(await dialog.getByRole('button',{name:'Cancel'}).evaluate(e=>document.activeElement===e),true);
    await page.keyboard.press('Tab');await page.keyboard.press('Tab');assert.equal(await dialog.getByRole('button',{name:'Cancel'}).evaluate(e=>document.activeElement===e),true);
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('textbox',{name:'Event name',exact:true}).count(),2);
    await question.getByLabel('No',{exact:true}).click();await page.getByRole('button',{name:'Confirm No',exact:true}).click();
    assert.equal(await page.getByRole('textbox',{name:'Event name',exact:true}).count(),1);
    const addSatellite=page.getByRole('button',{name:'Add Satellite Event',exact:true});await addSatellite.click();
    const satellite=page.getByRole('group',{name:'Satellite Event 2',exact:true});await satellite.waitFor();
    assert.ok((await satellite.boundingBox()).y>(await addSatellite.boundingBox()).y);
    await satellite.getByRole('button',{name:'Remove event',exact:true}).click();await page.getByRole('group',{name:'Main Event 1',exact:true}).getByRole('button',{name:'Remove event',exact:true}).click();
   }else{
    assert.equal(await page.getByRole('textbox',{name:'Event name',exact:true}).count(),3);
    await page.getByRole('group',{name:'Does Saved Main have a Consolation Event?',exact:true}).getByLabel('Yes',{exact:true}).check();
    assert.equal(await page.getByRole('textbox',{name:'Event name',exact:true}).count(),3);assert.equal(await page.getByRole('button',{name:/Unlink|Add Consolation for/}).count(),0);
   }
   const save=page.getByRole('button',{name:'Save All Events Draft',exact:true});
   assert.equal(await save.isEnabled(),mode==='recovery');
   if(mode==='recovery')await save.click();
   if(mode==='recovery'){
    const retry=page.getByRole('button',{name:'Retry exact saved request',exact:true});await retry.waitFor();const pendingKey=`tournament-setup:${actor}:${actor}`,retained=await page.evaluate(k=>sessionStorage.getItem(k),pendingKey);assert.ok(retained);
    await retry.click();await page.getByText('The linked save could not be fully verified. The exact request remains saved for retry.').waitFor();assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),pendingKey),retained);
    await retry.click();await page.getByText('Tournament setup version 2 was saved.',{exact:true}).waitFor();assert.equal(requests.length,3);assert.equal(requests[0],requests[1]);assert.equal(requests[0],requests[2]);assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),pendingKey),null);
    await page.getByRole('group',{name:'Consolation Event 2',exact:true}).getByRole('button',{name:'Remove event',exact:true}).click();
    await page.getByRole('group',{name:'Satellite Event 2',exact:true}).getByRole('button',{name:'Remove event',exact:true}).click();
    await page.getByRole('group',{name:'Main Event 1',exact:true}).getByRole('button',{name:'Remove event',exact:true}).click();
    assert.equal(await save.isEnabled(),true);await save.click();await page.getByText('Tournament setup version 3 was saved.',{exact:true}).waitFor();
    assert.equal(JSON.parse(requests[3]).request.payload.events.length,0);assert.equal(await page.getByRole('button',{name:'Finalize All Events / Open Registration'}).count(),0);
   }else{
    assert.equal(requests.length,0,'Returning to the already saved empty draft is not a new change');assert.equal(await page.getByRole('button',{name:'Finalize All Events / Open Registration'}).count(),0);
   }
   for(const zoom of [100,200]){await page.evaluate(n=>document.documentElement.style.fontSize=n+'%',zoom);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(dir,`${width}-${zoom}.png`),fullPage:true});}
   checks.push({mode,width,passed:true,requests:requests.length});await context.close();
  }
  await fs.writeFile(path.join(dir,'result.json'),JSON.stringify({checks,hostedWrites:false},null,2));console.log(JSON.stringify({checks,hostedWrites:false}));
 }catch(error){
  if(activePage&&!activePage.isClosed()){
   await activePage.screenshot({path:path.join(dir,'failure.png'),fullPage:true});
   await fs.writeFile(path.join(dir,'failure.json'),JSON.stringify({error:String(error),pageErrors,body:await activePage.locator('body').innerText(),dialogs:await activePage.locator('dialog').evaluateAll(elements=>elements.map(e=>({open:e.open,html:e.outerHTML})))},null,2));
  }
  throw error;
 }finally{await browser?.close();child.kill();await fs.writeFile(path.join(dir,'server.log'),logs);}
}
