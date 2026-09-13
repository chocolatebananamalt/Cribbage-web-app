import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("director roster screen includes an actionable registration review queue", () => {
  const page = read("src/app/tournament/[tournamentId]/roster/page.tsx");
  const client = read("src/app/tournament/[tournamentId]/roster/registration-claim-review-client.tsx");
  assert.match(page, /getRegistrationClaimReviewWorkspace/);
  assert.match(page, /RegistrationClaimReviewClient/);
  assert.match(client, /Approve for roster/);
  assert.match(client, /Reject request/);
  assert.match(client, /Reason \(optional\)/);
  assert.match(client, /confirmed this is a different person/);
  assert.match(client, /registration-review-operation:/);
  assert.match(client, /Retry the same protected decision/);
  assert.match(client, /router\.refresh\(\)/);
});

test("registration review renders a deterministic server/client timestamp", () => {
  const client = read("src/app/tournament/[tournamentId]/roster/registration-claim-review-client.tsx");
  assert.match(client, /formatUtcDateTime/);
  assert.match(client, /<time dateTime=\{claim\.submittedAt\}>\{formatUtcDateTime\(claim\.submittedAt\)\}<\/time>/);
  assert.doesNotMatch(client, /new Date\(claim\.submittedAt\)\.toLocaleString\(\)/);
});

test("registration review route keeps identity and authority on the server", () => {
  const route = read("src/app/api/v1/tournaments/[id]/registration-claim-reviews/route.ts");
  const api = read("src/lib/api/registration-claim-review.ts");
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /review_registration_claim/);
  assert.match(route, /p_idempotency_key/);
  assert.doesNotMatch(route, /createServerOnlyAdminClient|service_role/);
  assert.match(api, /rosterCreated === false/);
  assert.match(api, /paymentRecorded === false/);
  assert.match(api, /checkedIn === false/);
});

test("registration review workspace validates the private projection exactly", () => {
  const workspace = read("src/lib/registration-claim-review-workspace.ts");
  assert.match(workspace, /get_registration_claim_review_workspace/);
  assert.match(workspace, /exact\(result, \["claims"\]\)/);
  assert.match(workspace, /collisionClaimIds\.every\(uuid\)/);
  assert.match(workspace, /approved_for_roster/);
});

test("accepted review receipts are bound to the requested decision", async () => {
  const api = await import(pathToFileURL(path.resolve("src/lib/api/registration-claim-review.ts")).href);
  const claimId = "13600000-0000-4000-8000-000000000001";
  const accepted = { status: "approved_for_roster", claimId, decisionId: "13600000-0000-4000-8000-000000000002", rosterCreated: false, paymentRecorded: false, checkedIn: false };
  assert.equal(api.isAcceptedRegistrationClaimReview(accepted, claimId, "approved_for_roster"), true);
  assert.equal(api.isAcceptedRegistrationClaimReview(accepted, claimId, "rejected"), false);
  assert.equal(api.isAcceptedRegistrationClaimReview({ ...accepted, status: "rejected" }, claimId, "approved_for_roster"), false);
});

test("review authority repair precedes replay and gates every audit side effect", () => {
  const sql = read("database/migrations/0136_registration_claim_review_authority_repair.sql");
  const hosted = read("tests/registration-claim-review-authority.sql");
  assert.match(sql, /v_authorized := true;[\s\S]*select \* into v_existing/);
  assert.match(sql, /if v_error = 'idempotency conflict' and v_authorized then/);
  assert.match(sql, /elsif v_authorized and v_tournament_exists then/);
  assert.doesNotMatch(sql.match(/if not exists \([\s\S]*?v_authorized := true;/)?.[0] ?? "", /select \* into v_existing/);
  assert.match(hosted, /revoked director received replay disclosure/);
  assert.match(hosted, /outsider registration review was not denied/);
  assert.match(hosted, /unauthorized registration review created durable noise/);
});
