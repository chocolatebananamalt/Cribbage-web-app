/** Explicit addon receipt-stream contract; legacy roster stream identity is unchanged. */
export type MainPoolReceiptBindingV3={kind:'main-receipt-partitions-v3';mainEventId:string;ownershipRevisionId:string;ownershipSourceDigest:string;allocationId:string;membershipVersionId:string;entryDigest:string;mainBaseFeeMinor:number;qAllocatedMinor:number};
export type ConsyAddonBindingV1={sourceId:string;chargeId:string;eventId:string;rosterEntryId:string;scopeId:string;mainEventId:string;baseReceiptId:string;setupEventVersionId:string;mainPoolBinding?:MainPoolReceiptBindingV3};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export const consyAddonSourceKindV1='native-event-ledger-sources-consolation-addons-v1';
export const poolAwareConsySourceKindV3='native-event-ledger-sources-pool-aware-consolation-addons-v3';
export function readMainPoolReceiptBindingV3(v:unknown,mainId:string,baseAmount:unknown,expectedFee?:unknown):MainPoolReceiptBindingV3|null{
 if(!exact(v,['kind','mainEventId','ownershipRevisionId','ownershipSourceDigest','allocationId','membershipVersionId','entryDigest','mainBaseFeeMinor','qAllocatedMinor'])||v.kind!=='main-receipt-partitions-v3'||v.mainEventId!==mainId||![v.mainEventId,v.ownershipRevisionId,v.allocationId,v.membershipVersionId].every(uuid)||![v.ownershipSourceDigest,v.entryDigest].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x))||!Number.isSafeInteger(v.mainBaseFeeMinor)||(v.mainBaseFeeMinor as number)<=0||!Number.isSafeInteger(v.qAllocatedMinor)||(v.qAllocatedMinor as number)<0||!Number.isSafeInteger(baseAmount)||BigInt(v.mainBaseFeeMinor as number)+BigInt(v.qAllocatedMinor as number)!==BigInt(baseAmount as number)||expectedFee!==undefined&&v.mainBaseFeeMinor!==expectedFee)return null;
 return structuredClone(v)as MainPoolReceiptBindingV3;
}
export function readConsyAddonBindingsV1(current:unknown):ConsyAddonBindingV1[]|null{
 if(!object(current)||!object(current.facts))return null;const f=current.facts;
 if(current.kind==='native-event-ledger-sources-v1')return current.snapshotConsistency==='statement_snapshot'&&!Object.hasOwn(f,'addonBindings')?[]:null;
 if(![consyAddonSourceKindV1,poolAwareConsySourceKindV3].includes(String(current.kind))||current.snapshotConsistency!=='locked_source_snapshot'||!exact(f,['eventIds','pools','activationBindings','receiptEvents','expenseEvents','historyIds','existingOptionalAllocationEvidence','addonBindings'])||!Array.isArray(f.addonBindings)||!f.addonBindings.length||f.addonBindings.length>10000||!Array.isArray(f.receiptEvents)||!Array.isArray(f.historyIds)||!Array.isArray(f.activationBindings)||!Array.isArray(f.eventIds))return null;
 const keys=['sourceId','chargeId','eventId','rosterEntryId','scopeId','mainEventId','baseReceiptId','setupEventVersionId'];const ids=new Set<string>(),charges=new Set<string>(),eventRosters=new Set<string>(),baseMain=new Map<string,string>(),scopes=new Map<string,string>();const out:ConsyAddonBindingV1[]=[];
 for(const b of f.addonBindings){
  const pooled=object(b)&&Object.hasOwn(b,'mainPoolBinding');
  if(!exact(b,pooled?[...keys,'mainPoolBinding']:keys)||pooled&&current.kind!==poolAwareConsySourceKindV3||!keys.every(k=>uuid(b[k]))||ids.has(b.sourceId as string)||charges.has(b.chargeId as string)||eventRosters.has(String(b.eventId)+':'+String(b.rosterEntryId))||b.sourceId===b.chargeId||b.sourceId===b.baseReceiptId||b.eventId===b.mainEventId||!f.eventIds.includes(b.eventId)||!f.eventIds.includes(b.mainEventId))return null;
  const rows=f.receiptEvents.filter(r=>object(r)&&r.sourceId===b.sourceId),bases=f.receiptEvents.filter(r=>object(r)&&r.sourceId===b.baseReceiptId),hist=f.historyIds.filter(h=>object(h)&&h.sourceId===b.sourceId);
  const con=f.activationBindings.filter(a=>object(a)&&a.eventId===b.eventId),main=f.activationBindings.filter(a=>object(a)&&a.eventId===b.mainEventId);
  if(rows.length!==1||bases.length!==1||hist.length!==1||con.length!==1||main.length!==1)return null;
  const row=rows[0] as Record<string,unknown>,base=bases[0] as Record<string,unknown>,h=hist[0] as Record<string,unknown>,c=con[0] as Record<string,unknown>,m=main[0] as Record<string,unknown>;
  if(row.rosterEntryId!==b.rosterEntryId||base.rosterEntryId!==b.rosterEntryId||row.amountMinor!==c.entryFeeMinor||(pooled?!readMainPoolReceiptBindingV3(b.mainPoolBinding,b.mainEventId as string,base.amountMinor,m.entryFeeMinor):base.amountMinor!==m.entryFeeMinor)||c.setupEventVersionId!==b.setupEventVersionId||JSON.stringify(row.eligibleEventIds)!==JSON.stringify([b.eventId])||JSON.stringify(base.eligibleEventIds)!==JSON.stringify([b.mainEventId])||h.kind!=='consolation_addon_receipt'||h.ownerId!==b.chargeId||h.version!==1||h.state!=='received')return null;
  const scopeKey=JSON.stringify([b.eventId,b.mainEventId,b.setupEventVersionId]);if(scopes.has(b.scopeId as string)&&scopes.get(b.scopeId as string)!==scopeKey)return null;scopes.set(b.scopeId as string,scopeKey);
  if(baseMain.has(b.baseReceiptId as string)&&baseMain.get(b.baseReceiptId as string)!==b.mainEventId)return null;
  ids.add(b.sourceId as string);charges.add(b.chargeId as string);eventRosters.add(String(b.eventId)+':'+String(b.rosterEntryId));baseMain.set(b.baseReceiptId as string,b.mainEventId as string);out.push(structuredClone(b)as ConsyAddonBindingV1);
 }
 if(f.historyIds.filter(h=>object(h)&&h.kind==='consolation_addon_receipt').length!==out.length||current.kind===poolAwareConsySourceKindV3&&!out.some(x=>x.mainPoolBinding))return null;
 return out;
}
