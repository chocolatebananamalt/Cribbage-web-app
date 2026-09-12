/**
 * A pure, non-release Rule 12.2 fixture oracle. It is deliberately separate
 * from persistence and has no authority to change a game, card, standing, or
 * result. A future server-authorized correction workflow must supply the
 * human-selected rule case, preserve both original cards, audit the decision,
 * and apply the resulting projections atomically.
 *
 * Source: ACC Official Tournament Rules 2025, Rule 12.2(a)-(i), cached as
 * public/rulebook/acc-rulebook-2025.pdf, SHA-256
 * DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD.
 */

/**
 * Rule 12.2(a)-(f) and (h) state the corrective disposition. Rule 12.2(g)
 * is the resulting total adjustment and (i) is a notice duty when that
 * correction changes qualifying. Neither (g) nor (i) is a standalone
 * scorecard disposition.
 */
export type Rule12Case = "a" | "b" | "c" | "d" | "e" | "f" | "h";
export type CardOutcome = "win" | "loss";
export type RecordedSpreadColumn = "plus" | "minus" | "blank";

export type Rule12CardClaim = {
  id: "a" | "b";
  apparentQualifier: boolean;
  recordedOutcome: CardOutcome;
  recordedMargin: number | null;
  recordedColumn: RecordedSpreadColumn;
};

export type AdjudicatedCardProjection = {
  id: "a" | "b";
  original: Rule12CardClaim;
  outcome: CardOutcome;
  margin: number;
  plusPoints: number;
  minusPoints: number;
  gamePoints: 0 | 2 | 3;
};

export type Rule12Adjudication = {
  ruleCase: Rule12Case;
  cards: readonly [AdjudicatedCardProjection, AdjudicatedCardProjection];
  /** Rule 12.2(g) applies after every score-changing disposition. */
  totalsMustRecalculate: boolean;
  /** Rule 12.2(i) requires a director notice only when qualification changes. */
  qualificationNoticeRequired: boolean;
};

function require(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError(message);
}

function requireMargin(value: number | null, message: string): number {
  require(Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 121, message);
  return value as number;
}

function projection(original: Rule12CardClaim, outcome: CardOutcome, margin: number): AdjudicatedCardProjection {
  const gamePoints: 0 | 2 | 3 = outcome === "loss" ? 0 : margin >= 31 ? 3 : 2;
  return {
    id: original.id,
    original,
    outcome,
    margin,
    plusPoints: outcome === "win" ? margin : 0,
    minusPoints: outcome === "loss" ? margin : 0,
    gamePoints,
  };
}

function cardsById(cards: readonly Rule12CardClaim[]): readonly [Rule12CardClaim, Rule12CardClaim] {
  require(cards.length === 2, "Rule 12 requires exactly two scorecards.");
  const first = cards[0];
  const second = cards[1];
  require(first.id !== second.id, "Rule 12 requires two distinct scorecard sides.");
  return [first, second];
}

function final(ruleCase: Rule12Case, first: AdjudicatedCardProjection, second: AdjudicatedCardProjection, qualificationChanged: boolean): Rule12Adjudication {
  require(!(ruleCase === "h" && qualificationChanged), "Rule 12.2(h) makes no scorecard change and cannot itself change qualifying.");
  return {
    ruleCase,
    cards: [first, second],
    totalsMustRecalculate: ruleCase !== "h",
    qualificationNoticeRequired: qualificationChanged,
  };
}

/**
 * Applies only a cross-checker's already-selected Rule 12.2 fixture case.
 * It never guesses which rule applies. Rule 12.2(g) is represented by the
 * derived totals on every projection and `totalsMustRecalculate`.
 */
export function adjudicateRule12Fixture(
  ruleCase: Rule12Case,
  inputCards: readonly Rule12CardClaim[],
  options: { qualificationChanged?: boolean } = {},
): Rule12Adjudication {
  const [first, second] = cardsById(inputCards);
  const qualificationChanged = options.qualificationChanged === true;

  if (ruleCase === "a") {
    const qualifier = first.apparentQualifier ? first : second;
    const other = qualifier === first ? second : first;
    require(qualifier.apparentQualifier !== other.apparentQualifier, "Rule 12.2(a) requires one apparent qualifier.");
    require(qualifier.recordedOutcome === "win" && other.recordedOutcome === "loss", "Rule 12.2(a) requires the documented win/loss pattern.");
    const qualifierMargin = requireMargin(qualifier.recordedMargin, "Rule 12.2(a) requires the qualifier's recorded spread.");
    const otherMargin = requireMargin(other.recordedMargin, "Rule 12.2(a) requires the opposing recorded spread.");
    require(qualifierMargin !== otherMargin, "Rule 12.2(a) requires a discrepancy.");
    require(qualifierMargin > otherMargin, "Rule 12.2(a) applies only when the apparent qualifier's entry is favorable.");
    return final(ruleCase, projection(first, first === qualifier ? "win" : "loss", first === qualifier ? otherMargin : first.recordedMargin as number), projection(second, second === qualifier ? "win" : "loss", second === qualifier ? otherMargin : second.recordedMargin as number), qualificationChanged);
  }

  if (ruleCase === "b") {
    require(first.apparentQualifier && second.apparentQualifier, "Rule 12.2(b) requires two apparent qualifiers.");
    require(first.recordedOutcome !== second.recordedOutcome, "Rule 12.2(b) requires the documented win/loss pattern.");
    const firstMargin = requireMargin(first.recordedMargin, "Rule 12.2(b) requires both recorded spreads.");
    const secondMargin = requireMargin(second.recordedMargin, "Rule 12.2(b) requires both recorded spreads.");
    require(firstMargin !== secondMargin, "Rule 12.2(b) requires a discrepancy.");
    return final(ruleCase, projection(first, first.recordedOutcome, secondMargin), projection(second, second.recordedOutcome, firstMargin), qualificationChanged);
  }

  if (ruleCase === "c") {
    const blank = first.recordedMargin === null ? first : second;
    const marked = blank === first ? second : first;
    require(blank.recordedMargin === null && marked.recordedMargin !== null, "Rule 12.2(c) requires exactly one blank point spread.");
    const margin = requireMargin(marked.recordedMargin, "Rule 12.2(c) requires one valid recorded spread.");
    return final(ruleCase, projection(first, first.recordedOutcome, first === blank ? margin : requireMargin(first.recordedMargin, "Rule 12.2(c) requires one valid recorded spread.")), projection(second, second.recordedOutcome, second === blank ? margin : requireMargin(second.recordedMargin, "Rule 12.2(c) requires one valid recorded spread.")), qualificationChanged);
  }

  const firstMargin = requireMargin(first.recordedMargin, "Rule 12.2 requires both recorded spreads.");
  const secondMargin = requireMargin(second.recordedMargin, "Rule 12.2 requires both recorded spreads.");

  if (ruleCase === "d") {
    require(first.recordedOutcome === second.recordedOutcome, "Rule 12.2(d) requires both cards to show the same result.");
    require(first.recordedColumn !== "blank" && second.recordedColumn !== "blank" && first.recordedColumn !== second.recordedColumn, "Rule 12.2(d) requires one plus and one minus column.");
    return final(ruleCase, projection(first, first.recordedColumn === "plus" ? "win" : "loss", firstMargin), projection(second, second.recordedColumn === "plus" ? "win" : "loss", secondMargin), qualificationChanged);
  }

  if (ruleCase === "e") {
    require(first.recordedOutcome === second.recordedOutcome, "Rule 12.2(e) requires both cards to show the same result.");
    require(first.recordedColumn !== "blank" && first.recordedColumn === second.recordedColumn, "Rule 12.2(e) requires both spreads in the same column.");
    return final(ruleCase, projection(first, "loss", firstMargin), projection(second, "loss", secondMargin), qualificationChanged);
  }

  if (ruleCase === "f") {
    require(first.recordedOutcome !== second.recordedOutcome, "Rule 12.2(f) requires exactly one recorded win.");
    require(first.recordedColumn !== "blank" && first.recordedColumn === second.recordedColumn, "Rule 12.2(f) requires both spreads in the same column.");
    return final(ruleCase, projection(first, first.recordedOutcome, firstMargin), projection(second, second.recordedOutcome, secondMargin), qualificationChanged);
  }

  if (ruleCase === "h") {
    const qualifier = first.apparentQualifier ? first : second;
    const other = qualifier === first ? second : first;
    require(qualifier.apparentQualifier !== other.apparentQualifier, "Rule 12.2(h) requires one apparent qualifier.");
    require(qualifier.recordedOutcome === "win" && other.recordedOutcome === "loss", "Rule 12.2(h) requires the documented win/loss pattern.");
    require(requireMargin(qualifier.recordedMargin, "Rule 12.2(h) requires the qualifier's spread.") < requireMargin(other.recordedMargin, "Rule 12.2(h) requires the opposing spread."), "Rule 12.2(h) applies only when the discrepancy is already adverse to the apparent qualifier.");
    return final(ruleCase, projection(first, first.recordedOutcome, firstMargin), projection(second, second.recordedOutcome, secondMargin), qualificationChanged);
  }

  throw new RangeError("Unsupported Rule 12 fixture case.");
}
