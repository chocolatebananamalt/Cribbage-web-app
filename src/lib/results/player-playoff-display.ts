import { isUuid } from "../api/validation.ts";

export const playoffChartSource = "https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf";
export const playoffDisplayVersion = "acc-2025-chart-display-v2";
/** Literal chart order, columns appended vertically: Rule13.2(c), printed56–57. */
export const verifiedSeedSlots: Readonly<Record<number, readonly number[]>> = Object.freeze({
  4: Object.freeze([1,4,2,3]),
  8: Object.freeze([1,8,4,5,3,6,2,7]),
  16: Object.freeze([1,16,8,9,5,12,4,13,3,14,6,11,7,10,2,15]),
  32: Object.freeze([1,32,16,17,9,24,8,25,5,28,12,21,13,20,4,29,3,30,14,19,11,22,6,27,7,26,10,23,15,18,2,31]),
  64: Object.freeze([1,64,32,33,16,49,17,48,9,56,24,41,25,40,8,57,5,60,28,37,12,53,21,44,13,52,20,45,29,36,4,61,3,62,30,35,14,51,19,46,11,54,22,43,27,38,6,59,7,58,26,39,10,55,23,42,15,50,18,47,31,34,2,63]),
});
export type PlayoffDisplayPlayer = { participantId: string; displayName: string; tournamentId: string; seed: number };
export type PlayoffDisplayResult = { matchId: string; sideAId: string; sideBId: string; parentBindings: [string | null, string | null]; bracketVersion: typeof playoffDisplayVersion; winnerId: string; resultId: string; sourceSeriesOrdinal: number | null; revision: number; qualificationVersionId: string; sourceDigest: string; provenance: "canonical-verified" | "director-reviewed" | "synthetic-example" };
export type PlayoffDisplayInput = {
  kind: "player-playoff-display-input-v2"; tournamentId: string; eventId: string; qualificationVersionId: string; sourceDigest: string;
  sourceCurrent: boolean; qualificationReviewed: boolean; tiesResolved: boolean; eventType: "main" | "regular-consolation" | "consy-lite";
  entrantCount: number; qualifierCount: number; players: PlayoffDisplayPlayer[]; results: PlayoffDisplayResult[];
};
export type PlayoffDisplaySide = { player: PlayoffDisplayPlayer | null; fromMatch: string | null; absentSeed: number | null };
export type PlayoffDisplayMatch = { matchId: string; round: number; number: number; sides: [PlayoffDisplaySide, PlayoffDisplaySide]; status: "bye" | "ready" | "awaiting-result" | "recorded"; winnerId: string | null; result: PlayoffDisplayResult | null };
export type PlayoffDisplay = { status: "available"; version: typeof playoffDisplayVersion; sourceUrl: string; qualificationVersionId: string; sourceDigest: string; bracketSize: number; byeCount: number; byeSeedRanks: number[]; players: PlayoffDisplayPlayer[]; rounds: { round: number; label: string; matches: PlayoffDisplayMatch[] }[]; champion: PlayoffDisplayPlayer | null; officialAuthorityEstablished: false } | { status: "blocked"; code: "invalid_public_projection" | "source_review_required" | "consy_lite_unsupported" | "small_field_unsupported" | "placement_above_64_unverified" | "result_source_changed" | "result_path_unresolved" };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
const digest = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const whole = (v: unknown, min: number, max: number) => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
function isInput(v: unknown): v is PlayoffDisplayInput {
  if (!object(v) || !exact(v, ["kind","tournamentId","eventId","qualificationVersionId","sourceDigest","sourceCurrent","qualificationReviewed","tiesResolved","eventType","entrantCount","qualifierCount","players","results"])
    || v.kind !== "player-playoff-display-input-v2" || ![v.tournamentId,v.eventId,v.qualificationVersionId].every(uuid) || !digest(v.sourceDigest)
    || ![v.sourceCurrent,v.qualificationReviewed,v.tiesResolved].every(x => typeof x === "boolean") || !["main","regular-consolation","consy-lite"].includes(v.eventType as string)
    || !whole(v.qualifierCount, 1, 500) || !whole(v.entrantCount, 1, 2000) || !Array.isArray(v.players) || v.players.length > 500 || !Array.isArray(v.results) || v.results.length > 499) return false;
  if (!v.players.every(p => object(p) && exact(p,["participantId","displayName","tournamentId","seed"]) && uuid(p.participantId)
    && typeof p.displayName === "string" && p.displayName.trim() === p.displayName && p.displayName.length > 0 && p.displayName.length <= 200 && !/[\u0000-\u001f\u007f]/.test(p.displayName)
    && typeof p.tournamentId === "string" && /^[A-Z]-[1-9][0-9]{0,3}$/.test(p.tournamentId) && whole(p.seed,1,500))) return false;
  const players = v.players as PlayoffDisplayPlayer[];
  if (new Set(players.map(p => p.participantId)).size !== players.length || new Set(players.map(p => p.tournamentId)).size !== players.length || new Set(players.map(p => p.seed)).size !== players.length) return false;
  if (!v.results.every(r => object(r) && exact(r,["matchId","sideAId","sideBId","parentBindings","bracketVersion","winnerId","resultId","sourceSeriesOrdinal","revision","qualificationVersionId","sourceDigest","provenance"])
    && typeof r.matchId === "string" && /^r[1-7]-m(?:[1-9]|[1-6][0-9])$/.test(r.matchId) && uuid(r.winnerId) && uuid(r.resultId) && uuid(r.qualificationVersionId)
    && uuid(r.sideAId) && uuid(r.sideBId) && r.sideAId !== r.sideBId && r.bracketVersion === playoffDisplayVersion
    && Array.isArray(r.parentBindings) && r.parentBindings.length === 2 && r.parentBindings.every(b => b === null || typeof b === "string" && b.length <= 100)
    && (r.sourceSeriesOrdinal === null || whole(r.sourceSeriesOrdinal,1,63))
    && digest(r.sourceDigest) && whole(r.revision,1,2147483647) && ["canonical-verified","director-reviewed","synthetic-example"].includes(r.provenance as string))) return false;
  const results = v.results as PlayoffDisplayResult[];
  return new Set(results.map(r => r.matchId)).size === results.length && new Set(results.map(r => `${r.resultId}:${r.sourceSeriesOrdinal ?? "match"}`)).size === results.length
    && results.every(r => results.filter(x => x.resultId === r.resultId).every(x => x.revision === r.revision && (x.sourceSeriesOrdinal === null) === (r.sourceSeriesOrdinal === null)));
}
/** Whitelisted read-only DTO only. No ranking, result recording, MRP, payout or public-access authority. */
export function projectPlayerPlayoff(input: unknown): PlayoffDisplay {
  const blocked = (code: Extract<PlayoffDisplay,{status:"blocked"}>["code"]): PlayoffDisplay => ({status:"blocked",code});
  if (!isInput(input)) return blocked("invalid_public_projection");
  if (!input.sourceCurrent || !input.qualificationReviewed || !input.tiesResolved) return blocked("source_review_required");
  if (input.eventType === "consy-lite") return blocked("consy_lite_unsupported");
  const q = input.players.length;
  if (q !== input.qualifierCount || q !== Math.ceil(input.entrantCount / 4)) return blocked("invalid_public_projection");
  if (q > 64) return blocked("placement_above_64_unverified");
  if (input.entrantCount < 12 || q < 4) return blocked("small_field_unsupported");
  const players = [...input.players].sort((a,b) => a.seed-b.seed).map(p => ({...p}));
  if (!players.every((p,i) => p.seed === i+1)) return blocked("invalid_public_projection");
  if (input.results.some(r => r.qualificationVersionId !== input.qualificationVersionId || r.sourceDigest !== input.sourceDigest)) return blocked("result_source_changed");
  const bracketSize = [4,8,16,32,64].find(n => n >= q)!;
  const slots = verifiedSeedSlots[bracketSize];
  const results = new Map(input.results.map(r => [r.matchId,r]));
  const consumed = new Set<string>();
  const rounds: Extract<PlayoffDisplay,{status:"available"}>["rounds"] = [];
  let prior: PlayoffDisplayMatch[] = [];
  for (let round = 1, count = bracketSize/2; count >= 1; round++, count/=2) {
    const matches: PlayoffDisplayMatch[] = [];
    for (let index=0; index<count; index++) {
      const sides = [0,1].map(offset => {
        if (round === 1) { const seed = slots[index*2+offset]; return {player: players[seed-1] ?? null, fromMatch:null, absentSeed: seed>q?seed:null}; }
        const feed = prior[index*2+offset];
        return {player: players.find(p => p.participantId === feed.winnerId) ?? null, fromMatch:feed.matchId, absentSeed:null};
      }) as [PlayoffDisplaySide,PlayoffDisplaySide];
      const matchId = `r${round}-m${index+1}`, result = results.get(matchId) ?? null;
      const present = sides.filter(s => s.player !== null);
      let status: PlayoffDisplayMatch["status"] = present.length === 2 ? "ready" : "awaiting-result";
      let winnerId: string|null = null;
      if (round === 1 && present.length === 1) { status="bye"; winnerId=present[0].player!.participantId; }
      if (result) {
        const parentBindings = round === 1 ? [null,null] : prior.slice(index*2,index*2+2).map(feed => feed.status === "bye"
          ? `bye:${input.qualificationVersionId}:${feed.matchId}` : feed.result ? `${feed.result.resultId}:${feed.result.revision}${feed.result.sourceSeriesOrdinal === null ? "" : `:series-${feed.result.sourceSeriesOrdinal}`}` : null);
        if (status !== "ready" || result.sideAId !== sides[0].player?.participantId || result.sideBId !== sides[1].player?.participantId
          || result.parentBindings.some((b,i) => b !== parentBindings[i]) || !sides.some(s => s.player?.participantId === result.winnerId)) return blocked("result_path_unresolved");
        status="recorded"; winnerId=result.winnerId; consumed.add(matchId);
      }
      matches.push({matchId,round,number:index+1,sides,status,winnerId,result:result?{...result,parentBindings:[...result.parentBindings]}:null});
    }
    rounds.push({round,label:count===1?"Championship":`Round ${round}`,matches}); prior=matches;
  }
  if (consumed.size !== results.size) return blocked("result_path_unresolved");
  return {status:"available",version:playoffDisplayVersion,sourceUrl:playoffChartSource,qualificationVersionId:input.qualificationVersionId,sourceDigest:input.sourceDigest,bracketSize,
    byeCount:bracketSize-q,byeSeedRanks:Array.from({length:bracketSize-q},(_,i)=>i+1),players,rounds,
    champion:players.find(p=>p.participantId===prior[0].winnerId)??null,officialAuthorityEstablished:false};
}

export function playerPlayoffNext(display: PlayoffDisplay, participantId: string) {
  if (display.status !== "available") return {status:"unavailable" as const};
  const player = display.players.find(p => p.participantId===participantId);
  if (!player) return {status:"not_in_bracket" as const};
  if (display.champion?.participantId===participantId) return {status:"champion" as const,player};
  for (const round of display.rounds) for (const match of round.matches) {
    if (!match.sides.some(s=>s.player?.participantId===participantId)) continue;
    if (match.status==="recorded" && match.winnerId!==participantId) return {status:"eliminated" as const,player,round:round.round};
    if (match.status==="ready" || match.status==="awaiting-result") {
      const other=match.sides.find(s=>s.player?.participantId!==participantId)!;
      return {status:other.player?"opponent-known" as const:"waiting-opponent" as const,player,opponent:other.player,round:round.round,matchId:match.matchId,fromMatch:other.fromMatch};
    }
  }
  return {status:"unavailable" as const};
}
