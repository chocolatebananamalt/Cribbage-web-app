import assert from "node:assert/strict";
import test from "node:test";
import { extractPaperCardDraft, isOcrDraft } from "../src/lib/paper-games/openai-ocr.ts";

const valid = { authoritative: false, humanReviewRequired: true, sourceImageQuality: "uncertain", playerName: "Sample Player", verificationId: "A-7", rows: [{ gameNumber: 1, gamePoints: 2, plusPoints: 15, minusPoints: null, opponentName: "Example Opponent", opponentVerificationId: "B-4", confidence: 0.78 }], warnings: ["Confirm handwritten opponent ID"] };

test("OCR drafts cannot claim authority and reject impossible or ambiguous score cells", () => {
  assert.equal(isOcrDraft(valid), true);
  assert.equal(isOcrDraft({ ...valid, authoritative: true }), false);
  assert.equal(isOcrDraft({ ...valid, rows: [{ ...valid.rows[0], plusPoints: 122 }] }), false);
  assert.equal(isOcrDraft({ ...valid, rows: [{ ...valid.rows[0], minusPoints: 15 }] }), false);
  assert.equal(isOcrDraft({ ...valid, rows: [valid.rows[0], valid.rows[0]] }), false);
});

test("OpenAI OCR request is server-gated, non-retained, image-based, and strictly structured", async () => {
  let request;
  const result = await extractPaperCardDraft({ bytes: new Uint8Array([1,2,3]), mediaType: "image/jpeg" }, {
    env: { ACC_PAPER_CARD_OCR_ENABLED: "enabled", ACC_OCR_PROVIDER: "openai", ACC_OCR_EXECUTION_MODE: "external", OCR_PROVIDER_API_KEY: "test-only" },
    fetchImpl: async (_url, init) => { request = JSON.parse(init.body); return new Response(JSON.stringify({ id: "resp_test", output_text: JSON.stringify(valid) }), { status: 200, headers: { "content-type": "application/json" } }); },
  });
  assert.equal(request.store, false);
  assert.equal(request.max_output_tokens, 5000);
  assert.equal(request.input[0].content[1].type, "input_image");
  assert.match(request.input[0].content[1].image_url, /^data:image\/jpeg;base64,/);
  assert.equal(request.text.format.strict, true);
  assert.equal(result.draft.humanReviewRequired, true);
});

test("OCR remains default-off and false reads fail closed", async () => {
  await assert.rejects(() => extractPaperCardDraft({ bytes: new Uint8Array([1]), mediaType: "image/png" }, { env: {} }), /disabled/);
  await assert.rejects(() => extractPaperCardDraft({ bytes: new Uint8Array([1]), mediaType: "image/png" }, {
    env: { ACC_PAPER_CARD_OCR_ENABLED: "enabled", ACC_OCR_PROVIDER: "openai", ACC_OCR_EXECUTION_MODE: "external", OCR_PROVIDER_API_KEY: "test-only" },
    fetchImpl: async () => new Response(JSON.stringify({ id: "resp_bad", output_text: JSON.stringify({ ...valid, authoritative: true }) }), { status: 200 }),
  }), /failed validation/);
  await assert.rejects(() => extractPaperCardDraft({ bytes: new Uint8Array(10 * 1024 * 1024 + 1), mediaType: "image/png" }, {
    env: { ACC_PAPER_CARD_OCR_ENABLED: "enabled", ACC_OCR_PROVIDER: "openai", ACC_OCR_EXECUTION_MODE: "external", OCR_PROVIDER_API_KEY: "test-only" },
    fetchImpl: async () => new Response("{}", { status: 200 }),
  }), /input is invalid/);
});
