import { integratedTestBackendOrigin } from '../../../../../../../../../../../lib/integrated-test-target.ts';
import type{NextRequest}from'next/server';
import{createClient}from'../../../../../../../../../../../lib/supabase/server';
import{createNativeMixedGameReopenHandlersV1,nativeMixedGameReopenRoutesEnabledV1}from'../../../../../../../../../../../lib/api/native-mixed-game-reopen-v1';
import{getPublicSupabaseEnv}from'../../../../../../../../../../../lib/env';
const enabled=()=>{if(!nativeMixedGameReopenRoutesEnabledV1())return false;try{return getPublicSupabaseEnv().url===integratedTestBackendOrigin();}catch{return false;}};
const handlers=createNativeMixedGameReopenHandlersV1({client:createClient,enabled});
type Context={params:Promise<{id:string;eventId:string;startId:string;gameId:string}>};
export const POST=(r:NextRequest,c:Context)=>handlers.reconcilePOST(r,c);
