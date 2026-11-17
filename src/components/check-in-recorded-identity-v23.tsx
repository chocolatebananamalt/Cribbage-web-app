"use client";

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import type { IdentityAccessV5 } from '../lib/identity-v5/contracts';
import { recordedCheckInIdentityV23 } from '../lib/seating/recorded-identity-v23';

type Props = { scope: IdentityAccessV5; rosterEntryId: string; disabled: boolean };
type View = NonNullable<ReturnType<typeof recordedCheckInIdentityV23>>;

export function CheckInRecordedIdentityV23(props: Props) {
  return <RecordedIdentity key={JSON.stringify([props.scope.actorId, props.scope.sessionId, props.scope.tournamentId, props.rosterEntryId])} {...props} />;
}

function RecordedIdentity({ scope, rosterEntryId, disabled }: Props) {
  const alive = useRef(false), epoch = useRef(0), flight = useRef<AbortController | null>(null);
  const [view, setView] = useState<View | null>(null), [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState('Review the recorded distinction before choosing between people with the same name.');
  useLayoutEffect(() => {
    alive.current = true;
    return () => { alive.current = false; flight.current?.abort(); };
  }, []);
  useEffect(() => {
    try {
      const { data } = createClient().auth.onAuthStateChange(event => {
        if (!alive.current) return;
        setAvailable(true);
        if (event === 'INITIAL_SESSION') return;
        epoch.current++; flight.current?.abort(); flight.current = null;
        setBusy(false); setView(null);
        setMessage('Sign-in changed. Review the recorded identity again; a different session needs a page reload.');
      });
      return () => data.subscription.unsubscribe();
    } catch {
      queueMicrotask(() => {
        if (!alive.current) return;
        setAvailable(false);
        setMessage('Recorded identity is unavailable. Ask the desk to review this registration.');
      });
    }
  }, []);

  async function review() {
    if (disabled || !available || flight.current || !alive.current) return;
    const controller = new AbortController(), ticket = ++epoch.current;
    flight.current = controller; setBusy(true); setView(null);
    setMessage("Reading this registration's recorded identity.");
    const current = () => alive.current && ticket === epoch.current && !controller.signal.aborted;
    try {
      const response = await fetch(`/api/v1/tournaments/${scope.tournamentId}/identity-adoption-v8/profile?rosterEntryId=${encodeURIComponent(rosterEntryId)}`, {
        method: 'GET', cache: 'no-store', signal: controller.signal,
        headers: { 'x-identity-actor': scope.actorId, 'x-identity-session': scope.sessionId },
      });
      if (!response.ok) throw Error('unavailable');
      const value: unknown = await response.json();
      if (!current()) return;
      const recorded = recordedCheckInIdentityV23(value, scope, rosterEntryId);
      if (!recorded) throw Error('unavailable');
      setView(recorded);
      setMessage('Recorded identity read. This does not verify the person at the desk or change check-in.');
    } catch {
      if (current()) setMessage('Recorded identity is unavailable or needs binding review. No person was selected by name or address. Ask the desk to review this registration.');
    } finally {
      if (current()) { flight.current = null; setBusy(false); }
    }
  }

  return <section aria-label="Recorded check-in identity">
    <button type="button" disabled={disabled || busy || !available} onClick={() => void review()}>{busy ? 'Reading recorded identity…' : 'Review recorded identity'}</button>
    <p role="status" aria-live="polite">{message}</p>
    {view && <div>
      <h3>{view.displayName}</h3><p>{view.reference}</p>
      <p>{view.nonmember ? 'Nonmember' : 'Membership not verified'}</p>
      {view.incompleteAddress && <p>Address information is incomplete. Recorded duplicate review does not establish an address match.</p>}
    </div>}
  </section>;
}
