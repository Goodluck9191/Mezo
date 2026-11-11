import type { ReactNode } from "react";

import { Logo } from "@/components/shared/logo";
import { AuthShell } from "@/components/auth/auth-form-parts";
import { siteConfig } from "@/lib/site";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthShell>
      <Logo className="mb-8" />
      <p className="mb-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {siteConfig.tagline}
      </p>
      {children}
    </AuthShell>
  );
}
