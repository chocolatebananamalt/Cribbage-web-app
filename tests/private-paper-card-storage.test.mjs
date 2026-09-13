import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PAPER_CARD_BUCKET, PAPER_CARD_MAX_BYTES, paperCardStorageEnabled } from "../src/lib/paper-games/private-card-storage.ts";

test("private paper-card storage is gated and uses the approved fixed bucket", () => {
  assert.equal(PAPER_CARD_BUCKET, "paper-scorecards-private");
  assert.equal(PAPER_CARD_MAX_BYTES, 10 * 1024 * 1024);
  assert.equal(paperCardStorageEnabled({}), false);
  assert.equal(paperCardStorageEnabled({ ACC_PAPER_CARD_CAPTURE_ENABLED: "enabled" }), true);
  assert.equal(paperCardStorageEnabled({ ACC_PAPER_CARD_CAPTURE_ENABLED: "enabled", SUPABASE_PAPER_CARD_BUCKET: "wrong" }), false);
});

test("migration creates a private restricted bucket and no browser storage policy", () => {
  const sql = fs.readFileSync(new URL("../database/migrations/0155_private_paper_card_storage.sql", import.meta.url), "utf8");
  assert.match(sql, /paper-scorecards-private[\s\S]+false[\s\S]+10485760/);
  assert.match(sql, /image\/jpeg[\s\S]+image\/png[\s\S]+image\/webp/);
  assert.doesNotMatch(sql, /create\s+policy/i);
  assert.match(sql, /paper_card_storage_receipts_immutable/);
  assert.match(sql, /retention_state = 'restricted_hold'/);
  assert.match(sql, /grant execute on function public\.authorize_paper_card_upload_v1[\s\S]+to service_role/);
  assert.match(sql, /grant execute on function public\.record_paper_card_storage_receipt_v1[\s\S]+to service_role/);
});

test("repair migration normalizes hostile bucket state and separates issuance from replay authorization", () => {
  const sql = fs.readFileSync(new URL("../database/migrations/0159_pilot_storage_and_payment_projection_repairs.sql", import.meta.url), "utf8");
  assert.match(sql, /update storage\.buckets[\s\S]+public = false[\s\S]+file_size_limit = 10485760/);
  assert.match(sql, /cardinality\(allowed_mime_types\) = 3/);
  assert.match(sql, /authorize_paper_card_upload_v1[\s\S]+active_role\.role = 'cross_checker'[\s\S]+not exists/);
  assert.match(sql, /authorize_paper_card_upload_completion_v1[\s\S]+active_role\.role = 'cross_checker'/);
  assert.match(sql, /record_paper_card_storage_receipt_v1[\s\S]+authorize_paper_card_upload_completion_v1/);
  assert.match(sql, /paper-card-storage:[\s\S]+pg_advisory_xact_lock/);
});

test("storage, OCR, and obligation foreign keys have covering indexes", () => {
  const sql = fs.readFileSync(new URL("../database/migrations/0160_pilot_storage_and_payment_fk_indexes.sql", import.meta.url), "utf8");
  assert.match(sql, /paper_card_ocr_attempts\(storage_receipt_id,tournament_id\)/);
  assert.match(sql, /paper_card_storage_access_events\(storage_receipt_id,tournament_id\)/);
  assert.match(sql, /paper_card_storage_receipts\(capture_id,tournament_id,event_id,canonical_game_id\)/);
  assert.match(sql, /paper_card_transcription_draft_versions\(ocr_attempt_id,tournament_id\)/);
  assert.match(sql, /roster_payment_obligation_versions\(roster_entry_id,tournament_id\)/);
});
