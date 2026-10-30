// Run against the disposable fully migrated database; never a hosted project.
import assert from 'node:assert/strict';
export async function verifyLegacyAwardRecoveryStructure(sql) {
 const result=await sql(`select p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and p.proname in('write_event_settlement_v5','write_q_accounting_v6','write_no_q_accounting_v7') order by p.proname`);
 const rows=result.rows??result;
 assert.equal(rows.length,3);
 for(const {proname,definition} of rows){
  const replay=definition.search(/return (?:r|receipt)\.response_payload/);
  const preflight=definition.indexOf('perform app.assert_whole_five_award_array_v1');
  const handler=definition.indexOf('exception when',preflight);
  const receipt=definition.indexOf('insert into app.operation_receipts',handler);
  assert.ok(replay>=0 && replay<preflight,`${proname}: accepted replay precedes new validation`);
  assert.ok(preflight<handler && handler<receipt,`${proname}: real controlled rejection receipt`);
  assert.match(definition.slice(handler,receipt),/whole_five_awards_required/);
 }
 return {groups:3,limitation:'Structure proof only. Requires real legacy lifecycle fixtures for receipt/replay and unchanged row counts.'};
}

const literal = value => `'${String(value).replaceAll("'", "''")}'`;
/** Requires three DISTINCT genuine supported legacy fixtures seeded before 0260:
 * accepted cent draft + saved exact request/operation/response, current unchanged
 * source, authorized director, valid final request. Do not disable triggers to seed.
 * Call separately for each version AFTER 0262; no hosted connection is opened here.
 * freshRequest must be a valid next-version cent draft (not an already-drafted replay).
 */
export function verifyLegacyAwardRecoveryLifecycle(sql, fixture) {
 const {version,actorId,tournamentId,eventId,acceptedOperationId,acceptedRequest,acceptedResponse,freshOperationId,freshRequest,finalOperationId,finalRequest}=fixture;
 const names={v5:['write_event_settlement_v5','event_settlement_drafts_v5','event_settlement_finals_v2'],v6:['write_q_accounting_v6','q_accounting_drafts_v6','q_accounting_finals_v6'],v7:['write_no_q_accounting_v7','no_q_accounting_drafts_v7','no_q_accounting_finals_v7']};
 assert.ok(names[version]);
 for(const id of [actorId,tournamentId,eventId,acceptedOperationId,freshOperationId,finalOperationId])assert.match(id,/^[0-9a-f-]{36}$/i);
 const [writer,drafts,finals]=names[version];
 const args=`'${actorId}','${tournamentId}','${eventId}'`;
 const call=(request,op,action)=>`app.${writer}(${args},${literal(JSON.stringify(request))}::jsonb,'${op}','${action}')`;
 const result=sql(`begin;set local request.jwt.claim.role='service_role';do $test$declare response jsonb;again jsonb;prior jsonb;before_d bigint;before_f bigint;receipt uuid;begin
 select count(*)into before_d from app.${drafts} where event_id='${eventId}';select count(*)into before_f from app.${finals} where event_id='${eventId}';
 prior:=${call(acceptedRequest,acceptedOperationId,'draft')};
 if prior is distinct from ${literal(JSON.stringify(acceptedResponse))}::jsonb then raise exception 'TEST accepted history replay changed';end if;
 response:=${call(freshRequest,freshOperationId,'draft')};
 if response->>'status'<>'rejected' or response->>'code'<>'whole_five_awards_required' then raise exception 'TEST new draft not controlled denomination rejection: %',response;end if;
 again:=${call(freshRequest,freshOperationId,'draft')};if again is distinct from response then raise exception 'TEST rejected replay changed';end if;
 select id into strict receipt from app.operation_receipts where actor_profile_id='${actorId}' and client_operation_id='${freshOperationId}' and outcome='rejected' and response_payload=response;
 if (select count(*)from app.audit_events where operation_receipt_id=receipt)<>1 then raise exception 'TEST rejection audit not unique';end if;
 response:=${call(finalRequest,finalOperationId,'final')};
 if response->>'status'<>'rejected' or response->>'code'<>'whole_five_awards_required' then raise exception 'TEST old cent final not controlled rejection: %',response;end if;
 if (select count(*)from app.${drafts} where event_id='${eventId}')<>before_d or (select count(*)from app.${finals} where event_id='${eventId}')<>before_f then raise exception 'TEST rejected request wrote business row';end if;
 end$test$;select 'PASS';rollback;`);
 assert.equal(result.split('\n').filter(Boolean).at(-1),'PASS');
 return {version,groups:5,limitation:'Uses caller-supplied real legacy fixture. Reconcile API wrapper and browser recovery additionally require integration verification.'};
}
