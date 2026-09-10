"use client";

import { useEffect, useRef, useState } from "react";

declare global { interface Window { __accActivationCredential?: string } }

export default function ActivationForm() {
  const credential = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const [message, setMessage] = useState("Checking activation link…");
  const [ready, setReady] = useState(false);

  function dropCredential() {
    credential.current = null;
    delete window.__accActivationCredential;
    setReady(false);
  }

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => {
      const value = window.__accActivationCredential;
      delete window.__accActivationCredential;
      if (!value) {
        setMessage("This activation link is unavailable.");
        return;
      }
      credential.current = value;
      setReady(true);
      setMessage("Confirm this activation while signed in on this device.");
    }, 0);
    const onPageHide = () => {
      request.current?.abort();
      request.current = null;
      dropCredential();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      mounted.current = false;
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", onPageHide);
      request.current?.abort();
      request.current = null;
      credential.current = null;
      delete window.__accActivationCredential;
    };
  }, []);

  async function redeem() {
    const value = credential.current;
    if (!value || request.current) return;
    setReady(false);
    setMessage("Confirming activation…");
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch("/api/v1/account-activations/redemptions", {
        method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential: value, operationId: crypto.randomUUID() }),
      });
      dropCredential();
      const body: unknown = await response.json().catch(() => null);
      if (response.ok && body && typeof body === "object" && (body as Record<string, unknown>).status === "pending") {
        setMessage("Activation is awaiting the director’s in-person confirmation.");
        return;
      }
    } catch {
      dropCredential();
    } finally {
      if (request.current === controller) request.current = null;
    }
    if (mounted.current) setMessage("This activation link is unavailable. Please contact the tournament director.");
  }

  return <section className="auth-card" aria-labelledby="activation-title"><p className="eyebrow">TOURNAMENT ACCESS</p><h1 id="activation-title">Activate tournament account</h1><p className="lede">Open this after signing in by email. Your activation value is removed from the browser address immediately.</p>{ready ? <button className="primary-action" type="button" onClick={redeem}>Confirm activation</button> : null}<p className="auth-note" role="status">{message}</p></section>;
}
