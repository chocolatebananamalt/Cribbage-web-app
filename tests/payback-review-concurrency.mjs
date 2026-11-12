// Explicit local-only concurrent RPC proof. Uses a disposable database in the reviewed network-disabled container.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
if (process.argv.slice(2).join(",") !== "--isolated-container") throw new Error("Explicit --isolated-container only");
const container="cribbage-0240-isolated", db="fixture_payback_race";
const dockerArgs=["--context","desktop-linux"];
function docker(args,input) {
 const r=spawnSync("docker",[...dockerArgs,...args],{input,encoding:"utf8",maxBuffer:64*1024*1024});
 if(r.status!==0)throw new Error(String(r.stderr));return String(r.stdout);
}
const meta=JSON.parse(docker(["inspect",container]))[0];
assert.equal(meta.Config.Labels["codex.fixture"],container);
assert.equal(meta.Image,"sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706");
assert.equal(meta.Config.Image,"public.ecr.aws/supabase/postgres:17.11.0.004");
assert.equal(meta.HostConfig.NetworkMode,"none");assert.equal(meta.Mounts.length,0);
assert.equal(Object.keys(meta.HostConfig.PortBindings??{}).length,0);assert.equal(meta.HostConfig.Privileged,false);
const sql=(query,database=db)=>docker(["exec","-i",container,"psql","-X","-qAt","-U","supabase_admin","-d",database,"-v","ON_ERROR_STOP=1"],"set role postgres;\n"+query).trim();
assert.equal(sql("select (select count(*) from auth.users),(select count(*) from app.tournaments);","fixture_0240"),"0|0");
assert.equal(sql("select count(*) from pg_database where datname='fixture_payback_race';","postgres"),"0","Inspect uncertain prior database before retry");
const hash=v=>crypto.createHash("sha256").update(v.replaceAll("\r\n","\n")).digest("hex");
const canonical=fs.readFileSync("database/migrations/0240_versioned_settlement_v5.sql","utf8");
const proposal=fs.readFileSync("docs/quality/2026-10-27-proposed-payback-review-v1.sql","utf8");
assert.equal(hash(fs.readFileSync("database/migrations/0241_payback_review_v1.sql","utf8")),hash(proposal));
assert.equal(hash(canonical),"19107d90cc6c86fbf3497bb7bd0f28ad19c07f48f0393eb0ee0d9e693f40b701");
assert.equal(hash(proposal),"46c14bb2b7ad9e2f5ba27e78997043f6b9503801eb3503234db24017d41abca9");
const fixture=fs.readFileSync("tests/payback-review-v1.sql","utf8"), marker="-- PAYBACK_REVIEW_V1_CONCURRENCY_SEED_END";
assert.equal(fixture.split(marker).length,2);
let seed=fixture.split(marker)[0];
const guard="current_database()<>'fixture_0240'";
assert.equal(seed.split(guard).length,2);seed=seed.replace(guard,"current_database()<>'fixture_payback_race'");
for(const [include,body] of [["\\ir ../database/migrations/0240_versioned_settlement_v5.sql",canonical],["\\ir ../docs/quality/2026-10-27-proposed-payback-review-v1.sql",proposal]]) {
 assert.equal(seed.split(include).length,2);seed=seed.replace(include,()=>body);
}
assert.doesNotMatch(seed,/^\s*\\i/m);
const actor="a1310000-0000-4000-8000-000000000001",tid="b1310000-0000-4000-8000-000000000001",eid="11310000-0000-4000-8000-000000000001";
let created=false;
function session(query,label) {
 const child=spawn("docker",[...dockerArgs,"exec","-i",container,"psql","-X","-qAt","-U","supabase_admin","-d",db,"-v","ON_ERROR_STOP=1"],{stdio:["pipe","pipe","pipe"]});
 let out="",err="",resolveHeld;
 const held=new Promise(resolve=>resolveHeld=resolve);
 child.stdout.on("data",chunk=>{out+=chunk;if(out.includes("LOCK_HELD"))resolveHeld();});
 child.stderr.on("data",chunk=>err+=chunk);
 const done=new Promise((resolve,reject)=>{child.on("error",reject);child.on("close",code=>code===0?resolve(out.trim()):reject(new Error(label+": "+err)));});
 child.stdin.end("set role postgres; set application_name='"+label+"';\n"+query);
 return{held,done};
}
async function race(body,ops,tag) {
 const holder=session("begin; select pg_advisory_xact_lock(hashtextextended('settlement:"+eid+"',0)); select 'LOCK_HELD'; select pg_sleep(4); commit;",tag+"_hold");
 await Promise.race([holder.held, holder.done.then(() => { throw new Error("Lock holder exited before handoff"); })]);
 const runs=ops.map((op,n)=>session("select public.save_event_payback_review_v1('"+actor+"','"+tid+"','"+eid+"','"+JSON.stringify(body).replaceAll("'","''")+"'::jsonb,'"+op+"');",tag+"_"+n));
 let waiting=0;
 for(let n=0;n<15;n++){
  waiting=Number(sql("select count(*) from pg_stat_activity where datname=current_database() and application_name in('"+tag+"_0','"+tag+"_1') and wait_event_type='Lock';"));
  if(waiting===2)break;await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.equal(waiting,2,"Both real independent requests must overlap while waiting");
 const result=await Promise.all(runs.map(run=>run.done));
 await holder.done;return result.map(value=>JSON.parse(value));
}
try {
 docker(["exec",container,"createdb","-U","supabase_admin","-O","postgres","--template=fixture_0240",db]);created=true;
 sql("set role postgres;\n"+seed+"\nset constraints all immediate; commit;");
 assert.equal(sql("select count(*) from app.event_payback_reviews_v1;"),"0");
 const body=JSON.parse(sql("select jsonb_build_object('draftId',d.id,'draftVersion',d.version,'expectedVersion',0,'scheduleKind','director_selected','amountBasis','total_award','scheduleReference','TEST ONLY local race schedule','sourceReference','ACC Policy Manual chapter 6 III; simulated local evidence','eligibilityEvidence',(select jsonb_agg(jsonb_build_object('participantId',q->>'participantId','basis','full_entry_cash_eligible','evidenceReference','TEST ONLY explicit eligibility')order by q->>'participantId')from jsonb_array_elements(d.canonical_mrp->'rows')q),'expenseClassifications',jsonb_build_array(jsonb_build_object('expenseEventId',d.sanctioning_expense_event_id,'category','sanctioning','evidenceReference','TEST ONLY recorded expense')))from app.event_settlement_drafts_v5 d where event_id='"+eid+"' order by version desc limit 1;"));
 const sameKey="e2800000-0000-4000-8000-000000000001";
 const same=await race(body,[sameKey,sameKey],"payback_same");
 assert.deepEqual(same[0],same[1]);assert.equal(same[0].status,"payback_review_saved_v1");assert.equal(same[0].version,1);
 assert.equal(sql("select count(*) from app.event_payback_reviews_v1;"),"1");
 const next={...body,expectedVersion:1};
 const stale=await race(next,["e2800000-0000-4000-8000-000000000002","e2800000-0000-4000-8000-000000000003"],"payback_stale");
 assert.equal(stale.filter(r=>r.status==="payback_review_saved_v1"&&r.version===2).length,1);
 assert.equal(stale.filter(r=>r.code==="stale_version").length,1);
 assert.equal(sql("select count(*) from app.event_payback_reviews_v1;"),"2");
 assert.equal(sql("select count(*) from app.operation_receipts where operation_type='save_event_payback_review_v1';"),"3");
 assert.equal(sql("select count(*) from app.audit_events where action in('payback_review_saved_v1','payback_review_rejected');"),"3");
 assert.equal(sql("select count(*) from app.event_settlement_finals_v2;"),"0");
 console.log("PAYBACK_REAL_OVERLAP_SAME_KEY_REPLAY_AND_STALE_APPEND_PASSED: 2 waiting sessions in each race; 2 reviews, 3 receipts, 3 audits, 0 finals.");
} finally {
 if(created)docker(["exec",container,"dropdb","-U","supabase_admin","--force",db]);
 assert.equal(sql("select count(*) from pg_database where datname='fixture_payback_race';","postgres"),"0");
 assert.equal(sql("select (select count(*) from auth.users),(select count(*) from app.tournaments);","fixture_0240"),"0|0");
 console.log("Race database removed; original rollback database remains empty.");
}
