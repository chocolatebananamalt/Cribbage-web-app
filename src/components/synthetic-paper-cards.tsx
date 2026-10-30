import { syntheticPaperNotice, type SyntheticPaperArtifact } from "../lib/api/synthetic-paper-evidence";

export function SyntheticPaperCards({ artifact }: { artifact: SyntheticPaperArtifact }) {
  return <section aria-label="Synthetic scorecard evidence"><p role="note"><strong>{syntheticPaperNotice}</strong> Compare the two generated records, then enter each result separately. This rehearsal does not prove physical-paper or independent-human review.</p>
    {(["a", "b"] as const).map(side => {
      const card = side === "a" ? artifact.sideA : artifact.sideB;
      return <details key={side}><summary>Synthetic card {side.toUpperCase()}</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{card.text}</pre>
        <p style={{ overflowWrap: "anywhere" }}>SHA-256: {card.sha256}<br />Evidence reference: {card.reference}</p>
        <a download={`synthetic-${artifact.gameId}-${side}.txt`} href={`data:text/plain;charset=utf-8,${encodeURIComponent(card.text)}`}>Download synthetic card {side.toUpperCase()}</a>
      </details>;
    })}
  </section>;
}
