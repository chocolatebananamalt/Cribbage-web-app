// Fabricated read DTOs only. No SQL, provider session, record or authority.
import {recipientCase}from'./final-recipient-fixtures.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function mainFourBoundCase(champion=1,resultVersion=1){
 const c=recipientCase('main-v3'),m=c.playoffModels,p=m.playoff,q=m.qualification;
 const pairs=champion===1?[[1,4],[2,3],[1,2]]:[[4,1],[3,2],[4,3]];
 const series=pairs.map(([w,l])=>({winnerId:id(w),loserId:id(l),evidenceNote:'PRIVATE director evidence'}));
 const final=series[2];
 const outcomes=p.qualifiers.map((player,i)=>{
  const wins=series.filter(s=>s.winnerId===player.participantId).length,won=player.participantId===final.winnerId,runner=player.participantId===final.loserId;
  const qualifyingMrp=i<2?5*(player.gamePoints-13):5,playoffMrp=7*(wins+1)*(wins+2)/2;
  return{participantId:player.participantId,playedMatchWins:wins,byeWins:0,eliminatedInRound:won?null:runner?2:1,champion:won,bandStart:won?1:runner?2:3,bandEnd:won?1:runner?2:4,qualifyingMrp,playoffMrp,totalMrp:qualifyingMrp+playoffMrp};
 });
 p.currentVersion=resultVersion;p.result={resultId:id(700+resultVersion),version:resultVersion,series,outcomes,
  bracketSourceVersion:'acc-rulebook-2025-effective-2025-08-01',mrpSourceVersion:'acc-published-mrp-2016-08-01',recordedAt:'2026-11-05T00:00:00Z'};
 m.mainFourBinding={kind:'main-four-playoff-binding-v1',status:'source_available',tournamentId:c.scope.tournamentId,eventId:c.scope.eventId,
  qualificationHead:{resultVersionId:q.resultVersionId,version:q.version},
  resultHead:{resultId:p.result.resultId,version:resultVersion,qualificationResultVersionId:q.resultVersionId},
  receiptBinding:{receiptId:id(750+resultVersion),requestHash:'d'.repeat(64),accepted:true,auditMatched:true},
  workspace:structuredClone(p),readOnly:true,publicAccessGranted:false,independentPlayEstablished:false,sourceDigest:'c'.repeat(64)};
 return c;
}
