import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalV5 } from '../src/lib/identity-v5/contracts.ts';
import { validRegistrationV25, readPendingV25, readReplyV25, requestHashV25 } from '../src/lib/legacy-registration-v25/contracts.ts';
import { legacyRegistrationEnabledV25 } from '../src/lib/legacy-registration-v25/gate.ts';
import { createLegacyRegistrationHandlersV25 } from '../src/lib/legacy-registration-v25/handlers.ts';
import { legacyRegistrationProviderV25 } from '../src/lib/legacy-registration-v25/provider.ts';
const id=n=>'f2500000-0000-4000-8000-'+String(n).padStart(12,'0'),a={actorId:id(1),sessionId:id(2),tournamentId:id(3),role:'director'},op=id(4),pin='b'.repeat(64);
const entry={firstName:'Alex',lastName:'Example',email:'',city:'Fictional City',state:'HI',accNumber:'',nonmemberWithoutNumber:true,scorecardType:'paper',joiningClaim:{status:'none',evidenceReference:''}},address={street:'1 Fictional Way',postalCode:'00000',country:'US'},distinction={prefix:'',middleName:'Lee',suffix:'Jr.',localLabel:''};
const q=()=>({kind:'legacy-roster-identity-request-v25',sourceRevision:0,sourceDigest:'a'.repeat(64),entry:structuredClone(entry),address:structuredClone(address),distinction:structuredClone(distinction),decision:null,reason:'Fictional desk review'});
function recorded(request,operation=op){return{status:'recorded',player:{kind:'identity-trial-player-v4',actorId:a.actorId,sessionId:a.sessionId,tournamentId:a.tournamentId,rosterEntryId:id(5),playerIdentityId:id(6),version:1,operationId:operation,entry:request.entry,address:request.address,distinction:request.distinction,displayName:'Alex Lee Example Jr.',temporaryOrdinal:1,issuedReference:null,officialMembershipVerified:false,actualMrpAwarded:false},profileLinked:false,roleGranted:false,eventEnrolled:false,paymentRecorded:false,checkedIn:false,seatAssigned:false};}
const reply=(hash,outcome)=>({kind:'legacy-roster-identity-reply-v25',actorId:a.actorId,sessionId:a.sessionId,tournamentId:a.tournamentId,operationId:op,requestHash:hash,outcome});
test('strict paper request allows missing external number but never missing address, DOB or digital fallback',()=>{
 assert.ok(validRegistrationV25(q()));
 for(const change of [x=>x.entry.scorecardType='digital',x=>x.address.street='',x=>x.entry.birthdate='2000-01-01',x=>x.entry.nonmemberWithoutNumber=false,x=>x.distinction.internalId=id(99),x=>x.sourceDigest='wrong',x=>x.decision={action:'merge',rosterEntryId:id(5)}]){const x=q();change(x);if(x.entry.nonmemberWithoutNumber===false&&x.entry.accNumber==='')assert.ok(validRegistrationV25(x),'Unknown membership reference need not block registration');else assert.equal(validRegistrationV25(x),false);}
});
test('browser recovery retains only operation/hash/nonpersonal review pins; malformed/foreign records remain unreadable',async()=>{
 const request=q(),hash=await requestHashV25(request),metadata={kind:'legacy-roster-identity-pending-v25',actorId:a.actorId,tournamentId:a.tournamentId,operationId:op,requestHash:hash,sourceRevision:request.sourceRevision,sourceDigest:request.sourceDigest,decision:request.decision},bytes=canonicalV5(metadata);
 assert.ok(readPendingV25(bytes,a.actorId,a.tournamentId));
 for(const text of ['Alex','Example','Fictional','Lee','Jr.','desk review'])assert.ok(!bytes.includes(text));
 for(const bytes of ['{bad',JSON.stringify({...metadata,actorId:id(99)}),JSON.stringify({...metadata,request}),JSON.stringify({...metadata,requestHash:'bad'})])assert.equal(readPendingV25(bytes,a.actorId,a.tournamentId),null);
 const changed=q();changed.address.street='2 Fictional Way';assert.notEqual(await requestHashV25(changed),hash);
});
test('accepted outcome binds actor/session/tournament/op/hash/identity and all zero side effects',async()=>{
 const request=q(),hash=await requestHashV25(request),r=reply(hash,recorded(request));assert.equal(readReplyV25(r,a,op,hash,request).status,'recorded');
 for(const change of [x=>x.sessionId=id(99),x=>x.operationId=id(99),x=>x.outcome.player.rosterEntryId='bad',x=>x.outcome.player.entry.firstName='Foreign',x=>x.outcome.paymentRecorded=true,x=>x.outcome.player.playerIdentityId=null]){const bad=structuredClone(r);change(bad);assert.equal(readReplyV25(bad,a,op,hash,request),null);}
 assert.equal(readReplyV25(reply(hash,null),a,op,hash).status,'absent');
});
test('open-existing is pinned to exact duplicate choice even after reload; distinct/null cannot accept it',async()=>{
 const request=q(),hash=await requestHashV25(request),choice={action:'duplicate',rosterEntryId:id(5)},r=reply(hash,{status:'open_existing',rosterEntryId:id(5),playerIdentityId:id(6)});
 assert.equal(readReplyV25(r,a,op,hash,undefined,choice).rosterEntryId,id(5));
 for(const decision of [null,{action:'distinct'},{action:'duplicate',rosterEntryId:id(99)}])assert.equal(readReplyV25(r,a,op,hash,{...request,decision}),null);
 assert.equal(readReplyV25(r,a,op,hash),null);
});
test('gate is closed by default and rejects every hosted target regardless of flags',()=>{
 const base={CRIBBAGE_LEGACY_REGISTRATION_V25:'local-reviewed-v25',CRIBBAGE_LEGACY_REGISTRATION_V25_CATALOG_HASH:pin,NEXT_PUBLIC_SUPABASE_URL:'http://localhost:9999',NEXT_PUBLIC_CRIBBAGE_TEST_APP:'fictional',NEXT_PUBLIC_CRIBBAGE_TEST_BACKEND_URL:'http://localhost:9999',NEXT_PUBLIC_CRIBBAGE_TEST_PROJECT_REF:'localfictional',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_SECRET_KEY:'sb_secret_fictional_fixture'};
 assert.equal(legacyRegistrationEnabledV25({}),false);assert.equal(legacyRegistrationEnabledV25(base),true);
 for(const env of [{...base,VERCEL_ENV:'preview'},{...base,NEXT_PUBLIC_SUPABASE_URL:'https://nnhcnvksxgxnpvdqjgpg.supabase.co'},{...base,NEXT_PUBLIC_SUPABASE_URL:'https://fnjkwymxpnsqvxtpronk.supabase.co'},{...base,CRIBBAGE_LEGACY_REGISTRATION_V25_CATALOG_HASH:''},{...base,NEXT_PUBLIC_CRIBBAGE_TEST_BACKEND_URL:'https://nnhcnvksxgxnpvdqjgpg.supabase.co'},{...base,NEXT_PUBLIC_SUPABASE_URL:'http://user:password@localhost:9999',NEXT_PUBLIC_CRIBBAGE_TEST_BACKEND_URL:'http://user:password@localhost:9999'}])assert.equal(legacyRegistrationEnabledV25(env),false);
});
function fixture(){const state={access:a,calls:[],outcome:null,after:null,paused:false};const provider=legacyRegistrationProviderV25({rpc:async(name)=>{state.calls.push(name);if(name==='get_legacy_roster_identity_capability_v25')return{error:null,data:{kind:'legacy-roster-identity-capability-v25',actorId:a.actorId,sessionId:a.sessionId,tournamentId:a.tournamentId,version:25,available:true,catalogHash:pin,writesEnabled:!state.paused}};const data=state.outcome;state.after?.();return{error:null,data};}},pin);const handler=createLegacyRegistrationHandlersV25({enabled:()=>true,access:async()=>state.access,sameOrigin:r=>r.headers.get('origin')==='http://fixture.invalid',provider});const request=(body,headers={})=>new Request('http://fixture.invalid/api',{method:'POST',headers:{origin:'http://fixture.invalid','content-type':'application/json','x-identity-actor':a.actorId,'x-identity-session':a.sessionId,...headers},body:JSON.stringify(body)});return{state,handler,request};}
test('normal handler validates canonical request digest and boundary failures before writer dispatch',async()=>{
 const request=q(),digest=await requestHashV25(request),body={operationId:op,requestHash:digest,request};
 for(const change of [f=>f.state.access=null,f=>f.state.access={...a,role:'co_director'},f=>f.state.access={...a,sessionId:id(99)}]){const f=fixture();change(f);assert.ok([403,409].includes((await f.handler(f.request(body),a.tournamentId,'write')).status));assert.ok(!f.state.calls.includes('write_legacy_roster_identity_v25'));}
 for(const headers of [{origin:'https://foreign.invalid'},{'x-identity-actor':id(99)},{'x-identity-session':id(99)}]){const f=fixture();assert.ok([403,409].includes((await f.handler(f.request(body,headers),a.tournamentId,'write')).status));assert.ok(!f.state.calls.includes('write_legacy_roster_identity_v25'));}
 const f=fixture();assert.equal((await f.handler(f.request({...body,requestHash:'0'.repeat(64)}),a.tournamentId,'write')).status,409);assert.ok(!f.state.calls.includes('write_legacy_roster_identity_v25'));
});
test('normal provider/handler consume strict saved outcome, retain null, and reject stale session after RPC',async()=>{
 const request=q(),digest=await requestHashV25(request),body={operationId:op,requestHash:digest,request};const f=fixture();f.state.outcome=reply(digest,recorded(request));assert.equal((await f.handler(f.request(body),a.tournamentId,'write')).status,200);assert.ok(f.state.calls.includes('write_legacy_roster_identity_v25'));
 const g=fixture();g.state.outcome=reply(digest,null);assert.equal((await g.handler(g.request({operationId:op,requestHash:digest,decision:null}),a.tournamentId,'reconcile')).status,200);assert.ok(!g.state.calls.includes('write_legacy_roster_identity_v25'));
 const h=fixture();h.state.outcome=reply(digest,recorded(request));h.state.after=()=>h.state.access={...a,sessionId:id(99)};assert.equal((await h.handler(h.request(body),a.tournamentId,'write')).status,503);
});

test('paused capability denies write dispatch but retains read-only reconciliation',async()=>{const request=q(),digest=await requestHashV25(request),f=fixture();f.state.paused=true;f.state.outcome=reply(digest,null);assert.equal((await f.handler(f.request({operationId:op,requestHash:digest,request}),a.tournamentId,'write')).status,503);assert.ok(!f.state.calls.includes('write_legacy_roster_identity_v25'));assert.equal((await f.handler(f.request({operationId:op,requestHash:digest,decision:null}),a.tournamentId,'reconcile')).status,200);});
test('recorded provider outcome cannot override an explicit duplicate decision after reload',async()=>{const request=q(),digest=await requestHashV25(request),decision={action:'duplicate',rosterEntryId:id(5)},r=reply(digest,recorded(request));assert.equal(readReplyV25(r,a,op,digest,undefined,decision),null);assert.equal(readReplyV25(r,a,op,digest,{...request,decision}),null);const f=fixture();f.state.outcome=r;assert.equal((await f.handler(f.request({operationId:op,requestHash:digest,decision}),a.tournamentId,'reconcile')).status,503);});
