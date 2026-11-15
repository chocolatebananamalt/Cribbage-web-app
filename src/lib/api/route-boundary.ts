import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
export { readSmallJson, readMediumJson, readLargeJson, smallJsonRequestBodyLimit, mediumJsonRequestBodyLimit, largeJsonRequestBodyLimit } from "./bounded-json";
export { requireVerifiedIdentity, requireVerifiedSubject } from "./verified-subject";

export const privateNoStore = { "cache-control": "private, no-store" };

export function apiJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function withApiFailureBoundary(run: () => Promise<NextResponse>) {
  try {
    return await run();
  } catch (error) {
    // redirect() and notFound() signal by throwing. Swallowing those turns a
    // deliberate auth outcome into a false "service unavailable" alarm, so the
    // framework's own control-flow errors are re-thrown before the 503.
    unstable_rethrow(error);
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  }
}
