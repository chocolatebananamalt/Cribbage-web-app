import {isPaymentWorkspace} from '../api/payment.ts';
export const receiptEvidenceExportEnabledV32=()=>false;
const notice='Private receipt evidence only; not reconciliation, paid-in-full, check-in, payout approval or ACC submission. Amounts are unsigned evidence, not net totals. Do not sum receipt and void rows. Notes, reasons, internal IDs and recorder names are omitted. Snapshot row numbers are not player IDs. Leading apostrophes protect spreadsheet text; source records are unchanged.';
const exact=(x:object,keys:string[])=>Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const usable=(s:string)=>!!s.trim()&&s.length<=200&&!/[\u0000-\u001f\u007f]|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|temporary\s*id\s*#\s*\d+/i.test(s.normalize('NFKC'));
const cell=(s:string)=>'"'+(/^[\s]*[=+\-@]/.test(s.normalize('NFKC'))?"'"+s:s).replaceAll('"','""')+'"';
const amount=(n:number)=>Math.trunc(n/100)+'.'+String(n%100).padStart(2,'0');
/** Whitelist-only evidence copy. Never computes a balance, liability, refund,
 * paid flag, event allocation or payout; duplicate names stay separate. */
export function buildReceiptEvidenceCsvV32(raw:unknown,capturedAt:string):string|null {try{
 if(!isPaymentWorkspace(raw)||!exact(raw,['rosterEntries'])||raw.rosterEntries.length>10000||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(capturedAt)||new Date(capturedAt).toISOString()!==capturedAt)return null;
 const rosterIds=new Set<string>(),eventIds=new Set<string>(),rows:string[][]=[];let entries=0;
 for(const [index,r] of raw.rosterEntries.entries()){
  if(!exact(r,['rosterEntryId','displayName','plannedPaymentMethod','paymentVersion','paymentState','currentReceiptEventId','history'])||!usable(r.displayName)||rosterIds.has(r.rosterEntryId.toLowerCase())||!Number.isSafeInteger(r.paymentVersion)||r.history.length>5000)return null;rosterIds.add(r.rosterEntryId.toLowerCase());
  if(r.history.length===0)rows.push([String(index+1),r.displayName,'0','unrecorded','', '', '', '', '', 'no']);
  for(const [n,h] of r.history.entries()){
   if(!exact(h,['paymentEventId','version','eventType','amountMinor','currencyCode','paymentMethod','paymentReceivedAt','paymentVoidedAt','receiptNote','voidReason','recorderDisplayName','recordedAt'])||eventIds.has(h.paymentEventId.toLowerCase())||!Number.isSafeInteger(h.amountMinor)||h.amountMinor<1||h.amountMinor>2147483647||++entries>50000)return null;eventIds.add(h.paymentEventId.toLowerCase());
   for(const stamp of [h.paymentReceivedAt,h.paymentVoidedAt,h.recordedAt])if(stamp!==null&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(stamp)||!Number.isFinite(Date.parse(stamp))))return null;
   if(h.eventType==='voided'){const prior=r.history[n+1];if(!prior||prior.eventType!=='received'||h.amountMinor!==prior.amountMinor||h.paymentMethod!==prior.paymentMethod||h.paymentReceivedAt!==prior.paymentReceivedAt)return null;}
   rows.push([String(index+1),r.displayName,String(h.version),h.eventType,amount(h.amountMinor),h.paymentMethod,h.paymentReceivedAt,h.paymentVoidedAt??'',h.recordedAt,h.paymentEventId===r.currentReceiptEventId?'yes':'no']);
  }
 }
 const lines=[[notice],['Prepared at (device clock, not server audit time)',capturedAt],['Snapshot row','Player display name','History version','Evidence type','Evidence amount USD (unsigned)','Recorded method','Received at (recorded offset)','Voided at (recorded offset)','Recorded at (recorded offset)','Current receipt at capture'],...rows];
 return '\ufeff'+lines.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
 }catch{return null;}}
