import { NextRequest } from "next/server";

export function isSameOriginRequest(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}
