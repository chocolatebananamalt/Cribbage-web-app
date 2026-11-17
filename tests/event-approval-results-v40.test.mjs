import test from 'node:test';import assert from 'node:assert/strict';
import {eventApprovalResultsEnabledV40 as gate,projectEventApprovalResultsV40 as project} from '../src/lib/results/event-approval-results-v40.ts';
import {readResultsCompletionV40 as read} from '../src/lib/results/completion-read-v40.ts';
import {projectModernCloseViewV1} from '../src/lib/finance/modern-event-close-transport-v1.ts';
import {eventApprovalFixtureV40 as fixture,approvalIdV40 as id} from './helpers/event-approval-fixture-v40.mjs';
import {regularPrizeV3WiringFixture as pageFixture,renderedNodes} from './helpers/regular-prize-v3-wiring-fixture.mjs';
import {withFictionalCloseoutEnvV40} from './helpers/fictional-closeout-env-v40.mjs';
function ports(mode='review'){
 const f=fixture(mode),state={actor:f.scope.actorId,sid:id(90),role:'director',calls:[],after:null};
 const normal={auth:{getClaims:async()=>({data:{claims:{sub:state.actor,session_id:state.sid}},error:null}),getUser:async()=>({data:{user:{id:state.actor}},error:null})},rpc:async()=>({data:state.role,error:null})};
 const service=async(name,args)=>{state.calls.push({name,args});if(state.after)state.after(name);if(name==='get_regular_consolation_final_workspace_v1')return{data:{status:'held',code:'not_regular_consolation'},error:null};if(name==='get_modern_event_final_workspace_v1')return{data:f.event,error:null};if(name==='get_modern_event_closure_workspace_v1')return{data:f.closure,error:null};if(name==='get_selected_step_pool_record_provider_v3')return{data:f.pool.history,error:null};if(name==='get_selected_step_pool_source_provider_v3')return{data:f.pool.s,error:null};throw Error('Unexpected RPC '+name);};
 return{f,state,normal,service,options:{enabled:()=>true,poolEnabled:false,normal:async()=>normal,service:()=>service,scope:f.scope,qualificationId:f.qid}};
}
test('real source decoder and read transport yield current review/recorded approval; output has no amounts or source identities',async()=>{
 for(const mode of ['review','recorded']){const p=ports(mode);const v=projectModernCloseViewV1(p.f.event,p.f.scope,'event');assert(v,'fixture must pass unchanged decoder');const status=mode==='review'?'final-approval-required':'approval-saved-closure-unverified';assert.deepEqual(project(v,p.f.scope,p.f.qid),{status});const result=await read(p.options);assert.deepEqual(result,{poolProposal:null,approval:{status}});assert(p.state.calls.every(c=>!c.name.startsWith('record_')));assert(!JSON.stringify(result).includes('Minor'));}
});
test('disabled gate creates no clients; current qualification/scope, money or impossible stage combinations are withheld',async()=>{
 let calls=0;assert.equal(gate(),false);assert.equal(await read({...ports().options,enabled:gate,normal:async()=>{calls++;throw Error('closed')}}),null);assert.equal(calls,0);
 const p=ports(),v=projectModernCloseViewV1(p.f.event,p.f.scope,'event');for(const bad of [{...v,scope:{...p.f.scope,eventId:id(99)}},{...v,moneyMoved:true},{...v,status:'recorded',recordId:null},{...v,code:'unknown'},{...v,review:{...v.review,qualificationId:id(99)}}])assert.equal(project(bad,p.f.scope,p.f.qid),null);
});
test('closure proof is distinct from saved approval; pool approval never becomes final approval',()=>{
 const p=ports(),v=projectModernCloseViewV1(p.f.event,p.f.scope,'event');for(const stage of ['closure','regular-closure']){let r={...v,code:'director_closure_required',review:{...v.review,stage,finalSnapshotId:id(72)}};if(stage==='regular-closure')Object.assign(r.review,{poolProposalRevisionId:null,poolFinalId:null,qMinor:0,sideMinor:0,pools:[]});assert.deepEqual(project(r,p.f.scope,p.f.qid),{status:'approval-saved-play-open'});assert.deepEqual(project({...r,status:'recorded',recordId:id(73),code:'event_play_closed'},p.f.scope,p.f.qid),{status:'play-closed'});assert.equal(project({...r,review:{...r.review,finalSnapshotId:undefined}},p.f.scope,p.f.qid),null);}
 assert.deepEqual(project({...v,review:{...v.review,stage:'pool',poolFinalId:null}},p.f.scope,p.f.qid),{status:'pool-review-required'});assert.equal(project({...v,status:'recorded',recordId:id(73),review:{...v.review,stage:'pool',poolFinalId:null}},p.f.scope,p.f.qid),null);
});
test('actual existing closure read decoder reaches play-open/closed with synthetic local gate environment and zero writes',async()=>withFictionalCloseoutEnvV40(async()=>{
 for(const mode of ['recorded','closed']){const p=ports(mode);p.options.poolEnabled=true;const result=await read(p.options);assert(result.poolProposal,'prior pool capture must genuinely succeed');assert.deepEqual(result.approval,{status:mode==='closed'?'play-closed':'approval-saved-play-open'});assert.equal(p.state.calls.filter(c=>c.name==='get_modern_event_closure_workspace_v1').length,2);assert(p.state.calls.every(c=>c.name.startsWith('get_')));}
}));
test('role/session switch, provider failure or drift after prior pool read withholds BOTH views',async()=>{
 for(const mode of ['actor','role','session','error','drift','qualification']){const p=ports();p.options.poolEnabled=true;let reads=0;if(mode==='actor')p.state.actor=id(99);if(mode==='qualification')p.options.qualificationId=id(99);p.state.after=name=>{if(name==='get_modern_event_final_workspace_v1'&&++reads===2){if(mode==='role')p.state.role='co_director';if(mode==='session')p.state.sid=id(99);if(mode==='error')throw Error('unavailable');if(mode==='drift')p.f.event={status:'held',code:'changed_source'};}};assert.equal(await read(p.options),null,mode);assert(!p.state.calls.some(c=>c.name.startsWith('record_')));}
});
test('page mounts only supported finalized ordinary primary-Director status; old disabled path remains unchanged',async()=>{
 for(const mode of ['main','consolation','closed','co_director','synthetic','manual','custom','satellite']){const f=pageFixture(mode==='consolation'?'consolation':'main');f.state.gate=false;f.state.approvalGate=mode!=='closed';f.state.completionView={poolProposal:null,approval:{status:'approval-saved-play-open'}};if(mode==='co_director')f.state.role=mode;if(mode==='synthetic')f.state.synthetic={eventIds:[f.state.eventId]};if(['custom','satellite'].includes(mode))f.state.kind=mode;if(mode==='manual')f.state.scoringMethod=mode;const tree=await f.page(),count=renderedNodes(tree).filter(n=>n.type===f.EventApprovalResultsViewV40).length;assert.equal(count,['main','consolation'].includes(mode)?1:0,mode);assert.equal(f.state.calls.filter(c=>c.kind==='completionRead').length,count);}
});
