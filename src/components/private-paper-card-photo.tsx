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

const bucket = "paper-scorecards-private";

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function PrivatePaperCardPhoto({
  cardSide,
  disabled = false,
  gameId,
  inputId,
  label,
  tournamentId,
  verificationId,
}: {
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

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const validation = validateLocalCardPhoto(selected);
    if (!validation.accepted) {
      event.target.value = "";
      setMessage(validation.message);
      return;
    }
    setPreviewUrl(URL.createObjectURL(selected));
    setFile(selected);
    setCaptureRequest(null);
    setStored(false);
    setMessage("Photo selected. Store it privately before leaving this screen.");
  }

  function clearPreview() {
    const wasStored = stored;
    setPreviewUrl("");
    setFile(null);
    setCaptureRequest(null);
    setStored(false);
    setMessage(wasStored ? "The stored evidence remains in the private tournament record. You may attach another photo if needed." : "");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function storePhoto() {
    if (!file || busy || stored) return;
    setBusy(true);
    setMessage("Securing photo…");
    try {
      const envelope = captureRequest ?? {
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
      setCaptureRequest(envelope);

      const captureResponse = await fetch(`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/paper-card-captures`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const capture: unknown = await captureResponse.json().catch(() => null);
      if (!captureResponse.ok || !isPaperCardCaptureResult(capture, envelope)) {
        if (captureResponse.status === 409 && isRejectedPaperCardCapture(capture)) {
          setCaptureRequest(null);
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
        throw new Error("A private upload could not be authorized. Retry with this same photo.");
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
      setStored(true);
      setMessage("Private photo stored. Human review is still required; this photo cannot change scores or verify a game.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The private upload is unresolved. Retry with this same photo.");
    } finally {
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
      disabled={disabled || busy || stored}
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
