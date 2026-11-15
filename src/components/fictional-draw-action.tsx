"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { assertRecoveryStorageOwner } from "../lib/auth/recovery-owner";
import { setAppRecoveryItem } from "../lib/recovery-write-coordinator";

type Props = { actorId: string; tournamentId: string; eventId: string; reviewedOperationId?: string };
type RequestBody = { action: "admit" | "publish_schedule"; eventId: string; operationId: string; confirmed: true; reviewedActorId?: string; reviewedOperationId?: string };
export default function FictionalDrawAction({ actorId, tournamentId, eventId, reviewedOperationId }: Props) {
 const router=useRouter(), action=reviewedOperationId ? "publish_schedule" : "admit", key=`fictional-draw:${action}:${actorId}:${tournamentId}:${eventId}:${reviewedOperationId ?? "admission"}`;
 const [pending,setPending]=useState<RequestBody|null>(null),[checked,setChecked]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[message,setMessage]=useState("");
 const flight=useRef(false);
 useEffect(()=>{const timer=window.setTimeout(()=>{try{assertRecoveryStorageOwner(actorId);const saved=sessionStorage.getItem(key);if(saved){const x:unknown=JSON.parse(saved);if(!x||typeof x!=="object"||Array.isArray(x))throw Error();const v=x as Record<string,unknown>;const keys=action==="admit"?["action","eventId","operationId","confirmed"]:["action","eventId","operationId","confirmed","reviewedActorId","reviewedOperationId"];if(Object.keys(v).sort().join()!==keys.sort().join()||v.action!==action||v.eventId!==eventId||v.confirmed!==true||typeof v.operationId!=="string"||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(v.operationId)||action==="publish_schedule"&&(v.reviewedActorId!==actorId||v.reviewedOperationId!==reviewedOperationId))throw Error();setPending(v as RequestBody);setMessage("A previous request needs its exact result checked. Retry it without changing the request.");}setReady(true);}catch{setMessage("Saved work could not be verified. It has been preserved; keep this account and ask for review.");}},0);return()=>window.clearTimeout(timer);},[action,actorId,eventId,key,reviewedOperationId]);
 async function send(){if(flight.current||!ready)return;flight.current=true;setBusy(true);try{
  assertRecoveryStorageOwner(actorId);
  const request=pending??{action,eventId,operationId:crypto.randomUUID(),confirmed:true as const,...(reviewedOperationId?{reviewedActorId:actorId,reviewedOperationId}:{})};
  if(!pending){if(!checked)return;setAppRecoveryItem(sessionStorage,key,JSON.stringify(request));setPending(request);}
  else if(sessionStorage.getItem(key)!==JSON.stringify(request))throw Error("retained request changed");
  const response=await fetch(`/api/v1/tournaments/${tournamentId}/fictional-draw`,{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(request)});
  const result:unknown=await response.json().catch(()=>null);
  if(!response.ok||!result||typeof result!=="object"||!("status" in result)||result.status!==(action==="admit"?"trial_scope_recorded":"event_schedule_published")){setMessage("The result is not confirmed. Keep and retry this exact request.");return;}
  if(sessionStorage.getItem(key)!==JSON.stringify(request))throw Error("retained request changed");sessionStorage.removeItem(key);setPending(null);setDone(true);setMessage(action==="admit"?"This tournament is admitted for up to 24 hours. Continue to the saved draw.":"The schedule is published. Review it and confirm Start Play on the schedule page.");router.push(action==="admit"?`/tournament/${tournamentId}/seating/random-draw`:`/tournament/${tournamentId}/schedule`);
 }catch{setMessage("The result is not confirmed. Saved work is preserved for an exact retry.");}finally{flight.current=false;setBusy(false);}}
 return <section className="correction-item"><h2>{action==="admit"?"Enable the fictional tournament draw":"Publish this reviewed draw as the schedule"}</h2>
 <p>{action==="admit"?"This test workflow supports exactly 18 checked-in players (six digital and twelve paper), one 18-seat table, and one activated 12-game Standard Singles Main event. The tournament name must begin TEST ONLY; the admission lasts at most 24 hours and retains the current director and source checks.":"The server rechecks the saved draw, permanent IDs, enrolled players and attendance, then publishes 108 matches atomically. Starting play is a separate confirmation."}</p>
 {!done&&!pending?<label className="publication-confirmation"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/> {action==="admit"?"I want to enable this fictional tournament for the reviewed draw.":"I reviewed the complete draw and approve these pairings and Table/Seat assignments."}</label>:null}
 {!done?<button className="primary" type="button" disabled={!ready||busy||(!pending&&!checked)} onClick={()=>void send()}>{busy?"Checking…":pending?"Retry exact request":action==="admit"?"Enable reviewed draw":"Publish reviewed schedule"}</button>:null}
 {message?<p role="status">{message}</p>:null}{done?<Link href={action==="admit"?`/tournament/${tournamentId}/seating/random-draw`:`/tournament/${tournamentId}/schedule`}>{action==="admit"?"Continue to draw":"Review schedule and start play"}</Link>:null}</section>;
}




