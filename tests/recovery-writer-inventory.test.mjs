import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {isAppRecoveryStorageKey,countAppSessionStorageRecords,clearAppSessionStorage} from '../src/lib/client-session-storage.ts';
const inventory=JSON.parse(fs.readFileSync('docs/quality/2026-10-28-recovery-writer-inventory.json','utf8'));
test('every inventoried retained writer uses the coordinator and every literal prefix is counted',()=>{
  let checked=0;
  for(const {path:file} of inventory.synchronousWriters){
    const source=fs.readFileSync(file,'utf8');assert.match(source,/setAppRecoveryItem|setPublicCheckInRecoveryItem/);assert.doesNotMatch(source,/(?:sessionStorage|storage)\.setItem\(/);
    const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const visit=node=>{const value=ts.isTemplateExpression(node)?node.head.text:ts.isStringLiteral(node)?node.text:null;
      if(value&&/^[a-z][a-z0-9-]*:/.test(value)&&!/^https?:/.test(value)){assert.equal(isAppRecoveryStorageKey(value),true,`${file}: unregistered recovery prefix`);checked++;}ts.forEachChild(node,visit);};visit(ast);
  }
  assert.ok(checked>=33);
});
test('new direct session-storage writers cannot bypass the inventory',()=>{
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):/\.tsx?$/.test(entry.name)?[path.join(dir,entry.name)]:[]);
  for(const file of walk('src')){
    const source=fs.readFileSync(file,'utf8');
    if(file.replaceAll('\\','/')==='src/lib/recovery-write-coordinator.ts')continue;
    assert.doesNotMatch(source,/(?:window\.)?sessionStorage\.setItem\(/,`${file} bypasses recovery guard`);
  }
});
test('all retained prefixes block switching and targeted cleanup leaves unrelated records intact',()=>{
  const data=new Map([['paper-official-identity:fixture','pending'],['event-dispute:open:fixture','pending'],['hybrid-game-review:fixture','pending'],['acc:event-check-in:completion','pending'],['payment-obligation:q-pool:actor:tournament','pending'],['unrelated-site-preference','keep']]);
  const storage={get length(){return data.size},key:i=>[...data.keys()][i]??null,removeItem:key=>data.delete(key)};
  assert.equal(countAppSessionStorageRecords(storage),5);clearAppSessionStorage(storage);assert.deepEqual([...data],[['unrelated-site-preference','keep']]);assert.equal(isAppRecoveryStorageKey('unregistered:new'),false);
});
