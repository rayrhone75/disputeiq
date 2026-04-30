import { describe, expect, it } from "vitest";
import {
  deriveHealthSignals,
  topSignal,
  type HealthInput,
} from "../health";

const DAY = 1000 * 60 * 60 * 24;
const NOW = 1_700_000_000_000;

function base(overrides: Partial<HealthInput> = {}): HealthInput {
  return {
    user: { createdAt: NOW - 30 * DAY, isVip: false, archivedAt: null },
    hasProfile: true,
    hasActiveSubscription: true,
    subscriptionStatus: "active",
    importsCount: 1,
    latestImportStatus: "NORMALIZED",
    disputesStarted: 1,
    lastActivityAt: NOW - 1 * DAY,
    staleAdminUnreadThreads: 0,
    nowMs: NOW,
    ...overrides,
  };
}

describe("deriveHealthSignals", () => {
  it("returns empty for a healthy customer", () => {
    expect(deriveHealthSignals(base())).toEqual([]);
  });

  it("flags past_due as alert and ranks it first", () => {
    const signals = deriveHealthSignals(
      base({
        subscriptionStatus: "past_due",
        hasActiveSubscription: false,
        staleAdminUnreadThreads: 1,
      }),
    );
    expect(signals[0].key).toBe("past_due");
    expect(signals[0].severity).toBe("alert");
  });

  it("flags missing profile after the 1-day grace window", () => {
    const signals = deriveHealthSignals(
      base({
        hasProfile: false,
        user: { createdAt: NOW - 5 * DAY, isVip: false, archivedAt: null },
      }),
    );
    expect(signals.some((s) => s.key === "profile_missing")).toBe(true);
  });

  it("does NOT flag missing profile within the first day", () => {
    const signals = deriveHealthSignals(
      base({
        hasProfile: false,
        user: { createdAt: NOW - 6 * 60 * 60 * 1000, isVip: false, archivedAt: null },
      }),
    );
    expect(signals.some((s) => s.key === "profile_missing")).toBe(false);
  });

  it("flags no_report after 3 days", () => {
    const signals = deriveHealthSignals(
      base({
        importsCount: 0,
        latestImportStatus: null,
        disputesStarted: 0,
        user: { createdAt: NOW - 5 * DAY, isVip: false, archivedAt: null },
      }),
    );
    expect(signals.some((s) => s.key === "no_report")).toBe(true);
  });

  it("flags import_failed as alert", () => {
    const signals = deriveHealthSignals(
      base({
        latestImportStatus: "FAILED",
        disputesStarted: 0,
      }),
    );
    expect(signals.some((s) => s.key === "import_failed" && s.severity === "alert")).toBe(true);
  });

  it("flags no_disputes_started only after 7 days post-import", () => {
    const tooEarly = deriveHealthSignals(
      base({
        latestImportStatus: "NORMALIZED",
        disputesStarted: 0,
        user: { createdAt: NOW - 5 * DAY, isVip: false, archivedAt: null },
      }),
    );
    expect(tooEarly.some((s) => s.key === "no_disputes_started")).toBe(false);

    const ready = deriveHealthSignals(
      base({
        latestImportStatus: "NORMALIZED",
        disputesStarted: 0,
        user: { createdAt: NOW - 10 * DAY, isVip: false, archivedAt: null },
      }),
    );
    expect(ready.some((s) => s.key === "no_disputes_started")).toBe(true);
  });

  it("flags inactive_30d when no activity recorded for 30+ days", () => {
    const signals = deriveHealthSignals(
      base({
        lastActivityAt: NOW - 31 * DAY,
      }),
    );
    expect(signals.some((s) => s.key === "inactive_30d")).toBe(true);
  });

  it("includes a VIP marker but topSignal ignores it", () => {
    const inputs = base({
      user: { createdAt: NOW - 30 * DAY, isVip: true, archivedAt: null },
    });
    const signals = deriveHealthSignals(inputs);
    expect(signals.some((s) => s.key === "vip")).toBe(true);
    // No other signals → topSignal returns null.
    expect(topSignal(inputs)).toBeNull();
  });

  it("topSignal picks the highest-rank non-VIP signal", () => {
    const t = topSignal(
      base({
        user: { createdAt: NOW - 30 * DAY, isVip: true, archivedAt: null },
        subscriptionStatus: "past_due",
        hasActiveSubscription: false,
        importsCount: 0,
        latestImportStatus: null,
        disputesStarted: 0,
      }),
    );
    expect(t?.key).toBe("past_due");
  });

  it("does not flag onboarding signals on archived users", () => {
    const signals = deriveHealthSignals(
      base({
        user: {
          createdAt: NOW - 60 * DAY,
          isVip: false,
          archivedAt: NOW - 30 * DAY,
        },
        hasProfile: false,
        hasActiveSubscription: false,
        subscriptionStatus: null,
        importsCount: 0,
        latestImportStatus: null,
        disputesStarted: 0,
        lastActivityAt: NOW - 60 * DAY,
      }),
    );
    expect(signals.some((s) => s.key === "profile_missing")).toBe(false);
    expect(signals.some((s) => s.key === "no_subscription")).toBe(false);
    expect(signals.some((s) => s.key === "no_report")).toBe(false);
    expect(signals.some((s) => s.key === "inactive_30d")).toBe(false);
  });
});
