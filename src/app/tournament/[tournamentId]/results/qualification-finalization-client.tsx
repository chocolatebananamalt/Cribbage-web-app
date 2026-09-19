"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { isUuid } from "../../../../lib/api/validation";

const messages: Record<string, string> = {
  schedule_incomplete: "Every scheduled scorecard must be verified before qualification can be finalized.",
  scorecards_unresolved: "A scorecard mismatch or pending entry still needs resolution.",
  recovery_pending: "A device-recovery case still needs an independent decision.",
  correction_pending: "A score correction still needs its required decision.",
  qualification_notice_pending: "A qualification-changing correction still requires the official notice step.",
  ranking_tie_unresolved: "A ranking tie must be resolved under the approved tournament rules before finalization.",
  already_finalized: "Qualification has already been finalized.",
};
const rejectionCodes = new Set([
  "tournament_unavailable", "not_director", "event_unavailable", "already_finalized",
  "schedule_incomplete", "scorecards_unresolved", "recovery_pending", "correction_pending",
  "qualification_notice_pending", "ranking_tie_unresolved", "dispute_open", "cutoff_tied",
  "high_non_qualifier_tied", "idempotency_conflict", "invalid_request",
]);

type Envelope = { kind: "qualification-finalization"; idempotencyKey: string };

function readEnvelope(key: string): Envelope | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
    return value !== null && typeof value === "object" && !Array.isArray(value)
      && (value as Record<string, unknown>).kind === "qualification-finalization"
      && isUuid((value as Record<string, unknown>).idempotencyKey)
      && Object.keys(value).length === 2 ? value as Envelope : null;
  } catch { return null; }
}

function writeEnvelope(key: string, value: Envelope) {
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

function clearEnvelope(key: string) {
  try { window.sessionStorage.removeItem(key); } catch { /* The server result remains authoritative. */ }
}

function isRejectedFinalization(value: unknown, eventId: string): value is { status: "rejected"; code: string; eventId: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).sort().join(",") === "code,eventId,status" && item.status === "rejected"
    && item.eventId === eventId && typeof item.code === "string" && rejectionCodes.has(item.code);
}

async function isFinalized(tournamentId: string, eventId: string) {
  try {
    const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/qualification-finalization`, {
      credentials: "same-origin", cache: "no-store",
    });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    return !!body && typeof body === "object" && !Array.isArray(body)
      && (body as Record<string, unknown>).status === "qualification_finalized"
      && (body as Record<string, unknown>).eventId === eventId;
  } catch { return false; }
}

export function QualificationFinalizationClient({ actorId, tournamentId, eventId, canFinalize, blockedReason }: {
  actorId: string; tournamentId: string; eventId: string; canFinalize: boolean; blockedReason: string | null;
}) {
  const router = useRouter();
  const storageKey = `qualification-finalization:${actorId}:${eventId}`;
  const [pending, setPending] = useState(false);
  const [locked, setLocked] = useState<Envelope | null>(null);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const saved = readEnvelope(storageKey);
      if (!saved) return;
      if (await isFinalized(tournamentId, eventId)) {
        clearEnvelope(storageKey);
        if (active) router.refresh();
        return;
      }
      if (active) {
        setLocked(saved);
        setMessage("A prior finalization request may have reached the server. Retry uses the same protected request until its outcome is confirmed.");
      }
    })();
    return () => { active = false; };
  }, [eventId, router, storageKey, tournamentId]);

  async function finalize() {
    if (!canFinalize || pending || inFlight.current) return;
    const envelope = locked ?? { kind: "qualification-finalization" as const, idempotencyKey: crypto.randomUUID() };
    if (!locked && !writeEnvelope(storageKey, envelope)) {
      setMessage("This browser cannot safely retain the finalization request. Enable session storage before continuing.");
      return;
    }
    setLocked(envelope); inFlight.current = true; setPending(true); setMessage("");
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/qualification-finalization`, {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ idempotencyKey: envelope.idempotencyKey }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (response.ok && body && typeof body === "object" && !Array.isArray(body)
          && (body as Record<string, unknown>).status === "qualification_finalized") {
        clearEnvelope(storageKey); setLocked(null); router.refresh(); return;
      }
      if (response.status === 409 && isRejectedFinalization(body, eventId)) {
        const code = body.code;
        if (code === "already_finalized" && await isFinalized(tournamentId, eventId)) {
          clearEnvelope(storageKey); setLocked(null); router.refresh(); return;
        }
        clearEnvelope(storageKey); setLocked(null);
        setMessage(messages[code] ?? "Qualification could not be finalized. Review the event and try again.");
        return;
      }
      setMessage("The finalization outcome is not yet confirmed. Retry will safely use the same protected request.");
    } catch {
      setMessage("The connection was interrupted and the outcome is not yet confirmed. Retry will safely use the same protected request.");
    } finally { inFlight.current = false; setPending(false); }
  }

  return <section className="correction-item" aria-labelledby="finalize-qualification-title">
    <h2 id="finalize-qualification-title">Finalize Qualification</h2>
    <p>This locks the completed qualifying-round ranking and qualifier list. It does not decide playoff placements or calculate money or MRPs.</p>
    <button className="primary-action" type="button" disabled={!canFinalize || pending} onClick={finalize}>
      {pending ? "Finalizing…" : locked ? "Retry Finalization" : "Finalize Qualification"}
    </button>
    {!canFinalize ? <p className="auth-note">{blockedReason ?? "Resolve every completion notice and ranking tie before finalizing."}</p> : null}
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </section>;
}
