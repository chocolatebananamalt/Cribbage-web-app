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
function parameterNames(sql, openIndex) {
  let depth = 0;
  let end = openIndex;
  for (let i = openIndex; i < sql.length; i += 1) {
    if (sql[i] === '(') depth += 1;
    else if (sql[i] === ')') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  return new Set([...sql.slice(openIndex + 1, end).matchAll(/\b(p_[a-z0-9_]+)\b/gi)].map((m) => m[1].toLowerCase()));
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
  const missing = calls.filter((c) => !declared.has(c.name)).map((c) => `${c.file}:${c.line} ${c.name}`);
  assert.deepEqual(missing, [], `these RPCs are called but never defined:\n${missing.join('\n')}`);
});

test('every .rpc() argument name is declared by the function it targets', () => {
  const mismatches = [];
  for (const call of calls) {
    const target = declared.get(call.name);
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
