import type { ShellDataSource } from "@/lib/services/app-shell";

/**
 * Sample data for the app shell until the Milestone 1 tables exist.
 * Deliberately generic: real customer names live only in seed files.
 */
export const SHELL_FIXTURE_USER_ID = "user-sample-agent";

export const shellFixture: ShellDataSource = {
  users: [{ id: SHELL_FIXTURE_USER_ID, fullName: "Sample Agent" }],
  accounts: [
    {
      id: "acct-brokerage",
      parentId: null,
      type: "brokerage",
      name: "Sample Brokerage",
    },
    {
      id: "acct-team",
      parentId: "acct-brokerage",
      type: "team",
      name: "Sample Team",
    },
    {
      id: "acct-individual",
      parentId: null,
      type: "individual",
      name: "Sample Agent",
    },
  ],
  memberships: [
    {
      accountId: "acct-team",
      userId: SHELL_FIXTURE_USER_ID,
      role: "member",
      isBrokerOfRecord: false,
      status: "active",
    },
    {
      accountId: "acct-individual",
      userId: SHELL_FIXTURE_USER_ID,
      role: "owner",
      isBrokerOfRecord: false,
      status: "active",
    },
  ],
  subscriptions: [
    {
      id: "sub-brokerage-openly",
      accountId: "acct-brokerage",
      applicationId: "app-openly",
      status: "active",
      trialEndsAt: null,
      includesDescendants: true,
      seatLimit: null,
      seatsUsed: 0,
    },
    {
      id: "sub-brokerage-listvault",
      accountId: "acct-brokerage",
      applicationId: "app-listvault",
      status: "active",
      trialEndsAt: null,
      includesDescendants: true,
      seatLimit: null,
      seatsUsed: 0,
    },
    {
      id: "sub-individual-curb",
      accountId: "acct-individual",
      applicationId: "app-curb",
      status: "active",
      trialEndsAt: null,
      includesDescendants: false,
      seatLimit: null,
      seatsUsed: 0,
    },
  ],
  applications: [
    {
      id: "app-openly",
      slug: "openly",
      name: "Openly",
      status: "available",
      sortOrder: 1,
    },
    {
      id: "app-listvault",
      slug: "listvault",
      name: "ListVault",
      status: "available",
      sortOrder: 2,
    },
    {
      id: "app-curb",
      slug: "curb",
      name: "Curb",
      status: "available",
      sortOrder: 3,
    },
    {
      id: "app-pulse",
      slug: "pulse",
      name: "Pulse",
      status: "coming_soon",
      sortOrder: 4,
    },
    {
      id: "app-trakkt",
      slug: "trakkt",
      name: "Trakkt",
      status: "coming_soon",
      sortOrder: 5,
    },
  ],
};
