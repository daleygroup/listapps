# Milestone 1 hand check

The steps Joseph clicks through to confirm Milestone 1 ("Who You Are") is really done. Automated tests prove the rules; this proves the product.

- **Where:** the `listapps-development` site, never production.
- **When:** after backlog items M1-4 through M1-9 are finished. Until then, some screens below do not exist yet.
- **You need:** a phone, a laptop, and three email inboxes you can open (yours plus two test inboxes, for example Gmail "plus" addresses like `joseph+kirsten@...`).
- **How to record it:** tick each box. If anything surprises you, write one line under the step and the next build run will pick it up.

---

## 1. The tree exists

- [ ] Sign in as the ListApps owner (you).
- [ ] Open **Accounts**. You see **KW Metro South** (brokerage) with **The Daley Group** (team) beneath it.
- [ ] You also see a second, unrelated test brokerage (the seed script names it **Test Brokerage Two**).

## 2. Invitations work end to end

- [ ] As the team owner, open The Daley Group, choose **Invite**, enter test inbox 1, role **Admin**.
- [ ] Invite test inbox 2, role **Member**.
- [ ] Open test inbox 1. The email arrives, the link opens a sign-up page, and after creating a password you land inside ListApps showing "The Daley Group" in the header.
- [ ] Do the same for test inbox 2 on your **phone**. Every button is reachable with one thumb.
- [ ] Try the same invitation link a second time. It is refused (links are single-use).
- [ ] Sign out and sign back in with **Sign in with Google** on one of the test accounts.

## 3. A brokerage purchase flows down

- [ ] As the ListApps owner, give **KW Metro South** a **ListVault** subscription with **Includes everyone beneath** turned on.
- [ ] Signed in as the team admin, open the app switcher. **ListVault** is there.
- [ ] Signed in as the team member, open the app switcher. **ListVault** is there too.

## 4. An agent's own purchase works alongside it

- [ ] As the ListApps owner, give the team member's **personal account** a **Curb** subscription.
- [ ] Signed in as the team member, the switcher shows **ListVault and Curb**.
- [ ] Signed in as the team admin, the switcher shows **ListVault only**.

## 5. The second brokerage is invisible (actually try it)

- [ ] Signed in as the team member, look for anything belonging to Test Brokerage Two: account list, people, search. Nothing appears.
- [ ] Copy the web address of a Test Brokerage Two page (you can get one while signed in as the ListApps owner) and paste it into the team member's browser. You see "not found", not the page.
- [ ] Repeat both checks as the team admin.
- [ ] Signed in as the team member, try to open KW Metro South's other teams, if any. Not visible.

## 6. Support can log in as someone, visibly and on the record

- [ ] Sign in as a **support** staff test account. Find the team member and choose **View as this person**. You are asked for a reason; enter one.
- [ ] A banner across the top says you are viewing as that person. There is no way to close it, on every page, on phone and laptop.
- [ ] Try to change the person's email or password, export contacts, or delete anything. Each is refused.
- [ ] End the session. Open the team member's inbox: an email says who viewed their account, when, and why.
- [ ] As the ListApps owner, open the **Impersonation log**. The session is listed with the reason and start and end times.

## 7. Removing someone is a hand-off, not a delete

- [ ] As the team owner, remove the team member.
- [ ] Immediately, in the team member's still-open browser, refresh. They no longer see The Daley Group or its apps. Their personal Curb subscription still works.
- [ ] As the team owner, you see a **hand-off list** for that person, with each item defaulting to you.
- [ ] Accept the defaults. The hand-off log shows each item, from whom, to whom, who accepted, and when.
- [ ] The team member still appears in the team's history as **Removed**. Nothing was deleted.

---

## When every box is ticked

Reply "Milestone 1 verified" and the next build run marks it complete and starts the Milestone 2 proposal (lightweight listings for Openly).
