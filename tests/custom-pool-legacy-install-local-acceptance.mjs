import assert from 'node:assert/strict';
import {qSetupPrizeWorkspace}from './fixtures/q-setup-prize-workspace.mjs';
const actor='a2950000-0000-4000-8000-000000000001',tid='a2950000-0000-4000-8000-000000000003';
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
export function prepareLegacySideBeforeInstallV3({read}){
 const owner=s=>read(s,actor,'ownerAuthenticated'),base=owner(`select app.get_custom_q_setup_base_v2('${tid}');`).base;
 const{revisionId,version,createdAt,...payload}=structuredClone(qSetupPrizeWorkspace(actor).current);void revisionId;void version;void createdAt;
 const event=payload.events[0];delete event.sourceStatus;event.qPools=[{poolTypeCode:'Equal (Pays All Equally)',entryFeeCents:1000,note:'keep equal'}];event.sidePools=[{poolTypeCode:'Legacy Preset Six',payoutType:'graduated-1-in-6',entryFeeCents:1000,note:'unchanged across install'}];
 const envelope={kind:'setup-custom-payouts-v2',base,request:{expectedVersion:base.setupVersion,payload,idempotencyKey:'a2950000-0000-4000-8000-000000009901'},choices:[{mainClientRowId:event.clientRowId,consolationClientRowIds:[]}],customPayouts:[]};
 const saved=owner(`select app.save_custom_q_setup_draft_v2('${tid}',${literal(envelope)});`);assert.equal(saved.status,'custom_q_setup_draft_saved');
 return{saved,envelope,workspace:owner(`select public.get_tournament_setup_workspace('${tid}');`),rows:owner(`select jsonb_agg(to_jsonb(s)order by s.id)from app.tournament_setup_side_pool_versions s where tournament_id='${tid}';`)};
}
export function assertLegacySideAfterInstallV3({read},before){
 const owner=s=>read(s,actor,'ownerAuthenticated');assert.deepEqual(owner(`select public.get_tournament_setup_workspace('${tid}');`),before.workspace);
 assert.deepEqual(owner(`select jsonb_agg(to_jsonb(s)-'custom_ratio_denominator_v3'order by s.id)from app.tournament_setup_side_pool_versions s where tournament_id='${tid}';`),before.rows);
 assert.deepEqual(owner(`select app.save_custom_q_setup_draft_v2('${tid}',${literal(before.envelope)});`),before.saved);
 assert.equal(owner(`select to_jsonb(count(*))from app.tournament_setup_side_pool_versions where tournament_id='${tid}'and custom_ratio_denominator_v3 is not null;`),0);
 return{legacyWorkspaceUnchanged:true,legacyRowsUnchangedExceptNewNullableColumn:true,legacyReplayExact:true};
}
