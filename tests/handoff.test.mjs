import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const base='imports/acc-handoff-2026-09-05/';
const inventory=JSON.parse(readFileSync('docs/recovery/inventory.json','utf8').replace(/^\uFEFF/,''));
test('all originals and organized copies match manifest bytes and SHA-256',()=>{
  const lines=readFileSync(base+'FILE_SHA256_MANIFEST.txt','utf8').split(/\r?\n/).filter(x=>/^[a-f0-9]{64} \|/.test(x));
  assert.equal(lines.length,32);assert.equal(inventory.length,32);
  for(const line of lines){
    const [hash,size,name]=line.split(' | ');const row=inventory.find(x=>x.name===name);assert.ok(row,name);
    for(const p of [base+name,row.organizedPath]){const b=readFileSync(p);assert.equal(b.length,Number(size),p);assert.equal(createHash('sha256').update(b).digest('hex'),hash,p)}
  }
});
function demo(){
  const html=readFileSync(base+'ACC_Digital_Tournament_System_Pilot_Review_Prototype_v1.3.html','utf8');
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
  const els=new Map(),store=new Map();
  const element=id=>{if(!els.has(id))els.set(id,{innerHTML:'',value:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){}});return els.get(id)};
  const ctx=vm.createContext({document:{getElementById:element,querySelectorAll:()=>[]},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},setTimeout:()=>{},alert:()=>{}});
  for(const script of scripts)new vm.Script(script).runInContext(ctx,{timeout:1000});
  return {run:code=>vm.runInContext(code,ctx,{timeout:1000}),html:()=>element('workspace').innerHTML};
}
test('seven recovered role screens render in simulated DOM',()=>{
  const d=demo();for(const role of ['player','director','cross','judge','finance','flyer','summary']){d.run(`state.role='${role}';render()`);assert.ok(d.html().length>100,role)}
});
for(const [result,spread,total,wins,net] of [['win',29,11,5,69],['win',30,12,5,70],['loss',30,9,4,10]]){
  test(`prototype arithmetic characterization: ${result} ${spread}`,()=>{
    const d=demo();d.run(`state.result='${result}';state.spread=${spread};scorecard()`);
    assert.ok(d.html().includes(`Total Game Points</span><strong>${total}</strong>`));
    assert.ok(d.html().includes(`Games Won</span><strong>${wins}</strong>`));
    assert.ok(d.html().includes(`Net Spread</span><strong>+${net}</strong>`));
    assert.equal((d.html().match(/<td[^>]*>—<\/td>/g)||[]).length,28);
  });
}
test('reviewer notes isolated by section in local storage',()=>{
  const d=demo();d.run("state.role='player';notesEl.value='Player note';saveCurrentNote();state.role='finance';notesEl.value='Finance note';saveCurrentNote()");
  assert.equal(d.run("loadNote('player')"),'Player note');assert.equal(d.run("loadNote('finance')"),'Finance note');assert.equal(d.run("loadNote('judge')"),'');
});
