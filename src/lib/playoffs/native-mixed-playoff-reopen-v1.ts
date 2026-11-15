import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
/** Dedicated simulated Playoff correction contract. No qualifying writer,
 * winner selection, storage, provider, role grant or verification authority. */
export const playoffReopenRoutesEnabledV1=()=>integratedTestFeatureEnabled();
export type PlayoffReopenTargetV1={actorId:string;sessionId:string;projectUrl:string;projectRef:string;tournamentId:string;eventId:string;contextId:string;slot:number;gameNumber:number};
export type PlayoffReopenRequestV1={kind:'native-mixed-playoff-reopen-v1';action:'propose';contextId:string;slot:number;gameNumber:number;expectedSourceDigest:string;expectedMatchDigest:string;expectedRevision:number;expectedHistoryDigest:string;expectedPolicyDigest:string;reason:string};
type Person={participantId:string;tournamentIdNumber:string;displayName:string;mode:'digital'|'paper'};
type Claim={participantId:string;winnerParticipantId:string};
export type PlayoffReopenEvidenceV1=
 {id:string;type:'digital-submit';participantId:string;winnerParticipantId:string}|
 {id:string;type:'digital-confirm';participantId:string;submissionId:string;winnerParticipantId:string;evidenceIds:string[]}|
 {id:string;type:'paper-capture';artifactId:string;artifactDigest:string;claims:Claim[]}|
 {id:string;type:'paper-review';captureId:string;artifactId:string;artifactDigest:string;reenteredClaims:Claim[];decision?:'accepted-simulation-only'|'disputed-simulation-only'};
type Flags={simulationOnly:true;ordinaryQualificationRecorded:false;mrpAwarded:false;moneyMoved:false};
export type PlayoffReopenWorkspaceV1=Flags&{kind:'native-mixed-playoff-reopen-workspace-v1';actorId:string;sessionId:string;tournamentId:string;eventId:string;contextId:string;slot:number;gameNumber:number;sourceDigest:string;matchDigest:string;revision:number;historyDigest:string;sideA:Person;sideB:Person;entries:PlayoffReopenEvidenceV1[];policy:null|{version:number;requiredApprovals:0|1;reasonRequired:boolean;digest:string};canPropose:boolean;blockedCode:string|null};
export type PlayoffReopenReceiptV1=Flags&{kind:'native-mixed-playoff-reopen-receipt-v1';status:'accepted'|'rejected';actorId:string;sessionId:string;tournamentId:string;eventId:string;operationId:string;request:PlayoffReopenRequestV1;reopenId:string|null;priorRevision:number;priorHistoryDigest:string;revision:0|null;historyDigest:string|null;code:string;historicalReceipt:boolean;currentSourceVerified:false};
export const playoffCorrectionFalseFlagsV1=['ordinaryQualificationRecorded','mrpAwarded','moneyMoved']as const;
export const playoffCorrectionObjectV1=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
export const playoffCorrectionExactV1=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>playoffCorrectionObjectV1(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export const playoffCorrectionUuidV1=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export const playoffCorrectionDigestV1=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const playoffCorrectionIntegerV1=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&!Object.is(v,-0)&&Number(v)>=min&&Number(v)<=max;
export function playoffCorrectionPlainV1(v:unknown,depth=0,seen=new Set<object>(),budget={n:0}):boolean{
 if(depth>64||++budget.n>300000)return false;if(v===null||typeof v==='string'||typeof v==='boolean')return true;if(typeof v==='number')return Number.isFinite(v);
 if(typeof v!=='object'||seen.has(v)||!Array.isArray(v)&&!playoffCorrectionObjectV1(v))return false;seen.add(v);const keys=Reflect.ownKeys(v);if(Array.isArray(v)&&(keys.length!==v.length+1||v.length>10000))return false;
 for(const k of keys){if(Array.isArray(v)&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(v,k);if(typeof k!=='string'||!d||!('value'in d)||!d.enumerable||!playoffCorrectionPlainV1(d.value,depth+1,seen,budget))return false;}seen.delete(v);return true;
}
export const playoffCorrectionSameV1=(a:unknown,b:unknown)=>JSON.stringify(a,(_k,v)=>playoffCorrectionObjectV1(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)===JSON.stringify(b,(_k,v)=>playoffCorrectionObjectV1(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const exact=playoffCorrectionExactV1,uuid=playoffCorrectionUuidV1,digest=playoffCorrectionDigestV1,int=playoffCorrectionIntegerV1,plain=playoffCorrectionPlainV1,same=playoffCorrectionSameV1;
const text=(v:unknown,max:number)=>typeof v==='string'&&v===v.trim()&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const flags=(v:Record<string,unknown>)=>v.simulationOnly===true&&playoffCorrectionFalseFlagsV1.every(k=>v[k]===false);
export function isPlayoffReopenTargetV1(v:unknown):v is PlayoffReopenTargetV1{try{
 if(!plain(v)||!exact(v,['actorId','sessionId','projectUrl','projectRef','tournamentId','eventId','contextId','slot','gameNumber'])||![v.actorId,v.sessionId,v.tournamentId,v.eventId,v.contextId].every(uuid)||!int(v.slot,1,4)||!int(v.gameNumber,1,2500)||typeof v.projectRef!=='string'||!/^[a-z0-9-]{1,128}$/.test(v.projectRef)||typeof v.projectUrl!=='string')return false;
 const u=new URL(v.projectUrl);return u.protocol==='https:'&&!u.username&&!u.password&&u.origin===v.projectUrl;
}catch{return false;}}
export function isPlayoffReopenRequestV1(v:unknown):v is PlayoffReopenRequestV1{try{return plain(v)&&exact(v,['kind','action','contextId','slot','gameNumber','expectedSourceDigest','expectedMatchDigest','expectedRevision','expectedHistoryDigest','expectedPolicyDigest','reason'])&&v.kind==='native-mixed-playoff-reopen-v1'&&v.action==='propose'&&uuid(v.contextId)&&int(v.slot,1,4)&&int(v.gameNumber,1,2500)&&int(v.expectedRevision,0,6)&&[v.expectedSourceDigest,v.expectedMatchDigest,v.expectedHistoryDigest,v.expectedPolicyDigest].every(digest)&&text(v.reason,500);}catch{return false;}}
function person(v:unknown):v is Person{return exact(v,['participantId','tournamentIdNumber','displayName','mode'])&&uuid(v.participantId)&&text(v.tournamentIdNumber,200)&&text(v.displayName,500)&&['digital','paper'].includes(v.mode as string);}
function evidence(v:unknown,people:Person[]):v is PlayoffReopenEvidenceV1{
 if(!playoffCorrectionObjectV1(v)||!uuid(v.id))return false;const participant=(x:unknown)=>people.some(p=>p.participantId===x),digital=(x:unknown)=>people.some(p=>p.participantId===x&&p.mode==='digital'),papers=people.filter(p=>p.mode==='paper');
 const claims=(c:unknown)=>Array.isArray(c)&&c.length===papers.length&&c.length>0&&c.every(x=>exact(x,['participantId','winnerParticipantId'])&&papers.some(p=>p.participantId===x.participantId)&&participant(x.winnerParticipantId))&&new Set(c.map(x=>x.participantId)).size===c.length;
 if(v.type==='digital-submit')return exact(v,['id','type','participantId','winnerParticipantId'])&&digital(v.participantId)&&participant(v.winnerParticipantId);
 if(v.type==='digital-confirm')return exact(v,['id','type','participantId','submissionId','winnerParticipantId','evidenceIds'])&&digital(v.participantId)&&participant(v.winnerParticipantId)&&uuid(v.submissionId)&&Array.isArray(v.evidenceIds)&&v.evidenceIds.length>=2&&v.evidenceIds.length<=4&&v.evidenceIds.every(uuid)&&new Set(v.evidenceIds).size===v.evidenceIds.length;
 if(v.type==='paper-capture')return exact(v,['id','type','artifactId','artifactDigest','claims'])&&uuid(v.artifactId)&&digest(v.artifactDigest)&&claims(v.claims);
 if(v.type==='paper-review'){const keys=['id','type','captureId','artifactId','artifactDigest','reenteredClaims'];if(Object.hasOwn(v,'decision'))keys.push('decision');return exact(v,keys)&&uuid(v.captureId)&&uuid(v.artifactId)&&digest(v.artifactDigest)&&claims(v.reenteredClaims)&&(!Object.hasOwn(v,'decision')||['accepted-simulation-only','disputed-simulation-only'].includes(v.decision as string));}
 return false;
}
export function readPlayoffReopenWorkspaceV1(v:unknown,t:PlayoffReopenTargetV1):PlayoffReopenWorkspaceV1|null{try{
 if(!isPlayoffReopenTargetV1(t)||!plain(v)||!exact(v,['kind','actorId','sessionId','tournamentId','eventId','contextId','slot','gameNumber','sourceDigest','matchDigest','revision','historyDigest','sideA','sideB','entries','policy','canPropose','blockedCode','simulationOnly',...playoffCorrectionFalseFlagsV1])||v.kind!=='native-mixed-playoff-reopen-workspace-v1'||!flags(v)||['actorId','sessionId','tournamentId','eventId','contextId','slot','gameNumber'].some(k=>v[k]!==t[k as keyof PlayoffReopenTargetV1])||![v.sourceDigest,v.matchDigest,v.historyDigest].every(digest)||!int(v.revision,0,6)||!person(v.sideA)||!person(v.sideB)||v.sideA.participantId===v.sideB.participantId||v.sideA.tournamentIdNumber===v.sideB.tournamentIdNumber||!Array.isArray(v.entries)||v.entries.length!==v.revision||!v.entries.every(e=>evidence(e,[v.sideA as Person,v.sideB as Person]))||new Set(v.entries.map(e=>e.id)).size!==v.entries.length||typeof v.canPropose!=='boolean'||!(v.blockedCode===null||typeof v.blockedCode==='string'&&/^[a-z][a-z0-9_]{0,99}$/.test(v.blockedCode)))return null;
 const p=v.policy;if(p!==null&&(!exact(p,['version','requiredApprovals','reasonRequired','digest'])||!int(p.version)||![0,1].includes(p.requiredApprovals as number)||typeof p.reasonRequired!=='boolean'||!digest(p.digest)))return null;
 if(v.canPropose&&(!p||p.requiredApprovals!==0||v.blockedCode!==null||v.entries.length===0))return null;
 return structuredClone(v)as PlayoffReopenWorkspaceV1;
}catch{return null;}}
export function buildPlayoffReopenRequestV1(w:PlayoffReopenWorkspaceV1,why:string):PlayoffReopenRequestV1|null{
 if(typeof why!=='string'||!w.canPropose||w.policy?.requiredApprovals!==0)return null;const r={kind:'native-mixed-playoff-reopen-v1',action:'propose',contextId:w.contextId,slot:w.slot,gameNumber:w.gameNumber,expectedSourceDigest:w.sourceDigest,expectedMatchDigest:w.matchDigest,expectedRevision:w.revision,expectedHistoryDigest:w.historyDigest,expectedPolicyDigest:w.policy.digest,reason:why.trim()};return isPlayoffReopenRequestV1(r)?r:null;
}
export const playoffReopenRejectionCodesV1=['source_changed','source_unavailable','match_or_game_changed','history_changed','policy_changed','policy_unavailable','approval_workflow_unavailable','game_not_disputed','game_already_complete','later_evidence_exists','downstream_closed']as const;
export function readPlayoffReopenReceiptV1(v:unknown,t:PlayoffReopenTargetV1,op:string,r:PlayoffReopenRequestV1):PlayoffReopenReceiptV1|null{try{
 if(!isPlayoffReopenTargetV1(t)||!isPlayoffReopenRequestV1(r)||r.contextId!==t.contextId||r.slot!==t.slot||r.gameNumber!==t.gameNumber||!uuid(op)||!plain(v)||!exact(v,['kind','status','actorId','sessionId','tournamentId','eventId','operationId','request','reopenId','priorRevision','priorHistoryDigest','revision','historyDigest','code','historicalReceipt','currentSourceVerified','simulationOnly',...playoffCorrectionFalseFlagsV1])||v.kind!=='native-mixed-playoff-reopen-receipt-v1'||!flags(v)||['actorId','sessionId','tournamentId','eventId'].some(k=>v[k]!==t[k as keyof PlayoffReopenTargetV1])||v.operationId!==op||!same(v.request,r)||v.priorRevision!==r.expectedRevision||v.priorHistoryDigest!==r.expectedHistoryDigest||typeof v.historicalReceipt!=='boolean'||v.currentSourceVerified!==false)return null;
 if(v.status==='accepted'){if(v.code!=='game_reopened'||!uuid(v.reopenId)||v.revision!==0||!digest(v.historyDigest)||v.historyDigest===r.expectedHistoryDigest)return null;}
 else if(v.status==='rejected'){if(!playoffReopenRejectionCodesV1.includes(v.code as typeof playoffReopenRejectionCodesV1[number])||v.reopenId!==null||v.revision!==null||v.historyDigest!==null)return null;}
 else return null;
 return structuredClone(v)as PlayoffReopenReceiptV1;
}catch{return null;}}


