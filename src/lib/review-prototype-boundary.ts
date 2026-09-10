/**
 * The root dashboard is a deliberately synthetic design-review surface. It is
 * available in local development and protected Preview deployments, but must
 * never become an accidental public production operations screen.
 */
export function allowsReviewPrototype(environment: {
  host?: string | null;
  nodeEnv?: string;
  vercelEnv?: string;
}): boolean {
  if (environment.vercelEnv === "production") return false;
  const hostname = environment.host?.trim().toLowerCase().replace(/:\d+$/, "");
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname) {
    return hostname !== "cribbage-web-app.vercel.app"
      && hostname.endsWith("-cribbage-app.vercel.app");
  }
  return environment.nodeEnv !== "production";
}
