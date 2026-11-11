import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export function AuthField({
  label,
  htmlFor,
  error,
  children,
  hint,
  required,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between gap-4 text-sm font-medium text-foreground"
      >
        <span>
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-1 text-muted">
              *
            </span>
          ) : null}
        </span>
        {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
    >
      {message}
    </div>
  );
}

export function FormSuccessBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm leading-6 text-accent"
    >
      {message}
    </div>
  );
}

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="auth-title"
      className="w-full max-w-md rounded-3xl border border-border bg-surface-strong p-6 shadow-sm sm:p-8"
    >
      <h1 id="auth-title" className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? <p className="mt-2 text-sm leading-6 text-muted">{description}</p> : null}
      <div className="mt-6">{children}</div>
      {footer ? (
        <div className="mt-6 border-t border-border pt-5 text-sm text-muted">{footer}</div>
      ) : null}
    </section>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(4,120,87,0.14),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.10),transparent_60%)]"
      />
      <div className={cn("flex w-full flex-col items-center")}>{children}</div>
    </div>
  );
}
