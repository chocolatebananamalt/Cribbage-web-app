export type ExpenseEvent = {
  expenseEventId: string;
  version: number;
  eventType: "recorded" | "voided";
  description: string;
  amountMinor: number;
  currencyCode: "USD";
  voidReason: string | null;
  approvalActorDisplayName: string;
  recordedAt: string;
};

export type ExpenseEntry = {
  expenseId: string;
  expenseVersion: number;
  expenseState: "recorded" | "voided";
  currentExpenseEventId: string | null;
  description: string;
  amountMinor: number;
  currencyCode: "USD";
  history: ExpenseEvent[];
};

export type ExpenseWorkspace = {
  tournamentId: string;
  currencyCode: "USD";
  activeExpenseTotalMinor: number;
  reconciled: false;
  expenses: ExpenseEntry[];
};

export type ExpenseRecordRequest = {
  amountMinor: number;
  description: string;
  idempotencyKey: string;
};

export type ExpenseVoidRequest = {
  expenseId: string;
  expectedExpenseVersion: number;
  expenseEventId: string;
  voidReason: string;
  idempotencyKey: string;
};

export type ExpenseRecoveryRequest = {
  operationType: "record_tournament_expense" | "void_tournament_expense";
  expenseId: string | null;
  expectedExpenseVersion: number;
  expenseEventId: string | null;
  idempotencyKey: string;
};

type ExpenseOutcome = {
  status: "expense_recorded" | "expense_voided";
  expenseId: string;
  expenseEventId: string;
  expenseVersion: number;
  expenseState: "recorded" | "voided";
  amountMinor: number;
  currencyCode: "USD";
  reconciled: false;
  voidedExpenseEventId?: string;
};

const uuid = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
};
const timestamp = (value: unknown): value is string => typeof value === "string"
  && !Number.isNaN(Date.parse(value));
const boundedText = (value: unknown, maxCharacters: number, maxBytes: number) => typeof value === "string"
  && value.trim().length >= 1
  && value.trim().length <= maxCharacters
  && new TextEncoder().encode(value.trim()).length <= maxBytes;
const amount = (value: unknown): value is number => Number.isSafeInteger(value)
  && (value as number) > 0 && (value as number) <= 2147483647;
const operation = (value: unknown): value is ExpenseRecoveryRequest["operationType"] => value === "record_tournament_expense"
  || value === "void_tournament_expense";

export function isExpenseRecordRequest(value: unknown): value is ExpenseRecordRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exactKeys(item, ["amountMinor", "description", "idempotencyKey"])
    && amount(item.amountMinor)
    && boundedText(item.description, 200, 800)
    && uuid(item.idempotencyKey);
}

export function isExpenseVoidRequest(value: unknown): value is ExpenseVoidRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exactKeys(item, ["expenseId", "expectedExpenseVersion", "expenseEventId", "voidReason", "idempotencyKey"])
    && uuid(item.expenseId)
    && Number.isInteger(item.expectedExpenseVersion)
    && (item.expectedExpenseVersion as number) >= 1
    && uuid(item.expenseEventId)
    && boundedText(item.voidReason, 500, 2000)
    && uuid(item.idempotencyKey);
}

export function isExpenseRecoveryRequest(value: unknown): value is ExpenseRecoveryRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!exactKeys(item, ["operationType", "expenseId", "expectedExpenseVersion", "expenseEventId", "idempotencyKey"])
    || !operation(item.operationType) || !uuid(item.idempotencyKey)) return false;
  return item.operationType === "record_tournament_expense"
    ? item.expenseId === null && item.expectedExpenseVersion === 0 && item.expenseEventId === null
    : uuid(item.expenseId) && Number.isInteger(item.expectedExpenseVersion)
      && (item.expectedExpenseVersion as number) >= 1 && uuid(item.expenseEventId);
}

function isOutcome(value: unknown, status: ExpenseOutcome["status"]): value is ExpenseOutcome {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const voided = status === "expense_voided";
  const keys = ["status", "expenseId", "expenseEventId", "expenseVersion", "expenseState", "amountMinor", "currencyCode", "reconciled"];
  if (voided) keys.push("voidedExpenseEventId");
  return exactKeys(item, keys)
    && item.status === status
    && uuid(item.expenseId)
    && uuid(item.expenseEventId)
    && Number.isInteger(item.expenseVersion)
    && (item.expenseVersion as number) === (voided ? 2 : 1)
    && item.expenseState === (voided ? "voided" : "recorded")
    && amount(item.amountMinor)
    && item.currencyCode === "USD"
    && item.reconciled === false
    && (voided ? uuid(item.voidedExpenseEventId) : !("voidedExpenseEventId" in item));
}

export function isRecordedExpense(value: unknown, request: ExpenseRecordRequest) {
  return isOutcome(value, "expense_recorded") && value.amountMinor === request.amountMinor;
}

export function isVoidedExpense(value: unknown, request: ExpenseVoidRequest) {
  return isOutcome(value, "expense_voided")
    && value.expenseId === request.expenseId
    && value.expenseVersion === request.expectedExpenseVersion + 1
    && value.voidedExpenseEventId === request.expenseEventId;
}

export function isRecoveredExpense(value: unknown, request: ExpenseRecoveryRequest) {
  if (request.operationType === "record_tournament_expense") return isOutcome(value, "expense_recorded");
  return isOutcome(value, "expense_voided")
    && value.expenseId === request.expenseId
    && value.expenseVersion === request.expectedExpenseVersion + 1
    && value.voidedExpenseEventId === request.expenseEventId;
}

export function isRejectedExpense(value: unknown, request: ExpenseRecoveryRequest) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const recordCodes = ["authentication_required", "not_director", "idempotency_conflict", "tournament_unavailable", "invalid_request", "expense_recording_rejected"];
  const voidCodes = ["authentication_required", "not_director", "idempotency_conflict", "tournament_unavailable", "expense_unavailable", "stale_expense_history", "current_expense_event_required", "invalid_request", "expense_void_rejected"];
  const codes = request.operationType === "record_tournament_expense" ? recordCodes : voidCodes;
  return exactKeys(item, ["status", "code", "expenseId"])
    && item.status === "rejected"
    && typeof item.code === "string" && codes.includes(item.code)
    && (request.operationType === "record_tournament_expense"
      ? item.expenseId === null : item.expenseId === request.expenseId);
}

function isExpenseEvent(value: unknown): value is ExpenseEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const recorded = item.eventType === "recorded";
  const voided = item.eventType === "voided";
  return exactKeys(item, ["expenseEventId", "version", "eventType", "description", "amountMinor", "currencyCode", "voidReason", "approvalActorDisplayName", "recordedAt"])
    && uuid(item.expenseEventId)
    && Number.isInteger(item.version) && (item.version === 1 || item.version === 2)
    && (recorded || voided)
    && boundedText(item.description, 200, 800)
    && amount(item.amountMinor)
    && item.currencyCode === "USD"
    && (recorded ? item.voidReason === null : boundedText(item.voidReason, 500, 2000))
    && typeof item.approvalActorDisplayName === "string" && item.approvalActorDisplayName.length > 0
    && timestamp(item.recordedAt);
}

function isExpenseEntry(value: unknown): value is ExpenseEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!exactKeys(item, ["expenseId", "expenseVersion", "expenseState", "currentExpenseEventId", "description", "amountMinor", "currencyCode", "history"])
    || !uuid(item.expenseId)
    || !Number.isInteger(item.expenseVersion) || (item.expenseVersion !== 1 && item.expenseVersion !== 2)
    || (item.expenseState !== "recorded" && item.expenseState !== "voided")
    || (item.currentExpenseEventId !== null && !uuid(item.currentExpenseEventId))
    || !boundedText(item.description, 200, 800)
    || !amount(item.amountMinor) || item.currencyCode !== "USD"
    || !Array.isArray(item.history) || !item.history.every(isExpenseEvent)) return false;
  const history = item.history as ExpenseEvent[];
  const version = item.expenseVersion as 1 | 2;
  if (history.length !== version || history[0]?.version !== version) return false;
  if (history.some((event, index) => event.version !== version - index
    || event.eventType !== (event.version === 1 ? "recorded" : "voided")
    || event.description !== item.description || event.amountMinor !== item.amountMinor)) return false;
  return item.expenseState === "recorded"
    ? item.expenseVersion === 1 && item.currentExpenseEventId === history[0]?.expenseEventId
    : item.expenseVersion === 2 && item.currentExpenseEventId === null;
}

export function isExpenseWorkspace(value: unknown, tournamentId: string): value is ExpenseWorkspace {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!exactKeys(item, ["tournamentId", "currencyCode", "activeExpenseTotalMinor", "reconciled", "expenses"])
    || item.tournamentId !== tournamentId || item.currencyCode !== "USD"
    || !Number.isSafeInteger(item.activeExpenseTotalMinor) || (item.activeExpenseTotalMinor as number) < 0
    || item.reconciled !== false || !Array.isArray(item.expenses)
    || !item.expenses.every(isExpenseEntry)) return false;
  const activeTotal = (item.expenses as ExpenseEntry[]).reduce(
    (total, expense) => total + (expense.expenseState === "recorded" ? expense.amountMinor : 0),
    0,
  );
  return Number.isSafeInteger(activeTotal) && activeTotal === item.activeExpenseTotalMinor;
}
