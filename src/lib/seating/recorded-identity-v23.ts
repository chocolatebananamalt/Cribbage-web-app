import { readProfileV8 } from '../identity-adoption-v8/contracts.ts';
import { localIdentityLabelV5, type IdentityAccessV5 } from '../identity-v5/contracts.ts';
import { identityPresentationV1 } from '../registration/nonmember-identity-v1.ts';

/** Display only: never use a legal name/address to select or merge a roster row. */
export function recordedCheckInIdentityV23(value: unknown, scope: IdentityAccessV5, rosterEntryId: string) {
  const profile = readProfileV8(value, scope, rosterEntryId);
  if (!profile) return null;
  const player = profile.player;
  // Untrusted legacy text must not turn a private internal ID into a visible name.
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|temporary\s*id\s*#\s*[0-9]+/i.test(player.displayName)) return null;
  return {
    displayName: player.displayName,
    reference: localIdentityLabelV5(player),
    nonmember: identityPresentationV1(player.entry)?.membership === 'nonmember',
    incompleteAddress: profile.coverage === 'incomplete_reviewed',
  };
}
