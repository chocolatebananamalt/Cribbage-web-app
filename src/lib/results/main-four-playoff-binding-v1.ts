import "server-only";
import {createHash} from "node:crypto";
import {isUuid} from "../api/validation.ts";
import {isPlayoffOutcomeWorkspace} from "../api/playoff-outcome.ts";
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>isUuid(v)&&v===v.toLowerCase();
const version=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0&&Number(v)<=2147483647;
const digest=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical).join(",")}]`:v&&typeof v==="object"?`{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>`${JSON.stringify(k)}:${canonical(x)}`).join(",")}}`:JSON.stringify(v)??"null";

/** Consumes only an authorized private producer result, not a browser request.
 * SQL must verify immutable row/FK/receipt/hash/audit. JS binds that read to the
 * other supplied models; it does not establish provider or atomic currentness. */
export function readMainFourPlayoffBindingV1(value:unknown,scope:{tournamentId:string;eventId:string;qualificationResultVersionId:string;qualificationVersion:number},workspace:unknown):{sourceDigest:string}|null{
 if(![scope.tournamentId,scope.eventId,scope.qualificationResultVersionId].every(uuid)||!version(scope.qualificationVersion)
  ||!object(value)||!exact(value,["kind","status","tournamentId","eventId","qualificationHead","resultHead","receiptBinding","workspace","readOnly","publicAccessGranted","independentPlayEstablished","sourceDigest"])
  ||value.kind!=="main-four-playoff-binding-v1"||value.status!=="source_available"||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId
  ||value.readOnly!==true||value.publicAccessGranted!==false||value.independentPlayEstablished!==false||!digest(value.sourceDigest)
  ||!isPlayoffOutcomeWorkspace(value.workspace,scope.tournamentId,scope.eventId)||value.workspace.blocker!==null||value.workspace.legacyConflict||value.workspace.result===null
  ||canonical(value.workspace)!==canonical(workspace))return null;
 const q=value.qualificationHead,r=value.resultHead,receipt=value.receiptBinding,w=value.workspace;
 if(!object(q)||!exact(q,["resultVersionId","version"])||q.resultVersionId!==scope.qualificationResultVersionId||q.version!==scope.qualificationVersion
  ||!object(r)||!exact(r,["resultId","version","qualificationResultVersionId"])||!uuid(r.resultId)||!version(r.version)
  ||r.qualificationResultVersionId!==q.resultVersionId||r.resultId!==w.result!.resultId||r.version!==w.result!.version||r.version!==w.currentVersion||w.qualificationResultVersionId!==q.resultVersionId
  ||!object(receipt)||!exact(receipt,["receiptId","requestHash","accepted","auditMatched"])||!uuid(receipt.receiptId)||!digest(receipt.requestHash)||receipt.accepted!==true||receipt.auditMatched!==true)return null;
 // Include all captured content as well as the producer's Postgres digest.
 // Different JSON canonicalization means this is not a reimplementation of its hash.
 return{sourceDigest:createHash("sha256").update(canonical({version:"main-four-binding-content-v1",source:value})).digest("hex")};
}
