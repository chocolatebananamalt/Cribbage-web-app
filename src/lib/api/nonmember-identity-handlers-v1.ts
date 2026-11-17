import{isUuid}from'./validation.ts';
import{isIdentityRequestV1,readIdentityReceiptV1}from'../registration/nonmember-identity-v1.ts';
type Context={params:Promise<{id:string}>};
type VerifiedAccessV1={actorId:string;sessionId:string;tournamentId:string;roles:readonly string[]};
const allowed=(v:VerifiedAccessV1|null,tid:string):v is VerifiedAccessV1=>!!v&&isUuid(v.actorId)&&isUuid(v.sessionId)&&v.tournamentId===tid&&Array.isArray(v.roles)&&v.roles.every(x=>typeof x==='string')&&v.roles.some(x=>x==='director'||x==='co_director');
const unchanged=(a:VerifiedAccessV1,b:VerifiedAccessV1|null,tid:string)=>allowed(b,tid)&&a.actorId===b.actorId&&a.sessionId===b.sessionId;
export function createNonmemberIdentityHandlersV1(d:{sameOrigin:(r:Request)=>boolean;actor:()=>Promise<VerifiedAccessV1|null>;supported:(scope:{actorId:string;tournamentId:string})=>Promise<unknown>;readJson:(r:Request)=>Promise<unknown>;write:(access:VerifiedAccessV1,tournamentId:string,request:unknown)=>Promise<{data:unknown;error:unknown}>}){
 return{POST:async(r:Request,c:Context)=>{try{
  if(!d.sameOrigin(r))return Response.json({error:'invalid_origin'},{status:403});
  const{id}=await c.params;if(!isUuid(id))return Response.json({error:'invalid_tournament'},{status:400});
  const observed=await d.actor();if(!observed||!isUuid(observed.actorId))return Response.json({error:'unauthorized'},{status:401});
  if(!allowed(observed,id))return Response.json({error:'not_director'},{status:403});
  const access=Object.freeze({...observed,roles:Object.freeze([...observed.roles])});
  const capability=await d.supported({actorId:access.actorId,tournamentId:id});
  if(!capability||typeof capability!=='object'||Object.keys(capability).sort().join()!==['kind','version','tournamentId','actorId','available'].sort().join()||!('kind'in capability)||capability.kind!=='roster-identity-capability-v1'||!('version'in capability)||capability.version!==1||!('tournamentId'in capability)||capability.tournamentId!==id||!('actorId'in capability)||capability.actorId!==access.actorId||!('available'in capability)||capability.available!==true)return Response.json({error:'persisted_identity_contract_unavailable'},{status:503});
  const body=await d.readJson(r);if(!isIdentityRequestV1(body))return Response.json({error:'invalid_identity_request'},{status:400});
  if(!unchanged(access,await d.actor(),id))return Response.json({error:'identity_access_changed'},{status:409});
  const result=await d.write(access,id,body);if(!unchanged(access,await d.actor(),id))return Response.json({error:'identity_outcome_unconfirmed'},{status:503});if(result.error)return Response.json({error:'identity_outcome_unconfirmed'},{status:503});
  const receipt=readIdentityReceiptV1(result.data,{actorId:access.actorId,tournamentId:id},body);
  return receipt?Response.json(receipt,{headers:{'cache-control':'private, no-store'}}):Response.json({error:'identity_outcome_unconfirmed'},{status:503});
 }catch{return Response.json({error:'identity_outcome_unconfirmed'},{status:503});}}};
}
