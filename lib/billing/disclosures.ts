// Legal/compliance copy blocks — used on pricing, checkout, signup, and dashboard.
//
// DisputeIQ is now built around IdentityIQ (IDIQ) as the supported
// credit-report provider. Legacy MyFreeScoreNow rows still read through
// admin/support views, but all new customer-facing copy points at IDIQ.

export const DISCLOSURES = {
  software:
    "DisputeIQ is a software platform that helps users organize, prepare, and track dispute activity. We do not guarantee any specific credit score increase or deletion outcome.",
  separateBilling:
    "IdentityIQ membership is the supported report source for DisputeIQ and is billed separately by IdentityIQ. This charge is not included in your DisputeIQ subscription.",
  packet:
    "Included packet limits apply per billing cycle. A packet is one dispute submission round and may include multiple challenged items and one or more bureau letters depending on the report contents.",
  outcome:
    "Results vary based on bureau responses, furnisher investigations, documentation, and report history.",
  planFooter:
    "Supported report source: IdentityIQ, billed separately by IdentityIQ. Included packets: based on your selected software plan. Not charged per dispute item.",
} as const;
