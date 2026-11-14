import {readPlayoffPrizeBrowserPreparedV2,readPlayoffPrizeBrowserReplyV2,readPlayoffPrizeBrowserWorkspaceV2,type PlayoffPrizeBrowserScopeV2,type PlayoffPrizeBrowserPreparedV2,type PlayoffPrizeBrowserOperationV2} from '../api/playoff-prize-proposal-browser-v2.ts';
import type {FinanceDraftRetainedPortV1} from './event-finance-draft-retained-v1.ts';
export type PlayoffPrizeArchiveCopyV2={kind:'saved-copy'|'rejected-copy';id:string;prepared:PlayoffPrizeBrowserPreparedV2;receipt:PlayoffPrizeBrowserOperationV2;resolutionReason:string|null};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const validScope=(s:PlayoffPrizeBrowserScopeV2)=>exact(s,['actorId','tournamentId','eventId'])&&Object.values(s).every(uuid);
const prefix=(s:PlayoffPrizeBrowserScopeV2,kind:string)=>`prize-proposal-${kind}-v2:${s.actorId}:${s.tournamentId}:${s.eventId}:`;
function ownedKey(id:unknown,s:PlayoffPrizeBrowserScopeV2):id is string{return typeof id==='string'&&['receipt','rejection'].some(k=>id.startsWith(prefix(s,k))&&id.slice(prefix(s,k).length).length<=100);}
/** A consistency-checked DEVICE COPY, not a server signature or current payment
 * authority. No historical source, award or receipt is rewritten or reapplied. */
export async function readPlayoffPrizeArchiveCopyV2(id:unknown,raw:unknown,scope:PlayoffPrizeBrowserScopeV2):Promise<PlayoffPrizeArchiveCopyV2|null>{
 try{if(!validScope(scope)||!ownedKey(id,scope)||typeof raw!=='string'||raw.length>16_777_216||new TextEncoder().encode(raw).byteLength>16_777_216)return null;
  const value:unknown=JSON.parse(raw);if(!object(value))return null;const rejected=id.startsWith(prefix(scope,'rejection'));
  if(!exact(value,rejected?['kind','scope','retainedRaw','prepared','receipt','reviewedWorkspace','reason']:['prepared','receipt']))return null;
  const prepared=await readPlayoffPrizeBrowserPreparedV2(value.prepared,scope);if(!prepared||id!==prefix(scope,rejected?'rejection':'receipt')+prepared.request.operationId)return null;
  const receipt=await readPlayoffPrizeBrowserReplyV2(value.receipt,prepared);if(receipt?.kind!=='playoff-prize-proposal-browser-operation-v2'||receipt.result.status!==(rejected?'rejected':'saved'))return null;
  if(rejected){if(value.kind!=='playoff-prize-rejection-archive-v2'||canonical(value.scope)!==canonical(scope)||typeof value.retainedRaw!=='string'||value.retainedRaw.length>2_000_000||typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>2000||!readPlayoffPrizeBrowserWorkspaceV2(value.reviewedWorkspace,scope))return null;
   const original=await readPlayoffPrizeBrowserPreparedV2(JSON.parse(value.retainedRaw),scope);if(!original||canonical(original)!==canonical(prepared))return null;}
  return{kind:rejected?'rejected-copy':'saved-copy',id,prepared,receipt,resolutionReason:rejected?value.reason as string:null};
 }catch{return null;}
}
export type PlayoffPrizeArchiveSnapshotV2={status:'idle'|'loading'|'ready'|'unavailable';entries:Array<{id:string;copy:PlayoffPrizeArchiveCopyV2|null}>;nextCursor:string|null;message:string};
/** Provider access is checked before and after scoped local history reads.
 * No broad storage enumeration, remote write, deletion or current-head adoption. */
export class PlayoffPrizeArchiveReaderV2{
 private active=false;private generation=0;private listeners=new Set<()=>void>();
 private state:Readonly<PlayoffPrizeArchiveSnapshotV2>={status:'idle',entries:[],nextCursor:null,message:''};
 readonly scope:PlayoffPrizeBrowserScopeV2;private retained:FinanceDraftRetainedPortV1;private workspace:()=>Promise<unknown>;
 constructor(scope:PlayoffPrizeBrowserScopeV2,retained:FinanceDraftRetainedPortV1,workspace:()=>Promise<unknown>){if(!validScope(scope))throw Error('invalid_scope');this.scope=Object.freeze(structuredClone(scope));this.retained=retained;this.workspace=workspace;}
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};getSnapshot=()=>this.state;
 setActive=(active:boolean)=>{if(this.active===active)return;this.active=active;this.generation++;this.publish({status:'idle',entries:[],nextCursor:null,message:''});};
 private publish(next:PlayoffPrizeArchiveSnapshotV2){const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};this.state=freeze(structuredClone(next));for(const f of this.listeners)f();}
 private current(g:number){return this.active&&g===this.generation;}
 async load(after:string|null=null,expected=this.state){
  if(!this.active||expected!==this.state||this.state.status==='loading'||(after!==null&&!ownedKey(after,this.scope)))return;
  const g=this.generation;this.publish({status:'loading',entries:[],nextCursor:null,message:'Checking this account and its local proposal archive.'});
  try{if(!this.retained.readPrizeArchives)throw Error('archive_port_unavailable');
   const before=readPlayoffPrizeBrowserWorkspaceV2(await this.workspace(),this.scope);if(!this.current(g))return;if(!before)throw Error('permission_unavailable');
   const page=await this.retained.readPrizeArchives(this.scope,after,5);if(!this.current(g))return;
   if(!exact(page,['entries','nextCursor'])||!Array.isArray(page.entries)||page.entries.length>5||(page.nextCursor!==null&&!ownedKey(page.nextCursor,this.scope)))throw Error('invalid_page');
   let previous=after,bytes=0;const entries:PlayoffPrizeArchiveSnapshotV2['entries']=[];
   for(const entry of page.entries){if(!exact(entry,['id','raw'])||!ownedKey(entry.id,this.scope)||(entry.raw!==null&&typeof entry.raw!=='string')||(typeof entry.raw==='string'&&entry.raw.length>33_554_432)||(previous!==null&&entry.id<=previous))throw Error('invalid_page');bytes+=new TextEncoder().encode(entry.id).byteLength+(typeof entry.raw==='string'?new TextEncoder().encode(entry.raw).byteLength:0);if(bytes>33_554_432)throw Error('page_too_large');previous=entry.id;const copy=await readPlayoffPrizeArchiveCopyV2(entry.id,entry.raw,this.scope);if(!this.current(g))return;entries.push({id:entry.id,copy});}
   if(page.nextCursor!==null&&(entries.length===0||page.nextCursor!==entries.at(-1)!.id))throw Error('invalid_cursor');
   const afterAccess=readPlayoffPrizeBrowserWorkspaceV2(await this.workspace(),this.scope);if(!this.current(g))return;if(!afterAccess)throw Error('permission_unavailable');
   this.publish({status:'ready',entries,nextCursor:page.nextCursor as string|null,message:entries.length?'Device copies checked for consistency. They are not current server approval.':'No matching local archive entries were returned. This does not prove there is no server history.'});
  }catch{if(this.current(g))this.publish({status:'unavailable',entries:[],nextCursor:null,message:'Archive storage or current account access is unavailable. Existing audit records are unchanged.'});}
 }
}
