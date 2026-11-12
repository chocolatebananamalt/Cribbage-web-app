import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import {isSyntheticPaperDeployment,isSyntheticPaperArtifact,isSyntheticPaperWorkspace,syntheticPaperProjectRef}from'../src/lib/api/synthetic-paper-evidence.ts';
import{isCompletePaperGameRequest,isReviewPaperGameRequest,isAcceptedPaperGameCompletion,isAcceptedPaperGameReview,isRejectedPaperGameCompletion}from'../src/lib/api/paper-game-completion.ts';
const id=n=>`a2660000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const backend=`https://${syntheticPaperProjectRef}.supabase.co`;
test('synthetic evidence requires exact staging backend and explicit known runtime',()=>{
 for(const env of[{NODE_ENV:'development'},{NODE_ENV:'test'},{NODE_ENV:'production',VERCEL_ENV:'preview'}])assert.ok(isSyntheticPaperDeployment({...env,NEXT_PUBLIC_SUPABASE_URL:backend}));
 for(const env of[{}, {NODE_ENV:'production'}, {NODE_ENV:'unknown'}, {NODE_ENV:'test',VERCEL_ENV:'production'}, {NODE_ENV:'production',VERCEL_ENV:'production'}, {VERCEL_ENV:'unknown'}])assert.equal(isSyntheticPaperDeployment({...env,NEXT_PUBLIC_SUPABASE_URL:backend}),false);
 for(const url of['https://fnjkwymxpnsqvxtpronk.supabase.co',backend+'/',backend+'.evil.test','http://localhost:54321'])assert.equal(isSyntheticPaperDeployment({NODE_ENV:'test',NEXT_PUBLIC_SUPABASE_URL:url}),false);
});
const a={artifactId:id(1),gameId:id(2),eventId:id(3),gameVersion:1};
for(const side of['a','b'])a[side==='a'?'sideA':'sideB']={text:`SYNTHETIC TEST SCORECARD\nGame: ${a.gameId}\nCard side: ${side}\nNo physical original; no human review claimed.\n`,sha256:'a'.repeat(64),reference:`SYNTHETIC-v1:${a.artifactId}:${side}:${'a'.repeat(64)}`};
test('artifact contracts bind game, side, exact hash references and explicit provenance',()=>{
 assert.ok(isSyntheticPaperArtifact(a));const w={tournamentId:id(4),projectRef:syntheticPaperProjectRef,eventIds:[id(3)],gameIds:[id(2)],artifacts:[a]};assert.ok(isSyntheticPaperWorkspace(w,id(4)));
 for(const bad of[{...a,gameId:id(99)},{...a,sideB:a.sideA},{...a,sideA:{...a.sideA,reference:'original paper'}},{...a,sideA:{...a.sideA,text:'physical original'}},{...a,humanReviewed:true}])assert.equal(isSyntheticPaperArtifact(bad),false);
 assert.equal(isSyntheticPaperWorkspace({...w,eventIds:[id(99)]},id(4)),false);assert.equal(isSyntheticPaperWorkspace({...w,gameIds:[]},id(4)),false);assert.equal(isSyntheticPaperWorkspace({...w,artifacts:[a,a]},id(4)),false);
 assert.ok(isSyntheticPaperWorkspace({...w,artifacts:[]},id(4)),'authorized fixture with missing artifacts remains explicit and blocked, never ordinary fallback');
});
function route(review,{deployment=true,actor=id(9),sameOrigin=true}={}){
 const p=`src/app/api/v1/tournaments/[id]/synthetic-paper-game-completions/${review?'[completionId]/reviews/':''}route.ts`;const calls=[],exports={};
 const deps={isSyntheticPaperDeployment:()=>deployment,isSameOriginRequest:()=>sameOrigin,apiJson:(body,init={})=>({body,status:init.status??200}),readSmallJson:async r=>r.payload,requireVerifiedSubject:async()=>actor,withApiFailureBoundary:f=>f(),isUuid:v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v),createClient:async()=>({}),createServerOnlyAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:{status:'rejected',code:'invalid_request',completionId:id(8)},error:null};}}),isCompletePaperGameRequest,isReviewPaperGameRequest,isAcceptedPaperGameCompletion,isAcceptedPaperGameReview,isRejectedPaperGameCompletion};
 const code=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,process:{env:{}},require:()=>deps});return{exports,calls};
}
const capture={completionId:id(8),eventId:id(3),gameId:id(2),expectedGameVersion:1,sideAClaim:{winnerSide:'a',margin:23,evidenceReference:a.sideA.reference},sideBClaim:{winnerSide:'a',margin:23,evidenceReference:a.sideB.reference},idempotencyKey:id(10)};
test('new routes bind verified actor and exact scope; production, cross-origin, unauthenticated and extra fields cannot write',async()=>{
 for(const review of[false,true]){
  const payload=review?{decision:'approve',expectedGameVersion:1,sideAClaim:capture.sideAClaim,sideBClaim:capture.sideBClaim,idempotencyKey:id(10)}:capture;
  const params=Promise.resolve({id:id(4),completionId:id(8)}),ok=route(review);assert.equal((await ok.exports.POST({payload},{params})).status,409);assert.equal(ok.calls.length,1);assert.equal(ok.calls[0].args.p_actor_id,id(9));assert.equal(ok.calls[0].args.p_tournament_id,id(4));assert.match(ok.calls[0].name,/synthetic_paper_game_v1$/);
  for(const [options,status]of[[{deployment:false},404],[{sameOrigin:false},403],[{actor:null},401]]){const r=route(review,options);assert.equal((await r.exports.POST({payload},{params})).status,status);assert.equal(r.calls.length,0);}
  const r=route(review);assert.equal((await r.exports.POST({payload:{...payload,actorId:id(99)}},{params})).status,400);assert.equal(r.calls.length,0);
 }
});
test('migration is empty by default; no fixture ids, seed, enrollment RPC or human grants',()=>{
 const s=fs.readFileSync('database/migrations/0266_synthetic_scorecard_evidence_v1.sql','utf8');assert.doesNotMatch(s,/insert into app\.synthetic_paper_(deployments|fixtures)_v1/i);assert.match(s,/synthetic_fixture_not_idle/);assert.match(s,/if not found or current_setting/);assert.match(s,/human_review_claimed boolean not null default false check\(not human_review_claimed\)/);assert.match(s,/app\.reject_immutable_history/);assert.doesNotMatch(s,/grant .*to (authenticated|anon)/i);
});
