-- 0001 Foundation: extensions and shared trigger plumbing. No tables.
-- Approved under D-003 (docs/proposals/001-milestone-1-schema.md, Part 4).

set local search_path = public, extensions;

create extension if not exists ltree with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Private schema for helpers used by triggers and RLS policies.
-- Not exposed through Supabase's API.
create schema app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, anon, service_role;

-- True when the current statement runs on a trusted server connection
-- (postgres, service_role) rather than a signed-in browser session.
-- NOT security definer on purpose: it must see the invoking role.
-- Only call it from non-definer triggers.
create function app_private.is_privileged() returns boolean
language sql stable
set search_path = pg_catalog
as $$ select current_user not in ('authenticated', 'anon') $$;

create function app_private.set_updated_at() returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Nothing in Core is ever deleted. Status columns record endings instead.
create function app_private.prevent_delete() returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception '% rows are never deleted; change their status instead', tg_table_name
    using errcode = 'insufficient_privilege';
end $$;

-- Audit logs and events: rows can never change or be removed. The only
-- permitted update is the database itself rewriting account_path when an
-- account is moved in the tree (see app_private.reparent_account).
create function app_private.guard_append_only() returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception '% rows can never be deleted', tg_table_name
      using errcode = 'insufficient_privilege';
  end if;
  if (to_jsonb(new) - 'account_path' - 'updated_at')
     is distinct from (to_jsonb(old) - 'account_path' - 'updated_at') then
    raise exception '% rows can never be changed', tg_table_name
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

-- Tree path label for an account: its id without dashes. Never changes.
create function app_private.path_label(p_id uuid) returns extensions.ltree
language sql immutable
set search_path = public, extensions, pg_temp
as $$ select text2ltree(replace(p_id::text, '-', '')) $$;
