import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function DisputeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dc = await prisma.disputeCase.findUnique({
    where: { id },
    include: { attachments: true, payments: true, tradeline: true },
  }).catch(() => null);
  if (!dc) notFound();

  const logs = await prisma.auditLog.findMany({
    where: { entityType: "DisputeCase", entityId: id },
    orderBy: { createdAt: "asc" },
  }).catch(() => []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">Dispute case {dc.id.slice(0, 8)}</h1>
      <p className="mt-1 text-slate-600">{dc.letterType.replace(/_/g, " ")} — status: <strong>{dc.status}</strong></p>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">Reason</h2>
          <p className="mt-2 text-sm text-slate-700">{dc.aiReasonSummary}</p>
          {dc.legalBasisSummary && (
            <p className="mt-2 text-xs text-slate-500">{dc.legalBasisSummary}</p>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">Locked preview</h2>
          <p className="mt-1 text-xs text-slate-500">
            Server-rendered preview only. The raw letter is never downloadable before payment and your confirmation.
          </p>
          <iframe
            title="letter preview"
            src={`/api/letters/preview?id=${dc.id}`}
            className="mt-3 h-64 w-full rounded border"
          />
        </div>
      </section>

      <section className="mt-8 rounded-xl border p-4">
        <h2 className="font-semibold">Timeline</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex gap-3">
              <span className="text-slate-500">{new Date(l.createdAt).toLocaleString()}</span>
              <span className="font-medium">{l.action}</span>
            </li>
          ))}
          {logs.length === 0 && <li className="text-slate-500">No events yet.</li>}
        </ol>
      </section>

      <section className="mt-8">
        <form action="/api/payments/create-checkout" method="post">
          <input type="hidden" name="disputeCaseId" value={dc.id} />
          <input type="hidden" name="userId" value={dc.userId} />
          <input type="hidden" name="disclosuresAccepted" value="true" />
          <input type="hidden" name="affiliateDisclosureAccepted" value="true" />
          <input type="hidden" name="userConfirmed" value="true" />
          <button className="rounded bg-brand-700 px-5 py-3 text-white">Confirm and pay</button>
          <p className="mt-2 text-xs text-slate-500">
            By clicking, you confirm the basis above and authorize document preparation and certified mailing.
          </p>
        </form>
      </section>
    </main>
  );
}
