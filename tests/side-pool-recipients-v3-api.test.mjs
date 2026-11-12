import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {
  isSidePoolRecipientMutationV3,
  isSidePoolRecipientReconciliationV3,
  isSidePoolRecipientResultV3,
  isSidePoolRecipientWorkspaceV3,
  sidePoolRecipientMethodV3,
  sidePoolRecipientResultMatchesV3,
} from '../src/lib/api/side-pool-recipients-v3.ts';

const id = n => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const digest = 'a'.repeat(64);
const policyMutation = { eventId: id(3), poolId: id(4), action: 'publish_policy', request: { amountPolicyId: id(5), method: sidePoolRecipientMethodV3, disclosureReference: 'TEST ONLY posted rules', disclosed: true } };
const reviewMutation = { eventId: id(3), poolId: id(4), action: 'review', request: { expectedVersion: 0, sourceDigest: digest, reason: 'TEST ONLY verified unpaid obligations', reviewed: true } };
const obligation = { participantId: id(6), displayName: 'TEST ONLY nonqualifier', poolRank: 1, qualified: false, amountMinor: 1000, status: 'unpaid' };
const workspace = {
  tournamentId: id(1), eventId: id(3), poolId: id(4), policyId: id(5), recipientPolicyId: id(7), feeMinor: 1000, ratio: 6,
  recipientPolicy: { id: id(7), method: sidePoolRecipientMethodV3, amountPolicyId: id(5), disclosureReference: 'TEST ONLY posted rules', publishedAt: '2026-10-30T00:00:00Z' },
  qualificationId: id(8), sourceDigest: digest, blockers: [], fundMinor: 1000, obligations: [obligation], moneyMoved: false, history: [],
};

test('v3 API contracts accept disclosed policy, nonqualifier recipient, unpaid review, and exact route bindings', () => {
  assert.equal(isSidePoolRecipientMutationV3(policyMutation), true);
  assert.equal(isSidePoolRecipientMutationV3(reviewMutation), true);
  assert.equal(isSidePoolRecipientWorkspaceV3(workspace, id(1), id(3), id(4)), true);
  const preElection = { ...workspace, recipientPolicyId: null, recipientPolicy: null, qualificationId: null, blockers: ['recipient_policy_required', 'unsupported_payout_domain'], fundMinor: null, obligations: [] };
  assert.equal(isSidePoolRecipientWorkspaceV3(preElection, id(1), id(3), id(4)), true);
  const highValuePool = { ...workspace, feeMinor: 100_000_000, fundMinor: 1_600_000_000, obligations: [
    { ...obligation, amountMinor: 800_000_000 },
    { ...obligation, participantId: id(61), displayName: 'TEST ONLY recipient two', poolRank: 2, amountMinor: 533_333_500 },
    { ...obligation, participantId: id(62), displayName: 'TEST ONLY recipient three', poolRank: 3, amountMinor: 266_666_500 },
  ] };
  assert.equal(isSidePoolRecipientWorkspaceV3(highValuePool, id(1), id(3), id(4)), true, '16 fully paid entries at the existing $1,000,000 fee ceiling remain within JavaScript safe-integer bounds');
  for (const invalid of [
    { ...highValuePool, obligations: highValuePool.obligations.slice(0, 2) },
    { ...highValuePool, obligations: highValuePool.obligations.map((item, i) => i ? item : { ...item, amountMinor: item.amountMinor + 500 }) },
    { ...highValuePool, obligations: highValuePool.obligations.map((item, i) => i ? item : { ...item, poolRank: 2 }) },
    { ...workspace, feeMinor: 0 },
    { ...workspace, feeMinor: 1050, fundMinor: 1050, obligations: [{ ...obligation, amountMinor: 1050 }] },
    { ...workspace, fundMinor: 1500 },
  ]) assert.equal(isSidePoolRecipientWorkspaceV3(invalid, id(1), id(3), id(4)), false);
  const currentHistory = { ...workspace, history: [{ id: id(41), version: 1, sourceDigest: digest, current: true, obligations: [obligation], status: 'unpaid', reason: 'TEST ONLY review', recordedAt: '2026-10-30T00:00:00Z' }] };
  assert.equal(isSidePoolRecipientWorkspaceV3(currentHistory, id(1), id(3), id(4)), true);
  assert.equal(isSidePoolRecipientWorkspaceV3({ ...currentHistory, history: [{ ...currentHistory.history[0], obligations: [{ ...obligation, amountMinor: 500 }] }] }, id(1), id(3), id(4)), false);
  assert.equal(isSidePoolRecipientWorkspaceV3({ ...workspace, history: [{ ...currentHistory.history[0], version: 2 }, currentHistory.history[0], { ...currentHistory.history[0], id: id(42), version: 0 }] }, id(1), id(3), id(4)), false);
  assert.equal(isSidePoolRecipientWorkspaceV3(workspace, id(1), id(9), id(4)), false);
  const frozen = { status: 'side_pool_recipient_policy_frozen', policyId: id(9), poolId: id(4), moneyMoved: false };
  const reviewed = { status: 'side_pool_recipients_reviewed_unpaid', reviewId: id(10), poolId: id(4), version: 1, sourceDigest: digest, obligations: [obligation], moneyMoved: false };
  assert.equal(isSidePoolRecipientResultV3(frozen), true);
  assert.equal(sidePoolRecipientResultMatchesV3(frozen, policyMutation), true);
  assert.equal(isSidePoolRecipientResultV3(reviewed), true);
  assert.equal(sidePoolRecipientResultMatchesV3(reviewed, reviewMutation), true);
  assert.equal(isSidePoolRecipientReconciliationV3({ authorized: true, result: reviewed }, reviewMutation), true);
  assert.equal(isSidePoolRecipientReconciliationV3({ authorized: true, result: null }, reviewMutation), true);
});

test('contracts reject playoff finish, recipient paid state, unknown blockers, and malformed result bindings', () => {
  assert.equal(isSidePoolRecipientMutationV3({ ...policyMutation, request: { ...policyMutation.request, finalPlayoffPlace: 1 } }), false);
  assert.equal(isSidePoolRecipientMutationV3({ ...reviewMutation, request: { ...reviewMutation.request, paidState: 'paid' } }), false);
  assert.equal(isSidePoolRecipientWorkspaceV3({ ...workspace, obligations: [{ ...obligation, paidState: 'paid' }] }, id(1), id(3), id(4)), false);
  assert.equal(isSidePoolRecipientWorkspaceV3({ ...workspace, blockers: ['new_unknown'] }, id(1), id(3), id(4)), true);
  assert.equal(isSidePoolRecipientWorkspaceV3({ ...workspace, recipientPolicy: { ...workspace.recipientPolicy, amountPolicyId: id(99) } }, id(1), id(3), id(4)), false);
  assert.equal(isSidePoolRecipientResultV3({ status: 'side_pool_recipient_policy_frozen', policyId: id(9), poolId: id(99), moneyMoved: false }), true);
  assert.equal(sidePoolRecipientResultMatchesV3({ status: 'side_pool_recipient_policy_frozen', policyId: id(9), poolId: id(99), moneyMoved: false }, policyMutation), false);
});

function loadRoute(name, result, { actor = 'actor', sameOrigin = true } = {}) {
  const routePath = `src/app/api/v1/tournaments/[id]/events/[eventId]/side-pools/[poolId]/recipients-v3/${name}`;
  const source = fs.readFileSync(routePath, 'utf8'), exports = {}, calls = [];
  const dependencies = {
    apiJson: (body, options = {}) => ({ body, status: options.status ?? 200 }),
    withApiFailureBoundary: fn => fn(), isSameOriginRequest: () => sameOrigin, isUuid: value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value),
    readLargeJson: async request => request.payload, requireVerifiedSubject: async () => actor, createClient: async () => ({}),
    createServerOnlyAdminClient: () => ({ rpc: async (rpcName, args) => { calls.push({ rpcName, args }); return result; } }),
    isSidePoolRecipientMutationV3, isSidePoolRecipientResultV3, isSidePoolRecipientWorkspaceV3,
    sidePoolRecipientResultMatchesV3, isSidePoolRecipientReconciliationV3,
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: () => dependencies });
  return { exports, calls };
}
const params = Promise.resolve({ id: id(1), eventId: id(3), poolId: id(4) });
const request = (payload, op = id(20)) => ({ payload, headers: { get: name => name === 'x-idempotency-key' ? op : null } });

test('scoped routes bind actor, tournament, event, pool, exact operation id, and route-specific RPC', async () => {
  const read = loadRoute('route.ts', { data: workspace, error: null });
  const get = await read.exports.GET({}, { params });
  assert.equal(get.status, 200); assert.deepEqual(JSON.parse(JSON.stringify(read.calls[0])), { rpcName: 'get_side_pool_recipient_workspace_v3', args: { p_actor_id: 'actor', p_tournament_id: id(1), p_event_id: id(3), p_pool_id: id(4) } });

  const publish = { status: 'side_pool_recipient_policy_frozen', policyId: id(9), poolId: id(4), moneyMoved: false };
  const write = loadRoute('route.ts', { data: publish, error: null });
  const posted = await write.exports.POST(request(policyMutation), { params });
  assert.equal(posted.status, 200);
  assert.equal(write.calls[0].rpcName, 'publish_side_pool_recipient_policy_v3');
  assert.equal(write.calls[0].args.p_operation_id, id(20));

  const badOrigin = loadRoute('route.ts', { data: publish, error: null }, { sameOrigin: false });
  const refused = await badOrigin.exports.POST(request(policyMutation), { params });
  assert.equal(refused.status, 403); assert.equal(badOrigin.calls.length, 0);
  const wrongPool = loadRoute('route.ts', { data: publish, error: null });
  const mismatched = await wrongPool.exports.POST(request({ ...policyMutation, poolId: id(30) }), { params });
  assert.equal(mismatched.status, 400); assert.equal(wrongPool.calls.length, 0);
});

test('review reconciliation binds the exact saved mutation and service RPC arguments', async () => {
  const saved = { status: 'side_pool_recipients_reviewed_unpaid', reviewId: id(10), poolId: id(4), version: 1, sourceDigest: digest, obligations: [obligation], moneyMoved: false };
  const route = loadRoute('reconciliation/route.ts', { data: { authorized: true, result: saved }, error: null });
  const response = await route.exports.POST(request({ operationId: id(21), mutation: reviewMutation }), { params });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(route.calls[0])), { rpcName: 'get_side_pool_recipient_reconciliation_v3', args: { p_actor_id: 'actor', p_tournament_id: id(1), p_event_id: id(3), p_pool_id: id(4), p_request: reviewMutation.request, p_operation_id: id(21) } });
  const unauthorized = loadRoute('route.ts', { data: workspace, error: null }, { actor: null });
  assert.equal((await unauthorized.exports.GET({}, { params })).status, 401); assert.equal(unauthorized.calls.length, 0);
});
