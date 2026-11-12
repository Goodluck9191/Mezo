"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { ArrowRightIcon, CloseIcon, MenuIcon } from "@/components/ui/icons";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/utils/cn";
import { siteConfig } from "@/lib/site";
import { signOut } from "@/app/actions/auth";
import { ROLE_LABELS } from "@/lib/security/roles";

export interface WorkspaceMembership {
  restaurantId: string;
  slug: string;
  name: string;
  role: string;
}

const NAV_SECTIONS: ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{ key: string; label: string; href: string }>;
}> = [
  {
    label: "Workspace",
    items: [
      { key: "dashboard", label: "Dashboard", href: "/restaurant/dashboard" },
      { key: "onboarding", label: "Onboarding", href: "/restaurant/onboarding" },
    ],
  },
  {
    label: "Settings",
    items: [
      { key: "settings", label: "Overview", href: "/restaurant/settings" },
      { key: "profile", label: "Restaurant profile", href: "/restaurant/settings/profile" },
      { key: "staff", label: "Staff", href: "/restaurant/settings/staff" },
    ],
  },
];

export type WorkspaceActive = "dashboard" | "onboarding" | "settings" | "profile" | "staff";

export function WorkspaceShell({
  userEmail,
  restaurant,
  memberships,
  active,
  children,
}: {
  userEmail: string | null;
  restaurant: WorkspaceMembership;
  memberships: readonly WorkspaceMembership[];
  active: WorkspaceActive;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const switchRestaurant = (slug: string) => {
    if (slug === restaurant.slug) return;
    router.replace(`${pathname}?restaurant=${encodeURIComponent(slug)}`);
    setNavOpen(false);
  };

  const currentLabel =
    NAV_SECTIONS.flatMap((section) => section.items).find((item) => item.key === active)?.label ??
    "Workspace";

  const nav = (
    <nav aria-label="Restaurant workspace" className="flex flex-1 flex-col gap-6">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {section.label}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {section.items.map((item) => {
              const isActive = item.key === active;
              return (
                <li key={item.key}>
                  <Link
                    href={`${item.href}?restaurant=${encodeURIComponent(restaurant.slug)}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setNavOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      isActive ? "bg-accent/10 text-accent" : "text-foreground hover:bg-surface",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const identityBlock = (
    <div className="rounded-2xl border border-border bg-surface p-3">
      {memberships.length > 1 ? (
        <>
          <label
            htmlFor="restaurant-switcher"
            className="block px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
          >
            Restaurant
          </label>
          <select
            id="restaurant-switcher"
            value={restaurant.slug}
            onChange={(event) => switchRestaurant(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-border bg-surface-strong px-3 text-sm text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {memberships.map((membership) => (
              <option key={membership.restaurantId} value={membership.slug}>
                {membership.name}
              </option>
            ))}
          </select>
        </>
      ) : (
        <div className="px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Restaurant
          </p>
          <p className="mt-1 text-sm font-semibold leading-5 text-foreground">{restaurant.name}</p>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border px-1 pt-2">
        <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
          {ROLE_LABELS[restaurant.role as keyof typeof ROLE_LABELS] ?? "Staff"}
        </span>
        <form action={signOut}>
          <button
            type="submit"
            className="text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
      {userEmail ? (
        <p className="mt-1 truncate px-1 text-[11px] text-muted" title={userEmail}>
          {userEmail}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-accent-foreground"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col gap-6 border-r border-border bg-surface-strong px-4 py-6 lg:flex">
        <Logo className="px-1" />
        {identityBlock}
        {nav}
        <p className="px-3 text-[11px] leading-4 text-muted">{siteConfig.tagline}</p>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          aria-expanded={navOpen}
          aria-controls="workspace-mobile-nav"
          aria-label={navOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setNavOpen((value) => !value)}
          className="grid size-11 place-items-center rounded-xl border border-border text-foreground transition-colors hover:bg-surface"
        >
          {navOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </header>

      {/* Mobile panel */}
      {navOpen ? (
        <div
          id="workspace-mobile-nav"
          className="fixed inset-x-0 top-[4.25rem] z-20 max-h-[calc(100dvh-4.25rem)] overflow-y-auto border-b border-border bg-background px-4 py-4 shadow-lg lg:hidden"
        >
          <div className="flex flex-col gap-4">
            {identityBlock}
            {nav}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-72">
        {/* Breadcrumb bar (desktop chrome above content) */}
        <div className="hidden border-b border-border px-8 py-3 lg:flex lg:items-center lg:gap-2 lg:text-sm">
          <Link href="/" className="text-muted transition-colors hover:text-foreground">
            Mezo
          </Link>
          <span aria-hidden="true" className="text-muted">
            /
          </span>
          <Link
            href="/restaurant/dashboard"
            className="text-muted transition-colors hover:text-foreground"
          >
            {restaurant.name}
          </Link>
          <span aria-hidden="true" className="text-muted">
            /
          </span>
          <span aria-current="page" className="font-medium text-foreground">
            {currentLabel}
          </span>
        </div>

        <main id="main" className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Small presentational helpers shared by workspace pages. */
export function WorkspaceHeading({
  icon,
  title,
  description,
  eyebrow,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
            {icon}
          </div>
        ) : null}
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{description}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-3xl border border-border bg-surface-strong p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={title ? "mt-4" : undefined}>{children}</div>
    </section>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "neutral";
  children: ReactNode;
}) {
  const styles = {
    green: "bg-accent/10 text-accent",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
    neutral: "bg-surface text-muted",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        styles[tone],
      )}
    >
      {children}
    </span>
  );
}

export function QuickActionLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors",
        "hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      {icon ? (
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted">{description}</span>
      </span>
      <ArrowRightIcon className="ml-auto mt-1 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
