import{createClient}from'../../../../../../lib/supabase/server';
import{createRegistrationResolutionHandlersV1}from'../../../../../../lib/api/registration-resolution-handlers-v1';
const handlers=createRegistrationResolutionHandlersV1({client:createClient});
export const GET=handlers.GET;
export const POST=handlers.POST;
