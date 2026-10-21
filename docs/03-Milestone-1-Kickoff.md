# Milestone 1 Kickoff
## Getting these documents into your repository and running your first real session

Prepared for Joseph Daley, August 20, 2026

---

## Part 1: Put the documents where Claude Code can read them

Once you have finished the Mac setup in document 02, do this. It takes five minutes and it is what makes every future session sharp instead of vague.

- Download the four files I sent you: `CLAUDE.md`, `01-Spec-Audit-Holes-and-Decisions.md`, `02-Where-To-Build-And-Why.md`, and `03-Milestone-1-Kickoff.md`.
- Open Terminal and run:

```
cd ~/Projects/listapps
mkdir -p docs/spec docs/audit
open .
```

- A Finder window opens showing your project folder. Now drag files in:
  - `CLAUDE.md` goes in the **top level** of the folder. Not in a subfolder. This location is what makes Claude Code read it automatically.
  - `01-Spec-Audit-Holes-and-Decisions.md` goes in `docs/audit/`.
  - `02-Where-To-Build-And-Why.md` and `03-Milestone-1-Kickoff.md` go in `docs/`.
- Take your original 90-section specification, save it as a text or Markdown file named `listapps-master-spec.md`, and put it in `docs/spec/`.
- Back in Terminal, save all of it to GitHub:

```
git add .
git commit -m "Add product specification, architectural audit, and project instructions"
git push -u origin main
```

That last command uploads everything to GitHub. From now on, your documents are versioned, backed up, and readable by any session.

---

## Part 2: Answer the nine decisions

Before Milestone 1 schema gets written, I need the nine answers from the end of the audit document. You can answer them right in our chat and I will fold them into `CLAUDE.md`.

- [ ] **Property ownership.** Confirm organization-scoped rows plus canonical matching keys plus explicit cross-org shares.
- [ ] **Agent departure.** Confirm the profile-follows-person, data-stays-with-organization split.
- [ ] **Role collapse.** Confirm five org roles plus a permissions table, separate platform staff table, two lock states instead of six.
- [ ] **Print promise.** "A good PDF you can print or upload to a vendor," or commercial press files?
- [ ] **Video.** Links only in v1, or real uploads?
- [ ] **Openly and money.** Coordination only, or does it ever touch compensation?
- [ ] **Trakkt naming.** Analytics layer, or your existing inventory product?
- [ ] **Echo.** Alive, absorbed into the integration layer, or dead?
- [ ] **Beta cohort.** How many agents, and roughly when?

---

## Part 3: Gather the real material

Milestone 3 lives or dies on this, and gathering it takes calendar time because some of it comes from other people. Start now.

### Brand assets
- [ ] The Daley Group logo, in the highest resolution you have, both a light version and a dark version.
- [ ] Keller Williams Metro South required logo files, in whatever format KW mandates.
- [ ] Your professional headshot, high resolution.
- [ ] Your brand colors, as hex codes, not "that blue."
- [ ] Your brand fonts, with the actual font files if you have licenses for them.
- [ ] Your tagline and the exact contact block you want on marketing.

### Required disclaimers
Get these **verbatim from your broker**, not from memory and not from an old flyer. This is the part where being off by a word matters.

- [ ] Alabama license disclosure language.
- [ ] Keller Williams required advertising language.
- [ ] Equal Housing Opportunity requirements, including whether the logo is mandatory and at what minimum size.
- [ ] Team name disclosure requirements. Alabama has specific rules about team names in advertising.
- [ ] Any KW Metro South office-specific requirements.
- [ ] Ask your broker directly: is there anything else that must appear on a listing graphic or flyer?

### Real listings
- [ ] Two or three actual listings, ideally one active, one sold, and one coming soon.
- [ ] Full photo sets, straight off the camera or phone, not cleaned up. I want the messy version because the messy version is what exposes bugs.
- [ ] The real MLS data for each.

### Marketing you already produce
- [ ] Five to ten examples of listing graphics you or your team have actually made and are proud of. These become the design targets for the fixed templates.
- [ ] Any flyer or brochure layout you currently use.

---

## Part 4: What your first three sessions should look like

### Session 1: Foundation
Say:

> Read CLAUDE.md and everything in docs/. Then, in plan mode, set up the Next.js 16 project with TypeScript, Tailwind, Drizzle, and Supabase connections for both development and production. Do not create any database tables yet. Deploy to Vercel when it builds.

Expected outcome: a live URL. Nothing on it but a page. That is correct and it is a real milestone.

### Session 2: Schema
Say:

> In plan mode, propose the complete Milestone 1 schema as Drizzle migration files. Fourteen tables maximum. Every table gets RLS. Show me the schema and the RLS policies in plain language before writing any file, and explain what each table is for in one sentence a non-developer would understand.

Read the plan carefully. This is the most consequential half hour of the entire project. Ask about anything you do not understand. There are no dumb questions about your own database.

### Session 3: Authentication and the shell
Say:

> Build authentication and the app shell for Milestone 1: sign up, log in, log out, password reset, invite a team member by email, and the app switcher showing only the applications this organization has enabled. Commit when it works.

Then test it yourself. Sign up. Invite Kirsten. Have her accept from her own computer. Then try to break the isolation on purpose and confirm you cannot.

---

## Part 5: Warning signs to watch for

You will not be able to review code, and you do not need to. You can review behavior. These are the specific things to watch for, and saying any of these sentences out loud to Claude Code will fix the problem immediately.

- **A table appears with an app prefix on a shared entity.** Say: "That violates the shared data rule in CLAUDE.md. Why is this not a shared table?"
- **Scope creep.** If you asked for authentication and it starts building property forms, say: "That is Milestone 2. Stop and finish Milestone 1."
- **A table without RLS.** Say: "Confirm RLS is enabled with an explicit policy on every table in this migration."
- **The word "later" attached to security.** Security is never later. Say: "Do it now or explain why it is safe not to."
- **Anything hardcoded to Birmingham, Alabama, KW, or The Daley Group outside a seed file.** Say: "That is a customer detail in platform logic. Make it data."
- **A long session with no commits.** Say: "Commit what works before continuing."

---

## Part 6: The definition of done for Milestone 1

Do not accept Milestone 1 as complete until you personally verify all of these:

- [ ] You can sign up a brand new account from scratch.
- [ ] You can create an organization.
- [ ] You can invite someone by email and they receive an actual email.
- [ ] They can accept, set a password, and log in.
- [ ] You can assign them a role and the role changes what they can do.
- [ ] You can enable and disable ListVault for the organization and the app switcher changes accordingly.
- [ ] You can create a second test organization and confirm that a user in one cannot see anything in the other. **Actually try it. Do not take anyone's word for it.**
- [ ] You can enter your brokerage information and a brand kit and see it saved.
- [ ] You can enter a required disclaimer at the brokerage level.
- [ ] Password reset works end to end.
- [ ] It all works on your phone.
- [ ] Every schema change is a committed migration file you can see on GitHub.

When every box is checked, update section 12 of `CLAUDE.md` to Milestone 2 and keep going.

---

## One last thing

The most common way projects like this die is not technical failure. It is drift: a hundred small "while we're in here" decisions that slowly turn a clear plan into a pile. `CLAUDE.md` and the milestone definitions exist specifically to prevent that, and they only work if you enforce them. When something is out of scope, say so. When something violates a rule, name the rule.

You are the product owner here, Joseph. Not the developer. That is the right job for you and it is the one that determines whether this works.
