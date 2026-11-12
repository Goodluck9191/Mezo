"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";

/**
 * Workspace-level error boundary. An async failure inside any restaurant
 * workspace page renders here instead of leaving a skeleton behind forever.
 */
export default function RestaurantWorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("restaurant workspace render failed", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <Logo />
      </header>
      <main
        id="main"
        className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Something went wrong
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">We could not load this page</h1>
        <p className="text-sm leading-6 text-muted">
          Mezo ran into an unexpected problem while loading the workspace. Your data is safe;
          nothing was changed. Try again, and if it keeps happening contact support with the
          reference below.
        </p>
        <p className="rounded-xl border border-border bg-surface px-4 py-2 font-mono text-[11px] text-muted">
          ref: {error?.digest ?? "unavailable"}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className={buttonVariants({ variant: "primary" })}
          >
            Try again
          </button>
          <Link href="/restaurant/dashboard" className={buttonVariants({ variant: "secondary" })}>
            Back to dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
