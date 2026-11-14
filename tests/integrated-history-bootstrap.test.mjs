import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {restoreIntegratedHistory} from './helpers/restore-integrated-history.mjs';

function fixture(run){
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'cribbage-history-test-'));
  const workspaceRoot=path.join(temporary,'workspace'),fixtureRoot=path.join(temporary,'bundle');
  fs.mkdirSync(workspaceRoot);fs.mkdirSync(fixtureRoot);
  const bytes=Buffer.from('{"fictionalHistoricalInput":true}\n'),entry={path:'test-results/fictional-history/result.json',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  const source=path.join(fixtureRoot,entry.path);fs.mkdirSync(path.dirname(source),{recursive:true});fs.writeFileSync(source,bytes);
  const manifest={version:1,files:[entry]},save=()=>fs.writeFileSync(path.join(fixtureRoot,'manifest.json'),JSON.stringify(manifest));save();
  try{return run({workspaceRoot,fixtureRoot,entry,bytes,source,manifest,save});}
  finally{const resolved=path.resolve(temporary),parent=path.resolve(os.tmpdir());assert.equal(path.dirname(resolved),parent);assert(path.basename(resolved).startsWith('cribbage-history-test-'));fs.rmSync(resolved,{recursive:true,force:false});assert.equal(fs.existsSync(resolved),false);}
}

test('historical bootstrap restores missing approved bytes and leaves exact existing inputs alone',()=>fixture(o=>{
  const result=restoreIntegratedHistory(o);assert.equal(result.restored,1);assert.equal(result.approved,1);assert.deepEqual(fs.readFileSync(path.join(o.workspaceRoot,o.entry.path)),o.bytes);
  assert.equal(restoreIntegratedHistory(o).restored,0);assert.deepEqual(fs.readFileSync(o.source),o.bytes);
}));

test('historical bootstrap refuses a conflicting existing input without replacing or partially restoring',()=>fixture(o=>{
  const target=path.join(o.workspaceRoot,o.entry.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,'unrelated retained evidence');
  const second={...o.entry,path:'test-results/fictional-history/second.json'};fs.writeFileSync(path.join(o.fixtureRoot,second.path),o.bytes);o.manifest.files.unshift(second);o.save();
  assert.throws(()=>restoreIntegratedHistory(o),/refusing overwrite/);assert.equal(fs.readFileSync(target,'utf8'),'unrelated retained evidence');assert.equal(fs.existsSync(path.join(o.workspaceRoot,second.path)),false);
}));

test('historical bootstrap rejects corrupted bundles and traversal or excessive manifests',()=>fixture(o=>{
  fs.writeFileSync(o.source,'corrupt');assert.throws(()=>restoreIntegratedHistory(o),/hash mismatch/);assert.equal(fs.existsSync(path.join(o.workspaceRoot,o.entry.path)),false);fs.writeFileSync(o.source,o.bytes);
  for(const invalid of ['../outside.json','test-results/../outside.json','C:/outside.json']){o.manifest.files=[{...o.entry,path:invalid}];o.save();assert.throws(()=>restoreIntegratedHistory(o),/Invalid historical fixture entry/);}
  o.manifest.files=Array.from({length:65},()=>o.entry);o.save();assert.throws(()=>restoreIntegratedHistory(o),/bounded historical fixture manifest/);
}));
