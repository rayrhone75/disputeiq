import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import {
  STATUS_LABELS,
  STATUS_ORDER,
  toUserFacingStatus,
} from "@/lib/letterstream/status";

export const dynamic = "force-dynamic";

export default async function UserMailJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const u = await getSessionUser();
  if (!u) redirect("/");
  const { jobId } = await params;

  const job = await prisma.mailJob.findUnique({
    where: { id: jobId },
    include: {
      disputeCase: { select: { userId: true, letterType: true } },
      events: { orderBy: { occurredAt: "desc" }, take: 50 },
    },
  });
  if (!job) notFound();
  if (job.disputeCase.userId !== u.id) redirect("/dashboard");

  const ufs = toUserFacingStatus(job.status, { signedAt: job.signedAt });
  const currentIdx = STATUS_ORDER.indexOf(ufs);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 py-10">
      <div>
        <Link
          href="/dashboard/letters"
          className="text-[11px] uppercase tracking-[0.18em] text-white/50 hover:text-white"
        >
          ← All letters
        </Link>
        <h1 className="mt-4 font-serif text-[36px] leading-tight tracking-tight">
          Certified mail packet
        </h1>
        <p className="mt-3 text-[14px] text-white/60">
          {job.disputeCase.letterType} · dispatched via USPS certified mail with electronic return
          receipt.
        </p>
      </div>

      {/* Status stepper */}
      <section className="rounded-[22px] border border-white/10 bg-white/[0.03] p-8">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Status</p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-5">
          {STATUS_ORDER.map((s, i) => {
            const reached = ufs === "failed" ? false : i <= currentIdx;
            const current = s === ufs;
            return (
              <li
                key={s}
                className={`rounded-xl border p-4 text-center transition ${
                  current
                    ? "border-indigo-400/60 bg-indigo-500/15"
                    : reached
                      ? "border-emerald-400/30 bg-emerald-500/[0.08]"
                      : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
                  Step {String(i + 1).padStart(2, "0")}
                </p>
                <p
                  className={`mt-2 font-serif text-[15px] ${
                    current
                      ? "text-white"
                      : reached
                        ? "text-white/85"
                        : "text-white/40"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </p>
              </li>
            );
          })}
        </ol>
        {ufs === "failed" && (
          <div className="mt-6 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-[13px] text-rose-200">
            This mail job could not be dispatched. Support has been notified — please contact
            support@disputeiq.org if you need help.
          </div>
        )}
      </section>

      {/* Identifiers */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Info label="Tracking number">{job.trackingCode ?? "Assigned after mailing"}</Info>
        <Info label="Packet id">{job.id.slice(0, 12)}…</Info>
        <Info label="Submitted">{fmt(job.submittedAt)}</Info>
        <Info label="Mailed">{fmt(job.mailedAt)}</Info>
        <Info label="Delivered">{fmt(job.deliveredAt)}</Info>
        <Info label="Signed for">{fmt(job.signedAt)}</Info>
      </section>

      {/* Event history */}
      <section className="rounded-[22px] border border-white/10 bg-white/[0.03] p-8">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Activity</p>
        <ol className="mt-6 space-y-3">
          {job.events.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-4 border-b border-white/5 pb-3">
              <div>
                <p className="text-[13px] text-white/90">{humanize(e.kind, e.rawStatus)}</p>
                {e.message && <p className="mt-1 text-[12px] text-white/50">{e.message}</p>}
              </div>
              <p className="shrink-0 font-mono text-[10px] text-white/40">{fmt(e.occurredAt)}</p>
            </li>
          ))}
          {job.events.length === 0 && (
            <li className="text-[13px] text-white/50">
              Waiting for the first tracking update from LetterStream.
            </li>
          )}
        </ol>
      </section>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-1.5 text-[13px] text-white/85">{children}</p>
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

function humanize(kind: string, raw: string | null): string {
  if (kind === "SUBMIT") return "Packet submitted to LetterStream";
  if (kind === "SIGNATURE") return "Signature captured on delivery";
  if (kind === "RETRY") return "Retry initiated by support";
  if (kind === "ERROR") return `Error: ${raw ?? "unknown"}`;
  if (kind === "SCAN") return `USPS scan: ${raw ?? "in transit"}`;
  return raw ?? kind;
}

