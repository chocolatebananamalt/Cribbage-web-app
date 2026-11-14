// Test-only in-memory storage/account port. No browser storage/cookie/backend.
const bridge=()=>window as unknown as {__fixtureActor:string;__fixtureWritesAllowed:boolean};
export function assertRecoveryStorageOwner(actorId:string){if(bridge().__fixtureActor!==actorId)throw Error('fictional_actor_changed');}
export function assertRecoveryWriteAllowed(){if(!bridge().__fixtureWritesAllowed)throw Error('fictional_write_blocked');}
export function setAppRecoveryItem(storage:Storage,key:string,value:string){assertRecoveryWriteAllowed();if(!key.startsWith('prize-context-review:'))throw Error('unexpected_key');storage.setItem(key,value);}
