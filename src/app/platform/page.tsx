import type { Metadata } from "next";

import { Logo } from "@/components/shared/logo";
import { ApplicationReviewForm } from "@/components/platform/application-review-form";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Platform administration",
  description: `Platform administration for ${siteConfig.name}.`,
};

export default async function PlatformPage() {
  await requirePlatformAdmin("/");

  const supabase = await createClient();

  const [pending, plansResponse] = await Promise.all([
    supabase
      .from("restaurant_applications")
      .select(
        "id, status, rejection_reason, created_at, applicant_name, applicant_phone, message, restaurant:restaurants(name, slug)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(25),
    supabase
      .from("subscription_plans")
      .select("id, code, name, table_limit, price_tzs")
      .eq("is_active", true),
  ]);

  const applications = (pending.data ?? []) as unknown as Array<{
    id: string;
    status: "pending";
    created_at: string;
    applicant_name: string | null;
    applicant_phone: string | null;
    message: string | null;
    restaurant: { name: string; slug: string } | null;
  }>;

  const plans = (plansResponse.data ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    table_limit: number;
    price_tzs: number;
  }>;

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
      <div className="flex items-center gap-3">
        <Logo />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Platform administration
        </p>
      </div>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        Restaurant applications
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Review applications submitted to {siteConfig.name}. Approvals create the restaurant&apos;s
        first admin, activate the plan, and open ordering. All other roles live inside each
        restaurant.
      </p>

      <section className="mt-6 rounded-3xl border border-border bg-surface-strong p-6 shadow-sm sm:p-8">
        <h2 className="text-base font-semibold">
          Applications awaiting review ({applications.length})
        </h2>

        {applications.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            Nothing waiting. Applications appear here in the order they arrive.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {applications.map((application) => (
              <li key={application.id} className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">
                      {application.restaurant?.name ?? "Unknown restaurant"}
                    </p>
                    <p className="text-xs text-muted">
                      /{application.restaurant?.slug ?? "no-slug"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Submitted{" "}
                      {new Date(application.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    {application.applicant_name || application.applicant_phone ? (
                      <p className="mt-1 text-xs text-muted">
                        {application.applicant_name ?? "—"} ·{" "}
                        {application.applicant_phone ?? "no phone"}
                      </p>
                    ) : null}
                  </div>
                </div>

                {application.message ? (
                  <blockquote className="mt-3 rounded-xl bg-surface px-4 py-3 text-sm leading-6 text-muted">
                    {application.message}
                  </blockquote>
                ) : null}

                <div className="mt-4 border-t border-border pt-4">
                  <ApplicationReviewForm
                    applicationId={application.id}
                    restaurantName={application.restaurant?.name ?? "this restaurant"}
                    plans={plans}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
