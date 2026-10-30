// LOCAL isolated Chrome contexts and fictional intercepted APIs only.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {spawn}from'node:child_process';import{chromium}from'playwright-core';
import{oddFieldFixture}from'./fixtures/odd-field-makeup.mjs';
const root=process.cwd(),dir=path.join(root,'test-results/odd-field-makeup-browser'),origin='http://127.0.0.1:3254';
const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`,actor=id(90),tid=id(80),eid=id(81),f=oddFieldFixture();
const workspace={tournamentName:'TEST ONLY seventeen-player Main',registrationClosed:true,tableCount:5,seatsPerTable:4,
 events:[{eventId:eid,name:'Main',format:'standard_singles',scoringMethod:'digital',gameCount:12,participantCount:17,schedulePublished:false,schedulePublicationId:null,participantSnapshotDigest:null,publishedMatchCount:0,playState:'preparing',startedAt:null,startedBy:null}],
 participants:f.verificationIds.map((verificationId,i)=>({eventId:eid,participantId:id(i+1),displayName:`Player${String(i+1).padStart(2,'0')}`,verificationId,profileLinked:true})),matches:[]};
const initial={tournamentId:tid,eventId:eid,current:false,policyVersion:'acc-director-manual-2019-12b-even-game-makeup-v1',qualifyingGameCount:12,makeupBatchNumber:13,makeups:[]};
const saved={status:'odd_field_schedule_published',eventId:eid,publicationId:id(20),gameCount:12,participantCount:17,regularMatchCount:96,makeupMatchCount:6,matchCount:102};
const mapped={...initial,current:true,makeups:Array.from({length:6},(_,i)=>({canonicalGameId:id(30+i),publicationId:id(20),sideACardGameNumber:i+1,sideBCardGameNumber:12-i,reason:'TEST ONLY reviewed source',recordedAt:'2026-10-30T00:00:00Z',actorId:actor}))};
const csv=['Game,Player A ID,Player B ID,Player A Table/Seat,Player B Table/Seat',...f.regularMatches.map(m=>[m.gameNumber,m.sideAVerificationId,m.sideBVerificationId,m.sideATableSeat,m.sideBTableSeat].join(','))].join('\n');
const seats=['Player A Table/Seat,Player B Table/Seat',...f.makeupSeats.map(s=>[s.sideATableSeat,s.sideBTableSeat].join(','))].join('\n');
const key=`event-schedule:${actor}:${tid}:odd-makeup:${eid}`,checks=[],writes=[];let mode='success',receipt=null,current=initial,browser,page,context,logs='';
await fs.mkdir(path.join(dir,'app'),{recursive:true});await fs.mkdir(path.join(dir,'public'),{recursive:true});
await fs.writeFile(path.join(dir,'package.json'),'{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir,'next.config.mjs'),`export default{turbopack:{root:${JSON.stringify(root)}}};`);
await fs.copyFile('public/offline-score-sw.js',path.join(dir,'public/offline-score-sw.js'));
await fs.writeFile(path.join(dir,'app/layout.tsx'),`import '../../../src/app/globals.css';import{RecoveryDocumentBoundary}from'../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return <html><body><RecoveryDocumentBoundary actorId="${actor}">{children}</RecoveryDocumentBoundary></body></html>}`);
await fs.writeFile(path.join(dir,'app/page.tsx'),`import Client from '../../../src/app/tournament/[tournamentId]/events/[eventId]/odd-field-makeup/makeup-client';import{MakeupCardLines}from'../../../src/components/makeup-card-lines';const workspace=${JSON.stringify(workspace)} as import('../../../src/lib/api/event-schedule').EventScheduleWorkspace;const initial=${JSON.stringify(initial)} as import('../../../src/lib/api/odd-field-makeup').OddFieldMakeupWorkspace;export default function Page(){return <main className="auth-shell"><section className="auth-card corrections-card"><h1>TEST ONLY qualifying makeups</h1><Client actorId="${actor}" tournamentId="${tid}" eventId="${eid}" workspace={workspace} initial={initial}/><aside data-testid="digital-card-line"><MakeupCardLines numbers={{gameId:'${id(30)}',eventId:'${eid}',schedulingBatchNumber:13,sideACardGameNumber:1,sideBCardGameNumber:12,isMakeup:true}} sideAName="Digital player A" sideBName="Paper player B"/></aside></section></main>}`);
const numbers={gameId:id(30),eventId:eid,schedulingBatchNumber:13,sideACardGameNumber:1,sideBCardGameNumber:12,isMakeup:true};
const digital={actorId:actor,gameId:id(30),tournamentId:tid,eventId:eid,roundNumber:13,matchInstance:1,state:'pending',eventName:'TEST ONLY Main',ownSubmission:null,ownConfirmed:false,canConfirm:false,progressionStatus:'current',canEnter:true,
 player:{displayName:'Player A',side:'a',tableSeat:'A-1',verificationId:'B-1'},opponent:{displayName:'Player B',side:'b',tableSeat:'A-2',verificationId:'D-1'},cardNumbers:numbers};
const paper={gameId:id(30),eventId:eid,eventName:'TEST ONLY Main',gameNumber:13,gameVersion:1,
 sideA:{displayName:'Player A',verificationId:'B-1',profileLinked:false},sideB:{displayName:'Player B',verificationId:'D-1',profileLinked:false}};
const hybrid={gameId:id(30),eventId:eid,eventName:'TEST ONLY Main',gameNumber:13,gameVersion:1,digitalSubmissionId:id(40),digitalWinnerSide:'a',digitalMargin:10,digitalSide:'a',digitalPlayerName:'Player A',paperPlayerName:'Player B',paperVerificationId:'D-1'};
const markup={
 digital:`import{LiveScoreEntry}from'../../../../src/app/tournament/[tournamentId]/game/[gameId]/score-entry';const context=${JSON.stringify(digital)} as import('../../../../src/lib/games/assigned-game-context').AssignedGameContext;export default function Page(){return <LiveScoreEntry context={context} cardNumbers={context.cardNumbers}/>}`,
 paper:`import Client from'../../../../src/app/tournament/[tournamentId]/paper-games/paper-game-client';const game=${JSON.stringify(paper)} as import('../../../../src/lib/paper-games/workspace').PaperGameCandidate;export default function Page(){return <main className="auth-shell"><section className="auth-card corrections-card"><Client actorId="${actor}" tournamentId="${tid}" actorRole="cross_checker" actorIdentityConfirmed={true} unboundOfficials={[]} rosterChoices={[]} candidates={[game]} reviewCases={[]} cardNumberContexts={{'${id(30)}':${JSON.stringify(numbers)}}}/></section></main>}`,
 hybrid:`import Client from'../../../../src/app/tournament/[tournamentId]/hybrid-games/hybrid-game-client';const game=${JSON.stringify(hybrid)} as import('../../../../src/lib/hybrid-games/workspace').HybridGameItem;export default function Page(){return <main className="auth-shell"><section className="auth-card corrections-card"><Client actorId="${actor}" tournamentId="${tid}" actorRole="cross_checker" actorIdentityConfirmed={true} candidates={[game]} reviewCases={[]} cardNumberContexts={{'${id(30)}':${JSON.stringify(numbers)}}}/></section></main>}`,
};
for(const[name,source]of Object.entries(markup)){await fs.mkdir(path.join(dir,'app',name),{recursive:true});await fs.writeFile(path.join(dir,'app',name,'page.tsx'),source);}
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',dir,'--hostname','127.0.0.1','--port','3254'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
await fs.writeFile('test-results/odd-field-makeup-browser-process.json',JSON.stringify({pid:child.pid,origin}));
async function open(){context=await browser.newContext();page=await context.newPage();await page.route('**/api/v1/tournaments/**/odd-field-makeup**',async route=>{
 const r=route.request();assert.ok(r.url().startsWith(origin));
 if(r.url().endsWith('/reconciliation')){const b=JSON.parse(r.postData());assert.deepEqual(Object.keys(b).sort(),['operationId','request']);return route.fulfill({json:{authorized:true,result:receipt}});}
 if(r.method()==='GET')return route.fulfill({json:current});
 const body=JSON.parse(r.postData());writes.push({body,key:r.headers()['x-idempotency-key']});await new Promise(r=>setTimeout(r,80));
 if(mode==='abort')return route.abort();if(mode==='stale')return route.fulfill({status:409,json:{status:'rejected',code:'schedule_already_published'}});
 current=mapped;return route.fulfill({json:saved});
});}
const status=text=>page.getByRole('status').filter({hasText:text}).waitFor();
const go=async()=>{await page.goto(origin);await status('Review the regular schedule');};
const publish=()=>page.getByRole('button',{name:'Publish regular and makeup schedule',exact:true});
const retry=()=>page.getByRole('button',{name:'Check status and retry exact schedule',exact:true});
const fill=async()=>{await page.getByLabel(/^Regular schedule CSV/).fill(csv);await page.getByLabel(/^Six makeup table/).fill(seats);
 await page.getByLabel('Director review reason',{exact:true}).fill('TEST ONLY reviewed all source pairings');await page.getByRole('checkbox',{name:'This schedule uses zero stationary/anchor seats.',exact:true}).check();
 await page.getByRole('checkbox',{name:/I reviewed all regular pairings/}).check();};
try{
 let ready=false;for(let end=Date.now()+180000;Date.now()<end;){try{if((await fetch(origin,{signal:AbortSignal.timeout(20000)})).ok){ready=true;break;}}catch(e){if(['EACCES','EPERM'].includes(e.cause?.code))throw e;}await new Promise(r=>setTimeout(r,300));}assert.ok(ready,'local fixture ready');
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of[390,1440]){await open();await page.setViewportSize({width,height:1000});current=initial;receipt=null;mode='success';await go();assert.ok(await publish().isDisabled());await fill();
  await page.getByText('102 matches total; each of 17 players has exactly 12.',{exact:true}).waitFor();const lines=await page.locator('section ul li').allTextContents();assert.ok(lines.some(t=>t.includes('card game 1')&&t.includes('card game 12')));
  assert.ok((await page.getByTestId('digital-card-line').innerText()).includes('not a thirteenth game'));assert.ok(await publish().isEnabled());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`test-results/odd-field-makeup-${width}.png`,fullPage:true});
  const before=writes.length;await publish().evaluate(b=>{b.click();b.click();});await status('Published 102 real qualifying games');assert.equal(writes.length,before+1);assert.equal(writes.at(-1).body.anchorCount,0);assert.equal(writes.at(-1).body.regularMatches.length,96);assert.equal(writes.at(-1).body.makeupSeats.length,6);assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),key),null);assert.ok(await publish().isDisabled());
  checks.push(`17/12 original card-line and six makeup preview, explicit zero anchors/review, 102 matches, single-flight and no overflow ${width}`);await context.close();}
 for(const width of[390,1440]){await open();await page.setViewportSize({width,height:1000});
  for(const screen of['digital','paper','hybrid']){await page.goto(origin+'/'+screen);await page.getByText('Qualifying makeup, scheduling batch 13.',{exact:true}).waitFor();
   const body=await page.locator('body').innerText();assert.ok(body.includes('Player A: original card game 1'));assert.ok(body.includes('Player B: original card game 12'));
   assert.ok(!body.includes('Game 13'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`test-results/odd-field-${screen}-${width}.png`,fullPage:true});
  }
  checks.push(`actual digital, paper and hybrid entry components show original 1/12 card lines and scheduling batch, no thirteen-game claim or overflow ${width}`);await context.close();
 }
 await open();current=initial;receipt=null;mode='abort';await go();await fill();await publish().click();await status('Publication could not be confirmed');const raw=await page.evaluate(k=>sessionStorage.getItem(k),key);assert.ok(raw);
 await page.reload();await status('No completed receipt');assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),key),raw);mode='success';await retry().click();await status('Published 102 real qualifying games');assert.deepEqual(writes.at(-1),writes.at(-2));checks.push('interruption/reload retains full exact schedule and operation; explicit reconciled retry');
 receipt=saved;await page.evaluate(({key,raw})=>sessionStorage.setItem(key,raw),{key,raw});const before=writes.length;await page.reload();await status('Published 102 real qualifying games');assert.equal(writes.length,before);assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),key),null);checks.push('lost-response success reconciles without another publication');
 receipt={status:'rejected',code:'idempotency_conflict'};await page.evaluate(({key,raw})=>sessionStorage.setItem(key,raw),{key,raw});await page.reload();await status('Operation conflict');assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),key),raw);assert.ok(await retry().isDisabled());checks.push('full-request conflict preserves work and blocks retry');await context.close();
 await open();current=initial;receipt=null;mode='stale';await go();await fill();await publish().click();await status('Publication rejected: schedule already published');assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),key),null);checks.push('known duplicate publication rejection clears only its exact retained request');
 await fs.writeFile('test-results/odd-field-makeup-browser-results.json',JSON.stringify({status:'PASS',checks,writes:writes.length,limitations:'Actual React/recovery UI, local mocked APIs; real SQL and full multi-device backend checks are separate.'},null,2));console.log(JSON.stringify({status:'PASS',checks,writes:writes.length},null,2));
}catch(e){if(page){await fs.writeFile('test-results/odd-field-makeup-browser-failure.txt',await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:'test-results/odd-field-makeup-browser-failure.png',fullPage:true}).catch(()=>{});}throw e;}
finally{await browser?.close();if(child.exitCode===null){const done=new Promise(r=>child.once('close',r));child.kill();await done;}await fs.writeFile('test-results/odd-field-makeup-browser-server.log',logs);
 assert.ok(path.resolve(dir).startsWith(path.resolve(root,'test-results')+path.sep));await fs.rm(dir,{recursive:true,force:true});}
