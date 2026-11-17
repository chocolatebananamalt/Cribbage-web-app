'use client';
import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '../lib/supabase/client';
import {isUuid} from '../lib/api/validation';

/** Observation only. Every refresh retains the existing server authorization and scorecard projection. */
export function ScorecardObserverV42({actorId,tournamentId,eventId,verificationId}:{actorId:string;tournamentId:string;eventId:string;verificationId:string}){
 const router=useRouter(),owner=useMemo(()=>({actorId,tournamentId,eventId,verificationId,router}),[actorId,tournamentId,eventId,verificationId,router]),committed=useRef<typeof owner|null>(null);
 useLayoutEffect(()=>{committed.current=owner;return()=>{if(committed.current===owner)committed.current=null;};},[owner]);
 useEffect(()=>{
  if(![owner.actorId,owner.tournamentId,owner.eventId].every(isUuid)||!owner.verificationId)return;
  let disposed=false,observedActor:string|null=null,printing=false,last=-Infinity,unsubscribe=()=>{};
  const stop=()=>{try{unsubscribe();}catch{/* Observation cleanup cannot alter account or local work. */}};
  const refresh=()=>{if(disposed||committed.current!==owner||observedActor!==owner.actorId||!navigator.onLine||document.visibilityState!=='visible'||printing||window.matchMedia('print').matches)return;const now=performance.now();if(now-last<1000)return;last=now;try{owner.router.refresh();}catch{/* A failed observation never changes score or recovery state. */}};
  try{const c=createClient(),r=c.auth.onAuthStateChange((_event,session)=>{if(!disposed)observedActor=session?.user.id??null;});unsubscribe=()=>r.data.subscription.unsubscribe();}catch{disposed=true;return()=>{disposed=true;stop();};}
  const accepted=(e:StorageEvent)=>{if(e.key==='acc-score-result-accepted')refresh();},beforePrint=()=>{printing=true;},afterPrint=()=>{printing=false;},hide=()=>{disposed=true;observedActor=null;};
  const timer=window.setInterval(refresh,10_000);
  window.addEventListener('focus',refresh);window.addEventListener('online',refresh);window.addEventListener('storage',accepted);document.addEventListener('visibilitychange',refresh);window.addEventListener('beforeprint',beforePrint);window.addEventListener('afterprint',afterPrint);window.addEventListener('pagehide',hide);
  return()=>{disposed=true;observedActor=null;window.clearInterval(timer);stop();window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('storage',accepted);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('beforeprint',beforePrint);window.removeEventListener('afterprint',afterPrint);window.removeEventListener('pagehide',hide);};
 },[owner]);
 return <p className="scorecard-print-controls">While online and visible, this scorecard checks for newer verified results every 10 seconds. Pending entries do not count until verified.</p>;
}
