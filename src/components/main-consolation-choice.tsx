"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { SetupEvent } from '../lib/api/setup';
import type { SetupEventLinkChoice } from '../lib/api/setup-event-links';
import { consolationYesIntent } from '../lib/setup-consolation-intent';

type Props = {
 main: SetupEvent; events: SetupEvent[]; choice: SetupEventLinkChoice | undefined; disabled: boolean;
 assignedConsolationIds?: string[]; onChange: (choice: SetupEventLinkChoice) => void;
 onAddConsolation: (mainClientRowId: string) => void;
 onConfirmNo?: (mainClientRowId: string, childIds: string[]) => boolean;
 onPendingYesChange?: (pending: boolean) => void; children?: ReactNode; canAddConsolation?: boolean; pendingYes?: boolean;
};
const legacyNotice = 'This earlier draft has Consolation events whose Main is unclear. Keep it intact for review, or use a new draft for the simple event setup.';

/** Yes/No is the user choice; stable relationships remain internal. */
export function MainConsolationChoice({ main, events, choice, disabled, assignedConsolationIds = [], onChange, onAddConsolation, onConfirmNo, onPendingYesChange, children, canAddConsolation = true, pendingYes = false }: Props) {
 const [confirmNo, setConfirmNo] = useState(false), [message, setMessage] = useState('');
 const creating = useRef(false), pendingBeforeConfirm = useRef(false), wasConfirming = useRef(false);
 const cancelButton = useRef<HTMLButtonElement>(null), noRadio = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDialogElement>(null), radioName = useId();
 const selected = choice?.consolationClientRowIds ?? [], yes = selected.length > 0 || pendingYes;
 const childEvents = events.filter(event => event.eventKind === 'consolation' && selected.some(id => id.toLowerCase() === event.clientRowId.toLowerCase()));
 const choices: SetupEventLinkChoice[] = [...(assignedConsolationIds.length ? [{ mainClientRowId: 'other', consolationClientRowIds: assignedConsolationIds }] : []), ...(choice ? [choice] : [])];
 const unassigned = events.filter(event => event.eventKind === 'consolation' && ![...selected, ...assignedConsolationIds].some(id => id.toLowerCase() === event.clientRowId.toLowerCase()));
 useEffect(() => { if (selected.length > 0) creating.current = false; }, [selected.length]);
 useEffect(() => { if (confirmNo) { wasConfirming.current = true; if (dialog.current && !dialog.current.open) dialog.current.showModal(); cancelButton.current?.focus(); } else if (wasConfirming.current) { wasConfirming.current = false; noRadio.current?.focus(); } }, [confirmNo]);
 function chooseYes() {
  if (disabled || confirmNo || creating.current) return;
  const intent = consolationYesIntent(main.clientRowId, events, choices); setMessage('');
  if (intent.kind === 'review_required') { setMessage(legacyNotice); return; }
  if (intent.kind === 'keep') { onPendingYesChange?.(false); return; }
  if (intent.kind === 'reuse') { onChange({ mainClientRowId: main.clientRowId, consolationClientRowIds: [intent.clientRowId] }); onPendingYesChange?.(false); return; }
  if (!canAddConsolation) { setMessage('This draft has reached its event capacity. No event was added.'); return; }
  creating.current = true; onPendingYesChange?.(true); onAddConsolation(main.clientRowId); onPendingYesChange?.(false);
 }
 function chooseNo() {
  if (disabled || confirmNo) return;
  if (unassigned.length) { setMessage(legacyNotice); return; }
  setMessage(''); pendingBeforeConfirm.current = pendingYes; setConfirmNo(true); onPendingYesChange?.(true);
 }
 return <fieldset className="setup-subsection setup-consolation-step" disabled={disabled}>
  <legend>Does {main.displayName} have a Consolation Event?</legend>
  <div className="setup-consolation-answers"><label><input type="radio" name={radioName} disabled={confirmNo} checked={yes} onChange={chooseYes} /> Yes</label>{' '}
  <label><input type="radio" name={radioName} ref={noRadio} disabled={confirmNo} checked={choice !== undefined && !yes} onChange={chooseNo} /> No</label></div>
  {confirmNo && <dialog ref={dialog} className="setup-choice-dialog" role="alertdialog" aria-modal="true" aria-label="Confirm no Consolation Event" onCancel={event => { event.preventDefault(); setConfirmNo(false); onPendingYesChange?.(pendingBeforeConfirm.current); }} onKeyDown={event => {
   if (event.key === 'Tab') {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
   }
  }}>
   <p>{childEvents.length ? `Choosing No removes ${childEvents.map(event => event.displayName).join(', ')} and its pool settings from this draft. Saved versions are preserved. Save All Events Draft would record the revised setup.` : 'Confirm that this Main will not have a Consolation Event.'}</p>
   <button type="button" ref={cancelButton} onClick={() => { setConfirmNo(false); onPendingYesChange?.(pendingBeforeConfirm.current); }}>Cancel</button>{' '}
   <button type="button" disabled={selected.length > 0 && !onConfirmNo} onClick={() => { if (disabled) return; if (onConfirmNo) { if (!onConfirmNo(main.clientRowId, selected)) return; } else onChange({ mainClientRowId: main.clientRowId, consolationClientRowIds: [] }); setConfirmNo(false); creating.current = false; onPendingYesChange?.(false); }}>Confirm No</button>
  </dialog>}
  {message && <p role="alert">{message}</p>}
  {selected.length > 0 && children}
 </fieldset>;
}
