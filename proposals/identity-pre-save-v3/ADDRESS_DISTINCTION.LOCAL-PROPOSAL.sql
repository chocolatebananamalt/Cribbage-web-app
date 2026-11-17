-- LOCAL DESIGN PROPOSAL ONLY. Never executed. Requires reviewed V1/V2 tables.
-- No API/function/grant changes. Transaction writer below is a required dependency.
begin;
create table app.player_identity_address_facts_v3 (
 identity_fact_id uuid primary key references app.roster_identity_facts_v1(id),
 street text not null, postal_code text not null, country text not null,
 address_complete boolean not null,
 prefix text not null default '', middle_name text not null default '',
 suffix text not null default '', local_label text not null default '',
 check(length(prefix)<=80 and length(middle_name)<=80 and length(suffix)<=80 and length(local_label)<=80)
);
-- Exact referenced table/column identities must be reconciled by backend owner;
-- this proposal deliberately does not invent a production writer or permissions.
alter table app.player_identity_address_facts_v3 enable row level security;
alter table app.player_identity_address_facts_v3 force row level security;
revoke all on app.player_identity_address_facts_v3 from public,anon,authenticated,service_role;
rollback;
