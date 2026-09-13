import "server-only";

import { createHash } from "node:crypto";
import { createServerOnlyAdminClient } from "../supabase/private-admin.ts";

export const PAPER_CARD_BUCKET = "paper-scorecards-private";
export const PAPER_CARD_MAX_BYTES = 10 * 1024 * 1024;
export const PAPER_CARD_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function paperCardStorageEnabled(env: Record<string, string | undefined> = process.env) {
  return env.ACC_PAPER_CARD_CAPTURE_ENABLED === "enabled"
    && (env.SUPABASE_PAPER_CARD_BUCKET?.trim() ?? PAPER_CARD_BUCKET) === PAPER_CARD_BUCKET;
}

export async function createSignedPaperCardUpload(objectPath: string) {
  const { data, error } = await createServerOnlyAdminClient().storage
    .from(PAPER_CARD_BUCKET)
    .createSignedUploadUrl(objectPath, { upsert: false });
  if (error || !data?.token) throw new Error("Paper-card upload authorization failed.");
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export async function readAndVerifyPaperCard(objectPath: string, expected: { mediaType: string; byteSize: number; sha256: string }) {
  if (!PAPER_CARD_MEDIA_TYPES.includes(expected.mediaType as typeof PAPER_CARD_MEDIA_TYPES[number])
      || !Number.isSafeInteger(expected.byteSize) || expected.byteSize < 1 || expected.byteSize > PAPER_CARD_MAX_BYTES
      || !/^[0-9a-f]{64}$/.test(expected.sha256)) throw new Error("Invalid paper-card image metadata.");
  const { data, error } = await createServerOnlyAdminClient().storage.from(PAPER_CARD_BUCKET).download(objectPath);
  if (error || !data) throw new Error("Paper-card image is unavailable.");
  const bytes = Buffer.from(await data.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== expected.byteSize || digest !== expected.sha256) throw new Error("Paper-card image integrity check failed.");
  return { bytes, byteSize: bytes.byteLength, sha256: digest };
}
