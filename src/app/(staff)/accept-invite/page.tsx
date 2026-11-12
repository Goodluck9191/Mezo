import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard, AuthShell } from "@/components/auth/auth-form-parts";
import { AcceptInvitationForm } from "@/components/staff/accept-invitation-form";
import { requireUser } from "@/lib/auth/guards";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accept invitation",
  description: `Join a restaurant team on ${siteConfig.name}.`,
  // One-time tokens belong on this page: never index it, never follow its links.
  robots: { index: false, follow: false },
};

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const initialToken = token && token.trim().length > 0 ? token.trim() : null;

  // Signed-out users go to login and come straight back here afterwards.
  await requireUser(
    initialToken ? `/accept-invite?token=${encodeURIComponent(initialToken)}` : "/accept-invite",
  );

  return (
    <AuthShell>
      <AuthCard
        title="Accept your invitation"
        description="You were invited to staff a restaurant on Mezo. Confirm the code below to join. It works once and expires after 7 days."
        footer={
          <span>
            Not expecting this?{" "}
            <Link href="/" className="font-medium text-accent hover:underline">
              Return home
            </Link>
          </span>
        }
      >
        <AcceptInvitationForm initialToken={initialToken} />
      </AuthCard>
    </AuthShell>
  );
}
