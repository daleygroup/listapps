# Getting Listings Into ListApps Without Paying For MLS Access
## Plus the "save progress" problem, which matters more than it sounds

Revision A, August 20, 2026

---

## The Situation

You like the RESO Web API path but cannot fund it right now. That is the correct read of the economics, and here is the good news: **you do not need it to ship, and skipping it costs you almost nothing in the product an agent actually experiences.**

There are three ways to fill in a listing that do not require a single dollar of MLS licensing. Two of them are free, and the third is cheaper than you probably expect.

---

## Method 1: Manual Entry, Done Well (free, build first)

Manual entry gets dismissed as the fallback. It should not be. The reason agents hate manual entry is not typing, it is **badly designed forms**: forty fields on one screen, a Save button that fails validation on field thirty-eight, and lost work.

Fix the form and manual entry stops being a problem:

- **Progressive steps, not one wall of fields.** Address first. Then price and the basics. Then description and features. Then photos. Each step is short enough to finish standing in a driveway.
- **Only three fields are ever required to create a listing:** address, listing side, and status. Everything else is optional and can be filled in whenever.
- **Smart defaults from the agent's own history.** Their name, brokerage, phone, and brand kit are already known. They never type those.
- **Mobile-first inputs.** Number pads for numeric fields, a real address autocomplete, big tap targets.

Most agents will do this in under four minutes for a listing they know well.

---

## Method 2: AI Extraction From Documents The Agent Already Has (nearly free, build in Milestone 2)

This is the feature that makes manual entry mostly disappear, and it is fully compliant because the agent is supplying their own data about their own listing.

**The agent gives us any one of these:**

- A PDF of their own MLS listing sheet, which every MLS lets an agent export
- A photo or screenshot of an MLS printout
- A link to their own listing on their own brokerage website
- A listing flyer they already made
- Even a text message or email with the details in it

**We extract every field we can and pre-fill the form.** The agent reviews and corrects rather than types. Every extracted field is marked as AI-populated so they know what to double-check.

**Cost:** a few cents per listing in AI tokens. Not per month. Per listing.

**Why this is legitimate where scraping is not:** the agent is handing us a document they are authorized to possess about a listing they control. We are not retrieving anything from an MLS system, not circumventing an IDX license, and not touching another agent's listing. The boundary rule stays exactly where it was: own listings only.

This one feature does more for the daily experience of using ListVault than an MLS feed would, and it costs 1% as much.

---

## Method 3: Public-Record Property Data (cheap, add when you want it)

This is your answer to "can we reference somewhere else."

Public-record property data is **not MLS data.** It comes from county assessors, recorders, and tax rolls. It is public information, it requires no MLS approval, no IDX agreement, and carries none of the display restrictions. Several vendors aggregate it nationally and sell it by API call.

**What it gives you, keyed by street address:**

- Parcel or APN number, lot size, acreage, zoning
- Year built, square footage, beds, baths
- Tax assessment history and current tax amount
- Sale history: what it sold for and when, going back years
- Owner name of record

That maps almost exactly onto the `properties` layer in our architecture, which is the layer that holds physical facts about the house. It is a very clean fit.

**Pricing is genuinely affordable.** RentCast, as one example, publishes its rates openly: a free tier at 50 lookups a month, then $74/month for 1,000 lookups, $199 for 5,000, with overages in the pennies. Regrid and ATTOM are the other names worth a conversation, and Zillow Group offers a public records API but access is invitation-only and aimed at commercial partners.

**Run the math for you:** 600 agents doing 30 listings a year is 18,000 lookups annually, about 1,500 a month. That is the $199 tier. During beta with a handful of agents, the $74 tier is more than enough, and you look each property up exactly once and cache it forever, because a house's year built does not change.

**One caveat to keep in mind:** some of these vendors also sell active listing data. Property records are public and safe. Their listing feeds have their own terms, and those are not a substitute for a licensed IDX feed. Use them for the property layer, not the listing layer.

---

## The Recommended Sequence

- **Now:** Method 1. Well-built manual entry.
- **Milestone 2:** Method 2. AI extraction. This is the one that makes agents say "oh, that's nice."
- **When you feel like it, roughly Milestone 4:** Method 3. Type an address, watch the house fill itself in.
- **When revenue justifies it:** RESO Web API through an aggregator, which then also unlocks "show me all my listings by my MLS agent ID."

**Capture `mls_agent_id`, `license_number`, and `license_state` on the agent profile from the first migration regardless.** Three text columns, no cost, and on the day you turn on a feed your entire customer base is already ready for it.

---

## Save Progress: You Are Right That This Matters

You asked for a save-progress option so agents do not lose work when they get pulled away or are waiting on photos. This is a bigger deal than it sounds and I want to make the case for building it properly rather than as a Save Draft button.

**The reality of the job:** an agent starts a listing in the car, gets a call, drives to a showing, remembers it at 9pm, and the photographer does not deliver until Thursday. A listing is almost never entered in one sitting. Software that assumes otherwise fights the way the work actually happens.

### How it should work

**There is no Save button and there is no Create button.** The moment an agent types an address, a listing exists in `draft` status. Everything after that autosaves.

- **Autosave on every field, debounced.** Type a price, look away, it is saved.
- **Offline-tolerant.** Changes cache locally and sync when the connection returns. Agents lose signal in basements and rural Shelby County constantly.
- **Nothing is lost on tab close, phone lock, app switch, or dead battery.**

### The completeness system

This is the part that turns save-progress from a convenience into a feature agents talk about.

Every draft listing shows **what is still missing and what it is blocking:**

- "Ready to generate marketing" needs: address, price, beds, baths, square footage, one photo.
- "Ready to publish" needs all of that plus status set to active and visibility set to public.

So the listing card says something useful like **"Marketing ready. Publishing needs 2 more items."** Not a percentage bar, an actual list of what to do next.

### Waiting-on flags

Let the agent tell the system why it is not finished:

- Waiting on photos
- Waiting on the seller disclosure
- Waiting on a price decision
- Waiting on a signed listing agreement

The dashboard groups by these. An agent opens ListVault Monday morning and sees "3 listings waiting on photos" instead of a pile of half-finished records with no explanation. That is a small thing that makes the product feel like it understands the job.

### Draft listings and the confidentiality rule

Draft listings are `internal` by definition. No public page, no shareable URL, no search indexing, no QR destination. Marketing generation is allowed on a draft, because preparing a Coming Soon package before going live is exactly the workflow this is meant to serve.

---

## What Changes In The Plan

- **Method 1** is Milestone 2 and it was already planned. The change is treating form design as a real feature rather than plumbing.
- **Method 2** (AI extraction) joins Milestone 2 as a headline item.
- **Method 3** (public records) is a Milestone 4 item, roughly $74 to $199 a month when you turn it on.
- **Save progress, autosave, completeness, and waiting-on flags** are Milestone 2 requirements, not nice-to-haves. Listings are drafts from the first keystroke.
- **RESO Web API** stays out of scope. The schema is ready for it. Nothing else changes when you eventually add it.

---

**Sources:**

- [RentCast API pricing and property data](https://www.rentcast.io/api)
- [Regrid Property API](https://regrid.com/api)
- [Zillow Group Public Records API](https://www.zillowgroup.com/developers/api/public-data/public-records-api/)
- [RESO Web API standard](https://www.reso.org/reso-web-api/)
