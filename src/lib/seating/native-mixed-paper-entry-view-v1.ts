import {isNativeMixedGameTargetV1,readNativeMixedGameStateV1,isNativeMixedGameWriteRequestV1,type NativeMixedGameTargetV1,type NativeMixedGameStateV1,type NativeMixedGameWriteRequestV1} from './native-mixed-game-evidence-v1.ts';
import {isNativeMixedGamePersonV1,type NativeMixedGamePersonV1} from './native-mixed-digital-entry-view-v1.ts';
/** Game-scoped correlation only; actorRef is NOT an account/profile ID and is never sent in writes. */
export type NativeMixedPaperPersonV1=Omit<NativeMixedGamePersonV1,'profileId'>&{actorRef:string|null};
type Claim={side:'a'|'b';result:{winnerSide:'a'|'b';margin:number}};
type Capture=Extract<NativeMixedGameStateV1['entries'][number],{action:'paper-capture'}>;
export type NativeMixedPaperEntryBindingV1={target:NativeMixedGameTargetV1;tournamentName:string;eventName:string;gameNumber:number;sideA:NativeMixedPaperPersonV1;sideB:NativeMixedPaperPersonV1;
 official:{roles:('director'|'co_director'|'cross_checker')[];identityBindingId:string;nonselfChecked:true}};
export type NativeMixedPaperEntryViewV1={phase:'capture'|'review'|'waiting'|'complete'|'mismatch';message:string;paperSides:('a'|'b')[];capture:Capture|null;state:NativeMixedGameStateV1;permissionVerified:false};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).sort().join()===keys.sort().join();
const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=160&&!/[\u0000-\u001f\u007f]/u.test(v);
export function isNativeMixedPaperPersonV1(p:unknown):p is NativeMixedPaperPersonV1{if(!exact(p,['participantId','actorRef','displayName','fixedTournamentId','currentSeat','mode']))return false;const{actorRef,...rest}=p;return isNativeMixedGamePersonV1({...rest,profileId:actorRef});}
export function isNativeMixedPaperEntryBindingV1(b:unknown):b is NativeMixedPaperEntryBindingV1{
 if(!exact(b,['target','tournamentName','eventName','gameNumber','sideA','sideB','official'])||!isNativeMixedGameTargetV1(b.target)||!text(b.tournamentName)||!text(b.eventName)||typeof b.gameNumber!=='number'||!Number.isInteger(b.gameNumber)||b.gameNumber<1||b.gameNumber>12
  ||!isNativeMixedPaperPersonV1(b.sideA)||!isNativeMixedPaperPersonV1(b.sideB)||!exact(b.official,['roles','identityBindingId','nonselfChecked'])||!uuid(b.official.identityBindingId)||b.official.nonselfChecked!==true||!Array.isArray(b.official.roles)||!b.official.roles.length||!b.official.roles.every(r=>['director','co_director','cross_checker'].includes(r))||new Set(b.official.roles).size!==b.official.roles.length)return false;
 const a=b.sideA,c=b.sideB;return a.participantId!==c.participantId&&a.fixedTournamentId!==c.fixedTournamentId&&a.currentSeat!==c.currentSeat&&(a.mode==='paper'||c.mode==='paper')&&!(a.mode==='digital'&&c.mode==='digital'&&a.actorRef===c.actorRef)&&a.actorRef!==b.target.actorId&&c.actorRef!==b.target.actorId;
}
const same=(a:Claim['result'],b:Claim['result'])=>a.winnerSide===b.winnerSide&&a.margin===b.margin;
/** Strict own-session, game-scoped server DTO. These display aliases are never
 * accepted as account identity or sent in write requests. */
export function readNativeMixedPaperBindingV1(value:unknown,target:NativeMixedGameTargetV1):NativeMixedPaperEntryBindingV1|null{
 if(!isNativeMixedGameTargetV1(target)||!exact(value,['kind','actorId','sessionId','tournamentId','eventId','startId','gameId','startSourceDigest','tournamentName','eventName','gameNumber','sideA','sideB','official','simulationOnly'])
  ||value.kind!=='native-mixed-paper-binding-v1'||value.simulationOnly!==true
  ||['actorId','sessionId','tournamentId','eventId','startId','gameId','startSourceDigest'].some(k=>value[k]!==target[k as keyof NativeMixedGameTargetV1]))return null;
 const b={target:structuredClone(target),tournamentName:value.tournamentName,eventName:value.eventName,gameNumber:value.gameNumber,sideA:value.sideA,sideB:value.sideB,official:value.official};
 return isNativeMixedPaperEntryBindingV1(b)?structuredClone(b):null;
}
const matches=(a:Claim[],b:Claim[])=>a.length===b.length&&a.every(c=>b.some(d=>c.side===d.side&&same(c.result,d.result)));
/** Supplied UI model only; server current roles/identity/nonself/consent remain
 * authoritative. Paper claims start blank and are never inferred from Digital. */
export function projectNativeMixedPaperEntryV1(binding:unknown,value:unknown):NativeMixedPaperEntryViewV1|null{
 if(!isNativeMixedPaperEntryBindingV1(binding))return null;const b=binding,state=readNativeMixedGameStateV1(value,b.target);if(!state)return null;
 const sides=([{side:'a',person:b.sideA},{side:'b',person:b.sideB}]as const),paperSides=sides.filter(s=>s.person.mode==='paper').map(s=>s.side),digital=sides.filter(s=>s.person.mode==='digital').map(s=>s.person);
 const view=(phase:NativeMixedPaperEntryViewV1['phase'],message:string,capture:Capture|null=null):NativeMixedPaperEntryViewV1=>({phase,message,paperSides,capture,state,permissionVerified:false});
 if(state.evidenceVisibility==='metadata-only')return state.revision<=digital.length?view(b.official.roles.includes('cross_checker')?'capture':'waiting',b.official.roles.includes('cross_checker')?'Enter each fictional paper card separately. Digital results stay hidden.':'Waiting for an assigned cross-checker to capture the fictional cards.'):null;
 const submissions=new Map<string,NativeMixedGameStateV1['entries'][number]>(),confirmed=new Set<string>();let capture:Capture|null=null,review:Extract<NativeMixedGameStateV1['entries'][number],{action:'paper-review'}>|null=null,mismatch=false;
 for(const e of state.entries){
  if(mismatch)return null;
  if(e.action==='digital-submit'){
   if(confirmed.size||submissions.has(e.participantId)||!digital.some(p=>p.participantId===e.participantId&&p.actorRef===e.actorId))return null;submissions.set(e.participantId,e);
  }else if(e.action==='paper-capture'){
   if(capture||confirmed.size||digital.some(p=>p.actorRef===e.actorId)||e.claims.length!==paperSides.length||e.claims.some(c=>!paperSides.includes(c.side)))return null;capture=e;
  }else if(e.action==='paper-review'){
   if(!capture||review||confirmed.size||digital.some(p=>p.actorRef===e.actorId)||e.actorId===capture.actorId||e.captureId!==capture.id||e.artifactId!==capture.artifactId||e.artifactDigest!==capture.artifactDigest||!matches(e.reenteredClaims,capture.claims))return null;review=e;
  }else{
   const own=submissions.get(e.participantId),refs=[...submissions.values()].map(s=>s.id).concat(capture&&review?[capture.id,review.id]:[]).sort();
   if(!capture||!review||submissions.size!==digital.length||!own||own.action!=='digital-submit'||!digital.some(p=>p.participantId===e.participantId&&p.actorRef===e.actorId)||confirmed.has(e.participantId)||!same(e.result,own.result)||JSON.stringify([...e.references].sort())!==JSON.stringify(refs))return null;confirmed.add(e.participantId);
  }
  const results=[...submissions.values()].flatMap(s=>s.action==='digital-submit'?[s.result]:[]).concat(capture?capture.claims.map(c=>c.result):[]);mismatch=results.length>1&&results.some(r=>!same(r,results[0]));
 }
 if(!capture)return null;
 if(mismatch)return view('mismatch','The entries do not match. This practice game is blocked; correction is not available in these controls.',capture);
 if(!review)return view(capture.actorId!==b.target.actorId?'review':'waiting',capture.actorId===b.target.actorId?'Your capture is recorded. A different assigned official must re-enter and review it.':'Independently re-enter each fictional paper card before approving this capture.',capture);
 if(submissions.size===digital.length&&confirmed.size===digital.length)return view('complete','Rehearsal evidence is complete. This is not an official tournament result.',capture);
 return view('waiting','Paper review is recorded. Waiting for the Digital player to submit or confirm their own entry.',capture);
}
export function buildNativeMixedPaperEntryRequestV1(binding:NativeMixedPaperEntryBindingV1,value:unknown,operationId:string,artifactId:string|null,claims:Claim[]):NativeMixedGameWriteRequestV1|null{
 const v=projectNativeMixedPaperEntryV1(binding,value);if(!v||!uuid(operationId)||!['capture','review'].includes(v.phase))return null;
 const common={kind:'native-mixed-simulation-game-write-v1' as const,operationId,startId:binding.target.startId,gameId:binding.target.gameId,expectedStartSourceDigest:binding.target.startSourceDigest,expectedRevision:v.state.revision,expectedHistoryDigest:v.state.historyDigest};
 if(!isNativeMixedGameWriteRequestV1({...common,action:'paper-capture',payload:{artifactId:operationId,claims,physicalOriginal:false,fictionalOpponentPlayed:false,independentHumanPlayClaimed:false,statement:'fictional-paper-capture-v1'}}))return null;
 const request=v.phase==='capture'?{...common,action:'paper-capture',payload:{artifactId,claims,physicalOriginal:false,fictionalOpponentPlayed:false,independentHumanPlayClaimed:false,statement:'fictional-paper-capture-v1'}}:v.capture&&matches(claims,v.capture.claims)?{...common,action:'paper-review',payload:{captureId:v.capture.id,artifactId:v.capture.artifactId,artifactDigest:v.capture.artifactDigest,reenteredClaims:claims,decision:'accepted-simulation-only',statement:'fictional-paper-review-v1'}}:null;
 return request&&isNativeMixedGameWriteRequestV1(request)&&(request.action==='paper-capture'?request.payload.claims.length===v.paperSides.length&&request.payload.claims.every(c=>v.paperSides.includes(c.side)):true)?structuredClone(request):null;
}
