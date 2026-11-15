// Real React SSR only: no browser, HTTP, database or provider.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';

const req=createRequire(path.resolve('package.json')),ts=req('typescript'),React=req('react'),{renderToStaticMarkup}=req('react-dom/server'),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;const local=name=>{if(name.endsWith('.css'))return{};if(!name.startsWith('.'))return req(name);const base=path.resolve(path.dirname(file),name),found=[base,base+'.ts',base+'.tsx'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());return load(found);};vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename:file})(local,m,m.exports);return m.exports;}

const {NativeMixedBootstrapViewV1:View}=load('src/components/native-mixed-bootstrap-workflow-v1.tsx');
const {offer,context,modeFor,templates}=await import('./bootstrap-workflow-example.mjs');
let calls=0;const noop=()=>calls++;
for(const action of Object.keys(templates)){
 const c=context(modeFor(action)),o=offer(action,c),snapshot={status:'ready',offer:o,wire:null,phase:null,receipt:null,message:o.message};
 const props={enabled:true,context:c,snapshot,online:true,busy:false,confirmed:false,confirm:noop,refresh:noop,submit:noop,check:noop,retry:noop};
 const html=renderToStaticMarkup(React.createElement(View,props));assert(html.includes('TEST ONLY'));assert(!html.includes('checked=""'));assert(html.includes('disabled=""'));
 assert.equal(renderToStaticMarkup(React.createElement(View,{...props,enabled:false})), '');
}
assert.equal(calls,0);console.log('PASS nine role/action SSR cases; unchecked confirmation, disabled submit, off gate; not browser proof');
