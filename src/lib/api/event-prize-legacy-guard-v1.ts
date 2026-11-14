import {isEventPrizeSettingsSnapshotV1,isEventPrizeWireValueV1} from './event-prize-settings-v1.ts';
const writers=['setup-v1','linked-setup-v1','custom-q-v2','event-settings-v3','custom-pool-v4'] as const;
/** Pure compatibility barrier, not authorization or proof of database absence.
 * The future DB reader must inspect current head AND immutable history under
 * the same lock used by the actual old writer. It never deletes old work. */
export function assessEventPrizeLegacyWriterV1(writer:unknown,presence:unknown){
 const blocked=(code:string)=>({status:'blocked' as const,code,legacyWriteBlocked:true as const,authorizationGranted:false as const,databaseReadRequired:true as const,moneyMoved:false as const});
 if(!writers.includes(writer as typeof writers[number])||!isEventPrizeWireValueV1(presence)||!presence||typeof presence!=='object'||Array.isArray(presence))return blocked('unrecognized_writer_or_source');
 const p=presence as Record<string,unknown>;if(Object.keys(p).length!==3||!['state','historyExists','snapshot'].every(k=>Object.hasOwn(p,k)))return blocked('invalid_prize_presence');
 if(p.state==='absent'&&p.historyExists===false&&p.snapshot===null)return{status:'not_applicable' as const,legacyWriteBlocked:false as const,authorizationGranted:false as const,databaseReadRequired:true as const,moneyMoved:false as const};
 if(p.state==='present'&&p.historyExists===true&&isEventPrizeSettingsSnapshotV1(p.snapshot))return blocked('versioned_prize_save_required');
 return blocked('prize_presence_unproven');
}
