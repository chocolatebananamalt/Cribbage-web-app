import type { NextRequest } from "next/server";
import { recoveryAuthPost } from "../../../lib/auth/recovery-auth-route";
export async function POST(request: NextRequest) { return recoveryAuthPost(request, "password"); }
