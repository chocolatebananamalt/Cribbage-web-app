// The proxy sends `script-src 'self' 'nonce-<fresh>' 'strict-dynamic'` on every
// response (src/proxy.ts:15). Browsers that honour strict-dynamic IGNORE 'self',
// so a script tag without this request's nonce does not run.
//
// Next.js can only stamp that nonce onto its bootstrap scripts while rendering
// per request. A build-time prerendered page therefore ships HTML whose scripts
// carry no nonce at all, every one is blocked, and the page never hydrates. It
// still looks correct, because the server-rendered markup is intact: only the
// buttons are dead.
//
// Measured on the built output before the fix: /auth/offline-data-blocked had
// 10 script tags and 0 with a nonce; /register had 8 and 0. After forcing both
// dynamic, a live request to /auth/offline-data-blocked served 10 of 10
// carrying that request's nonce.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the CSP this depends on is still nonce-only', () => {
  // If script-src ever stops using strict-dynamic, 'self' starts working again
  // and the requirements below become unnecessary rather than merely unmet.
  // Fail here so the reason is re-read rather than the tests quietly relaxed.
  const proxy = read('src/proxy.ts');
  assert.match(proxy, /'strict-dynamic'/, 'proxy no longer sends strict-dynamic: revisit this whole file');
  assert.match(proxy, /nonce-\$\{nonce\}/, 'proxy no longer sends a per-request nonce');
});

test('the shared-device sign-out page renders per request so its buttons hydrate', () => {
  const page = read('src/app/auth/offline-data-blocked/page.tsx');
  assert.match(page, /await connection\(\)/,
    'without a dynamic render this page is prerendered and its sign-out buttons never hydrate');
  assert.match(page, /export default async function/,
    'the page must be async to await connection()');
  // The page exists only to host this control, so a prerender makes it useless.
  assert.match(page, /SharedDeviceSignOut/);
});

test('public registration reads its release flag per request, not at build time', () => {
  const page = read('src/app/register/page.tsx');
  const connectionAt = page.indexOf('await connection()');
  const flagAt = page.search(/if \(!publicRegistrationEnabled\(\)\)/);
  assert.ok(connectionAt > 0, 'register must call await connection()');
  assert.ok(flagAt > 0, 'register must still gate on the release flag');
  // Order is the entire defect. Both lines were already present and the existing
  // suite asserted both, because it only checked that each string appeared.
  // Reading the flag first resolves it at build time, so the build's answer is
  // baked into a prerendered route and enabling the switch in production
  // changes nothing.
  assert.ok(connectionAt < flagAt,
    'await connection() must come BEFORE publicRegistrationEnabled(), otherwise the '
    + 'build-time flag value is prerendered and the release switch cannot be turned on');
});
