"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useRef, useState } from "react";

import { validateLocalCardPhoto } from "../lib/paper-games/local-card-photo";

export function LocalPaperCardPhoto({
  disabled = false,
  inputId,
  label,
}: {
  disabled?: boolean;
  inputId: string;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validation = validateLocalCardPhoto(file);
    if (!validation.accepted) {
      event.target.value = "";
      setMessage(validation.message);
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setMessage("");
  }

  function removePhoto() {
    setPreviewUrl("");
    setFileName("");
    setMessage("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return <div className="local-card-photo">
    <label htmlFor={inputId}>{previewUrl ? "Replace photo" : "Take or choose a photo"}</label>
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      disabled={disabled}
      onChange={selectPhoto}
    />
    <p className="auth-note">Optional visual aid. The photo stays on this device and is not uploaded.</p>
    {message ? <p className="error-text" role="alert">{message}</p> : null}
    {previewUrl ? <div className="local-card-photo-preview">
      <Image
        src={previewUrl}
        width={720}
        height={960}
        unoptimized
        alt={`${label} paper scorecard photo`}
      />
      <p>{fileName}</p>
      <button className="secondary" type="button" disabled={disabled} onClick={removePhoto}>Remove photo</button>
    </div> : null}
  </div>;
}
