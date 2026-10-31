// Explicit local-only rollback proof; never connects to a hosted database.
import fs from "node:fs";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (!args.includes("--isolated-container")) throw new Error("Explicit --isolated-container required");
if (new Set(args).size !== args.length || args.some(arg => !["--isolated-container", "--prize-pool"].includes(arg))) {
  throw new Error("Only one --isolated-container and optional --prize-pool are accepted");
}
const prizePool = args.includes("--prize-pool");
const fixturePath = prizePool ? "tests/prize-pool-settlement-v5.sql" : "tests/funded-settlement-v5.sql";
const logStem = prizePool ? "prize-pool-settlement-v5" : "funded-settlement-v5";
const expectedMarker = prizePool
  ? "PRIZE_POOL_SETTLEMENT_V5_CONSERVATION_NEGATIVES_AND_PENDING_POLICY_PASSED"
  : "FUNDED_SETTLEMENT_V5_SUPPORTED_LEDGER_AND_FINALIZATION_PASSED";
const container = "cribbage-0240-isolated", database = "fixture_0240";
const image = "public.ecr.aws/supabase/postgres:17.11.0.004";
function docker(args, input) {
  const result = spawnSync("docker", ["--context", "desktop-linux", ...args], {
    input, encoding: Buffer.isBuffer(input) ? undefined : "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(String(result.stderr));
  return String(result.stdout);
}
const metadata = JSON.parse(docker(["inspect", container]))[0];
if (metadata.Config.Labels["codex.fixture"] !== container || metadata.Config.Image !== image
  || metadata.Image !== "sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706"
  || metadata.HostConfig.NetworkMode !== "none" || Object.keys(metadata.HostConfig.PortBindings ?? {}).length
  || metadata.HostConfig.Binds?.length || metadata.Mounts.length !== 0 || metadata.HostConfig.Privileged) {
  throw new Error("Reviewed disposable container isolation mismatch");
}
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const baseline = fs.readFileSync("../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump");
if (hash(baseline) !== "e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc") throw new Error("Empty baseline hash mismatch");
const canonical = fs.readFileSync("database/migrations/0240_versioned_settlement_v5.sql", "utf8");
if (hash(canonical.replaceAll("\r\n", "\n")) !== "19107d90cc6c86fbf3497bb7bd0f28ad19c07f48f0393eb0ee0d9e693f40b701") throw new Error("Reviewed canonical migration changed");
const sql = (query, db = database) => docker(["exec", "-i", container, "psql", "-X", "-qAt", "-U", "supabase_admin", "-d", db, "-v", "ON_ERROR_STOP=1"], query);
const exists = sql(`select count(*) from pg_database where datname='${database}';`, "postgres").trim() === "1";
if (exists && sql("select (select count(*) from auth.users)+(select count(*) from app.tournaments);").trim() !== "0") throw new Error("Existing fixture is not empty; inspect before reset");
const toc = docker(["exec", "-i", container, "pg_restore", "--list"], baseline);
const owners = [...new Set(toc.split("\n").filter(s => !s.startsWith(";")).map(s => s.trim().split(/\s+/).at(-1)).filter(s => s?.startsWith("supabase_")))];
for (const owner of owners) {
  if (!/^supabase_[a-z_]+$/.test(owner)) throw new Error("Unexpected baseline role");
  sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='${owner}') then create role ${owner} nologin; end if; end $$;`, "postgres");
}
docker(["exec", container, "dropdb", "-U", "supabase_admin", "--if-exists", database]);
docker(["exec", container, "createdb", "-U", "supabase_admin", "-O", "postgres", "--template=template0", database]);
fs.mkdirSync("test-results", { recursive: true });
fs.writeFileSync(`test-results/${logStem}-restore.log`, docker(["exec", "-i", container, "pg_restore", "--exit-on-error", "-U", "supabase_admin", "-d", database], baseline));
for (const prefix of ["0237", "0238", "0239"]) {
  const migration = fs.readdirSync("database/migrations").find(name => name.startsWith(`${prefix}_`));
  if (!migration) throw new Error("Missing reviewed prerequisite");
  sql(`set role postgres;\n${fs.readFileSync(`database/migrations/${migration}`, "utf8")}`);
}
let fixture = fs.readFileSync(fixturePath, "utf8");
const include = "\\ir ../database/migrations/0240_versioned_settlement_v5.sql";
if (fixture.split(include).length !== 2 || !/\brollback;\s*$/i.test(fixture) || !fixture.includes(expectedMarker)) {
  throw new Error("Expected one canonical include, selected fixture marker, and final rollback");
}
fixture = fixture.replace(include, () => canonical);
if (/^\s*\\i/m.test(fixture)) throw new Error("Unreviewed psql include");
try {
  const output = sql(`set role postgres;\n${fixture}`);
  fs.writeFileSync(`test-results/${logStem}.log`, output);
  console.log(output);
} catch (error) {
  fs.writeFileSync(`test-results/${logStem}.log`, String(error));
  throw error;
} finally {
  const remaining = sql("select (select count(*) from auth.users),(select count(*) from app.tournaments);").trim();
  console.log(`Rollback remaining users|tournaments: ${remaining}`);
  if (remaining !== "0|0") throw new Error("Fixture did not leave the database empty");
}
