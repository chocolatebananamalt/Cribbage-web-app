"use client";
import { useEffect, useState } from "react";
import { listPendingPhotos, type PendingPhotoCapture } from "../lib/paper-games/photo-retry-envelope";
import { PrivatePaperCardPhoto } from "./private-paper-card-photo";

/** Retained uploads stay reachable even after their game leaves candidate lists. */
export function PendingPaperCardPhotos({ actorId, tournamentId }: { actorId: string; tournamentId: string }) {
  const [entries, setEntries] = useState<PendingPhotoCapture[]>([]);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setEntries(listPendingPhotos(window.sessionStorage, actorId, tournamentId)); }
      catch { setBlocked(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [actorId, tournamentId]);
  return <>{blocked ? <p className="error-text" role="status">A retained photo request cannot be safely read. Keep this account and its recovery work intact.</p> : null}{entries.length ? <section><h2>Unresolved private photo uploads</h2><p>Reselect each original image to reconcile its retained request. Image bytes are not saved on this device. Nothing is uploaded automatically.</p>{entries.map(({ request }) => <PrivatePaperCardPhoto key={request.idempotencyKey} actorId={actorId} tournamentId={tournamentId} gameId={request.gameId} cardSide={request.cardSide} verificationId={request.verificationId} inputId={`retained-photo-${request.idempotencyKey}`} label="Retained" recoveryOnly />)}</section> : null}</>;
}
