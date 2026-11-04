import { isEventPrizeDeclarationWorkspace } from "./api/event-prize-declaration.ts";
import { isUuid } from "./api/validation.ts";
import type { DeclarationActivationPin } from "./api/setup-activation.ts";

type Event = { clientRowId: string; eventKind: string; entryFeeCents: number };
type Input = { actorId: string; tournamentId: string; events: Event[]; allowLinkedEvents?: boolean; readRecovery: (key: string) => string | null; fetchWorkspace: (rowId: string) => Promise<unknown> };

/** Advisory client gate only. Activation rechecks authoritative pins in the database. */
export async function readEventPrizeDeclarationPins({ actorId, tournamentId, events: inputEvents, allowLinkedEvents = false, readRecovery, fetchWorkspace }: Input): Promise<DeclarationActivationPin[] | null> {
  try {
    if (!Array.isArray(inputEvents) || inputEvents.length > 32) return null;
    const events = allowLinkedEvents ? inputEvents.filter(e => e && (e.eventKind === "main" || e.eventKind === "consolation")) : inputEvents;
    if (!isUuid(actorId) || !isUuid(tournamentId) || !Array.isArray(events) || !events.length || events.length > 32
      || !events.every(e => !!e && isUuid(e.clientRowId) && (e.eventKind === "main" || e.eventKind === "consolation")
        && Number.isSafeInteger(e.entryFeeCents) && e.entryFeeCents >= 0 && e.entryFeeCents <= 100_000_000)
      || new Set(events.map(e => e.clientRowId)).size !== events.length
      || (allowLinkedEvents ? events.filter(e => e.eventKind === "main").length < 1 : events.filter(e => e.eventKind === "main").length !== 1)
      || (!allowLinkedEvents && events.filter(e => e.eventKind === "consolation").length > 1)
      || (!allowLinkedEvents && !events.some(e => e.eventKind === "main" && e.entryFeeCents > 0))) return null;
    const keys = events.flatMap(e => { const key = `prize-schedule:${actorId}:${tournamentId}:${e.clientRowId}:v2`; return [key, `${key}:blocked`]; });
    if (keys.some(k => readRecovery(k) !== null)) return null;
    const paid = events.filter(e => e.entryFeeCents > 0);
    const workspaces = await Promise.all(paid.map(e => fetchWorkspace(e.clientRowId)));
    if (!workspaces.every((w, i) => {
      const e = paid[i];
      return isEventPrizeDeclarationWorkspace(w, tournamentId, e.clientRowId) && w.supported && w.settingsCurrent
        && !!w.schedule && !!w.scheduleId && w.settings.eventKind === e.eventKind && w.settings.entryFeeCents === e.entryFeeCents;
    })) return null;
    // Catch pending requests created while the reads were in flight.
    if (!keys.every(k => readRecovery(k) === null)) return null;
    const result = workspaces.map((w, i) => {
      if (!isEventPrizeDeclarationWorkspace(w, tournamentId, paid[i].clientRowId) || !w.scheduleId) throw new Error("invalid workspace");
      return { clientRowId: paid[i].clientRowId, declarationId: w.scheduleId, settingsFingerprint: w.settingsFingerprint };
    }).sort((a,b) => a.clientRowId < b.clientRowId ? -1 : a.clientRowId > b.clientRowId ? 1 : 0);
    return new Set(result.map(pin => pin.declarationId)).size === result.length ? result : null;
  } catch { return null; }
}

export async function checkEventPrizeDeclarations(input: Input): Promise<boolean> { return (await readEventPrizeDeclarationPins(input)) !== null; }


