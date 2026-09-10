export const smallJsonRequestBodyLimit = 2048;

/**
 * Read a small JSON mutation request without allowing an unbounded body to
 * reach an authenticated operation. Callers still validate exact shape.
 */
export async function readSmallJson(request: Request): Promise<unknown | null> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const contentLength = request.headers.get("content-length");
  if (!contentType.startsWith("application/json")
    || (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > smallJsonRequestBodyLimit))) {
    return null;
  }
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > smallJsonRequestBodyLimit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(concat(chunks, totalBytes))) as unknown; } catch { return null; }
}

function concat(chunks: Uint8Array[], totalBytes: number) {
  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
