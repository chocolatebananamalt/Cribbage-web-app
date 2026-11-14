import {verifiedPlayoffSlotsV2} from '../../src/lib/playoffs/verified-playoff-slots-v2.ts';
import {createEventFinanceEditorV1} from '../../src/lib/finance/event-finance-workspace-v1.ts';
// Pure synthetic DTOs, not a database or provider fixture.
import {recipientCase} from './final-recipient-fixtures.mjs';
import {projectPlayerPlayoff,playoffDisplayVersion} from '../../src/lib/results/player-playoff-display.ts';
import {resolveEventPlayoffParametersDraftV1} from '../../src/lib/playoffs/event-playoff-parameters-v1.ts';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function nativeRecipientCase(mode='main-v4',{amend=false,qualifiers=null}={}){
 const base=recipientCase(mode),{scope,nativeFinanceSource,proposal,expectedHead}=base,raw=nativeFinanceSource.raw;
 if(qualifiers!==null){if(qualifiers<6||qualifiers>64)throw Error('fictional count');const count=qualifiers*4;raw.qualification.participantCount=count;raw.qualification.qualifierCount=qualifiers;raw.counts.activeParticipants=count;for(const w of[nativeFinanceSource.basis.workspace]){w.entryCount=count;w.qualifierCount=qualifiers;}proposal.editor=createEventFinanceEditorV1(nativeFinanceSource.basis.workspace);base.playoffModels.qualification.qualifiers=Array.from({length:qualifiers},(_,i)=>({participantId:id(i+1),displayName:'Fictional Qualifier '+(i+1),qualificationRank:i+1}));}
 let serial=10000;const next=()=>id(serial++),hash='c'.repeat(64),q=raw.qualification;
 const players=base.playoffModels.qualification.qualifiers.map(p=>({participantId:p.participantId,profileId:next(),displayName:p.displayName,tournamentPlayerId:`A-${p.qualificationRank}`,seed:p.qualificationRank}));
 const frame={qualificationResultVersionId:q.resultVersionId,qualificationVersion:q.version,entrantCount:q.participantCount,qualifierCount:q.qualifierCount,eventKind:raw.event.eventKind,settingsSnapshotId:raw.binding.settingsSnapshotId,settingsBindingId:raw.binding.bindingId,playoffStartId:next(),gateDigest:hash,players,matches:[]};
 const input={kind:'player-playoff-display-input-v2',tournamentId:scope.tournamentId,eventId:scope.eventId,qualificationVersionId:q.resultVersionId,sourceDigest:hash,sourceCurrent:true,qualificationReviewed:true,tiesResolved:true,eventType:frame.eventKind==='main'?'main':'regular-consolation',entrantCount:frame.entrantCount,qualifierCount:frame.qualifierCount,players:players.map(p=>({participantId:p.participantId,displayName:p.displayName,tournamentId:p.tournamentPlayerId,seed:p.seed})),results:[]};
 const nodes=verifiedPlayoffSlotsV2(frame.qualifierCount),paths=nodes.map(n=>n.bracketMatchId);
 const settings=resolveEventPlayoffParametersDraftV1(raw.settings.draft),links=new Map(players.map(p=>[p.participantId,next()]));
 for(const [index,path]of paths.entries()){
  const display=projectPlayerPlayoff(input);if(display.status!=='available')throw Error(display.code);
  const target=display.rounds.flatMap(r=>r.matches).find(m=>m.matchId===path),participants=target.sides.map(s=>s.player.participantId),profiles=participants.map(p=>players.find(x=>x.participantId===p).profileId);
  const round=nodes[index].round,format=round==='final'?settings.series.final:settings.series.regular;
  const pins=target.sides.map(s=>{const feed=display.rounds.flatMap(r=>r.matches).find(m=>m.matchId===s.fromMatch);if(!feed||feed.status==='bye')return null;const m=frame.matches[paths.indexOf(feed.matchId)];return{matchId:m.matchId,resultId:m.result.resultId,version:1};});
  const m={slot:index+1,round,matchId:next(),generationId:next(),generationVersion:1,sourceDigest:hash,sourceCapture:{tournamentId:scope.tournamentId,eventId:scope.eventId,qualificationId:q.resultVersionId,slot:index+1,playoffStartId:frame.playoffStartId,gateDigest:hash,settingsBindingId:raw.binding.bindingId,reviewId:raw.binding.reviewId,activationId:raw.binding.activationId,round,participants,profiles,rosterLinks:participants.map(p=>links.get(p)),preferences:[1,1],format,parentResultPins:pins},actionHistoryDigest:hash,actions:[],participants,profiles,parentResultPins:pins,...format,result:null,games:[]};
  // A clean sweep is enough to prove first-to-required-wins and exact game ownership.
  for(let number=1;number<=format.winsRequired;number++){
   const gameId=next();let version=0;const own=new Map(),confirmed=new Map();
   const submit=(side,winner,kind='submit')=>{const prior=own.get(side),submissionId=next(),actionId=next();const a={actionId,operationId:next(),actorId:profiles[side],gameId,gameVersion:++version,actionType:kind,priorSubmissionId:prior?.submissionId??null,submission:{submissionId,participantId:participants[side],winnerParticipantId:winner},confirmation:null};m.actions.push(a);own.set(side,{submissionId,actionId,actorId:profiles[side],winnerParticipantId:winner,gameVersion:version});confirmed.delete(side);};
   const confirm=side=>{const confirmationId=next(),actionId=next(),submissionId=own.get(side).submissionId;m.actions.push({actionId,operationId:next(),actorId:profiles[side],gameId,gameVersion:++version,actionType:'confirm',priorSubmissionId:null,submission:null,confirmation:{confirmationId,submissionId}});confirmed.set(side,{confirmationId,actionId,actorId:profiles[side],submissionId,gameVersion:version});};
   if(amend&&index===0&&number===1){submit(0,participants[1]);confirm(0);submit(1,participants[0]);confirm(1);submit(0,participants[0],'amend');confirm(0);}
   else{submit(0,participants[0]);confirm(0);submit(1,participants[0]);confirm(1);}
   m.games.push({gameId,gameNumber:number,gameVersion:version,verifiedGameId:next(),verifiedByActionId:m.actions.at(-1).actionId,winnerParticipantId:participants[0],loserParticipantId:participants[1],sourceDigest:hash,submissions:[own.get(0),own.get(1)],confirmations:[confirmed.get(0),confirmed.get(1)]});
  }
  m.result={resultId:next(),version:1,winnerId:participants[0],loserId:participants[1],winsA:format.winsRequired,winsB:0,gameCount:m.games.length,sourceDigest:hash,gamesDigest:hash,completedByProfileId:m.actions.at(-1).actorId,operationId:m.actions.at(-1).operationId};frame.matches.push(m);
  const parentBindings=target.round===1?[null,null]:target.sides.map(s=>{const feed=display.rounds.flatMap(r=>r.matches).find(m=>m.matchId===s.fromMatch);return feed.status==='bye'?`bye:${q.resultVersionId}:${feed.matchId}`:`${feed.result.resultId}:1`;});
  input.results.push({matchId:path,sideAId:participants[0],sideBId:participants[1],parentBindings,bracketVersion:playoffDisplayVersion,winnerId:participants[0],resultId:m.result.resultId,sourceSeriesOrdinal:null,revision:1,qualificationVersionId:q.resultVersionId,sourceDigest:hash,provenance:'director-reviewed'});
 }
 return{scope,source:{status:'source_available',kind:'native-finance-recipient-source-v1',...scope,nativeFinanceSource,proposal,expectedHead,playoff:frame,sourceDigest:hash,proposalOnly:true,moneyMoved:false,payoutAuthorized:false,finalizationAuthorized:false}};
}
