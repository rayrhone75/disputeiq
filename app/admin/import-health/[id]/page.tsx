import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Chip, PageHeader, Surface } from "@/components/ui/primitives";

// /admin/import-health/[id]
//
// Single-event drill-down for support. Shows everything we recorded
// about one upload attempt — enough context to triage a "needs_manual_
// review" case without grepping logs. If the upload made it to the new
// import pipeline (i.e. the JSON / embedded-json / pdf-heuristic
// branches that succeeded into createImport), we link to the matching
// /admin/credit-imports row from here so support can re-run
// normalization on the captured payload.

export const dynamic = "force-dynamic";

const FORMAT_LABEL: Record<string, string> = {
  json: "JSON",
  pdf: "PDF",
  html: "HTML",
  txt: "TXT",
  unknown: "Unknown",
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

export default async function AdminImportHealthDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");
  const token = await getToken({ template: "convex" });
  const { id } = await params;

  let row: Awaited<
    ReturnType<typeof fetchQuery<typeof api.importHealth.byId>>
  > = null;
  try {
    row = await fetchQuery(
      api.importHealth.byId,
      { id: id as unknown as Id<"importHealthEvents"> },
      { token: token ?? undefined },
    );
  } catch (err) {
    if ((err as Error).message === "FORBIDDEN") redirect("/dashboard");
    throw err;
  }
  if (!row) notFound();

  const okTone: "success" | "warning" | "danger" = !row.ok
    ? "danger"
    : row.parseStatus === "needs_manual_review"
      ? "warning"
      : "success";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin · Import health"
        title={`Upload attempt · ${FORMAT_LABEL[row.format] ?? row.format}`}
        description={`${row.actorEmail ?? "(unknown user)"} · ${new Date(row.createdAt).toLocaleString()}`}
        actions={
          <Link
            href="/admin/import-health"
            className="rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-fg-muted hover:bg-surface-muted"
          >
            ← All events
          </Link>
        }
      />

      <Surface className="p-5">
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Field label="When" value={new Date(row.createdAt).toLocaleString()} />
          <Field label="Customer email" value={row.actorEmail ?? "—"} mono />
          <Field label="Clerk user id" value={row.clerkUserId ?? "—"} mono />
          <Field
            label="Detected format"
            value={FORMAT_LABEL[row.format] ?? row.format}
          />
          <Field
            label="Parser path"
            valueNode={
              <Chip tone={PARSER_TONE[row.parserPath] ?? "neutral"}>
                {row.parserPath}
              </Chip>
            }
          />
          <Field
            label="Outcome"
            valueNode={
              <Chip tone={okTone}>
                {row.ok ? row.parseStatus ?? "ok" : row.parseStatus ?? "failed"}
              </Chip>
            }
          />
          <Field label="Tradelines extracted" value={String(row.tradelineCount)} />
          <Field
            label="Dispute candidates"
            value={String(row.candidateCount ?? "—")}
          />
          <Field label="File name" value={row.fileName ?? "—"} mono />
          <Field
            label="File size"
            value={
              typeof row.fileSize === "number"
                ? prettyBytes(row.fileSize)
                : "—"
            }
          />
          <Field
            label="Event id"
            value={row._id as unknown as string}
            mono
          />
        </div>
      </Surface>

      {row.errorMessage && (
        <Surface className="p-5">
          <h3 className="text-sm font-semibold text-fg">Error / review reason</h3>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-muted/40 p-3 font-mono text-[12px] text-rose-700 dark:text-rose-300">
            {row.errorMessage}
          </pre>
        </Surface>
      )}

      <Surface className="p-5">
        <h3 className="text-sm font-semibold text-fg">Where to look next</h3>
        <ul className="mt-3 space-y-2 text-sm text-fg-muted">
          <li>
            <span className="text-fg">Successful imports</span> (parser path
            <code className="mx-1 rounded bg-surface-muted/40 px-1 font-mono text-[11px]">
              json
            </code>
            /
            <code className="mx-1 rounded bg-surface-muted/40 px-1 font-mono text-[11px]">
              embedded-json
            </code>
            /
            <code className="mx-1 rounded bg-surface-muted/40 px-1 font-mono text-[11px]">
              pdf-heuristic
            </code>
            /
            <code className="mx-1 rounded bg-surface-muted/40 px-1 font-mono text-[11px]">
              html-heuristic
            </code>
            /
            <code className="mx-1 rounded bg-surface-muted/40 px-1 font-mono text-[11px]">
              txt-heuristic
            </code>
            ) land in
            {" "}
            <Link
              href="/admin/credit-imports"
              className="font-semibold text-accent-600 underline"
            >
              /admin/credit-imports
            </Link>
            . Filter by this customer&apos;s email to find the matching row.
          </li>
          <li>
            <span className="text-fg">Low-confidence text/PDF uploads</span>{" "}
            also create a captureRaw stub in the new pipeline (visible
            in /admin/credit-imports) plus a row in the legacy{" "}
            <Link
              href="/admin/reports"
              className="font-semibold text-accent-600 underline"
            >
              /admin/reports
            </Link>{" "}
            table for any tradelines the heuristic could pull. Either
            view will show the file is in the system.
          </li>
          {row.parserPath === "rejected" && (
            <li>
              <span className="text-fg">Rejected uploads</span> never
              touched the import pipeline. The customer saw a friendly
              error in the upload card; nothing else needs doing unless
              the file size / format pattern is recurring.
            </li>
          )}
        </ul>
      </Surface>
    </div>
  );
}

function Field({
  label,
  value,
  valueNode,
  mono,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <div
        className={`mt-1 break-all text-sm text-fg ${mono ? "font-mono text-[12px]" : ""}`}
      >
        {valueNode ?? value ?? "—"}
      </div>
    </div>
  );
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
