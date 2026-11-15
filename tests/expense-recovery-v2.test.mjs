import test from"node:test";import assert from"node:assert/strict";
import{
 createExpenseRecoveryEnvelopeV2,exactExpenseRecoveryRequestMatches,expenseRecoveryStorageKey,
 parseExpenseRecoveryRaw,readExpenseRecovery,
}from"../src/lib/expenses/expense-recovery-v2.ts";
import{expenseActorMatches,expenseExpectedActorHeader,readExpectedExpenseActor}from"../src/lib/api/expense-expected-actor.ts";
const id=n=>`e1280000-0000-4000-8000-${String(n).padStart(12,"0")}`,actor=id(1),other=id(2),tid=id(3),op=id(4),expenseId=id(5),eventId=id(6);
const postgresUuid="e1280000-0000-0000-0000-000000000007";
class MemoryStorage{#values=new Map();get length(){return this.#values.size;}key(index){return[...this.#values.keys()][index]??null;}getItem(key){return this.#values.get(key)??null;}setItem(key,value){this.#values.set(key,String(value));}removeItem(key){this.#values.delete(key);}clear(){this.#values.clear();}}

test("v2 recovery retains the exact record payload and binds actor, tournament and operation",()=>{
 const request={amountMinor:1250,description:"Venue supplies",idempotencyKey:op};
 const envelope=createExpenseRecoveryEnvelopeV2(actor,tid,"record_tournament_expense",request);assert.ok(envelope);
 const raw=JSON.stringify(envelope),parsed=parseExpenseRecoveryRaw(raw,actor,tid);assert.equal(parsed.status,"current");
 assert.deepEqual(parsed.envelope.request,request);assert.equal(parsed.recovery.idempotencyKey,op);
 assert.equal(exactExpenseRecoveryRequestMatches(parsed,"record_tournament_expense",request),true);
 assert.equal(exactExpenseRecoveryRequestMatches(parsed,"record_tournament_expense",{...request,amountMinor:1251}),false);
 assert.equal(parseExpenseRecoveryRaw(raw,other,tid).status,"unknown");
});

test("v2 recovery retains the exact void payload without deriving a replacement",()=>{
 const request={expenseId,expectedExpenseVersion:1,expenseEventId:eventId,voidReason:"Entered twice",idempotencyKey:op};
 const envelope=createExpenseRecoveryEnvelopeV2(actor,tid,"void_tournament_expense",request);assert.ok(envelope);
 const parsed=parseExpenseRecoveryRaw(JSON.stringify(envelope),actor,tid);assert.equal(parsed.status,"current");
 assert.deepEqual(parsed.recovery,{operationType:"void_tournament_expense",expenseId,expectedExpenseVersion:1,expenseEventId:eventId,idempotencyKey:op});
});

test("expense scope accepts canonical PostgreSQL UUID text outside RFC version and variant subsets",()=>{
 const request={amountMinor:1250,description:"Venue supplies",idempotencyKey:op};
 const envelope=createExpenseRecoveryEnvelopeV2(postgresUuid,postgresUuid,"record_tournament_expense",request);assert.ok(envelope);
 assert.equal(parseExpenseRecoveryRaw(JSON.stringify(envelope),postgresUuid,postgresUuid).status,"current");
});

test("legacy digest-only recovery remains readable but never gains an invented payload",()=>{
 const legacy={kind:"expense",operationType:"record_tournament_expense",expenseId:null,expectedExpenseVersion:0,expenseEventId:null,idempotencyKey:op,digest:"a".repeat(64)};
 const parsed=parseExpenseRecoveryRaw(JSON.stringify(legacy),actor,tid);assert.equal(parsed.status,"legacy");assert.deepEqual(parsed.recovery,{operationType:"record_tournament_expense",expenseId:null,expectedExpenseVersion:0,expenseEventId:null,idempotencyKey:op});assert.equal("request"in parsed.envelope,false);
});

test("legacy recovery with extra actor or future fields remains unknown byte evidence",()=>{
 const legacy={kind:"expense",operationType:"record_tournament_expense",expenseId:null,expectedExpenseVersion:0,expenseEventId:null,idempotencyKey:op,digest:"a".repeat(64)};
 assert.equal(parseExpenseRecoveryRaw(JSON.stringify({...legacy,actorId:other}),actor,tid).status,"unknown");
 assert.equal(parseExpenseRecoveryRaw(JSON.stringify({...legacy,future:true}),actor,tid).status,"unknown");
});

test("malformed and foreign bytes remain unknown and reads never delete another actor's key",()=>{
 const storage=new MemoryStorage(),ownKey=expenseRecoveryStorageKey(actor,tid),otherKey=expenseRecoveryStorageKey(other,tid),foreignRaw=JSON.stringify({kind:"future-expense",private:"preserve exactly"});
 storage.setItem(ownKey,"{malformed");storage.setItem(otherKey,foreignRaw);
 assert.equal(readExpenseRecovery(storage,ownKey,actor,tid).status,"unknown");assert.equal(storage.getItem(ownKey),"{malformed");assert.equal(storage.getItem(otherKey),foreignRaw);
});

test("expense server identity precondition is canonical and rechecks the authenticated user",async()=>{
 assert.equal(expenseExpectedActorHeader,"x-expected-actor-id");
 assert.equal(readExpectedExpenseActor(new Request("http://localhost",{headers:{[expenseExpectedActorHeader]:actor}})),actor);
 assert.equal(readExpectedExpenseActor(new Request("http://localhost")),null);
 assert.equal(readExpectedExpenseActor(new Request("http://localhost",{headers:{[expenseExpectedActorHeader]:actor.toUpperCase()}})),null);
 assert.equal(readExpectedExpenseActor(new Request("http://localhost",{headers:{[expenseExpectedActorHeader]:postgresUuid}})),postgresUuid);
 assert.equal(await expenseActorMatches({auth:{getUser:async()=>({data:{user:{id:actor}},error:null})}},actor),true);
 assert.equal(await expenseActorMatches({auth:{getUser:async()=>({data:{user:{id:other}},error:null})}},actor),false);
});
