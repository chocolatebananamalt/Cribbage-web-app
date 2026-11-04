import { isUuid } from "./validation.ts";
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const digest = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const version = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v < 256;
type EventRequest={sourceDigest:string;reason:string;reviewed:true};
export type AccountingAction = {action:"crosscheck";operationId:string;eventId:string;request:EventRequest} | {action:"draft";operationId:string;eventId:string;request:EventRequest & {expectedVersion:number}} | {action: "finalize"; operationId: string; request: {jointDigest: string; reason: string; reviewed: true}};
export function isAccountingAction(v: unknown): v is AccountingAction {
  if (!object(v) || !isUuid(v.operationId) || !object(v.request)) return false;
  const r = v.request;
  if (r.reviewed !== true || typeof r.reason !== "string" || r.reason !== r.reason.trim() || r.reason.length > 500 || !r.reason.startsWith("TEST ONLY SYNTHETIC: ") || !r.reason.slice(21).trim() || /[\u0000-\u001f\u007f]/.test(r.reason)) return false;
  if (v.action === "finalize") return exact(v,["action","operationId","request"]) && exact(r,["jointDigest","reason","reviewed"]) && digest(r.jointDigest);
  return (v.action === "crosscheck" || v.action === "draft") && exact(v,["action","operationId","eventId","request"]) && isUuid(v.eventId) && digest(r.sourceDigest)
    && (v.action === "crosscheck" ? exact(r,["sourceDigest","reason","reviewed"]) : exact(r,["expectedVersion","sourceDigest","reason","reviewed"]) && version(r.expectedVersion));
}
export function acceptedAccountingAction(v: unknown, action: AccountingAction, tournamentId: string): boolean {
  if (!object(v) || v.moneyMoved !== false) return false;
  if (action.action === "crosscheck") return exact(v,["status","eventId","closureId","sourceDigest","reviewerProfileIds","humanReviewClaimed","physicalPlayClaimed","moneyMoved"])
    && v.status === "synthetic_event_crosscheck_closed" && v.eventId === action.eventId && isUuid(v.closureId) && v.sourceDigest === action.request.sourceDigest && v.humanReviewClaimed === false && v.physicalPlayClaimed === false
    && Array.isArray(v.reviewerProfileIds) && v.reviewerProfileIds.length > 0 && v.reviewerProfileIds.length <= 256 && v.reviewerProfileIds.every(isUuid) && new Set(v.reviewerProfileIds).size === v.reviewerProfileIds.length;
  if (action.action === "draft") return exact(v,["status","draftId","eventId","version","sourceDigest","moneyMoved","financialFinalized"])
    && v.status === "synthetic_unpaid_draft_saved" && v.eventId === action.eventId && isUuid(v.draftId) && v.version === Number(action.request.expectedVersion) + 1 && v.sourceDigest === action.request.sourceDigest && v.financialFinalized === false;
  if (action.action !== "finalize") return false;
  return exact(v,["status","tournamentId","jointFinalId","jointDigest","eventCount","moneyMoved","humanReviewClaimed","recordedAt"])
    && v.status === "synthetic_joint_unpaid_finalized" && v.tournamentId === tournamentId && isUuid(v.jointFinalId) && v.jointDigest === action.request.jointDigest && v.humanReviewClaimed === false
    && typeof v.eventCount === "number" && Number.isSafeInteger(v.eventCount) && v.eventCount === 2 && typeof v.recordedAt === "string" && Number.isFinite(Date.parse(v.recordedAt));
}
