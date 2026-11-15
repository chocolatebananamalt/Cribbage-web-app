import 'server-only';
import {createMixedHandlers}from'./synthetic-mixed-handlers';
import {apiJson,readSmallJson,requireVerifiedSubject,withApiFailureBoundary}from'./route-boundary';
import {isSameOriginRequest}from'./same-origin';
import {createClient}from'../supabase/server';
import {createServerOnlyAdminClient}from'../supabase/private-admin';
export function createMixedProductionHandlers(){return createMixedHandlers({env:process.env,json:apiJson,boundary:withApiFailureBoundary,readJson:readSmallJson,sameOrigin:isSameOriginRequest,
 getIdentity:async()=>{const client=await createClient(),actorId=await requireVerifiedSubject(client);return actorId?{actorId,rpc:async(name,args)=>await client.rpc(name,args)}:null;},
 adminRpc:async(name,args)=>await createServerOnlyAdminClient().rpc(name,args)});}
