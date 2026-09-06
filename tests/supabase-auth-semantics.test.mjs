import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
  const proxy = read('src/proxy.ts') + read('src/lib/supabase/proxy.ts');
  const dal = read('src/lib/auth/require-tournament-access.ts');
  const page = read('src/app/tournament/[tournamentId]/page.tsx');
  assert.match(proxy, /getClaims/);
  assert.match(proxy, /response\.cookies\.set/);
  assert.match(proxy, /refreshedHeaders/);
  assert.match(proxy, /setAll\(cookiesToSet, headersToSet\)/);
  assert.match(proxy, /cache-control/);
  assert.match(proxy, /private, no-store/);
  assert.doesNotMatch(proxy, /x-supabase-session-refresh/);
  assert.match(proxy, /matcher/);
  assert.match(dal, /getUser/);
  assert.match(dal, /\.rpc\("get_tournament_role"/);
  assert.match(dal, /notFound/);
  assert.match(page, /requireTournamentAccess/);
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
