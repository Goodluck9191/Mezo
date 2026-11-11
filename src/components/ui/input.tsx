import type { ComponentProps } from "react";

import { cn } from "@/utils/cn";

export type InputProps = ComponentProps<"input"> & {
  /** Marks the field invalid for styling and accessibility. */
  invalid?: boolean;
};

export function Input({ className, invalid = false, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-xl border bg-surface px-4 text-sm text-foreground",
        "placeholder:text-muted transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-60",
        invalid ? "border-red-400 dark:border-red-500" : "border-border",
        className,
      )}
      {...props}
    />
  );
}

export type SelectProps = ComponentProps<"select"> & {
  invalid?: boolean;
};

export function Select({ className, invalid = false, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-xl border bg-surface px-4 text-sm text-foreground",
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-60",
        invalid ? "border-red-400 dark:border-red-500" : "border-border",
        className,
      )}
      {...props}
    />
  );
}

export type TextareaProps = ComponentProps<"textarea"> & {
  invalid?: boolean;
};

export function Textarea({ className, invalid = false, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-24 w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground",
        "placeholder:text-muted transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-60",
        invalid ? "border-red-400 dark:border-red-500" : "border-border",
        className,
      )}
      {...props}
    />
  );
}
