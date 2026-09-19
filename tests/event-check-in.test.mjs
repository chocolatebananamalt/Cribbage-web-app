import { readFileSync } from "node:fs";
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';

const token = await import('../src/lib/event-check-in-token.ts');
const id = '0f2f2d31-12ab-4bcd-8b8c-1234567890ab';

test('event check-in credentials are opaque fragment-only 256-bit values', () => {
  const credential = token.createEventCheckInCredential(id);
  assert.match(credential.secret, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(token.parseEventCheckInCredential(credential.canonicalToken), credential);
  assert.equal(token.parseEventCheckInCredential(`https://example.test/event-check-in#${credential.canonicalToken}`), null);
  assert.equal(token.parseEventCheckInCredential(`${credential.canonicalToken}.extra`), null);
});

test('completion sessions use the same opaque 256-bit token shape', () => {
  const completion = token.createEventCheckInCredential(id);
  assert.match(completion.canonicalToken, /^[0-9a-f-]+\.[A-Za-z0-9_-]{43}$/);
  assert.equal(token.parseEventCheckInCredential(completion.canonicalToken)?.canonicalToken, completion.canonicalToken);
});

test('event check-in retains only a fixed-length salted digest', () => {
  const credential = token.createEventCheckInCredential(id);
  const digest = token.digestEventCheckInCredential(randomBytes(32), credential.canonicalToken);
  assert.equal(digest.byteLength, 32);
  assert.throws(() => token.digestEventCheckInCredential(randomBytes(31), credential.canonicalToken), /Invalid/);
});

test('event QR migration constrains expiry, separates events, and fails closed', async () => {
  const sql = await import('node:fs/promises').then(({ readFile }) => readFile('database/migrations/0207_rotating_event_qr_check_in.sql', 'utf8'));
  assert.match(sql, /expires_at <= issued_at \+ interval '61 seconds'/);
  assert.match(sql, /event_check_in_windows.*state in \('open','closed'\)/s);
  assert.match(sql, /w\.state='open'.*c\.expires_at>now\(\)/s);
  assert.match(sql, /return jsonb_build_object\('status','unavailable'\)/);
  assert.match(sql, /consolation_not_eligible/);
  assert.match(sql, /event_qr_player_is_paid_and_enrolled/);
});

test('public check-in does not expose roster or payment detail', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => readFile('src/app/event-check-in/event-check-in-form.tsx', 'utf8'));
  assert.match(source, /Please visit the tournament check-in desk to complete enrollment and payment\./);
  assert.doesNotMatch(source, /amountOwed|amountReceived|rosterEntryId/);
});

test('five-minute completion accepts adult or youth ACC numbers after a valid current scan', async () => {
  const [completionSql, youthSql] = await Promise.all([
    import('node:fs/promises').then(({ readFile }) => readFile('database/migrations/0209_event_check_in_completion_sessions.sql', 'utf8')),
    import('node:fs/promises').then(({ readFile }) => readFile('database/migrations/0210_youth_acc_number_support.sql', 'utf8')),
  ]);
  assert.match(completionSql, /interval '5 minutes 1 second'/);
  assert.match(completionSql, /bootstrap_event_check_in_qr_v1/);
  assert.match(youthSql, /submit_event_check_in_completion_v1/);
  assert.match(youthSql, /\^\[A-Z\]\{2\}\[0-9\]\+Y\?\$/);
});

test('check-in form gives a visible completion countdown and requires ACC number', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => readFile('src/app/event-check-in/event-check-in-form.tsx', 'utf8'));
  assert.match(source, /remaining. Complete check-in within the time shown/);
  assert.match(source, /Your check-in time expired/);
  assert.match(source, /name="accNumber" required/);
  assert.match(source, /HI296Y for a youth player/);
  assert.match(source, /sessionStorage/);
});

test("a desk row that cannot be checked in says why on screen", () => {
  const client = readFileSync("src/app/tournament/[tournamentId]/event-check-in/event-check-in-client.tsx", "utf8");
  // Every control on the row is gated on row.paid, and the desk rule behind it
  // needs a recorded obligation rather than a zero balance. A player nobody has
  // priced yet reads as "$0.00 received of $0.00", which looks square, while
  // all three buttons sit dead with nothing saying why.
  assert.match(client, /has no recorded payment for this tournament, so the desk cannot check them in/);
  assert.match(client, /enter 0 if there is no fee/);
  assert.match(client, /Check-in is closed for this event, so this row cannot be changed/);
  const reason = client.indexOf("rowBlockedReason && attendance !== 'checked_in'");
  const deskButton = client.indexOf("Check in at desk");
  assert.ok(reason > -1 && reason < deskButton, "the reason must render above the buttons it explains");
});
