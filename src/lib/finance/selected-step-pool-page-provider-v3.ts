import 'server-only';
import{createSelectedStepPoolJournalTransportV3}from'./selected-step-pool-journal-transport-v3.ts';
import{projectSelectedStepPoolSourceV3}from'./selected-step-pool-source-v3.ts';
import{modernPrizeSameV2}from'./modern-prize-journal-contract-v2.ts';
import{readSelectedStepPoolAttemptV3,readSelectedStepPoolReceiptV3,type SelectedStepPoolAttemptV3}from'./selected-step-pool-contract-v3.ts';
type Context=Parameters<typeof createSelectedStepPoolJournalTransportV3>[0];
/** Only this source-verified accepted envelope can clear a retained request.
 * Bare errors/rejections/unknowns never become durable cleanup evidence. */
export async function sendSelectedStepPoolAttemptV3(o:Context,attempt:SelectedStepPoolAttemptV3,recover:boolean){
 const a=readSelectedStepPoolAttemptV3(attempt,o.scope);if(!a)throw Error('invalid_attempt');const port=createSelectedStepPoolJournalTransportV3(o);
 const result=await(recover?port.recover(a.operationId,a.request):port.record(a.operationId,a.request));
 const receipt=readSelectedStepPoolReceiptV3(result,a.scope,a.operationId,a.request);
 if(!receipt){const r=result as{status?:unknown;code?:unknown};if(['rejected','retry_exact'].includes(r.status as string))return{status:r.status,attempt:a,code:r.code};return{status:'unknown',attempt:a,code:'operation_unverified'};}
 const fixed=a.scope;
 async function authorized(){if(!o.enabled()||!o.writesVerified())return false;const before=await o.authenticated.auth.getUser();if(before.error||before.data?.user?.id!==fixed.actorId)return false;const role=await o.authenticated.rpc('get_tournament_role',{p_tournament_id:fixed.tournamentId});const after=await o.authenticated.auth.getUser();return !role.error&&role.data==='director'&&!after.error&&after.data?.user?.id===fixed.actorId&&o.enabled()&&o.writesVerified();}
 if(!await authorized())throw Error('outcome_unknown');const proof=await o.serviceRpc('get_selected_step_pool_operation_proof_provider_v3',{actor:a.scope.actorId,tid:a.scope.tournamentId,eid:a.scope.eventId,op:a.operationId,request:a.request});if(proof.error||!await authorized()||!proof.data||typeof proof.data!=='object')throw Error('outcome_unknown');
 const p=proof.data as{receipt?:unknown;sourceCapture?:unknown},review=projectSelectedStepPoolSourceV3(p.sourceCapture,a.scope);
 if(!modernPrizeSameV2(p.receipt,receipt)||!review||!modernPrizeSameV2(review,a.review)||receipt.qMinor!==review.qMinor||receipt.sideMinor!==review.sideMinor||receipt.totalMinor!==review.totalMinor)throw Error('outcome_unknown');
 return{status:'accepted',attempt:a,receipt,reviewedSource:review};
}
