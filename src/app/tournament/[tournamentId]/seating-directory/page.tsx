import Link from "next/link";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { getTournamentResultEventSummary } from "../../../../lib/results/event-summary";
import SeatingDirectoryClient from "./seating-directory-client";

// The client freezes eventId from the prop and offers no picker, so with no
// ?event it sat on "Choose a specific event to open its published seating
// directory" with nothing to choose. Both inbound links reached it that way:
// the tournament hub's "Seating Directory" and the teams page's "Open Seating
// Directory" both pass no event. Only team-operations-client.tsx passes one,
// and only when a doubles event exists. Verified live as a dead end.
export default async function SeatingDirectoryPage({params,searchParams}:{params:Promise<{tournamentId:string}>;searchParams:Promise<{event?:string}>}){
  const{tournamentId}=await params;
  const{event}=await searchParams;
  const access=await requireTournamentAccess(tournamentId);
  const chooser=event?null:await getTournamentResultEventSummary(access.user.id,tournamentId);
  return <main className="auth-shell"><section className="auth-card wide-card"><p className="eyebrow">SEATING</p><h1>Seating Directory</h1><p className="auth-note">Look up published assignments by player name or ACC number. Only tournament seating information is shown.</p>
    {chooser?<section className="correction-item" aria-labelledby="seating-directory-events-title"><h2 id="seating-directory-events-title">Choose an event</h2>{chooser.events.length?<ul className="correction-list">{chooser.events.map((item)=><li className="correction-item" key={item.eventId}><strong>{item.name}</strong><p>{item.eventType.replace("_"," ")} · {item.format.replaceAll("_"," ")} · {item.participantCount} enrolled participant{item.participantCount===1?"":"s"}</p><Link className="guide-link" href={`/tournament/${tournamentId}/seating-directory?event=${item.eventId}`}>Open published seating</Link></li>)}</ul>:<p className="auth-note">No tournament events are active yet, so no seating has been published. Create and activate an event on the Set Up Tournament screen first.</p>}</section>
      :<SeatingDirectoryClient tournamentId={tournamentId} initialEventId={event??""}/>}
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link></section></main>;
}
