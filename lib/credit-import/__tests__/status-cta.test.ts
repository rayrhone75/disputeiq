// Checks the CTA routing table in CreditReportStatusChip stays aligned with
// the four states contract. The `STATUS_META` export is the single place
// that maps state → label + href; keep these assertions in lockstep.
import { describe, it, expect } from "vitest";
import { STATUS_META } from "@/components/dashboard/CreditReportStatusChip";

describe("CreditReportStatusChip CTA table", () => {
  it("defines exactly the four contracted states", () => {
    expect(Object.keys(STATUS_META).sort()).toEqual(
      ["failed", "imported", "in_progress", "not_started"],
    );
  });

  it("uses the contracted labels", () => {
    expect(STATUS_META.not_started.label).toBe("Not Started");
    expect(STATUS_META.in_progress.label).toBe("In Progress");
    expect(STATUS_META.imported.label).toBe("Imported");
    expect(STATUS_META.failed.label).toBe("Failed");
  });

  it("uses the contracted CTA copy + href per state", () => {
    expect(STATUS_META.not_started.ctaLabel).toBe("Activate MyScoreIQ");
    expect(STATUS_META.not_started.ctaHref).toBe("/dashboard/get-report");

    expect(STATUS_META.in_progress.ctaLabel).toBe("I completed my report");
    expect(STATUS_META.in_progress.ctaHref).toBe("/dashboard/reports");

    expect(STATUS_META.imported.ctaLabel).toBe("View dispute plan");
    expect(STATUS_META.imported.ctaHref).toBe("/dashboard/disputes");

    expect(STATUS_META.failed.ctaLabel).toBe("Retry import");
    expect(STATUS_META.failed.ctaHref).toBe("/dashboard/reports");
  });

  it("pulses the indicator only for in_progress", () => {
    expect(STATUS_META.in_progress.pulse).toBe(true);
    expect(STATUS_META.not_started.pulse).toBe(false);
    expect(STATUS_META.imported.pulse).toBe(false);
    expect(STATUS_META.failed.pulse).toBe(false);
  });
});
