// Pure synthetic read-model examples, never inserted into a database or represented as live records.
export const id=n=>`a8220000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const tid=id(900),eid=id(901),stamp='2026-11-04T00:00:00.000Z';
export function poolReadExample(kind='q'){
 const rows=Array.from({length:3},(_,i)=>({participantId:id(i+1),displayName:`PRIVATE PLAYER ${i+1}`,participantStatus:'registered',verifiedGames:0,gamePoints:0,gamesWon:0,plusPoints:0,minusPoints:0,netSpreadPoints:0,numericRank:1,tied:true}));
 const activity={tournamentId:tid,eventId:eid,tournamentName:'TEST ONLY',eventName:'Main',status:'preliminary',configuredGameCount:12,schedulePublished:false,scheduledMatchCount:0,persistedMatchCount:0,resolvedMatchCount:0,scheduledScorecardsComplete:false,rows};
 const policy=id(200),pool=id(100);
 const entries=rows.map((r,i)=>({rosterEntryId:id(10+i),participantId:r.participantId,displayName:r.displayName,membershipVersion:1,membershipVersionId:id(20+i),pools:[{poolVersionId:pool,prePlayElected:true,elected:true,consentReference:`Q policy ${policy}: PRIVATE CONSENT`,amountOwedMinor:1000,amountAllocatedMinor:i===0?1000:0,paidEntryEligible:i===0}],allocationVersion:i===0?1:0,receiptId:i===0?id(30):null,receiptVersion:i===0?1:0,receivedMinor:i===0?6000:0,obligationVersion:1,obligationMinor:6000,allocationCurrent:i===0,baseAllocatedMinor:i===0?5000:0,reason:null}));
 const membership={tournamentId:tid,eventId:eid,eventName:'Main',canCorrect:true,started:false,supported:true,blockedReason:null,baseFeeMinor:5000,pools:[{poolVersionId:pool,slot:1,name:'Q-Pool $10',feeMinor:1000}],entries};
 const qOperating={tournamentId:tid,membership,canPublish:false,policies:[{id:policy,poolVersionId:pool,method:'equal-paid-playoff-qualifiers-v2',ratio:null,scheduleId:null,disclosureReference:'PRIVATE DISCLOSURE',publishedAt:stamp}],cards:[],cuts:[],sourceDigest:'a'.repeat(64),blockers:['qualification_required']};
 const side={tournamentId:tid,pools:[],moneyMoved:false,recipientSelection:'not_assigned'};
 if(kind==='side'){
  membership.supported=false;membership.blockedReason='Legacy Q scope unavailable with this Side Pool configuration';
  activity.rows[2].participantStatus='withdrawn';
  side.pools=[{definitionId:id(300),eventId:eid,poolId:id(301),name:'Side Pool $10',feeMinor:1000,policy:{id:id(302),method:'graduated-acc-weighted-largest-remainder-5usd-v2',ratio:4,disclosureReference:'PRIVATE DISCLOSURE',publishedAt:stamp},paidCount:2,entries:rows.map((r,i)=>({participantId:r.participantId,electionId:id(310+i),version:1,elected:true,dueMinor:1000,receivedMinor:i===1?500:1000})),sourceDigest:'b'.repeat(64),blockers:['funding_unresolved'],calculation:null,history:[],participants:rows.map(r=>({participantId:r.participantId,displayName:r.displayName})),started:false,canPublish:false,moneyMoved:false}];
 }
 return{activity,qOperating,side};
}
