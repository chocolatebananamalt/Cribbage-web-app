import {deriveFiveQualifierPlayoff}from'../../src/lib/results/five-qualifier-playoff.ts';
export const id=n=>`b2510000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const actor=id(1),tid=id(2),eid=id(3),digest='a'.repeat(64),qid=id(4);
export const qualifiers=Array.from({length:5},(_,i)=>({participantId:id(10+i),displayName:`TEST Five ${i+1}`,qualificationRank:i+1,gamePoints:24-i*2,byeWins:i<3?1:0}));
export const series=[{winnerId:id(13),loserId:id(14),evidenceNote:'TEST ONLY round1'},{winnerId:id(10),loserId:id(13),evidenceNote:'TEST ONLY semifinal1'},{winnerId:id(11),loserId:id(12),evidenceNote:'TEST ONLY semifinal2'},{winnerId:id(10),loserId:id(11),evidenceNote:'TEST ONLY final'}];
export const request={qualificationResultVersionId:qid,expectedVersion:0,sourceDigest:digest,series,reason:'TEST ONLY synthetic evidence review',reviewed:true};
export const workspace={tournamentId:tid,eventId:eid,qualificationResultVersionId:qid,sourceDigest:digest,bracketKind:'five_qualifier_three_byes_v4',currentVersion:0,canRecord:true,blocker:null,qualifiers,result:null,automaticPayment:false};
export const receipt={status:'playoff_outcomes_recorded_v4',tournamentId:tid,eventId:eid,resultId:id(20),version:1,sourceDigest:digest,recordedAt:'2026-10-29T23:00:00.000Z'};
export const recorded={...workspace,currentVersion:1,result:{resultId:id(20),version:1,qualificationResultVersionId:qid,sourceDigest:digest,current:true,series,outcomes:deriveFiveQualifierPlayoff(qualifiers.map(({participantId,qualificationRank,gamePoints})=>({participantId,qualificationRank,gamePoints})),series),request,bracketSourceVersion:'acc-rulebook-2025-effective-2025-08-01',mrpSourceVersion:'acc-published-mrp-2016-08-01',recordedAt:receipt.recordedAt}};
