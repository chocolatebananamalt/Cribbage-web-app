import 'server-only';
import{createNativeMixedBootstrapHandlersV1}from'./native-mixed-bootstrap-handlers-v1';
import{createClient}from'../supabase/server';
import{createServerOnlyAdminClient}from'../supabase/private-admin';
import{apiJson,withApiFailureBoundary}from'./route-boundary';
import{readBoundedJson}from'./bounded-json';
import{isSameOriginRequest}from'./same-origin';
export function createNativeMixedBootstrapProductionHandlersV1(){return createNativeMixedBootstrapHandlersV1({projectUrl:process.env.NEXT_PUBLIC_SUPABASE_URL??'',projectRef:'nnhcnvksxgxnpvdqjgpg',authenticated:createClient,privileged:async()=>createServerOnlyAdminClient(),readJson:readBoundedJson,sameOrigin:isSameOriginRequest,json:apiJson,boundary:withApiFailureBoundary});}
