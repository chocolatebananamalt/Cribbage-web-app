/**
 * The witnessed activation ceremony is unavailable unless it has been
 * deliberately enabled after the private migrations and live-session evidence
 * are complete. Defaulting off prevents a deployed route from becoming a
 * partial identity path.
 */
export function accountActivationEnabled(env: Record<string, string | undefined> = process.env) {
  return env.ACC_ACCOUNT_ACTIVATION_ENABLED === "true";
}
