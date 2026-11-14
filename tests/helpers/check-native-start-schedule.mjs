// Independent graph check over fictional SQL source; no app arithmetic helpers.
import fs from'node:fs';import assert from'node:assert/strict';
const folder=process.argv[2],source=JSON.parse(fs.readFileSync(folder+'/scoring-results.json')).scheduleSource;
const ids=new Set(source.fixedAssignments.map(p=>p.participantId)),pairs=new Set(),opponents=new Map([...ids].map(id=>[id,new Set()]));
assert.equal(ids.size,18);assert.equal(source.canonicalGames.length,108);
for(let round=1;round<=12;round++){const seen=new Set(),games=source.canonicalGames.filter(g=>g.round===round);assert.equal(games.length,9);for(const g of games){const a=g.sideAParticipantId,b=g.sideBParticipantId;assert(ids.has(a)&&ids.has(b)&&a!==b);assert(!seen.has(a)&&!seen.has(b));seen.add(a);seen.add(b);const pair=[a,b].sort().join('|');assert(!pairs.has(pair));pairs.add(pair);opponents.get(a).add(b);opponents.get(b).add(a);}assert.equal(seen.size,18);}
for(const set of opponents.values())assert.equal(set.size,12);
const result={players:18,scheduledMatches:108,rounds:12,uniquePairs:pairs.size,opponentsEach:12,sitOuts:0,scoringFull108Claimed:false,physicalMovementVerified:false};fs.writeFileSync(folder+'/independent-schedule-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
