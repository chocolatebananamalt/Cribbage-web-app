import {syntheticEventNotice,type SyntheticEventContext,type SyntheticEventArtifact}from"../lib/api/synthetic-event-evidence";
export function SyntheticEventNotice({context}:{context:SyntheticEventContext|null|undefined}){
 return context?<aside role="note" className="registration-note"><strong>{syntheticEventNotice}</strong><p>Enrolled synthetic event IDs: {context.eventIds.join(", ")}. Other events retain their ordinary requirements.</p><p>Earlier history retains its original provenance. New rehearsal operations have separately recorded synthetic evidence; nobody is marked paid.</p></aside>:null;
}
export function SyntheticEventArtifactView({artifact}:{artifact:SyntheticEventArtifact}){
 return <details><summary>View simulated {artifact.kind.replaceAll('_',' ')} evidence</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{artifact.text}</pre><p style={{overflowWrap:'anywhere'}}>SHA-256 {artifact.sha256}<br/>{artifact.reference}</p><a download={`synthetic-${artifact.artifactId}.txt`}href={`data:text/plain;charset=utf-8,${encodeURIComponent(artifact.text)}`}>Download simulated outcome evidence</a></details>;
}
