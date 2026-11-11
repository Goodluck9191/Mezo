import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth/guards";
import { AuthCard } from "@/components/auth/auth-form-parts";
import { SignInForm } from "@/components/auth/sign-in-form";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to your ${siteConfig.name} account.`,
};

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

const errorMessages: Record<string, string> = {
  "invalid-link": "That link is invalid or has expired. Sign in or request a new one.",
  "session-expired": "Your session expired. Sign in again to continue.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const user = await getUser();

  if (user) {
    redirect("/restaurant/dashboard");
  }

  const params = await searchParams;
  const next = first(params.next);
  const error = errorMessages[first(params.error) ?? ""];

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in with the email and password you registered with."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          {error}
        </p>
      ) : null}
      <SignInForm next={next} />
    </AuthCard>
  );
}
