import{isNativeMixedReviewContextV1,type NativeMixedReviewContextV1}from'../finance/native-mixed-review-read-v1.ts';
import{readPracticeQualificationFinanceReviewV1}from'../finance/native-mixed-qualification-review-v1.ts';
import{readNativeMixedPoolPreparationV1,readNativeMixedPoolWorkspaceV1}from'../finance/native-mixed-pool-preparation-view-v1.ts';
import{projectNativeMixedPoolResultsV1}from'./native-mixed-pool-results-v1.ts';
import{playoffCorrectionPlainV1 as plain,playoffCorrectionExactV1 as exact,playoffCorrectionUuidV1 as uuid,playoffCorrectionDigestV1 as hash,playoffCorrectionIntegerV1 as int}from'../playoffs/native-mixed-playoff-reopen-v1.ts';

export type NativeMixedFinalPoolAwardsV1={status:'unavailable';pools:[]}|{status:'available';pools:{poolId:string;kind:'q'|'side';slot:number;label:string;paidCount:number;fundMinor:number;roundingUnitMinor:100|500|1000;status:'unpaid_simulated'|'empty_no_obligations';recipients:{name:string;tournamentIdNumber:string;amountMinor:number}[]}[];simulationOnly:true;moneyMoved:false;payoutAuthorized:false};
const unavailable=():NativeMixedFinalPoolAwardsV1=>({status:'unavailable',pools:[]});
/** Strict current-read intake and cross-section identity join, NOT independent
 * database proof. Only the dedicated authenticated SQL reader may supply raw.
 * Historical receipts/calculator outputs are never substitutes. No new math:
 * sum/unit and saved membership consistency checks only. */
export function projectNativeMixedPoolFinalResultsV1(raw:unknown,preparation:unknown,workspace:unknown,qualification:unknown,context:NativeMixedReviewContextV1):NativeMixedFinalPoolAwardsV1{try{
 if(!isNativeMixedReviewContextV1(context)||!plain(raw)||!plain(qualification)||new TextEncoder().encode(JSON.stringify(raw)).byteLength>131072||!exact(raw,['kind','status','actorId','sessionId','tournamentId','eventId','startId','startSourceDigest','reviewSourceDigest','fundingSourceDigest','journalDigest','finalRecordId','finalRecordDigest','sealId','sealDigest','pools','currentSourceVerified','writeAuthorized','simulationOnly','actualMoneyReceived','ordinaryLiability','moneyMoved','payoutAuthorized','mrpAwarded','refunds']))return unavailable();
 const s=context.scope,r=raw;
 if(r.kind!=='native-mixed-pool-final-results-v1'||r.status!=='source_available'||r.actorId!==s.actorId||r.sessionId!==context.sessionId||r.tournamentId!==s.tournamentId||r.eventId!==s.eventId||r.currentSourceVerified!==true||r.simulationOnly!==true||['writeAuthorized','actualMoneyReceived','ordinaryLiability','moneyMoved','payoutAuthorized','mrpAwarded'].some(k=>r[k]!==false)||!Array.isArray(r.refunds)||r.refunds.length||![r.startId,r.finalRecordId,r.sealId].every(uuid)||r.finalRecordId===r.sealId||![r.startSourceDigest,r.reviewSourceDigest,r.fundingSourceDigest,r.journalDigest,r.finalRecordDigest,r.sealDigest].every(hash)||!Array.isArray(r.pools)||r.pools.length>8)return unavailable();
 const p=readNativeMixedPoolPreparationV1(preparation,s),w=readNativeMixedPoolWorkspaceV1(workspace,s),q=readPracticeQualificationFinanceReviewV1(qualification);
 if(!p||!w||!q||projectNativeMixedPoolResultsV1(p,w,s).status!=='available'||p.preStart||!w.membership.sealed||!w.membership.seal||q.tournamentId!==s.tournamentId||q.eventId!==s.eventId||!q.qualificationReady||q.tieReviewRequired||r.startId!==q.startId||r.startSourceDigest!==q.startSourceDigest||r.reviewSourceDigest!==q.sourceDigest||r.fundingSourceDigest!==q.fundingSourceDigest||r.fundingSourceDigest!==p.fundingSourceDigest||r.fundingSourceDigest!==w.fundingSourceDigest||r.journalDigest!==p.journalDigest||r.journalDigest!==w.journalDigest||r.sealId!==w.membership.seal.id||r.sealDigest!==w.membership.seal.digest||r.pools.length!==w.policies.length||!r.pools.length)return unavailable();
 const roster=[...p.digitalParticipants,...p.fictionalPaperParticipants],seen=new Set<string>(),rows:Extract<NativeMixedFinalPoolAwardsV1,{status:'available'}>['pools']=[];
 for(const pool of r.pools){
  if(!exact(pool,['policyId','policyDigest','poolId','kind','method','feeMinor','ratio','roundingUnitMinor','paidCount','fundMinor','status','obligations'])||!uuid(pool.policyId)||!uuid(pool.poolId)||!hash(pool.policyDigest)||seen.has(pool.policyId)||!int(pool.paidCount,0,18)||!int(pool.fundMinor,0,1800000000)||!Array.isArray(pool.obligations)||pool.obligations.length>18)return unavailable();seen.add(pool.policyId);
  const policy=w.policies.find(x=>x.policyId===pool.policyId&&x.poolId===pool.poolId&&x.policyDigest===pool.policyDigest),definition=p.availablePools.find(x=>x.poolId===pool.poolId);
  if(!policy||!definition||!definition.supported||pool.kind!==policy.amountPolicy.kind||pool.method!==policy.amountPolicy.method||pool.feeMinor!==policy.amountPolicy.feeMinor||pool.ratio!==policy.amountPolicy.ratio||pool.roundingUnitMinor!==policy.amountPolicy.roundingUnitMinor||pool.paidCount!==policy.simulatedPaidCount||pool.fundMinor!==policy.simulatedFundMinor)return unavailable();
  const recipients:Extract<NativeMixedFinalPoolAwardsV1,{status:'available'}>['pools'][number]['recipients']=[],ids=new Set<string>();let total=0;
  for(const ob of pool.obligations){
   if(!exact(ob,['participantId','amountMinor'])||!uuid(ob.participantId)||ids.has(ob.participantId)||!int(ob.amountMinor,1,1800000000)||(ob.amountMinor as number)%policy.amountPolicy.roundingUnitMinor!==0||!w.elections.some(e=>e.policyId===pool.policyId&&e.participantId===ob.participantId&&e.elected&&e.simulatedFunded))return unavailable();
   const card=q.cards.find(c=>c.participantId===ob.participantId),person=roster.find(x=>x.participantId===ob.participantId&&x.fixedIdStatus==='published'&&x.fixedTournamentId===card?.fixedTournamentId);
   if(!person||!person.fixedTournamentId||!person.displayName.trim()||person.displayName!==person.displayName.trim())return unavailable();
   ids.add(ob.participantId);total+=ob.amountMinor as number;if(!Number.isSafeInteger(total))return unavailable();recipients.push({name:person.displayName,tournamentIdNumber:person.fixedTournamentId,amountMinor:ob.amountMinor as number});
  }
  if(pool.paidCount===0?(pool.status!=='empty_no_obligations'||pool.fundMinor!==0||recipients.length!==0):(pool.status!=='UNPAID_SIMULATED'||pool.fundMinor===0||recipients.length===0||recipients.length>pool.paidCount||total!==pool.fundMinor))return unavailable();
  rows.push({poolId:pool.poolId,kind:pool.kind as 'q'|'side',slot:definition.slot,label:definition.label,paidCount:pool.paidCount as number,fundMinor:pool.fundMinor as number,roundingUnitMinor:policy.amountPolicy.roundingUnitMinor,status:pool.paidCount===0?'empty_no_obligations':'unpaid_simulated',recipients});
 }
 rows.sort((a,b)=>p.availablePools.findIndex(x=>x.poolId===a.poolId)-p.availablePools.findIndex(x=>x.poolId===b.poolId));
 return{status:'available',pools:rows,simulationOnly:true,moneyMoved:false,payoutAuthorized:false};
 }catch{return unavailable();}}
