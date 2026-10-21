-- 0002 Identity and the account tree:
--   users, brokerages, accounts, account_memberships, platform_staff,
--   role_permissions, applications, plus the access helpers every RLS
--   policy uses. Approved under D-003.

set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- users: one row per person who can log in. Platform-global.
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete restrict,
  email citext not null unique,
  full_name text,
  avatar_path text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- brokerages: the curated library of offices and franchises. Platform-global
-- (D-003 Q1). Only public, legally required facts.
-- ---------------------------------------------------------------------------
create table public.brokerages (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'office' check (kind in ('franchise', 'office')),
  franchise_id uuid references public.brokerages (id),
  legal_name text not null,
  display_name text,
  office_name text,
  qualifying_broker_name text,
  qualifying_broker_license_number text,
  license_number text,
  license_state text,
  logo_light_path text,
  logo_dark_path text,
  logo_franchise_required_path text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  phone text,
  website_url text,
  mls_identifiers jsonb not null default '{}'::jsonb,
  required_disclaimer_text text,
  status text not null default 'pending_review'
    check (status in ('verified', 'pending_review', 'user_submitted')),
  submitted_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brokerages_franchise_id_idx on public.brokerages (franchise_id);
create index brokerages_submitted_by_idx on public.brokerages (submitted_by_user_id);
create index brokerages_state_city_idx on public.brokerages (state, city);
create index brokerages_status_idx on public.brokerages (status);
create index brokerages_legal_name_trgm on public.brokerages using gin (legal_name gin_trgm_ops);
create index brokerages_display_name_trgm on public.brokerages using gin (display_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- accounts: every customer entity, one tree. Platform-global (it IS the
-- tenant boundary).
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  parent_account_id uuid references public.accounts (id),
  account_type text not null check (account_type in
    ('platform', 'corporate', 'organization', 'brokerage', 'team', 'individual')),
  path ltree not null,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  brokerage_id uuid references public.brokerages (id),
  timezone text not null default 'America/Chicago',
  phone text,
  email citext,
  website_url text,
  -- Values are set per account; defaults are decision D-007.
  data_portability_policy text,
  contact_retention_policy text,
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_path_unique unique (path)
);
create index accounts_path_gist on public.accounts using gist (path);
create index accounts_parent_idx on public.accounts (parent_account_id);
create index accounts_brokerage_idx on public.accounts (brokerage_id);
create index accounts_type_idx on public.accounts (account_type);
create index accounts_created_by_idx on public.accounts (created_by_user_id);
-- Exactly one platform account.
create unique index accounts_single_platform on public.accounts (account_type)
  where account_type = 'platform';

-- ---------------------------------------------------------------------------
-- account_memberships: who belongs where, with which of the four roles.
-- ---------------------------------------------------------------------------
create table public.account_memberships (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id),
  account_path ltree not null,
  user_id uuid references public.users (id),
  role text not null check (role in ('owner', 'admin', 'member')),
  is_broker_of_record boolean not null default false,
  status text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  invited_email citext,
  invite_token_hash text,
  invite_expires_at timestamptz,
  invited_by_user_id uuid references public.users (id),
  joined_at timestamptz,
  removed_at timestamptz,
  removed_by_user_id uuid references public.users (id),
  contact_policy_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_active_has_user check (status <> 'active' or user_id is not null),
  constraint memberships_invite_has_email check (status <> 'invited' or invited_email is not null)
);
create index memberships_account_idx on public.account_memberships (account_id);
create index memberships_account_path_gist on public.account_memberships using gist (account_path);
create index memberships_user_idx on public.account_memberships (user_id);
create index memberships_invited_by_idx on public.account_memberships (invited_by_user_id);
create index memberships_removed_by_idx on public.account_memberships (removed_by_user_id);
create index memberships_token_idx on public.account_memberships (invite_token_hash);
create unique index memberships_one_per_person on public.account_memberships (account_id, user_id)
  where status <> 'removed' and user_id is not null;
create unique index memberships_one_invite_per_email on public.account_memberships (account_id, invited_email)
  where status = 'invited';

-- ---------------------------------------------------------------------------
-- platform_staff: ListApps employees. Never a customer role.
-- ---------------------------------------------------------------------------
create table public.platform_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id),
  staff_role text not null check (staff_role in ('owner', 'superadmin', 'sales', 'sales_admin', 'support')),
  can_elevate_impersonation boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_sales_never_elevates check (not (staff_role = 'sales' and can_elevate_impersonation))
);

-- ---------------------------------------------------------------------------
-- role_permissions: the rulebook. Platform-global reference data (D-003 Q1).
-- ---------------------------------------------------------------------------
create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in
    ('platform', 'corporate', 'organization', 'brokerage', 'team', 'individual')),
  role text not null check (role in ('owner', 'admin', 'member', 'broker_of_record')),
  permission text not null check (permission ~ '^[a-z_]+(\.[a-z_]+)+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_permissions_unique unique (account_type, role, permission)
);

-- ---------------------------------------------------------------------------
-- applications: the app registry. Platform-global.
-- ---------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]*$'),
  name text not null,
  status text not null default 'coming_soon' check (status in ('available', 'coming_soon', 'hidden')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access helpers. Security definer so policies can consult memberships and
-- staff without recursive RLS. Each reads only the signed-in user's own facts.
-- ---------------------------------------------------------------------------
create function app_private.my_account_paths() returns ltree[]
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(array_agg(a.path), '{}')
  from public.account_memberships m
  join public.accounts a on a.id = m.account_id
  where m.user_id = auth.uid() and m.status = 'active'
$$;

create function app_private.staff_role() returns text
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select s.staff_role from public.platform_staff s
  where s.user_id = auth.uid() and s.active
$$;

create function app_private.is_staff() returns boolean
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$ select app_private.staff_role() is not null $$;

create function app_private.staff_in(p_roles text[]) returns boolean
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$ select coalesce(app_private.staff_role() = any (p_roles), false) $$;

create function app_private.role_rank(p_role text) returns integer
language sql immutable
set search_path = pg_catalog
as $$ select case p_role when 'owner' then 3 when 'admin' then 2 when 'member' then 1 else 0 end $$;

-- Does the signed-in user hold p_permission at p_account, via a role on that
-- account or any account above it? Capabilities are keyed by the type of the
-- account the role is held on.
create function app_private.has_permission(p_account uuid, p_permission text) returns boolean
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.accounts target
    join public.accounts holder on holder.path @> target.path
    join public.account_memberships m
      on m.account_id = holder.id and m.user_id = auth.uid() and m.status = 'active'
    join public.role_permissions rp
      on rp.account_type = holder.account_type
     and rp.permission = p_permission
     and (rp.role = m.role or (m.is_broker_of_record and rp.role = 'broker_of_record'))
    where target.id = p_account
  )
$$;

-- Strongest role rank the signed-in user holds at or above p_account (0 = none).
create function app_private.strongest_role_rank(p_account uuid) returns integer
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(max(app_private.role_rank(m.role)), 0)
  from public.accounts target
  join public.accounts holder on holder.path @> target.path
  join public.account_memberships m
    on m.account_id = holder.id and m.user_id = auth.uid() and m.status = 'active'
  where target.id = p_account
$$;

-- Can the signed-in user see this person? Yes if it is them, or the person is
-- an active member of an account at or beneath one of the user's accounts.
create function app_private.can_see_user(p_user uuid) returns boolean
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select p_user = auth.uid() or exists (
    select 1
    from public.account_memberships m
    join public.accounts a on a.id = m.account_id
    where m.user_id = p_user and m.status = 'active'
      and a.account_type <> 'individual'
      and app_private.my_account_paths() @> a.path
  )
$$;

create function app_private.platform_account_id() returns uuid
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$ select id from public.accounts where account_type = 'platform' $$;

-- Fills account_path from account_id on every insert and update. The app and
-- the browser can never set it.
create function app_private.set_account_path() returns trigger
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
begin
  select a.path into new.account_path from public.accounts a where a.id = new.account_id;
  if new.account_path is null then
    raise exception 'Unknown account %', new.account_id;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Tree rules on accounts.
-- ---------------------------------------------------------------------------
create function app_private.valid_parent(p_child text, p_parent text) returns boolean
language sql immutable
set search_path = pg_catalog
as $$
  select coalesce(case p_child
    when 'platform' then p_parent is null
    when 'corporate' then p_parent is null
    when 'individual' then p_parent is null
    when 'organization' then p_parent is null or p_parent = 'corporate'
    when 'brokerage' then p_parent is null or p_parent = 'organization'
    when 'team' then p_parent = 'brokerage'
    else false
  end, false)
$$;

create function app_private.accounts_before_write() returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  parent public.accounts;
begin
  if tg_op = 'UPDATE' and new.id <> old.id then
    raise exception 'Account ids never change';
  end if;

  if tg_op = 'INSERT'
     or new.parent_account_id is distinct from old.parent_account_id
     or new.account_type is distinct from old.account_type then

    if tg_op = 'UPDATE' and not app_private.is_privileged()
       and not app_private.staff_in(array['owner', 'superadmin']) then
      raise exception 'Only ListApps staff can move an account or change its type'
        using errcode = 'insufficient_privilege';
    end if;

    if new.parent_account_id is not null then
      select * into parent from public.accounts where id = new.parent_account_id;
      if not found then
        raise exception 'Unknown parent account %', new.parent_account_id;
      end if;
    end if;

    if not app_private.valid_parent(new.account_type, parent.account_type) then
      raise exception 'A % account cannot sit under %', new.account_type,
        coalesce(parent.account_type, 'nothing');
    end if;

    if tg_op = 'UPDATE' and parent.path is not null and parent.path <@ old.path then
      raise exception 'An account cannot be moved beneath itself';
    end if;

    new.path := case
      when parent.id is null then app_private.path_label(new.id)
      else parent.path || app_private.path_label(new.id)
    end;

  elsif new.path is distinct from old.path
        and coalesce(current_setting('listapps.reparenting', true), '') <> 'on' then
    raise exception 'Account paths are managed by the database';
  end if;

  return new;
end $$;

create trigger a_accounts_before_write before insert or update on public.accounts
  for each row execute function app_private.accounts_before_write();

-- Moving an account (staff only, through the server). Rewrites the path of
-- the account, everything beneath it, and every tenant row beneath it.
-- Not callable from a browser session.
create function app_private.reparent_account(p_account uuid, p_new_parent uuid) returns void
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  old_path ltree;
  new_path ltree;
  t record;
begin
  select path into old_path from public.accounts where id = p_account for update;
  if old_path is null then
    raise exception 'Unknown account %', p_account;
  end if;

  update public.accounts set parent_account_id = p_new_parent
    where id = p_account returning path into new_path;

  perform set_config('listapps.reparenting', 'on', true);
  update public.accounts
    set path = new_path || subpath(path, nlevel(old_path))
    where path <@ old_path and id <> p_account;

  -- Every tenant table recomputes account_path from accounts.
  for t in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'account_path'
  loop
    execute format(
      'update public.%I set account_id = account_id where account_path <@ $1', t.table_name
    ) using old_path;
  end loop;
  perform set_config('listapps.reparenting', 'off', true);
end $$;
revoke all on function app_private.reparent_account(uuid, uuid) from public, authenticated, anon;

-- ---------------------------------------------------------------------------
-- Membership rules.
-- ---------------------------------------------------------------------------
create function app_private.memberships_before_update() returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  if new.account_id <> old.account_id then
    raise exception 'A membership cannot move to another account';
  end if;

  if not app_private.is_privileged() then
    if new.user_id is distinct from old.user_id then
      raise exception 'Only the invitation flow can attach a person to a membership';
    end if;
    if old.status = 'removed' and new.status <> 'removed' then
      raise exception 'A removed membership cannot be reactivated; send a new invitation';
    end if;
    if old.status = 'invited' and new.status = 'active' then
      raise exception 'Invitations are accepted through the invitation flow';
    end if;
  end if;

  -- Never leave an account without an owner.
  if old.status = 'active' and old.role = 'owner'
     and (new.status <> 'active' or new.role <> 'owner')
     and not exists (
       select 1 from public.account_memberships o
       where o.account_id = old.account_id and o.id <> old.id
         and o.status = 'active' and o.role = 'owner'
     ) then
    raise exception 'This is the last owner of the account; add another owner first';
  end if;

  if new.status = 'removed' and old.status <> 'removed' then
    new.removed_at := coalesce(new.removed_at, now());
    new.removed_by_user_id := coalesce(new.removed_by_user_id, auth.uid());
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Users: status changes are staff-only.
-- ---------------------------------------------------------------------------
create function app_private.users_before_update() returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  if new.id <> old.id then
    raise exception 'User ids never change';
  end if;
  if new.status is distinct from old.status and not app_private.is_privileged()
     and not app_private.staff_in(array['owner', 'superadmin']) then
    raise exception 'Only ListApps staff can suspend or restore a user'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

-- Every new login gets a users row and a personal (individual) account that
-- sits outside any office tree (D-003 Q2).
create function app_private.handle_new_auth_user() returns trigger
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  acct uuid := gen_random_uuid();
  fname text := nullif(new.raw_user_meta_data ->> 'full_name', '');
begin
  insert into public.users (id, email, full_name) values (new.id, new.email, fname);
  insert into public.accounts (id, account_type, name, slug, created_by_user_id)
    values (acct, 'individual', coalesce(fname, new.email), 'u-' || replace(new.id::text, '-', ''), new.id);
  insert into public.account_memberships (account_id, user_id, role, status, joined_at)
    values (acct, new.id, 'owner', 'active', now());
  return new;
end $$;

create trigger listapps_on_auth_user_created after insert on auth.users
  for each row execute function app_private.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Triggers.
-- ---------------------------------------------------------------------------
create trigger a_set_account_path before insert or update on public.account_memberships
  for each row execute function app_private.set_account_path();
create trigger b_memberships_before_update before update on public.account_memberships
  for each row execute function app_private.memberships_before_update();
create trigger b_users_before_update before update on public.users
  for each row execute function app_private.users_before_update();

do $$
declare t text;
begin
  foreach t in array array['users', 'brokerages', 'accounts', 'account_memberships',
                           'platform_staff', 'role_permissions', 'applications'] loop
    execute format('create trigger z_set_updated_at before update on public.%I
                    for each row execute function app_private.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
  -- role_permissions rows may be removed (removing a capability); nothing else may.
  foreach t in array array['users', 'brokerages', 'accounts', 'account_memberships',
                           'platform_staff', 'applications'] loop
    execute format('create trigger z_prevent_delete before delete on public.%I
                    for each row execute function app_private.prevent_delete()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Grants (RLS still filters every row).
-- ---------------------------------------------------------------------------
grant select on public.users to authenticated;
grant update (full_name, avatar_path, status) on public.users to authenticated;
grant select, insert, update on public.brokerages to authenticated;
grant select, insert, update on public.accounts to authenticated;
grant select, insert, update on public.account_memberships to authenticated;
grant select, insert, update on public.platform_staff to authenticated;
grant select, insert, update, delete on public.role_permissions to authenticated;
grant select, insert, update on public.applications to authenticated;

revoke all on all functions in schema app_private from public;
grant execute on function
  app_private.is_privileged(),
  app_private.my_account_paths(),
  app_private.staff_role(),
  app_private.is_staff(),
  app_private.staff_in(text[]),
  app_private.role_rank(text),
  app_private.has_permission(uuid, text),
  app_private.strongest_role_rank(uuid),
  app_private.can_see_user(uuid),
  app_private.platform_account_id(),
  app_private.path_label(uuid),
  app_private.valid_parent(text, text)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS policies (plain English in proposal 001, Part 3).
-- ---------------------------------------------------------------------------

-- users
create policy users_select on public.users for select to authenticated
  using (app_private.can_see_user(id) or app_private.is_staff());
create policy users_update_self on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy users_update_staff on public.users for update to authenticated
  using (app_private.staff_in(array['owner', 'superadmin']))
  with check (app_private.staff_in(array['owner', 'superadmin']));

-- brokerages
create policy brokerages_select on public.brokerages for select to authenticated
  using (status = 'verified' or submitted_by_user_id = auth.uid() or app_private.is_staff());
create policy brokerages_insert_staff on public.brokerages for insert to authenticated
  with check (app_private.staff_in(array['owner', 'superadmin']));
create policy brokerages_update_staff on public.brokerages for update to authenticated
  using (app_private.staff_in(array['owner', 'superadmin']))
  with check (app_private.staff_in(array['owner', 'superadmin']));

-- accounts: at or beneath your memberships, plus the accounts directly above
-- yours (so a team sees its brokerage's name). Siblings stay invisible.
create policy accounts_select on public.accounts for select to authenticated
  using (
    (select app_private.my_account_paths()) @> path
    or (select app_private.my_account_paths()) <@ path
    or app_private.is_staff()
  );
create policy accounts_insert_staff on public.accounts for insert to authenticated
  with check (
    app_private.staff_in(array['owner', 'superadmin'])
    or (app_private.staff_in(array['sales', 'sales_admin'])
        and account_type in ('brokerage', 'team'))
  );
create policy accounts_update on public.accounts for update to authenticated
  using (app_private.has_permission(id, 'account.update')
         or app_private.staff_in(array['owner', 'superadmin']))
  with check (app_private.has_permission(id, 'account.update')
              or app_private.staff_in(array['owner', 'superadmin']));

-- account_memberships
create policy memberships_select on public.account_memberships for select to authenticated
  using (
    user_id = auth.uid()
    or (select app_private.my_account_paths()) @> account_path
    or app_private.is_staff()
  );
create policy memberships_invite on public.account_memberships for insert to authenticated
  with check (
    status = 'invited'
    and invited_by_user_id = auth.uid()
    and app_private.has_permission(account_id, 'members.invite')
    and app_private.role_rank(role) <= app_private.strongest_role_rank(account_id)
    and (not is_broker_of_record or app_private.strongest_role_rank(account_id) = 3)
  );
create policy memberships_manage on public.account_memberships for update to authenticated
  using (
    app_private.has_permission(account_id, 'members.manage')
    and app_private.role_rank(role) <= app_private.strongest_role_rank(account_id)
  )
  with check (
    app_private.has_permission(account_id, 'members.manage')
    and app_private.role_rank(role) <= app_private.strongest_role_rank(account_id)
    and (not is_broker_of_record or app_private.strongest_role_rank(account_id) = 3)
  );

-- platform_staff
create policy staff_select on public.platform_staff for select to authenticated
  using (app_private.is_staff());
create policy staff_insert on public.platform_staff for insert to authenticated
  with check (
    app_private.staff_in(array['owner'])
    or (app_private.staff_in(array['sales_admin']) and staff_role = 'sales')
  );
create policy staff_update on public.platform_staff for update to authenticated
  using (
    app_private.staff_in(array['owner'])
    or (app_private.staff_in(array['sales_admin']) and staff_role = 'sales')
  )
  with check (
    app_private.staff_in(array['owner'])
    or (app_private.staff_in(array['sales_admin']) and staff_role = 'sales')
  );

-- role_permissions
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (true);
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (app_private.staff_in(array['owner', 'superadmin']))
  with check (app_private.staff_in(array['owner', 'superadmin']));

-- applications
create policy applications_select on public.applications for select to authenticated
  using (true);
create policy applications_insert on public.applications for insert to authenticated
  with check (app_private.staff_in(array['owner', 'superadmin']));
create policy applications_update on public.applications for update to authenticated
  using (app_private.staff_in(array['owner', 'superadmin']))
  with check (app_private.staff_in(array['owner', 'superadmin']));

-- ---------------------------------------------------------------------------
-- Reference data. Not customer data: the platform root, the app list, and the
-- starting rulebook (proposal 001, role_permissions "Starting rows").
-- ---------------------------------------------------------------------------
insert into public.accounts (account_type, name, slug) values ('platform', 'ListApps', 'listapps');

insert into public.applications (slug, name, status, sort_order) values
  ('openly', 'Openly', 'available', 1),
  ('listvault', 'ListVault', 'available', 2),
  ('curb', 'Curb', 'available', 3),
  ('pulse', 'Pulse', 'coming_soon', 4),
  ('trakkt', 'Trakkt', 'coming_soon', 5),
  ('reach', 'Reach', 'coming_soon', 6),
  ('ops', 'Ops', 'coming_soon', 7),
  ('atlas', 'Atlas', 'coming_soon', 8);

insert into public.role_permissions (account_type, role, permission)
select t, r, p
from unnest(array['corporate', 'organization', 'brokerage', 'team']) t,
     unnest(array['owner', 'admin']) r,
     unnest(array['members.invite', 'members.manage', 'account.update', 'brand_kit.manage',
                  'agent_settings.manage', 'audit.view', 'events.view']) p
union all
select t, 'owner', 'subscriptions.view'
from unnest(array['corporate', 'organization', 'brokerage', 'team']) t
union all
select 'individual', 'owner', p
from unnest(array['account.update', 'brand_kit.manage', 'subscriptions.view',
                  'audit.view', 'events.view']) p;
