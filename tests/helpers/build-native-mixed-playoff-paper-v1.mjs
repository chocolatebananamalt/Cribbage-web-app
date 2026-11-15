// Deterministic SOURCE generation only. No SQL execution or network.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const playoffPaperPinsV1={
 'database/proposals/native-mixed-playoff-reopen-v1.sql':'2c6c0a253adc887443e6c33203115b94a261d167243ce32c603fb689f501c6e7',
 'database/proposals/native-mixed-playoff-proof-v2.sql':'f0cd43b162ed620e3ae9ad189620205817818138fa3f2c39016f149ab9afe72c',
};
const load=p=>{const b=fs.readFileSync(p);assert.equal(sha(b),playoffPaperPinsV1[p],p);return b.toString('utf8').replaceAll('\r\n','\n');};
const one=(s,a,b)=>{assert.equal(s.split(a).length-1,1,'One reviewed anchor: '+a);return s.replace(a,()=>b);};
const fn=(s,n)=>{const m=s.match(new RegExp(`create (?:or replace )?function app\\.${n}\\([\\s\\S]*?end\\$\\$;`));assert(m,n);return m[0].replace(/^create function/,'create or replace function');};
export function buildNativeMixedPlayoffPaperV1(){
 const base=load('database/proposals/native-mixed-playoff-reopen-v1.sql'),proof=load('database/proposals/native-mixed-playoff-proof-v2.sql'),parts=[];
 let s=fn(proof,'native_mixed_playoff_leaf_row_bound_v2');
 const prior="app.native_mixed_playoff_attempt_digest_v1(c.id,(v->>'slot')::integer,(v->>'game_number')::integer,v->>'match_digest',prior_history,app.native_mixed_playoff_entry_attempt_v1(row_id))";
 const token=`app.native_mixed_playoff_paper_head_token_v1((v->>'actor_id')::uuid,(v->>'actor_session_id')::uuid,c.id,(v->>'slot')::integer,(v->>'game_number')::integer,c.source_digest,v->>'match_digest',(v->>'sequence')::integer-1,${prior})`;
 s=one(s,"d->>'expectedHistoryDigest'is distinct from "+prior,"d->>'expectedHistoryDigest'is distinct from(case when app.native_mixed_playoff_paper_blind_entry_v1(d->'entry')then "+token+'else '+prior+'end)');
 s=one(s,"  expected_entry:=jsonb_build_object('id',row_id",`  if d#>>'{entry,statement}'='fictional-playoff-blind-paper-review-v1'and d#>'{entry,artifactDigest}'is distinct from d->'expectedHistoryDigest'then return false;end if;
  expected_entry:=jsonb_build_object('id',row_id`);parts.push(s);
 s=fn(base,'native_mixed_playoff_game_v1');
 s=one(s,"p->>'statement'is distinct from'fictional-playoff-paper-capture-v1'","coalesce(p->>'statement','')not in('fictional-playoff-paper-capture-v1','fictional-playoff-blind-paper-capture-v1')");
 s=one(s,"p->>'statement'is distinct from'fictional-playoff-paper-review-v1'","coalesce(p->>'statement','')not in('fictional-playoff-paper-review-v1','fictional-playoff-blind-paper-review-v1')");
 s=one(s,"or p->'artifactDigest'is distinct from capture_entry->'artifactDigest'",`or(case when p->>'statement'='fictional-playoff-blind-paper-review-v1'then
     capture_entry->>'statement'is distinct from'fictional-playoff-blind-paper-capture-v1'or p?'decision'or coalesce(p->>'artifactDigest','')!~'^[a-f0-9]{64}$'
    else capture_entry->>'statement'='fictional-playoff-blind-paper-capture-v1'or p->'artifactDigest'is distinct from capture_entry->'artifactDigest'end)`);
 s=one(s,"   if not(p?'decision')then",`   if p->>'statement'='fictional-playoff-blind-paper-review-v1'then
    if(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(p->'reenteredClaims')x)is distinct from(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(capture_entry->'claims')x)then
     if jsonb_array_length(confirmed)>0 then return null;end if;disputed:=true;
    end if;
   elsif not(p?'decision')then`);parts.push(s);
 s=fn(base,'execute_native_mixed_playoff_v1');
 s=one(s,'is_director boolean;','is_director boolean;paper_blind boolean:=false;paper_token text;');
 const cas="  if revision<>(data->>'expectedRevision')::integer or hd<>data->>'expectedHistoryDigest'then return jsonb_build_object('status','rejected','code','history_changed');end if;";
 s=one(s,cas,`  paper_blind:=app.native_mixed_playoff_paper_blind_entry_v1(data->'entry');
  -- A new capture is the durable opt-in marker. No fresh legacy/unknown Paper
  -- statement may turn raw CAS into an answer-guessing oracle. Replay is above.
  if typ in('paper-capture','paper-review')and not paper_blind and exists(select 1 from jsonb_array_elements(history)x where x->>'type'='paper-capture'and x->>'statement'='fictional-playoff-blind-paper-capture-v1')then return jsonb_build_object('status','blocked','code','blind_review_required');end if;
  if paper_blind and exists(select 1 from jsonb_array_elements(history)x where x->>'type'='paper-capture'and x->>'statement'is distinct from'fictional-playoff-blind-paper-capture-v1')then return jsonb_build_object('status','blocked','code','legacy_capture_unsupported');end if;
  if paper_blind and app.native_mixed_playoff_paper_request_valid_v1(request,c.source_capture,m)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if paper_blind and app.native_mixed_playoff_paper_request_subject_v1(tid,eid,request,true)is distinct from actor then return null;end if;
  if paper_blind then paper_token:=app.native_mixed_playoff_paper_head_token_v1(actor,(auth.jwt()->>'session_id')::uuid,c.id,slot_no,game_no,c.source_digest,m->>'matchDigest',revision,hd);end if;
  if revision<>(data->>'expectedRevision')::integer or(case when paper_blind then paper_token else hd end)is distinct from data->>'expectedHistoryDigest'then return jsonb_build_object('status','rejected','code','history_changed');end if;
  if paper_blind and typ='paper-review'and data#>'{entry,artifactDigest}'is distinct from data->'expectedHistoryDigest'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if paper_blind and(app.native_mixed_playoff_paper_enabled_v1()is distinct from true or app.native_mixed_playoff_disagreement_enabled_v1()is distinct from true)then return jsonb_build_object('status','retry_exact','code','playoff_paper_unavailable');end if;`);
 s=one(s,"if(progress->'games'->-1)->'reviewRequired'='true'::jsonb and app.native_mixed_playoff_disagreement_enabled_v1()", "if not paper_blind and(progress->'games'->-1)->'reviewRequired'='true'::jsonb and app.native_mixed_playoff_disagreement_enabled_v1()");
 const reauth="  if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true";
 // Two original authorisation rechecks exist: context and evidence. Only the
 // evidence recheck needs the uniform new-mode admission recheck.
 const at=s.lastIndexOf(reauth);assert(at>=0);s=s.slice(0,at)+`  if paper_blind and(app.native_mixed_playoff_paper_enabled_v1()is distinct from true or app.native_mixed_playoff_disagreement_enabled_v1()is distinct from true)then return jsonb_build_object('status','retry_exact','code','playoff_paper_unavailable');end if;
  if paper_blind and app.native_mixed_playoff_paper_request_subject_v1(tid,eid,request,true)is distinct from actor then raise exception 'Paper Playoff authorization changed';end if;
`+s.slice(at);parts.push(s);
 s=fn(base,'get_native_mixed_playoff_own_v1');
 s=one(s,"'artifactDigest',e->'artifactDigest','reenteredClaims',e->'reenteredClaims'",`'artifactDigest',case when e->>'statement'='fictional-playoff-blind-paper-review-v1'then(select x.entry->'artifactDigest'from app.native_mixed_playoff_active_evidence_v1(c.id,slot_no,(g->>'gameNumber')::integer)x where x.id=(e->>'captureId')::uuid and x.entry->>'type'='paper-capture')else e->'artifactDigest'end,'reenteredClaims',e->'reenteredClaims'`);parts.push(s);
 const output='database/proposals/native-mixed-playoff-paper-v1.sql',marker='-- BEGIN DERIVED FUNCTIONS: build-native-mixed-playoff-paper-v1.mjs';
 const dependencies=[['native_mixed_playoff_leaf_row_bound_v2','uuid,text',proof],['native_mixed_playoff_game_v1','jsonb,jsonb,jsonb',base],['execute_native_mixed_playoff_v1','uuid,uuid,uuid,jsonb',base],['get_native_mixed_playoff_own_v1','uuid,uuid',base]].map(([n,args,source])=>{
  const def=fn(source,n),head=def.split('as $$')[0],body=def.split('as $$')[1].slice(0,-3),configs=[...head.matchAll(/set (search_path|timezone|lock_timeout)='([^']*)'/g)].map(m=>(m[1]==='timezone'?'TimeZone':m[1])+'='+(m[1]==='search_path'?'""':m[2]));
  return `('app.${n}(${args})','${sha(body)}',${head.includes('security definer')},'${head.includes('immutable')?'i':head.includes('stable')?'s':'v'}',array[${configs.map(c=>"'"+c+"'").join(',')}]::text[])`;
 });
 const guard=`-- BEGIN PAPER DEPENDENCIES\ndo $paper_dependencies$declare x record;p record;begin\n for x in select*from(values ${dependencies.join(',')})v(signature,body_sha,definer,volatility,configs)loop\n  select*into p from pg_proc where oid=to_regprocedure(x.signature);\n  if p.oid is null or encode(extensions.digest(replace(p.prosrc,E'\\r\\n',E'\\n'),'sha256'),'hex')<>x.body_sha\n   or pg_get_userbyid(p.proowner)<>'postgres'or p.prosecdef is distinct from x.definer or p.provolatile::text<>x.volatility or p.proconfig is distinct from x.configs\n   or has_function_privilege('anon',p.oid,'execute')or has_function_privilege('authenticated',p.oid,'execute')or has_function_privilege('service_role',p.oid,'execute')\n  then raise exception 'playoff_paper_dependency_changed: %',x.signature;end if;\n end loop;end$paper_dependencies$;\n-- END PAPER DEPENDENCIES\n`;
 const prefix=one(fs.readFileSync(output,'utf8').replaceAll('\r\n','\n').split(marker)[0].replace(/-- BEGIN PAPER DEPENDENCIES[\s\S]*?-- END PAPER DEPENDENCIES\n/,''),'begin;\n','begin;\n'+guard)+marker+'\n';
 const body=prefix+parts.join('\n\n')+'\n';
 const declarations=[...body.matchAll(/create (?:or replace )?function ((?:app|public)\.[a-z0-9_]+)\(([^)]*)\)/g)].map(m=>({name:m[1],args:m[2].split(',').filter(Boolean).map(x=>x.trim().split(/\s+/).slice(1).join(' ').replace(/ default .*/, '')).join(',')}));
 return body+declarations.map(d=>`alter function ${d.name}(${d.args})owner to postgres;\nrevoke all on function ${d.name}(${d.args})from public,anon,authenticated,service_role;`).join('\n')+'\ncommit;\n';
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/build-native-mixed-playoff-paper-v1.mjs'))fs.writeFileSync('database/proposals/native-mixed-playoff-paper-v1.sql',buildNativeMixedPlayoffPaperV1());
