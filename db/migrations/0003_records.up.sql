-- 0003 Records: audit_logs, events, impersonation_sessions, plus the audit
-- writer used by triggers in this and later migrations. Approved under D-003.

set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- impersonation_sessions: every time staff viewed the platform as someone.
-- Platform-global (D-003 Q1).
-- ---------------------------------------------------------------------------
create table public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.users (id),
  target_user_id uuid not null references public.users (id),
  reason text not null check (length(trim(reason)) > 0),
  mode text not null default 'read_only' check (mode in ('read_only', 'elevated')),
  elevated_at timestamptz,
  elevated_reason text,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 minutes',
  ended_at timestamptz,
  notification_queued_at timestamptz,
  notification_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint impersonation_not_self check (staff_user_id <> target_user_id),
  constraint impersonation_elevation_reasoned check (
    mode <> 'elevated' or (elevated_at is not null and length(trim(coalesce(elevated_reason, ''))) > 0)
  )
);
create index impersonation_staff_idx on public.impersonation_sessions (staff_user_id);
create index impersonation_target_idx on public.impersonation_sessions (target_user_id);
create index impersonation_started_idx on public.impersonation_sessions (started_at);

create function app_private.impersonation_before_write() returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  staff public.platform_staff;
begin
  if exists (select 1 from public.platform_staff s where s.user_id = new.target_user_id and s.active) then
    raise exception 'Staff accounts cannot be impersonated';
  end if;

  if tg_op = 'UPDATE' then
    if new.staff_user_id <> old.staff_user_id or new.target_user_id <> old.target_user_id
       or new.reason <> old.reason or new.started_at <> old.started_at then
      raise exception 'Who, whom, why, and when of an impersonation session never change';
    end if;
    if old.ended_at is not null and not app_private.is_privileged()
       and ((to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at')) then
      raise exception 'An ended impersonation session cannot be changed';
    end if;
    if old.mode = 'elevated' and new.mode = 'read_only' then
      null; -- stepping down is always allowed
    end if;
  end if;

  if new.mode = 'elevated' and (tg_op = 'INSERT' or old.mode <> 'elevated') then
    select * into staff from public.platform_staff s where s.user_id = new.staff_user_id and s.active;
    if not found or staff.staff_role = 'sales' or not staff.can_elevate_impersonation then
      raise exception 'This staff member cannot take write actions while impersonating'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;

create trigger b_impersonation_before_write before insert or update on public.impersonation_sessions
  for each row execute function app_private.impersonation_before_write();

-- ---------------------------------------------------------------------------
-- audit_logs: permanent record of sensitive actions. Tenant-scoped;
-- platform-level actions are addressed to the platform account.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id),
  account_path ltree not null,
  actor_user_id uuid references public.users (id),
  impersonation_session_id uuid references public.impersonation_sessions (id),
  action text not null,
  target_type text,
  target_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  ip_address inet,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_logs_account_idx on public.audit_logs (account_id);
create index audit_logs_account_path_gist on public.audit_logs using gist (account_path);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id);
create index audit_logs_impersonation_idx on public.audit_logs (impersonation_session_id);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id);
create index audit_logs_occurred_idx on public.audit_logs (occurred_at);

-- ---------------------------------------------------------------------------
-- events: the shared stream reports are built from. Tenant-scoped.
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id),
  account_path ltree not null,
  application_id uuid references public.applications (id),
  actor_user_id uuid references public.users (id),
  event_type text not null,
  subject_type text,
  subject_id uuid,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_account_idx on public.events (account_id);
create index events_account_path_gist on public.events using gist (account_path);
create index events_application_idx on public.events (application_id);
create index events_actor_idx on public.events (actor_user_id);
create index events_type_occurred_idx on public.events (event_type, occurred_at);
create index events_subject_idx on public.events (subject_type, subject_id);

do $$
declare t text;
begin
  foreach t in array array['audit_logs', 'events'] loop
    execute format('create trigger a_set_account_path before insert or update on public.%I
                    for each row execute function app_private.set_account_path()', t);
    execute format('create trigger z_append_only before update or delete on public.%I
                    for each row execute function app_private.guard_append_only()', t);
    execute format('create trigger z_append_only_truncate before truncate on public.%I
                    for each statement execute function app_private.guard_append_only()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.impersonation_sessions enable row level security;
revoke all on table public.impersonation_sessions from anon, authenticated;
grant select, insert, update on public.impersonation_sessions to authenticated;
create trigger z_set_updated_at before update on public.impersonation_sessions
  for each row execute function app_private.set_updated_at();
create trigger z_prevent_delete before delete on public.impersonation_sessions
  for each row execute function app_private.prevent_delete();

-- The one audit writer. Security definer so a trigger can record an action
-- even though the person acting cannot write audit rows directly.
create function app_private.write_audit(
  p_account uuid, p_action text, p_target_type text, p_target_id uuid,
  p_before jsonb, p_after jsonb
) returns void
language sql security definer
set search_path = public, extensions, pg_temp
as $$
  insert into public.audit_logs (account_id, actor_user_id, action, target_type, target_id, before, after)
  values (coalesce(p_account, app_private.platform_account_id()), auth.uid(),
          p_action, p_target_type, p_target_id, p_before, p_after)
$$;
revoke all on function app_private.write_audit(uuid, text, text, uuid, jsonb, jsonb) from public, anon, authenticated;

-- Only the fields that changed, before and after.
create function app_private.changed_fields(p_old jsonb, p_new jsonb, p_fields text[])
returns table (before jsonb, after jsonb)
language sql immutable
set search_path = pg_catalog
as $$
  select jsonb_object_agg(f, p_old -> f), jsonb_object_agg(f, p_new -> f)
  from unnest(p_fields) f
  where p_old -> f is distinct from p_new -> f
$$;

-- Generic audit trigger. TG_ARGV[0] = action prefix, TG_ARGV[1] = 'account'
-- to address the row's account_id (or 'self' for accounts rows, 'platform'
-- otherwise), remaining args = fields to watch on update.
create function app_private.audit_trigger() returns trigger
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  fields text[] := tg_argv[2:];
  b jsonb;
  a jsonb;
  acct uuid;
begin
  acct := case tg_argv[1]
    when 'account' then (to_jsonb(new) ->> 'account_id')::uuid
    when 'self' then new.id
    else null
  end;
  if tg_op = 'INSERT' then
    perform app_private.write_audit(acct, tg_argv[0] || '.created', tg_table_name, new.id, null, to_jsonb(new));
  elsif tg_op = 'DELETE' then
    perform app_private.write_audit(null, tg_argv[0] || '.deleted', tg_table_name, old.id, to_jsonb(old), null);
    return old;
  else
    select c.before, c.after into b, a from app_private.changed_fields(to_jsonb(old), to_jsonb(new), fields) c;
    if a is not null then
      perform app_private.write_audit(acct, tg_argv[0] || '.changed', tg_table_name, new.id, b, a);
    end if;
  end if;
  return new;
end $$;

-- Audit wiring for tables from 0002.
create trigger zz_audit after update on public.account_memberships
  for each row execute function app_private.audit_trigger('membership', 'account', 'role', 'status', 'is_broker_of_record');
create trigger zz_audit after update on public.accounts
  for each row execute function app_private.audit_trigger('account', 'self', 'parent_account_id', 'account_type', 'status', 'brokerage_id', 'data_portability_policy', 'contact_retention_policy');
create trigger zz_audit after insert or update on public.platform_staff
  for each row execute function app_private.audit_trigger('platform_staff', 'platform', 'staff_role', 'active', 'can_elevate_impersonation');
create trigger zz_audit after insert or update or delete on public.role_permissions
  for each row execute function app_private.audit_trigger('role_permission', 'platform', 'account_type', 'role', 'permission');
create trigger zz_audit after update on public.brokerages
  for each row execute function app_private.audit_trigger('brokerage', 'platform', 'legal_name', 'display_name', 'license_number', 'license_state', 'qualifying_broker_name', 'qualifying_broker_license_number', 'required_disclaimer_text', 'status', 'address_line1', 'city', 'state', 'postal_code');
create trigger zz_audit after update on public.users
  for each row execute function app_private.audit_trigger('user', 'platform', 'email', 'status');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
create policy impersonation_select on public.impersonation_sessions for select to authenticated
  using (app_private.is_staff() or target_user_id = auth.uid());
create policy impersonation_start on public.impersonation_sessions for insert to authenticated
  with check (
    staff_user_id = auth.uid() and app_private.is_staff()
    and mode = 'read_only' and ended_at is null
  );
create policy impersonation_update_own on public.impersonation_sessions for update to authenticated
  using (staff_user_id = auth.uid() and app_private.is_staff())
  with check (staff_user_id = auth.uid() and app_private.is_staff());

-- Sales staff (sales, sales_admin) never read audit history or events.
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (
    actor_user_id = auth.uid()
    or (target_type = 'users' and target_id = auth.uid())
    or app_private.has_permission(account_id, 'audit.view')
    or app_private.staff_in(array['owner', 'superadmin', 'support'])
  );
create policy events_select on public.events for select to authenticated
  using (
    actor_user_id = auth.uid()
    or app_private.has_permission(account_id, 'events.view')
    or app_private.staff_in(array['owner', 'superadmin', 'support'])
  );
