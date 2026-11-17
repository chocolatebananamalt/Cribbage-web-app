import { isEventRosterEnrollmentRequest, type EventRosterEnrollmentRequest } from '../api/event-roster-enrollment.ts';
export function readEnrollmentRecoveryV27(raw: string | null): EventRosterEnrollmentRequest | null {
  if(raw===null||raw.length>100000)return null;
  try { const value:unknown=JSON.parse(raw); if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==2||!('kind'in value)||value.kind!=='event-roster-enrollment'||!('request'in value)||!isEventRosterEnrollmentRequest(value.request))return null;return structuredClone(value.request); }catch{return null;}
}
export const enrollmentRecoveryBytesV27=(request:EventRosterEnrollmentRequest)=>JSON.stringify({kind:'event-roster-enrollment',request});
/** A conflicting operation reference never proves this retained request had no effects. */
export const canFinishRejectedEnrollmentV27=(code:string)=>['event_not_approved','event_already_started','roster_entry_unavailable','not_checked_in','profile_already_enrolled'].includes(code);
