# Openly's Differentiation, and the ListVault Slice That Delivers It
## August 20, 2026

---

## You Are Right, And Here Is Why

I need to correct something in my own recommendation from the last document.

I told you to build Openly first because it has a proven price and warm prospects. That is still true. But I glossed over a problem you just put your finger on: **there is an incumbent already collecting that $1,100 a month.** If you ship a clone of what they have, you are asking fifteen office owners to switch to an unknown vendor for the same functionality. That is a hard sale and it is not a good use of a warm introduction.

**A differentiator is not a nice-to-have for Openly. It is the thing that makes the sale possible at all.**

So yes, build the ListVault capability alongside it. But not all of ListVault. A specific, narrow slice, defined below, with everything else explicitly excluded.

---

## First: What Actually Differentiates, Ranked

Before deciding what to build, it is worth being clear about what a differentiator has to do. You have **two audiences with different needs**, and you need one compelling answer for each.

- **The office owner signs the check.** They care about coverage: are our listings getting hosted, by whom, how consistently.
- **The agent uses the product.** They do not care about coverage percentages at all. They host open houses to get leads.

Here is the honest ranking:

| Differentiator | Value to agent | Value to office | Build cost | Verdict |
|---|---|---|---|---|
| Sign-in capture, leads go to the hosting agent | **Very high** | Medium | Low to medium | **Build it. This is the money.** |
| Branded graphic with Listed By and Hosted By | High | Medium | Medium | **Build it.** |
| Auto-filled from the real listing: address, photos, price | High | Low | **Free, already built** | **Build it, costs nothing** |
| Coverage and lead-production reporting | Low | **Very high** | Low | **Build it. It is the buyer's feature.** |
| Print flyer and directional sign | Medium | Low | Low once rendering exists | Include |
| Post-open-house follow-up automation | High | Medium | Needs Pulse | Later |
| Full ListVault collections and editor | High | Low | Very high | Later |

**The line that matters most in that table is the first one.**

An agent hosts an open house for exactly one reason: to meet buyers. Every incumbent open house tool hands them a calendar slot. If yours hands them the **leads**, you are not a better version of the same product. You are a different product that happens to include the same product.

**That is your pitch, and it is two sentences:**

- **To the agent:** "Claim the open house, get the branded graphics with your face on them, and keep every lead who signs in."
- **To the office:** "See who is covering what, and see which agents actually produce from it."

---

## The ListVault Slice: What Is In

Everything here serves the open house use case and nothing else. This is roughly three to four weeks of work on top of Openly, and most of that is design, not code.

### The rendering pipeline

Satori to SVG to resvg to PNG, plus pdf-lib for print. **This is not scope creep, it is pulling forward the single largest engineering investment in ListVault.** You need it regardless. Building it now against a small, well-defined template set means it is proven and debugged by the time the full ListVault ships. That is better sequencing than building it later against fifteen templates at once.

### The dual-agent variable resolver

**This is the architecturally important piece and it is easy to get wrong.**

Every ListVault template until now assumed one agent. Open house graphics need two, and if the resolver gets built single-agent first, every template you design has to be redone later. Same class of mistake as leaving out the disclaimer slot.

The template context needs:

- `{{listing_agent.*}}` — name, headshot, phone, email, brokerage
- `{{hosting_agent.*}}` — same fields, resolved from the Openly claim
- `{{listing_brokerage.*}}` — required, and see the compliance note below
- A **same-person mode**, because most of the time the listing agent hosts their own open house and the template should collapse gracefully to one agent rather than printing the same face twice

### The compliance rule that makes brokers trust you

This one matters and almost nothing in the market handles it correctly.

When Agent B from a different brokerage hosts Agent A's listing, **the listing brokerage's information is legally required on the advertising, and the hosting agent cannot present the listing as their own.** Getting this wrong is how an agent gets a complaint filed.

**The rule to build into the templates:**

- **Listing brokerage branding is required and locked.** Logo, name, and required disclosure text. The hosting agent cannot remove or replace it.
- **The hosting agent appears in a clearly labeled "Hosted by" position** with their name, headshot, and contact. Never in the listing brokerage's position.
- **When the hosting agent is at a different brokerage,** their brokerage is named alongside them, because that is generally required too.

Build that rule once, into the template structure, and every open house graphic your platform produces is compliant by construction. That is a genuinely strong thing to say in a room with a broker of record, and it is a real reason to switch vendors.

### The open house template library

Six to eight templates, not fifteen. Designed by you and me together.

- Open house announcement, square for feed
- Open house announcement, vertical for story
- "This Saturday" reminder
- Hosted-by variant, dual agent
- Directional sign, print
- Open house flyer for the table, print, single page
- QR sign-in card for the entry table, print
- "Just hosted" follow-up graphic

### Brand kits, minimum viable

Logo, colors, headshot, contact block, and the `required_disclaimer_text` field. Needed anyway for Milestone 1, so this is not new work, just wiring it into rendering.

### The generation job queue

Needed regardless. Small template set means it gets exercised properly before it faces a twelve-asset collection.

---

## The ListVault Slice: What Is Explicitly Out

Say no to these out loud so nobody builds them by accident.

- **The template editor.** Already deferred. Still deferred.
- **Template collections and bulk package generation.** That is the headline ListVault feature and it stays in ListVault's own milestone. Open house is one template at a time.
- **AI content generation.** Not needed for an open house graphic.
- **Property feature forms.** ListVault milestone.
- **Just Listed, Coming Soon, Price Improvement, Sold, and every other collection.** Open house only.
- **The full print pipeline with bleed and vendor specs.** A good single-page PDF an agent prints at the office. Nothing more.
- **Commercial press output.** Still out of scope everywhere.

If a request does not directly serve "an agent claimed an open house and needs materials for it," it is not in this slice.

---

## The Third Slice: Open House Sign-In

This is the one I would fight for, because I think it is worth more than the graphics.

**What it is:** a QR code on the sign-in card and the directional sign that takes a visitor to a mobile page where they enter name, email, and phone. That is it. One page, one form.

**Why it matters so much:**

- It replaces the clipboard, which every agent hates and which produces illegible handwriting and fake names.
- **The leads land in the hosting agent's database automatically**, which is the entire reason they showed up on a Saturday.
- It generates real events, which is what makes the office reporting meaningful. "Fourteen open houses hosted, 96 sign-ins" is a very different conversation than "fourteen open houses hosted."
- It is the natural on-ramp to Curb later. Same form engine, same visitor record, same lead pipeline. You are building a piece of Curb early rather than building something you will throw away.

**Who gets the lead.** This will be the first question every agent asks, so decide it now.

- **Default: the hosting agent gets the lead.** They sat there for three hours. This is also consistent with your own principle that contacts belong to the person who brought them in.
- **The listing agent gets visibility** into how many people came through, because it is their seller's house and they owe the seller a report.
- **The office can override the default**, because some brokerages have their own rules about open house leads.

**The compliance requirements carry over unchanged.** Verbatim consent text stored with a timestamp, IP, and source URL. SMS consent as a separate unchecked box. Rate limiting on the public form. None of that is optional.

**Cost:** roughly two weeks. It is a form, a page, a QR redirect, and a lead record.

---

## What This Costs You In Time

I want you to make this decision with real numbers rather than enthusiasm.

| Path | Estimated time after Core | What you can sell |
|---|---|---|
| Openly alone | 8 to 9 weeks | A clone of the incumbent |
| Openly + ListVault slice | 12 to 13 weeks | Something no competitor has |
| Openly + ListVault slice + sign-in | 14 to 15 weeks | A different product category |

**Roughly six extra weeks buys you the thing that makes fifteen warm introductions convert instead of politely decline.** I think that is clearly worth it, and I think shipping the bare version would waste the introductions, which are the scarcer asset.

Realistically, from a standing start: **four to five months to a differentiated Openly you can sell.** Not three months, and not a year.

---

## Revised Milestones

**Milestone 1: Core foundation.** Unchanged. Accounts tree, identity, entitlements, shell, Google sign-in. Two to three weeks.

**Milestone 2: Listings, lightweight.** Properties, listings, draft autosave, basic photo upload with HEIC handling. Enough for an open house to point at a real listing with real photos. Two weeks.

**Milestone 3: Openly core.** Opportunities, atomic claims, calendar, eligibility rules, notifications, coverage reporting. Three to four weeks.

**Milestone 4: The ListVault slice.** Rendering pipeline, dual-agent resolver, brand kit wiring, the locked-brokerage compliance rule, six to eight open house templates, generation queue. Three to four weeks.

**Milestone 5: Open house sign-in.** QR, form, visitor record, lead routing to the hosting agent, lead production reporting for the office. Two weeks.

**Then sell it.** Then take what those fifteen offices tell you and let it shape whether the next thing is full ListVault or something they asked for that neither of us has thought of.

---

## One Thing To Watch

The reason I pushed back before agreeing is that "let's also build X while we're at it" is how good plans turn into stalled ones, and it always sounds reasonable in the moment. It sounded reasonable here because it **is** reasonable, but only because we drew the line at eight open house templates instead of the whole app.

**The test for anything proposed from here to launch:** does an agent who just claimed an open house need this to run that open house well? If yes, it is in. If it serves any other moment in the business, it waits.

Hold that line and you ship in four months with something nobody can match. Let it slip and you are twelve months in with four apps at seventy percent and nothing to sell.

---

## Still Open

- **Openly:** is $1,100 the incumbent's price or yours? Who signs, an office or an association? What is the incumbent using today?
- **Open house leads:** confirm the hosting agent gets them by default, with listing agent visibility and an office override.
- **Curb:** listing pages only, or agent and team profiles too?
- **Ops budgeting tool name:** Split, Margin, Ledger, Basis, or Tally?
- **Echo:** becomes Pulse's sync layer, or survives?
- **Beta cohort:** which office goes first, and when?
