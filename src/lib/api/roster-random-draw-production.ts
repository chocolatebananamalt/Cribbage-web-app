import "server-only";
import{fictionalDrawBoundaryEnabled}from"./fictional-draw-enabled";
import{createScopedTrialDrawRpc}from"./reviewed-seating-trial";
import{createRosterDrawHandlers}from"./roster-random-draw-handlers";
import{apiJson,requireVerifiedSubject,withApiFailureBoundary}from"./route-boundary";
import{readBoundedJson}from"./bounded-json";
import{isSameOriginRequest}from"./same-origin";
import{createClient}from"../supabase/server";
import{createServerOnlyAdminClient}from"../supabase/private-admin";
export function createRosterDrawProductionHandlers(){const fictionalScope=fictionalDrawBoundaryEnabled();const rpc=async(name:string,args:Record<string,unknown>)=>createServerOnlyAdminClient().rpc(name,args);return createRosterDrawHandlers({env:process.env,fictionalScope,identity:async()=>requireVerifiedSubject(await createClient()),rpc:fictionalScope?createScopedTrialDrawRpc(rpc):rpc,readJson:r=>readBoundedJson(r,24576),sameOrigin:isSameOriginRequest,json:apiJson,boundary:withApiFailureBoundary});}

