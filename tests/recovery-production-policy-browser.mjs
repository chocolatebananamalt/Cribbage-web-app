// Disposable fictional localhost browser. No user Chrome session or real auth.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {chromium} from 'playwright-core';
const root=process.cwd();
const proxy=await fs.readFile('src/proxy.ts','utf8');
const policyFunction=proxy.slice(proxy.indexOf('function registrationContentSecurityPolicy'),proxy.indexOf('\nexport async function proxy'));
const js=ts.transpileModule(policyFunction,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const policy=new Function('process','configuredSupabaseConnectSources',js+';return registrationContentSecurityPolicy("fictional-local-nonce");')({env:{NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:''}},()=>[]);
const results=[];
const server=http.createServer(async(req,res)=>{
  try {
    res.setHeader('Content-Security-Policy',policy);
    if(req.url==='/offline-score-sw.js'){
      res.setHeader('content-type','application/javascript');res.setHeader('cache-control','no-cache, no-store, must-revalidate');res.setHeader('service-worker-allowed','/');
      // Candidate proxy policy; effective Next response precedence still needs proof.
      res.end(await fs.readFile('public/offline-score-sw.js'));return;
    }
    if(req.url.startsWith('/src/lib/')&&req.url.endsWith('.ts')){
      const file=path.resolve(root,'.'+req.url);assert.ok(file.startsWith(path.join(root,'src','lib')+path.sep));
      res.setHeader('content-type','application/javascript');res.end(ts.transpileModule(await fs.readFile(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);return;
    }
    res.setHeader('content-type','text/html');
    res.end(`<html><body><output id="result">waiting</output><script nonce="fictional-local-nonce" type="module">
      import {acquireRecoveryDocument,assertRecoveryWriteAllowed} from '/src/lib/recovery-write-coordinator.ts';
      import {readRecoveryDiagnostic} from '/src/lib/recovery-diagnostic.ts';
      window.result={status:'waiting'};
      acquireRecoveryDocument(null).then(()=>{window.result={status:'ready'}},()=>{window.result={status:'blocked',diagnostic:readRecoveryDiagnostic()}}).finally(()=>{document.querySelector('#result').textContent=JSON.stringify(window.result)});
      window.assertWrite=()=>{try{assertRecoveryWriteAllowed();return 'allowed'}catch{return 'blocked'}};
      </script></body></html>`);
  }catch{res.statusCode=500;res.end('fixture unavailable')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const width of [390,1440]){
    const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>window.result?.status!=='waiting');
    const result=await page.evaluate(()=>window.result);
    if(result.status==='blocked')assert.equal(await page.evaluate(()=>window.assertWrite()),'blocked');
    results.push({width,...result});await context.close();
  }
  console.log(JSON.stringify({policy,results},null,2));
  assert.ok(results.every(result=>result.status==='ready'), 'production page CSP permits recovery initialization');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
