"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LiveStandingsRefresh({ resolvedGameCount, unresolvedTieCount, generatedAt }: { resolvedGameCount: number; unresolvedTieCount: number; generatedAt: string }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const lastUpdated = `${generatedAt.slice(11, 19)} UTC`;

  useEffect(() => {
    const initialState = window.setTimeout(() => setOnline(navigator.onLine), 0);
    const refresh = () => { if (navigator.onLine) router.refresh(); };
    const onlineHandler = () => { setOnline(true); refresh(); };
    const offlineHandler = () => setOnline(false);
    const storageHandler = (event: StorageEvent) => { if (event.key === "acc-score-result-accepted") refresh(); };
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    window.addEventListener("storage", storageHandler);
    return () => { window.clearTimeout(initialState); window.clearInterval(timer); window.removeEventListener("online", onlineHandler); window.removeEventListener("offline", offlineHandler); window.removeEventListener("storage", storageHandler); };
  }, [router]);

  return <p className={online ? "live-status" : "error-text"} role="status">
    {online ? `Live · Last updated ${lastUpdated}` : `Offline · Standings are stale as of ${lastUpdated}`}
    {` · ${resolvedGameCount} resolved game${resolvedGameCount === 1 ? "" : "s"} · ${unresolvedTieCount} unresolved tie${unresolvedTieCount === 1 ? "" : "s"}`}
  </p>;
}
