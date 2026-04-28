import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) redirect("/");

  let bundle;
  try {
    bundle = await fetchQuery(
      api.mailJobs.getForCurrentUser,
      { mailJobId: jobId as Id<"mailJobs"> },
      { token },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("FORBIDDEN")) redirect("/dashboard");
    throw e;
  }
  if (!bundle) notFound();

  const { job, events } = bundle;
  const ufs = toUserFacingStatus(job.status, { signedAt: job.signedAt });
  const currentIdx = STATUS_ORDER.indexOf(ufs);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 py-10 text-fg">
      <div>
        <Link
          href="/dashboard/letters"
          className="text-[11px] uppercase tracking-[0.18em] text-fg-subtle hover:text-fg"
        >
          ← All letters
        </Link>
        <h1 className="mt-4 font-serif text-[36px] leading-tight tracking-tight">
          Certified mail packet
        </h1>
        <p className="mt-3 text-[14px] text-fg-muted">
          {bundle.disputeCase.letterType} · dispatched via USPS certified mail with electronic return
          receipt.
        </p>
      </div>

      {/* Status stepper */}
      <section className="rounded-[22px] border border-border bg-surface p-8">
        <p className="text-[10px] uppercase tracking-[0.22em] text-fg-subtle">Status</p>
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
                      : "border-border bg-surface-muted"
                }`}
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-subtle">
                  Step {String(i + 1).padStart(2, "0")}
                </p>
                <p
                  className={`mt-2 font-serif text-[15px] ${
                    current
                      ? "text-fg"
                      : reached
                        ? "text-fg"
                        : "text-fg-subtle"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </p>
              </li>
            );
          })}
        </ol>
        {ufs === "failed" && (
          <div className="mt-6 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-[13px] text-rose-700">
            This mail job could not be dispatched. Support has been notified — please contact
            support@disputeiq.org if you need help.
          </div>
        )}
      </section>

      {/* Identifiers */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Info label="Tracking number">{job.trackingCode ?? "Assigned after mailing"}</Info>
        <Info label="Packet id">{job._id.slice(0, 12)}…</Info>
        <Info label="Submitted">{fmt(job.submittedAt)}</Info>
        <Info label="Mailed">{fmt(job.mailedAt)}</Info>
        <Info label="Delivered">{fmt(job.deliveredAt)}</Info>
        <Info label="Signed for">{fmt(job.signedAt)}</Info>
      </section>

      {/* Event history */}
      <section className="rounded-[22px] border border-border bg-surface p-8">
        <p className="text-[10px] uppercase tracking-[0.22em] text-fg-subtle">Activity</p>
        <ol className="mt-6 space-y-3">
          {events.map((e) => (
            <li key={e._id} className="flex items-start justify-between gap-4 border-b border-border pb-3">
              <div>
                <p className="text-[13px] text-fg">{humanize(e.kind, e.rawStatus ?? null)}</p>
                {e.message && <p className="mt-1 text-[12px] text-fg-muted">{e.message}</p>}
              </div>
              <p className="shrink-0 font-mono text-[10px] text-fg-subtle">{fmt(e.occurredAt)}</p>
            </li>
          ))}
          {events.length === 0 && (
            <li className="text-[13px] text-fg-muted">
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
    <div className="rounded-xl border border-border bg-surface-muted p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-fg-subtle">{label}</p>
      <p className="mt-1.5 text-[13px] text-fg">{children}</p>
    </div>
  );
}

function fmt(d: number | null | undefined): string {
  if (d == null) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));
}

function humanize(kind: string, raw: string | null): string {
  if (kind === "SUBMIT") return "Packet submitted to LetterStream";
  if (kind === "SIGNATURE") return "Signature captured on delivery";
  if (kind === "RETRY") return "Retry initiated by support";
  if (kind === "ERROR") return `Error: ${raw ?? "unknown"}`;
  if (kind === "SCAN") return `USPS scan: ${raw ?? "in transit"}`;
  return raw ?? kind;
}
