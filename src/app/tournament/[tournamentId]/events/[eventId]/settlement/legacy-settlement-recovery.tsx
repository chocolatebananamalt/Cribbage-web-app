"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {parseLegacySettlementRecovery} from '../../../../../../lib/api/legacy-settlement-recovery';
import {isSettlementDraftOutcome,isRejectedSettlementDraft} from '../../../../../../lib/api/settlement-draft';
import {isManualSettlementFinalizationOutcome,isRejectedManualSettlementFinalization} from '../../../../../../lib/api/settlement-finalization';

/** Retained pre-upgrade requests remain recoverable after event-scoped routing. */
function Recovery({actorId,tournamentId,eventId,kind}:{actorId:string;tournamentId:string;eventId:string;kind:'settlement-draft'|'manual-settlement-finalization'}) {
 const router=useRouter();const prefix=kind==='settlement-draft'?'settlement-draft':'settlement-finalization';const key=`${prefix}:${actorId}:${eventId}`;
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const flight=useRef(false);
 const inspect=useCallback(async(retry=false)=>{
  if(flight.current)return;flight.current=true;setBusy(true);
  try{
   const raw=sessionStorage.getItem(key);if(raw===null){setMessage('');return;}
   const lookup=parseLegacySettlementRecovery(raw,kind);if(!lookup){setMessage('An unrecognized legacy request remains saved. It has not been overwritten or discarded.');return;}
   const stored=JSON.parse(raw) as Record<string,unknown>;const {kind:storedKind,...request}=stored;void storedKind;
   const response=await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/${prefix}${retry?'':'/reconciliation'}`,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify(retry?request:lookup)});
   const body:unknown=await response.json().catch(()=>null);
   const result=retry?body:body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).length===1&&'result'in body?(body as {result:unknown}).result:undefined;
   if(sessionStorage.getItem(key)!==raw){setMessage('The retained legacy request changed. The newer request remains saved and needs its own receipt check.');return;}
   const accepted=kind==='settlement-draft'?isSettlementDraftOutcome(result,tournamentId,eventId):isManualSettlementFinalizationOutcome(result,tournamentId,eventId);
   const rejected=kind==='settlement-draft'?isRejectedSettlementDraft(result,eventId):isRejectedManualSettlementFinalization(result,eventId);
   if((response.ok&&accepted)||((retry?response.status===409:response.ok)&&rejected)){
    sessionStorage.removeItem(key);setMessage(accepted?'The original legacy operation is confirmed. Reloading its recorded result.':'The original legacy operation was rejected. Its retained request has been resolved.');router.refresh();return;
   }
   setMessage('No completed receipt is available yet. The original legacy request remains saved. You may retry that exact request; no new values or operation ID will be supplied.');
  }catch{setMessage('The legacy operation remains uncertain and saved. Check its receipt or retry the exact retained request.');}
  finally{flight.current=false;setBusy(false);}
 },[eventId,key,kind,prefix,router,tournamentId]);
 useEffect(()=>{const timer=window.setTimeout(()=>{void inspect();},0);return()=>window.clearTimeout(timer);},[inspect]);
 if(!message)return null;
 return <section className="correction-item" aria-label={`Legacy ${prefix} recovery`}><h3>Pre-upgrade request recovery</h3><p role="status">{message}</p><button type="button" disabled={busy} onClick={()=>void inspect()}>Check legacy receipt status</button><button type="button" disabled={busy} onClick={()=>void inspect(true)}>Retry exact legacy request</button></section>;
}
export default function LegacySettlementRecovery(props:{actorId:string;tournamentId:string;eventId:string}){return <><Recovery {...props} kind="settlement-draft"/><Recovery {...props} kind="manual-settlement-finalization"/></>;}
