import test from'node:test';import assert from'node:assert/strict';
import{isEventPrizeResponseValueV1,eventPrizeSettingsResponseMaximumBytesV1}from'../src/lib/api/event-prize-settings-v1.ts';
test('numeric response budget uses encoded integer length without raising byte limit',()=>{
 const value={rows:Array.from({length:20},()=>Array(10000).fill(0)),note:'x'.repeat(4000000)};
 assert(Buffer.byteLength(JSON.stringify(value))<eventPrizeSettingsResponseMaximumBytesV1);
 assert.equal(isEventPrizeResponseValueV1(value),true);
 assert.equal(isEventPrizeResponseValueV1({note:'x'.repeat(eventPrizeSettingsResponseMaximumBytesV1)}),false);
 for(const v of[NaN,Infinity,-Infinity,-0,Number.MAX_SAFE_INTEGER+1])assert.equal(isEventPrizeResponseValueV1({v}),false);
 const cyclic={};cyclic.self=cyclic;assert.equal(isEventPrizeResponseValueV1(cyclic),false);
 assert.equal(isEventPrizeResponseValueV1(Object.defineProperty({},'v',{enumerable:true,get(){throw Error('must not invoke getter');}})),false);
});
