import { isUuid } from "./validation.ts";

export type PaperCardCaptureRequest = {
  gameId: string;
  cardSide: "a" | "b";
  verificationId: string;
  sourceKind: "camera" | "file_upload";
  originalFileName: string;
  declaredMediaType: "image/jpeg" | "image/png" | "image/webp";
  declaredByteSize: number;
  declaredSha256: string;
  clientCapturedAt: string | null;
  idempotencyKey: string;
};

const requestKeys = [
  "gameId",
  "cardSide",
  "verificationId",
  "sourceKind",
  "originalFileName",
  "declaredMediaType",
  "declaredByteSize",
  "declaredSha256",
  "clientCapturedAt",
  "idempotencyKey",
];
const resultKeys = [
  "status",
  "captureId",
  "uploadIntentId",
  "objectReferenceId",
  "gameId",
  "cardSide",
  "verificationId",
  "captureState",
  "humanReviewState",
  "retentionState",
  "originalMetadata",
  "uploadProviderConfigured",
  "uploadAuthorized",
  "imageStored",
  "publicUrlCreated",
  "ocrRequested",
  "transcriptionCreated",
  "scoreChanged",
  "gameVerified",
];
const metadataKeys = [
  "sourceKind",
  "fileName",
  "mediaType",
  "byteSize",
  "sha256",
  "clientCapturedAt",
];
const rejectionCodes = new Set([
  "tournament_unavailable",
  "not_capture_official",
  "idempotency_conflict",
  "capture_lifecycle_closed",
  "game_unavailable",
  "unsupported_event",
  "card_identity_unavailable",
  "self_capture_denied",
  "verification_id_mismatch",
  "invalid_request",
]);
const allowedMediaTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const capturedAtPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function hasExactKeys(value: object, keys: string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
}
function isClientCapturedAt(value: unknown): value is string | null {
  return value === null || (
    typeof value === "string"
    && value.length >= 20
    && value.length <= 40
    && capturedAtPattern.test(value)
    && Number.isFinite(Date.parse(value))
  );
}

export function paperCardCaptureEnabled() {
  return true;
}

export function isPaperCardCaptureRequest(value: unknown): value is PaperCardCaptureRequest {
  if (!value || typeof value !== "object" || !hasExactKeys(value, requestKeys)) return false;
  const request = value as Record<string, unknown>;
  return isUuid(request.gameId)
    && ["a", "b"].includes(request.cardSide as string)
    && typeof request.verificationId === "string"
    && /^[A-Z]-[1-9]\d*$/.test(request.verificationId)
    && ["camera", "file_upload"].includes(request.sourceKind as string)
    && typeof request.originalFileName === "string"
    && request.originalFileName.trim().length >= 1
    && request.originalFileName.length <= 255
    && new TextEncoder().encode(request.originalFileName).length <= 1020
    && !/[\\/\u0000-\u001f\u007f]/.test(request.originalFileName)
    && typeof request.declaredMediaType === "string"
    && allowedMediaTypes.has(request.declaredMediaType)
    && Number.isSafeInteger(request.declaredByteSize)
    && (request.declaredByteSize as number) >= 1
    && (request.declaredByteSize as number) <= 10 * 1024 * 1024
    && typeof request.declaredSha256 === "string"
    && /^[0-9a-f]{64}$/.test(request.declaredSha256)
    && isClientCapturedAt(request.clientCapturedAt)
    && isUuid(request.idempotencyKey);
}

export function isPaperCardCaptureResult(
  value: unknown,
  request: PaperCardCaptureRequest,
) {
  if (!value || typeof value !== "object" || !hasExactKeys(value, resultKeys)) return false;
  const result = value as Record<string, unknown>;
  const metadata = result.originalMetadata;
  if (!metadata || typeof metadata !== "object" || !hasExactKeys(metadata, metadataKeys)) return false;
  const original = metadata as Record<string, unknown>;
  return result.status === "paper_card_capture_created"
    && isUuid(result.captureId)
    && isUuid(result.uploadIntentId)
    && isUuid(result.objectReferenceId)
    && result.gameId === request.gameId
    && result.cardSide === request.cardSide
    && result.verificationId === request.verificationId
    && result.captureState === "upload_provider_pending"
    && result.humanReviewState === "not_started"
    && result.retentionState === "restricted_hold"
    && original.sourceKind === request.sourceKind
    && original.fileName === request.originalFileName
    && original.mediaType === request.declaredMediaType
    && original.byteSize === request.declaredByteSize
    && original.sha256 === request.declaredSha256
    && original.clientCapturedAt === request.clientCapturedAt
    && [
      "uploadProviderConfigured",
      "uploadAuthorized",
      "imageStored",
      "publicUrlCreated",
      "ocrRequested",
      "transcriptionCreated",
      "scoreChanged",
      "gameVerified",
    ].every((key) => result[key] === false);
}

export function isRejectedPaperCardCapture(value: unknown) {
  if (!value || typeof value !== "object" || !hasExactKeys(value, ["status", "code"])) return false;
  const result = value as Record<string, unknown>;
  return result.status === "rejected"
    && typeof result.code === "string"
    && rejectionCodes.has(result.code);
}
