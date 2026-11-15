import assert from 'node:assert/strict';
import test from 'node:test';
import {playoffPrizeBasisFixtureV2} from './fixtures/playoff-prize-basis-v2.mjs';
import {buildPlayoffPrizeProposalBasisV2} from '../src/lib/finance/playoff-prize-proposal-basis-v2.ts';
import {buildPlayoffPrizeProposalSaveV2,readPlayoffPrizeProposalWorkspaceV2,readPlayoffPrizeProposalOperationV2,readPlayoffPrizeProposalReplyV2,readPlayoffPrizeProposalSaveV2,serializePlayoffPrizeProposalSaveV2,playoffPrizeProposalRequestHashV2} from '../src/lib/finance/playoff-prize-proposal-store-v2.ts';
import {createPlayoffPrizeProposalHandlersV2} from '../src/lib/api/playoff-prize-proposal-handlers-v2.ts';

const id=n=>`91000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(90),tournamentId:id(1),eventId:id(2)};
function native(actorId=scope.actorId){
 const input=playoffPrizeBasisFixtureV2(),ledger=input.ledger.current;
 ledger.mode='documented_actual';ledger.pools=[];
 ledger.sources[0].allocations=ledger.sources[0].allocations.filter(p=>p.bucket==='regular_entry');ledger.sources[0].amountMinor=200000;
 input.ledger.retained=structuredClone(ledger);
 return {status:'source_available',kind:'playoff-prize-native-source-v2',...scope,actorId,sourceDigest:(actorId===scope.actorId?'d':'e').repeat(64),capture:{bindingId:id(40),activationId:id(41),setupEventVersionId:id(42),contextReviewId:id(43),intentActorId:id(44),intentOperationId:id(45),input},coverage:{additionalIncome:'not_supported',optionalPools:'blocked',feeCoverage:'unverified',fundReview:'unverified'},proposalOnly:true,finalizationAllowed:false,payoutAuthorized:false,moneyMoved:false};
}
function proposal(source){const basis=buildPlayoffPrizeProposalBasisV2(source.capture.input);assert.equal(basis.status,'proposal_basis');return {source:basis.source,input:basis.input,overrideHistory:[]};}
function request(source=native()){return {kind:'playoff-prize-proposal-save-v2',operationId:id(80),expectedRevisionId:null,nativeSourceDigest:source.sourceDigest,input:source.capture.input,overrideHistory:[],reason:'Review current whole groups',mode:'append',confirmed:true};}
function revision(source=native(id(91))){return {revisionId:id(81),version:1,priorRevisionId:null,actorId:source.actorId,operationId:id(80),tournamentId:scope.tournamentId,eventId:scope.eventId,nativeSourceDigest:source.sourceDigest,sourceCapture:source,input:source.capture.input,overrideHistory:[],mode:'append',reason:'Original review',createdAt:'2026-11-08T06:00:00.000Z',proposalOnly:true,payoutAuthorized:false,moneyMoved:false};}
function workspace(source=native(),head=revision(),stale=false){return {kind:'playoff-prize-proposal-workspace-v2',...scope,nativeSource:source,head,stale,writeAuthorized:false,finalizationAllowed:false,moneyMoved:false};}
function operation(req=request(),result={status:'rejected',code:'head_conflict'}){const raw=serializePlayoffPrizeProposalSaveV2(req);assert(raw);return {kind:'playoff-prize-proposal-operation-v2',...scope,operationId:req.operationId,requestText:raw,requestHash:playoffPrizeProposalRequestHashV2(raw),result};}

test('another official can append unchanged shared evidence despite actor-bound digest changing',()=>{
 const source=native(),w=workspace(source),before=structuredClone(w);
 assert(readPlayoffPrizeProposalWorkspaceV2(w,scope));
 const saved=buildPlayoffPrizeProposalSaveV2(w,proposal(source),'Co-director review','append',id(82),true);
 assert(saved);assert.equal(saved.expectedRevisionId,id(81));assert.equal(saved.nativeSourceDigest,source.sourceDigest);
 assert.equal(buildPlayoffPrizeProposalSaveV2(w,proposal(source),'No change','adopt-current',id(82),true),null);
 assert.deepEqual(w,before);
});

test('capture-only provenance change requires explicit adoption even when calculation input is identical',()=>{
 const source=native();source.capture.contextReviewId=id(49);
 const w=workspace(source,revision(),true),p=proposal(source);
 assert(readPlayoffPrizeProposalWorkspaceV2(w,scope));
 assert.equal(buildPlayoffPrizeProposalSaveV2(w,p,'Append old source','append',id(82),true),null);
 assert(buildPlayoffPrizeProposalSaveV2(w,p,'Adopt reviewed context','adopt-current',id(82),true));
 assert.equal(buildPlayoffPrizeProposalSaveV2({...w,stale:false},p,'Hidden stale evidence','append',id(82),true),null);
});

test('immutable historical operation receipt needs no current source and binds every submitted field',()=>{
 const source=native(),req=request(source),rev={...revision(source),reason:req.reason};
 const receipt=operation(req,{status:'saved',revision:rev});
 assert(readPlayoffPrizeProposalOperationV2(receipt,scope,req));
 for(const mutate of [r=>r.result.revision.actorId=id(91),r=>r.result.revision.priorRevisionId=id(82),r=>r.result.revision.input.ledger.currentAllocationRevisionId=id(83),r=>r.result.revision.reason='Different reason',r=>r.requestText+=' ',r=>r.eventId=id(84)]){
  const bad=structuredClone(receipt);mutate(bad);assert.equal(readPlayoffPrizeProposalOperationV2(bad,scope,req),null);
 }
});

test('recorded rejection binds exact actor, operation, scope, bytes and hash',()=>{
 const req=request(),receipt=operation(req);assert(readPlayoffPrizeProposalOperationV2(receipt,scope,req));
 for(const key of ['actorId','operationId','tournamentId','eventId','requestText','requestHash']){
  const bad=structuredClone(receipt);bad[key]=key==='requestText'?receipt.requestText+' ':key==='requestHash'?'f'.repeat(64):id(99);
  assert.equal(readPlayoffPrizeProposalOperationV2(bad,scope,req),null,key);
 }
});

test('absence/incomplete/blocked attempts stay distinct from immutable outcomes and no-record proof',()=>{
 const req=request(),raw=serializePlayoffPrizeProposalSaveV2(req),binding={...scope,operationId:req.operationId,requestHash:playoffPrizeProposalRequestHashV2(raw)};
 for(const [status,code] of [['unknown','operation_not_found'],['unknown','operation_incomplete'],['blocked','native_source_unavailable'],['unavailable','feature_disabled'],['retry_exact','source_busy']]){
  const attempt={kind:'playoff-prize-proposal-attempt-v2',...binding,status,code};
  assert.deepEqual(readPlayoffPrizeProposalReplyV2(attempt,scope,req),attempt);
  assert.equal(readPlayoffPrizeProposalOperationV2(attempt,scope,req),null);
 }
 assert.equal(readPlayoffPrizeProposalReplyV2({kind:'playoff-prize-proposal-no-record-v2',...binding},scope,req),null);
});

test('unsafe aggregate and malformed lineage cannot enter a serializable proposal request',()=>{
 for(const history of [
  [{recordId:id(60),firstPlace:5,lastPlace:8,priorRecordId:null,perPersonMinor:9007199254740000,voided:false,reason:'Exceeds representable group total'}],
  [{recordId:id(60),firstPlace:3,lastPlace:4,priorRecordId:id(61),perPersonMinor:500,voided:false,reason:'Missing prior'}],
  [{recordId:id(60),firstPlace:3,lastPlace:3,priorRecordId:null,perPersonMinor:500,voided:false,reason:'Split equal group'}],
 ]) assert.equal(readPlayoffPrizeProposalSaveV2({...request(),overrideHistory:history}),null);
});

test('handler discards a successful RPC receipt if signed-in actor changes during the call',async()=>{
 const req=request(),receipt=operation(req);let actor=scope.actorId,saves=0;
 const client={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},rpc:async(name)=>{
  if(name==='get_tournament_role')return {data:'director',error:null};
  saves++;actor=id(91);return {data:receipt,error:null};
 }};
 const handlers=createPlayoffPrizeProposalHandlersV2({enabled:()=>true,readEnabled:()=>true,writeEnabled:()=>true,recoveryEnabled:()=>true,client:async()=>client,sameOrigin:()=>true,readJson:async()=>req,json:(body,init)=>Response.json(body,init),boundary:f=>f()});
 const response=await handlers.POST(new Request('https://local.invalid/proposals',{method:'POST',headers:{'x-expected-actor-id':scope.actorId}}),{params:Promise.resolve({id:scope.tournamentId,eventId:scope.eventId})});
 assert.equal(saves,1);assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'operation_outcome_unknown'});
});
