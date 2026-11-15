// Install the candidate after a genuine V2 zero-income review exists.
import assert from'node:assert/strict';
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
export function verifyNativeOptionalIncomeUpgradeV3({q,read,fixture,install,checkpoint}){
 const actor=fixture.actor,tid=fixture.tournamentId,eid=fixture.eventId;
 const context=`set app.fixture_native_optional_finance='approved-local-only';set app.fixture_native_playoff_recipient='approved-local-only';set app.fixture_native_optional_final='approved-local-only';set request.jwt.claim.role='service_role';set request.jwt.claim.sub='${actor}';set request.jwt.claims='{"role":"service_role","sub":"${actor}"}';`;
 const get=query=>read(context+query),gates=['native_optional_recorded_fund_enabled_v2','native_optional_final_awards_enabled_v2'];
 const originals=gates.map(name=>get(`select to_jsonb(pg_get_functiondef('app.${name}()'::regprocedure));`));
 let before,after,request,accepted;
 try{
  for(const name of gates)q(`create or replace function app.${name}()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_native_optional_final',true)='approved-local-only',false)$$;alter function app.${name}()owner to postgres;revoke all on function app.${name}()from public,anon,authenticated,service_role;`);
  const expense=get(`select to_jsonb(id)from app.tournament_expense_events where tournament_id='${tid}'and description='TEST ONLY sanctioning';`);
  const fund=get(`select app.native_optional_recorded_fund_source_v2('${actor}','${tid}','${eid}','${expense}');`);assert.equal(fund.status,'source_available');
  request={kind:'native-optional-recorded-fund-review-v2',expectedVersion:0,sourceDigest:fund.sourceDigest,proposalRevisionId:fund.proposalRevisionId,ownershipRevisionId:fund.ownershipRevisionId,recipientSourceDigest:fund.recipientSource.sourceDigest,sanctioningExpenseEventId:expense,status:'reviewed_zero',reason:'TEST ONLY pre-upgrade zero-income review'};
  const call=`app.review_native_optional_recorded_fund_v2('${actor}','${tid}','${eid}','0d970000-0000-4000-8000-000000000001',${literal(request)})`;
  accepted=get(`select ${call};`);assert.equal(accepted.status,'optional_recorded_fund_reviewed_v2');
  before={source:get(`select app.native_optional_final_award_source_v2('${actor}','${tid}','${eid}');`),row:get(`select to_jsonb(r)from app.native_optional_fund_reviews_v2 r where id='${accepted.reviewId}';`)};assert.equal(before.source.status,'source_available');
  checkpoint('income_upgrade_before_v3',{request,accepted,before});install();
  after={source:get(`select app.native_optional_final_award_source_v2('${actor}','${tid}','${eid}');`),row:get(`select to_jsonb(r)-array['income_head_version','income_head_digest','income_active_minor']from app.native_optional_fund_reviews_v2 r where id='${accepted.reviewId}';`)};
  assert.deepEqual(after,before,'Old zero review and complete final-source digest must remain exact');assert.deepEqual(get(`select ${call};`),accepted);
  checkpoint('income_upgrade_exact_v3',{request,accepted,before,after,exactOldZeroHash:true,exactOldReplay:true,moneyMoved:false});
 }finally{for(const value of originals)q(value);}
 return{request,accepted,before,after};
}
