import type { Metadata } from "next";
import Link from "next/link";

import { CheckIcon, SparklesIcon, UsersIcon } from "@/components/ui/icons";
import {
  Panel,
  QuickActionLink,
  StatusBadge,
  WorkspaceHeading,
  WorkspaceShell,
} from "@/components/restaurant/workspace-shell";
import {
  getStaffForRestaurant,
  requireWorkspace,
  summarizeStaff,
  toShellMemberships,
} from "@/lib/restaurant";
import { getRestaurantSubscriptionView } from "@/lib/subscription";
import { computeProfileCompletion } from "@/lib/profile-completion";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Onboarding",
  description: `Finish setting up your restaurant on ${siteConfig.name}.`,
};

export default async function RestaurantOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const workspace = await requireWorkspace(searchParams, "/restaurant/onboarding");
  const { restaurant, memberships, user } = workspace;

  const staff = await getStaffForRestaurant(restaurant.id);
  const staffSummary = summarizeStaff(staff);
  const { subscription } = await getRestaurantSubscriptionView(restaurant.id);

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
  const profileDone = completion.percent === 100;
  const teamDone = staffSummary.active > 1;

  const steps: Array<{
    label: string;
    detail: string;
    done: boolean;
    href?: string;
    locked?: string;
  }> = [
    {
      label: "Submit your application",
      detail: isApproved
        ? "Approved by the Mezo team."
        : "In review — the platform team will approve or request changes.",
      done: isApproved,
    },
    {
      label: "Complete your restaurant profile",
      detail: profileDone
        ? "Every detail is filled in."
        : `${completion.percent}% complete — ${completion.missing.length} item${completion.missing.length === 1 ? "" : "s"} left.`,
      done: profileDone,
      href: `/restaurant/settings/profile?restaurant=${encodeURIComponent(restaurant.slug)}`,
    },
    {
      label: "Invite your staff (optional)",
      detail: teamDone
        ? `${staffSummary.active - 1} teammate${staffSummary.active - 1 === 1 ? "" : "s"} onboard. You can keep going.`
        : "Invite waiters and kitchen staff when you are ready.",
      done: teamDone,
      href: `/restaurant/settings/staff?restaurant=${encodeURIComponent(restaurant.slug)}`,
    },
    {
      label: "Menu, tables and QR codes",
      detail: "Planned for Phase 6 — customer ordering ships there.",
      done: false,
      locked: "Phase 6",
    },
    {
      label: "Subscription and billing",
      detail:
        subscription?.status === "active"
          ? "On an active plan — usage and renewal dates live on the billing page."
          : "Your subscription is pending. The platform activates it on approval.",
      done: subscription?.status === "active",
      href: `/restaurant/billing?restaurant=${encodeURIComponent(restaurant.slug)}`,
    },
  ];

  const completedCount = steps.filter((step) => step.done).length;

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
      active="onboarding"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <WorkspaceHeading
          eyebrow="Onboarding"
          title="Get ready to serve"
          description="A quick, honest checklist from application to opening day. Steps marked with a phase are not built yet and will unlock then."
          icon={<SparklesIcon />}
        />

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <StatusBadge tone={isApproved ? "green" : "amber"}>
            {isApproved ? "Application approved" : "Awaiting approval"}
          </StatusBadge>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {completedCount} of {steps.length} steps complete
          </span>
        </div>

        <ol className="space-y-3">
          {steps.map((step, index) => {
            const stepBody = (
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-2xl border text-sm font-semibold",
                    step.done
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-border bg-surface text-muted",
                  )}
                >
                  {step.done ? <CheckIcon className="size-5" /> : index + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{step.label}</span>
                    {step.locked ? (
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {step.locked}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted">{step.detail}</span>
                </span>
              </div>
            );

            return (
              <li
                key={step.label}
                className={cn(
                  "rounded-3xl border bg-surface-strong p-4 shadow-sm sm:p-5",
                  step.done ? "border-accent/30" : "border-border",
                )}
              >
                {step.href ? (
                  <Link
                    href={step.href}
                    className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {stepBody}
                  </Link>
                ) : (
                  stepBody
                )}
              </li>
            );
          })}
        </ol>

        <Panel title="When the menu phase lands">
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickActionLink
              href={`/restaurant/settings/profile?restaurant=${encodeURIComponent(restaurant.slug)}`}
              title="Review your profile now"
              description="The menu, QR and ordering phases will read from this same information."
              icon={<CheckIcon className="size-5" />}
            />
            <QuickActionLink
              href={`/restaurant/settings/staff?restaurant=${encodeURIComponent(restaurant.slug)}`}
              title="Get your team ready"
              description="Everyone you invite now is ready for the ordering phase on day one."
              icon={<UsersIcon className="size-5" />}
            />
          </div>
        </Panel>

        <p className="text-center text-xs leading-5 text-muted">
          Something wrong? Reply to the confirmation email from the Mezo team or reach support from
          the address that sent you your application receipt.
        </p>
      </div>
    </WorkspaceShell>
  );
}
