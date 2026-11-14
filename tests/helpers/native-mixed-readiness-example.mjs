/** Pure in-memory supplied DTO example; no database fixture or actual consent. */
export const mixedExampleId=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function nativeMixedReadinessExample(){
 const id=mixedExampleId;
 const roster=Array.from({length:18},(_,i)=>({rosterEntryId:id(100+i),participantId:id(200+i),mode:i<6?'digital':'paper',profileId:i<6?id(300+i):null}));
 const scope={scopeId:id(4),version:1,admissionIntentId:id(5),fundingScopeId:id(6),fundingSourceDigest:'a'.repeat(64),operationalBindingId:id(7),participantCount:18,digitalCount:6,paperCount:12,sourceDigest:'b'.repeat(64)};
 const digitalConsents=roster.slice(0,6).map((r,i)=>({consentId:id(400+i),version:1,priorConsentId:null,decision:'granted',rosterEntryId:r.rosterEntryId,participantId:r.participantId,profileId:r.profileId,operationId:id(500+i),statement:'test-only-simulation-participation-v1',sourceDigest:'c'.repeat(64)}));
 const expected={actorId:id(1),sealId:id(8),tournamentId:id(2),eventId:id(3),scope,roster,
  latestConsents:digitalConsents.map(c=>({rosterEntryId:c.rosterEntryId,consentId:c.consentId,version:c.version,decision:c.decision})),
  officials:[{profileId:id(1),roles:['director']},{profileId:id(300),roles:['cross_checker']}]};
 const value={status:'source_available',kind:'native-mixed-attendance-source-v1',actorId:id(1),sealId:id(8),tournamentId:id(2),eventId:id(3),scope:structuredClone(scope),digitalConsents,
  paperDeclaration:{declarationId:id(600),preparerId:id(1),entries:roster.slice(6).map(r=>({...r,fictional:true})),operationId:id(601),sourceDigest:'d'.repeat(64),fictional:true},
  paperReview:{reviewId:id(602),reviewerId:id(300),declarationId:id(600),operationId:id(603),sourceDigest:'e'.repeat(64),decision:'accepted-synthetic-only'},sourceDigest:'f'.repeat(64),
  ordinaryAttendanceUsed:false,paymentVerified:false,humanPresenceVerified:false,physicalPresenceVerified:false,actualMoneyReceived:false,moneyMoved:false,refundAuthorized:false,payoutAuthorized:false,finalizationAuthorized:false,normalDrawAuthorized:false,normalStartAuthorized:false};
 return{value,expected};
}
