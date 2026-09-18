import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function routeHandlerFiles(directory = 'src/app', found = []) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) routeHandlerFiles(relative, found);
    else if (entry.name === 'route.ts') found.push(relative);
  }
  return found;
}

test('the side-pool workspace refuses an anonymous caller with 401 before any authorization work', () => {
  const source = read('src/app/api/v1/tournaments/[id]/side-pools/route.ts');
  const get = source.slice(source.indexOf('export async function GET'), source.indexOf('export async function POST'));

  const unauthenticated = get.indexOf('"unauthorized"');
  const role = get.indexOf('get_tournament_role');
  const forbidden = get.indexOf('"forbidden"');
  const workspace = get.indexOf('get_event_side_pool_workspace_v1');

  assert.ok(unauthenticated > 0, 'the handler returns an explicit unauthorized result');
  assert.ok(role > unauthenticated, 'the role lookup follows the identity check');
  assert.ok(forbidden > role, 'the forbidden result follows the role lookup');
  assert.ok(workspace > forbidden, 'the workspace RPC runs only after identity and role both pass');
  assert.match(get, /status:\s*401/);
  assert.match(get, /status:\s*403/);
  assert.match(get, /\["director","co_director"\]|\['director',\s*'co_director'\]/);
});

test('no API route handler uses the page-only redirect/notFound access helper', () => {
  // requireTournamentAccess calls redirect() and notFound(), which signal by
  // throwing. Inside an API failure boundary that throw reads as an unhandled
  // fault and the caller receives 503 instead of the intended 401/404.
  const offenders = routeHandlerFiles().filter((file) => read(file).includes('requireTournamentAccess'));
  assert.deepEqual(offenders, [], `API routes must not call requireTournamentAccess: ${offenders.join(', ')}`);
});

// route-boundary.ts imports next/server and next/navigation, neither of which
// plain Node resolves, so this module is verified by reading it. That is the
// same approach the rest of the suite takes for it.
test('the API failure boundary re-throws framework control flow before returning 503', () => {
  const boundary = read('src/lib/api/route-boundary.ts');
  const guard = boundary.indexOf('unstable_rethrow(error)');
  const fallback = boundary.indexOf('operation_unavailable');
  assert.ok(guard > 0, 'the boundary passes the caught value to the re-throw guard');
  assert.ok(fallback > guard, 'control flow is re-thrown before the 503 fallback is returned');
  assert.match(boundary, /catch \(error\)/, 'the boundary inspects the caught value rather than discarding it');
  assert.match(boundary, /import \{ unstable_rethrow \} from "next\/navigation"/);
});
