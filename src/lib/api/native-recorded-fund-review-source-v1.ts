import 'server-only';
import {readNativeRecordedFundReviewSourceV1} from '../finance/native-recorded-fund-review-source-v1.ts';
import {projectNativeFinalRecipientEstimateV1} from '../finance/native-playoff-recipient-v1.ts';
/** Server-only strengthening: full existing native game/recipient proof, not a
 * browser-provided shape, is required before exposing the review preparation. */
export function readNativeRecordedFundReviewSourceServerV1(value:unknown,scope:{actorId:string;tournamentId:string;eventId:string}){
 const source=readNativeRecordedFundReviewSourceV1(value,scope);
 if(!source||projectNativeFinalRecipientEstimateV1(source.recipientSource,scope).status!=='recipient_estimate')return null;
 return source;
}
