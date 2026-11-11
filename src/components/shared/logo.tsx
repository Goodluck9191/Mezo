import Link from "next/link";

import { UtensilsIcon } from "@/components/ui/icons";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={siteConfig.name}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-xl bg-accent text-accent-foreground shadow-sm"
      >
        <UtensilsIcon className="size-4" />
      </span>
      <span className="text-lg font-semibold tracking-tight">{siteConfig.name}</span>
    </Link>
  );
}
