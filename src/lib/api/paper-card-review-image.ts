import { isUuid } from "./validation";

export type PaperCardReviewImageAuthorization = {
  captureId: string;
  storageReceiptId: string;
  objectPath: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  sha256: string;
};

export function isPaperCardReviewImageAuthorization(value: unknown): value is PaperCardReviewImageAuthorization {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const keys = Object.keys(item);
  return keys.length === 6
    && ["captureId", "storageReceiptId", "objectPath", "mediaType", "byteSize", "sha256"].every((key) => key in item)
    && isUuid(item.captureId) && isUuid(item.storageReceiptId)
    && typeof item.objectPath === "string" && item.objectPath.length >= 1 && item.objectPath.length <= 1000
    && ["image/jpeg", "image/png", "image/webp"].includes(item.mediaType as string)
    && Number.isSafeInteger(item.byteSize) && Number(item.byteSize) >= 1 && Number(item.byteSize) <= 10 * 1024 * 1024
    && typeof item.sha256 === "string" && /^[0-9a-f]{64}$/.test(item.sha256);
}

