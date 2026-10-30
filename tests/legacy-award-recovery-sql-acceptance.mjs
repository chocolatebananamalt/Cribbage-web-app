// LOCAL disposable SQL acceptance export. Importing this file opens no connection.
// Reuse the genuine legacy fixture already prepared by q-v2-foundation.mjs or
// seventeen-main-foundation.mjs plus its supported accounting RPCs. For v5 reuse
// funded-settlement-v5.sql's supported legacy source/request. Do not insert fake
// accepted receipts, alter immutable history, disable guards, or use hosted SQL.
//
// Sequence: apply through 0259; prepare a CURRENT cent draft with its real accepted
// operation/request; captureLegacyAwardRecovery(...); apply 0260 and 0262; then
// verifyLegacyAwardRecovery(...). Each sql(text) must be a separate, autocommitted
// local psql invocation returning unaligned text. The caller owns DB disposal.
// A finalized fixture cannot prove a fresh-final denomination rejection because
// already_finalized correctly wins. Use an accepted DRAFT with no existing final.
import assert from 'node:assert/strict';
import { quote } from './fixtures/q-review-foundation.mjs';

const versions = {
  v5: { drafts: 'event_settlement_drafts_v5', finals: 'event_settlement_finals_v2', save: 'save_event_settlement_draft_v5', final: 'finalize_event_settlement_v2', reconcile: 'get_event_settlement_reconciliation_v5', operation: action => action === 'draft' ? 'save_event_settlement_draft_v5' : 'finalize_event_settlement_v2' },
  v6: { drafts: 'q_accounting_drafts_v6', finals: 'q_accounting_finals_v6', save: 'save_q_accounting_draft_v6', final: 'finalize_q_accounting_v6', reconcile: 'reconcile_q_accounting_v6', operation: action => `q_accounting_v6_${action}` },
  v7: { drafts: 'no_q_accounting_drafts_v7', finals: 'no_q_accounting_finals_v7', save: 'save_no_q_accounting_draft_v7', final: 'finalize_no_q_accounting_v7', reconcile: 'reconcile_no_q_accounting_v7', operation: action => `no_q_accounting_v7_${action}` },
};
const uuid = value => assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const json = value => `${quote(JSON.stringify(value))}::jsonb`;
const read = (sql, query) => JSON.parse(sql(query).split('\n').filter(Boolean).at(-1));
const service = "set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';";

function context(sql, fixture, database) {
  assert.equal(typeof sql, 'function');
  assert.match(database, /^fixture_[a-z0-9_]+$/, 'An explicitly named disposable fixture database is required');
  assert.equal(sql('select current_database();'), database);
  assert.ok(versions[fixture.version], 'Supported legacy writer version required');
  for (const name of ['actorId', 'tournamentId', 'eventId', 'acceptedOperationId']) uuid(fixture[name]);
  return versions[fixture.version];
}

const scope = f => `${quote(f.actorId)}::uuid,${quote(f.tournamentId)}::uuid,${quote(f.eventId)}::uuid`;
function call(f, action, request, operation) {
  const name = action === 'draft' ? versions[f.version].save : versions[f.version].final;
  return `select public.${name}(${scope(f)},${json(request)},${quote(operation)}::uuid);`;
}
function reconcile(f, action, request, operation) {
  const config = versions[f.version];
  const tail = f.version === 'v5' ? '' : `,${json(request)},${quote(action)}`;
  return `select public.${config.reconcile}(${scope(f)},${quote(operation)}::uuid${tail});`;
}

// Include exact financial source rows, not just counts or a sum that could hide
// a compensating write. New rejection receipts/audits are checked separately.
function businessSnapshot(sql, f) {
  const config = versions[f.version];
  const tables = [config.drafts, config.finals, 'standard_singles_settlement_drafts', 'standard_singles_settlement_final_versions', 'prize_accounting_drafts_v8', 'prize_accounting_finals_v8', 'q_obligation_reviews_v1', 'q_obligation_reviews_v2', 'roster_payment_events', 'tournament_expense_events', 'q_pool_membership_versions_v1', 'q_pool_allocation_versions_v1'];
  return read(sql, `select jsonb_build_object(${tables.map(table => `${quote(table)},(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from app.${table} r where tournament_id=${quote(f.tournamentId)}::uuid)`).join(',')});`);
}
function receiptSnapshot(sql, f, operation) {
  return read(sql, `select jsonb_build_object('receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from app.operation_receipts r where actor_profile_id=${quote(f.actorId)}::uuid and client_operation_id=${quote(operation)}::uuid),'audits',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from app.audit_events a join app.operation_receipts r on r.id=a.operation_receipt_id where r.actor_profile_id=${quote(f.actorId)}::uuid and r.client_operation_id=${quote(operation)}::uuid));`);
}
function expectedHash(sql, f, action, request) {
  const items = f.version === 'v5'
    ? [quote(versions.v5.operation(action)), scope(f), json(request)]
    : [quote(f.version === 'v6' ? 'q_accounting_v6' : 'no_q_accounting_v7'), quote(action), scope(f), json(request)];
  return sql(`select encode(extensions.digest(convert_to(jsonb_build_array(${items.join(',')})::text,'utf8'),'sha256'),'hex');`);
}

/** Capture BEFORE 0260. Uses already accepted supported synthetic draft RPC
 * output; it deliberately cannot create historical rows after guards exist.
 * fixture: version, actorId, tournamentId, eventId, acceptedOperationId,
 * acceptedRequest, acceptedResponse. database is the caller's exact fixture_* DB.
 */
export function captureLegacyAwardRecovery(sql, fixture, { database } = {}) {
  const config = context(sql, fixture, database);
  assert.equal(sql("select to_regprocedure('app.assert_whole_five_award_array_v1(jsonb,text)') is null;"), 't', 'Capture genuine legacy history before 0260');
  const accepted = receiptSnapshot(sql, fixture, fixture.acceptedOperationId);
  assert.equal(accepted.receipts.length, 1);
  const receipt = accepted.receipts[0];
  assert.equal(receipt.outcome, 'accepted');
  assert.equal(receipt.tournament_id, fixture.tournamentId);
  assert.equal(receipt.target_id, fixture.eventId);
  assert.equal(receipt.operation_type, config.operation('draft'));
  assert.equal(receipt.request_hash, expectedHash(sql, fixture, 'draft', fixture.acceptedRequest));
  assert.deepEqual(receipt.response_payload, fixture.acceptedResponse);
  assert.equal(accepted.audits.length, 1);
  const business = businessSnapshot(sql, fixture);
  const drafts = business[config.drafts].filter(d => d.event_id === fixture.eventId);
  const draft = drafts.find(d => d.operation_receipt_id === receipt.id);
  assert.ok(draft, 'Accepted draft row must belong to the captured receipt');
  assert.deepEqual(draft.request_payload, fixture.acceptedRequest);
  assert.equal(draft.version, Math.max(...drafts.map(d => d.version)), 'Legacy draft must be current');
  assert.equal(business[config.finals].filter(f => f.event_id === fixture.eventId).length, 0);
  const awards = fixture.version === 'v5' ? draft.request_payload.prizeClaims.map(a => a.amountMinor) : draft.source_manifest.regularSchedule.awards.map(a => a.totalAwardMinor);
  const q = fixture.version === 'v6' ? business.q_obligation_reviews_v2.find(q => q.id === draft.q_review_id) : null;
  if (q) awards.push(...q.obligations.filter(o => o.kind === 'award').flatMap(o => o.rows.map(r => r.amountMinor)));
  assert.ok(awards.every(Number.isSafeInteger) && awards.some(a => a % 100 !== 0), 'Actual immutable awards must contain legacy cents');
  assert.deepEqual(read(sql, service + call(fixture, 'draft', fixture.acceptedRequest, fixture.acceptedOperationId)), fixture.acceptedResponse);
  assert.deepEqual(read(sql, service + reconcile(fixture, 'draft', fixture.acceptedRequest, fixture.acceptedOperationId)), { authorized: true, result: fixture.acceptedResponse });
  assert.deepEqual(receiptSnapshot(sql, fixture, fixture.acceptedOperationId), accepted);
  assert.deepEqual(businessSnapshot(sql, fixture), business);
  return { database, fixture: structuredClone(fixture), draftId: draft.id, draftVersion: draft.version, accepted, business };
}

/** Run AFTER 0260/0262. Fresh operation IDs are required for the draft and final.
 * Defaults build the valid next draft and final request from captured history.
 * Each rejection is committed by the adapter before a separate receipt read.
 */
export function verifyLegacyAwardRecovery(sql, capture, { freshOperationId, finalOperationId, freshRequest, finalRequest } = {}) {
  const { fixture: f, database } = capture;
  const config = context(sql, f, database);
  uuid(freshOperationId); uuid(finalOperationId);
  assert.equal(new Set([f.acceptedOperationId, freshOperationId, finalOperationId]).size, 3);
  assert.equal(sql(`select count(*) from pg_trigger where tgrelid='app.${config.finals}'::regclass and tgname='aa_whole_five_new_awards_v1' and tgenabled='O';`), '1');
  for (const operation of [freshOperationId, finalOperationId]) assert.deepEqual(receiptSnapshot(sql, f, operation), { receipts: [], audits: [] }, 'Fresh key required');
  assert.deepEqual(businessSnapshot(sql, f), capture.business, 'Migration changed legacy business history');
  assert.deepEqual(receiptSnapshot(sql, f, f.acceptedOperationId), capture.accepted, 'Migration changed accepted receipt/audit');
  const replay = () => read(sql, service + call(f, 'draft', f.acceptedRequest, f.acceptedOperationId));
  assert.deepEqual(replay(), f.acceptedResponse);
  assert.deepEqual(read(sql, service + reconcile(f, 'draft', f.acceptedRequest, f.acceptedOperationId)), { authorized: true, result: f.acceptedResponse });
  freshRequest ??= { ...structuredClone(f.acceptedRequest), expectedVersion: capture.draftVersion, ...(f.version === 'v5' ? { officialSourceReference: 'TEST ONLY fresh legacy cent draft after whole-five migration' } : { reason: 'TEST ONLY fresh legacy cent draft after whole-five migration' }) };
  finalRequest ??= f.version === 'v5'
    ? { draftId: capture.draftId, draftVersion: capture.draftVersion, expectedVersion: 0, attestations: { expenseLedgerReviewed: true, mrpClaimsReviewed: true, noAutomaticAccSubmission: true, officialSourceReviewed: true, payoutClaimsReviewed: true, noQPoolClaimsRecorded: true } }
    : { draftId: capture.draftId, draftVersion: capture.draftVersion, expectedVersion: 0, reason: 'TEST ONLY legacy cent final remains unpaid and must reject', reviewed: true };
  const evidence = [];
  for (const [action, request, operation] of [['draft', freshRequest, freshOperationId], ['final', finalRequest, finalOperationId]]) {
    const result = read(sql, service + call(f, action, request, operation));
    assert.deepEqual(result, { status: 'rejected', eventId: f.eventId, code: 'whole_five_awards_required' }, `${f.version} ${action}: controlled denomination rejection`);
    const persisted = receiptSnapshot(sql, f, operation);
    assert.equal(persisted.receipts.length, 1, `${action}: one durable receipt`);
    const receipt = persisted.receipts[0];
    assert.equal(receipt.outcome, 'rejected');
    assert.equal(receipt.tournament_id, f.tournamentId);
    assert.equal(receipt.target_id, f.eventId);
    assert.equal(receipt.operation_type, config.operation(action));
    assert.equal(receipt.request_hash, expectedHash(sql, f, action, request));
    assert.deepEqual(receipt.response_payload, result);
    assert.equal(persisted.audits.length, 1, `${action}: one rejection audit`);
    assert.deepEqual(persisted.audits[0].after_state, result);
    assert.deepEqual(read(sql, service + call(f, action, request, operation)), result, `${action}: retained retry`);
    assert.deepEqual(read(sql, service + reconcile(f, action, request, operation)), { authorized: true, result }, `${action}: exact reconciliation`);
    // v5's reader is historically operation-only. Its actual writer still binds
    // the whole request. v6/v7 also reject mismatched reconciliation requests.
    const changed = { ...request, expectedVersion: 99 };
    assert.equal(read(sql, service + call(f, action, changed, operation)).code, 'idempotency_conflict');
    if (f.version !== 'v5') assert.equal(read(sql, service + reconcile(f, action, changed, operation)).result.code, 'idempotency_conflict');
    assert.deepEqual(receiptSnapshot(sql, f, operation), persisted, `${action}: retry cannot duplicate or rewrite receipt/audit`);
    evidence.push({ action, operationId: operation, request, result, receiptId: receipt.id, requestHash: receipt.request_hash });
  }
  assert.deepEqual(replay(), f.acceptedResponse, 'Rejected new requests changed legacy replay');
  assert.deepEqual(receiptSnapshot(sql, f, f.acceptedOperationId), capture.accepted, 'Accepted receipt/hash/audit changed');
  assert.deepEqual(businessSnapshot(sql, f), capture.business, 'Rejection changed immutable business/funding rows');
  console.log(`PASS legacy-award recovery ${f.version}: accepted cent replay unchanged; draft/final durable rejection and reconciliation; exact history/funding preserved`);
  return { version: f.version, groups: 5, database, draftId: capture.draftId, evidence, limitation: 'Requires execution against a caller-owned disposable database. This is SQL acceptance; HTTP/browser recovery remains a separate gate.' };
}
