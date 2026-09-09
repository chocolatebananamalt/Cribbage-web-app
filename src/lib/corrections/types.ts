export type CorrectionSide = { displayName: string; tableSeat: string };

export type CorrectionProposalCandidate = {
  gameId: string; eventName: string; roundNumber: number; matchInstance: number;
  gameVersion: number; winnerSide: "a" | "b"; margin: number;
  sideA: CorrectionSide; sideB: CorrectionSide;
};

export type PendingCorrectionReview = {
  correctionId: string; gameId: string; eventName: string; roundNumber: number; matchInstance: number;
  baseGameVersion: number; previousWinnerSide: "a" | "b"; previousMargin: number;
  correctedWinnerSide: "a" | "b"; correctedMargin: number; reason: string | null;
  sideA: CorrectionSide; sideB: CorrectionSide;
};

export type CorrectionWorkspace = { proposalCandidates: CorrectionProposalCandidate[]; pendingReviews: PendingCorrectionReview[] };
