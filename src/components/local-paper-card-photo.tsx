"use client";

import Image from "next/image";
import { ChangeEvent, useLayoutEffect, useRef, useState } from "react";

import { validateLocalCardPhoto } from "../lib/paper-games/local-card-photo";

export function LocalPaperCardPhoto({
  disabled = false,
  inputId,
  label,
  permitted,
  subscribeRevocation,
  onSelectionChange,
}: {
  disabled?: boolean;
  inputId: string;
  label: string;
  /** Optional trusted-host admission. Never establishes score/player authority. */
  permitted?: () => boolean;
  /** Revocation closes this instance; a fresh owned scope must remount it. */
  subscribeRevocation?: (revoke: () => void) => () => void;
  /** Local selection state only; never exposes image bytes or a remote URL. */
  onSelectionChange?: (selected:boolean) => void;
}) {
  const regionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrl = useRef("");
  const alive = useRef(false);
  const revoked = useRef(false);
  const latest = useRef<object | null>(null);
  const lease = {disabled,inputId,label,permitted,subscribeRevocation,onSelectionChange};
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [hidden,setHidden] = useState(false);

  useLayoutEffect(() => {latest.current=lease;return()=>{if(latest.current===lease)latest.current=null;};});
  useLayoutEffect(() => {
    alive.current=true;
    const clear=()=>{if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current="";if(inputRef.current)inputRef.current.value="";};
    const revoke=()=>{revoked.current=true;latest.current=null;clear();if(regionRef.current)regionRef.current.hidden=true;if(alive.current){setHidden(true);setPreviewUrl("");setFileName("");setMessage("");}};
    const unsubscribe=subscribeRevocation?.(revoke);
    window.addEventListener('pagehide',revoke);
    return()=>{alive.current=false;latest.current=null;unsubscribe?.();window.removeEventListener('pagehide',revoke);clear();};
  },[subscribeRevocation]);
  function current(){try{return alive.current&&!revoked.current&&latest.current===lease&&!disabled&&(!permitted||permitted()===true);}catch{return false;}}

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    if(!current()||event.currentTarget!==inputRef.current)return;
    const file = event.target.files?.[0];
    if (!file) return;
    const validation = validateLocalCardPhoto(file);
    if (!validation.accepted) {
      if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);
      objectUrl.current="";setPreviewUrl("");setFileName("");
      event.target.value = "";
      setMessage(validation.message);
      onSelectionChange?.(false);
      return;
    }
    let next:string;try{next=URL.createObjectURL(file);}catch{setMessage("The local photo could not be opened.");return;}
    if(!current()){URL.revokeObjectURL(next);return;}
    if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);
    objectUrl.current=next;
    setPreviewUrl(next);
    setFileName(file.name);
    setMessage("");
    onSelectionChange?.(true);
  }

  function removePhoto() {
    if(!current())return;
    if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);
    objectUrl.current="";
    setPreviewUrl("");
    setFileName("");
    setMessage("");
    if (inputRef.current) inputRef.current.value = "";
    onSelectionChange?.(false);
  }

  return <div ref={regionRef} className="local-card-photo" hidden={hidden}>
    <label htmlFor={inputId}>{previewUrl ? "Replace Photo" : "Take or Choose a Photo"}</label>
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      disabled={disabled}
      onChange={selectPhoto}
    />
    <p className="auth-note">Optional visual aid. The photo stays in this page&apos;s memory and is not uploaded or saved. It does not automatically identify players or read scores.</p>
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
      <button className="secondary" type="button" disabled={disabled} onClick={removePhoto}>Remove Photo</button>
    </div> : null}
  </div>;
}
