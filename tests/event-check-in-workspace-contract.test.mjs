// The Event QR Check-In page answered 500 on every request, in production, on
// the day-of-play screen, because the database and the code disagreed about the
// shape of one JSON object and nothing compared them.
//
// Migration 0208 emitted roster rows as
//   { rosterEntryId, displayName, accNumber, eventIds[], paid, checkedInEventIds[] }
// but both live databases returned
//   { rosterEntryId, displayName, accNumber, events[{eventId, participantStatus,
//     attendanceState}], paid, amountOwedMinor, amountReceivedMinor, paymentMethod }
//
// No migration produced that second shape: it was applied straight to the
// databases. The page declared the first shape with a bare `as` cast, so
// TypeScript was satisfied, every test passed, and the failure only appeared as
//   TypeError: Cannot read properties of undefined (reading 'includes')
// at runtime, for a director, on tournament morning.
//
// Migration 0217 records the live definition. This file makes the two sides
// agree from now on: the newest migration that defines the RPC is the contract,
// and the page type has to match it.
//
// Verified fail-closed: reverting the client to row.eventIds turns this red, and
// so does restoring the 0208 roster shape as a newer migration.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const migrationsDir = path.join(root, 'database', 'migrations');
const RPC = 'get_event_check_in_workspace_v1';

// The effective definition is the one in the highest-numbered migration.
function newestDefinition() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  let found = null;
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    if (new RegExp(`function\\s+public\\.${RPC}\\s*\\(`, 'i').test(sql)) found = { file, sql };
  }
  return found;
}

// Comments explaining a defect naturally quote the defect. Strip them, or this
// file fails on its own prose rather than on the code.
function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

// Everything from the 'roster' key to the end of the definition.
function rosterSection(sql) {
  const at = sql.indexOf("'roster'");
  assert.notEqual(at, -1, `${RPC} no longer emits a 'roster' key`);
  return sql.slice(at);
}

const definition = newestDefinition();

test('a migration still defines the check-in workspace RPC', () => {
  assert.ok(definition, `no migration defines public.${RPC}: the contract below cannot be checked`);
});

test('the page type matches the roster shape the newest migration emits', () => {
  const roster = rosterSection(definition.sql);
  const page = fs.readFileSync(
    path.join(root, 'src', 'app', 'tournament', '[tournamentId]', 'event-check-in', 'page.tsx'),
    'utf8',
  );

  // Fields the page is entitled to read, because the migration emits them.
  for (const field of ['rosterEntryId', 'displayName', 'accNumber', 'events', 'paid']) {
    assert.ok(
      roster.includes(`'${field}'`),
      `${definition.file} stopped emitting roster.${field}, but page.tsx still declares it`,
    );
    assert.ok(
      page.includes(field),
      `${definition.file} emits roster.${field} but page.tsx does not declare it`,
    );
  }

  // The per-event entries, which are what the desk list filters on.
  for (const field of ['eventId', 'participantStatus', 'attendanceState']) {
    assert.ok(
      roster.includes(`'${field}'`),
      `${definition.file} stopped emitting roster.events[].${field}`,
    );
    assert.ok(page.includes(field), `page.tsx does not declare roster.events[].${field}`);
  }
});

test('the fields that caused the 500 are gone from both sides', () => {
  const roster = rosterSection(definition.sql);
  for (const dead of ['eventIds', 'checkedInEventIds']) {
    assert.ok(
      !new RegExp(`'${dead}'`).test(roster),
      `${definition.file} emits roster.${dead} again. That is the 0208 shape; the app reads events[] now, so this would break the desk list in the other direction.`,
    );
  }

  const client = codeOnly(fs.readFileSync(
    path.join(root, 'src', 'app', 'tournament', '[tournamentId]', 'event-check-in', 'event-check-in-client.tsx'),
    'utf8',
  ));
  for (const dead of ['eventIds', 'checkedInEventIds']) {
    assert.ok(
      !new RegExp(`\\.${dead}\\b`).test(client),
      `event-check-in-client.tsx reads row.${dead} again: that field does not exist and this is the 500 coming back`,
    );
  }
});

test('the workspace is validated at runtime, not merely cast', () => {
  const page = codeOnly(fs.readFileSync(
    path.join(root, 'src', 'app', 'tournament', '[tournamentId]', 'event-check-in', 'page.tsx'),
    'utf8',
  ));
  assert.ok(
    !/data as EventCheckInWorkspace/.test(page),
    'page.tsx casts the RPC result again. A cast is not a check: that is precisely how a shape change reached the browser as a TypeError.',
  );
  assert.match(
    page,
    /isEventCheckInWorkspace\(data\)/,
    'page.tsx no longer validates the RPC result before handing it to the client',
  );
  assert.match(
    page,
    /attendanceState === 'string'|typeof entry\.attendanceState/,
    'the guard no longer checks the per-event attendance state the desk list depends on',
  );
});
