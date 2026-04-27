// Legal/compliance copy blocks — used on pricing, checkout, signup, and dashboard.
//
// DisputeIQ is built around MyScoreIQ as the supported credit-report provider
// for new customers. Legacy IdentityIQ + MyFreeScoreNow rows still read
// through admin/support views, but all customer-facing copy points at
// MyScoreIQ.

export const DISCLOSURES = {
  software:
    "DisputeIQ is a software platform that helps users organize, prepare, and track dispute activity. We do not guarantee any specific credit score increase or deletion outcome.",
  separateBilling:
    "MyScoreIQ membership is the supported report source for DisputeIQ and is billed separately by MyScoreIQ. This charge is not included in your DisputeIQ subscription.",
  packet:
    "Included packet limits apply per billing cycle. A packet is one dispute submission round and may include multiple challenged items and one or more bureau letters depending on the report contents.",
  outcome:
    "Results vary based on bureau responses, furnisher investigations, documentation, and report history.",
  planFooter:
    "Supported report source: MyScoreIQ, billed separately by MyScoreIQ. Included packets: based on your selected software plan. Not charged per dispute item.",
} as const;
