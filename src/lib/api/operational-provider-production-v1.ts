import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import{createClient}from'../supabase/server.ts';
import{apiJson,withApiFailureBoundary}from'./route-boundary.ts';
import{isSameOriginRequest}from'./same-origin.ts';
import{createOperationalProviderHandlersV1}from'./operational-provider-handlers-v1.ts';
import{readOperationalProviderJsonV1}from'./operational-provider-request-reader-v1.ts';
import{createOperationalProviderTransportV1}from'./operational-provider-transport-v1.ts';

/** Literal false until authenticated provider/runtime acceptance is completed.
 * Environment variables cannot enable this candidate accidentally. */
export const operationalProviderRoutesEnabledV1=()=>integratedTestFeatureEnabled();

export const operationalProviderHandlersV1=createOperationalProviderHandlersV1({
 enabled:operationalProviderRoutesEnabledV1,
 port:async()=>createOperationalProviderTransportV1(await createClient(),operationalProviderRoutesEnabledV1),
 readJson:readOperationalProviderJsonV1,
 sameOrigin:isSameOriginRequest,
 json:apiJson,
 boundary:withApiFailureBoundary,
});
