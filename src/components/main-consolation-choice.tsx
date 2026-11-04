"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { SetupEvent } from '../lib/api/setup';
import type { SetupEventLinkChoice } from '../lib/api/setup-event-links';

type Props = {
  main: SetupEvent;
  events: SetupEvent[];
  choice: SetupEventLinkChoice | undefined;
  disabled: boolean;
  assignedConsolationIds?: string[];
  onChange: (choice: SetupEventLinkChoice) => void;
  onAddConsolation: (mainClientRowId: string) => void;
  onPendingYesChange?: (pending: boolean) => void;
  children?: ReactNode;
  canAddConsolation?: boolean;
  pendingYes?: boolean;
};

/** Controls the draft association only; event editors and their data remain separate. */
export function MainConsolationChoice({ main, events, choice, disabled, assignedConsolationIds = [], onChange, onAddConsolation, onPendingYesChange, children, canAddConsolation = true, pendingYes = false }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmNo, setConfirmNo] = useState(false);
  const radioName = useId();
  const noRadio = useRef<HTMLInputElement>(null);
  const pendingBeforeConfirm = useRef(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  useEffect(() => { if (confirmNo) { wasConfirming.current = true; cancelButton.current?.focus(); } else if (wasConfirming.current) { wasConfirming.current = false; noRadio.current?.focus(); } }, [confirmNo]);
  const selected = choice?.consolationClientRowIds ?? [];
  const yes = selected.length > 0 || pickerOpen;
  const assigned = new Set(assignedConsolationIds.map(id => id.toLowerCase()));
  const selectedIds = new Set(selected.map(id => id.toLowerCase()));
  const consolations = events.filter(event => event.eventKind === 'consolation');

  return <fieldset className="setup-subsection" disabled={disabled}>
    <legend>Does {main.displayName} have a Consolation Event?</legend>
    <label><input type="radio" name={radioName} disabled={confirmNo} checked={yes} onChange={() => { setPickerOpen(true); onPendingYesChange?.(selected.length === 0); }} /> Yes</label>{' '}
    <label><input type="radio" name={radioName} ref={noRadio} disabled={confirmNo} checked={choice !== undefined && !yes} onChange={() => { pendingBeforeConfirm.current = pendingYes; setConfirmNo(true); onPendingYesChange?.(true); }} /> No</label>
    {confirmNo && <div role="dialog" aria-live="assertive" aria-label="Confirm no Consolation Event"><p>Confirm that this Main has no Consolation Event. Existing Consolation events remain available and must be reassigned before finalization.</p><button type="button" ref={cancelButton} onClick={() => { setConfirmNo(false); onPendingYesChange?.(pendingBeforeConfirm.current); }}>Cancel</button>{' '}<button type="button" onClick={() => { setConfirmNo(false); setPickerOpen(false); onPendingYesChange?.(false); onChange({ mainClientRowId: main.clientRowId, consolationClientRowIds: [] }); }}>Confirm No</button></div>}
    {choice !== undefined && !yes && consolations.length > 0 && <p>Existing Consolation event editors remain available. Reassign any unlinked Consolation events before finalization.</p>}
    {yes && <div>
      {selected.length > 0 && <ul>{selected.map(id => {
        const event = consolations.find(item => item.clientRowId.toLowerCase() === id.toLowerCase());
        return <li key={id}>{event?.displayName || 'Unavailable Consolation event'}{' '}
          <button type="button" disabled={confirmNo} onClick={() => {
            setPickerOpen(true); onPendingYesChange?.(selected.length === 1);
            onChange({ mainClientRowId: main.clientRowId, consolationClientRowIds: selected.filter(item => item !== id) });
          }}>Unlink {event?.displayName || 'Consolation event'}</button>
        </li>;
      })}</ul>}
      <label>Add an existing Consolation event
        <select value="" disabled={confirmNo} onChange={event => {
          const id = event.target.value;
          if (id && consolations.some(item => item.clientRowId === id) && !assigned.has(id.toLowerCase()) && !selectedIds.has(id.toLowerCase())) {
            onPendingYesChange?.(false); onChange({ mainClientRowId: main.clientRowId, consolationClientRowIds: [...selected, id] });
          }
        }}>
          <option value="">Choose a Consolation event</option>
          {consolations.filter(event => !selectedIds.has(event.clientRowId.toLowerCase())).map(event => <option key={event.clientRowId} value={event.clientRowId} disabled={assigned.has(event.clientRowId.toLowerCase())}>{event.displayName}{assigned.has(event.clientRowId.toLowerCase()) ? ' (assigned to another Main)' : ''}</option>)}
        </select>
      </label>{' '}
      <button type="button" disabled={confirmNo || !canAddConsolation} onClick={() => { onPendingYesChange?.(false); onAddConsolation(main.clientRowId); }}>Add Consolation for this Main</button>
      {children}
    </div>}
  </fieldset>;
}





