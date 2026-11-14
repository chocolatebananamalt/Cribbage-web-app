import{createServerOnlyAdminClient}from'../../../../../../../../../lib/supabase/private-admin';
import {createConsyAddonDirectorHandlersV1}from'../../../../../../../../../lib/api/consy-addon-director-handlers-v1';
import {createClient}from'../../../../../../../../../lib/supabase/server';
export const POST=createConsyAddonDirectorHandlersV1({client:createClient,serviceRpc:(name,args)=>createServerOnlyAdminClient().rpc(name,args)}).reconcilePOST;
