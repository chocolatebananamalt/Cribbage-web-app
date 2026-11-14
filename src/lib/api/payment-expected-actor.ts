import "server-only";

export const paymentExpectedActorHeader = "x-expected-actor-id";
type UserClient = { auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }> } };
const uuid = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);

export function readExpectedPaymentActor(request: Request) {
  const value = request.headers.get(paymentExpectedActorHeader);
  return uuid(value) ? value : null;
}

export async function paymentActorMatches(client: UserClient, expectedActorId: string) {
  const { data, error } = await client.auth.getUser();
  return !error && data.user?.id === expectedActorId;
}
