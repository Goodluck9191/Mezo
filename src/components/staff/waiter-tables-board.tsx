"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  approveTableAccessAction,
  closeTableSessionAction,
  rejectTableAccessAction,
} from "@/app/actions/table-access";
import type { TableActiveSession, TablePendingRequest } from "@/lib/table-access";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils/cn";

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function WaiterTablesBoard({
  requests,
  sessions,
  restaurants,
}: {
  requests: TablePendingRequest[];
  sessions: TableActiveSession[];
  restaurants: Array<{ restaurantId: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Record<string, "approve" | "reject" | "close">>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  // Realtime subscription (accelerator); a slow poll covers its absence.
  useEffect(() => {
    const supabase = createClient();

    const channels = restaurants.map((restaurant) =>
      supabase
        .channel(`staff-table-access-${restaurant.restaurantId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "table_access_requests",
            filter: `restaurant_id=eq.${restaurant.restaurantId}`,
          },
          () => refresh(),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "table_sessions",
            filter: `restaurant_id=eq.${restaurant.restaurantId}`,
          },
          () => refresh(),
        )
        .subscribe(),
    );

    const cleanup = () => {
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };

    const interval = window.setInterval(refresh, 10_000);

    return () => {
      cleanup();
      window.clearInterval(interval);
    };
  }, [restaurants, refresh]);

  const act = async (kind: "approve" | "reject" | "close", id: string) => {
    setPending((current) => ({ ...current, [id]: kind }));
    setError(null);
    try {
      const result =
        kind === "approve"
          ? await approveTableAccessAction(id)
          : kind === "reject"
            ? await rejectTableAccessAction(id)
            : await closeTableSessionAction(id);

      if (!result.ok) {
        setError(result.error ?? (kind === "approve" ? "Could not approve." : "Could not update."));
      } else {
        setConfirmClose(null);
        refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };

  return (
    <div className="space-y-8">
      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-xs leading-5 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      {/* Awaiting approval */}
      <section aria-label="Requests awaiting approval">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Awaiting approval
          </h2>
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-accent/10 px-2 text-xs font-bold tabular-nums text-accent">
            {requests.length}
          </span>
        </div>

        {requests.length === 0 ? (
          <p className="mt-3 rounded-3xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted">
            No one is waiting right now. New requests appear here the moment a guest scans a table
            QR code.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {requests.map((request) => (
              <li
                key={request.id}
                className="rounded-3xl border border-amber-400/40 bg-amber-50 p-4 shadow-sm dark:bg-amber-500/10 sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 place-items-center rounded-2xl border border-amber-400/50 bg-white text-base font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                      {request.tableName.replace(/^table\s*/i, "#")}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {request.tableName}{" "}
                        <span className="text-xs font-medium text-muted">
                          · {request.restaurantName}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        requested {timeAgo(request.requestedAt)}
                        {request.partySize ? ` · party of ${request.partySize}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending[request.id] !== undefined}
                      onClick={() => void act("approve", request.id)}
                    >
                      {pending[request.id] === "approve" ? "Approving…" : "Approve"}
                    </Button>
                    <button
                      type="button"
                      disabled={pending[request.id] !== undefined}
                      onClick={() => void act("reject", request.id)}
                      className={cn(
                        buttonVariants({ variant: "secondary", size: "sm" }),
                        "disabled:pointer-events-none disabled:opacity-50",
                      )}
                    >
                      {pending[request.id] === "reject" ? "Rejecting…" : "Reject"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Open sessions */}
      <section aria-label="Open table sessions">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Open tables
          </h2>
          <button
            type="button"
            onClick={refresh}
            className="text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {sessions.length === 0 ? (
          <p className="mt-3 rounded-3xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted">
            No open table sessions. When you approve a guest, the table appears here.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="rounded-3xl border border-border bg-surface-strong p-4 shadow-sm sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {session.tableName}{" "}
                      <span className="text-xs font-medium text-muted">
                        · {session.restaurantName}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {session.guestCount} {session.guestCount === 1 ? "guest" : "guests"}
                      {session.approvedAt ? ` · opened ${timeAgo(session.approvedAt)}` : ""}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
                    Open
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
                  {confirmClose === session.id ? (
                    <>
                      <span className="text-xs font-medium text-muted">Close this table?</span>
                      <button
                        type="button"
                        className={buttonVariants({ variant: "primary", size: "sm" })}
                        disabled={pending[session.id] !== undefined}
                        onClick={() => void act("close", session.id)}
                      >
                        {pending[session.id] === "close" ? "Closing…" : "Confirm close"}
                      </button>
                      <button
                        type="button"
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                        onClick={() => setConfirmClose(null)}
                      >
                        Keep open
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                      onClick={() => setConfirmClose(session.id)}
                    >
                      Close table
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
