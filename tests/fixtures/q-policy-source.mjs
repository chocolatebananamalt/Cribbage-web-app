export const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function sourceFixture(count=4,fee=501) {
 const policy=id(6),pool=id(5);
 return {tournamentId:id(1),canPublish:false,sourceDigest:'a'.repeat(64),blockers:[],
  policies:[{id:policy,poolVersionId:pool,version:1,method:'equal-paid-qualifiers-v1',disclosureReference:'TEST ONLY flyer version 1',publishedAt:'2026-10-28T00:00:00Z'}],
  qualification:{id:id(7),version:1,qualifiers:Array.from({length:Math.min(3,count)},(_,i)=>({participantId:id(100+i),qualificationRank:i+1,tied:false}))},
  membership:{tournamentId:id(1),eventId:id(2),eventName:'TEST ONLY Equal Q Main',canCorrect:true,started:true,supported:true,blockedReason:null,baseFeeMinor:3000,
   pools:[{poolVersionId:pool,slot:1,name:'TEST ONLY Q Pool',feeMinor:fee}],
   entries:Array.from({length:count},(_,i)=>({rosterEntryId:id(200+i),participantId:id(100+i),displayName:`Synthetic ${i+1}`,membershipVersion:1,membershipVersionId:id(300+i),allocationVersion:1,receiptId:id(400+i),receiptVersion:1,receivedMinor:3000+fee,obligationVersion:1,obligationMinor:3000+fee,allocationCurrent:true,baseAllocatedMinor:3000,reason:null,
    pools:[{poolVersionId:pool,prePlayElected:true,elected:true,consentReference:`Q policy ${policy}: TEST ONLY acknowledgment`,amountOwedMinor:fee,amountAllocatedMinor:fee,paidEntryEligible:true}]}))}};
}
