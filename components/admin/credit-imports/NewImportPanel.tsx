"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserOpt = { id: string; email: string };

type Provider = "IDENTITYIQ" | "MYSCOREIQ" | "MANUAL";

export function NewImportPanel({ users }: { users: UserOpt[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [provider, setProvider] = useState<Provider>("MYSCOREIQ");
  const [sourceUrl, setSourceUrl] = useState("");
  const [providerRef, setProviderRef] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(opts: { withPaste?: boolean; withUpload?: boolean }) {
    if (!userId) {
      setError("Select a user first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const createRes = await fetch("/api/admin/credit-imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          provider,
          sourceUrl: sourceUrl || undefined,
          providerRef: providerRef || undefined,
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) throw new Error(createJson.error ?? "CREATE_FAILED");
      const importId = createJson.import.id as string;

      if (opts.withPaste && bodyText.trim()) {
        const pasteRes = await fetch(`/api/admin/credit-imports/${importId}/paste`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bodyText }),
        });
        const pasteJson = await pasteRes.json();
        if (!pasteRes.ok) throw new Error(pasteJson.message ?? pasteJson.error ?? "PASTE_FAILED");
      }

      if (opts.withUpload && uploadFile) {
        const fd = new FormData();
        fd.append("file", uploadFile);
        const uploadRes = await fetch(`/api/admin/credit-imports/${importId}/upload`, {
          method: "POST",
          body: fd,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadJson.message ?? uploadJson.error ?? "UPLOAD_FAILED");
        }
      }

      router.push(`/admin/credit-imports/${importId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-fg-muted">Target user</span>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-fg-muted">Provider</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm"
          >
            <option value="MYSCOREIQ">MyScoreIQ</option>
            <option value="MANUAL">Manual / other (auto-detect)</option>
          </select>
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-semibold text-fg-muted">
            Provider URL (optional — used later by the Fetch tab)
          </span>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://.../CreditReport.aspx?view=json"
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-semibold text-fg-muted">Provider reference (optional)</span>
          <input
            value={providerRef}
            onChange={(e) => setProviderRef(e.target.value)}
            placeholder="External customer or session id"
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-fg-muted">
          Paste raw JSON (optional — can also be done on the detail page)
        </p>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={12}
          placeholder='{"borrower": {"fullName": "..."}, "tradelines": [...]}'
          className="w-full rounded-lg border border-border-strong bg-surface-muted/60 px-3 py-2 font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-fg-muted">Or upload a .json file (max 10 MB)</p>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
          className="block w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm"
        />
        {uploadFile && (
          <p className="text-xs text-fg-muted">
            Selected: <span className="font-mono">{uploadFile.name}</span> ·{" "}
            {(uploadFile.size / 1024).toFixed(1)} KB
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-xs text-danger-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => submit({})}
          className="rounded-xl bg-fg px-4 py-2 text-sm font-semibold text-canvas hover:bg-fg/90 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create import"}
        </button>
        <button
          type="button"
          disabled={busy || !bodyText.trim()}
          onClick={() => submit({ withPaste: true })}
          className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create + capture pasted JSON"}
        </button>
        <button
          type="button"
          disabled={busy || !uploadFile}
          onClick={() => submit({ withUpload: true })}
          className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Create + upload file"}
        </button>
      </div>
    </div>
  );
}
