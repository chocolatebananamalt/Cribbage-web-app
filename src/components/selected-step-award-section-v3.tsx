'use client';
import{useMemo}from'react';
import{ModernPrizeJournalSectionV2}from'./modern-prize-journal-section-v2';
import{createIndexedFinanceDraftRetainedV1,type FinanceDraftRetainedPortV1}from'../lib/finance/event-finance-draft-retained-v1';
import{trackAppRecoveryWrite}from'../lib/recovery-write-coordinator';
import type{ModernPrizeScopeV2}from'../lib/finance/modern-prize-journal-contract-v2';
import type{ModernPrizePortV2}from'../lib/finance/modern-prize-journal-controller-v2';
/** Reuse the reviewed consent/exact-request UI, with distinct V3 transport and
 * recovery namespace. V2 presentation shape is not a V2 database-proof alias. */
export function SelectedStepAwardSectionV3({enabled,writesVerified,scope,role}:{enabled:boolean;writesVerified:boolean;scope:ModernPrizeScopeV2;role:string}){
 const key=JSON.stringify(scope),fixed=useMemo(()=>JSON.parse(key)as ModernPrizeScopeV2,[key]);
 const port=useMemo<ModernPrizePortV2>(()=>({read:async signal=>{const r=await fetch(`/api/v1/tournaments/${fixed.tournamentId}/selected-step-awards/${fixed.eventId}?actor=${fixed.actorId}`,{credentials:'same-origin',cache:'no-store',signal});if(!r.ok)throw Error('read');return r.json();},
  save:async(attempt,signal)=>{const r=await fetch(`/api/v1/tournaments/${fixed.tournamentId}/selected-step-awards/${fixed.eventId}`,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt),signal});if(!r.ok)throw Error('outcome_unknown');return r.json();}}),[fixed]);
 const storage=useMemo<FinanceDraftRetainedPortV1>(()=>{const underlying=createIndexedFinanceDraftRetainedV1(),domain=(v:string)=>v.replace('modern-prize-award-v2:','selected-step-award-v3:').replace('modern-prize-award-accepted-v2:','selected-step-award-accepted-v3:');return{
  read:key=>underlying.read(domain(key)),transition:(key,expected,next,archive,signal)=>trackAppRecoveryWrite(()=>underlying.transition(domain(key),expected,next,archive?{id:domain(archive.id),raw:archive.raw}:undefined,signal)),
 };},[]);
 if(!enabled||role!=='director')return null;
 return <section aria-label="Current Prize Review"><p>Regular prizes use their own reviewed fund. Q-Pool and Side Pool money remains separate. All recorded awards are unpaid bookkeeping.</p><p>Current playoff results, a saved prize proposal and a confirmed fund review are required. Missing evidence stays on hold; no amount is assumed.</p><ModernPrizeJournalSectionV2 enabled scope={fixed} role={role} writesVerified={writesVerified} port={port} storage={storage}/></section>;
}
