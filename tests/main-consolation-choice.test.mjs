import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { consolationYesIntent } from '../src/lib/setup-consolation-intent.ts';
const code=ts.transpileModule(fs.readFileSync('src/components/main-consolation-choice.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const main={clientRowId:id(1),eventKind:'main',displayName:'Main A'},consy={clientRowId:id(2),eventKind:'consolation',displayName:'Main Consolation'},sat={clientRowId:id(3),eventKind:'satellite',displayName:'Satellite'};
const base={main,events:[main],choice:undefined,disabled:false,onChange(){},onAddConsolation(){}};
function walk(node){return !node||typeof node!=='object'?[]:[node,...React.Children.toArray(node.props?.children).flatMap(walk)];}
function render(props,confirm=false){let n=0;const state=[],Fake={...React,useId:()=>':test:',useRef:v=>({current:v}),useEffect:()=>{},useState:()=>[n++===0?confirm:'',v=>state.push(v)]},loadedModule={exports:{}};vm.runInNewContext(code,{React:Fake,exports:loadedModule.exports,module:loadedModule,require:name=>name==='react'?Fake:{consolationYesIntent}});return{nodes:walk(loadedModule.exports.MainConsolationChoice(props)),state};}
const radio=(nodes,label)=>nodes.filter(n=>n.type==='label').find(n=>React.Children.toArray(n.props.children).includes(label)).props.children[0];
test('Yes immediately creates exactly one editor; normal flow has no link/unlink/picker/add-child controls',()=>{
 const adds=[],changes=[],r=render({...base,onAddConsolation:id=>adds.push(id),onChange:c=>changes.push(c)});
 assert.ok(r.nodes.filter(n=>n.type==='input').every(n=>!n.props.checked));
 const yes=radio(r.nodes,' Yes');yes.props.onChange();yes.props.onChange();assert.deepEqual(adds,[id(1)]);assert.equal(changes.length,0);
 assert.equal(r.nodes.some(n=>n.type==='select'),false);assert.equal(r.nodes.some(n=>n.type==='button'),false);
});
test('an unambiguous old editor is reused without altering it or creating a duplicate',()=>{
 const changes=[],adds=[],events=[main,consy,sat],before=JSON.stringify(events),r=render({...base,events,onChange:c=>changes.push(c),onAddConsolation:id=>adds.push(id)});
 radio(r.nodes,' Yes').props.onChange();assert.equal(adds.length,0);assert.deepEqual(JSON.parse(JSON.stringify(changes)),[{mainClientRowId:id(1),consolationClientRowIds:[id(2)]}]);assert.equal(JSON.stringify(events),before);
 assert.equal(consolationYesIntent(id(1).toUpperCase(),events,[]).kind,'reuse');
});
test('ambiguous historical Mains and Consolations are kept intact, never guessed',()=>{
 const events=[main,{...main,clientRowId:id(4)},consy,{...consy,clientRowId:id(5)}],changes=[],adds=[],r=render({...base,events,onChange:c=>changes.push(c),onAddConsolation:id=>adds.push(id)});
 radio(r.nodes,' Yes').props.onChange();assert.deepEqual(changes,[]);assert.deepEqual(adds,[]);assert.ok(r.state.some(s=>typeof s==='string'&&s.includes('earlier draft')));
 assert.equal(consolationYesIntent(id(1),events,[]).kind,'review_required');
});
test('No is explicit and cancellable, preserving all events until confirmed',()=>{
 const changes=[],r=render({...base,onChange:c=>changes.push(c)});radio(r.nodes,' No').props.onChange();assert.deepEqual(changes,[]);assert.ok(r.state.includes(true));
 const dialog=render({...base,onChange:c=>changes.push(c)},true);dialog.nodes.find(n=>n.type==='button'&&n.props.children==='Cancel').props.onClick();assert.deepEqual(changes,[]);
 dialog.nodes.find(n=>n.type==='button'&&n.props.children==='Confirm No').props.onClick();assert.deepEqual(JSON.parse(JSON.stringify(changes)),[{mainClientRowId:id(1),consolationClientRowIds:[]}]);
});
test('changing Yes to No names affected event and pools, invokes only explicit parent confirmation; rejection retains dialog',()=>{
 const calls=[],choice={mainClientRowId:id(1),consolationClientRowIds:[id(2)]},props={...base,events:[main,consy,sat],choice,onConfirmNo:(m,ids)=>{calls.push([m,ids]);return false;}};
 const r=render(props,true);assert.match(JSON.stringify(r.nodes.map(n=>n.props.children)),/pool settings from this draft/);
 r.nodes.find(n=>n.type==='button'&&n.props.children==='Confirm No').props.onClick();assert.deepEqual(JSON.parse(JSON.stringify(calls)),[[id(1),[id(2)]]]);assert.equal(r.state.includes(false),false);
 const locked=render({...props,disabled:true},true);locked.nodes.find(n=>n.type==='button'&&n.props.children==='Confirm No').props.onClick();assert.equal(calls.length,1);
});
test('already selected historical multiple children stay intact; busy/capacity blocks creation',()=>{
 const events=[main,consy,{...consy,clientRowId:id(5)}],choice={mainClientRowId:id(1),consolationClientRowIds:[id(2),id(5)]};assert.equal(consolationYesIntent(id(1),events,[choice]).kind,'keep');
 for(const options of[{disabled:true},{canAddConsolation:false}]){let adds=0;const r=render({...base,...options,onAddConsolation:()=>adds++});radio(r.nodes,' Yes').props.onChange();assert.equal(adds,0);}
});
