/** Permanent identity and per-game location deliberately use different labels. */
export function GamePlayerLocation({ label, playerId, tableSeat }: {
  label: string; playerId: string; tableSeat: string;
}) {
  const [table, seat] = tableSeat.split("-");
  return <span>{label}: ID# {playerId}; <strong>Table {table}, Seat {seat}</strong></span>;
}
