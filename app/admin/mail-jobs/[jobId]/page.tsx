import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { retryMailJob } from "@/lib/jobs/retry-mail-job";
import { PageHeader, Surface, Chip, SectionHeader, Button } from "@/components/ui/primitives";
import { STATUS_LABELS, toUserFacingStatus } from "@/lib/letterstream/status";

export const dynamic = "force-dynamic";

async function retryAction(formData: FormData) {
  "use server";
  const u = await getSessionUser();
  if (!u || !["OWNER", "ADMIN"].includes(u.role)) throw new Error("FORBIDDEN");
  const id = String(formData.get("mailJobId") ?? "");
  if (!id) throw new Error("missing id");
  await retryMailJob({ mailJobId: id, actorUserId: u.id });
}

export default async function AdminMailJobDetail({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const u = await getSessionUser();
  if (!u || !["OWNER", "ADMIN", "SUPPORT"].includes(u.role)) redirect("/");

  const { jobId } = await params;

  const job = await prisma.mailJob.findUnique({
    where: { id: jobId },
    include: {
      disputeCase: {
        include: {
          user: { select: { id: true, email: true } },
          tradeline: true,
        },
      },
      events: { orderBy: { occurredAt: "desc" }, take: 200 },
    },
  });
  if (!job) notFound();

  const ufs = toUserFacingStatus(job.status, { signedAt: job.signedAt });
  const canRetry = job.status === "FAILED" && ["OWNER", "ADMIN"].includes(u.role);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Mail job · ${job.provider}`}
        title={`Packet ${job.id.slice(0, 10)}…`}
        description={`Dispute case ${job.disputeCaseId} · user ${job.disputeCase.user.email}`}
        actions={
          <Link
            href="/admin/mail-jobs"
            className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/60 hover:text-white"
          >
            ← Back
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Surface>
          <SectionHeader title="Status" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="User-facing status">
              <Chip
                tone={
                  ufs === "failed"
                    ? "danger"
                    : ufs === "delivered" || ufs === "signed"
                      ? "success"
                      : "accent"
                }
              >
                {STATUS_LABELS[ufs]}
              </Chip>
            </Field>
            <Field label="Provider status">{job.status}</Field>
            <Field label="Provider job id">{job.providerJobId ?? "—"}</Field>
            <Field label="Tracking code">{job.trackingCode ?? "—"}</Field>
            <Field label="Mode">{job.mode}</Field>
            <Field label="Attempts">{String(job.attempts)}</Field>
            <Field label="Submitted">{fmt(job.submittedAt)}</Field>
            <Field label="Mailed">{fmt(job.mailedAt)}</Field>
            <Field label="Delivered">{fmt(job.deliveredAt)}</Field>
            <Field label="Signed">{fmt(job.signedAt)}</Field>
            <Field label="Signature ref">{job.signatureRef ?? "—"}</Field>
            <Field label="Last error">
              {job.lastError ? (
                <span className="text-rose-300">{job.lastError}</span>
              ) : (
                "—"
              )}
            </Field>
          </div>

          {canRetry && (
            <form action={retryAction} className="mt-8 border-t border-white/10 pt-6">
              <input type="hidden" name="mailJobId" value={job.id} />
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                Manual retry
              </p>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/65">
                Retry this failed mail job. A new MailJob row will be created for audit traceability.
                This action is logged and immutable.
              </p>
              <div className="mt-4">
                <Button type="submit" variant="primary">
                  Retry failed job
                </Button>
              </div>
            </form>
          )}
        </Surface>

        <Surface>
          <SectionHeader title="Event timeline" />
          <ol className="space-y-3">
            {job.events.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-indigo-300">
                    {e.kind}
                  </p>
                  <p className="font-mono text-[10px] text-white/40">
                    {fmt(e.occurredAt)}
                  </p>
                </div>
                {e.rawStatus && (
                  <p className="mt-2 text-[12px] text-white/80">{e.rawStatus}</p>
                )}
                {e.message && (
                  <p className="mt-1 text-[12px] text-white/55">{e.message}</p>
                )}
                {e.mappedStatus && (
                  <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/45">
                    → {e.mappedStatus}
                  </p>
                )}
              </li>
            ))}
            {job.events.length === 0 && (
              <li className="text-[13px] text-white/50">No events recorded yet.</li>
            )}
          </ol>
        </Surface>
      </div>

      <Surface>
        <SectionHeader title="Raw provider response" />
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 text-[11px] text-white/70">
{JSON.stringify(job.rawResponseJson ?? null, null, 2)}
        </pre>
      </Surface>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <div className="mt-1.5 text-[13px] text-white/85">{children}</div>
    </div>
  );
}

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
