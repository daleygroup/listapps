# Decisions log

Every business or schema decision lives here. Background runs add `PENDING` entries and never act on them until Joseph marks them `APPROVED` (or answers in the 7 AM digest and a session records his answer here with the date).

Format: ID, status, date, the question in plain language, options, recommendation, and Joseph's answer.

---

## D-001 Build approach: two tracks (Option C)
- **Status:** APPROVED by Joseph, 2026-10-21
- A clickable sample-data prototype of the eight-step loop for the October 30 conversations, built outside this repo, while the real platform is built continuously in this repo behind it.

## D-002 Daily check-in and stop rules
- **Status:** APPROVED by Joseph, 2026-10-21
- Background build runs several times a day. A digest every day at 7:00 AM Central with what was built, what broke, and the decisions waiting on him.
- When a run has to stop and wait on him, it emails joseph@dealwithdaley.com (only him) with `[ListApps WAITING]` or `[ListApps URGENT]` in the subject and a link to the stopped session.

## D-003 Milestone 1 schema
- **Status:** APPROVED by Joseph, 2026-10-21, as written including the Q1 to Q3 recommendations
- **Question:** Approve the 17-table Milestone 1 schema in `docs/proposals/001-milestone-1-schema.md` so migrations can be written. Part 1 of the proposal is a one-page plain-English summary.
- **Three small questions folded in (details in Part 5 of the proposal):**
  - Q1: Five more tables are platform-wide rather than per office: the brokerage library, agent profiles (they belong to the person), and ListApps' own permission rulebook, theme, and staff log. Recommendation: approve.
  - Q2: An agent's personal account sits outside the office tree, so nobody above them has authority over it. Recommendation: approve.
  - Q3: A subscription on the team you belong to covers you directly; "includes descendants" only decides whether it flows further down. Recommendation: approve.
- **Recommendation:** approve as written. Reply "D-003 approved" or list changes.
- **Joseph's answer (2026-10-21, in session https://claude.ai/code/session_01NtLQdRAthxvEgDdBr758XT):** "003 approved." D-004, D-005, and D-007 were not part of this answer and stay PENDING.

## D-004 Development database for background runs
- **Status:** PENDING
- **Question:** Background runs test against a throwaway database inside each run. To test real logins, they need the `listapps-development` Supabase project. Has it been created?
- **Options:** (a) Joseph creates `listapps-development` in Supabase (free tier) and adds its URL and keys to the scheduled build task's environment; (b) keep testing locally only until Milestone 1 tables are approved, then decide.
- **Recommendation:** (b) now, (a) by the time D-003 is approved. Never production.
- **Progress (2026-10-29, run 64):** a Supabase email to Joseph shows `listapps-development` exists (ID tywrremkivggoigafsoq) and is flagged for pausing because nothing uses it. Its URL and keys are still not in the build environment, so this stays PENDING. Recommendation: do not upgrade to Pro; a pause is free to undo within 90 days and daily build use will keep it active.
- **Progress (2026-10-30, run 72):** Supabase emailed at 03:17 UTC that `listapps-development` is now paused. Nothing is lost: Joseph can unpause it free from the Supabase dashboard any time before about 2027-01-28 (90 days). When adding the D-004 variables, unpause it first. Still no Pro upgrade recommended.

## D-005 Email service for invitations and impersonation notices
- **Status:** PENDING
- **Options:** Resend (free tier covers 3,000 emails a month, simplest setup), Supabase's built-in email (fine for testing, rate limited, not for customers), Postmark.
- **Recommendation:** Resend, sending from a subdomain such as `mail.listapps.co` so ListApps email never affects dealwithdaley.com deliverability.

## D-006 OHDibs non-renewal notice date
- **Status:** PENDING (Joseph checking the contract)
- This date sets how hard the real build has to push toward the December target.

## D-007 Default data policies when people or teams leave
- **Status:** PENDING (not blocking anything yet; contacts arrive in a later milestone)
- **Question 1, leads when an agent leaves:** the agent always keeps every contact they own, no exceptions. The only question is whether the office or team *also* keeps a copy of leads that came from office-generated sources (office listings, office-paid marketing), which the database calls `org_generated`.
  - Option A: the account also keeps a copy of `org_generated` leads. Nobody loses anything; matches what most brokerage agreements already say.
  - Option B: the account keeps no copy. Most agent-friendly; some brokers will object.
  - Option C: no default; each office picks during setup and the choice is shown to agents when they accept an invite.
  - **Recommendation:** C for the demo offices, with A pre-selected. The agent's own copy is guaranteed either way.
- **Question 2, data when a whole team leaves an office:** does the team take its data, or does the office keep it?
  - Option A: the team takes its data and the office keeps a copy of office-generated items.
  - Option B: the office keeps everything and the team gets an export.
  - **Recommendation:** A, and have it written into the customer agreement, since the software should enforce the contract, not invent it.
- **Joseph's answer:** (waiting)

## D-008 Invitation email must match the sign-in email
- **Status:** PENDING (not blocking; built the strict way for now, easy to loosen)
- **Question:** When someone opens an invitation link, must they sign in with the exact email address the invitation was sent to?
- **Option A (built now):** yes. A forwarded link does nothing for anyone else. If an agent wants to use a different address (for example a personal Gmail for "Sign in with Google"), the inviter resends the invitation to that address.
- **Option B:** anyone signed in who holds the link can accept it. Fewer support calls, but a forwarded or leaked link lets the wrong person into an office's data.
- **Recommendation:** A. It costs an occasional resend and protects every office's data.
- **Joseph's answer:** (waiting)

## D-009 Until invitation email is set up, may the inviter copy the link and send it themselves?
- **Status:** PENDING (not blocking other work; only matters if D-005 is not done before the demo office is set up)
- **Question:** Invitation emails need the email service (D-005). Until then, should the "invite someone" screen show the inviter the one-time join link so they can text or email it to the agent themselves?
- **Option A:** yes, show a "copy link" button after inviting, and also once D-005 is live as a backup. Safe because the link only works for the exact email it was sent to (D-008), expires in 7 days, and works once. Lets the demo office be set up even if email is late.
- **Option B:** no, links only ever go out by email. Simplest story, but nobody can join until D-005 is done.
- **Recommendation:** A. It removes D-005 from the demo's critical path at no real risk, given D-008.
- **Joseph's answer:** (waiting)

## D-010 Wording of the "ListApps support viewed your account" email
- **Status:** PENDING (not blocking; nothing is sent until D-005, and the draft is already built so only the words change)
- **Question:** When ListApps staff view someone's account, that person is emailed afterward (required by CLAUDE.md). Is this wording right? It is the first customer-facing email the platform sends.
- **Draft subject:** "ListApps support viewed your account" (or "ListApps support viewed and was allowed to change your account" if the session ever had permission to make changes)
- **Draft body:**
  - Hi Avery,
  - Sam Support from ListApps support viewed your ListApps account on Thursday, October 22, 2026, from 9:05 AM CDT to 9:40 AM CDT.
  - Reason given: Ticket 42: listing not showing
  - This was view only. Nothing in your account could be changed. (Or, if changes were allowed: "For part of this session they were allowed to make changes. Reason given for that: ... Every change is recorded.")
  - 3 actions were logged during the session.
  - ListApps staff can never export your contacts, change your password or email address, change your billing, or delete anything in your account.
  - If you did not expect this, contact ListApps support and we will walk you through exactly what was viewed.
  - ListApps
- **Sub-questions:**
  - Q1: Show the person the staff member's stated reason? Recommendation: yes. It is the most reassuring line in the email, and it makes staff write good reasons.
  - Q2: Show the staff member's real name, or just "ListApps support"? Recommendation: real name. It matches the promise that every access is accountable.
  - Q3: Where does "contact ListApps support" point (a support email address, or replies to this email)? Needs an address once D-005 is set up. Recommendation: a support@ address on the same sending domain.
- **Recommendation:** approve as drafted with Q1 and Q2 yes, and name the support address with D-005. Reply "D-010 approved" or send changes.
- **Joseph's answer:** (waiting)

## D-011 Wording of the invitation email
- **Status:** PENDING (not blocking; nothing is sent until D-005, and the draft is already built so only the words change)
- **Question:** Is this the right wording for the email an agent gets when they are invited into an office or team? It is the first email most agents will ever get from ListApps.
- **Draft subject:** "Olive Owner invited you to join The Daley Group on ListApps"
- **Draft body:**
  - Hi,
  - Olive Owner invited you to join The Daley Group on ListApps as a member.
  - Open this link to accept: (link)
  - The link works once, only for this email address (agent@example.com), and expires Thursday, October 29 at 10:00 AM CDT.
  - If this office has a policy on shared leads, you will see it before you join. Every contact you own stays yours if you ever leave.
  - If you were not expecting this, you can ignore this email. Nobody joins anything unless you open the link and accept.
  - ListApps
- **Sub-questions:**
  - Q1: Include the "every contact you own stays yours" promise in the invitation itself? Recommendation: yes. It is the product guarantee and the best first impression for an agent wary of a new platform.
  - Q2: Greet by name? We usually do not know the invited person's name yet, so "Hi," is the honest default. Recommendation: keep "Hi,".
- **Recommendation:** approve as drafted. Reply "D-011 approved" or send changes.
- **Joseph's answer:** (waiting)
