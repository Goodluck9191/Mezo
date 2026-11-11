import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth/guards";
import { AuthCard } from "@/components/auth/auth-form-parts";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your account",
  description: `Create your ${siteConfig.name} account.`,
};

export default async function RegisterPage() {
  const user = await getUser();

  if (user) {
    redirect("/restaurant/dashboard");
  }

  return (
    <AuthCard
      title="Create your account"
      description="One account for your restaurant. We will send you a verification link."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
