import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {chromium} from 'playwright-core';
const require=createRequire(import.meta.url),{webpack}=require('next/dist/compiled/webpack/webpack'),dir=path.resolve('test-results/check-in-seating-refresh');await fs.mkdir(dir,{recursive:true});
await fs.writeFile(path.join(dir,'ts.cjs'),`const ts=require('typescript');module.exports=function(s){return ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};`);
const fixture=path.resolve('tests/fixtures/check-in-seating-refresh.offline');
await new Promise((ok,no)=>{const c=webpack({mode:'production',devtool:false,context:process.cwd(),target:'web',entry:fixture,output:{path:dir,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js','.offline'],alias:{'react$':require.resolve('react'),'react/jsx-runtime$':require.resolve('react/jsx-runtime')}},module:{rules:[{test:/\.(tsx?|offline)$/,exclude:/node_modules/,use:path.join(dir,'ts.cjs')}]},plugins:[new webpack.NormalModuleReplacementPlugin(/^(next\/navigation|next\/link)$|recovery-write-coordinator$/,r=>{r.request=fixture;}),...(process.env.CHECK_IN_SEATING_SOURCE?[new webpack.NormalModuleReplacementPlugin(/\/seating\/seating-client$/,r=>{r.request=path.resolve(process.env.CHECK_IN_SEATING_SOURCE);})]:[])],optimization:{minimize:false}});c.run((e,s)=>c.close(x=>e||x||s?.hasErrors()?no(e??x??Error(s.toString({all:false,errors:true}))):ok()));});
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{for(const width of [390,1440])for(const mode of (process.env.EXPECT_BASELINE==='1'?['added','replaced','lost-reply']:['added','replaced','lost-reply','table-update','capacity-update'])){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});let intercepted=0;
 await context.route('**/*',r=>{intercepted++;return r.fulfill({status:200,contentType:'text/html',body:'<style>*{box-sizing:border-box}body{margin:8px;font:18px system-ui}section{overflow-wrap:anywhere}input,select{max-width:100%}</style><div id="root"></div>'});});
 const page=await context.newPage();await page.goto('https://fixture.invalid/');await page.addScriptTag({content:await fs.readFile(path.join(dir,'bundle.js'),'utf8')});await page.evaluate(mode=>window.mount(mode),mode);
 const beta=page.locator('#check-in-list li').filter({has:page.getByRole('heading',{name:'Fictional Beta',exact:true})});
 await beta.getByRole('button',{name:'Save check-in status'}).waitFor();await page.waitForFunction(()=>!document.querySelector('#check-in-list fieldset')?.disabled);
 await page.locator('.seating-list select').first().selectOption('A-3');
 if(mode==='replaced')await page.evaluate(()=>window.fixture.swap());else{
  await beta.getByRole('button',{name:'Save check-in status'}).click();
  if(mode==='lost-reply'){
   await page.getByRole('button',{name:'Retry the same protected request',exact:true}).waitFor();
   const raw=await page.evaluate(()=>window.fixture.pending());assert(raw);
   assert.deepEqual(await page.evaluate(()=>({writes:window.fixture.checkInWrites,requests:window.fixture.requests.length})),{writes:1,requests:1});
   await page.evaluate(()=>window.fixture.refresh());
   if(process.env.EXPECT_BASELINE==='1')assert.equal(await page.getByRole('button',{name:'Update seating draft from current check-in',exact:true}).count(),0);else assert(await page.getByRole('button',{name:'Update seating draft from current check-in',exact:true}).isDisabled());
   assert.equal(await page.evaluate(()=>window.fixture.pending()),raw);
   await page.getByRole('button',{name:'Retry the same protected request',exact:true}).click();
   await page.waitForFunction(()=>window.fixture.pending()===null);
   assert.equal(await page.evaluate(()=>window.fixture.checkInWrites),1);
   assert(await page.evaluate(()=>JSON.stringify(window.fixture.requests[0].request)===JSON.stringify(window.fixture.requests[1].request)));
  }
  await beta.getByText('Checked in',{exact:false}).first().waitFor();
 }
 await page.getByLabel('I reviewed attendance and am ready to close registration.').check();await page.getByRole('button',{name:'Close registration and disable signup',exact:true}).click();await page.getByText('Registration is closed. You may now publish the permanent starting Table/Seat assignments.',{exact:true}).waitFor();
 const publish=page.getByRole('button',{name:'Publish permanent initial seating',exact:true});
 await page.getByLabel('I understand this permanently assigns verification IDs.').check();
 if(process.env.EXPECT_BASELINE==='1'){
  if(mode==='replaced'){assert(await publish.isEnabled());await publish.click();assert.equal(await page.evaluate(()=>window.fixture.seatingWrites),0);assert.equal(await page.evaluate(()=>window.fixture.requests.at(-1).request.assignments[0].rosterEntryId),'bc120000-0000-4000-8000-000000000003');}
  else{assert(await publish.isDisabled());assert(await page.getByText('This is disabled because two players share the same Table/Seat.',{exact:false}).isVisible());}
  assert.equal(await page.getByRole('button',{name:'Update seating draft from current check-in'}).count(),0);
 }else{
  assert(await publish.isDisabled());const update=page.getByRole('button',{name:'Update seating draft from current check-in',exact:true});assert(await update.isEnabled());
  if(mode!=='replaced')assert.equal(await page.locator('.seating-list select').first().inputValue(),'A-3');
  if(mode==='table-update')await page.getByLabel('Tables',{exact:true}).fill('2');else if(mode==='capacity-update')await page.getByLabel('Seats per Table',{exact:true}).fill('5');else await update.click();
  assert(!(await page.getByLabel('I understand this permanently assigns verification IDs.').isChecked()));assert(await publish.isDisabled());
  await page.getByLabel('I understand this permanently assigns verification IDs.').check();assert(await publish.isEnabled());await publish.click();await page.getByRole('heading',{name:'Initial seating published',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.fixture.seatingWrites),1);
  assert(await page.evaluate(()=>{const f=window.fixture,request=f.requests.find(x=>x.url.endsWith('/seating/publish')).request,present=f.rows.filter(r=>r.state==='checked_in');return request.assignments.length===present.length&&request.assignments.every(a=>present.some(r=>r.rosterEntryId===a.rosterEntryId));}));
 }
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('payment-operation:foreign-fictional-preserved')),'fictional foreign recovery - unchanged');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(intercepted,1);
 results.push({width,mode,baseline:process.env.EXPECT_BASELINE==='1',passed:true,actualComponent:true,realSessionStorage:true,syntheticRouterAndRpcHttp:true,realProvider:false});await context.close();
}}finally{await browser.close();}
await fs.writeFile(path.join(dir,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
