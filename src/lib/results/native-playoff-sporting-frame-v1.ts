import'server-only';
import{verifiedPlayoffSlotsV2}from'../playoffs/verified-playoff-slots-v2.ts';
import{playoffDisplayVersion,projectPlayerPlayoff,type PlayoffDisplayInput}from'./player-playoff-display.ts';
import{playoffSeriesProgressV1}from'../playoffs/series-progress-v1.ts';
import{resolveEventSeriesDraftV1}from'../playoffs/event-playoff-parameters-v1.ts';
type Submission={submissionId:string;actionId:string;actorId:string;winnerParticipantId:string;gameVersion:number};
type Confirmation={confirmationId:string;actionId:string;actorId:string;submissionId:string;gameVersion:number};
type Action={actionId:string;operationId:string;actorId:string;gameId:string;gameVersion:number;actionType:'submit'|'amend'|'confirm';priorSubmissionId:string|null;submission:null|{submissionId:string;participantId:string;winnerParticipantId:string};confirmation:null|{confirmationId:string;submissionId:string}};
type Game={gameId:string;gameNumber:number;gameVersion:number;verifiedGameId:string;verifiedByActionId:string;winnerParticipantId:string;loserParticipantId:string;sourceDigest:string;submissions:Submission[];confirmations:Confirmation[]};
type Parent=null|{matchId:string;resultId:string;version:number};
type Match={slot:number;round:'regular'|'semifinal'|'final';matchId:string;generationId:string;generationVersion:number;sourceDigest:string;sourceCapture:{tournamentId:string;eventId:string;qualificationId:string;slot:number;playoffStartId:string;gateDigest:string;settingsBindingId:string;reviewId:string;activationId:string;round:string;participants:string[];profiles:string[];rosterLinks:string[];preferences:number[];format:{winsRequired:number;maximumGames:number};parentResultPins:Parent[]};actionHistoryDigest:string;actions:Action[];participants:string[];profiles:string[];parentResultPins:Parent[];winsRequired:number;maximumGames:number;result:{resultId:string;version:number;winnerId:string;loserId:string;winsA:number;winsB:number;gameCount:number;sourceDigest:string;gamesDigest:string;completedByProfileId:string;operationId:string};games:Game[]};
type Player={participantId:string;profileId:string;displayName:string;tournamentPlayerId:string;seed:number};
type Frame={qualificationResultVersionId:string;qualificationVersion:number;entrantCount:number;qualifierCount:number;eventKind:'main'|'consolation';settingsSnapshotId:string;settingsBindingId:string;playoffStartId:string;gateDigest:string;players:Player[];matches:Match[]};
type Scope={actorId:string;tournamentId:string;eventId:string};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>obj(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&'value'in d&&d.enumerable;});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const int=(v:unknown,min=0,max=2147483647):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max&&!Object.is(v,-0);
const dense=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&v.every((_x,i)=>Object.hasOwn(v,i));
const ids=(v:unknown,n:number):v is string[]=>dense(v,n)&&v.length===n&&v.every(uuid)&&new Set(v).size===n;
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>obj(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const parents=(v:unknown):v is Parent[]=>dense(v,2)&&v.length===2&&v.every(p=>p===null||(exact(p,['matchId','resultId','version'])&&uuid(p.matchId)&&uuid(p.resultId)&&int(p.version,1)));
const noAuthority={publicAccessGranted:false as const,writeAuthorized:false as const,payoutAuthorized:false as const,finalizationAuthorized:false as const,moneyMoved:false as const};
const fail=(code:string)=>({status:'blocked' as const,code,...noAuthority});

function matchShape(value:unknown):value is Match{
 if(!exact(value,['slot','round','matchId','generationId','generationVersion','sourceDigest','sourceCapture','actionHistoryDigest','actions','participants','profiles','parentResultPins','winsRequired','maximumGames','result','games'])
 ||!int(value.slot,1,63)||!['regular','semifinal','final'].includes(value.round as string)||![value.matchId,value.generationId].every(uuid)||!int(value.generationVersion,1)||!hash(value.sourceDigest)||!hash(value.actionHistoryDigest)||!ids(value.participants,2)||!ids(value.profiles,2)||!parents(value.parentResultPins)||!int(value.winsRequired,1,1250)||value.maximumGames!==value.winsRequired*2-1||!dense(value.games,2500)||!value.games.length||!dense(value.actions,10000))return false;
 const c=value.sourceCapture;
 if(!exact(c,['tournamentId','eventId','qualificationId','slot','playoffStartId','gateDigest','settingsBindingId','reviewId','activationId','round','participants','profiles','rosterLinks','preferences','format','parentResultPins'])
 ||![c.tournamentId,c.eventId,c.qualificationId,c.playoffStartId,c.settingsBindingId,c.reviewId,c.activationId].every(uuid)||!int(c.slot,1,63)||!hash(c.gateDigest)||typeof c.round!=='string'||!ids(c.participants,2)||!ids(c.profiles,2)||!ids(c.rosterLinks,2)||!dense(c.preferences,2)||c.preferences.length!==2||!c.preferences.every(v=>int(v))||!exact(c.format,['winsRequired','maximumGames'])||!parents(c.parentResultPins))return false;
 const r=value.result;
 if(!exact(r,['resultId','version','winnerId','loserId','winsA','winsB','gameCount','sourceDigest','gamesDigest','completedByProfileId','operationId'])||![r.resultId,r.winnerId,r.loserId,r.completedByProfileId,r.operationId].every(uuid)||r.version!==1||![r.winsA,r.winsB].every(v=>int(v))||!int(r.gameCount,1,2500)||!hash(r.sourceDigest)||!hash(r.gamesDigest))return false;
 for(const g of value.games){
  if(!exact(g,['gameId','gameNumber','gameVersion','verifiedGameId','verifiedByActionId','winnerParticipantId','loserParticipantId','sourceDigest','submissions','confirmations'])||![g.gameId,g.verifiedGameId,g.verifiedByActionId,g.winnerParticipantId,g.loserParticipantId].every(uuid)||!int(g.gameNumber,1,2500)||!int(g.gameVersion,1)||!hash(g.sourceDigest)||!dense(g.submissions,2)||g.submissions.length!==2||!dense(g.confirmations,2)||g.confirmations.length!==2)return false;
  if(!g.submissions.every(s=>exact(s,['submissionId','actionId','actorId','winnerParticipantId','gameVersion'])&&[s.submissionId,s.actionId,s.actorId,s.winnerParticipantId].every(uuid)&&int(s.gameVersion,1))||!g.confirmations.every(c=>exact(c,['confirmationId','actionId','actorId','submissionId','gameVersion'])&&[c.confirmationId,c.actionId,c.actorId,c.submissionId].every(uuid)&&int(c.gameVersion,1)))return false;
 }
 for(const a of value.actions){
  if(!exact(a,['actionId','operationId','actorId','gameId','gameVersion','actionType','priorSubmissionId','submission','confirmation'])||![a.actionId,a.operationId,a.actorId,a.gameId].every(uuid)||!int(a.gameVersion,1)||!['submit','amend','confirm'].includes(a.actionType as string)||(a.priorSubmissionId!==null&&!uuid(a.priorSubmissionId)))return false;
  if(a.actionType==='confirm'){if(a.submission!==null||a.priorSubmissionId!==null||!exact(a.confirmation,['confirmationId','submissionId'])||![a.confirmation.confirmationId,a.confirmation.submissionId].every(uuid))return false;}
  else if(a.confirmation!==null||!exact(a.submission,['submissionId','participantId','winnerParticipantId'])||![a.submission.submissionId,a.submission.participantId,a.submission.winnerParticipantId].every(uuid))return false;
 }
 return true;
}

/** Replay current own-submission/confirmation lineage. Amendments may add rows;
 * confirming before the other player submits is supported. No historical row
 * is relabeled as an operation UUID or counted as a current confirmation. */
function replayMatch(m:Match,seen:{actions:Set<string>;operations:Set<string>;games:Set<string>;verified:Set<string>;submissions:Set<string>;confirmations:Set<string>}){
 const gameMap=new Map(m.games.map(g=>[g.gameId,g]));if(gameMap.size!==m.games.length||m.actions.some(a=>!gameMap.has(a.gameId)))return false;
 let offset=0;
 for(const [index,g]of m.games.entries()){
  if(g.gameNumber!==index+1||seen.games.has(g.gameId)||seen.verified.has(g.verifiedGameId)||g.sourceDigest!==m.sourceDigest||g.winnerParticipantId===g.loserParticipantId||!m.participants.includes(g.winnerParticipantId)||!m.participants.includes(g.loserParticipantId))return false;
  seen.games.add(g.gameId);seen.verified.add(g.verifiedGameId);
  const own=new Map<string,Submission>(),confirmed=new Map<string,Confirmation>();let version=0,complete=false,last:Action|undefined;
  while(offset<m.actions.length&&m.actions[offset].gameId===g.gameId){const a=m.actions[offset++];
   if(complete||a.gameVersion!==++version||!m.profiles.includes(a.actorId)||seen.actions.has(a.actionId)||seen.operations.has(`${a.actorId}:${a.operationId}`))return false;
   seen.actions.add(a.actionId);seen.operations.add(`${a.actorId}:${a.operationId}`);last=a;
   if(a.actionType==='confirm'){
    const c=a.confirmation!;if(!own.has(a.actorId)||c.submissionId!==own.get(a.actorId)!.submissionId||confirmed.get(a.actorId)?.submissionId===c.submissionId||seen.confirmations.has(c.confirmationId))return false;
    seen.confirmations.add(c.confirmationId);confirmed.set(a.actorId,{...c,actionId:a.actionId,actorId:a.actorId,gameVersion:a.gameVersion});
   }else{
    const s=a.submission!,previous=own.get(a.actorId);
    if(s.participantId!==m.participants[m.profiles.indexOf(a.actorId)]||!m.participants.includes(s.winnerParticipantId)||seen.submissions.has(s.submissionId)||a.priorSubmissionId!==(previous?.submissionId??null)||(a.actionType==='submit')!==(previous===undefined))return false;
    seen.submissions.add(s.submissionId);own.set(a.actorId,{submissionId:s.submissionId,actionId:a.actionId,actorId:a.actorId,winnerParticipantId:s.winnerParticipantId,gameVersion:a.gameVersion});confirmed.delete(a.actorId);
   }
   complete=m.profiles.every(p=>own.has(p)&&confirmed.get(p)?.submissionId===own.get(p)!.submissionId)&&own.get(m.profiles[0])!.winnerParticipantId===own.get(m.profiles[1])!.winnerParticipantId;
  }
  if(!complete||!last||last.actionType!=='confirm'||last.actionId!==g.verifiedByActionId||version!==g.gameVersion||own.get(m.profiles[0])!.winnerParticipantId!==g.winnerParticipantId||!same(g.submissions.map(s=>s.actorId).sort(),[...m.profiles].sort())||!same(g.confirmations.map(c=>c.actorId).sort(),[...m.profiles].sort())||g.submissions.some(s=>!same(s,own.get(s.actorId)))||g.confirmations.some(c=>!same(c,confirmed.get(c.actorId))))return false;
 }
 if(offset!==m.actions.length)return false;
 const last=m.actions.at(-1);return !!last&&m.result.completedByProfileId===last.actorId&&m.result.operationId===last.operationId;
}


/** Shared private sporting proof. No Finance, membership, award or generation
 * authority. The producer must verify current locked receipt/audit source. */
export function readNativePlayoffSportingFrameV1(value:unknown,scope:Scope,qualification:unknown,binding:unknown,eventKind:unknown,draft:unknown){try{
 if(!exact(scope,['actorId','tournamentId','eventId'])||!Object.values(scope).every(uuid)||!exact(value,['playoff','sourceDigest'])||!hash(value.sourceDigest)||!exact(qualification,['resultVersionId','version','participantCount','qualifierCount'])||!uuid(qualification.resultVersionId)||!int(qualification.version,1)||!int(qualification.participantCount,12,256)||!int(qualification.qualifierCount,4,64)||!exact(binding,['bindingId','settingsSnapshotId','reviewId','activationId'])||!Object.values(binding).every(uuid)||!['main','consolation'].includes(String(eventKind)))return fail('native_source_binding_changed');
 const q=qualification as {resultVersionId:string;version:number;participantCount:number;qualifierCount:number},b=binding as {bindingId:string;settingsSnapshotId:string;reviewId:string;activationId:string},settings=resolveEventSeriesDraftV1(draft);if(!settings)return fail('native_source_binding_changed');
  const p=value.playoff;
  if(!exact(p,['qualificationResultVersionId','qualificationVersion','entrantCount','qualifierCount','eventKind','settingsSnapshotId','settingsBindingId','playoffStartId','gateDigest','players','matches'])||![p.qualificationResultVersionId,p.settingsSnapshotId,p.settingsBindingId,p.playoffStartId].every(uuid)||!int(p.qualificationVersion,1)||!int(p.entrantCount,12,256)||!int(p.qualifierCount,4,64)||p.qualifierCount!==Math.ceil(p.entrantCount/4)||!hash(p.gateDigest)||!dense(p.players,64)||p.players.length!==p.qualifierCount||!dense(p.matches,63)||p.matches.length!==Number(p.qualifierCount)-1)return fail('native_playoff_shape_invalid');
  if(!p.players.every(x=>exact(x,['participantId','profileId','displayName','tournamentPlayerId','seed'])&&[x.participantId,x.profileId].every(uuid)&&typeof x.displayName==='string'&&x.displayName.trim()===x.displayName&&x.displayName.length>0&&x.displayName.length<=200&&!/[\u0000-\u001f\u007f]/.test(x.displayName)&&typeof x.tournamentPlayerId==='string'&&/^[A-Z]-[1-9][0-9]{0,3}$/.test(x.tournamentPlayerId)&&int(x.seed,1,64))||!p.matches.every(matchShape))return fail('native_playoff_shape_invalid');
  const frame=p as unknown as Frame;
  if(!q||!settings||frame.qualificationResultVersionId!==q.resultVersionId||frame.qualificationVersion!==q.version||frame.entrantCount!==q.participantCount||frame.qualifierCount!==q.qualifierCount||frame.eventKind!==eventKind||frame.settingsSnapshotId!==b.settingsSnapshotId||frame.settingsBindingId!==b.bindingId)return fail('native_source_binding_changed');
  const players=[...frame.players].sort((a,b)=>a.seed-b.seed);
  if(!players.every((x,i)=>x.seed===i+1)||new Set(players.map(x=>x.participantId)).size!==players.length||new Set(players.map(x=>x.profileId)).size!==players.length||new Set(players.map(x=>x.tournamentPlayerId)).size!==players.length)return fail('native_player_identity_invalid');
  const seen={actions:new Set<string>(),operations:new Set<string>(),games:new Set<string>(),verified:new Set<string>(),submissions:new Set<string>(),confirmations:new Set<string>()},matches=new Set<string>(),generations=new Set<string>(),results=new Set<string>(),identity=new Map<string,string>();
  const input:PlayoffDisplayInput={kind:'player-playoff-display-input-v2',tournamentId:scope.tournamentId,eventId:scope.eventId,qualificationVersionId:q.resultVersionId,sourceDigest:value.sourceDigest,sourceCurrent:true,qualificationReviewed:true,tiesResolved:true,eventType:frame.eventKind==='main'?'main':'regular-consolation',entrantCount:frame.entrantCount,qualifierCount:frame.qualifierCount,players:players.map(x=>({participantId:x.participantId,displayName:x.displayName,tournamentId:x.tournamentPlayerId,seed:x.seed})),results:[]};
  const slots=verifiedPlayoffSlotsV2(frame.qualifierCount);if(!slots)return fail('unsupported_qualifier_count');const path=slots.map(s=>s.bracketMatchId);
  for(const [index,m]of frame.matches.entries()){
   const c=m.sourceCapture,round=slots[index].round,format=round==='final'?settings.final:settings.regular;
   if(m.slot!==index+1||m.round!==round||matches.has(m.matchId)||generations.has(m.generationId)||results.has(m.result.resultId)||m.winsRequired!==format.winsRequired||m.maximumGames!==format.maximumGames||m.result.sourceDigest!==m.sourceDigest||m.result.gameCount!==m.games.length||m.result.winnerId===m.result.loserId||!m.participants.includes(m.result.winnerId)||!m.participants.includes(m.result.loserId))return fail('native_match_binding_invalid');
   matches.add(m.matchId);generations.add(m.generationId);results.add(m.result.resultId);
   if(c.tournamentId!==scope.tournamentId||c.eventId!==scope.eventId||c.qualificationId!==q.resultVersionId||c.slot!==m.slot||c.playoffStartId!==frame.playoffStartId||c.gateDigest!==frame.gateDigest||c.settingsBindingId!==b.bindingId||c.reviewId!==b.reviewId||c.activationId!==b.activationId||c.round!==round||!same(c.participants,m.participants)||!same(c.profiles,m.profiles)||!same(c.format,format)||!same(c.parentResultPins,m.parentResultPins))return fail('native_generation_source_changed');
   for(let i=0;i<2;i++){const player=players.find(p=>p.participantId===m.participants[i]);if(!player||player.profileId!==m.profiles[i])return fail('native_player_identity_invalid');const pin=canonical({profileId:player.profileId,rosterLink:c.rosterLinks[i],preference:c.preferences[i]});if(identity.has(player.participantId)&&identity.get(player.participantId)!==pin)return fail('native_identity_preference_changed');identity.set(player.participantId,pin);}
   if(!replayMatch(m,seen))return fail('native_player_confirmation_invalid');
   const progress=playoffSeriesProgressV1({format,participants:m.participants,evidence:'verified-play',games:m.games.map(g=>({gameNumber:g.gameNumber,resultId:g.verifiedGameId,winnerParticipantId:g.winnerParticipantId,verification:'verified',evidence:'verified-play'}))});
   if(progress.status!=='complete'||progress.winnerParticipantId!==m.result.winnerId||!same(progress.wins,[m.result.winsA,m.result.winsB]))return fail('native_series_progress_invalid');
   const display=projectPlayerPlayoff(input);if(display.status!=='available')return fail(display.code);const target=display.rounds.flatMap(r=>r.matches).find(x=>x.matchId===path[index]);if(!target||target.status!=='ready'||!same(target.sides.map(s=>s.player?.participantId),m.participants))return fail('native_parent_path_invalid');
   const expectedParents=target.sides.map(side=>{if(side.fromMatch===null)return null;const feed=display.rounds.flatMap(r=>r.matches).find(x=>x.matchId===side.fromMatch)!;if(feed.status==='bye')return null;const ordinal=path.indexOf(feed.matchId);const parent=frame.matches[ordinal];return parent?{matchId:parent.matchId,resultId:parent.result.resultId,version:parent.result.version}:null;});
   if(!same(m.parentResultPins,expectedParents))return fail('native_parent_path_invalid');
   const parentBindings=target.round===1?[null,null]:target.sides.map(side=>{const feed=display.rounds.flatMap(r=>r.matches).find(x=>x.matchId===side.fromMatch)!;return feed.status==='bye'?`bye:${q.resultVersionId}:${feed.matchId}`:feed.result?`${feed.result.resultId}:${feed.result.revision}`:null;});
   input.results.push({matchId:target.matchId,sideAId:m.participants[0],sideBId:m.participants[1],parentBindings:parentBindings as [string|null,string|null],bracketVersion:playoffDisplayVersion,winnerId:m.result.winnerId,resultId:m.result.resultId,sourceSeriesOrdinal:null,revision:m.result.version,qualificationVersionId:q.resultVersionId,sourceDigest:value.sourceDigest,provenance:'director-reviewed'});
  }
  const display=projectPlayerPlayoff(input);if(display.status!=='available'||!display.champion||display.rounds.flatMap(r=>r.matches).some(m=>m.status!=='recorded'&&m.status!=='bye'))return fail('native_playoffs_incomplete');
  return{status:'available' as const,input,display,frame,...noAuthority};
 }catch{return fail('native_source_invalid');}}
