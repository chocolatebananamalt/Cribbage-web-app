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
  } catch {
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  }
}
