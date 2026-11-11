import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-form-parts";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getUser } from "@/lib/auth/guards";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: `Choose a new password for your ${siteConfig.name} account.`,
};

export default async function ResetPasswordPage() {
  // The emailed link lands here with a session already exchanged by the
  // confirm route. Without a session, there is nothing to update.
  const user = await getUser();

  if (!user) {
    return (
      <AuthCard
        title="Link required"
        description="This page is only reachable from the link in your reset email. Request a new link to continue."
        footer={
          <>
            Need a fresh link?{" "}
            <a
              href="/forgot-password"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Send another
            </a>
          </>
        }
      >
        <p className="text-sm leading-6 text-muted">
          Open the link from the password-reset email you received, or request a new one.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Set a new password for your account. You will stay signed in after updating."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
