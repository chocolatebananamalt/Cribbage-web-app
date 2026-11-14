import 'server-only';
import {createEventPrizeProviderV1} from './event-prize-provider-handlers-v1.ts';
import {eventPrizeSetupEnabledV1,requireEventPrizeSetupProjectUrlV1} from './event-prize-setup-admission-v1.ts';
import {apiJson,withApiFailureBoundary} from './route-boundary.ts';
import {isSameOriginRequest} from './same-origin.ts';
import {readBoundedJson} from './bounded-json.ts';
export const eventPrizeProviderEnabledV1=eventPrizeSetupEnabledV1;
export const eventPrizeProviderV1=createEventPrizeProviderV1({enabled:eventPrizeProviderEnabledV1,readEnabled:eventPrizeProviderEnabledV1,writeEnabled:eventPrizeProviderEnabledV1,recoveryEnabled:eventPrizeProviderEnabledV1,client:async()=>{const project=requireEventPrizeSetupProjectUrlV1();return(await import('../supabase/server.ts')).createClient(project);},sameOrigin:isSameOriginRequest,readJson:readBoundedJson,json:apiJson,boundary:withApiFailureBoundary});
