// LOCAL disposable SQL only. Reuses funded-settlement-v5.sql's explicitly
// synthetic qualification/setup foundation, not evidence of played games.
// Every operation receipt here is created by an actual supported public RPC.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { quote } from './fixtures/q-review-foundation.mjs';
import { captureLegacyAwardRecovery, verifyLegacyAwardRecovery } from './legacy-award-recovery-sql-acceptance.mjs';

const actor = 'a1310000-0000-4000-8000-000000000001';
const tid = 'b1310000-0000-4000-8000-000000000001';
const eid = '11310000-0000-4000-8000-000000000001';
const qid = 'a2400000-0000-4000-8000-000000000001';
const id = n => `b6250000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const literal = value => `${quote(JSON.stringify(value))}::jsonb`;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const prefix = `set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claim.sub='${actor}';set request.jwt.claims='{"role":"service_role","sub":"${actor}"}';`;
const finalAttestations = { expenseLedgerReviewed: true, mrpClaimsReviewed: true, noAutomaticAccSubmission: true, officialSourceReviewed: true, payoutClaimsReviewed: true, noQPoolClaimsRecorded: true };

/** Deterministic, bounded adaptation of the existing funded fixture. Its old
 * placeholder receipt INSERT is removed entirely. An actual expense RPC receipt
 * supplies the foundation FK; its later original expense RPC is exact replay.
 * The real financial operations collect16x400=6400 and record4800 expenses,
 * leaving exactly1600 for the historical501/499/300/300 cent awards.
 */
export function buildV5LegacyCentSeed() {
  const source = fs.readFileSync('tests/funded-settlement-v5.sql', 'utf8');
  const boundary = /do \$\$declare\r?\n actor constant uuid:/;
  assert.equal(source.split(boundary).length, 2, 'Reviewed V5 lifecycle boundary changed');
  let seed = source.slice(0, source.search(boundary));
  assert.equal((seed.match(/\\ir \.\.\/database\/migrations\/0240_versioned_settlement_v5\.sql/g) ?? []).length, 1);
  seed = seed.replace(/\\ir \.\.\/database\/migrations\/0240_versioned_settlement_v5\.sql\r?\n/, '');
  seed = seed.replace(/do \$\$ begin if current_database\(\)<>'fixture_0240' then raise exception 'Disposable fixture_0240 database required';end if;end \$\$;/, '');
  const placeholder = /insert into app\.operation_receipts\([\s\S]+?\);/;
  const receipt = seed.match(placeholder)?.[0];
  assert.ok(receipt?.includes("'qualification_fixture'"), 'Reviewed placeholder receipt boundary changed');
  const at = seed.indexOf(receipt);
  const identitiesSql = seed.slice(0, at) + 'commit;';
  let historySql = seed.slice(at + receipt.length);
  assert.equal((historySql.match(/0,300,/g) ?? []).length, 3, 'Reviewed obligations/payment/replay amounts changed');
  historySql = historySql.replaceAll('0,300,', '0,400,').replaceAll('300-cent', '400-cent');
  assert.equal((historySql.match(/ledger->>'paymentTotalMinor'<>'4800'/g) ?? []).length, 1);
  historySql = historySql.replace("ledger->>'paymentTotalMinor'<>'4800'", "ledger->>'paymentTotalMinor'<>'6400'");
  // Only the source's assertion message changes; expense evidence remains4800.
  historySql = historySql.replace('conserve 4800 income and one 4800 expense', 'conserve 6400 income and one 4800 expense');
  assert.doesNotMatch(identitiesSql + historySql, /insert\s+into\s+app\.operation_receipts/i, 'Never manufacture an accepted operation receipt');
  assert.doesNotMatch(identitiesSql + historySql, /disable trigger|session_replication_role|delete from app\.operation_receipts/i);
  return { identitiesSql, historySql, sourceSha256: sha(source), adaptedSeedSha256: sha(identitiesSql + historySql) };
}

/** Execute after migrations through0259 and before0260 in a fresh fixture_* DB.
 * Caller owns its verified no-network/no-port/no-mount local PostgreSQL runner.
 */
export function prepareV5LegacyCentAcceptance(sql, { database } = {}) {
  assert.match(database, /^fixture_[a-z0-9_]+$/);
  assert.equal(sql('select current_database();').trim(), database);
  const exec = query => sql(prefix + query).trim();
  const read = query => JSON.parse(exec(query).split('\n').filter(Boolean).at(-1));
  assert.equal(exec("select to_regprocedure('app.assert_whole_five_award_array_v1(jsonb,text)') is null;"), 't');
  assert.equal(exec('select count(*) from app.tournaments;'), '0', 'Fresh empty application fixture required');
  const seed = buildV5LegacyCentSeed();
  exec(seed.identitiesSql);
  const expenseArgs = `'${tid}',4800,'USD','TEST ONLY fictional sanctioning assessment expense','c2600000-0000-4000-8000-000000000001'`;
  const expense = read(`set request.jwt.claim.role='authenticated';set request.jwt.claims='{"role":"authenticated","sub":"${actor}"}';set role authenticated;select public.record_tournament_expense(${expenseArgs});`);
  assert.equal(expense.status, 'expense_recorded');
  const foundationReceipt = exec(`select id from app.operation_receipts where actor_profile_id='${actor}' and client_operation_id='c2600000-0000-4000-8000-000000000001' and operation_type='record_tournament_expense' and outcome='accepted';`);
  assert.match(foundationReceipt, /^[a-f0-9-]{36}$/);
  const history = seed.historySql.replaceAll('c1310000-0000-4000-8000-000000000001', foundationReceipt);
  exec('begin;' + history + 'set constraints all immediate;commit;');
  assert.equal(exec(`select count(*) from app.operation_receipts where operation_type='qualification_fixture';`), '0');
  const financial = read(`select app.settlement_ledger_v5('${tid}');`);
  assert.equal(financial.paymentCount, 16);
  assert.equal(financial.paymentTotalMinor, 6400);
  assert.equal(financial.expenseCount, 1);
  assert.equal(financial.expenseTotalMinor, 4800);
  assert.equal(exec(`select count(*) from app.operation_receipts where tournament_id='${tid}' and operation_type in('set_roster_payment_obligation_v1','record_manual_roster_payment') and outcome='accepted';`), '32');
  const assignment = read(`select public.assign_cross_checker_v1('${actor}','${tid}','d2400000-0000-4000-8000-000000000016','${id(1)}');`);
  assert.equal(assignment.status, 'cross_checker_assigned');
  const closure = read(`select public.finalize_cross_checking_v1('${actor}','${tid}','${id(2)}');`);
  assert.equal(closure.status, 'cross_checking_finalized');
  const participant = n => `41310000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const series = [[1, 4], [2, 3], [1, 2]].map(([winner, loser], i) => ({ winnerId: participant(winner), loserId: participant(loser), evidenceNote: `TEST ONLY synthetic funded V5 series${i + 1}` }));
  const outcome = read(`select public.record_standard_singles_playoff_outcomes_v3('${actor}','${tid}','${eid}','${qid}',0,${literal(series)},'${id(3)}');`);
  assert.equal(outcome.status, 'playoff_outcomes_recorded');
  const source = { kind: 'playoff_outcome_v3', resultId: outcome.resultId, qualificationResultVersionId: qid };
  const amounts = [501, 499, 300, 300];
  const request = { source, expectedVersion: 0, prizeClaims: amounts.map((amountMinor, i) => ({ participantId: participant(i + 1), amountMinor, prizeOrder: i + 1, note: 'TEST ONLY immutable historical cent award; no disbursement' })), eventIncomeMinor: 6400, eventExpenseMinor: 4800, retainedBalanceMinor: 0, officialSourceReference: 'TEST ONLY historical funded V5 synthetic foundation', sanctioningExpenseEventId: expense.expenseEventId };
  assert.equal(request.eventIncomeMinor, request.eventExpenseMinor + amounts.reduce((sum, amount) => sum + amount, 0));
  const acceptedOperationId = id(4);
  const response = read(`select public.save_event_settlement_draft_v5('${actor}','${tid}','${eid}',${literal(request)},'${acceptedOperationId}');`);
  assert.equal(response.status, 'settlement_draft_saved_v5');
  const finalRequest = { draftId: response.draftId, draftVersion: 1, expectedVersion: 0, attestations: finalAttestations };
  const workspace = read(`select public.get_event_settlement_workspace_v5('${actor}','${tid}','${eid}');`);
  assert.deepEqual(workspace.blockers, []);
  // Prove denomination is the NEW blocker, rather than accidentally using an
  // unfunded, stale or unclosed fixture. The actual final and its actual receipt
  // are rolled back together; history is never rewritten or manually deleted.
  const rollbackFinal = read(`begin;select public.finalize_event_settlement_v2('${actor}','${tid}','${eid}',${literal(finalRequest)},'${id(5)}');rollback;`);
  assert.equal(rollbackFinal.status, 'settlement_finalized_v2');
  assert.equal(exec(`select count(*) from app.event_settlement_finals_v2 where event_id='${eid}';`), '0');
  assert.equal(exec(`select count(*) from app.operation_receipts where client_operation_id='${id(5)}';`), '0');
  const capture = captureLegacyAwardRecovery(query => exec(query), { version: 'v5', actorId: actor, tournamentId: tid, eventId: eid, acceptedOperationId, acceptedRequest: request, acceptedResponse: response }, { database });
  console.log('PASS genuine V5 cent draft:32 supported obligation/payment receipts, one replayed expense, exact6400=4800+1600 ledger, actual rollback-only final succeeds, no fabricated receipt');
  return { capture, finalRequest, sourceSha256: seed.sourceSha256, adaptedSeedSha256: seed.adaptedSeedSha256, financial, preGuardFinalStatus: rollbackFinal.status };
}

/** Execute after0260/0262. Actual exact-replay/durable-rejection authority is
 * shared with the previously exercised V6/V7 acceptance export.
 */
export function verifyV5LegacyCentAcceptance(sql, prepared) {
  const result = verifyLegacyAwardRecovery(sql, prepared.capture, { freshOperationId: id(6), finalOperationId: id(7), finalRequest: prepared.finalRequest });
  return { ...result, sourceFixture: 'tests/funded-settlement-v5.sql', sourceSha256: prepared.sourceSha256, adaptedSeedSha256: prepared.adaptedSeedSha256, financial: prepared.financial, preGuardFinalStatus: prepared.preGuardFinalStatus, limitation: 'Funded fixture setup/qualification/start are explicitly synthetic direct baseline. Finance, playoff source, accounting, receipts and replay/rejection use actual RPCs. No played-game, physical review or disbursement claim.' };
}
