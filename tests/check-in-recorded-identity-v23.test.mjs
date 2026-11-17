import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { recordedCheckInIdentityV23 } from '../src/lib/seating/recorded-identity-v23.ts';
import { id, scope, profile } from './fixtures/check-in-identity-v23.mjs';
const require = createRequire(import.meta.url);

test('exact roster IDs distinguish equal legal names and addresses without exporting hidden fields', () => {
  const a = profile(4), b = profile(5);
  assert.deepEqual(a.player.address, b.player.address);
  assert.equal(a.player.entry.firstName, b.player.entry.firstName);
  assert.equal(recordedCheckInIdentityV23(a, scope, id(4)).displayName, 'Alex Example Sr.');
  assert.equal(recordedCheckInIdentityV23(b, scope, id(5)).displayName, 'Alex Example Jr.');
  assert.equal(recordedCheckInIdentityV23(b, scope, id(4)), null);
  const display = JSON.stringify(recordedCheckInIdentityV23(a, scope, id(4)));
  assert.ok(!display.includes('Fictional Way') && !display.includes(id(4)) && !display.includes(id(14)));
  assert.match(display, /Temporary ID# 1/);
});

test('prefix/middle/suffix and local label come only from valid persisted distinction; legal names untouched', () => {
  const p = profile();
  p.player.distinction = { prefix: 'Dr.', middleName: 'Lee', suffix: 'Sr.', localLabel: 'Father' };
  p.player.displayName = 'Dr. Alex Lee Example Sr. (Father)';
  const actual = recordedCheckInIdentityV23(p, scope, id(4));
  assert.equal(actual?.displayName, p.player.displayName);
  assert.equal(p.player.entry.firstName, 'Alex');
  assert.equal(p.player.entry.lastName, 'Example');
  p.player.displayName = 'Guess from matching name';
  assert.equal(recordedCheckInIdentityV23(p, scope, id(4)), null);
});

test('null, foreign, wrong binding and internal-ID text never render a guessed identity', () => {
  for (const v of [null, {}, profile(4, { actorId: id(99) }), profile(4, { sessionId: id(99) }), profile(4, { tournamentId: id(99) }), profile(4, { rosterEntryId: id(5) })]) assert.equal(recordedCheckInIdentityV23(v, scope, id(4)), null);
  for (const key of ['actorId', 'sessionId', 'tournamentId', 'rosterEntryId']) { const p = profile(); p.player[key] = id(99); assert.equal(recordedCheckInIdentityV23(p, scope, id(4)), null); }
  const p = profile(); p.player.entry.firstName = id(77); p.player.displayName = id(77) + ' Example Sr.';
  assert.equal(recordedCheckInIdentityV23(p, scope, id(4)), null);
});

test('incomplete address is explicit and actual ZZ remains nonmember without generating a number', () => {
  const p = profile(); p.coverage = 'incomplete_reviewed'; p.player.address.street = '';
  p.player.entry.accNumber = 'ZZ1234'; p.player.entry.nonmemberWithoutNumber = false; p.player.issuedReference = 'ZZ1234';
  assert.deepEqual(recordedCheckInIdentityV23(p, scope, id(4)), { displayName: 'Alex Example Sr.', reference: 'ZZ1234', nonmember: true, incompleteAddress: true });
  p.coverage = 'complete'; assert.equal(recordedCheckInIdentityV23(p, scope, id(4)), null);
});

test('actual Seating page gates the read affordance without changing legacy workspace or granting access', async () => {
  const ts = require('typescript'), filename = 'src/app/tournament/[tournamentId]/seating/page.tsx';
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [gate, role, identityActor, expected] of [[false, 'director', scope.actorId, false], [true, 'co_director', scope.actorId, false], [true, 'director', id(99), false], [true, 'director', scope.actorId, true], [true, 'director', 'throws', false]]) {
    let authReads = 0; const loaded = { exports: {} }, SeatingClient = () => null;
    vm.runInNewContext(source, { module: loaded, exports: loaded.exports, require: name => {
      if (name.includes('identity-adoption-v8/gate')) return { adoptionEnabledV8: () => gate };
      if (name.includes('identity-v5/provider')) return { identityAccessV5: async () => { authReads++; if (identityActor === 'throws') throw Error('synthetic optional Auth failure'); return { ...scope, actorId: identityActor }; } };
      if (name.includes('supabase/server')) return { createClient: async () => ({}) };
      if (name.includes('require-tournament-access')) return { requireTournamentAccess: async () => ({ role, user: { id: scope.actorId } }) };
      if (name.includes('seating/workspace')) return { getSeatingWorkspace: async () => ({ registrationClosed: false, publication: null, checkIn: [] }) };
      if (name.includes('fictional-draw-enabled')) return { fictionalDrawBoundaryEnabled: () => false };
      if (name.includes('seating-client')) return { default: SeatingClient };
      if (name.includes('shared-device-sign-out')) return { SharedDeviceSignOut: () => null };
      if (name === 'next/link') return { default: () => null };
      if (name === 'next/navigation') return { notFound: () => { throw Error('notFound'); } };
      if (name.includes('validation')) return { isUuid: () => true };
      return require(name);
    } });
    const tree = await loaded.exports.default({ params: Promise.resolve({ tournamentId: scope.tournamentId }) });
    const find = value => { if (!value || typeof value !== 'object') return null; if (value.props?.actorId === scope.actorId && Array.isArray(value.props?.checkIn)) return value; return [value.props?.children].flat(Infinity).map(find).find(Boolean); };
    assert.equal(!!find(tree).props.identityScope, expected);
    assert.equal(authReads, gate && role === 'director' ? 1 : 0);
  }
});

