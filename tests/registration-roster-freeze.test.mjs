import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(
  new URL('../database/migrations/0124_registration_roster_freeze.sql', import.meta.url),
  'utf8',
);
const fixture = readFileSync(
  new URL('./registration-roster-freeze.sql', import.meta.url),
  'utf8',
);

test('roster inserts require an open registration window under a tournament lock', () => {
  assert.match(sql, /before insert on app\.tournament_roster_entries/i);
  assert.match(sql, /from app\.tournaments t[\s\S]*for update/i);
  assert.match(sql, /v_tournament_status not in \('draft', 'open'\)/i);
  assert.match(sql, /v_registration_status <> 'open'/i);
  assert.match(sql, /registration is closed; roster membership is frozen/i);
});

test('approved setup activation opens registration only on the initial draft-to-open transition', () => {
  assert.match(sql, /before update of status on app\.tournaments/i);
  assert.match(sql, /old\.status = 'draft'[\s\S]*new\.status = 'open'/i);
  assert.match(sql, /old\.registration_status = 'closed'/i);
  assert.match(sql, /from app\.tournament_setup_activations activation/i);
  assert.match(sql, /new\.registration_status := 'open'/i);
});

test('registration guard functions are not directly callable by application roles', () => {
  assert.match(sql, /revoke all on function app\.require_open_registration_for_roster_insert\(\) from public, anon, authenticated/i);
  assert.match(sql, /revoke all on function app\.open_registration_on_tournament_activation\(\) from public, anon, authenticated/i);
});

test('rollback fixture proves closure rejection and exact accepted replay', () => {
  assert.match(fixture, /begin;[\s\S]*rollback;/i);
  assert.match(fixture, /set registration_status = 'closed'/i);
  assert.match(fixture, /'exact_replay'[\s\S]*create_manual_roster_entry_v1/i);
  assert.match(fixture, /v_replay <> v_created/i);
  assert.match(fixture, /new roster request was not rejected after closure/i);
});
