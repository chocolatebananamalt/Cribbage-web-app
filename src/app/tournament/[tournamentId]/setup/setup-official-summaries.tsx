"use client";
import{useEffect,useState}from'react';
import{isSetupOfficialsWorkspace,setupOfficialRoles,type SetupOfficialsWorkspace,type SetupOfficialRole}from'../../../../lib/api/setup-officials';
const labels:Record<SetupOfficialRole,string>={co_director:'Co-Directors',cross_checker:'Cross-Checkers',judge:'Judges'};
const statusLabel=(status:string)=>status==='registered_approved'?'Registered & Approved':status==='invitation_email_sent'?'Awaiting Acceptance':'Awaiting Acceptance - Delivery Unavailable';
type RoleResult={status:'available';workspace:SetupOfficialsWorkspace}|{status:'unavailable'};
export default function SetupOfficialSummaries({tournamentId,canManage}:{tournamentId:string;canManage:boolean}){
 const[refresh,setRefresh]=useState(0);
 const[loaded,setLoaded]=useState<{tournamentId:string;refresh:number;roles:Partial<Record<SetupOfficialRole,RoleResult>>}|null>(null);
 useEffect(()=>{let active=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000),captured=tournamentId;
  void Promise.all(setupOfficialRoles.map(async role=>{try{const response=await fetch(`/api/v1/tournaments/${encodeURIComponent(captured)}/setup-officials/${role}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal});const data:unknown=await response.json();return[role,response.ok&&isSetupOfficialsWorkspace(data)&&data.role===role?{status:'available',workspace:data}:{status:'unavailable'}]as const;}catch{return[role,{status:'unavailable'}]as const;}})).then(rows=>{if(active)setLoaded({tournamentId:captured,refresh,roles:Object.fromEntries(rows)});}).finally(()=>clearTimeout(timeout));
  return()=>{active=false;clearTimeout(timeout);controller.abort();};
 },[tournamentId,refresh]);
 const roles=loaded?.tournamentId===tournamentId&&loaded.refresh===refresh?loaded.roles:{};
 const retry=setupOfficialRoles.some(role=>roles[role]?.status==='unavailable');
 return <section className="setup-subsection setup-wide" aria-labelledby="setup-officials-title"><h3 id="setup-officials-title">Tournament Officials</h3><p className="field-help">A person may hold more than one nominated role. Each role requires the exact invited account to sign in and explicitly accept it separately.</p><p className="field-help">In the mixed rehearsal, paper capture and independent review require different eligible people, neither playing that game. Rehearsal access and identity binding are separate from these assignments.</p>{setupOfficialRoles.map(role=>{const result=roles[role],workspace=result?.status==='available'?result.workspace:null;return <div key={role} className="setup-official-summary"><span><strong>{labels[role]}</strong><small>{workspace?`${workspace.entries.length} of ${workspace.capacity} listed`:result?.status==='unavailable'?'Assignments Unavailable':'Loading Assignments'} </small>{workspace?.entries.map(entry=><small key={entry.nominationId}>{entry.displayName} - {statusLabel(entry.status)}</small>)}</span>{canManage?<a className="secondary button-link" href={`/tournament/${tournamentId}/setup/officials/${role}`}>Add/Remove</a>:null}</div>;})}{retry&&<button type="button" className="secondary" onClick={()=>setRefresh(n=>n+1)}>Retry Official Assignments</button>}</section>;
}
