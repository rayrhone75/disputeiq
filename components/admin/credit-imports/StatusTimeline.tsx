import { Chip } from "@/components/ui/primitives";

type TimelineEntry = {
  label: string;
  occurredAt: Date | string | null | undefined;
  actor?: string | null;
  detail?: string | null;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
};

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return Number.isFinite(dt.getTime()) ? dt.toLocaleString() : "—";
}

export function StatusTimeline({ entries }: { entries: TimelineEntry[] }) {
  const visible = entries.filter((e) => !!e.occurredAt);
  if (visible.length === 0) {
    return <p className="text-sm text-ink-500">No lifecycle events yet.</p>;
  }
  visible.sort((a, b) => {
    const da = new Date(a.occurredAt as string | Date).getTime();
    const db = new Date(b.occurredAt as string | Date).getTime();
    return da - db;
  });
  return (
    <ol className="space-y-3">
      {visible.map((e, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="h-2 w-2 rounded-full bg-accent-500" />
            {i < visible.length - 1 && <span className="mt-1 w-px flex-1 bg-ink-200" />}
          </div>
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2">
              <Chip tone={e.tone ?? "neutral"}>{e.label}</Chip>
              <span className="text-xs text-ink-500">{fmt(e.occurredAt)}</span>
              {e.actor && (
                <span className="text-[11px] font-mono text-ink-400">by {e.actor}</span>
              )}
            </div>
            {e.detail && <p className="mt-1 text-xs text-ink-600">{e.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export type { TimelineEntry };
