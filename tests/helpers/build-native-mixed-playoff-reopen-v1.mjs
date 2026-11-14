// Deterministic local SOURCE generation. No SQL execution or network.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const playoffReopenPinsV1={
 'database/proposals/native-mixed-playoff-v1.sql':'db6c616cfb841c02f22fed8144715e8d3e4e5b5e589b4d7b6258af866f4aa52d',
 'database/proposals/native-mixed-playoff-own-read-v1.sql':'d6f550b4e6bd9b77b5f3248c4c4ad250c344cf23d91d47fd1f6615c1246f50bf',
 'database/proposals/native-mixed-latest-prize-admission-v1.sql':'83c1f647d1dbea821e80e205bbcc3628551a56fceffc09cbeaa5cd5a7d1ea672',
};
const load=p=>{const b=fs.readFileSync(p);assert.equal(sha(b),playoffReopenPinsV1[p],p);return b.toString('utf8').replaceAll('\r\n','\n');};
const one=(s,a,b)=>{assert.equal(s.split(a).length-1,1,'One reviewed anchor: '+a);return s.replace(a,()=>b);};
const fn=(s,n)=>{const m=s.match(new RegExp(`create function app\\.${n}\\([\\s\\S]*?end\\$\\$;`));assert(m,n);const v=m[0].replace(/^create function/,'create or replace function');return v.includes("set timezone='UTC'")?v:v.replace("set search_path=''","set search_path=''set timezone='UTC'");};
const table='app.native_mixed_playoff_evidence_v1';
const all='app.native_mixed_playoff_all_evidence_v1()';
const active='app.native_mixed_playoff_active_evidence_v1(c.id,slot_no,game_no)';
const locks=s=>s.replaceAll('lock table app.native_mixed_playoff_contexts_v1,','lock table app.native_mixed_playoff_reopens_v1,app.native_mixed_playoff_attempt_evidence_v1,app.native_mixed_playoff_own_closures_v1,app.native_mixed_playoff_contexts_v1,');
const hist=(ctx,slot,num,md,h,attempt)=>`app.native_mixed_playoff_attempt_digest_v1(${ctx},${slot},${num},${md},${h},${attempt})`;
export function buildNativeMixedPlayoffReopenSQLV1(){
 const base=load('database/proposals/native-mixed-playoff-v1.sql'),own=load('database/proposals/native-mixed-playoff-own-read-v1.sql');load('database/proposals/native-mixed-latest-prize-admission-v1.sql');const parts=[];
 let s=fn(base,'native_mixed_playoff_row_bound_v1');
 s=s.replaceAll(`from ${table}`,`from ${all}`);
 s=one(s,"if v is null then return false;end if;",`if v is null then return false;end if;
 if kind='evidence'and app.native_mixed_playoff_entry_attempt_v1(row_id)is not null and app.native_mixed_playoff_reopen_bound_v1(app.native_mixed_playoff_entry_attempt_v1(row_id))is distinct from true then return false;end if;`);
 s=one(s,"and sequence<(v->>'sequence')::integer;","and sequence<(v->>'sequence')::integer and app.native_mixed_playoff_entry_attempt_v1(id)is not distinct from app.native_mixed_playoff_entry_attempt_v1(row_id);");
 s=one(s,"app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-game-history-v1',c.id,(v->>'slot')::integer,(v->>'game_number')::integer,v->>'match_digest',prior_history))",hist('c.id',"(v->>'slot')::integer","(v->>'game_number')::integer","v->>'match_digest'",'prior_history','app.native_mixed_playoff_entry_attempt_v1(row_id)'));
 parts.push(s);
 s=fn(base,'native_mixed_playoff_game_v1');
 s=one(s,'winner text;refs','disputed boolean:=false;winner text;refs');
 s=one(s,"for e in select value from jsonb_array_elements(history)loop",`for e in select value from jsonb_array_elements(history)loop
  if disputed then return null;end if;`);
 s=one(s,"or(winner is not null and winner<>p->>'winnerParticipantId')or jsonb_array_length(confirmed)>0 then return null;end if;",`or jsonb_array_length(confirmed)>0 then return null;end if;
   if winner is not null and winner<>p->>'winnerParticipantId'then disputed:=true;end if;`);
 s=one(s,"or(winner is not null and winner<>item->>'winnerParticipantId')then return null;end if;winner:=item->>'winnerParticipantId';end loop;",`then return null;end if;if winner is not null and winner<>item->>'winnerParticipantId'then disputed:=true;end if;winner:=item->>'winnerParticipantId';end loop;`);
 const oldReview="if not app.native_mixed_pool_exact_v1(p,array['captureId','artifactId','artifactDigest','reenteredClaims','statement'])or p->>'statement'is distinct from'fictional-playoff-paper-review-v1'";
 s=one(s,oldReview,`if not(app.native_mixed_pool_exact_v1(p,array['captureId','artifactId','artifactDigest','reenteredClaims','statement'])or app.native_mixed_pool_exact_v1(p,array['captureId','artifactId','artifactDigest','reenteredClaims','decision','statement']))or p->>'statement'is distinct from'fictional-playoff-paper-review-v1'`);
 s=one(s,"or p->'reenteredClaims'is distinct from capture_entry->'claims'then return null;end if;review_entry:=e;",`or jsonb_typeof(p->'reenteredClaims')is distinct from'array'then return null;end if;
   if jsonb_array_length(p->'reenteredClaims')<>jsonb_array_length(paper)or(select count(distinct x->>'participantId')from jsonb_array_elements(p->'reenteredClaims')x)<>jsonb_array_length(paper)then return null;end if;
   for item in select value from jsonb_array_elements(p->'reenteredClaims')loop
    if not app.native_mixed_pool_exact_v1(item,array['participantId','winnerParticipantId'])or app.native_mixed_simulation_uuid_v1(item->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(item->>'winnerParticipantId')is distinct from true or not(paper?(item->>'participantId'))or not(participants?(item->>'winnerParticipantId'))then return null;end if;
   end loop;
   if not(p?'decision')then if p->'reenteredClaims'is distinct from capture_entry->'claims'then return null;end if;
   elsif p->>'decision'='accepted-simulation-only'then
    if(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(p->'reenteredClaims')x)is distinct from(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(capture_entry->'claims')x)then return null;end if;
   elsif p->>'decision'='disputed-simulation-only'then
    if jsonb_array_length(confirmed)>0 or(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(p->'reenteredClaims')x)is not distinct from(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(capture_entry->'claims')x)then return null;end if;disputed:=true;
   else return null;end if;review_entry:=e;`);
 s=one(s,"return jsonb_build_object('complete',winner is not null",`if disputed then return jsonb_build_object('complete',false,'winnerId',null,'reviewRequired',true);end if;
 return jsonb_build_object('complete',winner is not null`);parts.push(s);
 s=fn(base,'native_mixed_playoff_progress_v1');
 s=one(s,`for n in select distinct game_number from ${table} where context_id=context_value and slot=slot_value`,
  `for n in select distinct game_number from ${all} where context_id=context_value and slot=slot_value
  union select game_number from app.native_mixed_playoff_reopens_v1 where context_id=context_value and slot=slot_value`);
 s=s.replaceAll(`from ${table} where context_id=context_value and slot=slot_value and game_number=n`,`from app.native_mixed_playoff_active_evidence_v1(context_value,slot_value,n)where context_id=context_value and slot=slot_value and game_number=n`);
 s=s.replaceAll(`from ${table} where context_id=context_value and slot=slot_value and game_number>n`,`from ${all} where context_id=context_value and slot=slot_value and game_number>n`);
 s=one(s,"app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-game-history-v1',c.id,slot_value,n,m->>'matchDigest',history))",hist('c.id','slot_value','n',"m->>'matchDigest'",'history','app.native_mixed_playoff_active_attempt_v1(c.id,slot_value,n)'));
 s=one(s,"'winnerId',g->'winnerId'));","'winnerId',g->'winnerId')||case when g->'reviewRequired'='true'::jsonb then jsonb_build_object('reviewRequired',true)else'{}'::jsonb end);");parts.push(s);
 s=fn(base,'native_mixed_playoff_result_bound_v1');
 s=one(s,`from ${table} where context_id=c.id and slot=r.slot order by game_number desc,sequence desc limit 1`,`from ${all} where context_id=c.id and slot=r.slot and app.native_mixed_playoff_entry_attempt_v1(id)is not distinct from app.native_mixed_playoff_active_attempt_v1(c.id,r.slot,game_number)order by game_number desc,sequence desc limit 1`);parts.push(s);
 s=locks(fn(base,'execute_native_mixed_playoff_v1'));
 s=one(s,`from ${table} where context_id=c.id and slot=slot_no and game_number=game_no`,`from ${active} where context_id=c.id and slot=slot_no and game_number=game_no`);
 s=s.replaceAll("app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-game-history-v1',c.id,slot_no,game_no,m->>'matchDigest',history))",hist('c.id','slot_no','game_no',"m->>'matchDigest'",'history','app.native_mixed_playoff_active_attempt_v1(c.id,slot_no,game_no)'));
 s=one(s,`from ${table} where entry->>'artifactId'`,`from ${all} where entry->>'artifactId'`);
 s=one(s,"payload:=(data->'entry')-'type';",`if exists(select 1 from jsonb_array_elements(progress->'games')g where g->'gameNumber'=data->'gameNumber'and g->'reviewRequired'='true'::jsonb)then return jsonb_build_object('status','rejected','code','evidence_mismatch');end if;
  payload:=(data->'entry')-'type';`);
 s=one(s,"if progress is null then return jsonb_build_object('status','rejected','code','evidence_mismatch');end if;",`if progress is null then return jsonb_build_object('status','rejected','code','evidence_mismatch');end if;
  if(progress->'games'->-1)->'reviewRequired'='true'::jsonb and app.native_mixed_playoff_disagreement_enabled_v1()is distinct from true then return jsonb_build_object('status','retry_exact','code','playoff_disagreement_unavailable');end if;`);
 s=one(s,`insert into ${table}(id,context_id`, `if app.native_mixed_playoff_active_attempt_v1(c.id,slot_no,game_no)is null then
  insert into ${table}(id,context_id`);
 const endInsert="response);kind:='evidence';";
 s=one(s,endInsert,`response);
  else insert into app.native_mixed_playoff_attempt_evidence_v1(attempt_id,id,context_id,tournament_id,event_id,slot,game_number,sequence,actor_id,actor_session_id,operation_id,receipt_id,request_payload,request_hash,match_digest,entry,authority_capture,entry_digest,response_payload)
   values(app.native_mixed_playoff_active_attempt_v1(c.id,slot_no,game_no),idv,c.id,tid,eid,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,rid,request,request_hash,m->>'matchDigest',entry_value,authority,app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-evidence-v1',idv,c.id,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,request,m->>'matchDigest',entry_value,authority)),response);end if;kind:='evidence';`);
 parts.push(s);
 parts.push(locks(fn(base,'get_native_mixed_playoff_v1')));
 s=locks(fn(own,'get_native_mixed_playoff_own_v1'));
 s=s.replaceAll(`from ${table} where context_id=c.id and slot=slot_no`,`from app.native_mixed_playoff_active_evidence_v1(c.id,slot_no,(g->>'gameNumber')::integer)where context_id=c.id and slot=slot_no`);
 s=one(s,"'reenteredClaims',e->'reenteredClaims');","'reenteredClaims',e->'reenteredClaims')||case when e?'decision'then jsonb_build_object('decision',e->'decision')else'{}'::jsonb end;");
 s=one(s,"'counterEvidenceAvailable',own_submitted,'entries',entries));","'counterEvidenceAvailable',own_submitted,'entries',entries,'reviewRequired',coalesce(g->'reviewRequired','false'::jsonb)));");parts.push(s);
 const out='database/proposals/native-mixed-playoff-reopen-v1.sql',marker='-- BEGIN DERIVED FUNCTIONS: build-native-mixed-playoff-reopen-v1.mjs';
 const prefix=fs.readFileSync(out,'utf8').replaceAll('\r\n','\n').split(marker)[0]+marker+'\n';
 const body=prefix+parts.join('\n\n')+'\n';
 const fns=[...body.matchAll(/create (?:or replace )?function ((?:app|public)\.[a-z0-9_]+)\(([^)]*)\)/g)].map(m=>({name:m[1],args:m[2].split(',').filter(Boolean).map(a=>a.trim().split(/\s+/).slice(1).join(' ').replace(/ default .*/, '')).join(',')}));
 return body+fns.map(f=>`alter function ${f.name}(${f.args})owner to postgres;\nrevoke all on function ${f.name}(${f.args})from public,anon,authenticated,service_role;`).join('\n')+'\ncommit;\n';
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/build-native-mixed-playoff-reopen-v1.mjs'))fs.writeFileSync('database/proposals/native-mixed-playoff-reopen-v1.sql',buildNativeMixedPlayoffReopenSQLV1());
