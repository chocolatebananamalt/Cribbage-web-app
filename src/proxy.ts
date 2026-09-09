import { NextResponse, type NextRequest } from "next/server";
import {
  apiMutationOriginRejection,
  rejectsApiMutationOrigin,
} from "./lib/api/mutation-origin-gateway";
import { updateSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (rejectsApiMutationOrigin({
    pathname: request.nextUrl.pathname,
    method: request.method,
    origin: request.headers.get("origin"),
    requestOrigin: request.nextUrl.origin,
  })) {
    return NextResponse.json(apiMutationOriginRejection.body, apiMutationOriginRejection.init);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/api/v1/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
