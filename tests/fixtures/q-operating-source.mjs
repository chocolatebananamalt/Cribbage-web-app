import {sourceFixture,id} from './q-policy-source.mjs';
export {id};
export function operatingSource(count=4,fee=500,method='equal-paid-playoff-qualifiers-v2'){
 const old=sourceFixture(count,fee);
 return {tournamentId:old.tournamentId,membership:old.membership,canPublish:false,
 policies:[{id:id(6),poolVersionId:id(5),method,ratio:method.startsWith('graduated')?6:null,scheduleId:method.startsWith('graduated')?'friend-q-p2-10-6-v1':null,disclosureReference:'TEST ONLY disclosed friend schedule',publishedAt:'2026-10-29T00:00:00Z'}],
 cards:old.membership.entries.map((e,i)=>({participantId:e.participantId,gamePoints:2*(count+1-i),gamesWon:count+1-i,plusPoints:10*(count+1-i),qualified:i<3,qualificationRank:i<3?i+1:null})),cuts:[],sourceDigest:'a'.repeat(64),blockers:[]};
}
