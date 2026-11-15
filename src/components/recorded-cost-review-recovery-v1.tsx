"use client";
import{useLayoutEffect,useMemo,useRef,useState,useCallback,useSyncExternalStore}from'react';
import{RecordedCostReviewV1}from'./recorded-cost-review-v1';
import type{RecordedCostReviewControllerV1,RecordedCostReviewScopeV1}from'../lib/finance/recorded-cost-review-controller-v1';
import type{NativeCostAdoptionOperationV1}from'../lib/finance/native-cost-adoption-operation-v1';
import type{FinanceDraftRetainedPortV1}from'../lib/finance/event-finance-draft-retained-v1';
import type{FinanceProviderUiWorkspaceV1}from'../lib/finance/operational-finance-provider-ui-v1';
import styles from'./event-finance-recovered-section-v1.module.css';
type Props={enabled?:boolean;scope:RecordedCostReviewScopeV1;controller:RecordedCostReviewControllerV1;operation:NativeCostAdoptionOperationV1;retained:FinanceDraftRetainedPortV1;makeOperationId:()=>string;readCurrentFinance?:()=>Promise<FinanceProviderUiWorkspaceV1>};
type DraftStatus='checking'|'ready'|'saving'|'outcome_unknown'|'blocked';
/** Local candidate only. A real page must supply an authenticated current source,
 * the fixed-scope operation and reviewed storage/HTTP ports. Default-off. */
export function RecordedCostReviewRecoveryV1(props:Props){
 if(!props.enabled||!props.controller.matchesScope(props.scope)||!props.operation.matchesScope(props.scope))return <section aria-label="Recorded Cost Recovery"><p role="status">Recorded-cost recovery is unavailable. Retained work is unchanged.</p></section>;
 const s=props.scope;return <OwnerScope key={`${s.actorId}:${s.tournamentId}:${s.eventId}`} {...props}/>;
}
function OwnerScope(props:Props){
 const[owned,setOwned]=useState(()=>({controller:props.controller,operation:props.operation,retained:props.retained,revision:0}));
 if(owned.controller!==props.controller||owned.operation!==props.operation||owned.retained!==props.retained){setOwned({controller:props.controller,operation:props.operation,retained:props.retained,revision:owned.revision+1});return <p role="status">Checking the replacement recovery owner.</p>;}
 return <Connected key={owned.revision} {...props}/>;
}
function Connected({scope,controller,operation,retained,makeOperationId,readCurrentFinance}:Props){
 const view=useSyncExternalStore(controller.subscribe,controller.getSnapshot,()=>null),op=useSyncExternalStore(operation.subscribe,operation.getSnapshot,()=>null);
 const[draftState,setDraftState]=useState<{owner:object|null;status:DraftStatus}>({owner:null,status:'checking'}),[message,setMessage]=useState('Checking the matching device review.'),[completed,setCompleted]=useState(false);
 const raw=useRef<string|null>(null),attempt=useRef<{raw:string;expected:string|null;archive?:{id:string;raw:string}}|null>(null),flight=useRef(false);
 const key=`recorded-cost-review-draft-v1:${scope.actorId}:${scope.tournamentId}:${scope.eventId}`;
 const scopeKey=`${scope.actorId}:${scope.tournamentId}:${scope.eventId}`;
 const owner=useMemo(()=>({scopeKey,controller,operation,retained}),[scopeKey,controller,operation,retained]),active=useRef<{owner:typeof owner;abort:AbortController}|null>(null);
 const status=draftState.owner===owner?draftState.status:'checking';
 const setStatus=useCallback((value:DraftStatus)=>setDraftState({owner,status:value}),[owner]);
 const current=(activation=active.current)=>activation!==null&&active.current===activation&&activation.owner===owner&&controller.matchesScope(scope)&&operation.matchesScope(scope);
 useLayoutEffect(()=>{
  const activation={owner,abort:new AbortController()};active.current=activation;controller.setActive(true);operation.setActive(true);flight.current=true;
  void(async()=>{try{await operation.initialize();if(active.current!==activation)return;if(!controller.getSnapshot()){setStatus('blocked');setMessage('Current recorded-cost evidence is unavailable. Stored reviews remain untouched.');return;}const saved=await retained.read(key);if(active.current!==activation||!controller.getSnapshot())return;if(saved!==null&&saved!==controller.serializeDraft()&&!controller.restoreDraft(saved)){setStatus('blocked');setMessage('The stored review could not replace this review safely. Both copies remain intact.');return;}raw.current=saved;setStatus('ready');setMessage(saved===null?'No saved device review was found.':'The saved device review is retained. No adoption or payment is inferred.');}catch{if(active.current===activation){setStatus('blocked');setMessage('Device review recovery is unavailable. Stored work is retained.');}}finally{if(active.current===activation)flight.current=false;}})();
  return()=>{if(active.current===activation){active.current=null;activation.abort.abort();flight.current=false;controller.setActive(false);operation.setActive(false);}};
 },[owner,controller,operation,retained,key,setStatus]);
 const lease=useMemo(()=>({owner,view,op,status,completed,readCurrentFinance,makeOperationId}),[owner,view,op,status,completed,readCurrentFinance,makeOperationId]),latest=useRef<typeof lease|null>(null);
 useLayoutEffect(()=>{latest.current=lease;return()=>{if(latest.current===lease)latest.current=null;};},[lease]);
 const live=()=>current()&&latest.current===lease&&controller.getSnapshot()===view&&operation.getSnapshot()===op;
 async function persistDraft(activation:NonNullable<typeof active.current>){
  const serialized=controller.serializeDraft();if(!serialized)throw Error('review_not_serializable');
  if(serialized===raw.current){if(await retained.read(key)!==serialized)throw Error('device_review_conflict');return current(activation);}
  const target={raw:serialized,expected:raw.current,...(raw.current===null?{}:{archive:{id:`recorded-cost-review-history-v1:${scope.actorId}:${scope.tournamentId}:${scope.eventId}:${makeOperationId()}`,raw:raw.current}})};attempt.current=target;
  if(!await retained.transition(key,target.expected,target.raw,target.archive,activation.abort.signal)){attempt.current=null;throw Error('device_review_conflict');}
  if(!current(activation))return false;
  if(await retained.read(key)!==target.raw)throw Error('device_review_readback_unknown');
  if(!current(activation))return false;raw.current=target.raw;attempt.current=null;return true;
 }
 async function save(submit:boolean){
  if(!live()||flight.current||status!=='ready'||!view||op?.status!=='ready'||completed||submit&&!view.canSubmit)return;
  const activation=active.current!;flight.current=true;setStatus('saving');setMessage('Saving the full review on this device before any server request.');const captured=view;
  try{if(!await persistDraft(activation))return;if(!current(activation)||controller.getSnapshot()!==captured){if(current(activation)){setStatus('ready');setMessage('An earlier review was saved; current changes remain unsaved.');}return;}setStatus('ready');if(submit){const request=controller.prepareRequest(captured,makeOperationId());if(!request)throw Error('review_changed');const expected=operation.getSnapshot();if(expected.status!=='ready')throw Error('operation_changed');await operation.save(request,expected);if(current(activation))setMessage('Check the operation receipt. A pending request is not a completed adoption.');}else setMessage('The complete review draft is saved on this device only.');}
  catch{if(current(activation)){setStatus(attempt.current?'outcome_unknown':'blocked');setMessage('The device save outcome needs checking. No new server request was sent from an unverified device draft.');}}
  finally{if(current(activation))flight.current=false;}
 }
 async function checkDraft(){
  if(!live()||flight.current)return;const activation=active.current!;flight.current=true;setStatus('checking');try{const saved=await retained.read(key);if(!current(activation)||!controller.getSnapshot())return;const target=attempt.current;if(target){if(saved!==target.raw)throw Error('device_copy_differs');raw.current=saved;attempt.current=null;}else if(saved!==null&&saved!==controller.serializeDraft()&&!controller.restoreDraft(saved))throw Error('device_copy_differs');else raw.current=saved;setStatus('ready');setMessage('The matching device copy was checked. No server result is inferred.');}catch{if(current(activation)){setStatus('blocked');setMessage('The stored and in-memory reviews are retained; they could not be safely reconciled.');}}finally{if(current(activation))flight.current=false;}
 }
 async function checkOperation(){if(!live()||!op||op.busy||flight.current)return;const activation=active.current!;flight.current=true;try{await operation.check(op);if(current(activation))setMessage('Operation receipt checked; current-source readback is a separate step.');}finally{if(current(activation))flight.current=false;}}
 async function confirmReadback(){if(!live()||!op||op.status!=='accepted'||!readCurrentFinance||flight.current)return;const activation=active.current!;flight.current=true;setStatus('checking');setMessage('Checking the current source before archiving the accepted receipt.');try{const fresh=await readCurrentFinance();if(!current(activation))return;const expected=operation.getSnapshot();if(expected.status!=='accepted'){setMessage('The operation changed while current records were checked. Its retained state must be reviewed.');return;}await operation.archiveAccepted(fresh,expected);if(!current(activation))return;if(operation.getSnapshot().status==='ready'){setCompleted(true);setMessage('The accepted operation and exact current head matched. Its receipt is archived; the review draft remains on this device.');}else setMessage('Current-source readback did not match. The pending request and review remain intact.');}catch{if(current(activation))setMessage('Current-source readback is unavailable. The accepted receipt and review remain intact.');}finally{if(current(activation)){flight.current=false;setStatus('ready');}}}
 async function archiveRejection(){if(!live()||!op||op.status!=='rejected'||flight.current)return;const activation=active.current!;flight.current=true;try{await operation.archiveRejected(op);if(!current(activation))return;if(operation.getSnapshot().status==='ready'){const now=controller.getSnapshot();if(now)controller.dispatch({type:'reviewed',value:false},now);setMessage('Rejected operation archived. The review draft remains; check current sources before another submission.');}else setMessage('Rejection archival is not confirmed. The pending operation and review remain intact.');}finally{if(current(activation))flight.current=false;}}
 const locked=status!=='ready'||op?.status!=='ready'||completed||!view;
 const shown=view?{...view,status:locked?'pending' as const:view.status,busy:status==='saving'||status==='checking'||!!op?.busy,canSubmit:!locked&&view.canSubmit}:null;
 return <section aria-label="Recorded Cost Review with Recovery"><div className={styles.panel}><h2>Recorded-Cost Review Recovery</h2><p role="status" aria-live="polite">{message}</p><p>Device draft: {status}. Server operation: {op?.status??'checking'}. Neither status proves payment or remittance.</p><div className={styles.actions}>
  <button type="button" disabled={!view||locked} onClick={()=>void save(false)}>Save Review on This Device</button>
  <button type="button" disabled={status==='saving'||status==='checking'||!!op?.busy} onClick={()=>void checkDraft()}>Check Saved Device Review</button>
  <button type="button" disabled={!op?.operationId||op.busy} onClick={()=>void checkOperation()}>Check Adoption Result</button>
  {op?.status==='outcome_unknown'&&<button type="button" disabled={op.busy} onClick={()=>{if(live())void operation.retryExact(op);}}>Retry the Same Adoption</button>}
  {op?.status==='blocked'&&<button type="button" disabled={op.busy} onClick={()=>{if(live())void operation.rediscover();}}>Check Retained Adoption Request</button>}
  {op?.status==='accepted'&&<button type="button" disabled={!readCurrentFinance||op.busy} onClick={()=>void confirmReadback()}>Verify Current Head and Keep Receipt</button>}
  {op?.status==='rejected'&&<button type="button" disabled={op.busy} onClick={()=>void archiveRejection()}>Keep Rejected Operation in History</button>}
 </div></div><RecordedCostReviewV1 enabled view={shown} onAction={(action,expected)=>{if(!live()||expected!==shown||!view||locked)return;if(action.type==='submit')void save(true);else controller.dispatch(action,view);}}/></section>;
}
