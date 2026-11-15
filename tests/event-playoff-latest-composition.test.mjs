import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('actual shared editor renders latest prize settings with series and preserves dormant historical fields',()=>{
 const r=spawnSync(process.execPath,['--experimental-strip-types','tests/helpers/render-event-playoff-latest.mjs'],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr||r.stdout);assert.match(r.stdout,/PASS eight latest/);
});
