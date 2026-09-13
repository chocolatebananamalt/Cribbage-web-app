/** Readiness reporting is read-only and requires an exact, deliberate opt-in. */
export function eventFinalizationReadinessEnabled(env: Record<string, string | undefined> = process.env) {
  return env.ACC_EVENT_FINALIZATION_READINESS_ENABLED === "enabled";
}
