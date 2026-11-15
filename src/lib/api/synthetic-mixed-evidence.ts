import { isUuid } from './validation.ts';
import { isPaperCardClaim, type PaperCardClaim } from './paper-game-completion.ts';

export const mixedRehearsalNotice = 'Fictional paper evidence. No physical original or independent human play is claimed.';
export type MixedCapability = { kind:'synthetic-mixed-18-v2';tournamentId:string;eventId:string;actorId:string;participantCount:18;digitalCount:6;paperCount:12;matchCount:108;
 isDigitalParticipant:boolean;isOfficial:boolean;sourceCurrent:boolean;tournamentOpen:boolean;eventStarted:boolean;officialIdentityConfirmed:boolean };
export type MixedOwnHybrid = {kind:'own-synthetic-mixed-hybrid-v1';gameId:string;eventId:string;tournamentId:string;artifactId:string;gameVersion:number;notice:string;
 scriptedWinnerSide:'a'|'b';scriptedSpreadPoints:number;digitalSubmissionId:string|null;digitalWinnerSide:'a'|'b'|null;digitalMargin:number|null;acknowledged:boolean;authoritative:false};
export type MixedOwnAckRequest = {artifactId:string;expectedGameVersion:number;digitalSubmissionId:string;confirmed:true;idempotencyKey:string};
export type MixedOfficialPhase = 'paper-capture'|'paper-review'|'hybrid-capture'|'hybrid-review';
export type MixedPaperCapture = {gameId:string;completionId:string;artifactId:string;expectedGameVersion:number;sideAClaim:PaperCardClaim;sideBClaim:PaperCardClaim};
export type MixedPaperReview = Omit<MixedPaperCapture,'gameId'> & {decision:'approve'|'reject'};
export type MixedHybridCapture = {gameId:string;caseId:string;artifactId:string;expectedGameVersion:number;digitalSubmissionId:string;paperClaim:PaperCardClaim};
export type MixedHybridReview = Omit<MixedHybridCapture,'gameId'> & {digitalWinnerSide:'a'|'b';digitalMargin:number;decision:'approve'|'reject'};
export type MixedOfficialRequest = MixedPaperCapture|MixedPaperReview|MixedHybridCapture|MixedHybridReview;
export type MixedOfficialEnvelope = {gameId:string;request:MixedOfficialRequest;idempotencyKey:string};
export type MixedArtifact = {artifactId:string;gameId:string;eventId:string;pairing:'PP'|'PD';expectedGameVersion:number;text:string;sha256:string;sideAReference:string;sideBReference:string;playerAttested:boolean};
export type MixedPaperSide = {displayName:string;verificationId:string;profileLinked:boolean};
export type MixedPaperCandidate = {gameId:string;eventId:string;eventName:string;gameNumber:number;gameVersion:number;sideA:MixedPaperSide;sideB:MixedPaperSide};
export type MixedPaperReviewCase = Omit<MixedPaperCandidate,'eventId'> & {completionId:string};
export type MixedHybridItem = {gameId:string;eventId?:string;caseId?:string;eventName:string;gameNumber:number;gameVersion:number;digitalSubmissionId:string;digitalWinnerSide:'a'|'b';digitalMargin:number;digitalSide:'a'|'b';digitalPlayerName:string;paperPlayerName:string;paperVerificationId:string};
export type MixedOfficialWorkspace = {kind:'synthetic-mixed-official-v1';capability:MixedCapability;notice:string;artifacts:MixedArtifact[];
 paperCandidates:MixedPaperCandidate[];paperReviewCases:MixedPaperReviewCase[];hybridCandidates:MixedHybridItem[];hybridReviewCases:MixedHybridItem[]};
export type MixedScopedReceipt = {kind:'synthetic-mixed-receipt-v1';actorId:string;tournamentId:string;eventId:string;gameId:string;phase:'own-ack'|MixedOfficialPhase;idempotencyKey:string;request:MixedOwnAckRequest|MixedOfficialEnvelope;result:Record<string,unknown>};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0&&Number(v)<=2147483647;
const spread=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=1&&Number(v)<=121;
const winner=(v:unknown):v is 'a'|'b'=>v==='a'||v==='b';
const text=(v:unknown,max=300):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
export const sameMixedUuid=(a:unknown,b:unknown)=>isUuid(a)&&isUuid(b)&&a.toLowerCase()===b.toLowerCase();

/** This local-only slice must never create a client for an existing hosted .env. */
export function isSyntheticMixedLocalDeployment(env:Record<string,string|undefined>){
 if(env.CRIBBAGE_LOCAL_MIXED_REHEARSAL!=='1'||!['development','test'].includes(env.NODE_ENV??'')
  ||(env.VERCEL_ENV!==undefined&&env.VERCEL_ENV!=='development'))return false;
 const p=env.CRIBBAGE_LOCAL_MIXED_BACKEND_PORT;
 if(!p||!/^[1-9][0-9]{0,4}$/.test(p)||Number(p)>65535)return false;
 return env.NEXT_PUBLIC_SUPABASE_URL===`http://127.0.0.1:${p}`||env.NEXT_PUBLIC_SUPABASE_URL===`http://localhost:${p}`;
}
export function isMixedCapability(v:unknown,actorId:string,tid:string,eid:string):v is MixedCapability{
 return record(v)&&exact(v,['kind','tournamentId','eventId','actorId','participantCount','digitalCount','paperCount','matchCount','isDigitalParticipant','isOfficial','sourceCurrent','tournamentOpen','eventStarted','officialIdentityConfirmed'])
 &&v.kind==='synthetic-mixed-18-v2'&&sameMixedUuid(v.actorId,actorId)&&sameMixedUuid(v.tournamentId,tid)&&sameMixedUuid(v.eventId,eid)
 &&v.participantCount===18&&v.digitalCount===6&&v.paperCount===12&&v.matchCount===108
 &&['isDigitalParticipant','isOfficial','sourceCurrent','tournamentOpen','eventStarted','officialIdentityConfirmed'].every(k=>typeof v[k]==='boolean')
 &&(v.isDigitalParticipant===true||v.isOfficial===true)&&(!v.officialIdentityConfirmed||v.isOfficial===true);
}
export function isMixedOwnHybrid(v:unknown,tid:string,eid:string,gid:string):v is MixedOwnHybrid{
 if(!record(v)||!exact(v,['kind','gameId','eventId','tournamentId','artifactId','gameVersion','notice','scriptedWinnerSide','scriptedSpreadPoints','digitalSubmissionId','digitalWinnerSide','digitalMargin','acknowledged','authoritative']))return false;
 return v.kind==='own-synthetic-mixed-hybrid-v1'&&sameMixedUuid(v.tournamentId,tid)&&sameMixedUuid(v.eventId,eid)&&sameMixedUuid(v.gameId,gid)&&isUuid(v.artifactId)&&positive(v.gameVersion)
 &&text(v.notice,500)&&winner(v.scriptedWinnerSide)&&spread(v.scriptedSpreadPoints)&&typeof v.acknowledged==='boolean'&&v.authoritative===false
 &&((v.digitalSubmissionId===null&&v.digitalWinnerSide===null&&v.digitalMargin===null&&v.acknowledged===false)||(isUuid(v.digitalSubmissionId)&&winner(v.digitalWinnerSide)&&spread(v.digitalMargin)));
}
export function isMixedOwnAckRequest(v:unknown):v is MixedOwnAckRequest{return record(v)&&exact(v,['artifactId','expectedGameVersion','digitalSubmissionId','confirmed','idempotencyKey'])&&isUuid(v.artifactId)&&positive(v.expectedGameVersion)&&isUuid(v.digitalSubmissionId)&&v.confirmed===true&&isUuid(v.idempotencyKey);}
export function isMixedOfficialPhase(v:unknown):v is MixedOfficialPhase{return ['paper-capture','paper-review','hybrid-capture','hybrid-review'].includes(v as string);}
export function isMixedOfficialRequest(v:unknown,phase:MixedOfficialPhase):v is MixedOfficialRequest{
 if(!isMixedOfficialPhase(phase)||!record(v)||!isUuid(v.artifactId)||!positive(v.expectedGameVersion))return false;
 const review=phase.endsWith('review'),paper=phase.startsWith('paper');
 const keys=paper?review?['completionId','artifactId','expectedGameVersion','sideAClaim','sideBClaim','decision']:['gameId','completionId','artifactId','expectedGameVersion','sideAClaim','sideBClaim']
 :review?['caseId','artifactId','expectedGameVersion','digitalSubmissionId','digitalWinnerSide','digitalMargin','paperClaim','decision']:['gameId','caseId','artifactId','expectedGameVersion','digitalSubmissionId','paperClaim'];
 if(!exact(v,keys)||!isUuid(paper?v.completionId:v.caseId)||(!review&&!isUuid(v.gameId))||(review&&!['approve','reject'].includes(v.decision as string)))return false;
 const claimValid=(c:unknown)=>isPaperCardClaim(c)&&new RegExp(`^SYNTHETIC-MIXED-v1:${String(v.artifactId)}:[ab]:[a-f0-9]{64}$`,'i').test(c.evidenceReference);
 if(paper)return claimValid(v.sideAClaim)&&claimValid(v.sideBClaim);
 return isUuid(v.digitalSubmissionId)&&claimValid(v.paperClaim)&&(!review||(winner(v.digitalWinnerSide)&&spread(v.digitalMargin)));
}
export function isMixedOfficialEnvelope(v:unknown,phase:MixedOfficialPhase):v is MixedOfficialEnvelope{return record(v)&&exact(v,['gameId','request','idempotencyKey'])&&isUuid(v.gameId)&&isUuid(v.idempotencyKey)&&isMixedOfficialRequest(v.request,phase)&&(!('gameId'in v.request)||sameMixedUuid(v.request.gameId,v.gameId));}
export function isMixedArtifact(v:unknown,tid:string,eid:string):v is MixedArtifact{
 if(!record(v)||!exact(v,['artifactId','gameId','eventId','pairing','expectedGameVersion','text','sha256','sideAReference','sideBReference','playerAttested'])
 ||!isUuid(v.artifactId)||!isUuid(v.gameId)||!sameMixedUuid(v.eventId,eid)||!['PP','PD'].includes(v.pairing as string)||!positive(v.expectedGameVersion)
 ||typeof v.text!=='string'||v.text.length>16000||typeof v.sha256!=='string'||!/^[a-f0-9]{64}$/.test(v.sha256)||typeof v.playerAttested!=='boolean'
 ||v.sideAReference!==`SYNTHETIC-MIXED-v1:${v.artifactId}:a:${v.sha256}`||v.sideBReference!==`SYNTHETIC-MIXED-v1:${v.artifactId}:b:${v.sha256}`)return false;
 try{const p=JSON.parse(v.text);return record(p)&&exact(p,['schema','tournamentId','eventId','gameId','pairing','sideA','sideB','digitalParticipantId','winnerSide','spreadPoints','physicalOriginal','fictionalOpponentPlayed','independentHumanPlayClaimed'])
 &&p.schema==='synthetic-mixed-paper-v1'&&sameMixedUuid(p.tournamentId,tid)&&sameMixedUuid(p.eventId,eid)&&sameMixedUuid(p.gameId,v.gameId)&&p.pairing===v.pairing
 &&isUuid(p.sideA)&&isUuid(p.sideB)&&!sameMixedUuid(p.sideA,p.sideB)&&winner(p.winnerSide)&&spread(p.spreadPoints)
 &&p.physicalOriginal===false&&p.fictionalOpponentPlayed===false&&p.independentHumanPlayClaimed===false
 &&(v.pairing==='PP'?p.digitalParticipantId===null:sameMixedUuid(p.digitalParticipantId,p.sideA)||sameMixedUuid(p.digitalParticipantId,p.sideB));}catch{return false;}
}
const officialCodes=new Set(['invalid_request','official_unavailable','idempotency_conflict','synthetic_player_attestation_required','not_cross_checker','tournament_unavailable','tournament_closed','event_unavailable','game_unavailable','game_not_scheduled','stale_game_version','game_already_authoritative','game_already_claimed','device_recovery_case_exists','not_paper_pair','not_hybrid_pair','self_cross_check_denied','card_identity_unavailable','nonreciprocal_card_claims','completion_unavailable','not_eligible_reviewer','reviewer_not_independent','review_closed','review_claims_mismatch','official_identity_unconfirmed','first_official_identity_changed','scorecard_preference_changed','game_progression_locked','digital_submission_unavailable','digital_paper_mismatch','case_unavailable','review_evidence_mismatch']);
export function isMixedNativeRejection(v:unknown,request:MixedOwnAckRequest|MixedOfficialRequest,phase:'own-ack'|MixedOfficialPhase){
 if(!record(v)||v.status!=='rejected'||typeof v.code!=='string')return false;
 const codes=phase==='own-ack'?new Set(['invalid_request','own_submission_required','idempotency_conflict']):officialCodes;
 if(!codes.has(v.code))return false;
 if(exact(v,['status','code']))return true;
 const r=request as MixedOfficialRequest,key=phase.startsWith('paper')?'completionId':'caseId';
 return phase!=='own-ack'&&exact(v,['status','code',key])&&sameMixedUuid(v[key],key==='completionId'?(r as MixedPaperCapture).completionId:(r as MixedHybridCapture).caseId);
}
export function isMixedOwnAckResult(v:unknown,gid:string,r:MixedOwnAckRequest){return record(v)&&exact(v,['status','attestationId','artifactId','gameId','digitalSubmissionId','gameVersion','authoritative'])
 &&v.status==='synthetic_opponent_acknowledged'&&isUuid(v.attestationId)&&sameMixedUuid(v.artifactId,r.artifactId)&&sameMixedUuid(v.gameId,gid)&&sameMixedUuid(v.digitalSubmissionId,r.digitalSubmissionId)&&v.gameVersion===r.expectedGameVersion&&v.authoritative===false;}
export function isMixedOfficialResult(v:unknown,tid:string,eid:string,gid:string,phase:MixedOfficialPhase,r:MixedOfficialRequest){
 if(!record(v))return false;const paper=phase.startsWith('paper'),review=phase.endsWith('review'),q=r as unknown as Record<string,unknown>;
 if(!review){const keys=paper?['status','completionId','tournamentId','eventId','gameId','gameVersion','winnerSide','margin','evidenceCount','authoritative']:['status','caseId','gameId','gameVersion','digitalSubmissionId','winnerSide','margin','authoritative'];
 const claim=(paper?q.sideAClaim:q.paperClaim)as PaperCardClaim;
 return exact(v,keys)&&v.status==='pending_review'&&sameMixedUuid(v[paper?'completionId':'caseId'],q[paper?'completionId':'caseId'])&&sameMixedUuid(v.gameId,gid)
 &&v.gameVersion===r.expectedGameVersion&&v.winnerSide===claim.winnerSide&&v.margin===claim.margin&&v.authoritative===false
 &&(paper?sameMixedUuid(v.tournamentId,tid)&&sameMixedUuid(v.eventId,eid)&&v.evidenceCount===2:sameMixedUuid(v.digitalSubmissionId,q.digitalSubmissionId));}
 const decision=q.decision;return exact(v,['status','decision',paper?'completionId':'caseId','gameId','gameVersion','authoritative','scorelinesCreated'])
 &&v.status===(decision==='approve'?'approved':'rejected')&&v.decision===decision&&sameMixedUuid(v[paper?'completionId':'caseId'],q[paper?'completionId':'caseId'])&&sameMixedUuid(v.gameId,gid)
 &&v.gameVersion===r.expectedGameVersion+(decision==='approve'?1:0)&&v.authoritative===(decision==='approve')&&v.scorelinesCreated===(decision==='approve');
}
function canonical(v:unknown):string{if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(record(v))return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v)??'undefined';}
function scoped(v:unknown,actor:string,tid:string,eid:string,gid:string,phase:string,body:MixedOwnAckRequest|MixedOfficialEnvelope):v is MixedScopedReceipt{
 return record(v)&&exact(v,['kind','actorId','tournamentId','eventId','gameId','phase','idempotencyKey','request','result'])&&v.kind==='synthetic-mixed-receipt-v1'&&sameMixedUuid(v.actorId,actor)&&sameMixedUuid(v.tournamentId,tid)&&sameMixedUuid(v.eventId,eid)&&sameMixedUuid(v.gameId,gid)&&v.phase===phase&&sameMixedUuid(v.idempotencyKey,body.idempotencyKey)&&canonical(v.request)===canonical(body)&&record(v.result);
}
export function isMixedOwnAckReceipt(v:unknown,actor:string,tid:string,eid:string,gid:string,body:MixedOwnAckRequest):v is MixedScopedReceipt{return scoped(v,actor,tid,eid,gid,'own-ack',body)&&isMixedOwnAckResult(v.result,gid,body);}
export function isMixedOfficialReceipt(v:unknown,actor:string,tid:string,eid:string,gid:string,phase:MixedOfficialPhase,body:MixedOfficialEnvelope):v is MixedScopedReceipt{return sameMixedUuid(body.gameId,gid)&&scoped(v,actor,tid,eid,gid,phase,body)&&isMixedOfficialResult(v.result,tid,eid,gid,phase,body.request);}
export function isMixedRejectedReceipt(v:unknown,actor:string,tid:string,eid:string,gid:string,phase:'own-ack'|MixedOfficialPhase,body:MixedOwnAckRequest|MixedOfficialEnvelope):v is MixedScopedReceipt{return(!('request'in body)||sameMixedUuid(body.gameId,gid))&&scoped(v,actor,tid,eid,gid,phase,body)&&isMixedNativeRejection(v.result,'request'in body?body.request:body,phase);}

function paperSide(v:unknown):v is MixedPaperSide{return record(v)&&exact(v,['displayName','verificationId','profileLinked'])&&text(v.displayName)&&typeof v.verificationId==='string'&&/^[A-Z]-[1-9][0-9]*$/.test(v.verificationId)&&typeof v.profileLinked==='boolean';}
function paperItem(v:unknown,review:boolean):v is MixedPaperCandidate|MixedPaperReviewCase{
 return record(v)&&exact(v,review?['completionId','gameId','eventName','gameNumber','gameVersion','sideA','sideB']:['gameId','eventId','eventName','gameNumber','gameVersion','sideA','sideB'])
 &&isUuid(v.gameId)&&(review?isUuid(v.completionId):isUuid(v.eventId))&&text(v.eventName)&&positive(v.gameNumber)&&Number(v.gameNumber)<=99&&positive(v.gameVersion)&&paperSide(v.sideA)&&paperSide(v.sideB);
}
function hybridItem(v:unknown,review:boolean):v is MixedHybridItem{
 return record(v)&&exact(v,review?['caseId','gameId','eventName','gameNumber','gameVersion','digitalSubmissionId','digitalWinnerSide','digitalMargin','digitalSide','digitalPlayerName','paperPlayerName','paperVerificationId']
 :['gameId','eventId','eventName','gameNumber','gameVersion','digitalSubmissionId','digitalWinnerSide','digitalMargin','digitalSide','digitalPlayerName','paperPlayerName','paperVerificationId'])
 &&isUuid(v.gameId)&&(review?isUuid(v.caseId):isUuid(v.eventId))&&text(v.eventName)&&positive(v.gameNumber)&&Number(v.gameNumber)<=99&&positive(v.gameVersion)
 &&isUuid(v.digitalSubmissionId)&&winner(v.digitalWinnerSide)&&spread(v.digitalMargin)&&winner(v.digitalSide)&&text(v.digitalPlayerName)&&text(v.paperPlayerName)
 &&typeof v.paperVerificationId==='string'&&/^[A-Z]-[1-9][0-9]*$/.test(v.paperVerificationId);
}
/** Strictly decode first, then remove every other event and unenrolled game. */
export function projectMixedOfficialWorkspace(cap:MixedCapability,synthetic:unknown,paper:unknown,hybrid:unknown):MixedOfficialWorkspace|null{
 if(!cap.isOfficial||!record(synthetic)||!exact(synthetic,['kind','tournamentId','notice','fixtures','artifacts'])||synthetic.kind!=='synthetic-mixed-workspace-v1'||!sameMixedUuid(synthetic.tournamentId,cap.tournamentId)
 ||!text(synthetic.notice,500)||!Array.isArray(synthetic.fixtures)||!Array.isArray(synthetic.artifacts))return null;
 const fixtures=synthetic.fixtures;if(!fixtures.every(f=>record(f)&&exact(f,['eventId','sourceSha256'])&&isUuid(f.eventId)&&typeof f.sourceSha256==='string'&&/^[a-f0-9]{64}$/.test(f.sourceSha256))
 ||new Set(fixtures.map(f=>(f as Record<string,string>).eventId.toLowerCase())).size!==fixtures.length||!fixtures.some(f=>sameMixedUuid((f as Record<string,unknown>).eventId,cap.eventId)))return null;
 if(!synthetic.artifacts.every(a=>record(a)&&isUuid(a.eventId)&&isMixedArtifact(a,cap.tournamentId,a.eventId)&&fixtures.some(f=>sameMixedUuid((f as Record<string,unknown>).eventId,a.eventId))))return null;
 const all=synthetic.artifacts as MixedArtifact[];if(new Set(all.map(a=>a.gameId.toLowerCase())).size!==all.length||new Set(all.map(a=>a.artifactId.toLowerCase())).size!==all.length)return null;
 if(!record(paper)||!exact(paper,['tournamentId','tournamentName','actorRole','actorIdentityConfirmed','unboundOfficials','rosterChoices','candidates','reviewCases'])
 ||!sameMixedUuid(paper.tournamentId,cap.tournamentId)||!text(paper.tournamentName)||!['director','co_director','cross_checker'].includes(paper.actorRole as string)||typeof paper.actorIdentityConfirmed!=='boolean'
 ||!Array.isArray(paper.unboundOfficials)||!Array.isArray(paper.rosterChoices)||!Array.isArray(paper.candidates)||!Array.isArray(paper.reviewCases)
 ||!paper.candidates.every(x=>paperItem(x,false))||!paper.reviewCases.every(x=>paperItem(x,true)))return null;
 if(!record(hybrid)||!exact(hybrid,['tournamentId','tournamentName','actorRole','actorIdentityConfirmed','candidates','reviewCases'])||!sameMixedUuid(hybrid.tournamentId,cap.tournamentId)||!text(hybrid.tournamentName)
 ||!['director','co_director','cross_checker'].includes(hybrid.actorRole as string)||typeof hybrid.actorIdentityConfirmed!=='boolean'||!Array.isArray(hybrid.candidates)||!Array.isArray(hybrid.reviewCases)
 ||!hybrid.candidates.every(x=>hybridItem(x,false))||!hybrid.reviewCases.every(x=>hybridItem(x,true)))return null;
 const artifacts=all.filter(a=>sameMixedUuid(a.eventId,cap.eventId));
 const includes=(gid:string,pairing:'PP'|'PD')=>artifacts.some(a=>sameMixedUuid(a.gameId,gid)&&a.pairing===pairing);
 const out:MixedOfficialWorkspace={kind:'synthetic-mixed-official-v1',capability:{...cap,officialIdentityConfirmed:cap.officialIdentityConfirmed&&paper.actorIdentityConfirmed&&hybrid.actorIdentityConfirmed},notice:mixedRehearsalNotice,artifacts,
 paperCandidates:(paper.candidates as MixedPaperCandidate[]).filter(g=>sameMixedUuid(g.eventId,cap.eventId)&&includes(g.gameId,'PP')),
 paperReviewCases:(paper.reviewCases as MixedPaperReviewCase[]).filter(g=>includes(g.gameId,'PP')),
 hybridCandidates:(hybrid.candidates as MixedHybridItem[]).filter(g=>sameMixedUuid(g.eventId,cap.eventId)&&includes(g.gameId,'PD')),
 hybridReviewCases:(hybrid.reviewCases as MixedHybridItem[]).filter(g=>includes(g.gameId,'PD'))};
 return isMixedOfficialWorkspace(out,cap.actorId,cap.tournamentId,cap.eventId)?out:null;
}
/** Artifact-only reader used for exact retained-write retries, not action availability. */
export function readMixedArtifacts(v:unknown,tid:string,eid:string):MixedArtifact[]|null{
 if(!record(v)||!exact(v,['kind','tournamentId','notice','fixtures','artifacts'])||v.kind!=='synthetic-mixed-workspace-v1'||!sameMixedUuid(v.tournamentId,tid)||!text(v.notice,500)||!Array.isArray(v.fixtures)||!Array.isArray(v.artifacts))return null;
 if(!v.fixtures.every(f=>record(f)&&exact(f,['eventId','sourceSha256'])&&isUuid(f.eventId)&&typeof f.sourceSha256==='string'&&/^[a-f0-9]{64}$/.test(f.sourceSha256))
 ||!v.fixtures.some(f=>sameMixedUuid((f as Record<string,unknown>).eventId,eid)))return null;
 if(new Set(v.fixtures.map(f=>(f as Record<string,string>).eventId.toLowerCase())).size!==v.fixtures.length)return null;
 if(!v.artifacts.every(a=>record(a)&&isUuid(a.eventId)&&isMixedArtifact(a,tid,a.eventId)&&v.fixtures instanceof Array&&v.fixtures.some(f=>record(f)&&sameMixedUuid(f.eventId,a.eventId))))return null;
 const all=v.artifacts as MixedArtifact[];
 if(new Set(all.map(a=>a.gameId.toLowerCase())).size!==all.length||new Set(all.map(a=>a.artifactId.toLowerCase())).size!==all.length)return null;
 return all.filter(a=>sameMixedUuid(a.eventId,eid));
}
export function isMixedOfficialWorkspace(v:unknown,actor:string,tid:string,eid:string):v is MixedOfficialWorkspace{
 if(!record(v)||!exact(v,['kind','capability','notice','artifacts','paperCandidates','paperReviewCases','hybridCandidates','hybridReviewCases'])||v.kind!=='synthetic-mixed-official-v1'
 ||!isMixedCapability(v.capability,actor,tid,eid)||!v.capability.isOfficial||v.notice!==mixedRehearsalNotice||!Array.isArray(v.artifacts)||!v.artifacts.every(a=>isMixedArtifact(a,tid,eid))
 ||!Array.isArray(v.paperCandidates)||!Array.isArray(v.paperReviewCases)||!Array.isArray(v.hybridCandidates)||!Array.isArray(v.hybridReviewCases))return false;
 const artifacts=v.artifacts as MixedArtifact[];
 if(new Set(artifacts.map(a=>a.artifactId.toLowerCase())).size!==artifacts.length||new Set(artifacts.map(a=>a.gameId.toLowerCase())).size!==artifacts.length)return false;
 const includes=(gid:string,pairing:'PP'|'PD')=>artifacts.some(a=>sameMixedUuid(a.gameId,gid)&&a.pairing===pairing);
 const lists=[v.paperCandidates,v.paperReviewCases,v.hybridCandidates,v.hybridReviewCases];
 if(lists.some(list=>new Set(list.map(g=>record(g)&&isUuid(g.gameId)?g.gameId.toLowerCase():'invalid')).size!==list.length))return false;
 return v.paperCandidates.every(g=>paperItem(g,false)&&g.gameNumber<=12&&sameMixedUuid((g as MixedPaperCandidate).eventId,eid)&&includes(g.gameId,'PP'))
 &&v.paperReviewCases.every(g=>paperItem(g,true)&&g.gameNumber<=12&&includes(g.gameId,'PP'))
 &&v.hybridCandidates.every(g=>hybridItem(g,false)&&g.gameNumber<=12&&sameMixedUuid(g.eventId,eid)&&includes(g.gameId,'PD'))
 &&v.hybridReviewCases.every(g=>hybridItem(g,true)&&g.gameNumber<=12&&includes(g.gameId,'PD'));
}
