import { assertIntegratedTestTarget } from '../integrated-test-target.ts';
/** Development capability only; this proposal cannot be activated on a hosted URL. */
export function legacyRegistrationEnabledV25(env: Record<string,string|undefined> = process.env) {
  if (env.VERCEL_ENV || env.CRIBBAGE_LEGACY_REGISTRATION_V25 !== 'local-reviewed-v25' || !/^[a-f0-9]{64}$/.test(env.CRIBBAGE_LEGACY_REGISTRATION_V25_CATALOG_HASH ?? '')) return false;
  try { return assertIntegratedTestTarget(env).local; } catch { return false; }
}
