import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import{isUuid}from'../api/validation.ts';
import{isRunningPoolWorkspace,type RunningPoolWorkspace}from'./pool-running-summary.ts';
export const runningPoolPageEnabledV1=()=>integratedTestFeatureEnabled();
type Scope={actorId:string;tournamentId:string;eventId:string};
type Access={actorId:string;roles:string[]};
/** Bind the existing aggregate-only reader to the page's initial official.
 * No source records, credentials, grants, payment or award writes are added. */
export async function readRunningPoolPageV1(o:{scope:Scope;enabled:()=>boolean;access:()=>Promise<Access|null>;read:(tid:string,eid:string)=>Promise<RunningPoolWorkspace|null>}):Promise<RunningPoolWorkspace|null>{
 if(!o.enabled()||![o.scope.actorId,o.scope.tournamentId,o.scope.eventId].every(isUuid))return null;const s=Object.freeze({...o.scope});
 const allowed=(a:Access|null)=>!!a&&a.actorId===s.actorId&&a.roles.some(r=>r==='director'||r==='co_director');
 try{if(!allowed(await o.access())||!o.enabled())return null;const v=await o.read(s.tournamentId,s.eventId);if(!o.enabled()||!allowed(await o.access())||!isRunningPoolWorkspace(v)||v.tournamentId!==s.tournamentId||v.eventId!==s.eventId)return null;return structuredClone(v);}catch{return null;}
}
