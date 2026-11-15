import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const acc = await import(pathToFileURL(path.join(root, "src/lib/acc-number.ts")).href);
const eventCheckIn = await import(pathToFileURL(path.join(root, "src/lib/api/event-check-in.ts")).href);

test("adult and youth ACC numbers validate and share an identity key", () => {
  assert.equal(acc.isAccNumber("HI296"), true);
  assert.equal(acc.isAccNumber("HI296Y"), true);
  assert.equal(acc.accIdentityKey("HI296Y"), "HI296");
  assert.equal(acc.accIdentityKey("HI296"), "HI296");
  assert.equal(acc.normalizeAccNumberInput("hi 296y"), "HI296Y");
  assert.equal(acc.normalizeAccNumberInput("hi-296y"), "HI-296Y");
  assert.equal(acc.isAccNumber(acc.normalizeAccNumberInput("hi-296y")), false);
  for (const invalid of ["HI296YY", "HIY296", "HI-296Y", "HI 296Y"]) assert.equal(acc.isAccNumber(invalid), false);
});

test("event QR completion accepts a youth number but rejects malformed values", () => {
  const valid = { completionSession: "0f2f2d31-12ab-4bcd-8b8c-1234567890ab.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", firstName: "Youth", lastName: "Player", email: "youth@example.test", accNumber: "HI296Y" };
  assert.equal(eventCheckIn.isEventCheckInRequest(valid), true);
  assert.equal(eventCheckIn.isEventCheckInRequest({ ...valid, accNumber: "HI296YY" }), false);
});

test("database support preserves youth display values and matches youth/adult values as one identity", async () => {
  const sql = await readFile(path.join(root, "database/migrations/0210_youth_acc_number_support.sql"), "utf8");
  assert.match(sql, /\^\[A-Z\]\{2\}\[0-9\]\+Y\?\$/);
  assert.match(sql, /acc_identity_key/);
  assert.match(sql, /claimed_acc_identity_key/);
  assert.match(sql, /regexp_replace\(.*'Y\$'/s);
  assert.match(sql, /youth\/adult ACC identity collision requires roster review/);
  assert.match(sql, /coalesce\(r\.claimed_acc_identity_key,app\.acc_identity_key_v1\(r\.claimed_normalized_acc_number\)\)=app\.acc_identity_key_v1\(v_acc\)/);
});
