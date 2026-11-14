"use client";
import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import {RecordedCostReviewRecoveryV1} from './recorded-cost-review-recovery-v1';
import {prepareRecordedCostAdoptionPageV1,type RecordedCostAdoptionPagePortsV1} from '../lib/finance/recorded-cost-adoption-page-v1';
import {createFinanceProviderHttpV1} from '../lib/finance/finance-provider-http-v1';
import {createNativeCostAdoptionHttpV1} from '../lib/finance/native-cost-adoption-http-v1';
import {createIndexedFinanceDraftRetainedV1,type FinanceDraftRetainedPortV1} from '../lib/finance/event-finance-draft-retained-v1';
import type {FinanceProviderScopeV1} from '../lib/finance/operational-finance-provider-ui-v1';
import {NativeFundReviewSectionV1} from './native-fund-review-section-v1';
import styles from './recorded-cost-adoption-page-v1.module.css';
type Ready=Extract<Awaited<ReturnType<typeof prepareRecordedCostAdoptionPageV1>>,{status:'ready'}>;
type Props={enabled?:boolean;scope:FinanceProviderScopeV1;role:string;ports?:RecordedCostAdoptionPagePortsV1;retained?:FinanceDraftRetainedPortV1};
/** Candidate page composition only. Both server route and browser entry remain
 * disabled; injected test ports establish no actual authentication authority. */
export function RecordedCostAdoptionPageV1(props:Props){
 const scopeKey=`${props.scope.actorId}:${props.scope.tournamentId}:${props.scope.eventId}`;
 return <PageOwner key={scopeKey} {...props}/>;
}
function PageOwner({enabled=false,scope,role,ports:injectedPorts,retained:injectedRetained}:Props){
 const {actorId,tournamentId,eventId}=scope;
 const fixed=useMemo(()=>({actorId,tournamentId,eventId}),[actorId,tournamentId,eventId]);
 const retained=useMemo(()=>injectedRetained??createIndexedFinanceDraftRetainedV1(),[injectedRetained]);
 const ports=useMemo(()=>{if(injectedPorts)return injectedPorts;const finance=createFinanceProviderHttpV1(fixed,{enabled:()=>enabled}),adoption=createNativeCostAdoptionHttpV1(fixed,{enabled:()=>enabled});return{finance:finance.workspace,adoption:adoption.workspace,operation:adoption.operation};},[injectedPorts,fixed,enabled]);
 const owner=useMemo(()=>({enabled,role,fixed,ports,retained}),[enabled,role,fixed,ports,retained]);
 const active=useRef<{owner:typeof owner;ready:Ready|null;loading:boolean}|null>(null);
 const[state,setState]=useState<{owner:typeof owner|null;status:'idle'|'loading'|'blocked'|'ready';message:string;ready:Ready|null}>({owner:null,status:'idle',message:'',ready:null});
 const visible=state.owner===owner?state:null;
 useLayoutEffect(()=>{const activation={owner,ready:null as Ready|null,loading:false};active.current=activation;return()=>{if(active.current===activation)active.current=null;activation.ready?.controller.setActive(false);activation.ready?.operation.setActive(false);};},[owner]);
 async function load(){const activation=active.current;if(!activation||activation.owner!==owner||!enabled||!['director','co_director'].includes(role)||activation.loading||visible?.status==='loading'||visible?.ready)return;activation.loading=true;setState({owner,status:'loading',message:'Checking this account, current sources and existing recovery copies.',ready:null});try{const result=await prepareRecordedCostAdoptionPageV1({enabled,scope:fixed,role,retained,ports,isCurrent:()=>active.current===activation});if(active.current!==activation)return;if(result.status==='blocked'){setState({owner,status:'blocked',message:'Current review is unavailable. Existing drafts and pending operations remain untouched.',ready:null});return;}activation.ready=result;setState({owner,status:'ready',message:result.ordinaryRecoveryRequired?'Resolve the existing Finance device draft or operation in its original recovery flow before starting a new adoption. Pending adoption reconciliation remains separate.':'Current sources checked. Every recorded-cost choice still requires your review.',ready:result});}catch{if(active.current===activation)setState({owner,status:'blocked',message:'Source, account or recovery checks could not be completed. Retained work is unchanged; no new adoption was sent.',ready:null});}finally{if(active.current===activation)activation.loading=false;}}
 if(!enabled||!['director','co_director'].includes(role))return <section aria-label="Recorded-Cost Finance Page"><h1>Recorded-Cost Review Unavailable</h1><p role="status">This Finance workflow is not enabled. Existing records and device drafts are unchanged.</p></section>;
 return <main className={`auth-shell ${styles.shell}`}><section className={`auth-card corrections-card ${styles.card}`}><h1>Recorded-Cost Finance Review</h1><p>This replaces proposed costs with reviewed recorded allocations. It does not record expenses, receive income, approve payouts or mark anyone paid.</p><p role="status" aria-live="polite">{visible?.message||'Load the current account-bound review when ready.'}</p><button type="button" disabled={visible?.status==='loading'||!!visible?.ready} onClick={()=>void load()}>Load Recorded-Cost Review</button>{visible?.ready&&<RecordedCostReviewRecoveryV1 enabled scope={fixed} controller={visible.ready.controller} operation={visible.ready.operation} retained={retained} makeOperationId={()=>crypto.randomUUID()} readCurrentFinance={visible.ready.readCurrentFinance}/>}<h2>Next: Recorded Fund Review</h2><p>After adoption, a fresh recorded-fund and sanctioning-coverage review is required. Coverage selected here remains device intent. This page cannot finalize awards or payments.</p>{visible?.ready&&<NativeFundReviewSectionV1 enabled scope={fixed} retained={retained} readCurrentFinance={visible.ready.readCurrentFinance}/>}</section></main>;
}
