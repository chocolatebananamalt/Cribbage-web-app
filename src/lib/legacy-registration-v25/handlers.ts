import { readMediumJson } from '../api/bounded-json.ts';
import { isUuid } from '../api/validation.ts';
import { exactV5, type IdentityAccessV5 } from '../identity-v5/contracts.ts';
import { completeIdentityAddressV3, identityMatchFingerprintV3, isIdentityDraftV3, readDuplicateSnapshotV3 } from '../registration/identity-pre-save-v3.ts';
import { hashV25, readReplyV25, requestHashV25, validDecisionV25, validRegistrationV25 } from './contracts.ts';
import { legacyRegistrationProviderV25 } from './provider.ts';

export function createLegacyRegistrationHandlersV25(d: {enabled:()=>boolean;access:(r:Request,tid:string)=>Promise<IdentityAccessV5|null>;sameOrigin:(r:Request)=>boolean;provider:ReturnType<typeof legacyRegistrationProviderV25>}) {
  const json = (v:unknown,status=200) => Response.json(v,{status,headers:{'cache-control':'private, no-store'}});
  return async (r: Request, tid: string, action: string, preparedBody?: unknown) => {
    try {
      if (!d.enabled()) return json({error:'legacy_identity_registration_unavailable'},503);
      if (!isUuid(tid) || !['workspace','prepare','write','reconcile','profile'].includes(action)) return json({error:'invalid_scope'},400);
      const post = ['prepare','write','reconcile'].includes(action);
      if (r.method !== (post?'POST':'GET')) return json({error:'method_not_allowed'},405);
      if (post && !d.sameOrigin(r)) return json({error:'invalid_origin'},403);
      const observed = await d.access(r,tid);
      if (!observed || observed.role !== 'director' || observed.tournamentId !== tid || ![observed.actorId,observed.sessionId].every(isUuid)) return json({error:'forbidden'},403);
      const a = Object.freeze({...observed});
      const actorPin=r.headers.get('x-identity-actor'),sessionPin=r.headers.get('x-identity-session');
      if (actorPin!==null&&actorPin!==a.actorId || sessionPin!==null&&sessionPin!==a.sessionId || post&&(actorPin!==a.actorId||sessionPin!==a.sessionId)) return json({error:'identity_view_changed'},409);
      const current = async () => { const now=await d.access(r,tid);return !!now&&now.role==='director'&&now.actorId===a.actorId&&now.sessionId===a.sessionId&&now.tournamentId===tid; };
      const cap = await d.provider.capability(a);
      if (!cap) return json({error:'legacy_identity_capability_unavailable'},503);
      if (action==='write'&&!cap.writesEnabled) return json({error:'legacy_identity_writes_paused'},503);
      if (action === 'workspace') return await current()?json({kind:'legacy-roster-identity-workspace-v25',actorId:a.actorId,sessionId:a.sessionId,tournamentId:tid,writesEnabled:cap.writesEnabled}):json({error:'identity_view_changed'},409);
      if (action === 'profile') {
        const rid = new URL(r.url).searchParams.get('rosterEntryId');
        if (!isUuid(rid)) return json({error:'invalid_scope'},400);
        const p = await d.provider.profile(a,rid);
        return p&&await current()?json(p):json({error:'profile_binding_review_required'},503);
      }
      const body = preparedBody === undefined ? await readMediumJson(r) : preparedBody;
      if (action === 'prepare') {
        if (!isIdentityDraftV3(body) || body.privateDeskNote!=='' || body.entry.scorecardType!=='paper' || !completeIdentityAddressV3(body)) return json({error:'complete_paper_identity_required'},400);
        const fixed=structuredClone(body),fingerprint=await identityMatchFingerprintV3(fixed);
        const raw=await d.provider.prepare(a,fixed.entry,fixed.address);
        if (!exactV5(raw,['sourceRevision','sourceDigest','coverage','matches']) || !fingerprint) return json({error:'identity_review_unavailable'},503);
        const snapshot=readDuplicateSnapshotV3({kind:'identity-duplicate-snapshot-v3',actorId:a.actorId,sessionId:a.sessionId,tournamentId:tid,reviewId:crypto.randomUUID(),matchFingerprint:fingerprint,...raw},a,fingerprint);
        return snapshot&&await current()?json(snapshot):json({error:'identity_review_unavailable'},503);
      }
      if (!exactV5(body,action==='write'?['operationId','requestHash','request']:['operationId','requestHash','decision']) || !isUuid(body.operationId) || !hashV25(body.requestHash) || action==='reconcile'&&!validDecisionV25(body.decision)) return json({error:'invalid_request'},400);
      const operationId=body.operationId,requestHash=body.requestHash;
      if (action==='write' && (!validRegistrationV25(body.request) || await requestHashV25(body.request)!==requestHash)) return json({error:'retained_request_does_not_match'},409);
      if (!await current()) return json({error:'identity_view_changed'},409);
      const value=action==='write'?await d.provider.write(a,operationId,requestHash,structuredClone(body.request) as Parameters<typeof requestHashV25>[0]):await d.provider.reconcile(a,operationId,requestHash);
      if (!readReplyV25(value,a,operationId,requestHash,action==='write'?body.request as Parameters<typeof requestHashV25>[0]:undefined,action==='reconcile'?body.decision as Parameters<typeof readReplyV25>[5]:undefined) || !await current()) return json({error:'operation_outcome_unconfirmed'},503);
      return json(value);
    } catch { return json({error:'legacy_identity_registration_unconfirmed'},503); }
  };
}
