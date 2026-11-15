import {projectPlayoffPrizeBrowserWorkspaceV2,projectPlayoffPrizeBrowserReplyV2} from '../finance/playoff-prize-proposal-browser-projector-v2.ts';
import 'server-only';
import {createPlayoffPrizeProposalHandlersV2,playoffPrizeProposalProviderEnabledV2} from './playoff-prize-proposal-handlers-v2.ts';
import {apiJson,withApiFailureBoundary} from './route-boundary.ts';
import {isSameOriginRequest} from './same-origin.ts';
import {readBoundedJson} from './bounded-json.ts';
export const playoffPrizeProposalHandlersV2=createPlayoffPrizeProposalHandlersV2({enabled:playoffPrizeProposalProviderEnabledV2,readEnabled:()=>false,writeEnabled:()=>false,recoveryEnabled:()=>false,client:async()=>(await import('../supabase/server.ts')).createClient(),sameOrigin:isSameOriginRequest,readJson:readBoundedJson,json:apiJson,boundary:withApiFailureBoundary,projectWorkspace:projectPlayoffPrizeBrowserWorkspaceV2,projectReply:projectPlayoffPrizeBrowserReplyV2});
