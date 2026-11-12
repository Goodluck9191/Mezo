import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  ArrowRightIcon,
  ClipboardListIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/icons";
import {
  StatusBadge,
  WorkspaceHeading,
  WorkspaceShell,
} from "@/components/restaurant/workspace-shell";
import { requireWorkspace, toShellMemberships } from "@/lib/restaurant";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
  description: `Configure your restaurant on ${siteConfig.name}.`,
};

function SettingCard({
  href,
  icon,
  title,
  description,
  meta,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  meta?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3 rounded-3xl border border-border bg-surface-strong p-5 shadow-sm transition-colors",
        "hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {meta}
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
      </span>
      <ArrowRightIcon className="ml-auto mt-1 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function DisabledCard({
  icon,
  title,
  description,
  badge,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <div
      aria-disabled="true"
      className="flex items-start gap-3 rounded-3xl border border-dashed border-border bg-surface p-5"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-strong text-muted">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="rounded-full bg-surface-strong px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {badge}
          </span>
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
      </span>
    </div>
  );
}

export default async function RestaurantSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const workspace = await requireWorkspace(searchParams, "/restaurant/settings");
  const { restaurant, memberships, user } = workspace;
  const suffix = `?restaurant=${encodeURIComponent(restaurant.slug)}`;

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
      active="settings"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <WorkspaceHeading
          eyebrow="Settings"
          title="Restaurant settings"
          description="Manage how your restaurant appears and who can operate it. Platform-controlled fields are shown read-only."
        />

        <section aria-label="Settings sections" className="grid gap-4 sm:grid-cols-2">
          <SettingCard
            href={`/restaurant/settings/profile${suffix}`}
            icon={<ClipboardListIcon className="size-5" />}
            title="Restaurant profile"
            description="Name, description, logo, contact details and address."
          />
          <SettingCard
            href={`/restaurant/settings/staff${suffix}`}
            icon={<UsersIcon className="size-5" />}
            title="Staff management"
            description="Invite waiters and kitchen staff, review members, revoke invites."
          />
          <SettingCard
            href={`/restaurant/settings/profile${suffix}#platform`}
            icon={<ShieldCheckIcon className="size-5" />}
            title="Approval & subscription"
            description="Read-only. Only the platform can change approval or subscription state."
            meta={
              <StatusBadge tone={restaurant.applicationStatus === "approved" ? "green" : "amber"}>
                {restaurant.applicationStatus}
              </StatusBadge>
            }
          />
          <DisabledCard
            icon={<QrCodeIcon className="size-5" />}
            title="Menu, tables & QR codes"
            description="Menu management and QR code generation arrive with the ordering phase."
            badge="Phase 6"
          />
          <SettingCard
            href={`/restaurant/billing${suffix}`}
            icon={<WalletIcon className="size-5" />}
            title="Subscription & billing"
            description="Your plan, table limit, usage, status and payment history."
          />
          <DisabledCard
            icon={<ClipboardListIcon className="size-5" />}
            title="Notifications"
            description="Email and SMS notifications arrive with later platform work."
            badge="Later phase"
          />
        </section>
      </div>
    </WorkspaceShell>
  );
}
