import { type NextRequest } from 'next/server';
import { apiJson, readMediumJson, requireVerifiedSubject, withApiFailureBoundary } from '../../../../../../../../lib/api/route-boundary';
import { isSameOriginRequest } from '../../../../../../../../lib/api/same-origin';
import { isUuid } from '../../../../../../../../lib/api/validation';
import { isConsolationRequest, isConsolationWorkspace, isConsolationResult } from '../../../../../../../../lib/api/consolation-playoff';
import { getSyntheticEventContext } from '../../../../../../../../lib/paper-games/synthetic-event-context';
import { createServerOnlyAdminClient } from '../../../../../../../../lib/supabase/private-admin';
import { createClient } from '../../../../../../../../lib/supabase/server';
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}) {return withApiFailureBoundary(async()=>{
 const {id,eventId}=await params;if(!isUuid(id)||!isUuid(eventId))return apiJson({error:'invalid_playoff'},{status:400});
 const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:'unauthorized'},{status:401});
 const {data,error}=await createServerOnlyAdminClient().rpc('get_consolation_playoff_workspace_v1',{actor,tid:id,eid:eventId});
 return error?apiJson({error:'playoff_unavailable'},{status:503}):data===null?apiJson({error:'forbidden'},{status:403}):isConsolationWorkspace(data,id,eventId)?apiJson(data):apiJson({error:'playoff_unavailable'},{status:503});
});}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}) {return withApiFailureBoundary(async()=>{
 if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});
 const {id,eventId}=await params,operationId=request.headers.get('x-idempotency-key'),body=await readMediumJson(request);
 if(!isUuid(id)||!isUuid(eventId)||!isUuid(operationId)||!isConsolationRequest(body))return apiJson({error:'invalid_playoff'},{status:400});
 const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:'unauthorized'},{status:401});
 const context=await getSyntheticEventContext(actor,id);
 if(!context?.eventIds.includes(eventId)||!context.artifacts.some(a=>a.artifactId===body.artifactId&&a.eventId===eventId&&a.kind==='playoff'&&a.sourceDigest===body.sourceDigest&&a.payload.qualificationResultVersionId===body.qualificationResultVersionId&&a.payload.expectedVersion===body.expectedVersion&&Array.isArray(a.payload.series)&&a.payload.series.length===3&&body.series.every((s,i)=>{const p=(a.payload.series as Array<Record<string,unknown>>)[i];return p?.winnerId===s.winnerId&&p?.loserId===s.loserId&&s.evidenceNote===`${a.reference}:${i+1}`;})))return apiJson({error:'synthetic_evidence_required'},{status:403});
 const {data,error}=await createServerOnlyAdminClient().rpc('record_consolation_playoff_outcomes_v1',{actor,tid:id,eid:eventId,req:body,op:operationId});
 return error?apiJson({error:'playoff_unavailable'},{status:503}):data===null?apiJson({error:'forbidden'},{status:403}):isConsolationResult(data,id,eventId)?apiJson(data,{status:data.status==='rejected'?409:200}):apiJson({error:'playoff_unavailable'},{status:503});
});}
