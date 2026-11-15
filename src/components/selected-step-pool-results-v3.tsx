import type{SelectedStepPoolResultsV3 as View}from'../lib/results/selected-step-pool-results-v3';
import{SelectedStepPoolReviewV3}from'./selected-step-pool-review-v3';
export function SelectedStepPoolResultsV3({view}:{view:View|null}){
 return <section aria-label="Recorded Pool Awards"><h2>Q-Pool and Side Pool Awards</h2>{!view?<p role="status">Current pool award evidence is unavailable or held for review. Historical receipts are not shown as current awards.</p>:<>
 <p>Recorded Unpaid Awards. Current evidence matched at this read. This does not verify a bank transaction, send money or mark anyone paid.</p>
 <p>Recorded: <time dateTime={view.recordedAt}>{view.recordedAt}</time>.</p>
 <SelectedStepPoolReviewV3 enabled historical recordingControlsAvailable review={view.review}/>
 </>}</section>;
}
