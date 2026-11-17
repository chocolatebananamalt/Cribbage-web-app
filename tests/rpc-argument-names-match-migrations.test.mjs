// Current source pins: actual closed local installation/ACL-denial proof in tests/fixtures/integrated-history/closed-proposals-proof.json. No enabled write/provider claim.
import {assertFictionalGateSource,hasServerOnlyImport} from './helpers/fictional-feature-target.mjs';
// Every .rpc() call names its arguments. PostgREST resolves an RPC by the set of
// argument NAMES, so a call that sends a name the function does not declare is
// not a type error, not a lint error, and not a test failure anywhere else in
// this suite: it is a runtime PGRST202 that the route converts into a 503.
//
// That is exactly how the self-service event check-in shipped broken while all
// 554 other tests passed. This test reads the migrations as the source of truth
// for each function's parameter names and compares every call site against them.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import crypto from 'node:crypto';
import ts from 'typescript';

const root = process.cwd();

function walk(dir, keep, out = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(relative, keep, out);
    else if (keep(entry.name)) out.push(relative);
  }
  return out;
}

// Collect the p_ parameter names inside the balanced parentheses starting at openIndex.
function parameterNames(sql, openIndex, allNames = false) {
  let depth = 0;
  let end = openIndex;
  for (let i = openIndex; i < sql.length; i += 1) {
    if (sql[i] === '(') depth += 1;
    else if (sql[i] === ')') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  const header=sql.slice(openIndex + 1,end);
  return new Set([...header.matchAll(allNames?/(?:^|,)\s*(?:(?:in|inout|variadic)\s+)?(?!out\b)([a-z_][a-z0-9_]*)\s+[a-z_][a-z0-9_.]*(?:\[\])?/gi:/\b(p_[a-z0-9_]+)\b/gi)].map(m=>m[1].toLowerCase()));
}

// Replay the migrations in order. `create [or replace] function` defines a name;
// `alter function ... rename to` moves that definition to a different name, which
// is how superseded versions are retired here.
function declaredFunctions() {
  const declared = new Map();
  for (const file of walk('database/migrations', (name) => name.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(root, file), 'utf8');
    const events = [];
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi)) {
      events.push({ at: m.index, kind: 'create', name: m[1].toLowerCase(), open: m.index + m[0].length - 1 });
    }
    for (const m of sql.matchAll(/alter\s+function\s+public\.([a-z0-9_]+)\s*\([^)]*\)\s*rename\s+to\s+([a-z0-9_]+)/gi)) {
      events.push({ at: m.index, kind: 'rename', name: m[1].toLowerCase(), to: m[2].toLowerCase() });
    }
    events.sort((a, b) => a.at - b.at);
    for (const event of events) {
      if (event.kind === 'create') {
        declared.set(event.name, { params: parameterNames(sql, event.open, true), file });
      } else {
        const existing = declared.get(event.name);
        if (existing) { declared.set(event.to, existing); declared.delete(event.name); }
      }
    }
  }
  return declared;
}

// Read one object literal starting at its opening brace, returning the argument
// names declared directly in it plus the identifiers it spreads in. Depth
// tracking keeps keys of nested value objects out of the top-level list.
function readObjectLiteral(source, open, allNames = false) {
 let tree=sourceTrees.get(source);if(!tree){tree=ts.createSourceFile('caller.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);sourceTrees.set(source,tree);}
 let literal;const visit=n=>{if(ts.isObjectLiteralExpression(n)&&n.getStart(tree)===open)literal=n;if(!literal)ts.forEachChild(n,visit);};visit(tree);if(!literal)return null;
 const names=[],spreads=[];let unsupported=null;for(const property of literal.properties){if(ts.isPropertyAssignment(property)){if(ts.isIdentifier(property.name)||ts.isStringLiteral(property.name)){const name=property.name.text.toLowerCase();if(allNames||/^p_/.test(name))names.push(name);}else unsupported='computed RPC argument key';}else if(ts.isShorthandPropertyAssignment(property)){const name=property.name.text.toLowerCase();if(allNames||/^p_/.test(name))names.push(name);}else if(ts.isSpreadAssignment(property)){if(ts.isIdentifier(property.expression))spreads.push(property.expression.text);else unsupported='RPC argument spread is not a local identifier';}else unsupported='unsupported RPC argument property';}
 return{names,spreads,unsupported};
}

// Resolve `const <name> = { ... }` declared in the same file.
const sourceTrees=new Map();
function resolveLocalObject(source, identifier, allNames = false, at=source.length) {
 let tree=sourceTrees.get(source);if(!tree){tree=ts.createSourceFile('caller.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);sourceTrees.set(source,tree);}
 const matches=[];const visit=n=>{if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text===identifier&&n.initializer&&ts.isObjectLiteralExpression(n.initializer)&&n.getStart(tree)<at){let scope=n.parent;while(scope&&!ts.isBlock(scope)&&!ts.isSourceFile(scope))scope=scope.parent;if(scope&&scope.pos<=at&&scope.end>=at)matches.push({node:n,scope});}ts.forEachChild(n,visit);};visit(tree);
 matches.sort((a,b)=>(a.scope.end-a.scope.pos)-(b.scope.end-b.scope.pos)||b.node.pos-a.node.pos);if(!matches.length)return null;
 return readObjectLiteral(source,matches[0].node.initializer.getStart(tree),allNames);
}

function callSites() {
  const calls = [];
  for (const file of walk('src', (name) => name.endsWith('.ts') || name.endsWith('.tsx'))) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const localOnly=true; // Parse every actual argument name, including modern tid/eid/request signatures.
    for (const m of source.matchAll(/\.rpc\(\s*["'`]([a-z0-9_]+)["'`]\s*(,)?/gi)) {
      const line = source.slice(0, m.index).split('\n').length;
      const call = { file, line, name: m[1].toLowerCase(), args: [], unresolved: null };
      if (!m[2]) { calls.push(call); continue; }

      const after = m.index + m[0].length;
      const rest = source.slice(after);
      const lead = /^\s*/.exec(rest)[0].length;
      const first = rest[lead];

      const collect = (literal, depth) => {
        if (!literal) return;
        call.args.push(...literal.names);
        // A spread carries the arguments of the object it names. Missing that is
        // how this check silently covered nothing at schedule-amendments.
        for (const identifier of literal.spreads) {
          if (depth > 3) { call.unresolved = `spread depth exceeded at ...${identifier}`; return; }
          const resolved = resolveLocalObject(source, identifier, localOnly, m.index);
          if (!resolved) { call.unresolved = `cannot resolve spread ...${identifier}`; continue; }
          collect(resolved, depth + 1);
        }
      };

      if (first === '{') {
        collect(readObjectLiteral(source, after + lead, localOnly), 0);
      } else {
        const identifier = /^([A-Za-z_$][\w$]*)\s*[),]/.exec(rest.slice(lead));
        if (!identifier) call.unresolved = 'second argument is neither an object literal nor a plain identifier';
        else {
          const resolved = resolveLocalObject(source, identifier[1], localOnly, m.index);
          if (!resolved) call.unresolved = `cannot resolve argument object ${identifier[1]}`;
          else collect(resolved, 0);
        }
      }
      calls.push(call);
    }
  }
  return calls;
}

const declared = declaredFunctions();
const calls = callSites();
// Only these two calls in the explicitly local-gated factory may resolve from
// the frozen, executed proposal. Ordinary call sites remain migration-only.
const localCaller='src/lib/api/synthetic-mixed-handlers.ts';
const localFile='database/proposals/synthetic-mixed-evidence-v1.sql';
const localBytes=fs.readFileSync(path.join(root,localFile));
assert.equal(crypto.createHash('sha256').update(localBytes).digest('hex'),'f8248a1afb60e62a563fcd0369e085c115333b6f1631a4c1d7ea774202f112a3','Local SQL exception must remain bound to the verified frozen proposal.');
const localDeclared=new Map();
for(const name of['get_own_synthetic_mixed_hybrid_v1','attest_synthetic_mixed_hybrid_v1']){
 const sql=localBytes.toString('utf8'),match=new RegExp(`create function public\\.${name}\\(`,'i').exec(sql);assert.ok(match,`Missing verified local declaration ${name}`);
 localDeclared.set(name,{params:parameterNames(sql,match.index+match[0].length-1,true),file:localFile});
}
const drawCaller='src/lib/api/roster-random-draw-handlers.ts',drawFile='database/proposals/random-seating-draw-v1.sql',drawBytes=fs.readFileSync(path.join(root,drawFile));
assert.equal(crypto.createHash('sha256').update(drawBytes).digest('hex'),'03eb2379fc0e15eeefb41246c5a459447ac6631f708a1795088e276e68e3f754','Roster draw declarations must match the actual isolated SQL proof.');
const drawDeclared=new Map();
for(const name of ['get_random_seating_plan_v1','get_random_seating_workspace_v1','get_random_seating_operation_v1','save_random_seating_plan_v1','draw_random_seating_candidate_v1']){const sql=drawBytes.toString('utf8'),match=new RegExp(`create function public\\.${name}\\(`,'i').exec(sql);assert.ok(match);drawDeclared.set(name,{params:parameterNames(sql,match.index+match[0].length-1,true),file:drawFile});}
// These TWO unapplied wrapper declarations are allowed only in the production
// factory whose execution gate is a literal false. This is source validation,
// not a claim of executed wrapper acceptance. Enabling the gate breaks this
// exception and requires normal reviewed migration/runtime evidence.
const reviewedCaller='src/lib/api/reviewed-native-seating-production.ts',reviewedFile='database/proposals/reviewed-draw-authenticated-wrapper-v1.sql';
const reviewedBytes=fs.readFileSync(path.join(root,reviewedFile));
assert.equal(crypto.createHash('sha256').update(reviewedBytes).digest('hex'),'7e27fca258ba6767c6439843498fcb7418aba9d43990f0d918d569625ef7bfd0','Unexecuted wrapper source must remain pinned behind its hard-false gate.');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'database/proposals/reviewed-draw-native-publication-v1.sql'))).digest('hex'),'c1b91e64f8d0a31681a6835ef5440fc2d4716fa93de4ca066b05f25856cef50e','Private core must match the isolated runtime proof.');
const reviewedDeclared=new Map();
for(const name of['publish_reviewed_initial_seating_v1','get_reviewed_initial_seating_operation_v1']){const sql=reviewedBytes.toString('utf8'),m=new RegExp(`create function public\\.${name}\\(`,'i').exec(sql);assert.ok(m);reviewedDeclared.set(name,{params:parameterNames(sql,m.index+m[0].length-1),file:reviewedFile});}
// Exact private own-metadata call. Candidate executed in a removed fictional
// fixture; route remains code-disabled and grants remain revoked.
const mixedRouteCaller='src/lib/seating/native-mixed-player-route-v1.ts',mixedRouteFile='database/proposals/native-mixed-own-player-bindings-v1.sql';
const mixedRouteBytes=fs.readFileSync(path.join(root,mixedRouteFile));
assert.equal(crypto.createHash('sha256').update(mixedRouteBytes).digest('hex'),'bbe23cd86c8f4c732f1235643d07d0948f5e47ec5b717a9ff8e50eae56f6a778','Own-player declaration must match isolated privacy acceptance.');
const mixedRouteName='get_native_mixed_own_player_bindings_v1',mixedRouteMatch=/create function public\.get_native_mixed_own_player_bindings_v1\(/i.exec(mixedRouteBytes.toString('utf8'));assert(mixedRouteMatch);
const mixedRouteDeclaration={params:parameterNames(mixedRouteBytes.toString('utf8'),mixedRouteMatch.index+mixedRouteMatch[0].length-1),file:mixedRouteFile};
const paperRouteCaller='src/lib/seating/native-mixed-paper-route-v1.ts',paperRouteFile='database/proposals/native-mixed-paper-binding-v1.sql';
const paperRouteBytes=fs.readFileSync(path.join(root,paperRouteFile));
assert.equal(crypto.createHash('sha256').update(paperRouteBytes).digest('hex'),'e3bc68562ad4501f7255baeb5657009b1a63411dcfdef39c64e180b7df5229f7','Paper declaration must match the reviewed local-only source.');
const paperRouteName='get_native_mixed_paper_binding_v1',paperMatch=/create function public\.get_native_mixed_paper_binding_v1\(/i.exec(paperRouteBytes.toString('utf8'));assert(paperMatch);
const paperDeclaration={params:parameterNames(paperRouteBytes.toString('utf8'),paperMatch.index+paperMatch[0].length-1),file:paperRouteFile};
const pilotCaller='src/lib/api/native-mixed-pilot-director-executor-v1.ts',pilotFile='database/proposals/native-mixed-pilot-confinement-v1.sql',pilotName='execute_native_mixed_pilot_director_v1';
const pilotBytes=fs.readFileSync(path.join(root,pilotFile));
assert.equal(crypto.createHash('sha256').update(pilotBytes).digest('hex'),'e1f3058936d5c186229756fba1cb5527ea4f13f75c0fea0d06fa37196bbff72e','Private confinement source must match reviewed local candidate.');
const pilotMatch=/create function public\.execute_native_mixed_pilot_director_v1\(/i.exec(pilotBytes.toString('utf8'));assert(pilotMatch);
const pilotDeclaration={params:parameterNames(pilotBytes.toString('utf8'),pilotMatch.index+pilotMatch[0].length-1),file:pilotFile};
const leaseCaller='src/lib/api/native-mixed-pilot-director-handlers-v1.ts',leaseFile='database/proposals/native-mixed-pilot-director-session-v1.sql',leaseName='get_native_mixed_pilot_director_session_v1';
const leaseBytes=fs.readFileSync(path.join(root,leaseFile));assert.equal(crypto.createHash('sha256').update(leaseBytes).digest('hex'),'c646b5dd5cb6875cce8a9e74abff74322038df312ad32efff955562c372cdbd9');
const leaseMatch=/create function public\.get_native_mixed_pilot_director_session_v1\(/i.exec(leaseBytes.toString('utf8'));assert(leaseMatch);
const leaseDeclaration={params:parameterNames(leaseBytes.toString('utf8'),leaseMatch.index+leaseMatch[0].length-1),file:leaseFile};
const prepCaller='src/lib/api/native-mixed-pilot-preparation-handlers-v1.ts',prepFile='database/proposals/native-mixed-pilot-preparation-v1.sql',prepName='get_native_mixed_pilot_preparation_v1';
const prepBytes=fs.readFileSync(path.join(root,prepFile));assert.equal(crypto.createHash('sha256').update(prepBytes).digest('hex'),'cf15ab56b0cc6c8d67df12e3f9b0fab37687f4fd84ecb51bfb5b343f20912694');
const prepMatch=/create function public\.get_native_mixed_pilot_preparation_v1\(/i.exec(prepBytes.toString('utf8'));assert(prepMatch);
const prepDeclaration={params:parameterNames(prepBytes.toString('utf8'),prepMatch.index+prepMatch[0].length-1),file:prepFile};
const reserveFile='database/proposals/native-mixed-pilot-draw-reservation-v1.sql',reserveName='reserve_native_mixed_pilot_draw_v1',reserveBytes=fs.readFileSync(path.join(root,reserveFile));assert.equal(crypto.createHash('sha256').update(reserveBytes).digest('hex'),'491adfa47570bf5dba0a09ca0fb460a05cc28e0718e86494cb0f0da2a5a3ff20');
const reserveMatch=/create function public\.reserve_native_mixed_pilot_draw_v1\(/i.exec(reserveBytes.toString('utf8'));assert(reserveMatch);const reserveDeclaration={params:parameterNames(reserveBytes.toString('utf8'),reserveMatch.index+reserveMatch[0].length-1),file:reserveFile};
const bootstrapFile='database/proposals/native-mixed-pilot-bootstrap-status-v1.sql',bootstrapName='get_native_mixed_pilot_bootstrap_v1',bootstrapBytes=fs.readFileSync(path.join(root,bootstrapFile));assert.equal(crypto.createHash('sha256').update(bootstrapBytes).digest('hex'),'350c79236274fb586e4920b57872f07e9fd10da486bd06dcf4be7a870beaf0f7');
const bootstrapMatch=/create function public\.get_native_mixed_pilot_bootstrap_v1\(/i.exec(bootstrapBytes.toString('utf8'));assert(bootstrapMatch);const bootstrapDeclaration={params:parameterNames(bootstrapBytes.toString('utf8'),bootstrapMatch.index+bootstrapMatch[0].length-1),file:bootstrapFile};
const flowCaller='src/lib/api/native-mixed-bootstrap-handlers-v1.ts',flowFile='database/proposals/native-mixed-bootstrap-workflow-v1.sql',flowBytes=fs.readFileSync(path.join(root,flowFile));assert.equal(crypto.createHash('sha256').update(flowBytes).digest('hex'),'f399769ec8ee4aafbd15618fb6a052c16fc4df1976c746462f505cdab19935ed');
const flowDeclared=new Map();for(const name of ['get_native_mixed_bootstrap_session_v1','get_native_mixed_bootstrap_offer_v1','execute_native_mixed_bootstrap_v1','get_native_mixed_own_consent_offer_v1','execute_native_mixed_own_consent_v1']){const m=new RegExp('create function public\\.'+name+'\\(','i').exec(flowBytes.toString('utf8'));assert(m);flowDeclared.set(name,{params:parameterNames(flowBytes.toString('utf8'),m.index+m[0].length-1),file:flowFile});}
const prizeWorkspaceCaller='src/lib/api/event-prize-rpc-v1.ts',prizeWorkspaceFile='database/proposals/event-prize-workspace-source-v1.sql',prizeWorkspaceName='get_event_prize_workspace_provider_v1',prizeWorkspaceBytes=fs.readFileSync(path.join(root,prizeWorkspaceFile));
assert.equal(crypto.createHash('sha256').update(prizeWorkspaceBytes).digest('hex'),'b079d2ba8ff8479ef487f4e1a975c97b6eb4070b5529e837b1b1468b84b2987c','Private prize workspace must match the locally executed proposal.');
const prizeWorkspaceSQL=prizeWorkspaceBytes.toString('utf8'),prizeWorkspaceMatch=new RegExp(`create function public\\.${prizeWorkspaceName}\\(`,'i').exec(prizeWorkspaceSQL);assert.ok(prizeWorkspaceMatch);
const prizeWorkspaceDeclaration={params:parameterNames(prizeWorkspaceSQL,prizeWorkspaceMatch.index+prizeWorkspaceMatch[0].length-1,true),file:prizeWorkspaceFile};
const prizeActivationCaller='src/lib/api/event-prize-activation-handlers-v1.ts',prizeActivationDeclared=new Map();
const proposalStoreCaller='src/lib/api/playoff-prize-proposal-handlers-v2.ts',proposalStoreFile='database/proposals/playoff-prize-proposal-store-v2.sql',proposalStoreDeclared=new Map();
const proposalStoreBytes=fs.readFileSync(path.join(root,proposalStoreFile));assert.equal(crypto.createHash('sha256').update(proposalStoreBytes).digest('hex'),'479a5a3e8e1e459951b2941a972b6ce728eb9cef64b4d1a03a86b6602de06213','Private proposal journal changed: review/install/acceptance evidence must be reconciled.');
for(const name of['get_playoff_prize_proposal_workspace_provider_v2','save_playoff_prize_proposal_provider_v2','get_playoff_prize_proposal_operation_provider_v2']){const sql=proposalStoreBytes.toString('utf8'),m=new RegExp('create function public\\.'+name+'\\(','i').exec(sql);assert(m);proposalStoreDeclared.set(name,{params:parameterNames(sql,m.index+m[0].length-1),file:proposalStoreFile});}
// Resolve this declaration from the exact installed closed package. The later
// private proposal adds a compatibility wrapper and is separately exercised;
// an RPC-name inventory must not silently bless that changed proposal.
function installedFinanceUnit(file,sourceHash){
 const base='test-results/native-mixed-finance-release-20261109',manifest=JSON.parse(fs.readFileSync(base+'/sql-manifest.json','utf8')),bytes=fs.readFileSync(base+'/candidate.sql');
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'0d79b616670a910133e8a94c236166dd9129302222570978b89bab761bdf8c97');
 assert.equal(manifest.sha256,'0d79b616670a910133e8a94c236166dd9129302222570978b89bab761bdf8c97');
 const row=manifest.units.find(unit=>unit.file===file);assert(row);assert.equal(row.sourceSha256,sourceHash);
 const candidate=bytes.toString('utf8'),marker='-- BEGIN '+file+' source SHA256 '+sourceHash,start=candidate.indexOf(marker);assert(start>=0);assert.equal(candidate.lastIndexOf(marker),start);
 const end=candidate.indexOf('-- END '+file,start);assert(end>start);const unit=candidate.slice(candidate.indexOf('\n',start)+1,end).trim();
 assert.equal(crypto.createHash('sha256').update(unit).digest('hex'),row.unitSha256);return Buffer.from(unit);
}
for(const [file,hash,names]of[
 ['database/proposals/event-prize-activation-source-v1.sql','c1d414088b13fb35e6e962b626c5ae67b38ba2517cac69c4d3ce2129f59d8573',['get_event_prize_activation_source_provider_v1','prepare_event_prize_activation_provider_v1','finalize_event_prize_activation_provider_v1','get_event_prize_activation_operation_provider_v1']],
 ['database/proposals/event-prize-rule-context-source-v1.sql','33b0fc2914752d92aac17b874f7ddf22fb929b96393552671156a40304ff6495',['get_event_prize_rule_context_source_provider_v1','save_event_prize_rule_context_provider_v1','get_event_prize_rule_context_operation_provider_v1']],
]){const bytes=file==='database/proposals/event-prize-activation-source-v1.sql'?installedFinanceUnit(file,hash):fs.readFileSync(path.join(root,file));if(file!=='database/proposals/event-prize-activation-source-v1.sql')assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,'Private prize proposal changed; re-review and rerun isolated SQL acceptance.');const sql=bytes.toString('utf8');for(const name of names){const m=new RegExp('create function public\\.'+name+'\\(','i').exec(sql);assert(m);prizeActivationDeclared.set(name,{params:parameterNames(sql,m.index+m[0].length-1,true),file});}}
// One source-only, revoked read resolver; never a proposal-wide fallback.
const mixedReviewCaller='src/lib/api/native-mixed-review-handlers-v1.ts',mixedReviewFile='database/proposals/native-mixed-qualification-review-provider-v1.sql',mixedReviewName='get_native_mixed_qualification_review_provider_v1';
const mixedReviewBytes=fs.readFileSync(path.join(root,mixedReviewFile));
assert.equal(crypto.createHash('sha256').update(mixedReviewBytes).digest('hex'),'b1896f8050060c22841fd24394185726abadf3c62879d3832abac8ffb38e0961','Read-only resolver exception must match the exact reviewed, revoked source candidate.');
const mixedReviewMatch=/create function public\.get_native_mixed_qualification_review_provider_v1\(/i.exec(mixedReviewBytes.toString('utf8'));assert(mixedReviewMatch);
const mixedReviewDeclaration={params:parameterNames(mixedReviewBytes.toString('utf8'),mixedReviewMatch.index+mixedReviewMatch[0].length-1),file:mixedReviewFile};
// Exact two generated wrappers, proved in the removed fictional public-RPC
// fixture. They are not migrations or a proposal-wide resolution fallback.
const playoffTransportFile='database/proposals/native-mixed-playoff-finance-transport-v1.sql';
const playoffTransportBytes=fs.readFileSync(path.join(root,playoffTransportFile));
assert.equal(crypto.createHash('sha256').update(playoffTransportBytes).digest('hex'),'dd4fa8d4ab5fc35d9ccbad13d90ced232b9dfc11972a8942f35a28295ec38c7e');
const playoffTransportCaller='src/lib/api/native-mixed-playoff-own-transport-v1.ts',playoffRouteCaller='src/lib/playoffs/native-mixed-playoff-own-route-v1.ts';
const playoffReadName='get_native_mixed_playoff_own_v1',playoffWriteName='execute_native_mixed_playoff_v1';
const playoffDeclarations=new Map([
 [playoffReadName,{params:new Set(['p_tournament_id','p_event_id']),file:playoffTransportFile}],
 [playoffWriteName,{params:new Set(['p_tournament_id','p_event_id','p_operation_id','p_request']),file:playoffTransportFile}],
]);
const playoffDeclaration=call=>call.file===playoffTransportCaller?playoffDeclarations.get(call.name):call.file===playoffRouteCaller&&call.name===playoffReadName?playoffDeclarations.get(call.name):undefined;
// Exactly three calls in the disabled pool transport. No route or broad
// proposal fallback; generator source and direct recovery declaration pinned.
const poolTransportCaller='src/lib/api/native-mixed-pool-transport-v1.ts';
const poolOperationFile='database/proposals/native-mixed-pool-operation-read-v1.sql',poolOperationBytes=fs.readFileSync(path.join(root,poolOperationFile));
assert.equal(crypto.createHash('sha256').update(poolOperationBytes).digest('hex'),'f1abdbe0ced37ca57f98853510f9f3c535ff76e99afe379aff3975d83dfc19c9');
const poolOperationMatch=/create function public\.get_native_mixed_pool_operation_v1\(/i.exec(poolOperationBytes.toString('utf8'));assert(poolOperationMatch);
const poolPreparationFile='database/proposals/native-mixed-pool-preparation-read-v1.sql',poolPreparationBytes=fs.readFileSync(path.join(root,poolPreparationFile));
assert.equal(crypto.createHash('sha256').update(poolPreparationBytes).digest('hex'),'5e2e62723af0e1d463047083bbbbacc018bdc9cb324b7f3633c6b62e27e11bf7');
const poolPreparationMatch=/create function public\.get_native_mixed_pool_preparation_v1\(/i.exec(poolPreparationBytes.toString('utf8'));assert(poolPreparationMatch);
const poolDeclarations=new Map([
 ['get_native_mixed_pool_preparation_v1',{params:parameterNames(poolPreparationBytes.toString('utf8'),poolPreparationMatch.index+poolPreparationMatch[0].length-1),file:poolPreparationFile}],
 ['get_native_mixed_pool_finance_v1',{params:new Set(['p_tournament_id','p_event_id']),file:playoffTransportFile}],
 ['execute_native_mixed_pool_finance_v1',{params:new Set(['p_tournament_id','p_event_id','p_operation_id','p_request']),file:playoffTransportFile}],
 ['get_native_mixed_pool_operation_v1',{params:parameterNames(poolOperationBytes.toString('utf8'),poolOperationMatch.index+poolOperationMatch[0].length-1),file:poolOperationFile}],
]);
const poolDeclaration=call=>call.file===poolTransportCaller?poolDeclarations.get(call.name):undefined;
// Exactly the reviewed disabled Main adapter; no proposal-wide resolution.
const mainTransportCaller='src/lib/api/native-mixed-main-transport-v1.ts';
const mainOperationFile='database/proposals/native-mixed-main-operation-read-v1.sql',mainOperationBytes=fs.readFileSync(path.join(root,mainOperationFile));
assert.equal(crypto.createHash('sha256').update(mainOperationBytes).digest('hex'),'1919691ae0206b170cf3c7c936bb02f927d923b42e223fa24f14c7d5a2e09333');
const mainOperationMatch=/create function public\.get_native_mixed_main_operation_v1\(/i.exec(mainOperationBytes.toString('utf8'));assert(mainOperationMatch);
const mainDeclarations=new Map([
 ['get_native_mixed_main_finance_v1',{params:new Set(['p_tournament_id','p_event_id']),file:playoffTransportFile}],
 ['execute_native_mixed_main_finance_v1',{params:new Set(['p_tournament_id','p_event_id','p_operation_id','p_request']),file:playoffTransportFile}],
 ['get_native_mixed_main_operation_v1',{params:parameterNames(mainOperationBytes.toString('utf8'),mainOperationMatch.index+mainOperationMatch[0].length-1),file:mainOperationFile}],
]);
const mainDeclaration=call=>call.file===mainTransportCaller?mainDeclarations.get(call.name):undefined;
// Unexecuted manual membership journal: exact source-only contract, no authority.
const mrpManualReviewCaller='src/lib/api/mrp-membership-manual-review-v1.ts',mrpManualReviewFile='database/proposals/mrp-membership-manual-review-v1.sql';
const mrpManualReviewBytes=fs.readFileSync(path.join(root,mrpManualReviewFile));
assert.equal(crypto.createHash('sha256').update(mrpManualReviewBytes).digest('hex'),'ffe5af9a2b04b2164eb0659afdbdc454c573aea481e0837c8172e5c85a2b600c','Manual membership journal source changed: independent source review and isolated runtime proof remain required.');
const mrpManualReviewDeclarations=new Map();
for(const name of ['record_mrp_membership_manual_review_v1','get_mrp_membership_manual_review_operation_v1','get_mrp_membership_manual_review_v1']){const sql=mrpManualReviewBytes.toString('utf8'),m=new RegExp('create function public\\.'+name+'\\(','i').exec(sql);assert(m);mrpManualReviewDeclarations.set(name,{params:parameterNames(sql,m.index+m[0].length-1),file:mrpManualReviewFile});}
const mrpManualReviewDeclaration=call=>call.file===mrpManualReviewCaller?mrpManualReviewDeclarations.get(call.name):undefined;
const gameReopenCaller='src/lib/api/native-mixed-game-reopen-v1.ts',gameReopenFile='database/proposals/native-mixed-game-reopen-v1.sql',gameReopenBytes=fs.readFileSync(path.join(root,gameReopenFile)),gameReopenDeclared=new Map();
assert.equal(crypto.createHash('sha256').update(gameReopenBytes).digest('hex'),'239d2e7a8504d7c6077ff9fd48d58bc015c40d8955fd4f83982031d164f3b962','Correction declarations must match the private isolated runtime proof.');
for(const name of['get_native_mixed_game_reopen_workspace_v1','record_native_mixed_game_reopen_v1','get_native_mixed_game_reopen_operation_v1']){const sql=gameReopenBytes.toString('utf8'),m=new RegExp('create function public\\.'+name+'\\(','i').exec(sql);assert(m);gameReopenDeclared.set(name,{params:parameterNames(sql,m.index+m[0].length-1),file:gameReopenFile});}
const gameReopenDeclaration=call=>call.file===gameReopenCaller?gameReopenDeclared.get(call.name):undefined;
// Exact default-off Paper caller only, never an installed-migration claim or
// blanket resolution for proposals. Private SQL ran in a removed local fixture.
const playoffPaperCaller='src/lib/api/native-mixed-playoff-paper-transport-v1.ts',playoffPaperFile='database/proposals/native-mixed-playoff-paper-v1.sql',playoffPaperBytes=fs.readFileSync(path.join(root,playoffPaperFile)),playoffPaperDeclared=new Map();
assert.equal(crypto.createHash('sha256').update(playoffPaperBytes).digest('hex'),'e82727ae55538dd92a61877e08cf2e3f62e102afea32151e369a2a83e6611931');
for(const name of['get_native_mixed_playoff_paper_workspace_v1','get_native_mixed_playoff_paper_operation_v1','close_native_mixed_playoff_paper_operation_v1']){const sql=playoffPaperBytes.toString('utf8'),m=new RegExp('create function public\\.'+name+'\\(','i').exec(sql);assert(m);playoffPaperDeclared.set(name,{params:parameterNames(sql,m.index+m[0].length-1),file:playoffPaperFile});}
playoffPaperDeclared.set(playoffWriteName,playoffDeclarations.get(playoffWriteName));
const playoffPaperDeclaration=call=>call.file===playoffPaperCaller?playoffPaperDeclared.get(call.name):undefined;
const resultsCaller='src/lib/results/native-mixed-event-results-read-v1.ts';
const poolFinalFile='database/proposals/native-mixed-pool-results-read-v1.sql',poolFinalBytes=fs.readFileSync(path.join(root,poolFinalFile)),poolFinalName='get_native_mixed_pool_results_v1';
assert.equal(crypto.createHash('sha256').update(poolFinalBytes).digest('hex'),'f2e6fc6c86fafce0686912d33cb8b6bd64d0c9666b02bfe682920119f6783f09','Current pool award reader must match independently reviewed closed source.');
const poolFinalMatch=/create function public\.get_native_mixed_pool_results_v1\(/i.exec(poolFinalBytes.toString('utf8'));assert(poolFinalMatch);
const poolFinalDeclaration={params:parameterNames(poolFinalBytes.toString('utf8'),poolFinalMatch.index+poolFinalMatch[0].length-1),file:poolFinalFile};
const resultsDeclaration=call=>call.file===resultsCaller?(call.name===mixedReviewName?mixedReviewDeclaration:call.name==='get_native_mixed_main_finance_v1'?mainDeclarations.get(call.name):call.name===poolFinalName?poolFinalDeclaration:undefined):undefined;
// Exact application callers may resolve against the hash-pinned actual local
// installed catalog. This is signature metadata, never execution acceptance.
const installedContract=JSON.parse(fs.readFileSync('tests/fixtures/integrated-history/installed-rpc-contract.json','utf8'));
const installedCatalogSha256='114da0d1238e9f0308833547f7c583cdeee69229faea4d2bc72808faea22f436';
assert.equal(crypto.createHash('sha256').update(JSON.stringify(installedContract.catalog)).digest('hex'),installedCatalogSha256);
assert.equal(installedContract.catalogSha256,installedCatalogSha256);
assert.equal(installedContract.baselineSha256,'e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc');
assert.equal(installedContract.closedFinanceSha256,'0d79b616670a910133e8a94c236166dd9129302222570978b89bab761bdf8c97');
const installedScopeBytes=fs.readFileSync('tests/fixtures/integrated-history/scoped-rpc-callers.json');assert.equal(crypto.createHash('sha256').update(installedScopeBytes).digest('hex'),'aee201c3ba463d4c83a8409cc6ab8f3e9c3017a15c81efdbfaf6e707c387ac74');
const installedScope=new Set(JSON.parse(installedScopeBytes).map(row=>row.file+':'+row.name));
function installedDeclaration(call){if(!installedScope.has(call.file+':'+call.name))return undefined;const matches=installedContract.catalog.filter(row=>row.name===call.name&&Array.isArray(row.inputNames)&&(call.args??[]).every(name=>row.inputNames.includes(name)));if(matches.length!==1)return undefined;return{params:new Set(matches[0].inputNames),file:'actual-local-installed-catalog:'+matches[0].definitionSha256};}
// V20 is closed local source validation, not deployed-provider acceptance.
const closeoutCapabilityFile="database/proposals/closeout-capability-rpc-v20.LOCAL-ONLY.sql",closeoutCapabilityCaller='src/lib/finance/closeout-capability-v19.ts';
const closeoutCapabilityBytes=fs.readFileSync(closeoutCapabilityFile);assert.equal(crypto.createHash('sha256').update(closeoutCapabilityBytes).digest('hex'),"04554bdf33168bab5354c2db2e3849f5b03bf216b8f7c462a606073a2b59cea5");
const closeoutCapabilitySql=closeoutCapabilityBytes.toString('utf8'),closeoutCapabilityMatch=/create function public\.get_closeout_capability_v19\(/i.exec(closeoutCapabilitySql);assert(closeoutCapabilityMatch);
const closeoutCapabilityDeclaration=call=>call.file===closeoutCapabilityCaller&&call.name==='get_closeout_capability_v19'?{params:parameterNames(closeoutCapabilitySql,closeoutCapabilityMatch.index+closeoutCapabilityMatch[0].length-1,true),file:closeoutCapabilityFile}:undefined;
assert(closeoutCapabilitySql.includes('from public,anon,authenticated,service_role'));
assert(fs.readFileSync('src/lib/finance/closeout-terminal-handler-v18.ts','utf8').includes('closeoutTerminalReadEnabledV18=()=>false'));

const priorDeclaration=call=>closeoutCapabilityDeclaration(call)??declared.get(call.name)??resultsDeclaration(call)??playoffPaperDeclaration(call)??playoffDeclaration(call)??poolDeclaration(call)??mainDeclaration(call)??mrpManualReviewDeclaration(call)??gameReopenDeclaration(call)??(call.file===mixedReviewCaller&&call.name===mixedReviewName?mixedReviewDeclaration:call.file===proposalStoreCaller?proposalStoreDeclared.get(call.name):call.file===prizeActivationCaller?prizeActivationDeclared.get(call.name):call.file===prizeWorkspaceCaller&&call.name===prizeWorkspaceName?prizeWorkspaceDeclaration:call.file===flowCaller?flowDeclared.get(call.name):call.file===localCaller?localDeclared.get(call.name):call.file===drawCaller?drawDeclared.get(call.name):call.file===reviewedCaller?reviewedDeclared.get(call.name):call.file===mixedRouteCaller&&call.name===mixedRouteName?mixedRouteDeclaration:call.file===paperRouteCaller&&call.name===paperRouteName?paperDeclaration:call.file===pilotCaller&&call.name===pilotName?pilotDeclaration:call.file===leaseCaller&&call.name===leaseName?leaseDeclaration:call.file===prepCaller&&call.name===leaseName?leaseDeclaration:call.file===prepCaller&&call.name===prepName?prepDeclaration:call.file===prepCaller&&call.name===bootstrapName?bootstrapDeclaration:call.file===pilotCaller&&call.name===reserveName?reserveDeclaration:undefined);
const resolveDeclared=call=>priorDeclaration(call)??installedDeclaration(call);


test('mixed Results composition adds only exact existing read calls behind its closed normal-auth branch',()=>{
 const source=fs.readFileSync(resultsCaller,'utf8'),found=calls.filter(c=>c.file===resultsCaller);assert(hasServerOnlyImport(source));assert(source.includes('o.enabled?.()===true'));assert.doesNotMatch(source,/private-admin|createServerOnlyAdminClient|\.from\(|fetch\(|execute_native|save_native|record_native/);
 assert.deepEqual(found.map(c=>c.name).sort(),['get_native_mixed_main_finance_v1','get_native_mixed_pool_results_v1','get_native_mixed_qualification_review_provider_v1','get_tournament_roles_v1']);
 for(const call of found){assert.equal(call.unresolved,null);assert.deepEqual([...new Set(call.args)].sort(),[...resolveDeclared(call).params].sort());}
 assert.equal(resultsDeclaration({file:'src/app/api/v1/ordinary/route.ts',name:mixedReviewName}),undefined);assert.equal(resultsDeclaration({file:resultsCaller,name:'unreviewed_rpc'}),undefined);
 assert.equal(resultsDeclaration({file:'src/app/api/v1/ordinary/route.ts',name:poolFinalName}),undefined);assert(poolFinalBytes.toString('utf8').includes('select false'));assert(poolFinalBytes.toString('utf8').includes('from public,anon,authenticated,service_role'));
});

test('native Paper RPC declarations are confined to four literal normal-auth calls behind closed routes',()=>{
 const source=fs.readFileSync(playoffPaperCaller,'utf8');assert(source.includes('enabled=o.enabled??(()=>false)'));assert.doesNotMatch(source,/private-admin|createServerOnlyAdminClient|fetch\(/);
 const found=calls.filter(c=>c.file===playoffPaperCaller);assert.equal(found.length,4);assert.deepEqual(found.map(c=>c.name).sort(),[...playoffPaperDeclared.keys()].sort());
 for(const call of found){assert.equal(call.unresolved,null);assert.deepEqual([...new Set(call.args)].sort(),[...playoffPaperDeclared.get(call.name).params].sort());assert.equal(playoffPaperDeclaration({file:'src/app/api/v1/ordinary/route.ts',name:call.name}),undefined);}
 assert(playoffPaperBytes.toString('utf8').includes('select false'));assert(playoffPaperBytes.toString('utf8').includes('from public,anon,authenticated,service_role'));
 const model=fs.readFileSync('src/lib/playoffs/native-mixed-playoff-paper-v1.ts','utf8');assertFictionalGateSource(model,'playoffPaperRoutesEnabledV1');
});

test('Main transport has exactly three literal calls behind its default-disabled factory and bounded SQL declarations',()=>{
 const source=fs.readFileSync(path.join(root,mainTransportCaller),'utf8'),tree=ts.createSourceFile(mainTransportCaller,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),names=[];
 const visit=n=>{if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='rpc'){assert(ts.isStringLiteral(n.arguments[0]),'Main RPC names must stay literal');names.push(n.arguments[0].text);}ts.forEachChild(n,visit);};visit(tree);
 assert.deepEqual(names.sort(),[...mainDeclarations.keys()].sort());assert(source.includes('enabled=o.enabled??(()=>false)'));assert.doesNotMatch(source,/private-admin|createServerOnlyAdminClient/);
 for(const name of mainDeclarations.keys())assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name}),undefined);
});
test('pool transport has exactly four literal calls behind its default-disabled factory and bounded SQL declarations',()=>{
 const source=fs.readFileSync(path.join(root,poolTransportCaller),'utf8'),tree=ts.createSourceFile(poolTransportCaller,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),names=[];
 const visit=n=>{if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='rpc'){assert(ts.isStringLiteral(n.arguments[0]),'Pool RPC names must stay literal');names.push(n.arguments[0].text);}ts.forEachChild(n,visit);};visit(tree);
 assert.deepEqual(names.sort(),[...poolDeclarations.keys()].sort());
 assert(source.includes('enabled=o.enabled??(()=>false)'));assert.doesNotMatch(source,/private-admin|createServerOnlyAdminClient/);
 const generator=playoffTransportBytes.toString('utf8');for(const pair of["('get_native_mixed_pool_finance_v1',false)","('execute_native_mixed_pool_finance_v1',true)","declaration:='p_tournament_id uuid,p_event_id uuid'","declaration:=declaration||',p_operation_id uuid,p_request jsonb'"])assert(generator.includes(pair));
 assert(generator.includes('revoke all on function %s from public,anon,authenticated,service_role'));
 assert(poolOperationBytes.toString('utf8').includes('select false'));assert(poolOperationBytes.toString('utf8').includes('from public,anon,authenticated,service_role'));
 for(const name of poolDeclarations.keys()){assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name}),undefined);assert.equal(poolDeclaration({file:poolTransportCaller,name:'unreviewed_rpc'}),undefined);}
 assert(poolPreparationBytes.toString('utf8').includes('select false'));assert(poolPreparationBytes.toString('utf8').includes('from public,anon,authenticated,service_role'));
 const found=calls.filter(c=>c.file===poolTransportCaller);assert.equal(found.length,4);for(const c of found){assert.equal(c.unresolved,null);assert.deepEqual([...new Set(c.args)].sort(),[...poolDeclarations.get(c.name).params].sort());}
});

test('native playoff wrappers resolve only for the closed own-player transport and route',()=>{
 const sql=playoffTransportBytes.toString('utf8');
 assert(sql.includes("('get_native_mixed_playoff_own_v1',false)"));assert(sql.includes("('execute_native_mixed_playoff_v1',true)"));
 assert(sql.includes("declaration:='p_tournament_id uuid,p_event_id uuid'"));assert(sql.includes("declaration:=declaration||',p_operation_id uuid,p_request jsonb'"));
 assert(sql.includes("revoke all on function %s from public,anon,authenticated,service_role"));
 assert.equal(playoffDeclaration({file:playoffRouteCaller,name:playoffWriteName}),undefined);
 for(const name of playoffDeclarations.keys())assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name}),undefined);
 const transport=fs.readFileSync(path.join(root,playoffTransportCaller),'utf8'),route=fs.readFileSync(path.join(root,playoffRouteCaller),'utf8');
 assert(transport.includes('enabled=o.enabled??(()=>false)'));assertFictionalGateSource(route,'nativeMixedPlayoffOwnRouteEnabledV1');
 assert.doesNotMatch(transport+route,/private-admin|createServerOnlyAdminClient/);
});

test('read-only mixed review resolver resolves only for the target-bound server-only handler',()=>{
 assert.equal(declared.has(mixedReviewName),false,'Unapplied candidate must not be represented as a migration.');
 assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name:mixedReviewName}),undefined);
 assert.equal(resolveDeclared({file:mixedReviewCaller,name:'unreviewed_proposal_rpc'}),undefined);
 const source=fs.readFileSync(path.join(root,mixedReviewCaller),'utf8'),tree=ts.createSourceFile(mixedReviewCaller,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 assert(tree.statements.some(n=>ts.isImportDeclaration(n)&&n.moduleSpecifier.text==='server-only'));
 let gate;const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(tree)==='nativeMixedReviewReadEnabledV1')gate=n;ts.forEachChild(n,visit);};visit(tree);
 assert(gate&&ts.isArrowFunction(gate.initializer));assertFictionalGateSource(source,gate.name.getText(tree));
 assert.match(source,/d\.enabled\?\?nativeMixedReviewReadEnabledV1/);assert.match(source,/if\(enabled\(\)!==true\)return fail\(404,'not_found'\)/);
 assert(source.indexOf('if(enabled()!==true)')<source.indexOf('await d.client()'));
 assert.doesNotMatch(source,/private-admin|service_role|createServerOnlyAdminClient/);
 assert.match(mixedReviewBytes.toString('utf8'),/revoke all on function public\.get_native_mixed_qualification_review_provider_v1\(uuid,uuid\)\s+from public,anon,authenticated,service_role/);
 const getter=fs.readFileSync(path.join(root,'database/proposals/native-mixed-qualification-review-v1.sql'),'utf8');
 assert.match(getter,/create function app\.native_mixed_qualification_review_enabled_v1\(\)returns boolean\s+language sql immutable set search_path=''as \$\$select false\$\$/);
 assert.match(getter,/revoke all on function[\s\S]*from public,anon,authenticated,service_role/);
 assert.deepEqual([...mixedReviewDeclaration.params].sort(),['p_event_id','p_tournament_id']);
 const captures=calls.filter(c=>c.file===mixedReviewCaller&&c.name===mixedReviewName);assert.equal(captures.length,2);
 for(const call of captures)assert.deepEqual([...call.args].sort(),['p_event_id','p_tournament_id']);
});

test('private mixed metadata declaration is exact and test-target bound',()=>{
 assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name:mixedRouteName}),undefined);
 const source=fs.readFileSync(path.join(root,mixedRouteCaller),'utf8'),tree=ts.createSourceFile(mixedRouteCaller,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 let gate;const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(tree)==='nativeMixedPlayerRouteEnabledV1')gate=n;ts.forEachChild(n,visit);};visit(tree);assert(gate&&ts.isArrowFunction(gate.initializer));assertFictionalGateSource(source,gate.name.getText(tree));
 assert.doesNotMatch(source,/private-admin|service_role/);assert.match(mixedRouteBytes.toString('utf8'),/revoke all on function[\s\S]*from public,anon,authenticated,service_role/i);
});

test('seating wrappers retain the closed legacy gate or explicit isolated fictional boundary',()=>{
 assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name:'publish_reviewed_initial_seating_v1'}),undefined);
 assert.equal(resolveDeclared({file:reviewedCaller,name:'unreviewed_rpc'}),undefined);
 const gateFile='src/lib/seating/reviewed-draw-publication-result.ts',gateTree=ts.createSourceFile(gateFile,fs.readFileSync(path.join(root,gateFile),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const gate=gateTree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='reviewedDrawNativePublicationEnabled');assert.ok(gate);assert.equal(gate.body.statements.length,1);assert.ok(ts.isReturnStatement(gate.body.statements[0]));assert.equal(gate.body.statements[0].expression.kind,ts.SyntaxKind.FalseKeyword);
 const source=fs.readFileSync(path.join(root,reviewedCaller),'utf8'),prod=ts.createSourceFile(reviewedCaller,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);assert.doesNotMatch(source,/createServerOnlyAdminClient/);
 const factory=prod.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='createReviewedNativeProductionHandlers');assert.ok(factory);assert.equal(factory.body.statements.length,1);const ret=factory.body.statements[0];assert.ok(ts.isReturnStatement(ret)&&ts.isCallExpression(ret.expression));assert.equal(ret.expression.expression.getText(prod),'createReviewedNativeHandlers');const config=ret.expression.arguments[0];assert.ok(ts.isObjectLiteralExpression(config));assert(!config.properties.some(ts.isSpreadAssignment));const enabled=config.properties.filter(n=>ts.isPropertyAssignment(n)&&n.name.getText(prod)==='enabled');assert.equal(enabled.length,1);assert.ok(ts.isArrowFunction(enabled[0].initializer));assert.equal(enabled[0].initializer.body.getText(prod),'reviewedDrawNativePublicationEnabled() || fictionalDrawBoundaryEnabled()');const boundary=fs.readFileSync(path.join(root,'src/lib/api/fictional-draw-enabled.ts'),'utf8');assert.match(boundary,/return integratedTestUiEnabled\(\) && process\.env\.CRIBBAGE_FICTIONAL_DRAW_BOUNDARY === \"1\" && integratedTestBackendRef\(\) === \"nnhcnvksxgxnpvdqjgpg\"/);
 const gateImport=prod.statements.find(n=>ts.isImportDeclaration(n)&&n.moduleSpecifier.text==='../seating/reviewed-draw-publication-result');assert.ok(gateImport?.importClause?.namedBindings&&ts.isNamedImports(gateImport.importClause.namedBindings));assert(gateImport.importClause.namedBindings.elements.some(n=>n.name.text==='reviewedDrawNativePublicationEnabled'&&!n.propertyName));
 for(const name of['access','workspace','publish','operation','readJson']){const property=config.properties.find(n=>ts.isPropertyAssignment(n)&&n.name.getText(prod)===name);assert.ok(property&&ts.isArrowFunction(property.initializer),`${name} client construction must remain deferred`);}
 const handlerFile='src/lib/api/reviewed-native-seating-handlers.ts',tree=ts.createSourceFile(handlerFile,fs.readFileSync(path.join(root,handlerFile),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let enter;const visit=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==='enter')enter=n;ts.forEachChild(n,visit)};visit(tree);assert.ok(enter);const text=enter.getText(tree);assert(text.indexOf('d.enabled()')<text.indexOf('d.access('));assert(text.indexOf('rosterDrawEnabled')<text.indexOf('d.access('));
});

test('roster draw proposal exception is bounded to default-off loopback backend factory',()=>{assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name:'draw_random_seating_candidate_v1'}),undefined);const source=fs.readFileSync(path.join(root,drawCaller),'utf8');const tree=ts.createSourceFile(drawCaller,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let entry;const visit=node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text==='enter')entry=node;ts.forEachChild(node,visit)};visit(tree);assert.ok(entry);const text=entry.getText(tree);assert(text.indexOf('rosterDrawEnabled(d.env)')<text.indexOf('d.identity()'));assert.match(text,/isLoopbackPlannerUrl/);assert.match(source,/NEXT_PUBLIC_SUPABASE_URL===`http:/);});

test('local proposal resolution is restricted to the real default-off gated factory',()=>{
 assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name:'attest_synthetic_mixed_hybrid_v1'}),undefined);
 assert.equal(resolveDeclared({file:localCaller,name:'unreviewed_proposal_rpc'}),undefined);
 const source=fs.readFileSync(path.join(root,localCaller),'utf8'),tree=ts.createSourceFile(localCaller,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let enter;
 const find=node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text==='enter')enter=node;ts.forEachChild(node,find);};find(tree);assert.ok(enter);
 const first=enter.body.statements[0];assert.ok(ts.isIfStatement(first));assert.equal(first.expression.getText(tree),'!isSyntheticMixedLocalDeployment(d.env)');assert.ok(ts.isReturnStatement(first.thenStatement));
 const order=[];const visit=node=>{if(ts.isCallExpression(node))order.push(node.expression.getText(tree));ts.forEachChild(node,visit);};visit(enter);
 assert.ok(order.indexOf('isSyntheticMixedLocalDeployment')<order.indexOf('d.getIdentity'));assert.ok(order.indexOf('isSyntheticMixedLocalDeployment')<order.indexOf('d.adminRpc'));
 const own=calls.find(c=>c.file===localCaller&&c.name==='get_own_synthetic_mixed_hybrid_v1');assert.deepEqual([...own.args].sort(),['eid','gid','tid']);
 assert.deepEqual([...localDeclared.get(own.name).params].sort(),['eid','gid','tid']);
});

test('private prize proposals resolve only in the bound production composition',()=>{
 for(const name of proposalStoreDeclared.keys())assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name}),undefined);
 const journalHandler=fs.readFileSync(path.join(root,proposalStoreCaller),'utf8'),journalProduction=fs.readFileSync(path.join(root,'src/lib/api/playoff-prize-proposal-production-v2.ts'),'utf8');
 assertFictionalGateSource(journalHandler,'playoffPrizeProposalProviderEnabledV2');assert.match(journalProduction,/enabled:playoffPrizeProposalProviderEnabledV2,readEnabled:\(\)=>false,writeEnabled:\(\)=>false,recoveryEnabled:\(\)=>false/);assert.doesNotMatch(journalProduction,/private-admin|service_role/);
 for(const [name,definition]of proposalStoreDeclared){assert(definition.params.has('p_tid')&&definition.params.has('p_eid'),name);if(!name.includes('workspace'))assert(definition.params.has('p_request_text'),name);}
 for(const name of prizeActivationDeclared.keys())assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name}),undefined);
 assert.equal(resolveDeclared({file:prizeActivationCaller,name:'unreviewed_rpc'}),undefined);
 const handler=fs.readFileSync(path.join(root,prizeActivationCaller),'utf8'),production=fs.readFileSync(path.join(root,'src/lib/api/event-prize-activation-production-v1.ts'),'utf8');
 assertFictionalGateSource(handler,'eventPrizeActivationRoutesEnabledV1');
 assert.match(production,/enabled:eventPrizeSetupEnabledV1,readEnabled:eventPrizeSetupEnabledV1,writeEnabled:eventPrizeSetupEnabledV1,recoveryEnabled:eventPrizeSetupEnabledV1/); const gate=fs.readFileSync(path.join(root,'src/lib/api/event-prize-setup-test-project-v1.ts'),'utf8');assert.match(gate,/EVENT_PRIZE_SETUP_TEST_PROJECT_ENABLED_V1/);assert.match(gate,/eventPrizeSetupTestProjectUrlV1=integratedTestBackendOrigin\(\)/);
 for(const [name,declaration]of prizeActivationDeclared){assert(declaration.params.has('tid'),name);if(name.includes('context')&&!name.includes('source'))assert(declaration.params.has('request_value'),name);else if(!name.includes('source'))assert(declaration.params.has('request_text'),name);}
});

test('the migration scan and the call-site scan both found work to check', () => {
  // Without this, a broken regex would make every assertion below vacuously true.
  assert.ok(declared.size > 150, `expected the migrations to declare many functions, found ${declared.size}`);
  assert.ok(calls.length > 150, `expected many .rpc() call sites, found ${calls.length}`);
  assert.ok(calls.some((c) => c.args.length > 0), 'expected at least one call site with named arguments');
});

test('no .rpc() call site is silently skipped by the parser', () => {
  // A call site the parser cannot read contributes zero arguments, which makes
  // the mismatch check below pass vacuously for that file. Fail loudly instead:
  // silence and a clean bill of health must not look the same.
  const unreadable = calls.filter((c) => c.unresolved)
    .map((c) => `${c.file}:${c.line} ${c.name} - ${c.unresolved}`);
  assert.deepEqual(unreadable, [], `these .rpc() call sites could not be parsed:\n${unreadable.join('\n')}`);

  // Spread arguments are the specific shape that used to be invisible here:
  // .rpc(name, common) and .rpc(name, { ...common, extra }) both reported no
  // arguments at all, so schedule-amendments was entirely unchecked.
  const spreadCallers = calls.filter((c) => c.file.includes('schedule-amendments'));
  assert.ok(spreadCallers.length >= 2, 'expected the schedule-amendment call sites to be found');
  for (const call of spreadCallers) {
    assert.ok(call.args.includes('p_tournament_id'),
      `${call.file}:${call.line} ${call.name} should have resolved its spread arguments, got [${call.args.join(', ')}]`);
  }
});

test('every .rpc() call targets a migration or an exact bounded local-only declaration', () => {
  const missing = calls.filter((c) => !resolveDeclared(c)).map((c) => `${c.file}:${c.line} ${c.name}`);
  assert.deepEqual(missing, [], `these RPCs are called but never defined:\n${missing.join('\n')}`);
});

test('every .rpc() argument name is declared by the function it targets', () => {
  const mismatches = [];
  for (const call of calls) {
    const target = resolveDeclared(call);
    if (!target) continue;
    const unknown = call.args.filter((arg) => !target.params.has(arg));
    if (unknown.length) {
      mismatches.push(
        `${call.file}:${call.line} calls ${call.name} with ${unknown.join(', ')} ` +
        `but ${target.file} declares only ${[...target.params].sort().join(', ')}`,
      );
    }
  }
  // PostgREST answers an unknown argument name with PGRST202, which every route
  // in this codebase reports as 503. A mismatch here is a live outage, not a nit.
  assert.deepEqual(mismatches, [], `RPC argument names disagree with their migrations:\n${mismatches.join('\n')}`);
});

test('private pilot dispatcher declaration is restricted to the disabled server executor',()=>{assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name:pilotName}),undefined);const source=fs.readFileSync(path.join(root,pilotCaller),'utf8');assert.match(source,/import 'server-only'/);assertFictionalGateSource(source,'nativeMixedPilotDirectorExecutorEnabledV1');assert.match(source,/enabled\(\)!==true/);assert.match(pilotBytes.toString('utf8'),/revoke all on function %s from public,anon,authenticated,service_role/);});

test('Director lease proposal resolves only in disabled server handler',()=>{assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name:leaseName}),undefined);const source=fs.readFileSync(path.join(root,leaseCaller),'utf8');assertFictionalGateSource(source,'nativeMixedPilotDirectorHandlersEnabledV1');assert.match(leaseBytes.toString('utf8'),/revoke all on function[\s\S]*from public,anon,authenticated,service_role/);});

test('preparation candidate RPC is bounded to the disabled server-only handler',()=>{assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name:prepName}),undefined);const source=fs.readFileSync(path.join(root,prepCaller),'utf8');assert.match(source,/import 'server-only'/);assertFictionalGateSource(source,'nativeMixedPreparationApiEnabledV1');assert.match(prepBytes.toString('utf8'),/revoke all on function[\s\S]*from public,anon,authenticated,service_role/);});

test('bootstrap RPC declarations stay server-only and own consent has no actor override',()=>{
 assert.equal(resolveDeclared({file:'src/components/unsafe.tsx',name:'execute_native_mixed_bootstrap_v1'}),undefined);
 for(const name of ['get_native_mixed_own_consent_offer_v1','execute_native_mixed_own_consent_v1'])assert([...flowDeclared.get(name).params].every(p=>!p.includes('actor')));
});


test('manual membership RPCs resolve only for the exact default-off normal-user boundary',()=>{
 const source=fs.readFileSync(path.join(root,mrpManualReviewCaller),'utf8'),tree=ts.createSourceFile(mrpManualReviewCaller,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),names=[];
 const visit=n=>{if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='rpc'){assert(ts.isStringLiteral(n.arguments[0]),'Manual membership RPC names must stay literal');names.push(n.arguments[0].text);}ts.forEachChild(n,visit);};visit(tree);
 assert.deepEqual(names.sort(),[...mrpManualReviewDeclarations.keys()].sort());
 assert(hasServerOnlyImport(source));assertFictionalGateSource(source,'mrpMembershipManualReviewRoutesEnabledV1');assert(source.includes('enabled=o.enabled??mrpMembershipManualReviewRoutesEnabledV1'));
 assert.doesNotMatch(source,/private-admin|createServerOnlyAdminClient|createClient\(|fetch\(|randomUUID/);
 for(const name of mrpManualReviewDeclarations.keys())assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name}),undefined);
 assert.equal(mrpManualReviewDeclaration({file:mrpManualReviewCaller,name:'unreviewed_rpc'}),undefined);
 const found=calls.filter(c=>c.file===mrpManualReviewCaller);assert.equal(found.length,3);for(const call of found){assert.equal(call.unresolved,null);assert.deepEqual([...new Set(call.args)].sort(),[...mrpManualReviewDeclarations.get(call.name).params].sort());}
 const sql=mrpManualReviewBytes.toString('utf8');assert(sql.includes('select false'));assert(sql.includes('from public,anon,authenticated,service_role'));assert.doesNotMatch(sql,/^\s*grant\b/im);
});

test('native game reopen RPCs resolve only from the disabled normal-user boundary',()=>{const source=fs.readFileSync(path.join(root,gameReopenCaller),'utf8');assert(hasServerOnlyImport(source));assertFictionalGateSource(source,'nativeMixedGameReopenRoutesEnabledV1');assert.doesNotMatch(source,/private-admin|createServerOnlyAdminClient|createClient\(|fetch\(|randomUUID/);const found=calls.filter(c=>c.file===gameReopenCaller);assert.equal(found.length,3);for(const call of found){assert.equal(call.unresolved,null);assert.deepEqual([...new Set(call.args)].sort(),[...gameReopenDeclared.get(call.name).params].sort());assert.equal(resolveDeclared({file:'src/app/api/v1/ordinary/route.ts',name:call.name}),undefined);}assert.equal(gameReopenDeclaration({file:gameReopenCaller,name:'unreviewed_rpc'}),undefined);assert(gameReopenBytes.toString('utf8').includes('select false'));});

test('installed catalog fallback is exact-caller scoped and never supplies invented RPC names',()=>{for(const row of JSON.parse(installedScopeBytes)){assert.equal(installedDeclaration({file:'src/app/api/v1/ordinary/route.ts',name:row.name,args:[]}),undefined);assert.equal(installedDeclaration({file:row.file,name:'invented_rpc_name',args:[]}),undefined);}const row=JSON.parse(installedScopeBytes).find(row=>installedContract.catalog.some(c=>c.name===row.name));assert(installedDeclaration({...row,args:[]}));assert.equal(installedDeclaration({...row,args:['invented_argument']}),undefined);});

test('RPC argument inventory reads actual property keys without inventing value identifiers',()=>{
 const source='const args={tid: scope.id, request: body, p_actor_id: actorId, operation};';
 assert.deepEqual(readObjectLiteral(source,source.indexOf('{'),true),{names:['tid','request','p_actor_id','operation'],spreads:[],unsupported:null});
 const computed='const args={[unresolvedName]: value};';assert.equal(readObjectLiteral(computed,computed.indexOf('{'),true).unsupported,'computed RPC argument key');
});
test('RPC argument aliases resolve comma declarations within their own lexical scope',()=>{
 const source='function first(){const other={},args={p_first:1};rpc("first",args);}function second(){const args={tid:2};rpc("second",args);}';
 assert.deepEqual(resolveLocalObject(source,'args',true,source.indexOf('rpc("first"')).names,['p_first']);
 assert.deepEqual(resolveLocalObject(source,'args',true,source.indexOf('rpc("second"')).names,['tid']);
});
