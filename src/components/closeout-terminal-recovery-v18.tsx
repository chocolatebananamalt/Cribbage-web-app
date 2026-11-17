'use client';
import{useEffect,useId,useLayoutEffect,useMemo,useRef,useState}from'react';
import{closeSame}from'../lib/finance/modern-event-close-contract-v1';
import type{FinanceDraftRetainedPortV1}from'../lib/finance/event-finance-draft-retained-v1';
import{trackAppRecoveryWrite}from'../lib/recovery-write-coordinator';
import type{CloseAttempt,CloseScope}from'../lib/finance/modern-event-close-contract-v1';
import{makeRetirementIntentV18,makeTerminalArchiveV18,readCloseRetainedV18,readCloseoutTerminalV18,readTerminalReplyV18,terminalReasonV18,type CloseoutTerminalV18}from'../lib/finance/closeout-terminal-contract-v18';

export type CloseoutRecoveryLeaseV18={signal:AbortSignal;valid:()=>boolean;release:()=>void;cancel:()=>void};
type Props={scope:CloseScope;attempt:CloseAttempt;retainedRaw:string;storage:FinanceDraftRetainedPortV1;retentionKey:string;url:string;writeVerified:boolean;busy:boolean;blocked:boolean;begin:()=>CloseoutRecoveryLeaseV18|null;onRetained:(raw:string)=>void;onArchived:()=>Promise<void>};
export function CloseoutTerminalRecoveryV18({scope,attempt,retainedRaw,storage,retentionKey,url,writeVerified,busy,blocked,begin,onRetained,onArchived}:Props){
 const reasonId=useId();
 const mounted=useRef(true),leaseRef=useRef<CloseoutRecoveryLeaseV18|null>(null),[reason,setReason]=useState(''),[approveRetire,setApproveRetire]=useState(false),[approveArchive,setApproveArchive]=useState(false),[proof,setProof]=useState<CloseoutTerminalV18|null>(null),[message,setMessage]=useState('Retirement needs a server-confirmed terminal outcome. Missing history or a timeout is not proof.');
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;leaseRef.current?.cancel();};},[]);
 const generation=useRef(0),[renderGeneration,setRenderGeneration]=useState(0),renderState=useMemo(()=>({generation:renderGeneration,scope,attempt,retainedRaw,writeVerified,blocked,reason,approveRetire,approveArchive,proof}),[renderGeneration,scope,attempt,retainedRaw,writeVerified,blocked,reason,approveRetire,approveArchive,proof]),committed=useRef<typeof renderState|null>(null);
 const changeIntent=()=>{generation.current++;setRenderGeneration(generation.current);};
 useLayoutEffect(()=>{committed.current=renderState;return()=>{if(committed.current===renderState)committed.current=null;};},[renderState]);
 const current=()=>committed.current===renderState&&generation.current===renderState.generation;
 const authorityCurrent=(ownNext:string|null=null)=>{const live=committed.current;return mounted.current&&generation.current===renderState.generation&&!!live&&!live.blocked&&live.writeVerified===renderState.writeVerified&&closeSame(live.scope,scope)&&closeSame(live.attempt,attempt)&&(live.retainedRaw===retainedRaw||ownNext!==null&&live.retainedRaw===ownNext)&&live.reason===reason&&live.approveRetire===approveRetire&&live.approveArchive===approveArchive;};
 const retained=readCloseRetainedV18(retainedRaw,scope),storedReason=retained?.retirementReason??null,validProof=readCloseoutTerminalV18(proof,attempt,storedReason),canAct=!busy&&!blocked&&!!retained;
 const run=async(action:'recover'|'retire')=>{if(!current()||!canAct||!navigator.onLine||action==='retire'&&(!writeVerified||!approveRetire||!terminalReasonV18(storedReason??reason)))return;const lease=begin();if(!lease)return;leaseRef.current=lease;let ownNext:string|null=null;const valid=()=>authorityCurrent(ownNext)&&lease.valid();let raw=retainedRaw;
  try{setProof(null);setApproveArchive(false);if(await storage.read(retentionKey)!==raw||!valid())throw Error('retention_changed');let current=readCloseRetainedV18(raw,scope);if(!current)throw Error('unknown_retained');
   if(action==='retire'&&current.retirementReason===null){const next=makeRetirementIntentV18(raw,scope,reason);if(!valid()||next===null||!await trackAppRecoveryWrite(()=>storage.transition(retentionKey,raw,next,undefined,lease.signal)))throw Error('retention_changed');raw=next;ownNext=next;if(!valid())throw Error('owner_changed');onRetained(raw);current=readCloseRetainedV18(raw,scope);if(!current)throw Error('invalid_intent');}
   if(await storage.read(retentionKey)!==raw||!valid())throw Error('retention_changed');
   const response=await fetch(url+'/terminal',{method:'POST',credentials:'same-origin',cache:'no-store',signal:lease.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({action,attempt:current.attempt,reason:action==='retire'?current.retirementReason:null})});if(!response.ok||!valid())throw Error('outcome_unknown');const reply=readTerminalReplyV18(await response.json(),current.attempt,current.retirementReason);if(!reply||!valid())throw Error('unbound_outcome');
   if(reply.status==='terminal'){setProof(reply.terminal);setMessage('The server confirmed this exact operation was retired without effect. Nothing local has been removed. Archive it explicitly to review current records again.');}
   else setMessage(reply.code==='existing_operation_requires_recovery'?'An existing operation needs normal recovery. Use Recover Exact Request; no retirement was assumed.':'No terminal outcome was verified. The exact request and any retirement intent remain retained.');
  }catch{if(mounted.current)setMessage('Retirement outcome could not be verified. All retained bytes remain. Recover Retirement Outcome before trying again.');}
  finally{if(mounted.current)setApproveRetire(false);lease.release();if(leaseRef.current===lease)leaseRef.current=null;}
 };
 const archive=async()=>{if(!current()||!canAct||!approveArchive||!validProof)return;const lease=begin();if(!lease)return;leaseRef.current=lease;try{
   const raw=makeTerminalArchiveV18(retainedRaw,scope,validProof);if(!raw||!lease.valid()||!authorityCurrent()||!closeSame(committed.current?.proof,proof)||await storage.read(retentionKey)!==retainedRaw||!authorityCurrent()||!lease.valid())throw Error('retention_changed');
   if(!await trackAppRecoveryWrite(()=>storage.transition(retentionKey,retainedRaw,null,{id:`${retentionKey}:terminal-v18:${attempt.operationId}`,raw},lease.signal)))throw Error('archive_conflict');
   if(mounted.current&&lease.valid())await onArchived();
  }catch{if(mounted.current)setMessage('Archive could not be completed safely. Pending work and existing history were preserved.');}
  finally{lease.release();if(leaseRef.current===lease)leaseRef.current=null;}
 };
 return <section aria-label="Exact Request Retirement"><h3>Exact Request Retirement</h3><p>This stops only this exact approval operation after the server proves it has no effect. It does not reverse an accepted approval, move money or approve changed results.</p><p role="status">{message}</p>
 <button type="button" disabled={!canAct} onClick={()=>void run('recover')}>Recover Retirement Outcome</button>
 {!validProof&&<><label htmlFor={reasonId}>Retirement Reason</label><textarea id={reasonId} value={storedReason??reason} maxLength={1000} disabled={busy||blocked||storedReason!==null||!writeVerified} onChange={e=>{changeIntent();setReason(e.target.value);setApproveRetire(false);}}/>
 {storedReason!==null&&<p>An exact retirement intent is retained. Its reason will not be replaced.</p>}
 <label><input type="checkbox" disabled={!canAct||!writeVerified} checked={approveRetire} onChange={e=>{changeIntent();setApproveRetire(e.target.checked);}}/>I request retirement of only this retained exact operation, if the server confirms no effect.</label>
 <button type="button" disabled={!canAct||!writeVerified||!approveRetire||!terminalReasonV18(storedReason??reason)} onClick={()=>void run('retire')}>{storedReason===null?'Request Safe Retirement':'Retry Exact Retirement'}</button></>}
 {validProof&&<><label><input type="checkbox" checked={approveArchive} disabled={!canAct} onChange={e=>{changeIntent();setApproveArchive(e.target.checked);}}/>I want to archive this retired request and review current records again.</label><button type="button" disabled={!canAct||!approveArchive} onClick={()=>void archive()}>Archive Retired Request and Review Again</button></>}
 </section>;
}
