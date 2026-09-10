import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const collectRoutes = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = path.join(directory, entry.name);
  if (entry.isDirectory()) return collectRoutes(fullPath);
  return entry.name === 'route.ts' ? [fullPath] : [];
});

test('Supabase auth scaffolding fails closed and does not expose server secrets', () => {
  const env = read('src/lib/env.ts');
  const browser = read('src/lib/supabase/client.ts');
  const server = read('src/lib/supabase/server.ts');
  const privateAdmin = read('src/lib/supabase/private-admin.ts');
  assert.match(env, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(env, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(env, /throw new Error/);
  assert.doesNotMatch(browser + server, /SERVICE_ROLE|SECRET|SUPABASE_KEY\s*=/i);
  assert.match(browser, /createBrowserClient/);
  assert.match(server, /createServerClient/);
  assert.match(server, /cookies\(\)/);
  assert.match(browser, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(browser, /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(privateAdmin, /import "server-only"/);
  assert.match(privateAdmin, /SUPABASE_SECRET_KEY/);
  assert.match(privateAdmin, /startsWith\("sb_secret_"\)/);
  assert.match(privateAdmin, /persistSession: false/);
  assert.match(privateAdmin, /autoRefreshToken: false/);
  assert.doesNotMatch(browser + server, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(read('.env.example'), /SUPABASE_SECRET_KEY|sb_secret_/);
});

test('server-only Supabase configuration rejects absent or malformed credentials', async () => {
  const { getServerOnlySupabaseEnv } = await import(pathToFileURL(path.join(root, 'src/lib/supabase/private-admin.ts')).href);
  const publicEnv = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  };
  assert.throws(() => getServerOnlySupabaseEnv(publicEnv), /not configured/);
  assert.throws(() => getServerOnlySupabaseEnv({ ...publicEnv, SUPABASE_SECRET_KEY: '   ' }), /not configured/);
  assert.throws(() => getServerOnlySupabaseEnv({ ...publicEnv, SUPABASE_SECRET_KEY: 'legacy-or-public-key' }), /scoped secret API key/);
  assert.deepEqual(
    getServerOnlySupabaseEnv({ ...publicEnv, SUPABASE_SECRET_KEY: ' sb_secret_example ' }),
    { url: 'https://example.supabase.co', secretKey: 'sb_secret_example' },
  );
});

test('deployment runtime is pinned to the tested Node major', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.engines.node, '24.x');
});

test('site-wide browser hardening headers prevent framing, referrer leakage, and unused device access', () => {
  const config = read('next.config.ts');
  assert.match(config, /source: "\/:path\*"/);
  assert.match(config, /X-Content-Type-Options/, 'responses must prevent MIME sniffing');
  assert.match(config, /value: "nosniff"/);
  assert.match(config, /X-Frame-Options/, 'the app must not be frameable');
  assert.match(config, /value: "DENY"/);
  assert.match(config, /Referrer-Policy/, 'sensitive routes must not send referrers');
  assert.match(config, /value: "no-referrer"/);
  assert.match(config, /Permissions-Policy/);
  assert.match(config, /camera=\(\), geolocation=\(\), microphone=\(\), payment=\(\), usb=\(\)/);
  assert.match(config, /X-DNS-Prefetch-Control/);
  assert.match(config, /value: "off"/);
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
  assert.doesNotMatch(page, /signInWithPassword|signUp\s*\(|type="password"/);
  assert.match(page, /shouldCreateUser: true/);
  const bootstrap = read('database/migrations/0067_passwordless_profile_bootstrap.sql');
  assert.match(bootstrap, /after insert on auth\.users/);
  assert.match(bootstrap, /security definer set search_path = ''/);
  assert.match(bootstrap, /revoke all on function app\.create_profile_for_auth_user/);
  assert.doesNotMatch(bootstrap, /insert into app\.(tournament_roles|event_participants|tournament_roster_entries)/);
  assert.match(page, /requestedNext/);
  assert.match(page, /encodeURIComponent\(next\)/);
  assert.match(page, /auth\/callback/);
  assert.match(page, /type="email"/);
  assert.match(read('src/app/page.tsx'), /export default|TournamentDashboard/);
});

test('the synthetic review dashboard is unavailable from a production deployment', async () => {
  const { allowsReviewPrototype } = await import(pathToFileURL(path.join(root, 'src/lib/review-prototype-boundary.ts')).href);
  assert.equal(allowsReviewPrototype({ nodeEnv: 'production', vercelEnv: 'production' }), false);
  assert.equal(allowsReviewPrototype({ nodeEnv: 'production', vercelEnv: 'preview', host: 'cribbage-web-q81o14eoc-cribbage-app.vercel.app' }), true);
  assert.equal(allowsReviewPrototype({ nodeEnv: 'development', host: 'localhost:3000' }), true);
  assert.equal(allowsReviewPrototype({ nodeEnv: 'production', vercelEnv: 'preview', host: 'cribbage-web-app.vercel.app' }), false, 'promotion must not turn the default production hostname into a review surface');
  assert.equal(allowsReviewPrototype({ nodeEnv: 'production', vercelEnv: 'preview', host: 'tournament.example.org' }), false, 'an unlisted custom production hostname must fail closed');
  assert.equal(allowsReviewPrototype({ nodeEnv: 'production' }), false);
  const page = read('src/app/page.tsx');
  assert.match(page, /await headers\(\)/);
  assert.match(page, /requestHeaders\.get\("host"\)/);
  assert.match(page, /allowsReviewPrototype/);
  assert.match(page, /notFound\(\)/);
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

test('every API v1 route uses a private no-store response boundary', () => {
  const routes = collectRoutes(path.join(root, 'src/app/api/v1'));
  assert.ok(routes.length > 0);
  for (const route of routes) {
    const source = fs.readFileSync(route, 'utf8');
    assert.match(
      source,
      /apiJson|privateNoStore/,
      `${path.relative(root, route)} must use the private no-store response boundary`,
    );
  }
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
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'not_assigned' }, 'game-1', 'submission'), true);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'duplicate_submission' }, 'game-1', 'submission'), true);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'duplicate_submission' }, 'game-1', 'confirmation'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'confirmation_rejected' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'confirmation_rejected' }, 'game-1', 'confirmation'), true);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'wrong-game', code: 'duplicate_submission' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'duplicate_submission', internal_detail: 'mixed' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'unknown_code' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'wrong-game', code: 'not_assigned' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'not_assigned', submission_id: 'mixed' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(401, { error: 'unauthorized' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(429, { error: 'rate_limited' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(404, { error: 'not_found' }, 'game-1', 'submission'), false);
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

test('legacy public registration is retired before the fragment-only replacement exists', () => {
  const migration = read('database/migrations/0013_public_registration_claims.sql');
  const immutableRepair = read('database/migrations/0016_public_registration_immutable.sql');
  const hardening = read('database/migrations/0017_public_registration_replay_and_rate_limits.sql');
  const fingerprintRepair = read('database/migrations/0018_public_registration_fingerprint_repair.sql');
  const retirement = read('database/migrations/0070_retire_legacy_public_registration_surface.sql');
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
  assert.match(retirement, /legacy registration-link history is incoherent/);
  assert.match(retirement, /set enabled = false/);
  assert.match(retirement, /revoke all on function public\.get_public_registration_context/);
  assert.match(retirement, /revoke all on function public\.submit_public_registration_claim/);
  assert.match(retirement, /drop function public\.get_public_registration_context/);
  assert.match(retirement, /drop function public\.submit_public_registration_claim/);
  assert.doesNotMatch(migration, /insert into app\.(event_participants|tournament_roles|card_scorelines)/);
  for (const file of [
    'src/app/api/v1/registration/[token]/route.ts',
    'src/app/register/[token]/page.tsx',
    'src/app/register/[token]/registration-form.tsx',
    'src/lib/api/public-registration.ts',
  ]) assert.equal(fs.existsSync(path.join(root, file)), false, `${file} must not retain a path-token surface`);
});

test('v2 registration lifecycle stores only digest material and is service-role-only', () => {
  const lifecycle = read('database/migrations/0071_secure_registration_link_lifecycle_v2.sql');
  assert.match(lifecycle, /token_version smallint not null default 1/);
  assert.match(lifecycle, /token_salt bytea/);
  assert.match(lifecycle, /token_digest bytea/);
  assert.match(lifecycle, /octet_length\(token_salt\) = 32/);
  assert.match(lifecycle, /octet_length\(token_digest\) = 32/);
  assert.match(lifecycle, /create table app\.tournament_registration_link_heads/);
  assert.match(lifecycle, /create table app\.registration_link_lifecycle_events/);
  assert.match(lifecycle, /create table app\.registration_link_operation_conflicts/);
  assert.match(lifecycle, /coalesce\(auth\.role\(\), ''\) <> 'service_role'/);
  assert.match(lifecycle, /app\.fixed_32_byte_equal/);
  assert.match(lifecycle, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(lifecycle, /public\.issue_registration_link_v2/);
  assert.match(lifecycle, /public\.rotate_registration_link_v2/);
  assert.match(lifecycle, /public\.close_registration_link_v2/);
  assert.match(lifecycle, /public\.get_registration_link_redemption_material_v2/);
  assert.match(lifecycle, /public\.submit_registration_claim_v2/);
  assert.match(lifecycle, /revoke all on function public\.issue_registration_link_v2[\s\S]*from public, anon, authenticated/);
  assert.match(lifecycle, /grant execute on function public\.issue_registration_link_v2[\s\S]*to service_role/);
  assert.doesNotMatch(lifecycle, /p_token\s+text/i);
  assert.doesNotMatch(lifecycle, /grant execute[\s\S]*to anon, authenticated/);
});

test('director registration-link issuance is a strict same-origin server-only boundary', () => {
  const route = read('src/app/api/v1/tournaments/[id]/registration-links/route.ts');
  const contract = read('src/lib/api/registration-link.ts');
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(route, /issueRegistrationLink/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE/);
  assert.match(contract, /Object\.keys\(value\)\.length === keys\.length/);
  assert.match(contract, /maxClaims.*<= 2000/);
  assert.match(contract, /maxClaimsPerHour.*<= 1000/);
});

test('public registration remains release-gated and sends only a derived digest to Supabase', () => {
  const route = read('src/app/api/v1/registration/claims/route.ts');
  const contract = read('src/lib/api/public-registration-v2.ts');
  assert.match(contract, /ACC_PUBLIC_REGISTRATION_V2 === "enabled"/);
  assert.match(route, /if \(!publicRegistrationEnabled\(\)\)/);
  assert.match(route, /parseRegistrationLinkCredential/);
  assert.match(route, /digestRegistrationLinkCredential/);
  assert.match(route, /p_digest: bytea\(digest\)/);
  assert.doesNotMatch(route, /p_credential|canonicalToken.*rpc/);
});

test('registration page clears its fragment before hydration and uses no browser persistence', () => {
  const bootstrap = read('public/registration-bootstrap.js'); const page = read('src/app/register/page.tsx'); const form = read('src/app/register/registration-form.tsx'); const config = read('next.config.ts');
  assert.match(bootstrap, /history\.replaceState/); assert.match(page, /strategy="beforeInteractive"/); assert.match(form, /delete window\.__accRegistrationCredential/);
  assert.doesNotMatch(bootstrap + form, /localStorage|sessionStorage/); assert.match(config, /source: "\/register"/); assert.match(config, /Content-Security-Policy/);
});

test('protected hybrid guidance preserves the independent-entry verification boundary', () => {
  const guide = read('src/app/tournament/[tournamentId]/how-to/page.tsx');
  assert.match(guide, /One paper card and one digital card/);
  assert.match(guide, /Each assigned player independently enters the same paper result/);
  assert.match(guide, /confirms their own entry/);
  assert.match(guide, /entries disagree, leave it pending for cross-checking/);
  assert.match(guide, /both players independently submit matching results/);
  assert.match(guide, /requireTournamentAccess/);
});

test('protected Rulebook reference provides dated cached and online ACC sources without treating quick help as a rule decision', () => {
  const page = read('src/app/tournament/[tournamentId]/rulebook/page.tsx');
  const reference = read('src/app/tournament/[tournamentId]/rulebook/rulebook-reference.tsx');
  const workspace = read('src/app/tournament/[tournamentId]/page.tsx');
  const guide = read('src/app/tournament/[tournamentId]/how-to/page.tsx');
  assert.match(page, /requireTournamentAccess/);
  assert.match(page, /isUuid/);
  assert.match(page, /ACC Rulebook Cached/);
  assert.match(page, /ACC Rulebook Online/);
  assert.match(page, /acc-rulebook-2025\.pdf/);
  assert.match(page, /DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD/);
  assert.match(page, /rel="noreferrer"/);
  assert.match(reference, /Search a topic or rule word/);
  assert.match(reference, /does not replace the dated ACC Rulebook/);
  assert.match(workspace, /\/rulebook/);
  assert.match(guide, /Open ACC Rulebook/);
});
