// Local planning only: never an authorization or evidence writer.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const requireValue=(ok,message)=>{if(!ok)throw Error(message);};
export function planPaperReviewCoverage(packet,officials){
 requireValue(packet?.kind==='fictional-18-physical-print-data-v1'&&packet.fictionalOnly===true&&packet.cards?.length===18,'validated_fictional_packet_required');
 const cards=new Map(packet.cards.map(c=>[c.tournamentId,c]));requireValue(cards.size===18,'duplicate_player_id');
 requireValue(Array.isArray(officials)&&officials.length<=30,'invalid_officials');
 const seen=new Set(),playing=new Set();
 for(const o of officials){requireValue(typeof o.key==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(o.key)&&!seen.has(o.key),'duplicate_or_invalid_person_key');seen.add(o.key);requireValue(typeof o.capture==='boolean'&&typeof o.review==='boolean','explicit_planning_capabilities_required');requireValue(o.playerId===null||cards.get(o.playerId)?.mode==='digital','official_player_must_be_digital_or_explicit_nonplayer');if(o.playerId!==null){requireValue(!playing.has(o.playerId),'same_player_multiple_official_identities');playing.add(o.playerId);}}
 const games=new Map();
 for(const card of cards.values()){
  requireValue(['paper','digital'].includes(card.mode)&&card.rows?.length===12,'invalid_card');
  const rounds=new Set();
  for(const row of card.rows){requireValue(typeof row.gameId==='string'&&row.gameId.length>0&&Number.isInteger(row.gameNumber)&&row.gameNumber>=1&&row.gameNumber<=12&&!rounds.has(row.gameNumber),'invalid_game_or_round');rounds.add(row.gameNumber);const peer=cards.get(row.opponentTournamentId);requireValue(peer&&peer!==card,'invalid_opponent');const reverse=peer.rows.find(r=>r.gameId===row.gameId);requireValue(reverse&&reverse.opponentTournamentId===card.tournamentId&&reverse.gameNumber===row.gameNumber&&reverse.currentSeat===row.opponentCurrentSeat&&reverse.opponentCurrentSeat===row.currentSeat,'nonreciprocal_assignment');let game=games.get(row.gameId);if(!game){game={gameId:row.gameId,round:row.gameNumber,playerIds:[card.tournamentId,row.opponentTournamentId].sort(),paper:card.mode==='paper'||peer.mode==='paper',seen:new Set()};games.set(row.gameId,game);}requireValue(game.round===row.gameNumber&&game.playerIds.includes(card.tournamentId)&&!game.seen.has(card.tournamentId),'game_collision');game.seen.add(card.tournamentId);}
 }
 requireValue(games.size===108&&[...games.values()].every(g=>g.seen.size===2),'incomplete_schedule');
 const rows=[...games.values()].filter(g=>g.paper).map(g=>{
  const available=officials.filter(o=>o.playerId===null||!g.playerIds.includes(o.playerId));
  const candidates=[];for(const capture of available.filter(o=>o.capture))for(const review of available.filter(o=>o.review))if(capture.key!==review.key)candidates.push({capture:capture.key,review:review.key});
  return{gameId:g.gameId,round:g.round,playerIds:g.playerIds,pairOptions:candidates,covered:candidates.length>0};
 }).sort((a,b)=>a.round-b.round||a.gameId.localeCompare(b.gameId));
 return{kind:'paper-review-staffing-plan-v1',planningOnly:true,authorizationVerified:false,identityVerified:false,permissionsGranted:false,simultaneousCapacityVerified:false,sourceScheduleHash:createHash('sha256').update(JSON.stringify(packet)).digest('hex'),paperGames:rows.length,coveredGames:rows.filter(r=>r.covered).length,uncoveredGames:rows.filter(r=>!r.covered).length,rows,warning:'Proposed people and capabilities only. Actual identity, accepted roles, current access and nonself checks must be verified by the server. Pair options are alternatives, not simultaneous staffing assignments.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [packetFile,officialFile]=process.argv.slice(2);requireValue(process.argv.length===4,'usage: node scripts/paper-review-staffing-plan.mjs PACKET_JSON PROPOSED_OFFICIALS_JSON');console.log(JSON.stringify(planPaperReviewCoverage(JSON.parse(fs.readFileSync(packetFile)),JSON.parse(fs.readFileSync(officialFile))),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
}