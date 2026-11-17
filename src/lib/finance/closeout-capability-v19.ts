import type {CloseScope} from './modern-event-close-contract-v1.ts';

export type CapabilityPinsV19={catalogHash:string;admissionSetHash:string};
type Rpc={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const keys='actorId,admissionSetHash,bootstrapFenced,catalogHash,controlVersion,drainedVersion,eventId,kind,paused,readAvailable,sessionId,tournamentId,writeAvailable';

// No cached affirmative result: every action obtains a fresh, scope-bound reply.
// A response cannot authorize installation or substitute for reviewed source pins.
export function readCloseoutCapabilityV19(value:unknown,scope:CloseScope,sid:string,pins:CapabilityPinsV19,action:'recover'|'retire'):boolean{
 if(!hash(pins.catalogHash)||!hash(pins.admissionSetHash)||!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!==keys||v.kind!=='closeout-capability-v19'||v.actorId!==scope.actorId||v.tournamentId!==scope.tournamentId||v.eventId!==scope.eventId||v.sessionId!==sid||v.catalogHash!==pins.catalogHash||v.admissionSetHash!==pins.admissionSetHash||!integer(v.controlVersion)||!integer(v.drainedVersion)||v.drainedVersion>v.controlVersion||typeof v.paused!=='boolean'||v.bootstrapFenced!==true||v.readAvailable!==true||typeof v.writeAvailable!=='boolean')return false;
 if(v.paused&&v.drainedVersion!==v.controlVersion||v.paused&&v.writeAvailable)return false;
 return action==='recover'||v.writeAvailable===true;
}

export function createCloseoutCapabilityVerifierV19(service:()=>Rpc,pins:()=>CapabilityPinsV19|null){
 return async(scope:CloseScope,sid:string,action:'recover'|'retire'):Promise<boolean>=>{
  const expected=pins();if(!expected||!hash(expected.catalogHash)||!hash(expected.admissionSetHash))return false;
  // Copy pins before awaiting; a mutable caller cannot change the expected result.
  const captured={...expected};
  try{const result=await service().rpc('get_closeout_capability_v19',{actor:scope.actorId,sid,tid:scope.tournamentId,eid:scope.eventId});
   const current=pins();return !result.error&&current?.catalogHash===captured.catalogHash&&current?.admissionSetHash===captured.admissionSetHash&&readCloseoutCapabilityV19(result.data,scope,sid,captured,action);
  }catch{return false;}
 };
}
