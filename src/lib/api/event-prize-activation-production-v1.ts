import 'server-only';
import {createEventPrizeActivationHandlersV1} from './event-prize-activation-handlers-v1.ts';
import {eventPrizeSetupEnabledV1,requireEventPrizeSetupProjectUrlV1} from './event-prize-setup-admission-v1.ts';
import {apiJson,withApiFailureBoundary} from './route-boundary.ts';
import {readBoundedJson} from './bounded-json.ts';
import {isSameOriginRequest} from './same-origin.ts';
import {createServerOnlyAdminClient} from '../supabase/private-admin.ts';
export const eventPrizeActivationHandlersV1=createEventPrizeActivationHandlersV1({enabled:eventPrizeSetupEnabledV1,readEnabled:eventPrizeSetupEnabledV1,writeEnabled:eventPrizeSetupEnabledV1,recoveryEnabled:eventPrizeSetupEnabledV1,client:async()=>{const project=requireEventPrizeSetupProjectUrlV1();return(await import('../supabase/server.ts')).createClient(project);},admin:()=>{requireEventPrizeSetupProjectUrlV1();return createServerOnlyAdminClient();},json:apiJson,boundary:withApiFailureBoundary,sameOrigin:isSameOriginRequest,readJson:readBoundedJson});
