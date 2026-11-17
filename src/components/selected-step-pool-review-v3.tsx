import type{projectSelectedStepPoolSourceV3}from'../lib/finance/selected-step-pool-source-v3';
type Review=Pick<NonNullable<ReturnType<typeof projectSelectedStepPoolSourceV3>>,'pools'|'qMinor'|'sideMinor'|'totalMinor'>;
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
/** Presentation only. A future authenticated page must supply the verified
 * current summary; no browser receipt evidence, provider or writer is created. */
export function SelectedStepPoolReviewV3({enabled=false,review,recordingControlsAvailable=false,historical=false,readOnly=false}:{enabled?:boolean;review:Review|null;recordingControlsAvailable?:boolean;historical?:boolean;readOnly?:boolean}){
 if(!enabled)return null;
 return <section aria-label="Q-Pool and Side Pool Award Review"><h2>Review Pool Awards</h2>
 <p>Q-Pool and Side Pool funds remain separate from regular prizes. {historical?'Recorded awards remain unpaid bookkeeping records.':'These are proposed awards.'} This screen does not send money or mark anyone paid.</p>
 {!review?<p role="status">Current pool evidence is unavailable or held for review. Amounts are unknown.</p>:<>
 <dl><dt>Q-Pool Funds</dt><dd>{money(review.qMinor)}</dd><dt>Side Pool Funds</dt><dd>{money(review.sideMinor)}</dd></dl>
 {review.pools.map(p=><section key={p.poolId} aria-label={p.label}><h3>{p.label}</h3>
 <p>Saved Method: {p.method==='q-equal'?'Equal (Pays All Paid Playoff Qualifiers Equally)':p.method==='q-graduated'?`Graduated 1-in-${p.ratio}`:`Graduated 1-in-${p.ratio} (Sheet Distribution)`}. Fund: {money(p.fundMinor)}. Saved Payout Increment: {money(p.roundingUnitMinor)}.</p>
 <table><caption>{historical?'Recorded Unpaid Awards':'Proposed Unpaid Awards'}</caption><thead><tr><th scope="col">Player</th><th scope="col">Tournament ID</th><th scope="col">Amount</th></tr></thead><tbody>{p.recipients.map(r=><tr key={r.tournamentPlayerId}><td>{r.name}</td><td>{r.tournamentPlayerId}</td><td>{money(r.amountMinor)}</td></tr>)}</tbody></table></section>)}
 {!historical&&!recordingControlsAvailable&&!readOnly&&<p role="status">Director review and database verification are required before recording. Recording controls are unavailable in this local checkpoint.</p>}
 {readOnly&&<p>Read-only proposal preview. Recording requires a separate explicit Director review; this screen has no recording controls.</p>}
 </>}
 </section>;
}
