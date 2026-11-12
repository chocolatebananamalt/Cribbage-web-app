import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {formatUsPhoneInput,formatUsPhoneInputEdit,reconcileUsPhoneSeparatorDeletion,usPhoneDeleteDirection,usPhoneSeparatorDeletion} from '../src/lib/us-phone-input.ts';

test('formats domestic digits and common domestic paste decorations with hyphens',()=>{
 assert.equal(formatUsPhoneInput('8'),'8');
 assert.equal(formatUsPhoneInput('8085'),'808-5');
 assert.equal(formatUsPhoneInput('808555'),'808-555');
 assert.equal(formatUsPhoneInput('8085550'),'808-555-0');
 assert.equal(formatUsPhoneInput('8085550100'),'808-555-0100');
 assert.equal(formatUsPhoneInput('(808) 555-0100'),'808-555-0100');
 assert.equal(formatUsPhoneInput('1 808 555 0100'),'1-808-555-0100');
});

test('preserves international, extension, Unicode, unknown, and longer input without truncation',()=>{
 for(const value of['+1 808 555 0100','+44 20 7946 0958','808-555-0100 ext 42','8085550100 x42','Call the venue','４４２０７９４６０９５８','808/555/0100','442079460958','180855501001234','---'])assert.equal(formatUsPhoneInput(value),value);
});

test('maps paste and middle-edit selections by digit position',()=>{
 assert.deepEqual(formatUsPhoneInputEdit('8085',4,4),{value:'808-5',selectionStart:5,selectionEnd:5});
 assert.deepEqual(formatUsPhoneInputEdit('(808) 555-0100',6,9),{value:'808-555-0100',selectionStart:4,selectionEnd:7});
 assert.deepEqual(formatUsPhoneInputEdit('+44 20',3,3),{value:'+44 20',selectionStart:3,selectionEnd:3});
});

test('Backspace and Delete at an inserted hyphen remove the adjacent digit',()=>{
 assert.equal(usPhoneDeleteDirection('deleteContentBackward'),'backward');
 assert.equal(usPhoneDeleteDirection('deleteContentForward'),'forward');
 assert.equal(usPhoneDeleteDirection('insertText'),null);
 assert.deepEqual(usPhoneSeparatorDeletion('808-555-0100',4,4,'backward'),{value:'805-550-100',selectionStart:2,selectionEnd:2});
 assert.deepEqual(usPhoneSeparatorDeletion('808-555-0100',3,3,'forward'),{value:'808-550-100',selectionStart:3,selectionEnd:3});
 assert.deepEqual(reconcileUsPhoneSeparatorDeletion('808-555-0100','808555-0100',3,3,'deleteContentBackward'),{value:'808-555-0100',selectionStart:3,selectionEnd:3});
 assert.deepEqual(reconcileUsPhoneSeparatorDeletion('808-555-0100','808555-0100',3,3,'deleteContentBackward',{selectionStart:4,selectionEnd:4}),{value:'805-550-100',selectionStart:2,selectionEnd:2});
 assert.deepEqual(reconcileUsPhoneSeparatorDeletion('808-555-0100','808555-0100',3,3,'deleteContentForward',{selectionStart:3,selectionEnd:3}),{value:'808-550-100',selectionStart:3,selectionEnd:3});
 assert.deepEqual(reconcileUsPhoneSeparatorDeletion('808-555-0100','808555-0100',3,3,'deleteContentBackward',{selectionStart:3,selectionEnd:4}),{value:'808-555-0100',selectionStart:3,selectionEnd:3});
 assert.deepEqual(reconcileUsPhoneSeparatorDeletion('808-555-0100','808555-0100',3,3,'deleteContentForward',{selectionStart:3,selectionEnd:4}),{value:'808-555-0100',selectionStart:3,selectionEnd:3});
 assert.equal(reconcileUsPhoneSeparatorDeletion('808-555-0100','808555-0100',2,3,'deleteContentBackward'),null);
 assert.equal(reconcileUsPhoneSeparatorDeletion('808-555-0100','80555-0100',2,2,'deleteContentBackward'),null);
 assert.equal(usPhoneSeparatorDeletion('808-555-0100',5,5,'backward'),null);
 assert.equal(usPhoneSeparatorDeletion('808-555-0100',3,7,'forward'),null);
});

test('component remains controlled and preserves the established telephone attributes',async()=>{
 const source=await readFile(new URL('../src/components/tournament-phone-input.tsx',import.meta.url),'utf8');
 assert.match(source,/value=\{value\}/);
 assert.match(source,/type="tel"/);assert.match(source,/inputMode="tel"/);assert.match(source,/autoComplete="tel"/);assert.match(source,/maxLength=\{40\}/);assert.match(source,/disabled=\{disabled\}/);
 assert.match(source,/queueMicrotask/);assert.match(source,/isComposing/);assert.match(source,/onBlur=\{clearPending\}/);assert.match(source,/onBeforeInput=/);assert.match(source,/ctrlKey\|\|event\.metaKey\|\|event\.altKey/);
 assert.doesNotMatch(source,/useState|localStorage|sessionStorage|fetch\s*\(/);
});
