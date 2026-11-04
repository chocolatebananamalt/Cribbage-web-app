import { isLinkedSetupSaveEnvelope, isSetupEventLinksSnapshot, type SetupEventLinkChoice, type SetupEventLinksSnapshot } from './api/setup-event-links.ts';
import type { SetupSaveRequest } from './api/setup.ts';
import { acceptedSetupKey, parseAcceptedSetupReceipt, type AcceptedSetupReceipt } from './setup-save-recovery.ts';
export type PendingLinkedSetup = { kind: 'tournament-setup-linked-v1'; request: SetupSaveRequest; choices: SetupEventLinkChoice[]; stage: 'details' | 'all' };
type StoragePort = Pick<Storage, 'getItem' | 'removeItem'>;
export function parsePendingLinkedSetup(raw: string | null): PendingLinkedSetup | null {
 try { const value: unknown = JSON.parse(raw ?? 'null'); if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== 'choices,kind,request,stage') return null; const v = value as Record<string, unknown>; return v.kind === 'tournament-setup-linked-v1' && (v.stage === 'details' || v.stage === 'all') && isLinkedSetupSaveEnvelope({kind:'setup-event-links-v1',request:v.request,choices:v.choices}) ? value as PendingLinkedSetup : null; } catch { return null; }
}
export function linkedSnapshotMatches(snapshot: unknown, expected: SetupEventLinksSnapshot): boolean {
 return isSetupEventLinksSnapshot(snapshot) && snapshot.setupRevisionId === expected.setupRevisionId && snapshot.setupVersion === expected.setupVersion && snapshot.associationHash === expected.associationHash && snapshot.complete === expected.complete && snapshot.choices.length === expected.choices.length && snapshot.choices.every((choice, i) => choice.mainClientRowId === expected.choices[i].mainClientRowId && choice.consolationClientRowIds.length === expected.choices[i].consolationClientRowIds.length && choice.consolationClientRowIds.every((id, j) => id === expected.choices[i].consolationClientRowIds[j]));
}
/** Call only after financial and association readback. Preserve changed records. */
export function clearVerifiedLinkedRecovery(storage: StoragePort, key: string, pending: PendingLinkedSetup, receipt: AcceptedSetupReceipt): 'cleared' | 'conflict' | 'unavailable' {
 try { const raw = storage.getItem(key); const original = parsePendingLinkedSetup(raw); if (!original || JSON.stringify(original) !== JSON.stringify(pending)) return 'conflict'; const ackKey = acceptedSetupKey(key,pending.request.idempotencyKey), ackRaw = storage.getItem(ackKey); if (ackRaw !== null) { const ack = parseAcceptedSetupReceipt(ackRaw,pending.request); if (!ack || ack.revisionId !== receipt.revisionId || ack.version !== receipt.version) return 'conflict'; } storage.removeItem(ackKey); if (storage.getItem(ackKey) !== null) return 'unavailable'; if (storage.getItem(key) !== raw) return 'conflict'; storage.removeItem(key); return storage.getItem(key) === null ? 'cleared' : 'unavailable'; } catch { return 'unavailable'; }
}

/** Clear a definitive rejection only while the exact operation remains and no accepted receipt exists. */
export function clearRejectedLinkedRecovery(storage: StoragePort, key: string, pending: PendingLinkedSetup): 'cleared'|'conflict'|'unavailable' {
 try { const raw=storage.getItem(key), original=parsePendingLinkedSetup(raw);if(!original||JSON.stringify(original)!==JSON.stringify(pending)||storage.getItem(acceptedSetupKey(key,pending.request.idempotencyKey))!==null)return 'conflict';if(storage.getItem(key)!==raw)return 'conflict';storage.removeItem(key);return storage.getItem(key)===null?'cleared':'unavailable'; } catch {return 'unavailable';}
}
