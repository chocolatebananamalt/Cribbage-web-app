/**
 * The root dashboard is a deliberately synthetic design-review surface. It is
 * available in local development and protected Preview deployments, but must
 * never become an accidental public production operations screen.
 */
export function allowsReviewPrototype(environment: {
  nodeEnv?: string;
  vercelEnv?: string;
}): boolean {
  if (environment.vercelEnv === "production") return false;
  if (environment.vercelEnv === "preview" || environment.vercelEnv === "development") return true;
  return environment.nodeEnv !== "production";
}
