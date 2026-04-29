"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Client-only controls for the bookmarklet card — clipboard copy +
// status refresh. Kept separate from the server-rendered card so the
// signed bookmarklet href can stay server-side without forcing the whole
// card into a Client Component.
export function BookmarkletInstallControls({
  bookmarkletHref,
}: {
  bookmarkletHref: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState<string | null>(null);

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API not available in this browser.");
      }
      await navigator.clipboard.writeText(bookmarkletHref);
      setCopied(true);
      setCopyErr(null);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      setCopyErr((err as Error).message);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-muted"
        title="Copy the bookmarklet code if you can't drag it"
      >
        {copied ? "Copied ✓" : "Copy Bookmarklet"}
      </button>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-muted"
      >
        I imported my report
      </button>
      {copyErr && (
        <span className="text-[11px] text-rose-600 dark:text-rose-400">
          {copyErr}
        </span>
      )}
    </div>
  );
}
