import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await fs.readFile('public/activation-bootstrap.js', 'utf8');
const token = '00000000-0000-4000-8000-000000000001.' + 'A'.repeat(43);
function documentAt(pathname, hash) {
  const listeners = new Map();
  const window = {
    location: { pathname, hash, search: '' },
    history: { replaceState() { window.location.hash = ''; } },
    addEventListener(name, callback) { listeners.set(name, callback); },
  };
  vm.runInNewContext(source, { window });
  return { window, dispatch(name) { listeners.get(name)?.(); } };
}

test('bootstrap clears activation fragment before consumption and clears early page exit', () => {
  const doc = documentAt('/activate', '#' + token);
  assert.equal(doc.window.location.hash, '');
  assert.equal(doc.window.__accActivationCredential, token);
  doc.dispatch('pagehide');
  assert.equal(doc.window.__accActivationCredential, undefined);
});

test('bootstrap leaves other page fragments intact and captures later client navigation', () => {
  const doc = documentAt('/other', '#ordinary-anchor');
  assert.equal(doc.window.location.hash, '#ordinary-anchor');
  assert.equal(doc.window.__accActivationCredential, undefined);
  doc.window.location.pathname = '/activate';
  doc.window.location.hash = '#' + token;
  doc.dispatch('acc-activation-capture');
  assert.equal(doc.window.location.hash, '');
  assert.equal(doc.window.__accActivationCredential, token);
});

test('a new malformed or encoded fragment cannot retain an older bootstrap credential', () => {
  for (const value of ['malformed', token.replace('.', '%2E')]) {
    const doc = documentAt('/activate', '#' + token);
    doc.window.location.hash = '#' + value;
    doc.dispatch('hashchange');
    assert.equal(doc.window.location.hash, '');
    assert.equal(doc.window.__accActivationCredential, undefined);
  }
});
