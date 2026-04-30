"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Tiny dependency-free toast manager.
//
// Mounts a fixed corner stack and exposes `useToast()` so admin actions
// can call `push("success", "Saved")` / `push("error", "...")`. We use
// this instead of a third-party library to keep the bundle tight and
// avoid pulling in a Provider for a small surface.

export type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
};

type ToastApi = {
  push: (tone: ToastTone, title: string, body?: string) => void;
};

const Ctx = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: number) => {
    setItems((arr) => arr.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback<ToastApi["push"]>(
    (tone, title, body) => {
      const id = nextId++;
      setItems((arr) => [...arr, { id, tone, title, body }]);
      const t = setTimeout(() => remove(id), 5500);
      timers.current.set(id, t);
    },
    [remove],
  );

  // Cleanup pending timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center sm:bottom-6 sm:right-6 sm:top-auto sm:justify-end">
        <ul className="pointer-events-auto flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
          {items.map((t) => (
            <li
              key={t.id}
              className={[
                "flex items-start gap-3 rounded-2xl border p-4 shadow-[0_18px_48px_-18px_rgba(15,23,42,0.45)] backdrop-blur",
                tonClass(t.tone),
              ].join(" ")}
            >
              <span className="mt-0.5 shrink-0">{toneGlyph(t.tone)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{t.title}</div>
                {t.body && (
                  <div className="mt-0.5 break-words text-xs leading-5 opacity-85">
                    {t.body}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label="Dismiss"
                className="rounded-full p-1 opacity-70 transition hover:opacity-100"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Soft fallback for components that mount outside the provider —
    // log instead of throwing so a refactor that misses the provider
    // doesn't crash the page.
    return {
      push: (tone, title, body) => {
        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.log(`[toast:${tone}] ${title}${body ? " — " + body : ""}`);
        }
      },
    };
  }
  return ctx;
}

function tonClass(tone: ToastTone): string {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50/95 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100";
  }
  if (tone === "error") {
    return "border-rose-200 bg-rose-50/95 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-100";
  }
  return "border-border bg-surface/95 text-fg";
}

function toneGlyph(tone: ToastTone): React.ReactNode {
  if (tone === "success") {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M5 8.5l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tone === "error") {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-rose-600 dark:text-rose-300" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M8 5v3.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="8" cy="11" r="0.7" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 text-fg-muted" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 5.5v-.5M8 7.5v3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
