# Sign-in setup (for when D-004 is done)

The sign-in code is in the repo and switched off until a Supabase project exists. With no Supabase settings, the app behaves exactly as before: sample data, no sign-in.

## What turns it on
Add these to the build environment (never commit them):
- `NEXT_PUBLIC_SUPABASE_URL`: the `listapps-development` project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: its anon (public) key
- `LISTAPPS_SITE_URL` (optional): the site address, for example `https://dev.listapps.co`, so emailed links always point there

The service role key is never given a `NEXT_PUBLIC_` name. The app refuses to start if it is.

## Supabase settings Joseph (or a live session with him) sets once
- Authentication, Sign In / Providers: email on; **"Allow new users to sign up" off**. People join by invitation only, so neither the email form nor Google can create a stray account.
- Google provider: on, with a Google Cloud OAuth client using the basic scopes only (email, profile). No Gmail scopes.
- URL configuration: add `<site>/auth/callback` to the redirect allow list.
- Email templates: Supabase's built-in sender is fine for testing; customer email waits on D-005.

## How it works
- `proxy.ts` refreshes the session on every page and sends signed-out people to `/sign-in`, remembering where they were going (same-site paths only).
- `/sign-in`: email and password, or "Sign in with Google". There is no sign-up page.
- `/forgot-password` emails a link; the answer is the same whether or not the address has an account.
- `/auth/callback` finishes Google sign-in and reset links; `/reset-password` sets the new password.
- Sign-out is a POST to `/auth/sign-out`.
- A new sign-in creates the matching `users` row automatically (database trigger from migration 0002).
- The proxy is a convenience gate only. Every action re-checks the user, and Row Level Security backs that up.
