/** Display geometry only. This does not assign seeds, create results, or approve a draw. */
export type BracketSection = {
  id: string;
  label: string;
  columns: { round: number; matchNumbers: number[] }[];
  advancesTo: string | null;
};
export function bracketSections(bracketSize: number): BracketSection[] {
  if (![4, 8, 16, 32, 64, 128, 256].includes(bracketSize)) throw new RangeError("A bracket view needs 4 to 256 power-of-two positions.");
  const regionalSize = Math.min(bracketSize, 64), regionalRounds = Math.log2(regionalSize);
  const regionCount = bracketSize / regionalSize;
  const sections = Array.from({ length: regionCount }, (_, region): BracketSection => ({
    id: `region-${region + 1}`,
    label: regionCount === 1 ? "Whole bracket" : `Region ${region + 1}`,
    columns: Array.from({ length: regionalRounds }, (_, index) => {
      const count = regionalSize / 2 ** (index + 1);
      return { round: index + 1, matchNumbers: Array.from({ length: count }, (_, match) => region * count + match + 1) };
    }),
    advancesTo: regionCount === 1 ? null : `r${regionalRounds + 1}-m${Math.floor(region / 2) + 1}`,
  }));
  if (regionCount > 1) sections.push({
    id: "finals", label: "Final rounds",
    columns: Array.from({ length: Math.log2(regionCount) }, (_, index) => ({
      round: regionalRounds + index + 1,
      matchNumbers: Array.from({ length: regionCount / 2 ** (index + 1) }, (_, match) => match + 1),
    })), advancesTo: null,
  });
  return sections;
}
