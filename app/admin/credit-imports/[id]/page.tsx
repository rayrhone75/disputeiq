import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Chip, PageHeader, Surface } from "@/components/ui/primitives";
import { ImportDetailPanel } from "@/components/admin/credit-imports/ImportDetailPanel";
import { StatusTimeline, type TimelineEntry } from "@/components/admin/credit-imports/StatusTimeline";
import {
  UnmappedFieldsViewer,
  nonEmpty,
  type EntityGroup,
} from "@/components/admin/credit-imports/UnmappedFieldsViewer";
import { DestructiveActionDialog } from "@/components/admin/DestructiveActionDialog";
import { expectedImportConfirmation } from "@/lib/admin/deletion";

export const dynamic = "force-dynamic";

function centsToDollars(c?: number | null): string {
  if (c == null) return "—";
  return (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function toDateOrNull(ms?: number | null): Date | null {
  return typeof ms === "number" ? new Date(ms) : null;
}

export default async function CreditImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");
  const token = await getToken({ template: "convex" });
  const { id } = await params;

  let payload: Awaited<ReturnType<typeof fetchQuery<typeof api.creditImports.adminGet>>>;
  let auditRows: Awaited<ReturnType<typeof fetchQuery<typeof api.creditImports.adminListAuditRows>>>;
  try {
    [payload, auditRows] = await Promise.all([
      fetchQuery(
        api.creditImports.adminGet,
        { id: id as Id<"creditReportImports"> },
        { token: token ?? undefined },
      ),
      fetchQuery(
        api.creditImports.adminListAuditRows,
        { id: id as Id<"creditReportImports"> },
        { token: token ?? undefined },
      ),
    ]);
  } catch (err) {
    if ((err as Error).message === "FORBIDDEN") redirect("/dashboard");
    throw err;
  }

  if (!payload) return notFound();

  const imp = payload.import;
  const tradelines = [...payload.tradelines].sort((a, b) =>
    a.creditorName.localeCompare(b.creditorName),
  );
  const inquiries = [...payload.inquiries].sort(
    (a, b) => (b.inquiryDate ?? 0) - (a.inquiryDate ?? 0),
  );
  const collections = [...payload.collections].sort(
    (a, b) => (b.reportedAt ?? 0) - (a.reportedAt ?? 0),
  );

  const lifecycleActions = new Set([
    "CREDIT_IMPORT_CREATED",
    "CREDIT_IMPORT_RAW_CAPTURED",
    "CREDIT_IMPORT_NORMALIZED",
    "CREDIT_IMPORT_RERUN",
    "CREDIT_IMPORT_RAW_INSPECTED",
    "CREDIT_IMPORT_DELETED",
  ]);
  const filteredAudit = auditRows.filter((a) => lifecycleActions.has(a.action));

  const timeline: TimelineEntry[] = [
    {
      label: "Created",
      occurredAt: new Date(imp.createdAt),
      tone: "neutral",
      actor:
        filteredAudit.find((a) => a.action === "CREDIT_IMPORT_CREATED")?.actorUser?.email ?? null,
      detail: `Provider: ${imp.provider}`,
    },
    {
      label: "Raw captured",
      occurredAt: toDateOrNull(imp.fetchedAt),
      tone: "accent",
      actor:
        filteredAudit.find((a) => a.action === "CREDIT_IMPORT_RAW_CAPTURED")?.actorUser?.email ??
        null,
      detail: payload.raw
        ? `${payload.raw.payloadBytes.toLocaleString()} bytes · sha256 ${payload.raw.payloadHash.slice(0, 12)}…`
        : null,
    },
    {
      label: "Validated",
      occurredAt: toDateOrNull(imp.validatedAt),
      tone: "accent",
    },
    {
      label: "Normalized",
      occurredAt: toDateOrNull(imp.normalizedAt),
      tone: "success",
      actor:
        filteredAudit.find((a) => a.action === "CREDIT_IMPORT_NORMALIZED")?.actorUser?.email ?? null,
      detail: `${tradelines.length} TL · ${collections.length} col · ${payload.disputeCandidates.length} candidates`,
    },
    ...filteredAudit
      .filter((a) => a.action === "CREDIT_IMPORT_RERUN")
      .map((a) => ({
        label: "Re-run",
        occurredAt: new Date(a.createdAt),
        tone: "accent" as const,
        actor: a.actorUser?.email ?? null,
        detail:
          typeof a.metadataJson === "object" && a.metadataJson
            ? `tradelines: ${(a.metadataJson as Record<string, unknown>).tradelineCount ?? "?"} · candidates: ${(a.metadataJson as Record<string, unknown>).candidatesCreated ?? "?"}`
            : null,
      })),
    ...filteredAudit
      .filter((a) => a.action === "CREDIT_IMPORT_RAW_INSPECTED")
      .map((a) => ({
        label: "Raw inspected",
        occurredAt: new Date(a.createdAt),
        tone: "neutral" as const,
        actor: a.actorUser?.email ?? null,
      })),
    ...(imp.status === "FAILED" && imp.errorCode
      ? [
          {
            label: "Failed",
            occurredAt: new Date(imp.updatedAt),
            tone: "danger" as const,
            detail: `${imp.errorCode}${imp.errorMessage ? ` — ${imp.errorMessage}` : ""}`,
          },
        ]
      : []),
  ];

  const unmappedGroups: EntityGroup[] = [
    {
      entity: "normalized",
      label: "Normalized report (top-level unmapped)",
      items:
        payload.normalized?.unmappedFieldsJson && nonEmpty(payload.normalized.unmappedFieldsJson)
          ? [
              {
                id: payload.normalized._id as unknown as string,
                title: "report root",
                fields: payload.normalized.unmappedFieldsJson as Record<string, unknown>,
              },
            ]
          : [],
    },
    {
      entity: "tradelines",
      label: "Tradelines",
      items: payload.tradelines
        .filter((t) => nonEmpty(t.unmappedFieldsJson))
        .map((t) => ({
          id: t._id as unknown as string,
          title: `${t.bureau} · ${t.creditorName} · ${t.accountRefMasked}`,
          fields: (t.unmappedFieldsJson as Record<string, unknown>) ?? {},
        })),
    },
    {
      entity: "collections",
      label: "Collections",
      items: payload.collections
        .filter((c) => nonEmpty(c.unmappedFieldsJson))
        .map((c) => ({
          id: c._id as unknown as string,
          title: `${c.bureau} · ${c.collectorName}`,
          fields: (c.unmappedFieldsJson as Record<string, unknown>) ?? {},
        })),
    },
    {
      entity: "inquiries",
      label: "Inquiries",
      items: payload.inquiries
        .filter((q) => nonEmpty(q.unmappedFieldsJson))
        .map((q) => ({
          id: q._id as unknown as string,
          title: `${q.bureau} · ${q.inquirerName}`,
          fields: (q.unmappedFieldsJson as Record<string, unknown>) ?? {},
        })),
    },
    {
      entity: "publicRecords",
      label: "Public records",
      items: payload.publicRecords
        .filter((p) => nonEmpty(p.unmappedFieldsJson))
        .map((p) => ({
          id: p._id as unknown as string,
          title: `${p.bureau} · ${p.recordType}`,
          fields: (p.unmappedFieldsJson as Record<string, unknown>) ?? {},
        })),
    },
    {
      entity: "profiles",
      label: "Personal profiles",
      items: payload.personalProfiles
        .filter((p) => nonEmpty(p.unmappedFieldsJson))
        .map((p) => ({
          id: p._id as unknown as string,
          title: `${p.bureau} · ${p.fullName ?? "unnamed"}`,
          fields: (p.unmappedFieldsJson as Record<string, unknown>) ?? {},
        })),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Import · ${imp.provider}`}
        title={`Credit import ${(imp._id as unknown as string).slice(0, 8)}…`}
        description={`User: ${payload.user?.email ?? "—"} · created ${new Date(imp.createdAt).toLocaleString()}`}
        actions={
          <Chip
            tone={
              imp.status === "NORMALIZED"
                ? "success"
                : imp.status === "FAILED"
                  ? "danger"
                  : imp.status === "PENDING"
                    ? "neutral"
                    : "accent"
            }
          >
            {imp.status}
          </Chip>
        }
      />

      {imp.errorCode && (
        <Surface className="border-danger-500/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-danger-600">
            Error: {imp.errorCode}
          </p>
          {imp.errorMessage && <p className="mt-1 text-sm text-fg-muted">{imp.errorMessage}</p>}
        </Surface>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Surface className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Raw</p>
          {payload.raw ? (
            <>
              <p className="mt-1 text-sm font-semibold text-fg">
                {payload.raw.payloadBytes.toLocaleString()} bytes
              </p>
              <p className="mt-1 break-all font-mono text-[10px] text-fg-muted">
                sha256: {payload.raw.payloadHash.slice(0, 24)}…
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                captured {new Date(payload.raw.capturedAt).toLocaleString()}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-fg-muted">Not captured yet</p>
          )}
        </Surface>
        <Surface className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            Bureau coverage
          </p>
          <p className="mt-1 text-sm font-semibold text-fg">
            {imp.bureauCoverage.length ? imp.bureauCoverage.join(", ") : "—"}
          </p>
        </Surface>
        <Surface className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Schema</p>
          <p className="mt-1 text-sm font-semibold text-fg">
            {imp.schemaVersion} · parser {imp.parserVersion}
          </p>
        </Surface>
      </div>

      <ImportDetailPanel
        importId={imp._id as unknown as string}
        hasRaw={!!payload.raw}
        defaultUrl={imp.sourceUrl ?? ""}
      />

      <Surface className="p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          Lifecycle timeline
        </h2>
        <div className="mt-3">
          <StatusTimeline entries={timeline} />
        </div>
      </Surface>

      <Surface className="p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          Unmapped fields
        </h2>
        <div className="mt-3">
          <UnmappedFieldsViewer groups={unmappedGroups} />
        </div>
      </Surface>

      <Surface className="p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          Tradelines ({tradelines.length})
        </h2>
        {tradelines.length === 0 ? (
          <p className="mt-3 text-sm text-fg-muted">None yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="py-2 pr-3">Bureau</th>
                  <th className="py-2 pr-3">Creditor</th>
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Balance</th>
                  <th className="py-2 pr-3">Past due</th>
                  <th className="py-2 pr-3">Flags</th>
                </tr>
              </thead>
              <tbody>
                {tradelines.map((t) => (
                  <tr key={t._id as unknown as string} className="border-t border-border">
                    <td className="py-2 pr-3 font-mono">{t.bureau}</td>
                    <td className="py-2 pr-3 font-semibold">{t.creditorName}</td>
                    <td className="py-2 pr-3 font-mono">{t.accountRefMasked}</td>
                    <td className="py-2 pr-3">{t.statusLabel ?? "—"}</td>
                    <td className="py-2 pr-3">{centsToDollars(t.balanceCents)}</td>
                    <td className="py-2 pr-3">{centsToDollars(t.pastDueCents)}</td>
                    <td className="py-2 pr-3 space-x-1">
                      {t.isCollection && <Chip tone="warning">collection</Chip>}
                      {t.isChargeOff && <Chip tone="danger">charge-off</Chip>}
                      {t.isMedical && <Chip tone="accent">medical</Chip>}
                      {t.isDerogatory && <Chip tone="danger">derog</Chip>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      <Surface className="p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          Dispute candidates ({payload.disputeCandidates.length})
        </h2>
        {payload.disputeCandidates.length === 0 ? (
          <p className="mt-3 text-sm text-fg-muted">None.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {payload.disputeCandidates.map((c) => (
              <li
                key={c._id as unknown as string}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface/70 p-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Chip
                      tone={
                        c.severity === "high"
                          ? "danger"
                          : c.severity === "medium"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {c.severity}
                    </Chip>
                    <Chip tone="accent">{c.reason}</Chip>
                    <Chip tone="neutral">{c.bureau}</Chip>
                    <Chip tone="neutral">{c.stage}</Chip>
                  </div>
                  <p className="text-sm text-fg">{c.summary}</p>
                  {c.legalBasis.length > 0 && (
                    <p className="text-[10px] text-fg-muted">{c.legalBasis.join(" · ")}</p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] uppercase text-fg-subtle">{c.confidence}</span>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <Surface className="border-rose-200 p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-rose-600">
          Destructive actions
        </h2>
        <p className="mt-1 text-xs text-fg-muted">
          Deleting this import removes the raw payload, normalized rows, and generated dispute
          candidates. The user account and legacy credit reports are not touched.
        </p>
        <div className="mt-3">
          <DestructiveActionDialog
            title="Delete this credit import"
            description="Remove the raw payload, normalized rows, and dispute candidates associated with this import. The user account stays intact."
            previewUrl={`/api/admin/credit-imports/${imp._id}/delete`}
            submitUrl={`/api/admin/credit-imports/${imp._id}/delete`}
            expectedConfirmation={expectedImportConfirmation(imp._id as unknown as string)}
            cta="Delete import"
            variant="destructive"
          />
        </div>
      </Surface>

      <Surface className="p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          Normalized summary
        </h2>
        {payload.normalized ? (
          <pre className="mt-3 max-h-[360px] overflow-auto rounded-lg bg-fg/5 p-3 font-mono text-[11px] text-fg">
{JSON.stringify(payload.normalized.summaryJson, null, 2)}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-fg-muted">Not normalized yet.</p>
        )}
        {payload.normalized?.validationWarnings?.length ? (
          <p className="mt-3 text-xs text-warning-700">
            Warnings: {payload.normalized.validationWarnings.join(", ")}
          </p>
        ) : null}
      </Surface>

      <span className="hidden">{inquiries.length}</span>
    </div>
  );
}
