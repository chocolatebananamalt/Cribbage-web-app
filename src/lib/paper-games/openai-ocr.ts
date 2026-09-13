import "server-only";

const scorecardSchema = {
  type: "object",
  additionalProperties: false,
  required: ["authoritative", "humanReviewRequired", "sourceImageQuality", "playerName", "verificationId", "rows", "warnings"],
  properties: {
    authoritative: { type: "boolean", const: false },
    humanReviewRequired: { type: "boolean", const: true },
    sourceImageQuality: { type: "string", enum: ["readable", "uncertain", "unreadable"] },
    playerName: { type: ["string", "null"] },
    verificationId: { type: ["string", "null"] },
    rows: {
      type: "array", maxItems: 22, items: {
        type: "object", additionalProperties: false,
        required: ["gameNumber", "gamePoints", "plusPoints", "minusPoints", "opponentName", "opponentVerificationId", "confidence"],
        properties: {
          gameNumber: { type: "integer", minimum: 1, maximum: 22 },
          gamePoints: { type: ["integer", "null"], enum: [0, 2, 3, null] },
          plusPoints: { type: ["integer", "null"], minimum: 1, maximum: 121 },
          minusPoints: { type: ["integer", "null"], minimum: 1, maximum: 121 },
          opponentName: { type: ["string", "null"] },
          opponentVerificationId: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" }, maxItems: 50 },
  },
} as const;

export type OcrDraft = {
  authoritative: false; humanReviewRequired: true; sourceImageQuality: "readable" | "uncertain" | "unreadable";
  playerName: string | null; verificationId: string | null;
  rows: Array<{ gameNumber: number; gamePoints: 0 | 2 | 3 | null; plusPoints: number | null; minusPoints: number | null; opponentName: string | null; opponentVerificationId: string | null; confidence: number }>;
  warnings: string[];
};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);
const boundedText = (value: unknown, maximum: number) => typeof value === "string" && value.length <= maximum && new TextEncoder().encode(value).length <= maximum * 4;

export function isOcrDraft(value: unknown): value is OcrDraft {
  if (!object(value) || !exact(value, ["authoritative", "humanReviewRequired", "sourceImageQuality", "playerName", "verificationId", "rows", "warnings"])) return false;
  if (value.authoritative !== false || value.humanReviewRequired !== true || !["readable","uncertain","unreadable"].includes(value.sourceImageQuality as string)) return false;
  if (!(value.playerName === null || boundedText(value.playerName, 200)) || !(value.verificationId === null || (typeof value.verificationId === "string" && /^[A-Z]-[1-9]\d*$/.test(value.verificationId)))) return false;
  if (!Array.isArray(value.warnings) || value.warnings.length > 50 || !value.warnings.every((warning) => boundedText(warning, 500))) return false;
  if (!Array.isArray(value.rows) || value.rows.length > 22) return false;
  const games = new Set<number>();
  return value.rows.every((candidate) => {
    if (!object(candidate) || !exact(candidate, ["gameNumber","gamePoints","plusPoints","minusPoints","opponentName","opponentVerificationId","confidence"])) return false;
    const game = candidate.gameNumber;
    if (!Number.isInteger(game) || (game as number) < 1 || (game as number) > 22 || games.has(game as number)) return false;
    games.add(game as number);
    const point = (entry: unknown) => entry === null || (Number.isInteger(entry) && (entry as number) >= 1 && (entry as number) <= 121);
    return [0,2,3,null].includes(candidate.gamePoints as 0 | 2 | 3 | null) && point(candidate.plusPoints) && point(candidate.minusPoints)
      && !(candidate.plusPoints !== null && candidate.minusPoints !== null)
      && (candidate.opponentName === null || boundedText(candidate.opponentName, 200))
      && (candidate.opponentVerificationId === null || (typeof candidate.opponentVerificationId === "string" && /^[A-Z]-[1-9]\d*$/.test(candidate.opponentVerificationId)))
      && typeof candidate.confidence === "number" && candidate.confidence >= 0 && candidate.confidence <= 1;
  });
}

function outputText(value: unknown) {
  if (!object(value)) return null;
  if (typeof value.output_text === "string") return value.output_text;
  if (!Array.isArray(value.output)) return null;
  for (const item of value.output) if (object(item) && Array.isArray(item.content)) for (const part of item.content) if (object(part) && part.type === "output_text" && typeof part.text === "string") return part.text;
  return null;
}

export async function extractPaperCardDraft(input: { bytes: Uint8Array; mediaType: "image/jpeg" | "image/png" | "image/webp" }, options: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {}) {
  const env = options.env ?? process.env;
  if (env.ACC_PAPER_CARD_OCR_ENABLED !== "enabled" || env.ACC_OCR_PROVIDER !== "openai" || env.ACC_OCR_EXECUTION_MODE !== "external") throw new Error("Paper-card OCR is disabled.");
  const apiKey = env.OCR_PROVIDER_API_KEY?.trim();
  if (!apiKey) throw new Error("Paper-card OCR credential is unavailable.");
  if (!(input.bytes instanceof Uint8Array) || input.bytes.byteLength < 1 || input.bytes.byteLength > 10 * 1024 * 1024
      || !["image/jpeg", "image/png", "image/webp"].includes(input.mediaType)) throw new Error("Paper-card OCR input is invalid.");
  const response = await (options.fetchImpl ?? fetch)("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: env.ACC_OCR_MODEL?.trim() || "gpt-5.6-luna", store: false,
      max_output_tokens: 5_000,
      instructions: "Transcribe visible ACC cribbage scorecard cells conservatively. Use null when uncertain. This is a non-authoritative draft that always requires human review.",
      input: [{ role: "user", content: [
        { type: "input_text", text: "Return only the structured draft for this paper scorecard image." },
        { type: "input_image", image_url: `data:${input.mediaType};base64,${Buffer.from(input.bytes).toString("base64")}`, detail: "high" },
      ] }],
      text: { format: { type: "json_schema", name: "paper_card_ocr_draft", strict: true, schema: scorecardSchema } },
    }),
  });
  if (!response.ok) throw new Error("Paper-card OCR provider request failed.");
  const responseText = await response.text();
  if (new TextEncoder().encode(responseText).length > 512 * 1024) throw new Error("Paper-card OCR provider response is too large.");
  let payload: unknown;
  try { payload = JSON.parse(responseText); } catch { throw new Error("Paper-card OCR provider returned an invalid response."); }
  const text = outputText(payload);
  if (!text || new TextEncoder().encode(text).length > 128 * 1024) throw new Error("Paper-card OCR provider returned no usable draft.");
  let draft: unknown;
  try { draft = JSON.parse(text); } catch { throw new Error("Paper-card OCR provider returned an invalid draft."); }
  if (!isOcrDraft(draft)) throw new Error("Paper-card OCR draft failed validation.");
  return { providerResponseId: object(payload) && typeof payload.id === "string" ? payload.id : null, model: env.ACC_OCR_MODEL?.trim() || "gpt-5.6-luna", draft };
}
