import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("stored paper-card reads require an independent authorized official and append an access event", () => {
  const sql = read("database/migrations/0162_authorized_paper_card_human_review.sql");
  assert.match(sql, /create or replace function public\.authorize_paper_card_human_review_v1/);
  assert.match(sql, /role in \('director','co_director','cross_checker'\)/);
  assert.match(sql, /app\.paper_official_is_independent\(p_actor_id,p_tournament_id,p_game_id\)/);
  assert.match(sql, /capture\.actor_profile_id <> p_actor_id/);
  assert.match(sql, /insert into app\.paper_card_storage_access_events/);
  assert.match(sql, /'human_review','Independent paper-card comparison'/);
  assert.match(sql, /revoke all on function public\.authorize_paper_card_human_review_v1[\s\S]+from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.authorize_paper_card_human_review_v1[\s\S]+to service_role/);
});

test("review image route streams integrity-verified private bytes without a public URL", () => {
  const route = read("src/app/api/v1/tournaments/[id]/paper-card-review-image/route.ts");
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /authorize_paper_card_human_review_v1/);
  assert.match(route, /readAndVerifyPaperCard/);
  assert.match(route, /cache-control": "private, no-store"/);
  assert.match(route, /x-content-type-options": "nosniff"/);
  assert.doesNotMatch(route, /createSignedUrl|getPublicUrl/);
});

test("independent paper and hybrid reviews expose the protected stored-photo route", () => {
  const links = read("src/components/paper-card-review-links.tsx");
  const paper = read("src/app/tournament/[tournamentId]/paper-games/paper-game-client.tsx");
  const hybrid = read("src/app/tournament/[tournamentId]/hybrid-games/hybrid-game-client.tsx");
  assert.match(links, /paper-card-review-image\?gameId=/);
  assert.match(paper, /PaperCardReviewLinks/);
  assert.match(hybrid, /PaperCardReviewLinks/);
});

