'use client';
import{useEffect,useLayoutEffect,useMemo,useRef,useSyncExternalStore}from'react';
import{PlayoffSeriesEntryV1,type PlayoffSeriesEntryViewV1}from'./playoff-series-entry-v1';
import{createClient}from'../lib/supabase/client';
import{transitionAppRecoveryItem}from'../lib/recovery-write-coordinator';
import{SelectedStepPlayerControllerV3,type SelectedStepPlayerPortV3,type SelectedStepPlayerStorageV3}from'../lib/playoffs/selected-step-player-controller-v3';
import{type SelectedStepPlayerScopeV3}from'../lib/playoffs/selected-step-player-v3';
type Props={enabled:boolean;writesVerified:boolean;scope:SelectedStepPlayerScopeV3;port?:SelectedStepPlayerPortV3;storage?:SelectedStepPlayerStorageV3;subscribeIdentity?:(f:(actor:string|null)=>void)=>()=>void};
export function SelectedStepPlayerEntryV3(props:Props){if(!props.enabled)return null;return <Entry key={JSON.stringify(props.scope)} {...props}/>;}
function Entry({scope,writesVerified,port:injected,storage:injectedStorage,subscribeIdentity}:Props){
 const scopeKey=JSON.stringify(scope),fixed=useMemo(()=>JSON.parse(scopeKey)as SelectedStepPlayerScopeV3,[scopeKey]);
 const endpoint=`/api/v1/tournaments/${fixed.tournamentId}/playoff-games/${fixed.eventId}/${fixed.generationId}`,query=`qualification=${fixed.qualificationId}&slot=${fixed.slot}`;
 const port=useMemo<SelectedStepPlayerPortV3>(()=>injected??{
  read:async signal=>{const r=await fetch(`${endpoint}?${query}`,{credentials:'same-origin',cache:'no-store',signal});if(!r.ok)throw Error('source');return r.json();},
  send:async(p,signal)=>{const r=await fetch(endpoint,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({qualificationId:fixed.qualificationId,slot:fixed.slot,request:p.request}),signal});if(!r.ok)throw Error('send');return r.json();},
  check:async(p,signal)=>{const r=await fetch(`${endpoint}?${query}&operation=${p.request.operationId}`,{credentials:'same-origin',cache:'no-store',signal});if(!r.ok)throw Error('check');return r.json();},
 },[injected,endpoint,query,fixed.qualificationId,fixed.slot]);
 const storage=useMemo<SelectedStepPlayerStorageV3>(()=>injectedStorage??{read:key=>window.sessionStorage.getItem(key),retain:(key,expected,next,archive)=>{
  if(!transitionAppRecoveryItem(window.sessionStorage,key,expected,next,archive))throw Error('storage_changed');
 }},[injectedStorage]);
 const controller=useMemo(()=>new SelectedStepPlayerControllerV3(fixed,storage,port,()=>writesVerified,()=>navigator.onLine),[fixed,storage,port,writesVerified]);
 const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot),ready=useRef(false),owner=useMemo(()=>({controller}),[controller]),lease=useRef<typeof owner|null>(null),privateView=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{lease.current=owner;return()=>{if(lease.current===owner){lease.current=null;ready.current=false;}controller.setActive(false);};},[controller,owner]);
 useEffect(()=>{
  const observe=(actor:string|null)=>{if(lease.current!==owner)return;ready.current=actor===fixed.actorId;if(privateView.current)privateView.current.hidden=!ready.current;controller.setActive(ready.current);if(ready.current)void controller.initialize();};
  if(subscribeIdentity)return subscribeIdentity(observe);
  const client=createClient(),subscription=client.auth.onAuthStateChange((_event,session)=>observe(session?.user.id??null));
  return()=>{ready.current=false;controller.setActive(false);subscription.data.subscription.unsubscribe();};
 },[controller,fixed.actorId,subscribeIdentity,owner]);
 useLayoutEffect(()=>{if(privateView.current)privateView.current.hidden=!state.active;},[state.active]);
 const run=(f:()=>void|Promise<void>)=>{if(ready.current&&lease.current===owner&&controller.getSnapshot()===state)void f();};
 const v=state.active?state.view:null;
 const view:PlayoffSeriesEntryViewV1|null=v?{actorParticipantId:v.actorParticipantId,players:v.players,roundLabel:v.round==='final'?'Final':v.round==='semifinal'?'Semifinal':'Playoff Round',matchLabel:`Match ${v.slot}`,gameNumber:v.gameNumber,winsRequired:v.winsRequired,maximumGames:v.maximumGames,seriesWins:v.wins,
  status:state.blocked?'storage_blocked':state.pending?state.rejected?'rejected':'unknown_outcome':v.seriesComplete?'series_complete':v.ownSubmission?v.ownConfirmed?'waiting_opponent':'saved_awaiting_confirmation':'ready',
  selectedWinnerParticipantId:state.selection,ownSubmittedWinnerParticipantId:v.ownSubmission?.winnerParticipantId??null,canSubmit:writesVerified&&!state.pending&&!state.blocked&&!v.seriesComplete,
  canConfirm:writesVerified&&!state.pending&&!state.blocked&&!!v.ownSubmission&&!v.ownConfirmed&&!v.seriesComplete,canRetry:writesVerified&&!!state.pending&&!state.rejected&&!state.blocked,canCheckOutcome:!!state.pending&&!state.blocked,canRefresh:true,canKeepCopy:state.rejected,busy:state.busy,message:state.message}:null;
 return <section aria-label="Modern Playoff Game"><p>Digital player entry. A saved submission is separate from your confirmation. Paper review uses its own manual screen.</p>
 {!writesVerified&&<p role="status">Recording is disabled until database and provider acceptance passes.</p>}
 <div ref={privateView} hidden={!state.active}>{v&&<p>{v.players.map(p=>`${p.displayName} — Tournament ID ${p.tournamentPlayerId}`).join(' / ')}</p>}
 <PlayoffSeriesEntryV1 enabled view={view} commands={{selectWinner:id=>run(()=>controller.select(id)),submitResult:()=>run(()=>controller.prepare('submit',()=>crypto.randomUUID())),confirmOwnEntry:()=>run(()=>controller.prepare('confirm',()=>crypto.randomUUID())),retryExact:()=>run(()=>controller.resolve()),checkOutcome:()=>run(()=>controller.resolve(true)),refresh:()=>run(()=>controller.initialize()),keepCopyAndContinue:()=>run(()=>controller.keepRejected())}}/>
 {!v&&state.active&&<><p role="status">{state.message}</p><button disabled={state.busy} onClick={()=>run(()=>controller.initialize())}>Refresh Match</button>{state.pending&&!state.blocked&&<><button disabled={state.busy} onClick={()=>run(()=>controller.resolve(true))}>Check Saved Entry</button><button disabled={state.busy||!writesVerified||state.rejected} onClick={()=>run(()=>controller.resolve())}>Retry Exact Saved Entry</button>{state.rejected&&<button disabled={state.busy} onClick={()=>run(()=>controller.keepRejected())}>Keep Saved Copy and Continue</button>}</>}</>}
 </div>{!state.active&&<p role="status">Checking the signed-in account. Saved work is retained.</p>}</section>;
}
