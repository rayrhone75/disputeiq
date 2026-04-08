import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader, Surface, Chip, SectionHeader } from "@/components/ui/primitives";
import { STATUS_LABELS, toUserFacingStatus } from "@/lib/letterstream/status";

export const dynamic = "force-dynamic";

const CHIP_TONE: Record<string, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  queued: "warning",
  mailed: "accent",
  in_transit: "accent",
  delivered: "success",
  signed: "success",
  failed: "danger",
};

export default async function AdminMailJobsPage() {
  const u = await getSessionUser();
  if (!u || !["OWNER", "ADMIN", "SUPPORT"].includes(u.role)) redirect("/");

  const jobs = await prisma.mailJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      disputeCase: {
        select: { id: true, letterType: true, user: { select: { email: true } } },
      },
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="LetterStream"
        title="Mail jobs"
        description="Every certified mail packet dispatched through LetterStream. Failed jobs can be manually retried; submitted jobs are locked to prevent double-mailing."
      />

      <Surface>
        <SectionHeader title={`${jobs.length} most recent jobs`} />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.18em] text-white/50">
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Provider ID</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const ufs = toUserFacingStatus(j.status, { signedAt: j.signedAt });
                return (
                  <tr key={j.id} className="border-b border-white/5">
                    <td className="px-4 py-3 font-mono text-[11px] text-white/80">
                      {j.id.slice(0, 10)}…
                    </td>
                    <td className="px-4 py-3 text-white/80">{j.disputeCase.user.email}</td>
                    <td className="px-4 py-3 text-white/70">{j.disputeCase.letterType}</td>
                    <td className="px-4 py-3">
                      <Chip tone={CHIP_TONE[ufs]}>{STATUS_LABELS[ufs]}</Chip>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-white/60">
                      {j.providerJobId ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-white/60">{j.mode}</td>
                    <td className="px-4 py-3 text-white/50">
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(j.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/mail-jobs/${j.id}`}
                        className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-300 hover:text-indigo-200"
                      >
                        Inspect →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-white/50">
                    No mail jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Surface>
    </div>
  );
}
