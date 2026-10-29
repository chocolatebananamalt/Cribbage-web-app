// Verify old disclosures/unpaid reviews still work after proposed0246.
import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
import {foundation,actor,tid,uuid,quote} from './fixtures/q-review-foundation.mjs';
const sql=q=>{const r=spawnSync('docker',['--context','desktop-linux','exec','-i','cribbage-qv2-local','psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d','fixture_qv2','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};
sql(foundation());let w=JSON.parse(sql(`select public.get_q_obligation_review_workspace_v1('${actor}','${tid}');`));
assert.deepEqual(w.blockers,[]);assert.deepEqual(w.preview.flatMap(p=>p.rows.map(r=>r.amountMinor)),[667,667,666,1000]);
const req={expectedVersion:0,sourceDigest:w.sourceDigest,reason:'TEST ONLY legacy compatibility unpaid review',reviewed:true};
const query=`select public.record_q_obligation_review_v1('${actor}','${tid}',${quote(JSON.stringify(req))},'${uuid('e246',10)}');`;
const saved=JSON.parse(sql(query));assert.equal(saved.status,'q_obligations_recorded');assert.deepEqual(JSON.parse(sql(query)),saved);
w=JSON.parse(sql(`select public.get_q_obligation_review_workspace_v1('${actor}','${tid}');`));assert.equal(w.current,true);assert.equal(w.history.length,1);assert.equal(w.history[0].status,'unpaid');
assert.equal(sql('select (select count(*) from app.q_operating_policies_v2)+(select count(*) from app.q_cut_attestations_v2);'),'0');
const v2=JSON.parse(sql(`select public.get_q_operating_workspace_v2('${actor}','${tid}');`));assert.ok(v2.blockers.includes('legacy_policy_preserved'));assert.equal(v2.canPublish,false);
const evidence={legacyPreviewMinor:[667,667,666,1000],immutableReviewId:saved.reviewId,historyCount:1,current:true,exactReplay:true,v2Records:0};fs.writeFileSync('test-results/q-operating-legacy-result.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
