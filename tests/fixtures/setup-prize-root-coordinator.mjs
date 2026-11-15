export function setAppRecoveryItem(storage,key,value){assertRecoveryWriteAllowed();storage.setItem(key,value);}
export async function trackAppRecoveryWrite(operation){return operation();}
export function assertRecoveryWriteAllowed(){if(window.__blockRecovery)throw Error('Fictional coordinator blocked');}
export function compareAndReplaceAppRecoveryItem(storage,key,expected,next){if(storage.getItem(key)!==expected)return false;if(next===null)storage.removeItem(key);else storage.setItem(key,next);return true;}
