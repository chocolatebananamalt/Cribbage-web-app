import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
// Route installation is separate from application/cohort access. These stay
// closed until a reviewed release; RPCs independently enforce Director scope.
export const nativeMixedMainFinanceRouteEnabledV1=()=>integratedTestFeatureEnabled();
export const nativeMixedPoolDirectorRouteEnabledV1=()=>integratedTestFeatureEnabled();
