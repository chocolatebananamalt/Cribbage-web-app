import 'server-only';
import {isEventPrizeResponseValueV1} from '../api/event-prize-settings-v1.ts';
import {buildPlayoffPrizeProposalBasisV2} from './playoff-prize-proposal-basis-v2.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
type Scope={actorId:string;tournamentId:string;eventId:string};
/** The server supplies authenticated scope. This validates/reconstructs a
 * private SQL capture; neither matching IDs nor an opaque digest prove auth. */
export function assemblePlayoffPrizeNativeSourceV2(value:unknown,scope:Scope){
 if(![scope.actorId,scope.tournamentId,scope.eventId].every(uuid)||!isEventPrizeResponseValueV1(value)
 ||!exact(value,['status','kind','actorId','tournamentId','eventId','sourceDigest','capture','coverage','proposalOnly','finalizationAllowed','payoutAuthorized','moneyMoved'])
 ||value.status!=='source_available'||value.kind!=='playoff-prize-native-source-v2'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||typeof value.sourceDigest!=='string'||!/^[a-f0-9]{64}$/.test(value.sourceDigest)||value.proposalOnly!==true||value.finalizationAllowed!==false||value.payoutAuthorized!==false||value.moneyMoved!==false
 ||!exact(value.capture,['bindingId','activationId','setupEventVersionId','contextReviewId','intentActorId','intentOperationId','input'])||![value.capture.bindingId,value.capture.activationId,value.capture.setupEventVersionId,value.capture.contextReviewId,value.capture.intentActorId,value.capture.intentOperationId].every(uuid)
 ||!exact(value.coverage,['additionalIncome','optionalPools','feeCoverage','fundReview'])||value.coverage.additionalIncome!=='not_supported'||value.coverage.optionalPools!=='blocked'||value.coverage.feeCoverage!=='unverified'||value.coverage.fundReview!=='unverified')return null;
 const basis=buildPlayoffPrizeProposalBasisV2(value.capture.input);
 if(basis.status!=='proposal_basis'||basis.ledgerMode!=='documented_actual'||basis.source.tournamentId!==scope.tournamentId||basis.source.eventId!==scope.eventId)return null;
 const input=value.capture.input;
 if(!object(input)||!object(input.ledger)||!object(input.ledger.current)||!Array.isArray(input.ledger.current.sources)
 ||input.ledger.current.sources.some(s=>!object(s)||!['entry_receipt','expense'].includes(s.kind as string)||!Array.isArray(s.allocations)||s.allocations.some(p=>!object(p)||p.poolId!==null||!['regular_entry','player_benefit','operating_expense'].includes(p.bucket as string))))return null;
 return{kind:'playoff-prize-native-estimate-v2' as const,...scope,nativeSourceDigest:value.sourceDigest,provenance:structuredClone({bindingId:value.capture.bindingId,activationId:value.capture.activationId,setupEventVersionId:value.capture.setupEventVersionId,contextReviewId:value.capture.contextReviewId,intentActorId:value.capture.intentActorId,intentOperationId:value.capture.intentOperationId}),coverage:structuredClone(value.coverage),basis,coverageReviewRequired:true as const,recipientAssignmentAllowed:false as const,finalizationAllowed:false as const,payoutAuthorized:false as const,moneyMoved:false as const};
}
type Access={actorId:string;roles:string[]};
const permitted=(v:Access|null):v is Access=>!!v&&uuid(v.actorId)&&Array.isArray(v.roles)&&v.roles.every(x=>typeof x==='string')&&v.roles.some(x=>x==='director'||x==='co_director');
/** Private default-off composition. No client construction, public route,
 * service impersonation, grant or deployment is introduced here. */
export function createPlayoffPrizeNativeReadV2(d:{enabled?:()=>boolean;access:(tournamentId:string)=>Promise<Access|null>;readPrivateSource:(scope:Scope)=>Promise<unknown>}){
 return async(scope:{tournamentId:string;eventId:string;audience:'existing-official'|'player'|'public'})=>{
  const fail=(code:string)=>({status:'unavailable' as const,code,writeAuthorized:false as const,payoutAuthorized:false as const});
  try{if(d.enabled?.()!==true)return fail('disabled');if(!scope||!uuid(scope.tournamentId)||!uuid(scope.eventId)||scope.audience!=='existing-official')return fail('invalid_or_unauthorized_scope');
   const tid=scope.tournamentId,eid=scope.eventId,before=await d.access(tid);if(!permitted(before))return fail('permission_required');const actorId=before.actorId;
   const raw=await d.readPrivateSource({actorId,tournamentId:tid,eventId:eid});
   const after=await d.access(tid);if(d.enabled?.()!==true||!permitted(after)||after.actorId!==actorId)return fail('permission_required');
   const source=assemblePlayoffPrizeNativeSourceV2(raw,{actorId,tournamentId:tid,eventId:eid});return source?{status:'native_prize_estimate' as const,...source,noStoreRequired:true as const,providerSessionVerified:false as const,writeAuthorized:false as const}:fail('source_unavailable');
  }catch{return fail('source_unavailable');}
 };
}
