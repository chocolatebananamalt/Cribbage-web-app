import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real POST handlers with mocked session/RPC boundaries. No network or database.
function handler(name, rpcResult) {
  const source=fs.readFileSync(`src/app/api/v1/tournaments/[id]/${name}/route.ts`,'utf8');
  const exports={}; let calls=0;
  const dependencies={
    apiJson:(body,options={})=>({body,status:options.status??200}),
    withApiFailureBoundary:fn=>fn(),isSameOriginRequest:()=>true,isUuid:()=>true,
    readLargeJson:async()=>({eventId:'event',reason:'test'}),readSmallJson:async()=>({eventId:'event',reason:'test'}),
    requireVerifiedSubject:async()=>'actor',createClient:async()=>({}),
    createServerOnlyAdminClient:()=>({rpc:async()=>{calls++;return rpcResult;}}),
    isSatelliteSaveRequest:()=>true,isEventChangeRequest:()=>true,
    isSatelliteSaved:data=>data?.status==='satellite_results_saved',
    isAcceptedEventChange:data=>data?.status==='event_changed',
    isSatelliteRejected:data=>data?.status==='rejected',isRejectedEventChange:data=>data?.status==='rejected',
  };
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:()=>dependencies});
  return async()=>({result:await exports.POST({}, {params:Promise.resolve({id:'tournament'})}),calls});
}
for(const route of ['satellite-results']) {
  test(`${route}: only exact rolled-back denomination error is terminal; other failures remain uncertain`,async()=>{
    for(const [error,status] of [
      [{code:'P0001',message:'whole_five_awards_required'},409],
      [{code:'XX000',message:'whole_five_awards_required'},503],
      [{code:'P0001',message:'other_failure'},503],
      [{code:'P0001',message:'whole_five_awards_required detail'},503],
    ]) {
      const {result,calls}=await handler(route,{data:null,error})();assert.equal(calls,1);assert.equal(result.status,status);
      if(status===409)assert.equal(result.body.code,'whole_five_awards_required');
      else assert.equal(result.body.error,'operation_unavailable');
    }
  });
  test(`${route}: accepted legacy RPC replay payload passes through unchanged`,async()=>{
    const data={status:route==='satellite-results'?'satellite_results_saved':'event_changed',historicalAmountMinor:501};
    const {result}=await handler(route,{data,error:null})();assert.equal(result.status,200);assert.equal(result.body,data);
  });
}
test('legacy satellite/team history returns before new insert guards; UI makes no false receipt claim',()=>{
  const satellite=fs.readFileSync('database/migrations/0171_satellite_results_reporting.sql','utf8');
  assert.ok(satellite.indexOf('return v_prior.response_payload')<satellite.indexOf('insert into app.satellite_result_versions'));
  const team=fs.readFileSync('database/migrations/0195_event_replacement_enrollment_and_credit_transfer.sql','utf8');
  assert.match(team,/insert into app\.event_team_financial_contributions/);
  for(const [file,text] of [
    ['satellite-results/satellite-results-client.tsx','The request was not recorded.'],
    ['event-changes/event-changes-client.tsx','No event change was made:'],
  ])assert.ok(fs.readFileSync(`src/app/tournament/[tournamentId]/${file}`,'utf8').includes(text));
});

test('team replacement controlled rollback is already rejected without a receipt or recovery queue',async()=>{
  const {result}=await handler('event-changes',{data:{status:'rejected',code:'operation_unavailable'},error:null})();
  assert.equal(result.status,409);assert.equal(result.body.status,'rejected');
  const lifecycle=fs.readFileSync('database/migrations/0194_finalize_registration_and_event_change_lifecycle.sql','utf8');
  assert.match(lifecycle,/exception when others then\s+if sqlstate='P0001' then return jsonb_build_object\('status','rejected','code','operation_unavailable'\)/);
  assert.ok(lifecycle.indexOf('return v_existing.response_payload')<lifecycle.indexOf('insert into app.event_change_operations'));
  const client=fs.readFileSync('src/app/tournament/[tournamentId]/event-changes/event-changes-client.tsx','utf8');
  assert.doesNotMatch(client,/sessionStorage|localStorage|queueOfflineSubmission/);
});