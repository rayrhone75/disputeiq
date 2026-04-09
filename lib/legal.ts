// Legal document versioning. Bump TERMS_VERSION when the terms change so
// stored ConsentReceipts remain auditable against the exact text a user saw.
export const TERMS_VERSION = "2026-04-08.v1";
export const REFUND_POLICY_VERSION = "2026-04-08.v1";
export const PRIVACY_VERSION = "2026-04-08.v1";

export const CHECKOUT_CONSENT_ITEMS = [
  {
    key: "no_guarantee",
    text: "I understand I am paying for a dispute action service, not guaranteed results.",
  },
  {
    key: "authorization",
    text: "I authorize DisputeIQ to generate and send dispute letters on my behalf via certified mail.",
  },
  {
    key: "non_refundable",
    text: "I understand this is a one-time charge per dispute packet and is non-refundable once submitted.",
  },
  {
    key: "bureau_dependent",
    text: "I agree that results depend on credit bureaus and are not guaranteed.",
  },
] as const;

export type CheckoutConsentKey = (typeof CHECKOUT_CONSENT_ITEMS)[number]["key"];
