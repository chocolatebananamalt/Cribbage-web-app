import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Supabase auth scaffolding fails closed and does not expose server secrets', () => {
  const env = read('src/lib/env.ts');
  const browser = read('src/lib/supabase/client.ts');
  const server = read('src/lib/supabase/server.ts');
  assert.match(env, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(env, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(env, /throw new Error/);
  assert.doesNotMatch(browser + server, /SERVICE_ROLE|SECRET|SUPABASE_KEY\s*=/i);
  assert.match(browser, /createBrowserClient/);
  assert.match(server, /createServerClient/);
  assert.match(server, /cookies\(\)/);
  assert.match(browser, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(browser, /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
});

test('deployment runtime is pinned to the tested Node major', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.engines.node, '24.x');
});

test('callback only accepts same-origin relative redirect paths', () => {
  const route = read('src/app/auth/callback/route.ts');
  assert.match(route, /startsWith\("\/\/"\)/);
  assert.match(route, /startsWith\("\/"\)/);
  assert.match(route, /exchangeCodeForSession/);
  assert.match(route, /error=missing_code/);
});

test('sign-in uses publishable browser auth and keeps the prototype route available', () => {
  const page = read('src/app/sign-in/page.tsx');
  assert.match(page, /signInWithOtp/);
  assert.match(page, /shouldCreateUser: false/);
  assert.match(page, /requestedNext/);
  assert.match(page, /encodeURIComponent\(next\)/);
  assert.match(page, /auth\/callback/);
  assert.match(page, /type="email"/);
  assert.match(read('src/app/page.tsx'), /export default|TournamentDashboard/);
});

test('proxy refreshes claims and protected tournament data requires server membership', () => {
  const proxy = read('src/proxy.ts') + read('src/lib/api/mutation-origin-gateway.ts') + read('src/lib/supabase/proxy.ts');
  const dal = read('src/lib/auth/require-tournament-access.ts');
  const page = read('src/app/tournament/[tournamentId]/page.tsx');
  assert.match(proxy, /getClaims/);
  assert.match(proxy, /invalid_origin/);
  assert.match(proxy, /private, no-store/);
  assert.match(proxy, /operation_unavailable/);
  assert.match(proxy, /await updateSession/);
  assert.match(proxy, /catch/);
  assert.match(proxy, /"\/api\/v1\/:path\*"/);
  assert.match(proxy, /response\.cookies\.set/);
  assert.match(proxy, /refreshedHeaders/);
  assert.match(proxy, /setAll\(cookiesToSet, headersToSet\)/);
  assert.match(proxy, /cache-control/);
  assert.match(proxy, /private, no-store/);
  assert.doesNotMatch(proxy, /x-supabase-session-refresh/);
  assert.match(proxy, /matcher/);
  assert.match(dal, /getClaims/);
  assert.match(dal, /claimsError/);
  assert.doesNotMatch(dal, /getUser/);
  assert.match(dal, /\.rpc\("get_tournament_role"/);
  assert.match(dal, /notFound/);
  assert.match(page, /requireTournamentAccess/);
  assert.match(page, /director.*co_director/);
  assert.match(page, /\/roster/);
});

test('API v1 mutation origin decision rejects only unsafe cross-origin writes', async () => {
  const { apiMutationOriginMatcher, apiMutationOriginRejection, rejectsApiMutationOrigin } = await import(pathToFileURL(path.join(root, 'src/lib/api/mutation-origin-gateway.ts')).href);
  const requestOrigin = 'https://example.test';
  const check = (pathname, method, origin) => rejectsApiMutationOrigin({ pathname, method, origin, requestOrigin });
  assert.equal(apiMutationOriginMatcher, '/api/v1/:path*');
  assert.deepEqual(apiMutationOriginRejection, {
    body: { error: 'invalid_origin' },
    init: { status: 403, headers: { 'cache-control': 'private, no-store' } },
  });
  assert.equal(check('/api/v1/games/example/submissions', 'POST', 'https://other.example'), true);
  assert.equal(check('/api/v1/registration/example.jpg', 'POST', 'https://other.example'), true);
  assert.equal(check('/api/v1/games/example/submissions', 'POST', null), true);
  assert.equal(check('/api/v1/games/example/submissions', 'POST', requestOrigin), false);
  assert.equal(check('/api/v1/games/example/submissions', 'GET', null), false);
  assert.equal(check('/api/v1/games/example/submissions', 'HEAD', null), false);
  assert.equal(check('/api/v1/games/example/submissions', 'OPTIONS', null), false);
  assert.equal(check('/api/v2/games/example/submissions', 'POST', 'https://other.example'), false);
});

test('protected screens offer a shared-device clear and local sign-out boundary', () => {
  const control = read('src/components/shared-device-sign-out.tsx');
  const storage = read('src/lib/client-session-storage.ts');
  const signOut = read('src/app/auth/sign-out/route.ts');
  const protectedScreens = [
    'src/app/tournament/[tournamentId]/page.tsx',
    'src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx',
    'src/app/tournament/[tournamentId]/corrections/page.tsx',
    'src/app/tournament/[tournamentId]/how-to/page.tsx',
  ].map(read).join('\n');
  assert.match(control, /clearThenSignOut\(window\.sessionStorage/);
  assert.match(control, /fetch\("\/auth\/sign-out"/);
  assert.match(control, /window\.location\.replace\(destination\.toString\(\)\)/);
  assert.match(signOut, /request\.headers\.get\("origin"\) !== request\.nextUrl\.origin/);
  assert.match(signOut, /auth\.signOut\(\{ scope: "local" \}\)/);
  assert.match(signOut, /Clear-Site-Data/);
  assert.match(signOut, /"cache", "storage"/);
  assert.match(signOut, /cache-control/);
  assert.doesNotMatch(signOut, /source\.headers\.forEach/);
  assert.match(storage, /"acc-score:"/);
  assert.match(storage, /"acc-correction:"/);
  assert.match(storage, /"registration-operation:"/);
  assert.match(storage, /storage\.removeItem\(key\)/);
  assert.equal((protectedScreens.match(/SharedDeviceSignOut/g) ?? []).length, 8);
});

test('shared-device cleanup recognizes the actual registration key and propagates storage failures', async () => {
  const storage = await import(pathToFileURL(path.join(root, 'src/lib/client-session-storage.ts')).href);
  const removed = [];
  const fixture = {
    get length() { return 3; },
    key(index) { return ['registration-operation:opaque-token', 'acc-score:opaque-operation', 'unrelated'][index] ?? null; },
    removeItem(key) { removed.push(key); if (key.startsWith('acc-score:')) throw new Error('storage unavailable'); },
  };
  assert.throws(() => storage.clearAppSessionStorage(fixture), /storage unavailable/);
  assert.deepEqual(removed, ['acc-score:opaque-operation']);
});

test('shared-device sign-out continues when local storage cleanup fails', async () => {
  const storage = await import(pathToFileURL(path.join(root, 'src/lib/client-session-storage.ts')).href);
  let signOutCalls = 0;
  const fixture = {
    get length() { return 1; },
    key() { return 'registration-operation:opaque-token'; },
    removeItem() { throw new Error('storage unavailable'); },
  };
  const result = await storage.clearThenSignOut(fixture, async () => { signOutCalls += 1; return true; });
  assert.equal(signOutCalls, 1);
  assert.deepEqual(result, { localClearFailed: true, signedOut: true });
  assert.match(read('src/app/sign-in/page.tsx'), /local_clear_review/);
  assert.match(read('src/app/sign-in/page.tsx'), /Close this browser before another person uses this device/);
});

test('ambiguous score submission locks one exact persisted retry envelope', async () => {
  const retry = await import(pathToFileURL(path.join(root, 'src/lib/score-retry-envelope.ts')).href);
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  const envelope = { version: 1, kind: 'submission', tournamentId: 'tournament-1', gameId: 'game-1', playerSide: 'a', submissionId: 'submission-1', idempotencyKey: 'operation-1', submissionSlot: 1, winnerSide: 'a', margin: 31 };
  assert.equal(retry.writePendingScoreSubmission(storage, envelope), true);
  assert.deepEqual(retry.readPendingScoreSubmission(storage, 'tournament-1', 'game-1', 'a'), envelope);
  assert.equal(retry.readPendingScoreSubmission(storage, 'tournament-1', 'game-1', 'b'), null);
  values.set(retry.scoreSubmissionStorageKey('tournament-1', 'game-1', 'a'), JSON.stringify({ ...envelope, margin: 122 }));
  assert.equal(retry.readPendingScoreSubmission(storage, 'tournament-1', 'game-1', 'a'), null);
  assert.equal(values.size, 0);
  assert.deepEqual(retry.pendingSubmissionRecovery(envelope, 'different-server-submission'), { action: 'clear' });
  assert.deepEqual(retry.pendingSubmissionRecovery(envelope, null), { action: 'retry', envelope });
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'not_assigned' }, 'game-1'), true);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'unknown_code' }, 'game-1'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'wrong-game', code: 'not_assigned' }, 'game-1'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'not_assigned', submission_id: 'mixed' }, 'game-1'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(429, { error: 'rate_limited' }, 'game-1'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(404, { error: 'not_found' }, 'game-1'), false);
  assert.match(read('src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx'), /Retry This Same Entry/);
  assert.match(read('src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx'), /cannot safely preserve your entry for recovery/);
});

test('route callback propagates refreshed cookies and membership function is narrowly granted', () => {
  const callback = read('src/app/auth/callback/route.ts');
  const migration = read('database/migrations/0002_pilot_membership_authorization.sql');
  const envExample = read('.env.example');
  assert.match(callback, /createRouteClient/);
  assert.match(callback, /withCookies/);
  assert.match(callback, /source\.headers\.forEach/);
  assert.match(callback, /private, no-store/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /revoke all on function/);
  assert.match(migration, /create or replace function public\.get_tournament_role/);
  assert.match(migration, /grant execute on function public\.get_tournament_role\(uuid\) to authenticated/);
  assert.match(migration, /revoke all on function public\.get_tournament_role\(uuid\) from public, anon/);
  assert.match(migration, /from app\.tournament_roles/);
  assert.doesNotMatch(migration, /grant (select|insert|update|delete|all) on table/i);
  assert.match(envExample, /^NEXT_PUBLIC_SUPABASE_URL=\s*$/m);
  assert.match(envExample, /^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\s*$/m);
  assert.doesNotMatch(envExample, /service_role|secret|eyJ[a-zA-Z0-9_-]+\./i);
});

test('public flyer registration is a non-enumerating claim queue, not access or payment authority', () => {
  const migration = read('database/migrations/0013_public_registration_claims.sql');
  const immutableRepair = read('database/migrations/0016_public_registration_immutable.sql');
  const hardening = read('database/migrations/0017_public_registration_replay_and_rate_limits.sql');
  const fingerprintRepair = read('database/migrations/0018_public_registration_fingerprint_repair.sql');
  const route = read('src/app/api/v1/registration/[token]/route.ts');
  const form = read('src/app/register/[token]/registration-form.tsx');
  const publicContext = read('src/lib/api/public-registration.ts');
  assert.match(migration, /add column if not exists registration_status/);
  assert.match(migration, /create table app\.tournament_registration_links/);
  assert.match(migration, /token_hash text not null unique/);
  assert.match(migration, /create table app\.registration_claims/);
  assert.match(migration, /status in \('pending_review', 'needs_review', 'accepted', 'rejected', 'withdrawn'\)/);
  assert.match(migration, /needs_review/);
  assert.match(migration, /registration_status = 'open'/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /unique \(tournament_id, client_operation_id\)/);
  assert.match(migration, /request_fingerprint text not null/);
  assert.match(migration, /jsonb_build_array\('public_registration'/);
  assert.doesNotMatch(migration, /concat_ws\('\|', 'public_registration'/);
  assert.match(migration, /idempotency_conflict/);
  assert.match(migration, /max_claims_per_hour/);
  assert.match(migration, /registration_rate_limited/);
  assert.match(migration, /registration_claims_registration_link_id_idx/);
  assert.match(migration, /revoke all on table app\.registration_claims from anon, authenticated/);
  assert.match(migration, /registration_claims_immutable/);
  assert.match(immutableRepair, /drop trigger if exists registration_claims_immutable/);
  assert.match(hardening, /request_fingerprint/);
  assert.match(hardening, /idempotency_conflict/);
  assert.match(hardening, /registration_capacity_reached/);
  assert.match(hardening, /registration_rate_limited/);
  assert.match(hardening, /registration_claims_link_submitted_at_idx/);
  assert.match(hardening, /drop trigger if exists registration_claims_immutable/);
  assert.match(hardening, /pg_catalog\.pg_constraint/);
  assert.match(hardening, /jsonb_build_array\('public_registration'/);
  assert.doesNotMatch(hardening, /concat_ws\('\|', 'public_registration'/);
  assert.match(fingerprintRepair, /drop trigger if exists registration_claims_immutable/);
  assert.match(fingerprintRepair, /jsonb_build_array\('public_registration'/);
  assert.match(migration, /revoke all on function public\.submit_public_registration_claim/);
  assert.match(migration, /grant execute on function public\.submit_public_registration_claim[\s\S]* to anon, authenticated/);
  assert.doesNotMatch(migration, /insert into app\.(event_participants|tournament_roles|card_scorelines)/);
  assert.match(route, /tokenPattern/);
  assert.match(route + read('src/lib/api/route-boundary.ts'), /cache-control/);
  assert.match(route, /readPublicRegistrationContext/);
  assert.match(route, /withApiFailureBoundary/);
  assert.match(route, /registration_unavailable/);
  assert.match(route, /registration_retry_conflict/);
  assert.match(route, /registration_temporarily_unavailable/);
  assert.match(route, /isUuid\(body\.idempotencyKey\)/);
  assert.match(route, /submit_public_registration_claim/);
  assert.doesNotMatch(route, /getClaims|signInWithOtp|service_role|payment.*received/i);
  assert.match(form, /crypto\.randomUUID\(\)/);
  assert.match(form, /window\.sessionStorage/);
  assert.match(form, /temporarily busy/);
  assert.match(form, /This does not assign a seat or confirm payment/);
  assert.match(form, /planned payment method/i);
  assert.match(publicContext, /Object\.keys\(item\)\.length !== 1/);
});

test('public registration context projects only the permitted tournament name', async () => {
  const { readPublicRegistrationContext } = await import(pathToFileURL(path.join(root, 'src/lib/api/public-registration.ts')).href);
  assert.deepEqual(readPublicRegistrationContext({ tournamentName: '  Sample Open  ' }), { tournamentName: 'Sample Open' });
  assert.equal(readPublicRegistrationContext({ tournamentName: 'Sample Open', email: 'private@example.test' }), null);
  assert.equal(readPublicRegistrationContext({ tournamentName: '' }), null);
  assert.equal(readPublicRegistrationContext([]), null);
  assert.equal(readPublicRegistrationContext(null), null);
});
