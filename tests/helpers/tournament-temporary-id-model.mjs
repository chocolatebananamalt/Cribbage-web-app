// TEST-ONLY reference transaction model, not app persistence/PostgreSQL acceptance.
export function temporaryRegistryModel(){
 const states=new Map(),locks=new Map();const state=t=>{if(!states.has(t))states.set(t,{next:1,assignments:new Map(),operations:new Map()});return states.get(t)};
 async function transaction(t,fn){const prior=locks.get(t)??Promise.resolve();let release;const held=new Promise(r=>release=r);locks.set(t,prior.then(()=>held));await prior;try{return await fn(state(t))}finally{release()}}
 function allocateLocked(s,subject){if(s.assignments.has(subject))return s.assignments.get(subject);if(s.next>2147483647)throw Error('exhausted');const n=s.next++;s.assignments.set(subject,n);return n;}
 async function allocate(t,subject){return transaction(t,s=>allocateLocked(s,subject))}
 async function create(t,key,subject,payload){return transaction(t,s=>{if(s.operations.has(key)){const old=s.operations.get(key);if(old.payload!==payload)throw Error('idempotency_conflict');return old.ordinal}const ordinal=allocateLocked(s,subject);s.operations.set(key,{subject,payload,ordinal});return ordinal})}
 return{allocate,create,retained:(t,s)=>state(t).assignments.get(s),count:()=>[...states.values()].reduce((n,s)=>n+s.assignments.size,0),operationCount:()=>[...states.values()].reduce((n,s)=>n+s.operations.size,0)};
}
