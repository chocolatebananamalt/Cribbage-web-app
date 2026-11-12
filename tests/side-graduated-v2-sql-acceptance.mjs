// LOCAL ONLY; importing this export opens no connection or Docker process.
// Caller owns isolation, migrations and disposal. Use two DISTINCT fictional
// makeSeventeenMainFixture() foundations through publishSql, before startSql.
// prepareSideGraduatedV2Acceptance BEFORE 0261 captures real old fixed history;
// verifySideGraduatedV2Acceptance AFTER 0261 exercises the actual public RPCs.
// sql(text) must autocommit each invocation and return psql -qAt text.
// startSession(text) must create an independent LOCAL session and return
// {done:Promise<string>,out:()=>string}; both outputs must stream before exit.
// Race proof needs three sessions plus the observer; no hosted adapter allowed.
import assert from 'node:assert/strict';
import { quote } from './fixtures/q-review-foundation.mjs';
import { calculateGraduatedPoolAmountsV2 } from '../src/lib/results/graduated-pool-amounts-v2.ts';

const method = 'graduated-acc-weighted-largest-remainder-5usd-v2';
const uuid = value => assert.match(value, /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
const json = value => `${quote(JSON.stringify(value))}::jsonb`;
const last = text => text.split('\n').filter(Boolean).at(-1);
const service = actor => `set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claim.sub=${quote(actor)};set request.jwt.claims=${quote(JSON.stringify({ role: 'service_role', sub: actor }))};`;
const scopedId = (f, n) => `${f.eid.slice(0, 8)}-6261-4000-8000-${String(n).padStart(12, '0')}`;
function adapter(sql, f, database) {
  assert.equal(typeof sql, 'function');
  assert.match(database, /^fixture_[a-z0-9_]+$/, 'Exact disposable fixture_* database required');
  assert.equal(sql('select current_database();').trim(), database);
  for (const key of ['actor', 'tid', 'eid', 'coDirectorId', 'outsiderId']) uuid(f[key]);
  assert.notEqual(f.actor, f.coDirectorId, 'Race must use different officials');
  const exec = (query, actor = f.actor) => sql(service(actor) + query).trim();
  const read = (query, actor) => JSON.parse(last(exec(query, actor)) ?? 'null');
  assert.equal(exec(`select count(*) from app.tournament_roles where tournament_id='${f.tid}' and ((profile_id='${f.actor}' and role='director') or (profile_id='${f.coDirectorId}' and role='co_director'));`), '2');
  return { exec, read };
}
function rows(read, table, where) {
  return read(`select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from app.${table} r where ${where};`);
}
function noDisbursement(read, f) {
  return Object.fromEntries(['event_side_pool_payout_versions', 'event_side_pool_team_payout_versions', 'event_side_pool_reconciliations', 'event_side_pool_payout_reviews', 'event_side_pool_payout_review_versions', 'roster_payment_events', 'tournament_expense_events'].map(table => [table, rows(read, table, `tournament_id='${f.tid}'`)]));
}
function legacyHistory(read, f, pools) {
  const ids = pools.map(quote).join(',');
  const tables = ['event_side_pool_definition_versions', 'event_side_pool_policy_versions', 'event_side_pool_election_versions'];
  const history = Object.fromEntries(tables.map(table => [table, rows(read, table, `pool_id in (${ids})`)]));
  const receipts = [...new Set(Object.values(history).flat().map(r => r.operation_receipt_id))];
  const receiptIds = receipts.map(quote).join(',');
  history.receipts = rows(read, 'operation_receipts', `id in (${receiptIds})`);
  history.audits = rows(read, 'audit_events', `operation_receipt_id in (${receiptIds})`);
  return history;
}

/** Caller has applied through 0260 (or 0259), and run an existing fictional
 * seventeen-player fixture's setup/finance/attendance/publication phases.
 * No play, score, qualification or historical accepted record is fabricated.
 * Invoke twice on distinct tournaments before applying 0261.
 */
export function prepareSideGraduatedV2Acceptance({ sql, fixture, database, coDirectorId = fixture.actor.slice(0, -12) + '000000000006', outsiderId = fixture.uid(1) }) {
  const f = { actor: fixture.actor, tid: fixture.tid, eid: fixture.eid, coDirectorId, outsiderId };
  const { exec, read } = adapter(sql, f, database);
  assert.equal(exec("select to_regclass('app.side_pool_graduated_policies_v2') is null;"), 't', 'Capture legacy history before 0261');
  assert.ok(!['in_progress', 'completed', 'finalized'].includes(read(`select to_jsonb(app.event_play_state_v1('${f.eid}'));`)));
  const participants = read(`select jsonb_agg(id order by id) from app.event_participants where tournament_id='${f.tid}' and event_id='${f.eid}' and status in ('registered','checked_in');`);
  assert.equal(participants.length, 17);
  const publication = read(`select to_jsonb(p) from app.event_schedule_publications p where tournament_id='${f.tid}' and event_id='${f.eid}' order by published_at desc limit 1;`);
  assert.ok(publication && publication.participant_count === 17 && publication.game_count === 12, 'Existing supported start-ready publication required');
  const pools = { graduated: scopedId(f, 1), fixed: scopedId(f, 2), collected: scopedId(f, 3) };
  for (const [i, [name, pool]] of Object.entries(pools).entries()) {
    const result = read(`select public.add_event_side_pool_v1('${f.actor}','${f.tid}','${f.eid}','${pool}','TEST ${name}','TEST ONLY ${name} Side Pool',1000,'${scopedId(f, 10 + i)}');`);
    assert.equal(result.status, 'side_pool_added');
  }
  const fixedRequest = [{ placement: 1, amountMinor: 1000 }];
  const fixed = read(`select public.configure_event_side_pool_policy_v1('${f.actor}','${f.tid}','${f.eid}','${pools.fixed}',6,${json(fixedRequest)},'TEST ONLY historical fixed policy; no actual payout','${scopedId(f, 20)}');`);
  assert.equal(fixed.status, 'side_pool_policy_configured');
  const collected = read(`select public.set_event_side_pool_election_v1('${f.actor}','${f.tid}','${f.eid}','${pools.collected}','${participants[0]}','${scopedId(f, 21)}',true,1000,'cash','TEST ONLY fictional collection','TEST ONLY collected before formula disclosure','${scopedId(f, 22)}');`);
  assert.equal(collected.status, 'side_pool_election_recorded');
  const result = { database, fixture: f, participants, publication, pools, fixedRequest };
  result.legacy = legacyHistory(read, f, [pools.fixed, pools.collected]);
  result.noDisbursement = noDisbursement(read, f);
  for (const table of ['event_side_pool_payout_versions', 'event_side_pool_team_payout_versions', 'event_side_pool_reconciliations']) assert.deepEqual(result.noDisbursement[table], []);
  return result;
}

function rpc(f, pool, action, request, operation, actor = f.actor, tournament = f.tid, event = f.eid) {
  const names = { policy: 'save_side_pool_graduated_policy_v2', election: 'save_side_pool_graduated_election_v2', review: 'record_side_pool_amount_review_v2' };
  return `select public.${names[action]}('${actor}','${tournament}','${event}','${pool}',${json(request)},'${operation}');`;
}
function reconciliation(f, pool, action, request, operation, actor = f.actor) {
  return `select public.get_side_pool_graduated_reconciliation_v2('${actor}','${f.tid}','${f.eid}','${pool}',${json(request)},'${operation}','${action}');`;
}
function proveReceipt(read, f, pool, action, request, operation, response, actor = f.actor) {
  const receipt = rows(read, 'operation_receipts', `actor_profile_id='${actor}' and client_operation_id='${operation}'`);
  assert.equal(receipt.length, 1);
  assert.equal(receipt[0].operation_type, `side_pool_graduated_v2_${action}`);
  assert.equal(receipt[0].tournament_id, f.tid);
  assert.equal(receipt[0].target_id, pool);
  assert.equal(receipt[0].outcome, response.status === 'rejected' ? 'rejected' : 'accepted');
  assert.deepEqual(receipt[0].response_payload, response);
  const hash = read(`select to_jsonb(encode(extensions.digest(convert_to(jsonb_build_array('side_pool_graduated_v2','${action}','${actor}'::uuid,'${f.tid}'::uuid,'${f.eid}'::uuid,'${pool}'::uuid,${json(request)})::text,'utf8'),'sha256'),'hex'));`);
  assert.equal(receipt[0].request_hash, hash);
  const audits = rows(read, 'audit_events', `operation_receipt_id='${receipt[0].id}'`);
  assert.equal(audits.length, 1);
  assert.deepEqual(audits[0].after_state, response);
  assert.deepEqual(read(reconciliation(f, pool, action, request, operation, actor), actor), { authorized: true, result: response });
  return { receipt, audits };
}
const pause = () => new Promise(resolve => setTimeout(resolve, 30));
async function until(check, message, timeout = 4500) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (check()) return; await pause(); }
  throw Error(message);
}
const settled = handle => ({ ...handle, done: handle.done.then(value => ({ value }), error => ({ error })) });
async function completed(handle) { const result = await handle.done; if (result.error) throw result.error; return result.value; }

async function startElectionRace({ exec, read, startSession, capture, policyId, first }) {
  const { fixture: f, pools, participants, publication } = capture;
  const tags = { holder: `side-v2-hold-${f.eid.slice(0, 8)}`, start: `side-v2-start-${f.eid.slice(0, 8)}`, election: `side-v2-elect-${f.eid.slice(0, 8)}` };
  const operation = scopedId(f, 500), startOperation = scopedId(f, 501);
  const request = { policyId, participantId: participants[0], electionId: scopedId(f, 100), expectedVersion: 1, elected: true, receivedMinor: 1000, paymentMethod: 'cash', paymentReference: 'TEST ONLY same synthetic collection', reason: 'TEST ONLY concurrent same-value acknowledged election revision' };
  const statements = {
    start: `select public.start_event_play_v1('${f.actor}','${f.tid}','${f.eid}','${publication.id}',app.event_participant_snapshot_digest_v1('${f.eid}'),17,12,true,'${startOperation}');`,
    election: rpc(f, pools.graduated, 'election', request, operation, f.coDirectorId),
  };
  const targetGuard = `do $target$begin if current_database()<>${quote(capture.database)} then raise exception 'Exact disposable Side Pool database required';end if;end$target$;`;
  const holder = settled(startSession(service(f.actor) + targetGuard + `set application_name='${tags.holder}';begin;select 1 from app.tournaments where id='${f.tid}' for update;select 'HELD';select pg_sleep(6);commit;`));
  const runs = {};
  const waiting = name => exec(`select count(*) from pg_stat_activity a where a.datname=current_database() and a.application_name='${tags[name]}' and a.state='active' and a.wait_event_type='Lock' and cardinality(pg_blocking_pids(a.pid))>0;`) === '1';
  try {
    await until(() => holder.out().includes('HELD'), 'Tournament lock holder did not become ready');
    const second = first === 'start' ? 'election' : 'start';
    runs[first] = settled(startSession(service(first === 'start' ? f.actor : f.coDirectorId) + targetGuard + `set application_name='${tags[first]}';` + statements[first]));
    await until(() => waiting(first), `First ${first} request never waited on the tournament lock`);
    runs[second] = settled(startSession(service(second === 'start' ? f.actor : f.coDirectorId) + targetGuard + `set application_name='${tags[second]}';` + statements[second]));
    await until(() => waiting(first) && waiting(second), 'Both distinct-actor requests were not observed overlapping');
    await completed(holder);
    const start = JSON.parse(last(await completed(runs.start)));
    const election = JSON.parse(last(await completed(runs.election)));
    assert.equal(start.status, 'event_started');
    if (first === 'start') assert.deepEqual(election, { status: 'rejected', code: 'entries_locked' });
    else assert.equal(election.status, 'side_pool_election_saved_v2');
    assert.deepEqual(read(statements.start), start, 'Queued start exact replay cannot start twice');
    assert.equal(exec(`select count(*) from app.event_play_starts where tournament_id='${f.tid}' and event_id='${f.eid}';`), '1');
    assert.equal(read(`select to_jsonb(app.event_play_state_v1('${f.eid}'));`), 'in_progress');
    proveReceipt(read, f, pools.graduated, 'election', request, operation, election, f.coDirectorId);
    assert.deepEqual(read(statements.election, f.coDirectorId), election, 'Queued election exact replay after start');
    return { first, startActor: f.actor, electionActor: f.coDirectorId, overlapping: true, start, election };
  } finally {
    await Promise.all([holder, ...Object.values(runs)].map(handle => handle.done));
  }
}

/** Requires both pre-0261 captures. Caller must supply real independent local
 * startSession connections; a missing race adapter fails rather than skipping.
 * Leaves only fictional policy/election/review/start receipts in the disposable
 * database. No recipient assignment, payout, payment transfer, or paid flag.
 */
export async function verifySideGraduatedV2Acceptance({ sql, startSession, captures }) {
  assert.equal(typeof startSession, 'function', 'Real independent-session adapter required');
  assert.equal(captures.length, 2, 'Two distinct start-ready fixtures prove both race orderings');
  assert.notEqual(captures[0].fixture.tid, captures[1].fixture.tid);
  const results = [];
  for (const [index, capture] of captures.entries()) {
    const { fixture: f, pools, participants, database } = capture;
    const { exec, read } = adapter(sql, f, database);
    assert.deepEqual(legacyHistory(read, f, [pools.fixed, pools.collected]), capture.legacy, '0261 rewrote fixed policy/old collection history');
    assert.deepEqual(noDisbursement(read, f), capture.noDisbursement, '0261 rewrote financial/payout history');
    const writer = read("select to_jsonb(pg_get_functiondef('app.write_side_pool_graduated_v2(uuid,uuid,uuid,uuid,jsonb,uuid,text)'::regprocedure));");
    const tournamentLock = writer.indexOf('from app.tournaments where id=tid for update');
    const roleLock = writer.indexOf('from app.tournament_roles where tournament_id=tid');
    const startLock = writer.indexOf("hashtextextended('event-start:'||eid::text,0)");
    assert.ok(tournamentLock > 0 && tournamentLock < roleLock && roleLock < startLock, 'Match real start wrapper lock order');
    const workspace = () => read(`select public.get_side_pool_graduated_workspace_v2('${f.actor}','${f.tid}');`);
    const pool = () => workspace().pools.find(p => p.poolId === pools.graduated);
    const mutate = (action, request, n, { target = pools.graduated, who = f.actor, tournament = f.tid, event = f.eid } = {}) => read(rpc(f, target, action, request, scopedId(f, n), who, tournament, event), who);
    const definitionId = pool().definitionId;
    const policyRequest = { method, ratio: 6, definitionVersionId: definitionId, disclosureReference: 'TEST ONLY posted before any collection; ACC weights with app-owned exact $5 balancing; recipient selection remains separate', disclosed: true };
    const electionRequest = (n, receivedMinor = 1000, expectedVersion = 0) => ({ policyId: scopedId(f, 999), participantId: participants[n], electionId: scopedId(f, 100 + n), expectedVersion, elected: true, receivedMinor, paymentMethod: 'cash', paymentReference: 'TEST ONLY fictional collection', reason: 'TEST ONLY participant acknowledged posted formula before collection' });
    assert.equal(mutate('election', electionRequest(0), 30).code, 'disclosed_policy_required');
    assert.equal(mutate('policy', { ...policyRequest, disclosed: false }, 31).code, 'invalid_request');
    assert.equal(exec(`select count(*) from app.event_side_pool_election_versions where pool_id='${pools.graduated}';`), '0');
    const published = mutate('policy', policyRequest, 32);
    assert.equal(published.status, 'side_pool_graduated_policy_frozen');
    assert.equal(published.moneyMoved, false);
    const policyId = published.policyId;
    const policyReceipt = proveReceipt(read, f, pools.graduated, 'policy', policyRequest, scopedId(f, 32), published);
    assert.deepEqual(mutate('policy', policyRequest, 32), published);
    assert.equal(mutate('policy', { ...policyRequest, ratio: 4 }, 32).code, 'idempotency_conflict');
    assert.equal(read(reconciliation(f, pools.graduated, 'policy', { ...policyRequest, ratio: 4 }, scopedId(f, 32))).result.code, 'idempotency_conflict');
    assert.equal(mutate('policy', policyRequest, 33).code, 'policy_frozen');
    assert.deepEqual(proveReceipt(read, f, pools.graduated, 'policy', policyRequest, scopedId(f, 32), published), policyReceipt);
    for (const [i, target] of [pools.fixed, pools.collected].entries()) {
      const oldDefinition = exec(`select id from app.event_side_pool_definition_versions where pool_id='${target}' order by version desc limit 1;`);
      assert.equal(mutate('policy', { ...policyRequest, definitionVersionId: oldDefinition }, 34 + i, { target }).code, 'legacy_pool_history_preserved');
    }
    assert.equal(mutate('policy', policyRequest, 40, { who: f.outsiderId }), null);
    assert.equal(mutate('policy', policyRequest, 41, { tournament: captures[1 - index].fixture.tid }), null);
    assert.equal(read(`select public.get_side_pool_graduated_workspace_v2('${f.outsiderId}','${f.tid}');`, f.outsiderId), null);
    for (const role of ['anon', 'authenticated', '']) {
      const output = sql(`set role postgres;set request.jwt.claim.role=${quote(role)};set request.jwt.claims=${quote(JSON.stringify(role ? { role } : {}))};${rpc(f, pools.graduated, 'policy', policyRequest, scopedId(f, 42))}`);
      assert.equal(JSON.parse(last(output) ?? 'null'), null, 'Missing/non-service JWT must not call privileged writer');
    }
    assert.equal(exec(`select count(*) from app.operation_receipts where client_operation_id in ('${scopedId(f, 40)}','${scopedId(f, 41)}','${scopedId(f, 42)}');`), '0', 'Unauthorized calls must not retain receipts');
    const revoked = read(`begin;delete from app.tournament_roles where tournament_id='${f.tid}' and profile_id='${f.actor}' and role='director';select jsonb_build_object('write',(${rpc(f, pools.graduated, 'policy', policyRequest, scopedId(f, 32)).replace(/^select /, '').replace(/;$/, '')}),'reconcile',(${reconciliation(f, pools.graduated, 'policy', policyRequest, scopedId(f, 32)).replace(/^select /, '').replace(/;$/, '')}));rollback;`);
    assert.deepEqual(revoked, { write: null, reconcile: null }, 'Revoked actor cannot replay accepted receipt');
    for (let n = 0; n < 17; n++) {
      const request = { ...electionRequest(n, n === 16 ? 500 : 1000), policyId };
      const saved = mutate('election', request, 200 + n);
      assert.equal(saved.status, 'side_pool_election_saved_v2');
      if (n === 0) {
        const before = proveReceipt(read, f, pools.graduated, 'election', request, scopedId(f, 200), saved);
        assert.deepEqual(mutate('election', request, 200), saved);
        assert.equal(mutate('election', { ...request, receivedMinor: 500 }, 200).code, 'idempotency_conflict');
        assert.equal(read(reconciliation(f, pools.graduated, 'election', { ...request, receivedMinor: 500 }, scopedId(f, 200))).result.code, 'idempotency_conflict');
        assert.equal(mutate('election', request, 299).code, 'stale_version');
        assert.deepEqual(proveReceipt(read, f, pools.graduated, 'election', request, scopedId(f, 200), saved), before);
        const entriesBefore = rows(read, 'event_side_pool_election_versions', `pool_id='${pools.graduated}'`);
        const fundBefore = pool();
        const lowerReceived = { ...request, expectedVersion: 1, receivedMinor: 500 };
        const refundRequired = mutate('election', lowerReceived, 298);
        assert.deepEqual(refundRequired, { status: 'rejected', code: 'refund_resolution_required' });
        const refundReceipt = proveReceipt(read, f, pools.graduated, 'election', lowerReceived, scopedId(f, 298), refundRequired);
        assert.deepEqual(mutate('election', lowerReceived, 298), refundRequired, 'Lower collection exact retry stays rejected');
        assert.deepEqual(proveReceipt(read, f, pools.graduated, 'election', lowerReceived, scopedId(f, 298), refundRequired), refundReceipt);
        assert.deepEqual(rows(read, 'event_side_pool_election_versions', `pool_id='${pools.graduated}'`), entriesBefore, 'Rejected decrease must not rewrite or append collection history');
        assert.deepEqual(pool(), fundBefore, 'Rejected decrease must preserve exact funded source and amount schedule');
      }
    }
    let current = pool();
    assert.equal(current.paidCount, 16, 'Partial collection must not inflate funded count');
    assert.ok(current.blockers.includes('funding_unresolved'));
    assert.equal(current.calculation, null);
    const partialDigest = current.sourceDigest;
    const reviewRequest = digest => ({ expectedVersion: 0, sourceDigest: digest, reason: 'TEST ONLY reviewed unpaid rank amounts; recipients not assigned', reviewed: true });
    assert.equal(mutate('review', reviewRequest(partialDigest), 300).code, 'source_blocked');
    const fullRequest = { ...electionRequest(16, 1000, 1), policyId };
    assert.equal(mutate('election', fullRequest, 301).status, 'side_pool_election_saved_v2');
    current = pool();
    assert.equal(current.paidCount, 17);
    assert.deepEqual(current.blockers, []);
    assert.notEqual(current.sourceDigest, partialDigest);
    assert.deepEqual(current.calculation, calculateGraduatedPoolAmountsV2({ paidCount: 17, feeMinor: 1000, ratio: 6 }));
    assert.equal(current.calculation.awardsMinor.reduce((sum, a) => sum + a, 0), 17000);
    assert.ok(current.calculation.awardsMinor.every(a => a % 500 === 0));
    assert.equal(mutate('review', reviewRequest(current.sourceDigest), 302).code, 'entries_not_locked');
    const race = await startElectionRace({ exec, read, startSession, capture, policyId, first: index === 0 ? 'start' : 'election' });
    current = pool();
    assert.equal(current.started, true);
    assert.equal(mutate('election', { ...electionRequest(1, 1000, 1), policyId }, 303).code, 'entries_locked');
    const staleRequest = reviewRequest(partialDigest), rejected = mutate('review', staleRequest, 304);
    assert.deepEqual(rejected, { status: 'rejected', code: 'source_changed' });
    proveReceipt(read, f, pools.graduated, 'review', staleRequest, scopedId(f, 304), rejected);
    const request = reviewRequest(current.sourceDigest), reviewed = mutate('review', request, 305);
    assert.equal(reviewed.status, 'side_pool_amounts_reviewed_unpaid');
    assert.equal(reviewed.moneyMoved, false);
    const reviewReceipt = proveReceipt(read, f, pools.graduated, 'review', request, scopedId(f, 305), reviewed);
    assert.deepEqual(mutate('review', request, 305), reviewed);
    assert.equal(mutate('review', { ...request, sourceDigest: 'f'.repeat(64) }, 305).code, 'idempotency_conflict');
    assert.equal(read(reconciliation(f, pools.graduated, 'review', { ...request, sourceDigest: 'f'.repeat(64) }, scopedId(f, 305))).result.code, 'idempotency_conflict');
    assert.equal(mutate('review', request, 306).code, 'stale_version');
    assert.equal(mutate('review', { ...request, expectedVersion: 1 }, 307).code, 'already_reviewed');
    assert.deepEqual(proveReceipt(read, f, pools.graduated, 'review', request, scopedId(f, 305), reviewed), reviewReceipt);
    const history = rows(read, 'side_pool_amount_reviews_v2', `pool_id='${pools.graduated}'`);
    assert.equal(history.length, 1);
    assert.equal(history[0].status, 'unpaid_amount_schedule');
    assert.deepEqual(history[0].calculation, current.calculation);
    assert.equal(pool().history[0].current, true);
    assert.equal(workspace().recipientSelection, 'not_assigned');
    assert.deepEqual(legacyHistory(read, f, [pools.fixed, pools.collected]), capture.legacy);
    assert.deepEqual(noDisbursement(read, f), capture.noDisbursement, 'Amount reviews must not write payments, payouts, paid approvals or reconciliations');
    const oldWorkspace = read(`select public.get_event_side_pool_workspace_v1('${f.actor}','${f.tid}');`);
    const fixed = oldWorkspace.events.find(e => e.eventId === f.eid).pools.find(p => p.poolId === pools.fixed);
    assert.deepEqual(fixed.policy.postedPayoutSchedule, capture.fixedRequest);
    assert.equal(fixed.paidMinor, 0);
    assert.equal(fixed.finalized, false);
    results.push({ eventId: f.eid, groups: 8, race, calculation: current.calculation, reviewId: reviewed.reviewId });
  }
  const { exec } = adapter(sql, captures[0].fixture, captures[0].database);
  assert.equal(exec("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('get_side_pool_graduated_workspace_v2','save_side_pool_graduated_policy_v2','save_side_pool_graduated_election_v2','record_side_pool_amount_review_v2','get_side_pool_graduated_reconciliation_v2') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'));"), '0');
  assert.equal(exec("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and c.relname in('side_pool_graduated_policies_v2','side_pool_amount_reviews_v2') and c.relrowsecurity and c.relforcerowsecurity and pg_get_userbyid(c.relowner)='postgres';"), '2');
  console.log('PASS Side graduated v2 SQL: two distinct-actor observed start/election orderings, prepayment disclosure, exact funded count, source/replay/roles, unchanged fixed history and zero disbursements');
  return { groups: 18, results, limitation: 'Execute in caller-owned disposable PostgreSQL with real streaming session adapter. Amount schedules remain unassigned and unpaid; HTTP/browser and physical collection are separate gates.' };
}
