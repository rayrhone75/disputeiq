// Packet definition — used in pricing, checkout, FAQ, and legal disclosures.
// A packet is NOT one tradeline. It is one dispute submission round.

export const PACKET_DEFINITION = {
  label: "Dispute Packet",
  publicDescription:
    "A packet is one dispute submission round. It may include multiple challenged items and may generate one or more bureau letters depending on which bureaus are involved.",
  shortDescription:
    "One dispute round with multiple items grouped together.",
  legalNote:
    "Packet usage is based on one dispute round submitted through the platform. The number of letters generated may vary depending on the bureaus involved and the contents of your report.",
} as const;
