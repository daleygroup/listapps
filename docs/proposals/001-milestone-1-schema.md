# Proposal 001: Milestone 1 schema ("Who You Are")

- **Status:** PENDING Joseph's approval (decision D-003 in `docs/DECISIONS.md`)
- **Written:** 2026-10-21 by a background build run
- **Scope:** the 17 tables named in CLAUDE.md section 12. Nothing about properties, listings, contacts, templates, or any app.
- **Nothing in this document has been built.** No migration is written until D-003 says APPROVED.

---

## Part 1: The short version, for Joseph

- **One tree of accounts.** KW Metro South (brokerage) sits above The Daley Group (team). Later, KW Birmingham (organization) can be slid in above KW Metro South by ListApps staff in minutes.
- **Four roles only:** owner, admin, member, plus a "broker of record" flag. How much authority you have comes from where you sit in the tree, not from a longer role name.
- **Authority flows down, never up or sideways.** An admin at KW Metro South sees The Daley Group's data. The Daley Group never sees KW Metro South's other teams. A second brokerage is invisible to both, and the database itself enforces that, not just the app.
- **Each agent also owns a personal account that sits outside the tree.** That is where they buy apps for themselves, and nobody above them has authority over it. This is what makes "your data is yours" true at the database level.
- **ListApps staff are a separate list**, never a customer role. Only staff can "log in as" someone, it is read-only by default, always logged, and the person is emailed afterward.
- **Nothing is ever deleted.** Removing someone flips their membership to "removed" and creates a hand-off list. Audit history cannot be edited or erased, even by staff.

What I need from you is on the last page: approve the schema, and answer four short questions (Part 5).

---

## Part 2: How the security works, in plain English

**The tree path.** Every account stores its "address" in the tree, like a folder path: `KW Metro South / The Daley Group`. Every row of customer data stores the address of the account it belongs to.

**The one rule every customer table follows.** You can see a row if its address starts with the address of an account where you are an active member. A member of The Daley Group sees rows addressed `KW Metro South / The Daley Group / ...`. They do not see rows addressed `KW Metro South / Smith Team`, and they do not see `RE/MAX Downtown / ...`.

**Seeing is not editing.** Being in the tree lets you read. Changing anything also requires a capability (for example `members.invite`) that your role has at that kind of account. Capabilities live in the `role_permissions` table, so adding one is inserting a row, never inventing a role.

**Two layers, always.** The app's server code checks permission before every change, and the database checks again with Row Level Security (RLS). If the app has a bug, the database still refuses. The browser is never trusted to say which account it is acting for.

**ListApps staff.** Staff do not get customer memberships. Separate database rules let staff read accounts for support and sales. Sales staff are explicitly blocked from contacts and listing content (those tables arrive in later milestones, and the rule is written now so they inherit it).

**Platform account.** The very top of the tree is a single `platform` account representing ListApps itself. No customer is ever a member of it. It exists so platform-wide audit entries and events have a home like everything else.

---

## Part 3: The tables

Conventions on every table unless noted:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (kept current by a trigger)
- RLS **enabled** with explicit policies. A table with RLS on and no matching policy shows nothing, which is the safe failure.
- An index on every foreign key.
- Tenant-scoped tables also carry `account_id uuid not null references accounts(id)` and `account_path ltree not null`, with a b-tree index on `account_id` and a GiST index on `account_path`. **`account_path` is filled in by a database trigger from `account_id`, never accepted from the app or the browser.**

### Shared-versus-app test, stated for every table

The test (CLAUDE.md section 1): if two apps each stored this and disagreed, would a user call it a bug? All 17 tables are **Core**: every one is either identity, the account tree, entitlements, branding, or platform record-keeping that every app reads. None is app-prefixed. Each table below states its own answer.

### Which tables are tenant-scoped and which are platform-global

| Platform-global (no `account_id`) | Tenant-scoped (`account_id` + `account_path`) |
|---|---|
| `users`, `accounts`, `applications`, `platform_staff` (already on the CLAUDE.md list) | `account_memberships`, `organization_agent_settings`, `brand_kits`, `account_theme`, `subscriptions`, `ownership_transfers`, `audit_logs`, `events` |
| **Proposed additions, need your OK (question Q1):** `brokerages`, `agent_profiles`, `role_permissions`, `platform_theme`, `impersonation_sessions` | |

---

### 1. `users`

**What it is for:** one row per person who can log in, the single identity every app points at.

- Shared test: an agent's name or email disagreeing between two apps is a bug. **Shared, Core.**
- Platform-global.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Same value as the Supabase login record (`auth.users.id`). No default; set from auth. |
| `email` | citext, unique, not null | Login email. Changing it is an audited action. |
| `full_name` | text | |
| `avatar_path` | text | Storage path, not a public URL. |
| `status` | text: `active`, `suspended` | Suspended users cannot log in. Never deleted. |
| `last_sign_in_at` | timestamptz | |
| `created_at`, `updated_at` | timestamptz | |

**RLS in plain English**
- You can read and update your own row (except `status`).
- You can read the name and avatar of people who share an account with you or sit in an account under your authority.
- Staff can read all users. Only `owner` and `superadmin` staff can change `status`.
- Nobody can delete a user row.

**Indexes:** unique on `email`.

---

### 2. `accounts`

**What it is for:** every customer entity (a franchise, a regional organization, a brokerage office, a team, or one agent's personal account) as one row in one tree.

- Shared test: two apps disagreeing about which team an office contains is a bug. **Shared, Core.**
- Platform-global (it *is* the tenant boundary).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `parent_account_id` | uuid, nullable, references `accounts` | Null for top-level accounts. |
| `account_type` | text: `platform`, `corporate`, `organization`, `brokerage`, `team`, `individual` | |
| `path` | ltree, not null, unique | The tree address. Built by trigger from the parent's path plus this account's id. |
| `name` | text, not null | |
| `slug` | text, not null, unique | For URLs. |
| `status` | text: `active`, `suspended`, `closed` | Closed accounts keep all data read-only. |
| `brokerage_id` | uuid, nullable, references `brokerages` | For `brokerage` accounts: the legal entity in the brokerage library. |
| `timezone` | text, default `America/Chicago` | Default only; every account can change it. |
| `phone`, `email`, `website_url` | text | |
| `data_portability_policy` | text, nullable | What happens to a team's data if the team leaves. Values pending question Q4. |
| `contact_retention_policy` | text, nullable | Whether the account also keeps a copy of `org_generated` leads when an agent leaves. Values pending question Q4. The agent's own copy is never affected by this. |
| `created_by_user_id` | uuid, nullable, references `users` | |
| `created_at`, `updated_at` | timestamptz | |

**Tree rules (enforced by the database)**
- Exactly one `platform` account exists, with no parent, and no customer memberships.
- `individual` accounts always have no parent (question Q2). Nobody above an agent has authority over their personal account.
- A `team` can sit under a `brokerage`; a `brokerage` under an `organization` or nothing; an `organization` under a `corporate` or nothing. Anything else is rejected.
- Moving an account to a new parent ("reparenting") is staff-only. It rewrites the path on that account, every account beneath it, and the `account_path` on every customer row beneath it, in one transaction, and writes an audit entry. Rare and deliberate; it is how KW Birmingham gets slid in above KW Metro South later.

**RLS in plain English**
- You can read every account at or beneath an account where you are an active member.
- You can also read the name, type, and branding-related fields of the accounts directly **above** yours (so a team member sees "KW Metro South" in the header), but nothing else about them. Siblings, such as other teams in the same office, are invisible unless you hold authority above them.
- Owners and admins can edit details of accounts within their authority, if `role_permissions` grants `account.update` for that account type.
- Only staff can create `corporate` and `organization` accounts, reparent, or change `account_type`. Brokerage and team creation in the demo is done by staff or the seed script; self-serve signup is post-demo.
- Nobody can delete an account.

**Indexes:** GiST on `path`; unique on `path`; unique on `slug`; `parent_account_id`; `brokerage_id`; `account_type`.

---

### 3. `account_memberships`

**What it is for:** who belongs to which account, with which of the four roles. Also holds pending invitations.

- Shared test: someone being an admin in one app and a stranger in another is a bug. **Shared, Core.**
- Tenant-scoped.

| Column | Type | Notes |
|---|---|---|
| `id`, `account_id`, `account_path` | | Standard. |
| `user_id` | uuid, nullable, references `users` | Null while an invitation is pending and the person has no login yet. |
| `role` | text: `owner`, `admin`, `member` | Exactly these three. |
| `is_broker_of_record` | boolean, default false | Can accompany any role. |
| `status` | text: `invited`, `active`, `removed` | Removal never deletes the row. |
| `invited_email` | citext, nullable | Where the invitation went. |
| `invite_token_hash` | text, nullable | Only a hash is stored, never the raw link token. |
| `invite_expires_at` | timestamptz, nullable | |
| `invited_by_user_id` | uuid, nullable, references `users` | |
| `joined_at` | timestamptz, nullable | When the invitation was accepted. |
| `removed_at`, `removed_by_user_id` | nullable | |
| `contact_policy_acknowledged_at` | timestamptz, nullable | When the agent saw the account's contact policy while accepting (CLAUDE.md section 4, Contacts). |
| `created_at`, `updated_at` | timestamptz | |

**Rules:** one active or invited membership per person per account. Removing a membership is instant (access is gone on the next request) and starts the offboarding workflow (see `ownership_transfers`).

**RLS in plain English**
- You can read your own memberships.
- You can read memberships on any account at or beneath an account where you are active (so a team admin sees the team roster, a brokerage admin sees every team roster in the office).
- Inviting requires `members.invite` at that account or above. Changing roles or removing requires `members.manage`.
- **No one can grant a role higher than their own.** An admin cannot create an owner. An owner of a team cannot make anyone owner of the brokerage above it.
- Removing the last owner of an account is refused.
- Nobody can delete a membership row.

**Indexes:** `account_id`; GiST `account_path`; `user_id`; `invited_by_user_id`; `removed_by_user_id`; unique on (`account_id`, `user_id`) where status is not `removed`; unique on (`account_id`, `invited_email`) where status is `invited`; `invite_token_hash`.

---

### 4. `platform_staff`

**What it is for:** the list of ListApps employees and what each is allowed to do. Kept completely separate from customer roles.

- Shared test: staff access is platform-wide by nature. **Core.**
- Platform-global.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, unique, references `users` | |
| `staff_role` | text: `owner`, `superadmin`, `sales`, `sales_admin`, `support` | |
| `can_elevate_impersonation` | boolean, default false | The separate permission needed to take write actions while impersonating. Never possible for `sales`. |
| `active` | boolean, default true | Deactivated, never deleted. |
| `created_at`, `updated_at` | timestamptz | |

**RLS in plain English**
- Staff can read the staff list. Customers cannot read it at all.
- Only `owner` staff can add, change, or deactivate staff, except `sales_admin` may manage `sales` staff.
- Every change is audited.

**Indexes:** unique `user_id`.

---

### 5. `role_permissions`

**What it is for:** the list of things each role may do at each kind of account, for example "a team admin may invite members." Adding a capability is adding a row.

- Shared test: one permission list read by every app. **Core.**
- Platform-global reference data (question Q1).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_type` | text | Same values as `accounts.account_type`. |
| `role` | text: `owner`, `admin`, `member`, `broker_of_record` | `broker_of_record` rows add capabilities for members carrying that flag. |
| `permission` | text | A flat string such as `members.invite`, `account.update`, `listing.reassign`. |
| `created_at`, `updated_at` | timestamptz | |

**Starting rows** (seeded, small, easy to change): owners and admins of brokerages and teams get `members.invite`, `members.manage`, `account.update`, `brand_kit.manage`, `agent_settings.manage`. Owners additionally get `subscriptions.view`. Members get read-only access. `listing.reassign` is added only at brokerage and organization scope when listings arrive in Milestone 2.

**RLS in plain English:** any signed-in user can read it (it is a rulebook, not data). Only `owner` and `superadmin` staff can change it, and every change is audited.

**Indexes:** unique on (`account_type`, `role`, `permission`).

---

### 6. `impersonation_sessions`

**What it is for:** a permanent log of every time a ListApps staff member viewed the platform as a customer.

- Shared test: one log for the whole platform. **Core.**
- Platform-global (question Q1); it records staff behavior, not customer data.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `staff_user_id` | uuid, references `users` | Who looked. |
| `target_user_id` | uuid, references `users` | Who they looked as. |
| `reason` | text, not null | Required to start. |
| `mode` | text: `read_only`, `elevated` | Starts `read_only`. |
| `elevated_at`, `elevated_reason` | nullable | Required to switch to `elevated`. Refused for `sales`. |
| `started_at` | timestamptz, not null | |
| `ended_at` | timestamptz, nullable | Sessions auto-expire after a fixed time. |
| `notification_queued_at` | timestamptz, nullable | When the "someone accessed your account" email was queued. Not optional. |
| `notification_sent_at` | timestamptz, nullable | |
| `created_at`, `updated_at` | timestamptz | |

**Every action taken** during the session is written to `audit_logs` with this session's id, so the full trail lives in one place.

**Hard refusals while impersonating, even for the owner:** exporting contacts, changing password or email, changing billing, deleting anything. Enforced in the server code and, where the database can tell, by the database.

**RLS in plain English**
- Staff can read sessions. Only the staff member who started a session can end it.
- The impersonated user can read the sessions about them (who, when, why), for transparency.
- Nobody can edit the reason, the start time, or the people after the fact. Nobody can delete a session.

**Indexes:** `staff_user_id`; `target_user_id`; `started_at`.

---

### 7. `agent_profiles`

**What it is for:** an agent's professional identity (name, license, headshot, bio, contact) that belongs to them and follows them to any brokerage.

- Shared test: an agent's phone number disagreeing between two apps is the textbook bug. **Shared, Core.**
- **Owned by the person, not by any account** (question Q1). Giving it an `account_id` would make it belong to a brokerage, which is exactly what CLAUDE.md section 4 forbids.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, unique, references `users` | The owner. |
| `legal_first_name`, `legal_last_name` | text | |
| `display_name` | text | How they want to appear. |
| `license_number`, `license_state` | text | Agent-editable, every change audited (it appears on advertising). |
| `mls_agent_id` | text | Captured now, used later for MLS lookups. |
| `mobile_phone`, `email` | text | Personal contact. |
| `headshot_path` | text | Storage path. |
| `bio` | text | |
| `designations` | text[] | GRI, ABR, CRS. |
| `website_url` | text | |
| `social_links` | jsonb | Simple map of network to URL. |
| `current_brokerage_id` | uuid, nullable, references `brokerages` | Picked from the brokerage library. Used later to snapshot `hosting_brokerage_id` onto Openly claims. Changing it is audited. |
| `created_at`, `updated_at` | timestamptz | |

**RLS in plain English**
- The agent reads and edits their own profile, every field.
- People who share an account with the agent, or hold authority above an account the agent belongs to, can read it (a teammate needs to see who is hosting). They cannot edit it.
- Staff can read it. `sales` staff can read only name and brokerage, not contact details.
- Nobody else can see it. Nobody can delete it.

**Indexes:** unique `user_id`; `current_brokerage_id`; (`license_state`, `license_number`); `mls_agent_id`.

---

### 8. `organization_agent_settings`

**What it is for:** the details an office or team controls about an agent while they are there (mandated display name, office-issued email and line, team title, office-paid headshot). This stays with the account when the agent leaves.

- Shared test: an agent's office line disagreeing between two apps is a bug. **Shared, Core.**
- Tenant-scoped.

| Column | Type | Notes |
|---|---|---|
| `id`, `account_id`, `account_path` | | Standard. |
| `user_id` | uuid, references `users` | The agent. |
| `display_name_override` | text, nullable | E.g. "Jane Smith, REALTOR®, Licensed in Alabama". |
| `org_email`, `org_phone` | text, nullable | |
| `office_name` | text, nullable | |
| `team_title` | text, nullable | "Buyer Specialist". |
| `mandated_bio` | text, nullable | |
| `org_headshot_path` | text, nullable | |
| `created_at`, `updated_at` | timestamptz | |

**How marketing uses it later:** one resolver checks this row first, then falls back to `agent_profiles`. Built once, used everywhere.

**RLS in plain English**
- The agent can read their own rows. They cannot edit them (the account owns these).
- Owners and admins with `agent_settings.manage` at that account or above can read and edit.
- Members of the same account can read (for the same reason as profiles).
- Nobody can delete a row; it simply stops applying when the membership is removed.

**Indexes:** `account_id`; GiST `account_path`; `user_id`; unique (`account_id`, `user_id`).

---

### 9. `brokerages`

**What it is for:** the curated library of real brokerage offices and franchises (legal name, license, qualifying broker, logos, required disclaimer) that agents pick from instead of typing.

- Shared test: two apps showing different legal names for the same office is a bug, and a compliance one. **Shared, Core.**
- **Platform-global** (question Q1), per `docs/09`: the same KW Metro South record serves every agent who works there and every agent on the other side of an open house. Only public, legally required facts live here.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `kind` | text: `franchise`, `office` | Franchise records hold brand-wide rules once (e.g. Keller Williams). |
| `franchise_id` | uuid, nullable, references `brokerages` | An office points at its franchise. |
| `legal_name` | text, not null | |
| `display_name` | text | DBA. |
| `office_name` | text | |
| `qualifying_broker_name`, `qualifying_broker_license_number` | text | |
| `license_number`, `license_state` | text | Brokerage license. |
| `logo_light_path`, `logo_dark_path`, `logo_franchise_required_path` | text | |
| `address_line1`, `address_line2`, `city`, `state`, `postal_code` | text | |
| `phone`, `website_url` | text | |
| `mls_identifiers` | jsonb | Office ids per MLS. |
| `required_disclaimer_text` | text, nullable | Brokerage-level required text. |
| `status` | text: `verified`, `pending_review`, `user_submitted` | Supports the future "request to add" queue; only the column now. |
| `submitted_by_user_id` | uuid, nullable, references `users` | |
| `created_at`, `updated_at` | timestamptz | |

**RLS in plain English**
- Any signed-in user can read `verified` brokerages (the typeahead), plus any they submitted themselves.
- Only `owner` and `superadmin` staff can create, edit, or verify. Agents can never edit the brokerage name or address; that is the legal guardrail from `docs/06`.
- Nobody can delete one; retired offices get a status, added later if needed.

**Indexes:** `franchise_id`; `submitted_by_user_id`; (`state`, `city`); trigram index on `legal_name` and `display_name` for typeahead search; `status`.

---

### 10. `brand_kits`

**What it is for:** the logos, colors, fonts, and required disclaimer text an account uses on marketing. A team without its own kit inherits the brokerage's.

- Shared test: the team's colors differing between two apps is a bug. **Shared, Core.**
- Tenant-scoped. One kit per account at most; resolution walks up the tree to the nearest account that has one.

| Column | Type | Notes |
|---|---|---|
| `id`, `account_id`, `account_path` | | Standard. Unique on `account_id`. |
| `name` | text | |
| `logo_light_path`, `logo_dark_path` | text | |
| `team_logo_path` | text, nullable | The optional team or agent logo slot (CLAUDE.md section 12, Milestone 4). Field now, feature later. |
| `color_primary`, `color_secondary`, `color_accent` | text | Hex values. |
| `font_heading`, `font_body` | text | |
| `required_disclaimer_text` | text, nullable | **The disclaimer insurance from CLAUDE.md section 4.** Becomes `{{disclaimer.required_text}}`. |
| `created_at`, `updated_at` | timestamptz | |

**RLS in plain English**
- Anyone at or beneath the account can read its kit, and accounts beneath inherit it.
- Editing requires `brand_kit.manage` at that account or above. Changes to `required_disclaimer_text` are audited.
- Nobody can delete a kit.

**Indexes:** unique `account_id`; GiST `account_path`.

---

### 11. `platform_theme`

**What it is for:** the single, owner-controlled look of the whole ListApps platform (colors, fonts, per-app accent colors).

- Shared test: one theme for everything. **Core.**
- Platform-global (question Q1), exactly one row.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `singleton` | boolean, default true, unique, must be true | Guarantees there is only one row. |
| `tokens` | jsonb | Design token values (same names as `app/tokens.css`). |
| `app_accents` | jsonb | Accent color per application slug. |
| `logo_light_path`, `logo_dark_path` | text | |
| `updated_by_user_id` | uuid, nullable, references `users` | |
| `created_at`, `updated_at` | timestamptz | |

**RLS in plain English:** everyone (even signed-out visitors) can read it, because the login page needs it. Only `owner` staff can change it.

**Indexes:** unique `singleton`; `updated_by_user_id`.

---

### 12. `account_theme`

**What it is for:** optional look-and-feel overrides at any account, for white-label later. Nearest ancestor with a value wins, then the platform theme.

- Shared test: the same account looking different in two apps is a bug. **Shared, Core.**
- Tenant-scoped.

| Column | Type | Notes |
|---|---|---|
| `id`, `account_id`, `account_path` | | Standard. Unique on `account_id`. |
| `tokens` | jsonb | Only the tokens being overridden. |
| `created_at`, `updated_at` | timestamptz | |

**RLS in plain English:** readable at or beneath the account. In Milestone 1, editable only by `owner` and `superadmin` staff (white-label is not a customer feature yet).

**Indexes:** unique `account_id`; GiST `account_path`.

---

### 13. `applications`

**What it is for:** the list of ListApps apps (Openly, ListVault, Curb, Pulse, Trakkt, Reach, Ops, Atlas) so subscriptions and the app switcher can refer to them.

- Shared test: one list for everything. **Core.**
- Platform-global.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text, unique | `openly`, `listvault`, ... |
| `name` | text | |
| `status` | text: `available`, `coming_soon`, `hidden` | |
| `sort_order` | integer | App switcher order. |
| `created_at`, `updated_at` | timestamptz | |

**RLS in plain English:** any signed-in user can read. Only `owner` and `superadmin` staff can change.

**Indexes:** unique `slug`.

---

### 14. `subscriptions`

**What it is for:** which account has which app, and whether it covers the accounts beneath it.

- Shared test: an app showing as paid in one place and unpaid in another is a bug. **Shared, Core.**
- Tenant-scoped.

| Column | Type | Notes |
|---|---|---|
| `id`, `account_id`, `account_path` | | Standard. |
| `application_id` | uuid, references `applications` | |
| `plan` | text | Free text label for now; no billing in the demo. |
| `status` | text: `trialing`, `active`, `past_due`, `lapsed`, `canceled` | |
| `trial_ends_at`, `current_period_ends_at` | timestamptz, nullable | |
| `includes_descendants` | boolean, default false | **The business model in one field.** |
| `seat_limit` | integer, nullable | Null means unlimited. |
| `seats_used` | integer, default 0 | Kept current by the server; checked against the limit. |
| `created_by_user_id` | uuid, nullable, references `users` | |
| `created_at`, `updated_at` | timestamptz | |

**How access resolves** (CLAUDE.md section 4, with one clarification in question Q3): you can use an app if (a) your own `individual` account has an active subscription to it, or (b) an account you are an active member of has one, or (c) an account above that one has one with `includes_descendants` on, and seats are available.

**When a subscription lapses:** access to the app turns off; data is never deleted and stays readable and exportable.

**RLS in plain English**
- Readable by members at or beneath the account (so the app switcher works). Seat counts and plan details only by owners with `subscriptions.view`.
- Only staff (not `support`) can create or change subscriptions in Milestone 1. Every change is audited.
- Nobody can delete a subscription.

**Indexes:** `account_id`; GiST `account_path`; `application_id`; `created_by_user_id`; unique on (`account_id`, `application_id`) where status is `trialing`, `active`, or `past_due`.

---

### 15. `ownership_transfers`

**What it is for:** the hand-off list created when someone leaves, recording every item that moved, from whom, to whom, and who decided.

- Shared test: an item belonging to two people in two apps is a bug. **Shared, Core.**
- Tenant-scoped (addressed to the account the item lives in).

| Column | Type | Notes |
|---|---|---|
| `id`, `account_id`, `account_path` | | Standard. |
| `membership_id` | uuid, references `account_memberships` | The removal that started this. Groups one person's hand-off list. |
| `item_type` | text | `organization_agent_settings`, `subscription_seat`, and later `listing`, `generated_asset`, `openly_claim`, and so on. |
| `item_id` | uuid | |
| `from_user_id` | uuid, references `users` | |
| `default_to_user_id` | uuid, nullable, references `users` | The next authority up, filled in automatically. |
| `to_user_id` | uuid, nullable, references `users` | Who actually received it. |
| `status` | text: `pending`, `accepted`, `reassigned`, `not_transferable` | `not_transferable` is how personal items such as an agent's own contacts are listed but never moved. |
| `actor_user_id` | uuid, nullable, references `users` | Who accepted or reassigned. |
| `reason` | text, nullable | |
| `completed_at` | timestamptz, nullable | |
| `created_at`, `updated_at` | timestamptz | |

**RLS in plain English**
- The departing person can read the list about them (they can see what moved, never change it).
- The receiving person and anyone with `members.manage` at or above the account can read and complete items.
- Completed items cannot be edited. Nobody can delete a row.

**Indexes:** `account_id`; GiST `account_path`; `membership_id`; `from_user_id`; `default_to_user_id`; `to_user_id`; `actor_user_id`; (`item_type`, `item_id`); `status`.

---

### 16. `audit_logs`

**What it is for:** a permanent, tamper-proof record of sensitive actions: role changes, removals, brokerage changes, disclaimer changes, subscription changes, license changes, and everything done while impersonating.

- Shared test: one history for the platform. **Core.**
- Tenant-scoped. Platform-level actions are addressed to the `platform` account.

| Column | Type | Notes |
|---|---|---|
| `id`, `account_id`, `account_path` | | Standard. |
| `actor_user_id` | uuid, nullable, references `users` | Null for system actions. |
| `impersonation_session_id` | uuid, nullable, references `impersonation_sessions` | Set when a staff member acted as someone else. |
| `action` | text | `membership.role_changed`, `agent_profile.license_changed`, ... |
| `target_type`, `target_id` | text, uuid | |
| `before`, `after` | jsonb | The changed fields only. |
| `reason` | text, nullable | |
| `ip_address` | inet, nullable | |
| `occurred_at` | timestamptz, default now() | |
| `created_at`, `updated_at` | timestamptz | `updated_at` exists for consistency and never changes. |

**RLS in plain English**
- Owners and admins can read entries for accounts at or beneath them.
- You can read entries where you were the target or the actor.
- Staff can read all, except `sales`, who cannot.
- **Nobody, including staff and the owner, can edit or delete an entry.** The database blocks updates and deletes outright, not just by policy.

**Indexes:** `account_id`; GiST `account_path`; `actor_user_id`; `impersonation_session_id`; (`target_type`, `target_id`); `occurred_at`.

---

### 17. `events`

**What it is for:** the shared stream of things that happened (someone joined, an app was opened, later an open house was claimed or a visitor signed in). Reports are built from it.

- Shared test: two apps counting the same sign-in differently is a bug. **Shared, Core.**
- Tenant-scoped.

| Column | Type | Notes |
|---|---|---|
| `id`, `account_id`, `account_path` | | Standard. |
| `application_id` | uuid, nullable, references `applications` | Null for Core events. |
| `actor_user_id` | uuid, nullable, references `users` | |
| `event_type` | text | `membership.joined`, `app.opened`, ... |
| `subject_type`, `subject_id` | text, uuid, nullable | |
| `payload` | jsonb | Small details only; never personal contact data. |
| `occurred_at` | timestamptz, default now() | |
| `created_at`, `updated_at` | timestamptz | |

**Growth note:** this becomes the largest table. At demo scale a plain table is right. Monthly partitioning is a later, additive change.

**RLS in plain English:** readable at or beneath the account by owners and admins, and by the actor. Written only by the server. Never edited, never deleted.

**Indexes:** `account_id`; GiST `account_path`; `application_id`; `actor_user_id`; (`event_type`, `occurred_at`); (`subject_type`, `subject_id`).

---

## Part 4: Shared database plumbing (technical, no business decisions)

- **Extensions:** `ltree` (tree paths), `citext` (case-insensitive email), `pg_trgm` (brokerage typeahead). All available on Supabase.
- **Path labels** are the account id without dashes, so paths never change when names change.
- **Triggers:** `updated_at` on every table; `accounts.path` from parent; `account_path` on every tenant table from `account_id`; append-only guard on `audit_logs` and `events`; tree-shape validation on `accounts`.
- **Helper functions** used by policies (security definer, read-only, `search_path` pinned): "paths I am an active member of", "am I staff, and which role", "do I hold permission P at or above account A". One set, reused by every table.
- **Every migration** is a numbered up/down pair (see `db/migrations/README.md`) and is tested against the local throwaway Postgres before it touches `listapps-development`.
- **Automated RLS tests** (backlog M1-4) will prove, with real queries: a second brokerage is invisible; authority flows down and never up or sideways; `sales` staff cannot read protected data; audit entries cannot be edited or deleted; nobody can grant a role above their own.

---

## Part 5: What I need from Joseph

**Main decision (D-003):** approve this schema so migrations can be written. You can approve it as written, or approve it with changes to any of the questions below.

**Q1. A few tables belong to everyone, not to one office.** CLAUDE.md's list of platform-wide tables names users, accounts, applications, staff, and properties. This proposal adds five more, each for a reason:
- `brokerages`: one KW Metro South record serves every agent, as `docs/09` already says.
- `agent_profiles`: belongs to the person, so it cannot belong to an office.
- `role_permissions`, `platform_theme`, `impersonation_sessions`: ListApps' own rulebook, look, and staff log.
- **Recommendation:** approve, and I will add them to the CLAUDE.md list.

**Q2. An agent's personal account sits outside the office tree.** If it sat under the team, the team owner would have authority over the agent's personal purchases and data.
- **Recommendation:** approve. It is the database version of "your data is yours."

**Q3. A subscription on your own team counts, even without "includes descendants."** Example: The Daley Group buys Pulse for its five agents. Those agents are members of the team itself, so they get it. "Includes descendants" only decides whether it also flows further down. The written rule in CLAUDE.md only mentions ancestors, so this fills a gap.
- **Recommendation:** approve.

**Q4. Defaults for two customer-facing policies.** These are not needed for the migration (the columns can start empty and be set per account), so they are a separate decision, D-007. Answering D-003 does not wait on them.
