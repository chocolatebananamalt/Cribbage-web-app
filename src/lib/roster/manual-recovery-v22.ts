import {isUuid} from '../api/validation.ts';
import {isAcceptedManualRosterEntry} from '../api/roster.ts';
export type ManualRecoveryScopeV22={actorId:string;tournamentId:string;sessionId:string;operationId:string};
export function manualRetainedOperationV22(raw:string):string|null{
 try{const v:unknown=JSON.parse(raw);if(!v||typeof v!=='object'||Array.isArray(v))return null;const r=v as Record<string,unknown>;return Object.keys(r).sort().join(',')==='idempotencyKey,kind'&&r.kind==='manual-roster'&&isUuid(r.idempotencyKey)?r.idempotencyKey:null;}catch{return null;}
}
export function acceptedManualRecoveryV22(value:unknown,scope:ManualRecoveryScopeV22):boolean{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const r=value as Record<string,unknown>;
 return Object.values(scope).every(isUuid)&&Object.keys(r).sort().join(',')==='actorId,kind,operationId,result,sessionId,tournamentId'&&r.kind==='manual-roster-recovery-v22'&&r.actorId===scope.actorId&&r.tournamentId===scope.tournamentId&&r.sessionId===scope.sessionId&&r.operationId===scope.operationId&&isAcceptedManualRosterEntry(r.result);
}
