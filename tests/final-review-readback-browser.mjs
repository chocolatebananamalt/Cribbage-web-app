import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
const require=createRequire(import.meta.url),{webpack}=require('next/dist/compiled/webpack/webpack');
const dir=path.resolve('test-results/final-review-readback');await fs.mkdir(dir,{recursive:true});
await fs.writeFile(path.join(dir,'ts.cjs'),`const ts=require('typescript');module.exports=function(s){return ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};`);
await new Promise((ok,no)=>{
 const compiler=webpack({mode:'production',devtool:false,context:process.cwd(),target:'web',entry:path.resolve('tests/fixtures/final-review-readback.offline'),output:{path:dir,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js','.offline']},module:{rules:[{test:/\.(tsx?|offline)$/,exclude:/node_modules/,use:path.join(dir,'ts.cjs')}]},plugins:[new webpack.NormalModuleReplacementPlugin(/(?:supabase\/client|event-finance-draft-retained-v1|recovery-write-coordinator)$/,r=>{r.request=path.resolve('tests/fixtures/final-review-readback-ports.mjs');})],optimization:{minimize:false}});
 compiler.run((e,s)=>compiler.close(x=>e||x||s?.hasErrors()?no(e??x??Error(s.toString({all:false,errors:true}))):ok()));
});
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{
 for(const width of [390,1440])for(const mode of ['accepted','unknown','unbound','archive-failure']){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  const page=await context.newPage();await context.route('**/*',r=>r.abort());
  await page.setContent('<style>*{box-sizing:border-box}body{margin:8px;font:18px system-ui}section{overflow-wrap:anywhere}textarea{max-width:100%}</style><div id="root"></div>');
  await page.addScriptTag({content:await fs.readFile(path.join(dir,'bundle.js'),'utf8')});
  await page.evaluate(mode=>window.mount(mode),mode);
  await page.getByText('Review the current records.',{exact:true}).waitFor();
  await page.getByLabel('Approval Reason').fill('Explicit fictional review');await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Approve Pool Awards as Unpaid',exact:true}).click();
  if(mode==='accepted'){
   if(process.env.EXPECT_BASELINE==='1')await page.getByText('Outcome could not be verified. The exact request remains retained; recover it before continuing.',{exact:true}).waitFor();else await page.getByRole('status').filter({hasText:'Approval recorded, but current records could not be refreshed.'}).waitFor({timeout:3000});
   assert.equal(await page.getByRole('button',{name:'Recover Exact Request'}).count(),0);
   assert.deepEqual(await page.evaluate(()=>({pending:window.fixture.values.size,archives:window.fixture.archives.length,sends:window.fixture.sends.length})),{pending:0,archives:1,sends:1});
   await page.getByRole('button',{name:'Refresh Current Records'}).click();
   await page.getByText('Final Approval Saved. Awards remain unpaid.',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>window.fixture.sends.length),1);
  }else{
   await page.getByText('Outcome could not be verified. The exact request remains retained; recover it before continuing.',{exact:true}).waitFor();
   assert.deepEqual(await page.evaluate(()=>({pending:window.fixture.values.size,archives:window.fixture.archives.length,sends:window.fixture.sends.length})),{pending:1,archives:0,sends:1});
   assert(await page.getByRole('button',{name:'Recover Exact Request',exact:true}).isVisible());
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  results.push({width,mode,passed:true,actualComponent:true,syntheticAuthStorageHttp:true,realProvider:false});await context.close();
 }
}finally{await browser.close();}
await fs.writeFile(path.join(dir,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
