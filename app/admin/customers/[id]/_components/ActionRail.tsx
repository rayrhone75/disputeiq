"use client";

import { useState } from "react";
import { useToast } from "./toast";
import { LinkResultModal } from "./LinkResultModal";

// Section 6 — Action Rail.
//
// Phase 1 wires "Import report for customer" → generates a magic-link
// the admin can copy and send through their existing support channel.
// All other actions still render disabled with "Soon" pills until
// their backends are wired.

export function ActionRail({
  customerId,
  onChange,
}: {
  customerId: string;
  onChange: () => void;
}) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [linkModal, setLinkModal] = useState<{
    title: string;
    description: string;
    url: string;
    expiresInSeconds?: number;
  } | null>(null);

  async function handleImportLink() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/customers/${customerId}/import-link`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        importLink?: string | null;
        expiresInSeconds?: number;
        message?: string;
      };
      if (!data.ok || !data.importLink) {
        push("error", "Couldn't generate import link", data.message ?? undefined);
        return;
      }
      setLinkModal({
        title: "Import link ready",
        description:
          "Single-use link that signs the customer in and lands them on Connect Report. Copy it and send through your support channel.",
        url: data.importLink,
        expiresInSeconds: data.expiresInSeconds ?? 24 * 60 * 60,
      });
      onChange();
    } catch (err) {
      push("error", "Couldn't generate import link", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <aside className="rounded-3xl bg-surface p-5 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
              Quick actions
            </p>
            <h3 className="mt-1 text-base font-semibold tracking-tight text-fg">
              Customer actions
            </h3>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          <LiveAction
            title="Import report for customer"
            body="Send them a single-use sign-in link to Connect Report."
            glyph={<IconUpload />}
            busy={busy}
            onClick={handleImportLink}
          />
          <ComingSoon
            title="Start dispute"
            body="Pick tradelines and queue a new round."
            glyph={<IconShield />}
          />
          <ComingSoon
            title="Generate letters"
            body="Render the next packet for review."
            glyph={<IconLetter />}
          />
          <ComingSoon
            title="Upload documents"
            body="Add evidence to the customer's vault."
            glyph={<IconDoc />}
          />
          <ComingSoon
            title="Send message"
            body="Email or in-app note (no SMS yet)."
            glyph={<IconMessage />}
          />
          <ComingSoon
            title="Escalate case"
            body="Flag for legal / CFPB intake."
            glyph={<IconFlag />}
          />
        </div>

        <p className="mt-4 rounded-xl border border-dashed border-border bg-surface-muted/40 p-3 text-[11px] leading-5 text-fg-muted">
          Each remaining action goes live as we wire its backend. No
          half-working buttons.
        </p>
      </aside>

      {linkModal && (
        <LinkResultModal
          title={linkModal.title}
          description={linkModal.description}
          url={linkModal.url}
          expiresInSeconds={linkModal.expiresInSeconds}
          onClose={() => setLinkModal(null)}
        />
      )}
    </>
  );
}

function LiveAction({
  title,
  body,
  glyph,
  busy,
  onClick,
}: {
  title: string;
  body: string;
  glyph: React.ReactNode;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="group relative flex w-full items-start gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left transition hover:-translate-y-0.5 hover:border-fg/20 hover:shadow-[0_18px_48px_-22px_rgba(15,23,42,0.35)] disabled:cursor-progress disabled:opacity-70"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
        {glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-5 text-fg-muted">
          {body}
        </span>
      </span>
      {busy ? (
        <Spinner />
      ) : (
        <span className="shrink-0 text-fg-subtle transition group-hover:text-fg">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
            <path
              d="M6 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </button>
  );
}

function ComingSoon({
  title,
  body,
  glyph,
}: {
  title: string;
  body: string;
  glyph: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled
      aria-disabled
      className="group relative flex w-full cursor-not-allowed items-start gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left opacity-65"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-fg-muted">
        {glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-5 text-fg-muted">
          {body}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
        Soon
      </span>
    </button>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 animate-spin text-fg-muted" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M8 3v8m0-8l-3 3m3-3l3 3M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M8 1.5l5 2.2V8c0 3.5-2 5.7-5 6.5-3-.8-5-3-5-6.5V3.7l5-2.2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconLetter() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 5l6 4 6-4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M3 2h7l3 3v9H3V2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5 9h6M5 11h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconMessage() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M3 4h10v7H6l-3 3V4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5.5 7h5M5.5 9h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconFlag() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M4 2v12M4 3h7l-1.5 2.5L11 8H4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
