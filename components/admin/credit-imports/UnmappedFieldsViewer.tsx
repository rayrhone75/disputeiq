"use client";

import { useMemo, useState } from "react";

type EntityGroup = {
  entity: string;
  label: string;
  items: Array<{ id: string; title: string; fields: Record<string, unknown> }>;
};

function nonEmpty(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") return Object.keys(val as Record<string, unknown>).length > 0;
  return true;
}

function format(val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "string") return val;
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

export function UnmappedFieldsViewer({ groups }: { groups: EntityGroup[] }) {
  const [open, setOpen] = useState<string | null>(null);

  const total = useMemo(
    () => groups.reduce((n, g) => n + g.items.length, 0),
    [groups],
  );

  if (total === 0) {
    return (
      <p className="text-sm text-ink-500">
        Nothing unmapped — every field the adapter encountered is in structured storage.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-500">
        Fields the adapter didn&apos;t map to structured columns. Grouped by entity so you can
        widen the mapper where it matters.
      </p>
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <details
            key={g.entity}
            className="rounded-lg border border-ink-100 bg-white/60"
            open={open === g.entity}
            onToggle={(e) => {
              if ((e.currentTarget as HTMLDetailsElement).open) setOpen(g.entity);
              else if (open === g.entity) setOpen(null);
            }}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50">
              <span>{g.label}</span>
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-mono text-ink-500">
                {g.items.length} row{g.items.length === 1 ? "" : "s"}
              </span>
            </summary>
            <div className="space-y-3 border-t border-ink-100 p-3">
              {g.items.map((row) => (
                <div key={row.id} className="rounded-lg bg-ink-50/50 p-2">
                  <p className="text-xs font-semibold text-ink-700">{row.title}</p>
                  <table className="mt-2 w-full text-[11px]">
                    <tbody>
                      {Object.entries(row.fields).map(([k, v]) => (
                        <tr key={k} className="border-t border-ink-100 first:border-0">
                          <td className="py-1 pr-3 align-top font-mono text-ink-500">{k}</td>
                          <td className="py-1 font-mono text-ink-800">
                            <pre className="whitespace-pre-wrap break-all">{format(v)}</pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </details>
        ))}
    </div>
  );
}

export type { EntityGroup };
export { nonEmpty };
