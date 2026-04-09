"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Bridge step. After the user returns from MyFreeScoreNow, this is the
// first thing they see — drop the PDF, get redirected straight into the
// tri-merge action center for that report.
export function ReportUploader() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/reports/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Upload failed");
      router.push(`/dashboard/reports/${data.reportId}`);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/40 px-6 py-12 text-center transition hover:border-accent-500 hover:bg-accent-50/30">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-ink-900 to-accent-600" />
        <p className="font-display text-base font-semibold text-ink-900">
          {busy ? "Uploading & parsing…" : "Drop your tri-merge PDF"}
        </p>
        <p className="text-xs text-ink-500">
          Encrypted on upload · Goes straight into the tri-merge action center
        </p>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onChange}
          disabled={busy}
        />
      </label>
      {err && <p className="mt-3 text-xs text-rose-600">{err}</p>}
    </div>
  );
}
