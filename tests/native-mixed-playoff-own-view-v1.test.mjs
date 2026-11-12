import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{readNativeMixedPlayoffOwnV1 as read,projectNativeMixedPlayoffOwnV1 as project,buildNativeMixedPlayoffOwnCommandV1 as command}from'../src/lib/playoffs/native-mixed-playoff-own-view-v1.ts';
const id=n=>`aaaa0000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash='a'.repeat(64),scope={tournamentId:id(1),eventId:id(2),participantId:id(3),tournamentIdNumber:'A-13'},opponent=id(4);
function fixture(mode='digital'){
 const own={participantId:scope.participantId,tournamentIdNumber:scope.tournamentIdNumber};
 return{status:'simulated_playoff_own_available',contextId:id(5),sourceDigest:hash,own,matches:[{slot:1,matchDigest:hash,format:{winsRequired:2,maximumGames:3},own:structuredClone(own),opponent:{participantId:opponent,tournamentIdNumber:'A-4',mode,displayName:'Fictional Opponent'},complete:false,winnerParticipantId:null,nextGame:{gameNumber:1,expectedRevision:0,expectedHistoryDigest:hash},games:[],ownWins:0,opponentWins:0}],complete:false,eliminated:false,awaitingOpponent:false,ownFinishingGroup:null,tournamentId:scope.tournamentId,eventId:scope.eventId,simulationOnly:true,ordinaryQualificationRecorded:false,mrpAwarded:false,moneyMoved:false};
}
const sub=(n,p=scope.participantId,winner=scope.participantId)=>({id:id(n),type:'digital-submit',participantId:p,winnerParticipantId:winner});
function evidence(s,entries){const m=s.matches[0];m.games=[{gameNumber:1,complete:false,winnerParticipantId:scope.participantId,revision:entries.length,historyDigest:hash,counterEvidenceAvailable:true,entries}];m.nextGame.expectedRevision=entries.length;return s;}
test('actual own DTO scope and CAS produce own winner request with no actor/provider/operation authority',()=>{
 const s=fixture();assert(read(s,scope));assert.equal(project(s,scope).phase,'entry');const c=command(s,scope,'opponent');assert.equal(c.data.entry.winnerParticipantId,opponent);assert.equal(c.data.entry.participantId,scope.participantId);assert.equal(c.data.contextId,s.contextId);assert.equal(c.data.expectedHistoryDigest,hash);assert.equal(c.data.expectedRevision,0);assert(!JSON.stringify(c).includes('actor'));assert(!Object.hasOwn(c,'operationId'));assert(!Object.hasOwn(c,'reason'));assert.equal(command(s,scope,'confirm'),null);
});
test('blind opponent-first metadata does not reveal or synthesize counterevidence',()=>{
 const s=fixture(),m=s.matches[0];m.games=[{gameNumber:1,complete:false,winnerParticipantId:null,revision:1,historyDigest:hash,counterEvidenceAvailable:false,entries:[]}];m.nextGame.expectedRevision=1;
 assert.equal(project(s,scope).phase,'entry');assert.equal(project(s,scope).game.entries.length,0);assert.equal(command(s,scope,'own').data.expectedRevision,1);
 for(const change of[g=>g.entries.push(sub(10,opponent)),g=>g.winnerParticipantId=opponent,g=>g.complete=true]){const x=structuredClone(s);change(x.matches[0].games[0]);assert.equal(read(x,scope),null);}
});
test('DD confirmation needs both matching entries and pins exact sorted evidence and own submission',()=>{
 const s=evidence(fixture(),[sub(11)]);assert.equal(project(s,scope).phase,'waiting-evidence');assert.equal(command(s,scope,'confirm'),null);
 evidence(s,[sub(11),sub(10,opponent)]);assert.equal(project(s,scope).phase,'confirm');const c=command(s,scope,'confirm');assert.equal(c.data.entry.submissionId,id(11));assert.deepEqual(c.data.entry.evidenceIds,[id(10),id(11)]);assert.equal(c.data.entry.statement,'simulation-own-playoff-confirmation-v1');assert.equal(command(s,scope,'own'),null);
 evidence(s,[sub(11),sub(10,opponent,opponent)]);assert.equal(project(s,scope).phase,'waiting-evidence');assert.equal(command(s,scope,'confirm'),null);
});
test('DP confirmation waits for exact independently reviewed fictional paper bundle',()=>{
 const c={id:id(20),type:'paper-capture',artifactId:id(21),artifactDigest:hash,claims:[{participantId:opponent,winnerParticipantId:scope.participantId}]},r={id:id(22),type:'paper-review',captureId:c.id,artifactId:c.artifactId,artifactDigest:hash,reenteredClaims:structuredClone(c.claims)};
 const s=evidence(fixture('paper'),[sub(11),c]);assert.equal(project(s,scope).phase,'waiting-evidence');evidence(s,[sub(11),c,r]);assert.equal(project(s,scope).phase,'confirm');assert.deepEqual(command(s,scope,'confirm').data.entry.evidenceIds,[id(11),id(20),id(22)]);
 for(const edit of[x=>x.captureId=id(99),x=>x.artifactDigest='b'.repeat(64),x=>x.reenteredClaims[0].winnerParticipantId=opponent]){const x=structuredClone(s);edit(x.matches[0].games[0].entries[2]);assert.equal(command(x,scope,'confirm'),null);}
});
test('own confirmation alone is waiting server verification, never a locally completed game',()=>{
 const s=evidence(fixture(),[sub(10),sub(11,opponent),{id:id(12),type:'digital-confirm',participantId:scope.participantId,submissionId:id(10),winnerParticipantId:scope.participantId,evidenceIds:[id(10),id(11)]}]);assert.equal(project(s,scope).phase,'waiting-verification');assert.equal(project(s,scope).game.complete,false);assert.equal(command(s,scope,'confirm'),null);
});
test('private/foreign/unknown/extra fields, wrong fixed ID, stale CAS and malformed formats fail closed',()=>{
 for(const edit of[s=>s.actorId=id(99),s=>s.tournamentId=id(99),s=>s.own.tournamentIdNumber='A-99',s=>s.matches[0].opponent.profileId=id(99),s=>s.matches[0].format.maximumGames=4,s=>s.matches[0].nextGame.gameNumber=2,s=>s.matches[0].games.push(null),s=>s.simulationOnly=false,s=>s.matches[0].ownWins=3]){const s=fixture();edit(s);assert.equal(read(s,scope),null);assert.equal(command(s,scope,'own'),null);}
 assert.equal(read({status:'blocked',code:'source_changed'},scope),null);
});
test('preparation/nonqualifier/waiting/finishing group states are not writable',()=>{
 for(const status of['awaiting_playoff_preparation','not_in_simulated_playoffs']){const s=fixture();for(const k of['contextId','sourceDigest','matches','complete','eliminated','awaitingOpponent','ownFinishingGroup'])delete s[k];s.status=status;assert.equal(project(s,scope).phase,status);assert.equal(command(s,scope,'own'),null);}
 const s=fixture();s.matches=[];s.awaitingOpponent=true;assert.equal(project(s,scope).phase,'awaiting-opponent');s.complete=true;s.awaitingOpponent=false;s.ownFinishingGroup={firstPlace:3,lastPlace:4};assert.equal(project(s,scope).phase,'complete');assert.equal(command(s,scope,'own'),null);
});
test('accessors, sparse arrays, cycles and duplicate evidence IDs are rejected without invoking getters',()=>{
 let called=false;const s=fixture();Object.defineProperty(s,'sourceDigest',{enumerable:true,get(){called=true;throw Error('forbidden');}});assert.equal(read(s,scope),null);assert.equal(called,false);
 const x=fixture();Object.defineProperty(x.matches,0,{enumerable:true,get(){called=true;throw Error('forbidden');}});assert.equal(read(x,scope),null);assert.equal(called,false);
 const sparse=fixture();delete sparse.matches[0];assert.equal(read(sparse,scope),null);const cyclic=fixture();cyclic.matches[0].games=cyclic.matches;assert.equal(read(cyclic,scope),null);
 assert.equal(read(evidence(fixture(),[sub(10),sub(10,opponent)]),scope),null);
});
test('screen remains unwired/defaultoffline; server state alone renders verification, with no seats or API/storage',()=>{
 const ui=fs.readFileSync('src/components/native-mixed-playoff-player-v1.tsx','utf8');assert.match(ui,/enabled!==true/);assert.match(ui,/online=false/);assert.match(ui,/Only refreshed server state can confirm/);assert.match(ui,/do not save pending entries/);assert.match(ui,/choice===next/);assert.match(ui,/latest\.current===lease/);
 assert.doesNotMatch(ui,/fetch\(|localStorage|indexedDB|supabase|tableSeat|currentSeat|makeOperationId|\.rpc\(/);assert.match(ui,/Provider access and durable recovery are not connected/);assert.match(ui,/busy\|\|!v\.state/);assert.doesNotMatch(ui,/if\(!checked\.state\)/);
});
test('explicit bounded depth rejects deeply nested input before touching a deeper getter',()=>{
 const s=fixture();let called=false;const nested={};s.extra=nested;let current=nested;for(let n=0;n<100;n++){current.child={};current=current.child;}
 Object.defineProperty(current,'value',{enumerable:true,get(){called=true;throw Error('Do not read');}});
 assert.equal(read(s,scope),null);assert.equal(called,false);assert.equal(command(s,scope,'own'),null);
 assert.match(fs.readFileSync('src/lib/playoffs/native-mixed-playoff-own-view-v1.ts','utf8'),/depth>64/);
});
