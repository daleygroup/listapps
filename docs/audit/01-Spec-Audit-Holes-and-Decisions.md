# ListApps Spec Audit
## Holes, Contradictions, and Decisions You Have To Make Before Anyone Writes Code

Prepared for Joseph Daley, August 20, 2026

---

## How To Read This

Your 90-section spec is genuinely good. It is better than what most funded startups hand a dev team. It gets the single most important thing right, which is that shared entities belong to the platform and applications reference them by ID. That one rule will save you a rewrite in eighteen months.

What it is missing is not vision. It is **decisions**. A spec tells a builder what to build. This document is the list of places where your spec tells a builder what to think about but never tells them what to decide, which means the builder decides for you, silently, and you find out six months later that they chose wrong.

I have sorted these into four buckets:

- **Blockers.** Cannot start without an answer. Wrong answer means a rewrite.
- **Legal and liability gaps.** Not code problems. Business risks that could cost you a license or a lawsuit.
- **Missing infrastructure.** Real systems your spec assumes exist but never names.
- **Contradictions.** Places where the spec argues with itself.

---

# PART ONE: BLOCKERS

## 1. The spec never names a single piece of technology

Ninety sections of architecture and not one decision about language, framework, database, hosting, authentication provider, file storage, or rendering engine. Section 84 tells Claude Code to "audit the repository" without saying what repository, in what language, on what host.

This is the biggest hole and it is invisible because the spec reads as complete. It is not. Handing this to a builder without a stack decision means the builder picks, and you inherit whatever they picked forever.

**Resolved in document 02.** I am recommending a full stack with reasoning.

---

## 2. Is a property global or is it owned by an organization? The spec says both.

This is the most serious architectural contradiction in the document and it will decide whether the whole thing works.

Section 22 says: "The physical property exists once."

Section 21 says: `properties` has `organization_id where appropriate`.

Those cannot both be true. Pick one:

**Option A: properties are globally unique.** One row for 123 Main Street, forever, shared by every organization on the platform. Beautiful in theory. In practice it breaks tenant isolation completely. If The Daley Group and a competing brokerage both touch the same row, you have to build field-level permissions on every column, row-level security becomes nearly impossible to reason about, and two agents editing the same property description overwrite each other. You will also be storing a competitor's confidential seller notes next to yours in the same record.

**Option B: properties are scoped to an organization.** Each org gets its own row for 123 Main Street. Tenant isolation is clean, RLS is one policy, nobody can see anyone else's data by accident. The cost is that the same physical house can exist as multiple rows across the platform.

**Option C (my recommendation): scoped rows plus a canonical identity key.**

- `properties` is organization-scoped. Every row has an `organization_id` that is never null. This is your security boundary and it is not negotiable.
- Every property row also carries `address_hash` (a normalized, hashed street address) and `mls_number`. These are your matching keys.
- Cross-listing inside an organization works exactly as your spec describes, through `property_relationships`. Agent A and Agent B on the same team share the row.
- Cross-organization sharing (Agent A markets a listing owned by a brokerage that is not theirs) becomes an explicit, revocable grant record in a `property_shares` table. It is opt-in, auditable, and the seller's confidential data does not travel with it.
- Scrapers and future MLS feeds use `address_hash` and `mls_number` to avoid creating duplicates **within an organization**, which is the only place duplicates actually hurt you.

**Why this matters more than it sounds:** if you choose A, you will discover the problem the first time a brokerage asks whether their competitors can see their pre-listing properties. The answer under A is "technically the code stops them," which is not an answer a broker of record accepts.

**Decision needed from you:** confirm C, or tell me why A matters to you.

---

## 3. What happens to the data when an agent leaves a team?

Your spec has no answer to this and it is the single most common and most bitter dispute in real estate. An agent leaves The Daley Group. Who owns:

- The properties they listed while on the team?
- The generated marketing assets, which carry team branding?
- Their Linked profile and the leads that came through it?
- The contacts they captured through team-owned intake forms?
- Their agent profile, headshot, and bio?

Right now the spec would let them walk with everything, or let the team keep everything, depending entirely on which line of code someone wrote on a Tuesday. Neither default is safe. This needs to be a written policy in the product, surfaced in the UI at the moment of invitation, and enforced in the schema.

**My recommendation:**

- `agent_profiles` follows the user. It is theirs. The person owns their own name, license, headshot, and bio.
- `properties`, `generated_assets`, `contacts`, and `intake_form_responses` belong to the organization. They stay.
- Membership removal sets `organization_memberships.status = 'removed'` and revokes access. It never deletes the historical rows, because you will need them for audit and for Trakkt.
- A departing agent gets an export of their own agent profile and a read-only archive of properties where they were the listing agent, if the organization's settings allow it. Make that a per-org toggle set by the AgentOwner.
- Linked profiles: the handle belongs to the organization if the organization created it, to the user if the user created it. Store `owner_type` explicitly on the profile row from day one.

**Decision needed from you:** confirm this policy or adjust it. This should also end up in your customer agreement, not just the code.

---

## 4. Your role system has three competing designs in one document

Section 12 gives five platform roles. Section 13 gives eight ListVault roles and then admits the conflict. Section 44 adds five template ownership tiers. Section 46 adds six element lock states. Section 20 adds an eight-level disclaimer inheritance chain.

Multiply those out and the "effective permission" for a single agent editing a single template element is a function of five independent hierarchies. Nobody can reason about that, including you, including me, including any developer you hire.

**My recommendation, and this is a real simplification you should take:**

- **Five organization roles.** Exactly the ones in section 12. Roles live on the membership, as you said.
- **One permissions table.** `role_permissions` mapping role to a flat list of permission strings like `property.create`, `template.edit`, `brokerage.manage`, `billing.manage`. Adding a capability is inserting a row, not inventing a role.
- **Scope, not tier.** Brokerage is not a role level. It is a scope attached to a permission. "Can manage disclaimers, at brokerage scope" is a permission plus a scope, not a ninth role.
- **Two lock states, not six.** `locked` and `unlocked`, plus an optional `locked_fields` array on the element for the middle cases. Six states is a settings screen nobody will understand. Two states plus a field list covers every real scenario you described in section 46 and can be explained to an agent in one sentence.
- **Internal ListApps staff roles are a separate table entirely.** Your "Sales" role from section 13 is a ListApps employee, not a customer role. Never mix those. Put it in `platform_staff` with its own permission set.

**Decision needed from you:** confirm the collapse, or name the specific scenario you think it breaks.

---

## 5. The template rendering pipeline is completely unspecified, and it is two pipelines, not one

You listed Instagram Square through Door Hanger and Sign Rider in section 42 as if they are variations of the same thing. They are not.

- **Social and web graphics** are RGB, 72 to 144 DPI, PNG or JPG, screen-viewed, and need to render in under two seconds.
- **Print collateral** (flyer, brochure, postcard, door hanger, sign rider) is 300 DPI, needs bleed and trim marks, and for a real print vendor, needs CMYK. A 4x6 postcard at 300 DPI with bleed is roughly 1875 by 1275 pixels. A 24x6 sign rider is much larger. These do not come out of a social graphic pipeline.

Also worth knowing before you promise it: the standard open-source rendering path (Satori, which converts HTML and CSS to SVG, then resvg to rasterize) produces RGB output and supports a deliberately limited subset of CSS. It is fast, cheap, and serverless-friendly, which is right for social. It will not produce a print-shop-ready CMYK PDF.

**My recommendation:**

- **One design source, two output paths.** Every template is authored once as a React component with a defined variable contract.
- **Path 1, social:** React component → Satori → SVG → resvg → PNG at the exact pixel dimensions. Fast, runs on Vercel, costs nothing per image.
- **Path 2, print:** same React component rendered at 3x scale → PNG → embedded into a PDF via pdf-lib at correct physical dimensions with bleed. RGB, which is fine for the vast majority of online print vendors and for the "email a flyer to a buyer" use case, which is 95% of real usage.
- **CMYK is a v3 problem.** When a customer genuinely needs a commercial press file, you add a conversion step. Do not build it now. Say so out loud in your marketing so nobody is surprised.

**Decision needed from you:** are you promising print-shop-quality output in v1, or is "download a nice PDF flyer and print it at the office or upload it to Vistaprint" the v1 promise? I strongly recommend the second.

---

## 6. Generating a 12-asset collection is a background job, and your spec assumes it is instant

Section 47 is your headline feature. An agent clicks one button and gets a full marketing package. Rendering twelve assets, several at print resolution, with image downloads and font loading, takes real time. On a serverless function you will hit a timeout, the request will die, the agent will see a spinner turn into an error, and they will not click that button again.

**This needs a job queue on day one, not later.** Specifically:

- A `generation_jobs` table with status, progress count, and error detail.
- Assets generated one at a time, each writing its own row into `generated_assets` as it completes.
- The UI shows real progress ("4 of 12 complete") and lets the agent leave the page and come back.
- Failed individual assets retry without redoing the whole package.

This is not gold-plating. Without it, your differentiator does not work on a real listing with 40 photos.

---

## 7. iPhone photos will break your uploader on day one

Section 79 says agents work from their phones and uploading photos is a priority workflow. iPhones shoot HEIC by default. Most browsers will not display HEIC, most image libraries will not process it, and a naive uploader will accept the file and then show a broken image forever.

Real estate listing photos are also enormous. A 40-photo listing straight off a phone is easily 400 MB. Uploading that over an agent's LTE connection while standing in a driveway is a product-defining moment, and if it fails, they never come back.

**Required, and missing entirely from the spec:**

- HEIC to JPEG conversion, ideally in the browser before upload.
- Client-side downscale before upload, with the original preserved only if you decide storage cost justifies it.
- Resumable, chunked uploads so a dropped connection does not restart a 40-photo batch.
- EXIF stripping on anything that becomes public, because EXIF carries GPS coordinates and you do not want a seller's exact location published by accident.
- Automatic derivative generation: thumbnail, web, and print sizes.

---

## 8. Storage cost will eat your margin and your spec has no retention policy

Section 83 makes cost efficiency an explicit product requirement. Section 40 and section 48 then describe storing every listing photo at full resolution, plus every generated asset, plus every version of every generated asset, for every property, forever.

Run the math on one active agent: 30 listings a year, 40 photos each at 5 MB, plus 12 generated assets per collection across 4 collections per listing, at print resolution. That is meaningful storage per agent per year, and it never goes away, and you are charging real estate agent prices.

**Required policy decision:**

- Store the **source** photo once, in one sensible resolution. Do not keep the 12 MB original unless a customer pays for it.
- Do **not** store generated assets indefinitely. Store the recipe (template ID + property ID + version of the data) and regenerate on demand, caching the output for 30 days. Regeneration is cheap. Storage is a subscription.
- Sold listings archive after a set period: media moves to cold storage or gets pruned to the hero image plus the marketing assets the agent actually downloaded.
- Set per-plan storage quotas from day one, even if they are generous. Adding a quota later to existing customers is a fight. Having one from the start is just how the product works.

---

## 9. The disclaimer inheritance chain is eight levels deep with no conflict rules

Section 20 stacks Platform → State/Market → Brokerage → Organization → Team → Agent → Application → Property. It says a brokerage update should flow down. It never says what happens when two levels disagree.

Concrete case: Alabama requires certain license disclosure language. Keller Williams requires its own advertising language. The team wants a shorter version because it does not fit on an Instagram story. Who wins, and does the agent get to know they were overridden?

**You need an explicit resolution algorithm.** My recommendation:

- Each disclaimer assignment has a `mode`: `required` (cannot be removed or edited at any lower level), `default` (applies unless a lower level overrides), or `available` (offered, not applied).
- Resolution walks from the top down. The first `required` assignment for a given disclaimer `type` wins and locks that type. Lower levels may **add** disclaimers of other types but never remove or alter a locked one.
- If a template physically cannot fit a required disclaimer, the render **fails loudly** with a clear message. It does not silently truncate. Silently truncating a required legal disclosure is how you get sued.
- Every render stores a snapshot of which disclaimer version was applied. When a brokerage changes its language, previously generated assets do not retroactively lie about what they said.

**Also, and this one is important:** collapse eight levels to four. Platform, Brokerage, Organization, Agent. State and Market become attributes on the brokerage and organization records, not their own tier. Application and Property become filters on the assignment, not tiers. Four levels is explainable. Eight is not.

---

# PART TWO: LEGAL AND LIABILITY GAPS

These are not code problems. These are the ones that can actually hurt you, and your spec does not mention any of them.

## 10. AI-generated listing copy is a fair housing exposure and you have no filter on it

Section 49 has AI generating property descriptions, social captions, and email copy from property data including school information and neighborhood highlights.

Fair housing liability in real estate advertising is strict. It does not require intent. Language like "safe neighborhood," "great for families," "walking distance to church," "quiet area," or leaning on school ratings has been treated as steering. An LLM generating marketing copy from a prompt that includes school data and neighborhood highlights will produce exactly this language, confidently and repeatedly, because that is how listing copy is written on the open internet where it trained.

Your own writing preferences already avoid the word "families," which tells me you know this. The product needs to know it too.

**Required before AI ships:**

- A fair housing system prompt on every generation call, with an explicit prohibited-language list.
- A post-generation scan against a term blocklist that flags rather than silently edits, so the agent sees what was caught and learns.
- Mandatory human review. AI output is a draft in an editor, never auto-published. Your spec says "editable before use," which is close, but make it structurally impossible to skip.
- A disclaimer in your terms that the agent is responsible for the final content. This does not eliminate your risk but it matters.
- Log every generation with its prompt and output. If a complaint ever comes, you need the record.

## 11. Website scraping of listing data is a real risk to your customers' MLS access

Sections 61 and 62 propose scraping AgentFire and Lofty sites to import listings, framed as a cost-saving bridge instead of paying for IDX.

The listings on those sites are usually IDX data, delivered under an MLS license agreement with rules about display, redistribution, and automated retrieval. Scraping IDX display data and re-displaying it in another product is the kind of thing that gets an MLS participant's feed shut off, and the person who loses access is your customer, not you. Losing a broker's IDX feed is a relationship-ending event.

**Hard boundary I would put in the product:**

- Import **only** listings where the customer's own organization is the listing brokerage. Never third-party listings, ever, under any framing.
- Require written authorization from the org owner before enabling an import adapter, stored with a timestamp.
- Respect robots.txt and rate limits. Your 15-minute cooldown in section 62 is good instinct, keep it.
- Prefer, where the vendor offers one, an actual API or export over scraping.
- Put a clear notice in the UI that the customer is responsible for compliance with their MLS rules. Real estate people understand this framing.

Also worth checking: listing photographs are frequently owned by the photographer or licensed to the listing brokerage only. Pulling photos from another agent's listing into your customer's marketing is a copyright problem separate from the MLS problem.

## 12. Lead capture with phone numbers plus CRM sync is a TCPA problem waiting to happen

Sections 56 and 57 require first name, last name, email, and phone on every intake form, then section 60 pushes that straight into Follow Up Boss where it will be texted.

Texting a consumer who did not give express written consent is a TCPA violation with statutory damages per message. Your spec lists "SMS consent" as a disclaimer type in section 19 but never specifies capturing, timestamping, or proving consent.

**Required on the lead record itself, not as a disclaimer:**

- The exact consent language shown, stored verbatim, versioned.
- A timestamp, IP address, and the URL where consent was given.
- A separate, unchecked-by-default checkbox for SMS consent, distinct from form submission.
- Consent status flowing to Follow Up Boss so the CRM knows whether texting is permitted.
- A suppression mechanism when someone opts out.

Also: the 90-day visitor cookie in section 56 needs a privacy policy and, depending on which states your customers operate in, a consent banner. Building it now is cheap. Retrofitting consent onto existing tracked visitors is not.

## 13. Openly may implicate license law and compensation rules

Section 64 has agents claiming showing coverage, open house hosting, and floor time, potentially across brokerages. Real estate compensation is regulated. Paying a licensee who is not affiliated with your brokerage, or compensating an unlicensed person for licensed activity, is a license violation in most states. Supervision requirements mean a broker of record generally has to know who is sitting in their listing.

I am not a lawyer and you should confirm this with yours, but the product design question is real:

- Does Openly handle money at all, or only coordination? If only coordination, your risk drops enormously. **Start there.**
- Are opportunities restricted to within a single brokerage by default? I would make cross-brokerage an explicit, off-by-default setting.
- Does the listing agent's broker get visibility into who claimed coverage on their listing? They should.

## 14. Trademark clearance on your product names

Three flags:

- **Linked** is close enough to LinkedIn that I would expect a challenge, and it is likely difficult to register as a mark in a software category. Worth a conversation with an IP attorney before you print anything.
- **Openly** is an existing insurance brand operating in the property space. Same conversation.
- **Trakkt** was formerly the name of your inventory SaaS at trakkt.co. **RESOLVED:** that inventory product is renamed **Stash** and folds into Ops. Trakkt is now transaction management. No conflict remains.

Cheap to check now. Expensive to change after you have customers and printed material.

---

# PART THREE: MISSING INFRASTRUCTURE

Things your spec assumes exist but never names. Each one is a real decision.

- **Transactional email.** Invitations, password resets, lead notifications, generation-complete alerts. Needs a provider and needs SPF, DKIM, and DMARC set up on listapps.co. You already deal with this on the Google Workspace side so you know the drill.
- **Environments.** Your spec says "migration plan before destructive schema changes" but never establishes a dev, staging, and production separation. Without it, every schema change is performed on live customer data. Non-negotiable.
- **Backups and restore.** Not just "backups exist." A tested restore. Untested backups are a feeling, not a system.
- **Address normalization and geocoding.** Required for your dedup matching in section 62 and for the maps in section 58. This is a paid service at volume. Pick one and know the cost.
- **Rate limiting on public endpoints.** Section 75 mentions it for forms. It also applies to Linked profile views, QR redirects, and anything unauthenticated.
- **Error monitoring.** You will not know the generation pipeline is failing for one customer unless something tells you.
- **The events table will become your largest table by an order of magnitude.** Section 31 plus section 69 means every profile view, link click, and property view. Plan monthly partitioning from the start, or plan to be surprised.
- **Custom domains for white-label.** Section 71 promises customer domains. That means wildcard DNS, automated SSL provisioning per tenant, and routing by hostname. It shapes your hosting choice, so it has to be decided now even though it is built later.
- **Video.** Section 27 lists video and drone media. Video needs transcoding, streaming, and a lot of storage. It is a different cost class than images. Decide now whether v1 accepts video uploads at all, or only YouTube and Vimeo links. I strongly recommend links only for v1.

---

# PART FOUR: CONTRADICTIONS IN THE SPEC

## 15. Sections 33 and 34 undercut section 90

Section 90 correctly names the two failure modes: build ListVault standalone and duplicate everything later, or build a theoretical platform for months and ship nothing. Then sections 33 and 34 instruct the builder to complete a Phase 1 of thirteen subsystems and a Phase 2 of eleven more **before** starting ListVault.

That is wrong approach number two wearing a name tag. Feature flags, webhooks, full brand kit scoping, eight-level disclaimer inheritance, and a complete buyer-side workflow are all in that list, and none of them are needed for the milestone in section 85.

**The actual resolution, and it is a real technique, not a compromise:**

Build a **vertical slice**. Create only the tables the section 85 milestone touches. But create them with the final shared names, the final shared shapes, and the final tenant boundary. A table you create correctly with three columns can grow to thirty columns later without a rewrite. A table you create with the wrong name or the wrong owner requires a migration and a code sweep.

The rule is not "build everything shared first." The rule is **"never create a table you will have to rename or reparent."** That is what protects you, and it costs weeks, not months.

Concretely, the section 85 milestone needs about fourteen tables. Your section 89 list has thirty-two. Build fourteen. Design all thirty-two on paper so the fourteen are shaped right.

## 16. Section 88's test will pull everything into shared core

"Could another ListApps application reasonably need this information?" The honest answer for almost any field is yes, eventually, maybe. That test over-triggers and you end up with a bloated core, which is the other failure mode.

**Sharper test:** "If two applications each stored this independently and they disagreed, would a user consider that a bug?" An agent's phone number: yes, obviously a bug. A ListVault template's z-index ordering: no. That question has a clear answer almost every time.

## 17. Back on Market is both a status and a transition

Section 23 makes Back on Market a first-class status. It is not really a state, it is an event that returns a listing to Active. If it is a status, then after two weeks a listing is still "Back on Market" rather than "Active," and every filter, report, and integration has to special-case it.

**Recommendation:** keep `back_on_market` as a real status value, because your marketing collections trigger off it and agents think in those terms. But add an auto-transition to `active` after a configurable window, defaulting to 14 days, recorded in status history. You get the marketing trigger and the clean data.

## 18. Mobile-first and a Canva-style editor are in tension

Section 45 wants drag, resize, layer ordering, and font controls. Section 79 says every major workflow must work well on a phone. Canvas editors are genuinely bad on phones and nobody has solved it, including Canva.

Your answer, which you already chose: fixed layouts in v1. The editor becomes a desktop-primary feature in a later version, and the phone gets "pick a collection, tap Generate, download." That is the right split and it is worth writing down so nobody re-litigates it.

## 19. Section 68 contacts versus section 60 Follow Up Boss

If Follow Up Boss is the system of record for contacts, why does ListApps have a `contacts` table? If ListApps has one, which wins on conflict? Your spec describes both without resolving ownership.

**Recommendation:** ListApps `contacts` is a capture and attribution record, not a CRM. It stores what happened on your platform, holds the external FUB ID, and never tries to be the source of truth for contact detail. Do not build contact editing, pipelines, or stages. The moment you do, you are competing with Follow Up Boss and losing.

## 20. Echo is missing from the spec entirely

Your earlier ListApps planning included Echo, the contact and deal sync engine connecting Google Contacts, Apple Contacts, Follow Up Boss, and Sisu. This spec has four apps and Echo is not one of them.

Did Echo get absorbed into the shared integration layer in section 32, is it dead, or was it left out by accident? It matters because if Echo is alive, it changes what `contacts` and `organization_integrations` need to look like.

---

# THE SHORT LIST: WHAT I NEED FROM YOU

Everything above is documented so you have it. These are the ones that block me from writing the first line of schema:

1. **Property ownership model.** Confirm Option C (org-scoped rows plus canonical matching keys plus explicit cross-org shares), or tell me why global properties matter to you.
2. **Agent departure policy.** Confirm the split I proposed, or adjust it.
3. **Role collapse.** Confirm five org roles plus a permissions table plus separate platform staff, and two lock states instead of six.
4. **Print quality promise.** Is v1 "a good PDF you can print or upload to a print vendor," or are you promising commercial press files?
5. **Video in v1.** Links only, or real uploads?
6. **Openly and money.** Coordination only, or does it ever touch compensation?
7. **Trakkt naming.** Does the analytics layer keep the name, or does your existing inventory product keep it?
8. **Echo.** Alive, absorbed, or dead?
9. **Beta cohort.** How many real agents, and when do they get their hands on it? This determines how much polish v1 needs.

---

*Cross-referenced against the current ListApps master specification, sections 1 through 90.*
