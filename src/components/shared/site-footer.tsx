import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { marketingNav, siteConfig } from "@/lib/site";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface/60">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr] lg:px-8">
        <div className="max-w-sm space-y-4">
          <Logo />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            {siteConfig.tagline}
          </p>
          <p className="text-sm leading-6 text-muted">{siteConfig.description}</p>
        </div>

        <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="font-medium text-foreground">Product</p>
            <ul className="mt-3 space-y-2">
              {marketingNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-medium text-foreground">Early access</p>
            <p className="mt-3 leading-6 text-muted">
              We are preparing onboarding for a small group of dine-in restaurants in Tanzania.
            </p>
          </div>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {year} {siteConfig.name}. All rights reserved.
          </p>
          <p>Mezo is in active development. Features shown describe the planned product.</p>
        </div>
      </div>
    </footer>
  );
}
