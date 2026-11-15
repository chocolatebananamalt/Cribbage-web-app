/** Wording only: never derives verification from a local entry or transport receipt. */
export function playerStatusCopy(status: string): string {
  const wording: Record<string, string> = {
    "Game verified. The authoritative scorecard is updated.": "Game complete. Your scorecard is updated.",
    "Enter your independent result. It is not verified until both players submit and confirm.": "Enter your result. Both players must submit and confirm before it counts.",
    "Your entry is saved. Required verification is still pending.": "Your result is saved. Waiting for required verification.",
    "Your confirmation is saved. The game will verify after the other player confirms their own entry.": "Your confirmation is saved. Waiting for the other player's confirmation.",
    "Your confirmation is saved. The game will verify after the other player confirms their entry.": "Your confirmation is saved. Waiting for the other player's confirmation.",
  };
  return wording[status] ?? status;
}
