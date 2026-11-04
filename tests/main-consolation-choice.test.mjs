import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';

const source=fs.readFileSync('src/components/main-consolation-choice.tsx','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
function load(react) {
 const sandboxModule={exports:{}};
 vm.runInNewContext(compiled,{React:react,module:sandboxModule,exports:sandboxModule.exports,require(name){if(name==='react')return react;throw Error(name)}});
 return sandboxModule.exports.MainConsolationChoice;
}
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const main={clientRowId:id(1),eventKind:'main',displayName:'Main A'};
const events=[main,{clientRowId:id(2),eventKind:'consolation',displayName:'Shared name'},{clientRowId:id(3),eventKind:'consolation',displayName:'Shared name'}];
const base={main,events,choice:undefined,disabled:false,onChange(){},onAddConsolation(){}};
function walk(node) {if(!node || typeof node!=='object')return [];return [node,...React.Children.toArray(node.props?.children).flatMap(walk)];}
function mocked(props,open=false,confirm=false) {
 const state=[];
 let index=0; const Fake={...React,useId:()=>':test:',useRef:()=>({current:null}),useEffect:()=>{},useState:()=>[(index++===0?open:confirm),v=>state.push(v)]};
 const tree=load(Fake)(props);
 return {nodes:walk(tree),state};
}
test('unknown remains unanswered; explicit no preserves editors and fieldset disables controls',()=>{
 const unknown=mocked(base).nodes;
 assert.equal(unknown.filter(n=>n.type==='input'&&n.props.type==='radio').some(n=>n.props.checked),false);
 assert.equal(unknown.some(n=>n.type==='select'),false);
 const no=mocked({...base,disabled:true,choice:{mainClientRowId:id(1),consolationClientRowIds:[]}}).nodes;
 assert.equal(no.find(n=>n.type==='fieldset').props.disabled,true);
 assert.match(JSON.stringify(no.map(n=>n.props.children)),/Existing Consolation event editors remain available/);
 assert.match(JSON.stringify(no.map(n=>n.props.children)),/Reassign any unlinked/);
});
test('yes opens picker without creating or guessing an association',()=>{
 let changes=0,adds=0;const {nodes,state}=mocked({...base,onChange(){changes++},onAddConsolation(){adds++}});
 nodes.find(n=>n.type==='input' && n.props.type==='radio').props.onChange();
 assert.deepEqual(state,[true]);assert.equal(changes,0);assert.equal(adds,0);
});
test('explicit selection, no, unlink and add use stable row IDs',()=>{
 const changes=[],adds=[];const props={...base,choice:{mainClientRowId:id(1),consolationClientRowIds:[id(2)]},assignedConsolationIds:[id(2),id(3)],onChange:c=>changes.push(c),onAddConsolation:i=>adds.push(i)};
 const {nodes}=mocked(props);const options=nodes.filter(n=>n.type==='option');assert.equal(options.find(n=>n.props.value===id(3)).props.disabled,true);
 const select=nodes.find(n=>n.type==='select');select.props.onChange({target:{value:id(3)}});assert.equal(changes.length,0);
 nodes.find(n=>n.type==='button' && String(n.props.children).includes('Unlink')).props.onClick();
 assert.deepEqual(JSON.parse(JSON.stringify(changes.pop())),{mainClientRowId:id(1),consolationClientRowIds:[]});
 nodes.find(n=>n.type==='button' && n.props.children==='Add Consolation for this Main').props.onClick();assert.deepEqual(adds,[id(1)]);
 const dialog=mocked(props,false,true).nodes;dialog.find(n=>n.type==='button'&&n.props.children==='Confirm No').props.onClick();assert.deepEqual(JSON.parse(JSON.stringify(changes.pop())),{mainClientRowId:id(1),consolationClientRowIds:[]});
 const free=mocked({...props,assignedConsolationIds:[id(2)]}).nodes.find(n=>n.type==='select');free.props.onChange({target:{value:id(3)}});
 assert.deepEqual(JSON.parse(JSON.stringify(changes.pop())),{mainClientRowId:id(1),consolationClientRowIds:[id(2),id(3)]});
});




