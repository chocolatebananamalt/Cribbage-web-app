import test from 'node:test';import assert from 'node:assert/strict';
import {loadActual,actual,id} from './helpers/manual-paper-status-runtime-ports.mjs';
const dto=await actual('src/lib/api/seating.ts'),identity=await actual('src/lib/api/verified-subject.ts'),bodyReader=await actual('src/lib/api/bounded-json.ts'),origin=await actual('src/lib/api/same-origin.ts'),validation=await actual('src/lib/api/validation.ts');
const tid=id(1),actor=id(2),roster=id(3),operation=id(4),body={rosterEntryId:roster,checkInState:'checked_in',reason:'Fictional desk attendance',idempotencyKey:operation};
const receipt={status:'check_in_recorded',checkInEventId:id(5),rosterEntryId:roster,checkInState:'checked_in',eventEnrolled:false,seatAssigned:false,verificationIdAssigned:false,tournamentId:tid,operationId:operation};
const request=(payload=body,headers={})=>new Request(`https://fixture.invalid/api/v1/tournaments/${tid}/seating/check-in`,{method:'POST',headers:{origin:'https://fixture.invalid','content-type':'application/json',...headers},body:JSON.stringify(payload)});
function harness({subject=actor,error=null,data=receipt}={}){
 const calls=[];const normal={auth:{getClaims:async()=>({data:{claims:subject?{sub:subject}:{}},error:null})},rpc:async(name,args)=>{calls.push({name,args});return{data,error};}};
 const boundary=loadActual('src/lib/api/route-boundary.ts',{'next/navigation':{unstable_rethrow:()=>{}},'next/server':{NextResponse:Response},'./bounded-json':bodyReader,'./verified-subject':identity},{Headers});
 const deps={...dto,...origin,...validation,...boundary,createClient:async()=>normal};
 const names=['supabase/server','api/seating','api/validation','api/same-origin','api/route-boundary'];
 const route=loadActual('src/app/api/v1/tournaments/[id]/seating/check-in/route.ts',Object.fromEntries(names.map(n=>['../../../../../../../lib/'+n,deps])));return{route,calls};
}
const context={params:Promise.resolve({id:tid})};
test('actual check-in route consumes exact saved/replayed normal-client receipts without payment or seating side effects',async()=>{
 const h=harness();for(let n=0;n<2;n++){const response=await h.route.POST(request(),context);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(await response.json(),receipt);}
 assert.equal(h.calls.length,2);assert.deepEqual(h.calls[0],h.calls[1]);assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0])),{name:'record_roster_check_in_event_v2',args:{p_tournament_id:tid,p_roster_entry_id:roster,p_check_in_state:'checked_in',p_reason:body.reason,p_idempotency_key:operation}});
});
test('actual route rejects foreign-origin, absent actor and extra DTO authority before RPC',async()=>{
 for(const [options,payload,headers,status]of [[{},body,{origin:'https://foreign.invalid'},403],[{subject:null},body,{},401],[{},{...body,paymentRecorded:true},{},400]]){const h=harness(options);const r=await h.route.POST(request(payload,headers),context);assert.equal(r.status,status);assert.equal(h.calls.length,0);}
});
test('actual route preserves server permission rejection and withholds foreign, unbound and failed provider replies',async()=>{
 const rejected={status:'rejected',code:'not_director',rosterEntryId:roster,tournamentId:tid,operationId:operation};const denied=harness({data:rejected});const r=await denied.route.POST(request(),context);assert.equal(r.status,409);assert.deepEqual(await r.json(),rejected);
 for(const options of [{data:{...receipt,rosterEntryId:id(9)}},{data:{...receipt,operationId:id(9)}},{data:null},{error:{message:'PRIVATE_SENTINEL'}}]){const h=harness(options);const response=await h.route.POST(request(),context);assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/PRIVATE_SENTINEL/);}
});
