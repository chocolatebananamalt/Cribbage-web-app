import assert from 'node:assert/strict';
import test from 'node:test';
import {SIMULATED_LINK_TOURNAMENT as tid,SIMULATED_LINK_PROFILES as profiles,simulatedLinkScope} from '../src/lib/api/simulated-player-links.ts';
import {isActivationDecisionRequest} from '../src/lib/api/roster-account-activation.ts';
import {decideRosterAccountActivation} from '../src/lib/roster-account-activation-decision.ts';
import {hasSimulatedPlayerLinks} from '../src/lib/simulated-player-links.ts';
const stage='https://nnhcnvksxgxnpvdqjgpg.supabase.co';
const id='00000000-0000-4000-8000-000000000001';
const input={actorId:profiles[0],tournamentId:tid,requestId:id,decision:'approve',confirmationPhrase:'ABCD-EFGH',operationId:id,simulatedSingleOperator:true};
test('simulation requires exact fixture, profile and staging origin',()=>{
 assert.equal(simulatedLinkScope(tid,profiles[0],stage),true);
 assert.equal(simulatedLinkScope(tid,profiles[1],stage),true);
 for(const args of [[id,profiles[0],stage],[tid,id,stage],[tid,profiles[0],'https://fnjkwymxpnsqvxtpronk.supabase.co'],[tid,profiles[0],undefined],[tid,profiles[0],stage+'.evil']])assert.equal(simulatedLinkScope(...args),false);
});
test('simulation consent is explicit, exact and approval-only',()=>{
 const {actorId,tournamentId,...body}=input;void actorId;void tournamentId;
 assert.equal(isActivationDecisionRequest(body),true);
 for(const value of [false,'true',null,1])assert.equal(isActivationDecisionRequest({...body,simulatedSingleOperator:value}),false);
 assert.equal(isActivationDecisionRequest({...body,decision:'reject'}),false);
 assert.equal(isActivationDecisionRequest({...body,operatorId:id}),false);
});
test('server simulation adapter fails closed outside staging and uses separate RPC',async()=>{
 const previous=process.env.NEXT_PUBLIC_SUPABASE_URL;const calls=[];
 const admin={async rpc(name,args){calls.push({name,args});return {data:{status:'approved',requestId:id,rosterEntryId:id,linkId:id},error:null};}};
 try{
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://fnjkwymxpnsqvxtpronk.supabase.co';
  assert.deepEqual(await decideRosterAccountActivation(admin,input),{status:'rejected'});assert.equal(calls.length,0);
  process.env.NEXT_PUBLIC_SUPABASE_URL=stage;
  assert.equal((await decideRosterAccountActivation(admin,input)).status,'approved');assert.equal(calls[0].name,'decide_simulated_player_link_v1');
  assert.equal('p_operator_id' in calls[0].args,false);
  assert.equal(await hasSimulatedPlayerLinks({async rpc(){return {data:true,error:null};}},tid,profiles[0]),true);
  assert.equal(await hasSimulatedPlayerLinks({async rpc(){return {data:{enabled:true},error:null};}},tid,profiles[0]),false);
 }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previous;}
});
