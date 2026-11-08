'use client';
import type {NativeMixedReviewContextV1} from '../lib/finance/native-mixed-review-read-v1';

import {useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {isNativeMixedReviewContextV1,readNativeMixedReviewEnvelopeV1,type NativeMixedReviewEnvelopeV1} from '../lib/finance/native-mixed-review-read-v1';
import {formatFinanceMoneyV1 as money} from '../lib/finance/format-finance-money-v1';
import './native-mixed-review-section-v1.css';
type Props={enabled?:boolean;context:NativeMixedReviewContextV1;online:boolean;read:()=>Promise<unknown>};
/** Snapshot preview only, never a qualification close or ordinary Finance input. */
export function NativeMixedReviewSectionV1(props:Props){if(props.enabled!==true)return null;if(!isNativeMixedReviewContextV1(props.context))return <p role="status">Practice review context is unavailable.</p>;return <ReviewOwner key={JSON.stringify(props.context)} {...props}/>;}
function ReviewOwner({context,online,read}:Props){
 const id=useId(),owner=useMemo(()=>({context,online,read}),[context,online,read]),active=useRef<typeof owner|null>(null),flight=useRef<object|null>(null);
 const [state,setState]=useState<{owner:typeof owner|null;status:'loading'|'available'|'unavailable';data:NativeMixedReviewEnvelopeV1|null}>({owner:null,status:'unavailable',data:null});
 useLayoutEffect(()=>{active.current=owner;flight.current=null;return()=>{if(active.current===owner)active.current=null;};},[owner]);
 const visible=state.owner===owner?state:null,data=visible?.data?.review;
 async function load(){if(active.current!==owner||!online||flight.current)return;const token={owner};flight.current=token;setState({owner,status:'loading',data:null});
  try{const value=await read();if(active.current!==owner||flight.current!==token)return;const decoded=readNativeMixedReviewEnvelopeV1(value,context);setState({owner,status:decoded?'available':'unavailable',data:decoded});}
  catch{if(active.current===owner&&flight.current===token)setState({owner,status:'unavailable',data:null});}
  finally{if(flight.current===token)flight.current=null;}
 }
 return <section className="native-mixed-review" aria-labelledby={`${id}-title`} aria-busy={visible?.status==='loading'}><h2 id={`${id}-title`}>Practice Qualification and Finance Review</h2>
 <p>Test-only snapshot. It does not record official qualification, advance playoffs, award MRPs, receive real money or authorize payouts.</p>
 <button type="button" disabled={!online||visible?.status==='loading'} onClick={()=>void load()}>{data?'Refresh Practice Review':'Load Practice Review'}</button>
 {!online&&<p role="status">Reconnect before loading a practice review. Existing evidence is unchanged.</p>}
 {visible?.status==='loading'&&<p role="status">Checking completed practice evidence and simulated receipts.</p>}
 {visible?.status==='unavailable'&&<p role="status">Practice review is unavailable. Games may be incomplete, or access/source checks may have changed. No zero totals or awards are inferred.</p>}
 {data&&<><dl><div><dt>Completed Cards</dt><dd>{data.cards.length}</dd></div><div><dt>Private Game Histories</dt><dd>{data.evidenceHeads.length}</dd></div><div><dt>Preview Qualifier Places</dt><dd>{data.qualifyingCount}</dd></div><div><dt>Simulated Receipts</dt><dd>{data.simulatedReceipts.length}</dd></div><div><dt>Simulated Gross</dt><dd>{money(data.simulatedGrossMinor)}</dd></div><div><dt>Costs</dt><dd>Not determined</dd></div><div><dt>Net Prize Fund</dt><dd>Not determined</dd></div><div><dt>Awards</dt><dd>Not determined</dd></div></dl>
 <p role="status">{data.tieReviewRequired?`Tie review required. No qualifiers are selected. ${data.tieReviewReason}`:'No unresolved primary-score tie is reported in this preview. Official qualification is still not recorded.'}</p>
 <div className="native-mixed-review-table" tabIndex={0} role="region" aria-label="Practice Scorecards"><table><caption>Practice Scorecards - Immutable Tournament IDs</caption><thead><tr><th>Rank</th><th>Tournament ID</th><th>Games</th><th>Game Points</th><th>Wins</th><th>Losses</th><th>Net Spread</th><th>Positive Spread</th><th>Tied Cards</th></tr></thead><tbody>{[...data.cards].sort((a,b)=>a.rank-b.rank).map(c=><tr key={c.participantId}><td>{c.rank}</td><th scope="row">{c.fixedTournamentId}</th><td>{c.games}</td><td>{c.gamePoints}</td><td>{c.wins}</td><td>{c.losses}</td><td>{c.netSpread}</td><td>{c.positiveSpread}</td><td>{c.tieCount}</td></tr>)}</tbody></table></div>
 <details><summary>Snapshot Source Pins</summary><dl><dt>Start ID</dt><dd>{data.startId}</dd><dt>Review Digest</dt><dd>{data.sourceDigest}</dd><dt>Start Digest</dt><dd>{data.startSourceDigest}</dd><dt>Funding Digest</dt><dd>{data.fundingSourceDigest}</dd></dl></details>
 <p>Participant names are not supplied by this reader. These Tournament IDs are not ACC membership numbers. Optional pools and payout policy are not evaluated here.</p></>}
 </section>;
}
