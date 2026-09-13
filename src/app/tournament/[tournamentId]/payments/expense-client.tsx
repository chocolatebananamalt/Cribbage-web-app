"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  isExpenseRecordRequest,
  isExpenseRecoveryRequest,
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

type Envelope = ExpenseRecoveryRequest & { kind: "expense"; digest: string };

function validEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const recovery = {
    operationType: item.operationType,
    expenseId: item.expenseId,
    expectedExpenseVersion: item.expectedExpenseVersion,
    expenseEventId: item.expenseEventId,
    idempotencyKey: item.idempotencyKey,
  };
  return item.kind === "expense" && typeof item.digest === "string"
    && /^[a-f0-9]{64}$/.test(item.digest) && isExpenseRecoveryRequest(recovery);
}

function readEnvelope(key: string) {
  try {
    const raw = window.sessionStorage.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return validEnvelope(value) ? value : null;
  } catch {
    return null;
  }
}

function writeEnvelope(key: string, value: Envelope) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function clearEnvelope(key: string) {
  try { window.sessionStorage.removeItem(key); } catch { /* Server state is authoritative. */ }
}

function clearOtherActors(storage: Storage, actorId: string) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith("expense-operation:")
      && !key.startsWith(`expense-operation:${actorId}:`)) storage.removeItem(key);
  }
}

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
        <label>Reason for void
          <textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <button className="secondary" type="submit">Void expense</button>
      </fieldset>
    </form> : null}
  </li>;
}

export default function ExpenseClient({
  actorId,
  tournamentId,
  activeExpenseTotalMinor,
  expenses,
}: {
  actorId: string;
  tournamentId: string;
  activeExpenseTotalMinor: number;
  expenses: ExpenseEntry[];
}) {
  const router = useRouter();
  const storageKey = `expense-operation:${actorId}:${tournamentId}`;
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState<Envelope | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const inFlight = useRef(false);

  const reconcile = useCallback(async (envelope: Envelope) => {
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/expenses/reconciliation`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(envelope),
      });
      const payload: unknown = response.ok ? await response.json().catch(() => null) : null;
      if (!payload || typeof payload !== "object" || !("result" in (payload as Record<string, unknown>))) {
        return "unresolved";
      }
      const result = (payload as Record<string, unknown>).result;
      if (result === null) return "none";
      if (isRecoveredExpense(result, envelope)) return "accepted";
      return isRejectedExpense(result, envelope) ? "rejected" : "unresolved";
    } catch {
      return "unresolved";
    }
  }, [tournamentId]);

  useEffect(() => {
    clearOtherActors(window.sessionStorage, actorId);
    void (async () => {
      const saved = readEnvelope(storageKey);
      if (!saved) { setReady(true); return; }
      const state = await reconcile(saved);
      if (state === "accepted") {
        clearEnvelope(storageKey); setReady(true); router.refresh(); return;
      }
      if (state === "rejected") {
        clearEnvelope(storageKey);
        setMessage("The prior expense action was rejected; the ledger was not changed.");
        setReady(true); router.refresh(); return;
      }
      if (state === "none") {
        clearEnvelope(storageKey);
        setMessage("A prior expense action did not reach the server. Re-enter it before trying again.");
        setReady(true); return;
      }
      setLocked(saved);
      setMessage("A prior expense action is unresolved. Re-enter its original details exactly before retrying.");
      setReady(true);
    })();
  }, [actorId, reconcile, router, storageKey]);

  async function submitRecord() {
    const amountMinor = dollarsToMinor(amount);
    const idempotencyKey = locked?.idempotencyKey ?? crypto.randomUUID();
    const body: ExpenseRecordRequest = { amountMinor: amountMinor ?? 0, description, idempotencyKey };
    if (!isExpenseRecordRequest(body)) {
      setMessage("Enter a positive USD amount and a description of 200 characters or fewer.");
      return;
    }
    await submit("record_tournament_expense", body, null);
  }

  async function submitVoid(expense: ExpenseEntry, voidReason: string) {
    if (!expense.currentExpenseEventId) return;
    const idempotencyKey = locked?.idempotencyKey ?? crypto.randomUUID();
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
    if (!ready || busy || inFlight.current) return;
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
      let envelope = locked;
      if (envelope) {
        if (envelope.operationType !== operationType || envelope.expenseId !== expenseId
          || envelope.expectedExpenseVersion !== expectedExpenseVersion
          || envelope.expenseEventId !== expenseEventId || envelope.digest !== operationDigest) {
          setMessage("This action is locked. Re-enter the original details exactly or refresh after it resolves.");
          return;
        }
      } else {
        envelope = {
          kind: "expense", operationType, expenseId, expectedExpenseVersion,
          expenseEventId, idempotencyKey: body.idempotencyKey, digest: operationDigest,
        };
        if (!writeEnvelope(storageKey, envelope)) {
          setMessage("This browser cannot safely retain an expense request for recovery. Enable session storage first.");
          return;
        }
      }
      setBusy(true); setLocked(envelope); setMessage(null);
      const path = operationType === "record_tournament_expense" ? "record" : "void";
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/expenses/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const result: unknown = await response.json().catch(() => null);
      const accepted = response.ok && (operationType === "record_tournament_expense"
        ? isRecordedExpense(result, body as ExpenseRecordRequest)
        : isVoidedExpense(result, body as ExpenseVoidRequest));
      if (accepted) {
        clearEnvelope(storageKey); setLocked(null); setDescription(""); setAmount(""); router.refresh(); return;
      }
      if (response.status === 409 && isRejectedExpense(result, envelope)) {
        clearEnvelope(storageKey); setLocked(null);
        setMessage("The server rejected that expense action; the ledger was not changed.");
        router.refresh(); return;
      }
      setMessage("The expense action is unresolved. It remains locked until safely reconciled.");
    } catch {
      setMessage("The expense action is unresolved. It remains locked until safely reconciled.");
    } finally {
      inFlight.current = false; setBusy(false);
    }
  }

  return <section className="policy-settings" aria-labelledby="expenses-title">
    <h2 id="expenses-title">Tournament expenses</h2>
    <p>Active expense total: <strong>${(activeExpenseTotalMinor / 100).toFixed(2)} USD</strong>. This ledger is private and not reconciled with payouts, Q-pools, sanctioning fees, or results.</p>
    <form onSubmit={(event) => { event.preventDefault(); void submitRecord(); }}>
      <fieldset disabled={!ready || busy || locked?.operationType === "void_tournament_expense"}>
        <legend>Add expense</legend>
        <label>Description
          <textarea required maxLength={200} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>Amount in USD
          <input required inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <button className="primary" type="submit">Add Expense</button>
      </fieldset>
    </form>
    {expenses.length ? <ul className="correction-list">{expenses.map((expense) => <ExpenseRow
      key={expense.expenseId}
      expense={expense}
      disabled={!ready || busy || (!!locked && locked.expenseId !== expense.expenseId)}
      onVoid={(entry, reason) => void submitVoid(entry, reason)}
    />)}</ul> : <p>No expenses have been recorded.</p>}
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </section>;
}
