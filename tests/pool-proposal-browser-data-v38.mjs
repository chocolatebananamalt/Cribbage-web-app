// Run under react-server conditions. Real Results control flow and proposal reader,
// with synthetic Auth/RPC and unrelated legacy modules replaced by fixture ports.
import fs from'node:fs';import path from'node:path';import{regularPrizeV3WiringFixture as fixture}from'./helpers/regular-prize-v3-wiring-fixture.mjs';import{readPoolProposalResultsV38}from'../src/lib/results/pool-proposal-read-v38.ts';
const out=path.resolve('../browser-pool-v38');fs.mkdirSync(out,{recursive:true});const cases=[];
for(const mode of['unsaved','saved','changed-source','historical-record','held','foreign-qid','closed','co-director','consolation','satellite','synthetic','session-change']){
 const f=fixture(mode==='consolation'?'consolation':'main');f.state.gate=false;f.state.poolProposalGate=mode!=='closed';f.state.poolMode=mode;f.state.poolReader=readPoolProposalResultsV38;
 if(mode==='co-director')f.state.role='co_director';if(mode==='satellite')f.state.kind='satellite';if(mode==='synthetic')f.state.synthetic={eventIds:[f.state.eventId]};
 if(mode==='session-change')f.state.poolReader=async options=>{let histories=0;const service=options.service;return readPoolProposalResultsV38({...options,service:()=>{const rpc=service();return async(n,a)=>{if(n==='get_selected_step_pool_record_provider_v3'&&++histories===2)f.state.sessionId='ab130000-0000-4000-8000-000000000099';return rpc(n,a)}}})};
 function serial(n){if(Array.isArray(n))return n.map(serial);if(!n||typeof n!=='object')return n;const props={...n.props,children:serial(n.props?.children)};if(n.type===f.PoolProposalResultsViewV38)return{type:'POOL_PANEL_V38',props};if(n.type===f.PoolJournalFixtureMarker)return{type:'POOL_CONTROLS_OUTSIDE_FIXTURE',props:{}};if(typeof n.type==='string')return{type:n.type,props};if(typeof n.props?.href==='string')return{type:'a',props};if(n.type===undefined)return{type:'fragment',props};return null;}
 const tree=serial(await f.page());let review=null;if(mode==='saved')review=serial(await f.poolPage());
 cases.push({mode,tree,review,tournamentId:f.state.tournamentId,eventId:f.state.eventId,calls:f.state.calls.map(x=>({kind:x.kind,name:x.name??null})),proposalReads:f.state.calls.filter(x=>x.kind==='poolProposalRead').length});
}
fs.writeFileSync(path.join(out,'page-data.json'),JSON.stringify({syntheticAuthRpc:true,actualResultsPageAndProposalReader:true,poolControlsExercised:false,cases},null,2));
