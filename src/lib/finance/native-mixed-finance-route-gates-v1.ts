import 'server-only';
// Route installation is separate from application/cohort access. These stay
// closed until a reviewed release; RPCs independently enforce Director scope.
export const nativeMixedMainFinanceRouteEnabledV1=()=>false;
export const nativeMixedPoolDirectorRouteEnabledV1=()=>false;
