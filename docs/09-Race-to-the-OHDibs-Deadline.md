# The Race to the OHDibs Deadline
## A date-anchored plan, August 20 through November 2026

---

## First: Check the Contract This Week

Before anything else in this document matters, go find the OHDibs agreement and look for the **non-renewal notice period.**

Most brokerage SaaS contracts auto-renew and require thirty to sixty days written notice to stop. If those six offices are on a contract that renews January 1 with sixty days notice, **the real deadline is November 1, not December 1.** You would lose a month you thought you had, and you would find out in late November when it is too late to do anything about it.

I have built the plan below to hit demo-ready by **October 30** for exactly this reason. If the notice period turns out to be shorter, you gain buffer. If it is longer, you gain selling time. Either way you are not caught.

**Two other things to pull from that contract:**

- **What are they actually paying?** OHDibs publishes tiered pricing by brokerage size, and their Enterprise tier for 501 to 1,500 agents lists at $998 a month at an early-adopter rate and $1,299 standard, plus a setup fee. Your $1,100 figure sits right in that band. Knowing which rate those offices are on tells you what you are really competing against.
- **Is there a lifetime rate lock?** OHDibs advertises early-adopter rates guaranteed for the life of the subscription for their first twenty brokerages. If those six offices hold a locked rate, walking away means they can never get it back. That is a real switching cost and the office owner will raise it. Have an answer ready.

---

## Your Pricing Position Is Stronger Than You Think

You said you could charge $1,250 to $1,500 for a tool that does the marketing too. Set against what OHDibs publishes, that is a very defensible number.

- Their standard Enterprise rate is **$1,299 a month.**
- Your $1,250 is **below** their standard rate.
- Your $1,500 is a **15 percent premium** over it.

So the pitch is not "pay more for more." It is closer to **"pay about the same, and your agents get branded open house marketing, a QR sign-in that feeds their database, and lead production reporting you have never had."** That is a much easier conversation than a premium-pricing conversation.

**One structural question worth deciding deliberately.** OHDibs prices in tiers by brokerage size, so all six offices under one Enterprise contract is one price. If instead each office contracts separately at roughly 200 agents each, they would land in a mid tier individually and the combined total would be considerably higher than a single enterprise deal.

Decide which you are selling: **one market-wide contract or six office contracts.** They produce very different revenue and very different renewal risk. Six separate contracts is more money and more resilience, since losing one office does not lose the market. One contract is an easier sale and a single point of failure.

---

## Demo Is Not Product, And That Distinction Saves You

Here is the reframe that makes this deadline achievable rather than reckless.

**What an office owner needs to see before deciding not to renew:** the full loop working, on their own listings, with their own branding, convincingly enough that they can picture their agents using it.

**What they do not need to see:** billing, self-serve onboarding, invitation flows at scale, every edge case handled, or eight templates instead of four.

A demo has to be **real end to end but narrow.** Not a mockup, not clickable slides. Real data, real logins, real generated graphics, a real QR that a real phone can scan. But seeded by hand for one office rather than built to onboard a thousand.

**That compression is the difference between fourteen weeks of work and ten.**

**Production hardening happens in Q1 2027, after they have signed.** That is a normal way to sell software to an office that has known you for years. It is not a normal way to sell to strangers, which is another reason the Birmingham offices are the right first customer.

---

## The Loop the Demo Must Show

Every one of these has to work. None can be cut, because the loop is the pitch.

1. Log in as an agent at a KW Birmingham office
2. See the office's real listings
3. A listing agent posts an open house opportunity
4. A different agent claims it, and the claim is instant and atomic
5. The claiming agent immediately gets branded graphics with **Listed by** and **Hosted by**, correct brokerage branding on both sides
6. They print a branded sign-in sheet with a QR code on it
7. A visitor scans the QR on a phone, signs in, and the lead lands in the **hosting agent's** database
8. The office owner opens a report showing coverage and sign-in counts by agent

Steps 5 through 8 are what OHDibs does not do. That is the entire sale.

---

## The Week-by-Week

Fourteen weeks from August 24. Demo-ready October 30, with November for selling and refinement.

### Weeks 1 to 3 — August 24 to September 11: Core foundation

- Mac setup, GitHub, Supabase, Vercel, first deploy
- `accounts` tree, memberships, four roles, path-based row-level security
- Authentication, invitations, **Sign in with Google**
- `platform_staff` and impersonation with logging
- `agent_profiles` and `organization_agent_settings`
- **The brokerage library** (spec below)
- `brand_kits`, `applications`, `subscriptions`, `audit_logs`, `events`
- The app shell and app switcher

**Milestone check:** you log in, you see KW Metro South with The Daley Group under it, Kirsten is invited and logs in, and a second test office is provably invisible to both of you.

### Weeks 4 and 5 — September 14 to September 25: Listings

- `properties` global, `listings` brokerage-owned
- Draft-first with autosave
- Manual entry, mobile-first, progressive steps
- Photo upload with HEIC conversion and reordering
- Status and visibility, with internal as the default
- Brokerage dropdown wired from the library into the agent profile

**Milestone check:** you create a real listing on your phone in a driveway and upload twenty photos over cell service.

### Weeks 6 to 8 — September 28 to October 16: Openly core

- `opportunities`, `opportunity_claims`, eligibility rules
- **Atomic claiming**, verified with a deliberate concurrency test
- Calendar and list views, mobile-first
- Notifications: posted, claimed, reminder, cancelled
- Coverage reporting for the office

**Milestone check:** two people on two phones tap Claim at the same instant and exactly one wins.

### Weeks 9 to 11 — October 19 to November 6: The ListVault slice

*This runs slightly past the October 30 target and that is deliberate. See the risk section.*

- Rendering pipeline: Satori to resvg to PNG
- Letter-size PDF via pdf-lib for the printables
- **Four-object variable resolver:** listing agent, listing brokerage, hosting agent, hosting brokerage
- Collapse modes for same-agent and same-brokerage
- Locked listing-brokerage branding enforced structurally
- **Four templates for the demo**, expanding to six or eight after: open house square, open house story, hosted-by dual agent, and the branded sign-in sheet
- Generation queue with real progress

### Week 12 — November 9 to 13: Sign-in capture

- QR generation and redirect tracking
- One mobile sign-in page, one form
- Consent capture stored properly: verbatim text, version, timestamp, IP, source URL, separate SMS checkbox
- Lead routes to the **hosting agent**, listing agent sees counts
- Lead production report for the office

### Weeks 13 and 14 — November 16 to 27: Demo readiness

- Seed all six offices' real branding and a handful of real listings each
- Walk the loop end to end on a phone, repeatedly, until nothing surprises you
- Fix what breaks
- Rehearse the demo until you can run it without looking at notes

---

## The Brokerage Library

You are right that this should be an admin-curated library rather than free text, and it solves a problem most real estate software gets wrong.

**`brokerages` is a platform-global table**, not tenant-scoped, because the same brokerage record serves everyone.

Fields to collect, per your list plus what marketing and compliance will need:

- Legal name, DBA / display name, office name
- Franchise affiliation (Keller Williams, RE/MAX, and so on)
- **Qualifying broker name and license number**
- Brokerage license number and state
- **Logos:** light, dark, and the franchise-required version
- Address, phone, website
- MLS identifiers
- `required_disclaimer_text`
- `status`: `verified`, `pending_review`, or `user_submitted`

**How agents use it:** a searchable typeahead on the agent profile, matching on name, city, and state. They pick theirs once. `brokerage_id` lands on their profile and **auto-populates across every app** from then on, exactly as you described.

**The piece you will need sooner than you think:** a **"request to add" flow.** Six Birmingham offices you can hand-enter this month. The moment you sell to an office in Nashville, agents will need brokerages that do not exist in your library yet. If there is no request queue, that becomes support tickets and a stalled signup. Build the queue in week 3, even though nobody uses it until next year.

**Franchise-level records are worth having from the start**, because franchise brand requirements live above the individual office. Keller Williams' logo rules apply to all six Birmingham offices identically. Store them once.

**Hosting brokerage, and one important detail:** when an agent claims an open house, `hosting_brokerage_id` is derived from their profile at the moment of claiming and **snapshotted onto the claim record.** If that agent changes brokerages in March, the February open house graphic still shows what was true in February. Never resolve historical branding live.

---

## Print Scope, Drawn Precisely

You want the print pipeline deferred but you also want a paper sign-in sheet. Those are compatible, and here is the line.

**In scope now:**

- **Letter size, 8.5 by 11, RGB, no bleed.** Printed on the office printer.
- The branded sign-in sheet, the table flyer, and a simple directional sign.

**Out of scope until the next phase:**

- Bleed, trim marks, and CMYK conversion
- Postcards, door hangers, and sign riders as vendor-ready files
- Anything with a commercial print vendor's specifications attached

**On the sign-in sheet specifically, one design decision worth making now.** Put the QR code **on the paper sheet itself**, alongside the handwriting columns. Then one artifact serves both audiences: the tech-comfortable visitor scans it, the visitor who wants to write does that, and the non-techy agent never has to think about which version to print. That is a better answer than two separate documents.

*A future idea worth noting and not building: an agent photographs the completed paper sheet and the handwriting is read into leads automatically. Real value, wrong quarter.*

---

## Confirmed Decisions From Your Last Two Messages

- **No AI content generation for templates.** Recorded as a hard rule. I will not raise it again unless you ask. Worth noting the distinction: AI **extraction** from a listing sheet the agent already has is a different thing from AI **generating** marketing copy, and neither is in the demo scope regardless.
- **Curb is listings only.** Agent and team profile inclusion on Curb pages becomes a **setting** in team and agent preferences, not a separate profile product. That is a meaningful simplification and I think it is the right call.
- **Hosting agent gets the open house leads.** Listing agent sees counts. Office can override.
- **Budgeting and cost tool deferred.** Removed from active planning. Stash stays in the Ops concept for later.
- **Team and agent logo slots in designs:** noted for later, but I am adding the **field and the layout slot now**, because that is the cheap version. A logo column on team and individual brand kits, plus an optional logo position in every template designed from here forward. Same lesson as the disclaimer slot: the field is trivial, redesigning finished templates is not.

### What Echo was

You asked, which tells me it is not important, but here is the answer.

Echo was a personal contact and deal sync engine you had planned, connecting Google Contacts, Apple Contacts, Follow Up Boss, and Sisu, meant to be sold at echo.listapps.co.

**My recommendation: retire the name.** Everything it was going to do is now either Pulse's sync layer or Core's integration layer. It does not need to be a product, and one fewer name to trademark, brand, and explain is a win.

---

## The Biggest Risk, And It Is Not Code

**Template design is the long pole, and the bottleneck is you, not the build.**

The rendering engine is a known quantity. Designing four open house templates that look better than what a good agent already makes in Canva requires your taste, your brand assets, and Keller Williams' franchise requirements. That work cannot start until you deliver materials, and it cannot be rushed at the end.

**What I need from you by September 12, which is three weeks from Monday:**

- The Daley Group logo, light and dark, highest resolution you have
- **Keller Williams franchise-required logo files and the brand standards document.** Ask KW Metro South marketing this week. Franchises can be slow, and this one is a hard dependency.
- Brand colors as hex codes, and font files if you are licensed for them
- Headshots for two or three agents to build against
- **Five to ten open house graphics you or your team have made and are proud of.** These are the design target. I would rather beat something real than guess.
- The required disclaimer text, verbatim from your broker

**And one thing I would do this week:** get one of the six offices to commit as your design partner. Not a buyer yet, just someone who will look at four templates in October and say "our agents would not use that one." Building against real reactions beats building against assumptions, and you have eight weeks to collect them.

---

## Honest Read on the Odds

**Demo-ready by October 30 is achievable** if Core starts the week of August 24 and the brand assets land by September 12.

**It is not achievable** if the Mac setup drifts into September, or if the KW franchise files take six weeks to arrive, or if scope grows past the loop in the section above.

**The single thing most likely to sink this is a good idea in week nine.** Every addition between now and the demo costs you the deadline, and the deadline is the whole point. Anything that is not in that eight-step loop waits until December, and December is a genuinely good time to build it, because by then you will know what those six offices actually said.

---

## Still Open

- **Notice period on the OHDibs contract.** Check this week.
- **One market-wide contract or six office contracts?**
- **Which office is the design partner**, and can you get them committed this week?

---

**Sources:**

- [OHDibs pricing](https://www.ohdibs.com/pricing.html)
- [OHDibs FAQ](https://www.ohdibs.com/faq.html)
- [OHDibs product overview](https://ohdibs.com/)
