import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import{createClient}from'../supabase/server.ts';
import{apiJson,withApiFailureBoundary}from'./route-boundary.ts';
import{isSameOriginRequest}from'./same-origin.ts';
import{readOperationalProviderJsonV1}from'./operational-provider-request-reader-v1.ts';
import{createOperationalFinanceSourceAdoptionHandlersV1}from'./operational-finance-source-adoption-handlers-v1.ts';
import{createOperationalFinanceSourceAdoptionTransportV1}from'./operational-finance-source-adoption-transport-v1.ts';

/** Literal false until source-adoption, allocation and real provider acceptance
 * are completed. Environment variables cannot enable this candidate. */
export const operationalFinanceSourceAdoptionRoutesEnabledV1=()=>integratedTestFeatureEnabled();
export const operationalFinanceSourceAdoptionHandlersV1=createOperationalFinanceSourceAdoptionHandlersV1({
 enabled:operationalFinanceSourceAdoptionRoutesEnabledV1,
 port:async()=>createOperationalFinanceSourceAdoptionTransportV1(await createClient(),operationalFinanceSourceAdoptionRoutesEnabledV1),
 readJson:readOperationalProviderJsonV1,sameOrigin:isSameOriginRequest,json:apiJson,boundary:withApiFailureBoundary,
});
