import Link from "next/link";
import {
  connectorsEnabled,
  providerEnabled,
  CONNECTOR_PROVIDER_LIST,
} from "@/lib/credit-import/connectors/config";

// /credit-import/connect — provider selection landing.
// Server-gated by FEATURE_CREDIT_CONNECTORS.

export const dynamic = "force-dynamic";

export default function ConnectLanding() {
  if (!connectorsEnabled()) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Auto-import is coming soon
        </h1>
        <p className="mt-3 text-fg-muted">
          One-click import from your credit-monitoring account isn&apos;t turned
          on yet. In the meantime you can upload or paste your report.
        </p>
        <Link
          href="/dashboard/get-report"
          className="mt-6 inline-flex rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
        >
          Upload my report
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
        Connect your credit monitoring
      </h1>
      <p className="mt-2 text-sm text-fg-muted">
        Choose your provider. We&apos;ll securely pull your latest 3-bureau
        report — no copy-paste, no file upload.
      </p>

      <div className="mt-8 grid gap-4">
        {CONNECTOR_PROVIDER_LIST.map((p) => {
          const enabled = providerEnabled(p.id);
          return (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-2xl border border-default bg-surface/60 p-5"
            >
              <div>
                <div className="text-lg font-semibold text-fg">{p.label}</div>
                <div className="text-xs text-fg-muted">
                  {enabled ? "3-bureau auto-import" : "Coming soon"}
                </div>
              </div>
              {enabled ? (
                <Link
                  href={`/credit-import/connect/${p.slug}`}
                  className="rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-700"
                >
                  Connect
                </Link>
              ) : (
                <span className="rounded-xl border border-default px-5 py-2.5 text-sm text-fg-muted">
                  Soon
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-sm text-fg-muted">
        Prefer to do it yourself?{" "}
        <Link href="/dashboard/get-report" className="font-semibold text-violet-600">
          Upload or paste your report
        </Link>
        .
      </p>
    </main>
  );
}
