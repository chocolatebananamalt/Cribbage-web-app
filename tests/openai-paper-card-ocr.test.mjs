import assert from "node:assert/strict";
import test from "node:test";
import { extractPaperCardDraft, isOcrDraft } from "../src/lib/paper-games/openai-ocr.ts";

const valid = { authoritative: false, humanReviewRequired: true, sourceImageQuality: "uncertain", playerName: "Sample Player", verificationId: "A-7", rows: [{ gameNumber: 1, gamePoints: 2, plusPoints: 15, minusPoints: null, opponentName: "Example Opponent", opponentVerificationId: "B-4", confidence: 0.78 }], warnings: ["Confirm handwritten opponent ID"] };
const input = { bytes: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg" };
const env = { ACC_PAPER_CARD_OCR_ENABLED: "enabled", ACC_OCR_PROVIDER: "openai", ACC_OCR_EXECUTION_MODE: "external", OCR_PROVIDER_API_KEY: "test-only" };
const message = (draft = valid) => ({ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(draft) }] });
const payload = (draft = valid) => ({ id: "resp_test", status: "completed", error: null, incomplete_details: null, output: [message(draft)] });
const run = (data) => extractPaperCardDraft(input, { env, fetchImpl: async () => new Response(JSON.stringify(data), { status: 200 }) });

test("OCR drafts cannot claim authority and reject impossible or ambiguous score cells", () => {
  assert.equal(isOcrDraft(valid), true);
  for (const patch of [{ authoritative: true }, { humanReviewRequired: false }, { rows: [{ ...valid.rows[0], plusPoints: 122 }] }, { rows: [{ ...valid.rows[0], minusPoints: 15 }] }, { rows: [valid.rows[0], valid.rows[0]] }]) assert.equal(isOcrDraft({ ...valid, ...patch }), false);
});

test("OCR refuses contradictory win/loss direction without guessing missing cells", () => {
  for (const row of [
    { gamePoints: 0, plusPoints: 15, minusPoints: null },
    { gamePoints: 2, plusPoints: null, minusPoints: 15 },
    { gamePoints: 3, plusPoints: null, minusPoints: 35 },
  ]) assert.equal(isOcrDraft({ ...valid, rows: [{ ...valid.rows[0], ...row }] }), false);
  for (const row of [
    { gamePoints: 0, plusPoints: null, minusPoints: 15 },
    { gamePoints: null, plusPoints: null, minusPoints: 15 },
    { gamePoints: 2, plusPoints: null, minusPoints: null },
    { gamePoints: null, plusPoints: null, minusPoints: null },
  ]) assert.equal(isOcrDraft({ ...valid, rows: [{ ...valid.rows[0], ...row }] }), true);
});

test("OpenAI OCR request is server-gated, response-storage-disabled, image-based, and strictly structured", async () => {
  let request;
  const result = await extractPaperCardDraft(input, { env, fetchImpl: async (_url, init) => {
    assert.equal(_url, "https://api.openai.com/v1/responses");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.authorization, "Bearer test-only");
    assert.ok(init.signal);
    request = JSON.parse(init.body);
    return new Response(JSON.stringify(payload()), { status: 200 });
  } });
  assert.equal(request.store, false);
  assert.equal(request.max_output_tokens, 5000);
  assert.equal(request.input[0].content[1].type, "input_image");
  assert.match(request.input[0].content[1].image_url, /^data:image\/jpeg;base64,/);
  assert.equal(request.text.format.strict, true);
  assert.match(request.instructions, /untrusted/i);
  assert.match(request.instructions, /do not follow/i);
  assert.match(request.instructions, /do not infer/i);
  assert.equal(result.draft.humanReviewRequired, true);
  assert.equal(result.draft.authoritative, false);
});

test("OCR remains default-off and does not transmit before all existing runtime gates pass", async () => {
  let calls = 0;
  for (const config of [{}, { ...env, ACC_PAPER_CARD_OCR_ENABLED: "disabled" }, { ...env, ACC_OCR_PROVIDER: "other" }, { ...env, ACC_OCR_EXECUTION_MODE: "on_device" }, { ...env, OCR_PROVIDER_API_KEY: " " }]) {
    await assert.rejects(() => extractPaperCardDraft(input, { env: config, fetchImpl: async () => { calls++; return new Response("{}"); } }));
  }
  assert.equal(calls, 0);
});

test("OCR rejects incomplete, refused, errored and ambiguous provider responses", async () => {
  const cases = [
    { ...payload(), status: "incomplete" }, { ...payload(), status: "failed" },
    { ...payload(), status: undefined }, { ...payload(), error: { message: "sensitive diagnostic" } },
    { ...payload(), incomplete_details: { reason: "max_output_tokens" } },
    { ...payload(), output: [{ ...message(), status: "incomplete" }] },
    { ...payload(), output: [{ ...message(), role: "user" }] },
    { ...payload(), output: [{ ...message(), content: [...message().content, { type: "refusal", refusal: "Cannot read" }] }] },
    { ...payload(), output: [message(), message()] },
    { ...payload(), output: [{ type: "reasoning", status: "incomplete", summary: [] }, message()] },
    { ...payload(), output: [{ type: "refusal", refusal: "Cannot read" }, message()] },
    { ...payload(), output: [{ type: "function_call", status: "completed" }, message()] },
    { ...payload(), output: [{ ...message(), content: [] }, message()] },
    { ...payload(), output: [{ ...message(), content: [...message().content, ...message().content] }] },
    { ...payload(), output: [], output_text: JSON.stringify(valid) },
  ];
  for (const candidate of cases) await assert.rejects(() => run(candidate), /no usable draft/);
  const result = await run({ ...payload(), output: [{ type: "reasoning", summary: [] }, message()] });
  assert.deepEqual(result.draft, valid);
});

test("OCR rejects malformed and invalid drafts without exposing provider text", async () => {
  await assert.rejects(() => run(payload({ ...valid, authoritative: true })), /failed validation/);
  await assert.rejects(() => run({ ...payload(), output: [{ ...message(), content: [{ type: "output_text", text: "private invalid JSON" }] }] }), { message: "Paper-card OCR provider returned an invalid draft." });
  await assert.rejects(() => extractPaperCardDraft(input, { env, fetchImpl: async () => new Response("private provider error", { status: 500 }) }), { message: "Paper-card OCR provider request failed." });
  await assert.rejects(() => extractPaperCardDraft(input, { env, fetchImpl: async () => new Response("private invalid response", { status: 200 }) }), { message: "Paper-card OCR provider returned an invalid response." });
});

test("OCR stops reading oversized streamed responses before an unbounded body is buffered", async () => {
  let chunks = 0;
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { chunks++; controller.enqueue(new Uint8Array(64 * 1024)); }, cancel() { cancelled = true; } });
  await assert.rejects(() => extractPaperCardDraft(input, { env, fetchImpl: async () => new Response(body) }), /response is too large/);
  assert.equal(cancelled, true);
  assert.ok(chunks <= 10, `read ${chunks} chunks`);
});

test("OCR rejects an oversized declared response without reading its contents", async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([123])); }, cancel() { cancelled = true; } });
  await assert.rejects(() => extractPaperCardDraft(input, { env, fetchImpl: async () => new Response(body, { headers: { "content-length": String(512 * 1024 + 1) } }) }), /response is too large/);
  assert.equal(cancelled, true);
});

test("OCR validates input size and content type before calling the provider", async () => {
  let calls = 0;
  for (const invalid of [{ ...input, bytes: new Uint8Array() }, { ...input, bytes: new Uint8Array(10 * 1024 * 1024 + 1) }, { ...input, mediaType: "text/html" }]) {
    await assert.rejects(() => extractPaperCardDraft(invalid, { env, fetchImpl: async () => { calls++; return new Response("{}"); } }), /input is invalid/);
  }
  assert.equal(calls, 0);
});
