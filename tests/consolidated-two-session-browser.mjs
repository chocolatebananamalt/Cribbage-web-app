// Actual React components; isolated browser sessions and deterministic server ports.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {chromium} from 'playwright-core';
import {deriveScore} from '../src/lib/score.ts';
const require=createRequire(import.meta.url),{webpack}=require('next/dist/compiled/webpack/webpack'),dir=path.resolve('test-results/consolidated-two-session');await fs.mkdir(dir,{recursive:true});
await fs.writeFile(path.join(dir,'ts.cjs'),`const ts=require('typescript');module.exports=function(s){return ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};`);
await fs.writeFile(path.join(dir,'css.cjs'),`module.exports=function(s){return 'const e=document.createElement("style");e.textContent='+JSON.stringify(s)+';document.head.append(e);';};`);
const ports=path.resolve('tests/fixtures/consolidated-acceptance-ports.offline');
await new Promise((ok,no)=>{const c=webpack({mode:'production',devtool:false,context:process.cwd(),target:'web',entry:path.resolve('tests/fixtures/consolidated-acceptance.offline'),output:{path:dir,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js','.offline']},module:{rules:[{test:/\.(tsx?|offline)$/,exclude:/node_modules/,use:path.join(dir,'ts.cjs')},{test:/\.css$/,use:path.join(dir,'css.cjs')}]},plugins:[new webpack.NormalModuleReplacementPlugin(/^next\/navigation$|\/(player-page-frame|manual-mixed-handoff-v1|game-player-location|makeup-card-lines|judge-call-button|offline-score-queue|offline-score-page-cache|client-session-storage|recovery-write-coordinator|recovery-preflight|recovery-owner)$/,r=>{r.request=ports;})],optimization:{minimize:false}});c.run((e,s)=>c.close(x=>e||x||s?.hasErrors()?no(e??x??Error(s.toString({all:false,errors:true}))):ok()));});
const bundle=await fs.readFile(path.join(dir,'bundle.js'),'utf8'),browser=await chromium.launch({channel:'chrome',headless:true}),results={footer:[],sequences:[],pendingUnmount:[],realAuth:false,realDatabase:false,actualRsc:false,serviceWorkers:false};
const id=n=>`bc120000-0000-4000-8000-${String(n).padStart(12,'0')}`,tid=id(1),game=id(2),event=id(3),actors={laptop:id(4),phone:id(5)},submissions={laptop:id(6),phone:id(7)};
const complete='Game complete. Your scorecard is updated.',waiting="Your confirmation is saved. Waiting for the other player's confirmation.";
async function instrument(page){
 await page.clock.install({time:new Date('2027-02-03T12:00:00Z')});await page.clock.pauseAt(new Date('2027-02-03T12:00:00.001Z'));
 await page.evaluate(()=>{
  window.timerEvidence={active:new Map(),cleared:[],listeners:[]};const e=window.timerEvidence,set=window.setInterval.bind(window),clear=window.clearInterval.bind(window);
  window.setInterval=(fn,ms,...args)=>{const key=set(fn,ms,...args);e.active.set(key,{fn,ms});return key;};window.clearInterval=key=>{if(e.active.has(key))e.cleared.push(e.active.get(key).ms);e.active.delete(key);clear(key);};
  for(const target of [window,document]){const add=target.addEventListener.bind(target),remove=target.removeEventListener.bind(target);target.addEventListener=(type,fn,...args)=>{e.listeners.push({target,type,fn,active:true});return add(type,fn,...args);};target.removeEventListener=(type,fn,...args)=>{for(const x of e.listeners)if(x.target===target&&x.type===type&&x.fn===fn)x.active=false;return remove(type,fn,...args);};}
 });
 await page.addScriptTag({content:bundle});assert.equal(await page.evaluate(()=>document.visibilityState),'visible');
}
function server(){
 const confirmed=new Map(),posts=[],reads=[];
 const state=()=>confirmed.size===2?'verified':'confirmation_pending';
 const context=device=>({actorId:actors[device],tournamentId:tid,eventId:event,gameId:game,roundNumber:1,matchInstance:1,state:state(),eventName:'Fictional Main',ownSubmission:{id:submissions[device],winnerSide:'a',margin:15},ownConfirmed:confirmed.has(device),canConfirm:state()==='confirmation_pending',progressionStatus:'current',canEnter:false,player:{displayName:`Fictional ${device} player`,side:device==='laptop'?'a':'b',tableSeat:device==='laptop'?'A-1':'A-2',verificationId:device==='laptop'?'A-1':'A-2'},opponent:{displayName:`Fictional ${device==='laptop'?'phone':'laptop'} player`,side:device==='laptop'?'b':'a',tableSeat:device==='laptop'?'A-2':'A-1',verificationId:device==='laptop'?'A-2':'A-1'}});
 const scorecard=()=>({source:'deterministic fixture authority, not a database',state:state(),submissionCount:2,confirmationCount:confirmed.size,rows:confirmed.size===2?['laptop','phone'].map(device=>{const score=deriveScore(15,device==='laptop'?'player':'opponent');return{participant:device,gamePoints:score.playerGamePoints,plus:score.playerPlus,minus:score.playerMinus};}):[]});
 const route=device=>async r=>{const request=r.request(),url=new URL(request.url());
  if(url.pathname==='/app')return r.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
  if(url.pathname==='/fixture/context'){assert.equal(request.method(),'GET');reads.push({device,state:state()});return r.fulfill({json:context(device)});}
  if(url.pathname==='/fixture/scorecard'){assert.equal(request.method(),'GET');return r.fulfill({json:scorecard()});}
  assert.equal(url.pathname,`/api/v1/games/${game}/confirmations`);assert.equal(request.method(),'POST');const body=request.postDataJSON();assert.deepEqual(Object.keys(body).sort(),['idempotencyKey','submissionId']);assert.equal(body.submissionId,submissions[device]);assert.match(body.idempotencyKey,/^[0-9a-f-]{36}$/);assert(!confirmed.has(device),'duplicate confirmation');posts.push({device,body});confirmed.set(device,body.idempotencyKey);return r.fulfill({json:{game_id:game,status:state()}});
 };
 return{context,route,scorecard,posts,reads};
}
try{
 for(const width of [390,1440]){
  const c=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),p=await c.newPage();await c.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));await p.goto('https://fixture.invalid/app');await instrument(p);await p.evaluate(()=>sessionStorage.setItem('fictional-retained-recovery','preserve exact bytes'));
  for(const [offline,retry]of [[0,0],[1,0],[2,0],[0,1],[0,2],[1,1],[2,3]]){
   await p.evaluate(counts=>window.mountFooter(counts),{offline,retry});await p.clock.runFor(1);
   const status=p.getByRole('status');if(!offline&&!retry)await status.filter({hasText:'This device has no unsent score entries or retry records.'}).waitFor();else{const pieces=[offline?`${offline} offline score ${offline===1?'entry':'entries'}`:'',retry?`${retry} retry ${retry===1?'record':'records'}`:''].filter(Boolean);await status.filter({hasText:`${pieces.join(' and ')} ${offline+retry===1?'is':'are'} still stored locally.`}).waitFor();}
   assert.equal(await p.getByRole('button',{name:'Clear safe app data and sign out',exact:true}).count(),!offline&&!retry?1:0);assert.equal(await p.evaluate(()=>sessionStorage.getItem('fictional-retained-recovery')),'preserve exact bytes');assert.equal(await p.evaluate(()=>window.fixtureStats.forbiddenActions+window.fixtureStats.recoveryWrites),0);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));results.footer.push({width,offline,retry,passed:true});
  }await c.close();
 }
 for(const order of [['laptop','phone'],['phone','laptop']]){
  const fixture=server(),sessions={};
  try{
   for(const device of ['laptop','phone']){const c=await browser.newContext({viewport:{width:device==='laptop'?1440:390,height:1000},serviceWorkers:'block'}),p=await c.newPage();await c.route('**/*',fixture.route(device));await p.goto('https://fixture.invalid/app');await instrument(p);await p.evaluate(context=>window.mountScore(context),fixture.context(device));await p.clock.runFor(1);await p.getByRole('button',{name:'Confirm My Entry',exact:true}).waitFor();assert.equal(await p.evaluate(()=>[...window.timerEvidence.active.values()].filter(x=>x.ms===10000).length),1);sessions[device]={c,p};}
   const first=sessions[order[0]].p,second=sessions[order[1]].p;
   await first.getByRole('button',{name:'Confirm My Entry',exact:true}).click();await first.getByText(waiting,{exact:true}).waitFor();assert.equal(await first.getByRole('button',{name:'Confirm My Entry',exact:true}).count(),0);
   await first.clock.runFor(9999);assert.equal(fixture.reads.length,0);await first.clock.runFor(1);await first.waitForFunction(()=>window.fixtureStats.readbacks.length===1);
   assert.deepEqual(await first.evaluate(()=>window.fixtureStats.readbacks[0]),{state:'confirmation_pending',ownConfirmed:true,canConfirm:true});assert.equal(await first.getByRole('button',{name:'Confirm My Entry',exact:true}).count(),0);await first.getByText(waiting,{exact:true}).waitFor();
   await second.getByRole('button',{name:'Confirm My Entry',exact:true}).click();await second.getByText(complete,{exact:true}).waitFor();
   const immediate={};for(const device of ['laptop','phone'])immediate[device]=await sessions[device].p.locator('.player-entry-status').textContent();
   assert(await first.getByText(waiting,{exact:true}).isVisible());assert(await second.getByText(complete,{exact:true}).isVisible());
   const authoritative=await second.evaluate(()=>fetch('/fixture/scorecard').then(r=>r.json()));assert.equal(authoritative.state,'verified');assert.equal(authoritative.submissionCount,2);assert.equal(authoritative.confirmationCount,2);assert.deepEqual(authoritative.rows,[{participant:'laptop',gamePoints:2,plus:15,minus:0},{participant:'phone',gamePoints:0,plus:0,minus:15}]);
   await first.clock.runFor(9999);assert(await first.getByText(waiting,{exact:true}).isVisible());await first.clock.runFor(1);await first.getByText(complete,{exact:true}).waitFor();
   await second.clock.runFor(10000);await second.waitForFunction(()=>window.currentFixtureContext.state==='verified');
   for(const device of ['laptop','phone']){const p=sessions[device].p;assert(await p.getByText(complete,{exact:true}).isVisible());assert.equal(await p.getByRole('button',{name:'Confirm My Entry',exact:true}).count(),0);assert.equal(await p.evaluate(()=>[...window.timerEvidence.active.values()].filter(x=>x.ms===10000).length),0);assert.equal(await p.evaluate(()=>window.timerEvidence.listeners.filter(x=>x.active&&(/router\.refresh/.test(String(x.fn))||String(x.fn).includes('acc-score-result-accepted'))).length),0);assert.equal(await p.evaluate(()=>window.fixtureStats.forbiddenActions),0);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.evaluate(()=>window.unmountFixture());await p.clock.runFor(1);assert.equal(await p.evaluate(()=>[...window.timerEvidence.active.values()].filter(x=>x.ms===10000).length),0);}
   assert.equal(fixture.posts.length,2);assert.equal(fixture.posts.filter(x=>x.device==='laptop').length,1);assert.equal(fixture.posts.filter(x=>x.device==='phone').length,1);
   results.sequences.push({order,participants:actors,viewports:{laptop:1440,phone:390},immediatelyAfterSecond:immediate,authoritative,firstDeviceUpdatesAutomaticallyAfterNextTenSecondPoll:true,manualRefreshUsed:false,confirmationPosts:fixture.posts.length,submissionPosts:0,duplicatePosts:0,ownConfirmedProtectsAgainstRawCanConfirmTrue:true,pollingCleanedAfterVerifiedAndUnmount:true});
  }finally{for(const {c}of Object.values(sessions))await c.close();}
 }
 for(const [device,width]of [['laptop',1440],['phone',390]]){
  const fixture=server(),c=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),p=await c.newPage();try{await c.route('**/*',fixture.route(device));await p.goto('https://fixture.invalid/app');await instrument(p);await p.evaluate(context=>window.mountScore(context),fixture.context(device));await p.clock.runFor(1);await p.getByRole('button',{name:'Confirm My Entry',exact:true}).waitFor();assert.equal(await p.evaluate(()=>[...window.timerEvidence.active.values()].filter(x=>x.ms===10000).length),1);await p.evaluate(()=>window.unmountFixture());await p.clock.runFor(1);assert.equal(await p.evaluate(()=>[...window.timerEvidence.active.values()].filter(x=>x.ms===10000).length),0);assert.equal(await p.evaluate(()=>window.timerEvidence.listeners.filter(x=>x.active&&(/router\.refresh/.test(String(x.fn))||String(x.fn).includes('acc-score-result-accepted'))).length),0);await p.clock.runFor(10000);assert.equal(fixture.reads.length,0);assert.equal(fixture.posts.length,0);results.pendingUnmount.push({device,width,activePollingBefore:true,timerAndPollListenersRemoved:true,noReadOrWriteAfterUnmount:true});}finally{await c.close();}
 }
}finally{await browser.close();}
await fs.writeFile(path.join(dir,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
