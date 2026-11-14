import test from 'node:test';
import assert from 'node:assert/strict';
import {
  customPayoutIntentVersionV1, customPayoutRecoveryVersionV1, customPayoutTechnicalRatioDomainV1,
  parseCustomPayoutRatioDraftV1, isCustomPayoutIntentV1, createCustomPayoutIntentV1, serializeCustomPayoutIntentV1,
  readCustomPayoutIntentV1, parseCustomPayoutIntentV1, classifyCustomPayoutIntentV1,
  createCustomPayoutRecoveryV1, isCustomPayoutRecoveryV1, serializeCustomPayoutRecoveryV1, parseCustomPayoutRecoveryV1,
  customPayoutRecoveryMatchesV1, adaptLegacyPayoutPresetV1, legacyPayoutPresetForIntentV1,
} from '../src/lib/api/custom-payout-intent-v1.ts';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const source=(kind='q')=>({tournamentId:id(1),eventClientRowId:id(2),setupRevisionId:id(3),setupVersion:4,poolSlot:kind==='satellite'?null:1,sourceDigest:'a'.repeat(64)});
const context=(kind='q')=>({scope:kind,source:source(kind)});
const intent=(kind='q',ratio=7)=>createCustomPayoutIntentV1(kind,ratio,source(kind));

test('positive-whole draft syntax is exact and independent from the technical calculator domain',()=>{
 for(const [raw,expected]of [['1',1],['2',2],['7',7],['100',100],['101',101],[String(Number.MAX_SAFE_INTEGER),Number.MAX_SAFE_INTEGER]])assert.equal(parseCustomPayoutRatioDraftV1(raw),expected);
 for(const raw of ['', '0','00','07',' 7','7 ','+7','-7','7.0','7e0','7/1','1,000','Infinity','NaN','７','٠٧','9007199254740992',7,true,null,undefined,{}])assert.equal(parseCustomPayoutRatioDraftV1(raw),null,String(raw));
 assert.deepEqual(customPayoutTechnicalRatioDomainV1,{minimum:1,maximum:2147483647,basis:'postgres-integer-storage-not-acc-rule',amountPolicyVersion:'graduated-custom-ratio-largest-remainder-5usd-v3'});
 for(const kind of ['q','side']){for(const ratio of [1,2,7,100,101,2147483647])assert.deepEqual(classifyCustomPayoutIntentV1(intent(kind,ratio)),{status:'ratio-in-technical-domain',ratioDenominator:ratio,amountPolicyVersion:'graduated-custom-ratio-largest-remainder-5usd-v3'});for(const ratio of [2147483648,Number.MAX_SAFE_INTEGER]){assert.ok(isCustomPayoutIntentV1(intent(kind,ratio)));assert.deepEqual(classifyCustomPayoutIntentV1(intent(kind,ratio)),{status:'blocked',code:'ratio_outside_calculator_domain'});}}
});
test('canonical intent serialization has stable field order and complete source binding',()=>{
 const value=intent(),raw=serializeCustomPayoutIntentV1(value);assert.ok(raw);assert.equal(value.kind,customPayoutIntentVersionV1);
 assert.equal(raw,JSON.stringify({kind:'custom-payout-intent-v1',scope:'q',ratioDenominator:7,source:source()}));
 assert.deepEqual(parseCustomPayoutIntentV1(raw,context()),value);
 const reordered=Object.fromEntries(Object.entries(value).reverse());reordered.source=Object.fromEntries(Object.entries(value.source).reverse());assert.equal(serializeCustomPayoutIntentV1(reordered),raw);assert.deepEqual(readCustomPayoutIntentV1(reordered,context()),value);
 for(const noncanonical of [JSON.stringify(value,null,2),' '+raw,raw+'\n',JSON.stringify(reordered),raw.replace('"ratioDenominator":7','"ratioDenominator":7e0'),raw.replace('"ratioDenominator":7','"ratioDenominator":7,"ratioDenominator":7')])assert.equal(parseCustomPayoutIntentV1(noncanonical,context()),null);
});
test('read/parse reject changed scope, revision, event, slot and fingerprint without rebasing the retained source',()=>{
 const value=intent(),raw=serializeCustomPayoutIntentV1(value),before=JSON.stringify(value);
 for(const change of [{tournamentId:id(9)},{eventClientRowId:id(9)},{setupRevisionId:id(9)},{setupVersion:5},{poolSlot:2},{sourceDigest:'b'.repeat(64)}]){const expected={scope:'q',source:{...source(),...change}};assert.equal(readCustomPayoutIntentV1(value,expected),null);assert.equal(parseCustomPayoutIntentV1(raw,expected),null);}
 assert.equal(readCustomPayoutIntentV1(value,{scope:'side',source:source('side')}),null);assert.equal(readCustomPayoutIntentV1(value,undefined),null);assert.equal(readCustomPayoutIntentV1(value,{...context(),actorId:id(8)}),null);assert.equal(JSON.stringify(value),before);assert.equal(serializeCustomPayoutIntentV1(value),raw);
});
test('source constraints preserve setup identity and existing slot bounds without an ACC business-limit claim',()=>{
 for(const kind of ['q','side','satellite'])assert.ok(isCustomPayoutIntentV1(intent(kind)));
 assert.ok(createCustomPayoutIntentV1('q',7,{...source(),setupRevisionId:null,setupVersion:0}));
 for(const change of [{setupVersion:0},{setupRevisionId:null},{setupVersion:-1},{setupVersion:2147483648},{setupVersion:'4'},{sourceDigest:'A'.repeat(64)},{tournamentId:id(1).toUpperCase().replace('10000000','A0000000')},{extra:true}])assert.equal(createCustomPayoutIntentV1('q',7,{...source(),...change}),null);
 for(const [kind,slot]of [['q',0],['q',3],['side',0],['side',7],['satellite',1]])assert.equal(createCustomPayoutIntentV1(kind,7,{...source(kind),poolSlot:slot}),null);
 assert.ok(createCustomPayoutIntentV1('q',7,{...source(),poolSlot:2}));assert.ok(createCustomPayoutIntentV1('side',7,{...source('side'),poolSlot:6}));
 for(const ratio of [0,-1,1.5,'7',NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.equal(createCustomPayoutIntentV1('q',ratio,source()),null);
});
test('decoded intent and recovery are detached deeply frozen snapshots',()=>{
 const original=source(),value=createCustomPayoutIntentV1('side',7,original);assert.ok(Object.isFrozen(value));assert.ok(Object.isFrozen(value.source));original.setupVersion=99;assert.equal(value.source.setupVersion,4);
 assert.throws(()=>{value.source.setupVersion=99;},TypeError);assert.throws(()=>{value.ratioDenominator=6;},TypeError);
 const recovery=createCustomPayoutRecoveryV1(id(10),id(11),value);assert.ok(Object.isFrozen(recovery));assert.ok(Object.isFrozen(recovery.intent));assert.ok(Object.isFrozen(recovery.intent.source));assert.notEqual(recovery.intent,value);assert.notEqual(recovery.intent.source,value.source);
});
test('recovery roundtrip binds actor, operation, full intent and original source; same-key changes are conflicts',()=>{
 const value=createCustomPayoutRecoveryV1(id(10),id(11),intent()),raw=serializeCustomPayoutRecoveryV1(value);assert.equal(value.kind,customPayoutRecoveryVersionV1);assert.ok(isCustomPayoutRecoveryV1(value));assert.deepEqual(parseCustomPayoutRecoveryV1(raw,id(10),context(),id(11)),value);assert.deepEqual(parseCustomPayoutRecoveryV1(raw,id(10),context()),value);
 assert.equal(parseCustomPayoutRecoveryV1(raw,id(12),context()),null);assert.equal(parseCustomPayoutRecoveryV1(raw,id(10),context(),id(12)),null);assert.equal(parseCustomPayoutRecoveryV1(raw,id(10),{scope:'q',source:{...source(),setupVersion:5}}),null);
 assert.ok(customPayoutRecoveryMatchesV1(value,JSON.parse(raw)));
 for(const changed of [{...value,actorId:id(12)},{...value,operationId:id(12)},{...value,intent:intent('q',8)},{...value,intent:intent('side')},{...value,intent:{...value.intent,source:{...source(),sourceDigest:'b'.repeat(64)}}}])assert.equal(customPayoutRecoveryMatchesV1(changed,value),false);
 assert.equal(parseCustomPayoutRecoveryV1(JSON.stringify(value,null,2),id(10),context()),null);assert.equal(customPayoutRecoveryMatchesV1(null,value),false);
});
test('explicit legacy adapters roundtrip exact presets and never infer Equal, Top4, pool names or new custom strings',()=>{
 const presets={q:[['Graduated (1-in-4)',4],['Graduated (1-in-6)',6],['Graduated (1-in-8)',8],['Graduated (1-in-10)',10]],side:[['graduated-1-in-4',4],['graduated-1-in-6',6],['graduated-1-in-8',8],['graduated-1-in-10',10]],satellite:[['1 in 4',4],['1 in 5',5],['1 in 6',6]]};
 for(const [kind,rows]of Object.entries(presets))for(const [preset,ratio]of rows){const value=adaptLegacyPayoutPresetV1(kind,preset,source(kind));assert.equal(value.ratioDenominator,ratio);assert.equal(legacyPayoutPresetForIntentV1(value),preset);}
 const untouched={q:'Equal (Pays All Equally)',qDouble:'Equal (Top Qualifier Paid Double)',satellite:'Top 4',side:'Club Side Pool'};const before=JSON.stringify(untouched);
 for(const [kind,preset]of [['q',untouched.q],['q',untouched.qDouble],['satellite',untouched.satellite],['side',untouched.side],['q','Graduated (1-in-7)'],['side','graduated-1-in-7'],['satellite','1 in 7'],['q',' Graduated (1-in-6)'],['side','Graduated (1-in-6)']])assert.equal(adaptLegacyPayoutPresetV1(kind,preset,source(kind)),null);
 assert.equal(JSON.stringify(untouched),before);for(const kind of ['q','side','satellite'])assert.equal(legacyPayoutPresetForIntentV1(intent(kind,7)),null);
});
test('Satellite allocation remains explicitly undecided even for an existing numeric preset',()=>{
 for(const ratio of [1,4,5,6,7,100,101])assert.deepEqual(classifyCustomPayoutIntentV1(intent('satellite',ratio)),{status:'blocked',code:'satellite_allocation_policy_undecided'});
 assert.equal(classifyCustomPayoutIntentV1(adaptLegacyPayoutPresetV1('satellite','1 in 5',source('satellite'))).code,'satellite_allocation_policy_undecided');
});
test('strict whitelists reject payment/recipient/role additions rather than imply eligibility',()=>{
 for(const addition of [{paidCount:16},{memberIds:[id(8)]},{eligible:true},{awardsMinor:[500]},{actorRole:'director'}])assert.equal(isCustomPayoutIntentV1({...intent(),...addition}),false);
 const symbolExtra={...intent(),[Symbol('extra')]:true};assert.equal(isCustomPayoutIntentV1(symbolExtra),false);
 assert.deepEqual(Object.keys(classifyCustomPayoutIntentV1(intent())).sort(),['amountPolicyVersion','ratioDenominator','status']);
 for(const raw of [null,7,true,'','not-json','[]','{"kind":"future"}','x'.repeat(2049)]){assert.equal(parseCustomPayoutIntentV1(raw,context()),null);assert.equal(parseCustomPayoutRecoveryV1(raw,id(10),context()),null);}
});
test('deterministic supported and out-of-domain ratios retain exact saved/recovery text over all scopes',()=>{
 let state=19;for(let i=0;i<500;i++){state=(state*1664525+1013904223)>>>0;const kind=['q','side','satellite'][i%3],ratio=state%10000+1,ctx=context(kind),value=createCustomPayoutIntentV1(kind,ratio,ctx.source),raw=serializeCustomPayoutIntentV1(value);assert.deepEqual(parseCustomPayoutIntentV1(raw,ctx),value);assert.equal(serializeCustomPayoutIntentV1(parseCustomPayoutIntentV1(raw,ctx)),raw);const recovery=createCustomPayoutRecoveryV1(id(10),id(100+i),value),encoded=serializeCustomPayoutRecoveryV1(recovery);assert.equal(serializeCustomPayoutRecoveryV1(parseCustomPayoutRecoveryV1(encoded,id(10),ctx,id(100+i))),encoded);}
});
