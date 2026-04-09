import { Button, Chip, PageHeader, SectionHeader, Surface, TrustBanner } from "@/components/ui/primitives";
import { ReportUploader } from "@/components/dashboard/ReportUploader";

export default function ReportsPage() {
  // Polished mocked summary — replace with live report data when present.
  const accounts = [
    { creditor: "Capital One", type: "Credit card", bureaus: ["EQ", "EX", "TU"], status: "Open", flag: "Balance mismatch", tone: "warning" as const },
    { creditor: "Discover Bank", type: "Credit card", bureaus: ["EQ", "EX", "TU"], status: "Open", flag: "Clean", tone: "success" as const },
    { creditor: "LVNV Funding", type: "Collection", bureaus: ["EX", "TU"], status: "Collection", flag: "Duplicate report", tone: "danger" as const },
    { creditor: "Sallie Mae", type: "Student loan", bureaus: ["EQ", "EX", "TU"], status: "Open", flag: "Status mismatch", tone: "warning" as const },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Reports"
        title="Your credit reports"
        description="Upload, parse, and audit your reports. We never expose raw files publicly — uploads are encrypted at rest and accessible only inside your account."
        actions={<Button href="#upload">Upload report</Button>}
      />

      <section className="grid gap-6 lg:grid-cols-3">
        <Surface id="upload" className="lg:col-span-2 p-8">
          <SectionHeader title="Upload" action={<Chip tone="accent">PDF</Chip>} />
          <ReportUploader />
        </Surface>

        <Surface className="p-8">
          <SectionHeader title="Latest snapshot" />
          <dl className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Pulled</dt>
              <dd className="font-medium text-ink-900">2 days ago</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Bureau</dt>
              <dd className="font-medium text-ink-900">All three</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Tradelines</dt>
              <dd className="font-medium text-ink-900">23</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Flagged</dt>
              <dd className="font-medium text-ink-900">11</dd>
            </div>
          </dl>
          <div className="mt-6">
            <Button variant="secondary" href="/dashboard/disputes">Open Heatmap</Button>
          </div>
        </Surface>
      </section>

      <Surface className="p-8">
        <SectionHeader title="Accounts" action={<Chip tone="neutral">Last snapshot</Chip>} />
        <div className="overflow-hidden rounded-xl border border-ink-100">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-[11px] font-semibold uppercase tracking-widest text-ink-400">
              <tr>
                <th className="px-4 py-3">Creditor</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Bureaus</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.creditor} className="border-t border-ink-100">
                  <td className="px-4 py-4 font-medium text-ink-900">{a.creditor}</td>
                  <td className="px-4 py-4 text-ink-500">{a.type}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1">
                      {a.bureaus.map((b) => (
                        <span key={b} className="rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700">
                          {b}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-ink-500">{a.status}</td>
                  <td className="px-4 py-4">
                    <Chip tone={a.tone}>{a.flag}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>

      <TrustBanner>
        Reports are stored encrypted and never exposed via public URLs. Only you and authorized support — with explicit
        scope — can view your data.
      </TrustBanner>
    </div>
  );
}
