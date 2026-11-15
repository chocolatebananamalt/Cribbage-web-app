// Real React SSR only: no browser, HTTP, database or provider.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';
import {projectNativeMixedPaperEntryV1 as project} from '../../src/lib/seating/native-mixed-paper-entry-view-v1.ts';
const req=createRequire(path.resolve('package.json')),ts=req('typescript'),React=req('react'),{renderToStaticMarkup}=req('react-dom/server'),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;const local=name=>{if(name.endsWith('.css'))return{};if(!name.startsWith('.'))return req(name);const base=path.resolve(path.dirname(file),name),found=[base,base+'.ts',base+'.tsx'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());return load(found);};vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename:file})(local,m,m.exports);return m.exports;}
const {NativeMixedPaperEntryScreenV1:Screen}=load('src/components/native-mixed-paper-entry-v1.tsx');let calls=0;const noop=()=>calls++,commands=Object.fromEntries(['field','ack','clear','record','send','check','resolve','refresh'].map(k=>[k,noop])),snapshot={initialized:true,busy:false,pending:null,blocked:false,message:'',receipt:null},fields={a:{winner:'',margin:''},b:{winner:'',margin:''},ack:false};
const render=(x,more={})=>renderToStaticMarkup(React.createElement(Screen,{binding:x.binding,view:project(x.binding,x.state),snapshot,fields,busy:false,online:true,message:'',commands,...more}));
const models=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));let cases=0;
for(const model of models){
 const capture={binding:model.captureBinding,state:model.captureState},review={binding:model.binding,state:model.reviewState},complete={binding:model.binding,state:model.state};
 const html=render(capture);assert.equal((html.match(/<fieldset/g)||[]).length,project(capture.binding,capture.state).paperSides.length);assert(html.includes('Tournament ID#'));
 const reentry=render(review);assert(reentry.includes('Record Independent Review'));assert(!reentry.includes('value="40"'));
 const done=render(complete);assert(done.includes('Rehearsal evidence is complete'));assert(!done.includes('Record Independent Review'));
 const hidden=render(review,{snapshot:{...snapshot,pending:{phase:'attempted'}}});for(const p of[model.binding.sideA,model.binding.sideB])assert(!hidden.includes(p.displayName));assert(hidden.includes('Check Saved Entry'));
 cases+=4;
}
assert.equal(cases,8);assert.equal(calls,0);console.log('8 actual-SQL-model Paper SSR cases passed; no browser/hydration/provider claim');
