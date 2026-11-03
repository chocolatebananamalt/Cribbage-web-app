// Isolated local UI rehearsal. All backend responses are mocks; real SQL is a separate gate.
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {qSetupPrizeWorkspace} from './fixtures/q-setup-prize-workspace.mjs';
import {isSetupSaveRequest,isLegacySideSetupSaveRequest} from '../src/lib/api/setup.ts';
const root=process.cwd(),folder=path.join(root,'test-results/setup-fee-persistence-browser'),base='http://127.0.0.1:3262';
const id='10000000-0000-4000-8000-000000000001',probe=process.argv.includes('--probe-current');
await mkdir(path.join(folder,'app'),{recursive:true});await mkdir(path.join(folder,'public'),{recursive:true});
await writeFile(path.join(folder,'package.json'),JSON.stringify({private:true,type:'module'}));
await writeFile(path.join(folder,'next.config.mjs'),`export default {turbopack:{root:${JSON.stringify(root)}}};`);
await copyFile(path.join(root,'public/offline-score-sw.js'),path.join(folder,'public/offline-score-sw.js'));
await writeFile(path.join(folder,'app/layout.tsx'),`import '../../../src/app/globals.css';import{RecoveryDocumentBoundary}from'../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><RecoveryDocumentBoundary actorId="${id}">{children}</RecoveryDocumentBoundary></body></html>}`);
if(probe){
 const original='src/app/tournament/[tournamentId]/setup/setup-client.tsx';
 const baseline=execFileSync('git',['show',`HEAD:${original}`],{cwd:root,encoding:'utf8'}).replace(/from (["'])(\.[^"']+)\1/g,(_all,_quote,ref)=>'from '+JSON.stringify(path.relative(path.join(folder,'app'),path.resolve(root,path.dirname(original),ref)).replaceAll('\\','/')));
 await writeFile(path.join(folder,'app/setup-baseline.tsx'),baseline);
}
await writeFile(path.join(folder,'app/page.tsx'),`import SetupClient from '${probe?'./setup-baseline':'../../../src/app/tournament/[tournamentId]/setup/setup-client'}';export default function Page(){return <main className="auth-shell"><section className="auth-card wide-card"><SetupClient actorId="${id}" tournamentId="${id}" registrationLinkManagementEnabled={false}/></section></main>}`);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',folder,'--hostname','127.0.0.1','--port','3262'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-not-a-credential'},stdio:['ignore','pipe','pipe']});
let logs='',browser,page;child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);const results=[];
try{
 const until=Date.now()+60000;let ready=false;while(Date.now()<until){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'task-owned local server became ready');
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of(probe?[390]:[390,768,1440]))for(const scenario of(probe?['no-q']:['no-q','combined','legacy-side','legacy-unbound','side-conflict','free','normalized-names','readback-mismatch','lost-response','newer-revision','corrupt-sidecar','rejected'])){
  const context=await browser.newContext({viewport:{width,height:1100}});page=await context.newPage();
  let workspace=qSetupPrizeWorkspace(id),writes=[],activationWrites=[],prizeVersions=[],mismatch=['readback-mismatch','corrupt-sidecar'].includes(scenario),loseResponse=scenario==='lost-response';const receipts=new Map();
  workspace.current.events[0].gameCount=12;workspace.current.events[0].entryFeeCents=0;
  await context.route('**/*',async route=>{if(!route.request().url().startsWith(base))return route.abort();return route.continue();});
  await page.route('**/api/v1/tournaments/*/setup',async route=>{
   if(route.request().method()==='POST'){
    const request=route.request().postDataJSON();if(scenario==='rejected')return route.fulfill({status:409,json:{status:'rejected',code:'invalid_request'}});assert.ok(scenario==='legacy-side'?isLegacySideSetupSaveRequest(request):isSetupSaveRequest(request));writes.push(request);if(['legacy-unbound','side-conflict'].includes(scenario))return route.fulfill({status:409,json:{error:scenario==='legacy-unbound'?'legacy_side_request_unbound':'side_pool_request_conflict'}});
    if(receipts.has(request.idempotencyKey))return route.fulfill({json:receipts.get(request.idempotencyKey)});
    const version=workspace.current.version+1;
    workspace={...workspace,current:{...request.payload,revisionId:id,version,createdAt:'2026-10-30T00:00:00Z',events:request.payload.events.map(e=>({...e,displayName:e.displayName.trim(),sourceStatus:'director_configured_unverified',qPools:e.qPools.map((p,i)=>({...p,poolTypeCode:p.poolTypeCode.trim(),slot:i+1,sourceStatus:'director_configured_unverified'})),sidePools:e.sidePools.map((p,i)=>({...p,poolTypeCode:p.poolTypeCode.trim(),slot:i+1,sourceStatus:'director_configured_unverified'}))}))},history:[{version,createdAt:'2026-10-30T00:00:00Z',eventCount:request.payload.events.length},...workspace.history]};
    const accepted={status:'setup_draft_saved',revisionId:id,version,eventCount:request.payload.events.length,operationalEventsCreated:false,rulesetApproved:false,seatingUpdated:false,financeUpdated:false,resultsUpdated:false,payoutsCalculated:false,qualifiersCalculated:false,accSubmissionCreated:false};receipts.set(request.idempotencyKey,accepted);
    if(loseResponse){loseResponse=false;return route.abort();}return route.fulfill({json:accepted});
   }
   const shown=structuredClone(workspace);if(mismatch&&receipts.size)shown.current.events[0].entryFeeCents=0;
   if(scenario==='newer-revision'&&receipts.size){shown.current.version=3;shown.current.revisionId='10000000-0000-4000-8000-000000000003';shown.history.unshift({version:3,createdAt:'2026-10-30T00:01:00Z',eventCount:1});}
   return route.fulfill({json:{workspace:shown,officialChoices:{directorProfileId:id,directorDisplayName:'Fictional Director',coDirectorProfileIds:[]},sidePoolTypesReady:scenario!=='legacy-side'}});
  });
  await page.route('**/setup/activation',async route=>{if(route.request().method()==='POST'){activationWrites.push(route.request().postDataJSON());return route.fulfill({status:409,json:{status:'rejected',code:'schedule_revision_required'}});}return route.fulfill({json:{status:'not_activated'}});});
  await page.route('**/setup/prize-schedules/*',async route=>{
   const rowId=route.request().url().split('/').at(-1);
   if(route.request().method()==='POST'){const request=route.request().postDataJSON();const version=prizeVersions.length+1;prizeVersions.unshift({scheduleId:`20000000-0000-4000-8000-${String(version).padStart(12,'0')}`,version,schedule:request.schedule,reason:request.reason,recordedAt:'2026-10-30T00:00:00Z'});return route.fulfill({json:{status:'prize_schedule_saved_v1',tournamentId:id,clientRowId:rowId,scheduleId:prizeVersions[0].scheduleId,version}});}
   return route.fulfill({json:{tournamentId:id,clientRowId:rowId,currentVersion:prizeVersions.length,activated:false,eventId:null,settingsCurrent:true,versions:prizeVersions}});
  });
  await page.route('**/setup-officials/**',route=>route.fulfill({status:503,json:{}}));
  await page.goto(base);const main=page.getByRole('group',{name:'Main Event 1',exact:true}),fee=main.getByRole('textbox',{name:'Entry fee',exact:true});
  await fee.waitFor();if(scenario==='free'){await main.getByRole('textbox',{name:'Event name',exact:true}).fill('Explicit free rehearsal');await main.getByRole('combobox',{name:'Entry type',exact:true}).selectOption('free');await main.getByRole('combobox',{name:'Entry type',exact:true}).selectOption('paid');assert.equal(await fee.inputValue(),'','returning to paid requires an explicit amount');await main.getByRole('combobox',{name:'Entry type',exact:true}).selectOption('free');}else await fee.fill('30.00');
  if(scenario==='normalized-names')await main.getByRole('textbox',{name:'Event name',exact:true}).fill('  Main with padding  ');
  if(!probe && scenario==='no-q'){
   const panel=page.locator('.sanctioning-fee-panel'),toggle=panel.getByRole('button',{name:'Adjust ACC sanctioning fee',exact:true});
   let rateRequests=[];
   await page.route('**/sanctioning-fee-rate',route=>{rateRequests.push(route.request().postDataJSON());return route.fulfill({status:409,json:{status:'rejected',code:'rate_locked_after_start'}});});
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   assert.equal(await panel.getByRole('textbox',{name:'Main rate per person',exact:true}).count(),0);
   await page.getByText(/Currently eligible participants: Main 0; Consolation 0/).waitFor();
   for(const [kind,oldAmount,newAmount] of [['Main','3.00','4.00'],['Consolation','1.00','2.00']]){
    await toggle.focus();await page.keyboard.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    await panel.getByRole('button',{name:`Adjust ${kind} rate`,exact:true}).click();
    const amount=panel.getByRole('textbox',{name:`${kind} rate per person`,exact:true}),reason=panel.getByRole('textbox',{name:/^Reason/}),submit=panel.getByRole('button',{name:`Save Adjusted ${kind} Rate`,exact:true});
    const otherKind=kind==='Main'?'Consolation':'Main',otherButton=panel.getByRole('button',{name:`Adjust ${otherKind} rate`,exact:true});
    assert.equal(await otherButton.isDisabled(),true);await panel.getByText(`Finish or cancel the ${kind} rate change first.`,{exact:true}).waitFor();
    assert.ok(await otherButton.getAttribute('aria-describedby'));assert.equal(await otherButton.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(231, 235, 239)');
    await amount.fill(newAmount);assert.equal(await submit.isDisabled(),true);
    for(const value of ['', '   ', '\t']){await reason.fill(value);assert.equal(await reason.getAttribute('aria-invalid'),'true');assert.equal(await submit.isDisabled(),true);}
    await amount.focus();await page.keyboard.press('Tab');assert.equal(await reason.evaluate(el=>el===document.activeElement),true,'amount then reason in keyboard order');
    await reason.fill('  TEST ONLY rate adjustment  ');assert.equal(await reason.getAttribute('aria-invalid'),'false');assert.equal(await submit.isDisabled(),false);
    await page.keyboard.press('Tab');assert.equal(await submit.evaluate(el=>el===document.activeElement),true,'reason then Save in keyboard order');
    const boxes=await Promise.all([amount,reason,submit].map(el=>el.boundingBox()));assert.ok(boxes[0].y<boxes[1].y&&boxes[1].y<boxes[2].y,'reason visually between amount and Save');
    assert.equal(await reason.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 244, 244)','reason input itself is pale red');
    for(const zoom of [100,200]){
     await page.evaluate(size=>document.documentElement.style.fontSize=size+'%',zoom);
     const box=await reason.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1,'required reason fits at enlarged text');
     await panel.screenshot({path:path.join(folder,`sanctioning-${kind.toLowerCase()}-reason-${width}-${zoom}.png`)});
    }
    await page.evaluate(()=>document.documentElement.style.fontSize='100%');
    await panel.getByRole('button',{name:'Cancel rate change',exact:true}).click();assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);assert.equal(rateRequests.length,kind==='Main'?0:1,'cancel never sends rate request');
    await page.keyboard.press('Space');assert.equal(await amount.inputValue(),oldAmount);
    await panel.getByRole('button',{name:`Adjust ${kind} rate`,exact:true}).click();assert.equal(await reason.inputValue(),'');
    await amount.fill(newAmount);await reason.fill('  TEST ONLY rate adjustment  ');await submit.click();
    await page.getByText(/Play has already started/).waitFor();assert.equal(rateRequests.at(-1).eventKind,kind.toLowerCase());assert.equal(rateRequests.at(-1).rateCents,Number(newAmount)*100);assert.equal(rateRequests.at(-1).reason,'TEST ONLY rate adjustment');
    await panel.getByRole('button',{name:'Cancel adjustments',exact:true}).click();assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
   }
   assert.equal(rateRequests.length,2,'one explicit valid mocked request for each rate; no hosted calls');
  }
  const save=page.getByRole('button',{name:'Save All Events Draft',exact:true});
  const notice=page.locator('#setup-draft-save-status');
  if(!probe){
  await notice.waitFor();assert.equal(await notice.getAttribute('role'),'status');assert.equal(await notice.getAttribute('aria-atomic'),'true');
  assert.match(await notice.innerText(),/Last verified save: version 1/);
  assert.equal(await notice.locator('time').getAttribute('datetime'),'2027-01-01T00:00:00.000Z');
  assert.equal(await save.getAttribute('aria-describedby'),'setup-draft-save-status');
  }

  const observed={width,input:scenario==='free'?'explicit free':await fee.inputValue(),saveDisabled:await save.isDisabled(),prizeEditors:await page.getByRole('region',{name:'Main prize schedule',exact:true}).count()};
  results.push({scenario,phase:'focused base fee before blur',...observed});
  if(probe){assert.equal(observed.saveDisabled,true,'old fee remained parent-zero until blur');assert.equal(observed.prizeEditors,0);await fee.press('Tab');await save.click();await page.getByText('Tournament setup version 2 was saved.',{exact:true}).waitFor();assert.equal(writes.at(-1).payload.events[0].entryFeeCents,3000);results.push({phase:'normal blur then save',persistedMinor:workspace.current.events[0].entryFeeCents});}
  else {
   assert.equal(observed.saveDisabled,false,'valid draft updates parent without blur');assert.equal(observed.prizeEditors,scenario==='free'?0:1);
   if(scenario==='combined'){
    await page.getByRole('button',{name:'Add Q Pool',exact:true}).click();const qp=page.getByRole('group',{name:'Q Pool 1',exact:true});await qp.getByRole('combobox',{name:'Pool type',exact:true}).selectOption({label:'Graduated (1-in-6)'});await qp.getByRole('textbox',{name:'Entry fee',exact:true}).fill('10.00');
    await page.getByRole('button',{name:'Add Q Pool',exact:true}).click();const q2=page.getByRole('group',{name:'Q Pool 2',exact:true});await q2.getByRole('combobox',{name:'Pool type',exact:true}).selectOption({label:'Equal (Pays All Equally)'});await q2.getByRole('textbox',{name:'Entry fee',exact:true}).fill('20.00');await qp.getByRole('button',{name:'Remove Q Pool',exact:true}).click();assert.equal(await qp.getByRole('textbox',{name:'Entry fee',exact:true}).inputValue(),'20.00');await qp.getByRole('combobox',{name:'Pool type',exact:true}).selectOption({label:'Graduated (1-in-6)'});await qp.getByRole('textbox',{name:'Entry fee',exact:true}).fill('10.00');
    await page.getByRole('button',{name:'Add Side Pool',exact:true}).click();let side=page.getByRole('group',{name:'Side Pool 1',exact:true});assert.equal(await side.getByRole('textbox',{name:'Pool name (optional)',exact:true}).inputValue(),'');await side.getByRole('textbox',{name:'Entry fee',exact:true}).fill('10.00');await save.click();assert.equal(writes.length,0,'missing Side payout type cannot save');assert.equal(await side.locator('option[value=equal]').evaluate(option=>option.disabled),true);assert.equal(await side.locator('option[value=equal-double]').evaluate(option=>option.disabled),true);await side.getByRole('combobox',{name:'Payout type',exact:true}).selectOption('graduated-1-in-6');await side.getByRole('textbox',{name:'Pool name (optional)',exact:true}).fill('Side 1-in-6');for(const bad of ['', ' ', '0', '1', '7', 'abc']){await side.getByRole('textbox',{name:'Entry fee',exact:true}).fill(bad);if(!await save.isDisabled())await save.click();assert.equal(writes.length,0,'invalid Side fee never writes');}await side.getByRole('textbox',{name:'Entry fee',exact:true}).fill('10.00');
    // Removing the first indexed pool must not transfer its local fee draft.
    await page.getByRole('button',{name:'Add Side Pool',exact:true}).click();const second=page.getByRole('group',{name:'Side Pool 2',exact:true});await second.getByRole('combobox',{name:'Payout type',exact:true}).selectOption('graduated-1-in-6');await second.getByRole('textbox',{name:'Pool name (optional)',exact:true}).fill('Retained second pool');await second.getByRole('textbox',{name:'Entry fee',exact:true}).fill('20.00');await side.getByRole('button',{name:'Remove Side Pool',exact:true}).click();
    side=page.getByRole('group',{name:'Side Pool 1',exact:true});assert.equal(await side.getByRole('textbox',{name:'Entry fee',exact:true}).inputValue(),'20.00');await side.getByRole('textbox',{name:'Pool name (optional)',exact:true}).fill(' Side 1-in-6 ');await side.getByRole('textbox',{name:'Entry fee',exact:true}).fill('10.00');
   }
   if(scenario==='legacy-side'){await page.getByRole('button',{name:'Add Side Pool',exact:true}).click();const legacy=page.getByRole('group',{name:'Side Pool 1',exact:true});await legacy.getByRole('textbox',{name:'Side Pool type/name',exact:true}).fill('Legacy compatible Side');await legacy.getByRole('textbox',{name:'Entry fee',exact:true}).fill('10.00');assert.equal(await legacy.getByRole('combobox',{name:'Payout type',exact:true}).count(),0);}
   if(scenario==='no-q'){
    for(const invalid of ['30.001','',' ','0','-1','0.99','2.99','abc']){await fee.fill(invalid);if(!await save.isDisabled())await save.click();assert.equal(writes.length,0,'invalid/blank fee cannot silently submit old value or zero');assert.equal(await fee.inputValue(),invalid);}
    await fee.fill('');await fee.pressSequentially('30.00');assert.equal(await fee.inputValue(),'30.00','typing decimals keeps focus and does not remount the money editor');
   }
   await save.click();
   if(scenario==='rejected'){
    await page.getByText('Draft was not saved. Review the error above.',{exact:true}).waitFor();
    assert.equal(await notice.locator('time').getAttribute('datetime'),'2027-01-01T00:00:00.000Z');
    assert.equal(await fee.inputValue(),'30.00');assert.equal(receipts.size,0);await context.close();results.push({scenario,width,phase:'rejected save retains fields and last verified time'});continue;
   }
   if(['legacy-unbound','side-conflict'].includes(scenario)){
    const warning=scenario==='legacy-unbound'?/This earlier save cannot verify its original Side Pool choices/:/This saved request no longer matches the original Side Pool choices/;await page.getByText(warning).waitFor();
    const retry=page.getByRole('button',{name:'Retry exact saved request',exact:true});assert.equal(await retry.isDisabled(),true);
    const key='tournament-setup:10000000-0000-4000-8000-000000000001:10000000-0000-4000-8000-000000000001';
    const original=await page.evaluate(k=>sessionStorage.getItem(k),key);assert.ok(original,'original pending request remains');
    await page.reload();await page.getByText(warning).waitFor();
    assert.equal(await page.getByRole('button',{name:'Retry exact saved request',exact:true}).isDisabled(),true);
    assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),key),original,'reload preserves original request');
    assert.equal(writes.length,1);assert.equal(activationWrites.length,0);results.push({scenario,width,phase:'unbound warning and original request persist across reload'});await context.close();continue;
   }
   if(['readback-mismatch','lost-response','newer-revision','corrupt-sidecar'].includes(scenario)){
    await page.getByText(scenario==='newer-revision'?/Another director saved a newer setup revision before this readback/:scenario==='lost-response'?/The save is unresolved\. Retry the exact saved version/:/Setup version 2 was accepted, but its saved fees and pools could not be verified/).waitFor();
    await page.getByRole('button',{name:'Retry exact saved request',exact:true}).waitFor();
    assert.equal(await notice.getAttribute('data-state'),'unresolved');assert.equal(await notice.getByText(/Saved successfully/).count(),0);
    const retained=await page.evaluate(()=>sessionStorage.getItem('tournament-setup:10000000-0000-4000-8000-000000000001:10000000-0000-4000-8000-000000000001'));
    assert.equal(JSON.parse(retained).request.payload.events[0].entryFeeCents,3000);
    assert.equal(JSON.parse(retained).accepted,undefined,'original recovery request is never overwritten with acknowledgement metadata');
    if(scenario!=='lost-response'){
     const ack=await page.evaluate(op=>JSON.parse(sessionStorage.getItem(`tournament-setup:10000000-0000-4000-8000-000000000001:10000000-0000-4000-8000-000000000001:accepted:${op}`)),JSON.parse(retained).request.idempotencyKey);
     assert.deepEqual(ack,{kind:'tournament-setup-accepted',operationId:JSON.parse(retained).request.idempotencyKey,revisionId:id,version:2});
    }
    const unavailableFinalize=page.getByRole('button',{name:'Finalize All Events / Open Registration',exact:true});
    assert.ok(await unavailableFinalize.count()===0 || await unavailableFinalize.isDisabled(),'pending readback cannot activate');
    if(scenario==='newer-revision'){await page.reload();assert.match(await notice.innerText(),/Last verified save: version 3/);assert.equal(await notice.getAttribute('data-state'),'unresolved');await page.getByText(/Another director saved a newer setup revision\. The accepted request/).waitFor();assert.equal(writes.length,1);assert.equal(activationWrites.length,0);results.push({scenario,width,phase:'newer revision blocks and preserves accepted original request across reload'});await context.close();continue;}
    if(scenario==='corrupt-sidecar'){
     await page.evaluate(op=>sessionStorage.setItem(`tournament-setup:10000000-0000-4000-8000-000000000001:10000000-0000-4000-8000-000000000001:accepted:${op}`,'{broken'),JSON.parse(retained).request.idempotencyKey);
     mismatch=false;await page.reload();await page.getByRole('button',{name:'Retry exact saved request',exact:true}).click();await page.getByText(/Saved financial terms are verified, but local recovery cleanup could not be confirmed/).waitFor();
     assert.equal(await notice.getAttribute('data-state'),'unresolved');assert.equal(await notice.getByText(/Saved successfully/).count(),0);assert.equal(receipts.size,1);assert.equal(activationWrites.length,0);assert.equal(await page.evaluate(()=>sessionStorage.getItem('tournament-setup:10000000-0000-4000-8000-000000000001:10000000-0000-4000-8000-000000000001')),retained);results.push({scenario,width,phase:'malformed acknowledgement retained; original retry survives reload and blocks finalization'});await context.close();continue;
    }
    mismatch=false;await page.reload();await page.getByRole('button',{name:'Retry exact saved request',exact:true}).click();
   }
   await page.getByText('Tournament setup version 2 was saved.',{exact:true}).waitFor();
   assert.equal(await notice.getAttribute('data-state'),'confirmed');
   assert.match(await notice.innerText(),/Saved successfully — setup version 2/);
   assert.equal(await notice.locator('time').getAttribute('datetime'),'2026-10-30T00:00:00Z');
   await notice.scrollIntoViewIfNeeded();
   for(const zoom of [100,200]){
    await page.evaluate(size=>document.documentElement.style.fontSize=size+'%',zoom);
    const box=await notice.boundingBox(),buttonBox=await page.getByRole('button',{name:'Save All Events Draft',exact:true}).boundingBox();
    assert.ok(box.width>250&&box.x>=0&&box.x+box.width<=width+1,'save status fits viewport');
    assert.ok(box.y>=buttonBox.y&&box.y-buttonBox.y<200,'confirmation adjacent to save control');
    await notice.screenshot({path:path.join(folder,`save-status-${width}-${zoom}.png`)});
   }
   await page.evaluate(()=>document.documentElement.style.fontSize='100%');
   assert.equal(workspace.current.events[0].entryFeeCents,scenario==='free'?0:3000);assert.equal(receipts.size,1,'retry reconciles exactly one accepted saved revision');
   if(scenario==='combined'){assert.deepEqual(workspace.current.events[0].qPools.map(p=>p.entryFeeCents),[1000]);assert.deepEqual(workspace.current.events[0].sidePools.map(p=>p.entryFeeCents),[1000]);assert.deepEqual(workspace.current.events[0].sidePools.map(p=>p.payoutType),['graduated-1-in-6']);}
   if(scenario!=='free'){
    const finalize=page.getByRole('button',{name:'Finalize All Events / Open Registration',exact:true});assert.equal(await finalize.isDisabled(),true,'missing regular declaration blocks new supported activation');
    await page.getByRole('combobox',{name:'Expected playoff qualifiers',exact:true}).selectOption('5');
    const weights=page.getByRole('group',{name:'Director selection',exact:true}).locator('input[type="number"]');
    assert.deepEqual(await weights.evaluateAll(es=>es.map(e=>e.labels[0].textContent)),['1st place weight','2nd place weight','3rd\u20134th per-person weight','5th place weight']);
    for(const [i,value] of ['4','3','2','1'].entries())await weights.nth(i).fill(value);
    await page.getByRole('textbox',{name:'Schedule source reference',exact:true}).fill('TEST ONLY approved standing rule');await page.getByRole('textbox',{name:'Reason for schedule',exact:true}).fill('TEST ONLY declare before payment');await page.getByRole('checkbox',{name:'I reviewed this schedule and its source',exact:true}).check();await page.getByRole('button',{name:'Save prize schedule',exact:true}).click();await page.getByText('Schedule saved. Reload to see authoritative versions.',{exact:true}).waitFor();await page.reload();
   }
   if(scenario==='legacy-side'){const loaded=page.getByRole('group',{name:'Side Pool 1',exact:true});assert.equal(await loaded.getByRole('textbox',{name:'Side Pool type/name',exact:true}).inputValue(),'Legacy compatible Side');assert.equal(Object.hasOwn(workspace.current.events[0].sidePools[0],'payoutType'),false);}
   if(scenario==='combined'){const loaded=page.getByRole('group',{name:'Side Pool 1',exact:true});assert.equal(await loaded.getByRole('combobox',{name:'Payout type',exact:true}).inputValue(),'graduated-1-in-6','saved type survives reload');}
   const finalize=page.getByRole('button',{name:'Finalize All Events / Open Registration',exact:true});await finalize.waitFor();
   await finalize.click();const dialog=page.getByRole('alertdialog');await dialog.waitFor();const summary=await dialog.innerText();assert.ok(summary.includes(scenario==='free'?'base entry $0.00':'base entry $30.00'));if(scenario==='combined'){assert.ok(summary.includes('Graduated (1-in-6) $10.00'));assert.ok(summary.includes('Side 1-in-6 $10.00'));}await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
   const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(dimensions.scroll<=dimensions.width+1);results.push({scenario,width,phase:'saved terms and declaration read back before activation',fee:workspace.current.events[0].entryFeeCents,q:workspace.current.events[0].qPools.map(p=>p.entryFeeCents),side:workspace.current.events[0].sidePools.map(p=>p.entryFeeCents),acceptedRevisions:receipts.size});
  }
  if(scenario==='no-q'){
   await page.reload();await page.getByText('Last saved setup is loaded.',{exact:true}).waitFor();
   assert.equal(await save.isDisabled(),true);assert.equal(await notice.getAttribute('data-state'),'loaded');
   await fee.fill('35.00');assert.equal(await notice.getAttribute('data-state'),'dirty');
   await save.click();await page.getByText('Saved successfully — setup version 3.',{exact:true}).waitFor();
   assert.equal(receipts.size,2);assert.equal(workspace.current.version,3);assert.equal(await save.isDisabled(),true);
   await page.reload();await page.getByText('Last saved setup is loaded.',{exact:true}).waitFor();assert.match(await notice.innerText(),/Last verified save: version 3/);
  }
  assert.equal(activationWrites.length,0);await context.close();
 }
 console.log(JSON.stringify({probe,results},null,2));
}catch(error){console.error(error);if(page){await writeFile(path.join(folder,'failure.txt'),await page.locator('body').innerText().catch(()=>''));await writeFile(path.join(folder,'failure-fields.json'),JSON.stringify(await page.locator('input').evaluateAll(es=>es.map(e=>({type:e.type,value:e.value,labels:[...(e.labels||[])].map(l=>l.textContent),disabled:e.disabled}))).catch(()=>[]),null,2));await page.screenshot({path:path.join(folder,'failure.png'),fullPage:true}).catch(()=>{});}process.exitCode=1;}
finally{await browser?.close();child.kill();await new Promise(r=>{if(child.exitCode!==null)return r();child.once('close',r);setTimeout(r,1500);});let localhostClosed=false;for(let i=0;i<10;i++){try{await fetch(base,{signal:AbortSignal.timeout(1000)});}catch(error){if(error.cause?.code==='ECONNREFUSED'){localhostClosed=true;break;}}await new Promise(r=>setTimeout(r,100));}if(!localhostClosed){console.error('Task-owned localhost server cleanup could not be confirmed');process.exitCode=1;}await writeFile(path.join(folder,'server.log'),logs);await writeFile(path.join(folder,probe?'probe.json':'results.json'),JSON.stringify({results,serverPid:child.pid,serverExit:child.exitCode,serverSignal:child.signalCode,localhostClosed},null,2));}
