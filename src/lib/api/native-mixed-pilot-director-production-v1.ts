import{createNativeMixedPreparationHandlersV1}from'./native-mixed-pilot-preparation-handlers-v1';
import 'server-only';
import{createNativeMixedPilotDirectorHandlersV1}from'./native-mixed-pilot-director-handlers-v1';
import{createClient}from'../supabase/server';
import{createServerOnlyAdminClient}from'../supabase/private-admin';
import{apiJson,withApiFailureBoundary}from'./route-boundary';
import{readBoundedJson}from'./bounded-json';
import{isSameOriginRequest}from'./same-origin';
/** Unmounted, disabled production seam. No environment flag can enable it. */
export function createNativeMixedPilotDirectorProductionHandlersV1(){
 return createNativeMixedPilotDirectorHandlersV1({projectUrl:process.env.NEXT_PUBLIC_SUPABASE_URL??'',projectRef:'nnhcnvksxgxnpvdqjgpg',
  authenticated:createClient,privileged:async()=>createServerOnlyAdminClient(),readJson:readBoundedJson,sameOrigin:isSameOriginRequest,json:apiJson,boundary:withApiFailureBoundary});
}

export function createNativeMixedPilotPreparationProductionHandlersV1(){return createNativeMixedPreparationHandlersV1({projectUrl:process.env.NEXT_PUBLIC_SUPABASE_URL??'',projectRef:'nnhcnvksxgxnpvdqjgpg',authenticated:createClient,privileged:async()=>createServerOnlyAdminClient(),json:apiJson,boundary:withApiFailureBoundary});}
