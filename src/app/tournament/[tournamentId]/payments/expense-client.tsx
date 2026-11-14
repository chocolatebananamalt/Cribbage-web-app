"use client";
import { setAppRecoveryItem, trackAppRecoveryWrite } from "../../../../lib/recovery-write-coordinator";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  isExpenseRecordRequest,
  isExpenseVoidRequest,
  isRecordedExpense,
  isRecoveredExpense,
  isRejectedExpense,
  isVoidedExpense,
  type ExpenseEntry,
  type ExpenseRecordRequest,
  type ExpenseRecoveryRequest,
  type ExpenseVoidRequest,
} from "../../../../lib/api/expense";
import {
  createExpenseRecoveryEnvelopeV2,
  exactExpenseRecoveryRequestMatches,
  expenseRecoveryStorageKey,
  parseExpenseRecoveryRaw,
  readExpenseRecovery,
  type ParsedExpenseRecovery,
} from "../../../../lib/expenses/expense-recovery-v2";

async function digest(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function dollarsToMinor(value: string) {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match || match[1].length > 8) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  return Number.isSafeInteger(minor) && minor > 0 && minor <= 2147483647 ? minor : null;
}

function ExpenseRow({
  expense,
  disabled,
  onVoid,
}: {
  expense: ExpenseEntry;
  disabled: boolean;
  onVoid: (expense: ExpenseEntry, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return <li className="correction-item">
    <h3>{expense.description}</h3>
    <p><strong>${(expense.amountMinor / 100).toFixed(2)} USD</strong> · {expense.expenseState === "recorded" ? "Active expense" : "Voided expense"}</p>
    <ol>{expense.history.map((event) => <li key={event.expenseEventId}>
      <strong>{event.eventType === "recorded" ? "Expense approved" : "Expense voided"}</strong>
      {` by ${event.approvalActorDisplayName}`}
      {event.voidReason ? ` · ${event.voidReason}` : ""}
    </li>)}</ol>
    {expense.expenseState === "recorded" ? <form onSubmit={(event) => {
      event.preventDefault();
      onVoid(expense, reason);
    }}>
      <fieldset disabled={disabled}>
        <legend>Void this expense</legend>
        <label>Reason for Void
          <textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <button className="secondary" type="submit">Void expense</button>
      </fieldset>
    </form> : null}
  </li>;
}

type ExpenseClientProps = {
  actorId: string;
  tournamentId: string;
  activeExpenseTotalMinor: number;
  expenses: ExpenseEntry[];
  syntheticMode?: boolean;
};

export default function ExpenseClient(props: ExpenseClientProps) {
  return <ExpenseClientScope key={`${props.actorId}:${props.tournamentId}`} {...props} />;
}

function ExpenseClientScope({
  actorId,
  tournamentId,
  activeExpenseTotalMinor,
  expenses,
  syntheticMode = false,
}: ExpenseClientProps) {
  const router = useRouter();
  const storageKey = expenseRecoveryStorageKey(actorId, tournamentId);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState<ParsedExpenseRecovery | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const inFlight = useRef(false);
  const activation = useRef<object | null>(null);
  const isActive = useCallback((token: object | null): token is object => token !== null && activation.current === token, []);

  useLayoutEffect(() => {
    const token = {};
    activation.current = token;
    return () => {
      if (activation.current === token) activation.current = null;
    };
  }, []);

  const reconcile = useCallback(async (recovery: ExpenseRecoveryRequest) => {
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/expenses/reconciliation`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-expected-actor-id": actorId },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(recovery),
      });
      const payload: unknown = response.ok ? await response.json().catch(() => null) : null;
      if (!payload || typeof payload !== "object" || !("result" in (payload as Record<string, unknown>))) {
        return "unresolved";
      }
      const result = (payload as Record<string, unknown>).result;
      if (result === null) return "none";
      if (isRecoveredExpense(result, recovery)) return "accepted";
      return isRejectedExpense(result, recovery) ? "rejected" : "unresolved";
    } catch {
      return "unresolved";
    }
  }, [actorId, tournamentId]);

  const removeExact = useCallback(async (raw: string, token: object) => {
    if (!isActive(token)) return false;
    try {
      return await trackAppRecoveryWrite(async () => {
        try {
          if (!isActive(token)) return false;
          if (window.sessionStorage.getItem(storageKey) !== raw) return false;
          window.sessionStorage.removeItem(storageKey);
          return window.sessionStorage.getItem(storageKey) === null;
        } catch { return false; }
      });
    } catch { return false; }
  }, [isActive, storageKey]);

  useEffect(() => {
    let live = true;
    const token = activation.current;
    const current = () => live && isActive(token);
    void (async () => {
      const saved = readExpenseRecovery(window.sessionStorage, storageKey, actorId, tournamentId);
      if (!current()) return;
      if (!saved) { setReady(true); return; }
      if (saved.status === "unknown") {
        setLocked(saved);
        setMessage("An unrecognized expense recovery record remains saved. It was not changed or removed.");
        setReady(true); return;
      }
      const state = await reconcile(saved.recovery);
      if (!current()) return;
      if (state === "accepted") {
        if (token && await removeExact(saved.raw, token)) {
          if (!current()) return;
          setReady(true); router.refresh(); return;
        }
        if (!current()) return;
        setLocked(readExpenseRecovery(window.sessionStorage, storageKey, actorId, tournamentId) ?? saved);
        setMessage("The retained expense request changed while reconciliation was pending. The newer bytes remain saved.");
        setReady(true); return;
      }
      if (state === "rejected") {
        if (token && await removeExact(saved.raw, token)) {
          if (!current()) return;
          setMessage("The prior expense action was rejected; the ledger was not changed.");
          setReady(true); router.refresh(); return;
        }
        if (!current()) return;
        setLocked(readExpenseRecovery(window.sessionStorage, storageKey, actorId, tournamentId) ?? saved);
        setMessage("The retained expense request changed while reconciliation was pending. The newer bytes remain saved.");
        setReady(true); return;
      }
      if (state === "none") {
        setLocked(saved);
        if (saved.status === "current" && saved.envelope.operationType === "record_tournament_expense"
          && isExpenseRecordRequest(saved.envelope.request)) {
          setDescription(syntheticMode && saved.envelope.request.description.startsWith("TEST ONLY SYNTHETIC:")
            ? saved.envelope.request.description.slice("TEST ONLY SYNTHETIC:".length).trimStart()
            : saved.envelope.request.description);
          setAmount((saved.envelope.request.amountMinor / 100).toFixed(2));
        }
        setMessage(saved.status === "current"
          ? "No server receipt exists yet. The exact request remains saved and can be retried."
          : "No server receipt exists yet. This legacy record has no full payload; re-enter its original details exactly before retrying.");
        setReady(true); return;
      }
      setLocked(saved);
      setMessage(saved.status === "current"
        ? "A prior expense action is unresolved. Its exact request remains saved for retry."
        : "A prior legacy expense action is unresolved. Re-enter its original details exactly before retrying.");
      setReady(true);
    })();
    return () => { live = false; };
  }, [actorId, isActive, reconcile, removeExact, router, storageKey, syntheticMode, tournamentId]);

  async function submitRecord() {
    const amountMinor = dollarsToMinor(amount);
    const idempotencyKey = locked?.status === "current" || locked?.status === "legacy"
      ? locked.recovery.idempotencyKey : crypto.randomUUID();
    const body: ExpenseRecordRequest = { amountMinor: amountMinor ?? 0, description: syntheticMode ? `TEST ONLY SYNTHETIC:${description.trim() ? ` ${description.trim()}` : ""}` : description, idempotencyKey };
    if (!isExpenseRecordRequest(body)) {
      setMessage("Enter a positive USD amount and a description of 200 characters or fewer.");
      return;
    }
    await submit("record_tournament_expense", body, null);
  }

  async function submitVoid(expense: ExpenseEntry, voidReason: string) {
    if (!expense.currentExpenseEventId) return;
    const idempotencyKey = locked?.status === "current" || locked?.status === "legacy"
      ? locked.recovery.idempotencyKey : crypto.randomUUID();
    const body: ExpenseVoidRequest = {
      expenseId: expense.expenseId,
      expectedExpenseVersion: expense.expenseVersion,
      expenseEventId: expense.currentExpenseEventId,
      voidReason,
      idempotencyKey,
    };
    if (!isExpenseVoidRequest(body)) {
      setMessage("Enter a reason of 500 characters or fewer before voiding the expense.");
      return;
    }
    await submit("void_tournament_expense", body, expense);
  }

  async function submit(
    operationType: ExpenseRecoveryRequest["operationType"],
    body: ExpenseRecordRequest | ExpenseVoidRequest,
    expense: ExpenseEntry | null,
  ) {
    const token = activation.current;
    if (!ready || busy || inFlight.current || !isActive(token)) return;
    inFlight.current = true;
    try {
      const expenseId = expense?.expenseId ?? null;
      const expectedExpenseVersion = expense?.expenseVersion ?? 0;
      const expenseEventId = expense?.currentExpenseEventId ?? null;
      const operationDigest = await digest({ operationType, expenseId, expectedExpenseVersion, expenseEventId, body: {
        ...(operationType === "record_tournament_expense"
          ? { amountMinor: (body as ExpenseRecordRequest).amountMinor, description: (body as ExpenseRecordRequest).description }
          : { voidReason: (body as ExpenseVoidRequest).voidReason }),
      } });
      if (!isActive(token)) return;
      let pending = locked;
      if (pending?.status === "unknown") {
        setMessage("An unrecognized expense recovery record remains saved. It cannot be overwritten here.");
        return;
      }
      if (pending?.status === "legacy") {
        const envelope = pending.envelope;
        if (envelope.operationType !== operationType || envelope.expenseId !== expenseId
          || envelope.expectedExpenseVersion !== expectedExpenseVersion || envelope.expenseEventId !== expenseEventId
          || envelope.digest !== operationDigest || envelope.idempotencyKey !== body.idempotencyKey) {
          setMessage("This action is locked. Re-enter the original details exactly or refresh after it resolves.");
          return;
        }
      } else if (pending?.status === "current") {
        if (!exactExpenseRecoveryRequestMatches(pending, operationType, body)) {
          setMessage("This action is locked. Retry the exact saved request without changing its fields.");
          return;
        }
      } else {
        const envelope = createExpenseRecoveryEnvelopeV2(actorId, tournamentId, operationType, body);
        const raw = envelope && JSON.stringify(envelope);
        if (!envelope || !raw) return;
        try {
          if (!isActive(token)) return;
          const observed = window.sessionStorage.getItem(storageKey);
          if (observed !== null) {
            const retained = parseExpenseRecoveryRaw(observed, actorId, tournamentId);
            setLocked(retained);
            setMessage("Another expense recovery record was saved before this request. Its bytes remain unchanged.");
            return;
          }
          setAppRecoveryItem(window.sessionStorage, storageKey, raw);
          if (window.sessionStorage.getItem(storageKey) !== raw) throw new Error("recovery_write_unconfirmed");
          pending = parseExpenseRecoveryRaw(raw, actorId, tournamentId);
        } catch {
          setMessage("This browser cannot safely retain an expense request for recovery. Enable session storage first.");
          return;
        }
      }
      if (!pending || pending.status === "unknown") return;
      if (!isActive(token)) return;
      setBusy(true); setLocked(pending); setMessage(null);
      const path = operationType === "record_tournament_expense" ? "record" : "void";
      const outcome = await trackAppRecoveryWrite(async () => {
        if (!isActive(token)) return "superseded" as const;
        const response = await fetch(`/api/v1/tournaments/${tournamentId}/expenses/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-expected-actor-id": actorId },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify(body),
        });
        const result: unknown = await response.json().catch(() => null);
        if (!isActive(token)) return "superseded" as const;
        const directAccepted = response.ok && (operationType === "record_tournament_expense"
          ? isRecordedExpense(result, body as ExpenseRecordRequest)
          : isVoidedExpense(result, body as ExpenseVoidRequest));
        const directRejected = response.status === 409 && isRejectedExpense(result, pending.recovery);
        if (!directAccepted && !directRejected) return "unresolved" as const;
        const confirmed = await reconcile(pending.recovery);
        if (!isActive(token)) return "superseded" as const;
        if (confirmed !== (directAccepted ? "accepted" : "rejected")) return "unresolved" as const;
        try {
          if (window.sessionStorage.getItem(storageKey) !== pending.raw) return "changed" as const;
          window.sessionStorage.removeItem(storageKey);
          return window.sessionStorage.getItem(storageKey) === null ? confirmed : "unresolved" as const;
        } catch { return "unresolved" as const; }
      });
      if (!isActive(token)) return;
      if (outcome === "accepted") {
        setLocked(null); setDescription(""); setAmount(""); router.refresh(); return;
      }
      if (outcome === "rejected") {
        setLocked(null); setMessage("The server rejected that expense action; the ledger was not changed."); router.refresh(); return;
      }
      if (outcome === "changed") {
        setLocked(readExpenseRecovery(window.sessionStorage, storageKey, actorId, tournamentId) ?? pending);
        setMessage("The retained expense request changed while the write was pending. The newer bytes remain saved.");
        return;
      }
      setMessage("The expense action is unresolved. Its exact recovery record remains saved.");
    } catch {
      if (isActive(token)) {
        setMessage("The expense action is unresolved. Its exact recovery record remains saved until safely reconciled.");
      }
    } finally {
      if (isActive(token)) {
        inFlight.current = false; setBusy(false);
      }
    }
  }

  return <section className="policy-settings" aria-labelledby="expenses-title">
    <h2 id="expenses-title">Tournament expenses</h2>
    <p>{syntheticMode ? "Fixture expenses are simulated evidence only; no actual purchase or disbursement is claimed." : null} Active expense total: <strong>${(activeExpenseTotalMinor / 100).toFixed(2)} USD</strong>. This ledger is private and not reconciled with payouts, Q-pools, sanctioning fees, or results.</p>
    <form onSubmit={(event) => { event.preventDefault(); void submitRecord(); }}>
      <fieldset disabled={!ready || busy || locked?.status === "unknown" || ((locked?.status === "current" || locked?.status === "legacy") && locked.recovery.operationType === "void_tournament_expense")}>
        <legend>{syntheticMode ? "Add simulated fixture expense" : "Add expense"}</legend>
        <label>{syntheticMode ? "Expense detail after required synthetic label" : "Description"}
          <textarea required maxLength={syntheticMode ? 178 : 200} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>Amount in USD
          <input required inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <button className="primary" type="submit">{syntheticMode ? "Add simulated expense" : "Add Expense"}</button>
      </fieldset>
    </form>
    {expenses.length ? <ul className="correction-list">{expenses.map((expense) => <ExpenseRow
      key={expense.expenseId}
      expense={expense}
      disabled={!ready || busy || (!!locked && (locked.status === "unknown" || locked.recovery.expenseId !== expense.expenseId))}
      onVoid={(entry, reason) => void submitVoid(entry, reason)}
    />)}</ul> : <p>No expenses have been recorded.</p>}
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </section>;
}
