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
