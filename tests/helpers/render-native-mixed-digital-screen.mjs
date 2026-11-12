// Node-only React SSR, no browser/navigation/HTTP/database or provider.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';
import {nativeMixedDigitalScreenExample as example} from './native-mixed-digital-screen-example.mjs';
import {projectNativeMixedDigitalEntryV1 as project} from '../../src/lib/seating/native-mixed-digital-entry-view-v1.ts';
const req=createRequire(path.resolve('package.json')),ts=req('typescript'),React=req('react'),{renderToStaticMarkup}=req('react-dom/server'),cache=new Map();
function load(file){
 file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
 const local=name=>{if(name.endsWith('.css'))return{};if(!name.startsWith('.'))return req(name);const base=path.resolve(path.dirname(file),name),resolved=[base,base+'.ts',base+'.tsx'].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());return load(resolved);};
 vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename:file})(local,m,m.exports);return m.exports;
}
const {NativeMixedDigitalScoreScreenV1:Screen,NativeMixedDigitalScoreEntryV1:Entry}=load('src/components/native-mixed-digital-score-entry-v1.tsx');
let calls=0;const noop=()=>calls++,commands=Object.fromEntries(['choose','key','submit','confirm','send','check','resolve','refresh','beforeNavigate'].map(k=>[k,noop]));
const snap={initialized:true,busy:false,pending:null,blocked:false,message:'',receipt:null},x=example();
const render=(v,overrides={})=>renderToStaticMarkup(React.createElement(Screen,{binding:x.binding,view:v,snapshot:snap,winner:'player',margin:'40',busy:false,online:true,message:'',commands,...overrides}));
const ready=render(project(x.binding,x.state));for(const text of ['Spread Points','Your Result:','WON - Points: 3 Game | +40 Spread','Tournament ID#','A-3','Table A','Seat 9','Submit result','Practice Only','✓ Selected'])assert.ok(ready.includes(text),text);assert.match(ready,/font|class=/);assert.ok(!ready.includes('ACC Number'));assert.ok(ready.includes('aria-pressed="true"'));assert.equal((ready.match(/aria-current="page"/g)||[]).length,1);
x.submit();x.submit(x.binding.opponent);const confirm=render(project(x.binding,x.state));assert.ok(confirm.includes('Confirm My Entry'));assert.ok(!confirm.includes('>Submit result<'));const offline=render(project(x.binding,x.state),{online:false});assert.match(offline,/disabled=""[^>]*>Confirm My Entry/);
const attempted=render(project(x.binding,x.state),{snapshot:{...snap,pending:{phase:'attempted'}}});assert.ok(attempted.includes('Check Saved Entry'));assert.ok(!attempted.includes('Send Saved Entry'));
const retryable=render(project(x.binding,x.state),{snapshot:{...snap,pending:{phase:'retryable'}}});assert.ok(retryable.includes('Retry Exact Saved Entry'));assert.ok(retryable.includes('Check Saved Entry'));
x.confirm();x.confirm(x.binding.opponent);const complete=render(project(x.binding,x.state));assert.ok(complete.includes('Rehearsal evidence is complete'));assert.ok(!complete.includes('Confirm My Entry'));
const disabled=renderToStaticMarkup(React.createElement(Entry,{binding:x.binding,initialState:x.state,online:true,runtime:{retained:{read:noop},transport:{state:noop},makeOperationId:noop}}));assert.ok(disabled.includes('not enabled'));assert.equal(calls,0);console.log('screen SSR cases passed');

const {NativeMixedOwnPlayerScreenV1:OwnScreen}=load('src/components/native-mixed-own-player-screen-v1.tsx');
const ownDisabled=renderToStaticMarkup(React.createElement(OwnScreen,{page:'entry',target:x.binding.target,online:true,runtime:{retained:{read:noop},transport:{bindings:noop,state:noop},makeOperationId:noop}}));assert(ownDisabled.includes('not enabled'));assert.equal(calls,0);

const future=render(project(x.binding,{...x.state,playOrder:'upcoming'}));assert(future.includes('Finish your earlier practice games'));assert(!future.includes('>Submit result<'));assert(!future.includes('Confirm My Entry'));
