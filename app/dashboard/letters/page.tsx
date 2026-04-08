import { Button, Chip, PageHeader, SectionHeader, Surface, TrustBanner } from "@/components/ui/primitives";

export default function LettersPage() {
  // Black Box preview demonstration. Real previews load via /api/letters/preview?id=...
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Black Box"
        title="Letter preview"
        description="Documents render server-side only. Raw files are never available to download before payment and your explicit confirmation."
        actions={
          <>
            <Button variant="secondary">Edit basis</Button>
            <Button>Confirm and pay</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Surface className="lg:col-span-2 p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-warning-500" />
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">Locked preview</p>
            </div>
            <Chip tone="warning">Unpaid draft</Chip>
          </div>
          <div className="relative h-[640px] bg-white">
            {/* Watermark */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="-rotate-[18deg] font-display text-[120px] font-black text-ink-900 opacity-[0.04]">
                UNPAID DRAFT
              </p>
            </div>
            <div className="relative px-12 py-10 text-sm text-ink-700">
              <p className="font-display text-lg font-semibold text-ink-900">Factual Dispute Letter</p>
              <p className="mt-1 text-xs text-ink-400">Case ABCD-1234 — Equifax Information Services LLC</p>
              <div className="mt-8 space-y-4 leading-relaxed">
                <p>To Whom It May Concern,</p>
                <p>
                  I am writing to dispute the following information that appears on my credit report. The item listed
                  below is inaccurate as reported and inconsistent across the three nationwide consumer reporting
                  agencies. Pursuant to my rights under the Fair Credit Reporting Act, I request that you investigate
                  and correct this information.
                </p>
                <p className="text-ink-400">[ Document body continues — protected preview ]</p>
              </div>
            </div>
          </div>
        </Surface>

        <div className="space-y-6">
          <Surface className="p-6">
            <SectionHeader title="Summary" />
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">Type</dt>
                <dd className="font-medium text-ink-900">Factual dispute</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">Recipient</dt>
                <dd className="font-medium text-ink-900">Equifax</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">Mailing</dt>
                <dd className="font-medium text-ink-900">Certified + ERR</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">Total</dt>
                <dd className="font-display text-lg font-semibold text-ink-900">$31.95</dd>
              </div>
            </dl>
          </Surface>

          <Surface className="p-6">
            <SectionHeader title="Evidence checklist" />
            <ul className="space-y-3 text-sm">
              {[
                ["Identity document", true],
                ["Proof of address", true],
                ["Cross-bureau snapshot", true],
                ["Optional: account statement", false],
              ].map(([label, ok]) => (
                <li key={label as string} className="flex items-center justify-between">
                  <span className="text-ink-700">{label}</span>
                  <Chip tone={ok ? "success" : "neutral"}>{ok ? "Attached" : "Optional"}</Chip>
                </li>
              ))}
            </ul>
          </Surface>

          <TrustBanner>
            By confirming, you authorize document preparation and certified mailing. You can cancel before dispatch.
          </TrustBanner>
        </div>
      </div>
    </div>
  );
}
