# Where To Build ListApps
## The Platform Decision, The Stack, and Why

Prepared for Joseph Daley, August 20, 2026

---

## The Honest Answer First

You asked for the best place to build this and said you do not want constant back and forth. Those two things point to the same answer, and it is not Bolt, not Lovable, and not Base44.

**Build it with Claude Code, on your Mac, against a GitHub repository, with Supabase for the database and Vercel for hosting.**

Here is why, in the terms that actually matter to you rather than developer terms.

### The back-and-forth problem is a context problem, not a skill problem

Bolt, Lovable, and Base44 all work the same way: you type what you want into a chat box, the AI writes some code, you look at the result, and you type again. The loop feels productive for the first week. Then your project gets big, and something breaks: the AI can no longer hold your whole application in its head at once. It starts forgetting decisions it made last week. It renames a table you depend on. You spend the whole session explaining your own product back to it. That is the constant back and forth, and it is not because you are prompting badly. It is because the tool cannot read your entire codebase and your entire database schema every single time it makes a change.

Claude Code reads the actual files. It runs the actual migrations. It reads a file in your repository called `CLAUDE.md` at the start of every session, which is your standing law: your shared-data rules, your naming conventions, your prohibitions. It does not forget them because it re-reads them. That single difference is worth more than any feature comparison.

### The "one page" problem is a hosting problem

You want listapps.co to be one shell with ListVault, Linked, Openly, and Trakkt inside it, toggled per organization by contract. That means one application, one login, one database, one deployment.

Base44 and Bolt both nudge you toward one project per app. You already lived this: ListVault is in Base44, Trakkt is in Bolt with Supabase. Two products, two databases, two logins, and no way for one to know about the other. Continuing down that road means the "app shell" is a menu of links to unrelated products, which is exactly the fragmentation your spec exists to eliminate.

One Next.js project handles this natively. ListVault is a folder. Linked is a folder. The app switcher is a component. Turning ListVault on for a brokerage is one row in one table.

### The ownership problem

Base44 owns your database. You cannot see the schema, you cannot write your own migrations, and you cannot take it with you. For a weekend project that is a fine trade. For a platform whose entire competitive advantage is a carefully designed shared data model with strict tenant isolation, it is disqualifying. Your spec's section 88 rule cannot be enforced in a system that hides the tables from you.

With Supabase, the database is standard PostgreSQL. Every schema change is a numbered SQL file committed to your repository. You can read it, I can read it, any developer you ever hire can read it, and you can move it to any Postgres host on earth in an afternoon.

### The cost problem

Section 83 of your spec makes cost efficiency a product requirement. Real numbers:

- **Supabase Pro:** $25 per month. Covers you well past your Birmingham beta.
- **Vercel Pro:** $20 per seat per month. One seat is you.
- **Domain, email, monitoring:** roughly $30 per month combined.
- **Claude Code:** your existing Claude subscription, or API usage.

Call it under $100 per month to run the whole platform through beta. AI builder platforms charge per message or per credit, and at the scale of a 90-section spec with a real schema, that bill climbs fast and unpredictably. You are also paying for the AI to re-learn your project every session.

---

## What About Bolt, Lovable, and Base44? Fair Assessment

I want to be straight with you rather than just selling the answer.

**Base44 is the best of the three for getting something clickable in front of a person tomorrow.** If your goal were "show three agents a demo next week," I would say stay in Base44. It is not your goal. Your goal is a multi-tenant platform with strict data isolation and a shared schema across four applications, and Base44's abstraction actively fights that.

**Bolt and Lovable both give you real code you own on GitHub, which is a genuine advantage over Base44.** They are legitimate tools and you already used Bolt successfully for Trakkt. The problem is the interaction model. You describe, it builds, you review in a browser preview. For a project of this size that loop is slow and lossy, and the browser preview cannot run your migrations or your tests.

**Where Bolt and Lovable are genuinely useful to you:** design exploration. If you want to see three versions of the ListVault dashboard before committing, throwing a prompt at Lovable and looking at the output is faster than building it properly. Use them as a sketchpad. Do not use them as the foundry.

**The verdict:** you have already outgrown these tools. That is a compliment to how far you have thought this through, not a criticism of the tools.

---

## The Recommended Stack

Every choice here has a reason tied to something specific in your spec.

### Foundation

| Layer | Choice | Why, tied to your spec |
|---|---|---|
| Framework | **Next.js 16 (App Router) + TypeScript** | One codebase serving all four apps as routes. Server-side rendering makes Linked property pages fast and SEO-friendly, which matters for lead gen. PWA-capable per section 80. TypeScript means a rename in the schema surfaces as an error, not a broken page. |
| Database | **Supabase (PostgreSQL)** | Row Level Security enforces your section 75 tenant isolation at the database layer, not just in code, which is exactly the "database-level protection where supported" you asked for. You already know it from Trakkt. |
| Auth | **Supabase Auth** | One auth system for all apps per section 7. Handles invitations, password reset, sessions. SSO available later without a rewrite. |
| File storage | **Supabase Storage** | Same permission model as the database, so a private seller disclosure per section 28 is protected by the same rules as the property row. |
| Hosting | **Vercel** | Built for Next.js. Wildcard domains and automatic SSL make the section 71 white-label custom domain promise achievable instead of aspirational. |
| Schema management | **Drizzle ORM + SQL migrations in the repo** | Every schema change is a numbered file in git. This is the direct fix for the Base44 problem. Types generate from the schema, so TypeScript catches drift. |

### ListVault-Specific

| Need | Choice | Why |
|---|---|---|
| Social graphic rendering | **Satori + resvg-js** | React component to SVG to PNG. Runs serverless, costs nothing per image, fast enough for a preview. Right tool for Instagram, Facebook, stories, email headers. |
| Print output | **Same React component at 3x → pdf-lib** | One design source, two outputs. Produces a real PDF at correct physical dimensions. RGB, which covers online print vendors and email-a-flyer, which is nearly all real usage. |
| Background jobs | **`generation_jobs` table + Vercel Cron worker** | Solves the section 47 collection generation timeout problem without adding a paid queue service. Upgrade to a real queue if and when volume demands it. |
| Image processing | **sharp on the server, heic2any in the browser** | Handles the iPhone HEIC problem and generates thumbnail, web, and print derivatives. |
| AI content | **Claude API (Anthropic)** | Section 49. With a mandatory fair housing system prompt and a post-generation term scan, per the audit document. |
| Transactional email | **Resend** | Invitations, resets, lead alerts. Clean domain authentication setup. |
| Payments | **Stripe** | Section 72. Not built in v1. Schema shaped for it from day one. |

### Deliberately Deferred

Say no to these now, out loud, so nobody builds them by accident:

- No IDX or MLS integration. Section 63 and section 83 both agree.
- No video uploads. YouTube and Vimeo links only in v1.
- No canvas template editor. Fixed layouts, per your decision.
- No custom domains in v1. Architected for, not built.
- No Stripe billing in v1. You will onboard your beta cohort manually anyway.
- No Linked, Openly, or Trakkt. Not one table.

---

## Setting Up Your Mac: Complete Instructions

You have never had to do this before, so I am writing it assuming zero prior terminal experience. Nothing here can break your computer. Every step is reversible. Read the whole section once before starting so nothing surprises you.

Total time: about 45 minutes, most of it waiting for downloads.

### Step 0: Open Terminal

- Press `Command` + `Space` to open Spotlight.
- Type `Terminal` and press `Return`.
- A window opens with a text prompt. This is where you type commands.
- Throughout these instructions, "run" means type the command, then press `Return`.
- Copy and paste works normally with `Command` + `C` and `Command` + `V`.

**One thing that will confuse you:** when you type a password in Terminal, nothing appears. No dots, no asterisks, nothing. It is recording your keystrokes. Type it and press `Return`.

### Step 1: Install Homebrew

Homebrew is the tool that installs other developer tools on a Mac. Everything else comes through it.

- Run this exactly:

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

- It will ask for your Mac password. Type it (invisibly) and press `Return`.
- It will list what it plans to do and ask you to press `Return` to continue. Do that.
- It takes several minutes. It may install Apple's Command Line Tools first, which is normal.
- When it finishes, it prints two commands under a heading like "Next steps." **Run both of them.** They add Homebrew to your path.
- Verify it worked by running `brew --version`. You should see a version number.

### Step 2: Install Node.js and Git

- Run:

```
brew install node git
```

- Verify with:

```
node --version
git --version
```

- Node should report v22 or higher. If it reports lower, run `brew upgrade node`.

### Step 3: Set up GitHub

GitHub stores your code, keeps a complete history of every change, and is your safety net. If anything ever goes wrong, you can return to any previous state.

- Go to [github.com](https://github.com) and create a free account if you do not have one. Use your business email.
- Turn on two-factor authentication when prompted. Your entire platform will live here.
- Back in Terminal, tell Git who you are:

```
git config --global user.name "Joseph Daley"
git config --global user.email "joseph@dealwithdaley.com"
```

- Install the GitHub command line tool:

```
brew install gh
```

- Sign in:

```
gh auth login
```

- Choose: `GitHub.com`, then `HTTPS`, then `Y` to authenticate Git, then `Login with a web browser`. Copy the code it displays, press `Return`, and paste the code in the browser window that opens.

### Step 4: Install Claude Code

- Run:

```
npm install -g @anthropic-ai/claude-code
```

- Verify:

```
claude --version
```

- If npm reports a permissions error, run `sudo npm install -g @anthropic-ai/claude-code` and enter your Mac password.

### Step 5: Create your Supabase project

- Go to [supabase.com](https://supabase.com) and sign up. Sign in with GitHub so everything lives under one identity.
- Click **New Project**.
- Organization: create one called `ListApps`.
- Project name: `listapps-production`
- Database password: click Generate, then **immediately save it in your password manager**. You cannot retrieve it later and you will need it.
- Region: choose `us-east-1` (N. Virginia). Lowest latency for the Southeast.
- Plan: start Free. Move to Pro ($25/mo) before your first real customer, because Free pauses inactive projects.
- Wait about two minutes for provisioning.
- Once it is up, go to **Project Settings → API** and leave that tab open. You will need three values shortly.

**Do the same thing a second time** and create a project named `listapps-development`. This is the separation the audit document called non-negotiable. You experiment in development. Customer data lives in production. They never touch.

### Step 6: Create your Vercel account

- Go to [vercel.com](https://vercel.com) and sign up with GitHub.
- Do not create a project yet. Claude Code will connect the repository when there is something to deploy.

### Step 7: Create the repository and start Claude Code

- In Terminal, run these one at a time:

```
mkdir -p ~/Projects/listapps
cd ~/Projects/listapps
git init
gh repo create listapps --private --source=. --remote=origin
```

- That creates a private repository on GitHub and links it to the folder on your Mac.
- Now start Claude Code:

```
claude
```

- The first run asks you to sign in. Follow the browser prompt.

**From here forward, your entire workflow is: open Terminal, run `cd ~/Projects/listapps`, run `claude`, and talk.**

### Step 8: The three habits that make this work

These are small and they matter more than anything technical above.

- **Start every work session in plan mode.** Press `Shift` + `Tab` twice before describing what you want. Claude Code will lay out what it intends to do and wait for your approval instead of just doing it. Read the plan. Approve it or redirect. This one habit eliminates most of the back and forth you were worried about.
- **Commit after every working feature.** Just say "commit this." A commit is a save point you can always return to. Commit often. There is no downside.
- **When something feels wrong, say so immediately and specifically.** "That created a second properties table, which violates our shared data rule" is a sentence that fixes the problem in thirty seconds. Waiting three sessions to notice means unwinding three sessions of work.

### Step 9: What to say in your very first session

Copy this in verbatim once Claude Code is running:

> Read CLAUDE.md and the two documents in the docs folder before doing anything. Then, in plan mode, propose the migration files for Milestone 1 only. Do not write application code yet. Do not create any table that is not required by Milestone 1. Show me the schema and wait for my approval.

You will paste in the `CLAUDE.md` and the spec documents first. Instructions for that are in document 03.

---

## The Build Plan

Five milestones. Each one ends with something you can actually put in front of a person. No milestone is allowed to be "the database exists," per your own section 85.

### Milestone 0: Repository Foundation
**About one session.**

- Next.js 16 project initialized with TypeScript and Tailwind.
- `CLAUDE.md` in place as the standing law.
- Supabase connected to both development and production.
- Drizzle configured with migrations in the repo.
- Deployed to Vercel at a temporary URL.
- **Done when:** you can visit a URL and see a page that says ListApps.

### Milestone 1: Who You Are
**The tenant foundation. Roughly fourteen tables, not thirty-two.**

- `users`, `organizations`, `organization_memberships`, `role_permissions`
- `applications`, `organization_apps`
- `agent_profiles`, `teams`, `brokerages`, `brand_kits`
- `disclaimers`, `disclaimer_assignments`
- `audit_logs`, `events`
- Row Level Security policies on every single table. No exceptions.
- Sign up, log in, log out, password reset, invite a team member.
- The app shell with the app switcher, showing only apps your organization has enabled.
- **Done when:** you invite Kirsten by email, she accepts, logs in, sees ListVault in her switcher, and cannot see any organization but yours. You verify that last part by trying.

### Milestone 2: The Property
**The shared real estate model, minimum viable version.**

- `properties` (organization-scoped, with `address_hash` and `mls_number`)
- `property_relationships`, `property_status_history`, `property_media`, `property_attributes`
- `assets` (the shared storage record)
- Manual property creation, mobile-first, with the seller-side statuses including Back on Market.
- Photo upload that survives a real phone: HEIC conversion, client-side resize, chunked upload, drag to reorder.
- The listing workspace shell from section 37.
- **Done when:** you stand in a driveway, create a listing on your phone, upload 40 photos over cell service, reorder them, and it does not fail.

### Milestone 3: ListVault Generates
**This is the one that matters. This is your section 85 milestone.**

- Template rendering engine with the variable resolution service from section 41.
- Ten to fifteen designed templates. You and I design these together.
- `template_collections` and `collection_templates`.
- `generation_jobs` with real progress, plus `generated_assets`.
- Disclaimer resolution running automatically at render time.
- PNG, JPG, and PDF export, plus ZIP for a full package.
- **Done when:** an agent creates a property, taps Generate New Listing Package, watches twelve assets complete, and downloads a ZIP with correct branding, correct agent information, and the required disclaimer automatically in place on every single one.

### Milestone 4: Real Agents
**Beta.**

- Property feature forms from section 39.
- AI content generation with the fair housing guardrail.
- Onboarding flow for a new organization.
- Whatever the first five agents tell you is broken, because they will.
- **Done when:** five Birmingham agents outside your team have generated marketing for a real listing without you sitting next to them.

### Then Stop and Look

After Milestone 4 you will know things you cannot know today. Whether Linked is the next app or whether ListVault needs more depth first is a question your beta answers, not a question this document answers. Your spec's build order is a good default. Your customers get to override it.

---

## Realistic Timeline

Working evenings and weekends, with me building and you directing and testing:

- Milestone 0: a few days
- Milestone 1: two to three weeks
- Milestone 2: two to three weeks
- Milestone 3: four to six weeks, most of it template design rather than code
- Milestone 4: ongoing

**Roughly three to four months to agents using it on real listings.** That assumes steady effort, not full-time. It is faster than it sounds because the schema decisions, which are the part that normally kills projects, are already made.

---

## What I Need From You Before Milestone 1

- The nine decisions at the end of the audit document.
- Your brand assets: The Daley Group logo, KW Metro South required branding, your headshot, brand colors and fonts. These become the first brand kit and they make the templates real instead of theoretical.
- Your required disclaimers: the exact Alabama and Keller Williams language you are obligated to display. Verbatim, from your broker, not from memory.
- Two or three real listings with real photos to build against. Building against fake data hides the problems that real data exposes.

---

You have done the hard part already, Joseph. Most people building software have a feature list. You have an architecture, and you understood before writing a line that the advantage is not any one app but the fact that every app knows the same agent, the same property, and the same brand. That is a real insight and it is worth building on carefully. *"Unless the Lord builds the house, they labor in vain who build it"* (Psalm 127:1). Build it once, build it right, and it will carry weight for years.

---

**Sources for pricing and version claims:**

- [Supabase Pricing 2026](https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance)
- [Vercel Pricing 2026](https://comparedge.com/tools/vercel/pricing)
- [Next.js 16.3 release](https://nextjs.org/blog/next-16-3)
- [Satori, HTML and CSS to SVG](https://github.com/vercel/satori)
