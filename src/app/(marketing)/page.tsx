import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  ArrowRightIcon,
  CheckIcon,
  ClipboardListIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { ROLE_LABELS, type Role } from "@/lib/security/roles";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

const features = [
  {
    icon: QrCodeIcon,
    title: "A QR code for every table",
    description:
      "Each table gets its own printable code. Guests open the menu in the browser — no app and no account.",
  },
  {
    icon: UsersIcon,
    title: "Waiter-approved sessions",
    description:
      "Ordering unlocks only after a staff member opens the table, so guests are seated before the kitchen is involved.",
  },
  {
    icon: ClipboardListIcon,
    title: "One live order board",
    description: "Waiters and kitchen staff work from the same order status, updated in real time.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Server-side pricing",
    description:
      "The server reads menu prices and calculates every total. The browser never decides what a meal costs.",
  },
  {
    icon: WalletIcon,
    title: "Mobile money payments",
    description:
      "Designed around mobile money, with payment status tracked separately from order status.",
  },
  {
    icon: SparklesIcon,
    title: "Plans by table count",
    description:
      "Plans scale with the number of tables you operate, with limits enforced on the backend.",
  },
] as const;

const steps = [
  {
    title: "Scan the table code",
    description:
      "A guest scans the QR code on the table and lands on the restaurant’s menu, ready to browse.",
  },
  {
    title: "A waiter opens the session",
    description:
      "One approval from the floor activates the table, allowing everyone seated there to order.",
  },
  {
    title: "Order, track, and pay",
    description:
      "The kitchen receives the order, guests follow its status, and payment is handled separately.",
  },
] as const;

const roles: readonly { role: Role; description: string }[] = [
  {
    role: "platform_admin",
    description:
      "Reviews restaurant applications and manages platform access, outside any restaurant.",
  },
  {
    role: "restaurant_admin",
    description: "Menu, tables, staff, orders, reports, and the restaurant subscription.",
  },
  {
    role: "waiter",
    description: "Open and close tables, approve guests, and request the bill.",
  },
  {
    role: "kitchen",
    description: "A focused board that only moves orders from placed to ready.",
  },
];

const heroHighlights = ["No guest app", "Waiter-controlled ordering", "Mobile-first"] as const;

export default function HomePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] bg-[radial-gradient(ellipse_at_top,rgba(4,120,87,0.14),transparent_62%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.12),transparent_62%)]"
        />

        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-accent">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              {siteConfig.tagline}
            </span>

            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Turn every table into a faster, calmer service.
            </h1>

            <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted sm:text-lg">
              {siteConfig.name} gives your guests a QR menu, keeps ordering under waiter control,
              and brings the floor, kitchen, and bill into one clear flow.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="#how-it-works" className={buttonVariants({ size: "lg" })}>
                See how it works
                <ArrowRightIcon className="size-4" />
              </Link>
              <Link
                href="#features"
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                Explore features
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {heroHighlights.map((highlight) => (
                <li key={highlight} className="flex items-center gap-1.5">
                  <CheckIcon className="size-4 text-accent" />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:mx-0">
            <div
              aria-hidden="true"
              className="absolute -inset-6 rounded-[2.5rem] bg-accent/10 blur-2xl"
            />

            <div
              aria-hidden="true"
              className="relative rounded-3xl border border-border bg-surface-strong p-3 shadow-xl shadow-neutral-950/5"
            >
              <div className="rounded-2xl border border-border bg-background">
                <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted">Table 12</p>
                    <p className="mt-0.5 text-sm font-medium">Dine-in session</p>
                  </div>
                  <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                    Active
                  </span>
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted">1× Chicken pilau</span>
                    <span className="font-medium tabular-nums">TZS 12,000</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted">1× Passion juice</span>
                    <span className="font-medium tabular-nums">TZS 3,500</span>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-border pt-4 text-sm font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">TZS 15,500</span>
                  </div>

                  <div className="flex gap-2.5 rounded-xl bg-surface p-3 text-xs leading-5 text-muted">
                    <ShieldCheckIcon className="mt-0.5 size-4 text-accent" />
                    Prices and totals are calculated on the server.
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-muted">Product preview · sample data</p>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 border-t border-border bg-surface/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-accent">Platform</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything the floor needs, in one flow.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              A tenant-aware foundation for menus, table sessions, orders, and payments — built for
              the pace of a busy dining room.
            </p>
          </div>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <li
                  key={feature.title}
                  className="rounded-2xl border border-border bg-surface-strong p-6 transition-colors hover:border-accent/40"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent">
                    <Icon />
                  </span>
                  <h3 className="mt-5 text-base font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{feature.description}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-accent">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Three steps from table to kitchen.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              The table stays in control of the restaurant. Guests only order once a staff member
              has confirmed they are seated.
            </p>
          </div>

          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-border bg-surface-strong p-6"
              >
                <span className="font-mono text-xs font-medium text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="for-restaurants" className="scroll-mt-24 border-y border-border bg-surface/40">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center lg:px-8">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-accent">For restaurants</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Built for the people running the room.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Every role sees only what it needs. Restaurant admins run the business, waiters keep
              service moving, and the kitchen gets a clear queue. Platform admins stay outside the
              restaurant and are the only ones who can approve, reject, or suspend an application.
            </p>
            <Link
              href="#get-started"
              className={cn(buttonVariants({ variant: "secondary" }), "mt-8")}
            >
              Early access
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface-strong">
            {roles.map((role) => (
              <li
                key={role.role}
                className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <span className="font-medium">{ROLE_LABELS[role.role]}</span>
                <span className="text-sm leading-6 text-muted sm:text-right">
                  {role.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="get-started" className="scroll-mt-24">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-accent px-6 py-12 text-accent-foreground sm:px-10 sm:py-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/10 blur-2xl"
            />

            <div className="relative max-w-2xl">
              <p className="text-sm font-medium text-accent-foreground">Early access</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Ready to make service feel lighter?
              </h2>
              <p className="mt-4 text-base leading-7 text-accent-foreground">
                We are preparing onboarding for a small group of dine-in restaurants in Tanzania.
                Explore the product direction today; applications open in a later phase.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="#features"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "bg-background text-foreground hover:bg-background/90",
                  )}
                >
                  Explore the platform
                </Link>
                <Link
                  href="#how-it-works"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "lg" }),
                    "border border-accent-foreground/25 text-accent-foreground hover:bg-accent-foreground/10 hover:text-accent-foreground",
                  )}
                >
                  Review the flow
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
