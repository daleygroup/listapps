# The ListApps Application Portfolio
## Revision B, August 20, 2026 — incorporating Ops, Stash, Reach, Curb, Atlas, and the Openly revenue picture

*This supersedes Revision A entirely. Revision A had five apps and the wrong build order.*

---

## The Headline: Openly Should Be Built First, Not Fifth

Everything else in this document matters less than this section, so it goes first.

You told me Openly costs around $1,100 a month for all 1,200 agents in Birmingham to access, and that your operating partner has roughly fifteen other multi-office owners you could sell to nearly overnight.

**That is the single most important business fact in this entire conversation, and it changes the plan.**

Here is why, laid out plainly:

- **The price is already proven.** You are not guessing what a brokerage will pay. Somebody is already collecting it, every month, in your own market.
- **The demand is already warm.** Fifteen qualified prospects through a partner who can make the introduction is not a pipeline you have to build, it is a pipeline you already have.
- **It is the smallest build in the portfolio by a wide margin.** Opportunities, claims, a calendar, notifications, and reporting. No template engine, no rendering pipeline, no brand kits, no media processing, no AI, no compliance-heavy messaging. It needs Core and a lightweight listing record. That is it.
- **The buyer is an office, not an agent.** One signature covers 1,200 seats. Compare that to signing up 1,200 individual agents for ListVault one at a time.
- **It funds everything else.** Fifteen offices at that price point is meaningful recurring revenue, and it is exactly what pays for the RESO Web API you said you cannot afford right now, plus the design work ListVault needs, plus the Google security assessment Reach will eventually require.

**And the part that matters most: Openly is a door-opener.** Every office that buys it becomes a warm prospect for the entire suite. You walk in selling one small thing they already pay for, and eighteen months later you are the platform their whole brokerage runs on. That is a far better motion than trying to sell an eight-app platform to a brokerage that has never heard of you.

I know ListVault is the one you have been building and thinking about longest. I am not telling you it matters less. I am telling you that Openly buys you the runway to build ListVault properly instead of rushing it, and that founders rarely get handed a proven price with warm prospects attached.

**Three things I need to know before this becomes the plan:**

- **Is $1,100 what the incumbent charges, or what you would charge?** One is your ceiling, the other is your floor.
- **Who signs the check?** A brokerage, an association, or a group of offices? "All 1,200 agents in Birmingham" sounds broader than a single office and that changes both the product and the contract.
- **What is the incumbent?** Knowing what they use today tells us exactly what to beat and what to leave alone.

### The legal question just became urgent

I raised this before as a theoretical concern. If Openly spans 1,200 agents across an entire market, it is no longer theoretical.

Cross-brokerage open house coverage means an agent from Brokerage A sitting in Brokerage B's listing. That touches supervision duties for the listing broker, state license rules about who may perform licensed activity on whose behalf, and compensation rules if money ever changes hands.

**The reassuring part:** this already happens in Birmingham with 1,200 agents on an existing tool, so the practice is established in your market. **The part to be careful about:** what is accepted in Alabama may not be in Texas or California, and you want to sell nationally. Before the first out-of-state sale, this needs a real answer from an attorney, and the product needs per-market configuration for who may claim what.

My recommendation stands: **coordination only, no money, in v1.** That keeps the legal footprint small while you prove the market.

---

## The Full Portfolio

**ListApps.co** is the family. **Core** is the shared foundation and is not an app. Seven applications sit on top, three of them with sub-modules.

| App | One-sentence job | Who buys it |
|---|---|---|
| **Openly** | Post and claim open house and coverage opportunities | Offices and brokerages |
| **ListVault** | Turn a listing into finished digital and print marketing | Every agent |
| **Curb** | Give every listing a link hub that builds itself | Every agent |
| **Pulse** | The CRM. **Free with every account.** | Nobody, it is the hook |
| ↳ **Reach** | Database marketing: drips, email, texting, Gmail sync | Agents and teams, paid add-on |
| **Trakkt** | Transaction management start to finish, plus production accountability | Teams and brokerages |
| **Ops** | The operations panel for teams and admins | Teams and brokerages |
| ↳ **Stash** | Inventory: signs, lockboxes, supplies | Teams and brokerages |
| ↳ *(unnamed)* | Budgeting and costs, tied to listings | Teams and brokerages |
| **Atlas** | Online learning library for new agents and coaching clients | Brokerages and coaches |

---

## Openly

**Job:** Match agents who need coverage with agents who want the opportunity.

**Owns:** `opportunities`, `opportunity_claims`, `eligibility_rules`, `coverage_settings`, `opportunity_feedback`

**Borrows from Core:** listings (lightweight), agent identity, the account tree (which is what defines eligibility), events

**Does not do:** marketing, lead capture, contact management, money

**Hard technical requirement:** claims must be atomic at the database level. Two agents tapping Claim in the same instant resolve to exactly one winner in the database, never in application code.

**What makes it win against the incumbent:** it already knows the listing. The address, the photos, the lockbox notes, the agent's contact information, and the flyer are all there because ListVault and Core put them there. A standalone open house tool is a calendar with addresses typed into it. Yours is connected to the actual listing. That is the pitch.

---

## ListVault

**Job:** Turn a listing into finished, branded, compliant digital and print marketing without the agent designing anything.

**Owns:** `templates`, `template_elements`, `template_collections`, `collection_templates`, `generation_jobs`, `generated_assets`, `listing_feature_forms`, `listing_feature_responses`

**Borrows from Core:** listings, listing media, brand kits, brokerage identity, agent identity, assets

**Does not do:** publishing, public URLs, lead capture. The moment marketing needs a public address, that is Curb.

**The differentiator remains collection generation.** One button, twelve finished assets.

---

## Curb

*Formerly called Linked. The rename is an improvement and I would keep it.*

**Job:** Give every listing a link hub that creates and updates itself from the listing record.

**The key insight in your description:** Curb pages are **generated from the listing intake, not built by hand.** The agent does not create a page. They create a listing, and the page already exists. That is a much better product than a link-in-bio tool where you drag links around.

**Owns:** `curb_pages`, `link_sections`, `links`, `page_listings` (cross-listing), `intake_forms`, `intake_form_fields`, `intake_form_responses`, `visitors`, QR definitions and redirect tracking

**Borrows from Core:** listings and media, agent identity, brand kits

**Produces into Core:** contacts and a very large volume of events

**Does not do:** marketing asset creation (it renders through ListVault's engine), or relationship management after capture (that is Pulse)

**Open question I need you to answer:** does Curb also cover **agent and team profiles**, or is it listing-only? Your description was listing-focused, but agents will absolutely want a personal link hub too, and the original Linked concept had agent profiles, team profiles, and required links pushed down from the team. Those are different enough that they might be two things. Tell me which you want.

**Hard rule that carries over:** Curb can only publish a listing whose `visibility` is `public`. A draft or internal listing has no public surface.

### The YouTube feature you mentioned

This is a good, cheap feature and it belongs on the listing intake form, not in Curb specifically.

- The agent connects their YouTube channel once, at the account level.
- On any listing, a dropdown shows their recent uploads and they pick the feature video without leaving ListApps.
- Technically this uses YouTube's read-only scope, which is a **sensitive** scope, not a restricted one. That means a lighter verification process, no security assessment, and no meaningful cost.

**Build it with the listing intake in Milestone 2.**

---

## Pulse, and the free-CRM decision

**Job:** The CRM. Contacts, pipelines, stages, tasks, notes, activity history, lead routing.

**Owns:** `contact_pipelines`, `pipeline_stages`, `contact_stage_history`, `activities`, `tasks`, `notes`, `communications` (logged), `lead_routing_rules`

**Borrows from Core:** contacts (Core owns the record, Pulse owns the workflow), agent identity, listings, events

### Making Pulse free is a strong move, with two consequences

**Why it is smart:** a free CRM means every single account has their database in your system. That is the stickiest thing in the entire portfolio. An agent will switch marketing tools. They will not switch their database. Once their sphere lives in Pulse, everything else in ListApps has a permanent home.

**Consequence one: it costs money to give away.** Every free account consumes storage and compute with zero direct revenue. That is the standard playbook and it works, but it needs a guardrail. **My recommendation: a contact cap on free Pulse**, somewhere around 2,500 contacts. Generous enough that a normal agent never hits it, and it becomes the natural upgrade conversation for the ones who do. Set it from day one. Adding a cap later to people who already exceeded it is a fight.

**Consequence two: Reach has to convert.** If Pulse is free, Reach is where CRM revenue comes from. That makes Reach more important than it looks, and it is also the hardest thing in the portfolio to build. See below.

**On matching Follow Up Boss feature for feature:** you said everything except the dialer for now, and dropping the dialer is the right call. It is the single most expensive piece and it carries call recording consent laws that vary by state. What is left is still substantial: pipelines, smart lists, action plans, lead routing and ponds, mobile apps, and lead source parsing from dozens of portals. Reachable, but it is a real build and it should come after the apps that generate revenue.

---

## Reach

**Job:** Database marketing. Drip campaigns, email, texting, two-way Gmail sync.

**This is the heaviest compliance build in the entire portfolio and I want you to see the whole bill before you commit to it.**

### Texting

- TCPA consent requirements, with statutory damages per message
- **A2P 10DLC registration** with the carriers: brand registration, campaign registration, per-campaign fees, and carrier vetting before a single message sends
- Opt-out handling, suppression lists, quiet hours by time zone

### Email

- CAN-SPAM compliance
- Domain reputation, warm-up, SPF, DKIM, DMARC per sending domain
- Bounce and complaint handling, because one careless customer can damage deliverability for everyone

### Two-way Gmail sync, and this one has a specific price tag

Reading and sending a user's Gmail requires **restricted** OAuth scopes. Google's own documentation is explicit: every app requesting restricted data that can access it through a third-party server must complete a **CASA security assessment** through the App Defense Alliance, and **must be re-verified and re-assessed at least every twelve months.**

Google does not publish what that costs. Third-party assessors do, and reported figures range from a few thousand dollars for a lighter tier up to substantially more for a full assessment. **Budget it as a recurring annual cost, not a one-time fee.**

**Important distinction you should hold onto:** "Sign in with Google" is completely different. That is a basic scope, it is free, it is easy, and **it should go into Milestone 1.** It is only reading and sending mail that triggers the assessment. Do not let one block the other.

**My recommendation:** Reach is late in the order, and Gmail sync is the last piece of Reach. Start Reach with email campaigns on your own sending infrastructure, which has no Google gate at all. Add texting when there is revenue to fund the registration work. Add Gmail sync when there is revenue to fund an annual assessment.

---

## Trakkt

**Job:** Transaction management from contract to close, plus the production accountability layer.

*Naming is settled: the inventory product formerly called Trakkt is renamed **Stash** and lives inside Ops. **Trakkt** is transaction management. Because Trakkt is no longer the analytics app, cross-app analytics needs a new home. See the analytics note below.*

**Owns:** `transactions`, `transaction_stages`, `transaction_tasks`, `task_templates`, `checklists`, `documents`, `commissions`, `production_goals`, `scorecards`

**Borrows from Core:** listings, contacts, agent identity, events

**The competitive target you named is Sisu**, which does transaction tracking, production dashboards, leaderboards, goal setting, and team accountability, and is well established with real customers.

**Your structural advantage over Sisu is real:** Sisu has to import or have data typed into it. Trakkt already has the listing, because the listing was created in ListApps months earlier when the agent made marketing for it. The transaction does not start from a blank form, it starts from a record that already exists with the address, the price, the agent, the photos, and the marketing history attached.

**On "statuses synced across the entire platform," which you called out specifically:** this is exactly right and it is an architectural requirement, not a Trakkt feature. Listing status lives in Core on the listing record. Trakkt reads it and writes to it. ListVault triggers marketing collections off it. Curb shows or hides the page based on it. Openly closes opportunities when it changes. **One status, one place, every app reacting.** That is the whole thesis of the platform in a single field, and it is worth protecting fiercely.

---

## Ops, and Stash

**Job:** The operations panel for teams and admins. The place a director of operations lives all day.

**Ops is a container, and that is a legitimate pattern**, but it needs a clear rule or it becomes the junk drawer where every feature that does not fit anywhere else goes to die. The rule I would use:

> **Ops holds tools for running the business, not for doing the deal.** If an agent uses it to serve a client, it belongs in another app. If an admin uses it to keep the operation running, it belongs in Ops.

**Stash** — inventory: signs, riders, lockboxes, supplies, marketing collateral. Who has what, what is out, what needs reordering. Checkouts tie to listings, which is the connected-data advantage again.

**The budgeting and cost tool** — costs associated with listings and transactions. Photography, staging, print, signage, advertising spend. Roll up per listing, per agent, per period. Combined with commission data from Trakkt, this becomes real profitability reporting, which is something almost nothing in this industry does well.

**It needs a name.** A few that fit the family: **Ledger**, **Basis**, **Tally**, **Margin**, or **Split**. I like **Split** because commission splits are the language agents already speak, though it might read as narrower than it is. **Margin** is my second choice because profitability is the actual point.

### Where analytics went

With Trakkt becoming transaction management, cross-app analytics has no home. My recommendation:

- **Production and transaction analytics live in Trakkt.** GCI, units, pipeline, leaderboards, goals. This is the Sisu comparison and it belongs there.
- **Marketing and lead analytics live in the app that generated them.** Curb shows page and link performance. ListVault shows what got generated. Pulse shows conversion.
- **Business analytics live in Ops.** Costs, inventory, profitability.
- **Cross-app roll-up is a Core capability surfaced inside Ops**, not a separate product. You do not need an eighth app to look at seven apps.

---

## Atlas

**Job:** The online learning library. Replaces PCX for onboarding new agents and running coaching clients.

**Owns:** `courses`, `modules`, `lessons`, `enrollments`, `progress`, `quizzes`, `certificates`, `cohorts`

**Borrows from Core:** agent identity, the account tree (which determines who is assigned what training), events

**Two things to know before building it:**

- **Video hosting is a real cost line and you should not self-host it.** Use a video platform. Cloudflare Stream, Mux, or Bunny are the cost-effective options; unlisted YouTube works for a v1 if you can live with the branding. Storing and streaming course video from Supabase Storage would be both expensive and a poor experience.
- **Atlas is the most independent app in the portfolio.** It borrows identity and the account tree and almost nothing else. That is worth knowing because it means Atlas could be built out of order without hurting anything, and it also means it gains the least from the shared architecture. If someone ever offers to sell you a decent white-label LMS cheaply, that is a legitimate trade.

---

## The Boundary Table

When there is an argument about where a feature goes, this settles it.

| Capability | Home | Never in |
|---|---|---|
| Design and render a graphic, flyer, or print piece | ListVault | Curb, Pulse |
| Host a public page | Curb | ListVault |
| Capture a lead form submission | Curb | ListVault, Pulse |
| Work a lead through stages | Pulse | Curb |
| Send bulk email or text to a database | **Reach** | Pulse, Curb |
| Log a call, text, or email that happened | Pulse | Reach |
| Manage a deal from contract to close | Trakkt | Pulse |
| Track production, GCI, units, goals | Trakkt | Ops |
| Post or claim a coverage opportunity | Openly | Everywhere else |
| Track physical inventory | Stash | Everywhere else |
| Track spend and profitability | Ops | Trakkt |
| Deliver training content | Atlas | Everywhere else |
| Store a contact, listing, property, or brand kit | **Core** | Every app reads it |
| Own listing status | **Core** | Every app reads and reacts |

---

## Scope Reality, Told Straight

You now have seven applications and three sub-modules. I am not going to pretend that is a three-month build, and you would not believe me if I did.

**Built honestly, this is a multi-year platform.** Companies with funded engineering teams take years to ship this much surface area. That is the truth and you should plan around it.

**Here is why it is still achievable, and it is not a pep talk.**

**Each app costs less than the one before it.** That is not optimism, it is a property of the architecture you insisted on from the beginning:

- **Openly** needs Core plus a lightweight listing. Call that the full price.
- **ListVault** adds templates and the rendering pipeline. It reuses accounts, listings, media, and identity.
- **Curb** reuses listings, media, rendering, and identity. It adds pages and forms. Meaningfully cheaper than ListVault.
- **Pulse** reuses contacts and events, both of which Curb already filled with data.
- **Trakkt** reuses listings, contacts, tasks, and events. Most of what it needs already exists.
- **Ops and Stash** reuse essentially everything.
- **Atlas** is the outlier and the most independent.

App seven is a fraction of the cost of app one. That descending curve is the entire payoff of the shared core, and it is why the discipline in the early milestones matters so much.

**The real risk is not ambition. It is building three apps to 70 percent instead of one to 100 percent.** A brokerage will happily buy one thing that works perfectly. Nobody buys seven things that almost work. Finish Openly completely before ListVault starts. Finish ListVault completely before Curb starts.

**And the bundle is the actual product.** Your goal of selling the whole package to a brokerage to bring every area of value to their agents is exactly right, and it is achievable precisely because it is one sale, one login, one database. A brokerage evaluating eight separate vendors is doing eight evaluations. A brokerage evaluating ListApps is doing one.

---

## Revised Build Order

1. **Core foundation.** Accounts tree, identity, entitlements, the shell, Google sign-in.
2. **Core listings, lightweight.** Enough for Openly: property, listing, address, agent, status, a few photos.
3. **Openly.** First revenue. Fifteen warm prospects.
4. **Core listings, full.** Media pipeline, attributes, documents, AI extraction, draft autosave.
5. **ListVault.** The volume product.
6. **Curb.** Publishing, lead capture, and the start of the event stream.
7. **Pulse.** Free CRM. Now there is event data to make it worth having.
8. **Trakkt.** Transaction management and production accountability.
9. **Reach.** Email first, then texting, then Gmail sync last.
10. **Ops and Stash.**
11. **Atlas.**

**The one change from your instinct:** Openly moved to the front. Everything else follows the logic you laid out.

---

## Open Questions

- **Openly:** is $1,100 the incumbent's price or yours? Who signs, an office or an association? What is the incumbent?
- **Curb:** listing pages only, or agent and team profiles too?
- **Ops budgeting tool:** does one of Ledger, Basis, Tally, Margin, or Split work, or do you have a name?
- **Echo:** still unanswered. My recommendation is it becomes Pulse's sync layer rather than an app.
- **Print quality:** good PDF an agent can print or upload to a vendor, or commercial press files?
- **Video in v1:** YouTube and Vimeo links only, or real uploads?
- **Beta cohort:** how many agents outside your team, and roughly when?

---

**Sources:**

- [Google restricted scope verification and CASA requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [Sisu product and pricing overview](https://www.softwareadvice.com/real-estate-transaction-manage/sisu-suite-profile/)
