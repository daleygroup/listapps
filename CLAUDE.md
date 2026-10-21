# CLAUDE.md
## Standing instructions for every Claude Code session in this repository

You are building **ListApps**, a multi-tenant SaaS platform for real estate professionals, owned by Joseph Daley. Read this file completely at the start of every session. It outranks your defaults. When this file and a user request conflict, say so and ask.

The planning documents live in `docs/`. The architectural audit lives in `docs/audit/`. The original 90-section master specification is not yet in the repo (`docs/spec/` is reserved for it); the numbered documents in `docs/` supersede it wherever they conflict. Read the relevant documents before proposing schema.

**Every session also reads `docs/STATUS.md` (what is done and what is next) and `docs/DECISIONS.md` (what Joseph has approved, rejected, or not yet answered) before doing anything.**

---

## 0a. THE DEADLINE (REVISED October 21, 2026)

**As of October 21, 2026, no application code existed.** The original plan assumed building started August 24. Joseph chose a two-track plan ("Option C"):

- **Track 1, the prototype:** a clickable, sample-data prototype of the eight-step loop below, plus real branded graphics and a real scannable QR sign-in, ready to show the six Keller Williams Birmingham offices by October 30. It is built and published outside this repo. Do not build prototype screens in this codebase.
- **Track 2, the real build (this repo):** the production-shaped platform, built continuously by background sessions, aiming for the full eight-step loop on real data by roughly mid-December 2026, subject to the OHDibs non-renewal notice date Joseph is confirming.

**The real-build target is still the following eight-step loop working end to end on real data. Nothing else counts.**

1. Agent logs in at a KW Birmingham office
2. Sees the office's real listings
3. A listing agent posts an open house opportunity
4. A different agent claims it, instantly and atomically
5. The claiming agent gets branded graphics with **Listed by** and **Hosted by**, correct brokerage branding on both sides
6. They print a branded sign-in sheet with a QR code on it
7. A visitor scans the QR, signs in, and the lead lands in the **hosting agent's** database
8. The office owner sees coverage and sign-in counts by agent

**Steps 5 through 8 are what OHDibs does not do. That is the entire sale.**

**Demo standard, not production standard.** Real data, real logins, real generated graphics, a real scannable QR. Seeded by hand for one office. **No billing, no self-serve onboarding, no invitation flows at scale, no edge-case exhaustiveness.** Production hardening is Q1 2027, after they sign.

**If a proposed feature is not in that eight-step loop, it waits.** Say "that is post-demo" and move on. See `docs/09-Race-to-the-OHDibs-Deadline.md` for the original week-by-week; its dates are out of date but its scope is not.

---

## 0b. Unattended build runs (how background sessions work)

Most sessions in this repo are scheduled background runs with nobody watching. Joseph checks in once a day. These rules adapt section 0's "plan before building" rule to that reality. They do not loosen any security, scope, or data rule elsewhere in this file.

**Start of every run**
- `git fetch origin main` and rebase onto it before doing anything. Another run may have pushed.
- Read this file, `docs/STATUS.md`, and `docs/DECISIONS.md`.
- Pick the **first unblocked task** in the STATUS backlog. A task is blocked if it depends on a decision marked `PENDING` or on something only Joseph can provide.
- If another run's work is half-finished on a `wip/` branch for that task, continue it instead of starting over.

**Approval gates (these replace "wait for approval" in a live chat)**
- **Schema and migrations:** write the proposal to `docs/proposals/NNN-<name>.md` in plain language (what each table is for in one sentence a non-developer understands, plus the RLS policies in plain English), add a `PENDING` entry to `docs/DECISIONS.md`, commit, and move on to other unblocked work. **Never write or apply a migration until DECISIONS.md shows it `APPROVED` by Joseph.**
- **Any business decision** (pricing, naming, legal wording, who sees what, anything a customer would notice): add a `PENDING` entry with the options in business terms and your recommendation. Do not pick quietly.
- **Purely technical choices inside an approved scope** (file structure, library versions, test setup) do not need approval. Record notable ones in STATUS.md under "Notes".

**Doing the work**
- Small, finished slices. Every commit must build, typecheck, and pass tests.
- Commit to `main` only when `build`, `typecheck`, `lint`, and `test` all pass. Otherwise push to `wip/<task-slug>` and say so in STATUS.md.
- Before pushing, `git fetch origin main` and rebase. Never force-push `main`.
- Test databases are local and disposable (Postgres or PGlite inside the run). **Never connect to `listapps-production`.** Do not connect to any hosted database unless its credentials are already present as environment variables and DECISIONS.md approves using it.
- Never commit secrets, keys, or `.env` files. Never create accounts, buy services, or accept terms on any website.

**End of every run**
- Update `docs/STATUS.md`: tick finished tasks, add a dated line to the run log (what was done, what is next, anything broken), and keep the backlog in order.
- Commit and push.
- Keep the run log short. When it passes about 40 lines, roll the older entries into a one-paragraph weekly summary.

**When you must stop and wait on Joseph**
- Only for a true blocker: every remaining backlog task depends on a PENDING decision or something only Joseph can supply, or something is at risk (a security problem, a broken `main`, a cost or account issue).
- Email **joseph@dealwithdaley.com only**, using the Gmail connector, with subject `[ListApps WAITING] <one-line summary>` or `[ListApps URGENT] <one-line summary>`. Body: what stopped, what you need from him in plain language (bulleted, no em dashes, address him as Joseph), and **the link to your own session** so he can open it and reply. Your session link is the `Claude-Session:` URL in your git commit attribution instructions; include it exactly.
- Never email, message, or contact anyone other than Joseph. Never send more than one WAITING email per day for the same blocker; the 7 AM digest repeats it.

---

## 0. Non-negotiable operating rules

- **Plan before building.** For anything beyond a one-file change, present a plan and wait for approval. Never begin a migration without explicit approval of the schema. (In unattended runs, "approval" means an `APPROVED` entry in `docs/DECISIONS.md`; see 0b.)
- **Never create a table without checking Section 2 of this file first.**
- **Never write a migration that drops or renames a column in production without an explicit, written migration plan approved by Joseph.**
- **Never build ahead.** If a feature is not in the current milestone, do not build it, even if it is in the specification, even if it would be easy, even if you are already in the file. Say "that is Milestone N, not this one" and move on.
- **Never hardcode a customer.** The Daley Group, Keller Williams Metro South, Birmingham, and Alabama are the first tenant and the first market. They are data, never logic. If you find yourself typing any of those strings outside of a seed file, stop.
- **Ask rather than assume.** Joseph is not a developer. If a decision has a business consequence, surface it in plain language and let him decide. Do not quietly pick.

---

## 1. The one rule that matters most

**ListApps owns shared entities. Applications reference them by ID and own only what is unique to themselves.**

Before creating any table, apply this test:

> If two applications each stored this independently and they disagreed with each other, would a user consider that a bug?

- Agent phone number: yes, that is a bug. **Shared.**
- Property address: yes, that is a bug. **Shared.**
- A template's element z-index ordering: no. **App-owned.**
- Whether an Openly opportunity has been claimed: no. **App-owned.**

If the answer is yes, the table belongs in the shared core with no app prefix. If no, prefix it with the app name.

**Table names that must never exist:** `listvault_properties`, `curb_properties`, `openly_properties`, `trakkt_listings`, `listvault_users`, `pulse_contacts`, `curb_agents`, or any other app-prefixed copy of a shared entity. If you catch yourself writing one, you have made an architectural error. Stop and raise it.

**Listing status is the sharpest case.** It lives in Core on the listing record. Trakkt writes to it, ListVault triggers collections off it, Curb shows or hides pages by it, Openly closes opportunities on it. **No app ever keeps its own copy of listing status.**

---

## 2. Table creation checklist

Every new table must satisfy all of these before the migration is written:

- [ ] Applied the shared-versus-app test above and stated the result out loud.
- [ ] Has an `id` of type `uuid` with a default.
- [ ] Has `created_at` and `updated_at` as `timestamptz`.
- [ ] Has `account_id uuid not null references accounts(id)` plus a denormalized `account_path`, **unless** it is a platform-global table (`users`, `accounts`, `applications`, `platform_staff`, `properties`, plus `brokerages`, `agent_profiles`, `role_permissions`, `platform_theme`, `impersonation_sessions` per D-003 Q1).
- [ ] Has Row Level Security **enabled**, with an explicit policy. A table without RLS is a data breach with a delay.
- [ ] Has an index on `account_id`, a GiST index on `account_path`, and an index on every foreign key.
- [ ] Migration file is numbered, committed, and reversible.

---

## 3. Tenant isolation

This is the security foundation. Treat every line here as load-bearing.

- **`account_id` is the tenant boundary, and the boundary is a subtree, not a single node.** Every tenant-scoped table has `account_id` not null, plus a denormalized `account_path`.
- **RLS is a path-prefix match:** a user may see a row if its `account_path` begins with a path they hold a membership on. This is what makes authority flow downward without recursive queries at read time.
- **Never trust an `account_id` sent from the browser.** Derive it server-side from the authenticated session and the user's memberships. Client-supplied account IDs in a query are a critical bug.
- **RLS is the backstop, not the strategy.** Authorize in the service layer AND enforce in RLS. Both. Always.
- **Service role keys never reach the browser.** They live in server-only environment variables. If a key is in a file under `app/` that is not marked server-only, that is a critical bug.
- **Private property documents** (seller disclosures, CMAs) are protected by storage policies, not by URL obscurity. A signed URL with an expiry, never a public bucket.

---

## 4. Confirmed architectural decisions

These were decided deliberately. Do not relitigate them. If you believe one is wrong, say so once, clearly, and then follow it unless Joseph changes it.

### Properties and listings (REVISED, supersedes any earlier guidance)

**A property is the physical house. A listing is a time-bounded engagement. They are separate tables and they are never conflated.**

- **`properties` is global and deduplicated by `address_hash`.** It is safe to make global because it holds only public-record physical facts: address, parcel/APN, lat/lng, county, subdivision, year built, lot size, property type. Nothing confidential lives here.
- **Never store price, beds, baths, square footage, description, status, or media on `properties`.** Those change between listings. They live on the listing.
- **`listings` is the tenant-isolated record.** It carries `property_id`, `brokerage_id` (the legal owner), `account_id` and `account_path` (the tenant boundary), `controlling_agent_id`, `co_listing_agent_id`, `listing_side`, `mls_number`, `status`, `visibility`, and all the listing-period data.
- **The brokerage owns the listing. The agent controls it. The broker can reassign it.** Reassignment changes `controlling_agent_id` and writes a row to `listing_assignments`. It requires `listing.reassign`, which only exists at brokerage and organization scope. An agent can never reassign their own listing away or claim another agent's.
- **Relisting creates a NEW listing row against the SAME `property_id`.** Never mutate or copy an old listing. Old listings get `terminated_at` set and are never deleted.
- **Every ListVault, Curb, Trakkt, and Openly record references `listing_id`, not `property_id`.** This is the most important rule in this section. Marketing belongs to an engagement, not to a house. Attaching generated assets to a property means a future relisting inherits a competitor's marketing and disclaimers.

### Listing visibility
- Every listing has `visibility`, either `internal` or `public`. **New listings default to `internal`.**
- Marketing generation is allowed while internal. **Publishing is not.** No public URL, no Curb page, no shareable link, no QR destination, no search indexing while internal.
- Every share request re-checks current visibility at request time. Never trust a flag captured at generation time.
- Flipping to `public` requires an explicit action by the controlling agent, or confirmed active status from a connected MLS feed.
- Coming Soon marketing is subject to per-MLS advertising rules. Treat those rules as per-market configuration, never as a hardcoded assumption.

### Accounts are a tree (REVISED, supersedes all earlier role guidance)

**There is no `organizations` table. There is one `accounts` table and it is a tree.**

- `accounts` has `parent_account_id` (self-referencing, nullable), `account_type` (`platform`, `corporate`, `organization`, `brokerage`, `team`, `individual`), and a materialized `path` for ancestry queries.
- **`account_id` is the tenant boundary on every tenant-scoped row**, not `organization_id`. Rows also carry a denormalized `account_path` so RLS is an indexed path-prefix match.
- **Exactly four customer roles**, on `account_memberships`: `owner`, `admin`, `member`, plus an `is_broker_of_record` boolean flag that can accompany any of them.
- **Authority flows downward.** A membership grants authority over that account and every descendant. Level of authority comes from position in the tree, never from a longer role name. Do not invent role names to express seniority.
- Capabilities live in `role_permissions` as flat permission strings scoped by `account_type`. **Adding a capability means inserting a row, not inventing a role.**
- ListApps employees live in **`platform_staff`** with `staff_role` of `owner`, `superadmin`, `sales`, `sales_admin`, or `support`. Never mix staff access into customer roles. `sales` must not be able to read customer contacts or listing content.
- The UI exposes only `brokerage`, `team`, and `individual` for now. `corporate` and `organization` exist in the schema and are created by ListApps staff only. **Do not build corporate self-serve signup or a corporate dashboard.**
- Template element locking has exactly **two** states, `locked` and `unlocked`, plus an optional `locked_fields` text array. Not six states.

### Assume identity (impersonation)
- **Only `platform_staff` may ever impersonate. No customer role at any level of the tree may impersonate anyone, including corporate and organization owners.** A brokerage owner has authority over data through the tree; they never get to become a person. Allowing it would destroy the data-ownership promise this product is built on.
- Read-only by default. Write actions require a separate elevated permission and a stated reason. `sales` is read-only, always.
- A persistent, unmissable banner is displayed for the entire session. It cannot be dismissed.
- Every session is logged in `impersonation_sessions`: who, whom, started, ended, reason, and every action taken.
- **Never permitted even for the owner:** exporting contacts, changing a password or email, changing billing, deleting anything.
- **The impersonated user is emailed afterward** with who accessed their account and when. This is not optional.

### Entitlements and billing
- `subscriptions` rows attach to an `account_id` and an `application_id`, with `plan`, `status`, `trial_ends_at`, `includes_descendants`, `seat_limit`, `seats_used`.
- **Access resolves if EITHER** the user's own `individual` account has an active subscription, **OR** any ancestor account has an active subscription with `includes_descendants = true` and available seats.
- That single rule covers brokerage-wide purchases, office-only purchases, individual agent purchases, and an agent adding an app their brokerage did not buy. Do not add special cases.
- **When a subscription lapses, data is never deleted.** It goes read-only and stays exportable. An agent never loses their work because someone above them stopped paying.

### Theming
- `platform_theme` is a single owner-controlled row. `account_theme` allows optional overrides at any node.
- Resolution walks up the tree to the nearest ancestor with a value set, the same pattern as permissions, entitlements, and brand kits. **Build that tree-walk resolver once and reuse it.**
- Every color, font, and radius is a design token. No hardcoded values in components. This is what makes white-label possible later without a rewrite.

### Disclaimers: DEFERRED, with one required piece of insurance
- **Do not build the disclaimer inheritance system.** It is out of scope until Joseph says otherwise.
- **But do build these three things now**, because retrofitting them means redesigning every template:
  - A `required_disclaimer_text` field on `brand_kits`.
  - `{{disclaimer.required_text}}` as a real template variable resolving to that field, present in every template from the first one designed.
  - A snapshot of the disclaimer text used, stored on every generated asset.
- When the full system is built later, only the resolver function changes and every existing template picks it up automatically.

### Property status
- `back_on_market` is a real status value, because marketing collections trigger off it.
- It auto-transitions to `active` after 14 days, configurable, recorded in `property_status_history`.

### Agent identity is split across two tables
- **`agent_profiles` belongs to the person and follows them forever:** legal and display name, `license_number`, `license_state`, `mls_agent_id`, personal mobile, personal email, headshot, personal bio, designations, personal website and socials.
- **`organization_agent_settings` belongs to the organization and stays:** the display name format that org mandates, org-issued email and direct line, office and branch, team title, org-mandated bio copy, org-supplied headshot.
- **Template variable resolution checks `organization_agent_settings` first, then falls back to `agent_profiles`.** One resolver function, used everywhere.
- Capture `mls_agent_id`, `license_number`, and `license_state` from the very first migration even though nothing consumes them yet. They unlock MLS feed lookup later at zero cost today.

### Offboarding is a workflow, never a silent cascade
- Removing a membership revokes access **immediately**. That part is instant because it is a security action.
- The system then generates an **offboarding inventory**: listings controlled, media, documents, generated assets, contacts owned, Curb pages, open Openly claims.
- Everything defaults to **the next authority above**: agent on a team goes to the team lead, agent reporting to the organization goes to the organization owner.
- The receiving authority gets a task list and can reassign each item or accept the defaults.
- Every transfer writes a row to `ownership_transfers`: item, from, to, actor, timestamp, reason.
- **Nothing is ever deleted.** Membership status becomes `removed`. History stays intact.
- Team departure runs the same workflow one level up, governed by `accounts.data_portability_policy`.

### Contacts belong to the agent, permanently (REVISED)

Joseph's words: *"We don't want agents worried about us taking their data or retracting it if they leave. They work too hard for that."* Treat that as a product guarantee, not a preference.

- Every contact has `owner_user_id`, always set, and `acquisition_class`: `agent_imported`, `agent_generated`, or `org_generated`.
- **On departure the agent keeps every contact they own. Always. Not configurable. No exception, no override, not even by a platform owner.**
- **Both parties can keep a copy.** This is the design that avoids ever adjudicating a dispute: the agent's copy is guaranteed and untouchable, and whether the *account* also retains a copy of `org_generated` leads is governed by `accounts.contact_retention_policy`, disclosed in the UI when the agent accepts their invitation. Nobody loses data, so there is nothing to fight over and ListApps never has to take a side.
- Departure always produces a full export for the agent, in a standard format, without anyone's approval.
- **No deletion path exists that removes an agent's own contacts from them.** If you find yourself writing one, stop.
- Core `contacts` is shaped for Pulse (the CRM app) to build on later. Core owns the contact record; Pulse owns the workflow around it. Do not build pipelines, stages, or campaigns in Core.

---

## 5. Rendering pipeline

- **One design source per template**, authored as a React component with a declared variable contract.
- **Social output:** React component → Satori → SVG → resvg-js → PNG at exact pixel dimensions.
- **Print output:** the same component rendered at 3x → PNG → embedded in a PDF via pdf-lib at correct physical dimensions.
- RGB only. **CMYK is out of scope.** Do not build it and do not let the UI imply it.
- **Collection generation is always a background job.** Write to `generation_jobs`, process assets one at a time, report real progress, retry individual failures without redoing the package. Never generate a collection inside a request handler.
- **Rendering workers are a separate deployment from the web app.** The web app runs on Vercel. Workers run on a container host (Railway, Render, or Fly.io) and pull from `generation_jobs`. Scaling means adding workers, not rewriting anything. Never do CPU-heavy rendering inside a serverless function.
- Do not store generated assets indefinitely. Store the recipe and regenerate on demand, caching output for 30 days.

---

## 6. Media handling

- Convert HEIC to JPEG **in the browser** before upload. iPhone is the primary camera.
- Downscale client-side before upload. Agents upload over cell service from driveways.
- Uploads are chunked and resumable. A dropped connection must not restart a 40-photo batch.
- **Strip EXIF from anything that becomes public.** EXIF carries GPS coordinates.
- Generate thumbnail, web, and print derivatives on upload. Store one sensible source resolution, not the 12 MB original.
- **v1 accepts no video uploads.** YouTube and Vimeo links only.

---

## 7. AI content generation

This carries real legal exposure. Treat these as hard requirements, not suggestions.

- Every generation call includes a **fair housing system prompt** with an explicit prohibited-language list. Steering language, protected-class references, and school-quality or neighborhood-safety claims are prohibited.
- Every output passes a **post-generation term scan** that **flags for the agent** rather than silently editing.
- AI output is **always a draft in an editor**. Make it structurally impossible to auto-publish.
- Log every generation: prompt, output, model, timestamp, user, organization.
- Enforce per-organization usage limits. AI cost is a real line item.

---

## 8. Lead capture and consent

- Every lead record stores: the **verbatim consent text shown**, its version, a timestamp, the IP address, and the source URL.
- SMS consent is a **separate, unchecked-by-default checkbox**, distinct from form submission.
- Consent status flows to Follow Up Boss so the CRM knows whether texting is permitted.
- Public forms are rate-limited. So are profile views and QR redirects.

---

## 9. Getting listing data in: the four tiers

**Tier 0, build now, and it is the only tier approved.** Manual entry plus AI extraction from documents the agent already legitimately holds: their own MLS listing sheet PDF, their own listing URL, a photo of an MLS printout, a flyer, even a text message. Fully compliant because the agent supplies their own data about their own listing. Mark every AI-populated field so the agent knows what to verify. Milestone 2.

**Listing entry is draft-first and autosaving. This is a requirement, not a nicety.**
- **There is no Create button and no Save button.** The moment an agent types an address, a listing row exists in `draft` status.
- Autosave every field change, debounced. Offline-tolerant with local caching and sync on reconnect. Agents lose signal constantly.
- Only three fields are ever required to create a listing: address, listing side, status. Everything else is optional and fillable later.
- Progressive steps, never one wall of forty fields.
- **Completeness is expressed as a list of what is missing and what it blocks**, not a percentage bar. Two thresholds: "ready to generate marketing" and "ready to publish."
- Support `waiting_on` flags: photos, seller disclosure, price decision, signed listing agreement. Group the dashboard by them.
- Draft listings are always `internal`. Marketing generation is allowed on a draft. Publishing is not.

**Tier 1, around Milestone 4.** Public-record property enrichment by address (ATTOM, Estated, Regrid, or similar). **Public record, not MLS**, so no MLS approval and no IDX restrictions. Populates the `properties` layer. Costs per lookup.

**Tier 2, when a customer asks.** Own-brokerage website import (AgentFire, Lofty). Rules, unchanged and non-negotiable:
- Import **only** listings where the customer's own organization is the listing brokerage. Never third-party listings, under any framing, for any reason.
- Require stored, timestamped written authorization from the organization owner before enabling an adapter.
- Respect robots.txt. Enforce the 15-minute manual cooldown and the daily automatic limit.
- Prefer a vendor API or export over scraping wherever one exists.

**Tier 3, only when revenue justifies it.** Licensed MLS feed through an aggregator (MLS Grid, Bridge Interactive, Trestle, SimplyRETS, Spark), never direct MLS-by-MLS integration. RESO Web API supports querying by `ListAgentMlsId`, which is what makes "show me all my listings" work. Requires per-MLS approval and per-MLS fees.

**Do not build Tier 1, 2, or 3 without explicit instruction from Joseph.** Tier 0 only for now.

---

## 10. Code conventions

- **TypeScript strict mode.** No `any` without a comment explaining why.
- **Service layer, not scattered queries.** Database access lives in `lib/services/`. Components call services. Components do not call the database directly. This is section 73 of the spec and it is what makes a future mobile app and public API possible.
- **Route structure:** `app/(platform)/` for the shell and settings, `app/(apps)/listvault/`, `app/(apps)/openly/`, `app/(apps)/curb/`, and so on. One codebase, one deploy.
- **Server-side authorization on every mutation.** Client-side checks are UI convenience only and are never the security boundary.
- **Mobile-first CSS.** Design the phone layout first, then widen. Every major workflow must work with one thumb.
- **Audit sensitive actions** into `audit_logs`: role changes, membership removal, integration changes, brokerage changes, disclaimer changes, template locks, subscription changes.

---

## 11. Environments

- `listapps-development` and `listapps-production` are separate Supabase projects. They never touch.
- All schema changes are applied to development first and verified before production.
- Never run a destructive operation against production without an approved written plan and a verified backup.

---

## 12. Current milestone

> **Milestone 1: Who You Are.**
>
> Seventeen tables: `users`, `accounts`, `account_memberships`, `platform_staff`, `role_permissions`, `impersonation_sessions`, `agent_profiles`, `organization_agent_settings`, `brokerages`, `brand_kits`, `platform_theme`, `account_theme`, `applications`, `subscriptions`, `ownership_transfers`, `audit_logs`, `events`. Plus authentication, invitations, the app shell, and the app switcher.
>
> **Done when** all of the following are verified by hand:
> - Create a `brokerage` account (KW Metro South) with a `team` account (The Daley Group) beneath it.
> - Invite one person as team `admin` and one as team `member`; both accept by email and log in.
> - Give the brokerage a ListVault subscription with `includes_descendants = true` and confirm it flows down to both.
> - Have the team member separately subscribe to Curb on their own `individual` account and confirm both apps resolve.
> - Create a second test brokerage and confirm neither user can see any of its data. Actually try it.
> - Impersonate the team member from a support account: banner visible, session logged, notification email sent.
> - Remove a membership and confirm the offboarding workflow runs with a logged transfer rather than a silent delete.

Also in Milestone 1: **"Sign in with Google"** (basic scope, free, easy).

**Not in this milestone:** properties, listings, templates, generation, and every app. Also not: disclaimer inheritance, custom domains, corporate self-serve signup, Gmail scopes, any MLS tier above 0. Do not build them.

**Milestone 2 preview (lightweight listings, only what Openly needs):** `properties` (global), `listings` (brokerage-owned, draft-first, autosaving), `listing_assignments`, `listing_status_history`, basic `listing_media`. **Stop there.** The full media pipeline, attributes, documents, and AI extraction are Milestone 4, after Openly ships.

**Milestone 3 is Openly core**, because it has a proven price point and warm prospects and it funds everything downstream. **v1 is coordination only. It never touches compensation.**

**Milestones 4 and 5 are the Openly differentiators, and they are deliberately narrow slices of ListVault and Curb.** There is an incumbent already charging for open house coordination, so a bare clone will not displace them. `docs/08-Openly-Differentiation-and-the-ListVault-Slice.md` is authoritative on exactly what is in and out.

**Milestone 4, the ListVault slice.** In: the Satori/resvg rendering pipeline, the generation queue, brand kit wiring, and six to eight open house templates. **Out: the editor, template collections, bulk package generation, AI content, feature forms, and every non-open-house template.**

- **The variable resolver MUST resolve FOUR objects from the first line of code:** `{{listing_agent.*}}`, `{{listing_brokerage.*}}`, `{{hosting_agent.*}}`, `{{hosting_brokerage.*}}`. Plus collapse modes for same-agent and same-brokerage so a listing agent hosting their own open house does not get their face printed twice. Building this narrower means redesigning every template later.
- **Every template layout also gets an optional team/agent logo slot from the first design.** The field goes on team and individual brand kits now. The feature ships later. Adding a field is trivial; redesigning finished templates is not. Same lesson as the disclaimer slot.
- **Compliance rule, build it into the template structure, not into individual designs:** listing brokerage branding and disclosure text are **required and locked** and the hosting agent cannot remove or replace them. The hosting agent appears only in a clearly labeled "Hosted by" position with their own name, headshot, and contact, and their brokerage is named alongside them when it differs from the listing brokerage. A hosting agent must never be able to present another brokerage's listing as their own.
- **`hosting_brokerage_id` is snapshotted onto the claim record at the moment of claiming**, never resolved live. If the agent changes brokerages later, historical graphics must still show what was true at the time.

**AI content generation for templates is prohibited.** Joseph's explicit instruction. Do not build it, do not propose it, do not add a "just a draft" version of it. This is separate from AI *extraction* from listing sheets, which is a different feature and is also not in the demo scope.

**Print scope is drawn precisely:** letter size 8.5x11, RGB, no bleed, printed on an office printer. That covers the branded sign-in sheet, table flyer, and simple directional sign. **Out of scope:** bleed, trim marks, CMYK, postcards, door hangers, sign riders, and anything with a commercial print vendor's specifications. **Put the QR code on the paper sign-in sheet itself** so one artifact serves both tech-comfortable and non-techy users.

**Milestone 5, open house sign-in.** A QR code on the sign-in card and directional sign leading to one mobile page with one form. Visitor record, lead record, routing, and lead-production reporting. **This is a slice of Curb built early, not throwaway work: same form engine, same visitor record.**

- **Lead routing default: the hosting agent gets the lead.** The listing agent gets visibility into sign-in counts because it is their seller's house. The office can override the default.
- All lead-capture consent rules in section 8 apply unchanged.

**The scope test from Milestone 3 through launch:** does an agent who just claimed an open house need this to run that open house well? If yes, it is in. If it serves any other moment in the business, it waits.

## 12b. App portfolio and build order

Seven apps sit on Core, three with sub-modules. Each has one job and a list of things it is forbidden to do. **`docs/05-Application-Portfolio.md` is authoritative on the boundaries. Read it before adding any feature to any app.**

- **Openly** posts and claims coverage opportunities. Nothing else. Claims must be atomic at the database level.
- **ListVault** makes digital and print marketing. It never publishes, never captures leads.
- **Curb** (formerly Linked) publishes listing link hubs **generated from the listing record, not built by hand**, and captures leads. It never creates marketing assets, never manages a relationship after capture.
- **Pulse** is the CRM and is **free with every account**, with a contact cap on the free tier. It never creates marketing, never hosts public pages, never sends bulk messages.
- **Reach** is Pulse's paid add-on for database marketing: drips, email, texting, Gmail sync.
- **Trakkt** is **transaction management** (contract to close) plus production accountability. It is NOT the analytics app.
- **Ops** is the operations panel for admins, containing **Stash** (inventory) and a budgeting/cost module. Rule: Ops holds tools for running the business, never for doing the deal.
- **Atlas** is the learning library. Video is hosted on an external video platform, never in Supabase Storage.

**Where analytics live:** production and transaction analytics in Trakkt; marketing and lead analytics in the app that generated them; business and cost analytics in Ops; cross-app roll-up is a Core capability surfaced inside Ops. **There is no separate analytics app.**

**Listing status lives in Core on the listing record. One status, one place, every app reads and reacts to it.** Trakkt writes to it, ListVault triggers collections off it, Curb shows or hides pages by it, Openly closes opportunities on it. Never let an app keep its own copy of listing status.

**Build order (revised, revenue-first):**
1. Core foundation
2. Core listings, lightweight (enough for Openly)
3. **Openly**: first revenue, proven price, warm prospects
4. Core listings, full (media pipeline, AI extraction, draft autosave)
5. ListVault
6. Curb
7. Pulse
8. Trakkt
9. Reach (email first, texting second, Gmail sync last)
10. Ops and Stash
11. Atlas

**Google integration, two very different things. Do not conflate them:**
- **"Sign in with Google" is a basic scope.** Free, easy, **build it in Milestone 1.**
- **Reading or sending Gmail requires restricted scopes**, which require a CASA security assessment through the App Defense Alliance, repeated at least every 12 months, at real recurring cost. **Out of scope until Joseph funds it.** It is the last piece of Reach.
- **YouTube channel read (`youtube.readonly`) is a sensitive scope, not restricted.** Light verification, no assessment. Build the "pick your feature video from a dropdown" feature with listing intake in Milestone 4.

**Follow Up Boss integration is a pluggable CRM adapter**, one-way push of leads outbound for v1. Never hardcode Follow Up Boss logic anywhere.

*Update this section as milestones complete. It is the single most important part of this file for keeping scope honest.*

---

## 13. Communication with Joseph

- Address him as **Joseph**.
- **No em dashes.** Anywhere.
- Instructions and lists in **bulleted or checklist format**.
- Explain technical tradeoffs in **business terms** first, technical terms second.
- When you find a problem, state the problem, the consequence, and your recommended fix. Do not just report the problem.
- If you are about to do something with a business consequence he has not approved, stop and ask. Every time.
