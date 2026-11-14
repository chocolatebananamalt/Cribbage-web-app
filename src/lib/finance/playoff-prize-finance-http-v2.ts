import {createFinanceJsonHttpV1} from './finance-provider-json-http-v1.ts';
import {readPlayoffPrizeBrowserPreparedV2,type PlayoffPrizeBrowserScopeV2} from '../api/playoff-prize-proposal-browser-v2.ts';
import type {PlayoffPrizeBrowserPortV2} from './playoff-prize-finance-operation-v2.ts';
/** Default-off, fixed-account transport. Provider independently authenticates;
 * this header asserts the expected account, not authority. No automatic retry. */
export function createPlayoffPrizeFinanceHttpV2(scope:PlayoffPrizeBrowserScopeV2,options:{enabled?:()=>boolean;fetch?:typeof globalThis.fetch}={}):PlayoffPrizeBrowserPortV2{
 const fixed=Object.freeze(structuredClone(scope));if(Object.keys(fixed).length!==3||!Object.values(fixed).every(x=>/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x)))throw Error('invalid_scope');
 const base=`/api/v1/tournaments/${fixed.tournamentId}/events/${fixed.eventId}/prize-proposal`,send=createFinanceJsonHttpV1({...options,expectedActorId:fixed.actorId});
 const request=async(prepared:Parameters<PlayoffPrizeBrowserPortV2['save']>[0],suffix:string)=>{const parsed=await readPlayoffPrizeBrowserPreparedV2(prepared,fixed);if(!parsed)throw Error('invalid_prepared_request');return send(base+suffix,parsed.request);};
 return{workspace:()=>send(base),save:prepared=>request(prepared,''),recover:prepared=>request(prepared,'/operation')};
}
