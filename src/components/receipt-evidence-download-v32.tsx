'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createClient} from '../lib/supabase/client';
import {readReceiptEvidenceCsvV32} from '../lib/payments/receipt-evidence-read-v32';
export function ReceiptEvidenceDownloadV32({enabled=false,actorId,tournamentId}:{enabled?:boolean;actorId:string;tournamentId:string}){
 return enabled?<OwnedDownloadV32 key={actorId+':'+tournamentId} actorId={actorId} tournamentId={tournamentId}/>:null;
}
function OwnedDownloadV32({actorId,tournamentId}:{actorId:string;tournamentId:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[unavailable,setUnavailable]=useState(false),epoch=useRef(0),alive=useRef(false),flight=useRef(false);
 const client=useRef<ReturnType<typeof createClient>|null>(null);
 const invalidate=useCallback(()=>{alive.current=false;epoch.current++;client.current=null;},[]);
 useLayoutEffect(()=>{alive.current=true;return invalidate;},[invalidate]);
 useEffect(()=>{try{if(!alive.current)return;const c=createClient();client.current=c;const subscription=c.auth.onAuthStateChange(()=>{epoch.current++;});return()=>{client.current=null;try{subscription.data.subscription.unsubscribe();}catch{/* Optional export cleanup does not change payment authority. */}};}catch{client.current=null;queueMicrotask(()=>{if(alive.current){setUnavailable(true);setMessage('Receipt export is unavailable. Other payment tools and saved requests are unchanged. Reload after access is restored.');}});}},[]);
 async function download(){if(!alive.current||flight.current||!client.current||unavailable)return;flight.current=true;setBusy(true);setMessage('');const n=epoch.current,on=()=>alive.current&&epoch.current===n;
  try{const result=await readReceiptEvidenceCsvV32({client:client.current,actorId,tournamentId,enabled:on});if(!on())return;if(!result){setMessage('Current authorized receipt evidence could not be verified. Nothing was changed or downloaded.');return;}
   const url=URL.createObjectURL(new Blob([result.csv],{type:'text/csv;charset=utf-8'}));try{const a=document.createElement('a');a.href=url;a.download=result.filename;a.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),0);}setMessage('Private receipt evidence downloaded. Keep it private; it is not reconciliation or an ACC submission.');
  }catch{if(on())setMessage('Receipt evidence could not be downloaded. Existing records and pending work are unchanged.');}finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 return <section className="policy-settings"><h2>Private Receipt Evidence</h2><p>Download a fresh recorded receipt/void history for manual finance review. No balances, paid-in-full status or payouts are calculated. Notes and reasons are omitted; review those in the private ledger. Same-name entries remain separate; snapshot row numbers are not player IDs.</p><button type="button" className="secondary" disabled={busy||unavailable} onClick={()=>void download()}>{busy?'Checking current receipt evidence…':'Download Private Receipt Evidence CSV'}</button>{message&&<p role="status">{message}</p>}</section>;
}
