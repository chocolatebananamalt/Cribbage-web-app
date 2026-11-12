import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { simulationFinanceDispatch } from '../src/lib/api/simulation-finance-dispatch.ts';
import { isSyntheticPaperDeployment, syntheticPaperProjectRef } from '../src/lib/api/synthetic-paper-evidence.ts';

const source = readFileSync(new URL('../src/lib/api/require-legacy-finance-mode.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const actor = '10000000-0000-4000-8000-000000000001';
const tournament = '20000000-0000-4000-8000-000000000001';
const preview = { VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: `https://${syntheticPaperProjectRef}.supabase.co` };
const simulation = { status: 'available', evidenceKind: 'simulation', moneyMoved: false, accountingAvailable: false, sources: [] };

function harness({ env = preview, data = { status: 'not_enabled' }, error = null, throws = false, clientThrows = false } = {}) {
  const calls = [];
  const exports = {};
  runInNewContext(compiled, {
    exports, process: { env },
    require(name) {
      if (name === 'server-only') return {};
      if (name === 'next/navigation') return {
        notFound() { calls.push(['blocked']); throw new Error('NEXT_NOT_FOUND'); },
        redirect(target) { calls.push(['redirect', target]); throw new Error('NEXT_REDIRECT'); },
      };
      if (name.endsWith('private-admin.ts')) return { createServerOnlyAdminClient() {
        calls.push(['admin']);
        if (clientThrows) throw new Error('missing server credentials');
        return { async rpc(name, args) {
          calls.push(['rpc', name, args.actor, args.tid]);
          if (throws) throw new Error('network unavailable');
          return { data, error };
        } };
      } };
      if (name.endsWith('synthetic-paper-evidence.ts')) return { isSyntheticPaperDeployment };
      if (name.endsWith('simulation-finance-dispatch.ts')) return { simulationFinanceDispatch };
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  return { guard: exports.requireLegacyFinanceMode, calls };
}

test('legacy finance bypasses the classifier RPC outside the exact synthetic deployment', async () => {
  for (const env of [{}, { ...preview, VERCEL_ENV: 'production' }, { ...preview, NEXT_PUBLIC_SUPABASE_URL: 'https://another-project.supabase.co' }]) {
    const { guard, calls } = harness({ env, throws: true });
    await guard(actor, tournament);
    assert.deepEqual(calls, []);
  }
});

test('verified non-enrollment continues; classifier receives the authorized actor and tournament', async () => {
  const { guard, calls } = harness();
  await guard(actor, tournament);
  assert.deepEqual(calls, [['admin'], ['rpc', 'get_multi_event_finance_workspace_v1', actor, tournament]]);
});

test('simulation redirects to its tournament payments workspace and preserves Next control flow', async () => {
  for (const env of [preview, { ...preview, VERCEL_ENV: undefined, NODE_ENV: 'test' }]) {
    const { guard, calls } = harness({ env, data: simulation });
    await assert.rejects(guard(actor, tournament), /NEXT_REDIRECT/);
    assert.deepEqual(calls.at(-1), ['redirect', `/tournament/${tournament}/payments`]);
    assert.equal(calls.some(call => call[0] === 'blocked'), false);
  }
});

test('errors, unavailable credentials, unknown and conflicting modes never continue into legacy finance', async () => {
  for (const config of [
    { throws: true }, { clientThrows: true }, { error: { code: 'PGRST202' } },
    { data: simulation, error: { code: '42501' } }, { data: null }, { data: {} },
    { data: { status: 'not_enabled', sources: [] } }, { data: { status: 'blocked' } },
    { data: { ...simulation, moneyMoved: true } }, { data: { ...simulation, evidenceKind: 'real' } },
  ]) {
    const { guard, calls } = harness(config);
    await assert.rejects(guard(actor, tournament), /NEXT_NOT_FOUND/);
    assert.deepEqual(calls.at(-1), ['blocked']);
    assert.equal(calls.some(call => call[0] === 'redirect'), false);
  }
});

const pages = [
  'q-pool-policy', 'q-pools', 'q-operating-schedules', 'q-obligation-reviews', 'q-obligation-reviews-v2',
  'side-pools', 'side-pools/recipients/[eventId]/[poolId]', 'prize-schedules',
  'events/[eventId]/q-accounting-v6', 'events/[eventId]/no-q-accounting-v7',
  'events/[eventId]/prize-accounting-v8', 'events/[eventId]/prize-accounting-v9',
  'events/[eventId]/settlement', 'events/[eventId]/settlement-v5',
];
test('all bounded legacy pages authorize before dispatch and dispatch before every legacy loader', () => {
  assert.match(source, /import "server-only"/);
  for (const page of pages) {
    const text = readFileSync(new URL(`../src/app/tournament/[tournamentId]/${page}/page.tsx`, import.meta.url), 'utf8');
    const compact = text.replace(/\s+/g, '');
    const access = compact.indexOf('constaccess=awaitrequireTournamentAccess(tournamentId);');
    const guard = compact.indexOf('awaitrequireLegacyFinanceMode(access.user.id,tournamentId);');
    assert.ok(access >= 0 && guard > access, `${page}: verified actor before guard`);
    if (page !== 'prize-schedules') {
      const roleCheck = compact.slice(access, guard);
      assert.match(roleCheck, /if\(.*access.role.*\)notFound\(\);/, `${page}: existing role rejection precedes guard`);
    } else {
      assert.match(compact, /if\(\["director","co_director"\]\.includes\(access.role\)\)awaitrequireLegacyFinanceMode/, 'member-readable prize summary must not call an official-only RPC');
    }
    for (const token of ['awaitgetSyntheticEventContext(', 'createServerOnlyAdminClient()', 'awaitlistPrizeSchedules(', 'awaitgetSettlementWorkspace(', 'awaitgetSettlementV5Workspace(']) {
      const index = compact.indexOf(token);
      if (index >= 0) assert.ok(index > guard, `${page}: ${token} must follow guard`);
    }
    assert.equal(compact.match(/awaitrequireLegacyFinanceMode\(/g)?.length, 1, page);
  }
});

test('prize summary preserves ordinary member reads and dispatches only authorized officials before loading', async () => {
  const file = new URL('../src/app/tournament/[tournamentId]/prize-schedules/page.tsx', import.meta.url);
  const pageCode = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  for (const role of ['player', 'viewer', 'cross_checker', 'judge', 'director', 'co_director']) {
    for (const simulation of [false, true]) {
      const calls = [], exports = {};
      runInNewContext(pageCode, { exports, require(name) {
        if (name === 'react/jsx-runtime') return { jsx: () => ({ rendered: true }) };
        if (name === 'next/navigation') return { notFound() { throw new Error('NOT_FOUND'); } };
        if (name.endsWith('require-tournament-access')) return { async requireTournamentAccess() { calls.push('access'); return { role, user: { id: actor } }; } };
        if (name.endsWith('require-legacy-finance-mode')) return { async requireLegacyFinanceMode(id, tid) { assert.equal(id, actor); assert.equal(tid, tournament); calls.push('guard'); if (simulation) throw new Error('NEXT_REDIRECT'); } };
        if (name.endsWith('validation')) return { isUuid: () => true };
        if (name.endsWith('private-admin')) return { createServerOnlyAdminClient() { calls.push('admin'); return {}; } };
        if (name.endsWith('prize-schedule')) return {
          async listPrizeSchedules() { calls.push('schedules'); return []; },
          async listPrizeAwardSummaries() { calls.push('awards'); return []; },
        };
        if (name === './prize-schedule-summary') return { default: () => null };
        throw new Error(`Unexpected page dependency ${name}`);
      } });
      const official = ['director', 'co_director'].includes(role);
      const render = exports.default({ params: Promise.resolve({ tournamentId: tournament }) });
      if (official && simulation) {
        await assert.rejects(render, /NEXT_REDIRECT/);
        assert.deepEqual(calls, ['access', 'guard']);
      } else {
        await render;
        assert.deepEqual(calls, official ? ['access', 'guard', 'admin', 'schedules', 'awards'] : ['access', 'admin', 'schedules', 'awards']);
      }
    }
  }
});
