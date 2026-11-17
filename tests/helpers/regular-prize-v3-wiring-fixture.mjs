// Actual page/route modules with fictional ports. Unit wiring proof only:
// no database, provider authentication, browser or Consolation arithmetic claim.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {poolProposalFixtureV38} from './pool-proposal-fixture-v38.mjs';
import {poolProposalEventEligibleV38} from '../../src/lib/results/pool-proposal-results-v38.ts';
import {recipientCase} from './final-recipient-fixtures.mjs';
import {selectedStepAwardViewFixtureV3} from './selected-step-award-view-fixture-v3.mjs';
import {projectSelectedStepAwardWorkspaceV3} from '../../src/lib/finance/selected-step-award-view-v3.ts';
import {modernPrizeCsvV2} from '../../src/lib/results/modern-prize-export-v2.ts';
import {isQualificationResult} from '../../src/lib/api/qualification-finalization.ts';
import {isTournamentResultEventSummary} from '../../src/lib/api/result-event-summary.ts';
import {requireVerifiedIdentity} from '../../src/lib/api/verified-subject.ts';

const PAGE='src/app/tournament/[tournamentId]/results/page.tsx';
const ROUTE='src/app/api/v1/tournaments/[id]/events/[eventId]/regular-prize-report/route.ts';
export function regularPrizeV3WiringFixture(kind='main'){
  const c=selectedStepAwardViewFixtureV3(true),scope=c.scope;
  const qualification=recipientCase(kind==='consolation'?'consolation-v1':'main-v3').playoffModels.qualification;
  const decoded=projectSelectedStepAwardWorkspaceV3(c.value,scope,qualification.resultVersionId).results;
  // The page/CSV consume the same generic Main/Con DTO. Changing this mock port
  // label is not a test of the unchanged underlying Consolation source decoder.
  const state={...scope,kind,format:'standard_singles',role:'director',sessionId:'ab130000-0000-4000-8000-000000000011',
    userId:scope.actorId,gate:true,exportGate:true,synthetic:null,final:null,view:{...decoded,eventKind:kind},qualification,
    qualificationAfter:null,summaryTournamentId:scope.tournamentId,summaryEventId:scope.eventId,duplicateEvent:false,
    manualResultsGate:false,afterManualRead:null,poolProposalGate:false,poolProposalView:null,poolMode:'unsaved',poolReader:null,poolReviewGate:true,poolOwnershipGate:true,afterRead:null,throwRead:false,calls:[],adminConstructed:0,normalConstructed:0};
  const summary=()=>({tournamentId:state.summaryTournamentId,tournamentName:'TEST ONLY',events:Array.from({length:state.duplicateEvent?2:1},()=>({eventId:state.summaryEventId,name:kind==='consolation'?'Consolation':'Main',eventType:state.kind,format:state.format,scoringMethod:'digital',participantCount:16}))});
  const normal={auth:{getClaims:async()=>({data:{claims:{sub:state.actorId,session_id:state.sessionId}},error:null}),getUser:async()=>({data:{user:{id:state.userId}},error:null})},rpc:async name=>{if(name!=='get_tournament_role')throw Error('Unexpected normal RPC '+name);state.calls.push({kind:'role',role:state.role});return{data:state.role,error:null};}};
  let qualificationReads=0;
  const admin={rpc:async(name,args)=>{state.calls.push({kind:'adminRpc',name,args});if(name==='get_standard_singles_qualification_result_v1')return{data:++qualificationReads>1&&state.qualificationAfter?state.qualificationAfter:state.qualification,error:null};if(name==='get_tournament_result_events_v1')return{data:summary(),error:null};if(name==='get_finalized_standard_singles_event_report_v1')return{data:state.final,error:null};if(name==='get_event_side_pool_workspace_v1')return{data:null,error:null};if(name==='get_selected_step_pool_record_provider_v3')return{data:poolProposalFixtureV38(state.poolMode,{actorId:state.actorId,tournamentId:state.tournamentId,eventId:state.eventId},state.qualification.resultVersionId).history,error:null};if(name==='get_selected_step_pool_source_provider_v3')return{data:poolProposalFixtureV38(state.poolMode,{actorId:state.actorId,tournamentId:state.tournamentId,eventId:state.eventId},state.qualification.resultVersionId).s,error:null};if(name==='get_selected_step_award_workspace_provider_v3')return{data:state.view,error:null};throw Error('Unexpected admin RPC '+name);}};
  const ModernPrizeResultsV2=()=>null,PoolProposalResultsViewV38=()=>null,PoolJournalFixtureMarker=()=>null;
  const dependencies={
    'next/navigation':{notFound:()=>{throw Error('NOT_FOUND');}},
    'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
    validation:{isUuid:value=>typeof value==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)},
    'verified-subject':{requireVerifiedIdentity},
    'qualification-finalization':{isQualificationResult,getQualificationResult:async()=>state.qualification},
    'result-event-summary':{isTournamentResultEventSummary},
    'event-summary':{getTournamentResultEventSummary:async()=>summary()},
    'finalized-event-report':{getFinalizedEventReport:async()=>state.final},
    'synthetic-event-context':{getSyntheticEventContext:async()=>state.synthetic},
    'require-tournament-access':{requireTournamentAccess:async()=>({user:{id:scope.actorId},role:state.role,roles:[state.role]})},
    'preliminary-standings':{getPreliminaryEventStandings:async()=>({rows:[]})},
    'qualification-preview':{buildPreliminaryQualification:()=>null},
    'side-pools':{isSidePoolWorkspace:()=>false},
    'server':{createClient:async()=>{state.normalConstructed++;return normal;}},
    'private-admin':{createServerOnlyAdminClient:()=>{state.adminConstructed++;return admin;}},
    'modern-prize-export-v2':{modernPrizeExportEnabledV2:()=>state.exportGate,modernPrizeCsvV2},
    'modern-prize-results-v2':{modernPrizeResultsEnabledV2:()=>false,readModernPrizeResultsV2:()=>{throw Error('V2 reader must stay unused');}},
    'selected-step-award-transport-v3':{selectedStepAwardResultsEnabledV3:()=>state.gate,selectedStepAwardPageEnabledV3:()=>false,
      createSelectedStepAwardTransportV3:(client,service,fixed,flags)=>{state.calls.push({kind:'transport',sameNormal:client===normal,scope:fixed,writes:flags.write()});return{results:async qid=>{state.calls.push({kind:'results',qid});if(state.throwRead)throw Error('Held current source');const raw=await service('get_selected_step_award_workspace_provider_v3',{actor:fixed.actorId,sid:state.sessionId,tid:fixed.tournamentId,eid:fixed.eventId});if(state.afterRead)state.afterRead(state);return raw.data;}};}},
    'native-mixed-event-results-v1':{nativeMixedEventResultsEnabledV1:()=>false},
    'native-mixed-proposed-mrp-v1':{nativeMixedProposedMrpEnabledV1:()=>false},
    'result-based-mrp-v1':{resultBasedMrpEnabledV1:()=>false},
    'native-pool-award-results-v2':{nativePoolAwardResultsEnabledV2:()=>false},
    'selected-step-pool-results-v3':{selectedStepPoolResultsEnabledV3:()=>false},
    'modern-manual-playoff-results-v1':{modernManualResultsEnabledV1:()=>state.manualResultsGate,getModernManualResultsV1:async()=>{state.calls.push({kind:'manualRead'});if(state.afterManualRead)state.afterManualRead(state);return null;}},
    'selected-step-pool-journal-section-v3':{SelectedStepPoolJournalSectionV3:PoolJournalFixtureMarker},
    'pool-proposal-read-v38':{readPoolProposalResultsV38:async options=>{state.calls.push({kind:'poolProposalRead',qid:options.qualificationId});return state.poolReader?state.poolReader({...options,scope:structuredClone(options.scope)}):state.poolProposalView;}},
    'selected-step-pool-page-gates-v3':{selectedStepPoolPageEnabledV3:()=>state.poolReviewGate,selectedStepPoolWritesVerifiedV3:()=>false},
    'selected-step-ownership-gates-v3':{selectedStepOwnershipPageEnabledV3:()=>state.poolOwnershipGate},
    'pool-proposal-results-v38':{poolProposalResultsEnabledV38:()=>state.poolProposalGate,poolProposalEventEligibleV38},
    'progress-v37':{playoffProgressEnabledV37:()=>false},
    'modern-manual-preparation-contract-v1':{manualPreparationEnabledV1:()=>false},
    'consolation-playoff-navigation':{consolationPlayoffEntry:()=>null},
    score:{formatSignedNet:n=>String(n)},
  };
  function load(file){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,loadedModule={exports:{}};vm.runInNewContext(code,{module:loadedModule,exports:loadedModule.exports,Request,Response,Headers,URL,structuredClone,require:name=>{
    if(name.includes('/components/pool-proposal-results-v38'))return{PoolProposalResultsViewV38};
    if(name.includes('/components/modern-prize-results-v2'))return{ModernPrizeResultsV2};
    const key=name.split('/').at(-1).replace(/\.ts$/,'');return dependencies[name]??dependencies[key]??new Proxy({},{get:(_target,key)=>()=>{throw Error('Unexpected dependency '+name+':'+String(key));}});
  }});return loadedModule.exports;}
  return{state,ModernPrizeResultsV2,PoolProposalResultsViewV38,PoolJournalFixtureMarker,poolPage:()=>load('src/app/tournament/[tournamentId]/finance/[eventId]/pool-awards/page.tsx').default({params:Promise.resolve({tournamentId:scope.tournamentId,eventId:scope.eventId})}),page:()=>load(PAGE).default({params:Promise.resolve({tournamentId:scope.tournamentId}),searchParams:Promise.resolve({event:scope.eventId})}),csv:(params={id:scope.tournamentId,eventId:scope.eventId})=>load(ROUTE).GET(new Request('https://fictional.invalid/report'),{params:Promise.resolve(params)})};
}

export function renderedNodes(tree){const out=[];function visit(node){if(Array.isArray(node)){node.forEach(visit);return;}if(!node||typeof node!=='object')return;out.push(node);visit(node.props?.children);}visit(tree);return out;}
