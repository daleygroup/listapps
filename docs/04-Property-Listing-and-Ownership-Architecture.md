# Property, Listing, and Ownership Architecture
## Revision A: incorporating Joseph's answers of August 20, 2026

---

## What You Just Changed, And Why It Is Better

You solved the contradiction I flagged, and you solved it better than I did.

I was arguing about whether a property belongs to an organization. You pointed out that I was asking the wrong question, because a property and a listing are not the same thing. A house at 1247 Oak Ridge Drive exists for eighty years. It gets listed in 2019 by one agent, expires, gets relisted in 2020 by a different agent at a different brokerage, sells, then comes back in 2027. That is one house and four listings.

And then you added the part that most software gets wrong: **the brokerage owns the listing, the agent controls it, and the broker can reassign it.** That is how real estate actually works legally, and almost no agent-facing software models it correctly. Building it in from the first migration is a real advantage when you sit down with a broker of record, because you will be the only vendor in the room who understands that the listing is the brokerage's asset.

Here is the revised architecture.

---

## 1. Three Layers, Not One

### Layer 1: `properties` (the physical house)

Global. Deduplicated by normalized address. Never deleted. Contains only facts that are true about the physical parcel regardless of who is selling it.

- Normalized street address, city, state, ZIP, county, subdivision
- `address_hash` for matching, and the parcel or APN number when we can get it
- Latitude and longitude
- Year built, lot size, acreage
- Property type and subtype

**This layer is safe to make global precisely because nothing confidential lives here.** The address of a house is public record. That was the flaw in my earlier thinking: I was going to scope properties to an organization to protect data that, under this model, is not stored on the property at all.

Note what is **not** here: price, beds, baths, square footage, description, photos, status. All of those can change between listings. Someone finishes a basement and the square footage is different in 2027 than it was in 2019. Those live on the listing.

### Layer 2: `listings` (the engagement, time-bounded)

This is the tenant-isolated, permission-controlled record. One property, many listings over time.

- `property_id` pointing at the physical house
- `brokerage_id`, **the legal owner of the listing**
- `organization_id`, the tenant boundary
- `controlling_agent_id`, the agent who has it, and `co_listing_agent_id`
- `listing_side`, either seller-side or buyer-side
- `mls_number` and `mls_listing_key`
- `status` and `visibility`
- List price, beds, baths, square footage, description, features, schools, HOA
- `listed_at`, `expires_at`, `terminated_at`

### Layer 3: application data (`listvault_projects`, `generated_assets`, Linked pages)

Every one of these hangs off `listing_id`, not `property_id`. Marketing was made for a specific engagement, by a specific agent, under a specific brokerage, with specific disclaimers. When the listing ends, the marketing stays attached to that listing, in history, where it belongs. A new agent listing the same house in 2027 starts clean and does not inherit a competitor's graphics.

---

## 2. Who Owns What

| Thing | Legal owner | Who controls it day to day | Who can reassign |
|---|---|---|---|
| Property record | Nobody, it is a shared fact | System | N/A |
| Listing | Brokerage | Controlling agent | Broker, org owner, org admin |
| Listing media and documents | Brokerage, follows the listing | Controlling agent | Follows the listing |
| Generated marketing | Brokerage, follows the listing | Controlling agent | Follows the listing |
| Agent profile | The person | The person | Nobody |
| Contacts | **The agent who brought them in** | That agent | Per organization policy, see section 7 |

**Reassignment** is a single operation: change `controlling_agent_id`, write a row into `listing_assignments` with who, when, and why. It requires a `listing.reassign` permission that only exists at brokerage and organization scope. An agent cannot reassign their own listing away, and cannot claim someone else's.

This one table, `listing_assignments`, is going to matter more than it looks. Every departure dispute, every "who had this listing in March" question, and eventually every Trakkt report about agent production runs through it.

---

## 3. The Confidentiality Gate

You said listing data stays internal until it is marked active, or active in the MLS. That is right, and it needs to be structural rather than a UI preference, because pre-listing information is genuinely sensitive. A seller who has not told their neighbors they are moving should not have their address discoverable because someone generated a Coming Soon graphic early.

**The rule in the schema:**

- Every listing has `visibility`, either `internal` or `public`.
- New listings default to `internal`. Always.
- Marketing generation is **allowed** while internal, because agents legitimately prepare materials before going live.
- **Publishing** is blocked while internal. That means no Linked property page, no public QR destination, no shareable link, no search indexing. Nothing with a public URL.
- Every generated asset carries the visibility state it was made under, and any share attempt re-checks the current state at request time rather than trusting a flag set at generation.
- Flipping to `public` requires either an explicit action by the controlling agent or a confirmed active status from a connected MLS feed.

**One warning worth having now.** Many MLSs have specific rules about Coming Soon and office-exclusive listings, including how and when a property may be advertised before it hits the MLS. Those rules vary by market and they carry fines. Before you promote Coming Soon marketing as a headline feature, get the Greater Alabama MLS rules in writing and design the Coming Soon collection around them. When you expand to other markets, this becomes a per-market configuration, which is another reason not to hardcode Birmingham.

---

## 4. Relisting, Which You Called Out Correctly

Property gets listed, expires, gets relisted by a new agent at a new brokerage:

- The property row is untouched. Same `property_id`, same address, same parcel.
- Listing #1 gets `terminated_at` set and its status moves to expired or cancelled. It is never deleted.
- Listing #2 is a brand new row, new brokerage, new agent, new price, new photos, new description.
- Agent B can see the property, because address and parcel are public facts. Agent B **cannot** see listing #1, because that row is scoped to a different organization.
- Pulling fresh data from the most recent MLS listing, which you asked for, is exactly right: a new listing always creates a new row and populates it from the newest source, never by copying the old one.

The quiet payoff is that over a few years the property accumulates a real listing history: four listings, three brokerages, days on market each time, twice back on market. That is genuinely valuable data for CMAs and for Trakkt, and you get it for free just from modeling it correctly today.

---

## 5. Getting Listing Data In

You asked about connecting to an MLS, or using AI to find listings by agent MLS ID, property MLS number, or license state and number.

**Straight answer on the AI part:** the feature you described is real and standard, but AI is not the mechanism. An AI agent browsing the web hunting for an agent's listings is the scraping problem wearing a different hat, plus it is slow and unreliable. The real version is a licensed data feed. The RESO Web API standard, which modern MLS feeds use, natively supports exactly the query you want: give me every listing where `ListAgentMlsId` equals this value. Enter your MLS agent ID once, see all your listings. That feature is a config screen on top of a licensed feed, not an AI problem.

**Where AI genuinely helps, and this is a great v1 feature:** extraction from documents the agent already legitimately has. The agent exports their own listing sheet from the MLS as a PDF, or pastes their own listing URL, or photographs an MLS printout. AI reads it and fills in every field. Fully compliant, since the agent is supplying their own data about their own listing. Costs pennies. Removes the single most annoying part of the product, which is typing forty fields into a form on a phone. I would build this in Milestone 2.

**Here is the four-tier path, cheapest first:**

**Tier 0, build now, costs nothing.** Manual entry plus the AI extraction above. Address, MLS number, paste or upload, done. This gets you to market with zero MLS fees, which is your section 83 requirement.

**Tier 1, build around Milestone 4, cheap per lookup.** Public-record property data. Vendors like ATTOM, Estated, and Regrid sell parcel, year built, beds, baths, square footage, tax, and sale history keyed by address. **This is public record data, not MLS data**, so it needs no MLS approval and carries none of the IDX restrictions. It is what makes "type an address and watch the house fill itself in" work before you have a single MLS relationship. This populates the property layer beautifully.

**Tier 2, when a customer asks.** Own-brokerage website import from AgentFire or Lofty, own listings only, with stored written authorization. Already in the plan, unchanged.

**Tier 3, when revenue justifies it.** A licensed MLS feed through an aggregator rather than direct MLS-by-MLS integration. The aggregators to talk to are MLS Grid, Bridge Interactive (Zillow Group), Trestle (CoreLogic), SimplyRETS, and Spark Platform. One integration reaches many MLSs instead of building a new connector per market. You still need per-MLS approval and you still pay per-MLS fees, but you build once.

For Birmingham specifically you will be dealing with Greater Alabama MLS through the Birmingham Association of REALTORS. None of these vendors publish pricing or coverage publicly, so at the point you are ready, the move is a direct conversation with each about GALMLS coverage and cost. Do not plan a budget around a number you found on a blog.

**One thing to do right now that costs nothing.** Capture `mls_agent_id`, `license_number`, and `license_state` on the agent profile from the very first migration, even though nothing uses them yet. They are three text columns. Having them already populated across your whole customer base on the day you turn on a feed is the difference between flipping a switch and running a six-week data collection campaign.

---

## 6. Offboarding: The Cascade You Described

You described assets cascading up the hierarchy, and team owners and admins being able to invite agents. Both are right. I want to make one adjustment: **make it a workflow, not an automatic cascade.**

A silent cascade at 2am when someone clicks Remove is how data gets orphaned and how disputes start. A workflow does the same thing but leaves a record and a human decision.

### How removal works

- An AgentOwner or AgentAdmin clicks Remove on a membership.
- The system immediately revokes access. That part is instant, because it is a security action.
- The system generates an **offboarding inventory**: listings controlled, media and documents, generated assets, contacts owned, Linked profiles, open Openly claims.
- Everything transfers by default to **the next authority above**, exactly as you described. Agent on a team goes to the team lead. Agent reporting directly to the organization goes to the organization owner.
- The receiving authority gets a task list showing every item and can reassign each one, or accept the defaults in one click.
- Every transfer writes a row into `ownership_transfers` with the item, the from, the to, the actor, the timestamp, and the reason.
- **Nothing is ever deleted.** Membership status becomes `removed`. History stays intact.

### Team departure

Same workflow one level up. When a team leaves an organization, the team can take its data or the organization retains it, governed by a `data_portability_policy` field on the organization.

**This one needs to be in your customer agreement, not just your code.** The software should enforce whatever the contract says, and the contract should say something specific. If the software makes a portability decision your paperwork does not back up, you are the one standing between two angry parties. Set the policy at signup, show it in the UI, and let the contract be the authority.

---

## 7. Contacts: Your Strongest Product Promise, And Its One Risk

You said contacts always belong to the person who imported them, and that protecting the agent's leads and data matters. I think that is a genuinely differentiating position and most agents will love you for it, because most brokerage software quietly assumes the opposite.

There is one wrinkle you should decide on deliberately rather than discover later.

**The wrinkle:** not all contacts arrive the same way. Three cases:

- An agent uploads their personal sphere of 400 people from their phone. **Obviously theirs.** Nobody disputes this.
- An agent manually adds someone they met at church. **Obviously theirs.**
- A lead comes in through a Linked property page, for a team listing, promoted with team-paid marketing, on a team-owned profile. **This is the one people fight over,** and many brokerage independent contractor agreements explicitly claim it.

If your software hands case three to the agent unconditionally, you will eventually be sitting between an agent and a broker whose own signed agreement says otherwise, and you will be the vendor who took a side.

**The design that protects both them and you:**

- Every contact row has `owner_user_id`. Always set. Someone always owns it.
- Every contact row has `acquisition_class`: `agent_imported`, `agent_generated`, or `org_generated`.
- `agent_imported` and `agent_generated` **always** travel with the agent on departure. Not configurable. This is your promise and it should be unbreakable.
- `org_generated` follows an organization-level policy with an **agent-favorable default**, disclosed in the UI at the moment an agent accepts an invitation, so nobody is surprised nine months later.
- On departure, the agent gets a full export of everything they own, and org retention of `org_generated` copies happens per that policy, logged.

That way your marketing promise is true and absolute for the cases agents actually care about, and the contested case is governed by a policy the organization set and the agent saw. You are enforcing their agreement, not writing it.

---

## 8. Agent Profiles: Answering Your Question Directly

You asked how to think through the agent profile portability. The answer is to split it in two, because there are genuinely two different things wearing one name.

### `agent_profiles` — belongs to the person, follows them forever

- Legal name and professional display name
- License number, license state, `mls_agent_id`
- Personal mobile and personal email
- Headshot
- Personal bio
- Designations and certifications (GRI, ABR, CRS)
- Personal website and personal social accounts

This is a person's professional identity. They earned the license, they paid for the designations, that is their face. It follows them to their next brokerage and it never gets held hostage.

### `organization_agent_settings` — belongs to the organization, stays

- The display name this org uses in its marketing (some brokerages mandate a format)
- Org-issued email and org-issued direct line
- Office and branch assignment
- Team title (Buyer Specialist, Listing Partner)
- Org-mandated bio copy, when a brokerage requires specific language
- Org-supplied headshot, when the team paid a photographer for a branded shoot

### How marketing resolves it

When a template needs `{{agent.phone}}`, the resolver checks `organization_agent_settings` first, then falls back to `agent_profiles`. One function, used everywhere.

This gives you three things at once:

- **Your section 9 promise works.** Agent changes their mobile number in one place, every template in every app updates.
- **Departure is clean.** The person keeps their license, headshot, and bio. The organization keeps its branded assets and its org-issued contact details. No argument, because they were never the same record.
- **Brokerage compliance works.** A brokerage that mandates "Jane Smith, REALTOR®, Licensed in Alabama" as the display format can enforce it without editing the agent's personal profile.

That split is the whole answer, and it is cheap to build correctly now and expensive to untangle later.

---

## 9. Scale: 500 to 600 Agents

Straight answer: **600 agents is not a scaling problem for the database.** I want to be clear about that because people worry about the wrong layer.

Six hundred agents creating listings, uploading photos, and generating marketing produces a workload PostgreSQL handles without breathing hard. Supabase pools connections, and the read and write volume of six hundred people doing normal CRUD work is small by database standards. You would need to be an order of magnitude larger before the database is the thing you think about.

**The real bottleneck is image rendering,** and it is worth understanding because it changes one piece of the hosting recommendation.

If six hundred agents each generate a twelve-asset collection in the same window, that is 7,200 renders. Each render takes a couple hundred milliseconds of actual CPU. Done one at a time, that is half an hour of queue. Done with twenty workers running in parallel, it is about ninety seconds. The math is not scary, but only if the architecture lets you add workers.

**So one adjustment to the stack:**

- **Web application on Vercel.** Unchanged. It scales automatically and it is the right home for the app.
- **Rendering workers on a container host** such as Railway, Render, or Fly.io. They pull from the `generation_jobs` queue and you scale them by changing a number. Roughly twenty to fifty dollars a month at your target scale, and far cheaper than doing CPU-heavy rendering inside serverless functions, which get expensive fast and have execution time limits you will hit.
- **Database on Supabase.** Unchanged.

The second real constraint is photo bandwidth and storage, which is why the retention policy in the audit document matters. Six hundred agents uploading forty-photo listing sets is where your bill actually comes from, not from the database.

**What would need to change past roughly five thousand agents:** read replicas, a CDN in front of media, monthly partitioning on the events table, and a larger render fleet. Every one of those is additive. None of them require a rewrite, because the service layer keeps database access in one place. That is the whole reason section 73 of your spec was a good instinct.

**Bottom line: the stack I recommended handles 600 comfortably and scales to several thousand with configuration changes rather than reconstruction.** Build for 600, do not build for 50,000, and do not let anyone talk you into microservices.

---

## 10. What This Changes In The Plan

- **Milestone 2 grows slightly.** It now creates `properties`, `listings`, `listing_assignments`, and `property_listing_history` instead of one properties table. Worth it. This is a few extra days that saves a rewrite.
- **All ListVault records point at `listing_id`, not `property_id`.** This is the single most important line in this document. If generated assets ever attach to the property instead of the listing, a relisting in 2027 inherits a competitor's marketing and disclaimers, and unwinding that is very unpleasant.
- **AI extraction from listing sheets moves into Milestone 2** as a headline feature. It is cheap, legal, and it removes the worst part of the product.
- **`ownership_transfers` and the offboarding workflow move into Milestone 1,** because membership removal exists in Milestone 1 and it must never be a silent delete.
- **Three columns get added to the agent profile now**: `mls_agent_id`, `license_number`, `license_state`. They cost nothing today and they unlock Tier 3 later.
- **Rendering workers become a separate deployment** from Milestone 3 forward.

---

## 11. Still Open

Your message cut off mid-sentence at "We dom", and items 4 and 5 were blank. Whatever you were about to say about protecting agent leads and data, I want it, because that section is your differentiator and I would rather build it from your words than my guess.

Still needed from the original list:

- **Role collapse.** Five organization roles plus a permissions table, separate platform staff table, two lock states instead of six. Confirm or push back.
- **Print promise.** A good PDF an agent can print or upload to a vendor, or commercial press files?
- **Video in v1.** YouTube and Vimeo links only, or real uploads?
- **Openly and money.** Coordination only, or does it ever touch compensation? Coordination only is a much smaller legal footprint.
- ~~Trakkt naming.~~ **RESOLVED:** the inventory product is renamed **Stash** and lives inside Ops. Trakkt is transaction management.
- **Echo.** Alive as its own app, absorbed into the shared integration layer, or dead?
- **Beta cohort.** How many agents outside your team, and roughly when? This determines how much polish Milestone 3 needs before real people touch it.

---

**Sources consulted:**

- [RESO Web API standard](https://www.reso.org/reso-web-api/)
- [Bridge Interactive developer data access](https://www.bridgeinteractive.com/developers/data-access/)
- [MLS Grid FAQ](https://www.mlsgrid.com/faq)
- [SimplyRETS IDX developer API](https://simplyrets.com/idx-developer-api)
- [Greater Alabama MLS FAQs, Birmingham Association of REALTORS](https://birminghamrealtors.com/support/mls-faqs/)
