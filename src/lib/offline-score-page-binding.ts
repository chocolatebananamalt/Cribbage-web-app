import { isUuid } from './api/validation.ts';

export const offlineScoreBindingMetaName = 'acc-offline-score-binding';

/** Only the protected current-game route may emit this metadata. It is an
 * assignment marker, never an authentication token or score-verification claim.
 */
export function assignedOfflinePageMetadata(context: { actorId: string; gameId: string; progressionStatus: string }) {
  if (!isUuid(context.actorId) || !isUuid(context.gameId) || context.progressionStatus !== 'current') return {};
  return { other: { [offlineScoreBindingMetaName]: `${context.actorId}:${context.gameId}` } };
}

/** Parse real elements, not escaped Flight/user text. Metadata can stream into
 * the response body, so validate the complete inert document, not head alone.
 * Legacy literal assignment divs remain readable; conflicting markers block.
 */
export function hasAssignedOfflinePageBinding(html: string, actorId: string, gameId: string) {
  if (!isUuid(actorId) || !isUuid(gameId)) return false;
  const document = new DOMParser().parseFromString(html, 'text/html');
  const expected = `${actorId}:${gameId}`;
  const metadata = [...document.querySelectorAll(`meta[name="${offlineScoreBindingMetaName}"]`)];
  const legacy = [...document.querySelectorAll('[data-offline-score-binding]')];
  if (metadata.length > 1 || legacy.length > 1 || metadata.length + legacy.length === 0) return false;
  return metadata.every(node => node.getAttribute('content') === expected)
    && legacy.every(node => node.getAttribute('data-offline-score-binding') === expected);
}
