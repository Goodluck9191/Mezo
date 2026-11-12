import type { Metadata } from "next";
import Link from "next/link";

import { UsersIcon } from "@/components/ui/icons";
import {
  Panel,
  StatusBadge,
  WorkspaceHeading,
  WorkspaceShell,
} from "@/components/restaurant/workspace-shell";
import {
  DeactivateMemberButton,
  RevokeInvitationButton,
} from "@/components/restaurant/staff-actions";
import { InviteStaffForm } from "@/components/restaurant/invite-staff-form";
import {
  getInvitationsForRestaurant,
  getStaffForRestaurant,
  requireWorkspace,
  toShellMemberships,
} from "@/lib/restaurant";
import { getServerEnv } from "@/lib/env/server";
import { siteConfig } from "@/lib/site";
import { ROLE_LABELS } from "@/lib/security/roles";
import { cn } from "@/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff",
  description: `Manage staff access for your restaurant on ${siteConfig.name}.`,
};

function roleBadge(role: string) {
  const classes = {
    restaurant_admin: "bg-accent/10 text-accent",
    waiter: "bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300",
    kitchen: "bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-300",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        classes[role as keyof typeof classes] ?? "bg-surface text-muted",
      )}
    >
      {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
    </span>
  );
}

export default async function RestaurantStaffSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const workspace = await requireWorkspace(searchParams, "/restaurant/settings/staff");
  const { restaurant, memberships, user } = workspace;

  const [staff, invitations] = await Promise.all([
    getStaffForRestaurant(restaurant.id),
    getInvitationsForRestaurant(restaurant.id),
  ]);

  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
  const activeMembers = staff.filter((member) => member.isActive);
  const inactiveMembers = staff.filter((member) => !member.isActive);

  return (
    <WorkspaceShell
      userEmail={user.email}
      restaurant={{
        restaurantId: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
        role: workspace.membership.role,
      }}
      memberships={toShellMemberships(memberships)}
      active="staff"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <WorkspaceHeading
          eyebrow="Settings / Staff"
          title="Staff management"
          description="Invite waiters and kitchen staff to this restaurant, review who has access, and revoke invitations you no longer want to honour. Administrators cannot change their own role here."
          icon={<UsersIcon />}
        />

        <p
          role="status"
          className="rounded-2xl border border-border bg-surface px-4 py-3 text-xs leading-5 text-muted"
        >
          Invitations are not emailed from this environment. After you create one, copy the one-time
          link and deliver it to the person yourself. Each link works once and expires in 7 days.
        </p>

        <Panel
          title="Invite someone"
          description="They will join this restaurant — and only this restaurant."
        >
          <InviteStaffForm restaurantId={restaurant.id} appUrl={appUrl} />
        </Panel>

        <Panel
          title={`Members (${activeMembers.length} active${inactiveMembers.length > 0 ? `, ${inactiveMembers.length} deactivated` : ""})`}
          description="Active members can sign in to this restaurant's consoles. Deactivation takes effect immediately."
        >
          {staff.length === 0 ? (
            <p className="text-sm text-muted">
              No members yet — that should not happen as an administrator. Try refreshing the page.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Name
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Role
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Member since
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => {
                    const isSelf = member.userId === user.id;
                    const displayName = member.fullName ?? "Unnamed staff member";

                    return (
                      <tr key={member.memberId} className="border-b border-border/60 last:border-0">
                        <td className="py-3 pr-4 font-medium text-foreground">
                          {displayName}
                          {isSelf ? (
                            <span className="ml-2 inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                              You
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4">{roleBadge(member.role)}</td>
                        <td className="py-3 pr-4">
                          {member.isActive ? (
                            <StatusBadge tone="green">Active</StatusBadge>
                          ) : (
                            <StatusBadge tone="neutral">Deactivated</StatusBadge>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted">
                          {new Date(member.memberSince).toLocaleDateString("en-TZ", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 text-right">
                          {member.isActive && !isSelf ? (
                            <DeactivateMemberButton
                              restaurantId={restaurant.id}
                              memberId={member.memberId}
                              memberName={displayName}
                            />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Invitations"
          description="Single-use links issued by you or another administrator. Pending invitations can be revoked at any time."
        >
          {invitations.length === 0 ? (
            <p className="text-sm leading-6 text-muted">
              No invitations yet. Create the first one above and deliver the link to your teammate.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Email
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Role
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Expires
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((invite) => {
                    const statusClasses: Record<string, string> = {
                      pending:
                        "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
                      accepted: "bg-accent/10 text-accent",
                      revoked: "bg-surface text-muted",
                      expired: "bg-surface text-muted",
                    };

                    return (
                      <tr key={invite.id} className="border-b border-border/60 last:border-0">
                        <td className="py-3 pr-4 font-medium text-foreground">{invite.email}</td>
                        <td className="py-3 pr-4">{roleBadge(invite.role)}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
                              statusClasses[invite.status] ?? "bg-surface text-muted",
                            )}
                          >
                            {invite.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted">
                          {new Date(invite.expires_at).toLocaleDateString("en-TZ", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 text-right">
                          {invite.status === "pending" ? (
                            <RevokeInvitationButton
                              restaurantId={restaurant.id}
                              invitationId={invite.id}
                              inviteeEmail={invite.email}
                            />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <p className="text-center text-xs leading-5 text-muted">
          Staff access is scoped to this restaurant only. To manage restaurants you administer,{" "}
          <Link href="/restaurant/dashboard" className="font-medium text-accent hover:underline">
            switch from the dashboard
          </Link>
          .
        </p>
      </div>
    </WorkspaceShell>
  );
}
