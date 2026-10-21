# Account Hierarchy, Roles, Entitlements, and Billing
## Revision A, August 20, 2026

---

## First: Are You Thinking Too Big?

You asked directly, so here is the direct answer.

**No on the structure. Yes on the surface area.**

The hierarchy you sketched is correct. Real estate genuinely nests that way: a franchise brand contains regional organizations, which contain brokerage offices, which contain teams, which contain agents. KW Birmingham having six offices and KW Metro South being one of them is not you dreaming, that is just how the industry is shaped. If you build a flat "organization has users" model today, adding those layers later means migrating every row and rewriting every permission check in the product. That is a rewrite, and it is the exact thing you have been trying to avoid.

**Where you were making it harder than it needs to be** is in thinking of that hierarchy as fifteen roles. It is not fifteen roles. It is **one nesting structure with four roles that repeat at every level.** That realization collapses your entire screenshot into something small enough to build in Milestone 1.

So: build the tree now, because it is cheap now and brutal later. But only show three levels in the interface for a good while.

---

## The Model: One Tree, Four Roles

### `accounts` is a tree

Every customer entity in ListApps is a row in one table, `accounts`, and every row can have a parent.

- `id`
- `parent_account_id`, nullable, pointing at another account
- `account_type`: `platform`, `corporate`, `organization`, `brokerage`, `team`, `individual`
- `path`, a materialized ancestry path used for fast "is this beneath that" queries
- `name`, `slug`, `status`
- Contact info, timezone, default brand kit, subscription state
- `data_portability_policy`, `contact_retention_policy`

That is it. One table describes your entire screenshot.

### Your screenshot, mapped

| What you called it | `account_type` | Role on that account |
|---|---|---|
| ListApps Owner | `platform` | see platform staff below |
| ListApps SuperAdmin | `platform` | see platform staff below |
| ListApps Sales Team | `platform` | see platform staff below |
| Sales Team Admin | `platform` | see platform staff below |
| Technical Support Specialist | `platform` | see platform staff below |
| Corporate Owner (KW International, RE/MAX, REAL, LPT) | `corporate` | `owner` |
| Corporate Admin | `corporate` | `admin` |
| Organization Owner (KW Birmingham) | `organization` | `owner` |
| Organization Admin | `organization` | `admin` |
| Brokerage Owner (KW Metro South) | `brokerage` | `owner` |
| Broker Account / Broker of Record | `brokerage` | `broker_of_record` flag |
| Brokerage Admin | `brokerage` | `admin` |
| Agent / Team Owner | `team` | `owner` |
| Agent / Team Owner Admin | `team` | `admin` |
| Team Agent | `team` | `member` |
| Solo agent, no team | `individual` | `owner` |

**Four customer roles total: `owner`, `admin`, `member`, and a `broker_of_record` flag** that can sit alongside any of them, because as you noted the brokerage owner is often also the broker, and sometimes the broker is a separate person.

Fifteen role names became four. Nothing was lost, because the level of authority now comes from **where you sit in the tree**, not from a longer role name.

### `account_memberships`

- `account_id`, `user_id`, `role`, `is_broker_of_record`
- `status`, `joined_at`, `invited_by`

A user can hold memberships on several accounts. That matters more than it sounds: it is what lets an agent be a `member` of the KW Metro South team **and** the `owner` of their own `individual` account where they buy their own apps.

### Authority flows downward

This is the whole trick. A membership grants authority over that account **and everything beneath it in the tree.**

- Owner at KW Birmingham → full authority over all six offices, every team in them, and every agent.
- Admin at KW Metro South → admin authority over teams and agents in that office, none over sibling offices.
- Owner of The Daley Group team → authority over that team's agents, nothing above.

Nobody had to define fifteen roles for that. It falls out of the structure.

**On the security side**, this is enforced by a path-prefix check at the database level: you can see a row if its account path starts with a path you have membership on. It is indexed and fast, and it means an agent at one brokerage physically cannot query another brokerage's data even if the application code has a bug.

**One honest cost:** this is more complex than a flat `organization_id` check, and it will add roughly a week to Milestone 1. It is worth every day of it. Retrofitting a tree onto a flat model touches every table and every query in the product.

---

## Platform Staff Are a Separate Table

ListApps employees are not customers and their access must never come from a customer role. They live in `platform_staff` with `user_id` and `staff_role`:

- `owner` — you. Everything, including platform theming and billing configuration.
- `superadmin` — everything except transferring ownership.
- `sales` — read all accounts, create accounts, manage trials and plans, cannot see customer contacts or listing content.
- `sales_admin` — everything sales has, plus managing the sales team.
- `support` — read all accounts, impersonate for support, cannot change billing.

**Note what sales cannot do.** A salesperson does not need to read an agent's contacts or seller notes to do their job, and giving them that access undermines the promise you made in the next section. Scope it tight from the start.

---

## Assume Identity: Yes, But Only At The Top, And Never Silently

You landed on the right instinct yourself: "maybe this only needs to be on the ListApps.co owner, super admins, sales team, and tech support roles."

**That is exactly right, and it should be a hard rule.** Here is why it matters more than it looks.

You told me you do not want agents worried about their data being taken or retracted. That promise is the heart of your product. Now consider what impersonation is: the ability for one person to log in as another and see everything they see. If a team owner can assume an agent's identity, that team owner can read every private note, every contact, and every conversation the agent has, and can send email as them. That capability, sitting in the hands of the person the agent is most likely to be worried about, quietly destroys the promise no matter what your marketing says.

**So: impersonation exists only for `platform_staff`. It never exists for any customer role, at any level of the tree, including corporate and organization owners.** A brokerage owner has authority over listings and organizational data through the tree. They do not have the ability to become a person.

### How impersonation gets built

- Only `owner`, `superadmin`, `support`, `sales`, and `sales_admin` can initiate it, and `sales` is read-only.
- **Read-only by default.** Taking write actions while impersonating requires a separate elevated permission and a stated reason.
- **A persistent, unmissable banner** across the top of every screen for the entire session. No exceptions, no dismissing it.
- **Every session logged** in `impersonation_sessions`: who, whom, started, ended, reason, and every action taken.
- **Never permitted, even for the owner:** exporting contacts, changing a password, changing an email address, changing billing, or deleting anything. These are the actions where impersonation stops being support and starts being a breach.
- **The impersonated user gets notified** by email afterward, showing who accessed their account and when.

That last point is the one that turns a liability into a trust signal. Being able to tell an agent "yes we can help you over the phone, and you will get an email every single time anyone from our team looks at your account" is a better story than pretending the capability does not exist.

---

## Entitlements: Selling To Brokerages And To Agents At The Same Time

This was your other big question, and the tree answers it cleanly.

### `subscriptions`

- `account_id` — which node in the tree bought it
- `application_id` — ListVault, Linked, Openly, Pulse, Trakkt
- `plan`, `status`, `trial_ends_at`
- `includes_descendants` — **this one field is the whole business model**
- `seat_limit`, `seats_used`

### How access resolves

An agent has access to an app if **either** of these is true:

- Their own `individual` account has an active subscription to it, **or**
- Any ancestor account above them has an active subscription with `includes_descendants = true` and available seats.

That single rule covers every scenario you described:

- **KW Birmingham buys ListVault for all six offices.** One subscription on the organization node, `includes_descendants = true`, seat limit 400. Every agent underneath gets it.
- **KW Metro South buys Openly for their office only.** Subscription on the brokerage node. Sibling offices do not get it.
- **An agent whose brokerage bought nothing wants ListVault.** They subscribe on their own `individual` account. Works identically.
- **An agent whose brokerage provides ListVault wants Linked too.** Brokerage subscription covers ListVault. The agent adds their own Linked subscription on their individual node. Both resolve. **This is your answer to "can agents beneath the hierarchy upgrade their own accounts": yes, and it requires no special handling.**
- **The Daley Group team buys Pulse for its five agents.** Subscription on the team node with a seat limit of five.

### What happens when a subscription lapses

This matters because of the promise you made.

- Access to the app turns off.
- **Data is never deleted.** It goes read-only and stays exportable.
- If a brokerage cancels and an agent had been using it under that umbrella, the agent keeps a read-only view of their own work and can export it or subscribe individually to restore access.

Nobody ever loses their work because someone above them stopped paying. Write that into your terms as well as your code.

---

## Platform Theming

You want to control the look of the whole platform: site colors, fonts, app accent colors, branding.

- `platform_theme` — a single row you control as owner. Colors, fonts, logos, per-app accent colors.
- `account_theme` — optional overrides at any node in the tree, for white-label later. Resolves the same way as everything else: nearest ancestor with a theme set wins.
- Every color, font, and radius is a design token, never a hardcoded value in a component. This is the technical requirement that makes white-label possible without a rewrite.

Same resolution pattern as brand kits, permissions, and entitlements. Once you build the "walk up the tree until you find a value" function, it serves five different features.

---

## Agent Profile Editing, With The Legal Guardrail

You said agents can edit everything except brokerage name and brokerage address, because that is legal information. That is already how the split works and it needs no special rule:

- **Brokerage name, DBA, address, license, and broker of record live on the `brokerages` record.** An agent has read-only access to it. They cannot edit it because it is not on their record at all.
- **Everything on `agent_profiles` is theirs to edit:** display name, personal phone, personal email, headshot, bio, designations, license number, license state, MLS agent ID, personal website, socials.
- **`organization_agent_settings` is editable by their org's owner or admin**, not by the agent. That is where an org-mandated display name format or org-issued phone line lives.

One addition worth making: **license number and license state should be agent-editable but change-logged.** Agents genuinely do need to correct a typo, and you genuinely want a record of when it changed, because it appears on advertising.

---

## Disclaimers: Deferred, With One Cheap Piece Of Insurance

You said leave disclaimers out for now and add them later. Agreed, and it is a meaningful scope reduction. The full inheritance system was one of the heaviest things in the original spec.

**But do not defer all of it, because one small piece is very expensive to retrofit.** Here is the cheap insurance:

- Put a `required_disclaimer_text` field on `brand_kits` now. One text field.
- Make `{{disclaimer.required_text}}` a real template variable from the first template, resolving to that field.
- Every generated asset stores which disclaimer text it used, as a snapshot.

That is maybe two hours of work. It means every template ever designed already has a disclaimer slot in the layout, and every generated asset already has a record of what it said. When you build the real inheritance system later, you change **one resolver function** and every existing template starts pulling from the new system automatically.

Skip this, and every template you design between now and then has no place to put required text, and you redesign all of them. Design decisions are the expensive part, not code.

---

## What Gets Built Now Versus Later

**Milestone 1 builds the full tree in the database,** because the schema is the part that is expensive to change. But the interface only exposes three levels:

- **Brokerage** (KW Metro South)
- **Team** (The Daley Group)
- **Individual agent**

**`corporate` and `organization` account types exist in the schema and can be created by ListApps staff**, but there is no self-serve corporate signup and no corporate dashboard. When you land a conversation with a regional organization, you create the node yourself and reparent their brokerages under it. That takes minutes because the structure was already there.

That is the honest answer to thinking big without building big: **the model is enterprise from day one, the interface is not.**

---

## Updated Milestone 1

| Table | Purpose |
|---|---|
| `users` | Canonical identity |
| `accounts` | The tree: corporate, organization, brokerage, team, individual |
| `account_memberships` | Who belongs where, with which of four roles |
| `platform_staff` | ListApps employees, separate from customers |
| `role_permissions` | Flat permission strings per role and account type |
| `impersonation_sessions` | Every assume-identity session, fully logged |
| `agent_profiles` | Belongs to the person, follows them |
| `organization_agent_settings` | Belongs to the account, stays |
| `brokerages` | Legal brokerage entity, agent read-only |
| `brand_kits` | Logos, colors, fonts, `required_disclaimer_text` |
| `platform_theme` / `account_theme` | Site and app appearance |
| `applications` | The app registry |
| `subscriptions` | Entitlements, with `includes_descendants` |
| `ownership_transfers` | Offboarding, nothing ever deleted |
| `audit_logs` | Sensitive actions |
| `events` | The shared stream |

Sixteen tables. Up from fourteen, because the tree and impersonation earned their place.

**Milestone 1 is done when:** you can create KW Metro South, put The Daley Group under it, invite Kirsten as a team admin and Kim as a team agent, give the brokerage a ListVault subscription that flows down to both of them, have Kim separately buy Linked on her own individual account, confirm neither can see a second test brokerage's data, and impersonate Kim from a support account with a visible banner and a logged session that emails her afterward.

---

## Still Open

- **Trakkt naming.** Which product keeps it?
- **Echo.** Becomes Pulse's sync layer, or survives as its own app?
- **Openly and money.** Coordination only, or does it touch compensation?
- **Print quality promise.** Good PDF, or commercial press files?
- **Video in v1.** Links only, or uploads?
- **Beta cohort.** How many agents, and when?
