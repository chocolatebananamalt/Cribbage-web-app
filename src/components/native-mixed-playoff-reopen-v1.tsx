'use client';
import{useEffect,useLayoutEffect,useMemo,useRef,useState}from'react';
import{PlayoffReopenPendingV1,type PlayoffReopenRuntimeV1}from'../lib/playoffs/native-mixed-playoff-reopen-pending-v1';
import{buildPlayoffReopenRequestV1}from'../lib/playoffs/native-mixed-playoff-reopen-v1';
import './native-mixed-game-reopen-v1.css';
export function NativeMixedPlayoffReopenV1({enabled=false,runtime}:{enabled?:boolean;runtime:PlayoffReopenRuntimeV1|null}){if(!enabled||!runtime)return <p role="status">Playoff disagreement review is not enabled. Existing evidence is unchanged.</p>;return <Active key={JSON.stringify(runtime.target)} runtime={runtime}/>;}
function Active({runtime}:{runtime:PlayoffReopenRuntimeV1}){
 const owner=useMemo(()=>({runtime}),[runtime]),[view,setView]=useState<{owner:object;engine:PlayoffReopenPendingV1;state:ReturnType<PlayoffReopenPendingV1['getSnapshot']>}|null>(null),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),live=useRef<object|null>(null),current=useRef<PlayoffReopenPendingV1|null>(null),flight=useRef<object|null>(null);
 const engine=view?.owner===owner?view.engine:null,state=view?.owner===owner?view.state:null,lease={engine,state,reason,busy};
 useLayoutEffect(()=>{live.current=lease;return()=>{if(live.current===lease)live.current=null;};});
 useEffect(()=>{const engine=new PlayoffReopenPendingV1(runtime);current.current=engine;let active=true;void(async()=>{await engine.initialize();if(active){setView({owner,engine,state:engine.getSnapshot()});await engine.refresh();if(active)setView({owner,engine,state:engine.getSnapshot()});}})();return()=>{active=false;if(current.current===engine)current.current=null;engine.dispose();};},[runtime,owner]);
 async function run(work:()=>Promise<unknown>){if(!engine||current.current!==engine||live.current!==lease||busy||flight.current||!runtime.enabled())return;const token={};flight.current=token;setBusy(true);try{await work();if(current.current===engine)setView({owner,engine,state:engine.getSnapshot()});}finally{if(flight.current===token)flight.current=null;if(current.current===engine)setBusy(false);}}
 const w=state?.workspace,locked=busy||!state?.initialized||state.blocked||!!state.pending,candidate=w?buildPlayoffReopenRequestV1(w,reason):null;
 async function propose(){if(!engine||!candidate||locked||live.current!==lease||!runtime.online())return;await run(async()=>{if(await engine.stage(crypto.randomUUID(),reason))await engine.submitExact();});}
 const winner=(id:string)=>w?.sideA.participantId===id?`Tournament ID ${w.sideA.tournamentIdNumber}`:w?.sideB.participantId===id?`Tournament ID ${w.sideB.tournamentIdNumber}`:'Unavailable';
 return <section className="native-mixed-reopen" aria-labelledby="playoff-review-title" aria-busy={busy}>
  <h1 id="playoff-review-title">Review Playoff Disagreement</h1><p><strong>Practice Only.</strong> No official results, MRPs or money are recorded here.</p>
  <p>Reopening keeps the original evidence and selects no winner. Both sides must submit fresh records of the same game, with independent verification. Completed games and later dependent results cannot be reopened here.</p>
  {!state?<p role="status">Checking saved work and current evidence.</p>:<>
   {state.message&&<p role="status">{state.message}</p>}
   {state.blocked&&<p>Earlier or unrecognized saved work is preserved and blocks a new request.</p>}
   {w&&<><h2>Match {w.slot}, Game {w.gameNumber}</h2><p>{w.sideA.displayName} — Tournament ID {w.sideA.tournamentIdNumber} ({w.sideA.mode})<br/>{w.sideB.displayName} — Tournament ID {w.sideB.tournamentIdNumber} ({w.sideB.mode})</p>
    <p>{w.policy?`Saved correction policy version ${w.policy.version}.`:'No saved correction policy is available.'} Fresh independent verification is required after reopening.</p>
    {w.blockedCode&&<p role="status">Reopening is unavailable: {w.blockedCode.replaceAll('_',' ')}.</p>}
    <h2>Recorded Evidence</h2><ul>{w.entries.map(e=><li key={e.id}>{e.type==='digital-submit'?`Digital entry: ${winner(e.participantId)} records ${winner(e.winnerParticipantId)} winning.`:e.type==='digital-confirm'?'Digital confirmation recorded.':e.type==='paper-capture'?`Paper capture: ${e.claims.map(c=>`${winner(c.participantId)} records ${winner(c.winnerParticipantId)} winning`).join('; ')}.`:`Independent paper ${e.decision==='disputed-simulation-only'?'disagreement':'review'}: ${e.reenteredClaims.map(c=>`${winner(c.participantId)} records ${winner(c.winnerParticipantId)} winning`).join('; ')}.`}</li>)}</ul>
    <label htmlFor="playoff-reopen-reason">Reason (Required)</label><textarea id="playoff-reopen-reason" required maxLength={500} value={reason} disabled={locked||!w.canPropose} aria-describedby="playoff-reopen-help" onChange={e=>{if(live.current===lease&&!flight.current){live.current=null;setReason(e.target.value);}}}/>
    <p id="playoff-reopen-help">Enter a single-line reason, up to 500 characters. This does not choose a winner.</p><button type="button" disabled={locked||!candidate||!runtime.online()} onClick={()=>void propose()}>Reopen for Fresh Verification</button>
   </>}
   {state.pending&&<><h2>Saved Correction</h2><p>Reason: {state.pending.request.reason}</p><p>The exact match, game, reason and source are locked.</p><button type="button" disabled={busy||!runtime.online()} onClick={()=>void run(()=>engine!.checkOutcome())}>Check Saved Outcome</button><button type="button" disabled={busy||!runtime.online()} onClick={()=>void run(()=>engine!.submitExact())}>Retry Exact Correction</button></>}
   <button type="button" disabled={busy||state.blocked||!runtime.online()} onClick={()=>void run(()=>engine!.refresh())}>Refresh Current Review</button>
  </>}
 </section>;
}
