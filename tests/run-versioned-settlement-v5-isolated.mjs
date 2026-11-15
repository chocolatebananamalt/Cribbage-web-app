// Explicit opt-in runner for a disposable, network-isolated local database.
import crypto from "node:crypto";
import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";

if (!process.argv.includes("--isolated-container")) {
  throw new Error("Explicit --isolated-container required");
}

const container = "cribbage-0240-isolated";
const database = "fixture_0240";
const baselinePath = "../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump";
const baseline = fs.readFileSync(baselinePath);
const expectedBaselineHash = "e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc";
if (crypto.createHash("sha256").update(baseline).digest("hex") !== expectedBaselineHash) {
  throw new Error("Reviewed empty baseline hash mismatch");
}

function docker(args, input) {
  const result = spawnSync("docker", ["--context", "desktop-linux", ...args], {
    input,
    encoding: Buffer.isBuffer(input) ? undefined : "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(String(result.stderr));
  return String(result.stdout);
}

const metadata = JSON.parse(docker(["inspect", container]))[0];
if (
  metadata.Config.Labels["codex.fixture"] !== container ||
  metadata.HostConfig.NetworkMode !== "none" ||
  Object.keys(metadata.HostConfig.PortBindings ?? {}).length !== 0 ||
  (metadata.HostConfig.Binds?.length ?? 0) !== 0 ||
  metadata.Mounts.some((mount) => mount.Type === "bind") ||
  metadata.HostConfig.Privileged ||
  metadata.Config.Image !== "public.ecr.aws/supabase/postgres:17.11.0.004"
) {
  throw new Error("Isolation mismatch");
}

const psqlArgs = [
  "exec", "-i", container, "psql", "-X", "-qAt", "-U", "supabase_admin", "-d", database,
  "-v", "ON_ERROR_STOP=1",
];
const sql = (query) => docker(psqlArgs, query);
const actor = "a1310000-0000-4000-8000-000000000001";
const coDirector = "a1310000-0000-4000-8000-000000000006";
const tournament = "b1310000-0000-4000-8000-000000000001";
const event = "11310000-0000-4000-8000-000000000001";
const qualification = "a2400000-0000-4000-8000-000000000001";
const participant = (number) => `41310000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const operation = (number) => `a2600000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const series = JSON.stringify([
  { winnerId: participant(1), loserId: participant(4), evidenceNote: "TEST ONLY semifinal 1" },
  { winnerId: participant(2), loserId: participant(3), evidenceNote: "TEST ONLY semifinal 2" },
  { winnerId: participant(1), loserId: participant(2), evidenceNote: "TEST ONLY final" },
]);
const legacyPlacements = JSON.stringify([
  { participantId: participant(1), placement: 1, prizeAmountMinor: 0 },
  { participantId: participant(2), placement: 2, prizeAmountMinor: 0 },
  { participantId: participant(4), placement: 3, prizeAmountMinor: 0 },
  { participantId: participant(3), placement: 4, prizeAmountMinor: 0 },
]);

function jsonResult(output) {
  const line = output.trim().split("\n").filter((value) => value.trim().startsWith("{")).at(-1);
  if (!line) throw new Error(`RPC returned no JSON: ${output}`);
  return JSON.parse(line);
}

function callV5(who, key, request) {
  return `select public.save_event_settlement_draft_v5('${who}','${tournament}','${event}','${JSON.stringify(request)}'::jsonb,'${key}');`;
}

function callLegacyV1(who, key) {
  return `select public.save_standard_singles_settlement_draft_v1('${who}','${tournament}','${event}','${qualification}',0,'${legacyPlacements}'::jsonb,'[]'::jsonb,'${key}');`;
}

function concurrent(query, applicationName) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["--context", "desktop-linux", ...psqlArgs]);
    let output = "";
    let error = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("close", (code) => code ? reject(new Error(error)) : resolve(jsonResult(output)));
    child.stdin.end(`begin;
set local lock_timeout='8s';
set local statement_timeout='15s';
set local request.jwt.claim.role='service_role';
set local request.jwt.claims='{"role":"service_role"}';
set local application_name='${applicationName}';
${query}
commit;
`);
  });
}

async function race(firstQuery, secondQuery) {
  const blocker = spawn("docker", ["--context", "desktop-linux", ...psqlArgs]);
  let blockerOutput = "";
  let blockerError = "";
  blocker.stdout.on("data", (chunk) => { blockerOutput += chunk; });
  blocker.stderr.on("data", (chunk) => { blockerError += chunk; });
  blocker.stdin.write(`begin;
set local statement_timeout='20s';
select pg_advisory_xact_lock(hashtextextended('settlement:${event}',0));
select 'SETTLEMENT_BARRIER_READY';
`);
  const readyDeadline = Date.now() + 6_000;
  while (!blockerOutput.includes("SETTLEMENT_BARRIER_READY")) {
    if (Date.now() > readyDeadline) throw new Error(`Barrier did not become ready: ${blockerError}`);
    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  const first = concurrent(firstQuery, "0240_settlement_race_a");
  const second = concurrent(secondQuery, "0240_settlement_race_b");
  let bothWaiting = false;
  const waitDeadline = Date.now() + 8_000;
  try {
    while (Date.now() < waitDeadline) {
      const waiting = sql(`select count(*) from pg_stat_activity where datname='${database}' and application_name in('0240_settlement_race_a','0240_settlement_race_b') and wait_event='advisory';`).trim();
      if (waiting === "2") { bothWaiting = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  } finally {
    blocker.stdin.end("commit;\n");
  }
  if (!bothWaiting) {
    await Promise.allSettled([first, second]);
    throw new Error("Both RPC sessions were not observed waiting on advisory serialization");
  }
  return Promise.all([first, second]);
}

function setup() {
  docker(["exec", container, "dropdb", "-U", "supabase_admin", "--if-exists", database]);
  docker(["exec", container, "createdb", "-U", "supabase_admin", "-O", "postgres", "--template=template0", database]);
  docker(["exec", "-i", container, "pg_restore", "--exit-on-error", "-U", "supabase_admin", "-d", database], baseline);
  for (const prefix of ["0237", "0238", "0239"]) {
    const migration = fs.readdirSync("database/migrations").find((file) => file.startsWith(`${prefix}_`));
    sql(fs.readFileSync(`database/migrations/${migration}`, "utf8"));
  }
  const proposal = fs.readFileSync("docs/quality/2026-10-27-proposed-versioned-settlement-v5.sql", "utf8");
  const fixturePrefix = fs.readFileSync("tests/versioned-settlement-v5.sql", "utf8")
    .split("savepoint legacy_canonical_probe;")[0]
    .replace("\\ir ../docs/quality/2026-10-27-proposed-versioned-settlement-v5.sql", () => proposal);
  sql(`set role postgres;${fixturePrefix}
insert into app.tournament_roles(tournament_id,profile_id,role) values('${tournament}','${coDirector}','co_director');
set constraints all immediate;
commit;`);
  const playoff = jsonResult(sql(`set request.jwt.claim.role='service_role';
select public.record_standard_singles_playoff_outcomes_v3('${actor}','${tournament}','${event}','${qualification}',0,'${series}'::jsonb,'${operation(1)}');`));
  if (playoff.status !== "playoff_outcomes_recorded") throw new Error(`Playoff source setup failed: ${JSON.stringify(playoff)}`);
  const source = {
    kind: "playoff_outcome_v3",
    resultId: playoff.resultId,
    qualificationResultVersionId: qualification,
  };
  return {
    source,
    request: {
      source,
      expectedVersion: 0,
      prizeClaims: [],
      eventIncomeMinor: 0,
      eventExpenseMinor: 0,
      retainedBalanceMinor: 0,
      officialSourceReference: "TEST ONLY concurrency source review",
      sanctioningExpenseEventId: null,
    },
  };
}

function counts() {
  return JSON.parse(sql(`select json_build_object(
    'newDrafts',(select count(*)from app.event_settlement_drafts_v5),
    'oldDrafts',(select count(*)from app.standard_singles_settlement_drafts),
    'newReceipts',(select count(*)from app.operation_receipts where operation_type='save_event_settlement_draft_v5'),
    'oldReceipts',(select count(*)from app.operation_receipts where operation_type='save_standard_singles_settlement_draft_v1'),
    'newConflicts',(select count(*)from app.event_settlement_conflicts_v5),
    'oldConflicts',(select count(*)from app.standard_singles_settlement_conflicts),
    'newReceiptAudits',(select count(*)from app.audit_events a join app.operation_receipts r on r.id=a.operation_receipt_id where r.operation_type='save_event_settlement_draft_v5'),
    'newConflictAudits',(select count(*)from app.audit_events where action='settlement_idempotency_conflict')
  );`));
}

const evidence = [];

{
  const { request } = setup();
  const [first, second] = await race(callV5(actor, operation(10), request), callV5(actor, operation(10), request));
  const state = counts();
  if (JSON.stringify(first) !== JSON.stringify(second) || first.status !== "settlement_draft_saved_v5" || state.newDrafts !== 1 || state.newReceipts !== 1 || state.newReceiptAudits !== 1) {
    throw new Error("Exact concurrent draft replay conservation failed");
  }
  evidence.push({ scenario: "exact-v5-replay", first, second, state });
}

{
  const { request } = setup();
  const changed = { ...request, officialSourceReference: "TEST ONLY changed concurrent source review" };
  const [first, second] = await race(callV5(actor, operation(11), request), callV5(actor, operation(11), changed));
  const state = counts();
  if ([first, second].filter((result) => result.status === "settlement_draft_saved_v5").length !== 1 || ![first, second].some((result) => result.code === "idempotency_conflict") || state.newDrafts !== 1 || state.newReceipts !== 1 || state.newConflicts !== 1 || state.newConflictAudits !== 1) {
    throw new Error("Changed concurrent operation conflict conservation failed");
  }
  evidence.push({ scenario: "changed-v5-replay", first, second, state });
}

{
  const { request } = setup();
  const [first, second] = await race(callV5(actor, operation(12), request), callV5(coDirector, operation(13), request));
  const state = counts();
  if ([first, second].filter((result) => result.status === "settlement_draft_saved_v5").length !== 1 || ![first, second].some((result) => result.code === "stale_version") || state.newDrafts !== 1 || state.newReceipts !== 2 || state.newReceiptAudits !== 2) {
    throw new Error("Competing director draft conservation failed");
  }
  evidence.push({ scenario: "competing-directors", first, second, state });
}

{
  const { request } = setup();
  const [first, second] = await race(callLegacyV1(actor, operation(14)), callV5(coDirector, operation(15), request));
  const state = counts();
  const accepted = [first, second].filter((result) => ["settlement_draft_saved", "settlement_draft_saved_v5"].includes(result.status));
  const rejected = [first, second].filter((result) => ["stale_version", "settlement_domain_conflict"].includes(result.code));
  if (accepted.length !== 1 || rejected.length !== 1 || state.newDrafts + state.oldDrafts !== 1 || state.newReceipts + state.oldReceipts !== 2) {
    throw new Error("Legacy/new settlement domain race conservation failed");
  }
  evidence.push({ scenario: "legacy-v1-versus-v5", first, second, state });
}

{
  const { request } = setup();
  const accepted = jsonResult(sql(`set request.jwt.claim.role='service_role';${callV5(actor, operation(16), request)}`));
  if (accepted.status !== "settlement_draft_saved_v5") throw new Error("V5 prerequisite write failed");
  const [first, second] = await race(callLegacyV1(coDirector, operation(17)), callLegacyV1(coDirector, operation(17)));
  const state = counts();
  if (JSON.stringify(first) !== JSON.stringify(second) || first.code !== "settlement_domain_conflict" || state.newDrafts !== 1 || state.oldDrafts !== 0 || state.oldReceipts !== 1 || state.oldConflicts !== 0) {
    throw new Error("Concurrent rejected legacy replay conservation failed");
  }
  evidence.push({ scenario: "legacy-rejected-exact-replay", first, second, state });
}

fs.mkdirSync("test-results", { recursive: true });
fs.writeFileSync("test-results/versioned-settlement-v5-concurrency.json", JSON.stringify(evidence, null, 2));
for (const item of evidence) console.log(`${item.scenario} PASS ${JSON.stringify(item.state)}`);
