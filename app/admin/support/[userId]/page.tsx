import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Chip, PageHeader, Surface } from "@/components/ui/primitives";
import { DestructiveActionDialog } from "@/components/admin/DestructiveActionDialog";
import {
  expectedUserConfirmation,
  expectedPurgeConfirmation,
} from "@/lib/admin/deletion";
import { SupportNoteList } from "@/components/admin/support/SupportNoteList";

export const dynamic = "force-dynamic";

export default async function SupportCustomerConsole({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const actor = await requireRole(["OWNER", "ADMIN", "SUPPORT"]);
  const { userId } = await params;

  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      subscription: true,
      creditImports: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          _count: {
            select: {
              tradelines: true,
              collections: true,
              disputeCandidates: true,
            },
          },
        },
      },
      disputes: {
        orderBy: { userConfirmedAt: "desc" },
        take: 20,
      },
      payments: { orderBy: { createdAt: "desc" }, take: 10 },
      consentReceipts: { orderBy: { acceptedAt: "desc" }, take: 5 },
    },
  });
  if (!u) return notFound();

  const recentAudit = await prisma.auditLog.findMany({
    where: { OR: [{ targetUserId: userId }, { actorUserId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { actorUser: { select: { email: true } } },
  });

  const notes = await prisma.supportNote.findMany({
    where: { userId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { author: { select: { email: true } } },
  });

  const errorRows = recentAudit.filter((r) =>
    /FAILED|ERROR|CONFIRMATION_MISMATCH|DELETED|HARD_PURGED/.test(r.action),
  );

  const isArchived = !!u.archivedAt;
  const canHardPurge = actor.role === "OWNER";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Support console"
        title={u.email}
        description={`Customer id ${u.id.slice(0, 10)}… · joined ${u.createdAt.toLocaleDateString()}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={isArchived ? "neutral" : "success"}>
              {isArchived ? "archived" : u.role}
            </Chip>
            {u.subscription && <Chip tone="accent">{u.subscription.planCode}</Chip>}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Surface className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Imports
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">{u.creditImports.length}</p>
        </Surface>
        <Surface className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Disputes
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">{u.disputes.length}</p>
        </Surface>
        <Surface className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Payments
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">{u.payments.length}</p>
        </Surface>
        <Surface className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Notes
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">{notes.length}</p>
        </Surface>
      </div>

      <Surface className="p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-500">
          Import history
        </h2>
        {u.creditImports.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No credit imports yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Bureaus</th>
                  <th className="py-2 pr-3">TL</th>
                  <th className="py-2 pr-3">Col</th>
                  <th className="py-2 pr-3">Cand</th>
                  <th className="py-2 pr-3">Open</th>
                </tr>
              </thead>
              <tbody>
                {u.creditImports.map((imp) => (
                  <tr key={imp.id} className="border-t border-ink-100">
                    <td className="py-2 pr-3 font-mono">
                      {imp.createdAt.toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-3">{imp.provider}</td>
                    <td className="py-2 pr-3">
                      <Chip
                        tone={
                          imp.status === "NORMALIZED"
                            ? "success"
                            : imp.status === "FAILED"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {imp.status}
                      </Chip>
                    </td>
                    <td className="py-2 pr-3 font-mono text-[10px]">
                      {imp.bureauCoverage.join(",") || "—"}
                    </td>
                    <td className="py-2 pr-3">{imp._count.tradelines}</td>
                    <td className="py-2 pr-3">{imp._count.collections}</td>
                    <td className="py-2 pr-3 font-semibold">{imp._count.disputeCandidates}</td>
                    <td className="py-2 pr-3">
                      <Link
                        href={`/admin/credit-imports/${imp.id}`}
                        className="text-accent-600 underline"
                      >
                        open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      <Surface className="p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-500">
          Error timeline
        </h2>
        {errorRows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No error events in recent history.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs">
            {errorRows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50/50 p-2"
              >
                <div>
                  <p className="font-mono font-semibold text-rose-700">{r.action}</p>
                  <p className="text-[11px] text-ink-600">
                    {r.entityType} / {r.entityId.slice(0, 10)}… ·{" "}
                    {r.actorUser?.email ?? "system"}
                  </p>
                </div>
                <span className="text-[10px] text-ink-400">
                  {r.createdAt.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <Surface className="p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-500">
          Audit trail (recent 30)
        </h2>
        <ul className="mt-3 space-y-1 text-xs">
          {recentAudit.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 border-b border-ink-100 py-1 last:border-0"
            >
              <span className="font-mono text-ink-800">{r.action}</span>
              <span className="text-[10px] text-ink-500">
                {r.actorUser?.email ?? "system"} · {r.createdAt.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </Surface>

      <Surface className="p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-500">
          Support notes (internal)
        </h2>
        <div className="mt-3">
          <SupportNoteList userId={userId} initialNotes={notes} />
        </div>
      </Surface>

      <Surface className="border-rose-200 p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-rose-600">
          Action rail — destructive
        </h2>
        <p className="mt-1 text-xs text-ink-500">
          Visually separated and typed-confirmation-gated. Archive first; hard purge only when
          required and only by OWNER.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <DestructiveActionDialog
            title="Delete all credit imports for this customer"
            description="Removes every CreditReportImport (raw + normalized + candidates) for this user. Leaves legacy CreditReport rows and disputes intact."
            previewUrl={`/api/admin/users/${userId}/impact`}
            submitUrl={`/api/admin/users/${userId}/imports/delete`}
            expectedConfirmation={expectedUserConfirmation(u.email)}
            cta="Delete all imports"
            variant="destructive"
          />
          <DestructiveActionDialog
            title="Archive this customer"
            description="Soft delete — anonymizes PII, blocks sign-in, preserves audit history. Default choice for GDPR/CCPA style delete requests."
            previewUrl={`/api/admin/users/${userId}/impact`}
            submitUrl={`/api/admin/users/${userId}/archive`}
            expectedConfirmation={expectedUserConfirmation(u.email)}
            cta="Archive customer"
            variant="caution"
          />
          {canHardPurge && (
            <DestructiveActionDialog
              title="HARD PURGE this customer (irreversible)"
              description="Irreversible. Removes the user row and every cascaded relation. Only use when required by a legal purge order or other explicit authorization."
              previewUrl={`/api/admin/users/${userId}/impact`}
              submitUrl={`/api/admin/users/${userId}/purge`}
              expectedConfirmation={expectedPurgeConfirmation(u.email)}
              cta="Hard purge"
              variant="purge"
            />
          )}
        </div>
      </Surface>
    </div>
  );
}
