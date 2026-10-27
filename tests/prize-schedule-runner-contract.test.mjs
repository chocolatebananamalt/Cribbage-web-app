import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const file of ['tests/run-prize-schedule-v1-isolated.mjs','tests/prize-schedule-concurrency.mjs']) {
 test(`${file} rejects missing, malformed and extra scope arguments before Docker`,()=>{
  for(const args of [[],['--isolated-container'],['--isolated-container','--container-id','invalid'],['--isolated-container','--container-id','a'.repeat(64),'extra']]) {
   const result=spawnSync(process.execPath,[file,...args],{encoding:'utf8'});
   assert.notEqual(result.status,0);assert.match(result.stderr,/Exact --isolated-container --container-id/);assert.doesNotMatch(result.stderr,/permission denied|Docker|docker.sock/i);
  }
  const source=readFileSync(file,'utf8');
  assert.match(source,/--container-id/);assert.doesNotMatch(source,/expectedContainerId\s*=\s*["'][a-f0-9]{64}["']/);
  assert.match(source,/NetworkMode/);assert.match(source,/Mounts/);assert.match(source,/PortBindings/);assert.match(source,/Privileged/);
 });
}
