/** Permanent identity and per-game location deliberately use different labels. */
export function GamePlayerLocation({ label, playerId, tableSeat, identityLabel = "ID#" }: {
  label: string; playerId: string; tableSeat: string; identityLabel?: string;
}) {
  const [table, seat] = tableSeat.split("-");
  return <span>{label}: {identityLabel} {playerId}; <strong>Table {table}, Seat {seat}</strong></span>;
}
