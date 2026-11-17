// Actual Results -> joint reader -> unchanged transports/decoders; synthetic Auth/RPC.
import fs from 'node:fs';
import {regularPrizeV3WiringFixture as fixture} from './helpers/regular-prize-v3-wiring-fixture.mjs';
import {eventApprovalFixtureV40} from './helpers/event-approval-fixture-v40.mjs';
import {withFictionalCloseoutEnvV40} from './helpers/fictional-closeout-env-v40.mjs';
import {readResultsCompletionV40} from '../src/lib/results/completion-read-v40.ts';
const cases=[];
await withFictionalCloseoutEnvV40(async()=>{
 for(const mode of ['review','recorded','closed','held','provider-error','session-change','gate-closed']){
  const f=fixture(),a=eventApprovalFixtureV40(mode);f.state.gate=false;f.state.approvalGate=mode!=='gate-closed';f.state.poolProposalGate=true;f.state.completionReader=readResultsCompletionV40;
  let reads=0;f.state.approvalRpc=name=>{if(name==='get_regular_consolation_final_workspace_v1')return{data:{status:'held',code:'not_regular_consolation'},error:null};if(name==='get_modern_event_final_workspace_v1'){reads++;if(mode==='provider-error')return{data:null,error:Error('synthetic failure')};if(mode==='session-change'&&reads===2)f.state.sessionId='ab130000-0000-4000-8000-000000000099';return{data:mode==='held'?{status:'held',code:'current_source_required'}:a.event,error:null};}if(name==='get_modern_event_closure_workspace_v1')return{data:a.closure,error:null};if(name==='get_manual_pool_final_workspace_v1')return{data:{status:'held',code:'current_source_required'},error:null};throw Error('Unexpected synthetic RPC '+name);};
  let approval=null,pool=null;function serial(n){if(Array.isArray(n))return n.map(serial);if(!n||typeof n!=='object')return n;const props={...n.props,children:serial(n.props?.children)};if(n.type===f.EventApprovalResultsViewV40){approval=props.view;return{type:'APPROVAL_VIEW_V40',props};}if(n.type===f.PoolProposalResultsViewV38){pool=props.view;return null;}if(typeof n.type==='string')return{type:n.type,props};if(typeof n.props?.href==='string')return{type:'a',props};if(n.type===undefined)return{type:'fragment',props};return null;}
  const tree=serial(await f.page());cases.push({mode,tree,approval,pool,reads,calls:f.state.calls.map(x=>({kind:x.kind,name:x.name??null})),tournamentId:f.state.tournamentId,eventId:f.state.eventId});
 }
});
fs.mkdirSync('../browser-v40',{recursive:true});fs.writeFileSync('../browser-v40/data.json',JSON.stringify(cases));
