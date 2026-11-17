import { assertIntegratedTestTarget } from '../integrated-test-target.ts';

type Env = Record<string, string | undefined>;
const stagingRef = 'nnhcnvksxgxnpvdqjgpg';
const stagingBranch = 'codex/integrated-test-app';

/** Availability only. Live Auth/session/Director and backend capability checks still apply. */
export function adoptionEnabledV8(env: Env = process.env): boolean {
  if (!/^[a-f0-9]{64}$/.test(env.CRIBBAGE_IDENTITY_ADOPTION_V8_CATALOG_HASH ?? '')) return false;
  if (env.CRIBBAGE_IDENTITY_ADOPTION_V8 === 'local-reviewed-v8') {
    try {
      return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname) && !env.VERCEL_ENV;
    } catch { return false; }
  }
  if (env.CRIBBAGE_IDENTITY_ADOPTION_V8 !== 'reviewed-staging-v8') return false;
  try {
    const target = assertIntegratedTestTarget(env);
    return !target.local && target.projectRef === stagingRef
      && target.origin === `https://${stagingRef}.supabase.co`
      && env.VERCEL_ENV === 'preview'
      && env.CRIBBAGE_TEST_APP_BRANCH === stagingBranch
      && env.VERCEL_GIT_COMMIT_REF === stagingBranch;
  } catch { return false; }
}

/** A configured adoption lane must never reopen the unchecked V5 mutation lane. */
export function adoptionMutationHoldV8(env: Env = process.env): boolean {
  return ['local-reviewed-v8', 'reviewed-staging-v8'].includes(env.CRIBBAGE_IDENTITY_ADOPTION_V8 ?? '');
}

/** Staging may be inspected or kept in recovery mode without allowing new/retried writes. */
export function adoptionWritesEnabledV8(env: Env = process.env): boolean {
  return adoptionEnabledV8(env) && (env.CRIBBAGE_IDENTITY_ADOPTION_V8 === 'local-reviewed-v8'
    || env.CRIBBAGE_IDENTITY_ADOPTION_V8_WRITES === 'enabled');
}
