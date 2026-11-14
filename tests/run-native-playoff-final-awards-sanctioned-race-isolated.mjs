// Current qualification + private native playoff recipient-source runner for one exact disposable local container.
// No network, provider, hosted project, bind mount, published port, or real payment.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync, spawn} from 'node:child_process';
import {verifyCustomQDraft} from './custom-q-draft-local-acceptance.mjs';
import {verifyEventSettingsV3} from './event-settings-v3-local-acceptance.mjs';
import {verifyEventRegularFinanceDraftV1} from './event-regular-finance-local-acceptance.mjs';
import {verifyCurrentEventSettingsFinance} from './event-settings-finance-current-local-acceptance.mjs';
import {prepareTwelveGameCurrentQualificationSetup, verifyOperationalFinanceCurrentQualificationSanctioned} from './operational-finance-current-qualification-sanctioned-local-acceptance.mjs';
import {verifyNativePlayoffFinanceRecipientSource} from './native-playoff-finance-recipient-local-acceptance.mjs';
import {verifyNativePlayoffFinalAwardsSanctionedRace} from './native-playoff-final-awards-sanctioned-race-local-acceptance.mjs';

const argv = process.argv.slice(2);
const value = flag => argv[argv.indexOf(flag) + 1];
if (argv.length !== 5 || argv[0] !== '--isolated-container' || argv[1] !== '--container-id' || argv[3] !== '--result-dir') throw Error('Exact isolated arguments required');
const cid = value('--container-id');
if (!/^[a-f0-9]{64}$/.test(cid)) throw Error('Exact container ID required');
const resultDir = path.resolve(value('--result-dir'));
if (!resultDir.startsWith(path.resolve('test-results') + path.sep) || !fs.statSync(resultDir).isDirectory()) throw Error('Dedicated result directory required');

const dockerExe = 'C:\\Users\\choco\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe';
const name = 'cribbage-native-playoff-final-awards-sanctioned-20261105';
const image = 'sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
const db = 'fixture_native_playoff_final_awards_sanctioned_v1';
const baselinePath = '../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump';
const baselineHash = 'e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc';
const trace = [];
const record = (phase, data = {}) => { const row = {at: new Date().toISOString(), phase, ...data}; trace.push(row); fs.writeFileSync(path.join(resultDir, 'trace.json'), JSON.stringify(trace, null, 2)); console.log('OPERATIONAL_FINANCE_FIXTURE', phase, JSON.stringify(data)); };

if (process.env.DOCKER_HOST) throw Error('DOCKER_HOST override is not permitted');
function requireLocalContext() {
  const r = spawnSync(dockerExe, ['context', 'inspect', 'desktop-linux'], {encoding: 'utf8', timeout: 5000});
  if (r.status !== 0) throw Error('Cannot verify Docker context');
  const c = JSON.parse(r.stdout);
  if (c.length !== 1 || c[0].Endpoints?.docker?.Host !== 'npipe:////./pipe/dockerDesktopLinuxEngine') throw Error('Exact local Docker Desktop npipe required');
}
function docker(args, input, allowFailure = false) {
  requireLocalContext();
  const r = spawnSync(dockerExe, ['--context', 'desktop-linux', ...args], {input, encoding: Buffer.isBuffer(input) ? undefined : 'utf8', maxBuffer: 64 * 1024 * 1024});
  if (!allowFailure && r.status !== 0) throw Error(String(r.stderr));
  return r;
}
function assertIsolation(meta) {
  assert.equal(meta.Id, cid); assert.equal(meta.Name, `/${name}`); assert.equal(meta.State?.Status, 'running');
  assert.equal(meta.Config?.Labels?.['codex.fixture'], name); assert.equal(meta.Image, image);
  assert.equal(meta.HostConfig?.NetworkMode, 'none'); assert.deepEqual(Object.keys(meta.NetworkSettings?.Networks ?? {}), ['none']);
  assert.equal(Object.keys(meta.HostConfig?.PortBindings ?? {}).length, 0); assert.equal(meta.HostConfig?.Binds?.length ?? 0, 0);
  assert.equal(meta.Mounts?.length, 0); assert.equal(meta.HostConfig?.Privileged, false); assert.ok(meta.HostConfig?.CapDrop?.includes('ALL'));
}
assertIsolation(JSON.parse(docker(['inspect', cid]).stdout)[0]);
const sql = (query, database = 'postgres', allowFailure = false) => docker(['exec', '-i', cid, 'psql', '-h', '/tmp', '-X', '-qAt', '-U', 'supabase_admin', '-d', database, '-v', 'ON_ERROR_STOP=1'], query, allowFailure);
const baseline = fs.readFileSync(baselinePath);
assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'), baselineHash);
assert.equal(sql(`select count(*)from pg_database where datname='${db}'`).stdout.trim(), '0', 'Fixture DB already exists');
const toc = docker(['exec', '-i', cid, 'pg_restore', '--list'], baseline).stdout.toString();
const owners = [...new Set(toc.split('\n').filter(line => !line.startsWith(';')).map(line => line.trim().split(/\s+/).at(-1)).filter(x => x?.startsWith('supabase_') || ['postgres', 'pgbouncer'].includes(x)))];
for (const owner of [...new Set([...owners, 'anon', 'authenticated', 'service_role', 'authenticator', 'dashboard_user', 'pgbouncer'])]) {
  if (!/^(?:postgres|pgbouncer|anon|authenticated|service_role|authenticator|dashboard_user|supabase_[a-z_]+)$/.test(owner)) throw Error('Unexpected baseline owner');
  sql(`do $$begin if not exists(select 1 from pg_roles where rolname='${owner}')then create role ${owner} ${owner === 'postgres' ? 'superuser' : 'nologin'};end if;end$$;`);
}
docker(['exec', cid, 'createdb', '-h', '/tmp', '-U', 'supabase_admin', '-O', 'postgres', '--template=template0', db]);
let originalGate = null;
try {
  docker(['exec', '-i', cid, 'pg_restore', '-h', '/tmp', '--exit-on-error', '-U', 'supabase_admin', '-d', db], baseline);
  assert.equal(sql("select (select count(*)from auth.users)::text||'|'||(select count(*)from app.tournaments)::text", db).stdout.trim(), '0|0');
  for (let n = 237; n <= 292; n++) {
    const file = fs.readdirSync('database/migrations').find(x => x.startsWith(`${String(n).padStart(4, '0')}_`));
    if (!file) throw Error(`Missing migration ${n}`);
    const bytes = fs.readFileSync(path.join('database/migrations', file));
    record('migration', {file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')});
    sql(`set role postgres;${bytes}`, db);
  }
  const proposals = [
    'custom-graduated-amounts-v3.sql', 'custom-payout-intent-journal-v2.sql', 'custom-payout-q-setup-save-v2.sql',
    'event-settings-transaction-v3.sql', 'event-settings-workspace-v3.sql', 'event-regular-finance-draft-v1.sql',
    'event-settings-activation-source-v4.sql', 'event-rule-context-v1.sql', 'event-rule-assessment-v1.sql',
    'event-settings-activation-guard-v1.sql', 'event-settings-finance-backstop-v1.sql',
    'event-settings-operational-activation-v1.sql', 'event-settings-playoff-gate-v1.sql',
    'native-event-ledger-source-reader-v1.sql', 'native-event-ledger-allocation-v1.sql',
    'operational-event-finance-proposals-v1.sql', 'playoff-series-matches-v1.sql',
    'playoff-series-games-v1.sql', 'native-playoff-finance-recipient-source-v1.sql',
    'native-playoff-final-awards-v1.sql',
  ];
  for (const file of proposals) {
    const bytes = fs.readFileSync(path.join('database/proposals', file));
    record('proposal', {file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')});
    sql(`set role postgres;${bytes}`, db);
  }
  assert.equal(sql("select current_database()||'|'||(inet_server_addr()is null)::text", db).stdout.trim(), `${db}|true`);
  record('installed', {database: db, proposalCount: proposals.length});

  const q = (query, who = 'a2950000-0000-4000-8000-000000000001', role = 'ownerAuthenticated') => {
    if (!['ownerAuthenticated', 'anon', 'authenticated', 'service_role'].includes(role)) throw Error('Unsupported fixture role');
    const jwtRole = role === 'ownerAuthenticated' ? 'authenticated' : role;
    return sql(`set statement_timeout='4000ms';set role ${role === 'ownerAuthenticated' ? 'postgres' : role};set request.jwt.claim.role='${jwtRole}';set request.jwt.claim.sub='${who}';set request.jwt.claims='{"role":"${jwtRole}","sub":"${who}"}';${query}`, db).stdout.trim();
  };
  const read = (query, who, role) => { const line = q(query, who, role).split(/\r?\n/).filter(Boolean).at(-1); return line === undefined ? null : JSON.parse(line); };
  const runtimeSignatures = read(`select jsonb_build_object(
    'schedulePublisher',to_regprocedure('public.publish_director_reviewed_event_schedule_v1(uuid,uuid,uuid,jsonb,boolean,uuid)')is not null,
    'rosterCheckIn',to_regprocedure('public.record_roster_check_in_event_v2(uuid,uuid,text,text,uuid)')is not null,
    'registrationClose',to_regprocedure('public.close_tournament_registration_v2(uuid,uuid,uuid)')is not null,
    'initialSeatingPublisher',to_regprocedure('public.publish_initial_seating_v2(uuid,smallint,smallint,jsonb,uuid)')is not null,
    'paymentObligationWriter',to_regprocedure('public.set_roster_payment_obligation_v1(uuid,uuid,integer,integer,text,uuid)')is not null,
    'eventEnrollmentWriter',to_regprocedure('public.enroll_roster_entries_in_event_v3(uuid,uuid,uuid,jsonb,uuid)')is not null,
    'eventCheckInWindowOpener',to_regprocedure('public.open_event_check_in_window_v1(uuid,uuid,uuid,uuid)')is not null,
    'eventDeskCheckIn',to_regprocedure('public.desk_check_in_event_v1(uuid,uuid,uuid,uuid,uuid)')is not null,
    'eventCheckInWindowCloser',to_regprocedure('public.close_event_check_in_window_v1(uuid,uuid,uuid,uuid)')is not null,
    'eventPlayStarter',to_regprocedure('public.start_event_play_v1(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid)')is not null,
    'participantSnapshotDigest',to_regprocedure('app.event_participant_snapshot_digest_v1(uuid)')is not null,
    'rosterActivationIssuer',to_regprocedure('public.issue_roster_account_activation_v1(uuid,uuid,uuid,uuid,bytea,bytea,timestamptz,uuid)')is not null,
    'rosterActivationRedeemer',to_regprocedure('public.redeem_roster_account_activation_v1(uuid,uuid,bytea,uuid)')is not null,
    'rosterActivationDecider',to_regprocedure('public.decide_roster_account_activation_v1(uuid,uuid,uuid,text,text,uuid)')is not null,
    'scoreSubmitter',to_regprocedure('public.submit_game_score(uuid,uuid,smallint,text,integer,uuid)')is not null,
    'scoreConfirmer',to_regprocedure('public.confirm_game_score(uuid,uuid,uuid)')is not null,
    'qualificationFinalizer',to_regprocedure('public.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid)')is not null,
    'qualificationReader',to_regprocedure('public.get_standard_singles_qualification_result_v1(uuid,uuid,uuid)')is not null,
    'paymentWriter',to_regprocedure('public.record_manual_roster_payment(uuid,uuid,integer,integer,text,text,timestamptz,text,uuid)')is not null,
    'expenseWriter',to_regprocedure('public.record_tournament_expense(uuid,integer,text,text,uuid)')is not null,
    'allocationWriter',to_regprocedure('app.save_native_ledger_allocation_v1(uuid,jsonb)')is not null,
    'proposalWriter',to_regprocedure('app.save_operational_event_finance_proposal_v1(uuid,uuid,jsonb)')is not null,
    'qualificationCurrentness',to_regprocedure('app.qualification_resolution_snapshot_current_v1(uuid)')is not null,
    'playoffGateSource',to_regprocedure('app.event_settings_playoff_source_v1(uuid,uuid)')is not null,
    'playoffGateReviewer',to_regprocedure('app.review_event_settings_playoffs_v1(uuid,uuid,jsonb)')is not null,
    'playoffStarter',to_regprocedure('app.start_event_settings_playoffs_v1(uuid,uuid,jsonb)')is not null,
    'seriesMatchSource',to_regprocedure('app.playoff_series_match_source_v1(uuid,uuid,uuid,integer)')is not null,
    'seriesGenerationWriter',to_regprocedure('app.create_playoff_series_generation_v1(uuid,uuid,jsonb)')is not null,
    'seriesGameWriter',to_regprocedure('app.submit_playoff_series_game_action_v1(uuid,uuid,uuid,integer,jsonb)')is not null,
    'seriesResultReader',to_regprocedure('app.playoff_series_current_result_v1(uuid,uuid,uuid,integer)')is not null,
    'recipientSourceReader',to_regprocedure('app.get_native_playoff_finance_recipient_source_v1(uuid,uuid)')is not null,
    'finalAwardSource',to_regprocedure('app.native_playoff_final_award_source_v1(uuid,uuid,uuid)')is not null,
    'incomeWriter',to_regprocedure('app.record_native_unrestricted_income_v1(uuid,uuid,jsonb)')is not null,
    'fundReviewer',to_regprocedure('app.review_native_recorded_fund_v1(uuid,uuid,jsonb)')is not null,
    'finalAwardWriter',to_regprocedure('app.record_native_playoff_final_awards_v1(uuid,uuid,jsonb)')is not null,
    'finalAwardReader',to_regprocedure('app.get_native_playoff_final_award_record_v1(uuid,uuid)')is not null
  );`, 'a2950000-0000-4000-8000-000000000001', 'ownerAuthenticated');
  assert.ok(Object.values(runtimeSignatures).every(Boolean), `Required runtime signature missing: ${JSON.stringify(runtimeSignatures)}`);
  record('runtime_signatures', runtimeSignatures);
  const withHeldLock = async (lockSql, check) => {
    assertIsolation(JSON.parse(docker(['inspect', cid]).stdout)[0]);
    const child = spawn(dockerExe, ['--context', 'desktop-linux', 'exec', '-i', cid, 'psql', '-h', '/tmp', '-X', '-qAt', '-U', 'supabase_admin', '-d', db, '-v', 'ON_ERROR_STOP=1'], {stdio: ['pipe', 'pipe', 'pipe']});
    let output = '', errors = '', closed = false;
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { errors += chunk; });
    const closedPromise = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => { closed = true; code === 0 ? resolve() : reject(Error(`Barrier failed ${code}: ${errors}`)); }); });
    void closedPromise.catch(() => {});
    try {
      child.stdin.write(`set role postgres;set idle_in_transaction_session_timeout='12s';${lockSql}\n`);
      const deadline = Date.now() + 10000;
      while (!output.split(/\r?\n/).includes('LOCK_HELD')) { if (Date.now() > deadline) throw Error(`Barrier timeout: ${errors}`); await new Promise(r => setTimeout(r, 25)); }
      await check();
    } finally {
      if (!closed) child.stdin.end('rollback;\n\\q\n');
      await Promise.race([closedPromise, new Promise((_, reject) => setTimeout(() => reject(Error('Barrier child exit timeout')), 10000))]);
    }
  };
  const parallelQueries = async (queries, who) => Promise.all(queries.map(query => new Promise((resolve, reject) => {
    assertIsolation(JSON.parse(docker(['inspect', cid]).stdout)[0]);
    const child = spawn(dockerExe, ['--context', 'desktop-linux', 'exec', '-i', cid, 'psql', '-h', '/tmp', '-X', '-qAt', '-U', 'supabase_admin', '-d', db, '-v', 'ON_ERROR_STOP=1'], {stdio: ['pipe', 'pipe', 'pipe']});
    let output = '', errors = '';
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { errors += chunk; });
    child.once('error', reject); child.once('close', code => code === 0 ? resolve(output) : reject(Error(`Concurrent query failed ${code}: ${errors}`)));
    child.stdin.end(`set statement_timeout='12s';set role postgres;set request.jwt.claim.role='authenticated';set request.jwt.claim.sub='${who}';set request.jwt.claims='{"role":"authenticated","sub":"${who}"}';${query}\n`);
  })));

  record('verify_start', {helper:'custom_q'});
  const qResult = await verifyCustomQDraft({q, read, withHeldLock});
  record('verify_pass', {helper:'custom_q'});
  let operation = 4000;
  const actorId = 'a2950000-0000-4000-8000-000000000001';
  const outsiderId = 'a2950000-0000-4000-8000-000000000002';
  const tournamentId = 'a2950000-0000-4000-8000-000000000003';
  const nextOperationId = () => `a2950000-0000-4000-8000-${String(operation++).padStart(12, '0')}`;
  record('verify_start', {helper:'event_settings_v3'});
  const initialSettingsResult = await verifyEventSettingsV3({q, read, withHeldLock, actorId, outsiderId, tournamentId, nextOperationId});
  record('verify_pass', {helper:'event_settings_v3'});
  record('verify_start', {helper:'current_qualification_12_game_setup'});
  const settingsResult = prepareTwelveGameCurrentQualificationSetup({read, actorId, tournamentId, nextOperationId});
  record('verify_pass', {helper:'current_qualification_12_game_setup', supersededSettingsSnapshotId:initialSettingsResult.settingsSnapshotId, settingsSnapshotId:settingsResult.settingsSnapshotId});
  record('verify_start', {helper:'event_regular_finance'});
  const financeResult = await verifyEventRegularFinanceDraftV1({q, read, withHeldLock, actorId, outsiderId, tournamentId, nextOperationId, settingsSnapshotId: settingsResult.settingsSnapshotId, setupEventVersionId: settingsResult.setupEventVersionId});
  record('verify_pass', {helper:'event_regular_finance'});
  record('verify_start', {helper:'current_settings_finance'});
  const currentResult = await verifyCurrentEventSettingsFinance({q, read, withHeldLock, actorId, outsiderId, tournamentId, nextOperationId, settingsResult, financeResult});
  record('verify_pass', {helper:'current_settings_finance'});
  record('verify_start', {helper:'operational_finance_current_qualification'});
  const currentQualificationResult = await verifyOperationalFinanceCurrentQualificationSanctioned({
    q, read, actorId, outsiderId, tournamentId, nextOperationId,
    writeEvidence:(file,value)=>fs.writeFileSync(path.join(resultDir,file),JSON.stringify(value,null,2)),
  });
  record('verify_pass', {helper:'operational_finance_current_qualification'});
  record('verify_start', {helper:'native_playoff_finance_recipient'});
  const nativeRecipientResult = await verifyNativePlayoffFinanceRecipientSource({
    q, read, withHeldLock, actorId, outsiderId, tournamentId, nextOperationId,
    writeEvidence:(file,value)=>fs.writeFileSync(path.join(resultDir,file),JSON.stringify(value,null,2)),
  });
  record('verify_pass', {
    helper:'native_playoff_finance_recipient',
    qualifierCount:nativeRecipientResult.qualifierCount,
    matchCount:nativeRecipientResult.matchCount,
    verifiedGameCount:nativeRecipientResult.verifiedGameCount,
    acceptedActionCount:nativeRecipientResult.acceptedActionCount,
  });
  record('verify_start', {helper:'native_playoff_final_awards'});
  const finalAwardResult = await verifyNativePlayoffFinalAwardsSanctionedRace({
    q,read,withHeldLock,parallelQueries,actorId,outsiderId,tournamentId,nextOperationId,
    writeEvidence:(file,value)=>fs.writeFileSync(path.join(resultDir,file),JSON.stringify(value,null,2)),
  });
  record('verify_pass', {helper:'native_playoff_final_awards',totalMinor:finalAwardResult.totalMinor,recipientCount:finalAwardResult.recipientCount});
  const actualSource = read(`select app.get_operational_event_finance_source_v1('${tournamentId}',(select event_id from app.event_settings_operational_bindings_v1 where tournament_id='${tournamentId}'));`, actorId, 'ownerAuthenticated');
  fs.writeFileSync(path.join(resultDir, 'current-qualified-operational-source.json'), JSON.stringify(actualSource, null, 2));
  fs.writeFileSync(path.join(resultDir, 'current-qualified-result.json'), JSON.stringify(currentQualificationResult, null, 2));
  const result = {containerId: cid, database: db, migrations: '0237-0292', qResult, settingsResult, financeResult, currentResult, currentQualificationResult, nativeRecipientResult, finalAwardResult};
  fs.writeFileSync(path.join(resultDir, 'native-playoff-final-award-sanctioned-result.json'), JSON.stringify(result, null, 2));
  record('pass', {bridgeStatus:currentResult.bridgeStatus,currentQualification:true,qualifierCount:5,
   nativeRecipientSourceProved:true,recordedIncomeBookkeepingProved:true,unpaidFinalAwardRecorded:true,
   productionOverrideRebaseUiAvailable:false,moneyMoved:false,payoutAuthorized:false,disbursementAuthorized:false,finalizationAuthorized:false});
} catch (error) {
  fs.writeFileSync(path.join(resultDir, 'runner-error.txt'), `${error?.stack ?? error}\n`);
  record('failure', {message: String(error?.message ?? error)});
  throw error;
} finally {
  try {
    const exists = sql(`select count(*)from pg_database where datname='${db}'`).stdout.trim() === '1';
    if (exists) {
      try {
        const counts = sql(`select jsonb_build_object('users',(select count(*)from auth.users),'tournaments',(select count(*)from app.tournaments),'operationalBindings',(select count(*)from app.event_settings_operational_bindings_v1),'nativeAllocations',(select count(*)from app.native_ledger_allocation_revisions_v1));`, db, true);
        fs.writeFileSync(path.join(resultDir, 'final-db-counts.txt'), counts.stdout.toString() + counts.stderr.toString());
      } catch {}
      finally { docker(['exec', cid, 'dropdb', '-h', '/tmp', '-U', 'supabase_admin', '--if-exists', db]); }
    }
    assert.equal(sql(`select count(*)from pg_database where datname='${db}'`).stdout.trim(), '0');
    record('database_removed', {database: db, verifiedAbsent: true});
  } catch (cleanupError) {
    fs.writeFileSync(path.join(resultDir, 'database-cleanup-error.txt'), `${cleanupError?.stack ?? cleanupError}\n`);
    throw cleanupError;
  }
}
