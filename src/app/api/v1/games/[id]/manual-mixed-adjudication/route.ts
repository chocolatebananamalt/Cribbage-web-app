import type {NextRequest} from 'next/server';
import {manualMixedHandoffEnabledV1} from '../../../../../../lib/games/manual-mixed-handoff-v1';
import {isMixedAdjudicationRequestV1,readMixedAdjudicationSourceV1,isMixedAdjudicationReceiptV1,type MixedAdjudicationRequestV1} from '../../../../../../lib/games/manual-mixed-adjudication-v1';
import {createClient} from '../../../../../../lib/supabase/server';
import {requireVerifiedIdentity} from '../../../../../../lib/api/verified-subject';
import {isSameOriginRequest} from '../../../../../../lib/api/same-origin';
import {readBoundedJson} from '../../../../../../lib/api/bounded-json';
import {isUuid} from '../../../../../../lib/api/validation';
const headers={'cache-control':'private, no-store'};
export const dynamic='force-dynamic';
async function run(request:NextRequest,id:string,write:boolean){
 if(!manualMixedHandoffEnabledV1())return Response.json({error:'not_found'},{status:404,headers});if(!isUuid(id)||write&&!isSameOriginRequest(request))return Response.json({error:'invalid_request'},{status:400,headers});
 try{const normal=await createClient(),before=await requireVerifiedIdentity(normal),user=await normal.auth.getUser();if(!before||user.error||user.data.user?.id!==before.subject)return Response.json({error:'unauthorized'},{status:401,headers});
 let r;let sent:MixedAdjudicationRequestV1|null=null;if(write){const body:unknown=await readBoundedJson(request,5000);if(!isMixedAdjudicationRequestV1(body))return Response.json({error:'invalid_request'},{status:400,headers});sent=body;r=await normal.rpc('record_manual_mixed_adjudication_v1',{p_game_id:id,p_request:body});}else r=await normal.rpc('get_manual_mixed_adjudication_source_v1',{p_game_id:id});
 const after=await requireVerifiedIdentity(normal),again=await normal.auth.getUser();if(!after||after.subject!==before.subject||after.sessionId!==before.sessionId||again.error||again.data.user?.id!==before.subject)return Response.json({error:'unauthorized'},{status:401,headers});const v=sent?(isMixedAdjudicationReceiptV1(r.data,before.subject,id,sent)?r.data:null):readMixedAdjudicationSourceV1(r.data,before.subject,id);return !r.error&&v?Response.json(v,{headers}):Response.json({error:'current_source_unavailable'},{status:409,headers});
 }catch{return Response.json({error:'temporarily_unavailable'},{status:503,headers});}
}
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){return run(request,(await params).id,false);}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return run(request,(await params).id,true);}
