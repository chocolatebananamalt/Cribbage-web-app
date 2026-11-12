'use client';
import{projectNativeMixedPoolPreparationV1,type NativeMixedPoolViewScopeV1}from'../lib/finance/native-mixed-pool-preparation-view-v1';
import './native-mixed-pool-preparation-v1.css';
type Props={enabled?:boolean;director?:boolean;scope:NativeMixedPoolViewScopeV1;preparation?:unknown;workspace?:unknown};
const money=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v/100);
/** Controlled read-only review. Host authorization is still required; this
 * component grants no access and cannot author or send an operation. */
export function NativeMixedPoolPreparationV1({enabled=false,director=false,scope,preparation,workspace}:Props){
 if(!enabled)return <section className="native-pool-preparation" aria-label="Practice Pools"><h2>Practice Pools</h2><p>Pool review is not enabled.</p></section>;
 const view=projectNativeMixedPoolPreparationV1(preparation,workspace,scope,director);
 return <section className="native-pool-preparation" aria-label="Practice Pools"><h2>Practice Pools</h2>
  <p className="native-pool-banner">SIMULATION ONLY · No real money received or paid.</p>
  <p>This is a read-only review. Joining pools, recording simulated contributions and saving policies are not connected here.</p>
  {!view.available?<p role="status">Current pool information is unavailable or changed. Counts and totals are unknown.</p>:<>
   <p>Pool participation: {view.sealed?'Closed for this simulation':'Not yet sealed'}.</p>
   {view.rows.length===0?<p>No {director?'saved pool definitions':'configured pool policies'} are available in this current source.</p>:<div className="native-pool-cards">{view.rows.map(row=><article key={row.poolId}>
    <h3>{row.label}{row.slot!==null?` · ${row.kind==='q'?'Q-Pool':'Side Pool'} ${row.slot}`:''}</h3>
    <dl><dt>Entry Fee</dt><dd>{money(row.feeMinor)} simulated</dd>
     <dt>Saved Method</dt><dd>{row.method===null?'Unsupported saved method':row.method==='q-equal-exact-selected-step-v1'?'Equal':`Graduated 1-in-${row.ratio}`}</dd>
     {director&&<><dt>Policy Amount Domain</dt><dd>{row.supported?'Supported method and entry fee':'Unsupported method or entry fee for this rehearsal'}</dd><dt>Saved Payout Increment</dt><dd>{row.roundingStatus==='saved_latest'&&row.roundingUnitMinor!==null?money(row.roundingUnitMinor):'Unknown in legacy settings · no default assumed'}</dd></>}
     <dt>Policy</dt><dd>{row.policy?'Configured in the current source':'Not configured'}</dd>
     <dt>Joined Participants</dt><dd>{row.policy?row.policy.electedCount:'Unknown until a policy is configured'}</dd>
     <dt>Confirmed Simulated Contributors</dt><dd>{row.policy?row.policy.simulatedPaidCount:'Unknown until a policy is configured'}</dd>
     <dt>Confirmed Simulated Pool Total</dt><dd>{row.policy?money(row.policy.simulatedFundMinor):'Unknown until a policy is configured'}</dd>
     {row.policy&&<><dt>Payout Increment</dt><dd>{money(row.policy.amountPolicy.roundingUnitMinor)}</dd></>}
     <dt>Your Participation</dt><dd>{row.ownElection?(row.ownElection.elected?'Joined':'Not joined'):'No current own election recorded'}</dd>
     {row.ownElection&&<><dt>Your Simulated Contribution</dt><dd>{row.ownElection.simulatedFunded?'Recorded':'Not recorded'}</dd></>}
    </dl><p>Payouts are not calculated or authorized by this review.</p>
   </article>)}</div>}
   {director&&<section aria-label="Fictional Paper Players"><h3>Fictional Paper Players</h3><p>These are simulated identities. Tournament IDs come from the reviewed seating publication.</p><ul>{view.paper.map(p=><li key={p.participantId}><strong>{p.displayName}</strong> · Tournament ID: {p.fixedIdStatus==='published'?p.fixedTournamentId:'Pending seating publication'}</li>)}</ul></section>}
  </>}
 </section>;
}
