"use client";

import { useState, type ReactNode } from "react";

import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

export interface TableQr {
  tableId: string;
  tableName: string;
  url: string;
  /** SVG data URL rendered on the server from the customer URL. */
  image: string;
}

/**
 * One-time reveal of a freshly generated table QR code. The SVG itself is
 * rendered on the server; the plaintext token is never stored server-side and
 * this panel is the only place the code appears.
 */
export function QrReveal({
  qr,
  heading,
  onDismiss,
}: {
  qr: TableQr;
  heading: string;
  onDismiss: () => void;
}) {
  const fileSlug = qr.tableName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return (
    <div
      role="region"
      aria-label={heading}
      data-qr-url={qr.url}
      className="rounded-3xl border border-accent/40 bg-accent/5 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            {heading}
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {qr.tableName}
          </h3>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium text-muted transition-colors hover:text-foreground"
        >
          Close
        </button>
      </div>

      <p className="mt-2 max-w-md text-xs leading-5 text-muted">
        This code is shown once. Download or print it now — regenerating replaces it and any
        previously printed codes stop working immediately.
      </p>

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr.image}
            alt={`QR code for ${qr.tableName}`}
            width={220}
            height={220}
            className="size-44 sm:size-52"
          />
        </div>

        <div className="flex w-full max-w-xs flex-col gap-2">
          <a
            href={qr.image}
            download={`mezo-qr-${fileSlug || "table"}.svg`}
            className={buttonVariants({ variant: "primary" })}
          >
            Download SVG
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className={cn(buttonVariants({ variant: "secondary" }), "disabled:opacity-50")}
          >
            Print
          </button>
          <CopyUrlButton url={qr.url} />
          <p className="mt-1 break-all text-[10px] leading-4 text-muted">
            Customers open this code with their phone camera — it always lands on this table&apos;s
            page.
          </p>
        </div>
      </div>

      {/* Print-only QR sheet */}
      <div aria-hidden="true" className="print-area hidden print:grid">
        <figure className="flex flex-col items-center gap-6">
          <Logo />
          <figcaption className="text-3xl font-semibold tracking-tight">{qr.tableName}</figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.image} alt="" width={420} height={420} className="size-[420px]" />
          <p className="text-sm font-semibold uppercase tracking-[0.18em]">
            Scan to order · {siteConfig.tagline}
          </p>
        </figure>
      </div>
    </div>
  );
}

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the URL is shown as text regardless.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={buttonVariants({ variant: "secondary", size: "sm" })}
    >
      {copied ? "Copied" : "Copy table link"}
    </button>
  );
}

/** Inline two-step confirmation used for destructive or rotating actions. */
export function ConfirmInline({
  question,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  children,
}: {
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-xs font-medium text-muted">{question}</span>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className={cn(buttonVariants({ variant: "primary", size: "sm" }), "disabled:opacity-50")}
      >
        {busy ? "Working…" : confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        Keep it
      </button>
      {children}
    </div>
  );
}
