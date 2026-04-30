"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Always-visible manual upload card for /dashboard/get-report.
//
// Bypasses the multi-step Connect flow and goes straight to the
// already-proven `/api/reports/paste` endpoint, which auto-detects JSON
// payloads and routes them through the same import pipeline the
// bookmarklet uses. Two affordances:
//   1. Drag-and-drop / file-picker for a .json file.
//   2. Textarea for pasting JSON.
// Both submit identical bodies; the user picks whichever is easier.

type Status = "idle" | "submitting" | "ok" | "err";

export function ManualUploadCard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [paste, setPaste] = useState<string>("");
  const [showPaste, setShowPaste] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function submitText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setStatus("err");
      setMessage("Empty file or paste — nothing to import.");
      return;
    }
    if (trimmed[0] !== "{" && trimmed[0] !== "[") {
      setStatus("err");
      setMessage(
        "That doesn't look like JSON. The file should start with { or [. Make sure you exported the JSON view from MyScoreIQ.",
      );
      return;
    }
    if (trimmed.length > 25 * 1024 * 1024) {
      setStatus("err");
      setMessage("File is over 25 MB — too large for direct upload.");
      return;
    }
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/reports/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reportId?: string | null;
        parsedCount?: number;
        parseStatus?: string;
        redirectTo?: string;
        error?: string;
        message?: string;
        reviewFlags?: string[];
      };
      if (!res.ok || data.parseStatus === "needs_manual_review") {
        const flags = (data.reviewFlags ?? []).join(", ");
        setStatus("err");
        setMessage(
          data.message ??
            data.error ??
            (flags
              ? `Parser couldn't extract tradelines. Flags: ${flags}`
              : "Import failed. Try a different file."),
        );
        return;
      }
      setStatus("ok");
      setMessage(
        `Imported — ${data.parsedCount ?? 0} tradelines analyzed.`,
      );
      // Redirect after a brief success display so the dashboard reflects
      // the new state.
      const target = data.redirectTo ?? "/dashboard/get-report?imported=1";
      setTimeout(() => router.push(target), 900);
    } catch (err) {
      setStatus("err");
      setMessage((err as Error).message);
    }
  }

  async function onFile(file: File) {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (
      !lower.endsWith(".json") &&
      !lower.endsWith(".txt") &&
      file.type !== "application/json" &&
      file.type !== "text/plain" &&
      file.type !== ""
    ) {
      setStatus("err");
      setMessage(
        "Only .json (or .txt containing JSON) is supported here. PDF support is coming — for now, ask MyScoreIQ for the JSON view.",
      );
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setStatus("err");
      setMessage("File is over 25 MB — too large for direct upload.");
      return;
    }
    try {
      const text = await file.text();
      await submitText(text);
    } catch (err) {
      setStatus("err");
      setMessage((err as Error).message);
    }
  }

  function onPickFile() {
    fileRef.current?.click();
  }

  return (
    <section className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
            Already have a file?
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-fg sm:text-xl">
            Upload your credit report
          </h3>
          <p className="mt-1 text-sm leading-6 text-fg-muted">
            Drag a JSON file onto the box below, pick one from your device,
            or paste the report contents — all three work the same.
          </p>
        </div>
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
          if (f) void onFile(f);
        }}
        className={[
          "mt-5 rounded-2xl border-2 border-dashed p-7 text-center transition",
          dragOver
            ? "border-violet-500 bg-violet-50/60 dark:bg-violet-500/10"
            : "border-border bg-surface-muted/40",
        ].join(" ")}
      >
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,text/plain,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
          className="hidden"
        />
        <svg
          viewBox="0 0 24 24"
          className="mx-auto h-9 w-9 text-fg-muted"
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
        <p className="mt-3 text-sm font-semibold text-fg">
          Drop your <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px]">.json</code> here
        </p>
        <p className="mt-1 text-[12px] text-fg-muted">or</p>
        <button
          type="button"
          onClick={onPickFile}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-fg px-4 py-2 text-sm font-semibold text-canvas hover:opacity-90"
        >
          Choose file
        </button>
        <p className="mt-3 text-[11px] text-fg-subtle">
          Max 25 MB. Your file is encrypted at rest.
        </p>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowPaste((v) => !v)}
          className="text-xs font-semibold text-fg-muted hover:text-fg"
          aria-expanded={showPaste}
        >
          {showPaste ? "Hide paste box ▲" : "Or paste the report text instead ▼"}
        </button>
        {showPaste && (
          <div className="mt-3">
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={6}
              placeholder='Paste your MyScoreIQ JSON here — should start with { or ['
              className="w-full rounded-xl border border-border bg-surface-muted/40 p-3 font-mono text-[12px] text-fg placeholder:text-fg-subtle focus:border-fg/30 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => void submitText(paste)}
                disabled={status === "submitting" || !paste.trim()}
                className="rounded-xl bg-fg px-4 py-2 text-xs font-semibold text-canvas hover:opacity-90 disabled:opacity-50"
              >
                {status === "submitting" ? "Importing…" : "Import paste"}
              </button>
            </div>
          </div>
        )}
      </div>

      {status === "submitting" && (
        <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-[12px] text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
          Uploading and analyzing your report — this usually takes a few seconds…
        </p>
      )}
      {status === "ok" && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {message} Redirecting…
        </p>
      )}
      {status === "err" && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {message}
        </p>
      )}

      <p className="mt-4 text-[11px] leading-5 text-fg-subtle">
        How to get the JSON: in MyScoreIQ open{" "}
        <a
          href="https://member.myscoreiq.com/CreditReport.aspx?view=json"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-fg"
        >
          your report&apos;s JSON view
        </a>
        , then save the page (Ctrl+S → "Webpage, JSON only") or right-click
        → "Save as". Drop the saved file above.
      </p>
    </section>
  );
}
