import type { ReactNode } from "react";

/**
 * Clearly labelled empty state used for capabilities that arrive in later
 * phases. Never implies data exists that does not.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface px-6 py-8 text-center">
      {icon ? (
        <div className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-surface-strong text-muted">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-muted">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
