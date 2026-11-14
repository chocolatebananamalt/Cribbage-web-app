import{isRegistrationResolutionAttemptV1,isRegistrationResolutionRequestV1,readRegistrationResolutionProofV1,resolutionCanonicalV1,type RegistrationResolutionAttemptV1,type RegistrationResolutionRequestV1,type RegistrationResolutionScopeV1}from'../api/registration-resolution-v1.ts';
import type{FinanceDraftRetainedPortV1}from'../finance/event-finance-draft-retained-v1.ts';
export function createRegistrationResolutionControllerV1(o:{scope:RegistrationResolutionScopeV1;current:()=>boolean;retained:FinanceDraftRetainedPortV1;makeId:()=>string;send:(action:'record'|'recover',a:RegistrationResolutionAttemptV1)=>Promise<unknown>}){
 const scope=structuredClone(o.scope),key='registration-resolution-pending-v1:'+scope.actorId+':'+scope.tournamentId;let raw:string|null=null,ready=false,busy=false;
 const attempt=()=>{try{const v=raw===null?null:JSON.parse(raw);return isRegistrationResolutionAttemptV1(v)&&resolutionCanonicalV1(v.scope)===resolutionCanonicalV1(scope)?v:null;}catch{return null;}};
 return{
  pending:()=>attempt(),blocked:()=>raw!==null&&!attempt(),
  async load(){if(busy||!o.current())return false;busy=true;try{const value=await o.retained.read(key);if(!o.current())return false;raw=value;ready=true;return true;}finally{busy=false;}},
  async retain(request:RegistrationResolutionRequestV1){if(busy||!ready||raw!==null||!o.current()||!isRegistrationResolutionRequestV1(request))return false;busy=true;try{const a={scope,operationId:o.makeId(),request:structuredClone(request)};if(!isRegistrationResolutionAttemptV1(a))return false;const next=resolutionCanonicalV1(a);if(!o.current()||!await o.retained.transition(key,null,next))return false;raw=next;return o.current();}finally{busy=false;}},
  async send(action:'record'|'recover'){const a=attempt();if(busy||!ready||!a||!o.current())return null;busy=true;try{const before=raw!;if(await o.retained.read(key)!==before||!o.current())return null;const value=await o.send(action,structuredClone(a));if(!o.current())return null;const proof=readRegistrationResolutionProofV1(value,a);if(!proof)return null;const receipt=resolutionCanonicalV1({attempt:a,proof});if(!await o.retained.transition(key,before,null,{id:'registration-resolution-receipt-v1:'+scope.actorId+':'+scope.tournamentId+':'+a.operationId,raw:receipt}))return null;if(raw===before)raw=null;return o.current()?proof:null;}finally{busy=false;}}
 };
}
