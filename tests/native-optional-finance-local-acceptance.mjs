// Injected disposable database. No hosted/provider/human or cash evidence.
import assert from'node:assert/strict';
import{createEventFinanceEditorV1,reduceEventFinanceEditorV1,projectEventFinanceSectionV1}from'../src/lib/finance/event-finance-workspace-v1.ts';
import{calculateEventRegularFinanceV1}from'../src/lib/results/event-regular-finance-v1.ts';
import{readNativeOptionalFinanceSourceV2,readNativeOptionalFinanceWorkspaceV2,readNativeOptionalFinanceReconciliationV2}from'../src/lib/api/native-optional-finance-v2.ts';
import{readCustomSideOperatingWorkspaceV4}from'../src/lib/api/custom-side-operating-v4.ts';
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
const id=n=>`0d810000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function verifyNativeOptionalFinanceV2({sql,fixture,checkpoint=()=>{},onReady=async()=>null}){
 const{actor,tournamentId:tid,eventId:eid}=fixture;
 const raw=(query,role='postgres')=>sql(`set role ${role};set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='service_role';set request.jwt.claims='{"role":"service_role","sub":"${actor}"}';`+query);
 const read=(query,enabled=false,role='postgres')=>{const out=raw((enabled?"set app.fixture_native_optional_finance='approved-local-only';":'')+query,role);return out?JSON.parse(out):null;};
 for(const[n,amount,label]of[[1,4800,'sanctioning'],[2,200,'cards']]){
  const result=read(`select public.record_tournament_expense('${tid}',${amount},'USD','TEST ONLY ${label}','${id(n)}');`);assert.equal(result.status,'expense_recorded');
 }
 const source=read(`select app.native_optional_pool_ownership_source_v2('${actor}','${tid}','${eid}');`);
 assert.equal(source.status,'ownership_source_available',JSON.stringify(source));
 assert.deepEqual(source.funds,{regularReceiptsMinor:48000,qReceiptsMinor:17000,sideReceiptsMinor:16000,recordedReceiptsMinor:81000});
 assert.equal(source.capture.nativeRawSource.facts.existingOptionalAllocationEvidence,true);
 assert.equal(source.capture.nativePlayoffSource.settingsBindingId,fixture.binding.bindingId);
 assert.equal(source.capture.rosterReceiptPartitions.length,16);assert.equal(source.capture.sideRecordedSources.length,16);
 for(const row of source.capture.rosterReceiptPartitions){assert.equal(row.source.amountMinor,row.receipt.amount_minor);assert.equal(row.source.allocations.reduce((n,p)=>n+p.amountMinor,0),row.source.amountMinor);assert.equal(row.source.allocations.find(p=>p.bucket==='regular_entry').amountMinor,3000);}
 const ownershipRequest={kind:'native-optional-pool-ownership-v2',expectedVersion:0,sourceDigest:source.sourceDigest,
  costClassifications:source.capture.basis.expenses.map(e=>({expenseEventId:e.expenseEventId,category:e.description==='TEST ONLY sanctioning'?'player_benefit':'operating_expense'})),reason:'TEST ONLY explicit ownership and expense review',reviewed:true};
 const saveOwnership=(request=ownershipRequest,op=id(10),enabled=true)=>read(`select app.save_native_optional_pool_ownership_v2('${actor}','${tid}','${eid}','${op}',${literal(request)});`,enabled);
 assert.equal(saveOwnership(ownershipRequest,id(9),false).code,'feature_unavailable');
 const gateNames=['native_optional_pool_ownership_enabled_v2','native_optional_finance_source_enabled_v2','native_optional_finance_proposals_enabled_v2','native_optional_finance_provider_enabled_v2','custom_side_operating_provider_enabled_v1'];
 const originalGates=gateNames.map(name=>read(`select to_jsonb(pg_get_functiondef('app.${name}()'::regprocedure));`));
 for(const original of originalGates)assert.match(original,/select false/);
 try{
  for(const name of gateNames)raw(`create or replace function app.${name}()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_native_optional_finance',true)='approved-local-only',false)$$;alter function app.${name}()owner to postgres;revoke all on function app.${name}()from public,anon,authenticated,service_role;`);
  const poolId=fixture.policies.side.accepted.poolId;
  const sideWorkspace=read(`select public.get_custom_side_operating_workspace_provider_v4('${actor}','${tid}','${eid}','${poolId}');`,true,'service_role');
  assert.ok(readCustomSideOperatingWorkspaceV4(sideWorkspace,{actorId:actor,tournamentId:tid,eventId:eid,poolId}),'Actual service-role Custom Side V4 workspace');
  const aclProof={};
  for(const role of['anon','authenticated']){
   assert.throws(()=>read(`select public.get_native_optional_finance_workspace_provider_v2('${actor}','${tid}','${eid}');`,true,role),/permission denied|42501/i);aclProof[role+'PublicDenied']=true;
  }
  assert.throws(()=>read(`select app.native_optional_pool_ownership_source_v2('${actor}','${tid}','${eid}');`,true,'service_role'),/permission denied|42501/i);aclProof.servicePrivateDenied=true;
  assert.equal(read(`select public.get_native_optional_finance_workspace_provider_v2('a1310000-0000-4000-8000-000000000006','${tid}','${eid}');`,true,'service_role'),null);aclProof.coDirectorOutsideInitialScopeDenied=true;
  const ownership=saveOwnership();assert.equal(ownership.status,'optional_pool_ownership_reviewed_v2');assert.deepEqual(saveOwnership(),ownership);
  assert.equal(saveOwnership({...ownershipRequest,reason:'Changed same operation'}).code,'idempotency_conflict');
  assert.equal(saveOwnership({...ownershipRequest,sourceDigest:'0'.repeat(64)},id(11)).code,'source_changed');
  assert.equal(saveOwnership(ownershipRequest,id(12)).code,'stale_version');
  const ownershipReconcile=read(`select app.reconcile_native_optional_pool_ownership_v2('${actor}','${tid}','${eid}','${id(10)}',${literal(ownershipRequest)});`,true);assert.deepEqual(ownershipReconcile.result,ownership);assert.equal(ownershipReconcile.currentFundAuthority,false);
  const financeSource=read(`select app.native_optional_finance_source_v2('${actor}','${tid}','${eid}');`,true);assert.equal(financeSource.status,'source_available',JSON.stringify(financeSource));
  const scope={actorId:actor,tournamentId:tid,eventId:eid};const decoded=readNativeOptionalFinanceSourceV2(financeSource,scope);assert.ok(decoded,'Actual Finance V2 source decoder');
  assert.equal(JSON.stringify(decoded).includes('rosterReceiptPartitions'),false);assert.equal(decoded.funds.regularFundMinor,43000);
  const workspace=financeSource.basis.workspace;const editor=createEventFinanceEditorV1(workspace);assert.ok(editor);
  const calc=calculateEventRegularFinanceV1({source:workspace.source,mode:workspace.mode,grossEntry:{source:workspace.source,mode:workspace.mode,amountMinor:workspace.grossEntryMinor},history:workspace.history.map(r=>r.line)});
  assert.equal(calc.status,'calculated');assert.equal(calc.regularFundMinor,43000);assert.equal(calc.benefitsMinor,4800);assert.equal(calc.expensesMinor,200);assert.equal(calc.excludedQMinor,17000);assert.equal(calc.excludedSideMinor,16000);
  const view=projectEventFinanceSectionV1(editor,workspace);assert.equal(view.excludedQMinor,17000);assert.equal(view.excludedSideMinor,16000);assert.equal(view.fundMinor,43000);
  const request={kind:'native-optional-finance-proposal-v2',expectedVersion:0,sourceDigest:financeSource.sourceDigest,basisDigest:financeSource.basisDigest,editor,reason:'TEST ONLY native Finance estimate with separate pools',reviewed:true};
  const providerCall=(body=request,op=id(20),role='service_role')=>read(`select public.save_native_optional_finance_proposal_provider_v2('${actor}','${tid}','${eid}','${op}',${literal(body)});`,true,role);
  const envelope=providerCall();assert.deepEqual(envelope.request,request);const saved=envelope.result;assert.equal(saved.status,'optional_finance_proposal_saved_v2');assert.deepEqual(providerCall(),envelope);
  const reconciliation=read(`select public.reconcile_native_optional_finance_proposal_provider_v2('${actor}','${tid}','${eid}','${id(20)}',${literal(request)});`,true,'service_role');assert.ok(readNativeOptionalFinanceReconciliationV2(reconciliation,{...scope,operationId:id(20),request}));
  const savedWorkspace=read(`select public.get_native_optional_finance_workspace_provider_v2('${actor}','${tid}','${eid}');`,true,'service_role');assert.ok(readNativeOptionalFinanceWorkspaceV2(savedWorkspace,scope));assert.equal(savedWorkspace.current,true);
  let adjusted=reduceEventFinanceEditorV1(editor,{type:'edit_band',firstPlace:3,lastPlace:4},workspace,()=>id(31));
  adjusted=reduceEventFinanceEditorV1(adjusted,{type:'band_field',field:'amount',value:'80'},workspace,()=>id(32));
  adjusted=reduceEventFinanceEditorV1(adjusted,{type:'band_field',field:'reason',value:'TEST ONLY equal whole-group proposal'},workspace,()=>id(33));
  adjusted=reduceEventFinanceEditorV1(adjusted,{type:'apply_band'},workspace,()=>id(34));
  const adjustedView=projectEventFinanceSectionV1(adjusted,workspace);assert.equal(adjustedView.adjustedTotalMinor,44000);assert.equal(adjustedView.differenceMinor,1000);
  const secondRequest={...request,expectedVersion:1,editor:adjusted,reason:'TEST ONLY unbalanced proposal, no finalization'};
  const second=providerCall(secondRequest,id(21));assert.equal(second.result.status,'optional_finance_proposal_saved_v2');assert.equal(second.result.version,2);
  const tampered=structuredClone(secondRequest);tampered.expectedVersion=2;tampered.editor.history.find(r=>r.line.category==='q_pool_fund').line.amountMinor+=500;
  assert.equal(providerCall(tampered,id(22)).result.code,'invalid_editor');
  const staleSql=`begin;do $stale$declare r jsonb;s jsonb;begin r:=public.record_tournament_expense('${tid}',25,'USD','TEST ONLY temporary ownership staleness','${id(40)}');if r->>'status'is distinct from'expense_recorded'then raise exception'stale expense failed %',r;end if;s:=app.native_optional_finance_source_v2('${actor}','${tid}','${eid}');if s->>'code'is distinct from'optional_ownership_review_stale'then raise exception'ownership remained current %',s;end if;r:=app.save_native_optional_finance_proposal_v2('${actor}','${tid}','${eid}','${id(41)}',${literal({...request,expectedVersion:2})});if r->>'code'is distinct from'source_blocked'then raise exception'stale proposal accepted %',r;end if;end$stale$;rollback;`;
  read("set app.fixture_native_optional_finance='approved-local-only';"+staleSql);
  assert.equal(read(`select app.get_native_optional_finance_workspace_v2('${actor}','${tid}','${eid}');`,true).current,true);
  const reclassified={...ownershipRequest,expectedVersion:1,costClassifications:ownershipRequest.costClassifications.map(c=>({...c,category:'player_benefit'}))};
  read(`set app.fixture_native_optional_finance='approved-local-only';begin;do $adoption$declare r jsonb;s jsonb;ed jsonb;w jsonb;begin
   r:=app.save_native_optional_pool_ownership_v2('${actor}','${tid}','${eid}','${id(50)}',${literal(reclassified)});if r->>'status'is distinct from'optional_pool_ownership_reviewed_v2'then raise exception'reclassification failed %',r;end if;
   s:=app.native_optional_finance_source_v2('${actor}','${tid}','${eid}');if s->>'status'is distinct from'source_available'then raise exception'new basis missing %',s;end if;
   ed:=jsonb_build_object('basis',s#>'{basis,workspace}','history',s#>'{basis,workspace,history}','overrideHistory','[]'::jsonb,'overrideInput',null,'overridePlan',null,'lineForm',null,'bandForm',null,'message','');
   r:=app.save_native_optional_finance_proposal_v2('${actor}','${tid}','${eid}','${id(51)}',jsonb_build_object('kind','native-optional-finance-proposal-v2','expectedVersion',2,'sourceDigest',s->>'sourceDigest','basisDigest',s->>'basisDigest','editor',ed,'reason','TEST ONLY must not discard retained work on a changed basis','reviewed',true));
   if r->>'code'is distinct from'explicit_source_adoption_required'then raise exception'changed basis silently adopted %',r;end if;
   w:=app.get_native_optional_finance_workspace_v2('${actor}','${tid}','${eid}');if w->>'current'is distinct from'false'then raise exception'old proposal incorrectly current %',w;end if;
  end$adoption$;rollback;`);
  read(`begin;delete from app.tournament_roles where tournament_id='${tid}'and profile_id='${actor}'and role='director';do $role$declare r jsonb;begin
   r:=public.save_native_optional_finance_proposal_provider_v2('${actor}','${tid}','${eid}','${id(20)}',${literal(request)});if r is not null then raise exception'revoked role replay returned data %',r;end if;
  end$role$;rollback;`);
  assert.equal(read(`select app.get_native_optional_finance_workspace_v2('${actor}','${tid}','${eid}');`,true).current,true);
  assert.deepEqual(read(`select jsonb_build_object('nativeFinals',(select count(*)from app.native_playoff_final_award_sets_v1 where tournament_id='${tid}'),'legacyFinals',(select count(*)from app.prize_accounting_finals_v9 where tournament_id='${tid}'));`),{nativeFinals:0,legacyFinals:0});
  const result={source,sideWorkspace,aclProof,ownershipRequest,ownership,ownershipReconcile,financeSource,decoded,calc,view,request,envelope,reconciliation,savedWorkspace,secondRequest,second,adjustedView,staleSourceRollback:true,changedClassificationAdoptionBlocked:true,revokedRoleReplayDenied:true,normalFinalizationSupported:false,providerVerified:false,moneyMoved:false};checkpoint('ownership_and_finance_v2',result);const callbackResult=await onReady(result);return{...result,callbackResult};
 }finally{for(const original of originalGates)raw(original);for(const name of gateNames)assert.equal(read(`select to_jsonb(app.${name}());`),false);}
}
