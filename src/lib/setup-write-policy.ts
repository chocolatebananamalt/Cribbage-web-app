/** New writes must satisfy current policy. Only an authoritative accepted
 * receipt permits an old payload to reach its original hash-checking writer. */
export async function allowSetupWriteOrAcceptedReplay(currentPolicyValid: boolean, acceptedReceipt: () => Promise<boolean>): Promise<boolean> {
  return currentPolicyValid || await acceptedReceipt();
}
