// SEO content registry. Long-form, real content for high-intent credit
// keywords. Each topic renders into /learn/[slug], /guides/[slug], and
// /how-to/[slug] with FAQ + Article + Breadcrumb JSON-LD. NEVER auto-spun;
// human-written, factually grounded, FCRA-aware.

export interface SeoSection {
  heading: string;
  body: string; // markdown-lite paragraphs joined by \n\n
}

export interface SeoFaq {
  q: string;
  a: string;
}

export interface SeoTopic {
  slug: string;
  title: string; // <h1>
  metaTitle: string; // <title>
  metaDescription: string;
  keywords: string[];
  intent: "informational" | "commercial" | "transactional";
  hero: string; // hero subtitle
  sections: SeoSection[];
  faqs: SeoFaq[];
  cta: { headline: string; body: string; href: string; label: string };
  updatedAt: string; // ISO date
  authorName: string;
}

const CTA_DEFAULT = {
  headline: "Ready to act on this?",
  body: "DisputeIQ pulls your real credit report, runs an AI analysis, drafts FCRA-compliant dispute letters, and sends them by certified mail with delivery tracking — all in one flow.",
  href: "/get-started",
  label: "Start your free analysis",
};

export const SEO_TOPICS: SeoTopic[] = [
  {
    slug: "remove-collections-from-credit-report",
    title: "How to Remove Collections from Your Credit Report",
    metaTitle: "How to Remove Collections from Your Credit Report (FCRA Method)",
    metaDescription:
      "A step-by-step guide to removing collection accounts from Equifax, Experian, and TransUnion using FCRA §611 and §623(b) — with letter templates, timelines, and what to do when bureaus stall.",
    keywords: [
      "remove collections from credit report",
      "delete collections credit report",
      "collection account dispute",
      "fcra collections removal",
    ],
    intent: "commercial",
    hero:
      "Collection accounts can stay on your report for up to seven years — but only if they're verifiable and accurate. Here's the legal process for removing them.",
    sections: [
      {
        heading: "Why collections appear on your credit report",
        body:
          "When an original creditor decides an account is uncollectible, they typically charge it off and sell or assign it to a third-party debt collector. That collector then begins reporting the debt to one or more of the three major credit bureaus — Equifax, Experian, and TransUnion — as a separate tradeline.\n\nThis is why a single unpaid medical bill or credit card can sometimes appear two or three times on the same report: once from the original creditor and again from each collector that owns or services it. Each occurrence is a separate negative item, and each one drags your score down independently.",
      },
      {
        heading: "Your rights under the FCRA and FDCPA",
        body:
          "The Fair Credit Reporting Act (FCRA) gives you the right to dispute any item on your credit report you believe is inaccurate, incomplete, or unverifiable. Section 611 (15 U.S.C. §1681i) requires the credit bureau to investigate within 30 days of receiving your dispute and to either correct, delete, or verify the information.\n\nThe Fair Debt Collection Practices Act (FDCPA) layers additional protections on top: collectors must validate the debt within five days of first contact, cannot misrepresent the amount or status, and must stop reporting if they fail to verify after a written dispute.",
      },
      {
        heading: "The 4-step removal process",
        body:
          "Step 1 — Pull your reports from all three bureaus. You need to see exactly how the collection is being reported, including the balance, date opened, date of last activity, and the collector's name.\n\nStep 2 — Identify inaccuracies. Look for balance mismatches across bureaus, wrong dates of first delinquency, duplicate entries, or accounts you don't recognize.\n\nStep 3 — Send a factual dispute letter under FCRA §611 directly to each bureau showing the inaccurate item. The letter must demand investigation and request deletion if the item cannot be verified.\n\nStep 4 — If the bureau verifies but you still believe the item is wrong, send a Method of Verification (MOV) request, then follow up with a §623(b) direct-furnisher letter to the collector itself.",
      },
      {
        heading: "What if the collector doesn't respond?",
        body:
          "If the bureau marks an item as 'verified' but the collector never actually responded — which happens far more often than consumers realize — that verification is improper under the FCRA. Document the timeline, escalate with a CFPB complaint, and in serious cases consult a consumer-rights attorney.",
      },
      {
        heading: "How DisputeIQ handles this for you",
        body:
          "DisputeIQ analyzes your real credit report, automatically detects mismatches and duplicates, drafts a factually grounded FCRA dispute letter using AI (no fabricated facts), sends it via certified mail with electronic return receipt, and tracks delivery and the 30-day clock. Every step is logged in an immutable audit trail.",
      },
    ],
    faqs: [
      {
        q: "How long do collections stay on a credit report?",
        a: "Up to seven years from the date of first delinquency on the original account, regardless of when the collector started reporting it.",
      },
      {
        q: "Will paying a collection remove it?",
        a: "Not automatically. A paid collection still appears on most credit reports until the seven-year window closes. Some collectors will agree to a 'pay for delete' arrangement in writing, but they are not legally required to.",
      },
      {
        q: "Can I dispute a collection I actually owe?",
        a: "You can dispute any item that is inaccurate, incomplete, or unverifiable — even if you owe the underlying debt. The dispute process targets the accuracy of the reporting, not the underlying validity of the debt.",
      },
      {
        q: "How long does the dispute process take?",
        a: "Bureaus have 30 days from receipt to investigate (45 if you supply additional documentation mid-investigation). Certified mail with return receipt establishes the start date.",
      },
    ],
    cta: CTA_DEFAULT,
    updatedAt: "2026-04-08",
    authorName: "DisputeIQ Editorial",
  },
  {
    slug: "how-to-dispute-credit-report",
    title: "How to Dispute a Credit Report (Step-by-Step Guide)",
    metaTitle: "How to Dispute a Credit Report — Complete FCRA Guide",
    metaDescription:
      "Learn exactly how to dispute errors on your Equifax, Experian, and TransUnion credit reports under FCRA §611, including what to send, where to send it, and how to escalate.",
    keywords: ["how to dispute credit report", "credit report dispute", "fcra dispute"],
    intent: "informational",
    hero:
      "If something on your credit report is wrong, the law gives you a clear process to fix it. Here's how to do it correctly.",
    sections: [
      {
        heading: "What counts as a disputable error",
        body:
          "Anything that is inaccurate, incomplete, or unverifiable is fair game: wrong balances, accounts that aren't yours, duplicate listings, incorrect payment history, accounts past the seven-year reporting limit, or status mismatches between bureaus.",
      },
      {
        heading: "Where to send your dispute",
        body:
          "Send disputes in writing — not online — to the credit bureau's official dispute address. Online disputes waive certain legal protections. Use certified mail with return receipt so you have proof of delivery and can start the 30-day clock.",
      },
      {
        heading: "What to include in the letter",
        body:
          "Your full legal name, current address, date of birth, and last four of SSN. The specific tradeline you're disputing, identified by creditor name and the masked account number. A clear statement of what is wrong and what you want done (deletion or correction). A reference to FCRA §611. Copies of any supporting documentation — never originals.",
      },
      {
        heading: "After you send the letter",
        body:
          "The bureau has 30 days to investigate. They will either correct the item, delete it, or send you a written notice that it has been verified. If verified, you can request the Method of Verification — the bureau must tell you who they contacted and how.",
      },
      {
        heading: "Escalation paths",
        body:
          "If the dispute fails: send a §623(b) letter to the furnisher directly. Then file a complaint with the CFPB. In serious cases, consider a consumer-rights attorney who handles FCRA cases on contingency.",
      },
    ],
    faqs: [
      {
        q: "Should I dispute online or by mail?",
        a: "Mail. Online disputes via the bureau portals waive your right to certain legal remedies under the FCRA.",
      },
      {
        q: "How many items can I dispute at once?",
        a: "There's no legal limit, but bureaus may flag bulk identical disputes as 'frivolous.' Send focused, factual letters one issue at a time when possible.",
      },
      {
        q: "Do I need an attorney to dispute?",
        a: "No. The FCRA process is designed for consumers to use directly. An attorney becomes useful when bureaus or furnishers ignore the law.",
      },
    ],
    cta: CTA_DEFAULT,
    updatedAt: "2026-04-08",
    authorName: "DisputeIQ Editorial",
  },
  {
    slug: "how-to-remove-charge-offs",
    title: "How to Remove Charge-Offs from Your Credit Report",
    metaTitle: "How to Remove Charge-Offs from Your Credit Report",
    metaDescription:
      "Charge-offs are one of the most damaging items on a credit report. Learn the legal process for disputing and removing them under the FCRA.",
    keywords: ["how to remove charge offs", "charge off removal", "delete charge off"],
    intent: "commercial",
    hero:
      "A charge-off doesn't mean the debt is forgiven — it means the original creditor wrote it off as a loss. Here's how to address it on your report.",
    sections: [
      {
        heading: "What a charge-off actually is",
        body:
          "A charge-off is an accounting action: after roughly 180 days of non-payment, a creditor moves the account from active receivables to a loss on their books. The debt itself still exists and is often sold to a collector — which is why you may see both the original creditor's charge-off and a separate collection tradeline for the same balance.",
      },
      {
        heading: "Why charge-offs hurt so much",
        body:
          "Scoring models treat a charge-off as one of the most serious negative events, comparable to a foreclosure or repossession. The damage is amplified when the account continues to update each month with the same charge-off status — each update is treated as a fresh negative event.",
      },
      {
        heading: "The dispute strategy",
        body:
          "Look for: continuing balance updates after the charge-off date, mismatched dates of first delinquency, duplicate reporting between original creditor and collector, or any factual inaccuracy. Each of these is grounds for an FCRA §611 dispute and, if needed, a §623(b) letter directly to the original creditor.",
      },
      {
        heading: "Goodwill and negotiation",
        body:
          "Some creditors will remove a charge-off as a courtesy after the underlying balance is paid — this is called a 'goodwill deletion.' It's never guaranteed, and never required by law, but it costs nothing to ask in writing.",
      },
    ],
    faqs: [
      {
        q: "How long does a charge-off stay on my credit report?",
        a: "Seven years from the date of first delinquency on the original account.",
      },
      {
        q: "Does paying a charge-off remove it?",
        a: "No. It updates the status to 'paid charge-off,' which is still negative. Removal requires a successful dispute or a goodwill agreement.",
      },
      {
        q: "Can a charge-off be sued on?",
        a: "Yes, until the statute of limitations on the underlying debt expires — which varies by state and type of debt.",
      },
    ],
    cta: CTA_DEFAULT,
    updatedAt: "2026-04-08",
    authorName: "DisputeIQ Editorial",
  },
  {
    slug: "fix-credit-fast",
    title: "How to Fix Your Credit Fast (Without the Scams)",
    metaTitle: "How to Fix Your Credit Fast — Honest Methods That Actually Work",
    metaDescription:
      "There's no overnight credit fix, but there are legitimate methods that produce results in 30-90 days. Here's what actually works and what to avoid.",
    keywords: ["fix credit fast", "improve credit score quickly", "credit repair"],
    intent: "commercial",
    hero:
      "Skip the gimmicks. Real credit improvement comes from removing inaccurate negative items, lowering utilization, and waiting out the clock.",
    sections: [
      {
        heading: "The three levers that actually move your score",
        body:
          "Payment history (35%), credit utilization (30%), and the mix and age of your accounts together drive about 80% of your FICO score. Everything else is noise relative to these three.",
      },
      {
        heading: "Quickest legitimate wins",
        body:
          "Pay down revolving balances below 30% of your limit — and ideally below 10%. Dispute inaccurate negatives under the FCRA. Become an authorized user on a long-standing, well-managed account. Request credit limit increases on existing cards (without a hard pull when possible).",
      },
      {
        heading: "What to avoid",
        body:
          "Anyone promising to remove accurate negative items, anyone asking for upfront fees beyond mailing costs, anyone telling you to dispute everything regardless of accuracy, anyone offering 'CPN' (credit privacy numbers) — those are federal fraud.",
      },
    ],
    faqs: [
      {
        q: "How fast can I really see results?",
        a: "Utilization changes can show up in a single statement cycle (~30 days). Successful disputes show up within 30-45 days of the bureau's response.",
      },
      {
        q: "Is credit repair legal?",
        a: "Yes. The Credit Repair Organizations Act (CROA) regulates how it's done. DisputeIQ operates under FCRA §611 and §623(b), the consumer's own legal rights.",
      },
    ],
    cta: CTA_DEFAULT,
    updatedAt: "2026-04-08",
    authorName: "DisputeIQ Editorial",
  },
  {
    slug: "credit-dispute-letter",
    title: "Credit Dispute Letter: Complete Template + Legal Guide",
    metaTitle: "Credit Dispute Letter — Free Template + FCRA Legal Guide",
    metaDescription:
      "How to write a credit dispute letter that actually works. Includes the legal citations, structure, and what to send to Equifax, Experian, and TransUnion.",
    keywords: ["credit dispute letter", "fcra dispute letter template", "dispute letter"],
    intent: "transactional",
    hero:
      "A dispute letter is only effective if it cites the right law, identifies the right facts, and lands at the right address.",
    sections: [
      {
        heading: "Anatomy of a working dispute letter",
        body:
          "A working FCRA dispute letter has six components: your identifying information, the specific tradeline being disputed, a factual statement of what's wrong, the legal basis (FCRA §611 for bureaus, §623(b) for furnishers), the remedy you're demanding (deletion or correction), and a deadline (30 days from receipt).",
      },
      {
        heading: "Mailing the letter correctly",
        body:
          "Always send certified mail with electronic return receipt. The return receipt is your proof of delivery and starts the 30-day investigation clock. Send to the bureau's official dispute address — not their general corporate address.",
      },
      {
        heading: "Common mistakes that kill disputes",
        body:
          "Disputing too much in one letter. Using vague language ('this is wrong'). Forgetting to include identifying information. Sending originals of supporting documents. Mailing to the wrong address. Disputing online when you have legal options.",
      },
    ],
    faqs: [
      {
        q: "Can I use a template?",
        a: "Yes, but the facts must be specific to your account. Generic templates that don't reference your actual tradeline are easy for bureaus to flag as frivolous.",
      },
      {
        q: "Do I need to include evidence?",
        a: "Helpful but not required. The bureau is obligated to investigate based on your dispute alone.",
      },
    ],
    cta: CTA_DEFAULT,
    updatedAt: "2026-04-08",
    authorName: "DisputeIQ Editorial",
  },
  {
    slug: "how-to-remove-late-payments",
    title: "How to Remove Late Payments from Your Credit Report",
    metaTitle: "How to Remove Late Payments from Your Credit Report",
    metaDescription:
      "Late payments can stay on your credit report for seven years — but inaccurate ones can be disputed under the FCRA. Here's the process.",
    keywords: ["how to remove late payments", "delete late payment", "late payment dispute"],
    intent: "commercial",
    hero:
      "Late payments are heavy negatives, but they're not untouchable. If anything about how the late was reported is wrong, you have the right to dispute it.",
    sections: [
      {
        heading: "Why late payments hurt so much",
        body:
          "FICO weights payment history at roughly 35% of your total score. A single 30-day late can drop a previously perfect score by 60-110 points depending on the rest of your file.",
      },
      {
        heading: "The dispute angles that work",
        body:
          "Date of the late payment doesn't match your records. The late is reported to one bureau but not another (status mismatch). The account was in deferment, forbearance, or a qualifying COVID accommodation. The late was the result of a billing error or autopay failure on the creditor's side.",
      },
      {
        heading: "Goodwill letters",
        body:
          "If the late is accurate but isolated and you've otherwise paid on time, a goodwill letter to the original creditor is the cleanest remedy. There's no legal obligation for them to honor it, but many will for long-tenured customers.",
      },
    ],
    faqs: [
      {
        q: "How long do late payments stay on my report?",
        a: "Seven years from the date of the late payment.",
      },
      {
        q: "Does paying the past-due balance remove the late?",
        a: "No — it brings the account current going forward but does not erase the historical late.",
      },
    ],
    cta: CTA_DEFAULT,
    updatedAt: "2026-04-08",
    authorName: "DisputeIQ Editorial",
  },
];

export function getTopic(slug: string): SeoTopic | undefined {
  return SEO_TOPICS.find((t) => t.slug === slug);
}

export function allSlugs(): string[] {
  return SEO_TOPICS.map((t) => t.slug);
}
