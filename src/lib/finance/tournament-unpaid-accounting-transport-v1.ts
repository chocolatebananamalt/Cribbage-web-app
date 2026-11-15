import'server-only';import{requireVerifiedIdentity}from'../api/verified-subject.ts';
import{readAccountingAttempt,readAccountingReply,projectAccountingView,type AccountingScope,type AccountingReply}from'./tournament-unpaid-accounting-v1.ts';
type Client={auth:{getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;getUser:()=>Promise<{data:{user:{id:string}|null};error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
export function createTournamentAccountingTransport(normal:Client,service:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>,scope:AccountingScope,flags:{read:()=>boolean;write:()=>boolean}){
 const fixed=Object.freeze({...scope});let session:string|null=null;
 const auth=async()=>{if(!flags.read())throw Error('disabled');const i=await requireVerifiedIdentity(normal),u=await normal.auth.getUser();if(!i||i.subject!==fixed.actorId||session!==null&&session!==i.sessionId||u.error||u.data.user?.id!==fixed.actorId)throw Error('identity_changed');const r=await normal.rpc('get_tournament_role',{p_tournament_id:fixed.tournamentId});if(r.error||r.data!=='director')throw Error('director_required');session=i.sessionId;return i;};
 const rpc=async(name:string,extra:Record<string,unknown>={})=>{const before=await auth(),r=await service(name,{actor:fixed.actorId,sid:before.sessionId,tid:fixed.tournamentId,...extra});await auth();if(r.error)throw Error('outcome_unknown');return r.data;};
 const read=async()=>{const v=projectAccountingView(await rpc('get_tournament_unpaid_accounting_v1'),fixed);if(!v)throw Error('invalid_current_evidence');return v;};
 const send=async(value:unknown,recoverOnly=false):Promise<AccountingReply>=>{const a=readAccountingAttempt(value,fixed);if(!a)throw Error('invalid_attempt');const prior=readAccountingReply(await rpc('get_tournament_unpaid_accounting_operation_v1',{op:a.operationId,request:a.request}),a);if(!prior)throw Error('unbound_outcome');if(prior.terminal||recoverOnly)return prior;if(!flags.write())return{status:'unknown',code:'database_verification_pending',operationId:a.operationId,snapshotId:null,terminal:false};
  // The SQL transaction records stale/held rejections durably. Never manufacture
  // a terminal client-side rejection that could race an accepted retry.
  const r=readAccountingReply(await rpc('approve_tournament_unpaid_accounting_v1',{op:a.operationId,request:a.request}),a);if(!r||!flags.write())throw Error('outcome_unknown');return r;};return{read,send};
}
