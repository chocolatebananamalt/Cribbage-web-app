import{projectScorecardIdentityV1,type IdentityBindingV1,type IdentityReadScopeV1}from'../lib/games/scorecard-identity-v1';
import type{IdentityReceiptV1}from'../lib/registration/nonmember-identity-v1';
export function ScorecardIdentityV1({receipt,binding,scope}:{receipt:IdentityReceiptV1;binding:IdentityBindingV1;scope:IdentityReadScopeV1}){
 const v=projectScorecardIdentityV1(receipt,binding,scope);if(!v||/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(`${v.firstName} ${v.lastName}`))return <p role="status">Player identity readback is unavailable. No membership status is inferred.</p>;
 return <section aria-label="Saved scorecard identity"><p>{v.firstName} {v.lastName}</p><dl><dt>ACC/ZZ reference</dt><dd>{v.label}</dd><dt>Membership</dt><dd>{v.membership==='nonmember'?'Nonmember':v.membership==='unknown'?'Unknown':'Unverified reference'}</dd><dt>Same-day joining</dt><dd>{v.joiningStatus==='claimed_pending'?'Claimed — pending ACC review':'No claim recorded'}</dd></dl><p>Hypothetical MRPs do not establish an official award or ACC acceptance.</p></section>;
}
