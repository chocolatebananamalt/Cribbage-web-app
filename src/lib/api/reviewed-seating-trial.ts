import { integratedTestBackendRef } from '../integrated-test-target.ts';
/** Source-only deployment contract. Not a provider identity or permission check. */
export const reviewedSeatingTrialProject=integratedTestBackendRef();
export const reviewedSeatingTrialPreviewHost="cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app";
/** Kept literally false until the NEW database scope amendment and actual
 * provider/composition chain are reviewed/runtime-tested. Flags cannot enable. */
export function reviewedSeatingTrialRuntimeReady():false{return false;}
export function matchesReviewedSeatingTrialPreview(env:Record<string,string|undefined>,host:string|null):boolean {
 return env.CRIBBAGE_REVIEWED_SEATING_TRIAL==="1"&&env.NODE_ENV==="production"&&env.VERCEL_ENV==="preview"
 &&env.NEXT_PUBLIC_SUPABASE_URL===`https://${reviewedSeatingTrialProject}.supabase.co`&&host===reviewedSeatingTrialPreviewHost;
}
const scoped=Object.freeze({get_random_seating_workspace_v1:"get_trial_random_seating_workspace_v1",get_random_seating_operation_v1:"get_trial_random_seating_operation_v1",
 get_random_seating_plan_v1:"get_trial_random_seating_plan_v1",save_random_seating_plan_v1:"save_trial_random_seating_plan_v1",draw_random_seating_candidate_v1:"draw_trial_random_seating_candidate_v1"});
/** Code-injected backend seam for a future approved composition. Unknown RPCs
 * fail closed. Not wired to current production or enabled by this mapping. */
export function createScopedTrialDrawRpc(rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>){
 return(name:string,args:Record<string,unknown>)=>{if(!Object.hasOwn(scoped,name))throw new Error("unknown_trial_rpc");return rpc(scoped[name as keyof typeof scoped],args);};
}
