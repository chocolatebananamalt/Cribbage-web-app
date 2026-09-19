import { accIdentityKey, isAccNumber } from "../acc-number.ts";
import type { TournamentDayImportRow, TournamentDayImportWorkspace } from "../api/tournament-day-import";

const firstNameHeaders = new Set(["first name"]);
const lastNameHeaders = new Set(["last name"]);
const emailHeaders = new Set(["email", "email address"]);
const accHeaders = new Set(["acc #", "acc#", "acc number", "acc no", "acc no."]);
const scorecardHeaders = new Set(["scorecard", "scorecard type", "card", "card type"]);
const paymentStatusHeaders = new Set(["payment status", "paid", "payment received"]);
const paymentMethodHeaders = new Set(["payment method", "paid by", "method"]);
const paymentReferenceHeaders = new Set(["payment reference", "payment note", "check #", "check number", "reference"]);

function rowsFromCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"' && value.length === 0) quoted = true;
    else if (character === ",") { row.push(value); value = ""; }
    else if (character === "\n") { row.push(value); rows.push(row); row = []; value = ""; }
    else if (character !== "\r") value += character;
  }
  if (quoted) throw new Error("An entry has an unmatched quotation mark.");
  if (value.length || row.length) { row.push(value); rows.push(row); }
  return rows.filter((fields) => fields.some((field) => field.trim().length));
}

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const normalizeName = (value: string) => normalizeHeader(value).replace(/[^\p{L}\p{N} #:-]+/gu, "");
const eventKey = (name: string) => normalizeName(name);
const poolKey = (name: string) => normalizeName(name);

function parseMoney(raw: string, rowNumber: number, header: string): number {
  const value = raw.trim();
  if (!value) return 0;
  if (/^(yes|y|x|paid)$/i.test(value)) throw new Error(`Row ${rowNumber} column "${header}" needs a dollar amount, not ${value}.`);
  const numeric = value.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(numeric)) throw new Error(`Row ${rowNumber} column "${header}" needs a valid dollar amount.`);
  const [dollars, cents = ""] = numeric.split(".");
  const amount = Number(dollars) * 100 + Number((cents + "00").slice(0, 2));
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100_000_000) throw new Error(`Row ${rowNumber} column "${header}" has an unsupported dollar amount.`);
  return amount;
}

function parsePaymentMethod(raw: string, rowNumber: number): "cash" | "check" | "other" {
  const value = raw.trim().toLowerCase();
  if (!value) return "cash";
  if (value === "cash") return "cash";
  if (value === "check" || value === "cheque") return "check";
  if (["digital", "venmo", "zelle", "other"].includes(value)) return "other";
  throw new Error(`Row ${rowNumber} has an invalid Payment Method. Use Cash, Check, Digital, Venmo, Zelle, or Other.`);
}

function parsePaymentStatus(raw: string, rowNumber: number): "paid" | "unpaid" {
  const value = raw.trim().toLowerCase();
  if (!value || value === "paid" || value === "yes" || value === "y") return "paid";
  if (value === "unpaid" || value === "no" || value === "n" || value === "not paid") return "unpaid";
  throw new Error(`Row ${rowNumber} has an invalid Payment Status. Use Paid or Unpaid.`);
}

type DynamicHeader =
  | { kind: "event_entry"; index: number; eventId: string; header: string }
  | { kind: "q_pool"; index: number; eventId: string; slot: 1 | 2; header: string }
  | { kind: "side_pool"; index: number; eventId: string; poolId: string; header: string };

export function tournamentDayCsvTemplateHeaders(workspace: TournamentDayImportWorkspace): string[] {
  const headers = ["First Name", "Last Name", "Email", "ACC #", "Scorecard Type", "Payment Status", "Payment Method", "Payment Reference"];
  for (const event of workspace.events) {
    headers.push(`${event.name} Entry`);
    for (const slot of event.qPoolSlots) headers.push(`${event.name} Q Pool ${slot}`);
    for (const pool of event.sidePools) headers.push(`${event.name} Side Pool: ${pool.displayName}`);
  }
  return headers;
}

export function parseTournamentDayCsv(text: string, workspace: TournamentDayImportWorkspace): TournamentDayImportRow[] {
  const records = rowsFromCsv(text.replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("The CSV must contain a header and at least one player.");
  if (records.length - 1 > 500) throw new Error("Import no more than 500 players at a time.");

  const headers = records[0].map(normalizeHeader);
  const rawHeaders = records[0].map((header) => header.trim());
  const firstNameIndex = headers.findIndex((header) => firstNameHeaders.has(header));
  const lastNameIndex = headers.findIndex((header) => lastNameHeaders.has(header));
  const emailIndex = headers.findIndex((header) => emailHeaders.has(header));
  const accIndex = headers.findIndex((header) => accHeaders.has(header));
  const scorecardIndex = headers.findIndex((header) => scorecardHeaders.has(header));
  const paymentStatusIndex = headers.findIndex((header) => paymentStatusHeaders.has(header));
  const paymentMethodIndex = headers.findIndex((header) => paymentMethodHeaders.has(header));
  const paymentReferenceIndex = headers.findIndex((header) => paymentReferenceHeaders.has(header));
  if (firstNameIndex < 0 || lastNameIndex < 0 || accIndex < 0 || scorecardIndex < 0) throw new Error("Use required First Name, Last Name, ACC #, and Scorecard Type columns.");

  const eventsByName = new Map<string, TournamentDayImportWorkspace["events"][number]>();
  for (const event of workspace.events) eventsByName.set(eventKey(event.name), event);
  const dynamicHeaders: DynamicHeader[] = [];
  headers.forEach((header, index) => {
    if ([firstNameIndex, lastNameIndex, emailIndex, accIndex, scorecardIndex, paymentStatusIndex, paymentMethodIndex, paymentReferenceIndex].includes(index)) return;
    if (!header) return;
    const sideMatch = header.match(/^(.*?) side pool:\s*(.+)$/);
    if (sideMatch) {
      const event = eventsByName.get(eventKey(sideMatch[1] ?? ""));
      if (!event) throw new Error(`Column "${rawHeaders[index]}" names an event that is not active in this tournament.`);
      const pool = event.sidePools.find((candidate) => poolKey(candidate.displayName) === poolKey(sideMatch[2] ?? ""));
      if (!pool) throw new Error(`Column "${rawHeaders[index]}" names a Side Pool that is not configured for ${event.name}.`);
      dynamicHeaders.push({ kind: "side_pool", index, eventId: event.eventId, poolId: pool.poolId, header: rawHeaders[index] });
      return;
    }
    const qMatch = header.match(/^(.*?) q pool ([12])$/);
    if (qMatch) {
      const event = eventsByName.get(eventKey(qMatch[1] ?? ""));
      const slot = Number(qMatch[2]) as 1 | 2;
      if (!event || !event.qPoolSlots.includes(slot)) throw new Error(`Column "${rawHeaders[index]}" names a Q Pool that is not configured for an active Main or Consolation event.`);
      dynamicHeaders.push({ kind: "q_pool", index, eventId: event.eventId, slot, header: rawHeaders[index] });
      return;
    }
    const entryMatch = header.match(/^(.*?) entry$/);
    if (entryMatch) {
      const event = eventsByName.get(eventKey(entryMatch[1] ?? ""));
      if (!event) throw new Error(`Column "${rawHeaders[index]}" names an event that is not active in this tournament.`);
      dynamicHeaders.push({ kind: "event_entry", index, eventId: event.eventId, header: rawHeaders[index] });
    }
  });
  if (!dynamicHeaders.length) throw new Error("Include at least one event amount column, such as '<Event Name> Entry', '<Event Name> Q Pool 1', or '<Event Name> Side Pool: <Pool Name>'.");

  const seenAcc = new Set<string>();
  return records.slice(1).map((fields, offset) => {
    const rowNumber = offset + 2;
    const firstName = (fields[firstNameIndex] ?? "").trim();
    const lastName = (fields[lastNameIndex] ?? "").trim();
    const email = emailIndex < 0 ? "" : (fields[emailIndex] ?? "").trim();
    const accNumber = (fields[accIndex] ?? "").trim().toUpperCase();
    const suppliedScorecard = (fields[scorecardIndex] ?? "").trim().toLowerCase();
    const paymentStatus = paymentStatusIndex < 0 ? "paid" : parsePaymentStatus(fields[paymentStatusIndex] ?? "", rowNumber);
    const paymentMethod = paymentMethodIndex < 0 ? "cash" : parsePaymentMethod(fields[paymentMethodIndex] ?? "", rowNumber);
    const paymentReference = paymentReferenceIndex < 0 ? "" : (fields[paymentReferenceIndex] ?? "").trim();
    if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80 || `${firstName} ${lastName}`.length > 160) throw new Error(`Row ${rowNumber} needs a valid first and last name.`);
    if (email.length > 320 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error(`Row ${rowNumber} has an invalid email address.`);
    if (!isAccNumber(accNumber)) throw new Error(`Row ${rowNumber} needs a valid ACC # such as HI296 or HI296Y.`);
    const accKey = accIdentityKey(accNumber);
    if (!accKey) throw new Error(`Row ${rowNumber} needs a valid ACC # such as HI296 or HI296Y.`);
    if (seenAcc.has(accKey)) throw new Error(`The file contains a duplicate ACC # identity for ${firstName} ${lastName}.`);
    seenAcc.add(accKey);
    if (suppliedScorecard !== "digital" && suppliedScorecard !== "paper") throw new Error(`Row ${rowNumber} needs Digital or Paper in the Scorecard Type column.`);
    if (paymentReference.length > 100) throw new Error(`Row ${rowNumber} has a payment reference longer than 100 characters.`);

    const eventAmounts = new Map<string, number>();
    const qPoolPayments: TournamentDayImportRow["qPoolPayments"] = [];
    const sidePoolElections: TournamentDayImportRow["sidePoolElections"] = [];
    for (const header of dynamicHeaders) {
      const amountMinor = parseMoney(fields[header.index] ?? "", rowNumber, header.header);
      if (amountMinor <= 0) continue;
      if (header.kind === "event_entry") eventAmounts.set(header.eventId, amountMinor);
      else if (header.kind === "q_pool") qPoolPayments.push({ eventId: header.eventId, qPoolSlot: header.slot, amountMinor });
      else sidePoolElections.push({ eventId: header.eventId, poolId: header.poolId, amountMinor });
    }
    for (const payment of [...qPoolPayments, ...sidePoolElections]) if (!eventAmounts.has(payment.eventId)) eventAmounts.set(payment.eventId, 0);
    if (!eventAmounts.size) throw new Error(`Row ${rowNumber} does not select any event, Q Pool, or Side Pool.`);
    if (paymentMethod === "other" && sidePoolElections.length) throw new Error(`Row ${rowNumber} uses a Side Pool column. Side Pool collection currently accepts Cash or Check in the operational ledger.`);
    return {
      firstName,
      lastName,
      email,
      accNumber,
      scorecardType: suppliedScorecard as "digital" | "paper",
      paymentStatus,
      paymentMethod,
      paymentReference,
      eventEnrollments: Array.from(eventAmounts.entries()).map(([eventId, amountMinor]) => ({ eventId, amountMinor })),
      qPoolPayments,
      sidePoolElections,
    };
  });
}
