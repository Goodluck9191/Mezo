"use client";

import { useRef, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/utils/cn";

export type ConfirmButtonProps = Omit<ComponentProps<"button">, "children"> & {
  children: ReactNode;
  /** Question asked before submitting. Keep it short and specific. */
  message: string;
};

/**
 * Submit button that asks for confirmation before allowing the enclosing
 * form to submit. Used for destructive actions (deactivating staff,
 * revoking invitations) so a stray click cannot apply them.
 */
export function ConfirmButton({
  children,
  message,
  className,
  type = "submit",
  ...props
}: ConfirmButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-full border border-red-600/40 px-4 text-xs font-medium text-red-700 transition-colors",
        "hover:border-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600",
        "disabled:pointer-events-none disabled:opacity-50",
        "dark:border-red-400/30 dark:text-red-400 dark:hover:border-red-400 dark:hover:bg-red-500/10",
        className,
      )}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}
