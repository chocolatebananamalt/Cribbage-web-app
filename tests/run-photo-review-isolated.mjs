// Existing SQL fixtures against a hash-checked empty baseline and exact disposable container.
import fs from "node:fs";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
const container = "cribbage-photo-local", database = "photo_fixture";
const expected = process.argv[2];
if (!/^[a-f0-9]{64}$/.test(expected ?? "")) throw Error("Exact disposable container ID required");
function docker(args, input) {
  const result = spawnSync("docker", ["--context", "desktop-linux", ...args], { input, encoding: Buffer.isBuffer(input) ? undefined : "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw Error(String(result.stderr));
  return String(result.stdout);
}
const meta = JSON.parse(docker(["inspect", container]))[0];
if (meta.Id !== expected || meta.State.Status !== "running" || meta.Config.Labels["codex.fixture"] !== container || meta.Image !== "sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706" || meta.HostConfig.NetworkMode !== "none" || Object.keys(meta.HostConfig.PortBindings ?? {}).length || meta.Mounts.length || meta.HostConfig.Privileged) throw Error("Isolation mismatch");
const sql = (query, db = database) => docker(["exec", "-i", container, "psql", "-h", "/tmp", "-X", "-qAt", "-U", "supabase_admin", "-d", db, "-v", "ON_ERROR_STOP=1"], query);
const baseline = fs.readFileSync("../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump");
if (crypto.createHash("sha256").update(baseline).digest("hex") !== "e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc") throw Error("Baseline mismatch");
const toc = docker(["exec", "-i", container, "pg_restore", "--list"], baseline);
const owners = toc.split("\n").filter(line => !line.startsWith(";")).map(line => line.trim().split(/\s+/).at(-1)).filter(value => value?.startsWith("supabase_") || ["postgres", "pgbouncer"].includes(value));
for (const owner of new Set([...owners, "anon", "authenticated", "service_role", "authenticator", "dashboard_user", "pgbouncer"])) {
  if (!/^(?:postgres|pgbouncer|anon|authenticated|service_role|authenticator|dashboard_user|supabase_[a-z_]+)$/.test(owner)) throw Error("Invalid owner");
  sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='${owner}') then create role ${owner} ${owner === "postgres" ? "superuser" : "nologin"};end if;end $$;`, "postgres");
}
if (sql("select count(*) from pg_database where datname='photo_fixture'", "postgres").trim() !== "0") throw Error("Fixture already exists; inspect before retry");
docker(["exec", container, "createdb", "-h", "/tmp", "-U", "supabase_admin", "-O", "postgres", "--template=template0", database]);
docker(["exec", "-i", container, "pg_restore", "-h", "/tmp", "--exit-on-error", "-U", "supabase_admin", "-d", database], baseline);
for (const prefix of ["0237", "0238", "0239", "0240", "0241", "0242", "0243"]) {
  const name = fs.readdirSync("database/migrations").find(value => value.startsWith(prefix + "_"));
  sql("set role postgres;\n" + fs.readFileSync("database/migrations/" + name, "utf8"));
}
for (const name of ["paper-card-capture.sql", "hybrid-digital-paper-minimum-officials.sql"]) {
  const source = fs.readFileSync("tests/" + name, "utf8");
  if (!/rollback;\s*$/.test(source)) throw Error("Rollback required");
  const output = sql("set role postgres;\n" + source);
  fs.writeFileSync("test-results/photo-local-" + name + ".log", output);
  console.log("PASS real rollback SQL", name);
}
console.log("Rollback counts", sql("select (select count(*) from auth.users),(select count(*) from app.tournaments)"));
