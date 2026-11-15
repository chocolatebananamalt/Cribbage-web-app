// Deterministic SOURCE-only proof refactor. No database, shell or network.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const playoffProofBaseV2={file:'database/proposals/native-mixed-playoff-reopen-v1.sql',sha256:'2c6c0a253adc887443e6c33203115b94a261d167243ce32c603fb689f501c6e7'};
const one=(s,a,b)=>{assert.equal(s.split(a).length-1,1,'One exact reviewed anchor: '+a);return s.replace(a,()=>b);};
const fn=(s,n)=>{const m=s.match(new RegExp(`create (?:or replace )?function app\\.${n}\\([\\s\\S]*?end\\$\\$;`));assert(m,n);return m[0];};
export function buildNativeMixedPlayoffProofV2(){
 const bytes=fs.readFileSync(playoffProofBaseV2.file);assert.equal(sha(bytes),playoffProofBaseV2.sha256);const base=bytes.toString('utf8').replaceAll('\r\n','\n');
 let leaf=one(fn(base,'native_mixed_playoff_row_bound_v1'),'create or replace function app.native_mixed_playoff_row_bound_v1(','create function app.native_mixed_playoff_leaf_row_bound_v2(');
 leaf=one(leaf," if kind='evidence'and app.native_mixed_playoff_entry_attempt_v1(row_id)is not null and app.native_mixed_playoff_reopen_bound_v1(app.native_mixed_playoff_entry_attempt_v1(row_id))is distinct from true then return false;end if;\n",'');
 const wrapper=`create or replace function app.native_mixed_playoff_row_bound_v1(row_id uuid,kind text)returns boolean
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$declare attempt uuid;begin
 if app.native_mixed_playoff_leaf_row_bound_v2(row_id,kind)is distinct from true then return false;end if;
 if kind='evidence'then
  attempt:=app.native_mixed_playoff_entry_attempt_v1(row_id);
  if attempt is not null then return app.native_mixed_playoff_reopen_bound_v1(attempt);end if;
 end if;
 return true;end$$;`;
 let ancestry=fn(base,'native_mixed_playoff_reopen_bound_v1').replace(/^create function/,'create or replace function');
 ancestry=one(ancestry,';h jsonb;v record;begin',';h jsonb;v record;cursor_id uuid:=reopen;seen uuid[]:=array[]::uuid[];root_context uuid;root_slot integer;root_game integer;expected_version integer;m jsonb;begin');
 ancestry=one(ancestry,' select*into p from app.native_mixed_playoff_reopens_v1 where id=reopen;if p.id is null then return false;end if;',` -- Function-local state only. A historical header/row is proved once in this
 -- strictly decreasing chain; no session setting or client cache is trusted.
 while cursor_id is not null loop
 if cursor_id=any(seen)then return false;end if;seen:=array_append(seen,cursor_id);
 select*into p from app.native_mixed_playoff_reopens_v1 where id=cursor_id;if p.id is null then return false;end if;
 if root_context is null then
  root_context:=p.context_id;root_slot:=p.slot;root_game:=p.game_number;expected_version:=p.version;
  m:=app.native_mixed_playoff_match_v1(root_context,root_slot);if m is null then return false;end if;
 elsif p.context_id<>root_context or p.slot<>root_slot or p.game_number<>root_game or p.version<>expected_version then return false;end if;
 if p.version<1 or(p.version=1 and p.prior_attempt_id is not null)or(p.version>1 and p.prior_attempt_id is null)then return false;end if;`);
 ancestry=one(ancestry,"app.native_mixed_playoff_row_bound_v1(c.id,'context')","app.native_mixed_playoff_leaf_row_bound_v2(c.id,'context')");
 ancestry=one(ancestry,'  if prior.id is null or app.native_mixed_playoff_reopen_bound_v1(prior.id)is distinct from true then return false;end if;','  if prior.id is null then return false;end if;');
 ancestry=one(ancestry,"app.native_mixed_playoff_row_bound_v1(v.id,'evidence')","app.native_mixed_playoff_leaf_row_bound_v2(v.id,'evidence')");
 ancestry=one(ancestry,' return h=p.prior_history',' if(h=p.prior_history');
 ancestry=one(ancestry,"app.native_mixed_playoff_match_v1(p.context_id,p.slot)->>'matchDigest'","m->>'matchDigest'");
 ancestry=one(ancestry,"app.native_mixed_playoff_match_v1(p.context_id,p.slot)->'participants'","m->'participants'");
 ancestry=one(ancestry,'p.prior_history,p.response_payload));\nend$$;',`p.prior_history,p.response_payload)))is distinct from true then return false;end if;
 expected_version:=p.version-1;cursor_id:=p.prior_attempt_id;
 end loop;
 return cardinality(seen)>0;end$$;`);
 const prefix=`-- PRIVATE CLOSED proof-only followup. Frozen V1 source remains unchanged.
-- Requires native-mixed-playoff-reopen-v1.sql SHA256 ${playoffProofBaseV2.sha256}.
-- Same wire, hashes, policy, authority and every row/header/receipt/audit check.
-- No tables, grants, enablement, public API, cache or sporting result changes.
begin;
`;
 const guarded=['native_mixed_playoff_row_bound_v1','native_mixed_playoff_reopen_bound_v1'].map(n=>{const d=fn(base,n),body=d.slice(d.indexOf('as $$')+5,d.lastIndexOf('$$;'));return{name:n,args:n.includes('row_bound')?'uuid,text':'uuid',bodySha256:sha(body)};});
 const guard=`do $dependencies$declare x record;p record;begin
 for x in select*from(values ${guarded.map(v=>`('app.${v.name}(${v.args})','${v.bodySha256}')`).join(',')})v(signature,body_sha)loop
  select*into p from pg_proc where oid=to_regprocedure(x.signature);
  if p.oid is null or encode(extensions.digest(replace(p.prosrc,E'\\r\\n',E'\\n'),'sha256'),'hex')<>x.body_sha
   or pg_get_userbyid(p.proowner)<>'postgres'or p.prosecdef is distinct from true or p.provolatile<>'s'
   or p.proconfig is distinct from array['search_path=""','TimeZone=UTC']::text[]
   or has_function_privilege('anon',p.oid,'execute')or has_function_privilege('authenticated',p.oid,'execute')or has_function_privilege('service_role',p.oid,'execute')
  then raise exception 'playoff_proof_dependency_changed: %',x.signature;end if;
 end loop;end$dependencies$;\n`;
 return prefix+guard+leaf+'\n\n'+wrapper+'\n\n'+ancestry+`\n
alter function app.native_mixed_playoff_leaf_row_bound_v2(uuid,text)owner to postgres;
revoke all on function app.native_mixed_playoff_leaf_row_bound_v2(uuid,text)from public,anon,authenticated,service_role;
-- CREATE OR REPLACE preserves the two existing OIDs, owners and ACLs.
commit;
`;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/build-native-mixed-playoff-proof-v2.mjs'))fs.writeFileSync('database/proposals/native-mixed-playoff-proof-v2.sql',buildNativeMixedPlayoffProofV2());
