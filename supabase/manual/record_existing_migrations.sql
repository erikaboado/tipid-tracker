-- One-time setup for automatic migrations (.github/workflows/migrate.yml).
-- Run this once in the Supabase SQL Editor before the workflow's first run.
--
-- Migrations 0001–0003 were applied by hand, so the Supabase CLI has no record of them and would try
-- to run them again. This records them as applied, using the version numbers of the files in
-- supabase/migrations/. 0004 is recorded only if its functions already exist (i.e. you ran it by hand);
-- otherwise the workflow applies it. Only migration history is changed, not your data or tables.
-- Any older history rows (from tools that used different version numbers) are replaced.

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

delete from supabase_migrations.schema_migrations;

insert into supabase_migrations.schema_migrations (version, name) values
  ('0001', 'init_schema'),
  ('0002', 'other_category'),
  ('0003', 'admin_review');

insert into supabase_migrations.schema_migrations (version, name)
select '0004', 'admin_deals'
where to_regproc('public.admin_save_deal') is not null;

select version, name from supabase_migrations.schema_migrations order by version;
