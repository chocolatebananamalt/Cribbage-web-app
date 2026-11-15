"use client";
import {useLayoutEffect,useRef,useMemo,useId,useState,useSyncExternalStore} from 'react';
import {EventFinanceSectionV1} from './event-finance-section-v1';
import {projectEventFinanceSectionV1,type EventFinanceEditorV1,type EventFinanceActionV1} from '../lib/finance/event-finance-workspace-v1';
import type {FinanceProviderUiWorkspaceV1} from '../lib/finance/operational-finance-provider-ui-v1';
import {isRestorableEventFinanceEditorV1} from '../lib/finance/event-finance-draft-codec-v1';
import {isEventFinanceWorkspaceV1} from '../lib/finance/event-finance-workspace-v1';
import type {FinanceProviderOperationV1} from '../lib/finance/finance-provider-operation-v1';
import styles from './event-finance-recovered-section-v1.module.css';
type Props={enabled?:boolean;workspace:FinanceProviderUiWorkspaceV1;editor:EventFinanceEditorV1;operation:FinanceProviderOperationV1;onAction:(action:EventFinanceActionV1,expected:EventFinanceEditorV1)=>void;makeOperationId:()=>string;readSavedWorkspace?:()=>Promise<FinanceProviderUiWorkspaceV1>;onSavedWorkspaceVerified?:(workspace:FinanceProviderUiWorkspaceV1,expectedEditor:EventFinanceEditorV1)=>void};
type VerificationOwner=Pick<Props,'workspace'|'editor'|'operation'>;
/** Candidate host only. The page must supply a trusted authenticated workspace,
 * a fixed-scope durable operation port and a retained device editor. No page
 * enables this candidate until provider and storage acceptance are complete.
 * Host requirement: reuse the SAME operation object for this account/event,
 * while a save/readback/archive is in flight. Settled new-client archives keep
 * a local checkpoint for new instances. Legacy null records cannot prove no
 * earlier archive; authenticated fresh-workspace and actual storage/reload
 * acceptance remain required before enabling this candidate. */
export function EventFinanceProviderSectionV1(props:Props){
 const scope=props.workspace.scope;const scoped=(w:{source:{tournamentId:string;eventId:string};payoutSource:{tournamentId:string;eventId:string}})=>w.source.tournamentId===scope.tournamentId&&w.source.eventId===scope.eventId&&w.payoutSource.tournamentId===scope.tournamentId&&w.payoutSource.eventId===scope.eventId;
 if(!props.enabled||!props.operation.matchesScope(scope)||!isEventFinanceWorkspaceV1(props.workspace.current)||!scoped(props.workspace.current)||!isRestorableEventFinanceEditorV1(props.editor)||!scoped(props.editor.basis))return <section aria-label="Finance Provider"><p role="status">Server Finance editing is unavailable. Retained proposals are unchanged.</p></section>;
 const s=props.workspace.scope;return <Connected key={`${s.actorId}:${s.tournamentId}:${s.eventId}`} {...props}/>;
}
function Connected({workspace,editor,operation,onAction,makeOperationId,readSavedWorkspace,onSavedWorkspaceVerified}:Props){
 const id=useId(),[reason,setReason]=useState('');
 const verificationRun=useRef<VerificationOwner|null>(null);
 const [verification,setVerification]=useState<{owner:VerificationOwner|null;busy:boolean;message:string;head:null|{revisionId:string|null;version:number;sourceDigest:string;basisDigest:string}}>({owner:null,busy:false,message:'',head:null});
 const snapshot=useSyncExternalStore(operation.subscribe,operation.getSnapshot,()=>null);
 const lease=useMemo(()=>({workspace,editor,operation,snapshot,reason}),[workspace,editor,operation,snapshot,reason]);const activeLease=useRef<typeof lease|null>(null);
 useLayoutEffect(()=>{activeLease.current=lease;return()=>{if(activeLease.current===lease)activeLease.current=null;};},[lease]);
 useLayoutEffect(()=>{operation.setActive(true);void operation.initialize();return()=>operation.setActive(false);},[operation]);
 const current=()=>activeLease.current===lease&&operation.matchesScope(workspace.scope)&&operation.getSnapshot()===snapshot;
 const verificationLocked=()=>verificationRun.current!==null;
 const verifying=verification.busy;
 const view=projectEventFinanceSectionV1(editor,workspace.current);
 const reviewedHead=verification.head;
 const awaitingReviewedWorkspace=operation.requiresVerifiedWorkspace(workspace)||!!reviewedHead&&(workspace.headRevisionId!==reviewedHead.revisionId||workspace.version!==reviewedHead.version||workspace.sourceDigest!==reviewedHead.sourceDigest||workspace.basisDigest!==reviewedHead.basisDigest);
 const canEdit=workspace.editable&&!view.blocked&&snapshot?.status==='ready'&&!snapshot.busy&&!verifying&&!awaitingReviewedWorkspace;
 const displayed={...view,blocked:view.blocked||!canEdit};
 const save=()=>{if(current()&&!verificationLocked()&&canEdit&&reason.trim()&&snapshot)void operation.save(workspace,editor,makeOperationId(),reason,snapshot);};
 async function verifySavedProposal(){
  if(!current()||snapshot?.status!=='accepted'||snapshot.busy||!readSavedWorkspace||verificationLocked())return;
  const run={workspace,editor,operation};verificationRun.current=run;
  setVerification(old=>({...old,owner:run,busy:true,message:'Checking the saved proposal against a fresh account-bound readback.'}));
  const sameOwner=()=>{const active=activeLease.current;return !!active&&active.workspace===workspace&&active.editor===editor&&active.operation===operation;};
  try{
   const fresh=structuredClone(await readSavedWorkspace());
   if(!current()||verificationRun.current!==run)return;
   const archived=await operation.archiveAccepted(fresh,snapshot);
   // A successful archive must retain its head barrier even if props changed
   // during that await. It may not replace a changed editor through the host.
   if(verificationRun.current!==run||!activeLease.current)return;
   if(archived?.status==='archived'&&archived.operationId===snapshot.operationId){
    setVerification({owner:run,busy:false,message:'Saved proposal verified. The pending operation was archived. Review the refreshed workspace before another save.',head:archived.head});
    if(sameOwner())try{onSavedWorkspaceVerified?.(fresh,editor);}catch{/* Keep the verified head and retained editor; a host callback must not undo recovery. */}
   }else setVerification(old=>old.owner===run?{...old,busy:false,message:'The exact saved head could not be verified and archived. Recovery remains required; no new proposal was sent.'}:old);
  }catch{if(verificationRun.current===run&&sameOwner())setVerification(old=>old.owner===run?{...old,busy:false,message:'Saved-proposal readback or recovery could not be completed. Retained work is unchanged; no new proposal was sent.'}:old);}
  finally{if(verificationRun.current===run){verificationRun.current=null;if(activeLease.current)setVerification(old=>old.owner===run&&old.busy?{...old,busy:false,message:sameOwner()?old.message:'Workspace changed during verification. Retained work is unchanged; check the saved proposal again.'}:old);}}
 }
 return <section aria-label="Finance Provider Proposal" aria-busy={verifying}>
  <div className={styles.panel}><h2>Server Proposal</h2>
   <p>This saves proposed amounts only. It does not record an expense, verify income, approve an award or make a payment. Device drafts and server proposals are separate.</p>
   <p role="status" aria-live="polite">{snapshot?.status==='accepted'?'The server accepted this proposal operation. Current-source readback is still required before starting another save.':snapshot?.status==='outcome_unknown'?'Save outcome is not yet known. Keep the exact pending operation intact.':snapshot?.status==='rejected'?'The server rejected this operation. Retained work is unchanged.':canEdit?'Ready to prepare a proposal save.':'Server saving is blocked while recovery or source checks are incomplete.'}</p>
   {verification.message&&<p role="status" aria-live="polite">{verification.busy&&!verifying?'Workspace changed during verification. Retained work is unchanged; check the saved proposal again.':verification.message}</p>}
   {awaitingReviewedWorkspace&&<p role="status">A refreshed workspace matching the verified saved head is required. Existing editor contents have not been replaced.</p>}
   {!workspace.editable&&<p role="alert">Source records changed. The saved proposal is retained; its basis cannot be replaced here.</p>}
   <label className={styles.proposalForm} htmlFor={`${id}-reason`}>Reason for Saving (Required)<textarea id={`${id}-reason`} required maxLength={2000} disabled={!canEdit} value={reason} onChange={event=>setReason(event.target.value)}/></label>
   <div className={styles.actions}>
    {snapshot?.status==='accepted'&&readSavedWorkspace&&<button type="button" disabled={snapshot.busy||verifying} onClick={()=>void verifySavedProposal()}>Verify Saved Proposal</button>}
    {snapshot?.status==='accepted'&&!readSavedWorkspace&&<p>The host must supply an authenticated readback before this save can be verified.</p>}
    <button type="button" disabled={!canEdit||!reason.trim()||!!editor.lineForm||!!editor.bandForm||view.payoutReview?.status==='review_required'||view.payoutReview?.status==='blocked'} onClick={save}>Save Proposal to Server</button>
    <button type="button" disabled={!snapshot||snapshot.busy||verifying||!snapshot.operationId} onClick={()=>{if(current()&&!verificationLocked()&&snapshot)void operation.check(snapshot);}}>Check This Save</button>
    {snapshot?.status==='outcome_unknown'&&<button type="button" disabled={snapshot.busy||verifying} onClick={()=>{if(current()&&!verificationLocked())void operation.retryExact(snapshot);}}>Retry the Same Save</button>}
    {(snapshot?.status==='blocked'||snapshot?.status==='outcome_unknown')&&<button type="button" disabled={snapshot.busy||verifying} onClick={()=>{if(current()&&!verificationLocked())void operation.rediscover();}}>Check Retained Operation</button>}
   </div>
   {snapshot?.status==='outcome_unknown'&&<p>Check Retained Operation rechecks this device without sending the proposal again.</p>}
  </div>
  <EventFinanceSectionV1 enabled view={displayed} onAction={(action,expected)=>{if(current()&&!verificationLocked()&&canEdit&&expected===displayed)onAction(action,editor);}}/>
 </section>;
}
