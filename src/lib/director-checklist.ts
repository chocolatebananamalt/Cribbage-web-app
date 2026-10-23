import type { SetupWorkspace } from "./api/setup.ts";
import type { SetupActivationState } from "./api/setup-activation.ts";
import type { SeatingWorkspace } from "./api/seating-workspace.ts";
import type { EventRosterEnrollmentWorkspace } from "./api/event-roster-enrollment.ts";
import type { PaymentObligationWorkspace } from "./api/payment-obligation.ts";
import type { EventScheduleWorkspace } from "./api/event-schedule.ts";

export type DirectorChecklistSnapshot = {
  setup: SetupWorkspace | null;
  activation: SetupActivationState | null;
  seating: SeatingWorkspace | null;
  enrollment: EventRosterEnrollmentWorkspace | null;
  payments: PaymentObligationWorkspace | null;
  schedule: EventScheduleWorkspace | null;
  teamStarts?: Record<string, boolean> | null;
  teamEnrollment?: Record<string, { teamCount: number; memberRosterEntryIds: string[] }> | null;
  attendance: Array<{ eventId: string; format: "standard_singles" | "doubles" | "canadian_doubles"; name: string; windowState: "open" | "closed"; unresolvedCount: number; checkedInCount: number; noShowCount: number; pendingDeskCount: number }> | null;
};
export type DirectorStep = { title: string; state: "Complete" | "Next" | "Blocked" | "Check status"; detail: string; path: string };
function teamsForEnrollment(events: EventRosterEnrollmentWorkspace["events"] | undefined, teamEnrollment: DirectorChecklistSnapshot["teamEnrollment"]) {
  const teams = Array.isArray(events) ? events.filter((event) => ["doubles", "canadian_doubles"].includes(event.format)) : [];
  if (!teams.length) return "";
  if (!teamEnrollment) return " Doubles and Canadian Doubles readiness is managed in Team Scorecards; team enrollment status is unavailable.";
  const incomplete = teams.filter((event) => (teamEnrollment[event.eventId]?.teamCount ?? 0) === 0);
  return incomplete.length ? ` Team Scorecards has no team entries for: ${incomplete.map((event) => event.name).join(", ")}.` : " Doubles and Canadian Doubles readiness is managed in Team Scorecards.";
}


// A missing read is unknown, never evidence of completion. These are navigation
// hints from persisted projections; every action keeps its existing server gate.
export function directorChecklist(s: DirectorChecklistSnapshot): DirectorStep[] {
  const steps: DirectorStep[] = [];
  function add(title: string, done: boolean | null, ready: boolean, detail: string, path: string) {
    steps.push({ title, state: done === null ? "Check status" : done ? "Complete" : ready ? "Next" : "Blocked", detail, path });
  }
  const saved = !!s.setup?.current;
  const activated = s.activation?.status === "activated";
  add("Save tournament details", s.setup ? saved : null, true, saved ? "Saved tournament details are available. Review any later edits in Setup." : "Complete the venue, director, dates, and time zone, then Save Tournament Details & Continue.", "setup");
  const eventsSaved = !!s.setup?.current?.events.length;
  add("Save events and pools", s.setup ? eventsSaved : null, saved, "Add events, games, and optional pools, then Save All Events Draft. Unsaved edits must be saved before finalizing.", "setup");
  add("Finalize events / open registration", s.activation ? activated : null, eventsSaved, "Finalize All Events / Open Registration in Setup. This opens roster intake; it does not start play.", "setup");
  const roster = s.enrollment?.roster ?? [];
  add("Build the roster", s.enrollment ? roster.length > 0 : null, activated, `${s.enrollment ? `${roster.length} active roster entries confirmed.` : "Roster status unavailable."} Add or import players while registration is open; review the full list before closing it.`, "roster");
  const checked = roster.filter((row) => row.checkInState === "checked_in");
  const unresolved = roster.filter((row) => ["not_checked_in", "late"].includes(row.checkInState)).length;
  add("Record tournament check-in", s.enrollment ? checked.length > 0 && unresolved === 0 : null, activated && roster.length > 0, `${s.enrollment ? `${checked.length} checked in; ${unresolved} not checked in or late.` : "Tournament check-in status unavailable."} Record each player's actual status before seating.`, "seating");
  const teamMemberIds = new Set(Object.values(s.teamEnrollment ?? {}).flatMap((entry) => entry.memberRosterEntryIds));
  const participants = roster.filter((row) => row.enrolledEventIds.length > 0 || teamMemberIds.has(row.rosterEntryId));
  const emptyEvents = s.enrollment?.events.filter((event) => {
    if (event.participantCount > 0) return false;
    if (!["doubles", "canadian_doubles"].includes(event.format)) return true;
    return s.teamEnrollment ? (s.teamEnrollment[event.eventId]?.teamCount ?? 0) === 0 : false;
  }) ?? [];
  const teamEvents = s.enrollment?.events.filter((event) => ["doubles", "canadian_doubles"].includes(event.format)) ?? [];
  const teamDataMissing = teamEvents.some((event) => !s.teamEnrollment || !Object.hasOwn(s.teamEnrollment, event.eventId));
  const emptyEventNote = emptyEvents.length ? ` No participants recorded for: ${emptyEvents.map((event) => event.name).join(", ")}. Later events may wait for qualification; review their prerequisites before enrollment.` : "";
  const teamReadinessNote = teamsForEnrollment(s.enrollment?.events, s.teamEnrollment);
  const enrollmentDone = s.enrollment ? checked.length > 0 && checked.every((row) => row.enrolledEventIds.length > 0 || teamMemberIds.has(row.rosterEntryId)) && emptyEvents.length === 0 : null;
  add("Enroll players in events", teamDataMissing ? null : enrollmentDone, checked.length > 0, "Enroll checked-in players in their chosen events. Review each event; not every player needs every event." + emptyEventNote + teamReadinessNote, teamEvents.length ? "teams" : "participants");
  const obligations = new Map(s.payments?.entries.map((entry) => [entry.rosterEntryId, entry]));
  const unpaid = participants.filter((row) => !["paid", "overpaid"].includes(obligations.get(row.rosterEntryId)?.paymentStatus ?? ""));
  add("Record amount owed and receipts", s.payments && s.enrollment ? teamDataMissing ? null : participants.length > 0 && unpaid.length === 0 : null, participants.length > 0, `${s.payments && s.enrollment ? `${unpaid.length} enrolled players need payment review.` : "Payment status unavailable."} In Payments, explicitly save amount owed (including 0 when appropriate), then record any receipt. Setup fees do not create this record automatically.` + teamReadinessNote, "payments#player-payment-status");
  const standardAttendance = s.attendance?.filter((event) => event.format === "standard_singles") ?? [];
  const attendanceDetails = standardAttendance.map((event) => `${event.name}: ${event.windowState}, ${event.unresolvedCount} unresolved, ${event.pendingDeskCount} desk requests.`).join(" ");
  const teamOnly = teamEvents.length > 0 && !!s.enrollment?.events.length
    && s.enrollment.events.every((event) => ["doubles", "canadian_doubles"].includes(event.format));
  const attendanceDone = teamOnly || !!s.attendance?.length && standardAttendance.length > 0 && standardAttendance.every((event) => event.windowState === "closed" && event.unresolvedCount === 0 && event.pendingDeskCount === 0 && event.checkedInCount + event.noShowCount > 0);
  add("Complete event attendance", teamOnly ? true : s.attendance ? attendanceDone : null, teamOnly ? true : participants.length > 0 && unpaid.length === 0 && emptyEvents.length === 0, teamOnly ? "No Standard Singles event attendance applies; review team readiness in Team Scorecards." : "Open each Standard Singles event's check-in. Every enrollee must check in or be marked no-show before closing that event's check-in. Later events may still be waiting. " + (attendanceDetails || (s.attendance ? "No Standard Singles attendance desk rows were returned; review Doubles readiness in Team Scorecards." : "Event attendance status unavailable; open the desk to check.")) + emptyEventNote, teamOnly ? "teams" : emptyEvents.length ? "participants" : "event-check-in");
  add("Close registration and publish initial seating", s.seating ? !!s.seating.publication && s.seating.registrationClosed : null, checked.length > 0, "Finish roster and tournament check-in, close registration, then review and publish initial seating. Server prerequisites remain enforced.", "seating");
  const events = s.schedule?.events ?? [];
  const singles = events.filter((event) => event.format === "standard_singles" && event.scoringMethod === "digital");
  const teams = events.filter((event) => ["doubles", "canadian_doubles"].includes(event.format));
  const started = events.map((event) => ["doubles", "canadian_doubles"].includes(event.format) ? s.teamStarts?.[event.eventId] ?? null : event.format === "standard_singles" && event.scoringMethod === "digital" ? ["in_progress", "completed", "finalized"].includes(event.playState) : null);
  const unresolvedTeam = teams.some((event) => s.teamStarts?.[event.eventId] !== true);
  const allStarted = !s.schedule || started.some((value) => value === null) ? null : events.length > 0 && started.every((value) => value === true);
  add("Publish schedules and start each event", allStarted, !!s.seating?.publication, `${s.schedule ? `${singles.filter((event) => event.schedulePublished).length} of ${singles.length} Standard Singles schedules published.` : "Schedule status unavailable."} Review/import Standard Singles CSVs and use Start Event on Game Schedule. ${teams.length ? "Doubles events use Team Scorecards for seating, schedule, and Start Play. " : ""}Later events may wait until their prerequisites are met. Other formats require their own event-control review.`, unresolvedTeam && singles.every((event) => ["in_progress", "completed", "finalized"].includes(event.playState)) ? "teams" : "schedule");
  return steps;
}

export type RosterIntakeState = "open" | "setup_required" | "closed" | "unavailable";
export function rosterIntakeState(activation: SetupActivationState | null, seating: SeatingWorkspace | null): RosterIntakeState {
  if (!activation || !seating) return "unavailable";
  if (seating.publication) return "closed";
  if (activation.status !== "activated") return "setup_required";
  return seating.registrationClosed ? "closed" : "open";
}
export function rosterIntakeMessage(state: RosterIntakeState) {
  return state === "setup_required" ? "Registration has not opened. Save the tournament details and all event drafts, then choose Finalize All Events / Open Registration in Setup before adding or importing players."
    : state === "closed" ? "Registration is closed or initial seating is published. New roster entries are unavailable. Review registration and seating status; use the existing guarded correction workflow when applicable."
    : state === "unavailable" ? "Registration status could not be confirmed. Refresh before adding players. Your entered details remain on this page."
    : "Registration is open. Add or import players before closing registration and publishing initial seating.";
}
