import type {FinanceDraftRetainedPortV1} from './event-finance-draft-retained-v1.ts';
import {isSatelliteFinanceScopeV1,readSatelliteFinanceAttemptV1,readSatelliteFinanceWorkspaceV1,readSatelliteFinanceProofV1,satelliteFinanceSameV1,type SatelliteFinanceScopeV1,type SatelliteFinanceAttemptV1,type SatelliteFinanceWorkspaceV1} from './satellite-finance-contract-v1.ts';
export type SatelliteFinancePortV1={read:()=>Promise<{status:'ready';workspace:SatelliteFinanceWorkspaceV1}|{status:'source_unavailable'}>;send:(attempt:SatelliteFinanceAttemptV1,command:'record'|'retire'|'recover')=>Promise<unknown>};
type State={active:boolean;busy:boolean;blocked:boolean;workspace:SatelliteFinanceWorkspaceV1|null;pending:SatelliteFinanceAttemptV1|null;message:string};
/** Own-subject outbox only. No auto-send, source substitution, timeout deletion
 * or authority from a bare rejection. Confirmed nonce retirement is audited. */
export class SatelliteFinanceControllerV1{
 readonly key:string;private scope:SatelliteFinanceScopeV1;private storage:FinanceDraftRetainedPortV1;private port:SatelliteFinancePortV1;private raw:string|null=null;private pending:SatelliteFinanceAttemptV1|null=null;
 private active=false;private epoch=0;private flight:AbortController|null=null;private listeners=new Set<()=>void>();private state:State={active:false,busy:false,blocked:false,workspace:null,pending:null,message:''};
 constructor(scope:SatelliteFinanceScopeV1,storage:FinanceDraftRetainedPortV1,port:SatelliteFinancePortV1){if(!isSatelliteFinanceScopeV1(scope))throw Error('invalid_scope');this.scope=Object.freeze({...scope});this.storage=storage;this.port=port;this.key=`satellite-finance-pending-v1:${scope.actorId}:${scope.tournamentId}:${scope.eventId}`;}
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};getSnapshot=()=>this.state;
 private emit(p:Partial<State>){this.state={...this.state,...p};this.listeners.forEach(f=>f());}
 setActive(value:boolean){this.epoch++;this.active=value;this.flight?.abort();this.flight=null;this.emit({active:false,busy:false,workspace:null,pending:null,blocked:false,message:value?'Rechecking account and saved work.':'Recheck this account before continuing. Saved work is preserved.'});}
 private begin(){if(!this.active||this.flight)return null;const f=new AbortController();this.flight=f;this.emit({busy:true});return{f,epoch:this.epoch};}
 private current(t:{f:AbortController;epoch:number}){return this.active&&this.epoch===t.epoch&&!t.f.signal.aborted;}
 private finish(t:{f:AbortController}){if(this.flight===t.f){this.flight=null;this.emit({busy:false});}}
 async initialize(){const t=this.begin();if(!t)return;try{
  const raw=await this.storage.read(this.key);if(!this.current(t))return;this.raw=raw;
  let pending:SatelliteFinanceAttemptV1|null=null;if(raw!==null){try{if(raw.length<=16000)pending=readSatelliteFinanceAttemptV1(JSON.parse(raw),this.scope);}catch{/* Preserve unknown bytes. */}if(!pending){this.emit({blocked:true,message:'Unrecognized saved work is preserved. It cannot be replaced or sent.'});return;}}
  const read=await this.port.read();if(!this.current(t))return;
  const workspace=read.status==='ready'?readSatelliteFinanceWorkspaceV1(read.workspace,this.scope):null;if(read.status==='ready'&&!workspace)throw Error('invalid_source');
  if(await this.storage.read(this.key)!==raw){if(this.current(t))this.emit({blocked:true,active:false,message:'Saved work changed in another tab. Recheck before continuing.'});return;}
  if(!this.current(t))return;this.pending=pending;this.emit({active:true,workspace,pending,blocked:false,message:pending?'An exact request is saved. Retry it or explicitly retire it; it will not be changed to match new sources.':workspace?'Review the current records before saving a request.':'Current fund sources are unavailable. An existing saved request can still be recovered or retired.'});
 }catch{if(this.current(t))this.emit({active:false,workspace:null,pending:null,message:'Account or source could not be verified. Saved work remains unchanged.'});}finally{this.finish(t);}}
 async retain(attempt:unknown,shown:SatelliteFinanceWorkspaceV1){const t=this.begin();if(!t)return;try{
  if(!this.state.active||this.state.blocked||this.raw!==null||!this.state.workspace||this.state.workspace!==shown)return;
  const a=readSatelliteFinanceAttemptV1(attempt,this.scope);if(!a||a.request.sourceDigest!==shown.sourceDigest||a.request.incomeHeadVersion!==shown.incomeHeadVersion||a.request.reviewHeadVersion!==shown.reviewHeadVersion)return;
  const raw=JSON.stringify(a);if(!await this.storage.transition(this.key,null,raw,undefined,t.f.signal)){if(this.current(t))this.emit({blocked:true,active:false,message:'Saved work already exists. Recheck; nothing was overwritten.'});return;}
  if(!this.current(t))return;this.raw=raw;this.pending=a;this.emit({pending:a,message:'Exact request saved on this device. Recording is a separate action.'});
 }catch{if(this.current(t))this.emit({blocked:true,active:false,message:'Request retention could not be confirmed. Recheck saved work before continuing.'});}finally{this.finish(t);}}
 async send(command:'record'|'retire'|'recover',retirementConfirmed=false,shownPending:SatelliteFinanceAttemptV1|null=null){const t=this.begin();if(!t)return;try{
  if(!this.state.active||this.state.blocked||!this.pending||this.raw===null||!shownPending||this.state.pending!==shownPending||command==='retire'&&!retirementConfirmed)return;
  const raw=this.raw,a=readSatelliteFinanceAttemptV1(JSON.parse(raw),this.scope);if(!a||!satelliteFinanceSameV1(a,this.pending))throw Error('invalid_pending');
  if(await this.storage.read(this.key)!==raw)throw Error('displaced_pending');if(!this.current(t))return;
  const reply=await this.port.send(structuredClone(a),command);if(!this.current(t))return;const proof=readSatelliteFinanceProofV1(reply,a);
  if(!proof){this.emit({active:false,workspace:null,pending:null,message:'Outcome unconfirmed or request held. The exact request remains saved; recheck before retrying or retiring it.'});return;}
  const archive={id:`satellite-finance-proof-v1:${this.scope.actorId}:${this.scope.tournamentId}:${this.scope.eventId}:${a.operationId}`,raw:JSON.stringify({kind:'satellite-finance-archive-v1',attemptRaw:raw,proof})};
  if(!await this.storage.transition(this.key,raw,null,archive,t.f.signal))throw Error('displaced_pending');
  if(!this.current(t))return;this.raw=null;this.pending=null;this.emit({active:false,workspace:null,pending:null,message:proof.status==='satellite_finance_recorded'?'Recorded bookkeeping confirmed. Recheck to view fresh sources. No money was moved.':'The uncommitted request is retired and its nonce is closed. Recheck before preparing a new request.'});
 }catch{if(this.current(t))this.emit({active:false,workspace:null,pending:null,message:'Outcome unknown. Saved work is preserved. Recheck this account before any exact retry.'});}finally{this.finish(t);}}
}

export function createSatelliteFinanceHttpV1(scope:SatelliteFinanceScopeV1,o:{enabled:()=>boolean;fetcher?:typeof fetch}):SatelliteFinancePortV1{
 if(!isSatelliteFinanceScopeV1(scope))throw Error('invalid_scope');const s=Object.freeze({...scope}),base=`/api/v1/tournaments/${s.tournamentId}/satellite-finance/${s.eventId}`;
 const exact=(v:unknown,k:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===k.sort().join();
 async function request(body?:unknown){if(!o.enabled())throw Error('disabled');const r=await(o.fetcher??fetch)(base,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',mode:'same-origin',redirect:'error',headers:{accept:'application/json','x-expected-actor-id':s.actorId,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!o.enabled()||r.redirected||![200,409].includes(r.status)||!r.headers.get('content-type')?.startsWith('application/json')||!r.body)throw Error('provider_unavailable');
  const reader=r.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let n=0,text='';try{for(;;){const x=await reader.read();if(x.done)break;n+=x.value.byteLength;if(n>4200000)throw Error('response_too_large');text+=decoder.decode(x.value,{stream:true});}text+=decoder.decode();}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}if(!o.enabled())throw Error('disabled');return{value:JSON.parse(text)as unknown,status:r.status};
 }
 return{read:async()=>{const response=await request();if(response.status!==200)throw Error('invalid_source_status');const raw=response.value;if(exact(raw,['status','scope'])&&raw.status==='source_unavailable'&&satelliteFinanceSameV1(raw.scope,s))return{status:'source_unavailable'};if(!exact(raw,['status','workspace'])||raw.status!=='ready')throw Error('invalid_source');const workspace=readSatelliteFinanceWorkspaceV1(raw.workspace,s);if(!workspace)throw Error('invalid_source');return{status:'ready',workspace};},send:async(value,command)=>{const a=readSatelliteFinanceAttemptV1(value,s);if(!a||!['record','retire','recover'].includes(command))throw Error('invalid_request');const response=await request({command,attempt:a}),raw=response.value,proof=readSatelliteFinanceProofV1(raw,a);if(proof&&response.status===200)return proof;if(response.status===409&&exact(raw,['status','code'])&&raw.status==='pending'&&typeof raw.code==='string'&&/^[a-z0-9_]{1,100}$/.test(raw.code))return raw;throw Error('outcome_unknown');}};
}
