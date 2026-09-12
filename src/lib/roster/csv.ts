import type { RosterCsvRow } from "../api/roster";

const nameHeaders = new Set(["player", "player name", "name", "display name"]);
const emailHeaders = new Set(["email", "email address"]);
const accHeaders = new Set(["acc #", "acc#", "acc number", "acc no", "acc no."]);

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

export function parseRosterCsv(text: string): RosterCsvRow[] {
  const records = rowsFromCsv(text.replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("The CSV must contain a header and at least one player.");
  const headers = records[0].map((header) => header.trim().toLowerCase());
  const nameIndex = headers.findIndex((header) => nameHeaders.has(header));
  const emailIndex = headers.findIndex((header) => emailHeaders.has(header));
  const accIndex = headers.findIndex((header) => accHeaders.has(header));
  if (nameIndex < 0) throw new Error("Add a Player Name or Name column.");
  if (records.length - 1 > 500) throw new Error("Import no more than 500 players at a time.");
  const rows = records.slice(1).map((fields, offset) => {
    const displayName = (fields[nameIndex] ?? "").trim();
    const email = emailIndex < 0 ? "" : (fields[emailIndex] ?? "").trim();
    const accNumber = accIndex < 0 ? "" : (fields[accIndex] ?? "").trim();
    if (!displayName || displayName.length > 160) throw new Error(`Row ${offset + 2} needs a valid player name.`);
    if (email.length > 320 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error(`Row ${offset + 2} has an invalid email address.`);
    if (accNumber.length > 64) throw new Error(`Row ${offset + 2} has an invalid ACC number.`);
    return { displayName, email, accNumber };
  });
  const anonymousNames = new Set<string>(), emails = new Set<string>(), accNumbers = new Set<string>();
  for (const row of rows) {
    const name = row.displayName.trim().toLowerCase().replace(/\s+/g, " ");
    const email = row.email.trim().toLowerCase();
    const accNumber = row.accNumber.trim().toUpperCase().replace(/\s+/g, "");
    if ((email && emails.has(email)) || (accNumber && accNumbers.has(accNumber))
      || (!email && !accNumber && anonymousNames.has(name))) throw new Error(`The file contains a duplicate entry for ${row.displayName}.`);
    if (email) emails.add(email);
    if (accNumber) accNumbers.add(accNumber);
    if (!email && !accNumber) anonymousNames.add(name);
  }
  return rows;
}
