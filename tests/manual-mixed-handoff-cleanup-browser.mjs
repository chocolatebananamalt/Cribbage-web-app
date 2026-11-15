// Actual React handoff, recovery coordinator, browser storage, locks and worker.
// Auth events and handoff HTTP responses are fixtures, not provider/SQL acceptance.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
const require=createRequire(import.meta.url),{webpack}=require('next/dist/compiled/webpack/webpack');
const root=process.cwd(),baseline=process.env.HANDOFF_CLEANUP_BASELINE,dir=path.resolve('test-results/manual-mixed-handoff-cleanup'+(baseline?'-red':''));
fs.mkdirSync(dir,{recursive:true});
const sourcePaths=['src/components/manual-mixed-handoff-v1.tsx','src/lib/games/manual-mixed-handoff-v1.ts','src/lib/recovery-write-coordinator.ts','public/offline-score-sw.js'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const hashes=Object.fromEntries(sourcePaths.map(p=>[p,sha(fs.readFileSync(p))]));
fs.writeFileSync(path.join(dir,'ts.cjs'),`const ts=require('typescript');module.exports=function(source){if(this.resourcePath.endsWith('manual-mixed-handoff-v1.tsx')&&${JSON.stringify(baseline??'')})source=require('node:fs').readFileSync(${JSON.stringify(baseline??'')},'utf8');if(this.resourcePath.endsWith('manual-mixed-handoff-v1.ts'))source=source.replace('manualMixedHandoffEnabledV1=()=>integratedTestFeatureEnabled()','manualMixedHandoffEnabledV1=()=>true').replace('manualMixedHandoffEnabledV1=()=>false','manualMixedHandoffEnabledV1=()=>true');return ts.transpileModule(source,{fileName:this.resourcePath.endsWith('.offline')?this.resourcePath+'.tsx':this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
await new Promise((resolve,reject)=>{
 const compiler=webpack({mode:'production',devtool:false,context:root,target:'web',entry:path.resolve('tests/fixtures/manual-mixed-handoff-cleanup-page.offline'),output:{path:dir,filename:'bundle.js'},resolve:{modules:['node_modules',path.resolve('node_modules/.pnpm/node_modules'),...(process.env.NODE_PATH??'').split(path.delimiter).filter(Boolean)],extensions:['.tsx','.ts','.mjs','.js','.json']},module:{rules:[{test:/\.(tsx?|offline)$/,exclude:/node_modules/,use:path.join(dir,'ts.cjs')}]},plugins:[new webpack.NormalModuleReplacementPlugin(/supabase[\/]client$/,path.resolve('tests/fixtures/manual-mixed-handoff-cleanup-auth.offline'))],optimization:{splitChunks:false,runtimeChunk:false,minimize:false}});
 compiler.run((error,stats)=>compiler.close(closeError=>error||closeError||stats?.hasErrors()?reject(error??closeError??Error(stats.toString({all:false,errors:true}))):resolve()));
});
const id=n=>'a1110000-0000-4000-8000-'+String(n).padStart(12,'0'),actorId=id(1),gameId=id(2),submissionId=id(3),operationId=id(4);
const key='manual-mixed-handoff:'+actorId+':'+gameId+':'+submissionId,foreignKey='manual-mixed-handoff:'+id(9)+':'+id(8)+':'+id(7),foreignRaw='fictional foreign pending bytes';
const retained=decision=>({submissionId,gameVersion:7,operationId,decision});
const snapshot=()=>({kind:'manual-mixed-handoff-v1',actorId,gameId,gameVersion:7,submission:{id:submissionId,winnerSide:'a',margin:35},paperPlayer:{displayName:'Fictional Paper',side:'b',tableSeat:'A-2',verificationId:'A-2'},digitalPlayer:{displayName:'Fictional Digital',side:'a',tableSeat:'A-1',verificationId:'A-1'},response:null,canRespond:true,tentative:true,verified:false});
const accepted=decision=>({...snapshot(),response:{operationId,decision,recordedAt:'2026-11-13T00:00:00Z'}});
const scenarios=new Map(),checks=[];
const waitSignal=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const server=http.createServer(async(req,res)=>{
 try{
  const name=req.headers['x-case-id'],scenario=scenarios.get(name),url=new URL(req.url,'http://localhost');
  if(url.pathname==='/offline-score-sw.js'){res.writeHead(200,{'content-type':'application/javascript','cache-control':'no-store'});res.end(fs.readFileSync('public/offline-score-sw.js'));return;}
  if(url.pathname==='/bundle.js'){res.writeHead(200,{'content-type':'application/javascript'});res.end(fs.readFileSync(path.join(dir,'bundle.js')));return;}
  if(url.pathname==='/api/v1/games/'+gameId+'/manual-mixed-handoff'){
   if(!scenario){res.writeHead(400);res.end();return;}
   if(req.method==='POST'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks).toString();scenario.posts.push(raw);scenario.postReached.resolve();
    if(scenario.holdPost)await scenario.release.promise;
    if(!scenario.reject){const request=JSON.parse(raw);scenario.view={...snapshot(),response:{operationId:request.operationId,decision:request.decision,recordedAt:'2026-11-13T00:00:00Z'}};}
    if(scenario.drop){scenario.drop=false;res.writeHead(200,{'content-type':'application/json','content-length':'99999'});res.flushHeaders();res.write('{\"kind\":');setTimeout(()=>res.destroy(),20);return;}
    const result=scenario.postResult??scenario.view;res.writeHead(scenario.reject?409:200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(result));return;
   }
   scenario.gets++;scenario.getReached.resolve();if(scenario.holdGet)await scenario.release.promise;
   res.writeHead(scenario.getStatus??200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(scenario.view));return;
  }
  if(url.pathname==='/'){
   if(!scenario){res.writeHead(400);res.end();return;}
   const config={actorId,gameId,submissionId,key,foreignKey,foreignRaw,...scenario.config};
   res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+fs.readFileSync('src/app/globals.css','utf8')+'</style></head><body><main id="app"></main><script>window.__config='+JSON.stringify(config)+'</script><script src="/bundle.js"></script></body></html>');return;
  }
  res.writeHead(404);res.end();
 }catch(error){res.writeHead(500);res.end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 async function run(name,width,options,exercise){
  const scenario={view:snapshot(),posts:[],gets:0,config:{},postReached:waitSignal(),getReached:waitSignal(),release:waitSignal(),...options};scenarios.set(name,scenario);
  const context=await browser.newContext({viewport:{width,height:1000},extraHTTPHeaders:{'x-case-id':name}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));page.setDefaultTimeout(10000);
  try{
   await page.goto(origin);await page.waitForFunction(()=>window.__ready||window.__initError);assert.equal(await page.evaluate(()=>window.__initError??null),null);
   await exercise(page,scenario);
   assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),foreignKey),foreignRaw,'other actors pending bytes preserved');
   assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:path.join(dir,name+'.png'),fullPage:true});checks.push({name,width,passed:true,gets:scenario.gets,posts:scenario.posts.length,requestHashes:scenario.posts.map(sha)});
  }catch(error){fs.writeFileSync(path.join(dir,name+'-failure.json'),JSON.stringify({error:String(error),errors,text:await page.locator('body').innerText(),pendingRaw:await page.evaluate(key=>sessionStorage.getItem(key),key),recoveryCount:await page.evaluate(()=>window.__recoveryCount?.()),posts:scenario.posts},null,2));throw error;}
  finally{scenario.release.resolve();await context.close();scenarios.delete(name);}
 }
 const raw=decision=>JSON.stringify(retained(decision));
 const read=page=>page.evaluate(key=>sessionStorage.getItem(key),key);
 const click=async(page,decision)=>{await page.getByRole('button',{name:decision==='yes'?/^Yes .*Matches My Paper Card$/:/^No .*Ask an Official$/}).click();};
 for(const width of [390,1440]){
  for(const decision of ['yes','no']){
   await run('fresh-'+decision+'-'+width,width,{},async(page,scenario)=>{
    await click(page,decision);await page.getByText(decision==='yes'?'Yes recorded. Keep the original paper card for cross-checking.':'No recorded. This disagreement needs an official; it cannot be approved as-is.',{exact:true}).waitFor();
    await page.waitForFunction(key=>sessionStorage.getItem(key)===null,key);assert.equal(await page.evaluate(()=>window.__recoveryCount()),1);assert.equal(scenario.posts.length,1);assert.equal(JSON.parse(scenario.posts[0]).decision,decision);
    assert.match(await page.locator('body').innerText(),/Not verified and excluded from finalization/);
   });
   await run('reload-accepted-'+decision+'-'+width,width,{view:accepted(decision),config:{seedRaw:raw(decision)}},async(page,scenario)=>{
    await page.waitForFunction(key=>sessionStorage.getItem(key)===null,key);assert.equal(await page.evaluate(()=>window.__recoveryCount()),1);assert.equal(scenario.posts.length,0);
   });
  }
  await run('post-commit-response-loss-'+width,width,{drop:true},async(page,scenario)=>{
   await click(page,'yes');await page.getByText('Not confirmed. The exact response is retained on this device for retry.',{exact:true}).waitFor();const pending=await read(page);assert.equal(pending,scenario.posts[0]);assert.equal(await page.evaluate(()=>window.__recoveryCount()),2);
   await page.reload();await page.waitForFunction(key=>sessionStorage.getItem(key)===null,key);assert.equal(scenario.posts.length,1);assert.equal(await page.evaluate(()=>window.__recoveryCount()),1);
  });
  await run('server-rejection-'+width,width,{reject:true},async(page,scenario)=>{
   await click(page,'yes');await page.getByText('Response not confirmed. Keep this exact request for retry; ask an official if the game changed.',{exact:true}).waitFor();assert.equal(await read(page),scenario.posts[0]);
  });
  await run('storage-removal-failure-'+width,width,{config:{removeFails:true}},async(page,scenario)=>{
   await click(page,'yes');await page.getByText(/exact retry cleanup was not confirmed/).waitFor();assert.equal(await read(page),scenario.posts[0]);
  });
  await run('replacement-during-post-'+width,width,{holdPost:true},async(page,scenario)=>{
   await click(page,'yes');await scenario.postReached.promise;await page.evaluate(key=>sessionStorage.setItem(key,'newer exact pending bytes'),key);scenario.release.resolve();await page.getByText(/exact retry cleanup was not confirmed/).waitFor();assert.equal(await read(page),'newer exact pending bytes');
  });
  await run('owner-change-during-post-'+width,width,{holdPost:true},async(page,scenario)=>{
   await click(page,'yes');await scenario.postReached.promise;await page.evaluate(actor=>{document.cookie='acc_recovery_owner_v1='+actor+'; Path=/; SameSite=Lax';},id(9));scenario.release.resolve();await page.getByText(/exact retry cleanup was not confirmed/).waitFor();assert.equal(await read(page),scenario.posts[0]);
  });

  await run('recovery-switch-during-post-'+width,width,{holdPost:true},async(page,scenario)=>{
   await click(page,'yes');await scenario.postReached.promise;await page.evaluate(()=>window.__beginSwitch());scenario.release.resolve();await page.getByText(/exact retry cleanup was not confirmed/).waitFor();assert.equal(await read(page),scenario.posts[0]);
  });

  await run('coordinator-actor-change-during-post-'+width,width,{holdPost:true},async(page,scenario)=>{
   await click(page,'yes');await scenario.postReached.promise;await page.evaluate(actor=>window.__moveRecoveryActor(actor),'a1110000-0000-4000-8000-000000000009');scenario.release.resolve();await page.getByText(/exact retry cleanup was not confirmed/).waitFor();assert.equal(await read(page),scenario.posts[0]);
  });
  await run('auth-change-during-post-'+width,width,{holdPost:true},async(page,scenario)=>{
   await click(page,'yes');await scenario.postReached.promise;await page.evaluate(()=>window.__emitAuth('SIGNED_OUT'));scenario.release.resolve();await page.waitForFunction(()=>!document.body.textContent.includes('Fictional Paper'));assert.equal(await read(page),scenario.posts[0]);
  });
 }
 for(const [name,change] of [['actor',v=>v.actorId=id(9)],['game',v=>v.gameId=id(9)],['submission',v=>v.submission.id=id(9)],['version',v=>v.gameVersion=8],['operation',v=>v.response.operationId=id(9)],['decision',v=>v.response.decision='no'],['missing-response',v=>v.response=null]]){
  const v=accepted('yes');change(v);await run('read-mismatch-'+name,390,{view:v,config:{seedRaw:raw('yes')}},async page=>{await page.getByText(/saved response has not been reconciled|Mixed handoff is unavailable/).waitFor();assert.equal(await read(page),raw('yes'));});
 }
 await run('malformed-retained',390,{config:{seedRaw:'{"future":"keep exact"}'}},async(page,scenario)=>{await page.getByText('Retained handoff needs review. It has not been replaced.',{exact:true}).waitFor();assert.equal(await read(page),'{"future":"keep exact"}');assert.equal(scenario.gets,0);});
 await run('auth-change-during-read',390,{view:accepted('yes'),holdGet:true,config:{seedRaw:raw('yes')}},async(page,scenario)=>{await scenario.getReached.promise;await page.evaluate(()=>window.__emitAuth('SIGNED_OUT'));scenario.release.resolve();await page.waitForFunction(()=>!document.body.textContent.includes('Fictional Paper'));assert.equal(await read(page),raw('yes'));});
 for(const p of sourcePaths)assert.equal(sha(fs.readFileSync(p)),hashes[p]);
 fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({passed:true,checks,hashes,actualReact:true,actualRecoveryCoordinator:true,actualServiceWorker:true,realProvider:false,realDatabase:false,testOnlyGateOverride:true,origin},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
