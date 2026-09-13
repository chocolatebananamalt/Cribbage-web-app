export const LOCAL_CARD_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

const supportedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type LocalCardPhotoValidation =
  | { accepted: true }
  | { accepted: false; message: string };

export function validateLocalCardPhoto(
  file: Pick<File, "size" | "type">,
): LocalCardPhotoValidation {
  if (!supportedTypes.has(file.type)) {
    return {
      accepted: false,
      message: "Use a JPEG, PNG, or WebP image.",
    };
  }
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > LOCAL_CARD_PHOTO_MAX_BYTES) {
    return {
      accepted: false,
      message: "Use an image smaller than 10 MB.",
    };
  }
  return { accepted: true };
}
