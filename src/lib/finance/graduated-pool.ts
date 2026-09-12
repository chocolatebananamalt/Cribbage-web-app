export type GraduatedPoolInput = {
  playerCount: number;
  payoutRatio: number;
  entryFeeMinor: number;
};

export type GraduatedPoolEstimate = {
  playerCount: number;
  payoutRatio: number;
  entryFeeMinor: number;
  winnerCount: number;
  fundMinor: number;
  awardsMinor: number[];
  awardTotalMinor: number;
  differenceMinor: number;
  manualAdjustmentRequired: boolean;
};

function whole(value: number) {
  return Number.isInteger(value) && Number.isSafeInteger(value);
}

function roundToFiveDollars(valueMinor: number) {
  return Math.round(valueMinor / 500) * 500;
}

export function estimateGraduatedPool(input: GraduatedPoolInput): GraduatedPoolEstimate {
  const { playerCount, payoutRatio, entryFeeMinor } = input;
  if (!whole(playerCount) || playerCount < 2 || playerCount > 10_000) {
    throw new RangeError("playerCount must be a whole number from 2 through 10000");
  }
  if (!whole(payoutRatio) || payoutRatio < 2 || payoutRatio > playerCount) {
    throw new RangeError("payoutRatio must be a whole number from 2 through playerCount");
  }
  if (!whole(entryFeeMinor) || entryFeeMinor <= 0 || entryFeeMinor > 100_000_000) {
    throw new RangeError("entryFeeMinor must be a positive whole number of cents");
  }

  const winnerCount = Math.ceil(playerCount / payoutRatio);
  const fundMinor = playerCount * entryFeeMinor;
  let denominator = (winnerCount * (winnerCount + 1)) / 2;
  let baseMinor = fundMinor / denominator;
  let awardsMinor: number[];

  if (baseMinor > entryFeeMinor) {
    awardsMinor = Array.from({ length: winnerCount }, (_, index) =>
      roundToFiveDollars(baseMinor * (winnerCount - index)),
    );
  } else {
    const remainingFundMinor = fundMinor - entryFeeMinor * winnerCount;
    denominator -= winnerCount;
    baseMinor = denominator > 0 ? remainingFundMinor / denominator : 0;
    awardsMinor = Array.from({ length: winnerCount }, (_, index) =>
      entryFeeMinor + roundToFiveDollars(baseMinor * (winnerCount - index - 1)),
    );
  }

  const awardTotalMinor = awardsMinor.reduce((sum, amount) => sum + amount, 0);
  const differenceMinor = fundMinor - awardTotalMinor;
  return {
    playerCount,
    payoutRatio,
    entryFeeMinor,
    winnerCount,
    fundMinor,
    awardsMinor,
    awardTotalMinor,
    differenceMinor,
    manualAdjustmentRequired: differenceMinor !== 0,
  };
}
