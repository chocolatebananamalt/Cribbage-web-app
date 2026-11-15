// A browser holding an expired or revoked refresh token, or one that cannot
// reach Supabase, gets a claims error. Three helpers used to disagree about
// what that means:
//
//   getCurrentSubject      -> null, i.e. "treat as signed out"   (correct)
//   requireTournamentAccess-> notFound(), i.e. a permanent 404    (dead end)
//   requireVerifiedSubject -> throws, which the API boundary reports as 503
//
// The 404 was the damaging one. A server render cannot clear the dead cookie,
// and a 404 carries no control, so the only escape was knowing to clear site
// data by hand. On a tournament morning that is every affected player stuck.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const dal = read('src/lib/auth/require-tournament-access.ts');

test('a dead session sends the visitor to sign-in rather than a 404', () => {
  const claimsBranch = /if \(claimsError\)\s*([a-zA-Z]+)\(/.exec(dal);
  assert.ok(claimsBranch, 'the claims-error branch must still exist');
  assert.equal(claimsBranch[1], 'redirect',
    'a claims error means no usable session, which is recoverable by signing in; '
    + 'notFound() strands the visitor on a page with no control on it');
  assert.match(dal, /redirect\(signIn\)/);
  assert.match(dal, /\/sign-in\?next=/, 'the redirect must target the sign-in route');
});

test('the signed-out and dead-session branches lead to the same place', () => {
  // Two callers in the same position must not get different answers; that
  // divergence is what made a dead session look like a missing tournament.
  const redirects = [...dal.matchAll(/redirect\(([^)]*)\)/g)].map((m) => m[1]);
  assert.equal(redirects.length, 2, `expected exactly two redirects, found ${redirects.length}`);
  assert.deepEqual([...new Set(redirects)], ['signIn'],
    'both the claims-error and missing-subject branches must redirect to the same target');
});

test('a genuine non-membership is still a 404, not a sign-in loop', () => {
  // Redirecting here instead would bounce a signed-in visitor who simply is not
  // in this tournament between sign-in and the page forever.
  assert.match(dal, /if \(error \|\| typeof role !== "string" \|\| !allowedRoles\.has\(role\)\) notFound\(\)/,
    'an authenticated caller with no role in this tournament must still get notFound()');
});

test('the sign-in page can render for a browser holding a broken cookie', () => {
  // If sign-in itself threw on a claims error the redirect above would loop.
  const subject = read('src/lib/auth/current-subject.ts');
  assert.match(subject, /if \(error\) return null/,
    'getCurrentSubject must report a claims error as signed out, or the redirect loops');
  const signIn = read('src/app/sign-in/page.tsx');
  assert.match(signIn, /const subject = await getCurrentSubject\(\)/);
  assert.match(signIn, /if \(subject\) redirect\("\/"\)/,
    'sign-in must redirect only when a subject really exists');
});
