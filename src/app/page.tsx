import { headers } from "next/headers";
import Link from "next/link";
import { SharedDeviceSignOut } from "../components/shared-device-sign-out";
import { getCurrentSubject } from "../lib/auth/current-subject";
import { allowsReviewPrototype } from "../lib/review-prototype-boundary";
import { TournamentDashboard } from "./tournament-dashboard";

export default async function HomePage() {
  const requestHeaders = await headers();
  if (!allowsReviewPrototype({
    host: requestHeaders.get("host"),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  })) {
    const subject = await getCurrentSubject();
    if (subject) {
      return (
        <main className="auth-shell">
          <section className="auth-card" aria-labelledby="welcome-title">
            <p className="eyebrow">ACC TOURNAMENT DESK</p>
            <h1 id="welcome-title">You’re signed in</h1>
            <p className="lede">Your secure email sign-in is complete.</p>
            <p>Open the registration or tournament link provided by the tournament director to continue.</p>
            <p className="auth-note">Tournament access is granted separately for each tournament.</p>
            <SharedDeviceSignOut />
          </section>
        </main>
      );
    }
    return (
      <main className="auth-shell">
        <section className="auth-card" aria-labelledby="welcome-title">
          <p className="eyebrow">ACC TOURNAMENT DESK</p>
          <h1 id="welcome-title">Tournament access</h1>
          <p className="lede">Sign in to open the tournament workspace assigned to you.</p>
          <Link className="primary-action" href="/sign-in">Sign in by email</Link>
          <p className="auth-note">Tournament registration uses the QR code or registration link provided by the tournament director.</p>
        </section>
      </main>
    );
  }
  return <TournamentDashboard />;
}
