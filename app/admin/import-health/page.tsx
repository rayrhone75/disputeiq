import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Chip, PageHeader, Surface } from "@/components/ui/primitives";

// Admin /admin/import-health
//
// One-page diagnostic for /api/reports/upload-any. Every upload attempt
// writes one importHealthEvents row; this page summarizes the last 30
// days of those rows and lists the latest 25 attempts. Lets us spot if
// a particular file format / parser branch is silently failing in
// production without staring at runtime logs.

export const dynamic = "force-dynamic";

const FORMAT_LABEL: Record<string, string> = {
  json: "JSON",
  pdf: "PDF",
  html: "HTML",
  txt: "TXT",
  unknown: "Unknown",
};

const PARSER_LABEL: Record<string, string> = {
  json: "json",
  "embedded-json": "embedded-json",
  "pdf-heuristic": "pdf-heuristic",
  "html-heuristic": "html-heuristic",
  "txt-heuristic": "txt-heuristic",
  rejected: "rejected",
};

const PARSER_TONE: Record<
  string,
  "neutral" | "accent" | "success" | "warning" | "danger"
> = {
  json: "success",
  "embedded-json": "accent",
  "pdf-heuristic": "warning",
  "html-heuristic": "warning",
  "txt-heuristic": "warning",
  rejected: "danger",
};

export default async function AdminImportHealthPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");
  const token = await getToken({ template: "convex" });

  let aggregate: Awaited<
    ReturnType<typeof fetchQuery<typeof api.importHealth.aggregate>>
  > | null = null;
  let recent: Awaited<
    ReturnType<typeof fetchQuery<typeof api.importHealth.recent>>
  > = [];
  try {
    [aggregate, recent] = await Promise.all([
      fetchQuery(
        api.importHealth.aggregate,
        { days: 30 },
        { token: token ?? undefined },
      ),
      fetchQuery(
        api.importHealth.recent,
        { limit: 25 },
        { token: token ?? undefined },
      ),
    ]);
  } catch (err) {
    if ((err as Error).message === "FORBIDDEN") redirect("/dashboard");
    throw err;
  }

  const successPct =
    aggregate && aggregate.total > 0
      ? Math.round(aggregate.successRate * 1000) / 10
      : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Import health"
        description={`Upload outcomes from /api/reports/upload-any over the last 30 days. ${
          aggregate?.total ?? 0
        } attempts.`}
      />

      {/* ── Headline tiles ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile
          label="Total uploads"
          value={(aggregate?.total ?? 0).toLocaleString()}
        />
        <Tile
          label="Success rate"
          value={`${successPct}%`}
          tone={
            aggregate && aggregate.total === 0
              ? "neutral"
              : successPct >= 95
                ? "success"
                : successPct >= 80
                  ? "warning"
                  : "danger"
          }
        />
        <Tile
          label="Successful"
          value={(aggregate?.ok ?? 0).toLocaleString()}
          tone="success"
        />
        <Tile
          label="Failed"
          value={(aggregate?.failed ?? 0).toLocaleString()}
          tone={(aggregate?.failed ?? 0) > 0 ? "danger" : "neutral"}
        />
        <Tile
          label="Needs review"
          value={(aggregate?.needsReview ?? 0).toLocaleString()}
          tone={(aggregate?.needsReview ?? 0) > 0 ? "warning" : "neutral"}
        />
      </div>

      {/* ── By format ────────────────────────────────────────────── */}
      <Surface className="p-4">
        <h3 className="text-sm font-semibold text-fg">By format</h3>
        <table className="mt-3 w-full text-xs">
          <thead className="text-left text-[10px] uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="py-2 pr-3">Format</th>
              <th className="py-2 pr-3">Total</th>
              <th className="py-2 pr-3">OK</th>
              <th className="py-2 pr-3">Failed</th>
              <th className="py-2 pr-3">Success rate</th>
            </tr>
          </thead>
          <tbody>
            {(["json", "pdf", "html", "txt", "unknown"] as const).map((f) => {
              const row = aggregate?.byFormat[f];
              const total = row?.total ?? 0;
              const ok = row?.ok ?? 0;
              const failed = row?.failed ?? 0;
              const rate =
                total > 0 ? `${Math.round((ok / total) * 1000) / 10}%` : "—";
              return (
                <tr key={f} className="border-t border-border">
                  <td className="py-2 pr-3 font-semibold">
                    {FORMAT_LABEL[f]}
                  </td>
                  <td className="py-2 pr-3">{total}</td>
                  <td className="py-2 pr-3 text-emerald-700 dark:text-emerald-300">
                    {ok}
                  </td>
                  <td className="py-2 pr-3 text-rose-700 dark:text-rose-300">
                    {failed}
                  </td>
                  <td className="py-2 pr-3 font-mono">{rate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Surface>

      {/* ── By parser path ───────────────────────────────────────── */}
      <Surface className="p-4">
        <h3 className="text-sm font-semibold text-fg">By parser path</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(
            [
              "json",
              "embedded-json",
              "pdf-heuristic",
              "html-heuristic",
              "txt-heuristic",
              "rejected",
            ] as const
          ).map((p) => (
            <div
              key={p}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs"
            >
              <Chip tone={PARSER_TONE[p]}>{PARSER_LABEL[p]}</Chip>
              <span className="font-mono">
                {(aggregate?.byParserPath[p] ?? 0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </Surface>

      {/* ── Recent attempts ──────────────────────────────────────── */}
      <Surface className="overflow-x-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fg">
            Latest 25 upload attempts
          </h3>
          {recent.length === 0 && (
            <span className="text-xs text-fg-muted">No events yet.</span>
          )}
        </div>
        {recent.length > 0 && (
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Format</th>
                <th className="py-2 pr-3">Parser</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Tradelines</th>
                <th className="py-2 pr-3">Candidates</th>
                <th className="py-2 pr-3">File</th>
                <th className="py-2 pr-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((e) => (
                <tr key={e._id} className="border-t border-border">
                  <td className="py-2 pr-3 whitespace-nowrap text-fg-muted">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 font-mono">
                    {e.actorEmail ?? (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {FORMAT_LABEL[e.format] ?? e.format}
                  </td>
                  <td className="py-2 pr-3">
                    <Chip tone={PARSER_TONE[e.parserPath] ?? "neutral"}>
                      {PARSER_LABEL[e.parserPath] ?? e.parserPath}
                    </Chip>
                  </td>
                  <td className="py-2 pr-3">
                    {e.ok ? (
                      <Chip
                        tone={
                          e.parseStatus === "needs_manual_review"
                            ? "warning"
                            : "success"
                        }
                      >
                        {e.parseStatus ?? "ok"}
                      </Chip>
                    ) : (
                      <Chip tone="danger">{e.parseStatus ?? "failed"}</Chip>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono">{e.tradelineCount}</td>
                  <td className="py-2 pr-3 font-mono">
                    {e.candidateCount ?? "—"}
                  </td>
                  <td className="py-2 pr-3 truncate" title={e.fileName ?? ""}>
                    <span className="block max-w-[18ch] truncate text-fg-muted">
                      {e.fileName ?? "—"}
                    </span>
                    {typeof e.fileSize === "number" && (
                      <span className="text-[10px] text-fg-subtle">
                        {prettyBytes(e.fileSize)}
                      </span>
                    )}
                  </td>
                  <td
                    className="py-2 pr-3 max-w-[40ch] truncate text-rose-700 dark:text-rose-300"
                    title={e.errorMessage ?? ""}
                  >
                    {e.errorMessage ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Surface>
    </div>
  );
}

function Tile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const ring =
    tone === "success"
      ? "ring-emerald-300 dark:ring-emerald-500/30"
      : tone === "warning"
        ? "ring-amber-300 dark:ring-amber-500/30"
        : tone === "danger"
          ? "ring-rose-300 dark:ring-rose-500/30"
          : "ring-border";
  return (
    <div className={`rounded-2xl bg-surface p-4 ring-1 ${ring}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-fg">
        {value}
      </p>
    </div>
  );
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
