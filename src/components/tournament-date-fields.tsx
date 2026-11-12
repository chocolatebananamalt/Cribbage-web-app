"use client";

import { combineLocalDateTime, tournamentDayCount, tournamentEndForDays } from "../lib/setup-dates";

export function TournamentDateFields({ startsAt, endsAt, onChange, plannedDateCarriedForward = false }: {
  startsAt: string;
  endsAt: string;
  onChange: (dates: { startsAt: string; endsAt: string }) => void;
  plannedDateCarriedForward?: boolean;
}) {
  const days = tournamentDayCount(startsAt, endsAt);
  const endDate = days === null ? null : endsAt.slice(0, 10);
  return <>
    <label className="setup-span-4">Start Date<input required type="date" value={startsAt.slice(0, 10)} onChange={(e) => {
      const date = e.target.value;
      onChange({ startsAt: combineLocalDateTime(date, startsAt.slice(11, 16)), endsAt: days === null ? endsAt : tournamentEndForDays(date, String(days)) ?? "" });
    }} />{plannedDateCarriedForward ? <span className="field-help">Planned start date carried forward. Choose the start time and number of days.</span> : null}</label>
    <label className="setup-span-4">Start Time<input required type="time" value={startsAt.slice(11, 16)} onChange={(e) => onChange({ startsAt: combineLocalDateTime(startsAt.slice(0, 10), e.target.value), endsAt })} /></label>
    <label className="setup-span-4">Number of Days<input required type="number" min="1" step="1" inputMode="numeric" disabled={!startsAt.slice(0, 10)} aria-describedby="tournament-end-date" value={days ?? ""} onChange={(e) => onChange({ startsAt, endsAt: tournamentEndForDays(startsAt.slice(0, 10), e.target.value) ?? "" })} />
      <span id="tournament-end-date" className="field-help" role="status">{endDate ? `Ends on ${endDate}` : "Choose the number of days to see the end date."}</span>
      <span className="field-help">(Includes the start day.)</span>
    </label>
  </>;
}
