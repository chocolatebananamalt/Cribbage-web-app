import { isUuid } from "./validation.ts";
import { isSetupOfficialRole, type SetupOfficialRole } from "./setup-officials.ts";

export type OfficialInvitationContext = { status: "pending" | "accepted"; nominationId: string; tournamentName: string; role: SetupOfficialRole; expiresAt: string };
export function isOfficialInvitationContext(value: unknown): value is OfficialInvitationContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 5 && (v.status === "pending" || v.status === "accepted") && typeof v.nominationId === "string" && isUuid(v.nominationId)
    && typeof v.tournamentName === "string" && v.tournamentName.trim().length > 0
    && typeof v.role === "string" && isSetupOfficialRole(v.role)
    && typeof v.expiresAt === "string" && Number.isFinite(Date.parse(v.expiresAt));
}

function exactReceipt(value:unknown,keys:string[]):value is Record<string,unknown>{if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==keys.length)return false;const descriptors=Object.getOwnPropertyDescriptors(value);return keys.every(k=>descriptors[k]&&'value'in descriptors[k]&&descriptors[k].enumerable);}
/** Canonical acceptance receipts, not current role/cohort/identity authority. */
export function isSetupOfficialAcceptance(value:unknown,nominationId?:string){return exactReceipt(value,['status','tournamentId','nominationId'])&&value.status==='official_accepted'&&isUuid(value.tournamentId)&&isUuid(value.nominationId)&&(nominationId===undefined||value.nominationId===nominationId);}
export function isLegacyCoDirectorAcceptance(value:unknown){return exactReceipt(value,['status','tournamentId','invitationId'])&&value.status==='co_director_accepted'&&isUuid(value.tournamentId)&&isUuid(value.invitationId);}
