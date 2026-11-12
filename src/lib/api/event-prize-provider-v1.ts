import 'server-only';
import {createEventPrizeProviderV1} from './event-prize-provider-handlers-v1.ts';
import {eventPrizeSetupTestProjectEnabledV1,eventPrizeSetupTestProjectUrlV1} from './event-prize-setup-test-project-v1.ts';
import {apiJson,withApiFailureBoundary} from './route-boundary.ts';
import {isSameOriginRequest} from './same-origin.ts';
import {readBoundedJson} from './bounded-json.ts';
export const eventPrizeProviderEnabledV1=eventPrizeSetupTestProjectEnabledV1;
export const eventPrizeProviderV1=createEventPrizeProviderV1({enabled:eventPrizeProviderEnabledV1,readEnabled:eventPrizeProviderEnabledV1,writeEnabled:eventPrizeProviderEnabledV1,recoveryEnabled:eventPrizeProviderEnabledV1,client:async()=>(await import('../supabase/server.ts')).createClient(eventPrizeSetupTestProjectUrlV1),sameOrigin:isSameOriginRequest,readJson:readBoundedJson,json:apiJson,boundary:withApiFailureBoundary});
