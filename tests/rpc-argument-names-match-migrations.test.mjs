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
  const pattern = allNames ? /(?:^|,)\s*([a-z_][a-z0-9_]*)\s+(?:uuid|jsonb|integer|text|boolean)\b/gi : /\b(p_[a-z0-9_]+)\b/gi;
  return new Set([...sql.slice(openIndex + 1, end).matchAll(pattern)].map((m) => m[1].toLowerCase()));
}

// Replay the migrations in order. `create [or replace] function` defines a name;
// `alter function ... rename to` moves that definition to a different name, which
// is how superseded versions are retired here.
function declaredFunctions() {
  const declared = new Map();
  const preparation='database/release-packages/native-preparation51/supabase/migrations/20261107090229_native_preparation51_closed_install.sql';
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,preparation))).digest('hex'),'22f9145694802d79d13d50ab36d52e8dc030b1f86649b9cb8a5f2fe733187f58');
  const review='database/release-packages/native-mixed-qualifying-review/supabase/migrations/20261108111139_native_mixed_qualifying_review_closed_install.sql';
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,review))).digest('hex'),'1952a5c212e82eee126cdc7c9529b89833acc45a6bf1af2ed408f45cf4786c91');
  const play='database/release-packages/native-play/supabase/migrations/20261108201030_native_play_closed_install.sql';
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,play))).digest('hex'),'c0d63d7f9f33dd545861631def4f003818377884461d4b7df59ef33ee3408777');
  for (const file of [...walk('database/migrations', (name) => name.endsWith('.sql')),preparation,review,play].sort()) {
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
        declared.set(event.name, { params: parameterNames(sql, event.open), file });
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
function readObjectLiteral(source, open) {
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  const body = source.slice(open + 1, end);
  const names = [];
  const spreads = [];
  let level = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '{' || ch === '[' || ch === '(') level += 1;
    else if (ch === '}' || ch === ']' || ch === ')') level -= 1;
    if (level !== 0) continue;
    const rest = body.slice(i);
    const key = /^(p_[a-z0-9_]+)\s*:/i.exec(rest);
    if (key && (i === 0 || /[\s,{]/.test(body[i - 1]))) { names.push(key[1].toLowerCase()); continue; }
    const spread = /^\.\.\.\s*([A-Za-z_$][\w$]*)/.exec(rest);
    if (spread) spreads.push(spread[1]);
  }
  return { names, spreads };
}

// Resolve `const <name> = { ... }` declared in the same file.
function resolveLocalObject(source, identifier) {
  const declaration = new RegExp(`const\\s+${identifier}\\s*(?::[^=]*)?=\\s*\\{`).exec(source);
  if (!declaration) return null;
  return readObjectLiteral(source, declaration.index + declaration[0].length - 1);
}

function callSites() {
  const calls = [];
  for (const file of walk('src', (name) => name.endsWith('.ts') || name.endsWith('.tsx'))) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
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
          const resolved = resolveLocalObject(source, identifier);
          if (!resolved) { call.unresolved = `cannot resolve spread ...${identifier}`; continue; }
          collect(resolved, depth + 1);
        }
      };

      if (first === '{') {
        collect(readObjectLiteral(source, after + lead), 0);
      } else {
        const identifier = /^([A-Za-z_$][\w$]*)\s*[),]/.exec(rest.slice(lead));
        if (!identifier) call.unresolved = 'second argument is neither an object literal nor a plain identifier';
        else {
          const resolved = resolveLocalObject(source, identifier[1]);
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

// Published declarations above remain authoritative. These additional source-only
// contracts resolve only for the exact new callers below, never proposal-wide.
const bounded = new Map();
function pinnedSQL(file, hash) {
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), hash, file);
  return bytes.toString('utf8');
}
function literalDeclarations(file, hash, names) {
  const sql = pinnedSQL(file, hash), definitions = new Map();
  for (const name of names) {
    const match = new RegExp('create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.' + name + '\\s*\\(', 'i').exec(sql);
    assert.ok(match, file + ' must declare ' + name);
    definitions.set(name, { params: parameterNames(sql, match.index + match[0].length - 1, true), file });
  }
  return { sql, definitions };
}
const bridgeFile = 'database/proposals/native-mixed-playoff-finance-transport-v1.sql';
const bridgeSQL = pinnedSQL(bridgeFile, 'dd4fa8d4ab5fc35d9ccbad13d90ced232b9dfc11972a8942f35a28295ec38c7e');
const bridgeDeclaration = (name, writing) => {
  assert.ok(bridgeSQL.includes("('" + name + "'," + writing + ')'));
  return { params: new Set(['p_tournament_id', 'p_event_id', ...(writing ? ['p_operation_id', 'p_request'] : [])]), file: bridgeFile };
};
const mainCaller = 'src/lib/api/native-mixed-main-transport-v1.ts';
const mainOperation = literalDeclarations('database/proposals/native-mixed-main-operation-read-v1.sql', '1919691ae0206b170cf3c7c936bb02f927d923b42e223fa24f14c7d5a2e09333', ['get_native_mixed_main_operation_v1']);
const mainDefinitions = new Map([
  ['get_native_mixed_main_finance_v1', bridgeDeclaration('get_native_mixed_main_finance_v1', false)],
  ['execute_native_mixed_main_finance_v1', bridgeDeclaration('execute_native_mixed_main_finance_v1', true)],
  ...mainOperation.definitions,
]);
bounded.set(mainCaller, mainDefinitions);
const poolCaller = 'src/lib/api/native-mixed-pool-transport-v1.ts';
const poolOperation = literalDeclarations('database/proposals/native-mixed-pool-operation-read-v1.sql', 'f1abdbe0ced37ca57f98853510f9f3c535ff76e99afe379aff3975d83dfc19c9', ['get_native_mixed_pool_operation_v1']);
const poolPreparation = literalDeclarations('database/proposals/native-mixed-pool-preparation-read-v1.sql', '5e2e62723af0e1d463047083bbbbacc018bdc9cb324b7f3633c6b62e27e11bf7', ['get_native_mixed_pool_preparation_v1']);
const poolDefinitions = new Map([
  ['get_native_mixed_pool_finance_v1', bridgeDeclaration('get_native_mixed_pool_finance_v1', false)],
  ['execute_native_mixed_pool_finance_v1', bridgeDeclaration('execute_native_mixed_pool_finance_v1', true)],
  ...poolOperation.definitions, ...poolPreparation.definitions,
]);
bounded.set(poolCaller, poolDefinitions);
const playoffCaller = 'src/lib/api/native-mixed-playoff-own-transport-v1.ts';
const playoffRoute = 'src/lib/playoffs/native-mixed-playoff-own-route-v1.ts';
const playoffDefinitions = new Map([
  ['get_native_mixed_playoff_own_v1', bridgeDeclaration('get_native_mixed_playoff_own_v1', false)],
  ['execute_native_mixed_playoff_v1', bridgeDeclaration('execute_native_mixed_playoff_v1', true)],
]);
bounded.set(playoffCaller, playoffDefinitions);
bounded.set(playoffRoute, new Map([['get_native_mixed_playoff_own_v1', playoffDefinitions.get('get_native_mixed_playoff_own_v1')]]));
const setupCaller = 'src/lib/api/event-prize-rpc-v1.ts';
const workspace = literalDeclarations('database/proposals/event-prize-workspace-source-v1.sql', 'b079d2ba8ff8479ef487f4e1a975c97b6eb4070b5529e837b1b1468b84b2987c', ['get_event_prize_workspace_provider_v1']);
const transaction = literalDeclarations('database/proposals/event-prize-transaction-source-v1.sql', '0634eb8f7f147c1bfbc2f46fcacf69e612d6e629463cb4d49be7e7833586adfc', ['save_event_prize_settings_provider_v1', 'get_event_prize_operation_provider_v1']);
bounded.set(setupCaller, new Map([...workspace.definitions, ...transaction.definitions]));
const activationCaller = 'src/lib/api/event-prize-activation-handlers-v1.ts';
const activation = literalDeclarations('database/proposals/event-prize-activation-source-v1.sql', 'c1d414088b13fb35e6e962b626c5ae67b38ba2517cac69c4d3ce2129f59d8573', ['get_event_prize_activation_source_provider_v1', 'prepare_event_prize_activation_provider_v1', 'finalize_event_prize_activation_provider_v1', 'get_event_prize_activation_operation_provider_v1']);
const context = literalDeclarations('database/proposals/event-prize-rule-context-source-v1.sql', '33b0fc2914752d92aac17b874f7ddf22fb929b96393552671156a40304ff6495', ['get_event_prize_rule_context_source_provider_v1', 'save_event_prize_rule_context_provider_v1', 'get_event_prize_rule_context_operation_provider_v1']);
bounded.set(activationCaller, new Map([...activation.definitions, ...context.definitions]));
const resolveDeclared = call => declared.get(call.name) ?? bounded.get(call.file)?.get(call.name);

// The added Setup RPCs use non-p_ keys and two explicit ternary name pairs.
// Check their full AST argument keys as well as every literal global call above.
function exactCalls(file, allowConditional = false) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), result = [];
  const names = node => {
    assert.ok(node, file + ': missing RPC name');
    if (ts.isStringLiteral(node)) return [node.text];
    assert.ok(allowConditional && ts.isConditionalExpression(node), file + ': RPC name must be literal or an explicit Setup conditional');
    return [...names(node.whenTrue), ...names(node.whenFalse)];
  };
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'rpc') {
      assert.equal(node.arguments.length, 2, file + ': expected one argument object');
      let args = node.arguments[1];
      if (ts.isIdentifier(args)) {
        const identifier = args.text, declarations = [];
        const find = candidate => {
          if (ts.isVariableDeclaration(candidate) && ts.isIdentifier(candidate.name) && candidate.name.text === identifier) declarations.push(candidate);
          ts.forEachChild(candidate, find);
        };
        find(tree);
        assert.equal(declarations.length, 1, file + ': argument identifier must resolve uniquely');
        assert.ok(declarations[0].parent.flags & ts.NodeFlags.Const, file + ': argument object must be const');
        args = declarations[0].initializer;
      }
      assert.ok(ts.isObjectLiteralExpression(args), file + ': RPC arguments must be a direct object');
      const keys = args.properties.map(property => {
        assert.ok(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property), file + ': unreviewed argument spread');
        assert.ok(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name), file + ': computed argument key');
        return property.name.text;
      });
      assert.equal(new Set(keys).size, keys.length, file + ': duplicate argument key');
      for (const name of names(node.arguments[0])) result.push({ file, name, args: keys });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return { source, calls: result };
}
function assertExactContracts(file, definitions, allowConditional = false, publishedNames = []) {
  const found = exactCalls(file, allowConditional);
  assert.deepEqual(found.calls.map(call => call.name).sort(), [...definitions.keys(), ...publishedNames].sort(), file);
  for (const call of found.calls) {
    const target = resolveDeclared(call);
    assert.ok(target, file + ': unresolved ' + call.name);
    assert.deepEqual([...call.args].sort(), [...target.params].sort(), file + ': ' + call.name);
  }
  return found.source;
}

test('new Main and Pool transports retain exact literal calls and default-disabled factories', () => {
  for (const [file, definitions] of [[mainCaller, mainDefinitions], [poolCaller, poolDefinitions]]) {
    const source = assertExactContracts(file, definitions);
    assert.ok(source.includes('enabled=o.enabled??(()=>false)'));
    assert.doesNotMatch(source, /private-admin|createServerOnlyAdminClient/);
  }
  for (const contract of [mainOperation, poolOperation, poolPreparation]) {
    assert.ok(contract.sql.includes('select false'));
    assert.ok(contract.sql.includes('from public,anon,authenticated,service_role'));
  }
});

test('own-playoff wrappers remain confined to the default-disabled transport and read-only route', () => {
  const transport = assertExactContracts(playoffCaller, playoffDefinitions);
  const route = assertExactContracts(playoffRoute, bounded.get(playoffRoute));
  assert.ok(transport.includes('enabled=o.enabled??(()=>false)'));
  assert.ok(route.includes('nativeMixedPlayoffOwnRouteEnabledV1=()=>false'));
  assert.doesNotMatch(transport + route, /private-admin|createServerOnlyAdminClient/);
  assert.equal(resolveDeclared({ file: playoffRoute, name: 'execute_native_mixed_playoff_v1' }), undefined);
  for (const anchor of ["declaration:='p_tournament_id uuid,p_event_id uuid'", "declaration:=declaration||',p_operation_id uuid,p_request jsonb'", 'revoke all on function %s from public,anon,authenticated,service_role']) assert.ok(bridgeSQL.includes(anchor));
});

test('latest Setup contracts include exact save/recovery and activation/context argument names', () => {
  assertExactContracts(setupCaller, bounded.get(setupCaller), true);
  const handler = assertExactContracts(activationCaller, bounded.get(activationCaller), true, ['get_tournament_role']);
  const production = fs.readFileSync(path.join(root, 'src/lib/api/event-prize-activation-production-v1.ts'), 'utf8');
  const provider = fs.readFileSync(path.join(root, 'src/lib/api/event-prize-provider-v1.ts'), 'utf8');
  const genericProvider = fs.readFileSync(path.join(root, 'src/lib/api/event-prize-provider-handlers-v1.ts'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'src/app/tournament/[tournamentId]/setup/page.tsx'), 'utf8');
  const gate = pinnedSQL('src/lib/api/event-prize-setup-test-project-v1.ts', '8fdf7e548a3ad3e24e490314de29f740a64f27b672abd42da56d9c17f9190bd7');
  assert.match(handler, /eventPrizeActivationRoutesEnabledV1=\(\)=>false/);
  assert.match(genericProvider, /eventPrizeProviderEnabledV1=\(\)=>false/);
  assert.ok(gate.startsWith("import 'server-only'"));
  assert.ok(gate.includes("eventPrizeSetupTestProjectUrlV1='https://nnhcnvksxgxnpvdqjgpg.supabase.co'"));
  assert.ok(gate.includes("env.EVENT_PRIZE_SETUP_TEST_PROJECT_ENABLED_V1==='true'"));
  assert.ok(gate.includes('env.NEXT_PUBLIC_SUPABASE_URL===eventPrizeSetupTestProjectUrlV1'));
  assert.ok(provider.includes('eventPrizeProviderEnabledV1=eventPrizeSetupTestProjectEnabledV1'));
  for (const key of ['enabled', 'readEnabled', 'writeEnabled', 'recoveryEnabled']) {
    assert.ok(provider.includes(key + ':eventPrizeProviderEnabledV1'));
    assert.ok(production.includes(key + ':eventPrizeSetupTestProjectEnabledV1'));
  }
  for (const composition of [provider, production]) {
    assert.ok(composition.startsWith("import 'server-only'"));
    assert.ok(composition.includes("import {eventPrizeSetupTestProjectEnabledV1,eventPrizeSetupTestProjectUrlV1} from './event-prize-setup-test-project-v1.ts'"));
    assert.ok(composition.includes("client:async()=>(await import('../supabase/server.ts')).createClient(eventPrizeSetupTestProjectUrlV1)"));
  }
  assert.doesNotMatch(provider, /private-admin|createServerOnlyAdminClient/);
  assert.ok(production.includes('admin:()=>{if(!eventPrizeSetupTestProjectEnabledV1())throw'));
  assert.ok(production.includes('return createServerOnlyAdminClient()'));
  assert.ok(page.includes('eventPrizeSettingsV1Enabled={eventPrizeSetupTestProjectEnabledV1()}'));
  assert.ok(page.includes('requireTournamentAccess(tournamentId)'));
  assert.ok(page.includes('["director", "co_director"].includes(access.role)'));
});

test('new SQL contracts never resolve for unrelated callers or unreviewed names', () => {
  for (const [file, definitions] of bounded) {
    assert.equal(resolveDeclared({ file, name: 'unreviewed_rpc' }), undefined);
    for (const name of definitions.keys()) assert.equal(resolveDeclared({ file: 'src/app/api/v1/ordinary/route.ts', name }), undefined);
  }
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

test('every .rpc() call targets a function some migration defines', () => {
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
