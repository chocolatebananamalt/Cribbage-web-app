import{localIdentityDisplayV2}from'../lib/registration/local-player-identity-v2';
import type{IdentityReadScopeV1}from'../lib/games/scorecard-identity-v1';
/** Normal profile/scorecard display deliberately has NO internal ID/debug attributes. */
export function LocalPlayerIdentityV2({value,scope,context='scorecard'}:{value:unknown;scope:IdentityReadScopeV1;context?:'profile'|'scorecard'}){
 const view=localIdentityDisplayV2(value,scope);if(!view)return <p role="status">Local player reference is unavailable. No number is invented.</p>;
 return <section aria-label={context==='profile'?'Local player profile':'Scorecard player reference'}><h3>{view.displayName}</h3><dl><dt>ACC/ZZ or local reference</dt><dd>{view.localNumber}</dd><dt>Membership</dt><dd>{view.membership==='nonmember'?'Nonmember':view.membership==='unknown'?'Unknown':'Unverified membership reference'}</dd></dl><p>Temporary IDs are for this tournament only and are excluded from ACC preparation exports. A supplied number does not prove ACC acceptance or an MRP award.</p>{view.joiningStatus==='claimed_pending'&&<p>Same-day joining claimed; ACC review is pending.</p>}</section>;
}
