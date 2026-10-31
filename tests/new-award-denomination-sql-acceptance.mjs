// Root owns the disposable database; these tests never open a hosted connection.
// Temporary tables exercise the actual trigger function at its owning table
// shapes without manufacturing application/FK/role history or disabling guards.
import assert from'node:assert/strict';
const quote=s=>`'${String(s).replaceAll("'","''")}'`;
const tableCases=[
 ['standard_singles_settlement_placements','prize_amount_minor bigint','500','501'],
 ['standard_singles_settlement_awards','amount_minor bigint','500','501'],
 ['event_settlement_drafts_v5','request_payload jsonb',quote(JSON.stringify({prizeClaims:[{amountMinor:500}]})),quote(JSON.stringify({prizeClaims:[{amountMinor:501}]}))],
 ['no_q_accounting_drafts_v7','source_manifest jsonb',quote(JSON.stringify({regularSchedule:{awards:[{totalAwardMinor:500}]}})),quote(JSON.stringify({regularSchedule:{awards:[{totalAwardMinor:501}]}}))],
 ['prize_accounting_drafts_v8','awards jsonb,source_manifest jsonb',`${quote('[{"totalAwardMinor":500}]')},'{}'`,`${quote('[{"totalAwardMinor":501}]')},'{}'`],
 ['q_obligation_reviews_v1','obligations jsonb',quote('[{"kind":"refund","rows":[{"amountMinor":51}]}]'),quote('[{"kind":"award","rows":[{"amountMinor":501}]}]')],
 ['q_obligation_reviews_v2','obligations jsonb',quote('[{"kind":"refund","rows":[{"amountMinor":51}]}]'),quote('[{"kind":"award","rows":[{"amountMinor":501}]}]')],
 ['event_side_pool_policy_versions','posted_payout_schedule jsonb',quote('[{"amountMinor":500}]'),quote('[{"amountMinor":501}]')],
 ['event_side_pool_payout_versions','voided boolean,amount_minor bigint','true,501','false,501'],
 ['event_side_pool_team_payout_versions','voided boolean,amount_minor bigint','true,501','false,501'],
 ['satellite_result_versions','placements jsonb',quote('[{"prizeMinor":500,"qPoolMinor":0,"sidePoolMinor":1000}]'),quote('[{"prizeMinor":500,"qPoolMinor":1,"sidePoolMinor":1000}]')],
 ['event_team_financial_contributions','contribution_type text,amount_minor bigint',"'entry_fee',501","'award',501"],
];
export function verifyNewAwardDenominationGuards(sql){
 let groups=0;
 for(const[table,columns,good,bad]of tableCases){
  assert.match(table,/^[a-z0-9_]+$/);
  const result=sql(`begin;create temporary table ${table}(${columns})on commit drop;create trigger test_denomination before insert on pg_temp.${table} for each row execute function app.require_whole_five_new_awards_v1();
   insert into pg_temp.${table} values(${good});
   do $reject$begin begin insert into pg_temp.${table} values(${bad});raise exception 'TEST unexpected acceptance';exception when sqlstate 'P0001'then if sqlerrm is distinct from'whole_five_awards_required'then raise;end if;end;end$reject$;
   select count(*)from pg_temp.${table};rollback;`);assert.equal(result.split('\n').filter(Boolean).at(-1),'1',table);groups++;
 }
 const q=sql(`begin;select app.assert_whole_five_award_array_v1('[{"amountMinor":0},{"amountMinor":500},{"amountMinor":1000}]','amountMinor');select app.assert_whole_five_q_awards_v1('[{"kind":"award","rows":[{"amountMinor":500}]},{"kind":"refund","rows":[{"amountMinor":51}]}]');
 do $reject$declare value jsonb;begin foreach value in array array['[{"amountMinor":"500"}]'::jsonb,'[{"amountMinor":-500}]'::jsonb,'[{"amountMinor":1.5}]'::jsonb,'[{}]'::jsonb,'null'::jsonb]loop begin perform app.assert_whole_five_award_array_v1(value,'amountMinor');raise exception 'TEST unexpected acceptance';exception when sqlstate 'P0001'then if sqlerrm is distinct from'whole_five_awards_required'then raise;end if;end;end loop;end$reject$;select 'PASS';rollback;`);assert.equal(q.split('\n').filter(Boolean).at(-1),'PASS');groups++;
 assert.equal(sql(`select count(*)from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='app'and t.tgname='aa_whole_five_new_awards_v1'and t.tgenabled='O';`),'21');
 assert.equal(sql(`select bool_and(not has_function_privilege(r,p.oid,'EXECUTE'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['anon','authenticated','service_role'])r where n.nspname='app'and p.proname in('assert_whole_five_award_array_v1','assert_whole_five_q_awards_v1','assert_whole_five_standard_draft_v1','require_whole_five_new_awards_v1');`),'t');groups++;
 console.log(`PASS new-award whole-$5 trigger/helper acceptance:${groups}groups; actual private trigger on regular/Q/Side/team/satellite shapes, refunds/voids preserved`);
 return{groups,triggerTargets:21,limitation:'Temporary table shapes exercise actual trigger authority; root must separately prove accepted legacy RPC replay and new-final rejection for real preexisting cent drafts.'};
}

/** Optional real preexisting draft checks, after migration. This is a SELECT of
 * the old immutable row and the actual insert-trigger through a temp final table;
 * no fake application final, FK bypass or historical rewrite is performed. */
export function verifyLegacyCentFinalBlock(sql,{table,draftId,tournamentId,eventId}){
 const allowed={q_accounting_finals_v6:'draft_id',no_q_accounting_finals_v7:'draft_id',event_settlement_finals_v2:'draft_id',standard_singles_settlement_final_versions:'settlement_draft_id'};const key=allowed[table];assert.ok(key);
 const result=sql(`begin;create temporary table ${table}(${key} uuid,tournament_id uuid,event_id uuid)on commit drop;create trigger test_denomination before insert on pg_temp.${table} for each row execute function app.require_whole_five_new_awards_v1();do $reject$begin begin insert into pg_temp.${table} values('${draftId}','${tournamentId}','${eventId}');raise exception 'TEST unexpected acceptance';exception when sqlstate 'P0001'then if sqlerrm is distinct from'whole_five_awards_required'then raise;end if;end;end$reject$;select 'PASS';rollback;`);assert.equal(result.split('\n').filter(Boolean).at(-1),'PASS');
}
