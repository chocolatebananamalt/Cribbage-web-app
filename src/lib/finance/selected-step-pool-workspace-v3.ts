import 'server-only';
import{collectSelectedStepPoolSourceV3,projectSelectedStepPoolSourceV3}from'./selected-step-pool-source-v3.ts';
import{isModernPrizeScopeV2,modernPrizeSameV2,type ModernPrizeScopeV2}from'./modern-prize-journal-contract-v2.ts';
import type{SelectedStepPoolWorkspaceV3}from'./selected-step-pool-contract-v3.ts';
type Client={auth:{getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Service=(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export async function readSelectedStepPoolWorkspaceServerV3(o:{authenticated:Client;serviceRpc:Service;scope:ModernPrizeScopeV2;enabled:()=>boolean}):Promise<SelectedStepPoolWorkspaceV3>{
 const held=(code:string):SelectedStepPoolWorkspaceV3=>({status:'held',code});if(!o.enabled()||!isModernPrizeScopeV2(o.scope))return held('unavailable');const s=Object.freeze({...o.scope});
 async function authorized(){try{if(!o.enabled())return false;const b=await o.authenticated.auth.getUser();if(b.error||b.data?.user?.id!==s.actorId)return false;const r=await o.authenticated.rpc('get_tournament_role',{p_tournament_id:s.tournamentId});const a=await o.authenticated.auth.getUser();return !r.error&&r.data==='director'&&!a.error&&a.data?.user?.id===s.actorId&&o.enabled();}catch{return false;}}
 try{if(!await authorized())return held('permission_required');const r=await o.serviceRpc('get_selected_step_pool_record_provider_v3',{actor:s.actorId,tid:s.tournamentId,eid:s.eventId});if(r.error||!await authorized())return held('account_or_provider_changed');const v=r.data;
  if(!object(v)||v.kind!=='selected-step-pool-history-v3'||!Object.entries(s).every(([k,x])=>v[k]===x)||v.historicalReceipt!==true||v.currentSourceVerified!==false||v.moneyMoved!==false||v.payoutAuthorized!==false||!Array.isArray(v.recipients))return held('history_unverified');
  if(v.final!==null){const f=v.final;if(!object(f)||!uuid(f.id)||!uuid(f.actor_id)||f.tournament_id!==s.tournamentId||f.event_id!==s.eventId||!object(v.head)||v.head.id!==f.proposal_revision_id||v.head.source_digest!==f.source_digest||!modernPrizeSameV2(v.head.source_capture,f.source_capture))return held('record_unverified');const review=projectSelectedStepPoolSourceV3(f.source_capture,{...s,actorId:f.actor_id});if(!review||f.source_digest!==review.sourceDigest||f.q_minor!==review.qMinor||f.side_minor!==review.sideMinor||f.total_minor!==review.totalMinor)return held('record_unverified');
   const raw=f.source_capture as{pools:Array<{poolId:string;recipients:Array<{participantId:string;tournamentPlayerId:string}>}>};
   const expected=review.pools.flatMap(p=>p.recipients.map(x=>({pool:p,...x,seen:false})));if(v.recipients.length!==expected.length)return held('record_unverified');for(const row of v.recipients){if(!object(row)||row.final_id!==f.id||row.tournament_id!==s.tournamentId||row.event_id!==s.eventId||!raw.pools.some(p=>p.poolId===row.pool_id&&p.recipients.some(x=>x.participantId===row.participant_id&&x.tournamentPlayerId===row.tournament_player_id)))return held('record_unverified');const x=expected.find(x=>!x.seen&&x.pool.poolId===row.pool_id&&x.pool.kind===row.pool_kind&&x.name===row.display_name&&x.tournamentPlayerId===row.tournament_player_id&&x.amountMinor===row.amount_minor&&x.pool.roundingUnitMinor===row.rounding_unit_minor);if(!x)return held('record_unverified');x.seen=true;}
   return{status:'recorded',review,finalId:f.id};
  }
  if(v.recipients.length)return held('record_unverified');const h=v.head;if(h!==null&&(!object(h)||!uuid(h.id)||!Number.isInteger(h.version)||(h.version as number)<1||(h.version as number)>=2147483647||h.tournament_id!==s.tournamentId||h.event_id!==s.eventId))return held('history_unverified');
  const review=await collectSelectedStepPoolSourceV3(o);if(!review||!await authorized())return held('current_source_required');
  return{status:'review',review,version:object(h)?h.version as number:0,proposalRevisionId:object(h)&&h.source_digest===review.sourceDigest?h.id as string:null};
 }catch{return held('source_unavailable');}
}
