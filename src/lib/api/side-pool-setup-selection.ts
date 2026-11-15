/** Setup intent only. A published Side Pool policy is a separate audited act. */
export const graduatedSidePoolSetupTypes = [
  'graduated-1-in-4', 'graduated-1-in-6', 'graduated-1-in-8', 'graduated-1-in-10',
] as const;

export type GraduatedSidePoolSetupType = (typeof graduatedSidePoolSetupTypes)[number];
export type SidePoolSetupSelection = {
  /** Immutable setup display name; retained for historical compatibility. */
  poolTypeCode: string;
  entryFeeCents: number;
  note: string;
  /** Missing on legacy setup versions; never infer a historic policy from the name. */
  payoutType?: GraduatedSidePoolSetupType;
};

export function isGraduatedSidePoolSetupType(value: unknown): value is GraduatedSidePoolSetupType {
  return typeof value === 'string' && graduatedSidePoolSetupTypes.some((item) => item === value);
}

export function sidePoolSetupRatio(value: unknown): 4 | 6 | 8 | 10 | null {
  switch (value) {
    case 'graduated-1-in-4': return 4;
    case 'graduated-1-in-6': return 6;
    case 'graduated-1-in-8': return 8;
    case 'graduated-1-in-10': return 10;
    default: return null;
  }
}

/** An omitted name still needs a stable unique setup identity for the existing ledger. */
export function sidePoolDefaultName(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= 6) throw new RangeError('Invalid Side Pool index');
  return `Side Pool ${index + 1}`;
}

export function nextSidePoolDefaultName(existing: readonly string[]): string {
  const names = new Set(existing.map(name => name.trim().toLowerCase()));
  for (let index = 0; index < 6; index++) {
    const candidate = sidePoolDefaultName(index);
    if (!names.has(candidate.toLowerCase())) return candidate;
  }
  throw new RangeError('No Side Pool name available');
}

export function sidePoolOptionalName(value: string, index: number): string {
  return value === sidePoolDefaultName(index) ? '' : value;
}

export function sidePoolNameFromInput(value: string, index: number): string {
  return value.trim() ? value : sidePoolDefaultName(index);
}

/** UI draft parser only. No new ratio policy/range is established here. */
export function sidePoolPayoutTypeFromRatioDraft(value: string): GraduatedSidePoolSetupType | null {
  if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) return null;
  const candidate = `graduated-1-in-${Number(value)}`;
  return isGraduatedSidePoolSetupType(candidate) ? candidate : null;
}
export function sidePoolRatioDraftMessage(value: string): string | null {
  if (sidePoolPayoutTypeFromRatioDraft(value)) return null;
  if (!value) return 'Enter the required payout ratio.';
  if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) return 'Enter a positive whole number.';
  return 'This test version can currently save 1-in-4, 1-in-6, 1-in-8, or 1-in-10. Other ratios need setup and accounting integration; this draft cannot be saved with that ratio.';
}
