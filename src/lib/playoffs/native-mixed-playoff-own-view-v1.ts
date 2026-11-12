/** Private rehearsal projection only. No provider, pending storage or authority. */
export type NativeMixedPlayoffOwnScopeV1={tournamentId:string;eventId:string;participantId:string;tournamentIdNumber:string};
type Entry={id:string;type:'digital-submit'|'digital-confirm'|'paper-capture'|'paper-review';participantId?:string;winnerParticipantId?:string;submissionId?:string;evidenceIds?:string[];artifactId?:string;artifactDigest?:string;captureId?:string;claims?:Claim[];reenteredClaims?:Claim[]};
type Claim={participantId:string;winnerParticipantId:string};
type Game={gameNumber:number;complete:boolean;winnerParticipantId:string|null;revision:number;historyDigest:string;counterEvidenceAvailable:boolean;entries:Entry[]};
type Own={participantId:string;tournamentIdNumber:string};
export type NativeMixedPlayoffOwnMatchV1={slot:number;matchDigest:string;format:{winsRequired:number;maximumGames:number};own:Own;opponent:Own&{mode:'digital'|'paper';displayName:string|null};complete:boolean;winnerParticipantId:string|null;nextGame:{gameNumber:number;expectedRevision:number;expectedHistoryDigest:string}|null;games:Game[];ownWins:number;opponentWins:number};
export type NativeMixedPlayoffOwnAvailableV1={status:'simulated_playoff_own_available';contextId:string;sourceDigest:string;own:Own;matches:NativeMixedPlayoffOwnMatchV1[];complete:boolean;eliminated:boolean;awaitingOpponent:boolean;ownFinishingGroup:{firstPlace:number;lastPlace:number}|null;tournamentId:string;eventId:string;simulationOnly:true;ordinaryQualificationRecorded:false;mrpAwarded:false;moneyMoved:false};
export type NativeMixedPlayoffOwnStateV1=NativeMixedPlayoffOwnAvailableV1|{status:'awaiting_playoff_preparation'|'not_in_simulated_playoffs';own:Own;tournamentId:string;eventId:string;simulationOnly:true;ordinaryQualificationRecorded:false;mrpAwarded:false;moneyMoved:false};
export type NativeMixedPlayoffOwnCommandV1={version:'native-mixed-playoff-request-v1';action:'game-action';expectedSourceDigest:string;data:{contextId:string;slot:number;gameNumber:number;expectedMatchDigest:string;expectedRevision:number;expectedHistoryDigest:string;entry:{type:'digital-submit';participantId:string;winnerParticipantId:string;statement:'simulation-own-playoff-result-v1'}|{type:'digital-confirm';participantId:string;submissionId:string;winnerParticipantId:string;evidenceIds:string[];statement:'simulation-own-playoff-confirmation-v1'}}};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,k:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200&&v===v.trim()&&!/[\u0000-\u001f\u007f]/.test(v);
const int=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isInteger(v)&&!Object.is(v,-0)&&v>=min&&v<=max;
function plain(v:unknown,seen=new Set<object>(),budget={n:0},depth=0):boolean{
 if(depth>64||++budget.n>300000)return false;if(v===null||typeof v==='string'||typeof v==='boolean')return true;if(typeof v==='number')return Number.isFinite(v);
 if(typeof v!=='object'||seen.has(v)||(!Array.isArray(v)&&!object(v)))return false;seen.add(v);
 const keys=Reflect.ownKeys(v);if(Array.isArray(v)&&(v.length>10000||keys.length!==v.length+1))return false;
 for(const k of keys){if(Array.isArray(v)&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(v,k);if(typeof k!=='string'||!d||!('value'in d)||!d.enumerable||!plain(d.value,seen,budget,depth+1))return false;}seen.delete(v);return true;
}
const own=(v:unknown):v is Own=>exact(v,['participantId','tournamentIdNumber'])&&uuid(v.participantId)&&text(v.tournamentIdNumber);
const sameOwn=(a:Own,b:Own)=>a.participantId===b.participantId&&a.tournamentIdNumber===b.tournamentIdNumber;
export function isNativeMixedPlayoffOwnScopeV1(scope:unknown):scope is NativeMixedPlayoffOwnScopeV1{
 try{return plain(scope)&&exact(scope,['tournamentId','eventId','participantId','tournamentIdNumber'])&&[scope.tournamentId,scope.eventId,scope.participantId].every(uuid)&&text(scope.tournamentIdNumber);}catch{return false;}
}
function entry(v:unknown,ids:string[],paper:string|null):v is Entry{
 if(!object(v)||!uuid(v.id))return false;const winner=(x:unknown)=>typeof x==='string'&&ids.includes(x);
 if(v.type==='digital-submit')return exact(v,['id','type','participantId','winnerParticipantId'])&&winner(v.participantId)&&v.participantId!==paper&&winner(v.winnerParticipantId);
 if(v.type==='digital-confirm')return exact(v,['id','type','participantId','submissionId','winnerParticipantId','evidenceIds'])&&winner(v.participantId)&&v.participantId!==paper&&uuid(v.submissionId)&&winner(v.winnerParticipantId)&&Array.isArray(v.evidenceIds)&&v.evidenceIds.length<=4&&v.evidenceIds.every(uuid)&&new Set(v.evidenceIds).size===v.evidenceIds.length;
 const claims=(x:unknown)=>Array.isArray(x)&&x.length===1&&x.every(c=>exact(c,['participantId','winnerParticipantId'])&&c.participantId===paper&&winner(c.winnerParticipantId));
 if(v.type==='paper-capture')return paper!==null&&exact(v,['id','type','artifactId','artifactDigest','claims'])&&uuid(v.artifactId)&&hash(v.artifactDigest)&&claims(v.claims);
 return v.type==='paper-review'&&paper!==null&&exact(v,['id','type','captureId','artifactId','artifactDigest','reenteredClaims'])&&uuid(v.captureId)&&uuid(v.artifactId)&&hash(v.artifactDigest)&&claims(v.reenteredClaims);
}
function match(v:unknown,me:Own):v is NativeMixedPlayoffOwnMatchV1{
 if(!exact(v,['slot','matchDigest','format','own','opponent','complete','winnerParticipantId','nextGame','games','ownWins','opponentWins'])||!int(v.slot,1,4)||!hash(v.matchDigest)||!own(v.own)||!sameOwn(v.own,me)
 ||!exact(v.opponent,['participantId','tournamentIdNumber','mode','displayName'])||!uuid(v.opponent.participantId)||v.opponent.participantId===me.participantId||!text(v.opponent.tournamentIdNumber)||!['digital','paper'].includes(v.opponent.mode as string)||(v.opponent.displayName!==null&&!text(v.opponent.displayName))
 ||!exact(v.format,['winsRequired','maximumGames'])||!int(v.format.winsRequired,1,1250)||!int(v.format.maximumGames,1,2500)||v.format.maximumGames!==2*v.format.winsRequired-1||typeof v.complete!=='boolean'||!int(v.ownWins,0,v.format.winsRequired)||!int(v.opponentWins,0,v.format.winsRequired)
 ||!Array.isArray(v.games)||v.games.length>v.format.maximumGames)return false;
 const ids=[me.participantId,v.opponent.participantId],paper=v.opponent.mode==='paper'?v.opponent.participantId:null,entryIds=new Set<string>();
 for(const [i,g]of v.games.entries()){
  if(!exact(g,['gameNumber','complete','winnerParticipantId','revision','historyDigest','counterEvidenceAvailable','entries'])||g.gameNumber!==i+1||typeof g.complete!=='boolean'||typeof g.counterEvidenceAvailable!=='boolean'||!int(g.revision,0,6)||!hash(g.historyDigest)||!Array.isArray(g.entries)||g.entries.length>6||!g.entries.every(e=>entry(e,ids,paper)))return false;
  for(const e of g.entries as Entry[]){if(entryIds.has(e.id))return false;entryIds.add(e.id);}
  if(!g.counterEvidenceAvailable){if(g.entries.length||g.complete||g.winnerParticipantId!==null)return false;}
  else if(g.entries.length!==g.revision||!(g.entries as Entry[]).some(e=>e.type==='digital-submit'&&e.participantId===me.participantId))return false;
  if(g.complete?typeof g.winnerParticipantId!=='string'||!ids.includes(g.winnerParticipantId):g.winnerParticipantId!==null&&(!uuid(g.winnerParticipantId)||!ids.includes(g.winnerParticipantId)))return false;
 }
 if(v.complete){if(v.nextGame!==null||!ids.includes(v.winnerParticipantId as string)||(v.winnerParticipantId===me.participantId?v.ownWins:v.opponentWins)!==v.format.winsRequired)return false;}
 else{
  if(v.winnerParticipantId!==null||v.ownWins===v.format.winsRequired||v.opponentWins===v.format.winsRequired||!exact(v.nextGame,['gameNumber','expectedRevision','expectedHistoryDigest'])||!int(v.nextGame.gameNumber,1,v.format.maximumGames)||!int(v.nextGame.expectedRevision,0,6)||!hash(v.nextGame.expectedHistoryDigest))return false;
  const g=(v.games as Game[]).find(g=>g.gameNumber===(v.nextGame as Game).gameNumber);
  if(g?(g.complete||g.revision!==v.nextGame.expectedRevision||g.historyDigest!==v.nextGame.expectedHistoryDigest):v.nextGame.gameNumber!==v.games.length+1||v.nextGame.expectedRevision!==0)return false;
 }return true;
}
/** Structural adapter ONLY for a host's authenticated own-RPC response.
 * The authenticated database call supplies ownership authority; this parser
 * never establishes ownership from a posted object, participant ID or digest. */
export function readNativeMixedPlayoffOwnAuthenticatedReplyV1(value:unknown,base:{tournamentId:string;eventId:string}){
 try{
  if(!plain(base)||!exact(base,['tournamentId','eventId'])||!uuid(base.tournamentId)||!uuid(base.eventId)||!plain(value)||!object(value)||!own(value.own))return null;
  const scope={tournamentId:base.tournamentId,eventId:base.eventId,participantId:value.own.participantId,tournamentIdNumber:value.own.tournamentIdNumber};
  const state=readNativeMixedPlayoffOwnV1(value,scope);return state?{scope:Object.freeze(scope),state}:null;
 }catch{return null;}
}
export function readNativeMixedPlayoffOwnV1(value:unknown,scope:NativeMixedPlayoffOwnScopeV1):NativeMixedPlayoffOwnStateV1|null{
 try{
  if(!isNativeMixedPlayoffOwnScopeV1(scope)||!plain(value)||!object(value))return null;
  const common=['status','own','tournamentId','eventId','simulationOnly','ordinaryQualificationRecorded','mrpAwarded','moneyMoved'];
  if(value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||value.simulationOnly!==true||value.ordinaryQualificationRecorded!==false||value.mrpAwarded!==false||value.moneyMoved!==false||!own(value.own)||!sameOwn(value.own,scope))return null;
  if(value.status==='awaiting_playoff_preparation'||value.status==='not_in_simulated_playoffs')return exact(value,common)?structuredClone(value) as NativeMixedPlayoffOwnStateV1:null;
  if(value.status!=='simulated_playoff_own_available'||!exact(value,[...common,'contextId','sourceDigest','matches','complete','eliminated','awaitingOpponent','ownFinishingGroup'])||!uuid(value.contextId)||!hash(value.sourceDigest)||!Array.isArray(value.matches)||value.matches.length>4||!value.matches.every(m=>match(m,value.own as Own))||new Set(value.matches.map(m=>m.slot)).size!==value.matches.length||![value.complete,value.eliminated,value.awaitingOpponent].every(x=>typeof x==='boolean'))return null;
  if(value.complete){if(!exact(value.ownFinishingGroup,['firstPlace','lastPlace'])||![[1,1],[2,2],[3,4],[5,5]].some(([a,b])=>(value.ownFinishingGroup as {firstPlace:number;lastPlace:number}).firstPlace===a&&(value.ownFinishingGroup as {lastPlace:number}).lastPlace===b)||value.awaitingOpponent)return null;}
  else if(value.ownFinishingGroup!==null)return null;
  return structuredClone(value) as NativeMixedPlayoffOwnAvailableV1;
 }catch{return null;}
}
function bundle(m:NativeMixedPlayoffOwnMatchV1,g:Game){
 const entries=g.entries,sub=entries.filter(e=>e.type==='digital-submit'),ownSub=sub.find(e=>e.participantId===m.own.participantId),winner=ownSub?.winnerParticipantId;
 if(!ownSub||!winner||sub.length!==(m.opponent.mode==='digital'?2:1)||new Set(sub.map(e=>e.participantId)).size!==sub.length||sub.some(e=>e.winnerParticipantId!==winner))return null;
 if(m.opponent.mode==='paper'){
  const caps=entries.filter(e=>e.type==='paper-capture'),reviews=entries.filter(e=>e.type==='paper-review'),c=caps[0],r=reviews[0];
  if(caps.length!==1||reviews.length!==1||r.captureId!==c.id||r.artifactId!==c.artifactId||r.artifactDigest!==c.artifactDigest||JSON.stringify(r.reenteredClaims)!==JSON.stringify(c.claims)||c.claims?.some(x=>x.winnerParticipantId!==winner))return null;
 }
 return{ownSub,winner,evidenceIds:entries.filter(e=>e.type!=='digital-confirm').map(e=>e.id).sort()};
}
export function projectNativeMixedPlayoffOwnV1(value:unknown,scope:NativeMixedPlayoffOwnScopeV1){
 const state=readNativeMixedPlayoffOwnV1(value,scope);if(!state)return{phase:'unavailable' as const,state:null,match:null,game:null,confirmation:null};
 if(state.status!=='simulated_playoff_own_available')return{phase:state.status,state,match:null,game:null,confirmation:null};
 const m=state.matches.find(m=>!m.complete),g=m?.games.find(g=>g.gameNumber===m.nextGame?.gameNumber)??null;
 if(!m)return{phase:state.complete?'complete' as const:state.eliminated?'eliminated' as const:'awaiting-opponent' as const,state,match:null,game:null,confirmation:null};
 if(!g?.counterEvidenceAvailable)return{phase:'entry' as const,state,match:m,game:g,confirmation:null};
 const b=bundle(m,g),confirmed=g.entries.some(e=>e.type==='digital-confirm'&&e.participantId===scope.participantId);
 return{phase:confirmed?'waiting-verification' as const:b?'confirm' as const:'waiting-evidence' as const,state,match:m,game:g,confirmation:b};
}
export function buildNativeMixedPlayoffOwnCommandV1(value:unknown,scope:NativeMixedPlayoffOwnScopeV1,choice:'own'|'opponent'|'confirm'):NativeMixedPlayoffOwnCommandV1|null{
 const v=projectNativeMixedPlayoffOwnV1(value,scope),s=v.state,m=v.match;if(s?.status!=='simulated_playoff_own_available'||!m?.nextGame)return null;
 const entry=choice==='confirm'?v.phase==='confirm'&&v.confirmation?{type:'digital-confirm' as const,participantId:scope.participantId,submissionId:v.confirmation.ownSub.id,winnerParticipantId:v.confirmation.winner,evidenceIds:v.confirmation.evidenceIds,statement:'simulation-own-playoff-confirmation-v1' as const}:null
  :v.phase==='entry'&&(choice==='own'||choice==='opponent')?{type:'digital-submit' as const,participantId:scope.participantId,winnerParticipantId:choice==='own'?scope.participantId:m.opponent.participantId,statement:'simulation-own-playoff-result-v1' as const}:null;
 if(!entry)return null;return{version:'native-mixed-playoff-request-v1',action:'game-action',expectedSourceDigest:s.sourceDigest,data:{contextId:s.contextId,slot:m.slot,gameNumber:m.nextGame.gameNumber,expectedMatchDigest:m.matchDigest,expectedRevision:m.nextGame.expectedRevision,expectedHistoryDigest:m.nextGame.expectedHistoryDigest,entry}};
}
