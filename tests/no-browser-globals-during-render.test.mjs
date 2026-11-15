// A client component still renders once on the server. Anything evaluated in
// the component body runs there, where `window` does not exist.
//
// The lazy form of useState is the trap, because it reads as deferred and is
// not. `useState(() => ...)` calls that function during the very first render,
// on the server included. seating-directory-client.tsx did exactly this:
//
//   const [eventId] = useState(() => new URLSearchParams(window.location.search).get("event") ?? "")
//
// Measured before the fix: GET /tournament/<id>/seating-directory answered 500
// on every request, for every role, with `ReferenceError: window is not defined`
// in the server log. The page was unreachable, not merely degraded.
//
// The fix is the pattern the sibling page already used: read the query string on
// the server from `searchParams` and pass it down as a prop.
//
// Verified fail-closed: restoring the window.location initializer turns this
// file red and names the file and the global.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const srcDir = new URL('../src/', import.meta.url);
const srcPath = fileURLToPath(srcDir);

function tsxFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(full));
    else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

// Reads the balanced argument list of every `useState(` call in `source`.
function findUseStateArguments(source) {
  const args = [];
  const needle = 'useState(';
  let from = 0;
  for (;;) {
    const start = source.indexOf(needle, from);
    if (start === -1) return args;
    let depth = 0;
    let i = start + needle.length - 1;
    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    args.push({ index: start, text: source.slice(start + needle.length, i) });
    from = i === source.length ? start + needle.length : i;
  }
}

const BROWSER_GLOBALS = /\b(window|document|localStorage|sessionStorage|navigator)\b/;

const files = tsxFiles(srcPath);

test('no client component reads a browser global while initialising state', () => {
  const offences = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('"use client"') && !source.includes("'use client'")) continue;
    for (const arg of findUseStateArguments(source)) {
      const match = BROWSER_GLOBALS.exec(arg.text);
      if (!match) continue;
      // `typeof window === "undefined" ? ... : ...` is the guarded form and is
      // safe on the server: score-entry.tsx:70 uses it for navigator.onLine.
      if (/typeof\s+(window|document|localStorage|sessionStorage|navigator)\s*===?\s*["']undefined["']/.test(arg.text)) continue;
      const line = source.slice(0, arg.index).split('\n').length;
      offences.push(`${path.relative(process.cwd(), file).replace(/\\/g, '/')}:${line} reads \`${match[1]}\` inside useState(...)`);
    }
  }
  assert.deepEqual(
    offences,
    [],
    `These run during server rendering and will throw ReferenceError:\n  ${offences.join('\n  ')}\n` +
      'Read the value on the server (searchParams) and pass it as a prop, or guard with typeof.',
  );
});

test('the seating directory takes its event from the server, not from window', () => {
  const client = fs.readFileSync(
    new URL('app/tournament/[tournamentId]/seating-directory/seating-directory-client.tsx', srcDir),
    'utf8',
  );
  assert.ok(
    !/window\.location/.test(client),
    'seating-directory-client.tsx reads window.location again: that is the 500 coming back',
  );
  assert.match(client, /initialEventId/, 'the client no longer accepts the event id as a prop');

  const page = fs.readFileSync(
    new URL('app/tournament/[tournamentId]/seating-directory/page.tsx', srcDir),
    'utf8',
  );
  assert.match(page, /searchParams/, 'the page no longer reads searchParams on the server');
  assert.match(page, /initialEventId=\{/, 'the page no longer passes the event id down');
});
