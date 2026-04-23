export function FollowUpBadge({
  responseDueAt,
  status,
}: {
  responseDueAt: Date | string | null | undefined;
  status: string;
}) {
  if (!responseDueAt) return null;
  if (status === "CLOSED" || status === "ESCALATION_READY") return null;

  const due = typeof responseDueAt === "string" ? new Date(responseDueAt) : responseDueAt;
  const msRemaining = due.getTime() - Date.now();
  const daysRemaining = Math.round(msRemaining / 86_400_000);

  if (daysRemaining < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 ring-1 ring-inset ring-rose-200">
        <span className="h-1 w-1 rounded-full bg-rose-500" />
        Overdue · ready to escalate
      </span>
    );
  }

  if (daysRemaining <= 5) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
        <span className="h-1 w-1 rounded-full bg-amber-500" />
        Due in {daysRemaining}d
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600 ring-1 ring-inset ring-ink-200">
      Due in {daysRemaining}d
    </span>
  );
}
