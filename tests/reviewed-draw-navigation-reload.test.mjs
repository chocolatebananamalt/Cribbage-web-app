// Current scoped component + actual codecs, deterministic hooks/storage/fetch.
// Not React/browser, provider admission, or a real tournament acceptance test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as workspaceCodec from '../src/lib/api/reviewed-native-seating-handlers.ts';
import * as drawCodec from '../src/lib/api/roster-random-draw.ts';
import * as publication from '../src/lib/seating/reviewed-draw-publication.ts';
import * as recovery from '../src/lib/seating/reviewed-draw-recovery.ts';
import * as resultCodec from '../src/lib/seating/reviewed-draw-publication-result.ts';
import * as validation from '../src/lib/api/validation.ts';
import * as navigation from '../src/lib/seating/reviewed-draw-navigation.ts';
import { example, actor, tid, id } from './helpers/reviewed-schedule-example.mjs';
import { input } from './helpers/reviewed-native-example.mjs';

const key = `reviewed-publication-link:${actor}:${tid}`;
const source = fs.readFileSync(new URL('../src/components/reviewed-draw-publisher-client.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source + '\nexports.Scoped=ScopedReviewedDrawPublisherClient;', { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;

function fixture() {
  const x = example(), draw = input().workspace;
  const workspace = { kind: 'reviewed-native-workspace-v1', actorId: actor, tournamentId: tid, draw, native: x.nativeWorkspace };
  const map = new Map([[key, x.operation.operationId]]), calls = [], states = [], timers = [], layouts = [], effects = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const port = {
    exports: {}, structuredClone,
    sessionStorage: { getItem: k => map.get(k) ?? null, setItem() { throw new Error('reload must not write storage'); }, removeItem() { throw new Error('reload must not clear storage'); } },
    setTimeout(callback) { timers.push(callback); return timers.length; }, clearTimeout() {},
    fetch: async (url, options) => {
      calls.push({ url, options });
      assert.equal(options?.method ?? 'GET', 'GET');
      return { ok: true, json: async () => url.includes('/operations/') ? x.operation : workspace };
    },
    require(name) {
      if (name === 'react') return {
        useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }]; },
        useRef(initial) { const index = cursor++; return states[index] ??= { current: initial }; },
        useCallback: callback => callback,
        useEffect: callback => effects.push(callback), useLayoutEffect: callback => layouts.push(callback),
      };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/link') return { __esModule: true, default: 'Link' };
      if (name.endsWith('.css')) return { __esModule: true, default: {} };
      for (const [suffix, value] of Object.entries({
        'reviewed-native-seating-handlers': workspaceCodec, 'roster-random-draw': drawCodec,
        'reviewed-draw-publication': publication, 'reviewed-draw-recovery': recovery,
        'reviewed-draw-publication-result': resultCodec, 'reviewed-draw-navigation': navigation, validation,
      })) if (name.endsWith('/' + suffix)) return value;
      if (name.endsWith('/recovery-owner')) return { assertRecoveryStorageOwner() {} };
      if (name.endsWith('/recovery-write-coordinator')) return { setAppRecoveryItem() { throw new Error('reload must not write recovery'); } };
      throw new Error(`Unexpected import ${name}`);
    },
  };
  vm.runInNewContext(compiled, port);
  const render = () => { cursor = 0; return port.exports.Scoped({ actorId: actor, tournamentId: tid }); };
  const mount = async () => { render(); const unmount = layouts[0](); effects[0](); timers.shift()(); await settle(); return { tree: render(), unmount }; };
  return { x, workspace, map, calls, port, render, mount };
}
async function settle() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
  return null;
}
const schedule = tree => find(tree, node => node.type === 'Link' && node.props.children === 'Preview the generated schedule');

test('reload restores only the remembered exact accepted operation URL after authoritative readback', async () => {
  const f = fixture(), before = [...f.map], { tree } = await f.mount();
  assert.equal(schedule(tree)?.props.href, `/tournament/${tid}/seating/random-draw/schedule?operationId=${f.x.operation.operationId}`);
  assert.deepEqual(f.calls.map(call => call.url), [`/api/v1/tournaments/${tid}/reviewed-seating`, `/api/v1/tournaments/${tid}/reviewed-seating/operations/${f.x.operation.operationId}`]);
  assert.deepEqual([...f.map], before);
});

test('navigation keeps the accepted operation identity rather than inferring a latest draw', async () => {
  const f = fixture();
  f.workspace.draw.latestDraw = null;
  const { tree } = await f.mount();
  assert.equal(schedule(tree)?.props.href, `/tournament/${tid}/seating/random-draw/schedule?operationId=${f.x.operation.operationId}`);
});

test('missing or malformed pointer never guesses a latest operation or performs a write', async () => {
  for (const pointer of [null, 'not-a-uuid', '../other', id(100).toUpperCase().replace('00000000', 'ABCDEFAB')]) {
    const f = fixture(); if (pointer === null) f.map.delete(key); else f.map.set(key, pointer);
    const { tree } = await f.mount();
    assert.equal(schedule(tree), null);
    assert.equal(f.calls.length, 1);
  }
});

test('foreign, stale, absent or unverified saved publication never enables schedule navigation', async () => {
  for (const mode of ['actor', 'tournament', 'operation', 'publication', 'assignment', 'request', 'thin', 'unavailable', 'missing-publication', 'registration-open', 'table-count', 'seat-count', 'assignment-count']) {
    const f = fixture(), fetch = f.port.fetch;
    if (mode === 'actor') f.x.operation.actorId = id(999);
    if (mode === 'tournament') f.x.operation.tournamentId = id(999);
    if (mode === 'operation') { f.x.operation.operationId = id(999); f.x.operation.receipt.operationId = id(999); f.x.operation.request.idempotencyKey = id(999); f.x.operation.receipt.request.idempotencyKey = id(999); }
    if (mode === 'publication') f.workspace.native.publication.publicationId = id(999);
    if (mode === 'assignment') { f.workspace.native.publication.assignments[0].verificationId = 'A-19'; f.workspace.native.publication.assignments[0].initialTableSeat = 'A-19'; }
    if (mode === 'request') f.x.operation.receipt.request.review.reason = 'Different request';
    if (mode === 'thin') f.x.operation = { status: 'initial_seating_published' };
    if (mode === 'missing-publication') f.workspace.native.publication = null;
    if (mode === 'registration-open') f.workspace.native.registrationClosed = false;
    if (mode === 'table-count') f.workspace.native.publication.tableCount = 2;
    if (mode === 'seat-count') f.workspace.native.publication.seatsPerTable = 16;
    if (mode === 'assignment-count') f.workspace.native.publication.assignments.pop();
    if (mode === 'unavailable') f.port.fetch = async (url, options) => url.includes('/operations/') ? { ok: false, json: async () => null } : fetch(url, options);
    const before = [...f.map], { tree } = await f.mount();
    assert.equal(schedule(tree), null, mode);
    assert.deepEqual([...f.map], before);
  }
});

test('storage-get and exact-operation network exceptions preserve recovery and hide navigation', async () => {
  for (const mode of ['storage-get', 'operation-network']) {
    const f = fixture(), fetch = f.port.fetch, get = f.port.sessionStorage.getItem;
    if (mode === 'storage-get') f.port.sessionStorage.getItem = k => {
      if (k === key) throw new Error('synthetic storage unavailable');
      return get(k);
    };
    else f.port.fetch = async (url, options) => {
      if (url.includes('/operations/')) throw new Error('synthetic network unavailable');
      return fetch(url, options);
    };
    const before = [...f.map], { tree } = await f.mount();
    assert.equal(schedule(tree), null, mode);
    assert.deepEqual([...f.map], before);
  }
});

test('pointer replacement or an unmounted scope during operation readback cannot restore an old link', async () => {
  for (const mode of ['pointer-replaced', 'scope-left']) {
    const f = fixture(), fetch = f.port.fetch;
    let resolve;
    f.port.fetch = async (url, options) => url.includes('/operations/') ? new Promise(complete => { resolve = complete; }) : fetch(url, options);
    const { tree, unmount } = await f.mount();
    assert.equal(schedule(tree), null);
    assert.ok(resolve);
    if (mode === 'pointer-replaced') f.map.set(key, id(999)); else unmount();
    resolve({ ok: true, json: async () => f.x.operation });
    await settle();
    assert.equal(schedule(f.render()), null, mode);
    assert.equal(f.map.get(key), mode === 'pointer-replaced' ? id(999) : f.x.operation.operationId);
  }
});

test('refresh hides a formerly accepted link if fresh exact readback is unavailable', async () => {
  const f = fixture(), { tree } = await f.mount();
  assert.ok(schedule(tree));
  const fetch = f.port.fetch;
  f.port.fetch = async (url, options) => url.includes('/operations/') ? { ok: false, json: async () => null } : fetch(url, options);
  find(tree, node => node.type === 'button' && node.props.children === 'Reload current status').props.onClick();
  assert.equal(schedule(f.render()), null, 'hide the link as soon as refresh begins');
  await settle();
  assert.equal(schedule(f.render()), null);
  assert.equal(f.map.get(key), f.x.operation.operationId);
});

test('a superseded exact readback cannot undo the newer refresh outcome', async () => {
  const f = fixture(), fetch = f.port.fetch;
  let resolve, reads = 0;
  f.port.fetch = async (url, options) => {
    if (!url.includes('/operations/')) return fetch(url, options);
    if (++reads === 1) return new Promise(complete => { resolve = complete; });
    return { ok: false, json: async () => null };
  };
  const { tree } = await f.mount();
  assert.ok(resolve);
  find(tree, node => node.type === 'button' && node.props.children === 'Reload current status').props.onClick();
  await settle();
  assert.equal(schedule(f.render()), null);
  resolve({ ok: true, json: async () => f.x.operation });
  await settle();
  assert.equal(schedule(f.render()), null);
  assert.equal(reads, 2);
});
