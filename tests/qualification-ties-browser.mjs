// Fictional isolated UI acceptance. No hosted service or real credentials.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
const root=process.cwd(),dir=path.join(root,"test-results/qualification-ties-browser"),origin="http://127.0.0.1:3248";
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const actor=id(90),tid=id(80),eid=id(81),pair=[id(2),id(3)],fingerprint="a".repeat(64);
const group={candidateIds:pair,numericRank:2,affectsQualificationCut:true,method:"one_game_playoff",headToHeadGameId:null,headToHeadWinnerId:null,resolution:null};
const source={tournamentId:tid,eventId:eid,sourceFingerprint:fingerprint,finalized:false,blockers:[],groups:[group]};
const cases={manual:source,resolved:{...source,groups:[{...group,resolution:{id:id(20),winnerId:id(3),method:"one_game_playoff",reason:"TEST ONLY separately played winner",evidenceReference:"TEST ONLY playoff record 1",recordedAt:"2026-10-29T10:00:00Z",recordedBy:actor}}]},h2h:{...source,groups:[{...group,method:"head_to_head",headToHeadGameId:id(40),headToHeadWinnerId:id(3)}]},multi:{...source,groups:[{...group,candidateIds:[...pair,id(4)],method:"blocked"}]},ambiguous:{...source,groups:[{...group,method:"blocked"}]},blocked:{...source,blockers:["dispute_open"]},unavailable:null};
await fs.mkdir(path.join(dir,"app"),{recursive:true});await fs.mkdir(path.join(dir,"public"),{recursive:true});
await fs.writeFile(path.join(dir,"package.json"),'{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir,"next.config.mjs"),`export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.copyFile(path.join(root,"public/offline-score-sw.js"),path.join(dir,"public/offline-score-sw.js"));
await fs.writeFile(path.join(dir,"app/layout.tsx"),`import '../../../src/app/globals.css';import {RecoveryDocumentBoundary} from '../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return <html><body><RecoveryDocumentBoundary actorId="${actor}">{children}</RecoveryDocumentBoundary></body></html>}`);
for(const [name,value] of Object.entries(cases)){
 await fs.mkdir(path.join(dir,"app",name),{recursive:true});
 await fs.writeFile(path.join(dir,"app",name,"page.tsx"),`import Client from '../../../../src/app/tournament/[tournamentId]/results/qualification-ties-client';const source=${JSON.stringify(value)} as import('../../../../src/lib/api/qualification-ties').QualificationTieWorkspace|null;export default function Page(){return <main className="auth-shell"><section className="auth-card standings-card"><h1>Fictional qualifying scorecards</h1><p>Player2 and Player3: 10 game points,3wins,net+10,grossplus50. Original totals unchanged.</p><Client actorId="${actor}" tournamentId="${tid}" eventId="${eid}" source={source} candidates={[{id:"${id(2)}",displayName:"Player2"},{id:"${id(3)}",displayName:"Player3"},{id:"${id(4)}",displayName:"Player4"}]}/></section></main>}`);
}
const child=spawn(process.execPath,["node_modules/next/dist/bin/next","dev",dir,"--hostname","127.0.0.1","--port","3248"],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:"1"},stdio:["ignore","pipe","pipe"]});
let logs="",browser,mode="success",reconciled=null;const writes=[],checks=[];
child.stdout.on("data",v=>logs+=v);child.stderr.on("data",v=>logs+=v);
await fs.writeFile(path.join(root,"test-results/qualification-ties-browser-process.json"),JSON.stringify({pid:child.pid,origin}));
const outcome=r=>({status:"qualification_tie_recorded",eventId:eid,resolutionId:id(20),sourceFingerprint:r.expectedSourceFingerprint,participantIds:r.participantIds,winnerId:r.winnerId,method:r.method});
try{
 let ready=false;for(let until=Date.now()+180000;Date.now()<until;){try{if((await fetch(origin+"/manual",{signal:AbortSignal.timeout(20000)})).ok){ready=true;break;}}catch(error){if(["EACCES","EPERM"].includes(error.cause?.code))throw error;}await new Promise(r=>setTimeout(r,300));}
 assert.ok(ready,"local test page ready");
 browser=await chromium.launch({channel:"chrome",headless:true});const context=await browser.newContext(),page=await context.newPage();
 await page.route("**/api/v1/tournaments/**/qualification-ties**",async route=>{
  const request=route.request();assert.ok(request.url().startsWith(origin));
  if(request.url().endsWith("/reconciliation")){const retained=JSON.parse(request.postData());assert.deepEqual(Object.keys(retained).sort(),["operationId","request"]);assert.ok(retained.request.reason&&retained.request.evidenceReference);return route.fulfill({json:{authorized:true,result:reconciled}});}
  const body=JSON.parse(request.postData());writes.push({body,key:request.headers()["x-idempotency-key"]});await new Promise(r=>setTimeout(r,120));
  if(mode==="abort")return route.abort();
  if(mode==="stale")return route.fulfill({status:409,json:{status:"rejected",eventId:eid,code:"stale_source"}});
  return route.fulfill({json:outcome(body)});
 });
 const go=async name=>{await page.goto(origin+"/"+name);await page.getByRole("heading",{name:"Qualification tie review"}).waitFor();await page.getByRole("status").filter({hasText:/Review|retained|recorded|uncertain|receipt/}).waitFor();};
 const fill=async()=>{await page.getByRole("combobox",{name:/^One-game playoff winner/}).selectOption(id(3));await page.getByLabel("Resolution reason",{exact:true}).fill("TEST ONLY separately played winner");await page.getByLabel("Evidence or playoff record reference",{exact:true}).fill("TEST ONLY playoff record 1");};
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});await go("manual");
  const button=page.getByRole("button",{name:"Record qualification tie resolution"});
  assert.ok(await button.isDisabled());await page.getByText("Cut for first deal.",{exact:false}).waitFor();await fill();assert.ok(await button.isDisabled());
  await page.getByRole("checkbox").check();await button.evaluate(b=>{b.click();b.click()});await page.getByRole("status").filter({hasText:"Qualification tie resolution recorded"}).waitFor();
  assert.equal(writes.at(-1).body.winnerId,id(3));assert.equal(writes.at(-1).body.method,"one_game_playoff");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(root,`test-results/qualification-ties-${width}.png`),fullPage:true});
  await go("h2h");assert.equal(await page.getByRole("combobox").count(),0);await page.getByText("Player3 won.",{exact:false}).waitFor();
  await go("resolved");await page.getByText("Tie resolved: Player3 ranks higher.",{exact:false}).waitFor();await page.getByText("Evidence: TEST ONLY playoff record 1.",{exact:false}).waitFor();assert.equal(await page.getByRole("button",{name:"Record qualification tie resolution"}).count(),0);await page.getByText("Player2 and Player3: 10 game points,3wins,net+10,grossplus50. Original totals unchanged.",{exact:true}).waitFor();
  for(const name of ["multi","ambiguous","blocked","unavailable"]){await go(name);assert.equal(await page.getByRole("button",{name:"Record qualification tie resolution"}).isEnabled().catch(()=>false),false);}
  checks.push(`manual selection/confirmation, fixed server H2H, ambiguity/multiway/dispute/unavailable blocks, unchanged score wording/no overflow ${width}`);
 }
 assert.equal(writes.length,2,"double click singleflight");
 const key=`qualification-finalization:ties:${actor}:${eid}`;
 mode="abort";await go("manual");await fill();await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Record qualification tie resolution"}).click();await page.getByRole("status").filter({hasText:"Recording could not be confirmed"}).waitFor();
 const raw=await page.evaluate(k=>sessionStorage.getItem(k),key);assert.ok(raw);await page.reload();await page.getByRole("status").filter({hasText:"No completed receipt"}).waitFor();assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),key),raw);
 mode="success";await page.getByRole("button",{name:"Retry exact qualification tie request"}).click();await page.getByRole("status").filter({hasText:"Qualification tie resolution recorded"}).waitFor();assert.deepEqual(writes.at(-1),writes.at(-2));checks.push("interrupted save/reload retains exact identity and explicit retry");
 reconciled=outcome(JSON.parse(raw).request);await page.evaluate(({key,raw})=>sessionStorage.setItem(key,raw),{key,raw});const n=writes.length;await page.reload();await page.getByRole("status").filter({hasText:"Qualification tie resolution recorded"}).waitFor();assert.equal(writes.length,n);assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),key),null);checks.push("server success/lost response reconciles without another mutation");
 reconciled={...reconciled,winnerId:id(2)};await page.evaluate(({key,raw})=>sessionStorage.setItem(key,raw),{key,raw});await page.reload();await page.getByRole("status").filter({hasText:"Outcome remains uncertain"}).waitFor();assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),key),raw);checks.push("wrong same-source receipt cannot clear retained request");
 reconciled=null;mode="stale";await page.reload();await page.getByRole("status").filter({hasText:"No completed receipt"}).waitFor();await page.getByRole("button",{name:"Retry exact qualification tie request"}).click();await page.getByRole("status").filter({hasText:"Request rejected: stale source"}).waitFor();assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),key),null);checks.push("known stale rejection clears only reconciled exact retained request");
 for(const field of ["reason","evidenceReference"]){const altered=JSON.parse(raw);altered.request[field]="DIFFERENT TEST ONLY attestation";const changedRaw=JSON.stringify(altered);reconciled={status:"rejected",eventId:eid,code:"idempotency_conflict"};const before=writes.length;await page.evaluate(({key,changedRaw})=>sessionStorage.setItem(key,changedRaw),{key,changedRaw});await page.reload();await page.getByRole("status").filter({hasText:"Operation identity conflict"}).waitFor();assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),key),changedRaw);assert.equal(writes.length,before);assert.ok(await page.getByRole("button",{name:"Retry exact qualification tie request"}).isDisabled());checks.push(`server full-request conflict preserves changed ${field} and blocks retries`);}
 await fs.writeFile(path.join(root,"test-results/qualification-ties-browser-results.json"),JSON.stringify({checks,writes:writes.length},null,2));console.log(JSON.stringify({status:"PASS",checks,writes:writes.length},null,2));
}finally{await browser?.close();child.kill();await fs.writeFile(path.join(root,"test-results/qualification-ties-browser-server.log"),logs);}
