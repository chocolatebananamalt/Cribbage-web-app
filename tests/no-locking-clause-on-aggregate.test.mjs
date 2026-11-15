// PostgreSQL rejects a locking clause on a query containing an aggregate:
//   0A000: FOR UPDATE is not allowed with aggregate functions
//
// plpgsql does not parse-analyze a function body at CREATE time, so a migration
// carrying this applies cleanly and the error fires on first invocation, in
// production, on the one code path nobody exercised. That is exactly what
// happened to desk_check_in_event_v1 in migration 0208.
//
// It failed for precisely the players who were eligible, because every
// rejection branch returns before reaching it, and the client reported the
// resulting 503 as "Confirm their event enrollment and paid-in-full payment
// record", so the director was told a fully paid player had not paid.
//
// Verified on PostgreSQL 17.6: the 0208 statement shape raises 0A000, and the
// 0216 shape (target-keyed advisory lock, plain aggregate) executes clean.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../database/migrations/', import.meta.url));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const AGGREGATES = /\b(max|min|count|sum|avg|array_agg|jsonb_agg|string_agg)\s*\(/i;

// Replay the migrations so only each function's EFFECTIVE (last) definition is
// judged. 0208 still contains the defect as history; 0216 supersedes it.
function effectiveDefinitions() {
  const effective = new Map();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const operations = [
      ...[...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi)]
        .map((match) => ({ kind: 'create', match })),
      ...[...sql.matchAll(/alter\s+function\s+public\.([a-z0-9_]+)\s*\([^;]*?\)\s+rename\s+to\s+([a-z0-9_]+)\s*;/gi)]
        .map((match) => ({ kind: 'rename', match })),
    ].sort((left, right) => left.match.index - right.match.index);
    for (const operation of operations) {
      const { match } = operation;
      if (operation.kind === 'rename') {
        const prior = effective.get(match[1].toLowerCase());
        if (prior) {
          effective.delete(match[1].toLowerCase());
          effective.set(match[2].toLowerCase(), prior);
        }
        continue;
      }
      const body = sql.slice(match.index, sql.indexOf('$$;', match.index) + 3);
      effective.set(match[1].toLowerCase(), { file, body });
    }
  }
  return effective;
}

const effective = effectiveDefinitions();

test('the migration scan found the functions it is meant to judge', () => {
  assert.ok(effective.size > 150, `expected many functions, found ${effective.size}`);
  assert.ok(effective.has('desk_check_in_event_v1'), 'expected the repaired function to be present');
});

test('no live function locks a row set it reads with an aggregate', () => {
  const offenders = [];
  for (const [name, { file, body }] of effective) {
    // A statement is the text between semicolons; a locking clause binds to the
    // statement it closes, so that is the right unit to judge.
    for (const statement of body.split(';')) {
      if (!/\bfor\s+(update|no\s+key\s+update|share|key\s+share)\b/i.test(statement)) continue;
      const lockAt = statement.search(/\bfor\s+(update|no\s+key\s+update|share|key\s+share)\b/i);
      if (AGGREGATES.test(statement.slice(0, lockAt))) {
        offenders.push(`${file} ${name}: ${statement.trim().slice(0, 140)}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'these raise 0A000 on first invocation, having applied cleanly:\n' + offenders.join('\n'));
});

test('the desk check-in repair keeps the write serialized on its target', () => {
  const { body: wrapper } = effective.get('desk_check_in_event_v1');
  const { body } = effective.get('desk_check_in_event_v1_before_start_guard');
  // Removing the locking clause alone would trade a hard error for a silent
  // lost update: the checked_in guard and the version read are a
  // read-check-write, and the pre-existing advisory lock keys on
  // actor + idempotency key, which only dedupes one caller's own retry.
  assert.match(wrapper, /lock_event_attendance_lifecycle_v1\(p_event_id\)/,
    'the public wrapper must share the event lifecycle lock');
  assert.match(wrapper, /desk_check_in_event_v1_before_start_guard\(/,
    'the public wrapper must delegate to the target-serialized implementation');
  assert.match(body, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\('desk-check-in:'/,
    'the repair must take a target-keyed advisory lock');
  const lockAt = body.indexOf("'desk-check-in:'");
  const guardAt = Math.max(body.indexOf("e.state='checked_in'"), body.indexOf("v_state='checked_in'"));
  const versionAt = body.indexOf('coalesce(max(version),0)+1');
  assert.ok(lockAt > 0 && guardAt > lockAt && versionAt > guardAt,
    'the lock must be taken before both the existence check and the version read');
});
