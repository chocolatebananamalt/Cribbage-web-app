import EventCheckInForm from "./event-check-in-form";

export const dynamic = "force-dynamic";

export default function PublicEventCheckInPage() {
  return <main className="auth-shell"><section className="auth-card" aria-labelledby="event-check-in-title"><p className="eyebrow">DAY OF PLAY</p><h1 id="event-check-in-title">Event Check-In</h1><p className="auth-note">Scan the displayed event QR code, then confirm your own information. The code expires quickly and does not reveal tournament information.</p><EventCheckInForm /></section></main>;
}
