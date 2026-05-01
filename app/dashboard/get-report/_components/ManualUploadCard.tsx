"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Primary, headline upload card for /dashboard/get-report.
//
// Customer journey:
//   1. Customer signs in to MyScoreIQ in another tab.
//   2. Opens their credit report.
//   3. Clicks "Download this report" or Print → "Save as PDF".
//   4. Drags the file here. We accept PDF, HTML, TXT, or JSON.
//
// All four formats hit /api/reports/upload-any which auto-detects shape
// and dispatches: JSON gets the full automated parse; PDF/HTML/TXT get
// best-effort heuristic parsing + a "support is reviewing" status. The
// customer always lands back on /dashboard/get-report?imported=1 so the
// page can poll the snapshot endpoint and progress to results.

// Three terminal states map 1:1 to the API's `outcome` field. The
// route is the source of truth — the client doesn't try to second-guess
// it (no more "parsedCount === 0 → support reviewing" heuristics).
type Outcome = "imported" | "needs_review" | "failed";
type Status = "idle" | "submitting" | Outcome;

type UploadResponse = {
  outcome?: Outcome;
  confidence?: "high" | "medium" | "low";
  tradelineCount?: number;
  negativeCount?: number;
  candidateCount?: number | null;
  importId?: string | null;
  reportId?: string | null;
  parsedCount?: number;
  parseStatus?: string;
  redirectTo?: string;
  error?: string | Record<string, unknown>;
  message?: string;
  reviewFlags?: string[];
  bureauGuess?: string | null;
  detectedFormat?: string;
};

const ACCEPTED =
  "application/pdf,.pdf,text/html,.html,.htm,application/json,.json,text/plain,.txt";

const ACCEPTED_LABEL = "PDF, HTML, TXT, or JSON";

export function ManualUploadCard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);

  async function submitFile(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      setStatus("failed");
      setMessage(
        `File is ${(file.size / (1024 * 1024)).toFixed(1)} MB — max 25 MB.`,
      );
      return;
    }
    setStatus("submitting");
    setMessage("");
    setResult(null);
    setRedirectTarget(null);
    setPickedName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/reports/upload-any", {
        method: "POST",
        body: fd,
      });
      let data: UploadResponse | null = null;
      try {
        data = (await res.json()) as UploadResponse;
      } catch {
        data = null;
      }

      // Pre-parse rejections (401/413/415/etc.) come back without an
      // `outcome` field. Treat them as `failed`.
      if (!res.ok && !data?.outcome) {
        const errStr =
          typeof data?.error === "string"
            ? data.error
            : data?.error
              ? JSON.stringify(data.error)
              : `HTTP ${res.status}`;
        setStatus("failed");
        setMessage(
          data?.message ?? `Couldn't upload this file (${errStr}).`,
        );
        return;
      }

      const outcome: Outcome =
        data?.outcome ??
        // Backward-compat fallback if a deploy lag returns the old shape.
        (data?.parseStatus === "needs_manual_review"
          ? "needs_review"
          : "imported");

      setResult(data);
      setStatus(outcome);
      setMessage(data?.message ?? defaultMessageFor(outcome));

      const target = data?.redirectTo ?? "/dashboard/get-report?imported=1";
      setRedirectTarget(target);

      // Auto-redirect ONLY for imported. needs_review and failed stay
      // on the page so the customer reads the message and can re-try
      // or contact support without being whisked away.
      if (outcome === "imported") {
        setTimeout(() => router.push(target), 1800);
      }
    } catch (err) {
      setStatus("failed");
      setMessage(
        `Network error — please try again. (${(err as Error).message})`,
      );
    }
  }

  function onPick() {
    fileRef.current?.click();
  }

  return (
    <section className="rounded-3xl border-2 border-violet-300 bg-violet-50/70 p-6 shadow-[0_30px_80px_-20px_rgba(139,92,246,0.45)] dark:border-violet-500/30 dark:bg-violet-500/10 sm:p-8">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">
          Step 1 · Upload your report
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          Upload your MyScoreIQ credit report
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted sm:text-base">
          Drop the file you downloaded from MyScoreIQ. We accept{" "}
          <span className="font-semibold text-fg">{ACCEPTED_LABEL}</span>.
          We'll auto-detect the format, extract your accounts, inquiries,
          collections, scores, and personal info, and pull dispute
          opportunities — usually within a few seconds.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void submitFile(f);
        }}
        className={[
          "mt-6 rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-10",
          dragOver
            ? "border-violet-500 bg-violet-100/70 dark:bg-violet-500/15"
            : "border-violet-200 bg-white/60 dark:border-violet-500/20 dark:bg-surface/40",
        ].join(" ")}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void submitFile(f);
          }}
          className="hidden"
        />
        <svg
          viewBox="0 0 24 24"
          className="mx-auto h-10 w-10 text-violet-500 dark:text-violet-300"
          fill="none"
        >
          <path
            d="M12 3v12m0-12l-4 4m4-4l4 4M5 19h14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="mt-4 text-base font-semibold text-fg">
          Drag your credit report here
        </p>
        <p className="mt-1 text-[12px] text-fg-muted">or</p>
        <button
          type="button"
          onClick={onPick}
          disabled={status === "submitting"}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-violet-700 disabled:opacity-60 sm:text-base"
        >
          {status === "submitting" ? "Uploading…" : "Upload Credit Report"}
        </button>
        <p className="mt-3 text-[11px] text-fg-subtle">
          {ACCEPTED_LABEL} · max 25 MB · encrypted at rest
        </p>
        {pickedName && status === "submitting" && (
          <p className="mt-2 truncate text-[12px] text-fg-muted">
            {pickedName}
          </p>
        )}
      </div>

      {status === "submitting" && (
        <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-[12px] text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
          Uploading and analyzing your report — this usually takes a few seconds…
        </p>
      )}

      {status === "imported" && (
        <div className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-900 dark:bg-emerald-500/30 dark:text-emerald-100">
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                <path
                  d="M3 8l3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
                Your report was imported successfully.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <CountTile
                  label="Tradelines"
                  value={result?.tradelineCount ?? 0}
                />
                <CountTile
                  label="Negative items"
                  value={result?.negativeCount ?? 0}
                />
                <CountTile
                  label="Dispute candidates"
                  value={result?.candidateCount ?? 0}
                />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    router.push(redirectTarget ?? "/dashboard/get-report?imported=1")
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  View dispute opportunities
                  <span aria-hidden>→</span>
                </button>
                <span className="text-[11px] text-emerald-900/70 dark:text-emerald-100/70">
                  Redirecting automatically…
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === "needs_review" && (
        <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
          <p className="font-semibold">{message}</p>
          <p className="mt-1 text-[12px] text-sky-900/80 dark:text-sky-200/80">
            We've stored your file securely. You'll get an email the moment
            your dispute candidates are ready — typically within one business
            day. You don't need to do anything else.
          </p>
        </div>
      )}

      {status === "failed" && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <p className="font-semibold">Couldn't import that file.</p>
          <p className="mt-1 text-[12px] text-rose-900/80 dark:text-rose-200/80">
            {message}
          </p>
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setMessage("");
              setResult(null);
              setRedirectTarget(null);
              setPickedName(null);
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-transparent px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:text-rose-300"
          >
            Try a different file
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-3 rounded-2xl border border-violet-200/60 bg-white/40 p-4 text-[12px] leading-5 text-fg-muted dark:border-violet-500/20 dark:bg-surface/30 sm:grid-cols-2 sm:text-[13px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300 sm:col-span-2">
          How to get the file from MyScoreIQ
        </p>
        <Step n={1}>
          Sign in to your MyScoreIQ account at{" "}
          <a
            href="https://member.myscoreiq.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-fg underline"
          >
            member.myscoreiq.com
          </a>
          .
        </Step>
        <Step n={2}>Open your most recent credit report.</Step>
        <Step n={3}>
          Click <span className="font-semibold text-fg">Download this report</span>{" "}
          (or use Print → <span className="font-semibold text-fg">Save as PDF</span>).
        </Step>
        <Step n={4}>Drag the saved file onto the box above.</Step>
      </div>
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-200 text-[10px] font-semibold text-violet-800 dark:bg-violet-500/30 dark:text-violet-100">
        {n}
      </span>
      <div className="leading-5">{children}</div>
    </div>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/70 p-3 ring-1 ring-emerald-200/70 dark:bg-emerald-500/15 dark:ring-emerald-500/30">
      <p className="text-2xl font-semibold tracking-tight text-emerald-900 dark:text-emerald-50">
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-900/70 dark:text-emerald-100/70">
        {label}
      </p>
    </div>
  );
}

function defaultMessageFor(outcome: Outcome): string {
  if (outcome === "imported") return "Your report was imported successfully.";
  if (outcome === "needs_review")
    return "We received your report. Our support team is reviewing it.";
  return "Couldn't import that file. Please try uploading it again.";
}
