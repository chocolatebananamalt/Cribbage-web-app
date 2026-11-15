import fs from'node:fs';import assert from'node:assert/strict';
const dir='test-results/native-mixed-pilot-reduced3-20261107';let state;
for(let i=0;i<60;i++){state=JSON.parse(fs.readFileSync(dir+'/state.json'));if(state.cleaned)throw Error('Fixture already removed; no operation attempted');if(state.installed)break;await new Promise(r=>setTimeout(r,1000));}
assert(state.installed,'Installation pending; no operation attempted');
const{sql,claims,quote}=await import('./helpers/native-mixed-pilot-reduced3-acceptance-db.mjs'),prior=JSON.parse(fs.readFileSync(dir+'/compatibility-legacy-save.json'));
const call=`select public.save_linked_tournament_setup_v1('${prior.tid}',${quote(JSON.stringify(prior.envelope))}::jsonb);`;
const before=JSON.parse(sql(`select jsonb_build_object('receipts',(select count(*)from app.operation_receipts where tournament_id='${prior.tid}'),'audits',(select count(*)from app.audit_events where tournament_id='${prior.tid}'));`));
const outputs=sql('begin;'+claims(prior.actor,'authenticated')+call+call+'rollback;').split('\n').filter(Boolean).map(JSON.parse);assert.deepEqual(outputs,[prior.saved,prior.saved]);
const after=JSON.parse(sql(`select jsonb_build_object('receipts',(select count(*)from app.operation_receipts where tournament_id='${prior.tid}'),'audits',(select count(*)from app.audit_events where tournament_id='${prior.tid}'));`));assert.deepEqual(after,before);
fs.writeFileSync(dir+'/compatibility-old-operation-replay.json',JSON.stringify({transactionRolledBack:true,oldExactReplay:true,before,after,outputs},null,2));console.log('OLD ACCEPTED OPERATION REPLAY PASSED');
