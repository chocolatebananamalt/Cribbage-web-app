type Env = Record<string, string | undefined>;

/** This assembly is a fictional test app. Generic Preview variables are insufficient. */
export function assertIntegratedTestTarget(env: Env) {
  if (env.NEXT_PUBLIC_CRIBBAGE_TEST_APP !== "fictional") throw new Error("Integrated test app requires explicit fictional test configuration.");
  const configured = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const expected = env.NEXT_PUBLIC_CRIBBAGE_TEST_BACKEND_URL?.replace(/\/$/, "");
  if (!configured || configured !== expected) throw new Error("Test backend URL must match its explicit isolated target binding.");
  const url = new URL(configured);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid isolated test backend origin.");
  if (url.hostname === "fnjkwymxpnsqvxtpronk.supabase.co") throw new Error("Production backend is forbidden for this test app.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (local) {
    if (env.NEXT_PUBLIC_CRIBBAGE_TEST_PROJECT_REF && env.NEXT_PUBLIC_CRIBBAGE_TEST_PROJECT_REF !== "localfictional") throw new Error("Loopback context must use the local fictional project reference.");
    if (!["http:", "https:"].includes(url.protocol) || env.VERCEL_ENV) throw new Error("Loopback target is local-only.");
  } else {
    const ref = env.NEXT_PUBLIC_CRIBBAGE_TEST_PROJECT_REF;
    const branch = env.CRIBBAGE_TEST_APP_BRANCH;
    if (url.protocol !== "https:" || !ref || url.hostname !== `${ref}.supabase.co`
      || env.VERCEL_ENV !== "preview" || !branch || branch === "codex/director-setup-journey"
      || env.VERCEL_GIT_COMMIT_REF !== branch
      || !["verified-fictional-backend", "fresh-fictional-backend"].includes(env.CRIBBAGE_TEST_ISOLATION_CONFIRMED ?? "")) {
      throw new Error("Hosted test app requires a verified isolated fictional backend and explicit matching Preview branch binding.");
    }
  }
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SECRET_KEY?.startsWith("sb_secret_")) throw new Error("Isolated test backend keys are not configured.");
  return { origin: url.origin, local, projectRef: local ? null : env.NEXT_PUBLIC_CRIBBAGE_TEST_PROJECT_REF };
}

/** UI availability is not authorization; existing routes/RPCs retain their checks. */
export function integratedTestUiEnabled() {
  // Server consumers include write-availability gates: recheck the complete
  // binding rather than relying only on startup validation. Browser consumers
  // receive public availability only; every mutation retains its server checks.
  if (typeof window === "undefined") {
    try { assertIntegratedTestTarget(process.env); } catch { return false; }
  }
  return process.env.NEXT_PUBLIC_CRIBBAGE_TEST_APP === "fictional"
    && !!process.env.NEXT_PUBLIC_CRIBBAGE_TEST_BACKEND_URL
    && process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") === process.env.NEXT_PUBLIC_CRIBBAGE_TEST_BACKEND_URL?.replace(/\/$/, "");
}

/** Shared scope binding for legacy native paths. Unconfigured legacy unit fixtures
 * retain their prior staging reference; every product availability gate stays shut. */
export function integratedTestBackendRef() {
  if (!integratedTestUiEnabled()) return "nnhcnvksxgxnpvdqjgpg";
  const url = new URL(process.env.NEXT_PUBLIC_CRIBBAGE_TEST_BACKEND_URL!);
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ? "localfictional" : process.env.NEXT_PUBLIC_CRIBBAGE_TEST_PROJECT_REF!;
}
export function integratedTestBackendOrigin() {
  return integratedTestUiEnabled() ? process.env.NEXT_PUBLIC_CRIBBAGE_TEST_BACKEND_URL!.replace(/\/$/, "") : "https://nnhcnvksxgxnpvdqjgpg.supabase.co";
}
