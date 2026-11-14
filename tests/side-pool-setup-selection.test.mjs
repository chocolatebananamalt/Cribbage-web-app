import test from 'node:test';
import assert from 'node:assert/strict';
import { isGraduatedSidePoolSetupType, nextSidePoolDefaultName, sidePoolDefaultName, sidePoolNameFromInput, sidePoolOptionalName, sidePoolSetupRatio } from '../src/lib/api/side-pool-setup-selection.ts';

test('only supported graduated selections yield a payout ratio', () => {
  for (const ratio of [4, 6, 8, 10]) {
    const code = `graduated-1-in-${ratio}`;
    assert.equal(isGraduatedSidePoolSetupType(code), true);
    assert.equal(sidePoolSetupRatio(code), ratio);
  }
  for (const code of [undefined, null, '', 'equal', 'equal-double', 'graduated-1-in-5', 'Side Pool 1']) {
    assert.equal(isGraduatedSidePoolSetupType(code), false);
    assert.equal(sidePoolSetupRatio(code), null);
  }
});

test('optional names generate distinct bounded identities while retaining entered names', () => {
  assert.deepEqual(Array.from({length: 6}, (_, index) => sidePoolNameFromInput('', index)), ['Side Pool 1', 'Side Pool 2', 'Side Pool 3', 'Side Pool 4', 'Side Pool 5', 'Side Pool 6']);
  assert.equal(sidePoolOptionalName('Side Pool 2', 1), '');
  assert.equal(sidePoolNameFromInput('  Early Bird  ', 0), '  Early Bird  ');
  assert.equal(sidePoolOptionalName('Early Bird', 0), 'Early Bird');
  assert.equal(nextSidePoolDefaultName(['Side Pool 2']), 'Side Pool 1');
  assert.equal(nextSidePoolDefaultName(['side pool 1', 'Side Pool 2']), 'Side Pool 3');
  assert.throws(() => sidePoolDefaultName(-1), RangeError);
  assert.throws(() => sidePoolDefaultName(6), RangeError);
});

test('typed ratio draft preserves only supported saved codes without invented minimum or silent coercion', async()=>{const{sidePoolPayoutTypeFromRatioDraft,sidePoolRatioDraftMessage}=await import('../src/lib/api/side-pool-setup-selection.ts');for(const n of [4,6,8,10])assert.equal(sidePoolPayoutTypeFromRatioDraft(String(n)),`graduated-1-in-${n}`);for(const raw of ['', '0','-4','4.5','4e0',' 4 ','2','3','5','7','100','9007199254740992'])assert.equal(sidePoolPayoutTypeFromRatioDraft(raw),null);assert.match(sidePoolRatioDraftMessage('7'),/cannot be saved/);assert.match(sidePoolRatioDraftMessage('-4'),/positive whole/);assert.equal(sidePoolRatioDraftMessage('4'),null);});
