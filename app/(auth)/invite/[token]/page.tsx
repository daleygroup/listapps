import Link from "next/link";
import { Suspense } from "react";
import {
  AcceptInviteForm,
  CreateAccountForm,
} from "@/components/auth/accept-invite-forms";
import { authConfigFromProcess } from "@/lib/auth/config";
import {
  inviteView,
  maskEmail,
  roleLabel,
  tokenFromParam,
} from "@/lib/auth/invite-view";
import { SIGN_IN_PATH } from "@/lib/auth/routes";
import { getAuthUser } from "@/lib/auth/supabase-server";
import { getServerSql } from "@/lib/db/server";
import { acceptPath, previewInvitation } from "@/lib/services/invitations";

export const metadata = { title: "Your invitation | ListApps" };

type Params = Promise<{ token: string }>;

export default function InvitePage({ params }: { params: Params }) {
  return (
    <>
      <h1 className="text-2xl font-semibold">Your invitation</h1>
      <Suspense fallback={<p className="text-sm text-ink-muted">Loading...</p>}>
        <InviteBody params={params} />
      </Suspense>
    </>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface-muted p-4 text-sm">
      {children}
    </div>
  );
}

async function InviteBody({ params }: { params: Params }) {
  const rawToken = tokenFromParam((await params).token);
  const sql = getServerSql();
  const configured = authConfigFromProcess().configured && sql !== null;
  const preview =
    configured && rawToken
      ? await previewInvitation(sql!, { token: rawToken })
      : null;
  const user = configured && preview ? await getAuthUser() : null;
  const view = inviteView({
    configured,
    preview,
    signedInEmail: user?.email ?? null,
  });

  switch (view.kind) {
    case "not-configured":
      return (
        <Notice>
          <p>Invitations are not set up yet on this copy of ListApps.</p>
        </Notice>
      );
    case "invalid":
      return (
        <Notice>
          <p>
            This invitation link is not valid. It may have been replaced by a
            newer one or withdrawn. Ask the person who invited you to send it
            again.
          </p>
        </Notice>
      );
    case "used":
      return (
        <Notice>
          <p>This invitation to {view.accountName} has already been used.</p>
          <Link href={SIGN_IN_PATH} className="text-primary">
            Go to sign in
          </Link>
        </Notice>
      );
    case "expired":
      return (
        <Notice>
          <p>
            This invitation to {view.accountName} has expired. Ask the person
            who invited you to send a new one.
          </p>
        </Notice>
      );
    case "wrong-email":
      return (
        <Notice>
          <p>
            This invitation to {view.accountName} was sent to{" "}
            {view.maskedInvitedEmail}, but you are signed in as{" "}
            {view.signedInEmail}.
          </p>
          <p>
            Sign out, then open this link again and sign in with the address the
            invitation was sent to.
          </p>
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="min-h-tap text-primary">
              Sign out
            </button>
          </form>
        </Notice>
      );
    case "accept":
      return (
        <div className="flex flex-col gap-section">
          <Summary preview={view.preview} />
          <AcceptInviteForm
            token={rawToken ?? ""}
            accountName={view.preview.accountName}
            contactPolicy={view.preview.contactRetentionPolicy}
          />
        </div>
      );
    case "sign-in-or-create": {
      const back = `${SIGN_IN_PATH}?next=${encodeURIComponent(acceptPath(rawToken ?? ""))}`;
      return (
        <div className="flex flex-col gap-section">
          <Summary preview={view.preview} />
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold">Already use ListApps?</h2>
            <Link
              href={back}
              className="flex h-tap items-center justify-center rounded-control border border-border bg-surface px-4 font-semibold"
            >
              Sign in to accept
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold">New to ListApps?</h2>
            <p className="text-sm text-ink-muted">
              You will sign in as {maskEmail(view.preview.invitedEmail)}, the
              address this invitation was sent to.
            </p>
            <CreateAccountForm
              token={rawToken ?? ""}
              accountName={view.preview.accountName}
              contactPolicy={view.preview.contactRetentionPolicy}
            />
          </div>
        </div>
      );
    }
  }
}

function Summary({
  preview,
}: {
  preview: {
    accountName: string;
    role: "owner" | "admin" | "member";
    inviterName: string | null;
    expiresAt: Date | null;
  };
}) {
  return (
    <p>
      {preview.inviterName ?? "Someone"} invited you to join{" "}
      <strong>{preview.accountName}</strong> as {roleLabel(preview.role)}.
      {preview.expiresAt
        ? ` This link works until ${preview.expiresAt.toLocaleDateString("en-US", { dateStyle: "long" })}.`
        : null}
    </p>
  );
}
