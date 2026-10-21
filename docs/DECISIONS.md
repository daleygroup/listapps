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
- **Status:** PENDING (proposal not written yet; see STATUS M1-1)
- Approve the 17-table Milestone 1 schema in `docs/proposals/001-milestone-1-schema.md` before any migration is written.

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
