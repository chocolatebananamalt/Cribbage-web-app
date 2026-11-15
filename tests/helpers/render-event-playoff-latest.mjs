// Real React SSR only: no browser, HTTP, database or provider.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';

const req=createRequire(path.resolve('package.json')),ts=req('typescript'),React=req('react'),{renderToStaticMarkup}=req('react-dom/server'),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;const local=name=>{if(name.endsWith('.css'))return{};if(!name.startsWith('.'))return req(name);const base=path.resolve(path.dirname(file),name),found=[base,base+'.ts',base+'.tsx'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());return load(found);};vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename:file})(local,m,m.exports);return m.exports;}

const {EventPlayoffParametersEditor:Editor}=load('src/components/event-playoff-parameters-editor.tsx');
const {newEventPlayoffParametersDraftV1:oldDraft}=load('src/lib/playoffs/event-playoff-parameters-v1.ts');
const {newPlayoffPrizePlanDraftV2:newDraft}=load('src/lib/playoffs/playoff-prize-plan-v2.ts');
let calls=0;const noop=()=>calls++,field={status:'unknown',qualifierCount:null,firstRoundLoserPlaces:null,entryFeeMinor:5000};
for(const kind of['main','consolation'])for(const method of['graduated','equal','winner-multiplier','winner-takes-all']){
 const draft=oldDraft(kind);draft.payoutMode='one-in';draft.oneInText='7';draft.topText='6';const plan=newDraft();plan.method=method;plan.rounding={regular:'1',qPool:'10',sidePool:'5'};const before=JSON.stringify({draft,plan});
 const props={draft,onDraftChange:noop,context:null,prizePlan:{draft:plan,field,onDraftChange:noop}};
 const html=renderToStaticMarkup(React.createElement(Editor,props));assert(html.includes('Use the Same Format for All Rounds'));assert(html.includes('Who Receives Prize Money?'));assert(html.includes('Payout Method'));assert(!html.includes('Top # (Custom)'));assert(!html.includes('Payout 1-in-'));assert(!html.includes('Legacy 1-in-N'));assert(!html.includes('Stairstep'));assert(html.includes('No prize amounts or payments are calculated'));
 assert.equal((html.match(/>Increment Factor</g)||[]).length,method==='graduated'?1:0);assert.equal((html.match(/>Winner Multiplier</g)||[]).length,method==='winner-multiplier'?1:0);
 const disabled=renderToStaticMarkup(React.createElement(Editor,{...props,disabled:true}));assert.match(disabled,/<fieldset disabled="">/);const outsideFieldsets=disabled.replace(/<fieldset disabled="">[\s\S]*?<\/fieldset>/g,'');for(const tag of outsideFieldsets.match(/<(?:select|input)\b[^>]*>/g)||[])assert(tag.includes('disabled=""'),tag);
 assert.equal(JSON.stringify({draft,plan}),before);
}
const legacy=renderToStaticMarkup(React.createElement(Editor,{draft:oldDraft('main'),onDraftChange:noop,context:null}));assert(legacy.includes('Payout Type'));assert(!legacy.includes('Who Receives Prize Money?'));assert.equal(calls,0);
console.log('PASS eight latest Main/Con Playoff compositions plus legacy preservation and disabled controls; SSR only, not browser proof');
