import type {ManualContextV1} from './modern-manual-playoff-contract-v1.ts';
// Read observation remains closed pending genuine two-session provider proof.
export const modernManualObservationEnabledV33=()=>false;
export const manualObservationIntervalV33=10000;
export function manualContextMayBeObservedV33(context:ManualContextV1|null){return !!context&&context.purpose==='player'&&context.ownSubmission!==null&&!context.verified&&!context.seriesComplete&&!context.financialHold;}
