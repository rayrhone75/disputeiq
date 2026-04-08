export type ComplianceInput = {
  disclosuresAccepted: boolean;
  affiliateDisclosureAccepted: boolean;
  userConfirmed: boolean;
};

export function assertCompliantAction(input: ComplianceInput) {
  if (!input.disclosuresAccepted) {
    throw new Error("Required disclosures must be accepted.");
  }
  if (!input.affiliateDisclosureAccepted) {
    throw new Error("Affiliate disclosure must be accepted.");
  }
  if (!input.userConfirmed) {
    throw new Error("User confirmation is required.");
  }
}

export const COMPLIANCE_NOTICE =
  "You may dispute inaccuracies on your credit report yourself, for free, directly with the credit bureaus. This platform is a software and workflow tool that helps you organize, prepare, and track your own actions. We do not guarantee removals or score changes.";
