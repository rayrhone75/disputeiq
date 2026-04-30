import { describe, expect, it } from "vitest";
import {
  deriveAdvisorSuggestions,
  type AdvisorInputAggregates,
  type AdvisorInputOverview,
} from "../advisor";

function over(overrides: Partial<AdvisorInputOverview> = {}): AdvisorInputOverview {
  return {
    onboarding: { hasProfile: true, hasSubscription: true },
    creditReportStatus: { kind: "imported" },
    packetUsage: { plan: "PRO", remaining: 3 },
    user: { billingOverride: null },
    ...overrides,
  };
}
function aggr(overrides: Partial<AdvisorInputAggregates> = {}): AdvisorInputAggregates {
  return {
    totalItems: 5,
    removed: 0,
    inDispute: 0,
    draftReady: 0,
    responseReceived: 0,
    escalationReady: 0,
    collections: 0,
    ...overrides,
  };
}

describe("deriveAdvisorSuggestions", () => {
  it("prioritises profile_missing > no_subscription > no_report", () => {
    const out = deriveAdvisorSuggestions(
      over({
        onboarding: { hasProfile: false, hasSubscription: false },
        creditReportStatus: { kind: "not_started" },
      }),
      aggr({ totalItems: 0 }),
    );
    expect(out.map((s) => s.key)).toEqual([
      "profile_missing",
      "no_subscription",
      "no_report",
    ]);
  });

  it("skips 'choose a plan' for comped users", () => {
    const out = deriveAdvisorSuggestions(
      over({
        onboarding: { hasProfile: true, hasSubscription: false },
        user: { billingOverride: "free" },
      }),
      aggr({ totalItems: 0 }),
    );
    expect(out.some((s) => s.key === "no_subscription")).toBe(false);
  });

  it("surfaces drafts_ready ahead of first_round when both could fire", () => {
    const out = deriveAdvisorSuggestions(
      over(),
      aggr({ totalItems: 5, draftReady: 2 }),
    );
    // draftReady wins; first_round shouldn't appear because draftReady > 0.
    expect(out[0].key).toBe("drafts_ready");
    expect(out.some((s) => s.key === "first_round")).toBe(false);
  });

  it("emits collections_ready only when the file is fresh and no actions queued", () => {
    const out = deriveAdvisorSuggestions(
      over(),
      aggr({ totalItems: 8, collections: 3 }),
    );
    expect(out.some((s) => s.key === "collections_ready")).toBe(true);
  });

  it("celebrates first deletion", () => {
    const out = deriveAdvisorSuggestions(
      over(),
      aggr({ totalItems: 5, removed: 1 }),
    );
    expect(out.some((s) => s.key === "first_deletion")).toBe(true);
  });

  it("flags packet_limit_hit only for paid customers at the cap", () => {
    const paid = deriveAdvisorSuggestions(
      over({ packetUsage: { plan: "STARTER", remaining: 0 } }),
      aggr({ draftReady: 2 }),
    );
    expect(paid.some((s) => s.key === "packet_limit_hit")).toBe(true);

    const comped = deriveAdvisorSuggestions(
      over({
        packetUsage: { plan: "STARTER", remaining: 0 },
        user: { billingOverride: "free" },
      }),
      aggr({ draftReady: 2 }),
    );
    expect(comped.some((s) => s.key === "packet_limit_hit")).toBe(false);
  });

  it("caps the output at 3 suggestions", () => {
    const out = deriveAdvisorSuggestions(
      over({
        onboarding: { hasProfile: false, hasSubscription: false },
        creditReportStatus: { kind: "failed" },
      }),
      aggr({
        draftReady: 2,
        responseReceived: 1,
        escalationReady: 1,
        collections: 2,
        removed: 1,
      }),
    );
    expect(out.length).toBeLessThanOrEqual(3);
  });
});
