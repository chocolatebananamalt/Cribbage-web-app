import assert from "node:assert/strict";
import test from "node:test";
import { previewQualification } from "../src/lib/qualification.ts";
import { isQualificationTieRequest,isQualificationTieWorkspace,isQualificationTieOutcome,qualificationTieOutcomeMatches,isQualificationTieReconciliationRequest } from "../src/lib/api/qualification-ties.ts";
export const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const candidate=(n,points)=>({id:id(n),displayName:`Player${n}`,gamePoints:points,gamesWon:3,netSpreadPoints:10,positiveSpreadPoints:50});
const pair=[id(2),id(3)],digest="a".repeat(64);
const req={expectedSourceFingerprint:digest,participantIds:pair,winnerId:id(3),method:"one_game_playoff",reason:"TEST ONLY actual playoff winner",evidenceReference:"TEST ONLY separate game record"};
const resolution={id:id(20),winnerId:id(3),method:"one_game_playoff",reason:req.reason,evidenceReference:req.evidenceReference,recordedAt:"2026-10-29T10:00:00Z",recordedBy:id(90)};
const source={tournamentId:id(80),eventId:id(81),sourceFingerprint:digest,finalized:false,blockers:[],groups:[{candidateIds:pair,numericRank:2,affectsQualificationCut:true,method:"one_game_playoff",headToHeadGameId:null,headToHeadWinnerId:null,resolution:null}]};
test("cutoff winner changes ordinal selection but preserves tied numeric totals",()=>{
 const rows=[candidate(1,12),candidate(2,10),candidate(3,10),...Array.from({length:5},(_,i)=>candidate(i+4,8-i))],before=structuredClone(rows);
 const unresolved=previewQualification(rows);assert.equal(unresolved.finalizable,false);
 const result=previewQualification(rows,[{candidateIds:pair,winnerId:id(3)}]);
 assert.equal(result.finalizable,true);assert.deepEqual(result.ranked.slice(0,3).map(x=>x.id),[id(1),id(3),id(2)]);
 assert.deepEqual(result.ranked.slice(1,3).map(x=>x.numericRank),[2,2]);assert.equal(result.ranked[1].qualificationStatus,"qualified");assert.equal(result.ranked[2].qualificationStatus,"not_qualified");assert.deepEqual(rows,before);
});
test("seed-only tie resolves without arbitrary ID ranking",()=>{
 const rows=[candidate(1,12),candidate(2,12),...Array.from({length:14},(_,i)=>candidate(i+3,11-i))];
 // Keep metrics valid: the pure input requires nonnegative points.
 rows.forEach(r=>r.gamePoints=Math.max(0,r.gamePoints));rows.splice(13);
 const unique=rows.slice(0,12);
 const result=previewQualification(unique,[{candidateIds:[id(1),id(2)],winnerId:id(2)}]);
 assert.equal(result.ranked[0].id,id(2));assert.equal(result.ranked[1].id,id(1));assert.equal(result.ranked[0].gamePoints,12);
});
test("unknown, duplicate, unrelated and subset-of-multiway resolutions reject",()=>{
 const rows=[candidate(1,10),candidate(2,10),candidate(3,10),candidate(4,5)];
 for(const r of [[{candidateIds:[id(1),id(2)],winnerId:id(1)}],[{candidateIds:pair,winnerId:id(99)}],[{candidateIds:[id(1),id(4)],winnerId:id(1)}]])assert.throws(()=>previewQualification(rows,r));
 assert.throws(()=>previewQualification([candidate(1,10),candidate(2,10)],[{candidateIds:[id(1),id(2)],winnerId:id(1)},{candidateIds:[id(2),id(1)],winnerId:id(2)}]));
});
test("exact request validation never accepts client head-to-head evidence assertions",()=>{
 assert.ok(isQualificationTieRequest(req));
 for(const change of [{method:"cut"},{participantIds:[id(2),id(2)]},{winnerId:id(4)},{expectedSourceFingerprint:"stale"},{reason:""},{evidenceReference:"x\nsecret"},{headToHeadGameId:id(99)}])assert.equal(isQualificationTieRequest({...req,...change}),false);
});
test("workspace validation binds exact pair, derived winner and source",()=>{
 assert.ok(isQualificationTieWorkspace(source,id(80),id(81)));
 const h={...source,groups:[{...source.groups[0],method:"head_to_head",headToHeadGameId:id(40),headToHeadWinnerId:id(3),resolution:{...resolution,method:"head_to_head"}}]};
 assert.ok(isQualificationTieWorkspace(h,id(80),id(81)));
 assert.equal(isQualificationTieWorkspace({...h,groups:[{...h.groups[0],resolution:{...h.groups[0].resolution,winnerId:id(2)}}]},id(80),id(81)),false);
 assert.equal(isQualificationTieWorkspace(source,id(80),id(82)),false);
 assert.equal(isQualificationTieWorkspace({...source,groups:[source.groups[0],source.groups[0]]},id(80),id(81)),false);
});
test("reconciliation cannot clear a different same-source request",()=>{
 const saved={status:"qualification_tie_recorded",eventId:id(81),resolutionId:id(20),sourceFingerprint:digest,participantIds:pair,winnerId:id(3),method:"one_game_playoff"};
 assert.ok(isQualificationTieOutcome(saved,id(81)));assert.ok(qualificationTieOutcomeMatches(saved,req));
 assert.equal(qualificationTieOutcomeMatches({...saved,winnerId:id(2)},req),false);
 assert.equal(qualificationTieOutcomeMatches({...saved,participantIds:[id(4),id(3)]},req),false);
 assert.equal(qualificationTieOutcomeMatches({...saved,method:"head_to_head"},req),false);
 assert.equal(isQualificationTieOutcome({...saved,eventId:id(82)},id(81)),false);
});
test("receipt reconciliation requires the full retained request, including immutable evidence text",()=>{
 assert.ok(isQualificationTieReconciliationRequest({operationId:id(30),request:req}));
 assert.equal(isQualificationTieReconciliationRequest({operationId:id(30)}),false);
 assert.equal(isQualificationTieReconciliationRequest({operationId:id(30),request:{...req,evidenceReference:""}}),false);
 assert.equal(isQualificationTieReconciliationRequest({operationId:id(30),request:req,actorId:id(90)}),false);
});
