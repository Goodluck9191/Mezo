"use client";

import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";

const THEME_STORAGE_KEY = "mezo-theme";

function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.classList.toggle("dark");
  const nextTheme = isDark ? "dark" : "light";

  root.style.colorScheme = nextTheme;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). The toggle
    // still works for the current page.
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
      title="Toggle color theme"
      className={cn(
        "grid size-10 place-items-center rounded-full text-muted transition-colors",
        "hover:bg-surface hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      <MoonIcon className="size-5 dark:hidden" />
      <SunIcon className="hidden size-5 dark:block" />
    </button>
  );
}
