import {isNativeMixedGameTargetV1,readNativeMixedGameStateV1,type NativeMixedGameTargetV1,type NativeMixedGameStateV1,type NativeMixedGameWriteRequestV1} from './native-mixed-game-evidence-v1.ts';
import {isScoreEntryReady} from '../score.ts';
type Result={winnerSide:'a'|'b';margin:number};
export type NativeMixedGamePersonV1={participantId:string;profileId:string|null;displayName:string;fixedTournamentId:string;currentSeat:string;mode:'digital'|'paper'};
type Person=NativeMixedGamePersonV1;
export type NativeMixedDigitalEntryBindingV1={target:NativeMixedGameTargetV1;tournamentName:string;eventName:string;gameNumber:number;ownSide:'a'|'b';player:Person;opponent:Person};
export type NativeMixedDigitalEntryViewV1={phase:'entry'|'waiting'|'confirm'|'complete'|'mismatch'|'upcoming';message:string;state:NativeMixedGameStateV1;ownResult:Result|null;references:string[]};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const text=(v:unknown,max=160):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/u.test(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).sort().join()===keys.sort().join();
export function isNativeMixedGamePersonV1(p:unknown):p is Person{return exact(p,['participantId','profileId','displayName','fixedTournamentId','currentSeat','mode'])&&uuid(p.participantId)&&text(p.displayName)&&text(p.fixedTournamentId,32)
 &&typeof p.currentSeat==='string'&&/^[A-Z]{1,3}-[1-9]\d{0,2}$/.test(p.currentSeat)&&(p.mode==='paper'&&p.profileId===null||p.mode==='digital'&&uuid(p.profileId));}
export function isNativeMixedDigitalEntryBindingV1(v:unknown):v is NativeMixedDigitalEntryBindingV1{
 if(!exact(v,['target','tournamentName','eventName','gameNumber','ownSide','player','opponent'])||!isNativeMixedGameTargetV1(v.target)||!text(v.tournamentName)||!text(v.eventName)
  ||typeof v.gameNumber!=='number'||!Number.isInteger(v.gameNumber)||v.gameNumber<1||v.gameNumber>12||!['a','b'].includes(v.ownSide as string))return false;
 if(!isNativeMixedGamePersonV1(v.player))return false;
 // Only the own-player peer DTO may omit the other account identity.
 if(!isNativeMixedGamePersonV1(v.opponent)&&!(object(v.opponent)&&v.opponent.mode==='digital'&&v.opponent.profileId===null&&isNativeMixedGamePersonV1({...v.opponent,profileId:'00000000-0000-4000-8000-000000000001'})))return false;
 const own=v.player as Person,other=v.opponent as Person;
 return own.mode==='digital'&&own.profileId===v.target.actorId&&own.participantId!==other.participantId&&own.fixedTournamentId!==other.fixedTournamentId&&own.currentSeat!==other.currentSeat&&own.profileId!==other.profileId;
}
const sameResult=(a:Result,b:Result)=>a.winnerSide===b.winnerSide&&a.margin===b.margin;
/** Display/action projection only. Host bindings and supplied DTOs are not
 * permission, current consent, physical play or official-result verification. */
export function projectNativeMixedDigitalEntryV1(binding:unknown,value:unknown):NativeMixedDigitalEntryViewV1|null{
 if(!isNativeMixedDigitalEntryBindingV1(binding))return null;const state=readNativeMixedGameStateV1(value,binding.target);if(!state)return null;
 const view=(phase:NativeMixedDigitalEntryViewV1['phase'],message:string,ownResult:Result|null=null,references:string[]=[]):NativeMixedDigitalEntryViewV1=>({phase,message,state,ownResult,references});
 if(state.playOrder==='official')return null;
 if(state.playOrder==='upcoming')return view('upcoming','Finish your earlier practice games before entering this game. Check your scorecard for the current game.');
 if(state.evidenceVisibility==='metadata-only')return state.playOrder==='current'&&state.revision<4?view('entry','Enter your own result. Other entries stay hidden until you submit.'):null;
 const people=[binding.player,binding.opponent],digital=people.filter(p=>p.mode==='digital'),paper=people.filter(p=>p.mode==='paper');
 const submissions=new Map<string,Extract<(typeof state.entries)[number],{action:'digital-submit'}>>(),confirmed=new Set<string>();
 let capture:Extract<(typeof state.entries)[number],{action:'paper-capture'}>|null=null,review:Extract<(typeof state.entries)[number],{action:'paper-review'}>|null=null,mismatch=false;
 const paperSide=binding.ownSide==='a'?'b':'a';
 const bundle=()=>{
  if(digital.some(p=>!submissions.has(p.participantId))||paper.length>0&&(!capture||!review))return null;
  const results=[...submissions.values()].map(s=>s.result).concat(capture?capture.claims.map(c=>c.result):[]);
  if(!results.length||results.some(r=>!sameResult(r,results[0])))return null;
  return{result:results[0],references:[...submissions.values()].map(s=>s.id).concat(capture&&review?[capture.id,review.id]:[]).sort()};
 };
 for(const e of state.entries){
  if(mismatch)return null;
  if(e.action==='digital-submit'){
   if(confirmed.size||submissions.has(e.participantId)||!digital.some(p=>p.participantId===e.participantId&&(p.profileId===e.actorId||p===binding.opponent&&p.profileId===null&&e.actorId!==binding.target.actorId)))return null;
   submissions.set(e.participantId,e);
  }else if(e.action==='paper-capture'){
   if(!paper.length||capture||confirmed.size||digital.some(p=>p.profileId===e.actorId)||e.claims.length!==1||e.claims[0].side!==paperSide)return null;capture=e;
  }else if(e.action==='paper-review'){
   if(!capture||review||confirmed.size||digital.some(p=>p.profileId===e.actorId)||e.actorId===capture.actorId||e.captureId!==capture.id||e.artifactId!==capture.artifactId||e.artifactDigest!==capture.artifactDigest
    ||e.reenteredClaims.length!==capture.claims.length||e.reenteredClaims.some(c=>!capture!.claims.some(p=>p.side===c.side&&sameResult(p.result,c.result))))return null;review=e;
  }else{
   const ready=bundle();if(!ready||submissions.get(e.participantId)?.actorId!==e.actorId||confirmed.has(e.participantId)||!digital.some(p=>p.participantId===e.participantId&&(p.profileId===e.actorId||p===binding.opponent&&p.profileId===null&&e.actorId!==binding.target.actorId))||!sameResult(e.result,ready.result)||JSON.stringify([...e.references].sort())!==JSON.stringify(ready.references))return null;
   confirmed.add(e.participantId);
  }
  const results=[...submissions.values()].map(s=>s.result).concat(capture?capture.claims.map(c=>c.result):[]);mismatch=results.length>1&&results.some(r=>!sameResult(r,results[0]));
 }
 const own=submissions.get(binding.player.participantId),ready=bundle();
 if(mismatch)return view('mismatch','The entries do not match. This practice game is blocked. Ask the director for help; correction is not available in these controls.',own?.result??null);
 if(!own)return null; // Full evidence must never be exposed to an unsubmitted player.
 if(ready&&digital.every(p=>confirmed.has(p.participantId)))return state.playOrder==='complete'?view('complete','Rehearsal evidence is complete. This is not an official tournament result.',own.result):null;
 if(state.playOrder==='complete')return null;
 if(ready&&!confirmed.has(binding.player.participantId))return view('confirm','The entries match. Confirm your own entry.',own.result,ready.references);
 return view('waiting',confirmed.has(binding.player.participantId)?'Your confirmation is recorded. Waiting for the other player.':paper.length?'Your entry is recorded. Waiting for the independent paper review.':'Your entry is recorded. Waiting for the other player.',own.result);
}
export function buildNativeMixedDigitalEntryRequestV1(binding:NativeMixedDigitalEntryBindingV1,value:unknown,action:'digital-submit'|'digital-confirm',operationId:string,result:Result|null):Extract<NativeMixedGameWriteRequestV1,{action:'digital-submit'|'digital-confirm'}>|null{
 const view=projectNativeMixedDigitalEntryV1(binding,value);if(!view||!uuid(operationId))return null;
 const common={kind:'native-mixed-simulation-game-write-v1' as const,operationId,startId:binding.target.startId,gameId:binding.target.gameId,expectedStartSourceDigest:binding.target.startSourceDigest,expectedRevision:view.state.revision,expectedHistoryDigest:view.state.historyDigest};
 if(action==='digital-submit')return view.phase==='entry'&&result&&['a','b'].includes(result.winnerSide)&&isScoreEntryReady(result.margin,'player')?{...common,action,payload:{participantId:binding.player.participantId,result:structuredClone(result),statement:'simulation-own-result-v1'}}:null;
 return view.phase==='confirm'&&view.ownResult?{...common,action,payload:{participantId:binding.player.participantId,result:structuredClone(view.ownResult),references:[...view.references],statement:'simulation-own-confirmation-v1'}}:null;
}

/** Own-subject metadata only; decoded before any player screen receives it. */
export function readNativeMixedOwnBindingsV1(v:unknown,t:NativeMixedGameTargetV1):NativeMixedDigitalEntryBindingV1[]|null{
 if(!isNativeMixedGameTargetV1(t)||!exact(v,['kind','actorId','sessionId','tournamentId','eventId','startId','startSourceDigest','tournamentName','eventName','simulationOnly','bindings'])
  ||v.kind!=='native-mixed-own-player-bindings-v1'||v.actorId!==t.actorId||v.sessionId!==t.sessionId||v.tournamentId!==t.tournamentId||v.eventId!==t.eventId||v.startId!==t.startId||v.startSourceDigest!==t.startSourceDigest||v.simulationOnly!==true
  ||!Array.isArray(v.bindings)||v.bindings.length!==12)return null;
 const games=new Set(),rounds=new Set(),opponents=new Set();let playerKey:string|null=null;const result:NativeMixedDigitalEntryBindingV1[]=[];
 for(const row of v.bindings){
  if(!exact(row,['gameId','gameNumber','ownSide','player','opponent'])||!uuid(row.gameId))return null;
  const b={target:{...t,gameId:row.gameId},tournamentName:v.tournamentName,eventName:v.eventName,gameNumber:row.gameNumber,ownSide:row.ownSide,player:row.player,opponent:row.opponent};
  if(!isNativeMixedDigitalEntryBindingV1(b)||b.opponent.profileId!==null||games.has(row.gameId)||rounds.has(b.gameNumber)||opponents.has(b.opponent.participantId))return null;
  const key=JSON.stringify([b.player.participantId,b.player.profileId,b.player.fixedTournamentId,b.player.displayName]);if(playerKey!==null&&key!==playerKey)return null;playerKey=key;
  games.add(row.gameId);rounds.add(b.gameNumber);opponents.add(b.opponent.participantId);result.push(structuredClone(b));
 }
 return games.has(t.gameId)?result.sort((a,b)=>a.gameNumber-b.gameNumber):null;
}

export async function loadNativeMixedOwnEntryV1(o:{target:NativeMixedGameTargetV1;transport:ReturnType<typeof import('../api/native-mixed-game-evidence-transport-v1.ts').createNativeMixedGameEvidenceTransportV1>;enabled:()=>boolean;current:()=>boolean}):Promise<{binding:NativeMixedDigitalEntryBindingV1;state:NativeMixedGameStateV1}|null>{
 if(o.enabled()!==true||!o.current())return null;const target=structuredClone(o.target);
 try{
  const metadata=await o.transport.bindings(target);if(o.enabled()!==true||!o.current()||metadata.error!==null)return null;
  const binding=metadata.data?.find(b=>b.target.gameId===target.gameId);if(!binding)return null;
  const reply=await o.transport.state(binding.target);if(o.enabled()!==true||!o.current()||reply.error!==null||!projectNativeMixedDigitalEntryV1(binding,reply.data))return null;
  return{binding,state:reply.data};
 }catch{return null;}
}
