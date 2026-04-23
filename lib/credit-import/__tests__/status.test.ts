import { describe, it, expect } from "vitest";
import {
  deriveCreditReportStatus,
  type CreditReportStatusInputs,
} from "../status";

function makeImport(status: string, createdAt = new Date("2025-11-01")): CreditReportStatusInputs["latestImport"] {
  return {
    id: "imp_1",
    status,
    createdAt,
    updatedAt: createdAt,
    normalizedAt: status === "NORMALIZED" ? createdAt : null,
  };
}

describe("deriveCreditReportStatus", () => {
  it("returns not_started when there is no import, no legacy report, no click", () => {
    const out = deriveCreditReportStatus({
      latestImport: null,
      legacyReportCount: 0,
      idiqClick: null,
    });
    expect(out.kind).toBe("not_started");
    expect(out.latestImportId).toBeNull();
    expect(out.hasClickedIdiq).toBe(false);
  });

  it("returns in_progress when the user clicked IDIQ but has no import yet", () => {
    const click = { createdAt: new Date("2025-11-15") };
    const out = deriveCreditReportStatus({
      latestImport: null,
      legacyReportCount: 0,
      idiqClick: click,
    });
    expect(out.kind).toBe("in_progress");
    expect(out.hasClickedIdiq).toBe(true);
    expect(out.lastUpdatedAt?.getTime()).toBe(click.createdAt.getTime());
  });

  it.each(["PENDING", "FETCHED", "VALIDATED"] as const)(
    "returns in_progress when latest import status is %s",
    (status) => {
      const out = deriveCreditReportStatus({
        latestImport: makeImport(status),
        legacyReportCount: 0,
        idiqClick: null,
      });
      expect(out.kind).toBe("in_progress");
      expect(out.latestImportStatus).toBe(status);
    },
  );

  it("returns imported when latest import is NORMALIZED", () => {
    const out = deriveCreditReportStatus({
      latestImport: makeImport("NORMALIZED"),
      legacyReportCount: 0,
      idiqClick: null,
    });
    expect(out.kind).toBe("imported");
    expect(out.latestImportStatus).toBe("NORMALIZED");
  });

  it("returns failed when latest import is FAILED", () => {
    const out = deriveCreditReportStatus({
      latestImport: makeImport("FAILED"),
      legacyReportCount: 0,
      idiqClick: null,
    });
    expect(out.kind).toBe("failed");
  });

  it("ignores ARCHIVED imports and falls back to the next signal", () => {
    // Archived + no legacy + no click → not_started
    const outA = deriveCreditReportStatus({
      latestImport: makeImport("ARCHIVED"),
      legacyReportCount: 0,
      idiqClick: null,
    });
    expect(outA.kind).toBe("not_started");

    // Archived + legacy report exists → imported
    const outB = deriveCreditReportStatus({
      latestImport: makeImport("ARCHIVED"),
      legacyReportCount: 1,
      idiqClick: null,
    });
    expect(outB.kind).toBe("imported");
  });

  it("treats legacy CreditReport rows as imported when no import pipeline row exists", () => {
    const out = deriveCreditReportStatus({
      latestImport: null,
      legacyReportCount: 3,
      idiqClick: { createdAt: new Date() },
    });
    expect(out.kind).toBe("imported");
    expect(out.legacyReportCount).toBe(3);
  });

  it("import status wins over the IDIQ click signal", () => {
    const out = deriveCreditReportStatus({
      latestImport: makeImport("FAILED"),
      legacyReportCount: 0,
      idiqClick: { createdAt: new Date() },
    });
    expect(out.kind).toBe("failed");
  });
});
