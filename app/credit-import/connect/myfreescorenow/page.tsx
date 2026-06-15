import Link from "next/link";
import { providerEnabled } from "@/lib/credit-import/connectors/config";
import { ConnectClient } from "../ConnectClient";

export const dynamic = "force-dynamic";

export default function MyFreeScoreNowConnectPage() {
  if (!providerEnabled("MYFREESCORENOW")) {
    return <Disabled label="MyFreeScoreNow" />;
  }
  return <ConnectClient providerId="MYFREESCORENOW" />;
}

function Disabled({ label }: { label: string }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-fg">{label} import is coming soon</h1>
      <p className="mt-3 text-fg-muted">
        This connector isn&apos;t turned on yet. You can upload or paste your
        report in the meantime.
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
