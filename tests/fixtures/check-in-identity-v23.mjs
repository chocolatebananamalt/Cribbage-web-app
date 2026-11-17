export const id = n => 'f2300000-0000-4000-8000-' + String(n).padStart(12, '0');
export const scope = { actorId: id(1), sessionId: id(2), tournamentId: id(3), role: 'director' };
export const catalogHash = 'b'.repeat(64);
export function profile(n = 4, overrides = {}) {
  const suffix = n === 4 ? 'Sr.' : 'Jr.';
  const player = { kind: 'identity-trial-player-v4', ...scope, rosterEntryId: id(n), playerIdentityId: id(n + 10), version: 1, operationId: id(n + 20),
    entry: { firstName: 'Alex', lastName: 'Example', email: '', city: 'Fictional City', state: 'HI', accNumber: '', nonmemberWithoutNumber: true, scorecardType: 'paper', joiningClaim: { status: 'none', evidenceReference: '' } },
    address: { street: '1 Fictional Way', postalCode: '00000', country: 'US' }, distinction: { prefix: '', middleName: '', suffix, localLabel: '' }, displayName: 'Alex Example ' + suffix,
    temporaryOrdinal: n - 3, issuedReference: null, officialMembershipVerified: false, actualMrpAwarded: false,
  };
  delete player.role;
  return { kind: 'legacy-adoption-profile-v8', actorId: scope.actorId, sessionId: scope.sessionId, tournamentId: scope.tournamentId, rosterEntryId: id(n), coverage: 'complete', player, ...overrides };
}
export const checkIn = [4, 5].map(n => ({ rosterEntryId: id(n), displayName: 'Alex Example', scorecardType: 'paper', state: 'not_checked_in' }));
