import{createServerOnlyAdminClient}from'../../../../../../../../lib/supabase/private-admin';
import {createConsyAddonDirectorHandlersV1}from'../../../../../../../../lib/api/consy-addon-director-handlers-v1';
import {createClient}from'../../../../../../../../lib/supabase/server';
const h=createConsyAddonDirectorHandlersV1({client:createClient,serviceRpc:(name,args)=>createServerOnlyAdminClient().rpc(name,args)});export const GET=h.GET;export const POST=h.POST;
