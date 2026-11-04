import { isRetainedSetupSaveRequest, isSavedSetup, type SetupEvent, type SetupSaveRequest } from './setup.ts';
import { isSetupActivationResult, type SetupActivationRequest, type SetupActivationResult } from './setup-activation.ts';
import { isUuid } from './validation.ts';

export const SETUP_EVENT_LINKS_PROTOCOL = 'setup-event-links-v1' as const;
export type SetupEventLinkChoice = { mainClientRowId: string; consolationClientRowIds: string[] };
export type LinkedSetupSaveEnvelope = { kind: typeof SETUP_EVENT_LINKS_PROTOCOL; request: SetupSaveRequest; choices: SetupEventLinkChoice[] };
export type SetupEventLinksSnapshot = { protocol: typeof SETUP_EVENT_LINKS_PROTOCOL; setupRevisionId: string; setupVersion: number; choices: SetupEventLinkChoice[]; complete: boolean; associationHash: string };
export type SetupEventLinksWorkspace = { available: true; protocol: typeof SETUP_EVENT_LINKS_PROTOCOL; current: SetupEventLinksSnapshot | null };
export type LinkedSetupSaveResult = { status: 'linked_setup_saved'; result: Parameters<typeof isSavedSetup>[0] & { status: 'setup_draft_saved'; revisionId: string; version: number; eventCount: number }; links: SetupEventLinksSnapshot };
export type LinkedSetupActivationResult = { status: 'linked_setup_activated'; result: SetupActivationResult; associationHash: string };

const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const idKey = (id: string) => id.toLowerCase();

/** Structural validation is useful even where the associated setup is unavailable. */
export function isSetupEventLinkChoices(value: unknown): value is SetupEventLinkChoice[] {
  if (!Array.isArray(value) || value.length > 32) return false;
  const mains = new Set<string>(); const children = new Set<string>();
  for (const item of value) {
    if (!exact(item, ['mainClientRowId', 'consolationClientRowIds']) || !isUuid(item.mainClientRowId) || !Array.isArray(item.consolationClientRowIds) || item.consolationClientRowIds.length > 32) return false;
    const main = idKey(item.mainClientRowId);
    if (mains.has(main)) return false;
    mains.add(main);
    for (const child of item.consolationClientRowIds) {
      if (!isUuid(child) || children.has(idKey(child))) return false;
      children.add(idKey(child));
    }
  }
  return ![...mains].some(main => children.has(main));
}

export type SetupEventLinksValidation = { valid: boolean; complete: boolean; reasons: string[] };
/** Incomplete choices are valid drafts; invalid references and ambiguous rows are rejected. */
export function validateSetupEventLinks(events: SetupEvent[], choices: unknown): SetupEventLinksValidation {
  if (!Array.isArray(events) || events.length > 32 || !isSetupEventLinkChoices(choices)) return { valid: false, complete: false, reasons: ['invalid_shape'] };
  const rows = new Map<string, SetupEvent['eventKind']>();
  for (const event of events) {
    if (!event || !isUuid(event.clientRowId) || !['main', 'consolation', 'satellite', 'custom'].includes(event.eventKind) || rows.has(idKey(event.clientRowId))) return { valid: false, complete: false, reasons: ['invalid_events'] };
    rows.set(idKey(event.clientRowId), event.eventKind);
  }
  for (const choice of choices) {
    if (rows.get(idKey(choice.mainClientRowId)) !== 'main' || choice.consolationClientRowIds.some(id => rows.get(idKey(id)) !== 'consolation')) return { valid: false, complete: false, reasons: ['invalid_reference'] };
  }
  const chosen = new Set(choices.map(choice => idKey(choice.mainClientRowId)));
  const assigned = new Set(choices.flatMap(choice => choice.consolationClientRowIds.map(idKey)));
  const reasons: string[] = [];
  if ([...rows].some(([id, kind]) => kind === 'main' && !chosen.has(id))) reasons.push('main_choice_missing');
  if ([...rows].some(([id, kind]) => kind === 'consolation' && !assigned.has(id))) reasons.push('consolation_unassigned');
  return { valid: true, complete: reasons.length === 0, reasons };
}

export function isLinkedSetupSaveEnvelope(value: unknown): value is LinkedSetupSaveEnvelope {
  return exact(value, ['kind', 'request', 'choices']) && value.kind === SETUP_EVENT_LINKS_PROTOCOL && isRetainedSetupSaveRequest(value.request) && validateSetupEventLinks(value.request.payload.events, value.choices).valid;
}
export function isSetupEventLinksSnapshot(value: unknown): value is SetupEventLinksSnapshot {
  return exact(value, ['protocol', 'setupRevisionId', 'setupVersion', 'choices', 'complete', 'associationHash']) && value.protocol === SETUP_EVENT_LINKS_PROTOCOL && isUuid(value.setupRevisionId) && Number.isSafeInteger(value.setupVersion) && (value.setupVersion as number) > 0 && isSetupEventLinkChoices(value.choices) && typeof value.complete === 'boolean' && hash(value.associationHash);
}
export function isSetupEventLinksWorkspace(value: unknown): value is SetupEventLinksWorkspace {
  return exact(value, ['available', 'protocol', 'current']) && value.available === true && value.protocol === SETUP_EVENT_LINKS_PROTOCOL && (value.current === null || isSetupEventLinksSnapshot(value.current));
}
export function isLinkedSetupSaveResult(value: unknown, envelope: LinkedSetupSaveEnvelope): value is LinkedSetupSaveResult {
  if (!isLinkedSetupSaveEnvelope(envelope) || !exact(value, ['status', 'result', 'links']) || value.status !== 'linked_setup_saved' || !isSavedSetup(value.result, envelope.request) || !isSetupEventLinksSnapshot(value.links)) return false;
  const check = validateSetupEventLinks(envelope.request.payload.events, envelope.choices);
  return value.links.setupRevisionId === value.result.revisionId && value.links.setupVersion === value.result.version && value.links.complete === check.complete && value.links.choices.length === envelope.choices.length && value.links.choices.every((choice, i) => choice.mainClientRowId === envelope.choices[i].mainClientRowId && choice.consolationClientRowIds.length === envelope.choices[i].consolationClientRowIds.length && choice.consolationClientRowIds.every((id, j) => id === envelope.choices[i].consolationClientRowIds[j]));
}
export function isLinkedSetupActivationResult(value: unknown, request: SetupActivationRequest, expectedHash: string): value is LinkedSetupActivationResult {
  return hash(expectedHash) && exact(value, ['status', 'result', 'associationHash']) && value.status === 'linked_setup_activated' && value.associationHash === expectedHash && isSetupActivationResult(value.result, request);
}

const linkedRejectionCodes = new Set(['association_changed','association_pin_required','association_incomplete','invalid_event_sequence','dependent_event_removal']);
export function isRejectedLinkedSetup(value: unknown): value is {status:'rejected';code:string} {
 return exact(value,['status','code']) && value.status==='rejected' && typeof value.code==='string' && linkedRejectionCodes.has(value.code);
}
export function linkedSetupRejectionMessage(code: string): string {
 const messages: Record<string,string> = {association_changed:'The saved event associations changed. Reload and review them before finalizing.',association_pin_required:'Save and review the event associations before finalizing.',association_incomplete:'Choose a Consolation answer for each Main and assign every Consolation before finalizing.',invalid_event_sequence:'Add a Main before adding other events.',dependent_event_removal:'Delete or reassign dependent Consolation events before removing a Main.'};
 return messages[code] ?? 'The setup was not accepted. Review the draft and try again.';
}
