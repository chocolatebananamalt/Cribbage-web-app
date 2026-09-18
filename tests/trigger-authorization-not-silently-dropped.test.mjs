// Migration 0177 guarded team side-pool money elections with a trigger whose
// function checked that the actor held director or co_director. Migration 0187
// dropped that trigger and created a trigger of the SAME NAME bound to a
// different function that only checks play state. Nothing re-attached the
// role-checking guard, so authorization on a money path silently disappeared
// and every test still passed.
//
// This replays the migrations in order and fails if any trigger that was ever
// bound to a role-checking function ends up bound to one that is not. It is a
// check on the CLASS of mistake, not on one incident.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const dir = 'database/migrations';

// Final definition of every trigger function, and the binding history of every
// trigger, after replaying the migrations in filename order.
function replay() {
  const functionBodies = new Map();
  const currentBinding = new Map();
  const everBound = new Map();

  for (const file of fs.readdirSync(path.join(root, dir)).filter((n) => n.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(root, dir, file), 'utf8');

    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(app|public)\.([a-z0-9_]+)\s*\(\s*\)\s*returns\s+trigger[\s\S]*?\$\$([\s\S]*?)\$\$\s*;/gi)) {
      functionBodies.set(`${m[1]}.${m[2]}`.toLowerCase(), { body: m[3], file });
    }
    for (const m of sql.matchAll(/drop\s+trigger\s+(?:if\s+exists\s+)?([a-z0-9_]+)\s+on\s+([a-z0-9_.]+)/gi)) {
      currentBinding.delete(`${m[1]}|${m[2]}`.toLowerCase());
    }
    for (const m of sql.matchAll(/create\s+trigger\s+([a-z0-9_]+)[\s\S]*?on\s+([a-z0-9_.]+)[\s\S]*?execute\s+(?:function|procedure)\s+([a-z0-9_.]+)\s*\(/gi)) {
      const key = `${m[1]}|${m[2]}`.toLowerCase();
      const fn = m[3].toLowerCase();
      currentBinding.set(key, { fn, file });
      if (!everBound.has(key)) everBound.set(key, []);
      everBound.get(key).push({ fn, file });
    }
  }
  return { functionBodies, currentBinding, everBound };
}

const { functionBodies, currentBinding, everBound } = replay();
const checksRole = (fn) => {
  const entry = functionBodies.get(fn);
  return Boolean(entry && /tournament_roles/i.test(entry.body));
};

test('the migration replay actually found triggers and trigger functions', () => {
  assert.ok(functionBodies.size > 5, `expected trigger functions, found ${functionBodies.size}`);
  assert.ok(currentBinding.size > 5, `expected trigger bindings, found ${currentBinding.size}`);
  assert.ok([...functionBodies.keys()].some(checksRole), 'expected at least one role-checking trigger function');
});

test('no trigger loses its authorization check to a later rebind', () => {
  const regressions = [];
  for (const [key, history] of everBound) {
    const current = currentBinding.get(key);
    if (!current) continue;
    if (checksRole(current.fn)) continue;
    const lost = history.find((h) => checksRole(h.fn));
    if (!lost) continue;
    const [trigger, table] = key.split('|');
    regressions.push(
      `${trigger} on ${table} was bound to ${lost.fn} (checks tournament_roles, ${lost.file}) ` +
      `but is now bound to ${current.fn} (no role check, ${current.file})`,
    );
  }
  assert.deepEqual(regressions, [], `authorization was silently dropped by a trigger rebind:\n${regressions.join('\n')}`);
});

test('team side-pool money elections are authorized at both the trigger and the RPC', () => {
  // Defence in depth: the trigger alone was removable by a rename, and the RPC
  // alone returns a clean rejection instead of the 503 a raised exception gives.
  const binding = currentBinding.get('event_side_pool_team_election_guard|app.event_side_pool_team_election_versions');
  assert.ok(binding, 'the team election guard trigger must exist');
  assert.ok(checksRole(binding.fn),
    `team election trigger is bound to ${binding && binding.fn}, which does not check tournament_roles`);

  let rpc = null;
  for (const file of fs.readdirSync(path.join(root, dir)).filter((n) => n.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(root, dir, file), 'utf8');
    const start = sql.indexOf('function public.set_event_side_pool_team_election_v1');
    if (start < 0) continue;
    rpc = { body: sql.slice(start, sql.indexOf('end $$;', start)), file };
  }
  assert.ok(rpc, 'the team election RPC must be defined');
  assert.match(rpc.body, /tournament_roles/, `${rpc.file} must reject a non-director inside the RPC`);
  assert.match(rpc.body, /not_director/, `${rpc.file} must return the shared not_director code`);
});
