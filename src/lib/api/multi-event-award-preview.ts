import { isUuid } from "./validation.ts";
import { isSimulatedFinanceSelector, projectSimulatedFinanceSelector } from "./simulated-finance-selector.ts";
import { isPreliminaryEventStandings, type PreliminaryEventStandings } from "../results/preliminary-standings-contract.ts";

type Row = Record<string, unknown>;
const object = (x: unknown): x is Row => !!x && typeof x === "object" && !Array.isArray(x);
const keys = (x: Row, names: string[]) => Object.keys(x).length === names.length && names.every(n => Object.hasOwn(x, n));
const minor = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0 && x <= 100_000_000;
const digest = (x: unknown) => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
export type NamedPreview = { status: "preview"; eventName: string; sourceDigest: string; baseIncomeMinor: number; qIncomeMinor: number; sideIncomeMinor: number; expenseMinor: number; benefitMinor: number; requiredFundingMinor: number; restrictedResidualMinor: number; regularAwards: { participantId: string; name: string; bandStart: number; bandEnd: number; amountMinor: number }[]; pools: { name: string; kind: "q" | "side"; fundMinor: number; awards: { participantId: string; name: string; amountMinor: number; kind: "award" | "refund" }[] }[] };

/** Validate all three independently scoped sources before joining names. */
export function namedMultiEventAwardPreview(value: unknown, selectorValue: unknown, standingsValue: unknown, tournamentId: string, eventId: string): NamedPreview | null {
  if (!object(value) || !keys(value, ["status", "eventId", "sourceDigest", "financialSourceDigest", "baseIncomeMinor", "qIncomeMinor", "sideIncomeMinor", "expenseMinor", "benefitMinor", "requiredFundingMinor", "restrictedResidualMinor", "regularAwards", "pools", "accountingAvailable", "moneyMoved"]) || value.status !== "preview" || value.eventId !== eventId || !digest(value.sourceDigest) || !digest(value.financialSourceDigest) || value.accountingAvailable !== false || value.moneyMoved !== false) return null;
  const amountKeys = ["baseIncomeMinor", "qIncomeMinor", "sideIncomeMinor", "expenseMinor", "benefitMinor", "requiredFundingMinor", "restrictedResidualMinor"] as const;
  if (!amountKeys.every(k => minor(value[k])) || !isSimulatedFinanceSelector(selectorValue, tournamentId, eventId) || !object(selectorValue) || selectorValue.status !== "available" || !isPreliminaryEventStandings(standingsValue) || standingsValue.tournamentId !== tournamentId || standingsValue.eventId !== eventId || !standingsValue.scheduledScorecardsComplete) return null;
  const standings = standingsValue as PreliminaryEventStandings;
  const selector = projectSimulatedFinanceSelector(selectorValue) as { eventName: string; sources: { sourceDigest: string }; participants: { participantId: string; name: string; receiptRecorded: boolean; elections: { policyId: string; electionId: string; elected: boolean }[] }[]; pools: { policyId: string | null; definitionId: string; name: string; kind: "q" | "side"; feeMinor: number }[] };
  if (selector.sources.sourceDigest !== value.financialSourceDigest) return null;
  if (selector.eventName !== standings.eventName || !Array.isArray(value.regularAwards) || ![4, 5].includes(value.regularAwards.length) || !Array.isArray(value.pools) || value.pools.length > 8) return null;
  const names = new Map(standings.rows.map(r => [r.participantId, r.displayName]));
  const people = new Map(selector.participants.map(p => [p.participantId, p]));
  const nameFor = (id: unknown) => {
    if (typeof id !== "string" || !isUuid(id)) return undefined;
    const person = people.get(id), display = names.get(id);
    return person && display && display.length <= 160 && !/[\u0000-\u001f\u007f]/.test(display) && display.trim() === person.name.trim() ? display.trim() : undefined;
  };
  const regular: NamedPreview["regularAwards"] = [];
  for (const raw of value.regularAwards) {
    if (!object(raw) || !keys(raw, ["participantId", "bandStart", "bandEnd", "amountMinor"]) || !isUuid(raw.participantId) || !nameFor(raw.participantId) || !minor(raw.amountMinor) || raw.amountMinor === 0 || raw.amountMinor % 500 !== 0 || !Number.isInteger(raw.bandStart) || !Number.isInteger(raw.bandEnd) || Number(raw.bandStart) < 1 || Number(raw.bandEnd) < Number(raw.bandStart) || Number(raw.bandEnd) > value.regularAwards.length) return null;
    regular.push({ participantId: raw.participantId, name: nameFor(raw.participantId)!, bandStart: Number(raw.bandStart), bandEnd: Number(raw.bandEnd), amountMinor: raw.amountMinor });
  }
  const bands = regular.map(r => `${r.bandStart}:${r.bandEnd}`).sort();
  const expectedBands = regular.length === 4 ? ["1:1", "2:2", "3:4", "3:4"] : ["1:1", "2:2", "3:4", "3:4", "5:5"];
  if (new Set(regular.map(r => r.participantId)).size !== regular.length || bands.join(",") !== expectedBands.join(",") || regular.some(r => regular.filter(x => x.bandStart === r.bandStart && x.bandEnd === r.bandEnd).some(x => x.amountMinor !== r.amountMinor)) || regular.some(r => regular.some(x => r.bandStart < x.bandStart && r.amountMinor < x.amountMinor))) return null;
  const pools: NamedPreview["pools"] = []; const seenPolicies = new Set<string>();
  for (const raw of value.pools) {
    if (!object(raw) || !keys(raw, ["policyId", "poolDefinitionId", "kind", "sourceComponents", "calculation"]) || !isUuid(raw.policyId) || !isUuid(raw.poolDefinitionId) || (raw.kind !== "q" && raw.kind !== "side") || seenPolicies.has(raw.policyId) || !Array.isArray(raw.sourceComponents) || raw.sourceComponents.length > 256 || !object(raw.calculation)) return null;
    seenPolicies.add(raw.policyId);
    const def = selector.pools.find(p => p.policyId === raw.policyId && p.definitionId === raw.poolDefinitionId && p.kind === raw.kind);
    const c = raw.calculation;
    if (!def || def.feeMinor < 500 || def.feeMinor % 500 !== 0 || !keys(c, ["status", "fundMinor", "awards", "moneyMoved"]) || c.status !== "calculated" || c.moneyMoved !== false || !minor(c.fundMinor) || !Array.isArray(c.awards) || c.awards.length > 256) return null;
    const componentElection = new Set<string>(); const componentReceipt = new Set<string>();
    for (const item of raw.sourceComponents) {
      if (!object(item) || !keys(item, ["receiptId", "electionId", "amountMinor"]) || !isUuid(item.receiptId) || !isUuid(item.electionId) || item.amountMinor !== def.feeMinor || componentElection.has(item.electionId) || componentReceipt.has(item.receiptId)) return null;
      componentElection.add(item.electionId); componentReceipt.add(item.receiptId);
    }
    if (c.fundMinor !== raw.sourceComponents.length * def.feeMinor) return null;
    const eligible = new Set(selector.participants.filter(p => p.receiptRecorded && p.elections.some(e => e.policyId === raw.policyId && e.elected && componentElection.has(e.electionId))).map(p => p.participantId));
    if (eligible.size !== raw.sourceComponents.length) return null;
    const awards: NamedPreview["pools"][number]["awards"] = [];
    for (const item of c.awards) {
      if (!object(item) || !keys(item, ["participantId", "amountMinor", "kind"]) || !isUuid(item.participantId) || !eligible.has(item.participantId) || !nameFor(item.participantId) || !minor(item.amountMinor) || item.amountMinor === 0 || item.amountMinor % 500 !== 0 || (item.kind !== "award" && item.kind !== "refund")) return null;
      awards.push({ participantId: item.participantId, name: nameFor(item.participantId)!, amountMinor: item.amountMinor, kind: item.kind });
    }
    if (new Set(awards.map(a => a.participantId)).size !== awards.length || sum(awards.map(a => a.amountMinor)) !== c.fundMinor) return null;
    pools.push({ name: def.name, kind: raw.kind, fundMinor: c.fundMinor, awards });
  }
  if (seenPolicies.size !== selector.pools.length || sum(pools.filter(p => p.kind === "q").map(p => p.fundMinor)) !== value.qIncomeMinor || sum(pools.filter(p => p.kind === "side").map(p => p.fundMinor)) !== value.sideIncomeMinor) return null;
  const base = value.baseIncomeMinor as number, expense = value.expenseMinor as number, benefit = value.benefitMinor as number, funding = value.requiredFundingMinor as number, residual = value.restrictedResidualMinor as number, regularTotal = sum(regular.map(a => a.amountMinor));
  if (benefit > expense || expense > base || funding > 0 && residual > 0 || base + funding !== expense + regularTotal + residual || regularTotal + benefit < Math.ceil(base * 0.85)) return null;
  return { status: "preview", eventName: selector.eventName, sourceDigest: value.sourceDigest as string, baseIncomeMinor: base, qIncomeMinor: value.qIncomeMinor as number, sideIncomeMinor: value.sideIncomeMinor as number, expenseMinor: expense, benefitMinor: benefit, requiredFundingMinor: funding, restrictedResidualMinor: residual, regularAwards: regular, pools };
}
