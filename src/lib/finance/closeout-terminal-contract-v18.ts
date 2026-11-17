import{closeSame,closeUuid,readCloseAttempt,type CloseAttempt,type CloseScope}from'./modern-event-close-contract-v1.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const keys=(v:Record<string,unknown>,names:string[])=>Object.keys(v).sort().join(',')===[...names].sort().join(',');
export const terminalReasonV18=(v:unknown):v is string=>typeof v==='string'&&v===v.trim()&&v.length>0&&v.length<=1000;
export type CloseRetainedV18={attempt:CloseAttempt;attemptRaw:string;retirementReason:string|null};
export function readCloseRetainedV18(raw:string,scope:CloseScope):CloseRetainedV18|null{
 try{const value:unknown=JSON.parse(raw),attempt=readCloseAttempt(value,scope);if(attempt)return{attempt,attemptRaw:raw,retirementReason:null};
  if(!object(value)||!keys(value,['kind','attemptRaw','reason'])||value.kind!=='closeout-retirement-intent-v18'||typeof value.attemptRaw!=='string'||value.attemptRaw.length>150000||!terminalReasonV18(value.reason))return null;
  const original=readCloseAttempt(JSON.parse(value.attemptRaw),scope);return original?{attempt:original,attemptRaw:value.attemptRaw,retirementReason:value.reason}:null;
 }catch{return null;}
}
export function makeRetirementIntentV18(raw:string,scope:CloseScope,reason:string){const r=readCloseRetainedV18(raw,scope);if(!r||r.retirementReason!==null||r.attemptRaw.length>150000||!terminalReasonV18(reason))return null;return JSON.stringify({kind:'closeout-retirement-intent-v18',attemptRaw:r.attemptRaw,reason});}
export type CloseoutTerminalV18={kind:'closeout-terminal-retirement-v17';status:'retired_no_effect';actorId:string;sessionId:string;tournamentId:string;eventId:string;operationId:string;stage:CloseAttempt['review']['stage'];request:Record<string,unknown>;reason:string;moneyMoved:false;payoutAuthorized:false;officialMrpAwarded:false;accSubmissionPerformed:false};
const proofKeys=['kind','status','actorId','sessionId','tournamentId','eventId','operationId','stage','request','reason','moneyMoved','payoutAuthorized','officialMrpAwarded','accSubmissionPerformed'];
export function readCloseoutTerminalV18(value:unknown,attempt:CloseAttempt,reason?:string|null):CloseoutTerminalV18|null{
 if(!object(value)||!keys(value,proofKeys)||value.kind!=='closeout-terminal-retirement-v17'||value.status!=='retired_no_effect'||!Object.entries(attempt.scope).every(([k,v])=>value[k]===v)||!closeUuid(value.sessionId)||value.operationId!==attempt.operationId||value.stage!==attempt.review.stage||!closeSame(value.request,attempt.request)||!terminalReasonV18(value.reason)||reason!=null&&value.reason!==reason||value.moneyMoved!==false||value.payoutAuthorized!==false||value.officialMrpAwarded!==false||value.accSubmissionPerformed!==false)return null;
 // Fixed field order and original request shape make repeated local archives stable.
 return{kind:'closeout-terminal-retirement-v17',status:'retired_no_effect',...attempt.scope,sessionId:value.sessionId,operationId:attempt.operationId,stage:attempt.review.stage,request:attempt.request,reason:value.reason,moneyMoved:false,payoutAuthorized:false,officialMrpAwarded:false,accSubmissionPerformed:false};
}
export type TerminalReplyV18={kind:'closeout-terminal-reply-v18';scope:CloseScope;operationId:string;status:'terminal'|'unresolved';code:string;terminal:CloseoutTerminalV18|null};
export function readTerminalReplyV18(value:unknown,attempt:CloseAttempt,reason?:string|null):TerminalReplyV18|null{
 if(!object(value)||!keys(value,['kind','scope','operationId','status','code','terminal'])||value.kind!=='closeout-terminal-reply-v18'||!closeSame(value.scope,attempt.scope)||value.operationId!==attempt.operationId||typeof value.code!=='string'||!/^[a-z0-9_]{1,100}$/.test(value.code))return null;
 if(value.status==='unresolved')return value.terminal===null?value as TerminalReplyV18:null;
 const terminal=readCloseoutTerminalV18(value.terminal,attempt,reason);return value.status==='terminal'&&value.code==='retired_no_effect'&&terminal?{kind:'closeout-terminal-reply-v18',scope:attempt.scope,operationId:attempt.operationId,status:'terminal',code:'retired_no_effect',terminal}:null;
}
export function makeTerminalArchiveV18(raw:string,scope:CloseScope,proof:unknown){const r=readCloseRetainedV18(raw,scope);if(!r)return null;const terminal=readCloseoutTerminalV18(proof,r.attempt,r.retirementReason);return terminal?JSON.stringify({kind:'closeout-terminal-archive-v18',retainedRaw:raw,terminal}):null;}
