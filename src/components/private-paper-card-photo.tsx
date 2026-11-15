"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useRef, useState } from "react";

import {
  isPaperCardCaptureResult,
  isRejectedPaperCardCapture,
  type PaperCardCaptureRequest,
} from "../lib/api/paper-card-capture";
import {
  isPaperCardUploadAuthorization,
  isPaperCardUploadCompletion,
  type PaperCardUploadRequest,
} from "../lib/api/paper-card-upload";
import { validateLocalCardPhoto } from "../lib/paper-games/local-card-photo";
import { createClient } from "../lib/supabase/client";
import { clearConfirmedPhoto, photoMatchesPending, photoRejectionIsTerminal, readPendingPhoto, retainPendingPhoto } from "../lib/paper-games/photo-retry-envelope";

const bucket = "paper-scorecards-private";

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function PrivatePaperCardPhoto({
  actorId,
  recoveryOnly = false,
  cardSide,
  disabled = false,
  gameId,
  inputId,
  label,
  tournamentId,
  verificationId,
}: {
  actorId: string;
  recoveryOnly?: boolean;
  cardSide: "a" | "b";
  disabled?: boolean;
  gameId: string;
  inputId: string;
  label: string;
  tournamentId: string;
  verificationId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [captureRequest, setCaptureRequest] = useState<PaperCardCaptureRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [stored, setStored] = useState(false);
  const [message, setMessage] = useState("");
  const [readyScope, setReadyScope] = useState("");
  const busyRef = useRef(false);
  const selectionRef = useRef(0);
  const scope = { actorId, tournamentId, gameId, cardSide, verificationId };
  const scopeIdentity = JSON.stringify(scope);
  const recoveryReady = readyScope === scopeIdentity;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const pending = readPendingPhoto(window.sessionStorage, { actorId, tournamentId, gameId, cardSide, verificationId });
        if (recoveryOnly && !pending) { setMessage("This retained photo request was already resolved. No replacement upload will be started here."); return; }
        setCaptureRequest(pending?.request ?? null);
        setReadyScope(JSON.stringify({ actorId, tournamentId, gameId, cardSide, verificationId }));
        if (pending) setMessage("An earlier photo upload is unresolved. Reselect the same image to retry its original request. No image is saved on this device.");
      } catch {
        setMessage("The retained photo request cannot be safely read. Keep this account and recovery work intact; do not attach a replacement photo.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [actorId, tournamentId, gameId, cardSide, verificationId, recoveryOnly]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected || !recoveryReady || busyRef.current) return;
    const selection = ++selectionRef.current;
    const validation = validateLocalCardPhoto(selected);
    if (!validation.accepted) {
      event.target.value = "";
      setMessage(validation.message);
      return;
    }
    try {
      const pending = readPendingPhoto(window.sessionStorage, scope);
      if (pending && !photoMatchesPending(pending.request, selected, await sha256Hex(selected))) {
        event.target.value = "";
        setMessage("This is a different image. Reselect the original image; its unresolved upload must be reconciled before attaching another photo.");
        return;
      }
      if (selection !== selectionRef.current) return;
      setPreviewUrl(URL.createObjectURL(selected));
      setFile(selected);
      setCaptureRequest(pending?.request ?? null);
      setStored(false);
      setMessage(pending ? "Original image matched. Press Store private photo to retry the retained request." : "Photo selected. Store it privately before leaving this screen.");
    } catch {
      setMessage("Photo recovery is unavailable. Keep this screen and account open; no new upload was sent.");
    }
  }

  function clearPreview() {
    const wasStored = stored;
    setPreviewUrl("");
    setFile(null);
    // Removing a preview must never discard unresolved server work.
    setStored(false);
    setMessage(wasStored ? "The stored evidence remains in the private tournament record. You may attach another photo if needed." : captureRequest ? "The upload request is still retained. Reselect the original image to retry; no image bytes are saved locally." : "");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function storePhoto() {
    if (!file || busyRef.current || stored || !recoveryReady) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("Securing photo…");
    try {
      const retained = readPendingPhoto(window.sessionStorage, scope);
      if (recoveryOnly && !retained) throw new Error("This retained photo request is already resolved. No replacement upload was sent.");
      const envelope = retained?.request ?? captureRequest ?? {
        gameId,
        cardSide,
        verificationId,
        sourceKind: "file_upload",
        originalFileName: file.name,
        declaredMediaType: file.type as PaperCardCaptureRequest["declaredMediaType"],
        declaredByteSize: file.size,
        declaredSha256: await sha256Hex(file),
        clientCapturedAt: null,
        idempotencyKey: crypto.randomUUID(),
      } satisfies PaperCardCaptureRequest;
      if (!photoMatchesPending(envelope, file, await sha256Hex(file))) throw new Error("Reselect the original image to reconcile this upload; a different photo cannot replace an unresolved request.");
      retainPendingPhoto(window.sessionStorage, scope, envelope);
      setCaptureRequest(envelope);

      const captureResponse = await fetch(`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/paper-card-captures`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const capture: unknown = await captureResponse.json().catch(() => null);
      if (!captureResponse.ok || !isPaperCardCaptureResult(capture, envelope)) {
        if (captureResponse.status === 409 && isRejectedPaperCardCapture(capture) && photoRejectionIsTerminal(capture)) {
          clearConfirmedPhoto(window.sessionStorage, scope, envelope);
          setCaptureRequest(null);
          setFile(null);
          setPreviewUrl("");
          if (inputRef.current) inputRef.current.value = "";
          if (recoveryOnly) setReadyScope("");
          throw new Error("This photo cannot be attached to that card. Refresh the game and verify the player ID.");
        }
        throw new Error("The private capture request is unresolved. Retry with this same photo.");
      }

      const uploadRequest: PaperCardUploadRequest = {
        uploadIntentId: capture.uploadIntentId,
        objectReferenceId: capture.objectReferenceId,
      };
      const uploadResponse = await fetch(`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/paper-card-captures/${encodeURIComponent(capture.captureId)}/upload`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(uploadRequest),
      });
      const authorization: unknown = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok || !isPaperCardUploadAuthorization(authorization, capture.captureId, uploadRequest)) {
        // Existing storage receipts deliberately prevent issuing a new signed
        // upload. A prior successful completion with a lost response must still
        // reconcile through the supported integrity-checked completion route.
        const response = await fetch(`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/paper-card-captures/${encodeURIComponent(capture.captureId)}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(uploadRequest) });
        const completion: unknown = await response.json().catch(() => null);
        if (response.ok && isPaperCardUploadCompletion(completion, capture.captureId)) {
          clearConfirmedPhoto(window.sessionStorage, scope, envelope);
          setCaptureRequest(null); setStored(true);
          if (recoveryOnly) setReadyScope("");
          setMessage("Private photo stored. Human review is still required; this photo cannot change scores or verify a game.");
          return;
        }
        throw new Error("The private upload is not confirmed. Keep this account open and retry the same image; its original request is retained.");
      }

      const supabase = createClient();
      const upload = await supabase.storage.from(bucket).uploadToSignedUrl(
        authorization.objectPath,
        authorization.token,
        file,
        { contentType: authorization.mediaType, upsert: false },
      );
      if (upload.error) {
        // A lost browser response can leave a valid object in storage. The server-side
        // completion check below is the authoritative reconciliation step.
        setMessage("Checking whether the private upload completed…");
      }

      const completeResponse = await fetch(`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/paper-card-captures/${encodeURIComponent(capture.captureId)}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(uploadRequest),
      });
      const completion: unknown = await completeResponse.json().catch(() => null);
      if (!completeResponse.ok || !isPaperCardUploadCompletion(completion, capture.captureId)) {
        throw new Error("The stored photo is not yet confirmed. Keep this screen open and retry with the same photo.");
      }
      clearConfirmedPhoto(window.sessionStorage, scope, envelope);
      setStored(true);
      setCaptureRequest(null);
      if (recoveryOnly) setReadyScope("");
      setMessage("Private photo stored. Human review is still required; this photo cannot change scores or verify a game.");
    } catch (error) {
      setMessage(error instanceof TypeError ? "The private photo upload is not confirmed. Keep this account open and retry the same image. If you reload, reselect that image to reuse the retained request." : error instanceof Error ? error.message : "The private upload is unresolved. Retry with this same photo.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return <div className="local-card-photo">
    <label htmlFor={inputId}>{previewUrl ? "Replace photo" : "Take or choose a photo"}</label>
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      disabled={disabled || busy || stored || !recoveryReady}
      onChange={selectPhoto}
    />
    <p className="auth-note">Optional evidence. JPEG, PNG, or WebP up to 10 MB. Stored privately with the tournament record.</p>
    {previewUrl ? <div className="local-card-photo-preview">
      <Image src={previewUrl} width={720} height={960} unoptimized alt={`${label} paper scorecard photo`} />
      <p>{file?.name}</p>
      {!stored ? <button className="secondary" type="button" disabled={disabled || busy} onClick={storePhoto}>{busy ? "Storing privately…" : "Store private photo"}</button> : null}
      <button className="secondary" type="button" disabled={busy} onClick={clearPreview}>Clear preview</button>
    </div> : null}
    {message ? <p className="auth-note" role="status">{message}</p> : null}
  </div>;
}
