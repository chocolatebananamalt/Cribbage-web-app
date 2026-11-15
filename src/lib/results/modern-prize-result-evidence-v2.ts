import 'server-only';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
/** Explicit read-observer paths only. Never recursively drop actor/digest keys:
 * persisted review, intent, game-action and confirmation identities are evidence. */
export function modernPrizeFundResultEvidenceV2(value:unknown){
 if(!object(value)||!object(value.recipientSource)||!object(value.recipientSource.nativeFinanceSource))return null;
 const out=structuredClone(value),recipient=out.recipientSource as Record<string,unknown>,finance=recipient.nativeFinanceSource as Record<string,unknown>;
 delete out.actorId;delete out.sourceDigest;delete recipient.actorId;delete recipient.sourceDigest;delete finance.actorId;
 return out;
}
export function modernPrizeWorkspaceResultEvidenceV2(value:unknown){
 if(!object(value)||!object(value.nativeSource))return null;
 const out=structuredClone(value),native=out.nativeSource as Record<string,unknown>;
 delete out.actorId;delete native.actorId;delete native.sourceDigest;
 return out;
}
