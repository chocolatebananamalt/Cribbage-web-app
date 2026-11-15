"use client";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { isOfficialInvitationContext, isSetupOfficialAcceptance, isLegacyCoDirectorAcceptance, type OfficialInvitationContext } from "../../../lib/api/official-invitation-context";
const roles = { co_director: "Co-Director", cross_checker: "Cross-Checker", judge: "Judge" };
type Props={invitationId:string;initial:OfficialInvitationContext|null;legacy?:boolean;signedIn?:boolean};
export default function OfficialInvitationClient(props:Props){return <ActiveInvitation key={JSON.stringify([props.invitationId,props.initial,props.legacy??false,props.signedIn??true])} {...props}/>;}
function ActiveInvitation({invitationId,initial,legacy=false,signedIn=true}:Props){
 const[context,setContext]=useState(()=>signedIn&&!legacy&&isOfficialInvitationContext(initial)&&initial.nominationId===invitationId?initial:null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const expectedRole=useRef(context?.role??null);
 const alive=useRef(false),inFlight=useRef<AbortController|null>(null),latest=useRef<object|null>(null);
 const accepted=!uncertain&&signedIn&&context?.status==='accepted',endpoint=`/api/v1/official-invitations/${encodeURIComponent(invitationId)}`,intent={context,busy,uncertain,signedIn,accepted};
 useLayoutEffect(()=>{latest.current=intent;return()=>{if(latest.current===intent)latest.current=null;};});
 useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;latest.current=null;inFlight.current?.abort();inFlight.current=null;};},[]);
 const current=()=>alive.current&&latest.current===intent&&!inFlight.current&&!busy&&signedIn;
 async function readContext(token:AbortController){const response=await fetch(endpoint,{cache:'no-store',credentials:'same-origin',signal:token.signal});const result:unknown=await response.json();if(!alive.current||inFlight.current!==token||token.signal.aborted||!response.ok||!isOfficialInvitationContext(result)||result.nominationId!==invitationId||(expectedRole.current!==null&&result.role!==expectedRole.current))return null;if(expectedRole.current===null)expectedRole.current=result.role;return result;}
 async function check(){
  if(!current()||legacy)return;const token=new AbortController();inFlight.current=token;latest.current=null;setBusy(true);const owned=()=>alive.current&&inFlight.current===token&&!token.signal.aborted;
  try{const result=await readContext(token);if(!owned())return;if(result){setContext(result);setUncertain(false);setMessage(result.status==='accepted'?'Your acceptance for this nominated role is confirmed. Other nominated roles require separate acceptance.':'Still awaiting your acceptance. Check the tournament and role before accepting.');}else{setContext(null);setUncertain(true);setMessage('This invitation is unavailable or does not match your signed-in account and nominated role.');}}
  catch{if(owned()){setUncertain(true);setMessage('The result is still uncertain. Check status again before accepting.');}}
  finally{if(inFlight.current===token){inFlight.current=null;if(alive.current)setBusy(false);}}
 }
 async function accept(){
  if(!current()||accepted||uncertain||(!legacy&&!context))return;const token=new AbortController();inFlight.current=token;latest.current=null;setBusy(true);const owned=()=>alive.current&&inFlight.current===token&&!token.signal.aborted;
  try{const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',cache:'no-store',body:'{}',signal:token.signal});const result:unknown=await response.json();if(!owned())return;
   if(legacy){setUncertain(true);setMessage(response.ok&&(isSetupOfficialAcceptance(result)||isLegacyCoDirectorAcceptance(result))?'A legacy acceptance receipt was returned. Open Your Tournaments to check current access before continuing; this page cannot confirm its nominated role.':'The legacy acceptance result is uncertain. Open Your Tournaments to check access before another attempt.');return;}
   if(response.ok&&isSetupOfficialAcceptance(result,invitationId)){const verified=await readContext(token);if(!owned())return;if(verified?.status==='accepted'){setContext(verified);setUncertain(false);setMessage('Your acceptance for this nominated role is confirmed. Other nominated roles require separate acceptance.');return;}}
   setUncertain(true);setMessage('Acceptance was not confirmed. Check acceptance status before trying again. No automatic retry will be made.');
  }catch{if(owned()){setUncertain(true);setMessage(legacy?'The legacy result is uncertain. Open Your Tournaments to check access before another attempt.':'The result is uncertain. Check acceptance status before trying again.');}}
  finally{if(inFlight.current===token){inFlight.current=null;if(alive.current)setBusy(false);}}
 }
 return <><p className="eyebrow">TOURNAMENT OFFICIALS</p><h1>Accept Official Invitation</h1>
  {context?<div className="card-context"><h2>{context.tournamentName}</h2><p>Invited role: <strong>{roles[context.role]}</strong></p><p>Acceptance deadline: <time dateTime={context.expiresAt}>{new Date(context.expiresAt).toISOString().replace('T',' ').replace('.000Z',' UTC')}</time></p></div>:null}
  <p role="status" className="auth-note">{message||(accepted?'Your official acceptance is confirmed.':!signedIn?'Sign in with the exact invited email, then return to this link. No authority is granted until you accept.':legacy?'Confirm only if you were invited as a tournament official.':context?'Check this tournament and nominated role. Accept each nominated role separately.':'This invitation is unavailable or does not match your signed-in email.')}</p>
  <button className="primary" disabled={busy||accepted||uncertain||!signedIn||(!legacy&&!context)} onClick={()=>void accept()}>{busy?'Checking Invitation':accepted?'Accepted':'Accept Invitation'}</button>
  {!legacy&&signedIn?<button type="button" className="secondary" disabled={busy} onClick={()=>void check()}>Check Acceptance Status</button>:null}
  <p className="field-help">Accepting this nomination does not enroll you in the mixed rehearsal or permit you to review your own game.</p>{legacy&&uncertain?<p className="field-help">Open Your Tournaments to check your access. No automatic retry will be made.</p>:null}
  {!signedIn?<Link className="guide-link" href={`/sign-in?next=${encodeURIComponent(`/official-invitations/${invitationId}`)}`}>Sign in</Link>:null}<Link className="guide-link" href="/">Your Tournaments</Link>
 </>;
}
