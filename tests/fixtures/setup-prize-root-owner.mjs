export function assertRecoveryStorageOwner(actor){if(actor!==window.__scenario.actorId)throw Error('actor mismatch');}
export const claimRecoveryStorageOwner=assertRecoveryStorageOwner;
export const readRecoveryOwnerMarkers=()=>[window.__scenario.actorId];
export const ownerMarkersAllowActor=(markers,actor)=>markers.every(m=>m===actor);
export const isRecoveryActor=v=>typeof v==='string';
