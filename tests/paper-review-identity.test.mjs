import test from 'node:test';import assert from 'node:assert/strict';import{spawnSync}from'node:child_process';
test('real paper entry and independent-review markup distinguishes duplicate names and requires an explicit winner',()=>{
 const result=spawnSync(process.execPath,['--experimental-strip-types','tests/helpers/render-paper-review-identity.mjs'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);assert.match(result.stdout,/all 8 winner choices unchecked/);
});
