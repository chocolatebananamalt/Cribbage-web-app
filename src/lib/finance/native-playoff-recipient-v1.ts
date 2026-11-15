import{resolveEventPlayoffParametersDraftV1}from'../playoffs/event-playoff-parameters-v1.ts';
import'server-only';
import{createHash}from'node:crypto';
import{assembleNativeOperationalFinanceV1}from'./operational-finance-native-assembler-v1.ts';
import{projectRecipientEstimateFromBracketV1}from'./final-recipient-estimate-v1.ts';
import{readNativePlayoffSportingFrameV1}from'../results/native-playoff-sporting-frame-v1.ts';
type Scope={actorId:string;tournamentId:string;eventId:string};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>obj(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&'value'in d&&d.enumerable;});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const int=(v:unknown,min=0,max=2147483647):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max&&!Object.is(v,-0);
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>obj(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const noAuthority={publicAccessGranted:false as const,writeAuthorized:false as const,payoutAuthorized:false as const,finalizationAuthorized:false as const,moneyMoved:false as const};
const fail=(code:string)=>({status:'blocked' as const,code,...noAuthority});

/** Decode only the private locked producer's source contract. This grants no
 * caller, route, human-witness, ledger or disbursement authority. */
export function projectNativeFinalRecipientEstimateV1(value:unknown,scope:Scope){
 try{
  if(!exact(value,['status','kind','actorId','tournamentId','eventId','nativeFinanceSource','proposal','expectedHead','playoff','sourceDigest','proposalOnly','moneyMoved','payoutAuthorized','finalizationAuthorized'])||value.status!=='source_available'||value.kind!=='native-finance-recipient-source-v1'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||!hash(value.sourceDigest)||value.proposalOnly!==true||value.moneyMoved!==false||value.payoutAuthorized!==false||value.finalizationAuthorized!==false)return fail('native_source_unavailable');
  const finance=assembleNativeOperationalFinanceV1(value.nativeFinanceSource,scope);if(!finance)return fail('finance_source_unavailable');
  if(!exact(value.expectedHead,['revisionId','version'])||!uuid(value.expectedHead.revisionId)||!int(value.expectedHead.version,1))return fail('proposal_head_unavailable');
  const raw=value.nativeFinanceSource as {raw:{binding:{bindingId:string;settingsSnapshotId:string;reviewId:string;activationId:string};qualification:null|{resultVersionId:string;version:number;participantCount:number;qualifierCount:number};settings:{draft:unknown}}};
  if(!resolveEventPlayoffParametersDraftV1(raw.raw.settings.draft))return fail('native_source_binding_changed');
  const b=raw.raw.binding;
  const sporting=readNativePlayoffSportingFrameV1({playoff:value.playoff,sourceDigest:value.sourceDigest},scope,raw.raw.qualification,{bindingId:b.bindingId,settingsSnapshotId:b.settingsSnapshotId,reviewId:b.reviewId,activationId:b.activationId},finance.basis.workspace.eventKind,raw.raw.settings.draft);if(sporting.status!=='available')return sporting;const{input,frame}=sporting;
  const nativeContentDigest=createHash('sha256').update(canonical(value)).digest('hex');
  return projectRecipientEstimateFromBracketV1({scope,nativeFinanceSource:value.nativeFinanceSource,proposal:value.proposal,expectedHead:value.expectedHead as {revisionId:string;version:number}},{input,origin:'native-digital-protocol-origin-unverified',notice:'Recorded digital submissions and own confirmations. Physical play and independently verified humans are not established by this estimate.',nativeBinding:{producerSourceDigest:value.sourceDigest,nativeContentDigest,playoff:frame}});
 }catch{return fail('native_source_invalid');}
}
