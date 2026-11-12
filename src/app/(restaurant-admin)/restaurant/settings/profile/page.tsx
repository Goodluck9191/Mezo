import type { Metadata } from "next";

import { ShieldCheckIcon } from "@/components/ui/icons";
import { ProfileForm } from "@/components/restaurant/profile-form";
import {
  Panel,
  StatusBadge,
  WorkspaceHeading,
  WorkspaceShell,
} from "@/components/restaurant/workspace-shell";
import { requireWorkspace, toShellMemberships } from "@/lib/restaurant";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Restaurant profile",
  description: `Edit your restaurant's public profile on ${siteConfig.name}.`,
};

export default async function RestaurantProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const workspace = await requireWorkspace(searchParams, "/restaurant/settings/profile");
  const { restaurant, memberships, user } = workspace;

  const isApproved = restaurant.applicationStatus === "approved";
  const createdDate = new Date(restaurant.createdAt).toLocaleDateString("en-TZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
      active="profile"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <WorkspaceHeading
          eyebrow="Settings / Profile"
          title="Restaurant profile"
          description="These details are shown to customers and used by the platform review team. Fields below marked read-only are controlled by the platform."
        />

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Editable profile"
            description="Save as you go — a failed save keeps your entries in the form."
          >
            <ProfileForm
              restaurant={{
                id: restaurant.id,
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
              }}
            />
          </Panel>

          <div className="space-y-5">
            <Panel
              id="platform"
              title="Controlled by the platform"
              description="Visible here, editable elsewhere."
            >
              <dl className="space-y-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <dt className="text-muted">Web address</dt>
                  <dd className="font-mono text-xs text-foreground">/{restaurant.slug}</dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <dt className="text-muted">Application</dt>
                  <dd>
                    {isApproved ? (
                      <StatusBadge tone="green">Approved</StatusBadge>
                    ) : (
                      <StatusBadge tone="amber">{restaurant.applicationStatus}</StatusBadge>
                    )}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <dt className="text-muted">Operations</dt>
                  <dd>
                    {restaurant.operationalStatus === "active" ? (
                      <StatusBadge tone="green">Active</StatusBadge>
                    ) : (
                      <StatusBadge tone="amber">{restaurant.operationalStatus}</StatusBadge>
                    )}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <dt className="text-muted">Subscription</dt>
                  <dd className="text-foreground">
                    {restaurant.subscriptionStatus.replace(/_/g, " ")}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-muted">Member since</dt>
                  <dd className="text-foreground">{createdDate}</dd>
                </div>
              </dl>
              <p className="mt-4 flex items-start gap-2 rounded-2xl bg-surface p-3 text-xs leading-5 text-muted">
                <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-accent" />
                Only Mezo platform administrators can change approval, operational or subscription
                state. If you need a change, reply to the email from the platform team.
              </p>
            </Panel>

            <Panel title="Good to know">
              <ul className="list-disc space-y-2 pl-5 text-xs leading-5 text-muted marker:text-accent">
                <li>Customers only ever see approved, active restaurants.</li>
                <li>Your logo must be under 2 MB and in a web image format.</li>
                <li>The web address (slug) is fixed at approval time.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
