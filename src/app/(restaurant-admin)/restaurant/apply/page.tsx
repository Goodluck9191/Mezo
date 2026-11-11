import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ApplyForRestaurantForm } from "@/components/restaurant/apply-for-restaurant-form";
import { Logo } from "@/components/shared/logo";
import { requireUser, membershipsWithRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apply for your restaurant",
  description: `Register your restaurant on ${siteConfig.name}.`,
};

export default async function RestaurantApplyPage() {
  const user = await requireUser("/restaurant/apply");

  const supabase = await createClient();
  const [{ data: existingApplication }, adminMemberships] = await Promise.all([
    supabase
      .from("restaurant_applications")
      .select(
        "id, status, rejection_reason, created_at, restaurant_id, restaurant:restaurants(name, slug)",
      )
      .eq("applicant_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    membershipsWithRole(user.id, ["restaurant_admin"]),
  ]);

  const ownedRestaurants = adminMemberships.length > 0;

  if (ownedRestaurants) {
    redirect("/restaurant/dashboard");
  }

  const application = existingApplication as unknown as {
    id: string;
    status: "pending" | "approved" | "rejected";
    rejection_reason: string | null;
    created_at: string;
    restaurant: { name: string; slug: string } | null;
  } | null;

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
      <div className="flex items-center gap-3">
        <Logo />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Restaurant onboarding
        </p>
      </div>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        Apply for your restaurant
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Tell us about your restaurant. Approval usually takes one business day. Once approved, you
        become the restaurant admin and can invite your team.
      </p>

      {application && application.status === "pending" ? (
        <section
          aria-labelledby="application-status"
          className="mt-8 rounded-3xl border border-border bg-surface-strong p-6 shadow-sm sm:p-8"
        >
          <h2 id="application-status" className="text-base font-semibold">
            Application status
          </h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            {application.restaurant ? (
              <div>
                <dt className="text-muted">Restaurant</dt>
                <dd className="mt-1 font-medium">{application.restaurant.name}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted">Submitted</dt>
              <dd className="mt-1 font-medium">
                {new Date(application.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Status</dt>
              <dd className="mt-1 font-medium">
                <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                  PENDING
                </span>
              </dd>
            </div>
          </dl>
        </section>
      ) : (
        <>
          {application?.status === "rejected" ? (
            <div
              role="alert"
              className="mt-8 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
            >
              <p className="font-medium">Your previous application was rejected.</p>
              {application.rejection_reason ? (
                <p className="mt-1">Reason: {application.rejection_reason}</p>
              ) : null}
              <p className="mt-1">You can submit a new application below.</p>
            </div>
          ) : null}
          <section className="mt-8 rounded-3xl border border-border bg-surface-strong p-6 shadow-sm sm:p-8">
            <ApplyForRestaurantForm />
          </section>
        </>
      )}
    </main>
  );
}
