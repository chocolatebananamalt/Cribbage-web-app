import 'server-only';
import {createEventPrizeActivationHandlersV1} from './event-prize-activation-handlers-v1.ts';
import {eventPrizeSetupTestProjectEnabledV1,eventPrizeSetupTestProjectUrlV1} from './event-prize-setup-test-project-v1.ts';
import {apiJson,withApiFailureBoundary} from './route-boundary.ts';
import {readBoundedJson} from './bounded-json.ts';
import {isSameOriginRequest} from './same-origin.ts';
import {createServerOnlyAdminClient} from '../supabase/private-admin.ts';
export const eventPrizeActivationHandlersV1=createEventPrizeActivationHandlersV1({enabled:eventPrizeSetupTestProjectEnabledV1,readEnabled:eventPrizeSetupTestProjectEnabledV1,writeEnabled:eventPrizeSetupTestProjectEnabledV1,recoveryEnabled:eventPrizeSetupTestProjectEnabledV1,client:async()=>(await import('../supabase/server.ts')).createClient(eventPrizeSetupTestProjectUrlV1),admin:()=>{if(!eventPrizeSetupTestProjectEnabledV1())throw new Error('Latest Setup test project is unavailable.');return createServerOnlyAdminClient();},json:apiJson,boundary:withApiFailureBoundary,sameOrigin:isSameOriginRequest,readJson:readBoundedJson});
