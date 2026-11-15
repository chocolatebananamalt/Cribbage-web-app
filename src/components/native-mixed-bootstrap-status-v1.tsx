'use client';
import{useEffect,useState}from'react';
import{readNativeMixedBootstrapStatusV1,type NativeMixedBootstrapStatusV1}from'../lib/seating/native-mixed-bootstrap-status-v1';
import type{NativeMixedDirectorContextV1}from'../lib/seating/native-mixed-director-session-v1';
export function NativeMixedBootstrapStatusPanelV1({enabled=false,context,read,online}:{enabled?:boolean;context:NativeMixedDirectorContextV1;read:()=>Promise<unknown>;online:boolean}){
 const[source,setSource]=useState<NativeMixedBootstrapStatusV1|null>(null),[busy,setBusy]=useState(false),[token,setToken]=useState(0),[now,setNow]=useState(0);
 useEffect(()=>{let alive=true;if(!enabled||!online)return;queueMicrotask(()=>{if(alive){setBusy(true);setSource(null);}});void read().then(raw=>{if(alive){setSource(readNativeMixedBootstrapStatusV1(raw,context.scope));setNow(Date.now());}}).catch(()=>{if(alive)setSource(null);}).finally(()=>{if(alive)setBusy(false);});const timer=setInterval(()=>{if(alive)setNow(Date.now());},1000);return()=>{alive=false;clearInterval(timer);};},[enabled,online,context,read,token]);
 return enabled?<NativeMixedBootstrapStatusViewV1 source={source} busy={busy} online={online} now={now} refresh={()=>setToken(v=>v+1)}/>:null;
}
export function NativeMixedBootstrapStatusViewV1({source,busy,online,now,refresh}:{source:NativeMixedBootstrapStatusV1|null;busy:boolean;online:boolean;now:number;refresh:()=>void}){
 const current=source&&online&&now-Date.parse(source.observedAt)<=30000;const records=current?source.records:null;
 const rows=records?[['Test Setup Intent',records.admissionIntent],['Simulated Entry Funding Verified',records.simulatedFundingVerified],['Test Participation Scope',records.attendanceScope],['Fictional Paper Roster Declaration',records.paperDeclaration],['Independent Paper Roster Review',records.paperReview],['Readiness Seal',records.attendanceSeal],['Registration Closed',records.registrationClosed]]as const:[];
 return <section aria-label="Rehearsal Preparation Checklist"><h2>Before Seating</h2><p>This is a read-only checklist for an authorized test cohort. It does not create accounts, roles, simulated receipts, consent, or attendance.</p><button type="button" disabled={busy||!online} onClick={refresh}>Check Preparation Status</button><p role="status" aria-live="polite">{!current?'Current preparation status is unavailable. Saved requests are kept.':source.currentReadinessVerified?'Current test readiness has been verified.':'Preparation records are shown below; complete test readiness has not been verified.'}</p>
 {records&&<><ul>{rows.map(([label,present])=><li key={label}>{label}: {present?'Record Available':'Not Verified'}</li>)}</ul><p>Digital Consent Records Granted: {records.grantedConsentCount} of 6</p></>}
 <p>Each digital player must consent through their own account. A different authorized cross-checker must review the fictional paper roster. These records never stand for physical attendance or real payments.</p><p>Director setup writes and the player-consent and cross-checker screens are not available here yet.</p></section>;
}
