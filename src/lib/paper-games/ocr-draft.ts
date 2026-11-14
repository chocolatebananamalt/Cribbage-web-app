/** Shared draft validation only. No provider, image I/O or score authority. */
export type OcrDraft = {
  authoritative: false; humanReviewRequired: true; sourceImageQuality: "readable" | "uncertain" | "unreadable";
  playerName: string | null; verificationId: string | null;
  rows: Array<{ gameNumber: number; gamePoints: 0 | 2 | 3 | null; plusPoints: number | null; minusPoints: number | null; opponentName: string | null; opponentVerificationId: string | null; confidence: number }>;
  warnings: string[];
};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);
const boundedText = (value: unknown, maximum: number) => typeof value === "string" && value.length <= maximum && new TextEncoder().encode(value).length <= maximum * 4;
/** Shared permissive draft-cell validation; incomplete cells still need review. */
export function isDraftScoreCells(candidate:{gamePoints:unknown;plusPoints:unknown;minusPoints:unknown}){
 const point=(entry:unknown)=>entry===null||(Number.isInteger(entry)&&(entry as number)>=1&&(entry as number)<=121);
 return [0,2,3,null].includes(candidate.gamePoints as 0|2|3|null)&&point(candidate.plusPoints)&&point(candidate.minusPoints)
  &&!(candidate.plusPoints!==null&&candidate.minusPoints!==null)&&!(candidate.gamePoints===0&&candidate.plusPoints!==null)
  &&!([2,3].includes(candidate.gamePoints as number)&&candidate.minusPoints!==null);
}

export function isOcrDraft(value: unknown): value is OcrDraft {
  if (!object(value) || !exact(value, ["authoritative", "humanReviewRequired", "sourceImageQuality", "playerName", "verificationId", "rows", "warnings"])) return false;
  if (value.authoritative !== false || value.humanReviewRequired !== true || !["readable","uncertain","unreadable"].includes(value.sourceImageQuality as string)) return false;
  if (!(value.playerName === null || boundedText(value.playerName, 200)) || !(value.verificationId === null || (typeof value.verificationId === "string" && /^[A-Z]-[1-9]\d*$/.test(value.verificationId)))) return false;
  if (!Array.isArray(value.warnings) || value.warnings.length > 50 || !value.warnings.every((warning) => boundedText(warning, 500))) return false;
  if (!Array.isArray(value.rows) || value.rows.length > 22) return false;
  const games = new Set<number>();
  return value.rows.every((candidate) => {
    if (!object(candidate) || !exact(candidate, ["gameNumber","gamePoints","plusPoints","minusPoints","opponentName","opponentVerificationId","confidence"])) return false;
    const game = candidate.gameNumber;
    if (!Number.isInteger(game) || (game as number) < 1 || (game as number) > 22 || games.has(game as number)) return false;
    games.add(game as number);
    return isDraftScoreCells({gamePoints:candidate.gamePoints,plusPoints:candidate.plusPoints,minusPoints:candidate.minusPoints})
      && (candidate.opponentName === null || boundedText(candidate.opponentName, 200))
      && (candidate.opponentVerificationId === null || (typeof candidate.opponentVerificationId === "string" && /^[A-Z]-[1-9]\d*$/.test(candidate.opponentVerificationId)))
      && typeof candidate.confidence === "number" && candidate.confidence >= 0 && candidate.confidence <= 1;
  });
}

