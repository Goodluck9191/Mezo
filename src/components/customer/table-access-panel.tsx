"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { signInAnonymously } from "@/lib/auth/anonymous";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/utils/cn";
import { buttonVariants } from "@/components/ui/button";

export type TableAccessStatus =
  "none" | "pending" | "approved" | "rejected" | "expired" | "cancelled" | "closed";

type StatusState = TableAccessStatus | "validating";

const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Customer-facing table access panel. Establishes an anonymous session, keeps
 * the caller's own access state in sync (poll + Realtime), and lets a waiting
 * diner ask a waiter to confirm their seating.
 */
export function TableAccessPanel({
  token,
  tableName,
  initialStatus,
}: {
  token: string;
  tableName: string;
  initialStatus: TableAccessStatus;
}) {
  const [status, setStatus] = useState<StatusState>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("get_table_entry", {
        p_qr_token: token,
      });
      if (rpcError) {
        return;
      }

      const row = (Array.isArray(data) ? data[0] : data) as
        { my_status?: string; has_active_session?: boolean } | undefined;

      if (row?.my_status) {
        setStatus(row.my_status as TableAccessStatus);
      }
    } catch {
      // Transient failures are fine; the next tick retries.
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      await signInAnonymously();
      if (cancelled) return;
      await refresh();

      intervalRef.current = window.setInterval(() => {
        void refresh();
      }, 5000);
    }

    void boot();

    return () => {
      cancelled = true;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [initialStatus, refresh]);

  // Realtime as an accelerator for poll ticks (poll covers its absence).
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function subscribe() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // StrictMode remounts: the browser supabase client is a singleton and
      // client.channel() returns the SAME channel object for the same topic
      // (removeChannel only unsubscribes, never evicts from the registry).
      // A re-subscribed channel would throw "cannot add postgres_changes
      // callbacks after subscribe()". A unique topic per effect run avoids
      // reusing an already-subscribed channel object; cleanup unsubscribes.
      const channel = supabase
        .channel(`table-access-${user.id}-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "table_access_requests",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void refresh();
          },
        )
        .subscribe();

      cleanup = () => {
        void supabase.removeChannel(channel);
      };
    }

    void subscribe();

    return () => {
      cleanup?.();
    };
  }, [refresh]);

  const requestAccess = async () => {
    setBusy(true);
    setError(null);
    try {
      const anonymous = await signInAnonymously();
      const anonymousError = anonymous && "error" in anonymous ? anonymous.error : null;
      if (anonymousError) {
        setError("Couldn't start your table session. Please try again.");
        return;
      }

      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("request_table_access", {
        p_qr_token: token,
      });

      if (rpcError) {
        setError(
          rpcError.message.includes("too many")
            ? "Too many requests just now. Please wait a moment and try again."
            : GENERIC_ERROR,
        );
        return;
      }

      const row = (Array.isArray(data) ? data[0] : data) as { status?: string } | null;
      setStatus((row?.status as TableAccessStatus | undefined) ?? "pending");
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const statusView = (() => {
    switch (status) {
      case "validating":
        return (
          <PanelShell tone="neutral" title="Validating your table…">
            <p className="text-sm leading-6 text-muted">
              Checking this QR code with the restaurant.
            </p>
          </PanelShell>
        );
      case "none":
        return (
          <PanelShell tone="accent" title={`You're at ${tableName}`}>
            <p className="text-sm leading-6 text-muted">
              Tap the button and a waiter will confirm you&apos;re seated. Ordering opens after
              approval.
            </p>
            <RequestButton busy={busy} onClick={requestAccess} label="Request waiter approval" />
          </PanelShell>
        );
      case "pending":
        return (
          <PanelShell tone="amber" title="Waiting for a waiter…">
            <p className="text-sm leading-6 text-muted">
              Your request is with the wait staff. Show them this screen — ordering opens as soon as
              they approve your seating.
            </p>
            <Spinner label="Hold tight" />
          </PanelShell>
        );
      case "approved":
        return (
          <PanelShell tone="green" title="You're approved and seated">
            <p className="text-sm leading-6 text-muted">
              Enjoy your meal at {tableName}. You can order as soon as ordering opens — your waiter
              will confirm anything extra.
            </p>
          </PanelShell>
        );
      case "rejected":
        return (
          <PanelShell tone="red" title="Not approved this time">
            <p className="text-sm leading-6 text-muted">
              The waiter didn&apos;t approve this request. Please ask them for help before trying
              again.
            </p>
            <RequestButton busy={busy} onClick={requestAccess} label="Request again" />
          </PanelShell>
        );
      case "expired":
        return (
          <PanelShell tone="amber" title="Request expired">
            <p className="text-sm leading-6 text-muted">
              No waiter confirmed in time. Ask again and a waiter will be with you.
            </p>
            <RequestButton busy={busy} onClick={requestAccess} label="Request again" />
          </PanelShell>
        );
      case "cancelled":
        return (
          <PanelShell tone="neutral" title="Request cancelled">
            <p className="text-sm leading-6 text-muted">
              Your request was cancelled. Ask again whenever you&apos;re ready.
            </p>
            <RequestButton busy={busy} onClick={requestAccess} label="Request waiter approval" />
          </PanelShell>
        );
      case "closed":
        return (
          <PanelShell tone="neutral" title="This table session was closed">
            <p className="text-sm leading-6 text-muted">
              The table has been cleared. Scan again or ask a waiter to open a new seating.
            </p>
            <RequestButton busy={busy} onClick={requestAccess} label="Request waiter approval" />
          </PanelShell>
        );
    }
  })();

  return (
    <section aria-label="Table access" className="mt-6">
      {statusView}
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-center text-[11px] uppercase tracking-[0.18em] text-muted">
        Mezo — SMART DINING. SIMPLE SERVICE.
      </p>
    </section>
  );
}

function PanelShell({
  tone,
  title,
  children,
}: {
  tone: "neutral" | "accent" | "amber" | "green" | "red";
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "border-border bg-surface",
    accent: "border-accent/40 bg-accent/5",
    amber: "border-amber-400/40 bg-amber-50 dark:bg-amber-500/10",
    green: "border-emerald-400/40 bg-emerald-50 dark:bg-emerald-500/10",
    red: "border-red-400/40 bg-red-50 dark:bg-red-500/10",
  } as const;

  return (
    <div className={cn("rounded-3xl border px-5 py-5 shadow-sm sm:px-6", tones[tone])}>
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function RequestButton({
  busy,
  onClick,
  label,
}: {
  busy: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(buttonVariants({ variant: "primary" }), "mt-4 h-11 w-full sm:w-auto")}
    >
      {busy ? "Sending…" : label}
    </button>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-muted">
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-border border-t-accent"
      />
      {label}
    </p>
  );
}
