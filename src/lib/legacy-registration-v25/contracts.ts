import { isUuid } from '../api/validation.ts';
import { canonicalV5, exactV5, readPlayerV5, scopedV5, type IdentityAccessV5 } from '../identity-v5/contracts.ts';
import { readProfileV8 } from '../identity-adoption-v8/contracts.ts';
import { completeIdentityAddressV3, isIdentityDraftV3, visibleIdentityNameV3, type IdentityDraftV3, type DuplicateDecisionV3 } from '../registration/identity-pre-save-v3.ts';

export type RegistrationV25 = { kind: 'legacy-roster-identity-request-v25'; sourceRevision: number; sourceDigest: string; entry: IdentityDraftV3['entry']; address: IdentityDraftV3['address']; distinction: IdentityDraftV3['distinction']; decision: DuplicateDecisionV3 | null; reason: string };
export const hashV25 = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function validDecisionV25(v: unknown): v is RegistrationV25['decision'] {
  return v === null || exactV5(v, ['action']) && v.action === 'distinct' || exactV5(v, ['action', 'rosterEntryId']) && v.action === 'duplicate' && isUuid(v.rosterEntryId);
}
export function validRegistrationV25(v: unknown): v is RegistrationV25 {
  if (!exactV5(v, ['kind','sourceRevision','sourceDigest','entry','address','distinction','decision','reason']) || v.kind !== 'legacy-roster-identity-request-v25' || !Number.isSafeInteger(v.sourceRevision) || Number(v.sourceRevision) < 0 || !hashV25(v.sourceDigest) || !validDecisionV25(v.decision) || typeof v.reason !== 'string' || !v.reason.trim() || v.reason.length > 500 || /[\u0000-\u001f\u007f]/.test(v.reason)) return false;
  const draft = { kind: 'manual-roster-identity-request-v3', idempotencyKey: 'f2500000-0000-4000-8000-000000000001', entry: v.entry, address: v.address, distinction: v.distinction, privateDeskNote: '' };
  return isIdentityDraftV3(draft) && draft.entry.scorecardType === 'paper' && completeIdentityAddressV3(draft) && visibleIdentityNameV3(draft.entry,draft.distinction)!==null;
}
export async function requestHashV25(q: RegistrationV25) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalV5(q)))), x => x.toString(16).padStart(2,'0')).join('');
}
export type PendingV25 = { kind: 'legacy-roster-identity-pending-v25'; actorId: string; tournamentId: string; operationId: string; requestHash: string; sourceRevision: number; sourceDigest: string; decision: RegistrationV25['decision'] };
/** No names, address, contact, distinguishing text or reason is persisted locally. */
export function readPendingV25(raw: string | null, actorId: string, tournamentId: string): PendingV25 | null {
  try { const v: unknown = JSON.parse(raw ?? 'null'); return exactV5(v,['kind','actorId','tournamentId','operationId','requestHash','sourceRevision','sourceDigest','decision']) && v.kind === 'legacy-roster-identity-pending-v25' && v.actorId === actorId && v.tournamentId === tournamentId && [v.actorId,v.tournamentId,v.operationId].every(isUuid) && hashV25(v.requestHash) && hashV25(v.sourceDigest) && Number.isSafeInteger(v.sourceRevision) && Number(v.sourceRevision) >= 0 && validDecisionV25(v.decision) ? structuredClone(v) as PendingV25 : null; } catch { return null; }
}
export const rejectionCodesV25 = ['stale_source','incomplete_candidate_review','registration_closed','invalid_duplicate','visible_distinction_required','issued_reference_review_required'] as const;
export function readReplyV25(v: unknown, a: IdentityAccessV5, op: string, requestHash: string, q?: RegistrationV25, retainedDecision?: RegistrationV25['decision']) {
  if (!exactV5(v,['kind','actorId','sessionId','tournamentId','operationId','requestHash','outcome']) || v.kind !== 'legacy-roster-identity-reply-v25' || !scopedV5(v,a) || v.operationId !== op || v.requestHash !== requestHash) return null;
  const r = v.outcome;
  if (r === null) return { status: 'absent' as const };
  if (exactV5(r,['status']) && ['binding_review_required','idempotency_conflict'].includes(r.status as string)) return { status: r.status as 'binding_review_required' | 'idempotency_conflict' };
  if (exactV5(r,['status','code','effects']) && r.status === 'rejected' && r.effects === false && rejectionCodesV25.includes(r.code as typeof rejectionCodesV25[number])) return { status: 'rejected' as const, code: r.code as typeof rejectionCodesV25[number] };
  const decision=q?q.decision:retainedDecision;
  if (exactV5(r,['status','rosterEntryId','playerIdentityId']) && r.status === 'open_existing' && isUuid(r.rosterEntryId) && isUuid(r.playerIdentityId) && decision?.action==='duplicate' && decision.rosterEntryId===r.rosterEntryId) return { status: 'open_existing' as const, rosterEntryId: r.rosterEntryId, playerIdentityId:r.playerIdentityId };
  if (!exactV5(r,['status','player','profileLinked','roleGranted','eventEnrolled','paymentRecorded','checkedIn','seatAssigned']) || r.status !== 'recorded' || ['profileLinked','roleGranted','eventEnrolled','paymentRecorded','checkedIn','seatAssigned'].some(k => r[k] !== false)) return null;
  if (decision?.action==='duplicate') return null;
  const p = readPlayerV5(r.player,a);
  if (!p || p.operationId !== op || p.version !== 1 || q && (canonicalV5(p.entry) !== canonicalV5(q.entry) || canonicalV5(p.address) !== canonicalV5(q.address) || canonicalV5(p.distinction) !== canonicalV5(q.distinction))) return null;
  return { status: 'recorded' as const, player: p };
}
export function readWorkspaceV25(v: unknown, actorId: string, tournamentId: string) {
  return exactV5(v,['kind','actorId','sessionId','tournamentId','writesEnabled']) && v.kind === 'legacy-roster-identity-workspace-v25' && v.actorId === actorId && v.tournamentId === tournamentId && [v.actorId,v.sessionId,v.tournamentId].every(isUuid) && typeof v.writesEnabled === 'boolean' ? structuredClone(v) as {kind:string;actorId:string;sessionId:string;tournamentId:string;writesEnabled:boolean} : null;
}
export { readProfileV8 };
