import type { SetupEvent } from './api/setup.ts';
import type { SetupEventLinkChoice } from './api/setup-event-links.ts';

type Intent = { kind: 'keep' | 'create' | 'review_required' } | { kind: 'reuse'; clientRowId: string };
const key = (id: string) => id.toLowerCase();

/** New drafts create once. Reuse an unambiguous earlier editor; never guess an
 * ambiguous historical relationship or discard its events. */
export function consolationYesIntent(mainId: string, events: SetupEvent[], choices: SetupEventLinkChoice[]): Intent {
  if (!events.some(event => key(event.clientRowId) === key(mainId) && event.eventKind === 'main')) return { kind: 'review_required' };
  const selected = choices.find(choice => key(choice.mainClientRowId) === key(mainId));
  if (selected?.consolationClientRowIds.length) return selected.consolationClientRowIds.every(id => events.some(event => key(event.clientRowId) === key(id) && event.eventKind === 'consolation')) ? { kind: 'keep' } : { kind: 'review_required' };
  const assigned = new Set(choices.flatMap(choice => choice.consolationClientRowIds.map(key)));
  const available = events.filter(event => event.eventKind === 'consolation' && !assigned.has(key(event.clientRowId)));
  if (available.length === 0) return { kind: 'create' };
  if (events.filter(event => event.eventKind === 'main').length === 1 && available.length === 1) return { kind: 'reuse', clientRowId: available[0].clientRowId };
  return { kind: 'review_required' };
}
