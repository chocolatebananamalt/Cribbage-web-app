// Offline real-React component regression. No URL navigation, server, DB or API.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
const require=createRequire(import.meta.url),{webpack}=require('next/dist/compiled/webpack/webpack');
const root=process.cwd(),dir=path.join(root,'test-results/finance-recovery-offline');
await fs.mkdir(dir,{recursive:true});
// Installed compiler only; no downloads, server or dependency installation.
await fs.writeFile(path.join(dir,'typescript-loader.cjs'),`const ts=require('typescript');module.exports=function(source){return ts.transpileModule(source,{fileName:this.resourcePath.endsWith('.offline')?this.resourcePath+'.tsx':this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};`);
// Test-only CSS-module scoping for these local styles (no URLs/imports allowed).
await fs.writeFile(path.join(dir,'css-loader.cjs'),`const{createHash}=require('node:crypto');module.exports=function(css){if(/url\\s*\\(|@import/i.test(css))throw Error('network-bearing CSS not allowed');const prefix='t'+createHash('sha256').update(this.resourcePath).digest('hex').slice(0,8)+'_',names={};css=css.replace(/\\.([a-zA-Z_][\\w-]*)/g,(_m,n)=>{names[n]=prefix+n;return'.'+names[n]});return 'const style=document.createElement("style");style.textContent='+JSON.stringify(css)+';document.head.append(style);export default '+JSON.stringify(names)+';'};`);
await new Promise((resolve,reject)=>{
 const compiler=webpack({mode:'development',devtool:false,context:root,target:'web',entry:path.join(root,'tests/fixtures/finance-readback-page.offline'),output:{path:dir,filename:'component.js',publicPath:''},resolve:{extensions:['.tsx','.ts','.js','.mjs','.json']},module:{rules:[{test:/\.(tsx?|offline)$/,exclude:/node_modules/,use:path.join(dir,'typescript-loader.cjs')},{test:/\.module\.css$/,use:path.join(dir,'css-loader.cjs')}]},optimization:{splitChunks:false,runtimeChunk:false,minimize:false}});
 compiler.run((error,stats)=>compiler.close(closeError=>{if(error||closeError||stats?.hasErrors())reject(error??closeError??Error(stats.toString({all:false,errors:true})));else resolve();}));
});
const bundle=await fs.readFile(path.join(dir,'component.js'),'utf8');
const busyOnly=process.env.FINANCE_REPRO_BUSY_ONLY==='1';
let browser;const checks=[],observations=[];
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of[320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},offline:true,serviceWorkers:'block'}),requests=[],errors=[];
  context.on('request',request=>requests.push(request.url()));
  await context.route('**/*',route=>route.abort());
  try{
   const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>errors.push(String(error)));
   assert.equal(page.url(),'about:blank');
   await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'"></head><body style="margin:0;font-family:Arial,sans-serif"><div id="root"></div></body></html>');
   await page.addScriptTag({content:bundle});
   await page.getByText('Ready to prepare a proposal save.',{exact:true}).waitFor();
   await page.getByLabel('Reason for Saving (Required)').fill('Offline fictional review');
   const save=page.getByRole('button',{name:'Save Proposal to Server',exact:true});await save.click();
   await page.getByRole('button',{name:'Retry the Same Save',exact:true}).waitFor();
   const check=page.getByRole('button',{name:'Check This Save',exact:true});await check.click();
   const verify=page.getByRole('button',{name:'Verify Saved Proposal',exact:true});await verify.waitFor();
   await check.evaluate(element=>{const key=Object.keys(element).find(k=>k.startsWith('__reactProps$'));window.__heldCheck=element[key].onClick;});
   if(width===390){await verify.focus();await verify.press('Enter');}else await verify.click();await page.getByText('Checking the saved proposal against a fresh account-bound readback.',{exact:true}).waitFor();
   if(!busyOnly){assert(await check.isDisabled(),'Check must be disabled during readback');
   await page.evaluate(()=>window.__heldCheck());assert.match(await page.getByLabel('Mock Counts').innerText(),/"checks":1/,'held Check cannot race readback');}
   await page.getByRole('button',{name:'Clone Workspace',exact:true}).click();await page.evaluate(()=>window.__releaseRead());
   await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent?.trim()==='Verify Saved Proposal'&&!b.disabled));
   assert.match(await page.getByLabel('Mock Counts').innerText(),/"retained":1/,'stale readback retains pending work');
   await page.evaluate(()=>{window.__holdArchive=true;delete window.__releaseArchive;});await verify.click();await page.evaluate(()=>window.__releaseRead());
   await page.waitForFunction(()=>typeof window.__releaseArchive==='function');assert(await check.isDisabled());
   await page.getByRole('button',{name:'Clone Workspace',exact:true}).click();await page.evaluate(()=>window.__releaseArchive());
   await page.getByText('A refreshed workspace matching the verified saved head is required. Existing editor contents have not been replaced.',{exact:true}).waitFor();
   assert(await save.isDisabled(),'verified head must block the stale workspace after archive');assert.match(await page.getByLabel('Mock Counts').innerText(),/"retained":0/);assert.match(await page.getByLabel('Mock Counts').innerText(),/"callbacks":0/,'stale owner callback suppressed');
   await page.getByRole('button',{name:'Adopt Verified Workspace',exact:true}).click();await page.getByText('Ready to prepare a proposal save.',{exact:true}).waitFor();assert(await save.isEnabled());
   for(const scale of[100,200]){
    await page.evaluate(scale=>{const nodes=[...document.querySelectorAll('main *')];nodes.forEach(n=>n.style.fontSize='');const sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));if(scale===200)nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');},scale);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
    await page.screenshot({path:path.join(dir,`${width}-${scale}.png`),fullPage:true});
    if((width===390&&scale===100)||(width===320&&scale===200))await page.getByRole('heading',{name:'Server Proposal',exact:true}).locator('..').screenshot({path:path.join(dir,`controls-${width}-${scale}.png`)});
   }
   assert.equal(page.url(),'about:blank');assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
   checks.push({width,textScales:[100,200],requests:0,url:'about:blank',keyboardVerify:width===390,readbackActionsBlocked:!busyOnly,stalePropsBusyRecovered:true,verifiedHeadRetained:true,staleCallbackSuppressed:true,passed:true});
  }finally{observations.push({width,url:context.pages()[0]?.url(),requests,errors});await fs.writeFile(path.join(dir,'observations.json'),JSON.stringify(observations,null,2));await context.close();}
 }
 // Read failure and same-scope React remount while archive is deferred.
 const recoveryContext=await browser.newContext({viewport:{width:390,height:1000},offline:true,serviceWorkers:'block'}),recoveryRequests=[],recoveryErrors=[];
 recoveryContext.on('request',r=>recoveryRequests.push(r.url()));await recoveryContext.route('**/*',r=>r.abort());
 try{
  const page=await recoveryContext.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>recoveryErrors.push(String(e)));
  await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'"></head><body><div id="root"></div></body></html>');await page.addScriptTag({content:bundle});
  await page.getByText('Ready to prepare a proposal save.',{exact:true}).waitFor();await page.getByLabel('Reason for Saving (Required)').fill('Fictional remount test');
  const save=page.getByRole('button',{name:'Save Proposal to Server',exact:true});await save.click();await page.getByRole('button',{name:'Retry the Same Save',exact:true}).waitFor();await page.getByRole('button',{name:'Check This Save',exact:true}).click();
  const verify=page.getByRole('button',{name:'Verify Saved Proposal',exact:true});await verify.waitFor();await page.evaluate(()=>window.__failRead=true);await verify.click();await page.evaluate(()=>window.__releaseRead());
  await page.getByText('Saved-proposal readback or recovery could not be completed. Retained work is unchanged; no new proposal was sent.',{exact:true}).waitFor();assert(await verify.isEnabled());assert.match(await page.getByLabel('Mock Counts').innerText(),/"retained":1/);
  await page.evaluate(()=>{window.__failRead=false;window.__holdArchive=true;});await verify.click();await page.evaluate(()=>window.__releaseRead());await page.waitForFunction(()=>typeof window.__releaseArchive==='function');
  await page.getByRole('button',{name:'Hide Finance',exact:true}).click();await page.getByText('Server Finance editing is unavailable. Retained proposals are unchanged.',{exact:true}).waitFor();await page.getByRole('button',{name:'Show Finance',exact:true}).click();assert(await save.isDisabled());
  await page.evaluate(()=>window.__releaseArchive());await page.getByText('A refreshed workspace matching the verified saved head is required. Existing editor contents have not been replaced.',{exact:true}).waitFor();assert(await save.isDisabled());assert.match(await page.getByLabel('Mock Counts').innerText(),/"posts":1,"checks":1,"retained":0/);assert.match(await page.getByLabel('Mock Counts').innerText(),/"callbacks":0/,'unmounted callback suppressed');
  await page.getByRole('button',{name:'Adopt Verified Workspace',exact:true}).click();await page.getByText('Ready to prepare a proposal save.',{exact:true}).waitFor();assert(await save.isDisabled(),'new proposal still requires its own reason after remount');await page.getByLabel('Reason for Saving (Required)').fill('Next fictional proposal');assert(await save.isEnabled());assert.equal(page.url(),'about:blank');assert.deepEqual(recoveryRequests,[]);assert.deepEqual(recoveryErrors,[]);
  checks.push({width:390,failedReadRetainsPending:true,sameScopeRemountArchiveGuard:true,requests:0,passed:true});
 }finally{observations.push({case:'read-failure-remount',requests:recoveryRequests,errors:recoveryErrors});await fs.writeFile(path.join(dir,'observations.json'),JSON.stringify(observations,null,2));await recoveryContext.close();}
 // New operation/component instance recovers a marker; no browser storage DB.
 const checkpointContext=await browser.newContext({viewport:{width:390,height:1000},offline:true,serviceWorkers:'block'}),checkpointRequests=[],checkpointErrors=[];
 checkpointContext.on('request',r=>checkpointRequests.push(r.url()));await checkpointContext.route('**/*',r=>r.abort());
 try{
  const page=await checkpointContext.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>checkpointErrors.push(String(e)));
  await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'"></head><body><div id="root"></div></body></html>');await page.addScriptTag({content:bundle});
  await page.getByText('Ready to prepare a proposal save.',{exact:true}).waitFor();await page.getByLabel('Reason for Saving (Required)').fill('Fictional checkpoint');const save=page.getByRole('button',{name:'Save Proposal to Server',exact:true});await save.click();await page.getByRole('button',{name:'Retry the Same Save',exact:true}).waitFor();await page.getByRole('button',{name:'Check This Save',exact:true}).click();
  await page.evaluate(()=>window.__loseArchiveAck=true);await page.getByRole('button',{name:'Verify Saved Proposal',exact:true}).click();await page.evaluate(()=>window.__releaseRead());await page.getByText('Save outcome is not yet known. Keep the exact pending operation intact.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Check Retained Operation',exact:true}).click();await page.getByText('A refreshed workspace matching the verified saved head is required. Existing editor contents have not been replaced.',{exact:true}).waitFor();assert(await save.isDisabled());assert.match(await page.getByLabel('Mock Counts').innerText(),/"posts":1,"checks":1,"retained":0/);assert.match(await page.getByLabel('Mock Counts').innerText(),/"checkpoints":1,"archives":1/);
  await page.getByRole('button',{name:'New Finance Instance',exact:true}).click();await page.getByText('A refreshed workspace matching the verified saved head is required. Existing editor contents have not been replaced.',{exact:true}).waitFor();assert(await save.isDisabled());assert(await page.getByLabel('Reason for Saving (Required)').isDisabled());
  await page.getByRole('button',{name:'Adopt Verified Workspace',exact:true}).click();await page.getByText('Ready to prepare a proposal save.',{exact:true}).waitFor();await page.getByLabel('Reason for Saving (Required)').fill('Next fictional checkpoint');await save.click();await page.getByRole('button',{name:'Retry the Same Save',exact:true}).waitFor();await page.getByRole('button',{name:'Check This Save',exact:true}).click();
  await page.evaluate(()=>window.__loseArchiveAck=false);await page.getByRole('button',{name:'Verify Saved Proposal',exact:true}).click();await page.evaluate(()=>window.__releaseRead());await page.getByText('A refreshed workspace matching the verified saved head is required. Existing editor contents have not been replaced.',{exact:true}).waitFor();
  assert.match(await page.getByLabel('Mock Counts').innerText(),/"posts":2,"checks":2,"retained":0,"callbacks":1,"checkpoints":1,"archives":2/);assert(await save.isDisabled());assert.equal(page.url(),'about:blank');assert.deepEqual(checkpointRequests,[]);assert.deepEqual(checkpointErrors,[]);
  checks.push({width:390,newInstanceCheckpointRecovered:true,lostArchiveAckRediscoveredWithoutPost:true,checkpointSaveArchiveCycles:2,requests:0,passed:true});
 }finally{observations.push({case:'new-instance-checkpoint',url:checkpointContext.pages()[0]?.url(),requests:checkpointRequests,errors:checkpointErrors});await fs.writeFile(path.join(dir,'observations.json'),JSON.stringify(observations,null,2));await checkpointContext.close();}
 await fs.writeFile(path.join(dir,'result.json'),JSON.stringify({passed:true,testMode:busyOnly?'busy-reproduction-only':'full',offline:true,fictionalPorts:true,actualProviderVerified:false,databaseVerified:false,checks},null,2));
 console.log(JSON.stringify({passed:true,checks}));
}finally{await browser?.close();}
