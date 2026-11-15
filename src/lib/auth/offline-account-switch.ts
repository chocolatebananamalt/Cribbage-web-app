const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A missing marker permits ordinary sign-in; a present marker permits only the same actor. */
export function canAcceptOfflineOwnerSession(offlineOwner: string | undefined, incomingActorId: string | undefined) {
  if (!offlineOwner) return true;
  return !!incomingActorId && uuid.test(offlineOwner) && uuid.test(incomingActorId) && offlineOwner === incomingActorId;
}
