import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const reader=readFileSync('database/proposals/native-event-ledger-source-reader-v1.sql','utf8');
const writer=readFileSync('database/proposals/native-event-ledger-allocation-v1.sql','utf8');
// Source inventory checks only. These do not execute PostgreSQL or prove ACL,
// lock ordering, transaction rollback or concurrent-provider behavior.
test('allocation reservation covers every native source-reader table, including optional simulation registries',()=>{
 const dependencies=new Set([...reader.matchAll(/\b(?:from|join)\s+(app\.\w+)/gi)].map(m=>m[1]));
 dependencies.delete('app.tournaments');dependencies.delete('app.tournament_roles'); // Explicit row locks.
 const body=writer.split('create function app.lock_native_ledger_sources_v1()')[1].split('end$$;')[0];
 for(const relation of dependencies)assert.ok(body.includes(relation),`unreserved source ${relation}`);
 for(const name of ['app.synthetic_mixed_fixtures_v1','app.synthetic_mixed_finance_scopes_v1'])assert.ok(body.includes(name));
 assert.match(body,/in share mode nowait/);
});
test('allocation functions and history remain private proposals without a public grant',()=>{
 assert.match(writer,/UNEXECUTED PRIVATE PROPOSAL/);
 assert.doesNotMatch(writer,/\bgrant\s+(?:execute|all|select|insert|update|delete)\b/i);
 const functions=[...writer.matchAll(/create function app\.(\w+)\(([^)]*)\)/g)].map(m=>m[1]);
 const revoke=writer.slice(writer.lastIndexOf('revoke all on function'));
 for(const name of functions)assert.ok(revoke.includes(`app.${name}(`),`function not revoked: ${name}`);
 assert.match(writer,/before update or delete/);
 assert.match(writer,/enable row level security/);
});
test('current-read and immutable operation receipt have distinct freshness contracts',()=>{
 const current=writer.split('create function app.get_native_ledger_allocation_v1(')[1].split('end$$;')[0];
 const receipt=writer.split('create function app.get_native_ledger_allocation_operation_v1(')[1].split('end$$;')[0];
 assert.match(current,/head\.source_digest is distinct from cur->>'sourceDigest'/);
 assert.match(current,/'status','stale'.*'fundAvailable',false/);
 assert.match(receipt,/'historicalReceipt',true/);
 assert.match(receipt,/'fundAvailable',false/);
 assert.match(receipt,/actor_id=a and operation_id=op and tournament_id=tid/);
});
