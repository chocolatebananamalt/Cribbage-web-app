export const recoveryOwnerCookie = "acc_recovery_owner_v1";
export const offlineOwnerCookie = "acc_offline_score_owner";
const actorPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isRecoveryActor(value: unknown): value is string {
  return typeof value === "string" && actorPattern.test(value);
}
export function ownerMarkersAreKnown(markers: string[]): boolean {
  return markers.every(isRecoveryActor) && new Set(markers).size <= 1;
}
export function ownerMarkersAllowActor(markers: string[], actorId: string | undefined): boolean {
  return isRecoveryActor(actorId) && ownerMarkersAreKnown(markers) && markers.every(marker => marker === actorId);
}
export function readRecoveryOwnerMarkers(): string[] {
  return document.cookie.split(";").map(part => part.trim()).filter(part => part.startsWith(`${recoveryOwnerCookie}=`) || part.startsWith(`${offlineOwnerCookie}=`)).map(part => {
    try { return decodeURIComponent(part.slice(part.indexOf("=") + 1)); } catch { return "unknown"; }
  });
}
function writeOwner(value: string) {
  document.cookie = `${recoveryOwnerCookie}=${encodeURIComponent(value)}; Path=/; Max-Age=34560000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  if (!readRecoveryOwnerMarkers().includes(value)) throw new Error("recovery_owner_unavailable");
}
export function claimRecoveryStorageOwner(actorId: string | null) {
  if (!isRecoveryActor(actorId)) throw new Error("recovery_owner_unknown");
  const markers = readRecoveryOwnerMarkers();
  if (!ownerMarkersAllowActor(markers, actorId)) throw new Error("recovery_owner_conflict");
  if (!markers.length) writeOwner(actorId);
}
export function assertRecoveryStorageOwner(actorId: string | null) {
  if (!actorId || !ownerMarkersAllowActor(readRecoveryOwnerMarkers(), actorId)) throw new Error("recovery_owner_conflict");
}
/** Legacy pending records with no provable owner must never be reassigned. */
export function markUnknownRecoveryOwner() {
  if (!readRecoveryOwnerMarkers().length) writeOwner("unknown");
}
export function clearRecoveryStorageOwner() {
  for (const name of [recoveryOwnerCookie, offlineOwnerCookie]) document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  if (readRecoveryOwnerMarkers().length) throw new Error("recovery_owner_clear_unconfirmed");
}
