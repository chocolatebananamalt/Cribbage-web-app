import 'server-only';
import {readPlayoffPrizeProposalWorkspaceV2,readPlayoffPrizeProposalReplyV2,revisionProposal,type PlayoffPrizeProposalRevisionV2,type PlayoffPrizeProposalSaveV2} from './playoff-prize-proposal-store-v2.ts';
import {assemblePlayoffPrizeNativeSourceV2} from './playoff-prize-native-read-v2.ts';
import {readPlayoffPrizeBrowserHeadV2,readPlayoffPrizeBrowserWorkspaceV2,type PlayoffPrizeBrowserScopeV2,type PlayoffPrizeBrowserHeadV2,type PlayoffPrizeBrowserWorkspaceV2,type PlayoffPrizeBrowserEvidenceV2,type PlayoffPrizeBrowserOperationV2,type PlayoffPrizeBrowserAttemptV2} from '../api/playoff-prize-proposal-browser-v2.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const flags={writeAuthorized:false as const,finalizationAllowed:false as const,payoutAuthorized:false as const,moneyMoved:false as const};
function evidence(value:unknown):PlayoffPrizeBrowserEvidenceV2|null{
 if(!object(value)||!object(value.capture)||!object(value.coverage))return null;
 return structuredClone({capture:value.capture,coverage:value.coverage}) as PlayoffPrizeBrowserEvidenceV2;
}
function head(value:PlayoffPrizeProposalRevisionV2):PlayoffPrizeBrowserHeadV2|null{
 const proposal=revisionProposal(value),sourceEvidence=evidence(value.sourceCapture);if(!proposal||!sourceEvidence)return null;
 return readPlayoffPrizeBrowserHeadV2({revisionId:value.revisionId,version:value.version,priorRevisionId:value.priorRevisionId,actorId:value.actorId,operationId:value.operationId,tournamentId:value.tournamentId,eventId:value.eventId,nativeSourceDigest:value.nativeSourceDigest,mode:value.mode,reason:value.reason,createdAt:value.createdAt,sourceEvidence,proposal,proposalOnly:true,payoutAuthorized:false,moneyMoved:false},value);
}
/** Projection only after the EXISTING authenticated-scope server validators.
 * No endpoint, provider, flag, client construction or persistence is introduced.
 * The browser receives derived source pins; no Node/qualification validator is
 * imported into its module graph. Raw store/native contracts stay unchanged. */
export function projectPlayoffPrizeBrowserWorkspaceV2(value:unknown,scope:PlayoffPrizeBrowserScopeV2):PlayoffPrizeBrowserWorkspaceV2|null{
 const workspace=readPlayoffPrizeProposalWorkspaceV2(value,scope);if(!workspace)return null;
 const historical=workspace.head?head(workspace.head):null;if(workspace.head&&!historical)return null;
 const native=assemblePlayoffPrizeNativeSourceV2(workspace.nativeSource,scope),sourceEvidence=native?evidence(workspace.nativeSource):null;
 if(native&&(!sourceEvidence||!object(workspace.nativeSource)||!object(workspace.nativeSource.capture)))return null;
 const current=native&&sourceEvidence?{nativeSourceDigest:native.nativeSourceDigest,nativeInput:structuredClone(sourceEvidence.capture.input),evidence:sourceEvidence,proposal:{source:native.basis.source,input:native.basis.input,overrideHistory:[]}}:null;
 return readPlayoffPrizeBrowserWorkspaceV2({kind:'playoff-prize-proposal-browser-workspace-v2',...scope,current,head:historical,stale:workspace.stale,...flags},scope);
}
export function projectPlayoffPrizeBrowserReplyV2(value:unknown,scope:PlayoffPrizeBrowserScopeV2,request:PlayoffPrizeProposalSaveV2):PlayoffPrizeBrowserOperationV2|PlayoffPrizeBrowserAttemptV2|null{
 const reply=readPlayoffPrizeProposalReplyV2(value,scope,request);if(!reply)return null;
 if(reply.kind==='playoff-prize-proposal-attempt-v2')return structuredClone(reply);
 if(reply.result.status==='rejected')return{kind:'playoff-prize-proposal-browser-operation-v2',...scope,operationId:reply.operationId,requestText:reply.requestText,requestHash:reply.requestHash,result:structuredClone(reply.result),...flags};
 const historical=head(reply.result.revision);if(!historical)return null;
 return{kind:'playoff-prize-proposal-browser-operation-v2',...scope,operationId:reply.operationId,requestText:reply.requestText,requestHash:reply.requestHash,result:{status:'saved',head:historical},...flags};
}
