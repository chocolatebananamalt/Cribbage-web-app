import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {isAppRecoveryStorageKey} from '../src/lib/client-session-storage.ts';

// This is NOT an authenticated recovery writer. It accepts only strict anonymous
// planning aliases and writes one dedicated non-recovery key. Inventory explicitly
// so a storage alias cannot silently bypass the coordinator audit.
test('anonymous local planner storage is single-key, strictly validated and compare-and-write',()=>{
 const file='src/lib/seating/anonymous-planner-storage.ts',source=fs.readFileSync(file,'utf8');
 assert.match(source,/anonymousPlannerStorageKey = "cribbage-local-seating-plan-v1"/);
 assert.match(source,/if \(!isAnonymousPlannerState\(value\)\) return null/);
 assert.match(source,/before !== expectedRaw/);
 assert.match(source,/readAnonymousPlannerState\(storage\).status !== "saved"/);
 assert.equal(isAppRecoveryStorageKey('cribbage-local-seating-plan-v1'),false);
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let writes=0;
 const visit=node=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='setItem'){
  writes++;assert.equal(node.expression.expression.getText(ast),'storage');assert.equal(node.arguments[0]?.getText(ast),'anonymousPlannerStorageKey');assert.equal(node.arguments.length,2);
 }ts.forEachChild(node,visit)};visit(ast);assert.equal(writes,1);
 assert.doesNotMatch(source,/removeItem|clearAppSessionStorage|setAppRecoveryItem|supabase|fetch\(/);
 const client=fs.readFileSync('src/components/local-seating-planner.tsx','utf8');
 assert.match(client,/saveAnonymousPlannerState\(sessionStorage, next, raw.current\)/);assert.doesNotMatch(client,/\.setItem\(/);
});
