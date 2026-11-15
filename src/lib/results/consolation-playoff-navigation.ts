import {isUuid} from '../api/validation.ts';
/** Navigation only; the destination independently verifies role and current sources. */
export function consolationPlayoffEntry(input:{tournamentId:string;eventId:string;role:string;eventType:string;format:string;qualifierCount:number;syntheticEventIds:readonly string[]}):string|null {
 if(!isUuid(input.tournamentId)||!isUuid(input.eventId)||!['director','co_director'].includes(input.role)||input.eventType!=='consolation'||input.format!=='standard_singles'||input.qualifierCount!==4||!input.syntheticEventIds.includes(input.eventId))return null;
 return `/tournament/${input.tournamentId}/events/${input.eventId}/consolation-playoffs`;
}
