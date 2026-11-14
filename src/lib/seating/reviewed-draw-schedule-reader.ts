import "server-only";
import { isUuid } from "../api/validation.ts";
import { isEventScheduleWorkspace } from "../api/event-schedule.ts";
import { prepareReviewedDrawSchedule, type ReviewedDrawSchedulePreview } from "./reviewed-draw-schedule.ts";
type Access={actorId:string;roles:string[]};
type Models={operation:unknown;nativeWorkspace:unknown;eventWorkspace:unknown;eventStatusWorkspace:unknown;eventLifecycleWorkspace:unknown;loadedScope:{actorId:string;tournamentId:string;eventId:string}};
const uuid=(v:unknown):v is string=>isUuid(v)&&v===v.toLowerCase();
const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical).join(",")}]`:v&&typeof v==="object"?`{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+":"+canonical(x)).join(",")}}`:JSON.stringify(v)??"null";
/** Private current-Director reader only; no route/access grant or write.
 * Matching observations are NOT an atomic source-current publication proof. */
export function createReviewedDrawScheduleReader(d:{access:(tid:string)=>Promise<Access|null>;models:(actorId:string,tid:string,operationId:string)=>Promise<Models>}){
 return async(tournamentId:string,operationId:string):Promise<ReviewedDrawSchedulePreview>=>{
  const blocked=(code:string):ReviewedDrawSchedulePreview=>({status:"blocked",code});
  if(![tournamentId,operationId].every(uuid))return blocked("invalid_scope");
  const allowed=(a:Access|null):a is Access=>!!a&&uuid(a.actorId)&&a.roles.some(r=>r==="director"||r==="co_director");
  function project(a:Access,m:Models){if(!isEventScheduleWorkspace(m.eventWorkspace)||m.eventWorkspace.events.length!==1)return blocked("single_event_required");
   if(!m.operation||typeof m.operation!=="object"||!("operationId"in m.operation)||m.operation.operationId!==operationId)return blocked("reviewed_publication_unavailable");
   return prepareReviewedDrawSchedule({actorId:a.actorId,tournamentId,eventId:m.eventWorkspace.events[0].eventId,operation:m.operation,nativeWorkspace:m.nativeWorkspace,eventWorkspace:m.eventWorkspace,eventStatusWorkspace:m.eventStatusWorkspace,eventLifecycleWorkspace:m.eventLifecycleWorkspace,loadedScope:m.loadedScope});}
  try{const a=await d.access(tournamentId);if(!allowed(a))return blocked("existing_read_permission_required");
   const first=structuredClone(await d.models(a.actorId,tournamentId,operationId)),fingerprint=canonical(first),preview=project(a,first);if(preview.status==="blocked")return preview;
   const b=await d.access(tournamentId);if(!allowed(b)||b.actorId!==a.actorId)return blocked("existing_read_permission_required");
   const second=structuredClone(await d.models(a.actorId,tournamentId,operationId)),c=await d.access(tournamentId);
   if(!allowed(c)||c.actorId!==a.actorId)return blocked("existing_read_permission_required");
   if(canonical(second)!==fingerprint)return blocked("observed_source_changed");
   const current=project(c,second);return current.status==="prepared-not-authorized"?{...current,sourceObservation:"matching-double-read-not-atomic"}:current;
  }catch{return blocked("read_models_unavailable");}
 };
}
