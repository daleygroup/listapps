-- 0004 Profiles, branding, entitlements, hand-offs:
--   agent_profiles, organization_agent_settings, brand_kits, platform_theme,
--   account_theme, subscriptions, ownership_transfers. Approved under D-003.

set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- agent_profiles: the agent's professional identity. Owned by the person,
-- not by any account (D-003 Q1).
-- ---------------------------------------------------------------------------
create table public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id),
  legal_first_name text,
  legal_last_name text,
  display_name text,
  license_number text,
  license_state text,
  mls_agent_id text,
  mobile_phone text,
  email citext,
  headshot_path text,
  bio text,
  designations text[] not null default '{}',
  website_url text,
  social_links jsonb not null default '{}'::jsonb,
  current_brokerage_id uuid references public.brokerages (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_profiles_brokerage_idx on public.agent_profiles (current_brokerage_id);
create index agent_profiles_license_idx on public.agent_profiles (license_state, license_number);
create index agent_profiles_mls_idx on public.agent_profiles (mls_agent_id);

-- ---------------------------------------------------------------------------
-- organization_agent_settings: what an office or team controls about an
-- agent while they are there. Stays with the account.
-- ---------------------------------------------------------------------------
create table public.organization_agent_settings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id),
  account_path ltree not null,
  user_id uuid not null references public.users (id),
  display_name_override text,
  org_email citext,
  org_phone text,
  office_name text,
  team_title text,
  mandated_bio text,
  org_headshot_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_agent_settings_unique unique (account_id, user_id)
);
create index org_agent_settings_account_idx on public.organization_agent_settings (account_id);
create index org_agent_settings_path_gist on public.organization_agent_settings using gist (account_path);
create index org_agent_settings_user_idx on public.organization_agent_settings (user_id);

-- ---------------------------------------------------------------------------
-- brand_kits: one per account at most; inherited down the tree.
-- ---------------------------------------------------------------------------
create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts (id),
  account_path ltree not null,
  name text,
  logo_light_path text,
  logo_dark_path text,
  team_logo_path text,
  color_primary text check (color_primary ~ '^#[0-9a-fA-F]{6}$'),
  color_secondary text check (color_secondary ~ '^#[0-9a-fA-F]{6}$'),
  color_accent text check (color_accent ~ '^#[0-9a-fA-F]{6}$'),
  font_heading text,
  font_body text,
  -- The disclaimer insurance (CLAUDE.md section 4): {{disclaimer.required_text}}.
  required_disclaimer_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brand_kits_path_gist on public.brand_kits using gist (account_path);

-- ---------------------------------------------------------------------------
-- platform_theme: exactly one row. Platform-global (D-003 Q1).
-- ---------------------------------------------------------------------------
create table public.platform_theme (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  tokens jsonb not null default '{}'::jsonb,
  app_accents jsonb not null default '{}'::jsonb,
  logo_light_path text,
  logo_dark_path text,
  updated_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index platform_theme_updated_by_idx on public.platform_theme (updated_by_user_id);

-- ---------------------------------------------------------------------------
-- account_theme: optional look-and-feel overrides at any account.
-- ---------------------------------------------------------------------------
create table public.account_theme (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts (id),
  account_path ltree not null,
  tokens jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index account_theme_path_gist on public.account_theme using gist (account_path);

-- ---------------------------------------------------------------------------
-- subscriptions: which account has which app.
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id),
  account_path ltree not null,
  application_id uuid not null references public.applications (id),
  plan text,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'lapsed', 'canceled')),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  includes_descendants boolean not null default false,
  seat_limit integer check (seat_limit is null or seat_limit > 0),
  seats_used integer not null default 0 check (seats_used >= 0),
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_account_idx on public.subscriptions (account_id);
create index subscriptions_path_gist on public.subscriptions using gist (account_path);
create index subscriptions_application_idx on public.subscriptions (application_id);
create index subscriptions_created_by_idx on public.subscriptions (created_by_user_id);
create unique index subscriptions_one_live_per_app on public.subscriptions (account_id, application_id)
  where status in ('trialing', 'active', 'past_due');

-- ---------------------------------------------------------------------------
-- ownership_transfers: the hand-off list when someone leaves.
-- ---------------------------------------------------------------------------
create table public.ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id),
  account_path ltree not null,
  membership_id uuid not null references public.account_memberships (id),
  item_type text not null,
  item_id uuid not null,
  from_user_id uuid not null references public.users (id),
  default_to_user_id uuid references public.users (id),
  to_user_id uuid references public.users (id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'reassigned', 'not_transferable')),
  actor_user_id uuid references public.users (id),
  reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transfers_account_idx on public.ownership_transfers (account_id);
create index transfers_path_gist on public.ownership_transfers using gist (account_path);
create index transfers_membership_idx on public.ownership_transfers (membership_id);
create index transfers_from_idx on public.ownership_transfers (from_user_id);
create index transfers_default_to_idx on public.ownership_transfers (default_to_user_id);
create index transfers_to_idx on public.ownership_transfers (to_user_id);
create index transfers_actor_idx on public.ownership_transfers (actor_user_id);
create index transfers_item_idx on public.ownership_transfers (item_type, item_id);
create index transfers_status_idx on public.ownership_transfers (status);

create function app_private.transfers_before_update() returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  if new.account_id <> old.account_id or new.membership_id <> old.membership_id
     or new.item_type <> old.item_type or new.item_id <> old.item_id
     or new.from_user_id <> old.from_user_id then
    raise exception 'What was transferred, and from whom, never changes';
  end if;
  if old.completed_at is not null
     and (to_jsonb(new) - 'account_path' - 'updated_at')
         is distinct from (to_jsonb(old) - 'account_path' - 'updated_at') then
    raise exception 'A completed transfer cannot be changed';
  end if;
  if new.status in ('accepted', 'reassigned') and old.status = 'pending' then
    new.completed_at := coalesce(new.completed_at, now());
    new.actor_user_id := coalesce(new.actor_user_id, auth.uid());
  end if;
  return new;
end $$;
create trigger b_transfers_before_update before update on public.ownership_transfers
  for each row execute function app_private.transfers_before_update();

-- ---------------------------------------------------------------------------
-- Shared trigger wiring, grants, RLS on.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['organization_agent_settings', 'brand_kits', 'account_theme',
                           'subscriptions', 'ownership_transfers'] loop
    execute format('create trigger a_set_account_path before insert or update on public.%I
                    for each row execute function app_private.set_account_path()', t);
  end loop;
  foreach t in array array['agent_profiles', 'organization_agent_settings', 'brand_kits',
                           'platform_theme', 'account_theme', 'subscriptions',
                           'ownership_transfers'] loop
    execute format('create trigger z_set_updated_at before update on public.%I
                    for each row execute function app_private.set_updated_at()', t);
    execute format('create trigger z_prevent_delete before delete on public.%I
                    for each row execute function app_private.prevent_delete()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end $$;
grant select on public.platform_theme to anon;

-- Audit wiring.
create trigger zz_audit after update on public.agent_profiles
  for each row execute function app_private.audit_trigger('agent_profile', 'platform', 'license_number', 'license_state', 'current_brokerage_id');
create trigger zz_audit after update on public.brand_kits
  for each row execute function app_private.audit_trigger('brand_kit', 'account', 'required_disclaimer_text');
create trigger zz_audit after insert or update on public.subscriptions
  for each row execute function app_private.audit_trigger('subscription', 'account', 'status', 'plan', 'includes_descendants', 'seat_limit', 'trial_ends_at');
create trigger zz_audit after insert or update on public.ownership_transfers
  for each row execute function app_private.audit_trigger('ownership_transfer', 'account', 'status', 'to_user_id');

-- ---------------------------------------------------------------------------
-- RLS policies.
-- ---------------------------------------------------------------------------

-- agent_profiles: the agent edits their own; people in their accounts (and
-- above) can read; staff except sales can read.
create policy agent_profiles_select on public.agent_profiles for select to authenticated
  using (
    app_private.can_see_user(user_id)
    or app_private.staff_in(array['owner', 'superadmin', 'support'])
  );
create policy agent_profiles_insert_self on public.agent_profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy agent_profiles_update_self on public.agent_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- organization_agent_settings
create policy org_agent_settings_select on public.organization_agent_settings for select to authenticated
  using (
    user_id = auth.uid()
    or (select app_private.my_account_paths()) @> account_path
    or app_private.staff_in(array['owner', 'superadmin', 'support'])
  );
create policy org_agent_settings_insert on public.organization_agent_settings for insert to authenticated
  with check (app_private.has_permission(account_id, 'agent_settings.manage'));
create policy org_agent_settings_update on public.organization_agent_settings for update to authenticated
  using (app_private.has_permission(account_id, 'agent_settings.manage'))
  with check (app_private.has_permission(account_id, 'agent_settings.manage'));

-- brand_kits: readable at or beneath the account (inheritance), editable with brand_kit.manage.
create policy brand_kits_select on public.brand_kits for select to authenticated
  using (
    (select app_private.my_account_paths()) @> account_path
    or (select app_private.my_account_paths()) <@ account_path
    or app_private.is_staff()
  );
create policy brand_kits_insert on public.brand_kits for insert to authenticated
  with check (app_private.has_permission(account_id, 'brand_kit.manage')
              or app_private.staff_in(array['owner', 'superadmin']));
create policy brand_kits_update on public.brand_kits for update to authenticated
  using (app_private.has_permission(account_id, 'brand_kit.manage')
         or app_private.staff_in(array['owner', 'superadmin']))
  with check (app_private.has_permission(account_id, 'brand_kit.manage')
              or app_private.staff_in(array['owner', 'superadmin']));

-- platform_theme: everyone reads (the login page needs it); owner staff edit.
create policy platform_theme_select on public.platform_theme for select to anon, authenticated
  using (true);
create policy platform_theme_insert on public.platform_theme for insert to authenticated
  with check (app_private.staff_in(array['owner']));
create policy platform_theme_update on public.platform_theme for update to authenticated
  using (app_private.staff_in(array['owner'])) with check (app_private.staff_in(array['owner']));

-- account_theme: readable with inheritance; staff-only edits in Milestone 1.
create policy account_theme_select on public.account_theme for select to authenticated
  using (
    (select app_private.my_account_paths()) @> account_path
    or (select app_private.my_account_paths()) <@ account_path
    or app_private.is_staff()
  );
create policy account_theme_insert on public.account_theme for insert to authenticated
  with check (app_private.staff_in(array['owner', 'superadmin']));
create policy account_theme_update on public.account_theme for update to authenticated
  using (app_private.staff_in(array['owner', 'superadmin']))
  with check (app_private.staff_in(array['owner', 'superadmin']));

-- subscriptions: readable at or beneath and from above (the switcher needs
-- ancestor subscriptions); staff other than support create and change them.
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (
    (select app_private.my_account_paths()) @> account_path
    or (select app_private.my_account_paths()) <@ account_path
    or app_private.is_staff()
  );
create policy subscriptions_insert on public.subscriptions for insert to authenticated
  with check (app_private.staff_in(array['owner', 'superadmin', 'sales', 'sales_admin']));
create policy subscriptions_update on public.subscriptions for update to authenticated
  using (app_private.staff_in(array['owner', 'superadmin', 'sales', 'sales_admin']))
  with check (app_private.staff_in(array['owner', 'superadmin', 'sales', 'sales_admin']));

-- ownership_transfers
create policy transfers_select on public.ownership_transfers for select to authenticated
  using (
    from_user_id = auth.uid() or to_user_id = auth.uid() or default_to_user_id = auth.uid()
    or app_private.has_permission(account_id, 'members.manage')
    or app_private.staff_in(array['owner', 'superadmin', 'support'])
  );
create policy transfers_insert on public.ownership_transfers for insert to authenticated
  with check (app_private.has_permission(account_id, 'members.manage'));
create policy transfers_update on public.ownership_transfers for update to authenticated
  using (
    to_user_id = auth.uid() or default_to_user_id = auth.uid()
    or app_private.has_permission(account_id, 'members.manage')
  )
  with check (
    to_user_id = auth.uid() or default_to_user_id = auth.uid()
    or app_private.has_permission(account_id, 'members.manage')
  );

-- The single platform theme row.
insert into public.platform_theme (tokens) values ('{}'::jsonb);
