"use client";

import Link from "next/link";
import Image from "next/image";
import "./player-page.css";
import { useRef, type ReactNode, type MouseEvent } from "react";

export type PlayerPageFrameProps = {
  tournamentId: string;
  tournamentName: string;
  eventId: string;
  eventName: string;
  activeTab: "entry" | "card";
  player: { displayName: string; verificationId: string; accNumber?: string };
  beforeNavigate?: () => boolean;
  navigation?: { entryHref: string; cardHref: string };
  children: ReactNode;
};

/** Presentation only: every destination retains its own server authorization. */
export function PlayerPageFrame({ tournamentId, tournamentName, eventId, eventName, activeTab, player, beforeNavigate, navigation, children }: PlayerPageFrameProps) {
  const profile = useRef<HTMLDialogElement>(null);
  const cardHref = navigation?.cardHref ?? `/tournament/${tournamentId}/scorecard?event=${eventId}`;
  const gamesHref = navigation?.entryHref ?? `/tournament/${tournamentId}/games`;
  const guard = (event: MouseEvent<HTMLAnchorElement>) => {
    if (beforeNavigate && !beforeNavigate()) event.preventDefault();
  };
  return <main className="player-page">
    <div className="player-page-content">
      <header className="player-event-header"><p>{tournamentName} · {eventName}</p><span className="player-logo-window"><Image src="/branding/acc-logo.jpg" width={1080} height={510} loading="eager" unoptimized alt="American Cribbage Congress" /></span></header>
      <nav className="player-tabs" aria-label="Scoring pages">
        <Link href={gamesHref} onClick={guard} aria-current={activeTab === "entry" ? "page" : undefined}>Score Entry</Link>
        <Link href={cardHref} onClick={guard} aria-current={activeTab === "card" ? "page" : undefined}>Scorecard</Link>
      </nav>
      {children}
    </div>
    <nav className="player-bottom-nav" aria-label="Main navigation">
      <Link href={`/tournament/${tournamentId}`} onClick={guard} aria-label="Home">Ho<wbr />me</Link>
      <Link href={cardHref} onClick={guard} aria-label="Scorecard" aria-current={activeTab === "card" ? "page" : undefined}>Score<wbr />card</Link>
      <button type="button" aria-label="Profile" onClick={() => profile.current?.showModal()}>Pro<wbr />file</button>
    </nav>
    <dialog className="player-profile-dialog" ref={profile} aria-labelledby="player-profile-title">
      <h2 id="player-profile-title">Your tournament profile</h2>
      <p><strong>{player.displayName}</strong>{player.accNumber ? ` (${player.accNumber})` : ""}</p>
      <p>Tournament ID# <strong>{player.verificationId}</strong></p>
      <p>{tournamentName}</p>
      <p>This is your identity for this tournament. Account or membership changes are not made here.</p>
      <button type="button" className="secondary" onClick={() => profile.current?.close()}>Return to {activeTab === "entry" ? "Score Entry" : "Scorecard"}</button>
    </dialog>
  </main>;
}
