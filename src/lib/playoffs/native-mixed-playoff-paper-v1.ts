import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
/** Private/default-off paper Playoff contract. Dedicated SQL and normal-client
 * boundaries require separate release and signed-in acceptance; local mocked
 * tests are not provider acceptance. No local winner verification.
 * Existing authorized administrative visibility is intentionally unchanged. */
import{isPlayoffReopenTargetV1,playoffCorrectionExactV1 as exact,playoffCorrectionPlainV1 as plain,playoffCorrectionUuidV1 as uuid,playoffCorrectionDigestV1 as hash,playoffCorrectionIntegerV1 as int,playoffCorrectionSameV1 as same,type PlayoffReopenTargetV1}from'./native-mixed-playoff-reopen-v1.ts';
export type PlayoffPaperTargetV1=PlayoffReopenTargetV1;
export const playoffPaperRoutesEnabledV1=()=>integratedTestFeatureEnabled();
type Person={participantId:string;tournamentIdNumber:string;displayName:string;mode:'digital'|'paper'};
export type PlayoffPaperClaimV1={participantId:string;winnerParticipantId:string};
/** For a not-yet-submitted reviewer, artifactDigest and historyDigest must be
 * the same opaque, server-bound token; raw deterministic hashes leak answers. */
type Capture={id:string;artifactId:string;artifactDigest:string};
type Flags={simulationOnly:true;ordinaryQualificationRecorded:false;mrpAwarded:false;moneyMoved:false};
export type PlayoffPaperWorkspaceV1=Flags&{kind:'native-mixed-playoff-paper-workspace-v1';actorId:string;sessionId:string;tournamentId:string;eventId:string;contextId:string;slot:number;gameNumber:number;sourceDigest:string;matchDigest:string;revision:number;historyDigest:string;sideA:Person;sideB:Person;phase:'capture'|'review'|'waiting'|'disputed'|'complete';capture:Capture|null;ownEvidence:null|({id:string;type:'paper-capture';artifactId:string;artifactDigest:string;claims:PlayoffPaperClaimV1[]}|{id:string;type:'paper-review';captureId:string;artifactId:string;artifactDigest:string;reenteredClaims:PlayoffPaperClaimV1[]});blockedCode:string|null};
export type PlayoffPaperRequestV1={version:'native-mixed-playoff-request-v1';action:'game-action';expectedSourceDigest:string;data:{contextId:string;slot:number;gameNumber:number;expectedMatchDigest:string;expectedRevision:number;expectedHistoryDigest:string;entry:{type:'paper-capture';artifactId:string;claims:PlayoffPaperClaimV1[];statement:'fictional-playoff-blind-paper-capture-v1'}|{type:'paper-review';captureId:string;artifactId:string;artifactDigest:string;reenteredClaims:PlayoffPaperClaimV1[];statement:'fictional-playoff-blind-paper-review-v1'}};reason:string};
export type PlayoffPaperPreparedV1={version:'native-mixed-playoff-paper-prepared-v1';target:PlayoffPaperTargetV1;operationId:string;request:PlayoffPaperRequestV1;retainedRaw:string};
export type PlayoffPaperReceiptV1=Flags&{status:'simulated_playoff_evidence_recorded';contextId:string;slot:number;gameNumber:number;entryId:string;revision:number;historyDigest:string;sourceDigest:string;matchDigest:string;gameComplete:boolean;matchComplete:boolean;winnerId:string|null;historicalReceipt?:true;currentSourceVerified?:false};
export const playoffPaperReasonV1='Independent fictional Playoff paper evidence; no physical-original, attendance or payment claim.';
const text=(v:unknown)=>typeof v==='string'&&v===v.trim()&&v.length>0&&v.length<=500&&!/[\u0000-\u001f\u007f]/.test(v);
const person=(v:unknown):v is Person=>exact(v,['participantId','tournamentIdNumber','displayName','mode'])&&uuid(v.participantId)&&text(v.tournamentIdNumber)&&text(v.displayName)&&['paper','digital'].includes(v.mode as string);
export function readPlayoffPaperWorkspaceV1(value:unknown,t:PlayoffPaperTargetV1):PlayoffPaperWorkspaceV1|null{try{
 if(!isPlayoffReopenTargetV1(t)||!plain(value)||!exact(value,['kind','actorId','sessionId','tournamentId','eventId','contextId','slot','gameNumber','sourceDigest','matchDigest','revision','historyDigest','sideA','sideB','phase','capture','ownEvidence','blockedCode','simulationOnly','ordinaryQualificationRecorded','mrpAwarded','moneyMoved']))return null;const v=value;
 if(v.kind!=='native-mixed-playoff-paper-workspace-v1'||['actorId','sessionId','tournamentId','eventId','contextId','slot','gameNumber'].some(k=>v[k]!==t[k as keyof PlayoffPaperTargetV1])||![v.sourceDigest,v.matchDigest,v.historyDigest].every(hash)||!int(v.revision,0,6)||!person(v.sideA)||!person(v.sideB)||v.sideA.participantId===v.sideB.participantId||v.sideA.tournamentIdNumber===v.sideB.tournamentIdNumber||!['capture','review','waiting','disputed','complete'].includes(v.phase as string)||v.simulationOnly!==true||v.ordinaryQualificationRecorded!==false||v.mrpAwarded!==false||v.moneyMoved!==false||!(v.blockedCode===null||typeof v.blockedCode==='string'&&/^[a-z][a-z0-9_]{0,99}$/.test(v.blockedCode)))return null;
 const people=[v.sideA,v.sideB],papers=people.filter(p=>p.mode==='paper');if(!papers.length)return null;
 const claims=(c:unknown)=>Array.isArray(c)&&c.length===papers.length&&c.every(x=>exact(x,['participantId','winnerParticipantId'])&&papers.some(p=>p.participantId===x.participantId)&&people.some(p=>p.participantId===x.winnerParticipantId))&&new Set(c.map(x=>x.participantId)).size===c.length;
 const c=v.capture;if(c!==null&&(!exact(c,['id','artifactId','artifactDigest'])||!uuid(c.id)||!uuid(c.artifactId)||!hash(c.artifactDigest)))return null;
 const e=v.ownEvidence;if(e!==null){if(!exact(e,e&&typeof e==='object'&&(e as Record<string,unknown>).type==='paper-capture'?['id','type','artifactId','artifactDigest','claims']:['id','type','captureId','artifactId','artifactDigest','reenteredClaims'])||!uuid(e.id)||!uuid(e.artifactId)||!hash(e.artifactDigest)||!c||e.artifactId!==c.artifactId||e.artifactDigest!==c.artifactDigest)return null;if(e.type==='paper-capture'){if(e.id!==c.id||!claims(e.claims))return null;}else if(e.type!=='paper-review'||e.captureId!==c.id||!claims(e.reenteredClaims))return null;}
 if(v.phase==='capture'&&(c!==null||e!==null||v.blockedCode!==null)||v.phase==='review'&&(!c||c.artifactDigest!==v.historyDigest||e!==null||v.blockedCode!==null))return null;
 return structuredClone(v)as PlayoffPaperWorkspaceV1;
}catch{return null;}}
export function readPlayoffPaperPreparedV1(v:unknown,t:PlayoffPaperTargetV1,sameGame=false):PlayoffPaperPreparedV1|null{try{
 if(!isPlayoffReopenTargetV1(t)||!plain(v)||!exact(v,['version','target','operationId','request','retainedRaw'])||v.version!=='native-mixed-playoff-paper-prepared-v1'||!isPlayoffReopenTargetV1(v.target)||!uuid(v.operationId)||!isPlayoffPaperRequestV1(v.request,v.target)||typeof v.retainedRaw!=='string'||new TextEncoder().encode(v.retainedRaw).byteLength>24000||['actorId','sessionId','projectUrl','projectRef','tournamentId','eventId'].some(k=>(v.target as PlayoffPaperTargetV1)[k as keyof PlayoffPaperTargetV1]!==t[k as keyof PlayoffPaperTargetV1])||sameGame&&!same(v.target,t))return null;
 const raw:unknown=JSON.parse(v.retainedRaw);if(!plain(raw)||!exact(raw,['version','target','operationId','request'])||!same(raw,{version:v.version,target:v.target,operationId:v.operationId,request:v.request}))return null;
 return structuredClone(v)as PlayoffPaperPreparedV1;
}catch{return null;}}
export function preparePlayoffPaperV1(t:PlayoffPaperTargetV1,operationId:string,r:PlayoffPaperRequestV1):PlayoffPaperPreparedV1|null{try{
 if(!isPlayoffReopenTargetV1(t)||!uuid(operationId)||!isPlayoffPaperRequestV1(r,t))return null;
 const p={version:'native-mixed-playoff-paper-prepared-v1'as const,target:structuredClone(t),operationId,request:structuredClone(r)};return{...p,retainedRaw:JSON.stringify(p)};
}catch{return null;}}
export function buildPlayoffPaperRequestV1(w:PlayoffPaperWorkspaceV1,winners:Record<string,string>,artifactId?:string):PlayoffPaperRequestV1|null{try{
 if(!['capture','review'].includes(w.phase)||w.blockedCode!==null||!plain(winners))return null;const people=[w.sideA,w.sideB],paper=people.filter(p=>p.mode==='paper');if(!exact(winners,paper.map(p=>p.participantId))||paper.some(p=>!people.some(x=>x.participantId===winners[p.participantId])))return null;
 const claims=paper.map(p=>({participantId:p.participantId,winnerParticipantId:winners[p.participantId]}));
 if(w.phase==='capture'&&!uuid(artifactId)||w.phase==='review'&&!w.capture)return null;
 const entry:PlayoffPaperRequestV1['data']['entry']=w.phase==='capture'?{type:'paper-capture',artifactId:artifactId!,claims,statement:'fictional-playoff-blind-paper-capture-v1'}:{type:'paper-review',captureId:w.capture!.id,artifactId:w.capture!.artifactId,artifactDigest:w.capture!.artifactDigest,reenteredClaims:claims,statement:'fictional-playoff-blind-paper-review-v1'};
 return{version:'native-mixed-playoff-request-v1',action:'game-action',expectedSourceDigest:w.sourceDigest,data:{contextId:w.contextId,slot:w.slot,gameNumber:w.gameNumber,expectedMatchDigest:w.matchDigest,expectedRevision:w.revision,expectedHistoryDigest:w.historyDigest,entry},reason:playoffPaperReasonV1};
}catch{return null;}}
export function isPlayoffPaperRequestV1(v:unknown,t?:PlayoffPaperTargetV1):v is PlayoffPaperRequestV1{try{
 if(!plain(v)||!exact(v,['version','action','expectedSourceDigest','data','reason'])||v.version!=='native-mixed-playoff-request-v1'||v.action!=='game-action'||v.reason!==playoffPaperReasonV1||!hash(v.expectedSourceDigest)||!exact(v.data,['contextId','slot','gameNumber','expectedMatchDigest','expectedRevision','expectedHistoryDigest','entry']))return false;
 const d=v.data,e=d.entry;if(!uuid(d.contextId)||!int(d.slot,1,4)||!int(d.gameNumber,1,2500)||!int(d.expectedRevision,0,5)||![d.expectedMatchDigest,d.expectedHistoryDigest].every(hash)||t&&(!isPlayoffReopenTargetV1(t)||d.contextId!==t.contextId||d.slot!==t.slot||d.gameNumber!==t.gameNumber)||!e||typeof e!=='object'||Array.isArray(e))return false;
 const x=e as Record<string,unknown>,claims=x.type==='paper-capture'?x.claims:x.reenteredClaims;
 if(!Array.isArray(claims)||claims.length<1||claims.length>2||!claims.every(c=>exact(c,['participantId','winnerParticipantId'])&&uuid(c.participantId)&&uuid(c.winnerParticipantId))||new Set(claims.map(c=>c.participantId)).size!==claims.length||!uuid(x.artifactId))return false;
 return x.type==='paper-capture'?exact(x,['type','artifactId','claims','statement'])&&x.statement==='fictional-playoff-blind-paper-capture-v1':x.type==='paper-review'&&exact(x,['type','captureId','artifactId','artifactDigest','reenteredClaims','statement'])&&x.statement==='fictional-playoff-blind-paper-review-v1'&&uuid(x.captureId)&&x.artifactDigest===d.expectedHistoryDigest&&d.expectedRevision>=1;
}catch{return false;}}
export function readPlayoffPaperReceiptV1(v:unknown,r:PlayoffPaperRequestV1):PlayoffPaperReceiptV1|null{try{
 if(!isPlayoffPaperRequestV1(r)||!plain(v)||!v||typeof v!=='object'||Array.isArray(v))return null;const x=v as Record<string,unknown>,keys=['status','contextId','slot','gameNumber','entryId','revision','historyDigest','sourceDigest','matchDigest','gameComplete','matchComplete','winnerId','simulationOnly','ordinaryQualificationRecorded','mrpAwarded','moneyMoved'];if(Object.hasOwn(x,'historicalReceipt')||Object.hasOwn(x,'currentSourceVerified'))keys.push('historicalReceipt','currentSourceVerified');
 if(!exact(x,keys)||x.status!=='simulated_playoff_evidence_recorded'||x.contextId!==r.data.contextId||x.slot!==r.data.slot||x.gameNumber!==r.data.gameNumber||x.sourceDigest!==r.expectedSourceDigest||x.matchDigest!==r.data.expectedMatchDigest||x.revision!==r.data.expectedRevision+1||!uuid(x.entryId)||!hash(x.historyDigest)||typeof x.gameComplete!=='boolean'||typeof x.matchComplete!=='boolean'||x.simulationOnly!==true||x.ordinaryQualificationRecorded!==false||x.mrpAwarded!==false||x.moneyMoved!==false||Object.hasOwn(x,'historicalReceipt')&&(x.historicalReceipt!==true||x.currentSourceVerified!==false))return null;
 const claims=r.data.entry.type==='paper-capture'?r.data.entry.claims:r.data.entry.reenteredClaims,winner=claims[0].winnerParticipantId;
 if(r.data.entry.type==='paper-capture'&&(x.gameComplete||x.matchComplete||x.winnerId!==null)||x.gameComplete&&claims.some(c=>c.winnerParticipantId!==winner))return null;
 if(x.matchComplete?(!x.gameComplete||x.winnerId!==winner):x.winnerId!==null)return null;
 return structuredClone(x)as PlayoffPaperReceiptV1;
}catch{return null;}}
