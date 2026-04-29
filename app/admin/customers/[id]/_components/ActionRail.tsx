"use client";

// Section 6 — Action Rail.
//
// The right-hand action column. Each entry is a button to perform a
// support/admin action on the customer. Per the rules, anything we
// don't actually have wired today renders as "Coming soon" with a
// disabled button. This keeps the rail honest and discoverable —
// admins can see what's *coming* without clicking dead links.

const ACTIONS: Array<{
  title: string;
  body: string;
  glyph: React.ReactNode;
  comingSoon: true;
}> = [
  {
    title: "Import report for customer",
    body: "Upload PDF or paste tri-merge on their behalf.",
    glyph: <IconUpload />,
    comingSoon: true,
  },
  {
    title: "Start dispute",
    body: "Pick tradelines and queue a new round.",
    glyph: <IconShield />,
    comingSoon: true,
  },
  {
    title: "Generate letters",
    body: "Render the next packet for review.",
    glyph: <IconLetter />,
    comingSoon: true,
  },
  {
    title: "Upload documents",
    body: "Add evidence to the customer's vault.",
    glyph: <IconDoc />,
    comingSoon: true,
  },
  {
    title: "Send message",
    body: "Email or in-app note (no SMS yet).",
    glyph: <IconMessage />,
    comingSoon: true,
  },
  {
    title: "Escalate case",
    body: "Flag for legal / CFPB intake.",
    glyph: <IconFlag />,
    comingSoon: true,
  },
];

export function ActionRail() {
  return (
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
        {ACTIONS.map((a) => (
          <button
            key={a.title}
            type="button"
            disabled
            aria-disabled
            className="group relative flex w-full cursor-not-allowed items-start gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left opacity-65 transition"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
              {a.glyph}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-fg">
                {a.title}
              </span>
              <span className="mt-0.5 block text-[11px] leading-5 text-fg-muted">
                {a.body}
              </span>
            </span>
            {a.comingSoon && (
              <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                Soon
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="mt-4 rounded-xl border border-dashed border-border bg-surface-muted/40 p-3 text-[11px] leading-5 text-fg-muted">
        Each action will go live as we wire its backend. No half-working
        buttons — when this turns on, it works end-to-end.
      </p>
    </aside>
  );
}

function IconUpload() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M8 3v8m0-8l-3 3m3-3l3 3M3 13h10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M8 1.5l5 2.2V8c0 3.5-2 5.7-5 6.5-3-.8-5-3-5-6.5V3.7l5-2.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 8l2 2 3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconLetter() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <rect
        x="2"
        y="3"
        width="12"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M2 5l6 4 6-4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M3 2h7l3 3v9H3V2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10 2v3h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M5 9h6M5 11h6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconMessage() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M3 4h10v7H6l-3 3V4z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 7h5M5.5 9h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconFlag() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M4 2v12M4 3h7l-1.5 2.5L11 8H4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
