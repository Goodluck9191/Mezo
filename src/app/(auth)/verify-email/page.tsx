import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-form-parts";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Check your inbox",
  description: `Verify your ${siteConfig.name} account.`,
};

export default function VerifyEmailPage() {
  return (
    <AuthCard
      title="Check your inbox"
      description="We sent a verification link to your email address. Open it to activate your account."
      footer={
        <>
          Wrong account?{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Start over
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <p className="text-sm leading-6 text-muted">
          Didn&apos;t get the email? Check your spam or promotions folder — or request a new one
          below.
        </p>
        <ResendConfirmationForm />
      </div>
    </AuthCard>
  );
}
