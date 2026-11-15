import{readPlayerPoolTotalsV1,type PlayerPoolTotalsV1}from'../lib/results/player-pool-totals-contract-v1';
const money=(n:number|null)=>n===null?'Awaiting Review':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
export function PlayerPoolTotalsV1({view,tournamentId,eventId}:{view:PlayerPoolTotalsV1|null;tournamentId:string;eventId:string}){
 const v=readPlayerPoolTotalsV1(view,tournamentId,eventId);return <section aria-label="Pool Entry Counts and Totals"><h2>Q-Pool and Side Pool Entries</h2>{!v?<p role="status">Pool totals are unavailable. They may not be enabled, or current information may need review. Unknown totals are not zero.</p>:<>
 <p>Entry counts include active pool elections, not payment confirmations. The pool total includes recorded contributions currently eligible under the pool rules. Pending or held money is excluded.</p>
 <p>Observed: <time dateTime={v.observedAt}>{v.observedAt}</time>. These are recorded snapshots, not bank confirmation or final payouts. Refresh for a newer observation.</p>
 {(['q','side']as const).map(kind=><section key={kind} aria-label={kind==='q'?'Q-Pools':'Side Pools'}><h3>{kind==='q'?'Q-Pools':'Side Pools'}</h3>{v[kind==='q'?'qState':'sideState']==='unavailable'?<p role="status">Current information is unavailable.</p>:v[kind==='q'?'qState':'sideState']==='no-recorded-pool'?<p>No pool is recorded in this snapshot.</p>:null}
 {v.pools.filter(p=>p.kind===kind).map(p=><section key={p.poolId} aria-label={p.name}><h4>{p.name}</h4><dl><dt>Entry Fee</dt><dd>{money(p.entryFeeMinor)}</dd><dt>Active Pool Entries</dt><dd>{p.participantCount===null?'Awaiting Review':p.participantCount}</dd><dt>Recorded Eligible Pool Total</dt><dd>{money(p.poolTotalMinor)}</dd><dt>If All Entered Players Pay — Estimate</dt><dd>{money(p.ifAllEnteredPayMinor)}</dd></dl></section>)}</section>)}
 <p>These figures are not a payout schedule. No individual payment records or member lists are displayed.</p>
 </>}</section>;
}
