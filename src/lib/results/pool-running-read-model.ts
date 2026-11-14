import "server-only";
import {isUuid}from"../api/validation.ts";
import {isQOperatingWorkspaceV3}from"../api/q-operating-schedules.ts";
import {isSideGraduatedWorkspaceV2}from"../api/side-pool-graduated-v2.ts";
import {isPreliminaryEventStandings}from"./preliminary-standings-contract.ts";
import {isRunningPoolWorkspace,type RunningPoolRow,type RunningPoolWorkspace}from"./pool-running-summary.ts";
export type RunningPoolReadModels={activity:unknown;qOperating:unknown;side:unknown};
const id=(v:unknown):v is string=>isUuid(v)&&v===v.toLowerCase();
const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical).join(",")}]`:v&&typeof v==="object"?`{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>`${JSON.stringify(k)}:${canonical(x)}`).join(",")}}`:JSON.stringify(v)??"null";
const safe=(n:bigint)=>n<=BigInt(Number.MAX_SAFE_INTEGER)?Number(n):null;
function row(poolId:string,kind:"q"|"side",name:string,feeMinor:number,policyId:string|null):RunningPoolRow{return{poolId,kind,name,feeMinor,policyId,status:"available",issues:[],enteredCount:0,fullyPaidCount:0,eligiblePaidEntryCount:0,partiallyPaidCount:0,recordedPoolTotalMinor:0,eligiblePoolTotalMinor:0,knownRecordedSubtotalMinor:0,projectedIfAllEnteredPayMinor:0,heldRecordedMinor:0,unknownPaymentCount:0,heldOrExcludedReviewRequired:false};}
function unavailable(r:RunningPoolRow,code:string){return{...r,status:"unavailable" as const,issues:[code],enteredCount:null,fullyPaidCount:null,eligiblePaidEntryCount:null,partiallyPaidCount:null,recordedPoolTotalMinor:null,eligiblePoolTotalMinor:null,knownRecordedSubtotalMinor:null,projectedIfAllEnteredPayMinor:null,heldRecordedMinor:null,unknownPaymentCount:null};}
/** Private source adapter only. Counts/amounts are recorded observations, not bank balances or awards. */
export function projectRunningPoolReadModels(tid:string,eid:string,models:RunningPoolReadModels,observedAt:string,sourceCurrent=true):RunningPoolWorkspace|null{
  if(![tid,eid].every(id)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(observedAt)||!Number.isFinite(Date.parse(observedAt)))return null;
  const out:RunningPoolWorkspace={kind:"pool-running-workspace-v1",tournamentId:tid,eventId:eid,observedAt,sourceObservation:"provided-models-not-atomic",qState:"unavailable",sideState:"unavailable",pools:[],issues:[],currency:"USD",estimate:true,awardEstimateAvailable:false,publicAccessGranted:false,moneyMovedByThisRead:false};
  const a=models.activity;
  if(!sourceCurrent||!isPreliminaryEventStandings(a)||a.tournamentId!==tid||a.eventId!==eid){out.issues=[sourceCurrent?"participant_source_unavailable":"source_stale"];return out;}
  const activity=new Map(a.rows.map(p=>[p.participantId,p.participantStatus]));
  const active=(pid:string)=>["registered","checked_in"].includes(activity.get(pid)??"");
  const sameParticipants=(ids:string[])=>new Set(ids).size===ids.length&&ids.length===activity.size&&ids.every(pid=>activity.has(pid));
  const q=models.qOperating;
  if(isQOperatingWorkspaceV3(q,tid)&&q.membership&&q.membership.eventId===eid&&q.membership.supported&&q.membership.blockedReason===null){
    const w=q.membership;
    if(!sameParticipants(w.entries.map(e=>e.participantId))||new Set(w.entries.map(e=>e.rosterEntryId)).size!==w.entries.length
      ||w.entries.some(e=>e.membershipVersion===0&&e.pools.some(p=>p.elected))
      ||new Set(w.entries.flatMap(e=>e.receiptId?[e.receiptId]:[])).size!==w.entries.filter(e=>e.receiptId!==null).length){out.issues.push("q_identity_or_receipt_conflict");}
    else{
      out.qState=w.pools.length?"available":"no-recorded-pool";
      for(const p of w.pools){
        const policy=q.policies.find(pol=>pol.poolVersionId===p.poolVersionId),r=row(p.poolVersionId,"q",p.name,p.feeMinor,policy?.id??null);
        let recorded=BigInt(0),eligible=BigInt(0),held=BigInt(0),unknown=false;
        for(const e of w.entries){
          const choice=e.pools.find(x=>x.poolVersionId===p.poolVersionId)!;
          const inEvent=active(e.participantId),entered=inEvent&&choice.elected;
          if(entered)r.enteredCount!++;
          // False allocationCurrent zeros old pool amounts. Never derive a pool share from the whole receipt.
          const untouched=e.allocationVersion===0&&e.receiptVersion===0&&e.receiptId===null&&e.receivedMinor===0;
          if(!e.allocationCurrent&&!untouched){unknown=true;r.unknownPaymentCount!++;r.heldOrExcludedReviewRequired=true;continue;}
          const money=e.allocationCurrent?choice.amountAllocatedMinor:0;
          recorded+=BigInt(money);
          if(entered&&money===p.feeMinor)r.fullyPaidCount!++;
          if(entered&&money>0&&money<p.feeMinor)r.partiallyPaidCount!++;
          const prefix=policy?`Q policy ${policy.id}: `:"";
          const consent=!!policy&&choice.consentReference.startsWith(prefix)&&!!choice.consentReference.slice(prefix.length).trim();
          const qualifies=entered&&e.allocationCurrent&&choice.paidEntryEligible&&consent&&(!w.started||choice.prePlayElected);
          if(qualifies){r.eligiblePaidEntryCount!++;eligible+=BigInt(money);}else if(money>0){held+=BigInt(money);r.heldOrExcludedReviewRequired=true;}
          if(entered&&!consent)r.issues.push("policy_acknowledgment_pending");
        }
        r.knownRecordedSubtotalMinor=safe(recorded);r.recordedPoolTotalMinor=unknown?null:safe(recorded);r.eligiblePoolTotalMinor=unknown||!policy?null:safe(eligible);r.heldRecordedMinor=unknown?null:safe(held);
        r.projectedIfAllEnteredPayMinor=safe(BigInt(r.enteredCount!)*BigInt(p.feeMinor));
        if(unknown){r.fullyPaidCount=null;r.partiallyPaidCount=null;r.eligiblePaidEntryCount=null;r.issues.push("allocation_unknown_or_stale");}
        if(!policy){r.eligiblePaidEntryCount=null;r.issues.push("policy_eligibility_unavailable");}
        if(r.heldOrExcludedReviewRequired)r.issues.push("held_or_excluded_review_required");
        if(r.knownRecordedSubtotalMinor===null||r.projectedIfAllEnteredPayMinor===null)out.pools.push(unavailable(r,"amount_out_of_range"));
        else{r.issues=[...new Set(r.issues)];r.status=r.issues.length?"partial":"available";out.pools.push(r);}
      }
    }
  }else out.issues.push("q_scope_or_source_unavailable");
  const side=models.side;
  if(isSideGraduatedWorkspaceV2(side,tid)&&new Set(side.pools.map(p=>p.definitionId)).size===side.pools.length
    &&new Set(side.pools.flatMap(p=>p.policy?[p.policy.id]:[])).size===side.pools.filter(p=>p.policy!==null).length
    &&new Set(side.pools.flatMap(p=>p.entries.map(e=>e.electionId))).size===side.pools.reduce((n,p)=>n+p.entries.length,0)){
    const pools=side.pools.filter(p=>p.eventId===eid);out.sideState=pools.length?"available":"no-recorded-pool";
    for(const p of pools){
      const r=row(p.poolId,"side",p.name,p.feeMinor,p.policy?.id??null);
      if(p.feeMinor<=0){out.pools.push(unavailable(r,"unsupported_fee"));continue;}
      if(!sameParticipants(p.participants.map(x=>x.participantId))||p.entries.some(e=>!activity.has(e.participantId))){out.pools.push(unavailable(r,"participant_scope_conflict"));continue;}
      if(p.blockers.some(code=>!["funding_unresolved","disclosed_policy_required","unsupported_payout_domain"].includes(code))){out.pools.push(unavailable(r,"side_source_unavailable"));continue;}
      let recorded=BigInt(0),eligible=BigInt(0),held=BigInt(0);let inconsistent=false;
      for(const e of p.entries){
        const entered=active(e.participantId)&&e.elected;
        if(entered)r.enteredCount!++;
        recorded+=BigInt(e.receivedMinor);
        if(entered&&e.dueMinor===p.feeMinor&&e.receivedMinor===p.feeMinor){r.fullyPaidCount!++;eligible+=BigInt(e.receivedMinor);}
        else if(entered&&e.dueMinor===p.feeMinor&&e.receivedMinor>0&&e.receivedMinor<p.feeMinor)r.partiallyPaidCount!++;
        if(!entered&&e.receivedMinor>0){held+=BigInt(e.receivedMinor);r.heldOrExcludedReviewRequired=true;}
        if(e.elected&&(e.dueMinor!==p.feeMinor||e.receivedMinor>e.dueMinor))inconsistent=true;
      }
      r.knownRecordedSubtotalMinor=safe(recorded);r.recordedPoolTotalMinor=safe(recorded);r.heldRecordedMinor=safe(held);r.projectedIfAllEnteredPayMinor=safe(BigInt(r.enteredCount!)*BigInt(p.feeMinor));
      if(inconsistent){out.pools.push(unavailable(r,"side_amount_source_conflict"));continue;}
      const derivedFundingUnresolved=p.entries.some(e=>e.elected?(e.dueMinor!==p.feeMinor||e.receivedMinor!==p.feeMinor||!active(e.participantId)):e.receivedMinor!==0);
      const eligibilityKnown=p.policy!==null&&!p.blockers.includes("funding_unresolved")&&!derivedFundingUnresolved;
      r.eligiblePaidEntryCount=eligibilityKnown?r.fullyPaidCount:null;r.eligiblePoolTotalMinor=eligibilityKnown?safe(eligible):null;
      if(!eligibilityKnown)r.issues.push("funding_eligibility_review_required");
      if(r.heldOrExcludedReviewRequired)r.issues.push("held_or_excluded_review_required");
      if(r.recordedPoolTotalMinor===null||r.heldRecordedMinor===null||r.projectedIfAllEnteredPayMinor===null)out.pools.push(unavailable(r,"amount_out_of_range"));
      else{r.status=r.issues.length?"partial":"available";out.pools.push(r);}
    }
  }else out.issues.push("side_source_unavailable");
  return isRunningPoolWorkspace(out)?out:null;
}

type Access={actorId:string;roles:string[]};
export function createRunningPoolReader(deps:{access:(tid:string)=>Promise<Access|null>;models:(actor:string,tid:string,eid:string)=>Promise<RunningPoolReadModels>;now:()=>string}){
  return async(tid:string,eid:string):Promise<RunningPoolWorkspace|null>=>{
    if(![tid,eid].every(id))return null;
    const allowed=(a:Access|null):a is Access=>!!a&&id(a.actorId)&&Array.isArray(a.roles)&&a.roles.some(r=>["director","co_director"].includes(r));
    try{
      const firstAccess=await deps.access(tid);if(!allowed(firstAccess))return null;
      const first=structuredClone(await deps.models(firstAccess.actorId,tid,eid)),fingerprint=canonical(first);
      const mid=await deps.access(tid);if(!allowed(mid)||mid.actorId!==firstAccess.actorId)return null;
      const second=structuredClone(await deps.models(firstAccess.actorId,tid,eid));
      const last=await deps.access(tid);if(!allowed(last)||last.actorId!==firstAccess.actorId)return null;
      const same=fingerprint===canonical(second),out=projectRunningPoolReadModels(tid,eid,second,deps.now(),same);
      return out?{...out,sourceObservation:same?"matching-double-read-not-atomic":"observed-source-drift"}:null;
    }catch{return null;}
  };
}
