'use client';
import {useLayoutEffect,useState,useSyncExternalStore} from 'react';
import {PlayoffPrizeArchiveReaderV2,type PlayoffPrizeArchiveCopyV2} from '../lib/finance/playoff-prize-archive-v2';
import {formatFinanceMoneyV1 as money} from '../lib/finance/format-finance-money-v1';
import {calculatePlayoffPrizeProposalsV2} from '../lib/results/playoff-prize-proposals-v2';
function CopyDetail({copy}:{copy:PlayoffPrizeArchiveCopyV2}){
 const [page,setPage]=useState(0),history=copy.prepared.request.overrideHistory,shown=history.slice(page*20,page*20+20);
 const head=copy.receipt.result.status==='saved'?copy.receipt.result.head:null,proposal=head?.proposal,calculated=proposal?calculatePlayoffPrizeProposalsV2(proposal,{source:proposal.source,input:proposal.input}):null;
 return <section aria-label="Selected Device Archive"><h4>{copy.kind==='saved-copy'?'Saved Receipt Copy':'Rejected Request Copy'}</h4><p>Local consistency checks passed. This is not a signed server record, current approval or proof of payment.</p>
  <dl><dt>Operation ID</dt><dd>{copy.prepared.request.operationId}</dd><dt>Save Reason</dt><dd>{copy.prepared.request.reason}</dd><dt>Original Source Digest</dt><dd>{copy.prepared.request.nativeSourceDigest}</dd><dt>Retained Adjustment Records</dt><dd>{history.length}</dd>
  {head&&<><dt>Receipt-Reported Save Time</dt><dd><time dateTime={head.createdAt}>{head.createdAt}</time></dd><dt>Saved Version</dt><dd>{head.version}</dd></>}
  {copy.receipt.result.status==='rejected'&&<><dt>Recorded Rejection</dt><dd>{copy.receipt.result.code}</dd><dt>Local Resolution Reason</dt><dd>{copy.resolutionReason}</dd></>}
  {calculated?.status==='proposal_review'&&<><dt>Historical Source Fund</dt><dd>{money(calculated.input.fundMinor)}</dd><dt>Historical Proposed Total</dt><dd>{money(calculated.proposedTotalMinor)}</dd></>}</dl>
  {history.length>0&&<><h5>Retained Adjustment History</h5><p>Original records, including corrections and voids. These are not applied to the current proposal.</p><ol start={page*20+1}>{shown.map(r=><li key={r.recordId}>Places {r.firstPlace}-{r.lastPlace}: {money(r.perPersonMinor)} per person{r.voided?' (voided record)':''}. Reason: {r.reason}</li>)}</ol><div className="prize-finance-actions"><button type="button" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>Previous Records</button><button type="button" disabled={(page+1)*20>=history.length} onClick={()=>setPage(p=>p+1)}>Next Records</button></div></>}
 </section>;
}
/** Read-only device audit view. No deletion, import, replay or approval control. */
export function PlayoffPrizeArchiveSectionV2({reader,enabled=false}:{reader:PlayoffPrizeArchiveReaderV2;enabled?:boolean}){
 const snapshot=useSyncExternalStore(reader.subscribe,reader.getSnapshot,reader.getSnapshot),[selected,setSelected]=useState<string|null>(null);
 useLayoutEffect(()=>{reader.setActive(enabled);return()=>reader.setActive(false);},[reader,enabled]);
 if(!enabled)return null;const selectedCopy=snapshot.entries.find(e=>e.id===selected)?.copy;
 return <section className="prize-device-archive" aria-label="Device Proposal Archive" aria-busy={snapshot.status==='loading'}><h3>Device Proposal Archive</h3><p>Read-only copies for this account and event on this device. Sorted by archive ID, not date. Refresh to find newly archived records. Current proposals and server history are separate.</p>
 <div className="prize-finance-actions"><button type="button" disabled={snapshot.status==='loading'} onClick={()=>void reader.load(null,snapshot)}>{snapshot.status==='idle'?'Load Device Archive':'Refresh Archive From Start'}</button>{snapshot.nextCursor&&<button type="button" disabled={snapshot.status==='loading'} onClick={()=>void reader.load(snapshot.nextCursor,snapshot)}>Next Archive Page</button>}</div>
 <p role="status" aria-live="polite">{snapshot.message}</p><ul>{snapshot.entries.map(e=><li key={e.id}>{e.copy?<button type="button" onClick={()=>setSelected(e.id)}>{e.copy.kind==='saved-copy'?'Saved Receipt':'Rejected Request'} · {e.copy.prepared.request.operationId}</button>:<p>Unverified archive entry: {e.id}. It remains unchanged and cannot be used as a receipt.</p>}</li>)}</ul>
 {selectedCopy&&<CopyDetail key={selectedCopy.id} copy={selectedCopy}/>}
 </section>;
}
