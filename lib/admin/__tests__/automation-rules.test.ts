import { describe, expect, it } from "vitest";
import {
  runAutomationRules,
  type AutomationInput,
} from "../automation-rules";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = 1_700_000_000_000;

function base(overrides: Partial<AutomationInput> = {}): AutomationInput {
  return {
    user: { _id: "u1", createdAt: NOW - 30 * DAY, isVip: false, archivedAt: null },
    hasActiveSubscription: true,
    subscriptionStatus: "active",
    importsCount: 1,
    latestImportStatus: "NORMALIZED",
    latestImportNormalizedAt: NOW - 1 * HOUR,
    disputesStarted: 1,
    deletionsCount: 0,
    pendingFollowUpsCount: 0,
    lastActivityAt: NOW - 1 * HOUR,
    firstDeletionAlreadyFired: false,
    nowMs: NOW,
    ...overrides,
  };
}

describe("runAutomationRules", () => {
  it("returns empty for a healthy customer", () => {
    expect(runAutomationRules(base())).toEqual([]);
  });

  it("fires no_report_24h after 24h with no imports", () => {
    const fired = runAutomationRules(
      base({
        user: { _id: "u1", createdAt: NOW - 30 * HOUR, archivedAt: null },
        importsCount: 0,
        latestImportStatus: null,
        latestImportNormalizedAt: null,
        disputesStarted: 0,
      }),
    );
    expect(fired.find((f) => f.ruleKey === "no_report_24h")).toBeDefined();
  });

  it("does NOT fire no_report_24h within 24h", () => {
    const fired = runAutomationRules(
      base({
        user: { _id: "u1", createdAt: NOW - 6 * HOUR, archivedAt: null },
        importsCount: 0,
        latestImportStatus: null,
        latestImportNormalizedAt: null,
        disputesStarted: 0,
      }),
    );
    expect(fired.find((f) => f.ruleKey === "no_report_24h")).toBeUndefined();
  });

  it("fires no_disputes_24h after 24h post-import", () => {
    const fired = runAutomationRules(
      base({
        latestImportNormalizedAt: NOW - 26 * HOUR,
        disputesStarted: 0,
      }),
    );
    expect(fired.find((f) => f.ruleKey === "no_disputes_24h")).toBeDefined();
  });

  it("fires import_failed as alert", () => {
    const fired = runAutomationRules(
      base({ latestImportStatus: "FAILED", latestImportNormalizedAt: null }),
    );
    const r = fired.find((f) => f.ruleKey === "import_failed");
    expect(r?.severity).toBe("alert");
  });

  it("fires inactive_3d after 3+ days", () => {
    const fired = runAutomationRules(
      base({ lastActivityAt: NOW - 5 * DAY }),
    );
    expect(fired.find((f) => f.ruleKey === "inactive_3d")).toBeDefined();
  });

  it("fires payment_failed for past_due subscription", () => {
    const fired = runAutomationRules(
      base({
        subscriptionStatus: "past_due",
        hasActiveSubscription: false,
      }),
    );
    expect(fired.find((f) => f.ruleKey === "payment_failed")).toBeDefined();
  });

  it("fires first_deletion only when not already fired", () => {
    const fresh = runAutomationRules(
      base({ deletionsCount: 1 }),
    );
    expect(fresh.find((f) => f.ruleKey === "first_deletion")).toBeDefined();
    const repeat = runAutomationRules(
      base({ deletionsCount: 3, firstDeletionAlreadyFired: true }),
    );
    expect(repeat.find((f) => f.ruleKey === "first_deletion")).toBeUndefined();
  });

  it("fires vip_followup only when VIP + active disputes + no pending follow-ups", () => {
    const fired = runAutomationRules(
      base({
        user: { _id: "u1", createdAt: NOW - 30 * DAY, isVip: true, archivedAt: null },
        disputesStarted: 2,
        pendingFollowUpsCount: 0,
      }),
    );
    expect(fired.find((f) => f.ruleKey === "vip_followup")).toBeDefined();

    const noFire = runAutomationRules(
      base({
        user: { _id: "u1", createdAt: NOW - 30 * DAY, isVip: true, archivedAt: null },
        disputesStarted: 2,
        pendingFollowUpsCount: 1,
      }),
    );
    expect(noFire.find((f) => f.ruleKey === "vip_followup")).toBeUndefined();
  });

  it("returns empty for archived users regardless of state", () => {
    const fired = runAutomationRules(
      base({
        user: {
          _id: "u1",
          createdAt: NOW - 30 * DAY,
          isVip: false,
          archivedAt: NOW - 1 * DAY,
        },
        importsCount: 0,
        latestImportStatus: "FAILED",
        subscriptionStatus: "past_due",
        lastActivityAt: NOW - 30 * DAY,
      }),
    );
    expect(fired).toEqual([]);
  });
});
