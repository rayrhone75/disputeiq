import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
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

export default async function CreditImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["OWNER", "ADMIN"]);
  const { id } = await params;

  const imp = await prisma.creditReportImport.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true } },
      raw: {
        select: {
          id: true,
          payloadBytes: true,
          payloadHash: true,
          redactionFingerprint: true,
          capturedAt: true,
        },
      },
      normalized: true,
      tradelines: { orderBy: { creditorName: "asc" } },
      inquiries: { orderBy: { inquiryDate: "desc" } },
      collections: { orderBy: { reportedAt: "desc" } },
      publicRecords: true,
      scoreSnapshots: true,
      personalProfiles: true,
      disputeCandidates: true,
    },
  });
  if (!imp) return notFound();

  // Pull the lifecycle audit trail (actor + event detail).
  const auditRows = await prisma.auditLog.findMany({
    where: {
      entityType: "CreditReportImport",
      entityId: imp.id,
      action: {
        in: [
          "CREDIT_IMPORT_CREATED",
          "CREDIT_IMPORT_RAW_CAPTURED",
          "CREDIT_IMPORT_NORMALIZED",
          "CREDIT_IMPORT_RERUN",
          "CREDIT_IMPORT_RAW_INSPECTED",
          "CREDIT_IMPORT_DELETED",
        ],
      },
    },
    orderBy: { createdAt: "asc" },
    include: { actorUser: { select: { email: true } } },
  });

  const timeline: TimelineEntry[] = [
    {
      label: "Created",
      occurredAt: imp.createdAt,
      tone: "neutral",
      actor:
        auditRows.find((a) => a.action === "CREDIT_IMPORT_CREATED")?.actorUser?.email ?? null,
      detail: `Provider: ${imp.provider}`,
    },
    {
      label: "Raw captured",
      occurredAt: imp.fetchedAt,
      tone: "accent",
      actor:
        auditRows.find((a) => a.action === "CREDIT_IMPORT_RAW_CAPTURED")?.actorUser?.email ?? null,
      detail: imp.raw
        ? `${imp.raw.payloadBytes.toLocaleString()} bytes · sha256 ${imp.raw.payloadHash.slice(0, 12)}…`
        : null,
    },
    {
      label: "Validated",
      occurredAt: imp.validatedAt,
      tone: "accent",
    },
    {
      label: "Normalized",
      occurredAt: imp.normalizedAt,
      tone: "success",
      actor:
        auditRows.find((a) => a.action === "CREDIT_IMPORT_NORMALIZED")?.actorUser?.email ?? null,
      detail: `${imp.tradelines.length} TL · ${imp.collections.length} col · ${imp.disputeCandidates.length} candidates`,
    },
    ...auditRows
      .filter((a) => a.action === "CREDIT_IMPORT_RERUN")
      .map((a) => ({
        label: "Re-run",
        occurredAt: a.createdAt,
        tone: "accent" as const,
        actor: a.actorUser?.email ?? null,
        detail:
          typeof a.metadataJson === "object" && a.metadataJson
            ? `tradelines: ${(a.metadataJson as Record<string, unknown>).tradelineCount ?? "?"} · candidates: ${(a.metadataJson as Record<string, unknown>).candidatesCreated ?? "?"}`
            : null,
      })),
    ...auditRows
      .filter((a) => a.action === "CREDIT_IMPORT_RAW_INSPECTED")
      .map((a) => ({
        label: "Raw inspected",
        occurredAt: a.createdAt,
        tone: "neutral" as const,
        actor: a.actorUser?.email ?? null,
      })),
    ...(imp.status === "FAILED" && imp.errorCode
      ? [
          {
            label: "Failed",
            occurredAt: imp.updatedAt,
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
        imp.normalized?.unmappedFieldsJson && nonEmpty(imp.normalized.unmappedFieldsJson)
          ? [
              {
                id: imp.normalized.id,
                title: "report root",
                fields: imp.normalized.unmappedFieldsJson as Record<string, unknown>,
              },
            ]
          : [],
    },
    {
      entity: "tradelines",
      label: "Tradelines",
      items: imp.tradelines
        .filter((t) => nonEmpty(t.unmappedFieldsJson))
        .map((t) => ({
          id: t.id,
          title: `${t.bureau} · ${t.creditorName} · ${t.accountRefMasked}`,
          fields: (t.unmappedFieldsJson as Record<string, unknown>) ?? {},
        })),
    },
    {
      entity: "collections",
      label: "Collections",
      items: imp.collections
        .filter((c) => nonEmpty(c.unmappedFieldsJson))
        .map((c) => ({
          id: c.id,
          title: `${c.bureau} · ${c.collectorName}`,
          fields: (c.unmappedFieldsJson as Record<string, unknown>) ?? {},
        })),
    },
    {
      entity: "inquiries",
      label: "Inquiries",
      items: imp.inquiries
        .filter((q) => nonEmpty(q.unmappedFieldsJson))
        .map((q) => ({
          id: q.id,
          title: `${q.bureau} · ${q.inquirerName}`,
          fields: (q.unmappedFieldsJson as Record<string, unknown>) ?? {},
        })),
    },
    {
      entity: "publicRecords",
      label: "Public records",
      items: imp.publicRecords
        .filter((p) => nonEmpty(p.unmappedFieldsJson))
        .map((p) => ({
          id: p.id,
          title: `${p.bureau} · ${p.recordType}`,
          fields: (p.unmappedFieldsJson as Record<string, unknown>) ?? {},
        })),
    },
    {
      entity: "profiles",
      label: "Personal profiles",
      items: imp.personalProfiles
        .filter((p) => nonEmpty(p.unmappedFieldsJson))
        .map((p) => ({
          id: p.id,
          title: `${p.bureau} · ${p.fullName ?? "unnamed"}`,
          fields: (p.unmappedFieldsJson as Record<string, unknown>) ?? {},
        })),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Import · ${imp.provider}`}
        title={`Credit import ${imp.id.slice(0, 8)}…`}
        description={`User: ${imp.user.email} · created ${imp.createdAt.toLocaleString()}`}
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
          {imp.errorMessage && <p className="mt-1 text-sm text-ink-700">{imp.errorMessage}</p>}
        </Surface>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Surface className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Raw</p>
          {imp.raw ? (
            <>
              <p className="mt-1 text-sm font-semibold text-ink-900">
                {imp.raw.payloadBytes.toLocaleString()} bytes
              </p>
              <p className="mt-1 break-all font-mono text-[10px] text-ink-500">
                sha256: {imp.raw.payloadHash.slice(0, 24)}…
              </p>
              <p className="mt-1 text-xs text-ink-500">
                captured {imp.raw.capturedAt.toLocaleString()}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-500">Not captured yet</p>
          )}
        </Surface>
        <Surface className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Bureau coverage
          </p>
          <p className="mt-1 text-sm font-semibold text-ink-900">
            {imp.bureauCoverage.length ? imp.bureauCoverage.join(", ") : "—"}
          </p>
        </Surface>
        <Surface className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Schema</p>
          <p className="mt-1 text-sm font-semibold text-ink-900">
            {imp.schemaVersion} · parser {imp.parserVersion}
          </p>
        </Surface>
      </div>

      <ImportDetailPanel
        importId={imp.id}
        hasRaw={!!imp.raw}
        defaultUrl={imp.sourceUrl ?? ""}
      />

      <Surface className="p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-500">
          Lifecycle timeline
        </h2>
        <div className="mt-3">
          <StatusTimeline entries={timeline} />
        </div>
      </Surface>

      <Surface className="p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-500">
          Unmapped fields
        </h2>
        <div className="mt-3">
          <UnmappedFieldsViewer groups={unmappedGroups} />
        </div>
      </Surface>

      <Surface className="p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-500">
          Tradelines ({imp.tradelines.length})
        </h2>
        {imp.tradelines.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">None yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wide text-ink-500">
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
                {imp.tradelines.map((t) => (
                  <tr key={t.id} className="border-t border-ink-100">
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
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-500">
          Dispute candidates ({imp.disputeCandidates.length})
        </h2>
        {imp.disputeCandidates.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">None.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {imp.disputeCandidates.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-ink-100 bg-white/60 p-3 text-xs"
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
                  <p className="text-sm text-ink-800">{c.summary}</p>
                  {c.legalBasis.length > 0 && (
                    <p className="text-[10px] text-ink-500">{c.legalBasis.join(" · ")}</p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] uppercase text-ink-400">{c.confidence}</span>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <Surface className="border-rose-200 p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-rose-600">
          Destructive actions
        </h2>
        <p className="mt-1 text-xs text-ink-500">
          Deleting this import removes the raw payload, normalized rows, and generated dispute
          candidates. The user account and legacy credit reports are not touched.
        </p>
        <div className="mt-3">
          <DestructiveActionDialog
            title="Delete this credit import"
            description="Remove the raw payload, normalized rows, and dispute candidates associated with this import. The user account stays intact."
            previewUrl={`/api/admin/credit-imports/${imp.id}/delete`}
            submitUrl={`/api/admin/credit-imports/${imp.id}/delete`}
            expectedConfirmation={expectedImportConfirmation(imp.id)}
            cta="Delete import"
            variant="destructive"
          />
        </div>
      </Surface>

      <Surface className="p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-500">
          Normalized summary
        </h2>
        {imp.normalized ? (
          <pre className="mt-3 max-h-[360px] overflow-auto rounded-lg bg-ink-900/5 p-3 font-mono text-[11px] text-ink-800">
{JSON.stringify(imp.normalized.summaryJson, null, 2)}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-ink-500">Not normalized yet.</p>
        )}
        {imp.normalized?.validationWarnings?.length ? (
          <p className="mt-3 text-xs text-warning-700">
            Warnings: {imp.normalized.validationWarnings.join(", ")}
          </p>
        ) : null}
      </Surface>
    </div>
  );
}
