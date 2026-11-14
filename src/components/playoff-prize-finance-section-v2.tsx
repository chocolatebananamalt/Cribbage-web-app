'use client';
import {PlayoffPrizeArchiveReaderV2} from '../lib/finance/playoff-prize-archive-v2';
import {PlayoffPrizeArchiveSectionV2} from './playoff-prize-archive-section-v2';
import {useId,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {PlayoffPrizeProposalReviewV2} from './playoff-prize-proposal-review-v2';
import {PlayoffPrizeFinanceOperationV2,type PlayoffPrizeBrowserPortV2} from '../lib/finance/playoff-prize-finance-operation-v2';
import {createPlayoffPrizeFinanceHttpV2} from '../lib/finance/playoff-prize-finance-http-v2';
import {createIndexedFinanceDraftRetainedV1,type FinanceDraftRetainedPortV1} from '../lib/finance/event-finance-draft-retained-v1';
import type {PlayoffPrizeBrowserScopeV2} from '../lib/api/playoff-prize-proposal-browser-v2';
import type {PlayoffPrizeProposalV2} from '../lib/results/playoff-prize-proposals-v2';
import './playoff-prize-finance-section-v2.css';
type Props={enabled?:boolean;scope:PlayoffPrizeBrowserScopeV2;role:string;port?:PlayoffPrizeBrowserPortV2;retained?:FinanceDraftRetainedPortV1;makeOperationId?:()=>string};
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
/** Private Finance candidate. Enabled only by explicit host composition; server
 * role/flags remain independent. No recipient approval or payment control. */
export function PlayoffPrizeFinanceSectionV2(props:Props){
 if(!props.enabled||!['director','co_director'].includes(props.role))return <section aria-label="Regular Prize Proposal"><p role="status">Regular prize proposal saving is unavailable. Existing records are unchanged.</p></section>;
 const s=props.scope;return <Connected key={`${s.actorId}:${s.tournamentId}:${s.eventId}`} {...props}/>;
}
function Connected({enabled=false,scope,port:injected,retained:storage,makeOperationId=()=>crypto.randomUUID()}:Props){
 const {actorId,tournamentId,eventId}=scope;const id=useId(),fixed=useMemo(()=>({actorId,tournamentId,eventId}),[actorId,tournamentId,eventId]);
 const port=useMemo(()=>injected??createPlayoffPrizeFinanceHttpV2(fixed,{enabled:()=>enabled}),[injected,fixed,enabled]);
 const retained=useMemo(()=>storage??createIndexedFinanceDraftRetainedV1(),[storage]);
 const operation=useMemo(()=>new PlayoffPrizeFinanceOperationV2(fixed,retained,port),[fixed,retained,port]);
 const archiveReader=useMemo(()=>new PlayoffPrizeArchiveReaderV2(fixed,retained,port.workspace),[fixed,retained,port]);
 const snapshot=useSyncExternalStore(operation.subscribe,operation.getSnapshot,operation.getSnapshot);
 const [edit,setEdit]=useState<{operation:PlayoffPrizeFinanceOperationV2;proposal:PlayoffPrizeProposalV2;mode:'append'|'adopt-current';generation:number;reviewedFingerprint:string;reviewedResolutionId?:string}|null>(null),[reason,setReason]=useState(''),[adoptConfirmed,setAdoptConfirmed]=useState(false),[message,setMessage]=useState('');
 const [rejection,setRejection]=useState({operationId:'',reason:'',confirmed:false});const latestRejection=useRef(rejection);
 const changeRejection=(next:typeof rejection)=>{latestRejection.current=next;setRejection(next);};
 const latestReason=useRef(reason),latestConfirmation=useRef(adoptConfirmed),latestEdit=useRef(edit);
 const changeReason=(v:string)=>{latestReason.current=v;setReason(v);};const changeConfirmation=(v:boolean)=>{latestConfirmation.current=v;setAdoptConfirmed(v);};const changeEdit=(v:typeof edit)=>{latestEdit.current=v;setEdit(v);};
 const lease=useRef({operation,snapshot,edit,reason,adoptConfirmed,rejection});useLayoutEffect(()=>{lease.current={operation,snapshot,edit,reason,adoptConfirmed,rejection};});
 useLayoutEffect(()=>{operation.setActive(true);void operation.initialize();return()=>operation.setActive(false);},[operation]);
 const workspace=snapshot.workspace,base=snapshot.prepared?snapshot.receipt?.result.status==='saved'?snapshot.receipt.result.head.proposal:null:workspace?.head?.proposal??workspace?.current?.proposal??null;
 const [resolutionBarrier,setResolutionBarrier]=useState<string|null>(null);
 const observedResolution=snapshot.resolvedRejection?.operationId??(snapshot.status==='rejected'&&snapshot.receipt?.result.status==='rejected'?snapshot.prepared?.request.operationId:undefined);if(observedResolution&&observedResolution!==resolutionBarrier)setResolutionBarrier(observedResolution);const requiredResolution=observedResolution??resolutionBarrier;
 const [pinnedBase,setPinnedBase]=useState<{proposal:PlayoffPrizeProposalV2;fingerprint:string}|null>(null);
 if(!pinnedBase&&base&&workspace)setPinnedBase({proposal:structuredClone(base),fingerprint:canonical({current:workspace.current,head:workspace.head})});
 const proposal=edit?.proposal??pinnedBase?.proposal??base,mode=edit?.mode==='adopt-current'&&workspace?.stale?'adopt-current':'append';
 const fingerprint=canonical({current:workspace?.current,head:workspace?.head}),reviewedFingerprint=edit?.reviewedFingerprint??pinnedBase?.fingerprint,reviewChanged=(!!reviewedFingerprint&&reviewedFingerprint!==fingerprint)||(!!requiredResolution&&edit?.reviewedResolutionId!==requiredResolution);
 const current=workspace?.current?.proposal,canEdit=snapshot.status==='ready'&&!snapshot.busy&&!!current&&(!workspace?.stale||mode==='adopt-current')&&!reviewChanged;
 const stillCurrent=()=>lease.current.operation===operation&&lease.current.snapshot===snapshot&&lease.current.edit===edit&&lease.current.reason===reason&&latestReason.current===reason&&latestEdit.current===edit&&lease.current.adoptConfirmed===adoptConfirmed&&latestConfirmation.current===adoptConfirmed&&lease.current.rejection===rejection&&latestRejection.current===rejection;
 const rejectedId=snapshot.status==='rejected'?snapshot.prepared?.request.operationId??'':'',resolution=rejection.operationId===rejectedId?rejection:{operationId:rejectedId,reason:'',confirmed:false};
 function save(){if(!stillCurrent()||!canEdit||!workspace||!proposal||!reason.trim())return;try{void operation.save(workspace,proposal,reason,mode,makeOperationId(),snapshot);}catch{setMessage('An operation ID could not be created. No request was sent.');}}
 return <section className="playoff-prize-finance-section-v2" aria-labelledby={`${id}-title`} aria-busy={snapshot.busy}><h2 id={`${id}-title`}>Regular Prize Proposal</h2>
  <p>Saved proposals retain an audit history. They do not approve recipients, record a disbursement or move money. Fee coverage, fund review and final payouts remain separate.</p>
  <p role="status" aria-live="polite">{snapshot.message||'Checking the account and current source.'}</p>{message&&<p role="status">{message}</p>}
  {workspace?.head&&<p>Last Saved: <time dateTime={workspace.head.createdAt}>{workspace.head.createdAt}</time> · Version {workspace.head.version}. This is the server-recorded proposal time.</p>}
  {proposal&&<PlayoffPrizeProposalReviewV2 key={`${edit?.generation??0}`} retained={proposal} expectedCurrent={canEdit&&current?{source:current.source,input:current.input}:null} onChange={(next,previous)=>{if(stillCurrent()&&canEdit&&canonical(proposal)===canonical(previous))changeEdit({operation,proposal:next,mode,generation:edit?.generation??0,reviewedFingerprint:fingerprint,reviewedResolutionId:requiredResolution??undefined});}}/>}
  {reviewChanged&&<p role="status">The reviewed source or saved head changed. Your local proposal remains visible and locked. Load the saved proposal explicitly before editing again.</p>}
  {reviewChanged&&snapshot.status==='ready'&&workspace?.head&&<button type="button" onClick={()=>{if(!stillCurrent()||!workspace.head)return;changeEdit({operation,proposal:structuredClone(workspace.head.proposal),mode:'append',generation:(edit?.generation??0)+1,reviewedFingerprint:fingerprint,reviewedResolutionId:requiredResolution??undefined});changeReason('');}}>Load Saved Proposal</button>}
  {snapshot.prepared&&!proposal&&<p>Exact pending data is retained. Its proposed history will be shown only after a verified server receipt; no current proposal is substituted.</p>}
  {workspace?.current&&(workspace.stale||(!workspace.head&&reviewChanged))&&snapshot.status==='ready'&&(mode!=='adopt-current'||reviewChanged)&&<fieldset><legend>Changed Source Review</legend><p>Prior saved history remains intact. Starting a new review uses the current source with no carried adjustments and discards unsubmitted text in this view.</p><label><input type="checkbox" checked={adoptConfirmed} onChange={e=>changeConfirmation(e.target.checked)}/>I understand and want a new review of the changed source.</label><button type="button" disabled={!adoptConfirmed||snapshot.busy} onClick={()=>{if(!stillCurrent()||!adoptConfirmed||!workspace.current)return;changeEdit({operation,proposal:structuredClone(workspace.current.proposal),mode:workspace.head&&workspace.stale?'adopt-current':'append',generation:(edit?.generation??0)+1,reviewedFingerprint:fingerprint,reviewedResolutionId:requiredResolution??undefined});changeReason('');changeConfirmation(false);}}>Review Current Source</button></fieldset>}
  {snapshot.status==='rejected'&&snapshot.receipt?.result.status==='rejected'&&<fieldset><legend>Resolve Confirmed Rejection</legend>
   <p>The server recorded this request as rejected ({snapshot.receipt.result.code}). This action preserves the original request and receipt in the device audit, then returns to current-source review. It does not retry the rejected changes or approve payouts.</p>
   <label htmlFor={`${id}-rejection-reason`}>Resolution Reason <span>(Required)</span></label><textarea id={`${id}-rejection-reason`} maxLength={2000} value={resolution.reason} disabled={snapshot.busy} onChange={e=>changeRejection({...resolution,reason:e.target.value})}/>
   <label><input type="checkbox" checked={resolution.confirmed} disabled={snapshot.busy} onChange={e=>changeRejection({...resolution,confirmed:e.target.checked})}/>I want to archive this confirmed rejection and review the current source.</label>
   <button type="button" disabled={snapshot.busy||!resolution.confirmed||!resolution.reason.trim()} onClick={()=>{if(stillCurrent()&&resolution.confirmed&&resolution.reason.trim())void operation.resolveRejected(resolution.reason,true,snapshot);}}>Archive Confirmed Rejection</button>
  </fieldset>}
  {snapshot.resolvedRejection&&<details><summary>Archived Rejection</summary><p>Operation {snapshot.resolvedRejection.operationId}; result {snapshot.resolvedRejection.code}. Resolution reason: {snapshot.resolvedRejection.reason}. The exact request and receipt remain in the immutable device audit; the server rejection record is unchanged.</p></details>}
  <label htmlFor={`${id}-reason`}>Reason for Saving <span>(Required)</span></label><textarea id={`${id}-reason`} maxLength={2000} value={reason} onChange={e=>changeReason(e.target.value)} disabled={!canEdit}/>
  <div className="prize-finance-actions"><button type="button" disabled={!canEdit||!proposal||!reason.trim()} onClick={save}>Save Prize Proposal</button>
   {snapshot.prepared&&<><button type="button" disabled={snapshot.busy} onClick={()=>{if(stillCurrent())void operation.recover(snapshot);}}>Check Save Outcome</button>{snapshot.status==='pending'&&<button type="button" disabled={snapshot.busy} onClick={()=>{if(stillCurrent())void operation.retryExact(snapshot);}}>Retry Exact Save</button>}</>}
   {snapshot.status==='saved'&&<button type="button" disabled={snapshot.busy} onClick={()=>{if(stillCurrent())void operation.verifyAndArchive(snapshot);}}>Verify Saved Proposal</button>}
  </div><p>Unsubmitted edits stay in this view only. After Save, the exact pending request is retained on this device before it is sent. Unknown outcomes stay locked. Confirmed rejected requests can be archived only through the reasoned resolution control above.</p>
  <PlayoffPrizeArchiveSectionV2 reader={archiveReader} enabled={enabled}/>
 </section>;
}
