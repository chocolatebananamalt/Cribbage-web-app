import "server-only";
import { integratedTestBackendRef, integratedTestUiEnabled } from "../integrated-test-target";
/** Separate opt-in; SQL additionally requires a real operator marker and scope. */
export function fictionalDrawBoundaryEnabled() {
 return integratedTestUiEnabled() && process.env.CRIBBAGE_FICTIONAL_DRAW_BOUNDARY === "1" && integratedTestBackendRef() === "nnhcnvksxgxnpvdqjgpg";
}
