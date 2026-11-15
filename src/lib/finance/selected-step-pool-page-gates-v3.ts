import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
/** Closed until database, signed-in provider and recovery acceptance pass. */
export const selectedStepPoolPageEnabledV3=()=>integratedTestFeatureEnabled();
export const selectedStepPoolRoutesEnabledV3=()=>integratedTestFeatureEnabled();
export const selectedStepPoolWritesVerifiedV3=()=>integratedTestFeatureEnabled();
