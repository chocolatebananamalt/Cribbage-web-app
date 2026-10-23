import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const errors = await import(pathToFileURL(path.join(root, 'src/lib/auth/email-sign-in-error.ts')).href);

test('email sign-in rate limits use the remaining seconds supplied by Supabase', () => {
  const result = errors.normalizeEmailSignInError({
    code: 'over_email_send_rate_limit',
    status: 429,
    message: 'For security purposes, you can only request this after 37 seconds.',
  });

  assert.deepEqual(result, {
    message: 'Too many sign-in emails were requested. Wait 37 seconds before requesting another link.',
    cooldownSeconds: 37,
  });
  assert.equal(errors.parseEmailRetrySeconds({ message: 'Retry in 1 second.' }), 1);
  assert.equal(errors.parseEmailRetrySeconds({ retry_after: 12, message: 'Rate limit exceeded.' }), 12);
});

test('project quota and request rate limits never invent a reset duration', () => {
  for (const error of [
    { code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' },
    { code: 'over_request_rate_limit', message: 'Request rate limit exceeded' },
    { status: 429, message: 'Too many requests' },
    429,
  ]) {
    const result = errors.normalizeEmailSignInError(error);
    assert.equal(result.cooldownSeconds, null);
    assert.match(result.message, /exact reset time is unavailable/i);
    assert.doesNotMatch(result.message, /60|few minutes/i);
  }
});

test('email sign-in blocks duplicate requests while keeping a quiet accessible cooldown and password fallback', () => {
  const form = read('src/app/sign-in/sign-in-form.tsx');
  assert.match(form, /requestInFlight\.current \|\| cooldownSeconds !== null/);
  assert.match(form, /requestInFlight\.current = true/);
  assert.match(form, /disabled=\{busy \|\| cooldownSeconds !== null\}/);
  assert.match(form, /role="alert">\{error\}/);
  assert.match(form, /aria-live="off"/);
  assert.match(form, /signInWithPassword/);
  assert.match(form, /Sign in with a password instead/);
  assert.doesNotMatch(form, /wait a few minutes/i);
});
