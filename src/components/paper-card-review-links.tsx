export function PaperCardReviewLinks({
  gameId,
  sides,
  tournamentId,
}: {
  gameId: string;
  sides: Array<{ cardSide: "a" | "b"; label: string }>;
  tournamentId: string;
}) {
  return <div className="correction-actions" aria-label="Stored paper-card evidence">
    {sides.map((side) => <a
      className="secondary button-link"
      href={`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/paper-card-review-image?gameId=${encodeURIComponent(gameId)}&cardSide=${side.cardSide}`}
      key={side.cardSide}
      rel="noreferrer"
      target="_blank"
    >Open {side.label}&apos;s stored card photo</a>)}
  </div>;
}
