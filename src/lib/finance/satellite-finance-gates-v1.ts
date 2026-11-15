import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
export const satelliteFinanceRoutesEnabledV1=()=>integratedTestFeatureEnabled();
export const satelliteFinanceAuthoringEnabledV1=()=>integratedTestFeatureEnabled();
export const satelliteFinanceWritesVerifiedV1=()=>integratedTestFeatureEnabled();
