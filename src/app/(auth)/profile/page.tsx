import type { Metadata } from "next";

import { signOut } from "@/app/actions/auth";
import { requireUser, getMemberships } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EditProfileForm } from "@/components/auth/edit-profile-form";
import { ROLE_LABELS } from "@/lib/security/roles";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your profile",
  description: `Manage your ${siteConfig.name} profile and restaurant memberships.`,
};

export default async function ProfilePage() {
  const sessionUser = await requireUser("/profile");

  const supabase = await createClient();
  const [{ data: profile }, memberships] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, avatar_url, created_at")
      .eq("id", sessionUser.id)
      .maybeSingle(),
    getMemberships(sessionUser.id),
  ]);

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex items-center gap-3">
        <Logo />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your account</p>
      </div>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Your profile</h1>

      <section
        aria-labelledby="profile-section"
        className="mt-6 rounded-3xl border border-border bg-surface-strong p-6 shadow-sm sm:p-8"
      >
        <h2 id="profile-section" className="text-base font-semibold">
          Account details
        </h2>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Email</dt>
            <dd className="mt-1 font-medium">{sessionUser.email ?? "Not available"}</dd>
          </div>
          <div>
            <dt className="text-muted">Member since</dt>
            <dd className="mt-1 font-medium">
              {profile?.created_at
                ? new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(new Date(profile.created_at))
                : "Not available"}
            </dd>
          </div>
        </dl>

        <div className="mt-6 border-t border-border pt-6">
          <EditProfileForm
            initialFullName={profile?.full_name ?? ""}
            initialPhone={profile?.phone ?? ""}
            initialAvatarUrl={profile?.avatar_url ?? ""}
          />
        </div>
      </section>

      <section
        aria-labelledby="memberships-section"
        className="mt-8 rounded-3xl border border-border bg-surface-strong p-6 shadow-sm sm:p-8"
      >
        <h2 id="memberships-section" className="text-base font-semibold">
          Restaurant memberships
        </h2>
        {memberships.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            You are not a staff member of any restaurant yet. Register a restaurant or wait for an
            invitation.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {memberships.map((membership) => (
              <li
                key={membership.restaurantId}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="font-medium">{membership.restaurant.name}</p>
                  <p className="text-xs text-muted">/{membership.restaurant.slug}</p>
                </div>
                <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  {ROLE_LABELS[membership.role]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 flex justify-end">
        <form action={signOut}>
          <button type="submit" className={cn(buttonVariants({ variant: "secondary" }))}>
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
