import { isUuid } from "./validation.ts";

const exact = (value: object, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);
const media = (value: unknown): value is "image/jpeg" | "image/png" | "image/webp" => value === "image/jpeg" || value === "image/png" || value === "image/webp";

export type PaperCardUploadRequest = { uploadIntentId: string; objectReferenceId: string };
export type PaperCardUploadAuthorization = { status: "upload_authorized"; captureId: string; uploadIntentId: string; objectReferenceId: string; objectPath: string; mediaType: "image/jpeg" | "image/png" | "image/webp"; byteSize: number; sha256: string; token: string; retentionState: "restricted_hold" };
export type PaperCardUploadCompletion = { status: "image_stored"; captureId: string; storageReceiptId: string; retentionState: "restricted_hold"; ocrRequested: false; scoreChanged: false; gameVerified: false };

export function isPaperCardUploadRequest(value: unknown): value is PaperCardUploadRequest {
  return !!value && typeof value === "object" && exact(value, ["uploadIntentId", "objectReferenceId"])
    && isUuid((value as Record<string, unknown>).uploadIntentId)
    && isUuid((value as Record<string, unknown>).objectReferenceId);
}

export function isPaperCardUploadMetadata(value: unknown) {
  if (!value || typeof value !== "object" || !exact(value, ["captureId", "uploadIntentId", "objectReferenceId", "objectPath", "mediaType", "byteSize", "sha256", "retentionState"])) return false;
  const item = value as Record<string, unknown>;
  return isUuid(item.captureId) && isUuid(item.uploadIntentId) && isUuid(item.objectReferenceId)
    && typeof item.objectPath === "string" && item.objectPath.length >= 1 && item.objectPath.length <= 1000
    && !item.objectPath.includes("..") && media(item.mediaType)
    && Number.isSafeInteger(item.byteSize) && (item.byteSize as number) >= 1 && (item.byteSize as number) <= 10 * 1024 * 1024
    && typeof item.sha256 === "string" && /^[0-9a-f]{64}$/.test(item.sha256)
    && item.retentionState === "restricted_hold";
}

export function isPaperCardUploadAuthorization(
  value: unknown,
  captureId: string,
  request: PaperCardUploadRequest,
): value is PaperCardUploadAuthorization {
  if (!value || typeof value !== "object" || !exact(value, [
    "status", "captureId", "uploadIntentId", "objectReferenceId", "objectPath",
    "mediaType", "byteSize", "sha256", "retentionState", "token",
  ])) return false;
  const item = value as Record<string, unknown>;
  return item.status === "upload_authorized"
    && item.captureId === captureId
    && item.uploadIntentId === request.uploadIntentId
    && item.objectReferenceId === request.objectReferenceId
    && isPaperCardUploadMetadata({
      captureId: item.captureId,
      uploadIntentId: item.uploadIntentId,
      objectReferenceId: item.objectReferenceId,
      objectPath: item.objectPath,
      mediaType: item.mediaType,
      byteSize: item.byteSize,
      sha256: item.sha256,
      retentionState: item.retentionState,
    })
    && typeof item.token === "string"
    && item.token.length >= 1
    && item.token.length <= 4096;
}

export function isPaperCardUploadCompletion(value: unknown, captureId: string): value is PaperCardUploadCompletion {
  if (!value || typeof value !== "object" || !exact(value, ["status", "captureId", "storageReceiptId", "retentionState", "ocrRequested", "scoreChanged", "gameVerified"])) return false;
  const item = value as Record<string, unknown>;
  return item.status === "image_stored" && item.captureId === captureId && isUuid(item.storageReceiptId)
    && item.retentionState === "restricted_hold" && item.ocrRequested === false
    && item.scoreChanged === false && item.gameVerified === false;
}
