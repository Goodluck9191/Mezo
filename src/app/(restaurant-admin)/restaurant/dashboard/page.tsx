import type { Metadata } from "next";
import Link from "next/link";

import {
  ArrowRightIcon,
  ClipboardListIcon,
  QrCodeIcon,
  UsersIcon,
  UtensilsIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/restaurant/empty-state";
import {
  Panel,
  QuickActionLink,
  StatusBadge,
  WorkspaceHeading,
  WorkspaceShell,
} from "@/components/restaurant/workspace-shell";
import {
  requireWorkspace,
  getInvitationsForRestaurant,
  getStaffForRestaurant,
  summarizeStaff,
  toShellMemberships,
} from "@/lib/restaurant";
import { getRestaurantSubscriptionView } from "@/lib/subscription";
import { statusLabel, usageLabel } from "@/lib/subscriptions-shared";
import { computeProfileCompletion } from "@/lib/profile-completion";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Restaurant dashboard",
  description: `Manage your restaurant on ${siteConfig.name}.`,
};

export default async function RestaurantDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const workspace = await requireWorkspace(searchParams, "/restaurant/dashboard");
  const { restaurant, memberships, user } = workspace;

  const [staff, invitations, subscriptionView] = await Promise.all([
    getStaffForRestaurant(restaurant.id),
    getInvitationsForRestaurant(restaurant.id),
    getRestaurantSubscriptionView(restaurant.id),
  ]);
  const staffSummary = summarizeStaff(staff);
  const pendingInvites = invitations.filter((invite) => invite.status === "pending").length;
  const subscription = subscriptionView.subscription;

  const completion = computeProfileCompletion({
    name: restaurant.name,
    description: restaurant.description,
    logoUrl: restaurant.logoUrl,
    contactEmail: restaurant.contactEmail,
    contactPhone: restaurant.contactPhone,
    addressLine1: restaurant.addressLine1,
    addressLine2: restaurant.addressLine2,
    city: restaurant.city,
    region: restaurant.region,
    countryCode: restaurant.countryCode,
  });

  const isApproved = restaurant.applicationStatus === "approved";
  const isActive = restaurant.operationalStatus === "active";
  const profileComplete = completion.percent === 100;

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
      active="dashboard"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <WorkspaceHeading
          eyebrow="Restaurant workspace"
          title={restaurant.name}
          description="Your restaurant at a glance: approval state, profile readiness, and the people who work here."
          icon={
            restaurant.logoUrl ? (
              <span className="block size-full overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={restaurant.logoUrl} alt="" className="size-full object-cover" />
              </span>
            ) : (
              <UtensilsIcon />
            )
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          {isApproved ? (
            <StatusBadge tone="green">Approved</StatusBadge>
          ) : restaurant.applicationStatus === "pending" ? (
            <StatusBadge tone="amber">Awaiting review</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Application {restaurant.applicationStatus}</StatusBadge>
          )}
          {isActive ? (
            <StatusBadge tone="green">Open for business</StatusBadge>
          ) : (
            <StatusBadge tone="amber">Not accepting orders yet</StatusBadge>
          )}
          {subscription ? (
            <StatusBadge
              tone={
                subscription.status === "active"
                  ? "green"
                  : subscription.status === "past_due" || subscription.status === "expired"
                    ? "amber"
                    : "neutral"
              }
            >
              Subscription: {statusLabel(subscription.status)}
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Subscription: pending</StatusBadge>
          )}
        </div>

        {subscription ? (
          <Link
            href={`/restaurant/billing?restaurant=${encodeURIComponent(restaurant.slug)}`}
            className={cn(
              "group flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-surface-strong p-4 shadow-sm transition-colors",
              "hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            )}
          >
            <span className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
                <WalletIcon className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {subscription.plan.name} — {statusLabel(subscription.status)}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">
                  {usageLabel(subscription.usedTables, subscription.tableLimit)}
                  {subscription.renewsOn ? (
                    <>
                      {" "}
                      · renews{" "}
                      {new Date(subscription.renewsOn).toLocaleDateString("en-TZ", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </>
                  ) : null}
                </span>
              </span>
            </span>
            <span className="flex items-center gap-2 text-xs font-semibold text-muted transition-colors group-hover:text-accent">
              Subscription & billing
              <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ) : null}

        {!isApproved ? (
          <p
            role="status"
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
          >
            Your application is with the Mezo team. You can already prepare the profile below;
            approval unlocks your public presence.
          </p>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-3">
          {/* Profile completion */}
          <Panel
            className="xl:col-span-2"
            title="Profile completion"
            description="A complete profile helps the Mezo team approve you faster and gives customers the details they need."
            actions={
              <Link
                href={`/restaurant/settings/profile?restaurant=${encodeURIComponent(restaurant.slug)}`}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              >
                Edit profile
                <ArrowRightIcon className="size-4" />
              </Link>
            }
          >
            <div className="flex flex-wrap items-center gap-6">
              <div
                role="progressbar"
                aria-valuenow={completion.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Profile completeness"
                className="grid size-20 shrink-0 place-items-center rounded-3xl bg-accent/10"
              >
                <span className="text-xl font-semibold tabular-nums text-accent">
                  {completion.percent}%
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${completion.percent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {completion.completed} of {completion.total} details provided.
                </p>
                {profileComplete ? (
                  <p className="mt-2 text-sm font-medium text-accent">
                    Profile complete — nice work.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {completion.missing.slice(0, 4).map((item) => (
                      <li
                        key={item.key}
                        className="rounded-full bg-surface px-3 py-1 text-[11px] font-medium text-muted"
                      >
                        Missing: {item.label}
                      </li>
                    ))}
                    {completion.missing.length > 4 ? (
                      <li className="rounded-full bg-surface px-3 py-1 text-[11px] font-medium text-muted">
                        +{completion.missing.length - 4} more
                      </li>
                    ) : null}
                  </ul>
                )}
              </div>
            </div>
          </Panel>

          {/* Staff overview */}
          <Panel
            title="Staff"
            description="Who works at this restaurant today."
            actions={
              <Link
                href={`/restaurant/settings/staff?restaurant=${encodeURIComponent(restaurant.slug)}`}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              >
                Manage
              </Link>
            }
          >
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl bg-surface p-3">
                <dt className="text-xs text-muted">Active members</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {staffSummary.active}
                </dd>
              </div>
              <div className="rounded-2xl bg-surface p-3">
                <dt className="text-xs text-muted">Pending invites</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {pendingInvites}
                </dd>
              </div>
              <div className="rounded-2xl bg-surface p-3">
                <dt className="text-xs text-muted">Waiting staff</dt>
                <dd className="mt-1 font-semibold tabular-nums text-foreground">
                  {staffSummary.waiters}
                </dd>
              </div>
              <div className="rounded-2xl bg-surface p-3">
                <dt className="text-xs text-muted">Kitchen</dt>
                <dd className="mt-1 font-semibold tabular-nums text-foreground">
                  {staffSummary.kitchen}
                </dd>
              </div>
            </dl>
            {staffSummary.active <= 1 ? (
              <p className="mt-3 text-xs leading-5 text-muted">
                You are the only active member. Invite your team from{" "}
                <Link
                  href={`/restaurant/settings/staff?restaurant=${encodeURIComponent(restaurant.slug)}`}
                  className="font-medium text-accent hover:underline"
                >
                  Staff settings
                </Link>
                .
              </p>
            ) : null}
          </Panel>
        </div>

        {/* Quick actions */}
        <section aria-label="Quick actions" className="grid gap-3 sm:grid-cols-3">
          <QuickActionLink
            href={`/restaurant/settings/profile?restaurant=${encodeURIComponent(restaurant.slug)}`}
            title="Edit restaurant profile"
            description="Name, logo, contact details and address."
            icon={<ClipboardListIcon className="size-5" />}
          />
          <QuickActionLink
            href={`/restaurant/onboarding?restaurant=${encodeURIComponent(restaurant.slug)}`}
            title="Onboarding checklist"
            description="Track approval and what to finish next."
            icon={<QrCodeIcon className="size-5" />}
          />
          <QuickActionLink
            href={`/restaurant/settings/staff?restaurant=${encodeURIComponent(restaurant.slug)}`}
            title="Invite your team"
            description="Add waiters and kitchen staff to this restaurant."
            icon={<UsersIcon className="size-5" />}
          />
        </section>

        {/* Honest empty states */}
        <Panel
          title="Coming in later phases"
          description="Not built yet — no data is fabricated here."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <EmptyState
              icon={<ClipboardListIcon className="size-5" />}
              title="Orders — Coming in Phase 6"
              description="Live orders from tables will appear here once customer ordering ships."
            />
            <EmptyState
              icon={<QrCodeIcon className="size-5" />}
              title="QR codes — Coming in a later phase"
              description="Printable per-table QR codes arrive with the customer ordering phase."
            />
            <EmptyState
              icon={<WalletIcon className="size-5" />}
              title="Revenue — Coming in a later phase"
              description="Payments and payouts are handled by a later billing phase; no figures exist yet."
            />
            <EmptyState
              icon={<UsersIcon className="size-5" />}
              title="Menu management — Coming in Phase 6"
              description="Categories and items will be managed here starting with the menu phase."
            />
          </div>
        </Panel>
      </div>
    </WorkspaceShell>
  );
}
