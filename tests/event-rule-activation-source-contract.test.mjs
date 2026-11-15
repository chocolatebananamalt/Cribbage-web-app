import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const context=readFileSync('database/proposals/event-rule-context-v1.sql','utf8');
const guard=readFileSync('database/proposals/event-settings-activation-guard-v1.sql','utf8');
const source=readFileSync('database/proposals/event-settings-activation-source-v4.sql','utf8');
// Inventory regressions only: not SQL parsing, PostgreSQL/TS parity, real roles,
// transactional rollback or a provider activation acceptance test.
test('new context/intent functions remain private without replacing the existing operational or prize guards',()=>{
 for(const sql of[context,guard]){
  assert.match(sql,/UNEXECUTED PRIVATE PROPOSAL/);
  assert.doesNotMatch(sql,/\bgrant\s+(execute|all|select|insert|update|delete)\b/i);
  assert.doesNotMatch(sql,/drop\s+(trigger|function)|create\s+or\s+replace\s+function\s+public\./i);
  const revoke=sql.slice(sql.lastIndexOf('revoke all on function'));
  for(const m of sql.matchAll(/create function app\.(\w+)\(/g))assert.ok(revoke.includes(`app.${m[1]}(`),m[1]);
 }
 assert.doesNotMatch(guard,/:=\s*public\.(activate|finalize)|perform\s+public\.(activate|finalize)/i);
});
test('activation backstop uses the complete V4 source hash including both legacy arrays',()=>{
 const args=sql=>sql.match(/jsonb_build_array\('event-settings-activation-source-v4',([^)]*)\)::text/)[1].split(',').map(x=>x.trim());
 const a=args(source),b=args(guard);assert.equal(a.length,b.length);assert.deepEqual(a.slice(-2),['legacy_rows','legacy_pins']);assert.deepEqual(b.slice(-2),a.slice(-2));
 assert.match(guard,/jsonb_array_length\(legacy_rows\)<>jsonb_array_length\(legacy_pins\)/);
});
test('backstop rejects retained isolation snapshots before any snapshot-dependent legacy return',()=>{
 const body=guard.split('create function app.require_event_settings_context_v1()')[1].split('end$$;')[0];
 const isolation=body.indexOf("current_setting('transaction_isolation')");
 assert.ok(isolation>=0&&isolation<body.indexOf('select*into s'));
 assert.ok(isolation<body.indexOf('return new'));
 assert.match(body,/'deferredOriginalField'is distinct from'false'/);
});
test('current reviewed source blocks missing/stale context instead of manufacturing empty reviews',()=>{
 const body=guard.split('create function app.get_event_settings_reviewed_source_v1(')[1].split('end$$;')[0];
 assert.match(body,/order by version desc limit 1/);assert.match(body,/current_context_review_required/);assert.match(body,/reviewer_role_changed/);
 assert.match(body,/'configuredReviews',reviews/);assert.match(body,/'activationAllowed',false/);
 assert.match(context,/activated_context_is_frozen/);assert.match(context,/context_value->'originalEntrants'is distinct from'null'/);
});
