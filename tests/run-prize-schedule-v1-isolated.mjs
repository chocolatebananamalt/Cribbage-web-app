// Explicit local-only rollback proof; never connects to a hosted database.
import crypto from "node:crypto";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

if (process.argv.length !== 5 || process.argv[2] !== "--isolated-container" || process.argv[3] !== "--container-id" || !/^[a-f0-9]{64}$/.test(process.argv[4])) {
  throw new Error("Exact --isolated-container --container-id <64 lowercase hex> required");
}

const container = "cribbage-0240-isolated";
const expectedContainerId = process.argv[4];
const database = "fixture_0240";
const image = "public.ecr.aws/supabase/postgres:17.11.0.004";
const expectedImageId = "sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706";
const marker = "PRIZE_SCHEDULE_V1_SUPPORTED_RESOLUTION_PAYBACK_AND_FINAL_PASSED";
const normalizedHash = value => crypto.createHash("sha256").update(value.replaceAll("\r\n", "\n")).digest("hex");

function docker(args, input) {
  const result = spawnSync("docker", ["--context", "desktop-linux", ...args], {
    input,
    encoding: Buffer.isBuffer(input) ? undefined : "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(String(result.stderr));
  return { stdout: String(result.stdout), stderr: String(result.stderr) };
}

const metadata = JSON.parse(docker(["inspect", container]).stdout)[0];
if (metadata.Id !== expectedContainerId || metadata.State.Status !== "running"
  || metadata.Config.Labels["codex.fixture"] !== container || metadata.Config.Image !== image
  || metadata.Image !== expectedImageId || metadata.HostConfig.NetworkMode !== "none"
  || Object.keys(metadata.HostConfig.PortBindings ?? {}).length || metadata.HostConfig.Binds?.length
  || metadata.Mounts.length !== 0 || metadata.HostConfig.Privileged) {
  throw new Error("Reviewed disposable container isolation mismatch");
}

const baseline = fs.readFileSync("../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump");
if (crypto.createHash("sha256").update(baseline).digest("hex") !== "e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc") {
  throw new Error("Empty baseline hash mismatch");
}
const canonical = fs.readFileSync("database/migrations/0240_versioned_settlement_v5.sql", "utf8");
const payback = fs.readFileSync("docs/quality/2026-10-27-proposed-payback-review-v1.sql", "utf8");
const schedule = fs.readFileSync("docs/quality/2026-10-27-proposed-prize-schedule-v1.sql", "utf8");
const actualHashes = [normalizedHash(canonical), normalizedHash(payback), normalizedHash(schedule)];
const expectedHashes = [
  "19107d90cc6c86fbf3497bb7bd0f28ad19c07f48f0393eb0ee0d9e693f40b701",
  "46c14bb2b7ad9e2f5ba27e78997043f6b9503801eb3503234db24017d41abca9",
  "4b93e65892a6ca7293a7485df600ee1d16340823312686b7bdcb6caa75971f2b",
];
if (actualHashes.some((value, index) => value !== expectedHashes[index])) {
  throw new Error(`Reviewed SQL hash mismatch: ${actualHashes.join(",")}`);
}

const sql = (query, db = database) => docker(["exec", "-i", container, "psql", "-X", "-qAt", "-U", "supabase_admin", "-d", db, "-v", "ON_ERROR_STOP=1"], query);
const exists = sql(`select count(*) from pg_database where datname='${database}';`, "postgres").stdout.trim() === "1";
if (exists && sql("select (select count(*) from auth.users)+(select count(*) from app.tournaments);").stdout.trim() !== "0") {
  throw new Error("Existing fixture is not empty; inspect before reset");
}
const toc = docker(["exec", "-i", container, "pg_restore", "--list"], baseline).stdout;
const owners = [...new Set(toc.split("\n").filter(line => !line.startsWith(";"))
  .map(line => line.trim().split(/\s+/).at(-1)).filter(owner => owner?.startsWith("supabase_")))];
for (const owner of owners) {
  if (!/^supabase_[a-z_]+$/.test(owner)) throw new Error("Unexpected baseline role");
  sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='${owner}') then create role ${owner} nologin; end if; end $$;`, "postgres");
}
docker(["exec", container, "dropdb", "-U", "supabase_admin", "--if-exists", database]);
docker(["exec", container, "createdb", "-U", "supabase_admin", "-O", "postgres", "--template=template0", database]);
fs.mkdirSync("test-results", { recursive: true });
fs.writeFileSync("test-results/prize-schedule-v1-restore.log", docker(["exec", "-i", container, "pg_restore", "--exit-on-error", "-U", "supabase_admin", "-d", database], baseline).stdout);
for (const prefix of ["0237", "0238", "0239"]) {
  const migration = fs.readdirSync("database/migrations").find(name => name.startsWith(`${prefix}_`));
  if (!migration) throw new Error(`Missing prerequisite ${prefix}`);
  sql(`set role postgres;\n${fs.readFileSync(`database/migrations/${migration}`, "utf8")}`);
}

let fixture = fs.readFileSync("tests/prize-schedule-v1.sql", "utf8");
const includes = [
  ["\\ir ../database/migrations/0240_versioned_settlement_v5.sql", canonical],
  ["\\ir ../docs/quality/2026-10-27-proposed-payback-review-v1.sql", payback],
  ["\\ir ../docs/quality/2026-10-27-proposed-prize-schedule-v1.sql", schedule],
];
for (const [include, source] of includes) {
  if (fixture.split(include).length !== 2) throw new Error(`Expected one include: ${include}`);
  fixture = fixture.replace(include, () => source);
}
if (!fixture.includes(marker) || !/\brollback;\s*$/i.test(fixture) || /^\s*\\i/m.test(fixture)) {
  throw new Error("Fixture marker, rollback, or include guard mismatch");
}
try {
  const result = sql(`set role postgres;\n${fixture}`);
  const output = `${result.stdout}${result.stderr}`;
  fs.writeFileSync("test-results/prize-schedule-v1.log", output);
  if (!output.includes(marker)) throw new Error("Fixture success marker missing");
  console.log(output);
} catch (error) {
  fs.writeFileSync("test-results/prize-schedule-v1.log", String(error));
  throw error;
} finally {
  const remaining = sql("select (select count(*) from auth.users),(select count(*) from app.tournaments);").stdout.trim();
  console.log(`Rollback remaining users|tournaments: ${remaining}`);
  if (remaining !== "0|0") throw new Error("Fixture did not leave the database empty");
}
