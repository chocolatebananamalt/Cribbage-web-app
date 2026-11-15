/** Bounded same-origin JSON transport for the reviewed Finance route families.
 * Default-off; no automatic retry, authentication claim or posted actor. */
export function createFinanceJsonHttpV1(options:{enabled?:()=>boolean;fetch?:typeof globalThis.fetch;expectedActorId?:string}={}){
 return async(path:string,body?:unknown)=>{
  if(options.enabled?.()!==true)throw Error('provider_disabled');
  if(!/^\/api\/v1\/tournaments\/[a-f0-9-]{36}\/events\/[a-f0-9-]{36}\/(?:prize-proposal(?:\/operation)?|operational-finance(?:\/source-adoption)?(?:\/operations\/[a-f0-9-]{36})?|native-finance\/(?:fund-review(?:\/source)?|operations\/[a-f0-9-]{36}))$/.test(path))throw Error('invalid_provider_path');
  const actor=options.expectedActorId;if(actor!==undefined&&!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(actor))throw Error('invalid_expected_actor');
  const actorHeader:Record<string,string>=actor===undefined?{}:{'x-expected-actor-id':actor};
  const raw=body===undefined?undefined:JSON.stringify(body);if(body!==undefined&&(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>4200000))throw Error('provider_request_too_large');
  const response=await(options.fetch??globalThis.fetch)(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:body===undefined?{accept:'application/json',...actorHeader}:{accept:'application/json','content-type':'application/json',...actorHeader},...(body===undefined?{}:{body:raw})});
  if(response.redirected||!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')||!response.body)throw Error('provider_response_unavailable');
  const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text='';
  try{for(;;){const{done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>4200000){await reader.cancel();throw Error('provider_response_too_large');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  const value:unknown=JSON.parse(text);
  // Accepted/rejected/retry receipts can use 200/409/503. Permission failures,
  // invalid bodies and absent operations never become authoritative receipts.
  if(![200,409,503].includes(response.status))throw Error('provider_response_unavailable');
  return value;
 };
}
