import test from'node:test';import assert from'node:assert/strict';import crypto from'node:crypto';import fs from'node:fs';import vm from'node:vm';import ts from'typescript';
import{createMixedHandlers}from'../src/lib/api/synthetic-mixed-handlers.ts';
import{isSyntheticMixedLocalDeployment,isMixedCapability,isMixedOwnHybrid,isMixedOfficialEnvelope,isMixedOwnAckRequest,isMixedOwnAckReceipt,isMixedOfficialReceipt,isMixedRejectedReceipt,projectMixedOfficialWorkspace,isMixedOfficialWorkspace}from'../src/lib/api/synthetic-mixed-evidence.ts';
import{readSmallJson}from'../src/lib/api/bounded-json.ts';
const id=n=>`a2990000-0000-4000-8000-${String(n).padStart(12,'0')}`,actor=id(1),tid=id(2),eid=id(3),gid=id(4),ppgid=id(5),aid=id(6),ppaid=id(7),sid=id(8),cid=id(9),completion=id(10),operation=id(11);
const env={NODE_ENV:'test',CRIBBAGE_LOCAL_MIXED_REHEARSAL:'1',CRIBBAGE_LOCAL_MIXED_BACKEND_PORT:'54321',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321'};
const cap={kind:'synthetic-mixed-18-v2',tournamentId:tid,eventId:eid,actorId:actor,participantCount:18,digitalCount:6,paperCount:12,matchCount:108,isDigitalParticipant:true,isOfficial:true,sourceCurrent:true,tournamentOpen:true,eventStarted:true,officialIdentityConfirmed:true};
function artifact(gameId,artifactId,pairing,eventId=eid){const text=JSON.stringify({schema:'synthetic-mixed-paper-v1',tournamentId:tid,eventId,gameId,pairing,sideA:id(20),sideB:id(21),digitalParticipantId:pairing==='PD'?id(20):null,winnerSide:'a',spreadPoints:40,physicalOriginal:false,fictionalOpponentPlayed:false,independentHumanPlayClaimed:false});const sha256=crypto.createHash('sha256').update(text).digest('hex');return{artifactId,gameId,eventId,pairing,expectedGameVersion:pairing==='PD'?2:1,text,sha256,sideAReference:`SYNTHETIC-MIXED-v1:${artifactId}:a:${sha256}`,sideBReference:`SYNTHETIC-MIXED-v1:${artifactId}:b:${sha256}`,playerAttested:true};}
const pdArtifact=artifact(gid,aid,'PD'),ppArtifact=artifact(ppgid,ppaid,'PP');
const synthetic={kind:'synthetic-mixed-workspace-v1',tournamentId:tid,notice:'Fictional paper evidence; no physical original or independent human play claimed.',fixtures:[{eventId:eid,sourceSha256:'a'.repeat(64)}],artifacts:[pdArtifact,ppArtifact]};
const side={displayName:'Fictional Paper',verificationId:'C-1',profileLinked:false};
const ppCandidate={gameId:ppgid,eventId:eid,eventName:'LOCAL Main',gameNumber:1,gameVersion:1,sideA:side,sideB:{...side,verificationId:'C-2'}};
const ppReview={...ppCandidate,completionId:completion};delete ppReview.eventId;
const hybridCandidate={gameId:gid,eventId:eid,eventName:'LOCAL Main',gameNumber:1,gameVersion:2,digitalSubmissionId:sid,digitalWinnerSide:'a',digitalMargin:40,digitalSide:'a',digitalPlayerName:'Local Digital',paperPlayerName:'Fictional Paper',paperVerificationId:'A-4'};
const hybridReview={...hybridCandidate,caseId:cid};delete hybridReview.eventId;
const paper={tournamentId:tid,tournamentName:'LOCAL Mock',actorRole:'co_director',actorIdentityConfirmed:true,unboundOfficials:[],rosterChoices:[],candidates:[ppCandidate],reviewCases:[ppReview]};
const hybrid={tournamentId:tid,tournamentName:'LOCAL Mock',actorRole:'cross_checker',actorIdentityConfirmed:true,candidates:[hybridCandidate],reviewCases:[hybridReview]};
const own={kind:'own-synthetic-mixed-hybrid-v1',gameId:gid,eventId:eid,tournamentId:tid,artifactId:aid,gameVersion:2,notice:'Your opponent is fictional.',scriptedWinnerSide:'a',scriptedSpreadPoints:40,digitalSubmissionId:sid,digitalWinnerSide:'a',digitalMargin:40,acknowledged:false,authoritative:false};
const ack={artifactId:aid,expectedGameVersion:2,digitalSubmissionId:sid,confirmed:true,idempotencyKey:operation};
const claim=(a,side)=>({winnerSide:'a',margin:40,evidenceReference:a[side==='a'?'sideAReference':'sideBReference']});
const requests={
 'paper-capture':{gameId:ppgid,completionId:completion,artifactId:ppaid,expectedGameVersion:1,sideAClaim:claim(ppArtifact,'a'),sideBClaim:claim(ppArtifact,'b')},
 'paper-review':{completionId:completion,artifactId:ppaid,expectedGameVersion:1,sideAClaim:claim(ppArtifact,'a'),sideBClaim:claim(ppArtifact,'b'),decision:'approve'},
 'hybrid-capture':{gameId:gid,caseId:cid,artifactId:aid,expectedGameVersion:2,digitalSubmissionId:sid,paperClaim:claim(pdArtifact,'b')},
 'hybrid-review':{caseId:cid,artifactId:aid,expectedGameVersion:2,digitalSubmissionId:sid,digitalWinnerSide:'a',digitalMargin:40,paperClaim:claim(pdArtifact,'b'),decision:'approve'},
};
const native=(phase,r)=>phase==='paper-capture'?{status:'pending_review',completionId:r.completionId,tournamentId:tid,eventId:eid,gameId:ppgid,gameVersion:1,winnerSide:'a',margin:40,evidenceCount:2,authoritative:false}
 :phase==='hybrid-capture'?{status:'pending_review',caseId:r.caseId,gameId:gid,gameVersion:2,digitalSubmissionId:sid,winnerSide:'a',margin:40,authoritative:false}
 :{status:r.decision==='approve'?'approved':'rejected',decision:r.decision,[phase==='paper-review'?'completionId':'caseId']:phase==='paper-review'?completion:cid,gameId:phase==='paper-review'?ppgid:gid,gameVersion:r.expectedGameVersion+(r.decision==='approve'?1:0),authoritative:r.decision==='approve',scorelinesCreated:r.decision==='approve'};
function harness(options={}){
 const calls=[],userCalls=[];let identities=0;
 const json=(body,init={})=>new Response(JSON.stringify(body),{...init,headers:{'content-type':'application/json','cache-control':'private, no-store'}});
 const handlers=createMixedHandlers({env:{...env,...options.env},getIdentity:async()=>{identities++;if(options.actor===null)return null;return{actorId:options.actor??actor,rpc:async(name,args)=>{userCalls.push({name,args});if(options.userError)return{data:null,error:{code:'missing'}};
  if(name==='get_own_synthetic_mixed_hybrid_v1')return{data:options.ownData===undefined?own:options.ownData,error:null};
  return{data:options.result??{status:'synthetic_opponent_acknowledged',attestationId:id(12),artifactId:args.p_request.artifactId,gameId:args.p_request.gameId,digitalSubmissionId:args.p_request.digitalSubmissionId,gameVersion:args.p_request.expectedGameVersion,authoritative:false},error:null};}};},
  adminRpc:async(name,args)=>{calls.push({name,args});if(options.throwRpc)throw Error('RPC failed');if(options.rpcError)return{data:null,error:{code:'PGRST202'}};
   if(name==='get_synthetic_mixed_capability_v2')return{data:options.capData===undefined?cap:options.capData,error:null};
   if(name==='get_synthetic_mixed_workspace_v1')return{data:options.syntheticData??synthetic,error:null};
   if(name==='get_paper_game_completion_workspace_v1')return{data:options.paperData??paper,error:null};
   if(name==='get_hybrid_game_workspace_v1')return{data:options.hybridData??hybrid,error:null};
   const phase=name.includes('_paper_')?name.startsWith('capture')?'paper-capture':'paper-review':name.startsWith('capture')?'hybrid-capture':'hybrid-review';return{data:options.result??native(phase,args.request),error:null};},
  readJson:readSmallJson,sameOrigin:r=>r.headers.get('origin')===new URL(r.url).origin&&r.headers.get('sec-fetch-site')!=='cross-site',json,
  boundary:async run=>{try{return await run();}catch{return json({error:'operation_unavailable'},{status:503});}}});
 return{handlers,calls,userCalls,get identities(){return identities;}};
}
const context=(extra={})=>({params:Promise.resolve({id:tid,eventId:eid,...extra})});
const get=()=>new Request('http://127.0.0.1:32123/api');
const post=(body,headers={})=>new Request('http://127.0.0.1:32123/api',{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:32123',...headers},body:JSON.stringify(body)});

test('local gate rejects hosted, preview, production, ambiguous URLs and disabled opt-in before any client',async()=>{
 assert.equal(isSyntheticMixedLocalDeployment(env),true);assert.equal(isSyntheticMixedLocalDeployment({...env,NEXT_PUBLIC_SUPABASE_URL:'http://localhost:54321'}),true);
 for(const changed of[{CRIBBAGE_LOCAL_MIXED_REHEARSAL:undefined},{NODE_ENV:'production'},{VERCEL_ENV:'preview'},{VERCEL_ENV:'production'},
  {NEXT_PUBLIC_SUPABASE_URL:'https://nnhcnvksxgxnpvdqjgpg.supabase.co'},{NEXT_PUBLIC_SUPABASE_URL:'http://localhost:54322'},
  {NEXT_PUBLIC_SUPABASE_URL:'http://localhost.evil:54321'},{NEXT_PUBLIC_SUPABASE_URL:'http://user@localhost:54321'},{NEXT_PUBLIC_SUPABASE_URL:'http://localhost:54321/?x=1'},
  {CRIBBAGE_LOCAL_MIXED_BACKEND_PORT:'0'},{CRIBBAGE_LOCAL_MIXED_BACKEND_PORT:'65536'}]){
  const h=harness({env:changed});assert.equal((await h.handlers.capabilityGET(get(),context())).status,404);assert.equal(h.identities,0);assert.equal(h.calls.length,0);assert.equal(h.userCalls.length,0);
 }
});
test('capability uses server identity and distinguishes unsupported from errors without ordinary fallback',async()=>{
 const h=harness();const r=await h.handlers.capabilityGET(get(),context());assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/private.*no-store/);assert.ok(isMixedCapability(await r.json(),actor,tid,eid));assert.equal(h.calls[0].args.p_actor_id,actor);
 for(const[options,status]of[[{actor:null},401],[{actor:'bad'},401],[{capData:null},404],[{capData:{...cap,actorId:id(99)}},503],[{capData:{...cap,matchCount:102}},503],[{rpcError:true},503],[{throwRpc:true},503]])assert.equal((await harness(options).handlers.capabilityGET(get(),context())).status,status);
 assert.equal((await harness().handlers.capabilityGET(get(),context({eventId:'bad'}))).status,400);
});
test('own PD read and acknowledgment use authenticated RPC only and return scoped non-authoritative receipt',async()=>{
 const h=harness();const loaded=await h.handlers.ownGET(get(),context({gameId:gid}));assert.equal(loaded.status,200);assert.ok(isMixedOwnHybrid(await loaded.json(),tid,eid,gid));
 const r=await h.handlers.ownPOST(post(ack),context({gameId:gid}));assert.equal(r.status,200);const body=await r.json();assert.ok(isMixedOwnAckReceipt(body,actor,tid,eid,gid,ack));assert.equal(body.result.authoritative,false);
 assert.deepEqual(h.userCalls.map(c=>c.name),['get_own_synthetic_mixed_hybrid_v1','attest_synthetic_mixed_hybrid_v1']);assert.ok(h.calls.every(c=>c.name==='get_synthetic_mixed_capability_v2'));assert.ok(!('p_actor_id'in h.userCalls[1].args));assert.equal(h.userCalls[1].args.p_request.gameId,gid);
 for(const key of['actorId','tournamentId','eventId','gameId']){const bad=harness();assert.equal((await bad.handlers.ownPOST(post({...ack,[key]:id(99)}),context({gameId:gid}))).status,400);assert.equal(bad.userCalls.length,0);}
 for(const expectedGameVersion of[null,'2',0,1.5])assert.equal((await harness().handlers.ownPOST(post({...ack,expectedGameVersion}),context({gameId:gid}))).status,400);
 assert.equal((await harness().handlers.ownPOST(post({...ack,confirmed:false}),context({gameId:gid}))).status,400);
 assert.equal((await harness().handlers.ownPOST(post(ack,{origin:'https://elsewhere.invalid'}),context({gameId:gid}))).status,403);
 assert.equal((await harness().handlers.ownPOST(post({...ack,extra:'x'.repeat(3000)}),context({gameId:gid}))).status,400);
 assert.equal((await harness({userError:true}).handlers.ownPOST(post(ack),context({gameId:gid}))).status,503);
 assert.equal((await harness({capData:{...cap,isDigitalParticipant:false}}).handlers.ownGET(get(),context({gameId:gid}))).status,404);
 assert.equal((await harness({ownData:null}).handlers.ownGET(get(),context({gameId:gid}))).status,404);
 assert.equal((await harness({ownData:{...own,gameId:id(99)}}).handlers.ownGET(get(),context({gameId:gid}))).status,503);
});
test('retained own receipt binds actor/path/request and old version; source drift does not suppress SQL replay',async()=>{
 const h=harness({capData:{...cap,sourceCurrent:false,tournamentOpen:false,eventStarted:false}});const response=await h.handlers.ownPOST(post(ack),context({gameId:gid}));assert.equal(response.status,200);const r=await response.json();
 assert.ok(isMixedOwnAckReceipt(r,actor,tid,eid,gid,ack));for(const changed of[{...ack,expectedGameVersion:3},{...ack,idempotencyKey:id(99)},{...ack,artifactId:id(99)}])assert.equal(isMixedOwnAckReceipt(r,actor,tid,eid,gid,changed),false);
 assert.equal(isMixedOwnAckReceipt(r,id(99),tid,eid,gid,ack),false);
 const rejected=await harness({result:{status:'rejected',code:'idempotency_conflict'}}).handlers.ownPOST(post(ack),context({gameId:gid}));assert.equal(rejected.status,409);assert.ok(isMixedRejectedReceipt(await rejected.json(),actor,tid,eid,gid,'own-ack',ack));
 assert.equal((await harness({result:{status:'rejected',code:'unknown'}}).handlers.ownPOST(post(ack),context({gameId:gid}))).status,503);
 assert.equal((await harness({result:{status:'synthetic_opponent_acknowledged',attestationId:id(12),artifactId:aid,gameId:gid,digitalSubmissionId:sid,gameVersion:2,authoritative:true}}).handlers.ownPOST(post(ack),context({gameId:gid}))).status,503);
});
test('official workspace validates native read models and filters unrelated events including game13',async()=>{
 const otherArtifact=artifact(id(91),id(92),'PP',id(90)),otherCandidate={...ppCandidate,gameId:id(91),eventId:id(90),gameNumber:13};
 const s={...synthetic,fixtures:[...synthetic.fixtures,{eventId:id(90),sourceSha256:'b'.repeat(64)}],artifacts:[...synthetic.artifacts,otherArtifact]};
 const h=harness({syntheticData:s,paperData:{...paper,candidates:[ppCandidate,otherCandidate]}});const r=await h.handlers.officialGET(get(),context());assert.equal(r.status,200);const w=await r.json();assert.ok(isMixedOfficialWorkspace(w,actor,tid,eid));assert.equal(w.artifacts.length,2);assert.equal(w.paperCandidates.length,1);assert.equal(w.paperCandidates[0].eventId,eid);
 const player=harness({capData:{...cap,isOfficial:false,officialIdentityConfirmed:false}});assert.equal((await player.handlers.officialGET(get(),context())).status,404);assert.equal(player.calls.length,1);
 assert.equal(projectMixedOfficialWorkspace(cap,synthetic,{...paper,candidates:[{...ppCandidate,gameVersion:null}]},hybrid),null);
 assert.equal((await harness({syntheticData:{...synthetic,artifacts:[{...ppArtifact,eventId:id(99)}]}}).handlers.officialGET(get(),context())).status,503);
});
test('all four official operations bind verified actor, route scope, exact request and native receipt',async()=>{
 for(const phase of Object.keys(requests)){
  const[kind,action]=phase.split('-'),body={gameId:phase.startsWith('paper')?ppgid:gid,request:requests[phase],idempotencyKey:operation};assert.ok(isMixedOfficialEnvelope(body,phase));
  const h=harness();const r=await h.handlers.officialPOST(post(body),context({kind,phase:action}));assert.equal(r.status,200,phase);const result=await r.json();const game=kind==='paper'?ppgid:gid;assert.ok(isMixedOfficialReceipt(result,actor,tid,eid,game,phase,body));
  const call=h.calls.at(-1);assert.equal(call.args.actor,actor);assert.equal(call.args.tid,tid);assert.equal(call.args.eid,eid);assert.deepEqual(call.args.request,body.request);assert.equal(call.args.operation,operation);
  for(const payload of[{...body,actorId:id(99)},{...body,request:{...body.request,actorId:id(99)}},{...body,idempotencyKey:'bad'},{...body,request:{...body.request,expectedGameVersion:null}}]){
   const bad=harness();assert.equal((await bad.handlers.officialPOST(post(payload),context({kind,phase:action}))).status,400);assert.equal(bad.calls.filter(c=>c.name.startsWith('capture_')||c.name.startsWith('review_')).length,0);
  }
  const mismatched=harness({result:{...native(phase,body.request),gameId:id(99)}});assert.equal((await mismatched.handlers.officialPOST(post(body),context({kind,phase:action}))).status,503);
  const corrupted=harness();assert.equal((await corrupted.handlers.officialPOST(post({...body,gameId:id(99)}),context({kind,phase:action}))).status,400);
  assert.equal(corrupted.calls.filter(c=>c.name.startsWith('capture_')||c.name.startsWith('review_')).length,0,'Outer retained game mismatch must be rejected before authoritative RPC');
  const conflict=await harness({result:{status:'rejected',code:'idempotency_conflict'}}).handlers.officialPOST(post(body),context({kind,phase:action}));assert.equal(conflict.status,409);assert.ok(isMixedRejectedReceipt(await conflict.json(),actor,tid,eid,game,phase,body));
  assert.equal((await harness({result:{status:'rejected',code:'unknown'}}).handlers.officialPOST(post(body),context({kind,phase:action}))).status,503);
 }
});
test('unknown official route/foreign artifact cannot write; exact replay is forwarded despite source/readiness drift',async()=>{
 const body={gameId:ppgid,request:requests['paper-capture'],idempotencyKey:operation},h=harness({capData:{...cap,sourceCurrent:false,tournamentOpen:false,officialIdentityConfirmed:false}});
 assert.equal((await h.handlers.officialPOST(post(body),context({kind:'paper',phase:'capture'}))).status,200);assert.equal(h.calls.at(-1).name,'capture_synthetic_mixed_paper_v1');
 assert.equal((await harness().handlers.officialPOST(post(body),context({kind:'enroll',phase:'capture'}))).status,400);
 assert.equal((await harness().handlers.officialPOST(post({...body,request:{...body.request,artifactId:id(99)}}),context({kind:'paper',phase:'capture'}))).status,400);
 assert.equal((await harness().handlers.officialPOST(post({...body,request:{...body.request,gameId:id(99)}}),context({kind:'paper',phase:'capture'}))).status,400);
 assert.equal(isMixedOwnAckRequest({...ack,confirmed:'true'}),false);
});
test('actual Next route exports delegate to the same factory handlers',async()=>{
 for(const[path,method,key,extra,payload]of[
  ['synthetic-mixed-capability','GET','capabilityGET',{},null],['synthetic-mixed-games/[gameId]','GET','ownGET',{gameId:gid},null],
  ['synthetic-mixed-games/[gameId]','POST','ownPOST',{gameId:gid},ack],['synthetic-mixed-official','GET','officialGET',{},null],
  ['synthetic-mixed-official/[kind]/[phase]','POST','officialPOST',{kind:'paper',phase:'capture'},{gameId:ppgid,request:requests['paper-capture'],idempotencyKey:operation}]]){
  const h=harness(),exports={};const source=fs.readFileSync(`src/app/api/v1/tournaments/[id]/events/[eventId]/${path}/route.ts`,'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({createMixedProductionHandlers:()=>h.handlers})});
  assert.equal(exports[method],h.handlers[key]);assert.equal((await exports[method](method==='GET'?get():post(payload),context(extra))).status,200);
 }
});
