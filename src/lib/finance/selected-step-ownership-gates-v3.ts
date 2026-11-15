import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
/** Closed until SQL, signed-in roles and retained-request recovery are verified. */
export const selectedStepOwnershipPageEnabledV3=()=>integratedTestFeatureEnabled();
export const selectedStepOwnershipRoutesEnabledV3=()=>integratedTestFeatureEnabled();
export const selectedStepOwnershipWritesVerifiedV3=()=>integratedTestFeatureEnabled();
