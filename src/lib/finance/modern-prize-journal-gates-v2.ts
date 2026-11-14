import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
/** Literal closed gates until SQL and signed-provider acceptance pass. */
export const modernPrizePageEnabledV2=()=>integratedTestFeatureEnabled();
export const modernPrizeReadRoutesEnabledV2=()=>integratedTestFeatureEnabled();
export const modernPrizeWritesVerifiedV2=()=>integratedTestFeatureEnabled();
