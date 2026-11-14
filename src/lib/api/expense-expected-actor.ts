import "server-only";

export const expenseExpectedActorHeader = "x-expected-actor-id";

type UserClient = { auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }> } };
const uuid = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);

export function readExpectedExpenseActor(request: Request) {
  const value = request.headers.get(expenseExpectedActorHeader);
  return uuid(value) ? value : null;
}

export async function expenseActorMatches(client: UserClient, expectedActorId: string) {
  const { data, error } = await client.auth.getUser();
  return !error && data.user?.id === expectedActorId;
}
